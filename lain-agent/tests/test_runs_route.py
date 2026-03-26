from __future__ import annotations

from fastapi.testclient import TestClient

from app.agent.service import get_agent_service
from app.core.operations import OperationType
from app.main import create_app
from app.models.agent_response import AgentRunResponse, RunStatus

from .helpers import build_scene_context, build_scene_document


class StubAgentService:
    async def run(self, **kwargs):  # noqa: ANN003
        return AgentRunResponse(
            status=RunStatus.completed,
            operation=kwargs["operation"] or OperationType.scene_query,
            summary="Handled operation.",
            userFacingMessage="Handled operation.",
            sceneDocument=kwargs.get("current_scene"),
        )


def test_runs_route_accepts_operation_and_current_scene() -> None:
    app = create_app()
    app.dependency_overrides[get_agent_service] = lambda: StubAgentService()
    client = TestClient(app)

    payload = {
        "operation": "scene.query",
        "sceneContext": build_scene_context().model_dump(mode="json"),
        "currentScene": build_scene_document().model_dump(mode="json", by_alias=True),
        "userPrompt": "Describe the current scene.",
        "conversationHistory": [],
        "operationParams": {},
    }

    response = client.post("/runs", json=payload)

    assert response.status_code == 200
    assert response.json()["operation"] == "scene.query"

