# CYCLE-123 — Round 93: midcap harvest + e121 SUPPORTED (TODO 115 CLOSED, 116 filed)

**Date:** 2026-09-30
**Goal:** execute TODO 115 (symbol breadth) end to end: harvest, vendor, measure.

## Work

* **Harvest 216/216 monthly zips** (`harvest_midcap_1h.js`, durable): 8 symbols x
  27 months, 19,728 bars each, zero gaps/missing. Vendored at
  `data/midcap/` + `manifest.json` (~17 MB).
* **e121 green 6/6** (`results/e121_symbol_breadth.json`, in `run_all.js`):
  calibration bit-matches 1.0848; stacked effStreams 2.35 vs 1.75 (1.35x) with
  rbar 0.51 → 0.39 → SUPPORTED (F-134). Window Sharpe ~0.13 everywhere (F-01
  face — dependence verdict, not edge); midcaps add breadth, no extra edge.
* **TODO 115 CLOSED, 116 filed** (native port + 16-symbol `gh`, operator-owned,
  manifest route verified: `CANDLE_MANIFEST` in `src/candles_audit.js`).
* **Sanity:** artefact matches final code; lineage untouched (no register change);
  `run_all.js` e121 step registered.

## Rerank

Top tier: TODO 116 (native breadth) + fade G5 (106/108, operator) + TODO 111
(model track). W5: sleeves-as-streams (re-freeze-gated) + venues follow-up;
W5.4 CLOSED; R5 held. Queued: 95 remainder, 104, L10 kernels.

## Operator commands

None this round (AI-side only). TODO 116 is the next native job when scheduled.
