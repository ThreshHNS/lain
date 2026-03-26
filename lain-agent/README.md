# lain-agent

FastAPI + PydanticAI MVP for LAI-7.

The service accepts a structured `sceneContext` plus a `userPrompt`, runs a single OpenRouter-backed agent, and keeps all file operations inside the current scene scope.

## What it does

- answers scene-direction requests without touching code
- searches shared and current-scene assets
- copies approved shared assets into the current scene
- upserts scene-local Babylon files inside the declared writable scope

## Project layout

- `app/main.py` - FastAPI entrypoint
- `app/config.py` - environment-backed settings
- `app/models/scene_context.py` - typed scene contract and scope guards
- `app/models/agent_response.py` - typed structured agent output
- `app/agent/service.py` - PydanticAI agent wiring
- `app/agent/tools/` - narrow local tool implementations
- `app/routes/runs.py` - `POST /runs`
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
  "userPrompt": "Make the kill feedback feel more violent."
}
```

## Notes

- `sceneContext.codebase.writableFiles` is the write allowlist.
- Directory entries should end with `/` if the agent is allowed to create new files under that prefix.
- Shared contract files stay read-only even if the prompt asks to change them.

