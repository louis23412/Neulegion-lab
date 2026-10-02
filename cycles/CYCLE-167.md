# CYCLE-167 — 116 port package: verified recipe, no guessing left

**Date:** 2026-10-02
**Goal:** make TODO 116 executable blind: verify every claim the recipe
depends on, derive exact commands + manifest entries, fold in the §76
measurement legs (87/84 acceptance).

## Verified AI-side (workspace files)

* 8/8 midcap series: 19,728 rows, 2024-06-01 → 2026-08-31, 0 bad closes,
  0 step gaps. Filenames already repo-conventional (straight `cp`).
* `resolveSymbolFiles` manifest-driven + case-insensitive + throws on
  unknown: `--symbols=all` auto-covers the 8 new entries; §J2 checks are
  generic over the manifest.
* `gh` stage flags quoted verbatim from `scripts/round30-runs.sh`
  (price-only K=5 + ladder; no script edit needed for 16 symbols).
* `--cadences=10,15,20` restatement is pure post-processing (no extra fits);
  the `--test=10` leg is one more ~45-min run.

## Deliverable

Repo `RUN-ANALYSIS.md` §83: copy block, 8 manifest entries
(`minRows: 19_000`), three run commands, three pre-registered reads in
decision order (116 gate → 87 acceptance → 84 record).

## Next cycle

CYCLE-168: regular bug + sanity sweep over the session's touched code
(scoring.js sentinel fix is the only scored-path change since the 133
gate — confirm the native `npm test` the operator ran covers it, or queue
a re-run), plus research-watch (no full sweep unless a front moves).
