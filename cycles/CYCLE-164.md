# CYCLE-164 — Bug-check round: alias-sentinel fix + full re-proof

**Date:** 2026-10-02
**Goal:** full bug + sanity check on all touched code (user-ordered).

## The one bug found (fixed, 2 lines x2)

The round-110 alias comparison mapped `none`/`null` to the STRING `"null"`,
then tested `Number.isFinite("null")` (false) and fell back to raw-key
comparison — so `{band:"none", bandEps:null}` (semantically identical:
both mean "remove") threw "given twice with different values". Fixed in
both `parseSleeveRisk` and the `scoreSleeve` guard: `none`/`null` map to a
real `null` sentinel compared first; numerics compare numerically; garbage
still falls through to the loud refusal downstream. Caught by the check
battery itself (12/13 before, 15/15 after).

## Re-proof after the fix

* Unit battery on the shipped `parseSleeveRisk` + guard block: **15/15**
  (null/numbers/idempotent re-parse/alias forms/conflicts/garble/bare-flag).
* Browser `analyze` entry via harness: **298/298, 0 failures**.
* Docs wiring: **31/31** (cycles exist + indexed, §§74–79 + subsections,
  STATUS counts/steps, TODO 114/116/120/121 states, PLAN-next, RUNBOOK
  gate + ledger, research README).

## Disposition

Tree is green AI-side. Native gate (`npm test`) re-owed by the scoring.js
change — two lines, same paths the 133-block gate covers; operator runs it
with the 121 pair.
