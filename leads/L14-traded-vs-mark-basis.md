# L14 — Mark price vs traded price: is the basis actually tradable?

**Status:** NEGATIVE — **closed, suspicion falsified** (CYCLE-007). Kept as a record because it was the
pre-registered blocking falsifier for L03/L11/L12 and because the mark-vs-traded spread is now a
measured quantity (it is real, and negligible).
**Opened:** CYCLE-006
**Last updated:** CYCLE-007
**Owner experiments:** `e15_traded_basis.js`; `e14_data_integrity.js` checks 8–9 (`perp_source_coverage`,
`perp_mark_spread_sane`)
**Prototypes:** — (the traded leg is a source flag: `e3_carry.js#loadCarryBook(symbols, {perp:'traded'})`)
**Result artefacts:** `results/e15_traded_basis.json`
**Fold-back rows:** — (unblocks R4 and R8)
**Falsifier (of the suspicion, not of a strategy):** if the traded-price basis reproduces the mark-price
basis, the objection is dead. **Applied and the objection is dead.**

## Claim (the suspicion, now falsified)

Every basis-marked number in the lab marked the perp leg at Binance's **mark price** — an index (median
spot across venues) plus a moving average of the basis, deliberately smoothed. Two failure modes were
possible: (1) a smoothed series is mechanically mean-reverting against the spot it derives from, so
"basis reversion" (L11) could be smoothing rather than a tradable dislocation; (2) smoothing shrinks
extremes, so the flat book's drawdown and the dispersion book's low drawdown could both be flattered.

## Evidence

`e15_traded_basis.js`, 6 510–6 558 8h periods (2020-09 → 2026-09), perp leg = the traded 8h close from
`data/perp_8h.json` (Binance `futures/um` klines; 592-file harvest, recipe in `data/README.md`):

| reading | mark leg | **traded leg** | ratio |
| --- | ---: | ---: | ---: |
| flat delta-neutral carry, Sharpe | 4.54 | **4.65** | 1.02 |
| flat carry, max drawdown | 7.96 % | **7.96 %** | 1.00 |
| dispersion book (rank), Sharpe | 5.03 | **4.98** | 0.99 |
| dispersion book, max drawdown | 2.93 % | **3.05 %** | 1.04 |
| dispersion advantage over flat (drawdown) | 5.03 pp | **4.92 pp** | 0.98 |
| basis reversion, IC median / positive | 0.430 / 8 of 8 | **0.391 / 8 of 8** | — |
| basis reversion, convergence Sharpe | 9.15 | **9.17** | 1.00 |
| basis reversion, robust design effect | 7.84 | **7.61** | — |
| vol-targeted carry (L09), Sharpe / DD | 8.05 / 1.33 % | **7.79 / 1.27 %** | 0.97 |
| inverse-vol across symbols (L09), Sharpe / DD | 10.66 / 0.69 % | **10.91 / 0.68 %** | 1.02 |

Per symbol (Sharpe, mark → traded): BTC 9.83 → 11.12, ETH 8.19 → 8.90, LINK 6.14 → 6.36, ADA 5.95 → 6.07,
DOGE 4.02 → 4.02, XRP 4.12 → 3.29, BNB 0.02 → −0.01, SOL −0.10 → −0.11.

**The mark-minus-traded spread, measured directly** (`e15.perpSpread`, at the funding grid):

| statistic | value |
| --- | --- |
| mean | ±0.003 % |
| sd | **0.017 % (BTC) … 0.047 % (SOL)** — 2–5 bps |
| p01 / p99 | ≈ −0.13 % / +0.12 % (worst case) |
| extremes | ≤ 1.8 % (XRP), occurring at dislocations |
| `acf(1)` | **+0.046 … +0.128 on every symbol** |

The positive autocorrelation is exactly the signature of a lagging/smoothed index — so the smoothing is
*real and detectable* — but at 2–5 bps it is an order of magnitude smaller than the basis it would have
to explain. The traded leg's worst basis is *smaller* than the mark's in five of eight symbols
(SOL 19.53 % → 16.85 %), so the tail is not manufactured either.

## Verdict

**NEGATIVE — the suspicion is falsified.** The mark price is a faithful proxy at the 8h horizon and the
carry complex is tradable as measured. Because this was pre-registered as the blocking falsifier for
L11/L12/R4/R8, the result *strengthens* those three rather than merely failing to weaken them. The only
residual is that the traded series ends 2026-09-01 vs the mark's 2026-09-19 (~18 periods of ~6 500).

## Next actions

* None — closed. This file is the record that the question was asked and answered.
* If a future cycle moves to an intraday (non-8h) basis horizon, re-run `e15` there: the mark-traded
  spread has `acf(1) > 0`, so its relative importance *grows* as the horizon shortens, and at e.g. 5m
  bars the smoothing could matter.

## Log

* **CYCLE-006** — opened. Rationale: the mark is a smoothed index, every carry number used it, and so
  does the repo's own P4 sleeve. Filed as the blocking falsifier for L11/L03/L12.
* **CYCLE-007** — **done and closed as a negative.** Harvested 592 `futures/um` klines files into
  `data/perp_8h.json`; generalised `loadCarryBook({perp})` and threaded it through E7/E12/E13; built
  `e15_traded_basis.js`; added two `e14` checks. Result: every headline reading reproduces on the
  traded leg (F-22), and the measured mark-vs-traded spread is 2–5 bps with a small positive
  autocorrelation. The L09 sizing results were re-measured through the shared `e11#sizingFromBook`
  path: the drawdown reduction is source-independent, only the vol-targeted level moves (8.05 → 7.79).
  R4/R8 un-gated.
