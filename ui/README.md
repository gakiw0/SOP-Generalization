# Coach JSON Builder (UI)

This UI is a coach-friendly editor for creating `schema v1` rule-set JSON files used by the comparison system.

## What This Page Does
- Uses **step / checkpoint** language instead of raw schema terms.
- Produces JSON compatible with: `Engine/configs/rules/schema/v1.json`.
- Assumes a **1v1 comparison flow** (one player vs one coach) for this MVP.
- Supports:
  - Metadata editing
  - Step (phase) editing
  - Checkpoint (rule) editing
  - Runtime-supported condition types (capability-driven)
  - Metric selection from runtime capability candidates
  - Validation with error navigation
  - Import existing schema v1 JSON
  - Export validated JSON
  - Multi-language UI (`ja`, `en`, `zh-CN`, `zh-TW`)

## Runtime Capability Source
- Single source of truth: plugin capability API in Engine plugins.
  - `list_supported_metrics()`
  - `list_supported_condition_types()`
- Export script:
  - `python Engine/scripts/export_plugin_capabilities.py`
- Generated UI data:
  - `ui/src/generated/pluginCapabilities.json`

For current built-in `baseball` plugin, runtime-supported condition types are:
- `threshold`
- `range`
- `boolean`
- `composite`

## Run
```bash
cd ui
npm ci
npm run dev
```

## Codex MCP Setup (Playwright)
Register the Playwright MCP server globally in Codex CLI and prepare Chromium:

```bash
cd ui
npm run mcp:register
npm run mcp:check
npm run mcp:prep
```

Start local UI for Codex-operated browser verification (single command):

```bash
cd ui
npm run mcp:start
```

- MCP server name is fixed as `playwright`.
- The local app server is fixed at `http://127.0.0.1:4173`.

## Build and Lint
```bash
cd ui
npm run lint
npm run build
```

## E2E (Playwright, Chromium)
Run the automated scenarios:

```bash
cd ui
npm run test:e2e
```

Headed mode:

```bash
cd ui
npm run test:e2e:headed
```

Full UI quality gate:

```bash
cd ui
npm run verify:ui
```

The Playwright suite currently includes:
- `scenario_1_setup_gate`
- `scenario_2_validation_navigation`
- `scenario_3_export_guard`

Artifacts on failure:
- `ui/playwright-report`
- `ui/test-results`

## Codex Operation Notes
- Stable selectors for MCP and E2E use `data-testid="cb-..."`.
- Locale-dependent text should not be used as the primary selector in tests.

## Workflow
1. Fill metadata (`rule_set_id`, sport, version, title).
2. Add/edit steps.
3. Add/edit checkpoints inside each step.
4. Add conditions.
5. Click **Validate**.
6. Fix any listed errors (clicking an error jumps to its target section).
7. Export JSON (enabled only after successful validation).

### Export Disabled Conditions
Export is disabled when any validation error remains, including capability errors:
- `unsupported_condition_type`
- `unsupported_metric`

## Import Existing JSON
- Click `Import JSON`.
- Select a valid schema v1 JSON file.
- The draft is loaded and can be re-edited and exported.

## Localization
- i18n framework: `react-i18next` + `i18next`
- Supported locales:
  - `ja` (Japanese)
  - `en` (English)
  - `zh-CN` (Simplified Chinese)
  - `zh-TW` (Traditional Chinese)
- Locale detection order:
  1. `sessionStorage['ui_locale']`
  2. `navigator.language`
  3. fallback to `en`
- Locale files:
  - `ui/src/i18n/locales/en.json`
  - `ui/src/i18n/locales/ja.json`
  - `ui/src/i18n/locales/zh-CN.json`
  - `ui/src/i18n/locales/zh-TW.json`
- Session behavior:
  - Selected language is stored per browser tab session (`sessionStorage`).
  - New session starts from browser-language detection again.

## Mapping Rules
- UI `Step` -> schema `phase`
- UI `Checkpoint` -> schema `rule`
- Signal and condition sections map directly to schema fields.

## Notes
- Dominant hand is intentionally not included in exported JSON because it is not part of schema v1.
- Capability-restricted condition types are intentionally blocked or locked in UI to match runtime behavior.
