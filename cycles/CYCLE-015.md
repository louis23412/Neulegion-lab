# CYCLE-015 — Combining the two independent cross-sectional streams (L18 × L12)

**Date:** 2026-10-02
**Goal:** the natural follow-on to CYCLE-014. The lab now has two cross-sectional positioning streams —
the F-24 carry dispersion book (funding-rank weights on the carry P&L, Sharpe ~4–5) and the validated
L18 toptrader fade (toptrader-ratio weights on the spot return, Sharpe ~0.83). They trade different
return legs and different signals, so if they are uncorrelated the combination should have more available
Sharpe than either alone (the lab's F-02/F-03 thesis: power is buyable by construction). Measure exactly
what the combination buys — and be honest if it buys only robustness, not Sharpe.

## Work

1. **`experiments/e23_combine.js`** (new, registered in `run_all`): builds both books with the SAME
   EWMA(0.1)-renormalised construction, on ONE loop over the same book grid, so the two return streams
   are aligned to the same calendar interval by construction (no join ambiguity).
2. Reports the return correlation matrix, the max-Sharpe two-asset mix, and the combined gross and
   net@4 at mixes 0/25/50/75/100 with half-sample splits of each.
3. Netting: each stream is charged its own 4 bps turnover; the combination is charged the mix-weighted
   sum.

## Result — F-31: a true diversifier that fixes the carry book's weak half

* **The streams are orthogonal.** Return correlation of the toptrader fade with the carry dispersion
  book is **−0.001** (0.025 with flat carry). Two cross-sectional positioning books, essentially
  independent.
* **The max-Sharpe mix is ~98 % carry** — the carry book's Sharpe dwarfs the fade's, so *full-sample*
  Sharpe is not improved by adding the fade. The benefit is **robustness**, and it lands exactly on the
  lab's known weakness: the carry book's net@4 **second half is −0.12** (the F-24 decay), while a 25 %
  toptrader allocation makes it **+0.75** at a combined net@4 of **+1.38** (both halves positive).

| mix (topLS / carry) | gross | net@4 | H1 net@4 | H2 net@4 |
| --- | ---: | ---: | ---: | ---: |
| 0 / 100 | 4.42 | +2.46 | +3.60 | **−0.12** |
| 25 / 75 | 1.91 | +1.38 | +1.88 | **+0.75** |
| 50 / 50 | 1.21 | +1.00 | +1.20 | **+0.76** |
| 75 / 25 | 0.96 | +0.86 | +0.94 | +0.76 |
| 100 / 0 | 0.83 | +0.79 | +0.82 | +0.76 |

## What is now false that used to be believed

* **"The toptrader fade is just another small standalone sleeve."** It is also the **diversifier the
  carry complex needed**: ρ ≈ 0 with the dispersion book, and it removes that book's negative second half
  net of fees (F-24's decay caveat becomes a *portfolio* problem with a portfolio answer).
* **"Combining the lab's sleeves can't help (F-12)."** F-12 said combining sleeves with *no edge* gives
  no edge (all the direction sleeves read ≈0). This is the opposite case: two sleeves that *do* have
  edges and are uncorrelated — the combination's value is the stability of the weaker half, not a higher
  full-sample Sharpe.

## Ledger effects

* New **F-31**; new experiment `experiments/e23_combine.js` (registered in `run_all`).
* **L18** next-action "combine with carry" → done. **L12/F-24** gains a documented diversifier.
* No change to the size story (both sleeves OI-bound to tens of millions, F-28/F-30) nor to R7's
  direction.

## Next

* **L13** (short-horizon reversal gross edge), **L06** (meta-labelling), **L08** (maker fills) are the
  remaining open mechanisms.
* The combination is an equal-weight mix; a **risk-parity / max-decorrelation** weighting of the two
  streams (and a per-stream size cap from F-30) is the natural refinement.
* The **F-24 edge decay (2025–26)** is now partly hedged by L18, but the decay itself is still open.

## Run

Full `run_all` regenerate after this cycle (28 steps; `results/RUN_SUMMARY.json` @ 2026-09-26T16:20:32Z;
`e22` 2.4 s, `e23` 1.5 s). Controls `e0c`, `e5` (1h/15m) and the 13-check suite `e14` all report `pass`.
