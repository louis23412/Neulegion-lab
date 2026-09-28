# PROTOCOL — the lab's method

The lab is a *lead library*: a set of open questions, each measured the same way, each killed or
promoted by a number. This file is how that is done so a future iteration can continue cleanly.

## 1. Cycles

Work happens in **cycles**. A cycle is one closed unit: a goal, the hypotheses it tests, the code it
adds or changes, the measurements it makes, the ledger updates it triggers, and the explicit next
step. Each cycle gets a file `cycles/CYCLE-<NNN>.md`. A cycle that changes any number MUST:

1. regenerate or produce the result artefact under `results/`,
2. update the affected `leads/L*.md` (status line + evidence + log),
3. update `FINDINGS.md` if a finding was added, changed or falsified,
4. note in the cycle file what is now *false* that used to be believed.

Cycles are numbered, never reused, and never deleted. A later cycle may reverse an earlier one — it
says so and links back. `cycles/CYCLE-000.md` is the founding session (F-01…F-12).

## 2. Leads

A lead is a *line of research*, not a finding. It has a file `leads/L<NN>-<slug>.md`:

```
# L<NN> — <title>

**Status:** OPEN | SUPPORTED | NEGATIVE | PARKED | ONGOING
**Opened:** CYCLE-000
**Last updated:** CYCLE-000
**Owner experiments:** e0b_window_sweep.js, ...
**Prototypes:** prototypes/signals.js#xsMomentum | (none)
**Result artefacts:** results/e0b_window_sweep_1h.json
**Fold-back rows:** R1, R2 (or —)
**Falsifier:** the measurement that would kill this lead

## Claim              — one paragraph, falsifiable
## Why we care        — the mechanism and why it could matter
## Evidence           — the numbers (tables), each with its experiment + artefact
## Verdict            — what the evidence says right now
## Next actions       — the smallest next step, in order
## Log                — one line per cycle that touched this lead
```

Statuses: **OPEN** (untested or in progress), **SUPPORTED** (measured, outcome positive / tool
works), **NEGATIVE** (measured, ruled out), **PARKED** (measured, not actioned, documented so it is
not re-derived), **ONGOING** (a standing audit that never "closes", e.g. bug-hunting), and
**COST-FRAGILE** (CYCLE-008: the measurement is sound but the *trade* dies at a realistic fee — the
number is kept as a signal of record, and any fold-back row is gated until a low-turnover construction
exists; see F-23).

`leads/INDEX.md` is the board: id, title, status, owner experiment, key result, fold-back row, next
action. It is the first thing to read and the first thing to update.

## 3. Evidence rules (non-negotiable)

1. **Controls first.** No negative is believed without the F-11 controls green in the same session,
   and no implausibly large Sharpe is believed — it was a bug once already.
2. **Out-of-sample or it did not happen.** Fitting a pattern and reporting its in-sample number is
   forbidden (F-09 is the worked example).
3. **The repo's arithmetic, not the lab's.** Metrics, dependence, DSR, the signal pipeline and the
   labels come from `analysis/*`. The lab adds loading, alignment, construction and combination.
4. **Bar labels are open times.** Any use of a candle close as "the price at t" goes through
   `loadCloseLookup` (the F-11 look-ahead).
5. **A finding is a number; a lead is a question.** `FINDINGS.md` holds the former, `leads/` the
   latter; never blur them.
6. **Every lead names its falsifier** before it is run, so a null is informative.
7. **Two data sources joined is two bugs until a test says otherwise.** Every join (funding ↔ candles,
   marks ↔ candles, external data ↔ the repo grid) gets a regression test in
   `experiments/e14_data_integrity.js`. The F-18 family was four silent join bugs, each of which moved
   the headline number; a red `e14` invalidates every basis-marked result in the same regeneration.
8. **Report the outlier-robust design effect alongside the raw one.** `serialDesignEffect` jackknifes
   the Sharpe, so on a fat-tailed series one observation can inflate it ~10× (F-20). Quote both, plus a
   block-bootstrap CI, and treat a large gap between them as "fat tail", not "persistence".
9. **A placebo is a distribution, not a draw.** One realised permutation Sharpe can be ±1 by chance;
   report the null distribution across seeds and the real book's position in it.
10. **A grid max is not a plateau.** Any construction, cadence or parameter chosen as the best of a coarse
   grid must be re-checked on a **fine** grid *and* against its immediate neighbours before it is called
   robust — F-55 showed a five-point split ladder can hide a boundary, and F-56→F-57 showed a "hold-6 +
   0.10" gain that a fine grid reveals as an isolated spike (positiveEveryYear on one N is not a plateau).
   Symmetrically, **validate a metric's conservatism, do not assume it**: a measure that omits a state the
   policy actually has (e.g. `Σ|Δw|` turnover for a hold policy, which ignores inter-rebalance drift) must be
   checked by a simulation — F-57 found the drift correction negligible, but only a test could show that.

## 4. Prototypes

Candidate code the repo does not have lives under `prototypes/`. A prototype is:

* **pure** — reads only what it is given, no I/O;
* **point-in-time** — `fn(series, t, opts)` may read indices `<= t` only (the causal contract);
* **owned by a lead** — the lead file lists it under *Prototypes*; if it is shared, it is listed by
  every lead that uses it;
* **promoted by port, never by copy** — if it graduates, `FOLD-BACK.md` defines the port, and the
  lab copy stays as the reference implementation and its evidence.

## 5. Bug-hunting / challeng­ing claims (L10)

The lab treats the repo's *claims* and its *code* as separate things to audit. Protocol:

* a suspected defect gets a line in `L10` with: the claim, the exact file:line, the counter-example
  or the measurement that would confirm it, and the status;
* if confirmed, it becomes an `F-<n>` (or an erratum to one) and, if it touches shipped behaviour, a
  `FOLD-BACK.md` row;
* a confirmed bug is **fixed and pinned**: the fix goes in the smallest shared place (never a copy),
  and a check goes into `experiments/e14_data_integrity.js` so it cannot regress. `e14` runs on every
  `run_all` and reports `pass`;
* `e0c_validate_pipeline.js` (lab scoring vs repo pipeline) and `e5_controls.js` (oracle / random)
  are re-run in any cycle that makes a bug claim — a bug claim is itself a claim and needs controls;
* **audit the guard a comment promises, with a synthetic ground truth (F-61).** A doc comment that says a
  function "handles X" (e.g. `carryOnBarGrid` "divides by the period actually observed") is a *claim about
  code*. When the shipped data cannot exercise the case — SOLUSDT's sub-8h funding is 1.5 % of one file —
  build the case synthetically with a **known correct answer** and assert the function reproduces it. This is
  the only class of test that catches a defect which **fails safe** (it *improves* the headline number, so no
  "implausibly large" alarm fires): F-61's sub-8h projection makes the carry sleeve look *better*. A repo-side
  defect that the lab cannot fix gets a **lab-side invariant** in `e14` plus a **repo-side audit experiment**
  (its `pass` fails loudly if the repo later fixes it);
* **audit a statistic the lab *uses* with a closed form + an ensemble (F-62).** A number the lab reports
  through (a design effect, a p-value, an effective sample size) is itself auditable: construct inputs whose
  answer is known from theory, run the statistic, and compare with a **seeded ensemble and a standard-error
  band** — one realisation of a noisy statistic is not a measurement (F-57). `e54_dependence_audit.js` is
  the template: the estimator is unbiased (matches `1+(K−1)ρ`, `K`, `1+ρ` and the i.i.d. null within 2.5 SE)
  but low-precision, and its `effectiveBars` transform is unbounded. Distinguish a **defect** (moves a
  shipped number — gets a fold-back) from a **calibration limit** (does not — gets documented), and never
  quote a noisy statistic to more precision than the ensemble shows it has.
* **a claim of "no leakage" is audited with a closed-form overlap count (F-63).** When a module promises a
  *contract* (purge / embargo / causality), test the contract directly: a fold leaks iff some training
  label window overlaps some test label window, i.e. `0 < j−i ≤ H−1` — an exact count, no randomness
  needed. `e55_split_audit.js` shows a *family* can split: two members purge correctly and the third (the
  one the shipping path uses) does not, and its index-order causality guard cannot see it. **Also audit the
  test ledger's own claim** — a note saying "proved: zero leakage" is a claim; read which functions its
  assertions actually cover (L10-ag / the L10-t lesson).
* **an exported primitive is not a shipped one — verify the caller before calling a wart live (F-64).**
  `analysis/labels.js` is correct on its stated contracts (first-touch `ceil(level/step)`, the binomial
  weight recurrence, the CUSUM reset rule, the NaN warm-up) yet carries five warts — a tie-break that is
  unreachable for `vol > 0` and degenerate at `vol ≤ 0`, a default event set that emits a zero-horizon bet,
  an argument the function never reads, a guard that can never fire, and a docstring the code contradicts.
* **a quoted calibration figure is a draw; a split count is not the number of independent bets (F-65).**
  `analysis/overfitting.js`'s PBO is structurally exact and its published calibration reproduces to the
  split (117/252), but the same estimator has a 0.25-wide distribution across i.i.d. matrices while its
  binomial split SE is only 0.03 — a split design effect of **65.4**, i.e. **≈4 effective splits**. Measure
  the estimator's own spread (F-62's closed-form + ensemble + 2.5-SE band) before quoting a statistic to
  2–3 decimals, and never read `C(S, S/2)` splits as that many independent observations. Trace the importer
  (`overfitting.js` has none on the shipped path) before calling a wart live — this row's five are latent.
  All of them are **latent** because the A/B reaches the module through exactly **one** export
  (`fractionalDiffWeights`, via `features.js`). So: trace the import sites (grep the export names), and
  separate **contract validation** from **wart enumeration** from **scope** in the write-up. Also read a
  returned field as the code defines it — `ret` is a **realised price change**, not the barrier magnitude
  (the touch bar overshoots the level on a gap).
* **a comment claiming a reference match is a claim — port the reference and diff it (F-66).**
  `analysis/reality_check.js`'s block-length selector says it reproduces `arch.optimal_block_length` "to
  floating-point precision", and it does where its `g > 0` guard does not fire (the arch AR(1) vector
  reproduces from an independently implemented NumPy stream). But it returns exactly 0 whenever `g ≤ 0`
  where the reference squares `g`, so `autoBlockLength` silently floors to **1 (i.i.d.)** on 99/100
  mean-reverting series — the automatic block bootstrap degrades to i.i.d. on the streams that need it
  most. When a module names a reference implementation, vendor that reference and diff it. Related: a guard
  with no reachable failing input (the `neweyWestSE` `v < 0` clamp — the Bartlett estimator is a PSD
  quadratic form) is documentation, not protection; and **gate every validation suite explicitly** — a
  suite step whose `pass` is `undefined` is reported but not gating (this cycle found `e56`/`e57` had been
  ungated for two cycles because they never exposed `verdict.validationPass`).
* **a docstring's stated identity is a claim — and a paired test must show the paired units align (F-67).**
  `analysis/forecast.js`'s comment says the raw-minus-binned Brier gap *"is the within-bin **forecast**
  variance that merging into a bin discards"*. It is not: the exact identity (which the repo's own
  `observer/legion_metrics.js` states and computes) is `gap = withinVar − 2·withinCov`, and the gap is
  negative on 5/6 audited configs while `withinVar` is positive. Likewise `forecastComparison`'s comment
  says it *"refuse[s] rather than silently compar[ing] mismatched windows"*, but the guard compares bar
  **counts**, so two variants dropping the same *number* of bars at *different* positions are paired
  index-wise and the DM verdict flipped in 6/6 witnesses. **Write the identity out and diff it against the
  arithmetic; and for a paired test, check the identity of the paired units, not their number.** Related:
  a branch the driver cannot reach (`groupOf`'s `benchmark`→baseline-kind mapping) is still a claim about
  the exported API — and an untested one; and a denominator that deviates from the cited method
  (the MCS elimination's `sd(L_i)` vs HLN's `sd(d_i)`, up to 77× apart) must be measured for effect
  before it is called a defect (here: 0/150).
* **a validation whose fixture cannot distinguish the claim from its negation is not a validation (F-68).**
  `analysis/race.js` states the correctness requirement *"the race winner equals the full-grid oracle, so a
  racing budget does not change the decided set"*, and §AM "validates" it with a fixture whose scoring
  order is **budget-independent** (`rank(budget=1) == rank(budget=9)`) — so the agreement is a tautology —
  and whose race top rung (3) is **below** the oracle's budget (9), a budget the race never visits. Add a
  budget-**dependent** evaluator (the SHA premise: a cheap rung is noisy) and the race discards the
  top-budget best on 0.62–0.70 of seeded fixtures. Related, same module: the "cost is `O(arms)` at the
  cheapest rung" framing fails in the small-ratio regime (`spentBudget > gridBudget`, up to **2.89×**), a
  small `eta` makes the integer rounding repeat rungs (**15 of 25** at `eta = 1.1`), and `eta`/`minBudget`
  are unvalidated (`available:true` with a `null` winner and zero evaluations). **Before trusting a
  "validated against an oracle" claim, check (a) that the fixture can fail and (b) that the oracle's
  operating point is one the method actually reaches.**
* **a regression's stored mean is part of its prediction, and a bounded output map is part of the score
  (F-69).** `analysis/benchmark.js` is the shipped P1 model-class benchmark; its `fitRidge` computes the
  training base rate `ybar`, centres the target on it, and `predictRidge` never restores it, so the arm's
  probability is anchored at 0.5 (a constant-`y` fold reads exactly 0.5; a 0.833-base-rate fold reads a mean
  of 0.50, Brier 0.22475 vs 0.13533 with the term restored) — and the shipped test checks accuracy only (a
  0.5 threshold, invariant), so it cannot fail. Separately, the sigmoid of a least-squares fit of a bounded
  [0,1] label confines the output to `sigmoid([−1,1])`, so a perfect feature reads a Brier floor of 0.1425,
  not ~0. **If you centre the target, restore the mean before predicting; and before comparing two
  probability models on a proper score, check each output map can reach the values the score rewards.**
* **a statistic's docstring is a claim about the criterion the code applies (F-70).** The measurement layer
  (`analysis/backtest.js` + its instrument `analysis/performance.js`) is exact to its documented bounds
  (`erf` within 1.393e-7 of a Simpson quadrature; `normalCdf(0) = 0.5` exactly; `normalInvCdf` round-tripping
  2.46e-10 against a Lentz-erfc reference; PSR exactly 0.5 at its benchmark; DSR = PSR at the hurdle to 1e-15;
  MinTRL 13.1749455166 vs the documented 13.174945; the bootstrap calibrated at 5.9 %/11.0 % on 1000 noise
  series). But `hitRate(strategyReturnSeries)` receives **only returns**, so its "bars with no position are
  excluded" is unimplementable: the code skips `r === 0`, and because `backtestMetrics` passes the **net**
  series, an exit-cost flat bar counts as a **miss** — a perfectly-timed 3-round-trip book reads 0.5. And
  `scoreFold` re-lags the signal **inside** the test slice, so a global fixed series is shifted at every fold
  boundary (on a CPCV fold the bar after a run gap holds the previous *test* bar's signal). **Read the
  criterion the code applies, not the one it names; and when a series is global, check what slicing it does
  to a lag.** *(Same cycle, a probe lead was disproved rather than confirmed: the "negative MinTRL" defect is
  impossible for measured moments — Pearson's inequality `kurt ≥ skew² + 1` forces
  `v ≥ (1 − skew·SR/2)² ≥ 0`.)*
* **a guard against zero dispersion must test the dispersion, not a computed `std` (F-71).** The causal signal
  family (`analysis/features.js`) is exact on its contracts — for all 16 candidates a strict-future
  perturbation leaves `positionAt` bit-unchanged, the abstain contract holds, and 13 single-feature references
  match independent recomputes to 1e-12 (`fracDiffAt` also equals the shipped `fractionalDiff` convolution).
  But its `if (!(std > 0)) return 0` abstain is unreachable for an exactly-constant window: the sample mean is
  **not bit-equal** to the value, so the computed `std` is a **denormal positive** and the feature reads
  `|z| = sqrt((n−1)/n)` (a 0.468–0.492 position at saturation 2) instead of 0 — a rounding-boundary effect, so
  the shipped test gives no warning. The same module shows an empty range returning **0** from `finiteSum`
  where `meanOf` returns NaN, a self-skip (`i === panel.streamIndex`) that silently fails when the field is
  absent, and a `-gateZ` crash gate scaled by the wrong window variance. **Pin degenerate-input arithmetic as
  an exact identity (an exactly-constant window yields `|z| = sqrt((n−1)/n)`); make every helper abstain on an
  empty range; and scale a documented `-N sigma` gate by the window it gates.** *(Same cycle settled L10-e: the
  plural `closes` field is load-bearing — a singular `{close}` series abstains.)*
* **a function that names a weight must compute that weight, and a cited reference must be the algorithm (F-72).**
  `analysis/uniqueness.js` (the López de Prado ch.4 reference) is exact on its headline quantity —
  `sampleUniqueness` matches an independent per-bar recompute to 1e-12 and the shipped `overlapUniqueness` to
  **0**, and the ESS identities hold. But `sequentialBootstrap` stores the uniqueness **sum** (`avgU[i] = acc`)
  where its comment and ch.4 specify the **average**, so the draw is biased toward long labels (two
  non-overlapping, maximally-unique labels are drawn 0.75/0.25 instead of 0.5/0.5); and the implemented
  heuristic (static numerator, `1/(1+count)` conditioning) is not the cited AFML ch.4 bootstrap, which
  reweights each candidate by its average uniqueness against the current selection (second-draw TV gap
  **0.1190**). **Check the weight the code computes, not the word it uses for it — a constant rescales a
  distribution only when it rescales every item equally, and here the scale is the span length; and make a
  test assert the *law*, not just length/determinism/range.**
* **an aggregate that skips an item must skip it from the count too (F-73).** `analysis/streams.js` (the shipped
  stream design layer) is exact on its identities, but `designEffectOfStreams` measures `rbar` over the pairs it
  CAN correlate and then divides `K` — including any stream that could not be correlated at all. A zero-variance
  (constant) stream therefore leaves `rbar` bit-identical while buying a full unit of "effective breadth"
  (effectiveStreams 2.0270 -> 3.0821, rawBars 480 -> 720) — and `selectStreams`, which refuses an uncorrelatable
  candidate, disagrees with it. The same module treats `maxStreams <= 0` as **unlimited** rather than none.
  **Keep the denominator and the numerator over the same units; and check what an API limit of 0 means.**
* **an audit that reaches every input is the whole point — and a boundary value must mean what it says (F-74).**
  `analysis/world.js` exists to close a vacuity trap (a returns-only perturbation left the candle-driven
  model's input untouched, so its look-ahead audit could not fail), and it is exact on its contract. Yet
  `panelFor` replaces the panel's own-stream slot only when `panel.streamIndex` matches an index: with
  `streamIndex` absent, a cross-sectional candidate reads its UNPERTURBED own series and the audit is vacuous
  again (same root cause as L10-bu, opposite consequence). And `worldFromCandles`' `maxBars` guard reads 0 as
  "all bars" and a negative value as "drop the first |maxBars|" (`slice(-maxBars)`). **When you build a
  perturbation harness, test the inputs it fails to perturb; and make a guard decide what its boundary value
  means (0 is a count, not "disabled").**
* **validate every argument a normaliser takes, and make a validator reject the whole reply class (F-75).**
  `analysis/parallel.js` is exact on its queue contract — unit order, exactly-once exec, the in-flight bound,
  first-error abort with no dangling promise — but `normaliseConcurrency` validates only the value and uses its
  `max` cap raw, so `{max: 0}` returns **0**, `{max: -2}` returns **-2** and `{max: 2.5}` returns **2.5**; and
  `makeFoldExecutor` throws on a malformed `positions` but **silently nulls** a non-array `confidence` and any
  falsy `stats`. **A silent null is a decision, not a rejection — half-validated inputs are the ones that fail
  quietly later.**
* **forward an option all the way to the function that consumes it — and remember `Object.freeze` is shallow
  (F-76).** `analysis/holding.js` is exact on its grid/ordering/`byId` contract, but `turnoverSweep` accepts and
  **echoes** `costBps` and never passes it to `restateReportAtPolicy`, so every row's net Sharpe and every
  promotion decision is at **zero cost** (two sweeps at different costs are byte-identical apart from the
  label); the `requireCleanAudit` hurdle its caller passes is **structurally inapplicable** because the
  restatement drops the `audit` block; and `DEFAULT_TURNOVER_GRID` is only **shallowly** frozen, so a push onto
  its `deadZones` changes every later default sweep. **An option that is read and never used is a dead argument
  wearing a live one's clothes; and a frozen container still hands out mutable contents.**
* **check the rule a cited estimator uses, and read a formatter's label off the object it formats (F-77).**
  `analysis/replication.js` is exact on its IQM contract, but its "interquartile mean (Agarwal et al. 2021)" drops
  `floor(n/4)` **by rank**, not a quarter of the **mass** — witness `[0,0,5,10]` reads **2.5** vs the reference
  **1.6667**, and **149/300** right-skewed panels differ. And `formatSeedReplication` prints its **own** `alpha`
  in the CI label rather than `dist.ci.alpha`, so a 10 % interval can be labelled `95%CI`. **An estimator is not
  the reference whose name it borrows; and a label must be read off the object, not off a default.**
* **make a boolean flag evaluate every clause of the rule it advertises, and enforce an algorithm's safe numeric
  range (F-78).** `analysis/dependence.js` is exact on its correlations, jackknife, Student-t tails and binomial
  sign test, but `clusterStability.stable` checks only `fractionPositive >= minFraction` and **never** the
  `worstDelta > minDelta` its docstring requires — with `minFraction = 0.5` a candidate whose edge collapses on
  its worst window (`worstDelta = −0.5`) still reads `stable: true`; and `signTest`'s `pmf0 = 0.5ⁿ` underflows for
  `n ≥ ~1075`, so any 2 000-cluster test reads `pValue = 0`. **An AND'd condition silently dropped is a weaker
  gate than the doc describes; and "small enough in practice" is not a bound.**
* **keep every readout of a restatement on one position basis (F-79).** `analysis/decision.js` is exact on its
  concentration / persistence / power / promotion / six-block contract, but `restateReportAtPolicy` replaces
  `folds` with metrics rebuilt from the **restated positions** while carrying the original `foldInputs` — and
  `foldConcentration` reads its gross half from `folds` and its Sharpe half from `foldInputs.signals`, so a
  policy-restated report yields a block whose two halves describe two different position series (restated net
  Sharpe **−5.201698358740081** vs the carried-signal Sharpe **−3.5204429235768973**). The shipped `--decision`
  path restates at **cost** only (`restateReportAtCost`, same signals), where both halves agree
  (**−3.877740023296727**), so it is latent. **When a function's readouts come from different inputs, verify they
  share a basis; a restatement that rebuilds one input must rebuild (or consistently leave) the other.**
* **check what a non-finite guard does to the TOP of an activation's range, and never let a `|| 1` fallback
  rewrite a real zero (F-80).** The hivemind's kernel bags are exact on the finite path, but
  `hivemind/kernels/activations.js#_sigmoid`/`#_silu` are `isFiniteNumber(x) ? <math> : 0`, which runs before the
  internal `Math.min(Math.max(x, −100), 100)` clamp — so `_sigmoid(+∞) = 0` (limit 1) and `_silu(+∞) = 0` (limit
  +∞), a maximally-positive logit reading as probability 0; and `statistics.js#_computeGradientNorm`/
  `#_computeSpectralNorm` (`Math.sqrt(sum) || 1`, `Math.abs(norm) || 1`) and `#_computePercentile`
  (`sorted[index] || 1.0`) turn a legitimate **0** into **1**, feeding the `gradients.js` threshold pool a dead
  gradient as 1. **A guard that maps "invalid" to 0 must ask what 0 means at the top of the range too, and a
  result-level `|| 1` should be a divisor-level guard instead.**
* **the direction of a bug's error is not a defence.** The F-18 bugs made the carry sleeve look
  *worse*, so the F-11 "implausibly large Sharpe" alarm could not have caught them. Only a positive
  invariant (a test) catches a bug that fails safe.

## 6. What never happens here

* Editing the repo, its data, its docs, or its goldens.
* Reporting a number without the experiment that produces it.
* Reporting an in-sample fit as evidence.
* Silently changing a lead's status: every status change has a cycle file and a log line.
* Using `scratch/` as storage for anything a future iteration needs.
