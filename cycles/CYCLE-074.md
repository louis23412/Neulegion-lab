# CYCLE-074 — Round 41: the G5 conjunction becomes executable

**Date:** 2026-09-28
**Goal:** make the audit's tightened G5 (A8) a function call — five computable knobs plus two human attestations — with synthetic ground truth in the repo harness.

## Work (repo, round 41)

* **`blockSharpes(net, blocks)`** (`analysis/portfolio.js`): the per-block Sharpes `worstBlock` reads, factored underneath it byte-identically (the A18 checks pin the equality).
* **`scoreG5({...})`** (`analysis/portfolio.js`): `{verdict, reasons, knobs, costBps, blocks}`. Gating knobs — `level` (net Sharpe at stated cost > 0), `blocks` (positive fraction ≥ 4/6), `dsr` (`dsrAdjusted` ≥ 0.95, null fails), `neutral` (> 0, null fails), `capacity` (size ≤ bound; passes vacuously with no size claim) — plus reported-never-gating `halves`/`worstBlock` and pass-through `decay`/`unseen` attestations. An unscored hurdle fails; the report can never claim a check it did not run.
* Six `analysis` checks (per-block exposure + null convention, clean-book pass on all nine knobs, independent per-knob failure with names, blocks below 4/6 + vacuous capacity, reported-never-gating + non-finite level fail). 677 → 683.
* Registry: `blockSharpes`/`scoreG5` added to `ANALYSIS_MODULES`; `locks` 41/0 unchanged.
* Ledger: **2824 → 2830** (RUNBOOK §6 table + round note, node mirror 677/683, ROADMAP snapshot + suite line, `src/README.md` ledger).

## Verification (browser harness)

* `analysis` **683/0**, `contracts` **151/0**, `locks` **41/0**, `walkforward` **90/0** — green in-harness at the freeze.
* No golden moves (report-layer only; controller untouched).

## Lab effects

* None on lab numbers. FOLD-BACK: G5 is now executable on any scored book via `scoreSleeve` (R40) + `scoreG5` — the operator's `--sleeve` run only needs the data-layer view builder + flag to print a verdict.

## Next

* R42 `--sleeve` view builder + flag (G2 number on real data, operator run), then the G1b full-history sleeve verdict.
* Native `npm test` on the operator machine required before further landings (two report-path rounds since the 131/131 confirmation).
