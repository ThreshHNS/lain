from __future__ import annotations

from typing import Any

from openai import AsyncOpenAI

from app.llm.base import LLMResponse, LLMProvider, Message, TokenUsage


class OpenRouterLLMProvider(LLMProvider):
    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        base_url: str,
        default_temperature: float,
        default_max_tokens: int,
    ) -> None:
        self._client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url,
        )
        self._model = model
        self._default_temperature = default_temperature
        self._default_max_tokens = default_max_tokens

    @property
    def model_name(self) -> str:
        return self._model

    async def complete(
        self,
        messages: list[Message],
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
        response_format: dict[str, Any] | None = None,
    ) -> LLMResponse:
        request: dict[str, Any] = {
            "model": self._model,
            "messages": [message.model_dump(mode="json", exclude_none=True) for message in messages],
            "temperature": self._default_temperature if temperature is None else temperature,
            "max_tokens": self._default_max_tokens if max_tokens is None else max_tokens,
        }
        if response_format is not None:
            request["response_format"] = response_format

        response = await self._client.chat.completions.create(**request)
        message = response.choices[0].message
        content = message.content or ""
        usage = None
        if response.usage is not None:
            usage = TokenUsage(
                promptTokens=response.usage.prompt_tokens or 0,
                completionTokens=response.usage.completion_tokens or 0,
                totalTokens=response.usage.total_tokens or 0,
            )

        return LLMResponse(
            content=content,
            usage=usage,
            raw=response.model_dump(mode="json"),
        )

