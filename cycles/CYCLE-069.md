# CYCLE-069 — Round-35 build: F-71/F-74 shipped-path fixes land in the repo

**Date:** 2026-09-28
**Goal:** close the W6 remainder that CYCLE-068 deferred (fixes before new numbers), six latent shipped-path defects with synthetic ground truth in the repo harness and the ledger updated in the same change.

## Work (repo, round 35)

* **F-71** (`analysis/features.js`): `finiteSum` on an empty window is NaN (was 0); `causalZScore` abstains below a scale-aware 1e-12 epsilon (the exactly-constant window whose mean is not bit-exact read |z| ~0.97 from denormal std); `networkMomentum` abstains without a valid `streamIndex` (was folding the stream's own momentum in); `regimeGatedMomentum` scales the crash gate by the gate-window variance (was the momentum window's).
* **F-74** (`analysis/world.js`): `makeCandleViewFor` yields a null panel when the stream cannot be placed (absent/out-of-range `streamIndex` abstains instead of reading a half-shocked cross-section); `worldFromCandles` fail-closes on negative/fractional `maxBars` (0 is the empty world).
* Ten `analysis` checks (constant-window abstain x2, empty-window NaN, self-skip x2, gate-variance identity, null-panel x2, maxBars x2). 648 → 658.
* Ledger: **2780 → 2790** (RUNBOOK §6 table + round note, node mirror 648/658, DESIGN/LOCKED pins, ROADMAP snapshot + suite line, `src/README.md` ledger).

## Verification (browser harness)

* `analysis` **658/0** green in-harness at the freeze.
* No golden moves (signal/world report-layer and abstain arms; controller path untouched).

## Lab effects

* None on lab numbers (lab signals run span-1 abstain paths; the gate-variance fix changes only the SIGUP crash arm's abstain boundary).
* FOLD-BACK: F-71/F-74 close six L10 rows at the repo layer; remaining W6 item is L10-cs (sleeve in the paired test) plus replication/dependence/streams rows.

## Next

* R36 `--sleeve` run mode (sleeve → book → risk through the unchanged gate) for the G2 number.
* A2 factor-neutral hurdle (first-PC-removed Sharpe beside raw).
* Native `npm test` on the operator machine required before further landings (six shipped-path edits since the 131/131 confirmation).
