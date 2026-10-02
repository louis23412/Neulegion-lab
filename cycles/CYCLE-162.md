# CYCLE-162 — D2 L10-hygiene review: dual SE + triple weight tools (read-only)

**Date:** 2026-10-02
**Goal:** scope PLAN-next D2 (L10-cv/cw) with measurements, no code change
(hygiene needs the owner's gate; importers already verified correct).

## 1. Dual `sharpeStandardError` — same family, different parametrisation

* `src/analysis/performance.js:149` — per-period Lo (2002) with skew/kurtosis:
  `sqrt((1 - skew·SR + (kurt-1)/4·SR²)/(n-1))`.
* `src/analysis/walkforward/power.js:14` — annualised skew-0/kurt-3 shortcut:
  `sqrt((P + SR_ann²/2)/bars)` (note: `/bars`, not `/(bars-1)`).
* No namespace collision: `walkforward.js` re-exports only power's; the
  per-period form is imported directly from `performance.js`.
* Importers correct: `sleeve/evidence.js` uses the per-period Lo (right units
  for per-bar Sharpe); `powerSummary`/report paths use the annualised form
  (right units for annualised Sharpe).
* Measured agreement (skew-0/kurt-3): ratio is exactly `sqrt(n/(n-1))` —
  1.00008…1.00056 at run scales (n = 888…6605). The only difference is the
  off-by-one. **No bug.**
* Proposal (owner-gated, NOT done here): rename power's to
  `sharpeStandardErrorAnnualized` or add a two-way comment cross-link; either
  touches the lock-pinned export surface + mirrors, so it rides a round with
  a native gate.

## 2. Triple weight tools — canonical vs legacy

* `core/primitives/weights.js` (canonical, live via the cap-band risk layer)
  vs `analysis/portfolio.js` (same bodies; `bandWeights` adds an
  `Array.isArray` guard). Bodies agree; duplication is historical (pre-split
  analysis layer vs post-split primitives).
* `portfolio.js#SLEEVE_SPECS` + `cleanForSleeve` have **zero live importers**
  (`cap-band.js` hit is comment-only) — a legacy reference table pinned by
  the lock registry + browser checks.
* **Trap found (inert, L10-grade):** `portfolio.js#SLEEVE_SPECS.R8.bandEps`
  reads `0.005` while the pinned carry spec (sleeve plugin + `CAP_BAND_SPECS`
  + browser §S1) is `null`. Nothing reads the stale value, but a future
  importer would inherit a phantom band. Proposal (owner-gated): annotate
  portfolio's copies as legacy-reference pointing at primitives as canonical,
  and either correct or strike the stale `0.005`. Do NOT delete (lock-pinned).

## Disposition

No code touched. Both proposals need the owner's eye + a gated round; until
then the tree is correct-but-duplicated, and this cycle is the record.
