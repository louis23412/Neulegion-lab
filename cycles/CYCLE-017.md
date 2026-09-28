# CYCLE-017 — Execution realism: can a passive fill rescue the short-horizon family? (L08)

**Date:** 2026-10-08
**Goal:** L08 is the last open route to the reversal family. CYCLE-016 (F-32) closed L13 with a
break-even of 0.32–1.31 bps of turnover — dead against the 5–10 bps taker — and showed smoothing cannot
lift it. Its falsifier said the lead closes "with the cost verdict intact" if a maker model that never
assumes an impossible fill still leaves the family below a realistic net. This cycle builds that model,
measures the part of the maker question the bar data can actually answer, and states plainly the part it
cannot.

## Work

1. **`lib/lab.js` now carries `high`/`low`** through `loadSeries` → `alignPanel` → `tail` (the stored
   klines do have the bar range; L10-g). Nothing older than `e25` reads them, so every existing artefact
   is unaffected — verified below. A `low ≤ close ≤ high` invariant was folded into `e14#candle_grid`.
2. **`experiments/e25_maker_fill.js`** (new, registered in `run_all` as `e25_maker_fill_1h`/`_15m`):
   * **0 — spread estimators** (Corwin-Schultz, Roll) reported as the unusable upper bounds they are;
   * **1 — quote-depth / fill-selection study**: passive quote at the signal close offset by `depth`,
     filled if the next bar reaches it, with the forward return measured both from the reference close
     (pure selection) and from the actual fill price (selection + depth benefit);
   * **2 — the reversal book replayed under four execution models** (`taker`, `maker@depth`,
     `oracle` = filled at the bar extreme, an unachievable ceiling), each audited by `e16#audit`.
3. **Controls.** The `taker` model is a validation guard — it must reproduce E24's `rank_w1_rev`
   (gross Sharpe 0.4147 vs 0.4143, break-even 0.709 vs 0.709 at 1h; 0.5344 vs 0.5343, 0.324 vs 0.323 at
   15m). It earned its keep: the first draft used `close.length` (symbols) where it needed the bar count,
   so the "book" was 5 periods long and read a fabricated −2.5 Sharpe. The fill-selection measurement
   also carries a **momentum-side** and a **seeded-random-side** control.

## Results

**(0) The classic spread estimators are unusable.** Corwin-Schultz reads **33.4 bps (1h) / 13.3 (15m)**
and Roll **23.3 / 9.2** — a real perp spread is ~1 bp. They are volatility-contaminated by 10–30× and
cannot resolve a 0.3–1.0 bps break-even. Recorded so nobody reaches for them again.

**(1) A passive fill's cost is fill-selection, and it is ~1× the entire edge.** Per-symbol reversal
signal, forward horizon h = 1; `selectionBps` is measured from the reference close, `netVsTakerBps` from
the actual fill price (so it includes the depth benefit):

| depth (bps inside) | 1h fill rate | 1h selection | 1h **net vs taking** | 15m fill rate | 15m **net vs taking** |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 0.994 | −0.61 | **−0.61** | 0.988 | **−0.48** |
| 1 | 0.965 | −2.59 | **−1.59** | 0.915 | **−1.61** |
| 5 | 0.908 | −6.22 | **−1.22** | 0.793 | **−1.23** |
| 10 | 0.834 | −11.02 | **−1.02** | 0.647 | **−1.15** |
| 20 | 0.699 | −20.68 | **−0.67** | 0.430 | **−1.00** |

The economic reading is exact: `netVsTaker = selection + depth`, and `selection ≈ −(0.6 + depth)`, so
**the terms cancel and the net stays ≈ −0.6…−1.6 bps at every depth** — a passive execution costs about
the same whatever price you quote, because a deeper quote selects correspondingly worse fills. At depth 0
the fill rate is ~99 %, so the effect is not "often missed": it is that the **~1 % of bars that never
reach the quote are the large up-gaps**, and the maker forfeits ~0.6 bps per fill by not being in them.

**The controls prove it is execution, not the signal.** The mirror (momentum) side and a *seeded random*
side give the same numbers — random-side net vs taking **−0.65 bps (1h) / −0.47 (15m)**, statistically
identical to the reversal side's −0.61/−0.48 — while `meanAll` for the random side is ≈0 as it must be.
So the friction is a property of passively joining any flow in this market, not of the reversal signal.

**(2) Replayed on the book, the maker model removes the entire gross edge.**

| book | 1h gross Sharpe | 1h break-even | 1h net@1bps | 15m gross Sharpe | 15m break-even | 15m net@1bps |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `taker` | +0.415 | **+0.709 bps** | −0.17 | +0.534 | **+0.324 bps** | −1.12 |
| `maker_d0` (fill at the quote) | **−0.002** | **−0.003 bps** | −0.57 | **−0.271** | **−0.173 bps** | −1.84 |
| `maker_d5bp` | −0.354 | −0.778 | −0.81 | −0.769 | −0.847 | −1.69 |
| `maker_d20bp` | +0.004 | +0.013 | −0.28 | −0.071 | −0.194 | −0.44 |
| `oracle` (fill at the bar extreme) | +16.87 | +67.9 | +16.64 | +18.85 | +26.6 | +18.21 |

The conservative maker (quotes at the signal close, filled only if the next bar reaches it, no spread
credited) has **essentially zero gross edge at 1h (−0.002)** and a **negative gross edge at 15m
(−0.271)** — versus +0.415 / +0.534 for the taker. The execution model alone consumes the whole edge,
before any fee. The `oracle` row shows the opposite extreme is hugely profitable, which is why the bar
model cannot settle fill *quality*: a real queue-aware maker lies somewhere between "touch" and "the bar
extreme", and only L2/queue data locates it.

## What is now false that used to be believed

* **"A maker model is the last route to the reversal family."** Measured, it is not a route: the
  fill-selection friction of passively joining (≈0.6–1.6 bps per fill) is **larger than the entire
  reversal edge (0.3–0.7 bps)**, and it is identical for a random side, so it is an execution cost and
  not signal decay. The L08 falsifier is met — the cost verdict stands.
* **"The fill rate is the thing to worry about."** It is ~99 % at the market. What costs the money is
  *which* 1 % you miss.
* **"OHLCV spread estimators can price the maker's spread capture."** They read 23–33 bps on bars whose
  real spread is ~1 bp — a 20× error — and cannot be used. The only bar-level friction estimate that
  behaves is the fill-selection number, and it is ~1.2 bps.

## Ledger effects

* New **F-34**; new experiment `e25_maker_fill.js`, new artefacts `results/e25_maker_fill_{1h,15m}.json`.
* **L08 → NEGATIVE (closed)**, with a documented **data requirement** (L2/queue) for the residual
  fill-quality question. **L13/F-32** unaffected: its closure now holds under the maker model too.
* `e14#candle_grid` extended with the OHLC range invariant (still 13 checks). `RUNNER.md` records the
  fill-model convention. No refactor touched a shipped number.

## Next

* The reversal/cost line is now closed in both directions (taker: F-32; maker: F-34). Remaining open
  leads: **L06 (meta-labelling)**, the F-24 carry decay (2025–26), the L18 post-2024 decay check, and
  L07's untested liquidation-print half.
* The maker measurement suggests a re-usable primitive: `e25#fillSelection` prices the *execution*
  friction of any signal at ~1 bps per fill — worth applying to the toptrader fade's 23×/yr turnover
  book if a maker construction is ever considered there.

## Run

Full `run_all` regenerate (32 steps: the 30 prior + `e25_maker_fill_1h` + `_15m`; `e25` adds ~25 s).
Controls `e0c`, `e5` (1h/15m), the 13-check `e14` and `e25`'s own validation guard all report `pass`.
