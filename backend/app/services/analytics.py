import math
from typing import List, Dict, Any, Optional
from collections import defaultdict
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models import SyncLog, ProductRecord


def calculate_quantiles(sorted_values: List[float]) -> Dict[str, float]:
    """Calcula Min, P25 (Q1), P50 (Mediana), P75 (Q3) y Max."""
    n = len(sorted_values)
    if n == 0:
        return {"min": 0.0, "q1": 0.0, "median": 0.0, "q3": 0.0, "max": 0.0, "iqr": 0.0}

    min_val = sorted_values[0]
    max_val = sorted_values[-1]

    def get_percentile(p: float) -> float:
        k = (n - 1) * p
        f = math.floor(k)
        c = math.ceil(k)
        if f == c:
            return sorted_values[int(k)]
        d0 = sorted_values[int(f)] * (c - k)
        d1 = sorted_values[int(c)] * (k - f)
        return d0 + d1

    q1 = get_percentile(0.25)
    median = get_percentile(0.50)
    q3 = get_percentile(0.75)
    iqr = max(0.0, q3 - q1)

    return {
        "min": round(min_val, 2),
        "q1": round(q1, 2),
        "median": round(median, 2),
        "q3": round(q3, 2),
        "max": round(max_val, 2),
        "iqr": round(iqr, 2),
    }


def calculate_gini(values: List[float]) -> float:
    """Calcula el coeficiente de Gini para medir la desigualdad o concentración de precios (0 a 1)."""
    n = len(values)
    if n < 2:
        return 0.0
    sorted_vals = sorted([v for v in values if v > 0])
    n_pos = len(sorted_vals)
    if n_pos < 2:
        return 0.0
    mean_val = sum(sorted_vals) / n_pos
    if mean_val == 0:
        return 0.0

    sum_abs_diff = 0.0
    # Fórmula directa de Gini: sum((2*i - n - 1) * x_i) / (n * sum(x_i))
    cum_sum = 0.0
    for i, val in enumerate(sorted_vals, 1):
        cum_sum += (2 * i - n_pos - 1) * val

    gini = cum_sum / (n_pos * sum(sorted_vals))
    return round(max(0.0, min(1.0, gini)), 4)


def calculate_histogram(values: List[float], num_bins: int = 6) -> List[Dict[str, Any]]:
    """Genera contenedores de frecuencia para la distribución de precios."""
    if not values:
        return []
    min_v = min(values)
    max_v = max(values)
    if min_v == max_v:
        return [{"range_label": f"${min_v:,.0f}", "min": min_v, "max": max_v, "count": len(values), "percentage": 100.0}]

    step = (max_v - min_v) / num_bins
    bins = []
    total = len(values)

    for i in range(num_bins):
        b_min = min_v + i * step
        b_max = min_v + (i + 1) * step
        if i == num_bins - 1:
            count = sum(1 for v in values if b_min <= v <= b_max)
        else:
            count = sum(1 for v in values if b_min <= v < b_max)

        pct = round((count / total) * 100, 1)
        bins.append({
            "range_label": f"${b_min:,.0f} - ${b_max:,.0f}",
            "min": round(b_min, 2),
            "max": round(b_max, 2),
            "count": count,
            "percentage": pct
        })

    return bins


def calculate_spearman_correlation(ranks: List[int], values: List[float]) -> float:
    """Calcula la correlación de rango de Spearman entre el ranking de más vendido y el precio."""
    n = len(ranks)
    if n < 3:
        return 0.0

    # Asignar rangos a values
    sorted_pairs = sorted(enumerate(values), key=lambda x: x[1])
    val_ranks = [0] * n
    for rank_idx, (orig_idx, _) in enumerate(sorted_pairs, 1):
        val_ranks[orig_idx] = rank_idx

    # Spearman d^2
    d_sq_sum = sum((r - vr) ** 2 for r, vr in zip(ranks, val_ranks))
    rho = 1 - (6 * d_sq_sum) / (n * (n ** 2 - 1))
    return round(rho, 3)


def generate_market_insights(
    cv: float,
    gini: float,
    discount_penetration: float,
    mean_discount: float,
    spearman_rho: float,
    skewness: float
) -> Dict[str, Any]:
    """Genera diagnóstico económico y econométrico basado en los parámetros empíricos."""
    findings = []

    # 1. Dispersión y elasticidad de precios
    if cv > 0.8:
        findings.append({
            "type": "dispersion",
            "tag": "Alta Dispersión de Precios",
            "detail": f"El Coeficiente de Variación es {cv:.2f} (>0.8), indicando un catálogo heterogéneo con productos entry-level y gama alta conviviendo en el top de ventas."
        })
    elif cv < 0.4:
        findings.append({
            "type": "dispersion",
            "tag": "Mercado Estandarizado",
            "detail": f"Bajo Coeficiente de Variación ({cv:.2f}), evidenciando precios muy homogéneos o commodities altamente competitivos."
        })
    else:
        findings.append({
            "type": "dispersion",
            "tag": "Dispersión Moderada",
            "detail": f"Coeficiente de Variación balanceado ({cv:.2f}), con una pirámide de precios comercialmente estable."
        })

    # 2. Concentración (Gini)
    if gini > 0.45:
        findings.append({
            "type": "concentration",
            "tag": "Alta Concentración de Valor",
            "detail": f"Índice de Gini de {gini:.2f} denota una distribución asimétrica donde pocos artículos de alto valor acaparan el volumen de facturación."
        })
    else:
        findings.append({
            "type": "concentration",
            "tag": "Distribución Equitativa de Precios",
            "detail": f"Índice de Gini de {gini:.2f} refleja una distribución relativamente democrática de precios entre los líderes de venta."
        })

    # 3. Presión Promocional (Penetración y Profundidad)
    if discount_penetration >= 60.0:
        findings.append({
            "type": "promotional",
            "tag": "Mercado Altamente Promocional",
            "detail": f"El {discount_penetration:.1f}% de los artículos líderes tiene descuento activo con un promedio de {mean_discount:.1f}% OFF. El precio de lista actúa solo como ancla psicológica."
        })
    elif discount_penetration >= 30.0:
        findings.append({
            "type": "promotional",
            "tag": "Presión Promocional Moderada",
            "detail": f"Penetración de descuento del {discount_penetration:.1f}%. Las ofertas son utilizadas selectivamente por los vendedores para posicionarse."
        })
    else:
        findings.append({
            "type": "promotional",
            "tag": "Mercado de Precios Inelásticos",
            "detail": f"Solo el {discount_penetration:.1f}% presenta rebajas. La demanda responde a la marca o necesidad antes que a la guerra de precios."
        })

    # 4. Sensibilidad al ranking
    if spearman_rho < -0.2:
        findings.append({
            "type": "correlation",
            "tag": "Ventaja de Menor Precio en Ranking",
            "detail": f"Correlación negativa (ρ = {spearman_rho:.2f}): precios más bajos muestran correlación favorable con posiciones más altas en el ranking."
        })
    elif spearman_rho > 0.2:
        findings.append({
            "type": "correlation",
            "tag": "Preferencia por Calidad / Ticket Alto",
            "detail": f"Correlación positiva (ρ = {spearman_rho:.2f}): los primeros puestos tienen precios superiores, indicando que el consumidor privilegia reputación sobre precio mínimo."
        })

    return {
        "summary": "Diagnóstico econométrico generado a partir de microdatos de catálogo.",
        "findings": findings
    }


def compute_category_analytics(db: Session, category_id: Optional[str] = None) -> Dict[str, Any]:
    """Calcula todas las métricas estadísticas y econométricas a partir de la última captura."""
    latest_sync = (
        db.query(SyncLog)
        .filter(SyncLog.status == "success")
        .order_by(desc(SyncLog.created_at))
        .first()
    )

    if not latest_sync:
        return {"error": "No hay sincronizaciones disponibles"}

    query = db.query(ProductRecord).filter(ProductRecord.sync_id == latest_sync.id)
    if category_id and category_id != "all":
        query = query.filter(ProductRecord.category_id == category_id)

    products = query.all()
    if not products:
        return {"error": "No se encontraron productos para el criterio seleccionado"}

    prices = [p.current_price for p in products if p.current_price > 0]
    sorted_prices = sorted(prices)
    n = len(prices)

    if n == 0:
        return {"error": "Sin datos de precio válidos"}

    # Medidas de tendencia central
    mean_price = sum(sorted_prices) / n
    quantiles = calculate_quantiles(sorted_prices)
    median_price = quantiles["median"]

    # Medidas de dispersión
    variance = sum((x - mean_price) ** 2 for x in sorted_prices) / (n - 1) if n > 1 else 0.0
    std_dev = math.sqrt(variance)
    cv = (std_dev / mean_price) if mean_price > 0 else 0.0

    # Asimetría de Pearson (Skewness = 3 * (Media - Mediana) / DesvStd)
    skewness = (3 * (mean_price - median_price) / std_dev) if std_dev > 0 else 0.0

    # Coeficiente de Gini
    gini_index = calculate_gini(sorted_prices)

    # Métricas de ofertas y ahorro (Excedente del consumidor)
    discounted_items = [p for p in products if p.discount_percentage > 0]
    discount_penetration = (len(discounted_items) / n) * 100.0 if n > 0 else 0.0
    discounts = [p.discount_percentage for p in discounted_items]
    mean_discount = (sum(discounts) / len(discounts)) if discounts else 0.0
    max_discount = max(discounts) if discounts else 0.0

    total_consumer_surplus = sum(
        (p.original_price - p.current_price)
        for p in products
        if p.original_price and p.original_price > p.current_price
    )
    avg_savings_per_deal = (total_consumer_surplus / len(discounted_items)) if discounted_items else 0.0

    # Auditoría de autenticidad de promociones
    from app.services.deal_auditor import audit_products_authenticity
    from app.schemas import ProductItem
    sample_items = [
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
        )
        for p in products
    ]
    audited = audit_products_authenticity(db, sample_items, latest_sync_id=latest_sync.id)
    real_deals_count = sum(1 for p in audited if p.deal_authenticity == "REAL")
    illusory_deals_count = sum(1 for p in audited if p.deal_authenticity == "ILLUSORY")
    deals_total = len(discounted_items)
    illusory_rate = round((illusory_deals_count / deals_total) * 100, 1) if deals_total > 0 else 0.0
    real_rate = round((real_deals_count / deals_total) * 100, 1) if deals_total > 0 else 0.0

    # Correlación Rango vs Precio
    ranked_products = [p for p in products if p.best_seller_rank is not None and p.current_price > 0]
    if len(ranked_products) >= 3:
        spearman_rho = calculate_spearman_correlation(
            [p.best_seller_rank for p in ranked_products],
            [p.current_price for p in ranked_products]
        )
    else:
        spearman_rho = 0.0

    # Histograma de precios
    price_histogram = calculate_histogram(sorted_prices, num_bins=6)

    # Tramos de descuento
    discount_brackets = [
        {"bracket": "Sin Descuento", "count": sum(1 for p in products if p.discount_percentage <= 0)},
        {"bracket": "1% - 15% OFF", "count": sum(1 for p in products if 0 < p.discount_percentage <= 15)},
        {"bracket": "16% - 30% OFF", "count": sum(1 for p in products if 15 < p.discount_percentage <= 30)},
        {"bracket": "31% - 50% OFF", "count": sum(1 for p in products if 30 < p.discount_percentage <= 50)},
        {"bracket": "> 50% OFF", "count": sum(1 for p in products if p.discount_percentage > 50)},
    ]
    for b in discount_brackets:
        b["percentage"] = round((b["count"] / n) * 100, 1)

    # Diagnóstico cualitativo automatizado
    insights = generate_market_insights(
        cv=cv,
        gini=gini_index,
        discount_penetration=discount_penetration,
        mean_discount=mean_discount,
        spearman_rho=spearman_rho,
        skewness=skewness
    )

    # Cálculo comparativo entre todas las categorías capturadas
    all_sync_products = db.query(ProductRecord).filter(ProductRecord.sync_id == latest_sync.id).all()
    cat_groups = defaultdict(list)
    for p in all_sync_products:
        c_name = p.category_name or p.category_id or "General"
        cat_groups[c_name].append(p)

    total_best_sellers_count = len(all_sync_products)
    ranked_cats = []
    for c_name, c_products in cat_groups.items():
        c_prices = [p.current_price for p in c_products if p.current_price > 0]
        c_sorted_prices = sorted(c_prices)
        c_med = c_sorted_prices[len(c_sorted_prices) // 2] if c_sorted_prices else 0.0
        c_mean = sum(c_prices) / len(c_prices) if c_prices else 0.0
        c_disc_items = [p for p in c_products if p.discount_percentage > 0]
        c_penetration = round((len(c_disc_items) / len(c_products)) * 100, 1) if c_products else 0.0
        c_discounts = [p.discount_percentage for p in c_disc_items]
        c_mean_disc = round(sum(c_discounts) / len(c_discounts), 1) if c_discounts else 0.0
        c_share = round((len(c_products) / total_best_sellers_count) * 100, 1) if total_best_sellers_count > 0 else 0.0
        c_id = c_products[0].category_id or "general"

        ranked_cats.append({
            "category_id": c_id,
            "category_name": c_name,
            "items_count": len(c_products),
            "market_share_percentage": c_share,
            "mean_price": round(c_mean, 2),
            "median_price": round(c_med, 2),
            "mean_discount": c_mean_disc,
            "discount_penetration": c_penetration,
        })

    # Ordenar categorías por volumen de líderes en el Top y penetración
    ranked_cats.sort(key=lambda x: (x["items_count"], x["discount_penetration"]), reverse=True)
    for idx, rc in enumerate(ranked_cats, 1):
        rc["rank"] = idx

    top_cat = None
    if ranked_cats:
        winner = ranked_cats[0]
        top_cat = {
            "category_id": winner["category_id"],
            "category_name": winner["category_name"],
            "items_count": winner["items_count"],
            "market_share_percentage": winner["market_share_percentage"],
            "mean_price": winner["mean_price"],
            "median_price": winner["median_price"],
            "discount_penetration": winner["discount_penetration"],
            "real_deals_count": sum(1 for p in cat_groups[winner["category_name"]] if getattr(p, "is_match", False)),
            "analysis": f"La categoría '{winner['category_name']}' es la más vendida y dominante con {winner['items_count']} artículos en el top ({winner['market_share_percentage']}% de presencia de mercado), precio mediano de ${winner['median_price']:,.0f} MXN y una penetración de oferta del {winner['discount_penetration']}%."
        }

    return {
        "sample_size": n,
        "sync_timestamp": latest_sync.created_at.isoformat() if latest_sync.created_at else None,
        "category_id": category_id or "all",
        "central_tendency": {
            "mean_price": round(mean_price, 2),
            "median_price": round(median_price, 2),
            "skewness": round(skewness, 2),
            "skewness_type": "Positiva (Sesgo a la derecha)" if skewness > 0.1 else ("Negativa" if skewness < -0.1 else "Simétrica")
        },
        "dispersion": {
            "std_deviation": round(std_dev, 2),
            "variance": round(variance, 2),
            "coefficient_of_variation": round(cv, 3),
            "iqr": quantiles["iqr"],
            "gini_index": gini_index,
        },
        "quantiles": quantiles,
        "promotions_and_savings": {
            "discount_penetration_rate": round(discount_penetration, 1),
            "mean_discount_percentage": round(mean_discount, 1),
            "max_discount_percentage": round(max_discount, 1),
            "total_consumer_surplus": round(total_consumer_surplus, 2),
            "average_savings_per_discounted_item": round(avg_savings_per_deal, 2),
            "discounted_items_count": len(discounted_items),
            "real_deals_count": real_deals_count,
            "illusory_deals_count": illusory_deals_count,
            "real_deals_rate_percentage": real_rate,
            "illusory_rate_percentage": illusory_rate,
        },
        "econometric_correlations": {
            "rank_price_spearman_rho": spearman_rho
        },
        "price_histogram": price_histogram,
        "discount_brackets": discount_brackets,
        "market_insights": insights,
        "top_selling_category": top_cat,
        "category_rankings": ranked_cats
    }
