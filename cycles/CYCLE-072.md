# CYCLE-072 — Round 39: L10-cs paired-test exclusion + A18 stress readouts

**Date:** 2026-09-28
**Goal:** close the last named W6 measurement row (L10-cs) and cut the audit amendment's stress requirement (A18) into executable primitives — both with synthetic ground truth in the repo harness.

## Work (repo, round 39)

* **L10-cs** (`analysis/walkforward.js`): `poolReports`/`restateReportAtCost`/`restateReportAtPolicy` retain the price-only panel (`priceStreamReturns`/`priceStreamFoldLengths`) beside the sleeve-extended one, and `clustersOf` clusters the price panel — so the paired test is byte-identical with or without an identical sleeve on both reports. The DSR design effect still counts the sleeve (that is the independence purchase); only the paired test and `blockStability` (round 32) exclude it. Five `walkforward` checks. 85 → 90.
* **A18** (`analysis/portfolio.js`): `stressHalves` (split-half Sharpes + min) and `worstBlock` (weakest contiguous-block Sharpe, tail-aligned like `blockStability`). Four `analysis` checks. 673 → 677.
* Registry: `stressHalves`/`worstBlock` added to `ANALYSIS_MODULES`; walkforward needs no registry change (no new exports); `locks` 41/0 unchanged.
* Ledger: **2805 → 2814** (RUNBOOK §6 table + round note, node mirrors 673/677 + 85/90, DESIGN/LOCKED pins, ROADMAP snapshot + suite line, `src/README.md` ledger).

## Verification (browser harness)

* `analysis` **677/0**, `walkforward` **90/0**, `locks` **41/0**, `analyze` **286/0**, `contracts` **141/0** — all green in-harness at the freeze.
* Two self-caught fixture mistakes during the build (a `value`-vs-`estimate` field name and a nested `foldLengths` shape), both fixed before landing; no golden moves.

## Lab effects

* None on lab numbers. FOLD-BACK: L10-cs closed at the repo layer; A18 is now executable on any scored book via `scoreSleeveBook` + `stressHalves`/`worstBlock`.

## Next

* R40 `--sleeve` driver mode (sleeve book through the unchanged gate, pooled at the run's K) for the G2 number, then the full-history sleeve verdict (G1b) and the G5 portfolio conjunction.
* Native `npm test` on the operator machine required before further landings (nine report-layer edits since the 131/131 confirmation, including the paired-test cluster path the browser harness covers only synthetically).
