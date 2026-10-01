# CYCLE-136 — Round 106: report split + cost-ladder + research 10i blocked

**Date:** 2026-10-01
**Goal:** three tracks — (a) foundations: split the registered
`analysis/walkforward/report.js` (513 lines); (b) model track: the
pinned-book cost ladder (e134 — where does cost eat the carry book?);
(c) research: fresh sweep (10i) on inventory/carry/liquidation-impact.

## Work

* **Foundations: `analysis/walkforward/report.js` → `report/` ×2 + shim.**
  `pooling.js` (rectangular-grid pooling + dependence/power blocks; unused
  `backtestMetrics` import dropped), `gate.js` (paired tests + hurdle
  decision). Real calls mapped line-by-line; bodies byte-identical
  (aOk/bOk true).
* **Registry/locks (R97 recipe).** Two `KNOWN_TESTS` rows + two module rows;
  two imports + two map rows in `locks.test.js`.
* **Verified AI-side, first try.** `locks.test.js` 41/0, `analysis.test.js`
  856/0, `walkforward.test.js` 90/0, `analyze.test.js` 294/0. No golden moves.
* **e134 cost-ladder 4/3 (F-147).** Pinned book at 0/2/4/10/25 bps, majors +
  stacked-16: NEGATIVE on the letter only — my ladder top (25bps) sits below
  the majors crossing (~43bps per BE 42.88; net +0.16 at 25). Stacked crosses
  at 25 (−0.02, BE 24.11). Monotonicity + finiteness + 4bps coherence pass
  (both lanes reproduce e131/e132 to the digit). No re-run (gate-shopping);
  the curve is the product (recorded descriptively). No spec change, no TODO.
  e133 regressed 4/2. New: native-run expectations set (stacked dies ~25bps,
  majors survives past it — TODO 118 reads against this).
* **Research 10i BLOCKED** (503 + timeouts; 6th failure; sync pauses).
* **Rerank.** Top tier: 116 + 118 + fade G5 + 111 (blocked).
  Queued: 117, L10, W5 venues.

## Result

F-147 (e134 mechanism-holds NEGATIVE). S50→S51. Operator commands:
`npm test` (covers the `report/` split + registry rows; no uploads).
