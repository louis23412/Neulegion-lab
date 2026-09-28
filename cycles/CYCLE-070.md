# CYCLE-070 — Rounds 36–37: the A2 factor-neutral hurdle and the G2 book scorer land

**Date:** 2026-09-28
**Goal:** cut the two load-bearing round-31 gates into code before the next number is believed: A2 (no market-beta promotion) and G2 (a sleeve book scores through the repo's own arithmetic).

## Work (repo, rounds 36–37)

* **R36 A2** (`analysis/dependence.js`): `firstPCWeights` (power-iteration eigenvector from the e1 basis, so perfectly anti-correlated panels converge), `factorNeutralResidual` (OLS beta of the series on the raw first-PC scores), `factorNeutralSharpe` (raw + neutral Sharpe with a scale-aware 1e-12 floor so a ~0-variance residual reads 0, not ±1e11). Six `analysis` checks: unit-vector alignment, pure-beta neutralised, orthogonal alpha survives, single-stream neutralises to 0, residual-to-PC orthogonality, degenerate null. 658 → 664.
* **R37 G2** (`analysis/portfolio.js`): `bookReturns` (per-period weight·return dot, null on ragged/non-finite), `bookTurnover` (absolute-change sum, 0 on a single row), `scoreBook` (gross/net Sharpe pair, cost spread uniformly per bar, break-even identity). Six `analysis` checks: dot identity, rejection, turnover sum, zero-cost net==gross, break-even bps identity, cost monotonicity. 664 → 670.
* Registry: both export lists added to `ANALYSIS_MODULES` (dependence.js, portfolio.js); `locks` 41/0 unchanged.
* Ledger: **2790 → 2802** (RUNBOOK §6 table + round note, node mirror 658/670, DESIGN/LOCKED pins, ROADMAP snapshot + suite line, `src/README.md` ledger).

## Verification (browser harness)

* `analysis` **670/0**, `locks` **41/0**, `walkforward` **85/0**, `analyze` **286/0** — all green in-harness at the freeze.
* No golden moves (dependence/portfolio are report-layer; controller untouched).

## Lab effects

* None on lab numbers. FOLD-BACK: A2 is the audit amendment's factor-neutral hurdle made executable; G2 is the sleeve→book→risk scoring path the `--sleeve` run mode will drive.

## Next

* R38 `--sleeve` driver mode (sleeve book through the unchanged gate, pooled at the run's K).
* R39 crowding/decay + regime/tail stress (A18) on the scored books.
* Native `npm test` on the operator machine required before further landings (eighteen shipped-path/report-layer edits since the 131/131 confirmation).
