# CYCLE-073 — Round 40: the sleeve scoring composition lands in the repo

**Date:** 2026-09-28
**Goal:** land the scoring half of round-31 W2/W3 (MIGRATION-V2 §8 item 1) — every V2.2 sleeve scored through the repo's own gate arithmetic — as the driver-side composer the import law forces, with synthetic ground truth in the repo harness.

## Work (repo, round 40)

* **`scoreBookReturns(gross, weightRows, {costBps})`** (`analysis/portfolio.js`): the `scoreBook` arithmetic factored onto a precomputed gross series (sleeve plugins emit their own P&L, not per-symbol returns, so the dot form cannot score them). `scoreBook` is now a thin wrapper (dot → core); the §K identity check pins byte-equality. Null on empty/non-finite gross or ragged weights.
* **`src/sleeve_score.js`** (new, driver-side): `resolveSleeve` (throws on an unknown id, naming the three) + `scoreSleeve(sleeveId, view, {costBps, panel})` — sleeve `signal()` → `single` book → pinned `cap-band` spec → sleeve `returns()` → `scoreBookReturns` + A2 `factorNeutralSharpe` (NaN-neutral without a panel) + A18 `stressHalves`/`worstBlock`. Unavailable (never throw) on an empty book. This placement is the only law-legal one: plugins may not import each other or the gate, the legacy tree may not import core — so the composition lives beside the driver.
* Ten `contracts` §K checks (shared-core identity, rejection, id resolution, all three sleeves' composition identity against hand-chained calls, cost monotonicity, turnover identity, neutral NaN/finite pair, empty-view unavailable, finite A18 on a long book). 141 → 151.
* Registry: `scoreBookReturns` added to `ANALYSIS_MODULES`; `locks` 41/0 unchanged.
* Ledger: **2814 → 2824** (RUNBOOK §6 table + round note, node mirror 141/151, ROADMAP snapshot + suite line, `src/README.md` ledger; no hot-path change, no golden moved).

## Verification (browser harness)

* `contracts` **151/0**, `analysis` **677/0** (the `scoreBook` refactor moves nothing), `locks` **41/0** — green in-harness at the freeze.
* No golden moves (report-layer + driver-side only; controller untouched).

## Lab effects

* None on lab numbers. FOLD-BACK: W2/W3 scoring half closed at the repo layer; sleeves stay UNTESTED until a real-data `--sleeve` run puts a G2 number on them. The remaining driver work is the data-layer view builder (funding/positioning panels from `--carry-files`-style inputs) + the `--sleeve` CLI flag.

## Next

* R41 `--sleeve` view builder + flag (G2 number on real data, operator run), then the G1b full-history sleeve verdict and the G5 portfolio conjunction.
* Native `npm test` on the operator machine required before further landings (the composer + the shared-core refactor touch the report path the browser harness covers only synthetically).
