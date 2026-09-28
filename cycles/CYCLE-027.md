# CYCLE-027 — The exact portfolio OI frontier: is the joint capacity the sum? (L12 × L18 × L15/L17, follow-up to F-43)

**Date:** 2026-11-26
**Goal:** F-43 (CYCLE-026) showed the two working sleeves' OI capacities "do not add" — but that was
measured at a **fixed** 25 % split (56 % of the sum) and in the naive "deploy each at its own individual
bound" scenario (78 % of periods breach). Both are *policies*, not the frontier. The honest object is a
2-D linear program per period:

```
maximise   gC_t·G_C + gF_t·G_F                          (total gross notional deployed)
s.t.       |G_C·wC_j(t) + G_F·wF_j(t)| ≤ f·OI_j(t)      for every symbol j      (f = 5 %)
           G_C, G_F ≥ 0
```

where `wC`/`wF` are the two books' capped weights and `gC_t = Σ_j|wC_j(t)|`. The individual bounds and
F-43's proportional-split bound are special cases. This cycle asks whether the *free-split* joint capacity
is materially below the sum — i.e. whether F-43 is a statement about the constraint or only about a
particular allocation.

## Work

1. **`experiments/e36_portfolio_oi_frontier.js`** (new, registered as `e36_portfolio_oi_frontier`) —
   reuses `e35#buildPair` (extracted this cycle, its artefact verified **byte-identical**) and solves the
   LP every period by enumerating the feasible-polygon vertices (constraint-line pairs **and the two axis
   vertices** — omitting the axes understates the optimum and was caught by the guard). It reports:
   * the distribution of the LP's total gross vs the sum of the individual bounds and F-43's fixed split;
   * the optimal split (fade share of gross) and the binding symbol;
   * the dollar P&L of the **LP-scheduled** portfolio, charging the fee on the *actual* dollars traded
     (so re-optimising the size each period is charged) — its net@4 Sharpe and turnover;
   * **guards:** the LP optimum must be ≥ the larger individual bound (an axis is feasible), and each
     book's individual bound mean must reproduce `e34`'s stored `meanGcap` to 5 % (carry 0.45 %, fade
     1.14 %).
2. **Falsifier (pre-registered).** The joint schedule is "just the sum" — i.e. F-43 overstates the
   problem — if the LP's **mean** total gross is within 5 % of the sum of the individual bounds.

## Results

**(a) The free-split joint capacity is NOT 56 % of the sum — that was the fixed split.** In the gross-notional
unit (F-42), 5 175 common periods:

| bound | mean | p5 | median | p95 | p99 |
| --- | ---: | ---: | ---: | ---: | ---: |
| carry alone | $24.14 M | $10.26 M | $20.13 M | $57.92 M | $71.02 M |
| fade alone | $31.49 M | $10.75 M | $22.22 M | $86.81 M | $125.02 M |
| **sum of individuals** | $55.64 M | — | $42.35 M | — | — |
| F-43 fixed 25 % mix | $31.30 M | $11.51 M | $28.00 M | $65.49 M | $95.70 M |
| **LP, free split** | **$62.72 M** | $11.93 M | **$37.11 M** | $166.39 M | $624.28 M |

The LP **mean is 1.13× the sum** and the **median is 0.88× the sum**; the LP is **2.00× the fixed
25 % mix**. So F-43's "56 % of the sum" was a property of the *fixed allocation*, not of the constraint.
The mean exceeds the sum because the two books' positions **net** in some thin symbols — when carry is long
LINK and the fade is short it, the pair can both be large — and the LP exploits that period by period
(the p99 is $624 M). The median (0.88×) is the more typical number: the joint book is usually slightly
*smaller* than the sum, occasionally much larger.

**(b) But the optimal split is unstable, and the LP-optimal schedule is not implementable.** The optimal
fade share has **mean 0.595 but p5 = 0 and p95 = 1** — in 0/1 periods the LP wants *only one* sleeve, and
the identity of the binding symbol flips (ADA 2 448, LINK 1 713, DOGE 606, BNB 176, XRP 159, SOL 73). That
is not a portfolio allocation; it is a per-period arbitrage of the two books' position collisions. And the
LP-scheduled book pays for it: re-optimising the size every period turns over **48.5× gross per year** and
its **net@4 Sharpe collapses to 0.62** (gross 0.70) — versus the carry book's 6.49 alone. The $11.0 M/yr
gross the LP schedule earns is real, but the size swings dominate the variance.

## What is now false that used to be believed

* **"The joint OI capacity is 56 % of the sum (F-43)."** That is true only for a *fixed* allocation (and
  for the naive both-at-individual deployment). The free-split joint capacity is **≥ the sum on average
  (1.13×)** — the constraint is not as costly as the fixed mix implied.
* **"There is a stable joint allocation."** No: the LP's optimal fade share is 0 in some periods and 1 in
  others (p5 0 / p95 1), so the two sleeves do not form a stable portfolio — the LP just picks whichever
  book's positions net better against the other's each period.
* **"The LP frontier is a deployable size."** No: the LP-optimal schedule churns 48.5× gross/yr and nets
  net@4 **0.62** (vs carry's 6.49). The frontier is a **capability**; capturing it needs the F-42 treatment
  (a clipped/smoothed joint target), and the sensible port size for a *portfolio* remains the fixed-split
  joint bound of F-43, not the LP.

## Ledger effects

* New **F-44**; new experiment `e36_portfolio_oi_frontier.js`, new artefact
  `results/e36_portfolio_oi_frontier.json`; `e35#buildPair` extracted as a reusable primitive (its
  artefact verified byte-identical); `run_all` is now **44 steps** with a new validation guard.
* **F-43 refined** (its 56 % is a fixed-split number; the frontier is ~1.13× the sum, but unstable and
  high-churn); **L15** gains the frontier; **FOLD-BACK R7/R8** gain the "the joint *frontier* is ≈ the sum,
  but only via an unstable schedule; size to the fixed-split bound" note.
* No *return* number moves — this cycle is the portfolio-size geometry.

## Next

* If a joint schedule is ever wanted, the object is the **clipped joint frontier**: target the
  trailing-median LP split and clip the total at `f·min_j OI_j/|(1−a)wC+a wF|`, which should recover most
  of the frontier at low churn (the F-42 result, now in two dimensions). This is the natural CYCLE-028.
* L10's audit remains open (it never closes); the frontier has no unmeasured mechanism free data can reach.

## Run

`e36` ~1.8 s (registered). Full `run_all` regeneration **44 steps** (`RUN_SUMMARY` at
**2026-09-26T22:33:14Z**); controls `e0c`, `e5` (1h/15m), the 13-check `e14`, and the validation guards
`e28`–`e36` all report `pass`. *(Superseded by the CYCLE-028 45-step regeneration at
2026-09-26T22:56:43Z — this snapshot is kept for provenance.)*
