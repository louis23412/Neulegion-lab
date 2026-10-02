# CYCLE-194 — deep layer: features/dims, labels/ledger, memory sharing, init + fresh research 10y/10z (docs-only, 2026-10-02)

No code touched. No data pulled. No operator load. Continues the CYCLE-193
map into the four layers it did not open: feature construction, label
lifecycle, live memory sharing, and init/LR scales — plus a fresh arXiv
sweep on the two questions C1 and the S7-redesign depend on.

## Features: shape-packing, not model selection (`controller/features.js`)

- Tier-1: 10 indicator rows × `_trainingCandleSize`, robust-normalized,
  flattened; non-finite → filled **0.5** (`features.js:117-150`). The 0.5
  fill is post-normalization and not provably neutral — PROBE (mask-fill vs
  0.5 vs row-drop) once skill exists; harmless now.
- `_chooseDimension` (`features.js:183-282`): factors inputSize into
  (indicators × candles) maximizing min(ind,cand), balanced, near
  desiredSize. Pure shape-packing — NO data criterion. The dim choice is an
  ungrounded convention: **REPLACEABLE by validation-chosen dims when skill
  exists** (fix 10 indicators × N candles by walk-forward Brier); harmless
  until then. Record so no future cycle mistakes it for a tuned choice.
- Tier>1 (`features.js:152-181`): NO market data — only child-memory proto
  means/variances, ranked by `_computeProtoQuality`, interleaved,
  truncated/padded (0.5) to inputSize. Upper tiers trade purely on
  compressed memory summaries: the hierarchy disconnects them from the
  stream BY CONSTRUCTION. **PROBE (serious): tier>1 Brier-skill vs tier-1
  on the same folds — if tier>1 ≤ tier-1, the hierarchy is a noise
  amplifier and upper tiers should be gated or removed.**
- `_computeProtoQuality` (`features.js:57-90`): importance × log(access) ×
  size^−1.5 × mean^0.8 × var^−1.2. The exponents (−1.5/0.8/−1.2) are
  arbitrary — **REPLACEABLE by retrieval-relevance or skill-gated ranking;
  PROBE: quality-sort vs random order for tier>1 Brier**.

## Labels + ledger (`controller/trades.js` — read this cycle)

- Label = closed-trade outcome (TP 1 / SL 0) against ENTRY-bar features;
  FIFO drain `processCount=1` sets entry-to-training lag = queue length
  (TODO 62 probe: read heldBars vs horizonBars first).
- Brier ledger (`trades.js:296-306`): forecast = confidence/100 scored
  against outcome on the same sample as training — proper scoring at the
  ledger level, KEEP.
- Dedup: sha256(features|outcome) skips repeats (`trades.js:288-294`) —
  identical rows train once. KEEP (prevents overweighting flat regimes).
- `realPoints/trueAcc/score` blending stays accuracy-flavored (CYCLE-193
  S0/S7) — fine for dashboards, banned from future weighting.

## Memory sharing: the live path is intra-hive (`ensemble/hiveState.js`)

- `_hiveMemorySharing` runs every reset window: donors (top by 0.45 perf +
  0.25 agree + 0.3 spec) → receivers get top-utility + random protos with
  noise scaled by receiver badness. **LIVE and real** — this is the actual
  evolutionary transfer, distinct from the discarded inter-controller
  `broadcastMemory`. KEEP mechanics; donor ranking inherits the S4
  trust/spec dilution → re-rank by Brier-skill in the S7 redesign pass.
- Replay cadence (`banks.js:517-518`): faithful + generative replay every-N
  steps. KEEP cadence; content quality only matters post-skill.

## Init + LR scales (`persistence/dimensions.js`)

Depth-scaled `_dynamicInit`, output head scale 2.1, LR = min(0.0025,
0.12/inputSize × sizeScale). Reasonable heuristics, μP-adjacent flavor —
**KEEP; init is not the binding constraint at zero skill**. Revisit only
inside C2 (AdamW needs its own LR/schedule search anyway).

## Fresh research 10y/10z (raw `scratch/sweep-10y-readout.xml`, `scratch/sweep-10z-hedge.xml`)

- **2610.01831** — *Pooling Helps, Learned Weighting Hurts In-Context*
  (Chronos-2 group attention): uniform pooling positive on 18/20 configs;
  learned Q/K weighting degrades 8/10 ICL configs. C1 CONSEQUENCE: do not
  assume a learned pool wins — C1 must test last-position AND uniform-mean
  AND learned-pool heads, DM-compared. Learned weighting is a suspect, not
  a default.
- **2510.03339** — *Pool Me Wisely: On the Effect of Pooling in
  Transformer-Based Models*. Directly on pooling choice — read fully
  pre-C1; it may name the right head form.
- **2308.15384** — *Hedging Forecast Combinations (Random Forest
  application)*. Hedged combination beats naive averaging — grounds the
  S7 redesign direction (skill/hedge-weighted, not trust-weighted).
- **2210.07169** — *Forecast Hedging and Calibration*. Calibration +
  hedging companion for S7.
- 2409.19477 (competition truthfulness) noted, not load-bearing.

## Refined code queue (order unchanged, arms sharpened)

1. **C1** — readout-head A/B/C: (a) last-position, (b) uniform mean-pool
   (current, control), (c) learned-pool; frozen folds, Brier-skill + DM
   (10y says (c) may lose — that is a result, not a failure). Read
   2510.03339 first.
2. **C2** — + tier>1 skill probe and quality-sort probe ride free (same
   evaluation harness, no extra builds).
3. **C3** — reframed CYCLE-193 stands.
4. **Post-skill** — S7 hedged combination (2308.15384/2210.07169);
   donor re-ranking; dim-by-validation; 0.5-fill/mask probe.

No operator load owed. No code touched this round.
