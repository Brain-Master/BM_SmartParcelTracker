"""Application settings. Load from env."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "BM Smart Parcel Tracker"
    debug: bool = False

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/smart_parcel"

    # Redis (for Celery / rate limiting)
    redis_url: str = "redis://localhost:6379/0"

    # External APIs (never commit secrets)
    openai_api_key: str | None = None
    cbr_api_url: str = "https://www.cbr-xml-daily.ru/daily_json.js"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
