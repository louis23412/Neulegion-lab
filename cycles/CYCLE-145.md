# CYCLE-145 — Coherency sweep S6: alias-aware re-scan + ledger census + lab pointer (no measurement round)

**Date:** 2026-10-02
**Goal:** re-verify the tree after S5 (alias-aware dead-import scan, shim census,
registration/ledger census), audit the finding ledger's shape, and land the
small lab-orientation improvement queued by the sweep brief.

## Work

* **Dead imports: 0.** Re-ran the scan alias-aware (`X as Y` counts `Y` as the
  binding — S1's naive pass would have flagged `selectStreams as
  runStreamSelection` in `analyze/cli/run.js`; the alias is used). 210 `src/`
  files + test tree: no unused bindings.
* **Dangling relative imports: 0. Cycles: 0.** Full-tree check, same as S5.
* **Registration complete:** `run_all.js` 152 steps cover all 138 experiment
  files, 0 unregistered. Lab INDEX names all 145 cycle files (000–144), 0 missing.
* **Shim census: 18/18 present.** Every split round's shim resolves
  (sleeve_score, analyze ×4 parts, candle_fetcher, reality_check + bootstrap +
  subsampling, cli, evaluate, decision, models (under `analyze/`, not
  `analysis/` — the one path worth misreading), roster, dependence, features,
  backtest, forecast/scoring, walkforward restate + report, forecast/vol).
* **Ledger-shape audit (the scare that wasn't):** a heading-only census reads
  81 `## F-` rows and looks like F-82…F-155 are missing — but the `## Summary
  table` carries one row per finding, F-01…F-155, 0 gaps. Full rows stop at F-81
  (audit era); everything later is a summary row by design. Citations in
  §§55–59, TODO, and leads all resolve. No repair needed; recording the rule
  here so the next census doesn't re-discover it.
* **Live smoke (page ESM):** `prototypes/port.js` (`clipWeights`/`bandWeights`,
  `SLEEVE_SPECS` R8/R7/OI, `MIN_TRAIN_PERIODS` 2555) and
  `analysis/streams.js` (`selectStreams`, `designEffectOfStreams`, …) import and
  behave in the live page. The `execute_js`-worker import path does NOT resolve
  workspace files (my own failed probe, not a repo bug) — RUNNER.md's harness
  recipe remains the documented AI-side route.
* **Rerank (TODO.md):** tiers unchanged — **116** (native midcap port +
  16-panel `gh`) → **118** (stacked-16 cap 0.125 + band ~0.01) → **117** only if
  116 confirms. All 18 opens re-verified, none archivable without operator runs
  or new data (dispositions in §60). No archives this sweep.
* **Docs sync:** `src/README.md` counts corrected (was "154 findings …
  CYCLE-000…CYCLE-143", now 156 / 000–145 post-sweep). Added lab `STATUS.md` —
  a 30-line AI orientation pointer (counts, entry points, frontier, owed gate),
  wired into INDEX (Start-here + documents table).

## Verification (AI-side, this round)

* Static: 0 dead / 0 dangling / 0 cycles; 33 browser entries / 45 node mirrors
  match the RUNBOOK ledger exactly; every raw sweep snapshot 10a–10n parses.
* Runtime: page-ESM smoke on `port.js` + `streams.js` (pure paths only).

## Open / owed (unchanged)

* `npm test` (R109 + S1 + S5; S6 is docs-only so the gate does not grow). No uploads.
