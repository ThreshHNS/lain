from __future__ import annotations

from typing import TypeVar

from app.tools.base import Tool

REGISTERED_TOOL_TYPES: list[type[Tool]] = []
ToolType = TypeVar("ToolType", bound=type[Tool])


def register_tool(tool_type: ToolType) -> ToolType:
    REGISTERED_TOOL_TYPES.append(tool_type)
    return tool_type


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool) -> None:
        self._tools[tool.name] = tool

    def load_registered(self) -> None:
        for tool_type in REGISTERED_TOOL_TYPES:
            self.register(tool_type())

    def get(self, name: str) -> Tool:
        return self._tools[name]

    def list(self) -> list[Tool]:
        return list(self._tools.values())

    def schemas(self) -> dict[str, dict]:
        return {tool.name: tool.parameters_schema for tool in self._tools.values()}

