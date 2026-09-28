# CYCLE-086 — Round 53: the panel rollup (one call, eight verdicts)

**Date:** 2026-09-29
**Goal:** fold the per-stream tournament into the decide-view — one shipped call rendering the whole panel verdict.

## Landed (repo, round 53)

* `forecast.js#tournamentVolPanel` (`{id: vols}` → per-stream across-splits + AR-majority/EWMA-clean counts, fractions, unanimity flags; names the failing stream). Additive; no scored path reads it.
* Eight §AU checks (`analysis` 743 → 751); one lock-registry export. No golden moves. Harness green (751/0 + locks 41/0).

## Measured (lab)

* `e83_vol_panel.js` (4/4): unanimous AR majority + unanimous EWMA-positive on the 1h panel, 8/8 cells bit-equal to the single-stream calls. Recorded as F-93.

## Decision

The W4b measurement stack reads foundation → tournament → split-robustness → model slot → panel view. Next: the second skill (QLIKE) so the ranking must survive the loss function.
