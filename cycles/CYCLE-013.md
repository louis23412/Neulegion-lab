# CYCLE-013 — L07 probe 2: does open interest carry a signal, and what size does OI allow?

**Date:** 2026-09-30
**Goal:** two questions that CYCLE-011 (F-26) left open. (1) **Signal:** THEORY E-C ranked *open
interest* — who is levered and where — as the highest-prior mechanism not in the data; the repo
discards it and Binance publishes it free. Test it against the next return and the next funding rate,
honestly (causal, dollar-neutral), as the taker-flow probe (F-15) was tested. (2) **Size:** F-26
measured only the *impact* limit on the carry complex and flagged that the **flat hold's real limit is
open interest**, which it could not measure. OI is the number that says what fraction of the market a
held position *is* — measure it and settle whether the carry complex is a $50 B or a $10 M strategy.

## Work

1. **`data/harvest_open_interest.js`** (new, durable): fetch Binance's free `futures/um` **daily
   metrics** bucket (`<SYM>-metrics-<YYYY-MM-DD>.zip`, 5-minute rows), parse `sum_open_interest`,
   `sum_open_interest_value` (USDT notional) and the toptrader long/short ratio, **aggregate to the 8h
   funding grid** (mean over each window), and write `data/open_interest_8h.json` (symbol → absolute
   grid, same shape as the flow file; zero-valued source rows nulled). ~42 700 symbol-periods; BTCUSDT
   from 2020-09, the other seven from 2021-12 (earlier days 404).
2. **`lib/lab.js#loadOpenInterest`** (new reader) + an **`e14#oi_integrity`** check: asserts the OI grid
   matches the flow grid, coverage is non-trivial, notional ≈ contracts × price, and the ratio column is
   in [0, 1]. The join is two data sources, so it gets a regression test (F-18 rule).
3. **`experiments/e21_open_interest.js`** (new): (A) pooled and per-symbol **information coefficients**
   of Δlog(OI notional) → next 8h return and → next funding rate, plus causal **dollar-neutral books**
   traded on the OI change and on the toptrader ratio, audited by `e16#audit`; (B) the **positioning
   capacity** — `G` at which the flat book's `G/k` per symbol, and the dispersion book's
   `mean|w_j|·G` per symbol, reaches 1 %/5 %/10 % of the thinnest symbol's (mean and minimum) OI.
4. **A look-ahead trap was hit and fixed (F-11 class).** `buildXsSeries` pushes `bookTimes[m] =
   legs.times[m+1]`, so book period `i` ends at `times[i]` and its return is `legs.spotRet[i+1]` — the
   signal at `i` is **contemporaneous** with that return. The *next* return is `legs.spotRet[i+2]`. Using
   `[i+1]` gave pooled IC **0.595** and a book Sharpe **17**; the artefact now uses `NEXT = 2` and
   carries the contemporaneous IC beside the next-period one precisely to expose the trap. Recorded in
   L10.

## Result — F-28: no signal, but OI sizes the flat book

**Signal: nothing.**

| signal | pooled next-8h IC | causal dollar-neutral book (gross Sharpe) |
| --- | ---: | ---: |
| Δlog(OI notional) → next spot return | **0.020** | 0.8–1.2 (≈0) |
| Δlog(OI notional) → next funding rate | 0.027 | — |
| toptrader long/short ratio → next spot return | ≤ 0.02 | ≈0 |
| Δlog(OI) → **contemporaneous** return | **0.595** | *the look-ahead* (Sharpe 17 if mis-aligned) |

Per-symbol next-8h IC is 0.00–0.06; the toptrader ratio is no better; both causal books are negative
net of any realistic fee. So the two free non-price fields Binance publishes — taker imbalance (F-15)
and open interest (F-28) — are **both independent but directionless**.

**Size: the flat book is OI-limited to tens of millions.**

| book | 1 % of thin OI | 5 % | 10 % |
| --- | ---: | ---: | ---: |
| flat hold (G/k per symbol) | **$6.9 M** | $34.3 M | $68.6 M |
| flat hold (thinnest at its historical-min OI) | $2.3 M | $11.5 M | $23.0 M |
| F-24 dispersion book | $4.7 M | $23.4 M | $46.8 M |

Thinnest symbol = LINK (mean OI $86 M). The flat hold is **not** impact-limited (F-26: it barely
trades) but it *is* OI-limited: at 1 % of the thin alts' open interest it carries ~$7 M, not $50 B.
The turnover-heavy sleeves are impact-limited to the same order (F-26/F-27). So the honest statement
about the whole carry complex is that it is a **~$5–70 M strategy**, bounded by *both* limits.

## Challenge — the F-28 conclusion was wrong, and the bug hunt found why (F-29, L10-q, L10-r)

Before closing the cycle I re-read the `e21` artefact and challenged its own verdict. The toptrader
book had a *gross* Sharpe of **1.18** with a break-even of **29.6 bps** — not "≈0" — so "both fields
directionless" did not survive the artefact's own table. Two things came out of testing it:

1. **A look-ahead (L10-q, F-11 class).** `buildXsSeries` sets `bookTimes[m] = legs.times[m+1]`, so book
   period `i` is **contemporaneous** with `legs.spotRet[i+1]`; the next return is `legs.spotRet[i+2]`.
   Using `[i+1]` read IC 0.595 / Sharpe 17 because OI *notional* embeds its own window's price move.
   Fixed with `NEXT = 2`; the artefact now carries the contemporaneous IC beside the next one.
2. **A missing-data bug (L10-r).** The positioning fields start 2021-12 for 7 of 8 symbols. `xsBook`
   set a missing signal to `0` and *then* demeaned it to `−mean`, giving the absent symbols a large
   weight in ~1 300 early periods. Fixed by **masking** absent symbols (excluded from the demean,
   weight 0) and starting at the first all-present period; `e14#oi_missing_is_null` now asserts the
   precondition (asymmetric coverage, missing stored as `null`, never `0`).

With both fixed, the **OI change** is confirmed directionless as a *tradable* signal (gross 0.96 but
1 501×/yr turnover → net@4 −1.07). But the **toptrader ratio**, used **cross-sectionally**, is a real,
modest, independent contrarian signal — **F-29**: dollar-neutral fade, gross Sharpe **1.055**,
turnover 126×/yr, break-even **15.1 bps**, **net@4 +0.77**, positive in 4/4 quartiles and 5/6 years,
block-bootstrap p5 **+0.36**, placebo z **2.1**, β ≈ 0 on the funding-rank carry book. It is invisible
to a level-IC screen (≤ 0.02) — only the *demeaned cross-section* sees it, which is F-03's lesson
applied to new data. Spun out as **L18** (SUPPORTED — lead).

## What is now false that used to be believed

* **"Open interest is the highest-value remaining fetch — a new mechanism."** The **OI *change*** is not
  a directional signal: Δlog(OI) predicts the next 8h return with IC 0.020 and its book clears no fee
  (1501×/yr turnover). But the positioning fields are **not** empty: the **toptrader ratio, used
  cross-sectionally, is a real (modest) contrarian signal** (F-29 → L18). The lesson is that a *level-IC
  screen misses a cross-sectional edge* — the same field that reads ≈0 in levels pays when demeaned
  across the basket.
* **"The repo can discard the positioning fields without losing a signal."** False as just stated: it can
  discard the **OI level** (a sizing input, not a signal) but the toptrader ratio carries a tradable
  cross-sectional edge (F-29), so the metrics bucket is worth fetching for R7's sake.
* **"The flat carry hold is not capacity-limited (F-26)."** It is not *impact*-limited, but it is
  **OI**-limited: the correct size limit on a held position is the fraction of the market it is, and at
  1 % of the thin alts' open interest the flat book carries ~$7 M. F-26's "not impact-limited" was
  necessary but not sufficient.
* **"OI notional is a clean exogenous regressor."** It embeds the price move of its own window, so a
  one-index alignment error reads as IC 0.60 / Sharpe 17. Any future OI feature must carry an explicit
  next-period lag profile.
* **"A cross-sectional book can treat a missing signal as 0."** It cannot: demeaning turns `0` into
  `−mean`, so absent symbols get a large weight (L10-r). Absent symbols must be masked.

## Ledger effects

* New **F-28** (OI: no directional signal, but it prices the flat book) and **F-29** (the toptrader
  ratio cross-sectionally = a modest contrarian edge); new data `data/open_interest_8h.json` + durable
  harvester; new reader `lib/lab.js#loadOpenInterest`; **two new regression checks** in `e14`
  (`oi_integrity`, `oi_missing_is_null`); new experiment `experiments/e21_open_interest.js` (registered
  in `run_all`); **new lead `L18`** (SUPPORTED — lead).
* **L07 → PARTIALLY CLOSED**: the *directional* signal half is negative (flow F-15, ΔOI F-28, toptrader
  level); OI is positive as a **sizing tool**; the toptrader ratio is positive **cross-sectionally**
  (spun out to L18). Only the liquidation-print half remains untested.
* **R4/R8 at size** now cite the OI limit beside the impact limit. **R7** gains a live reason to be
  revisited (the metrics bucket's toptrader field, pending L18's holdout).

## Next

* **L18** (validate the toptrader fade: held-out split + capacity) is now the top of the frontier, then
  **L13** (short-horizon reversal gross edge), **L06** (meta-labelling) and **L08** (maker fills). L07's
  remaining liquidation-print probe is optional.
* The **F-24 edge decay (2025–26)** remains open as a risk question.

## Run

Full `run_all` regenerate after the edits and the mid-cycle challenge (26 steps, `results/RUN_SUMMARY.json`
@ 2026-09-26T15:30:03Z, ~13–14 min end-to-end; `e21_open_interest` 2.4 s). Controls `e0c`, `e5` (1h/15m)
and integrity `e14` (now **13 checks**, incl. `oi_integrity` and the new `oi_missing_is_null`) all report
`pass`. The placebo and bootstrap in `e21` are seeded (reproducible): placebo z **2.1**, bootstrap Sharpe
p5/p50/p95 **+0.36/+1.06/+1.83**.
