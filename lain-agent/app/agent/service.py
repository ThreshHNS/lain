from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from pydantic_ai import Agent, RunContext
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openrouter import OpenRouterProvider

from app.agent.tools.add_asset import AssetAttachmentResult, add_asset
from app.agent.tools.search_assets import AssetCandidate, search_assets
from app.agent.tools.upsert_babylon_code import UpsertBabylonCodeResult, upsert_babylon_code
from app.config import Settings, get_settings
from app.models.agent_response import AgentRunResponse
from app.models.scene_context import SceneContext


@dataclass
class AgentDependencies:
    repo_root: Path
    scene_context: SceneContext


class AgentService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        prompt_path = Path(__file__).resolve().parent / "prompts" / "system.txt"
        self.system_instructions = prompt_path.read_text(encoding="utf-8")

        self.agent = Agent[AgentDependencies, AgentRunResponse](
            OpenAIChatModel(
                settings.openrouter_model,
                provider=OpenRouterProvider(api_key=settings.openrouter_api_key.get_secret_value()),
            ),
            deps_type=AgentDependencies,
            output_type=AgentRunResponse,
            instructions=self.system_instructions,
        )

        self._register_instructions()
        self._register_tools()

    def _register_instructions(self) -> None:
        @self.agent.instructions
        def inject_scene_context(ctx: RunContext[AgentDependencies]) -> str:
            scene_context = ctx.deps.scene_context
            writable_scope_note = (
                "Writable scope is empty. If the request needs file or asset writes, return needs_input."
                if not scene_context.codebase.writableFiles
                else "Writable scope is explicit. Do not write outside it."
            )
            context_json = json.dumps(scene_context.model_dump(mode="json"), ensure_ascii=True, indent=2)

            return "\n".join(
                [
                    "Current scene context JSON:",
                    context_json,
                    "",
                    "Tool reminders:",
                    "- search_assets looks only at shared assets and the active scene assets.",
                    "- add_asset copies an approved local asset into the current scene assets scope.",
                    "- upsert_babylon_code overwrites or creates one scene-local text file at a time.",
                    f"- {writable_scope_note}",
                ]
            )

    def _register_tools(self) -> None:
        @self.agent.tool
        def search_assets_tool(
            ctx: RunContext[AgentDependencies],
            query: str,
            limit: int = 5,
        ) -> list[AssetCandidate]:
            """Search the shared asset catalog and the current scene assets by filename/path keywords."""

            return search_assets(
                scene_context=ctx.deps.scene_context,
                repo_root=ctx.deps.repo_root,
                query=query,
                limit=limit,
            )

        @self.agent.tool
        def add_asset_tool(
            ctx: RunContext[AgentDependencies],
            source_path: str,
            target_path: str | None = None,
            note: str | None = None,
        ) -> AssetAttachmentResult:
            """Copy a shared or current-scene asset into the active scene's writable asset scope."""

            return add_asset(
                scene_context=ctx.deps.scene_context,
                repo_root=ctx.deps.repo_root,
                source_path=source_path,
                target_path=target_path,
                note=note,
            )

        @self.agent.tool
        def upsert_babylon_code_tool(
            ctx: RunContext[AgentDependencies],
            target_path: str,
            content: str,
            summary: str,
        ) -> UpsertBabylonCodeResult:
            """Create or overwrite a scene-local Babylon text file inside the current writable scope."""

            return upsert_babylon_code(
                scene_context=ctx.deps.scene_context,
                repo_root=ctx.deps.repo_root,
                target_path=target_path,
                content=content,
                summary=summary,
            )

    async def run(self, scene_context: SceneContext, user_prompt: str) -> AgentRunResponse:
        deps = AgentDependencies(
            repo_root=self.settings.repo_root.resolve(),
            scene_context=scene_context,
        )
        result = await self.agent.run(user_prompt, deps=deps)
        return result.output


@lru_cache
def build_agent_service() -> AgentService:
    return AgentService(get_settings())


def get_agent_service() -> AgentService:
    return build_agent_service()
