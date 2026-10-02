# CYCLE-152 — Native gate CLOSED + post-gate re-verification (no change)

**Date:** 2026-10-02
**Goal:** close the owed gate on the operator's proof, then re-verify the tree
is the tree the gate covered.

## Gate

* Operator native proof (chat, 2026-10-02): `tests 132 / pass 132 / fail 0`,
  `duration_ms 349868` (~350 s). Covers R109 (vol split + e137) + the S1/S5
  import cleanups + the S7 `src/analyze.js` dispatch guard (S8–S12 docs-only).
* The gate the S6–S12 notes held open is now CLOSED. No new owed gate:
  nothing scored-path has changed since.

## Re-verification (AI-side, this round)

* **S7 fix intact:** `src/analyze.js` carries the
  `process.versions?.node`-gated dynamic import; no static `node:` import
  line remains.
* **Dead imports:** comment-stripped, alias-aware scan over 210 src + 93 test
  files: 0 dead. One flag (`contracts.test.js` `{run}`) exonerated by
  inspection — used at `await run({...})`.
* **Dangling/cycles:** 0 (relative-target resolution over the same 303 files).
* **run_all:** all 138 experiment files referenced (module-import shape —
  step counting by quoted filename does not apply).
* **FINDINGS ledger:** 81 full rows (F-01…F-81, by design) + 81 summary rows
  (F-82…F-162, every number present, none missing) = 162 complete.
* **Registry/ledger:** untouched since their gated states (S8's 916/916,
  S12's 3123 sum) — S13 changes no code and no counts.

## Rerank

* Unchanged (S6 tiers stand; full opens audit is CYCLE-153).
