# CYCLE-108 — Round 81: `sleeve_score.js` split (foundations) + one test-wording fix

**Date:** 2026-09-29
**Goal:** `src/sleeve_score.js` (884 lines, 23 exports — the sleeve→book→risk→gate
composition beside `analyze.js`) is split into managed parts per the CYCLE-104/106
recipe, with zero behavior change; plus a round-80 test bug found by the split's
verification.

## Landed (repo, round 81)

* `src/sleeve/` (6 parts, sliced bodies byte-identical to the single file):
  `registry.js` (ids + resolver), `view.js` (carry view + marks/positioning
  inputs + OI panels), `scoring.js` (sleeve→single book→cap-band→gate),
  `evidence.js` (DSR/yearly/first-last), `sizing.js` (trailing vol +
  adaptive/drawdown + sized re-score), `report.js` (runSleeveReport +
  formatter). DAG is acyclic (registry ← scoring ← sizing ← report; view ←
  report; evidence ← report).
* `src/sleeve_score.js` is now a re-export shim carrying exactly the 23-name
  contract. One self-caught failure during the round, caught by e112 before any
  green run: `report.js` uses `SIZED_SLEEVE_DEFAULTS.window` as a default
  parameter but the constant lives in `sizing.js` — the cross-part import was
  missing (the single-file version never needed it). Fixed with one import line.
* No registry rows: `sleeve_score.js` was never in ANALYSIS_MODULES (driver
  layer, beside analyze.js), so the parts need none either — locks confirms 41/0
  unchanged. No check counts move anywhere (pure move — mirrors untouched:
  contracts pins 255, analyze pins 290, modules pins 59).
* Test-wording fix (round-80 bug, pre-existing — proven independent of this
  split): the analyze entry's positioning-sleeve check asserted
  `/toptrader|open interest/i` against a reason string that says
  `--oi-file (open-interest JSON...)` — hyphen vs space, no 'toptrader' — so
  the check could never pass (289/290 in the harness). The reason text is
  correct (it names the data requirement); the regex was widened to
  `/toptrader|open[- ]interest|oi-file/i`. Test-only, counts unchanged.

## Verified (no new numbers — a foundations round)

* shim identity 23/23 (every contract name resolves to its part's export);
  e112 15/15 through the shim with identical economics (oi 0.67/197/11.4, fade
  1.05/7.9/185.1); e75 6/6 (shipped carry 11.26); contracts 255/0; analyze
  290/0; locks 41/0; modules 59/0.
* e112 added to `experiments/run_all.js` (with F-123 + results artefact).

## Decision

The sleeve composition's home is now six reviewable files; the next estimator /
gate work lands in the open part. Remaining: native gate (`npm test` +
`bash scripts/sleeve-runs.sh oi/top`), W5 venues (operator data), W6
L10-co/cp/cq/cr (re-freeze decision), and the next foundations candidate —
`src/analyze.js` (3674 lines, 45 exports) — deliberately deferred: it carries
the CLI side effects and Node-only imports, so its split needs the native gate
first. Hand to `npm test`.
