# CYCLE-012 — L17: can the dispersion capacity be raised?

**Date:** 2026-09-29
**Goal:** act on F-26 (CYCLE-011). The capacity audit showed the F-24 dispersion book's capacity is ~$13 M
(Y=1, 4 bps) and that the binding symbol is DOGE at ~1 % of ADV, because the demeaned *rank* weight
concentrates in whichever alt has the most extreme funding — and the F-24 construction can reach
`max|w| = 0.5` (50 % of gross in one symbol) when ranks flip and the `Σ|w|=1` renorm re-inflates the
cancelled EWMA state. If that concentration is a weighting artefact, a position limit should buy capacity
and this cycle tests it.

## Work

1. **`experiments/e20_capacity_aware.js`** (new): applies capacity-aware transforms to the F-24 target
   (`rank` weights + EWMA(0.1)) on the SAME legs, and scores each with BOTH the F-24 audit (`e16#audit`:
   gross Sharpe, turnover, break-even, net ladders) AND the F-26 capacity (`e19#capacityOf`), so no second
   cost model exists. Transforms: **soft cap** (clip then renormalise), **strict cap** (clip and hold —
   the book is under-invested when concentrated), **dropThin(q)** (zero the q thinnest-ADV symbols),
   **advTilt(p)** (scale the target by `ADV^p`).
2. **Reuse, not copy.** `e19` now exports `makeCapacityEnv` + `capacityOf`; `e20` imports them, along with
   `e17#buildBook/rankWeights/levelWeights` and `e13#windowStats/REGIMES`.
3. **Guards (asserted in the artefact):** `baseline` reproduces E17's `rank_ewma0.1_norm` exactly
   (`maxAbsDiff = 0`); a cap above `max|w|` reproduces the baseline.
4. **Stability is first-class.** Every variant carries half-sample Sharpe, per-calendar-year Sharpe and
   the serial design effect, because a capacity transform that only lifts the full-sample Sharpe is a fit
   (PROTOCOL rule 2) — and because F-24's edge is known to have decayed after 2024.

## Result — F-27: a strict per-symbol position cap roughly doubles capacity and de-risks the sleeve

| construction | gross Sharpe | turn / yr | net@4 | DD | design eff. | capacity $ (Y=1 / Y=0.5) | regimes +ve |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline (F-24) | 5.18 | 85× | +3.55 | 0.94 % | 7.9 | 13.2 M / 52.8 M | 7 |
| soft cap 0.18 | 8.62 | 72× | +5.83 | 0.30 % | 4.8 | 13.5 M / 54.1 M | 8 |
| **strict cap 0.12** | 6.37 | 30× | +4.91 | 0.48 % | 4.5 | **28.4 M / 113 M** | **9** |
| **strict cap 0.125** | 6.97 | 35× | +5.32 | 0.47 % | 2.2 | **26.7 M / 107 M** | 8 |
| strict cap 0.14 | 8.24 | 49× | +5.97 | 0.24 % | 2.9 | 18.3 M / 73.4 M | 8 |
| strict cap 0.175 | 8.71 | 67× | +6.00 | 0.30 % | 3.8 | 14.0 M / 56.0 M | 8 |
| ADV-tilt (p=1) | 1.11 | 87× | −1.75 | 7.8 % | 8.5 | 0 | 4 |
| drop 2 thinnest | 3.82 | 86× | +2.45 | 1.2 % | 3.0 | 8.9 M / 35.7 M | 7 |

* **A true position limit works.** A **strict** cap at ≈`1/k` (12.5 %) takes capacity **$13.2 M → $26.7 M**
  (2.0×; $28.4 M at 0.12) with turnover 85×→30–35×, drawdown 0.94 %→0.47 %, design effect 7.9→2.2, net@4
  +3.55→+5.32 and **8–9 of 9** net-of-fee regimes positive (baseline: 7). Capacity is smooth in the cap
  (0.12→$28 M … 0.20→$15 M), i.e. turnover-driven, not a lucky window.
* **The limit must actually limit.** A *soft* cap (clip + renormalise) buys **no** capacity ($13.5 M):
  renormalising re-inflates the clipped position. This is the trap the first attempt fell into.
* **Both extremes fail.** Caps **below ~0.12 (=1/k)** are degenerate — the rank information is clipped
  away, so "capacity" explodes ($348 M at 0.10) while the Sharpe collapses to 3.1 and the design effect
  jumps to 30. Removing the thin symbols or ADV-tilting destroys the edge (gross Sharpe 1.1–3.8): the
  funding-rank *ordering* is the signal and both edits damage it.
* **Sharpe:** loosening to 0.15–0.175 raises the in-sample gross Sharpe to 7.7–8.7 (above the baseline in
  **every** calendar year) at the cost of the capacity gain — a size/Sharpe preference inside 0.125–0.175.
  The magnitude is large enough to be flagged (F-11/F-20) and the port should pre-register an OOS test.

## What is now false that used to be believed

* **"The F-24 dispersion capacity ($13 M) is the intrinsic limit."** It is not: a per-symbol position cap
  roughly doubles it ($27 M), and the concentration that caused the low capacity was an artefact of the
  rank-weight construction (up to 50 % gross in one name) rather than of the signal.
* **"Renormalising to `Σ|w|=1` is a harmless normalisation."** It is not scale-free across time: it
  re-inflates the EWMA state when ranks cancel, and the position cap that undoes this both raises Sharpe
  and halves the design effect.

## Ledger effects

* New **F-27**. **L17 → SUPPORTED — closed.** **R8's port spec amended**: add a strict per-symbol gross
  cap at ~1/k (12.5 %). L15/L17's next-action to "build a capacity-aware construction" is complete.
* New code `experiments/e20_capacity_aware.js`; `e19` now exports `makeCapacityEnv`/`capacityOf`.

## Next

* **L07 open interest** is now the last unmeasured physical limit (it prices the *flat* hold's size, not
  impact). Then the new mechanisms: L13 (reversal), L06 (meta-labelling), L08 (maker fills).
* **Port-test the F-27 cap** through the repo's own gate, including a held-out block for the Sharpe lift.
* The **F-24 edge decay (2025–26)** remains open as a risk question.
