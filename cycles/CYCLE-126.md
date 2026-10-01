# CYCLE-126 — Round 96: evaluate split + stacked-16 carry book (e124 SUPPORTED) + 10b

**Date:** 2026-10-01
**Goal:** three tracks — (a) foundations: split `analyze/evaluate.js`
(764 lines); (b) sleeve-family model: the 16-wide cross-sectional carry
book on the shared window (e124); (c) research: targeted sweep 10b, and a
rerank with TODO 88 newly task-defined.

## Work

* **Foundations: `analyze/evaluate.js` → `analyze/evaluate/` ×3 + shim.**
  `core.js` (`evaluateAB` + `finalizeAB`, exported for inter-part use —
  the round-74 precedent), `async.js` (`evaluateABAsync`), `format.js`
  (the four formatters + two private helpers). Sliced bodies byte-identical;
  the only diff is the `export` prefix on `finalizeAB`. The shim carries the
  exact 5-name contract; `analyze.js` untouched; nothing registered, so no
  registry/ledger change.
* **Verified AI-side.** Baselines first (analyze 294/0, locks 41/0,
  contracts 255/0), then post-split identical counts; both shims bundle with
  every name present; orchestrator intact. Wiring audit: all 124 lab
  experiments are registered in `run_all.js` — no wiring debt.
* **e124 stacked-16 carry 4/4 SUPPORTED (F-137).** Window-matched panels
  (>= 2024-06-01) through the same `runSleeveReport` path: maj8w available
  (2537×8, net 3.76), mid8 (2466×8, net 18.11, e123 replicated), stacked-16
  available (2466×16, net 13.26, turnover 17.6/yr, BE 24.1). Cross-leg
  correlation via the repo's own `parseSleeveInputs` + `scoreSleeve` series
  on the timestamp-intersected grid: **corr(mid8, maj8w) = −0.02** — the
  midcap dispersion book is independent from the majors book (the F-125
  pattern again). One self-caught bug: `runSleeveReport` drops the period
  series (scalars only), so the correlation reads the scored `net` arrays
  directly — same arithmetic the report uses. Verdict is plumbing +
  independence, not promotion (2y window).
* **Research 10b** (`docs/research/raw/arxiv-sweep-2026-10b.json`): one
  targeted query, one grounding — 2608.21888 (15m reversal lives in signs,
  concentrates after aggressive taker flow, depth conditions nothing).
  TODO 88 is now task-defined (sign-reversal × taker-flow conditioning;
  lab holds taker_1h/taker_15m) and AI-side testable — filed as e125 next.
* **Rerank.** Top tier: 116 (native 16-panel) + 118 (native carry port,
  now with the stacked-16 read) + fade G5 (106/108) + 111
  (control-defined, blocked). Next lab: e125 (TODO 88). Queued: 95
  remainder, 104, 117 (behind 116), L10-co/cp/cq/cr, W5 venues.

## Result

F-137 (e124 SUPPORTED: stacked-16 carry available, legs uncorrelated).
TODO 88 amended (task form + data pointer). Regressions: e123 4/4.
S40→S41. Operator commands: `npm test` (no uploads).
