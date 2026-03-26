# lain-agent

FastAPI scene-agent kernel for LAI-7.

The service accepts a structured `sceneContext` plus an operation request, routes it through a pipeline, and returns either a `SceneDocument`, an RFC 6902 JSON Patch, or a read-only answer. The OpenRouter model is now behind a provider abstraction, and the core scene output is declarative Scene DSL JSON instead of raw Babylon.js file rewrites.

## What it does

- validates and stores DSL-based `SceneDocument` JSON
- supports `scene.create`, `scene.patch`, `scene.query`, `asset.search`, `asset.attach`, and `validate`
- retries LLM generation when schema or semantic validation fails
- keeps file operations inside the current scene scope
- exposes storage-backed scene CRUD endpoints

## Project layout

- `app/main.py` - FastAPI entrypoint
- `app/config.py` - environment-backed settings
- `app/dsl/` - Scene DSL schema, patch handling, semantic validators
- `app/llm/` - provider abstraction + OpenRouter implementation
- `app/tools/` - extensible operation/tool registry
- `app/core/` - pipeline orchestration and operation routing
- `app/storage/` - `SceneDocument` file persistence
- `app/models/scene_context.py` - typed input scene contract and scope guards
- `app/models/agent_response.py` - operation-based structured response
- `app/models/operations.py` - request payloads
- `app/agent/service.py` - composition root for provider + tools + pipeline
- `app/routes/runs.py` - `POST /runs`
- `app/routes/scenes.py` - scene CRUD + validation
- `tests/` - contract and route tests

## Setup

```bash
cd lain-agent
python3 -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
cp .env.example .env
uvicorn app.main:app --reload
```

## Request shape

`POST /runs`

```json
{
  "operation": "scene.create",
  "sceneContext": {
    "scene": {
      "id": "slasher",
      "title": "Slasher",
      "route": "/slasher/",
      "engine": "babylonjs",
      "inputModel": "hold",
      "platforms": ["web", "ios-webview"],
      "status": "draft"
    },
    "creative": {
      "fantasy": "cold pursuit in a low-fi horror corridor",
      "tone": ["cold", "violent", "psx", "claustrophobic"],
      "playerExperience": "feel chased, commit to short aggressive movement windows",
      "references": ["ps1 horror", "lo-fi crimson fog"]
    },
    "gameplay": {
      "coreLoop": "move, avoid, close distance, slash, survive",
      "playerVerbs": ["move", "slash", "evade"],
      "successState": "enemy dies and kill state is visible",
      "failState": "player hp reaches zero",
      "constraints": [
        "must stay readable on mobile",
        "must work in embedded webview",
        "keep controls simple"
      ]
    },
    "contracts": {
      "queryParamsReadOnly": ["mode", "embedded", "preview", "still"],
      "postMessageReadOnly": {
        "type": "scene-state",
        "shape": "{ type: string, state: object }"
      },
      "sharedFilesReadOnly": [
        "lain-scene/index.html",
        "lain-scene/mode-switcher.js",
        "lain-scene/mode-switcher.css"
      ]
    },
    "assets": {
      "attached": [],
      "missing": [],
      "styleRules": []
    },
    "codebase": {
      "entryFiles": [
        "lain-scene/slasher/index.html",
        "lain-scene/slasher/main.js"
      ],
      "writableFiles": [
        "lain-scene/slasher/index.html",
        "lain-scene/slasher/main.js",
        "lain-scene/slasher/assets/"
      ],
      "fileSummaries": []
    },
    "session": {
      "recentDecisions": [],
      "openProblems": [],
      "latestUserIntent": "Add a stronger slash hit reaction."
    }
  },
  "currentScene": null,
  "conversationHistory": [],
  "operationParams": {},
  "userPrompt": "Make the kill feedback feel more violent."
}
```

## Notes

- `sceneContext.codebase.writableFiles` is the write allowlist for file effects such as asset attach.
- Directory entries should end with `/` if the agent is allowed to create new files under that prefix.
- Shared contract files stay read-only even if the prompt asks to change them.
- `scene.create` returns a full `SceneDocument`.
- `scene.patch` returns both a JSON Patch array and the updated `SceneDocument`.
- `scene.query` returns a read-only textual answer.

## Additional routes

- `GET /scenes/{scene_id}` - load a stored `SceneDocument`
- `PUT /scenes/{scene_id}` - save a `SceneDocument` to `lain-scene/{scene_id}/scene.json`
- `POST /scenes/{scene_id}/validate` - validate a `SceneDocument` without saving

## OpenRouter keys

1. Create an API key in your OpenRouter dashboard.
2. Copy `.env.example` to `.env`.
3. Set `OPENROUTER_API_KEY=...`.
4. Leave `LAIN_AGENT_LLM_PROVIDER=openrouter` unless you add another provider implementation.
5. Optionally override:
   - `LAIN_AGENT_MODEL`
   - `LAIN_AGENT_OPENROUTER_BASE_URL`
   - `LAIN_AGENT_TEMPERATURE`
   - `LAIN_AGENT_MAX_TOKENS`
   - `LAIN_AGENT_PIPELINE_MAX_RETRIES`

The service reads `.env` automatically through `pydantic-settings`.

## End-to-end local test

1. Start the agent service:

```bash
cd lain-agent
source .venv/bin/activate
uvicorn app.main:app --reload
```

2. Generate a scene document:

```bash
curl -s http://127.0.0.1:8000/runs \
  -H 'Content-Type: application/json' \
  -d '{
    "operation": "scene.create",
    "sceneContext": {
      "scene": {
        "id": "slasher",
        "title": "Slasher",
        "route": "/slasher/",
        "engine": "babylonjs",
        "inputModel": "hold",
        "platforms": ["web", "ios-webview"],
        "status": "draft"
      },
      "creative": {
        "fantasy": "cold pursuit in a low-fi horror corridor",
        "tone": ["cold", "violent", "psx", "claustrophobic"],
        "playerExperience": "feel chased in a narrow corridor",
        "references": ["ps1 horror", "lo-fi crimson fog"]
      },
      "gameplay": {
        "coreLoop": "move, slash, survive",
        "playerVerbs": ["move", "slash", "evade"],
        "successState": "enemy dies",
        "failState": "player hp reaches zero",
        "constraints": ["must stay readable on mobile", "must work in embedded webview"]
      },
      "contracts": {
        "queryParamsReadOnly": ["mode", "embedded", "preview", "still"],
        "postMessageReadOnly": {
          "type": "scene-state",
          "shape": "{ type: string, state: object }"
        },
        "sharedFilesReadOnly": [
          "lain-scene/index.html",
          "lain-scene/mode-switcher.js",
          "lain-scene/mode-switcher.css"
        ]
      },
      "assets": {
        "attached": [],
        "missing": [],
        "styleRules": []
      },
      "codebase": {
        "entryFiles": [
          "lain-scene/slasher/index.html",
          "lain-scene/slasher/main.js"
        ],
        "writableFiles": [
          "lain-scene/slasher/index.html",
          "lain-scene/slasher/main.js",
          "lain-scene/slasher/assets/"
        ],
        "fileSummaries": []
      },
      "session": {
        "recentDecisions": [],
        "openProblems": [],
        "latestUserIntent": "Generate a test scene."
      }
    },
    "userPrompt": "Create a minimal corridor combat scene with one enemy, one ground plane, and one light."
  }' > /tmp/lain-scene-create.json
```

3. Save the returned `sceneDocument`:

```bash
jq '{ document: .sceneDocument }' /tmp/lain-scene-create.json | \
curl -s -X PUT http://127.0.0.1:8000/scenes/slasher \
  -H 'Content-Type: application/json' \
  -d @-
```

4. Start the static scene server:

```bash
cd ../lain-scene
python3 -m http.server 4173
```

5. Open the DSL runtime:

```text
http://127.0.0.1:4173/engine/?scene=slasher
```

For a built-in sample document, open:

```text
http://127.0.0.1:4173/engine/
```
