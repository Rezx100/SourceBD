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

    def ensure_dirs(self) -> None:
        self.etl_raw_dir.mkdir(parents=True, exist_ok=True)
        self.etl_parsed_dir.mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.ensure_dirs()
