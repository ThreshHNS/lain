from __future__ import annotations

from enum import StrEnum

import jsonpatch
from pydantic import BaseModel, ConfigDict, Field, TypeAdapter

from app.dsl.schema import SceneDocument
from app.dsl.validators import SceneValidationError, ValidationDiagnostic, assert_valid_scene_document
from app.llm.base import parse_json_content

ALLOWED_PATCH_ROOTS = {
    "/metadata",
    "/environment",
    "/entities",
    "/materials",
    "/animations",
    "/audio",
    "/interactions",
    "/stateMachines",
    "/scripts",
}


class PatchOperationType(StrEnum):
    add = "add"
    remove = "remove"
    replace = "replace"
    move = "move"
    copy = "copy"


class PatchOperation(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    op: PatchOperationType
    path: str
    value: object | None = None
    from_: str | None = Field(default=None, alias="from")


class PatchValidationError(ValueError):
    def __init__(self, diagnostics: list[ValidationDiagnostic]) -> None:
        self.diagnostics = diagnostics
        super().__init__("\n".join(f"{item.path}: {item.message}" for item in diagnostics))


def validate_patch_operations(patch: list[PatchOperation]) -> None:
    diagnostics: list[ValidationDiagnostic] = []
    for index, operation in enumerate(patch):
        path = operation.path or ""
        if not any(path == root or path.startswith(f"{root}/") for root in ALLOWED_PATCH_ROOTS):
            diagnostics.append(
                ValidationDiagnostic(
                    path=f"/patch/{index}/path",
                    message=f"Patch path {path!r} is outside the allowed SceneDocument roots.",
                )
            )
        if path in {"", "/"}:
            diagnostics.append(
                ValidationDiagnostic(
                    path=f"/patch/{index}/path",
                    message="Root-level document replacement is not allowed.",
                )
            )
        if operation.op in {PatchOperationType.move, PatchOperationType.copy} and not operation.from_:
            diagnostics.append(
                ValidationDiagnostic(
                    path=f"/patch/{index}/from",
                    message=f"Patch op {operation.op.value!r} requires a from path.",
                )
            )

    if diagnostics:
        raise PatchValidationError(diagnostics)


def apply_scene_patch(document: SceneDocument, patch: list[PatchOperation]) -> SceneDocument:
    validate_patch_operations(patch)
    payload = document.model_dump(mode="json", by_alias=True)
    patch_payload = [item.model_dump(mode="json", by_alias=True, exclude_none=True) for item in patch]
    updated_payload = jsonpatch.JsonPatch(patch_payload).apply(payload, in_place=False)
    updated_document = SceneDocument.model_validate(updated_payload)
    assert_valid_scene_document(updated_document)
    return updated_document


PATCH_TYPE_ADAPTER = TypeAdapter(list[PatchOperation])


def parse_patch_content(content: str) -> list[PatchOperation]:
    payload = parse_json_content(content)
    return PATCH_TYPE_ADAPTER.validate_python(payload)

