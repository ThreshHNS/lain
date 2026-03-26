from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class AgentStatus(StrEnum):
    completed = "completed"
    needs_input = "needs_input"
    blocked = "blocked"


class AgentMode(StrEnum):
    scene_direction = "scene_direction"
    asset_search = "asset_search"
    asset_attach = "asset_attach"
    babylon_code = "babylon_code"


class ChangeKind(StrEnum):
    note = "note"
    asset = "asset"
    code = "code"


class ToolPlanItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tool: str
    intent: str


class ChangeRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: ChangeKind = ChangeKind.note
    path: str | None = None
    summary: str
    details: str | None = None


class MissingInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    field: str
    reason: str


class AgentRunResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: AgentStatus
    mode: AgentMode
    summary: str
    userFacingMessage: str
    toolPlan: list[ToolPlanItem] = Field(default_factory=list)
    changes: list[ChangeRecord] = Field(default_factory=list)
    missingInputs: list[MissingInput] = Field(default_factory=list)

