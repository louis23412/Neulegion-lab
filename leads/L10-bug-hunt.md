# L10 — Bug hunt / claim audit

**Status:** ONGOING (a standing audit; never "closes")
**Opened:** CYCLE-000
**Last updated:** CYCLE-066
**Owner experiments:** `e0c_validate_pipeline.js` (pipeline equivalence), `e5_controls.js` (oracle /
random — every bug claim is a claim and needs controls), `e14_data_integrity.js` (the standing join
regressions, now 14 checks), `e53_carry_grid_audit.js` (the shipped `carryOnBarGrid` join),
`e54_dependence_audit.js` (the dependence/DSR backbone), `e55_split_audit.js` (the purge/embargo contract),
`e56_labels_audit.js` (the labelling / event-sampling / fractional-diff module),
`e57_overfitting_audit.js` (the PBO / CSCV module), `e58_reality_check_audit.js` (the resampling hub:
stationary bootstrap / Newey-West / RC-SPA / subsampling), `e59_forecast_audit.js` (the shipped forecast
scoring layer: Brier / Murphy / Diebold-Mariano / Model Confidence Set),
`e60_race_audit.js` (the successive-halving / Hyperband racing engine),
`e61_benchmark_audit.js` (the shipped P1 model-class benchmark),
`e62_backtest_audit.js` (the measurement layer: `backtest.js` + its instrument `performance.js`),
`e63_features_audit.js` (the causal signal family: `features.js`, all 16 candidates),
`e64_uniqueness_audit.js` (sample uniqueness + the sequential bootstrap: `uniqueness.js`),
`e65_streams_audit.js` (the stream design layer: `streams.js` — resampler, Kish design effect, selector),
`e66_world_audit.js` (the audited evaluation world: `world.js` — shock, candle view, panel attachment),
`e67_parallel_audit.js` (the order-preserving scheduler: `parallel.js` — queue contract, failure semantics, reply adaptation),
`e68_holding_audit.js` (the turnover policy grid: `holding.js` — grid construction, restatement surfacing, promotion readout),
`e69_replication_audit.js` (the seed-replication layer: `replication.js` — IQM, stratified bootstrap, variance split, CRN criterion),
`e70_dependence_audit.js` (the cluster-inference module: `dependence.js` — correlations, jackknife, Student-t tails, sign test),
`e71_decision_audit.js` (the decision-grade report: `decision.js` — concentration, persistence, power, cadence promotion, the six-block report),
`e72_hivemind_kernels_audit.js` (the hivemind numeric kernels: `hivemind/kernels/*` — activations, linalg, normalization, sampling, statistics),
`e73_port_verify.js` (the **port verification**: the repo's V2 `core/primitives/*` + `plugins/sleeves/*` reproduced against the lab's stored books, F-81/L10-ct)
**Prototypes:** —
**Result artefacts:** `results/e0c_validate_pipeline.json`, `results/e5_controls_1h.json`,
`results/e5_controls_15m.json`, `results/e14_data_integrity.json`, `results/e53_carry_grid_audit.json`,
`results/e54_dependence_audit.json`, `results/e55_split_audit.json`, `results/e56_labels_audit.json`,
`results/e57_overfitting_audit.json`, `results/e58_reality_check_audit.json`,
`results/e59_forecast_audit.json`,
`results/e60_race_audit.json`,
`results/e61_benchmark_audit.json`,
`results/e62_backtest_audit.json`,
`results/e63_features_audit.json`,
`results/e64_uniqueness_audit.json`,
`results/e65_streams_audit.json`,
`results/e66_world_audit.json`,
`results/e67_parallel_audit.json`,
results/e68_holding_audit.json`,
results/e69_replication_audit.json`,
results/e70_dependence_audit.json`,
results/e71_decision_audit.json`,
results/e72_hivemind_kernels_audit.json`,
results/e73_port_verify.json`
**Fold-back rows:** any confirmed defect that touches shipped behaviour gets one
**Falsifier:** n/a (an audit). Each *suspicion* carries its own falsifier in the table below.

## Claim

The lab treats the repo's **claims** and its **code** as separate things to audit. A claim in a doc,
a help string, or a test can be wrong even when the code runs. This lead is the register of every
suspicion, its status, and the measurement that settles it.

## Why we care

It has already paid for itself: the F-11 look-ahead bug (using a candle's close as "the price at its
own open time") produced a Sharpe of −17 in a first E7 draft; it was caught *because the number
exceeded the oracle control's magnitude*. Implausible numbers are treated as bug signals, and every
negative result is only believed when the same-session controls are green.

## Evidence

**Confirmed:** F-11 / R-0 (below).

### Audit register

| id | suspicion / claim | where | status | how it is settled |
| --- | --- | --- | --- | --- |
| L10-a | a candle's `close` used as the price *at* the bar's label time is a one-bar look-ahead | any caller of `analysis/*` | **CONFIRMED** (F-11) | the −17 Sharpe; fixed by `loadCloseLookup` (RUNNER rule) |
| L10-b | `--bars=<n>` means "most recent n", not "every n-th" | `analyze.js` line 3228 | **CONFIRMED** (F-01) | the window ladder in `e0b` |
| L10-c | pool/fold aggregation may behave differently from a contiguous slice | `analysis/walkforward.js` | **RESOLVED — no defect** (F-13) | `e0d` runs `walkForwardSplit(60/15)` → `walkForwardEvaluate` → `poolReports`: +1.106 @600 (reported +1.0848), +0.109 @full |
| L10-d | `carryOnBarGrid` / `carryPanelStream` alignment (funding grid → bar grid) | `analysis/carry.js` | **CONFIRMED — shipped-path defect** (F-61, CYCLE-044) | injected a known funding pattern with a known correct answer (`e53`): one 8h period at 8h/4h/2h/1h interval returns **one rate at every interval** (1×/2×/4×/8× understatement); the shipped SOL sub-8h window (FTX) is understated **3.03×** and the audit does **not** flag it. The module's comment ("divides by the period actually observed") is false of the code |
| L10-e | `momentumAgreement` / `rangeLocation` contract on a prepared series (does it read `closes`?) | `analysis/features.js` | **SETTLED — confirmed abstain on the singular field** (CYCLE-055, F-71) | the plural field is load-bearing. `e63`: a `{close}` (singular) series gives `rangeLocation` **NaN** and `positionAt` **0** while `{closes}` gives **0.0211625225** — a genuine abstain, exactly the contract the row suspected (not a defect). The `prepare()` aliases exist because of this; the A/B path is the plural |
| L10-f | `dependenceSummary.effectiveBars` can it ever exceed `n`? | `analysis/walkforward.js` | **CONFIRMED — UNBOUNDED** (CYCLE-045, F-62) | `e54`: a ρ = −0.5 diversifying pair reads mean DE **0.506** with `effectiveBars > rawBars` in **25/25** (max 8210 vs 2400), and a **perfectly hedged** pair gives DE **4.7e−32** → `effectiveBars = n/DE ≈ 3.4e34`. DE is a **squared** ratio, so the code's `designEffect > 0` guard passes at 1e−32 and `adjustmentNeeded` reads **false**. The comment's mild \"can EXCEED the bar count\" understates it by 30 orders of magnitude |
| L10-g | `candles_audit.js` manifest / fetcher normaliser vs the stored kline fields | `src/candle_fetcher.js`, `src/candles_audit.js` | **CONFIRMED (scope)** | sampled stored klines carry only `timestamp,open,high,low,close,volume` — Binance's `takerBuyBaseVolume` is discarded (this is L07's opportunity) |
| L10-h | golden freeze (`golden.test.js` 23/0) still pins the shipped path | `test/` | **OPEN** | any lab finding that implies shipped-path math must show the golden would move |
| L10-i | `dsrAdjusted` semantics when `designEffect < 1` (`effectiveBars` → null) | `analysis/backtest.js` | **RESOLVED — INTENDED (lossy)** (CYCLE-045, F-62) | `e54`: `backtestMetrics` requires `2 ≤ effectiveBars < n`, so the exploded 3.4e34 is **declined** — `nEff` and `dsrAdjusted` come back `null` and the raw Sharpe is used. Declining to inflate on a diversifying panel is the documented, intended behaviour (not a defect); the residual is that a hedged panel and a degenerate panel produce the **same `null`** readout, so a consumer cannot tell them apart without reading `designEffect` |
| L10-j | `lib/lab.js#tail` did not slice the derived arrays (`returns`/`closes`/`volumes`) | lab (`lib/lab.js`) | **CONFIRMED — FIXED** (CYCLE-002) | `tail` on a prepared panel left full-length `returns` beside a sliced `close`; now slices the derived arrays too |
| L10-k | `e7`'s position was the *mirror* of its stated hypothesis | lab (`e7_basis_reversion.js`) | **CONFIRMED — FIXED** (CYCLE-002) | its IC was positive but it reported the negative-Sharpe orientation; sign made explicit, both stored (`basisOnly`/`followOnly`) |
| L10-l | the lab's mark-price file stored prices as `round(price*100)` integers | lab (`data/mark_8h.json`) | **CONFIRMED — FIXED** (CYCLE-006) | DOGE had 67 distinct values over 3 621 bars → ~1 %/period fake basis noise; flat carry Sharpe 4.77 → 2.14. Floats now; `e14#mark_precision` |
| L10-m | `loadCloseLookup` carry-forwards the last close forever; the funding files run 5 days past the candles | lab (`lib/lab.js`) | **CONFIRMED — FIXED** (CYCLE-006) | spot froze while the mark moved → ±5 %/8h fake "basis" (pooled kurtosis 1056); `lookup.lastClose` + guard; `e14#no_frozen_spot` |
| L10-n | alt 1h candle files have missing bars (0.04–0.16 % of hours); a lenient lookup bridges them | repo data + lab | **CONFIRMED — FIXED** (CYCLE-006) | an 8h return computed over 9h/10h and mispaired with the 8h mark leg; `lookup.exact(t)`; `e14#candle_grid` |
| L10-o | SOLUSDT used 2h/4h funding 2022-11-09→18 (the FTX crash); grid-collapsing kept 1 of 4 payments | repo data + lab (`e3_carry.js`) | **CONFIRMED — FIXED** (CYCLE-006) | crash-window funding understated ~4×; `loadFundingBuckets` SUMs into 8h buckets; `e14#funding_buckets` |
| L10-p | `serialDesignEffect` is outlier-fragile (it jackknifes the **Sharpe**, a ratio) | lab (`lib/lab.js`) | **CONFIRMED — MITIGATED** (CYCLE-006) | one FTX bar gives flat-book DE 99.5 raw / 11.8 winsorised / 11.0 ex-FTX; `robustDesignEffect` added, both reported (F-20) |
| L10-q | a signal on the **book grid** scored against `legs.spotRet[i+1]` is contemporaneous, not "next" | lab (`e21_open_interest.js`) | **CONFIRMED — FIXED** (CYCLE-013) | `bookTimes[m]=legs.times[m+1]`, so book `i` ends at `times[i]`; the next return is `[i+2]`. Using `[i+1]` read IC 0.595 / Sharpe 17 (OI notional embeds its own window's price move). `NEXT=2` + a lag profile now; F-28 |
| L10-r | a cross-sectional book treated a **missing** signal as `0`, then demeaned — giving the absent symbols a large weight | lab (`e21_open_interest.js`) | **CONFIRMED — FIXED** (CYCLE-013) | the OI/toptrader fields start 2021-12 for 7 of 8 symbols; before that `0 − mean` gave those symbols a real position. Books now **mask** absent symbols (excluded from the demean, weight 0) and start at the first all-present period. Found while challenging F-28; the fix revealed F-29 |
| L10-s | "**the edge lives in SIGNS rather than magnitudes**" (the stated justification for the P3 reversal family) | `analysis/features.js` (reversal-family comment) | **CONTRADICTED — no shipped behaviour affected** (CYCLE-016, F-33) | measured directly (`e24_reversal.js`): the per-symbol IC of `−r[t]` on the next return is **0.0133 (1h) / 0.0138 (15m)** vs **0.0062 / 0.0094** for `−sign(r[t])` — magnitude carries ~2× the information of sign. The pure-sign *arm* still scores a higher Sharpe (0.096 vs 0.057 at 1h) because the z-score of a magnitude series is fat-tailed, so the two readings are not in conflict — but the repo's stated *reason* is wrong. Documentation claim only; no fold-back |
| L10-t | **lead bookkeeping:** L13's status line read "Owner experiments: — (to build)" and `leads/INDEX.md` read "not yet measured", although `e2_arm_sweep.js` scored `reversal-1` at both 1h and 15m since CYCLE-001 (`run_all` regenerates both) | lab (`leads/L13-*`, `leads/INDEX.md`) | **CONFIRMED — FIXED** (CYCLE-016) | `e24#rev-1` reproduces the stored `e2` number to 4 decimals, so the arm was always there. **Lesson: a lead's status is a claim too — read the artefacts, not the board.** Settled going forward by `e24_reversal.js`, which surfaces the arm explicitly and registers in `run_all` |
| L10-u | `e25#simBook` used `close.length` (number of SYMBOLS, 8) where it needed the bar count (`returns[0].length`), so the book loop ran 5 periods and the "taker" validation read a fabricated Sharpe of −2.5 | lab (`e25_maker_fill.js`, first draft) | **CONFIRMED — FIXED** (CYCLE-017) | caught by the `validation` guard, which requires the `taker` model to reproduce E24's `rank_w1_rev` (0.4143 / 0.709 bps); after the fix it reproduces at both timeframes. **The guard is now a permanent part of `e25`** — a new execution model must first reproduce a known book |
| L10-v | `e26#causalOos` used `rows[i].t` (the BAR INDEX) as a timestamp when computing the horizon cutoff (`rows[start].t - H*barMs`), so the cutoff was ~1.6×10¹⁰ ms before the data and **no block ever had enough training rows** — every prediction was `NaN` and the experiment returned `oos.predicted = 0` | lab (`e26_meta_label.js`, first draft) | **CONFIRMED — FIXED** (CYCLE-018) | caught because the summary read `brierSkill: null` (a `NaN` through `+x.toFixed(4)`): the metric refused to produce a number instead of reporting a plausible zero. Fixed by carrying `time: times[t]` separately from the bar index and purging on `time`. **Lesson: a missing metric is a symptom — a benchmark that returns `NaN` must be treated as a broken pipeline, not a null result** |
| L10-w | the OI capacity bound was computed as **`f·mean(OI)/mean\|w\|`** — a *ratio of means* (average-case) — instead of the worst case the desk faces, `f·min_t(OI/\|w\|)` (a *min of ratios*) | lab (`e21` Part B, `e30`, `e32`) | **CONFIRMED — RESTATED** (CYCLE-024, F-41) | the two differ by **2.6–8.8×** for the working sleeves (dispersion spec $23.41 M vs $4.37 M; fade $36.99 M vs $4.19 M); at the published sizes the books breach the 5 %-of-OI cap in **65–77 %** of periods (peak 16–44 % of LINK's OI). `e33_oi_capacity_distribution.js` now reports `ratioOfMeans`, `meanOfRatios` and `minOfRatios` side by side, with guards on the published convention. **Lesson: a "capacity" is a joint constraint over (time × symbol); quoting `mean(A)/mean(B)` for `min(A/B)` is the same class of error as L10-q — average the object you actually need, not its parts** |
| L10-y | the lab's **sleeve-mix convention** (F-31/F-43, `e23`/`e27`/`e35`) mixes each sleeve's return series by **capital fraction** without risk-normalising — but the basis+funding carry book earns ~**0.4 %/yr** vol per unit gross while the spot-based books (fade **13.6 %**, OI **24.3 %**) are **31–55×** that, so any capital weight on a spot sleeve swamps the carry risk | lab (`e23`/`e27`/`e35`, `e39` instrumentation) | **CONFIRMED — RE-BASED** (CYCLE-030, F-47) | risk-normalised, the max-Sharpe weight on the fade is **0.13** (carry+fade 6.55 vs carry 6.48) and on the OI **0.10** (6.52); a 3-stream unit-vol mix reads **6.58** — i.e. the tangency gain from *both* spot sleeves is ~+0.10 Sharpe, not the ~−5 the capital convention implies. F-43's *direction* ("mixing adds ~nothing") stands; its *magnitude* ("the fade dilutes carry 6.49→1.62") is a volatility-basis artefact. **Lesson: when mixing books whose per-gross P&L scales differ by 30–50×, a capital-fraction mix measures the vol ratio, not diversification — risk-normalise (or state the convention)** |
| L10-z | `e40`'s first **validation guard** compared `e40`'s pinned-book Sharpe (`toFixed(3)`) against `e30`'s stored Sharpe (`toFixed(2)`) using a **relative** 5e-4 tolerance, so it could never pass (6.184 vs 6.18 is a 6.5e-4 relative gap but only a 0.004 absolute one) and `e40`'s `validationPass` read `false` on a *correct* book | lab (`e40_retune_blend.js`, first draft) | **CONFIRMED — FIXED** (CYCLE-031) | corrected to an **absolute** 0.01 test (half-ULP of a 2-dp artefact); the guard now passes at 0.004 / 0.003 / 0.000. **Lesson: a guard against an artefact stored `toFixed(2)` must use an absolute tolerance — `e35`/`e39` escaped this only because their guards compare means on a 5 % scale, not Sharpes** |
| L10-aa | `carryOnBarGrid` spreads **every** funding row over the *default* 8h bar count, regardless of the interval the row covers — so sub-8h funding is understated by `8h/interval` | repo (`analysis/carry.js#carryOnBarGrid`, lines 145–167; the comment at lines 22–26 claims the opposite) | **CONFIRMED — shipped-path defect** (CYCLE-044, F-61) | `e53`: a synthetic 8h period at 8h/4h/2h/1h returns **1 rate at every interval** (1×/2×/4×/8×). On shipped data the only sub-8h symbol is SOLUSDT (3 × 4h + **98 × 2h** steps, FTX); the FTX window receipts **−0.107** shipped vs **−0.324** bucket-summed (**3.03×**), and the pooled 8h sleeve reads ann **9.985 %→9.531 %**, Sharpe **11.96→9.60** — the defect **flatters** the sleeve, so the F-11 "implausibly large" alarm cannot catch it (the F-18 direction trap). **Fix:** bucket rows into `gridMs` sums (the L10-o/`e14` convention) before projecting, or divide each row by `round(observedInterval/barStep)`. Fold-back: R4 |
| L10-ab | `carryOnBarGrid` infers `barsPerPeriod` from a **single** bar pair (`bars[1] − bars[0]`), so a window whose first two bars straddle a missing candle mis-scales the **whole** symbol's carry | repo (`analysis/carry.js#carryOnBarGrid`, lines 149–153) | **CONFIRMED — LATENT** (CYCLE-044, F-61) | `e53`: a synthetic first pair 2h apart (one gap) reads **2×** the clean receipt; every shipped candle file's first pair is currently modal (`firstPairLatent` true), so nothing is mis-scaled today. **Fix:** a median step, or the observed funding interval per row |
| L10-ac | a funding **interval change** (sub-8h / sub-grid) is invisible to `auditFundingProblems`: the off-grid budget is 2 % and `missingPeriods` counts only steps *longer* than a period | repo (`analysis/carry.js#auditFundingProblems`) | **CONFIRMED — LATENT (audit blind spot)** (CYCLE-044, F-61) | SOLUSDT's file has 3 × 4h + 98 × 2h steps but `auditFundingProblems` returns **[]**: 98/6680 = **1.47 %** < the 2 % budget, and every sub-grid step is *shorter* than the grid so `missingPeriods` is 0. The interval histogram *detects* it; the problem classifier does not. **Fix:** count sub-grid steps as a problem (e.g. `subGridSteps`), not as off-grid noise |

| L10-ae | `effectiveBars = n / designEffect` is treated as if bounded, but the `designEffect > 0` guard is not a bound (DE is a **squared** ratio) | repo (`analysis/walkforward.js#dependenceSummary`, `analysis/backtest.js#backtestMetrics`) | **CONFIRMED — LATENT (unbounded)** (CYCLE-045, F-62) | `e54`: a perfectly hedged pair (one stream the exact negative of the other) gives DE **4.7e−32** and `effectiveBars` **3.4e34** while `adjustmentNeeded` reads **false**; `backtestMetrics`' `2 ≤ effectiveBars < n` clamp then declines it (`nEff`/`dsrAdjusted` null). The compiler does not crash, but the `< 1` regime is only *mildly* handled — the `→ 0` limit is not. **Fix (if the repo wants one):** floor the design effect (e.g. `max(DE, 1/K̃)` on the stream count) or clamp `effectiveBars ≤ n` before use, so a degenerate panel is not silently waved through |

| L10-af | `walkForwardSplit` purges/embargoes like its siblings (the module header says the family does) | repo (`analysis/splits.js#walkForwardSplit`) | **CONFIRMED — unpurged; LATENT on the shipped path** (CYCLE-046, F-63; scoped by CYCLE-047/L10-ah) | `e55`: `walkForwardSplit` has **no** `labels`/`labelSpan`/`embargo` parameters (passing them returns byte-identical folds) and its folds carry no purge metadata, so for label span H > 1 the fold boundary leaks exactly **`H(H−1)/2`** train/test label-overlap edges per fold (H=5 → 10/fold, 120 at testSize 40; **0** at H=1). `isCausalFold` (index order only) passes every leaky fold; `assertNoLeakage` flags it but is never called on the walk-forward. An index-lookup model recovers test-period returns: leak-zone per-bar edge **+0.0035** (se 7e−5) vs **0.0000** clean / **+0.0001** purged. **Fix:** accept `labels`/`labelSpan`/`embargo` and drop training labels overlapping the test window (the purged K-fold's own rule). Fold-back: **R9 (latent)** |
| L10-ag | the split test ledger proves the **family** leak-free | repo (`test/lock-registry.js`, `test/browser/entries/analysis.test.js`) | **CONFIRMED — claim overstated** (CYCLE-046, F-63) | the lock-registry note says "train/test disjoint, **zero label-window leakage**, train starts after embargo" for the module, but the tests call `assertNoLeakage` **only** on `purgedKFoldSplit` (line 203) and `combinatorialPurgedSplit` (line 230) and `isCausalFold` on the walk-forward (line 481) — the walk-forward's leakage is never asserted, and is non-zero. **The L10-t lesson: a test-ledger claim is itself a claim — read the assertions, not the note** |
| L10-ah | does F-63's walk-forward leak reach the shipped controller? (the L10-ag follow-up) | repo (`analyze.js#makeControllerModelFactory`, `hivemind/controller/trades.js`) | **RESOLVED — NOT LIVE (latent)** (CYCLE-047) | the controller's labels *do* overlap (`heldBars {mean 8.30, max 54}`), but the fold is fitted by replaying bars `1 … testStart`, each call seeing a window ending at `i−1` (`analyze.js:1018`) — the last training bar is **`testStart−1`**, and the fold's declared `train` list is ignored; `trades.js` labels a trade by its outcome at the **exit** bar with only *closed* trades entering training, so every training label is realised at an exit `≤ testStart−1` (causally before the test). The leak needs a training label realised *inside* the test window → cannot occur. F-63 scoped **latent**; R9 downgraded |

| L10-ai | `cusumFilter` accepts an `events` filter | repo (`analysis/labels.js#cusumFilter`) | **CONFIRMED — dead argument; LATENT (test-only export)** (CYCLE-048, F-64) | `e56`: `cusumFilter({prices, threshold, events:[0,5,999]})` returns output **byte-identical** to the two-argument call — `events` is in the signature and absent from the body (the L10-af "advertised option that does nothing" class) |
| L10-aj | `cusumFilter`'s `lastEmit` guard prevents a repeat emission | repo (`analysis/labels.js#cusumFilter`) | **CONFIRMED — dead code** (CYCLE-048, F-64) | `lastEmit` is only ever assigned the strictly increasing loop index `t`, so `t !== lastEmit` is **always true**. Proven constructively: an **independent** drawup/drawdown reference with **no** such guard matches the repo function exactly on all **160** grid rows and **12** monotone cases |
| L10-ak | the `pt`-before-`sl` tie-break biases labels | repo (`analysis/labels.js#tripleBarrierLabels`) | **CONFIRMED — unreachable for `vol > 0`, degenerate at `vol ≤ 0`** (CYCLE-048, F-64) | a bar satisfies both `p >= ptLevel` and `p <= slLevel` iff `(ptMult+slMult)·vol ≤ 0`; `e56` measures **0 of 6** bars at `vol ∈ {2.7,1.4,0.3}`, **3 of 6** at `vol = 0`, **6 of 6** at `vol ∈ {−0.5,−2}` — so the ordering is a **no-op on the whole sane domain**. At `vol = 0` the barrier collapses to a **one-bar sign label** (`sign(prices[e+1] − prices[e])`, touch always `e+1`, horizon ignored; a flat series labels **11/12** events **+1 at `ret = 0`**), and `vol < 0` inverts the barriers (almost everything +1). The handoff's candidate ("a bar spanning both is always +1") is therefore **not a live defect** |
| L10-al | the default `events` set produces only well-posed bets | repo (`analysis/labels.js#tripleBarrierLabels`) | **CONFIRMED — a zero-horizon bet** (CYCLE-048, F-64) | `events = null` expands to every index **including `n−1`**, for which `t1 = min(n−1, n−1+H) = n−1 = event` → an empty loop and a `{label: 0, ret: 0}` row **indistinguishable from a vertical-barrier timeout** (`e56`, n=30/H=10: exactly **1** such row; exactly **`H`** events get a truncated vertical barrier). The repo test asserts only `t1 >= event` and builds uniqueness spans as `[event, t1]`, so a point span can pass unnoticed. LATENT (test-only export) |
| L10-am | the `fractionalDiffWeights` docstring: "`size <= 0` uses DEFAULT_FD_WINDOW" | repo (`analysis/labels.js#fractionalDiffWeights`) | **CONFIRMED — documentation false** (CYCLE-048, F-64) | the code stops at the first `|w| < 1e−12` (capped at 100): `e56` measures auto widths **1/2/3/4** for `d = 0/1/2/3` and 100 for `d ∈ {0.1, 0.4, 0.5, −0.5}`. The repo's own test samples only `d = 0.4` — the one case that cannot catch it (the L10-ag lesson) |
| L10-an | `fractionalDiffWeights(0, 0)` returns width 2 → `d = 0` is NaN at position 0 | repo (`analysis/labels.js#fractionalDiffWeights`) | **RESOLVED — no defect; candidate was wrong** (CYCLE-048, F-64) | `e56`: `d = 0` auto returns **`[1]`** (the first recurrence step is `0`, so the `|w| < 1e−12` break fires immediately) and `fractionalDiff(series, 0, 0)` is the **exact identity with no NaN**. The width-2 / NaN-at-0 behaviour belongs to **`d = 1`**, where it is correct (a first difference has no value at position 0) |
| L10-ao | which `labels.js` exports are on the shipped path? | repo (`analysis/features.js`; `test/`) | **CONFIRMED — scope: 1 of 6** (CYCLE-048, F-64) | a trace of import sites: the A/B reaches `labels.js` **only** through `analysis/features.js:34` (`fracDiffAt`/`fracMomentum`, the `sig-frac-momentum` candidate); `tripleBarrierLabels`, `cusumFilter`, `fractionalDiff`, `fracDiffLogPrices`, `DEFAULT_FD_WINDOW` are consumed by `test/browser/entries/analysis.test.js` and `test/lock-registry.js` **only** (the shipped controller labels trades in `hivemind/controller/trades.js`). So every wart above is **latent** |
| L10-ap | the shipped FD consumer uses the module's own window | repo (`analysis/features.js:387`) | **CONFIRMED — calibration, not a defect** (CYCLE-048, F-64) | `sig-frac-momentum` carries `window: 16` at `d = 0.4` while the module's own auto window (and its pinned test constant) is **100**: `e56` measures `w_15 = −6.178e−3`, `w_16 = −5.638e−3`, and the coefficients beyond `k = 15` carry **6.27 %** of the first-100 window's `|w|` mass (0.1188 of 1.8933), with the 100-cap omitting a further **0.0845**. A deliberate window/warm-up trade-off (16 weights usable from `t = 15`, 100 only from `t = 99`) on an arm the README already lists as DROPPED |

| L10-aq | `relativeRank` handles a missing (non-finite) candidate consistently | repo (`analysis/overfitting.js#relativeRank`) | **CONFIRMED — the rank skips NaN, the denominator does not** (CYCLE-049, F-65) | `e57`: `relativeRank` counts only finite peers in the rank but divides by the **full** `n + 1` — `relativeRank([1,2,3,NaN], 2) = 3/5 = **0.60**` where excluding the missing candidate gives `3/4 = 0.75`. `omega` is therefore depressed by any missing candidate, which biases `lambda` down and PBO **up**. Reachable via the documented `metric` option (the default Sharpe returns **0**, not NaN, for zero dispersion). LATENT (test-only module, L10-av) |
| L10-ar | the `lambda <= 0` convention is neutral about ties | repo (`analysis/overfitting.js#probabilityOfBacktestOverfitting`) | **CONFIRMED — a fully-tied roster is forced to PBO = 1** (CYCLE-049, F-65) | `e57`: an all-flat roster → **PBO exactly 1** and 20 identical columns → **exactly 1** (every `omega = 1/2` → `lambda = 0 <= 0`), i.e. the least informative roster reads "certainly overfit". **The pre-registered mechanism guess was falsified**: *partial* duplication does **not** bias PBO (paired means **0.5806 → 0.5671 → 0.5401** for 0/5/19 duplicate columns, sign 6/10) — a tie is created only for the winner, whose rank averages toward the middle in either direction. Documented as "the documented tie convention" in the lock-registry |
| L10-as | `degradation`'s returned `n` is a sample size | repo (`analysis/overfitting.js#oosOnIsRegression`) | **CONFIRMED — pooled dependent pairs** (CYCLE-049, F-65) | the regression pools every `(split, strategy)` pair and returns `n = N·C(S,S/2) = **2016**`, but the pairs are deterministic functions of only `N·S = **80**` block performances. `e57`: a naive `t = sqrt(r²(n−2)/(1−r²))` from the returned `{slope, r2, n}` exceeds 1.96 on **91.2 %** of genuinely skill-less i.i.d. matrices (nominal 5 %). The arithmetic is exact (`oosOnIsRegression` verified against an independent sum-formula OLS); the *inference* a consumer draws from `n` is not |
| L10-at | a 252-split PBO is a measurement to the precision it is quoted | repo (`docs/LOCKED.md`, `test/lock-registry.js`) | **CONFIRMED — calibration is one draw** (CYCLE-049, F-65) | `e57` reproduces the quoted calibration **exactly** (117/252 = **0.46429**, degradation slope −0.0936, with the repo's own RNG at seed 20240), but the ensemble of the same procedure (60 matrices, N=8, T=400, S=10) centres at **0.4769** (se 0.0329) with **sd 0.2546** and p05–p95 **0.099–0.885**, against a binomial split SE of **0.0315** → split **design effect 65.4**, **≈ 3.9 effective splits**. A PBO quoted to 2–3 decimals overstates resolution ~8× (the F-62 lesson, one level up) |
| L10-av | the split splitters enforce a minimum block size | repo (`analysis/overfitting.js#cscvBlocks`) | **CONFIRMED — scope/contract** (CYCLE-049, F-65) | `cscvBlocks(n, blocks)` alone accepts `blocks <= n`, so `cscvBlocks(6, 6)` yields **six 1-observation blocks**; only the `probabilityOfBacktestOverfitting` entry enforces `blocks <= floor(T/2)`, and its message says "at least 2 observations per **half**" where the condition is ≥ 2 per **block**. **Also the scope fact:** no shipped module imports `overfitting.js` — a grep of `src/` finds only `analysis.test.js` + `test/lock-registry.js` (the `decision.js`/`reality_check.js`/`walkforward.js` matches are comments) → every row above is **latent** |
| L10-aw | `politisWhiteBlockLength` reproduces the reference `arch.optimal_block_length` to floating-point precision | repo (`analysis/reality_check.js#politisWhiteBlockLength`) | **CONFIRMED — false for `g <= 0`** (CYCLE-050, F-66) | `e58` ports `arch.bootstrap.base._single_optimal_block` verbatim (from its source) and matches the repo to 1e−9 on 30 series **where the guard does not fire**; but the repo's `length` helper returns **exactly 0** unless `sigma2 > 0 && g > 0`, while the reference **squares `g`**. Over 200 AR(−0.5) T=400 draws the repo returns 0 in **198** and arch a positive length (seed 0 → **22.0** at `g = −0.858`; seed 1 → **5.99**; seed 2 → **10.86**). Consequence: `autoBlockLength` floors to **1 (i.i.d.)** on 99/100 of those series, so the automatic block bootstrap silently degrades to i.i.d. resampling on anti-persistent data. The guard also fires on **58 %** of i.i.d. T=120 columns. LATENT (test-only, L10-az), though the guard may be a deliberate improvement over the reference — the *claim* is what fails |
| L10-ax | `autoBlockLength`'s `median` reduction is the median | repo (`analysis/reality_check.js#autoBlockLength`) | **CONFIRMED — it is the UPPER median on an even arm count** (CYCLE-050, F-66) | `e58`: the branch takes `[...perSeries].sort(...)[floor(K/2)]`, so for even `K` it is the upper order statistic, not the average of the two middle ones. On one 4-arm matrix per-arm `[3.671, 4.848, 3.369, 6.357]`, the upper median **4.84761** is returned where the standard median is **4.25907**. The repo test uses odd `K = 5`, the one case that cannot see it. Minor, latent |
| L10-ay | `neweyWestSE`'s non-positive-variance clamp guards a negative long-run-variance estimate | repo (`analysis/reality_check.js#neweyWestSE`) | **CONFIRMED — the `v < 0` arm is unreachable** (CYCLE-050, F-66) | the code clamps a non-positive Bartlett-tapered long-run variance to 0 ("a constant window (or rounding noise) has zero variance"). But the tapered sum is a **PSD quadratic form** (the Bartlett kernel): an exhaustive ±1 search up to length 18 × every bandwidth plus 3000 random windows finds minimum taper **exactly 0** and never a negative value. Only the constant-window (`v = 0`) arm is live; rounding cannot make it negative. A dead/defensive branch (cf. L10-aj) |
| L10-az | the block-bootstrap RC/SPA family is on the shipped path | repo (`analysis/reality_check.js`) | **CONFIRMED — scope: it is test-only** (CYCLE-050, F-66) | `e58`: no shipped module imports `whiteRealityCheck` / `hansenSpa` / `hansenSpaConsistent` / `romanoWolfStepM` / `consistentRecentring` / `politisWhiteBlockLength` / `autoBlockLength` / `bootstrapRelativeMeans`. The shipped consumers are **`stationaryBlockIndices`** (via `forecast.js`'s Diebold-Mariano test + Model Confidence Set) and **`neweyWestSE` + the four subsampling procedures** (via `walkforward.js`'s familywise search) — and *those* are exact (all `e58` identities hold, 39/39). So L10-aw/ax/ay are latent |
| L10-ba | the raw-minus-binned Brier gap is "the within-bin **forecast** variance that merging into a bin discards" | repo (`analysis/forecast.js#brierDecomposition`) | **CONFIRMED — false** (CYCLE-051, F-67) | the exact identity (which the repo's own `observer/legion_metrics.js` states and computes) is `gap = WITHIN = Σ_k w_k[mean_k(p−p̄_k)² − 2·mean_k((p−p̄_k)(o−ō_k))] = withinVar − 2·withinCov`; `e59` matches it to 1e−12 on 6 configs and finds the gap **negative on 5/6** while `withinVar > 0` (T=64/bins=1: gap **−0.0531** vs withinVar **+0.0774**; T=300/bins=3: **−0.0108** vs +0.00981), the claimed value wrong by up to **0.13**. The module still *returns* the correct fields (`brier`, `brierBinned`, zero `identityResidual`) — the docstring's stated identity is what fails. SHIPPED docstring (the fields are right) |
| L10-bb | `forecastComparison` "refuses a mismatched window rather than comparing unpaired" | repo (`analysis/forecast.js#forecastComparison`) | **CONFIRMED — the guard is count-only** (CYCLE-051, F-67) | the check is `pairs.bars !== base.bars` (a **count**), but `forecastPairs` drops each fold's non-finite bars, so two variants that drop the **same number** of bars at **different positions** pass and are paired index-wise. `e59`: 6 crafted witnesses (a NaN confidence at a different bar per variant) → the guard accepted **6/6**, the two `outcomes` sequences differed, and the DM verdict **flipped in 6/6** vs the correctly bar-aligned comparison. SHIPPED (latent reachability: needs a per-variant non-finite confidence bar) |
| L10-bc | `bootstrapMeans`'s "one array per model, all the same length" is enforced, and the MCS refuses non-finite inputs | repo (`analysis/forecast.js#bootstrapMeans` / `#modelConfidenceSet`) | **CONFIRMED — neither is validated** (CYCLE-051, F-67) | `bootstrapMeans([[1,2,3,4],[5,6]])` leaves `available:true`, takes `T=4` from `series[0]`, and NaNs the replicates touching the short series (**3/8**); `modelConfidenceSet` **does** validate equal lengths and refuses, but a NaN **inside** a series leaves it `available:true` with an arbitrary survivor. LATENT (the shipped path builds losses only from finite `forecastPairs` output) |
| L10-bd | a `benchmark` arm joins the controller in the calibration (probability) MCS group | repo (`analysis/forecast.js#forecastComparison#groupOf`) | **CONFIRMED — the branch maps benchmark to the BASELINE's kind** (CYCLE-051, F-67) | `groupOf(kind) = kind === 'benchmark' ? (baselineKind === 'signal' ? 'signal' : 'controller') : kind`. With `baselineKind = 'signal'` the benchmark joins the **signal** (z-score) group and gets a DM test against it (`dm.available = true`) while a controller candidate is refused as cross-kind — the R27-5 mismatch. The `reader` and `docs/LOCKED.md` both claim the benchmark shares the controller group. **Unreachable from `analyze.js`** (the `id:'baseline'` controller variant is forced to index 0, so `baselineKind` is never `'signal'`) and the §AI test only uses `baselineKind='controller'` → a dead/incorrect branch in the exported API |
| L10-be | the MCS elimination statistic is Hansen-Lunde-Nason's `t_i` | repo (`analysis/forecast.js#modelConfidenceSet`) | **CONFIRMED — the denominator is `sd(L_i)`, not HLN's `sd(d_i)`; empirically inert** (CYCLE-051, F-67) | the range statistic `T_R = max|dbar_ij|/se_ij` is HLN's, but the elimination score standardises `L_i − mean_others` by `sd(L_i)` where HLN's `t_i` uses `sd(d_i)`, `d_i = L_i − mean_others`. `e59`: on 150 heteroskedastic K=4 configs the two denominators differ by up to **77×** yet the surviving set and the elimination **order** were identical in **150/150** → a paper-level deviation with no observed effect |
| L10-bf | the DM test and the MCS are correctly calibrated | repo (`analysis/forecast.js`) | **UPHELD — nominal** (CYCLE-051, F-67) | independently re-measured (the F-57/F-62 discipline): DM i.i.d. size **0.0525** at 5 % / **0.1075** at 10 % (400 reps, p median 0.497); the block bootstrap controls φ=0.5 size where `blockLength=1` does not (**0.095** vs **0.135**); the MCS **always contains the sample-best** (4 ensembles × 200 = 800/800) and its coverage is near nominal (K=3 α=0.10 **0.880** i.i.d. / **0.855** φ=0.5; K=4 α=0.10 **0.865**; α=0.05 **0.925**) — the lower edge of the 2.5-SE band. A probe's 0.82 coverage reading was Monte-Carlo noise (R=200 → band ±0.053) |
| L10-bg | the race winner equals the brute-force full-grid oracle — "a racing budget does not change the decided set" | repo (`analysis/race.js`; claimed in its docstring and `docs/LOCKED.md`; tested in `analysis.test.js` §AM) | **CONFIRMED — the fixture makes it a tautology; false on a budget-dependent evaluator** (CYCLE-052, F-68) | the §AM fixture is `evaluate(arm, budget) = arm.q + (arm.q>0?0.05:−0.05)/budget`, whose **ranking is identical at every budget** (`rank(1) == rank(9)`), so "race winner == grid winner" cannot fail — and the fixture's schedule is `[1,3]`, so its top rung (3) is **below** its own oracle's budget (9). `e60`: with a budget-dependent evaluator (the SHA premise) the race discards the top-budget best — 8 `early` arms strong at 1 / weak at 9 plus 1 `late` arm best at 9 → rung-0 `lost ∋ late`, the race returns `early0`, the top-budget oracle returns `late` — and over seeded ensembles (K=16, 120 reps) the race disagrees with the top-budget argmax on **0.617/0.617/0.700/0.625** for (η,B) = (3,27)/(3,9)/(3,3)/(2,16). Known SHA behaviour, but the module states the opposite as a *validated requirement* and the enforcing test cannot fail. LATENT (engine-only, L10-bk) |
| L10-bh | the race "spends less budget than a full grid" (`spentBudget < gridBudget`) | repo (`analysis/race.js`; the repo test's §AM identity) | **CONFIRMED — not universal** (CYCLE-052, F-68) | `spentBudget = Σ_r budget_r·scored_r` vs `gridBudget = n·round(maxBudget)`. The saving holds only when the budget ratio is large: ratio **0.222** on the fixture `(9,9,3)`, but **1.000** for `(16,2,2)`/`(100,2,2)`, **1.056** for `(9,2,2)`, **1.222** for `(9,3,2)` and **2.890** for `(100,10,1.1)`. When `maxBudget/minBudget` is small relative to the round count the early full-width rungs dominate and the race costs *more* than the grid it replaces. The repo test sits in the one regime where the saving is large. LATENT |
| L10-bi | "only the top `1/eta` survive to a budget `eta` times larger" | repo (`analysis/race.js#halvingSchedule`) | **CONFIRMED — small `eta` collapses consecutive rungs** (CYCLE-052, F-68) | the code multiplies an **unrounded** budget by `eta` but stores/evaluates `Math.round(budget)`, so for a small `eta` (or budget) consecutive rungs round to the **same** integer and re-score the survivors at the same budget. `e60`: `eta=1.1`, 100 arms, `maxBudget=10` → schedule `[1,1,1,1,1,2,2,2,2,2,3,3,3,4,4,4,5,5,6,6,7,8,8,9,10]`, **15** repeated consecutive budgets of **25** rungs, cost ratio **2.890**; `eta=1.2` → 4 repeats (1.520); `eta ≥ 1.5` → 0 (0.79/0.55). LATENT |
| L10-bj | `successiveHalving` refuses an invalid `eta`/`minBudget` like it refuses a bad `arms`/`maxBudget` | repo (`analysis/race.js#successiveHalving`) | **CONFIRMED — not validated** (CYCLE-052, F-68) | `halvingRounds` guards `eta ≤ 1` and `minBudget > maxBudget`, but `successiveHalving` does not check its own: `eta = 1`, `eta = 0.5`, `eta = 0` and `minBudget > maxBudget` all leave the schedule empty, evaluate **0 arms**, and return `available:true` with `winner:null`/`winnerId:null` — a silent degenerate success rather than `available:false`. The module *does* refuse `arms`, `evaluate` and `maxBudget`, so the omission is inconsistent with its own contract. LATENT (engine-only) |
| L10-bk | which `race.js` exports are on the shipped path? | repo (`analysis/race.js`; `analyze.js`; `test/`) | **CONFIRMED — scope: engine-only** (CYCLE-052, F-68) | no shipped module imports `race.js` — only `test/browser/entries/analysis.test.js` §AM and `test/lock-registry.js`'s export pin — and `analyze.js` deliberately exposes **no `--race` flag** (the R26-15 gate is closed; `RUN-ANALYSIS.md` §7 measured neither an economics nor a diversity win). So every row above is latent — but the *claim* that would license turning the gate on (L10-bg) is the one that fails |
| L10-bl | the ridge forecaster returns the ridge regression's probability | repo (`analysis/benchmark.js#fitRidge`/`#predictRidge`) | **CONFIRMED — the training base rate is computed, stored, and never restored** (CYCLE-053, F-69) | `fitRidge` computes `ybar = mean(y)`, centres the target on it (`yc = y - ybar`), and returns it; **`predictRidge` reads only `model.w`/`model.d`/`model.scaler`/`model.standardise`** and returns `sigmoid(z·w + c)` — the centred predictor — so the arm is anchored at `sigmoid(0) = 0.5` whatever the prior. `e61`: a constant-`y = 1` fold → **exactly 0.5** for every input (the solved intercept is 0); a **0.833**-base-rate fold → mean prediction **0.5000** and Brier **0.22475**, vs **0.13533** with the module's own `ybar` restored (an uncentred intercept fit matches 0.13533). The shipped §P1 test checks **accuracy** (a 0.5 threshold, invariant to the offset) so it cannot fail. SHIPPED (the ridge arm is the MCS survivor; RUN-ANALYSIS §16.2) |
| L10-bm | the bench-linear arm is a probability model comparable to bench-mlp | repo (`analysis/benchmark.js#predictRidge`/`#predictMLP`) | **CONFIRMED — the sigmoid of a bounded least-squares fit caps the arm's skill** (CYCLE-053, F-69) | `predictRidge` returns `sigmoid(OLS fit of a 0/1 label)`; an OLS fitted value of a bounded target lies in `[min y, max y]` (centred: `[-ybar, 1-ybar]`), so the output is confined to `sigmoid([-1,1]) ~ [0.27, 0.73]` (at `ybar = 0.5`: `[0.378, 0.622]`) — a PERFECTLY separable feature reads Brier **0.1425** (the arm's floor), not ~0. The MLP fits its output bias on the raw label through the same sigmoid, so a constant-`y = 1` fold reads **0.99**. So "no model class has material positive Brier skill" is, for the ridge, partly a bounded-map artefact. SHIPPED |
| L10-bn | the P1 test proves the ridge closed form against a hand-computed solve | repo (`docs/LOCKED.md`, `test/lock-registry.js`, `test/browser/entries/analysis.test.js`) | **CONFIRMED — no shipped test performs a hand solve** (CYCLE-053, F-69) | the five shipped §P1 checks assert (i) ridge/MLP accuracy > 0.8 on a separable rule, (ii) MLP determinism, (iii) a zero-mean standardiser round-trip, (iv) the factory kinds + the `tsfm` refusal, (v) the benchmark MCS/DM grouping — no closed-form comparison. `e61` matches the module's `w` to an **independently solved** centred ridge to **0**, so the claim is **true but untested**, and all five checks pass on a ridge with an arbitrary output map (L10-bl is such a map). The L10-ag class: a test-ledger claim is itself a claim |
| L10-bo | the standardiser's eps "constant-column fallback" is safe | repo (`analysis/benchmark.js#fitStandardiser`/`#applyStandardiser`) | **CONFIRMED — latent amplification** (CYCLE-053, F-69) | a column constant on the fit fold gets `std = sqrt(0) + eps = 1e-8`, so the fallback avoids a division by zero but not the blow-up: a test-fold value **one unit** away maps to `z = 1/1e-8 = **1e8**`. A feature constant over a 60-bar training fold is plausible, so this is LATENT but real, and untested |
| L10-bq | `hitRate` returns "the fraction of in-market bars with a positive net return; bars with no position are excluded" | repo (`analysis/backtest.js#hitRate`, consumed by `#backtestMetrics`) | **CONFIRMED — the documented criterion is unimplementable from the signature, and the implemented one counts exit-cost bars as misses** (CYCLE-054, F-70) | the signature is `hitRate(strategyReturnSeries)` — the function receives only a **return series**, so a position mask is not an available input; the code does `if (r === 0) continue`. `e62`: positions `[1,1,1,1]` with returns `[0.01, 0, −0.01, 0.02]` → **0.6667** (the zero-return in-market bar is dropped) where the documented rule gives **0.5**; and because `backtestMetrics` passes the cost-laden **net** series, positions `[1,0,1,0,1,0]` at 10 bps → **0.5000** where the documented rule gives **1.0000** (each flat bar reached by an exit has `net = −fee < 0`, a counted **miss**). So the reported hit rate moves with the cost level and the turnover, and `poolFolds` reads the same call on the pooled net stream via an all-long overlay (no positions, no flat-bar exclusion). The shipped check's vector has flat bars that *are* its zero-return bars, so it cannot discriminate (the F-68 class). SHIPPED report readout |
| L10-br | `purgedCVBacktest` "applies the (fixed) signal series inside every fold's test slice" (module header: "positions are the signals shifted by one bar") | repo (`analysis/backtest.js#scoreFold`/`#purgedCVBacktest`) | **CONFIRMED — the scorer re-lags the signal WITHIN the slice** (CYCLE-054, F-70) | `scoreFold` calls `strategyReturns({ returns: subReturns, signals })` with `positions = null`, so `positionsFromSignals` re-derives the lag per slice: `pos[j] = subSignals[j−1]`, `pos[0] = 0`. `e62`: a contiguous purged fold `[20..29]` reads **0** on bar 20 where the global position is +1 (return error 0.001); a non-contiguous **CPCV** fold `[10,11,12,30,31,32]` holds **signals[12] = +1** on bar 30 instead of **signals[29] = −1** (pooled **+0.05** vs **−0.05**, a 0.10 error on one bar); a 4-fold purged K-fold of 64 bars differs from the global reference on **3/64** bars (fold 0 starts at bar 0, where both are 0), max abs diff 0.00918. Defensible for the per-fold-**fitted** path (the interface supplies signals for the test bars only → the fold starts flat), but a real divergence for the supported **fixed-global-series** path (`walkforward.js`: "a fixed signal evaluated with purged K-fold"). LATENT (production uses `signalForFold`) |
| L10-bs | `causalZScore` abstains (returns 0) when the window has no dispersion (std is 0) | repo (`analysis/features.js#causalZScore`) | **CONFIRMED — the guard is defeated by floating-point rounding** (CYCLE-055, F-71) | for an exactly-constant window the sample mean is **not bit-equal** to the value, so every deviation is the same `d != 0`; `std = |d|*sqrt(n/(n-1))` is a **denormal positive** number so `if (!(std > 0)) return 0` cannot fire, and `z = (v - m)/std = -sign(d)*sqrt((n-1)/n)`. `e63`: exactly **-0.9682458366** (n=16), **-0.9842509843** (n=32) and **-0.9746794345** (n=20) where the module promises 0 — a **0.468..0.492** position at saturation 2 from an information-free feature (the intended value is exactly 0). Where the mean IS bit-exact (n=8 and n=32 on 0.001; the 0.03125 fixture) the guard fires and returns 0, so it is a rounding-boundary effect and the shipped 0.03125 check gives no warning. LATENT for live data but reachable on the flat/constant CONTROL series and via a coarse/rounded feed (the L10-l class: `round(price*100)` gave 67 distinct values over 3621 bars). Fix: a relative tolerance (`std <= |mean|*1e-12`) or `max - min == 0` |
| L10-bt | a feature that cannot be computed abstains (NaN), never a manufactured value | repo (`analysis/features.js#finiteSum` vs `#meanOf`) | **CONFIRMED — an empty range sums to 0, not NaN** (CYCLE-055, F-71) | `finiteSum` guards `a < 0` but **not** `b < a`, so a 0-width window returns **0**; `meanOf` guards `b < a` and returns **NaN**. `e63`: `momentum`/`acceleration` (`{window:0}`) read **0** while `volRegime`/`reversalWindow`/`volumeImbalance` and a direct `meanOf` read NaN — the two helpers disagree on the same degenerate input. LATENT (every shipped candidate fixes `window >= 1`) but 0 is a finite, plausible reading (no momentum) that flows through `causalZScore` as a real observation instead of abstaining |
| L10-bu | `networkMomentum` skips this stream and averages only the others | repo (`analysis/features.js#networkMomentum`) | **CONFIRMED — the self-skip fails when `panel.streamIndex` is absent** (CYCLE-055, F-71) | the skip is `if (i === p.streamIndex) continue`; with `streamIndex` `undefined` the comparison never matches, so the stream's own lagged momentum is folded into its network average. `e63`: with `{streamIndex: 1}` the feature is **-0.9066812992** (= others-only); without the field it is **-1.8820447956** (= all three incl. self); the stream own lagged momentum is -3.8327717886. LATENT (`analyze.js` always sets `streamIndex`) and SILENT — a plausible number, not a NaN |
| L10-bv | `regimeGatedMomentum` gates when the trailing `gateWindow`-bar return sits below -gateZ standard deviations of its own causal vol estimate | repo (`analysis/features.js#regimeGatedMomentum`) | **CONFIRMED — the gate is scaled by the MOMENTUM window variance, not the gate window | (CYCLE-055, F-71) | the threshold is `-gateZ*sqrt(v_window)*sqrt(gateWindow)` where `v_window` is the variance of the MOMENTUM window; under the i.i.d. reading the gate-window sum has variance `gateWindow*v_gateWindow`, so the threshold is mis-scaled by `sqrt(v_window/v_gateWindow)`. `e63` (shipped windows 16 vs 32): `varianceUsed` **5.080932663e-5**, `varianceOfGateWindow` **6.651902004e-5**, ratio **1.309189168**, `thresholdUsed` **-0.0806448623** vs `thresholdIfGateWindowScaled` **-0.0922736938** — a hot short-term regime makes the crash gate too LOOSE (it fires less often than documented). LATENT and opt-in (`SIGUP_CANDIDATES`, gate G-H); invisible when the two windows coincide. Behavioural: it changes how often the arm de-risks |
| L10-bx | `sequentialBootstrap` weights each observation by its "running average uniqueness / (1 + pick count)" | repo (`analysis/uniqueness.js#sequentialBootstrap`) | **CONFIRMED — the numerator is the uniqueness SUM, not the average (length bias)** (CYCLE-056, F-72) | the code stores `avgU[i] = acc`, the **sum** of `1/concurrency` over the span, while the comment says "average" and the ch.4 weight is `acc / (e - s + 1)` (which the module itself computes one function above). Since sum = average x span length, the draw is biased toward LONG labels. `e64`: two NON-overlapping labels (both average uniqueness **1.0**, i.e. maximally unique, so ch.4 weights them 50/50) with spans `[0,0]` and `[1,3]` have sums 1 and 3 → measured first-draw P(3-bar) = **0.7480** (the module law 0.75) vs the intended **0.5000**; a disjoint 1/2/3-length fixture reads **0.1688 / 0.3299 / 0.5014** vs 1/3 each. The bias is unbounded in the length ratio. LATENT/test-only: `sequentialBootstrap` has no shipped importer, and the shipped check asserts only length/determinism/range, so it cannot detect this (the F-68 class) |
| L10-by | the module implements the López de Prado ch.4 sequential bootstrap (header reference) | repo (`analysis/uniqueness.js#sequentialBootstrap`) | **CONFIRMED — it implements a different algorithm** (CYCLE-056, F-72) | the module uses a **static** numerator (`uniqueness_sum / (1 + pick_count)`); the AFML ch.4 reference recomputes each candidate's **average uniqueness against the current selection**, so the overlaps of what has already been drawn matter. `e64` (independent AFML implementation): on `[[0,1],[0,1],[2,3],[2,3]]`, conditioned on the first draw, the second-draw law is **1/7, 2/7, 2/7, 2/7** (module, matched by a 60 000-seed Monte-Carlo within 2.5 SE) vs **1/6, 1/6, 1/3, 1/3** (AFML, which prefers a label from the *other* cluster whose conditional uniqueness is 1.0) — total-variation gap **0.1190**. LATENT/test-only |
| L10-bz | the module docstring says uniqueness is "in (0, 1]" and a base case that cannot be computed abstains | repo (`analysis/uniqueness.js#sampleUniqueness`/`#effectiveSampleSize`) | **CONFIRMED — unvalidated spans return NaN or -0, and NaN poisons the ESS** (CYCLE-056, F-72) | spans are never checked for `start <= end`. `e64`: a zero-length span (`start = end + 1`) returns `0/0 = ` **NaN**, which makes `effectiveSampleSize` (a plain sum) **NaN**; a negative-length span returns `0/-1 = ` **-0**, which does not. No throw, no abstain — an inconsistent degenerate-input contract. LATENT (bar indices are never empty/negative on the shipped paths) |
| L10-ca | `designEffectOfStreams` measures the panel's Kish design effect over all K streams | repo (`analysis/streams.js#designEffectOfStreams`, via `dependence.js#meanPairwiseCorrelation`) | **CONFIRMED — a zero-variance stream is dropped from `rbar` but kept in `K`/`rawBars`** (CYCLE-057, F-73) | `meanPairwiseCorrelation` SKIPS any pair it cannot correlate, so a constant stream contributes nothing to `rbar`; but `designEffectOfStreams` still counts it in `K` and in `rawBars = K*T`, so `designEffect` stays ~1 and `effectiveStreams ~= K`. `e65` (two independent streams + one constant, T=240): rbar is **bit-identical** with and without the constant stream (**-0.0133166822** both), rawBars **480 -> 720**, effectiveStreams **2.0270 -> 3.0821**, effectiveBars **486.48 -> 739.70** — a no-information stream buys a full unit of breadth. `selectStreams` DOES skip it (a candidate with a constant partner is unavailable), so the two shipped functions disagree about whether a flat stream is a stream. LATENT (a flat/halted stream — the L10-l class) and diagnostic-only |
| L10-cb | `selectStreams` "honours `maxStreams`" | repo (`analysis/streams.js#selectStreams`) | **CONFIRMED — `maxStreams <= 0` means UNLIMITED** (CYCLE-057, F-73) | the limit is `Number.isFinite(maxStreams) && maxStreams > 0 ? Math.floor(maxStreams) : all.length`, so `maxStreams: 0` and `maxStreams: -3` select the full greedy set instead of NONE. `e65`: `{a,b}` with `0` -> `['a','b']`, with `-3` -> `['a','b']`, with `2` -> 2. The shipped check only tries `maxStreams: 2`, so it cannot see this. LATENT (analyze.js passes a positive value); the same API class as L10-bj |
| L10-cc | `makeCandleViewFor` attaches a panel with "the array held for THIS stream always replaced by the view's own `returns`" | repo (`analysis/world.js#makeCandleViewFor`/`#panelFor`) | **CONFIRMED — the replacement is skipped when `panel.streamIndex` is absent or out of range, so the cross-sectional look-ahead audit is VACUOUS** (CYCLE-058, F-74) | `panelFor` is `returnsByStream.map((rs, i) => i === panel.streamIndex ? own : rs)`. With `{streamIndex: 1}` (T=40, after=20) slot 1 is the shocked own and 0/2 untouched; with `streamIndex` ABSENT (or `7`, out of range) the comparison is never true and **every** slot is the UNPERTURBED original while `view.returns` is shocked. So `sig-reversal-xs`/`sig-network-momentum` read their own stream unshocked on a probe pass and `auditNoLookahead` cannot fail for them — the exact trap world.js was built to close (a returns-only perturbation passed vacuously, BUGS.md #22). Same root cause as L10-bu (features.js `networkMomentum` self-skip) in a different module, opposite consequence: there a wrong feature value, here a green audit. LATENT (analyze.js always sets `streamIndex`) |
| L10-cd | `worldFromCandles(candles, { maxBars })` "keeps the most recent bars (the A/B's bounded window)" | repo (`analysis/world.js#worldFromCandles`) | **CONFIRMED — `maxBars <= 0` misbehaves (0 = all bars; negative = drops the FIRST |maxBars|)** (CYCLE-058, F-74) | the guard is `maxBars && candles.length > maxBars ? candles.slice(-maxBars) : candles.slice()`. `e66` (30 bars): `5` -> last 5; `0` -> **all 30** (falsy); `-5` -> **25** via `slice(-(-5)) = slice(5)`, i.e. the FIRST 5 bars are dropped (the opposite end from the last-N contract); `7.5` -> 7 (silent truncation). Reachable from the CLI: `analyze.js` passes `num('bars', 300)`, and `readCloses`/`readCandles` use the same `maxBars && ...` guard. A mis-set `--bars` yields a plausible-looking series from the wrong end rather than an error. LATENT |
| L10-ce | `normaliseConcurrency(value, { max })` "validate[s] and normalise[s] a concurrency request" | repo (`analysis/parallel.js#normaliseConcurrency`) | **CONFIRMED — the `max` cap is never validated** (CYCLE-059, F-75) | only the VALUE is validated (`!Number.isFinite(value) || value <= 1 -> 1`), then `Math.min(Math.floor(value), max)` uses `max` raw, so `{max: 0}` -> **0**, `{max: -2}` -> **-2**, `{max: 2.5}` -> **2.5** and `{max: 0.5}` -> **0.5** — the returned "normalised concurrency" can be non-positive or fractional, contradicting the export's own contract. NOT reachable through `scheduleUnits` (which passes `{max: n}`, n >= 1) or the shipped callers (`walkforward.js`/`backtest.js` pass `{max: folds.length}`), so it is a direct-call/export-level gap. LATENT (the same class as L10-cb: an unvalidated limit) |
| L10-cf | `makeFoldExecutor` "validating the reply" from the fold worker | repo (`analysis/parallel.js#makeFoldExecutor`, `analysis/fold_worker.js` posts the shape) | **CONFIRMED — `positions` throws, but `confidence`/`stats` are silently nulled** (CYCLE-059, F-75) | `makeFoldExecutor` throws the named "malformed reply" for a null/undefined reply or a non-array `positions` (incl. a `Float32Array`), but `confidence = Array.isArray(reply.confidence) ? reply.confidence : null` and `stats = reply.stats || null`. `e67`: `confidence: 5` -> **null**, `new Float32Array([1,2])` -> **null**, `[]` -> `[]` (present-but-empty), `stats: 0`/missing -> **null**. So half a malformed worker reply raises and half is absorbed — a worker that switched `confidence` to a typed array would silently lose the R26-3 raw pre-policy confidence the turnover experiment is built on. LATENT (fold_worker.js posts a plain array or null) |
| L10-cg | `turnoverSweep({ costBps })` re-scores the policy at the requested cost | repo (`analysis/holding.js#turnoverSweep`) | **CONFIRMED - the option is echoed, never threaded** (CYCLE-060, F-76) | the function destructures `costBps`, writes it on every row, and then calls `restateReportAtPolicy(report, policy, { periodsPerYear, trials })` WITHOUT it, so `netSharpe`/`dsr`/`dsrAdjusted` and every promotion decision are computed at cost 0. `e68`: a sweep at `costBps: 0` and one at `costBps: 25` are byte-identical apart from the echoed field (both `netSharpe` **0.6864950785702724** at dz 0.1), while a DIRECT `restateReportAtPolicy(..., { costBps: 25 })` reads **-3.156645069841796**. The shipped caller passes the run `costBps` (`analyze.js` `--cost-bps`), so a `--turnover-sweep --cost-bps=10` run prints cost-free Sharpes under a header that says costBps=10. LATENT/report-level (a diagnostic block; no scored number moves) |
| L10-ch | the sweep applies the `requireCleanAudit` hurdle it is passed | repo (`analysis/holding.js#turnoverSweep` -> `walkforward.js#restateReportAtPolicy`/`#promoteDecision`) | **CONFIRMED - structurally inapplicable** (CYCLE-060, F-76) | `analyze.js` passes `decisionOptions: { requireCleanAudit: audit, ... }`, but `turnoverSweep` restates each report first and `restateReportAtPolicy` DROPS the `audit` block (unlike its sibling `restateReportAtCost`, whose comment says the audit carries over unchanged). `promoteDecision`'s guard is `if (baseline.audit && !baseline.audit.clean)`, so with `audit === undefined` the hurdle is skipped. `e68`: a candidate with `audit.clean = false` still reads `promote: true` in the sweep (no audit reason), while the same decision rebuilt with the audit attached is **false** with reason `candidate failed the lookahead audit (1 violations)`. So a candidate that FAILED the run look-ahead audit can be named `byId.bestPromoting`. LATENT/report-level |
| L10-ci | `DEFAULT_TURNOVER_GRID` is immutable | repo (`analysis/holding.js#DEFAULT_TURNOVER_GRID`) | **CONFIRMED - only SHALLOWLY frozen** (CYCLE-060, F-76) | `Object.freeze(DEFAULT_TURNOVER_GRID)` freezes the outer object but not its `deadZones`/`scales`/`holdings` arrays (nor the holding objects): `Object.isFrozen(DEFAULT_TURNOVER_GRID)` is **true** but `Object.isFrozen(deadZones)` is **false**, and `deadZones.push(0.9)` is NOT blocked - `e68` measures the default sweep going **48 -> 54** policies (one band x 1 scale x 6 holdings), restored to 48 by `.pop()`. A caller can change the default grid for every later default sweep in the process. LATENT (nobody mutates it today) |
| L10-cj | the module's IQM is the "interquartile mean (Agarwal et al. 2021)" | repo (`analysis/replication.js#interquartileMean`) | **CONFIRMED - a rank-slice, not the cited quantile-filter** (CYCLE-061, F-77) | the code takes `sorted.slice(floor(n/4), n - floor(n/4))` - it drops a fixed COUNT from each end BY RANK. The cited Agarwal et al. (arXiv 2108.13264) / `rliable` estimator drops the values outside `[q1, q3]` - a MASS rule. `e69`: witness `[0,0,5,10]` reads **2.5** (mean of [0,5]) vs the reference **1.6667** (mean of [0,0,5]), and on 300 right-skewed panels (5-12 values) the two disagree on **149/300** with a max gap **1.016**. The module is self-consistent (its own doc says "drop the lowest and highest quarters"), so this is the L10-by class: an estimator that is not the one it names. LATENT/claim-level |
| L10-ck | `formatSeedReplication` reports the CI at the distribution's confidence level | repo (`analysis/replication.js#formatSeedReplication`) | **CONFIRMED — FIXED (round 47)** | was: printed its OWN `alpha`, so a 90% interval printed as `95%CI` unless the caller repeated the alpha (CYCLE-061, F-77); now prints the level the interval was built at (`dist.ci.alpha`, formatter alpha only the fallback) — shipped path (build + print at 0.05) byte-identical, pinned by an `analysis` §AO check |
| L10-cl | `clusterStability.stable` requires `fractionPositive >= minFraction` AND `worstDelta > minDelta` | repo (`analysis/dependence.js#clusterStability`) | **CONFIRMED — FIXED (round 47)** | was: checked only the fraction, so at a loosened threshold a candidate whose edge collapses without its worst window read stable (CYCLE-062, F-78); now enforces the documented AND — implied at shipped defaults (fraction 1 ⟺ every delta > 0), so default reports byte-identical, pinned by three `analysis` §AO checks |
| L10-cm | `signTest` is exact for the cluster counts the harness sees | repo (`analysis/dependence.js#signTest`) | **CONFIRMED — FIXED (round 47, fail-closed)** | was: the pmf walk starts at 2^-n, which underflows at n ≥ ~1075, reporting pValue 0 (certainly significant) for ANY win count — silent, unsafe direction (CYCLE-062, F-78); now returns NaN + reason past the exact-walk range. In-range behavior untouched (existing §AD exactness checks green). A log-space exact extension is the follow-up if n ≥ 1075 ever becomes reachable; it is not (fold-window clusters number in the dozens) |
| L10-cn | `foldConcentration({ folds, foldInputs })` reads one consistent position series | repo (`analysis/decision.js#foldConcentration` + `analysis/walkforward.js#restateReportAtPolicy`) | **CONFIRMED - a policy-restated report is a mixed-basis input** (CYCLE-063, F-79) | `foldConcentration` reads its gross half (`grossTotal`/`topKs`/signed sums) from `folds.metrics.grossPnl` and its Sharpe half (`deleteOneCluster`/`marginal`) from `foldInputs.signals`. `restateReportAtPolicy` REBUILDS `folds` from the restated positions but returns `foldInputs: report.foldInputs` UNCHANGED (the P2 chaining), so a policy-restated report handed to it gives a block whose gross describes the RESTATED positions and whose Sharpe describes the ORIGINAL ones. `e71`: restated pooled net Sharpe **-5.201698358740081** vs the carried-signal Sharpe **-3.5204429235768973** (restated gross -0.013520135124205322). The shipped `--decision` path restates at COST only (`restateReportAtCost`, same signals, same `costBps`), where both halves agree (**-3.877740023296727**), so it is latent/export-level - reached only by chaining a position-changing (policy/cadence) restatement into `foldConcentration`. LATENT |
| L10-co | `_sigmoid`/`_silu` map a non-finite activation input to 0 | repo (`hivemind/kernels/activations.js#_sigmoid`, `#_silu`, `#_siluDerivative`) | **CONFIRMED - `+Infinity` reads as 0** (CYCLE-064, F-80) | both guards are `isFiniteNumber(x) ? <math> : 0`, which runs BEFORE the internal `Math.min(Math.max(x, -100), 100)` clamp - so the clamp is unreachable for exactly the `+/-Infinity` it would handle, and BOTH tails return 0: `e72` measures `_sigmoid(+Infinity)` = **0** (limit 1), `_silu(+Infinity)` = **0** (limit +Infinity), `_sigmoid(-Infinity)` = 0 (correct by luck), while `_sigmoid(100)` = 1 and `_sigmoid(-100)` = 3.7e-44. A maximally-positive logit is read as a probability of 0 - the failure is in the unsafe direction for `_sigmoid` (its output is a probability). `isFiniteNumber` also accepts numeric strings (`_silu('2')` = 1.7616, `_sigmoid('2')` = 0.8808) while `_softmax` uses `Number.isFinite`, so the activation paths disagree about a valid input. LATENT (finite activations are the norm in the hot path) |
| L10-cp | `_computeGradientNorm`/`_computeSpectralNorm` return the norm and `_computePercentile` the percentile | repo (`hivemind/kernels/statistics.js#_computeGradientNorm`, `#_computeSpectralNorm`, `#_computePercentile`) | **CONFIRMED - a legitimate 0 is replaced by 1** (CYCLE-064, F-80) | each ends in a falsy fallback: `_computeGradientNorm` returns `Math.sqrt(sum) || 1`, `_computeSpectralNorm` sets `currentNorm = Math.abs(norm) || 1` (and returns `currentNorm || 1`), and `_computePercentile` returns `sortedNorms[index] || 1.0`. `e72`: `_computeGradientNorm([0,0,0])` -> **1**, `_computeGradientNorm([[0,0],[0,0]], true)` -> **1**, `_computeSpectralNorm([[0,0],[0,0]])` -> **1**, `_computePercentile([0,1,2], 0)` -> **1** (all should be 0). These feed `gradients.js`'s `vectorNorms`/`specMatrixNorms` -> `_computePercentile`/`_computeDynamicPercentile`/`_computeSparseThreshold`, so a dead gradient (a zero update this step) enters the threshold pool as the value 1 rather than 0. Same falsy-zero class as L10-bt (`finiteSum` empty -> 0 vs NaN). LATENT (a zero gradient is possible but the pool is robust to a few 1s) |
| L10-cq | the vector helpers agree on a malformed (length-mismatched) call | repo (`hivemind/kernels/linalg.js#_fastVectorDot`, `#_vectorDot`, `#_fastVectorAdd`) | **CONFIRMED - three helpers, three answers** (CYCLE-064, F-80) | `_fastVectorDot(a,b)` has no length guard and iterates `a.length`, reading past `b`'s end -> **NaN**; `_vectorDot(a,b)` guards and returns **0**; `_fastVectorAdd(a,b)` returns `new Float32Array(a)` - a **copy of `a`** - silently, so the caller cannot tell the add was skipped. `e72` with `a=[1,2,3]`, `b=[1,2]`: `_fastVectorDot` -> **NaN**, `_vectorDot` -> **0**, `_fastVectorAdd` -> `[1,2,3]`. The NaN is the dangerous one (it propagates through the dot-product-heavy `_projSimilarity`/`_cosineSimilarity` callers); the copy-of-a is the quiet one. LATENT (callers pass equal-length vectors) |
| L10-cr | the statistics kernels' clamps bind and `_computeFractalDimension` is a fractal dimension | repo (`hivemind/kernels/statistics.js#_computeDualEMA`, `#_computeNTKStability`, `#_computeFractalDimension`) | **CONFIRMED - two dead clamps + a mis-named estimator** (CYCLE-064, F-80) | (a) `_computeDualEMA`'s `svrWeight = Math.min(0.8, Math.max(0.2, 0.5*(1 - variance/(variance+1))))` can never reach the **0.8** cap: the raw value `0.5*(1 - v/(v+1))` lies in (0, 0.5], so the effective weight is in [0.2, 0.5] and 0.8 is dead. (b) `_computeNTKStability`'s bandwidth `Math.min(-0.01, Math.max(-0.1, -0.05/(1+lossVariance*medianNorm)))` can never reach the **-0.1** floor: the argument `-0.05/(1+lv*mn)` lies in (-0.05, 0], so `Math.max(-0.1, ...)` never binds and the effective range is [-0.05, -0.01]. (c) `_computeFractalDimension` is `Math.min(2, Math.max(1, Math.abs(Σ log|Δ|)/log n))` - an ad-hoc clamped dispersion, not a fractal dimension: a CONSTANT series (dimension 0) reads the MAXIMUM **2**, a monotone ramp reads 1 (`e72`). The L10-by class (an estimator that is not the one it names) plus two dead guards. LATENT |
| L10-cs | the extra (funding) panel stream affects only the dependence/DSR design effect, not the paired candidate-vs-baseline test | repo (`analysis/walkforward.js#poolReports` + `#clustersOf`/`#pairedPromotionTest`) | **CONFIRMED - the sleeve shifts the paired cluster Sharpe difference** (run corpus; see `RUN-CROSSCHECK.md`) | `poolReports` returns `streamReturns = [...priceStreamReturns, ...extra]`, and `clustersOf(report)` builds the paired test's fold-window clusters from `report.streamReturns` - so the funding sleeve's bars are concatenated into BOTH the candidate's and the baseline's cluster series. On four runs whose `folds.jsonl` are byte-identical (SHA prefix `a87a1de7b666c3f9`), appending the 8-funding-file sleeve flips the promoted arm: `sig-momentum` adjDSR **0.9487614 -> 0.9633037** and paired Delta **1.1995 -> 1.0977**, while `sig-accel` adjDSR **0.9742028 -> 0.9830419** but paired Delta **1.1341 -> 1.0364** (p **0.0493 -> 0.0546**, failing the magnitude hurdle). The P4 reader describes the sleeve as a panel/design-effect input and `pooledMetrics` uses price-only returns, but `pairedClusterTest` does not. Intended semantics UNRESOLVED (triage item, not asserted a defect); the candidate fix is to thread the price-only `streamReturns` into `clustersOf`. LATENT without `--carry-files`; live on any funding run |
| L10-ct | the two construction shells agree about the book grid | lab (`e17_low_turnover.js#buildBook` vs `e21_open_interest.js#xsBookImpl`, both over `e12_xs_carry.js#buildXsSeries`) | **CONFIRMED - two arrays, two grids** (CYCLE-066, F-81) | `buildXsSeries` returns TWO time arrays on the same object: the outer `times` (= `bookTimes`, length **n-1 = 6557**) and `legs.times` (length **n = 6558**). `e17#buildBook` reads `const n = legs.times.length` -> steps 6558 -> **6557** weight rows; `e21#xsBookImpl` is handed `n = times.length` (6557) -> **6556** rows. Both books are internally consistent and both published numbers (R8 `6.18`, OI `0.92`) are correct, but they sit on grids one period apart by which array the experiment happened to read, so no single hard-coded rule reproduces all three and a bit-level cross-check cannot line the rows up. The V2 primitives resolve it by taking the grid as an EXPLICIT `n` (`buildFundingBook`/`buildCrossSectionalBook`, default = the leg rows); `e73` passes `n = times.length` for the OI view only. LAB-INTERNAL/latent (no published number is wrong; the defect is the ambiguity of "the book grid") - no fold-back row |
| L10-bp | `minimumTrackRecordLength` can return a negative (finite) track-record length — no `v > 0` guard while `sharpeStandardError`/`probabilisticSharpeRatio` have one | repo (`analysis/performance.js#minimumTrackRecordLength`; consumed by `#evaluateStrategy` and `backtest.js#backtestMetrics`) | **DISPROVED for measured moments; the residual is a NaN → Infinity mislabel** (CYCLE-054, F-70) | the probe's witness (`sharpe 1 / skew 3 / kurtosis 3` → **−3.058**) violates **Pearson's inequality** (`kurtosis ≥ skewness² + 1`; 3 < 10) so no return series realizes it. Writing the variance out: `v = 1 − g₁·SR + ((g₄−1)/4)SR² ≥ (1 − g₁·SR/2)² ≥ 0`, so **MinTRL ≥ 1** for any measurable triple. `e62`: a 60 000-histogram search bottoms at `v = −2.4e-15` (float zero) attained only by **two-point** supports (`pearsonSlack −4.4e-16`, square-bound 1.8e-30); 20 000 random series violate none of the three bounds (min v 0.127); MinTRL from measured moments over 4 000 series never falls below **2.17**. The guard asymmetry is defensively correct-but-unnecessary, **not** a defect. The real (latent) residual: `!(sharpe > benchmarkSR)` also catches **NaN**, so `minimumTrackRecordLength({sharpe: NaN})` returns **Infinity** — which its own docstring ("Inf when SR <= benchmarkSR"; `NaN <= benchmarkSR` is false) does not license — and `backtestMetrics` on a **1-bar** fold reports `minTrackRecordLengthStatus: "beyond-horizon"` for an incomputable Sharpe, where `"unavailable"` is the correct state. LATENT |

**L10-aa is the first defect that implicates the *shipped* path's arithmetic.** Everything before it was a
caller bug (L10-a, a first lab draft), documented behaviour (L10-b/c), lab-local (L10-j…p), or a property of
the *data files* that traps consumers (L10-m/n/o — the funding series runs past the candles; the alt candle
files are ragged; SOL funding changed interval during FTX). L10-aa is different: the shipped
`carryOnBarGrid` joins the same two sources and mis-scales the sub-8h window, contradicting its own header
comment ("divides by the period actually observed"); L10-ab/ac are its latent siblings. The lab never calls
it (its loader buckets rows first, L10-o), so no lab number moves — but **any consumer of the shipped
sleeve inherits a 3× understatement of the FTX window, and it flatters the result**, so no "implausibly
large" alarm can catch it. It gets fold-back row **R4**.

## Verdict

**ONGOING.** Confirmed so far: three methodology bugs (F-11's lab-draft look-ahead, L10-p's
outlier-fragile design effect, L10-q's book-index look-ahead), two documentation/decision bugs (F-01;
L10-s's sign-vs-magnitude claim), one scope limitation (L10-g), one aggregation claim cleared
(F-13/L10-c), **ten lab-local defects fixed** (L10-j, k, l, m, n, o, r, u, v, z) and **one process defect —
a stale lead status (L10-t)**. CYCLE-006 was the audit's most productive cycle: the four
alignment/quantisation bugs it found each moved the carry headline, and together they understated the
flat book's Sharpe by ~9.5× (F-18). CYCLE-016 added the first *documentation-claim* contradiction
(L10-s) — the kind that never throws and never moves a number, and is therefore only catchable by
measuring the claim directly. CYCLE-017 and CYCLE-018 each added a *draft* defect caught by a validation
guard or a null metric (L10-u, L10-v) — evidence that the lab's own primitives now fail safe. Since then
the register has grown three **statistic/measurement-basis** rows — **L10-w** (an OI capacity quoted as a
*ratio of means*), **L10-x** (a *min of ratios* taken over a masked subset) and **L10-y** (a sleeve *mix*
measured by capital fraction across a **31–55×** volatility gap) — all lab-side, none in the shipped path,
each now reported beside its correction. **L10-z** (CYCLE-031) adds a fourth *draft-guard* entry — a
validation tolerance mis-specified relative to a 2-dp artefact — again caught before it could suppress a
finding. `experiments/e14_data_integrity.js` now encodes the data joins as
standing regression tests (14 checks), run on every `run_all`. **CYCLE-044 (F-61) adds the audit's first
*shipped-path arithmetic* defect**: **L10-aa** — the repo's `carryOnBarGrid` divides every funding row by the
*default* 8h bar count rather than the observed interval, so sub-8h funding is understated `8h/interval`
(**1×/2×/4×/8×** measured), the shipped SOL FTX window is understated **3.03×**, and the pooled 8h sleeve
reads ann **9.985 %→9.531 %**, Sharpe **11.96→9.60** (the defect *flatters* the sleeve — the F-18 direction
trap). Its siblings are **L10-ab** (a single-pair `barsPerPeriod` inference, latent) and **L10-ac** (the audit
is blind to sub-grid intervals: SOL's 98 2h steps pass `auditFundingProblems` as `[]`). Fold-back **R4** is
updated; the lab's own loader is unaffected (it buckets rows first) and is now pinned by
`e14#sub_8h_sleeve_equality`.

**CYCLE-045 (F-62) is the audit's first *positive validation* of a repo statistic, and it settles two
long-open rows.** The dependence/DSR backbone (`dependenceSummary` → `effectiveBars` → `backtestMetrics`) is
**unbiased** — its ensemble mean matches the survey-sampling closed forms (`1+(K−1)ρ`, `K`, `1+ρ`, and the
i.i.d. null 1) within 2.5 SE across 14 synthetic panels (max gap 0.318), so F-02's real-basket design effect
of 4.92 is the estimand it claims. But the audit also measured the estimator's **precision**, which the lab
had never done: on true-i.i.d. data a single reading at the repo's own fold count (C = 36) spans
**0.644–1.452** (sd 0.243), falling to 0.899–1.231 (sd 0.097) at C = 288 — so any `designEffect` quoted to two
decimals (F-02, F-47) overstates the resolution by ~an order of magnitude, and a single pooled
`adjustmentNeeded` verdict within ~1 ± 0.25 of the gate is not resolvable. And it closed the bound question:
**L10-f** — `effectiveBars` is not merely able to exceed `n`, it is **unbounded** (a hedged pair gives ~3.4e34
while `adjustmentNeeded` stays false, because DE is a squared ratio) — and **L10-i** — the DSR path's refusal
to adjust when the design effect is < 1 is **intended**, not a bug. The residual is **L10-ae**: the path
cannot distinguish a hedged panel from a degenerate one, since both return `null`. `e54_dependence_audit.js`
is the register's **second synthetic-ground-truth experiment on a repo function** (after `e53`, F-61), and its
2.5-SE-band method is now the standing recipe for auditing a statistic.

**CYCLE-046 (F-63) audits the split machinery the lab reports *from*, and finds the family's purge
contract holds for two of its three members.** `purgedKFoldSplit` and `combinatorialPurgedSplit` are
leak-free on every fold of a synthetic label-overlap grid (zero overlap pairs; embargo honoured; CPCV test
multiplicity `C(k−1,m−1)`), but **`walkForwardSplit` — the path the repo A/B and the lab's F-13 actually
use — performs no purging or embargoing at all**: no `labels`/`labelSpan`/`embargo` parameters, no purge
metadata on the folds, so for a label horizon H > 1 the fold boundary leaks exactly `H(H−1)/2` train/test
label-overlap edges per fold (10/fold at H=5). The causality guard `isCausalFold` tests index order only,
so it passes every leaky fold — it is a *look-ahead-in-time* check, not a *leakage* check — while the repo's
`assertNoLeakage` does flag it but is never called on the walk-forward (**L10-ag**: the lock-registry note
claims "zero label-window leakage" for the *family*; the tests assert it only for the purged variants — the
L10-t lesson that a test-ledger claim is itself a claim). An index-lookup model recovers test-period
returns in the leak zone (**+0.0035**/bar, se 7e−5, vs 0.0000 clean / +0.0001 purged), so the leak is not
cosmetic. The lab is unaffected (parameter-free signals → span 1 → zero leak), but the shipped controller
trains on horizon labels, so the precondition is met on the shipped path — the live magnitude is the
follow-up, and the fix is a **FOLD-BACK R9 (candidate)**: purge the walk-forward boundary.

**CYCLE-047 (L10-ah) scopes F-63 down: the leak is LATENT, not live.** The follow-up the register left open
is a code trace, not a new experiment. The shipped controller's labels *do* overlap (`heldBars {mean 8.30,
max 54}`), so F-63's precondition holds — but the leak still cannot occur: `analyze.js#makeControllerModelFactory`
fits a fold by replaying bars `1 … testStart`, each call seeing only a window ending at `i − 1`
(`analyze.js:1018`), so the last training bar is **`testStart − 1`** and the fold's declared `train` list is
**ignored**; and `hivemind/controller/trades.js` labels a trade by its outcome at the **exit** bar with only
*closed* trades entering training — so every training label is realised at an exit `≤ testStart − 1`,
causally before the test. The leak needs a training label realised *inside* the test window; the shipped
path has none. **F-63 is amended (latent), R9 is downgraded to latent / low-priority**, and the `e55` guard
stays so a future **fixed-label offline** model behind `walkForwardSplit` cannot silently inherit the leak.
This is the register's first **negative scope** on a shipped-path alarm — the lab's discipline that a
confirmed defect is not finished until its *reach* is measured, and it is exactly the kind of false alarm
worth killing before it becomes a port.

**CYCLE-048 (F-64) turns the synthetic-ground-truth technique on the labelling module, and finds the
contracts hold while the warts do not reach the shipped path.** `e56_labels_audit.js` audits
`analysis/labels.js` against closed forms: `tripleBarrierLabels`' first crossing is exactly
`ceil(level/step)` on **192** monotone cases and its three-way `ret` / first-crossing / timeout-index
contracts hold on **60** seeded random paths; `cusumFilter` matches an **independent** drawup/drawdown
formulation of its own reset rule on **160/160**; `fractionalDiffWeights` matches `(−1)^k C(d,k)` exactly
for integer `d` and against an independent Lanczos-`Γ` for non-integer `d` (max rel. err **2.3e−14**);
and the one shipped consumer (`features.js#fracDiffAt`/`fracMomentum`) equals the convolution exactly. But
the audit also found **five warts**: the `pt`-before-`sl` tie-break is **unreachable for `vol > 0`** (0 of
6 bars can satisfy both) and degenerate at `vol ≤ 0` — at `vol = 0` the barrier collapses to a one-bar
sign label and a flat series labels 11/12 events **+1 at `ret = 0`** (**L10-ak**); the default event set
emits a **zero-horizon** `{t1 = event, label 0, ret 0}` bet indistinguishable from a vertical timeout
(**L10-al**); `cusumFilter` **ignores its `events` argument** (**L10-ai**) and its `lastEmit` guard is
**dead** (**L10-aj**); and the "`size <= 0` uses `DEFAULT_FD_WINDOW`" docstring is **false** — the auto
branch stops at `|w| < 1e−12`, giving widths 1/2/3/4 for `d = 0/1/2/3` (**L10-am**). The cycle also
**killed a candidate before it was written down**: `fractionalDiffWeights(0, 0)` is `[1]` and the `d = 0`
identity is exact with no NaN — the width-2/NaN case is `d = 1` (**L10-an**, RESOLVED). The scope trace
(**L10-ao**) is what makes all of it latent: **only 1 of the module's 6 exports is on the shipped path**
(`fractionalDiffWeights`, via `features.js`), while `tripleBarrierLabels`/`cusumFilter`/`fractionalDiff`/
`fracDiffLogPrices`/`DEFAULT_FD_WINDOW` are **test-only** (the shipped controller labels trades in
`hivemind/controller/trades.js`). The calibration row **L10-ap** records that the shipped arm uses
`window 16` where the module's own auto rule is **100**, with **6.27 %** of the `|w|` mass beyond `k = 15`.
No shipped behaviour moves and there is **no new fold-back row**.

**CYCLE-049 (F-65) audits the last of the pure "accuracy-battery" modules, and finds the structure exact
while the calibration figure is a single draw.** `e57_overfitting_audit.js` verifies every claim
`docs/LOCKED.md`/`lock-registry.js` make about `analysis/overfitting.js`: `cscvBlocks` partitions exactly,
`cscvSplit` yields exactly `C(S,S/2)` splits (each a disjoint cover, each block in exactly
`C(S−1,S/2−1)` in-sample sets, closed under complement, the cap rejecting `C(22,11) = 705432` while passing
`C(20,10) = 184756`), `relativeRank` matches best `N/(N+1)`/worst `1/(N+1)`/tie `1/2`, and
`oosOnIsRegression` matches an **independent sum-formula OLS** on 40 vectors. Constructed PBOs are exact
(all-flat **1**, one dominant strategy **0**, an anti-persistent pair **1**, a hand-computed metric override
**0.5/1.0**), and PBO is exactly invariant under annualisation and positive per-column scaling. The quoted
calibration reproduces **exactly** — with the repo's own RNG, seed 20240, 20 i.i.d. strategies, T=500, S=10,
**PBO = 117/252 = 0.46429**, slope −0.0936 — but the ensemble centres at **0.4769** with **sd 0.2546**
(p05–p95 0.099–0.885) against a binomial split SE of 0.0315, i.e. a split **design effect of 65** and
**≈ 3.9 effective splits**: a PBO quoted to 2–3 decimals overstates its resolution ~8×. Four further rows:
**L10-aq** (`relativeRank` skips NaN in the rank but divides by the full `n` — `3/5` vs `3/4`, biasing PBO
up); **L10-ar** (a **fully-tied** roster is forced to PBO exactly 1, while partial duplication does **not**
bias it — the pre-registered mechanism guess is **falsified**); **L10-as** (`degradation` returns
`n = N·splits = 2016` dependent pairs over 80 block performances, so a naive t exceeds 1.96 on **91.2 %** of
skill-less matrices); **L10-au** (`cscvBlocks(6,6)` alone gives 1-observation blocks). **L10-av** is the
scope: **no shipped module imports `overfitting.js`** (tests + lock-registry only), so every row is latent
and there is **no fold-back row**.

**CYCLE-050 (F-66) audits the resampling hub — the one part of the module family that is *partly* shipped —
and finds the live primitives exact, the documented reference unreproduced, and two suite steps ungated.**
`e58_reality_check_audit.js` (39/39 checks) verifies every exact identity: `stationaryBlockIndices` at
`b = 1` is byte-equal to an independent hand replay of its rng stream and is i.i.d.-with-replacement, its
restart law is geometric (`P(restart) ≈ 1/b`, mean run `≈ b`, both within 2.5 bootstrap SEs), and
`neweyWestSE` matches an **independent Bartlett implementation** on 24 windows × bandwidths (1e−12); RC =
`sqrt(T)·max mean` (a constant benchmark shifts it by exactly `−sqrt(T)·b`), SPA = `max(0, max fbar/ω)` with
the bootstrap SE (independently recomputed), `A_k = ω_k·sqrt(2 log log T)` is exact, consistent and upper
recentring coincide when all candidates are valid, the step-down's **first step is bit-equal to the
consistent SPA**, and the subsampling family shares **one** reference (k-FWER `k=1` == step-down first p ==
consistent SPA p), is deterministic, and is segment-aware. It also reproduces the arch AR(1) reference
vector (**13.635665 / 15.608940**) from an **independently implemented NumPy legacy-RandomState(0) stream**.
Four rows follow. **L10-aw** is the headline: `politisWhiteBlockLength` returns **exactly 0** whenever its
flat-top long-run `g ≤ 0`, while the referenced `arch._single_optimal_block` **squares `g`** — over 200
mean-reverting AR(−0.5) draws the repo reads 0 in **198** and arch a positive length, so `autoBlockLength`
floors to **1 (i.i.d.)** on 99/100 of them: the automatic block bootstrap silently degrades to i.i.d.
resampling on anti-persistent data (the comment's \"reproduces arch … to floating-point precision\" is false
for `g ≤ 0`). **L10-ax** is the `median` arm reduction being the **upper** median on even `K`
(4.84761 vs 4.25907). **L10-ay** is the `neweyWestSE` `v < 0` clamp being **unreachable** (the Bartlett
estimator is a PSD quadratic form; min taper exactly 0). **L10-az** is the scope: the whole block-bootstrap
family is **test-only**; only `stationaryBlockIndices` (via `forecast.js`) and `neweyWestSE` + the four
subsampling procedures (via `walkforward.js`) are shipped, and those are exact. Independently re-measured:
subsampling SPA holds its 5 % size across the persistence sweep (**0.040/0.045/0.045/0.030** for
φ = 0/0.2/0.5/0.8) while the block bootstrap over-rejects (**0.385** at φ = 0.8). **Lab bug fixed:** `e56`
and `e57` never exposed `verdict.validationPass`, so `run_all` left their `pass` undefined since
CYCLE-048/049 — two validation suites were reported but **not gated**; they are now, and the suite reads
**35 gated**.

**CYCLE-051 (F-67) audits `forecast.js` — the SHIPPED forecast scoring layer — and finds its arithmetic
exact against the repo's own second Murphy implementation, with a false docstring identity, a count-only
alignment guard, and an off-target benchmark branch.** `e59_forecast_audit.js` (33/33 checks) verifies:
`forecastPairs` IS the exact inverse of `confidenceFromProb` (1e−12) plus the next-bar sign, the
fold-last-bar drop and the non-finite skip; `brierBinIndex`/`brierScore`/`logScore` are the closed forms
with the documented clip/NaN handling; the Murphy partition satisfies `brierBinned = REL − RES + UNC`
(1e−17); **`observer/legion_metrics.js`'s independent second `brierDecomposition` agrees on
REL/RES/UNC/Brier to 1e−12** and its explicit `within` equals forecast's raw-minus-binned gap to **1e−17**;
`bootstrapMeans` is deterministic with the documented `max(1,floor(cbrt(T)))` block and one paired index
draw; the DM statistic is exactly `dbar/boot-SE`, its degenerate arms are the documented ones
(zero → 0/1/null, constant positive → Infinity/0), its i.i.d. size is nominal (**0.0525/0.1075**) and the
block bootstrap controls φ=0.5 size where `blockLength=1` does not (**0.095** vs **0.135**); and the MCS
eliminates a uniformly worse arm, keeps an identical pair, **always contains the sample-best** (800/800),
is deterministic, is monotone in the confidence level and covers **0.880/0.855/0.865/0.925** (the lower
edge of the 2.5-SE band). Five rows follow. **L10-ba** is the headline: the comment's claim that the
raw-minus-binned gap *IS* the within-bin forecast variance is false — the exact identity (stated by the
repo's own `observer/legion_metrics.js`) is `gap = WITHIN = withinVar − 2·withinCov`, and the gap is
**negative on 5/6** configs while `withinVar > 0` (wrong by up to **0.13**). **L10-bb**: the alignment
guard checks bar **counts**, so a count-coincident misalignment is silently paired index-wise and the DM
verdict **flipped in 6/6** crafted witnesses. **L10-bd**: `groupOf` maps `benchmark` to the **baseline's**
kind, so with a `'signal'` baseline a calibrated-probability benchmark joins the z-score group and gets a
DM test (contradicts the `reader`; unreachable from `analyze.js`, reachable through the API, untested).
**L10-be**: the MCS elimination denominator is `sd(L_i)`, not HLN's `sd(d_i)` (up to **77×** apart,
**0/150** set or order changes). **L10-bc**: `bootstrapMeans` silently NaNs on unequal-length series and
the MCS returns `available:true` for a NaN-containing series (latent, export-level). **L10-bf** is the
negative control: the calibration battery **upholds** the module. No fold-back row (docstring/branch/export
level, not the scored path).

**CYCLE-052 (F-68) audits the last pure analysis module — the successive-halving racing engine — and finds
its closed forms exact while the *correctness requirement* that would license using it is a tautology on
its own test fixture.** `e60_race_audit.js` (18/18 checks) verifies `halvingRounds`
(`max(1, floor(log(max/min)/log(eta)) + 1)`) and its guards, `halvingSchedule`'s
`keep = max(1, ceil(survivors/eta))` / monotone budgets / top rung `= maxBudget` / early stop, and
`successiveHalving`'s contracts (full-rung arm order, `nonFinite` elimination, `maximize:false`,
sync-vs-async equality, stable ties, six-grid cost reconstruction, the `arms`/`evaluate`/`maxBudget` guards,
`formatRace`). Four rows follow. **L10-bg** is the headline: `docs/LOCKED.md`'s *"a racing budget does not
change the decided set"* is validated only because the §AM fixture's `evaluate = q ± 0.05/budget` has a
**budget-independent ranking** (`rank(1) == rank(9)`) — a tautology — and the fixture's top rung (3) is below
its oracle's budget (9); on a budget-dependent evaluator (the SHA premise) the race discards the top-budget
best on **0.62–0.70** of seeded fixtures. **L10-bh**: the `spentBudget < gridBudget` identity fails once the
budget ratio is small relative to the round count (**1.00–2.89×**). **L10-bi**: small `eta` rounding repeats
rungs (15 of 25 at `eta = 1.1`). **L10-bj**: `successiveHalving` does not validate `eta`/`minBudget` (silent
`available:true`, `winner:null`, zero evaluations). **L10-bk** is the scope: the module is engine-only /
test-only, so all of it is latent, and there is **no fold-back row**. Three of the four rows are
*documentation-vs-code* gaps (the L10-s/L10-ba class): the code cannot fail where it is never called, but the
claim that licenses turning the `--race` flag on does.

**CYCLE-053 (F-69) audits the last shipped module on the list — the P1 model-class benchmark — and finds the
documented contracts exact while the ridge arm's probability is anchored at 0.5.** `analysis/benchmark.js`
feeds the opt-in `--variants=bench-base-rate,bench-linear,bench-mlp` arms; the ridge is the MCS survivor and
the best of the set, so its output is load-bearing for P1's "negative branch" (G-A). `e61_benchmark_audit.js`
(12/12 checks, 67 ms) validates the standardiser (zero-mean/unit-std, collapsed constant column, empty-input
shape), `fitRidge` against an **independently solved** centred ridge (matching to 0), `predictRidge`'s
`(0,1)` range, `fitBaseRate` = the training prior, the ridge/MLP separable-rule accuracy, MLP determinism,
`BENCHMARK_KINDS` + the `tsfm`/unknown-kind refusals, and a perfect classifier beating the base rate on Brier.
Four rows follow, two of them **shipped**. **L10-bl** is the headline: `fitRidge` computes `ybar`, centres the
target on it, and **`predictRidge` never restores it**, so the arm's probability is anchored at 0.5 — a
constant-`y` fold reads exactly 0.5 and a 0.833-base-rate fold reads a mean of 0.50 (Brier 0.2248 vs 0.1353
with the module's own term restored); the shipped test checks accuracy only (a 0.5 threshold, invariant to the
offset), so it cannot fail. **L10-bm**: the sigmoid is applied to a least-squares fit of a bounded [0,1]
label, confining the output to `sigmoid([-1,1])` — a perfect feature reads Brier 0.1425 (the arm's floor) while
the MLP reaches 0.99 on a constant-`y` fold. **L10-bn**: the LOCKED/lock-registry claim that the test proves
the ridge closed form "against a hand-computed solve" is **unverified** (the closed form is exact, but no
shipped test checks it). **L10-bo** is latent: the eps constant-column fallback turns a one-unit train→test
deviation into `z = 1e8`. No fold-back row (opt-in arms; no golden moves).

**CYCLE-054 (F-70) turns the technique on the measurement layer — `analysis/backtest.js` and its instrument
`analysis/performance.js` — and finds the instrument exact while a readout's *criterion* is not what its name
says.** `e62_backtest_audit.js` (26/26 checks, 4.13 s) validates both halves against **independent references**:
`erf` against an independent **Simpson quadrature** (max err **1.393e-7**, inside A&S's 1.5e-7) with
`normalCdf(0) = 0.5` exactly and `Phi` odd; `normalInvCdf` round-tripping **2.46e-10** against a **Lentz-erfc**
reference (inside Acklam's 1.15e-9) and antisymmetric to 2.8e-14; the population moments exact
(`kurtosis([1..5]) = 1.7`, `stdSample = √2.5`); the Lo (2002) SE = `√(1.5/99)`; PSR **exactly 0.5** at its own
benchmark and matching an independent z to 5e-7; DSR = PSR at the expected-max hurdle to **1e-15** (DSR ≤ PSR;
`expectedMaxSharpe` reproduced to 5.1e-11, ∝ √V and monotone in trials); MinTRL = **13.1749455166** against the
documented vector 13.174945 and an independent recompute; and the stationary bootstrap size-calibrated on
**1000** i.i.d. noise series (**5.9 %** at 5 %, **11.0 %** at 10 %, mean p **0.502** — the repo's 5.8 % claim
reproduced) and deterministic per seed. The backtest arithmetic recomputes exactly (positions lag one bar;
turnover counts the initial entry; gross/cost/net to 1e-15; equity `[1,1.1,0.88,0.924]`; drawdown 0.5/0.19/0;
tradeCount transitions; the break-even identity and the participation fields), `poolFolds` restates the per-fold
aggregates exactly, and `purgedCVBacktestAsync` is **byte-identical** to the serial path. Three rows follow.
**L10-bq** is the actionable one: `hitRate(strategyReturnSeries)` receives **only a return series**, so its
docstring ("bars with no position are excluded") is a criterion its signature cannot express — the code skips
`r === 0`, dropping a zero-return in-market bar (**0.6667** where the documented rule gives 0.5), and because
`backtestMetrics` passes the cost-laden **net** series, every exit-cost flat bar counts as a **miss** (a
perfectly-timed 3-round-trip book at 10 bps reads **0.5000** where the documented rule gives **1.0000**) — so
the printed hit rate moves with the cost level and the turnover. **L10-br**: the fold scorer re-lags the signal
**inside** the test slice, so on the supported fixed-signal path the first bar of every fold is flat and a
**CPCV** run boundary holds the previous *test* bar's signal (bar 30 pooled **+0.05** vs the global **−0.05**;
3/64 bars differ on a 4-fold split). **L10-bp** is a **disproved lead**: the negative MinTRL (−3.058) requires a
moment triple that violates **Pearson's inequality**, and `v ≥ (1 − skew·SR/2)² ≥ 0` for every measurable triple
(a 60 000-histogram search bottoms at `v = −2.4e-15` on two-point supports, 20 000 random series violate
nothing, MinTRL from measured moments ≥ **2.17**) — the genuine residual is that a **NaN** sharpe yields
Infinity and is labelled `beyond-horizon` instead of `unavailable`. All three rows are report-level or latent;
no fold-back row.

**CYCLE-055 (F-71) turns the technique on the causal signal family — `analysis/features.js` — and finds its two
headline contracts exact while four latent defects hide in the arithmetic.** `e63_features_audit.js` (11/11 checks,
70 ms) audits all **16** candidates. The **causality** contract is upheld exactly: for every candidate and every
test bar, perturbing closes/returns/volumes/panel **strictly after** `t` leaves `positionAt` bit-unchanged (**0
mismatches over 16x100 bars**), and non-vacuously (every candidate non-zero on all 100 bars; 77-79 later bars moved).
The **abstain** contract holds too: a returns-only view abstains on exactly the five channel-dependent candidates,
degenerate series stay finite in [-1,1], `clampPosition` is exact, all **13** single-feature references are exact to
1e-12 (`fracDiffAt` also equals the shipped `labels.js#fractionalDiff` convolution), and the cross-section and regime
gate match their references. **L10-e is SETTLED**: a `{close}` (singular) series abstains (`rangeLocation` NaN,
`positionAt` 0) while `{closes}` gives 0.0211625225 — the plural field is load-bearing, a confirmed contract not a
defect. Four new rows follow, all latent/export-level. **L10-bs** is the headline: the `std is 0` abstain guard is
defeated by floating-point rounding — an exactly-constant window leaves `std` a denormal positive so the guard cannot
fire, and the feature reads `|z| = sqrt((n-1)/n)` (**-0.9682458366** n=16, **-0.9842509843** n=32,
**-0.9746794345** n=20) instead of 0, i.e. a **0.468..0.492** position at saturation 2 from an information-free
feature; it is a rounding-boundary effect (where the mean is bit-exact, e.g. the 0.03125 fixture, the guard fires),
which is why the shipped test gives no warning. **L10-bt**: `finiteSum` on an empty range returns **0** where
`meanOf` returns **NaN**, so momentum/acceleration read a plausible 0 for a 0-width window instead of abstaining.
**L10-bu**: `networkMomentum`'s self-skip `i === panel.streamIndex` never matches when `streamIndex` is absent, so
the feature silently folds the stream own lagged momentum into its network average (**-0.9066812992** with the field
vs **-1.8820447956** without). **L10-bv**: `regimeGatedMomentum` scales the crash gate by the MOMENTUM window
variance rather than the gate window, so the threshold is off by **1.309** (shipped 16 vs 32) and the gate fires too
rarely in a hot short-term regime. No fold-back row (all four are latent; no golden moves).

**CYCLE-056 (F-72) turns the technique on sample uniqueness — `analysis/uniqueness.js`, the López de Prado ch.4
reference (average uniqueness, effective sample size, sequential bootstrap) — and finds the quantity exact while
the module's only algorithm is not the one it names.** `e64_uniqueness_audit.js` (8/8 checks, 82 ms) confirms
`sampleUniqueness` against an **independent per-bar scan-all-spans recompute** to 1e-12 (`[[0,2],[1,3]]` -> 2/3,
2/3; `[[0,0],[0,5]]` -> 1/2, 11/12) and against the **shipped** `hivemind/training/sample_weights.js#overlapUniqueness`
to **exactly 0** (8 fixtures) — so the two implementations cannot drift, and the shipped form is the correct
average. It is per-label order-invariant, and the ESS identities hold (point labels -> n; ESS = sum;
averageUniqueness = ESS/n; ESS <= n — 6 overlapping labels read 5.5833). Three rows, all test-only/latent.
**L10-bx** is the headline: `sequentialBootstrap` stores `avgU[i] = acc`, the uniqueness **SUM**, where the
comment and ch.4 specify the **average** — so the draw is biased toward long labels. Two NON-overlapping labels
(both average uniqueness 1.0, so ch.4 weights them 50/50) with spans `[0,0]` and `[1,3]` are drawn first **0.7480**
vs **0.5000**; a 1/2/3-length fixture reads 0.1688/0.3299/0.5014 vs 1/3 each. **L10-by**: the implemented
heuristic (static numerator, `1/(1+count)` conditioning) is not the cited AFML ch.4 bootstrap — the reference
reweights each candidate by its average uniqueness *against the current selection* — so on `[[0,1],[0,1],[2,3],[2,3]]`
the second-draw law is 1/7,2/7,2/7,2/7 vs AFML 1/6,1/6,1/3,1/3 (total-variation gap **0.1190**). **L10-bz**: spans
are unvalidated (a zero-length span returns NaN and poisons the ESS; a negative-length span returns -0). No
fold-back row (all test-only; no golden moves).

**CYCLE-057 (F-73) turns the technique on the stream design layer — `analysis/streams.js` (shipped; `analyze.js`
prints it) — and finds the arithmetic exact while two functions disagree about what a stream is.**
`e65_streams_audit.js` (9/9 checks, 16 ms) confirms `resampleCandles` against a **hand recompute** to 1e-12
(factors 2/3/4/7 x keepIncomplete) with every OHLCV invariant (open = first open, close = last close, high = max
finite high, low = min finite low, volume = sum, timestamp = first), plus `never mutates`, factor 1 = shallow
copy, trailing-partial-group dropping (10 bars / factor 4 -> 2 groups, keep -> 3; 3 bars -> 0/1), the bad-factor
and non-array throws, and the non-finite fallbacks (a group with no finite high/low reads max/min(open,close); a
missing volume counts as 1). The design effect satisfies **every** Kish identity (`rawBars = K*T` 720,
`designEffect = 1+(K-1)*rbar` 2.9458671265, `effectiveBars = rawBars/DE` 244.4102, `effectiveStreams = K/DE`
1.0184, `effectiveBarsPerBar = 1/DE`) with rbar = an independent mean pairwise correlation to 1e-15
(0.9729335633); K=1 is the trivial panel; identical streams are one bet (rbar 1, DE 2/3, effectiveStreams 1);
different lengths align on T = min (240/120 -> T 120); `fold-sharpe` is chosen iff the fold tiles T (rbar
0.2657996327 = an independent segmentation) and the degenerates abstain. The selector is deterministic,
tie-breaks by label (a fully redundant pool -> [x]), is monotone, and its marginal arithmetic is exact. Two rows.
**L10-ca** (headline): a zero-variance (constant) stream is **skipped from `rbar` but still counted in `K` and
`rawBars = K*T`** — adding one constant stream leaves rbar **bit-identical** (-0.0133166822) yet takes
effectiveStreams **2.0270 -> 3.0821** and rawBars 480 -> 720, so a no-information stream buys a full unit of
"effective breadth"; `selectStreams` **does** skip it, so the two shipped functions disagree. **L10-cb**:
`maxStreams <= 0` is treated as **unlimited** (0 and -3 both select the full set instead of none). Diagnostic-
layer/latent; no fold-back row.

**CYCLE-058 (F-74) turns the technique on the audited evaluation world — `analysis/world.js` (shipped; the module
that gives `auditNoLookahead` its teeth) — and finds its contract exact while a missing `streamIndex` reopens the
vacuity trap the module exists to close.** `e66_world_audit.js` (7/7 checks, 49 ms) confirms `shockFactor`/
`volumeShockFactor` are 1 at and before `after` and strictly inside [1, 1+2*probe] after (probe 0.07 -> max 1.14),
deterministic, non-uniform and phase-shifted (t=after+2: price 1.0494 vs volume 1.1369; probe 0 a no-op);
`shockCandles(null)` is the same array, every bar <= after the SAME object, every bar > after a new one with OHLC
x f(t) and volume x fv(t), never mutating its input, deterministic, positive and shape-changing (close ratio
1.0001-1.0993); `makeCandleViewFor` returns the real candles on the base pass (`returns = barReturns(closes)`; a
caller returns array used verbatim) and a self-consistent tuple on a probe pass (`view.returns ===
barReturns(view.closes)` exactly) with the past bit-unchanged and 19/19 future bars moved; `worldFromCandles`
aligns and keeps the last maxBars. Two rows. **L10-cc** (headline): `panelFor` replaces the panel's own-stream
slot only when `panel.streamIndex` matches an index — with `streamIndex` ABSENT (or out of range) EVERY slot stays
the unperturbed original while `view.returns` is shocked, so a cross-sectional candidate reads its own unshocked
series and the look-ahead audit is VACUOUS (the exact trap world.js exists to close; same root cause as L10-bu,
opposite consequence). **L10-cd**: `worldFromCandles`' maxBars guard treats 0 as ALL bars (falsy) and -5 as
DROP THE FIRST 5 (`slice(-maxBars)` sign flip), with a fractional value truncated silently — reachable from
`--bars`. Latent; no fold-back row.

**CYCLE-059 (F-75) turns the technique on the order-preserving scheduler — `analysis/parallel.js` (shipped; the
module that makes `folds.jsonl` byte-identical between the serial and parallel A/B paths) — and finds its queue
contract exact while two edges are unvalidated.** `e67_parallel_audit.js` (7/7 checks, 49 ms) confirms
`normaliseConcurrency` maps every non-finite/non-positive width to serial 1 (0, -3, NaN, Infinity, null,
undefined, `'3'`, true, false, 0.5, 1) and floors/caps the rest (2.9 -> 2; 1e6 -> 64); `scheduleUnits` returns
results in UNIT ORDER under an out-of-order completion schedule (finish order 2,1,0,5,4,3,6,8,7,9), calls exec
exactly once per unit, peaks at exactly the requested concurrency (3; n when the request exceeds n), reports
through onResult out of order with a throwing reporter harmless, rejects with the FIRST error (two failures ->
e0), starts no unit past the start window, settles every started exec (settled === started, no dangling promise),
propagates a synchronous throw and returns [] on empty; and makeFoldExecutor maps {positions, confidence, stats}
to {signals, confidence, stats}, passes the request through verbatim, and throws a named malformed-reply for a
null/undefined reply or a non-array positions (incl. a Float32Array). Two rows. **L10-ce**: `normaliseConcurrency`
validates only the value, not its `max` cap — {max: 0} -> **0**, {max: -2} -> **-2**, {max: 2.5} -> **2.5**
(not reachable via scheduleUnits, which passes max = n >= 1; the same class as L10-cb). **L10-cf**:
makeFoldExecutor throws on a bad `positions` but **silently nulls** a non-array `confidence` (5, a Float32Array)
and any falsy `stats` (0, missing), so a worker switching to a typed-array confidence would silently lose the
R26-3 raw pre-policy confidence the turnover experiment is built on. Both latent; no fold-back row.

**CYCLE-060 (F-76) turns the technique on the turnover policy grid — `analysis/holding.js` (shipped; `analyze.js`
runs it as `runTurnoverSweep` behind `--turnover-sweep`) — and finds its grid, its restatement surfacing and its
`byId` readout exact while three edges of the readout are not.** `e68_holding_audit.js` (8/8 checks, 45 ms) confirms
the grid is the cartesian product `deadZones × scales × holdings` (`3×1×3` -> **9** policies, **18** rows for two
candidates; each policy `{...holding, deadZone, scale}`, a `null` holding collapsing to `{deadZone, scale}`); every
row's `turnover`/`grossPnl`/`netSharpe`/`breakEvenCostBps` equals a direct `restateReportAtPolicy(candidate,
policy)` recompute to **1e-9**; rows are non-increasing in break-even with a missing value last; `byId.best` is the
highest-break-even row for the id and `bestPromoting` the highest-break-even promoting row (`null` when none
promotes); `bestTurnoverPolicy` prefers promoting and returns `null` for an unknown id; the two bail-outs (a
baseline or candidate with no fold inputs) return `available:false` with a reason; and `formatTurnoverSweep`
renders the unavailable reason and, when available, every id plus the target. Three rows follow. **L10-cg** is the
actionable one: `turnoverSweep` accepts and **echoes** `costBps` but never passes it to `restateReportAtPolicy`, so
every row's net Sharpe / DSR and every promotion decision is at **zero cost** — a `costBps: 0` sweep and a
`costBps: 25` sweep are byte-identical apart from the echoed field (both `netSharpe` **0.6864950785702724** at
dz 0.1), while a direct restatement at 25 bps reads **−3.156645069841796**; the shipped caller passes the run's
`--cost-bps`, so a `--turnover-sweep --cost-bps=10` run prints cost-free Sharpes under a header that says
`costBps=10`. **L10-ch**: the `requireCleanAudit` hurdle the caller passes is **structurally inapplicable** because
`restateReportAtPolicy` drops the `audit` block (unlike its sibling `restateReportAtCost`), so a candidate that
**failed the run's look-ahead audit** still promotes (rebuilt with the audit attached, the same decision correctly
fails). **L10-ci**: `DEFAULT_TURNOVER_GRID` is only **shallowly** frozen (`Object.isFrozen(deadZones)` false), so
`deadZones.push(0.9)` takes the default sweep **48 → 54** policies. All three are latent/report-level — the module
only restates journaled inputs, so no scored number moves, and there is **no new fold-back row**.

**CYCLE-061 (F-77) turns the technique on the seed-replication layer — `analysis/replication.js` (shipped;
`analyze.js` aggregates `--seeds` into `replication.json`) — and finds the statistics exact while the citation and
the label are not.** `e69_replication_audit.js` (8/8 checks, 359 ms) confirms `interquartileMean` is the rank-slice
middle on every hand case (`[1,2,3,4]` → **2.5**, `[1..8]` → **4.5**, `[]` → NaN, `<4` → plain mean, non-finite
filtered, monotone); `stratifiedBootstrapCI` is deterministic per seed, seed-sensitive, preserves each stratum
size in every replicate (a probe statistic returning the sample length reads **12** for strata `[4,5,3]`), returns
`lo ≤ median ≤ hi` and abstains on empty / all-non-finite input; its empirical coverage of a known mean is
**0.92** (400 panels, nominal 0.95); `varianceComponents` satisfies `total = between + within + residual` (1e-9)
with the fractions summing to 1 in the pure-between-seed, pure-within-seed, repeated-cell and mixed panels;
`pairedVarianceRatio` is exactly `var(paired)/var(unpaired)` with `reduction = 1 − ratio`, abstaining on short /
zero-unpaired-variance input; and `seedDistribution`/`formatSeedReplication` carry and render the documented
fields. Two rows follow. **L10-cj**: the **IQM** drops `floor(n/4)` **by rank**, not a quarter of the **mass** —
witness `[0,0,5,10]` reads **2.5** vs the cited Agarwal et al. / `rliable` quantile-filter **1.6667**, and
**149/300** right-skewed panels differ (max gap **1.016**); the module is self-consistent, so it is the L10-by
class (an estimator that is not the one it names). **L10-ck**: `formatSeedReplication` prints its **own** `alpha`
in the CI label, never `dist.ci.alpha`, so a distribution built at `alpha = 0.10` is printed as **`95%CI`** (its
bounds the 90 % ones) unless the caller passes the alpha again. Both are latent/claim-level — the module is pure
and only summarizes an already-scored run, and the shipped path uses the default alpha throughout — and there is
**no new fold-back row**.

**CYCLE-062 (F-78) turns the technique on the cluster-inference module — `analysis/dependence.js` (shipped; the
delete-one-cluster jackknife behind the pooled cross-stream Sharpe SE, pure and importing nothing) — and finds the
statistics exact while a gate flag and a numeric edge are not.** `e70_dependence_audit.js` (10/10 checks, 47 ms)
confirms `pearsonCorrelation`/`meanPairwiseCorrelation` are the textbook formulas with the documented NaN guards;
the equicorrelation deff/effective size are exactly `1+(K−1)ρ` and `K/deff` (K = 1 → 1, non-positive deff
abstains); `foldWindowClusters` groups exactly (cluster f = every stream's fold f) and throws on a
non-rectangular / non-divisible / bad-panel input; `clusterJackknife` on `[[1,2],[3,4],[5,6]]` reproduces estimate
**3.5**, leave-one-out **[4.5, 3.5, 2.5]**, `se = 1.1547005383792515`; `studentTPValue`/`regularizedIncompleteBeta`
reproduce the exact df = 1 (Cauchy) and df = 2 closed forms to 5e-7 with `t = 0` → 0.5/1 and a symmetric,
two-sided-consistent tail; `studentTCritical` inverts the tail (**1.6895724578** / **2.0301079283** at df = 35;
table 1.68957 / 2.03011) and round-trips to 1e-6; `signTest` is the exact binomial tail (`7/10` → **0.171875**)
with `signTestFloor(n) = 2⁻ⁿ`; and the two paired cluster tests carry the documented fields (the sign test counts
per-cluster signs). Two rows follow. **L10-cl**: `clusterStability.stable` omits the `worstDelta > minDelta` half
of its own documented rule — with `minFraction 0.5`, `fractionPositive` **0.6667** and `worstDelta` **−0.5** it
reads `stable: true` where the doc rule says false (the two coincide only at the shipped `minFraction = 1`).
**L10-cm**: `signTest`'s `pmf0 = 0.5ⁿ` underflows for `n ≥ ~1075`, so `{wins: 1000, n: 2000}`, `{wins: 1, n: 2000}`
and `{wins: 2000, n: 2000}` all read **pValue 0** (a balanced 2 000-cluster test reading "certainly significant")
while `{wins: 500, n: 1000}` reads **0.5126**. Both are latent — the shipped `minStableFraction` default is 1 and
the documented cluster counts are tens to a few hundred — and there is **no new fold-back row**.

**CYCLE-063 (F-79) turns the technique on the decision-grade report — `analysis/decision.js` (shipped; the
six-block compositor behind `--decision`, pure) — the last lab-consumed analysis module — and finds every block
exact but one restatement-chaining defect.** `e71_decision_audit.js` (10/10 checks, 34 ms) confirms
`foldConcentration` reproduces a direct `strategyReturns`+`sharpeRatio` recompute to 1e-12 (top-K shares `8/9`,
`15/9`, `9/9`; signed sums; delete-one-cluster full **−3.5204429235768973**, min **−5.253810564276818**, max
**−1.6034020777212812**; per-fold marginals mean **0.023595765513707272**; a non-positive gross total → **null**
shares) with explicit-na abstentions; `confidencePersistence`'s pooled within-fold lag-1 (**0.666707822740828**)
and half-life (**1.709771604681528**) with no cross-fold pairs; `pairedUnitsNeeded` = the smallest cluster count
whose one-sided cluster-t resolves the target (**9** observed / **18** at 80 % power; brute-force agreement) with
`reference.pairedMde95 = tCritical(35,0.05)·0.08 = 0.13516579662244632`; `nextRunPlan`'s
`barsToDetectDependent = ceil(620·2.95) = 1829`, `clearsBps {0:t, 2:t, 5:t, 10:f}` and timing/cadence blocks; all
six `cheapestFlip` kinds; the `promotionAcrossCadences` majority-pass + `defaultCatastrophic` veto; and the
six-block `decisionReport` (`schema 'nl.decision.v1'`, referent/run label policies, explicit-na family blocks) /
`formatDecision`. One row follows. **L10-cn**: `restateReportAtPolicy` replaces `folds` with restated-position
metrics but carries the original `foldInputs`, so a policy-restated report handed to `foldConcentration` mixes
bases (restated net Sharpe **−5.201698358740081** vs the carried-signal Sharpe **−3.5204429235768973**); the
shipped `--decision` path restates at cost only (both halves agree at **−3.877740023296727**), so it is latent.
No golden moves and there is **no new fold-back row**. **This closes the pure-module backlog** — no lab-consumed
analysis module remains un-audited; future cycles open new leads.

**CYCLE-064 (F-80) turns the technique on the MODEL itself — the five pure numeric kernel bags under
`hivemind/kernels/` (`activations`, `linalg`, `normalization`, `sampling`, `statistics`; SHIPPED via
`gradients.js`/`transformer/*`, installed on `HiveMind.prototype`) — the first audit outside `analysis/`.** The
finite path is exact: `e72_hivemind_kernels_audit.js` (11/11 checks, 18 ms) confirms `_silu`/`_siluDerivative` =
`x·σ(x)`/`σ(x)(1+x(1−σ(x)))` (1e-12), `_sigmoid` = `1/(1+e^−x)` (1e-15, monotone), `_softmax` = `exp(a−max)/Σ`
with the uniform-on-non-finite / `[]`-for-empty / `out` contracts; the linalg helpers (dot/add/scale/sub/norm/
cosine/weighted-mean/proj-similarity); `_rmsNorm` = `x/√(mean(x²)+1e-6)`, `_applyRoPE` (identity at pos 0,
documented rotation at pos 1), `_normalizeSemantic` (RMS clamp); `_randomNormal` (Irwin-Hall(12), mean≈0 var≈1),
`_sampleDirichlet` (sums to 1), unit-norm LSH hyperplanes; and the statistics helpers — `_computeVariance` as the
documented MAD proxy (`[0,0,0,0,100]` → 10), `_computeEMA`, `_computeGradientConformity` (0.75 monotone, floored
0.5), `_computePercentile` (lower nearest-rank), `_computeSparseThreshold` ∈ [1e-6,1e-4], `_computeDynamicPercentile`
∈ [0.75,0.99], `_computeGradientNorm` = 5, `_computeSpectralNorm(diag(3,1,1))` = 3.0000, and the stateful
`_detectSuddenDrop`/`_isStagnating`. Four rows follow. **L10-co**: `_sigmoid`/`_silu` return **0** for
`+Infinity` — the `isFiniteNumber` guard runs before the `Math.min(Math.max(x,−100),100)` clamp, so a
maximally-positive logit reads as probability 0 (`_sigmoid(±100)` = 1 / 3.7e-44). **L10-cp**: the falsy-zero
family — `_computeGradientNorm`/`_computeSpectralNorm` → **1** for the zero vector/matrix and `_computePercentile`
→ **1.0** for a genuine 0 (`|| 1` guards feeding `gradients.js`'s threshold pool). **L10-cq**: the vector helpers
disagree on a length mismatch (`_fastVectorDot` → NaN, `_vectorDot` → 0, `_fastVectorAdd` → a copy of `a`).
**L10-cr**: two dead clamps (`_computeDualEMA` 0.8, `_computeNTKStability` −0.1) and `_computeFractalDimension` an
ad-hoc clamped dispersion (a constant series reads the maximum 2), not a fractal dimension. All four are latent
(non-finite / zero / degenerate-input edges; the golden suite pins the finite path) — no golden moves and there is
**no new fold-back row**.

**CYCLE-066 (F-81) is the register's first PORT VERIFICATION - the inverse of the audit experiments: the REPO must reproduce the LAB.** `PLAN-round31.md` / `ARCHITECTURE-v2.md` moved the shared book arithmetic and the three pinned sleeve specs into the repo (`src/core/primitives/*`, `src/plugins/sleeves/*`), so the lab's stored numbers are a claim about the repo only if the repo runs the same arithmetic on the same real data. `e73_port_verify.js` (10/10 checks) imports the repo modules read-only, rebuilds the lab's real 8-symbol / 6 557-period carry panel, and drives each sleeve through its `signal()`/`returns()`: all three published books come back **bit-for-bit** (rows and returns identical to the lab construction; R8 `6.18 / 10x / 46.04` = `e30`, R7 `1.07 / 8x / 182.59` = `e32`, OI `0.92 / 198x / 15.22` = `e50`), and the repo `cleanBook` is **fingerprint-identical** to `prototypes/port.js`. The verification exposed one new row, **L10-ct**: the lab's two construction shells read DIFFERENT arrays off the same `buildXsSeries` result (`legs.times` vs `times`, 6558 vs 6557), so they build on grids one period apart - the grid is a parameter, not a convention. Latent; no lab number and no repo number moves; **no new fold-back row** (the verification *is* the R7/R8 port evidence). **Post-verification (repo R31b, same round):** the repo's own bug/coherence pass then hardened the ported code — the fingerprint canonicalisation now matches the golden suite's string/`[fn]` rules, `turnoverSeries`/`ewmaUpdate`/`blendRows` apply the lab's `fin` guard, both book shells phase a `hold` policy on the same per-row counter, and the two sleeves' `returns()` use the builder's clamped start (`max(1, from)`, so a `from: 0` caller is no longer off by one). `e73` was re-run after those edits: still **7/7**, all three books bit-for-bit, no repo number moved (every hardened path is the non-finite / `hold` / `from: 0` edge, unreachable from the lab's real data). **Post-verification (repo R31c, same round):** a second coherence pass over the same layer found three more defects, all of the same "the guard is in the wrong place / the hardening missed a sibling" class: (a) `dlogMatrix`'s `!series` guard was **dead** — it sat inside the `.map` callback where `series` is always the array being mapped — so a symbol with no records at all threw on `.map` instead of yielding a `null` column, which is what e21's `dlog(arr, i)` (`if (!arr) return null`) produces one index at a time; the guard now sits at the outer level and `buildCrossSectionalBook`/`firstCommonIndex` mask such a column like a wholly-missing symbol; (b) `blendBooks` — the function the OI sleeve actually calls — lacked the `fin` guard its siblings `blendRows`/`ewmaUpdate` carry, so an `Infinity` leg injected `NaN` into the 50/50 blend (`normalizeL1` then divided by `Infinity`); (c) the contract kernel spread a non-array `requires` (the string `'fit'`) into its CHARACTERS, silently declaring methods `'f'`/`'i'`/`'t'`. Port fidelity was then re-checked by a **differential fuzz now ROLLED INTO `e73` itself** (a new randomized half: **250 seeded panels**, groups `fuzzBooks`/`fuzzWeights`/`fuzzMisc`, every ported primitive against the LAB module it was ported from — `e17#buildBook`/`e17#rankWeights`/`e17#levelWeights`, `e21#xsBookImpl`, `e22#buildMasked`, `port.js#cleanBook`, `e16#turnoverSeries`, `e21`'s `dlog`, and the repo's own `blendRows`∘`normalizeL1` identity) → **zero divergences**, so the repo still runs the lab's arithmetic exactly and `e73` now reports **10/10 checks** (7 → 10; the step count is unchanged). Re-run after the edits: all three books still bit-for-bit (`6.18 / 10x / 46.04`; `1.07 / 8x / 182.59`; `0.92 / 198x / 15.22`), no lab number and no repo number moved (five new repo checks; ledger 2736 → 2741).

## Next actions

1. ~~**L10-d** (carry-grid alignment)~~ — **SETTLED in CYCLE-044 (F-61)**: the check R4 pre-registered in
   CYCLE-006 was run. (a) the candle-tail guard: `carryOnBarGrid` never projects a funding row before the
   first bar, and the funding file's 5-day tail past the candles is simply never reached (no frozen-spot
   risk in the funding-only sleeve); (b) **sub-8h aggregation is MISSING** — L10-aa/ab/ac; (c) exact bar
   alignment: the ISO/ms coercion is present, and the "most recent closed period" convention is causal (a
   one-period *lag*, not a look-ahead — see L10-ad). The fix, if the repo wants it, is to bucket rows into
   `gridMs` sums before projecting.
2. **L10-ad** (NEW, open) — `carryOnBarGrid` attributes a funding payment to the bar that *opens* at the
   payment time, i.e. it credits the payment to the interval *after* the one that earned it (the repo's own
   test pins `gridCarry[0] === 0` for a bar opening exactly at the first funding timestamp). Causal, but a
   one-period (8h) **lag** relative to a hold-from-bar-open convention; quantify the effect on the sleeve's
   correlation with the price basket before calling it a defect (it may be the intended convention).
3. ~~**L10-f** (`effectiveBars` bound)~~ — **SETTLED in CYCLE-045 (F-62)**: `effectiveBars` is **unbounded**
   (a hedged pair → DE 4.7e−32, ~3.4e34). ~~**L10-i**~~ — **also settled**: the DSR path declines to adjust
   when `effectiveBars < 2` or `≥ n`, which is intended. New open row **L10-ae** (the path cannot distinguish
   hedging from degeneracy; a `max(DE, 1/K̃)` floor or an `effectiveBars ≤ n` clamp would fix it).
4. **Turn the synthetic-ground-truth technique on the other pure analysis modules** the lab consumes:
   ~~`splits.js`~~ (done — `e55`, F-63), ~~`labels.js`~~ (done — `e56`, F-64),
   ~~`overfitting.js`~~ (done — `e57`, F-65), ~~`reality_check.js`~~ (done — `e58`, F-66),
   ~~`forecast.js`~~ (done — `e59`, F-67),
   ~~`race.js`~~ (done — `e60`, F-68),
   ~~`benchmark.js`~~ (done — `e61`, F-69),
   ~~`backtest.js` + `performance.js`~~ (done — `e62`, F-70: the measurement layer, incl. the instrument's
   error bounds, the closed-form identities and the bootstrap calibration),
   ~~`features.js`~~ (done — `e63`, F-71: the causal signal family, the causality + abstain contracts and all
   16 candidates, incl. L10-bs…L10-bv),
   ~~`uniqueness.js`~~ (done — `e64`, F-72: the average uniqueness + ESS exact against independent references,
   the sequential bootstrap's draw law pinned, incl. L10-bx…L10-bz),
   ~~`streams.js`~~ (done — `e65`, F-73: the resampler + Kish design-effect identities exact, the greedy
   selector's contract exact, incl. L10-ca…L10-cb),
   ~~`world.js`~~ (done — `e66`, F-74: the shock + candle view exact, the panel attachment and `maxBars`
   boundaries pinned, incl. L10-cc…L10-cd),
   ~~`parallel.js`~~ (done — `e67`, F-75: the order-preserving scheduler exact, the queue/failure/executor
   contract pinned, incl. L10-ce…L10-cf),
   ~~`holding.js`~~ (done — `e68`, F-76: the turnover policy grid + the restatement surfacing + the
   ordering/`byId` readout exact, incl. L10-cg…L10-ci),
   ~~`replication.js`~~ (done — `e69`, F-77: the IQM, the stratified bootstrap, the variance decomposition and
   the CRN criterion exact, incl. L10-cj…L10-ck),
   ~~`dependence.js`~~ (done — `e70`, F-78: the correlations, the equicorrelation identities, the fold grouping,
   the jackknife, the Student-t tails and the exact sign test exact, incl. L10-cl…L10-cm; note `e54` covered
   `walkforward.js#dependenceSummary`, not this module). ~~`decision.js`~~ (done — `e71`, F-79: the concentration /
    persistence / power / cadence-promotion blocks and the six-block report exact, incl. L10-cn) — so **no
    pure, lab-consumed analysis module remains un-audited.** CYCLE-064 extended the technique outside `analysis/` to the model's own `hivemind/kernels/*` (F-80); the remaining un-audited pure surfaces are `hivemind/memory/*`, `hivemind/transformer/*` and `observer/*`.
   `e57` (PBO), `e58` (resampling) and `e59` (forecast) are the templates: build an input with a
   **known** answer, run the
   repo function, assert the closed form with a seeded ensemble and a 2.5-SE band (for a *leakage* or
   *contract* claim, the closed form is an exact count/structure, no randomness needed; for a *statistic*,
   also match an independent reference implementation).
4b. ~~**L10-ag follow-up (F-63 → R9)**~~ — **SETTLED in CYCLE-047 (L10-ah)**: F-63 is **latent** on the
   shipped path (the controller trains online, fit stops at `testStart−1`, labels are realised at the
   trade's exit) → R9 downgraded to latent / low-priority. The follow-up audit of **`labels.js`**
   (`tripleBarrierLabels` / CUSUM / fractional diff) is **done in CYCLE-048 (F-64)** — the module is
   correct on its contracts, its five warts are all **latent** because only `fractionalDiffWeights` is
   shipped (L10-ao), and no fold-back row was needed.
5. ~~**L10-e** (the feature `closes` contract)~~ — **SETTLED in CYCLE-055 (F-71)**: the plural `closes` is
   load-bearing; a singular `{close}` series abstains (`rangeLocation` NaN, `positionAt` 0).
6. **L10-h** — any R1–R8 port must state its golden movement.
7. A confirmed item becomes an `F-<n>` or an erratum, and — if it touches shipped behaviour — a
   `FOLD-BACK.md` row. Add the settling measurement to `e14` so it cannot regress.
8. **Audit the board itself** (L10-t). Before starting a lead, grep the `results/` artefacts for the
   object the lead claims is unmeasured; L13 was already measured for 15 cycles. A lead's status line is
   a claim like any other.

## Log

* **CYCLE-000** — L10-a, L10-b confirmed (F-11, F-01); register opened.
* **CYCLE-001** — register formalised with a settling measurement per row.
* **CYCLE-002** — **L10-c resolved** (F-13: the window effect survives the repo's own aggregation) and
  **L10-g scope-confirmed** (stored candles discard taker volume); two lab-local defects found and
  fixed (**L10-j** `tail` derived-array slicing, **L10-k** the `e7` sign inversion).
* **CYCLE-006** — five new rows. **L10-l** integer-quantised marks, **L10-m** the frozen-spot tail,
  **L10-n** ragged candle bars bridged by a lenient lookup, **L10-o** sub-8h funding collapsed by
  `roundGrid` (SOL 2022-11-09→18, the FTX crash), **L10-p** `serialDesignEffect` outlier fragility.
  All four data bugs plus the inference one are now covered by `e14_data_integrity.js`, which runs in
  `run_all` and reports `pass`. Together they had understated the flat carry Sharpe by ~9.5× (F-18).
* **CYCLE-017** — one new row. **L10-u**: the first draft of `e25#simBook` (the maker replay) used
  `close.length` — 8 symbols — as the bar count, so its "book" was five periods long and its taker
  validation read a fabricated −2.5 Sharpe. Caught by the `validation` guard (the taker model must
  reproduce E24's `rank_w1_rev`); the guard is now permanent in `e25`. First row found *by a test* rather
  than by inspection.
* **CYCLE-016** — two new rows, both non-code. **L10-s**: the P3 reversal family's stated justification
  ("the edge lives in SIGNS rather than magnitudes") is **contradicted** by direct measurement — the IC of
  `−r[t]` is ~2× the IC of `−sign(r[t])` at both 1h and 15m (F-33); documented only, no shipped behaviour
  moves. **L10-t**: L13's status line said the experiment was "to build" while `e2` had scored the arm at
  both timeframes since CYCLE-001 — a **stale lead status**, settled by `e24_reversal.js` (which
  reproduces `e2`'s number to 4 decimals). Lesson recorded in the audit's next actions: audit the board,
  not just the repo.
* **CYCLE-013** — two new rows. **L10-q**: a book-grid signal scored against the *contemporaneous* leg
  (`legs.spotRet[i+1]`) instead of the next (`[i+2]`) read IC 0.595 / Sharpe 17 for open interest,
  because OI *notional* embeds its own window's price move. Fixed with an explicit `NEXT = 2` and a
  contemporaneous-vs-next lag profile; the convention is now in `RUNNER.md`. Same F-11 class as L10-a —
  the audit's second look-ahead catch. **L10-r**: the cross-sectional books zeroed missing signals and
  then demeaned, giving the *absent* symbols a large weight in the early window (the positioning fields
  start 2021-12 for 7 of 8 symbols). Books now mask absent symbols and run on the common window. Found
  while challenging F-28's own conclusion — and the corrected book exposed **F-29** (a real toptrader
  signal the level-IC screen had hidden).
* **CYCLE-018** — one new row. **L10-v**: the first draft of `e26#causalOos` used the BAR INDEX `rows[i].t`
  as a timestamp for the horizon purge, so the cutoff preceded all data by ~1.6×10¹⁰ ms, no block had
  enough training rows, and every prediction was `NaN` (the summary read `brierSkill: null`, which is how
  it was caught). Fixed by carrying `time` alongside the index. **Lesson added to the register: a metric
  that returns `NaN` is a broken pipeline, not a null.** With L10-u (CYCLE-017) this is the second
  consecutive cycle where the defect was caught by a *guard* rather than by inspection.
* **CYCLE-024/025** — two **statistic** rows. **L10-w**: the OI "capacity" was `f·mean(OI)/mean|w|` — a ratio
  of *means* (average-case) — instead of the desk's `min_t(OI/|w|)` (a *min of ratios*); they differ by
  **2.6–8.8×** (F-41). **L10-x**: the min-of-ratio then admitted a period if *any* traded symbol had an OI
  print, so a partial set exploded to a **$936 B** bound at 2021-11-04; a capacity is only defined where
  **every** traded symbol has a print (F-42). Both are the same class: quote the object the constraint is
  on, not an average of its parts.
* **CYCLE-030** — one **measurement-basis** row. **L10-y**: the lab's sleeve-mix convention (F-31/F-43,
  `e23`/`e27`/`e35`) mixed return series by **capital fraction** without risk-normalising, but the
  basis+funding carry book earns ~**0.4 %/yr** vol per unit gross while the spot-based fade and OI books are
  **13.6 %** and **24.3 %** (**31–55×**), so any capital weight on a spot sleeve simply injects its vol.
  Risk-normalised (`e39`), the max-Sharpe weight on the fade is **0.13** and on the OI **0.10**, and a
  3-stream unit-vol mix reads **6.58** vs carry-only **6.48** — the tangency gain is ~+0.10 Sharpe, not the
  ~−5 the capital convention implies. F-43's direction stands; its magnitude is a vol-basis artefact.
  **Lesson: a capital-fraction mix of books whose per-gross P&L scales differ by 30–50× measures the vol
  ratio, not diversification — risk-normalise, or state the convention.**
* **CYCLE-031** — one **draft-guard** row. **L10-z**: `e40`'s first validation guard compared a
  `toFixed(3)` Sharpe against `e30`'s `toFixed(2)` one using a **relative** 5e-4 tolerance, so it failed on
  a *correct* book — the artefact's 2-dp storage alone (6.184 vs 6.18) is a 6.5e-4 relative gap. Now an
  **absolute** 0.01 test. Like L10-u/v, caught by the guard itself before its finding shipped; the lesson
  is that a guard's *precision* is itself a specification — never tighter than the artefact it reads.
* **CYCLE-044** — four rows, and the audit's **first shipped-path arithmetic defect**. **L10-d** (opened
  CYCLE-000 as "alignment") is **settled**: the repo's `carryOnBarGrid` join has no candle-tail or
  alignment bug but **no sub-8h aggregation**. **L10-aa** (CONFIRMED): the projection divides every funding
  row by the *default* 8h bar count rather than the observed interval, so sub-8h funding is understated
  `8h/interval` — **1×/2×/4×/8×** measured on a synthetic 8h period at 8h/4h/2h/1h funding. On the shipped
  data the only sub-8h symbol is SOLUSDT (**3 × 4h + 98 × 2h** steps, FTX 2022-11-09→18); its FTX window
  receipts **−0.107** (shipped) vs **−0.324** (bucket-summed) = **3.03×**, and the pooled 8h sleeve reads
  ann **9.985 %→9.531 %**, Sharpe **11.96→9.60** — the defect **flatters** the sleeve, so no "implausibly
  large" alarm could catch it (the F-18 direction trap). The module's header comment ("the bar-grid
  projection divides by the period actually observed") is **false of the code**. **L10-ab** (LATENT): a
  single-pair `barsPerPeriod` inference doubles a symbol's carry if its first two bars straddle a gap (all
  shipped first pairs are modal today). **L10-ac** (LATENT): `auditFundingProblems` is blind to interval
  changes — SOL's 98 2h steps are 1.47 % of the file (under the 2 % off-grid budget) and shorter than the
  grid (so not `missingPeriods`), and the audit returns `[]`. The lab's loader is unaffected (it buckets
  rows first, L10-o) and is now pinned by `e14` check 13 `sub_8h_sleeve_equality`; **R4** records the port
  requirement. Register note: `e53_carry_grid_audit.js` is the audit's first experiment that measures the
  *repo's own* function against a synthetic ground truth, so a repo-side fix now fails a guard loudly.
* **CYCLE-045** — the audit's first **positive validation** of a repo statistic, and two rows settled.
  **`e54_dependence_audit.js`** audits the dependence/DSR backbone (`dependenceSummary` →
  `effectiveBars` → `backtestMetrics`) against **closed forms**: ensemble means match the survey-sampling
  design effect `1+(K−1)ρ`, `K` (identical streams), `1+ρ` (negatively correlated pairs) and the i.i.d. null
  1 to within 2.5 SE (max gap **0.318**, **0 biased rows**) → **the estimator is unbiased**, so F-02's
  real-basket DE 4.92 is the estimand it claims. **But the calibration is the finding:** on true-i.i.d. data a
  single reading at the repo's own C = 36 folds spans **0.644–1.452** (sd **0.243**) and at C = 288 spans
  0.899–1.231 (sd **0.097**) — so a two-decimal `designEffect` (F-02, F-47) overstates resolution ~10× and a
  single `adjustmentNeeded` verdict within ~1 ± 0.25 of the gate is not resolvable. **L10-f** settled: the
  bound does not exist — a ρ = −0.5 pair reads mean DE **0.506** with `effectiveBars > rawBars` in **25/25**,
  and a perfectly hedged pair gives DE **4.7e−32** → `effectiveBars ≈ 3.4e34` while `adjustmentNeeded` reads
  **false** (DE is a **squared** ratio, so `> 0` is not a bound). **L10-i** settled: `backtestMetrics`'
  `2 ≤ effectiveBars < n` clamp declines the explosion and returns `nEff`/`dsrAdjusted` = `null` — declining to
  inflate is **intended**, not a defect, though it is lossy (a hedged panel and a degenerate one both read
  `null`). New row **L10-ae** (that unbounded limit). Register note: `e54` is the **second**
  synthetic-ground-truth experiment on a repo function (after `e53`/F-61), and its **closed-form + seeded
  ensemble + 2.5-SE-band** method is now the standing recipe for auditing any statistic.
* **CYCLE-046** — the split family's purge contract, audited with a **closed-form label-overlap ground
  truth**. **`e55_split_audit.js`** shows `purgedKFoldSplit` and `combinatorialPurgedSplit` are leak-free on
  every fold of a synthetic grid (0 overlap pairs; embargo `(purgeEnd, embargoEnd]` honoured; CPCV test
  multiplicity exactly `C(k−1,m−1)`) — the contract holds for them. But **`walkForwardSplit`** (the path the
  repo A/B and the lab's F-13 use) performs **no purging or embargoing**: it has no
  `labels`/`labelSpan`/`embargo` parameters (passing them returns byte-identical folds) and its folds carry
  no purge metadata, so for a label horizon H > 1 the boundary leaks exactly **`H(H−1)/2`** train/test
  label-overlap edges per fold (H=5 → 10/fold; 120 edges at testSize 40; **0** at H=1). **L10-af**
  (confirmed, live for H>1): `isCausalFold` is an index-order check and passes every leaky fold (a
  look-ahead-in-time check, not a leakage check), and an index-lookup model recovers test-period returns in
  the leak zone (**+0.0035**/bar, se 7e−5, vs **0.0000** clean / **+0.0001** purged). **L10-ag**
  (confirmed, claim overstated): the lock-registry note claims "zero label-window leakage" for the *family*,
  but the tests assert it only on the purged variants — the L10-t lesson again. The lab scores parameter-free
  signals (span 1 → no leak), so no lab number moves; the shipped controller trains on horizon labels, so
  the precondition is met on the shipped path. **FOLD-BACK R9 (candidate)**: accept label spans and drop
  training labels overlapping the test window — the purged K-fold's own rule, applied to the walk-forward.
* **CYCLE-047** — **F-63 scoped: the leak is LATENT, not live (L10-ah).** A code trace (no new experiment)
  resolves the follow-up: the shipped controller is **online** — `analyze.js#makeControllerModelFactory` fits
  a fold by replaying bars `1 … testStart`, each call seeing only a window ending at `i−1`
  (`analyze.js:1018`), so the last training bar is **`testStart−1`** and the fold's declared `train` list is
  ignored — and `hivemind/controller/trades.js` labels a trade by its outcome at the **exit** bar, with only
  *closed* trades entering training. So every training label is realised at an exit `≤ testStart−1`, causally
  before the test, and the leak (which needs a training label realised inside the test window) cannot occur —
  even though the labels *do* overlap (`heldBars {mean 8.30, max 54}`). **F-63 amended (latent); FOLD-BACK
  R9 downgraded to latent / low-priority**; the `e55` guard stays so a future **fixed-label offline** model
  behind `walkForwardSplit` cannot silently inherit the leak. The register's first **negative scope** on a
  shipped-path alarm — a confirmed defect is not finished until its *reach* is measured.
* **CYCLE-048** — the synthetic-ground-truth sweep continues onto the **labelling module**; five new warts,
  all latent. **`e56_labels_audit.js`** audits `analysis/labels.js` against **closed forms** and passes
  **23/23** guards: `tripleBarrierLabels`' first crossing is exactly `ceil(level/step)` on **192** monotone
  cases and the three-way `ret` / first-crossing / timeout-index contracts hold on **60** seeded random
  paths (with `ret` shown to be a **realised price change** — the touch bar overshoots the barrier level
  **1362** times on gaps); `cusumFilter` matches an **independent** drawup/drawdown formulation of its reset
  rule on **160/160** grid rows and **12/12** monotone closed forms; `fractionalDiffWeights` matches
  `(−1)^k C(d,k)` for integer `d` (1e−12) and against an independent **Lanczos-`Γ`** for non-integer `d`
  (max rel. err **2.3e−14**); and the one **shipped consumer** (`features.js#fracDiffAt`/`fracMomentum`)
  equals the weights convolution exactly. **Five warts:** **L10-ak** — the `pt`-before-`sl` tie-break is
  **unreachable for `vol > 0`** (0 of 6 bars satisfy both) and degenerate at `vol ≤ 0` (at `vol = 0` the
  barrier collapses to a **one-bar sign label** and a flat series labels **11/12** events **+1 at
  `ret = 0`**); **L10-al** — the default event set emits a **zero-horizon** `{t1 = event, label 0, ret 0}`
  bet indistinguishable from a vertical timeout (exactly `H` events also get a truncated vertical barrier),
  and the repo test asserts only `t1 >= event`; **L10-ai** — `cusumFilter` **ignores its `events`
  argument** (byte-identical output); **L10-aj** — its `lastEmit` guard is **dead** (`t !== lastEmit` is
  always true; the guard-free reference matches exactly); **L10-am** — the "`size <= 0` uses
  `DEFAULT_FD_WINDOW`" docstring is **false** (auto widths **1/2/3/4** for `d = 0/1/2/3`; only `d = 0.4`,
  the one the repo test samples, is 100). The cycle also **killed a candidate**: **L10-an** —
  `fractionalDiffWeights(0, 0)` is **`[1]`** and `fractionalDiff(series, 0, 0)` the **exact identity with no
  NaN**; the width-2/NaN-at-0 case is `d = 1`. **L10-ao** (scope trace) is what makes every wart latent:
  only **1 of the module's 6 exports** is on the shipped path (`fractionalDiffWeights` via `features.js`),
  the rest being **test-only** (the shipped controller labels trades in `hivemind/controller/trades.js`).
  **L10-ap** (calibration): the shipped arm uses `window 16` at `d = 0.4` where the module's own auto rule
  is **100**, and `k ≥ 16` carries **6.27 %** of the `|w|` mass. No shipped behaviour moves, no new
  fold-back row; `run_all` is now **64 steps, 32 gated, 0 fails**.
* **CYCLE-049** — the pure-module sweep continues onto the **PBO / CSCV** estimator; the structure is exact
  and the calibration figure is one draw. **`e57_overfitting_audit.js`** (29/29 guards, 11 s) verifies every
  claim in `docs/LOCKED.md`/`lock-registry.js`: `cscvBlocks` partitions exactly (7/7 cases), `cscvSplit`
  yields exactly `C(S,S/2)` splits (each a disjoint cover, each block in exactly `C(S−1,S/2−1)` in-sample
  sets, closed under complement, cap: `C(22,11) = 705432` **throws** / `C(20,10) = 184756` passes),
  `relativeRank` matches best `N/(N+1)`, worst `1/(N+1)`, full tie `1/2` and average tie ranks, and
  `oosOnIsRegression` matches an **independent sum-formula OLS** (40 vectors, 1e−9). Constructed PBOs are
  exact (all-flat **1**, one dominant strategy **0** with the IS winner `j=0` in all 252 splits, an
  anti-persistent pair **1** with slope ≈ −1, a hand-computed metric override **0.5 / 1.0**), and PBO is
  exactly invariant under annualisation and positive per-column scaling. **The quoted calibration reproduces
  exactly** — with the repo's own RNG at seed 20240: **PBO = 117/252 = 0.46429**, slope −0.0936 — but the
  ensemble (60 i.i.d. matrices) centres at **0.4769** (se 0.0329) with **sd 0.2546** (p05–p95
  **0.099–0.885**) against a binomial split SE of **0.0315** → a split **design effect of 65.4** and
  **≈ 3.9 effective splits** (**L10-at**), so a PBO quoted to 2–3 decimals overstates resolution ~8× (the
  F-62 lesson one level up). Four more rows: **L10-aq** — `relativeRank` skips non-finite values in the rank
  but divides by the full `n` (`3/5` vs `3/4`), depressing `omega` and biasing PBO **up** for a
  `NaN`-producing metric; **L10-ar** — a **fully-tied** roster (all-flat / all-identical) is forced to PBO
  **exactly 1**, while *partial* duplication does **not** bias it (paired means **0.5806 → 0.5671 →
  0.5401**, sign 6/10) — the pre-registered mechanism guess is **falsified**; **L10-as** — `degradation`
  returns `n = N·splits = 2016` dependent pairs over only `N·S = 80` block performances, so a naive
  `t = sqrt(r²(n−2)/(1−r²))` exceeds 1.96 on **91.2 %** of skill-less matrices; **L10-au** —
  `cscvBlocks(6,6)` alone yields six **1-observation** blocks (only the PBO entry enforces `blocks ≤ T/2`).
  **L10-av** is the scope: **no shipped module imports `overfitting.js`** (tests + lock-registry only), so
  every row is latent and there is **no fold-back row**. `run_all` is now **65 steps, 32 gated, 0 fails**.
* **CYCLE-050** — the sweep reaches the **resampling hub**, the one module family that is *partly* shipped,
  and finds its **live primitives exact**. **`e58_reality_check_audit.js`** (39/39 checks, 5.6 s) verifies
  every exact identity: `stationaryBlockIndices` at `b=1` is **byte-equal to an independent hand replay** of
  its rng stream and is i.i.d.-with-replacement, its restart law is geometric (`P(restart) ≈ 1/b`, mean run
  `≈ b`, within 2.5 SEs), and `neweyWestSE` matches an **independent Bartlett implementation** on 24 windows
  × bandwidths (1e−12); RC = `sqrt(T)·max mean` (a constant benchmark shifts it by exactly `−sqrt(T)·b`),
  SPA = `max(0, max fbar/ω)` (bootstrap SE independently recomputed), `A_k = ω_k·sqrt(2 log log T)` exact,
  consistent == upper recentring when all candidates are valid, the step-down's **first step is bit-equal to
  the consistent SPA**, and the subsampling family shares **one** reference (k-FWER `k=1` == step-down first
  p == consistent SPA p), is deterministic, and is segment-aware (`groups=[T]` bit-identical to ungrouped).
  It also reproduces the arch AR(1) reference vector (**13.635665 / 15.608940**) from an **independently
  implemented NumPy legacy-RandomState(0) stream**. Four rows: **L10-aw** — `politisWhiteBlockLength`
  returns **exactly 0** when its flat-top long-run `g ≤ 0` while the referenced
  `arch._single_optimal_block` **squares `g`**, so over 200 AR(−0.5) T=400 draws the repo reads 0 in **198**
  and arch a positive length (e.g. **22.0** at `g = −0.858`), making `autoBlockLength` floor to **1 (i.i.d.)**
  on 99/100 — the automatic block bootstrap silently degrades to i.i.d. resampling on anti-persistent data,
  and the comment's floating-point-agreement claim is false for `g ≤ 0`; **L10-ax** — the `median` arm
  reduction is the **upper** median on even `K` (**4.84761** vs **4.25907**); **L10-ay** — the `neweyWestSE`
  `v < 0` clamp is **unreachable** (Bartlett PSD quadratic form; exhaustive ±1 search up to length 18 × every
  bandwidth + 3000 random windows → minimum taper exactly 0); **L10-az** — scope: the block-bootstrap family
  is **test-only**, only `stationaryBlockIndices` (via `forecast.js`) and `neweyWestSE` + the four
  subsampling procedures (via `walkforward.js`) are shipped, and those are exact. Calibration independently
  re-measured: subsampling SPA holds 5 % size across the persistence sweep
  (**0.040/0.045/0.045/0.030** for φ = 0/0.2/0.5/0.8) vs the block bootstrap's **0.385** at φ = 0.8. **Lab
  bug fixed:** `e56`/`e57` never exposed `verdict.validationPass`, so `run_all` left their `pass`
  **undefined** since CYCLE-048/049 — two validation suites were reported but **not gated**; both now return
  it. `run_all` is now **66 steps, 35 gated, 0 fails**.
* **CYCLE-051** — the sweep reaches **`forecast.js`, the SHIPPED forecast scoring layer** (analyze.js runs
  the block by default), and finds its **arithmetic exact against the repo's own second Murphy
  implementation**. **`e59_forecast_audit.js`** (33/33 checks, 5.0 s) verifies `forecastPairs` IS the
  exact inverse of `confidenceFromProb` (1e−12) + next-bar sign + fold-last-bar drop + non-finite skip;
  `brierBinIndex`/`brierScore`/`logScore` are the closed forms with the documented clip/NaN handling; the
  Murphy partition satisfies `brierBinned = REL − RES + UNC` (1e−17); **`observer/legion_metrics.js`'s
  independent second `brierDecomposition` agrees on REL/RES/UNC/Brier to 1e−12** and its explicit `within`
  equals forecast's raw-minus-binned gap to **1e−17**; `bootstrapMeans` is deterministic
  (`max(1,floor(cbrt(T)))`, one paired index draw, reports its block); the DM statistic is exactly
  `dbar/boot-SE` with the documented degenerate arms (zero → 0/1/null, constant positive → Infinity/0),
  i.i.d. size **0.0525/0.1075**, and the block bootstrap controls φ=0.5 size where `blockLength=1` does not
  (**0.095** vs **0.135**); the MCS eliminates a uniformly worse arm, keeps an identical pair, **always
  contains the sample-best** (800/800), is deterministic, monotone in confidence and covers
  **0.880/0.855/0.865/0.925** (lower edge of the 2.5-SE band). Five rows: **L10-ba** (headline) — the
  comment's claim that the raw-minus-binned gap *IS* the within-bin forecast variance is **false**; the
  exact identity (the repo's own `observer/legion_metrics.js`) is
  `gap = WITHIN = withinVar − 2·withinCov`, and the gap is **negative on 5/6** configs while `withinVar > 0`
  (T=64/bins=1 **−0.0531** vs **+0.0774**), wrong by up to **0.13**; **L10-bb** — the `forecastComparison`
  alignment guard checks bar **counts**, so a count-coincident misalignment is silently paired index-wise
  and the DM verdict **flipped in 6/6** crafted witnesses; **L10-bd** — `groupOf` maps `benchmark` to the
  **baseline's** kind, so with a `'signal'` baseline a calibrated-probability benchmark joins the z-score
  group and gets a DM test (contradicts the `reader`/`docs/LOCKED.md`; **unreachable from `analyze.js`**,
  reachable through the exported API, untested); **L10-be** — the MCS elimination denominator is `sd(L_i)`,
  not HLN's `sd(d_i)` (up to **77×** apart, **0/150** set or order changes → inert); **L10-bc** —
  `bootstrapMeans` silently NaNs on unequal-length series and the MCS returns `available:true` for a
  NaN-containing series (latent, export-level). **L10-bf** is the negative control: the calibration battery
  **upholds** the module (a probe's 0.82 MCS-coverage reading was Monte-Carlo noise; band ±0.053 at R=200).
  No fold-back row (docstring/branch/export level). `run_all` is now **67 steps, 36 gated, 0 fails**.
* **CYCLE-052** — one new row family. **F-68 / `e60_race_audit.js`** (18/18): the successive-halving racing
  engine's closed forms and contracts are exact, but **L10-bg** — the docstring/`docs/LOCKED.md` claim that
  "a racing budget does not change the decided set" is a **tautology** on the §AM fixture (its
  `evaluate = q ± 0.05/budget` ranks every budget identically, `rank(1)==rank(9)`, and its top rung 3 < the
  oracle's budget 9) and **false** on a budget-dependent evaluator (the race discards the top-budget best on
  **0.617/0.617/0.700/0.625** of seeded fixtures); **L10-bh** — `spentBudget > gridBudget` once the budget
  ratio is small (up to **2.89×**); **L10-bi** — small-`eta` integer rounding repeats rungs (15/25 at
  `eta=1.1`); **L10-bj** — `eta`/`minBudget` are unvalidated (silent `available:true`, `winner:null`);
  **L10-bk** — scope: engine-only/test-only (no `--race` flag), so every row is latent. No fold-back row.
  `run_all` is now **68 steps, 37 gated, 0 fails**.
* **CYCLE-053** — one new row family. **F-69 / `e61_benchmark_audit.js`** (12/12): the shipped **P1
  model-class benchmark** (`analysis/benchmark.js`) — its contracts hold (standardiser exact; `fitRidge`
  matches an independently solved centred ridge to **0**; base rate = prior; MLP deterministic; factory
  refusals; a perfect classifier beats the base rate on Brier), but **L10-bl** — `fitRidge` computes the
  training base rate `ybar`, centres the target on it, and **`predictRidge` never restores it**, so the
  ridge arm's probability is anchored at 0.5 (a constant-`y` fold reads exactly **0.5**; a 0.833-base-rate
  fold reads mean **0.50**, Brier **0.22475** vs **0.13533** with `ybar` restored) and the shipped test
  (accuracy only, a 0.5 threshold) cannot fail; **L10-bm** — the sigmoid of a bounded [0,1] least-squares fit
  confines the arm to `sigmoid([-1,1])` (perfect feature → Brier **0.1425** floor; constant-y MLP → **0.99**);
  **L10-bn** — the "ridge closed form matches a hand-computed solve" claim is **unverified** (the closed form
  is exact, but no shipped §P1 check does a hand solve); **L10-bo** — the eps constant-column fallback maps a
  one-unit train→test deviation to `z = 1e8` (latent). *Lab bug (from the same probe discipline):* a first
  draft of the audit's own label generator used a float-crippled LCG (`s*1664525 >>> 0` loses low bits), which
  biased the synthetic base rate; replaced with `mulberry32` — the base rate then matches the requested one to
  3 decimals. No fold-back row. `run_all` is now **69 steps, 38 gated, 0 fails**.
* **CYCLE-054** — one new row family. **F-70 / `e62_backtest_audit.js`** (26/26): the **measurement layer**
  (`analysis/backtest.js` + its instrument `analysis/performance.js`), the two modules every pooled
  `report.json` number flows through. Both halves are validated against **independent references**: `erf` vs
  an independent **Simpson quadrature** (max err **1.393e-7**, inside A&S's 1.5e-7) with `normalCdf(0) = 0.5`
  exactly and odd; `normalInvCdf` round-tripping **2.46e-10** against a **Lentz-erfc** reference (inside
  Acklam's 1.15e-9) and antisymmetric to 2.8e-14; the moment conventions exact (`kurtosis([1..5]) = 1.7`,
  `stdSample = √2.5`); the Lo (2002) SE = `√(1.5/99)`; PSR **exactly 0.5** at its own benchmark; DSR = PSR at
  the expected-max hurdle to **1e-15** (and ≤ PSR; `expectedMaxSharpe` reproduced to 5.1e-11, ∝ √V, monotone);
  MinTRL = **13.1749455166** vs the documented 13.174945 and an independent recompute; the stationary
  bootstrap size-calibrated on **1000** noise series (**5.9 %/11.0 %**, mean p **0.502** — the repo's 5.8 %
  claim reproduced); the backtest arithmetic recomputed exactly (positions/turnover/gross/cost/net/equity/
  drawdown/tradeCount/the break-even identity); `poolFolds` restating the per-fold sums; and
  `purgedCVBacktestAsync` **byte-identical** to serial. Three rows. **L10-bq** — `hitRate(strategyReturnSeries)`
  receives only returns, so its "bars with no position are excluded" docstring cannot be implemented; the code
  skips `r === 0`, dropping a zero-return in-market bar (**0.6667** vs 0.5), and because `backtestMetrics`
  passes the **net** series every exit-cost flat bar counts as a **miss** (a perfectly-timed 3-round-trip book
  at 10 bps reads **0.5** vs the documented **1.0**); the shipped check's flat bars *are* its zero-return bars,
  so it cannot discriminate. **L10-br** — `scoreFold` re-lags the signal **inside** the slice (`pos[0] = 0`),
  so on the supported fixed-signal path a CPCV run boundary holds the previous *test* bar's signal (bar 30
  pooled **+0.05** vs the global **−0.05**; 3/64 bars differ on a 4-fold split) — latent. **L10-bp** — a probe
  lead **DISPROVED**: the negative MinTRL (−3.058 at skew 3 / kurtosis 3) is unreachable because **Pearson's
  inequality** `kurt ≥ skew² + 1` forces `v ≥ (1 − skew·SR/2)² ≥ 0` (60 000-histogram search bottoms at
  `v = −2.4e-15` on two-point supports; 20 000 random series violate nothing; MinTRL from measured moments
  ≥ **2.17**) — the real residual is a **NaN** sharpe yielding Infinity and being labelled `beyond-horizon`
  instead of `unavailable`. *Lab bug (same probe discipline):* the first draft of `e62`'s own Lentz-erfc
  reference returned **NaN at x = 0** (its degenerate Lentz start), which sent the bisection's first
  midpoint exactly to 0 and made `invRef` converge on 0 for every p — caught because the independent MinTRL
  recompute disagreed with the module; fixed with an `x === 0` early return. No fold-back row. `run_all` is
  now **70 steps, 39 gated, 0 fails**.
* **CYCLE-055** — one new row family. **F-71 / `e63_features_audit.js`** (11/11): the **causal signal family**
  (`analysis/features.js`), the module every arm's position flows through, incl. all **16** candidates and the
  open **L10-e**. The two headline contracts hold exactly: **causality** — for every candidate and every test
  bar, perturbing strictly-future closes/returns/volumes/panel leaves `positionAt` bit-unchanged (0 mismatches
  over 16×100 bars; non-vacuous: all 100 bars non-zero, 77–79 later bars moved); and **abstain** — a
  returns-only view reads 0 on exactly the five channel-dependent candidates, degenerate series stay finite in
  [−1,1], `clampPosition` is exact, all **13** single-feature references are exact to 1e-12 (`fracDiffAt` also
  equals the shipped `fractionalDiff(log closes, 0.4, 16)`; my independent binomial-weight recursion matches
  `fractionalDiffWeights(0.4,16)` to 1e-15), and the cross-section + regime gate match their recomputes.
  **L10-e SETTLED** — a singular `{close}` series abstains (`rangeLocation` NaN, `positionAt` 0) while the
  `{closes}` plural gives **0.0211625225**, a confirmed contract not a defect. Four new latent rows.
  **L10-bs** (headline) — the `std is 0` abstain guard is defeated by floating-point rounding: an
  exactly-constant window leaves the mean not bit-equal to the value, so `std = |d|·√(n/(n−1))` is a denormal
  positive the guard cannot reject and the feature reads `|z| = sqrt((n−1)/n)` (**−0.9682458366** n=16,
  **−0.9842509843** n=32, **−0.9746794345** n=20) where the module promises 0 — a **0.468–0.492** position at
  saturation 2 from an information-free feature; a rounding-boundary effect (where the mean IS bit-exact, e.g.
  n=8/n=32 on 0.001 and the 0.03125 fixture, the guard fires), which is why the shipped test gives no warning.
  **L10-bt** — `finiteSum` on an empty range returns **0** where `meanOf` returns **NaN**, so
  momentum/acceleration read a plausible 0 for a 0-width window instead of abstaining. **L10-bu** —
  `networkMomentum`'s self-skip `i === panel.streamIndex` never matches when `streamIndex` is absent, folding
  the stream's own lagged momentum into its network average (**−0.9066812992** with the field vs
  **−1.8820447956** without). **L10-bv** — `regimeGatedMomentum` scales the crash gate by the MOMENTUM window
  variance, not the gate window, so the threshold is off by **1.309** (shipped 16 vs 32) and the gate fires too
  rarely in a hot short-term regime. No fold-back row. `run_all` is now **71 steps, 40 gated, 0 fails**.
* **CYCLE-056** — one new row family. **F-72 / `e64_uniqueness_audit.js`** (8/8): **sample uniqueness**
  (`analysis/uniqueness.js`, the López de Prado ch.4 reference — average uniqueness, effective sample size,
  sequential bootstrap; reference-only, since the hot path re-implements the average form in
  `hivemind/training/sample_weights.js#overlapUniqueness`). `sampleUniqueness` is exact against an
  **independent per-bar scan-all-spans recompute** to 1e-12 (`[[0,2],[1,3]]` -> 2/3, 2/3; `[[0,0],[0,5]]` ->
  1/2, 11/12) and against the **shipped** `overlapUniqueness` to **exactly 0** (8 fixtures), so the two
  implementations cannot drift; it is per-label order-invariant and the ESS identities hold (point labels ->
  n; ESS = sum; averageUniqueness = ESS/n; ESS <= n — 6 overlapping labels read 5.5833). Three rows, all
  test-only/latent. **L10-bx** (headline) — the sequential bootstrap stores `avgU[i] = acc`, the uniqueness
  **SUM**, where its comment and ch.4 specify the **average**, so the draw is length-biased: two
  NON-overlapping labels (both average uniqueness 1.0, so ch.4 weights them 50/50) with spans `[0,0]` and
  `[1,3]` are drawn first **0.7480** vs the intended **0.5000** (a disjoint 1/2/3-length fixture reads
  0.1688/0.3299/0.5014 vs 1/3 each). **L10-by** — the implemented heuristic (static numerator,
  `1/(1+count)` conditioning) is **not** the cited AFML ch.4 bootstrap, which reweights each candidate by its
  average uniqueness *against the current selection*; on `[[0,1],[0,1],[2,3],[2,3]]` the second-draw law is
  **1/7,2/7,2/7,2/7** vs AFML **1/6,1/6,1/3,1/3** (total-variation gap **0.1190**). **L10-bz** — spans are
  unvalidated (a zero-length span returns NaN and poisons the ESS; a negative-length span returns -0). No
  fold-back row. `run_all` is now **72 steps, 41 gated, 0 fails**.
* **CYCLE-057** — one new row family. **F-73 / `e65_streams_audit.js`** (9/9): the **stream design layer**
  (`analysis/streams.js` — shipped; `analyze.js` prints it: `resampleCandles`, `designEffectOfStreams` (Kish
  1965), `selectStreams`, `formatStreamSelection`). Exact: the resampler reproduces a **hand recompute** to
  1e-12 (factors 2/3/4/7 x keepIncomplete) with every OHLCV invariant, never mutates, factor 1 = shallow copy,
  drops a trailing partial group unless kept (10/4 -> 2 vs 3; 3/4 -> 0 vs 1), rejects a bad factor/non-array,
  and honours the non-finite fallbacks (missing high/low -> max/min(open,close); missing volume = 1); the
  design effect satisfies EVERY Kish identity (`rawBars = K*T` 720, `designEffect = 1+(K-1)*rbar` 2.9458671265,
  `effectiveBars = rawBars/DE`, `effectiveStreams = K/DE`, `effectiveBarsPerBar = 1/DE`) with rbar = an
  independent mean pairwise correlation to 1e-15, K=1 the trivial panel, identical streams one bet (rbar 1, DE
  2/3, effectiveStreams 1), T = min length alignment, `fold-sharpe` iff the fold tiles T, degenerates abstain;
  and the selector is deterministic, tie-breaks by label (redundant pool -> [x]), monotone, with exact marginal
  arithmetic. Two rows. **L10-ca** (headline) — a zero-variance (constant) stream is **skipped from `rbar` but
  still counted in `K` and `rawBars = K*T`** (rbar bit-identical -0.0133166822; effectiveStreams 2.0270 ->
  3.0821; rawBars 480 -> 720), so a no-information stream buys a full unit of breadth while `selectStreams`
  DOES skip it — the two shipped functions disagree. **L10-cb** — `maxStreams <= 0` means UNLIMITED (0 and -3
  both select the full set). Diagnostic-layer/latent; no fold-back row. `run_all` is now **73 steps, 42 gated,
  0 fails**.
* **CYCLE-058** — one new row family. **F-74 / `e66_world_audit.js`** (7/7): the **audited evaluation world**
  (`analysis/world.js` — shipped; the module that gives `auditNoLookahead` its teeth after a returns-only
  perturbation passed vacuously, BUGS.md #22). Exact: `shockFactor`/`volumeShockFactor` are 1 at and before
  `after` and strictly inside [1, 1+2*probe] after (probe 0.07 -> max 1.14), deterministic, non-uniform and
  phase-shifted (t=after+2: price 1.0494 vs volume 1.1369; probe 0 a no-op); `shockCandles(null)` is the same
  array, every bar <= after the SAME object, every bar > after a new one with OHLC x f(t) and volume x fv(t),
  never mutating its input, deterministic, positive and shape-changing (close ratio 1.0001-1.0993);
  `makeCandleViewFor` returns the real candles on the base pass and a self-consistent tuple on a probe pass
  (`view.returns === barReturns(view.closes)` exactly) with the past bit-unchanged and 19/19 future bars moved;
  `worldFromCandles` aligns and keeps the last maxBars. Two rows. **L10-cc** (headline) — `panelFor` replaces
  the panel's own-stream slot only when `panel.streamIndex` matches an index: with `streamIndex` ABSENT (or out
  of range) EVERY slot stays the unperturbed original while `view.returns` is shocked, so a cross-sectional
  candidate reads its own unshocked series and the look-ahead audit is VACUOUS (the trap world.js exists to
  close; same root cause as L10-bu, opposite consequence). **L10-cd** — `worldFromCandles` maxBars: 0 = ALL
  bars (falsy), -5 = DROP THE FIRST 5 (`slice(-maxBars)` sign flip), 7.5 -> 7 (silent truncation); reachable
  from `--bars`. Latent; no fold-back row. `run_all` is now **74 steps, 43 gated, 0 fails**.
* **CYCLE-059** — one new row family. **F-75 / `e67_parallel_audit.js`** (7/7): the **order-preserving
  scheduler** (`analysis/parallel.js` — shipped; the module that makes `folds.jsonl` byte-identical between
  the serial and parallel A/B paths, `scheduleUnits` + `normaliseConcurrency` + `makeFoldExecutor`). Exact:
  `normaliseConcurrency` maps every non-finite / non-positive width to serial 1 (0, -3, NaN, Infinity, null,
  undefined, `'3'`, true, false, 0.5, 1) and floors/caps the rest (2.9 -> 2; 1e6 -> 64); `scheduleUnits`
  returns results in **unit order** under an out-of-order completion schedule (finish order 2,1,0,5,4,3,6,8,7,9),
  calls exec **exactly once** per unit, peaks at exactly the requested concurrency (3; n when the request
  exceeds n), reports through `onResult` out of order with a throwing reporter harmless, rejects with the
  **first** error (two failures -> `boom-1`), starts no unit past the start window, settles every started exec
  (no dangling promise), propagates a synchronous throw and returns `[]` on empty; and `makeFoldExecutor`
  maps `{positions, confidence, stats}` to `{signals, confidence, stats}`, passes the request through
  verbatim, and throws a named "malformed reply" for a null/undefined reply or a non-array `positions` (incl.
  a `Float32Array`). Two rows. **L10-ce**: `normaliseConcurrency` validates only the value, **not its `max`
  cap** — `{max: 0}` -> **0**, `{max: -2}` -> **-2**, `{max: 2.5}` -> **2.5**, `{max: 0.5}` -> **0.5**, so the
  returned "normalised concurrency" can be non-positive or fractional (not reachable via `scheduleUnits`,
  which passes `{max: n}`, n >= 1; the same class as L10-cb). **L10-cf**: `makeFoldExecutor` throws on a bad
  `positions` but **silently nulls** a non-array `confidence` (5, a `Float32Array`) and any falsy `stats`
  (0, missing), so a worker switching to a typed-array confidence would silently lose the R26-3 raw
  pre-policy confidence the turnover experiment is built on. Both latent; no fold-back row. `run_all` is now
  **75 steps, 44 gated, 0 fails**.
* **CYCLE-060** — one new row family. **F-76 / `e68_holding_audit.js`** (8/8): the **turnover policy grid**
  (`analysis/holding.js` — shipped; `analyze.js` runs it as `runTurnoverSweep` behind `--turnover-sweep`,
  passing the run `costBps` and `decisionOptions: { requireCleanAudit: audit, ... }`). Exact: the grid is the
  cartesian product `deadZones × scales × holdings` (3×1×3 -> `policies` 9, `rows` 18 for two candidates; each
  policy `{...holding, deadZone, scale}`, a null holding collapsing to `{deadZone, scale}`); every row's
  `turnover`/`grossPnl`/`netSharpe`/`breakEvenCostBps` equals a direct `restateReportAtPolicy(candidate, policy)`
  recompute to **1e-9**; rows are non-increasing in break-even with a missing value last; `byId.best` is the
  highest-break-even row and `bestPromoting` the highest-break-even promoting one (`null` when none promotes);
  `bestTurnoverPolicy` prefers promoting and returns `null` for an unknown id; the two bail-outs (a baseline or
  candidate with no fold inputs) return `available:false` with a reason; and `formatTurnoverSweep` renders the
  unavailable reason and, when available, every id plus the target. Three rows. **L10-cg** (headline) —
  `turnoverSweep` accepts and **echoes** `costBps` but NEVER threads it into `restateReportAtPolicy`, so every
  row's `netSharpe`/`dsr` and every promotion decision is at **zero cost**: a `costBps: 0` sweep and a
  `costBps: 25` sweep are byte-identical apart from the echoed field (both `netSharpe` **0.6864950785702724** at
  dz 0.1), while a direct restatement at 25 bps reads **-3.156645069841796** — and the shipped caller passes the
  run `--cost-bps`. **L10-ch** — the `requireCleanAudit` hurdle the caller passes is **structurally
  inapplicable** because `restateReportAtPolicy` drops the `audit` block (unlike its sibling
  `restateReportAtCost`), so a candidate that FAILED the run's look-ahead audit still promotes (rebuilt with the
  audit attached it correctly fails). **L10-ci** — `DEFAULT_TURNOVER_GRID` is only **shallowly** frozen
  (`Object.isFrozen(deadZones)` false), so `deadZones.push(0.9)` takes the default sweep **48 -> 54** policies.
  All latent/report-level; no scored number moves and no fold-back row. `run_all` is now **76 steps, 45 gated,
  0 fails**.
* **CYCLE-061** — one new row family. **F-77 / `e69_replication_audit.js`** (8/8): the **seed-replication layer**
  (`analysis/replication.js` — shipped; `analyze.js` imports `seedDistribution`/`formatSeedReplication` behind
  `--seeds`, aggregating a multi-seed run into `replication.json`). Exact: `interquartileMean` reproduces the
  rank-slice middle on every hand case (`[1,2,3,4]` -> **2.5**, `[1..8]` -> **4.5**, `[]` -> NaN, `<4` -> plain
  mean, non-finite filtered, monotone); `stratifiedBootstrapCI` is deterministic per seed, seed-sensitive,
  preserves each stratum size in every replicate (a statistic that returns the sample length reads **12** for
  strata `[4,5,3]`), `lo <= median <= hi`, abstaining on empty/all-non-finite; its empirical coverage of a known
  mean is **0.92** (400 panels, nominal 0.95); `varianceComponents` satisfies `total = between + within +
  residual` to 1e-9 with the fractions summing to 1 in the pure-between-seed, pure-within-seed, repeated-cell and
  mixed panels (`totalVariance` = the population variance); `pairedVarianceRatio` = `var(paired)/var(unpaired)`
  with `reduction = 1 - ratio` exactly, abstaining on short / zero-unpaired-variance input and going negative when
  the pairing hurts; and `seedDistribution`/`formatSeedReplication` carry/render the documented fields. Two rows.
  **L10-cj** — the \"IQM\" drops `floor(n/4)` BY RANK, not a quarter of the MASS, so it is NOT the cited Agarwal
  et al. (arXiv 2108.13264) / `rliable` [q1,q3] quantile-filter: witness `[0,0,5,10]` reads **2.5** vs the
  reference **1.6667**, and **149/300** right-skewed panels differ (max gap **1.016**). **L10-ck** —
  `formatSeedReplication` prints its OWN `alpha` in the CI label, never `dist.ci.alpha`, so a distribution built
  at `alpha = 0.10` is printed as **`95%CI`** (its bounds the 90% ones; the shipped path is consistent only
  because it uses the default 0.05 throughout). Both latent/claim-level; no scored number moves and no fold-back
  row. `run_all` is now **77 steps, 46 gated, 0 fails**.
* **CYCLE-062** — one new row family. **F-78 / `e70_dependence_audit.js`** (10/10): the **cluster-inference
  module** (`analysis/dependence.js` — SHIPPED; the delete-one-cluster jackknife behind the pooled cross-stream
  Sharpe SE, used by `walkforward.js#promoteDecision`; PURE and imports nothing, so it audits in isolation). Exact:
  `pearsonCorrelation` = the textbook formula with ±1 monotone and NaN guards (<3 points, zero variance, unequal
  length); `meanPairwiseCorrelation` averages the finite pairs (`[[1..4],[1..4],[4..1]]` -> **−1/3**);
  `equicorrelationDesignEffect` = `1+(K−1)ρ` and effective size `K/deff` (K=1 -> 1; non-positive deff abstains);
  `foldWindowClusters([[1,2,3,4],[5,6,7,8]],2)` -> `[[1,2,5,6],[3,4,7,8]]` with throws on a bad panel;
  `clusterJackknife` on `[[1,2],[3,4],[5,6]]` gives estimate **3.5**, leave-one-out **[4.5,3.5,2.5]**,
  `se = √((2/3)·2) = 1.1547005383792515`; `studentTPValue`/`regularizedIncompleteBeta` reproduce the exact df=1
  (Cauchy) and df=2 closed forms to 5e-7 (t=0 -> 0.5/1, symmetric, twoSided = min(1,2·oneSided));
  `studentTCritical` inverts the tail (**1.6895724578** / **2.0301079283** at df=35; table 1.68957/2.03011);
  `signTest` is the exact binomial tail (`7/10` -> **0.171875**) and `signTestFloor(n) = 2⁻ⁿ`; and the paired cluster
  tests carry the documented fields. Two rows. **L10-cl** — `clusterStability.stable` checks ONLY
  `fractionPositive >= minFraction` and never the `worstDelta > minDelta` its docstring requires: at minFraction 0.5
  a candidate with `fractionPositive` **0.6667** and `worstDelta` **−0.5** reads `stable: true` where the doc rule
  says false (coinciding only at the shipped minFraction 1; `promoteDecision` exposes minStableFraction).
  **L10-cm** — `signTest` starts from `pmf0 = 0.5ⁿ`, which underflows for `n ≥ ~1075`, so every pmf is 0 and it
  returns pValue = 0 (significant true) for ANY win count: `{wins:500,n:1000}` -> **0.5126** but
  `{wins:1000,n:2000}`, `{wins:1,n:2000}`, `{wins:2000,n:2000}` all -> **0**. Both latent; no scored number moves
  and no fold-back row. `run_all` is now **78 steps, 47 gated, 0 fails**.

* **CYCLE-063** — one new row. **F-79 / `e71_decision_audit.js`** (10/10): the **decision-grade report**
  (`analysis/decision.js` — SHIPPED; the six-block compositor behind `--decision`, PURE). Exact:
  `foldConcentration` vs a direct `strategyReturns`+`sharpeRatio` recompute (top-K shares `8/9`/`15/9`/`9/9`;
  delete-one-cluster full **−3.5204429235768973**, min **−5.253810564276818**, max **−1.6034020777212812**;
  marginals mean **0.023595765513707272**; null shares on a non-positive gross); `confidencePersistence`'s pooled
  within-fold lag-1 (**0.666707822740828**) and half-life (**1.709771604681528**); `pairedUnitsNeeded` **9**/**18**
  (brute-force agreement) with `pairedMde95 = tCritical(35,0.05)·0.08 = 0.13516579662244632`; `nextRunPlan`'s
  `barsToDetectDependent = 1829`, `clearsBps`, timing/cadence; all six `cheapestFlip` kinds;
  `promotionAcrossCadences` majority + veto; the six-block `decisionReport`/`formatDecision`. One row. **L10-cn** —
  `restateReportAtPolicy` replaces `folds` with restated-position metrics but carries the original `foldInputs`,
  so a policy-restated report handed to `foldConcentration` mixes bases (restated net Sharpe
  **−5.201698358740081** vs carried-signal Sharpe **−3.5204429235768973**); the shipped path is cost-only
  (agreeing, **−3.877740023296727**), so latent. No golden moves and no fold-back row. `run_all` is now
  **79 steps, 48 gated, 0 fails**. **No pure analysis module remains un-audited.**
* **CYCLE-064** — four new rows, and the first audit outside `analysis/`. **F-80 / `e72_hivemind_kernels_audit.js`**
  (11/11): the **hivemind numeric kernels** (`hivemind/kernels/*` — SHIPPED; the model's pure math primitives,
  installed on `HiveMind.prototype` and called from `gradients.js`/`transformer/*`). Exact on the finite path:
  silu/siluDerivative/sigmoid/softmax, the linalg helpers, RMSNorm/RoPE/semantic normalization, the Irwin-Hall
  normal + Dirichlet sampler, the MAD proxy, EMA, conformity, the lower nearest-rank percentile, the sparse/dynamic
  thresholds, the gradient/spectral norms and the stateful drop/stagnation detectors. Rows: **L10-co** —
  `_sigmoid`/`_silu` return **0** for `+Infinity` (finite-guard short-circuits the `±100` clamp; a
  maximally-positive logit reads as probability 0). **L10-cp** — the falsy-zero family:
  `_computeGradientNorm`/`_computeSpectralNorm` → **1** for the zero input, `_computePercentile` → **1.0** for a
  legitimate 0. **L10-cq** — the vector helpers disagree on a length mismatch (`_fastVectorDot` → NaN,
  `_vectorDot` → 0, `_fastVectorAdd` → a copy of `a`). **L10-cr** — two dead clamps (`_computeDualEMA` 0.8,
  `_computeNTKStability` −0.1) and `_computeFractalDimension` an ad-hoc clamped dispersion, not a fractal
  dimension. All latent; no golden moves and no fold-back row. `run_all` is now **80 steps, 49 gated, 0 fails**.

* **CYCLE-065 — RUN CORPUS (2026-09-26/27)** - read-only, no experiment: the operator's seven local `npm run analyze` runs (`src/runs/**`) were read against the ledger (`RUN-CROSSCHECK.md`). Confirms F-01/F-13 (the promoted `sig-momentum` +1.0848 is the 600-bar number; full history ~+0.11), F-32 (15m `sig-reversal-4` family-wise significant at family SPA p 0.4382, arm StepM p 0.0474, but break-even **1.50 bps**), F-03/L02 (`sig-reversal-xs` design effect **0.361**, effective streams **12.05** of 8), F-06/F-08 (all four momentum upgrades fail), F-71/F-74 (**`sig-network-momentum` audit VACUOUS in production**, reachable 0/288, 8 violations - the corpus's top Sharpe 1.3005 and unmeasured), F-69 (best benchmark is a map-bounded ridge), and F-77/L10-cj (replication signals are seed-free). One new row: **L10-cs** (the funding sleeve enters the paired promotion test, flipping the verdict). No repo number or lab number moves; the run readout is the repo's `docs/RUN-ANALYSIS.md` section 18.

* **CYCLE-146 — SHIM AUDIT (2026-10-02)** — read-only page-ESM probe, one fix: every split shim loads in the live page except `src/analyze.js`, which carried a static `import { pathToFileURL } from 'node:url'` — so any non-harness importer (raw page, future tooling) fails at link time, while the harness (which aliases `node:url`) and Node never notice. The shim's own header ("node-only imports live in ./cli.js") is false of the code (F-61 class). One new row: **L10-cu** — fixed by guarding the import: `process.versions?.node` gate + dynamic `await import('node:url')`, exact dispatch condition preserved (`node ./src/analyze.js` still runs `analyzeMain`; `node --test` and harness paths never take the branch). Latent: the browser entry imports `analyze/cli.js`, the CLI runs in real Node, so no measured number moves; no golden moves; no fold-back row. `npm test` owed (now also covers this fix).

* **CYCLE-149 — COLLISION CENSUS (2026-10-02)** — static census of all 883
  `src/` export names (347 shared; top-30 all benign shim chains) with
  body-level inspection + full importer tracing of the remainder. Two new
  rows, both latent: **L10-cv** — `sharpeStandardError` is two different
  formulas under one name (`performance.js` Lo-style object form vs
  `walkforward/power.js` scalar form); importers verified correct on each
  side (`sleeve/evidence.js` takes performance's, the `walkforward.js` shim
  re-exports power's) — a naming footgun, not a miswiring; **L10-cw** — the
  weight tools (`clipWeights`/`bandWeights`/`cleanBook`/`MIN_TRAIN_PERIODS`)
  are defined twice (`core/primitives/weights.js` ships in the sleeves,
  `analysis/portfolio.js` is test-pinned and lab-audited); `clipWeights`
  byte-identical, `bandWeights` 1-guard drift (`Array.isArray`), no caller
  passes a non-array so shipped and tested behavior coincide — single-source
  proposed as a repo task, not rewired without the native gate. No measured
  number moves; no golden moves; no fold-back row.
