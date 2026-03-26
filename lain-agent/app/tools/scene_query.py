from __future__ import annotations

from app.llm.base import Message, MessageRole
from app.tools.base import ToolContext, ToolResult, dump_json, render_prompt
from app.tools.registry import register_tool


@register_tool
class SceneQueryTool:
    name = "scene.query"
    description = "Answer read-only questions about the current scene context or SceneDocument."
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
        current_scene_json = dump_json(
            ctx.current_scene.model_dump(mode="json", by_alias=True) if ctx.current_scene is not None else None
        )
        system_prompt = "\n\n".join(
            [
                ctx.prompts["system"],
                render_prompt(
                    ctx.prompts["scene_query"],
                    scene_context_json=scene_context_json,
                    current_scene_json=current_scene_json,
                    validation_feedback_json="[]",
                ),
            ]
        )
        messages = [
            Message(role=MessageRole.system, content=system_prompt),
            *ctx.conversation_history,
            Message(role=MessageRole.user, content=str(params["user_prompt"])),
        ]
        response = await ctx.llm.complete(messages)
        return ToolResult(
            tool=self.name,
            summary="Answered a read-only scene query.",
            payload={"answer": response.content.strip()},
            usage=response.usage,
        )

