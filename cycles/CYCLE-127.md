# CYCLE-127 — Round 97: decision split + e125 flow-reversal NEGATIVE

**Date:** 2026-10-01
**Goal:** two tracks — (a) foundations: split the registered module
`analysis/decision.js` (689 lines) with full registry ceremony; (b) model
track: test TODO 88's task-defined reversal (e125) on 15m with the lab's
taker-flow series.

## Work

* **Foundations: `analysis/decision.js` → `analysis/decision/` ×5 + shim.**
  `measures.js` (concentration + persistence; `isNum`/`na` exported for
  inter-part use — the round-74 precedent), `plan.js` (next-run plan, both
  private helpers stay in-part), `report.js`, `format.js`, `cadence.js`.
  Bodies byte-identical except the two `export` prefixes. One self-caught
  bug: the shared guards sat between the file header and the first banner,
  outside every sliced zone — restored into `measures.js`, caught by the
  harness build before any suite ran. Registry: five `ANALYSIS_MODULES`
  rows (exact lists, inter-part marks) + five `ANALYSIS_REGISTRY` rows
  (INVARIANT, analysis + analyze) + `locks.test.js` imports/map. The shim
  keeps the exact 7-name contract (no guard leakage).
* **Verified AI-side.** Baselines first (analysis 856/0, analyze 294/0,
  locks 41/0), then post-split: 856/294/41/0 plus contracts 255/0; shim
  bundles with all names present and no guard leakage.
* **e125 flow-reversal 3/3 NEGATIVE (F-138).** Raw ±1/0 fade-the-prior-sign
  arrays (no z pipeline — binary needs none) on the 15m majors panel with
  taker_15m attached, `|flowChange|` trailing-500-rank quintiles (causal):
  fade-all Sharpe 0.17 / BE 0.43 bps / HR 0.5046 (a whisper of reversal,
  untradeable); no quintile gradient (Q5 BE 0.31 < all, HR flat
  0.503–0.506); random control null. TODO 88 CLOSED-negative on the
  bar-flow proxy. Remaining caveat (not chased): 2608.21888 classifies
  aggressive flow at trade level; our bar-level `|flowChange|` proxy may be
  too coarse — unblock is trade-level aggressor flags, filed in the item.
* **Research:** 10c attempted twice (503, then transport timeouts) —
  recorded, not chased; this round's grounding stands on 10b/2608.21888.
* **Rerank.** Top tier unchanged: 116 + 118 (stacked read) + fade G5
  (106/108) + 111 (control-defined, blocked). TODO 88 measured closed.
  Queued: 95 remainder, 104, 117 (behind 116), L10-co/cp/cq/cr, W5 venues.

## Result

F-138 (e125 NEGATIVE: no flow-conditioned reversal on the bar proxy).
Regressions: e123 4/4, orchestrator intact. S41→S42. Operator commands:
`npm test` (no uploads).
