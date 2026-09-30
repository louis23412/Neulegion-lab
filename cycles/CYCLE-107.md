# CYCLE-107 — Round 80 AI-side: positioning sleeves reproduce through the repo path

**Date:** 2026-09-29
**Goal:** TODO 110 pre-native gate — verify `oi-change` + `toptrader-fade` score their lab levels through the repo `runSleeveReport` (vendored OI, real funding + candles as text) before asking the operator for a native run.

## Research sync
Sweep 09y (RUN-ANALYSIS §23.4) already grounds this step: 2607.27461 (return rank unforecastable, vol rank forecastable — supports F-122 null + vol sizing), 2608.21888 (15m reversal taker-inaccessible — TODO 94 queued), 2605.05089 (basis as collateral control — TODO 95 leg). No new sweep this cycle; the OI vendoring (byte-equal to the lab harvest) + e112 carry the evidence.

## Measured (lab, read-only on the repo)
* `e112_oi_sleeve_score.js` (15/15, ~2 s, artefact `results/e112_oi_sleeve_score.json`): oi-change net@4 **0.67** / 197x / BE 11.4 (F-45 band), fade **1.054** / 7.93x / BE 185.1 (F-51), both 6606x8, coverage 81%/67%, slopes +0.02/+0.01 (no decay), DSR 0.9305/0.9664. F-123.
* Honest-run confirmation (read-only): `src/runs/20260929T215723-seed1-sleeve/report.json` bit-matches §23.1 (net 6.25 / 10.01 / 43.83, yearly +0.21→+0.11 slope -0.015, first-last +0.212→+0.196 Δ -0.016±0.05, DSR 1.0 DE 2.84, G5 false on decay/unseen). The shipped-marks decay was a marking artefact (§23.2); the honest level stands as a marked-carry claim.

## Decision
TODO 110 AI-side **passes**; native gate pending (no repo code changed — docs + lab only). Next: operator `bash scripts/sleeve-runs.sh oi/top` + `npm test`, then the analyze.js foundations split (217k driver is the biggest module left).
