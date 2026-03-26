from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.core.operations import OperationType
from app.dsl.schema import SceneDocument
from app.llm.base import Message
from app.models.scene_context import SceneContext


class RunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    operation: OperationType | None = None
    sceneContext: SceneContext
    userPrompt: str = Field(min_length=1)
    currentScene: SceneDocument | None = None
    conversationHistory: list[Message] = Field(default_factory=list)
    operationParams: dict[str, object] = Field(default_factory=dict)


class SceneSaveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    document: SceneDocument


class SceneValidateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    document: SceneDocument
