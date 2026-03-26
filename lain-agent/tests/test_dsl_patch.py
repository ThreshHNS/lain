from __future__ import annotations

import pytest

from app.dsl.patch import PatchOperation, PatchOperationType, PatchValidationError, apply_scene_patch

from .helpers import build_scene_document


def test_apply_scene_patch_updates_targeted_field() -> None:
    document = build_scene_document()
    patch = [
        PatchOperation(op=PatchOperationType.replace, path="/entities/enemy/position/z", value=5),
    ]

    updated = apply_scene_patch(document, patch)

    assert updated.entities["enemy"].position.z == 5


def test_patch_rejects_root_level_replace() -> None:
    document = build_scene_document()
    patch = [
        PatchOperation(op=PatchOperationType.replace, path="/", value={}),
    ]

    with pytest.raises(PatchValidationError):
        apply_scene_patch(document, patch)

