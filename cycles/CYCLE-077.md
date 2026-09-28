# CYCLE-077 — Round 44: the `--sleeve` run mode (W2 acceptance)

**Date:** 2026-09-28
**Goal:** land the W2 acceptance — sleeves as a first-class `analyze` mode (books scored by the gate's metrics, not controller candidates), with everything scored under the browser harness and only the file reads / run-dir writes left to native cover.

## Landed (repo, round 44)

* `src/sleeve_score.js`: `parseSleeveInputs` (funding + candle JSONL texts → the R42 view + marked/null-basis fractions), `runSleeveReport` (view → `scoreSleeve` → factor-neutral panel → `scoreG5` → the G2 report object with annualized economics), `formatSleeveReport` (the CLI summary). Only carry-dispersion runs on shipped data; the positioning sleeves land `available:false` naming their operator data. Shipped marks confine the view to the marked window (CYCLE-005) — reported as `markedFraction`, never hidden.
* `src/analyze.js`: exported `runSleeveAnalysis` (injected `readFile`, fail-closed on missing `--carry-files`, candle inputs resolved by the same files/symbols/file rule as the A/B) + the thin `--sleeve=<id>` CLI branch (usage text, empty/unknown-id refusals per BUGS #69, `run.json` + `report.json` beside the A/B runs).
* `runSleeveAnalysis` joined the lock-registry curated driver list in the same change (support lists are curated-subset, so `locks` count is unchanged).

## Verification (browser harness)

* `contracts` **161/0** (+4 §K3: text parsing, report+G5+summary, unavailable-not-throw, ragged inputs), `analyze` **289/0** (+3 §S1: mode scoring, positioning unavailability, missing-funding refusal), `locks` **41/0** — green at the freeze.
* `e75_sleeve_report.js` (new, 6/6 PASS, registered in `run_all.js`): the text path equals the programmatic chain bit-for-bit on real files (fRate, basisPnl nulls-in-same-cells, times), and the report economics equal the direct chain exactly. Records the shipped-marks object (net **11.26**, 52 % null basis — funding-always + partial basis, a DIFFERENT object from the R8 book, so its level is never gated).
* First draft of e75 gated the level (±1.5 of 6.18) and failed honestly (11.26); rewritten as a path-equivalence read instead of widening the band — the standing rule against curve-fitting a test to one run.

## Lab effects

* FINDINGS **F-86** (this cycle). FOLD-BACK: W2 fully closed (data layer R42 + scoring R40 + composer verification e74 + run mode R44).
* Ledger: **2836 → 2843**. Node: `contracts`/`analyze` mirrors moved in the same change; `analyze_cli.test.js` gains a `--sleeve` spawn test on synthetic fixtures (exit 0, mode + buckets in `report.json`, four refusals) — **needs native `npm test`** (blocks 131 → 132 pending).

## Next

* Native `npm test` on the operator machine — now FIVE report-path rounds (40–44) since the 131/131 confirmation, including an untested CLI branch and an untested spawn test. No further landings until it is green.
* After green: W5.1 (sleeves as panel streams is already P4; the demean construction flag R5), then the G1b full-history verdict question (A1) — W1's re-measurement runs first and decides whether W5 is needed at all.
