from __future__ import annotations

import json
from pathlib import Path

from app.dsl.schema import (
    Color4,
    Environment,
    MeshEntity,
    SceneDocument,
    SceneMetadata,
)
from app.llm.base import LLMResponse, LLMProvider, TokenUsage
from app.models.scene_context import SceneContext


def build_scene_context() -> SceneContext:
    return SceneContext.model_validate(
        {
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
        }
    )


def build_scene_document() -> SceneDocument:
    return SceneDocument(
        metadata=SceneMetadata(
            id="slasher",
            title="Slasher",
            engine="dsl-runtime",
            inputModel="hold",
            platforms=["web", "ios-webview"],
            status="draft",
        ),
        environment=Environment(clearColor=Color4(r=0.01, g=0.01, b=0.02, a=1)),
        entities={
            "ground": MeshEntity(id="ground", shape="ground", width=12, height=12),
            "enemy": MeshEntity(id="enemy", shape="box", position={"x": 0, "y": 1, "z": 2}),
        },
    )


class FakeLLMProvider(LLMProvider):
    def __init__(self, responses: list[object]) -> None:
        self._responses = list(responses)
        self.calls = 0

    @property
    def model_name(self) -> str:
        return "fake/test-model"

    async def complete(self, messages, *, temperature=None, max_tokens=None, response_format=None) -> LLMResponse:  # noqa: ANN001
        self.calls += 1
        payload = self._responses.pop(0)
        content = payload if isinstance(payload, str) else json.dumps(payload)
        return LLMResponse(
            content=content,
            usage=TokenUsage(promptTokens=10, completionTokens=20, totalTokens=30),
        )


def seed_repo(tmp_path: Path) -> Path:
    (tmp_path / "lain-scene" / "assets" / "sprites").mkdir(parents=True)
    (tmp_path / "lain-scene" / "slasher").mkdir(parents=True)
    (tmp_path / "lain-scene" / "slasher" / "main.js").write_text("console.log('old');\n", encoding="utf-8")
    (tmp_path / "lain-scene" / "slasher" / "index.html").write_text("<html></html>\n", encoding="utf-8")
    (tmp_path / "lain-scene" / "assets" / "sprites" / "knife.png").write_bytes(b"knife")
    return tmp_path

