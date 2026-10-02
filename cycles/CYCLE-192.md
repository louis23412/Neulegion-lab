# CYCLE-192 — lab purge + core-code unlock audit (director order, docs-only, 2026-10-02)

No code touched. No data pulled. No operator load issued. This cycle exists
for one reason: the lab had drifted into allocation research, data harvests,
and port queues while the core project — the hand-rolled AI — cannot win and
is therefore the only thing to work on. Everything not serving that is
purged below; every piece of core code is unlocked and judged below.

Core idea (locked wording — the whole plan serves this sentence):

> An evolutionary "hivemind" of small transformer controllers that
> collectively trade a candle stream.

## §1 — purged paths (dead or data-chasing; out of live planning)

| # | Path | Disposition | What is kept |
|---|---|---|---|
| P1 | Allocation track S0–S6e (verdict windows, sleeves, sizing, survival caps) | ARCHIVED | Verdicts stand (S6e L≤5, pinned books, schedules); no further work, no revisit conditions |
| P2 | S6f midcap OI harvest (`scripts/s6f-oi-harvest.sh`) | PARKED | Script kept unused; harvest cancelled; nothing owed |
| P3 | M3 E-a/E-b execution builds (L2/trade/latency-dependent) | PARKED data-blocked | Spec kept (`CYCLE-189.md`); no build, no harvest, nothing asked |
| P4 | M1 phase-2 native arms (TSFM weights + controller-as-is, operator-gated) | PARKED | Phase-1 verdict stands; nothing asked |
| P5 | Operator native run queue (TODO 116/118/117 follow-ups, ports, gates) | CLOSED | Native gate stays CLOSED (134/134); no runs owed |
| P6 | Leads board L01–L19 (allocation-research history) | ARCHIVED | Ledger preserved for provenance; no new leads; L10 core-code rows stay referenced via §2 |
| P7 | FOLD-BACK R1–R9 port queue + round-31/V2 allocation docs | PARKED / out of scope | Ports are not the model; unpark only on a positive-skill learner |
| P8 | Any future "pull data first" plan (OI/L2/fills/latency/funding re-harvests) | BANNED | Data follows a code-designed need with a pre-registered gate, never leads |

Rule for future iterations: if a proposed step does not change the
hivemind's weights, memory, readout, aggregation, or evolution, it does not
belong in the live plan. Data is pulled only to feed a locked code design
with a pre-registered pass/fail gate — never speculatively.

## §2 — core-code unlock checklist (every locked piece, judged)

Verdict key: KEEP (research-backed or exact-audited, locked) · REDESIGN
(structure contradicts research or measurement — scheduled as code work) ·
PROBE (concrete test first, no build) · PARKED (correct but serves no live
path). Groundings reuse CYCLE-184/185 + repo `docs/LOCKED.md` domains.
File paths are `src/`-relative in NeuLegion-master.

### L0 — candle stream → indicators → features (KEEP)

| file | design | backing | verdict |
|---|---|---|---|
| `candle_quality.js` | read-time winsorize of impossible wicks | exact on real flash prints, idempotent (`candles.test.js` 192) | KEEP |
| `hivemind/indicatorProcessor.js#compute` | RSI-14/MACD/ATR-14/EMA-100/Stoch/Bollinger/OBV/ADX-14/CCI-20/W%R-14, fail-closed | standard indicator math; needs ≥11 bars | KEEP (windows are convention, not claims) |
| `hivemind/controller/candles.js` | recent-candle window, entryPrice==close | window + price identity invariant | KEEP |
| `hivemind/controller/features.js` | tier-1 robust-normalized rows (5–95 clip), tier>1 child-memory interleave, `_computeProtoQuality` | exact feature sequence invariant; clip is standard robust scaling | KEEP |

### L1 — controller / trade ledger (KEEP shell, one PROBE)

| file | design | backing | verdict |
|---|---|---|---|
| `hivemind/hiveMindController.js#getSignal` | drain → indicators → features → ATR-bracket targets → `predict` → prob×100, fail-closed −1 abstention | fail-closed behavior pinned (#46, goldens) | KEEP shell |
| `hivemind/controller/trades.js` | optimistic (TP-first) / conservative (stop-first, worst-price gap) / triple (+time barrier) labels; FIFO drain `processCount=1` | triple-barrier literature; conservative is the honest replay (L08 e25) | KEEP triple+conservative as honest; optimistic is a known-flattering control, never a training label |
| drain age (`heldBars` vs `_labelHorizonBars`, TODO 62) | entry-to-training lag unmeasured | ledger already counts it | PROBE: read the heldBars distribution before any drain change |

### L2 — mind / ensemble shell / training (one REDESIGN scheduled, rest KEEP/PROBE)

| file | design | backing | verdict |
|---|---|---|---|
| `hivemind/hiveMind.js` | `es` members (default 4), gradient accumulation, sandwich apply→distill→rollback→re-apply, fail-closed rows | deep-ensemble framing; goldens pin trajectory | KEEP shell; sandwich contribution PROBE (disable-distill Brier A/B on frozen folds, CYCLE-184 probe 8) |
| `hivemind/ensemble/scores.js` | specialization/trust weighting | deep-ensemble diversity literature | REDESIGN → Brier-skill-gated weighting (CYCLE-184 incorrect #5; C185 mechanism: spec-modulation amplifies confident noise at zero skill) — scheduled after C1 |
| `hivemind/ensemble/homeostasis.js` | absolute activity controller toward set-point | homeostatic continual learning (2609.13771) + contraction proof; default-off, gain-0 no-op proven | PARKED (off, proven harmless); enable-test only on a positive-skill learner |
| `hivemind/training/gradients.js` | capture/scale/apply/rollback (+ spectral clip × 1/255 quant × dual-EMA trust × fractal-dim weights) | large-minibatch SGD; stack itself is ungrounded | REDESIGN → plain AdamW + cosine + global clip (C2/A17 retire-test: identity-spec + plain AdamW + clip; delete stack on no-Brier-move) |
| `hivemind/training/distillation.js` | distill toward top-30% ensemble teacher | Hinton KD assumes a skilled teacher; teacher skill here ≤0 (CYCLE-184 incorrect #3) | REDESIGN-or-delete: PROBE first (uniform/base-rate teacher vs top-30%; uniform wins → sandwich is harmful) |
| `hivemind/training/sample_weights.js` | uniqueness-weighted gradients (AFML ch.4), bit-equal to `analysis/uniqueness.js` | exact math, proven linear-in-`w` | KEEP math; triple-label use PROBE (#54 re-run owed) |
| `hivemind/ensemble/hiveState.js`, `internal/diagnostics.js` | shared state, read-only observation | ensemble + observer proofs | KEEP |

### L3 — transformer block (one REDESIGN scheduled FIRST, numerics KEEP)

| file | design | backing | verdict |
|---|---|---|---|
| `hivemind/transformer/forward.js` + `attention.js` + `hivemind/kernels/*` | Llama-style block (RMSNorm → MHA+RoPE → residual → SwiGLU FFN → residual), BatchEnsemble per-member spec weights | Transformer/RMSNorm/RoPE/SiLU literature; numerics golden-pinned exact | KEEP numerics; class REPLACEABLE per M1 (linear/mixer-first, then TSFM probe — ARCHITECTURE fires vs small nets) |
| `hivemind/persistence/dimensions.js:203` readout | **mean-pool over `inputSize` positions → linear → sigmoid** | contradicts sequence order (DLinear critique 2205.13504 applies verbatim; RoPE cannot survive an order-free head) | REDESIGN C1-FIRST: last-position / learned-pool head on the same block |
| `_getSpecWeightMatrix` specialization | per-member multiplicative specialization | BatchEnsemble flavour; ungrounded at zero skill (C185 mechanism) | folded into C2 identity-spec ablation |
| `_contextAwareAttention` | extra context into attention | unknown invariants | PROBE: returns-only future-shock audit (world.js pattern) |
| `_computeAttentionWeights` / `_pruneMemory` score reuse | memory decisions coupled to attention magnitudes | ungrounded coupling | PROBE: shuffle-scores ablation |

### L4 — memory (KEEP machinery; upgrades PARKED; one route QUEUED)

| file | design | backing | verdict |
|---|---|---|---|
| `hivemind/memory/banks.js` + `lsh.js` + `protos.js` + `consolidation.js` + `replay.js` + `retrieval.js` (live reader `_retrieveTopRelevantProtos`) | 4 banks over random-hyperplane LSH, promote/evict, every-N replay | SimHash/Charikar 2002, Titans/SDM, Mela; recall audited (≈ baseline, runs) | KEEP |
| `multiprobe.js` / `querymod.js` / `binarypc.js` / `bitweight.js` | wired to `_getGlobalLSHCandidates`, which serves only `transfer.js#broadcastMemory` — discarded by `getSignal` (#44) | each proven correct in isolation; path is dead (CYCLE-184 incorrect #4; M4 PARK) | PARKED; multiprobes recorded as probe-of-choice for C3 |
| `hivemind/knowledge/transfer.js#broadcastMemory` | builds a real candidate set, result discarded | Hinton KD framing, no live consumer | REDESIGN C3: route scored read into the live reader, or delete the broadcast |
| `hivemind/memory/surprise.js` | surprise-gated writes, default-off, floor-1 no-op proven | Titans 2501.00663; 32-check proof | PARKED (off, proven harmless) |

### L5 — legion aggregation (REDESIGN scheduled; P0 infra KEEP)

| file | design | backing | verdict |
|---|---|---|---|
| `legion/signals.js` (`computeDynamicWeights`: mem/child/tier/vault/perf/hierarchy multipliers; `propagateInfluence` top-30% seeds; `hierarchicalAggregate` consensus) | six uncalibrated boosts × confidence-flavoured weights over negative-skill members | no proper-score discipline (CYCLE-184 incorrect #5) | REDESIGN → Brier-skill-weighted aggregation reusing the `forecast.js` DM/MCS layer already in-tree; seeds must be skill-ranked or the spread is noise propagation |
| `legion/runner.js` + `workers.js` + `batch.js` + `sanitize.js` + `rng.js` + `accuracy.js` | pool + watchdog (P0), fault isolation + vault | infra, not intelligence | KEEP |
| `legion/broadcast.js` (dashboard/SSE) | observation | observer proofs | KEEP |

### L6 — evolution (KEEP pure; wire-up GATED)

| file | design | backing | verdict |
|---|---|---|---|
| `legion/evolve.js` | low-rank antithetic ES, monotone fitness on convex toy, exact quadratic identity | EGGROLL 2609.10980, Salimans 1703.03864; 36-check proof; nothing imports it | KEEP pure; wire-up M5 stays GATED behind a positive-skill learner (never evolve noise) |

### Measurement harness (KEEP — it is the referee, not the model)

`src/analysis/*` (backtest/forecast/DM/MCS/splits/labels/features/streams/
reality_check/overfitting/benchmark/carry/holding/dependence/uniqueness/
world/parallel/race/walkforward/decision/replication) — 60-guard
synthetic-ground-truth audit pattern (F-62…F-76). KEEP all; use for every
code-track gate (Brier/DM/MCS on frozen folds).

## §3 — live code queue (only work that may touch code, in order)

1. **C1 — readout-head replacement.** Kill the order-free mean-pool
   (`persistence/dimensions.js:203`): last-position / learned-pool head on
   the same Llama block. Gate: direction Brier-skill on frozen folds vs
   mean-pool head, DM-tested. Ships with a test script.
2. **C2 — optimizer/regulation retire-test (A17).** Identity-spec + plain
   AdamW + global clip vs the trust/spec/fractal stack; delete the stack on
   no-Brier-move. Includes the uniform-teacher distillation probe (§2-L2):
   uniform wins → the sandwich goes too.
3. **C3 — live-reader routing.** Route the scored memory read into
   `_retrieveTopRelevantProtos` (multiprobes as the probe arm, M4-recorded);
   multiprobes/querymod stay PARKED otherwise; delete `broadcastMemory` if
   the route replaces it.
4. **After skill only:** legion Brier-skill re-weighting (§2-L5), M5
   evolve.js wire-up, M2 vol-track re-open. GATED — not queued.

Golden-fingerprint rule: any code-track change that moves a golden value
ships an intentional re-freeze record with the reason, or it does not land.

## §4 — non-goals (locked; re-open needs a director decision + a number)

Data harvests/pulls of any kind · operator uploads · allocation/sleeve
sizing work · new leads · port/round-31/V2 work · tournaments,
meta-labelling, walk-forward λ, evolving noise (CYCLE-184 §6 restated).

No operator load owed. No code touched this round.
