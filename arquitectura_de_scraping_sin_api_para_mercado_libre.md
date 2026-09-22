# Arquitectura y Guía de Scraping: Mercado Libre (Sin API)

Este documento detalla la arquitectura completa para extraer **ofertas** y los **más vendidos** de Mercado Libre mediante scraping directo con Python (usando `curl_cffi` y `selectolax`), sin depender de tokens, registros de desarrollador, certificados HTTPS ni túneles locales.

---

## 1. Dónde Residen los Datos Públicos

Mercado Libre renderiza del lado del servidor gran parte de su catálogo, lo que permite extraer información directamente del HTML sin ejecutar un navegador pesado:

| Sección | URL Base (Ejemplo México) | Estructura de Datos |
| :--- | :--- | :--- |
| **Página Central de Más Vendidos** | `https://www.mercadolibre.com.mx/mas-vendidos` | Agrupado por categorías principales con etiquetas de posición (`1º MÁS VENDIDO`). |
| **Más Vendidos por Categoría** | `https://www.mercadolibre.com.mx/mas-vendidos/{CATEGORY_ID}` | Lista del Top 20 al Top 50 ordenado correlativamente (ej. `/mas-vendidos/MLM1649` para Computación). |
| **Ofertas Generales** | `https://www.mercadolibre.com.mx/ofertas` | Lista paginada con tarjetas de productos (`.poly-card`), porcentaje de rebaja y precio tachado. |
| **Ofertas con Filtro de Descuento** | `https://www.mercadolibre.com.mx/ofertas?discount=20-100` | Filtra solo productos con al menos 20% de descuento real. |

---

## 2. Diagrama de Arquitectura

Al no usar la API oficial, el scraper actúa como un extractor desacoplado para no saturar la IP ni ralentizar las respuestas del usuario final:

```
                  ┌───────────────────────────────┐
                  │        Frontend (SPA)         │
                  │       React / Vue + Vite      │
                  └───────────────┬───────────────┘
                                  │ GET /api/v1/comparator
                                  ▼
                  ┌───────────────────────────────┐
                  │        FastAPI Backend        │
                  │   (Sirve datos consolidados)  │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │      Base de Datos Local      │
                  │     (SQLite / PostgreSQL)     │
                  └───────────────▲───────────────┘
                                  │
                   (Escribe datos cada N horas)
                                  │
                  ┌───────────────┴───────────────┐
                  │    Scraper Worker Service     │
                  │     (curl_cffi + selectolax)   │
                  └───────────────┬───────────────┘
                                  │ TLS Impersonate (Chrome 120)
                                  ▼
                  ┌───────────────────────────────┐
                  │     Páginas Públicas MELI     │
                  │ (/mas-vendidos y /ofertas)    │
                  └───────────────────────────────┘
```

---

## 3. Instalación de Dependencias

Se utilizan dos librerías especializadas de alto rendimiento:
* **`curl_cffi`**: Maneja peticiones HTTP asíncronas imitando el TLS Fingerprint (JA3/JA4) de navegadores reales para eludir firewalls y WAFs.
* **`selectolax`**: Parser de HTML en C (Modest engine), entre 5 y 20 veces más rápido que BeautifulSoup.

```bash
pip install curl_cffi selectolax pydantic fastapi uvicorn
```

---

## 4. Implementación del Extractor de Datos

Este módulo implementa la extracción tanto de la sección de **Más Vendidos** como de la sección de **Ofertas**.

```python
# app/scrapers/meli_scraper.py
import re
from typing import List, Optional
from pydantic import BaseModel
from curl_cffi.requests import AsyncSession
from selectolax.parser import HTMLParser, Node


class ProductItem(BaseModel):
    id: Optional[str]
    title: str
    permalink: str
    current_price: float
    original_price: Optional[float] = None
    discount_percentage: float = 0.0
    is_best_seller: bool = False
    best_seller_rank: Optional[int] = None


class MercadoLibreScraper:
    def __init__(self, site_domain: str = "www.mercadolibre.com.mx"):
        self.base_url = f"https://{site_domain}"
        self.headers = {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "es-419,es;q=0.9,en;q=0.8",
            "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1",
        }

    def _clean_price(self, text: Optional[str]) -> Optional[float]:
        if not text:
            return None
        cleaned = re.sub(r"[^\d.]", "", text.replace(",", ""))
        try:
            return float(cleaned)
        except ValueError:
            return None

    def _extract_item_id(self, url: str) -> Optional[str]:
        match = re.search(r"ML[A-Z]-?(\d+)", url)
        return match.group(0).replace("-", "") if match else None

    async def get_best_sellers(self, category_id: Optional[str] = None) -> List[ProductItem]:
        """Extrae el ranking de los productos más vendidos."""
        url = f"{self.base_url}/mas-vendidos"
        if category_id:
            url = f"{self.base_url}/mas-vendidos/{category_id}"

        async with AsyncSession(impersonate="chrome120") as session:
            response = await session.get(url, headers=self.headers, timeout=15)
            if response.status_code != 200:
                print(f"[Error] Falló status code: {response.status_code}")
                return []

        parser = HTMLParser(response.text)
        products: List[ProductItem] = []

        # Contenedores habituales de tarjetas de ranking
        cards = parser.css(".poly-card, .ui-recommendations-card, .dynamic-carousel__item")

        for index, card in enumerate(cards, start=1):
            title_node = card.css_first(".poly-component__title, a.ui-recommendations-card__link")
            link_node = card.css_first("a[href]")
            price_node = card.css_first(".andes-money-amount__fraction")
            discount_node = card.css_first(".andes-money-amount__discount")
            rank_node = card.css_first(".ui-recommendations-card__badge, .poly-badge")

            if not title_node or not link_node or not price_node:
                continue

            link = link_node.attributes.get("href", "")
            rank = index
            if rank_node and "MÁS VENDIDO" in rank_node.text():
                rank_match = re.search(r"(\d+)º", rank_node.text())
                if rank_match:
                    rank = int(rank_match.group(1))

            discount_pct = 0.0
            if discount_node:
                disc_match = re.search(r"(\d+)%", discount_node.text())
                if disc_match:
                    discount_pct = float(disc_match.group(1))

            products.append(
                ProductItem(
                    id=self._extract_item_id(link),
                    title=title_node.text().strip(),
                    permalink=link,
                    current_price=self._clean_price(price_node.text()) or 0.0,
                    discount_percentage=discount_pct,
                    is_best_seller=True,
                    best_seller_rank=rank,
                )
            )

        return products

    async def get_deals(self, min_discount: int = 15) -> List[ProductItem]:
        """Extrae productos con descuento activo de la sección de ofertas."""
        url = f"{self.base_url}/ofertas?discount={min_discount}-100"

        async with AsyncSession(impersonate="chrome120") as session:
            response = await session.get(url, headers=self.headers, timeout=15)
            if response.status_code != 200:
                return []

        parser = HTMLParser(response.text)
        deals: List[ProductItem] = []

        cards = parser.css(".poly-card, .promotion-item")

        for card in cards:
            title_node = card.css_first(".poly-component__title, .promotion-item__title")
            link_node = card.css_first("a[href]")
            current_price_node = card.css_first(".andes-money-amount--cents-superscript .andes-money-amount__fraction, .andes-money-amount__fraction")
            original_price_node = card.css_first(".andes-money-amount--previous .andes-money-amount__fraction")
            discount_node = card.css_first(".andes-money-amount__discount, .promotion-item__discount")

            if not title_node or not link_node or not current_price_node:
                continue

            link = link_node.attributes.get("href", "")
            disc_pct = 0.0
            if discount_node:
                disc_match = re.search(r"(\d+)%", discount_node.text())
                if disc_match:
                    disc_pct = float(disc_match.group(1))

            deals.append(
                ProductItem(
                    id=self._extract_item_id(link),
                    title=title_node.text().strip(),
                    permalink=link,
                    current_price=self._clean_price(current_price_node.text()) or 0.0,
                    original_price=self._clean_price(original_price_node.text()) if original_price_node else None,
                    discount_percentage=disc_pct,
                    is_best_seller=False,
                )
            )

        return deals
```

---

## 5. Algoritmo de Cruce y Comparación

El objetivo de la app es responder: **¿Cuáles de los productos más vendidos tienen una oferta significativa en este momento?**

```python
# app/services/comparator.py
from typing import List, Dict, Any
from app.scrapers.meli_scraper import ProductItem

def compare_best_sellers_and_deals(
    best_sellers: List[ProductItem],
    deals: List[ProductItem]
) -> Dict[str, Any]:
    """Cruza los listados para detectar Best Sellers en rebaja y oportunidades."""
    
    # Índice de ofertas mapeadas por ID o por título normalizado
    deals_by_id = {item.id: item for item in deals if item.id}
    
    matched_best_sellers = []
    
    for bs in best_sellers:
        # Caso A: El producto más vendido ya trae etiqueta de descuento en su propia ficha
        if bs.discount_percentage > 0:
            matched_best_sellers.append(bs)
            continue
            
        # Caso B: El producto aparece listado en el feed general de ofertas
        if bs.id and bs.id in deals_by_id:
            deal_match = deals_by_id[bs.id]
            bs.discount_percentage = deal_match.discount_percentage
            bs.original_price = deal_match.original_price
            matched_best_sellers.append(bs)

    # Ordenar los más vendidos con oferta por mayor porcentaje de descuento
    matched_best_sellers.sort(key=lambda x: x.discount_percentage, reverse=True)

    return {
        "total_best_sellers_monitored": len(best_sellers),
        "total_deals_monitored": len(deals),
        "best_sellers_with_deal_count": len(matched_best_sellers),
        "highlighted_deals": matched_best_sellers,
    }
```

---

## 6. Endpoints en FastAPI

```python
# app/main.py
from fastapi import FastAPI
from app.scrapers.meli_scraper import MercadoLibreScraper
from app.services.comparator import compare_best_sellers_and_deals

app = FastAPI(title="Deals & Best Sellers Scraper API")
scraper = MercadoLibreScraper(site_domain="www.mercadolibre.com.mx")

# Caché en memoria para evitar scrapear en cada llamada HTTP
cache_store = {
    "data": None
}

@app.get("/api/v1/sync")
async def trigger_sync():
    """Ruta para sincronizar datos manualmente o mediante cron."""
    best_sellers = await scraper.get_best_sellers()
    deals = await scraper.get_deals(min_discount=10)
    
    result = compare_best_sellers_and_deals(best_sellers, deals)
    cache_store["data"] = result
    
    return {"status": "success", "summary": {
        "best_sellers_found": result["total_best_sellers_monitored"],
        "deals_found": result["total_deals_monitored"],
        "matches": result["best_sellers_with_deal_count"]
    }}

@app.get("/api/v1/comparison")
async def get_comparison():
    """Devuelve los datos ya procesados al frontend."""
    if not cache_store["data"]:
        # Sincronización inicial bajo demanda si la caché está vacía
        await trigger_sync()
    return cache_store["data"]
```

---

## 7. Buenas Prácticas Anti-Bloqueo

1. **Uso estricto de `curl_cffi`:** Las peticiones estándar de `urllib` o `requests` envían huellas TLS que Cloudflare y Mercado Libre identifican de inmediato. Usar `impersonate="chrome120"` reduce falsos positivos drásticamente.
2. **Intervalos de extracción:** No ejecutes el scraping en cada visita de usuario. Programa una tarea en segundo plano cada **4 a 6 horas**; los catálogos y rankings de más vendidos no cambian en cuestión de segundos.
3. **Pausas entre páginas:** Si paginas categorías, agrega retardos aleatorios:
   ```python
   import asyncio, random
   await asyncio.sleep(random.uniform(2.0, 4.5))
   ```
4. **Selectores con fallback:** Mercado Libre alterna periódicamente clases BEM (`.poly-card`, `.ui-recommendations-card`, `.promotion-item`). El código usa selectores separados por comas para mantener compatibilidad si el diseño cambia levemente.