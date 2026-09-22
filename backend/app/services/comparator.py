import re
from typing import List, Dict, Any
from app.schemas import ProductItem


def normalize_title(title: str) -> str:
    """Normaliza texto para permitir comparación difusa básica."""
    cleaned = re.sub(r"[^\w\s]", "", title.lower())
    return " ".join(cleaned.split()[:6])  # Primeras 6 palabras clave


def compare_best_sellers_and_deals(
    best_sellers: List[ProductItem],
    deals: List[ProductItem]
) -> Dict[str, Any]:
    """Cruza los listados para detectar Best Sellers en rebaja y oportunidades."""

    # Índice de ofertas por ID exacto
    deals_by_id = {item.id: item for item in deals if item.id}
    # Índice secundario por título normalizado
    deals_by_title = {normalize_title(item.title): item for item in deals if item.title}

    highlighted_deals: List[ProductItem] = []
    processed_best_sellers: List[ProductItem] = []

    for bs in best_sellers:
        matched = False

        # Caso A: El producto más vendido ya trae etiqueta de descuento en su propia tarjeta
        if bs.discount_percentage > 0:
            bs.is_match = True
            matched = True

        # Caso B: El producto aparece listado en el feed general de ofertas por ID
        elif bs.id and bs.id in deals_by_id:
            deal_match = deals_by_id[bs.id]
            bs.discount_percentage = deal_match.discount_percentage
            if not bs.original_price and deal_match.original_price:
                bs.original_price = deal_match.original_price
            bs.is_match = True
            matched = True

        # Caso C: Coincidencia por título normalizado
        elif normalize_title(bs.title) in deals_by_title:
            deal_match = deals_by_title[normalize_title(bs.title)]
            if deal_match.discount_percentage > 0:
                bs.discount_percentage = deal_match.discount_percentage
                if not bs.original_price and deal_match.original_price:
                    bs.original_price = deal_match.original_price
                bs.is_match = True
                matched = True

        # Si hay precio original pero no porcentaje calculado
        if bs.original_price and bs.original_price > bs.current_price and bs.discount_percentage == 0:
            calc_disc = round(((bs.original_price - bs.current_price) / bs.original_price) * 100)
            if calc_disc > 0:
                bs.discount_percentage = float(calc_disc)
                bs.is_match = True
                matched = True

        if matched:
            highlighted_deals.append(bs)

        processed_best_sellers.append(bs)

    # Ordenar las ofertas destacadas por mayor porcentaje de rebaja
    highlighted_deals.sort(key=lambda x: (x.discount_percentage, x.best_seller_rank or 999), reverse=True)

    return {
        "total_best_sellers_monitored": len(processed_best_sellers),
        "total_deals_monitored": len(deals),
        "best_sellers_with_deal_count": len(highlighted_deals),
        "highlighted_deals": highlighted_deals,
        "best_sellers": processed_best_sellers,
    }
