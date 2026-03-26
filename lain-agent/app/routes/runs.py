from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from app.agent.service import AgentService, get_agent_service
from app.models.agent_response import AgentRunResponse
from app.models.scene_context import SceneContext

router = APIRouter()


class RunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sceneContext: SceneContext
    userPrompt: str = Field(min_length=1)


@router.post("/runs", response_model=AgentRunResponse)
async def run_agent(
    request: RunRequest,
    service: AgentService = Depends(get_agent_service),
) -> AgentRunResponse:
    return await service.run(
        scene_context=request.sceneContext,
        user_prompt=request.userPrompt,
    )

