from __future__ import annotations

from pathlib import Path

import pytest

from app.agent.tools.add_asset import add_asset
from app.agent.tools.search_assets import search_assets
from app.agent.tools.upsert_babylon_code import upsert_babylon_code
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


def seed_repo(tmp_path: Path) -> Path:
    (tmp_path / "lain-scene" / "assets" / "sprites").mkdir(parents=True)
    (tmp_path / "lain-scene" / "slasher").mkdir(parents=True)
    (tmp_path / "lain-scene" / "slasher" / "main.js").write_text("console.log('old');\n", encoding="utf-8")
    (tmp_path / "lain-scene" / "slasher" / "index.html").write_text("<html></html>\n", encoding="utf-8")
    (tmp_path / "lain-scene" / "assets" / "sprites" / "knife.png").write_bytes(b"knife")
    return tmp_path


def test_search_assets_prefers_matching_shared_assets(tmp_path: Path) -> None:
    repo_root = seed_repo(tmp_path)
    context = build_scene_context()

    results = search_assets(context, repo_root, query="knife sprite", limit=3)

    assert results
    assert results[0].path == "lain-scene/assets/sprites/knife.png"


def test_add_asset_copies_shared_asset_into_scene_scope(tmp_path: Path) -> None:
    repo_root = seed_repo(tmp_path)
    context = build_scene_context()

    result = add_asset(
        context,
        repo_root,
        source_path="lain-scene/assets/sprites/knife.png",
        target_path="assets/enemy-knife.png",
    )

    assert result.targetPath == "lain-scene/slasher/assets/enemy-knife.png"
    assert (repo_root / result.targetPath).read_bytes() == b"knife"


def test_upsert_babylon_code_rejects_shared_contract_path(tmp_path: Path) -> None:
    repo_root = seed_repo(tmp_path)
    context = build_scene_context()

    with pytest.raises(ValueError):
        upsert_babylon_code(
            context,
            repo_root,
            target_path="lain-scene/index.html",
            content="<html>bad</html>",
            summary="bad write",
        )

