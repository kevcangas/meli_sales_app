import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

# Asegurar que el directorio de la base de datos exista si es sqlite
if settings.DATABASE_URL.startswith("sqlite"):
    db_path = settings.DATABASE_URL.replace("sqlite:////", "/").replace("sqlite:///", "")
    os.makedirs(os.path.dirname(db_path) if os.path.dirname(db_path) else ".", exist_ok=True)
    connect_args = {"check_same_thread": False}
else:
    connect_args = {}

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    import sqlalchemy as sa
    from app import models  # noqa
    Base.metadata.create_all(bind=engine)
    # Migración ligera de columnas adicionales
    try:
        with engine.connect() as conn:
            conn.execute(sa.text("ALTER TABLE product_records ADD COLUMN category_name VARCHAR(200)"))
            conn.commit()
    except Exception:
        pass

    try:
        with engine.connect() as conn:
            conn.execute(sa.text("ALTER TABLE product_records ADD COLUMN recorded_at DATETIME"))
            conn.execute(sa.text("UPDATE product_records SET recorded_at = (SELECT created_at FROM sync_logs WHERE sync_logs.id = product_records.sync_id) WHERE recorded_at IS NULL"))
            conn.commit()
    except Exception:
        pass

