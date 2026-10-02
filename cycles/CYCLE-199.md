# CYCLE-199 — C2 native script bug + sanity audit (director, pre-proof)

Operator asked: full bug/sanity check on `scripts/c2-ablation.mjs`,
`scripts/c2-optimizer-ablation.sh`, `experiments/c2_probes.js`; is the
result data sufficient; upload vs paste; exact run commands.

## Bugs found and fixed (c2-ablation.mjs only)

1. CRITICAL — Adam walker never descended the weight tree. `rec(a[k], w,
   dottedKey)` kept the PARENT container and wrote `w["0.1"]`-style junk
   keys. All 2D matrices (Wq/Wk/Wv/Wo, gate/up/down_proj,
   specializationWeights) would have received ZERO real updates while
   sprouting garbage string-keyed properties. Only 1D vectors updated.
   FIXED: `rec(child, parentW, parentU, key, momentId)` descends all three
   trees together.
2. CRITICAL — Adam clone semantics mismatched stock. Script returned
   `structuredClone(accumulation)` (RAW grads); stock returns the APPLIED
   updates (`acc/steps`), which `_rollbackGradients` adds back. Rollback
   would have added back ~steps× too much, corrupting weights every
   sandwich. FIXED: arm builds the applied-update clone via
   `_setGradientStructure()` filled with per-leaf Adam deltas — same shape
   and meaning as stock's `gradClone`.
3. SIGNIFICANT — Adam fed lr-pre-scaled accumulation as raw gradient AND
   divided lr by steps. Adam is ~scale-invariant in direction, but with
   grads ~1e-4 the eps=1e-8 term dominates and halves steps. FIXED: grads
   normalized by `1/(steps*baseLR)` (accumulation is uniformly baseLR-
   scaled while the rank controller is frozen — verified in
   `training/gradients.js:233` and `training/distillation.js:71`), lr
   schedule no longer divided by steps.
4. MINOR — cosine schedule counted optimizer calls against a sample budget
   (`step/totalSteps` never exceeded ~0.07, so no annealing). FIXED: train
   wrapper counts samples seen; `lr = baseLR*(1+cos(pi*progress))`,
   2×base→0 over the run. Shared `st.t` incremented once per apply call
   (was once per member = 4× bias-correction inflation).
5. MINOR — DM stdout truncated at 200 chars, regularly cutting before
   `pValue`. FIXED: explicit `n/meanDiff/p/favored` lines + UNAVAILABLE
   branch; loss counts printed; FATAL wrapper exits non-zero with stack.
6. MINOR — shell: added `node --version` to each stage for proof context.
   HiveMind name now has a random suffix (same-ms collision guard).

## Interface verification (all green)

- `export default HiveMind`, ctor `(dp, es, is, id, forceMin)`; fresh tmp
  dir → `_scaleAndSetDimensions` new state (load.js:20). No golden moves.
- `_applyGradients(shouldScale, shouldClone, steps)` / `_rollbackGradients`
  / `_setGradientStructure` shapes match the walkers; `outputBias` is
  `[x]` 1-vector — handled.
- `train(x, y, w)` 3-arg; `predict(x)` → probability; rows are len-16 =
  `is=16`. `dieboldMariano({lossA, lossB})` import path re-exported via
  `scoring.js:12`. `marks_8h.json`: 8 symbols × 3655 (`v[0]=null`,
  filtered), `entryKeys={t0,stepMs,nKlines,v}` — script's schema use OK.
- `c2_probes.js`: untouched, already executed green in CYCLE-198. No bugs
  to fix; not re-run (harness side needs no operator action).

## Data sufficiency: YES — output only, no upload

JSON + stdout carry everything the pre-registered rule needs: per-arm
Brier, per-block Briers, all three DM pairs (n, meanDiff, p, favored),
loss counts. Operator pastes back FULL stdout of each stage (plus the two
JSON files live in $OUT_DIR if re-check needed — nothing to upload).

## Rule restated

plain~=stock (DM ns) → DELETE stack. adamw>stock (DM p<0.05) → ADOPT
AdamW. Neither → keep stock, close C2.
