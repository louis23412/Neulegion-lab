# CYCLE-089 — Round 56: shrinkage dial + order contest

**Date:** 2026-09-29
**Goal:** test whether the AR(1) reference is a choice or a result — higher orders and shrinkage seated beside it OOS.

## Landed (repo, round 56)

* `forecast.js#fitRidgeArVolForecast` (L2-penalized AR, intercept unpenalized; l2=0 reproduces OLS bit-exactly, l2→∞ collapses to the target mean — both pinned, so the dial is exact at its endpoints).
* Eight §AX checks (`analysis` 769 → 777); one lock-registry export. One check initially compared the collapsed intercept to the wrong mean (train mean 3.5 vs target mean 4) — fixed in the check. No golden moves. Harness green (777/0 + locks 41/0).

## Measured (lab)

* `e88_order_contest.js` (3/3): AR(1)=AR(2)=AR(3) to three decimals on every stream; unstandardized ridge (l2=1) hurts (0.66–0.97). Recorded as F-98 — AR(1) stands; challengers must standardize first.

## Decision

Simplicity holds; the reference is a result. Next: the window ladder (the F-01 lesson, shipped) and the applied books.
