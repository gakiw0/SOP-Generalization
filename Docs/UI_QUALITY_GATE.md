# UI Quality Gate (Coach Builder)

Date: 2026-02-10

## Intended checks
- `npm run lint`
- `npm run build`

## Execution result in this environment
Both commands could not be executed because `npm` was not available in PATH.

Observed error:
- `The term 'npm' is not recognized as a name of a cmdlet, function, script file, or executable program.`

## Follow-up required on a Node-enabled machine
1. Run `cd ui && npm run lint`
2. Run `cd ui && npm run build`
3. Confirm both commands succeed before release.
