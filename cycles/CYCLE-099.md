# CYCLE-099 — Round 66: W4c-yq QLIKE second opinion

**Date:** 2026-09-29
**Goal:** confirm or overturn F-111's combination ranking under the robust second skill (Patton 2011), and fix what the abstention exposes.

## Landed (repo, round 66)

* `tournamentCombineVolForecast` gains an additive QLIKE block (same weight-train/weight-test split, all-positive intersection so all seven arms read identical bars; abstains honestly when fewer than 2 intersection bars); `...AcrossSplits` gains decided/abstained counts, per-model QLIKE wins and combine share; `...Panel` gains QLIKE combine/HAR majorities. No new exports (return-shape additions only), no scored path touched.
* `fitLassoCombineWeights` RMS-normalises columns AND target before the coordinate descent and maps weights back — the penalty is now scale-free (a raw l1 is dominated by the series scale).
* Nine §BC checks (`analysis` 831 → 840, ledger 3029 → 3038); node mirror re-pinned to 840. Harness green (840/0).
* Two self-caught failures during the round: a shorthand (`qlikeCombineWins,` for a `qCombineWins` const) the bundler refused — fixed before any test ran; and a hand-written scale-invariance check that was wrong on paper (joint ×1000 scaling leaves weights identical only when the target is normalised too — the check caught the missing half of the fix, the code was completed, not the check weakened).

## Measured (lab)

* `e103_combine_qlike.js` (5/5, 46 s): QLIKE decided 5/5 on all 8 streams; best-combine QLIKE margin over HAR non-negative everywhere (+0.0000…+0.0002); lasso takes XRP 5/5, BNB 4/5, BTC 3/5; OLS takes SOL 5/5 and shares the rest; HAR holds a QLIKE majority only on ADA (F-113).
* The first e103 run abstained 0/5 everywhere — the honest guard working: round-64's raw l1=0.01 zeroed every lasso weight on real-scale vols, emptying all intersections. The scale-free fix revived it.

## Decision

The seven-way ranking is skill-robust in direction (combination ≥ HAR under MSE and QLIKE on 8/8 streams) and arm-uncertain in detail (OLS vs lasso varies by stream and skill). HAR stays the sizing reference (F-112); combination stays a forecast-reference candidate. E101's lasso arm is retroactively marked degenerate — its OLS-vs-HAR conclusion stands (never depended on lasso). Remaining: expanding-grid combination, W5 venues, W6 rows L10-co/cp/cq/cr, G5 — gate runs and venues needing native execution. Hand to `npm test`.
