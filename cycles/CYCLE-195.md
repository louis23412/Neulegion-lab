# CYCLE-195 — final gap layer: prune/promotion, indicator warmups, leakage-audit recipe (docs-only, 2026-10-02)

No code touched. No data pulled. No operator load. Closes the last three
map gaps named in CYCLE-194 and grounds memory dynamics in the repo's own
research notes. After this cycle the controllers-to-core map is complete;
remaining unknowns are all queued as probes with recipes.

## Prune + promotion (`memory/banks.js:257-341` — read this cycle)

- `_pruneMemory`: forced-keep most-recent slice (≤60% of window) + top
  memory-scored older entries; discards flow to `_coreEpisodic`, capped by
  score. Mechanics KEEP (bounded window + bank-carries-tail matches the
  interference-wall argument, 2609.16183, in `docs/research/memory-
  retrieval.md`: fixed-state recall degrades past a wall — keep the working
  window bounded).
- **Promotion budget is inversely tied to skill**: `numPromote =
  baseProtoCapacity × (0.25 + 0.5×(1−perf))` — the WORST members archive
  the MOST discards into core-episodic. At zero skill this fills the
  long-term store fastest from the least-skilled members. **PROBE (serious):
  flip the sign (promote proportional to perf) vs current on frozen folds;
  if flipped wins Brier, the current rule is actively harmful.** Cheap,
  same harness as C2.
- Consolidation/decay grounding (already banked, restated for the record):
  Titans/test-time memory 2501.00663 (+Revisited 2510.09551), Mela
  2605.10537, eviction-as-estimation 2607.24667, Hopfield 2008.02217/SDM —
  the bank architecture is the best-grounded half of the model. The
  DYNAMICS (promotion sign, prune scoring, explorationRate) are the
  ungrounded half — all three are now queued probes, not redesigns.

## Indicator warmups: a concrete transient problem (`indicatorProcessor.js:4-55`)

Fixed textbook windows (RSI-14, MACD 8/21/5, ATR-14, EMA-100, Stoch
14/3/3, BB-20, ADX-14, CCI-20, W%R-14), ≥11 bars, fail-closed — KEEP the
math and the fail-closed. Two observations for the record:

1. **EMA-100 on ~60-bar windows never warms up**: with trainingCandleSize
   in the tens, the longest State (EMA-100) is initialization-transient
   over the whole window. The feature row's slowest channel is mostly
   transient response, not market state. PROBE (post-skill): drop EMA-100
   / shorten to validated windows; expect zero-or-positive Brier move.
2. Windows are equity-daily conventions, unvalidated on crypto 8h.
   PROBE (post-skill): window-sensitivity sweep on frozen folds. Harmless
   now — indicators are not the binding constraint at zero skill.

## Leakage-audit recipe for `_contextAwareAttention` (probe design, no build)

The open CYCLE-184 probe-1, now specified so a future iteration can run it
in one session: reuse the `analysis/world.js` returns-only future-shock
pattern — (a) base pass: controller features → attention inputs recorded;
(b) probe pass: shock future returns (post-`after`) via `shockCandles`,
recompute ONLY the causal prefix inputs, assert `_contextAwareAttention`
outputs and `_retrieveTopRelevantProtos` selections bit-identical across
passes for all pre-`after` positions; (c) vacuity guard: a deliberately
leaky input (future mean appended) MUST be flagged. Reachable today (all
modules in-tree); needs only a harness script. Priority: after C1 (a
leak would flatter every later A/B).

## Round-30 note disposition

`docs/research/round30-winning-mechanisms.md` corroborates the ARCHIVED
allocation side (momentum trunk / carry / dependence power) — provenance
for the purge, not model work. No action.

## Map status: COMPLETE

Every layer controllers→core is now read and judged across CYCLE-184
(skeleton + verdicts), CYCLE-193 (code-verified mechanisms + corrections),
CYCLE-194 (features/labels/sharing/init + 10y/10z), CYCLE-195 (prune/
promotion/warmups/leakage recipe). Single entry for code work:
`cycles/CYCLE-195.md` §below + PLAN model track.

Live queue (final): **C1 readout A/B/C (+2510.03339 pre-read) →
C2 optimizer/spec retire-test (+ uniform-teacher, agreement-gate,
promotion-sign, laggard-LR probes — same harness) → C3 upgrades-into-
live-reader or delete-broadcast → leakage-audit recipe runs before any
post-C1 A/B is trusted.** Post-skill only: S7 hedged combination,
donor re-rank, validation dims, window sweep, EMA-100 drop.

No operator load owed. No code touched this round.
