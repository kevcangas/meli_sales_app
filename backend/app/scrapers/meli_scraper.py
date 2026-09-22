import re
import logging
import asyncio
import random
from typing import List, Optional
from curl_cffi.requests import AsyncSession
from selectolax.parser import HTMLParser, Node
from app.schemas import ProductItem

logger = logging.getLogger(__name__)


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

    def _extract_item_id(self, url: str) -> Optional[str]:
        if not url:
            return None
        match = re.search(r"ML[A-Z]-?(\d+)", url)
        return match.group(0).replace("-", "") if match else None

    def _extract_price_and_cents(self, card: Node, is_previous: bool = False) -> Optional[float]:
        """Extrae precio con manejo de decimales/centavos en formatos estándar y carousel."""
        if is_previous:
            node = card.css_first(".dynamic-carousel__oldprice, .andes-money-amount--previous .andes-money-amount__fraction, s")
            if not node:
                return None
            cleaned = re.sub(r"[^\d.]", "", node.text().replace(",", ""))
            try:
                return float(cleaned) if cleaned else None
            except ValueError:
                return None

        # Precio actual
        price_node = card.css_first(".dynamic-carousel__price, .andes-money-amount--cents-superscript .andes-money-amount__fraction, .andes-money-amount__fraction, span[class*='fraction']")
        if not price_node:
            return None

        cents_node = card.css_first(".dynamic-carousel__price-decimals, .andes-money-amount__cents")
        cents_str = cents_node.text().strip() if cents_node else ""

        full_text = price_node.text().strip()
        if cents_str and full_text.endswith(cents_str):
            full_text = full_text[:-len(cents_str)]

        clean_int = re.sub(r"[^\d]", "", full_text.replace(",", ""))
        if clean_int:
            try:
                if cents_str and cents_str.isdigit():
                    return float(f"{clean_int}.{cents_str}")
                return float(clean_int)
            except ValueError:
                return None
        return None

    async def get_best_sellers(self, category_id: Optional[str] = None) -> List[ProductItem]:
        """Extrae el ranking de los productos más vendidos."""
        url = f"{self.base_url}/mas-vendidos"
        if category_id:
            url = f"{self.base_url}/mas-vendidos/{category_id}"

        logger.info("Extrayendo Más Vendidos desde: %s", url)

        try:
            async with AsyncSession(impersonate="chrome120") as session:
                response = await session.get(url, headers=self.headers, timeout=20)
                if response.status_code != 200:
                    logger.error("Error status code %s al consultar %s", response.status_code, url)
                    return []
                html_content = response.text
        except Exception as exc:
            logger.error("Excepción en request get_best_sellers: %s", exc)
            return []

        parser = HTMLParser(html_content)
        products: List[ProductItem] = []
        seen_links = set()

        def parse_single_card(card, index, c_id=None, c_name=None):
            title_node = card.css_first(".dynamic-carousel__title, .poly-component__title, a.ui-recommendations-card__link, h2[class*='title'], h3[class*='title'], a[class*='title']")
            link_node = card.css_first("a.splinter-link, a[href]")

            if not link_node:
                return None

            link = link_node.attributes.get("href", "")
            if not link.startswith("http"):
                link = f"{self.base_url}{link}"

            if link in seen_links:
                return None
            seen_links.add(link)

            title = title_node.text().strip() if title_node else ""
            if not title:
                img_node = card.css_first("img[alt]")
                if img_node:
                    title = img_node.attributes.get("alt", "").strip()

            if not title:
                return None

            current_price = self._extract_price_and_cents(card, is_previous=False) or 0.0
            original_price = self._extract_price_and_cents(card, is_previous=True)

            rank_node = card.css_first(".dynamic-carousel__pill-container--text, .ui-recommendations-card__badge, .poly-badge, span[class*='badge']")
            rank = index
            if rank_node and "MÁS VENDIDO" in rank_node.text().upper():
                rank_match = re.search(r"(\d+)[º°]?", rank_node.text())
                if rank_match:
                    rank = int(rank_match.group(1))

            discount_node = card.css_first(".dynamic-carousel__discount, .andes-money-amount__discount, span[class*='discount']")
            discount_pct = 0.0
            if discount_node:
                disc_match = re.search(r"(\d+)%", discount_node.text())
                if disc_match:
                    discount_pct = float(disc_match.group(1))
            elif original_price and original_price > current_price and current_price > 0:
                discount_pct = round(((original_price - current_price) / original_price) * 100, 1)

            return ProductItem(
                id=self._extract_item_id(link),
                title=title,
                permalink=link,
                current_price=current_price,
                original_price=original_price,
                discount_percentage=discount_pct,
                is_best_seller=True,
                best_seller_rank=rank,
                category_id=c_id or category_id,
                category_name=c_name,
            )

        # 1. Intentar extracción estructurada por carruseles de categoría
        cat_links = parser.css('a[href*="/mas-vendidos/"]')
        if cat_links and not category_id:
            for cl in cat_links:
                href = cl.attributes.get("href", "")
                match = re.search(r"MLM\d+", href)
                c_id = match.group(0) if match else "general"

                sec = cl.parent
                for _ in range(6):
                    if sec and sec.css(".dynamic-carousel__item-container, .poly-card"):
                        break
                    if sec:
                        sec = sec.parent

                h2 = sec.css_first("h2") if sec else None
                c_name = h2.text().strip() if h2 else cl.text().replace("Ver más", "").strip()

                cards = sec.css(".dynamic-carousel__item-container, .poly-card") if sec else []
                for idx, c in enumerate(cards, start=1):
                    item = parse_single_card(c, idx, c_id=c_id, c_name=c_name)
                    if item:
                        products.append(item)

        # 2. Si quedan tarjetas sueltas o no hubo carruseles, procesar de forma general
        if not products:
            cards = parser.css(".dynamic-carousel__item-container, .poly-card, .ui-recommendations-card, .dynamic-carousel__item, div[class*='poly-card']")
            for idx, c in enumerate(cards, start=1):
                item = parse_single_card(c, idx, c_id=category_id, c_name=None)
                if item:
                    products.append(item)

        logger.info("Total más vendidos extraídos: %d", len(products))
        return products

    async def get_deals(self, min_discount: int = 15, max_pages: int = 1) -> List[ProductItem]:
        """Extrae productos con descuento activo de la sección de ofertas."""
        deals: List[ProductItem] = []

        for page in range(1, max_pages + 1):
            url = f"{self.base_url}/ofertas?discount={min_discount}-100"
            if page > 1:
                url += f"&page={page}"

            logger.info("Extrayendo Ofertas página %d desde: %s", page, url)

            try:
                async with AsyncSession(impersonate="chrome120") as session:
                    response = await session.get(url, headers=self.headers, timeout=20)
                    if response.status_code != 200:
                        logger.error("Error status code %s en página %d de ofertas", response.status_code, page)
                        break
                    html_content = response.text
            except Exception as exc:
                logger.error("Excepción al consultar ofertas en página %d: %s", page, exc)
                break

            parser = HTMLParser(html_content)
            cards = parser.css(".poly-card, .promotion-item, div[class*='poly-card']")

            for card in cards:
                title_node = card.css_first(".poly-component__title, .promotion-item__title, h2[class*='title'], a[class*='title']")
                link_node = card.css_first("a[href]")

                if not title_node or not link_node:
                    continue

                link = link_node.attributes.get("href", "")
                if not link.startswith("http"):
                    link = f"{self.base_url}{link}"

                current_price = self._extract_price_and_cents(card, is_previous=False) or 0.0
                original_price = self._extract_price_and_cents(card, is_previous=True)

                discount_node = card.css_first(".andes-money-amount__discount, .promotion-item__discount, span[class*='discount']")
                disc_pct = 0.0
                if discount_node:
                    disc_match = re.search(r"(\d+)%", discount_node.text())
                    if disc_match:
                        disc_pct = float(disc_match.group(1))
                elif original_price and original_price > current_price and current_price > 0:
                    disc_pct = round(((original_price - current_price) / original_price) * 100, 1)

                deals.append(
                    ProductItem(
                        id=self._extract_item_id(link),
                        title=title_node.text().strip(),
                        permalink=link,
                        current_price=current_price,
                        original_price=original_price,
                        discount_percentage=disc_pct,
                        is_best_seller=False,
                    )
                )

            if page < max_pages:
                await asyncio.sleep(random.uniform(1.5, 3.0))

        logger.info("Total ofertas extraídas: %d", len(deals))
        return deals
