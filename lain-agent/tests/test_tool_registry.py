from __future__ import annotations

from app.tools.registry import ToolRegistry

import app.tools.asset_attach  # noqa: F401
import app.tools.asset_search  # noqa: F401
import app.tools.scene_create  # noqa: F401
import app.tools.scene_patch  # noqa: F401
import app.tools.scene_query  # noqa: F401
import app.tools.validate  # noqa: F401


def test_registry_loads_registered_tools() -> None:
    registry = ToolRegistry()
    registry.load_registered()

    names = {tool.name for tool in registry.list()}

    assert "scene.create" in names
    assert "scene.patch" in names
    assert "scene.query" in names
    assert "asset.search" in names
    assert "asset.attach" in names
    assert "validate" in names

