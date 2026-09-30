# CYCLE-082 — Round 49: the W4b vol-forecast foundation (backfilled)

**Date:** 2026-09-29 (note written 2026-09-30 — no contemporaneous lab cycle file was
kept for rounds 48–49; this bridge reconstructs them from `docs/RUNBOOK.md` so the
numbering stays gap-free.)

**Goal:** give W4b its measurement footing: a causal realized-vol series, a causal EWMA
forecast, and the MSE skill vs a baseline — the yardstick a learner must beat out of
sample at matched exposure.

## Landed (repo, round 49; `RUNBOOK.md` §6)

* `realizedVolatility` + `ewmaVolForecast` + `volForecastSkill` in `analysis/forecast.js`
  (causal rolling RMS, RiskMetrics-0.94 one-step-ahead EWMA, MSE skill vs a baseline).
  Pinned by ten §AQ checks with three lock-registry exports. Additive — no scored path
  reads them, no golden moves.

## Decision

The foundation a model plugs into to earn the default path (built on in rounds 50–67).
Nothing measured lab-side this round.
