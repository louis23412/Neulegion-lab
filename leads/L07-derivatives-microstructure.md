# L07 — New data: open interest / liquidations / taker imbalance

**Status:** PARTIALLY CLOSED — taker flow direction NEGATIVE (F-15) and the toptrader ratio's *level* has no
time-series IC; open interest POSITIVE as a **sizing tool** (it prices the flat book, and CYCLE-024
restated the bounds as distributions — F-41); the toptrader ratio is POSITIVE **cross-sectionally**
(F-29, spun out as L18). **The OI-*change* signal half is RE-OPENED** as **L19**: F-28's blanket
"directionless" verdict was read off the *daily* book, and the CYCLE-028 EWMA treatment (F-45) clears a
4 bps fee (break-even 8.9–14.7 bps, net@4 +0.5…+0.7) — weak, churny and recent-regime, but not closed.
**Untestable in-house:** the liquidation prints (no public history — see Probe 3).
**Opened:** CYCLE-000 (identified), CYCLE-001 (registered)
**Last updated:** CYCLE-028
**Owner experiments:** `e9_flow.js` (probe 1), `e21_open_interest.js` (probe 2), `e37_oi_signal_rescue.js` (probe 2e)
**Prototypes:** `prototypes/taker.js`
**Result artefacts:** `results/e9_flow_1h.json`, `results/e9_flow_15m.json`, `results/e21_open_interest.json`, `results/e37_oi_signal_rescue.json`
**Data:** `data/taker_1h.json`, `data/taker_15m.json`, `data/open_interest_8h.json` (provenance + rebuild
in `data/README.md`)
**Fold-back rows:** R7
**Falsifier:** a new stream with |corr| < 0.2 to the price basket and a positive full-history Sharpe
with block-stability ≥ 4/6. (Probe 1 met the correlation half, failed the Sharpe half; probe 2 failed
both the correlation *and* the Sharpe half.)

## Claim

Every rule computable from OHLCV + funding on 8 majors has now been measured here and reads ≈0
(L04). The mechanisms that remain, in order of mechanism strength, are **not in the current data**:
open interest + liquidation prints (cascade microstructure — the most robust cross-sectional crypto
phenomenon), and **taker buy/sell volume** (order-flow imbalance), which Binance publishes *per kline*
— a zero-cost addition the repo's fetcher currently discards.

## Why we care

The constraint on this data is one factor (L02) and no directional edge (L04). New *data* is the only
route to a genuinely new edge (E-C); a new asset class is the only route to effective streams > 2 that
does not require a signal to work.

## Evidence

* Audited the repo's stored candles: only `timestamp, open, high, low, close, volume` — Binance's
  `takerBuyBaseVolume` is discarded (L10-g). The fetchers to extend are `src/candle_fetcher.js`,
  `src/funding_fetcher.js`, `src/candles_audit.js` (R7).
* **Probe 1 — taker order flow (done, CYCLE-003).** Harvested `takerBuyBaseVolume/volume` for all 8
  majors from `data.binance.vision` (1h 2020-08 → 2026-08, 53 306 bars; 15m 2024-06 → 2026-08,
  77 735 bars), stored in `data/`, and tested it through the repo's pipeline (`e9_flow.js`, F-15):

  | | 1h | 15m |
  | --- | ---: | ---: |
  | best flow arm Sharpe | +0.028 (`flow-gate-mom16`) | +0.020 (`flow-diverge-8`) |
  | best break-even | 0.31 bps | 0.08 bps |
  | IC(feature, next return) | ≤ 0.010 | ≤ 0.017 (signed) |
  | **cross-asset flow corr** | **0.020** (vs 0.623 returns) | 0.221 (vs 0.732) |
  | corr of arms with price | ≤ 0.09 | ≤ 0.14 |

  **F-15: independent, but directionless.** Order flow passes the *independence* half of this lead's
  falsifier and fails the *edge* half at both bar sizes; it also fails to improve momentum
  (`flow-gate-mom16` +0.028 vs `mom-16` +0.102 at 1h).
* **Probe 2 — open interest (done, CYCLE-013).** Harvested Binance `futures/um` daily `metrics` (5-min
  rows: open interest contracts + USDT notional, toptrader long/short ratio), aggregated to the 8h
  funding grid into `data/open_interest_8h.json` (BTCUSDT from 2020-09, the other seven from 2021-12,
  ~42 700 symbol-periods), and tested OI *change* as a directional signal (`e21_open_interest.js`, F-28):

  | signal | pooled next-8h IC | best causal dollar-neutral book |
  | --- | ---: | ---: |
  | Δlog(OI notional) → next spot return | **0.020** | gross Sharpe 0.96 but 1501×/yr turnover → net@4 −1.07 |
  | Δlog(OI notional) → next funding rate | 0.027 | — |
  | toptrader long/short ratio → next spot return (**level IC**) | ≤ 0.02 | **cross-sectional fade: Sharpe 1.06, net@4 +0.77 — F-29** |
  | Δlog(OI) → **contemporaneous** return | **0.595** | *the look-ahead trap* — see below |

  **F-28: ΔOI has no signal; the toptrader ratio has one only cross-sectionally.** Per-symbol next-8h
  OI IC is 0.00–0.06; the OI-change book clears no fee. So the OI *change* is **independent but
  directionless**. But the toptrader ratio's *level* carries no time-series IC (≤0.02) while its
  **cross-sectional** demeaned form does: fading it scores gross Sharpe **1.055**, net@4 **+0.77**,
  positive in 4/4 quartiles and 5/6 years (F-29, opened as **L18**). A one-index slip (contemporaneous
  leg) manufactures IC 0.60 / Sharpe 17, because OI *notional* embeds its own window's price move —
  `e21` hit exactly that trap and its artefact now carries the lag profile that exposes it (F-11 class;
  L10). A second silent bug is also fixed: missing fields were zeroed *then* demeaned, giving absent
  symbols a large weight (L10-r).
* **Probe 2b — open interest as a *sizing* tool (done, CYCLE-013).** A held position is limited by the
  fraction of the market it *is*, not only by the cost of trading it. The flat carry book holds `G/k`
  short perp per symbol; OI prices that: `G/k` reaches 1 % / 5 % / 10 % of the thinnest symbol's mean
  OI at `G =` **$6.9 M / $34.3 M / $68.6 M** (thinnest = LINK, $86 M; historical-min variant
  $2.3 M/$11.5 M/$23.0 M). The F-24 dispersion book: $4.7 M/$23.4 M/$46.8 M. This is the number F-26
  flagged as unmeasured — and it is **orders of magnitude below the flat book's $50 B impact capacity**.
* **Probe 2c — the sizing tool restated as a distribution (done, CYCLE-024, F-41).** Probe 2b (and e30/e32)
  computed the bound as `f·mean(OI)/mean|w|` — a **ratio of means**, i.e. an *average-case* bound. The desk's
  constraint is per-period and per-symbol, whose worst case is a **min of ratios**. Measured that way
  (`e33_oi_capacity_distribution.js`): the working sleeves' true 5 %-of-OI bounds are **2.6–8.8×** below the
  published numbers — dispersion spec **$23.41 M → $4.37 M**, fade **$36.99 M → $4.19 M**, fade+cap
  **$53.84 M → $12.62 M** — the binding symbol is **LINK**, the binding moments are the dislocations
  (2022-05 LUNA, 2023-06/07) *and 2026-03/07*, and at the published sizes the books are over the 5 % cap in
  **65–77 %** of periods (peak **16–44 %** of LINK's OI). Restated usable sizes (recent-24 m p5) are
  **$10.2–21.9 M**. The F-27/F-40 cap is the fix (it triples the never-breach bound).
* **Probe 2d — the sizing bound is a policy, not a number (done, CYCLE-025, F-42).** `e34_oi_scaled_sizing.js`
  measures the dollar PnL of seven causal sizing policies on the working sleeves. A **constant** size picked
  from the trailing-2y p5 still breaches the 5 % cap in **2.7–3.7 %** of periods (peak 6–10 % of OI), and a
  **lagged (EWMA)** size breaches **53–55 %** — so the bound is a **hard clip**, never a smoothed target.
  Following OI exactly (constant participation) is compliant and raises the mean deployable size **2.0–4.1×**
  ($11.2→$22.9 M on the dispersion spec; $10.9→$33.6 M on the fade) but *lowers* the dollar Sharpe
  (5.02→3.26; 1.21→0.77, fade DD 22.8→58.2 %). The compliant low-cost recipe: target the **trailing median**
  and clip → $16.9 M / $19.3 M at zero breach (Sharpe 4.41 / 0.96). Also fixed a measurement bug
  (**L10-x**): a min-of-ratio over a *partial* symbol set read a $936 B capacity at 2021-11-04.
* **Probe 3 — liquidation prints: NOT TESTABLE (CYCLE-024).** The dataset is gone. `data.binance.vision`
  no longer publishes `liquidationSnapshot` — the S3 listing for `data/futures/um/daily/` and
  `.../monthly/` returns only `aggTrades, bookDepth, bookTicker, indexPriceKlines, klines,
  markPriceKlines, metrics, premiumIndexKlines, trades` (+ `fundingRate` monthly); `.../daily/
  liquidationSnapshot/` returns an **empty** listing. The exchange APIs are realtime-only: OKX
  `GET /api/v5/public/liquidation-orders` responds 200 but with only the last few days of fills, and the
  Binance `!forceOrder@arr` stream has no history. A 6-year liquidation test is therefore **not
  reconstructible** from free sources; the remaining half of L07 is closed as *data-blocked*, not
  measured-negative.

## Verdict

**PARTIALLY CLOSED — measured, not hypothesised.** The *directional* half of this lead is (mostly) a
negative: taker imbalance (F-15) and the toptrader ratio's *level* read ≈0, and the open-interest *change*
read ≈0 **on its daily book** (F-28). **But CYCLE-028 re-opened the ΔOI half (F-45):** the daily verdict
was the F-23 implementation artefact again, and EWMA-smoothed the OI book clears a 4 bps fee (break-even
8.9–14.7 bps) — weak, churny and recent-regime, so *not port-ready*, but no longer "directionless" (→ L19).
**And the positioning fields are not otherwise empty** — the toptrader ratio used **cross-sectionally** is a
modest, independent contrarian signal (F-29), spun out as its own lead **L18**. The *sizing* half is a
genuine positive: OI is the physical limit on the carry holds, and it puts the whole complex at tens of
millions — restated in CYCLE-024 (F-41) from an average-case ratio-of-means to the true min-of-ratio
distribution, which lowers the working sleeves' 5 %-of-OI bounds by **2.6–8.8×** and shows they breach the
cap in a majority of periods. The one field that remains untested is the **liquidation prints**, and
CYCLE-024 established that they are **not obtainable**: Binance removed `liquidationSnapshot` from the
public bucket and the exchange APIs are realtime-only. L07 therefore closes with its last half
*data-blocked* rather than measured, while its OI-signal half lives on as **L19**.

## Next actions

1. ~~Probe 2 (OI).~~ **DONE (CYCLE-013, F-28/F-29); OI-change half RE-OPENED (CYCLE-028, F-45 → L19).**
   ΔOI signal negative *on the daily book*; OI sizing positive; the toptrader ratio cross-sectionally
   positive (→ L18). **Restated as a distribution (CYCLE-024, F-41).** The directional ΔOI claim is live
   again as **L19** (EWMA-smoothed book clears a taker fee but is weak/churny) — see `leads/L19-oi-change-signal.md`.
2. **Probe 3 — liquidation prints: CLOSED AS DATA-BLOCKED (CYCLE-024).** Binance's
   `futures/um/{daily,monthly}/liquidationSnapshot` no longer exists in `data.binance.vision` (S3 listing
   returns an empty prefix), and OKX/Binance APIs return only recent fills — no 6-year history is
   reconstructible from free sources. Reopen only if a durable archived dataset appears; otherwise L07's
   signal half stays closed NEGATIVE and its sizing half SUPPORTED (as restated).

## Log

* **CYCLE-000** — identified as E-C / R7; data fields audited (absent).
* **CYCLE-001** — registered as a lead with a falsifier and a staged plan.
* **CYCLE-003** — **probe 1 done**: harvested taker flow (1h + 15m) into `data/`, built `e9_flow.js`
  and `prototypes/taker.js`, measured NEGATIVE for edge but independent (F-15). Lead stays open for
  the positioning mechanisms (OI/liquidations).
* **CYCLE-013** — **probe 2 done**: harvested open interest into `data/`, built `e21_open_interest.js`,
  measured NEGATIVE for the ΔOI signal (pooled next-8h IC 0.020; causal book clears no fee) but POSITIVE
  as a sizing tool — OI caps the flat hold at tens of millions, so the whole carry complex is ~$5–70 M
  (F-28). Also found the toptrader *ratio* used cross-sectionally is a modest contrarian signal
  (F-29 → L18), and fixed two silent bugs (an F-11-class book-index look-ahead and a missing-data-zeroing
  bug; L10-q/L10-r). L07's signal half is closed; only the liquidation-print half remains.
* **CYCLE-024** — **probe 2c + probe-3 data audit**: restated the OI sizing bounds from a ratio-of-means to
  the true min-of-ratio distribution (F-41, `e33_oi_capacity_distribution.js`) — the working sleeves' 5 %-of-OI
  bounds fall **2.6–8.8×** and the published sizes breach the cap in 52–77 % of periods; and established that
  the **liquidation prints are gone** from the free public record (empty `liquidationSnapshot` prefix in
  `data.binance.vision`; OKX/Binance APIs realtime-only), so the remaining half of L07 is **closed as
  data-blocked**. New bug register entry **L10-w** (ratio-of-means ≠ min-of-ratio).
* **CYCLE-028** — **probe 2e (OI-change signal re-opened)**: F-28's "ΔOI has no signal" was read off the
  *daily* cross-sectional book (1501×/yr, break-even 1.89 bps) — the same implementation artefact the lab
  already corrected once for the funding book (F-23→F-24). Re-running the exact e21 book builder
  (`e21#xsBookImpl`, extracted this cycle and verified byte-identical) under an EWMA weight policy
  (`e37_oi_signal_rescue.js`) lifts the break-even to **8.9–14.7 bps** and clears a 4 bps fee for 3 of 6
  λ (**F-45**): λ=0.25 → break-even 8.93 bps, net@4 **+0.65**; λ=0.1 → 14.73 bps, **+0.52**. But the
  signal is **weak** (338×/yr at λ=0.25, net halves 0.07/1.47, net-by-year 2023 **−0.86** vs 2026 +2.30),
  the F-37 walk-forward λ-selection **underperforms** pinning (OOS +0.44 vs λ=0.25 +0.76), and it is
  independent of carry (corr **0.007**) with the sign control losing (net@4 −3.00). Verdict: F-28's
  blanket negative is **too strong** — the correct statement is "weak, churny, recent-regime". The
  directional half of L07 is therefore **re-opened as L19**, and the "no new-data signal left" line is
  retracted. Sizing half (F-41/F-42) and liquidation half (data-blocked) untouched.
