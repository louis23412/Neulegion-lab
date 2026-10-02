# CYCLE-193 — controllers-to-core map v2: code-verified, research-judged (docs-only, 2026-10-02)

No code touched. No data pulled. No operator load. This cycle re-walks the
CYCLE-184 map against the actual source (every anchor below was read, not
remembered) and judges each piece against research, so future code work
starts from verified facts. It CORRECTS three CYCLE-184/192 statements.

Core idea (unchanged): an evolutionary hivemind of small transformer
controllers that collectively trade a candle stream.

## Corrections to prior records (read these first)

1. **C3 reframed.** `_retrieveTopRelevantProtos`
   (`hivemind/memory/retrieval.js:45`) **is already the live scored reader**
   — the code says so (`retrieval.js:34-44`, R27-2) and
   `_contextAwareAttention` (`transformer/attention.js:192`) calls it on the
   scored path. The dead path is ONLY `_getGlobalLSHCandidates` →
   `broadcastMemory` → discard (#44). So C3 is NOT "route the read" — it is
   **wire multiprobes/querymod into the LIVE reader, or delete the
   broadcast**. PLAN C3 row must be reworded accordingly (done §6).
2. **Sandwich clarified** (`hivemind/hiveMind.js:168-184`): apply scaled
   grads (clone) → fresh forward → distill → rollback → apply unscaled ÷1 →
   forward → memory sharing → reset accumulation. Net per reset window: ONE
   scaled task update + the KD update; the apply/rollback pair only
   materialises scaled grads into the clone. Convoluted but not
   double-counting — simplification candidate, zero behavior change.
3. **Optimizer named.** `_accumulateGradients` + `_applyGradients` is plain
   **SGD** (per-member rank-adaptive LR, no moments, no schedule, no decay)
   under the spectral-clip × 1/255-quant × dual-EMA × fractal-dim scaler.
   C2 (AdamW + cosine + global clip) is therefore a strict upgrade in
   optimizer class, not a lateral move.

## The map (signal order, with verdicts)

### S0 — stream in, trades out (`hivemind/hiveMindController.js#getSignal`, 176-391)

Drain → indicators → features → ATR-bracket targets → `predict` → prob×100
(fail-closed −1) → open one trade (dup-timestamp guarded) → drain closes →
broadcast/translate (discard path) → throttled dump → `sanitizeSignal`.
Emitted `score = (tradeWinAcc + trueAcc)/2` — an accuracy-ledger blend, not
a proper score. **WORKING shell** (goldens pin it); the score definition is
INCORRECT-as-input-to-weighting (see S6).

### S1 — features (`controller/features.js`, `indicatorProcessor.js`)

`_robustNormalize` (5–95 clip), tier-1 indicator rows, tier>1 child-memory
interleave, `_computeProtoQuality`, best-fit `_trainingCandleSize`
(`features.js:285`). **WORKING, KEEP.** Only caveat: interleave gives
memory rows equal footing with market rows by construction — revisit only
if C1/C2 produce skill (gating, not redesign).

### S2 — labels + ledger (`controller/trades.js`)

Optimistic (TP-first) / conservative (stop-first, worst-price) / triple
(+time barrier); FIFO `processCount=1`. **KEEP triple + conservative as
the honest pair** (L08 e25 grounds conservative); optimistic is a
known-flattering control, never a training label. Drain age (TODO 62):
**PROBE** — read heldBars vs horizonBars before any drain change.

### S3 — transformer block (`transformer/forward.js:120-189`, `attention.js`, `kernels/*`)

Llama-style block, BatchEnsemble spec weights, exact hand-derived backward
(softmax Jacobian, RMSNorm backward — **KEEP numerics**). Readout
(`forward.js:156-185`): **mean-pool over positions → linear + bias** —
**INCORRECT, C1-FIRST** (2205.13504 DLinear: order-free head on a sequence
task; RoPE cannot survive it). Class verdict stands per M1 phase-1:
from-scratch small nets ≡ base (ARCHITECTURE fires); linear/mixer-first,
then TSFM probe (2508.15922, 2609.39386, 2303.06053/2306.09364).

### S4 — scores economy (`ensemble/scores.js` — read whole file this cycle)

- `_updatePerformanceScores`: performance = 1 − Brier, EMA 0.1.
  Proper-score ROOT, correctly chosen (Gneiting & Raftery 2007).
- `_computeSpecializationScores`: rewards |z| deviation × performance —
  a DISPERSION reward (CYCLE-185 mechanism confirmed in code).
- `_adjustPerformanceScores`: 0.6 perf + 0.4 trust-history blend —
  dilutes the proper score with reputation.
- `_updateEnsembleWeights`: trust-history × (0.8 + 0.2 spec-boost) —
  final weights are NOT proper-score weights.
- `_updateAdaptiveLearningRates`: rank-based, LR ∈ ±50%; BELOW-threshold
  members get LR *increased* (laggard rescue).
- `_updateTrustScores`: z-scored perf × agreement × trend × spec-boost
  through sigmoid — four uncalibrated boosts.

**Verdict: REDESIGN (after C1).** Keep the Brier root; replace the
weighting with Brier-skill weights (Hedge / exponential weights —
`forecast.js` DM/MCS layer already in-tree is the referee). **PROBE:**
laggard-rescue LR (does boosting bad members help or inject noise?);
agreement-weighted trust (herding pressure at zero skill).

### S5 — training (`training/gradients.js`, `distillation.js`, `hiveMind.js:143-184`)

- SGD, no moments/schedule/decay → **C2 (AdamW + cosine + clip)**.
- `_scaleGradients`: spectral-clip × 1/255 quant × dual-EMA trust ×
  fractal-dim component weights — ungrounded stack → **retire-test, delete
  on no-Brier-move**.
- `_distillKnowledge`: teacher = top-30%-by-performance blend, T=2.0, KD
  scale 0.2, momentum 0.9, full-block backprop for bottom tier. Hinton KD
  (1503.02531) assumes a SKILLED teacher; multi-teacher work (2609.18686)
  assumes DIVERSE-SKILLED teachers. Ours are neither → **PROBE first:
  uniform/base-rate teacher vs top-30%; uniform wins → delete the sandwich
  KD, keep the batched task update**.
- `agreement_dL` auxiliary (`gradients.js`): `dL·w·(out − ensemble)` pushes
  members toward CONSENSUS regardless of target correctness — herding at
  zero skill → **REDESIGN candidate: skill-gate or remove**.
- `_accumulateGradients` math itself: exact, KEEP.
- `sample_weights.js`: exact LdP ch.4, bit-equal twin; **KEEP math, PROBE
  use under triple labels (#54 re-run owed)**.

### S6 — memory (`memory/*.js`, `knowledge/transfer.js`)

Live reader (`retrieval.js:45`) wired via `_contextAwareAttention` —
**KEEP machinery**. `explorationRate = 0.35 + 0.65(1−perf) +
0.45(1−agree) + 0.8·overconfidence` can reach 2.25, and overconfidence
*increases* exploration spend — **PROBE** (inverted incentive?).
`_getGlobalLSHCandidates` + multiprobes/querymod/binarypc/bitweight serve
only the discarded broadcast — **PARKED** (each proven correct alone; M4
recorded multiprobes as probe-of-choice). `broadcastMemory` builds a real
candidate set `getSignal` discards — **C3: wire upgrades into the LIVE
reader or delete the broadcast** (reframed per correction 1).

### S7 — legion decision (`legion/signals.js:86-175`)

`base = prob × score × perfBoost` (prob already confidence; score is the
S0 accuracy blend — confidence counted twice), then × memNorm × childNorm
× tierNorm × vaultBoost × hier × perfBoostFactor — six uncalibrated
boosts. Seeds = top 30% by this weight (noise seeds at zero skill).
`propagateInfluence`: asymmetric tierBonus 1.4/0.6 (ungrounded hierarchy
prior); `finalWeight = 0.7·weight + 0.3·boosted`. **REDESIGN (after skill):
Brier-skill-weighted aggregation; seeds skill-ranked or the spread is
noise propagation.** P0 infra (runner/workers/batch/sanitize/rng):
**KEEP**.

### S8 — evolution (`legion/evolve.js`)

Low-rank antithetic ES, exact quadratic identity, monotone toy fitness.
**KEEP pure; M5 wire-up stays GATED behind a positive-skill learner**
(never evolve noise — EGGROLL-v2 adds finite-population caution per
CYCLE-185).

## Research appendix (what grounds each REDESIGN; all already banked)

| redesign | grounding |
|---|---|
| C1 ordered readout | 2205.13504 (DLinear order critique); 2508.15922 (linear class) |
| C2 AdamW + cosine + clip | 2002.06715 (decoupled decay cost); standard practice; current opt is moment-free SGD |
| skill-weighted aggregation | Gneiting & Raftery 2007 (proper scores); Hedge/multiplicative weights; in-tree `forecast.js` DM/MCS |
| uniform-teacher probe | 1503.02531 (KD needs skilled teacher); 2609.18686 (multi-teacher needs skilled teachers) |
| linear/mixer-first, TSFM probe | M1 verdict + 2609.39386, 2401.03955 (TTM), 2403.07815 (Chronos) |
| M5 population rule | 2609.10980 (EGGROLL) + v2 nonconservative-mean-field caution; 1703.03864 |
| coherence-gated weighting (later) | 2603.14651 (EARCP) |
| frozen backbone + LoRA adapter (later) | 2411.17900 (LoRA decision transformer) |

New research needs (only when code track advances): ordered-readout
ablation results on time-series transformers (post-C1); Hedge-vs-Bayesian
model averaging for tiny ensembles (pre-S7-redesign); ES population-size
rules at N≤8 (pre-M5).

## Handoff

Live queue unchanged in order, C3 reworded: **C1 readout-head → C2
optimizer/spec retire-test (+ uniform-teacher + agreement-gradient
probes) → C3 upgrades-into-live-reader or delete-broadcast**. Each with a
test script + golden re-freeze record. §S4/S5-probes ride along with C2
(same files, same gates). S7-redesign and M5 stay behind skill.

No operator load owed. No code touched this round.
