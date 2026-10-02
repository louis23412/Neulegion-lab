# THEORY — the system, its weakest joints, and where an edge could come from

This is the lab's analysis document. `FINDINGS.md` holds the measurements; this holds the reasoning
built on them. Nothing here edits the repo.

---

## 1. The system, as it actually is

**What it claims to be.** An evolutionary "hivemind" of tiny transformers whose controllers trade a candle
stream, with prototype memory, an LSH index and a legion layer aggregating signals by hierarchy
(`docs/DESIGN.md`).

**What the measurements say it is.** A **parameter-free signal family** wrapped in a **rigorous, honest
evaluation harness**, with a large learned component that contributes ~nothing to either the return or
the decision.

Three independent facts, each from the project's own tests, fix the picture:

1. `NL-BENCH` (G-A): no model class — base-rate, linear, MLP — has positive Brier skill against the base
   rate on this feature vector. The forecaster is a passenger.
2. `NL-MECH`: four distinct memory/ensemble mechanisms (surprise, homeostasis, pca-hash, broadcast) all
   score ≈ baseline. The architecture is not the constraint.
3. The lab (F-06, F-07, F-08, F-09): no rule-based arm has a full-history Sharpe above ~0.15, and none
   clears a 5 bps cost.

So the honest model is:

```
the edge, if any   =  a rule (momentum / accel)
the machinery      =  a large, beautifully tested, inert layer
the real asset     =  the evaluation harness (dependence-adjusted inference, DSR/SPA, no-lookahead audit)
```

That is not a criticism of the engineering — the harness is genuinely better than most published work.
It is a statement about **where a marginal hour of effort buys the most**: not in the model, and not in
new signals, but in *what the harness is pointed at*.

---

## 2. The weakest joints, ranked by leverage

Ranked by "how much does the project's *decision* change if this is fixed?" — not by elegance.

### J1 — The verdict is read off 25 days. *(the deepest flaw)*

`--bars=600` = the most recent 600 bars. The entire gate — DSR, SPA, block stability, the pruned `K`
arithmetic — is evaluated there. F-01 shows that in that window *almost every arm* looks good
(+0.2…+1.45), including arms with no own-asset content (`netmom-16`: +1.45) and non-trend arms
(`range-32`: +0.78), while on 53 500 bars nothing exceeds +0.15.

This is a **selection-of-window** problem of exactly the kind the project's own DSR machinery exists to
punish — but the machinery is only ever pointed at the parameter space `K`, never at the *time* dimension.
The deflation corrects "best of 12 variants", not "best of N calendar windows".

Why it persists: the O(n²)-per-stream cost of the model (`OPTIMIZATION.md`) makes long runs infeasible,
so 600 bars is a *budget* choice. But the signal family is parameter-free and costs nothing — the lab
scored 20 arms × 8 streams × 53 500 bars in ~28 s. **The restriction applies to the model, not to the
measurement.** That is the single highest-leverage observation in this document. *(CYCLE-002 refined
this: at full history the repo's own fold+pool path spends ~155 s in `poolReports`' dependence
estimate and only ~250 ms scoring — F-14. So the cost of a long-sample *signal* run is the design
effect, not the O(n²) model, and a contiguous scorer sidesteps it entirely — F-13.)*

### J2 — The report has no window-robustness statistic.

There is `stability` (fold win fraction), `clusterStability` (leave-one-cluster-out) and
`dependence`, but nothing that answers "does this edge exist in *more than one regime*?". A block-Sharpe
ladder across disjoint windows (E2/E4's `blockStability`) is a few lines and would have caught J1 at the
source — `accel-16` has 6/6 positive blocks; `mom-48` has 5/6 → and the *sign flips* between the 600-bar
window and the full sample.

### J3 — The panel is one factor, and it is the *only* thing DSR can see.

Design effect 4.92, effective streams 1.47 of 8 (F-02). The project already knows this. What is new is
F-03: **demeaning across the basket collapses the design effect to 0.4–0.6** (effective streams 14–19).
The project's own `sig-reversal-xs` is the only arm built this way, and it is in the P3 reversal family
(opt-in). There is no `xs-momentum`, and no portfolio layer.

The interesting asymmetry: **power is buyable, edge is not.** The plan's lever 2 ("buy independence")
is real and almost free via construction; the plan's lever 3 ("raise the edge") is where every measured
attempt has failed.

### J4 — Every arm dies at a realistic cost.

Full-history break-evens are 1–2.6 bps against the project's own 5–10 bps taker assumption. Note the
asymmetry with the reported numbers (12–19 bps), which are again the 600-bar window. So the "cost kills
everything" conclusion in `RUN-ANALYSIS.md` §7 is *even stronger* over the long sample, and the `--bars`
choice has been masking how strong it is.

*(CYCLE-008–011: for the carry sleeve this joint was worked through and partly lifted — the flat book
clears the fee (F-23) and the dispersion/reversion variants clear it once smoothed (F-24/F-25), but the
*second* cost term — market impact — re-imposes the limit as a **capacity**, not a fee: the improvements
carry only ~$10–100 M while the flat hold does not (F-26). "Cost kills everything" is, for a yield sleeve,
"capacity kills everything at size".)*

### J5 — No risk or portfolio layer.

Positions come from a fixed ±1 clamp on a z-score; there is no vol targeting, no risk parity, no
combination of sleeves, and no notion of a book. `C-BREADTH` is planned but its input sleeve has no edge
(F-12 shows combination of zero-edge sleeves is zero). A vol target would not create alpha, but it is the
standard way to make a *real* stream's Sharpe legible, and it is a prerequisite for combining with carry.
*(CYCLE-004: partly addressed — F-16 shows causal vol-targeting cuts the carry book's drawdown ~14× and
its serial design effect ~10×, and that a simple EWMA is the forecaster to use. The sized Sharpe's level
is not banked; the port recommendation is inverse-vol weights, R4.)*
*(Rounds 67–69 + 98–99 update: the risk layer now exists as V2.2 plugins (`cap-band.js`,
`vol-target.js`) but ships unpromoted — e126/e127 killed per-bar and quantized sizing (turnover
mechanism, rank-not-level), so the sized book still has no G5 claim (TODO 104: limit law + closed-loop
amendment). The joint stands: no *banked* risk layer.)*

### J6 — The model has no job description.

Direction is not predictable at this horizon (G-A, corroborated by the oracle-free nulls of F-06…F-09).
But *volatility* is predictable (it is the one universally documented predictability in returns), and
*abstention* is a decision problem the model is actually suited to (meta-labelling, AFML ch. 3). The
controller currently spends its capacity predicting the sign of the next bar — the hardest, least
predictable target available. This is a *framing* flaw, not a bug: the same machinery pointed at
"should I take this rule's trade?" or "how big?" is a different and far more promising problem.

---

## 3. What the evidence rules out (do not spend another round on these)

Each of these is measured, not asserted.

| direction | ruled out by | the number |
| --- | --- | --- |
| new memory/ensemble mechanism | `NL-MECH` (4 tried) | ≈ baseline, all |
| a better model class for direction | `NL-BENCH` (G-A) | Brier skill ≤ 0, all classes |
| re-aiming the learner at "will this rule's trade pay?" (meta-labelling, L06) | F-35 | OOS Brier skill vs the causal base rate **≤ 0** for all 3 base rules at 1h & 15m (−0.0003…−0.0013); AUC ≈ **0.505–0.508** is a detectable whisper that overfits with capacity, and the abstention overlay trades only by keeping **0.3–0.7 %** of bars |
| momentum upgrades (vol-scale, blend, network, regime) | F-06 | ≤ +0.13 Sharpe, ≤2.6 bps |
| cross-sectional momentum (16…720 bars) | F-07 | \|Sharpe\| ≤ 0.033 |
| volatility conditioning | F-08 | +0.112 vs +0.110 |
| calendar seasonality (with OOS) | F-09 | OOS −0.009 / −0.073 |
| funding as a price signal | F-05 | +0.026 |
| order-flow imbalance (taker ratio), 1h & 15m | F-15 | best arm +0.028, break-even ≤ 0.31 bps |
| open interest / toptrader ratio as a directional signal (the **daily** book) | F-28, **corrected by F-45**, refined by **F-46** | pooled next-8h IC **0.020**; the *daily* OI book reads gross 0.96 at **1501×/yr** (break-even 1.89 bps) — but that is the **F-23 implementation artefact**: EWMA-smoothed it clears 4 bps (**8.93–14.73 bps**, net@4 +0.5…+0.7, corr 0.007 with carry). CYCLE-029 (F-46) then showed the signal survives a **pre-registered pre-2024 holdout** (λ=0.1 net@4 **+0.47 pre / +0.59 post**, break-even ~15 bps both regimes; a fixed 50/50 λ blend positive in **every** calendar year 2022–26) — so it is **weak and churny but regime-robust at the blended scale**, and only the single λ=0.25 CYCLE-028 called "best" was regime-specific (F-45/F-46, L19). The toptrader ratio cross-sectionally is F-29 |
| screening a positioning field by level IC only | F-29 | the same toptrader ratio reads ≤0.02 in levels but fades to a net@4 Sharpe of **+0.77** cross-sectionally |
| short-horizon **reversal** as a trade (P3) | F-32 | a real *gross* cross-sectional edge at 1h & 15m (book placebo z **5.5/12.1**, both halves +, causal) but break-evens **0.32–1.31 bps** — dead under any realistic fill, including a 4 bps maker |
| passive/maker execution as a rescue for the reversal family (L08) | F-34 | the maker book's gross Sharpe is **−0.002 (1h) / −0.271 (15m)** vs taker **+0.415 / +0.534**, and per-fill friction is **−0.6…−1.6 bps** at every depth 0–20 bps — *identical* for a seeded-random side, so it is pure adverse selection; only L2/queue data could decide further |
| cross-sectional construction as a **tradability** fix for a fast signal | F-32, F-25 | demeaning buys *power*, not *slowness*: the reversal book's break-even is 0.50 bps and stays 0.43–0.56 bps as EWMA λ falls 0.5→0.05 (the carry dispersion was the opposite, F-24) |
| "the reversal edge lives in **signs** rather than magnitudes" | F-33 | IC of `−r[t]` **0.0133/0.0138** vs `−sign(r[t])` **0.0062/0.0094** (1h/15m) — magnitude carries ~2× the information, contradicting the stated reason for P3 |
| combining the available sleeves | F-12 | +0.019 |
| more correlated crypto bars | F-02, project §8 | design effect rises with n |
| scoring carry on the raw funding series | F-04 | Sharpe 11.58 is an artifact (9.40 on the full window) |
| measuring carry on a window without a deleveraging event | F-19 | old 2.9 y window reads 2–4× the full-history Sharpe |
| reading a design effect off a fat-tailed series | F-20 | one bar owns it: 99.5 raw vs 11.8 winsorised |
| deploying the dispersion sleeve at institutional size | F-26/F-27 | capacity **$13 M** → **$27 M** with a strict 12.5 % position cap (Y=1, 4 bps); still ≪ institutional; flat hold not impact-limited |
| ADV-tilting / dropping thin names to lift capacity | F-27 | gross Sharpe 1.1–3.8 — the funding-rank ordering is the signal and both edits damage it |
| choosing a book's smoothing cadence by **gross** Sharpe | F-37 | a cost-aware walk-forward selector nets **+5.71 OOS**; the gross-blind selector picks a fast λ (turnover ~250×/yr) and nets **+0.28** — the objective, not the smoothing, is what works |
| reading a **hold-like** book's size off the square-root impact model | F-38 | the impact capacity *diverges* as turnover → 0 (λ=0.005 reads **$4.0 B**); the honest limit is **open interest** (LINK binds: $19 M at λ=0.01, $36 M with the cap) |
| assuming a **cost fix generalises** to every active sleeve | F-40 | the fade is not cost-fragile at any λ (recent break-even **55 bps** at EWMA 0.1) so a slower λ buys nothing, and a walk-forward parameter rule *underperforms* pinning on the weak (Sharpe ~0.8) fade (**+0.70 vs +0.94** OOS) — only the per-symbol cap transfers |
| assuming the cost-aware **walk-forward parameter rule** is what makes a slow spec work | F-48 | on the R8 λ family an **unfitted fixed blend** (λ≈0.01+0.02) matches the walk-forward out of sample (net@4 **6.66 vs 6.63**) at **half the turnover** (7 vs 14×/yr) and **1.8×** the break-even; the rule's edge was over the *broken* λ=0.1 spec (the one blend containing λ=0.1 is the worst, 4.36) — **slowness** is the mechanism, not the selection machinery |
| picking the **best of a menu** of blends/parameters and reading it as no-hindsight; freezing a parameter on a **short** window | F-49 | only **1 of 10** pre-registered blends of the R8 λ family clears the 0.2 bar (the cherry-picked pair; no-hindsight sets read 5.74–6.08) and a blend-selection walk-forward reads **5.81** vs the rule's 6.63 — so the blend claim was *menu-dependent*; a λ **frozen** on ≤ 1.7 y picks the F-37-**broken** λ=0.1 and collapses (OOS **1.76–1.93**), while ≥ 2.3 y picks **0.02** and matches the rule (**6.64–6.81**) — the honest simplification is a **frozen λ on ≥~2.3 y**, and the freeze knob is non-monotone |
| keeping a walk-forward **rule** for a parameter that is a **plateau**, or over a *tuned* one | F-50 | the joint (λ, cap) walk-forward **loses** to the pinned `ewma 0.02 + cap12.5 %` book OOS (**6.13 vs 6.86**, pinned ≥ rule on 4/5 sub-spans) — its F-39 edge was over the *broken F-24 spec*; the cap is a **flat plateau** (OOS 6.63 / 6.77 / 6.86 / 6.90 for cap none / 0.10 / 0.125 / 0.15) and **binds** (clips 42.3 % of entries), so `1/k` is structural — **pin it**; a frozen *pair* fails but a frozen *cap* works even on 1 y |
| assuming a **rule-free spec** is specific to one sleeve, or that a weak book's walk-forward is *harmless* | F-51 | the fade (R7, Sharpe ~0.8) shows the same pattern: its joint (λ, cap) walk-forward reads OOS net@4 **0.70** vs the pinned `ewma 0.05 + cap12.5 %` **1.14**, and a λ **frozen** on `[0,S)` (cap = `1/k`) picks **0.05** and reads **1.14 / 1.15 / 0.37 / 0.83 / 0.87** vs the rule's **0.70 / 0.87 / 0.31 / 0.60 / 0.93** — because with the cap fixed the eight λ's span only **0.16** OOS, the rule ranks near-ties (F-40's noise-dominated window, quantified) — so **both deployable sleeves are pinned books** |
| assuming a *position cap* helps mainly by **reducing turnover** (so a cheaper rebalance filter could replace it) | F-52 | a no-trade band swept to the cap's exact turnover (**10×/yr**) recovers only **+0.13 of the cap's +1.26** net@4 gain (5.05 vs 6.18), and across the whole band sweep (16→6×/yr) net@4 stays in **[4.95, 5.05]** — the cap's Sharpe edge is the **shape** (max `\|w\|` 0.438→0.125), not churn; the band leaves OI capacity a **1.00×** multiple of base while the cap is **1.70–1.76×**, so the capacity gain is **concentration** too — and the two **stack** (capped+band: net@4 **6.36** at **6×/yr**) |
| assuming a cost remedy that helped one sleeve (a no-trade band on R8) generalises to another | F-53 | the fade's cap is a **concentration** tool too (a turnover-matched band reads **0.78** vs the capped **1.07**, below even base; capacity 1.03–1.04× vs the cap's 1.43–1.47×) — the mechanism is a property of *clipping* — **but** the band does **not** stack on the fade (**+0.06**, vs R8's +0.18) → the port recipe is **cap + band for R8, cap alone for R7** |
| assuming a **position cap's** benefit is "lower concentration", so any concentration reduction would do | F-54 | a smooth saturation `c·tanh(w/c)` matches the hard clip (**6.04 vs 6.18**; the form does not matter, only the level) — but `sign(w)·\|w\|^p` reads **4.44/3.99/3.25/2.27** for p=1.25/1.5/2/3, *all below* base (4.92), and equal-weight reads **1.51** → the cap is a **tail winsorisation** (clip the extremes, keep the body), **not** a generic shrinkage |
| reading a **five-point** split ladder as if it established robustness over all splits | F-55 | a dense 14-point grid **narrowly fails** the 0.80 bar (expanding freeze 0.71, rolling 0.79) — the expanding `[0,S)` freeze collapses at **every split S ≤ 2190** and only works from S = 2555 (safe boundary **~2.3 y**); a **rolling** 1-year freeze is more robust (0.79 vs 0.71, median +0.30) because it forgets the early regime, and the **cap** lifts rolled robustness **0.50 → 0.79** |
| **averaging two weight vectors without renormalising**, so a "blend" silently carries gross ≠ 1 | F-56 | a fixed OI mix read net@4 **0.70** / break-even 10.75 / 220×/yr instead of F-46's renormalised **0.77** / 11.33 / 254×/yr (the lab's `e38`/`e39`/`e40` blend convention divides the average by `Σ\|w\|`); the discrepancy is now pinned by a second guard, and it did not change the verdict (the mix is **null** either way) |
| assuming a **hold/stale-target** backtest's `Σ\|Δw\|` turnover captures the cost of holding (it omits inter-rebalance drift-trading) | F-56 → F-57 (resolved) | a hold-6 cadence reads turnover 254 → **93×/yr** and net@4 **0.77 → 0.87**, but between updates the target is unchanged and drift-trading is not modelled — a *conservative* caveat carried to CYCLE-040 (drift-aware turnover + a finer hold grid) before the gain is treated as port-shaped. **F-57 answers it: the drift-aware simulation gives turnover within 2×/yr of `turnoverSeries` at every N (and a slightly *higher* net@4), so the measure is NOT optimistic and the caveat does not fire** — but the same cycle shows the cadence **gain** is a fine-grid spike (next row) |
| assuming a **clock-dependent** cost tool (a hold cadence) is the way to cut turnover on a weak sleeve | F-58 | a **state-dependent** no-trade band (rebalance only when the target moves > `eps`) reaches net@4 **0.92** at `eps = 0.03` (turnover **198×/yr**, break-even **15.22 bps**, positive every year 2022–26) — **above** hold-6's 0.87 — as a **smooth plateau** (3 sweep points within 0.05 of the peak, **no** interior re-rise vs hold-N's 1), whereas a hold cadence ignores fresh information and its Sharpe is a jagged function of N → prefer the band; it is now the lab's **general** cost tool (R8 stacks with the cap, R7 alone, OI alone) |
| trusting a **full-sample plateau** in a swept parameter without a frozen-forward check | F-59 | the OI band's `eps` is a full-sample plateau, but picking it on a **trailing** window is unstable below **~2.3 y** (S = 1460/1825/2190 pick the **largest** eps `0.1` and underperform the fixed `0.03` OOS, 1.03–1.22 vs 1.40–1.65) and only settles from S ≥ 3650 → **pin `eps ≈ 0.03`** or choose it on ≥ ~2.3 y; meanwhile the band's *edge over the cadence* **is** OOS-robust (frozen-eps ≥ frozen-N at **11/11** splits, fixed `eps=0.03` ≥ daily and fixed hold-6 at **11/11**) — the **~2.3 y** boundary of F-49/F-55, now for a third parameter |
| assuming the **cap/band chain is per-experiment plumbing** (so a port has to re-derive it) | F-60 | one pure module (`prototypes/port.js`: `clipWeights` + `bandWeights` + `cleanBook` = cap-then-band) reproduces **all five** published books across **three** sleeves — R8 cap `6.18/10×/46.04` (=`e30`), R8 matched band `5.05/10×`, R8 cap+band `6.31/7×` (=F-52's stack), R7 cap `1.07/8×/182.59` (=`e32`), OI band `0.92/198×/15.22` (=`e50`) → the chain is **signal-agnostic**, and the port carries `SLEEVE_SPECS` + `MIN_TRAIN_PERIODS = 2555` (the ~2.3 y rule) as data rather than prose |
| a function's **comment describing a guard** as if the code implements it (and a **bug that flatters the number**) | F-61 | the repo's `carryOnBarGrid` header says it "divides by the period actually observed", but the code divides every funding row by the **default** 8h bar count, so sub-8h funding is understated `8h/interval` (**1×/2×/4×/8×** measured); on the shipped SOL FTX window the receipt is **−0.107** vs the true **−0.324** (**3.03×**), making the pooled sleeve look *better* (ann **9.985 %→9.531 %**, Sharpe **11.96→9.60**) — so the F-11 "implausibly large" alarm cannot fire (the F-18 direction trap), and `auditFundingProblems` is blind to the interval change (**[]**). **A claim in a comment is auditable code: measure the guard the comment promises, with a synthetic ground truth a real dataset may not contain** (the lab's own loader buckets rows first, so no lab number moved — only a dedicated audit caught it) |
| trusting a **statistic's** stated meaning (and quoting it to more precision than the estimator has); assuming an **effective-sample-size** transform is bounded | F-62 | the dependence/DSR backbone is **unbiased** — ensemble means match the closed forms `1+(K−1)ρ` / `K` / `1+ρ` / 1 within **2.5 SE** (max gap 0.318) — but a *single* `designEffect` at the repo's own C = 36 folds spans **0.644–1.452** on true-i.i.d. data (sd 0.243; 0.097 at C = 288), so a two-decimal DE (F-02, F-47) overstates resolution ~10× and a verdict within ~1 ± 0.25 of the `> 1` gate is **not resolvable**; and `effectiveBars = n/DE` is **unbounded** — a perfectly hedged pair gives DE **4.7e−32** → **3.4e34** while `adjustmentNeeded` reads **false** (DE is a *squared* ratio, so `> 0` is not a bound) — the DSR path's `2 ≤ effectiveBars < n` clamp then declines it (intended, L10-i), but lossily (hedged and degenerate both read `null`). **Audit a statistic with a closed form + a seeded ensemble + a standard-error band, not a single run** |
| assuming a **split family** that advertises "purging and embargoing" purges on *every* path (a **walk-forward** trains strictly before its test *by index*, which does not stop a **label-horizon** leak); trusting a test-ledger note over its assertions | F-63 | `walkForwardSplit` takes no `labels`/`labelSpan`/`embargo` and emits no purge metadata, so for label span H > 1 the boundary leaks exactly **`H(H−1)/2`** train/test label-overlap edges per fold (H=5 → 10/fold, 120 at testSize 40; **0** at H=1); its causality guard `isCausalFold` tests index order only and passes every leaky fold, and the repo's `assertNoLeakage` is **never called** on the walk-forward (the lock-registry's "zero label-window leakage" covers only `purgedKFoldSplit`/`combinatorialPurgedSplit`, which ARE leak-free) — and the leak is exploitable (an index-lookup model recovers test returns at **+0.0035**/bar vs 0.0000 clean). **Train strictly before test is not leakage-free: purge the label overlap** *(scoped LATENT on the shipped path by CYCLE-047 — its controller is online: the fit stops at `testStart−1` and labels are realised at the trade's exit, so no training label sees a test return; the purge matters only for a future fixed-label offline model)* |
| assuming a **labelling module's primitives** are exercised because they are exported (and its docs/arguments mean what they say) | F-64 | `analysis/labels.js` is **correct on its contracts** (first crossing = `ceil(level/step)` on **192** monotone cases; the three-way `ret` inequality + first-crossing + timeout index on **60** random paths; CUSUM = an independent drawup reference **160/160**; weights = `(−1)^k C(d,k)`) but **5 of its 6 exports are test-only** — the A/B reaches it *only* via `features.js#fracDiffAt`/`fracMomentum` — so nobody on the shipped path depends on its five warts: the `pt`-before-`sl` tie-break (reachable only when `(ptMult+slMult)·vol ≤ 0`; at `vol = 0` a flat series labels **11/12** events **+1 at `ret = 0`**), the default events' **zero-horizon** `{t1 = event, label 0, ret 0}` bet, `cusumFilter`'s **ignored `events`** argument and **dead `lastEmit`** guard, and the "`size <= 0` uses `DEFAULT_FD_WINDOW`" docstring (auto widths **1/2/3/4** for `d = 0/1/2/3`; the test samples only `d = 0.4`). **Trace who actually *calls* a primitive before believing an audit is live — "exported" ≠ "shipped", and a signature can advertise a parameter nobody reads** *(also: read `ret` as a realised price change, not the barrier magnitude — the touch bar overshoots the level **1362** times on gaps)* |
| trusting a **quoted calibration figure** in the docs/registry as a *measurement*, and a **split count** as the number of independent bets | F-65 | `analysis/overfitting.js` (PBO/CSCV) is **structurally exact** (`cscvSplit` = `C(S,S/2)` splits, block multiplicity `C(S−1,S/2−1)`, complement closure, the `C(22,11)` cap, `relativeRank`'s rank formulas, and `oosOnIsRegression` = an independent sum-formula OLS) and its quoted calibration reproduces **to the split** (**117/252 = 0.46429**, seed 20240) — but over 60 i.i.d. matrices the estimator centres at **0.4769** with **sd 0.2546** (p05–p95 **0.099–0.885**) while the binomial split SE is only **0.0315**, i.e. a **design effect of 65.4** and **≈3.9 effective splits**, so the figure is *one draw* and quoting any PBO to 2–3 decimals overstates its resolution ~8×. **The F-62 lesson applies to the whole estimator, not just `designEffect`: measure the spread of the statistic before trusting a figure it produced.** *(latent rows: `relativeRank` divides by the full `n` while skipping `NaN` so a `NaN` metric biases PBO up; a fully-tied roster is forced to PBO exactly 1 while partial duplication does not bias; `degradation`'s pooled `n = N·splits = 2016` from 80 block performances makes a naive *t* fire on **91.2 %** of skill-less matrices; `cscvBlocks(6,6)` alone yields 1-observation blocks)* |
| trusting a module's comment that it **reproduces a named reference implementation**, and assuming a **guard that cannot fire** is protection | F-66 | `analysis/reality_check.js`'s `politisWhiteBlockLength` comment claims it \"reproduces the reference implementation `arch.bootstrap.optimal_block_length` … to floating-point precision\" — true only where its `g > 0` guard does not fire (30 series match a **vendored port of arch's `_single_optimal_block`** to 1e−9, and the arch AR(1) vector **13.635665 / 15.608940** reproduces from an independently implemented NumPy stream). But the code returns **exactly 0** unless `sigma2 > 0 && g > 0`, while the reference **squares `g`**: over **198/200** AR(−0.5) draws the repo reads 0 and arch a positive length (e.g. **22.0** at `g = −0.858`), so `autoBlockLength` floors to **1 (i.i.d.)** on 99/100 — the automatic block bootstrap silently degrades to i.i.d. resampling on exactly the anti-persistent streams that need it (and the guard fires on **58 %** of i.i.d. columns). **A comment claiming a reference match is a claim; port the reference and diff it. And a guard with no reachable failing input (the `neweyWestSE` `v < 0` clamp — the Bartlett estimator is a PSD quadratic form) is documentation, not protection.** *(latent: the block-bootstrap RC/SPA family is test-only; the shipped primitives — `stationaryBlockIndices`, `neweyWestSE`, the four subsampling procedures — pass every exact identity, and the subsampling size holds 0.040/0.045/0.045/0.030 across φ vs the block bootstrap's 0.090/0.105/0.180/0.385)* |
| assuming a module's **docstring identity** holds, and that a **paired test's alignment guard** identifies the paired units rather than merely counting them | F-67 | `analysis/forecast.js` (the **shipped** forecast scoring layer — `analyze.js` runs the block by default) is exact where it counts: `forecastPairs` IS the `confidenceFromProb` inverse (1e−12) + next-bar sign + fold-last-bar drop; the Murphy partition satisfies `brierBinned = REL − RES + UNC` (1e−17) and **the repo's own independent second implementation** (`observer/legion_metrics.js`) agrees on REL/RES/UNC/Brier to **1e−12**; the DM statistic is exactly `dbar/boot-SE` (i.i.d. size 0.0525/0.1075; the block bootstrap controls φ=0.5 size 0.095 vs 0.135 at `b = 1`); the MCS always contains the sample-best (800/800) and covers 0.880/0.855/0.865/0.925. But the module's comment says the raw-minus-binned gap *is the within-bin forecast variance* — **false**: the exact identity (which the repo's own second implementation states) is `gap = withinVar − 2·withinCov`, negative on **5/6** configs while `withinVar > 0` (wrong by up to **0.13**); and the `forecastComparison` alignment guard compares bar **counts**, so a count-coincident misalignment is silently paired index-wise and the DM verdict **flipped in 6/6** witnesses — *"refuse rather than compare unpaired"* is not what the code does. **A docstring identity is a claim: write it out and diff it against the arithmetic. And a paired test must check that the paired units are the same units — a count is not an alignment** *(also: `groupOf` maps `benchmark` to the baseline's kind, so a signal baseline silently scores a calibrated-probability arm as a z-score — a dead branch unreachable from the driver but live in the exported API; and the MCS elimination denominator is `sd(L_i)`, not HLN's `sd(d_i)` — up to 77× apart but inert on 150 configs)* |
| trusting a **"validated against a full-grid oracle"** claim whose test fixture makes the comparison a tautology; assuming a **budget-saving** framing holds at every budget ratio | F-68 | `analysis/race.js` (the successive-halving engine; engine-only — no shipped importer) is exact on its closed forms (`halvingRounds`, `halvingSchedule`'s `keep = max(1, ceil(survivors/eta))`, monotone budgets, top rung `= maxBudget` when every round runs, the early stop) and on its engine contracts (full rung in arm order, non-finite eliminated, `maximize:false`, deterministic + async, ties stable, both cost counters, guards). But its stated correctness requirement — *"the race winner equals the grid winner, so a racing budget does not change the decided set"* — is true only because the repo test's fixture scores arms in a **budget-independent order** (`rank(b=1) == rank(b=9)`) and because its top rung (**3**) is below the oracle's budget (**9**). On a budget-dependent evaluator (the SHA premise) the race **discards the top-budget best** and disagrees with the top-budget oracle on **0.62–0.70** of seeded fixtures. And the "cost is `O(arms)` at the cheapest rung" framing fails in the small-ratio regime: `spentBudget > gridBudget` (ratios **1.056 / 1.222 / 2.890**), while a small `eta` makes the integer rounding leave **15 of 25** rungs at the same budget. **A test that cannot fail is not a validation: check whether the fixture can distinguish the claim from its negation, and whether the "oracle" uses a budget the method actually visits** *(also: `eta`/`minBudget` are unvalidated — `available:true` with a `null` winner and zero evaluations)* |
| trusting a **regression's probability output** as the fitted model, and a **bounded output map** as a model-class comparison | F-69 | `analysis/benchmark.js` (the **shipped** P1 model-class benchmark, `--variants=bench-*`) is exact on its documented contracts (standardiser zero-mean/unit-std + a collapsed constant column; `fitRidge` matches an **independently solved** centred ridge to **0**; `fitBaseRate` = the prior; the MLP is byte-deterministic; the factory refuses `tsfm`/unknown kinds). But `fitRidge` computes the training base rate `ybar`, centres the target on it (`yc = y − ybar`), and **`predictRidge` never restores it** — the shipped probability is `sigmoid(centred predictor)`, so the arm is anchored at 0.5 whatever the prior (a constant-`y` fold reads exactly **0.5**; a **0.833**-base-rate fold reads a mean of **0.50**, Brier **0.22475** vs **0.13533** with the module's own term restored). And because a least-squares fit of a bounded [0,1] label lands in `[min y, max y]`, the sigmoid confines the output to `sigmoid([−1,1]) ≈ [0.27, 0.73]` — a perfectly separable feature reads Brier **0.1425** (the arm's floor) while the MLP (a free logit bias) reaches **0.99** on a constant-`y` fold. **A regression's stored mean is part of its prediction: if you centre the target, restore the mean. And when scoring a probability, check the output map can express the values the score rewards — a bounded map makes a model-class comparison partly a comparison of maps** *(also: the LOCKED/lock-registry claim that the test proves the ridge closed form "matches a hand-computed solve" is unverified — the closed form is exact, but the five shipped §P1 checks assert accuracy/determinism/standardiser/factory/grouping only; and the eps constant-column fallback maps a one-unit train→test deviation to `z = 1e8`)* |
| trusting a **readout's docstring** for the criterion it computes, and a **fold-scoped re-derivation** of a *global* series | F-70 | `analysis/performance.js` (the significance instrument) and `analysis/backtest.js` (the layer that feeds it — every pooled `report.json` number flows through `purgedCVBacktest`/`poolFolds`/`backtestMetrics`) are **exact to their documented bounds**: `erf` within **1.393e-7** of an independent Simpson quadrature, `normalCdf(0) = 0.5` exactly and odd, `normalInvCdf` round-tripping **2.46e-10** against a Lentz-erfc reference, the moment conventions exact, the Lo (2002) SE = `√(1.5/99)`, PSR **exactly 0.5** at its own benchmark, DSR = PSR at the expected-max hurdle (**1e-15**) with DSR ≤ PSR, MinTRL = **13.1749455166** vs the documented 13.174945 and an independent recompute, and the stationary bootstrap size-calibrated at **5.9 %/11.0 %** on 1000 noise series (repo claim 5.8 %); the backtest arithmetic recomputes exactly and `purgedCVBacktestAsync` is byte-identical to serial. But **L10-bq**: `hitRate(strategyReturnSeries)` receives **only a return series**, so its docstring ("bars with no position are excluded") is a criterion its signature cannot express — the code skips `r === 0`, so a zero-return in-market bar is dropped (**0.6667** where the documented rule gives 0.5) and, because `backtestMetrics` passes the **net** series, every exit-cost flat bar counts as a **miss** (a perfectly-timed 3-round-trip book at 10 bps reads **0.5** where the documented rule gives **1.0**); the shipped check's flat bars *are* its zero-return bars, so it cannot discriminate. And **L10-br**: `scoreFold` re-lags the signal **inside** the test slice (`pos[0] = 0`), so on the supported fixed-signal path the first bar of every fold is flat and a **CPCV** run boundary holds the previous *test* bar's signal (bar 30 pooled **+0.05** vs the global **−0.05**; 3/64 bars differ on a 4-fold split). **A statistic's docstring is a claim: check the criterion the code applies, not the one it names — and when a series is global, re-deriving its lag per slice changes it at every boundary** *(also: a probe's "negative MinTRL" defect is **disproved** rather than merely unmeasured — Pearson's inequality `kurt ≥ skew² + 1` forces `v ≥ (1 − skew·SR/2)² ≥ 0`, so MinTRL ≥ 1 for every measurable moment triple; the real residual is that a NaN sharpe yields Infinity and is labelled `beyond-horizon` instead of `unavailable`)* |
| trusting a **`std > 0` guard** as a **zero-dispersion guard**, an **empty range** as a **no-value abstain**, and a **`-N sigma` gate** as scaling the **window it gates** | F-71 | `analysis/features.js` (the causal signal family every arm position flows through) is **exact on its two headline contracts**: for all 16 candidates a strict-future perturbation of closes/returns/volumes/panel leaves `positionAt` bit-unchanged (0 mismatches over 16x100 bars, non-vacuous), and the abstain contract holds (returns-only view -> 0 on exactly the five channel-dependent candidates; degenerate series finite in [-1,1]; `clampPosition` exact; all 13 single-feature references exact to 1e-12, with `fracDiffAt` = the shipped `labels.js#fractionalDiff` convolution; the cross-section and regime gate match their references). But four latent defects: **L10-bs** — the `if (!(std > 0)) return 0` guard is defeated by floating-point rounding, because for an exactly-constant window the sample mean is **not bit-equal** to the value, so `std = |d|*sqrt(n/(n-1))` is a **denormal positive** the guard cannot reject and the feature reads `|z| = sqrt((n-1)/n)` (**-0.9682458366** n=16, **-0.9842509843** n=32, **-0.9746794345** n=20) instead of 0 — a **0.468-0.492** position at saturation 2 from an information-free feature (the guard fires only where the mean is bit-exact, e.g. the 0.03125 fixture, so the shipped test gives no warning); **L10-bt** — `finiteSum` guards `a < 0` but not `b < a`, so an empty window returns **0** where `meanOf` returns **NaN** (momentum/acceleration read a plausible 0 for a 0-width window instead of abstaining); **L10-bu** — `networkMomentum` self-skip `i === panel.streamIndex` never matches when `streamIndex` is absent, folding the stream own lagged momentum in (**-0.9066812992** with vs **-1.8820447956** without); **L10-bv** — `regimeGatedMomentum` scales the crash gate by the **momentum** window variance, not the gate window (**-0.0806448623** vs **-0.0922736938**, ratio **1.309**), so the gate is too loose in a hot short-term regime. **A zero-dispersion guard must test the dispersion itself, not a computed `std` that floating-point can leave denormal-positive; an empty range must abstain in every helper; and a documented `-N sigma` gate must scale the window it actually gates** *(also: the plural `closes` field is load-bearing — a singular `{close}` series abstains, settling L10-e)* |
| treating a **named quantity** as the weight a function uses, and a **cited reference** as the algorithm implemented | F-72 | `analysis/uniqueness.js` (the López de Prado ch.4 reference: average uniqueness, effective sample size, sequential bootstrap) is **exact on its headline quantity**: `sampleUniqueness` reproduces an independent per-bar scan-all-spans recompute to 1e-12 (`[[0,2],[1,3]]` -> 2/3, 2/3; `[[0,0],[0,5]]` -> 1/2, 11/12), is per-label order-invariant, and matches the SHIPPED `hivemind/training/sample_weights.js#overlapUniqueness` to **exactly 0** (8 fixtures); the ESS identities hold (point labels -> n; ESS = sum; averageUniqueness = ESS/n; ESS <= n). But its only algorithm, `sequentialBootstrap`, stores `avgU[i] = acc` — the uniqueness **SUM**, not the average the comment and ch.4 specify — so the draw is biased toward long labels: two NON-overlapping labels (both average uniqueness 1.0) are drawn in the ratio of their lengths (**0.7480** measured vs the intended **0.5000**; a 1/2/3-length fixture reads 0.1688/0.3299/0.5014 vs 1/3 each). And the implemented heuristic (static numerator, `1/(1+count)` conditioning) is NOT the AFML ch.4 sequential bootstrap it cites — the reference recomputes each candidate's average uniqueness **against the current selection** — so on `[[0,1],[0,1],[2,3],[2,3]]` the second-draw law is 1/7,2/7,2/7,2/7 vs AFML 1/6,1/6,1/3,1/3 (total-variation gap **0.1190**). Spans are also unvalidated (a zero-length span returns NaN and poisons the ESS). **When a function names a weight ("average uniqueness"), verify the code computes that weight and not its un-normalised sum — a constant rescales probabilities only while every item is scaled the same, and here the scale IS the span length. And check that a "reference: ch. N" comment names the algorithm actually implemented; a test that asserts only length/determinism/range cannot.** *(All rows are test-only/latent: no shipped importer, and the shipped average form matches.)* |
| trusting a **panel aggregate** to count only the units it could measure, and an **API limit of zero** to mean zero | F-73 | `analysis/streams.js` (the SHIPPED "buying effective independence, not bars" layer: `resampleCandles`, `designEffectOfStreams` (Kish 1965), `selectStreams`, `formatStreamSelection` — `analyze.js` prints all of it) is **exact**: the resampler reproduces a hand recompute to 1e-12 (factors 2/3/4/7 x keepIncomplete) with every OHLCV invariant, never mutates, is a shallow copy at factor 1, drops a trailing partial group unless kept, rejects a bad factor, and honours the non-finite fallbacks (missing high/low -> max/min(open,close); a missing volume counts as 1); the design effect satisfies every Kish identity (`rawBars = K*T`; `DE = 1+(K-1)*rbar`; `effectiveBars = rawBars/DE`; `effectiveStreams = K/DE`; `effectiveBarsPerBar = 1/DE`), reports K=1 as the trivial panel, identical streams as one bet (rbar 1, DE 2/3, effectiveStreams 1), aligns on T = min length, chooses `fold-sharpe` iff the fold tiles T and abstains on the degenerates; and the selector is deterministic, tie-breaks by label, is monotone and computes its marginal arithmetic exactly. But **L10-ca**: a zero-variance (constant) stream is **skipped from `rbar`** by `meanPairwiseCorrelation` yet **still counted in `K` and `rawBars = K*T`** — adding one constant stream leaves rbar **bit-identical** (-0.0133166822) but takes effectiveStreams **2.0270 -> 3.0821** and rawBars 480 -> 720, so a no-information stream buys a full unit of "effective breadth"; and `selectStreams` **does** skip it, so the two shipped functions disagree about what a stream is. And **L10-cb**: `maxStreams <= 0` is treated as **unlimited** (0 and -3 both select the full set instead of none). **An aggregate that skips an item from its statistic must also skip it from its count — otherwise a unit that carries no information still buys breadth; and validate an API limit (0 means none, not all).** *(Diagnostic-layer/latent: the numbers never enter the scored arithmetic, and the driver passes a positive maxStreams.)* |
| trusting a **guard** to cover the degenerate input it names, and a **perturbation harness** to reach every input a candidate reads | F-74 | `analysis/world.js` (the SHIPPED audited evaluation world, round 23 N0 — it exists because a returns-only perturbation left the candle-driven model's input untouched so the audit passed vacuously, BUGS.md #22; `analyze.js` + `fold_worker.js` build their views through it) is **exact on its contract**: `shockFactor`/`volumeShockFactor` are 1 at and before `after` and strictly inside [1, 1+2*probe] after it (so a path stays positive), deterministic, non-uniform and phase-shifted (t=after+2: price 1.0494 vs volume 1.1369); `shockCandles(null)` is the same array, every bar <= after is the SAME object, every bar > after a new one with OHLC x f(t) and volume x fv(t), never mutating the input, deterministic, shape-changing (close ratio 1.0001-1.0993); `makeCandleViewFor` returns the real candles on the base pass and a self-consistent tuple on a probe pass (`view.returns === barReturns(view.closes)` exactly) with the past bit-unchanged and all future bars moved. But **L10-cc**: `panelFor` replaces the panel's own-stream slot only when `panel.streamIndex` matches an index, so with `streamIndex` **absent** (or out of range) every slot stays the UNPERTURBED original while `view.returns` is shocked — a cross-sectional candidate reads its own unshocked series and the look-ahead audit is **VACUOUS** (the exact trap the module exists to close; same root cause as L10-bu, opposite consequence). And **L10-cd**: `worldFromCandles`' `maxBars` guard treats `0` as **all bars** (falsy) and a negative value as **drop the first |maxBars|** (`slice(-maxBars)` sign flip), with a fractional value truncated silently — reachable from `--bars`. **A guard must decide what its boundary value MEANS (0 is a count, not "disabled"); and a perturbation harness must be checked for the inputs it fails to perturb — an unreachable input is a green test that cannot fail.** *(Latent: analyze.js always sets streamIndex and a positive bars.)* |
| trusting a **normaliser** to normalise every argument it takes, and a **reply validator** to reject every malformed reply | F-75 | `analysis/parallel.js` (the SHIPPED order-preserving bounded-concurrency scheduler, round 26 R26-4 — `backtest.js`/`walkforward.js` use normaliseConcurrency/scheduleUnits, `analyze.js` uses makeFoldExecutor, `fold_worker.js` posts the reply) is **exact on its queue contract**, which is the thing it exists for: it returns results in UNIT ORDER regardless of completion order (finish order 2,1,0,5,4,3,6,8,7,9 -> r0..r9), calls exec exactly once per unit, never exceeds the requested concurrency (peak 3 of 3; n when the request exceeds n), reports through onResult out of order with a throwing reporter harmless, rejects the whole call with the FIRST error and starts no unit after it while awaiting every started unit (no dangling promise), propagates a synchronous throw, and returns [] for empty input; makeFoldExecutor adapts {positions, confidence, stats} to {signals, confidence, stats} and throws a named malformed-reply for a null/undefined reply or a non-array positions (incl. a Float32Array). But **L10-ce**: `normaliseConcurrency` validates only the VALUE, not its `max` cap — `{max: 0}` -> **0**, `{max: -2}` -> **-2**, `{max: 2.5}` -> **2.5**, so the "normalised concurrency" can be non-positive or fractional (not reachable via scheduleUnits, which passes max = n >= 1). And **L10-cf**: makeFoldExecutor validates `positions` but **silently NULLS** a non-array `confidence` (5, a Float32Array) and any falsy `stats` (0, missing) — half a malformed reply raises, half is absorbed, so a worker switching to a typed-array confidence would lose the R26-3 raw pre-policy confidence with no error. **Validate every argument a normaliser takes, not just the one in the name; and make a validator reject the whole reply class it claims to check — a silent null is a decision, not a rejection.** *(Both latent: the bad cap needs a direct caller; the worker posts an array or null.)* |
| trusting a **thin post-processing wrapper** to apply the options it is passed, and a **`Object.freeze`** to make a default immutable | F-76 | `analysis/holding.js` (the SHIPPED turnover policy grid, round 26 R26-5 - `analyze.js` runs it as runTurnoverSweep behind `--turnover-sweep`, passing the run costBps and `decisionOptions: { requireCleanAudit: audit, ... }`) is **exact on its contract**: the grid is the cartesian product DZ x SCALE x HOLD (3x1x3 -> 9 policies, 18 rows for two candidates; each policy `{...holding, deadZone, scale}`), every row equals a direct `restateReportAtPolicy(candidate, policy)` recompute to 1e-9, rows are non-increasing in break-even with a missing value last, byId.best is the highest-break-even row and bestPromoting the highest-break-even promoting one, bestTurnoverPolicy prefers promoting and returns null for an unknown id, the two bail-outs return available:false, and formatTurnoverSweep renders the ids and the target. But **L10-cg**: `turnoverSweep` accepts and ECHOES `costBps` but never threads it into `restateReportAtPolicy`, so every netSharpe/dsr and every promotion decision is at ZERO cost ({costBps: 0} and {costBps: 25} rows are byte-identical apart from the echo - both netSharpe 0.6864950785702724 at dz 0.1 - while a direct restatement at 25 bps reads -3.156645069841796); since the shipped caller passes costBps, a `--turnover-sweep --cost-bps=10` run prints cost-free Sharpes. And **L10-ch**: the `requireCleanAudit` hurdle the caller passes is STRUCTURALLY INAPPLICABLE because `restateReportAtPolicy` drops the `audit` block (unlike its sibling `restateReportAtCost`), so a candidate that failed the run's look-ahead audit still promotes. And **L10-ci**: `DEFAULT_TURNOVER_GRID` is only SHALLOWLY frozen (`Object.isFrozen(deadZones)` false), so `deadZones.push(0.9)` takes the default sweep 48 -> 54 policies. **A wrapper that forwards an option must forward it all the way to the function that consumes it; an option that is read, echoed and never used is a dead argument wearing a live one's clothes - and `Object.freeze` buys you the object, not its contents.** *(All latent/report-level: the module only restates journaled inputs, so no scored number moves; no golden moves and no fold-back row.)* |
| trusting a **summary function** to be the estimator it cites, and a **formatter** to read the label it prints off the object it formats | F-77 | `analysis/replication.js` (the SHIPPED seed-replication honest-summary layer, round 26 R26-13 - `analyze.js` imports seedDistribution/formatSeedReplication behind `--seeds`, aggregating a multi-seed run into replication.json) is **exact on its contract**: `interquartileMean` reproduces the rank-slice middle on every hand case ([1,2,3,4] -> 2.5, [1..8] -> 4.5, [] -> NaN, <4 -> plain mean, non-finite filtered, monotone); `stratifiedBootstrapCI` is deterministic per seed, seed-sensitive, preserves each stratum size in every replicate (a statistic that returns the sample length reads 12 for strata [4,5,3]), lo <= median <= hi, abstaining on empty/all-non-finite; its empirical coverage of a known mean is 0.92 (400 panels, nominal 0.95); `varianceComponents` satisfies total = between + within + residual to 1e-9 with fractions summing to 1 in the pure-between (seedFraction 1), pure-within (foldFraction 1), repeated-cell (residualFraction 1) and mixed (0.02703/0.97297/0) panels, totalVariance the population variance; `pairedVarianceRatio` = var(paired)/var(unpaired) with reduction = 1 - ratio exactly (ratio 0.000635), abstaining on short / zero-unpaired-variance input and going negative when the pairing hurts. But **L10-cj**: the "IQM" drops floor(n/4) BY RANK, not a quarter of the MASS - it is NOT the cited Agarwal et al. (arXiv 2108.13264) / rliable estimator (a [q1,q3] quantile-filter): witness [0,0,5,10] reads 2.5 (mean of [0,5]) vs the reference 1.6667 (mean of [0,0,5]), and 149/300 right-skewed panels differ (max gap 1.016). And **L10-ck**: `formatSeedReplication({ label, dist, alpha = 0.05 })` prints `(1 - alpha)*100}%CI` using its OWN alpha parameter, never dist.ci.alpha, so a distribution built at alpha = 0.10 is labelled **95%CI** (its bounds the 90% ones); only a caller who passes the alpha again sees 90%CI. **An estimator is not the reference whose name it borrows - check the rule (rank vs mass), not the label; and a formatter must read its label off the object it formats, not off its own defaults.** *(Both latent/claim-level: the module is self-consistent and the shipped path uses the default alpha throughout; no golden moves and no fold-back row.)* |
| trusting a **boolean flag** to enforce the whole rule its docstring states, and a **numeric recursion** to stay finite across its whole input range | F-78 | `analysis/dependence.js` (the SHIPPED cluster-inference module, round 25 - the delete-one-cluster jackknife behind the pooled cross-stream Sharpe SE; `walkforward.js#promoteDecision` uses pairedClusterTest/clusterStability/pairedClusterSignTest; PURE and imports nothing) is **exact on its contract**: `pearsonCorrelation` = the textbook formula with +/-1 monotone and NaN guards (<3 points, zero variance, unequal length); `meanPairwiseCorrelation` averages the finite pairs; `equicorrelationDesignEffect` = 1+(K-1)rho and effective size K/deff (K=1 -> 1, non-positive deff abstains); `foldWindowClusters` groups exactly (cluster f = every stream fold f) and throws on a non-rectangular/non-divisible/bad-foldLength panel; `clusterJackknife` on [[1,2],[3,4],[5,6]] reproduces estimate 3.5, leave-one-out [4.5,3.5,2.5], se sqrt((2/3)*2) = 1.1547005383792515; `studentTPValue`/`regularizedIncompleteBeta` reproduce the exact df=1 (Cauchy) and df=2 closed forms to 5e-7, t=0 -> 0.5/1, symmetric, twoSided = min(1,2*oneSided); `studentTCritical` inverts the tail (1.6895724578 / 2.0301079283 at df=35; table 1.68957/2.03011); `signTest` is the exact binomial tail (7/10 -> 0.171875) and signTestFloor its minimum. But **L10-cl**: `clusterStability.stable` checks ONLY `fractionPositive >= minFraction` and NEVER the `worstDelta > minDelta` its docstring requires - with minFraction = 0.5, fractionPositive 0.6667 and worstDelta -0.5 it reads stable: true where the documented rule says false (the two coincide only at the shipped minFraction 1; `promoteDecision` exposes minStableFraction). And **L10-cm**: `signTest` starts from `pmf0 = 0.5^n`, which underflows to 0 for n >= ~1075, so EVERY pmf is 0 and it returns pValue = 0 (significant true) for ANY win count - a balanced 2000-cluster test reads certainly significant (n=1000 is fine at 0.5126). **A flag must evaluate every clause of the rule it advertises (an AND'd condition silently dropped is a weaker gate than the doc describes); and a numeric algorithm's safe range must be enforced, not merely assumed in a comment - underflow fails in whichever direction the formula happens to fall.** *(Both latent: the shipped minStableFraction default is 1, where the two rules coincide, and the documented cluster counts are tens to a few hundred (< 1075); no golden moves and no fold-back row.)* |
| trusting a **restatement** to keep one basis for every consumer that reads it | F-79 | `analysis/decision.js` (the SHIPPED decision-grade report, round 26 R26-8 — six blocks composing the other analysis layers, no new strategy statistic; pure) is **exact** on its contract: `foldConcentration` reproduces a direct `strategyReturns`+`sharpeRatio` recompute to 1e-12 (top-K shares; signed sums; delete-one-cluster range full **−3.5204429235768973** / min **−5.253810564276818** / max **−1.6034020777212812**; per-fold marginals; a non-positive gross total → null shares); `confidencePersistence` is the pooled within-fold lag-1 (**0.666707822740828**) and half-life (**1.709771604681528**) with no cross-fold pairs; `pairedUnitsNeeded` is the brute-force minimal-n (**9** observed / **18** at 80 % power) with `pairedMde95 = tCritical(C−1,α)·se`; all six `cheapestFlip` kinds fire; `promotionAcrossCadences` is majority-pass + catastrophic veto; and the six-block `decisionReport` carries the explicit-na discipline. But **L10-cn**: `restateReportAtPolicy` replaces `folds` with metrics rebuilt from the RESTATED positions yet returns `foldInputs: report.foldInputs` UNCHANGED (the P2 chaining), so a POLICY-restated report handed to `foldConcentration` — which reads its gross half from `folds` and its Sharpe half from `foldInputs.signals` — describes two different position series in one block (restated net Sharpe **−5.201698358740081** vs the carried-signal Sharpe **−3.5204429235768973**). The shipped path restates at COST only (`restateReportAtCost`, same signals, same `costBps`), where both halves agree (**−3.877740023296727**), so it is latent. **A restatement that swaps one derived block while carrying the raw journal another block reads leaves the two describing different positions — audit every consumer of a restated report, not just its headline metrics; and when a function's two readouts come from two different inputs, check they share a basis.** *(Latent/export-level: the module computes no new statistic, and the shipped call restates at cost only; no golden moves and no fold-back row.)* |
| trusting a **non-finite guard** to be safer than the saturation it shadows, and a `|| 1` fallback to preserve a legitimate zero | F-80 | the five pure kernel bags under `hivemind/kernels/` (`activations`, `linalg`, `normalization`, `sampling`, `statistics`; SHIPPED — `gradients.js` and `transformer/*`, installed on `HiveMind.prototype`) are **exact on the finite path**: `_silu`/`_siluDerivative` = `x·σ(x)`/`σ(x)(1+x(1−σ(x)))` (1e-12), `_sigmoid` = `1/(1+e^−x)` (1e-15, monotone), `_softmax` = `exp(a−max)/Σ` with the uniform/`[]`/`out` contracts; the linalg helpers; `_rmsNorm`, `_applyRoPE` (identity at pos 0, documented rotation at pos 1), `_normalizeSemantic`; the Irwin-Hall(12) normal, the Dirichlet sampler, unit-norm LSH hyperplanes; and the statistics helpers (the documented MAD proxy, EMA, conformity, the lower nearest-rank percentile, the sparse/dynamic thresholds, the gradient/spectral norms, the stateful detectors). But **L10-co**: `_sigmoid`/`_silu` return **0** for `+Infinity` — the `isFiniteNumber(x) ? … : 0` guard runs BEFORE the internal `Math.min(Math.max(x, −100), 100)` clamp, so the clamp is unreachable for exactly `±Infinity`, and `_sigmoid(+∞) = 0` (limit 1), `_silu(+∞) = 0` (limit +∞) while `_sigmoid(±100)` = 1 / 3.7e-44; a maximally-positive logit reads as probability 0. And **L10-cp**: `_computeGradientNorm`/`_computeSpectralNorm` (`… || 1`) and `_computePercentile` (`… || 1.0`) replace a legitimate **0** with **1**; **L10-cq**: the vector helpers disagree on a length mismatch (`_fastVectorDot` → NaN, `_vectorDot` → 0, `_fastVectorAdd` → a copy of `a`); **L10-cr**: two dead clamps (`_computeDualEMA` 0.8, `_computeNTKStability` −0.1) and `_computeFractalDimension` an ad-hoc clamped dispersion (a constant series reads the max 2). **A guard that returns 0 for "invalid" must decide what the TOP of the range means, not just the bottom — a forbidden value is not the same as a saturating one; and a division/NaN fallback (`|| 1`) silently rewrites a real 0 into 1, so guard the divisor, not the result.** *(All latent: the golden suite pins the finite-path numerics, which are exact; no golden moves and no fold-back row.)* |
| reading a gain from a **coarse cadence/parameter grid** as a plateau; assuming the lab's turnover measure overstates a hold policy | F-57 | a **fine** grid (N = 1…36) is jagged — hold-6 (0.87) is an **isolated spike** (**+0.10** over neighbours 5/7), only **4 of 15** holds beat daily by ≥ 0.05 (2/3/6/9), short-hold mean **0.80** vs 0.77, long region (10–24) collapses to **0.60**; and the **drift-aware** simulation gives turnover within **2×/yr** of `turnoverSeries` at every N and a slightly *higher* net@4 → the cadence gain is **noise** while the turnover measure is **verified adequate** for hold policies |
| reading an OI capacity off `f·mean(OI)/mean\|w\|` (a **ratio of means**) | F-41 | it is an *average-case* bound; the desk's constraint is the **min of ratios**, **2.6–8.8×** smaller (dispersion spec $23.41 M → **$4.37 M**, fade $36.99 M → **$4.19 M**, fade+cap $53.84 M → **$12.62 M**); at the published sizes the book breaches the 5 %-of-OI cap in **65–77 %** of periods (peak **16–44 %** of LINK's OI), and even `f·min(OI)/mean\|w\|` is ~1.8× too high for an uncapped book |
| treating an OI capacity as a **fixed dollar number** | F-42 | the constraint is per-period, so a constant trailing-p5 size still breaches in **2.7–3.7 %** of periods (peak 6–10 %), and a *lagged/EWMA* size breaches **53–55 %** (a lagged size sits above a falling bound) — only the **running-min** constant is safe, or a **clipped trailing-median** schedule (mean **$16.94 M** R8 / **$19.34 M** R7, zero breach); floating fully to `G_t^cap` buys **2.0–4.1×** mean size but cuts dollar Sharpe (R8 5.02→3.26) and deepens the fade drawdown (22.8 %→58.2 %) — capacity, not alpha |
| taking `min_j(OI_j/\|w_j\|)` over a **partial** symbol set | F-41 (fix) | when some traded symbol has no OI print the min is meaningless — it printed **$936 B** at 2021-11-04 (only BTC had OI, at weight 0.0002); require **every traded symbol** to have an OI print (dispersion coverage becomes **78.9 %**) |
| carrying a mix weight / hedge decision over from a **pre-retune** spec | F-43 | F-31's 25 % fade allocation hedged the F-24 carry book's decayed half (−0.12 net@4); the re-tuned book's half is **+4.66**, so the hedge is moot and the fade (net@4 **1.00**) dilutes carry (**6.49**) — the 25 % mix nets **1.62** and a walk-forward rule picks **0 %** in 11/11 blocks |
| assuming **per-sleeve** capacities add in a portfolio | F-43 | a min-of-ratios OI bound is a **portfolio** constraint: the two sleeves' individual means are $23.72 M + $31.85 M but the joint schedule at the **fixed** mix is **$31.32 M (56 % of the sum)**, and running both at their individual compliant sizes breaches the 5 % cap in **78.4 %** of periods (peak **10.0 %**); the books' LINK positions do not net (corr −0.20) |
| reading one joint size off a **fixed** allocation, or deploying an **LP-optimal** size | F-43/F-44 | the free-split frontier is a per-period LP: **mean $62.72 M (1.13× the sum), median $37.11 M (0.88×), 2.00× the fixed mix** — the constraint is cheap; what fails is a *stable allocation* (optimal fade share p5 0 / p95 1) and the LP-optimal schedule itself (churn **48.5× gross/yr**, net@4 **0.62** vs carry's 6.49) |

---

## 4. Where an edge could actually come from (ranked, with mechanism)

### E-A — Fix the *decision*, before hunting more edge. (highest expected value)

Nothing in §4 below is credible while the verdict is read off 25 days. Concretely:

1. **A model-free long-sample scorer.** The signal family is pure and cheap (`positionsOfFast` scores
   8 streams × 53 500 bars in well under a second). Scoring the *signal arms* over the full history and
   printing a block-Sharpe ladder beside the 600-bar run would immediately show whether a promotion is a
   property of the strategy or of September 2026.
2. **A window-robustness statistic in `report.json`** (`blockStability`: k disjoint windows, per-window
   Sharpe, positive fraction), and a gate that requires it.
3. **Report break-even at the full-history window too**, so the cost verdict is not window-dependent.

This costs almost nothing and it is the difference between "nothing promotes" and "*and we know that on
6 years, not 25 days*".

### E-B — Carry as a breadth stream, scored honestly. (the only measured independent source)

F-04 (revision, CYCLE-006): **+9.05 %/yr, Sharpe 4.54, 7.96 % max drawdown, r = 0.09** with the price
basket, over the full 6.0 years. (The earlier "+4.8 %/yr, Sharpe 0.96, 10.2 % DD" was measured on the
2.9-year window the repo's `markPrice = 0` gap enforced — see F-19.) The mechanism is structural
(funding is the price of leverage, a different state variable) and it is the one thing on this data
that is genuinely uncorrelated. Requirements before it is used as a stream:

* **Mark the basis.** Never report the raw funding series (Sharpe 9.4 is accounting, not trading).
* **Risk-size it.** BNB and SOL have no carry at all over the full history and they carry the tail, so
  equal weight is wrong; inverse-vol across symbols or vol-targeting (L09) is the fix.
* **Consider the dollar-neutral form.** L12/F-21: weighting the carry book by the demeaned *rank* of
  each symbol's funding is level-neutral, which is why it is positive in every crash window
  (FTX month +5.51 vs the flat book's −5.12) at a 2.93 % drawdown. It is the better carrier of the
  same yield — **per unit of gross exposure**. Its λ=0.1 form **decayed below the fee** in 2025–26
  (F-36: net@4 +5.41 (2024) → −0.01 (2025) → −1.88 (2026), break-even down to 2.9–3.4 bps, while the
  *gross* trend stayed flat, p 0.39). **But the decay was the *policy*, not the sleeve (F-37):** a slower,
  cost-aware EWMA restores the margin — the walk-forward λ-selection nets **+5.71 OOS** vs the pinned
  λ=0.1's **+2.76**, and the recent-24m break-even rises to **27 bps** at the slowest λ. So the dispersion
  form is net-tradable in the current regime *given a cost-aware smoothing cadence*; a fixed λ=0.1 is not.
  The flat hold (R4) is unaffected (it barely trades).
* **But check size, not just Sharpe.** CYCLE-011/F-26: the dollar-neutral dispersion form at λ=0.1 is
  **impact-bound to ~$13 M** (Y=1, 4 bps; the rank weight concentrates in the thin alt — DOGE binds at
  ~1 % of ADV), while the **flat hold is not impact-limited** (it barely trades). So "better carrier"
  means better risk-adjusted *per unit*, not more deployable capital; if the project needs hundreds of
  millions, the honest sleeve is the flat book, and the dispersion form is a small-size one.
* **A position cap helps, but only ~2× — and the retune changes which bound binds.** CYCLE-012/F-27: a
  **strict per-symbol cap at ~1/k (12.5 %)** — clip and hold, no renorm — lifts the λ=0.1 capacity
  **$13.2 M → $26.7 M** (and $107 M at Y=0.5) while cutting turnover, drawdown and the design effect.
  CYCLE-021/F-38: on the F-37 retuned (slow) book the square-root impact capacity *diverges* (a near-hold
  never trades — λ=0.005 reads $4.0 B, fictional), and the binding limit is instead **open interest
  (LINK)**: $19.2 M at λ=0.01 and **$35.9 M** at `ewma 0.02 + cap12.5 %` (recent net@4 +4.24, break-even
  15.97 bps). So for a persistent book, quote the **OI bound**, not the impact number. ADV-tilting or
  dropping the thin symbols destroys the rank signal.
* **The spec is now port-ready and fee-robust (CYCLE-022/F-39).** A **joint (λ, cap) walk-forward** over a
  40-book grid — blind to the future — beats the pinned λ=0.1 spec out of sample (**+6.13 vs +2.76**) and,
  fee-stressed on the same series, stays net-positive down to a **10 bps** fee (net@4 +4.43; ~6× headroom
  at 4 bps). So the dispersion sleeve's carry stream is closed end-to-end (signal → cost → capacity → OOS
  rule → fee robustness): `ewma` weights at a walk-forward cost-aware λ (recent ≈ 0.02) + a strict 12.5 %
  cap, ~$36 M, ~25 bps break-even. CYCLE-031/F-48 then **removed the fitted rule**: a fixed, unfitted
  two-scale blend (**λ ≈ 0.01 + 0.02**) matches that walk-forward out of sample (net@4 **6.66 vs 6.63**) at
  **half the turnover** (7 vs 14×/yr) and **1.8×** the break-even — so the λ policy can be a fixed blend,
  with no lookback/block; the *slowness* is the mechanism, not the selection. **CYCLE-032/F-49 scoped that
  down:** the blend is the best of a menu (1 of 10 sets clears; no no-hindsight set does) and not learnable
  forward (5.81), so the honest simplification is a **λ frozen on ≥ ~2.3 years of trailing data** (it lands
  on 0.02 and matches the rule, OOS 6.64–6.81) — the walk-forward's value is confined to the first ~2 years,
  where a short window freezes the broken λ=0.1. **CYCLE-033/F-50** then removed the **last** fitted object —
  the **cap**: the joint (λ, cap) walk-forward **loses** to the pinned `ewma 0.02 + cap12.5 %` book OOS
  (**6.13 vs 6.86**), and the cap is a **flat plateau** (6.63 / 6.77 / 6.86 / 6.90 for cap none / 0.10 /
  0.125 / 0.15; it binds, clipping 42 % of entries), so `1/k = 0.125` is **structural**. **Final R8 spec:
  a fully pinned book — λ frozen on ≥ ~2 y + cap = 1/k — with no walk-forward.** **CYCLE-034/F-51** ran the
  same chain on the other deployable sleeve, R7 (the fade): its joint (λ, cap) walk-forward **also loses**
  (OOS net@4 **0.70** vs the pinned `ewma 0.05 + cap12.5 %` **1.14**), and a λ frozen on `[0,S)` with the cap
  at `1/k` picks **0.05** and matches-or-beats the rule at every split — because the fade's λ surface is
  **flat** (only 0.16 OOS across eight λ). **So both port specs are pinned books; the walk-forward machinery
  is unnecessary for either.** **CYCLE-035/F-52** then asked what the cap is *for*: a no-trade band swept to
  the cap's exact turnover recovers only **+0.13** of the cap's **+1.26** net@4 gain (the band's whole sweep
  stays in [4.95, 5.05]), and the band leaves OI capacity a **1.00×** multiple of base while the cap is
  **1.70–1.76×** — so the cap is a **concentration** tool on both net and size, and the two **stack** (a
  band on the capped book: net@4 **6.36** at **6×/yr**). The port cost recipe is now **cap `1/k` +
  a no-trade band**.
* **The flat hold's real limit is open interest, not impact.** CYCLE-013/F-28: the flat book holds `G/k`
  per symbol and that reaches 1 %/5 %/10 % of the thinnest alt's open interest at **$6.9 M/$34.3 M/$68.6 M**.
  So *both* forms are small — the whole carry complex is a **~$5–70 M strategy**, bounded by size (OI for
  the flat hold, impact for the turnover-heavy ones), not by Sharpe. If the project needs hundreds of
  millions, carry is not the vehicle at any construction tested here.
* **Check the mark assumption first — done.** Every number above marks the perp leg at a smoothed index,
  so it was tested (L14) against the **traded** 8h perp close in CYCLE-007 (`e15_traded_basis.js`,
  `data/perp_8h.json`): flat 4.54 → 4.65, dispersion 5.03 → 4.98, reversion 9.15 → 9.17, mean
  mark−traded spread ≈0.003 % (sd 2–5 bps). "Carry" is tradable, not a mark illusion (F-22).

Its natural role is a **ninth panel stream** (which is exactly P4/G-J) — its value is the *independence*,
not the return, and that is a legitimate reason to include it.

**And a second independent stream exists (L18).** CYCLE-013–015 found and validated the **toptrader fade**
(F-29/F-30, above), which is essentially **uncorrelated** with the carry dispersion book (return corr
**−0.001**). CYCLE-015/F-31 shows what that buys: not a higher full-sample Sharpe (the max-Sharpe mix is
~98 % carry), but **robustness** — a 25 % allocation to the fade turns the carry book's negative net@4
second half (−0.12, the F-24 decay) into **+0.75**, at a combined net@4 of +1.38 with *both halves
positive*. The lab's first portfolio whose worst half is positive net of costs; both sleeves are OI-bound
to tens of millions.

### E-C — New data, if the goal is a genuinely new edge.

Every rule computable from OHLCV + funding on 8 majors has now been tested here and reads ~0, and the
cheapest new field has now been tested too (F-15: taker order flow at 1h/15m is **independent but
directionless**). The mechanisms that remain, in order of mechanism-strength:

1. **Positioning — measured (F-28/F-29), OI *signal* re-opened (F-45/F-46).** The **OI *change*** is not a
   *pooled-IC* signal: Δlog(OI notional) predicts the next 8h return with pooled IC **0.020**. But as a
   **cross-sectional** book it is real — EWMA-smoothed it clears a 4 bps fee (F-45: λ=0.25 break-even
   **8.93 bps**, net@4 +0.65; λ=0.1 **14.73 bps**, +0.52), and CYCLE-029 (F-46) showed a **pre-registered
   pre-2024 holdout does not kill it** (λ=0.1 **+0.47 pre / +0.59 post**; a fixed, unfitted 50/50 λ blend
   positive in **every** calendar year 2022–26, net@4 +0.77 full) — only the single λ=0.25 was
   regime-specific (pre −0.12 / post +1.45). So "OI is directionless" is now "OI is a **weak, churny
   (254–338×/yr), thin-alt-bound** signal that survives its holdout". And OI **prices the
   flat book's size**: `G/k` per symbol reaches 1 %/5 %/10 % of the thinnest symbol's open interest at
   **$6.9 M/$34.3 M/$68.6 M**, so the flat carry hold is OI-limited to tens of millions (not the $50 B
   its impact capacity suggested). **CYCLE-024 (F-41) then corrected the *statistic***: those bounds are
   `f·mean(OI)/mean|w|` (a ratio of means, average-case); the desk's constraint is the **min of ratios**,
   **2.6–8.8×** smaller (dispersion spec $23.41 M → **$4.37 M**, fade $36.99 M → **$4.19 M**; at the
   published sizes the books breach the 5 %-of-OI cap in **65–77 %** of periods, peaking at 16–44 % of
   LINK's OI, and the binding moments are the dislocations). And the **toptrader long/short ratio, used
   cross-sectionally, is a real (modest) contrarian signal** — a dollar-neutral fade book scores gross
   Sharpe **1.055**, break-even **15.1 bps**, net@4 **+0.77** (F-29), and it survives all four validation
   tests (F-30): held-out halves net-positive, not the funding rate, and **EWMA(0.1)-smoothed weights** cut
   turnover to **23×/yr** and lift the break-even to **74 bps** (net@4 +0.79). It is OI-bound to tens of
   millions — a small but *independent, validated* stream (lead L18; combine-with-carry is the open
   follow-on). *Do not screen a positioning field by level IC alone — the cross-section is where the power
   is (F-03); a single "best" smoothing parameter can itself be a window fit (F-46) — prefer a fixed blend
   across scales; and never quote `mean(A)/mean(B)` for the constraint `min(A/B)` (F-41).* Remaining:
   **liquidation prints** — **closed DATA-BLOCKED (CYCLE-024)**: Binance no longer publishes
   `liquidationSnapshot` and the exchange APIs serve only recent fills, so this last mechanism is not
   testable from free sources.
2. ~~Order-flow imbalance / taker buy-sell ratio.~~ **Measured NEGATIVE (F-15).** The field is free
   and is now in the lab (`data/taker_*.json`), but its bar-level aggregate carries no directional
   edge at 1h or 15m — and it is *independent* (cross-asset flow corr 0.020), so it is a usable
   *state variable* even though it is not a signal. The sub-minute information it aggregates away is
   untradeable in this bar model.
3. **More venues / asset classes** (the plan's own "broader basket"): decorrelation by *asset*, which is
   the only route to effective streams > 2 that does not depend on a signal working.

### E-D — Change the model's job (the reframing that makes the machinery useful). *(measured and CLOSED NEGATIVE in CYCLE-018)*

The learned layer's only defensible role given G-A was **abstention and sizing on top of a rule**
(meta-labelling): target `P(the rule's trade is profitable)` rather than `P(next bar is up)`. That target
is (a) much more predictable — it conditions on a setup whose context matters — and (b) directly
actionable (take/pass/size).

**CYCLE-018 (F-35) measured the target itself, and the reframing does not work.** Using the repo's own
causal features and a deliberately simple logistic classifier — with a purged expanding window, a
shuffled-label null, and oracle/anti-oracle filter controls — the out-of-sample **Brier skill of
`P(rule's trade pays)` against the causal base rate is ≤ 0 for all three base rules**
(`sig-momentum`, `sig-acceleration`, `sig-reversal`) at both 1h and 15m (−0.0003…−0.0013; the only positive
is +0.002 at a single gradient iteration, and fitting more makes it worse). That is L06's pre-registered
falsifier, so **NL-BENCH's closure extends to the meta target.** The residual worth recording: pooled
**AUC ≈ 0.505–0.508** is a *detectable* rank signal at n ≈ 4–6×10⁵, but it is not calibrated and the
abstention overlay that exploits it can lift net@4 only by keeping **0.3–0.7 %** of bars (at 15m the trend
rules stay negative). So **L06 closed NEGATIVE**: re-labelling the learner does not give it a job, and the
only route left for the machinery (if any) runs through a *genuinely new feature family* (§E-C) — which
should be re-tested at the target with `e26#causalOos` before any architecture work.

### E-E — Execution realism as a first-class input. *(measured and CLOSED NEGATIVE in CYCLE-017)*

The reversal family is real and dies on taker cost (`2608.21888`; the project's P3 is PARK for exactly
this reason). CYCLE-016 (F-32) measured it properly: on the full history at **both 1h and 15m**, the
gross edge is genuinely there — a dollar-neutral cross-sectional reversal book sits **z = 5.5 / 12.1**
outside a 40-seed shuffle null, positive in both halves and causal — but its **break-even is 0.50 bps**
as a book and 0.32–1.31 bps across the per-stream arms, and **EWMA smoothing cannot lift it** (the F-25
pattern: the gross Sharpe decays in step with the turnover, unlike the F-24 carry dispersion). So the
maker-fill model (`TODO.md` 94) was the *only* remaining route to this family, with a quantitative bar:
a net execution cost **below ~0.3 bps** — an order of magnitude tighter than the 1–2 bps a partial
maker rebate would give.

CYCLE-017 (F-34) tested that route and it fails. A conservative passive-fill replay (`e25_maker_fill.js`:
a resting quote at the signal close fills only if the next bar *touches* it, unfilled exposure is
cancelled) takes the reversal book's gross Sharpe from **+0.415 (1h) / +0.534 (15m)** under a taker fill
to **−0.002 / −0.271** — the passive fill *removes the edge before any fee is charged*. The per-fill
friction is **−0.6…−1.6 bps** at every quote depth from 0 to 20 bps, and it is **identical when the trade
side is seeded-random**, so it is pure execution cost (adverse selection on the fills the book actually
gets), not a signal effect. OHLCV spread *estimators* are unusable at these horizons (Corwin–Schultz
33.4/13.3 bps, Roll 23.3/9.2 bps), so the friction has to be measured, not estimated. **Conclusion:
execution realism is not the rescue for the reversal family — it is the final nail.** What remains is a
*data* requirement (L2 book depth / queue position), and even the unachievable `oracle` replay's
break-even (67.9 bps at 1h) bounds how much any fill model could have helped. The generalisable lesson,
added to the standing method: **a passive fill is a selection of your own signals, so it must be tested
with a random-side control, not assumed.**

---

## 5. Standing lab principles

1. **Controls first.** No negative result is reported without the oracle/random controls of F-11 being
   green in the same session, and no implausibly large Sharpe is believed (it was a bug once already).
2. **Out-of-sample or it did not happen.** Fitting a pattern and reporting its in-sample Sharpe is
   forbidden here; F-09 is the worked example.
3. **The repo's arithmetic, not the lab's.** Metrics, dependence, DSR and the signal pipeline all come
   from `analysis/*`; the lab only adds loading, alignment and combination.
4. **Bar labels are open times.** Any use of a candle close as "the price at time t" must go through
   `loadCloseLookup` (F-11's bug).
5. **A finding is a number, or it is a hypothesis.** `FINDINGS.md` separates them.
