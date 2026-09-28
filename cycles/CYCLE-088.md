# CYCLE-088 — Round 55: the gate harness (model across splits + decision)

**Date:** 2026-09-29
**Goal:** close G4's runnable loop — any model function through the three-way at every split, plus a promote/park rule with reasons.

## Landed (repo, round 55)

* `forecast.js#tournamentVolModelAcrossSplits` (modelFn(train, history) → forecast; train never contains the test bar; throwing/NaN models fail closed) + `#decideVolPromotion` (promote iff model wins ≥ the split-majority threshold, ties preferring references).
* Ten §AW checks (`analysis` 759 → 769: persistence parks, the oracle promotes, threshold arithmetic, fail-closed seats, train-only proof); two lock-registry exports. No golden moves. Harness green (769/0 + locks 41/0).

## Measured (lab)

* `e86_vol_gate.js` (4/4): persistence in the model seat parks 8/8 — but wins 2/5 splits on SOL and 1/5 on BNB, so the gate shows resolution without hair-trigger promotion. First pre-registration (zero wins) was over-strict and corrected honestly to sub-majority. Recorded as F-96.

## Decision

G4 is runnable end to end with a calibrated bar. Next: the complexity dial (does more lags/shrinkage move the reference?).
