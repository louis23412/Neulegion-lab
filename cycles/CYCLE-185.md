# CYCLE-185 — ONE LEVEL DEEPER: the regulation layer + fresh research deltas (2026-10-02)

No code touched (director order). Source read + 3 arXiv queries (sweep 10v) + plan only.
New view vs CYCLE-184 (which mapped L0→L6): this round opens the boxes 184
left closed — the per-member regulation layer, the broadcast dead path, the
norm/position kernels — and refreshes the three load-bearing citations.

## 1. The regulation layer (new read: `ensemble/scores.js`, `training/gradients.js`)

Per member, three scores interact every step:
- `_specializationScores` = sigmoid(|z-output|) × (0.5+0.5·performance) —
  rewards being DIFFERENT, scaled by being good. No skill → rewards
  confident noise (z is dispersion, not edge).
- `_performanceScores` = 0.9·old + 0.1·(1−Brier) — 10%-update EMA toward the
  base rate when skill is zero; the whole trust/gradient apparatus then
  amplifies 10%-per-step noise differences between members.
- `_agreementScores` (|p_i − p_final|) feed the ensemble weights.
The spec-weight modulation (`_getSpecWeightMatrix`, tiled into EVERY Q/K/V +
FFN projection) is therefore a BatchEnsemble-style multiplier whose
discriminator is noise when skill is zero: members differ, get rewarded for
differing, and modulate every projection with the difference. This is the
mechanism behind D-21's "distilling a negative-skill teacher concentrates
noise" — the teacher IS the noise-amplified top-30%.
**Retire-test (A17) sharpens to:** freeze spec modulation to identity +
plain AdamW + clip; if Brier does not move, delete the entire
trust/specialization/fractal-dim stack (it is ~100 lines of scoring that
score randomness).

## 2. The broadcast dead path, quantified (new read: `knowledge/transfer.js`)

`broadcastMemory` builds a real candidate set (priority indices + core protos +
context query when inputs are finite, target ≥4 protos at 2.5% ratio) and calls
`_getGlobalLSHCandidates` — then `getSignal` adds the result's counts to
`memoriesSent` and DISCARDS the memories (`translateMemory` path, #44).
So the multiprobes/BinaryPC/querymod/bitweight upgrades (all default-off,
all golden-identical when off) are doubly dead: off by default AND consumed by
a discard path. M4's wire-or-drop now has its acceptance stated: route the
candidate set into `_retrieveTopRelevantProtos` (the LIVE reader) with recall
measured on a seeded wide-hash index (multiprobe.test.js 0.033→0.30 pattern),
or PARK all four files. No third option.

## 3. Kernels: exact, keep (`kernels/normalization.js`)

RMSNorm + RoPE read as textbook implementations with fail-closed shape guards
(zeros on mismatch — the same abstention philosophy as #46). No finding; they
stay in the WORKING column. RoPE's contribution is still voided downstream by
the mean-pool readout (D-21 stands — the fix is the head, not the positions).

## 4. Fresh research deltas (sweep 10v, raw XML in `scratch/sweep-10v-*.xml`)

- **TSFM-probe CONFIRMED (10v-tsfm):** 2609.39386 — linear probes of six
  frozen backbones beat their backbone's point forecast in **29/30**
  backbone–dataset pairs (sparse-event ranking). The M1 "zero-shot-TSFM vs
  linear-probe" arm pair is now a two-line prediction: probe ≥ backbone.
  Gate: if probe ≤ backbone on our walk-forward, the data regime (dense 8h
  candles, not sparse events) is the reason — record it, do not tune.
- **EGGROLL v2 caution (10v-es):** 2609.10980v2 — low-rank ES recovers the
  gradient EXACTLY on quadratics at every rank/radius (evolve.js invariant
  survives), BUT the finite-rank mean field can be nonconservative / flip
  optimum stability, with extra finite-population sampling variance at
  rank one. M5 gate gains a population-size rule: antithetic + rank ≥ 1 with
  backtracking line search (already in `evolve.js` DEFAULT_ES_CONFIG) AND a
  seeded quadratic convergence check at the CHOSEN population before any
  member-parameter evolution. Never evolve noise (restated).
- **AdaRDiff candidate (10v-readout):** 2608.28134 — adaptive reversible
  differencing (learnable weighted differencing → forecast residuals →
  restore). This is a preprocessing arm for M1-adjacent work: stationarize
  BEFORE the linear arms. Queued as M1-ext (only if M1 shows linear-beats-
  controller — differencing then tests whether the gap is nonstationarity).
- **Attention-pooling query returned 0 results** (exact-phrase AND) — no
  grounding claimed for learned-pooling readout; the replacement remains the
  M1 decision rule (last-position / linear head tested as arms), not a
  literature swap.

## 5. Work orders for future iterations (start here)

1. **M1 execution (FIRST, unchanged):** standalone `m1_benchmark.js`, arms +
   rule per CYCLE-183/184. Add TSFM-probe expectation (probe ≥ backbone,
   29/30 prior) and M1-ext trigger (linear-wins → AdaRDiff arm).
2. **M4 (parallel):** acceptance above (§2) — recall-measured route or PARK.
3. **A17 retire-test (new precision, §1):** identity-spec + AdamW + clip
   ablation; delete on no-Brier-move.
4. **M3 after M1:** L2/trade/latency spec + pre-reg bps/fill gate (unlocks
   e115 a/b).
5. **S6e (allocation track):** survival-cap DESIGN; meets model track at
   sizing (vol forecast ↔ S6c L≤10 interim).
6. **GATED:** M2 (positive residual test), M5 (+ M5 population rule above),
   M6 (M1 skill + 91/92). **NON-GOALS:** directional tournaments,
   meta-labelling, walk-forward λ, evolving noise.

No operator load owed. No code touched this round.
