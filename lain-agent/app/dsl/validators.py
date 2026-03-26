from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict

from app.dsl.schema import (
    AnimationClip,
    AudioSource,
    Entity,
    GroupEntity,
    ParticleSystemEntity,
    SceneDocument,
    StateMachine,
)
from app.models.scene_context import SCENE_ID_RE, SceneContext


class DiagnosticSeverity(StrEnum):
    error = "error"
    warning = "warning"


class ValidationDiagnostic(BaseModel):
    model_config = ConfigDict(extra="forbid")

    severity: DiagnosticSeverity = DiagnosticSeverity.error
    path: str
    message: str


class SceneValidationError(ValueError):
    def __init__(self, diagnostics: list[ValidationDiagnostic]) -> None:
        self.diagnostics = diagnostics
        super().__init__("\n".join(f"{item.path}: {item.message}" for item in diagnostics))


def _push(diagnostics: list[ValidationDiagnostic], path: str, message: str) -> None:
    diagnostics.append(ValidationDiagnostic(path=path, message=message))


def _validate_mapping_keys[T: BaseModel](
    diagnostics: list[ValidationDiagnostic],
    path: str,
    mapping: dict[str, T],
) -> None:
    for key, value in mapping.items():
        value_id = getattr(value, "id", None)
        if value_id is not None and value_id != key:
            _push(diagnostics, f"{path}/{key}", f"Mapping key {key!r} must match object id {value_id!r}.")


def validate_scene_document(document: SceneDocument) -> list[ValidationDiagnostic]:
    diagnostics: list[ValidationDiagnostic] = []

    if not SCENE_ID_RE.fullmatch(document.metadata.id):
        _push(diagnostics, "/metadata/id", "Scene metadata.id must be lowercase and URL-safe.")
    if document.metadata.engine != "dsl-runtime":
        _push(diagnostics, "/metadata/engine", "DSL documents must use metadata.engine = 'dsl-runtime'.")
    if len(document.entities) > 500:
        _push(diagnostics, "/entities", "Scene entity limit exceeded (500).")

    _validate_mapping_keys(diagnostics, "/entities", document.entities)
    _validate_mapping_keys(diagnostics, "/materials", document.materials)
    _validate_mapping_keys(diagnostics, "/animations", document.animations)
    _validate_mapping_keys(diagnostics, "/audio", document.audio)
    _validate_mapping_keys(diagnostics, "/interactions", document.interactions)
    _validate_mapping_keys(diagnostics, "/stateMachines", document.stateMachines)
    _validate_mapping_keys(diagnostics, "/scripts", document.scripts)

    entity_ids = set(document.entities)
    material_ids = set(document.materials)

    for entity_id, entity in document.entities.items():
        if entity.parent and entity.parent not in entity_ids:
            _push(diagnostics, f"/entities/{entity_id}/parent", f"Unknown parent ref {entity.parent!r}.")
        if entity.materialRef and entity.materialRef not in material_ids:
            _push(
                diagnostics,
                f"/entities/{entity_id}/materialRef",
                f"Unknown material ref {entity.materialRef!r}.",
            )
        if isinstance(entity, GroupEntity):
            for child_id in entity.children:
                if child_id not in entity_ids:
                    _push(diagnostics, f"/entities/{entity_id}/children", f"Unknown child ref {child_id!r}.")
        if isinstance(entity, ParticleSystemEntity) and entity.emitter and entity.emitter not in entity_ids:
            _push(diagnostics, f"/entities/{entity_id}/emitter", f"Unknown emitter ref {entity.emitter!r}.")

    for animation_id, animation in document.animations.items():
        if animation.targetRef not in entity_ids:
            _push(
                diagnostics,
                f"/animations/{animation_id}/targetRef",
                f"Unknown animation target ref {animation.targetRef!r}.",
            )

    for audio_id, audio in document.audio.items():
        if audio.targetRef and audio.targetRef not in entity_ids:
            _push(diagnostics, f"/audio/{audio_id}/targetRef", f"Unknown audio target ref {audio.targetRef!r}.")

    for interaction_id, interaction in document.interactions.items():
        if interaction.targetRef and interaction.targetRef not in entity_ids:
            _push(
                diagnostics,
                f"/interactions/{interaction_id}/targetRef",
                f"Unknown interaction target ref {interaction.targetRef!r}.",
            )

    for machine_id, machine in document.stateMachines.items():
        _validate_state_machine(diagnostics, machine_id, machine)

    return diagnostics


def _validate_state_machine(
    diagnostics: list[ValidationDiagnostic],
    machine_id: str,
    machine: StateMachine,
) -> None:
    if machine.initialState not in machine.states:
        _push(
            diagnostics,
            f"/stateMachines/{machine_id}/initialState",
            f"Unknown initial state {machine.initialState!r}.",
        )
    for transition in machine.transitions:
        if transition.fromState not in machine.states:
            _push(
                diagnostics,
                f"/stateMachines/{machine_id}/transitions",
                f"Transition references unknown fromState {transition.fromState!r}.",
            )
        if transition.toState not in machine.states:
            _push(
                diagnostics,
                f"/stateMachines/{machine_id}/transitions",
                f"Transition references unknown toState {transition.toState!r}.",
            )


def assert_valid_scene_document(document: SceneDocument) -> None:
    diagnostics = validate_scene_document(document)
    if diagnostics:
        raise SceneValidationError(diagnostics)


def assert_document_matches_scene_context(document: SceneDocument, scene_context: SceneContext) -> None:
    diagnostics: list[ValidationDiagnostic] = []
    if document.metadata.id != scene_context.scene.id:
        _push(
            diagnostics,
            "/metadata/id",
            f"Document id {document.metadata.id!r} must match sceneContext.scene.id {scene_context.scene.id!r}.",
        )
    if diagnostics:
        raise SceneValidationError(diagnostics)

