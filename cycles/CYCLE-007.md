# CYCLE-007 — L14: is the carry complex tradable, or a mark-price construction?

**Date:** 2026-09-26
**Goal:** test the one measurement assumption underneath every carry result. All of CYCLE-006's
numbers — the flat book's Sharpe 4.54, L12's 2.93 % dispersion drawdown, L11's +9.15 basis-reversion
book — mark the perp leg at Binance's **mark price**, which is a *smoothed index* (median spot across
venues plus a moving average of the basis), not a traded price. A spread defined against a smoothed
series can be mechanically mean-reverting (L11) and can have artificially small extremes (the
drawdowns). If that were the whole story, the carry complex would be a construction rather than a
tradable edge. This cycle was filed as the blocking falsifier and is the first task after CYCLE-006.

## Work

1. **Harvested the traded perp price.** 592 files from
   `data.binance.vision/data/futures/um/monthly/klines/<SYM>/8h/<SYM>-8h-<YYYY-MM>.zip`, 74 months
   (2020-07 → 2026-08) × 8 symbols, plus the two expected SOL 2020-07/08 404s (the contract did not
   exist). Derived series stored as **`data/perp_8h.json`** (391 KB, same shape/convention as
   `mark_8h.json`: grid time `T` = kline `open_time` + 8h, value = the kline's `close`). Coverage
   2020-07-01 → 2026-09-01.
2. **Generalised the single carry book to take either perp source** —
   `e3_carry.js#loadCarryBook(symbols, { perp: 'mark' | 'traded' })`. No new loading loop was written:
   the traded leg goes through the same funding buckets, the same `exact`/`lastClose` alignment guards
   and the same skip counters as the mark leg.
3. **Threaded `perp` through the dependent experiments** rather than duplicating them: `e7`'s
   reversion logic became the exported `reversionFromBook(perSym, {zWindow})` (so it can run on any
   book), and `e12#buildXsSeries` / `e13.run` take `{perp}`.
4. **`experiments/e15_traded_basis.js`** (new): reports the **mark-minus-traded spread** as a series
   in its own right, then re-measures the flat book, the dispersion books, the permutation placebo,
   the basis-reversion book **and the two sizing results** (L09) on **both** legs and tabulates the
   ratios. The sizing leg does not re-implement anything: `e11#sizingFromBook` was extracted from
   `e11.run` and imported by `e15`, so both legs go through one code path (a re-run of `e11` after the
   extraction produced a byte-identical artefact).
5. **`e14_data_integrity.js` gained two checks**: `perp_source_coverage` and `perp_mark_spread_sane`
   (the mark must track the traded price, else every mark-vs-traded comparison is garbage). 10 checks,
   all green.

## Result — F-22: the suspicion is falsified, decisively

**(a) The mark is a close, slightly-lagging proxy for the traded price.** `mark/traded − 1` at the
funding grid, 6 498–6 753 points per symbol:

| symbol | mean | sd | p01 / p99 | max / min | acf(1) |
| --- | ---: | ---: | ---: | ---: | ---: |
| BTC | +0.001 % | 0.017 % | −0.06 % / +0.05 % | +0.17 % / −0.19 % | +0.052 |
| ETH | −0.000 % | 0.025 % | −0.09 % / +0.07 % | +0.28 % / −0.31 % | +0.128 |
| SOL | +0.001 % | 0.047 % | −0.13 % / +0.12 % | +1.43 % / −0.68 % | +0.053 |
| BNB | −0.001 % | 0.029 % | −0.10 % / +0.09 % | +0.55 % / −0.23 % | +0.093 |
| XRP | +0.000 % | 0.038 % | −0.10 % / +0.08 % | +1.76 % / −0.27 % | +0.050 |
| ADA | +0.003 % | 0.035 % | −0.10 % / +0.09 % | +0.48 % / −0.44 % | +0.070 |
| DOGE | +0.002 % | 0.046 % | −0.13 % / +0.12 % | +1.21 % / −0.60 % | +0.046 |
| LINK | +0.002 % | 0.037 % | −0.12 % / +0.10 % | +0.35 % / −0.42 % | +0.063 |

A positive `acf(1)` is exactly the signature of a *smoothed/lagging* index — and it is the only
evidence that survives. But the magnitude is tiny: the sd is 2–5 bps, an order of magnitude below the
basis sd itself, and the extremes are ≤ 1.8 %. **There is a smoothing artefact and it is ~0.03 %.**

**(b) Every headline reading survives the traded leg.**

| reading | mark leg | **traded leg** | ratio |
| --- | ---: | ---: | ---: |
| flat delta-neutral carry, Sharpe | 4.54 | **4.65** | 1.02 |
| flat carry, max drawdown | 7.96 % | **7.96 %** | 1.00 |
| dispersion book (rank), Sharpe | 5.03 | **4.98** | 0.99 |
| dispersion book, max drawdown | 2.93 % | **3.05 %** | 1.04 |
| dispersion advantage over flat (DD) | 5.03 pp | **4.92 pp** | 0.98 |
| basis reversion, IC median | 0.430 | **0.391** | — |
| basis reversion, IC positive | 8/8 | **8/8** | — |
| basis reversion, convergence Sharpe | 9.15 | **9.17** | 1.00 |
| basis reversion, robust design effect | 7.84 | **7.61** | — |
| vol-targeted carry, Sharpe | 8.05 | **7.79** | 0.97 |
| vol-targeted carry, max drawdown | 1.33 % | **1.27 %** | 0.96 |
| inverse-vol across symbols, Sharpe | 10.66 | **10.91** | 1.02 |
| inverse-vol across symbols, max drawdown | 0.69 % | **0.68 %** | 0.98 |

Per symbol (Sharpe, mark → traded): BTC 9.83 → **11.12**, ETH 8.19 → 8.90, LINK 6.14 → 6.36,
ADA 5.95 → 6.07, DOGE 4.02 → 4.02, XRP 4.12 → 3.29, BNB 0.02 → −0.01, SOL −0.10 → −0.11. The traded
leg's worst basis is *smaller* than the mark's in five of eight symbols (SOL 19.53 % → 16.85 %), so the
mark is not manufacturing the tail either.

**Read.** The mark price is a faithful proxy at the 8 h horizon. The carry complex — the flat sleeve
(L03), the dollar-neutral dispersion sleeve (L12) and basis reversion (L11) — is **not** a
mark-smoothing construction, and the biggest remaining reservation on R4/R8 is removed. That is a
clean negative on the suspicion and, because it was pre-registered as the falsifier, it *strengthens*
the three leads rather than merely failing to weaken them.

## Ledger effects

* New **F-22** (L14 falsified). **F-21's caveat (ii)** and **F-10's caveat (ii)** are marked resolved;
  **F-04's** and **F-17's** references to the mark caveat are updated; **F-16** (sizing) gains the
  traded-leg reading: the drawdown reduction is source-independent, only the vol-targeted *level*
  moves (8.05 → 7.79).
* **L14 → NEGATIVE (closed, suspicion falsified)**; **L11** and **L12** lose their blocking falsifier
  and are upgraded to plain SUPPORTED; **L03** likewise.
* `FOLD-BACK.md`: **R4 and R8 are un-gated** (their L14 precondition is met).
* New code: `experiments/e15_traded_basis.js`, `e11#sizingFromBook` (extracted so E15 and E11 share
  the sizing path), `e7#reversionFromBook`, `e12#buildXsSeries({perp})`, `e3#loadCarryBook({perp})`;
  new data `data/perp_8h.json`; `e14` +2 checks (10 total).
* Full regeneration: **21 artefacts, 20 steps**, controls green (e0c, e5 1h/15m) and **e14 pass**.

## What is now false that was believed at the start of the cycle

* "The carry complex's Sharpe and drawdowns could be artefacts of marking the perp leg at a smoothed
  index." → **false**; on the traded leg the flat book reads 4.65 (vs 4.54), the dispersion book 4.98
  (vs 5.03) with a 3.05 % (vs 2.93 %) drawdown, and basis reversion 9.17 (vs 9.15) with the same 8/8
  positive IC.
* "L11's basis-reversion signal might be the mark's mean-reversion rather than tradable basis." →
  **false**; the IC barely moves (0.430 → 0.391) and the Sharpe is unchanged to three digits. L11's
  remaining caveat is gone entirely.
* "You cannot trade the mark, so the last big reservation on the carry sleeve stands." → **resolved in
  the sleeve's favour** — the reservation was worth testing (the smoothing is real and measurable:
  `acf(1) > 0` on every symbol) but it is two orders of magnitude too small to explain the results.

## Next

* **L07/OI probe** — open interest is the higher-prior half of R7 and still unbuilt (liquidation/OI
  data are positioning state variables, unlike the taker flow already measured as a null).
* **L13** (short-horizon reversal gross edge) and **L06** (meta-labelling) remain the untested
  frontier; **L08** (maker fills) remains the cost-side question.
* **R8 capacity check** — the dispersion book's turnover and capacity are still unmeasured; that is the
  natural next step before any port (`turnover()` is already in the harness).
