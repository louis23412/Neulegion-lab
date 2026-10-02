# CYCLE-160 — Phase-D scoping: TODO 84/85/87 (no new code)

**Date:** 2026-10-02
**Goal:** scope the config-robustness leg before building anything. Rule:
coherency before each point — first check what the tree already has.

## What the tree already has (verified, not assumed)

* P2 machinery fully implemented AND pinned: `restateReportAtCadence`,
  `exposureMatchedPair`, `costLadder` (`src/analysis/walkforward/restate/`),
  `promotionAcrossCadences` (`src/analysis/decision/cadence.js`), CLI
  `--cadences` / `--exposure-match`, 10+ browser checks across the
  `analyze` + `analysis` entries (identity restatement, multi-stream panel
  rebuild, sleeve carry-over, exposure-gap removal, single-cadence rejection).
* BUGS #61 recorded (reported, not fixed): controller |confidence| ≤ 0.27 vs
  signal saturation at 1; shipped deadZone 0.05 leaves baseline in-market
  0.508 vs momentum 0.892.

## Scoping verdict per item

* **87 (config-robust, exposure-matched verdict): NO NEW CODE.** The
  implementation the item asks for exists and is pinned. What remains is
  *application*: operator runs with `--cadences` + `--exposure-match` and
  the verdict-neutrality acceptance read (sig-accel's 0-bps promotion must
  die under the rule). Queued behind the operator panel runs — add the flags
  to the first 16-panel `gh` (TODO 116) so the acceptance comes free.
* **84 (evaluation-configuration nuisance): RECORD + two native reads.**
  The record exists (item text + RUN-ANALYSIS §15.3/§15.6 + METHOD §7
  caveat). The unmeasured parts need the native driver (same roster at a
  second `testSize`; paired-requirement grid dependence). Fold into 116:
  run the 16-panel `gh` at the default grid AND `--test=10`, read whether
  the level shift reproduces and whether any keep-off flips.
* **85 (confidence-scale policy): DECISION + DESIGN §6 change, next round.**
  Proposal (director's call, recorded here for challenge): cross-family
  statements quoted **only at matched exposure** (the machinery exists and
  the P2 checks already show the gap removal killing spurious promotions);
  **reject family-normalised thresholds** (they rescale the scored policy
  itself — a hotter change with wider blast radius). Implementation is a new
  round, not this cycle: it touches the decision procedure (DESIGN §6) and
  needs a native gate. Do NOT bundle with 87's application runs.

## Next cycle

CYCLE-161: research sync — fresh arXiv refresh sweep (10p) on the open
fronts (decay/edge-demise, crypto carry, multiple-testing methodology,
vol-target sizing). Convergence confirms only; a new note must earn task
form for an open TODO.
