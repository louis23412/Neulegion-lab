# CYCLE-148 — Reference census S9: doc file:line refs vs the split tree (no change)

**Date:** 2026-10-02
**Goal:** check every `src/…js(:line)` reference in `docs/` against the
post-split tree (30 split rounds move code; stale coordinates mislead).

## Work

* **Census:** 301 `src|test|scripts` `.js` refs across 43 repo docs
  (boundary-strict matcher — two earlier passes false-positived on `.jsonl`
  and comment apostrophes; same lesson as S5/S8: strip and bound first).
* **6 stale-file hits, all exonerated:**
  - `round29-IMPLEMENTATION.md#src/analysis/analyze.js` — a quoted typo inside
    a frozen observation, not an instruction. Left.
  - `research/core-contracts.md` + `TODO.md` workspace-relative lab paths —
    both files exist; the checker used the repo base. Not doc bugs.
  - `ROADMAP.md#test/node/fault_isolation.test.js` — a planned-test name in a
    Done-when criterion (fault injection now lives in `worker_pool.test.js`).
    Historical acceptance text; left.
  - `COMPONENTS.md#src/_probe.js` — an illustrative forbidden-pattern example.
    Intentional.
  - `BUGS.md#test/src/legion/config.js` — quoted `ERR_MODULE_NOT_FOUND` text.
    Intentional.
* **12 stale line-numbers, all pre-split coordinates in frozen records**
  (`src/analyze.js:238–2118` in RUN-ANALYSIS §§1–5, BUGS.md, and
  `round29-ensemble-size.md` — the 3674-line pre-round-83 file — plus
  `walkforward.js:189` pre-split). Rewriting them would falsify history.
* **Standing rule (new):** bare `src/analyze.js:NNN` / `walkforward.js:NNN`
  coordinates in round ≤83 docs address the pre-split files; live docs must
  cite part paths (`analyze/cli/run.js`, `walkforward/audit.js`, …). Recorded
  here, not retrofitted.

## Verification (AI-side, this round)

* Static census only. No runtime needed — nothing moved.

## Open / owed

* `npm test` (R109 + S1 + S5 + S7 fix; S8/S9 docs-only). No uploads.
