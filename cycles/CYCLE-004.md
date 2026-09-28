# CYCLE-004 — Volatility: forecastable, and what sizing actually buys (L09)

**Date:** 2026-09-18
**Goal:** take the one mechanism with a positive prior that needs no new data — volatility
predictability — and measure both whether it is forecastable and what causal sizing does to a *real*
sleeve (the honest carry book).

## Work

1. Refactored `e3_carry.js` to export `loadCarryBook(symbols)` (per-symbol series + end-aligned pool,
   no statistics) and made `basisBook` a thin wrapper — so there is exactly one definition of the
   sleeve for the sizing experiment to reuse.
2. Built `prototypes/vol.js` (`trailingVol`, `ewmaVol`, `harComponents`, `volTargetLeverage`, `olsFit`)
   and `experiments/e11_vol.js`; registered in `run_all.js`.
3. Two methodology fixes found while running (both recorded, neither p-hacked):
   * a log-RV HAR back-transformed with `exp(·)` targets the *geometric* mean and under-forecasts
     variance ~6.5× (read QLIKE −5.2); corrected with the lognormal term `exp(· + s²/2)` → −7.8;
   * a single first-half HAR fit is a strawman against an adaptive forecaster, so a **rolling-refit**
     HAR is the primary variant.
   `olsFit` was verified against a hand-worked example before trusting either number.

## Result — F-16

**(a) Forecast skill** (1h, fit first half / score second half, QLIKE, pooled):

| forecaster | QLIKE | beats baseline |
| --- | ---: | ---: |
| trailing 1-day vol | −8.878 | — |
| **EWMA(λ=0.94)** | **−8.952** | **8/8** |
| HAR (log, rolling) | −7.840 | 0/8 |
| HAR (log, fixed) | −7.819 | 0/8 |

**(b) Carry sizing** (EWMA vol target, cap 4×, mean leverage 1.46):

| book | annualised | Sharpe | max DD | design effect |
| --- | ---: | ---: | ---: | ---: |
| unsized | +4.78 % | 0.96 | 10.2 % | 234 |
| vol-targeted | +7.45 % | 6.67 | **0.71 %** | **24** |
| inverse-vol across symbols | +5.36 % | 1.15 | 9.4 % | — |

Control: sizing a random ±1 series *reduces* its Sharpe (0.40 → 0.16) — no mechanical inflation.

**Read:** volatility is forecastable with a five-line EWMA (no learned model needed); HAR complexity
does not pay at 1h. Sizing the carry sleeve cuts the drawdown ~14× and the serial design effect ~10× —
the first result in the lab that materially improves a *real* sleeve's risk profile. The sized Sharpe
(6.7) is explicitly **not banked** (F-11: an implausibly large Sharpe is a signal to investigate); the
credible version is inverse-vol across symbols (0.96 → 1.15), which is R4's recommendation.

## Ledger effects

* New finding **F-16** (SUPPORTED, with a magnitude caveat); summary table updated.
* **L09** → SUPPORTED (partial): vol forecastable; sizing buys drawdown/dependence. Falsifier partially
  falsified (the forecaster clause) and partially upheld (the HAR clause).
* `FOLD-BACK.md` **R4**: port with **inverse-vol weights, not a vol-target leverage**.
* New code: `prototypes/vol.js`, `experiments/e11_vol.js`; `e3_carry.js#loadCarryBook` exported.

## What is now false that was believed at the start of the cycle

* "Volatility predictability might not be exploitable without a learned forecaster." → **false**; a
  simple EWMA beats the trailing baseline on 8/8 symbols (F-16A).
* "Sizing is a cosmetic risk-scaling that cannot change a stream's statistical legibility." →
  **false**; vol-targeting cut the carry book's serial design effect 234 → 24 (F-16B).
* "The carry book's 10 % drawdown is irreducible." → **false**; it is 0.7 % under a causal vol target,
  and 9.4 % under inverse-vol across symbols.

## Next

* **CYCLE-005** — robustness of the sizing result (sub-sample, fixed vol forecast, leverage path), then
  the remaining open leads: **L12** (cross-sectional carry dispersion — pair with sizing), **L06**
  (meta-labelling feasibility), **L13** (reversal gross edge), **L07 probe 2** (OI/liquidations).
