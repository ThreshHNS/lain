from __future__ import annotations

from typing import Protocol

from app.core.context import PipelineContext
from app.models.agent_response import AgentRunResponse


class PreHook(Protocol):
    async def before(self, ctx: PipelineContext) -> PipelineContext: ...


class PostHook(Protocol):
    async def after(self, ctx: PipelineContext, result: AgentRunResponse) -> AgentRunResponse: ...

