# CYCLE-158 — Experiment e138: vol-tournament level alignment (10o-1 closed)

**Date:** 2026-10-02
**Goal:** close the sweep-10o method checklist with a measurement instead of
a note: does the W4 vol tournament's raw-MSE ranking survive level alignment?

## Method

Synthetic AR(1)-truth vol paths (5 seeds, T=1500, split-half): repo EWMA vs
repo AR(1) (fixed train fit, rolling one-step predicts) vs flat climatology.
Alignment bias estimated on the TRAIN half (the paper's validation form).
Pre-registered: FAIL (L10 row) iff a sub-1σ level bias flips raw-MSE on a
majority of seeds.

## Result: 8/8 SUPPORTED, no L10 row

* Repo EWMA/AR/MSE/QLIKE all match independent recomputes (1e-9…1e-12).
* Tournament premise holds on AR truth (AR > EWMA > flat, 5/5).
* Alignment never flips the ranking; QLIKE agrees with aligned MSE 5/5.
* Flip threshold median **1σ** (per-seed 1.25/1/1/1/1): raw MSE flips only at
  ≥ 1 realised-vol-sigma of level bias — the MSE leg is level-robust at
  realistic bias sizes, and the QLIKE second skill covers the rest.
* One self-caught bug during the build (train-half bias estimated off NaN
  pre-split rows → NaN bias; fixed to rolling one-step train predictions,
  re-ran green). The experiment's own falsifier fired on the bug, not the module.

## Files

* `experiments/e138_vol_level_alignment.js` (new), registered in `run_all.js`
  (import + gated step + results write), artefact in
  `results/e138_vol_level_alignment.json`.
* Finding F-168; repo record RUN-ANALYSIS §73.

## Rerank

Unchanged. e138 is background assurance for W4, not a gate or a promotion.
