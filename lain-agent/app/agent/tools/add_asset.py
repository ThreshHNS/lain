from __future__ import annotations

import shutil
from pathlib import Path

from pydantic import BaseModel, ConfigDict

from app.models.scene_context import SceneContext


class AssetAttachmentResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sourcePath: str
    targetPath: str
    created: bool
    bytesCopied: int
    note: str | None = None


def _resolve_target_path(scene_context: SceneContext, target_path: str | None, source_path: str) -> str:
    if target_path:
        if target_path.startswith("lain-scene/"):
            return scene_context.normalizeRepoPath(target_path)
        return scene_context.resolveSceneTargetPath(target_path)

    source_name = Path(source_path).name
    return scene_context.resolveSceneTargetPath(f"assets/{source_name}")


def add_asset(
    scene_context: SceneContext,
    repo_root: Path,
    source_path: str,
    target_path: str | None = None,
    note: str | None = None,
) -> AssetAttachmentResult:
    normalized_source = scene_context.normalizeRepoPath(source_path)
    if not scene_context.canReadAssetSource(normalized_source):
        raise ValueError(f"Asset source {normalized_source!r} is outside the shared/current-scene asset scope.")

    source_file = scene_context.resolveRepoPath(repo_root, normalized_source)
    if not source_file.is_file():
        raise ValueError(f"Asset source {normalized_source!r} does not exist.")

    resolved_target = _resolve_target_path(scene_context, target_path, normalized_source)
    normalized_target = scene_context.ensureWritablePath(resolved_target)

    target_file = scene_context.resolveRepoPath(repo_root, normalized_target)
    target_file.parent.mkdir(parents=True, exist_ok=True)
    created = not target_file.exists()
    shutil.copy2(source_file, target_file)

    return AssetAttachmentResult(
        sourcePath=normalized_source,
        targetPath=normalized_target,
        created=created,
        bytesCopied=target_file.stat().st_size,
        note=note,
    )

