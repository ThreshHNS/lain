# Maestro Flows

Use these flows to separate valid route captures from error-state captures.

## Valid Route Screens

- `flows/route-screenshots.yaml`
  Captures the current happy path for `home -> game -> editor` on the active AWP route.
- `flows/prompt-history-screenshot.yaml`
  Captures the prompt history route after entering the editor.
- `flows/visual-route-audit.yaml`
  Captures a broader audit set for both `awp` and `slasher`, including the first editor transition frame.
- `flows/scene-shell-awp.yaml`
  Captures the post-open shell state for `awp` without failing early, so leaked scene HUD or missing native chrome is preserved as named screenshots.
- `flows/scene-shell-slasher.yaml`
  Same diagnostic capture for `slasher`.

## Error Screens

- `flows/net-fallback.yaml`
  Captures the broken preview state and the recovered state after retry.
  This flow depends on the home debug harness being enabled, so run the app with `EXPO_PUBLIC_E2E_DEBUG=1`.

## Artifact Intent

- `route-*`
  Baseline route screenshots for fast regression checks.
- `audit-*`
  Extra validation screenshots to inspect transition frames, extra chrome inside the scene, or stale overlays.
- `*-shell-check`
  Snapshot captured immediately after opening a scene route, before the screen-level assertion, so leaked scene HUD or missing app chrome is preserved even when the flow fails.
- `*-error`
  Expected broken states that should show fallback UI.
- `*-recovered`
  Screenshots after retry/reload confirms the route returned to a valid state.
