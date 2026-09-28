# CYCLE-055 — The causal signal family: the zero-dispersion guard is defeated by floating-point rounding, an empty window reads 0, and two cross-sectional/gated features silently mis-scale (L10-bs…L10-bv; L10-e settled)

**Date:** 2028-06-06
**Goal:** `analysis/features.js` is the **causal signal family** — the module that turns a panel of prices /
returns / volumes into the position each arm would hold at bar `t`. Every strategy the project has ever
evaluated is a weighted combination of the 16 candidates this file exports, and the promotion gate reads their
positions. It is the one pure module the lab consumes everywhere and had never audited by synthetic ground
truth. It also carries the open **L10-e** row (the `closes` contract). This cycle is that module's turn.

## Work

New experiment `experiments/e63_features_audit.js` (registered; **71 steps, 40 gated, 0 fails**; 70 ms in the
suite; **11 checks, all pass**). No probe was needed — the module is small enough to register the witnesses and
the checks in one pass. The audit has three halves: the **causality contract** (the module's strongest claim,
that `positionAt` is causal), the **abstain contract** (the module's stated discipline: a feature that cannot be
computed returns NaN/0, it never throws and never manufactures a value), and the **arithmetic** of the 13
single-feature references plus the cross-section and the regime gate, each against an independent recompute.
Four findings followed, all latent/export-level, plus the closure of L10-e.

## Results

### A. The causality contract holds exactly, for every candidate (validated)

For all **16** candidates (8 `SIGNAL_CANDIDATES` + 4 `REVERSAL_CANDIDATES` + 4 `SIGUP_CANDIDATES`) and every
test bar `t`, perturbing **closes, returns, volumes and every panel stream strictly after `t`** leaves
`positionAt(candidate, series, t)` **bit-unchanged**:

| candidate | mismatches / 100 bars | later bars moved (of 79) | non-zero positions |
| --- | --- | --- | --- |
| all 16 | **0** | 77–79 | 100 / 100 |

and the test is **non-vacuous**: every candidate reads a non-zero position on all 100 bars (so "causal" is not
"zero"), and the perturbation genuinely moves 77–79 of the 79 later bars for each. `causalityNonVacuous` is
empty. This is the module's headline promise and it is upheld exactly.

### B. The abstain contract holds, and the `closes` contract settles L10-e (validated)

* **returns-only view** (no `closes`, no `panel`): exactly the five channel-dependent candidates —
  `sig-frac-momentum, sig-range, sig-volume, sig-reversal-xs, sig-network-momentum` — read **0** on every bar
  (`abstainNeedOtherChannel`); the other 11 keep their channel free.
* **short / empty / `null` series** → all 16 read 0 (no throw). **All-NaN, all-zero and Infinity** series stay
  finite and in [−1, 1].
* **L10-e (the `closes` contract) — SETTLED.** A series supplied as `{close}` (singular, no `closes` array)
  gives `rangeLocation` **NaN** and `positionAt` **0**, and `fracMomentum` **NaN**; a `{closes}` series gives
  `rangeLocation = 0.021162522509665216`. The plural field is load-bearing and the singular is a genuine
  abstain, exactly as the row suspected — closed as a **confirmed** contract, not a defect.

### C. The z-score pipeline is exact and its named guards fire (validated)

`the z-score pipeline reproduces a hand recompute` over the trailing finite values with the sample std
(`zScoreHandCheck`: raw 0.012283236, n 6, mean −0.000537523, sd 0.007692899 → z 1.666570548, position
0.833285274) and the three abstains fire: not-yet-populated window, `minObs` too high, non-finite raw.
`clampPosition` is exact (bounds ±1, non-finite → 0, saturation ≤ 0 → 0; `DEFAULT_POSITION =
{saturation: 2, zWindow: 32, minObs: 8}`).

All **13** single-feature references are exact to **1e-12** — `momentum, fracDiffAt, fracMomentum, volRegime,
momentumAgreement, rangeLocation, volumeImbalance, autocorr1, acceleration, reversal, reversalWindow,
reversalVol, volScaledMomentum, blendedMomentum` — and `fracDiffAt` also equals the **shipped**
`labels.js#fractionalDiff(log closes, 0.4, 16)` convolution on the same series (my independent binomial-weight
recursion matches `fractionalDiffWeights(0.4,16)` to 1e-15). The cross-section references
(`gotXs = xsRef = −0.006612810877`, `gotNet = netRef = −0.9066812992`) and the regime gate at `t = 80/110/130`
(`got = ref` at each) are exact.

### D. The zero-dispersion guard is defeated by floating-point rounding (L10-bs)

`causalZScore` returns `(raw − m)/std`, with `m` and `std` computed over the trailing finite values in the
window. Its guard is `if (!(std > 0)) return 0`, and the module header / docstring both promise the position is
**0 while `std` is 0**. For an exactly-constant window the sample mean is **not bit-equal** to the value `v`, so
every deviation is the same `d = m − v ≠ 0`:

```
acc = n·d² ;  std = |d|·sqrt(n/(n−1))   (a denormal positive number, so the guard cannot fire)
z = (v − m)/std = −sign(d)·sqrt((n−1)/n)
```

| constant value | window n | `std > 0`? | returned z | \|z\| closed form |
| --- | --- | --- | --- | --- |
| 0.001 | 8 | fires | **0** | — |
| 0.001 | 16 | no | **−0.9682458366** | −√(15/16) = 0.9682458366 |
| 0.001 | 32 | fires | **0** | — |
| 0.1 | 16 | no | **−0.9682458366** | −√(15/16) |
| 0.1 | 32 | no | **−0.9842509843** | −√(31/32) = 0.9842509843 |
| 0.07 | 20 | no | **−0.9746794345** | −√(19/20) = 0.9746794345 |

At the default saturation 2 that spurious `|z| = 0.935…0.984` is a position of **0.468 … 0.492** — nearly a
half-size book — from a feature carrying **no information** (the intended value is exactly 0, the largest
possible error on this branch). It is a **rounding-boundary effect**, not a universally-firing branch: where the
sum/quotient happens to be exact (n = 8 and n = 32 on a 0.001 constant; the 0.03125 fixture) the guard *does*
fire and returns 0, so the shipped 0.03125 check passes. Real-valued features (frac-momentum, range location,
vol-regime, volume imbalance, autocorrelation, and the recomputed momentum of a bit-constant return series) can
all trip it; discrete `momentumAgreement` cannot (its mean is exact). LATENT for live data (a bit-constant
window is measure-zero there), but **reachable on the flat/constant series this project uses as CONTROLS**, and
in production through a coarse/rounded price feed — the L10-l class (prices stored as `round(price*100)` gave
67 distinct values over 3621 bars, i.e. long runs of exactly-equal returns). A relative tolerance
(`std <= |mean|*1e-12`) or a `max − min == 0` test would fix it. Recorded as a **closed-form identity** — the
check pins the *actual* arithmetic (an exactly-constant window yields `|z| = sqrt((n−1)/n)`), and the "why it's
wrong" is in `findings` — never a red check (the e62 method).

### E. An empty window reads 0 from `finiteSum`, but NaN from `meanOf` (L10-bt)

`finiteSum` guards `a < 0` but **not** `b < a`, so an empty range sums to **0**, whereas `meanOf` guards
`b < a` and returns **NaN**:

| call | reads |
| --- | --- |
| `momentum(series, t, {window: 0})` | **0** |
| `acceleration(series, t, {window: 0})` | **0** |
| `meanOf(series, 0, −1)` | NaN |
| `volRegime(…, {window: 0, long: 0})` | NaN |
| `reversalWindow(…, {window: 0})` | NaN |
| `volumeImbalance(…, {window: 0})` | NaN |

A 0-width window therefore reads a valid-looking **0** ("no momentum") from every `finiteSum`-based feature
(momentum, acceleration, and the vol-scaled / blended / network / gated upgrades via their sums) while every
`meanOf`-based feature abstains. LATENT: every shipped candidate fixes `window ≥ 1`, so the empty range is
reachable only through the exported API (a custom candidate or a direct call). It matters because 0 is a
**finite, plausible** reading, so it flows through `causalZScore` as a real observation instead of abstaining —
the opposite of the module header's "a feature … abstains" discipline, and an inconsistency between two helpers
in the same file.

### F. `networkMomentum` folds the stream's own momentum into the "network" average (L10-bu)

The skip is `if (i === p.streamIndex) continue`. With `panel.streamIndex` **absent** (`undefined`) the
comparison is never true, so the feature silently includes the stream's own lagged momentum:

| panel | `networkMomentum` |
| --- | --- |
| `{streamIndex: 1}` (shipped path) | **−0.9066812992** = others-only |
| `{…}` with no `streamIndex` | **−1.8820447956** = all three incl. self |

(`equalsOthers` and `equalsAllThree` both true; the stream's own lagged momentum is −3.8327717886.) LATENT:
`analyze.js` always sets `streamIndex`, so the shipped path is correct; the exported API is not, and the failure
mode is **silent** — a plausible number, not a NaN.

### G. `regimeGatedMomentum`'s gate is scaled by the wrong window (L10-bv)

The gate compares `sum(returns, gateWindow)` against `−gateZ·sqrt(v_window)·sqrt(gateWindow)`, where
`v_window` is the **momentum** window's variance, not the gate window's. Under the i.i.d. reading the sum over
the gate window has variance `gateWindow·v_gateWindow`, so the threshold is mis-scaled by
`sqrt(v_window / v_gateWindow)`:

| quantity | value |
| --- | --- |
| `momentumWindow` / `gateWindow` | 16 / 32 |
| `varianceUsed` (v of window 16) | 5.080932663e-5 |
| `varianceOfGateWindow` (v of window 32) | 6.651902004e-5 |
| ratio `sqrt(vGate/vM)` | **1.309189168** |
| `thresholdUsed` | **−0.0806448623** |
| `thresholdIfGateWindowScaled` | **−0.0922736938** |

With the shipped windows (16 vs 32) a hot short-term regime (`vGate > vMomentum`) makes the crash gate too
**loose** — it fires less often than the documented "−`gateZ` standard deviations of its own causal vol
estimate". LATENT and opt-in (`SIGUP_CANDIDATES`, gate G-H); invisible when the two windows coincide. Recorded
because the feature is pre-registered as a *causal crash gate*, so a mis-scaled threshold changes how often the
arm de-risks — a behavioural, not cosmetic, difference.

### H. Scope

`features.js` is **shipped** signal code — every arm's position comes from it, and it is imported by
`analyze`/`walkforward`/`decision`/`forecast`/`backtest`. None of the four findings can move a golden: all four
are latent (they need a degenerate window, a missing `streamIndex`, or the opt-in `SIGUP_CANDIDATES`). The
causality contract and all arithmetic the shipped path executes are **validated exact**. `no fold-back row`.

## What is now false that used to be believed

* **"`causalZScore` abstains (returns 0) when the window has no dispersion."** It abstains only when the
  computed `std` is not `> 0`; for an exactly-constant window the sample mean is not bit-equal to the value, so
  `std` is a **denormal positive** number and the guard cannot fire. The returned `|z| = sqrt((n−1)/n)` — a
  nearly half-size position (~0.47–0.49 at saturation 2) from a feature carrying no information. Where the
  arithmetic happens to be exact the guard *does* fire, so the shipped 0.03125 test passes and gives no warning.
* **"A feature that cannot be computed abstains."** `finiteSum` on an empty range returns **0**, not NaN — so
  momentum and acceleration read a finite, plausible "0" for a 0-width window while the `meanOf`-based features
  abstain. The two helpers disagree on the same degenerate input.
* **"`networkMomentum` excludes this stream from the network average."** It excludes it only when
  `panel.streamIndex` is set; if it is `undefined` the comparison never matches and the stream's own lagged
  momentum is folded in silently.
* **"The `-gateZ` crash gate is −`gateZ` standard deviations of the gate window's own vol."** The threshold is
  scaled by the **momentum** window's variance; when the two windows differ (shipped: 16 vs 32) the gate is
  mis-scaled by `sqrt(v_window/v_gateWindow)` (1.309 here) and fires too rarely in a hot short-term regime.

## Ledger effects

* **F-71** is added: `features.js` is **validated** against independent references (11/11 checks — the
  causality contract for all 16 candidates, the abstain contract, and 13 single-feature references + the
  cross-section + the regime gate) with four registered rows — **L10-bs** (the spurious `|z| = sqrt((n−1)/n)`
  on a constant window; closed form pinned), **L10-bt** (`finiteSum`'s empty range = 0 vs `meanOf`'s NaN),
  **L10-bu** (`networkMomentum` self-inclusion when `streamIndex` is absent) and **L10-bv** (the regime gate's
  window mis-scale). All four are latent/export-level; no fold-back row. **L10-e** (the feature `closes`
  contract) is **SETTLED** as a confirmed abstain on the singular field.
* `e63_features_audit.js` is the register's **tenth synthetic-ground-truth experiment on a repo module**
  (after `e53`…`e62`). `run_all` is now **71 steps, 40 gated, 0 fails** (`RUN_SUMMARY` at
  **2026-09-27T07:34:57Z**).

## Next

* Remaining L10 rows: **L10-h** (golden movement for any R1–R9 port), **L10-ad** (the carry attribution lag),
  **L10-ae** (`effectiveBars` unbounded). (L10-e is now closed.)
* Then the remaining pure modules the lab consumes but has not yet audited by synthetic ground truth:
  **`holding.js`**, **`uniqueness.js`** and the **`streams.js`/`world.js`** data layer
  (`decision.js`, `parallel.js`, `replication.js`, `dependence.js` are candidates after that).

## Run

No repo file is touched. Full regeneration: `run_all` → **71 steps, 40 gated, 0 fails**, `RUN_SUMMARY` at
**2026-09-27T07:34:57Z** (`e63` 70 ms; `e62` 4.39 s; `e0d` remains the slowest step; total **692 s** this run).
