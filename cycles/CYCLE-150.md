# CYCLE-150 — Ledger sync S11: raw snapshots, goldens, fold-back queue (one gap closed)

**Date:** 2026-10-02
**Goal:** verify the research-ledger tails that rot silently: raw sweep
snapshots, golden fingerprint claims, and the FOLD-BACK queue against the
ported tree.

## Work

* **Raw snapshots: 43/43 parse** (`docs/research/raw/`, 09b–09z + 10a–10n).
  README covers per-file from 09b (`## Later sweeps (09r–10n…)` extends the
  per-file list); every file on disk is listed, none missing. No repair needed.
* **Goldens: 11/11 present** in `test/browser/entries/golden.test.js` (6 `hm:`
  + 5 `ctl:` per `LOCKED.md`'s bit-exact contract — an `hm:`-only grep reads
  6 and looks short; recording the 6+5 composition so the next census doesn't
  re-discover it).
* **FOLD-BACK queue: one real gap found and closed.** R1/R2/R3/R5 PORTED,
  R6 dropped, R7/R8 PORTED V2.2 bit-verified, R9 LATENT — all current. But
  **R4 had no port status** although the basis-marking half went native in
  round 78 (opt-in `--carry-marks`, e74 semantics, `sleeve/view.js` +
  `analyze/cli/main.js` both carry the flag; `sleeve-runs.sh honest` is the
  turnkey). Appended the R4 status line (predicted honest net ≈ 6.2 vs
  shipped-marks 11.26; TODO 95 remainder is borrow/margin + execution, not
  marking). No code change.
* **Rerank:** unchanged (S10 tiers stand; 18 opens; archive bar not met).

## Verification (AI-side, this round)

* Static census + flag-existence grep (see above). No runtime needed.

## Open / owed

* `npm test` (R109 + S1 + S5 + S7 fix; S8–S11 docs-only). No uploads.
