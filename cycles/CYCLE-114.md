# CYCLE-114 — Round 85: the network arm is measurable (e118) + TODO 94 closes

**Date:** 2026-09-30
**Goal:** answer the highest-EV locked-core question (is the Sharpe-1.3
network arm real or a wiring artefact?) lab-side without touching the repo,
close the maker half of TODO 94 on existing evidence + fresh research, and
rerank the open items.

## Research sync (sweeps 2026-09ae/ag, maker + fill-probability, 2026-09-30)

Raw responses archived at
`docs/research/raw/arxiv-sweep-2026-09ae.json` (ti:"market making", 30 hits),
`-09af.json` (reversal+crypto, 12 hits) and `-09ag.json` (fill
probability/queue imbalance, 17 hits). Noted:

* 2607.28323 (passive execution: fill probability decays exponentially with
  quote distance; price responds linearly to order-flow imbalance): the
  queue/TOB dynamics that set maker economics live below bar resolution —
  exactly what e25 already concluded from the bar side (spread estimators
  volatility-contaminated, selection −0.6…−1.6 bps/fill).
* 2403.02572 (fill probabilities under state-dependent flows), 2409.12721
  (market simulation under adverse selection), 2512.05734 (survival-analysis
  fill probabilities), 2504.00846 (latency effect on execution): the
  queue-position half of TODO 94 needs L2/trade data the project does not
  have. Data-blocked, documented in TODO 94 — not built as a fake model.
* 2605.06405 (funding-aware market making for perps): inventory couples to a
  funding cash flow — context for TODO 95's remaining collateral leg.

## Measured (lab, read-only on the repo)

* `e118_network_audit.js` (8/8, artefact
  `results/e118_network_audit.json`): pooled Sharpe **1.3005** (bit-matches
  run `20260927T060215-seed1` 1.30049/4320 bars); Run A reproduces production
  (vacuous 8/8, reachable 0/288); base views byte-equal 8/8; Run B
  (sibling-shock) reaches **288/288** with **0 violations**. Two self-caught
  rebuild bugs: the scored path applies the run-level deadZone-0.05 policy
  (models.js#makeSignalForVariant), and P&L is lag-1 positions on own test
  bars (backtest.js#scoreFold). F-130 SUPPORTED.
* Regression: e112 15/15 (sleeve economics unmoved by the splits) and e113
  14/14 re-verified AI-side through the harness this round; e112–e117 steps
  confirmed registered in `run_all.js`, e118 step added.

## Decision

The network arm is vindicated: the 1.3 is causal under a reaching probe, so
the vacuity is the audit's defect (own-stream-only probe vs an arm that
never reads its own slot), not the arm's. The fix is audit-layer — scored
path untouched, goldens unmoved — but it changes report audit blocks, so it
goes as a W6 re-freeze arc (audit change + harness checks + native gate),
proposed as the next foundations round. That arc would put a 1.30/15.3bp arm
under a real gate for the first time — the biggest unlocked edge candidate
left. TODO 94 marked measured-complete (bar-measurable maker half settled by
F-34; queue half data-blocked). No repo change this round.

## Operator commands (none — lab + docs only)

No commands, no uploads. `npm test` NOT needed (repo untouched).
