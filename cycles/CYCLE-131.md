# CYCLE-131 — Round 101: dependence split + smoothed-rank SUPPORTED

**Date:** 2026-10-01
**Goal:** two tracks — (a) foundations: split the registered
`analysis/dependence.js` (556 lines) with the R97 registry recipe; (b) model
track: test the F-141 reading constructively (e129 — does EWMA smoothing
manufacture the slow rank?).

## Work

* **Foundations: `analysis/dependence.js` → `dependence/` ×3 + shim.**
  `correlation.js` (pairwise correlation + Kish design effect, no imports),
  `clusters.js` (fold-window clusters + jackknife family; imports
  `studentTPValue` from student), `student.js` (t machinery + first-PC
  factor-neutral leg, no imports). Import DAG verified acyclic. Bodies
  byte-identical (one reconstruction check tripped on a slicing offset —
  a stray head-comment tail in the first part draft — fixed before writing).
  The shim keeps the exact 19-name registered contract; many consumers
  (`streams.js`, `portfolio.js`, `sleeve/*`, `walkforward/*`,
  `decision/plan.js`) import through it unchanged.
* **Registry/locks (R97 recipe).** Three `KNOWN_TESTS` export rows + three
  `ANALYSIS_REGISTRY` module rows (INVARIANT, same citations/proving tests
  as the cut row) in `test/lock-registry.js`; three imports + three map
  rows in `locks.test.js`.
* **Verified AI-side, first try.** `locks.test.js` 41/0, `analysis.test.js`
  856/0 (counts unchanged — pure move, no new checks). No golden moves.
* **e129 smoothed-rank 4/4 SUPPORTED (F-142).** Causal EWMA(λ=0.02) per
  funding series, rank the smoothed values: rho1 0.992 both panels (raw
  0.517/0.425 recomputed in-run, replicating e128 to the digit), smoothed ≥
  raw at every lag, sm rho30 0.842/0.891. The F-141 constructs-not-tracks
  reading is confirmed constructively on both panels. No spec change (the
  pinned R8 book already does exactly this); no TODO.
* **Research:** 10d still paused (endpoint challenged twice in round 100;
  doctrine: not chased, nothing this round depends on it).
* **Rerank.** Top tier unchanged: 116 + 118 (stacked read) + fade G5
  (106/108, operator) + 111 (blocked). Queued: 95 remainder, 104, 117
  (behind 116), L10, W5 venues.

## Result

F-142 (e129 SUPPORTED + construction confirmed). S45→S46. Operator
commands: `npm test` — one run now covers BOTH round-100 (`candle_fetcher/`)
and round-101 (`dependence/`) splits (no uploads).
