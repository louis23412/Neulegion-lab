# CYCLE-084 — Round 51: split-robust tournament + 15m generality

**Date:** 2026-09-29
**Goal:** apply the F-55 lesson to the E79 headline — a single-split win can be a split pick — before building the gate.

## Landed (repo, round 51)

* `forecast.js#tournamentVolForecastAcrossSplits` (the half-split tournament at splits 0.3–0.7 with AR win fraction + EWMA-always-positive flag). Additive; no scored path reads it.
* Eight §AS checks (`analysis` 727 → 735); one lock-registry export. No golden moves. Harness green (735/0 + locks 41/0).

## Measured (lab)

* `e80_vol_splits.js` (4/4): AR wins 5/5 splits on every 1h stream; EWMA positive on every split. Recorded as F-90.
* `e82_vol_timeframe.js` (4/4): same tournament on the 15m panel — AR 5/5 on 8/8, EWMA +0.65…+0.83 everywhere. Recorded as F-92. Not a bar-size artefact.

## Decision

The E79 headline is not a split pick and not a timeframe artefact. Next: the model slot (the actual G4 mechanism).
