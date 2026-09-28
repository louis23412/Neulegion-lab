# CYCLE-068 — Round-34 build: four W6 shipped-path fixes + the W3 portfolio layer land in the repo

**Date:** 2026-09-28
**Goal:** work the round-31 W6 queue first (fixes before new numbers), then lay the W3 foundation — each item with synthetic ground truth in the repo harness and the ledger updated in the same change.

## Work (repo)

* **34a F-61** (`analysis/carry.js`): `carryOnBarGrid` divides by the **observed** funding interval (`observedFundingIntervalMs`, median step) instead of the 8h default; `auditFundingSeries` returns `gridMs` + `medianIntervalMs`; `auditFundingProblems` flags a median-vs-grid interval change. Two `analysis` checks (8h/4h/2h/1h scaling ladder totals 1×/2×/4×/8×; median + flag). 638 → 640.
* **34b F-69** (`analysis/benchmark.js`): `predictRidge` restores the training base rate on the **probability scale** (`sigmoid(logit) + ybar − 0.5`, clamped) — constant-y reads the prior instead of 0.5, balanced priors byte-identical so the P1 accuracy pin still passes. Deliberate deviation from the e61 witness (`sigmoid(logit + ybar)`), which dropped the shipped separable-rule accuracy 0.8+ → 0.715 in-harness; probability-scale preserves ranking exactly. One `analysis` check. 640 → 641.
* **34c F-70** (`analysis/backtest.js`): `hitRate(series, positions=null)` — with positions, no-position bars excluded even when net is nonzero and zero-return in-market bars counted; `backtestMetrics` passes the traded positions. Legacy single-arg path unchanged. One `analysis` check. 641 → 642.
* **34d F-76** (`analysis/walkforward.js` + `analysis/holding.js`): `restateReportAtPolicy` carries the scored `costBps` and the lookahead `audit` (the `requireCleanAudit` hurdle is now applicable instead of silently skipped); `turnoverSweep` threads the run cost into every restatement. Two `walkforward` checks. 83 → 85.
* **34e W3** (new `analysis/portfolio.js`, the round-30 C-BREADTH slot): the lab `port.js` chain vendored (cap/band/clean, pinned R8/R7/OI specs, `MIN_TRAIN_PERIODS` 2555) plus inverse-vol weights, vol-target scale, the clipped trailing-median OI schedule (F-42) and the fixed-split joint size (F-43/F-44). Six `analysis` checks; registered in `ANALYSIS_MODULES` + `ANALYSIS_REGISTRY` (LOCKED-invariant, proves via `analysis.test.js`) + `locks.test.js` imports. 642 → 648.
* Ledger: **2768 → 2780** (RUNBOOK §6 table + round notes, node mirrors 642/648 + 83/85, lock-registry carry list + portfolio registration, ROADMAP snapshot + suite line, DESIGN/LOCKED pins, `src/README.md` ledger).

## Verification (browser harness, esbuild-wasm bundle + `run()`)

* `analysis` **648/0**, `walkforward` **85/0**, `analyze` **286/0**, `locks` **41/0**, `contracts` **141/0** — all green in-harness at the freeze.
* No golden moves (nothing on the hot path changed arithmetic the goldens pin: carry/benchmark-positional/holding/policy-audit/portfolio are all report-layer or opt-in arms).

## Lab effects

* None on lab numbers (lab buckets funding rows first, L10-o; the ridge/hitRate/sweep/portfolio changes are repo-side only).
* FOLD-BACK: R4's F-61 fix half is now PORTED in the shipped join; W3's `portfolio.js` is the repo-side home the sleeve books will score through.

## Next

* W6 remainder (F-71 features guards, F-74 `panelFor` vacuity, L10-cs paired-test sleeve exclusion, plus F-78/L10 replication + dependence + streams rows as separate items).
* Then the **`--sleeve` run mode** (sleeve → book → risk through the unchanged gate) for the G2 number, and the **A2 factor-neutral hurdle**.
* **Native `npm test` on the operator machine is now required before further landings** — five repo changes since the 131/131 confirmation (34a–34e), and the browser harness cannot cover the better-sqlite3 driver paths (`walkforward` real-candle section, `analyze` CLI surface).
