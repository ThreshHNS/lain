from __future__ import annotations

import shutil
from pathlib import Path

from pydantic import BaseModel, ConfigDict

from app.tools.base import ToolContext, ToolNeedsInputError, ToolResult
from app.tools.registry import register_tool


class AssetAttachmentResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sourcePath: str
    targetPath: str
    created: bool
    bytesCopied: int
    note: str | None = None


@register_tool
class AssetAttachTool:
    name = "asset.attach"
    description = "Copy a shared asset into the active scene asset scope."
    parameters_schema = {
        "type": "object",
        "properties": {
            "source_path": {"type": "string"},
            "target_path": {"type": "string"},
            "note": {"type": "string"},
        },
        "required": ["source_path"],
        "additionalProperties": False,
    }

    async def execute(self, ctx: ToolContext, params: dict) -> ToolResult:
        if not ctx.scene_context.codebase.writableFiles:
            raise ToolNeedsInputError(
                missing_inputs=[
                    {
                        "field": "sceneContext.codebase.writableFiles",
                        "reason": "Writable scope is required before copying an asset into the scene.",
                    }
                ]
            )

        source_path = ctx.scene_context.normalizeRepoPath(str(params["source_path"]))
        target_path = params.get("target_path")
        note = params.get("note")

        if not ctx.scene_context.canReadAssetSource(source_path):
            raise ValueError(f"Asset source {source_path!r} is outside the shared/current-scene asset scope.")

        source_file = ctx.scene_context.resolveRepoPath(ctx.repo_root, source_path)
        if not source_file.is_file():
            raise ValueError(f"Asset source {source_path!r} does not exist.")

        if target_path:
            if str(target_path).startswith("lain-scene/"):
                resolved_target = ctx.scene_context.normalizeRepoPath(str(target_path))
            else:
                resolved_target = ctx.scene_context.resolveSceneTargetPath(str(target_path))
        else:
            resolved_target = ctx.scene_context.resolveSceneTargetPath(f"assets/{Path(source_path).name}")

        normalized_target = ctx.scene_context.ensureWritablePath(resolved_target)
        target_file = ctx.scene_context.resolveRepoPath(ctx.repo_root, normalized_target)
        target_file.parent.mkdir(parents=True, exist_ok=True)
        created = not target_file.exists()
        shutil.copy2(source_file, target_file)

        result = AssetAttachmentResult(
            sourcePath=source_path,
            targetPath=normalized_target,
            created=created,
            bytesCopied=target_file.stat().st_size,
            note=note,
        )
        return ToolResult(
            tool=self.name,
            summary=f"Copied asset into {normalized_target}.",
            payload={"attachment": result.model_dump(mode="json")},
        )

