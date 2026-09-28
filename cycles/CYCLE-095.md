# CYCLE-095 — Round 62: V2.3 MLP learner

**Date:** 2026-09-29
**Goal:** complete the P1 model-class set behind the Learner contract with the MLP arm.

## Landed (repo, round 62)

* `plugins/learners/mlp.js` (new): stateful Learner factory — buffered rows (unit weights only, refused otherwise), training-fold standardiser, seeded mulberry32 init + Fisher-Yates SGD (full or mini-batch) with L2, `predict` = signed 2p-1, `diagnostics` = {n, dim, hidden, epochs, seed}. Pure (contracts only).
* Composition root carries it UNTESTED, `defaultStack: false`; roster still exactly `legacy-hivemind`.
* Ten §N checks (`contracts` 181 → 191): contract validation, slot, bit-exact differential vs `analysis/benchmark.js` (standardised full-batch and raw mini-batch), seed determinism + seed sensitivity, weight/junk guards, hyperparameter throws, ±1 bounds, independence, registry instantiation, unanimous-train saturation. Two G checks updated to the 10-plugin stack. LAW_FILES, CORE_IMPORTS, CORE_MODULES, PLUGIN_REGISTRY extended plus one citation (Rumelhart, Hinton & Williams 1986). Harness green (191/0 + locks 41/0).
* One self-caught failure during the round: the saturation check used 5 epochs, where init bias still dominates — the check was wrong (50 epochs saturates both ways), the code was right. Fixed in the check.

## Measured (lab)

* `e99_mlp_learner.js` (4/4): 1600/1600 test-bar predictions bit-exact vs the benchmark arm on lagged-return features across all 8 streams (F-109).

## Decision

V2.3's model set is complete for the measured P1 arms (base-rate/ridge/MLP + legacy). What remains needs native execution: scoring the new learners through the gate (G4 promotion runs), W5 venues, and the G5 decisive run. Hand to `npm test`.
