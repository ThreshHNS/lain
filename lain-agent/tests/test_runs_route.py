from __future__ import annotations

from fastapi.testclient import TestClient

from app.agent.service import get_agent_service
from app.main import create_app
from app.models.agent_response import AgentMode, AgentRunResponse, AgentStatus


class StubAgentService:
    async def run(self, scene_context, user_prompt):  # noqa: ANN001
        return AgentRunResponse(
            status=AgentStatus.completed,
            mode=AgentMode.scene_direction,
            summary=f"Handled {scene_context.scene.id}",
            userFacingMessage=f"Prompt received: {user_prompt}",
            toolPlan=[],
            changes=[],
            missingInputs=[],
        )


def test_runs_route_returns_structured_response() -> None:
    app = create_app()
    app.dependency_overrides[get_agent_service] = lambda: StubAgentService()
    client = TestClient(app)

    payload = {
        "sceneContext": {
            "scene": {
                "id": "slasher",
                "title": "Slasher",
                "route": "/slasher/",
                "engine": "babylonjs",
                "inputModel": "hold",
                "platforms": ["web", "ios-webview"],
                "status": "draft",
            },
            "creative": {
                "fantasy": "cold pursuit in a corridor",
                "tone": ["cold", "psx"],
                "playerExperience": "short aggressive movement windows",
                "references": ["ps1 horror"],
            },
            "gameplay": {
                "coreLoop": "move, slash, survive",
                "playerVerbs": ["move", "slash"],
                "successState": "enemy dies",
                "failState": "player hp reaches zero",
                "constraints": ["mobile readable"],
            },
            "contracts": {
                "queryParamsReadOnly": ["mode", "embedded"],
                "postMessageReadOnly": {"type": "scene-state", "shape": "{ type: string, state: object }"},
                "sharedFilesReadOnly": [
                    "lain-scene/index.html",
                    "lain-scene/mode-switcher.js",
                    "lain-scene/mode-switcher.css",
                ],
            },
            "assets": {
                "attached": [],
                "missing": [],
                "styleRules": [],
            },
            "codebase": {
                "entryFiles": [
                    "lain-scene/slasher/index.html",
                    "lain-scene/slasher/main.js",
                ],
                "writableFiles": [
                    "lain-scene/slasher/index.html",
                    "lain-scene/slasher/main.js",
                    "lain-scene/slasher/assets/",
                ],
                "fileSummaries": [],
            },
            "session": {
                "recentDecisions": [],
                "openProblems": [],
                "latestUserIntent": "Make the attack feel heavier.",
            },
        },
        "userPrompt": "Make the hit reaction stronger.",
    }

    response = client.post("/runs", json=payload)

    assert response.status_code == 200
    assert response.json()["mode"] == "scene_direction"
