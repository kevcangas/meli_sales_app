import os
from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SITE_DOMAIN: str = os.getenv("SITE_DOMAIN", "www.mercadolibre.com.mx")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:////data/meli.db")
    SCRAPE_INTERVAL_HOURS: int = int(os.getenv("SCRAPE_INTERVAL_HOURS", "6"))
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "*")
    MIN_DISCOUNT_PERCENT: int = int(os.getenv("MIN_DISCOUNT_PERCENT", "10"))
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    @property
    def cors_origins_list(self) -> List[str]:
        if self.CORS_ORIGINS == "*":
            return ["*"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
