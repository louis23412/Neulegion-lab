# CYCLE-065 — The operator's uploaded local run corpus: seven `npm run analyze` runs reproduce the project's own K=3/K=6 multiplicity table, confirm F-01/F-03/F-32/F-69/F-71/F-74/F-77 in production, and expose one new gate coupling (the funding sleeve enters the *paired* promotion test — L10-cs)

**Date:** 2028-08-15
**Goal:** the lab has spent 64 cycles auditing the **code** (`analysis/*`, `hivemind/*`) against synthetic
ground truth. This cycle turns the mirror around and reads the project's **actual run artefacts** — the
operator uploaded seven local `npm run analyze` run directories to `src/runs/` (plus the earlier
`src/20260920T094400-seed1/` smoke run already covered by the repo's `docs/RUN-ANALYSIS.md` §3). The goal is
not to run anything new (no experiment, no repo edit): it is to ask **what the shipped path's own output
says** relative to the measured ledger `FINDINGS.md` F-01…F-80 / leads L01…L19 — which findings are now
**confirmed in production**, which are **contradicted**, and what the runs expose that the synthetic
audits did not.

## Work

No new experiment, no repo file touched (ground rule 1). The work is a **read of external run artefacts**:
- `src/runs/README.md` — a corpus index (directory contract, seven-run table, headline results, and a
  provenance note that `configFingerprint` is a model fingerprint, not a run id).
- `src/NeuLegion-lab/RUN-CROSSCHECK.md` — the lab-side cross-check: a claim-by-claim table vs F-01…F-80,
  the new coupling (§3), a good/bad-news split, and a ranked module/LOCKED-item unlock list.
- `src/NeuLegion-master/NeuLegion-master/docs/RUN-ANALYSIS.md` §18 — the **project-facing** readout
  (docs only; this file is documentation, not a scored module).

The corpus: seven 1h/15m walk-forward A/B runs by the project's own driver (`analyze.js` → `analysis/*`)
at `costBps: 0`, `seed: 1`, `gate: dependence`. Four are the same K=3 momentum A/B (baseline +
`sig-momentum` + `sig-accel`) on the **same price folds** (all four `folds.jsonl` byte-identical, SHA-256
prefix `a87a1de7b666c3f9`); two of those four additionally append the **funding sleeve** to the dependence
panel. One is a K=6 momentum family, one the 8×15m reversal family, one a `bare`-model benchmark run.

## Results

### A. The gate's own multiplicity table is reproduced from the outside

The corpus re-derives the project's K-column without any of the lab's help:

| roster | arm | adj. DSR | paired Δ (p) | verdict |
| --- | --- | ---: | --- | --- |
| K=3 | `sig-momentum` | **0.9487614** | 1.1995 (0.0293) | keep-off (DSR < 0.95) |
| K=3 | `sig-accel` | **0.9742028** | 1.1341 (0.0493) | **PROMOTE** |
| K=6 | `sig-momentum` | **0.8742840** | — | keep-off |
| K=6 | `sig-network-momentum` | 0.8654177 | — | keep-off (**audit vacuous**) |
| K=6 | `sig-vol-momentum` | 0.9172672 | — | keep-off |
| K=6 | `sig-blend-momentum` | 0.5661679 | 0.8201 (0.0920) | keep-off |
| K=6 | `sig-regime-momentum` | 0.8680898 | — | keep-off |

These match the repo's own `RUN-ANALYSIS.md` §13.5/§15.4 K=3 and K=6 columns **exactly** (four digits) —
the runs are byte-reproducible, and the multiplicity deflation with roster size is monotone.

### B. The promotions are the window artefact (F-01 / F-13 confirmed)

The promoted 1h `sig-momentum` reads pooled Sharpe **+1.0848** at `maxBars 600` (a ~25-day window). F-01/F-13
measured the same arm at **+1.106** in that window and **+0.110 over the full 53 500 bars**, with every
break-even collapsing to **1–2 bps**. The corpus is the production evidence for both halves: the run's
own break-even is **14.64 bps at zero cost** (uninvestable at the first basis point) and the 15m sibling
(`sig-reversal-4`, 1.50 bps) is the corpus's only arm that survives any cost discussion at all.

### C. The one new item — the funding sleeve enters the *paired* promotion test

`analysis/walkforward.js#clustersOf(report)` builds the fold-window clusters from `report.streamReturns`,
and `poolReports` returns `streamReturns = [...priceStreamReturns, ...extra]` — the panel **with** the carry
sleeve. `pairedPromotionTest` runs `pairedClusterTest` on `clustersOf(candidate)` vs `clustersOf(baseline)`,
so the sleeve's bars are concatenated into **both** series and the candidate-minus-baseline Sharpe
difference is computed on a price+sleeve panel. Measured on byte-identical price folds:

| candidate | paired Δ (8 price) | paired Δ (9 = price + sleeve) | adj. DSR (8) | adj. DSR (9) |
| --- | ---: | ---: | ---: | ---: |
| `sig-momentum` | 1.1995 (p 0.0293) | 1.0977 (p 0.0331) | 0.9488 ✗ | **0.9633 ✓** |
| `sig-accel` | 1.1341 (p 0.0493) | 1.0364 (p **0.0546** ✗) | **0.9742 ✓** | 0.9830 |

The sleeve's *intended* effect (raise effective bars, 1192 → 1343, for the DSR design effect — a documented
P4 goal) is accompanied by an *undocumented* effect on the magnitude hurdle: appending the sleeve **flips the
promoted arm** between two byte-identical price runs. The sleeve is identical for baseline and candidate, so
it should not move a paired candidate-vs-baseline comparison. **Proposed lab row `L10-cs`** (audit, not
asserted a defect): (a) the intended semantics are ambiguous — the reader says extras are "appended to the
panel (never to the scored price returns)" and `pooledMetrics` does use price-only returns, but the paired
test does not; (b) the candidate fix is to thread the price-only `streamReturns` into `clustersOf` while
leaving the extended panel in `dependenceSummary`. This is a `walkforward.js` change and therefore a
deliberate re-freeze (the module is LOCKED; `test/lock-registry.js`).

### D. The corpus reproduces the lab's other production findings

* **F-32 (reversal is a real gross edge, uninvestable):** `sig-reversal-4` is family-wise significant (SPA
  p **0.0474**, rejection accepted; 87/129 windows, breadth p 4.6e-5; paired p 0.0018) but its break-even is
  **1.50 bps** and it fails the `minDsr` floor at raw DSR 0.9272 — real edge, no cost margin. The plain and
  vol arms read negative Sharpe at 6500–6800 turnover.
* **F-03 / L02 (demeaning is a power tool):** `sig-reversal-xs` reads **designEffect 0.361**,
  **effectiveStreams 12.05 of 8**, effective bars 42 874 — the production face of the lab's
  cross-sectional lever.
* **F-71 / F-74 (the cross-sectional audit is vacuous without `streamIndex`):** `sig-network-momentum` has the
  corpus's **top Sharpe (1.3005)** but its audit is **VACUOUS** (`reachable 0/288`, 8 violations) — it is
  unmeasured in production, exactly as `L10-bu`/`L10-cc` predict. The `bare` run's `bench-base-rate` is
  vacuous the same way.
* **F-06 / F-08 (momentum upgrades don't help):** `sig-vol-momentum` (1.1667), `sig-blend-momentum` (0.7054),
  `sig-network-momentum`, `sig-regime-momentum` (1.0657) all fail; F-06 caps momentum-upgrade gains at
  ≤ +0.13 full-history / ≤ 2.6 bps.
* **F-69 (the benchmark is map-bounded):** no benchmark promotes; the best (`bench-linear`) reaches only
  adj. DSR 0.488, and F-69 explains why (the ridge probability is anchored at 0.5; the sigmoid bounds the map).
* **F-77 / L10-cj (replication):** `replication.json`'s `perSeedMean` is **identical across seeds 1–5** for
  both signals (only the baseline varies) — the "IQM" is a rank-slice, not the cited Agarwal estimator.
* **F-02 / F-62 (dependence panel):** 1h `designEffect 3.6239`, `meanPairwiseStreamCorr 0.5196`,
  `effectiveStreams 1.725 of 8`; the 1h runs are **UNDERPOWERED** (MDE95 **1.044** dependent) while the 15m
  run is powered (**0.382**). This is why the K=3 verdicts are knife-edge and config-fragile.

## What is now false that used to be believed

* **"Appending the funding sleeve only raises the effective bars/streams (a P4 design-effect improvement)."**
  It also moves the paired candidate-vs-baseline Sharpe difference and can **flip the promoted arm** between
  byte-identical price folds (`L10-cs`).
* **"The corpus's highest-Sharpe arm is a candidate."** `sig-network-momentum` (1.3005) is **unmeasured** —
  its audit is vacuous in production, not merely in the lab fixture.
* **"A promoted arm is a promoted arm."** Every promotion in the corpus is the 600-bar window artefact; on
  the full history the same arms read ~+0.11 with 1–2 bps break-evens.

## Ledger effects

* **`L10-cs`** is added to `leads/L10-bug-hunt.md` (audit, latent without `--carry-files`, live on any funding
  run) and the L10 board row in `leads/INDEX.md` gains its clause. No repo number and no lab number moves, so
  **no `results/` artefact and no fold-back row** (PROTOCOL §1: only number-changing cycles produce one).
* `RUN-CROSSCHECK.md` is registered (lab `INDEX.md` documents table + "Start here" bullet; `README.md`
  status bullet). The repo's `docs/RUN-ANALYSIS.md` gains §18 (docs only).

## Next

* Resolve `L10-cs`'s intended semantics before any re-freeze of `walkforward.js`; the ranked unlock list is in
  `RUN-CROSSCHECK.md` §6 (walkforward → features/world panel-arm audit → `regimeGatedMomentum` → `benchmark`
  → `carryOnBarGrid` → `holding` → `backtest`/`replication` → `dependence` → latent tail).
* The corpus is the strongest lever yet for the project-side port queue **R1** (model-free long-sample
  scoring), **R2** (window-robustness statistic), **R3** (realistic cost by default); and for the two
  "don't"s — don't add momentum variants (F-06, the K=6 run), don't expect the model to help (F-69, the
  `bare` run).
* Remaining un-audited pure surfaces (`hivemind/memory/*`, `hivemind/transformer/*`, `observer/*`) and the
  remaining L10 rows (**L10-h**, **L10-ad**, **L10-ae**, **L10-cn**) stay on the board.

## Run

No repo file is touched and no experiment is added; `run_all` is unchanged at **80 steps, 49 gated, 0 fails**
(`RUN_SUMMARY` at **2026-09-27T11:06:28Z**). The evidence is the operator's seven run directories under
`src/runs/**` (read only).
