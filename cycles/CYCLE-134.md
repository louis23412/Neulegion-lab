# CYCLE-134 — Round 104: scoring split + stacked-cap + research 10g

**Date:** 2026-10-01
**Goal:** three tracks — (a) foundations: split the registered
`analysis/forecast/scoring.js` (521 lines); (b) model track: the stacked-16
cap ladder (e132 — does the 16-wide book want a different cap?); (c) research:
fresh targeted sweep (10g) on fees/basis/funding-predictability.

## Work

* **Foundations: `analysis/forecast/scoring.js` → `scoring/` ×3 + shim.**
  `scores.js` (pair extraction + Brier/Murphy/log; keeps the performance.js
  import; private `isArr`/`finite` gain `export` for inter-part use),
  `resampling.js` (shared bootstrap draws + DM + MCS; imports rng + mean +
  stationaryBlockIndices + guards), `comparison.js` (family comparison +
  renderer; imports scores + resampling). Bodies verified byte-identical
  (aOk/bOk/cOk true); the apparent cross-references are comment mentions,
  confirmed by line-level scan before cutting.
* **Registry/locks (R97 recipe).** Three `KNOWN_TESTS` rows + three module
  rows (citations restricted to each part's literature); three imports + three
  map rows in `locks.test.js`.
* **Verified AI-side, first try.** `locks.test.js` 41/0, `analysis.test.js`
  856/0, `walkforward.test.js` 90/0, `analyze.test.js` 294/0. No golden moves.
* **e132 stacked-cap 4/4 SUPPORTED (F-145).** Cap ladder 0.0625–0.5 on the
  window-matched stacked-16 grid (e124 plumbing, 2466 buckets): plateau
  CONFIRMED (range 0.01, pinned 0.40 = best neighbor 0.40); binds
  monotonically (0.0625 → 0.1529). New: 0.25/0.5 lanes identical — no 16-wide
  weight ever reaches 0.25, so caps ≥ 0.25 are no-ops (self-diversification).
  The pinned 12.5% ports to the 16-panel unchanged — TODO 116/118 de-risked.
  e131 regressed 4/4 (same SUPPORTED). No spec change, no TODO.
* **Research 10g** (3 grounded notes): 2601.10812 re-retrieved (TODO 95 form
  converges across queries); 1912.03270 (GARCH funding forecastability →
  queued e133 predictive-smoother idea); 2201.04699 (71%-funding PnL →
  premise support). Thin, honest, recorded.
* **Rerank.** Top tier: 116 (de-risked) + 118 + fade G5 + 111 (blocked).
  Queued: 117 (behind 116), e133 (10g idea), L10, W5 venues.

## Result

F-145 (e132 SUPPORTED). S48→S49. Operator commands:
`npm test` (covers the `scoring/` split + registry rows; no uploads).
