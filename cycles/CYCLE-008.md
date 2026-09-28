# CYCLE-008 — Cost audit: can the carry complex be traded, or only measured?

**Date:** 2026-09-27
**Goal:** attack the one thing every CYCLE-006/007 result left unmeasured: **trading cost**. Every headline
number in the lab is a *gross* return series (basis P&L + funding, no fees). That is defensible for the
flat sleeve — a delta-neutral position you establish once and hold — but the two things the lab
believes are *improvements* over it, the cross-sectional dispersion book (F-17/L12) and the timed
reversion book (F-10/L11), **reshuffle their exposures every 8h** as funding ranks and basis z-scores
move. Their gross edge is ~1–2 bp per period; if they churn a meaningful fraction of the book each
period, a realistic fee removes it. This is the successor to L14: L14 asked *can you trade the price
you measured?* (yes, F-22); this asks *can you trade it every 8h and keep the edge?*

## Work

1. **Exposed the exposure vectors.** `e12#buildXsSeries` now also returns `weightSeries`
   (`{xsLevel, xsRank}` — the per-period weight vectors it already computed internally), and
   `e7#reversionFromBook` gained `{includeWeights:true}`, returning `pooledWeights` (the pooled
   per-symbol `fade` vectors, aligned exactly with the pooled return series) and `pooledReturns`. Both
   are additive: `e7`/`e12`/`e15` artefacts are unchanged in shape.
2. **`experiments/e16_cost_capacity.js`** (new): for each of the five headline books measures the L1
   turnover `T_t = Σ_i |w_i,t − w_i,t−1|` (with `w_{−1}=0`, so the first period carries the entry,
   matching the repo's `turnover()` convention), the annualised turnover, the **break-even cost** (the
   fee at which mean net return = 0), and the net Sharpe at a ladder of costs `0…30 bps`.
3. **Cross-checked the mechanics against the repo's own arithmetic**: `e16` recomputes the rank book's
   total turnover by transposing the weights and calling `backtest.js#turnover()` per column;
   `xsRankRepoSum = 4808.375` = `xsRankL1 = 4808.375` (`agree: true`).
4. **Charged a delta-maintenance estimate for the flat hold** separately (see below), so "flat is
   nearly free" is not an artefact of modelling the weights as constant and ignoring hedge drift.

## Units (matters)

Every book is a return on **1 unit of gross perp notional** (the xs weights normalize to `Σ|w| = 1`;
the flat book is `1/k` per symbol; the reversion book is the per-symbol fade divided by the symbol
count). Changing exposure in symbol *i* by `dw` means trading `dw` of **spot and** `dw` of **perp**, so
`costBps` is the fee on **one (spot + perp) unit** = `f_spot + f_perp`. Reference tiers on Binance:
base **taker ~15 bps** (10 spot + 5 perp), mixed **~11 bps** (maker perp + taker spot, with discounts),
VIP **maker ~4 bps** on both legs. The break-even is the number that decides it.

## Result — F-23: the two "improvements" are cost-fragile; the flat book is the only cost-robust sleeve

| book | gross Sharpe | gross %/yr | turnover / 8h | **turnover / yr** | **break-even** | net Sharpe @2 | @4 | @10 | @15 bps |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| flat equal-weight carry (F-04) | 4.54 | +9.05 | 0.0002 | **0.2×** | **5422 bps** | 4.54 | 4.54 | 4.54 | 4.53 |
| xs funding **level** (F-17) | 3.27 | +21.21 | 0.800 | **876×** | **2.42 bps** | 0.57 | −2.11 | −9.85 | −15.79 |
| xs funding **rank** (F-17/F-21) | 5.03 | +15.00 | 0.733 | **803×** | **1.87 bps** | −0.35 | −5.62 | −19.75 | −28.85 |
| basis reversion **basisOnly** (F-10) | 9.15 | +13.13 | 0.425 | **465×** | **2.82 bps** | +2.69 | −3.83 | −22.70 | −36.36 |
| basis reversion **carryPlus** (F-10) | 9.54 | +16.44 | 0.425 | **465×** | **3.54 bps** | +4.17 | −1.26 | −17.24 | −29.39 |

The rank book, which the lab called its strongest sleeve, turns over **803× gross notional per year**
(≈2.2× per day) and therefore **breaks even at 1.87 bps**. Its gross edge (1.37 bp/period) is smaller
than a single base-tier perp taker fee. The pattern is the same for the level book (2.42 bps) and both
reversion books (2.82 / 3.54 bps). **None of them survives a realistic fee.** Only the flat book does,
and by an enormous margin, because a delta-neutral hold barely trades: its exposure is constant, so its
turnover is a one-off entry (`0.0002` per period).

**The flat book is not quietly expensive either.** If the hedge is re-established every period (to undo
the delta drift `basisPnl`), the implied extra turnover is `Σ_i (1/k)|basisPnl_i| = 0.00037` per period
(`0.41×`/yr) — break-even **2218 bps** even then. So the flat carry sleeve clears every fee tier; the
dispersion and reversion sleeves clear essentially none.

**Read.** This does **not** contradict F-17/F-10 as *measurements* — the dispersion book really does
have a 5.0 gross Sharpe and the reversion signal really does have an 8/8-positive IC. It says those
are **gross-only** results: as *trades*, at 8h rebalancing, they are dominated by the small fee they
must pay to chase the signal. This is the same class of error as F-11/F-19 — a number that is true of
the series and false of a strategy — and it is the reason the flat book's "boring" 4.54 is the lab's
most valuable result: it is the only one that is already net of everything.

## What this changes

* **R8 (the dollar-neutral dispersion sleeve) cannot be ported as specified.** Its precondition was
  L14 (cleared, F-22); its *new* gate is cost. The port queue now needs a **low-turnover** dispersion
  construction, not the daily rank reshuffle.
* **R4 (the flat inverse-vol carry sleeve) is unaffected and strengthened** — it is the cost-robust
  sleeve, and inverse-vol weights (unlike rank weights) change slowly.
* **New lead L15 — capacity / market impact.** e16 measures fees but not *depth*; at these turnover
  levels the impact term may be larger than the fee. No volume/depth data is stored in the lab yet.
* **New lead L16 — low-turnover dispersion.** Can the rank signal be harvested with a deadband / hold /
  smoothing so its turnover falls enough to clear ~5 bps? This is now the gating question for L12/R8.

## Ledger effects

* New **F-23** (cost fragility). **F-17** and **F-10** gain the cost caveat and their verdicts change
  from "SUPPORTED" to **"SUPPORTED as a signal — cost-fragile as a trade"**.
* **L12** and **L11** re-labelled accordingly; **L03** (flat carry) notes that it is the cost-robust
  sleeve. New leads **L15** (capacity) and **L16** (low-turnover dispersion).
* `FOLD-BACK.md`: **R8 re-gated on cost** (needs an L16 construction); **R4 un-gated and strengthened**.
* New code: `experiments/e16_cost_capacity.js`; `e12#weightSeries`; `e7#{includeWeights, pooledWeights,
  pooledReturns}`.

## Next

* **CYCLE-009 — L16: test low-turnover dispersion** (deadband, hold-N, weight smoothing, and
  rebalance-only-on-rank-change). The question is whether *any* cadence both keeps the gross edge and
  cuts turnover enough to clear a realistic fee. If none does, R8 is dead as a trade and L12 is a
  signal of record rather than a sleeve.
* L15 (capacity) needs volume/depth data — a harvest, not an experiment.
