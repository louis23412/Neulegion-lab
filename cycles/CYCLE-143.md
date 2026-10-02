# CYCLE-143 — Coherency sweep S4: lead-library refresh (no measurement round)

**Date:** 2026-10-02
**Goal:** bring the lead files back to the measurements; bless the one
taxonomy drift found.

## Work

* **Archived-item cross-refs.** Post-archive framings of TODO 91/92/98/100/
  103/108 elsewhere in the docs are all historical (ROADMAP round-29 narrative,
  the round29-registry snapshot) — no live contradiction. FOLD-BACK R6
  (dropped) and THEORY E-D (closed) already agree with the 91 archive.
* **PROTOCOL taxonomy.** L07's `PARTIALLY CLOSED` compound status had no
  licence in §2's enum — added one (compound statuses allowed when branches
  measured differently; each branch names its verdict).
* **Five lead files refreshed** (log + Last-updated; verdicts unchanged):
  L16 → CYCLE-138 (e135/e136 stacked band 0.01, 8/8 holdout), L17 → CYCLE-134
  (e132 stacked cap, load-bearing order), L18 → CYCLE-108 (e113 14/14,
  native fade gate), L09 → CYCLE-129 (e126/e127 sizing double-negative,
  closed-loop amendment), L03 → CYCLE-126 (e123/e124 carry breadth).
  Board rows left as summaries; L19 untouched (owner verdict pending).

## Open / owed (unchanged)

* `npm test` (R109 + S1 cleanup). No uploads.
