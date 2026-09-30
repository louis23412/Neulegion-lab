# CYCLE-110 — Round 83: `analyze.js` split (foundations) + two self-caught path bugs

**Date:** 2026-09-30
**Goal:** `src/analyze.js` (3674 lines, 45 exports — the biggest module left after
round 81's sleeve split) is split into managed parts per the CYCLE-104/106 recipe,
with zero behavior change; the native gate (`npm test`) verifies the CLI paths
AI-side can't reach.

## Landed (repo, round 83)

* `src/analyze/` (4 parts, sliced bodies byte-identical to the single file):
  `roster.js` (505 lines: constants, variant tables, register contract, guards,
  policies), `models.js` (587 lines: feature vector, factories, signal wiring —
  newly exports `emptyModelAccumulator`/`mergeModelStats`/`summarizeModelStats`,
  previously module-private, for the evaluate/cli parts), `evaluate.js`
  (764 lines: evaluateAB/Async, decisions, formatters), `cli.js` (1826 lines:
  I/O, runAnalysis, replicateAnalysis, usage, main). DAG is acyclic
  (roster ← models ← evaluate ← cli).
* `src/analyze.js` is now a 51-line shim carrying the exact 45-name contract
  (verified 45/45, no extras) plus the `isMain` CLI dispatch — which had to move:
  the argv-vs-module-URL comparison only matches in the invoked file.
* Two self-caught failures during the round, both relative-path breaks the
  bundler surfaced before any green run: dynamic `import('./hivemind/...')` and
  `new URL('./analysis/fold_worker.js', ...)` resolve against the part's
  directory, so both gain one `../`. A regex identifier audit was attempted and
  abandoned (comment-apostrophes + template prose defeat naive tokenising);
  the bundler's link errors plus the suite counts are the verification.

## Verified (no new numbers — a foundations round)

* shim identity 45/45; analyze 290/0; contracts 255/0; locks 41/0; modules 59/0
  (all through the browser harness).
* No registry rows: the lock entry for `analyze.js` pins a curated export subset
  that is unchanged; the import law covers only core/plugins, so the new
  directory needs no rows either. No check counts move (pure move).

## Decision

The driver's home is now four reviewable files; estimator/gate work lands in
the open part. Remaining: native gate (`npm test` — CLI paths, worker dispatch,
fold parity), W5 venues (operator data), W6 L10-co/cp/cq/cr (re-freeze
decision). Hand to `npm test`.
