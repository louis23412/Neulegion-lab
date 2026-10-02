# CYCLE-139 — Round 109: vol split + portfolio audit + research 10l

**Date:** 2026-10-02
**Goal:** three tracks — (a) foundations: split the registered
`analysis/forecast/vol.js` (405 lines); (b) model track: audit the scoring
path itself (e137); (c) research: fresh sweep (10l).

## Work

* **Foundations: `forecast/vol.js` → `vol/` ×2 + shim.** `estimators.js`
  (realized vol, EWMA/AR/ridge-AR, MSE/QLIKE) + `tournament.js` (contests,
  model slot, promotion decision). Byte-identical; no added exports; zero
  imports in the family.
* **Registry/locks (R97 recipe).** Two `KNOWN_TESTS` rows + two module rows;
  two imports + two map rows in `locks.test.js`.
* **Verified AI-side, first try.** locks 41/0, analysis 856/0, walkforward
  90/0, analyze 294/0. No golden moves.
* **e137 portfolio audit 27/27 SUPPORTED (F-150).** Every e123-e136 number
  flows through `portfolio.js`; all guards exact (clip/band/clean, uniform
  cost, BE identity, sizing, diagnostics, G5). Two first-run failures were
  my own hand witnesses, replaced with exact ones. Cap-then-band order is
  load-bearing (edge witness documented). No L10 rows. e136 regressed 4/4.
  No spec change, no TODO.
* **Reversal loop closed by reference.** e24's rev-sign1 IS the 10j paper's
  construction; BE 0.60/0.35 bps both timeframes — L13 stands doubly.
* **Research 10l PARTIAL** (raw `arxiv-sweep-2026-10l.json`): endpoint flaky
  (2 carried over); 2 new notes for TODO 111 (task form + unblock list) +
  1 convergence. No doc changes.
* **Rerank.** Top tier: 116 + 118 (holdout-certified) + fade G5 + 111
  (form + unblock sharpened). Queued: 117, L10, W5 venues.

## Result

F-150 (e137 audit SUPPORTED). S53→S54. Operator commands:
`npm test` (covers the `vol/` split + registry rows; no uploads).
