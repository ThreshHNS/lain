from __future__ import annotations

import json
from enum import StrEnum
from typing import Any, Protocol

from pydantic import BaseModel, ConfigDict, Field


class MessageRole(StrEnum):
    system = "system"
    user = "user"
    assistant = "assistant"
    tool = "tool"


class Message(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: MessageRole
    content: str
    name: str | None = None


class TokenUsage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    promptTokens: int = 0
    completionTokens: int = 0
    totalTokens: int = 0


class LLMResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: str
    usage: TokenUsage | None = None
    raw: dict[str, Any] = Field(default_factory=dict)


class LLMProvider(Protocol):
    @property
    def model_name(self) -> str: ...

    async def complete(
        self,
        messages: list[Message],
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
        response_format: dict[str, Any] | None = None,
    ) -> LLMResponse: ...


def build_json_response_format(name: str, schema: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "json_schema",
        "json_schema": {
            "name": name,
            "schema": schema,
        },
    }


def parse_json_content(content: str) -> Any:
    stripped = content.strip()
    if stripped.startswith("```"):
        lines = stripped.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        stripped = "\n".join(lines).strip()
    return json.loads(stripped)

