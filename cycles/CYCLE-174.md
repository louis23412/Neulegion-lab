# CYCLE-174 — Director takes the decisions; S1 resolved by harvest (2026-10-02)

**Directive locked:** the director decides park/lock/unlock/stay and pushes
toward edge; the operator runs commands + uploads proof. Recorded in
`PLAN.md` (Director rule); S1 resolved the same session, not after tests
(independent work streams run in parallel).

## S1 resolution: harvest midcap marks (primary path, no fallback needed)

* Durable harvester `src/NeuLegion-lab/data/harvest_midcap_marks.js`
  (Vision monthly markPriceKlines, grid T = open+8h, missing → null).
* Two self-corrections en route, both caught by asserts: (1) without May
  2024 the grid starts 08:00 (the kline ending 6/1 00:00 opens 5/31 16:00);
  (2) assemble took the global min (May slots) — now trims to the funding
  window via `startT`.
* Landed: repo `src/data/marks_midcap_8h.json` — 8/8 symbols, shared t0
  2024-06-01T00:00, 2467 slots, 3 nulls each (0.1%); values sane (ARB
  1.12 → 0.11). Plus merged `src/data/marks_stacked16_8h.json` (16 symbols,
  per-symbol maps keep own t0s).
* Parser-compatibility verified against `parseMarksJson` source (needs only
  t0/stepMs/v[]; the majors file's own stale nKlines ≠ v.length is
  pre-existing and irrelevant).

## S2 ready: `scripts/sleeve-midcap-118.sh`

Stages `mid`/`midband`/`sixteen`/`sixteenband`/`all` (flat + cap/band on both
panels, minutes total). Order verified against the manifest (carry-files
positional match) and the `sleeve-runs.sh honest` invocation shape.
TODO 118 carries the turnkey line.

## PLAN.md updates

Decision log: 117 PARKED (director), 118 UNLOCKED (director), S1 DONE,
S2 QUEUED-script-ready. Command conventions + budgets unchanged.

## Next

Operator: S0 tests, then S2 (`sleeve-midcap-118.sh all`) — upload the four
report.json paths. Then S4 (G5 honest-book, director's decision).
