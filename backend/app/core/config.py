"""Application settings. Load from env. Pydantic v2."""
from typing import Union

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    PROJECT_NAME: str = "BM Smart Parcel Tracker"
    API_V1_STR: str = "/api"
    DEBUG: bool = False

    # CORS: comma-separated list of origins, or set BACKEND_CORS_ORIGINS in env
    BACKEND_CORS_ORIGINS: list[str] = []

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, list[str]]) -> Union[str, list[str]]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    # Database (env: DATABASE_URL or database_url)
    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/smart_parcel",
        validation_alias=AliasChoices("DATABASE_URL", "database_url"),
    )

    # Redis (env: REDIS_URL or redis_url)
    redis_url: str = Field(
        default="redis://localhost:6379/0",
        validation_alias=AliasChoices("REDIS_URL", "redis_url"),
    )

    # External APIs (never commit secrets)
    OPENAI_API_KEY: str | None = None
    GEMINI_API_KEY: str | None = None
    cbr_api_url: str = "https://www.cbr-xml-daily.ru/daily_json.js"
    
    # JWT Authentication
    SECRET_KEY: str = Field(
        default="CHANGE_THIS_IN_PRODUCTION_USE_openssl_rand_hex_32",
        description="Secret key for JWT token encoding. MUST be changed in production."
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Backward compatibility
    @property
    def app_name(self) -> str:
        return self.PROJECT_NAME

    @property
    def debug(self) -> bool:
        return self.DEBUG


settings = Settings()
