from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.models.scene_context import SceneContext


def build_scene_context(**overrides):
    payload = {
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
    for key, value in overrides.items():
        payload[key] = value
    return SceneContext.model_validate(payload)


def test_rejects_writable_scope_outside_scene() -> None:
    with pytest.raises(ValidationError):
        build_scene_context(
            codebase={
                "entryFiles": ["lain-scene/slasher/main.js"],
                "writableFiles": ["lain-scene/awp/main.js"],
                "fileSummaries": [],
            }
        )


def test_directory_writable_scope_allows_new_asset_paths() -> None:
    context = build_scene_context()

    assert context.isWritablePath("lain-scene/slasher/assets/enemy.png") is True
    assert context.isWritablePath("lain-scene/index.html") is False

