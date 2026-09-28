# CYCLE-091 — Round 58: W4c range estimators + HAR challenger

**Date:** 2026-09-29
**Goal:** give the vol program measurement breadth (range-based estimators) and a literature-grade challenger (HAR-RV), and promote HAR to the reference.

## Landed (repo, round 58)

* `forecast.js` W4c block (10 exports): `rangeBarVariance` (cc/Parkinson/Garman-Klass/Rogers-Satchell per-bar variances, strict OHLC validation, fail-closed), `rangeRealizedVolatility` (rolling RMS, same `n-window+1` shape as `realizedVolatility`), `yangZhangVariance` (full-sample, with `k`/components exposed), `yangZhangRealizedVolatility` (rolling, exact per-window overnights), `fitHarVolForecast` / `predictHarVolForecast` (HAR(d,w,m) OLS, Corsi 2009), `tournamentHarVolForecast` / `AcrossSplits` / `Panel` (three-way EWMA/AR/HAR, ties break toward the simpler model).
* Sixteen §AZ checks (`analysis` 785 → 801); ten lock-registry exports; node mirror re-pinned to 801. Harness green (801/0 + locks 41/0).
* One self-caught failure during the round: the HAR-panel check used a noiseless sine train and tripped the honest singular-matrix guard — the check was wrong (real vols are noisy), the guard was right. Fixed in the check.

## Measured (lab)

* Lab loader now carries true `open` end to end (`loadSeries`/`alignPanel`/`tail`); the first probe showed synthetic opens (prev close) violate real bar ranges on 838/79 554 bars, while true opens validate 100%.
* `e93_range_estimators.js` (5/5): AR majority 5/5 on 32/32 stream × estimator cells; estimator/cc correlations 0.83–0.97 (F-103).
* `e94_har_challenger.js` (5/5): HAR wins 5/5 on 8/8 streams (40/40 split cells), margins +0.0001…+0.0005 over the best rival (F-104).

## Decision

W4c closes measurement breadth (estimator) and the reference upgrade (HAR nests AR(1) and beats it narrowly everywhere). Remaining: V2.3 engine binding of the forecaster behind a contract, W5 breadth beyond resampling (new venues/symbols), and the G5 decisive run — all needing native runs. Hand to `npm test`.
