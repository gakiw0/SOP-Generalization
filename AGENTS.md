# Repository Guidelines

## Project Structure & Module Organization
- `Engine/src/rules_engine/`: core scoring engine, evaluators, plugin registry, and runtime pipeline.
- `Engine/configs/rules/`: editable rule sets and JSON schema (`schema/v1.json`).
- `Engine/scripts/`: operational scripts (`run_engine.py`, `validate_rules.py`, `compare_parity.py`).
- `ui/src/`: React + TypeScript rule-editor UI.
- `Docs/`: implementation notes and planning documents.
- `Data/`: local datasets (git-ignored; do not commit raw data).

## Build, Test, and Development Commands
- `cd ui && npm ci`: install UI dependencies.
- `cd ui && npm run dev`: start the Vite dev server.
- `cd ui && npm run build`: run TypeScript project build and bundle production assets.
- `cd ui && npm run lint`: run ESLint over TS/TSX sources.
- `python Engine/scripts/validate_rules.py Engine/configs/rules/baseball_swing_v1.json`: validate schema and cross-references.
- `python Engine/scripts/run_engine.py <data_name> --plugin auto`: run scoring for a dataset. Use `SOP_DATA_ROOT` to override data root.
- `python Engine/scripts/compare_parity.py <data_name>`: compare new engine output with legacy `analysis_results.json`.

## Coding Style & Naming Conventions
- Python: follow PEP 8, 4-space indentation, `snake_case` for functions/modules, `PascalCase` for classes.
- TypeScript/React: follow existing style in `ui/src` (2-space indentation, single quotes, no semicolons).
- Component files use `PascalCase` (example: `App.tsx`); helper variables/functions use `camelCase`.
- Rule JSON IDs should be stable and descriptive (example: `step2_head_move`), and phase IDs should be consistent lowercase tokens.

## Testing Guidelines
- There is no dedicated committed test suite yet; use validation and parity scripts as required checks for engine/rule changes.
- For UI changes, run both `npm run lint` and `npm run build` before creating a PR.
- When introducing tests, use behavior-based names (example: `test_event_window_resolution`) and keep fixtures minimal.

## MCP Visual Verification
- For every UI implementation/update task, verify the actual page with MCP Playwright before reporting completion.
- Do not treat lint/build/e2e-only results as sufficient for UI sign-off; include at least one MCP-based manual flow check.
- Record the MCP verification result in the final report (what page/state was checked and outcome).

## Commit & Pull Request Guidelines
- Match repository history style: lowercase prefix + colon (examples: `add: ...`, `update: ...`).
- Keep commits scoped (engine, UI, or docs) to simplify review.
- PRs should include: summary of change, rationale, commands run, and key outputs.
- For `ui/` updates, attach screenshots. For engine/rule changes, include a sample output/parity diff.
