# CYCLE-075 — Round 42: the carry view builder (funding rows → R8 panel)

**Date:** 2026-09-28
**Goal:** land the data-layer half of MIGRATION-V2 §8 item 1 for the carry sleeve — parsed funding rows + spot closes → the aligned `{fRate, basisPnl, times}` panel — with the L10-m/n/o lessons as contract, plus synthetic ground truth in the repo harness.

## Work (repo, round 42)

* **`buildCarrySleeveView({streams, gridMs})`** (`src/sleeve_score.js`, beside the R40 composer): buckets funding rows by grid (sub-grid rows SUMMED — the L10-o fix), intersects to buckets present in every stream (the fixed-split rule), reads spot closes at EXACT bucket boundaries only (no carry-forward — the L10-m fix) with the perp leg from the bucket's own first/last marks, and emits null basis without an exact close (counted as 0 through the shared `fin`, the R31c convention). Throws on an empty stream list; an empty intersection is an empty view, not a throw.
* Four `contracts` §K2 checks (grid alignment + bucket sum, intersection + per-stream exactness, end-to-end score with turnover and finite break-even, rejection + empty intersection). 151 → 155.
* No registry change (no new module, no new analysis export); `locks` 41/0 unchanged.
* Ledger: **2830 → 2834** (RUNBOOK §6 table + round note, node mirror 151/155, ROADMAP snapshot + suite line, `src/README.md` ledger).

## Verification (browser harness)

* `contracts` **155/0**, `analysis` **683/0**, `locks` **41/0** — green in-harness at the freeze.
* Two self-caught fixture mistakes during the build (an all-null expectation for a per-stream miss, and a 2-symbol exact-mirror rank flip — see below), both fixed before landing; no golden moves.

## Observation (no finding number — synthetic only, not measured on real data)

An exact-mirror rank reversal is a fixed point of the pinned normalized EWMA: per-row L1 renormalization resets the held magnitude, so a mirrored target (e.g. a 2-symbol funding flip, or a symmetric 3-way rotation) can never cross zero no matter how long it persists — only PARTIAL rank churn moves the weights. This is the lab's own construction (e73 proves it bit-for-bit), and production books turn over on 8-symbol partial churn, so nothing is broken; but a future fixture or sleeve that needs a full reversal to register must know it. Worth a lab measurement on real rank-transition statistics if the OI/fade ports ever depend on reversal speed.

## Lab effects

* None on lab numbers. FOLD-BACK: W2 data-layer half closed for carry; fade/OI views need toptrader/OI fetchers the repo does not ship (operator data work), then the `--sleeve` CLI flag.

## Next

* R43 `--sleeve` CLI flag + report block (needs native `npm test` cover — the flag parse path is node-side; propose the operator runs it).
* Native `npm test` on the operator machine required before further landings (three report-path rounds since the 131/131 confirmation).
