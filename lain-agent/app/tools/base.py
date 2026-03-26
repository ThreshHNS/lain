from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Protocol

from pydantic import BaseModel, ConfigDict, Field

from app.dsl.schema import SceneDocument
from app.dsl.validators import ValidationDiagnostic
from app.llm.base import LLMProvider, Message, TokenUsage, build_json_response_format, parse_json_content
from app.models.agent_response import MissingInput
from app.models.scene_context import SceneContext


class ToolResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tool: str
    summary: str
    payload: dict[str, Any] = Field(default_factory=dict)
    diagnostics: list[ValidationDiagnostic] = Field(default_factory=list)
    usage: TokenUsage | None = None


@dataclass
class ToolContext:
    llm: LLMProvider
    repo_root: Any
    scene_context: SceneContext
    current_scene: SceneDocument | None = None
    conversation_history: list[Message] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    prompts: dict[str, str] = field(default_factory=dict)
    store: Any = None


class Tool(Protocol):
    name: str
    description: str
    parameters_schema: dict[str, Any]

    async def execute(self, ctx: ToolContext, params: dict[str, Any]) -> ToolResult: ...


class ToolNeedsInputError(ValueError):
    def __init__(self, missing_inputs: list[MissingInput], message: str = "More input is required.") -> None:
        self.missing_inputs = missing_inputs
        super().__init__(message)


def render_prompt(template: str, *, scene_context_json: str, current_scene_json: str = "", validation_feedback_json: str = "") -> str:
    return (
        template.replace("{{SCENE_CONTEXT_JSON}}", scene_context_json)
        .replace("{{CURRENT_SCENE_JSON}}", current_scene_json)
        .replace("{{VALIDATION_FEEDBACK_JSON}}", validation_feedback_json)
    )


def dump_json(payload: Any) -> str:
    return json.dumps(payload, ensure_ascii=True, indent=2)


__all__ = [
    "Tool",
    "ToolContext",
    "ToolNeedsInputError",
    "ToolResult",
    "build_json_response_format",
    "dump_json",
    "parse_json_content",
    "render_prompt",
]

