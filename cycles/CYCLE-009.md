# CYCLE-009 — L16: can the dispersion signal be harvested cheaply?

**Date:** 2026-09-27
**Goal:** answer CYCLE-008's open question. F-23 (e16) showed the cross-sectional dispersion book — the
lab's strongest-looking sleeve (F-17) — is **cost-fragile as traded**: the daily rank reshuffle turns
over 803× gross notional/yr and breaks even at 1.87 bps. But F-23 measured the *implementation*, not the
*signal*. The funding-spread signal is slow; the turnover comes from recomputing exact ranks (and
renormalising `Σ|w|=1`) every 8h, so tiny rank swaps become real trades. This cycle asks whether a
cheaper cadence keeps the edge — the gating question for R8.

## Work

1. **Exposed the aligned legs** from `e12#buildXsSeries` (`legs: {basisPnl, fRate, spotRet, times}`) so a
   new experiment can build arbitrary weight series on the SAME data without re-deriving the join.
2. **Reused the audit, did not re-implement it.** `e16`'s `turnoverSeries`/`audit` and `e13`'s
   `windowStats`/`REGIMES` were exported and imported by the new experiment (the lab rule: a second
   consumer gets an export, not a copy). `e13`'s regime list was lifted to module scope unchanged.
3. **`experiments/e17_low_turnover.js`** (new): fourteen weight policies over the same legs —
   `daily` (baseline), `holdN` (N=3/9/27), `ewma(λ)` (λ=0.5/0.25/0.1), `deadband(ε)` (ε=0.05/0.10),
   `tail(m)` (m=2/3), plus renormalised variants — each scored by the F-23 audit (gross Sharpe,
   turnover/yr, break-even bps, net-of-fee ladder), plus `marketCorr` and net/gross exposure.
4. **Reproducibility check, asserted in the artefact:** `rank_daily` must reproduce `e12`'s `xsRank`
   book *exactly* — `maxAbsDiff = 0`, `rankDailyMatchesE12XsRank: true`. If that ever fails, e17 is
   measuring a different book and nothing else in it counts.
5. **Regime survival on E13's windows** for the leading candidates, gross **and** net at 4 bps — the
   check that a "cheaper" book is still the crash-surviving dispersion book (not a directional animal).

## Result — F-24: the dispersion edge IS tradable; smoothing the weights is the fix

The winner is **EWMA-smoothed, renormalised rank weights**: hold `w_t = 0.9·w_{t−1} + 0.1·w*_t` (the
target `w*_t` from funding at `t−1`), rescale to `Σ|w|=1`. Full comparison (mark leg; `net4` = net
Sharpe at a 4 bps fee):

| policy | gross Sharpe | turnover / yr | break-even | Σw | corr w/ price | net@4 | net@10 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| rank_daily (e16 baseline) | 5.03 | 803× | 1.87 bps | 0 | 0.084 | −5.62 | −19.75 |
| rank_hold3 | 3.86 | 312× | 3.69 bps | 0 | 0.083 | −0.32 | −5.90 |
| rank_hold9 | 3.09 | 119× | 7.45 bps | 0 | 0.079 | +1.42 | −0.99 |
| rank_hold27 | 1.95 | 42× | 10.36 bps | 0 | −0.049 | +1.19 | +0.06 |
| rank_ewma_0.5 | 4.25 | 375× | 3.27 bps | 0 | 0.084 | −0.95 | −8.57 |
| rank_ewma_0.25 | 4.12 | 190× | 5.32 bps | 0 | 0.082 | +1.02 | −3.60 |
| rank_ewma_0.1 | 4.99 | 80× | 9.36 bps | 0 | 0.080 | +2.86 | −0.34 |
| **rank_ewma_0.1_norm** | **5.18** | **85×** | **12.78 bps** | **0** | **0.074** | **+3.55** | **+1.12** |
| level_ewma_0.1 | 3.85 | 83× | 13.28 bps | 0 | 0.079 | +2.69 | +0.95 |
| rank_deadband_0.10 | 4.90 | 654× | 2.22 bps | 0.002 | 0.084 | −3.83 | −15.43 |
| rank_tail3 | 4.98 | 846× | 1.87 bps | 0 | 0.084 | −5.56 | −19.54 |

**Smoothing the weights does three things at once, and none of them is a trade-off:**
1. **Turnover falls ~9×** — 803× → **85×** gross notional/yr.
2. **The gross Sharpe is *kept*, even raised** — 5.03 → **5.18**. The daily reshuffle was mostly noise
   trading: it paid to churn between nearly-equivalent rank vectors. Filtering it out removes variance
   without removing mean, which is exactly why the break-even jumps so far.
3. **Break-even rises 1.87 → 12.78 bps**, so the book now clears a **VIP-maker fee (4 bps) at net Sharpe
   +3.55** and still earns **+1.12 at a 10 bps** taker-level fee. It stays dollar-neutral (`Σw = 0`) and
   price-neutral (corr 0.074, barely changed from 0.084).

**It is still the crash-surviving book.** Net of a 4 bps fee, on E13's windows (Sharpe):

| window | flat carry | rank daily | **rank_ewma_0.1_norm** |
| --- | ---: | ---: | ---: |
| crash 2021-05 | +3.51 | −7.82 | **+3.63** |
| bear 2022 | −1.43 | −1.35 | **+3.33** |
| LUNA 2022-05 | −4.19 | −16.45 | **+7.85** |
| FTX 2022-11 | **−5.12** | +4.25 | **+7.88** |
| recovery 2023 | +6.96 | −21.34 | **+5.32** |
| bull 2024 | +15.69 | −29.10 | **+5.48** |
| 2025 / 2026 | +5.75 / +3.50 | −46.0 / −54.7 | **−0.02 / −1.87** |

**7 of 9 regimes positive net of 4 bps, and every crash window positive** — versus flat's 6/9 (and flat
is negative in 2022, LUNA and FTX). So the smoothed dispersion book keeps the *reason* L12 was
interesting (level-neutral, crash-positive) *and* pays for its own trading.

**The perp-source check (F-22 consistency):** on the **traded** leg the winner reads gross Sharpe 5.37,
turnover 84×/yr, break-even 12.52 bps, net@4 **+3.65**, net@10 **+1.08**, 7/9 regimes — i.e. the rescue
is not a mark artefact either.

**The honest caveat.** The edge has *decayed*: 2025 and 2026 are ~0 and slightly negative net of fees,
where the earlier years were strongly positive. The full-history result is carried by 2021–2024. That is
a live risk to R8 and is recorded as such (see below) — the sleeve is tradable, but its recent edge is
thin.

## What this changes

* **R8 is rescued.** The port specification changes from "daily rank reshuffle" to **"EWMA(λ=0.1)
  smoothed, renormalised rank weights, rebalanced every 8h"** — a one-line change to the weight
  construction that cuts turnover ~9× and preserves the gross and crash profile. F-23 was a property of
  the implementation, not the signal.
* **L16 closes** (SUPPORTED): the cheap harvest exists and is specified.
* **L11 (reversion) is still cost-fragile** — its `fade` positions were not smoothed here. The same trick
  may or may not work (the reversion signal is a per-symbol z-score, not a cross-sectional rank), so it
  stays an open question (a CYCLE-010 candidate), and L11's port row stays gated.
* **L15 (capacity/impact) remains the next physical constraint** — fee is now cleared, impact is not.

## Ledger effects

* New **F-24**. **F-23** is amended to say its fragility was the *daily* implementation; **F-17** is
  restated as "tradable via EWMA-smoothed weights (F-24)".
* **L16 → SUPPORTED (resolved)**; **L12** upgraded back to a tradable sleeve with the smoothed
  construction; **R8** un-gated *given the smoothed weights*.
* New code: `experiments/e17_low_turnover.js`; `e12#legs`; `e13#{REGIMES, windowStats}`;
  `e16#{turnoverSeries, audit}` exports.

## Next

* **CYCLE-010 candidate — smooth the reversion book (L11):** apply the same EWMA/hold filter to `fade`
  and re-audit; if it works, L11 also becomes tradable.
* **L15 capacity/impact** — harvest perp volume and put a size on the (now cost-cleared) dispersion
  sleeve.
* Watch the **2025–2026 edge decay** — is it regime, or signal death?
