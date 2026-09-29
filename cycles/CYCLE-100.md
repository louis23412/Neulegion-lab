# CYCLE-100 — Round 67: W4c-w online (rolling) combination

**Date:** 2026-09-29
**Goal:** test the stationarity assumption behind F-111's frozen weights: if the best blend drifts, rolling re-fits should beat frozen; if not, F-112's gap is structural.

## Research sync

A targeted arXiv sync (`"forecast combination" AND (rolling OR online OR time-varying)`, 20 hits) surfaced two load-bearing papers: **"Downside-Controlled Online Forecast Combination under Delayed and Revised Outcomes" (arXiv 2609.29096)** — the frozen+static+online simplex frame this round's frozen-vs-rolling design copies — and **"Generalized Gibbs Ensemble Weighting" (arXiv 2608.28116)** — the Gibbs-exponential-loss family the new `gibbsCombineWeights` instantiates in its plain form. Raw responses archived at `docs/research/raw/arxiv-sweep-2026-09s.json`; both papers entered in the volatility-forecasting citation block.

## Landed (repo, round 67)

* `forecast.js` W4c-w block (5 exports): `gibbsCombineWeights` (exponential-loss weights, eta=0 is exactly equal weights), `rollingCombineWeights` (per-bar causal re-fits on a trailing window for ols/eq/inv/gibbs/lasso, null before the fitting minimum), `tournamentRollingCombineVolForecast` (frozen OLS vs 3 rolling arms on identical scoring bars, 8 arms), `...AcrossSplits`, `...Panel` (rolling/frozen majorities).
* Ten §BD checks (`analysis` 840 → 850, ledger 3038 → 3048); five lock-registry exports; node mirror re-pinned to 850. Harness green (850/0; locks 41/0 re-verified).
* One self-caught failure during the round: a duplicated R66 catch (`qlikeCombineWins` shorthand fallout from round 66's edit pattern — this time a brace-level duplicate, not a name) the bundler refused; fixed by deleting the orphan before any test ran.

## Measured (lab)

* `e104_rolling_challenger.js` (5/5, 90 s): frozen 5/5 on 7/8 streams (XRP frozen 3/2 vs HAR); panel frozen-majority 8/8, rolling 0/8; best-rolling margins over frozen negative everywhere (−0.0001…−0.0008) (F-114).

## Decision

NEGATIVE and conclusive: the blend is stationary, rolling buys only estimation error. F-112's combine≈trailing is structural, not staleness — the planned rolling-combine sizing experiment (e105) is screened out WITHOUT build (recorded here so no future iteration rebuilds it). Frozen OLS stays the combination reference; rolling joins the measured-and-rejected list beside the V2.3 learners. The W4c forecast arc is now closed on all four sides: estimators → HAR reference → combinations (frozen beats rolling, HAR-ratio thin) → sizing payoff (HAR best). What remains needs native execution or new data: expanding-grid combination is now low-EV (frozen settled it — documented, not built), W5 venues need operator data, W6 L10-co/cp/cq/cr are golden-adjacent, G5 needs gate runs. Hand to `npm test`.
