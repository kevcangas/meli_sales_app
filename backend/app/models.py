from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base


class SyncLog(Base):
    __tablename__ = "sync_logs"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    status = Column(String(50), default="running")  # running, success, error
    total_best_sellers = Column(Integer, default=0)
    total_deals = Column(Integer, default=0)
    matches_count = Column(Integer, default=0)
    execution_time_seconds = Column(Float, default=0.0)
    error_message = Column(Text, nullable=True)

    products = relationship("ProductRecord", back_populates="sync_log", cascade="all, delete-orphan")


class ProductRecord(Base):
    __tablename__ = "product_records"

    id = Column(Integer, primary_key=True, index=True)
    sync_id = Column(Integer, ForeignKey("sync_logs.id", ondelete="CASCADE"), index=True)
    item_id = Column(String(100), nullable=True, index=True)
    title = Column(String(500), nullable=False)
    permalink = Column(Text, nullable=False)
    current_price = Column(Float, nullable=False, default=0.0)
    original_price = Column(Float, nullable=True)
    discount_percentage = Column(Float, default=0.0)
    is_best_seller = Column(Boolean, default=False)
    best_seller_rank = Column(Integer, nullable=True)
    is_match = Column(Boolean, default=False)
    category_id = Column(String(100), nullable=True)
    category_name = Column(String(200), nullable=True)
    recorded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    sync_log = relationship("SyncLog", back_populates="products")
