# CYCLE-184 — FULL CORE MAP: controllers → deepest core, what works, what's wrong, what to replace (2026-10-02)

No code touched (director order). Research + source-map + plan only.
Research: lab sweeps 10r–10u + round-29 notes re-read against the source map below.

## L0 — candle stream → indicators → feature rows

`candle_quality` (winsorize) → `hivemind/indicatorProcessor.js#compute`
(RSI-14, MACD 8/21/5 diff, ATR-14, EMA-100, Stoch 14/3/3 diff, Bollinger-20 %B,
OBV, ADX-14, CCI-20, Williams %R-14; needs ≥11 bars, fail-closed `{error:true}`)
→ `hivemind/controller/features.js#_extractFeatures`:
tier-1 = robust-normalized indicator rows (`_robustNormalize`, 5–95 pct clip);
tier>1 interleaves child-memory rows. `_computeProtoQuality` scores prototypes
for the memory path. Dim choice: `_trainingCandleSize × _trainingIndicators`
(best-fit search, `features.js:285`).

## L1 — controller (one per group/section/layer/tier/direction slot)

`hivemind/hiveMindController.js#getSignal` (176–405): drain opens
(`_updateOpenTrades`, entry-timestamp guard R26-0, true elapsed bars R27-4b),
compute indicators → features, ATR-bracket targets
(`atrFactor/stopFactor`, min/max movement clamp, `price_precision` dp),
`hivemind.predict(features)` → prob×100 (fail-closed −1 abstention, #46),
open one trade (duplicate-timestamp guarded R26-0), drain up to `processCount`
closes (`_processClosedTrades`), broadcast/translate memory, throttled
`dumpState` (R26-12), emit `sanitizeSignal`. Labels: `controller/trades.js`
optimistic (TP-first, no expiry) / conservative (stop-first, worst-price gap
fill) / triple (+time barrier `_labelHorizonBars`); FIFO drain `processCount=1`;
accuracy ledger (wins/losses, Brier vs base rate, held-bars distribution).

## L2 — mind (ensemble shell)

`hivemind/hiveMind.js`: `es` members (default 4). `predict` = member forward →
`ensemble/scores.js` weighting → scalar prob. `train` = gradient accumulation +
`training/gradients.js` scaling + apply → `_distillKnowledge` → rollback →
re-apply sandwich per reset window (`hiveMind.js:168–175`). Rejects bad rows
without corrupting step count (#46). `persistence/` SQLite save/load
round-trips golden-pinned. `ensemble/homeostasis.js`, surprise gate,
multi-probe/BinaryPC/querymod all default-OFF (golden-identical when off).

## L3 — transformer block (the "small transformer")

`transformer/forward.js#_processTransformer` + `transformer/attention.js#_multiHeadAttention`
+ `kernels/*`: Llama-style block (RMSNorm → MHA with RoPE on Q/K → residual →
RMSNorm → SwiGLU-ish gated FFN → residual), every Q/K/V + gate/up/down
projection tiled-multiplied by a per-member specialization weight matrix
(BatchEnsemble flavour, `_getSpecWeightMatrix` + expansion cache). Readout:
**mean-pool over `inputSize` positions → single linear `outputWeights`
(H×1) → sigmoid prob** (`persistence/dimensions.js:203`). Forward numerics
golden-pinned; fail-closed zeros on bad shapes.

## L4 — memory (4 banks + LSH + consolidation)

`memory/banks.js` (episodic/adaptive/semantic/core) over
`memory/lsh.js` random-hyperplane index; **LIVE reader is
`memory/retrieval.js#_retrieveTopRelevantProtos`** (direct bucket probe);
`_getGlobalLSHCandidates` (multiprobe `multiprobe.js` / BinaryPC
`binarypc.js`+`bitweight.js` / querymod `querymod.js`) serves ONLY
`knowledge/transfer.js#broadcastMemory`, whose result `getSignal` DISCARDS
(#44) — the upgrades are wired to a dead path. `memory/consolidation.js`
promote/evict, `memory/surprise.js` gated writes (off), replay every-N
(`banks.js:517–518`).

## L5 — legion (collective aggregation)

`legion/signals.js`: `collectAndEnrichSignals` (prob, score, tier/vault/hierarchy
features) → `computeDynamicWeights` (mem/child/tier/vault/perf/hierarchy
multipliers) → `propagateInfluence` (top-30% seeds, priority-queue spread) →
`hierarchicalAggregate` → consensus direction. `legion/runner.js`+`workers.js`
pool + watchdog (P0), `legion/batch.js` fault isolation + vault,
`legion/accuracy.js`, `broadcast.js` (dashboard/SSE), `sanitize.js`, `rng.js`.

## L6 — evolution (unwired)

`legion/evolve.js`: low-rank ES (Salimans + EGGROLL framing), pure, proven
monotone-fitness invariant on convex toy. **Nothing imports it.** Wire-up is
M5, gated behind a positive-skill learner (never evolve noise).

## Verdicts

**WORKING (keep, locked):** indicator math; `_robustNormalize` + fail-closed
predict/train (#46); Q/K/V + FFN + RoPE numerics (golden); SQLite
persistence/round-trip; worker pool + watchdog + fault isolation (P0);
observer dashboard; full `analysis/` battery + A/B + 60-guard audit method
(F-62…F-76 pattern: closed-form + seeded ensemble + 2.5-SE band).
Weights update correctly — they learn nothing about direction (target
constraint, not a training bug). Memory machinery runs (≈ baseline).

**OBVIOUSLY INCORRECT (structure, not bug):**
1. Mean-pool readout is order-free at the decision layer — RoPE inside
   attention cannot survive it. The DLinear critique (2205.13504) applies
   verbatim: order-insensitive head on a sequence task.
2. Per-bar from-scratch fitting on ~60-bar windows cannot beat the base rate
   — measured everywhere (controller brierSkill −0.075; linear/MLP ≤0,
   NL-BENCH/G-A). The target as framed (next-bar direction on 8h) is the
   constraint until M1 says otherwise.
3. Distilling a negative-skill teacher (top-30% of a negative-skill ensemble)
   concentrates noise, not signal. Middle/bottom tiers pulled toward a
   teacher with no skill.
4. `_getGlobalLSHCandidates` upgrades serve a discarded broadcast (#44) —
   multiprobes/querymod/BinaryPC/bitweight can never move the scored path
   (M4 wire-or-drop).
5. Legion weighting multiplies six uncalibrated boosts (mem/child/tier/vault/
   perf/hierarchy) with no proper-score discipline — a consensus over
   negative-skill members with confidence-flavoured weights.

**NEEDS SERIOUS TESTING (concrete probes, no build):**
1. `_contextAwareAttention` — what context enters, leakage invariants?
   Probe: returns-only future-shock audit (world.js pattern) on the
   attention inputs.
2. `_computeAttentionWeights`/`_pruneMemory` score reuse — memory decisions
   coupled to attention magnitudes; probe: shuffle-scores ablation.
3. Distill-target quality — probe: distill toward uniform/base-rate teacher
   vs top-30% teacher; if uniform wins, the sandwich is harmful.
4. FIFO entry-to-training age (TODO 62) — drain lag still unmeasured; probe:
   heldBars distribution vs horizonBars (ledger already counts it).
5. `_getGlobalLSHCandidates` reachability — M4: route or PARK.
6. Sample-weights under triple label — #54 re-run owed (harmful + confounded
   by LR).
7. Trust/specialization/fractal-dim scaler vs plain AdamW+clip — A17
   retire-test (ablation, never run).
8. Sandwich apply→distill→rollback→re-apply vs plain apply — contribution
   never tested; probe: disable distill, compare Brier on frozen folds.

**REPLACEABLE BY PROVEN DESIGNS (grounded, gated):**

| current | replacement | grounding | gate |
|---|---|---|---|
| optimizer stack (spectral clip × 1/255 quant × dual-EMA trust × fractal-dim weights) | AdamW + cosine + global clip, re-baseline | A17; 2002.06715 (cost), 2608.16190 (skill-governs) | ablation: plain must not lose Brier |
| member regulation (trust/specialization scores) | coherence-gated weighting | 2603.14651 (EARCP) | gated ensemble weight A/B |
| adaptation (full fine-tune) | frozen backbone + low-rank adapter | 2411.17900 (LoRA decision transformer); converges with evolve.js low-rank framing + TODO 90 | skill-gated (M5) |
| forecaster class (tiny from-scratch attention) | linear/MLP-mixer first; then TSFM + linear probe | M1 arms; 2609.39386 (TSFM probe); 2508.15922 (linear class) | M1 decision rule |
| vol prediction (raw residual) | frozen-HAR-anchor + gated learned residual | 2608.25369 (PGA-Trans-HAR); e117 keeps raw closed (−0.0090) | positive residual test (M2) |
| denoise (none) | denoise-first hygiene | 2609.27614 | M1 pre-step |
| structure (Hankel/Toeplitz absent) | Hankel-Toeplitz arm in M1 | 2609.33984 | M1 arm |
| zero-shot baseline | TSFM-vs-HAR design | 2607.05291 | M1 arm |
| consensus weights | proper-score-weighted (Brier-skill) aggregation | forecast.js DM/MCS layer already in tree | M1 metric layer reuse |

**Research re-sync (this round):** 10r/10s/10t/10u already banked
(perp-funding 2608.0xxxx; liquidation/survival 2608.03616/2607.27070/
2606.15715/2602.15182; TS-linear/HAR 2508.15922/2507.22409; online-learning
2603.14651/2609.3xxxx). No new sweep needed — the groundings above are
already cited; next sweep only when M1 executes (TSFM/denoise deltas).

## Handoff — exact next steps for future iterations

1. **M1 execution (FIRST):** standalone `m1_benchmark.js` (not in run_all),
   pre-registered arms (base / DLinear / Hankel-Toeplitz / MLP-mixer /
   zero-shot-TSFM-vs-HAR / controller-as-is) on SAME walk-forward +
   proper-score/DM/MCS (reuse `analysis/forecast.js` + `reality_check.js`
   subsampling SPA). Hygiene: denoise first. Rule: none-beats-base →
   TARGET constraint (stop tuning architectures); linear-beats-controller
   → ARCHITECTURE constraint (retire the tiny transformer as forecaster).
2. **M4 in parallel:** route multiprobes/querymod/binarypc/bitweight through
   `_getGlobalLSHCandidates` into the LIVE reader, or mark PARK. Small.
3. **M3 after M1:** execution-uses data spec (exact L2/trade/latency needs +
   pre-reg bps/fill gate) to unlock e115's (a)/(b) uses.
4. **S6e (allocation track):** survival-cap DESIGN (maxDD leverage + funding-
   spike/basis-gap stress, grounded 10s) — meets the model track at sizing
   (vol forecast ↔ S6c L≤10 interim).
5. **Gated (do NOT start):** M2 (needs positive residual test), M5 (needs
   positive-skill learner + own A/B), M6 (needs M1 skill + 91/92).
6. **Non-goals restated:** directional tournaments, meta-labelling,
   walk-forward λ, evolving noise.

No operator load owed. No code touched this round.
