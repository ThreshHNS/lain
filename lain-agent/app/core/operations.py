from __future__ import annotations

from enum import StrEnum


class OperationType(StrEnum):
    scene_create = "scene.create"
    scene_patch = "scene.patch"
    scene_query = "scene.query"
    asset_search = "asset.search"
    asset_attach = "asset.attach"
    validate = "validate"

    @property
    def is_mutating(self) -> bool:
        return self in {
            OperationType.scene_create,
            OperationType.scene_patch,
            OperationType.asset_attach,
        }

