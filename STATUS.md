# Lab STATUS — 30-second orientation (for the AI that mostly uses this lab)

**Counts (verified CYCLE-170, 2026-10-02):** 19 leads · 168 findings (F-01…F-81
full rows + summary table to F-168) · cycles CYCLE-000…CYCLE-170 · 139
experiments, all registered in `experiments/run_all.js` (146 steps) · lab INDEX
names every cycle file.

**Start here:** `leads/INDEX.md` (the board) → `FINDINGS.md` (the ledger) →
`FOLD-BACK.md` (the port queue R1…R8) → `cycles/CYCLE-170.md` (latest state).

**Open frontier:** L19 only (OI-change sleeve: standalone, weak/churny,
band-pinned `eps ≈ 0.03`; does not add to R8). L10 (bug hunt) is permanently
ongoing. Everything else is SUPPORTED-ported or NEGATIVE-closed.

**Operator queue (native-only, in order):** TODO 116 (16-panel port + `gh`
with `--cadences` + `--exposure-match` and a `--test=10` leg, per repo
§76) → 118 → 117 (midcap breadth/carry ports + runs).
Gated behind them: config-robustness (84/85/87), model benchmark (86),
sized-leg G5 (104), unseen execution (106).

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
