from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class Vector3(BaseModel):
    model_config = ConfigDict(extra="forbid")

    x: float = 0
    y: float = 0
    z: float = 0


class Color3(BaseModel):
    model_config = ConfigDict(extra="forbid")

    r: float
    g: float
    b: float


class Color4(BaseModel):
    model_config = ConfigDict(extra="forbid")

    r: float
    g: float
    b: float
    a: float = 1


class SceneMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    engine: str = "dsl-runtime"
    inputModel: str
    platforms: list[str] = Field(default_factory=list)
    status: str = "draft"


class FogSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mode: Literal["linear", "exp", "exp2"] = "exp2"
    color: Color3
    density: float = 0.02


class CameraSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["arc-rotate", "free", "universal"] = "arc-rotate"
    position: Vector3 = Field(default_factory=lambda: Vector3(x=0, y=4, z=-10))
    target: Vector3 = Field(default_factory=Vector3)
    fov: float = 0.8


class SkyboxSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    texture: str
    size: float = 1000


class PostProcessingSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    bloom: bool = False
    fxaa: bool = False
    vignette: bool = False


class Environment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    clearColor: Color4 = Field(default_factory=lambda: Color4(r=0.02, g=0.02, b=0.04, a=1))
    fog: FogSettings | None = None
    camera: CameraSettings = Field(default_factory=CameraSettings)
    skybox: SkyboxSettings | None = None
    postProcessing: PostProcessingSettings | None = None


class BaseEntity(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    type: str
    position: Vector3 = Field(default_factory=Vector3)
    rotation: Vector3 = Field(default_factory=Vector3)
    scale: Vector3 = Field(default_factory=lambda: Vector3(x=1, y=1, z=1))
    parent: str | None = None
    materialRef: str | None = None
    visible: bool = True
    tags: list[str] = Field(default_factory=list)


class MeshEntity(BaseEntity):
    type: Literal["mesh"] = "mesh"
    shape: Literal["box", "sphere", "ground", "plane", "cylinder"]
    width: float | None = None
    height: float | None = None
    depth: float | None = None
    diameter: float | None = None
    diameterTop: float | None = None
    diameterBottom: float | None = None
    tessellation: int | None = None


class SpriteAnimation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fromCell: int
    toCell: int
    loop: bool = True
    delay: int = 100


class SpriteEntity(BaseEntity):
    type: Literal["sprite"] = "sprite"
    texture: str
    cellWidth: int
    cellHeight: int
    cols: int
    rows: int
    animations: dict[str, SpriteAnimation] = Field(default_factory=dict)


class LightEntity(BaseEntity):
    type: Literal["light"] = "light"
    lightType: Literal["point", "hemispheric", "directional", "spot"]
    intensity: float = 1
    color: Color3 = Field(default_factory=lambda: Color3(r=1, g=1, b=1))
    range: float | None = None
    direction: Vector3 | None = None
    angle: float | None = None


class ParticleSystemEntity(BaseEntity):
    type: Literal["particle-system"] = "particle-system"
    capacity: int = 200
    emitter: str | None = None
    texture: str | None = None
    emitRate: float = 10
    minSize: float = 0.1
    maxSize: float = 0.4
    minLifeTime: float = 0.2
    maxLifeTime: float = 1.0


class ImportedModelEntity(BaseEntity):
    type: Literal["imported-model"] = "imported-model"
    url: str
    scaling: Vector3 = Field(default_factory=lambda: Vector3(x=1, y=1, z=1))


class GroupEntity(BaseEntity):
    type: Literal["group"] = "group"
    children: list[str] = Field(default_factory=list)


class CustomEntity(BaseEntity):
    type: Literal["custom"] = "custom"
    typeName: str
    config: dict[str, Any] = Field(default_factory=dict)


Entity = Annotated[
    MeshEntity | SpriteEntity | LightEntity | ParticleSystemEntity | ImportedModelEntity | GroupEntity | CustomEntity,
    Field(discriminator="type"),
]


class Material(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    type: Literal["standard", "pbr", "shader", "custom"] = "standard"
    diffuseColor: Color3 | None = None
    emissiveColor: Color3 | None = None
    texture: str | None = None
    alpha: float = 1
    metallic: float | None = None
    roughness: float | None = None
    config: dict[str, Any] = Field(default_factory=dict)


class AnimationKeyframe(BaseModel):
    model_config = ConfigDict(extra="forbid")

    frame: int
    value: float | Vector3 | Color3 | Color4


class AnimationClip(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    targetRef: str
    property: str
    loop: bool = False
    keyframes: list[AnimationKeyframe] = Field(default_factory=list)


class AudioSource(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    url: str
    loop: bool = False
    autoplay: bool = False
    volume: float = 1
    targetRef: str | None = None


class Interaction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    trigger: str
    action: str
    targetRef: str | None = None
    params: dict[str, Any] = Field(default_factory=dict)


class Transition(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event: str
    fromState: str
    toState: str


class StateDefinition(BaseModel):
    model_config = ConfigDict(extra="forbid")

    onEnter: list[str] = Field(default_factory=list)
    onExit: list[str] = Field(default_factory=list)


class StateMachine(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    initialState: str
    states: dict[str, StateDefinition] = Field(default_factory=dict)
    transitions: list[Transition] = Field(default_factory=list)


class ScriptRef(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    entry: str
    config: dict[str, Any] = Field(default_factory=dict)


class SceneDocument(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    schemaUri: str = Field(default="https://lain.dev/schemas/scene-document-v1.json", alias="$schema")
    version: int = 1
    metadata: SceneMetadata
    environment: Environment = Field(default_factory=Environment)
    entities: dict[str, Entity] = Field(default_factory=dict)
    materials: dict[str, Material] = Field(default_factory=dict)
    animations: dict[str, AnimationClip] = Field(default_factory=dict)
    audio: dict[str, AudioSource] = Field(default_factory=dict)
    interactions: dict[str, Interaction] = Field(default_factory=dict)
    stateMachines: dict[str, StateMachine] = Field(default_factory=dict)
    scripts: dict[str, ScriptRef] = Field(default_factory=dict)
