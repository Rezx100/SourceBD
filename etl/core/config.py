"""Central env-driven settings. Never read os.environ outside this module."""
from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Supabase
    supabase_url: str = Field(default="")
    supabase_service_role_key: str = Field(default="")
    supabase_db_url: str = Field(default="")

    # ETL runtime
    etl_user_agent: str = "SourceBD-Research/1.0 (+https://sourcebd.com/data-policy)"
    etl_raw_dir: Path = Path("./etl/raw")
    etl_parsed_dir: Path = Path("./etl/parsed")
    etl_log_level: str = "INFO"
    etl_rate_limit_rps: float = 0.5
    etl_max_retries: int = 5
    etl_retry_backoff_base: float = 2.0
    etl_playwright_headless: bool = True

    # Barikoi location services (Rupantor geocode cache backfill).
    # Accepts the historical BRIKOI_API_KEY spelling as a fallback.
    barikoi_api_key: str = Field(default="")
    brikoi_api_key: str = Field(default="")

    @property
    def resolved_barikoi_api_key(self) -> str:
        return self.barikoi_api_key or self.brikoi_api_key

    # BunnyCDN (raw document mirror — brand disclosures, RSC PDFs, compliance docs)
    bunny_api_key: str = Field(default="")
    bunny_storage_zone: str = Field(default="")
    bunny_storage_password: str = Field(default="")
    bunny_storage_region: str = Field(default="")
    bunny_storage_hostname: str = Field(default="storage.bunnycdn.com")
    bunny_pull_zone_hostname: str = Field(default="")

    def ensure_dirs(self) -> None:
        self.etl_raw_dir.mkdir(parents=True, exist_ok=True)
        self.etl_parsed_dir.mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.ensure_dirs()
