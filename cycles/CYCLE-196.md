# CYCLE-196 — pre-C1 pooling brief + consolidation scoring audit (docs-only, 2026-10-02)

No code touched. No data pulled. No operator load. Direct homework for the
queued code track: what the pooling literature says C1 must test, and an
audit of the score function every prune/keep/promote decision rests on.

## Pooling brief (2510.03339 abstract read; full text = pre-C1 homework)

*Pool Me Wisely* gives closed-form bounds on transformer pooling
expressivity (capacity + input-distinguishability) across attention
variants, evaluated on vision, language, AND time-series tasks, with
task-specific selection guidance. Combined with 2610.01831 (uniform beats
learned in ICL), C1's A/B/C is literature-shaped: the choice is
task-dependent and learned is not the default. The paper's time-series
section may name the head form outright — reading it is the first step of
C1, recorded here so it is not skipped. Raw: abstract in
`scratch/paper-pool-me-wisely.txt` (abs page only).

## Consolidation scoring audit (`memory/consolidation.js` — read this cycle)

`_computeMemoryScoreFromProtos` (442-597) = six-term weighted sum
(0.25 variance + 0.15 cluster-diversity + 0.15 sparsity + 0.15 magnitude +
0.10 attention-sharpness + 0.15 access; weights sum 0.95) ×
(1 + 0.25·perf·spec) × (uniqueness+0.5)^1.5 × diversity ×
exp(−0.03·age)·(1+1/(1+age/5)). Every constant is unvalidated: term
weights, sparsity target 0.5, uniqueness exponent 1.5, recency rate 0.03.
**PROBE (post-skill or free with C2 harness): weight-perturbation
sensitivity — if prune/keep/promote rankings flip under ±20% weight
changes, memory dynamics are arbitrary and the scorer needs grounding or
removal.** Asymmetry noted: attention-sharpness scores ONLY the latest
entry (others pass null) — recency is double-counted (forced-recent slice
already keeps latest). Minor; fold into the same probe.
Merge threshold (`consolidation.js:26-35`): ADAPTIVE (base 0.73 + capacity
factor, −overload/disagreement pressure, +stagnation/drop, clamped
0.40–0.92) — **KEEP mechanics**; rare example of a self-tuning constant.
Trim/prune floors (`_mergeTrimFactor`, access floor 2.0) conventional.

## Standing pool of free/cheap probes (all same-harness, ride with C2)

tier>1 skill · quality-sort vs random · uniform-teacher · agreement-gate ·
promotion-sign flip · laggard-LR · scorer weight-perturbation · EMA-100
drop · drain-age read · #54 sample-weights. Post-skill only: validation
dims, window sweep, S7 hedged combination, donor re-rank, leakage recipe
(pre-trust gate for post-C1 A/Bs).

No operator load owed. No code touched this round.
