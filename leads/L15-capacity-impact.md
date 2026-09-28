# L15 — Capacity / market impact of the carry complex

**Status:** SUPPORTED — F-26 (CYCLE-011) closed the *original* carry complex; **re-opened in CYCLE-021
(F-38) for the retuned (slow) dispersion book**, where the square-root impact bound is no longer the
binding limit at all. The fee is measured (F-23) and impact too: the dispersion and timed-carry
improvements are capacity-bound to ~$10–100 M, the flat carry hold is not impact-limited. A
capacity-aware construction — the next lever this lead named — was tested and works (L17, F-27: a strict
12.5 % per-symbol cap doubles the dispersion capacity). F-38 then showed that for the F-37 retuned book
the limit is **open interest**, not impact (the impact capacity diverges as turnover → 0).
**Capacity restatement (CYCLE-024 / F-41).** F-38's OI bounds ($19.2 M / $35.9 M) are *average-case*
(ratio-of-means). As a distribution the true min-of-ratio is **$4.99 M (λ=0.01) / $11.50 M (λ=0.02+cap)**
and the recent-24 m p5 is **$10.25 M / $20.34 M**; at the published sizes the book is over the 5 % cap in
**65 % / 69 %** of periods. The cap still raises the never-breach bound **$4.37 M → $11.50 M**.
**Sizing policy (CYCLE-025 / F-42).** The OI bound is a **clip**, not a target: a constant trailing-p5 size
breaches the cap in 2.7–3.7 % of periods, a lagged (EWMA) size breaches **53–55 %**, and following OI exactly
raises the mean size 2.05× ($11.2 M → $22.9 M) but lowers the dollar Sharpe (5.02 → 3.26). Target the
trailing-median size and clip at `f·min_j(OI/|w|)` → **$16.94 M**, zero breach, Sharpe 4.41.
**Portfolio capacity (CYCLE-026 / F-43).** For a *multi-sleeve* book the OI bound is a **portfolio**
constraint, not per-sleeve: the two working sleeves' individual schedules do not add — the joint schedule
at the F-31 mix is **$31.32 M vs a $55.57 M sum (56 %)**, and running both at their individual compliant
sizes breaches the 5 % cap in **78 %** of periods (peak 10 %). A min-of-ratios capacity is not
diversifiable because the constraint is on the summed *positions*, not on the return correlation.
**Joint frontier (CYCLE-027 / F-44).** The exact object is a per-period 2-D LP `max Σ g_s G_s s.t.
|Σ G_s w^s_j| ≤ 5 %·OI_j`. Its free-split total gross is **mean $62.72 M (1.13× the sum), median
$37.11 M (0.88×), p99 $624 M, 2.00× the fixed mix** — so F-43's 56 % was the *fixed split*, and the
constraint itself is cheap (the books **net** in some thin symbols). But the optimal split is unstable
(fade share p5 0 / p95 1) and the LP-optimal size schedule churns **48.5× gross/yr** for **net@4 0.62**
(vs carry's 6.49): the frontier is a **capability**, not a deployable size.
**Opened:** CYCLE-008
**Last updated:** CYCLE-027
**Owner experiments:** `e19_capacity_impact.js`, `e30_retuned_capacity.js`, `e33_oi_capacity_distribution.js`, `e34_oi_scaled_sizing.js`, `e35_portfolio_mix.js`, `e36_portfolio_oi_frontier.js`
**Prototypes:** — (uses the E16/E17/E18 books; no new signal)
**Result artefacts:** `results/e19_capacity_impact.json`, `results/e30_retuned_capacity.json`
**Data:** `data/perp_flow_8h.json` (perp 8h quote volume + trade count; recipe `data/harvest_perp_flow.js`),
`data/open_interest_8h.json` (the OI position bound, F-38)
**Fold-back rows:** gates R8, and R4 at size
**Falsifier:** a size at which the sleeve's edge survives its own impact. At a plausible institutional
ticket ($1–10 M per leg per rebalance) it should pass; far below it, it fails.

## Claim / opening

`e16_cost_capacity.js` (F-23) measures the *fee* a book pays per unit of turnover; Binance also charges
**impact** — the slip between the mid you decide on and the fill you get. At the dispersion book's 803×/yr
turnover (85×/yr after F-24 smoothing) even a few bps of impact rivals the edge. The lab originally had
no depth data; the 8h kline payload carries quote volume, which is enough for a square-root impact bound.

## Why it matters

The lab's whole carry complex is a *yield* sleeve — small per-period edge, large notional. Capacity, not
Sharpe, bounds it. A Sharpe-5 book with a $13 M capacity is worth less than a Sharpe-2 book with $500 M.
This is where the fold-back queue meets reality.

## Evidence

Method: `impact_fraction(Q) = Y·σ_8h·√(Q/V)` with `Q = |dw|·G` and `V` the same bar's dollars traded, so
the per-period cost in bps of gross notional `G` is `c_t·√G`. `Y ∈ {0.5, 1, 2}`; the perp leg only (so
these are upper bounds). Books are the E16/E17/E18 sleeves, weights scaled to mean gross exposure 1.

Perp ADV (USDT/8h): BTC 4.66 B, ETH 2.80 B, SOL 0.66 B, XRP 0.39 B, DOGE 0.33 B, BNB 0.22 B, ADA
0.16 B, LINK 0.12 B.

| book | turnover / yr | net@4 (no size) | capacity @ 4 bps — Y=0.5 / Y=1 / Y=2 |
| --- | ---: | ---: | ---: |
| flat equal-weight carry | ~0× | +4.54 | 201 B / 50 B / 12.6 B † |
| xsRank_daily (F-23 baseline) | 803× | −5.62 | 0 / 0 / 0 |
| **xsRank_ewma0.1_norm** (F-24) | 85× | +3.55 | 52.8 M / **13.2 M** / 3.3 M |
| xsLevel_ewma0.1_norm | 86× | +3.51 | 92.4 M / **23.1 M** / 5.8 M |
| revCarry_ewma0.1_norm (F-25) | 43× | +4.05 | 381 M / **95.4 M** / 23.8 M |

† entry-only impact (the flat book is a hold). Sharpe erosion for the F-24 dispersion book: +3.55 → +2.57
($1 M) → +0.45 ($10 M) → −5.0 ($100 M); at a taker fee (11 bps) its capacity is $0.5 M. At capacity the
binding symbol is DOGE (~1 % of ADV).

**Guards (in the artefact):** the Y=0, G=0 cost reproduces `e16#audit`'s break-even and net@4 exactly
(`e16Agree: true`); impact vanishes at `Y=0`; impact scales linearly in `Y`; the reversion times sit on
the 8h grid; no volume term fell back to a mean (`flowTermMissingFraction: 0`).

## Verdict

**Closed — capacity is the binding physical limit on the *improvements*.** The fee objection (F-23) is
answered (F-24/F-25), but impact re-splits the complex: the flat carry **hold** is scalable (it barely
trades), while the dispersion/timed-carry improvements are capacity-bound to roughly **$10–100 M** at
maker fees and **< $1 M** at taker fees. The recommended fold-back changes accordingly: R4 (flat) scales;
R8 (dispersion) is a *small-size* sleeve — and the capacity-aware construction this lead pointed to was
then built (L17/F-27), roughly doubling R8's capacity with a strict per-symbol cap.

## Next actions

1. ~~**Capacity-aware weighting** (new lead): cap each `|w_j|` (or scale by inverse ADV) before
   normalising, and re-measure capacity vs Sharpe.~~ **Done (L17, F-27):** a *strict* per-symbol cap at
   ~1/k doubles capacity ($13.2 M → $26.7 M); inverse-ADV scaling destroys the edge.
2. **Open interest** (L07's other half): the flat book's real size limit is OI / spot depth, not
   turnover; `futures/um` `openInterestHist` (REST) or the metrics bucket would price it. **Extended
   (F-38):** OI is *also* the binding limit for the F-37 retuned dispersion book.
3. Track the F-24 edge decay (2025–26) — a decaying edge shrinks capacity further. **Answered (F-37/F-38):**
   the retune both restores the fee margin and (by removing the impact bound) raises usable size.
4. **Report the OI bound for every hold-like book (F-38).** A smoothed book's square-root impact capacity
   diverges as turnover → 0; the OI position limit is the honest constraint. Re-read the bound against
   *current* OI, not the sample mean.

## Log

* **CYCLE-008** — opened. F-23 showed the fee is decisive at the daily turnover; impact unmeasured.
* **CYCLE-011** — **closed (F-26).** Harvested `data/perp_flow_8h.json` (8 symbols × 74 months, 1.46 MB,
  two expected SOL 2020-07/08 404s); built `e19_capacity_impact.js` (square-root impact, `Y` ladder,
  `capacity = ((gross − fee·T̄)/c̄)²`); added an `e14` flow-integrity check (grid match to the traded perp
  close; `qv ≈ close·vol` median 1.000). Dispersion capacity **$13.2 M** (Y=1, 4 bps), timed-carry
  **$95.4 M**, flat hold not impact-limited, binding symbol DOGE ~1 % of ADV.
* **CYCLE-012** — follow-up answered: L17/F-27 found the dispersion capacity is *improvable* — a strict
  per-symbol cap at ~1/k doubles it ($13.2 M → $26.7 M) at higher in-sample Sharpe and lower turnover /
  drawdown / design effect. The $13.2 M figure above is the *uncapped* baseline.
* **CYCLE-021** — **re-opened for the retuned book (F-38).** `e30_retuned_capacity.js` (validated against
  `e19`'s stored λ=0.1 capacity to the last digit) measures both size bounds for the F-37 λ-family. The
  λ=0.1 spec is impact-bound ($13.2 M, DOGE); every slower book has a *diverging* impact capacity and is
  instead **OI-bound (LINK)** — $19.2 M at λ=0.01, **$35.9 M** at λ=0.02 + the F-27 12.5 % cap (recent
  net@4 +4.24, break-even 15.97 bps). So the retune improves size as well as fee, and the honest size
  limit for a hold-like book is open interest, not impact.
* **CYCLE-024** — **restated as a distribution (F-41).** F-38's OI bounds were ratio-of-means; the true
  min-of-ratio is 2.6–8.8× lower ($11.50 M for the capped retuned book) and the published size breaches
  the 5 % cap in 65–77 % of periods. The 12.5 % cap is the fix.
* **CYCLE-025** — **the bound is a schedule, not a number (F-42).** A constant trailing-p5 size is not
  compliant (2.7–3.7 % breach); a lagged size breaches 53–55 %; the working recipe is a clipped
  trailing-median (~$16.94 M, zero breach).
* **CYCLE-026** — **the bound is a *portfolio* constraint (F-43).** With two sleeves the capacities do
  not add: the joint schedule at the F-31 mix is 56 % of the sum, and both at their individual sizes
  breaches the 5 % cap in 78 % of periods. Uncorrelated returns do not diversify a min-of-ratios capacity.
* **CYCLE-027** — **the joint frontier (F-44, refines F-43).** The exact object is a per-period 2-D LP;
  its free-split total gross is ~the sum (mean 1.13×, median 0.88×, 2.0× the fixed mix), so the 56 % was
  the *fixed split*, not the constraint. But the optimal split is unstable (p5 0 / p95 1) and the
  LP-optimal schedule churns 48.5× gross/yr for net@4 0.62 — a **capability**, not a size. `e35#buildPair`
  extracted (artefact byte-identical).
