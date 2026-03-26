from __future__ import annotations

import asyncio

from app.core.context import PipelineContext
from app.core.operations import OperationType
from app.core.pipeline import Pipeline
from app.tools.registry import ToolRegistry

import app.tools.scene_create  # noqa: F401
import app.tools.scene_patch  # noqa: F401

from .helpers import FakeLLMProvider, build_scene_context, build_scene_document, seed_repo


def build_pipeline(fake_llm, repo_root) -> Pipeline:
    registry = ToolRegistry()
    registry.load_registered()
    return Pipeline(
        llm=fake_llm,
        tool_registry=registry,
        repo_root=repo_root,
        store=None,
        prompts={
            "system": "base rules",
            "scene_create": "Scene context:\n{{SCENE_CONTEXT_JSON}}\nFeedback:\n{{VALIDATION_FEEDBACK_JSON}}",
            "scene_patch": "Scene context:\n{{SCENE_CONTEXT_JSON}}\nScene:\n{{CURRENT_SCENE_JSON}}\nFeedback:\n{{VALIDATION_FEEDBACK_JSON}}",
            "scene_query": "Scene context:\n{{SCENE_CONTEXT_JSON}}\nScene:\n{{CURRENT_SCENE_JSON}}",
        },
        max_retries=2,
    )


def test_pipeline_retries_invalid_scene_create(tmp_path) -> None:
    repo_root = seed_repo(tmp_path)
    invalid_doc = build_scene_document().model_dump(mode="json", by_alias=True)
    invalid_doc["metadata"]["id"] = "wrong-scene"
    valid_doc = build_scene_document().model_dump(mode="json", by_alias=True)
    llm = FakeLLMProvider([invalid_doc, valid_doc])
    pipeline = build_pipeline(llm, repo_root)

    result = asyncio.run(
        pipeline.execute(
            PipelineContext(
                scene_context=build_scene_context(),
                user_prompt="Make a slasher corridor scene.",
                operation=OperationType.scene_create,
            )
        )
    )

    assert result.status == "completed"
    assert result.sceneDocument is not None
    assert result.sceneDocument.metadata.id == "slasher"
    assert llm.calls == 2


def test_pipeline_returns_patch_and_updated_document(tmp_path) -> None:
    repo_root = seed_repo(tmp_path)
    llm = FakeLLMProvider(
        [
            [
                {"op": "replace", "path": "/entities/enemy/position/z", "value": 7},
            ]
        ]
    )
    pipeline = build_pipeline(llm, repo_root)

    result = asyncio.run(
        pipeline.execute(
            PipelineContext(
                scene_context=build_scene_context(),
                user_prompt="Move the enemy deeper into the corridor.",
                operation=OperationType.scene_patch,
                current_scene=build_scene_document(),
            )
        )
    )

    assert result.status == "completed"
    assert result.patch
    assert result.sceneDocument is not None
    assert result.sceneDocument.entities["enemy"].position.z == 7
