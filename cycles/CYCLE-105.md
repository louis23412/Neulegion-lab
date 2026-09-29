# CYCLE-105 — Round 72/73: feedback sizing (research sync + e108 + the `drawdown` mode)

**Date:** 2026-09-29
**Goal:** close the two open sizing items — the `voltarget2603` feedback-control
follow-up and a fresh literature grounding for the sizing/control program.

## Round 72 — research sync (repo)

* Fresh date-sorted arXiv sweep → `docs/research/raw/arxiv-sweep-2026-09k.json`
  (76 entries, 12 triaged: 2 already cited, 9 new registry keys, 1 noted
  alternative).
* Nine new citation keys (`cashoverlay2606`, `ddrestart2303`, `perpfund2609`,
  `perpfundamentals2212`, `spillvol2608`, `factorvol2508`, `roughvol2605`,
  `voldrag2607`, `kellyvix2508`) in `test/lock-registry.js` + `docs/CITATIONS.md`
  (vol-forecasting, trading-costs, cross-sectional sections).
* The sweep independently re-found the two already-cited combination papers
  (2609.29096, 2608.28116) — relevance confirmation, not duplication.

## Round 73 — e108 + the `drawdown` mode (F-118)

* `e108_feedback_sizing.js` (7/7): four causal governors (all half-prefix
  identical) on the honest carry book — self 7.80/2.34%, stress 7.42/1.38%,
  restart 7.94/1.88% (one restart), brake 7.19/1.49%. The first draft bound the
  brake to the sized equity and measured it vacuous (0 bars) — rewritten to the
  cash-overlay frame (governors read the risky sleeve) before any green run.
* Caveats recorded in F-118: one DD episode (all first-half DD = full-sample),
  turnover unmeasured lab-side (the repo re-score prices it — the native run
  is the cost verdict).
* Repo: `drawdownGovernor` + `ddCap: 0.05` + `drawdown` parse/score path in
  `sleeve_score.js`; help text in `analyze.js`; ten §R checks (one self-caught
  failure during the round — my own check's hand expectation, not the code:
  a −0.005 bar IS a 0.5% DD, g = 0.9); node `contracts` re-pin 221→231;
  `analyze_cli` +1 drawdown run block (native); lock-registry note + citation.
* Restart/brake stay lab-side until cost-accounted (documented follow-up).

## Verified

* contracts 231/0, locks 41/0, analyze 289/0 (sandbox); e108 7/7.
* Ledger 3078 → **3088** browser checks; node blocks stay 132 (the CLI
  extension rides the existing sleeve block).

## Decision

The sizing program is complete through feedback control: scalar (leverage,
F-116) → adaptive (timing, F-117) → governed (feedback, F-118). Remaining:
G5 gate runs (native — the `--sleeve-sizing=drawdown` run prices the turnover
question), W5 venues (operator data), W6 L10-co/cp/cq/cr (re-freeze decision).
Hand to `npm test` (full gate + `test:sleeve` for the new drawdown block).
