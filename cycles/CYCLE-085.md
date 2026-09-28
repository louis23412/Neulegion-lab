# CYCLE-085 — Round 52: the model slot (three-way OOS) + persistence test

**Date:** 2026-09-29
**Goal:** build the exact mechanism a learner plugs into — a three-way OOS skill of EWMA vs AR vs an arbitrary model forecast.

## Landed (repo, round 52)

* `forecast.js#tournamentVolModel` (three-way skill vs the actual-mean baseline, ties preferring the references — an exact-clone parks). Additive; no scored path reads it.
* Eight §AT checks (`analysis` 735 → 743); one lock-registry export. No golden moves. Harness green (743/0 + locks 41/0).

## Measured (lab)

* `e81_vol_model_slot.js` (4/4): naive prev-bar persistence in the model seat — AR wins the three-way 8/8 and beats persistence 8/8, but both read ≈0.98 (EWMA ≈0.68–0.77). Recorded as F-91 with the thin-margin caveat: realized vol is near-unit-root, so the headroom above doing nothing is a hair.

## Decision

The G4 gate is runnable. A model must beat AR(1), and AR(1) barely beats persistence — the bar is honest and high. Next: the panel rollup (decide-view).
