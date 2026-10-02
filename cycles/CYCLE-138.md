# CYCLE-138 — Round 108: subsampling split + band-holdout + research 10k

**Date:** 2026-10-01
**Goal:** three tracks — (a) foundations: split the registered
`analysis/reality_check/subsampling.js` (536 lines); (b) model track: the
dense-split holdout for e135's band pick (e136); (c) research: fresh sweep
(10k).

## Work

* **Foundations: `reality_check/subsampling.js` → `subsampling/` ×2 + shim.**
  `windows.js` (config, Newey-West SE, segments, window starts, pooled SE),
  `procedures.js` (SPA/step-down/k-FWER/FDP on the shared reference).
  Line-multiset verified byte-identical; seven names gain `export` for
  inter-part use. Cleanups: dropped `mean` import, corrected stale doc path.
  One self-caught build error (dropped doc comment, verifier caught pre-write).
* **Registry/locks (R97 recipe).** Two `KNOWN_TESTS` rows + two module rows;
  two imports + two map rows in `locks.test.js`.
* **Verified AI-side, first try.** locks 41/0, analysis 856/0, walkforward
  90/0, analyze 294/0. No golden moves.
* **e136 band-holdout 4/4 SUPPORTED (F-149).** 8 dense splits on stacked-16:
  trailing pick 0.01 at 8/8, frozen-eps ≥ daily 8/8, fixed-0.01 ≥ daily 8/8,
  coherence reproduces e135 (0.40/0.44). The band advantage is not a
  full-sample artefact; TODO 118 keeps cap 0.125 + band 0.01. e135 regressed
  3/3. No spec change, no TODO.
* **Research 10k LANDED** (raw `arxiv-sweep-2026-10k.json`): 4 new notes
  (point-in-time audit → L10/e14; funding-rate-times-base → carry mechanism;
  predict-then-optimize → R26-5; AI-limits survey → TODO 111) + 5 convergence
  confirms. No doc changes.
* **Rerank.** Top tier: 116 + 118 (holdout-certified) + fade G5 + 111.
  Queued: 117, L10, W5 venues.

## Result

F-149 (e136 holdout SUPPORTED). S52→S53. Operator commands:
`npm test` (covers the `subsampling/` split + registry rows; no uploads).
