# CYCLE-018 — Meta-labelling: is "will this rule's trade pay?" predictable at all? (L06)

**Date:** 2026-10-22
**Goal:** L06 is the last fully-open lead, and THEORY.md E-D calls it the highest-expected-value direction
left: stop asking the learned layer to predict the next bar's sign (which NL-BENCH closed), and instead
ask it the easier, directly-actionable question — *will this rule's trade pay?* — i.e. abstention/sizing on
top of a rule. L06's own falsifier was pre-registered in CYCLE-001:

> Brier skill of `P(rule's trade profitable)` vs the *rule's* base rate ≤ 0 → the machinery has no role and
> NL-BENCH's closure extends to the meta target.

Its own "Next actions" say the point is the **target**, not the architecture: before touching the learner,
measure whether the target is predictable at all, OOS, with a deliberately simple classifier. That is what
this cycle does.

## Work

1. **`experiments/e26_meta_label.js`** (new, registered in `run_all` as `e26_meta_label_1h`/`_15m`):
   * **the target** — for each bar a base rule acts (`|p[t]| > 0`), the primary label is
     `1[p[t]·Σ_{q=1..8} r[t+q] > 0]` (L06's falsifier, literally), with an AFML directional triple-barrier
     outcome (`ptSl=[1,1]`, trailing-vol scale, vertical 8) as a secondary label;
   * **the classifier** — an L2 logistic regression on the repo's own eight causal features
     (`analysis/features.js`) plus the rule's own position (9 columns), refit on an expanding window capped
     at `maxTrain = 2000` rows, **horizon-purged** (a training row enters only once its label is fully
     resolved before the first predicted bar), scored **out of sample** against the causal training-window
     base rate — the best constant predictor you could actually have known;
   * **the null** — the identical pipeline refit on **label-shuffled** training data (`nullSeeds = 4`),
     giving the distribution of OOS skill a zero-information model achieves;
   * **the abstention overlay** — skip the trades the classifier dislikes and score the result net of 4 bps;
   * **base rules** — `sig-momentum`, `sig-acceleration` and `sig-reversal` (a trend rule, a trend-change
     rule, and the one rule with a measured gross edge, F-32).
2. **`lib/lab.js` untouched**; no new data join, so no `e14` change (the new experiment reads only the
   repo's feature vector and the existing panel).
3. **Controls (F-11), same call.** An oracle filter (keep only the trades that won) and its mirror: the
   oracle's gross Sharpe is **+2.1…+2.3**, the anti-oracle's **−1.9…−2.3** at both timeframes, so the
   filter machinery is sound (if it could not turn an oracle into a huge number, no abstention result would
   be believable). A **null-model filter** (predictions from the shuffled-label model) is the primary
   control for the overlay, and an equal-size **random filter** the secondary one.

## Results

**A. Out-of-sample Brier skill vs the causal base rate is ≤ 0 for every rule at both timeframes.** The
pre-registered falsifier fires:

| rule | acting bars (1h / 15m) | 1h Brier skill | 1h AUC | 15m Brier skill | 15m AUC |
| --- | ---: | ---: | ---: | ---: | ---: |
| `sig-momentum` | 427 672 / 639 664 | **−0.0013** | 0.5063 | **−0.0007** | 0.5083 |
| `sig-acceleration` | 427 632 / 639 624 | **−0.0011** | 0.5047 | **−0.0010** | 0.5061 |
| `sig-reversal` | 427 672 / 639 664 | **−0.0003** | 0.5084 | **−0.0010** | 0.5041 |

The shuffled-label null scores ≈ **−0.003** (a zero-information model is *worse* than the base rate), so
the real model sits ~+0.002 above the null but at or below the causal base rate; per 29-block window the
real skill is positive in only **10–48 %** of blocks.

**B. AUC is detectably above 0.5 — and it is the only trace; capacity does not change the verdict.** Pooled
AUC 0.504–0.508 (per-stream 0.497–0.521) at n ≈ 4–6×10⁵ is a real rank signal, but the probabilities are
not calibrated (Brier worse than the base rate). A **capacity probe** on the first stream shows the skill is
positive **only at one gradient-descent iteration** (+0.0006…+0.0021) and becomes more negative as capacity
rises (−0.009 at 40 iterations): the effect is a whisper that overfits, not a signal a model can capture.

**C. The abstention overlay only "works" by keeping a handful of bars.**

| rule | raw net@4 (1h) | best filter net@4 | keep fraction | break-even raw → filter | null-model filter mean | z vs null |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `sig-momentum` | −0.081 | **+0.020** | 0.68 % | 2.33 → 15.5 bps | −0.056 | 4.2 |
| `sig-acceleration` | −0.063 | **+0.025** | 0.49 % | 2.79 → 19.6 bps | −0.046 | 3.9 |
| `sig-reversal` | −0.588 | **+0.061** | 0.27 % | 0.38 → 15.1 bps | −0.021 | 5.6 |

At **15m** the same overlay does *not* reach a positive net for the trend rules (best filter **−0.016** and
**−0.009**) and only `rev` turns positive (+0.018 on **0.016 %** of bars); most arms fail to beat the
null-model filter. A book that holds a position on ~1 in 150–300 bars is not a strategy.

## What is now false that used to be believed

* **"Re-aiming the learner at `P(rule's trade profitable)` gives the inert layer a job."** Measured, it
  does not: the meta-label target is not predictable enough to beat the rule's own base rate (Brier skill
  ≤ 0 at every rule, timeframe and capacity). NL-BENCH's closure extends to the meta target.
* **"The meta-target is a *different*, easier problem than `P(next bar up)`."** It is a different label,
  but on this feature vector it is no easier: the model's OOS skill is ≈0, and more capacity makes it worse
  (overfitting), not better.
* **"AUC > 0.5 means there is something to harvest."** The meta-target does carry a *detectable* rank
  signal (AUC ≈ 0.505–0.508, significant at n≈10⁵) — but it does not produce calibrated probabilities and
  the only way to trade it is to keep < 1 % of bars, which at 15m mostly still loses. Recorded so no future
  cycle mistakes a significant AUC for an edge.

## Ledger effects

* New **F-35**; new experiment `e26_meta_label.js`, new artefacts `results/e26_meta_label_{1h,15m}.json`.
* **L06 → NEGATIVE (closed).** No fully-open lead remains: L07 is partial (liquidation prints untested),
  L10 is the standing audit, and the open *risks* are the F-24 carry decay (2025–26) and the L18
  post-2024 decay check.
* No shipped number moves; `e14` unchanged (13 checks). `RUNNER.md` records the meta-label convention.

## Next

* The lab now has **no open alpha direction**: every measured mechanism (momentum, accel, conditional,
  reversal, order flow, OI direction, meta-labelling) reads ≈0, and the only live sleeves are the two
  cross-sectional yield/positioning books (L12/L18), which are capacity-bound and decaying.
* The two open *risks* are both decay checks on live sleeves: re-run the dispersion book's 2025–26 window
  (F-24's caveat) and the toptrader fade post-2024 (F-30). A decay confirmation would be the first
  genuinely new *negative* on a working sleeve and is the natural next cycle.
* The meta-label primitive (`e26#causalOos` + `#fitLogisticFlat`, a purged expanding-window OOS classifier)
  is reusable if a new feature family ever appears — it is the cheapest honest test of "is this target
  predictable at all?".

## Run

`e26` was run directly for the cycle (1h ~107 s, 15m ~156 s) and is registered in `run_all` (now 34 steps).
Controls `e0c`, `e5` (1h/15m), the 13-check `e14`, and `e25`'s validation guard all report `pass` in the
final regenerate.
