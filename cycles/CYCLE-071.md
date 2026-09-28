# CYCLE-071 — Round 38: the sleeve decision composer

**Date:** 2026-09-28
**Goal:** compose the two new gates into the single object the `--sleeve` driver will score: book economics + factor-neutral hurdle, one call.

## Work (repo, round 38)

* `scoreSleeveBook(weightRows, retRows, panel, {costBps})` (`analysis/portfolio.js`, imports the A2 primitive): `{book, neutralSharpe, rawSharpe, panelStreams}`; NaN-neutral without a panel, null on a ragged book.
* Three `analysis` checks (composition identity, no-panel NaN, ragged null). 670 → 673.
* Registry: `scoreSleeveBook` added to `ANALYSIS_MODULES`; `locks` 41/0 unchanged (plus a repaired `});` closer dropped by the R37 registry edit, caught by the harness before landing).
* Ledger: **2802 → 2805**.

## Verification (browser harness)

* `analysis` **673/0**, `locks` **41/0**, `walkforward` **85/0**, `analyze` **286/0**, `contracts` **141/0** — all green in-harness at the freeze.
* No golden moves.

## Next

* R39 `--sleeve` driver mode + crowding/decay and regime/tail stress (A18).
* Native `npm test` on the operator machine required before further landings (twenty-one edits since the 131/131 confirmation, including better-sqlite3-adjacent registry and report-layer paths the browser harness cannot cover).
