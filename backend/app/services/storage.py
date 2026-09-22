import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models import SyncLog, ProductRecord
from app.schemas import ProductItem, ComparisonResponse, ComparisonSummary, ProductPriceHistoryResponse, PriceHistoryPoint
from app.services.deal_auditor import audit_products_authenticity

logger = logging.getLogger(__name__)


def save_sync_result(
    db: Session,
    comparison_data: Dict[str, Any],
    execution_time: float,
    status: str = "success",
    error_message: Optional[str] = None
) -> SyncLog:
    """Guarda en la base de datos el resultado del cruce de scraping."""
    sync_log = SyncLog(
        status=status,
        total_best_sellers=comparison_data.get("total_best_sellers_monitored", 0),
        total_deals=comparison_data.get("total_deals_monitored", 0),
        matches_count=comparison_data.get("best_sellers_with_deal_count", 0),
        execution_time_seconds=round(execution_time, 2),
        error_message=error_message,
        created_at=datetime.now(timezone.utc),
    )
    db.add(sync_log)
    db.flush()

    # Guardar productos procesados evitando duplicados en la misma sincronización
    all_products = comparison_data.get("best_sellers", [])
    records = []
    seen_keys = set()

    for item in all_products:
        item_key = item.id or item.permalink
        if item_key in seen_keys:
            continue
        seen_keys.add(item_key)

        records.append(
            ProductRecord(
                sync_id=sync_log.id,
                item_id=item.id,
                title=item.title,
                permalink=item.permalink,
                current_price=item.current_price,
                original_price=item.original_price,
                discount_percentage=item.discount_percentage,
                is_best_seller=item.is_best_seller,
                best_seller_rank=item.best_seller_rank,
                is_match=item.is_match,
                category_id=item.category_id,
                category_name=item.category_name,
                recorded_at=sync_log.created_at,
            )
        )

    if records:
        db.bulk_save_objects(records)

    db.commit()
    db.refresh(sync_log)
    logger.info("SyncLog #%d guardado con %d registros únicos.", sync_log.id, len(records))
    return sync_log


def get_latest_comparison(
    db: Session,
    category_id: Optional[str] = None,
    min_discount: Optional[float] = None,
    only_deals: bool = False
) -> Optional[ComparisonResponse]:
    """Recupera la última sincronización exitosa y sus productos."""
    latest_sync = (
        db.query(SyncLog)
        .filter(SyncLog.status == "success")
        .order_by(desc(SyncLog.created_at))
        .first()
    )

    if not latest_sync:
        return None

    query = db.query(ProductRecord).filter(ProductRecord.sync_id == latest_sync.id)

    if category_id:
        query = query.filter(ProductRecord.category_id == category_id)

    if min_discount is not None and min_discount > 0:
        query = query.filter(ProductRecord.discount_percentage >= min_discount)

    if only_deals:
        query = query.filter(ProductRecord.is_match == True)  # noqa: E712

    db_products = query.order_by(
        desc(ProductRecord.discount_percentage),
        ProductRecord.best_seller_rank.asc()
    ).all()

    items = [
        ProductItem(
            id=p.item_id or str(p.id),
            title=p.title,
            permalink=p.permalink,
            current_price=p.current_price,
            original_price=p.original_price,
            discount_percentage=p.discount_percentage,
            is_best_seller=p.is_best_seller,
            best_seller_rank=p.best_seller_rank,
            is_match=p.is_match,
            category_id=p.category_id,
            category_name=p.category_name,
        )
        for p in db_products
    ]
    # Ejecutar auditoría de autenticidad de precios
    audited_items = audit_products_authenticity(db, items, latest_sync_id=latest_sync.id)
    highlighted = [p for p in audited_items if p.is_match or p.discount_percentage > 0]
    real_deals_count = sum(1 for p in audited_items if p.deal_authenticity == "REAL")
    illusory_deals_count = sum(1 for p in audited_items if p.deal_authenticity == "ILLUSORY")

    return ComparisonResponse(
        summary=ComparisonSummary(
            total_best_sellers_monitored=latest_sync.total_best_sellers,
            total_deals_monitored=latest_sync.total_deals,
            best_sellers_with_deal_count=latest_sync.matches_count,
            real_deals_count=real_deals_count,
            illusory_deals_count=illusory_deals_count,
            last_sync_at=latest_sync.created_at,
            last_sync_status=latest_sync.status,
            execution_time_seconds=latest_sync.execution_time_seconds,
        ),
        highlighted_deals=highlighted,
        best_sellers=audited_items,
    )


def get_sync_status(db: Session) -> Dict[str, Any]:
    """Obtiene el estado de la última sincronización registrada."""
    latest = db.query(SyncLog).order_by(desc(SyncLog.created_at)).first()
    if not latest:
        return {"has_synced": False, "status": "never_run", "message": "Aún no se ha realizado ninguna sincronización."}

    return {
        "has_synced": True,
        "sync_id": latest.id,
        "status": latest.status,
        "created_at": latest.created_at.isoformat() if latest.created_at else None,
        "total_best_sellers": latest.total_best_sellers,
        "total_deals": latest.total_deals,
        "matches_count": latest.matches_count,
        "execution_time_seconds": latest.execution_time_seconds,
        "error_message": latest.error_message,
    }


def get_product_price_history(db: Session, item_id: str) -> Optional[ProductPriceHistoryResponse]:
    """Obtiene la serie temporal de precios observados para un producto específico."""
    clean_id = item_id.strip()
    records = (
        db.query(ProductRecord, SyncLog)
        .join(SyncLog, ProductRecord.sync_id == SyncLog.id)
        .filter((ProductRecord.item_id == clean_id) | (ProductRecord.permalink.like(f"%{clean_id}%")))
        .order_by(SyncLog.created_at.asc(), ProductRecord.id.asc())
        .all()
    )

    if not records:
        return None

    # Deduplicar por sync_id quedándonos con el registro más representativo
    seen_syncs = {}
    for p, s in records:
        if s.id not in seen_syncs:
            rec_date = p.recorded_at or s.created_at or datetime.now(timezone.utc)
            seen_syncs[s.id] = (p, rec_date)

    ordered_points = sorted(seen_syncs.values(), key=lambda x: x[1])

    history_points: List[PriceHistoryPoint] = []
    prices: List[float] = []

    for p, rec_date in ordered_points:
        prices.append(p.current_price)
        history_points.append(
            PriceHistoryPoint(
                sync_id=p.sync_id,
                recorded_at=rec_date,
                current_price=p.current_price,
                original_price=p.original_price,
                discount_percentage=p.discount_percentage or 0.0,
                best_seller_rank=p.best_seller_rank,
                deal_authenticity="REAL" if (p.is_match or (p.discount_percentage or 0) > 0) else "NORMAL",
                is_match=p.is_match or False,
            )
        )

    latest_record = ordered_points[-1][0]
    min_p = min(prices) if prices else 0.0
    max_p = max(prices) if prices else 0.0
    sorted_p = sorted(prices)
    med_p = sorted_p[len(sorted_p) // 2] if sorted_p else 0.0
    first_p = prices[0] if prices else 0.0
    last_p = prices[-1] if prices else 0.0
    change_amt = round(last_p - first_p, 2)
    change_pct = round(((last_p - first_p) / first_p) * 100, 1) if first_p > 0 else 0.0

    if change_pct <= -2.0:
        trend = "downward"
    elif change_pct >= 2.0:
        trend = "upward"
    else:
        trend = "stable"

    return ProductPriceHistoryResponse(
        item_id=latest_record.item_id or clean_id,
        title=latest_record.title,
        category_id=latest_record.category_id,
        category_name=latest_record.category_name,
        permalink=latest_record.permalink,
        current_price=last_p,
        original_price=latest_record.original_price,
        min_recorded_price=round(min_p, 2),
        max_recorded_price=round(max_p, 2),
        median_recorded_price=round(med_p, 2),
        price_change_amount=change_amt,
        price_change_percentage=change_pct,
        trend=trend,
        total_observations=len(history_points),
        history=history_points,
    )
