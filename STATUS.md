# Lab STATUS — 30-second orientation (for the AI that mostly uses this lab)

**Counts (verified e138, 2026-10-02):** 19 leads · 168 findings (F-01…F-81
full rows + summary table to F-168) · cycles CYCLE-000…CYCLE-158 · 139
experiments, all registered in `experiments/run_all.js` (153 steps) · lab INDEX
names every cycle file.

**Start here:** `leads/INDEX.md` (the board) → `FINDINGS.md` (the ledger) →
`FOLD-BACK.md` (the port queue R1…R8) → `cycles/CYCLE-158.md` (latest state).

**Open frontier:** L19 only (OI-change sleeve: standalone, weak/churny,
band-pinned `eps ≈ 0.03`; does not add to R8). L10 (bug hunt) is permanently
ongoing. Everything else is SUPPORTED-ported or NEGATIVE-closed.

**Operator queue (native-only, in order):** TODO 116 → 118 → 117 (midcap
breadth/carry ports + runs). Gated behind them: config-robustness (84/85/87),
model benchmark (86), sized-leg G5 (104), unseen execution (106).

**Owed gate (round 110):** `npm test` from the repo root, expect 133/133
(risk-override flags + 4 analyze checks + 1 CLI spawn block; AI-side analyze
298/298 green). Then TODO 116 → 118 → 117.

**Rules that prevent repeat work:** the lab never edits the repo; full finding
rows stop at F-81 — later findings live as summary-table rows (do not mistake
the heading count for the ledger); `src/analyze/models.js` is the models shim
(there is no `src/analysis/models.js`); workspace files import in the live page
via `./src/…`, not in the `execute_js` worker (use the harness recipe in
`RUNNER.md`).

*Refresh this file every sweep (counts + frontier + gate), or delete it if it
ever disagrees with `leads/INDEX.md`.*
