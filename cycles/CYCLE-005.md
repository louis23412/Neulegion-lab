# CYCLE-005 — Cross-sectional carry dispersion (L12)

**Date:** 2026-09-18
**Goal:** test whether the second moment of carry carries information — demean the funding rate across
the basket and trade the *dispersion* (long the carry book on high-funding symbols, short it on low),
rather than each symbol's own funding (F-04).

## Work

* Built `experiments/e12_xs_carry.js`: reconstructs the per-symbol delta-neutral P&L and funding rate on
  the common 8h grid, forms causal cross-sectional weights from `f_{t−1}` (level and rank), and scores
  the books against the flat equal-weight baseline, a **shuffled-weight placebo** (same weight
  distribution, no information) and the price basket. Registered in `run_all.js`.
* Caught an alignment bug in the first draft: the books start at grid index 1 while the market series
  started at 0, so every `marketCorr` came back null; fixed by slicing the market series to the book
  periods.

## Result — F-17

| book | annualised | Sharpe | max DD | design effect | corr w/ price |
| --- | ---: | ---: | ---: | ---: | ---: |
| flat equal-weight carry | +4.78 % | 0.96 | 10.2 % | 234 | −0.015 |
| **xs funding level** | +9.59 % | **6.11** | **1.6 %** | 174 | −0.009 |
| xs funding rank | +7.26 % | 4.83 | 1.1 % | 246 | −0.005 |
| xs funding only (no basis leg) | +5.63 % | 18.5 | 0.02 % | 3.7 | −0.003 |
| shuffled-weight placebo | −0.11 % | −0.08 | 3.0 % | 0.3 | +0.012 |

The weights carry real information (placebo ≈ 0), the book is price-uncorrelated, and the
cross-sectional construction cuts the drawdown ~6×. **Not banked** — the magnitude trips F-11 and the
design effect implies only ~13–18 independent observations.

## The important discovery: the carry window is 2.9 years because `markPrice` is 0 before 2023-10

While investigating why the sample starts 2023-10-31, the cause is in the *repo's own* funding files:
`markPrice` is populated only from late 2023. So **every** basis-marked result in the lab (F-04, F-16B,
F-17) is confined to a benign positive-funding regime with **no crash** — and a carry book's drawdown
is a crash phenomenon. This single fact bounds the credibility of the entire carry complex, and it is
fixable from public data (CYCLE-006).

## Ledger effects

* New finding **F-17** (SUPPORTED as a lead, heavily caveated); summary table updated.
* **L12** → SUPPORTED-as-a-lead: relative funding is informative and the construction reduces drawdown.
* `FOLD-BACK.md` R4 gains a cross-sectional variant once the history is extended (CYCLE-006).
* New code: `experiments/e12_xs_carry.js`.

## What is now false that was believed at the start of the cycle

* "Carry can only be harvested per-asset (each symbol's own funding)." → **false**; demeaning the
  funding across the basket and trading the dispersion turns a 10.2 % drawdown into 1.6 % in this
  window, with informative weights (F-17).
* "The flat carry book's 10 % drawdown is a property of carry." → **not established**; the sample has
  no crash in it, so the flat book's drawdown may be understated *and* the dispersion book's advantage
  may not survive a crash.

## Next

* **CYCLE-006** — extend the mark-price history to 2020 with `data.binance.vision`
  `futures/um` mark-price klines, so the whole basis-marked carry complex (F-04, F-16, F-17) can be
  re-tested **through the 2021-05 and 2022 crashes**. This is the single highest-value robustness test
  in the lab.
