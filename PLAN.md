# PLAN — the trackable next-step plan (post-116)

**Maintained across iterations:** each step has owner / gate / effort /
status. When a step moves, update its status line here AND the linked record
— future iterations pick up from this file + `STATUS.md`.

## Director rule (locked 2026-10-02 — operator directive)

The director (AI) decides: what stays, what gets parked/archived, what
locks/unlocks, and the push toward a model with potential edge. The operator
runs commands and uploads proof — never asked to make project-direction
decisions. Open items are resolved by the director, in-session when possible.

## Where we are (2026-10-02)

TODO 116 done natively: 16-panel gh + cadenced/exposure + test=10 all
keep-off; breadth half-gate passed (vol effStreams 3.73, pooled DSR 0.9706);
87 acceptance met (neutral 10/15/20); test=10 shift twice-measured. Full
readout: repo `RUN-ANALYSIS.md` §84, lab CYCLE-171/172.
TODO 122 done AI-side (CYCLE-173); 122b native test owed (operator commands
below). Research synced 10q.

## Numbered findings from the 116 deep-dive (CYCLE-172)

* **D-01 — the sign gap is measurement, not alpha.** 15-bar fold Sharpes are
  heavy-tailed and zero-inflated (t15: std 4.1, range −12.5..+10.2; baseline
  median exactly 0, positiveFraction 0.36). Mean-of-Sharpes ≠ pooled Sharpe;
  signals win MORE folds (0.48–0.50 vs 0.36) with LOWER mean ⇒ fatter left
  tail. Promotion math must name its aggregation (TODO 122a → TODO 85 datum).
* **D-02 — network is the orthogonal arm, not the strong one.** Highest
  within-stream corr (0.40) but lowest excess-corr with other signals; lowest
  effStreams (2.30) yet most independent. Breadth ≠ independence — track both.
* **D-03 — exposure-match is often inconstructible.** 89% vs 46% nonzero;
  matched deadZone 0.50 vs 0.055, tolerance missed on all arms. Datum for the
  TODO 85 decision: prefer quote-only-at-matched-exposure (rescaling the
  policy is worse), and accept that some comparisons have no matched quote.
* **D-04 — power is time-bound.** Paired clusters 36 (need 125) at test=15,
  54 (need 331) at test=10. Symbols cannot buy clusters, only trim
  per-window se — this is the quantitative case for parking 117.
* **D-05 — TIA 4h funding is benign.** 4931×4h rows bucket into 2466×8h with
  summed rates (correct 8h carry) — no re-harvest for 118.
* **D-06 — run.json provenance gap.** `--cadences`/`--exposure-match` not
  recorded — FIXED CYCLE-173 (keys + native test; native owed).
* **D-07 — cost ladder shape.** BE 8.08/7.99/4.50/5.81 (mom/vol/blend/net);
  +5 bps leaves mom/vol barely positive pooled (0.19/0.20); +10 kills all.
* **D-08 — 122c closes 117.** Wave-2 buys ~8% paired-se trim under measured
  correlations (closest t 1.36→1.47, still ns). Revisit condition is a
  number: an arm at one-sided p≲0.07.

## Decision log

| Item | State | Rationale |
|---|---|---|
| 116 | DONE | §84 |
| 117 (wave-2) | PARKED (director) | D-04 + D-08; revisit only at p≲0.07 boundary |
| 118 (midcap carry) | UNLOCKED (director) | honesty path decided: harvest midcap marks (primary); funding-only pre-reg fallback only if harvest fails |
| 84 / 87 | evidence banked | §84 readouts appended to both items |
| 85 | scoping data added | D-03 + 122a datum; demotion proposal needs DESIGN + gate |
| 122 (follow-ups) | DONE AI-side | CYCLE-173; 122b native test owed |
| G5 honest-book | PENDING on 118 | highest value once midcap honest read exists |

## Sequenced next steps

| # | Step | Owner | Gate | Effort | Status |
|---|---|---|---|---|---|
| S0 | `test.sh analyze_cli` + `npm test` (122b native) | operator | none | ~8 min | OWED |
| S1 | midcap marks harvest → repo `src/data/marks_midcap_8h.json` | AI | none | in-session | DONE (CYCLE-174: 8/8, t0 shared, 2467 slots; stacked-16 merged) |
| S2 | 118 sleeve runs (8-midcap honest + stacked-16) | operator | S1 file lands | minutes | QUEUED (`bash scripts/sleeve-midcap-118.sh all`) |
| S3 | 122a/b/c lab follow-ups | AI | none | in-session | DONE (CYCLE-173) |
| S4 | G5 honest-book decision | director | S2 | — | PENDING |
| S5 | 117 revisit | director | p≲0.07 boundary | ~60 min | PARKED |

## Budgets (measured, for planning)

16-panel gh ~95 min · cadenced ~100 min · test=10 ~140 min · sleeve minutes.

## Operator command conventions (locked — do not drift)

* One area: `bash scripts/test.sh <name>` (names listed by `bash scripts/test.sh`).
  Never present raw `npx node --test ...` — the test.sh form only.
* Structural gate: `bash scripts/test.sh quick`. Full gate: `npm test`
  (= `bash scripts/test.sh full`).
* Round scripts: `bash scripts/<round>-*.sh <stage>` (`port`|`gate`|`runs`|`all`),
  default `all`; always `cd <repo-root>` first.
* Present one command block per cycle, in run order, with expected
  wall-time and what to upload/paste back.
* Operator runs commands + uploads proof; direction decisions are the
  director's — never present an open decision to the operator.
