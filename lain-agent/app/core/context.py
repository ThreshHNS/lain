from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.core.operations import OperationType
from app.dsl.schema import SceneDocument
from app.llm.base import Message
from app.models.scene_context import SceneContext


@dataclass
class PipelineContext:
    scene_context: SceneContext
    user_prompt: str
    operation: OperationType | None = None
    current_scene: SceneDocument | None = None
    conversation_history: list[Message] = field(default_factory=list)
    operation_params: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)
