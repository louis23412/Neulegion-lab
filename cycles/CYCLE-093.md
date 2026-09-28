# CYCLE-093 — Round 60: expanding forecasts + HAR payoff and 15m breadth

**Date:** 2026-09-29
**Goal:** ship the refit grid the sizing payoff refits through, and close the W4c arc on the applied book and the hostile timeframe.

## Landed (repo, round 60)

* `forecast.js#expandingVolForecasts` (expanding-window refit OOS series for EWMA/AR(1)/HAR with a causal train-mean baseline, configurable minTrain/step/horizons; ties break toward the simpler model).
* Ten §AZ checks (`analysis` 801 → 811); one lock-registry export; node mirror re-pinned to 811. Harness green (811/0; locks 41/0 and contracts 171/0 re-verified this round).

## Measured (lab)

* `e96_har_sizing.js` (4/4): trailing vs AR vs HAR sizing on the honest carry book over 6056 bars — DD 7.92% → 2.67% → 2.54% → **2.45%**, Sharpe 3.59 → 7.64 → 7.68 → **7.78** (F-106, the W4c payoff: the forecast ranking compounds monotonically into sizing).
* `e97_har_15m.js` (4/4): HAR 5/5 on 8/8 15m streams, panel unanimous (F-107, W5 breadth in the hostile direction).

## Decision

W4c is closed end to end: estimators → HAR reference → expanding harness → sizing payoff, robust across splits, windows, estimators, timeframes (15m/1h/4h), skills and books. Remaining: V2.3 continuation (ridge/MLP learners need the import-law decision), W5 breadth beyond resampling (new venues), and the G5 decisive run — all needing native runs. Hand to `npm test`.
