# CYCLE-092 — Round 59: V2.3 first learner (base-rate plugin)

**Date:** 2026-09-29
**Goal:** open V2.3 (model plugins) with the one learner the evidence endorses as the reference: the base rate nothing beats.

## Landed (repo, round 59)

* `plugins/learners/base-rate.js` (new): stateful Learner factory — online 0/1 counts with sample weights, `predict` = signed prior 2p-1, `diagnostics` = {n, positives, p}. Pure (contracts only), so the import law holds unchanged.
* Composition root carries it UNTESTED, `defaultStack: false`; the default roster is still exactly `legacy-hivemind`.
* Ten §L checks (`contracts` 161 → 171): contract validation, registry slot, exact 2/3 → 1/3 arithmetic, weights/diagnostics, non-finite guards, ±1 saturation, instance independence, registry instantiation, factory flags. Two G checks updated to the 8-plugin stack (sorted learner ids). LAW_FILES, CORE_IMPORTS, CORE_MODULES and PLUGIN_REGISTRY extended. Harness green (171/0 + locks 41/0).
* Two self-caught failures during the round: the learner-id order is sorted (`base-rate` first), and J needed the new module in CORE_IMPORTS plus the plugin-register row — both were the test doing its job, not code bugs.

## Measured (lab)

* `e95_base_rate_learner.js` (5/5): online prior bit-equals `fitBaseRate` on next-bar-sign labels for all 8 streams (priors 0.489–0.506); signed mapping exact; slot reads UNTESTED/false (F-105).

## Decision

V2.3 is open: the learner slot now has two occupants (legacy LIVE/default, base-rate UNTESTED/off-roster) with per-plugin proofs. Next learners (ridge/MLP ports) need the import-law question settled first (their math lives in `analysis/`, which plugins may not import). Remaining: V2.3 continuation, W5 breadth, G5 — all needing native runs. Hand to `npm test`.
