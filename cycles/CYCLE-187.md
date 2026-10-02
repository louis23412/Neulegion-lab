# CYCLE-187 — M1 phase 1 executed: linear beats base (tiny), MLP ≡ base, persistence dies (2026-10-02)

**Vehicle:** `experiments/m1_benchmark.js` (standalone, not in `run_all.js`;
result `scratch/m1_result.json`). 3/3 checks, minutes. Pre-registered DESIGN
in its header + CYCLE-183/184.

## Coherency pre-check

PLAN M1 SPEC-DONE + CORE-MAPPED; repo `forecast/scoring.js` DM/MCS
signatures confirmed (`resampling.js`); lab `buildPanel({symbols, tf})`
options-object form + prepared `closes` (plural) confirmed against
`lib/lab.js` (two harness errors fixed at build: call form, field name).
Proceeded.

## M1 phase 1 measurements (8 majors, 6682 8h bars, 53,316 pooled test rows, 6 blocks)

| arm | Brier | skill vs base | DM vs base | MCS |
|---|---|---|---|---|
| base (expanding prior) | 0.25000 | — | — | eliminated (step 1) |
| ridge (DLinear, own intercept) | 0.24906 | +0.0038 | p≈0.001 fav A | SURVIVES |
| toeplitz-tapered ridge | 0.24906 | +0.0038 | p≈0.001 fav A | SURVIVES |
| ridge on EMA inputs | 0.24909 | +0.0037 | p≈0.001 fav A | SURVIVES |
| mlp (P-6-1, seeded, 80ep) | 0.25002 | −0.0001 | p=0.76 fav B | eliminated (step 2) |
| persistence | 0.34419 | −0.377 | p≈0.001 fav B | eliminated (step 0) |

* Hygiene FIRST: raw 0.24906 vs EMA 0.24909 — denoise is a no-op here
  (recorded, not tuned further).
* Ridge guard: independent normal-equation solve matches to exactly 0
  (the L10-bl avoidance is structural, not asserted).

## Director's M1 phase-1 verdict (pre-registered rule, applied)

* none-beats-base? NO — all three linear arms beat base at p≈0.001. But
  skill +0.0038 is economically ~nil: TARGET nearly-binding (direction on
  this frame holds a whisper, not an edge).
* linear-beats-controller? Controller arm is phase 2 (native). Decided now:
  linear-beats-MLP decisively (MLP ≡ base, p=0.76, MCS-eliminated while all
  linear arms survive) → ARCHITECTURE constraint fires against from-scratch
  small nets, converging with NL-BENCH/G-A. The controller's tiny
  transformer (same-or-weaker class + mean-pool readout) cannot be expected
  to beat ridge on this frame.
* M1-ext (AdaRDiff) trigger met mechanically (linear-wins) but queued LOW:
  differencing cannot manufacture edge from +0.004 skill.
* Phase 2 queued (native/operator): zero-shot-TSFM-vs-HAR arm (no weights in
  this environment; probe≥backbone prior 29/30 from 10v) + controller-as-is
  arm (needs better-sqlite3 A/B).

## Bug + sanity sweep (touch set)

* Two build errors caught by the harness (call form, field name), fixed,
  re-run green; no repo files touched; standalone; no golden moves.

## Research sync

No new sweep (10v carries M1: probe prior, EGGROLL-v2, AdaRDiff). Next sweep
with M4 (LSH/recall literature) or phase-2 TSFM deltas.

## Next

M4 probe (model track, parallel): lab-side recall measurement of
`_getGlobalLSHCandidates` upgrades vs the LIVE reader — route or PARK on the
number. Then M3 spec. Operator queue when phase-2/native work stacks up.
