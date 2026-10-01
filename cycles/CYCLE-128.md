# CYCLE-128 — Round 98: models split + dispersion-sizing NEGATIVE (mechanism found)

**Date:** 2026-10-01
**Goal:** two tracks — (a) foundations: split `analyze/models.js` (587
lines, unregistered, cheap recipe); (b) model upgrade: test
state-dependent carry sizing (e126) — the first direct attack on a naive
shipped algorithm (flat 1.0 book scale).

## Work

* **Foundations: `analyze/models.js` → `analyze/models/` ×5 + shim.**
  `features.js` (featureVector), `factories.js` (HiveMind + benchmark
  factories), `stats.js` (diagnostics accumulator + summary;
  `labelDiagnostics` exported for inter-part use — the round-74
  precedent), `controllers.js` (controller factory, its own part because
  it sits between stats and signals in the file), `signals.js` (seed +
  dispatch). Bodies byte-identical except the one `export` prefix. The
  shim keeps the exact 9-name contract. Unregistered → no registry/ledger
  change. `analyze/` is now fully modular (roster next).
* **Verified AI-side, first try.** Baselines first (analyze 294/0, locks
  41/0, contracts 255/0), then identical post-split; shim bundles complete.
* **e126 dispersion-sizing 3/3 NEGATIVE with the mechanism (F-139).**
  Scaling each weight row by xsStd(fRate)/trailing-median (causal,
  clamped) through the repo's own score path: scaled loses on Sharpe AND
  BE on BOTH panels (majors 0.34→−0.28, BE 42.9→2.2; midcap 0.55→−0.74,
  BE 39.5→1.5). The kill mechanism is turnover: 60→1629 (majors),
  22→739 (midcap) — the regime factor moves far faster than the slow
  EWMA-rank book and drowns it in costs. The exploratory slow variant
  (REG-90, clamp [0.5,1.5], descriptive only) fails the same way
  (turnover still 26–48× flat). Flat sizing STANDS. Precise next design
  filed (TODO 119): the scale must be quantized (2-state high/low with
  hysteresis) or applied to target risk, never multiplied per-bar.
* **Research:** 10c blocked again (arXiv 503, third time) — recorded, not
  chased; grounding stands on 10a/10b.
* **Rerank.** Top tier: 116 + 118 (stacked read) + fade G5 (106/108) +
  111 (blocked). New: TODO 119 (quantized-regime sizing, AI-side queued).
  Queued: 95 remainder, 104 (sized-leg G5 — the eventual home of any
  sizing upgrade), 117 (behind 116), L10, W5 venues.

## Result

F-139 (e126 NEGATIVE + mechanism + next design). Orchestrator intact.
S42→S43. Operator commands: `npm test` (no uploads).
