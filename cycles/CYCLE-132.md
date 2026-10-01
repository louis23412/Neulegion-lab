# CYCLE-132 — Round 102: features split + lambda-plateau + research resumes

**Date:** 2026-10-01
**Goal:** three tracks — (a) foundations: split the registered
`analysis/features.js` (545 lines); (b) model track: the λ-plateau test
(e130 — is the pinned 0.02 on a plateau or a pinnacle?); (c) research:
retry the arXiv endpoint (10e).

## Work

* **Foundations: `analysis/features.js` → `features/` ×4 + shim.**
  `position.js` (bounds + causal z-score + per-candidate positions),
  `base.js` (8 shipped features + default table; keeps the labels.js
  import; exports the private window helpers for inter-part use),
  `reversal.js` (4 reversal fns + table; imports meanOf/varianceOf),
  `upgrades.js` (panel tools + 4 SIGUP fns + table; imports
  helpers + momentum). Anchor-based slicing with an exact-reconstruction
  check (true). Bodies byte-identical except the three helper `export`
  prefixes (round-74/98 precedent, not re-exported by the shim).
* **Registry/locks (R97 recipe).** Four `KNOWN_TESTS` rows (helpers marked
  inter-part-only, à la decision/measures) + four module rows;
  four imports + four map rows in `locks.test.js`.
* **Verified AI-side, first try** (after one self-caught missing import:
  `xsMomentum` calls base `momentum` — the code-vs-comment scan caught it
  before the harness ran). `locks.test.js` 41/0, `analysis.test.js` 856/0.
  No golden moves.
* **e130 lambda-plateau 4/3 (F-143).** λ ladder 0.005–0.05 through the
  repo's own `buildFundingBook` + pinned 12.5% cap: plateau CONFIRMED
  (0.01–0.03 range 0.03, pinned 0.34 dead-center between 0.35/0.32) — but
  the pre-registered turnover check had the sign backwards (turnover RISES
  10× with speed, 14.7→146.3; BE falls 153→20). Verdict NEGATIVE on the
  letter, substance SUPPORTS plateau + the speed mechanism with the correct
  sign (and reconciles e126 from the other side). No re-run (that would be
  gate-shopping); no spec change; no TODO. One self-caught import
  (`rowRankWeights` lives in primitives/index).
* **Research 10e** (6 grounded notes — endpoint answers again): 2605.11263
  (Ethena delta-neutral funding-carry convergence for R8), 2601.10812
  (funding-aware liquidation → TODO 95 task form), 2506.08573 (funding
  design mechanism support), 2607.11888 (funding-exposure PnL split →
  TODO 111 task form), 2510.27334 (HFT selection → TODO 111 block),
  2508.20225 (quoting context). Retrieval doctrine holds a fourth time.
* **Housekeeping.** Lab INDEX headers updated (still said F-01…F-87;
  now F-01…F-143).
* **Rerank.** Top tier unchanged: 116 + 118 (stacked read) + fade G5
  (106/108, operator) + 111 (task forms sharpened by 10e, still
  data-blocked). TODO 95 remainder gains the 2601.10812 liquidation task
  form. Queued: 104, 117 (behind 116), L10, W5 venues.

## Result

F-143 (e130 + sign-corrected mechanism). S46→S47. Operator commands:
`npm test` (covers the `features/` split + registry rows; no uploads).
