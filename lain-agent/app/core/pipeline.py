from __future__ import annotations

from app.core.context import PipelineContext
from app.core.operations import OperationType
from app.dsl.patch import PatchOperation
from app.dsl.schema import SceneDocument
from app.dsl.validators import SceneValidationError
from app.hooks.base import PostHook, PreHook
from app.models.agent_response import AgentRunResponse, MissingInput, RunStatus, ToolExecutionRecord
from app.tools.base import ToolContext, ToolNeedsInputError
from app.tools.registry import ToolRegistry


class Pipeline:
    def __init__(
        self,
        *,
        llm,
        tool_registry: ToolRegistry,
        repo_root,
        store,
        prompts: dict[str, str],
        pre_hooks: list[PreHook] | None = None,
        post_hooks: list[PostHook] | None = None,
        max_retries: int = 2,
    ) -> None:
        self.llm = llm
        self.tool_registry = tool_registry
        self.repo_root = repo_root
        self.store = store
        self.prompts = prompts
        self.pre_hooks = pre_hooks or []
        self.post_hooks = post_hooks or []
        self.max_retries = max_retries

    async def execute(self, ctx: PipelineContext) -> AgentRunResponse:
        for hook in self.pre_hooks:
            ctx = await hook.before(ctx)

        operation = ctx.operation or self.classify_operation(ctx)
        tool = self.tool_registry.get(operation.value)
        attempts = self.max_retries + 1
        last_validation_error: SceneValidationError | None = None

        for attempt in range(attempts):
            try:
                params = dict(ctx.operation_params)
                if "user_prompt" not in params:
                    params["user_prompt"] = ctx.user_prompt
                if operation is OperationType.asset_search and "query" not in params:
                    params["query"] = ctx.user_prompt
                tool_ctx = ToolContext(
                    llm=self.llm,
                    repo_root=self.repo_root,
                    scene_context=ctx.scene_context,
                    current_scene=ctx.current_scene,
                    conversation_history=ctx.conversation_history,
                    metadata=ctx.metadata,
                    prompts=self.prompts,
                    store=self.store,
                )
                tool_result = await tool.execute(tool_ctx, params)
                response = self._build_response(operation, tool_result)
                for hook in self.post_hooks:
                    response = await hook.after(ctx, response)
                return response
            except ToolNeedsInputError as exc:
                response = AgentRunResponse(
                    status=RunStatus.needs_input,
                    operation=operation,
                    summary=str(exc),
                    userFacingMessage=str(exc),
                    missingInputs=[MissingInput.model_validate(item) for item in exc.missing_inputs],
                )
                for hook in self.post_hooks:
                    response = await hook.after(ctx, response)
                return response
            except SceneValidationError as exc:
                last_validation_error = exc
                if attempt == attempts - 1:
                    break
                ctx.metadata["validation_feedback"] = [item.model_dump(mode="json") for item in exc.diagnostics]

        diagnostics = last_validation_error.diagnostics if last_validation_error else []
        response = AgentRunResponse(
            status=RunStatus.blocked,
            operation=operation,
            summary="The generated scene output failed validation.",
            userFacingMessage="The generated scene output failed validation.",
            diagnostics=diagnostics,
        )
        for hook in self.post_hooks:
            response = await hook.after(ctx, response)
        return response

    def classify_operation(self, ctx: PipelineContext) -> OperationType:
        prompt = ctx.user_prompt.lower()
        if "validate" in prompt:
            return OperationType.validate
        if "asset" in prompt and ("find" in prompt or "search" in prompt):
            return OperationType.asset_search
        if "asset" in prompt and ("attach" in prompt or "copy" in prompt):
            return OperationType.asset_attach
        if ctx.current_scene is None:
            return OperationType.scene_create
        if any(word in prompt for word in ["patch", "change", "update", "move", "replace", "add", "remove"]):
            return OperationType.scene_patch
        return OperationType.scene_query

    def _build_response(self, operation: OperationType, tool_result) -> AgentRunResponse:
        payload = tool_result.payload
        scene_document = None
        if "document" in payload:
            scene_document = SceneDocument.model_validate(payload["document"])
        patch = [PatchOperation.model_validate(item) for item in payload.get("patch", [])]
        answer = payload.get("answer")
        summary = tool_result.summary
        user_facing_message = tool_result.summary
        if answer:
            user_facing_message = answer

        return AgentRunResponse(
            status=RunStatus.completed,
            operation=operation,
            summary=summary,
            userFacingMessage=user_facing_message,
            sceneDocument=scene_document,
            patch=patch,
            answer=answer,
            toolResults=[
                ToolExecutionRecord(
                    tool=tool_result.tool,
                    summary=tool_result.summary,
                    payload=payload,
                )
            ],
            diagnostics=tool_result.diagnostics,
            usage=tool_result.usage,
        )
