# CYCLE-144 — Coherency sweep S5: dead-import round two + 10l repair + sweep 10n (no measurement round)

**Date:** 2026-10-02
**Goal:** re-run the S1 dead-import pass over the current tree (ES imports were
out of its `require` heuristic), repair the malformed 10l snapshot, run the due
research sweep, and refresh the rerank.

## Work

* **23 dead imports removed across 16 files** (all import-line-only, each
  verified with a whole-file grep plus a cross-file expectation check before
  removal). Batch 1: `test/node/indicators.test.js` (mulberry32),
  `test/browser/entries/querymod.test.js` (hashBits),
  `test/browser/entries/multiprobe.test.js` (marginContainmentDepth,
  marginContainmentCoverage), `test/browser/entries/legion.test.js` (PROJECT),
  `test/browser/entries/contracts.test.js` (dsrReport),
  `test/browser/entries/analysis.test.js` (scoreBookReturns),
  `src/hivemind/hiveMind.js` (`better-sqlite3` Database — never referenced;
  no global side effect to preserve), `src/fetch_candles.js` (msToInterval),
  `src/analysis/reality_check/subsampling.js` (mean, relativePerformance,
  safeRatio — pre-round-108 leftovers; the part files import what they use),
  `src/analysis/features.js` (fractionalDiffWeights — pre-round-102 leftover;
  base.js imports it directly). Batch 2 (comment-masked, found by a
  comment-stripping re-scan): `walkforward/search.js` (walkForwardEvaluate,
  promoteDecision — the shim sources both from audit/report directly),
  `walkforward/power.js` (backtestMetrics, poolFolds),
  `walkforward/folds.js` (purgedCVBacktest),
  `analyze/models/factories.js` (makeSignalForVariant — models.js sources it
  from signals.js directly), `sleeve/evidence.js` (scoreBookReturns,
  stressHalves, worstBlock), `test/browser/entries/analyze.test.js`
  (withSeed). Two file comments reworded to stay truthful;
  no scored-path change.
* **Registry note corrected** (`test/lock-registry.js`): the inter-part import
  of `safeRatio` lives in `subsampling/procedures.js`, not `subsampling.js`.
* **Deliberately kept:** `test/browser/harness.js#PROJECT` (used internally
  for the shim path); the exporters of every removed name.
* **Full-tree recheck:** 303 repo js files, 0 dangling relative imports,
  0 import cycles, 0 `require(` leftovers in `src/`.
* **10l snapshot repaired:** `arxiv-sweep-2026-10l.json` carried a stray `]`
  past its closing brace (endpoint-flake artefact) and failed to parse —
  trimmed, now parses. Its two carryover queries were already retried in 10m,
  so no retry is owed.
* **Sweep 10n** (`docs/research/raw/arxiv-sweep-2026-10n.json`, endpoint
  healthy, 3/3 queries): 2 new notes (2609.27051 anytime-valid referee and
  2606.29771 CLQT, both TODO 87/95 context, no doc change) + 1 convergence
  (2608.27734, already grounded); Q1 only convergences, Q3 empty.
* **Rerank refreshed** (TODO.md): top tier unchanged (116 → 118 → 117);
  the round-109 note's "AI-side next: the two 10l carryover queries" is now
  stale (settled by 10m) and superseded. No archives this sweep — none of the
  18 opens is measurably closeable without operator runs or new data.

## Verification (AI-side, this round)

* analysis 856/0, contracts 255/0, locks 41/0, modules 59/0, walkforward 90/0,
  analyze 294/0, features 11/0, golden 23/0, multiprobe 77/0, querymod 51/0,
  legion 57/0 — every ledger count bit-equal.
* e58 39/39 + e63 11/11 guards, both `validationPass: true` (the two audits
  consuming the edited shims).

## Open / owed (unchanged, gate grows)

* `npm test` (R109 + S1 + S5 cleanup). No uploads.
