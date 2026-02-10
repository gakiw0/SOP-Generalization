# Coach JSON Builder (UI)

This UI is a coach-friendly editor for creating `schema v1` rule-set JSON files used by the comparison system.

## What This Page Does
- Uses **step / checkpoint** language instead of raw schema terms.
- Produces JSON compatible with: `Engine/configs/rules/schema/v1.json`.
- Supports:
  - Metadata editing
  - Step (phase) editing
  - Checkpoint (rule) editing
  - Basic conditions (`threshold`, `range`, `boolean`, `composite`)
  - Expert condition types (`event_exists`, `trend`, `angle`, `distance`) per checkpoint
  - Validation with error navigation
  - Import existing schema v1 JSON
  - Export validated JSON
  - Multi-language UI (`ja`, `en`, `zh-CN`, `zh-TW`)

## Run
```bash
cd ui
npm ci
npm run dev
```

## Build and Lint
```bash
cd ui
npm run lint
npm run build
```

## Workflow
1. Fill metadata (`rule_set_id`, sport, version, title).
2. Add/edit steps.
3. Add/edit checkpoints inside each step.
4. Add conditions.
5. Click **Validate**.
6. Fix any listed errors (clicking an error jumps to its target section).
7. Export JSON (enabled only after successful validation).

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
- Expert condition types are intentionally gated per checkpoint.
