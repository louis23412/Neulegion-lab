# CYCLE-090 — Round 57: window ladder + applied books (carry vol, sizing, 4h)

**Date:** 2026-09-29
**Goal:** ship the F-01 lesson (window grid as a helper) and close the W4b arc on applied books.

## Landed (repo, round 57)

* `forecast.js#tournamentVolLadder` (across-splits tournament at every realized-vol window from raw returns; names the failing window). One check initially tripped on its own fixture (window 100 fails before window 2 on 8 bars — the guard names the first failure, correctly) — fixed in the check.
* Eight §AY checks (`analysis` 777 → 785); one lock-registry export. No golden moves. Harness green (785/0 + locks 41/0).

## Measured (lab)

* `e87_vol_windows.js` (5/5): AR majority 8/8 at windows 12 and 48 (F-97).
* `e89_carry_vol.js` (5/5): on the honest carry book's own vol — EWMA 0.978, AR 0.998 (F-99).
* `e90_forecast_sizing.js` (4/4): expanding AR sizing vs trailing sizing on the carry book over 6058 bars — DD 7.96% → 2.70% → **2.57%**, Sharpe 3.58 → 7.63 → **7.68** (F-100, the payoff).
* `e91_vol_4h.js` (4/4): AR 5/5 on 8/8 at 4h (F-101, W5 breadth).
* `e92_vol_ladder.js` (4/4): 24/24 ladder cells bit-equal to single calls (F-102).

## Decision

The W4b arc is closed: measurement → reference → gate → audit → payoff, robust across splits, windows, skills, timeframes and books. Remaining: V2.3 engine binding, W5 breadth beyond resampling, and the G5 decisive run — all needing native runs. Hand to `npm test`.
