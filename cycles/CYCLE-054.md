# CYCLE-054 — The measurement layer: `hitRate`'s documented exclusion cannot be implemented and its implemented one counts exit-cost bars as misses; the fold scorer re-lags the signal inside the test slice; and a probe's "negative MinTRL" defect is disproved by Pearson (L10-bp…L10-br)

**Date:** 2028-05-30
**Goal:** `analysis/performance.js` is the lab's **significance instrument** (the Lo (2002) Sharpe standard
error, PSR/DSR/MinTRL, the stationary-bootstrap p-value) and `analysis/backtest.js` is the layer that ties
splits + costs + that instrument into the pooled out-of-sample report the promotion gate reads. Neither is on
the locked hot path, but every honest-evaluation number in a `report.json` comes from them: `walkforward.js`
and `analyze.js` are built on `purgedCVBacktest`/`poolFolds`/`backtestMetrics`, and `performance.js` is
imported by `backtest`/`walkforward`/`forecast`/`decision`/`reality_check`/`overfitting`/`replication`/`streams`.
This cycle is the measurement layer's turn under the synthetic-ground-truth discipline.

## Work

New experiment `experiments/e62_backtest_audit.js` (registered; **70 steps, 39 gated, 0 fails**; 4.13 s in the
suite; **26 checks, all pass**). One probe cycle first (`probe_perf` + `probe_backtest`) established the
witnesses, then both probes were deleted. The audit has two halves: the instrument's own error bounds and
identities against **independent references** (Simpson quadrature for `erf`, a Lentz continued fraction for the
normal tail, a hand recompute of the Lo SE / PSR / the expected-max closed form / MinTRL, and a 1000-series
size-calibration battery for the bootstrap), and the backtest arithmetic against independent recomputes
(positions, turnover, gross/cost/net, equity, drawdown, tradeCount, the break-even identity, `poolFolds`
restatement, and serial↔concurrent byte-identity). Three findings followed, and **one of them kills the lead
that started the cycle** (F-70's third row).

## Results

### A. The instrument is exact to its documented bounds (validated)

| claim | measurement |
| --- | --- |
| `erf` within A&S 7.1.26's 1.5e-7 | max abs error vs **Simpson quadrature** (h = 1e-3) = **1.393e-7** over x ∈ [−4, 4] step 0.002 (worst at x ≈ 0.046) |
| `normalCdf(0) = 0.5` exactly, and Phi is odd | exact; `normalCdf(−x) + normalCdf(x) = 1` exactly for 6 x |
| `normalInvCdf` round-trips within Acklam's 1.15e-9 | max |`cdfRef(z) − p`| = **2.46e-10** over 15 p from 1e-9 to 1−1e-9, against the **Lentz-erfc** reference; Φ⁻¹(0.975) = 1.95996398612, Φ⁻¹(0.001) = −3.09023230471; antisymmetry ≤ 2.8e-14 (worst p = 1e-6: −5.8e-12) |
| the moment conventions | `kurtosis([1..5]) = 1.7`, `skewness([1..5]) = 0`, `stdSample = √2.5`, `stdPopulation = √2`, `mean([]) = NaN`, `skewness([1]) = 0`, `kurtosis([2,2,2]) = 3` |
| the Lo (2002) Sharpe SE | `sharpeStandardError({sharpe:1,n:100}) = √(1.5/99)`; a skew/kurt case recomputed by hand; NaN at n < 2 |
| the Sharpe estimator | per-period = mean/sd(sample) to 1e-15, annualisation = ×√pp, a flat series → **0** (not NaN), n < 2 → NaN |
| PSR = 0.5 at its own benchmark | exactly 0.5; the general case matches an independent z to **5e-7** (the bound the module's `erf` implies) |
| DSR is PSR at the expected-max hurdle | identical to **1e-15**; DSR ≤ PSR; `expectedMaxSharpe` reproduces an independent inverse-CDF evaluation to **5.1e-11**, is increasing in trials and exactly ∝ √V, and is 0 for trials ≤ 1 or V ≤ 0 |
| MinTRL | **13.1749455166** vs the documented vector **13.174945** and an independent `1 + 1.125·(z₀.₉₅/0.5)²` = 13.17494554 (diff 2.7e-8); Infinity when SR ≤ benchmark; decreasing in SR |
| the stationary bootstrap is size-calibrated | 1000 i.i.d. noise series (n = 240, 300 resamples each): **5.9 %** reject at 5 %, **11.0 %** at 10 %, mean p **0.502** — the repo's 5.8 % claim (se 0.0074) reproduced; deterministic per seed and different across seeds; NaN/0-samples at n < 2 |

### B. The backtest arithmetic is exact (validated)

`positionsFromSignals` lags one bar (and `lag:0` is the identity); `turnover` counts the initial entry;
`strategyReturns`' cost sum equals `turnover × fee` and each `net = gross − |Δpos|·fee` recomputes exactly
(1e-15); `equityCurve([0.1,−0.2,0.05]) = [1, 1.1, 0.88, 0.924]`; `maxDrawdown` = 0.5 on the shipped vector,
0.19 on two −10 % bars, 0 on an all-up series; `tradeCount` counts transitions (0 / 2 / 3); `backtestMetrics`
satisfies `breakEvenCostBps = 1e4·grossPnl/turnover`, `totalCost = turnover·fee`, and recomputed
`nonZeroFraction`/`meanAbsPosition`, with DSR ≤ PSR and gross ≥ net Sharpe; `poolFolds` restates turnover /
cost / tradeCount as the per-fold sums and reproduces a directly-called `poolFolds` byte-for-byte;
`purgedCVBacktestAsync` (concurrency 4) is **byte-identical** to the serial path on all eight returned keys;
`annualizedReturn` is the equity power and monotone in the returns.

### C. `hitRate`'s exclusion is not the documented one, and it counts exit costs as misses (L10-bq)

`hitRate(strategyReturnSeries)` receives **only a return series** — a position mask is not an input the
signature can accept — so its docstring ("Bars with no position are excluded") describes a criterion the
function cannot implement. What it does implement is `if (r === 0) continue`. Two failure modes follow, both
understating the hit rate, and `backtestMetrics` feeds it the **net** series:

| witness | shipped `hitRate` | by the documented rule |
| --- | --- | --- |
| positions `[1,1,1,1]`, returns `[0.01, 0, −0.01, 0.02]`, cost 0 | **0.6667** (the zero-return in-market bar is dropped) | **0.5000** |
| positions `[1,0,1,0,1,0]`, returns `[0.01,0,…]`, **10 bps** | **0.5000** | **1.0000** |

The second witness is the damaging one: each **flat** bar reached by an exit carries `net = −fee < 0`, so it
is counted as a *miss* even though the strategy holds nothing. A strategy that is right on **every** in-market
bar therefore reads 0.5 once it trades three round trips — the reported hit rate is a function of the cost
level and the turnover, not only of the strategy. (`poolFolds.pooledMetrics.hitRate` is the same call on the
pooled net stream via an all-long overlay, so it neither excludes flat bars nor knows positions at all.) The
shipped check — `check('hitRate excludes flat bars', close(hitRate([0, 0.01, −0.02, 0, 0.03]), 2/3))` — uses a
vector whose flat bars *are* its zero-return bars, so the two criteria coincide and the check cannot
discriminate: the F-68 "a test that cannot fail" class. Report-level (a printed readout, not a gate input).

### D. The fold scorer re-lags the signal inside the test slice (L10-br)

`scoreFold` calls `strategyReturns({ returns: subReturns, signals })` with `positions = null`, so the lag is
re-derived **within the slice**: `pos[j] = subSignals[j−1]` and `pos[0] = 0`. For a per-fold-**fitted** signal
(`signalForFold`, the production path) that is defensible — the interface hands over signals for the test bars
only, so the first test bar's position is genuinely unavailable and the fold starts flat (dropping that bar's
return *and* its entry cost). For the **fixed-global-series** path (`signals:`, explicitly supported —
`walkforward.js`: "set `requireCausal` false only for a fixed signal evaluated with purged K-fold") the
module's own header rule ("positions are the signals shifted by one bar") is available and is not used:

| fit | pooled vs the global `positionsFromSignals` reference |
| --- | --- |
| contiguous purged fold `[20..29]` | bar 20 reads **0** where the global position is +1 → return error **0.001** |
| non-contiguous (CPCV) fold `[10,11,12,30,31,32]` | bar 30 holds **signals[12] = +1** instead of **signals[29] = −1** → pooled **+0.05** vs **−0.05**, a **0.10** return error on that one bar |
| a 4-fold purged K-fold of 64 bars | the pooled series differs from the global reference on **3/64** bars (the first fold starts at bar 0, where both are 0); max abs diff **0.00918** |

The run-boundary case is the real one: on a CPCV test set the position held at each run's first bar is the
previous **test** bar's signal rather than the previous **bar**'s. LATENT (production uses `signalForFold`)
but a genuine divergence between the module's stated rule and its fold arithmetic.

### E. The probe's "negative MinTRL" lead is disproved; the residual is a NaN mislabel (L10-bp)

The probe found that `minimumTrackRecordLength({sharpe:1, skew:3, kurtosis:3})` returns **−3.058** while
`probabilisticSharpeRatio`/`sharpeStandardError` return NaN for the same triple, and (correctly) flagged the
asymmetry. But that triple is **impossible**: Pearson's inequality gives `kurtosis ≥ skewness² + 1`
(= 10 here). Writing it out, `v = 1 − g₁·SR + ((g₄−1)/4)SR² ≥ 1 − g₁·SR + (g₁²/4)SR² = (1 − g₁·SR/2)² ≥ 0`,
so **`v ≥ 0` for every measurable moment triple** and `MinTRL = 1 + v·(z/SR)² ≥ 1` whenever the guard
`sharpe > benchmarkSR` passes. Measured:

* a deterministic search over **60 000** moment-realizable histograms (2–4 support points) bottoms out at
  `v = −2.4e-15` (floating-point zero) with `pearsonSlack = −4.4e-16` and `squareBound = 1.8e-30` — the minimum
  is attained exactly by **two-point** supports, where `v = (1 − g₁·SR/2)² = 0`;
* **20 000** random return series: **0** violations of `kurt ≥ skew² + 1`, of `v ≥ (1 − g₁·SR/2)²`, or of
  `v ≥ 0` (min v = 0.127);
* MinTRL computed from measured sample moments over 4 000 series never falls below **2.17**.

So the sibling guards are defensively correct-but-unnecessary, **not** a defect — the lead is closed as false.
What **is** real is the other side of the same guard: `!(sharpe > benchmarkSR)` also catches **NaN**, so
`minimumTrackRecordLength({sharpe: NaN})` returns **Infinity** — which its own docstring ("Inf when
SR <= benchmarkSR") does not license, since `NaN <= benchmarkSR` is false — and `backtestMetrics` on a **1-bar**
fold (where `sharpeRatio` returns NaN) reports `minTrackRecordLengthStatus: "beyond-horizon"` for a Sharpe that
could not be computed. `"unavailable"` is the label the status maker already has for that case. LATENT (needs a
1-bar test fold).

### F. Scope

Both modules are **shipped** measurement code: `backtest.js` (walkforward + analyze reports) and
`performance.js` (imported by eight `analysis/` modules). None of the three findings can move a golden — the
locked hot path (`src/hivemind/`, `src/legion/runner.js`) imports neither — but L10-bq and L10-br are
report-level readouts a human reads in `formatReport`/`report.json`. `no fold-back row`.

## What is now false that used to be believed

* **"`hitRate` reports the fraction of in-market bars that were positive."** It reports the fraction of
  **non-zero-return** bars that were positive; it cannot do otherwise (it never receives positions), and an
  exit-cost bar is counted as a loss. A perfect in-market record reads 0.5 at 3 round trips and 10 bps.
* **"`purgedCVBacktest` applies the (fixed) signal series inside every fold's test slice."** It re-shifts the
  slice, so the first bar of every fold is flat and a CPCV run boundary holds the previous *test* bar's signal.
* **"`minimumTrackRecordLength` can return a negative length."** It cannot, for any measurable moment triple:
  Pearson's inequality forces `v ≥ (1 − skew·SR/2)² ≥ 0`, so MinTRL ≥ 1. The probe's −3.058 came from a
  hand-picked (skew 3, kurtosis 3) triple that no distribution realizes.
* **"A NaN MinTRL reads as `beyond-horizon`."** A NaN *sharpe* produces Infinity, and the status maker reports
  it as `beyond-horizon`; the correct state for an incomputable Sharpe is `unavailable`.

## Ledger effects

* **F-70** is added: `backtest.js` + `performance.js` are **validated** against independent references
  (26/26 checks) with three registered rows — **L10-bq** (`hitRate`'s exclusion criterion; witnesses 0.667 vs
  0.5 and 0.5 vs 1.0), **L10-br** (`scoreFold`'s within-slice re-lag; the CPCV run-boundary witness) and
  **L10-bp** (the NaN-sharpe → Infinity → `beyond-horizon` mislabel; the negative-MinTRL lead closed as
  **false** by Pearson). All three are report-level / latent; no fold-back row.
* `e62_backtest_audit.js` is the register's **ninth synthetic-ground-truth experiment on a repo module**
  (after `e53`…`e61`). `run_all` is now **70 steps, 39 gated, 0 fails** (`RUN_SUMMARY` at
  **2026-09-27T07:15:14Z**).

## Next

* Remaining L10 rows: **L10-e** (the feature `closes` contract), **L10-h** (golden movement for any R1–R9
  port), **L10-ad** (the carry attribution lag), **L10-ae** (`effectiveBars` unbounded).
* Then the remaining pure modules the lab consumes but has not yet audited by synthetic ground truth:
  **`features.js`** (the causal signal family), **`holding.js`**, **`uniqueness.js`** and the
  `streams.js`/`world.js` data layer. (`performance.js` is now done.)

## Run

No repo file is touched. Full regeneration: `run_all` → **70 steps, 39 gated, 0 fails**, `RUN_SUMMARY` at
**2026-09-27T07:15:14Z** (`e62` 4.13 s; `e0d` remains the slowest step at ~479 s, total ~17.6 min).
