# CYCLE-149 — Collision census S10: duplicate export names (two latent rows, no change)

**Date:** 2026-10-02
**Goal:** census every export name defined in more than one `src/` module and
check whether any importer wires the wrong one (the split design multiplies
shim↔part name sharing, which is benign, but also hides real collisions).

## Work

* **Census:** 883 export names, 347 shared across files. The top-30 are all
  shim↔part↔index re-export chains (same origin) — the split recipe working as
  designed. Three cases needed body-level inspection:
* **L10-cv — `sharpeStandardError` is two different formulas.** 
  `analysis/performance.js` takes `{sharpe, n, skew, kurtosis}` (Lo-style);
  `analysis/walkforward/power.js` takes `(sharpe, bars, ppy=252)` (simple
  `sqrt((ppy + 0.5·sr²)/bars)`). Importer census: `sleeve/evidence.js` uses
  performance's (with skew/kurtosis — correct); the `walkforward.js` shim
  re-exports power's; `walkforward.test.js` takes the shim's. No caller mixes
  the signatures. Latent footgun only (same name, different arity/formula);
  no rename (both are pinned by tests under their current names).
* **L10-cw — `clipWeights`/`bandWeights`/`cleanBook` live twice.**
  `core/primitives/weights.js` (ships in all three sleeves via
  `core/primitives/index.js`) and `analysis/portfolio.js` (pinned by
  `analysis.test.js` W3 checks + lab e137) define them independently:
  `clipWeights` byte-identical; `bandWeights` identical except portfolio.js
  hardens `!Array.isArray(weightRows)` (core throws on non-array). No caller
  passes a non-array, so shipped and tested behavior coincide exactly — but
  the mirror can drift by one guard again. Proposed (repo task, not this
  sweep): single-source it (portfolio re-exports core, or a pinned equality
  test). Not rewired here: the native gate can't run in this workspace and
  blind rewiring is riskier than a 1-guard drift.
* **`meanOf` collision checked and benign:** core's `(returns)` vs
  `features/base.js`'s `(s,a,b)` range form — different domains, each
  importer takes its own (`features/reversal.js` takes base's). Same latent
  class as L10-cv, no row (no formula conflict, just an overload).

## Verification (AI-side, this round)

* Static census + body diffs + full importer tracing (see above). No runtime
  needed — nothing moved.

## Open / owed

* `npm test` (R109 + S1 + S5 + S7 fix; S8/S9/S10 docs-only). No uploads.
