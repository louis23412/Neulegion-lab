# CYCLE-119 — Round 89: the `--symbols` path fix (operator log → fix + pin)

**Date:** 2026-09-30
**Goal:** fix the `gh` ENOENT (`src/src/candles.jsonl`), pin it so it cannot recur,
re-issue the operator commands.

## Bug

`bash scripts/round30-runs.sh gh` died in `readCandles` before scoring: every
`--symbols` run resolved manifest entries to `<root>/src/src/...`. The round-83 split
moved `resolveSymbolFiles` from `src/analyze.js` to `src/analyze/cli.js` without adding
the second `'..'` (the two `../` fixes that round did land were imports + worker URL).
No test covered `--symbols`, so 132/132 stayed green around it.

## Fix (repo, needs `npm test`)

* `src/analyze/cli.js`: root steps up twice; `resolveSymbolFiles` exported.
* `test/browser/entries/analyze.test.js`: four §J2 checks (manifest-true mapping, no
  `src/src`, full 1:1 coverage, case + unknown-symbol error). AI-side 294/294.
* Pins: node mirror 290 → 294, `RUNBOOK.md` ledger 3119 → 3123 (verified against the
  AI-side entry sum, bench excluded by design), `RUN-ANALYSIS.md` §34.
* No scored-path change, no golden moves. `--files` stages were never affected.

## Operator commands (in order)

```bash
bash scripts/test.sh quick
bash scripts/test.sh full
bash scripts/round30-runs.sh gh
```

Upload `state/runs/<runId>/report.json` from the `gh` run.
