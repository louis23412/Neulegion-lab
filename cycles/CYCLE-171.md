# CYCLE-171 — 116 investigation: breadth without edge (2026-10-02)

**Round:** operator ran `round93-midcap-116.sh all` — tests green, three
native runs banked (`src/runs/20261002T093402/110840/124753-seed1`).
Investigation only; no code touched.

## What went well

* Turnkey script worked first try: port self-checks, gate, all three runs,
  report paths printed. Audits clean (reachable 576/576, 864-fold leg clean).
* 116 breadth half-gate PASSES natively: vol effStreams 3.73 ≥ 2.3, pooled
  DSR 0.9706 up from the 0.9340 majors baseline.
* 87 acceptance PASSES: cadence verdicts neutral at 10/15/20.
* 84 record EXTENDS: test=10 level-shift reproduces in direction (baseline
  pooled 0.11 → 0.34, mean-fold −0.03 → +0.45; vol adj DSR margin −0.19).

## What failed (scientifically)

* All keep-off in all three runs. Binding: mean-fold-Sharpe < baseline+0,
  adj DSR < 0.95, paired cluster tests ns (best p=0.09). Dependence is the
  wall: momentum~vol excess r=0.94, family effectiveTrials 1.37 of 4.
* Exposure-match inconstructible within tolerance (89% vs 46% activity).
* Cost ladder: nothing promotes at any rung; +10 bps kills all four arms.

## Open questions (not bugs)

1. Pooled-vs-mean-fold sign gap at test=15 (+0.3..+0.5 vs −0.25..−0.66) —
   explain before trusting promotion math.
2. `run.json` doesn't record `--cadences`/`--exposure-match` (one-line fix,
   later round).
3. Budget: 16-panel gh ~95 min, test=10 ~140 min — plan wall-clock accordingly.

## Proposed next-step plan (for operator decision)

1. **117: PASS on the letter of its gate but recommend parking it.** Its
   trigger (effStreams ≥ 2.3 natively) is met, yet 116 shows breadth buys
   streams, not significance — wave-2 (+12% lab-measured) is unlikely to flip
   any verdict. Cheap to run (~60 min) if the operator wants the number.
2. **118 next (honesty-gated):** midcap-carry sleeve is minutes-only; either
   harvest midcap mark klines first or pre-register funding-only. Unblocks the
   honest-book comparison on 16 streams.
3. **G5 honest-book decision** remains the highest-value item once (2) lands.
4. Small fixes batch (aggregation-gap note, run.json flags) rides the next
   coded round — not its own round.

Counts unchanged (no new findings/experiments this cycle).
