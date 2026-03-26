from __future__ import annotations

from app.dsl.patch import PatchOperation, apply_scene_patch
from app.dsl.schema import SceneDocument
from app.dsl.validators import assert_valid_scene_document, validate_scene_document
from app.tools.base import ToolContext, ToolNeedsInputError, ToolResult
from app.tools.registry import register_tool


@register_tool
class ValidateTool:
    name = "validate"
    description = "Validate a SceneDocument or a JSON Patch against schema and semantic rules."
    parameters_schema = {
        "type": "object",
        "properties": {
            "document": {"type": "object"},
            "patch": {"type": "array"},
        },
        "additionalProperties": False,
    }

    async def execute(self, ctx: ToolContext, params: dict) -> ToolResult:
        document_payload = params.get("document")
        patch_payload = params.get("patch")

        if document_payload is not None:
            document = SceneDocument.model_validate(document_payload)
            diagnostics = validate_scene_document(document)
            return ToolResult(
                tool=self.name,
                summary="Validated SceneDocument payload.",
                payload={"valid": not diagnostics},
                diagnostics=diagnostics,
            )

        if patch_payload is not None:
            if ctx.current_scene is None:
                raise ToolNeedsInputError(
                    missing_inputs=[
                        {
                            "field": "currentScene",
                            "reason": "Patch validation requires the current SceneDocument.",
                        }
                    ]
                )
            patch = [PatchOperation.model_validate(item) for item in patch_payload]
            updated = apply_scene_patch(ctx.current_scene, patch)
            return ToolResult(
                tool=self.name,
                summary="Validated patch against the current SceneDocument.",
                payload={"document": updated.model_dump(mode="json", by_alias=True), "valid": True},
            )

        if ctx.current_scene is not None:
            assert_valid_scene_document(ctx.current_scene)
            return ToolResult(
                tool=self.name,
                summary="Validated current SceneDocument.",
                payload={"valid": True},
            )

        raise ToolNeedsInputError(
            missing_inputs=[
                {
                    "field": "document",
                    "reason": "Provide a document payload or currentScene for validation.",
                }
            ]
        )

