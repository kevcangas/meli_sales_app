import time
import logging
import asyncio
import signal
from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import settings
from app.database import init_db, SessionLocal
from app.scrapers.meli_scraper import MercadoLibreScraper
from app.services.comparator import compare_best_sellers_and_deals
from app.services.storage import save_sync_result

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [WORKER-%(levelname)s]: %(message)s"
)
logger = logging.getLogger("worker")

scraper = MercadoLibreScraper(site_domain=settings.SITE_DOMAIN)


async def execute_scheduled_scrape():
    """Tarea periódica de scraping ejecutada por el scheduler."""
    logger.info("--- Iniciando ciclo programado de scraping ---")
    start_time = time.time()
    db = SessionLocal()

    try:
        # Extraer más vendidos y ofertas
        best_sellers_task = asyncio.create_task(scraper.get_best_sellers())
        deals_task = asyncio.create_task(scraper.get_deals(min_discount=settings.MIN_DISCOUNT_PERCENT, max_pages=1))

        best_sellers, deals = await asyncio.gather(best_sellers_task, deals_task)

        comparison = compare_best_sellers_and_deals(best_sellers, deals)
        elapsed = time.time() - start_time

        sync_log = save_sync_result(db, comparison, elapsed, status="success")
        logger.info(
            "Ciclo completado con éxito (SyncLog #%d) en %.2fs. Monitoreados: %d | Ofertas: %d | Cruces: %d",
            sync_log.id,
            elapsed,
            comparison["total_best_sellers_monitored"],
            comparison["total_deals_monitored"],
            comparison["best_sellers_with_deal_count"],
        )
    except Exception as exc:
        elapsed = time.time() - start_time
        logger.error("Error crítico en ciclo programado de scraping: %s", exc, exc_info=True)
        save_sync_result(db, {}, elapsed, status="error", error_message=str(exc))
    finally:
        db.close()


async def main():
    logger.info("Iniciando servicio Scraper Worker (Intervalo: cada %d horas)", settings.SCRAPE_INTERVAL_HOURS)
    init_db()

    # Breve espera inicial para asegurar que el backend y la BD estén listos
    await asyncio.sleep(5)

    # Ejecutar primera extracción inmediatamente si se desea
    logger.info("Ejecutando primera extracción inicial al arranque...")
    await execute_scheduled_scrape()

    scheduler = AsyncIOScheduler(timezone=timezone.utc)
    scheduler.add_job(
        execute_scheduled_scrape,
        "interval",
        hours=settings.SCRAPE_INTERVAL_HOURS,
        next_run_time=None,  # El siguiente se programa para dentro de N horas
        id="meli_periodic_scrape"
    )
    scheduler.start()
    logger.info("Scheduler de fondo activo y programado.")

    stop_event = asyncio.Event()

    def signal_handler():
        logger.info("Señal de detención recibida. Finalizando worker...")
        stop_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        try:
            loop.add_signal_handler(sig, signal_handler)
        except NotImplementedError:
            # En Windows add_signal_handler puede no estar soportado para todos los loops
            pass

    try:
        while not stop_event.is_set():
            await asyncio.sleep(1)
    finally:
        scheduler.shutdown(wait=False)
        logger.info("Worker detenido correctamente.")


if __name__ == "__main__":
    asyncio.run(main())
