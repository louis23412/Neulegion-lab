# CYCLE-118 — Round 89: focused test/run scripts (operator request)

**Date:** 2026-09-30
**Goal:** stop running everything every time — one focused native test runner, no
accidental `all` stages.

## Built (repo scripts + one package shortcut, no scored-path change)

* `scripts/test.sh` (new): `quick` (mirrors/locks/modules/contracts/guards),
  `<name> [...]` (any `test/node` stem, `.test.js` suffix optional, deduped),
  `quick` + names compose, `full` = `npm test`, bare run lists names. Prints the exact
  `node --test ...` command before running. Includes the edit→suite map in its header.
* `scripts/sleeve-runs.sh`: no-arg default was `all` (six runs) — now prints usage and
  exits 2. `scripts/round30-runs.sh` already required a stage; untouched.
* `package.json`: `test:quick` = `bash scripts/test.sh quick`.
* `src/README.md`: testing section documents the runner.

## Verification (AI-side, no native run owed — scripts only, no `src/` touched)

* `package.json` still parses; all 45 stems in `test.sh`'s list exist under
  `test/node/`; `sleeve-runs.sh` keeps its six stages + `all` (explicit only).
* No ledger/check-count impact (no test files touched).

## Operator commands (in order)

```bash
bash scripts/test.sh quick
bash scripts/test.sh full
bash scripts/round30-runs.sh gh
```

`quick` is seconds (structural gate); `full` = `npm test` 132/132 (~6 min); `gh` is the
TODO-113 K=6 re-run — upload `state/runs/<runId>/report.json`.
