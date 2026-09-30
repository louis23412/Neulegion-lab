# CYCLE-120 — Round 90: the K=6 re-run lands (TODO 113 CLOSED, network measured-not-promoted)

**Date:** 2026-09-30
**Goal:** read the operator's uploaded `20260930T154333-seed1` run as read-only evidence,
record the TODO-113 decision, and rerank.

## Verdict

Run complete in 45:25 (§18.3 roster at K=6, 288 folds, 4320 pooled bars, 8x1h last-600,
seed 1). All five signals `reachable 288/288`, `violations 0` — the R40 sibling-shock
law holds in production (AUDIT P11 RESOLVED). `sig-network-momentum`: pooled Sharpe
**1.3005**, adjDSR **0.8654 @ 802 effective bars** — the ONLY failed hurdle (paired
dSharpe 1.4152 one-sided p = 0.029, stability 1.0, minDsr 1.0 all pass).
**Measured-not-promoted**; DROPPED stands, re-measured. SPA p = 0.3177 (none); cost
ladder promotes none at 0/2/5/10; MCS = [baseline]; UNDERPOWERED (dep MDE95 ±1.04).

## New learnings (F-131)

* Dependence binds hardest on the network arm (streamCorr 0.73, DE 5.38, effStreams 1.31).
* `sig-vol-momentum` nearest the floor (0.9173, margin −0.033) — the watch-list arm.
* Roster redundancy measured: momentum~regime-momentum excess r = 0.9964,
  effectiveTrials 1.18 of 5 → TODO 114 trims `sig-regime-momentum` from the `gh` roster.
* Paired magnitude already clears (1.4152 > 1.2212 required), so the "cheapest flip" is
  the DSR floor: lower DE, more effective bars, or larger raw edge.

## Doc pins

* `RUN-ANALYSIS.md` §35; TODO 113 CLOSED, 114 opened; LINEAGE + lineage.json + DROPPED §2b
  network rows re-measured; AUDIT P11 RESOLVED (LOW), V11/V12 + PLAN-round31 A23 updated;
  `src/README.md` round-90 bullet; `src/runs/README.md` eighth run + §6.
* No repo code changed; no scored-path change; no golden moves.

## Operator commands

None this round (docs only).
