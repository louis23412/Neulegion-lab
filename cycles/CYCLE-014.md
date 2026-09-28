# CYCLE-014 — L18 validation: does the toptrader fade survive held-out, cost, confound and capacity?

**Date:** 2026-10-01
**Goal:** act on F-29 (CYCLE-013). The toptrader cross-sectional fade is the lab's first positive
signal from new data, but it was a single in-sample history with a 126×/yr turnover. Before it could be
a port candidate (R7) the lab demands four tests — the same four that gated every carry "improvement":
a held-out sign test, a cost audit, a confound check (is it just the funding rank?), and a capacity read.

## Work

1. **`experiments/e22_toptrader_validate.js`** (new, registered in `run_all`): rebuilds the masked
   cross-sectional fade from F-29 and applies all four tests in one pass. Same convention as `e21`
   (signal snapshot at `times[i]`, forward return `legs.spotRet[i+2]`, missing symbols masked).
2. **Held-out.** The fade sign is a *prior* (contrarian), not fitted — so the honest test is: fix the
   sign, confirm the first half earns it, score the second half on its own (and show the opposite sign
   loses in both).
3. **Cost + smoothing.** The F-24/E17 machinery (EWMA on the weights, renormalised) is swept over
   λ = 0.5, 0.25, 0.1, 0.05, plus a non-normalised variant, each audited by `e16#audit`.
4. **Confound.** The identical construction on the **funding rate** — a signal already in the repo's
   data — gives the funding-fade book; its stability and return correlation with the toptrader book
   decide whether F-29 is a new signal or a proxy.
5. **Capacity.** `e19#capacityOf` (the F-26/F-27 impact model) plus the F-28 open-interest concentration
   read.

## Result — F-30: the fade passes all four tests, and smoothing is the right construction

| construction | gross Sharpe | turn / yr | break-even | net@4 | H1 / H2 gross | H1 / H2 net@4 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| daily (F-29) | 1.055 | 126× | 15.1 bps | +0.78 | 1.26 / 0.85 | 1.04 / 0.51 |
| EWMA 0.5 | 0.895 | 69× | 25.8 bps | +0.76 | 0.95 / 0.84 | 0.85 / 0.65 |
| EWMA 0.25 | 0.846 | 42× | 40.1 bps | +0.76 | 0.86 / 0.84 | 0.80 / 0.73 |
| **EWMA 0.1** | 0.839 | 23× | **74.2 bps** | **+0.79** | 0.84 / 0.85 | **0.81 / 0.79** |
| EWMA 0.05 | 0.849 | 15× | **118 bps** | **+0.82** | 0.86 / 0.85 | 0.84 / 0.81 |
| EWMA 0.1, no renorm | 1.011 | 23× | 77.1 bps | +0.96 | 1.22 / 0.79 | 1.18 / 0.73 |

* **Held-out: passes.** Daily H1/H2 gross **1.26 / 0.85** (net@4 1.04 / 0.51); the *opposite* sign loses
  in both halves (−1.26 / −0.85), so the first half picks the fade and the second half is genuinely
  out-of-sample for the sign. The smoothed book is far more stable: H1/H2 net@4 **0.81 / 0.79**.
* **Cost: smoothing wins.** EWMA(0.1) cuts turnover **126× → 23×/yr** and lifts the break-even
  **15 → 74 bps** (EWMA 0.05: 118 bps) with no loss of net Sharpe (net@4 +0.79, the same as daily). The
  daily book only clears a 4 bps fee by 0.5 Sharpe of margin on the second half; the smoothed book
  clears it in both halves. This is F-24's lesson on a non-carry signal.
* **Confound: not funding.** The funding-rank fade (on spot) reads gross **1.03** but **896×/yr**
  turnover (break-even **2.9 bps**) and is *unstable*: H1 +1.96, **H2 −0.43** (net@4 H2 −2.60). The
  toptrader signal correlates only **0.29** (cross-sectional) / **0.20** (book returns) with it. So the
  top-trader ratio carries positioning information beyond funding, and it is the stable one.
* **Capacity: OI-bound to tens of millions.** E19 impact capacity for the daily book **$15 M** (Y=1,
  4 bps); the smoothed book is not impact-limited (**$4.2 B**, it barely trades). The binding limit is
  open interest (F-28's convention): the biggest position is 1 %/5 %/10 % of the thinnest symbol's OI
  (LINK) at **$8–10 M / $40–50 M / $81–101 M**. Same size class as the carry complex.

## What is now false that used to be believed

* **"The toptrader fade is an untested single-sample result."** It is now validated: both halves
  positive net of a 4 bps fee, the sign is out-of-sample, and it is robust to the obvious confound.
* **"A 126×/yr turnover makes it only marginally tradable."** It does not: smoothing the weights (the
  F-24 trick) cuts turnover ~5× and lifts the break-even to **74 bps** — comfortably above the repo's
  cost assumption — while *improving* the half-sample stability (0.81 / 0.79 net@4).
* **"Positioning signals are just the funding rate."** They are not: funding-fade-on-spot has the same
  gross Sharpe but is unstable (H2 negative) and 7× the turnover; the top-trader ratio is distinct.

## Ledger effects

* New **F-30**; new experiment `experiments/e22_toptrader_validate.js` (registered in `run_all`).
* **L18 → SUPPORTED (validated)**: the best construction is EWMA(0.1)-smoothed renormalised weights
  (break-even 74 bps, net@4 +0.79, stable halves); the sleeve is OI-bound to tens of millions.
* **R7's revisit now has a concrete spec** (port the metrics fields; use the toptrader ratio as a
  cross-sectional stream with EWMA-smoothed weights and a size cap), pending the project's own gate.

## Next

* **L13** (short-horizon reversal gross edge) and **L06** (meta-labelling) return to the top of the open
  frontier; **L08** (maker fills) remains. L07's liquidation-print probe is optional.
* A natural follow-on: does the toptrader signal **combine** with the carry dispersion book (F-24) —
  two independent cross-sectional positioning streams? Design effect / combined Sharpe (L02/F-03 tools).
* The **F-24 edge decay (2025–26)** risk question remains open.

## Run

Full `run_all` regenerate after this cycle (27 steps; `results/RUN_SUMMARY.json` @ 2026-09-26T16:04:24Z;
`e22_toptrader_validate` 2.5 s). Controls `e0c`, `e5` (1h/15m) and the 13-check integrity suite `e14`
all report `pass`.
