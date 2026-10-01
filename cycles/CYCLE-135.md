# CYCLE-135 — Round 105: restate split + predictive-smoother + research 10h

**Date:** 2026-10-01
**Goal:** three tracks — (a) foundations: split the registered
`analysis/walkforward/restate.js` (555 lines); (b) model track: the
predictive-smoother challenge (e133 — can an AR(1) funding forecast beat
fixed EWMA at rank persistence?); (c) research: fresh sweep (10h) on
rebates/premia/crash-risk.

## Work

* **Foundations: `analysis/walkforward/restate.js` → `restate/` ×3 + shim.**
  `costs.js` (cost restatement; owns `withExtraPanelStreams`, exported
  inter-part-only), `policies.js` (policy restatement + round-trip check),
  `exposure.js` (dead zone, cadence, matched pair, cost ladder). Real calls
  mapped line-by-line (comment mentions excluded); bodies byte-identical
  (aOk/bOk/cOk true). One cleanup: unused `confidenceToPosition` import
  dropped (import + comment mention only, zero calls).
* **Registry/locks (R97 recipe).** Three `KNOWN_TESTS` rows + three module
  rows; three imports + three map rows in `locks.test.js`.
* **Verified AI-side, first try.** `locks.test.js` 41/0, `analysis.test.js`
  856/0, `walkforward.test.js` 90/0, `analyze.test.js` 294/0. No golden moves.
* **e133 predictive-smoother 4/2 NEGATIVE (F-146).** Causal recursive AR(1)
  per funding series (trailing-168 OLS, ≥24-pair warmup), rank the one-step
  predictions, same rho curve: pred rho1 0.70/0.72 vs manufactured 0.992 both
  panels (raw 0.52/0.42 recomputed by e129). Forecastability exists but the
  constructor wins by 0.27–0.29 — the adoption bar fails with plumbing green
  (finite; smoother replicates e129). Fixed EWMA stands; the 10g idea is
  consumed (no bigger-forecaster variant: gated behind this bar per
  2603.16886). e132 regressed 4/4. No spec change, no TODO.
* **Research 10h** (thin-honest): 3/5 queries empty; both hits already filed
  (recorded as convergence, no doc change).
* **Rerank.** Top tier: 116 + 118 + fade G5 + 111 (blocked). Model track
  rests (pinned spec plateaued twice, challenger beaten). Queued: 117,
  L10, W5 venues.

## Result

F-146 (e133 NEGATIVE with substance). S49→S50. Operator commands:
`npm test` (covers the `restate/` split + registry rows; no uploads).
