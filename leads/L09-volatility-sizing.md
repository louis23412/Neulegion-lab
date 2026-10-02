# L09 — Volatility predictability & risk sizing

**Status:** SUPPORTED (partial) — vol is forecastable; sizing buys drawdown/dependence, not a
trustworthy Sharpe *level*
**Opened:** CYCLE-000 (identified), CYCLE-001 (registered)
**Last updated:** CYCLE-129
**Owner experiments:** `e11_vol.js`
**Prototypes:** `prototypes/vol.js` (`trailingVol`, `ewmaVol`, `harComponents`, `volTargetLeverage`, `olsFit`)
**Result artefacts:** `results/e11_vol_1h.json`
**Fold-back rows:** — (informs R4)
**Falsifier:** a vol forecaster no better than a trailing-mean baseline out-of-sample (QLIKE / R²),
*and* no sizing scheme that improves a sleeve's Sharpe or drawdown. **Partially falsified:** EWMA beats
the baseline 8/8 (so the forecaster clause fails), but the forecastable-HAR clause holds (HAR does not
beat it).

## Claim

Volatility is the one universally documented predictability in returns, and the repo *does* have a
`volRegime` feature — but no sizing layer: positions come from a fixed ±1 clamp on a z-score (J5).
Two questions, in order: **(a)** is realised vol forecastable out-of-sample on this data better than a
naive trailing baseline (EWMA/HAR vs trailing mean)? **(b)** does inverse-vol / vol-target sizing
raise the Sharpe of a weak-but-real sleeve (carry, L03) and cut its drawdown, without manufacturing
return?

## Why we care

It is the standard way to make a real stream's Sharpe legible, and it is a prerequisite for combining
carry (L03) with anything. If (a) holds but (b) does not, that is a clean, informative negative; if
both hold, the lab has the first *sizing* result — which, unlike a directional signal, does not
require the market to be predictable in direction.

## Evidence

**(a) Vol forecastability (F-16A).** 1h basket, fit first half / score second half, QLIKE on the next
bar's realised variance: trailing 1-day baseline **−8.878**, **EWMA(λ = 0.94) −8.952 (beats baseline on
8/8 symbols)**, HAR log-RV rolling **−7.840 (0/8)**, HAR fixed first-half **−7.819 (0/8)**. Vol is
forecastable and a simple EWMA captures it; HAR's added complexity does not pay at 1h.

**(b) Sizing the carry book (F-16B).** Causal EWMA vol target (cap 4×, mean leverage 1.46):

| book | annualised | Sharpe | max drawdown | design effect |
| --- | ---: | ---: | ---: | ---: |
| carry, unsized | +4.78 % | 0.96 | 10.2 % | 234 |
| carry, vol-targeted | +7.45 % | **6.67** | **0.71 %** | 24 |
| carry, inverse-vol across symbols | +5.36 % | 1.15 | 9.4 % | — |

Control: sizing a random ±1 series *reduces* its Sharpe (0.40 → 0.16) — sizing is not inflating a
zero-mean series.

**(b′) Re-measured on the extended 6.0-year window (CYCLE-006).** cap 4×, mean leverage 1.63:

| book | annualised | Sharpe | max drawdown | design effect (raw → winsorised) |
| --- | ---: | ---: | ---: | ---: |
| carry, unsized | +9.05 % | 4.54 | 7.96 % | 99.5 → 11.8 |
| carry, vol-targeted | +9.33 % | **8.05** | **1.33 %** | **5.98 → 6.22** |
| carry, vol-targeted (cap 2×) | +8.61 % | 7.99 | 1.33 % | — |
| carry, inverse-vol across symbols | +11.01 % | **10.66** | **0.69 %** | — |
| control: random position, unsized → sized | — | 0.38 → 0.83 | — | — |

The reason sizing helps is now sharper than "a yield amplified in calm periods": it collapses the
design effect **99.5 → 6.0**, i.e. it removes the **fat tail** (the FTX bar) that dominates the
jackknife (F-20). That makes it a **risk-model** result. The sized book's design-effect-adjusted t is
≈ 7.9.

## Verdict

**SUPPORTED (partial).** (a) Vol is forecastable — the EWMA beats the trailing baseline on every
symbol; the repo can size with a five-line smoother, no learned model needed. (b) Causal vol-targeting
of the carry sleeve is the first sizing result that *matters*: it cuts the drawdown ~6× (7.96 % →
1.33 %) and the serial design effect ~17× (99.5 → 6.0). On the extended window the result is *stronger*
than the original claim and for a better reason: sizing is removing the fat tail, not just amplifying
the calm. The remaining reservation is about the *level* (8.05), which still rests on one sample; the
mark-vs-traded perp-leg question (F-18/L14) was tested in CYCLE-007 and barely moved it — vol-targeted
Sharpe 8.05 → **7.79** with the drawdown reduction intact (1.33 % → 1.27 %), so the portable
recommendation stays the modest **inverse-vol across symbols** (4.54 → 10.66 Sharpe, 7.96 % → 0.69 % DD
on the mark; 10.91 / 0.68 % on the traded leg), which is R4's.

## Next actions

1. Test whether the drawdown reduction is robust to a *fixed* vol forecast (e.g. a rolling 720-period
   vol) instead of EWMA, and to the leverage cap; the cap already barely matters (cap 2× gives 7.99).
2. Add a level-form (variance-space) HAR as the residual HAR variant; note that on the extended sample
   the rolling HAR **does** beat the trailing baseline on QLIKE (−7.84 vs −8.88) while EWMA does not
   (−8.95), so the "simple beats complex" claim no longer holds as stated.
3. Re-measure after L14 (traded-price perp leg) — **done (F-22)** via the shared sizing code path in
   `e15_traded_basis.js`: vol-targeted Sharpe 8.05 → **7.79** (DD 1.33 % → 1.27 %), inverse-vol
   10.66 → **10.91** (DD 0.69 % → 0.68 %). The drawdown/design-effect conclusions are unchanged; only
   the vol-targeted *level* moves a hair, which reinforces recommending the inverse-vol form over
   vol-target leverage.
4. Feed the carry + inverse-vol result into R4 (basis-marked, inverse-vol sleeve).

## Log

* **CYCLE-000** — identified as J5/J6; prototypes sketched, unscored.
* **CYCLE-001** — registered as a lead with a falsifier.
* **CYCLE-004** — **done**: built `prototypes/vol.js` + `e11_vol.js`; F-16 recorded (EWMA beats the
  baseline 8/8; HAR does not beat it; carry vol-targeting cuts DD 10.2 % → 0.7 % and the design effect
  234 → 24, with the Sharpe level explicitly not banked). Refactored `e3` to expose `loadCarryBook`
  so there is one definition of the sleeve.
* **CYCLE-006** — **re-measured on the extended 6.0-year history**: unsized carry 4.54 (DD 7.96 %),
  vol-targeted **8.05 (DD 1.33 %)**, inverse-vol across symbols **10.66 (DD 0.69 %)**. The design effect
  collapses 99.5 → 6.0, so the mechanism is affirmed as *fat-tail removal* (F-20), not calm-period
  amplification. Also: on this sample the rolling HAR beats the trailing baseline on QLIKE while EWMA
  does not, which reverses F-16A's "simple beats complex" clause. Both design effects (raw and
  winsorised) are now stored.
* **CYCLE-128/129** — **sizing NEGATIVE twice (F-139/F-140).** `e126` kills per-bar dispersion scaling
  (turnover 27–33×, Sharpe negative both panels; mechanism, not bad luck); `e127` kills quantized
  2-state scaling (rank, not level — TODO 119 measured-closed). Flat sizing stands; any future
  sized-leg design is closed-loop (sweep 10f amendment) with its own G5 pass (TODO 104).
