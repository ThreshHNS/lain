from __future__ import annotations

from fastapi.testclient import TestClient

from app.agent.service import get_agent_service
from app.main import create_app
from app.storage.scene_store import SceneStore

from .helpers import build_scene_document, seed_repo


class SceneServiceStub:
    def __init__(self, store: SceneStore) -> None:
        self.store = store


def test_scene_routes_get_put_and_validate(tmp_path) -> None:
    repo_root = seed_repo(tmp_path)
    store = SceneStore(repo_root)
    document = build_scene_document()

    app = create_app()
    app.dependency_overrides[get_agent_service] = lambda: SceneServiceStub(store)
    client = TestClient(app)

    put_response = client.put(
        f"/scenes/{document.metadata.id}",
        json={"document": document.model_dump(mode="json", by_alias=True)},
    )
    assert put_response.status_code == 200

    get_response = client.get(f"/scenes/{document.metadata.id}")
    assert get_response.status_code == 200
    assert get_response.json()["metadata"]["id"] == document.metadata.id

    validate_response = client.post(
        f"/scenes/{document.metadata.id}/validate",
        json={"document": document.model_dump(mode="json", by_alias=True)},
    )
    assert validate_response.status_code == 200
    assert validate_response.json()["valid"] is True
