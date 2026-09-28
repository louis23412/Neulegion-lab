# CYCLE-094 — Round 61: V2.3 ridge learner

**Date:** 2026-09-29
**Goal:** give the learner slot its second measured model: the P1 ridge closed form as a plugin.

## Landed (repo, round 61)

* `plugins/learners/ridge.js` (new): stateful Learner factory — buffered rows with per-row weights, training-fold standardiser, weighted least squares with the intercept unpenalized, `predict` = signed 2p-1, `diagnostics` = {n, dim}. Pure (contracts only); the import-law question is settled by porting, per the V2.1 precedent.
* Composition root carries it UNTESTED, `defaultStack: false`; roster still exactly `legacy-hivemind`.
* Ten §M checks (`contracts` 171 → 181): contract validation, slot, bit-exact differential vs `analysis/benchmark.js` in both standardise modes, unit-weight identity, double-weight duplication, non-finite/ragged guards, bad-lambda throw, ±1 bounds, independence, registry instantiation. Two G checks updated to the 9-plugin stack. LAW_FILES, CORE_IMPORTS, CORE_MODULES, PLUGIN_REGISTRY extended plus one citation (Hoerl & Kennard 1970). Harness green (181/0 + locks 41/0).
* One self-caught failure during the round: the ported file shadowed its weight vector with the row-weight parameter — the bundler refused it, fixed by renaming before any test ran.

## Measured (lab)

* `e98_ridge_learner.js` (4/4): 3200/3200 test-bar predictions bit-exact vs the benchmark arm on lagged-return features across all 8 streams (F-108).

## Decision

The learner slot has three occupants; the remaining P1 arm (MLP) is SGD-based and seeded — portable, but its exactness bar is statistical, not bitwise, so it waits for its own round. Remaining: MLP learner, W5 venues, G5 — all needing native runs. Hand to `npm test`.
