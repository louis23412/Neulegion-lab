# CYCLE-137 — Round 107: bootstrap split + stacked-band + research 10j

**Date:** 2026-10-01
**Goal:** three tracks — (a) foundations: split the registered
`analysis/reality_check/bootstrap.js` (574 lines); (b) model track: does the
port recipe's no-trade band transfer to the stacked-16 book (e135); (c)
research: retry the sweep once (10j) after 10i's endpoint block.

## Work

* **Foundations: `reality_check/bootstrap.js` → `bootstrap/` ×3 + shim.**
  `inputs.js` (config + benchmark/relative-performance + safeRatio),
  `resampling.js` (rng stream, index draws, Politis-White selector, shared
  draws, standard errors), `tests.js` (RC/SPA/consistent/step-down). Bodies
  byte-identical (line-multiset verified); four privates gain `export` for
  inter-part use. Consumer edit: subsampling.js imports from
  `./bootstrap/inputs.js` (one line).
* **Registry/locks (R97 recipe).** Three `KNOWN_TESTS` rows + three module
  rows; three imports + three map rows in `locks.test.js`.
* **Verified AI-side, second run green.** First run caught two self-made
  defects (resampling.js missing safeRatio import; parent KNOWN row
  over-listed the shim contract) — locks 41/1 + analysis ReferenceError.
  After fix: locks 41/0, analysis 856/0, walkforward 90/0, analyze 294/0.
  e58 validationPass true (the split's own audit guard). No golden moves.
* **e135 stacked-band 3/3 SUPPORTED (F-148).** Pinned capped-0.125
  stacked-16 + band sweep {null, 0.005, 0.01, 0.03} at cost 4: every band
  lane beats daily net at lower turnover (0.40 vs 0.43/19.9x, 0.44/15.2x,
  0.42/8.8x); best 0.01, neighbor gap 0.00; null lane reproduces e132 to the
  digit. Native read for TODO 118: cap 0.125 + band ~0.01. e134 regressed
  4/3 (same recorded NEGATIVE). No spec change, no TODO.
* **Research 10j LANDED** (endpoint answers again; raw
  `arxiv-sweep-2026-10j.json`): 5 new notes (cascade subcriticality +
  heterogeneous precursors → TODO 95's liquidation leg; optimal perp
  liquidation → TODO 111's task form; collateral control → spot-leg costs;
  sign-reversal task form → closed L13, no reopen) + 3 convergence confirms.
  No doc changes.
* **Rerank.** Top tier: 116 + 118 (now with band read) + fade G5 + 111
  (task form sharpened). Queued: 117, L10, W5 venues.

## Result

F-148 (e135 band-transfers SUPPORTED). S51→S52. Operator commands:
`npm test` (covers the `bootstrap/` split + registry rows; no uploads).
