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
* **D-09 — honesty haircut, now exact (CYCLE-177).** e123 funding-only 18.11
  vs honest mid-8 flat 8.16 ⇒ 9.95/yr illusion (55%); honest retains 45%.
  Funding-only numbers stay unquotable.
* **D-10 — band dividend on mid-8 (CYCLE-177).** Net +0.40 (8.16→8.56),
  turnover ÷2.1 (11.09→5.22), BE ×2.0 (34.2→69.6) — smaller net gain than
  stacked (+0.63) but the same BE-doubling shape. The band is a cost
  mechanism, not a panel one.
* **D-11 — BE inversion (CYCLE-177).** Breadth without band LOWERS the buffer
  (mid-flat BE 34.2 > stacked-flat BE 24.7) while raising net (8.16→8.87).
  Breadth is the net lever, the band is the BE lever — quote them as a pair.
* **D-12 — breadth decomposition at flat (CYCLE-177).** Majors 6.25 → mid-8
  8.16 (+1.91) → stacked-16 8.87 (+0.71 over mid-8). Midcap legs beat majors
  legs outright; stacking adds, diminishing but positive.
* **D-13 — decay is lane-independent (CYCLE-177).** Slopes −0.095…−0.128 and
  yearly shape 0.43–0.47 → 0.17–0.23 → 0.20–0.25 in ALL four lanes, incl. a
  universal 2025→2026 uptick (+0.02…+0.03). Regime shape, not policy
  artefact. S4 stands, strengthened (4 lanes).
* **D-14 — no lane dominates, CORRECTED CYCLE-178.** Best net =
  stacked-band (9.50); best BE = mid-band (69.6). Correction: `neutral` is
  the first-PC-hedged Sharpe of the same book (full-sample beta), NOT an
  equal-weight portfolio — the neutral−net gap (+0.08 mid / +0.45 stacked)
  is an in-sample hedge upper bound, not a portfolio to hold.
* **D-15 — trailing hedge FAILS, decided: no overlay (CYCLE-178, S6a).**
  `experiments/s6a_hedge_overlay.js` 7/7: implementable trailing-beta
  hedge (W270/W540, costed) trails the book on all 3 tested lanes
  (stkBand 9.50 → 9.10/7.41). Loss is bad-beta, not cost (mean|beta|
  ≈ 0.04 — book already near-pure; betaSd 0.027; stale W540 catastrophic).
* **D-16 — AI-side verification path works (CYCLE-178).** All 4 banked lanes
  reproduce to 1e-9 through the harness on workspace data (~10 s) — no tree
  drift; future S6 runs can be pre-verified AI-side before native spend.
* **D-17 — band is purely a cost story (CYCLE-178).** Per-bar means backed
  out of report arithmetic: mid gross −4.2% / cost −53% → net +2.2%;
  stacked gross −6.3% / cost −61.5% → net +4.4%. Breadth at flat: gross
  +12.3% / cost +55.7% → net +6.5% (the D-11 mechanism, quantified).
* **D-18 — decay bracket −0.09…−0.17/yr (CYCLE-178).** Bars-weighted OLS
  −0.091 (robust — 2025 dominates by bars) vs halves-implied
  −0.128…−0.172. S6c haircuts the bracket, never a point. Halves are
  seasonally balanced → primary; OLS has 3 points + seasonal mix.
* **D-19 — window-dependence + stabilizers (CYCLE-178).** Band dividend
  +0.18 lab full-history vs +0.40/+0.54/+0.63 this window. Worst-block
  breadth ×2.1–2.5. DE 8.75–10.81, lowered by band + breadth.
* **D-20 — S6c constraints (CYCLE-178).** neverBreach 11.5e6, OI-bound on
  LINK (F-41). Crash-robustness (F-17/F-21) is out-of-window — label it.

## Decision log

| Item | State | Rationale |
|---|---|---|
| 116 | DONE | §84 |
| 117 (wave-2) | PARKED (director) | D-04 + D-08; revisit only at p≲0.07 boundary |
| 118 (midcap carry) | DONE (director, CYCLE-177, 4/4) | mid-flat 8.16/BE 34.2 closes e123 apples-to-apples; §85.2, D-09…D-14 |
| 84 / 87 | evidence banked | §84 readouts appended to both items |
| 85 | readout banked (§85 + §85.2) + S4 attestation decided + S6 scoped | unseen PASS / decay FAIL (4-lane); D-14 frontier is the S6 question |
| 122 (follow-ups) | DONE AI-side | CYCLE-173; 122b native test owed |
| G5 honest-book | DECIDED (director, CYCLE-176) | unseen PASS (midcap legs); decay FAIL measured; g5verdict false |

## Sequenced next steps

| # | Step | Owner | Gate | Effort | Status |
|---|---|---|---|---|---|
| S0 | `test.sh analyze_cli` + `npm test` (122b native) | operator | none | ~8 min | OWED |
| S1 | midcap marks harvest → repo `src/data/marks_midcap_8h.json` | AI | none | in-session | DONE (CYCLE-174: 8/8, t0 shared, 2467 slots; stacked-16 merged) |
| S2 | 118 sleeve runs (8-midcap honest + stacked-16) | operator | S1 file lands | minutes | DONE (CYCLE-177: 4/4 — mid-flat 8.16/BE 34.2 closes the set) |
| S3 | 122a/b/c lab follow-ups | AI | none | in-session | DONE (CYCLE-173) |
| S4 | G5 honest-book decision | director | S2 | — | DECIDED (CYCLE-176, strengthened CYCLE-177: decay lane-independent, 4 lanes) |
| S5 | 117 revisit | director | p≲0.07 boundary | ~60 min | PARKED |
| S6a | trailing-beta hedge overlay (implementable neutral) | AI | none | ~10 s | DONE-DECIDED (CYCLE-178: hedge fails on all lanes — no overlay; D-14 corrected) |
| S6b | within-book allocation (blends over the D-14 frontier) | AI | S6a | ~2 s | DONE-DECIDED (CYCLE-179: frontier computed 5/5; operating blend a=0.25 mid-band — net 9.87/BE 62.0/worstBlock 0.141; fallback a=0.5) |
| S6c | carry-vs-cash sizing of the a=0.25 operating book: forward-net bracket D-18 (−0.09…−0.17/yr, halves primary); target-risk fraction; hard cap neverBreach 11.5e6 (D-20); pricings 2605.05089 (collateral), 2603.09164 (SaR), 2601.10812 (liquidation) from 10r. DESIGN + gate AI-side, then native if it needs runs. Gate: OPEN (S6b decided) | director | S6b | — | GATED-OPEN |
| S6d | momentum weight | director | 117 revisit number (p≲0.07) | — | LINKED-PARKED (no unpark needed for S6a–c) |

## Budgets (measured, for planning)

16-panel gh ~95 min · cadenced ~100 min · test=10 ~140 min · sleeve scoring ~seconds (280 ms this leg — the "minutes" was script + test overhead).

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
