from __future__ import annotations

from app.dsl.patch import PATCH_TYPE_ADAPTER, apply_scene_patch, parse_patch_content
from app.dsl.schema import SceneDocument
from app.dsl.validators import assert_document_matches_scene_context
from app.llm.base import Message, MessageRole, build_json_response_format
from app.models.agent_response import MissingInput
from app.tools.base import ToolContext, ToolNeedsInputError, ToolResult, dump_json, render_prompt
from app.tools.registry import register_tool


@register_tool
class ScenePatchTool:
    name = "scene.patch"
    description = "Generate an RFC 6902 JSON Patch for the current SceneDocument."
    parameters_schema = {
        "type": "object",
        "properties": {
            "user_prompt": {"type": "string"},
        },
        "required": ["user_prompt"],
        "additionalProperties": False,
    }

    async def execute(self, ctx: ToolContext, params: dict) -> ToolResult:
        if ctx.current_scene is None:
            raise ToolNeedsInputError(
                missing_inputs=[
                    MissingInput(
                        field="currentScene",
                        reason="scene.patch requires the current SceneDocument.",
                    )
                ]
            )

        scene_context_json = dump_json(ctx.scene_context.model_dump(mode="json"))
        current_scene_json = dump_json(ctx.current_scene.model_dump(mode="json", by_alias=True))
        validation_feedback_json = dump_json(ctx.metadata.get("validation_feedback", []))
        system_prompt = "\n\n".join(
            [
                ctx.prompts["system"],
                render_prompt(
                    ctx.prompts["scene_patch"],
                    scene_context_json=scene_context_json,
                    current_scene_json=current_scene_json,
                    validation_feedback_json=validation_feedback_json,
                ),
            ]
        )
        messages = [
            Message(role=MessageRole.system, content=system_prompt),
            *ctx.conversation_history,
            Message(role=MessageRole.user, content=str(params["user_prompt"])),
        ]
        response = await ctx.llm.complete(
            messages,
            response_format=build_json_response_format("scene_patch", PATCH_TYPE_ADAPTER.json_schema()),
        )
        patch = parse_patch_content(response.content)
        updated_document = apply_scene_patch(ctx.current_scene, patch)
        assert_document_matches_scene_context(updated_document, ctx.scene_context)
        return ToolResult(
            tool=self.name,
            summary=f"Generated {len(patch)} patch operations.",
            payload={
                "patch": [item.model_dump(mode="json", by_alias=True, exclude_none=True) for item in patch],
                "document": updated_document.model_dump(mode="json", by_alias=True),
            },
            usage=response.usage,
        )

