# CYCLE-146 — Shim audit S7: the analyze.js node:url import (one latent fix)

**Date:** 2026-10-02
**Goal:** check that every split shim loads outside the harness (raw page-ESM
probe), and fix what doesn't.

## Work

* **Probe:** page-ESM imported 11 split shims. 10/11 load (`sleeve_score`
  23 names, `candle_fetcher` 29, `features` 28, `dependence` 19, `backtest` 13,
  `decision` 7, `reality_check` 18, `forecast/vol` 14, `walkforward/restate` 7,
  `walkforward/report` 3). `src/analyze.js` failed: a static
  `import { pathToFileURL } from 'node:url'` at its tail (the `isMain`
  dispatch) breaks module linkage wherever `node:url` doesn't resolve.
* **Why latent:** the only in-repo importer is `analysis/fold_worker.js`
  (real Node — fine); the browser entry imports `analyze/cli.js`, not the
  shim; the harness aliases `node:url` to a shim. So no suite, run, or number
  ever touched it — but the shim's contract ("every importer keeps working")
  and its own header ("node-only imports live in ./cli.js") were both false
  of the code. New row **L10-cu** (lead file appended).
* **Fix (import-line + dispatch only):** `process.versions?.node` gate +
  dynamic `await import('node:url')`; the exact dispatch condition is
  preserved (`node ./src/analyze.js` → `analyzeMain()`; `node --test`,
  worker, and harness paths never enter the branch). `type: module` + Node
  ≥22 keeps the top-level await legal. No scored-path change, no golden moves.
* **Post-fix probe:** the `node:url` failure is gone; the shim now stops one
  step later at `fs` from the `cli/` chain — inherent to the CLI's Node I/O
  (harness-shimmed, out of scope), not a second bug.

## Verification (AI-side, this round)

* Page-ESM before/after on `src/analyze.js`; importer census (fold_worker,
  analyze.test.js via cli.js, 3 node tests); `package.json` type/engines check.
* Static re-scan unchanged: 0 dead / 0 dangling / 0 cycles.

## Open / owed

* `npm test` (R109 + S1 + S5 + this fix; expect 132/132). No uploads.
