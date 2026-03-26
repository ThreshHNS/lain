from __future__ import annotations

from app.config import Settings
from app.llm.base import LLMProvider
from app.llm.openrouter import OpenRouterLLMProvider


def create_llm_provider(settings: Settings) -> LLMProvider:
    if settings.llm_provider != "openrouter":
        raise ValueError(f"Unsupported llm provider: {settings.llm_provider!r}")

    return OpenRouterLLMProvider(
        api_key=settings.openrouter_api_key.get_secret_value(),
        model=settings.openrouter_model,
        base_url=settings.openrouter_base_url,
        default_temperature=settings.llm_temperature,
        default_max_tokens=settings.llm_max_tokens,
    )

