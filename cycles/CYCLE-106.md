# CYCLE-106 — Round 74: `walkforward.js` split (foundations)

**Date:** 2026-09-29
**Goal:** `analysis/walkforward.js` (2264 lines, 37 exports — the protocol layer
under every verdict) is the biggest module left after round 71 — split it into
managed parts per the CYCLE-104 recipe, with zero behavior change.

## Landed (repo, round 74)

* `analysis/walkforward/` (7 parts, byte-exact `copy_lines` moves):
  `returns.js` (signal/position primitives, no imports), `folds.js`
  (aggregation + R1/R2 scorers), `audit.js` (evaluators + the no-lookahead
  audit), `power.js` (power/sizing/dependence readers), `report.js` (pooling +
  the gate), `restate.js` (cost/policy/cadence/exposure restatements),
  `search.js` (family-wise search + renderer). Dependency DAG is acyclic
  (returns ← folds ← audit/power ← report ← restate; search ← audit/report).
* `powerSummary` is the one shared private: now part-public on `power.js`
  (one added `export`, the round-71 `w4cSolveNormal` precedent) and NOT
  re-exported by the shim, so the 37-name contract is unchanged.
* `analysis/walkforward.js` is now a re-export shim carrying exactly the
  37-name registered contract.
* Registry: seven `ANALYSIS_MODULES` rows + seven `ANALYSIS_REGISTRY` rows
  (INVARIANT, `analysis.test.js` + `walkforward.test.js`); `locks.test.js`
  imports + map extended. No check counts move anywhere (pure move — ledger
  stays 3088, mirrors untouched).
* No self-caught failures: the boundary scan up front showed every cut lands
  on a comment line belonging to the following definition, the mutual
  recursion (`restateReportAtCost` ↔ `restateReportAtPolicy`) sits in one
  part, and the only cross-part private was `powerSummary`.

## Verified (no new numbers — a foundations round)

* locks 41/0 (both-directions export contract on all seven parts + the shim
  identity), walkforward 90/0, contracts 231/0, analysis 850/0, analyze 289/0,
  guards 65/0; lab e105 green through the shim, e71's decision→walkforward
  chain resolves. The locks §J check is the shim-identity proof.

## Decision

The verdict protocol's home is now seven reviewable files; the next
estimator/gate work lands in the open part, not in a 2264-line file.
Remaining: G5 gate runs (native — the `--sleeve-sizing=drawdown` run prices
the turnover question), W5 venues (operator data), W6 L10-co/cp/cq/cr
(re-freeze decision). Hand to `npm test`.
