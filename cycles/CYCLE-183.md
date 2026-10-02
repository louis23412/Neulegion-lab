# CYCLE-183 — CORE READ: per-component verdicts from the source (2026-10-02)

No code touched. Read: `hiveMind.js` (predict/train), `transformer/`
(forward + attention), `training/gradients.js`, `controller/features.js`
+ `trades.js`, `legion/*` map. Research: 10u (5 grounded) + README line.

## What the "transformer" actually is (measured from source)

A Llama-style block (RMSNorm → MHA with RoPE on Q/K → residual → RMSNorm
→ SwiGLU-ish gated FFN → residual) with a **specialization-weight
modulation tiled into every Q/K/V and gate/up/down projection**
(BatchEnsemble-flavoured per-member modulation), trained with gradient
accumulation + an odd **apply → distill → rollback → re-apply** sandwich
per reset window. Readout: **mean-pool over positions → single linear
output** (prob). Predict is fail-closed (NaN on bad input → controller
−1 abstention, BUGS #46). Training rejects bad rows without corrupting
the step counter (#46). This is real, careful engineering around a void
target.

## Per-component verdicts

* **WORKING (keep):** Q/K/V + FFN math (golden-pinned), RoPE positions,
  fail-closed predict/train, SQLite persistence + round-trip, worker pool
  + watchdog + fault isolation (P0), dashboard/SSE observer, the whole
  `analysis/` battery + A/B + audit (best-in-class harness).
* **SUSPECT — complexity without a measured contribution (retire-test
  candidates, A17):** the trust/specialization/fractal-dimension gradient
  scaler (`gradients.js`: spectral-norm clip × 1/255 quantization ×
  dual-EMA trust × fractal-dim component weights) — no ablation shows any
  of it beats plain AdamW + clip; the apply→distill→rollback→re-apply
  sandwich — pinned but never contribution-tested; `_hiveMemorySharing`
  broadcast (off the scored path per #44); sample-weights (harmful under
  triple label, confounded by LR — #54 re-run owed).
* **INCORRECT-AS-DESIGNED (structure, not bug):** mean-pool readout is
  order-free at the decision layer even with RoPE inside attention —
  the DLinear critique (2205.13504) lands here directly; per-bar
  from-scratch fitting on ~60 bars cannot beat the base rate (measured
  everywhere: controller −0.075, linear/MLP ≤0).
* **NEEDS SERIOUS TESTING:** `_contextAwareAttention` (what context, what
  leakage invariants?); `_computeAttentionWeights`/`_pruneMemory` (scores
  reused for memory decisions — coupling untested); `_distillKnowledge
  target quality (distilling a negative-skill teacher); the FIFO
  entry-to-training age (TODO 62 — the drain lag is still unmeasured);
  `_getGlobalLSHCandidates` reachability (the A24 wire-or-drop).
* **REPLACEABLE by proven designs (grounded):** optimizer stack →
  AdamW + cosine + clip, then re-baseline (A17; 2002.06715 cost,
  2608.16190 skill-governs); member regulation → coherence-gated
  (2603.14651 EARCP) instead of trust/specialization scores;
  adaptation → frozen backbone + low-rank adapter (2411.17900 LoRA
  decision transformer; converges with evolve.js low-rank framing and
  TODO 90); forecaster class → linear/MLP-mixer first (M1), TSFM +
  linear probe (2609.39386); vol residual → frozen-HAR-anchor + gated
  residual (2608.25369) instead of raw residual prediction (which e117
  correctly killed at −0.0090).

## Fleshed M1 spec (TODO 86; next execution)

Arms on the SAME walk-forward + proper-score/DM/MCS layer: base rate,
DLinear, Hankel-Toeplitz (2609.33984), MLP-mixer, zero-shot TSFM (tested
vs HAR per 2607.05291), controller as-is. Hygiene first: denoise
(2609.27614). Decision rule stands (none-beats-base → target constraint;
linear-beats-controller → architecture constraint). New standalone file
`m1_benchmark.js` (not in run_all), pre-registered arms + rule.

## Next

M1 DESIGN→execution (AI) + M4 (parallel) + M3 spec. S6e continues on the
allocation track. No operator load owed.
