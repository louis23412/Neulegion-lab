# CYCLE-197 — C1 readout A/B/C EXECUTED: order does not matter, C1 closed (2026-10-02)

Execution phase opened (PLAN). Pre-C1 coherency GREEN: 197/197 cycle
files, 181 finding rows to F-181, INDEX complete, 146 experiment files
(1-count doc drift corrected: 139 run_all + 7 named). C1a executed same
cycle through the harness.

## C1a result (`experiments/c1_readout.js`, artefact `scratch/c1_result.json`)

53,316 pooled rows, 6 blocks, same frame as M1. Brier: base 0.25000 /
meanpool 0.24995 / lastpos 0.24994 / learned 0.24995 / flatridge 0.24906.
Skills vs base: scalars +0.0002, flatridge +0.00378 (reproduces M1).

- lastpos vs meanpool DM p=0.925 — ORDER DOES NOT MATTER at this frame.
- learned-pool GD collapses to EXACTLY uniform (16 × 0.0625) — learned
  weighting finds nothing, stronger than 2610.01831's suspicion.
- MCS survivor: flatridge ALONE; base + all three scalars eliminated.

## Verdict (pre-registered rule fires)

No ordered head beats mean-pool → the readout is NOT the binding
constraint. **C1 CLOSED with no repo edit** — implementing last-position
would move goldens for zero gain. Position-specific linear weights
(flatridge whisper +0.0038) beat every single-scalar head, which converges
with M1/ARCHITECTURE: the constraint is TARGET/class, not aggregation.
Learned-pool recorded as a dead end on this frame (uniform collapse).

## Handoff

C2 is now QUEUED-FIRST: optimizer/spec retire-test (identity-spec + plain
AdamW + cosine + global clip vs the trust/spec/fractal stack; delete on
no-Brier-move) with the same-harness probe pool (uniform-teacher,
agreement-gate, promotion-sign, laggard-LR, scorer-perturbation, EMA-100
drop, drain-age read, #54, tier>1 skill, quality-sort). C2 CANNOT run in
this environment if it touches the repo trainer (needs better-sqlite3 +
weights) — default plan: lab-harness probes where possible; repo-trainer
A/B ships as an operator script with proof-back.

No operator load this cycle. Lab files only; no repo touched.
