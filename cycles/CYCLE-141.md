# CYCLE-141 — Coherency sweep S2: bug-hunt layer (no measurement round)

**Date:** 2026-10-02
**Goal:** deeper static checks over repo + lab; fix or annotate whatever fails;
record what is deliberately kept.

## Work

* **Shim contracts both directions (20 shims, 452 files).** Every re-exported
  name exists in its target (0 problems); every named import from every shim
  across repo + lab resolves in the target's export closure (0 dangling).
  First checker run flooded false positives (an off-by-one appending `.js`
  twice) — fixed, re-run clean. The split discipline is proven, not assumed.
* **Module graph.** 210 src files: 0 import cycles (clean DAG), 0 CJS
  leftovers (`require(`, `__dirname`/`__filename`). Hot-module `console.*`
  hits (7) all deliberate error/corrupt-row diagnostics — kept.
* **Ledger + mirrors.** RUNBOOK §6 table re-added by hand: 32 entries sum to
  exactly 3123; + bench (timings only) = 33 entries. Node side: 24 mirrors +
  8 re-declares + 13 node-only = 45 files ✓; entry↔mirror names 1:1 except
  bench (documented). One doc fix: §6's node-only enumeration omitted
  `checkpoint_throttle.test.js` — named it.
* **Lineage + goldens + registry.** `lineage.js` ↔ `lineage.json` 37/37 in
  sync. 11 golden hashes in `golden.test.js` ✓. Registry holds 112 module
  keys incl. the R109 vol parts; `analyze/*` parts deliberately absent
  (driver covered by `analyze.test.js`, round-83 convention) — not a gap.
* **Lab results reds (4).** e128/e130/e133/e134 `failed` counts are the
  pre-registered falsifier guards firing, each matching its published finding
  to the digit (F-141 rho1 0.517/0.425; F-143 turnover 14.7→146.3 sign
  corrected; F-146 pred 0.70/0.72 < 0.992; F-147 majors-above-ladder). Verdicts,
  not bugs. Lead experiment refs all resolve; only "orphan" result is
  RUN_SUMMARY (the aggregate, expected).
* **Run corpus gap (annotated, not fixable here).** `src/runs/README.md` §6
  documents `20260930T154333-seed1` (the TODO-113 evidence) but the raw dir is
  not vendored in this workspace — added a one-line missing-artefact marker;
  the numbers table stands as the record. All other README run refs resolve
  to vendored dirs. Later sleeve runs live at operator-local `state/runs/`
  paths by convention — no change.
* **Deliberately kept (not issues).** 6 dead-surface exports (`lineage.js`
  schema constants — the JSON mirror's documented format; `funding_fetcher.js`
  `FUNDING_MINUTE`/`fetchFundingSeries` — the P4 follow-up fetch API).
  BUGS.md has no #50 heading — #50 lives in PLAN-round27 §2.8 (plan-internal),
  not a gap. Lab README "50 gated" left as-is (controls/integrity included).

## Open / owed (unchanged)

* `npm test` covering R109 + the S1 import cleanup. No uploads.
* L19 OPEN-vs-characterised verdict needs an owner (flagged S1, not changed).
