import sys
from unittest.mock import MagicMock

# Mock módulos dependientes de C para Windows
sys.modules["selectolax"] = MagicMock()
sys.modules["selectolax.parser"] = MagicMock()
sys.modules["curl_cffi"] = MagicMock()
sys.modules["curl_cffi.requests"] = MagicMock()

import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.database import Base, get_db
from app.models import SyncLog, ProductRecord
from app.services.storage import get_product_price_history
from app.main import app

test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_get_product_price_history_all_and_filtered(db_session):
    now = datetime.now(timezone.utc)

    # Crear logs de sincronización en diferentes momentos
    sync_old = SyncLog(id=1, status="success", created_at=now - timedelta(days=20))
    sync_mid = SyncLog(id=2, status="success", created_at=now - timedelta(days=5))
    sync_recent = SyncLog(id=3, status="success", created_at=now - timedelta(hours=2))

    db_session.add_all([sync_old, sync_mid, sync_recent])
    db_session.commit()

    # Agregar registros de precios
    p1 = ProductRecord(
        id=1,
        sync_id=1,
        item_id="MLM12345",
        title="Laptop Pro 16",
        category_id="MLM1055",
        category_name="Computación",
        permalink="https://articulo.mercadolibre.com.mx/MLM12345",
        current_price=25000.0,
        original_price=30000.0,
        discount_percentage=16.6,
        recorded_at=now - timedelta(days=20),
    )
    p2 = ProductRecord(
        id=2,
        sync_id=2,
        item_id="MLM12345",
        title="Laptop Pro 16",
        category_id="MLM1055",
        category_name="Computación",
        permalink="https://articulo.mercadolibre.com.mx/MLM12345",
        current_price=23000.0,
        original_price=30000.0,
        discount_percentage=23.3,
        recorded_at=now - timedelta(days=5),
    )
    p3 = ProductRecord(
        id=3,
        sync_id=3,
        item_id="MLM12345",
        title="Laptop Pro 16",
        category_id="MLM1055",
        category_name="Computación",
        permalink="https://articulo.mercadolibre.com.mx/MLM12345",
        current_price=22000.0,
        original_price=30000.0,
        discount_percentage=26.6,
        recorded_at=now - timedelta(hours=2),
    )

    db_session.add_all([p1, p2, p3])
    db_session.commit()

    # 1. Sin filtro de días: deben retornar las 3 observaciones
    history_all = get_product_price_history(db_session, "MLM12345")
    assert history_all is not None
    assert history_all.total_observations == 3
    assert len(history_all.history) == 3
    assert history_all.min_recorded_price == 22000.0
    assert history_all.max_recorded_price == 25000.0
    assert history_all.current_price == 22000.0
    assert history_all.trend == "downward"

    # 2. Con filtro de 7 días: deben retornar únicamente sync 2 y sync 3
    history_7d = get_product_price_history(db_session, "MLM12345", days=7)
    assert history_7d is not None
    assert history_7d.total_observations == 2
    assert len(history_7d.history) == 2
    assert history_7d.history[0].sync_id == 2
    assert history_7d.history[1].sync_id == 3
    assert history_7d.min_recorded_price == 22000.0
    assert history_7d.max_recorded_price == 23000.0

    # 3. Con filtro de 1 día: debe retornar únicamente sync 3
    history_1d = get_product_price_history(db_session, "MLM12345", days=1)
    assert history_1d is not None
    assert history_1d.total_observations == 1
    assert len(history_1d.history) == 1
    assert history_1d.history[0].sync_id == 3

    # 4. Producto inexistente
    history_none = get_product_price_history(db_session, "MLM99999")
    assert history_none is None


def test_api_endpoint_history_with_days_param(db_session):
    now = datetime.now(timezone.utc)
    sync = SyncLog(id=1, status="success", created_at=now)
    p = ProductRecord(
        id=1,
        sync_id=1,
        item_id="MLM67890",
        title="Audífonos Bluetooth",
        permalink="https://articulo.mercadolibre.com.mx/MLM67890",
        current_price=599.0,
        recorded_at=now,
    )
    db_session.add_all([sync, p])
    db_session.commit()

    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db

    client = TestClient(app)

    # Endpoint sin parámetro days
    res = client.get("/api/v1/products/MLM67890/history")
    assert res.status_code == 200
    data = res.json()
    assert data["item_id"] == "MLM67890"
    assert data["total_observations"] == 1

    # Endpoint con parámetro days
    res_days = client.get("/api/v1/products/MLM67890/history?days=30")
    assert res_days.status_code == 200
    data_days = res_days.json()
    assert data_days["item_id"] == "MLM67890"
    assert data_days["total_observations"] == 1

    # Endpoint 404
    res_404 = client.get("/api/v1/products/MLM_NOT_FOUND/history")
    assert res_404.status_code == 404

    app.dependency_overrides.clear()
