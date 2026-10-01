# CYCLE-125 — Round 95: cli split + 10a sweep + midcap funding harvest + e123 carry breadth

**Date:** 2026-09-30
**Goal:** four tracks — (a) foundations: split the biggest code module left
`analyze/cli.js` (1826 lines); (b) research: fresh arXiv sync (sweep 10a,
funding/execution/XS); (c) sleeve breadth: harvest wave-1 midcap funding and
test carry-dispersion on the 8-midcap panel (e123); (d) close the round-94
native gate (operator `npm test` 132/132 proof received).

## Work

* **Foundations: `analyze/cli.js` → `analyze/cli/` ×4 + shim.**
  `io.js` (readers, `resolveSymbolFiles`, `probesPerFold`, `auditBlock`),
  `rows.js` (five report-row shapers, exported for inter-part use only —
  the round-74 `powerSummary` precedent), `run.js` (dispatcher, sleeve
  analysis, `runAnalysis`), `main.js` (`replicateAnalysis`, usage, `main`).
  Sliced bodies are byte-identical except four documented lines: the
  `import.meta.dirname` root steps up one more `..` (one level deeper), the
  two `../hivemind/` dynamic imports and the `../analysis/fold_worker.js`
  worker URL step up to `../../` (the round-89/round-83 path-fix class).
  The shim carries the exact 11-name contract; `analyze.js` untouched.
  `cli.js` was never in `ANALYSIS_MODULES`, so no registry/ledger change.
* **Verified AI-side.** Baselines first (locks 41/0, analyze 294/0), then
  post-split: analyze 294/0, locks 41/0, contracts 255/0; both shims bundle
  with all names present and typed; `resolveSymbolFiles(['BTCUSDT'])`
  resolves to the manifest file and still throws on unknown symbols;
  `run_all.js` still bundles with `run` exported.
* **Research sync 10a** (`docs/research/raw/arxiv-sweep-2026-10a.json`):
  8 read-and-grounded notes. Retrieval lesson: unquoted `all:` terms
  OR-split (484k-hit noise); quoted `abs:` phrases retrieve precisely
  (82/10/2 hits). Notable: 2609.05433 nests both perp designs in one
  no-arb result (funding rule chooses benchmark + discount — carry is the
  tradeable primitive); 2605.06405 gives TODO 111's avoidance use its
  control form (funding-state HJB offsets, data requirement stands);
  2606.15715 measures sunshine-vs-hidden execution costs (taker-timing effect
  size lives at trade resolution — block stands); 2310.14973 (OI
  systematically misquoted on some venues) extends the venue rule: audit OI
  truth before any venue OI use.
* **Sleeve breadth: midcap funding harvested + e123 4/4.**
  `data/harvest_midcap_funding.js` (durable; vision monthly fundingRate zips
  → repo `{timestamp, fundingRate, markPrice: null}` shape; markPrice is
  parsed-but-unused in `carry.js`). 216/216 months, 8/8 series, zero gaps:
  2466 rows each (TIA 4931 — a 4h grid the audit tolerates, recorded).
  `e123_midcap_carry.js` 4/4 (F-136): all parse zero-invalid, all audits
  zero-missing, carry-dispersion available on the 2466×8 panel — and the
  descriptive pooled read is strong (midcap net 18.11 vs majors 11.26 at
  cost 4, turnover ~10/yr both, BE ~39/43 bps). Verdict is plumbing, not
  promotion (2-year window cannot re-bank the sleeve). OI/toptrader midcap
  history probed and filed DATA-BLOCKED (API-only, 500-row cap,
  CloudFront-challenged here).
* **Round-94 gate closed.** Operator proof `npm test` 132/132 (2026-09-30)
  received against the round-94 tree — the split + registry rows + locks
  wiring are natively green. This round's split needs the gate again
  (`npm test` owed).

## Result

F-136 (e123 SUPPORTED-plumbing: carry breadth reaches midcaps, edge
descriptive-positive). TODO 118 files the native midcap-carry port (QUEUED
behind 116). Regressions: e121 6/6, e122 6/6, e58 `validationPass`.
S39→S40. Operator commands: `npm test` (no uploads).
