from __future__ import annotations

import re
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.scene_context import SceneContext

TOKEN_RE = re.compile(r"[a-z0-9]+")


def _tokenize(value: str) -> set[str]:
    return set(TOKEN_RE.findall(value.lower()))


def _asset_kind(path: Path) -> Literal["image", "audio", "model", "other"]:
    suffix = path.suffix.lower()
    if suffix in {".png", ".jpg", ".jpeg", ".gif", ".webp"}:
        return "image"
    if suffix in {".mp3", ".wav", ".ogg", ".m4a"}:
        return "audio"
    if suffix in {".glb", ".gltf", ".obj", ".fbx"}:
        return "model"
    return "other"


def _score_candidate(query_tokens: set[str], path_tokens: set[str], scope: str) -> tuple[int, list[str]]:
    reasons: list[str] = []
    overlap = sorted(query_tokens & path_tokens)
    score = len(overlap) * 10
    if overlap:
        reasons.append(f"matched tokens: {', '.join(overlap)}")
    if scope == "scene":
        score += 2
        reasons.append("already inside the active scene")
    return score, reasons


class AssetCandidate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    path: str
    kind: Literal["image", "audio", "model", "other"]
    sourceScope: Literal["shared", "scene"]
    score: int = Field(ge=0)
    reason: str


def search_assets(scene_context: SceneContext, repo_root: Path, query: str, limit: int = 5) -> list[AssetCandidate]:
    query_tokens = _tokenize(query)
    search_roots: list[tuple[Path, Literal["shared", "scene"]]] = []

    shared_assets = repo_root / "lain-scene" / "assets"
    if shared_assets.exists():
        search_roots.append((shared_assets, "shared"))

    scene_assets = repo_root / scene_context.sceneAssetsPrefix
    if scene_assets.exists():
        search_roots.append((scene_assets, "scene"))

    candidates: list[AssetCandidate] = []
    for root, scope in search_roots:
        for path in sorted(root.rglob("*")):
            if not path.is_file():
                continue

            repo_relative = path.relative_to(repo_root).as_posix()
            path_tokens = _tokenize(repo_relative)
            score, reasons = _score_candidate(query_tokens, path_tokens, scope)
            if query_tokens and score == (2 if scope == "scene" else 0):
                continue

            if not reasons:
                reasons.append("fallback asset candidate")

            candidates.append(
                AssetCandidate(
                    path=repo_relative,
                    kind=_asset_kind(path),
                    sourceScope=scope,
                    score=score,
                    reason="; ".join(reasons),
                )
            )

    candidates.sort(key=lambda item: (-item.score, item.path))
    return candidates[: max(limit, 1)]

