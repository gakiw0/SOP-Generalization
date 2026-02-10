# UI Quality Gate (Coach Builder)

Date: 2026-02-10

## Intended checks
- `npm run lint`
- `npm run build`
- `npm run test:e2e`

## CI gate
- GitHub Actions workflow: `.github/workflows/ui-quality-and-e2e.yml`
- Trigger: `push` / `pull_request` with changes under `ui/**`
- Jobs:
  - `lint_build`: `npm ci`, `npm run lint`, `npm run build`
  - `e2e_chromium`: `npm ci`, `npx playwright install --with-deps chromium`, `npm run test:e2e`
- Failure artifacts:
  - `playwright-report`
  - `playwright-test-results`

## Execution result in this environment
- `npm run lint`: passed
- `npm run build`: passed
- `npm run test:e2e`: not executed (Playwright dependencies could not be fetched in this restricted environment)

## Notes
- Build needed sandbox escalation because Vite/esbuild process spawn failed with `spawn EPERM` under default sandbox.
- With elevated execution, production build completed successfully.
- E2E requires external npm/package fetch + browser install. Run in a network-enabled environment to complete Playwright setup.
