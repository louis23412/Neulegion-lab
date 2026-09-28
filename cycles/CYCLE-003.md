# CYCLE-003 — Open the frontier: order flow (L07 probe 1)

**Date:** 2026-09-18
**Goal:** start the open frontier with L07's cheapest data source — Binance taker buy/sell volume, the
one free microstructure field the repo's fetcher discards — and test it honestly at both bar sizes.

## Work

1. **Harvested the missing field.** The Binance REST API is geo-restricted here (451), but the public
   dataset bucket works: `data.binance.vision` spot monthly klines, whose CSV includes
   `taker_buy_base_volume`. Fetched **567** 1h files (2020-08 → 2026-08, 20 MB) and **216** 15m files
   (2024-06 → 2026-08, 29 MB) for the 8 majors through the proxy, and parsed them onto the repo's
   exact candle grid. Two format gotchas were found and handled: (i) the current month is unpublished
   (404s), and (ii) **from 2025-01 the CSV `open_time` is in microseconds** — the whole 2025+ range
   silently matched nothing until this was fixed.
2. **Stored the derived series durably** (not the zips) in the lab:
   `data/taker_1h.json` (53 306 bars/symbol) and `data/taker_15m.json` (77 735 bars/symbol), with
   provenance, coverage, units and the rebuild recipe in `data/README.md`.
3. **Built the code.** `lib/lab.js#loadTaker` / `#attachFlow` (signed imbalance `2·buy/vol − 1` plus
   the cross-section `panel.flowByStream`), `prototypes/taker.js` (8 causal features), and
   `experiments/e9_flow.js` (univariate IC, pipeline arms with stability/break-even/dependence, and
   F-11 controls in the same run). Registered in `run_all.js`.

## Result — F-15

NEGATIVE for edge at both bar sizes, but **independent**:

| | 1h | 15m |
| --- | ---: | ---: |
| best flow arm Sharpe | +0.028 | +0.020 |
| best break-even | 0.31 bps | 0.08 bps |
| IC(feature, next return) | ≤ 0.010 | ≤ 0.017 (signed) |
| **cross-asset flow correlation** | **0.020** (returns: 0.623) | 0.221 (returns: 0.732) |
| arm correlation with price basket | ≤ 0.09 | ≤ 0.14 |
| controls | oracle +12.26, random ≈ 0 | oracle +13.18, random ≈ 0 |

Flow also fails to improve momentum: `flow-gate-mom16` +0.028 vs `mom-16` +0.102 (1h). Boundary
recorded: the taker ratio is an aggregate over the bar, so the sub-minute order-flow information that
*is* predictive is already destroyed, and this bar model could not trade it anyway (F-15).

## Ledger effects

* New finding **F-15** (NEGATIVE — first L07 probe); summary table updated.
* `FOLD-BACK.md` **R7** — status: the taker half is measured negative (do not port the field as a
  signal); the open-interest/liquidation half remains the higher-prior test.
* **L07** updated: probe 1 done (data, prototype, experiment, numbers), probe 2 (OI/liquidations)
  next; status *open — mechanism-specific*.
* New durable assets: `data/taker_1h.json`, `data/taker_15m.json`, `data/README.md`.
* New code: `prototypes/taker.js`, `experiments/e9_flow.js`, `lib/lab.js#loadTaker/#attachFlow`.

## What is now false that was believed at the start of the cycle

* "Order flow is the missing input that could carry a directional edge." → **false** at 1h and 15m in
  a bar model (F-15); the missing input space narrows to *positioning* (open interest, liquidations).
* "The 8 majors' order flow is as correlated as their returns." → **false**; flow correlation is 0.020
  at 1h, i.e. flow is close to idiosyncratic — independent, just not informative.

## Next

* **CYCLE-004** — L07 probe 2: open interest / long-short positioning from the `futures/um` daily
  `metrics` dataset, aligned to the grid; test the OI×price taxonomy, OI as a sizing input (L09), and
  post-cascade reversion (L08). If it also reads ≈0, L07 closes with a measured negative.
* Or, in parallel: **L09** (vol predictability / sizing) and **L12** (cross-sectional carry), which
  need no new data and are the other two leads with a live mechanism.
