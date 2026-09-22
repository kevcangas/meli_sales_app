import logging
from typing import List, Dict, Any, Optional
from collections import defaultdict
from sqlalchemy.orm import Session
from app.models import ProductRecord
from app.schemas import ProductItem

logger = logging.getLogger(__name__)


def audit_products_authenticity(
    db: Session,
    products: List[ProductItem],
    latest_sync_id: Optional[int] = None
) -> List[ProductItem]:
    """Audita si los descuentos son genuinos, promociones verosímiles o descuentos ilusorios por precio ancla."""
    if not products:
        return []

    item_ids = [p.id for p in products if p.id]
    permalinks = [p.permalink for p in products if p.permalink]

    # Consultar historial en la base de datos
    query = db.query(
        ProductRecord.item_id,
        ProductRecord.permalink,
        ProductRecord.current_price,
        ProductRecord.original_price,
        ProductRecord.discount_percentage,
        ProductRecord.sync_id
    )

    if item_ids:
        records = query.filter(
            (ProductRecord.item_id.in_(item_ids)) | (ProductRecord.permalink.in_(permalinks))
        ).all()
    else:
        records = query.filter(ProductRecord.permalink.in_(permalinks)).all()

    # Agrupar historial por item
    history_by_key = defaultdict(list)
    for r in records:
        key = r.item_id or r.permalink
        history_by_key[key].append({
            "current_price": r.current_price,
            "original_price": r.original_price,
            "discount_percentage": r.discount_percentage,
            "sync_id": r.sync_id
        })

    audited_products: List[ProductItem] = []

    for item in products:
        key = item.id or item.permalink
        hist = history_by_key.get(key, [])
        historical_prices = [h["current_price"] for h in hist if h["current_price"] > 0]
        n_syncs = len(historical_prices)

        announced_disc = item.discount_percentage or 0.0
        p_curr = item.current_price
        p_orig = item.original_price

        # Caso 1: Sin descuento
        if announced_disc <= 0 or not p_orig or p_orig <= p_curr:
            item.deal_authenticity = "NO_DEAL"
            item.authenticity_score = 100
            item.real_discount_percentage = 0.0
            item.historical_median_price = p_curr
            item.authenticity_reason = "Precio regular de lista sin promoción activa."
            audited_products.append(item)
            continue

        ratio = (p_orig / p_curr) if p_curr > 0 else 1.0

        # Caso 2: Contamos con historial de múltiples capturas
        if n_syncs >= 2:
            sorted_hist = sorted(historical_prices)
            hist_min = sorted_hist[0]
            hist_median = sorted_hist[len(sorted_hist) // 2]
            hist_max = sorted_hist[-1]
            item.historical_median_price = round(hist_median, 2)

            # A: Comprobación de bajada real observada
            if p_curr < hist_min * 0.96:
                real_disc = round(((hist_median - p_curr) / hist_median) * 100, 1)
                item.deal_authenticity = "REAL"
                item.authenticity_score = 95
                item.real_discount_percentage = real_disc
                item.authenticity_reason = (
                    f"¡Mínimo histórico detectado! El precio cayó un {real_disc:.1f}% "
                    f"por debajo de su valor habitual ({hist_median:,.0f} → {p_curr:,.0f})."
                )

            # B: Descuento ilusorio evidente por inflación de precio tachado
            # (Ej. Anuncian más de 55% OFF o precio original es >2.3 veces el precio actual)
            elif announced_disc >= 55.0 or ratio >= 2.2:
                item.deal_authenticity = "ILLUSORY"
                item.authenticity_score = 20
                item.real_discount_percentage = 0.0
                item.authenticity_reason = (
                    f"Descuento ilusorio (Precio Ancla Inflado): Se publicita un {announced_disc:.0f}% OFF "
                    f"con precio tachado inflado ({p_orig:,.0f}). El producto se comercializa normalmente a {p_curr:,.0f}."
                )

            # C: Oferta verosímil y activa en la plataforma
            elif announced_disc >= 10.0 and announced_disc < 55.0:
                item.deal_authenticity = "REAL"
                item.authenticity_score = 80
                item.real_discount_percentage = announced_disc
                item.authenticity_reason = (
                    f"Descuento activo verosímil: {announced_disc:.0f}% OFF. El precio de lista ({p_orig:,.0f}) "
                    f"se mantiene dentro de márgenes comerciales razonables respecto al mercado."
                )

            else:
                item.deal_authenticity = "MILD"
                item.authenticity_score = 65
                item.real_discount_percentage = announced_disc
                item.authenticity_reason = f"Descuento leve ({announced_disc:.0f}% OFF) dentro del rango ordinario de variación."

        # Caso 3: Primer registro o única captura
        else:
            item.historical_median_price = p_curr
            # Heurística de precio ancla
            if announced_disc >= 55.0 or ratio >= 2.2:
                item.deal_authenticity = "ILLUSORY"
                item.authenticity_score = 25
                item.real_discount_percentage = 0.0
                item.authenticity_reason = (
                    f"Alta probabilidad de descuento ilusorio: Anuncia {announced_disc:.0f}% OFF inflando "
                    f"el precio original ({p_orig:,.0f} vs {p_curr:,.0f}). Práctica común para inducir falsa urgencia."
                )
            elif announced_disc >= 10.0:
                item.deal_authenticity = "REAL"
                item.authenticity_score = 80
                item.real_discount_percentage = announced_disc
                item.authenticity_reason = (
                    f"Descuento activo consistente ({announced_disc:.0f}% OFF). Margen verosímil de promoción."
                )
            else:
                item.deal_authenticity = "NEW_LISTING"
                item.authenticity_score = 70
                item.real_discount_percentage = announced_disc
                item.authenticity_reason = "Oferta menor en monitoreo inicial."

        audited_products.append(item)

    return audited_products
