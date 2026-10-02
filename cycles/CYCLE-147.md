# CYCLE-147 — Registry census S8: every declared export resolves (no code change)

**Date:** 2026-10-02
**Goal:** verify the lock-registry's file→export contracts against the actual
tree (the direction that catches split-drift: a part file renamed or a shim
that stopped re-exporting a pinned name).

## Work

* **Export census (comment-stripped parser, `export *` followed one level):**
  `ANALYSIS_MODULES` (65 files) + `CORE_MODULES` (31) + `SUPPORT_MODULES` (16)
  = **916 declared names, 0 missing, 0 unresolvable files**. (First pass
  reported 22 false "missing" — the parser ate apostrophes inside registry
  comments; re-ran comment-stripped. Lesson recorded, same class as S5's
  comment-masked imports.)
* **Out of scope by shape:** `HIVEMIND_REGISTRY`, `CONTROLLER_REGISTRY`,
  `PLUGIN_REGISTRY` are capability-shaped (status/domain/proves), not
  file→export maps — but their `proves: [...]` refs were checked instead:
  **30/30 resolve** to real `test/browser/entries/*.test.js` or
  `test/node/*.test.js` files.
* **Lead citations:** all 72 `` `eNN…` `` experiment cites in `leads/INDEX.md`
  resolve to files under `experiments/`; 0 missing.
* **Reverse direction** (unlisted exports) deliberately not gated: the
  `analyze.js` SUPPORT entry documents its list as intentionally
  non-exhaustive.

## Verification (AI-side, this round)

* Static only (see numbers above). No runtime needed — nothing moved.

## Open / owed

* `npm test` (R109 + S1 + S5 + S7 fix; S8 is docs-only). No uploads.
