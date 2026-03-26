from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from app.config import Settings, get_settings
from app.core.context import PipelineContext
from app.core.pipeline import Pipeline
from app.core.operations import OperationType
from app.hooks.logging import UsageLoggingHook
from app.llm.registry import create_llm_provider
from app.models.agent_response import AgentRunResponse
from app.models.scene_context import SceneContext
from app.storage.scene_store import SceneStore
from app.tools.registry import ToolRegistry

import app.tools.asset_attach  # noqa: F401
import app.tools.asset_search  # noqa: F401
import app.tools.scene_create  # noqa: F401
import app.tools.scene_patch  # noqa: F401
import app.tools.scene_query  # noqa: F401
import app.tools.validate  # noqa: F401


class AgentService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.repo_root = settings.repo_root.resolve()
        self.store = SceneStore(self.repo_root)
        self.llm = create_llm_provider(settings)
        self.prompts = self._load_prompts()

        self.tools = ToolRegistry()
        self.tools.load_registered()
        self.pipeline = Pipeline(
            llm=self.llm,
            tool_registry=self.tools,
            repo_root=self.repo_root,
            store=self.store,
            prompts=self.prompts,
            post_hooks=[UsageLoggingHook()],
            max_retries=settings.pipeline_max_retries,
        )

    def _load_prompts(self) -> dict[str, str]:
        prompts_dir = Path(__file__).resolve().parent / "prompts"
        return {
            "system": (prompts_dir / "system.txt").read_text(encoding="utf-8").strip(),
            "scene_create": (prompts_dir / "scene_create.txt").read_text(encoding="utf-8").strip(),
            "scene_patch": (prompts_dir / "scene_patch.txt").read_text(encoding="utf-8").strip(),
            "scene_query": (prompts_dir / "scene_query.txt").read_text(encoding="utf-8").strip(),
        }

    async def run(
        self,
        *,
        scene_context: SceneContext,
        user_prompt: str,
        operation: OperationType | None = None,
        current_scene=None,
        conversation_history=None,
        operation_params=None,
    ) -> AgentRunResponse:
        if current_scene is None and operation in {
            OperationType.scene_patch,
            OperationType.scene_query,
            OperationType.asset_attach,
            OperationType.validate,
        }:
            current_scene = await self.store.get(scene_context.scene.id)

        ctx = PipelineContext(
            operation=operation,
            scene_context=scene_context,
            user_prompt=user_prompt,
            current_scene=current_scene,
            conversation_history=conversation_history or [],
            operation_params=operation_params or {},
        )
        return await self.pipeline.execute(ctx)


@lru_cache
def build_agent_service() -> AgentService:
    return AgentService(get_settings())


def get_agent_service() -> AgentService:
    return build_agent_service()
