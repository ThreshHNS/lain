from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.core.operations import OperationType
from app.dsl.patch import PatchOperation
from app.dsl.schema import SceneDocument
from app.dsl.validators import ValidationDiagnostic
from app.llm.base import TokenUsage


class RunStatus(StrEnum):
    completed = "completed"
    needs_input = "needs_input"
    blocked = "blocked"


class MissingInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    field: str
    reason: str


class ToolExecutionRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tool: str
    summary: str
    payload: dict[str, Any] = Field(default_factory=dict)


class AgentRunResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: RunStatus
    operation: OperationType
    summary: str
    userFacingMessage: str
    sceneDocument: SceneDocument | None = None
    patch: list[PatchOperation] = Field(default_factory=list)
    answer: str | None = None
    toolResults: list[ToolExecutionRecord] = Field(default_factory=list)
    diagnostics: list[ValidationDiagnostic] = Field(default_factory=list)
    missingInputs: list[MissingInput] = Field(default_factory=list)
    usage: TokenUsage | None = None

