# CYCLE-000 — Founding sweep: the measured frontier

**Date:** 2026-09 (founding session)
**Goal:** measure the shipped NeuLegion project's real frontier on its own data, with its own
statistics, without editing it.

## Method

Built `lib/lab.js` (loading + alignment + the repo's own `analysis/*` arithmetic) and nine
experiments (`e0`, `e0b`, `e0c`, `e2`, `e3`, `e4`, `e5`, `e6`, `e7`), all runnable through the repo's
browser harness (`RUNNER.md`). `run_all.js` regenerates every artefact in one pass. Every number is
the repo's own; the lab adds only plumbing and combination.

## Hypotheses tested → outcome

| hypothesis | outcome | finding |
| --- | --- | --- |
| the reported edge is real over the long sample | **false** — it is the last 600 bars (≈25 days) | F-01 |
| the basket has independently informative streams | **false** — design effect 4.92, 1.47 streams of 8 | F-02 |
| cross-sectional demeaning collapses dependence | **true** — design effect 0.39–0.60 | F-03 |
| carry is a usable yield | **true, if basis-marked** — +4.78 %/yr, Sharpe 0.96, r = 0.115 | F-04 |
| funding predicts price | **false** — +0.026 | F-05 |
| the literature's momentum upgrades help | **false** — all ≤ +0.13 Sharpe, ≤ 2.6 bps | F-06 |
| cross-sectional momentum has an edge | **false** — |Sharpe| ≤ 0.033 | F-07 |
| volatility conditioning helps | **false** — +0.112 vs +0.110 | F-08 |
| calendar seasonality survives OOS | **false** — −0.009 / −0.073 | F-09 |
| basis reversion is significant | **no** — Sharpe ~2.1 but design effect ~1.7e3 | F-10 |
| the harness reports a real edge when one exists | **true** — oracle +12.25, random +0.02 | F-11 |
| combining the sleeves helps | **false** — +0.019 | F-12 |

## What was built

* `lib/lab.js`, `prototypes/signals.js`, the nine experiments, twelve result artefacts.
* `README.md`, `THEORY.md` (J1–J6, E-A…E-E), `FINDINGS.md` (F-01…F-12), `FOLD-BACK.md` (R1–R7).

## What is now false that was believed at the start

* "The reported `sig-momentum` Sharpe (+1.0848) is a strategy result." → it is a 25-day regime (F-01).
* "The P4 carry stream's Sharpe of 11.6 is a result." → it is a yield; the honest book is 0.96 (F-04).
* "Some momentum upgrade will clear the cost gate." → every measured upgrade is at or below plain
  momentum, and all break-evens are 1–2.6 bps over 6 years (F-06).

## Next

Build the lead library so this is a live research record, then challenge the one remaining soft claim
(F-01 under the repo's own aggregation) and open the untested frontier (L06, L07, L09, L12, L13).
