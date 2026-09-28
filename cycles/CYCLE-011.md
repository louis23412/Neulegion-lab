# CYCLE-011 — L15: what size can the carry complex carry?

**Date:** 2026-09-28
**Goal:** answer the last physical question left on the carry complex. CYCLE-008 measured the **fee**
(F-23); CYCLE-009/010 showed smoothing pays it (F-24/F-25), leaving **capacity/impact (L15)** as the one
binding limit. A yield sleeve is bounded by size, not Sharpe — so this cycle builds the data and the model
that turn the lab's tradable books into an *exit-capital* number.

## Work

1. **Harvested the missing field.** The `futures/um` 8h kline payload carries `volume`, `quote_volume`
   and `count`, which the repo discards. A durable harvester (`data/harvest_perp_flow.js`) loops the
   public bucket (`data.binance.vision/.../klines/<SYM>/8h/`), normalises the 2025-01 µs-timestamp change,
   and writes `data/perp_flow_8h.json` (8 symbols × 74 months, 1.46 MB; the only gaps are the two expected
   SOLUSDT 2020-07/08 404s). Reader `lib/lab.js#loadPerpFlow` + `flowIndexAt`.
2. **Impact model.** Square-root law `impact = Y·σ_8h·√(Q/V)` with `Q = |dw|·G` and `V` the *same bar's*
   dollars traded, so a book's per-period cost in bps of gross notional is exactly `c_t·√G`
   (`c_t = 1e4·Y·Σ_j σ_j |dw_j|^1.5 / √V_jt`). `σ` is a trailing-30-bar realized vol from the traded perp
   closes; `Y ∈ {0.5, 1, 2}` because capacity scales as `1/Y²`. Only the perp leg is charged (the spot
   hedge adds a second, smaller term), so every capacity is an **upper bound**.
3. **`experiments/e19_capacity_impact.js`** (new): runs every book through the E16/E17/E18 builders
   (`buildBook`, `reversionFromBook`, `applyPolicy`) — flat, `xsRank_daily`, `xsRank_ewma0.1_norm`,
   `xsLevel_ewma0.1_norm`, `revCarry_daily`, `revCarry_ewma0.1_norm` — scales each to mean gross
   exposure 1, and reports gross Sharpe, turnover, break-even, the net Sharpe ladder at
   $1 M…$10 B, and `capacity = ((gross − fee·T̄)/c̄)²` for each `(Y, fee)`.
4. **Alignment guards (asserted in the artefact):** `Y=0 at G=0` must reproduce `e16#audit`'s break-even
   and net@4 *exactly* (`e16Agree: true`); impact vanishes at `Y=0`; impact scales linearly in `Y`; the
   reversion times are 8h-aligned; no volume term fell back to a mean.
5. **A new data-integrity check** (`e14#perp_flow_integrity`): the flow grid must match the traded perp
   close grid (flow `t0` = the first non-null traded close time), and `qv ≈ close·vol` must hold
   (median ratio 1.000) — a column mix-up or a one-bar offset would silently distort every capacity number.
6. **Opened L17** (capacity-aware weighting): at its capacity the dispersion book's binding symbol is
   DOGE at ~1 % of ADV, which is a property of the *rank weighting*, not the signal — so it may be fixable.

## Result — F-26: impact, not the fee, is the binding limit; the complex splits by size

Perp ADV (USDT/8h): BTC **4.66 B**, ETH 2.80 B, SOL 0.66 B, XRP 0.39 B, DOGE 0.33 B, BNB 0.22 B, ADA
0.16 B, LINK **0.12 B** — the thin alts set the limit, not BTC.

| book | gross Sharpe | turnover / yr | net@4 (no size) | capacity @ 4 bps — Y=0.5 / **Y=1** / Y=2 |
| --- | ---: | ---: | ---: | ---: |
| flat equal-weight carry | 4.54 | ~0× | +4.54 | 201 B / 50 B / 12.6 B † |
| xsRank_daily (F-23 baseline) | 5.03 | 803× | −5.62 | 0 / 0 / 0 |
| **xsRank_ewma0.1_norm** (F-24) | 5.18 | 85× | +3.55 | 52.8 M / **13.2 M** / 3.3 M |
| xsLevel_ewma0.1_norm | 4.66 | 86× | +3.51 | 92.4 M / **23.1 M** / 5.8 M |
| revCarry_ewma0.1_norm (F-25) | 5.04 | 43× | +4.05 | 381 M / **95.4 M** / 23.8 M |

† the flat book is a *hold* (turnover ≈ 0), so its number is entry-only and its real limit is open
interest / spot depth (unmeasured — L07). The dispersion book's is steady-state turnover.

The Sharpe erosion is the point: F-24's dispersion book goes **+3.55 → +2.57 ($1 M) → +0.45 ($10 M) →
−5.0 ($100 M)**, and at a taker fee (11 bps) its capacity is **$0.5 M**. At capacity the binding symbol is
DOGE (~1 % of ADV); the evenly-weighted timed-carry overlay carries ~**7×** the capacity because it does
not concentrate weight there, even though its gross Sharpe is *lower*.

**Read.** F-23 removed the fee objection and F-24/F-25 restored the improvements — but impact re-splits the
complex. The lab's best **Sharpe** is not its most **deployable** sleeve: the flat carry *hold* scales
(it barely trades), while the dispersion and timed-carry *improvements* are capacity-bound to ~$10–100 M at
maker fees and to well under $1 M at taker fees. For size, the answer is the flat hold; for the dispersion
sleeve, it is a capacity-aware construction (L17).

## What is now false that used to be believed

* **"The dispersion/reversion improvements are tradable sleeves."** They are tradable *at small size*
  only. F-24/F-25 answered the fee; F-26 shows the fee was not the last gate — capacity is. A Sharpe-5
  sleeve with $13 M of capacity is a different asset than F-17/F-24 implied.
* **"Carry is a yield sleeve, so it scales."** Only the *flat* carry scales; the cross-sectional and
  timed variants do not, because they concentrate per-symbol weight precisely in the thin alts.

## Ledger effects

* New **F-26** (impact/capacity).
* **L15 → SUPPORTED — closed.** **L17 opened** (capacity-aware weighting).
* New data `data/perp_flow_8h.json` + harvester; new `e14` check `perp_flow_integrity`.
* New code `experiments/e19_capacity_impact.js`; exports added to `e17` (`buildBook`, `rankWeights`,
  `levelWeights`) and `e18` (`applyPolicy`); `e7#reversionFromBook` now also returns `pooledTimes`;
  `e12#buildXsSeries`/`e7#reversionFromBook` now return `config.symbolList` (the column order had been
  implicit).

## Next

* **L17 (capacity-aware weighting)** — cap `|w_j|` / inverse-ADV scale and re-measure capacity vs Sharpe.
  This is the direct fix for F-26's limit and the top of the new frontier.
* **L07 open interest** — the flat book's real size limit.
* The **F-24 edge decay (2025–26)** shrinks capacity as well as Sharpe; still open.
