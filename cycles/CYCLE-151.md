# CYCLE-151 — Ledger arithmetic S12: check-count sum, data dirs, theory sync (no change)

**Date:** 2026-10-02
**Goal:** verify the numbers readers quote without checking: the RUNBOOK
ledger sum, the TODO-cited lab data dirs, and THEORY's correction state.

## Work

* **Ledger arithmetic:** the 32-row browser-entry table sums to exactly the
  claimed **3123**; `bench` is the only entry off-table by design (timings
  only). Table names == files on disk both directions.
* **Lab data cited by TODO 116/117/118:** `data/midcap/`, `data/midcap2/`,
  `data/midcap_funding/` all present with 9 files each (8 series + manifest);
  the `harvest_midcap_1h.js` recipe cited in TODO exists. Operator ports have
  everything they need vendored.
* **THEORY.md:** corrections are folded in-line (F-45 corrects F-28, F-48/51
  scope the walk-forward rules, F-56/59 bound the construction claims) — no
  stale joint. J1–J6 headings intact.
* **Rerank:** unchanged (S11 tiers stand; 18 opens; archive bar not met).

## Verification (AI-side, this round)

* Static census only (see numbers above). No runtime needed.

## Open / owed

* `npm test` (R109 + S1 + S5 + S7 fix; S8–S12 docs-only). No uploads.
