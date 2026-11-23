"""Centralized environment configuration for Alpha_Insight."""

from __future__ import annotations

from functools import lru_cache
from typing import Optional
from urllib.parse import quote_plus

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Typed application settings loaded from environment variables or .env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Environment & Runtime
    env: str = Field(default="DEV", alias="ENV")
    port: int = Field(default=8080, alias="PORT")
    api_url: str = Field(default="http://localhost:8080", alias="API_URL")
    api_key: str = Field(default="clover-secure-token-123", alias="API_KEY")

    # PostgreSQL (4leafclover) Database Configuration
    # Environment DB Cadence: DEV -> 4leafclover_dev, UAT -> 4leafclover_uat, PRD -> 4leafclover
    db_host: Optional[str] = Field(default=None, alias="DB_HOST")
    db_public_ip: str = Field(default="localhost", alias="DB_PUBLIC_IP")
    db_port: int = Field(default=5432, alias="DB_PORT")
    db_name: str = Field(default="4leafclover_dev", alias="DB_NAME")
    db_user: str = Field(default="postgres", alias="DB_USER")
    db_password: str = Field(default="", alias="DB_PASSWORD")
    db_sslmode: str = Field(default="require", alias="DB_SSLMODE")
    database_url_override: Optional[str] = Field(default=None, alias="DATABASE_URL")
    db_pool_size: int = Field(default=3, alias="DB_POOL_SIZE")
    db_max_overflow: int = Field(default=5, alias="DB_MAX_OVERFLOW")
    db_pool_recycle: int = Field(default=300, alias="DB_POOL_RECYCLE")
    db_pool_timeout: int = Field(default=30, alias="DB_POOL_TIMEOUT")
    db_raw_pool_maxconn: int = Field(default=5, alias="DB_RAW_POOL_MAXCONN")

    # Authentication & Session Configuration
    google_client_id: str = Field(default="", alias="GOOGLE_CLIENT_ID")
    superadmin_email: str = Field(default="ferriskwan@gmail.com", alias="SUPERADMIN_EMAIL")
    session_cookie_name: str = Field(default="alpha_sid", alias="SESSION_COOKIE_NAME")
    session_ttl_days: int = Field(default=7, alias="SESSION_TTL_DAYS")

    # External Market Data & AI Provider Configuration
    twelvedata_api_key: str = Field(default="", alias="TWELVEDATA_API_KEY")
    twelvedata_base_url: str = Field(
        default="https://api.twelvedata.com/time_series",
        alias="TWELVEDATA_BASE_URL",
    )
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    gemini_default_model: str = Field(
        default="gemini-4-argon",
        alias="GEMINI_DEFAULT_MODEL",
    )
    kimi_api_key: str = Field(default="", alias="KIMI_API_KEY")
    kimi_base_url: str = Field(
        default="https://api.moonshot.ai/v1",
        alias="KIMI_BASE_URL",
    )
    kimi_default_model: str = Field(
        default="kimi-k2-0711-preview",
        alias="KIMI_DEFAULT_MODEL",
    )
    default_committee_lookback_runs: int = Field(
        default=3,
        alias="DEFAULT_COMMITTEE_LOOKBACK_RUNS",
    )

    # Batch Calculation & Margin Interest Fallback Constants (No Magic Numbers)
    default_margin_rate_usd: float = Field(
        default=0.0565,
        alias="DEFAULT_MARGIN_RATE_USD",
    )
    default_margin_basis_usd: int = Field(
        default=360,
        alias="DEFAULT_MARGIN_BASIS_USD",
    )
    default_margin_rate_sgd: float = Field(
        default=0.0291,
        alias="DEFAULT_MARGIN_RATE_SGD",
    )
    default_margin_basis_sgd: int = Field(
        default=365,
        alias="DEFAULT_MARGIN_BASIS_SGD",
    )
    default_margin_rate_other: float = Field(
        default=0.0500,
        alias="DEFAULT_MARGIN_RATE_OTHER",
    )
    default_margin_basis_other: int = Field(
        default=365,
        alias="DEFAULT_MARGIN_BASIS_OTHER",
    )
    default_broker_name: str = Field(default="Saxo", alias="DEFAULT_BROKER_NAME")
    default_currency_code: str = Field(default="USD", alias="DEFAULT_CURRENCY_CODE")

    @property
    def resolved_db_host(self) -> str:
        """Return DB_PUBLIC_IP when DB_HOST is a Cloud SQL instance name, matching ProcessData.py."""
        if self.db_host and self.db_host.startswith("/cloudsql/"):
            return self.db_host
        if self.db_public_ip and self.db_public_ip != "localhost":
            return self.db_public_ip
        if self.db_host and ":" in self.db_host and self.db_host.count(":") >= 2:
            return self.db_public_ip
        return self.db_host or self.db_public_ip

    @property
    def sqlalchemy_database_uri(self) -> str:
        """Construct the SQLAlchemy PostgreSQL connection URI."""
        if self.database_url_override:
            return self.database_url_override
        encoded_user = quote_plus(self.db_user)
        encoded_pwd = quote_plus(self.db_password)
        if self.db_host and self.db_host.startswith("/cloudsql/"):
            return f"postgresql+psycopg2://{encoded_user}:{encoded_pwd}@/{self.db_name}?host={self.db_host}"
        return (
            f"postgresql+psycopg2://{encoded_user}:{encoded_pwd}"
            f"@{self.resolved_db_host}:{self.db_port}/{self.db_name}"
            f"?sslmode={self.db_sslmode}"
        )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached singleton Settings instance."""
    return Settings()
