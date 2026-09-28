# CYCLE-098 — Round 65: W4c-z forecast-sized books

**Date:** 2026-09-29
**Goal:** wire the lab's sizing payoff into the repo as a tested, causal primitive — and settle whether F-111's combination edge survives the sizing transform.

## Landed (repo, round 65)

* `forecast.js#applyVolTargetScaling` (W4c-z): pure causal scaler — scalar or per-bar-array target, hard cap, skips (never Infs) on non-finite returns, non-positive forecast vols, or non-positive targets; returns scored index + scales + sized returns.
* Ten §BB checks (`analysis` 821 → 831, ledger 3019 → 3029); one lock-registry export; node mirror re-pinned to 831. Harness green (831/0; locks 41/0 re-verified).

## Measured (lab)

* `e102_combine_sizing.js` (7/7, 2 s): OLS weights fit on the first 15% (w=[−0.045,0.806,0.235], AR-heavy), frozen, scored through the repo scaler on the last 85% — unsized DD **7.92%** → trailing **2.67%** → AR **2.54%** → HAR **2.45%** → combine **2.67%**; Sharpe 1.67 → 6.01 → 6.05 → **6.15** → 6.06 (F-112).
* One corrected pre-registration during the round: the first 40/60 attempt failed vacuously (last 60% calm, unsized DD 0.51% — sizing levers a calm book). A probe located the book's max-DD trough at bar 2515 (38%); the 15/85 split keeps weights strictly before a scoring span that contains the event, plus an explicit non-calm guard (unsized DD above 2%). The criterion structure never changed — the regime requirement went from silent assumption to loud guard.

## Decision

MIXED, and decisive where it matters: the F-106 payoff reproduces through the repo scaler (HAR sizing best on DD and Sharpe — the sizing reference is confirmed in repo-tested code), but the OLS forecast edge does not survive the sizing transform (combine ≈ trailing). The standing lesson is now pinned to a number: **rank by the application metric (sizing DD), not the forecast metric (MSE skill)**. Remaining: QLIKE-second-skill confirmation of the seven-way ranking, expanding-grid combination, W5 venues, W6 rows L10-co/cp/cq/cr, G5 — gate runs and venues needing native execution. Hand to `npm test`.
