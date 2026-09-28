# CYCLE-087 — Round 54: QLIKE second skill + OLS audit

**Date:** 2026-09-29
**Goal:** make the ranking survive the loss function (F-16's own metric) and audit the new OLS solver against synthetic ground truth.

## Landed (repo, round 54)

* `forecast.js#volForecastQlike` (Patton-2011 `r − ln r − 1` with MSE-style skill vs a baseline; skips non-positive pairs, fails closed on degenerate baselines).
* Eight §AV checks (`analysis` 751 → 759); one lock-registry export. Two checks initially failed on degenerate test baselines (baseline == actual → QLIKE 0) — fixed in the checks, not the helper. No golden moves. Harness green (759/0 + locks 41/0).

## Measured (lab)

* `e84_ols_audit.js` (6/6): synthetic AR(1) recovery (phi 0.7082 vs 0.7) + 1.5e-15 agreement with an independent sum-formula solve. Recorded as F-94 — the Gauss-Jordan path is exact.
* `e85_vol_qlike.js` (4/4): EWMA +0.858…+0.936, AR +0.988…+0.995 — AR wins 8/8 under QLIKE too. Recorded as F-95.

## Decision

The ranking is not a loss-function artefact and the solver is exact. Next: the full gate harness (model across splits + promote/park).
