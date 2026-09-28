# CYCLE-045 — The dependence / DSR backbone, audited against closed forms (L10-f, L10-i)

**Date:** 2028-02-15
**Goal:** CYCLE-044 settled the *first* pair of the lab's roadmap and introduced the technique of a
**synthetic ground truth** for a repo function (`e53`, F-61). CYCLE-045 turns that technique on the
lab's most-load-bearing analytical primitive. Every pooled verdict the lab reports — F-02, F-14, F-18,
F-20, F-31, F-43, F-47, and the capacity/probability machinery behind them — rides on the repo's
`walkforward#dependenceSummary`: a delete-one-cluster jackknife over fold-window clusters
(`analysis/dependence.js`) that estimates the design effect of the pooled Sharpe, feeds
`effectiveBars = n / designEffect` into `backtest#backtestMetrics` (`psrAdjusted`/`dsrAdjusted`), and
gates on `adjustmentNeeded = designEffect > 1`. The lab has only ever *used* it. It has never checked
that it means what it says. This cycle does, and closes the two oldest pure-assertion rows on the
register — **L10-f** (can `effectiveBars` exceed `n`?) and **L10-i** (is the `designEffect < 1` path
intended?).

## Work

**`experiments/e54_dependence_audit.js`** (new, registered as `e54_dependence_audit`) — a synthetic
ground truth for the dependence estimator, in three parts, with the discipline F-57 taught (a single
realisation of a noisy statistic is not a measurement: every mean is over a seeded ensemble, LCG +
Box–Muller, and every closed-form comparison is a **2.5-standard-error band** on the ensemble mean,
`tol = max(floor, 2.5·se)`):

* **A. Closed forms.** The survey-sampling design effect (Kish 1965) for K equicorrelated streams is
  `1 + (K−1)·ρ`; K *identical* streams is `K`; a negatively-correlated pair is `1 + ρ`; independent
  streams is `1`. Feed `dependenceSummary` panels built with those exact correlation structures and
  compare its `designEffect` with the form.
* **B. The estimator's own noise.** `effectiveBars = n/designEffect` is only as good as the jackknife
  SE, and the jackknife has few clusters at realistic fold counts. Measure the null distribution of
  `designEffect` on 8 i.i.d. streams at **C = 36** and **C = 288** folds, and the lab's own
  `serialDesignEffect` mirror on a single i.i.d. series.
* **C. The two limits the audit exists to measure.** A diversifying (ρ = −0.5) pair — does the
  ensemble-mean DE fall below 1, and does `effectiveBars` exceed the raw bar count? And a **perfectly
  hedged pair** (one stream the exact negative of the other): the pooled Sharpe is 0, the jackknife
  SE ~0, and `designEffect = (jk.se / se_iid)²` — a **squared ratio**, therefore never negative.
  Then hand the resulting `effectiveBars` to `backtestMetrics` and see whether the DSR path contains
  it.

**Pre-registered read.** PASSES if every ensemble-mean DE matches its closed form within 2.5 SE (no
detectable bias), the null distribution is centred at 1 and its 90 % band **shrinks** with cluster
count, the diversifying pair reads below 1 with `effectiveBars > rawBars`, and the hedged pair both
explodes and is **declined** by the DSR path. A failure means F-62 must be revised.

## Results

**A. The estimator is unbiased.** Every ensemble mean lands inside its own 2.5-SE band of the closed
form (max gap **0.318** across 14 rows; zero biased rows):

| structure | closed form | ensemble-mean DE |
| --- | ---: | ---: |
| K = 8, ρ → 0 / 0.25 / 0.5 / 0.75 / 0.95 | 1 / 2.75 / 4.5 / 6.25 / 7.65 | 0.989 / 2.751 / 4.439 / 6.101 / 7.399 |
| K identical (K = 2, 4, 8; fold 40 & 100) | 2 / 4 / 8 | 2.03–2.14 / 3.75–4.02 / 8.07–8.32 |
| negatively-correlated pair (ρ = −0.2 / −0.5 / −0.8) | 0.8 / 0.5 / 0.2 | 0.909 / 0.571 / 0.228 |
| i.i.d. 8-stream (null) | 1 | 1.001 (C = 36) / 1.016 (C = 288) |

So F-02's real-basket reading (DE 4.92 at ρ ≈ 0.56) is the estimand it claims to be, and the
negatively-correlated rows confirm the estimator tracks `1 + ρ` through the sign change.

**B. But it is noisy — the calibration band is the finding.** On true-i.i.d. data (DE must be 1):

| folds | ensemble-mean DE | sd | p05–p95 |
| --- | ---: | ---: | ---: |
| C = 36 | 1.001 | **0.243** | 0.644 – 1.452 |
| C = 288 | 1.016 | **0.097** | 0.899 – 1.231 |

At the repo's own fold counts a *true* DE of 1 routinely reads 0.64–1.45 — a **−36 %/+45 %** band on a
single realisation. Eight times the clusters halve the sd. The lab's `serialDesignEffect` mirror is
similarly centred (mean 0.98–1.06) with sd growing 0.075 → 0.294 as the fold count 50 → 250 (the
outlier-fragility of L10-p, now quantified as a *fold-count* effect). **Consequence: any reported
`effectiveBars` carries roughly ±25 % of its own noise at C = 36; an `adjustmentNeeded` verdict on a DE
within ~1 ± 0.25 of the gate is not resolvable from one pooled result.** This is a calibration warning,
not a defect — the estimator is unbiased, it is just low-precision at realistic fold counts.

**C. Two bounds.**

* **Diversifying pairs buy effective bars.** A ρ = −0.5 pair reads ensemble-mean DE **0.506** and
  `effectiveBars > rawBars` in **25/25** realisations (max 8210 vs 2400 raw). So `designEffect < 1` is a
  real, reachable regime — the code's comment anticipates it ("can EXCEED the bar count").
* **But `effectiveBars` is UNBOUNDED.** For the perfectly hedged pair, `designEffect = 4.7e−32` and
  `effectiveBars = n/DE ≈ 3.4e34`. Because DE is a **squared** ratio, the `designEffect > 0` guard
  passes at 1e−32 and `adjustmentNeeded` reads **false** — a maximally-dependent (in fact degenerate)
  panel is waved through as needing no adjustment. The `< 1` regime the comment anticipates is benign;
  the `→ 0` limit it does not anticipate is not. (L10-f: **yes**, `effectiveBars` can exceed `n` — it
  can exceed it by 30 orders of magnitude; the bound the comment relies on does not exist.)
* **The DSR path declines to adjust — and that is intended.** `backtestMetrics` requires
  `2 ≤ effectiveBars < n`, so the exploded 3.4e34 is refused: `nEff` and `dsrAdjusted` come back null
  and the raw Sharpe is used. **L10-i resolved**: declining to adjust when the design effect is < 1 is
  the documented, intended behaviour — the code prefers an un-adjusted (conservative-in-this-direction)
  statistic to an inflated one. The residual risk is only that a *numerator* explosion (DE → 0) and a
  *mild* diversifying panel produce the same `null` readout, so a downstream consumer cannot tell
  "declined because hedging" from "declined because degenerate" without inspecting `designEffect`.

`e54` passes all **11** guards (25.3 s). New artefact `results/e54_dependence_audit.json`.

## What is now false that used to be believed

* **"`dependenceSummary` is a black box we can trust because it's the repo's own statistic."** Half-true.
  It is **unbiased** — its ensemble mean matches Kish's `1+(K−1)ρ`, `K`, `1+ρ` and the i.i.d. null to
  within 2.5 SE. But it is **low-precision**: on true-i.i.d. data a single reading spans
  0.64–1.45 at C = 36. Trusting one pooled `designEffect` to two decimals (F-02, F-47) overstates the
  resolution by ~an order of magnitude; only ensemble/robust readings are meaningful to ±0.25.
* **"`effectiveBars = n/designEffect` is bounded by the bar count (the code comment says it can exceed
  it only mildly)."** False. DE is a squared ratio, so it approaches 0 on a hedged panel;
  `effectiveBars` reaches **3.4e34**, and `adjustmentNeeded` still reads `false` — the `> 0` guard is
  not a bound.
* **"The `designEffect < 1` DSR path is unspecified / possibly a bug (L10-i)."** Resolved: it is
  **intended**. `backtestMetrics` clamps to `2 ≤ effectiveBars < n` and returns null adjustments rather
  than inflating; the raw Sharpe is used. Not a defect — but it is lossy (it cannot distinguish hedging
  from degeneracy), so a caller that needs to know must read `designEffect` itself.

## Ledger effects

* New **F-62**; new experiment `e54_dependence_audit.js`, new artefact
  `results/e54_dependence_audit.json`; `run_all` is now **62 steps** (31 gated). **L10-f and L10-i are
  settled**; the register gains **L10-ae** (`effectiveBars = n/DE` is unbounded — a hedged panel gives
  DE ~ 1e−32 and `effectiveBars` ~ 3.4e34 while `adjustmentNeeded === false`). No fold-back: the
  behaviour is the repo's intended, documented DSR path (L10-i), so F-62 is a *validation + calibration*
  finding, not a shipped-path defect.
* This is the lab's **second** synthetic-ground-truth experiment on a repo function (`e53` was the
  first, F-61). The technique — closed forms + seeded ensembles + 2.5-SE bands — is now a standing
  method and is recorded here so later cycles reuse it rather than reinventing it.

## Next

* Remaining L10 rows: **L10-ad** (`carryOnBarGrid`'s one-period attribution lag — quantify against the
  sleeve's price-basket correlation before calling it a defect), **L10-e** (the feature `closes`
  contract), **L10-h** (golden movement for any R1–R8 port).
* Turn the synthetic-ground-truth technique on the other pure analysis modules the lab consumes:
  `labels.js` (triple-barrier / meta-labels, F-25/F-26), `splits.js` (purge/embargo windows, F-47),
  `overfitting.js` (PBO/CSCV), `forecast.js` (EWMA/HAR vol, F-34/F-35), `race.js` (the arm ranking).
* Carry the calibration band forward: any new pooled `designEffect` quoted to more than one significant
  figure should cite its C and the ±25 % band (B, above).

## Run

`e54` ~25.3 s (registered). Full `run_all` regeneration **62 steps, 31 gated, 0 fails** (`RUN_SUMMARY`
at **2026-09-27T03:52:55Z**, machine-load dependent); controls `e0c`, `e5` (1h/15m), the 14-check `e14`,
and the validation guards `e28`–`e54` all report `pass`. The gate-less exploratory steps report timing
only.
