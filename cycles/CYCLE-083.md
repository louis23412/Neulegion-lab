# CYCLE-083 — Round 50: the W4b tournament (EWMA vs fitted AR(1), OOS)

**Date:** 2026-09-29
**Goal:** give W4b's falsifier ("a learned forecaster beats causal EWMA on realized vol, OOS, at matched exposure") a runnable mechanism — the first repo code a model plugs into.

## Landed (repo, round 50)

* `forecast.js#fitArVolForecast` (causal OLS AR via normal equations + Gauss-Jordan, fail-closed on short/singular trains), `#predictArVolForecast` (history-only one-step-ahead), `#tournamentVolForecast` (half-split OOS skill of EWMA vs AR against the train-mean baseline, winner + beatsEwma flag). Additive; no scored path reads them.
* Ten §AR checks (`analysis` 717 → 727); three lock-registry exports (`fitArVolForecast`, `predictArVolForecast`, `tournamentVolForecast`). No golden moves. Harness green (727/0 + locks 41/0).

## Measured (lab)

* `e79_vol_tournament.js` (5/5): on the real 1h panel (window 24, split 0.5) EWMA skill +0.749…+0.903, AR(1) +0.978…+0.992 — AR beats EWMA 8/8. Recorded as F-89. The reference a model must beat is now the fitted AR(1), not the EWMA.

## Decision

W4b's hypothesis is supported by the cheapest learned model. Next: split-robustness (the F-55 lesson) before any gate is built on it.
