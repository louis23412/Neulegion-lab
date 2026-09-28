# CYCLE-067 — Port verification: the REPO's R1 long-sample scorer reproduces the lab's full-history column logic — and the port pins the one convention the two sides could have disagreed on (the fold's no-exposure first bar)

**Date:** 2026-09-28
**Goal:** the round-31 pivot ports the FOLD-BACK queue R1/R2/R3 first (decision soundness — cheap, no promotion, highest EV). R2/R3 landed in round 32; this cycle is the lab-side record of the **R1** port: the repo's `--history=full` mode must score a parameter-free arm contiguously over the full history the way the lab's `e2_arm_sweep.js` full-history column does, and the port must state exactly where contiguous scoring and fold scoring differ.

## Work

Read-only on the repo (no lab number moves). The repo added `analysis/walkforward.js#scoreSignalFullHistory` (positions through the same `positionAt` pipeline the A/B scores, `backtestMetrics` at the run cost plus the 5/10 bps restatements, `blockStability` over the net series), `#poolSignalFullHistory` (equal-weight tail-aligned basket through the `poolFolds` arithmetic) and `#buildFullHistoryBlock` (every active signal arm pooled at the run's K; model arms land `{available:false}`), wired as the opt-in `--history=full` driver mode. Harness evidence: `walkforward` 74 → 83, `analyze` 280 → 286, ledger 2753 → **2768** — `locks` 41/0, `modules` 51/0, `contracts` 141/0 unchanged, no golden moved.

## Results

### A. The F-13 equivalence is now a pinned identity, with its one boundary nailed down (validated)

The repo's section-R1 check proves contiguous scoring equals the walk-forward assembly **bar-for-bar** on the same series — decided positions identical on every test bar, held P&L identical from the second test bar — and pins the single legitimate difference: the fold's **first test bar is a no-exposure bar** (positions restart flat, net exactly 0, versus the continuous book's carried position). That is the documented convention (the family-wise path already trims it), not a defect, and a future port that "fixes" it into equality would be laundering lookahead-shaped continuity into the fold.

### B. Two deliberate scoping decisions the operator should know (recorded)

* The long-sample path is **dependence-free by construction** (raw DSR at the run's K): the cluster jackknife dominates the cost at full-history lengths (F-14: ~155 s at 3 562 folds, ~600× the scoring). The column is therefore a **diagnostic beside the verdict, never a second gate** — the repo's reader says so, and the decision block agrees.
* The pooled row carries **no raw series** (metrics + restatements + blocks only), so `report.json` stays small at any history length; per-stream rows carry the per-symbol Sharpes, so a pooled number can always be unpacked.

## What is now false that used to be believed

* **"R1/R2/R3 still need porting."** All three are in the repo behind default-off flags (rounds 32–33). The measurement side of W1 is done; what remains is **running** `--history=full` on the operator's machine against the real 6-year panel and reading the verdict beside the long-sample column (the F-01 falsifier, now one flag away).

## Ledger effects

* `FOLD-BACK.md` R1 → **PORTED** (round 33); the priority-order progress note now reads R1/R2/R3 ported, sleeves UNTESTED awaiting the repo gate, R5 open.
* Repo-side ledger: `RUNBOOK.md` §6 (2768), the node mirrors (83/286), the lock-registry curated lists, `PLAN-round31.md` W1 item 1 + status header, `ROADMAP.md`, `MIGRATION-V2.md` §7.

## Next

* **W6 shipped-path fixes** (round-31 W6: F-61 first — it flatters the carry sleeve 3.03× and any sleeve score built on the buggy join inherits it — then F-69/F-70/F-71/F-74/F-76, L10-cs), each with its own entry + ledger update.
* Then the **`--sleeve` run mode** (MIGRATION-V2 §8 item 1: sleeve → book → risk through the unchanged gate) — the unit that turns the UNTESTED sleeves into a G2 number.
* Native `npm test` (130 blocks) before either lands — the browser harness cannot cover the better-sqlite3 paths the driver touches.

## Run

No repo file is touched by this cycle record. Full regeneration: the repo's `walkforward` (83) + `analyze` (286) harness entries.
