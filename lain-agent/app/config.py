from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[1] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    llm_provider: str = Field(default="openrouter", validation_alias="LAIN_AGENT_LLM_PROVIDER")
    openrouter_api_key: SecretStr = Field(validation_alias="OPENROUTER_API_KEY")
    openrouter_model: str = Field(default="openai/gpt-4.1-mini", validation_alias="LAIN_AGENT_MODEL")
    openrouter_base_url: str = Field(
        default="https://openrouter.ai/api/v1",
        validation_alias="LAIN_AGENT_OPENROUTER_BASE_URL",
    )
    llm_temperature: float = Field(default=0.2, validation_alias="LAIN_AGENT_TEMPERATURE")
    llm_max_tokens: int = Field(default=4000, validation_alias="LAIN_AGENT_MAX_TOKENS")
    pipeline_max_retries: int = Field(default=2, validation_alias="LAIN_AGENT_PIPELINE_MAX_RETRIES")
    repo_root: Path = Field(default_factory=_default_repo_root, validation_alias="LAIN_AGENT_REPO_ROOT")


@lru_cache
def get_settings() -> Settings:
    return Settings()
