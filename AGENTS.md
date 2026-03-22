# AGENTS.md

## Purpose

This repository is split between a hosted Babylon scene and an Expo shell. The goal of this file is to let multiple people and multiple AI agents work in parallel without stomping on each other.

## Current Repository Reality

- Root repo: `/Users/a.velts/projects/lain`
- Scene code is tracked by the root repo under `lain-scene/`
- `lain-app/` currently has its own `.git` directory and behaves like a nested repo
- Until the repo is normalized, treat `lain-app/` as a separate git workspace for commits and pushes

## Ownership Zones

Each agent or person owns exactly one zone unless explicitly assigned cross-zone integration work.

### `awp-agent`

Owns only:

- `lain-scene/awp/`
- `lain-scene/assets/sprites/` entries used only by AWP
- `lain-scene/assets/audio/` entries used only by AWP

Must not edit:

- `lain-scene/slasher/`
- `lain-scene/index.html`
- `lain-scene/mode-switcher.js`
- `lain-scene/mode-switcher.css`
- `lain-app/`

### `slasher-agent`

Owns only:

- `lain-scene/slasher/`
- `lain-scene/assets/sprites/` entries used only by Slasher
- `lain-scene/assets/audio/` entries used only by Slasher

Must not edit:

- `lain-scene/awp/`
- `lain-scene/index.html`
- `lain-scene/mode-switcher.js`
- `lain-scene/mode-switcher.css`
- `lain-app/`

### `app-agent`

Owns only:

- `lain-app/src/`
- `lain-app/app.json`
- `lain-app/package.json`
- `lain-app/package-lock.json`
- `lain-app/eas.json`
- `lain-app/.eas/`
- `lain-app/maestro/`

Must not edit:

- `lain-scene/awp/`
- `lain-scene/slasher/`
- `lain-scene/index.html`
- `lain-scene/mode-switcher.js`
- `lain-scene/mode-switcher.css`

### `integration-agent`

Owns only:

- `lain-scene/index.html`
- `lain-scene/slasher.html`
- `lain-scene/mode-switcher.js`
- `lain-scene/mode-switcher.css`
- `.github/workflows/`
- `README.md`
- root `package.json`

Can touch other zones only to wire already-approved contracts together.

## Contracts Between Zones

Only `integration-agent` may change these contracts:

- scene routes: `/awp/`, `/slasher/`, `/?mode=...`
- query params: `mode`, `v`, `awpMusic`, `slasherMusic`, `targetImage`, `still`
- `window.ReactNativeWebView.postMessage(...)` payload shape
- mode switcher UI and route forwarding

If a zone needs a contract change, open a handoff note in the commit message or task prompt instead of changing it ad hoc.

## Branching Rules

- Never push experimental scene work directly to `main`
- Use short-lived branches with the `codex/` prefix
- Suggested branches:
  - `codex/awp-*`
  - `codex/slasher-*`
  - `codex/app-*`
  - `codex/integration-*`

Examples:

```bash
git checkout -b codex/awp-hit-feedback
git checkout -b codex/slasher-hold-tuning
git -C lain-app checkout -b codex/app-tv-controls
```

## Worktree Setup

Use separate worktrees so each person or agent works in a separate directory and cannot trample local changes.

For scene work from the root repo:

```bash
cd /Users/a.velts/projects/lain
git worktree add ../lain-awp codex/awp-hit-feedback
git worktree add ../lain-slasher codex/slasher-hold-tuning
git worktree add ../lain-integration codex/integration-router
```

For the app repo:

```bash
cd /Users/a.velts/projects/lain/lain-app
git worktree add ../../lain-app-shell codex/app-tv-controls
```

## Commit Scope Rules

Every commit must stay inside one ownership zone.

Good:

```bash
git add lain-scene/awp
git commit -m "awp: tighten hit/death transition"
```

```bash
git add lain-scene/slasher
git commit -m "slasher: tune hold movement window"
```

```bash
git -C lain-app add src app.json eas.json
git -C lain-app commit -m "app: improve TV mode switching"
```

Bad:

- one commit touching `lain-scene/awp/` and `lain-scene/slasher/`
- one commit touching `lain-scene/` and `lain-app/`
- editing router files from a mode-specific branch

## Merge Discipline

- Merge mode branches into `main` only after smoke testing on iOS
- Merge order:
  1. `awp-agent` or `slasher-agent`
  2. `integration-agent`
  3. `app-agent`
- If `main` moved while an agent was working, rebase or cherry-pick instead of force-pushing

## Generated Files

Do not commit these unless the task explicitly asks for recorded artifacts:

- `.DS_Store`
- `lain-scene/test-results/`
- screenshot diffs under Playwright outputs
- local build outputs

## Handoff Rules

When handing work off between agents, include:

- owned zone
- files changed
- query params relied on
- expected smoke test
- known risks

Example handoff note:

```text
Zone: lain-scene/awp
Changed: awp/main.js, awp/styles.css
Contract used: mode=awp, targetImage, awpMusic
Smoke test: tap fires, target dies, music resumes after first interaction
Risk: assumes target sprite keeps 1:1 aspect ratio
```

## Recommended Human Split

- You: `app-agent` + `integration-agent`
- Teammate: one scene agent at a time, either `awp-agent` or `slasher-agent`
- Second AI agent: the other scene mode

This keeps iOS verification and route contracts in one place while scene iteration stays parallel.
