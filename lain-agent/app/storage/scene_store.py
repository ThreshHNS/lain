from __future__ import annotations

import json
from pathlib import Path

from app.dsl.schema import SceneDocument


class SceneStore:
    def __init__(self, repo_root: Path) -> None:
        self.repo_root = repo_root

    def scene_path(self, scene_id: str) -> Path:
        return self.repo_root / "lain-scene" / scene_id / "scene.json"

    async def get(self, scene_id: str) -> SceneDocument | None:
        path = self.scene_path(scene_id)
        if not path.is_file():
            return None
        return SceneDocument.model_validate_json(path.read_text(encoding="utf-8"))

    async def save(self, document: SceneDocument) -> Path:
        path = self.scene_path(document.metadata.id)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(document.model_dump(mode="json", by_alias=True), ensure_ascii=True, indent=2) + "\n",
            encoding="utf-8",
        )
        return path

    async def list_scenes(self) -> list[str]:
        scene_root = self.repo_root / "lain-scene"
        results: list[str] = []
        if not scene_root.exists():
            return results
        for path in sorted(scene_root.iterdir()):
            if path.is_dir() and (path / "scene.json").is_file():
                results.append(path.name)
        return results

