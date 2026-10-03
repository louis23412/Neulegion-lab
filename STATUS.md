# Lab STATUS — 30-second orientation (for the AI that mostly uses this lab)

**Counts (verified CYCLE-201, 2026-10-02):** 19 leads (board ARCHIVED, CYCLE-192) · 186 findings (F-01…F-81
full rows + summary table to F-186) · cycles CYCLE-000…CYCLE-201 · 147
experiment files (139 in `experiments/run_all.js` (146 steps) + 8 named (run_all + standalone s6a/s6b/s6c/s6e/m1/m4/c1/c2)), lab INDEX
names every cycle file.

**Start here:** `cycles/CYCLE-201.md` (firewall green — identity check owed) → `PLAN.md` (model track C2-verify→C3) →
`FINDINGS.md` (the ledger) → `leads/INDEX.md` (archived board, provenance only).

**One live track:** model core code only (C2-verify→C3; C1 CLOSED no-edit). Allocation CLOSED, S6f PARKED, M3-builds PARKED. Operator load: ONE command owed (post-delete ablation identity check).

**Native gate: CLOSED (CYCLE-180 operator proof 134/134). No operator load owed.**

**Open frontier:** model core code only — C1 (mean-pool readout replacement) →
C2 (optimizer/spec retire-test) → C3 (live-reader routing). Full unlock
checklist: `cycles/CYCLE-192.md` §2. L10 (bug hunt) stays permanently
ongoing. Allocation leads L01–L19 ARCHIVED (CYCLE-192) — provenance only.

**Operator queue (native-only):** CLOSED — nothing owed, nothing asked.

**Gate (round 110) CLOSED 2026-10-02:** operator `npm test` green (133/133)
plus both proof runs uploaded (`20261002T071743-seed1`,
`20261002T080323-seed1-sleeve`). No gate owed. Next AI-side: coherency +
Phase-D background between operator runs.

**Rules that prevent repeat work:** the lab never edits the repo; full finding
rows stop at F-81 — later findings live as summary-table rows (do not mistake
the heading count for the ledger); `src/analyze/models.js` is the models shim
(there is no `src/analysis/models.js`); workspace files import in the live page
via `./src/…`, not in the `execute_js` worker (use the harness recipe in
`RUNNER.md`).

*Refresh this file every sweep (counts + frontier + gate), or delete it if it
ever disagrees with `leads/INDEX.md`.*
