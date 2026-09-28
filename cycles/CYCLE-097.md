# CYCLE-097 — Round 64: W4c-y forecast combination

**Date:** 2026-09-29
**Goal:** give the vol program its literature-standard next step after HAR: combinations of rival forecasts, with estimated weights kept honest by a weight-train/weight-test split.

## Research sync

A targeted arXiv sync (`"forecast combination" AND volatility`, 2026-09-29) returned 4 hits; the directly relevant one is **Audrino & Knaus, "Lasso-based forecast combinations for forecasting realized variances" (arXiv 1610.02653)**: lasso-regularised combinations win on realized-variance panels because the combination hedges model-parsimony risk. Raw response archived at `docs/research/raw/arxiv-sweep-2026-09r.json`. This round also closes a citation gap left by round 58: neither Corsi (2009) nor the range-estimator papers were ever entered in `CITATIONS.md` — the new volatility-forecasting block adds Corsi 2009, Parkinson 1980, Garman-Klass 1980, Rogers-Satchell 1991, Yang-Zhang 2000, Bates-Granger 1969, Timmermann 2006, Patton 2011 and Audrino-Knaus 2016.

## Landed (repo, round 64)

* `forecast.js` W4c-y block (7 exports): `fitCombineWeights` (OLS, no-intercept default, singular guard via the shared `w4cSolveNormal`), `inverseMseWeights` (Bates-Granger-style 1/MSE, refuses exact columns), `fitLassoCombineWeights` (deterministic coordinate descent, zero init, soft-threshold), `predictCombine` (NaN fail-closed, matching the predictAr/Har convention), `tournamentCombineVolForecast` (seven-way: ewma/ar/har/eq/inv/ols/lasso; weights fit on the first OOS half, all seven scored on the second against the causal train-mean flat; ties break toward the simpler model), `...AcrossSplits` (per-model win counts + combine share), `...Panel` (combine/HAR majorities + unanimity flags).
* Ten §BA checks (`analysis` 811 → 821, ledger 3009 → 3019); seven lock-registry exports; node mirror re-pinned to 821. Harness green (821/0).
* One self-caught failure during the round: the `predictCombine` check's hand dot product read 1.5 for 0.5+0.5+0.75 — the check was wrong (1.75), the code was right. Fixed in the check.

## Measured (lab)

* `e101_combine_challenger.js` (5/5, 83 s): OLS combination holds the split majority on 7/8 streams 5/5 (XRP 3/2 vs HAR); panel combine-majority 8/8, HAR-majority 0/8; mean best-combine margin over HAR positive everywhere but hair-thin (+0.0000…+0.0002) (F-111).

## Decision

Combination joins HAR as a sizing reference candidate; it does not replace HAR on margins this thin. Follow-ups (documented, not built): QLIKE-second-skill confirmation of the seven-way ranking, and an expanding-grid combination (refit weights through `expandingVolForecasts`-style grid). `forecast.js` is now ~1500 lines — the file-split recipe is documented below rather than executed (the import-law surface `LAW_FILES`/`CORE_IMPORTS`/`CORE_MODULES`/`PLUGIN_REGISTRY` plus every test import path would have to move in one commit; the safe split is `forecast/combine.js` + `forecast/range.js` + `forecast/tournament.js` behind exact re-export shims, verified by the unchanged 821-check ledger). Remaining W6 rows L10-co/cp/cq/cr, W5 venues, G5 — all needing native runs. Hand to `npm test`.
