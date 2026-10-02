# CYCLE-182 — CORE PIVOT: full HiveMind/Legion map, what's working, the model plan (2026-10-02)

No code touched (director order). Research + mapping + plan only.
Research: `arxiv-sweep-2026-10t.json` (7 grounded) + README line.

## The machine, end to end (controllers → deepest core)

1. **Data → features.** Candle JSONL → `candle_quality` (winsorize) →
   `indicatorProcessor` (MACD, stochastic, bands, … — 10 series) → vectors.
2. **Controller** (`hivemind/hiveMindController.js`, `controller/*`).
   One per (group, section, layer, tier, direction) slot. `getSignal()`
   feeds indicators into the mind; `trades.js` books trades (label policy
   optimistic/conservative/triple, FIFO drain `processCount=1`);
   `accuracy.js` bags; `database.js` persists; `candles.js` windows.
3. **Mind** (`hivemind/hiveMind.js`, es=4 default). Ensemble of tiny
   transformers (`transformer/forward.js` + `attention.js` on
   `kernels/*`); `training/` (gradients, sample_weights, distillation);
   `memory/` banks (episodic/adaptive/semantic/core) over an LSH index
   (`lsh` + multiprobes/binarypc/bitweight/querymod, default-off) with
   `consolidation` (promote/evict) + `surprise` gating;
   `persistence/` (save/load/dimensions); `knowledge/transfer` (broadcast
   sharing); `internal/` (mixins, diagnostics).
4. **Legion** (`legion/*`). `structure` (tiers/types); `signals`
   (collect → dynamic weights → propagateInfluence →
   hierarchicalAggregate → consensus); `runner`/`workers` (pool +
   watchdog); `batch` (fault isolation + vault); `accuracy`,
   `broadcast` (dashboard/SSE), `sanitize`, `rng`, `config`;
   `evolve.js` (low-rank ES — proven invariant, NOTHING imports it).
5. **Outside the hot path.** `observer/` (read-only watch),
   `analysis/` (offline scoring), `analyze/` (A/B driver + model
   factories: controllers/signals/features).

## Verdicts on the user's questions

* **WEIGHTS — working.** 170k training steps/variant, warmErrors 0,
  save/load round-trips golden-pinned. They update; they learn nothing
  about direction (target problem, not a training bug).
* **MEMORY — mechanically working, functionally ≈ baseline.** All 4 banks
  + LSH + consolidation tested; the 4 scored mechanisms measure ≈
  baseline, and 2 never reach the scored path (BUGS #44).
* **TRANSFORMER — running, wrong class for the task.** Forward pinned;
  literature (09o + 10t) says from-scratch tiny attention is the weakest
  TS class (permutation-invariance) — a linear/MLP does as well or better.
* **Why HiveMind is parked:** round-31 pivot on measured evidence —
  controller brierSkill −0.075, baseline Sharpe −0.11, linear/MLP also ≤0
  (NL-BENCH/G-A). Demoted to default-off research layer (A5/A22), kept as
  the A/B baseline. The locks (60 entries) protect it; they don't promote it.
* **The one open model door:** e115 1h big-move skill +0.0246 (19/24) —
  SUPPORTED but not book-actionable, DATA-BLOCKED on L2/fill/latency.
  Everything else model-side is CLOSED (directional, 8h, HAR-residual
  −0.0090 → no V2.3 port).

## The model plan (M1–M6, new view: edge = "hivemind that trades")

* **M1 — TODO 86 benchmark (FIRST, unlocks M2/M5/M6).** Arms: base rate,
  DLinear, Hankel-Toeplitz (2609.33984), MLP-mixer, zero-shot TSFM vs HAR
  (2607.05291 design), controller — same walk-forward, proper-score/DM/MCS.
  Hygiene: denoise first (2609.27614). Rule: none beats base → TARGET is
  the constraint; linear/pretrained beats controller → ARCHITECTURE is.
* **M2 — vol-track re-open conditions (GATED).** Only behind a positive
  residual test; pattern is anchor-frozen + gated learned residual
  (PGA-Trans-HAR 2608.25369), linear-class first (2508.15922), quantile
  framing for sizing tails (2508.15922/2507.22409). e117 keeps it closed
  until then.
* **M3 — execution-uses data spec (no build).** Write the exact L2/trade/
  latency spec + pre-reg gate (bps/fill vs e25) so a future harvest
  unlocks e115's (a)/(b) uses immediately.
* **M4 — A24 wire-or-drop.** Route multiprobes/querymod/binarypc/bitweight
  through `_getGlobalLSHCandidates` or mark PARK. Small, parallel with M1.
* **M5 — evolve.js wire-up.** Only after a positive-skill learner exists
  (no evolution of noise); needs its own A/B + golden decision.
* **M6 — ensemble size es.** Archived with 91/92; recovers with M1 skill.
* **NON-GOALS:** directional tournaments, meta-labeling, walk-forward λ.

## Next

M1 DESIGN (AI) → M4 in parallel → M3 spec. S6e (survival) continues on the
allocation track — the two tracks meet at sizing (vol forecast ↔ S6c).
No operator load owed.
