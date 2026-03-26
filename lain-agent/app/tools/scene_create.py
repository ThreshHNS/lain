from __future__ import annotations

from app.dsl.schema import SceneDocument
from app.dsl.validators import assert_document_matches_scene_context, assert_valid_scene_document
from app.tools.base import (
    ToolContext,
    ToolResult,
    build_json_response_format,
    dump_json,
    parse_json_content,
    render_prompt,
)
from app.tools.registry import register_tool
from app.llm.base import Message, MessageRole


@register_tool
class SceneCreateTool:
    name = "scene.create"
    description = "Generate a full SceneDocument from the current scene context and a user request."
    parameters_schema = {
        "type": "object",
        "properties": {
            "user_prompt": {"type": "string"},
        },
        "required": ["user_prompt"],
        "additionalProperties": False,
    }

    async def execute(self, ctx: ToolContext, params: dict) -> ToolResult:
        scene_context_json = dump_json(ctx.scene_context.model_dump(mode="json"))
        validation_feedback_json = dump_json(ctx.metadata.get("validation_feedback", []))
        system_prompt = "\n\n".join(
            [
                ctx.prompts["system"],
                render_prompt(
                    ctx.prompts["scene_create"],
                    scene_context_json=scene_context_json,
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
            response_format=build_json_response_format("scene_document", SceneDocument.model_json_schema()),
        )
        payload = parse_json_content(response.content)
        document = SceneDocument.model_validate(payload)
        assert_document_matches_scene_context(document, ctx.scene_context)
        assert_valid_scene_document(document)
        return ToolResult(
            tool=self.name,
            summary=f"Generated SceneDocument for scene {document.metadata.id}.",
            payload={"document": document.model_dump(mode="json", by_alias=True)},
            usage=response.usage,
        )

