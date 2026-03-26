from __future__ import annotations

import re
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.tools.base import ToolContext, ToolResult
from app.tools.registry import register_tool

TOKEN_RE = re.compile(r"[a-z0-9]+")


def _tokenize(value: str) -> set[str]:
    return set(TOKEN_RE.findall(value.lower()))


class AssetCandidate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    path: str
    kind: Literal["image", "audio", "model", "other"]
    sourceScope: Literal["shared", "scene"]
    score: int = Field(ge=0)
    reason: str


def _asset_kind(path: Path) -> Literal["image", "audio", "model", "other"]:
    suffix = path.suffix.lower()
    if suffix in {".png", ".jpg", ".jpeg", ".gif", ".webp"}:
        return "image"
    if suffix in {".mp3", ".wav", ".ogg", ".m4a"}:
        return "audio"
    if suffix in {".glb", ".gltf", ".obj", ".fbx"}:
        return "model"
    return "other"


@register_tool
class AssetSearchTool:
    name = "asset.search"
    description = "Search the shared asset catalog and the active scene assets."
    parameters_schema = {
        "type": "object",
        "properties": {
            "query": {"type": "string"},
            "limit": {"type": "integer", "minimum": 1, "maximum": 20},
        },
        "required": ["query"],
        "additionalProperties": False,
    }

    async def execute(self, ctx: ToolContext, params: dict) -> ToolResult:
        query = str(params.get("query") or params.get("user_prompt") or "").strip()
        limit = max(1, min(int(params.get("limit", 5)), 20))
        query_tokens = _tokenize(query)

        search_roots: list[tuple[Path, Literal["shared", "scene"]]] = []
        shared_assets = ctx.repo_root / "lain-scene" / "assets"
        if shared_assets.exists():
            search_roots.append((shared_assets, "shared"))

        scene_assets = ctx.repo_root / ctx.scene_context.sceneAssetsPrefix
        if scene_assets.exists():
            search_roots.append((scene_assets, "scene"))

        candidates: list[AssetCandidate] = []
        for root, scope in search_roots:
            for path in sorted(root.rglob("*")):
                if not path.is_file():
                    continue

                repo_relative = path.relative_to(ctx.repo_root).as_posix()
                path_tokens = _tokenize(repo_relative)
                overlap = sorted(query_tokens & path_tokens)
                score = len(overlap) * 10 + (2 if scope == "scene" else 0)
                if query_tokens and not overlap:
                    continue
                reason_parts = [f"matched tokens: {', '.join(overlap)}"] if overlap else ["fallback asset candidate"]
                if scope == "scene":
                    reason_parts.append("already inside the active scene")

                candidates.append(
                    AssetCandidate(
                        path=repo_relative,
                        kind=_asset_kind(path),
                        sourceScope=scope,
                        score=score,
                        reason="; ".join(reason_parts),
                    )
                )

        candidates.sort(key=lambda item: (-item.score, item.path))
        payload = {
            "candidates": [item.model_dump(mode="json") for item in candidates[:limit]],
        }
        return ToolResult(
            tool=self.name,
            summary=f"Found {len(payload['candidates'])} matching assets.",
            payload=payload,
        )
