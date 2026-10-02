# CYCLE-142 — Coherency sweep S3: cross-doc consistency (no measurement round)

**Date:** 2026-10-02
**Goal:** check the docs agree with each other (DROPPED ↔ lineage, FOLD-BACK
queue ↔ banked items, THEORY frontier ↔ shipped code); close small gaps found.

## Work

* **DROPPED ↔ lineage.** All 12 DROPPED branches in `lineage.json` are named
  in `DROPPED.md` (0 missing). `lineage.js` ↔ `lineage.json` 37/37 (S2).
* **FOLD-BACK queue.** R6 dropped (converges with the S1 TODO-91 archive),
  R9 latent (L10-ah, consistent), R7/R8 banked. One real gap: R8 carried no
  status for the e135/e136 stacked-16 band read — appended
  (CYCLE-137/138: band transfers, best 0.01, trailing pick 8/8; native read
  cap 0.125 + band ~0.01 supersedes the 0.03 lab-panel recipe for 16-wide).
* **THEORY frontier.** J1–J4, J6, E-A…E-E current (E-D/E-E marked closed).
  J5 was stale ("no vol targeting" + only a CYCLE-004 note) — appended the
  rounds 67–69 + 98–99 update (V2.2 risk plugins exist but unpromoted; sized
  book still G5-less via TODO 104). Joint stands.
* **Corpus + scripts (S2 carry).** Run dirs: 1 smoke + 7 in `src/runs/`, no
  dupes; `gh` is K=5 (TODO 114), sleeve `oi`/`top` stages present.

## Open / owed (unchanged)

* `npm test` (R109 + S1 cleanup). No uploads. L19 verdict still with the owner.
