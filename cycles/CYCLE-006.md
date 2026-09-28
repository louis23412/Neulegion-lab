# CYCLE-006 — Extend the carry window through the crashes, and audit the marks

**Date:** 2026-09-26
**Goal:** make the carry complex trustworthy. CYCLE-005 ended with a hard bound on the whole carry
programme: every basis-marked result (F-04, F-16B, F-17, F-10) lived in a **2.9-year, crash-free**
window because the repo's `funding_*_8h.jsonl` files carry `markPrice = 0` before 2023-10-31. The
plan was to restore 2020-07 onward from Binance `futures/um` markPriceKlines and re-measure.

What actually happened: restoring the marks surfaced **four independent measurement bugs** in the
carry pipeline, each of which silently corrupted the answer. Fixing them changed every carry number
in the ledger, and reversed one verdict (L11). This cycle is therefore mostly an L10 cycle that
happens to be about carry.

## Work

1. **`data/mark_8h.json` rebuilt at full precision** (320 `data.binance.vision` zips → derived 8h
   series; provenance + rebuild recipe in `data/README.md`). Coverage 2020-07-01 → 2023-11-01, exactly
   filling the shipped files' `markPrice = 0` gap; the two sources overlap on 2–3 periods at the seam
   and agree to ≤ 4.4e-4.
   * **Bug found while building it:** the first pass stored `round(price*100)` as integers to save
     bytes. That quantised DOGE to **67 distinct values** over 3 621 bars (≈7 % steps at $0.07) and
     injected ~1 % of fake per-period basis noise. On the extended history this alone read the flat
     carry book at Sharpe **0.48** instead of **2.14**.
2. **`lib/lab.js#loadCloseLookup` gained `exact(t)`, `lastClose`, `firstClose`.**
   * **Bug found:** the candle files end **2026-09-19** but the funding files run to **2026-09-24**.
     The old lookup carry-forwards the last close forever, so the spot leg froze while the mark leg
     kept moving — manufacturing ±5 %/8h "basis" moves (max pooled |return| 5.06 %) and a kurtosis of
     1056. Guarding `t > lastClose` halved the book's volatility and moved the flat Sharpe 2.14 → 4.77.
   * **Bug found:** the alt 1h files have a few dozen missing bars (0.04–0.16 % of hours). A lenient
     lookup bridges them, stretching an 8h return to 9h/10h and mispairing it against the 8h mark leg.
     `exact()` drops those periods instead of mismeasuring them.
3. **`e3_carry.js#loadFundingBuckets` aggregates funding rows into 8h buckets by SUM.**
   * **Bug found:** Binance switched **SOLUSDT to 2h/4h funding from 2022-11-09 to 2022-11-18** —
     through the FTX crash. A funding row is stamped at the *end* of its interval, so a 10:00 row
     belongs to the window closing at 16:00. A plain `Map.set(roundGrid(t), rate)` kept **one of the
     four** payments: the crash-window funding was understated ~4×, precisely where it matters most.
   * `e3`'s raw-funding per-symbol table had the same defect; it now reads the same buckets.
4. **One carry book in the lab.** `loadCarryBook` now returns the four aligned legs
   (`rets, basis, basisLevel, f, spot`) plus `times` and the skip counters; **E7 was refactored onto
   it** (it had its own copy of the loading loop with three of the four bugs), and E11/E12 already
   used it. E12 exposes `buildXsSeries`, which E13 reuses.
5. **`experiments/e13_carry_robustness.js`** (new): window sensitivity, per-calendar-year and named
   regime breakdowns, plus significance done three ways (raw t, design-effect t, block-bootstrap CI)
   and an outlier-robust design effect.
6. **`experiments/e14_data_integrity.js`** (new): eight **regression tests**, one per bug above plus
   grid/precision/sanity invariants. `run_all` now reports its `pass` beside the controls'.
7. **Multi-seed placebo.** E12's "shuffled-weight placebo" was a *single* permutation draw; it now
   reports the distribution over 40 seeds (mean −0.03, sd 0.40) and where the real books sit in it.

## Result — the numbers that changed

Extended window: **2020-09-13 → 2026-09-19, 6.0 years, 6 558 8h periods** (2.1× the old sample).

### F-19 — window sensitivity (the old window flattered everything)

| book | full history | **old window (post-2023-10)** | pre-2023-11 |
| --- | ---: | ---: | ---: |
| flat equal-weight carry | 4.54 | **10.27** | 4.29 |
| xs funding level | 3.27 | **13.90** | 3.63 |
| xs funding rank | 5.03 | **14.14** | 5.53 |
| shuffled placebo | 0.33 | 0.27 | 0.42 |

### F-04 revised — the flat book on the full window

| book | annualised | Sharpe | max DD | design effect (raw / winsorised) |
| --- | ---: | ---: | ---: | ---: |
| raw funding series (a yield) | +9.40 % | 9.40 | — | — |
| **honest delta-neutral book** | **+9.05 %** | **4.54** | **7.96 %** | 99.5 / 11.8 |

Per symbol (Sharpe / max DD): BTC **9.83 / 0.5 %**, ETH 8.19 / 2.0 %, LINK 6.14 / 2.5 %,
ADA 5.94 / 2.3 %, XRP 4.12 / 5.7 %, DOGE 4.02 / 3.6 % — and then **BNB 0.02 / 26.7 %**,
**SOL −0.10 / 49.7 %**. Two of eight majors have no carry at all and carry the tail.

### F-21 — the dispersion book survives the crashes; the flat book does not

| book (6.0 y) | Sharpe | max DD | corr price | worst year | FTX month | 2022 bear |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| flat equal-weight | 4.54 | 7.96 % | −0.01 | **−1.46 (2022)** | **−5.12** | −1.43 |
| xs funding level | 3.27 | 6.63 % | +0.08 | +2.37 | +5.19 | +2.33 |
| **xs funding rank** | **5.03** | **2.93 %** | +0.08 | +3.07 | +5.51 | +2.98 |

Cross-year consistency (2021–2025): flat **4/5** positive (mean 8.90, t 2.56); xs level **5/5**
(10.34, t 4.48); xs rank **5/5** (11.84, t 5.14). Permutation null: 40 seeds, mean −0.03, sd 0.40 →
xs rank sits at **z = 12.6**, xs level at **z = 8.2**.

### F-10 / L11 reversed — basis reversion is real on the extended window

| quantity | old (buggy) | now |
| --- | ---: | ---: |
| per-symbol IC (basis z → next-period basis P&L) | 0.035 … 0.249 | **0.107 … 0.527, 8/8 positive** |
| pooled Sharpe, convergence book | +2.07 | **+9.15** |
| design effect | 1675 (PARKED) | 395 raw → **7.84 winsorised** → t ≈ 8.0 |

### F-16 revised — vol sizing, and why the design effect collapses

| book | annualised | Sharpe | max DD | design effect (raw → winsorised) |
| --- | ---: | ---: | ---: | ---: |
| carry, unsized | +9.05 % | 4.54 | 7.96 % | 99.5 → 11.8 |
| carry, vol-targeted (cap 4×, mean lev 1.63) | +9.33 % | **8.05** | **1.33 %** | **5.98 → 6.22** |
| carry, inverse-vol across symbols | +11.01 % | 10.66 | 0.69 % | — |
| control: random ±1 position, sized | — | 0.38 → 0.83 | — | — |

The sizing result is *stronger* than F-16's original claim and for a better reason than "yield
amplified in calm periods": vol-targeting drops the design effect from **99.5 to 6.0**, i.e. it
removes the fat tail, not just the vol clustering. HAR now beats the trailing baseline on QLIKE
(−7.84 vs −8.88) on this sample; EWMA still does not (−8.95).

### F-20 — the lab's own design-effect helper is outlier-fragile

`serialDesignEffect` jackknifes the **Sharpe**, which is a ratio: on the carry book the single FTX
observation (SOL basis −19.5 % in one 8h period, 2022-11-10 08:00) pushes the flat book's design
effect to **99.5**. Winsorising at 3σ gives **11.8**; deleting the FTX month gives **11.0**. So a large
raw design effect on a fat-tailed series is a statement about the largest observation, not about
persistence. `lib/lab.js#robustDesignEffect` is now the winsorised companion and both are reported;
the *block-bootstrap* CI is the third leg (flat [1.85, 9.88], xs rank [3.27, 12.79]).

## Ledger effects

* New **F-18** (four measurement bugs, with `e14` as the standing regression test), **F-19** (window
  sensitivity of the carry complex), **F-20** (`serialDesignEffect` outlier fragility), **F-21** (the
  dispersion book survives the crashes; basis reversion is significant).
* Revised in place with revision blocks: **F-04**, **F-10**, **F-16**, **F-17**.
* **L03** updated (Sharpe 0.96 → 4.54, two symbols carry the tail). **L09** updated (sizing result
  strengthened, DE 99.5 → 6.0). **L11 PARKED → SUPPORTED as a lead.** **L12 strengthened** (now 6.0 y,
  crash-surviving). **L10** gains L10-l…L10-p. New lead **L14** (mark vs traded price).
* `FOLD-BACK.md` R4 updated; **R8** added.
* New code: `experiments/e13_carry_robustness.js`, `experiments/e14_data_integrity.js`, rebuilt
  `data/mark_8h.json`.
* Full regeneration: 20 artefacts, controls green (e0c pass, e5 1h/15m pass, **e14 pass**).

## What is now false that was believed at the start of the cycle

* "Carry's basis-marked Sharpe is 0.96 with a 10.2 % drawdown." → **false**; on the full 6-year history
  it is **4.54 with 7.96 %**, and the 2.9-year reading was an artefact of the window (F-19).
* "The cross-sectional dispersion book is a lead whose 1.6 % drawdown will probably not survive a
  crash." → **false in the strong form**: on the extended window the drawdown is 2.93 %, it is positive
  in all five full years and in every crash window, and the FTX month reads **+5.51** while the flat
  book reads **−5.12**.
* "Basis reversion is parked; the design effect kills it either way." → **false**; the IC is 8/8
  positive at 0.107–0.527, the convergence book reads Sharpe 9.15, and the outlier-robust design
  effect is 7.8 (t ≈ 8). It is a lead, not a null.
* "Vol-targeting's Sharpe of 6.7 is a yield amplified in calm periods." → **partly false**: the design
  effect collapses 99.5 → 6.0, so sizing is removing the fat tail, which is a stronger claim than the
  original caveat allowed.
* "A mark-price series at 2 decimals is good enough." → **false**; at $0.07 it destroyed the DOGE leg.
* "`loadCloseLookup` is the safe way to pair two data sources." → **false**; it is safe for one source
  read alone, and a trap when the other source extends further, or when bars are missing. Use
  `exact`/`lastClose` whenever two legs are compared.

## Next

* **CYCLE-007 (L14): does the reversion survive at the *traded* price?** Every carry number here marks
  the perp leg at Binance's **mark price**, which is a smoothed index. L11's signal and E12's low
  drawdown could both be partly a mark-smoothing artefact (you cannot trade the mark). The decisive
  test is to rebuild the basis from `futures/um` **klines** (traded `close`) instead of
  markPriceKlines and re-run E3/E7/E12/E13. That is a ~590-file harvest, so it is its own cycle.
* **L07/OI probe** (open interest, the higher-prior half of R7) remains unbuilt.
* **L06** (meta-labelling), **L13** (reversal gross edge), **L08** (maker fills) remain untested.
