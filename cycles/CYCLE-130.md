# CYCLE-130 — Round 100: candle_fetcher split + rank-persistence NEGATIVE-descriptive

**Date:** 2026-10-01
**Goal:** two tracks — (a) foundations: split `candle_fetcher.js` (655
lines, the largest remaining unregistered module); (b) model track: measure
whether the funding XS rank persists at the R8 slow-policy timescale (e128).

## Work

* **Foundations: `candle_fetcher.js` → `candle_fetcher/` ×5 + shim.**
  `intervals.js` (conversion), `candles.js` (validation/guard),
  `sources.js` (exchange descriptors; imports candles + intervals),
  `fetch.js` (HTTP + pagination; imports candles/sources/store/intervals),
  `store.js` (merge/gaps/JSONL/planning; imports candles + intervals).
  Import DAG verified acyclic. Bodies byte-identical; the shim keeps the
  exact 28-name contract. Unregistered → no registry/ledger change.
* **Verified AI-side.** `fetcher.test.js` 111/0, `candles.test.js` 192/0
  through the esbuild harness. One self-caught bug: `fetch.js` uses
  `DEFAULT_BACKFILL_START` (intervals) — caught by the first harness run
  (import error), fixed with one import line; green on re-run.
* **e128 rank-persistence 4/3 NEGATIVE-descriptive (F-141).** Per-bucket XS
  ranks through the repo's own `parseSleeveInputs` grid: raw 8h ranks churn
  (rho1 0.52 majors / 0.42 midcap, ±1.5–1.7 ranks per bucket — the
  pre-registered ≥ 0.7 bar failed), but decay is ordered (rho1 > rho7 >
  rho30) and persistence survives at 10–30d (rho30 0.25/0.20, rho90
  0.20/0.15). Reading: the slow EWMA *constructs* the tradeable rank from a
  churny raw — smoothing is load-bearing, not tracking. The pinned R8 spec
  is unchanged (it already won out of sample). No TODO filed.
* **Research 10d** (`docs/research/raw/arxiv-sweep-2026-10d.json`): blocked
  at the endpoint (https 503 challenge, http fail — 4th/5th consecutive
  retrieval failures across 10c/10d). Per doctrine, not chased; sync pauses
  until the endpoint answers.
* **Rerank.** Top tier unchanged: 116 + 118 (stacked read) + fade G5
  (106/108, operator) + 111 (blocked). Queued: 95 remainder, 104, 117
  (behind 116), L10, W5 venues.

## Result

F-141 (e128 NEGATIVE-descriptive + constructs-not-tracks reading). S44→S45.
Operator commands: `npm test` (no uploads).
