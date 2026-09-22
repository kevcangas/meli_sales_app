import time
import logging
import asyncio
from typing import Optional, List
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.config import settings
from app.database import init_db, get_db
from app.scrapers.meli_scraper import MercadoLibreScraper
from app.services.comparator import compare_best_sellers_and_deals
from app.services.storage import save_sync_result, get_latest_comparison, get_sync_status, get_product_price_history
from app.services.analytics import compute_category_analytics
from app.models import ProductRecord
from app.schemas import ComparisonResponse, SyncTriggerResponse, CategoryInfo, AnalyticsResponse, ProductPriceHistoryResponse

# Configuración de logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

# Lock global para evitar ejecuciones concurrentes de scraping
sync_lock = asyncio.Lock()
scraper = MercadoLibreScraper(site_domain=settings.SITE_DOMAIN)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Iniciando aplicación y verificando tablas de base de datos...")
    init_db()
    yield
    logger.info("Deteniendo aplicación.")


app = FastAPI(
    title="Mercado Libre Deals & Best Sellers Scraper",
    description="API de extracción y cruce de datos para detectar Más Vendidos con descuento en Mercado Libre.",
    version="1.0.0",
    lifespan=lifespan,
)

# Configuración de CORS para permitir peticiones desde el frontend SPA
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CATEGORIES: List[CategoryInfo] = [
    CategoryInfo(id="all", name="Todas las Categorías (General)", url_suffix=""),
    CategoryInfo(id="MLM187772", name="Salud y Equipamiento Médico", url_suffix="MLM187772"),
    CategoryInfo(id="MLM1144", name="Consolas y Videojuegos", url_suffix="MLM1144"),
    CategoryInfo(id="MLM1648", name="Computación", url_suffix="MLM1648"),
    CategoryInfo(id="MLM1747", name="Accesorios para Vehículos", url_suffix="MLM1747"),
    CategoryInfo(id="MLM1051", name="Celulares y Telefonía", url_suffix="MLM1051"),
    CategoryInfo(id="MLM1430", name="Ropa, Bolsas y Calzado", url_suffix="MLM1430"),
    CategoryInfo(id="MLM1000", name="Electrónica, Audio y Video", url_suffix="MLM1000"),
    CategoryInfo(id="MLM1574", name="Hogar, Muebles y Jardín", url_suffix="MLM1574"),
    CategoryInfo(id="MLM1743", name="Herramientas", url_suffix="MLM1743"),
]


@app.get("/api/v1/health")
async def health_check():
    return {
        "status": "healthy",
        "site_domain": settings.SITE_DOMAIN,
        "scrape_interval_hours": settings.SCRAPE_INTERVAL_HOURS,
    }


@app.get("/api/v1/categories", response_model=List[CategoryInfo])
async def list_categories(db: Session = Depends(get_db)):
    """Retorna las categorías disponibles, enriquecidas con las descubiertas en scraping."""
    known = {c.id: c for c in CATEGORIES}

    # Enriquecer dinámicamente con categorías reales existentes en la base de datos
    db_cats = (
        db.query(ProductRecord.category_id, ProductRecord.category_name)
        .filter(ProductRecord.category_id.isnot(None))
        .distinct()
        .all()
    )
    for cat_id, cat_name in db_cats:
        if cat_id and cat_id not in known:
            known[cat_id] = CategoryInfo(
                id=cat_id,
                name=cat_name or cat_id,
                url_suffix=cat_id
            )
        elif cat_id in known and cat_name:
            known[cat_id].name = cat_name

    # Mantener 'all' como primera opción
    res = [known["all"]]
    others = [c for k, c in known.items() if k != "all"]
    others.sort(key=lambda x: x.name)
    res.extend(others)
    return res


@app.post("/api/v1/sync", response_model=SyncTriggerResponse)
async def trigger_sync(
    category_id: Optional[str] = Query(None, description="ID de categoría específica o None para general"),
    min_discount: int = Query(10, ge=1, le=90, description="Porcentaje mínimo de descuento a buscar"),
    db: Session = Depends(get_db)
):
    """Ejecuta el proceso de scraping y guarda los datos analizados."""
    if sync_lock.locked():
        raise HTTPException(
            status_code=429,
            detail="Ya hay una sincronización en progreso. Por favor espera a que termine."
        )

    async with sync_lock:
        start_time = time.time()
        logger.info("Iniciando sincronización manual (categoría=%s, min_discount=%s)", category_id, min_discount)

        cat_param = category_id if category_id and category_id != "all" else None

        try:
            # 1. Extraer más vendidos y ofertas en paralelo
            best_sellers_task = asyncio.create_task(scraper.get_best_sellers(category_id=cat_param))
            deals_task = asyncio.create_task(scraper.get_deals(min_discount=min_discount, max_pages=1))

            best_sellers, deals = await asyncio.gather(best_sellers_task, deals_task)

            # 2. Ejecutar algoritmo de cruce
            comparison = compare_best_sellers_and_deals(best_sellers, deals)
            elapsed = time.time() - start_time

            # 3. Guardar en SQLite
            sync_log = save_sync_result(db, comparison, elapsed, status="success")

            return SyncTriggerResponse(
                status="success",
                message=f"Sincronización completada con éxito en {elapsed:.2f}s.",
                sync_id=sync_log.id,
                summary={
                    "total_best_sellers_monitored": comparison["total_best_sellers_monitored"],
                    "total_deals_monitored": comparison["total_deals_monitored"],
                    "best_sellers_with_deal_count": comparison["best_sellers_with_deal_count"],
                    "last_sync_at": sync_log.created_at,
                    "last_sync_status": sync_log.status,
                    "execution_time_seconds": sync_log.execution_time_seconds,
                }
            )
        except Exception as exc:
            elapsed = time.time() - start_time
            logger.error("Error durante sincronización: %s", exc, exc_info=True)
            save_sync_result(db, {}, elapsed, status="error", error_message=str(exc))
            raise HTTPException(status_code=500, detail=f"Error en sincronización: {str(exc)}")


@app.get("/api/v1/comparison", response_model=ComparisonResponse)
async def get_comparison(
    category_id: Optional[str] = Query(None),
    min_discount: Optional[float] = Query(None),
    only_deals: bool = Query(False),
    auto_sync: bool = Query(True, description="Si no hay datos, sincronizar automáticamente"),
    db: Session = Depends(get_db)
):
    """Devuelve los datos consolidados y procesados."""
    cat_param = category_id if category_id and category_id != "all" else None
    data = get_latest_comparison(db, category_id=cat_param, min_discount=min_discount, only_deals=only_deals)

    if not data and auto_sync:
        logger.info("No hay datos en base de datos. Ejecutando sincronización inicial automática...")
        try:
            await trigger_sync(category_id=cat_param, min_discount=10, db=db)
            data = get_latest_comparison(db, category_id=cat_param, min_discount=min_discount, only_deals=only_deals)
        except Exception as e:
            logger.warning("Fallo en sincronización automática inicial: %s", e)

    if not data:
        return ComparisonResponse(
            summary={
                "total_best_sellers_monitored": 0,
                "total_deals_monitored": 0,
                "best_sellers_with_deal_count": 0,
                "last_sync_at": None,
                "last_sync_status": "empty",
                "execution_time_seconds": 0.0,
            },
            highlighted_deals=[],
            best_sellers=[],
        )

    return data


@app.get("/api/v1/sync/status")
async def check_sync_status(db: Session = Depends(get_db)):
    """Informa el estado de la última sincronización y si hay una en ejecución."""
    status_info = get_sync_status(db)
    status_info["is_syncing_now"] = sync_lock.locked()
    return status_info


@app.get("/api/v1/analytics", response_model=AnalyticsResponse)
async def get_market_analytics(
    category_id: Optional[str] = Query(None, description="Categoría para filtrar estadísticas"),
    db: Session = Depends(get_db)
):
    """Calcula y devuelve métricas econométricas, de dispersión y distribución de costos."""
    cat_param = category_id if category_id and category_id != "all" else None
    result = compute_category_analytics(db, category_id=cat_param)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@app.get("/api/v1/products/{item_id}/history", response_model=ProductPriceHistoryResponse)
async def get_price_history(item_id: str, db: Session = Depends(get_db)):
    """Retorna la serie temporal de precios observados para un producto a lo largo de las sincronizaciones."""
    history_data = get_product_price_history(db, item_id)
    if not history_data:
        raise HTTPException(
            status_code=404,
            detail=f"No se encontró historial para el producto '{item_id}'"
        )
    return history_data


