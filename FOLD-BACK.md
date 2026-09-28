# FOLD-BACK — how a lab idea becomes a repo change

The lab never edits the repo. An idea graduates by an explicit, pre-registered port, and the port is
judged by the repo's own gates. This file is the contract; the candidate list below is the current queue.

## The port contract

A lab result may be ported only if all of these hold:

1. **It has a `FINDINGS.md` row with a number**, and the experiment reproduces it
   (`RUNNER.md`, same result to display precision).
2. **It does not move a golden** (`golden.test.js` 23/0) unless the change is *math on the shipped path*,
   in which case the re-freeze is deliberate and documented (`OPTIMIZATION.md` is the precedent).
3. **It declares its effect on the test ledger.** Any new check updates `RUNBOOK.md` §6, `README.md`,
   the node mirrors and `test/lock-registry.js` in the same change (the repo's standing discipline).
4. **It is registered.** A new signal/arm is added to `src/lineage.js` + `docs/lineage.json` with a state
   (`UNTESTED` on landing), never silently into the roster — the roster's `K` is a pre-registered number.
5. **It is measured under the project's gate**, not the lab's: the lab's number says "worth porting", the
   repo's gate says "promoted".
6. **It names its own falsifier** — the measurement that would kill it.

## The queue

Ordered by expected value for the project's *decision quality*. R1–R3 are measurements, not strategies:
they do not need a promotion to be worth shipping.

> **Priority order (2026-10) — the round-31 pivot.** The project's plan
> ([`../NeuLegion-master/NeuLegion-master/docs/PLAN-round31.md`](../NeuLegion-master/NeuLegion-master/docs/PLAN-round31.md))
> now ports the queue in this order, because the lab + the run corpus jointly establish that the
> learned layer is inert and the edge is structural: **R1/R2/R3 first** (decision soundness — cheap,
> no promotion, highest EV), then **R4/R7/R8** (the carry complex — the only measured positive,
> independent return source) as first-class sleeves with the risk/portfolio layer (`prototypes/port.js`
> is the port artefact), then **R5** (independence) and **R9 only if** a fixed-label offline model is
> ever added (currently latent). **R6 is dropped** (F-35). The repo-side plan is W1–W6 with gates
> G1–G5; G5 (a bankable positive full-history net-of-cost portfolio) is the goal.
>
> **Progress (CYCLE-066): the R7/R8/OI complex is LANDED in the repo.** The V2.2 plugin layer
> (`core/primitives/*` + `plugins/sleeves/*` + `plugins/risk/cap-band.js` + the registry) carries the
> three pinned specs, and `e73_port_verify.js` (F-81) proves the repo reproduces the lab's published
> books bit-for-bit on the real panel. They are **UNTESTED** until the repo's own gate scores them
> (round-31 W2/W3; `MIGRATION-V2.md` §8). R1/R2/R3 (the measurement ports) are **not yet** ported.

### R1 — A model-free long-sample scoring path. *(highest value; from F-01)*

**What.** Score the parameter-free signal/reversal/SIGUP arms over the **whole** available history
(per stream, contiguous), and print them beside the 600-bar walk-forward. The model/controller arms keep
the `--bars` restriction (they are O(n²)); the signal arms do not.

**Why.** F-01: the reported `sig-momentum` +1.0848 is +0.110 over 53 500 bars; `netmom-16` reads +1.45 in
the verdict window with a full-history Sharpe of +0.009. Without this, the verdict cannot distinguish a
strategy from a regime.

**Where.** `analyze.js`: the signal family is already pure (`analysis/features.js#positionAt`); the scorer
is `analysis/backtest.js#backtestMetrics`. A `--bars=full` (or `--history=full`) that bypasses
`readCandles`' tail-slice for signal-only arms, plus a report block, is the minimal change.

**Verify.** The lab's `e2_arm_sweep.js` full-history column is the expected output, arm-for-arm.
**Falsifier:** if the long-sample readout and the 600-bar readout agree, F-01 is wrong.
**Status (CYCLE-002):** falsifier tested and survived — `e0d_ab_aggregation.js` runs the repo's own
fold+pool path and reproduces the window effect (F-13: +1.106 @600 vs +0.109 @full). Two
implementation notes for the port: (i) for a parameter-free signal a contiguous scorer is *equivalent*
to the walk-forward path (F-13), so R1 need not pay the O(folds) dependence cost; (ii) on this data
`poolReports`' `dependenceSummary` is ~155 s at 3562 folds — the dominant cost, ~600× the scoring
(F-14) — so bound the cluster count or keep the long-sample path dependence-free.

### R2 — Window robustness as a reported statistic and a gate input. *(from F-01, J2)*

**What.** `blockStability(returns, k)`: split the scored series into `k` disjoint windows, report each
window's Sharpe, the positive fraction and the min/max; add it to `pooledMetrics`/the decision block, and
(optionally) require `positiveFraction ≥ threshold` in `promoteDecision`.

**Why.** It is the cheap statistic that would have caught J1. `accel-16` 6/6 positive vs `mom-48` 5/6 with
a *sign flip* between windows.

**Where.** `analysis/walkforward.js` next to `foldWinFraction`/`clusterStability`; `analyze.js` decision
block. **Verify:** `walkforward.test.js` exact fixtures (the repo's style for every statistic).
**Falsifier:** if block-stability does not separate the arm that survives the full history from the one
that does not, it is not the right statistic.

### R3 — Score every candidate at a realistic cost by default. *(from J4)*

**What.** Report the full-history break-even and the `netSharpe` at 5 and 10 bps in the decision block,
not only the ladder at the run's single `costBps`.

**Why.** F-01/F-06: full-history break-evens are 1–2.6 bps; the 600-bar window reads 12–19 bps. The cost
verdict is currently window-dependent.

**Where.** `costLadder` already exists; this is a reporting default. **Verify:** no golden moves (pure
reporting).

### R4 — Carry must be scored basis-marked. *(from F-04)*

**What.** The P4 sleeve's reported metric must be the delta-neutral P&L (`spotRet − perpRet + funding`,
perp leg = the funding row's `markPrice`), with the raw funding series shown only as a yield, clearly
labelled. Inverse-vol weight across symbols (BNB's carry is negative over the sample).

**Why.** F-04: the raw series' Sharpe of 11.58 is an accounting artifact; the honest book is a real
stream with a real tail — on the full 6.0-year history, Sharpe **4.54** with a **7.96 %** drawdown
(0.96 / 10.2 % on the old 2.9-year window; F-19), and it is still the most useful *independent* stream
the project has (r = 0.09). BNB and SOL have no carry at all and carry the tail, so equal weight is
wrong.

**Where.** `analysis/carry.js` (`carryReturns` → a `carryBookReturns(rows, spotLookup)` that marks the
basis). **Verify:** `analysis.test.js` exact vectors. **Falsifier:** if the marked book's Sharpe is not
materially below the raw series' on a fixture, the marking is not the issue.

**Status (CYCLE-004):** the *sizing* half is now measured and supports the recommendation — inverse-vol
across symbols lifts the marked book's Sharpe 0.96 → 1.15 and trims the drawdown 10.2 % → 9.4 %
(F-16B). Causal vol-targeting goes much further (DD 10.2 % → 0.7 %, design effect 234 → 24) but the
resulting Sharpe (6.7) is explicitly **not** banked (F-11). So port R4 with the **inverse-vol** weights,
not a vol-target leverage.

**Status (CYCLE-006):** re-measured on the full 6.0-year history (F-16 revision): unmarked book Sharpe
**4.54** (DD 7.96 %), vol-targeted **8.05** (DD 1.33 %, design effect 99.5 → **6.0**), inverse-vol
across symbols **10.66** (DD 0.69 %). The sizing case is now stronger *and* better explained (it removes
the fat tail rather than amplifying calm periods), so vol-targeting is back on the table — but the
*level* still rests on one sample and on a mark-price perp leg, so **R4 was gated on L14** (now cleared
— see the CYCLE-007 status below). Also note
the series the port must reproduce is `e3_carry.js#loadCarryBook`, including the funding-bucket
aggregation and the candle-tail guard (F-18); a naive re-implementation of the join will understate the
sleeve by ~2× in either direction.

**Status (CYCLE-006, data side):** the repo's `carryOnBarGrid`/`carryPanelStream` join funding to the
bar grid — the same pairing that produced the four F-18 bugs. Before porting R4, check those two
functions for (a) a candle-tail guard, (b) sub-8h funding aggregation, (c) exact bar alignment; if any
is missing, that is a **shipped-path defect** and belongs in the same change (L10-d).

**Status (CYCLE-044, the pre-registered check — ANSWERED):** run by `e53_carry_grid_audit.js` (F-61).
**(a) candle-tail guard:** no bug — `carryOnBarGrid` never projects a funding row before the first bar, and
the funding files' 5-day tail past the candles is simply never reached, so a funding-only sleeve carries no
frozen-spot risk. **(b) sub-8h funding aggregation: MISSING** — the projection divides every funding row by
the *default* 8h bar count (`round(gridMs / firstBarStep)`) rather than the interval the row covers, so
sub-8h funding is understated `8h/interval` (**1×/2×/4×/8×** measured on a synthetic 8h period). It bites
the shipped SOLUSDT FTX window (**3.03×**, −0.107 vs −0.324) and — because the window's funding is
*negative* — it makes the pooled sleeve read **better** (ann **9.985 %→9.531 %**, Sharpe **11.96→9.60**), so
it fails safe and no "implausibly large" alarm can catch it. `auditFundingProblems` is blind to it
(**[]**). The module's own comment ("the bar-grid projection divides by the period actually observed") is
false of the code. **(c) exact bar alignment:** the ISO/ms coercion is present and correct; the
"most recent closed period at the bar's open" convention is causal (a one-period *lag*, not a look-ahead —
registered as L10-ad). **Port implication:** R4's port must use the **bucket-sum** projection (the lab's
`e3#loadFundingBuckets` / L10-o convention — sum the rows in each 8h bucket before projecting), and the
repo's fix belongs in `carryOnBarGrid` itself (bucket rows, or divide each row by the observed interval).
**The lab's own sleeve is already correct** (`e14#sub_8h_sleeve_equality` pins it), so R4's numbers do not
move — but a naive re-implementation that calls `carryOnBarGrid` does. **(b) is the "naive re-implementation
will understate the sleeve by ~2×" warning above, now quantified: 3.03× on the FTX window, and it flatters.**

**Status (CYCLE-007):** **un-gated.** L14 was the precondition and it is now resolved — with the perp
leg set to the *traded* price (`e15_traded_basis.js`, `data/perp_8h.json`) the flat book reads Sharpe
4.65 (vs 4.54) at a 7.96 % drawdown (vs 7.96 %), so the sleeve's Traded-vs-mark distinction is
immaterial at the 8h horizon (F-22). R4 is a live port candidate; the remaining work is the port's own
verification (fixtures + golden movement), not more carry research.

**Status (CYCLE-008):** **un-gated and now the priority.** The cost audit (F-23) asked whether the
sleeve survives its own fees and the flat book is the lab's *only* cost-robust sleeve: **0.2×/yr
turnover, break-even 5422 bps** — it clears every fee tier, and even re-hedging every 8h costs only
0.41×/yr. Inverse-vol across symbols (R4's weights) changes slowly, so this is a property of the
construction, not an accident. With R8 re-gated on cost (below), R4 is the port to do first.

**Status (CYCLE-010, optional add-on):** a **drawdown overlay** is now available for R4. CYCLE-010/F-25
found that a *smoothed, basis-z-timed* scaling of the carry book (`e18`, EWMA(0.1) on the reversion
`fade`) is tradable — net Sharpe **+4.05** at a 4 bps fee — but that is *below* the plain flat hold's
4.54, so it does **not** belong in the return path. Its value is risk: at equal gross exposure it caps
the drawdown at **2.09 %** versus the flat book's **7.96 %** (Calmar ≈ 4.1 vs 1.1). Port it, if at all,
as an **optional sizing/drawdown overlay**, and verify it as an overlay (does it cut R4's drawdown net of
cost without hurting net Sharpe?) before adding it.

**Status (CYCLE-011, size):** **R4 is the scalable sleeve.** The capacity audit (`e19`, F-26) put the flat
carry hold above $10 B (its "capacity" is only the one-off entry trade; the real limit is perp open interest
/ spot depth, unmeasured — L07), while the dispersion and timed-carry *improvements* are capacity-bound to
~$13 M and ~$95 M. So if the project wants size, R4 is the port to prioritise; the F-25 drawdown overlay
inherits R4's capacity (its own capacity is ~$95 M). A capacity-aware dispersion construction is L17.

**Status (CYCLE-013, size — now measured):** **the flat hold's real limit is open interest, and it is
small.** OI was the unknown in the line above; measured (`e21`, F-28), the flat book's `G/k` per symbol
reaches 1 %/5 %/10 % of the thinnest alt's open interest at **$6.9 M/$34.3 M/$68.6 M** (thinnest = LINK).
So R4's honest deployable size is **tens of millions**, not $10 B — the same order as the improvements'
impact limit. Combined, the whole carry complex is a **~$5–70 M strategy**. R4 is still the scalable
*relative to R8* and the priority port, but "scalable" now means ~$30 M, not billions.

### R5 — Cross-sectional demeaning as a variance-reduction primitive. *(from F-03)*

**What.** Generalise the lab's `xsMomentum` shape into the signal family: any feature can be scored
demeaned across the panel, and the report shows the resulting `designEffect`/`effectiveStreams`.
Not a new roster arm — a construction flag.

**Why.** F-03: design effect 4.92 → 0.39–0.60; effective streams 1.47 → 14–19. It is the plan's lever 2,
available for the cost of one subtraction. It buys *power*; the project should hold it ready for the
first sleeve that has an edge (carry is the candidate, R4).

**Where.** `analysis/features.js` (`crossSectionalReversal` is the existing precedent) + `analyze.js`
taxonomy. **Falsifier:** if a demeaned arm's full-history Sharpe is not at least the raw arm's, the
construction is destroying information (F-07 says exactly that for momentum — so port the *tool*, not the
arm).

### R6 — Re-aim the learner: meta-labelling over a rule. *(from J6, E-D)*

**What.** Change the controller's target from `P(next bar up)` to `P(a given rule's trade is profitable)`,
scored with the existing Brier/MCS machinery, and let its output drive **size/abstention**, not direction.

**Why.** G-A (no class beats the base rate on direction) + the lab's nulls say the current target is the
wrong problem; abstention/sizing is a decision the machinery can plausibly win.

**Where.** `analyze.js`'s label path (`labels.js` triple-barrier → a meta-label) + the controller's
position policy. **Verify:** the A/B's forecast block (Brier skill vs the *rule's* base rate).
**Falsifier:** Brier skill vs the rule's base rate ≤ 0 — then the machinery has no role and `NL-BENCH`'s
closure extends to the meta target.

**Status (CYCLE-018):** **falsifier tested and it FIRED — R6 is dropped, do not port.** `e26_meta_label.js`
(F-35) measured the target directly on three base rules (`sig-momentum`, `sig-acceleration`,
`sig-reversal`) at 1h and 15m with a purged expanding-window classifier and a shuffled-label null: the
out-of-sample **Brier skill vs the causal base rate is ≤ 0 for every rule** (−0.0003…−0.0013; the only
positive is +0.002 at one gradient iteration, and more capacity makes it worse). Pooled AUC ≈ 0.505–0.508
is a *detectable* rank whisper but not calibrated, and the abstention overlay reaches a positive net@4
only by keeping **0.3–0.7 %** of bars (at 15m the trend rules stay negative). So the meta-label target is
no easier than direction on this feature vector; **lead L06 closed NEGATIVE**. The reusable test
(`e26#causalOos`) stays available if a genuinely new feature family arrives.

### R7 — New data: open interest / liquidation / taker imbalance. *(from E-C)*

**What.** Extend `candle_fetcher.js`/`funding_fetcher.js` with Binance `takerBuyBaseVolume` (already in
the kline payload — free) and `openInterestHist`, then treat them as new panel streams.

**Why.** Every OHLCV+funding rule now measures ≈0 here. Liquidation cascades and open-interest build-ups
are the mechanisms with the strongest prior and are absent. The taker-imbalance field is a zero-cost
addition to the kline the fetcher already downloads.

**Where.** `candle_fetcher.js` normaliser (`normalizeCandle`) + `candles_audit.js` manifest.
**Verify:** `fetcher.test.js` (the repo's existing pattern for a new field). **Falsifier:** a new stream
with |corr| < 0.2 to the basket and a positive full-history Sharpe block-stability ≥ 4/6.

**Status (CYCLE-003):** the *taker-imbalance* half is measured and reads **negative** — `e9_flow.js`,
F-15: at 1h and 15m every flow arm is ≤ +0.03 Sharpe with ≤ 0.31 bps break-even, though flow is
strongly independent (cross-asset flow corr 0.020 at 1h vs 0.623 for returns). So do **not** port the
taker field as a signal. The *open-interest / liquidation* half is untested and is the higher-prior
part (positioning, not order flow); R7 stays open for it. Harvest path that works from this
environment: `data.binance.vision` monthly CSVs (the REST API is geo-restricted; 2025+ files use
microsecond timestamps) — see `data/README.md`.

**Status (CYCLE-013):** the *open-interest* half is measured and also reads **negative as a signal** —
`e21_open_interest.js`, F-28: Δlog(OI notional) predicts the next 8h return with pooled IC **0.020**
(its *daily* book clears no fee), so do **not** port OI as a directional stream. It *is* useful as a
**sizing input** (it prices the flat book, R4). *(Corrected by CYCLE-028 / F-45 below.)* **But the same metrics bucket carries a signal**: the toptrader
long/short ratio used **cross-sectionally** fades the crowded side for gross Sharpe **1.055** /
break-even **15.1 bps** / net@4 **+0.77** (F-29, lead **L18**) — invisible in level IC (≤0.02), visible
only after demeaning. So **R7 gains a live revisit reason**: port the metrics fields (OI for sizing, the
toptrader ratio as a panel stream) *after* L18 passes a held-out split and a capacity read. The only
untested mechanism is now the **liquidation prints** (event data).

**Status (CYCLE-014):** the toptrader half is **validated** (`e22_toptrader_validate.js`, F-30) — all four
gates pass (held-out sign, cost/smoothing, confound, capacity). **Concrete port spec for R7:** fetch the
`futures/um` metrics fields (`sum_open_interest`, `sum_open_interest_value`,
`sum_toptrader_long_short_ratio`, and optionally `takerLS`); add the **toptrader ratio as a
cross-sectional panel stream** with **EWMA(0.1)-smoothed, renormalised weights** (break-even 74 bps,
net@4 +0.79), a per-symbol cap (F-27-style) and a **size estimate of tens of millions** (OI-bound). OI
itself is a **sizing input only** (F-28), not a stream. Port only through the repo's own gate.

**Status (CYCLE-023):** the fade's spec is **finalised with the cap**. `e32_fade_retune.js` (F-40) shows
the F-27/F-38 **strict 12.5 % per-symbol cap transfers**: OI bound **$37 M → $54 M** (5 % of mean OI, LINK),
full net@4 **+0.79 → +1.00**, break-even **74 → 109 bps**, turnover 23 → 13×/yr. It also shows what does
**not** transfer from the R8 work: the fade is **not cost-fragile at any λ** (recent break-even 55 bps at
EWMA 0.1, ≥19 bps at λ=0.5), so do **not** retune λ, and the F-37 walk-forward selection is *worse* than
pinning here (+0.70 vs +0.94 OOS) because the fade's Sharpe ~0.8 is too weak to score on a trailing window.
**Port R7 as: the toptrader ratio as a cross-sectional panel stream, EWMA(0.1) weights (pinned), a strict
12.5 % cap, size ≤ ~$54 M (5 % of mean OI).**

**Status (CYCLE-024):** **spec finalised; size restated down, and the liquidation half is DATA-BLOCKED.**
`e33_oi_capacity_distribution.js` (F-41) shows the "$54 M" was a **ratio of means** (`f·mean(OI)/mean|w|`,
an average-case bound), not the constraint a desk faces. Measured as the true **min of ratios**
(`f·min_t(OI/|w|)`), the capped fade's bound is **$12.62 M** (never-breach) / **$21.87 M** (recent-24 m p5),
and at the published $54 M the book is over the 5 %-of-OI cap in **77 %** of periods (peak 21 % of LINK's
OI). The cap still *is* the fix — it triples the uncapped fade's never-breach bound ($4.19 M → $12.62 M).
**Port R7 as: the toptrader ratio as a cross-sectional panel stream, EWMA(0.1) weights (pinned), a strict
12.5 % cap, size ≤ ~$12–22 M** (use the recent-24 m p5 for planning; the bound is a distribution, so size to
current OI, not a fixed number). Separately, the R7 **liquidation-print** half is **closed as data-blocked**
— Binance no longer publishes `liquidationSnapshot` in `data.binance.vision` (the `futures/um/{daily,monthly}`
prefixes list only klines/mark/index/premium klines/aggTrades/trades/bookDepth/bookTicker/metrics/fundingRate)
and the exchange APIs (OKX `public/liquidation-orders`, Binance `!forceOrder@arr`) serve only recent events —
so nothing should be ported for liquidations, and no further round should be spent trying to fetch them.

**Status (CYCLE-025):** **the size is now a *schedule*, not a number — port it as a clipped target.**
`e34_oi_scaled_sizing.js` (F-42) tested how a fade book should *use* the OI bound. Three findings. (i) A
**constant** size picked from the trailing distribution is not compliant: the trailing-2y p5 constant
($10.86 M) still breaches the 5 %-of-OI cap in **2.7 %** of periods (peak 6.1 %), so the certified-safe
constant is the *running minimum* ($9.15 M, ~16 % smaller). (ii) A **lagged/EWMA** size is worse than
useless — it breaches **55 %** of periods (peak 13.2 %) because a lagged size sits above a falling bound;
the limit must be a **hard clip**, never a smoothed target. (iii) The working recipe is a **clipped
trailing-median**: target the trailing-median size and clip at `G_t^cap`. It deploys a mean **$19.34 M**
at **zero breach** (the clip binds ~45 % of periods) at Sharpe **0.96** (DD 34.9 %) and *more* absolute
dollars than the constant ($3.55 M vs $2.53 M/yr). **Port R7's size as: target the trailing-median size,
hard-clip it at `f·min_j OI_j(t)/|w_j(t)|` (f = 5 %), never a fixed number and never a smoothed target**;
plan on a mean deployable ~$19 M. (For reference, floating *fully* to the bound buys a $33.58 M mean but
drops the dollar Sharpe to 0.77 and deepens the drawdown to 58 % — do not do that.)

**Status (CYCLE-026):** **size against a *joint* budget if R7 and R8 are ever run together.** `e35`
(F-43) shows the two sleeves bind on the same thin alts, so their individual sizes do not add — running
both at their individually-compliant sizes breaches the 5 % cap in **78 %** of periods (peak 10 %) and the
joint schedule at the F-31 mix is **56 %** of the sum. Also, at the final specs the fade is no longer a
useful *mix* component (ρ is still ~0, but the re-tuned carry book's half is +4.66, so the 25 % mix just
dilutes carry: 6.49→1.62). **Port R7 standalone as its own sleeve, with its own clipped-trailing-median OI
schedule; do not assume its size is additive with R8's.**

**Status (CYCLE-027):** **the joint capacity is ≈ the sum, but only as an unstable schedule (F-44).** The
exact joint object is a per-period 2-D LP (`e36`); its free-split total gross is **mean $62.72 M (1.13× the
sum), median $37.11 M (0.88×), 2.00× the fixed mix** — so the *constraint* is cheap (the two books' positions
net in some thin symbols), and F-43's "56 %" was the fixed split. But the optimal split is unstable (fade
share p5 0 / p95 1), and deploying the LP-optimal size directly churns **48.5× gross/yr** for **net@4 0.62**.
**Port recommendation stands:** size a *portfolio* to the **fixed-split** joint bound (F-43); if R7 and R8
are run together and a joint schedule is wanted, clip the *joint* target (F-42 in two dimensions), do not
deploy the LP.

**Status (CYCLE-028):** **the OI-*signal* branch is re-opened — but do NOT port it yet.** `e37_oi_signal_rescue.js`
(F-45) shows F-28's "OI is directionless / do not port" was the **F-23 implementation artefact** again: the
daily book's 1501×/yr turnover (break-even 1.89 bps) is not a signal verdict. EWMA-smoothed (λ=0.25), the
cross-sectional Δlog(OI) book reads break-even **8.93 bps**, net@4 **+0.65** (λ=0.1: 14.73 bps, +0.52),
independent of carry (corr 0.007). **But it is weak, churny (338×/yr), and 2024–26-loaded** (2023 −0.86
net@4; net halves 0.07/1.47; walk-forward λ underperforms pinning, +0.44 vs +0.76/+0.99). So the OI signal
is **not closed** any more (new lead **L19**), but it is **not port-ready**: the live test is a held-out /
pre-2024 read with the sign and λ fixed. Keep R7's *sizing* role (OI as the capacity input) unchanged.

**Status (CYCLE-029):** **the held-out test passed — the signal is not a 2024–26 artefact, but its best
parameter was; still not port-ready.** L19's live falsifier was a pre-2024 read with the sign (+1) and the λ
window ({0.1, 0.25}) fixed **a priori**. `e38_oi_signal_holdout.js` (F-46) runs it and it **does not fire**:
λ=0.1 clears a 4 bps fee pre-2024 (net@4 **+0.47**, break-even **15.23 bps**) and post-2024 (**+0.59**,
14.33 bps); the sign control loses in both regimes (−0.80 / −2.66). What CYCLE-028 called the *best* policy,
λ=0.25, is **itself** a post-2024 artefact (pre **−0.12** / post **+1.45**). The two λ are anti-phase
year-to-year, and a fixed **unfitted 50/50 blend** reads net@4 **+0.33 pre / +1.24 post**, break-even
**11.33 bps**, 254×/yr, **positive in every calendar year 2022–26** (0.34/0.73/0.89/1.45/1.88) and beating
both single λ on the full window (net@4 **+0.77**). There is **no decay** (net block trend **+0.67**,
p 0.053). **Do not port yet**, and note the lesson generalises: when a single parameter is window-specific,
the robust object can be a **blend across scales**, not a re-tune. The remaining gate is **capacity**: the
book's individual OI schedule is mean **$23–28 M**, p5 **$6–8 M**, binding **DOGE/LINK/ADA** — the same thin
alts as R8 — so a **joint** (3-sleeve) read with R8 is required before any size is claimed.

**Status (CYCLE-030):** **the OI stream does NOT add to R8 — do not port it as a portfolio member.**
`e39_oi_portfolio_add.js` (F-47) answers both halves. *Return:* independent (corr with the carry book
**+0.01**, the fade **0.00**) but **too weak** — the capital-fraction carry+OI ladder is monotone down (carry
net@4 **6.48** → 2.82 at 5 % OI) and a walk-forward picks **OI 0 % in 11/11**; risk-normalised (needed —
carry net4 vol **0.4 %/yr** vs the OI book's **24.3 %**, **55×**) the max-Sharpe OI weight is **0.10** for a
**+0.04** Sharpe gain. *Capacity:* the 3-sleeve LP finds **$142.2 M mean = 1.76× the sum** of the three
individual bounds (OI share **0.374**) — so the OI stream is **not** crowded out by R8's thin alts — but its
schedule churns **129.6× gross/yr** for net@4 **0.82**, and all three at individual sizes breaches the 5 %
cap in **58.8 %** of periods. **Recommendation:** R7's OI branch stays **open but NOT ported**; the OI stream
is a *standalone* small sleeve (F-46's blend) if ever sized on its own schedule, never a joint member with
R8. **Basis note (L10-y):** the F-31/F-43 mix numbers are capital-fraction, not risk-normalised — F-43's
direction stands, its magnitude ("the fade dilutes carry 6.49→1.62") is a vol-ratio artefact.

**Status (CYCLE-039):** **the OI sleeve's *construction* is now closed — the mix is vol-optimal at 50/50 and
a 1–2 day hold cadence re-buys the fees; still a standalone sleeve, not ported.** `e48_oi_construction.js`
(F-56; guards both the daily `e21` book and the F-46 blend) asks whether a cheaper construction beats F-46's
fixed 50/50 blend without fitting a λ. **The mix is null**: no fixed non-equal mix beats equal capital
(0.76/0.77/0.74/0.69 vs 0.77) and an *unfitted* inverse-vol mix picks **0.51** (OOS 1.18 vs the blend's
1.19). **The cadence is positive**: a **hold-6** (~2-day) cadence lifts net@4 **0.77 → 0.87** while the
gross Sharpe *falls* 1.18 → 1.03 — turnover 254 → **93×/yr** pays for the staleness (break-even 11.33 →
**27.03 bps**, positive every year 2022–26), with a **1–3 day plateau** (hold-3 0.82 / hold-9 0.83). **If the
OI sleeve is ever sized, use the F-46 50/50 blend held at a 1–2 day cadence**; it remains **standalone**
(F-47), never a joint member with R8.

**Status (CYCLE-040):** **the hold-cadence gain is noise — but the lab's turnover measure is verified
adequate, so the sleeve's recipe is simply "50/50, held ≤ ~3 days".** `e49_hold_drift.js` (F-57; guards `e21`
and F-46's `e38` ensemble) stress-tests F-56. **Grid:** on a fine cadence grid (N = 1…36) the best hold-6
(0.87) is an **isolated spike** (+0.10 over neighbours 5/7); only **4 of 15** holds beat daily by ≥ 0.05
(non-contiguous 2/3/6/9), the short-hold region (2–9) averages **0.80** vs 0.77, and the long region (10–24)
collapses to **0.60** → **no specific cadence reliably adds**. **Drift:** a drift-aware true-hold simulation
gives turnover within **2×/yr** of the lab's target-change measure at every N (and a slightly *higher*
net@4), so `turnoverSeries` is **not** optimistic for a hold policy. **Net:** the OI sleeve's construction is
final as **F-46's 50/50 blend held ≤ ~3 days (turnover 254 → 73×/yr, no worse than daily)**; it stays
**standalone, not ported**.

**Status (CYCLE-041):** **use the no-trade BAND, not the cadence — `eps ≈ 0.03` is the sleeve's cost recipe.**
`e50_oi_band.js` (F-58; guards `e21` and F-46's `e38` ensemble) ports the F-52/F-53 band onto the OI sleeve.
At `eps = 0.03` the 50/50 blend reads net@4 **0.92** at turnover **198×/yr** (break-even **15.22 bps**,
**positive every year 2022–26**) — **above** the cadence's spike (hold-6 0.87) and the daily 0.77 — and it is a
**smooth plateau** (3 sweep points within 0.05 of the peak, no interior re-rise vs hold-N's 1). At matched
turnover the band wins 7 of 18 sweep points (all at turnover ≈ 173–200+); the cadence's residual
low-turnover edge is exactly its fine-grid spikes. **So the OI sleeve's construction is F-46's 50/50 blend +
a no-trade band (eps ≈ 0.03)** — and the band is now the lab's *general* cost tool (R8 stacks with the cap,
R7 alone, OI alone). It stays **standalone, not ported**.

**Status (CYCLE-042):** **pin `eps ≈ 0.03` (or choose it on ≥ ~2.3 y); the band's edge over the cadence is
OOS-robust.** `e51_band_holdout.js` (F-59; guards `e21` and F-46's `e38` ensemble) gives both tools the
dense-split treatment: at each split, pick `eps*`/`N*` in-sample, freeze, score forward. The frozen-eps band
beats the frozen-N hold at **11/11** splits, and the **fixed** `eps = 0.03` band beats the daily blend and
fixed `hold-6` at **every** split — so F-58 is not a full-sample artefact. But the trailing `eps` pick is
unstable below **~2.3 y** (S = 1460/1825/2190 choose the **largest** eps `0.1`, underperforming fixed 0.03
OOS 1.03–1.22 vs 1.40–1.65); picks collapse to `0.03` from S ≥ 3650. **So: pin `eps ≈ 0.03`** — the same
~2.3 y minimum-training-window rule that F-49/F-55 gave R8's λ, now for a third parameter.

**Status (CYCLE-043):** **the port artefact is delivered — `prototypes/port.js`.** The shared book
post-processing is now ONE pure module (`clipWeights` = clip-and-hold/no-renorm, `bandWeights` = per-symbol
no-trade band, `cleanBook` = cap **then** band) plus `SLEEVE_SPECS` (the final pinned recipes) and
`MIN_TRAIN_PERIODS = 2555` (~2.3 y). `e52_port_artefact.js` (F-60) applies **`port.js` only** to R8, R7 and
the OI sleeve and reproduces **5/5** stored books: R8 cap `6.18 / 10× / 46.04` (=`e30`), R8 matched band
`5.05 / 10×` (=F-52), R8 cap+band `6.31 / 7×` (=F-52's stack), R7 cap `1.07 / 8× / 182.59` (=`e32`), OI band
`0.92 / 198× / 15.22` (=`e50`). **Port the cap/band chain from `prototypes/port.js`**, not from prose.

**Status (CYCLE-034):** **the fade's λ is a *pinned* choice too — port R7 with a fixed `ewma 0.05`, not a
walk-forward.** CYCLE-031/032/033 removed R8's fitted objects (F-48/F-49/F-50); `e43_fade_pinned.js` (F-51)
runs the same chain on the fade. The joint (λ, cap) walk-forward reads OOS net@4 **0.70** vs the best pinned
book `ewma 0.05 + cap12.5 %` **1.14** (and the pinned `ewma 0.1` spec 0.94) — so, exactly as F-40 suspected,
the rule *loses* here. A λ **frozen** on `[0, S)` with the cap fixed at `1/k = 0.125` picks **0.05** at
essentially every split and reads **1.14 / 1.15 / 0.37 / 0.83 / 0.87** vs the rule's **0.70 / 0.87 / 0.31 /
0.60 / 0.93** — ≥ or within 0.2 at every split, and, unlike R8, **no ≥ ~2 y minimum history is needed** (the
fade has no broken early-λ). The mechanism is **λ-flatness**: with the cap fixed the OOS net@4 across the
eight λ ∈ [0.02, 0.5] spans only **0.16** (0.25 uncapped), so the walk-forward is ranking near-ties (F-40's
noise-dominated trailing window, now quantified). The `1/k` cap **transfers** (λ=0.1: OOS net@4 0.94 →
**1.11**, turnover **28 → 16×/yr**) at the cost of a lower recent-24m read (0.84 → 0.47) — a *capacity* add,
not a recent-Sharpe add. **Port R7's weights as: the toptrader ratio as a cross-sectional panel stream,
EWMA(0.05) weights (pinned, no walk-forward), a strict 12.5 % cap**, sized per the CYCLE-024/025 schedule.
Both deployable sleeves (R8 and R7) are now pinned books with no rule.

**Status (CYCLE-036):** **the cap is a concentration tool on the fade too — do NOT add a band here.**
`e45_fade_cap_mechanism.js` (F-53; guards a rebuild that reproduces `e32`'s 0.82 / 1.07, 14 / 8,
118.38 / 182.59, $37,378,256 / $54,782,334 with diffs 0.00) applies the F-52 decomposition to the fade.
The cap lifts net@4 **0.82 → 1.07** (**+0.25**), but a no-trade band swept to the cap's exact turnover
(eps=0.05 → 8×/yr) reads **0.78** — *below* base (**−0.04**) — and the band's whole sweep (14 → 6×/yr)
stays in **[0.78, 0.95]**. The band leaves max `|w|` at **0.456** (base 0.500, capped 0.125) and capacity a
**1.03–1.04×** multiple of base while the cap is **1.43–1.47×** ($37.38 M → $54.78 M ratio-of-means;
$32.43 M → $46.36 M min-of-ratio). So the fade's cap is a **concentration** tool (the mechanism is general),
but a band on the capped fade gains only **+0.06** (1.13 vs 1.07; R8 stacked +0.18) — **the band remedy is
R8-specific; port R7 with the cap and no band.**

**Status (CYCLE-037):** **the cap is a tail winsorisation; a smooth saturation is an acceptable
implementation.** `e46_cap_shrinkage.js` (F-54; guards `e30` to 0.00) shows a **smooth saturation**
(`c·tanh(w/c)`) at c=0.125 matches the hard clip (net@4 **6.04** vs **6.18**; 6.11 at c=0.10) — so the hard
form is not special, only the level (a plateau: hard 6.18/6.18/6.13/5.84/5.23 and soft 6.11/6.04/5.94/5.74/
5.43 for c = 0.10/0.125/0.15/0.20/0.30). But **wholesale shrinkage fails**: `sign(w)·|w|^p` reads
4.44/3.99/3.25/2.27 for p = 1.25/1.5/2/3 (all below base 4.92) and equal-weight reads 1.51. **So: keep the
cap at ≈ `1/k`; it may be implemented as a hard clip (simplest) or a smooth saturation — but never as a
power shrinkage or a flattening.**

**Status (CYCLE-038):** **freeze λ on a *rolling* ≥ ~2.3 y window, not the expanding window.** F-49/F-50's
"frozen λ matches the pinned book" rests on five split points; `e47_split_robustness.js` (F-55; guards `e30`
to 0.00) sweeps a **dense** 14-point grid. The pre-registered 0.80 bar narrowly fails — the **expanding**
`[0,S)` freeze is within 0.2 of the in-sample-best pinned book at **0.71** (median gap 0.00), the **rolling
1-year** freeze at **0.79** (median **+0.30**) — but every failure is in the first ~2 y (the expanding
freeze collapses at every split S ≤ 2190 and matches at 10/10 splits from S = 2555). So: freeze λ on a
**rolling ≥ ~2.3 y** window; the safe boundary is **~2.3 y**; the broken fast λ is 0.075 (not 0.1); and the
12.5 % cap **stabilises** the policy (rolled robustness 0.50 uncapped → 0.79 capped).

**Status (CYCLE-066): PORTED (V2.2) — and the port is verified bit-for-bit.** `ARCHITECTURE-v2.md` /
`MIGRATION-V2.md` moved the shared book arithmetic and the three pinned specs into the repo:
`src/core/primitives/*` (the F-60 `port.js` chain, the signal→weight→book helpers) and
`src/plugins/sleeves/{carry-dispersion,toptrader-fade,oi-change}.js` (+ `plugins/risk/cap-band.js`,
`plugins/books/*`, the registry/composition root). The **R7 fade** (EWMA 0.05, strict cap 12.5 %, no band) is
`plugins/sleeves/toptrader-fade.js`; the **OI branch** (the fixed 50/50 `ewma 0.1`+`ewma 0.25` blend + a
no-trade band at `eps = 0.03`, no cap — F-56/F-58/F-59) is `plugins/sleeves/oi-change.js`. `e73_port_verify.js`
(F-81) drives the REPO modules on the lab's real 6 557-period panel and reproduces the stored books
**exactly** — R7 `1.07 / 8× / 182.59` (= `e32`), OI `0.92 / 198× / 15.22` (= `e50`), with the repo's
`cleanBook` fingerprint-identical to `prototypes/port.js`. The sleeves land **UNTESTED** in the repo: the
lab's numbers say "worth porting"; the repo's own gate (G2/G5) has not scored them yet — that is the next
work unit (`MIGRATION-V2.md` §8). No lab number moves.

### R8 — Score the P4 carry sleeve dollar-neutral across the basket (rank-weighted). *(from F-17/F-21)*

**What.** Alongside the per-asset marked carry book (R4), report a **dollar-neutral** book whose weights
are the demeaned **rank** of each symbol's funding rate at `t−1` — long the carry book on the
highest-funding symbols, short it on the lowest. Rank rather than level weights (the level variant is
dominated by outlier funding rates).

**Why.** F-17/F-21: on the full 6.0-year history this book scores Sharpe **5.03** at a **2.93 %**
drawdown, versus the flat book's 4.54 at 7.96 %. The mechanically important part is *where the tail
is*: the flat book is long the common carry **level**, which is what collapses in a deleveraging
(2022 bear −1.43, LUNA month −4.19, FTX month **−5.12**), while the level-neutral dispersion book reads
**+2.98 / +13.18 / +5.51** in those same windows and is positive in 5/5 full years and 9/9 named
regimes (z = 12.6 against a 40-seed permutation null). It is the only sleeve in the lab that is
positive in every crash measured, from a variable already in the data.

**Where.** `analysis/carry.js` next to R4's `carryBookReturns`: a cross-sectional weight function over
the panel + `analyze.js` reporting. **Verify:** `analysis.test.js` exact weight vectors for a fixture
whose ranking is known. **Falsifier:** the dispersion book's full-history Sharpe ≤ the flat book's, or
its price correlation not lower — **not falsified** on the extended history. It was **gated on L14** (the
mark-vs-traded price test) before it could be called a result rather than a construction; that gate is now
cleared.

**Status (CYCLE-006):** measured (F-17/F-21), not yet ported. Was gated on L14 for the same reason as R4.

**Status (CYCLE-007):** **un-gated.** With the perp leg set to the *traded* price (`e15_traded_basis.js`,
`data/perp_8h.json`) the dispersion book reads Sharpe **4.98** at a **3.05 %** drawdown (vs 5.03 / 2.93 %
against the mark, F-22), still positive 5/5 years and 9/9 regimes, and the mean mark−traded spread is
≈0.003 % (sd 2–5 bps). The construction is not a mark artefact. Remaining work is the port's own
verification (fixtures + golden movement), plus the now-binding unknown: **turnover/capacity** (see
`RUNNER.md` and L03's next-action note) — the rank book rebalances every 8h and its edge is small per
period, so whether it survives real taker costs is untested. R8 is a live port candidate on the same
footing as R4.

**Status (CYCLE-008):** **RE-GATED on cost.** The turnover that CYCLE-007 flagged was measured
(`e16_cost_capacity.js`, F-23) and it is decisive: the rank book turns over **803× gross notional per
year** and **breaks even at 1.87 bps**, below even a base-tier perp taker fee — at a 4 bps fee its net
Sharpe is **−5.6**. R4's flat construction is unaffected (0.2×/yr, break-even 5422 bps). So **R8 must
not be ported as a daily rank reshuffle**; the prerequisite is now a **low-turnover dispersion
construction** (lead **L16**) plus a capacity/impact answer (lead **L15**). The R8 row stays a port
*candidate* — it is a result about the data, not yet a tradable sleeve.

**Status (CYCLE-009):** **un-gated, with a changed specification.** The low-turnover construction was
found (`e17_low_turnover.js`, F-24): port the sleeve with **EWMA-smoothed, renormalised rank weights**
— `w_t = 0.9·w_{t−1} + 0.1·w*_t` (target `w*` from funding at `t−1`), rescaled to `Σ|w|=1`. That cuts
turnover 803× → **85×/yr**, *keeps* the gross Sharpe (5.03 → 5.18), and lifts the break-even from 1.87
to **12.78 bps** — net Sharpe **+3.55 at a 4 bps fee**, still positive in every crash window and 7/9
regimes, still dollar- and price-neutral. **This is the R8 port spec; the daily reshuffle must not be
ported.** Two caveats carry forward: the edge has **decayed** (2025/2026 ≈ 0 net of fees, so the
full-history edge rests on 2021–2024), and **capacity/impact (L15) is unmeasured** — fee is cleared,
size is not.

**Status (CYCLE-011):** **un-gated, but now a SMALL-SIZE sleeve — port it size-aware.** The fee was the
first gate and L15 was the second; both are now measured (`e19_capacity_impact.js`, F-26). Applying a
square-root impact law to the smoothed rank book (`data/perp_flow_8h.json`), its capacity at a 4 bps fee
is **~$13 M** at `Y=1` (`~$53 M` at `Y=0.5`, `~$3 M` at `Y=2`), collapsing to **$0.5 M at an 11 bps
taker fee**. The binding symbol is **DOGE (~1 % of ADV)** — the rank weighting concentrates the book in
whichever alt has the most extreme funding, which is exactly where impact bites. So port the spec (smoothed
rank weights) **with a per-symbol weight cap / ADV scale**, and size R8 to tens of millions, not hundreds.
By contrast R4's flat hold is **not** impact-limited (it barely trades), which is why R4 remains the
scalable port and R8 the high-Sharpe small-size one. A capacity-aware construction is L17 (open).

**Status (CYCLE-012):** **spec amended — port with a strict per-symbol position cap.** L17 was tested
(`e20_capacity_aware.js`, F-27) and the capacity *is* improvable. The fix is a **strict per-symbol gross
cap at ~1/k (12.5 %)**: clip each `|w_j|` and **hold it** (do NOT renormalise — renormalising re-inflates
the clipped position and buys nothing). With a 12.5 % cap the book's capacity rises **$13.2 M → $26.7 M**
(Y=1, 4 bps; ~$107 M at Y=0.5) while turnover falls 85×→35×, drawdown 0.94 %→0.47 %, the design effect
7.9→2.2, net@4 rises +3.55→+5.32, and 7/9 net-of-fee regimes become 8/9 (cap 0.12 gives 9/9). The
in-sample *Sharpe* lift (5.18→6.97) needs a pre-registered port test — but note caps 0.15–0.175 are above
the baseline in **every** calendar year. **Do not** use a soft cap (no capacity gain), caps below ~0.12
(degenerate: rank information clipped away, capacity "explodes" while Sharpe collapses), or ADV-tilting /
dropping thin symbols (destroys the edge). Still a small-size sleeve ($27 M), but cheaper and safer.

**Status (CYCLE-019):** **RE-GATED on the decayed cost margin.** The full-sample economics above are now
stale. `e27_decay.js` (F-36) shows the smoothed dispersion book's **break-even fell to 2.9–3.4 bps** in
the last two blocks (2025-07 → 2026-09) — below a 4 bps fee — while its gross Sharpe trend is flat
(p 0.39), because the per-period edge shrank and turnover rose 75 → 98×/yr. Net@4: 2025 −0.01, 2026
−1.88. So **do not size R8 on the full-sample $27 M figure**; the tradable window is 2021–2024. The
prerequisite for porting is a lower-turnover re-tuned construction whose *recent* break-even clears the
fee (lead L16), and the R8 port should be paired with the L18 fade (R7) — the F-31 mix is the only book
that is still net-positive recently. R4 (the flat hold) is unaffected: it barely trades.

**Status (CYCLE-020):** **RE-UN-GATED, with a re-specified weight policy.** The decay was the *policy*
(the EWMA(0.1) point), not the sleeve. `e28_regime_retune.js` (F-37) shows 7/16 policies clear a 4 bps fee
on the recent 24 months with the recent break-even **monotone in policy slowness**; the leader
`ewma_0.01_norm` reads recent-24m break-even **27.07 bps**, net@4 **+3.86** at 9×/yr, and is net-positive in
**9/9** regimes. `e29_regime_retune_oos.js` clears the selection objection: a **walk-forward λ-selection**
(which never sees the block it trades) nets **+5.71 OOS** vs the pinned λ=0.1's **+2.76** (recent-24m
+3.41 vs −0.53) across 12/12 parameterisations, while a **gross-blind** selector nets only **+0.28** — so
the re-tune is a **cost-aware rule**. **Port spec amendment:** the R8 sleeve should carry a **cost-aware,
walk-forward EWMA λ** (recent λ ≈ 0.01–0.02, i.e. turnover ~10–40×/yr), *not* a pinned λ = 0.1. Capacity at
the new, much lower turnover is unmeasured and should be re-checked before sizing (L15/L17); a
`ewma_0.05_norm + cap12.5 %` variant (full gross Sharpe 6.64, recent break-even 7.03 bps) is the
capacity-friendly alternative.

**Status (CYCLE-021):** **sized — and the retune improves size too.** `e30_retuned_capacity.js` (F-38;
validated against `e19`'s stored λ=0.1 capacity to the last digit) measures both size bounds. The λ=0.1
spec is **impact-bound at $13.2 M** (DOGE ~1 % of ADV), but every slower book has a *diverging* impact
capacity — a near-hold never trades — and is instead **open-interest-bound** (LINK): **$19.2 M** at λ=0.01,
and **$35.9 M** with the F-27 12.5 % cap at λ=0.02 (recent net@4 **+4.24**, break-even **15.97 bps**,
11×/yr). So the **recommended R8 spec is `ewma 0.02 + 12.5 % cap`, ~$36 M (OI-bound)**, at a recent
break-even ~4× the fee — usable size up **~173 %** on the old spec while *improving* the recent net Sharpe.
Residual caveats: the OI bound uses **mean** OI (re-read against current OI), and the λ+cap combination was
frontier-picked — give the cap the same walk-forward treatment as λ before porting.

**Status (CYCLE-022):** **PORT-READY.** `e31_ported_spec_oos.js` (F-39) closes the residual: a **joint
(λ, cap) walk-forward** over a 40-book grid — which never sees the block it trades — beats the pinned
F-24 spec out of sample (**OOS net@4 +6.13 vs +2.76**; recent-24m **+4.49 vs −0.53**) and, fee-stressed on
the same OOS series, stays net-positive at a **10 bps** fee (net@4 **+4.43**, recent-24m +3.12) — ~6×
headroom above a 4 bps taker fee. `λ=0.1 + cap12.5 %` is *still* broken OOS (+1.93), so the slower λ is the
fix and the cap is a capacity add. **Port spec:** a dollar-neutral rank-funding carry book with EWMA
weights at a **walk-forward, cost-aware λ** (recent λ ≈ 0.02) and a **strict 12.5 % per-symbol cap**,
~$36 M (OI-bound on LINK), break-even ~25 bps. The port test should reproduce `e31`'s OOS span.

**Status (CYCLE-024):** **PORT-READY, with the size restated down.** `e33_oi_capacity_distribution.js`
(F-41) corrects F-38's "$35.9 M": that figure is `f·mean(OI)/mean|w|` — a **ratio of means** (average-case).
Measured as the desk's constraint, the true **min of ratios** is **$11.50 M** (never-breach) / **$20.34 M**
(recent-24 m p5), and at the published $35.9 M the book is over the 5 %-of-OI cap in **69 %** of periods
(peak 16 % of LINK's OI); even the naive "use min OI" variant ($12.06 M) is close to the truth only *because*
the cap flattens the weights. **Port spec (size amendment):** the same `ewma 0.02 + 12.5 % cap` book, but size
it to **~$11–20 M** (recent-24 m p5 for planning; the bound is a distribution, so prefer OI-scaled sizing
over a fixed number), not $36 M. The *edge* numbers are untouched — this is the risk layer only.

**Status (CYCLE-025):** **PORT-READY, and the size is an explicit clipped schedule.** `e34_oi_scaled_sizing.js`
(F-42) turned R8's size amendment into a recipe. A **constant** trailing-p5 size ($11.16 M) is *not*
compliant — it breaches the cap in **2.9 %** of periods (peak 10.2 %) — and a **lagged/EWMA** size breaches
**53 %**, so the OI limit must be applied as a **hard clip**. The working construction is the **clipped
trailing-median**: target the trailing-median size, clip at `G_t^cap`; it deploys a mean **$16.94 M** (1.5×
the constant-p5 size) at **zero breach** (clip binds ~44 %), Sharpe **4.41** (DD 3.5 %), and *more* absolute
dollars ($469 k vs $378 k/yr). **Final R8 port spec: the dollar-neutral rank-funding carry book, EWMA
weights at a walk-forward cost-aware λ (recent ≈ 0.02), a strict 12.5 % per-symbol cap, sized by a
clipped trailing-median target against the per-period OI bound `f·min_j OI_j(t)/|w_j(t)|`** — plan on ~$17 M
mean deployable, and do not float fully to the bound unless the dollar-Sharpe/drawdown cost (3.26 / 4.8 %)
is acceptable. **Joint-budget caveat (CYCLE-026 / F-43):** if R7 is running alongside, size the pair
against the **joint** per-period bound `f·min_j OI_j(t)/|a·w^{fade}_j+(1−a)·w^{carry}_j|` — the individual
sizes do **not** add (the joint at the mix is 56 % of the sum; both at their individual sizes breaches the
5 % cap in 78 % of periods). Do not float fully to the bound unless the dollar-Sharpe/drawdown cost
(3.26 / 4.8 %) is acceptable. *(CYCLE-027 / F-44: the exact free-split frontier is ~the sum — mean 1.13×,
median 0.88×, p99 $624 M — but it is only reachable by an unstable, high-churn schedule (48.5× gross/yr,
net@4 0.62), so size to the fixed-split joint bound, not to the LP.)*

**Status (CYCLE-031):** **the λ *rule* is optional — a fixed two-scale blend matches it out of sample.**
`e40_retune_blend.js` (F-48) tests whether the walk-forward λ selection earns its place. Building the R8 λ
family (rank funding, EWMA, 12.5 % cap) and scoring on one shared OOS span (`[1095, 6205)` — the same span
`e31` uses), a **fixed, unfitted two-scale blend** (λ = 0.01 + 0.02, equal capital) reads **OOS net@4 6.66
vs the λ-only walk-forward's 6.63** — within the pre-registered 0.2-Sharpe falsifier (indeed above it) —
with **half the turnover** (7 vs 14×/yr) and **1.8×** the break-even (46.1 vs 25.5 bps); every
pre-registered blend is recent-positive. The only set containing the *broken* fast λ=0.1 is the worst
(4.36), so nothing rewards blind mixing, and the rule's F-37/F-39 edge was over that broken spec — i.e. it
bought **slowness**, not a selection rule. **Port-spec amendment (optional):** the λ policy can be a
**fixed equal-capital blend of the two slow scales (λ ≈ 0.01 + 0.02)** instead of a walk-forward selector —
simpler, cheaper to run, no lookback/block. **Open caveat:** the pinned λ=0.02 (6.86 OOS) is in-sample, so
*which* scales to blend is still a choice; a **single λ frozen before the span** has not been tested — do
that (or keep the walk-forward) before calling the λ policy fully OOS-clean. The cap rule (F-39) is
untouched.

**Status (CYCLE-032):** **the blend amendment is MENU-DEPENDENT — use a frozen λ on ≥2 years instead.**
`e41_blend_hindsight.js` (F-49) closed CYCLE-031's two holes and **scoped F-48 down**. (i) Of **10**
pre-registered blends, only the cherry-picked `{0.01, 0.02}` clears the 0.2 bar (6.66); the **no-hindsight**
sets justified by F-37's slow range read `{0.005,0.01,0.02,0.05}` **5.74** and `{0.005,0.01,0.02}` **6.08**
(0.55–0.89 below the rule), a blend-selection walk-forward reads **5.81**, and the blend ranking flips by
window — so "a fixed blend" was the best of a menu, not a free lunch. (ii) But a **single λ frozen** on
`[0, S)` is honest and works: for S ≤ 1825 periods (≤1.7 y) the trailing winner is the F-37-broken λ=0.1 and
the frozen spec collapses (OOS net@4 **1.76–1.93**); from S ≥ 2555 (≥2.3 y) it is **0.02** and the frozen
spec **matches or beats** the walk-forward (OOS **6.81 / 6.64 / 4.10** vs **6.69 / 6.48 / 4.27**). **Port
spec (λ amendment, supersedes the CYCLE-031 blend note):** pick λ **once** on the last **≥ ~2.3 years** of
trailing data and freeze it (it lands on 0.02); the walk-forward rule's value is confined to the first ~2
years, where short windows pick the broken fast λ. Do **not** use a fixed blend. The cap rule (F-39) is
still untouched, and is the last fitted object in the spec.

**Status (CYCLE-033):** **the spec is PINNED — the joint (λ, cap) walk-forward does not earn its keep.**
`e42_cap_hindsight.js` (F-50; guards a rebuild that reproduces `e31`'s 6.13 / 6.63 / 6.86 / 1.93 with diffs
0.00) removes R8's last fitted object. The joint (λ, cap) walk-forward reads OOS net@4 **6.13** while the
pinned `ewma 0.02 + cap12.5 %` book reads **6.86** (plain `ewma 0.02` 6.63), and the pinned book is ≥ the
rule on **4 of 5** sub-spans — its F-39 edge was over the *broken F-24 spec* (+2.76). The cap is a **flat
plateau**, not a tuned parameter: at λ=0.02, OOS net@4 is **6.63 / 6.77 / 6.86 / 6.90** for cap
none / 0.10 / 0.125 / 0.15, and it **binds** (clips **42.3 %** of weight entries) — so `1/k = 0.125` is the
principled pick (first **OOS confirmation of F-27**). Freezing the *pair* fails (short history picks the
early-regime `0.075+cap0.1`, OOS 2.29–2.48), but a frozen **cap** (λ=0.02) reads 6.77 / 6.84 / 6.81 / 6.64
/ 4.10 ≥ the rule at every split. **FINAL R8 PORT SPEC (supersedes the walk-forward language of F-39):** the
dollar-neutral rank-funding carry book, **EWMA λ chosen on ≥ ~2 y of trailing data (lands on 0.02; F-49)**,
**a strict cap = 1/k = 12.5 %** (structural; the cap binds but its exact level is a plateau), sized by
F-42's clipped trailing-median against the per-period OI bound — **no walk-forward**. R8 now has **no
fitted-object rule** (one minimum-history requirement on λ, one structural parameter).

**Status (CYCLE-035):** **the cap is a *concentration* tool — add a no-trade band to the cost recipe.**
`e44_cap_mechanism.js` (F-52; guards a rebuild that reproduces `e30`'s 4.92 / 6.18, 17 / 10,
39.63 / 46.04 and $20,415,294 / $35,937,181 with diffs 0.00) asks *why* the cap helps. A no-trade band
swept to the cap's exact turnover (eps=0.008 → **10×/yr**) reads net@4 **5.05** vs the cap's **6.18** —
recovering only **+0.13 of the cap's +1.26** gain — and across the entire band sweep (turnover 16 → 6×/yr)
net@4 stays in **[4.95, 5.05]**. So the cap's Sharpe edge is the **shape** of the book (clipping max `|w|`
0.438 → 0.125), **not** its churn; the cap is not a rebalance filter. Symmetrically, the band leaves
max `|w|` at **0.436** and OI capacity a **1.00×** multiple of base ($20.44 M vs $20.42 M ratio-of-means;
$19.88 M vs $19.84 M min-of-ratio) while the cap is **1.76× / 1.70×** — so the *capacity* gain is
**concentration** too. And the two tools **stack**: a band on the capped book reads net@4 **6.36** at
turnover **6×/yr** (vs capped alone 6.18 at 10). **Amended R8 cost recipe: the pinned `ewma 0.02 + cap 12.5 %`
book PLUS a no-trade band** (band cut turnover 10 → 6×/yr at no net cost). Open mechanism lead: *why*
clipping the extremes raises net Sharpe (the band rules out churn; candidate = signal-shape robustness).

**Status (CYCLE-066): PORTED (V2.2) — verified bit-for-bit.** The final pinned spec (F-49/F-50: λ chosen on
≥ ~2.3 y of trailing data — lands on 0.02 — plus a strict cap `1/k = 12.5 %`, **no walk-forward**) is
`src/plugins/sleeves/carry-dispersion.js` (`CARRY_DISPERSION_SPEC`), using the repo's own
`core/primitives` for the book construction and the F-60 cap-then-band chain (`plugins/risk/cap-band.js`
supplies the per-sleeve cap/band). `e73_port_verify.js` (F-81) drives the REPO module on the lab's real
6 557-period panel and reproduces the stored book **exactly** — R8 `6.18 / 10× / 46.04` (= `e30`) — with the
repo `cleanBook` fingerprint-identical to `prototypes/port.js`. The port exposed one lab-internal ambiguity
(**L10-ct**: the two shells read different arrays for the book grid, so the V2 primitives take the grid as an
explicit `n`). The sleeve lands **UNTESTED** in the repo pending the repo's own gate (G2/G5). No lab number
moves.

### R9 — Purge the walk-forward boundary for horizon labels. *(candidate; from F-63, CYCLE-046)*

**What.** In `analysis/splits.js#walkForwardSplit`, accept `labels`/`labelSpan`/`embargo` and drop training
labels whose window overlaps the test window — the rule `purgedKFoldSplit` and `combinatorialPurgedSplit`
already apply. Equivalently, resolve `walkForwardEvaluate`'s folds against the model's label horizon so a
fold's training set cannot include a label realised in the test block.

**Why.** F-63: `walkForwardSplit` has no purge path, so for a label horizon H > 1 the fold boundary leaks
exactly `H(H−1)/2` train/test label-overlap edges per fold (measured = closed form); `isCausalFold` (index
order only) passes the leaky folds, and an index-lookup model recovers test-period returns in the leak zone
(**+0.0035**/bar vs 0.0000 clean). The lab's parameter-free signals (span 1) are unaffected, so no lab number
moves — but the shipped controller trains on labels with a real horizon (`labelHorizonBars`; the opt-in
`label:triple` policy's vertical barrier), so the precondition is met on the shipped model path.

**Where.** `src/analysis/splits.js#walkForwardSplit` (+ the fold metadata `purgeStart`/`purgeEnd`/`embargoEnd`),
`src/analysis/walkforward.js#walkForwardEvaluate` (thread the label span through).

**Status (CYCLE-047): LATENT — low-priority, do not schedule.** The scoping resolved it: the shipped
controller's labels *do* overlap (`heldBars {mean 8.30, max 54}`), but the controller is **online** — the
fold is fitted by replaying bars `1 … testStart` with each call seeing only a window ending at `i − 1`
(`analyze.js:1018`), so the last training bar is `testStart − 1` and the fold's declared `train` list is
ignored; and `hivemind/controller/trades.js` labels a trade by its outcome at the **exit** bar, so every
training label is realised at an exit `≤ testStart − 1`, causally before the test. The leak therefore cannot
occur on the shipped path; R9 becomes relevant only if the project adds a **fixed-label offline** model
behind `walkForwardSplit`. The `e55` guard stays so such a model cannot silently inherit the leak.
**Falsifier:** a shipped path that fits a fixed label block on a fold's training indices (then R9 is live).

## Explicitly NOT to port (measured dead — see `FINDINGS.md`)

* Cross-sectional momentum arms — F-07 (|Sharpe| ≤ 0.033).
* Vol-scaled / blended / network / regime momentum as *roster* arms — F-06 (≤ +0.13 Sharpe, ≤2.6 bps).
* Funding as a price signal — F-05 (+0.026).
* Calendar seasonality — F-09 (OOS ≈ 0, and it is a multiple-testing trap).
* Volatility conditioning — F-08 (+0.112 vs +0.110).
* Any sleeve combination before a member has an edge — F-12 (+0.019).
* Re-aiming the learner at a meta-label (`P(rule's trade pays)`) — F-35 (OOS Brier skill vs the rule's
  base rate ≤ 0 for every base rule at 1h & 15m; the AUC ≈ 0.51 whisper is not tradable).

## The anti-pattern to avoid

The one thing this lab would most like to stop: **reading a decision off the most recent window and
calling it a result.** F-01 is the whole of it — the run was correct, the gate was correct, and the
sample was 25 days. Every other finding is downstream of that choice.
