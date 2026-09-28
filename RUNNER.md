# RUNNER — how to run the lab

An experiment is plain ESM that reads its inputs through `globalThis.__fs`, so there are two ways to run one:

* **On a machine with Node (≥ 22):** `run_lab.mjs` wires `__fs` to `node:fs` and calls the experiment's
  `run()` directly — no bundling, no network. This is the way to prove an experiment locally or in CI.
* **In this workspace (there is no Node):** every experiment runs through the repo's **browser harness**
  (`src/NeuLegion-master/NeuLegion-master/test/browser/harness.js`), which uses esbuild-wasm to bundle
  a lab file plus its repo imports into an ES module and run it. The orchestrator is `execute_js`.

## Run locally (Node ≥ 22)

```bash
# from anywhere — paths resolve against the directory that contains `src/`
node src/NeuLegion-lab/run_lab.mjs e73_port_verify.js         # the port gate (read-only, seconds)
node src/NeuLegion-lab/run_lab.mjs run_all.js                 # regenerate results/*  (~10–25 min)
node src/NeuLegion-lab/run_lab.mjs e73_port_verify.js --json  # print the full result
node src/NeuLegion-lab/run_lab.mjs e73_port_verify.js --out scratch/e73.json
```

Exit status is non-zero on a failed verdict (`validationPass === false`), a failed check count
(`failed > 0`) or a red `run_all` step (`pass === false`), so it doubles as a gate command.

## Run through the workspace harness (no local Node)

The harness and every experiment write their results through `globalThis.__fs`. It **must** expose
`writeTextFile` (not just `readTextFile`/`readFile`) or `run_all` fails at its first write. This is
the single most common way a run breaks.

```js
globalThis.__fs = {
  readTextFile: (p) => fs.readTextFile(String(p)),
  readFile:     (p) => fs.readFile(String(p)),
  writeTextFile:(p, c) => fs.writeTextFile(String(p), c),
};
```

### Run one experiment

```js
globalThis.__fs = { readTextFile:(p)=>fs.readTextFile(String(p)), readFile:(p)=>fs.readFile(String(p)), writeTextFile:(p,c)=>fs.writeTextFile(String(p),c) };
const hsrc = await fs.readTextFile('src/NeuLegion-master/NeuLegion-master/test/browser/harness.js');
const h = await import(URL.createObjectURL(new Blob([hsrc], { type: 'text/javascript' })));
const m = await h.importBundled('src/NeuLegion-lab/experiments/e0c_validate_pipeline.js');
const result = await m.mod.run({ tf: '15m', n: 4000 });   // options are per-experiment
await fs.writeTextFile('src/NeuLegion-lab/results/my_run.json', JSON.stringify(result, null, 2));
return { keys: Object.keys(result), pass: result.pass };
```

* `m.mod` is the experiment module; `run(options)` is its entry point.
* Write the artefact yourself unless the experiment documents that it writes one.
* Return a *small* summary — never dump the whole result into the chat.

### Run everything (canonical regenerate)

```js
globalThis.__fs = { readTextFile:(p)=>fs.readTextFile(String(p)), readFile:(p)=>fs.readFile(String(p)), writeTextFile:(p,c)=>fs.writeTextFile(String(p),c) };
const hsrc = await fs.readTextFile('src/NeuLegion-master/NeuLegion-master/test/browser/harness.js');
const h = await import(URL.createObjectURL(new Blob([hsrc], { type: 'text/javascript' })));
const m = await h.importBundled('src/NeuLegion-lab/experiments/run_all.js');
const summary = await m.mod.run();   // ~10-25 min; rewrites every results/*.json
return summary;                      // { 'e0_panel_baseline_15m': {ms}, ... }
```

`run_all.js` rewrites `results/*.json` in one pass so a reader never wonders whether two artefacts
came from different code. It also writes `results/RUN_SUMMARY.json` (timestamps + ms per step). The
control steps (`e0c`, `e5` 1h/15m), the data-integrity suite (`e14`) and the validation guards (`e28`'s
F-36 cross-check, `e29`'s OOS guard, `e30`'s `e19` capacity cross-check, `e31`'s F-24-spec cross-check,
`e32`'s `e22` cross-check, `e33`'s `e30`/`e32` capacity cross-check, `e34`'s `e33` min-of-ratio cross-check,
`e35`'s `e34` OI-schedule cross-check, `e36`'s `e34` + LP-≥-individual cross-checks, `e37`'s `e21`
dLogOI-cross-check, `e38`'s `e21` dLogOI-cross-check, `e39`'s `e34`/`e36`-LP cross-checks + 3-D-LP-≥-2-D,
`e40`'s `e30`/`e31` Sharpe cross-checks, `e41`'s
`e40`-reproduction cross-checks, `e42`'s `e31`-reproduction cross-checks, `e43`'s
`e32`-reproduction cross-checks, `e44`'s `e30`-reproduction cross-checks, `e45`'s
`e32`-reproduction cross-checks, `e46`'s `e30`-reproduction cross-checks, `e47`'s
`e30`-reproduction cross-checks, `e48`'s `e21`-daily- and F-46-`e38`-blend-reproduction cross-checks,
`e49`'s `e21`-daily- and F-46-`e38`-blend-reproduction cross-checks,
`e50`'s `e21`-daily- and F-46-`e38`-blend-reproduction cross-checks,
`e51`'s `e21`-daily- and F-46-`e38`-blend-reproduction cross-checks,
`e52`'s 5-book `e30`/`e32`/F-52/`e50` cross-checks,
`e53`'s synthetic sub-8h scaling ratios + SOL interval/FTX/pooled-delta checks,
`e54`'s 11 closed-form / noise / bound checks,
`e55`'s 12 purge/embargo/leak checks,
`e56`'s 23 closed-form / tie-break / dead-argument / weight-recurrence checks,
`e57`'s 29 CSCV-structure / calibration / ensemble / counting checks,
`e58`'s 39 resampling-identity / reference-port / calibration checks,
`e59`'s 33 forecast-scoring / cross-implementation / calibration checks,
`e60`'s 18 racing-closed-form / budget-accounting / decided-set checks,
`e61`'s 12 benchmark-contract / output-map / claim-ledger checks)
report `pass` in the summary — a red
control invalidates every negative in the same regeneration, a red `e14` invalidates every basis-marked
number, a red `e29` invalidates F-37, a red `e30` invalidates F-38, a red `e31` invalidates F-39, a red
`e32` invalidates F-40, a red `e33` invalidates F-41, a red `e34` invalidates F-42, a red `e35`
invalidates F-43, a red `e36` invalidates F-44, a red `e37` invalidates F-45, a red `e38`
invalidates F-46, a red `e39` invalidates F-47, a red `e40` invalidates F-48, a red `e41`
invalidates F-49, a red `e42` invalidates F-50, a red `e43` invalidates F-51, a red `e44`
invalidates F-52, a red `e45` invalidates F-53, a red `e46` invalidates F-54, a red `e47`
invalidates F-55, a red `e48` invalidates F-56, a red `e49`
invalidates F-57, a red `e50` invalidates F-58, a red `e51`
invalidates F-59, a red `e52` invalidates F-60, a red `e53` invalidates F-61 (a repo-side
fix of the sub-8h projection will fail `e53`'s synthetic guard loudly), and a red `e54` invalidates F-62
(a repo-side change to the dependence estimator's closed-form behaviour, or to the DSR clamp, fails `e54`),
and a red `e55` invalidates F-63 (a repo-side fix that purges the walk-forward boundary — R9 — will drive
`e55`'s walk-forward leak counts to zero and fail its `wfLeakMatchesClosedForm` guard loudly, which is the
intended signal to re-derive F-63), and a red `e56` invalidates F-64 (a repo-side change to
`analysis/labels.js` — e.g. a fix for the `pt`/`sl` tie-break, the default-event zero-horizon row, the
dead `events` argument or the auto-window docstring — will fail the corresponding `e56` guard loudly,
which is the intended signal to re-derive F-64 and drop the stale register row), and a red `e57`
invalidates F-65 (a repo-side change to `analysis/overfitting.js` — its split structure, `relativeRank`
NaN/degenerate conventions, the quoted calibration RNG, the `degradation` return or the `cscvBlocks` cap —
will fail the corresponding `e57` guard loudly, which is the intended signal to re-derive F-65 and drop the
stale register row), and a red `e58` invalidates F-66 (a repo-side change to `analysis/reality_check.js` —
the bootstrap index law, the Bartlett estimator, the RC/SPA/subsampling arithmetic or the Politis-White
selector's `g` handling — will fail the corresponding `e58` guard loudly, which is the intended signal to
re-derive F-66 and drop the stale register row), and a red `e59` invalidates F-67 (a repo-side change to
`analysis/forecast.js` — the `confidenceFromProb` inverse, the Brier/Murphy partition, the `logScore` clip,
the `bootstrapMeans` block length or paired draw, the DM statistic, the MCS elimination rule, or the
`forecastComparison` grouping — will fail the corresponding `e59` guard loudly, which is the intended signal
to re-derive F-67 and drop the stale register row), and a red `e60` invalidates F-68 (a repo-side change to
`analysis/race.js` — the `halvingRounds`/`halvingSchedule` closed forms, the `keep`/integer-rounding rule,
the non-finite handling or the `eta`/`minBudget` guards — will fail the corresponding `e60` guard loudly,
which is the intended signal to re-derive F-68 and drop the stale register row), and a red `e61` invalidates
F-69 (a repo-side change to `analysis/benchmark.js` — the standardiser, the centred ridge solve, the
`predictRidge` output map (restoring `ybar`), the MLP seed/init or the factory refusals — will fail the
corresponding `e61` guard loudly, which is the intended signal to re-derive F-69 and drop the stale register
row), and a red `e62` invalidates F-70 (a repo-side change to `analysis/backtest.js` or
`analysis/performance.js` — the hit-rate criterion, the fold scorer's lag, the `erf`/inverse-CDF error
bounds, the Lo SE / PSR / DSR / MinTRL identities, the `poolFolds` restatement or the stationary-bootstrap
calibration — will fail the corresponding `e62` guard loudly, which is the intended signal to re-derive F-70
and drop the stale register row), and a red `e63` invalidates F-71 (a repo-side change to
`analysis/features.js` — the causality or abstain contract, the `causalZScore` guard, the `finiteSum`/`meanOf`
range handling, the `networkMomentum` skip, the regime gate's window scaling or any of the 13 single-feature
references — will fail the corresponding `e63` guard loudly, which is the intended signal to re-derive F-71 and
drop the stale register row), and a red `e64` invalidates F-72 (a repo-side change to
`analysis/uniqueness.js` — the average-uniqueness formula, the ESS/order identities, or the sequential
bootstrap's draw law — will fail the corresponding `e64` guard loudly, which is the intended signal to re-derive
F-72 and drop the stale register row), and a red `e65` invalidates F-73 (a repo-side change to
`analysis/streams.js` — the OHLCV aggregation, the Kish identities, the constant-stream handling or the
selector's `maxStreams` — will fail the corresponding `e65` guard loudly, which is the intended signal to
re-derive F-73 and drop the stale register row), and a red `e66` invalidates F-74 (a repo-side change to
`analysis/world.js` — the shock bounds/phase, the view's self-consistency, the `panelFor` replacement rule or
`worldFromCandles`' `maxBars` — will fail the corresponding `e66` guard loudly, which is the intended signal to
re-derive F-74 and drop the stale register row), and a red `e67` invalidates F-75 (a repo-side change to
`analysis/parallel.js` — the concurrency normaliser, the queue order/bound, the failure semantics or the fold
executor's reply validation — will fail the corresponding `e67` guard loudly, which is the intended signal to
re-derive F-75 and drop the stale register row), and a red `e68` invalidates F-76 (a repo-side change to
`analysis/holding.js` — the grid construction, the restatement surfacing, the break-even ordering/`byId`
readout or the formatter — will fail the corresponding `e68` guard loudly, which is the intended signal to
re-derive F-76 and drop the stale register row), and a red `e69` invalidates F-77 (a repo-side change to
`analysis/replication.js` — the IQM, the stratified bootstrap, the variance decomposition, the CRN ratio or the
formatter — will fail the corresponding `e69` guard loudly, which is the intended signal to re-derive F-77 and
drop the stale register row), and a red `e70` invalidates F-78 (a repo-side change to `analysis/dependence.js` —
the correlations, the equicorrelation identities, the fold grouping, the jackknife, the Student-t tails or the
sign test — will fail the corresponding `e70` guard loudly, which is the intended signal to re-derive F-78 and
drop the stale register row), and a red `e71` invalidates F-79 (a repo-side change to `analysis/decision.js` —
`foldConcentration`, `confidencePersistence`, `nextRunPlan`, `promotionAcrossCadences` or the six-block
`decisionReport` — will fail the corresponding `e71` guard loudly, which is the intended signal to re-derive F-79
and drop the stale register row), and a red `e72` invalidates F-80 (a repo-side change to the `hivemind/kernels/*`
bags — the activations, linalg, normalization, sampling or statistics primitives — will fail the corresponding
`e72` guard loudly, which is the intended signal to re-derive F-80 and drop the stale register row), and a red
`e73` invalidates F-81 (a repo-side change to `core/primitives/{fingerprint,views,weights,series,books}.js` or
`plugins/sleeves/*` — the ported book arithmetic or a sleeve spec — will fail the corresponding `e73` guard
loudly, which is the intended signal that the port no longer reproduces the lab's published books; its
randomized half widens the trap to *any* ported primitive — a `dlogMatrix` guard moved out of reach, a dropped
`blendBooks` `fin` guard or a changed rank tie order fails on the random panels even if the three books still
match).

`e0d_ab_aggregation_1h` dominates the total — the repo's own `poolReports` took **140–590 s** across
runs on this machine — and `e11` ~48–86 s; the remaining steps are ≤ 35 s each (`e15`, which
re-measures the whole carry complex on a second price source, is ~10 s; `e16`, the cost audit, is
~4 s; `e17`, the low-turnover sweep, is ~5 s; `e18`, the reversion-smoothing sweep, is ~2 s; `e19`, the
capacity/impact readout, is ~4 s (it reads `data/perp_flow_8h.json` and builds a trailing-vol map per
symbol, so it is the only step besides `e15` that reads a second data source; `e20`, the capacity-aware
sweep, is ~4 s — it re-uses `e19#capacityOf` and sweeps ~25 weight transforms; `e21`, the open-interest
readout, is ~2–5 s — it reads `data/open_interest_8h.json`, builds two causal books, a robustness read and
the positioning capacity; `e22`, the toptrader validation, is ~3–6 s — it rebuilds the fade with the
EWMA-weight sweep and one `e19#capacityOf` per variant, and reads `data/perp_flow_8h.json` for ADV;
`e23`, the two-stream combination, is ~1–2 s — it rebuilds both smoothed books on one loop and reports
their correlations and mixes; `e24`, the reversal study, is ~35 s (1h) + ~30 s (15m) — it sweeps nine
per-stream arms × `positionsOfFast` + `panelReadout` plus the F-11 controls at both bar sizes, and ~20
dollar-neutral book variants + a 40-seed shuffle placebo each, so it is the heaviest per-bar step after
`e2`; `e25`, the maker-fill study, is ~25 s — it sweeps five quote depths plus three side-controls and
replays ~4 book constructions, and its `taker` arm must reproduce `e24`'s `rank_w1_rev` book to six
decimals (a permanent `validation` guard, L10-u); `e26`, the meta-labelling study, is ~105 s (1h) +
~155 s (15m) — it refits an expanding-window logistic on each of 8 streams × 3 base rules × ~30 blocks,
plus a 4-seed shuffled-label null and a capacity probe, so it is the heaviest step after `e0d` and `e24`;
`e27`, the decay study, is ~2 s — it rebuilds the `e23` books and runs a permutation-null block-trend test
on each; `e28`, the regime re-tune, is ~2.5 s — it audits 16 weight policies on three windows; `e29`, the
walk-forward selection test, is ~3 s — it builds the λ-family once and runs 14 walk-forward selections plus
a bootstrap; `e30`, the retuned-book capacity readout, is ~2.4 s — it measures the impact and OI bounds for
8 weight variants; `e31`, the R8 port-spec capstone, is ~2.3 s — it builds a 40-book (λ, cap) grid and runs
one joint walk-forward plus a five-level fee stress; `e32`, the fade retune check, is ~3.3 s — it sweeps the
fade λ × cap grid, its own walk-forward, and the impact + OI bounds; `e33`, the OI-bound distribution
restatement, is ~2.5 s — it rebuilds the five working sleeves and, for each, computes the three OI bounds
(ratio-of-means / mean-of-ratios / min-of-ratios), the time-varying bound `G_t` and its full/24m/12m/3m
distributions, the participation the published size implies, and two stress reads, with guards against the
`e30`/`e32` stored bounds); `e34`, the OI-scaled sizing study, is ~29 s — it rescales each of the five
working books to a mean gross of 1 and dollar-scores seven causal sizing policies (`const_trail_p5`,
`const_trail_min`, `clipped_trail_median`, `scaled_full`, `scaled_half`, `scaled_ewma`,
`placebo_shuffle`), charging the fee on the actual dollars traded (so resize churn is included) and e19's
square-root impact at each schedule's size, and guards its raw `min_j(OI/|w|)` against `e33`'s stored
min-of-ratios to 1e-9; `e35`, the sleeve-mix / joint-capacity study, is ~2 s — it builds the two final
port-spec books, aligns them on one return interval, and reports the mix net@4 ladder, a walk-forward
allocation rule, each sleeve's individual OI schedule and the **joint** schedule for the combined weights
(guarding each book's individual mean against `e34`'s stored `meanGcap` to within 5 %); `e36`, the
portfolio-OI-frontier LP, is ~2 s — it solves the 2-D joint-capacity LP per period, reports the frontier
distribution, the optimal split and the LP-scheduled book's churn/Sharpe, and guards the LP against the
individual bounds and `e34`; `e37`, the OI-signal rescue, is ~2 s — it rebuilds the e21 Δlog(OI) book
(`e21#xsBookImpl`) under an EWMA λ ladder, audits each with `e16`, runs the F-37 walk-forward λ-selection
and a fee stress, and guards the daily book against `e21`'s stored `dLogOI_pos` (0.9612 / 1501.11); `e38`,
the OI-signal holdout, is ~2 s — it scores the pre-registered λ books on the pre-2024 / post-2024 split,
runs the regime-λ selection and the F-36 block-trend decay test, compares the rank construction, checks the
L18 / toptrader / momentum confounds and the book's OI-schedule bound, builds the fixed 50/50 λ blend, and
guards the daily book against `e21`'s stored `dLogOI_pos`; `e39`, the L19-additivity read, is ~2.3 s — it
aligns the OI blend onto the two port-spec books, runs the capital and risk-normalised mix ladders and
walk-forwards, solves the per-period **3-D joint OI LP** (vertex enumeration over the 2k+3 constraint
planes), reads the optimal OI share and the LP-scheduled churn, and guards `e34`'s OI means and `e36`'s 2-D
LP. `e40`, the R8-λ-policy test, is ~2.4 s — it builds the R8 λ family (rank funding + EWMA + 12.5 % cap),
forms five fixed equal-capital blends, runs the λ-only walk-forward, and compares them on one OOS span,
guarding the pinned λ=0.02 book against `e30`'s full-history Sharpe and `e31`'s OOS net@4. `e41`, the
frozen-λ / no-hindsight-blend test, is ~2.1 s — it rebuilds the R8 λ family and blends, runs a frozen-λ
ladder over five split points, a 10-blend no-hindsight menu, a blend-selection walk-forward, and the
fixed-length-trailing-triangle, guarding the rebuild against `e40` (6.63 / 6.86 / 6.66, diffs 0.00). `e42`,
the cap-hindsight test, is ~1.7 s — it rebuilds the 40-book (λ, cap) grid, runs the joint walk-forward and
the frozen combined / frozen-λ / frozen-cap ladders, and reads the cap sensitivity and bind fraction,
guarding the rebuild against `e31` (6.13 / 6.63 / 6.86 / 1.93, diffs 0.00). `e43`, the fade-pinned test, is
~1.6 s — it rebuilds the fade (λ, cap) grid, runs the joint walk-forward and the frozen cap / frozen-λ /
frozen-joint ladders, and reads the λ-flatness and cap-sensitivity, guarding the rebuild against `e32`
(0.70 / 0.94 / 1.11 / 1.14 / 0.69 / 1.03, diffs 0.00); `e44`, the cap-mechanism test, is ~2.2 s — it
rebuilds the R8 λ=0.02 book, applies the 12.5 % clip and a swept no-trade band, and compares net/gross,
turnover, max `|w|` and both OI capacities at matched turnover, guarding the rebuild against `e30`
(4.92 / 6.18, 17 / 10, 39.63 / 46.04, $20,415,294 / $35,937,181, diffs 0.00); `e45`, the fade
cap-mechanism test, is ~2.0 s — it rebuilds the fade λ=0.05 book, applies the clip and the swept band, and
reads the same metrics, guarding the rebuild against `e32` (0.82 / 1.07, 14 / 8, 118.38 / 182.59,
$37,378,256 / $54,782,334, diffs 0.00); `e46`, the cap-shrinkage mechanism test, is ~1.3 s — it applies
the hard clip, a smooth saturation (`c·tanh(w/c)`), a power shrink and an equal-weight control to the R8
λ=0.02 rows, guarding base/`hard_0.125` against `e30` (4.92 / 6.18, 17 / 10, $20,415,294 / $35,937,181,
diffs 0.00); `e47`, the split-robustness test, is ~1.7 s — it builds the R8 λ-ladder (capped and
uncapped) and sweeps a dense split grid under a rolling-1-year and an expanding `[0,S)` freeze, guarding
the λ=0.02 books against `e30` (4.92 / 6.18, 17 / 10, $20,415,294 / $35,937,181, diffs 0.00); `e48`, the
L19-construction test, is ~2.5 s — it builds the OI books, compares a fixed non-equal two-scale mix, a
`hold-N` cadence and a no-hindsight inverse-vol mix, guarding the daily book against `e21#dLogOI_pos`
(0.9612 / 1501.11) and the 50/50 blend against F-46's `e38` ensemble (0.77 / 11.33 / 254, diffs 0.00); `e49`,
the hold-cadence stress test, is ~1.3 s — it sweeps a fine hold grid (N = 1…36) and runs a drift-aware
true-hold simulation, guarding `e21` (0.9612 / 1501.11) and F-46's `e38` ensemble (0.77 / 11.33 / 254,
diffs 0.00); `e50`, the OI-band test, is ~1.6 s — it sweeps a no-trade band `eps` grid on the OI blend and
compares the net@4-vs-turnover curve to the hold-N grid, guarding `e21` and F-46's `e38` ensemble exactly;
`e51`, the band holdout, is ~1.4 s — it picks `eps*`/`N*` in-sample, freezes them, and scores forward on a
dense split grid, guarding `e21` and F-46's `e38` ensemble exactly; `e52`, the port-artefact test, is ~1.3 s —
it rebuilds each sleeve's raw rows and applies `prototypes/port.js` only, checking 5 books against `e30`,
`e32`, F-52's band/stack and `e50`; `e53`, the carry-grid audit, is ~2.5 s — it measures the repo's
`carryOnBarGrid` against a synthetic 8h/4h/2h/1h ground truth and against the shipped SOL/FTX window,
guarding F-61; `e54`, the dependence-audit, is ~25 s — it ensembles `dependenceSummary` over synthetic
equicorrelated / identical / negatively-correlated / i.i.d. panels against their closed-form design effects
(with 2.5-SE bands), measures the estimator's own noise at C = 36 vs C = 288 folds, and probes the
`effectiveBars = n/DE` bound with a hedged pair before handing it to `backtestMetrics`, guarding F-62; `e55`,
the split audit, is ~0.1 s — it checks `purgedKFoldSplit`/`combinatorialPurgedSplit` for zero label-window
leakage on a synthetic overlap grid, counts `walkForwardSplit`'s leak edges against the closed form
`H(H−1)/2` per fold, probes the fold metadata / causality guard / label-argument path, and measures the
leak's exploitability with an index-lookup model over 200 seeded worlds, guarding F-63; `e56`, the labels
audit, is ~0.08 s — it checks `tripleBarrierLabels`' first crossing against `ceil(level/step)` on 192
monotone cases and its three-way `ret` / first-crossing / timeout-index contracts on 60 seeded random
paths, matches `cusumFilter` to an independent drawup/drawdown formulation of its reset rule (and shows its
`events` argument is ignored and its `lastEmit` guard is dead), verifies `fractionalDiffWeights` against
the binomial closed form (integer `d` exactly; non-integer `d` via an independent Lanczos-`Γ`), and checks
the **shipped** `fracDiffAt`/`fracMomentum` against the weights convolution, guarding F-64; `e57`, the
overfitting audit, is ~11 s — it checks `cscvBlocks`' partition, `cscvSplit`'s `C(S,S/2)` count / disjoint
cover / block multiplicity / complement closure / cap, `relativeRank`'s rank formulas and
`oosOnIsRegression` against an independent sum-formula OLS, builds exact constructed PBOs (all-flat, one
dominant, anti-persistent pair, metric override), reproduces the repo's quoted calibration draw with its own
RNG, ensembles 60 i.i.d. matrices to measure the estimator's own spread (sd 0.2546 vs a binomial 0.0315 —
design effect 65.4), and probes the `relativeRank` NaN path, the fully-tied convention, the `degradation`
return and the `cscvBlocks` degenerate case, guarding F-65; `e58`, the resampling-hub audit, is ~5.6 s — it
replays `stationaryBlockIndices` against its rng stream (b = 1 → i.i.d. with replacement; the geometric
restart law; mean run length) and measures the restart rate, checks `neweyWestSE` against an independent
Bartlett implementation / slice invariance / the default bandwidth, ports `arch._single_optimal_block` (from
source) to compare the Politis-White selector against the repo and rebuilds the arch AR(1) reference vector
(13.635665 / 15.608940) from an independently implemented NumPy legacy-RandomState stream, checks the RC/SPA
closed forms, the exact consistent-recentring bound, the step-down's bit-equality with the consistent SPA,
the subsampling family's one-shared-reference / determinism / segment awareness, and re-measures the
RC/SPA/subsampling sizes against the block bootstrap across the persistence sweep, guarding F-66; `e59`, the
forecast-scoring audit, is ~5 s — it checks `forecastPairs` against the `confidenceFromProb` inverse + next-bar
sign + fold-last-bar drop + non-finite skip, the `brierBinIndex`/`brierScore`/`logScore` closed forms, the
Murphy decomposition against the repo's own independent second implementation
(`observer/legion_metrics.js`, agreeing to 1e−12) and the exact raw-minus-binned gap identity
`gap = withinVar − 2·withinCov`, `bootstrapMeans`' determinism / default block / paired draw, the DM statistic
against an independent reconstruction (degenerate arms + a 400-rep i.i.d. size battery), the MCS structure
(sample-best retention over 4 ensembles × 200, near-nominal coverage, an independent HLN
elimination-denominator comparison over 150 configs) and the `forecastComparison` grouping / skill formulas /
alignment guard (incl. the 6 count-coincident misalignment witnesses), guarding F-67; `e60`, the racing-engine audit, is ~30 ms — it checks the `halvingRounds` closed form + guards,
`halvingSchedule`'s `keep` / monotone budgets / top rung / early stop, and `successiveHalving`'s full-rung
arm order / `nonFinite` elimination / `maximize:false` / sync-vs-async equality / stable ties / cost
reconstruction / guards, then swaps the fixture's budget-independent oracle for a `q + N(0,1)·2/sqrt(budget)`
evaluator to measure the top-budget-disagreement the docstring's "decided set" claim denies
(0.617/0.617/0.700/0.625), sweeps `spentBudget` against `gridBudget` (1.000–2.890×) and instruments the
small-`eta` rung collapse (15/25 at `eta=1.1`), guarding F-68; `e61`, the P1-benchmark audit, is ~70 ms — it
checks the standardiser (zero-mean/unit-std, a collapsed constant column, the empty-input shape), `fitRidge`
against an **independently solved** centred ridge (matching to 0), the unpenalised intercept, `predictRidge`'s
(0,1) range, `fitBaseRate` = the prior, the ridge/MLP separable-rule accuracy, MLP byte-determinism,
`BENCHMARK_KINDS` + the `tsfm`/unknown-kind refusals and a perfect classifier beating the base rate on Brier,
then instruments the ridge arm's **output map** — the dead training-base-rate term (`ybar` is never restored,
so a constant-y fold reads exactly 0.5), the sigmoid band cap (`sigmoid([-1,1])`, a perfect feature reads
Brier 0.1425), the unverified "hand solve" claim and the eps constant-column amplification (`z = 1e8`) —
guarding F-69. `e62_backtest_audit.js` then takes the **measurement layer** (`analysis/backtest.js` and its
instrument `analysis/performance.js`): it checks the instrument's error bounds and closed-form identities
against **independent references** (Simpson quadrature for `erf`, a Lentz-erfc reference for the normal tail,
hand recomputes of the Lo SE / PSR / the expected-max hurdle / MinTRL, and a 1000-series size-calibration
battery for the stationary bootstrap), the backtest arithmetic against independent recomputes (positions,
turnover, gross/cost/net, equity, drawdown, tradeCount, the break-even identity), a `poolFolds` restatement
identity and the serial↔concurrent byte-identity, and then instruments the **criterion** of the hit rate
(`r === 0` where the docstring promises "no position" — so exit-cost bars count as misses), the fold scorer's
within-slice re-lag, and the NaN-sharpe → `beyond-horizon` mislabel — the same cycle **disproves** the
negative-MinTRL lead with Pearson's inequality (`v >= (1 - skew*SR/2)^2 >= 0` for measured moments).
Guarding F-70. `e63_features_audit.js` takes the **causal signal family** (`analysis/features.js`): it checks
the **causality** contract for all 16 candidates (a strict-future perturbation of closes/returns/volumes/panel
leaves `positionAt` bit-unchanged; 0 mismatches over 16×100 bars, non-vacuous), the **abstain** contract
(returns-only view → 0 on exactly the five channel-dependent candidates; degenerate series finite in [−1,1];
`clampPosition` exact), the 13 single-feature references to 1e-12 (with `fracDiffAt` also equal to the shipped
`labels.js#fractionalDiff` convolution), the cross-section and the regime gate, and then instruments the
`causalZScore` zero-dispersion guard (an exactly-constant window reads `|z| = sqrt((n−1)/n)`, not 0), the
`finiteSum` empty-range 0 vs `meanOf` NaN, `networkMomentum`'s self-inclusion without `streamIndex`, and the
regime gate's window mis-scale — settling L10-e and guarding F-71. `e64_uniqueness_audit.js` takes **sample
uniqueness** (`analysis/uniqueness.js`): it checks `sampleUniqueness` against an **independent per-bar
scan-all-spans** recompute (1e-12) and against the shipped `overlapUniqueness` (exactly 0 on 8 fixtures),
per-label order-invariance and the ESS identities, then pins the sequential bootstrap's **draw law** — the
weight is the uniqueness **sum**, not the average (two non-overlapping maximally-unique labels are drawn in the
ratio of their lengths), and the implemented heuristic is not the AFML ch.4 bootstrap it cites.
`e65_streams_audit.js` takes the **stream design layer** (`analysis/streams.js`): the resampler against a hand
recompute and the OHLCV invariants, the Kish design-effect identities, the `fold-sharpe`-iff-tiles rule and
the selector contract — then pins the **constant-stream inflation** (a zero-variance stream is skipped from
`rbar` but counted in `K`/`rawBars`) and `maxStreams <= 0` = unlimited. `e66_world_audit.js`
takes the **audited evaluation world** (`analysis/world.js`): the shock bounds/phase shift, `shockCandles`
identity/scaling/non-uniformity, the view's base+probe contracts and the panel attachment — then pins the
**missing-`streamIndex` vacuous audit** (the panel's own slot is never replaced) and the `maxBars <= 0` slice
flip. `e67_parallel_audit.js` takes the **order-preserving scheduler** (`analysis/parallel.js`): the
concurrency normaliser, the queue contract (unit order, exactly-once exec, the in-flight bound, best-effort
`onResult`), the failure semantics and the fold executor's reply adaptation — then pins the unvalidated `max`
cap and the silently-nulled `confidence`/`stats`. `e68_holding_audit.js` takes the **turnover policy grid**
(`analysis/holding.js`): the cartesian grid construction, each row against a direct `restateReportAtPolicy`
recompute, the break-even ordering / `byId` / `bestTurnoverPolicy` readout, the two bail-outs and the
formatter — then pins the **dead `costBps`** (echoed, never threaded), the **unreachable `requireCleanAudit`
hurdle** (the restatement drops the `audit` block) and the **shallow-frozen default grid**. `e69_replication_audit.js`
takes the **seed-replication layer** (`analysis/replication.js`): the IQM contract, the stratified bootstrap's
determinism/size-preservation/abstentions and its empirical coverage, the variance-decomposition identities, the
CRN `pairedVarianceRatio` arithmetic, the `seedDistribution` structure and the formatter — then pins the **IQM
that is not the cited Agarwal estimator** and the **CI label that can lie**. `e70_dependence_audit.js`
takes the **cluster-inference module** (`analysis/dependence.js`; pure, imports nothing): the correlations and
their NaN guards, the equicorrelation identities, the fold-window grouping, the jackknife against a hand
recompute, the Student-t tails against the exact df = 1/2 closed forms, the critical-value round trip, the exact
sign test and the two paired cluster tests — then pins the **stability flag that drops half its rule** and the
**sign test that underflows**. `e71_decision_audit.js`
takes the **decision-grade report** (`analysis/decision.js`; pure): `foldConcentration` against a direct
`strategyReturns`+`sharpeRatio` replay, `confidencePersistence`'s pooled within-fold lag-1 and half-life,
`pairedUnitsNeeded` against a brute-force minimal-n search, all six `cheapestFlip` kinds, the
`promotionAcrossCadences` majority/veto rule and the `decisionReport`/`formatDecision` shape — then pins the
**policy restatement that mixes two position-series bases** (`restateReportAtPolicy` replaces `folds` but carries
the original `foldInputs`). `e72_hivemind_kernels_audit.js` takes the **hivemind numeric kernels**
(`hivemind/kernels/*`; pure, installed on `HiveMind.prototype`): the activations, the linalg helpers,
RMSNorm/RoPE/semantic normalization, the samplers and the statistics helpers against their closed forms — then
pins the **`+∞` activation that reads as 0**, the **falsy-zero family** (`|| 1`), the **length-mismatch
divergence** and the **dead clamps / mis-named fractal dimension**. `e73_port_verify.js` is the **port
verification** — the inverse of an audit: it imports the REPO's `core/primitives/*` + `plugins/sleeves/*`
read-only, rebuilds the lab's real carry panel, drives each sleeve through its `signal()`/`returns()`, and
requires the rows/returns/metrics to match the lab's stored books (`e30`/`e32`/`e50`) bit-for-bit, and (its randomized half) requires every ported primitive — `buildFundingBook`, `buildCrossSectionalBook`, `rowRankWeights`/`rowLevelWeights`, `cleanBook`, `turnoverSeries`, `dlogMatrix`, `blendBooks` — to equal the lab function it was ported from (`e17`/`e21`/`e22`/`port.js`/`e16`) on **250 seeded random panels** — then pins
**L10-ct**, the two-array book-grid ambiguity (F-81). A full
regeneration measured
**~8–25 min** end-to-end (81 steps, 50 gated; machine-load dependent).

## Add an experiment

1. Create `experiments/<eid>_<slug>.js` exporting `async function run(options) { ... }`.
2. Import the harness from `../lib/lab.js`; never re-implement a metric.
3. If it belongs to a lead, add it to that lead file's *Owner experiments* line and to
   `leads/INDEX.md`.
4. Register it in `experiments/run_all.js` if it should be regenerated with everything else.
5. If it joins two data sources, add its invariants to `e14_data_integrity.js`.
6. Record the run in the current `cycles/CYCLE-*.md` and add any new number to `FINDINGS.md`.

## Conventions

* **O(n) scoring**: use `positionsOfFast` for sweeps and `positionsOf` only for validation; run
  `e0c_validate_pipeline.js` first in any cycle that relies on the fast path.
* **Price lookups must respect bar labels**: use `loadCloseLookup(path, { barMs })` — never raw
  `close(t)` (F-11: that bug manufactured Sharpe −17).
* **When TWO data sources are compared, the lenient lookup is a trap.** Four rules, all of them
  consequences of real bugs (F-18, and `e14_data_integrity.js` asserts each):
  1. `.exact(t)` — use the close of a bar that *ends exactly at* `t`; the plain `lookup(t)` silently
     bridges missing bars and stretches an 8h return into 9h/10h.
  2. `t <= lookup.lastClose` — past the candle history the lookup carry-forwards a **frozen** price, so
     any other leg keeps moving while spot does not (the candles end 2026-09-19, the funding files run
     to 2026-09-24 → fake ±5 %/8h "basis" moves).
  3. Aggregate before joining — funding rows arrive on the 8h grid *except* when Binance changes a
     contract's funding interval (SOLUSDT ran 2h/4h through FTX); `loadFundingBuckets` SUMs rows into
     8h buckets, whereas a `Map` keyed on the grid keeps only the last.
  4. `data/perp_flow_8h.json` is on the traded-perp grid with `t0` = the first close time and **no
     leading null** — look it up with `flowIndexAt`, never by raw index. `e14#perp_flow_integrity`
     asserts it matches the traded close grid and that `qv ≈ close·vol` (median 1.000); if it goes red,
     every `e19` capacity number is void.
  5. `data/open_interest_8h.json` is on the **same absolute grid** as the flow file (`t0` = first window
     end, no leading null) — look it up with `flowIndexAt`. `e14#oi_integrity` asserts the grid match,
     `oiVal ≈ oiContracts·close` and `topLS ∈ [0, 1]`; if it goes red, every `e21` number is void.
* **Book index ↔ leg index (the CYCLE-013 look-ahead, F-11 class).** `e12#buildXsSeries` sets
  `bookTimes[m] = legs.times[m+1]`, so book period `i` *ends* at `times[i]` and its return is
  `legs.spotRet[i+1]` — the signal at `i` is contemporaneous with that return. The **next** return is
  `legs.spotRet[i+2]`. Using `[i+1]` as "next" manufactures IC 0.60 / Sharpe 17 (`e21` hit this). Any
  experiment that scores a signal against a *future* return must assert the lag; `e21` carries a
  contemporaneous-vs-next IC profile for exactly this reason.
* **Missing signals are MASKED, not zeroed (L10-r).** In a cross-sectional book, setting an absent
  symbol's signal to `0` and then demeaning it gives that symbol the weight `(0 − mean)/Σ|·|` — a real
  position for a symbol with no data. Exclude absent symbols from the demean and give them weight 0, and
  start the book where every symbol is present (or report the start). `e14#oi_missing_is_null` asserts
  the precondition (asymmetric coverage; missing stored as `null`, never `0`).
* **Never re-derive the carry book.** `e3_carry.js#loadCarryBook` is the lab's single definition of the
  sleeve (marks + funding buckets + alignment + skip counters). E7, E11, E12, E13 and E15 all read it;
  if a new experiment needs a carry P&L, extend that function rather than copying the loop (a copy is
  how `e7` accumulated three of the four F-18 bugs). `loadCarryBook(symbols, {perp})` is the only
  switch for the perp leg (`'mark'` | `'traded'`), which is how E15 compares the two without a second
  implementation.
* **Derived results get extracted, not duplicated.** When a second experiment needs an existing
  computation, export it from the first and import it — `e15` imports `e11#sizingFromBook`,
  `e7#reversionFromBook` and `e12#buildXsSeries` rather than re-implementing them. A refactor like this
  is verified by re-running the source experiment and diffing the artefact (the `sizingFromBook`
  extraction left `e11_vol_1h.json` byte-identical).
* **Report the outlier-robust design effect too.** `serialDesignEffect` jackknifes the Sharpe, so on a
  fat-tailed series one bar can inflate it ~10× (flat carry: 99.5 raw vs 11.8 winsorised vs 11.0
  ex-FTX). Use `robustDesignEffect` alongside it and quote a block-bootstrap CI — see F-20.
* **Report cost, not just gross.** Every return series the lab produces is *gross* (no fees). Any book
  that changes its exposure must be audited for turnover — `e16_cost_capacity.js` is the canonical
  implementation (exposure vectors → L1 turnover → break-even bps → net Sharpe ladder). F-23 is why:
  a book's gross Sharpe says almost nothing about whether it is tradable.
* **Report capacity, not just cost.** Fee is only half the cost; impact scales with size. A book that
  trades Q dollars against a bar trading V pays `~Y·σ·√(Q/V)` in slippage. `e19_capacity_impact.js` is
  the canonical implementation (weights + `data/perp_flow_8h.json` → `c_t·√G` → capacity per `(Y, fee)`).
  F-26 is why: the dispersion sleeve clears the fee and still dies at $100 M.
* **For a hold-like (smoothed) book, report the OPEN-INTEREST bound too — the impact capacity is
  fictional (L15 / F-38).** The square-root capacity of a book whose per-period trade → 0 diverges
  (`e30`'s λ=0.005 variant reads **$4.0 B**), because the model charges only the trade and a near-hold
  never trades. The honest size limit for a persistent book is OI: `G` such that `mean|w_j|·G` reaches a
  fraction of the symbol's open interest (`data/open_interest_8h.json`; the `e21` construction, reused by
  `e30`). `e30_retuned_capacity.js` is the canonical readout for the retuned dispersion family and reports
  `min(impact, OI)` as the usable size; state the OI basis (mean vs current) whenever capacity is quoted.
* **An OI capacity is a *schedule*, not a number (F-41/F-42).** The bound is a per-period constraint
  `G_t = f·min_j OI_j(t)/|w_j(t)|`, so quote it as a distribution (mean/p5/median/p95), and never as
  `f·mean(OI)/mean|w|` (a *ratio of means*, 2.6–8.8× too optimistic). Two rules follow, both measured in
  `e34`: (a) a **constant** size chosen from the trailing distribution still breaches the cap in the 3–4 %
  of periods where OI falls fastest — the certified-safe constant is the *running minimum*, not the p5;
  (b) the limit must be applied as a **hard clip** (`min(target, G_t^cap)`), never as a smoothed/lagged
  target, because a lagged size sits above a falling bound and breaches **53–55 %** of periods. The
  compliant, low-churn recipe is the **clipped trailing-median**. (c) `min_j` needs **every traded
  symbol** to have an OI print — a min over a partial symbol set is meaningless (it printed $936 B on
  2021-11-04; `e33`/`e34` drop uncertifiable periods). Read the whole sizing-policy family in
  `e34_oi_scaled_sizing.js`, not a single target.
* **A multi-sleeve OI size is an LP, and its frontier is only a capability (F-43/F-44).** When two sleeves
  share thin symbols the joint capacity is `max Σ_s g_s G_s` s.t. `|Σ_s G_s w^s_j| ≤ f·OI_j` for every
  symbol — a 2-D LP per period (`e36#lpFrontier`, vertex enumeration **including the axis vertices**;
  omitting the axes understates the optimum and fails `e36`'s guard). Quote its **distribution**, not one
  number: the free-split frontier is ~1.1× the sum of the individual bounds on average but 0.88× at the
  median, and its optimal split is unstable (fade share p5 0 / p95 1). Do **not** deploy the LP-optimal
  size directly — re-optimising each period churns **48.5× gross/yr** and nets net@4 **0.62**. Size a
  *portfolio* to the **fixed-split** joint bound (F-43); if a joint schedule is wanted, clip it (F-42) in
  two dimensions.
* **Execution realism is a first-class cost term, and it is causal.** `e25_maker_fill.js#fillSelection`
  is the canonical *fill* model: a book's desired trade at the signal close is a resting quote at
  `reference ± depth·spread`; it fills only if the *next* bar's range touches it, and **unfilled exposure
  is cancelled, not carried** (so the realised position is a selection of the book's own signals — this
  is the selection cost, not a fee). `high`/`low` now flow through `loadSeries`/`alignPanel`/`tail` for
  this; `e14#candle_grid` asserts `low ≤ close ≤ high`. Always carry a **side-control**: replaying the
  same fill model on a seeded-random trade side isolates execution cost from signal edge (F-34: the
  friction was identical, so it was pure adverse selection). Never trust an OHLCV spread *estimator* for
  this horizon — Corwin–Schultz/Roll read 13–33 bps here, an order of magnitude too wide; measure the
  friction directly (F-34).
* **Annualisation is a basis, not a data property.** `lib/lab.js` scores per-stream arms with
  `periodsPerYear = 252` (the repo A/B's convention), while the 8h book helpers use `365*3`. A bar-grid
  book can therefore be audited on a *different* scale from the arms it is compared with. `e12#statsOf`
  and `e16#audit` now take an optional `periodsPerYear` (default unchanged); `e24` passes 252 so its books
  sit on the same Sharpe scale as `e2`'s arms, and reports turnover on the **true** calendar basis
  (8760 1h / 35040 15m) where a per-year number is physical. State the basis whenever two Sharpe scales
  appear in one table.
* **Placebos must be distributions, not draws.** A single permutation's realised Sharpe can be ±1 by
  chance; `e12#buildXsSeries` returns `placeboSharpes` over 40 seeds and `placeboSummary` reports the
  z-score of the real book against it.
* **Meta-labelling is tested at the TARGET, not the architecture (L06 / F-35).** `e26#causalOos` is the
  reusable primitive: label each bar a rule acts by the sign of its forward `H`-bar P&L (plus a directional
  triple-barrier variant), fit a plain L2 logistic on the repo's causal features, and score **OOS Brier
  skill against the causal training-window base rate** — the best constant predictor you could have known
  — with the horizon PURGED (a training row enters only once its label has resolved before the first
  predicted bar). Always report (a) a label-shuffled null distribution of OOS skill and (b) an
  oracle/anti-oracle **filter** control; and treat a positive AUC with a non-positive Brier skill as "a
  whisper, not an edge" — F-35's target had AUC ≈ 0.51 at n ≈ 10⁵ and zero usable skill.
* **Re-tuning a parameter is a *walk-forward rule* until a test says otherwise (L12/L16 / F-37).** When a
  cycle finds that some parameter value fixes a recent-window failure (F-37: a slower EWMA λ lifts the
  dispersion book's recent break-even above the fee), the winner was chosen on the very window it is
  credited with — PROTOCOL §3.2 forbids reporting that as evidence. `e29_regime_retune_oos.js` is the
  canonical answer: at each block, pick the parameter by a **trailing** score computed only from data
  strictly before the block, trade it through the block, and compare the resulting never-seen series to the
  pinned candidates on the same span; sweep the (lookback, block) grid so the answer does not hinge on one
  choice. Carry a **control that selects by the wrong objective** — e29's gross-Sharpe selector picks a fast
  λ and nets +0.28 vs the cost-aware selector's +5.71, which is what identifies the mechanism as *cost*.
  When more than one parameter is in play, walk forward over the **joint** grid (F-39 / `e31`: (λ, cap)) —
  the surface is larger, so the OOS test matters more — and re-score the single chosen OOS return/turnover
  series at **several fee levels** so the verdict is not hostage to one fee assumption (F-39 stays
  net-positive at 10 bps). **Scope the rule before applying it (F-40 / `e32`):** walk-forward selection
  beats pinning only when the signal is strong enough that a trailing window is informative (dispersion
  Sharpe ~5: +6.13 vs +2.76) — on the weak fade (Sharpe ~0.8) it *underperforms* pinning (+0.70 vs +0.94),
  and where the break-even already clears the fee there is nothing for a retune to fix. Test the transfer;
  do not assume it. The CAP, by contrast, transferred to both sleeves (it fixes concentration, F-27/F-38/F-40).
* **A decay claim is a *trend test*, not two halves (L12/L18 / F-36).** `e27_decay.js` is the canonical
  implementation: split a book's *net* return into 8 contiguous blocks, compute the block Sharpe, and test
  its correlation with block index against a **permutation null** (shuffle the block values). Report the
  block-level **break-even** alongside the Sharpe — F-36 found the carry dispersion book's gross edge
  intact (gross trend p 0.39) while its *break-even* fell below the fee, so a Sharpe-only decay test would
  have missed the mechanism. Always validate a rebuild against the source artefact (`e27` reproduces
  `e23`'s gross Sharpes).
* **Paths**: `loadSeries('candles_xrpusdt_1h.jsonl')` resolves under the repo's `src/data/`, falling
  back to `src/` for BTC 1h (`candles.jsonl`).
* **Result size**: write data to `results/`; return only a summary from an eval.
* **Anything that cannot be reproduced is not a finding.** Regenerate with `run_all.js`, and require
  `e0c`, `e5` (both timeframes) and `e14` to report `pass` in the summary.
* **Regressions get a test, not a comment.** Every bug found becomes a check in `e14_data_integrity.js`
  so a later change cannot silently reintroduce it. When the defect is in the **repo** (which the lab
  cannot fix), the rule splits in two: a **lab-side invariant** goes in `e14` (e.g.
  `sub_8h_sleeve_equality` pins the bucket-sum projection), and a **repo-side audit** goes in its own
  experiment that measures the repo's function against a **synthetic ground truth** with a known correct
  answer (`e53_carry_grid_audit.js`, F-61; `e54_dependence_audit.js`, F-62; `e55_split_audit.js`, F-63 —
  where the closed form is a label-overlap *count*, so no randomness is needed; `e56_labels_audit.js`,
  F-64 — where the closed forms are first-touch `ceil(level/step)`, the binomial weight recurrence and the
  NaN warm-up, all exact; `e57_overfitting_audit.js`, F-65 — where the closed forms are the `C(S,S/2)` split
  count / block multiplicity / complement closure / rank formulas and an independent OLS, all exact, *plus*
  a seeded ensemble that measures the estimator's own spread; `e58_reality_check_audit.js`, F-66 — where the
  reference is an **independent port of the documented implementation**
  (`arch.bootstrap.base._single_optimal_block`) plus an independently implemented NumPy legacy-RandomState
  stream for the reference vector, and the exact identities are replayed against the rng stream;
  `e59_forecast_audit.js`, F-67 — where the reference is the repo's **own second implementation** of the
  same decomposition (`observer/legion_metrics.js#brierDecomposition`, agreeing to 1e−12), so a claim in one
  module can be checked against another module in the same tree, and a docstring identity can be falsified
  exactly (`gap = withinVar − 2·withinCov`, not `withinVar`); `e60_race_audit.js`, F-68 — where the closed
  forms are the round count / schedule / cost counters, and the test **replaces the fixture's
  budget-independent oracle with a budget-dependent evaluator** so the claim the fixture "validates" is shown
  to be a tautology and then falsified); `e61_benchmark_audit.js`, F-69 — where the reference is an
  **independently re-solved** closed form (the same normal equations, solved in the audit) and the finding is
  that the module's **output map** (a centred predictor squashed through a sigmoid) is not the fitted linear
  probability, so a shipped arm's Brier is a readout of a bounded map, not of the model class);
  `e62_backtest_audit.js`, F-70 — where the references are **external** (Simpson quadrature for `erf`, a
  Lentz-erfc reference for the normal tail, hand recomputes for the Lo SE / PSR / the expected-max hurdle /
  MinTRL, and a 1000-series size calibration for the stationary bootstrap), the finding is that a readout's
  *criterion* is not the documented one (`hitRate` skips `r === 0` while its docstring excludes no-position
  bars — and the net series makes exit-cost flat bars count as misses), and a probe lead is **disproved by an
  inequality** rather than merely unmeasured (`v ≥ (1 − skew·SR/2)² ≥ 0` for measured moments, by Pearson));
  `e63_features_audit.js`, F-71 — where the references are the module's own **contracts** (causality under a
  strict-future perturbation, abstain on a missing channel or degenerate series) plus independent recomputes of
  13 features, the cross-section and the gate, and the finding is a **floating-point defeat of a guard**: the
  `std is 0` abstain is unreachable for an exactly-constant window because the sample mean is not bit-equal to
  the value, so the feature reads `|z| = sqrt((n−1)/n)` instead of 0 (latent, but real on any coarse/rounded
  feed — the L10-l class); `e64_uniqueness_audit.js`, F-72 — where the quantity is exact (average uniqueness
  against an independent per-bar count, and the shipped re-implementation to 0) but the module's only
  *algorithm* is not the cited reference: the sequential bootstrap weights by the uniqueness **sum** instead
  of the average (length bias) and uses a static numerator instead of the reference's conditional
  reweighting, pinned by enumerating the module's own law against a Monte-Carlo and against an independent
  AFML ch.4 implementation); `e65_streams_audit.js`, F-73 — where the exact part is a **hand recompute** of an
  aggregation plus a set of algebraic identities (the Kish design effect), and the finding is an **internal
  inconsistency between two functions in the same module** (the design effect counts a stream the selector
  cannot correlate) plus an API edge (`maxStreams <= 0` = unlimited); `e66_world_audit.js`, F-74 — where the module
  exists to close a VACUITY trap, and the finding is a NEW vacuity (a missing `streamIndex` hands a
  cross-sectional candidate its unperturbed series) plus a boundary (`maxBars <= 0` flips the slice);
  `e67_parallel_audit.js`, F-75 — where the contract is a QUEUE (order, exactly-once, in-flight bound, first-error
  abort with no dangling promise) tested with an out-of-order async workload, and the findings are two
  unvalidated edges (a cap and a reply field). `e68_holding_audit.js`, F-76 — where the module is a thin PURE
  wrapper over two other functions, so its entire readout is reproducible offline (each row against a direct
  `restateReportAtPolicy` recompute), and the findings are **a dropped option** (`costBps` echoed, never
  threaded), **a hurdle the caller asks for that cannot fire** (`requireCleanAudit` after the restatement
  discards the `audit` block) and a shallow `Object.freeze`. `e69_replication_audit.js`, F-77 — where the module is
  again pure statistics, and the findings are **a cited-reference mismatch** (the "IQM" is a rank-slice, not the
  Agarwal quantile-filter — a witness `[0,0,5,10]` reads 2.5 vs 1.6667) and **a label that can lie** (the
  formatter prints its own `alpha`, so a 90% interval can be labelled `95%CI`), with the CI's coverage measured
  (0.92) rather than assumed. `e70_dependence_audit.js`, F-78 — where the module is PURE and imports nothing, so the
  audit needs no harness beyond hand recomputes, and the findings are **a boolean that omits half its documented
  rule** (`clusterStability.stable` never tests `worstDelta > minDelta`, so a looser `minFraction` lets a
  collapsing edge read stable) and **a silent numeric underflow** (`signTest`'s `0.5^n` pmf start makes any
  n >= ~1075 cluster test read `pValue 0`). `e71_decision_audit.js`, F-79 — where the module is PURE (imports
  nothing), and the finding is **a restatement that keeps one block's input but swaps another's**
  (`restateReportAtPolicy` rebuilds `folds` from the restated positions yet carries the original `foldInputs`, so
  a consumer that re-derives returns from `foldInputs` — `foldConcentration` — reads pre-policy positions beside
  post-policy gross; the shipped cost-only restatement is consistent, so it is latent). `e72_hivemind_kernels_audit.js`,
  F-80 — the first audit outside `analysis/`, where the target is the MODEL's own primitives; the findings are **a
  non-finite guard that reads the `+∞` tail of a probability as 0** (`_sigmoid`/`_silu` gate on `isFiniteNumber`
  before the `±100` clamp, so the clamp is unreachable for exactly `±Infinity`) and **a `|| 1` family** that turns a
  legitimate zero norm/percentile into 1. `e73_port_verify.js`, F-81 — the register's first **port
  verification**, where the target is the REPO's own V2 code and the "ground truth" is the lab's stored books:
  the repo primitives + sleeve plugins must reproduce R8/R7/OI **bit-for-bit** on the real panel (they do), and
  the exercise pins the lab's own **book-grid ambiguity** (L10-ct). A synthetic test is the only
  kind that catches a defect which **fails safe** — the F-18 direction lesson, now with three examples (the
  four carry joins, L10-w's ratio-of-means, and the sub-8h projection that *flatters* the sleeve). For a
  *statistic* rather than a join, the synthetic test also needs an **ensemble and a standard-error band**
  (F-57: one realisation of a noisy statistic is not a measurement) — `e54` is the template: closed form +
  seeded trials + `tol = max(floor, 2.5·se)` per row.
