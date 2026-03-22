# AGENTS.md

## Scope

This root file governs the hosted Babylon scene workspace and all shared integration files in the root repository.

Important repo detail:

- `lain-scene/` is tracked by the root repo
- `lain-app/` currently has its own `.git` directory and behaves like a nested repo
- when working inside `lain-app/`, also follow `lain-app/AGENTS.md`

## Scene Flow Model

A scene flow is an independently shippable hosted scene with its own folder, route, assets, smoke test, and gameplay loop.

Current scene ids:

- `awp`
- `slasher`

Rules for every new scene flow:

- canonical scene id must be lowercase and URL-safe
- canonical hosted route is `/<scene-id>/`
- scene source lives in `lain-scene/<scene-id>/`
- scene-local assets should live in `lain-scene/<scene-id>/assets/`
- move assets to shared folders under `lain-scene/assets/` only if they are reused by at least two scenes
- new scene-specific tests should live in `lain-scene/tests/e2e/<scene-id>.spec.js` when possible to avoid collisions in one shared spec file

## Ownership Zones

Each agent or person owns exactly one zone unless explicitly assigned integration work.

### `scene-agent(<scene-id>)`

Owns only:

- `lain-scene/<scene-id>/`
- `lain-scene/tests/e2e/<scene-id>.spec.js`
- scene-only shared assets that were explicitly assigned to that scene

Must not edit:

- any other `lain-scene/<other-scene-id>/`
- `lain-scene/index.html`
- `lain-scene/slasher.html`
- `lain-scene/mode-switcher.js`
- `lain-scene/mode-switcher.css`
- `.github/workflows/`
- `README.md`
- `lain-app/`

### `integration-agent`

Owns only:

- `lain-scene/index.html`
- `lain-scene/slasher.html`
- `lain-scene/mode-switcher.js`
- `lain-scene/mode-switcher.css`
- `lain-scene/tests/e2e/scene.spec.js`
- `.github/workflows/`
- `README.md`
- root `package.json`
- root docs, including this file

Can touch scene folders only for agreed routing or contract wiring.

### `app-agent`

Owns the nested app repo:

- `lain-app/src/`
- `lain-app/app.json`
- `lain-app/package.json`
- `lain-app/package-lock.json`
- `lain-app/eas.json`
- `lain-app/.eas/`
- `lain-app/maestro/`
- `lain-app/AGENTS.md`

Must not edit scene code from inside app work.

### `review-agent`

Owns no files. Reviews diffs only.

## Contract Ownership

Only `integration-agent` may change shared contracts:

- the root router and direct scene routing
- the public scene selector contract, currently `/?mode=<scene-id>`
- route forwarding and the mode switcher
- shared query param semantics
- `window.ReactNativeWebView.postMessage(...)` payload shape

Current public contract:

- root scene entry uses `mode=<scene-id>`
- direct hosted scene route is `/<scene-id>/`
- `mode` is still the active selector until a full router/app migration says otherwise

Query param rules:

- shared params are reserved by `integration-agent`
- scene-specific params must be namespaced and should not reuse generic names silently
- if a new scene needs a new public param, request a handoff instead of inventing it inside one scene folder

## New Scene Bootstrap Flow

Use this flow whenever a brand-new scene id is introduced.

1. Define the scene brief:
- `scene-id`
- gameplay goal
- primary input model: tap, hold, drag, TV remote, or mixed
- success criteria
- asset list
- music source
- minimum smoke test

2. `integration-agent` reserves the `scene-id`:
- confirms the folder name
- confirms the public route
- confirms whether the scene appears in the root switcher and in the app shell

3. `scene-agent(<scene-id>)` creates the scene implementation:
- `lain-scene/<scene-id>/index.html`
- `lain-scene/<scene-id>/main.js`
- optional `styles.css`
- scene-local assets under `lain-scene/<scene-id>/assets/`

4. `integration-agent` wires the scene:
- root router
- scene switcher
- shared smoke or route tests
- README or deployment wiring if needed

5. `app-agent` exposes the scene in the Expo shell:
- scene registry
- UI controls
- TV focus order
- retry and reload affordances
- app tests if the selector changed

## Branching Rules

- never push experimental work directly to `main`
- use short-lived branches with the `codex/` prefix
- recommended branch names:
  - `codex/scene-<scene-id>-<task>`
  - `codex/integration-<task>`
  - `codex/app-<task>`

Examples:

```bash
git checkout -b codex/scene-awp-hit-feedback
git checkout -b codex/scene-slasher-hold-tuning
git -C lain-app checkout -b codex/app-scene-registry
```

## Worktree Setup

Use separate worktrees so each person or agent works in a separate directory.

For scene work from the root repo:

```bash
git worktree add -b codex/scene-awp-hit-feedback ../lain-awp HEAD
git worktree add -b codex/scene-slasher-hold-tuning ../lain-slasher HEAD
git worktree add -b codex/integration-router ../lain-integration HEAD
```

For the app repo:

```bash
git -C lain-app worktree add -b codex/app-scene-registry ../lain-app-shell HEAD
```

## Commit Scope Rules

Every commit must stay inside one ownership zone.

Good:

```bash
git add lain-scene/awp
git commit -m "scene-awp: tighten hit/death transition"
```

```bash
git add lain-scene/slasher
git commit -m "scene-slasher: tune hold movement window"
```

```bash
git -C lain-app add src app.json eas.json
git -C lain-app commit -m "app: extend scene selector"
```

Bad:

- one commit touching two different scene folders
- one commit touching `lain-scene/` and `lain-app/`
- editing router or switcher files from a scene-specific branch

## Merge Discipline

- merge scene branches only after smoke testing the changed scene
- merge order for a new scene:
  1. `scene-agent(<scene-id>)`
  2. `integration-agent`
  3. `app-agent`
- if `main` moved while an agent was working, rebase or cherry-pick instead of force-pushing

## Generated Files

Do not commit these unless the task explicitly asks for recorded artifacts:

- `.DS_Store`
- `node_modules/`
- `lain-scene/test-results/`
- `lain-scene/playwright-report/`
- screenshot diffs under Playwright outputs
- local build outputs

## Handoff Rules

When handing work off between agents, include:

- owned zone
- scene id
- files changed
- public params relied on
- expected smoke test
- known risks

Example handoff note:

```text
Zone: lain-scene/awp
Scene id: awp
Changed: awp/main.js, awp/styles.css
Public params used: mode, targetImage, awpMusic
Smoke test: tap fires, target dies, music resumes after first interaction
Risk: assumes target sprite keeps 1:1 aspect ratio
```

## Recommended Split

- You: `integration-agent` plus `app-agent`
- Teammate or sub-agent 1: `scene-agent(awp)`
- Teammate or sub-agent 2: `scene-agent(slasher)`
- For any new flow, assign exactly one `scene-agent(<scene-id>)`

This keeps route contracts and iOS verification centralized while scene iteration stays parallel.
