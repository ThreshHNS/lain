# AGENTS.md

## Scope

This file governs work inside the `lain-app/` app zone of the root `lain` monorepo.

Also read:

- `../AGENTS.md`

## Ownership

`app-agent` owns:

- `src/`
- `app.json`
- `package.json`
- `package-lock.json`
- `eas.json`
- `.eas/`
- `maestro/`
- this file

Do not edit from this app zone:

- `../lain-scene/`
- root router or mode switcher files
- root workflows unless explicitly assigned outside this repo

## Scene Selector Rules

The app shell consumes the shared hosted-scene contract. It must not invent new public scene routes or public query params on its own.

When a new scene is introduced, `app-agent` may:

- extend the scene registry and selector UI
- update TV focus order and button labeling
- update retry or reload affordances
- add or update app tests for the new selector state

When a new scene is introduced, `app-agent` must not:

- change router semantics in the hosted scene
- rename scene ids ad hoc
- add public params that were not approved by `integration-agent`

## Branching

Use app-only branches:

- `codex/app-<task>`

Example:

```bash
git checkout -b codex/app-scene-registry
```

## Worktree

Example:

```bash
git worktree add -b codex/app-scene-registry ../lain-app-shell HEAD
```

## Commit Scope

Every commit must stay inside the app zone and should match one app concern.

Good:

```bash
git add lain-app/src lain-app/app.json lain-app/eas.json
git commit -m "app: extend scene selector"
```

Bad:

- editing `lain-scene/` or root integration files from an app-only task
- mixing app-shell work with hosted-scene routing changes

## Generated Files

Do not commit local build outputs or transient test artifacts unless the task explicitly asks for them.
