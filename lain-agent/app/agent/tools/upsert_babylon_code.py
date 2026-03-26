from __future__ import annotations

import hashlib
from pathlib import Path

from pydantic import BaseModel, ConfigDict

from app.models.scene_context import SceneContext

ALLOWED_TEXT_SUFFIXES = {
    ".css",
    ".frag",
    ".glsl",
    ".html",
    ".js",
    ".json",
    ".md",
    ".txt",
    ".vert",
}


class UpsertBabylonCodeResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    path: str
    created: bool
    changed: bool
    bytesWritten: int
    summary: str
    sha256: str


def upsert_babylon_code(
    scene_context: SceneContext,
    repo_root: Path,
    target_path: str,
    content: str,
    summary: str,
) -> UpsertBabylonCodeResult:
    resolved_target = scene_context.resolveSceneTargetPath(target_path)
    normalized_target = scene_context.ensureWritablePath(resolved_target)
    if Path(normalized_target).suffix.lower() not in ALLOWED_TEXT_SUFFIXES:
        raise ValueError(f"Unsupported Babylon code file type: {normalized_target!r}")

    target_file = scene_context.resolveRepoPath(repo_root, normalized_target)
    target_file.parent.mkdir(parents=True, exist_ok=True)

    previous_content = target_file.read_text(encoding="utf-8") if target_file.exists() else None
    created = previous_content is None
    changed = previous_content != content
    target_file.write_text(content, encoding="utf-8")

    payload = content.encode("utf-8")
    return UpsertBabylonCodeResult(
        path=normalized_target,
        created=created,
        changed=changed,
        bytesWritten=len(payload) if changed else 0,
        summary=summary,
        sha256=hashlib.sha256(payload).hexdigest(),
    )

