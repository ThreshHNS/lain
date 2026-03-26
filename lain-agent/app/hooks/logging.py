from __future__ import annotations

from app.core.context import PipelineContext
from app.hooks.base import PostHook
from app.models.agent_response import AgentRunResponse


class UsageLoggingHook(PostHook):
    async def after(self, ctx: PipelineContext, result: AgentRunResponse) -> AgentRunResponse:
        return result

