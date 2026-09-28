# RUN-CROSSCHECK — the project's 2026-09-26/27 local run corpus vs the lab's findings

**What this is.** The operator uploaded seven fresh `npm run analyze` run directories under
`src/runs/` (plus the earlier `src/20260920T094400-seed1/` smoke run already covered by the repo's
`docs/RUN-ANALYSIS.md` §3). This memo is the **cross-check**: what the corpus confirms, refutes, or
newly exposes relative to the lab's measured ledger (`FINDINGS.md` F-01…F-80, leads L01…L19). It is a
*read of external run artefacts*, not a new experiment (cycle `CYCLE-065`) — **no repo number and no lab number moves**,
and nothing here edits the repo (ground rule 1). The corpus README is `src/runs/README.md`; the
project-facing readout is the repo's `docs/RUN-ANALYSIS.md` §18.

## 1. The corpus in one paragraph

Seven 1h/15m walk-forward A/B runs by the project's own driver (`analyze.js` → `analysis/*`) at
`costBps: 0`, `seed: 1`, `gate: dependence`. Four of them are the same K=3 momentum A/B
(baseline + `sig-momentum` + `sig-accel`) on the **same price folds** (all four `folds.jsonl` byte-
identical, SHA-256 prefix `a87a1de7b666c3f9`); two of those four additionally append the **funding
sleeve** to the dependence panel. One is a K=6 momentum family, one is the 8×15m reversal family, one
is a `bare`-model benchmark run.

## 2. Claim-by-claim cross-check

| # | corpus observation | lab finding that predicts/explains it | verdict |
| --- | --- | --- | --- |
| 1 | 1h `sig-momentum` pooled Sharpe **+1.0848** @ `maxBars 600` is the corpus's promoted arm | **F-01/F-13**: at 600 bars the A/B reads +1.106 (reported +1.0848); over the full 53 500 bars it is **+0.110**, and every break-even collapses to 1–2 bps | **CONFIRMED — the promotion is the 25-day window artefact** |
| 2 | `sig-vol-momentum` (1.1667), `sig-blend-momentum` (0.7054), `sig-network-momentum` (1.3005), `sig-regime-momentum` (1.0657) all fail | **F-06** momentum upgrades ≤ +0.13 full-history / ≤ 2.6 bps; **F-08** vol conditioning +0.112 vs +0.110 | **CONFIRMED** |
| 3 | `sig-reversal-4` is the only family-wise-significant arm (SPA p 0.0474, 87/129 windows, clustered p 0.0018) at break-even **1.50 bps**; the plain/vol arms have negative Sharpe at 6500–6800 turnover | **F-32** reversal is a real gross edge at 1h/15m but break-evens **0.32–1.31 bps** and smoothing cannot lift them; **F-34** a maker fill eats it; **THEORY J4** | **CONFIRMED / reproduced in production** |
| 4 | `sig-reversal-xs` reads **designEffect 0.361**, `effectiveStreams` **12.05 of 8**, effective bars 42 874 | **F-03/L02**: demeaning collapses the design effect **4.92 → 0.39–0.60**, effective streams 1.47 → 14–19 | **CONFIRMED — the production face of the lab's leverage-2 tool** |
| 5 | `sig-network-momentum` audit is **VACUOUS** (`reachable 0/288`, 8 violations) and it has the corpus's top Sharpe | **F-71 L10-bu** (`networkMomentum` self-skip fails when `streamIndex` is absent) + **F-74 L10-cc** (`panelFor` leaves every slot unperturbed without `streamIndex` → vacuous audit) | **CONFIRMED — latent lab row, now live in production** |
| 6 | `bench-base-rate` audit VACUOUS (8 violations); no benchmark promotes; `bench-linear` (best) still only reaches adj. DSR 0.488 | **F-69** (ridge probability anchored at 0.5, bounded output map), `NL-BENCH`/G-A, **F-06** | **CONFIRMED** |
| 7 | `replication.json` `perSeedMean` identical across seeds 1–5 for the two signals, varying for the baseline | **F-77** (replication layer) + **L10-cj** (the "IQM" is a rank-slice, not the cited Agarwal estimator); repo §13.5 already notes `--seeds` is vacuous for model-free arms | **CONFIRMED / caveat stands** |
| 8 | 1h dependence panel: `designEffect 3.6239`, `meanPairwiseStreamCorr 0.5196`, `effectiveStreams 1.725 of 8`; runs are `UNDERPOWERED` (MDE95 1.044 dependent) | **F-02** (DE 4.92 1h / 3.62 15m; effective streams 1.47/1.77), **F-62** (estimator unbiased but a single DE at C=36 spans 0.644–1.452 → a verdict near the gate is not resolvable) | **CONFIRMED — and it explains why the verdicts are knife-edge** |
| 9 | Adding the funding sleeve flips the promoted arm (`sig-accel` ⇄ `sig-momentum`) and shifts the **paired cluster Sharpe difference** (1.1995 → 1.0977) | — | **NEW — see §3** |
| 10 | K=6 roster lowers every `dsrAdjusted` (sig-momentum 0.9488 @K=3 → 0.8743 @K=6) and promotes nothing | repo `RUN-ANALYSIS.md` §15.4 (roster-size artefact); **F-62** (near-gate unresolvable) | **CONFIRMED** |

## 3. The one new item — the funding sleeve enters the *paired* promotion test

`walkforward.js#clustersOf(report)` builds the fold-window clusters from `report.streamReturns`, and
`poolReports` returns `streamReturns = [...priceStreamReturns, ...extra]` — the panel **with** the
carry sleeve. `pairedPromotionTest` runs `pairedClusterTest` on `clustersOf(candidate)` vs
`clustersOf(baseline)`, so the sleeve's bars are concatenated into **both** series and the candidate-
minus-baseline Sharpe difference is computed on a price+sleeve panel. Measured effect on byte-identical
price folds:

| candidate | paired Δ (8 price) | paired Δ (9 = price + sleeve) | adj. DSR (8) | adj. DSR (9) |
| --- | ---: | ---: | ---: | ---: |
| `sig-momentum` | 1.1995 (p 0.0293) | 1.0977 (p 0.0331) | 0.9488 ✗ | **0.9633 ✓** |
| `sig-accel` | 1.1341 (p 0.0493) | 1.0364 (p 0.0546 ✗) | **0.9742 ✓** | 0.9830 |

So the sleeve's *intended* effect (raise effective bars, 1192 → 1343, for the DSR design effect — a
documented P4 goal) is accompanied by an *undocumented* effect on the magnitude hurdle. The sleeve is
identical for the baseline and every candidate, so it should not move a paired candidate-vs-baseline
comparison. **Proposed lab row `L10-cs`** (audit, not yet a defect): (a) the intended semantics are
ambiguous — the round-30 reader says extras are "appended to the panel (never to the scored price
returns)", and `pooledMetrics` does use price-only returns, but the paired test does not; (b) the fix,
if wanted, is to thread the price-only `streamReturns` into `clustersOf` while leaving the extended
panel in `dependenceSummary`. This is a `walkforward.js` change and therefore a deliberate re-freeze
(the module is LOCKED; see `test/lock-registry.js`).

## 4. Good news

* **The harness is reproducible and honest.** Four runs on the same data produce byte-identical
  `folds.jsonl` and identical pooled metrics; zero errors/quarantine in all seven `run.log`s; the gate
  refuses to promote `VACUOUS` candidates, refuses the zero-cost promotion under any real cost, and
  deflates monotonically with the roster. The corpus *re-derives the project's own multiplicity table*
  (K=3 → `sig-accel` 0.9742 ✓; K=6 → nothing) without any of the lab's help.
* **A real, broad, family-wise-significant edge exists** in the 15m reversal family
  (`sig-reversal-4`: SPA rejects, 87/129 windows, paired p 0.0018). The corpus is not all null.
* **The lab's `F-03` leverage is confirmed in production**: cross-sectional demeaning takes the design
  effect to **0.361** (effective streams 12.05 of 8) — power really is cheap.
* **The 15m configuration is powered** (MDE95 0.382 dependent) where the 1h/600 one is not (1.044).
  More data buys power, and the signal arms are ~600× cheaper than the controller.
* **The funding sleeve is a real independence lever** — it does raise effective bars/streams exactly as
  P4 intended.
* **The vacuity audit has teeth**: it catches both the base-rate benchmark and the panel arm, which is
  the mechanism that stops a look-ahead leak from being promoted.

## 5. Bad news

* **The only promotions in the corpus are the 600-bar window artefact** (F-01/F-13). On the full
  history those same arms read ~+0.11 with 1–2 bps break-evens.
* **Verdicts are knife-edge and config-fragile**: `sig-momentum` 0.9488 vs `sig-accel` 0.9742 at K=3;
  the funding sleeve flips them; at K=6 none promote. All within F-62's single-realisation resolution.
* **The corpus's strongest arm by Sharpe (network-momentum, 1.3005) is unmeasured** (vacuous audit).
* **The real edge is uninvestable** at 1.5 bps (reversal-4); the momentum arms' zero-cost gate fails at
  the first basis point.
* **No model class beats a linear benchmark**; the best benchmark is itself F-69-flawed.
* **The 1h runs are underpowered**, so their promote/keep-off statements are about 25 days, not arms.

## 6. Modules / LOCKED items to investigate closer or unlock

All of the following are declared in `docs/LOCKED.md` / pinned by `test/lock-registry.js`; touching any
is a deliberate, documented re-freeze (FOLD-BACK contract rule 2). Ranked by how much the project's
*decision* changes.

1. **`analysis/walkforward.js` — `clustersOf` / `pairedPromotionTest` / `poolReports`.** The §3 coupling:
   the gate's magnitude hurdle is computed on a panel that includes the extra sleeve while
   `pooledMetrics` is price-only. Decide the intended semantics and, if needed, re-freeze. *(new, this
   corpus)*
2. **`analysis/features.js` + `analysis/world.js` — the panel-arm audit.** `networkMomentum` (L10-bu)
   and `panelFor` (L10-cc) make the corpus's highest-Sharpe arm unauditable. Fix the own-stream slot so
   `streamIndex` is always present, then re-score `sig-network-momentum`. *(F-71/F-74 latents, now
   production-live)*
3. **`analysis/features.js#regimeGatedMomentum`** (L10-bv): the crash gate is scaled by the **momentum**
   window variance, not the gate window, so the corpus's `sig-regime-momentum` (adj. DSR 0.868) is not
   the intended arm. Same file also carries L10-bs (zero-dispersion guard defeated by rounding) and
   L10-bt (`finiteSum` empty-range 0 vs NaN).
4. **`analysis/benchmark.js`** (F-69): `fitRidge` centres on the training mean and `predictRidge` never
   restores it, and the sigmoid bounds the output to ~[0.27, 0.73]. The corpus's best benchmark
   (`bench-linear`) is therefore partly a comparison of output maps — fix before the benchmark is used
   as the model-class reference.
5. **`analysis/carry.js#carryOnBarGrid`** (F-61/L10-d): sub-8h funding is divided by the default 8h bar
   count, understating `8h/interval` — and it *flatters* the sleeve, so no alarm fires and
   `auditFundingProblems` is blind. The corpus's sleeve used 8h files so it is not bitten here, but any
   4h/1h funding run would be.
6. **`analysis/holding.js`** (L10-cg/L10-ch): `turnoverSweep` echoes `costBps` but never threads it in
   (every row at zero cost) and `requireCleanAudit` is structurally inapplicable because
   `restateReportAtPolicy` drops the `audit` block. Not exercised by this corpus (`turnoverSweep: null`),
   but it is the project's offline cost-attack tool and currently cost-blind.
7. **`analysis/backtest.js` — `hitRate` / `scoreFold`** (F-70/L10-bq/L10-br): the `hit` statistic in
   every report is computed on a rule the signature cannot express (zero-return bars dropped, exit-cost
   bars counted as misses) and `scoreFold` re-lags inside the slice.
8. **`analysis/replication.js`** (F-77/L10-cj/L10-ck): the replication summary's "IQM" is a rank-slice,
   not the Agarwal estimator, and the formatter can print the wrong CI label. The corpus's
   `replication.json` rides on it.
9. **`analysis/dependence.js`** (F-78/L10-cl/L10-cm): `clusterStability.stable` omits the
   `worstDelta > minDelta` half of its rule and `signTest` underflows for n ≥ ~1075. Latent at the
   corpus's C = 36/129, but the module is the gate's SE backbone.
10. **Lower leverage (latent, not corpus-exercised):** `analysis/forecast.js` (F-67),
    `analysis/decision.js` (F-79/L10-cn), `analysis/streams.js` (F-73/L10-ca/cb),
    `analysis/parallel.js` (F-75/L10-ce/cf), `analysis/performance.js` (F-70), `analysis/splits.js`
    (F-63), `analysis/labels.js` (F-64), `analysis/overfitting.js` (F-65), `analysis/reality_check.js`
    (F-66), `analysis/race.js` (F-68), `analysis/uniqueness.js` (F-72), `hivemind/kernels/*` (F-80).

## 7. Where the corpus says to spend effort (not on the model)

The corpus is the strongest evidence yet for `THEORY.md`'s J1–J4 and FOLD-BACK's R1–R3:

* **R1 — model-free long-sample scoring.** Every 1h verdict here is a 600-bar statement; the signal
  arms are free to score over the whole history (F-13/F-14). This is the single highest-value fix.
* **R2 — window-robustness statistic.** The corpus's arm ranking reorders between the 600-bar window
  and the full history; a block-Sharpe ladder would surface it in the report.
* **R3 — realistic cost by default.** The corpus's promotions are zero-cost; a default
  break-even/net@5/net@10 block would show reversal-4 at 1.5 bps and the momentum arms collapsing at 2.
* **Do not add momentum variants** (F-06, the K=6 run) and **do not expect the model to help**
  (F-69/NL-BENCH, the `bare` run).
