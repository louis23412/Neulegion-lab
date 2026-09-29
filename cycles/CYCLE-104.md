# CYCLE-104 — Round 71: `forecast.js` split (foundations)

**Date:** 2026-09-29
**Goal:** `analysis/forecast.js` (~1850 lines, 50 exports, rounds 26–67) is the biggest module left — split it into managed parts per the CYCLE-097 recipe, with zero behavior change.

## Landed (repo, round 71)

* `analysis/forecast/` (6 parts, byte-exact `copy_lines` moves): `scoring.js` (Brier/Murphy/DM/MCS/comparison/renderer, keeps the original header + the only external imports), `vol.js` (W4b core, zero imports), `range.js` (range estimators + HAR + expanding grid; exports the shared `w4cSolveNormal` instead of duplicating the solver), `combine.js` (frozen combination), `sizing.js` (vol-target scaling), `online.js` (rolling combination). Dependency DAG is acyclic (range→vol, combine→vol+range, online→vol+range+combine; all cross-part use inside function bodies).
* `analysis/forecast.js` is now a re-export shim carrying exactly the 48-name registered contract (`w4cSolveNormal` stays reachable via `range.js` only, so the shim adds no new export).
* Registry: six `ANALYSIS_MODULES` rows + six `ANALYSIS_REGISTRY` rows (INVARIANT, `analysis.test.js` proves, literature citations); `locks.test.js` imports + map extended. No check counts move anywhere (pure move — ledger stays 3078, mirrors untouched).
* Two self-caught failures during the round, both caught by the harness before any green run: the copied `../legion`/`./performance` imports needed one more `../` at the new depth, and two cross-part calls the map missed (`volForecastQlike` in combine, `inverseMseWeights`/`fitLassoCombineWeights` in online) — the 850-check suite named both precisely.

## Verified (no new numbers — a foundations round)

* locks 41/0 (both-directions export contract on all six parts + the shim identity), analysis 850/0, contracts 221/0, analyze 289/0, guards 65/0; lab e101/e102/e103/e104/e105 green through the shim. The locks §J check is the shim-identity proof (a listed-but-missing or an unlisted export fails it).

## Decision

The vol program's home is now six reviewable files; the next estimator/tournament work lands in the open part, not in a 1850-line file. Remaining: W5 venues (operator data), W6 L10-co/cp/cq/cr (golden-adjacent, need a re-freeze decision), G5 gate runs (native). Hand to `npm test`.
