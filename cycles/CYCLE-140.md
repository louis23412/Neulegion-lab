# CYCLE-140 — Coherency + sanity sweep (operator-ordered, no measurement round)

**Date:** 2026-10-02
**Goal:** end-to-end coherency/sanity across repo + lab; fix dead imports and
stale docs; rerank + archive the open-item backlog; close the 10l carryover
queries. No scored-path change, no new experiment, no TODO opened.

## Work

* **Dead-import sweep (repo `src/`, 210 files).** Zero dead relative targets
  (every shim resolves). 92 unused named bindings found; 14 kept (comment-only
  mentions); 78 removed across 26 files (split-leftover import blocks in
  `analyze/models/*`, `analyze/evaluate/*`, `analyze/cli/*`, `sleeve/*`,
  `plugins/*`, `decision/*`, `hivemind/*`, `features/upgrades.js`). Empty
  statements kept as side-effect imports. All 26 re-parsed clean (acorn).
* **Verified AI-side.** Full browser suite 3123/0 (counts bit-equal to the
  ledger: analyze 294, analysis 856, walkforward 90, locks 41, contracts 255,
  modules 59, rest unchanged); bench returns timings only, as designed. Lab
  e136 4/4 + e137 27/27 re-run green through the edited sleeve modules.
  `test.sh` ALL covers all 45 node files, 0 orphans. Lab→repo imports 0 dead
  (149 files). 34 stale doc-path hits triaged: all false positives (`.jsonl`
  substring matches, quoted error strings, historical round records, an `e.g.`
  example) — no fix needed.
* **Doc sync.** Lab INDEX F-147→F-150 (×2), run_all 81→145 steps (INDEX +
  lab README); src README lab counts → 150 findings / CYCLE-139, status header
  → rounds 80–109. Historical per-cycle step counts left untouched.
* **Backlog rerank + archive (repo TODO.md).** Fresh round-109 rerank note
  (top tier 116 → 118 with cap+band read → 117-if-confirmed; owed `npm test`
  for R109; G5 second; queued/parked/background tiers). Archived 6: 91 + 92
  (meta-labeling / ensemble-capacity — gate unopenable: model track found no
  positive-skill primary), 98 + 103 (off-spec/M4-M6 runs — superseded by the
  §18.3 + §35 corpus), 100 (invest/drop — consumed via 102/111–119), 108
  (round-77 runs — consumed). All recoverable from the inline notes.
* **Research: 10l carryovers closed as sweep 10m.** Endpoint back.
  `abs:carry AND abs:factor` needed relevance-sort (date-sort all physics;
  q-fin-scoped AND returns 0 — query retired): 1 new filed (2604.19604v6,
  carry-gap implementation wedge → TODO 95's borrow/margin leg, appended to
  item 95). `abs:slippage AND abs:crypto`: 2 results, 1 convergence filed
  (2407.12150 boundary-triggered rebalancing → band-design convergence, no
  doc change). Raw: `docs/research/raw/arxiv-sweep-2026-10m.json`.

## Open / flagged, not changed

* L19 still reads OPEN on the leads board while round 80 characterised OI
  "not bankable" — needs an owner verdict, not a sweep edit. Left untouched.
* Lab README "50 gated" vs 46 `validationPass` files counted — plausibly
  controls/integrity included; left as-is (not provably stale).
* Owed operator gate unchanged: `npm test` covering R109 + this sweep's
  import cleanup (runtime-no-op by construction, browser-proven, but only the
  native driver proves the worker/fs/CLI paths).
