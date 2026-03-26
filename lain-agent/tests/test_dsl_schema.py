from __future__ import annotations

from app.dsl.validators import validate_scene_document

from .helpers import build_scene_document


def test_valid_scene_document_passes_semantic_validation() -> None:
    document = build_scene_document()

    diagnostics = validate_scene_document(document)

    assert diagnostics == []


def test_invalid_parent_ref_is_reported() -> None:
    document = build_scene_document()
    document.entities["enemy"].parent = "missing"

    diagnostics = validate_scene_document(document)

    assert diagnostics
    assert diagnostics[0].path == "/entities/enemy/parent"

