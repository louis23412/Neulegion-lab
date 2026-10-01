# CYCLE-129 — Round 99: roster split + quantized-sizing NEGATIVE (flat stands twice)

**Date:** 2026-10-01
**Goal:** two tracks — (a) foundations: split `analyze/roster.js` (505
lines), completing the `analyze/` modularization; (b) model track: run the
filed quantized-regime sizing test (e127, TODO 119).

## Work

* **Foundations: `analyze/roster.js` → `analyze/roster/` ×3 + shim.**
  `tables.js` (variant tables + constants, keeps the file head),
  `registration.js` (queries; imports ALL/RESOLVABLE tables),
  `policy.js` (policies, model, resolution; imports RESOLVABLE tables).
  Bodies byte-identical, no new exports. Two self-caught path bugs (the
  familiar one-level-deeper class): tables.js kept unadjusted imports, and
  the first shim draft re-exported part names from the tables part — both
  caught by the harness build. The shim keeps the exact 18-name contract.
  Unregistered → no registry/ledger change. `analyze/` (roster, models,
  evaluate, cli) is now fully modular.
* **Verified AI-side.** Baselines first (analyze 294/0, locks 41/0), then
  post-split plus contracts 255/0; shim bundles complete.
* **e127 quantized-sizing 4/4 NEGATIVE (F-140).** 2-state HIGH/LOW
  (1.2/0.8 hysteresis, 90-bucket min-hold, 1.25/0.75 scales) through the
  repo score path: turnover controlled (1.4× flat both panels,
  transitions ~monthly as designed) but BE falls (42.9→30.5 majors,
  39.5→27.1 midcap) and Sharpe slips. Reading: quantization fixed the
  turnover kill but the regime signal has no timing skill — dispersion
  LEVEL does not predict carry returns; the R8 edge is in the XS RANK,
  not the level. Flat sizing stands twice (e126 + e127); TODO 119
  measured-closed. No third sizing variant (target-risk application
  parked, not filed — two mechanism-backed negatives are enough).
* **Research 10c** (`docs/research/raw/arxiv-sweep-2026-10c.json`): three
  failed attempts then one precise quoted query (10 hits, 1 new grounding
  + 1 carryover). 2112.07386 (CEX/DEX fee-regime venue differences)
  amends the venue rule again. Retrieval doctrine confirmed a third time.
* **Rerank.** Top tier: 116 + 118 (stacked read) + fade G5 (106/108) +
  111 (blocked). TODO 119 measured-closed. Queued: 95 remainder, 104,
  117 (behind 116), L10, W5 venues (fee-alignment amendment).

## Result

F-140 (e127 NEGATIVE + rank-not-level reading). S43→S44. Operator
commands: `npm test` (no uploads).
