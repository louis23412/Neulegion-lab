# CYCLE-121 — Round 91: roster trim + e119 (demeaned momentum is market, NEGATIVE)

**Date:** 2026-09-30
**Goal:** close TODO 114 in the repo; run the experiment round 90 called for
(§35.3: the decorrelated-cross-sectional shape); rerank.

## Work

* **TODO 114 CLOSED (AI-side).** `scripts/round30-runs.sh` `gh` stage drops
  `sig-regime-momentum` (K=6 → K=5). Verified: 5 variants, regime absent, all
  other flags byte-identical. No test pins the roster; no scored-path change.
  Next `gh` starts a K=5 column beside the §15.4 K=6 table — read vol first.
* **e119 green 9/9** (`results/e119_xs_demeaned_momentum.json`, in `run_all.js`).
  Two self-caught issues: passed the view factory instead of the realised view
  (all-zero first run); run-composite DE 3.6239 folds in serial dependence, so the
  lab pins Kish-consistent rbar/effStreams (both bit-match).
* **Verdict NEGATIVE (F-132):** demeaned 1h momentum Sharpe 0.09 (BE 1.15 bps),
  z-scored 0.20 (BE 1.92). The edge was the market leg — direction CLOSED for the
  1h panel; breadth stays with the sleeves.
* **Bug + sanity:** arm-A calibration bit-matches the run on six numbers; lineage
  register coherent (DROPPED, no code note to update); `lineage.json` valid;
  `run.log` clean (9 lines, 0 errors).
* **Research sync:** arXiv API fetch on crypto XS-momentum failed twice (proxy
  timeout) — recorded, not chased; ledger grounds the result.

## Rerank

Top tier: fade G5 (106/108, operator-owned) + TODO 111 (model track, highest model
EV). Queued: 95 remainder, 104, W5 venues, L10-co/cp/cq/cr.

## Second half (same round)

* TODO 111 tail documented as DATA-BLOCKED (execution uses need L2/trade/latency;
  gate = bps per real fill vs e25; no fake build). TODO 95 remainder confirmed
  operator-/data-owned.
* `run_all.js` + e119 step bundles clean through the harness — orchestrator intact.

## Operator commands

None (AI-side only).
