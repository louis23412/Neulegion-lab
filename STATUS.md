# Lab STATUS — 30-second orientation (for the AI that mostly uses this lab)

**Counts (verified sweep S12, 2026-10-02):** 19 leads · 162 findings (F-01…F-81
full rows + summary table to F-162) · cycles CYCLE-000…CYCLE-151 · 138
experiments, all registered in `experiments/run_all.js` (152 steps) · lab INDEX
names every cycle file.

**Start here:** `leads/INDEX.md` (the board) → `FINDINGS.md` (the ledger) →
`FOLD-BACK.md` (the port queue R1…R8) → `cycles/CYCLE-145.md` (latest state).

**Open frontier:** L19 only (OI-change sleeve: standalone, weak/churny,
band-pinned `eps ≈ 0.03`; does not add to R8). L10 (bug hunt) is permanently
ongoing. Everything else is SUPPORTED-ported or NEGATIVE-closed.

**Operator queue (native-only, in order):** TODO 116 → 118 → 117 (midcap
breadth/carry ports + runs). Gated behind them: config-robustness (84/85/87),
model benchmark (86), sized-leg G5 (104), unseen execution (106).

**Owed gate:** `npm test` from the repo root, expect 132/132 (covers R109 + the
S1/S5 cleanups + the S7 `analyze.js` dispatch guard). No uploads.

**Rules that prevent repeat work:** the lab never edits the repo; full finding
rows stop at F-81 — later findings live as summary-table rows (do not mistake
the heading count for the ledger); `src/analyze/models.js` is the models shim
(there is no `src/analysis/models.js`); workspace files import in the live page
via `./src/…`, not in the `execute_js` worker (use the harness recipe in
`RUNNER.md`).

*Refresh this file every sweep (counts + frontier + gate), or delete it if it
ever disagrees with `leads/INDEX.md`.*
