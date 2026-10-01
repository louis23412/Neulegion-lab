# CYCLE-133 — Round 103: backtest split + cap-plateau + research 10f

**Date:** 2026-10-01
**Goal:** three tracks — (a) foundations: split the registered
`analysis/backtest.js` (410 lines); (b) model track: the cap-plateau test
(e131 — is the pinned 12.5% on a plateau or a pinnacle?); (c) research:
fresh targeted sweep (10f) on the open legs.

## Work

* **Foundations: `analysis/backtest.js` → `backtest/` ×3 + shim.**
  `primitives.js` (7 lagged-position/cost/equity fns, no imports),
  `metrics.js` (full-report metrics + fold pooling; keeps the performance.js
  import; the `annualizeSharpe` re-export sits with its import here — the one
  documented move, off the file end), `folds.js` (private scoreFold, serial +
  concurrent purged-CV, annualization; imports primitives + metrics +
  parallel). Bodies verified byte-identical per-part (pOk/mOk/fOk true).
  One self-caught missing import before writing the shim (`metrics.js` calls
  equityCurve/maxDrawdown/hitRate/tradeCount — wired to primitives).
* **Registry/locks (R97 recipe).** Three `KNOWN_TESTS` rows + three module
  rows; three imports + three map rows in `locks.test.js`.
* **Verified AI-side, first try.** `locks.test.js` 41/0, `analysis.test.js`
  856/0, `walkforward.test.js` 90/0, `analyze.test.js` 294/0 (all four
  consumers covered). No golden moves.
* **e131 cap-plateau 4/4 SUPPORTED (F-144).** Cap ladder 0.0625–0.5 through
  the repo's own `buildFundingBook` (pinned λ 0.02) + `cleanBook` + sleeve
  returns @ 4bps: plateau CONFIRMED (0.0625–0.25 range 0.02, pinned 0.34
  level with best neighbor 0.33); cap binds monotonically (mean maxAbs
  0.0625 → 0.2427 at 0.25); midcap finite (0.51/0.55/0.51). Coherence:
  the 0.125 lane bit-matches e130's pinned-0.02 lane (0.3404/60.35/42.88)
  through the other ladder axis. e130 regressed 4/3 (same recorded NEGATIVE).
  No spec change, no TODO.
* **Research 10f** (5 grounded notes): 2603.09164 (SaR liquidation-execution
  task form → TODO 95), 2603.01298 (closed-loop vol control → TODO 104
  amendment, explains e126), 2607.27070 (cascade heterogeneity → TODO 95),
  2602.15182/2512.01112 (ADL haircuts on profitable accounts → TODO 95
  venue context), 2606.15715 (sunshine execution → TODO 111). Two narrow
  queries empty, recorded not chased.
* **Rerank.** Top tier unchanged: 116 + 118 (stacked read) + fade G5
  (106/108, operator) + 111 (sunshine context, still data-blocked). TODO 95
  gains the SaR form + ADL context; TODO 104 the closed-loop amendment.
  Queued: 117 (behind 116), L10, W5 venues.

## Result

F-144 (e131 SUPPORTED). S47→S48. Operator commands:
`npm test` (covers the `backtest/` split + registry rows; no uploads).
