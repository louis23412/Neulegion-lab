# FINDINGS — the measured ledger

Every row is a measurement made through `lib/lab.js` (the repo's own statistics) on the shipped
data, reproducible from the experiment file named in the row. Verdicts are `SUPPORTED`,
`NEGATIVE`, or `OPEN`. Nothing here is a recommendation yet — `FOLD-BACK.md` is where a finding
becomes a port.

Runner: `RUNNER.md`. Raw artefacts: `results/*.json`.

---

## F-01 — The reported edge is a 600-bar (≈25-day) window artefact. [SUPPORTED — critical]

**Experiment:** `e0b_window_sweep.js`, `e2_arm_sweep.js`. **Artefacts:** `results/e0b_window_sweep_1h.json`,
`results/e2_arm_sweep_1h.json`.

The A/B's `--bars=<n>` is documented as "bars per stream, **most recent**" (`analyze.js` line 3228), so
the round-29/30 acceptance batch and the verdict run score the **last 600 bars** — about 25 days of 1h
data. Scoring the shipped `sig-momentum` (window 16, saturation 2, zWindow 32) over a ladder of trailing
windows on the 1h basket:

| window (bars) | mean net Sharpe | mean break-even | mean pairwise stream corr | design effect | pooled Sharpe | pooled `dsrAdjusted` |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **600** | **+1.267** | **18.73 bps** | 0.50 | 4.48 | +1.190 | 0.996 |
| 1200 | +0.446 | 5.96 bps | — | 5.25 | +0.383 | 0.847 |
| 2400 | −0.008 | −0.11 bps | — | 5.31 | −0.009 | 0.486 |
| 4800 | +0.046 | 0.57 bps | — | 4.60 | +0.043 | 0.599 |
| 9600 | +0.122 | 1.82 bps | — | 4.92 | +0.122 | 0.833 |
| **all 53500** | **+0.110** | **2.30 bps** | 0.62 | 4.92 | +0.122 | 0.833 |

Two independent confirmations that the +1.0 the run reports is the 600-bar number, not a long-run edge:
the lab's 600-bar reading (+1.267) reproduces the batch's reported `sig-momentum` (+1.0848), and at
600 bars the *design effect* the lab measures (4.48) matches the batch's 4.87 of the same window.

**The decisive corollary** (`e2_arm_sweep.js`, 1h, "verdict window" = last 600 bars vs full history):

| arm | full-history Sharpe | last-600 Sharpe | comment |
| --- | ---: | ---: | --- |
| `sig-momentum` (16) | +0.110 | +1.267 | the reported arm |
| `netmom-16` (network momentum) | **+0.009** | **+1.450** | a panel arm with *no* own-asset content — it "wins" the window |
| `range-32` (not a trend signal) | +0.064 | +0.782 | 0/8 streams had a full-history edge |
| `accel-16` | +0.147 | +1.058 | the most *stable* arm (6/6 blocks positive) |
| `mom-48` | +0.056 | **−0.162** | the same arm, the same window — negative |
| `xs-mom-16` (cross-sectional) | −0.021 | −0.054 | the demeaned arm does *not* inherit the window |

**Read.** In the last 600 bars *almost every* arm reads +0.2…+1.45 — including arms that are not trend
signals and arms with a full-history Sharpe of ~0.01. The window is a market regime, not an arm
difference. On the full 1h history no rule-based arm exceeds +0.15 Sharpe and every break-even cost is
1–2 bps — **below the 5–10 bps taker cost the project itself assumes**. The gate's arithmetic in
`PLAN-round30.md` §3.1 is therefore built on `netSharpe 1.0848 / effectiveBars 1192`, which is a
25-day realisation.

**Caveat (honest) — now closed.** The lab scores a *contiguous* series; the A/B scores walk-forward
folds and pools. For a parameter-free signal those coincide to within folding noise, and **F-13
measures that directly** with the repo's own path (`+1.106` at 600 bars, `+1.190` contiguous, reported
`+1.0848`; `+0.109` vs `+0.110` at full history). The claim is about the *sample*, not the aggregation.

---

## F-02 — The basket is one factor, and the project's own numbers already say so. [SUPPORTED — known]

**Experiment:** `e0_panel_baseline.js`. **Artefacts:** `results/e0_panel_baseline_{1h,15m}.json`.

* mean pairwise **return** correlation across the 8 majors: **0.623 (1h)**, **0.732 (15m)**.
* mean pairwise **stream** correlation of the momentum strategies: 0.63 (1h) / 0.50 (15m).
* design effect **4.92 (1h)** / **3.62 (15m)**; effective streams **1.47 / 1.77 of 8**.
* buy-and-hold itself: mean Sharpe +0.14 (1h), +0.03 (15m).

This reproduces the project's frontier (its reported 3.62–4.87 / 1.73) — the harness is faithful. It is
the binding constraint the plan names, and it is *not* newly fixable by signal work (see F-03).

---

## F-03 — Independence is cheap; edge is not. Cross-sectional construction collapses the design effect. [SUPPORTED — new tool]

**Experiment:** `e2_arm_sweep.js` (the `xs-*` arms). **Artefact:** `results/e2_arm_sweep_1h.json`.

Demeaning a signal across the basket at each bar (`xsMomentum`, `xsVolScaledMomentum`,
`xsMomentumRank` in `prototypes/signals.js`) collapses the panel's dependence:

| construction | design effect | effective streams (of 8) | full-history Sharpe |
| --- | ---: | ---: | ---: |
| momentum (shipped) | 4.92 | 1.47 | +0.110 |
| xs-momentum-16 | **0.56** | **14.63** | −0.021 |
| xs-momentum-168 | 0.46 | 15.86 | +0.005 |
| xs-vol-momentum-16 | 0.60 | 18.58 | +0.016 |
| xs-rank-momentum-48 | **0.39** | **19.39** | +0.023 |

`designEffect < 1` means the panel is **diversifying**, not over-confident — `backtestMetrics`
deliberately declines to inflate confidence in that case (`effectiveBars` → null), so the repo's
machinery would report "no adjustment needed". So the *statistical-power* half of the plan's lever 2 is
available almost for free.

**But** every cross-sectional arm has a full-history Sharpe of ~0 (|Sharpe| ≤ 0.033) and a negative or
nil break-even. The tool works; the raw material does not. Demeaning buys power, it does not manufacture
edge — which is exactly the right way round to find out, since power without edge is worthless and edge
without power is at least a candidate.

---

## F-04 — Carry is a real, uncorrelated yield — but its Sharpe is an accounting fiction until the basis is marked. [SUPPORTED — important]

**Experiment:** `e3_carry.js`. **Artefact:** `results/e3_carry.json`.

8 symbols, 6606 common 8h funding periods, 2020-09 → 2026-09 (6.0 years):

| book | annualised | Sharpe | max drawdown | corr with price |
| --- | ---: | ---: | ---: | ---: |
| raw funding series (P4's stream) | +9.77% | **11.58** | — | +0.115 |
| **honest delta-neutral book** (`spotRet − perpRet + funding`) | **+4.78%** | **0.96** | **10.2%** | — |

The raw funding series has a Sharpe of 11.6 because it is a *yield*, not a P&L: it contains no price
risk, yet the book that earns it is exposed to the perp-spot basis, which is what actually moves. Marking
the book honestly (spot − perp + funding, with the funding row's own `markPrice` as the perp leg) gives
**+4.8%/yr, Sharpe 0.96, 10.2% max drawdown, 37% of periods negative, 2.9 years**. Per symbol: BTC
+6.1%/yr (0.96→1.61 raw per-symbol Sharpe), ETH +6.7%, LINK +8.1%, BNB **−1.8%** — the sleeve is *not*
uniformly positive.

The carry also stays **uncorrelated with the price basket (r = 0.115)**, which is the property P4 actually
wants and the one thing on this data that is genuinely independent. Its dependence-adjusted significance
is weak (the P&L's fold-window design effect is large because the position is constant), so "carry +5%/yr
at Sharpe ~1 with 10% drawdowns, uncorrelated" is the honest headline — attractive as a *breadth* stream,
not a verdict-changer on its own.

**Revision (CYCLE-006).** The paragraph above was measured on the **2.9-year** window that the repo's
`markPrice = 0` gap allowed. With the mark history restored to 2020-07 (`data/mark_8h.json`) and four
alignment bugs fixed (F-18), the honest delta-neutral book over the full **6.0 years / 6 558 periods**
reads:

| book | annualised | Sharpe | max DD | design effect (raw / winsorised) |
| --- | ---: | ---: | ---: | ---: |
| raw funding series (a *yield*, no price risk) | +9.40 % | 9.40 | — | — |
| **honest delta-neutral book** | **+9.05 %** | **4.54** | **7.96 %** | 99.5 / 11.8 |

Per symbol — Sharpe / max drawdown: BTC **9.83 / 0.5 %**, ETH 8.19 / 2.0 %, LINK 6.14 / 2.5 %,
ADA 5.94 / 2.3 %, XRP 4.12 / 5.7 %, DOGE 4.02 / 3.6 %, then **BNB 0.02 / 26.7 %** and
**SOL −0.10 / 49.7 %**. So the 0.96 was a window artefact (F-19) and the "one ~5 %/yr stream" framing is
too modest — but the sleeve is *still* not uniformly positive: two of eight majors have no carry at all
and they are where the tail lives. The raw-vs-marked gap is now 9.40 → 4.54 rather than 11.58 → 0.96.
The same figures hold on the **traded** perp leg (F-22, CYCLE-007): 4.65 vs 4.54.

---

## F-05 — Funding as a *price* predictor: negligible. [NEGATIVE]

**Experiment:** `e4_edge_hunt.js`. **Artefact:** `results/e4_edge_hunt_1h.json`.

A causal z-score of the funding rate, used as a **contrarian** price signal (`fund-contra`, forward-filled
onto the bar grid): mean full-history Sharpe **+0.026** (6/8 streams positive, block-stability 0.67);
the follow-the-funding mirror is −0.026. So the crowding/contrarian hypothesis is directionally right and
economically nil. (Carry survives as a *return* stream, F-04 — not as a price signal.)

---

## F-06 — The literature's momentum upgrades do not rescue the trunk on this data. [NEGATIVE]

**Experiment:** `e2_arm_sweep.js` (1h), `e4_edge_hunt.js`. **Artefacts:** as above.

Full-history mean net Sharpe, 1h basket:

| upgrade (source) | shipped id | full-history Sharpe | full-history break-even |
| --- | --- | ---: | ---: |
| vol-scaled momentum (`1904.04912`) | `sig-vol-momentum` | +0.084 | 1.52 bps |
| multi-horizon blend (`2112.08534`) | `sig-blend-momentum` | +0.015 | 0.19 bps |
| network/lead-lag (`2308.11294`) | `sig-network-momentum` | +0.009 | 0.00 bps |
| regime/crash gate (`2105.13727`) | `sig-regime-momentum` | +0.124 | 2.63 bps |
| plain momentum (baseline arm) | `sig-momentum` | +0.110 | 2.30 bps |

None beats plain momentum by enough to matter, and all are ≤2.6 bps break-even. `accel-16` (+0.147) is
the best and the *most stable* arm (6/6 blocks positive), which matches the batch's own ordering — but at
0.15 Sharpe it is not tradeable either.

Longer trend horizons (`e4_edge_hunt.js`, 1h): mom-168 **+0.086** (stability 0.83), mom-336 +0.049,
accel-336 +0.027 — the published multi-month trend effect is present but an order of magnitude too small
to clear any cost, on this basket.

---

## F-07 — Cross-sectional momentum does not have an edge here either. [NEGATIVE]

**Experiment:** `e2_arm_sweep.js`, `e4_edge_hunt.js`.

`xs-mom-16` −0.021, `xs-mom-48` −0.010, `xs-mom-168` +0.005, `xs-mom-336` −0.012, `xs-mom-720` +0.033
(all 1h). Every variant is ~0 and none has block-stability above 0.67. Classic XSMOM is a monthly effect;
720 bars (30 days) is the longest tested and it reads +0.033.

---

## F-08 — Volatility conditioning does not rescue momentum. [NEGATIVE]

**Experiment:** `e6_conditional_seasonal.js`. **Artefact:** `results/e6_conditional_seasonal_1h.json`.

Momentum gated by a causal expanding-median realised-vol state: low-vol **+0.112** (stability 0.83),
high-vol +0.052. The unconditional arm is +0.110. A vol split changes nothing — consistent with the
project's own `sig-vol-regime` DROP, and the reason a *conditional* version fails too.

---

## F-09 — Calendar seasonality does not survive an out-of-sample split. [NEGATIVE]

**Experiment:** `e6_conditional_seasonal.js`.

Hour-of-day and day-of-week patterns were **fit on the first half** of the 1h history and **scored on the
second half** (the only half treated as evidence): OOS mean Sharpe **−0.009** (hour-of-day, 4/8 streams
positive) and **−0.073** (day-of-week, 0/8). The in-sample hour spread looks large; it does not repeat.
Recorded as a clean negative *and* as the lab's OOS discipline in action.

---

## F-10 — Basis reversion is predictable, and the earlier "not significant" verdict was an artefact. [SUPPORTED — lead]

**Experiment:** `e7_basis_reversion.js`. **Artefact:** `results/e7_basis_reversion.json`.

The perp-spot basis z-score has a small positive IC with the next period's delta-neutral basis P&L
(per symbol 0.035 → 0.249). The correctly-signed (convergence) delta-neutral book reaches a raw pooled
Sharpe of **+2.07** (annualised +9.1%) but with a fold-window design effect of **1675** — the position
is nearly constant and the basis series is dominated by a few episodes, so there is essentially no
independent evidence. Not a lead; recorded so it is not re-derived. (The follow-the-basis mirror is
−2.07, by construction.)

**Erratum (CYCLE-002).** An earlier revision of this experiment set the position to the *mirror* of
its own stated hypothesis (`pos = −z`), so the artefact reported the losing orientation (−2.07) while
the prose quoted the correctly-signed variant (+2.1) — a sign bug caught by the L10 audit. The sign is
now explicit and both orientations are stored (`basisOnly` vs `followOnly`); the verdict is unchanged.
An even earlier revision's Sharpe of −17 was the F-11 look-ahead, already fixed.

**Revision (CYCLE-006) — the PARKED verdict is reversed.** The +2.07 / design-effect-1675 reading was
itself taken on a corrupted series: `e7` had its own copy of the loading loop, and it carried three of
the four F-18 bugs (no tail guard, no exact-bar alignment, sub-8h funding rows collapsed by
`roundGrid`), on top of the 2.9-year window. Refactored onto the single carry book
(`e3_carry.js#loadCarryBook`) over the full 6.0 years:

| quantity | old (corrupted) | CYCLE-006 |
| --- | ---: | ---: |
| per-symbol IC (basis z → next-period basis P&L) | 0.035 … 0.249 | **0.107 … 0.527 (8/8 positive)** |
| pooled Sharpe, convergence book (`basisOnly`) | +2.07 | **+9.15** (+13.1 %/yr) |
| design effect | 1675 | 395 raw → **7.84 winsorised** (t ≈ 8.0) |
| corr with the price basket | — | +0.09 |

So basis convergence is **predictable and significant**, and the earlier verdict was wrong. One
caveat kept it a *lead*: the raw design effect of 395 is the F-20 outlier effect, so the evidence
rests on the winsorised and bootstrap readings.

~~(ii) more fundamentally, **the perp leg is Binance's mark price, a smoothed index — you cannot trade
the mark**, so part of a "convergence" signal measured against it could be smoothing rather than
tradable basis. That second caveat is now lead **L14** and is the falsifier this result needs.~~

**Caveat (ii) resolved (CYCLE-007, F-22).** The traded-price test was run
(`e15_traded_basis.js`, `data/perp_8h.json`): with the perp leg set to the traded 8h close the IC is
**0.391** (vs 0.430), still **8/8 positive**, and the convergence Sharpe is **+9.17** (vs +9.15) with a
robust design effect of 7.61 (vs 7.84). The mark-vs-traded spread is real but tiny — sd 2–5 bps,
`acf(1) ≈ +0.05…+0.13` confirming the mark lags — and it does **not** explain the signal. L11's only
remaining caveat is the outlier-sensitive design effect.

---

## F-11 — The control experiment works, and it earned its keep. [SUPPORTED — methodology]

**Experiment:** `e5_controls.js`. **Artefact:** `results/e5_controls.json`.

| control | 1h mean Sharpe | 15m mean Sharpe |
| --- | ---: | ---: |
| oracle `pos_t = sign(r_{t+1})` | **+12.25** | **+13.19** |
| anti-oracle | −12.25 | −13.19 |
| seeded random ±1 | +0.02 | −0.07 |
| always-long | +0.14 | +0.03 |

The pipeline reports a Sharpe of ~12 when an edge of that size exists, mirrors it exactly under negation,
and returns ~0 for noise. Two consequences: (a) every negative result in this ledger is a real null, not a
broken harness; (b) **an implausibly large Sharpe is a bug signal** — that is how the F-10 look-ahead was
found. A pipeline-equivalence guard (`e0c_validate_pipeline.js`) separately pins the O(n) scoring path to
the repo's own `causalZScore` pipeline to ≤2.3e-12.

---

## F-12 — No combination of the available sleeves helps, because there is nothing to combine. [NEGATIVE]

**Experiment:** `e4_edge_hunt.js` (`combo-3`).

Equal-weight combination of the three most promising/orthogonal candidates
(`accel-336`, `xs-mom-336`, `fund-contra`): mean full-history Sharpe **+0.019**, block-stability 0.50 —
worse than the best member. Diversification of zero-edge sleeves yields a zero-edge sleeve; the classic
"portfolio of uncorrelated alphas" only works once at least one alpha is real.

---

## F-13 — The window effect survives the repo's own fold+pool aggregation. [SUPPORTED — closes L10-c]

**Experiment:** `e0d_ab_aggregation.js`. **Artefact:** `results/e0d_ab_aggregation_1h.json`.

F-01 was measured on a contiguous series; the A/B scores walk-forward folds and pools them
(`analyze.js` defaults: `walkForwardSplit({trainSize:60, testSize:15})` → `walkForwardEvaluate` →
`poolReports`). Running that exact path read-only for the shipped `sig-momentum`, full 1h basket:

| bars | folds/stream | A/B pooled Sharpe | contiguous pooled Sharpe | reported |
| ---: | ---: | ---: | ---: | ---: |
| 600 | 36 | **+1.106** | +1.190 | **+1.0848** |
| 2400 | 156 | +0.006 | −0.009 | — |
| 9600 | 636 | +0.110 | +0.122 | — |
| 53 500 | 3562 | **+0.109** | +0.110 | — |

The two agree to ≤0.085 at 600 bars and ≤0.015 everywhere else, and the A/B path lands *on* the
reported +1.0848 — closer than the contiguous readout. So F-01 is a statement about the *sample*, not
about the aggregation, and the last way it could have been wrong is eliminated.

---

## F-14 — At full history the fold+pool cost is the dependence machinery, not the model. [SUPPORTED — informs R1]

**Experiment:** `e0d_ab_aggregation.js` (timing block). **Artefact:** `results/e0d_ab_aggregation_1h.json`.

Scoring the parameter-free `sig-momentum` over the full 1h history through the repo's own path: the
8 × `walkForwardEvaluate` passes (3562 folds each) take **~30 ms per stream (~250 ms total)**, but
`poolReports` takes **≈155 s** — its `dependenceSummary` on 3562 fold lengths dominates by ~600×.

This is the concrete reason `--bars=full` is not free, and it is *not* the O(n²) model the cost law
blames: for a signal arm the scoring is trivial and the design-effect estimate is the cost. R1's
long-sample scorer should therefore either score contiguously (F-13 shows it is equivalent for a
parameter-free signal) or bound the cluster count before `dependenceSummary`.

---

## F-15 — Taker order-flow imbalance is independent but directionless at 1h and 15m. [NEGATIVE — first L07 probe]

**Experiment:** `e9_flow.js`. **Artefacts:** `results/e9_flow_1h.json`, `results/e9_flow_15m.json`.
**Data:** `data/taker_1h.json`, `data/taker_15m.json` (Binance `takerBuyBaseVolume/volume`; see
`data/README.md`).

The first genuinely new input (L07): signed taker imbalance `2·buy/vol − 1` on the repo's grid, 53 306
bars (1h, 2020-08 → 2026-08) and 77 735 bars (15m, 2024-06 → 2026-08), tested through the same causal
pipeline as the shipped family, with the F-11 controls green in the same session.

| arm (1h) | mean Sharpe | break-even | block stab. | corr w/ price | IC h1 | IC h4 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `flow-1` (bar imbalance) | −0.014 | −0.06 bps | 0.50 | 0.001 | 0.003 | 0.005 |
| `flow-8` (mean) | −0.028 | −0.75 bps | 0.50 | −0.007 | 0.006 | 0.012 |
| `flow-24` (mean) | +0.007 | −0.05 bps | 0.67 | 0.028 | 0.010 | 0.020 |
| `flow-chg-8` (shock) | +0.006 | 0.09 bps | 0.50 | 0.001 | 0.000 | 0.000 |
| `flow-diverge-8` | −0.002 | 0.03 bps | 0.33 | 0.058 | −0.000 | −0.003 |
| `flow-gate-mom16` | +0.028 | 0.31 bps | 0.50 | −0.087 | 0.004 | 0.030 |
| `flow-xs-8` | −0.029 | −0.71 bps | 0.33 | −0.061 | 0.003 | 0.005 |
| `flow-xs-24` | −0.006 | −0.47 bps | 0.50 | −0.014 | 0.004 | 0.008 |
| `mom-16` (reference) | +0.102 | 2.13 bps | 0.67 | −0.185 | 0.008 | 0.030 |

At 15m the same families are all ≤ 0 except `flow-diverge-8` (+0.020, 5/8 streams, stability 0.67,
break-even 0.08 bps); `flow-1` is −0.126, IC −0.007. Controls: oracle +12.26 (1h) / +13.18 (15m),
random ≈ 0, mirrored exactly.

**Read.** Order flow carries no *directional* edge at either bar size, and it does not improve
momentum (`flow-gate-mom16` is worse than `mom-16` at 1h, +0.028 vs +0.102). But it is **independent**:
the 1h mean pairwise flow correlation across the 8 majors is **0.020** (vs 0.623 for returns) — flow is
a near-idiosyncratic state variable, and the arms' correlation with the price basket is ≤ 0.09. So the
input passes the *independence* half of L07's bar and fails the *edge* half.

**Boundary (honest).** The taker-buy ratio is an *aggregate over the bar*: intra-bar order-flow
imbalance — the phenomenon with genuine predictive power at sub-minute horizons — is already destroyed.
The bar model here (1h/15m) cannot express the trade that would exploit it, and a tick/aggTrade
harvest is out of scope for this model. L07 stays open for the *other* mechanisms (open interest,
liquidations), which are positioning state variables rather than order flow.

---

## F-16 — Volatility is forecastable (simple EWMA); causal vol-targeting mainly buys drawdown, not a trustworthy Sharpe. [SUPPORTED — with a magnitude caveat]

**Experiment:** `e11_vol.js`. **Artefact:** `results/e11_vol_1h.json`.

**(A) Forecast skill** — 1h basket, fit first half / score second half, QLIKE on the next bar's
realised variance (lower is better):

| forecaster | pooled QLIKE | beats trailing baseline |
| --- | ---: | ---: |
| trailing 1-day vol (baseline) | −8.878 | — |
| **EWMA(λ = 0.94)** | **−8.952** | **8/8 symbols** |
| HAR, log-RV, rolling refit | −7.840 | 0/8 |
| HAR, log-RV, fixed first-half fit | −7.819 | 0/8 |

Volatility **is** forecastable — the EWMA beats the trailing baseline on every symbol — but the added
HAR complexity does **not** pay at 1h. (Both HAR variants are de-biased for the lognormal back-transform,
`exp(· + s²/2)`; an un-debiased first draft under-forecast variance ~6.5× and read −5.2.)

**(B) Causal vol-target sizing** (EWMA λ = 0.94, cap 4×, mean leverage 1.46) applied to the honest
carry book (L03):

| book | annualised | Sharpe | max drawdown | serial design effect |
| --- | ---: | ---: | ---: | ---: |
| carry, unsized | +4.78 % | 0.96 | 10.2 % | 234 |
| carry, **vol-targeted** | +7.45 % | **6.67** | **0.71 %** | 24 |
| carry, vol-targeted (cap 2×) | +7.26 % | 7.12 | 0.71 % | — |
| carry, inverse-vol across symbols | +5.36 % | 1.15 | 9.4 % | — |

Control: sizing a seeded random position series *reduces* its Sharpe (0.40 → 0.16), so sizing is not
mechanically inflating a zero-mean series.

**Read — with the F-11 caveat.** Two claims are robust and useful: vol-targeting **cuts the drawdown
~14×** (10.2 % → 0.7 %) and **cuts the serial design effect ~10×** (234 → 24) — it removes most of the
vol-clustering dependence that made carry's raw Sharpe hard to read. The *level* of the sized Sharpe
(6.7) is **not** a deployment claim: the carry P&L is a yield with a different risk profile (capacity,
funding-regime and basis risk, a single ~3-year sample, `markPrice` smoothing), and vol-targeting a
positive-drift yield mechanically amplifies the calm periods. That is exactly the "implausibly large
Sharpe is a signal, not a result" case (F-11), so it is recorded as a lead to investigate, not banked.
The modest, credible version is **inverse-vol across symbols** (Sharpe 0.96 → 1.15, DD 10.2 % → 9.4 %),
which is what R4 recommends.

**Revision (CYCLE-006) — re-measured on the extended window, and the caveat gets a better explanation.**

| book | annualised | Sharpe | max DD | design effect (raw → winsorised) |
| --- | ---: | ---: | ---: | ---: |
| carry, unsized | +9.05 % | 4.54 | 7.96 % | 99.5 → 11.8 |
| carry, **vol-targeted** (cap 4×, mean lev 1.63) | +9.33 % | **8.05** | **1.33 %** | **5.98 → 6.22** |
| carry, vol-targeted (cap 2×) | +8.61 % | 7.99 | 1.33 % | — |
| carry, **inverse-vol across symbols** | +11.01 % | **10.66** | **0.69 %** | — |
| control: seeded random position, unsized → sized | — | 0.38 → 0.83 | — | — |

The important change is *why* sizing helps: it collapses the design effect **99.5 → 6.0**, and unlike
the old window that is not merely "a yield amplified in calm periods" — it removes the fat tail that
dominates the jackknife (F-20). Vol-targeting is therefore a **risk-model** result, not a return
result, and it is now the strongest sizing claim in the lab (the sized book's design-effect-adjusted
t is ≈ 7.9, computed on the winsorised design effect). Forecast skill is unchanged in kind: on this
sample HAR's rolling log-RV fit **does** beat the trailing baseline on pooled QLIKE (−7.84 vs −8.88),
while EWMA does not (−8.95). Sizing a zero-mean random position series still does not manufacture a
Sharpe (0.38 → 0.83, both ≈ 0).

**Revision (CYCLE-007) — the perp-source test.** Re-measured on the **traded** perp leg through the
same code path (`e11#sizingFromBook`, imported by `e15`): the drawdown reduction is fully
source-independent — vol-targeted DD **1.33 % → 1.27 %** (design effect ≈ 6 either way) and inverse-vol
DD **0.69 % → 0.68 %** — while only the vol-targeted *level* moves, Sharpe **8.05 → 7.79**
(inverse-vol: 10.66 → 10.91). The F-16 conclusion (sizing is a risk-model result; recommend the
inverse-vol form) survives the swap, and the inverse-vol form is the more stable of the two.

---

## F-17 — Cross-sectional carry dispersion: a level-neutral carry book that survives the crashes. [SUPPORTED]

**Experiment:** `e12_xs_carry.js`, `e13_carry_robustness.js`. **Artefacts:**
`results/e12_xs_carry.json`, `results/e13_carry_robustness.json`.

Demeaning the funding rate across the basket and trading the dispersion — long the carry book on the
highest-funding symbols, short it on the lowest, dollar-neutral, weights from `f_{t−1}` (causal):

| book | annualised | Sharpe | max DD | design effect | corr w/ price |
| --- | ---: | ---: | ---: | ---: | ---: |
| flat equal-weight carry (F-04) | +4.78 % | 0.96 | 10.2 % | 234 | −0.015 |
| **xs funding level** | +9.59 % | **6.11** | **1.6 %** | 174 | −0.009 |
| xs funding rank | +7.26 % | 4.83 | 1.1 % | 246 | −0.005 |
| xs funding only (no basis leg, decomposition) | +5.63 % | 18.5 | 0.02 % | 3.7 | −0.003 |
| shuffled-weight placebo | −0.11 % | −0.08 | 3.0 % | 0.3 | +0.012 |

The weights carry real information (the shuffled placebo is ≈0), the book is uncorrelated with price
(as the flat book is), and the cross-sectional construction cuts the basis-risk drawdown ~6×.

**Heavy caveats (why this is not banked).** The raw Sharpes (6.1, 18.5) trip F-11; the design effect
of ~174–246 means only ~13–18 independent observations; and, decisively, the entire basis-marked
window starts **2023-10-31** — the repo's funding files carry `markPrice = 0` before then, so
**every** basis-marked result in the lab (F-04, F-16B, F-17) lives in a ~2.9-year positive-funding
regime with **no crash** (2021-05 and 2022 are outside it). A carry book's drawdown is a crash
phenomenon, so the 1.6 % is almost certainly understated. Credible claims: relative funding is
informative, and the cross-sectional construction materially reduces basis-risk drawdown. CYCLE-006
extends the mark-price history to test this through a crash.

**Revision (CYCLE-006) — the extension was done, and the dispersion book passed the test.**
Re-measured over **6.0 years / 6 558 periods** (2020-09 → 2026-09) with the F-18 bugs fixed:

| book | full history | **old window** | max DD | corr price | 2022 bear | FTX month |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| flat equal-weight carry | 4.54 | **10.27** | 7.96 % | −0.01 | **−1.43** | **−5.12** |
| xs funding level | 3.27 | **13.90** | 6.63 % | +0.08 | +2.33 | +5.19 |
| **xs funding rank** | **5.03** | **14.14** | **2.93 %** | +0.08 | +2.98 | +5.51 |
| xs funding only (no basis leg) | 6.68 | 18.53 | 0.09 % | +0.04 | — | — |
| shuffled placebo | 0.33 | 0.27 | 8.7 % | — | — | — |

Cross-year consistency (2021–2025): flat **4/5** positive (mean Sharpe 8.90, t 2.56); xs level **5/5**
(10.34, t 4.48); **xs rank 5/5 (11.84, t 5.14)**. Permutation placebo over **40 seeds**: mean −0.03,
sd 0.40 → xs rank sits at **z = 12.6** (xs level z = 8.2). Significance (F-20-aware): flat Sharpe 4.54,
design effect 99.5 raw / 11.8 winsorised, bootstrap CI [1.85, 9.88]; xs rank 5.03, DE 168.6 / **2.52**,
CI [3.27, 12.79]. Max |return| in the xs-rank book is 5.62 % (2022-11-10 08:00, the SOL FTX basis).

**Read.** The dispersion book's advantage is *not* a benign-window artefact — it strengthens on the
crash-containing history, and its Sharpe is now **higher** than the flat book's with **one-third** the
drawdown. The mechanically important difference is *where the tail is*: the flat book's worst periods
are 2022 (Sharpe −1.43) and the FTX month (−5.12) because it is long the common carry level — which is
exactly what collapses in a deleveraging — while the dollar-neutral dispersion book reads **+2.98** and
**+5.51** in those same windows. That is the diversification the project is short of (J3), from a
variable already in the data. The caveats that remain: the rank book's raw design effect is large
(168.6), so the evidence is the winsorised/cross-year/bootstrap readings; and every one of these
numbers marks the perp leg at the **mark price**, which is a smoothed index (lead **L14**).
**Updated (CYCLE-007, F-22):** re-measured on the **traded** perp close, the numbers hold — xs rank
Sharpe 4.98 with a 3.05 % drawdown, advantage over the flat book 4.92 pp (vs 5.03 pp) — so the
mark-price leg is not doing any of this work.

---

## F-18 — The carry pipeline carried four independent measurement bugs; all four were silent. [SUPPORTED — critical methodology]

**Experiment:** `e14_data_integrity.js` (the regression tests), `e3_carry.js` / `lib/lab.js` (the fixes).
**Artefacts:** `results/e14_data_integrity.json`, `results/e3_carry.json`. **Lead:** L10 (rows l–p).

Restoring the mark-price history (CYCLE-006) surfaced four defects, none of which threw an error, none
of which was visible in a plot, and each of which moved the headline number. They are join bugs between
three data sources, which is why they were invisible: every one produced a *plausible* series.

| id | bug | effect if unfixed | fix |
| --- | --- | --- | --- |
| L10-l | `mark_8h.json` stored marks as `round(price*100)` integers | DOGE had **67 distinct values** over 3 621 bars; ~1 %/period fake basis noise → flat carry Sharpe **4.77 → 2.14** | store floats; `e14#mark_precision` asserts `uniqueRatio ≥ 0.5` |
| L10-m | the candle files end **2026-09-19**, the funding files run to **2026-09-24**; `loadCloseLookup` carry-forwards the last close forever | spot frozen while the mark moves → ±5 %/8h "basis"; pooled kurtosis 1056; Sharpe **4.77 → 2.14** | `lookup.lastClose` + a skip guard in `loadCarryBook`; `e14#no_frozen_spot` |
| L10-n | alt 1h candle files have a few dozen missing bars (0.04–0.16 % of hours) | an 8h return computed over 9h/10h and mispaired with an 8h mark leg | `lookup.exact(t)` — bar must END exactly at `t`; `e14#candle_grid` |
| L10-o | **SOLUSDT used 2h/4h funding 2022-11-09 → 2022-11-18** (the FTX crash); a 10:00 row belongs to the 16:00 window | a plain `Map.set(roundGrid(t), rate)` kept **1 of 4** payments — the crash funding understated ~4× exactly where it matters | `loadFundingBuckets` SUMs rows into 8h buckets; `e14#funding_buckets` |

Each of the four moved the headline number. The measured sequence on the flat book, as the fixes went
in: coarse integer marks + frozen tail + lenient lookup + grid-collapsed funding = **0.478**; precise
marks alone (tail bug still present) = **2.143**; plus the tail guard = **4.769**; plus exact-bar
alignment and funding buckets = **4.54**. So the bugs together understated the flat book by ~9.5×, and
bug m's direction of failure is the dangerous one: it made the strategy look **worse**, so no
"implausibly large Sharpe" alarm (F-11) could have caught it. The lesson recorded in `data/README.md`:
**`loadCloseLookup` alone is safe for one series and a trap whenever two sources are compared** — a
distinction the lab had been blurring. `e14` now runs on every `run_all` and reports `pass` beside the
controls'.

---

## F-19 — The carry complex's old 2.9-year window flattered every book by 2–4×. [SUPPORTED — closes L12's main caveat]

**Experiment:** `e13_carry_robustness.js`. **Artefact:** `results/e13_carry_robustness.json`.

The same books, measured on the full 6.0-year history and on the post-2023-10 window that the
`markPrice = 0` gap enforced:

| book | full history | old window | pre-2023-11 |
| --- | ---: | ---: | ---: |
| flat equal-weight carry | 4.54 | **10.27** | 4.29 |
| xs funding level | 3.27 | **13.90** | 3.63 |
| xs funding rank | 5.03 | **14.14** | 5.53 |
| xs funding only | 6.68 | **18.53** | 7.71 |
| shuffled placebo | 0.33 | 0.27 | 0.42 |

The window *contains* the deflating regimes rather than being a fair sample of them: the flat book's
2022 Sharpe is **−1.46** and its FTX-month Sharpe is **−5.12**. This is F-01's phenomenon in a different
family — a carry book is smoother and safer than reality in any window without a deleveraging event —
and it is the reason the extension was the highest-value test in the queue. Note the placebo is flat
across all three windows (0.27–0.42), which is the control behaving.

---

## F-20 — The lab's own design-effect helper is outlier-fragile; report the winsorised twin. [SUPPORTED — methodology]

**Experiment:** `e13_carry_robustness.js`, `lib/lab.js#robustDesignEffect`. **Artefact:** as F-19.

`serialDesignEffect` jackknifes the **Sharpe**, and a Sharpe is a ratio: one extreme observation
inflates the jackknife SE far more than it inflates the true long-run variance. On the flat carry book
the single FTX observation (SOL basis **−19.5 %** in one 8h period, 2022-11-10 08:00) gives

| treatment | flat book design effect |
| --- | ---: |
| raw (`serialDesignEffect`) | **99.5** |
| winsorised at ±3σ (`robustDesignEffect`) | **11.8** |
| with 2022-11 deleted | **11.0** |

so ~88 % of the raw figure is one bar. Reporting only the raw DE would have declared the carry complex
"not significant" for the wrong reason, and reporting only the winsorised one would hide a real fat
tail. The lab now reports **both** plus a **block bootstrap** CI (flat [1.85, 9.88]; xs rank
[3.27, 12.79]) and a **cross-year** t (flat 2.56; xs rank 5.14, 5/5 years positive). Generalisation:
for any fat-tailed return series, a design effect is a statement about the largest observation until
proven otherwise.

---

## F-21 — On a crash-containing history the dispersion book survives and basis reversion becomes significant. [SUPPORTED]

**Experiment:** `e13_carry_robustness.js` (regimes/windows), `e7_basis_reversion.js` (reversion),
`e12_xs_carry.js` (placebo). **Artefacts:** `results/e13_carry_robustness.json`,
`results/e7_basis_reversion.json`, `results/e12_xs_carry.json`.

**(a) Regime breakdown** — Sharpe / max DD by named window:

| window | flat carry | xs funding level | xs funding rank |
| --- | ---: | ---: | ---: |
| melt-up 2021 H1 | +25.33 / 0.7 % | +13.15 / 0.7 % | +20.26 / 0.3 % |
| crash 2021-05 | +3.51 / 0.2 % | +12.08 / 0.2 % | +14.09 / 0.2 % |
| bear 2022 | **−1.43** / 7.1 % | +2.33 / 6.6 % | +2.98 / 2.9 % |
| LUNA 2022-05 | **−4.19** / 0.9 % | +12.70 / 0.2 % | +13.18 / 0.2 % |
| **FTX 2022-11** | **−5.12** / 7.1 % | **+5.19** / 6.6 % | **+5.51** / 2.9 % |
| recovery 2023 | +6.96 / 0.6 % | +8.82 / 0.5 % | +11.55 / 0.2 % |
| bull 2024 | +15.69 / 0.1 % | +15.71 / 0.1 % | +15.18 / 0.1 % |
| 2025 / 2026 | +5.75 / +3.50 | +13.70 / +13.66 | +13.84 / +13.50 |

**(b) Basis reversion** (F-10 revised): IC **8/8 positive** (0.107 … 0.527), convergence book Sharpe
**+9.15** (+13.1 %/yr), market corr +0.09, design effect 395 raw → **7.84 winsorised** (t ≈ 8.0).

**Read.** The flat book is *long the common carry level*, which is precisely what collapses in a
deleveraging — hence −4.19 in the LUNA month and −5.12 at FTX, and 4/5 positive years. The
dollar-neutral dispersion book is *long relative carry*, which does not collapse with the level: it is
**positive in every one of the nine named windows and all five full years**, sits at **z = 12.6**
outside a 40-seed permutation null, and has a third of the flat book's drawdown. That is the shape a
useful stream should have, and it is the strongest carry-side result in the lab.

**Two caveats, both load-bearing.** (i) The rank book's raw design effect is 168.6 — the evidence is
the winsorised (2.52), cross-year, and bootstrap readings, not the raw Sharpe. (ii) ~~**Every one of
these numbers marks the perp leg at Binance's mark price, a smoothed index; you cannot trade the
mark.**~~ **Resolved (CYCLE-007, F-22):** re-measured with the perp leg set to the **traded** 8h close
(`data/perp_8h.json`), the dispersion book reads Sharpe **4.98** (vs 5.03) at a **3.05 %** drawdown (vs
2.93 %), with the advantage over the flat book preserved (4.92 pp vs 5.03 pp). The mark-vs-traded
spread itself is 2–5 bps sd with a small positive autocorrelation — a real but negligible smoothing.
So (ii) is closed and only the design-effect caveat remains.

---

## F-22 — The mark price is a faithful proxy: the carry complex is not a smoothing construction. [NEGATIVE — suspicion falsified]

**Experiment:** `e15_traded_basis.js`. **Artefacts:** `results/e15_traded_basis.json`,
`results/e14_data_integrity.json`. **Data:** `data/perp_8h.json` (the **traded** perp close, harnessed
from `futures/um` klines — recipe in `data/README.md`). **Lead:** L14 (closed).

Every basis-marked number in the lab (F-04, F-10, F-16B, F-17, F-21) marks the perp leg at Binance's
**mark price**, which is a *smoothed index* — median spot across venues plus a moving average of the
basis. A spread measured against a smoothed series can be mechanically mean-reverting, and a smoothed
series can have artificially small extremes, so both L11's signal and L12's low drawdown were open to
the objection that they are constructions. `e15` re-measures everything with the perp leg set to the
**traded 8h close**, through the identical code path (`loadCarryBook(symbols, {perp})`).

| reading | mark leg | **traded leg** | ratio |
| --- | ---: | ---: | ---: |
| flat delta-neutral carry, Sharpe | 4.54 | **4.65** | 1.02 |
| flat carry, max drawdown | 7.96 % | **7.96 %** | 1.00 |
| dispersion book (rank), Sharpe | 5.03 | **4.98** | 0.99 |
| dispersion book, max drawdown | 2.93 % | **3.05 %** | 1.04 |
| dispersion advantage over flat (drawdown) | 5.03 pp | **4.92 pp** | 0.98 |
| basis reversion, IC median / positive | 0.430 / 8 of 8 | **0.391 / 8 of 8** | — |
| basis reversion, convergence Sharpe | 9.15 | **9.17** | 1.00 |
| basis reversion, robust design effect | 7.84 | **7.61** | — |
| vol-targeted carry, Sharpe | 8.05 | **7.79** | 0.97 |
| vol-targeted carry, max drawdown | 1.33 % | **1.27 %** | 0.96 |
| inverse-vol across symbols, Sharpe | 10.66 | **10.91** | 1.02 |
| inverse-vol across symbols, max drawdown | 0.69 % | **0.68 %** | 0.98 |

The mark-minus-traded spread itself is **real but negligible**: mean ≈ ±0.003 %, sd **2–5 bps**, extreme
≤ 1.8 %, and `acf(1) = +0.05…+0.13` on every symbol — a positive autocorrelation, which is exactly the
signature of a lagging/smoothed index, and the only evidence that the smoothing exists at all. It is an
order of magnitude below the basis sd it would have to explain. The traded leg's worst basis is
*smaller* than the mark's in five of eight symbols (SOL 19.53 % → 16.85 %), so the tail is not
manufactured either.

The **sizing** results (F-16/L09) were re-run through the identical shared code path
(`e11#sizingFromBook`, imported by `e15`): the drawdown reduction is fully source-independent
(vol-targeted DD 1.33 % → 1.27 %, design effect ≈ 6 either way; inverse-vol DD 0.69 % → 0.68 %), while
only the vol-targeted *level* moves a little (Sharpe 8.05 → 7.79). So every risk-layer conclusion
survives the perp swap, and the inverse-vol form — the one R4 recommends — is the most stable of all.

**Read.** The suspicion is **falsified**, and because it was pre-registered as the blocking falsifier
for L11/L12/R4/R8, this *strengthens* those results rather than merely failing to weaken them. The
carry complex is tradable as measured. (Residual, recorded: the traded series ends 2026-09-01 and the
mark series 2026-09-19, so the two windows differ by ~18 periods out of ~6 500 — immaterial to any
ratio above.)

---

## F-23 — The dispersion and reversion "improvements" are cost-fragile; the flat carry book is the only cost-robust sleeve. [SUPPORTED — critical practicality]

**Experiment:** `e16_cost_capacity.js`. **Artefact:** `results/e16_cost_capacity.json`. **Leads:** L12,
L11 (cost caveat); **new leads L15/L16.** **Successor to F-22** (L14): F-22 cleared the *price* you
trade; this tests the *cost* of trading it.

Every headline series in the lab is gross — basis P&L + funding, no fees. For the flat delta-neutral
carry book (F-04) that is fine: it is a hold, and its exposure barely changes. But the two books the
lab treats as improvements over flat carry — the cross-sectional **dispersion** book (F-17) and the
timed **reversion** book (F-10) — recompute their weights every 8h from funding ranks / basis z-scores,
so they churn the book. `e16` measures the L1 turnover of each book's *actual exposure vector*, and the
fee at which its mean net return hits zero (`costBps` = the fee on one spot+perp unit).

| book | gross Sharpe | gross %/yr | turnover / yr | **break-even** | net Sharpe @4 bps | @15 bps |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| flat equal-weight carry | 4.54 | +9.05 | **0.2×** | **5422 bps** | 4.54 | 4.53 |
| xs funding level | 3.27 | +21.21 | 876× | 2.42 bps | −2.11 | −15.79 |
| xs funding rank | 5.03 | +15.00 | 803× | **1.87 bps** | −5.62 | −28.85 |
| reversion basisOnly | 9.15 | +13.13 | 465× | 2.82 bps | −3.83 | −36.36 |
| reversion carryPlus | 9.54 | +16.44 | 465× | 3.54 bps | −1.26 | −29.39 |

The rank book — the lab's self-described strongest sleeve — turns over **803× gross notional per year**
(≈2.2×/day) and **breaks even at 1.87 bps**, below a single base-tier perp taker fee; its per-period
gross edge is ~1.4 bp. Level and reversion die the same way (2.4 / 2.8 / 3.5 bps). **Only the flat
book survives**, and by a huge margin, because a delta-neutral hold has a one-off entry turnover; even
re-establishing its hedge every period costs only 0.41×/yr (break-even 2218 bps).

**Read.** F-17/F-10 remain true as *measurements* (the dispersion book's 5.0 gross Sharpe and the
reversion signal's 8/8-positive IC are real in the data); they are **gross-only**. As *trades at an 8h
cadence* they are dominated by the fee. This is the F-11/F-19 class of error — a number true of the
series and false of a strategy. The practical consequence: **R4 (flat inverse-vol carry) is the one
cost-robust sleeve; R8 (dispersion) must find a low-turnover construction (L16) or die as a trade.**
Fee is measured; *impact/capacity* (L15) is not — and at 800×/yr it could be larger than the fee.

**Amendment (CYCLE-009, F-24):** the fragility is a property of the **daily rank reshuffle**
implementation, **not of the signal**. Smoothing the weights cuts turnover ~9× and restores a wide
margin — see F-24.

---

## F-24 — The dispersion edge IS tradable: smoothing the weights cuts turnover ~9× at no gross cost. [SUPPORTED]

**Experiment:** `e17_low_turnover.js`. **Artefact:** `results/e17_low_turnover.json`. **Lead:** L16
(closed). **Answers F-23.**

F-23 showed the dispersion book turns over 803×/yr of gross notional and breaks even at 1.87 bps. But
that turnover is manufactured by recomputing *exact* ranks (and renormalising `Σ|w|=1`) every 8h: tiny
rank swaps between nearly-equivalent vectors become real trades. `e17` builds the book with different
weight policies on the same aligned legs (`e12#legs`) and audits each with the F-23 machinery, with a
reproducibility guard (`rank_daily` reproduces `e12`'s `xsRank` to `maxAbsDiff = 0`).

| policy | gross Sharpe | turnover / yr | break-even | net@4 bps | net@10 bps |
| --- | ---: | ---: | ---: | ---: | ---: |
| rank_daily (F-23 baseline) | 5.03 | 803× | 1.87 bps | −5.62 | −19.75 |
| rank_hold9 | 3.09 | 119× | 7.45 bps | +1.42 | −0.99 |
| rank_ewma_0.25 | 4.12 | 190× | 5.32 bps | +1.02 | −3.60 |
| **rank_ewma_0.1_norm** | **5.18** | **85×** | **12.78 bps** | **+3.55** | **+1.12** |
| level_ewma_0.1 | 3.85 | 83× | 13.28 bps | +2.69 | +0.95 |
| rank_deadband_0.10 | 4.90 | 654× | 2.22 bps | −3.83 | −15.43 |
| rank_tail3 | 4.98 | 846× | 1.87 bps | −5.56 | −19.54 |

The winner — **EWMA-smoothed, renormalised rank weights** (`w_t = 0.9 w_{t−1} + 0.1 w*_t`, `w*` from
funding at `t−1`) — cuts turnover **~9×** and *raises* the gross Sharpe (5.03 → 5.18), because the daily
reshuffle was mostly noise trading; it stays dollar-neutral (`Σw=0`) and price-neutral (corr 0.074). The
break-even rises to **12.78 bps**, so it clears a VIP-maker fee (4 bps) at net Sharpe **+3.55** and still
earns **+1.12 at 10 bps**. Net of 4 bps it is positive in **every crash window** (2021-05 +3.63, bear
2022 +3.33, LUNA +7.85, FTX +7.88) and **7 of 9 regimes** (flat: 6/9, and flat is negative in three of
those crashes). On the **traded** perp leg it holds (gross 5.37, 84×/yr, break-even 12.52 bps, net@4
+3.65, 7/9).

**Read.** The dispersion sleeve is tradable, with a one-line change to the weight construction. F-23
was a property of the implementation, not of the signal. **Caveat:** the edge has decayed — 2025 and
2026 are ≈0/slightly negative net of fees, so the full-history result is carried by 2021–2024. R8 is
un-gated *given the smoothed weights*; capacity/impact (L15) is now the binding physical limit.

---

## F-25 — Basis timing is a risk tool, not an alpha: the pure convergence edge is unrescuable, the timed-carry overlay is tradable but buys drawdown, not Sharpe. [NEGATIVE as alpha / positive as overlay]

**Experiment:** `e18_reversion_smoothing.js`. **Artefact:** `results/e18_reversion_smoothing.json`.
**Lead:** L11 (closed in both directions). **Follows F-24** (the dispersion rescue).

F-24 showed the dispersion sleeve's cost-fragility was an implementation artefact; smoothing the weights
rescued it. The same treatment was applied to the reversion book (`e7#pooledLegs` → nine weight policies
→ `e16#audit`; the `daily` policy reproduces E7 exactly, `maxAbsDiff = 0`).

| variant | turnover / yr | gross Sharpe | break-even | net@4 | net@10 |
| --- | ---: | ---: | ---: | ---: | ---: |
| basisOnly daily (F-23) | 465× | 9.15 | 2.82 bps | −3.83 | −22.70 |
| basisOnly ewma_0.1 | 39× | **2.66** | 4.24 bps | +0.15 | −3.61 |
| carryPlus daily (F-23) | 465× | **9.54** | 3.54 bps | −1.26 | −17.24 |
| carryPlus ewma_0.1_norm | 43× | 5.04 | **20.33 bps** | **+4.05** | **+2.56** |

* **The pure convergence signal is genuinely fast.** Smoothing cuts turnover (465× → 39×) but *destroys*
  the gross Sharpe (9.15 → 2.66): its edge lives in the fast basis ticks, so a slower book is not a
  cheaper book — it is a different, worse one. Break-even barely moves (2.82 → 4.24 bps). **Unrescuable,
  cost-fragile — measured, not assumed.**
* **The z-timed carry book is rescuable, and smoothing exposes it.** The 9.54 gross Sharpe was churn
  (smoothed: **5.04**, just above flat carry's 4.54 — the F-11/F-20 class, now *explained*). At equal
  gross exposure the smoothed timed-carry book earns net Sharpe **4.05** with a **2.09 %** drawdown,
  versus flat carry's 4.54 / **7.96 %** — it gives up ~0.5 Sharpe to cut the drawdown ~4×.

**Read.** Basis timing does not add alpha: the convergence spread is untradable after fees, and the
timed-carry overlay is beaten on Sharpe by the free flat hold (R4). What the overlay *does* offer is a
~4× drawdown reduction at equal exposure — so it is an optional **risk overlay on R4**, judged by its
drawdown, not its Sharpe. L11 closes with both halves answered.

---

## F-26 — Impact, not the fee, is the binding limit: the dispersion sleeve's capacity is single-digit tens of millions; the flat carry hold is not impact-limited. [SUPPORTED — capacity]

**Experiment:** `e19_capacity_impact.js`. **Artefact:** `results/e19_capacity_impact.json`. **Data:**
`data/perp_flow_8h.json` (new: the perp 8h **quote volume** and trade count the repo discards, on the
same grid as the traded perp closes). **Lead:** L15 (closed). **Follows F-23/F-24/F-25** (fee cleared).

`e16` measured the fine (the *fee*) and F-24/F-25 showed smoothing pays it. But a book also moves the
price: a square-root impact law `impact = Y·σ·√(Q/V)` turns the per-symbol trade `Q_j = |dw_j|·G` into a
per-period cost that, in bps of gross notional `G`, is exactly `c_t·√G` (Almgren/Barzykin form; `Y` is
the O(1) adverse-selection coefficient; `V` is the SAME bar's dollars traded). `e19` measures it on the
E16/E17/E18 books with `Y ∈ {0.5, 1, 2}` — worth doing because capacity scales as `1/Y²`.

Perp ADV (USDT per 8h, 2020-07…2026-08): BTC **4.66 B**, ETH 2.80 B, SOL 0.66 B, XRP 0.39 B, DOGE
0.33 B, BNB 0.22 B, ADA 0.16 B, LINK **0.12 B** — so the thin alts, not BTC, set the limit.

| book | gross Sharpe | turnover / yr | break-even | net@4 (no size) | capacity $ @ 4 bps fee — Y=0.5 / **Y=1** / Y=2 |
| --- | ---: | ---: | ---: | ---: | ---: |
| flat equal-weight carry | 4.54 | ~0× | 5422 bps | +4.54 | 201 B / **50 B** / 12.6 B † |
| xsRank_daily (F-23 baseline) | 5.03 | 803× | 1.87 bps | −5.62 | 0 / **0** / 0 |
| **xsRank_ewma0.1_norm** (F-24 winner) | 5.18 | 85× | 12.78 bps | +3.55 | 52.8 M / **13.2 M** / 3.3 M |
| xsLevel_ewma0.1_norm | 4.66 | 86× | 16.27 bps | +3.51 | 92.4 M / **23.1 M** / 5.8 M |
| revCarry_ewma0.1_norm (F-25 overlay) | 5.04 | 43× | 20.33 bps | +4.05 | 381 M / **95.4 M** / 23.8 M |

† the flat book is a *hold* (turnover ≈ 0), so its "capacity" reflects only the one-off entry trade; a
real position would be tranched, and its actual limit is perp open interest / spot depth — **measured in
F-28: OI caps the flat hold at tens of millions, not $50 B**. The dispersion book's capacity is not an
entry artefact: it is 85×/yr of steady turnover.

The Sharpe erosion is steep and is the point: the F-24 dispersion book goes **+3.55 → +2.57 at $1 M →
+0.45 at $10 M → −5.0 at $100 M** (4 bps fee, Y=1); at a taker fee (11 bps) its capacity is **$0.5 M**.
At its capacity the binding symbol is **DOGE at ~1 % of ADV** (the top/bottom funding rank concentrates
weight in the extreme alt), which is why the evenly-weighted timed-carry overlay carries ~**7×** the
capacity despite a *lower* gross Sharpe.

**Watch the margin:** impact on the perp leg only is charged here, so the spot hedge's own impact is
omitted — every capacity above is therefore an **upper bound**. And the whole table scales as `1/Y²`.

**Read.** The lab's best *Sharpe* is not its most *deployable* sleeve. F-23 removed the fee objection and
F-24/F-25 restored the "improvements", but impact re-splits the complex: the **flat carry hold** is the
scalable one (it barely trades, so nothing to impact), while the **dispersion** and **timed-carry**
improvements — which is what F-17/F-24/F-25 promoted — are capacity-bound to roughly **$10 M–$100 M**
(Y=1, maker fees), and to well under $1 M at taker fees. L15 is therefore closed with the answer that
capacity, not cost, is the physical limit on the *improvements*, and the flat book is the only sleeve
that scales. A capacity-aware construction (cap/vol-scale the per-symbol weight) is the obvious next
lever — **tested in CYCLE-012/F-27**.

---

## F-27 — A per-symbol position cap roughly doubles the dispersion sleeve's capacity and de-risks it. [SUPPORTED — capacity]

**Experiment:** `e20_capacity_aware.js`. **Artefact:** `results/e20_capacity_aware.json`. **Lead:** L17.
**Follows F-26** (which measured the capacity) and **F-24** (the smoothed construction).

F-26 left one lever untested: F-24's renormalised rank book can put up to **50 % of gross in a single
symbol** (`max|w| = 0.5` — the EWMA state cancels when ranks flip, then the `Σ|w|=1` renorm re-inflates
it), and the thin alt is the binding one at capacity. `e20` applies capacity-aware transforms to the
F-24 target on the same legs and re-measures both the F-24 audit and the F-26 capacity with the same
model. The decisive distinction is **soft cap** (clip then renormalise — the renorm *re-inflates* the
clipped position) vs **strict cap** (clip and hold it — the book is genuinely under-invested in
concentrated periods).

| construction | gross Sharpe | turnover / yr | net@4 | DD | design eff. | capacity $ (Y=1 / Y=0.5), 4 bps | regimes +ve (of 9) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline (F-24) | 5.18 | 85× | +3.55 | 0.94 % | 7.9 | 13.2 M / 52.8 M | 7 |
| soft cap 0.18 | 8.62 | 72× | +5.83 | 0.30 % | 4.8 | 13.5 M / 54.1 M | 8 |
| **strict cap 0.12** | 6.37 | 30× | +4.91 | 0.48 % | 4.5 | **28.4 M / 113 M** | **9** |
| **strict cap 0.125** | 6.97 | 35× | +5.32 | 0.47 % | 2.2 | **26.7 M / 107 M** | 8 |
| strict cap 0.13 | 7.25 | 40× | +5.34 | 0.33 % | 1.4 | 20.3 M / 81.1 M | 8 |
| strict cap 0.14 | 8.24 | 49× | +5.97 | 0.24 % | 2.9 | 18.3 M / 73.4 M | 8 |
| strict cap 0.175 | 8.71 | 67× | +6.00 | 0.30 % | 3.8 | 14.0 M / 56.0 M | 8 |
| ADV-tilt (p=1) | 1.11 | 87× | −1.75 | 7.8 % | 8.5 | 0 | 4 |
| drop 2 thinnest | 3.82 | 86× | +2.45 | 1.2 % | 3.0 | 8.9 M / 35.7 M | 7 |

**A true position limit is the fix.** Capping each `|w_j|` at **≈12 % (1/k)** and *not* renormalising
takes capacity from **$13.2 M to ~$27 M** (2.0–2.1×) — a smooth, monotone trade (0.12→$28 M,
0.13→$20 M, 0.15→$15 M, 0.175→$14 M, 0.20→$15 M) — while cutting turnover 85×→30×, drawdown
0.94 %→0.47 %, and the design effect 7.9→2.2, and turning 7/9 net-of-fee regimes positive into **8–9/9**.
Loosening to 0.175 instead maximises the *Sharpe* (8.71, above the baseline in **every** calendar year)
but gives up the capacity gain; the choice inside 0.125–0.175 is a size/Sharpe preference.

**Two traps the exercise exposed.** (i) The *soft* cap — clip then renormalise — buys **no** capacity
($13.5 M): renormalising a clipped book just scales the remaining positions back up, so the limit is
cosmetic. The limit must actually limit. (ii) Caps **below ~0.12 (=1/k)** are **degenerate**: once every
weight is clipped to the same magnitude the rank information is destroyed, and the "capacity" explodes
($348 M at 0.10) while the Sharpe collapses to 3.1 and the design effect jumps to 30 — a low-turnover,
low-information book, not a rescue. And the *removal* variants fail the other way: dropping the thin
symbols, or tilting weights by ADV, destroys the edge (gross Sharpe 1.1–3.8), because the funding-rank
*ordering* is the signal and both transforms edit it.

**Caveats.** The capacity doubling is the robust, monotone result (it is turnover, not a lucky window);
the large *Sharpe* lift at caps 0.14–0.20 is in-sample and should not be banked until a pre-registered
port test, though it is above the baseline in every calendar year. Guards: `baseline` reproduces E17's
`rank_ewma0.1_norm` exactly (`maxAbsDiff = 0`); a cap above `max|w|` reproduces the baseline; every
capacity comes from `e19#capacityOf` (one cost model).

**Read.** The F-26 capacity is **improvable ~2×** by the one change the ranking construction omitted — a
per-symbol position limit — which also lowers turnover, drawdown and dependence. R8's port spec is amended
to include a **strict per-symbol gross cap at ~1/k (12.5 %)**; capacity becomes ~$27 M (Y=1, 4 bps) /
~$107 M (Y=0.5). It stays a small-size sleeve, but a cheaper and safer one.

## F-28 — Open interest carries no directional signal, but it prices the flat book's size — and the whole carry complex is a ~$5–70 M strategy. [NEGATIVE for the signal / SUPPORTED for capacity]

**Experiment:** `e21_open_interest.js`. **Artefact:** `results/e21_open_interest.json`. **Data:**
`data/open_interest_8h.json` (new — Binance `futures/um` daily metrics, 5-min rows aggregated to the 8h
funding grid: OI contracts + **USDT notional** + toptrader long/short ratio; BTCUSDT from 2020-09, the
other seven from 2021-12, ~42 700 symbol-periods). **Lead:** L07 (positioning half).

**Signal: the OI *change* is nothing.** Δlog(OI notional) predicts the next 8h return with a pooled
information coefficient of **0.020** (per symbol 0.00–0.06) and the next funding rate with IC 0.027. A
causal dollar-neutral book on the OI change scores gross Sharpe **0.96** — but at **1501×/yr turnover**,
so its break-even is **1.89 bps** and it is deeply negative net of any fee (net@4 **−1.07**): no tradable
signal. So the OI *change* is independent but directionless. **The toptrader ratio, however, is a
different story when used cross-sectionally — see F-29** (the naive *level* IC of the ratio is ≤ 0.02, so
it reads as nothing, but the demeaned cross-section fades the crowded side for a modest Sharpe; the
level-IC test cannot see it).

*Corrected in part by **F-45** (CYCLE-028): the "no tradable signal" verdict rested on the **daily** book
(1501×/yr, 1.89 bps) — the same implementation artefact F-23→F-24 exposed for the funding book. EWMA-
smoothed, the OI book's break-even reaches **8.9–14.7 bps** with net@4 **+0.5…+0.7** (3 of 6 policies clear
4 bps), independent of carry (corr 0.007) — but it is **weak, churny (338×/yr) and recent-regime** (2023
−0.86 net@4; net halves 0.07/1.47), so it is not a port candidate. The correct verdict is "weak signal",
not "no signal"; the *capacity* half of this finding is untouched.*
`ic_dLogOI_contemporaneousRet = 0.595` is retained in the artefact as the reason to distrust any OI
"signal": OI *notional* embeds the price move of its own window, so a one-index slip (using the
contemporaneous leg) manufactures IC 0.60 and Sharpe **17** — this experiment hit exactly that trap and
the artefact now carries the lag profile that exposes it (F-11 class; see L10). A second, silent bug is
now fixed too: the books originally treated a missing field as `0` and then demeaned, which gave the
*absent* symbols a large weight in the early window (L10-r).

**Capacity: the missing number.** A held position is limited by how big the market is, not only by the
cost of trading it. The flat carry book holds `G/k` short perp per symbol; `G/k` reaches 1 % / 5 % / 10 %
of the thinnest symbol's mean open interest at `G =` **$6.9 M / $34.3 M / $68.6 M** (thinnest = LINK,
mean OI $86 M; using each symbol's *historical-minimum* OI instead, $2.3 M / $11.5 M / $23.0 M). The
F-24 dispersion book's OI capacity is $4.7 M / $23.4 M / $46.8 M. F-26 had flagged this ("the flat book
is not impact-limited; its real limit is open interest — unmeasured"); it is now measured, and it is
**orders of magnitude below its $50 B impact capacity**.

**Read.** The flat hold is **OI-limited to tens of millions**, and the turnover-heavy sleeves are
impact-limited to tens of millions (F-26/F-27). The two limits are the same order of magnitude, so the
honest statement about the whole carry complex is that it is a **~$5–70 M strategy** — bounded by *both*
open interest and impact, not by Sharpe. L07's positioning half closes negative as a *signal* and
positive as a *sizing tool*; the liquidation-print half remains untested. Caveat: the OI-fraction
threshold is a judgment call (1 % conservative, 10 % aggressive), the binding symbols are the thin alts,
and R4's inverse-vol weights would tilt away from them and raise the flat number.

*Superseded in part by **F-41** (CYCLE-024): the OI bounds quoted here are `f·mean(OI)/mean|w|` — a ratio
of means (average-case). The desk's constraint is the min of ratios, **2.6–8.8×** smaller, and the binding
is a single thin symbol (LINK) during dislocations. Use F-41's distribution, not this point estimate.*

---

## F-29 — The toptrader positioning ratio is a modest contrarian cross-sectional signal — and it is *only* visible cross-sectionally. [SUPPORTED — lead]

**Experiment:** `e21_open_interest.js`. **Artefact:** `results/e21_open_interest.json` (key
`signalBooks.topLS_neg`, `topLSRobustness`). **Data:** `data/open_interest_8h.json` (field `topLS` =
Binance `sum_toptrader_long_short_ratio`, the position-weighted top-trader long/short ratio, on the 8h
grid). **Lead:** L18 (opened this cycle). **Cost audit:** `e16#audit`.

**What.** A causal, dollar-neutral cross-sectional book that **fades** the top-trader ratio (at period
`i`, short the symbols whose top-trader accounting is most long, long the least) scores gross Sharpe
**1.055**, turnover **125.8×/yr**, break-even **15.1 bps** — **net@4 = +0.77**, net@5 = +0.70, net@10 =
+0.35 (positive across the repo's own 5–10 bps cost assumption). Its profile: positive in **4/4
quartiles** (1.18 / 1.38 / 0.31 / 1.52) and **5/6 calendar years** (2021 +1.21, 2022 +0.65, 2023 +1.76,
2024 +0.07, 2025 +1.57, 2026 +1.69); half-samples 1.27 / 0.84; a 30-period block bootstrap puts the 5th
percentile of the Sharpe at **+0.36** (95 % CI excludes 0); against a 40-seed cross-sectional
label-shuffle placebo the real book sits at **z = 2.1**.

**Why the level-IC test missed it, and why that matters.** The *undemeaned* ratio has pooled next-8h IC
≤ 0.02 (as F-28 reports for a per-symbol/level read) — a level that is nearly constant within a symbol
carries no *time-series* information. But the **cross-sectional** ordering does: the mechanism is
crowding (when top-trader positioning piles onto one side of the basket, that side underperforms over the
next 8h). This is F-03's lesson — *demeaning across the basket is the power lever* — applied to the one
new field the repo could add for free.

**It is not just funding.** The same contrarian construction on the **funding rank** (long low-funding,
short high-funding, on *spot* returns) has Sharpe **0.49**, and its return series correlates only
**0.21** with the top-trader book — so the ratio carries positioning information beyond funding. The book
is essentially uncorrelated with the funding-rank *carry* book (regression β = −0.013; residual Sharpe
1.06) and with 8h reversal (corr −0.03). The fade direction is the profit: the opposite sign is
−1.055/−0.96/−0.33 for topLS/OI/taker as expected.

**Read.** A genuine, independent, *modest* new edge from free data — the lab's first positive result in
L07's family, and the first signal found in the positioning fields. It is not banked: it is a single
in-sample history with no held-out block, turnover is high (126×/yr, comparable to F-24's 85×), and the
Sharpe (~1) is an order of magnitude below the carry sleeves. It needs an out-of-sample split and a
capacity read (per-symbol concentration) before R7 should be revisited. L18 carries it — and the
follow-up (F-30, CYCLE-014) runs exactly those tests.

---

## F-30 — The toptrader fade passes the held-out, cost and confound tests; smoothing makes it cheap. [SUPPORTED]

**Experiment:** `e22_toptrader_validate.js`. **Artefact:** `results/e22_toptrader_validate.json`.
**Lead:** L18 (validated). **Follows F-29** (the raw edge) and applies the four tests the lab demands of
any improvement: held-out sign, cost, confound, capacity.

**Held-out (the fade sign is a prior, not a fit).** The book is parameter-free, so the honest split is to
fix the sign and score each half on its own. First half **+1.26 / second half +0.85** gross (daily);
net@4 **+1.04 / +0.51**. The opposite sign loses in both halves (−1.26 / −0.85), so the first half would
have chosen the fade and the second half is genuinely out-of-sample w.r.t. the sign. Smoothed weights
(EWMA 0.1) are far more stable across halves: gross 0.84 / 0.85, net@4 **0.81 / 0.79**.

**Cost — smoothing is the right construction.** Running the F-24 trick on the weights (EWMA on the
target, renormalised) cuts turnover and lifts the break-even with no loss of net Sharpe:

| construction | gross Sharpe | turn / yr | break-even | net@4 | H1 / H2 gross | H1 / H2 net@4 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| daily (F-29) | 1.055 | 126× | 15.1 bps | +0.78 | 1.26 / 0.85 | 1.04 / 0.51 |
| EWMA 0.5 | 0.895 | 69× | 25.8 bps | +0.76 | 0.95 / 0.84 | 0.85 / 0.65 |
| EWMA 0.25 | 0.846 | 42× | 40.1 bps | +0.76 | 0.86 / 0.84 | 0.80 / 0.73 |
| **EWMA 0.1** | 0.839 | 23× | **74.2 bps** | **+0.79** | 0.84 / 0.85 | **0.81 / 0.79** |
| EWMA 0.05 | 0.849 | 15× | **118 bps** | **+0.82** | 0.86 / 0.85 | 0.84 / 0.81 |
| EWMA 0.1, no renorm | 1.011 | 23× | 77.1 bps | **+0.96** | 1.22 / 0.79 | 1.18 / 0.73 |

So the **smoothed** fade is the tradable one: break-even **74–118 bps** — far above the repo's 5–10 bps
taker assumption — at net@4 **+0.79…+0.96**, and (unlike the daily book) positive in *both* halves at
both cost tiers. This is F-24's lesson (an 8h-rebalanced cross-sectional book pays for its own churn)
repeating on a non-carry signal.

**Confound — it is not the funding rank.** The same construction on the **funding rate** (fade the
high-funding symbols, on spot returns) reads gross **1.03** but at **896×/yr** turnover (break-even
2.9 bps), and it is *unstable*: first half +1.96, second half **−0.43** (net@4 H2 −2.60). Its smoothed
form is no better (H2 −0.05). The toptrader signal correlates only **0.29** with the funding rank
cross-sectionally and **0.20** in book returns. The top-trader ratio carries positioning information the
funding rate does not, and it is the *stable* one.

**Capacity — OI-bound to tens of millions, like the carry sleeves.** E19's impact model gives the daily
book **$15 M** (Y=1, 4 bps); the smoothed book is not impact-limited at all (**$4.2 B** at Y=1 — it
barely trades). But the *same* OI limit as F-28 binds: the biggest position reaches 1 %/5 %/10 % of the
thinnest symbol's open interest (LINK, again) at **$8–10 M / $40–50 M / $81–101 M**. So L18's honest
deployable size is **tens of millions**, OI-bound, exactly as the carry complex (F-28).

**Read.** The toptrader fade is a real, independent, *validated* — but modest and small-size — edge from
free data: the lab's first new-data signal that survives all four tests. The best construction is
**EWMA-smoothed (0.1) renormalised weights** (break-even 74 bps, net@4 +0.79, stable halves). It stays a
tens-of-millions sleeve. **L18 → SUPPORTED (validated)**; R7's revisit now has a concrete spec.

---

## F-31 — The toptrader fade is orthogonal to the carry book, and a small allocation rescues the carry book's decayed second half. [SUPPORTED]

**Experiment:** `e23_combine.js`. **Artefact:** `results/e23_combine.json`. **Lead:** L18 (combining
L18 with L12). Both books smoothed identically (EWMA 0.1, renormalised), built on one loop so the return
streams are aligned to the same calendar intervals; common window 2021-12 → 2026-08 (5 246 periods).

**It is a true diversifier.** The toptrader fade's return correlation with the carry dispersion book is
**−0.001** (with the flat carry book 0.025); the carry dispersion book is itself −0.85 correlated with
flat carry (it is short the level). Two cross-sectional positioning streams, essentially uncorrelated.

**What the combination does (and does not) buy.** The max-Sharpe two-asset mix is **98 % carry** — the
carry book's Sharpe (~4.4 gross on this window) dwarfs the fade's (~0.83), so *full-sample* Sharpe is not
improved by adding the fade. The gain is **robustness**, and it is exactly where the lab flagged risk:
the carry book's own net@4 **second half is −0.12** (the F-24 decay, CYCLE-009's caveat), while

| mix (topLS / carry) | gross | net@4 | H1 net@4 | H2 net@4 |
| --- | ---: | ---: | ---: | ---: |
| 0 / 100 | 4.42 | **+2.46** | +3.60 | **−0.12** |
| 25 / 75 | 1.91 | +1.38 | +1.88 | **+0.75** |
| 50 / 50 | 1.21 | +1.00 | +1.20 | **+0.76** |
| 75 / 25 | 0.96 | +0.86 | +0.94 | +0.76 |
| 100 / 0 | 0.83 | +0.79 | +0.82 | +0.76 |

A **25 %** allocation to the toptrader fade turns the carry book's decayed second half from **−0.12 to
+0.75** net of a 4 bps fee, at a combined net@4 of +1.38. Because ρ ≈ 0, the fade is *insurance against
the carry decay*: it does not raise the full-sample Sharpe, but it removes the negative second half.

**Read.** The lab's second independent stream is not just a standalone sleeve — it is the diversifier the
carry complex needed, verified on the exact weakness (the 2024–26 decay) the lab had already identified
in F-24. This is the first time the lab can point to a portfolio whose **worst half is positive** net of
costs. It does not change the size story (both sleeves are OI-bound to tens of millions, F-28/F-30), nor
the direction of R7 (port the metrics fields; the fade is the stream).

*Superseded in part by **F-43** (CYCLE-026): this mix was measured at the **pre-retune** specs. At the
final port specs (carry `ewma 0.02 + cap12.5 %`, fade `ewma 0.1 + cap12.5 %`) the correlation is still
ρ = 0.010 but the carry book's second half is now **+4.66** net@4 (F-37 removed the decay), so there is
nothing to hedge, and the fade (net@4 1.00) dilutes the carry book (6.49): the 25 % mix nets **1.62** and
a walk-forward allocation rule picks the fade at **0 %** in 11/11 blocks.*

---

## F-32 — Short-horizon reversal is a real gross cross-sectional edge at 1h and 15m, and it is unrescuable: the break-even is 0.3–1.3 bps and smoothing does not lift it. [NEGATIVE as a trade / SUPPORTED as a gross edge]

**Experiment:** `e24_reversal.js`. **Artefacts:** `results/e24_reversal_1h.json`,
`results/e24_reversal_15m.json`. **Lead:** L13 (closed). **Pre-existing arm:** `e2_arm_sweep.js` has
scored the shipped `reversal-1` at both timeframes since CYCLE-001 (the lead's status was stale — L10-t).

**(0) The mechanism is present and fast.** Cross-sectional IC of the past 1-bar return against the
forward 1-bar return is **−0.049 (1h) / −0.046 (15m)** — i.e. reversal — and it decays to ~0 by 16–32
bars (w1, 1h, h = 1…64: −0.049, −0.042, −0.030, −0.020, −0.009, −0.003, −0.002). Time-series lag-1
autocorrelation −0.0133 / −0.0138, negative in **7/8** symbols; VR(2/4/8/16) 0.93–0.99. The
cross-sectional part is ~3.5× the time-series part.

**(A) The repo's P3 arms, full history** (mean Sharpe / break-even bps / positive streams / block
stability):

| arm | 1h | 1h BE | 1h pos/stab | 15m | 15m BE | 15m pos/stab |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `rev-1` `-r[t]` | +0.057 | **0.47** | 7/8, 0.50 | +0.113 | **0.34** | 8/8, 0.63 |
| `rev-2` | +0.123 | 1.31 | 7/8, 0.63 | +0.137 | 0.58 | 8/8, **1.00** |
| `rev-4` | +0.069 | 1.02 | 7/8, 0.63 | +0.098 | 0.56 | 8/8, 0.88 |
| `rev-8` | −0.015 | −0.12 | 3/8, 0.50 | +0.080 | 0.61 | 7/8, 0.63 |
| `rev-vol16` | +0.045 | 0.38 | 5/8, 0.50 | +0.112 | 0.32 | 8/8, 0.63 |
| `rev-sign1` `-sign(r[t])` | +0.096 | 0.60 | 6/8, 0.75 | +0.143 | 0.35 | 8/8, 0.75 |
| `rev-xs` (1-bar xs) | **+0.162** | 1.02 | **8/8, 1.00** | +0.105 | 0.34 | 6/8, **1.00** |

At 15m the family is uniformly positive across windows 1–8 and both constructions, 7–8/8 streams
positive. `rev-xs` is the most *stable* arm in the lab (8/8 streams **and** 8/8 blocks at 1h). Controls
run in the same call: oracle +12.25 / +13.19, anti-oracle the exact mirror, seeded random +0.06 / −0.03.

**(B) The new shape — a dollar-neutral cross-sectional reversal book** (`w_j = −(pastReturn_j − mean)/Σ|·|`,
`Σw = 0`) — is a *real gross signal*, unlike F-07's cross-sectional momentum:

| book | tf | gross Sharpe (252 basis) | turnover /yr | break-even | net@4 | halves | mkt corr |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `rank_w1_rev` | 1h | **0.414** | 11 653× | **0.71 bps** | −1.92 | +0.52/+0.27 | −0.01 |
| `rank_w2_rev` | 15m | **0.583** | 33 510× | **0.50 bps** | −4.05 | +0.50/+0.72 | +0.07 |
| `rank_w1_rev` | 15m | 0.534 | 46 591× | 0.32 bps | −6.03 | +0.39/+0.75 | +0.08 |
| `level_w2_rev` | 15m | 0.500 | 35 768× | 0.50 bps | −3.50 | +0.39/+0.68 | +0.04 |

It is **causal** (next-bar Sharpe 0.41 / 0.58 vs a contemporaneous twin of **−16.98 / −13.83**, a
magnitude ratio of 0.02–0.04 — the L10-q look-ahead signature would exceed 1), **not a null** (a 40-seed
cross-sectional signal-shuffle placebo puts it at **z = 5.5 / 12.1**), **positive in both halves**, and
**market-neutral** (|corr| ≤ 0.08). Sharpe is quoted on the ledger's 252 basis (the per-stream arms'
basis) — on the true calendar basis it is ×5.90 (1h) / ×11.79 (15m); the honest tradability metric is
the break-even, not the annualised Sharpe.

**(C) Smoothing does not rescue it — the F-25 animal, not the F-24 one.** EWMA on the weight vector, the
lever that cut the carry dispersion's break-even 1.87 → 12.78 bps (F-24), leaves the reversal
break-even flat (the gross Sharpe decays roughly in step with the turnover):

| `rank_w2_rev` (15m) | gross Sharpe | turnover /yr | break-even |
| --- | ---: | ---: | ---: |
| daily | 0.583 | 33 510× | 0.50 bps |
| EWMA 0.5 | 0.512 | 27 471× | 0.55 bps |
| EWMA 0.25 | 0.386 | 20 810× | 0.56 bps |
| EWMA 0.1 | 0.243 | 13 794× | 0.54 bps |
| EWMA 0.05 | 0.142 | 9 971× | 0.43 bps |

**Read.** The L13 falsifier ("a full-history gross break-even below 1 bps") is **met**: every arm and
book reads 0.32–1.31 bps, an order of magnitude below the 5–10 bps taker. P3's PARK is confirmed on the
full 6.0-year (1h) / 2.3-year (15m) history and on the cross-sectional shape the repo never tested. But
the gross edge is genuinely present (unlike F-07), so the honest statement is **"reversal is real and
fast, not absent"** — real gross edge, dead as a trade, and no construction tested (per-stream,
demeaned, ranked, smoothed) widens the break-even. Generalisable lesson: **demeaning buys power, not
tradability** (F-03 + F-25, now on price reversal). L13 closes; the only open route is L08's maker model,
which would need a net execution cost **< ~0.3 bps** to matter.

---

## F-33 — The repo's "the edge lives in SIGNS rather than magnitudes" is contradicted by direct measurement. [NEGATIVE — documentation claim]

**Experiment:** `e24_reversal.js` (mechanism section). **Artefacts:** `results/e24_reversal_{1h,15m}.json`.
**Lead:** L10 (row L10-s).

`analysis/features.js`'s reversal-family comment justifies the P3 family with *"the edge lives in SIGNS
rather than magnitudes"*. Measured directly, per symbol and averaged, the IC of the reversal signal
against the next return is:

| construction | 1h IC | 15m IC |
| --- | ---: | ---: |
| magnitude: `−r[t]` | **0.0133** | **0.0138** |
| sign: `−sign(r[t])` | 0.0062 | 0.0094 |

**Magnitude carries about twice the information that sign does, at both bar sizes** — the claim as
stated is false. The apparent paradox at the *arm* level (`rev-sign1` scores a higher Sharpe than
`rev-1`: +0.096 vs +0.057 at 1h, +0.143 vs +0.113 at 15m) is not evidence the other way: the arm pipeline
z-scores the feature, and the z-score of a magnitude series is dominated by fat tails, which costs Sharpe
while adding IC. So the pure-sign arm is better *as a position* but worse *as an information source*, and
neither reading supports the repo's stated reason. No shipped behaviour depends on the claim; it is
recorded here and as an L10 row, not a fold-back.

---

## F-34 — A passive (maker) execution does not rescue the reversal family: the edge lives in the bars the quote misses. [NEGATIVE — L08 closed]

**Experiment:** `e25_maker_fill.js`. **Artefacts:** `results/e25_maker_fill_1h.json`,
`results/e25_maker_fill_15m.json`. **Lead:** L08 (closed). **Data:** now reads each bar's `high`/`low`
(carried through `loadSeries`/`alignPanel`/`tail`; `e14#candle_grid` asserts `low ≤ close ≤ high`).

L13's closure (F-32: break-even 0.32–1.31 bps) left one open route — a queue-aware maker model — and
this is that model, built the conservative way: a passive quote at the signal bar's close (optionally
offset *into* the market by `depth`), filled only if the NEXT bar's low (buy) / high (sell) reaches the
quote, **no spread credited**, and unfilled orders simply cancelled (the exposure is not taken). The
`taker` model is a validation guard and reproduces E24's `rank_w1_rev` exactly (0.4147 vs 0.4143 gross
Sharpe, 0.709 vs 0.709 bps at 1h).

**(a) The classic OHLCV spread estimators are unusable here.** Corwin-Schultz reads **33.4 bps (1h) /
13.3 (15m)**, Roll **23.3 / 9.2**, on bars whose real spread is ~1 bp — volatility-contaminated by
10–30×, so they cannot resolve a 0.3–1.0 bps break-even. Reported to close the door on them.

**(b) The passive fill's cost is fill selection, and it is ~1× the whole edge.** Per-symbol reversal
signal, forward horizon h = 1 (`selectionBps` measured from the reference close; `netVsTakerBps` from the
actual fill price, so it includes the depth benefit):

| depth (bps) | 1h fill rate | 1h selection | 1h **net vs taking** | 15m fill rate | 15m **net vs taking** |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 0.994 | −0.61 | **−0.61** | 0.988 | **−0.48** |
| 1 | 0.965 | −2.59 | **−1.59** | 0.915 | **−1.61** |
| 5 | 0.908 | −6.22 | **−1.22** | 0.793 | **−1.23** |
| 10 | 0.834 | −11.02 | **−1.02** | 0.647 | **−1.15** |
| 20 | 0.699 | −20.68 | **−0.67** | 0.430 | **−1.00** |

`netVsTaker = selection + depth`, and `selection ≈ −(0.6 + depth)`, so the two cancel and the net stays
≈ −0.6…−1.6 bps at every depth: **quoting deeper selects correspondingly worse fills, so the cost of a
passive execution barely moves with the quote.** At depth 0 the fill rate is ~99 %; the ~1 % of bars that
never reach the quote are the large up-gaps, and not being in them costs ~0.6 bps per fill.

**(c) Controls show it is execution, not the signal.** The mirror (momentum) side and a **seeded-random**
side give the same friction — random-side net vs taking **−0.65 bps (1h) / −0.47 (15m)**, statistically
identical to the reversal side's −0.61/−0.48 — while the random side's unconditional return is ≈0 as it
must be.

**(d) Replayed on the book, the maker model removes the entire gross edge:**

| book | 1h gross Sharpe | 1h break-even | 15m gross Sharpe | 15m break-even |
| --- | ---: | ---: | ---: | ---: |
| `taker` | +0.415 | **+0.709 bps** | +0.534 | **+0.324 bps** |
| `maker_d0` (fill at the quote) | **−0.002** | **−0.003 bps** | **−0.271** | **−0.173 bps** |
| `maker_d5bp` | −0.354 | −0.778 | −0.769 | −0.847 |
| `maker_d20bp` | +0.004 | +0.013 | −0.071 | −0.194 |
| `oracle` (fill at the bar extreme) | +16.87 | +67.9 | +18.85 | +26.6 |

**Read.** The L08 falsifier is met: a model that never assumes an impossible fill leaves the reversal
family below a realistic net — the conservative maker book has **zero gross edge at 1h and negative at
15m**, before any fee, because the fill-selection friction (≈0.6–1.6 bps per fill) exceeds the entire
edge (0.3–0.7 bps). So **L08 closes NEGATIVE and the cost verdict of F-32 stands under the maker model
too.** Residual, recorded as a **data requirement**: the bar model cannot locate fill *quality within* the
bar — the unachievable `oracle` replay is hugely profitable (+67.9 bps break-even) — so settling whether
a real queue-aware maker lands nearer the touch or nearer the extreme needs L2/queue data. The only
bar-level friction estimate that behaves is the fill-selection one (~1.2 bps effective), which is an
order of magnitude below the classic OHLCV estimators and in line with a real perp spread.

---

## F-35 — Re-aiming the learner at "will this rule's trade pay?" does not help: the meta-label target is not usefully predictable. [NEGATIVE — L06 closed]

**Experiment:** `e26_meta_label.js`. **Artefacts:** `results/e26_meta_label_1h.json`,
`results/e26_meta_label_15m.json`. **Lead:** L06 (closed). **Method:** the repo's own eight causal features
(`analysis/features.js`) plus the rule's own position, and an L2 logistic regression refit on an expanding,
horizon-purged window. The primary label is literally L06's falsifier target — for each bar a base rule
acts, `1[p[t]·Σ_{q=1..8} r[t+q] > 0]`; the secondary is an AFML directional triple-barrier outcome
(`ptSl=[1,1]`, trailing-vol scale, vertical 8). Base rules: `sig-momentum`, `sig-acceleration` and
`sig-reversal`. **Controls (F-11):** an oracle filter (keep only the trades that won) and its mirror run in
the same call — oracle gross Sharpe **+2.1…+2.3**, anti-oracle **−1.9…−2.3**, so the filter machinery is
sound.

**(a) Out-of-sample Brier skill vs the causal base rate is ≤ 0 for every rule at both timeframes.** This is
the pre-registered falsifier, and it fires:

| rule | 1h Brier skill | 1h AUC | 15m Brier skill | 15m AUC |
| --- | ---: | ---: | ---: | ---: |
| `sig-momentum` (n≈413k / 618k) | **−0.0013** | 0.5063 | **−0.0007** | 0.5083 |
| `sig-acceleration` | **−0.0011** | 0.5047 | **−0.0010** | 0.5061 |
| `sig-reversal` | **−0.0003** | 0.5084 | **−0.0010** | 0.5041 |

The null (the same pipeline refit on **label-shuffled** training data) scores ≈ −0.003, i.e. a
zero-information model is worse than the base rate — so the real model does sit ~+0.002 above the null, but
still at or below the causal base rate. Per-block, the real skill is positive in only **10–48 %** of the 29
blocks.

**(b) AUC is detectably above 0.5 but economically irrelevant, and capacity does not change the verdict.**
Pooled AUC is 0.504–0.508 (per-stream 0.497–0.521), which at n≈4–6×10⁵ is a real rank signal — but it is
the *only* trace, and the calibration (Brier) is worse than the base rate. A capacity probe (first stream,
several gradient-descent iteration counts) shows the skill is positive **only** at one iteration
(+0.0006…+0.0021) and goes **more negative** as capacity rises (to −0.009 at 40 iterations): the effect is a
whisper that overfits, not a signal that a model can capture.

**(c) The abstention overlay only "works" by keeping a handful of bars.** Filtering to the top predicted
probabilities lifts net@4 from the raw rule's −0.08 (mom) / −0.06 (accel) / −0.59 (rev, whose break-even is
0.38 bps) to **+0.020 / +0.025 / +0.061** at 1h — but only by keeping **0.7 % / 0.5 % / 0.3 %** of acting
bars, against a null-model filter mean of −0.056 / −0.046 / −0.021 (z 3.9–5.6). At **15m** the same overlay
does not reach a positive net for the trend rules (best filter −0.016 and −0.009; rev +0.018 on 0.016 % of
bars) and mostly fails to beat the null-model filter. A book that holds a position on ~1 in 150–300 bars is
not a strategy.

**Read.** The L06 falsifier is met at every rule, timeframe and capacity: `P(the rule's trade is profitable)`
is not predictable enough to beat the rule's own base rate, so the large, well-tested, currently-inert
learned layer still has no job — and, crucially, **re-labelling it does not give it one.** NL-BENCH's closure
extends to the meta target. The one honest nuance is that the meta-target carries a *detectable but
negligible* rank signal (AUC ≈ 0.51), which shows up as a marginal, tiny-subset abstention gain at 1h and
not at 15m; recorded so no future cycle mistakes "AUC > 0.5" for a usable edge. **L06 closes NEGATIVE.**

---

## F-36 — The dispersion sleeve's *cost margin* has decayed below the fee; the toptrader fade has not decayed, and it is what keeps the mix alive. [MIXED — L12 decayed net, L18 not]

**Experiment:** `e27_decay.js`. **Artefact:** `results/e27_decay.json`. **Leads:** L12 (dispersion),
L18 (toptrader fade), L16/L17 (its low-turnover/capacity constructions). **Validation:** `e27` rebuilds
the `e23` books and reproduces their gross Sharpes exactly (carry 4.417, fade 0.834), so the decay numbers
are on the same construction as F-24/F-30/F-31. Window: the aligned book grid, **2021-12-01 → 2026-09-18**
(5 246 8h periods, ~4.8 y), 4 bps fee, EWMA(0.1) weights.

**Decay test (pre-registered).** Split the book into 8 contiguous blocks; the observed statistic is the
Pearson correlation of block net@4 Sharpe with block index; the null (5 000 draws) permutes the block-Sharpe
values. Decay = recent net@4 ≤ 0 **and** a significant negative trend.

**(a) The carry dispersion book has decayed — and it is the *break-even*, not the gross edge, that went.**

| block start | 21-12 | 22-07 | 23-02 | 23-09 | 24-04 | 24-11 | 25-07 | 26-02 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| gross Sharpe | 9.9 | 4.7 | 11.1 | 13.6 | 8.0 | 8.4 | 6.3 | 5.5 |
| **net@4 Sharpe** | 6.0 | 4.0 | 6.8 | 9.0 | 1.6 | 1.1 | **−1.0** | **−2.1** |
| break-even (bps) | 10.2 | 28.7 | 10.3 | 12.0 | 5.0 | 4.6 | **3.4** | **2.9** |
| turnover (×/yr) | 81 | 75 | 80 | 75 | 87 | 93 | 92 | 98 |

Net@4 by calendar year: **2021 5.93, 2022 3.45, 2023 5.32, 2024 5.41, 2025 −0.01, 2026 −1.88.** The
net trend is **ρ = −0.79, permutation p = 0.023**; the *gross* trend is **ρ = −0.35, p = 0.39** (not
significant). So the sleeve is not (mainly) losing its signal — its **per-period gross edge shrank while
turnover rose, and the break-even fell from 10–29 bps in 2022–23 to 2.9–3.4 bps in the last two blocks,
below the 4 bps fee.** The last-12-months net@4 is **−1.37** (mean net ≈ −0.66 bps/period), and the
second half's break-even (3.93 bps) is below the first half's (15.15 bps). This *refines* F-24: the
dispersion edge is still a gross fact, but it is no longer *tradable* at 4 bps in the current regime — the
F-24/F-26/F-27 break-even and capacity numbers (12.8 bps, $27 M) are full-sample and now stale.

**(b) The toptrader fade has NOT decayed.** Net@4 by year: 2021 1.90, 2022 **−0.18**, 2023 1.98,
2024 0.05, 2025 1.24, 2026 1.27; **last-12-months net@4 = +1.91** (above its full-sample 0.79); halves
0.82/0.76; net trend **ρ = 0.19, p = 0.68** (no trend), gross trend p = 0.66. Its per-block net is noisy
(0.77, −0.01, 1.15, 1.33, −1.44, 2.42, 1.13, 0.83) with no monotone drift, and its break-even stays at
47–202 bps. It is a much weaker sleeve (Sharpe ~0.8) but it is still working.

**(c) The 25 % mix is still net-positive in the recent window — because the fade carries it.**
Net@4 by year: 2024 0.48, 2025 1.24, 2026 1.04; **last-12-months +1.76**; halves 1.88/+0.75; net trend
ρ = −0.31, **p = 0.47** (not significant). So F-31's "insurance" claim is now confirmed *out of sample in
time*: the mix — which F-31 built only to fix the carry book's weak second half — has stayed positive in
the exact window where the carry book's net edge died.

**Read.** The two working sleeves have diverged: the **carry dispersion's tradability** is gone in the
recent regime (break-even below the fee) even though its gross edge persists, while the **toptrader fade**
is unchanged and the **mix** remains net-positive. Practical consequence: the lab's only currently
net-positive book is the *mix* (or the fade alone), and the R8 port spec's economics must be re-stated on
the recent window, not the full sample. Reversal (L13) and the meta-label (L06) are both closed, so the
fade is now the single live sleeve — and it is the *smaller* one.

---

## F-37 — The dispersion sleeve's decayed cost margin is repaired by a slower weight policy, and the retune is a walk-forward RULE, not a hindsight pick. [SUPPORTED — L12 recoverable, L16 answered]

**Experiments:** `e28_regime_retune.js`, `e29_regime_retune_oos.js`. **Artefacts:**
`results/e28_regime_retune.json`, `results/e29_regime_retune_oos.json`. **Leads:** L12, L16 (and the R8
port). **Validation:** e28's F-24 spec reproduces F-36's recent structure (recent-24m break-even 3.68 bps
< 4.5, net@4 −0.58) on the full 6.0-year grid; e29 rebuilds the same λ-family causally.

**(a) The F-36 conclusion — "no longer tradable at 4 bps in the current regime" — is about one λ, not the
sleeve.** `e28` sweeps 16 policies against the *recent* window (last 24 months, 2 190 8h periods):

| policy | recent turnover ×/yr | recent break-even | recent net@4 | full gross Sharpe |
| --- | ---: | ---: | ---: | ---: |
| **ewma_0.01_norm** | **9** | **27.07 bps** | **+3.86** | 5.71 |
| ewma_0.02_norm | 18 | 14.65 bps | +3.62 | 5.48 |
| hold108_norm | 12 | 7.77 bps | +1.05 | 3.56 |
| ewma_0.05_norm + cap12.5 % | 26 | 7.03 bps | +2.67 | 6.64 |
| ewma_0.05_norm | 46 | 6.66 bps | +2.33 | 5.59 |
| hold54_norm | 23 | 6.51 bps | +1.20 | 1.56 |
| level_ewma_0.1_norm | 95 | 4.03 bps | +0.05 | 4.66 |
| *(F-24 spec: ewma_0.1_norm)* | 93 | **3.68 bps** | **−0.58** | 5.18 |

**7/16 clear 4 bps recently; 6/16 clear 6 bps.** The leader (`ewma 0.01_norm`) clears by ~7×, is
net-positive in **9/9 regimes** (FTX **+13.2**, 2026 **+2.9**), and its full-sample net@4 (**5.37**) beats
the F-24 spec's (3.55) — so it is not a recent-regime patch but a better point in the same family. It
stays dollar-neutral and price-neutral (market corr 0.045). `e29`'s gradient: net-positive regimes by λ —
λ ≤ 0.05 → **9/9**, 0.075 → 8/9, 0.1 → 7/9, 0.3 → 5/9. Slower is better in essentially every window.

**(b) The retune is a rule (out of sample).** `e29` walks forward: every block it picks the λ with the
best *trailing* net@4 Sharpe (never seeing the block) and trades it. On the resulting 5 110-period OOS
span:

| selector / policy (same OOS span) | OOS net@4 | OOS break-even | OOS turnover |
| --- | ---: | ---: | ---: |
| **walk-forward (net-aware)** | **+5.71** | 16.08 bps | 38×/yr |
| pinned F-24 spec (λ 0.1) | +2.76 | — | 84×/yr |
| pinned leader (λ 0.01) | +6.48 | — | 8×/yr |
| **gross-blind selector (control)** | **+0.28** | — | — |

Recent-24m of the OOS span: walk-forward **+3.41** vs pinned spec **−0.53**. The selector opens at λ 0.3 /
0.2 (2021–22, when the gross edge paid the churn) then converges to 0.005–0.03 (0.0075–0.01 by 2025–26) —
it is *not* hard-wired slow. The result holds across **12/12** (lookback, block) parameterisations (OOS
net@4 5.02–7.42). The **gross-blind control is the methodological finding**: selecting the smoothing by
*gross* Sharpe picks λ 0.3 in 11/14 blocks and nets only **+0.28** — cost-awareness, not variance
reduction, is what makes the retune work.

**(c) The leader survives the autocorrelation check.** Recent-24m net@4 **3.86**, design effect **0.4**
(*below* 1 — not autocorrelation-inflated), design-effect-adjusted t **8.7**, 90-period moving-block
bootstrap CI **[3.07, 4.85]**, entirely above zero (the F-24 spec's recent net@4 is −0.58, CI [−1.57, +0.69]).

**Read.** F-36 was right about the *mechanism* (turnover, 75 → 98×/yr, pushed the break-even below the
fee) but wrong about the conclusion: the sleeve is recoverable by lengthening the weight policy's memory,
and the recovery is a **walk-forward rule**, so it is not selection on the recent window. The R8 port spec
should be re-stated as a **cost-aware, walk-forward λ (recent λ ≈ 0.01–0.02)**, not a pinned λ = 0.1 — and
the F-26/F-27 capacity numbers should be re-measured at the new (much lower) turnover.

---

## F-38 — Sizing the retuned dispersion book: the binding limit switches from impact to open interest, and usable size rises ~2.7×. [SUPPORTED — L15/L17 re-opened]

**Experiment:** `e30_retuned_capacity.js`. **Artefact:** `results/e30_retuned_capacity.json`. **Leads:**
L15 (capacity/impact), L17 (capacity-aware weighting), L12/L16. **Validation:** the λ=0.1 book reproduces
`e19`'s stored `xsRank_ewma0.1_norm` capacity exactly ($13 211 348.6 at Y=1; break-even 12.7768 bps).
**Windows:** full 6.0-year book grid (6 557 8h periods); OI bound at 1 %/5 %/10 % of each symbol's mean
open interest.

**(a) The retuned book is no longer impact-bound — it is OI-bound.**

| book | turnover ×/yr | recent net@4 | recent break-even | impact cap. (Y1) | OI bound (5 %) | **usable size** | binding |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `ewma_0.1_norm` (F-24 spec) | 85 | −0.58 | 3.68 bps | **$13.2 M** | $23.4 M | **$13.2 M** | impact (DOGE) |
| `ewma_0.01_norm` (F-37) | 9 | **+3.86** | **27.07 bps** | $1 986 M | $19.2 M | **$19.2 M** | **OI (LINK)** |
| `ewma_0.02_norm + cap12.5 %` | 11 | **+4.24** | **15.97 bps** | $726 M | $35.9 M | **$35.9 M** | OI (LINK) |
| `ewma_0.05_norm + cap12.5 %` | 26 | +2.67 | 7.03 bps | $80 M | $37.9 M | **$37.9 M** | OI (LINK) |

The F-26/F-27 story (impact-bound at ~$13 M, DOGE at ~1 % of ADV) is true *only for the fast λ=0.1 book*.
Every slower book has a diverging impact capacity (per-period trade collapses) and is limited instead by
the **persistent position in the thinnest name (LINK)** — F-28's insight, for the dispersion family.

**(b) The F-27 cap and the slower λ compound.** With the 12.5 % clip-and-hold cap the OI bound rises
$19 M → **$36–38 M** while the recent cost margin stays far above the fee. The **best combined R8 spec is
`ewma_0.02_norm + cap12.5 %`**: usable **~$36 M** (vs the old spec's $13.2 M, **+173 %**), recent-24m
net@4 **+4.24** (better than either the old spec or the uncapped slow book), recent break-even **15.97 bps**,
turnover 11×/yr.

**(c) A hold-like book's impact capacity is fictional.** The square-root capacity diverges as turnover →
0 ($4.0 B at λ=0.005): the model charges only the per-period trade, and a near-buy-and-hold never trades.
The honest size limit for a persistent book is **open interest** — so any future capacity claim for a
smoothed/hold book must carry the OI bound or it will report billions.

**Read.** F-37 fixed the *fee* and F-38 shows it also improves the *size* — the retune is not a trade of
cheapness for capacity. R8's port spec becomes **`ewma 0.02 + 12.5 % cap`, ~$36 M (OI-bound, LINK)** at a
recent break-even of ~16 bps; the $27 M F-27 figure is superseded. The residual caveat: the OI bound uses
mean OI, and the cap+λ combination was frontier-picked (the *components* are each validated), so it needs
the e29 walk-forward treatment before it is ported.

---

## F-39 — R8 is port-ready: a joint (λ, cap) walk-forward beats the old spec out of sample and survives a 10 bps fee. [SUPPORTED — L12/L15/L16/L17 capstone]

**Experiment:** `e31_ported_spec_oos.js`. **Artefact:** `results/e31_ported_spec_oos.json`. **Leads:**
L12, L16 (spec), L15/L17 (size). **Validation:** the pinned λ=0.1 book still reads the e28/F-36 recent
numbers (net@4 −0.58, break-even 3.68 bps).

**(a) Joint walk-forward over the (λ, cap) surface.** The whole **10 λ × 4 cap = 40-book** grid is built
causally; every 12 months the selector picks the (λ, cap) with the best *trailing* net@4 Sharpe (never
seeing the block) and trades it through the block. On the 5 110-period (~4.7 y) OOS span:

| book (same OOS span) | OOS net@4 | recent-24m net@4 | net@4 @ 6 bps | break-even |
| --- | ---: | ---: | ---: | ---: |
| **joint walk-forward (λ, cap)** | **+6.13** | **+4.49** | **+5.57** | **25.8 bps** |
| pinned F-24 spec (λ=0.1) | +2.76 | −0.53 | +1.82 | 9.9 bps |
| pinned `λ=0.02 + cap12.5 %` | +6.86 | +4.30 | +6.42 | 35.7 bps |
| pinned `λ=0.1 + cap12.5 %` | +1.93 | −0.22 | +1.33 | 10.4 bps |

The rule beats the pinned F-24 spec by **+3.37 Sharpe** OOS and is positive recently (+4.49 vs −0.53). The
selector adapts (mostly λ 0.0075–0.03, occasionally 0.15), so the recoverable regime is not one lucky λ.
The walk-forward (+6.13) sits slightly *below* the frontier-picked pinned combo (+6.86) — the expected
asymmetry, and the reason the walk-forward is the evidence.

**(b) Fee stress.** The same OOS series at 2/4/6/8/10 bps gives OOS net@4 **6.69 / 6.13 / 5.57 / 5.00 /
4.43** and recent-24m **4.94 / 4.49 / 4.03 / 3.57 / 3.12** — the book is net-positive out of sample even
at a **10 bps** fee, ~6× headroom above a 4 bps taker fee (the F-24 spec's break-even is 9.9 bps, 2.5×).

**Read.** The dispersion line is closed end-to-end: signal → cost → capacity → OOS rule → fee robustness.
`λ=0.1 + cap12.5 %` is *still* broken OOS (+1.93), so the **slower λ is what repairs the margin** and the
cap is a capacity add, not a cost crutch. The R8 port spec is **`ewma 0.02 + cap12.5 %`, ~$36 M
(OI-bound), walk-forward λ**, with a break-even ~4–6× the fee.

---

## F-40 — The cost-aware-slowness lesson does NOT transfer to the fade; the cap does. [MIXED — L18 capacity upgrade, retune scoped]

**Experiment:** `e32_fade_retune.js`. **Artefact:** `results/e32_fade_retune.json`. **Leads:** L18 (fade),
L16 (the F-37 rule), L17 (the cap). **Validation:** λ=0.1/no-cap reproduces `e22`'s stored
`topLS_fade_ewma0.1` (gross 0.839, turnover 22.9×/yr, break-even 74.15 bps); `e22#buildMasked` was
exported this cycle and `e22`'s artefact is byte-identical afterwards.

**(a) The fade is not cost-fragile at any λ, so slowness has nothing to fix.** Fade recent-24m break-even
by λ: **0.02 → 138 bps, 0.05 → 90, 0.1 (spec) → 55, 0.25 → 30, 0.5 → 19** — every one clears a 4 bps fee
by ≥5×. The dispersion book's recent break-even was **3.7 bps** before its retune. F-37's mechanism has no
purchase on a book that was never below the fee.

**(b) The walk-forward selection rule does NOT transfer.** On the same OOS span a joint (λ, cap)
walk-forward nets **+0.70** vs the pinned EWMA(0.1)'s **+0.94** (recent-24m +0.46 vs +0.84) — worse, the
opposite of the dispersion result (+6.13 vs +2.76). The fade's Sharpe is ~0.8, so a trailing-12-month
window is noise-dominated and the selector chases it. **The F-37 rule is only valid where trailing-window
performance is informative.**

**(c) The F-27 cap DOES transfer — it fixes concentration, not cost.** The 12.5 % cap halves turnover and
lifts the fade's usable size and edge: OI bound (5 % of mean OI) **$37 M → $54 M** (LINK), full net@4
**+0.79 → +1.00**, break-even **74 → 109 bps**. So the *construction* lesson generalises across sleeves;
the *retuning* lesson is specific to a decaying cost margin.

**Read.** F-37/F-39 are not a general recipe — they are a fix for a book whose margin is binding. This
sharpens the theory: slowness buys nothing where the break-even already clears the fee, and a walk-forward
parameter rule needs a signal strong enough to score on a trailing window. L18's own improvement is the
cap (port R7 with it).

---

## F-41 — The OI capacity bounds are ratios of means (average-case); restated as distributions they fall 1.8–3.0×. [SUPPORTED — corrects F-28/F-38/F-40 sizes]

**Experiment:** `e33_oi_capacity_distribution.js`. **Artefact:** `results/e33_oi_capacity_distribution.json`.
**Leads:** L07 (sizing half), L15, L17, L18, L10 (measurement integrity). **Validation:** the published
convention reproduces e30's `ewma_0.1_norm` 5 % bound (**$23 413 984.80**, LINKUSDT) and e32's `lam0.1`
bound (**$36 986 403.11**) to 1e-12 relative.

**The bug.** F-28/F-38/F-40 all compute the OI position capacity as `f·mean_t(OI_j)/mean_t(|w_j|)` — a
**ratio of means**, an *average-case* bound. The desk's constraint is per-period and per-symbol
(`|w_j(t)|·G ≤ f·OI_j(t)`), whose worst case is a **min of ratios**. For positive quantities the published
number is an upper bound on the average case and can sit far above the worst case whenever OI dips exactly
when the book's weight spikes — the squeeze mechanism itself.

| sleeve (5 % of OI) | published ratio-of-means | true mean-of-ratios | true min-of-ratios (never breach) | recent-24m p5 | peak participation at published |
| --- | ---: | ---: | ---: | ---: | ---: |
| dispersion λ=0.1 (spec) | $23.41 M | $18.28 M | **$4.37 M** | $11.19 M | **26.8 %** (68 % of periods over cap) |
| dispersion λ=0.01 (F-38) | $19.20 M | $14.89 M | **$4.99 M** | $10.25 M | 19.2 % (65 %) |
| dispersion λ=0.02 + cap12.5 % | $35.94 M | $29.31 M | **$11.50 M** | $20.34 M | 15.6 % (69 %) |
| fade λ=0.1 (spec) | $36.99 M | $26.49 M | **$4.19 M** | $12.27 M | **44.2 %** (69 %) |
| fade λ=0.1 + cap12.5 % (F-40) | $53.84 M | $40.33 M | **$12.62 M** | $21.87 M | 21.3 % (77 %) |

**(a) Every published bound is loose.** The ratio-of-means is ~22–25 % above the true *average* case
(Jensen) and **2.6–8.8×** above the true *worst* case. The naive "use minimum OI" fix
(`f·min(OI)/mean|w|`) is *still* ~1.8× too high for the uncapped books — the correct object is the min of the
ratio, not a ratio with a min.

**(b) "5 % of open interest" is only true on average.** At the published size the median participation is
5.9–8.5 % but the **peak is 16–44 % of one symbol's OI**, and the book is over the 5 % cap in **65–77 % of
periods** (≈713–838×/yr).

**(c) The binding symbol is LINK, and the binding moments are dislocations.** The thinnest periods are LINK
in **2023-06/07** ($4.19–4.99 M) and the fade/dispersion 2022-05 LUNA window; the uncapped book puts
**~38–44 % of gross notional in LINK** exactly when LINK's OI is lowest. The constraint binds in the current
regime too: recent-24m minima are **$8.29 M (2026-07-01)**, **$9.28 M (2026-03-27)**, **$7.38 M**.

**(d) Restated deployment sizes (min of impact capacity and the OI bound).** Published usable →
restated (recent-24m p5): dispersion spec **$13.21 M → $11.19 M** (1.18×, impact still binds); dispersion
λ=0.01 **$19.20 M → $10.25 M** (1.87×); dispersion λ=0.02+cap **$35.94 M → $20.34 M** (1.77×); fade
**$36.99 M → $12.27 M** (3.02×); fade+cap **$53.84 M → $21.87 M** (2.46×).

**(e) The F-27/F-40 cap survives and is now better motivated.** The cap fixes the very concentration that
makes the worst case bind: it lifts the never-breach bound for the fade **$4.19 M → $12.62 M (3.0×)** and the
dispersion book **$4.37 M → $11.50 M**, and cuts peak participation 44 %→21 % (fade) / 27 %→16 % (disp).

**Read.** The lab's capacity layer was quoted one order of statistic too optimistic: a ratio of means instead
of the min of ratios. Corrected, the sleeves are **~$10–22 M** (recent-24m p5) rather than $19–54 M, and the
constraint is a *single thin symbol's open interest during dislocations*. Three things follow: R7/R8 must
port at the p5 size; the cap is a capacity device; and the natural next object is a size that *follows* OI
(a constant-participation schedule) rather than a fixed number.

---

## F-42 — The OI capacity is a *schedule*: a constant trailing size is not compliant, a lagged one is worse, and a clipped median is the compliant policy. [SUPPORTED — sizing policy]

**Experiment:** `e34_oi_scaled_sizing.js`. **Artefact:** `results/e34_oi_scaled_sizing.json`. **Leads:**
L07, L15, L17, L18, L10. **Validation:** the raw `min_j(OI_j/|w_j|)` reproduces `e33`'s stored
min-of-ratios to 1e-9.

**(a) A constant size from trailing data still breaches.** The largest constant size F-41 implies (the
trailing-2y p5) breaches the 5 % cap in **2.7–3.7 %** of periods and peaks at **6.1–10.2 %** of a symbol's
OI (R8 spec: $11.16 M, 2.9 %, peak 10.2 %; R7 spec: $10.86 M, 2.7 %, peak 6.1 %). OI is non-stationary, so
the certified-safe constant size is the **running min** — ~20 % smaller ($9.2 M), breach 0.1–0.4 %.

**(b) Sizing to OI (constant participation) is compliant and raises the mean deployable size 2.0–4.1×.**

| sleeve | const p5 size | OI-scaled mean size | size gain | const-p5 Sharpe | full-follow Sharpe | clip Sharpe |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| dispersion `λ=0.02 + cap12.5 %` | $11.16 M | **$22.88 M** | **2.05×** | 5.02 | 3.26 | 4.41 |
| fade `λ=0.1 + cap12.5 %` | $10.86 M | **$33.58 M** | **3.09×** | 1.21 | 0.77 | 0.96 |
| fade `λ=0.1`, no cap | $8.51 M | **$34.53 M** | **4.06×** | 0.93 | 0.78 | 0.74 |

**(c) A lagged size is worse than no schedule.** An EWMA(0.1) size sits *above* a falling `G_t^cap` and so
breaches **53–55 %** of periods (peak 9.3–13.2 %) — the bound must be a **hard clip**, never a smoothed
target. A seeded shuffle of the size (same marginal distribution) blows per-unit turnover from 14–23×/yr to
**564–870×/yr** and drives the Sharpe to **−0.7…−18.5**: the schedule's value is *compliance at low resize
churn*, not timing.

**(d) The compliant recipe is a clip.** Target the trailing-median size, clip at `G_t^cap`: mean **$16.94 M**
(R8) / **$19.34 M** (R7) — **1.5–1.8×** the constant-p5 size — zero breach (clip binds ~44 % of periods) at
Sharpe 4.41 / 0.96 and more absolute dollars. The full-follow schedule buys the most size but is the worst
risk-adjusted (R8 5.02→3.26, fade DD 22.8 %→58.2 %): **sizing to OI is a capacity device, not an alpha.**

**(e) Measurement fix (`e33` / L10-x).** `e33`'s min-of-ratio accepted a period if *any* traded symbol had
OI; with the 7 alts starting 2021-12 the dispersion book read a **$936 B** capacity (2021-11-04, BTC weight
0.0002). Both `e33` and `e34` now require **every traded symbol** to have an OI print. `e33`'s headline bounds
are unchanged; its breach fractions rise to **65–77 %** and its full-sample distribution is now sane.

**Read.** F-41's distribution is correct but was being *consumed* wrong: the bound is not a number to pick
from history (which breaches) and not a size to smooth (which breaches more); it is a **clip on a
risk-targeted size**, and following it exactly trades Sharpe for notional. The port specs therefore carry a
**clipped trailing-median size (~$17–19 M)** rather than a fixed figure.

---

## F-43 — At the final port specs the sleeve mix no longer helps, and the two sleeves' OI capacities do not add. [MIXED — F-31 restated / capacity is portfolio-level]

**Experiment:** `e35_portfolio_mix.js`. **Artefact:** `results/e35_portfolio_mix.json`. **Leads:** L12, L18,
L15/L17. Common grid 5 247 periods (2021-12 → 2026-09), the two books at their final port specs (carry
`ewma 0.02 + cap12.5 %`, fade `ewma 0.1 + cap12.5 %`), aligned on the same return interval. Guard: each
book's individual OI-schedule mean reproduces `e34`'s `meanGcap` to **1.3 % / 0.01 %**.

**(a) F-31 does not survive the re-spec — the re-tune removed what the mix hedged.** ρ is still **0.010**,
but the carry book's net@4 **second half is now +4.66** (F-37 repaired the F-24 decay it used to be −0.12),
so there is nothing to hedge; and the fade (net@4 **1.00**) is far weaker than the carry book (**6.49**), so
every allocation dilutes it. The 25 % mix nets **1.62** (H2 0.88); a **walk-forward allocation rule picks
the fade fraction 0 in 11/11 blocks** and nets **6.59** OOS vs the 25 % mix's 1.67.

**(b) The capacities do not add — an OI bound is a portfolio-level constraint.** Both books hold every
symbol; their thin-alt positions are the binding ones. Individual means: carry **$23.72 M**, fade
**$31.85 M**, sum **$55.57 M**; the **joint** schedule at the 25 % fade mix is **$31.32 M (56 % of the
sum)**. Directly: deploying each sleeve at its own individually-compliant size breaches the 5 %-of-OI cap
in **78.4 %** of periods, peaking at **10.0 % (2× the cap)**, median 8.1 % (binding: ADA 2 707, LINK
1 692, DOGE 635). The books' LINK weights are near-independent (same-sign **51.2 %**, corr **−0.20**), so
they do not net out. The lesson: **a min-of-ratios capacity is not diversifiable** — two individually
compliant sleeves are not jointly compliant, and return correlation does not help because the constraint
is on summed *positions*.

**Read.** F-31's *correlation* result stands (the streams are orthogonal), but its *recommendation* (put
25 % in the fade) was a hedge against a decay that F-37 fixed, and it is now a net Sharpe cost. Separately,
this is the first capacity result that is not per-sleeve: the portfolio's honest OI size is the **joint**
schedule `f·min_j OI_j/|Σ_s a_s w^s_j|`, which at the F-31 mix is ~1.8× smaller than the sum of the parts.

*Refined by **F-44** (CYCLE-027): the "56 % of the sum" and "78 % breach" numbers are properties of the
**fixed** 25 % split and of the naive both-at-individual deployment. The free-split joint frontier (a per-period
LP) is **1.13× the sum on average** — the constraint itself is cheap; it is a *stable allocation* that is
impossible, and the LP-optimal size schedule churns 48.5× gross/yr and nets net@4 only 0.62.*

*Basis note (**F-47 / L10-y**, CYCLE-030): the F-31 mix — and the "mixing adds ~nothing" conclusion above —
is a **capital-fraction** mix of a basis+funding stream (carry, **0.4 %/yr** vol per unit gross) with a spot
stream (fade, **13.6 %**), so it is dominated by the 31× volatility gap. Risk-normalised, the max-Sharpe fade
weight is **0.13** and the gain is **+0.07** Sharpe (6.48→6.55): the *direction* stands, the *magnitude*
(6.49→1.62) is the vol ratio.*

---

## F-44 — The free-split joint OI frontier is ~the sum on average, but the optimal allocation is unstable and the LP-optimal schedule is uninvestable. [SUPPORTED — refines F-43]

**Experiment:** `e36_portfolio_oi_frontier.js`. **Artefact:** `results/e36_portfolio_oi_frontier.json`.
**Leads:** L12, L18, L15/L17. Reuses `e35#buildPair`; 5 175 common periods. The joint capacity is the LP
`max gC·G_C + gF·G_F s.t. |G_C·wC_j + G_F·wF_j| ≤ f·OI_j` (f = 5 %), solved per period by vertex
enumeration (constraint pairs **and the axis vertices**). Guard: LP ≥ the larger individual bound, and
each individual bound mean reproduces `e34`'s `meanGcap` to 0.45 % / 1.14 %.

**The frontier.** LP total gross: mean **$62.72 M**, median **$37.11 M**, p5 $11.93 M, p95 $166.39 M,
p99 $624.28 M — vs the sum of the individual bounds (mean $55.64 M, median $42.35 M) and F-43's fixed 25 %
mix ($31.30 M). So the LP is **2.00× the fixed mix**, **1.13× the sum on average**, but **0.88× the sum at
the median** (the mean is netting-tail-driven: when carry and the fade are on opposite sides of a thin
symbol the pair can both be large — hence the $624 M p99).

**Why it is not a portfolio.** The optimal fade share has **mean 0.595 but p5 0 / p95 1** — the LP wants
only one sleeve in many periods, and the binding symbol rotates (ADA 2 448, LINK 1 713, DOGE 606). The
LP-scheduled book — which re-optimises its size every period and pays the fee on the actual dollars traded —
turns over **48.5× gross/yr** and reads **net@4 0.62** (gross 0.70), against the carry book's 6.49.

**Read.** F-43 asked "do the capacities add?" and answered no for a fixed allocation; F-44 shows the
constraint is *cheaper* than that — the frontier is ≈ the sum — but the thing that does not add is a
**stable portfolio**: there is no fixed split anywhere near the frontier, and the free-split optimum is an
unstable, high-churn schedule. The deployable joint size remains F-43's fixed-split bound; the LP is a
capability statement.

---

## F-45 — The OI-change cross-sectional signal WAS rescuable (F-28 was the F-23 mistake again), but it is weak, churny and recent-regime. [SUPPORTED — corrects F-28, opens L19]

**Experiment:** `e37_oi_signal_rescue.js`. **Artefact:** `results/e37_oi_signal_rescue.json`. **Lead:** L07
→ new lead **L19**. Reuses the exact e21 book (`xsBookImpl`, extracted, artefact byte-identical) under an
EWMA weight policy, plus the F-37 walk-forward λ-selection and a fee stress. Window 2021-12 → 2026-09.
Guard: the daily sign+1 book reproduces `e21#dLogOI_pos` exactly (0.9612 / 1501.11). Sign +1 is a **prior**
(F-28's pooled IC +0.020), not a fit; the sign control is separate.

**F-28's verdict was too strong.** The daily OI-change book's break-even (1.89 bps, 1501×/yr) is the **F-23
pattern** — an implementation artefact, exactly what F-24 found for the funding book. Smoothed, the OI book
clears the fee in a **window** of λ:

| λ | gross Sharpe | turnover /yr | break-even | net@4 |
| --- | ---: | ---: | ---: | ---: |
| daily | 0.961 | 1501× | 1.89 bps | −1.07 |
| 0.50 | 1.009 | 849× | 3.21 bps | −0.25 |
| **0.25** | **1.178** | 338× | **8.93 bps** | **+0.65** |
| 0.10 | 0.713 | 116× | **14.73 bps** | +0.52 |
| 0.05 | 0.170 | 55× | 7.43 bps | +0.08 |
| ≤0.02 | ~0 | ≤21× | ≤3.7 bps | ≤0 |

Too fast fails on cost; too slow fails on **signal death** (F-25/F-32 pattern, not F-24). The signal is
**independent of carry** (corr **0.007**) and the sign control loses both halves (−0.961 gross, net@4
**−3.00**).

**But it is weak.** At λ=0.25: net halves **0.07 / 1.47**, net-by-year 2023 **−0.86** vs 2024 +1.56 / 2025
+0.96 / 2026 **+2.30**, and the **walk-forward λ rule underperforms pinning** (+0.44 vs +0.76 / +0.99 OOS;
the F-40 pattern on a weak signal). Fee-stressed, pinned λ=0.25 reads OOS +0.76 / +0.44 / +0.13 at 4 / 6 /
8 bps. **Not a port candidate**; L19's live falsifier is the 2024–26 concentration.

**Read.** The lab's discipline paid off twice: a claim settled once (F-28) was re-tested with the method
that had corrected its predecessor (F-24), and the answer changed — but the *new* answer is bounded
immediately (weak, churny, regime-loaded). The OI-change book is the lab's **second independent positioning
signal**, and the first signal claim to be re-opened.

*Amended by **F-46** (CYCLE-029): the "recent-regime" reading above is one notch too pessimistic. A
pre-registered pre-2024 holdout leaves λ=0.1 net-positive (**+0.47**, break-even 15.23 bps) and a fixed 50/50
blend of the two λ positive in **every** calendar year 2022–26; what was regime-specific was the **single
λ=0.25** that this section presented as "best".*

---

## F-46 — The OI-change signal is NOT a 2024–26 artefact — but the CYCLE-028 "best" λ was. [SUPPORTED — refines F-45, L19]

**Experiment:** `e38_oi_signal_holdout.js`. **Artefact:** `results/e38_oi_signal_holdout.json`. **Lead:**
L19 (refines F-45). Runs F-45's open falsifier — a pre-2024 read with the sign (+1) and the λ window
(0.1, 0.25) fixed A PRIORI, nothing re-fitted — then adds the regime-λ selection, the F-36 block-trend decay
test, a rank construction, the L18/toptrader/momentum confounds, the book's OI schedule, and a **fixed 50/50
blend** of the two pre-registered λ (no parameter chosen on any window). Guard: the daily sign+1 book
reproduces `e21#dLogOI_pos` (0.9612 / 1501.11).

**The falsifier's "kill" reading does NOT fire — the CYCLE-028 winner was the artefact.**

| book | pre-2024 (2021-12→2023-12, n=2270) | post-2024 (2024-01→2026-09, n=2976) |
| --- | ---: | ---: |
| λ=0.25 (F-45's "best") | gross 0.34 → break-even 2.96 bps → net@4 **−0.12** | gross 2.06 → 13.60 bps → net@4 **+1.45** |
| λ=0.10 | gross 0.64 → **15.23 bps** → net@4 **+0.47** | gross 0.82 → 14.33 bps → net@4 **+0.59** |
| sign control (−1, λ=0.25) | net@4 **−0.80** | net@4 **−2.66** |

The slower λ=0.1 clears a fee in **both** regimes at a **stable ~15 bps** break-even; the faster λ=0.25 — the
one F-45 called best — is entirely a post-2024 phenomenon. So a held-out read does not kill the *signal*; it
kills F-45's *parameter choice*. The two λ are **anti-phase** year-to-year (2023: 0.25 −0.86 vs 0.1 +1.88;
2024: +1.56 vs −0.26), and a fixed **50/50 blend** of them reads net@4 **+0.33 pre / +1.24 post**, break-even
**11.33 bps** and **254×/yr**, and is **positive in every calendar year 2022–26** (0.34 / 0.73 / 0.89 / 1.45 /
1.88) — beating both single λ on full-window net@4 (blend **0.77** vs 0.65 / 0.52).

**Supporting reads.** *Decay:* none — the net block trend is **positive** (λ=0.25 rho +0.67, p 0.053; gross
rho +0.77, p 0.018); the book has *improved*. *Construction:* the **rank** form does **not** help (λ=0.25 rank
pre −0.42 vs level −0.12; λ=0.1 rank post −0.36) — F-17's rank-beats-level does **not** transfer to OI, a
clean negative. *Confound:* independent of the L18 fade (return corr **−0.045**) and of the toptrader ratio
(x-sec **−0.016**); the ΔOI's **0.595** correlation with its *own-interval* price move is the F-28 look-ahead
echo (the causal forward IC is still 0.020) → a genuinely distinct stream. *Capacity:* the book's individual
OI schedule is mean **$23–28 M**, p5 **$6–8 M**, min **$3.7–4.5 M**, binding **DOGE/LINK/ADA** — the same
thin alts R8 binds on, so a joint LP is still required (deferred).

**Read.** F-45's "recent-regime" framing was one read too pessimistic. A *pre-registered* holdout shows the
phenomenon is present in the early regime at the slower scale and in an unfitted cross-scale blend every
year; what was regime-specific was the **single λ chosen on the full window**. This is the F-37/F-40 lesson
with a new resolution: when a single parameter is window-specific, the robust object can be a **blend across
scales**, not a retune (the retune was already shown to underperform, F-45). The signal remains weak, churny
(254–338×/yr) and thin-alt-bound, so L19 stays **OPEN** and **not port-ready**.

---

## F-47 — The L19 OI stream does not add to R8 (too weak), though the three-sleeve capacity frontier is 1.76× the sum; and the lab's mix convention is a vol-basis artefact. [MIXED — closes L19's additivity question; opens bug-register L10-y]

**Experiment:** `e39_oi_portfolio_add.js`. **Artefact:** `results/e39_oi_portfolio_add.json`. **Leads:**
L19 (additivity), L15/L17/L12/L18 (extends F-43/F-44), L10 (new bug **L10-y**). Reuses `e35#buildPair` (the
two port-spec books) and aligns F-46's fixed 50/50 λ OI blend onto the same leg; guards the two port-spec
individual OI means against `e34` (≤1.15 %), the 2-D LP against `e36` (0.01 %), and 3-D ≥ 2-D.

**(a) Return side — the OI stream does NOT add to R8.** Independent (corr with carry **+0.01**, fade
**0.00**) but too weak: on the **capital-fraction** convention the carry+OI ladder is monotonically
decreasing (carry alone net@4 **6.48**; 5 % OI → 2.82) and a walk-forward picks **OI = 0 % in 11/11**; on a
**risk-normalised** scale (each stream at unit vol — necessary because the carry book's net4 vol is
**0.4 %/yr** per unit gross vs the OI book's **24.3 %**, a **55×** gap) the max-Sharpe OI weight is **0.10**
for a **+0.04** Sharpe gain (6.48 → 6.52), and the risk-normalised walk-forward OOS is **6.58 ≈ carry-only**.
The OI stream is a standalone small sleeve, not a portfolio member.

**(b) Capacity side — the 3-sleeve LP finds room, but it is uninvestable.** The per-period 3-D LP
`max Σ g_s G_s s.t. |Σ G_s w^s_j| ≤ 5 %·OI_j` reads mean **$142.2 M**, **2.27×** the 2-D carry+fade LP
($62.7 M, F-44) and **1.76×** the sum of the three individual means ($80.9 M), with the optimal **OI share
mean 0.374** — the three books **net** across symbols, so the OI stream is *not* crowded out by R8's thin
alts. But the LP-optimal schedule churns **129.6× gross/yr** for **net@4 0.82**, so the deployable size
still needs a fixed-split/clipped schedule (the F-44 lesson). Running all three at their individual
compliant sizes breaches the 5 % cap in **58.8 %** of periods (peak 12.9 %; binds LINK/ADA/DOGE/XRP/SOL/BNB).

**(c) Methodological — the mix convention is a volatility-basis artefact (L10-y).** The fade's net4 vol is
**13.6 %/yr** per unit gross vs the carry book's **0.4 %** (**31×**). Risk-normalised, the max-Sharpe
carry+fade mix puts weight **0.13** on the fade for **6.55** (carry-only 6.48), and the 3-stream unit-vol
tangency reads **6.58** — a total gain of ~**+0.10** Sharpe. So F-43's *direction* ("mixing adds ~nothing")
stands, but its headline *magnitude* ("the fade dilutes carry 6.49→1.62") is the vol ratio, not
diversification.

**Read.** L19 closes as a **confirmed standalone** stream that is real (F-45/F-46) but does not improve the
port-ready R8 book and cannot be sized jointly by a stable schedule. The cycle's second result is a
measurement lesson: the lab has been quoting *capital-fraction* mixes of books whose per-gross P&L scales
differ by 30–55×, which turns every "does X diversify carry" number into the vol ratio.

---

## F-48 — A fixed two-scale EWMA blend matches R8's walk-forward λ out of sample, at half the turnover. [SUPPORTED — simplifies R8's λ policy; scopes F-37/F-39]

**Experiment:** `e40_retune_blend.js`. **Artefact:** `results/e40_retune_blend.json`. **Leads:** L12 (λ
policy), L16 (low-turnover construction). Builds the R8 spec family (rank funding, EWMA(λ), strict 12.5 %
cap) for the pre-registered cost-aware λ ∈ {0.005, 0.01, 0.02, 0.05, 0.1}, forms **fixed equal-capital
blends** over five pre-registered sub-sets, and compares them with the λ-only walk-forward (lookback 1095,
block 365) on one common OOS span `[1095, 6205)`. Guards the pinned λ=0.02 book against `e30`'s
full-history Sharpe (6.18/6.77) and `e31`'s OOS net@4 (6.86), absolute 0.01.

On the OOS span (net@4): walk-forward **6.63** (turnover 14×/yr, break-even 25.55 bps), pinned λ=0.02
**6.86** (10×/yr, 35.69 bps — but λ was tuned on the *full* history), best fixed blend λ∈{0.01, 0.02}
**6.66** (recent-24m **4.58**, **7×/yr**, break-even **46.14 bps**). The pre-registered falsifier does not
fire — the blend is within 0.2 Sharpe of the rule (indeed above it) and every pre-registered blend is
recent-positive — so **a fixed two-scale blend, with no rule, no lookback and no block, matches R8's
walk-forward λ out of sample at half the turnover and ~1.8× the fee headroom.** The blended set must
exclude the known-broken fast λ: the `all5` control (including λ=0.1) is the *worst* blend (4.36), so
nothing here rewards blind mixing. The walk-forward's OOS value over a well-chosen pinned λ is **−0.23** —
its F-37/F-39 advantage was over the *broken λ=0.1 spec*, i.e. it bought *slowness*, not a selection rule.
**Caveat:** the pinned λ=0.02 is itself in-sample (F-24/F-38), so this shows the *rule* adds nothing over a
fixed cost-aware blend, not that a *single frozen λ* suffices — the frozen-λ test is the open follow-up.
(A guard lesson: a cross-check against an artefact stored `toFixed(2)` must use an **absolute** tolerance;
a relative 5e-4 could not pass 6.184 vs 6.18.)

---

## F-49 — F-48's "fixed blend replaces the λ rule" is menu-dependent; a λ frozen on ≥2 years of trailing data is the honest simplification. [MIXED — scopes F-48; refines F-37]

**Experiment:** `e41_blend_hindsight.js`. **Artefact:** `results/e41_blend_hindsight.json`. **Leads:** L12
(λ policy), L16 (construction); tests F-48. Rebuilds the R8 λ family (rank funding, EWMA(λ), 12.5 % cap)
and the equal-capital blends, and guards the rebuild against `e40` exactly (walk-forward 6.63, pinned 0.02
6.86, `pair0102` 6.66 — all diffs 0.00). Then: a frozen-λ ladder, a 10-blend no-hindsight menu, and a
blend-selection walk-forward, all on the shared OOS span `[1095, 6205)` (rule 6.63; 0.2 bar 6.43).

**(a) Menu-dependent.** Only **1 of 10** pre-registered blends clears the 0.2 bar — the cherry-picked
`{0.01, 0.02}` (6.66). The **no-hindsight** sets justified by F-37's cost-aware slow range read
`{0.005,0.01,0.02,0.05}` **5.74** and `{0.005,0.01,0.02}` **6.08** (0.55–0.89 below the rule), and the
blend ranking **flips by window** (best OOS `{0.01,0.02}` 6.66; best recent `{0.005,0.01}` 4.74, `slow3`
4.63). **(b) Not learnable forward.** A blend-selection walk-forward (best set each block by trailing
net@4) reads OOS **5.81** vs the rule's 6.63 — 0.82 below the bar. **(c) A frozen λ on ≥2 y is the real
simplification.** Picking λ once on `[0,S)` and freezing: S = 1095 / 1825 pick the F-37-broken λ=0.1 →
OOS **1.93 / 1.76**; S = 2555 / 3285 / 4380 pick **0.02** → OOS **6.81 / 6.64 / 4.10** vs the rule's
6.69 / 6.48 / 4.27. So the walk-forward's value is **concentrated in the first ~2 years**; from ~2.3 years
on, a frozen λ=0.02 matches it. **(d) The freeze knob is non-monotone.** At S = 1095 a 365-period train
picks 0.02 (OOS 6.86) but 730/1095-period trains pick the broken 0.1 (1.93) — *more* history, worse pick;
only from S = 2555 do all train lengths agree.

---

## F-50 — R8's cap rule does not earn its keep: the joint (λ, cap) walk-forward is dominated by the pinned `ewma 0.02 + cap12.5 %` book, and the cap is a flat plateau. [MIXED — corrects F-39; confirms F-27 out of sample; extends F-48/F-49]

**Experiment:** `e42_cap_hindsight.js`. **Artefact:** `results/e42_cap_hindsight.json`. **Leads:** L12,
L16, L17; tests F-39/F-49. Rebuilds the 40-book (λ, cap) grid and guards `e31` **exactly** (joint WF 6.13;
pinned 6.63 / 6.86 / 1.93 — diffs 0.00).

With λ's rule gone (F-48/F-49) the cap is R8's last fitted object. **(a) The rule loses to the pinned
book.** OOS net@4: the joint (λ, cap) walk-forward **6.13** (recent-24m 4.49) vs the pinned
`ewma 0.02 + cap12.5 %` **6.86** (recent 4.30) vs `ewma 0.02` plain **6.63**; the pinned book is ≥ the rule
on **4 of 5** sub-spans (6.86/6.87/6.81/6.64 vs 6.13/6.29/6.78/6.41; only at S=4380 does the rule edge it,
4.42 vs 4.10). So F-39's "the port spec is a joint walk-forward" is **scope-corrected**: the rule's edge was
over the *broken F-24 spec* (+2.76) — the third appearance of F-48/F-49's pattern (F-37's λ rule, F-48's
blend, F-39's cap rule). **(b) The cap is a flat plateau and it binds.** At λ=0.02, OOS net@4 is **6.63**
(no cap) / **6.77** (0.10) / **6.86** (0.125) / **6.90** (0.15) — every cap ≥ 0.10 beats no-cap and the
level barely matters, so the structural `1/k = 0.125` is a *non-tuned* pick; the cap clips **42.3 %** of
weight entries (max uncapped |w| 0.438). This is the first **out-of-sample** confirmation of F-27 (cap lifts
OOS net@4 6.63→6.86, cuts turnover 17→10×). **(c) The joint freeze fails.** A frozen (λ, cap) pair picks
`0.075+cap0.1` for S ≤ 1825 (OOS **2.29–2.48**) and `0.03+cap0.15` for S ≥ 2555 (0.29–0.89 below the rule).
**(d) The cap freeze works.** With λ fixed at 0.02, the trailing-chosen cap reads **6.77 / 6.84 / 6.81 /
6.64 / 4.10** — ≥ the rule at every split, even on 1 year of history. So the division of labour is: **freeze
λ on ≥ ~2 y (F-49) + pin the cap at the structural 1/k = 0.125** — R8's spec is **pinned**, with no
walk-forward.

---

## F-51 — Is the fade's spec pinned too? The joint (λ, cap) walk-forward is dominated by the pinned `ewma 0.05 + cap12.5 %` fade book, and the fade's λ surface is flat. [MIXED — extends F-40/F-50; R7 is a pinned book]

**Experiment:** `e43_fade_pinned.js`. **Artefact:** `results/e43_fade_pinned.json`. **Leads:** L18; tests
F-40. Rebuilds e32's fade (λ, cap) grid and guards `e32` **exactly** (joint WF 0.70; pinned 0.94 / 1.11 /
1.14 / 0.69 / 1.03 — diffs 0.00).

CYCLE-031/032/033 (F-48/F-49/F-50) made **R8** a pinned book (λ frozen on ≥ ~2 y + cap = 1/k). R7 is the
lab's other deployable sleeve (the toptrader fade). **(a) The rule loses here too.** On the shared OOS span
`[1095, 5110)`, the joint (λ, cap) walk-forward reads **0.70** (recent-24m 0.46) vs the best pinned book
(`ewma 0.05 + cap12.5 %`) **1.14** and the pinned `ewma 0.1` spec **0.94**. **(b) A frozen λ matches or beats
it.** With the cap fixed at `1/k = 0.125`, a λ chosen on `[0, S)` picks **0.05** at essentially every split
(0.075 only at S=2555) and reads **1.14 / 1.15 / 0.37 / 0.83 / 0.87** vs the rule's **0.70 / 0.87 / 0.31 /
0.60 / 0.93** — beats-or-within-0.2 at every split (`fadeRuleFree: true`). Unlike R8, no ≥2 y minimum is
needed (a 1-year train already picks 0.05). **(c) The mechanism is λ-flatness.** With the cap fixed, the OOS
net@4 across the eight λ's spans only **0.16** (1.14 … 1.03); no cap, **0.25** — the walk-forward is ranking
near-ties and churns eight keys for a worse OOS. This is F-40's "trailing windows are noise-dominated at
Sharpe ~0.8", quantified. **(d) The cap helps the fade too.** At λ=0.1, OOS net@4 **0.94 → 1.11** and
turnover **28 → 16×/yr**, at the cost of a lower recent-24m read (0.84 → 0.47) — a capacity add, not a
recent-Sharpe add. So **R7's port spec is pinned as well** (`ewma 0.05 + cap 12.5 %`), and the port
conclusion is symmetric: **both deployable sleeves have pinned specs, no walk-forward.**

---

## F-52 — The cap's benefit is concentration, not turnover: a turnover-matched no-trade band recovers almost none of it, and the band stacks on the cap. [SUPPORTED — refines F-27/F-50; extends F-41/F-42]

**Experiment:** `e44_cap_mechanism.js`. **Artefact:** `results/e44_cap_mechanism.json`. **Leads:** L16,
L17; tests F-27/F-50. Rebuilds the R8 λ=0.02 book and guards `e30` **exactly** (net@4 4.92 / 6.18,
turnover 17 / 10, break-even 39.63 / 46.04, 5 %-of-mean-OI capacity $20,415,294 / $35,937,181).

F-27/F-50 show the strict 12.5 % cap lifts R8's net@4 **4.92 → 6.18** (full window) and roughly doubles its
OI capacity (**$20.4 M → $35.9 M**) — but never say *why*. The cap changes two things at once: it **clips
the concentrated extremes** (max `|w|` 0.438 → 0.125) and it **shortens the weight path** (turnover
17 → 10×/yr). A **no-trade band** is a pure turnover tool, so it isolates the two. **(a) The net gain is
NOT turnover.** A band swept to the cap's exact turnover (eps=0.008 → 10×/yr) reads net@4 **5.05** vs the
cap's **6.18** — **+0.13 of +1.26** — and across the entire band sweep (turnover 16 → 6×/yr) net@4 stays in
**[4.95, 5.05]**. **(b) The capacity gain IS concentration.** The band leaves max `|w|` at **0.436** (base
0.438, cap 0.125) and its OI capacity is a **1.00×** multiple of base ($20.44 M vs $20.42 M ratio-of-means;
$19.88 M vs $19.84 M min-of-ratio), while the cap is **1.76× / 1.70×**. **(c) The tools STACK.** A band on
top of the cap reads net@4 **6.36** at turnover **6×/yr** (vs capped alone 6.18 at 10). So the cap is a
**concentration** tool on both axes, and the port cost recipe becomes **cap `1/k` + a no-trade band**.

---

## F-53 — Does the cap-mechanism transfer to the fade? Yes: R7's cap is a concentration tool too, but the band does not stack there. [SUPPORTED — generalises F-52; explains F-51]

**Experiment:** `e45_fade_cap_mechanism.js`. **Artefact:** `results/e45_fade_cap_mechanism.json`. **Leads:**
L18, L17; tests F-51/F-52. Rebuilds the fade λ=0.05 book and guards `e32` **exactly** (base 0.82 / 14 /
118.38 / $37,378,256; capped 1.07 / 8 / 182.59 / $54,782,334).

F-52 found the R8 cap works by **concentration**. Does the fade's cap (F-51) work the same way? **(a) Yes —
the net gain is not turnover.** The cap lifts the fade's net@4 **0.82 → 1.07** (**+0.25**), but a no-trade
band swept to the cap's exact turnover (eps=0.05 → **8×/yr**) reads **0.78** — *below* base (**−0.04**) —
and the whole band sweep (turnover 14 → 6×/yr) stays in **[0.78, 0.95]**, far from the cap's 1.07. **(b) The
capacity gain is concentration.** The band leaves max `|w|` at **0.456** (base 0.500, capped 0.125) and
capacity a **1.03–1.04×** multiple of base, while the cap is **1.43–1.47×** ($37.38 M → $54.78 M
ratio-of-means; $32.43 M → $46.36 M min-of-ratio). **(c) But the band does NOT stack here** — a band on the
capped fade tops out at net@4 **1.13** at 6×/yr vs the capped fade's **1.07** at 8 (**+0.06**, below the
+0.1 threshold; R8 stacked +0.18). So the **concentration mechanism is general** (it is a property of
*clipping*, not of the dispersion book) but the **band remedy is R8-specific** — the port cost recipe is
**cap `1/k` + a band for R8, cap `1/k` alone for R7**.

---

## F-54 — Why does clipping help? The cap is a saturation of the tail — a smooth clamp matches it, but wholesale shrinkage and equal-weight destroy the edge. [SUPPORTED — sharpens F-27/F-50; explains F-52/F-53]

**Experiment:** `e46_cap_shrinkage.js`. **Artefact:** `results/e46_cap_shrinkage.json`. **Leads:** L16, L17;
tests F-27/F-50/F-52. Guards `e30` exactly (base 4.92 / 17 / $20,415,294; hard 0.125 6.18 / 10 / $35,937,181).

F-52/F-53 left the mechanism open: *why* does cutting the concentrated extremes raise net Sharpe? **(a) A
smooth saturation matches the hard cap.** `softCap(c) = c·tanh(w/c)` at c=0.125 reads net@4 **6.04** vs the
hard clip's **6.18** (a 0.14 gap; 6.11 at c=0.10) — so the *form* of the clamp barely matters, only the
**level**. **(b) The level is a plateau on the full window too** — `hardCap` **6.18 / 6.18 / 6.13 / 5.84 /
5.23** for c = 0.10 / 0.125 / 0.15 / 0.20 / 0.30, with `softCap` tracking (6.11 / 6.04 / 5.94 / 5.74 /
5.43, beating it at 0.30). **(c) But it is a *tail* clamp, not generic concentration reduction.**
`powerShrink(p) = sign(w)·|w|^p` lowers concentration yet reads **4.44 / 3.99 / 3.25 / 2.27** for
p = 1.25 / 1.5 / 2 / 3 — *all below base* (4.92) — because it shrinks the small weights too; the
`flat_rank` equal-weight book (least-concentrated) is worst at **1.51**. So the mechanism is
**winsorising the extreme tail while preserving the body** — a saturation, not a shrinkage. The hard form is
replaceable by a smooth one; the structural `1/k` level is what is load-bearing.

---

## F-55 — Is the "frozen λ matches the pinned book" conclusion split-point robust? Only past ~2.3 y; a rolling freeze beats the expanding one, and the cap stabilises it. [MIXED — refines F-49/F-50]

**Experiment:** `e47_split_robustness.js`. **Artefact:** `results/e47_split_robustness.json`. **Leads:**
L12, L16; tests F-49/F-50. Builds the R8 λ-ladder {0.005…0.1} capped/uncapped (guarding `e30` exactly) and
sweeps a **dense** split grid (every 365 periods) under a rolling 1-year freeze and the expanding `[0,S)`
freeze.

F-49/F-50 used a **five-point** ladder. The dense grid (−14 splits) **fails the pre-registered 0.80 bar
narrowly**: the **expanding** freeze is within 0.2 of the in-sample-best pinned book at **0.71** (median gap
0.00), the **rolling 1-year** freeze at **0.79** (median gap **+0.30**). But every failure is in the first
~2 years: the expanding freeze picks a fast λ and collapses at **every split S ≤ 2190** (−3.4…−4.4), then
picks **0.03** and matches at **10/10** splits from S = 2555. So it is a **quantified widening** of F-49's
known caveat (the safe boundary is **~2.3 y**), not a new anomaly. The dense grid refines the specifics: the
"broken" fast λ is **0.075** (not F-49's 0.1) once training exceeds ~1.3 y, the good pick is **0.03** (not
0.02), and the **rolling** freeze is strictly more robust than the expanding one (0.79 vs 0.71; F-49's
"non-monotone knob" was an artefact of the expanding window carrying the early regime forever). Finally the
**cap stabilises** the policy: rolled robustness **0.50** uncapped → **0.79** capped — a third independent
benefit of the 12.5 % cap.

---

## F-56 — L19's construction thread: the OI two-scale mix is optimal at 50/50, but a 1–2 day HOLD cadence lifts net@4 0.77 → 0.87 (fee-driven, no fitted rule). [SUPPORTED — refines F-45/F-46]

**Experiment:** `e48_oi_construction.js`. **Artefact:** `results/e48_oi_construction.json`. **Leads:** L19;
tests F-45/F-46. Builds the cross-sectional Δlog(OI) books (`xsBookImpl`, sign +1, `normalize:true`) and
compares a fixed non-equal two-scale mix `blend(w)` (renormalised, `e38`/`e39` convention), a `hold-N`
cadence (recompute the target every N periods), and a **no-hindsight** inverse-vol mix chosen on `[0,S)`
only (`S = 2555`). Two guards: the daily sign+1 book reproduces `e21#dLogOI_pos` (0.9612 / 1501.11) **and**
the renormalised 50/50 blend reproduces F-46's `e38` ensemble exactly (**0.77 / 11.33 bps / 254×**).

**The mix is null.** No fixed non-equal mix beats the equal one (0.3/0.7 **0.76**, 0.4/0.6 **0.77**,
0.6/0.4 **0.74**, 0.7/0.3 **0.69** vs **0.77** at 0.5/0.5), and an **unfitted** inverse-vol mix picks
`w = **0.51**` — almost exactly equal capital — scoring OOS net@4 **1.18** vs the 50/50 blend's **1.19** on
`[2555, end)`. So 50/50 is not a lazy convention; it is the vol-balanced optimum.

**The cadence is positive, and it is pure cost.** Holding the 50/50 blend's target for a few periods lowers
the **gross** Sharpe (1.18 → **1.05** at hold-3 → **1.03** at hold-6 → 0.95 at hold-9) but lowers turnover
faster (254× → 138× → **93×** → 73×/yr), so **net@4 rises 0.77 → 0.82 (hold-3) → 0.87 (hold-6)** (hold-9
ties at 0.83 but loses 2024, −0.44; hold-18/36 fall to 0.58/0.64). `blend50_hold6` clears the pre-registered
bar (0.87 > 0.77 + 0.05, break-even **27.03 bps ≥ 8**, positive every year 2022–26: 0.70/0.98/1.16/0.77/2.23)
⇒ `holdAdds` **TRUE**. The robust claim is the **1–3 day plateau** (hold-6 is the max of a five-point grid,
so +0.10 is an upper bound). This is the **opposite of the R7 band** (F-53: turnover-matched band *dropped*
the net) and the **same direction as the R8 band** (F-52): on a weak signal, turnover reduction is fee saving.

**Lab-internal bug found & fixed:** the first draft of `blendRows` averaged weight vectors **without
renormalising** and read 0.70 / 10.75 / 220 instead of F-46's 0.77 / 11.33 / 254; it was corrected to the
`e38`/`e39` convention and is now pinned by guard (ii). **Carried forward:** the turnover measure is
target-change (`turnoverSeries`), so inter-rebalance **drift-trading is not modelled** for a hold policy —
**CYCLE-040** tests this (drift-aware turnover + a finer hold grid).

---

## F-57 — Stressing F-56: the drift caveat does not bite, but the hold-6 gain is a cadence-fragile spike, not a plateau. [MIXED — scopes F-56]

**Experiment:** `e49_hold_drift.js`. **Artefact:** `results/e49_hold_drift.json`. **Leads:** L19; tests F-56.
Guards `e21#dLogOI_pos` (0.9612 / 1501.11) and F-46's `e38` ensemble (0.77 / 11.33 / 254) exactly. Two
pre-registered bars: **grid-robust** (≥ 3 fine-grid holds beat daily by ≥ 0.05 and the best's neighbours are
within 0.05) and **drift-robust** (the best hold's drift-aware net@4 beats drift-aware daily by ≥ 0.05, every
year positive).

**The drift caveat is falsified.** A true-hold simulation (weights drift `w′ⱼ=wⱼ(1+rⱼ)/(1+R)` between
updates, traded back only at updates) gives turnover **within 2×/yr** of the lab's target-change turnover at
**every** N — so `turnoverSeries` is *not* optimistic for a hold policy — and a slightly **higher** net@4
(hold-6 **0.94** vs the lab 0.87). F-56's fee saving is real.

**The cadence claim is scoped down.** On the fine grid (lab net@4): 1 **0.77**, 2 0.84, 3 0.82, 4 0.75, 5
0.74, **6 0.87**, 7 0.77, 8 0.73, 9 0.83, 10 0.65, 12 0.61, 15 0.57, 18 0.58, 24 0.57, 30 0.26, 36 0.64. The
best hold-6 is an **isolated spike** (**+0.10** over its neighbours 5/7) and only **4 of 15** fine holds clear
the +0.05 bar — non-contiguously (2, 3, 6, 9) — so `gridRobust` is **false**. The short-hold region (2–9)
averages **0.80** vs daily 0.77 (a real but tiny **+0.03**); the long region (10–24) collapses to **0.60**.
**What survives:** holding the 50/50 blend **≤ ~3 days is cheaper (254 → 73×/yr) and no worse** than daily;
beyond ~3 days it degrades — but the specific **+0.10 at hold-6 is noise**.

---

## F-58 — The OI sleeve's right cost tool is a no-trade BAND, not a hold cadence: a smooth plateau at net@4 0.92 beats hold-6's spike. [SUPPORTED — corrects F-56/F-57's construction]

**Experiment:** `e50_oi_band.js`. **Artefact:** `results/e50_oi_band.json`. **Leads:** L19; tests F-56/F-57.
Guards `e21#dLogOI_pos` and F-46's `e38` ensemble exactly. Ports the F-52/F-53 **no-trade band**
(`applyBand(rows, eps)`: move symbol j only when `|target_j − held_j| > eps`) onto the OI 50/50 blend and
sweeps `eps ∈ [0.0005, 0.1]`, matched point-by-point on turnover to the hold-N grid.

The band's best (`eps = 0.03`) reads net@4 **0.92** at turnover **198×/yr**, break-even **15.22 bps**,
**positive every year 2022–26** — **above** hold-6's 0.87 (which sits at 93×/yr) and the daily 0.77. It is a
**plateau** (three sweep points within 0.05 of the peak; the best's eps-neighbours close) with **no interior
re-rise** (`bandReRisers` **0** vs hold-N's **1**). `bandAdds` **true**. At matched turnover it wins **7 of
18** points, all in the strong region (turnover ≈ 173–200+); the cadence's residual edge at the *low*
turnover end is exactly its fine-grid spikes (F-57). **So the sleeve's construction is 50/50 + a no-trade
band (eps ≈ 0.03), not 50/50 + a cadence** — and the band is now confirmed as the lab's *general* cost tool:
R8 (F-52, stacks with the cap), R7 (F-53, alone), OI sleeve (F-58, alone).

---

## F-59 — Is the OI sleeve's band robust out of sample? Its edge over the cadence is (11/11), but its eps needs ≥ ~2.3 y to settle. [MIXED — confirms F-58, refines the parameter rule]

**Experiment:** `e51_band_holdout.js`. **Artefact:** `results/e51_band_holdout.json`. **Leads:** L19; tests
F-58. Guards `e21#dLogOI_pos` and F-46's `e38` ensemble exactly. On an 11-split dense grid (S = 1095 … 5110)
it picks `eps*` (band) and `N*` (hold) by in-sample `[0,S)` net@4, freezes them, and scores `[S, end)`, plus
the fixed `eps = 0.03` band, fixed `hold-6` and the daily blend.

The frozen-eps band beats the frozen-N hold at **11 of 11** splits (`bandDominatesHold` **true**) and the
**fixed** `eps = 0.03` beats both the daily blend and fixed `hold-6` at **every** split — so F-58's band-over-
cadence claim is **not** a full-sample artefact. **But the trailing `eps` pick is unstable on short windows**:
4 distinct values overall, with S = 1460/1825/2190 choosing the **largest** eps (`0.1`) and underperforming
the fixed `0.03` OOS (1.03–1.22 vs 1.40–1.65). From **S ≥ 2555** the picks collapse to {0.025, 0.03, 0.04}
and from **S ≥ 3650** to a single `0.03` (`epsPickStableLate` **true**); the pre-registered stability bar
fails overall (`bandRobust` **false**) but passes late — the **~2.3 y** boundary of F-49/F-55, now for the
band's eps. **So: pin `eps ≈ 0.03` (robust even when the picker would wander), or choose it on ≥ ~2.3 y.**

---

## F-60 — The port artefact: one module reproduces all three sleeves' books. [SUPPORTED — packages F-27/F-50/F-52/F-53/F-54/F-58/F-59]

**Prototype:** `prototypes/port.js`. **Experiment:** `e52_port_artefact.js`. **Artefact:**
`results/e52_port_artefact.json`. **Leads:** L12, L18, L19. `port.js` extracts the shared weight
post-processing — `clipWeights` (clip-and-hold, no renormalisation), `bandWeights` (per-symbol no-trade
band), `cleanBook` (cap **then** band) — plus `SLEEVE_SPECS` (the final pinned recipes) and
`MIN_TRAIN_PERIODS = 2555` (~2.3 y, the F-49/F-55/F-59 rule). `e52` rebuilds each sleeve's raw rows and applies
**`port.js` only**, checking against the stored artefacts:

| sleeve | chain | here | stored | ✓ |
| --- | --- | --- | --- | :---: |
| R8 | `cleanBook(base, {cap:0.125})` | 6.18 / 10× / 46.04 | `e30#ewma_0.02_norm_cap12.5` | ✓ |
| R8 | `cleanBook(base, {bandEps:0.008})` | 5.05 / 10× | F-52 matched band | ✓ |
| R8 | `cleanBook(base, {cap:0.125, bandEps:0.005})` | 6.31 / 7× | F-52 cap+band stack (6.36 / 6×) | ✓ |
| R7 | `cleanBook(base, {cap:0.125})` | 1.07 / 8× / 182.59 | `e32#lam0.05_cap0.125` | ✓ |
| OI | `cleanBook(blend, {bandEps:0.03})` | 0.92 / 198× / 15.22 | `e50#bestBand` | ✓ |

All five pass, so the **same two functions** reproduce every published book across three sleeves, in the exact
order the findings fixed (cap first; band stacks on the cap for R8, omitted for R7, alone for OI). The port is
now **one executable module** — and it carries the **~2.3 y** frozen-parameter rule as data, so a port cannot
silently drop the cap, the band, or the training-window minimum.

---

## F-61 — The shipped carry grid join mis-scales sub-8h funding, and its audit is blind to it. [SUPPORTED — defect; confirms the pre-registered FOLD-BACK R4(b)]

**Experiment:** `e53_carry_grid_audit.js`. **Artefact:** `results/e53_carry_grid_audit.json`. **Leads:** L10
(L10-d settled; new L10-aa/ab/ac). This cycle settles the check FOLD-BACK R4 pre-registered in CYCLE-006:
audit the repo's `analysis/carry.js#carryOnBarGrid`/`carryPanelStream` (the shipped funding → bar-grid join)
for (a) a candle-tail guard, (b) sub-8h funding aggregation, (c) exact bar alignment. **Answer: (b) is missing.**

**The code contradicts its own comment.** `carry.js` lines 22–26 (above `FUNDING_GRID_MS`) say the audit
"tolerates both [8h and 4h] and the bar-grid projection **divides by the period actually observed**." The
projection does not: `carryOnBarGrid` sets `perBar = gridMs` (the **default** 8h), infers
`barsPerPeriod = round(gridMs / firstBarStep)` from the **first two** bar timestamps, and writes
`rows[ri].fundingRate / barsPerPeriod` to every bar until the next funding row — so every row is spread over a
full 8h worth of bars regardless of the interval it actually covers. (Same defect class as L10-o, but in the
repo's module rather than the lab's loader.)

**Synthetic ground truth** (one 8h period, 1h bars, rate r):

| funding interval | rows in the 8h | returned receipt | 8h sleeve | understatement |
| --- | ---: | ---: | ---: | ---: |
| 8h | 1 | r | r | **1×** |
| 4h | 2 | r | 2r | **2×** |
| 2h | 4 | r | 4r | **4×** |
| 1h | 8 | r | 8r | **8×** |

So the "sums to the rate" / "the sum over a period equals the 8h sleeve exactly" invariant holds **only** for
8h-uniform funding; for any sub-8h interval the function returns one rate per 8h.

**It bites the shipped data.** Only SOLUSDT carries sub-8h funding: its interval histogram reads
{8h: 6579, 4h: 3} plus **98 off-grid (2h) steps**, all 2022-11-09→18 (FTX). And the audit does **not** flag
it — `auditFundingProblems` returns **[]**, because the steps are 1.47 % of the file (under the 2 %
`maxOffGridFraction` budget) and `missingPeriods` counts only steps **longer** than a period. Over the FTX
window (264 1h bars) the shipped projection receipts **−0.1070** against the bucket-summed **−0.3244** — a
**3.03×** understatement of a *negative* carry, i.e. the crash's short-perp bill is under-counted. On the
pooled equal-weight 8h sleeve (6691 periods) the error makes the sleeve look **better**: annualised carry
**9.985 %** (corrected **9.531 %**) and Sharpe **11.96** (corrected **9.60**) — the bug fails *safe*, the
F-18 direction trap again (a defect that flatters a number evades the "implausibly large" alarm). P4's
independence claim survives: the correlation with the market moves 0.080 → 0.062.

**A latent second defect (L10-ab).** `barsPerPeriod` is inferred from a **single** bar pair, so a window whose
first two bars straddle a missing candle **doubles** the whole symbol's carry (a synthetic 2h first step reads
**2×** the clean receipt). Every shipped candle file's first pair is modal today, so it is **latent** —
registered, not triggered. The robust form is a median step, or the observed funding interval per row.

**Lab side unchanged.** The lab's loader buckets rows into 8h **sums** before projecting (the L10-o fix), so no
lab number moves; `e14_data_integrity.js` now pins that aggregation as lossless over SOL's FTX window (check
13 `sub_8h_sleeve_equality`), so the lab cannot regress onto the repo's per-row scaling. **FOLD-BACK R4** is
updated: the port must carry the bucket-sum projection, and the fix belongs in the repo's `carryOnBarGrid`.

---

## F-62 — The dependence/DSR backbone is unbiased but low-precision, and `effectiveBars` is unbounded. [SUPPORTED — validation + calibration; settles L10-f/L10-i]

**Experiment:** `e54_dependence_audit.js`. **Artefact:** `results/e54_dependence_audit.json`. **Leads:** L10
(L10-f and L10-i settled; new L10-ae). Every pooled significance verdict the lab reports rides on the repo's
`walkforward#dependenceSummary` — a delete-one-cluster jackknife over fold-window clusters
(`analysis/dependence.js`) that estimates the design effect of the pooled Sharpe, feeds
`effectiveBars = n / designEffect` into `backtest#backtestMetrics`, and gates on
`adjustmentNeeded = designEffect > 1`. CYCLE-045 audits it against **closed forms** (the same
synthetic-ground-truth technique F-61 introduced), with seeded ensembles and 2.5-standard-error bands (the
F-57 discipline: one realisation of a noisy statistic is not a measurement).

**The estimator is unbiased.** Every ensemble mean lands inside its own 2.5-SE band of the survey-sampling
design effect (Kish 1965), max gap **0.318** over 14 rows, zero biased rows:

| structure | closed form | ensemble-mean DE |
| --- | ---: | ---: |
| K = 8, ρ → 0 / 0.25 / 0.5 / 0.75 / 0.95 | 1 / 2.75 / 4.5 / 6.25 / 7.65 | 0.989 / 2.751 / 4.439 / 6.101 / 7.399 |
| K identical (K = 2, 4, 8; fold 40 & 100) | 2 / 4 / 8 | 2.03–2.14 / 3.75–4.02 / 8.07–8.32 |
| negatively-correlated pair (ρ = −0.2 / −0.5 / −0.8) | 0.8 / 0.5 / 0.2 | 0.909 / 0.571 / 0.228 |
| i.i.d. 8-stream (null) | 1 | 1.001 (C = 36) / 1.016 (C = 288) |

So F-02's real-basket reading (DE 4.92 at ρ ≈ 0.56) is the estimand it claims to be, and the estimator
tracks `1 + ρ` through the sign change. **But it is noisy:** on true-i.i.d. data (DE must be 1) a single
realisation at **C = 36** folds reads sd **0.243**, p05–p95 **0.644–1.452**; at **C = 288** sd **0.097**
(0.899–1.231) — a **−36 %/+45 %** band at the repo's own fold count, halving with an 8× cluster count. Any
`designEffect` quoted to two decimals (F-02, F-47) overstates the resolution by ~an order of magnitude; a
single pooled reading is only meaningful to ±0.25, and an `adjustmentNeeded` verdict within ~1 ± 0.25 of the
gate is not resolvable. The lab's `serialDesignEffect` mirror is centred correctly (0.98–1.06) with sd
growing 0.075 → 0.294 as the fold count 50 → 250 (L10-p's outlier fragility, now quantified as a fold-count
effect).

**`effectiveBars` is UNBOUNDED (L10-f).** A ρ = −0.5 diversifying pair reads ensemble-mean DE **0.506** and
`effectiveBars > rawBars` in **25/25** realisations (max 8210 vs 2400) — so `designEffect < 1` is a real
regime the comment anticipates. But the limit it does **not** anticipate: a perfectly hedged pair (one stream
the exact negative of the other) gives `designEffect = 4.7e−32` and `effectiveBars = n/DE ≈ 3.4e34`, and
`adjustmentNeeded` reads **false** — because DE is a **squared** ratio, the `designEffect > 0` guard passes at
1e−32. The bound the comment relies on does not exist.

**L10-i resolved — the DSR path is intended, and lossy.** `backtestMetrics` requires
`2 ≤ effectiveBars < n`, so the exploded 3.4e34 is **declined**: `nEff` and `dsrAdjusted` come back `null`
and the raw Sharpe is used. Declining to inflate on a diversifying panel is the documented, intended
behaviour — not a defect. The residual is that a hedged panel and a degenerate panel produce the same `null`
readout, so a consumer cannot tell them apart without inspecting `designEffect` itself.

**Read.** F-62 is a *validation + calibration* finding, not a shipped-path defect (hence no fold-back):
the repo's dependence/DSR machinery means what it says (unbiased), but it is lower-resolution than a
two-decimal quotation implies, and `effectiveBars` has no upper bound. This is the lab's **second**
synthetic-ground-truth experiment on a repo function (after `e53`/F-61), and the 2.5-SE-band method is now a
standing recipe.

---

## F-63 — The split family's purge contract: the purged variants hold, the walk-forward does not purge. [SUPPORTED — defect; validates the siblings; LATENT on the shipped path (CYCLE-047)]

**Experiment:** `e55_split_audit.js`. **Artefact:** `results/e55_split_audit.json`. **Leads:** L10 (new
L10-af/L10-ag; fold-back candidate R9). `analysis/splits.js` opens "Time-series cross-validation with
purging and embargoing", and `test/lock-registry.js` claims for the family: "Proved: train/test disjoint,
**zero label-window leakage**, train starts after embargo". CYCLE-046 audits that against a **closed-form**
label-overlap ground truth (a fold leaks iff some training label window `[i, i+H−1]` overlaps a test label
window `[j, j+H−1]`, i.e. `0 < j−i ≤ H−1`).

**The purged variants hold.** `purgedKFoldSplit` (grid n ∈ {200, 1000}, k ∈ {4, 8}, labelSpan
H ∈ {1, 2, 5, 20}, embargo ∈ {0, 2, 10}) and `combinatorialPurgedSplit` (n ∈ {240, 1200}, k ∈ {4, 6},
testGroups ∈ {1, 2}, H = 5, embargo = 3) are **leak-free on every fold** (0 overlap pairs) and honour the
embargo band `(purgeEnd, embargoEnd]`; CPCV's test multiplicity is exactly `C(k−1, m−1)`.

**`walkForwardSplit` performs no purging or embargoing.** Its boundary protection is index order only, so
for a label horizon H > 1 the fold boundary leaks exactly `H(H−1)/2` training/test label-overlap edges per
fold (measured = closed form on every row):

| H | leak edges / fold | testSize 40 (12 folds) | testSize 10 (48 folds) | `isCausalFold` |
| ---: | ---: | ---: | ---: | --- |
| 1 | 0 | **0** | **0** | pass |
| 2 | 1 | 12 | 48 | pass |
| 3 | 3 | 36 | 144 | pass |
| 5 | 10 | 120 | 480 | pass |
| 10 | 45 | 540 | 2160 | pass |

The folds carry **no** `purgeStart`/`purgeEnd`/`embargoEnd`, and passing `labels`/`labelSpan`/`embargo`
returns **byte-identical** folds — there is no purge path at all. `isCausalFold` tests `train < test` by
index, not label-window overlap, so it passes every leaky fold (a *look-ahead-in-time* check, not a
*leakage* check). The repo's `assertNoLeakage` flags it, but the tests call it only on the purged K-fold
and CPCV variants.

**The leak is exploitable.** Over 200 seeded worlds (H = 5, 48 leak-zone bars each), an index-lookup model —
permitted by the API, which hands it `trainIdx` — reads a training label whose window contains the test bar
and posts a per-bar P&L edge of **+0.0035** (se **0.00007**) on the leak zone, while the clean zone reads
**0.0000** and a purge-trimmed walk-forward **+0.0001**. In deployment that label is not available at
decision time; it is in the fold only because the boundary was not purged.

**Scope — resolved (CYCLE-047): LATENT, not live.** Every lab walk-forward result (F-13, the F-37–F-59 OOS
machinery) scores **parameter-free signals** → label span 1 → zero leak, so no lab number moves. The
shipped controller's labels *do* overlap (the repo's own diagnostic reads `heldBars {mean 8.30, max 54}`),
so the defect's precondition is met — but the leak still does not reach the shipped model. The controller
is **online**: `analyze.js#makeControllerModelFactory` fits a fold by replaying bars `1 … testStart`
(`analyze.js:1018`), each call seeing only a window ending at `i − 1`, so the last training bar is
`testStart − 1` and the fold's declared `train` list is ignored; and `hivemind/controller/trades.js` labels a
trade by its outcome at the **exit** bar, with only *closed* trades entering training. So every training
label is realised at an exit `≤ testStart − 1` — causally before the test — and the leak (which needs a
training label realised *inside* the test window) cannot occur. The fix (R9) would matter only for a
**fixed-label offline** model fitted on the fold's training *block*, the shape the exploit models; the repo
runs none on this path. The defect is confirmed structurally, demonstrated exploitable in principle, and
**scoped down to latent** by the trace.

---

## F-64 — The labelling module: correct on its stated contracts, five latent warts, and only one shipped consumer. [SUPPORTED — validation + audit; CYCLE-048]

**Experiment:** `e56_labels_audit.js`. **Artefact:** `results/e56_labels_audit.json`. **Leads:** L10 (new
L10-ai…L10-ap). `analysis/labels.js` owns the label spans F-63 turned on: `tripleBarrierLabels` returns
`t1`, the *realisation* index, which the repo's own test feeds straight into `uniqueness`; `cusumFilter`
feeds it events; and `fractionalDiffWeights` is the one export the A/B actually imports. CYCLE-048 audits
each primitive against a **closed form**, with 23 exact guards (77 ms).

**The contracts hold.** The three pinned repo cases reproduce; on **192** monotone cases the first crossing
is exactly `ceil(level/step)` with the opposite barrier unreachable; on **60** seeded random paths every row
satisfies the exact contract — touched = the **first** bar satisfying either condition,
`ret = prices[touched] − entry`, `label 1 ⇒ ret ≥ ptMult·v`, `label −1 ⇒ ret ≤ −slMult·v`,
`label 0 ⇒ −slMult·v < ret < ptMult·v` and `touched = min(n−1, e+maxHolding)`. `cusumFilter` matches an
**independent** drawup/drawdown formulation of its own reset rule on **160/160** grid rows and **12/12**
monotone closed forms. `fractionalDiffWeights` matches `(−1)^k C(d,k)` exactly for integer `d` (1e−12) and
against an independent Lanczos-`Γ` evaluation for non-integer `d` (max rel. err **2.3e−14…4.1e−14**);
`d = 1, size = 0` is the first difference, `size = 1` is the identity, the NaN warm-up is exactly
`t < width − 1`, and the **shipped** `fracDiffAt`/`fracMomentum` equal the weights convolution exactly
(54 configs + momentum). One caveat on the reading: `ret` is the **realised** price change (a price
difference, not a fraction and not `vol`-scaled) — in the random grid the touch bar **overshoots** the
barrier level **1362** times (gaps), so `ret > ptMult·v` strictly on those rows.

**Five warts, all latent (see the scope row).**

1. **The `pt`-before-`sl` tie-break is dead for `vol > 0` and degenerate for `vol ≤ 0` (L10-ak).** A bar can
   satisfy both conditions iff `(ptMult + slMult)·vol ≤ 0`: at `vol = 2.7/1.4/0.3` **0 of 6** bars do, at
   `vol = 0` **3**, at `vol = −0.5/−2` **6**. So the ordering is unobservable on the whole sane domain
   (`vol > 0`) — and at `vol = 0` the triple barrier **collapses to a one-bar sign label** (`label =
   sign(prices[e+1] − prices[e])`, touch always `e+1`, horizon ignored; a flat series labels **11 of 12**
   events **+1 at `ret = 0`**), while `vol < 0` inverts the barriers and labels almost everything +1.
2. **The default event set emits a zero-horizon bet (L10-al).** `events = null` expands to every index
   *including* `n−1`, for which `t1 = min(n−1, n−1+H) = n−1 = event` → an empty loop and a
   `{label: 0, ret: 0}` row **indistinguishable from a vertical-barrier timeout** (n=30, H=10: exactly one
   such row; exactly `H` events get a truncated vertical barrier). The repo test asserts only
   `t1 >= event` and takes its uniqueness spans as `[event, t1]`, so a point span can pass unnoticed.
3. **`cusumFilter` accepts an `events` argument it never reads (L10-ai)** — output byte-identical with and
   without it (the L10-af "advertised option that does nothing" class).
4. **`cusumFilter`'s `lastEmit` guard is dead (L10-aj)** — `lastEmit` is only assigned the strictly
   increasing loop index, so `t !== lastEmit` is always true; proven constructively: the guard-free
   independent reference matches on all 160 + 12 cases.
5. **The weights' auto-window docstring is false (L10-am).** It says "`size <= 0` uses
   DEFAULT_FD_WINDOW"; the code stops at the first `|w| < 1e−12`, giving widths **1/2/3/4** for
   `d = 0/1/2/3` (and 100 for `d = 0.1/0.4/0.5/−0.5`). The repo test samples only `d = 0.4` — the one case
   that cannot catch it (the L10-ag lesson).

**Corrected candidate (no defect, L10-an).** The pre-registered read "`fractionalDiffWeights(0, 0)` returns
width 2 → position 0 NaN" is **false**: `d = 0` auto returns `[1]` and `fractionalDiff(series, 0, 0)` is the
**exact identity with no NaN**; the width-2 / NaN-at-0 behaviour belongs to `d = 1` (correct for a first
difference).

**Scope (L10-ao): only 1 of the module's 6 exports is on the shipped path.** The A/B reaches `labels.js`
**only** through `analysis/features.js:34` (`fracDiffAt`/`fracMomentum`); `tripleBarrierLabels`,
`cusumFilter`, `fractionalDiff`, `fracDiffLogPrices` and `DEFAULT_FD_WINDOW` are consumed by
`test/browser/entries/analysis.test.js` and `test/lock-registry.js` only (the shipped controller labels
trades in `hivemind/controller/trades.js`). So every wart above is **latent** — no shipped behaviour moves.

**Calibration (L10-ap).** The one shipped consumer uses `window: 16` at `d = 0.4` (`features.js:387`) while
the module's own auto window (and its pinned test constant) is **100**: `w_15 = −6.178e−3`, `w_16 =
−5.638e−3`, and the coefficients beyond `k = 15` carry **6.27 %** of the first-100 window's `|w|` mass
(0.1188 of 1.8933), with the 100-cap itself omitting a further **0.0845**. A deliberate window/warm-up
trade-off (16 weights are usable from `t = 15`, 100 only from `t = 99`) on an arm the README already lists
as DROPPED — recorded, not flagged.

---

## F-65 — The PBO / CSCV module: exact structure, a reproduced calibration draw, and a 252-split statistic that is really ~4 splits. [SUPPORTED — validation + calibration + audit; CYCLE-049]

**Experiment:** `e57_overfitting_audit.js`. **Artefact:** `results/e57_overfitting_audit.json`. **Leads:**
L10 (new L10-aq…L10-av). `analysis/overfitting.js` implements the Probability of Backtest Overfitting
(Bailey et al. 2016) over `C(S, S/2)` combinatorially symmetric splits, and the repo's `docs/LOCKED.md` /
`test/lock-registry.js` make both exact structural claims *and* quote a calibration ("20 iid-noise
strategies, T=500, S=10, 252 splits: PBO = 0.464").

**The structure and the closed forms are exact.** `cscvBlocks` partitions exactly (remainder on the first
blocks, 7/7 cases); `cscvSplit` yields exactly `C(S, S/2)` splits (6/6 `S ∈ {2…12}` against an independent
binomial), each a disjoint cover, each block in exactly `C(S−1, S/2−1)` in-sample sets, the set closed under
complement, and the cap rejects `C(22,11) = 705432` while passing `C(20,10) = 184756`. `relativeRank`
matches best `N/(N+1)`, worst `1/(N+1)`, full tie `1/2` and average tie ranks (`[5,5,1,1]` → 0.7 / 0.3).
`oosOnIsRegression` matches an **independent sum-formula OLS** on 40 random vectors (1e−9) with the right
degenerate cases. Constructed PBOs are exact: all-flat → **1**, one dominant strategy → **0** (IS winner
`j = 0` in all 252 splits), an anti-persistent pair → **1** (slope ≈ −1), and a hand-computed metric-override
pair on `[[5,0,0,0],[0,0,0,0]]` → **0.5** / **1.0**. PBO is exactly invariant under annualisation and under
positive per-column scaling.

**The calibration reproduces exactly — and is one draw.** With the repo's own RNG at seed 20240 the quoted
draw is reproduced to the split: **PBO = 117/252 = 0.46429**, degradation slope **−0.0936**. But the
ensemble (60 i.i.d. matrices, N = 8, T = 400, S = 10) centres at **0.4769** (se 0.0329) with **sd 0.2546**
and p05–p95 **0.099–0.885**, while the binomial split SE of one 252-split PBO is only **0.0315** → an
implied split **design effect of 65.4**, i.e. **≈ 3.9 independent splits**. The other two regimes hold: a
persistent edge gives **PBO 0** with slope ≈ **+1.00** (12/12 seeds), a planted regime flip gives **PBO 1**.
So the module's own calibration figure is a single realisation of a ~0.25-wide distribution, and any PBO
quoted to 2–3 decimals overstates its resolution ~8× (the **F-62** lesson, one level up: last cycle a
`designEffect`, this cycle the whole estimator).

**Five latent rows.** **L10-aq** — `relativeRank` skips non-finite entries in the rank but divides by the
**full** length (`relativeRank([1,2,3,NaN],2) = 3/5 = 0.60` vs 0.75), so a `NaN`-producing `metric` depresses
`omega` and biases PBO **up**. **L10-ar** — the `lambda ≤ 0` convention forces a **fully-tied** roster to
PBO **exactly 1** (all-flat, all-identical), though *partial* duplication does **not** bias PBO (measured
**0.5806 → 0.5671 → 0.5401** for 0/5/19 duplicate columns, sign 6/10 — the pre-registered mechanism guess is
**falsified**). **L10-as** — `degradation` returns `n = N·splits` (**2016**) dependent pairs though only
`N·S = 80` block performances determine them, so a naive `t = sqrt(r²(n−2)/(1−r²))` exceeds 1.96 on
**91.2 %** of skill-less matrices (nominal 5 %). **L10-at** — a 252-split PBO is worth ~4 independent splits
(sd 0.2546 vs 0.0315). **L10-au** — `cscvBlocks(6,6)` alone yields six **1-observation** blocks (only the
PBO entry enforces `blocks ≤ floor(T/2)`, and its message says "per half" where the rule is per block).
**L10-av** — scope: **no shipped module imports `overfitting.js`** (only `analysis.test.js` +
`lock-registry.js`; the `decision.js`/`reality_check.js`/`walkforward.js` matches are comments), so every row
is latent. No fold-back row.

---

## F-66 — The resampling hub: exact bootstrap / HAC / subsampling identities, a documented reference the block-length selector does not reproduce, and two ungated suite steps. [SUPPORTED — validation + audit; CYCLE-050]

**Experiment:** `e58_reality_check_audit.js` (39/39 checks, 5.6 s). **Artefact:**
`results/e58_reality_check_audit.json`. **Leads:** L10 (new L10-aw…L10-az). `analysis/reality_check.js` is
the resampling backbone: the stationary-bootstrap index process, the Newey-West (Bartlett) HAC standard
error, White's Reality Check / Hansen's SPA and the consistent SPA + Romano-Wolf step-down, the
Politis-White automatic block-length selector, and the variance-consistent subsampling family. Unlike the
rest of the audit queue it is **partly shipped**: `forecast.js` imports `stationaryBlockIndices`
(Diebold-Mariano + Model Confidence Set) and `walkforward.js` imports the four subsampling procedures
(familywise search).

**The shipped primitives are exact (validated).** `stationaryBlockIndices(n, b)` has length `n` with
in-range indices, is deterministic for a given rng stream, is **byte-equal at `b = 1` to an independent
hand replay of the same stream** (two draws per bar `t > 0`, one for bar 0 → i.i.d. with replacement), and
replays byte-for-byte under the geometric restart law (`P(restart) = 1/b`, cursor `+1 mod n`); its
measured restart rate and mean run length match `1/b` and `b` within 2.5 bootstrap SEs. `neweyWestSE`
matches an **independent** `γ(0) + 2Σ w_j γ(j)` implementation on 24 random windows × bandwidths (1e−12),
equals the i.i.d. SE at bandwidth 0, returns exactly 0 on a constant window, is slice-invariant, and uses
the documented default bandwidth `max(1, round(len^(1/3)))`.

**The RC / SPA / subsampling arithmetic is exact (validated).** RC = `sqrt(T)·max_k mean(f_k)` (and a
constant benchmark `b` shifts it by exactly `−sqrt(T)·b`); SPA = `max(0, max_k fbar_k/ω_k)` with ω the
bootstrap SE (independently recomputed from the same draws); a zero-variance positive candidate is an
infinite t with `p = 0`; the consistent recentring bound is exactly `A_k = ω_k·sqrt(2 log log T)`; when
every candidate is valid the consistent and upper recentring **coincide** (p, statistic, recentring
identical); `p(SPA_c) ≤ p(SPA)`; the step-down's **first step is bit-equal to the single-step consistent
SPA**; the step p-values are monotone and it stops at the first failure. In the subsampling family: k-FWER
at `k = 1` equals the step-down's first p equals the consistent SPA p; SPA/step-down/k-FWER share **one**
reference (means, SEs, recentring, window length, bandwidth all identical); subsampling is deterministic
(no rng); every window statistic equals `(windowMean − recentring)/shrink/neweyWestSE(window, m)` exactly;
`shrink = sqrt(1 − b/T)`; `groups = [T]` is bit-identical to ungrouped and grouped windows never straddle
a segment. (Recorded subtlety: the k-FWER reference is the k-th **largest** window statistic, so its
p-value is non-**increasing** in `k`.)

**The selector does not reproduce its documented reference (L10-aw).** The comment claims
`politisWhiteBlockLength` \"reproduces the reference implementation `arch.bootstrap.optimal_block_length`
… to floating-point precision\". It does — where its own guard does not fire: on 30 series with `g > 0` it
matches a **vendored port of arch's `_single_optimal_block`** to 1e−9, and it reproduces the arch AR(1)
benchmark vector **13.635665 / 15.608940** from an **independently implemented NumPy legacy-RandomState(0)
stream** (known first draws 0.5488135039273248 and 1.764052345967664). But its `length` helper returns
**exactly 0** unless `sigma2 > 0 && g > 0`, while the reference **squares `g`** and is positive for a
mean-reverting series: over 200 AR(−0.5) T=400 draws the repo returns 0 in **198** and arch a positive
length (e.g. **22.0** at `g = −0.858`, **5.99** at `g = −0.273`, **10.86** at `g = −0.565`). Consequence:
`autoBlockLength` floors to block length **1 (i.i.d.)** on 99 of 100 of those series — the automatic block
bootstrap silently degrades to i.i.d. resampling on exactly the anti-persistent streams that need it
most. The guard may be a deliberate improvement over the reference, but the floating-point-agreement claim
is false on a non-degenerate set (the F-61 lesson). It also fires on **58 %** of i.i.d. T=120 columns.

**Two more latent warts and the scope.** **L10-ax** — `autoBlockLength`'s `median` reduction is the
**upper** median for an even arm count (`sorted[floor(K/2)]`, not the average of the two middle order
statistics): on one 4-arm matrix per-arm `[3.671, 4.848, 3.369, 6.357]` the upper median **4.84761** is
returned where the standard median is **4.25907** (the repo test uses odd `K = 5`, the one case that
cannot see it). **L10-ay** — `neweyWestSE`'s `if (!(v > 0)) v = 0` clamp guards a `v < 0` arm that is
**unreachable**, because the Bartlett-tapered sum is a **PSD quadratic form**: an exhaustive search over
every ±1 window up to length 18 × every bandwidth plus 3000 random windows finds minimum taper **exactly
0** and never a negative value, so only the constant-window (`v = 0`) arm is live (\"rounding noise\"
cannot make it negative). **L10-az** — scope: the block-bootstrap family (`whiteRealityCheck`,
`hansenSpa`, `hansenSpaConsistent`, `romanoWolfStepM`, `consistentRecentring`,
`politisWhiteBlockLength`, `autoBlockLength`, `bootstrapRelativeMeans`) is **test-only**; the shipped
consumers are `stationaryBlockIndices` (via `forecast.js`) and `neweyWestSE` + the four subsampling
procedures (via `walkforward.js`), so L10-aw/ax/ay are latent.

**Independent calibration (the F-57/F-62 discipline).** On my own seeds (K = 5, T = 100, 200 reps) the
subsampling SPA holds its size across the persistence sweep (**0.040 / 0.045 / 0.045 / 0.030** for
φ = 0/0.2/0.5/0.8) while the block-bootstrap consistent SPA over-rejects (0.090 / 0.105 / 0.180 /
**0.385**), and RC/SPA keep their size under a pure i.i.d. null (0.035 / 0.065). The first
synthetic-ground-truth audit in this queue whose *statistic* passes its own calibration independently.

**Lab bug fixed.** `e56` and `e57` never exposed `verdict.validationPass`, so `run_all` left their `pass`
undefined since CYCLE-048/049 — two validation suites were reported but **not gated**. They now return it,
and the suite reads **35 gated** (was 32).

---

## F-67 — The forecast scoring layer (Brier / Murphy / Diebold-Mariano / MCS): exact against the repo's own second Murphy implementation, plus a false decomposition claim, a count-only alignment guard, and a benchmark-grouping branch that contradicts its own reader. [SUPPORTED — validation + audit; CYCLE-051]

**Experiment:** `e59_forecast_audit.js` (33/33 checks, 5.0 s). **Artefact:**
`results/e59_forecast_audit.json`. **Leads:** L10 (new L10-ba…L10-bf). `analysis/forecast.js` is
**shipped**: `analyze.js` imports `forecastComparison`/`formatForecast` and runs the block on by default
(`--forecast=0` disables), so unlike the F-64/65/66 rows its output reaches a run report. It scores the
family as *forecasters* — the Brier score and the Murphy (1973) reliability/resolution/uncertainty
partition, the log score, the Diebold-Mariano (1995) test on block-bootstrapped per-bar Brier-loss
differentials, and the Hansen-Lunde-Nason (2011) Model Confidence Set — and it consumes
`reality_check.js#stationaryBlockIndices` (audited in F-66).

**The scoring arithmetic is exact (validated).** `forecastPairs` maps the journaled confidence through
**exactly** the inverse of `confidenceFromProb(prob) = clamp(prob,0,100)/50 − 1` (i.e. `(c+1)/2` recovers
`prob/100` to 1e−12 for `prob ∈ {0,1,25,50,75,99,100}`), predicts the **next** bar's sign, drops each
fold's last bar, and skips non-finite/absent pairs (`null` confidence, a NaN return, a missing
`confidence`, a `null` fold list). `brierBinIndex` is the closed form with the top edge closed and the
out-of-range clamp; `brierScore` is the exact mean squared error (empty → NaN, NaN pairs skipped);
`logScore` is the exact mean negative log-likelihood with the documented `eps` clip (a confidently-wrong
bar is penalised finitely, and a correct `p = 1`/`p = 0` bar costs ~0, not 34.5). The Murphy partition
satisfies `brierBinned = REL − RES + UNC` to 1e−17 (identity residual), `Σ n_k = bars`, and the crafted
two-bin case and the degenerate `bins = 1` / `bins > N` cases are exact.

**The repo contains TWO Murphy implementations and they agree (validated).** `observer/legion_metrics.js`
has a second, independent `brierDecomposition(outcomes, probs, bins)` (used by the collector). On a grid of
6 datasets × bin counts their `reliability`, `resolution`, `uncertainty` and `brier` agree to **1e−12**,
and observer's explicit `within` equals forecast's raw-minus-binned gap to **1e−17**. So the decomposition
is cross-checked against a reference inside the repo, not only against my own algebra.

**The false decomposition claim (L10-ba).** `forecast.js`'s comment says the raw-minus-binned gap *"is the
within-bin **forecast** variance that merging into a bin discards"*. That is false. The exact identity —
which `observer/legion_metrics.js` states and computes — is
`gap = WITHIN = Σ_k w_k [ mean_k(p − p̄_k)² − 2 mean_k((p − p̄_k)(o − ō_k)) ] = withinVar − 2·withinCov`;
my independent recomputation matches it to 1e−12 on every config. The covariance term is **not** negligible:
on 5 of the 6 audited configs the gap is **negative** while `withinVar` is positive (e.g. T=64, bins=1:
gap **−0.0531** vs withinVar **+0.0774**; T=200, bins=5: gap **−0.00449** vs withinVar **+0.00321**), and
the claimed value is wrong by up to **0.13**. The module still reports the *correct* fields
(`brier`, `brierBinned`, and a zero `identityResidual`), so the defect is the **docstring's stated
identity**, in the same family as F-66's `arch` claim.

**The alignment guard is count-only (L10-bb).** `forecastComparison` refuses only when
`pairs.bars !== base.bars` — a COUNT — while its own comment says *"alignment is the whole point of a
paired test; refuse rather than silently compare mismatched windows"*. `forecastPairs` drops each fold's
non-finite bars, so two variants that drop the **same number** of bars at **different positions** pass the
guard and are then paired **index-wise**, comparing non-corresponding bars. On 6 crafted witnesses (two
confidence series with a NaN at different bars) the guard accepted every one and the DM verdict **flipped
in 6/6** relative to the correctly bar-aligned comparison (sign of the differential and/or the 0.05
significance decision). Reachable in principle when a variant's confidence has a non-finite bar (a
warmup/degenerate bar, a NaN `predictProb`) at a different position than another variant's.

**The benchmark-grouping branch contradicts its own reader (L10-bd)** — and it is a dead branch in
production. `groupOf(kind) = kind === 'benchmark' ? (baselineKind === 'signal' ? 'signal' : 'controller') : kind`
maps a benchmark to the **baseline's** kind, but the module's `reader` and `docs/LOCKED.md` both say a
benchmark journals a calibrated probability and therefore shares the **controller** family's calibration
group. With `baselineKind = 'signal'` a benchmark is grouped with the **signal** (z-score) family and
receives a DM test against it (`dm.available = true`), while a genuine controller candidate is refused as
cross-kind — the exact mismatch R27-5 exists to prevent. It is unreachable from `analyze.js` (which always
places the `id:'baseline'` controller variant at index 0, and `forecastKindOf` is `'controller'` for it),
and the §AI test only exercises `baselineKind = 'controller'`, so a blemish in the exported API goes
unseen (cf. L10-ay's dead arm).

**The MCS elimination denominator deviates from HLN but is empirically inert (L10-be).** The range
statistic `T_R = max |dbar_ij| / se_ij` is HLN's, but the elimination score standardises
`L_i − mean_others` by `sd(L_i)` where Hansen-Lunde-Nason's `t_i` uses `sd(d_i)` with
`d_i = L_i − mean_others`: on 150 heteroskedastic K=4 configs the two denominators differ by up to
**77×**, yet the surviving set and the elimination **order** were identical in **150/150**. So the
deviation is real on paper and does not change any observed outcome (a documented-vs-paper gap, not a
reproducible defect).

**Unvalidated inputs (L10-bc).** The exported `bootstrapMeans(series, …)` documents "one array per model,
all the same length" but does not check it: unequal lengths leave `available:true`, take `T` from
`series[0]`, and produce **NaN** in the replicates that touch the short series (3 of 8 in the witness).
`modelConfidenceSet` *does* validate equal lengths (refuses), but neither it nor `bootstrapMeans` filters a
NaN **inside** a series: a loss series containing a NaN leaves the MCS `available:true` with an arbitrary
survivor. The shipped path is safe (`forecastPairs` drops non-finite pairs before the losses are built and
every variant's pair list is finite), so both are latent, export-level gaps.

**Independent calibration (the F-57/F-62 discipline).** On my own seeds the DM test is nominal under an
i.i.d. null (**0.0525 / 0.1075** rejection at 5 % / 10 % over 400 realisations; the p-value median is
0.497), the block bootstrap controls size where `blockLength = 1` does not (φ = 0.5: **0.095** at the
default block vs **0.135** i.i.d.), the MCS **always contains the sample-best** (4 ensembles × 200 runs),
and its coverage is near nominal (K=3 α=0.10 **0.880**, persistent **0.855**, K=4 α=0.10 **0.865**,
α=0.05 **0.925** — the lower edge of the 2.5-SE band, so a mildly liberal small-sample MCS, not a
miscalibrated one). An earlier 0.82 coverage reading in probe work was Monte-Carlo noise: at R=200 the
band is ±0.053.

**What is now false.**
* **"The raw-minus-binned Brier gap is the within-bin forecast variance."** The exact identity is
  `gap = withinVar − 2·withinCov` (the repo's own `observer/legion_metrics.js` says so); the gap is
  negative on 5/6 configs and wrong by up to 0.13.
* **"`forecastComparison` refuses a mismatched window rather than comparing unpaired."** It compares the
  bar **counts**; a count-coincident misalignment is accepted and flipped the DM verdict in 6/6 witnesses.
* **"A benchmark arm joins the controller in the calibration MCS group."** Only when `baselineKind` is not
  `'signal'`; with a signal baseline the branch puts the probability-calibrated benchmark in the z-score
  group (unreachable from `analyze.js`, reachable through the API, untested).
* **"The MCS elimination statistic is HLN's."** The range statistic is; the elimination denominator is
  `sd(L_i)`, not HLN's `sd(d_i)` (up to 77× apart, empirically inert).

## F-68 — The successive-halving racing engine: exact against its own closed forms, but its "a racing budget does not change the decided set" requirement is a tautology on the test fixture, and the race can cost more than the grid it replaces. [SUPPORTED — validation + audit; CYCLE-052]

**Experiment:** `e60_race_audit.js` (18/18 checks, 27 ms). **Artefact:** `results/e60_race_audit.json`.
**Leads:** L10 (new L10-bg…L10-bk). `analysis/race.js` is **engine-only**: no shipped module imports it
(only `analysis.test.js` §AM and `locks.test.js`'s export pin), and the `analyze` driver deliberately
exposes no `--race` flag (the R26-15 gate is closed — `RUN-ANALYSIS.md` §7 measured neither an economics
nor a diversity win). Its docstring and `docs/LOCKED.md` nonetheless make a strong *correctness* claim —
*"a racing budget must not change the decided set"*, validated against a full-grid oracle — and that claim
is cheap to test while the gate is shut.

**The closed forms and the engine contracts are exact (validated).** `halvingRounds` is exactly
`max(1, floor(log(maxBudget/minBudget)/log(eta)) + 1)` (`(9,1,3)→3`, `(9,1,2)→4`, `(27,1,3)→4`,
`(3,1,3)→2`, `(2,1,3)→1`, `(9,9,3)→1`) and returns 0 on its guards (`eta ≤ 1`, `minBudget > maxBudget`,
non-numeric, `{}`). `halvingSchedule`'s `keep = max(1, ceil(survivors/eta))` holds at every rung on five
grids (incl. 100 arms / budget 27), the first rung is full width, the budgets are monotone
(`roundsUsed ≤ halvingRounds`), the top rung reaches exactly `maxBudget` when every round runs
(`(9,9,2)→[1,2,5,9]`, `(100,27,3)→[1,3,9,27]`), and the schedule stops early once one arm remains
(`(9,9,3)→[1,3]`). `successiveHalving` scores the full rung in arm order, takes the top `keep` as
`survivors`, the finite arms beyond as `lost` (`lost ∩ survivors = ∅`), eliminates a non-finite evaluation
into `nonFinite` (never ranked), selects the **lowest** score under `maximize:false` (winner `a8`), is
byte-identical under a sync or an async evaluator, is deterministic with stable arm-order ties, reconstructs
its cost counters (`evaluated`, `spentBudget`, `survivorEvaluations`, `gridBudget = n·round(maxBudget)`) on
six grids, refuses a bad `arms`/`evaluate`/`maxBudget` (`available:false` + reason), and `formatRace`
renders the fixture string, `null` and an unavailable block.

**The stated correctness requirement does not hold (L10-bg).** `docs/LOCKED.md` says the race is
*"validated against the brute-force full-grid oracle (the race winner equals the grid winner, so a racing
budget does not change the decided set)"*. But the §AM fixture is
`evaluate(arm, budget) = arm.q + (arm.q > 0 ? 0.05 : −0.05)/budget` — a rule whose **ranking is identical at
every budget** (`rank(1) == rank(9)`), so the agreement is a **tautology**; and the fixture's schedule is
`[1, 3]`, i.e. the race's top rung is **3** while the "oracle" is evaluated at **9**, a budget the race
never visits. With a budget-dependent evaluator (the SHA premise: the cheap rung is a noisy estimate) the
race eliminates the arm that is best at the full budget — eight `early` arms strong at 1 / weak at 9 and one
`late` arm mediocre at 1 / best at 9 yields rung-0 `lost ∋ late` and returns `early0` while the top-budget
oracle returns `late`. Over seeded ensembles (`q + N(0,1)·2/sqrt(budget)`, K=16, 120 reps) the race
disagrees with the top-budget argmax on **0.617** (η=3, B=27), **0.617** (η=3, B=9), **0.700** (η=3, B=3)
and **0.625** (η=2, B=16). That is the known character of successive halving (a best-arm-identification
*heuristic*, not an exact selector) — but the module claims the opposite as a validated requirement and the
test that enforces it cannot fail.

**The race can cost MORE than the grid it replaces (L10-bh).** `spentBudget = Σ_r budget_r·scored_r` vs
`gridBudget = n·round(maxBudget)`: the module's framing (*"the search cost is `O(arms)` at the cheapest rung
instead of `O(arms)` at the full budget"*) and the repo test's `spentBudget < gridBudget` identity hold only
when the budget ratio is large — `0.222` for the fixture `(9,9,3)`, but **1.000** for `(16,2,2)` and
`(100,2,2)`, **1.056** for `(9,2,2)`, **1.222** for `(9,3,2)` and **2.890** for `(100,10,1.1)`. When
`maxBudget/minBudget` is small relative to the round count the early full-width rungs dominate and the race
is more expensive than the grid; the repo test sits in the one regime where the saving is large.

**Small `eta` collapses consecutive rungs to one integer budget (L10-bi).** `halvingSchedule` multiplies an
unrounded budget by `eta` but stores/evaluates `Math.round(budget)`, so for a small `eta` (or budget)
several consecutive rungs round to the **same** integer and re-score the survivors at the same budget — the
"budget `eta` times larger" reallocation never happens. At `eta = 1.1`, 100 arms, `maxBudget = 10` the
schedule `[1,1,1,1,1,2,2,2,2,2,3,3,3,4,4,4,5,5,6,6,7,8,8,9,10]` has **15** repeated consecutive budgets
across **25** rungs and a cost ratio of **2.890**; `eta = 1.2` has 4 repeats (1.520), while `eta ≥ 1.5` has
none (0.79 / 0.55).

**`eta` and `minBudget` are not validated (L10-bj).** `halvingRounds` guards them, but `successiveHalving`
does not check its own: for `eta = 1`, `eta = 0.5`, `eta = 0` and `minBudget > maxBudget` the schedule is
empty, **no arm is evaluated**, and the result is `available: true` with `winner: null` / `winnerId: null`
— a silent degenerate success rather than `available:false`. The module *does* refuse `arms`, `evaluate`
and `maxBudget`, so the omission is inconsistent with its own contract (cf. L10-ay's dead arm).

**Scope (L10-bk).** No shipped module imports `race.js`; the audit is engine-only / test-only, so every row
above is latent — but the *claim* that would license turning the `--race` gate on is the one that fails.

**What is now false.**
* **"The race winner equals the full-grid oracle — a racing budget does not change the decided set."** True
  only where the evaluator's ranking is budget-independent (the §AM fixture) and the race's top rung is
  `maxBudget`; on a budget-dependent evaluator the race discards the top-budget best on **0.62–0.70** of
  seeded fixtures, and the fixture's own top rung (3) is below its oracle's budget (9).
* **"The race spends less budget than a full grid."** `spentBudget > gridBudget` whenever the budget ratio
  is small relative to the round count (up to **2.89×**).
* **"Only the top `1/eta` survive to a budget `eta` times larger."** For a small `eta` the integer rounding
  leaves consecutive rungs at the same budget (15 of 25 rungs at `eta = 1.1`).
* **"The engine refuses an invalid configuration."** It refuses a bad `maxBudget`/`arms`/`evaluate` but not
  an invalid `eta`/`minBudget`, returning `available:true` with a `null` winner and zero evaluations.

## F-69 — The P1 model-class benchmark: the ridge arm's probability is anchored at 0.5 (its training base rate is computed, stored, and never restored), and the sigmoid band caps the arm's skill. [SUPPORTED — validation + audit; CYCLE-053]

**Experiment:** `e61_benchmark_audit.js` (12/12 checks, 67 ms). **Artefact:** `results/e61_benchmark_audit.json`.
**Leads:** L10 (new L10-bl…L10-bo). `analysis/benchmark.js` is the **shipped** P1 model-class benchmark
(round 29 → 30): base rate / ridge (closed form) / one-hidden-layer tanh MLP (seeded SGD) / a pluggable
pretrained-TSFM arm, each a `{fit(X,y), predictProb(x)}` forecaster over the **same causal `featureVector`**
the bare path reads. The arms are opt-in (`--variants=bench-base-rate,bench-linear,bench-mlp`, never in the
default roster), but a benchmark run reaches RUN-ANALYSIS §16.2 and the **ridge arm is the MCS survivor and
the best of the set**, so its probability output is load-bearing for P1's "negative branch" (G-A).

**The documented contracts hold (validated).** `fitStandardiser`/`applyStandardiser` are exact
(zero-mean/unit-std on the fit fold; a collapsed constant column reads `std = 1e-8`, `z = 0`; empty input →
`d = 0`). `fitRidge`'s closed form matches an **independently solved** centred ridge (the same normal
equations, solved in the audit) to **0**; the intercept is unpenalised (`lambda = 0` vs `1e6` leave the
intercept column untouched); `predictRidge` stays in `(0,1)`; the `standardise:false` path is finite.
`fitBaseRate` is the training prior and defaults to 0.5 on empty input. The ridge and MLP both learn a
separable rule (> 0.8 accuracy), the MLP is byte-deterministic under a seed, `BENCHMARK_KINDS` is
`base-rate,linear,mlp,tsfm`, the factory refuses `tsfm` (no bundled checkpoint) and an unknown kind, and a
perfect classifier beats the base rate on Brier (0.1425 vs 0.2500).

**The training base rate is computed and then discarded (L10-bl) — the headline, and it is SHIPPED.** `fitRidge`
computes `ybar` (the training outcome frequency), *uses it to centre the target* (`yc = y − ybar`), returns it
as a field — and **`predictRidge` never reads it**: the shipped probability is `sigmoid(z·w + c)`, the
**centred** linear predictor, anchored at `sigmoid(0) = 0.5` whatever the prior. A constant-`y = 1` fold reads
exactly **0.5000** for every input (the intercept the fit solved is 0, because the centred target and the
standardised feature columns both have mean 0); a fold with a **0.833** base rate reads a mean prediction of
**0.5000** and Brier **0.22475**, vs **0.13533** with the module's own `ybar` restored (an uncentred intercept
fit gives the same 0.13533, confirming the identity). The consequence is a mis-specified output map, not a
rounding wart: the arm cannot represent a base rate far from 0.5, and the repo's per-arm `brierSkill =
1 − Brier/p̄(1−p̄)` is computed from that probability. The shipped §P1 test checks **accuracy** (a 0.5
threshold, invariant to the offset) and so cannot fail — the F-68 "a test that cannot fail" lesson, now on a
shipped arm.

**The sigmoid is applied to a bounded least-squares fit (L10-bm).** `predictRidge` sigmoids a least-squares
fit of a 0/1 label, whose fitted value lies in `[min y, max y]` (centred: `[−ybar, 1−ybar]`), so the output is
confined to `sigmoid([−1,1]) ≈ [0.27, 0.73]` (at `ybar = 0.5`: `[0.378, 0.622]`) — the arm **cannot express
confidence**: a perfectly separable feature reads Brier **0.1425** (the arm's floor), not ~0, while the MLP arm
(which fits its output bias on the raw label through the same sigmoid) reaches **0.99** on a constant-`y` fold.
So the two arms are not the same kind of probability model, and "no model class has material positive Brier
skill" is, for the ridge, partly a statement about a bounded output map rather than about the model class.

**The "ridge closed form vs a hand solve" claim is unverified (L10-bn).** `docs/LOCKED.md` and
`test/lock-registry.js` both claim the P1 tests prove "the ridge closed form matches a hand-computed solve"; the
shipped `analysis.test.js` P1 block asserts only ridge/MLP accuracy > 0.8, MLP determinism, a zero-mean
standardiser round-trip, the factory kinds and the benchmark MCS grouping — **there is no hand solve**. The
closed form itself **is** exact (the audit matches it to 0), so the claim is true but untested, and all five
shipped checks would pass on a ridge with an arbitrary output map (L10-bl is exactly such a map). The L10-ag
lesson: a test-ledger claim is itself a claim.

**The eps constant-column fallback amplifies a train→test deviation (L10-bo, latent).** A column constant on
the fit fold gets `std = sqrt(0) + eps = 1e-8`, so the fallback avoids a division by zero but not the blow-up:
a test-fold value **one unit** away maps to `z = 1e8`. Latent (a feature constant over a 60-bar training fold
is plausible) and untested.

**Scope.** SHIPPED arms (opt-in, but a benchmark run reaches §16.2; the ridge is the MCS survivor), so
L10-bl/bm move a forecast **arm's probability readout**, not the goldens; `tsfm` is unreachable by design;
L10-bo is latent. No fold-back row.

**What is now false.**
* **"`predictRidge` returns the ridge regression's probability."** It returns `sigmoid(centred linear
  predictor)`; the `ybar` the fit computed is never restored (constant-y → 0.5; 0.833-base-rate → mean 0.50,
  Brier 0.2248 vs 0.1353).
* **"The bench-linear and bench-mlp arms are comparable probability models."** The linear arm's output is
  confined to `sigmoid([−1,1])` (Brier floor ≈0.14 on a perfect problem); the MLP reaches 0.99 on a
  constant-y fold.
* **"The P1 test proves the ridge closed form against a hand-computed solve."** No shipped test performs a
  hand solve.
* **"A constant column is handled safely by the eps fallback."** It collapses to 0 on the fit fold, but a
  one-unit test-fold deviation becomes `z = 1e8`.

---

## F-70 — The measurement layer: `hitRate`'s documented exclusion is unimplementable (its implemented one counts exit-cost bars as misses), the fold scorer re-lags the signal inside the test slice, and the instrument is exact to its documented bounds. [SUPPORTED — validation + audit; CYCLE-054]

`analysis/performance.js` is the lab's significance instrument and `analysis/backtest.js` is the layer that
feeds it: `walkforward.js` and `analyze.js` build their pooled reports on `purgedCVBacktest`/`poolFolds`/
`backtestMetrics`, and `performance.js` is imported by `backtest`/`walkforward`/`forecast`/`decision`/
`reality_check`/`overfitting`/`replication`/`streams`. `experiments/e62_backtest_audit.js` (registered;
**70 steps, 39 gated, 0 fails**; 4.13 s; **26 checks, all pass**) validates both halves against independent
references and registers three rows.

**The instrument is exact to its documented bounds (validated).** `erf`'s max abs error vs an independent
**Simpson quadrature** is **1.393e-7** (inside A&S 7.1.26's 1.5e-7) and `normalCdf(0) = 0.5` exactly with
`Phi(−x) + Phi(x) = 1` exactly; `normalInvCdf` round-trips within **2.46e-10** against a **Lentz-erfc**
reference (inside Acklam's 1.15e-9) and is antisymmetric to 2.8e-14; the population moment conventions are
exact (`kurtosis([1..5]) = 1.7`, `skewness = 0`, `stdSample = √2.5`, `stdPopulation = √2`); the Lo (2002)
Sharpe SE is `√(1.5/99)` at SR = 1, n = 100; PSR is **exactly 0.5** at its own benchmark and matches an
independent z to 5e-7; DSR equals PSR at the expected-max hurdle to **1e-15** and DSR ≤ PSR;
`expectedMaxSharpe` reproduces an independent inverse-CDF evaluation (5.1e-11), rises with trials and is
exactly ∝ √V; MinTRL(SR = 0.5, 95 %) = **13.1749455166** against the documented vector 13.174945 and an
independent recompute; and the stationary bootstrap is size-calibrated on **1000** i.i.d. noise series
(**5.9 %** at 5 %, **11.0 %** at 10 %, mean p **0.502** — the repo's 5.8 % claim with se 0.0074), deterministic
per seed.

**The backtest arithmetic is exact (validated).** Positions lag one bar; turnover counts the initial entry;
`strategyReturns`' cost sum is `turnover × fee` and every `net = gross − |Δpos|·fee` recomputes to 1e-15;
`equityCurve([0.1,−0.2,0.05]) = [1, 1.1, 0.88, 0.924]`; `maxDrawdown` = 0.5 / 0.19 / 0 on the shipped, two-loss
and all-up vectors; `tradeCount` counts transitions; `backtestMetrics` satisfies the break-even identity
(`1e4·grossPnl/turnover`), `totalCost = turnover·fee` and the recomputed participation fields; `poolFolds`
restates turnover/cost/tradeCount as the per-fold sums and equals a directly-called `poolFolds`;
`purgedCVBacktestAsync` (concurrency 4) is **byte-identical** to the serial path.

**`hitRate`'s exclusion is not the documented one, and it counts exit costs as misses (L10-bq).**
`hitRate(strategyReturnSeries)` receives only a return series, so the docstring's "bars with no position are
excluded" is a criterion the signature cannot express; the code does `if (r === 0) continue`. Witnesses:
positions `[1,1,1,1]` with returns `[0.01, 0, −0.01, 0.02]` read **0.6667** where the documented rule gives
**0.5** (the zero-return in-market bar is dropped); and because `backtestMetrics` passes the **net** series, a
perfectly-timed strategy at 3 round trips and 10 bps reads **0.5000** where the documented rule gives **1.0000**
— each flat bar reached by an exit carries `net = −fee < 0` and is counted as a **miss**, so the reported hit
rate moves with the cost level and the turnover. `poolFolds.pooledMetrics.hitRate` is the same call on the
pooled net stream via an all-long overlay, so it knows neither. The shipped check uses a vector whose flat bars
*are* its zero-return bars, so it cannot discriminate (the F-68 class).

**The fold scorer re-lags the signal inside the test slice (L10-br).** `scoreFold` passes the fold's signals to
`strategyReturns` with `positions = null`, so `pos[j] = subSignals[j−1]` and `pos[0] = 0`. Defensible for the
per-fold-**fitted** path (the interface supplies signals for the test bars only), but for the supported
**fixed-global-series** path (`signals:`; `walkforward.js`'s "fixed signal evaluated with purged K-fold") the
module's own rule — "positions are the signals shifted by one bar" — is not used: bar 20 of a contiguous fold
reads **0** where the global position is +1, and on a non-contiguous **CPCV** fold the position at bar 30 is
**signals[12] = +1** instead of **signals[29] = −1** (pooled **+0.05** vs **−0.05** — a 0.10 return error on
one bar). On a 4-fold purged K-fold of 64 bars the pooled series differs from the global reference on **3/64**
bars. LATENT (production uses `signalForFold`).

**The probe's negative-MinTRL lead is disproved; the residual is a NaN mislabel (L10-bp).** A probe found
`minimumTrackRecordLength({sharpe:1, skew:3, kurtosis:3}) = −3.058` while its siblings returned NaN. But that
triple violates **Pearson's inequality** (`kurtosis ≥ skewness² + 1`; here 3 < 10), and writing the estimator
out gives `v = 1 − g₁·SR + ((g₄−1)/4)SR² ≥ (1 − g₁·SR/2)² ≥ 0` — so **v ≥ 0 for every measurable moment
triple** and MinTRL ≥ 1. Measured: a deterministic search over **60 000** moment-realizable histograms bottoms
out at `v = −2.4e-15` (floating-point zero) with `pearsonSlack = −4.4e-16`, attained exactly by two-point
supports; **20 000** random series violate none of the three bounds (min v = 0.127); MinTRL from measured
moments over 4 000 series never falls below **2.17**. The lead is **closed as false**. The real (latent)
residual is the guard's other side: `!(sharpe > benchmarkSR)` catches **NaN**, so
`minimumTrackRecordLength({sharpe: NaN})` returns **Infinity** and `backtestMetrics` on a **1-bar** fold reports
`minTrackRecordLengthStatus: "beyond-horizon"` for an incomputable Sharpe, where the status maker's
`"unavailable"` is the correct label.

**Scope.** `backtest.js` (walkforward + analyze reports) and `performance.js` (imported by eight `analysis/`
modules) are both shipped measurement code; no finding can move a golden — neither is imported by the locked
hot path (`src/hivemind/`, `src/legion/runner.js`). L10-bq/bp are report readouts, L10-br is latent. No
fold-back row.

**What is now false.**
* **"`hitRate` reports the fraction of in-market bars that were positive."** It reports the fraction of
  non-zero-return bars that were positive — it never receives positions — and an exit-cost bar counts as a
  loss (a perfect in-market record reads 0.5 at 3 round trips / 10 bps).
* **"`purgedCVBacktest` applies the fixed signal series inside every fold's test slice."** It re-shifts the
  slice: the first bar of every fold is flat, and a CPCV run boundary holds the previous *test* bar's signal.
* **"`minimumTrackRecordLength` can return a negative length."** It cannot: Pearson forces
  `v ≥ (1 − skew·SR/2)² ≥ 0`, so MinTRL ≥ 1 for any measurable triple.
* **"A NaN MinTRL reports as `beyond-horizon` only when the Sharpe is genuinely below its benchmark."** A NaN
  *sharpe* produces Infinity and is labelled `beyond-horizon`; `unavailable` is the correct state.

---

## F-71 — The causal signal family: the zero-dispersion guard is defeated by floating-point rounding, an empty window reads 0 from `finiteSum` but NaN from `meanOf`, and two features silently mis-scale. [SUPPORTED — validation + audit; CYCLE-055]

`analysis/features.js` is the causal signal family: it turns a panel of prices/returns/volumes into the
position each arm would hold at bar `t`, and every strategy the project has evaluated is a weighted combination
of the 16 candidates it exports (`SIGNAL_CANDIDATES` × 8, `REVERSAL_CANDIDATES` × 4, `SIGUP_CANDIDATES` × 4).
`experiments/e63_features_audit.js` (registered; **71 steps, 40 gated, 0 fails**; 70 ms; **11 checks, all
pass**) audits it by synthetic ground truth and registers four rows. The module's two headline promises — it is
causal, and it abstains instead of throwing — both hold exactly; the defects are all latent/export-level.

**The causality contract holds exactly, for every candidate (validated).** For all **16** candidates and every
test bar `t`, perturbing closes, returns, volumes and every panel stream **strictly after `t`** leaves
`positionAt(candidate, series, t)` bit-unchanged (**0 mismatches over 16 × 100 bars**), and the test is
non-vacuous (every candidate is non-zero on all 100 bars; the perturbation moves 77–79 of the 79 later bars).

**The abstain contract holds, and the `closes` contract settles L10-e (validated).** A returns-only view
abstains (reads 0) on exactly the five channel-dependent candidates — `sig-frac-momentum, sig-range,
sig-volume, sig-reversal-xs, sig-network-momentum`; short/empty/`null` series read 0 for all 16; all-NaN,
all-zero and Infinity series stay finite and in [−1, 1]. **L10-e is SETTLED**: a `{close}` (singular) series
gives `rangeLocation` **NaN** and `positionAt` **0** while `{closes}` gives `rangeLocation = 0.0211625225` — the
plural field is load-bearing and the singular is a genuine abstain (a confirmed contract, not a defect).
`clampPosition` is exact and all **13** single-feature references are exact to 1e-12 (`momentum, fracDiffAt,
fracMomentum, volRegime, momentumAgreement, rangeLocation, volumeImbalance, autocorr1, acceleration, reversal,
reversalWindow, reversalVol, volScaledMomentum, blendedMomentum`), with `fracDiffAt` also equal to the shipped
`labels.js#fractionalDiff(log closes, 0.4, 16)` convolution; the cross-section and the regime gate match their
independent recomputes exactly.

**The zero-dispersion guard is defeated by floating-point rounding (L10-bs).** `causalZScore` returns
`(raw − m)/std` with `m`/`std` over the trailing finite values, guarded by `if (!(std > 0)) return 0` — the
header and docstring both promise **0 while `std` is 0**. For an exactly-constant window the sample mean is
**not bit-equal** to the value `v`, so every deviation is the same `d = m − v ≠ 0`, giving
`std = |d|·sqrt(n/(n−1))` — a **denormal positive** number the guard cannot reject — and
`z = (v − m)/std = −sign(d)·sqrt((n−1)/n)`, i.e. **`|z| = sqrt((n−1)/n)`**:

| constant | window n | `std > 0`? | returned z | closed form |
| --- | --- | --- | --- | --- |
| 0.001 | 8 | fires | **0** | — |
| 0.001 | 16 | no | **−0.9682458366** | −√(15/16) |
| 0.001 | 32 | fires | **0** | — |
| 0.1 | 32 | no | **−0.9842509843** | −√(31/32) |
| 0.07 | 20 | no | **−0.9746794345** | −√(19/20) |

At the default saturation 2 that spurious `|z| = 0.935…0.984` is a position of **0.468 … 0.492** — nearly a
half-size book — from a feature carrying **no information** (the intended value is exactly 0, the largest
possible error on this branch). It is a **rounding-boundary** effect, not a universally-firing branch: where the
sum/quotient happens to be exact (n = 8, n = 32 on a 0.001 constant; the 0.03125 fixture) the guard *does* fire
and returns 0, so the shipped 0.03125 test passes and gives no warning. Real-valued features (frac-momentum,
range location, vol-regime, volume imbalance, autocorrelation, and the recomputed momentum of a bit-constant
return series) can trip it; discrete `momentumAgreement` cannot (its mean is exact). LATENT for live data, but
**reachable on the flat/constant series this project uses as CONTROLS**, and in production through a
coarse/rounded feed (the L10-l class: `round(price*100)` gave 67 distinct values over 3621 bars). The check
pins the *actual* arithmetic as the identity and leaves the "why it's wrong" to this row (the e62 method).

**An empty window reads 0 from `finiteSum`, NaN from `meanOf` (L10-bt).** `finiteSum` guards `a < 0` but not
`b < a`, so an empty range sums to **0** while `meanOf` guards `b < a` and returns **NaN**:
`momentum(…, {window: 0})` and `acceleration(…, {window: 0})` read **0**, while `volRegime(…, {window:0,long:0})`,
`reversalWindow(…, {window:0})`, `volumeImbalance(…, {window:0})` and a direct `meanOf` read **NaN**. LATENT
(every shipped candidate fixes `window ≥ 1`), but 0 is a **finite, plausible** reading ("no momentum") so it
flows through `causalZScore` as a real observation instead of abstaining — the opposite of the module header's
abstain discipline, and an inconsistency between two helpers in the same file.

**`networkMomentum` folds the stream's own momentum into the "network" average (L10-bu).** The skip is
`if (i === p.streamIndex) continue`; with `panel.streamIndex` absent (`undefined`) the comparison never matches,
so the feature silently includes the stream's own lagged momentum: `networkMomentum` = **−0.9066812992**
(others-only, the shipped `streamIndex: 1` path) vs **−1.8820447956** (all three incl. self, no `streamIndex`)
— the stream's own lagged momentum is −3.8327717886. LATENT (`analyze.js` always sets `streamIndex`) and
**silent** (a plausible number, not a NaN).

**`regimeGatedMomentum`'s gate is scaled by the wrong window (L10-bv).** The gate compares
`sum(returns, gateWindow)` against `−gateZ·sqrt(v_window)·sqrt(gateWindow)` where `v_window` is the **momentum**
window's variance, not the gate window's, so the threshold is mis-scaled by `sqrt(v_window/v_gateWindow)`. With
the shipped windows (16 vs 32): `varianceUsed = 5.080932663e-5`, `varianceOfGateWindow = 6.651902004e-5`,
ratio **1.309189168**, `thresholdUsed = −0.0806448623` vs `thresholdIfGateWindowScaled = −0.0922736938`. In a
hot short-term regime (`vGate > vMomentum`) the crash gate is too **loose** — it fires less often than the
documented "−`gateZ` standard deviations of its own causal vol estimate". LATENT and opt-in (`SIGUP_CANDIDATES`,
gate G-H); invisible when the two windows coincide. A behavioural, not cosmetic, difference: the feature is
pre-registered as a causal crash gate.

**Scope.** `features.js` is shipped signal code (imported by
`analyze`/`walkforward`/`decision`/`forecast`/`backtest`), but no finding can move a golden — all four are
latent (a degenerate window, a missing `streamIndex`, or the opt-in `SIGUP_CANDIDATES`). The causality contract
and all arithmetic the shipped path executes are validated exact. No fold-back row.

**What is now false.**
* **"`causalZScore` abstains when the window has no dispersion."** It abstains only when the computed `std`
  is not `> 0`; an exactly-constant window leaves `std` a denormal positive, so the guard cannot fire and the
  feature reads `|z| = sqrt((n−1)/n)` (a ~0.47–0.49 position at saturation 2) instead of 0. The shipped 0.03125
  test passes because that particular arithmetic is exact.
* **"A feature that cannot be computed abstains."** `finiteSum` on an empty range returns **0**, not NaN —
  momentum and acceleration read a finite, plausible 0 for a 0-width window while the `meanOf`-based features
  abstain.
* **"`networkMomentum` excludes this stream from the network average."** It excludes it only when
  `panel.streamIndex` is set; with it `undefined` the stream's own lagged momentum is folded in silently.
* **"The `-gateZ` crash gate is −`gateZ` standard deviations of the gate window's own vol."** The threshold is
  scaled by the **momentum** window's variance; when the two windows differ (shipped: 16 vs 32) the gate is
  mis-scaled by 1.309 and fires too rarely in a hot short-term regime.

---

## F-72 — Sample uniqueness: the sequential bootstrap's draw weight is the uniqueness *sum*, not the average (so it is length-biased), and the module does not implement the AFML ch.4 bootstrap it cites. [SUPPORTED — validation + audit; CYCLE-056]

`analysis/uniqueness.js` is the reference implementation of López de Prado ch.4 sample uniqueness — the
per-observation **average uniqueness**, the **effective sample size** (sum of uniqueness) and a **sequential
bootstrap**. It is not on the shipped path (`analysis/` may not be imported by the hot path); the shipped
uniqueness weighting is a re-implementation in `hivemind/training/sample_weights.js#overlapUniqueness`, which
the repo cross-checks against this module. `experiments/e64_uniqueness_audit.js` (registered; **72 steps, 41
gated, 0 fails**; 82 ms; **8 checks, all pass**) audits it against independent references and registers three
rows.

**The average uniqueness is exact, and the shipped re-implementation agrees bit-for-bit (validated).**
`sampleUniqueness` reproduces an **independent recompute** (a per-bar scan-all-spans count — a different data
structure from the module's typed-array concurrency) to 1e-12 on the documented fixtures and seeded random
spans: `[[0,2],[1,3]]` → **2/3, 2/3**; `[[0,0],[0,5]]` → **1/2, 11/12**. It is per-label **order-invariant**,
and matches the shipped `overlapUniqueness` to **exactly 0** across 8 fixtures. The ESS identities hold:
point labels → **n**; `ESS = sum of uniqueness`; `averageUniqueness = ESS/n`; `ESS ≤ n` (6 overlapping labels
read **5.5833**); empty → `[]`/`NaN`/`0`.

**The sequential bootstrap's draw weight is the uniqueness sum, not the average (L10-bx).** `sequentialBootstrap`
stores `avgU[i] = acc` — the **sum** of `1/concurrency` over the span — while the comment calls it the "running
**average** uniqueness" and the ch.4 weight **is** the average (`acc/(e−s+1)`), which the module itself
computes one function above. Since sum = average × span length, the draw is biased toward long labels:

| fixture (non-overlapping) | average uniqueness | sum | first-draw P(long) |
| --- | --- | --- | --- |
| `[0,0]` (1 bar) vs `[1,3]` (3 bars) | **1.0, 1.0** | 1, **3** | measured **0.7480** (module law **0.7500**) vs intended **0.5000** |
| `[0,0]`,`[1,2]`,`[3,5]` (lengths 1,2,3) | 1.0, 1.0, 1.0 | 1, 2, 3 | measured **0.1688 / 0.3299 / 0.5014** vs intended **1/3 each** |

Two **non-overlapping** labels are each maximally unique, so the ch.4 weight is 50/50 — but the module draws
the 3-bar label 3× as often; the bias grows without bound in the length ratio. LATENT/test-only
(`sequentialBootstrap` has no shipped importer), and the shipped check asserts only length/determinism/range,
so it cannot detect it (the F-68 class).

**The implemented bootstrap is not the AFML ch.4 sequential bootstrap it cites (L10-by).** The module's law is
`uniqueness_sum / (1 + pick_count)` with a **static** numerator; the ch.4 reference recomputes each candidate's
**average uniqueness against the current selection**. On `[[0,1],[0,1],[2,3],[2,3]]`, conditioned on the first
draw, the second-draw law is **1/7, 2/7, 2/7, 2/7** (module) vs **1/6, 1/6, 1/3, 1/3** (AFML) — total-variation
gap **0.1190**. The reference prefers a label from the *other* cluster (conditional uniqueness 1.0), while the
module only discounts the just-drawn label by `1/(1+count)`. Monte-Carlo (60 000 seeds, 15 140 conditioned
pairs) matches the module's own law within 2.5 SE, so the check is a faithful pin of the implemented behaviour
and the gap is a real algorithm divergence. LATENT/test-only.

**Spans are unvalidated, so a degenerate span returns NaN or −0 (L10-bz).** A zero-length span
(`start = end + 1`) gives `0/0 = **NaN**`, which **poisons** `effectiveSampleSize` (a plain sum) to NaN; a
negative-length span gives `0/−1 = **−0**`, which does not. No throw, no abstain — an inconsistent
degenerate-input contract, though the docstring says uniqueness is "in (0, 1]". LATENT.

**Scope.** `analysis/uniqueness.js` is reference-only (no shipped importer; grep finds only the test suite and
the lock registry). The shipped `overlapUniqueness` is validated to 0 deviation from `sampleUniqueness` and is
the correct average form. All three findings are test-only/export-level; no golden moves and no fold-back row.

**What is now false.**
* **"`sequentialBootstrap` weights each observation by its (average) uniqueness."** It weights by the
  uniqueness **sum** = average × span length, so two non-overlapping labels with identical maximal average
  uniqueness are drawn in proportion to their lengths.
* **"The module implements the López de Prado ch.4 sequential bootstrap."** It is a static-numerator,
  count-only heuristic; the reference reweights by average uniqueness *against the current selection*, which
  the module never computes (second-draw TV gap 0.1190 on a two-cluster fixture).
* **"The shipped uniqueness weighting could drift from the reference."** It cannot: `overlapUniqueness`
  matches `sampleUniqueness` exactly (8 fixtures) — and it is the correct average form.
* **"A label span is a valid interval."** Nothing validates `start ≤ end`: a zero-length span returns NaN
  (poisoning the ESS) and a negative-length span returns −0.

---

## F-73 — The stream design layer: the resampler and the Kish design-effect identities are exact, but a zero-variance stream is counted as a full unit of effective breadth, and `maxStreams <= 0` means "unlimited". [SUPPORTED — validation + audit; CYCLE-057]

`analysis/streams.js` is the shipped "buying effective independence, not bars" layer (round 26, R26-6):
`resampleCandles` builds a second bar interval from the same candles, `designEffectOfStreams` measures the
panel's Kish (1965) design effect, `selectStreams` greedily orders candidates by marginal effective bars per raw
bar, and `formatStreamSelection` renders it. `analyze.js` imports all four and prints them in the run report.
`experiments/e65_streams_audit.js` (registered; **73 steps, 42 gated, 0 fails**; 16 ms; **9 checks, all pass**)
audits it and registers two rows.

**The resampler is exact (validated).** `resampleCandles` reproduces a **hand recompute** (reading the source
bars directly — a different code path) to 1e-12 for factors 2/3/4/7 × `keepIncomplete` false/true on a 23-bar
fixture, and the OHLCV invariants hold against the original bars (open = first open, close = last close,
high = max finite high, low = min finite low, volume = sum, timestamp = first). It never mutates its input,
`factor === 1` is a **shallow copy**, a trailing partial group is dropped unless `keepIncomplete` (10 bars /
factor 4 → 2 groups, keep → 3; 3 bars → 0 / 1), and a bad factor (`0, −1, 1.5, NaN, '2'`) or non-array throws.
The documented non-finite fallbacks are exact: a group where both bars lack high/low reads high = **max(open,
close)** and low = **min(open, close)**; if one bar supplies them the extreme is taken from it; a missing volume
counts as **1** (the `world.js` rule).

**The Kish design effect satisfies every identity (validated).** For a 3-stream panel:
`rawBars = K·T` (720), `designEffect = 1+(K−1)·rbar` (2.9458671265), `effectiveBars = rawBars/DE` (244.4102…),
`effectiveStreams = K/DE` (1.0183758707), `effectiveBarsPerBar = 1/DE`, and `rbar` (0.9729335633) equals an
independent mean pairwise correlation to 1e-15. K = 1 → DE 1, effectiveStreams 1, `effectiveBars = rawBars = T`;
two identical streams → rbar **1**, DE **2**, effectiveStreams **1**; three identical → DE **3**; different
lengths align on **T = min length** (240 / 120 → T 120, K 2, rawBars 240); the documented degenerates abstain
(hedging pair, < 3-bar window, missing series, empty panel). The fold-Share method is chosen **iff the fold
tiles T** (`foldLength` 20 on T = 200 → `fold-sharpe`, rbar 0.2657996327 = an independent segmentation; 21 →
`raw-returns`).

**The selector is exact and deterministic (validated).** `selectStreams` is deterministic, returns
`order` = the curve labels, is monotone in effective bars, and `marginalBars`/`marginalEfficiency =
marginalBars/addedBars` recompute exactly; a fully redundant pool (three copies of one stream) collapses to a
single pick with the **label tie-break** (`['x']`), a diversifying stream is kept, and a positive `maxStreams` is
honoured. `formatStreamSelection` renders the documented header and the `unavailable`/`null` branches.

**A zero-variance stream is counted as a full unit of effective breadth (L10-ca).**
`meanPairwiseCorrelation` **skips** every pair it cannot correlate — so a constant stream contributes nothing to
`rbar` — but `designEffectOfStreams` still counts it in `K` and `rawBars = K·T`. Because it does not raise
`rbar`, `designEffect` stays ≈ 1 and `effectiveStreams ≈ K`:

| panel (T = 240) | rbar | K | rawBars | designEffect | effectiveStreams |
| --- | --- | --- | --- | --- | --- |
| two independent streams | −0.0133166822 | 2 | 480 | 0.9866833178 | 2.0270 |
| + one **constant** stream | **−0.0133166822** | **3** | **720** | 0.9733666357 | **3.0821** |

`rbar` is **bit-identical** with and without the constant stream, so the third stream changes only `K` and
`rawBars` — and buys a full unit (slightly more) of "effective breadth" from a series that carries no
information. Meanwhile `selectStreams` **does** skip it (its candidate is unavailable, since a pair with a
constant partner is NaN), so the two shipped functions disagree about whether a flat stream is a stream. LATENT
(a flat/halted stream in the panel — the L10-l class) and diagnostic-only.

**`maxStreams <= 0` means "unlimited" (L10-cb).** The limit is
`Number.isFinite(maxStreams) && maxStreams > 0 ? Math.floor(maxStreams) : all.length`, so `maxStreams: 0` and
`maxStreams: −3` both select the full greedy set instead of **none** (`e65`: `{a,b}` with `0` → `['a','b']`,
with `−3` → `['a','b']`, with `2` → 2). The shipped check only exercises `maxStreams: 2`, so it cannot see
this. LATENT (the driver passes a positive value), the same API class as L10-bj.

**Scope.** `streams.js` is shipped (`analyze.js` imports all four), but the module docstring and the lock
registry both state the design numbers are a **diagnostic/design** quantity that never enters the scored
arithmetic (the deflated Sharpe keeps `trials = K`). Both findings are latent, so no golden moves and no
fold-back row.

**What is now false.**
* **"The design effect measures the panel's effective breadth."** A stream that cannot be correlated is dropped
  from `rbar` but kept in `K`/`rawBars`, so it is counted as a fully independent observation — `effectiveStreams`
  can reach `K` while one stream carries no information.
* **"`selectStreams` honours `maxStreams`."** Only when `maxStreams > 0`; `0` and negatives mean **no limit**.
* **"`designEffectOfStreams` and `selectStreams` agree on what a stream is."** They do not: the selector refuses
  an uncorrelatable candidate while the design effect counts it.

---

## F-74 — The audited evaluation world: the shock, the candle view and the alignment are exact, but a missing `streamIndex` makes the cross-sectional look-ahead audit vacuous, and `maxBars <= 0` flips the slice. [SUPPORTED — validation + audit; CYCLE-058]

`analysis/world.js` (round 23, N0) gives `auditNoLookahead` its teeth: the audit can only certify causality for
information it can **reach**, and the shipped model reads the candle series, so a returns-only perturbation
passed vacuously (BUGS.md #22). This module builds the view a candle-driven model consumes — a bounded,
deterministic, **non-uniform** shock of every bar after the probe point, with `view.returns` re-derived from the
shocked closes. It is **shipped** (`analyze.js` imports `makeCandleViewFor`/`worldFromCandles`/`DEFAULT_SHOCK`;
`fold_worker.js` builds its view through `makeCandleViewFor`).
`experiments/e66_world_audit.js` (registered; **74 steps, 43 gated, 0 fails**; 49 ms; **7 checks, all pass**)
audits it and registers two rows.

**The shock is exact, bounded, non-uniform and phase-shifted (validated).** `shockFactor`/`volumeShockFactor` are
**exactly 1** at and before `after` and strictly inside `[1, 1+2·probe]` after (probe 0.07 → max 1.14, so a
shocked path stays positive and cannot explode); deterministic; non-uniform across `t`; and phase-shifted from
each other (at `t = after+2`, price 1.0494 vs volume 1.1369), so a volume strategy is reachable too. `probe: 0`
is a no-op.

**`shockCandles` is exact (validated).** `perturb = null` returns the **same array**; every bar at or before
`after` is the **same object**; each bar after gets a new object with OHLC scaled by one `f(t)` and volume by its
own `fv(t)`; the input is never mutated; the result is deterministic; the path stays positive; and the shock
changes the **shape** (close ratio spans 1.0001–1.0993), so a scale-invariant model cannot normalise it away.

**The view is self-consistent and causal (validated).** The base pass returns the real candles (identity) and
`returns = barReturns(closes)`, and uses a caller-supplied returns array verbatim. A probe pass is
**self-consistent** (`view.returns === barReturns(view.closes)` exactly), the past is **bit-unchanged** (every
`t <= after` matches the base closes *and* returns), **all** bars after `after` move (19/19), and `perturb`
echoes `{after, probe}`.

**The panel's own-stream slot is replaced only when `streamIndex` matches (L10-cc).** `panelFor` is
`returnsByStream.map((rs, i) => i === panel.streamIndex ? own : rs)`:

| panel | probe pass: `returnsByStream` | `view.returns` |
| --- | --- | --- |
| `{streamIndex: 1}` (T = 40, after = 20) | slot 1 = the **shocked** own; 0, 2 untouched | shocked |
| `{streamIndex: undefined}` | **every slot is the unperturbed original** | shocked |
| `{streamIndex: 7}` (out of range) | every slot is the unperturbed original | shocked |

So a cross-sectional candidate (`sig-reversal-xs`, `sig-network-momentum`) reads its own stream **unshocked** on
a probe pass and the look-ahead audit is **vacuous** for it — the exact trap `world.js` was built to close. Same
root cause as **L10-bu** (`features.js`'s `networkMomentum` self-skip) in a different module, opposite
consequence: there a wrong feature value, here a **green audit that cannot fail**. LATENT (`analyze.js` always
sets `streamIndex`).

**`worldFromCandles`' `maxBars` guard flips the slice for `<= 0` (L10-cd).** The guard is
`maxBars && candles.length > maxBars ? candles.slice(-maxBars) : candles.slice()`. On 30 bars: `5` → last 5 ✓;
`0` → **all 30** (falsy); `−5` → **25**, i.e. `slice(5)` **drops the first 5 bars** (the sign flip); `7.5` → 7
(silent truncation). `maxBars <= 0` is reachable from `analyze.js`'s `num('bars', 300)`, so a mis-set `--bars`
produces a plausible-looking series from the **wrong end** rather than an error. LATENT.

**Scope.** `world.js` is shipped and load-bearing for every causality certificate, but both findings are latent
(`analyze.js` always sets `streamIndex`, and its `maxBars` is positive/defaulted). No golden moves and no
fold-back row.

**What is now false.**
* **"On a probe pass, the view's panel carries this stream's perturbed series."** Only when `panel.streamIndex`
  matches a real index; with `streamIndex` absent/out of range **no** slot is replaced, so a cross-sectional
  candidate's audit cannot fail.
* **"`worldFromCandles(…, {maxBars})` keeps the last `maxBars` bars."** Only for a positive value: `0` → all
  bars, a negative value **drops the first |maxBars| bars** (`slice(-maxBars)`), a fractional value truncates.

---

## F-75 — The order-preserving scheduler: the queue contract and the failure semantics hold exactly, but `normaliseConcurrency` never validates its `max`, and the fold executor silently nulls a malformed `confidence`. [SUPPORTED — validation + audit; CYCLE-059]

`analysis/parallel.js` (round 26, R26-4) is the module the A/B's parallel fold loop stands on: run N units with C
in flight and return the results in **unit order**, so `folds.jsonl` and the per-variant checkpoints stay
byte-identical between the serial and parallel paths. It is **shipped** (`backtest.js`/`walkforward.js` use
`normaliseConcurrency`/`scheduleUnits`; `analyze.js` uses `makeFoldExecutor`; `fold_worker.js` posts the reply
shape). `experiments/e67_parallel_audit.js` (registered; **75 steps, 44 gated, 0 fails**; 49 ms; **7 checks, all
pass**) audits it and registers two rows.

**`normaliseConcurrency` is exact on its documented input (validated).** Every non-finite / non-positive width
maps to serial 1 (`0, −3, NaN, Infinity, null, undefined, '3', true, false, 0.5, 1`), a fractional width floors
(`2.9 → 2`), and the default cap holds (`1e6 → 64`). **The queue contract holds exactly (validated).** On 10
units at concurrency 3 the results come back in **unit order** under an out-of-order completion schedule (finish
order `2,1,0,5,4,3,6,8,7,9`), `exec` is called exactly once per unit, the peak in-flight count is **3**, and
`onResult` fires for all 10 out of order with a throwing reporter harmless (`[1,2,3]` still returned). **The
failure semantics hold exactly (validated).** With a failing unit the call rejects with the **first** error
(`boom-1`), only units `[0,1,2]` start, every started `exec` settles (`settled === started`, no dangling
promise), two failures → first wins (`e0`), a synchronous throw propagates, and empty input → `[]`.
**`makeFoldExecutor` adapts the reply (validated).** It maps `{positions, confidence, stats}` →
`{signals, confidence, stats}`, passes the request through verbatim, and throws the named
`"fold executor: malformed reply"` for a null/undefined reply or a non-array `positions` (including a
`Float32Array`).

**`normaliseConcurrency` never validates its `max` (L10-ce).** Only the value is validated; the cap is used raw
in `Math.min(Math.floor(value), max)`:

| call | returns |
| --- | --- |
| `normaliseConcurrency(10, {max: 0})` | **0** |
| `normaliseConcurrency(10, {max: −2})` | **−2** |
| `normaliseConcurrency(10, {max: 2.5})` | **2.5** |
| `normaliseConcurrency(10, {max: 0.5})` | **0.5** |

So a bad cap makes the "normalised concurrency" non-positive or fractional, contradicting the export's own
contract. Not reachable through `scheduleUnits` (which passes `{max: n}`, `n ≥ 1`) or the shipped callers
(`{max: folds.length}`), so a direct-call/export-level gap. LATENT.

**The fold executor validates `positions` but silently nulls a malformed `confidence` (L10-cf)** —
`confidence = Array.isArray(reply.confidence) ? reply.confidence : null` and `stats = reply.stats || null`:

| reply | result |
| --- | --- |
| `positions: new Float32Array([1])` | **throws** (malformed reply) |
| `confidence: 5` or `new Float32Array([1,2])` | **silently `null`** |
| `confidence: []` | `[]` (present-but-empty) |
| `stats: 0` / missing | **silently `null`** |

Half a malformed worker reply raises, half is absorbed: a worker that switched its `confidence` to a typed array
would silently lose the **R26-3 raw pre-policy confidence** the turnover experiment is built on — "no
confidence" instead of an error. LATENT (`fold_worker.js` posts an array or `null`), but an asymmetry in a
function whose stated job is validating the reply.

**Scope.** `parallel.js` is shipped and load-bearing for the serial/parallel byte-identity claim; both findings
are latent, so no golden moves and no fold-back row.

**What is now false.**
* **"`normaliseConcurrency` normalises a concurrency request."** It normalises the value only; a `max` of `0`,
  negative or fractional flows through, so the result can be 0, −2 or 2.5.
* **"`makeFoldExecutor` validates the worker's reply."** It validates `positions` but silently maps a non-array
  `confidence` and any falsy `stats` to `null`.
* **"The 64-wide cap bounds the scheduler."** `scheduleUnits` overrides it to `n`, so a huge request runs all
  `n` units at once — bounded by `n`, not by 64.

## F-76 — The turnover policy grid: the sweep reproduces the restatement exactly, but its `costBps` is dead, its audit hurdle is unreachable, and the default grid is only shallowly frozen. [SUPPORTED — validation + audit; CYCLE-060]

`analysis/holding.js` (round 26, R26-5) is the **turnover attack**: it restates the journaled raw pre-policy
confidence (R26-3) under a dead-zone × scale × entry/exit-hysteresis × minimum-holding grid and, per (candidate,
policy), reports the restated turnover / gross / break-even / Sharpe plus a full promotion decision. It is
**shipped** — `analyze.js` imports it as `runTurnoverSweep` behind `--turnover-sweep`, calling it with the run's
`costBps` and `decisionOptions: { requireCleanAudit: audit, … }`. It is pure post-processing (no model, no RNG).
`experiments/e68_holding_audit.js` (registered; **76 steps, 45 gated, 0 fails**; 45 ms; **8 checks, all pass**)
audits it and registers three rows.

**The grid is the exact cartesian product (validated).** `deadZones × scales × holdings` = `3 × 1 × 3` gives
`policies === 9` and `rows === 18` for two candidates; each row's `policy` is the merge
`{...holding, deadZone, scale}` (a `null` holding collapses to `{deadZone, scale}`; a holding's
`enter`/`exit`/`minHold` survive). **Every row reproduces a direct restatement (validated).** For several
policies, `row.turnover`/`grossPnl`/`netSharpe`/`breakEvenCostBps` equal a direct
`restateReportAtPolicy(candidate, policy, …)` recompute to **1e-9**. **Ordering and `byId` (validated).** Rows are
**non-increasing** in break-even with a missing value last; `byId[id].best` is the highest-break-even row for the
id, `bestPromoting` the highest-break-even promoting row (`null` when none promotes); `bestTurnoverPolicy`
prefers `bestPromoting` and returns `null` for an unknown id; the two bail-outs (a baseline or candidate with no
fold inputs) return `available:false` with a reason; `formatTurnoverSweep` renders the unavailable reason and,
when available, every id plus the target.

**`costBps` is accepted, echoed, and never applied (L10-cg).** `turnoverSweep` destructures `costBps`, writes it
on every row, and calls `restateReportAtPolicy(report, policy, { periodsPerYear, trials })` **without it**, so
every `netSharpe`/`dsr` and every promotion decision is computed at **zero cost**:

| sweep | `costBps` echoed | row `netSharpe` (dz = 0.1) | rows identical? |
| --- | --- | --- | --- |
| `{costBps: 0}` | 0 | **0.6864950785702724** | — |
| `{costBps: 25}` | 25 | **0.6864950785702724** | **yes** (apart from the echo) |
| direct `restateReportAtPolicy(…, {costBps: 25})` | — | **−3.156645069841796** | (0 bps: 0.6864950785702724) |

A direct restatement at 25 bps moves the net Sharpe, so the option *would* matter if threaded. The shipped
caller passes `--cost-bps`, so a `--turnover-sweep --cost-bps=10` run prints cost-free Sharpes under a header
that says `costBps=10`; only the cost-independent fields carry cost information. LATENT/report-level.

**The `requireCleanAudit` hurdle is structurally inapplicable (L10-ch).** `analyze.js` passes
`decisionOptions: { requireCleanAudit: audit, … }`, but `turnoverSweep` restates each report first, and
`restateReportAtPolicy` **drops the `audit` block** — unlike its sibling `restateReportAtCost`, whose comment
says the audit "is cost-independent, so it carries over unchanged". `promoteDecision`'s guard is
`if (baseline.audit && !baseline.audit.clean)`, so with `audit === undefined` the hurdle is skipped:

| object | has `audit`? | `promote` |
| --- | --- | --- |
| sweep row (baseline + a candidate with `audit.clean = false`) | no (dropped) | **true** |
| manual `promoteDecision(restBase, {...restCand, audit: dirtyAudit})` | yes | **false** — reason `candidate failed the lookahead audit (1 violations)` |

So a candidate that **failed the run's look-ahead audit** still promotes and can be named `byId.bestPromoting` —
the sweep reports a decision the run would not make. LATENT/report-level.

**`DEFAULT_TURNOVER_GRID` is only shallowly frozen (L10-ci).** `Object.freeze` freezes the outer object but not
its `deadZones`/`scales`/`holdings` arrays (nor the holding objects): `deadZones.push(0.9)` is **not blocked** and
takes the default sweep's policy count from **48 → 54** (one band × 1 scale × 6 holdings); `.pop()` restores 48.
A caller can thus change the default grid for every later default sweep. LATENT.

**Scope.** `holding.js` only restates journaled inputs, so none of the three findings can move a scored number;
they shape the diagnostic `--turnover-sweep` block and one exported default. No golden moves and no fold-back
row.

**What is now false.**
* **"`turnoverSweep` re-scores a policy at the requested cost."** It re-scores at zero cost and merely echoes the
  requested `costBps`; the net Sharpe and the promotion decision are gross-of-cost, so two sweeps at different
  costs are byte-identical apart from the label.
* **"The sweep's promotion decision is the run's full decision."** The `requireCleanAudit` hurdle can never fire
  because the restatement discards the `audit` block before `promoteDecision` sees it.
* **"`DEFAULT_TURNOVER_GRID` is frozen."** It is shallowly frozen; a push onto its `deadZones` is not blocked.
* **"The turnover grid is opaque."** It is a thin, pure wrapper over `restateReportAtPolicy` + `promoteDecision`,
  so its whole readout is reproducible offline — which is how the three defects were pinned without market data.

## F-77 — Seed replication: the IQM, the stratified bootstrap, the variance split and the CRN criterion are exact, but the "IQM" is not the cited estimator and the formatter can mislabel its own CI. [SUPPORTED — validation + audit; CYCLE-061]

`analysis/replication.js` (round 26, R26-13) is the **honest-summary** layer: a single-seed ordering is not a
ranking (Bouthillier et al. 2019), so the level is the **interquartile mean** (Agarwal et al. 2021), the interval
is a **stratified bootstrap** resampling within each seed, and the spread is split into seed/fold/residual
fractions; `pairedVarianceRatio` is the CRN criterion (Glasserman & Yao 1992). It is **shipped** (`analyze.js`
aggregates `--seeds` into `replication.json` via `seedDistribution`/`formatSeedReplication`). Pure and seeded, so
every number is reproducible. `experiments/e69_replication_audit.js` (registered; **77 steps, 46 gated, 0
fails**; 359 ms; **8 checks, all pass**) audits it and registers two rows.

**`interquartileMean` is the rank-slice middle its own doc describes (validated).** Exact on hand cases: `[]` →
NaN, `[7]` → 7, `[1,3]` → 2, `[1,2,3]` → 2, `[1,2,3,4]` → **2.5** (`slice(1,3)`), `[1..5]` → 3, `[1..8]` →
**4.5** (`slice(2,6)`); an unsorted input sorts first; non-finite values are filtered; monotone.
**`stratifiedBootstrapCI` is deterministic, size-preserving and abstains honestly (validated).** Same seed →
byte-identical; a different seed moves it; `lo ≤ median ≤ hi`; a probe statistic returning the sample length
confirms every replicate carries **exactly the original count** (12 for strata `[4,5,3]`); empty / all-non-finite
input abstains; a single non-finite value is filtered. **Its CI's empirical coverage is near nominal
(validation).** 400 panels of 12 i.i.d. zero-mean strata of 6 (`statistic = mean`, nominal 95 %) cover the true
mean **0.92** — the usual asymptotic shortfall. **The variance decomposition holds exactly (validated).**
`total = between + within + residual` to 1e-9 and the fractions sum to 1 in every constructed panel (pure
between-seed → `seedFraction` 1; pure within-seed → `foldFraction` 1; repeated cell → `residualFraction` 1; a
mixed 3×4 panel → 0.02703 / 0.97297 / 0), with `totalVariance` the population (÷n) variance; fewer than two
observations abstains. **`pairedVarianceRatio` is the CRN arithmetic (validated).** `varianceRatio` =
`var(paired)/var(unpaired)` and `varianceReduction` = `1 − ratio` exactly (ratio **0.000635** on the constructed
pair); short / zero-unpaired-variance input abstains; a hurtful pairing yields a negative reduction.
**`seedDistribution` carries the documented fields (validated)** and an empty `perSeed` abstains;
`formatSeedReplication` renders the level, the CI and the fractions.

**The IQM is the rank-slice middle, not the cited Agarwal et al. estimator (L10-cj).** The module takes
`sorted.slice(floor(n/4), n − floor(n/4))` — dropping a fixed **count** from each end **by rank** — while the
cited Agarwal et al. (arXiv 2108.13264) / `rliable` IQM drops the values outside `[q1, q3]` — a **mass** rule:

| input | module (rank-slice) | reference (quantile-filter) |
| --- | --- | --- |
| `[0, 0, 5, 10]` | **2.5** (mean of `[0,5]`) | **1.6667** (mean of `[0,0,5]`) |
| 300 right-skewed panels (5–12 values) | — | **149/300 differ**, max gap **1.016** |

So the summary the docstring attributes to Agarwal et al. is a different estimator (the L10-by class).
LATENT/claim-level.

**The formatter can label its CI with the wrong confidence level (L10-ck).** `formatSeedReplication({ label,
dist, alpha = 0.05 })` prints `(1 − alpha)·100}%CI` using **its own** `alpha`, never `dist.ci.alpha`: a
distribution built at `alpha = 0.10` is printed as **`95%CI`** by default (its bounds being the 90 % ones), and
only a caller who passes `alpha: 0.10` sees `90%CI`. `analyze.js` calls the formatter without an alpha, so the
shipped path is consistent only because it also builds the distribution at the default 0.05. LATENT.

**Scope.** `replication.js` is pure and only summarizes an already-scored run, so neither finding can move a
measured number. No golden moves and no fold-back row.

**What is now false.**
* **"The reported level is the IQM Agarwal et al. recommend."** It is a rank-slice, not the quantile-filter.
* **"`formatSeedReplication` reports the CI at its actual confidence level."** It prints its own `alpha`.
* **"A bootstrap CI here is a calibrated 95 % interval."** Its measured coverage for the mean is 0.92.

## F-78 — Cluster inference: the correlations, the jackknife, the Student-t tails and the exact sign test are exact, but `clusterStability.stable` drops half of its own rule and `signTest` underflows. [SUPPORTED — validation + audit; CYCLE-062]

`analysis/dependence.js` (round 25) is the module behind the pooled cross-stream Sharpe SE: clusters are the
independent units and a smooth statistic's SE comes from the **delete-one-cluster jackknife**. It is **pure and
imports nothing**, so it can be audited in isolation, and it is **shipped** (`walkforward.js#promoteDecision` uses
`pairedClusterTest`/`clusterStability`/`pairedClusterSignTest`). `experiments/e70_dependence_audit.js` (registered;
**78 steps, 47 gated, 0 fails**; 47 ms; **10 checks, all pass**) audits it and registers two rows.

**The correlations are textbook (validated).** `pearsonCorrelation` is exactly `Σdₐd_b/√(Σdₐ²Σd_b²)`, `±1` for a
monotone pair, NaN for fewer than three points / unequal length / zero variance; `meanPairwiseCorrelation` averages
the finite pairs and is NaN for a single series. **The equicorrelation design effect is Kish's (validated).**
`1 + (k−1)ρ` and `k/deff` exactly (K = 1 → 1), with a negative ρ legitimately reducing the deff and a non-positive
deff abstaining. **The grouping and the jackknife are exact (validated).** `foldWindowClusters([[1,2,3,4],[5,6,7,8]],
2)` → `[[1,2,5,6],[3,4,7,8]]` with throws on non-rectangular / non-divisible / bad-foldLength panels;
`clusterJackknife` on `[[1,2],[3,4],[5,6]]` with `statistic = mean` reproduces estimate **3.5**, leave-one-out
**[4.5, 3.5, 2.5]**, `se = 1.1547005383792515` (`√((2/3)·2)`), abstaining on fewer than two clusters / a
non-finite statistic. **The Student-t tails are exact (validated).** `studentTPValue` reproduces the exact df = 1
(Cauchy) and df = 2 closed forms to 5e-7, `t = 0` → 0.5/1, symmetric, `twoSided = min(1, 2·oneSided)`;
`studentTCritical` reads **1.6895724578** / **2.0301079283** at df = 35 (table 1.68957 / 2.03011) and round-trips
through `studentTPValue` to 1e-6. **The sign test is the exact binomial tail (validated).** `signTest` matches an
independent `Σ_{k≥wins} C(n,k)/2ⁿ` to 1e-12 (`7/10` → **0.171875**), `signTestFloor(n) = 2⁻ⁿ`, and the paired cluster
tests carry the documented fields (the sign test counts **per-cluster** signs — its fixed form).

**`clusterStability.stable` ignores the `worstDelta > minDelta` half of its own rule (L10-cl).** The docstring
says `stable` requires `fractionPositive >= minFraction` **AND** `worstDelta > minDelta`; the code computes only
`fractionPositive >= minFraction − 1e-12`:

| minFraction | fractionPositive | worstDelta | code `stable` | documented rule |
| --- | --- | --- | --- | --- |
| 0.5 | **0.6667** | **−0.5** | **true** | **false** |
| 1 | 0.6667 | −0.5 | false | false |

With the shipped default `minFraction = 1` the two coincide; with a looser `minStableFraction` a candidate whose
edge collapses on its worst window still reads `stable: true`. LATENT.

**`signTest`'s pmf underflows for n ≥ ~1075 (L10-cm).** `pmf0 = 0.5ⁿ` underflows the double range at n ≥ 1075, so
every pmf is 0 and `tail` stays 0: `signTest({wins: 500, n: 1000})` → **0.5126** (correct) while
`{wins: 1000, n: 2000}`, `{wins: 1, n: 2000}` and `{wins: 2000, n: 2000}` all → **0** (a balanced 2 000-cluster
test reading "certainly significant"). The docstring scopes the function to "tens to a few hundred" clusters, but
the failure is silent and in the unsafe direction. LATENT.

**Scope.** `dependence.js` only re-evaluates a statistic on clustered arrays, so neither finding can move a scored
number. No golden moves and no fold-back row.

**What is now false.**
* **"`clusterStability.stable` checks `worstDelta > minDelta`."** It checks only `fractionPositive >= minFraction`.
* **"`signTest` is exact for the counts this harness sees."** It is exact to `n ≈ 1074`, then underflows to
  `pValue = 0` for every win count.

---

## F-79 — The decision-grade report: `foldConcentration`, `confidencePersistence`, `nextRunPlan`, `promotionAcrossCadences` and the six-block `decisionReport` are exact, but `restateReportAtPolicy` carries a stale `foldInputs`. [SUPPORTED — validation + audit; CYCLE-063]

`analysis/decision.js` (round 26, R26-8) is the SHIPPED decision-grade report: six blocks (training / edge /
concentration / economics / family / nextRun), each a restatement of data the other analysis layers already
produced (it adds no new strategy statistic), with every missing input an explicit `{ available:false, reason }`
rather than a null. It is pure (no I/O, no RNG). `experiments/e71_decision_audit.js` (registered; **79 steps,
48 gated, 0 fails**; 34 ms; **10 checks, all pass**) audits it and registers one row.

**The concentration block reproduces a direct recompute (validated).** For a six-fold fixture with gross
`[8, 4, 3, −1, −2, −3]` (total 9), `foldConcentration`'s top-K shares (`8/9`, `15/9`, `9/9`), signed sums, and
delete-one-cluster range (full **−3.5204429235768973**, min **−5.253810564276818**, max
**−1.6034020777212812**, the right worst/best index) each match a leave-one-out `sharpeRatio` replay to 1e-12;
every per-fold marginal is `full − leaveOut[i]` (mean **0.023595765513707272**); and a non-positive gross total
makes `topKs[].share` **null** (not a misleading 1.0). Guards abstain with explicit na blocks on
empty/mismatched/malformed input. **`confidencePersistence` is the pooled within-fold lag-1 (validated).** On a
known 12-bar series `lag1 = 0.666707822740828` and `halfLife = 1.709771604681528` match a hand recompute, with
no cross-fold pairs (a two-fold `[1,1,1]`/`[−1,−1,−1]` split reads `pairs 4`, `lag1 1`), a constant-confidence
note, and abstentions on `< 2` pairs. **`nextRunPlan`/`pairedUnitsNeeded` match a brute force (validated).**
`pairedUnitsNeeded` returns the smallest cluster count **9** (observed) / **18** (80 % power) whose one-sided
cluster-t resolves the target, with `reference.pairedMde95 = tCritical(35,0.05)·0.08 = 0.13516579662244632`;
`barsToDetectDependent = ceil(620·2.95) = 1829`; the `clearsBps`/timing/cadence blocks are exact.
**`promotionAcrossCadences` and `defaultCatastrophic` (validated).** Majority-pass (2/1 → promote) with a
strict-majority tie failing, the catastrophic veto on a negative net Sharpe and on a look-ahead-audit reason,
empty abstains. **The six-block report (validated).** `decisionReport` emits `schema: 'nl.decision.v1'`, the
referent/run label policies, and explicit-na family blocks; `formatDecision` renders them. All six
`cheapestFlip` kinds (none/cost/stability/magnitude/gate/search) fire from their witnesses.

**`restateReportAtPolicy` carries a stale `foldInputs` (L10-cn).** The policy restatement replaces `folds` with
metrics rebuilt from the **restated positions** but returns `foldInputs: report.foldInputs` **unchanged** (the
deliberate P2 chaining). `foldConcentration` reads its gross half (`grossTotal`/`topKs`/signed sums) from
`folds` and its Sharpe half (`deleteOneCluster`/`marginal`) from `foldInputs.signals`, so a policy-restated
report handed to it yields a block whose gross half describes the **restated** positions and whose Sharpe half
describes the **original** positions — two position series in one block (restated pooled net Sharpe
**−5.201698358740081** vs the carried-signal Sharpe **−3.5204429235768973**). The SHIPPED `--decision` path
restates at **cost** only (`restateReportAtCost`, same signals, same `costBps`), where both halves agree
(verified: **−3.877740023296727** on both), so the mix is latent/export-level — reached only by chaining a
position-changing restatement (a policy/cadence sweep) into `foldConcentration`.

**Scope.** `decision.js` computes no new strategy statistic, so L10-cn cannot move a scored number; the shipped
call restates at cost only. No golden moves and no fold-back row.

**What is now false.**
* **"A restated report is a drop-in input for every consumer of a report."** A policy restatement changes the
  positions while carrying the original `foldInputs`, so a consumer that re-derives net returns from
  `foldInputs` reads pre-policy positions beside post-policy gross.

---

## F-80 — The hivemind numeric kernels are exact on the finite path, but a non-finite guard kills the +∞ activation, a `|| 1` family replaces a legitimate zero, and the vector helpers disagree on a length mismatch. [SUPPORTED — validation + audit; CYCLE-064]

The five pure kernel bags under `hivemind/kernels/` (`activations`, `linalg`, `normalization`, `sampling`,
`statistics`) are installed onto `HiveMind.prototype` via `internal/mixins.js` and are SHIPPED
(`hivemind/training/gradients.js` calls the spectral/gradient-norm, variance, fractal, NTK, percentile and
sparse-threshold helpers in the per-step training hot path; `hivemind/transformer/*` calls the activation,
linalg and normalization kernels). `experiments/e72_hivemind_kernels_audit.js` (registered; **80 steps, 49 gated,
0 fails**; 18 ms; **11 checks, all pass**) audits them via `.call(fakeThis, …)` and registers four rows. This is
the first audit outside `analysis/`.

**The finite path is exact (validated).** `_silu`/`_siluDerivative` match `x·σ(x)` / `σ(x)(1+x(1−σ(x)))` to
1e-12 and `_sigmoid` matches `1/(1+e^−x)` to 1e-15 (monotone); `_softmax` matches `exp(a−max)/Σ`, sums to 1,
returns the uniform distribution on a non-finite element, `[]` for `[]`, and writes into a supplied `out`; the
linalg helpers (dot/add/scale/sub/norm/cosine/weighted-mean/proj-similarity) match to 1e-9; `_rmsNorm` matches
`x/√(mean(x²)+1e-6)`, `_applyRoPE` is the identity at pos 0 and rotates each `(x,y)` pair by
`θ = pos·10000^(−2i/headDim)` at pos 1, and `_normalizeSemantic` clamps the proto RMS to `1.8+2.2·protoCapacity`;
`_randomNormal` is the Irwin-Hall(12) approximation (mean ≈ 0, var ≈ 1) and `_sampleDirichlet` sums to 1 with
`[]` for `count < 1`; and `_computeVariance` is the documented MAD proxy (`[0,0,0,0,100]` → 10), `_computeEMA`,
`_computeGradientConformity`, `_computePercentile`, `_computeSparseThreshold`, `_computeDynamicPercentile`,
`_computeGradientNorm`, `_computeSpectralNorm` (diag(3,1,1) → 3.0000 by power iteration), `_detectSuddenDrop` and
`_isStagnating` all match their contracts.

**`_sigmoid`/`_silu` map `+Infinity` to 0 (L10-co).** The guard `isFiniteNumber(x) ? … : 0` runs before the
internal `Math.min(Math.max(x, −100), 100)` clamp, so it short-circuits for `±Infinity` and returns **0** on both
tails: `_sigmoid(+∞) = 0` (limit 1), `_silu(+∞) = 0` (limit +∞), while `_sigmoid(±100)` = 1 / 3.7e-44 shows the
clamp would have handled them. A maximally-positive logit reads as probability **0**. (`isFiniteNumber` also
accepts numeric strings — `_silu('2') = 1.7616` — while `_softmax` uses `Number.isFinite`.)

**The falsy-zero family (L10-cp).** `_computeGradientNorm`, `_computeSpectralNorm` and `_computePercentile` end
in `… || 1` / `|| 1.0`, so a **zero** gradient vector, a **zero** gradient matrix and a genuine **0** percentile
all read **1** — feeding `gradients.js`'s threshold/percentile pool a dead gradient as the value 1.

**The vector helpers disagree on a length mismatch (L10-cq).** `_fastVectorDot(a, b)` has no guard and reads past
`b` → **NaN**; `_vectorDot` guards and returns **0**; `_fastVectorAdd` returns a **copy of `a`** (silently).

**Two dead clamps and a mis-named estimator (L10-cr).** `_computeDualEMA`'s `min(0.8, …)` cap is unreachable (the
raw value ∈ (0, 0.5]); `_computeNTKStability`'s `max(−0.1, …)` floor is unreachable (the argument ∈ (−0.05, 0]);
and `_computeFractalDimension` is an ad-hoc clamped dispersion (a **constant** series reads the maximum 2), not a
fractal dimension.

**Scope.** Every defect is on a non-finite / exactly-zero / degenerate-input edge; the golden suite pins the
finite-path numerics and they are exact, so no scored number moves. No golden moves and no fold-back row.

**What is now false.**
* **"A non-finite activation input is safely mapped to 0."** `+Infinity` is non-finite, so the maximally-positive
  tail of a probability activation reads as 0, and the `±100` clamp is unreachable for exactly those values.
* **"`_computeGradientNorm`/`_computeSpectralNorm` return the norm and `_computePercentile` the percentile."** Each
  returns **1** for a legitimate zero.

---

## F-81 — The repo's V2 sleeve layer reproduces all three published sleeve books bit-for-bit on the lab's real data; the port exposes that the lab's own shells disagree about which array is the book grid. [SUPPORTED — port verification; CYCLE-066]

`PLAN-round31.md` moves the project's edge from the learned layer (measured inert) to the lab's structural
sleeves, and `docs/MIGRATION-V2.md` ports the shared book arithmetic and the three pinned specs into the repo
(`src/core/primitives/*`, `src/plugins/sleeves/*`). The lab's stored sleeve numbers are, strictly, a claim
about the **lab's** code until the repo runs the same arithmetic on the same real panel — which is what
`experiments/e73_port_verify.js` measures (registered in `run_all.js`; **81 steps, 50 gated, 0 fails**;
**10 checks, all pass**). Read-only on the repo, it imports the repo primitives/sleeves, rebuilds the lab's
aligned carry panel (`e12#buildXsSeries`), reconstructs each book through the repo `signal()`/`returns()`
methods, and compares the rows (bit-for-bit), the returns, and the stored metrics in
`results/e30_retuned_capacity.json`, `e32_fade_retune.json` and `e50_oi_band.json`.

**The port reproduces all three books exactly (validated).** The **rows** and **returns** are identical to the
lab's own construction (`e17#buildBook` + `prototypes/port.js` for R8, `e22#buildMasked` for R7,
`e21#xsBookImpl` + the 50/50 blend for OI), and the metrics are the stored ones:

| sleeve | rows == lab | returns == lab | net@4 | turnover /yr | break-even bps | == stored |
| --- | :---: | :---: | ---: | ---: | ---: | :---: |
| R8 `carry-dispersion` (`ewma 0.02`, cap 1/8, no band) | yes | yes | **6.18** | **10** | **46.04** | `e30` |
| R7 `toptrader-fade` (`ewma 0.05`, cap 1/8, no band, sign −1) | yes | yes | **1.07** | **8** | **182.59** | `e32` |
| OI `oi-change` (50/50 `ewma 0.1`+`ewma 0.25`, band 0.03, no cap) | yes | yes | **0.92** | **198** | **15.22** | `e50` |

The chain check is separate and also exact: the repo's `core/primitives/weights.js#cleanBook` is
**fingerprint-identical** to the lab's `prototypes/port.js#cleanBook` on a raw rank-funding book
(`cleanChainIdentical: true`). Panel: 8 symbols (btcusdt…linkusdt), 6 557 book periods, 4 bps fee,
`NEXT = 2`; `firstTop = 1309`, `firstOI = 1310`.

**Three books are three points, so the claim is also measured on random panels (R31c).** A rule that coincides
on this one panel but not in general — a tie order, a policy phase, a forward-index offset, a guard placed out
of reach — would still pass the three-book read. `e73`'s randomized half therefore drives every ported
primitive against the **lab module it was ported from** on **250 seeded random panels** (seeded `mulberry32`,
so the run is reproducible): `fuzzBooks` compares the repo `buildFundingBook` with `e17#buildBook` (daily /
ewma / **hold**) and `buildCrossSectionalBook` with `e21#xsBookImpl` (explicit grid) and `e22#buildMasked`
(grid from `spotRet`), over random k, grid, `from`, sign, `NEXT` and 15 %-null signal panels; `fuzzWeights`
compares `rowRankWeights`/`rowLevelWeights` with `e17`'s, `cleanBook` with `prototypes/port.js` (five
cap/band combinations) and `turnoverSeries` with `e16`'s; `fuzzMisc` compares `dlogMatrix` with `e21`'s `dlog`
(**including an absent column**, which must read as a `null` column rather than throwing) and `blendBooks`
with the repo's own `blendRows∘normalizeL1` identity. **Zero divergences in 250 trials** (exact equality, or
1e-12 relative if an associativity-preserving rewrite ever appeared). So the port is the lab's arithmetic, not
a look-alike on one panel: `e73` reports **10/10 checks**.

**The book grid is ambiguous in the lab (L10-ct).** `e12#buildXsSeries` returns **two** time arrays on the
same object — the outer `times` (= `bookTimes`, length **n−1 = 6557**) and `legs.times` (length **n = 6558**)
— and the lab's two construction shells read **different** ones: `e17#buildBook` uses
`const n = legs.times.length` (→ 6557 weight rows) while `e21#xsBookImpl` is handed `n = times.length`
(→ 6556 rows). Both books are internally consistent and both published numbers are correct, but they sit on
grids one period apart purely by which array the experiment happened to read, so no single hard-coded rule can
reproduce all three and a bit-level cross-check cannot line the rows up. The V2 primitives make the **grid an
explicit input** (`buildFundingBook`/`buildCrossSectionalBook` take `n`, default = the leg rows); the sleeves
forward `view.n`, and `e73` passes `n = times.length` for the OI view only. Latent: no published number is
wrong — the defect is the disagreement about what "the book grid" means.

**Scope.** Read-only on the repo; no lab number and no repo number moves. This is the lab's first **port
verification** (the repo must reproduce the lab, the inverse of the audit experiments) and the fifth consumer
of `prototypes/port.js`, so F-60's "one module, five books" claim is now confirmed from both sides of the port.
No fold-back row (it *is* the port's evidence).

**What is now false.**
* **"A sleeve's book grid is unambiguous."** The lab's own two shells read two different arrays off the same
  `buildXsSeries` result, so they build on grids one period apart.
* **"The stored sleeve numbers are only a claim about lab code."** They are now also reproduced, bit-for-bit,
  by the repo's `core/primitives` + `plugins/sleeves` modules.

---

## Summary table

| # | claim | verdict | the number that decides it |
| --- | --- | --- | --- |
| F-01 | the edge is a 600-bar window artefact | SUPPORTED | +1.267 (600 bars) vs +0.110 (53 500 bars) |
| F-02 | the basket is one factor | SUPPORTED | 4.92 design effect, 1.47 effective streams of 8 |
| F-03 | demeaned signals collapse dependence | SUPPORTED | design effect 4.92 → 0.39-0.60 |
| F-04 | carry is real but its raw Sharpe is a fiction | SUPPORTED | full window: +9.05 %/yr, Sharpe **4.54**, 7.96 % DD (0.96 on the old 2.9 y window) |
| F-05 | funding as a price signal | NEGATIVE | +0.026 Sharpe |
| F-06 | momentum upgrades | NEGATIVE | all ≤ +0.13 Sharpe, ≤2.6 bps break-even |
| F-07 | cross-sectional momentum | NEGATIVE | all \|Sharpe\| ≤ 0.033 |
| F-08 | vol conditioning | NEGATIVE | +0.112 vs +0.110 unconditional |
| F-09 | calendar seasonality | NEGATIVE | OOS −0.009 / −0.073 |
| F-10 | basis reversion | **SUPPORTED (lead)** — was PARKED; **F-23/F-25: convergence leg cost-fragile & unrescuable; timed-carry leg = drawdown overlay** | IC 8/8 positive; daily Sharpe +9.15 (churn); smoothed carryPlus net@4 +4.05, DD 2.09 % vs flat's 7.96 % |
| F-11 | controls / harness validity | SUPPORTED | oracle +12.25, random +0.02 |
| F-12 | combination | NEGATIVE | +0.019 |
| F-13 | the window effect survives the repo's own aggregation | SUPPORTED | A/B +1.106 @600 vs reported +1.0848; +0.109 @full |
| F-14 | full-history fold+pool cost is `poolReports`, not the model | SUPPORTED | 250 ms scoring vs ≈155 s dependence |
| F-15 | taker order-flow imbalance | NEGATIVE | arms ≤ +0.03 Sharpe (1h), flow corr across assets 0.020 |
| F-16 | vol forecastable; sizing buys drawdown | SUPPORTED | sized carry DD 7.96→1.33 %, DE 99.5→**6.0**; HAR beats baseline on QLIKE |
| F-17 | cross-sectional carry dispersion | **SUPPORTED — tradable via EWMA-smoothed weights (F-24)** | xs rank Sharpe 5.03 vs flat 4.54, DD **2.93 % vs 7.96 %**, 5/5 years, z = 12.6 |
| F-18 | four silent measurement bugs in the carry pipeline | SUPPORTED — critical | flat Sharpe reads 0.478 → 4.54 as they are fixed; `e14` regression tests |
| F-19 | the old 2.9 y carry window flattered every book 2–4× | SUPPORTED | flat 4.54 full vs **10.27** old window; 2022 Sharpe −1.46 |
| F-20 | `serialDesignEffect` is outlier-fragile | SUPPORTED — methodology | flat DE 99.5 raw → 11.8 winsorised → 11.0 ex-FTX |
| F-21 | the dispersion book survives the crashes; reversal is significant | SUPPORTED | FTX month: flat **−5.12** vs xs rank **+5.51**; xs rank positive in 9/9 regimes |
| F-22 | the carry complex is not a mark-smoothing construction | NEGATIVE — suspicion falsified | traded leg: flat 4.65 (vs 4.54), xs rank 4.98 (vs 5.03), reversion 9.17 (vs 9.15), sizing DD unchanged |
| F-23 | the *daily* dispersion/reversion "improvements" are cost-fragile | SUPPORTED — critical practicality | rank book break-even **1.87 bps** at **803×/yr** turnover; flat book 0.2×/yr, break-even 5422 bps |
| F-24 | the dispersion edge is tradable with smoothed weights | SUPPORTED | EWMA(0.1) weights: turnover **85×/yr**, break-even **12.78 bps**, gross Sharpe **5.18**, net@4 **+3.55**, positive in all 4 crash windows |
| F-25 | basis timing = risk tool, not alpha | NEGATIVE as alpha / positive as overlay | convergence leg dies when smoothed (9.15→2.66); smoothed carryPlus: net@4 **+4.05**, DD **2.09 %** vs flat 7.96 % — but Sharpe 4.05 < flat's 4.54 |
| F-26 | impact, not the fee, bounds the improvements | SUPPORTED — capacity | dispersion capacity **$13 M** (Y=1, 4 bps) / $53 M (Y=0.5); timed-carry **$95 M**; flat hold not impact-limited; binding symbol DOGE ~1 % ADV |
| F-27 | a per-symbol position cap doubles the dispersion capacity | SUPPORTED — capacity | strict cap 12.5 %: capacity **$27 M** (Y=1) / $107 M (Y=0.5), turnover 85→35×, DD 0.94→0.47 %, regimes 7/9→8/9; soft cap buys nothing; ADV-tilt/drop-thin destroy the edge |
| F-28 | open interest: no signal, but it sizes the flat book | NEGATIVE (signal) / SUPPORTED (capacity) — **signal half corrected by F-45** | next-8h IC of Δlog(OI) = **0.020** (contemporaneous 0.595 — the look-ahead trap); flat book = 1 %/5 %/10 % of thin OI at **$6.9 M/$34.3 M/$68.6 M** — the whole carry complex is ~$5–70 M (the "no tradable signal" line was the *daily* book, F-45) |
| F-29 | fade the toptrader positioning ratio: a modest contrarian cross-sectional edge | SUPPORTED — lead | dollar-neutral fade book: gross Sharpe **1.055**, turnover 126×/yr, break-even **15.1 bps**, net@4 **+0.77**; 4/4 quartiles, 5/6 years, bootstrap p5 +0.36, placebo z 2.1; only visible *cross-sectionally* (level IC ≤ 0.02) |
| F-30 | the toptrader fade survives held-out / cost / confound; smoothing makes it cheap | SUPPORTED | EWMA(0.1) weights: turnover 126×→**23×/yr**, break-even **15→74 bps**, net@4 **+0.79**, halves 0.81/0.79; funding-fade is unstable (H2 −0.43); OI capacity $8–10 M (1 % of thin OI) |
| F-31 | the toptrader fade is orthogonal to carry and rescues the carry book's decayed half | SUPPORTED — **restated by F-43 at the final specs** | corr(topLS, carry dispersion) **−0.001**; mixed 25/75: net@4 +1.38 with H2 net@4 **−0.12→+0.75** (pre-retune books; at the final specs the carry H2 is already +4.66, so the 25 % mix nets 1.62 vs 6.49 and a walk-forward rule picks 0 % — F-43) |
| F-43 | the sleeve mix at the final specs, and whether the two OI capacities add (L12/L18/L15/L17) | **MIXED — F-31 restated / capacity is portfolio-level** | ρ still 0.010 but the re-tuned carry book's net@4 second half is **+4.66** (nothing to hedge), so the fade (net@4 1.00) dilutes carry (6.49): 25 % mix **1.62**, walk-forward picks **0 %** in 11/11; and at a **fixed** split the two capacities do **not** add — individual means $23.72 M + $31.85 M = $55.57 M, joint at the mix **$31.32 M (56 %)**, and running both at their individual compliant sizes breaches the 5 % cap in **78.4 %** of periods (peak **10.0 %**), LINK weight corr −0.20 (see F-44 for the free-split frontier) |
| F-44 | the exact free-split joint OI frontier (L12/L18/L15/L17) | **SUPPORTED — refines F-43** | the per-period LP `max Σ g_s G_s s.t. \|Σ G_s w^s_j\| ≤ 5 %·OI_j` reads a total gross **mean $62.72 M (1.13× the $55.64 M sum), median $37.11 M (0.88×), p99 $624 M, 2.00× the fixed mix** — so the constraint is cheap, but the optimal fade share is **p5 0 / p95 1** (no stable allocation) and the LP-optimal schedule churns **48.5× gross/yr** for **net@4 0.62** (vs carry's 6.49) → the frontier is a capability, not a deployable size |
| F-45 | is the OI-change cross-sectional signal unrescuable, or was it F-23 again? (L07 → L19) | **SUPPORTED — corrects F-28** | the daily OI book (gross 0.96, **1501×/yr**, break-even 1.89 bps, net@4 −1.07) was the **F-23 implementation artefact**: EWMA-smoothed, **3 of 6** policies clear 4 bps (λ=0.25: break-even **8.93 bps**, net@4 **+0.65**; λ=0.1: **14.73 bps**, +0.52), independent of carry (corr **0.007**), sign control −3.00 — BUT weak/churny/recent (338×/yr, net halves **0.07/1.47**, 2023 −0.86 vs 2024–26 +1.56/+0.96/+2.30; walk-forward λ +0.44 < pinned +0.76/+0.99) → not a port candidate; F-28's "no signal" is corrected to "weak signal" — **the "recent-regime" framing is refined by F-46: the signal survives a pre-2024 holdout at λ=0.1 and in a fixed cross-scale blend (positive every year 2022–26)** |
| F-46 | is the OI-change signal a 2024–26 artefact? F-45's open falsifier (L19) | **SUPPORTED — refines F-45** | with sign +1 and λ∈{0.1, 0.25} fixed a priori, the pre-2024 (n=2270) net@4 is **λ=0.25 −0.12** but **λ=0.1 +0.47** (break-even 15.23 bps) — so the *signal* is not a 2024–26 artefact, but F-45's "best" λ=0.25 **is** (pre −0.12 / post +1.45); the two λ are anti-phase and a fixed **50/50 blend** reads **+0.33 pre / +1.24 post**, **positive every calendar year 2022–26** (0.34/0.73/0.89/1.45/1.88), break-even **11.33 bps**, 254×/yr, beating both single λ (full net@4 **0.77** vs 0.65/0.52); no decay (net trend **+0.67**, p 0.053); **rank does not help**; independent of L18 (**−0.045**); OI bound mean $23–28 M, p5 $6–8 M (DOGE/LINK/ADA) |
| F-47 | does the L19 OI stream add to R8? (L19 × R8 × R7; extends F-44, audits F-31/F-43) | **MIXED — L19 does not add; opens L10-y** | return side: independent (corr carry **+0.01**, fade 0.00) but **too weak** — capital ladder monotone down (carry net@4 6.48 → 2.82 at 5 % OI, walk-forward OI **0 %** in 11/11), and risk-normalised max-Sharpe OI weight **0.10** for **+0.04** Sharpe (6.48→6.52); capacity side: the **3-D LP** mean **$142.2 M = 1.76× the sum** of the three individual means ($80.9 M) and **2.27×** the 2-D carry+fade LP ($62.7 M) with optimal **OI share 0.374** (not crowded out), but its schedule churns **129.6× gross/yr** for net@4 0.82 and all-three-at-individual-sizes breaches in **58.8 %** of periods → uninvestable; **L10-y**: the carry book's net4 vol is **0.4 %/yr** vs the fade's **13.6 %** and the OI's **24.3 %** (31–55×), so capital-fraction mixes measure the vol ratio — F-43's direction stands, its magnitude (6.49→1.62) does not |
| F-48 | does a fixed cross-scale blend beat R8's walk-forward λ? (L12, L16; tests F-37/F-39) | **SUPPORTED — the blend matches the rule with half the turnover** | OOS net@4: walk-forward **6.63** (14×/yr, break-even 25.55 bps) vs the best fixed blend λ∈{0.01, 0.02} **6.66** (recent-24m **4.58**, **7×/yr**, break-even **46.14 bps**) — within 0.2 Sharpe (the pre-registered falsifier does not fire) and every pre-registered blend recent-positive, so a fixed two-scale blend with **no rule/lookback/block** matches the walk-forward; the `all5` control including the broken λ=0.1 is the *worst* (4.36), so nothing rewards blind mixing; the pinned λ=0.02 reads **6.86** but was tuned on the full history (in-sample) and the rule's value over it is **−0.23** → the walk-forward bought *slowness*, not a selection rule |
| F-49 | is F-48's "fixed blend replaces the rule" robust, or hindsight? (L12, L16; tests F-48) | **MIXED — scopes F-48 down** | only **1 of 10** pre-registered blends clears the 0.2 bar — the cherry-picked `{0.01,0.02}` (6.66); the **no-hindsight** F-37-slow sets read `{0.005,0.01,0.02,0.05}` **5.74** and `{0.005,0.01,0.02}` **6.08** (0.55–0.89 below), and a blend-selection walk-forward reads **5.81** vs the rule's 6.63 → the blend claim is menu-dependent and unlearnable; **but** a λ frozen on `[0,S)` picks the broken λ=0.1 for S ≤ 1825 (OOS **1.76–1.93**) and **0.02** for S ≥ 2555 (OOS **6.81 / 6.64 / 4.10** vs the rule's 6.69 / 6.48 / 4.27) → R8's rule can be a **frozen λ chosen on ≥ ~2.3 y of trailing data**, not a fixed blend |
| F-50 | is R8's cap rule removable too? (L12, L16, L17; tests F-39/F-49) | **MIXED — corrects F-39; the pinned book wins** | the joint (λ, cap) walk-forward reads OOS net@4 **6.13** vs the pinned `ewma 0.02 + cap12.5 %` **6.86** (plain 0.02 6.63), and the pinned book is ≥ the rule on **4/5** sub-spans → the rule's edge was over the *broken F-24 spec* (+2.76), the F-48/F-49 pattern again; the cap is a **flat plateau** at λ=0.02 (OOS 6.63 none / 6.77 cap0.10 / 6.86 cap0.125 / 6.90 cap0.15; it clips **42.3 %** of weight entries) so `1/k=0.125` is **structural, not tuned** — the first **OOS confirmation of F-27**; a frozen *pair* fails (early regime picks `0.075+cap0.1`, OOS 2.29–2.48), but a **frozen cap** with λ=0.02 reads 6.77/6.84/6.81/6.64/4.10 ≥ the rule at every split → R8's spec is **pinned** (λ on ≥2 y + cap = 1/k), no walk-forward |
| F-51 | is the fade's spec pinned too? The F-48/49/50 chain on R7 (L18; tests F-40) | **MIXED — R7 is a pinned book; extends F-40** | the joint (λ, cap) walk-forward reads OOS net@4 **0.70** vs the best pinned `ewma 0.05 + cap12.5 %` fade **1.14** (pinned `ewma 0.1` 0.94, per F-40), and a λ **frozen** on `[0,S)` with the cap at `1/k` picks **0.05** and reads **1.14 / 1.15 / 0.37 / 0.83 / 0.87** vs the rule's **0.70 / 0.87 / 0.31 / 0.60 / 0.93** (≥ or within 0.2 at every split, **no ≥2 y minimum needed**); the mechanism is **λ-flatness** — with the cap fixed the eight λ's span only **0.16** OOS (no cap 0.25), so the rule ranks near-ties (F-40's noise-dominated window, quantified); the cap transfers (λ=0.1: OOS 0.94→**1.11**, turnover 28→**16×/yr**, recent-24m 0.84→0.47) → **R7's port spec is pinned too** (`ewma 0.05 + cap 12.5 %`), so **both deployable sleeves are pinned, no walk-forward** |
| F-52 | what is the cap actually doing — concentration or a no-trade band? (L16, L17; tests F-27/F-50) | **SUPPORTED — the cap is a concentration tool; refines F-27/F-50** | a no-trade band swept to the cap's exact turnover (eps=0.008 → **10×/yr**) recovers only **+0.13 of the cap's +1.26** net@4 gain (5.05 vs 6.18), and across the whole band sweep (turnover 16→6×/yr) net@4 stays in **[4.95, 5.05]** — so the cap's Sharpe edge is the **shape** (clipping max `\|w\|` 0.438→0.125), **not** churn; the band leaves max `\|w\|` at **0.436** and its OI capacity is a **1.00×** multiple of base ($20.44 M vs $20.42 M ratio-of-means; $19.88 M vs $19.84 M min-of-ratio) while the cap is **1.76× / 1.70×** → the capacity gain is **concentration**; and a band **stacks** on the cap (net@4 **6.36** at turnover **6×/yr** vs 6.18 at 10) → the cost recipe is **cap 1/k + a no-trade band** |
| F-53 | does the cap-mechanism transfer to the fade? (L18, L17; tests F-51/F-52) | **SUPPORTED — generalises F-52; the band stack is R8-only** | the fade cap lifts net@4 **0.82 → 1.07** (**+0.25**), but a no-trade band swept to the cap's exact turnover (eps=0.05 → **8×/yr**) reads **0.78** — *below* base (**−0.04**) — and the whole band sweep (14→6×/yr) stays in **[0.78, 0.95]**; the band leaves max `\|w\|` at 0.456 (base 0.500, capped 0.125) and capacity a **1.03–1.04×** multiple of base while the cap is **1.43–1.47×** → the cap is a **concentration** tool on R7 too; but a band on the capped fade gains only **+0.06** (1.13 vs 1.07, threshold 0.1) vs R8's **+0.18** → the mechanism is general, the **band stack is R8-specific** |
| F-54 | why does clipping help — hard constraint, or just concentration? (L16, L17; tests F-27/F-50/F-52) | **SUPPORTED — it is a tail winsorisation; the hard form is not special** | a smooth saturation `c·tanh(w/c)` at c=0.125 matches the hard clip (net@4 **6.04 vs 6.18**, inside the 0.2 band; 6.11 at c=0.10), so the form does not matter, only the level (a plateau: hard **6.18/6.18/6.13/5.84/5.23** and soft **6.11/6.04/5.94/5.74/5.43** for c = 0.10/0.125/0.15/0.20/0.30); but `powerShrink(p)=sign(w)\|w\|^p` reads **4.44/3.99/3.25/2.27** for p=1.25/1.5/2/3 (all *below* base 4.92) and equal-weight reads **1.51** → the mechanism is **winsorising the tail while preserving the body**, not lowering concentration per se |
| F-55 | is the "frozen λ matches the pinned book" conclusion split-point robust? (L12, L16; tests F-49/F-50) | **MIXED — refines F-49/F-50; only robust past ~2.3 y** | on a **dense** 14-split grid the pre-registered 0.80 bar narrowly fails — the **expanding** `[0,S)` freeze is within 0.2 of the in-sample-best pinned book at **0.71** (median gap 0.00), the **rolling 1-year** freeze at **0.79** (median **+0.30**) — but every failure is in the first ~2 y: the expanding freeze collapses at **every split S ≤ 2190** (−3.4…−4.4) picking a fast λ, then picks **0.03** and matches at **10/10** splits from S = 2555 → the safe boundary is **~2.3 y**; the broken fast λ is **0.075** (not 0.1) once training > 1.3 y; the rolling freeze beats the expanding one (0.79 vs 0.71); and the **cap stabilises** the policy (rolled robustness **0.50 uncapped → 0.79 capped**) |
| F-56 | L19's construction thread: does a hold-N cadence or a non-equal two-scale mix beat the F-46 50/50 blend, without fitting a λ? (L19; tests F-45/F-46) | **SUPPORTED — the mix is null, the cadence adds (fee-driven)** | no fixed non-equal mix beats equal capital (0.76/0.77/0.74/0.69 vs **0.77**), and a **no-hindsight** inverse-vol mix picks `w = 0.51` (OOS **1.18** vs the blend's **1.19**) → 50/50 is vol-optimal, not arbitrary; a **hold-6** cadence on the blend lifts net@4 **0.77 → 0.87** while **gross falls** 1.18 → 1.03 — turnover 254 → **93×/yr** pays for the staleness (break-even 11.33 → **27.03 bps**, positive every year 2022–26); hold-3 **0.82** and hold-9 **0.83** (loses 2024) define a **1–3 day plateau** (hold-6 is the grid max, so +0.10 is an upper bound); a **lab-internal bug** (blend averaged without renormalising → 0.70/10.75/220) was fixed and pinned by a second guard (must reproduce F-46's 0.77/11.33/254). **Cadence scoped down by F-57**: a fine grid shows hold-6 is a spike, not a plateau |
| F-57 | does F-56's hold-6 gain survive a fine grid and a drift-aware backtest? (L19; tests F-56) | **MIXED — the drift caveat does not bite; the cadence gain is a spike** | a true-hold simulation (drift between updates) gives turnover **within 2×/yr** of the lab's target-change measure at every N and a slightly **higher** net@4 (hold-6 **0.94**) → `turnoverSeries` is not optimistic; but the fine grid (N=1…36) is **jagged** and hold-6 is an **isolated spike** (**+0.10** over neighbours 5/7) — only **4 of 15** holds beat daily by ≥ 0.05, non-contiguously (2/3/6/9) → `gridRobust` **false**; the short-hold region (2–9) averages **0.80** vs 0.77 daily and the long region (10–24) collapses to **0.60** → the honest result is **"hold ≤ ~3 days (254 → 73×/yr) is no worse, but no specific cadence reliably adds"** |
| F-58 | what is the OI sleeve's right cost tool — a hold cadence or a no-trade band? (L19; tests F-56/F-57) | **SUPPORTED — the band is better (smooth plateau)** | the F-52/F-53 **no-trade band** at `eps = 0.03` reads net@4 **0.92** at turnover **198×/yr** (break-even **15.22 bps**, **positive every year 2022–26**) — above hold-6's 0.87 and the daily 0.77 — and is a **plateau** (3 sweep points within 0.05 of the peak, neighbours close) with **no interior re-rise** (`bandReRisers` **0** vs hold-N's **1**); at matched turnover it wins **7 of 18** sweep points (all at turnover ≈ 173–200+), and the cadence's residual low-turnover edge is exactly its fine-grid spikes (F-57) → the OI sleeve is **50/50 + band (eps ≈ 0.03)**, and the band is the lab's **general** cost tool (R8 stacks with the cap, R7 alone, OI alone) |
| F-59 | is F-58's OI band robust out of sample, and is its eps stable? (L19; tests F-58) | **MIXED — band>cadence OOS (11/11); the eps needs ≥ ~2.3 y** | on an 11-split dense grid the **frozen-eps** band beats the **frozen-N** hold at **11/11** and the **fixed** `eps = 0.03` beats both the daily blend and fixed `hold-6` at **every** split → F-58 is not a full-sample artefact; **but** the trailing `eps` pick takes 4 values, with short windows (S=1460/1825/2190) picking the **largest** eps (`0.1`) and underperforming fixed 0.03 OOS (1.03–1.22 vs 1.40–1.65); from **S ≥ 2555** picks collapse to {0.025,0.03,0.04} and from **S ≥ 3650** to `0.03` alone → pre-registered stability bar **fails overall**, **passes late** — the **~2.3 y** boundary of F-49/F-55, now for the band |
| F-60 | can one module reproduce all three sleeves' books? (L12 × L18 × L19; packages F-27/F-50/F-52/F-53/F-54/F-58/F-59) | **SUPPORTED — the port artefact passes 5/5** | `prototypes/port.js` (`clipWeights` + `bandWeights` + `cleanBook` = cap-then-band) reproduces every stored book across R8/R7/OI: R8 cap **6.18 / 10× / 46.04** = `e30`, R8 matched band **5.05 / 10×** = F-52, R8 cap+band **6.31 / 7×** = F-52's stack (6.36 / 6×), R7 cap **1.07 / 8× / 182.59** = `e32`, OI band **0.92 / 198× / 15.22** = `e50` → the shared chain is **one signal-agnostic module** (with `SLEEVE_SPECS` + `MIN_TRAIN_PERIODS = 2555` encoding the final recipes and the ~2.3 y rule), so the port is executable, not prose |
| F-61 | does the shipped carry grid join (`carryOnBarGrid`) handle sub-8h funding? (L10; settles the pre-registered FOLD-BACK R4(b)) | **SUPPORTED — a shipped-path defect (silent, fails safe)** | the module's comment says it "divides by the period actually observed", but the code divides every funding row by `round(8h / firstBarStep)` → synthetic 8h/4h/2h/1h funding returns **1 rate per 8h at every interval** (**1×/2×/4×/8×** understatement); the only shipped sub-8h symbol (SOLUSDT: 3 × 4h + **98 × 2h** steps, FTX 2022-11-09→18) is **not flagged** by `auditFundingProblems` (**[]**, 1.47 % < the 2 % budget); the FTX window receipts **−0.107** vs **−0.324** (**3.03×**) and the pooled 8h sleeve reads ann **9.985 %→9.531 %**, Sharpe **11.96→9.60** (the bug *flatters* the sleeve); a single-pair `barsPerPeriod` inference is a **latent** 2× (L10-ab); the lab's bucket-sum loader is unaffected and now pinned by `e14#sub_8h_sleeve_equality` |
| F-62 | does the dependence/DSR backbone (`dependenceSummary` → `effectiveBars` → `backtestMetrics`) mean what it says? (L10; settles L10-f/L10-i) | **SUPPORTED — unbiased but low-precision; `effectiveBars` unbounded** | ensemble means match the closed forms `1+(K−1)ρ` / `K` / `1+ρ` / 1 within 2.5 SE (**max gap 0.318**, 0 biased rows) — so F-02's DE 4.92 is the estimand it claims; but a true DE = 1 reads sd **0.243** (p05–p95 **0.644–1.452**) at C = 36 folds → 0.097 at C = 288 (−36 %/+45 %, so a two-decimal DE overstates resolution ~10×); a hedged pair gives DE **4.7e−32** and `effectiveBars = n/DE ≈ 3.4e34` with `adjustmentNeeded === false` (**L10-ae**: DE is a squared ratio, so the `> 0` guard is not a bound); the DSR path **declines** the explosion (`2 ≤ effectiveBars < n`) → **L10-i intended**, not a defect |
| F-63 | does the split family purge and embargo as claimed? (L10; new L10-af/L10-ag) | **SUPPORTED — the purged variants hold; the walk-forward does not purge** | `purgedKFoldSplit`/`combinatorialPurgedSplit` are leak-free on every fold across the grids (0 overlap pairs; embargo honoured; CPCV multiplicity `C(k−1,m−1)`), but `walkForwardSplit` leaks exactly **`H(H−1)/2`** label-overlap edges per fold for label horizon **H > 1** (H=5 → 10/fold, 120 edges at testSize 40; 0 at H=1), carries **no** purge metadata, ignores `labels`/`labelSpan`/`embargo`, and passes the `isCausalFold` guard (index-order only); an index-lookup model recovers test returns in the leak zone (**+0.0035**/bar, se 0.00007, vs 0.0000 clean / +0.0001 purged); the lab scores span-1 signals so no lab number moves; the shipped controller's labels *do* overlap but the leak is **LATENT** (CYCLE-047: it trains online, fit stops at `testStart−1`, labels realised at exit — no training label can depend on a test return) → **FOLD-BACK R9 (latent, low-priority)** |
| F-64 | does `analysis/labels.js` (triple barrier / CUSUM / fractional diff) mean what it says? (L10; new L10-ai…L10-ap) | **SUPPORTED — validation + audit; five warts, all latent** | the contracts hold exactly (first crossing = `ceil(level/step)` on **192** monotone cases; the three-way `ret` inequality + first-crossing + timeout index on **60** random paths; CUSUM = an independent drawup reference on **160/160**; weights = `(−1)^k C(d,k)` for integer `d` (1e−12) and vs Lanczos-`Γ` for non-integer (**2.3e−14**); the shipped `fracDiffAt` = the convolution exactly); **warts (latent, test-only exports)**: the `pt`-before-`sl` tie-break is unreachable for `vol > 0` (`0/6` bars) and degenerate at `vol ≤ 0` (`vol=0` → 3/6, a flat series labels 11/12 events **+1 at `ret=0`**); the default event set emits a **zero-horizon** `{t1=event, label 0, ret 0}` bet; `cusumFilter` **ignores its `events` argument** and its `lastEmit` guard is **dead**; the "`size <= 0` uses `DEFAULT_FD_WINDOW`" docstring is false (auto widths **1/2/3/4** for `d = 0/1/2/3`); the candidate "`d=0` → width 2 / NaN at 0" is **false** (`d=0` → `[1]`, exact identity) — it belongs to `d=1`; only **1 of 6** exports is shipped (`fractionalDiffWeights` via `features.js`), and it uses `window 16` where the module's own rule is **100** (k≥16 carries **6.27 %** of `|w|` mass) |
| F-65 | does `analysis/overfitting.js` (PBO / CSCV) mean what it says — and is its calibration figure a measurement? (L10; new L10-aq…L10-av) | **SUPPORTED — structure validated; the calibration is one draw; five latent rows** | exact: `cscvBlocks` partition (7/7), `cscvSplit` = `C(S,S/2)` splits with block multiplicity `C(S−1,S/2−1)` and complement closure, the cap (**705432 throws / 184756 passes**), `relativeRank` (best `N/(N+1)`, worst `1/(N+1)`, ties), `oosOnIsRegression` vs an independent sum-formula OLS (40 vectors, 1e−9), and constructed PBOs (all-flat **1**, one dominant **0**, anti-persistent pair **1**, a hand-computed metric-override **0.5/1.0**); the repo's quoted draw reproduces **exactly — 117/252 = 0.46429** — but the ensemble (60 matrices) centres at **0.4769** with **sd 0.2546** (p05–p95 **0.099–0.885**) vs a binomial split SE of **0.0315** → **design effect 65.4, ≈3.9 effective splits**; rows: `relativeRank` divides by the full `n` while skipping NaN (**omega 0.60 vs 0.75**, biases PBO up — **L10-aq**); a **fully-tied** roster is forced to PBO **exactly 1** while partial duplication does **not** bias it (**0.5806→0.5401**, 6/10 — guess falsified — **L10-ar**); `degradation`'s pooled `n = N·splits = 2016` vs **80** block performances → a naive t exceeds 1.96 on **91.2 %** of skill-less matrices (**L10-as**); **L10-at** (252 splits ≈ 4); `cscvBlocks(6,6)` alone gives **1-observation** blocks (**L10-au**); no shipped importer (**L10-av**) |
| F-66 | does `analysis/reality_check.js` (the resampling hub) mean what it says? (L10; new L10-aw…L10-az) | **SUPPORTED — the shipped primitives are exact; the selector does not reproduce its documented reference; three latent rows** | exact: `stationaryBlockIndices` at `b = 1` is byte-equal to an independent hand replay and is i.i.d.-with-replacement, its restart law is geometric (`≈1/b`, mean run `≈b`), `neweyWestSE` matches an **independent Bartlett** implementation (24 windows, 1e−12), RC = `sqrt(T)·max mean` (constant benchmark shifts it `−sqrt(T)·b`), SPA = `max(0,max fbar/ω)` (independent recompute), `A_k = ω_k·sqrt(2 log log T)` exact, SPA_c = SPA when all valid, the step-down first step is **bit-equal** to the consistent SPA, and the subsampling family shares **one** reference (k-FWER k=1 == step-down first p == consistent SPA p), is deterministic and segment-aware; the arch reference vector reproduces (**13.635665 / 15.608940**) from an independently implemented NumPy stream; **L10-aw**: `politisWhiteBlockLength` returns exactly **0** when `g ≤ 0` while the referenced `arch._single_optimal_block` squares `g` → **198/200** AR(−0.5) draws diverge (repo 0 vs arch e.g. **22.0**), so `autoBlockLength` floors to **1 (i.i.d.)** on 99/100 (the comment's \"reproduces arch to floating-point precision\" is false for `g ≤ 0`); **L10-ax**: the `median` reduction is the **upper** median on even `K` (4.84761 vs 4.25907); **L10-ay**: the `neweyWestSE` `v < 0` clamp is **unreachable** (Bartlett PSD; min taper exactly 0); **L10-az**: the block-bootstrap family is **test-only** (shipped: `stationaryBlockIndices` via `forecast.js`, `neweyWestSE`+subsampling via `walkforward.js`); calibration re-measured — subsampling size **0.040/0.045/0.045/0.030** across φ vs block bootstrap **0.090/0.105/0.180/0.385** |
| F-67 | does `analysis/forecast.js` (Brier / Murphy / Diebold-Mariano / MCS) mean what it says? (L10; new L10-ba…L10-bf) | **SUPPORTED — the scoring arithmetic is exact against the repo's own second Murphy implementation; a false docstring identity, a count-only alignment guard, and an off-target benchmark-grouping branch** | exact: `forecastPairs` IS the inverse of `confidenceFromProb` (1e−12) + next-bar sign + fold-last-bar drop + non-finite skip; `brierBinIndex`/`brierScore`/`logScore` are the closed forms with the documented clip/NaN handling; the Murphy partition satisfies `brierBinned = REL − RES + UNC` (1e−17); **`observer/legion_metrics.js`'s independent second `brierDecomposition` agrees on REL/RES/UNC/Brier to 1e−12** and its explicit `within` equals forecast's gap to 1e−17; `bootstrapMeans` is deterministic (`max(1,floor(cbrt(T)))`, one paired index draw, reports its block); the DM statistic is exactly `dbar/boot-SE`, degenerate arms exact (zero → 0/1/null, constant positive → Infinity/0), i.i.d. size **0.0525/0.1075**, block bootstrap controls φ=0.5 size (**0.095** vs **0.135** at b=1); the MCS eliminates a uniformly worse arm, keeps an identical pair, **always contains the sample-best** (4×200), is deterministic/monotone and covers **0.880/0.855/0.865/0.925**; **L10-ba**: the comment's "the gap IS the within-bin forecast variance" is **false** — exact `gap = WITHIN = withinVar − 2·withinCov`, negative on **5/6** configs while `withinVar > 0`, wrong by up to **0.13**; **L10-bb**: the alignment guard checks bar **counts**, so a count-coincident misalignment is accepted and the DM verdict **flips in 6/6** witnesses; **L10-bd**: `groupOf` maps `benchmark` to the **baseline's** kind → with a `'signal'` baseline a calibrated-probability benchmark joins the z-score group and gets a DM test (contradicts the reader; unreachable from `analyze.js`, untested); **L10-be**: the MCS elimination denominator is `sd(L_i)`, not HLN's `sd(d_i)` (up to **77×** apart, **0/150** set or order changes); **L10-bc**: `bootstrapMeans` silently NaNs on unequal-length series and the MCS returns `available:true` for a NaN-containing loss series (latent, export-level) |
| F-68 | does `analysis/race.js` (successive halving) mean what it says? (L10; new L10-bg…L10-bk) | **SUPPORTED — the closed forms and engine contracts are exact; the "decided set" claim is a tautology on the fixture and false on a budget-dependent evaluator; the race can out-spend the grid** | exact: `halvingRounds` = `max(1, floor(log(max/min)/log(eta))+1)` on 6 grids + 4 guards → 0; `halvingSchedule`'s `keep = max(1,ceil(survivors/eta))` on 5 grids (100 arms), monotone budgets, top rung `= maxBudget` when all rounds run, early stop; `successiveHalving` full-rung arm order, `nonFinite` elimination, `maximize:false` (winner `a8`), determinism/sync+async/stable ties, 6-grid cost reconstruction, guards, `formatRace`; **L10-bg**: the §AM fixture's `evaluate = q ± 0.05/budget` has a budget-**independent** ranking (`rank(1)==rank(9)`), so "winner == full-grid oracle" is a **tautology** (and the top rung 3 < the oracle's budget 9); on a budget-dependent evaluator the race disagrees with the top-budget argmax on **0.617/0.617/0.700/0.625** (120 reps); **L10-bh**: `spentBudget > gridBudget` (ratios **1.056** (9,2,2), **1.222** (9,3,2), **1.000** (16,2,2)/(100,2,2), **2.890** (100,10,1.1)); **L10-bi**: small-`eta` integer rounding repeats rungs (η=1.1,B=10,100 arms → **15** repeated consecutive budgets / 25 rungs, ratio 2.89); **L10-bj**: `successiveHalving` doesn't validate `eta`/`minBudget` → η=1/0.5/0, `minBudget>maxBudget` all return `available:true`/`winner:null`/0 evaluations; **L10-bk**: engine-only/test-only |
| F-69 | does `analysis/benchmark.js` (the P1 model-class benchmark) mean what it says? (L10; new L10-bl…L10-bo) | **SUPPORTED — the documented contracts are exact; the ridge arm's probability is anchored at 0.5 (its training base rate is computed and never restored), the sigmoid caps its skill, and the "hand solve" claim is untested** | exact: standardiser (zero-mean/unit-std; constant column → `std 1e-8`, `z 0`; empty → `d 0`); `fitRidge` matches an **independently solved** centred ridge to **0**; intercept unpenalised; `predictRidge` ∈ (0,1); `fitBaseRate` = prior (empty → 0.5); ridge+MLP > 0.8 accuracy on the separable fixture; MLP byte-deterministic per seed; `BENCHMARK_KINDS` exact + `tsfm`/unknown kind throw; a perfect classifier beats the base rate (**0.1425** vs 0.2500); **L10-bl**: `fitRidge` centres the target on `ybar` and `predictRidge` **never restores it** → a constant-`y` fold reads exactly **0.5**, a **0.833**-base-rate fold reads mean **0.50** (Brier **0.22475** vs **0.13533** with `ybar` restored; the shipped test is accuracy-only, a 0.5 threshold — cannot fail); **L10-bm**: sigmoid over a least-squares fit of a bounded [0,1] label confines the arm to `sigmoid([−1,1]) ≈ [0.27,0.73]` (perfect feature → Brier **0.1425** floor; constant-y MLP → **0.99**); **L10-bn**: the LOCKED/lock-registry "ridge closed form matches a hand-computed solve" is **unverified** (the 5 shipped §P1 checks assert accuracy/determinism/standardiser/factory/grouping only; the closed form IS exact); **L10-bo**: the eps constant-column fallback maps a one-unit train→test deviation to `z = 1e8` (latent) |
| F-70 | does the measurement layer (`analysis/backtest.js` + its instrument `analysis/performance.js`) mean what it says? (L10; new L10-bp…L10-br) | **SUPPORTED — both halves validated against independent references; the hit rate's exclusion is unimplementable as documented and counts exit costs as misses, the fold scorer re-lags inside the test slice, and a probe's negative-MinTRL lead is disproved** | exact: `erf` max err **1.393e-7** vs Simpson quadrature (< 1.5e-7), `normalCdf(0) = 0.5` exactly and odd; `normalInvCdf` round-trips **2.46e-10** vs a Lentz-erfc reference (< 1.15e-9), antisymmetric to 2.8e-14; moments exact (`kurtosis([1..5]) = 1.7`, `stdSample = √2.5`); Lo SE = `√(1.5/99)`; PSR = **exactly 0.5** at its benchmark; DSR = PSR at the hurdle (**1e-15**), DSR ≤ PSR, `expectedMaxSharpe` vs an independent inverse (5.1e-11), ∝ √V and monotone in trials; MinTRL = **13.1749455166** (documented vector 13.174945; independent recompute 13.17494554); bootstrap size **0.059/0.110**, mean p **0.502** over 1000 noise series (repo claim 0.058); positions/turnover/gross/cost/net/equity/drawdown/tradeCount/break-even all recomputed exactly; `poolFolds` restates the per-fold sums; `purgedCVBacktestAsync` byte-identical to serial; **L10-bq**: `hitRate` receives only returns (its "no position" exclusion is unimplementable) and skips `r === 0`, so a zero-return in-market bar is dropped (**0.6667** vs 0.5) and an exit-cost flat bar counts as a **miss** (**0.5** vs 1.0 on a perfectly-timed 3-round-trip book at 10 bps) — the shipped check's flat bars *are* its zero-return bars, so it cannot discriminate; **L10-br**: `scoreFold` re-lags inside the slice (`pos[0] = 0`; CPCV bar 30 holds `signals[12] = +1` not `signals[29] = −1`, pooled **+0.05** vs **−0.05**), contradicting the module's own one-bar rule on the fixed-signal path (3/64 bars differ on a 4-fold split; latent); **L10-bp**: the negative-MinTRL lead is **DISPROVED** (Pearson `kurt ≥ skew² + 1` ⇒ `v ≥ (1 − skew·SR/2)² ≥ 0`; 60 000-histogram search bottoms at `v = −2.4e-15`, 20 000 random series violate nothing, MinTRL from measured moments ≥ **2.17**), leaving the real residual that a **NaN** sharpe yields Infinity and is labelled `beyond-horizon` instead of `unavailable` |
| F-71 | does the causal signal family (`analysis/features.js`) mean what it says? (L10; new L10-bs…L10-bv; L10-e settled) | **SUPPORTED — the causality and abstain contracts hold exactly for all 16 candidates and every reference is exact to 1e-12; four latent/export-level defects** | causality exact: 0 mismatches over 16x100 bars under a strict-future perturbation (non-vacuous: all 100 bars non-zero, 77-79 later bars moved); returns-only view abstains on exactly the 5 channel-dependent candidates; degenerate series stay finite in [-1,1]; `clampPosition` exact; 13 single-feature references exact to 1e-12 (`momentum, fracDiffAt, fracMomentum, volRegime, momentumAgreement, rangeLocation, volumeImbalance, autocorr1, acceleration, reversal, reversalWindow, reversalVol, volScaledMomentum, blendedMomentum`) and `fracDiffAt` = shipped `fractionalDiff(log closes, 0.4, 16)`; cross-section + regime gate = ref; **L10-e SETTLED** (`{close}` singular -> `rangeLocation` NaN, `positionAt` 0; `{closes}` -> 0.0211625225); **L10-bs**: the `std is 0` abstain guard is defeated by rounding - an exactly-constant window yields `|z| = sqrt((n-1)/n)` (**-0.9682458366** n=16, **-0.9842509843** n=32, **-0.9746794345** n=20) instead of 0, a **0.468-0.492** position at saturation 2 from an information-free feature (the guard fires only where the mean is bit-exact, e.g. n=8 and 32 on 0.001, and the shipped 0.03125 fixture); **L10-bt**: `finiteSum` on an empty range returns **0** where `meanOf` returns **NaN** (`momentum`/`acceleration` `{window:0}` = 0 vs `volRegime`/`reversalWindow`/`volumeImbalance` = NaN); **L10-bu**: `networkMomentum` self-skip `i === panel.streamIndex` never matches when `streamIndex` is absent, folding the stream own lagged momentum in (**-0.9066812992** with `streamIndex` vs **-1.8820447956** without); **L10-bv**: `regimeGatedMomentum` scales the gate by the MOMENTUM window variance, not the gate window, (**-0.0806448623** vs **-0.0922736938**, ratio **1.309**), so the opt-in crash gate is too loose when the windows differ |
| F-72 | does sample uniqueness (`analysis/uniqueness.js`) mean what it says? (L10; new L10-bx…L10-bz) | **SUPPORTED — the average uniqueness + ESS identities are exact and the shipped `overlapUniqueness` matches bit-for-bit; the sequential bootstrap is length-biased (sum not average) and is not the cited AFML algorithm** | exact: `sampleUniqueness` = an independent per-bar scan-all-spans recompute to 1e-12 (`[[0,2],[1,3]]` -> **2/3, 2/3**; `[[0,0],[0,5]]` -> **1/2, 11/12**) and = the shipped `hivemind/training/sample_weights.js#overlapUniqueness` to **exactly 0** (8 fixtures); per-label order-invariant; ESS(point)=**n**, `ESS = sum`, `averageUniqueness = ESS/n`, `ESS <= n` (6 overlapping -> **5.5833**), empty -> []/NaN/0; `sequentialBootstrap` is deterministic per seed, in range, defaults size to n, [] on empty; **L10-bx**: the draw weight is the uniqueness **SUM** (`avgU[i]=acc`), not the average, so two NON-overlapping labels (both average uniqueness **1.0**) are drawn in the ratio of their lengths — measured first-draw P(3-bar) **0.7480** vs the intended **0.5000** (module law 0.75), and a 1/2/3-length fixture reads **0.1688/0.3299/0.5014** vs 1/3 each; **L10-by**: the module is not the AFML ch.4 sequential bootstrap it cites (static numerator + `1/(1+count)`) — on `[[0,1],[0,1],[2,3],[2,3]]` the second-draw law is **1/7,2/7,2/7,2/7** vs AFML **1/6,1/6,1/3,1/3** (TV gap **0.1190**); **L10-bz**: spans are unvalidated (zero-length -> NaN, poisoning the ESS; negative-length -> -0). All test-only/latent |
| F-73 | does the stream design layer (`analysis/streams.js`) mean what it says? (L10; new L10-ca…L10-cb) | **SUPPORTED — the resampler, the Kish design-effect identities and the greedy selector are exact against independent references; a constant stream is counted as a full unit of effective breadth, and `maxStreams <= 0` means unlimited** | exact: `resampleCandles` = a hand recompute to 1e-12 (factors 2/3/4/7 x keepIncomplete) with all OHLCV invariants (open first, close last, high max, low min, volume sum, timestamp first), never mutates, factor 1 = shallow copy, drops a trailing partial group unless kept (10/4 -> 2 vs 3; 3/4 -> 0 vs 1), rejects a bad factor/non-array, and honours the non-finite fallbacks (missing high/low -> max/min(open,close); missing volume = 1); `designEffectOfStreams` satisfies every Kish identity (`rawBars = K*T`, `DE = 1+(K-1)*rbar`, `effectiveBars = rawBars/DE`, `effectiveStreams = K/DE`, `effectiveBarsPerBar = 1/DE`), reports K=1 as the trivial panel, identical streams as one bet (rbar **1**, DE **2**/**3**, effectiveStreams **1**), aligns on T = min length (240/120 -> T 120), chooses `fold-sharpe` iff the fold tiles T (rbar 0.2657996327 = an independent segmentation) and abstains on the degenerates; `selectStreams` is deterministic, tie-breaks by label (redundant pool -> `['x']`), monotone, computes marginalBars/marginalEfficiency exactly, and honours a positive maxStreams; **L10-ca**: a zero-variance stream is skipped from `rbar` but still counted in K and `rawBars = K*T` — adding one constant stream leaves rbar **bit-identical** (−0.0133166822) yet takes effectiveStreams **2.0270 -> 3.0821** and rawBars 480 -> 720 (while `selectStreams` DOES skip it, so the two functions disagree); **L10-cb**: `maxStreams <= 0` is treated as UNLIMITED (0 and -3 both select `['a','b']`). Diagnostic-layer/latent |
| F-74 | does the audited evaluation world (`analysis/world.js`) mean what it says? (L10; new L10-cc…L10-cd) | **SUPPORTED — the shock, the candle view and the alignment are exact against their documented contracts; a missing `streamIndex` makes the cross-sectional look-ahead audit vacuous, and `maxBars <= 0` flips the slice** | exact: `shockFactor`/`volumeShockFactor` are **1** at and before `after` and strictly inside `[1, 1+2*probe]` after (probe 0.07 -> max 1.14), deterministic, non-uniform and phase-shifted (t=after+2: price 1.0494 vs volume 1.1369; probe 0 -> no-op); `shockCandles(null)` is the same array, every bar <= after is the SAME object, every bar > after a new one with OHLC x f(t) and volume x fv(t), the input is never mutated, it is deterministic, the path stays positive and the SHAPE changes (close ratio 1.0001-1.0993); `makeCandleViewFor` returns the real candles on the base pass (`returns = barReturns(closes)`, a caller returns array used verbatim) and on a probe pass a self-consistent tuple (`view.returns === barReturns(view.closes)` exactly) with the past bit-unchanged and all 19/19 future bars moved; `worldFromCandles` aligns candles/closes/volumes/returns and keeps the last `maxBars`; **L10-cc**: `panelFor` replaces the own-stream slot only when `panel.streamIndex` matches an index — with `streamIndex` absent (or out of range) EVERY slot stays the unperturbed original while `view.returns` is shocked, so a cross-sectional candidate (`sig-reversal-xs`, `sig-network-momentum`) reads its own unshocked series and the look-ahead audit is **vacuous** (the exact trap world.js exists to close; same root cause as L10-bu, opposite consequence); **L10-cd**: `worldFromCandles`' maxBars guard: 0 -> **all 30** bars (falsy), -5 -> **25** via `slice(5)` (drops the FIRST 5 — the sign flip), 7.5 -> 7 (silent truncation), reachable from `--bars`. Latent; no fold-back row |
| F-75 | does the order-preserving scheduler (`analysis/parallel.js`) mean what it says? (L10; new L10-ce…L10-cf) | **SUPPORTED — the queue contract, the failure semantics and the reply adaptation are exact; `normaliseConcurrency` never validates its `max`, and the fold executor silently nulls a malformed `confidence`** | exact: `normaliseConcurrency` maps every non-finite/non-positive width to serial 1 (0, -3, NaN, Infinity, null, undefined, `3`, true, false, 0.5, 1) and floors/caps the rest (2.9 -> 2; 1e6 -> 64); `scheduleUnits` returns results in UNIT ORDER under an out-of-order completion schedule (finish order 2,1,0,5,4,3,6,8,7,9), calls exec exactly once per unit, peaks at exactly the requested concurrency (3; and n when the request exceeds n), reports through `onResult` out of order with a throwing reporter harmless; a rejection rejects with the FIRST error (two failures -> e0), starts no unit past the start window and settles every started exec (`settled === started`, no dangling promise); a synchronous throw propagates; empty -> []; and `makeFoldExecutor` maps `{positions, confidence, stats}` to `{signals, confidence, stats}`, passes the request through verbatim and throws a named malformed-reply for a null/undefined reply or a non-array `positions` (incl. a Float32Array); **L10-ce**: `normaliseConcurrency` never validates its `max` cap — `{max: 0}` -> **0**, `{max: -2}` -> **-2**, `{max: 2.5}` -> **2.5** (a non-positive/fractional "concurrency"; not reachable via `scheduleUnits`, which passes max = n >= 1); **L10-cf**: `makeFoldExecutor` throws on a bad `positions` but SILENTLY nulls a non-array `confidence` (5, Float32Array) and any falsy `stats` (0, missing) — a worker switching to a typed-array confidence would silently lose the R26-3 raw pre-policy confidence. Latent; no fold-back row |
| F-76 | does the turnover policy grid (`analysis/holding.js`) mean what it says? (L10; new L10-cg…L10-ci) | **SUPPORTED — the grid, the restatement surfacing, the ordering/`byId` readout and the formatter are exact; `costBps` is dead, the audit hurdle is unreachable, and the default grid is only shallowly frozen** | exact: the grid is `deadZones × scales × holdings` (3×1×3 -> `policies` 9, `rows` 18 for two candidates), each policy `{...holding, deadZone, scale}` (a null holding collapses; `enter`/`exit`/`minHold` survive); every row's `turnover`/`grossPnl`/`netSharpe`/`breakEvenCostBps` equals a direct `restateReportAtPolicy(candidate, policy)` recompute to **1e-9**; rows are non-increasing in break-even with a missing value last; `byId.best` is the highest-break-even row, `bestPromoting` the highest-break-even promoting row (`null` when none promotes), `bestTurnoverPolicy` prefers promoting and returns null for an unknown id; the two bail-outs (no baseline/candidate fold inputs) return `available:false` with a reason; `formatTurnoverSweep` renders the unavailable reason and, when available, every id plus the target; **L10-cg**: `turnoverSweep` accepts and echoes `costBps` but never threads it into `restateReportAtPolicy`, so every net Sharpe and promotion decision is at ZERO cost — `{costBps: 0}` and `{costBps: 25}` rows are byte-identical apart from the echo (both netSharpe **0.6864950785702724** at dz 0.1) while a direct restatement at 25 bps reads **−3.156645069841796** (the shipped caller passes `--cost-bps`); **L10-ch**: the `requireCleanAudit` hurdle the caller passes is structurally inapplicable because `restateReportAtPolicy` drops the `audit` block (unlike `restateReportAtCost`), so a candidate that FAILED the look-ahead audit still promotes (row `promote: true`; rebuilt with the audit attached it correctly fails, reason `candidate failed the lookahead audit (1 violations)`); **L10-ci**: `DEFAULT_TURNOVER_GRID` is only SHALLOWLY frozen (`Object.isFrozen(deadZones)` false) — `deadZones.push(0.9)` takes the default sweep 48 -> 54 policies. All latent/report-level; no fold-back row |
| F-77 | does the seed-replication layer (`analysis/replication.js`) mean what it says? (L10; new L10-cj…L10-ck) | **SUPPORTED — the IQM contract, the stratified bootstrap, the variance decomposition and the CRN criterion are exact; the "IQM" is not the cited Agarwal estimator, and the formatter can mislabel its CI** | exact: `interquartileMean` is the rank-slice middle on every hand case (`[1,2,3,4]` -> **2.5**, `[1..8]` -> **4.5**), `[]` -> NaN, `<4` -> plain mean, non-finite filtered, monotone; `stratifiedBootstrapCI` is deterministic per seed, seed-sensitive, preserves each stratum size in every replicate (probe statistic = sample length == 12 for strata [4,5,3]), `lo <= median <= hi`, and abstains on empty/all-non-finite; its empirical coverage of a known mean is **0.92** (400 panels, nominal 0.95); `varianceComponents` satisfies `total = between + within + residual` (1e-9) with fractions summing to 1 in the pure-between (seedFraction **1**), pure-within (foldFraction **1**), repeated-cell (residualFraction **1**) and mixed (0.02703/0.97297/0) panels, `totalVariance` = the population variance, `<2` obs abstains; `pairedVarianceRatio` = `var(paired)/var(unpaired)` with reduction = 1 - ratio exactly (ratio **0.000635**), abstaining on short / zero-unpaired-variance input and going negative when the pairing hurts; `seedDistribution` carries the documented fields; **L10-cj**: the IQM drops `floor(n/4)` by RANK, not a quarter of the MASS — witness `[0,0,5,10]` reads **2.5** vs the cited Agarwal/`rliable` quantile-filter **1.6667**, and **149/300** skewed panels differ (max gap **1.016**); **L10-ck**: `formatSeedReplication({ label, dist, alpha = 0.05 })` prints its OWN `alpha` in the CI label, never `dist.ci.alpha`, so a distribution built at `alpha = 0.10` is printed as **`95%CI`** (bounds the 90% ones). Both latent; no fold-back row |
| F-78 | does the cluster-inference module (`analysis/dependence.js`) mean what it says? (L10; new L10-cl…L10-cm) | **SUPPORTED — the correlations, the equicorrelation identities, the fold grouping, the jackknife, the Student-t tails and the exact sign test are all exact; the stability flag drops half its own rule and the sign test underflows** | exact: `pearsonCorrelation` = `Σdₐd_b/√(Σdₐ²Σd_b²)` with ±1 monotone and NaN guards (<3 points, zero variance, unequal length); `meanPairwiseCorrelation` averages the finite pairs (`[[1..4],[1..4],[4..1]]` -> -1/3); `equicorrelationDesignEffect` = `1+(K-1)rho` and effective size `K/deff` (K=1 -> 1; non-positive deff abstains); `foldWindowClusters([[1,2,3,4],[5,6,7,8]],2)` -> `[[1,2,5,6],[3,4,7,8]]` with throws on non-rectangular/non-divisible/bad-foldLength; `clusterJackknife` on `[[1,2],[3,4],[5,6]]` gives estimate **3.5**, leave-one-out **[4.5,3.5,2.5]**, se **1.1547005383792515**, abstaining on <2 clusters / non-finite statistic; `studentTPValue` reproduces the exact df=1 (Cauchy) and df=2 closed forms to 5e-7, t=0 -> 0.5/1, symmetric, twoSided = min(1,2*oneSided); `studentTCritical` reads **1.6895724578** / **2.0301079283** at df=35 (table 1.68957/2.03011) and round-trips to 1e-6; `signTest` matches an independent `Σ_{k>=wins} C(n,k)/2^n` to 1e-12 (7/10 -> **0.171875**), `signTestFloor(n) = 2^-n`; `pairedClusterTest`/`pairedClusterSignTest` carry the documented fields (per-cluster signs); **L10-cl**: `clusterStability.stable` omits the `worstDelta > minDelta` half of its documented rule — witness fractionPositive **0.6667**, worstDelta **-0.5**, `stable: true` (doc rule false) at minFraction 0.5, the two coinciding only at the shipped minFraction 1; **L10-cm**: `signTest`'s `pmf0 = 0.5^n` underflows for n >= ~1075, so `{wins:1000,n:2000}`, `{wins:1,n:2000}`, `{wins:2000,n:2000}` all read **pValue 0** while `{wins:500,n:1000}` reads 0.5126. Both latent; no fold-back row |
| F-79 | does the decision-grade report (`analysis/decision.js`) mean what it says? (L10; new L10-cn) | **SUPPORTED — `foldConcentration`, `confidencePersistence`, `nextRunPlan`/`pairedUnitsNeeded`, `promotionAcrossCadences` and the six-block `decisionReport`/`formatDecision` are exact; but `restateReportAtPolicy` carries a stale `foldInputs`** | exact: `foldConcentration` reproduces a direct `strategyReturns`+`sharpeRatio` recompute to 1e-12 (gross `[8,4,3,-1,-2,-3]`/total 9 -> top-K shares `8/9`,`15/9`,`9/9`; signed sums; delete-one-cluster full **-3.5204429235768973**, min **-5.253810564276818**, max **-1.6034020777212812** with the right worst/best index; every marginal = `full - leaveOut[i]`, mean **0.023595765513707272**; a non-positive gross total -> `topKs[].share` **null**) and abstains with explicit na on empty/mismatched/malformed input; `confidencePersistence` = the pooled within-fold lag-1 (**0.666707822740828**) and `ln 0.5/ln rho` half-life (**1.709771604681528**) to 1e-9 with no cross-fold pairs (two-fold `[1,1,1]`/`[-1,-1,-1]` -> pairs **4**, lag1 **1**), a constant-confidence note and `< 2`-pair abstention; `pairedUnitsNeeded` (via `nextRunPlan`) returns the smallest cluster count whose one-sided cluster-t resolves the target (**9** observed / **18** at 80 % power; brute-force agreement) with `reference.pairedMde95 = tCritical(35,0.05)*0.08 = 0.13516579662244632` and `seScale 'paired'`; `nextRunPlan` carries `designEffect 2.95`, `effectiveBars 244`, `mde95 0.5`, `underpowered` vs the 1.0 threshold, `barsToDetectDependent = ceil(620*2.95) = 1829`, `breakEvenBps 6.5`, `clearsBps {0:t,2:t,5:t,10:f}` and the timing/cadence blocks; all six `cheapestFlip` kinds (none/cost/stability/magnitude/gate/search) fire from their witnesses (magnitude quoting `tCritical(35,0.05)*0.08`); `promotionAcrossCadences` = majority-pass (2/1 -> promote) with a strict-majority tie failing, plus the `defaultCatastrophic` veto (negative netSharpe, or a look-ahead-audit reason); `decisionReport` = `schema 'nl.decision.v1'` with the six blocks, referent/run label policies and explicit-na family blocks, and `formatDecision` renders them; **L10-cn**: `restateReportAtPolicy` replaces `folds` with restated-position metrics but carries the original `foldInputs`, so a POLICY-restated report handed to `foldConcentration` mixes bases — gross half from the restated positions vs Sharpe half from the original signals (restated netSharpe **-5.201698358740081** vs carried-signal Sharpe **-3.5204429235768973**); the shipped `--decision` path restates at COST only (same signals/cost, both halves agree at **-3.877740023296727**), so it is latent/export-level (reached only by chaining a policy/cadence restatement into `foldConcentration`). Latent; no golden moves and no fold-back row |
| F-80 | do the hivemind numeric kernels (`hivemind/kernels/*`) mean what they say? (L10; new L10-co…L10-cr) | **SUPPORTED — the finite path is exact for all five kernel bags; but a non-finite guard kills the `+∞` activation, a `|| 1` family replaces a legitimate zero, and the vector helpers disagree on a length mismatch** | exact (finite path): `_silu`/`_siluDerivative` = `x·σ(x)`/`σ(x)(1+x(1−σ(x)))` to 1e-12, `_sigmoid` = `1/(1+e^−x)` to 1e-15 and monotone, `_softmax` = `exp(a−max)/Σ` summing to 1 with the uniform-on-non-finite / `[]`-for-empty / `out` contracts; linalg dot/add/scale/sub/norm/cosine/weighted-mean/proj-similarity to 1e-9; `_rmsNorm` = `x/√(mean(x²)+1e-6)`, `_applyRoPE` the identity at pos 0 and the documented rotation at pos 1, `_normalizeSemantic` clamping the proto RMS to `1.8+2.2·protoCapacity`; `_randomNormal` Irwin-Hall(12) (mean≈0 var≈1), `_sampleDirichlet` summing to 1 (`[]` for `count<1`), unit-norm LSH hyperplanes; `_computeVariance` the documented MAD proxy (`[0,0,0,0,100]`→10), `_computeEMA`, `_computeGradientConformity` (0.75 monotone, floored 0.5), `_computePercentile` lower nearest-rank, `_computeSparseThreshold`∈[1e-6,1e-4], `_computeDynamicPercentile`∈[0.75,0.99], `_computeGradientNorm`=5, `_computeSpectralNorm(diag(3,1,1))`=3.0000, `_detectSuddenDrop`/`_isStagnating`; **L10-co**: `_sigmoid`/`_silu` return **0** for `+Infinity` (the `isFiniteNumber` guard runs before the `Math.min(Math.max(x,−100),100)` clamp, so `_sigmoid(+∞)=0`, `_silu(+∞)=0`, `_sigmoid(±100)`=1/3.7e-44 shows the clamp would have handled them; a maximally-positive logit reads as probability 0, and `isFiniteNumber` accepts numeric strings while `_softmax` uses `Number.isFinite`); **L10-cp**: the falsy-zero family — `_computeGradientNorm([0,0,0])`→**1**, `_computeGradientNorm([[0,0],[0,0]],true)`→**1**, `_computeSpectralNorm([[0,0],[0,0]])`→**1**, `_computePercentile([0,1,2],0)`→**1** (each a `\|\| 1` guard, feeding the `gradients.js` threshold pool a dead gradient as 1); **L10-cq**: the vector helpers disagree on a length mismatch — `_fastVectorDot` reads past the end → **NaN**, `_vectorDot` → **0**, `_fastVectorAdd` → a copy of `a` (silent); **L10-cr**: two dead clamps (`_computeDualEMA`'s `min(0.8,…)` unreachable since the raw value ∈ (0,0.5]; `_computeNTKStability`'s `max(−0.1,…)` unreachable since the argument ∈ (−0.05,0]) and `_computeFractalDimension` an ad-hoc clamped dispersion (a constant series reads the maximum 2), not a fractal dimension. All latent (non-finite/zero/degenerate-input edges; the golden suite pins finite-path numerics); no golden moves and no fold-back row |
| F-81 | does the REPO's V2 sleeve layer reproduce the lab's published books? (L10; new L10-ct) | **SUPPORTED — port verification; all three books bit-for-bit** | `e73_port_verify.js` (10/10 checks: the three books **plus** a 250-trial seeded differential fuzz of every ported primitive against the lab module it came from) rebuilds the lab's real carry panel, drives the repo `plugins/sleeves/*` through their `signal()`/`returns()`, and matches the lab rows **exactly** + the stored metrics: R8 `6.18 / 10× / 46.04` = `e30`, R7 `1.07 / 8× / 182.59` = `e32`, OI `0.92 / 198× / 15.22` = `e50`; the repo `cleanBook` is fingerprint-identical to `prototypes/port.js` (`cleanChainIdentical` true); **L10-ct**: the lab's two shells disagree about the book grid (`e17#buildBook` reads `legs.times.length` = 6558 → 6557 rows; `e21#xsBookImpl` is handed `times.length` = 6557 → 6556 rows), so the V2 primitives take the grid as an explicit `n`; read-only, no number moves, no fold-back row |
| F-32 | short-horizon reversal is a real gross cross-sectional edge and is unrescuable | **NEGATIVE as a trade / SUPPORTED as a gross edge** | per-stream break-evens **0.32–1.31 bps** (1h & 15m); book `rank_w2_rev` gross 0.583, placebo z 12.1, both halves +, but break-even **0.50 bps** and EWMA smoothing leaves it flat (0.43–0.56 bps) |
| F-33 | "the edge lives in SIGNS rather than magnitudes" (P3's stated justification) | NEGATIVE — documentation claim contradicted | IC of `−r[t]` **0.0133 / 0.0138** vs `−sign(r[t])` **0.0062 / 0.0094** (1h / 15m) |
| F-34 | a passive (maker) execution does not rescue the reversal family | NEGATIVE — L08 closed | passive fill friction **−0.6…−1.6 bps per fill** at every quote depth (identical for a seeded-random side); the maker book's gross Sharpe is **−0.002 (1h) / −0.271 (15m)** vs the taker's +0.415/+0.534 → the entire edge is consumed before any fee |
| F-35 | re-aim the learner at "will this rule's trade pay?" (meta-labelling, L06) | NEGATIVE — L06 closed | OOS Brier skill vs the causal base rate **≤ 0** for all three rules at 1h & 15m (−0.0003…−0.0013; the only positive is +0.002 at one GD iteration) while AUC ≈ **0.505–0.508**; the abstention overlay reaches a positive net@4 only by keeping **0.3–0.7 %** of bars (15m: even fewer, mostly still negative) |
| F-36 | decay on the two working sleeves (L12 carry dispersion, L18 toptrader fade) | **MIXED** — the dispersion book's net edge has decayed, the fade's has not | dispersion net@4 by year 2023 5.32 → 2025 **−0.01** → 2026 **−1.88** (net trend ρ −0.79, p 0.023) while its *gross* trend is flat (p 0.39) — the **break-even fell 10–29 → 2.9–3.4 bps**, below the 4 bps fee; the fade's last-12m net@4 is **+1.91** (trend p 0.68) and the 25 % mix is **+1.76** (p 0.47), so the mix survives on the fade's carry |
| F-37 | re-tuning the dispersion book for the decayed regime (L12, L16) | **SUPPORTED** — a slower policy repairs the cost margin, and a walk-forward selector reproduces it OOS | recent-24m: `ewma_0.01_norm` break-even **27.07 bps**, net@4 **+3.86** (9×/yr), net-positive **9/9** regimes; 7/16 policies clear 4 bps, monotone in slowness; walk-forward λ (blind to the future) nets **+5.71** OOS vs the pinned F-24 spec's **+2.76** (recent-24m +3.41 vs −0.53), 12/12 parameterisations; the **gross-blind** selector nets only **+0.28** — cost-awareness, not smoothing, is the mechanism |
| F-38 | sizing the retuned dispersion book (L15, L17) | **SUPPORTED** — usable size rises ~2.7×, and the binding limit switches to open interest | λ=0.1 spec is impact-bound at **$13.2 M** (DOGE ~1 % ADV); `ewma_0.01` has a diverging impact capacity and is **OI-bound at $19.2 M** (LINK); `ewma_0.02 + cap12.5 %` reaches **$35.9 M** at recent net@4 **+4.24** / break-even **15.97 bps** — a hold-like book's square-root capacity is fictional (λ=0.005 reads $4.0 B), so the OI bound is the honest limit |
| F-39 | R8 capstone: a joint (λ, cap) walk-forward spec, fee-stressed (L12/L15/L16/L17) | **SUPPORTED — port-ready** | joint walk-forward (blind to the future) nets **+6.13 OOS** vs the pinned F-24 spec's **+2.76** (recent-24m **+4.49** vs −0.53) on a 40-book grid; the same OOS series stays net-positive at **10 bps** (net@4 **+4.43**, recent-24m +3.12) — ~6× fee headroom; `λ=0.1 + cap12.5 %` is *still* broken (+1.93), so the slower λ repairs the margin and the cap is a capacity add |
| F-40 | does the F-37 slowness lesson transfer to the fade? (L18) | **MIXED** — no on λ/walk-forward, yes on the cap | the fade is not cost-fragile at any λ (recent-24m break-even **55 bps** at EWMA 0.1, ≥19 bps even at λ=0.5, vs the dispersion's pre-retune 3.7); the walk-forward is *worse* than pinning (+0.70 vs +0.94 OOS) because the fade's Sharpe ~0.8 makes trailing windows noise-dominated; the **12.5 % cap transfers** (OI bound **$37 M→$54 M**, net@4 +0.79→+1.00) |
| F-41 | the OI capacity bounds are ratios of means (L07/L15/L17/L18/L10) | **SUPPORTED — corrects F-28/F-38/F-40 sizes** | `f·mean(OI)/mean|w|` is an average-case bound; the true min-of-ratio is **2.6–8.8×** lower (dispersion spec $23.41 M → **$4.37 M**, fade $36.99 M → **$4.19 M**, +cap $53.84 M → **$12.62 M**); at the published sizes the books breach the 5 % cap in **65–77 %** of periods (peak **16–44 %** of LINK's OI); restated usable sizes (recent-24m p5, min-of-ratio) are **$10.2–21.9 M** vs the published **$19.2–53.8 M**; the 12.5 % cap is the fix (fade never-breach $4.19 M → $12.62 M) |
| F-42 | the OI capacity is a schedule, not a number (L07/L15/L17/L18/L10) | **SUPPORTED — sizing policy** | a constant **trailing-p5** size still breaches the 5 % cap in **2.7–3.7 %** of periods (peak 6–10 %); sizing to OI raises the mean deployable size **2.0–4.1×** ($11.2→$22.9 M R8; $10.9→$33.6 M R7) but the full-follow Sharpe falls (R8 5.02→3.26; fade DD 22.8→58.2 %); a **lagged (EWMA) size breaches 53–55 %** of periods and a shuffled size blows turnover 40–70× (Sharpe −0.7…−18.5); the compliant recipe is a **clip** at `f·min_j(OI/|w|)` (trailing-median target → $16.9/$19.3 M, zero breach, Sharpe 4.41/0.96) |
| F-82 | do the shipped signal/world guards mean what they say? (L10-bs/bt/bu/bv/cc/cd) | **SUPPORTED — six latent rows, all fixed at the repo layer** | `causalZScore` abstains below a scale-aware 1e-12 epsilon (exactly-constant window read |z| ~0.97 from denormal std); `finiteSum` empty is NaN (was 0); `networkMomentum` abstains without a valid `streamIndex` (was folding own momentum in); `regimeGatedMomentum` scales the crash gate by the gate-window variance (was the momentum window's, ratio 1.309 at 16 vs 32); `makeCandleViewFor` yields a null panel when unplaceable (was a half-shocked cross-section); `worldFromCandles` fail-closes on bad `maxBars` (0 is empty). Pinned by ten repo `analysis` checks (648 → 658); no golden moves; lab numbers unchanged |
| F-83 | can the gate tell beta from alpha, and can it score a book? (A2/G2) | **SUPPORTED — both primitives exact** | `firstPCWeights` is unit-length and recovers the [0.707,-0.707] anti-correlated factor; a 2x-beta series reads raw 0.43 / neutral 0 while an orthogonal alpha keeps 0.40; single-stream neutralises to 0 (no free breadth); residual-to-PC covariance ~0; `bookReturns` dots exactly (-0.0025/0), turnover sums (0.25), zero-cost net==gross, break-even identity to 1e-9, cost-monotone net Sharpe. Pinned by twelve repo `analysis` checks (658 → 670); no golden moves |
| F-84 | does the paired test survive the sleeve panel, and can a book be stress-read? (L10-cs/A18) | **SUPPORTED — exclusion exact, stress readouts exact** | an identical sleeve on both reports leaves the paired clusters, count and `value` byte-identical (the sleeve still counts in the DSR design effect — only the paired test and `blockStability` exclude it); `poolReports` and both restatements retain the price-only panel; `stressHalves` splits +2.0/-2.0 with the min, `worstBlock` reads -4.33 on the constructed weak-middle grid. Pinned by nine repo checks (`walkforward` 85 → 90, `analysis` 673 → 677); no golden moves |
| F-85 | does the repo's sleeve composition reproduce the R8 book on real data? (R40/R42 chain) | **SUPPORTED — 6.25 vs 6.18, first real-data G5 knobs** | the full repo chain (`buildCarrySleeveView` → sleeve → `single` → `cap-band` → `scoreBookReturns`) reproduces the stored R8 book through 11/11 pre-registered checks (net@4 **6.25 vs 6.18**, turnover **10.01 vs 10×/yr**, break-even **43.83 vs 46.04 bps**); the read caught two stacked real-data-only builder defects (double-counted funding: `basisPnl` held spot−perp+funding while every consumer earns basis+funding; a 0 `markPrice` sentinel read as a price, fabricating −100 % perp prints to −5.3 % a period) — each partial fix moved the number (0.25 → 2.02 → 0.76 → 6.25). First R8 G5 knobs: level 6.25, 6/6 blocks, neutral 6.29, stress 7.01/6.47, worst block 3.91; verdict false exactly on dsr/decay/unseen. Pinned by two repo `contracts` §K2 checks (155 → 157); no golden moves |
| F-86 | does the `--sleeve` text path equal the programmatic chain on real files? (W2 run mode) | **SUPPORTED — bit-for-bit, shipped-marks object recorded** | `runSleeveReport` on the shipped JSONL texts equals `buildCarrySleeveView` + `scoreSleeve` on the same files bit-for-bit (fRate, basisPnl nulls in the same cells, times; economics exact) through 6/6 checks — the candle-text parsing the e74 chain never exercised. The shipped-marks object (funding-always + partial basis, 52 % null basis, marked 43.9 %) reads net **11.26** at turnover 10.01 — a different object from the R8 book, recorded never gated (the first draft gated the level and failed honestly at 11.26 vs 6.18; rewritten as path-equivalence rather than widening the band). Pinned by four repo `contracts` §K3 + three `analyze` §S1 checks; no golden moves |
| F-87 | does the repo's demean tool reproduce F-03 on real data? (R5) | **SUPPORTED — 4.92→0.56, 1.47→14.63 streams** | `panelMean` + `demeanedFn` + `xsMomentum` driven on the real 1h panel through 4/4 pre-registered checks: raw book 4.92/1.47/+0.122 (the F-03 baseline exactly), demeaned book 0.56/14.63/−0.093 (inside the 0.39–0.60 band, no edge manufactured — the R5 falsifier holds in its honest direction). The tool, never an arm: K untouched. Pinned by eight repo `analysis` §AN checks; no golden moves |
| F-88 | is realized vol forecastable where direction is not? (W4b) | **SUPPORTED — the winnable job confirmed** | `realizedVolatility` (window 24) + `ewmaVolForecast` (lambda 0.94) driven on the real 1h 8-stream panel through 4/4 pre-registered checks: EWMA MSE-skill vs a flat mean is **+0.774…+0.840 per stream, +0.803 pooled**, median 0.792 — vol is strongly predictable where direction Brier skill is <= 0 (G-A). The repo measurement is `realizedVolatility` + `ewmaVolForecast` + `volForecastSkill` in `analysis/forecast.js` (ten §AQ checks); the model earns the default path only by beating this OOS at matched exposure. |

| F-89 | does a fitted forecaster beat the causal EWMA on realized vol OOS? (W4b tournament) | **SUPPORTED — the falsifier fires 8/8** | repo `tournamentVolForecast` (half-split OOS vs the train-mean baseline, window 24, lambda 0.94, AR(1)) driven on the real 1h 8-stream panel through 5/5 pre-registered checks: EWMA skill **+0.749…+0.903** per stream (positive everywhere, as F-88), fitted AR(1) skill **+0.978…+0.992** per stream — AR beats EWMA on **8/8** streams. So the W4b hypothesis is supported by the cheapest learned model: the reference a model must beat is now the fitted AR(1), not the EWMA, and the next measurement is whether the hivemind's vol read adds anything over AR(1) at matched exposure (G4). Pinned by ten repo `analysis` §AR checks; no golden moves |

| F-90 | is AR's win over EWMA a split pick? (W4b split-robustness) | **SUPPORTED — 5/5 splits on every stream** | repo `tournamentVolForecastAcrossSplits` (splits 0.3–0.7) driven on the real 1h 8-stream panel through 4/4 pre-registered checks: AR(1) wins the **majority of splits on 8/8 streams (5/5 everywhere)**, and EWMA stays positive on **every split of every stream** (+0.70…+0.93) — so E79's headline is not a split artefact, and the EWMA reference is stable too. The model bar is now split-robust AR(1). Pinned by eight repo `analysis` §AS checks; no golden moves |

| F-91 | does the model slot discriminate on real data? (W4b G4 gate) | **SUPPORTED — with a thin-margin caveat** | repo `tournamentVolModel` (EWMA vs fitted AR(1) vs naive prev-bar persistence) driven on the real 1h 8-stream panel through 4/4 pre-registered checks: the slot runs everywhere, AR wins the three-way on **8/8** streams and beats persistence on **8/8** — but both read **≈0.98** (EWMA ≈0.68–0.77), so realized vol is near-unit-root and the headroom above naive persistence is a hair. The G4 gate is runnable; a model must beat AR(1), and AR(1) barely beats doing nothing. Pinned by eight repo `analysis` §AT checks; no golden moves |

| F-92 | does the vol tournament hold on 15m? (W4b timeframe) | **SUPPORTED — 8/8 again** | repo across-splits tournament driven on the 15m 8-stream panel through 4/4 pre-registered checks: AR(1) wins the majority of splits on **8/8** streams (5/5 everywhere), EWMA positive on **every split of every stream** (+0.65…+0.83) — the 1h result is not a bar-size artefact. No repo change (the helper is timeframe-agnostic); no golden moves |

| F-93 | does the panel rollup reproduce the per-stream verdicts? (W4b decide-view) | **SUPPORTED — 8/8 cells match** | repo `tournamentVolPanel` driven on the real 1h panel through 4/4 pre-registered checks: one call reports 8 streams, unanimous AR majority (8/8) and unanimous EWMA-positive (8/8), with per-stream cells bit-equal to the single-stream calls. The W4b measurement stack is complete: foundation (F-88) → tournament (F-89) → split-robustness (F-90) → model slot (F-91) → timeframe (F-92) → panel view. Pinned by eight repo `analysis` §AU checks; no golden moves |

| F-94 | is the repo AR fit a correct OLS solve? (W4b audit) | **SUPPORTED — 1e-15 vs the closed form** | `fitArVolForecast` audited against synthetic AR(1) ground truth (c=0.5, phi=0.7, n=5000) through 6/6 pre-registered checks: recovers phi=0.7082 (within 0.05) and c=0.4782 (within 0.15), matches an independent sum-formula solve to **1.5e-15/8.9e-16**, prediction equals the linear form exactly. The Gauss-Jordan path is exact; the W4b stack's only numerics are verified. No repo change; no golden moves |

| F-95 | does the vol ranking survive the loss function? (W4b QLIKE) | **SUPPORTED — 8/8 under QLIKE too** | repo `volForecastQlike` driven on the real 1h panel through 4/4 pre-registered checks: EWMA QLIKE-skill **+0.858…+0.936** per stream, fitted AR(1) **+0.988…+0.995** — AR beats EWMA on **8/8** streams under the literature's preferred variance loss, mirroring the MSE verdict (F-89). The ranking is not a loss-function artefact. Pinned by eight repo `analysis` §AV checks; no golden moves |

| F-96 | does the G4 gate park a naive model on real data? (W4b gate) | **SUPPORTED — 8/8 parks with resolution** | repo gate harness (model-across-splits + promote/park decision) with naive persistence in the model seat, driven on the real 1h panel through 4/4 pre-registered checks: persistence wins 0/5 splits on 6/8 streams but **2/5 on SOL and 1/5 on BNB** — yet the decision parks it on **8/8**, since promotion needs a split majority. The gate has resolution (split wins happen) without hair-trigger promotion. First over-strict pre-registration (zero wins) corrected honestly to sub-majority. Pinned by ten repo `analysis` §AW checks; no golden moves |

| F-97 | does the vol tournament survive the window ladder? (W4b) | **SUPPORTED — 8/8 at windows 12 and 48** | repo across-splits tournament re-driven at realized-vol windows 12 and 48 on the real 1h panel through 5/5 pre-registered checks: AR(1) wins the split majority on **8/8 streams at both windows** (5/5 splits everywhere). The F-01 window-artefact lesson applied to vol directly — and vol passes where direction failed. No repo change (window is a caller parameter); no golden moves |

| F-98 | does complexity beat AR(1) on vol? (W4b order contest) | **SUPPORTED — simplicity holds 8/8** | AR(2), AR(3) and ridge-AR(2) seated beside OLS AR(1) OOS on the real 1h panel through 3/3 pre-registered checks: AR(1)=AR(2)=AR(3) to three decimals on every stream (extra lags add nothing), while unstandardized ridge (l2=1) HURTS (0.66–0.97 vs 0.98) — shrinkage on the raw vol scale over-shrinks. AR(1) stands as the reference; any challenger must standardize first. Pinned by eight repo `analysis` §AX checks; no golden moves |

| F-99 | does the vol tournament hold on the carry book? (W4b applied) | **SUPPORTED — AR wins on carry vol too** | repo half-split tournament on the honest delta-neutral carry book's own vol (pooled, 6558 periods, window 24) through 5/5 pre-registered checks: EWMA skill **+0.978**, fitted AR(1) **+0.998** — AR beats EWMA on the applied book with the different risk profile, so W4b's payoff (forecast-sized carry) rests on a measured ranking, not an analogy. No repo change; no golden moves |

| F-100 | does forecast sizing beat trailing sizing on the carry book? (W4b payoff) | **SUPPORTED — narrowly, on both DD and Sharpe** | expanding-refit AR(1)-forecast sizing vs trailing-RMS sizing (both causal, cap 4, same target) on the honest carry book over a 6058-bar scored span, 4/4 pre-registered checks: unsized DD **7.96 %** → trailing **2.70 %** → AR **2.57 %**; Sharpe 3.58 → 7.63 → **7.68**. The W4b forecast advantage compounds into the sizing application — small, same direction, no extra machinery. This closes the W4b arc: measurement (F-88) → reference (F-89/90/92/97) → gate (F-91/96) → audit (F-94) → payoff. No repo change; no golden moves |

| F-101 | does the vol tournament hold at 4h? (W5 breadth) | **SUPPORTED — 8/8 at 4h** | 1h panel resampled to 4h with the repo `resampleCandles` (13 375 bars/stream), across-splits tournament per stream, 4/4 pre-registered checks: AR(1) wins the split majority on **8/8** streams (5/5 everywhere). The ranking now holds at 15m, 1h, 4h, windows 12/24/48, both skills, and the carry book — breadth without a single flip. No repo change; no golden moves |

| F-102 | does one ladder call reproduce the window verdicts? (W4b) | **SUPPORTED — 24/24 cells match** | repo `tournamentVolLadder` driven on every 1h stream through 4/4 pre-registered checks: available everywhere, AR unanimous at windows 12/24/48 on all 8 streams, every cell bit-equal to the single-window calls. E87's verdicts now come from one shipped call. Pinned by eight repo `analysis` §AY checks; no golden moves |

| F-103 | does the vol ranking survive the estimator? (W4c measurement breadth) | **SUPPORTED — 32/32 cells majority-AR** | repo Parkinson / Garman-Klass / Rogers-Satchell rolling vols plus rolling Yang-Zhang driven on every 1h stream with true opens (lab loader now carries `open` end to end) through 5/5 pre-registered checks: every estimator available on all 8 streams, every estimator correlates with close-close vol above 0.8 (min 0.8274 Rogers-Satchell/LINK, max 0.9666 Parkinson/BNB), and fitted AR(1) holds the split majority over EWMA on **32/32** stream x estimator cells (5/5 everywhere). The W4b ranking is not a close-close artefact. Pinned by sixteen repo `analysis` §AZ checks; no golden moves |

| F-104 | does heterogeneity beat AR(1)? (W4c HAR-RV challenger) | **SUPPORTED — HAR 40/40, narrowly** | repo HAR(1,5,22) seated against EWMA and AR(1) in a three-way across-splits tournament on close-close realized vol for every 1h stream through 5/5 pre-registered checks: HAR wins the split majority on **8/8** streams (**5/5** everywhere, 40/40 split cells), with a positive mean skill margin over the best rival on every stream (+0.0001…+0.0005). Weekly/monthly averages add a small, same-direction edge over the daily leg alone — HAR becomes the reference, AR(1) the simplicity fallback. Pinned by the same sixteen §AZ checks; no golden moves |

| F-105 | is the V2.3 base-rate learner an exact port? (V2.3 first learner) | **SUPPORTED — bit-exact on all 8 streams** | repo `plugins/learners/base-rate.js` (the P1 training prior as a stateful Learner factory: online 0/1 counts, signed confidence 2p-1) checked against `analysis/benchmark.js#fitBaseRate` on next-bar-sign labels for every 1h stream through 5/5 pre-registered checks: the online prior equals the batch prior bit-exactly everywhere (priors 0.489–0.506, confidences −0.022…+0.013), the signed mapping is exact, and the composition root carries it UNTESTED with the default roster still exactly the legacy learner. V2.3 has its first non-legacy learner; no golden moves |

| F-106 | does HAR sizing beat AR sizing on the carry book? (W4c payoff) | **SUPPORTED — on both DD and Sharpe** | trailing-RMS vs AR(1) vs HAR(1,5,22) sizing on the honest carry book over the same 6056-bar e90 span (all causal, cap 4, same target) through 4/4 pre-registered checks: unsized DD **7.92 %** → trailing **2.67 %** → AR **2.54 %** → HAR **2.45 %**; Sharpe 3.59 → 7.64 → 7.68 → **7.78**. The forecast ranking (EWMA < AR < HAR) compounds monotonically into the sizing application. No repo change; no golden moves |

| F-107 | does the HAR ranking hold at 15m? (W5 breadth) | **SUPPORTED — 8/8 at 15m** | three-way tournament (EWMA vs AR(1) vs HAR(1,5,22)) on close-close realized vol for every 15m stream (79 999 bars/stream) through 4/4 pre-registered checks: HAR wins the split majority on **8/8** streams (**5/5** everywhere, 40/40 split cells). The ranking now holds at 15m, 1h, 4h, windows 12/24/48, four range estimators plus Yang-Zhang, both skills, and the carry book — breadth without a single flip. No repo change; no golden moves |

| F-108 | is the V2.3 ridge learner an exact port? (V2.3 second model) | **SUPPORTED — 3200/3200 bit-exact** | repo `plugins/learners/ridge.js` (the P1 ridge closed form as a stateful Learner factory: buffered rows, weighted least squares, intercept unpenalized, signed confidence 2p-1) checked against `analysis/benchmark.js#fitRidge`/`#predictRidge` on lagged-return features with next-bar-sign labels through 4/4 pre-registered checks: predictions match bit-exactly on all 1600 test bars per mode (standardise on and off) across all 8 streams. The learner slot now has three occupants (legacy LIVE/default, base-rate + ridge UNTESTED/off-roster); no golden moves |

| F-109 | is the V2.3 mlp learner an exact port? (V2.3 third model) | **SUPPORTED — 1600/1600 bit-exact** | repo `plugins/learners/mlp.js` (the P1 one-hidden-layer tanh MLP as a stateful Learner factory: buffered rows, seeded full/mini-batch SGD with L2, signed confidence 2p-1) checked against `analysis/benchmark.js#fitMLP`/`#predictMLP` on lagged-return features with next-bar-sign labels through 4/4 pre-registered checks: predictions match bit-exactly on all 800 test bars per mode (full-batch standardised and mini-batch raw) across all 8 streams. The learner slot now has four occupants (legacy LIVE/default, base-rate + ridge + mlp UNTESTED/off-roster) — every P1 model class is behind the contract; no golden moves |

| F-110 | do the ported learners beat the prior walk-forward? (V2.3 slot gate) | **NEGATIVE — ridge +0.0036, mlp −0.0222** | walk-forward Brier skill of the ridge and mlp Learner plugins against the base-rate plugin on lagged-return features with next-bar-sign labels (trailing-800 train, 500-bar test, 3 splits x 8 streams = 24 cells) through 3/3 pre-registered checks: every cell finite, mean skill **ridge +0.0036 / mlp −0.0222**. The slot works end to end and the G-A thesis holds inside it — no model class earns the promotion bar, which is exactly why the learners ship UNTESTED/off-roster. No repo change; no golden moves |

| F-111 | does any forecast combination beat HAR(1,5,22)? (W4c-y combination challenger) | **SUPPORTED — OLS combination wins 8/8, narrowly** | repo seven-way tournament (ewma/ar/har + equal/inverse-MSE/OLS/lasso combinations, weights fit on the first OOS half and scored on the second) on close-close realized vol for every 1h stream through 5/5 pre-registered checks: OLS holds the split majority on **7/8** streams 5/5 (XRP 3/2 vs HAR), the panel combine-majority is **8/8** (HAR-majority 0/8), and the mean best-combine margin over HAR is positive on every stream (+0.0000…+0.0002). The combination puzzle does NOT hold on this panel — but the margins are hair-thin (the same order as HAR-over-AR in F-104), so combination joins HAR as a sizing reference candidate rather than replacing it; QLIKE-second-skill and expanding-grid confirmation are the documented follow-ups. Pinned by ten repo `analysis` §BA checks; no golden moves |

| F-112 | does combination sizing beat HAR sizing on the carry book? (W4c-z payoff) | **MIXED — HAR sizing still best; combination ≈ trailing** | trailing-RMS vs AR(1) vs HAR(1,5,22) vs frozen-OLS-combination sizing through the repo `applyVolTargetScaling` on the honest carry book over the e96 span (weights OLS-fit on the first 15%, frozen, scored on the last 85% — all causal) through 7/7 pre-registered checks: unsized DD **7.92%** → trailing **2.67%** → AR **2.54%** → HAR **2.45%** → combine **2.67%**; Sharpe 1.67 → 6.01 → 6.05 → **6.15** → 6.06. The F-106 payoff reproduces through the repo scaler (HAR sizing best on both DD and Sharpe), but the OLS forecast edge (+0.0001 skill) does NOT survive the sizing transform — combination ties trailing. Lesson: rank by the application metric (sizing DD), not the forecast metric (MSE skill); HAR stays the sizing reference. A corrected pre-registration belongs to this row: the first 40/60 attempt failed vacuously because the book's drawdown troughs at bar 2515 (38%), leaving the last 60% calm (unsized DD 0.51%) where any vol-target scaler levers instead of tames — the 15/85 split plus an explicit non-calm guard (unsized DD above 2%) fixed it. Pinned by ten repo `analysis` §BB checks; no golden moves |

| F-113 | does the seven-way ranking survive QLIKE? (W4c-yq second opinion) | **SUPPORTED on direction, MIXED on the arm** | the repo seven-way tournament's QLIKE block (same weight-train/weight-test split, all-positive intersection so every arm reads the same bars) across splits on close-close realized vol for every 1h stream through 5/5 pre-registered checks: QLIKE decided on **5/5 splits of all 8 streams**, and the mean best-combine QLIKE margin over HAR is non-negative on every stream (+0.0000…+0.0002). Direction agrees with MSE (F-111): combination never loses to HAR under either skill. The arm differs: lasso takes XRP 5/5, BNB 4/5, BTC 3/5; OLS takes SOL 5/5 and shares ETH/ADA/DOGE/LINK; HAR holds a QLIKE majority only on ADA (3/5). A real defect belongs to this row: the round-64 lasso used a raw penalty that the vol scale (~0.005 vs ~2.0 on the synthetic checks) dominated into all-zero weights — e101's lasso arm was dead and every QLIKE intersection empty (0/5 abstention everywhere). Round 66 RMS-normalises columns and target inside `fitLassoCombineWeights` (pinned by a scale-invariance check: ×1000 problem, identical weights), which revived both. E101's OLS-vs-HAR conclusion never depended on lasso and stands. Pinned by nine repo `analysis` §BC checks; no golden moves |

| F-114 | do rolling weights beat frozen weights? (W4c-w online challenger) | **NEGATIVE — frozen wins 8/8, rolling margins negative everywhere** | frozen OLS (fit once on the first OOS half) vs rolling OLS/inverse-MSE/Gibbs (re-fit on a trailing-60 window, strictly causal) with identical frozen base models and identical scoring bars, on close-close realized vol for every 1h stream through 5/5 pre-registered checks: frozen holds the split majority on **7/8** streams 5/5 (XRP frozen 3/2 vs HAR), the panel frozen-majority is **8/8** (rolling 0/8), and the mean best-rolling margin over frozen is negative on every stream (−0.0001…−0.0008). The blend is stationary: re-fitting buys estimation error, not adaptivity — the combination puzzle (Timmermann 2006) biting the online variant. Consequence: F-112's combine≈trailing is structural, not staleness; the planned rolling-combine sizing experiment is screened out without build. Frozen OLS stays the combination reference; rolling is measured-and-rejected. Pinned by ten repo `analysis` §BD checks (incl. Gibbs hand-exponential, rolling causality by prefix-identity, equal-weight start-up); no golden moves |

| F-115 | does the vol-target risk plugin carry the sizing payoff? (V2.2 wiring proof) | **SUPPORTED — bit-identical on 6058 bars, DD 7.96% → 2.70%** | the round-68 `risk:vol-target` plugin (vendored W4c-z arithmetic — the import law forbids analysis/ imports) driven through `sizingForSleeve` on the honest carry book's trailing-RMS sizing vs the repo `applyVolTargetScaling` through 5/5 pre-registered checks: identical scaled series bit-for-bit (6058 scored, 0 skipped), and the plugin-sized book cuts the drawdown **7.96% → 2.70%** with Sharpe **3.58 → 7.63** — the F-106 trailing arm reproduced through the contract. The sizing payoff is now callable behind `RiskPolicy#sizing` (UNTESTED/off-roster until a gate scores a sized book). Pinned by ten repo `contracts` §O checks (position bit-identical to cap-band, sizing bit-identical to analysis on synthetic + real-scale data, guards, per-sleeve specs, determinism); no golden moves |

| F-116 | does the payoff survive a CLI scalar target? (round-69 `--sleeve-sizing` correction) | **NEGATIVE on the target, SUPPORTED on the mechanism — the F-115 payoff is adaptive-target-specific** | the exact round-69 repo composition (`trailingBookVol` + `sizingForSleeve` + gate re-score) on the same honest carry book and 6058-bar span with a scalar caller-supplied target grid (0.005/0.01/0.02, window 24) through 7/7 pre-registered checks: the repo forecast is bit-identical to the lab RMS on all 6558 bars and the plugin matches the analysis scaler bar-for-bar, but every scalar target levers the book to the cap (max scale 4.000, mean ~3.99 — the book's own vol is 2.76e-4/bar, so the targets sit 18–73× above it) and the drawdown WORSENS monotonically (unsized **7.96%** → 13.57% → 21.23% → 25.99%) while Sharpe rises (3.58 → 6.09 → 4.38 → 3.76). F-115's DD cut came from its trailing-mean target (≈ book vol by construction, mean scale ≈ 1), not from sizing per se — a scalar target at plugin-default scale is leverage, not timing. Correction to F-115's reading, recorded before any gate run could bank it. Consequence: the `--sleeve-sizing` report prints `bookVolMean` so the operator picks the target at the book's own scale, and an `adaptive` (trailing-mean-target) sizing mode is the documented follow-up, not this round. Pinned by ten repo `contracts` §P checks (causal RMS, strict option parsing, plugin-composition differential, cost-monotone determinism, default-path-untouched, sized report + bookVol); no golden moves |

| F-117 | does the adaptive CLI mode restore the cut? (round-70 `--sleeve-sizing=adaptive`) | **SUPPORTED — DD 7.96% → 3.05% through the CLI path, both accumulation windows agree** | the round-70 `adaptive` mode (`adaptiveTargets`: the expanding causal mean of the trailing-RMS vols, NaN until the first finite-positive vol, proved prefix-identical on the real 6558-bar series) driven through the exact repo composition on the same honest carry book and 6058-bar span through 5/5 pre-registered checks: the repo adaptive path cuts the drawdown **7.96% → 3.05%** with Sharpe **3.58 → 7.55** at mean scale 2.30 (bounded, no cap-riding — vs F-116's scalar mean ~3.99), and the kept-bars accumulation variant reads **2.70%** (exactly e105), so the payoff is not an accumulation-window artefact — the 0.35pp gap is the pre-WARMUP history in the repo mean. The F-115 payoff is now one CLI flag away (`--sleeve --sleeve-sizing=adaptive`); the scalar mode stays for book-scale-matched targets with the `bookVolMean` readout beside it. Pinned by ten repo `contracts` §Q checks (expanding-mean hand vector + causality, case-insensitive parsing, adaptive differential vs the plugin, determinism, fail-closed, panel readout, adaptive report, scalar regression); no golden moves |

| F-118 | does closing the loop beat the open-loop target? (round-73 `--sleeve-sizing=drawdown`) | **SUPPORTED with a single-episode caveat — DD 3.05% → 1.38%, Sharpe intact** | the feedback-control follow-up the open-loop literature records (`voltarget2603`): the adaptive target times a causal trailing-drawdown governor (1 at the peak, linear to 0 at a pre-registered 5% DD) on the same honest carry book and 6058-bar span through 7/7 pre-registered checks, every governor proved half-prefix-identical on the real series. Self-feedback (the arm's own equity) reads Sharpe **7.80** / DD **2.34%**; stress-feedback (the unsized book's equity, the cash-overlay frame — `cashoverlay2606`) reads Sharpe **7.42** / DD **1.38%** with 1060 flat bars; stress + restart (`ddrestart2303`) reads Sharpe **7.94** / DD **1.88%** (the single restart re-engages into the recovery, matching the paper's restart-beats-no-restart claim); the hard brake reads Sharpe **7.19** / DD **1.49%** (flat through the recovery costs). Caveats, recorded before any gate banks them: the whole drawdown is ONE episode (every arm's first-half DD equals its full-sample DD; second halves sit ~1%), so the restart contrast rests on one event, and turnover is unmeasured (the repo port re-scores through the gate's costed arithmetic, so the native `--sleeve` run prices it). Consequence: the smooth stress governor ships as `--sleeve-sizing=drawdown` (needs only the base equity the composition already holds); restart/brake stay lab-side until cost-accounted. Pinned by ten repo `contracts` §R checks (governor hand vector + causality + cap guard, case-insensitive parsing, plugin-composition differential, never-above-adaptive, determinism, drawdown report, scalar/adaptive regression); no golden moves |

| F-119 | does sizing survive the full marked history? (first `sleeve-runs.sh` operator runs, 2026-09-29) | **NEGATIVE on net, SUPPORTED on cost-accounting — sizing holds the level at 4.7× the turnover** | the three turnkey runs (`20260929T061347/49/50-seed1-sleeve`, 6606 buckets × 8 streams, 4 bps): flat net **11.26** at turnover **10.01/yr** (break-even **42.88 bps**, halves per-bar **0.47/0.20**, worst block **+0.118**); adaptive sized net **10.61** at turnover **46.89/yr** (break-even **11.57 bps**, halves **0.58/0.05**, worst block **−0.011**); drawdown sized net **10.63** at turnover **46.84/yr** (break-even **11.57 bps**, worst block **−0.011**). Three readings. (1) Sizing buys nothing on net (−0.6) and spends 4.7× turnover, so the break-even headroom collapses to a quarter (42.9 → 11.6 bps) — still passing at 4 bps, but the margin story is the flat book's, not the sized book's. (2) Sizing concentrates the book in time: the sized second half (0.05) is a quarter of the flat second half (0.20) and the sized worst block is negative — vol-targeting levers the calm stretches that then break, the open-loop spike (`voltarget2603`) measured on the shipped composition. (3) The governor is a **no-op at this scale** (adaptive vs drawdown Δnet 0.02, Δturnover 0.05/yr): the 6606-bucket book rarely nears the pre-registered 5 % cap, so F-118's single-episode caveat is confirmed material — the e108 DD cut does not transfer to the full marked history. Consequence: the **flat book stays the G5 claim** and sizing stays opt-in (a timing/risk preference, not a level gain); the flat halves (0.47 → 0.20) attach the first number to the operator-owned decay attestation (repo TODO 105). G5 on all three runs reads false on (dsr,decay,unseen) — pre-round-75 code, dsr unscored; round 75 machine-scores it |
| F-120 | does the sleeve decay survive an independent book? (operator yearly block + lab honest-book cross-check, 2026-09-29) | **SUPPORTED on direction — the decay is not a calendar artefact** | the operator's `20260929T111926-seed1-sleeve` run is the first real yearly readout of the repo `sleeveYearly` evidence: per-bar Sharpe **2020 +0.66 / 2021 +0.49 / 2022 +0.55 / 2023 +0.34 / 2024 +0.30 / 2025 +0.14 / 2026 +0.11** (slope **−0.09/yr**, 7y, 2026 still positive), with `dsr deflated 1.0000 (DE 32.63, 202/6605, trials=1)` and G5 false on (decay,unseen) exactly as round 75 predicted. Re-derived in-session through a faithful replication of the lab `loadCarryBook` pipeline (bucket-summed funding, exact-bar closes, tail guard, ext-mark substitution) on the INDEPENDENT equal-weight delta-neutral book: yearly mean-across-symbols per-bar Sharpe **2020 +0.17 / 2021 +0.31 / 2022 −0.00 / 2023 +0.17 / 2024 +0.32 / 2025 +0.13 / 2026 +0.06**, slope **−0.013/yr**, last-two mean **0.097** below first-two mean **0.241**. Same direction on a different book, different marks, different weighting — so the decay is not a calendar-grouping artefact of `sleeveYearly` (the TODO 105 cross-check proposal). Caveats: the honest book is noisier (2024 peaks) and its slope is shallower — direction agrees, magnitude does not transfer; the full e109 check set was
executed AI-side in-session on the real data through the repo's own modules
(5/5: operator yearly block exact to slope −0.09267922697017147, first-last
halves 3302+3303 = 6605 with Δ −0.27045) — measured, no operator run. Consequence: TODO 105's formal comparison lands this round as repo `sleeveFirstLast` (descriptive halves + Lo intervals, never gating); the decay attestation now reads halves + yearly slope + first-last Δ together |
| F-121 | does the dispersion sleeve survive honest marking? (round-78 `--carry-marks`, 2026-09-29) | **SUPPORTED in-session (5/5), confirmed natively (`20260929T215723-seed1-sleeve`: 6.25/10.01/43.83)** | the operator runs print net **11.26** on shipped marks (marked 43.9 %, null-basis 52 %) while the lab's substituted-marks chain (e74) reads **6.18 / turnover 10 / break-even 46.04** on the same recipe — the repo CLI could not score the honest book until round 78 wired opt-in `--carry-marks` (per-row substitution where the shipped mark is missing, symbol-selected, shipped marks kept; verified in-session bit-equal to the shipped-marks path on fixtures). Pre-registered prediction for `bash scripts/sleeve-runs.sh honest`: net ≈ **6.2**, turnover ≈ 10/yr, break-even ≈ 46 bps, a `marks +N ext rows` line, G5 unchanged (decay,unseen). E110's check set executed AI-side in-session on the real data through the repo's own modules (5/5: substituted 28901 rows, null-basis 0.64%, text-path view bit-equal to the programmatic view, report economics exactly equal to the direct chain, honest level 6.25 / 10.01 / 43.83 inside the e74 tolerances with the marks line printed — read from the vendored repo copy). The operator honest run confirms the same path natively. If it confirms, TODO 95's basis-marking half is measured natively and the honest level stands as a *marked*-carry claim (execution/borrow/margin/liquidation still excluded — sweep 09x's funding trilemma 2605.10400 and lending-pool costs 2502.06028 are where those legs live) |
| F-122 | does momentum survive the 8h sleeve grid? (round-79 e111, 2026-09-29) | **NULL — no port, no composite** | R8 construction shell with a momentum sort key (trailing-W-bucket spot returns, rank weights, EWMA(0.02)+L1, 12.5% cap, next-bucket spot at 4 bps) through the repo's own view/score pipeline: net per-bar **−0.010/−0.017/−0.008/+0.001** at W = 2/4/8/16 (BE negative except W16 at 12.5 bps), correlation with carry **−0.01…−0.04**. The null is gross, not cost (gross ann −0.53…+0.57), and a hold-6 variant churns 13× harder (turnover 849–993 vs 65–68/yr) — the keys are non-persistent noise at this grid, so no turnover rescue exists. The 1h sig-momentum edge does not aggregate to 8h rank-dispersion (F-07's direction). Consequence: no momentum sleeve, no carry+momentum composite (zero edge at ~zero correlation is nothing to blend); breadth must come from elsewhere (round-80 OI-port recon: `open_interest_8h.json` exists lab-side at 1.5 MB, vendoreable; toptrader ratios arrive via the harvester, no file yet) |
| F-123 | do the positioning sleeves reproduce through the repo path? (round-80 e112, 2026-09-29) | **SUPPORTED 15/15 AI-side — oi net@4 0.67 / 197x / BE 11.4, fade 1.05 / 7.9x / BE 185** | `e112_oi_sleeve_score.js` drives the vendored `src/data/oi_8h.json` (byte-equal to the lab harvest, 1.5 MB) + 8 funding + 8 1h candle texts through the repo `runSleeveReport` on the 6606x8 grid: oi-change net@4 **0.67** (F-45 band +0.5..+0.7), turnover **197/yr** (churny, within the 100-400 pre-register; lab daily-book 338x), break-even **11.40 bps** (F-45 8.93-14.73), coverage oiVal 81.2% / topLS 66.8% (2021 starts late, 90 bars), yearly slope **+0.02** + first-last +0.015→+0.026 (no decay), DSR full-sample **0.9305** (below the 0.95 floor — weak sleeve, as expected); toptrader-fade net@4 **1.054** (F-51 pinned 1.14), turnover **7.93/yr**, break-even **185.1 bps**, DSR deflated **0.9664** (passes), slope +0.01, first-last +0.04→+0.02 (no decay). Both formatters name the sleeve + G5 line; G5 false on (dsr,decay,unseen) for oi and (decay,unseen) for fade — the operator native run owns decay/unseen. Consequence: TODO 110 AI-side gate passes; the native gate is `bash scripts/sleeve-runs.sh oi/top` + `npm test` (no repo code changed this step) |
| F-124 | do the positioning sleeves confirm natively? (TODO 110 native gate, 2026-09-30) | **SUPPORTED — both native runs reproduce e112 to the printed digit; npm 132/132** | operator `bash scripts/sleeve-runs.sh oi/top` (read-only artefacts `src/runs/20260930T012415-seed1-sleeve`, `20260930T012431-seed1-sleeve`): oi-change net@4 **0.670** / turnover **197.11/yr** / BE **11.40 bps** / DSR full-sample **0.9305** (DE 0.28, below the 0.95 floor — weak, as predicted) / slope **+0.02** / first-last +0.015→+0.026 / G5 false on (dsr,decay,unseen); fade net@4 **1.054** / **7.93/yr** / BE **185.13 bps** / DSR deflated **0.9664** (DE 1.64, passes) / slope +0.01 / first-last +0.041→+0.021 / G5 false on (decay,unseen). Three readings. (1) Cross-machine determinism: the vendored OI + repo path scores bit-identical economics AI-side vs natively — the sleeve composition is deterministic, not harness-lucky. (2) The fade is one attestation pair from a claim: every machine-scored knob passes and only the operator-owned decay/unseen attestations hold G5 false (oi additionally fails machine-scored dsr — correctly, it is the weak sleeve). (3) The oi sleeve is characterised, not bankable: 2.85x cost headroom at 4 bps, 197x churn, DSR below floor. Consequence: TODO 110 closes on the native gate; breadth work continues in F-125, not in re-scoring these two |
| F-125 | do the positioning follow-ups expand the edge? (round-82 e113, 2026-09-30) | **MIXED — ladder SUPPORTED, independence SUPPORTED, composite NEGATIVE, fade-sizing NEGATIVE** | `e113_positioning_followup.js` (14/14 through the repo path, artefact `results/e113_positioning_followup.json`): (a) cost ladder 0/1/2/4/8/16 bps — oi **1.032/0.941/0.851/0.670/0.308/−0.416** (dies between 8 and 16, exactly the BE-11.4 prediction; monotone in cost), fade **1.078→0.985** (survives the whole ladder, max drag 0.09). The oi edge is a low-cost-only edge; the fade edge is cost-robust. (b) carry x fade on 5274 earn-time-aligned bars: corr **+0.02** (independent books — a risk fact worth keeping) but carry Sharpe **9.43** vs fade **1.05** on the overlap, so even the risk-parity blend reads **7.34** — a 9.4/1.1 pair cannot blend up (naive 50/50 reads 1.26: carry per-bar vol 8.8e-5 vs fade 4.1e-3, a 47x mismatch the naive blend ignores). No carry+fade composite is built — same rule as F-122, opposite reason (there: zero edge; here: dilution). Fade stands alone as the second sleeve. (c) fade sizing: adaptive net **0.66** at **42.5x** turnover (vs flat 1.05 at 7.9x), drawdown-governor net **0.02** at 35.4x — sizing spends turnover and buys nothing on fade (F-119 repeats on a new book; the 5%-cap governor flats a calm book). Sizing stays opt-in risk preference, never a level claim. No repo change; no golden moves |
| F-126 | does the shipped model have directional skill? (round-84 e114, 2026-09-30) | **NEGATIVE — mean Brier skill −0.0069, 6/24 cells positive** | `e114_hivemind_skill.js` (4/4) drives a live HiveMind per split (fresh, seeded, forceMin, FEATURE_LEN-6 causal featureVector, 0/1 next-bar-sign labels — the walkforward.test.js recipe; one self-caught bug: the driver's FEATURE_LEN is 6, not the walkforward entry's local 12) over 8 1h streams x 3 splits (trailing-800 train, 500 test): mean skill **−0.0069** vs the causal base rate, positive on **6/24** cells, no symbol above +0.02 in any split. The honest model baseline is set: the shipped tiny transformer, like every MSE-trained model in 2603.16886 and the V2.3 slot (F-110), has no directional skill at 1h. Consequence: no directional head is ported anywhere; the model upgrade must aim at magnitude (e115), not sign. No repo change |
| F-127 | can the shipped model time big moves? (round-84 e115, 2026-09-30) | **SUPPORTED — mean Brier skill +0.0246, 19/24 cells, 7/8 symbols** | `e115_hivemind_bigmove.js` (5/5, artefact `results/e115_hivemind_bigmove.json`) on the same 24 cells with a causal big-move label (\|r[i+1]\| above the TRAIN-slice median) and 6 lagged \|r\|x100 features: HiveMind Brier skill **+0.0246** vs the train big-move rate, positive on **19/24** cells and 7/8 symbols (late splits strongest: BTC/ETH/LINK +0.06…+0.11), 7x the ridge directional skill (F-110 +0.0036) with the opposite sign. The one-step persistence forecast reads **−0.67** everywhere — big-move states anti-persist at 1h, so the model is not free-riding lag-1; it learned something subtler. One self-caught design bug: a constant last-state reference (Brier −0.72) is not persistence; the lagged-state forecast is. This is the first positive shipped-model skill on real data and the entry point of the model track (TODO 111): the payoff test (e116: big-move-timed exposure scaling) decides whether it becomes a timing overlay. No repo change; no golden moves |
| F-128 | does bucket-level big-move skill survive aggregation? (round-84 e116, 2026-09-30) | **NEGATIVE — mean Brier skill −0.0105, 8/24 cells positive; the timed book is screened out** | `e116_bucket_bigmove.js` (3/3, artefact `results/e116_bucket_bigmove.json`) repeats the e115 design on the repo view's own 8h bucket spotRet panels (6 lagged \|bucketRet\|x100, next-bucket label above the train median, 800/500, fresh seeded forceMin HiveMind): mean skill **−0.0105**, positive **8/24**. One self-caught bug: spotRet is bucket-major (6606x8), so stream columns must be projected (the first attempt scored 6606-length rows). The e115 1h skill does not survive 8h aggregation — per the pre-registered gate, the timed book (e117) is screened OUT without build. Honest note: split-0.7 (recent) reads positive on 7/8 symbols (+0.02…+0.07) — recorded, not chased (post-hoc regime slicing is selection). Next model candidates: HAR-residual skill (does the model beat the linear vol reference?) and 1h-horizon execution uses. No repo change; no golden moves |
| F-129 | does the model beat the linear vol reference? (round-84 e117, 2026-09-30) | **NEGATIVE — mean HAR-residual skill −0.0090, ≤5/24 cells positive; the V2.3 vol-learner port stays gated** | `e117_har_residual.js` (3/3, artefact `results/e117_har_residual.json`): per-stream 8h-analogue HAR(1,3,21) on bucket \|ret\|, OLS on the train slice, label = positive residual above the train median, same 24 cells and HiveMind recipe: mean skill **−0.0090** vs the train positive-residual rate (best cells +0.016, noise-shaped). The model predicts what HAR already predicts, plus noise — exactly the pre-registered working hypothesis (F-104: HAR is the sizing reference). Consequence: no vol-learner is ported into the V2.3 slot; the slot stays base-rate farm team until a residual test passes. The model track is now fully measured: directional CLOSED, 1h magnitude SUPPORTED-but-not-book-actionable, 8h magnitude CLOSED, HAR-residual CLOSED. Only 1h-horizon execution uses remain open (idea, not measurement). No repo change; no golden moves |
| F-130 | is the network-momentum arm measurable under a reaching audit? (round-85 e118, 2026-09-30) | **SUPPORTED — sibling-shock audit reaches 288/288 folds with 0 violations; the arm is causal, the vacuity is the probe's** | `e118_network_audit.js` (8/8, artefact `results/e118_network_audit.json`) rebuilds `sig-network-momentum` lab-side through the repo's own functions (signalForCandidate + deadZone-0.05 policy + lag-1 backtest timing) on the run's exact window (8x1h last-600, train 60 / test 15, probe 0.05, 1 probe/fold): pooled Sharpe **1.3005** (bit-matches run `20260927T060215-seed1` 1.30049 over 4320 bars — two self-caught rebuild bugs: the scored path applies the run-level deadZone policy, and P&L is lag-1 positions on own test bars via positionsFromSignals). Run A (production own-slot shock) reproduces the corpus exactly: vacuous on 8/8, reachable 0/288. Run B (same own shock PLUS probe on all 7 sibling returns after t; base views byte-equal 8/8, so the difference is probe-only) reaches **288/288** folds with **0 non-vacuous violations**. The 1.3 carries no look-ahead the sibling probe can find — the scored wire (self-skip + lag-1, e63-latent-correct) is vindicated and the audit's own-stream-only probe is the defect. Consequence: the fix is audit-layer (perturb sibling slots for cross-sectional arms), scored path untouched, goldens unmoved — recommend the W6 re-freeze arc (audit change + harness + native gate), which would put a 1.30/15.3bp arm under a real gate for the first time. No repo change this round; no golden moves |
| F-131 | does the network arm survive a native re-measurement under the fixed probe? (round-90 operator run `20260930T154333-seed1`, 2026-09-30) | **MIXED — audit SUPPORTED (clean 288/288, 0 violations), promotion NEGATIVE (adjDSR 0.8654, single binding hurdle)** | native K=6 re-run of the §18.3 roster (45:25 wall, 288 folds, 4320 pooled bars, 8x1h last-600, seed 1; artefacts read-only under `src/runs/20260930T154333-seed1/`, numbers verified AI-side against `report.json`): every signal `reachable 288/288` with 0 violations — the R40 sibling-shock law holds in production and pooled Sharpes reproduce the corpus to the printed digit (network 1.3005 both runs). `sig-network-momentum` fails exactly one gated hurdle (`minDsrAdjusted` 0.8654 @ 802 eff bars, margin −0.085); paired dSharpe 1.4152 (one-sided p = 0.029), stability 1.0, minDsr 1.0 all pass. Three new facts. (1) Dependence binds hardest on the network arm: streamCorr 0.73 → DE 5.38 → effStreams 1.31, fewest effective bars in the roster — the most cross-stream-correlated signal pays most for the adjustment that gates it. (2) `sig-vol-momentum` is nearest the floor (0.9173, margin −0.033): the watch-list arm; `sig-blend-momentum` additionally fails the paired test (p = 0.092). (3) Roster redundancy is measured: momentum~regime-momentum excess r = 0.9964, family effectiveTrials 1.18 of 5 — the duplicate wastes compute (45 min/run), not alpha (DSR keeps trials=K). Family SPA p = 0.3177 (none); cost ladder promotes none at 0/2/5/10; MCS = [baseline]. Consequence: TODO 113 CLOSED as measured-not-promoted (DROPPED stands, re-measured; AUDIT P11 RESOLVED); TODO 114 trims `sig-regime-momentum` from the `gh` roster. No repo change; no golden moves |
| F-132 | does cross-sectionally-demeaned 1h momentum keep an edge? (round-91 e119, 2026-09-30) | **NEGATIVE — demeaned Sharpe 0.09, z-scored 0.20, break-evens ~1–2 bps; the edge was the market leg** | `e119_xs_demeaned_momentum.js` (9/9, artefact `results/e119_xs_demeaned_momentum.json`, registered in `run_all.js`) on the run's exact window (8x1h last-600, train 60 / test 15, deadZone-0.05, lag-1): arm A (raw) bit-matches `20260930T154333-seed1` on Sharpe **1.0848**, gross 1.186537, turnover 810.435, BE 14.64, rbar 0.5196, effStreams 1.7252 — calibrated, so the negative is trustworthy. Arm B (per-bar XS-mean removed, then policy): Sharpe **0.0926**, BE 1.15, rbar −0.0715, Kish DE 0.50, effStreams 16.02. Arm C (XS z-score, then policy): Sharpe **0.1958**, BE 1.92, DE 0.70. Demeaning collapses the design effect (the reversal-xs law from the other side) and takes the edge with it: the 1h momentum premium is ~100% market co-movement, consistent with the §13.5 market-component note and F-122's 8h null. One self-caught bug: the first build passed the view factory instead of the realised view (all-zero positions); one judgement call: the lab pins Kish-consistent rbar/effStreams because the run's composite DE 3.6239 folds in serial dependence beyond the stream panel. Consequence: the decorrelated-cross-sectional-price-arm direction is CLOSED for the 1h panel — breadth stays with the sleeves (carry×fade +0.02, F-125), and the next `gh` runs K=5 (TODO 114). No repo change; no golden moves |
| F-133 | does a second frequency buy panel independence? (round-92 e120, 2026-09-30) | **NEGATIVE — 1h~15m momentum corr ~0.90; stacked effStreams 1.73 → 1.80 (+4% for 2× the panel)** | `e120_multifreq_panel.js` (7/7, artefact `results/e120_multifreq_panel.json`, registered in `run_all.js`): 15m momentum with matched time lookbacks (window 64 = 16h, zWindow 128 = 32h) scored on the run's exact 1h test-bar grid (strictly causal: last 15m bar with t < 1h open). Arm A bit-matches the run (Sharpe 1.0848, gross, turnover, BE, rbar — calibrated). Arm F (15m on 1h grid): Sharpe 1.0407, BE 13.33, rbar 0.5659 — the same edge on the same factor. Same-stream cross-frequency return corr 0.80–0.96 per symbol. Stacked 16-stream panel: rbar 0.5245 ≥ 1h rbar 0.5196 → NEGATIVE per the pre-registered gate (needed S effStreams ≥ 1.25× A). W5.4 CLOSED: frequency does not buy independence for momentum. The F Sharpe is descriptive only (not the native 15m edge). Consequence: the remaining AI-side breadth leg is new symbols (TODO 115 — `data.binance.vision` probed 200 this round); sleeves-as-streams needs a re-freeze decision (L10-cs). No repo change; no golden moves |
| F-134 | do new symbols buy panel independence? (round-93 e121, 2026-09-30) | **SUPPORTED — stacked-16 effStreams 2.35 vs majors 1.75 (1.35× ≥ 1.25 gate); rbar 0.51 → 0.39** | `e121_symbol_breadth.js` (6/6, artefact `results/e121_symbol_breadth.json`, registered in `run_all.js`) on the timestamp-exact shared 600-bar grid ending 2026-08-31T23:00Z: 8 midcaps harvested round 93 (futures-um monthly zips, 19,728 bars each, zero gaps; `data/midcap/` + durable `harvest_midcap_1h.js`). Calibration bit-matches the run (1.0848 on the run window). Majors momentum 0.1528 / midcaps 0.1164 / stacked 0.1327 on this window (F-01 face — verdict is dependence, not edge); midcap panel rbar 0.3925 (effStreams 2.13 of 8) vs majors 0.5113 (1.75). Stacked clears the pre-registered 1.25× gate. Consequence: TODO 115 CLOSED; TODO 116 files the native port + 16-symbol `gh` (operator-owned; pre-registered interest: effStreams ≥ 2.3, vol adjDSR up from 0.9173). No repo change this round; no golden moves |
| F-135 | does a second wave of symbols buy further independence? (round-94 e122, 2026-09-30) | **MIXED — stacked-24 effStreams 2.63 vs stacked-16 2.35 (1.12× < 1.20 gate); rbar 0.39 → 0.35** | `e122_stacked_breadth.js` (6/6, artefact `results/e122_stacked_breadth.json`, registered in `run_all.js`) on the timestamp-exact shared 600-bar grid ending 2026-08-31T23:00Z: 8 more midcaps harvested round 94 (LTC/ETC/UNI/AAVE/ATOM/DOT/FIL/APT, futures-um monthly zips 216/216, 19,728 bars each, zero gaps; `data/midcap2/`). S16 replication reads 2.3536 vs e121's 2.35 — plumbing sound. Wave-2 standalone: Sharpe −0.09, effStreams 2.43 of 8, rbar 0.3275 — the least correlated panel yet, with no edge (power without signal, the F-01 face again). Stacked-24 clears neither the 1.20 SUPPORT bar nor the NEGATIVE bar (rbar falls 0.3865 → 0.3531). Reading: breadth scales sublinearly (wave-1 +34%, wave-2 +12%) — a third lab wave is not worth it; banking stays with the native 16-panel (TODO 116); the remaining breadth leg is venues, scored as independence per sweep 09z/2608.09188 (venue lead-lag is unidentifiable from marks alone). No repo change this round; no golden moves |
| F-136 | does carry-dispersion reach wave-1 midcaps? (round-95 e123, 2026-09-30) | **SUPPORTED-plumbing — available 2466×8, zero-invalid parses, zero-missing audits; pooled net descriptive-positive (18.11 vs majors 11.26)** | `e123_midcap_carry.js` (4/4, artefact `results/e123_midcap_carry.json`, registered in `run_all.js`): funding harvested via durable `data/harvest_midcap_funding.js` (vision monthly fundingRate zips → repo shape, 216/216 months, 8/8 series; TIA 4931 rows on a 4h grid the audit tolerates, INJ 2 extreme rates, both recorded). Majors baseline 6606×8 available in the same call. Turnover ~10/yr both panels, BE ~39/43 bps. Verdict is plumbing (a 2y window cannot re-bank the sleeve); consequence: TODO 118 files the native midcap-carry port (QUEUED behind 116). OI/toptrader midcap history probed DATA-BLOCKED (API-only, 500-row cap). No repo change; no golden moves |
| F-137 | does the 16-wide cross-sectional carry book diversify the sleeve family? (round-96 e124, 2026-10-01) | **SUPPORTED — stacked-16 available (2466×16); cross-leg corr −0.02 (independent dispersion)** | `e124_stacked_carry.js` (4/4, artefact `results/e124_stacked_carry.json`, registered in `run_all.js`) on the window-matched grid (>= 2024-06-01): maj8w 2537×8 net 3.76 / mid8 2466×8 net 18.11 (e123 replicated) / stacked-16 2466×16 net 13.26, turnover 17.6/yr, BE 24.1. Correlation reads the repo's own `parseSleeveInputs` + `scoreSleeve` net arrays on the timestamp-intersected grid (one self-caught bug: `runSleeveReport` drops the period series). Ranking happens ACROSS all 16, so the stacked panel is a genuinely different book. Verdict is plumbing + independence, not promotion (2y window). Consequence: TODO 118 gains the stacked-16 read; next lab e125 (TODO 88). No repo change; no golden moves |
| F-138 | does taker-flow intensity condition 15m sign-reversal? (round-97 e125, 2026-10-01) | **NEGATIVE — fade-all BE 0.43 bps (untradeable); no quintile gradient (Q5 BE 0.31 < all, HR flat 0.503–0.506)** | `e125_flow_reversal.js` (3/3, artefact `results/e125_flow_reversal.json`, registered in `run_all.js`): raw ±1/0 fade-the-prior-sign on the 15m majors panel with taker_15m attached, `|flowChange|` trailing-500-rank quintiles (causal); random control null (−0.003, HR 0.489). TODO 88 CLOSED-negative on the bar-flow proxy. Caveat filed, not chased: 2608.21888 classifies aggressive flow at trade level — bar-level `|flowChange|` may be too coarse; unblock is trade-level aggressor flags. No repo change; no golden moves |
| F-139 | does dispersion-proportional sizing improve the carry book? (round-98 e126, 2026-10-01) | **NEGATIVE — scaled loses on Sharpe AND BE on both panels; turnover explodes 27–33× (mechanism)** | `e126_dispersion_sizing.js` (3/3, artefact `results/e126_dispersion_sizing.json`, registered in `run_all.js`): per-bar scale xsStd/trailing-median-30 clamped [0.25,2] through the repo's own score path — majors 0.34→−0.28 / BE 42.9→2.2, midcap 0.55→−0.74 / BE 39.5→1.5; exploratory REG-90/[0.5,1.5] fails identically. Lesson: the regime factor moves far faster than the slow EWMA-rank book — scale must be quantized (2-state + hysteresis) or applied to target risk, never multiplied per-bar. Consequence: TODO 119 files that design (AI-side queued; G5 home is TODO 104). No repo change; no golden moves |
| F-140 | does quantized regime scaling time the carry book? (round-99 e127, 2026-10-01) | **NEGATIVE — turnover controlled (1.4×) but BE falls both panels (42.9→30.5, 39.5→27.1); dispersion LEVEL has no timing skill** | `e127_quantized_sizing.js` (4/4, artefact `results/e127_quantized_sizing.json`, registered in `run_all.js`): 2-state HIGH/LOW (1.2/0.8 hysteresis, 90-bucket min-hold, 1.25/0.75) through the repo score path — transitions ~monthly as designed, Sharpe slips both panels. Reading: the R8 edge is in the XS RANK, not the level. Flat sizing stands twice (e126+e127); TODO 119 measured-closed; no third variant. No repo change; no golden moves |
| F-141 | does the funding XS rank persist at the R8 policy timescale? (round-100 e128, 2026-10-01) | **NEGATIVE-descriptive — raw 8h ranks churn (rho1 0.52 majors / 0.42 midcap, ±1.5–1.7 ranks/bucket); persistence lives at 10–30d (rho30 0.25/0.20, rho90 0.20/0.15 > 0, ordered decay)** | `e128_rank_persistence.js` (4/3, artefact `results/e128_rank_persistence.json`, registered in `run_all.js`): per-bucket XS ranks through the repo's own `parseSleeveInputs` grid (6606 majors / 2466 midcap buckets), Spearman rank-vector rho at lags 1/7/30/90. Pre-registered rho1 ≥ 0.7 bar failed — the raw rank is NOT slow. Reading: the slow EWMA *constructs* the tradeable rank from a churny raw (smoothing is load-bearing, not tracking); the ordered decay + positive rho30/90 is consistent with the pinned slow spec, which is unchanged (already won OOS). No TODO, no repo change; no golden moves |
| F-142 | does causal EWMA smoothing manufacture the slow rank? (round-101 e129, 2026-10-01) | **SUPPORTED — smoothed rho1 0.992 both panels (raw 0.52/0.42 replicated exactly); smoothed ≥ raw at every lag; sm rho30 0.84/0.89** | `e129_smoothed_rank.js` (4/4, artefact `results/e129_smoothed_rank.json`, registered in `run_all.js`): causal EWMA(λ=0.02, the pinned R8 value) per funding series, rank the smoothed values, same rho curve — raw recomputed in-run (no hardcoded constants). The F-141 constructs-not-tracks reading is confirmed constructively: smoothing is what makes the rank tradeably slow, on both panels. No spec change (the pinned book already does exactly this); no TODO, no repo change; no golden moves |
| F-143 | is the pinned lambda 0.02 on a plateau or a pinnacle? (round-102 e130, 2026-10-01) | **NEGATIVE-on-the-letter — plateau confirmed (0.01–0.03 range 0.03, pinned dead-center), but the pre-registered turnover check had the sign backwards (turnover RISES 10× with speed: 14.7→146.3)** | `e130_lambda_plateau.js` (4/3, artefact `results/e130_lambda_plateau.json`, registered in `run_all.js`): λ ladder 0.005–0.05 through the repo's own `buildFundingBook` + pinned 12.5% cap + sleeve returns (majors-full 6606 buckets; midcap reported). Substance: 0.02 is not tuned (neighbors 0.35/0.32, pinned 0.34); BE falls 153→20 as λ speeds (the e126 churn mechanism from the other side); one self-caught import (`rowRankWeights` lives in primitives/index). Reading: the failed check's mechanism holds with the correct sign — no spec change, no TODO (re-running with a corrected gate would be gate-shopping). No repo change; no golden moves |
| F-144 | is the pinned 12.5% cap on a plateau or a pinnacle? (round-103 e131, 2026-10-01) | **SUPPORTED — cap plateau confirmed (0.0625–0.25 range 0.02, pinned 0.34 level with best neighbor 0.33); cap binds monotonically (mean maxAbs 0.0625 → 0.2427)** | `e131_cap_plateau.js` (4/4, artefact `results/e131_cap_plateau.json`, registered in `run_all.js`): cap ladder 0.0625–0.5 through the repo's own `buildFundingBook` (pinned lambda 0.02) + `cleanBook` + sleeve returns @ 4bps (majors-full 6606 buckets; midcap 2466 reported, finite 0.51/0.55/0.51). Coherence: the 0.125 lane bit-matches e130's pinned-0.02 lane (0.3404/60.35/42.88) through the other ladder axis; e130 regressed 4/3 (same recorded NEGATIVE). Reading: 0.125 is not tuned, and the clipping mechanism is verified directional — no spec change, no TODO. No repo change; no golden moves |
| F-145 | does the 16-wide carry book want a different position cap? (round-104 e132, 2026-10-01) | **SUPPORTED — stacked-16 cap plateau confirmed (0.0625–0.25 range 0.01, pinned 0.40 = best neighbor); caps ≥ 0.25 are no-ops (self-diversification)** | `e132_stacked_cap.js` (4/4, artefact `results/e132_stacked_cap.json`, registered in `run_all.js`): cap ladder 0.0625–0.5 on the window-matched stacked-16 grid (e124 plumbing, 2466 buckets) through the repo's own `buildFundingBook` (pinned λ 0.02) + `cleanBook` + sleeve returns @ 4bps. The 0.25/0.5 lanes are identical — no 16-wide L1-normalized weight ever reaches 0.25. Reading: the pinned 12.5% ports to the 16-panel unchanged (TODO 116/118 de-risked); e131 regressed 4/4. No spec change, no TODO. No repo change; no golden moves |
| F-146 | can a funding forecast beat fixed EWMA at rank persistence? (round-105 e133, 2026-10-01) | **NEGATIVE — AR(1) predicted ranks rho1 0.70/0.72 beat raw (0.52/0.42) but lose to manufactured 0.992 on both panels; fixed EWMA stands** | `e133_predictive_smoother.js` (4/2, artefact `results/e133_predictive_smoother.json`, registered in `run_all.js`): causal recursive AR(1) (trailing-168 OLS, 24-pair warmup) per funding series, rank the one-step predictions, same rho curve as e129 (majors 6606 / midcap 2466 buckets). Plumbing green (finite curves; smoother replicates e129's 0.992). Reading: forecastability exists (consistent with 1912.03270) but construction beats prediction by 0.27–0.29 — the 10g idea is consumed, no bigger-forecaster variant (gated behind this bar per 2603.16886). No spec change, no TODO. No repo change; no golden moves |
| F-147 | where does cost eat the pinned carry book? (round-106 e134, 2026-10-01) | **NEGATIVE-on-the-letter — majors crosses above the ladder top (net +0.16 at 25bps, BE 42.88); stacked crosses at 25bps (−0.02, BE 24.11); mechanism + coherence hold** | `e134_cost_ladder.js` (4/3, artefact `results/e134_cost_ladder.json`, registered in `run_all.js`): pinned book (λ 0.02, cap 12.5%) at 0/2/4/10/25 bps on majors-full (6606) + window-matched stacked-16 (2466) through the repo's own construction + scoreBookReturns. Monotonic fall + finiteness + 4bps coherence pass (both lanes reproduce e131/e132 to the digit). Curve recorded: majors 0.38/0.36/0.34/0.29/0.16, stacked 0.48/0.44/0.40/0.28/−0.02 — sets native expectations for TODO 118. No re-run (gate-shopping); no spec change, no TODO. No repo change; no golden moves |
| F-148 | does the port band transfer to the stacked-16 book? (round-107 e135, 2026-10-01) | **SUPPORTED — every band lane beats daily net at lower turnover (null 0.40 vs 0.005:0.43/19.9x, 0.01:0.44/15.2x, 0.03:0.42/8.8x); best 0.01, neighbor gap 0.00** | `e135_stacked_band.js` (3/3, artefact `results/e135_stacked_band.json`, registered in `run_all.js`): pinned capped-0.125 stacked-16 + band sweep at cost 4 through the repo\u2019s own cleanBook + scoreBookReturns. Null lane reproduces e132 to the digit (coherence). Native read for TODO 118: cap 0.125 + band ~0.01. No spec change, no TODO. No repo change; no golden moves |
| F-149 | is the stacked band pick stable out of sample? (round-108 e136, 2026-10-01) | **SUPPORTED — trailing pick 0.01 at ALL 8 splits; frozen-eps and fixed-0.01 beat daily 8/8; coherence reproduces e135** | `e136_stacked_band_holdout.js` (4/4, artefact `results/e136_stacked_band_holdout.json`, registered in `run_all.js`): dense-split holdout on the pinned capped-0.125 stacked-16 book at cost 4 through the repo\u2019s own construction + scoreBookReturns. TODO 118 keeps cap 0.125 + band 0.01 with maximal pick stability. No spec change, no TODO. No repo change; no golden moves |
| F-150 | is the scoring path exact? (round-109 e137, 2026-10-02) | **SUPPORTED - all 27 guards exact: clip/band/clean composition, uniform cost, BE identity, sizing, diagnostics, G5 conjunction** | `e137_portfolio_audit.js` (27/27, artefact `results/e137_portfolio_audit.json`, registered in `run_all.js`): first audit of `analysis/portfolio.js`, which every e123-e136 number flows through, against independent recomputes. Cap-then-band order is load-bearing (edge witness [[0.12,0],[0.14,0],[0.12,0]] reads [0.12,..] vs [0.125,..]). No L10 rows (nothing found). No spec change, no TODO. No repo change; no golden moves |
| F-151 | is the tree coherent after 30 rounds of splits? (coherency sweep, 2026-10-02) | **SUPPORTED — 0 dead relative targets (repo 210 files + lab 149 cross-tree); 78 unused bindings removed across 26 files, full browser suite 3123/0 with ledger counts bit-equal, e136 4/4 + e137 27/27 re-green; 10l carryovers closed as sweep 10m (2604.19604v6 → TODO 95 borrow/margin leg, 2407.12150 → band convergence); backlog reranked, 6 items archived (91/92 gate-unopenable, 98/100/103/108 superseded/consumed)** | no experiment (sweep record `cycles/CYCLE-140.md`): unused-import cleanup (empty statements kept as side-effect imports, all 26 re-parsed), doc sync (INDEX F-150 + 145 steps, READMEs), TODO rerank + archive notes, 10m raw `docs/research/raw/arxiv-sweep-2026-10m.json`. No scored-path change; no golden moves; `npm test` owed (R109 + sweep) |
| F-152 | is the module graph + registry coherent? (sweep S2, 2026-10-02) | **SUPPORTED — 20/20 shims exact both directions (0 dangling imports in 452 files); 0 import cycles, 0 CJS leftovers; ledger 32 entries = 3123 + bench = 33; node 24+8+13 = 45 with 1:1 mirrors; lineage 37/37; 11 goldens; 112 registry keys; 4 red result steps are the published falsifiers firing to the digit** | sweep record `cycles/CYCLE-141.md`: two doc fixes (RUNBOOK 13th suite, runs-README missing-artefact marker); 6 dead-surface exports + BUGS #50 + "50 gated" deliberately kept with reasons. No code change; no golden moves; `npm test` still owed |
| F-153 | do the docs agree with each other? (sweep S3, 2026-10-02) | **SUPPORTED — 12/12 DROPPED branches named in DROPPED.md; FOLD-BACK queue current (R6-dropped converges with the TODO-91 archive, R9 latent, R7/R8 banked); two staleness gaps closed (R8 stacked-16 band 0.01 status, THEORY J5 V2.2-risk update)** | sweep record `cycles/CYCLE-142.md`. Docs only; no code change; no golden moves; `npm test` still owed |
| F-154 | are the lead files current? (sweep S4, 2026-10-02) | **SUPPORTED — archived-item cross-refs all historical; PROTOCOL compound-status drift blessed; 5 lead files refreshed to their latest measurements (L16/CYCLE-138, L17/CYCLE-134, L18/CYCLE-108, L09/CYCLE-129, L03/CYCLE-126), verdicts unchanged** | sweep record `cycles/CYCLE-143.md`. Docs only; no code change; no golden moves; `npm test` still owed |
| F-155 | anything dead after the S1 cleanup? (sweep S5, 2026-10-02) | **SUPPORTED — 23 dead imports across 16 files removed (ES imports out of S1 heuristic range + 9 split/shim leftovers + 1 test name, in two batches), full tree 303 files with 0 dangling / 0 cycles / 0 CJS; 10l snapshot repaired (stray bracket); sweep 10n (3/3 queries, 2 new notes for TODO 87/95, rest convergences); no closes, gate grows** | sweep record `cycles/CYCLE-144.md`: every removed name import-line-only + cross-file-checked; harness PROJECT kept (internally used); registry note corrected (procedures.js owns the safeRatio import). AI-side: analysis 856/contracts 255/locks 41/modules 59/walkforward 90/analyze 294/features 11/golden 23/multiprobe 77/querymod 51/legion 57 all 0-fail, e58 39/39 + e63 11/11 validationPass. No scored-path change; no golden moves; `npm test` owed (R109+S1+S5) |
| F-156 | is the tree still coherent after S5? (sweep S6, 2026-10-02) | **SUPPORTED — alias-aware re-scan: 0 dead imports (210 src files + tests), 0 dangling, 0 cycles; run_all 152 steps cover all 138 experiments; ledger 33 entries / 45 mirrors matches; all 18 split shims present; summary table F-01…F-155 complete (full rows stop at F-81 by design); live page-ESM smoke on port.js + streams.js; no closes, docs-only** | sweep record `cycles/CYCLE-145.md`: S5's 23 removals verified absorbed; ledger-shape audit closed (heading count ≠ ledger); src/README counts corrected; lab STATUS.md pointer added. No scored-path change; no golden moves; `npm test` owed (R109+S1+S5, gate does not grow) |
| F-157 | does every split shim load outside the harness? (shim audit S7, 2026-10-02) | **SUPPORTED with one latent fix — 10/11 shims load raw; `src/analyze.js` carried a static `node:url` import (L10-cu) that breaks non-harness linkage; guarded to a dynamic import with the exact CLI dispatch preserved; no measured number moves** | sweep record `cycles/CYCLE-146.md`: pre/post page-ESM probes, importer census (fold_worker + 3 node tests + browser entry via cli.js), type/engines legality. No scored-path change; no golden moves; `npm test` owed (R109+S1+S5+S7 fix) |
| F-158 | does the lock-registry match the tree? (registry census S8, 2026-10-02) | **SUPPORTED — 916/916 declared export names resolve across 112 registered files (ANALYSIS 65 + CORE 31 + SUPPORT 16); 30/30 proves refs resolve; 72/72 lead experiment cites resolve; capability-shaped registries exempt by shape; no code change** | sweep record `cycles/CYCLE-147.md`: comment-stripped parser with `export *` following (first pass false-positived on comment apostrophes). No scored-path change; no golden moves; `npm test` owed (unchanged) |
| F-159 | do the docs' file:line refs survive 30 splits? (reference census S9, 2026-10-02) | **SUPPORTED — 301 refs censused; 6 stale-file hits all exonerated (quoted text, examples, workspace-relative paths that exist); 12 stale line-numbers are pre-split coordinates in frozen records; standing rule: round ≤83 coordinates address pre-split files, live docs cite part paths; no change** | sweep record `cycles/CYCLE-148.md`. No scored-path change; no golden moves; `npm test` owed (unchanged) |
| F-160 | does any importer wire the wrong duplicate export? (collision census S10, 2026-10-02) | **SUPPORTED with two latent rows — 883 names, top-30 all benign shim chains; L10-cv: `sharpeStandardError` is two formulas (Lo-object vs scalar) with correct importers; L10-cw: weight tools live twice (core ships, portfolio tested, 1-guard drift, single-source proposed); `meanOf` overload benign; no change** | sweep record `cycles/CYCLE-149.md`: full census + body diffs + importer tracing. No scored-path change; no golden moves; `npm test` owed (unchanged) |
| F-161 | is the research ledger in sync? (ledger sync S11, 2026-10-02) | **SUPPORTED with one gap closed — 43/43 raw snapshots parse and listed; 11/11 goldens present (6 hm: + 5 ctl:); FOLD-BACK current except R4, which lacked its round-78 native `--carry-marks` port status (appended); rerank unchanged; docs-only** | sweep record `cycles/CYCLE-150.md`. No scored-path change; no golden moves; `npm test` owed (unchanged) |
| F-162 | do the quoted numbers add up? (ledger arithmetic S12, 2026-10-02) | **SUPPORTED — 32-row table sums to exactly 3123 (bench off-table by design); TODO-cited midcap/midcap2/midcap_funding dirs all 9 files; THEORY corrections folded in; rerank unchanged; docs-only** | sweep record `cycles/CYCLE-151.md`. No scored-path change; no golden moves; `npm test` owed (unchanged) |
| F-163 | is the owed native gate closed? (gate-close + re-verification S13, 2026-10-02) | **SUPPORTED — operator `npm test` 132/132, 0 fail, ~350 s (covers R109 + S1/S5 cleanups + S7 dispatch guard; S8–S12 docs-only); S7 fix intact, 0 dead imports (1 flag exonerated: `contracts.test.js` `{run}` is used), 0 dangling/cycles, run_all covers 138/138, 81 full + 81 summary rows complete, registry/ledger untouched** | sweep record `cycles/CYCLE-152.md`. No code change; no golden moves; no owed gate remains |
| F-164 | does any open item close now that the gate is green? (opens audit S14, 2026-10-02) | **SUPPORTED — all 18 opens re-checked against the only delta (a clean gate + docs): operator queue 116→118→117 still operator-owed; 84/85/87 wait on native runs; 86/97/62 need native A/B; 90/104 wait on a sized win; 106 on a fresh year; 95 on borrow/margin; 55 idea store; 14 background; 111/94q/96 data-blocked; L10 ongoing by charter; archive bar not met, no archives** | sweep record `cycles/CYCLE-153.md`. Docs only; no code change; rerank unchanged |
| F-165 | do the pointers agree with the tree? (doc sync S15, 2026-10-02) | **SUPPORTED — STATUS counts → 165 findings / cycles 000…154 / gate CLOSED; src/README native date → 2026-10-02; INDEX rows 152–154; TODO S13–S15 note; RUN-ANALYSIS §§67–69; post-write grep: no live "owed" line remains** | sweep record `cycles/CYCLE-154.md`. Docs only; no code change; no golden moves |
| F-166 | is the tree ready for Phase A? (pre-point sweep S16 + 10o + recipe audit, 2026-10-02) | **SUPPORTED with one gap to fix — 0 dangling (210+93 files), new plan refs resolve, run_all/ledger unchanged; sweep 10o grounds 4 notes (trend-demise convergence, crowding task form, map-scale joint rule, vol level-alignment checklist with queued experiment); recipe audit: filenames align, --symbols=all is manifest-driven (minRows 19_000 for midcaps), but no CLI path scores a non-pinned risk spec (A2 band read blocked) + --symbols help goes stale at 116** | sweep record `cycles/CYCLE-156.md`: raw snapshot `docs/research/raw/arxiv-sweep-2026-10o.json`. No code change; GAP 1 becomes round 110 |
| F-167 | does the A2 band read have a CLI path? (round 110, 2026-10-02) | **SUPPORTED — opt-in --sleeve-cap/--sleeve-band (parseSleeveRisk, undefined=pinned/none=removed/validated, garbage throws naming the flag), threaded scoring→report→driver→CLI with run.json/report.json/summary echo + `sleeve-runs.sh band` stage; pinned specs unmoved, no golden moves; AI-side analyze 298/298 (4 new §S1), ledger 3127, 133 test() blocks; native gate owed** | repo record `RUN-ANALYSIS.md` §72, lab record `cycles/CYCLE-157.md`, TODO 120 closes on the gate |
| F-168 | does the vol tournament survive level alignment? (e138, 2026-10-02) | **SUPPORTED 8/8 — repo EWMA/AR/MSE/QLIKE match independent recomputes; AR>EWMA>flat premise holds 5/5 on AR truth; train-half alignment never flips; QLIKE agrees 5/5; raw-MSE flip needs >= 1 vol-sigma bias (median 1 sigma) — no L10 row, the 10o checklist closes as a confirm** | lab record `cycles/CYCLE-158.md`, artefact `results/e138_vol_level_alignment.json`, registered in `run_all.js` (139 experiments) |
| F-169 | full controller→core map: what works, what's wrong, what gets replaced? (CYCLE-184, 2026-10-02) | **MAPPED — L0 candles→indicators→features through L6 unwired evolve.js with file paths; WORKING: indicator math, fail-closed predict/train, QKV+FFN+RoPE numerics, persistence, pool/watchdog, analysis battery; 5 INCORRECT-AS-DESIGNED (mean-pool order-free readout, ~60-bar from-scratch vs base rate, negative-skill distillation, dead-path LSH upgrades #44, six-boost consensus); 8 NEEDS-TESTING probes (context-attention leakage, score-reuse coupling, distill-vs-uniform, TODO 62 drain age, M4 reachability, #54 sample-weights, A17 optimizer ablation, sandwich contribution); 9-row REPLACEABLE table (AdamW+cosine+clip, EARCP coherence gating, LoRA-frozen, linear/mixer-first then TSFM-probe, HAR-anchor+gated residual, denoise-first, Hankel-Toeplitz, TSFM-vs-HAR, Brier-skill consensus) with groundings+gates; research re-sync, no new sweep** | lab record `cycles/CYCLE-184.md`. Docs only; no code change; no operator load; M1 execution FIRST, M4 parallel, M3 after M1, S6e on allocation track |
| F-170 | one level deeper: regulation-layer mechanism + 10v research deltas (CYCLE-185, 2026-10-02) | **MECHANISM — spec-modulation rewards dispersion×performance so at zero skill it amplifies confident noise into every Q/K/V+FFN projection (teacher = amplified noise; A17 sharpened to identity-spec + AdamW + clip ablation, delete on no-Brier-move); broadcast path quantified (real candidate set built, then discarded — M4 acceptance: recall-measured route into live reader or PARK); RMSNorm/RoPE textbook-exact, keep; DELTAS — TSFM-probe confirmed 29/30 (M1 probe≥backbone expectation), EGGROLL-v2 keeps quadratic-exactness but adds nonconservative-mean-field/finite-pop caution (M5 population rule), AdaRDiff queued as M1-ext trigger, attention-pooling query 0 results (no claim)** | lab record `cycles/CYCLE-185.md`, raw `scratch/sweep-10v-*.xml`. Docs only; no code change; no operator load; work orders M1/M4/A17/M3/S6e + gates |
| F-171 | survival-cap run: what sizes the operating book? (S6e, CYCLE-186, 2026-10-02) | **DECIDED 6/6 — unit maxDD 0.072% / Calmar 52.7 / worst bar −6.44 bps (the Sharpe hides a ripple); maxDD-sizing VOIDED (Ldd20 = 277×, same pathology as vol-target); governor INERT in-window (0.71 vs 0.72) and slightly ADVERSE under ×3 spike (1.58 vs 1.55) — credited nothing; gap ladder binds: operating L≤5 at 100 bps/5% judgment, gross ≤$11.5M ⇒ equity ≤$2.3M; research 10w (2607.23068: leverage is a variance question)** | lab record `cycles/CYCLE-186.md`, vehicle `experiments/s6e_survival.js`, artefact `scratch/s6e_result.json`. Standalone; no repo change; no golden moves; no operator load |
| F-172 | M1 phase 1: can any runnable model class beat the base rate on 8h direction? (CYCLE-187, 2026-10-02) | **VERDICT 3/3 (53,316 pooled rows, 6 blocks) — ridge/toeplitz 0.24906 skill +0.0038 DM p≈0.001 MCS-SURVIVE (TARGET nearly-binding: whisper, not edge); MLP 0.25002 ≡ base p=0.76 MCS-eliminated (ARCHITECTURE fires vs from-scratch small nets, converges NL-BENCH/G-A); persistence 0.344 dies; denoise no-op (raw 0.24906 vs EMA 0.24909); ridge structurally guarded (own intercept, solve-diff exactly 0 — L10-bl avoidance); phase 2 native-queued (TSFM-probe + controller arms)** | lab record `cycles/CYCLE-187.md`, vehicle `experiments/m1_benchmark.js`, artefact `scratch/m1_result.json`. Standalone; no repo change; no golden moves; no operator load |
| F-173 | M4: do the LSH upgrades earn a scored-path route? (CYCLE-188, 2026-10-02) | **PARK 3/3 both fixtures — easy fixture ceilinged at recall 1.0 (upgrades add only +14–16 candidates cost; hardened to 400 protos/12 bits/σ0.35 same cycle); hard: default 0.887 / +multiprobe 0.987 / +querymod 0.967 / +both 0.987 — lift exactly on the +0.10 boundary → rule-as-coded PARK; multiprobes recorded as probe-of-choice for any future live-reader build (+own unit test 0.033→0.30); binaryPC/bitweight untouched (pca-hash is live per R27-2, stays default-off)** | lab record `cycles/CYCLE-188.md`, vehicle `experiments/m4_recall.js`, artefact `scratch/m4_result.json`. Pure, no data files; no repo change; no golden moves; no operator load |
| F-174 | M3: what unlocks the e115 execution uses? (CYCLE-189, 2026-10-02) | **SPEC-DELIVERED (docs-only, no build possible) — same-venue L2 (≥10 levels, ≤1 s) + trade prints (taker flag, exchange ts) + latency logs, ≥6 months overlapping the e115 window, exchange-ts sync (a harvest missing any stream does not unlock); pre-registered E-a (adverse-selection avoidance) + E-b (taker-timing) with bps-per-real-fill gates vs e25 baselines + side-control; research 10x (2606.09454 spread decomposition, 2508.20225 quoting under adverse selection, 2603.07752 slippage/rejection feedback)** | lab record `cycles/CYCLE-189.md`. No vehicle (data-blocked by design); no repo change; no operator load |
| F-175 | coherency sweep + S6f harvest go-ahead (CYCLE-190, 2026-10-02) | **SWEEP GREEN — 190 cycles = 190 INDEX rows, 174 finding rows (F-01…F-174), 146 experiment files = 139 run_all + 6 standalone + run_all itself, 3/3 scratch artefacts; one doc bug fixed (F-148…F-154 leading pipes); no repo files touched CYCLE-184…190 → no re-gate owed, native gate stays CLOSED. S6f GO-GRANTED: 8-midcap OI harvest spec (binance-vision metrics zips, oi_8h.json grid+schema, null-missing, e14-mirror integrity); operator downloads + pastes CSV header; aggregator next cycle** | lab record `cycles/CYCLE-190.md`. Sweep + spec; operator download block issued |
| F-176 | script-format fix + bug/sanity re-check (CYCLE-191, 2026-10-02) | **COMMANDS-ARE-SCRIPTS LOCKED (PLAN conventions) — S6f block re-shipped as `scripts/s6f-oi-harvest.sh fetch\|sample\|all` (writes $OUT_DIR only, no repo reads, no test surface). RE-RUN ALL GREEN BIT-IDENTICAL: s6e 6/6 (L=5), m1 3/3 (ridge 0.24906), m4 3/3 + hard 3/3 (0.887/0.987/0.967 PARK). Two self-caught issues fixed: stray `scratch/s6ee_result.json` deleted (canonical s6e artefact verified intact), `scratch/m4_result.json` restored as the honest {easy, hard} pair. Shell hazards swept (`\|\| true` on ls-empty/SIGPIPE, lexicographic month cap, overridable OUT_DIR)** | lab record `cycles/CYCLE-191.md`, script `scripts/s6f-oi-harvest.sh`. Operator command: `bash scripts/s6f-oi-harvest.sh all` |
| F-177 | lab purge + core-code unlock audit (CYCLE-192, 2026-10-02) | **PURGE — allocation track S0–S6e ARCHIVED (verdicts stand, no further work), S6f PARKED (harvest cancelled), M3 builds + M1p2 PARKED (nothing asked), operator queue CLOSED (nothing owed), leads L01–L19 ARCHIVED, ports/V2 out of scope, speculative data pulls BANNED. UNLOCK — every core-code piece judged: KEEP (L0 indicators/features, L1 shell+honest labels, L2 shell, L3 numerics, L4 memory machinery, L5 P0 infra, L6 evolve.js pure, full analysis battery as referee); REDESIGN (C1 mean-pool readout FIRST, C2 optimizer/spec stack + distillation probe, L5 skill-weighted aggregation, C3 broadcast route-or-delete); PROBE (drain age, sandwich contribution, context-attention leakage, score-reuse shuffle, #54 sample-weights); PARKED (homeostasis/surprise off-proven, LSH upgrades, M5 behind skill). Live queue: C1→C2→C3, each with test script + golden re-freeze rule** | lab record `cycles/CYCLE-192.md`. Docs only; no code change; no data pulled; no operator load |
| F-178 | controllers-to-core map v2, code-verified (CYCLE-193, 2026-10-02) | **MAP v2 — every anchor read from source. Three corrections: (1) C3 REFRAMED — `_retrieveTopRelevantProtos` (retrieval.js:45) already IS the live scored reader (R27-2 + called by `_contextAwareAttention` attention.js:192); dead path is only global-candidates→broadcast, so C3 = wire upgrades into the LIVE reader or delete broadcast; (2) sandwich = one scaled task update + KD per window (apply/rollback only materialises the clone — simplify, no behavior change); (3) optimizer is moment-free SGD → C2 AdamW is a class upgrade. scores.js mechanism pinned: Brier root (1−brier EMA) diluted by 0.6/0.4 trust blend + trust×spec weights (NOT proper-score weights); specialization rewards |z| dispersion; laggard-rescue LR (+PROBE); agreement_dL herding auxiliary (REDESIGN: skill-gate/remove). Legion pinned: prob×score double-counts confidence × six boosts; top-30% noise seeds; 1.4/0.6 tier prior. Memory explorationRate hits 2.25 with overconfidence raising spend (PROBE). Research appendix banked (DLinear/AdamW/proper-scores/KD/TSFM/EGGROLL/Hedge); three new needs gated behind code progress** | lab record `cycles/CYCLE-193.md`. Docs only; no code change; no data pulled; no operator load |
| F-179 | deep layer: features/labels/sharing/init + fresh research 10y/10z (CYCLE-194, 2026-10-02) | **FEATURES — `_chooseDimension` is pure shape-packing (no data criterion; replace by validation dims post-skill); tier>1 sees NO market data by construction (memory summaries only → PROBE tier>1 vs tier-1 Brier, hierarchy may be a noise amplifier); `_computeProtoQuality` exponents (−1.5/0.8/−1.2) arbitrary (PROBE quality-sort vs random); 0.5 non-finite fill not provably neutral (PROBE post-skill). LABELS — outcome-vs-entry features, FIFO lag = queue length; Brier ledger proper (KEEP); sha256 dedup trains repeats once (KEEP). SHARING — `_hiveMemorySharing` is the LIVE evolutionary transfer (donor 0.45/0.25/0.3 rank; re-rank by skill in S7 pass). INIT — depth-scaled init + LR cap reasonable (KEEP; revisit in C2). RESEARCH 10y/10z (4 grounded): 2610.01831 uniform-pool beats learned-weighting in ICL (C1 must A/B/C last/uniform/learned — learned may lose); 2510.03339 pooling-choice (read pre-C1); 2308.15384 hedged forecast combination + 2210.07169 calibration (ground S7 redesign)** | lab record `cycles/CYCLE-194.md`, raw `scratch/sweep-10y-readout.xml`, `scratch/sweep-10z-hedge.xml`. Docs only; no code change; no data pulled; no operator load |
| F-180 | final gap layer: prune/promotion, warmups, leakage recipe (CYCLE-195, 2026-10-02) | **PRUNE — mechanics KEEP (bounded window + bank-carries-tail = interference-wall 2609.16183 argument); promotion budget INVERSELY tied to skill (`0.25+0.5×(1−perf)` — worst members archive most → PROBE sign-flip, possibly actively harmful). Bank architecture is the best-grounded half (Titans/Mela/eviction/Hopfield/SDM restated); dynamics (promotion/prune-score/explorationRate) are the ungrounded half — all queued. WARMUPS — EMA-100 never warms up on ~60-bar windows (slowest channel = transient response; drop-probe post-skill); equity-daily windows unvalidated on 8h (sweep post-skill). LEAKAGE — full world.js-pattern audit recipe specified (base/probe/vacuity arms, one session, runs before any post-C1 A/B is trusted). Round-30 note = archived-side provenance, no action. MAP COMPLETE (184 skeleton → 193 mechanisms → 194 deep layer → 195 gaps); live queue final: C1 → C2 (+4 free probes) → C3 → leakage recipe** | lab record `cycles/CYCLE-195.md`. Docs only; no code change; no data pulled; no operator load |
| F-181 | pre-C1 pooling brief + consolidation scoring audit (CYCLE-196, 2026-10-02) | **POOLING — 2510.03339 abstract: closed-form pooling-expressivity bounds across attention variants incl. time-series, with task-specific guidance (full text = first step of C1; abstract saved `scratch/paper-pool-me-wisely.txt`); with 2610.01831, C1 A/B/C is literature-shaped. CONSOLIDATION — memory score = 6-term sum (weights sum 0.95) × confidence × uniqueness^1.5 × diversity × recency, ALL constants unvalidated → PROBE weight-perturbation sensitivity (±20% flip test); sharpness-term asymmetry double-counts recency (fold into probe). Merge threshold ADAPTIVE 0.40–0.92 (KEEP — rare self-tuning constant). Standing probe pool now 10 (same-harness, ride C2); post-skill list unchanged** | lab record `cycles/CYCLE-196.md`. Docs only; no code change; no data pulled; no operator load |
| F-182 | C1 readout A/B/C executed — order does not matter, C1 closed (CYCLE-197, 2026-10-02) | **C1a (`experiments/c1_readout.js`, 53,316 rows, same frame as M1): Brier base 0.25000 / meanpool 0.24995 / lastpos 0.24994 / learned 0.24995 / flatridge 0.24906. lastpos-vs-meanpool DM p=0.925 (ORDER IRRELEVANT); learned-pool GD collapses to EXACTLY uniform (16×0.0625 — learned finds nothing); MCS survivor flatridge alone, all scalars eliminated. Pre-registered rule fires: readout NOT binding → C1 CLOSED with NO repo edit (goldens untouched for zero gain). Position-specific linear weights beat every scalar head → constraint is TARGET/class (converges M1/ARCHITECTURE). Coherency pre-check green (197/197 files, 181 rows, 146 experiments — 1-count drift fixed). C2 QUEUED-FIRST (repo-trainer A/B ships as operator script if harness cannot run it)** | lab record `cycles/CYCLE-197.md`, vehicle `experiments/c1_readout.js`, artefact `scratch/c1_result.json`. Standalone; no repo change; no golden moves; no operator load |
| F-183 | C2 probe battery + native ablation shipped (CYCLE-198, 2026-10-02) | **HARNESS (all green): scorer ROBUST (twin bit-equal 4.4e-16; ±20% perturbations median keep-flip 0.05 < 0.20 bar → keep as-is); uniqueness #54 NEUTRAL (weighted≡unweighted 0.2494, DM p=0.026 with zero effect → default-off stands); ensemble adamw 0.24925 < sgd 0.24992 (supports C2 swap), distill arms ≡ sgd (supports deletion), laggard ≡ sgd (supports removal). NATIVE SHIPPED: `scripts/c2-ablation.mjs` + `scripts/c2-optimizer-ablation.sh gate|runs|all` (stock vs clip-only vs AdamW on real forceMin trainer, frozen marks_8h folds; instance patches only, golden-safe) — operator runs, proof-back unblocks delete/adopt. RESEARCH 11a thin; 11b = 2608.31046 (noisy-teacher distillation ignored by student — supports uniform-teacher framing)** | lab record `cycles/CYCLE-198.md`, vehicle `experiments/c2_probes.js`, artefact `scratch/c2_result.json`, scripts `scripts/c2-ablation.mjs` + `scripts/c2-optimizer-ablation.sh`. Additive scripts only; no locked edits; no golden moves |
