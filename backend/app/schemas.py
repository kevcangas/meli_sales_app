from typing import List, Optional, Union
from datetime import datetime
from pydantic import BaseModel


class ProductItem(BaseModel):
    id: Optional[Union[str, int]] = None
    title: str
    permalink: str
    current_price: float
    original_price: Optional[float] = None
    discount_percentage: float = 0.0
    is_best_seller: bool = False
    best_seller_rank: Optional[int] = None
    is_match: bool = False
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    # Auditoría de Autenticidad de Descuento
    deal_authenticity: Optional[str] = "NEW_LISTING"  # REAL, ILLUSORY, EXAGGERATED, MILD, NEW_LISTING, NO_DEAL
    authenticity_score: Optional[int] = 70            # 0 a 100
    real_discount_percentage: Optional[float] = 0.0
    historical_median_price: Optional[float] = None
    authenticity_reason: Optional[str] = ""

    class Config:
        from_attributes = True


class ComparisonSummary(BaseModel):
    total_best_sellers_monitored: int = 0
    total_deals_monitored: int = 0
    best_sellers_with_deal_count: int = 0
    real_deals_count: int = 0
    illusory_deals_count: int = 0
    last_sync_at: Optional[datetime] = None
    last_sync_status: Optional[str] = None
    execution_time_seconds: Optional[float] = 0.0


class ComparisonResponse(BaseModel):
    summary: ComparisonSummary
    highlighted_deals: List[ProductItem] = []
    best_sellers: List[ProductItem] = []


class SyncTriggerResponse(BaseModel):
    status: str
    message: str
    sync_id: Optional[int] = None
    summary: Optional[ComparisonSummary] = None


class CategoryInfo(BaseModel):
    id: str
    name: str
    url_suffix: str


class QuantilesSchema(BaseModel):
    min: float
    q1: float
    median: float
    q3: float
    max: float
    iqr: float


class CentralTendencySchema(BaseModel):
    mean_price: float
    median_price: float
    skewness: float
    skewness_type: str


class DispersionSchema(BaseModel):
    std_deviation: float
    variance: float
    coefficient_of_variation: float
    iqr: float
    gini_index: float


class PromotionsSchema(BaseModel):
    discount_penetration_rate: float
    mean_discount_percentage: float
    max_discount_percentage: float
    total_consumer_surplus: float
    average_savings_per_discounted_item: float
    discounted_items_count: int
    real_deals_count: Optional[int] = 0
    illusory_deals_count: Optional[int] = 0
    real_deals_rate_percentage: Optional[float] = 0.0
    illusory_rate_percentage: Optional[float] = 0.0


class HistogramBin(BaseModel):
    range_label: str
    min: float
    max: float
    count: int
    percentage: float


class DiscountBracket(BaseModel):
    bracket: str
    count: int
    percentage: float


class MarketInsightItem(BaseModel):
    type: str
    tag: str
    detail: str


class MarketInsightsSchema(BaseModel):
    summary: str
    findings: List[MarketInsightItem]


class TopSellingCategory(BaseModel):
    category_id: str
    category_name: str
    items_count: int
    market_share_percentage: float
    mean_price: float
    median_price: float
    discount_penetration: float
    real_deals_count: int
    analysis: str


class CategoryRankingItem(BaseModel):
    rank: int
    category_id: str
    category_name: str
    items_count: int
    market_share_percentage: float
    median_price: float
    mean_discount: float
    discount_penetration: float


class AnalyticsResponse(BaseModel):
    sample_size: int
    sync_timestamp: Optional[str] = None
    category_id: str
    central_tendency: CentralTendencySchema
    dispersion: DispersionSchema
    quantiles: QuantilesSchema
    promotions_and_savings: PromotionsSchema
    econometric_correlations: dict
    price_histogram: List[HistogramBin]
    discount_brackets: List[DiscountBracket]
    market_insights: MarketInsightsSchema
    top_selling_category: Optional[TopSellingCategory] = None
    category_rankings: List[CategoryRankingItem] = []


class PriceHistoryPoint(BaseModel):
    sync_id: int
    recorded_at: datetime
    current_price: float
    original_price: Optional[float] = None
    discount_percentage: float = 0.0
    best_seller_rank: Optional[int] = None
    deal_authenticity: Optional[str] = None
    is_match: bool = False


class ProductPriceHistoryResponse(BaseModel):
    item_id: str
    title: str
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    permalink: str
    current_price: float
    original_price: Optional[float] = None
    min_recorded_price: float
    max_recorded_price: float
    median_recorded_price: float
    price_change_amount: float
    price_change_percentage: float
    trend: str  # "downward", "upward", "stable"
    total_observations: int
    history: List[PriceHistoryPoint]


