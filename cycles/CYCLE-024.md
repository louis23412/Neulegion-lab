# CYCLE-024 — Is the OI capacity bound a mean or a distribution? (L07 / L15 / L17 / L18 audit)

**Date:** 2026-11-24
**Goal:** Every working sleeve in the lab now carries an "open-interest position capacity" — the gross
notional at which its holding is 5 % of open interest — and F-28, F-38 and F-40 all quote it as a single
number ($6.9 M flat; $13.2 M → $19.2 M → $35.9 M dispersion; $37 M → $54 M fade). Every one of those
numbers is built the same way:

```
G_pub = f * mean_t( OI_j(t) ) / mean_t( |w_j(t)| )          [a RATIO OF MEANS]
```

That is an *average-case* bound. The constraint a desk actually faces is per-period and per-symbol —
`|w_j(t)|·G ≤ f·OI_j(t)` for every `t` and `j` — whose worst case is a **min of ratios**:

```
G_true = f * min_{t,j} OI_j(t)/|w_j(t)| .
```

For positive quantities `min ≤ mean` and `mean(A/B) ≥ mean(A)/mean(B)`, so the published ratio-of-means is
an upper bound on the average-case and can sit far above the worst case **whenever open interest dips
exactly when the book's weight spikes** — which is the whole mechanism of a squeeze (the position is
largest when the market is thinnest). This cycle asks whether that gap is material, and restates the size.

## Work

1. **`experiments/e33_oi_capacity_distribution.js`** (new, registered as `e33_oi_capacity_distribution`) —
   builds the five working sleeves exactly as their source experiments do (`e17#buildBook` for the
   dispersion books, `e22#buildMasked` for the fade books, `e19#capacityOf` for the impact capacity), then
   for each computes **three** bounds at f = 5 %:
   * `ratioOfMeans` — the published convention;
   * `meanOfRatios` — the true average-case, `f / mean_t(|w_j|/OI_j)`;
   * `minOfRatios` — the true worst-case, `f · min_t(OI_j/|w_j|)`;
   plus the **time-varying** bound `G_t = f·min_j OI_j(t)/|w_j(t)|` and its distribution (full, recent
   24 m, recent 12 m, recent 3 m — each over the most recent *OI-covered* periods), the participation the
   published size actually implies period by period, and the capacity during stress.
2. **Falsifier (pre-registered):** the correction is **immaterial** if every sleeve's recent-24 m worst-case
   bound is within 20 % of its published `ratioOfMeans` **and** the book breaches the 5 % cap less than 5 %
   of the time at the published size. Otherwise the F-28/F-38/F-40 capacities must be restated.
3. **Guards:** `disp_lam0.1` must reproduce e30's stored `ewma_0.1_norm` 5 % bound
   (**$23 413 984.80**, LINKUSDT) and `fade_lam0.1` must reproduce e32's stored `lam0.1` bound
   (**$36 986 403.11**) to 1e-12 relative.

## Results

**(a) All three bounds, ordered as theory says — the published number is the loosest.**

| sleeve (5 % of OI) | published `ratioOfMeans` | true `meanOfRatios` | naive `f·min(OI)/mean|w|` | true `minOfRatios` |
| --- | ---: | ---: | ---: | ---: |
| dispersion λ=0.1 (spec) | $23.41 M | $18.28 M | $7.85 M | **$4.37 M** |
| dispersion λ=0.01 (F-38) | $19.20 M | $14.89 M | $6.44 M | **$4.99 M** |
| dispersion λ=0.02 + cap12.5 % | $35.94 M | $29.31 M | $12.06 M | **$11.50 M** |
| fade λ=0.1 (spec) | $36.99 M | $26.49 M | $9.19 M | **$4.19 M** |
| fade λ=0.1 + cap12.5 % (F-40) | $53.84 M | $40.33 M | $16.22 M | **$12.62 M** |

The binding symbol is **LINKUSDT in every case**. Two things stand out. First, the ratio-of-means is
consistently ~22–25 % above the true *average* case (Jensen, as predicted). Second, the true *worst* case is
**2.6–8.8× below the published number**. Third — a methodological point — the naive "just use the minimum
OI" fix (`f·min(OI)/mean|w|`) is still **~1.8× too high** for the uncapped books: the min of a *ratio* is not
a ratio with a min. Only for the capped books (where `|w|` is nearly flat, so numerator and denominator vary
independently) do the two converge ($12.06 M vs $11.50 M).

**(b) At the published size the book breaches the 5 % cap a majority of the time.** The `max_j` participation
`|w_j(t)|·G_pub/OI_j(t)` over the book's life:

| sleeve | median participation | p99 participation | **peak participation** | periods over the 5 % cap |
| --- | ---: | ---: | ---: | ---: |
| dispersion λ=0.1 | 6.9 % | 18.2 % | **26.8 %** | **68.2 %** (≈747×/yr) |
| dispersion λ=0.01 | 5.9 % | 16.6 % | **19.2 %** | **65.1 %** |
| dispersion λ=0.02 + cap12.5 % | 6.1 % | 13.3 % | **15.6 %** | **69.3 %** |
| fade λ=0.1 | 8.2 % | 29.7 % | **44.2 %** | **69.4 %** (≈760×/yr) |
| fade λ=0.1 + cap12.5 % | 8.5 % | 18.9 % | **21.3 %** | **76.6 %** |

So "the holding is 5 % of open interest" is true only *on average*; the median is 5.1–8.5 %, and the peak is
**16–44 % of a single symbol's open interest**. The published capacity is a size at which the book is
*usually* over the limit it is named after.

**(c) The worst moments are the dislocations, and they are recent.** The five thinnest periods (full sample)
are all LINK in **2023-06/07** (dispersion: $4.37 M on 2023-07-08; fade: $4.19 M on 2023-06-11; dispersion
λ=0.01: $4.99 M on 2022-05-13 — LUNA). But the constraint binds in the *current* regime too: the recent-24 m
minima are **$8.29 M on 2026-07-01** (dispersion λ=0.01), **$9.28 M on 2026-03-27** (fade), **$7.38 M**
(dispersion spec), and the recent-3 m (2026-06→08) p5 bounds are **$8.60 M / $12.09 M / $15.25 M** for the
three uncapped sleeves. In every thin period the mechanism is the same: the uncapped book puts **~38–44 % of
its gross notional in LINK**, the thinnest-relative symbol, exactly when LINK's OI is low.

**(d) Restated, deployment-relevant sizes (min of impact capacity and the OI bound).** The published
"usable" number is the mean-basis OI bound (or the impact capacity, whichever binds); the honest planning
number is the recent-24 m p5 OI bound:

| sleeve | published usable | restated (recent-24 m p5) | overstatement | current (3 m) p5 | never-breach (full) |
| --- | ---: | ---: | ---: | ---: | ---: |
| dispersion λ=0.1 (impact-bound) | $13.21 M | $11.19 M | 1.18× | $15.25 M | $4.37 M |
| dispersion λ=0.01 (F-38) | $19.20 M | $10.25 M | **1.87×** | $8.60 M | $4.99 M |
| dispersion λ=0.02 + cap12.5 % | $35.94 M | $20.34 M | **1.77×** | $24.23 M | $11.50 M |
| fade λ=0.1 | $36.99 M | $12.27 M | **3.02×** | $12.09 M | $4.19 M |
| fade λ=0.1 + cap12.5 % (F-40) | $53.84 M | $21.87 M | **2.46×** | $24.35 M | $12.62 M |

**(e) The F-27/F-40 cap survives the correction — and is now better motivated.** The cap fixes *exactly*
the concentration that makes the worst case bind: it lifts the never-breach bound for the fade from
**$4.19 M → $12.62 M (3.0×)** and for the dispersion book (λ=0.02 vs λ=0.1) from **$4.37 M → $11.50 M**,
and it cuts the peak participation from 44 %/27 % to 21 %/16 %. F-40's cap conclusion was right; its
*level* ($54 M) was the average-case number.

**(f) Coverage, and the certifiability rule (tightened in CYCLE-025).** A period counts only if *every symbol
the book trades* has an OI print — a min-of-ratio over a partial symbol set is meaningless and can explode
(before this rule the dispersion book read a **$936 B** capacity on 2021-11-04, when only BTC had OI and the
book's BTC weight was 0.0002). Under the rule the dispersion books cover **5 176 / 6 557** periods
(**78.9 %**, 2021-12-01 → 2026-08-31; the seven alts' OI starts 2021-12) and the fade books **5 176 / 5 248**
(**98.6 %**); the book's last bar is 2026-09-19 (the OI harvest ends 2026-08-31), so every window here is
over the most recent *certifiable* periods. The breach fractions above are computed on certifiable periods
only, which is why they are higher than an unconditional count.

## What is now false that used to be believed

* **"The working sleeves cap out at $19–54 M (5 % of open interest)."** Those are *ratio-of-means*
  (average-case) numbers. Corrected to the true min-of-ratio, the recent-24 m p5 bounds are **$10.2–21.9 M**
  (1.8–3.0× lower) and the never-breach bounds are **$4.2–12.6 M**.
* **"At the published size the holding is 5 % of open interest."** It is 5 % *on average* only: the median
  is 5.1–8.5 % and the peak is **16–44 %** of a single symbol's OI, with the book over the 5 % cap in
  **65–77 %** of periods.
* **"Capacity is a number."** It is a distribution that moves with OI: LINK's OI over the sample spans
  $28.8 M → $295.7 M, so the same book's 5 %-of-OI size spans roughly $3.6 M → $37 M.
* **"Using the minimum OI fixes the bound."** It does not: `f·min(OI)/mean|w|` is still ~1.8× above the true
  worst case for an uncapped book. The correct object is the min of the *ratio*.
* **(Reinforced)** The concentration cap is a *capacity* device, not (only) a cost device — the correction
  is what the cap was already implicitly buying.

## Ledger effects

* New **F-41**; new experiment `e33_oi_capacity_distribution.js`; new artefact
  `results/e33_oi_capacity_distribution.json`; `run_all` is now **41 steps** with a new validation guard.
* **L07** (positioning/sizing half) gets the distributional restatement; **L15**, **L17**, **L18** gain the
  corrected bounds; **L10** gains a new measurement-integrity entry (ratio-of-means vs min-of-ratio).
* **FOLD-BACK R7/R8** restated: port the sleeves at the recent-24 m p5 size (~$20 M each), not the published
  mean-basis size.
* No shipped *return* number moves — this cycle touches the capacity/risk layer only.

## Next

* **Dynamic (OI-scaled) sizing** — since the bound moves with OI, a book that targets a constant
  *participation* (size ∝ current OI) converts an infeasible constant size into a feasible schedule. Measure
  the return/turnover cost of the schedule vs the constant-size book.
* **L07's liquidation-print half** remains blocked on data: the public `data.binance.vision` bucket no longer
  publishes `liquidationSnapshot` (the daily and monthly `futures/um` prefixes list only klines, mark/index/
  premium klines, aggTrades, trades, bookDepth, bookTicker, metrics, fundingRate), and the exchange APIs
  (OKX `public/liquidation-orders`) return only the last few days — so the prints are not reconstructible for
  a 6-year test. Revisit only if a durable archive appears.

## Run

`e33` ~2.5 s (registered). Full `run_all` regeneration **41 steps** (`RUN_SUMMARY` at
**2026-09-26T20:57:32Z**); controls `e0c`, `e5` (1h/15m), the 13-check `e14`, and the validation guards
`e28`–`e33` all report `pass`.

*(Superseded run, CYCLE-025.)* `e33` was corrected for the partial-symbol-set bug in CYCLE-025 (L10-x);
its headline bounds are unchanged and its rise in breach fraction (65–77 %) is now canonical. The
current full regeneration is the **42-step** run at `RUN_SUMMARY` **2026-09-26T21:32:49Z**, in which
`e33` and the new `e34` both report `pass` and reproduce the numbers above.
