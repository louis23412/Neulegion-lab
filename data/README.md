# data/ — durable inputs the lab fetches or derives

`scratch/` is wiped between sessions; anything a future iteration needs lives here. These files are
*derived* (compact) forms of public data, plus the recipe to rebuild them.

## `taker_1h.json` — Binance spot taker-buy ratio, 1h

* **What:** per symbol, `takerBuyBaseVolume / volume` from Binance spot klines, scaled by 10000
  (integers) and indexed on the same 1h open-time grid as the repo's candles. `null` = no bar.
* **Why:** the repo's candles carry only OHLCV; this is the one free microstructure field Binance
  publishes in the kline payload and the repo discards. L07.
* **Coverage:** 2020-08-11 → 2026-08-31, 53 306 bars/symbol, aligned to the repo grid (99.99 % of the
  aligned 1h window).
* **Source:** `https://data.binance.vision/data/spot/monthly/klines/<SYM>/1h/<SYM>-1h-<YYYY-MM>.zip`
  (public dataset bucket; the REST API is geo-restricted). CSV columns:
  `open_time, open, high, low, close, volume, close_time, quote_volume, count, taker_buy_volume,
  taker_buy_quote_volume, ignore`.
* **Gotcha:** from **2025-01** the CSV `open_time` switched from milliseconds to **microseconds**
  (`normalise` by dividing until the magnitude is a plausible ms epoch).
* **Rebuild:** loop `2020-08 … 2026-08` × the 8 symbols (the current month is unpublished), unzip,
  take `volume` (col 5) and `taker_buy_volume` (col 9), normalise the time, and index into the
  repo's per-symbol candle timestamps. The lab helper to *read* the result is
  `lib/lab.js#loadTaker`.

## `taker_15m.json` — Binance spot taker-buy ratio, 15m

* Same as above at 15m. **Coverage:** 2024-06-13 → 2026-08-31, 77 735 bars/symbol (the repo's 15m
  history starts 2024-06). Source path uses `15m` in place of `1h`. Same microsecond gotcha.

## `mark_8h.json` — Binance USDT-perp **mark price**, 8h, 2020-07 → 2023-10

* **What:** per symbol, the USDT-margined perpetual **mark price** sampled on the 8h grid, as a plain
  float (`scale = 1`). `null` = no bar. Keyed by absolute time: symbol → `{t0, stepMs, nKlines, v[]}`,
  where `v[i]` is the mark at time `t0 + i*stepMs`.
* **Why:** the repo's `funding_*_8h.jsonl` files carry `markPrice = 0` for **every row before
  2023-10-31**, which confined every basis-marked carry result (F-04, F-16B, F-17) to a ~2.9-year
  crash-free window. This file restores 2020-07 onward so the carry complex can be tested through the
  2021-05 and 2022 (LUNA/FTX) dislocations.
* **The two sources are complementary, not redundant.** The lab marks `ext.get(t) ?? row.markPrice`:
  the ext file covers 2020-07-01 → 2023-11-01, the shipped funding files carry the mark from
  2023-10-31 08:00 onward. They overlap on only **2–3 periods** at the seam (2023-10-31 08:00 /
  16:00, 2023-11-01 00:00), where they agree to ≤ 4.4e-4 relative (`e14_data_integrity.js`
  `mark_source_agreement`, which now asserts this so a bad rebuild cannot pass silently).
* **Convention (matters):** `v[i]` = the **close of the 8h markPriceKline that ENDS at that grid time**.
  Binance stamps a funding row at the *end* of its interval, and the mark price at that instant is the
  close of the just-completed 8h mark kline. Concretely, a kline with `open_time = o` and `close = c`
  is stored at grid time `o + 8h`. (The first grid point therefore has no mark; that is correct — the
  mark at the very first funding time is unknowable from this source.)
* **Source:** `https://data.binance.vision/data/futures/um/monthly/markPriceKlines/<SYM>/8h/<SYM>-8h-<YYYY-MM>.zip`
  (public dataset bucket; the REST API is geo-restricted/451). CSV columns:
  `open_time, open, high, low, close, ignore` — take `close` (col 4). Note `markPriceKlines` has only
  6 columns, unlike the spot/futures `klines` payload.
* **Precision (important):** store the CSV value as a **float**. The first build stored
  `round(price*100)` as integers, which quantised DOGE to **67 distinct values** over 3 621 bars
  (≈7 % steps at $0.07) and injected ~1 % of fake per-period basis noise — that alone moved the flat
  carry book's Sharpe from 4.77 to 2.14. `e14`'s `mark_precision` check now asserts the values are not
  integer-quantised (`uniqueRatio ≥ 0.5`, `integerFraction ≤ 0.5`).
* **Rebuild:** loop `2020-07 … 2023-10` × the 8 symbols (SOLUSDT 8h marks do not exist before
  2020-09-13; the 2020-07/08 SOL files 404, which is expected), unzip, parse `close`, and offset each
  kline by `+8h` into the grid. The lab helper to *read* the result is `lib/lab.js#loadMarkPrices`.

## `perp_8h.json` — Binance USDT-perp **traded** close (klines), 8h, 2020-07 → 2026-09

* **What:** per symbol, the USDT-margined perpetual **traded** 8h close on the funding grid, as a plain
  float. Exactly the same on-disk shape as `mark_8h.json`: symbol → `{t0, stepMs, nKlines, v[]}`, with
  `v[i]` the traded close of the 8h kline that **ends** at `t0 + i*stepMs`. So `loadMarkPrices(path)` is
  also the reader for this file — it is a generic "8h grid price" loader.
* **Why:** the entire carry complex (F-04/F-10/F-16/F-17/F-21) marks the perp leg at Binance's *mark
  price* — a smoothed index, not a tradable price. `perp_8h.json` is the **traded** leg, the input to
  the L14 falsifier (F-22, CYCLE-007): re-measure every carry number against a price you could actually
  have traded. It also removes F-11's "you cannot trade the mark" reservation from R4/R8/R11.
* **Coverage:** 2020-07-01 → **2026-09-01** (74 monthly files / symbol; SOLUSDT starts 2020-09-14 —
  the 2020-07/08 SOL files 404, expected). Note this ends ~18 days before `mark_8h.json`/the funding
  files, so the traded-leg window is 6510 pooled periods vs the mark leg's 6558 — immaterial to every
  published ratio, but do not assume the two legs cover identical dates.
* **Convention (same as mark_8h.json, and it matters):** store the kline `close` at grid time
  `open_time + 8h`. A funding row is stamped at the *end* of its interval and the price at that instant
  is the close of the just-completed kline.
* **Source:** `https://data.binance.vision/data/futures/um/monthly/klines/<SYM>/8h/<SYM>-8h-<YYYY-MM>.zip`
  (public dataset bucket; the REST API is geo-restricted/451). These are the **futures** kline files —
  the 8h spot bucket does not exist, and don't confuse them with `markPriceKlines`, which has 6 columns
  instead of 12.
* **CSV:** 12 columns, `open_time, open, high, low, close, volume, close_time, ...` — take `close`
  (col 4). Same **microsecond-timestamp** gotcha as the taker files from **2025-01**.
* **Rebuild:** loop `2020-07 … 2026-08` × the 8 symbols (the current month is unpublished), unzip, parse
  `close` (col 4), normalise the timestamp, and offset each kline by `+8h` into the grid. Reader:
  `lib/lab.js#loadMarkPrices('src/NeuLegion-lab/data/perp_8h.json')`.

## `perp_flow_8h.json` — Binance USDT-perp **quote volume / trade count**, 8h, 2020-07 → 2026-08

* **What:** per symbol, the USDT-margined perpetual 8h kline `volume` (base), `quote_volume` (USDT) and
  `count` (trades), on the same 8h grid as the price files. Shape: symbol → `{t0, stepMs, nKlines, vol,
  qv, cnt}`, where `flow[i]` is the flow of the 8h perp kline **ENDING** at `t0 + i*stepMs`.
* **Grid convention (differs from the price files, deliberately):** `t0` is the first available grid time
  (= the first kline's open **+ 8h**), so there is **no leading null** and a funding time `T` looks up at
  index `(T − t0)/stepMs` directly (`lib/lab.js#flowIndexAt`). The price files instead start at the first
  kline's *open* time with `v[0] = null`.
* **Why:** the repo keeps only OHLCV+funding; quote volume is the free field that prices **impact**. L15 /
  F-26 uses it for a per-symbol ADV and a square-root impact curve — the capacity of the carry complex.
* **Coverage:** 2020-07-01 → 2026-08-31 (74 monthly files / symbol; SOLUSDT starts 2020-09-14 — its
  2020-07/08 files 404, expected). DOGE starts 2020-07-10. ~6750 bars/symbol; 1.46 MB total.
* **Source:** `https://data.binance.vision/data/futures/um/monthly/klines/<SYM>/8h/<SYM>-8h-<YYYY-MM>.zip`
  (same files as `perp_8h.json`, parsed for different columns). CSV cols: base volume **5**, quote volume
  **7**, count **8**. Same **microsecond-timestamp** gotcha from 2025-01.
* **Consistency (asserted in `e14#perp_flow_integrity`):** the grid matches the traded perp close grid
  (`t0` = the first non-null traded close time), and `qv ≈ close·vol` (median ratio **1.000**).
* **Rebuild:** `data/harvest_perp_flow.js` (`harvestPerpFlow()`) — a durable module run from `execute_js`;
  fetches directly (the bucket sends `Access-Control-Allow-Origin: *`), unzips with `@zip.js/zip.js`.
  Reader: `lib/lab.js#loadPerpFlow`.

## `open_interest_8h.json` — Binance USDT-perp **open interest / toptrader ratio**, 8h, 2020-09 → 2026-08

* **What:** per symbol, Binance's `futures/um` daily **metrics** (5-minute rows) aggregated to the 8h
  funding grid by **mean**: `sum_open_interest` (contracts), `sum_open_interest_value` (USDT notional)
  and **`sum_toptrader_long_short_ratio`** (the *position*-weighted top-trader long/short ratio, not the
  account count). Shape: symbol → `{t0, stepMs, nKlines, oi, oiVal, topLS, takerLS}` on the **same
  absolute grid as `perp_flow_8h.json`** (`t0` = first window end, no leading null). Zero-valued source
  rows are `null` (a missing row must not read as "OI = 0"; `e14#oi_missing_is_null` asserts this).
* **Precision note:** the values are the instantaneous metrics **snapshot at the grid time T** (a 5-min
  row), not a mean over the 8h window; `flowIndexAt(file, T)` returns the slot ending at T, i.e. the
  snapshot at T, and a book trading the return T→T+8h is causal.
* **Why:** L07 probe 2 / F-28 & F-29. The repo keeps only OHLCV + funding; open interest is the free
  *positioning* field. Three uses: (a) the OI *change* tested as a directional signal — **negative**
  (Δlog(OI) next-8h IC 0.020); (b) OI used to price the **flat carry book's size** — the physical limit
  F-26 could not measure (the holding as a fraction of the market); (c) the **toptrader ratio used
  cross-sectionally** is a modest contrarian signal (F-29, lead L18) — invisible in levels, visible only
  after demeaning across the basket.
* **Coverage:** BTCUSDT from 2020-09, the other seven from **2021-12** (earlier daily metrics files
  404). ~42 700 symbol-periods pooled. The signal tests use the **common** window; the capacity test
  uses each symbol's own OI history.
* **Source:** `https://data.binance.vision/data/futures/um/daily/metrics/<SYM>/<SYM>-metrics-<YYYY-MM-DD>.zip`
  — one **daily** zip, CSV columns `create_time, symbol, sum_open_interest, sum_open_interest_value,
  count_toptrader_long_short_ratio, sum_toptrader_long_short_ratio, count_long_short_ratio,
  sum_taker_long_short_vol_ratio`. Take cols 2 (`sum_open_interest`), 3 (`sum_open_interest_value`) and
  5 (toptrader account ratio). No microsecond gotcha (this bucket's times are ISO strings).
* **Consistency (asserted in `e14#oi_integrity`):** the grid matches `perp_flow_8h.json`, the coverage
  is non-trivial, `oiVal ≈ oi·close` and `topLS ∈ [0, 1]`. If it goes red, every `e21` number is void.
* **Rebuild:** `data/harvest_open_interest.js` (`harvestOpenInterest()`) — a durable module run from
  `execute_js`; fetches the daily zips directly and aggregate to the 8h grid. Reader:
  `lib/lab.js#loadOpenInterest`.

## How the two legs are joined (`lib/lab.js`, `e3_carry.js`)

Three alignment rules protect every basis-marked number. They are not stylistic — each one fixes a
measured bug (L10-l…L10-o, asserted by `e14_data_integrity.js`):

1. **Spot lookups must be exact.** `loadCloseLookup(...).exact(t)` returns the close of a bar that
   *ends exactly at* `t`, else null. The plain lookup silently bridges missing bars (the alt 1h files
   have a few dozen gaps), stretching an 8h return into 9h/10h and mispairing it with the 8h mark leg.
2. **Never trust the spot lookup past the candle history.** `loadCloseLookup(...).lastClose` is the
   time the last bar closes; beyond it the lookup carry-forwards a frozen price, so spot stops moving
   while the mark keeps moving — the candles end **2026-09-19** but the funding files run to
   **2026-09-24**, which manufactured ±5 %/8h "basis" moves at the tail. `loadCarryBook` skips
   `t > lastClose` and counts it (`tailSkipped`).
3. **Funding rows are aggregated into 8h buckets by SUM.** Binance normally charges funding on the 8h
   grid, but switched **SOLUSDT to 2h/4h funding from 2022-11-09 to 2022-11-18** — straight through the
   FTX crash. A funding row is stamped at the interval end, so a 10:00 row belongs to the window
   closing at 16:00. Taking the last row per grid point (a plain `Map.set(roundGrid(t), rate)`) discards
   three of every four of those payments; `loadFundingBuckets` sums them (`e14`'s `funding_buckets`
   check asserts ≤ 4 rows/bucket and that only SOLUSDT has multi-row buckets).

## Readers

* `lib/lab.js#loadTaker(path)` → `{ symbol: Map<openTimeMs, ratio> }`;
  `lib/lab.js#attachFlow(panel, symbols, taker)` adds `series.flow = 2*ratio − 1` and the
  cross-section (`panel.flowByStream`).
* `lib/lab.js#loadMarkPrices(path)` → `{ symbol: Map<openTimeMs, price> }`. Despite the name it loads
  any 8h grid-price file: `loadMarkPrices()` (default) = the **mark** leg, and
  `loadMarkPrices('src/NeuLegion-lab/data/perp_8h.json')` = the **traded** leg (F-22).
* `lib/lab.js#loadPerpFlow(path)` → `{ symbol: { t0, stepMs, nKlines, vol, qv, cnt } }` (raw arrays, no
  leading null); `flowIndexAt(symFlow, t)` → the 8h slot ending at `t`, or -1. Used by `e19` (impact).
* `lib/lab.js#loadOpenInterest(path)` → `{ symbol: { t0, stepMs, nKlines, oi, oiVal, topLS, takerLS } }`
  (same absolute grid, no leading null); `flowIndexAt` is also the reader for it. Used by `e21` (F-28
  sizing; F-29 the `topLS` cross-sectional fade).
* `e3_carry.js#loadFundingBuckets(symbol)` → `[{t, fundingSum, markPrice, n, intervalHours}]`.
* `e3_carry.js#loadCarryBook(symbols, { perp: 'mark' | 'traded' })` → the single carry book: per symbol
  `{rets, basis, basisLevel, f, spot, times, tailSkipped, raggedSkipped, noMark, sub8hBuckets}` plus
  the end-aligned equal-weight `pooled`. **Everything that needs a carry P&L reads this** (E7, E11,
  E12, E13, E15) so there is exactly one definition of the sleeve — and `perp` is the only switch that
  changes the perp leg, so the mark-vs-traded comparison (E15) shares the whole code path.

## Conventions

* Keep only the *derived* series here, not the raw zips (the zips are reproducible from the URL
  patterns above; the derived series is what the lab actually reads).
* Every data file states its provenance, coverage, units/gotchas and the rebuild recipe — a future
  iteration must be able to regenerate it without re-deriving the method.
* Every join between two data files gets a **regression test** in `experiments/e14_data_integrity.js`.
  The bugs in this directory were all join bugs, and they were all silent.
