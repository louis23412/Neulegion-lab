# CYCLE-078 — Round 45: the R5 demean tool (F-03 as a construction primitive)

**Date:** 2026-09-29
**Goal:** port FOLD-BACK R5 — the cross-sectional demean — as a tool, never an arm (K untouched), with F-03 reproduced through the repo's own functions.

## Landed (repo, round 45)

* `analysis/features.js`: `panelMean` (masked finite mean, L10-r, <2 live → NaN) + `demeanedFn(fn)` (any returns-computable feature net of its panel mean; siblings through returns-only views so closes-dependent features abstain there by the existing guards; missing panel/bad streamIndex abstains; causal — reads ≤ t only) + `xsMomentum` (the F-03 object, following the `crossSectionalReversal` precedent). No roster change.
* Eight `analysis` §AN checks (masked mean + floor, xs identity to 1e-12, generic wrap on vol-scaled momentum, L10-r exclusion vs zero-fill, the four abstains, throw-on-non-function + exact dollar-neutrality Σ=0, strict-future shock invariance, pipeline flow finite-and-clamped). The three exports joined the exhaustive registry list in the same change.
* Ledger: **2843 → 2851** (RUNBOOK §6 table + round note, node mirror 683→691, ROADMAP suite line, PLAN-round31 status, `src/README.md` ledger). No golden moves.

## Verification

* `analysis` **691/0** green in-harness at the freeze (one self-caught build error: the test import re-declared three already-imported names — fixed, no code touched).
* `e76_demean_tool.js` (new, **4/4 PASS**, registered in `run_all.js`, artefact written): raw book 4.92/1.47/+0.122 (F-03 baseline exactly), demeaned 0.56/14.63/−0.093 (in the 0.39–0.60 band, no edge manufactured). The demeaned Sharpe differs from e2's −0.021 in level (−0.093) — a window-composition difference (9600-bar truncation vs e2's full panel), same ≈0 statement the band was pre-registered for; not a defect.

## Lab effects

* FINDINGS **F-87**. FOLD-BACK R5 closed as a tool port.
* Standing decision recorded in FOLD-BACK: driver wiring (an A/B flag scoring demeaned arms) lands with the first edge-carrying user, not preemptively — the report half already exists (R25-1 dependence block in `poolReports`).

## Next

* Round 46: W4a design — the `MemoryBank` plugin contract + registry with the default stack bit-identical (PLAN-round31 P0 scope). The cutting-edge structural change: per-plugin goldens replacing the whole-engine freeze.
* Native `npm test` needed after rounds 45–46 (new analysis entry code + new test files).
