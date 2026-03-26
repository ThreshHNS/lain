from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.agent.service import AgentService, get_agent_service
from app.dsl.validators import validate_scene_document
from app.models.operations import SceneSaveRequest, SceneValidateRequest

router = APIRouter(prefix="/scenes", tags=["scenes"])


@router.get("/{scene_id}")
async def get_scene(scene_id: str, service: AgentService = Depends(get_agent_service)) -> dict:
    document = await service.store.get(scene_id)
    if document is None:
        raise HTTPException(status_code=404, detail="SceneDocument not found.")
    return document.model_dump(mode="json", by_alias=True)


@router.put("/{scene_id}")
async def save_scene(
    scene_id: str,
    request: SceneSaveRequest,
    service: AgentService = Depends(get_agent_service),
) -> dict:
    if request.document.metadata.id != scene_id:
        raise HTTPException(status_code=400, detail="Scene id mismatch.")
    path = await service.store.save(request.document)
    return {"sceneId": scene_id, "path": path.relative_to(service.store.repo_root).as_posix()}


@router.post("/{scene_id}/validate")
async def validate_scene(
    scene_id: str,
    request: SceneValidateRequest,
    service: AgentService = Depends(get_agent_service),
) -> dict:
    if request.document.metadata.id != scene_id:
        raise HTTPException(status_code=400, detail="Scene id mismatch.")
    diagnostics = validate_scene_document(request.document)
    return {
        "sceneId": scene_id,
        "valid": not diagnostics,
        "diagnostics": [item.model_dump(mode="json") for item in diagnostics],
    }
