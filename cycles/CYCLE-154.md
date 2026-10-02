# CYCLE-154 — Doc-pointer sync S15 (no change)

**Date:** 2026-10-02
**Goal:** make every count a reader can quote match the tree after CYCLE-153.

## Fixes applied

* `STATUS.md`: counts 162 → 165 findings, cycles 000…151 → 000…154;
  owed-gate line replaced with the CLOSED record (132/132, 2026-10-02).
* `src/README.md` ledger line: native confirmation 2026-09-30 → 2026-10-02
  (same 132/132; now covers R109 + S1/S5 + S7).
* `INDEX.md`: cycle table rows 152–154 appended (was ending at 151).
* `FINDINGS.md`: summary rows F-163…F-165 appended (81 full + 84 summary).
* `TODO.md`: S13–S15 rerank note appended (tiers unchanged, gate CLOSED).
* `RUN-ANALYSIS.md`: §§67–69 appended.

## Verification (AI-side, this round)

* Post-write grep: no remaining "owed `npm test`" / "still owed" line
  refers to a live gate — all historical rows keep their past-tense scope
  (cycle tables, closed findings), all pointers read CLOSED.
* Counts cross-checked: FINDINGS max F-165 with 81 full + 84 summary rows;
  cycles/ 157 files (000…154 + README); experiments 138/138 in run_all.
