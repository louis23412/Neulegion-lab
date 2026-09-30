# CYCLE-117 — Round 88: full bug + sanity sweep, lineage coherence, lab index rebuild

**Date:** 2026-09-30
**Goal:** operator-ordered end-to-end bug + sanity pass over repo and lab; fix coherence
gaps; consolidate docs; leave exact native commands.

## Sweep (this round)

* **Browser harness, full:** all 33 entries bundled + run AI-side — 0 failures
  (`analysis` 856, `analyze` 290, `contracts` 255, `walkforward` 90, `locks` 41,
  `modules` 59; `bench` prints timings only, no mirror — by design). Counts match the
  `RUNBOOK.md` §6 ledger (3119) and the `mirrors.test.js` 33/45 pins.
* **Static hunt:** the 20 TODO/FIXME/XXX/HACK hits in `src/` are doc cross-references in
  comments, not open work; the 50 `console.log` hits are CLI/runner/fetcher output paths,
  none on the locked hot path. No action.
* **Lab artefacts:** `run_all.js` registers e112–e118 (incl. e66); e109/e110/e111 write no
  `results/*.json` by design (in-session verification — same as the vol-series
  experiments); recent artefacts e112–e118 present.
* **Research sync:** `2308.11294` (network momentum across asset classes) re-verified via
  the arXiv API — the direct grounding of `sig-network-momentum` (round 87).

## Coherence gaps found + fixed

* **LINEAGE stale (the one real gap):** the four `NL-SIG-*@r30` rows still read UNTESTED
  with no numbers, while the 2026-09-27 corpus measured all four at K=6 (`RUN-ANALYSIS.md`
  §18.3) and `DROPPED.md` §2b dropped them. Fixed in four places: `src/lineage.js` +
  `docs/lineage.json` + `docs/LINEAGE.md` (vol/blend/regime DROPPED with numbers; network
  DROPPED with the TODO-113 re-measurement pointer) + TODO 102 CLOSED on the corpus
  evidence. Behavior-safe: `DROPPED_VARIANT_IDS` feeds only the default-roster guard
  (still empty) and `resolveVariant` stays state-blind, so the TODO-113 re-run command is
  unaffected. Harness re-run post-change: `analyze` 290, `contracts` 255, `modules` 59,
  `locks` 41 — all green, counts unmoved (no ledger change owed).
* **Lab index stale:** the `INDEX.md` cycles table ended at CYCLE-067 (49 rows missing)
  and the files CYCLE-081/082 never existed (rounds 48/49 had no contemporaneous cycle).
  Fixed: backfilled CYCLE-081/082 as marked reconstructions from `RUNBOOK.md`, generated
  rows 068–080 + 083–116 from the cycle files, fixed a pre-existing 036/037 misorder —
  the table is now 117 rows, 000–116 sequential. Also corrected the `F-01…F-87` header to
  `F-01…F-130`.
* **Docs dedup verdict:** no heavy duplication removed — the big files have distinct jobs
  (RUN-ANALYSIS = dated record, TODO = backlog, ROADMAP = plan, PLAN-roundNN = frozen
  history, FINDINGS = lab ledger). History is never deleted; staleness is fixed by
  superseding notes (TODO 102, LINEAGE rows), not rewrites.

## Operator commands (in order)

1. `npm test` — expect 132/132 (certifies the lineage-state change + everything else;
   the wrap mirror pins the 856 `analysis` count).
2. `bash scripts/round30-runs.sh gh` — the TODO-113 K=6 re-run (only after green).
   Upload `state/runs/<runId>/report.json`.
