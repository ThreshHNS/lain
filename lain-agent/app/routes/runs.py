from __future__ import annotations

from fastapi import APIRouter, Depends

from app.agent.service import AgentService, get_agent_service
from app.models.agent_response import AgentRunResponse
from app.models.operations import RunRequest

router = APIRouter()


@router.post("/runs", response_model=AgentRunResponse)
async def run_agent(
    request: RunRequest,
    service: AgentService = Depends(get_agent_service),
) -> AgentRunResponse:
    return await service.run(
        operation=request.operation,
        scene_context=request.sceneContext,
        user_prompt=request.userPrompt,
        current_scene=request.currentScene,
        conversation_history=request.conversationHistory,
        operation_params=request.operationParams,
    )
