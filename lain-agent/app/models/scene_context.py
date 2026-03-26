from __future__ import annotations

import re
from pathlib import Path, PurePosixPath

from pydantic import BaseModel, ConfigDict, Field, model_validator

SCENE_ID_RE = re.compile(r"^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?$")


def normalize_repo_relative_path(raw_path: str, *, preserve_trailing_slash: bool = True) -> str:
    candidate = raw_path.replace("\\", "/").strip()
    if not candidate:
        raise ValueError("Path cannot be empty.")

    is_directory_hint = candidate.endswith("/")
    normalized = PurePosixPath(candidate.rstrip("/")).as_posix()
    if normalized in {"", "."}:
        raise ValueError(f"Invalid repo-relative path: {raw_path!r}")
    if normalized.startswith("/") or normalized == ".." or normalized.startswith("../"):
        raise ValueError(f"Path must stay repo-relative: {raw_path!r}")

    if preserve_trailing_slash and is_directory_hint:
        return f"{normalized}/"
    return normalized


class SceneInfo(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    route: str
    engine: str
    inputModel: str
    platforms: list[str] = Field(default_factory=list)
    status: str

    @model_validator(mode="after")
    def validate_scene_metadata(self) -> "SceneInfo":
        if not SCENE_ID_RE.fullmatch(self.id):
            raise ValueError("scene.id must be lowercase and URL-safe.")
        expected_route = f"/{self.id}/"
        if self.route != expected_route:
            raise ValueError(f"scene.route must match {expected_route!r}.")
        return self


class CreativeContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fantasy: str = ""
    tone: list[str] = Field(default_factory=list)
    playerExperience: str = ""
    references: list[str] = Field(default_factory=list)


class GameplayContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    coreLoop: str = ""
    playerVerbs: list[str] = Field(default_factory=list)
    successState: str = ""
    failState: str = ""
    constraints: list[str] = Field(default_factory=list)


class PostMessageContract(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: str
    shape: str


class ContractsContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    queryParamsReadOnly: list[str] = Field(default_factory=list)
    postMessageReadOnly: PostMessageContract | None = None
    sharedFilesReadOnly: list[str] = Field(default_factory=list)


class AttachedAsset(BaseModel):
    model_config = ConfigDict(extra="forbid")

    path: str
    kind: str | None = None
    title: str | None = None
    source: str | None = None


class MissingAsset(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: str
    description: str


class AssetsContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    attached: list[AttachedAsset] = Field(default_factory=list)
    missing: list[MissingAsset] = Field(default_factory=list)
    styleRules: list[str] = Field(default_factory=list)


class FileSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    path: str
    summary: str
    snippets: list[str] = Field(default_factory=list)


class CodebaseContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    entryFiles: list[str] = Field(default_factory=list)
    writableFiles: list[str] = Field(default_factory=list)
    fileSummaries: list[FileSummary] = Field(default_factory=list)


class SessionContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    recentDecisions: list[str] = Field(default_factory=list)
    openProblems: list[str] = Field(default_factory=list)
    latestUserIntent: str = ""


class SceneContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scene: SceneInfo
    creative: CreativeContext = Field(default_factory=CreativeContext)
    gameplay: GameplayContext = Field(default_factory=GameplayContext)
    contracts: ContractsContext = Field(default_factory=ContractsContext)
    assets: AssetsContext = Field(default_factory=AssetsContext)
    codebase: CodebaseContext = Field(default_factory=CodebaseContext)
    session: SessionContext = Field(default_factory=SessionContext)

    @property
    def scenePrefix(self) -> str:
        return f"lain-scene/{self.scene.id}/"

    @property
    def sceneAssetsPrefix(self) -> str:
        return f"{self.scenePrefix}assets/"

    @property
    def normalizedWritableFiles(self) -> tuple[str, ...]:
        return tuple(normalize_repo_relative_path(path) for path in self.codebase.writableFiles)

    @property
    def normalizedSharedReadOnlyFiles(self) -> tuple[str, ...]:
        return tuple(normalize_repo_relative_path(path, preserve_trailing_slash=False) for path in self.contracts.sharedFilesReadOnly)

    @model_validator(mode="after")
    def validate_scope(self) -> "SceneContext":
        for field_name, paths in {
            "entryFiles": self.codebase.entryFiles,
            "writableFiles": self.codebase.writableFiles,
        }.items():
            for raw_path in paths:
                normalized = normalize_repo_relative_path(raw_path)
                if not normalized.startswith(self.scenePrefix):
                    raise ValueError(
                        f"codebase.{field_name} entry {raw_path!r} must stay inside {self.scenePrefix!r}."
                    )

        read_only = set(self.normalizedSharedReadOnlyFiles)
        for raw_path in self.codebase.writableFiles:
            normalized = normalize_repo_relative_path(raw_path).rstrip("/")
            if normalized in read_only:
                raise ValueError(f"Writable path {raw_path!r} conflicts with a shared read-only contract.")

        return self

    def normalizeRepoPath(self, raw_path: str, *, preserve_trailing_slash: bool = True) -> str:
        return normalize_repo_relative_path(raw_path, preserve_trailing_slash=preserve_trailing_slash)

    def resolveRepoPath(self, repo_root: Path, repo_relative_path: str) -> Path:
        normalized = self.normalizeRepoPath(repo_relative_path)
        resolved = (repo_root / normalized).resolve()
        if not resolved.is_relative_to(repo_root.resolve()):
            raise ValueError(f"Resolved path escapes the repo root: {repo_relative_path!r}")
        return resolved

    def resolveSceneTargetPath(self, raw_path: str) -> str:
        normalized = self.normalizeRepoPath(raw_path)
        if normalized.startswith("lain-scene/"):
            return normalized
        return self.normalizeRepoPath(f"{self.scenePrefix}{normalized}")

    def isWritablePath(self, repo_relative_path: str) -> bool:
        normalized = self.normalizeRepoPath(repo_relative_path)
        if normalized.rstrip("/") in set(self.normalizedSharedReadOnlyFiles):
            return False

        for writable_path in self.normalizedWritableFiles:
            if writable_path.endswith("/") and normalized.startswith(writable_path):
                return True
            if normalized == writable_path:
                return True
        return False

    def ensureWritablePath(self, repo_relative_path: str) -> str:
        normalized = self.normalizeRepoPath(repo_relative_path)
        if not self.codebase.writableFiles:
            raise ValueError("sceneContext.codebase.writableFiles is required for write operations.")
        if not self.isWritablePath(normalized):
            raise ValueError(f"Path {normalized!r} is outside the writable scene scope.")
        return normalized

    def canReadAssetSource(self, repo_relative_path: str) -> bool:
        normalized = self.normalizeRepoPath(repo_relative_path)
        return normalized.startswith("lain-scene/assets/") or normalized.startswith(self.sceneAssetsPrefix)

