# Lab index — the top-level map

Everything in the lab, and where to start.

## Start here

* **`STATUS.md`** — 30-second orientation: counts, entry points, open frontier, gate status. Read this first.
* **`README.md`** — what the lab is, ground rules, layout, status.
* **`leads/INDEX.md`** — the board: 19 leads, statuses, results, fold-back rows. **The entry point.**
* **`FINDINGS.md`** — the measured ledger F-01…F-162 (what is *true*, with numbers).
* **`THEORY.md`** — the system model and the ranked frontier J1–J6 (what to do about it).
* **`RUN-CROSSCHECK.md`** — the uploaded local run corpus (`src/runs/`) read against the ledger: what it confirms, the one new gate-coupling item, and the modules/LOCKED items worth unlocking.
* **`../NeuLegion-master/NeuLegion-master/docs/PLAN-round31.md`** — the project's next-step plan (the pivot: stop predicting, start allocating), built from this lab's evidence + the run corpus. The lab's `FOLD-BACK.md` queue carries its port priority.
* **`../NeuLegion-master/NeuLegion-master/docs/ARCHITECTURE-v2.md`** — the V2 blueprint (the operator's modularity question): old-vs-cutting-edge audit, the modularity scorecard, the contract/registry design, and the V2.0–V2.4 migration that folds into round 31.

## Documents

| file | what it holds | update when |
| --- | --- | --- |
| `README.md` | orientation, ground rules, layout, short status | layout or status changes |
| `RUNNER.md` | exact `execute_js` recipes; the `__fs` invariant; how to add an experiment | a run convention changes |
| `run_lab.mjs` | the local Node runner: `node src/NeuLegion-lab/run_lab.mjs <experiment.js>` (wires `__fs` to `node:fs`, exits non-zero on a failed verdict) | the runner contract changes |
| `PROTOCOL.md` | cycles, the lead template, statuses, evidence rules, bug-hunt protocol | the method changes |
| `INDEX.md` | this map | a file is added/removed |
| `STATUS.md` | 30-second orientation pointer (counts, frontier, gate) | every sweep refreshes it, or delete it if it disagrees with `leads/INDEX.md` |
| `THEORY.md` | system model, ranked weakest joints J1–J6, edge directions E-A…E-E | a joint is fixed or a direction closes |
| `FINDINGS.md` | F-01…F-162: hypothesis → experiment → number → verdict | any number is measured/changed/falsified |
| `FOLD-BACK.md` | the port contract + queue R1…R8 + the NOT-to-port list | a lead graduates or is ruled out |
| `PLAN.md` | the trackable next-step plan: findings D-01…D-07, decision log, sequenced steps S1–S5 with owners/gates/status — update it every iteration | a step changes state |
| `RUN-CROSSCHECK.md` | the project's 2026-09-26/27 local run corpus (`src/runs/`) read against F-01…F-80: confirms/refutes, the new funding-sleeve/paired-test coupling (proposed `L10-cs`), and the module/unlock list | a run corpus is supplied or a run-derived row is confirmed |
| `../NeuLegion-master/NeuLegion-master/docs/PLAN-round31.md` | the project's next-step plan (the pivot: structural sleeves + portfolio/risk + honest full-history scoring; the model demoted to a modular, default-off research layer) | the project's direction changes |
| `../NeuLegion-master/NeuLegion-master/docs/ARCHITECTURE-v2.md` | the V2 blueprint answering the operator's modularity question: the old-vs-cutting-edge component audit, a modularity scorecard for every subsystem, the contract/registry/per-plugin-golden design, and the V2.0–V2.4 strangler-fig migration (folds into round-31 W1–W6) | the architecture direction changes |
| `../NeuLegion-master/NeuLegion-master/docs/AUDIT-round31-v2.md` | the six-cycle red-team audit of `PLAN-round31.md` + `ARCHITECTURE-v2.md`: coherence contradictions C1–C12, the code-grounded friction/pollution map P1–P12/F1–F10/S1–S7, the testability matrix, five viewpoints, and the reconciled amendments A1–A18 | either plan changes |

## Leads (`leads/`)

19 leads, one file each. See `leads/INDEX.md` for the board. Grouped:

* **Measurement / method:** L01 (verdict window), L02 (panel dependence), L10 (bug audit), L14
  (mark vs traded price).
* **Sleeves:** L03 (carry), L09 (vol sizing), L11 (basis reversion), L12 (cross-sectional carry),
  L15 (capacity/impact), L16 (low-turnover dispersion), L17 (capacity-aware weighting).
* **New data:** L07 (OI/liquidations/taker), **L18 (toptrader positioning — first new-data signal, validated)**.
* **Closed families:** L04 (momentum upgrades), L05 (conditional/seasonal), L06 (meta-labelling — closed
  NEGATIVE in CYCLE-018: the meta-label target is not predictable enough to beat the rule's base rate),
  **L13 (reversal — closed NEGATIVE in CYCLE-016: real gross edge, break-even 0.3–1.3 bps, unsmoothable)**,
  **L08 (maker fills — closed NEGATIVE in CYCLE-017: a passive fill removes the edge before any fee; an
  L2/queue data requirement remains)**.
* **Open frontier:** none fully open — **L07** is partial (liquidation prints untested). CYCLE-019 (F-36)
  measured the two decay risks: **L12's net edge had decayed below the fee** (gross edge intact) and
  **L18's fade had not**. CYCLE-020 (F-37) then **recovered L12**: the decay was the EWMA(0.1) *policy*,
  not the sleeve — a slower policy (`ewma 0.01`, recent-24m break-even **27.07 bps**, net@4 **+3.86**) and
  a walk-forward λ-selection that reproduces it **out of sample** (+5.71 vs +2.76) make the dispersion
  sleeve net-tradable again. CYCLE-021 (F-38) then sized it: the retuned book is **OI-bound (LINK)**, not
  impact-bound, at **$19 M** (λ=0.01) / **~$36 M** (`ewma 0.02 + cap12.5 %`) vs the λ=0.1 spec's $13.2 M.
  CYCLE-022 (F-39) made R8 **port-ready** (a joint (λ, cap) walk-forward beats the pinned spec OOS, +6.13
  vs +2.76, and stays net-positive at a 10 bps fee), and CYCLE-023 (F-40) finalised the **fade**: the
  retune does not transfer (it is not cost-fragile) but the 12.5 % cap does (OI bound $37 M→$54 M).
  CYCLE-024 (F-41) then closed the two remaining items: it **restated every OI capacity as a distribution**
  (the published numbers are a *ratio of means*; the true min-of-ratio is **2.6–8.8×** lower — dispersion
  spec $23.41 M→$4.37 M, fade $36.99 M→$4.19 M — and the published sizes breach the 5 %-of-OI cap in
  **65–77 %** of periods, so the port sizes are **~$10–22 M**), and it established that **L07's
  liquidation-print half is not testable** (Binance removed `liquidationSnapshot` from the public bucket;
  exchange APIs return only recent fills). CYCLE-025 (F-42) then answered whether the capacity is a *number*
  or a *schedule*: a constant trailing-p5 size still breaches (2.7–3.7 %) and a lagged/EWMA size breaches
  **53–55 %**, but a **clipped trailing-median** schedule deploys **$16.94 M** (R8) / **$19.34 M** (R7) at
  **zero breach** (1.5–1.8× the constant-p5 size), while a full-follow float buys 2.0–4.1× mean size at the
  cost of dollar Sharpe and drawdown. CYCLE-026 (F-43) then took the pair **to the portfolio**: at the final
  specs F-31's 25 % mix is stale (the re-tuned carry book's second half is now +4.66, so the fade at net@4
  1.00 only dilutes carry at 6.49 — a walk-forward allocation rule picks **0 %** in 11/11 blocks), and the
  two sleeves' OI capacities **do not add** (the joint schedule at the mix is **56 %** of the sum; both at
  their individual sizes breaches the 5 % cap in **78 %** of periods) — a min-of-ratios capacity is a
  portfolio constraint, not a diversifiable per-sleeve one. CYCLE-027 (F-44) then computed the **exact**
  joint object (a per-period 2-D LP): its free-split frontier is **≈ the sum** (mean 1.13×, median 0.88×,
  2.0× the fixed mix), so the *constraint* is cheap and F-43's 56 % was the fixed split; what fails is a
  **stable allocation** (optimal fade share p5 0 / p95 1) and the LP-optimal schedule (48.5× gross/yr,
  net@4 0.62). CYCLE-028 (F-45) then **re-opened a signal claim**: F-28's "OI is directionless / do not
  port" was read off the *daily* book (1501×/yr, 1.89 bps) — the same **F-23→F-24 implementation artefact** —
  and EWMA-smoothed the OI-change cross-sectional book clears a 4 bps fee (**8.93–14.73 bps**, net@4
  +0.5…+0.7, corr 0.007 with carry), though it is weak, churny (338×/yr) and 2024–26-loaded. So the board
  now has a **live open lead (L19)** again, and F-28's "no signal" is corrected to "weak signal".
  CYCLE-029 (F-46) then **ran L19's own falsifier** (a pre-2024 read with the sign and λ fixed a priori):
  the *signal* survives it — λ=0.1 clears a fee pre-2024 (net@4 **+0.47**, break-even 15.23 bps) and a fixed,
  unfitted 50/50 blend of the two pre-registered λ is net-positive in **every** calendar year 2022–26 (and
  beats both single λ, full net@4 **+0.77**) — but F-45's *"best" λ=0.25* does **not** (pre-2024 **−0.12**),
  so what was regime-specific was the single parameter, not the phenomenon. The rank construction does not
  help, there is no decay (the net trend is *positive*), the stream is independent of L18 (corr **−0.045**),
  and its individual OI bound is the usual **$6–28 M** on the same thin alts (DOGE/LINK/ADA) — so a joint
  capacity read with R8 still stands between L19 and a port. CYCLE-030 (F-47) then **closed that gate**: the
  OI stream does **not add** to R8 (independent, corr **+0.01**, but max-Sharpe risk-normalised weight only
  **0.10** for **+0.04** Sharpe; walk-forward OI 0 %), and while the **3-sleeve LP** is *not* crowded out
  (**$142.2 M = 1.76× the sum** of the individual bounds, OI share **0.374**) it churns **129.6× gross/yr**
  (net@4 0.82) → L19 is a **standalone** small sleeve, never a joint member. It also registered the lab's
  first **measurement-basis** bug in the mix convention (**L10-y**: carry's per-gross vol is **0.4 %/yr** vs
  the spot sleeves' 14–24 %, so F-31/F-43's capital-fraction mixes measure the vol ratio). CYCLE-031 (F-48)
  then **removed a fitted object from R8**: a fixed, unfitted **two-scale blend** (λ = 0.01 + 0.02 in equal
  capital) matches the λ-only walk-forward out of sample (net@4 **6.66 vs 6.63**) at **half the turnover**
  (7 vs 14×/yr) and **1.8×** the break-even (46.1 vs 25.5 bps), with **every** pre-registered blend
  recent-positive — so the walk-forward **selection rule** adds nothing over a fixed cost-aware blend (its
  F-37/F-39 edge was over the *broken* λ=0.1 spec, i.e. it bought *slowness*). The blend must exclude the
  broken fast λ (the `all5` control is the worst, 4.36). Open question: whether a *single* λ, frozen before
  the span, would have done as well (the pinned λ=0.02's 6.86 is in-sample). CYCLE-032 (F-49) **tested it and
  scoped F-48 down**: the blend claim is **menu-dependent** — only **1 of 10** pre-registered blends clears
  the 0.2 bar (the cherry-picked `{0.01,0.02}`; the no-hindsight F-37-slow sets read **5.74–6.08**) and a
  blend-selection walk-forward reads **5.81** — **but** the honest simplification survives: a λ **frozen** on
  `[0,S)` picks the broken λ=0.1 for S ≤ 1.7 y (OOS **1.76–1.93**) and **0.02** for S ≥ 2.3 y (OOS
  **6.64–6.81**, matching the rule), so R8's walk-forward rule can be replaced by a **frozen λ on ≥ ~2.3 y of
  trailing data** — not by a blend — and its value is concentrated in the first ~2 years. CYCLE-033 (F-50)
  then removed R8's **last fitted object, the cap**: the joint (λ, cap) walk-forward reads OOS net@4 **6.13**
  while the pinned `ewma 0.02 + cap12.5 %` book reads **6.86** (≥ the rule on **4/5** sub-spans) — its F-39
  edge was over the *broken F-24 spec*, the same pattern again. The cap is a **flat plateau** at λ=0.02 (OOS
  6.63 none / 6.77 cap0.10 / 6.86 cap0.125 / 6.90 cap0.15; it clips **42.3 %** of weight entries), so the
  structural `1/k = 0.125` is **not tuned** — the first out-of-sample confirmation of F-27. A frozen *pair*
  fails, but a frozen **cap** (λ=0.02) beats the rule at every split. So **R8's spec is a pinned book**
  (λ on ≥2 y + cap = 1/k) with **no walk-forward**. CYCLE-034 (F-51) then ran the **same chain on R7** (the
  toptrader fade): its joint (λ, cap) walk-forward reads OOS net@4 **0.70** vs the best pinned
  `ewma 0.05 + cap12.5 %` fade **1.14** (pinned `ewma 0.1` 0.94), and a λ **frozen** on `[0,S)` with the cap
  at `1/k` picks **0.05** and reads **1.14 / 1.15 / 0.37 / 0.83 / 0.87** vs the rule's **0.70 / 0.87 / 0.31 /
  0.60 / 0.93** (≥ or within 0.2 at every split, and — unlike R8 — **no ≥2 y minimum needed**). The mechanism
  is **λ-flatness**: with the cap fixed the eight λ's span only **0.16** OOS (0.25 uncapped), so the rule
  ranks near-ties (F-40's noise-dominated window, quantified). The cap transfers (λ=0.1: OOS 0.94→**1.11**,
  turnover 28→**16×/yr**, recent-24m 0.84→0.47). So **R7's spec is pinned too** (`ewma 0.05 + cap 12.5 %`),
  and the port conclusion is **symmetric: both deployable sleeves are pinned books, no walk-forward.**
  CYCLE-035 (F-52) then asked *what the cap is actually doing*, and decomposed it: a **no-trade band**
  (a pure turnover tool) swept to the cap's exact turnover (10×/yr) recovers only **+0.13 of the cap's +1.26**
  net@4 gain, and across the whole band sweep (turnover 16→6×/yr) net@4 stays in **[4.95, 5.05]** — so the
  cap's Sharpe edge is the **shape** (clipping max `|w|` 0.438→0.125), **not** churn. The band also leaves
  concentration and capacity untouched (max `|w|` 0.436; OI capacity **1.00×** of base) while the cap is
  **1.76×/1.70×** → the capacity gain is **concentration**. And the two **stack**: a band on the capped book
  reads net@4 **6.36** at turnover **6×/yr** (vs capped 6.18 at 10), so the port cost recipe becomes
  **cap `1/k` + a no-trade band**. CYCLE-036 (F-53) then ran the same decomposition on the lab's second
  sleeve, **R7**: the fade's cap is also a **concentration** tool (a turnover-matched band reads **0.78** vs
  the capped **1.07** — below even base — and capacity **1.03–1.04×** for the band vs **1.43–1.47×** for the
  cap), so the mechanism is a property of *clipping*, not of the dispersion book — **but** the band does
  **not** stack on the fade (**+0.06**, vs R8's +0.18), so the band remedy is **R8-only**. CYCLE-037 (F-54)
  then closed the mechanism question: the cap is a **tail winsorisation** — a smooth saturation
  `c·tanh(w/c)` at c=0.125 matches the hard clip (**6.04 vs 6.18**), so the hard form is not special, only
  the level (a plateau); but `sign(w)·|w|^p` reads **4.44/3.99/3.25/2.27** for p=1.25/1.5/2/3 (all *below*
  base 4.92) and equal-weight reads **1.51** → it clips the extreme tail, it does not shrink the book. CYCLE-038 (F-55) then challenged the **split
  points** themselves: on a dense 14-split grid the pre-registered 0.80 robustness bar narrowly fails
  (expanding freeze 0.71, rolling 0.79), but every failure is in the first ~2 y (the expanding freeze
  collapses at S ≤ 2190, then matches at 10/10 splits from S = 2555) → the safe boundary is **~2.3 y**;
  the rolling freeze beats the expanding one, the broken fast λ is **0.075** (not 0.1), and the **cap
  stabilises** the policy (rolled robustness **0.50 uncapped → 0.79 capped**). CYCLE-039 (F-56) then closed
  L19's **construction** thread: the OI two-scale mix is optimal at **50/50** (no non-equal mix beats it, and
  a no-hindsight inverse-vol mix picks **0.51**), but a **hold-6** cadence on the blend lifts net@4
  **0.77 → 0.87** — the gross Sharpe *falls* (1.18 → 1.03) while turnover drops 254 → **93×/yr**, so the gain
  is pure fee saving, and hold-3/6/9 (0.82/0.87/0.83) define a **1–3 day plateau**. CYCLE-040 (F-57) then
  **stressed that cadence claim**: a true-hold **drift-aware** simulation gives turnover within **2×/yr** of
  the lab measure at every N (so `turnoverSeries` is *not* optimistic), but a **fine grid** (N = 1…36) is
  jagged — hold-6 is an **isolated spike** (+0.10 over neighbours 5/7), only **4 of 15** holds beat daily by
  ≥ 0.05, the short-hold mean is only **0.80** vs 0.77 — so the +0.10 headline is **noise**. The honest
  construction is **"hold the 50/50 blend ≤ ~3 days (254 → 73×/yr): no worse, but no specific cadence adds."**
  CYCLE-041 (F-58) then found the sleeve's **actual** cost tool: a **no-trade band** (the F-52/F-53 tool, never
  before applied to the OI sleeve) reaches net@4 **0.92** at `eps = 0.03` (turnover **198×/yr**, break-even
  **15.22 bps**, positive every year) — **above hold-6's 0.87** — and as a **smooth plateau** (3 points within
  0.05 of the peak, no interior re-rise) rather than a cadence spike. So the OI sleeve's construction is
  **50/50 blend + a no-trade band**, and the band is now confirmed as the lab's **general** cost tool.
  CYCLE-042 (F-59) then gave the band the **dense-split holdout**: the frozen-eps band beats the frozen-N hold
  at **11/11** splits and a **fixed** `eps = 0.03` beats both the daily blend and fixed `hold-6` at **every**
  split (so F-58 is not a full-sample artefact) — **but** the trailing `eps` pick is unstable on < ~2.3 y
  (short windows pick the largest `eps` 0.1 and underperform), settling to `0.03` from S ≥ 3650 → **pin
  `eps ≈ 0.03`** (or pick it on ≥ ~2.3 y), mirroring the safe-window boundary of F-49/F-55. CYCLE-043 (F-60)
  then delivered the roadmap's last item, the **port artefact**: `prototypes/port.js` (`clipWeights` +
  `bandWeights` + `cleanBook` = cap-then-band) reproduces **all five** published books across R8/R7/OI
  (6.18/10×, 5.05/10×, 6.31/7×, 1.07/8×, 0.92/198×) — one signal-agnostic module, with `SLEEVE_SPECS` and
  `MIN_TRAIN_PERIODS = 2555` encoding the final recipes and the ~2.3 y rule. CYCLE-044 (F-61) then opened a
  **new lead via a bug hunt** and found the audit's **first shipped-path arithmetic defect**: the repo's
  `analysis/carry.js#carryOnBarGrid` divides every funding row by the *default* 8h bar count rather than the
  observed interval, so sub-8h funding is understated **1×/2×/4×/8×** (a synthetic 8h period at 8h/4h/2h/1h
  funding returns one rate every time); it bites the shipped SOLUSDT FTX window (**3.03×**, −0.107 vs
  −0.324), making the pooled 8h sleeve read ann **9.985 %→9.531 %** / Sharpe **11.96→9.60** — the defect
  **flatters** the sleeve, so no "implausibly large" alarm can catch it. The module's own comment ("divides
  by the period actually observed") is **false of the code**, and `auditFundingProblems` is **blind** to the
  interval change (SOL's 98 2h steps pass as `[]`). Latent siblings: a single-pair `barsPerPeriod`
  inference, and the audit blind spot. The lab never calls the function (its loader buckets rows first,
  L10-o), so no lab number moves; `e14` now pins that (check 13 `sub_8h_sleeve_equality`). Fold-back **R4**
  carries the fix. CYCLE-045 (F-62) then turned the synthetic-ground-truth technique on the lab's most
  load-bearing analytical primitive, the **dependence/DSR backbone** (`dependenceSummary` → `effectiveBars`
  → `backtestMetrics`), and it is the audit's **first positive validation of a repo statistic**: ensemble
  means over synthetic panels match the survey-sampling closed forms (`1+(K−1)ρ` for K equicorrelated
  streams, `K` for identical streams, `1+ρ` for negatively correlated pairs, and the i.i.d. null 1) within
  **2.5 SE** (max gap **0.318**, 0 biased rows) → so F-02's real-basket design effect of 4.92 is the
  estimand it claims. But the audit also measured the estimator's **precision**, which the lab had never
  done: on true-i.i.d. data a *single* reading at the repo's own C = 36 folds spans **0.644–1.452**
  (sd 0.243; 0.097 at C = 288) → a two-decimal `designEffect` (F-02, F-47) overstates the resolution by
  ~10×, and a single `adjustmentNeeded` verdict within ~1 ± 0.25 of the gate is not resolvable. It settled
  two long-open rows: **L10-f** — `effectiveBars` is not merely able to exceed `n`, it is **unbounded** (a
  perfectly hedged pair gives DE **4.7e−32** and `effectiveBars ≈ 3.4e34` while `adjustmentNeeded` reads
  **false**, because DE is a *squared* ratio) — and **L10-i** — the DSR path's refusal to adjust when the
  design effect is < 1 (`backtestMetrics` requires `2 ≤ effectiveBars < n`) is **intended**, returning
  `nEff`/`dsrAdjusted` = `null`, though it is lossy (a hedged panel and a degenerate one both read `null`;
  new row **L10-ae**). `e54_dependence_audit.js` is the register's **second synthetic-ground-truth
  experiment on a repo function** (after `e53`), and its **closed-form + seeded ensemble + 2.5-SE band**
  method is now the standing recipe for auditing any statistic. CYCLE-046 (F-63) then turned the technique
  on the **split machinery the lab reports *from***: `analysis/splits.js` opens "purging and embargoing" and
  the repo's lock-registry claims the family proves "zero label-window leakage", but the audit (against a
  **closed-form label-overlap ground truth**: a fold leaks iff `0 < j−i ≤ H−1`) finds the family split: the
  two **purged** variants (`purgedKFoldSplit`, `combinatorialPurgedSplit`) are leak-free on every fold of a
  synthetic grid (embargo honoured, CPCV multiplicity `C(k−1,m−1)`), while **`walkForwardSplit` — the path
  the A/B and F-13 actually use — performs no purging or embargoing at all**. It takes no
  `labels`/`labelSpan`/`embargo` parameters (passing them returns byte-identical folds), its folds carry no
  purge metadata, and for a label horizon H > 1 the boundary leaks exactly `H(H−1)/2` train/test
  label-overlap edges per fold (10/fold at H=5; zero at H=1). The causality guard `isCausalFold` checks
  index order only, so it **passes every leaky fold** (a look-ahead-in-time check, not a leakage check),
  while the repo's own `assertNoLeakage` flags it but is **never called on the walk-forward** (**L10-ag**:
  the test-ledger claim is itself a claim — the L10-t lesson). An index-lookup model — permitted because
  the API hands it `trainIdx` — recovers test-period returns in the leak zone (**+0.0035**/bar P&L edge,
  se 7e−5, vs 0.0000 clean and +0.0001 purged), so the leak is not cosmetic. Every lab walk-forward result
  scores parameter-free signals (span 1 → zero leak), so **no lab number moves**; the shipped controller
  trains on horizon labels (`labelHorizonBars`; the opt-in `label:triple` vertical barrier), and its labels
  *do* overlap (`heldBars {mean 8.30, max 54}`). CYCLE-047 then **scoped F-63 down to LATENT, not live**: the
  shipped controller is **online** — the fold is fitted by replaying bars `1 … testStart` with each call
  seeing only a window ending at `i − 1` (`analyze.js:1018`), so the last training bar is `testStart − 1` and
  the fold's `train` list is ignored, while `trades.js` labels a trade by its outcome at the **exit** bar
  (only *closed* trades train) — so every training label is realised at an exit `≤ testStart − 1`, causally
  before the test, and the leak cannot occur. R9 is **downgraded to latent / low-priority**, and the `e55`
  guard stays so a future **fixed-label offline** model behind `walkForwardSplit` cannot silently inherit it.
  **FOLD-BACK R9 (latent)**: purge the walk-forward boundary (accept label spans; drop training labels
  overlapping the test window — the purged K-fold's own rule) — for a future offline model, not the shipped
  controller. CYCLE-048 (F-64) then turned the same synthetic-ground-truth technique on the module that
  **owns the label spans** — `analysis/labels.js`, audited by `e56_labels_audit.js` (23/23 guards, 77 ms).
  The contracts hold exactly: `tripleBarrierLabels`' first crossing is `ceil(level/step)` on **192** monotone
  cases, its three-way `ret` / first-crossing / timeout-index contracts hold on **60** seeded random paths
  (and `ret` is a *realised price change* — the touch bar overshoots the barrier level **1362** times on
  gaps); `cusumFilter` matches an **independent** drawup/drawdown formulation of its reset rule on
  **160/160**; `fractionalDiffWeights` = `(−1)^k C(d,k)` for integer `d` (1e−12) and against an independent
  **Lanczos-`Γ`** for non-integer `d` (max rel. err **2.3e−14**); and the **shipped** `fracDiffAt` /
  `fracMomentum` equal the weights convolution exactly. Five warts follow, **all latent**: the
  `pt`-before-`sl` tie-break is **unreachable for `vol > 0`** (0 of 6 bars can satisfy both) and degenerate
  at `vol ≤ 0` — at `vol = 0` the barrier collapses to a **one-bar sign label** and a flat series labels
  **11/12** events **+1 at `ret = 0`** (**L10-ak**); the default event set emits a **zero-horizon**
  `{t1 = event, label 0, ret 0}` bet indistinguishable from a vertical timeout (**L10-al**); `cusumFilter`
  **ignores its `events` argument** (**L10-ai**) and its `lastEmit` guard is **dead** (**L10-aj**); and the
  "`size <= 0` uses `DEFAULT_FD_WINDOW`" docstring is **false** — the auto branch stops at `|w| < 1e−12`,
  giving widths **1/2/3/4** for `d = 0/1/2/3` (**L10-am**). A candidate was **killed before it was written
  down** (**L10-an**): `fractionalDiffWeights(0, 0)` is `[1]` and the `d = 0` identity is exact with no NaN
  (the width-2/NaN-at-0 case is `d = 1`). The scope trace (**L10-ao**) is what makes it all latent — only
  **1 of the module's 6 exports** is on the shipped path (`fractionalDiffWeights`, via `features.js`), the
  rest being **test-only** (the shipped controller labels trades in `hivemind/controller/trades.js`) — and
  the calibration row **L10-ap** records the shipped arm's `window 16` against the module's own **100**
  (k ≥ 16 carries **6.27 %** of the `|w|` mass). No shipped behaviour moves; `run_all` is now **64 steps,
  32 gated, 0 fails**. CYCLE-049 (F-65) then closed the pure-module audit queue's next entry — the
  **PBO / CSCV module** `analysis/overfitting.js`, audited by `e57_overfitting_audit.js` (29/29 guards).
  Its structure and closed forms are **exact**: `cscvBlocks` partitions the bar grid (remainder on the first
  blocks, 7/7); `cscvSplit` yields exactly `C(S, S/2)` splits (6/6 `S ∈ {2…12}`), each a disjoint cover,
  each block in exactly `C(S−1, S/2−1)` in-sample sets, the set closed under complement, and the cap rejects
  `C(22,11) = 705432` while passing `C(20,10) = 184756`; `relativeRank` matches best `N/(N+1)`, worst
  `1/(N+1)`, full tie `1/2`; `oosOnIsRegression` matches an independent sum-formula OLS on 40 vectors
  (1e−9); and constructed PBOs are exact (all-flat **1**, one dominant strategy **0**, an anti-persistent
  pair **1**, a hand-computed metric override **0.5 / 1.0**). But the module's **quoted calibration is one
  draw**: with the repo's own RNG (seed 20240, N=20/T=500/S=10) the published `PBO = 0.464` reproduces
  exactly — **117/252 = 0.46429** — yet over a 60-matrix ensemble the estimator centres at **0.4769** with
  **sd 0.2546** and p05–p95 **0.099–0.885**, while the binomial split SE of one 252-split PBO is only
  **0.0315** → a split **design effect of 65.4**, i.e. **≈3.9 independent splits** (the **F-62** lesson one
  level up). Five rows follow, **all latent** (**L10-av**: no shipped module imports `overfitting.js` —
  only `analysis.test.js` and `test/lock-registry.js`): **L10-aq** — `relativeRank` skips `NaN` in the rank
  but divides by the full `n` (0.60 vs 0.75), biasing PBO up; **L10-ar** — a **fully-tied** roster is forced
  to PBO **exactly 1**, though partial duplication does *not* bias it (0.5806→0.5401, 6/10, the
  pre-registered guess **falsified**); **L10-as** — `degradation` returns `n = N·splits = 2016` dependent
  pairs from only 80 block performances, so a naive t exceeds 1.96 on **91.2 %** of skill-less matrices;
  **L10-at** — a 252-split PBO is worth ~4 independent splits; **L10-au** — `cscvBlocks(6,6)` alone yields
  six 1-observation blocks and the guard message says "per half" where the rule is per block. No fold-back
  row; `run_all` is now **65 steps, 32 gated, 0 fails**. CYCLE-050 (F-66) then turned the same
  synthetic-ground-truth technique on the **resampling hub** — `analysis/reality_check.js`, audited by
  `e58_reality_check_audit.js` (**39/39 guards**), the one module family in this queue that is *partly*
  shipped (`forecast.js` imports `stationaryBlockIndices`; `walkforward.js` imports the four subsampling
  procedures). Its **live primitives are exact**: `stationaryBlockIndices` at `b = 1` is byte-equal to an
  **independent hand replay** of its rng stream and is i.i.d.-with-replacement, its restart law is geometric
  (`P(restart) ≈ 1/b`, mean run `≈ b`, both within 2.5 bootstrap SEs); `neweyWestSE` matches an
  **independent Bartlett implementation** on 24 windows × bandwidths (1e−12); RC = `sqrt(T)·max mean` (a
  constant benchmark shifts it by exactly `−sqrt(T)·b`); SPA = `max(0, max fbar/ω)` with the bootstrap SE
  (independently recomputed); the consistent recentring bound `A_k = ω_k·sqrt(2 log log T)` is exact and
  consistent == upper recentring when every candidate is valid; the step-down's **first step is bit-equal
  to the single-step consistent SPA**; and the subsampling family shares **one** reference (k-FWER at
  `k = 1` == the step-down's first p == the consistent SPA p), is deterministic, and is segment-aware
  (`groups = [T]` bit-identical to ungrouped). It also reproduces the arch AR(1) reference vector
  (**13.635665 / 15.608940**) from an **independently implemented NumPy legacy-RandomState(0) stream**. But
  the **selector does not reproduce its documented reference**: `politisWhiteBlockLength` returns **exactly
  0** whenever its flat-top long-run `g ≤ 0`, while the referenced `arch._single_optimal_block` **squares
  `g`** — over 200 AR(−0.5) T=400 draws the repo reads 0 in **198** and arch a positive length (e.g.
  **22.0** at `g = −0.858`), so `autoBlockLength` floors to **1 (i.i.d.)** on **99/100** and the automatic
  block bootstrap silently degrades to i.i.d. resampling on anti-persistent data (**L10-aw**; the comment's
  floating-point-agreement claim is false for `g ≤ 0`). Three more rows: the `median` arm reduction is the
  **upper** median on even `K` (**4.84761** vs **4.25907** — **L10-ax**), the `neweyWestSE` `v < 0` clamp is
  **unreachable** (the Bartlett estimator is a PSD quadratic form; an exhaustive ±1 search up to length 18 ×
  every bandwidth + 3000 random windows finds minimum taper exactly **0** — **L10-ay**), and the whole
  block-bootstrap RC/SPA family is **test-only** (**L10-az**). Independently re-measured, subsampling SPA
  holds its 5 % size across the persistence sweep (**0.040/0.045/0.045/0.030** for φ = 0/0.2/0.5/0.8) while
  the block bootstrap over-rejects (**0.385** at φ = 0.8). The cycle also fixed a **lab bug**: `e56`/`e57`
  never exposed `verdict.validationPass`, so `run_all` left their `pass` **undefined** since
  CYCLE-048/049 — two validation suites were reported but **not gated**; both now return it, and `run_all`
  is **66 steps, 35 gated, 0 fails**. CYCLE-051 (F-67) then turned it on **`analysis/forecast.js` — the
  SHIPPED forecast scoring layer** (`analyze.js` runs the block on by default), audited by
  `e59_forecast_audit.js` (**33/33 guards**). The audit gets a **free second reference**: the repo already
  contains an independent Murphy implementation in `observer/legion_metrics.js`. The arithmetic is exact —
  `forecastPairs` IS the inverse of `confidenceFromProb` (1e−12) plus the next-bar sign, the fold-last-bar
  drop and the non-finite skip; `brierBinIndex`/`brierScore`/`logScore` are the closed forms with the
  documented clip/NaN handling; the Murphy partition satisfies `brierBinned = REL − RES + UNC` (1e−17); the
  two implementations agree on REL/RES/UNC/Brier to **1e−12** and the observer's explicit `within` equals
  forecast's raw-minus-binned gap to **1e−17**; `bootstrapMeans` is deterministic with the documented block
  and one **paired** index draw; the DM statistic is exactly `dbar/boot-SE` with the documented degenerate
  arms, i.i.d. size **0.0525/0.1075** and a block bootstrap that controls φ=0.5 size where `blockLength=1`
  does not (**0.095** vs **0.135**); the MCS eliminates a uniformly worse arm, keeps an identical pair,
  **always contains the sample-best** (800/800), is deterministic/monotone and covers
  **0.880/0.855/0.865/0.925** (the lower edge of the 2.5-SE band — a probe's 0.82 reading was Monte-Carlo
  noise). Five rows follow. **L10-ba** is the headline: the comment's claim that the raw-minus-binned gap
  *IS* the within-bin forecast variance is **false** — the exact identity (the repo's own
  `observer/legion_metrics.js`) is `gap = WITHIN = withinVar − 2·withinCov`, and the gap is **negative on
  5/6** configs while `withinVar > 0` (wrong by up to **0.13**). **L10-bb**: the `forecastComparison`
  alignment guard checks bar **counts**, so a count-coincident misalignment is silently paired index-wise
  and the DM verdict **flipped in 6/6** crafted witnesses. **L10-bd**: `groupOf` maps `benchmark` to the
  **baseline's** kind, so with a `'signal'` baseline a calibrated-probability benchmark joins the z-score
  group and gets a DM test (contradicts the `reader`/`docs/LOCKED.md`; **unreachable from `analyze.js`**,
  reachable through the exported API, untested). **L10-be**: the MCS elimination denominator is `sd(L_i)`,
  not HLN's `sd(d_i)` (up to **77×** apart, **0/150** set or order changes → inert). **L10-bc**: the
  exported `bootstrapMeans` silently NaNs on unequal-length series and the MCS returns `available:true` for
  a NaN-containing series (latent). **L10-bf** is the negative control: the calibration battery **upholds**
  the module. No fold-back row (docstring/branch/export level, not the scored path); `run_all` is now
  **67 steps, 36 gated, 0 fails**.
 CYCLE-052 (F-68) then finished the pure-module sweep with **`analysis/race.js`, the successive-halving
  racing engine** — the lab's first audit of a module the repo itself has **gated off** (engine-only /
  test-only: no shipped importer, and `analyze.js` exposes **no `--race` flag**; `RUN-ANALYSIS.md` §7
  measured neither an economics nor a diversity win). Its closed forms and contracts are exact
  (`e60_race_audit.js`, **18/18 guards**): the round count `max(1, floor(log(max/min)/log(eta)) + 1)` and its
  guards, the schedule's `keep = max(1, ceil(survivors/eta))` / monotone budgets / top rung `= maxBudget` /
  early stop, and the engine's full-rung arm order, `nonFinite` elimination, `maximize:false`, sync-vs-async
  equality, stable ties, cost-counter reconstruction and guards. But the *correctness requirement* that would
  license turning the flag on fails: **L10-bg** — `docs/LOCKED.md`'s *"a racing budget does not change the
  decided set"* is a **tautology** on the §AM fixture (its `evaluate = q ± 0.05/budget` ranks every budget
  identically, `rank(1) == rank(9)`, and its top rung 3 sits below its own oracle's budget 9) and **false** on
  a budget-dependent evaluator, where the race discards the top-budget best on
  **0.617/0.617/0.700/0.625** of seeded fixtures; **L10-bh** — the `spentBudget < gridBudget` identity holds
  only at a large budget ratio (0.222 on the fixture) and reads **1.000–2.890×** otherwise; **L10-bi** —
  small-`eta` integer rounding repeats consecutive rungs (**15 of 25** at `eta = 1.1`); **L10-bj** —
  `eta`/`minBudget` are unvalidated (a silent `available:true` with `winner:null`). **L10-bk** is the scope:
  engine-only, so every row is latent and there is **no fold-back row** — but the claim that licenses the gate
  is the one that fails. `run_all` is now **68 steps, 37 gated, 0 fails**.
 CYCLE-053 (F-69) then turned the technique on **`analysis/benchmark.js` — the SHIPPED P1 model-class
  benchmark** (`--variants=bench-*`; the ridge arm is the MCS survivor and the best of the set, so its
  probability is load-bearing for the round-29 "negative branch" G-A). `e61_benchmark_audit.js` (**12/12
  guards**, 67 ms) validates the documented contracts — the standardiser (zero-mean/unit-std, a collapsed
  constant column, the empty-input shape), `fitRidge` against an **independently solved** centred ridge
  (matching to **0**), `predictRidge`'s `(0,1)` range, `fitBaseRate` = the training prior, the ridge/MLP
  separable-rule accuracy, MLP byte-determinism, `BENCHMARK_KINDS` + the `tsfm`/unknown-kind refusals, and a
  perfect classifier beating the base rate on Brier — and finds four rows. **L10-bl** is the headline:
  `fitRidge` computes the training base rate `ybar`, centres the target on it, and **`predictRidge` never
  restores it**, so the arm's probability is anchored at 0.5 — a constant-`y` fold reads exactly **0.5** and a
  0.833-base-rate fold reads a mean of **0.50** (Brier **0.22475** vs **0.13533** with the module's own term
  restored); the shipped test checks **accuracy only** (a 0.5 threshold, invariant to the offset), so it cannot
  fail. **L10-bm**: the sigmoid is applied to a least-squares fit of a bounded [0,1] label, confining the
  output to `sigmoid([-1,1])` — a perfect feature reads Brier **0.1425** (the arm's floor) while the MLP
  reaches **0.99** on a constant-`y` fold. **L10-bn**: the LOCKED/lock-registry claim that the test proves the
  ridge closed form "against a hand-computed solve" is **unverified** (the closed form is exact, but no
  shipped §P1 check does a hand solve). **L10-bo** is latent: the eps constant-column fallback turns a
  one-unit train→test deviation into `z = 1e8`. Two rows are shipped (a forecast arm's readout) but no golden
  moves and there is **no fold-back row**. `run_all` is now **69 steps, 38 gated, 0 fails**.
 CYCLE-054 (F-70) then audited the **measurement layer** — `analysis/backtest.js` together with its
  instrument `analysis/performance.js`, the two modules every pooled `report.json` number flows through
  (`walkforward.js`/`analyze.js` build on `purgedCVBacktest`/`poolFolds`/`backtestMetrics`, and
  `performance.js` is imported by eight `analysis/` modules). `e62_backtest_audit.js` (**26/26 guards**,
  4.13 s) validates both halves against **independent references**: `erf` vs Simpson quadrature (**1.393e-7**
  < the documented 1.5e-7), `normalCdf(0) = 0.5` exactly and odd, `normalInvCdf` round-tripping **2.46e-10**
  against a Lentz-erfc reference (< 1.15e-9), the moment conventions exact, the Lo (2002) SE = `√(1.5/99)`,
  PSR **exactly 0.5** at its benchmark, DSR = PSR at the expected-max hurdle to **1e-15** (and DSR ≤ PSR)
  with `expectedMaxSharpe` reproduced to 5.1e-11, MinTRL = **13.1749455166** vs the documented 13.174945 and
  an independent recompute, and the stationary bootstrap size-calibrated on **1000** noise series
  (**5.9 %/11.0 %**, mean p **0.502** — the repo's 5.8 % reproduced) — plus the backtest arithmetic
  (positions/turnover/gross/cost/net/equity/drawdown/tradeCount/the break-even identity), a `poolFolds`
  restatement identity, and `purgedCVBacktestAsync` **byte-identical** to the serial path. Three rows.
  **L10-bq** is the actionable one: `hitRate(strategyReturnSeries)` receives **only a return series**, so its
  docstring ("bars with no position are excluded") describes a criterion its signature cannot express, and the
  implemented `r === 0` skip both drops a zero-return in-market bar (**0.6667** where the documented rule gives
  0.5) and — because `backtestMetrics` passes the **net** series — counts every exit-cost flat bar as a **miss**
  (a perfectly-timed 3-round-trip book at 10 bps reads **0.5** where the documented rule gives **1.0**); the
  shipped check's flat bars *are* its zero-return bars, so it cannot discriminate. **L10-br**: `scoreFold`
  re-lags the signal **inside** the test slice (`pos[0] = 0`), so on the supported fixed-signal path the first
  bar of every fold is flat and a **CPCV** run boundary holds the previous *test* bar's signal (bar 30 reads
  **+0.05** where the global rule gives **−0.05**), contradicting the module's own one-bar rule (3/64 bars
  differ on a 4-fold split; latent). **L10-bp** is a **disproved lead**: the probe's negative MinTRL
  (−3.058 at skew 3 / kurtosis 3) is unreachable because **Pearson's inequality** `kurt ≥ skew² + 1` forces
  `v ≥ (1 − skew·SR/2)² ≥ 0` (a 60 000-histogram search bottoms at `v = −2.4e-15`, 20 000 random series
  violate nothing, MinTRL from measured moments ≥ **2.17**) — the real residual is that a **NaN** sharpe
  returns Infinity and is labelled `beyond-horizon` instead of `unavailable`. All three rows are
  report-level/latent; no fold-back row. `run_all` is now **70 steps, 39 gated, 0 fails**.
 CYCLE-055 (F-71) turned the technique on the **causal signal family** — `analysis/features.js`, the module
  every arm's position flows through (all **16** candidates: 8 `SIGNAL_CANDIDATES`, 4 `REVERSAL_CANDIDATES`,
  4 `SIGUP_CANDIDATES`) — and closed the open **L10-e**. `e63_features_audit.js` (**11/11 guards**, 70 ms)
  finds the module's two headline promises exact: **causality** (for every candidate and every test bar, a
  strict-future perturbation of closes/returns/volumes/panel leaves `positionAt` bit-unchanged — 0 mismatches
  over 16×100 bars, and non-vacuous: all 100 bars non-zero, 77–79 later bars moved) and **abstain** (a
  returns-only view reads 0 on exactly the five channel-dependent candidates; degenerate series stay finite in
  [−1,1]; `clampPosition` exact; all **13** single-feature references exact to 1e-12 — `fracDiffAt` also equals
  the shipped `labels.js#fractionalDiff(log closes, 0.4, 16)` — and the cross-section + regime gate match their
  references). **L10-e is SETTLED**: a singular `{close}` series abstains (`rangeLocation` NaN, `positionAt` 0)
  while the plural `{closes}` gives **0.0211625225**. Four latent rows. **L10-bs** (headline): the `std is 0`
  abstain guard is defeated by floating-point rounding — an exactly-constant window leaves the sample mean **not
  bit-equal** to the value, so `std = |d|·√(n/(n−1))` is a **denormal positive** number the guard cannot reject
  and the feature reads `|z| = sqrt((n−1)/n)` (**−0.9682458366** n=16, **−0.9842509843** n=32,
  **−0.9746794345** n=20) instead of 0 — a **0.468–0.492** position at saturation 2 from an information-free
  feature; a rounding-boundary effect (where the mean IS bit-exact, e.g. n=8/n=32 on 0.001 and the 0.03125
  fixture, the guard fires), so the shipped test gives no warning. **L10-bt**: `finiteSum` on an empty range
  returns **0** where `meanOf` returns **NaN**. **L10-bu**: `networkMomentum`'s self-skip `i ===
  panel.streamIndex` never matches when `streamIndex` is absent (folds the stream's own momentum in —
  **−0.9066812992** with the field vs **−1.8820447956** without). **L10-bv**: `regimeGatedMomentum` scales the
  crash gate by the **momentum** window's variance, not the gate window's (ratio **1.309** at 16 vs 32), so the
  gate fires too rarely in a hot short-term regime. All four are latent; no fold-back row. `run_all` is now
  **71 steps, 40 gated, 0 fails**.
 CYCLE-056 (F-72) audited **sample uniqueness** — `analysis/uniqueness.js`, the reference implementation of
  López de Prado ch.4 (average uniqueness, effective sample size, sequential bootstrap; reference-only, since
  the hot path re-implements it in `hivemind/training/sample_weights.js#overlapUniqueness`).
  `e64_uniqueness_audit.js` (**8/8 guards**, 82 ms) confirms `sampleUniqueness` against an **independent
  per-bar scan-all-spans recompute** to 1e-12 (`[[0,2],[1,3]]` → **2/3, 2/3**; `[[0,0],[0,5]]` → **1/2,
  11/12**) and against the **shipped** `overlapUniqueness` to **exactly 0** (8 fixtures), plus per-label
  order-invariance and the ESS identities (point labels → **n**; `ESS = sum`; `ESS ≤ n`; 6 overlapping labels
  read **5.5833**). Three rows, all test-only/latent. **L10-bx** (headline): the sequential bootstrap's draw
  weight is the uniqueness **sum** (`avgU[i] = acc`), not the average the comment and ch.4 specify — so two
  **non-overlapping** labels, both maximally unique (average 1.0), are drawn in the ratio of their lengths
  (measured first-draw P(3-bar) **0.7480** vs the intended **0.5000**; a 1/2/3-length fixture reads
  **0.1688/0.3299/0.5014** vs 1/3 each). **L10-by**: the implemented heuristic (static numerator,
  `1/(1+count)` conditioning) is **not** the AFML ch.4 sequential bootstrap it cites — on
  `[[0,1],[0,1],[2,3],[2,3]]` the second-draw law is **1/7,2/7,2/7,2/7** vs AFML **1/6,1/6,1/3,1/3**
  (total-variation gap **0.1190**). **L10-bz**: spans are unvalidated (a zero-length span returns NaN and
  poisons the ESS; a negative-length span returns −0). No fold-back row. `run_all` is now **72 steps, 41 gated,
  0 fails**.
 CYCLE-057 (F-73) audited the **stream design layer** — `analysis/streams.js` (shipped; `analyze.js` prints it):
  the resampler, the Kish (1965) design effect and the greedy selector. `e65_streams_audit.js` (**9/9 guards**,
  16 ms) confirms `resampleCandles` against a hand recompute and every OHLCV invariant (10 bars/factor 4 → 2
  groups, keep → 3; a group with no finite high/low reads max/min(open,close); a missing volume counts as 1),
  the Kish identities exactly (`rawBars = K·T` 720; `DE = 1+(K−1)·rbar` 2.9458671265; `effectiveBars =
  rawBars/DE`; `effectiveStreams = K/DE`; `effectiveBarsPerBar = 1/DE`), the closed forms (K=1 → DE 1;
  identical streams → rbar 1, DE 2/3, effectiveStreams 1; T = min length), the `fold-sharpe`-iff-tiles rule,
  and the selector's determinism/tie-break/monotonicity/marginal arithmetic. Two latent rows. **L10-ca**
  (headline): a zero-variance (constant) stream is **skipped from `rbar` but still counted in `K` and
  `rawBars = K·T`** — adding one constant stream leaves `rbar` **bit-identical** (−0.0133166822) yet takes
  `effectiveStreams` **2.0270 → 3.0821** and `rawBars` 480 → 720, so a no-information stream buys a full unit
  of breadth (while `selectStreams` **does** skip it — the two shipped functions disagree). **L10-cb**:
  `maxStreams <= 0` is treated as **unlimited** (`0` and `−3` both select the full set instead of none). No
  fold-back row. `run_all` is now **73 steps, 42 gated, 0 fails**.
 CYCLE-058 (F-74) audited the **audited evaluation world** — `analysis/world.js` (shipped; the module that gives
  `auditNoLookahead` its teeth after a returns-only perturbation passed vacuously, BUGS.md #22). `e66_world_audit.js`
  (**7/7 guards**, 49 ms) confirms `shockFactor`/`volumeShockFactor` are 1 at and before `after`, strictly inside
  `[1, 1+2·probe]` after it, deterministic, non-uniform and phase-shifted (probe 0.07 → max 1.14; `t=after+2`
  price 1.0494 vs volume 1.1369); `shockCandles(null)` is the same array, every bar ≤ `after` the same object,
  every bar > `after` a new one with OHLC × `f(t)` and volume × `fv(t)`, input never mutated, the shape changed
  (close ratio 1.0001–1.0993); `makeCandleViewFor` returns the real candles on the base pass and on a probe pass a
  self-consistent tuple (`view.returns === barReturns(view.closes)`) with the past bit-unchanged and 19/19 future
  bars moved; `worldFromCandles` aligns and keeps the last `maxBars`. Two latent rows. **L10-cc** (headline):
  `panelFor` replaces the panel's own-stream slot only when `streamIndex` matches an index — with `streamIndex`
  absent (or out of range) **every slot stays the unperturbed original** while `view.returns` is shocked, so a
  cross-sectional candidate reads its own unshocked series and the look-ahead audit is **vacuous** (the exact trap
  the module exists to close; same root cause as L10-bu, opposite consequence). **L10-cd**: `worldFromCandles`'
  `maxBars` guard: `0` → all bars (falsy), `−5` → **drops the first 5** via `slice(5)` (the sign flip), `7.5` → 7
  (silent truncation), all reachable from `--bars`. No fold-back row. `run_all` is now **74 steps, 43 gated,
  0 fails**.
 CYCLE-059 (F-75) audited the **order-preserving scheduler** — `analysis/parallel.js` (shipped; the module that
  makes `folds.jsonl` byte-identical between the serial and parallel A/B paths). `e67_parallel_audit.js`
  (**7/7 guards**, 49 ms) confirms `normaliseConcurrency` maps every non-finite/non-positive width to serial 1
  and floors/caps the rest (`2.9 → 2`; `1e6 → 64`); `scheduleUnits` returns results in **unit order** under an
  out-of-order completion schedule (`2,1,0,5,4,3,6,8,7,9`), calls `exec` exactly once per unit, peaks at exactly
  the requested concurrency, reports through `onResult` out of order with a throwing reporter harmless, rejects
  with the **first** error (`boom-1` / `e0`), starts no unit past the start window and settles every started
  `exec` (no dangling promise); and `makeFoldExecutor` maps `{positions,confidence,stats}` →
  `{signals,confidence,stats}` with the request passed through verbatim. Two latent rows. **L10-ce**:
  `normaliseConcurrency` never validates its `max` cap — `{max: 0}` → **0**, `{max: −2}` → **−2**,
  `{max: 2.5}` → **2.5** (a non-positive/fractional "concurrency"; not reachable via `scheduleUnits`). **L10-cf**:
  `makeFoldExecutor` throws on a bad `positions` but **silently nulls** a non-array `confidence` (5, a
  `Float32Array`) and any falsy `stats` (0, missing) — a worker switching to a typed-array confidence would
  silently lose the R26-3 raw pre-policy confidence. No fold-back row. `run_all` is now **75 steps, 44 gated,
  0 fails**.
 CYCLE-060 (F-76) audited the **turnover policy grid** — `analysis/holding.js` (shipped; `analyze.js` imports it
  as `runTurnoverSweep` behind `--turnover-sweep`, calling it with the run's `costBps` and
  `decisionOptions: { requireCleanAudit: audit, … }`). `e68_holding_audit.js` (**8/8 guards**, 45 ms) confirms
  the grid is the cartesian product `deadZones × scales × holdings` (3×1×3 → `policies` 9, `rows` 18 for two
  candidates; each policy `{...holding, deadZone, scale}`); every row's
  `turnover`/`grossPnl`/`netSharpe`/`breakEvenCostBps` equals a direct `restateReportAtPolicy(candidate, policy)`
  recompute to **1e-9**; rows are non-increasing in break-even with a missing value last, `byId.best` is the
  highest-break-even row and `bestPromoting` the highest-break-even promoting one, `bestTurnoverPolicy` prefers
  promoting and returns `null` for an unknown id; the two bail-outs return `available:false`; and
  `formatTurnoverSweep` renders the ids and the target. Three latent rows. **L10-cg**: `turnoverSweep` accepts and
  echoes `costBps` but **never threads it into `restateReportAtPolicy`**, so every `netSharpe`/`dsr` and every
  promotion decision is at **zero cost** — `{costBps: 0}` and `{costBps: 25}` rows are byte-identical apart from
  the echo (both `netSharpe` **0.6864950785702724** at dz 0.1) while a direct restatement at 25 bps reads
  **−3.156645069841796** (the shipped caller passes `--cost-bps`). **L10-ch**: the `requireCleanAudit` hurdle the
  caller passes is **structurally inapplicable** because `restateReportAtPolicy` drops the `audit` block (unlike
  `restateReportAtCost`), so a candidate that **failed the look-ahead audit** still promotes (row `promote: true`;
  rebuilt with the audit attached it correctly fails). **L10-ci**: `DEFAULT_TURNOVER_GRID` is only **shallowly**
  frozen (`Object.isFrozen(deadZones)` false) — `deadZones.push(0.9)` takes the default sweep 48 → 54 policies.
  No fold-back row. `run_all` is now **76 steps, 45 gated, 0 fails**.
 CYCLE-061 (F-77) audited the **seed-replication layer** — `analysis/replication.js` (shipped; `analyze.js` imports
  `seedDistribution`/`formatSeedReplication` behind `--seeds`, aggregating a multi-seed run into `replication.json`).
  `e69_replication_audit.js` (**8/8 guards**, 359 ms) confirms `interquartileMean` is the rank-slice middle on every
  hand case (`[1,2,3,4]` → **2.5**, `[1..8]` → **4.5**, `[]` → NaN, `<4` → plain mean, non-finite filtered);
  `stratifiedBootstrapCI` is deterministic per seed, seed-sensitive, preserves each stratum size in every replicate
  (a probe statistic = the sample length), returns `lo ≤ median ≤ hi` and abstains on empty/all-non-finite; its
  empirical coverage of a known mean is **0.92** (400 panels, nominal 0.95); `varianceComponents` satisfies
  `total = between + within + residual` (1e-9) with the fractions summing to 1 in the pure-between-seed,
  pure-within-seed, repeated-cell and mixed panels; `pairedVarianceRatio` is exactly
  `var(paired)/var(unpaired)` with `reduction = 1 − ratio`, abstaining on short / zero-unpaired-variance input; and
  `seedDistribution`/`formatSeedReplication` carry/render the documented fields. Two latent rows. **L10-cj**: the
  **IQM** drops `floor(n/4)` by **rank**, not a quarter of the **mass** — witness `[0,0,5,10]` reads **2.5** vs the
  cited Agarwal et al. / `rliable` quantile-filter **1.6667**, and **149/300** right-skewed panels differ (max gap
  **1.016**). **L10-ck**: `formatSeedReplication` prints its **own** `alpha` in the CI label, never `dist.ci.alpha`,
  so a distribution built at `alpha = 0.10` is printed as **`95%CI`** (bounds the 90 % ones; the shipped path is
  consistent only because it uses the default 0.05 throughout). No fold-back row. `run_all` is now **77 steps,
  46 gated, 0 fails**.
 CYCLE-062 (F-78) audited the **cluster-inference module** — `analysis/dependence.js` (shipped; `walkforward.js`
  `promoteDecision` uses `pairedClusterTest`/`clusterStability`/`pairedClusterSignTest`; pure and imports nothing).
  `e70_dependence_audit.js` (**10/10 guards**, 47 ms) confirms `pearsonCorrelation`/`meanPairwiseCorrelation` are the
  textbook formulas with the documented NaN guards; the equicorrelation deff/effective size are `1+(K−1)ρ` and
  `K/deff`; `foldWindowClusters` groups exactly (cluster f = every stream's fold f) and throws on a bad panel;
  `clusterJackknife` reproduces a hand delete-one-cluster jackknife (estimate 3.5, leave-one-out [4.5,3.5,2.5],
  se √(4/3)); `studentTPValue`/`regularizedIncompleteBeta` reproduce the exact df = 1 (Cauchy) and df = 2 closed
  forms, and `studentTCritical` inverts them (1.68957 / 2.03011 at df = 35); `signTest` is the exact binomial tail
  (`7/10` → 0.171875); and the paired cluster tests carry the documented fields. Two latent rows. **L10-cl**:
  `clusterStability.stable` omits the `worstDelta > minDelta` half of its own documented rule (witness
  fractionPositive **0.6667**, worstDelta **−0.5**, `stable: true` where the doc rule says false; the two coincide
  only at the shipped `minFraction = 1`). **L10-cm**: `signTest`'s `0.5ⁿ` pmf start underflows for `n ≥ ~1075`, so
  `{wins: 1000, n: 2000}`, `{wins: 1, n: 2000}` and `{wins: 2000, n: 2000}` all read **pValue 0** (a balanced
  2 000-cluster test reading "certainly significant") while `{wins: 500, n: 1000}` reads 0.5126. No fold-back row.
  `run_all` is now **78 steps, 47 gated, 0 fails**.
  CYCLE-063 (F-79) audited the **decision-grade report** — `analysis/decision.js` (shipped; `analyze.js` composes
  `foldConcentration`/`confidencePersistence`/`nextRunPlan`/`decisionReport`/`formatDecision`/`promotionAcrossCadences`
  behind `--decision`; pure, no I/O, no RNG). `e71_decision_audit.js` (**10/10 guards**, 34 ms) confirms
  `foldConcentration` reproduces a direct `strategyReturns`+`sharpeRatio` recompute (top-K shares, signed sums,
  delete-one-cluster range with the right worst/best index, per-fold marginals) and abstains with explicit na
  blocks (a non-positive gross total gives a **null** share); `confidencePersistence` is the pooled within-fold
  lag-1 (**0.666707822740828**) and `ln 0.5/ln ρ` half-life (no cross-fold pairs); `pairedUnitsNeeded` returns the
  smallest cluster count whose one-sided cluster-t resolves the target (**9** observed / **18** at 80 % power;
  brute-force agreement) with `reference.pairedMde95 = tCritical(C−1,α)·se`; all six `cheapestFlip` kinds fire;
  `promotionAcrossCadences` is majority-pass + catastrophic veto; and the six-block `decisionReport` carries the
  explicit-na discipline (`schema 'nl.decision.v1'`). One latent row. **L10-cn**: `restateReportAtPolicy` replaces
  `folds` with restated-position metrics but carries the original `foldInputs`, so a policy-restated report handed
  to `foldConcentration` mixes two position-series bases (restated net Sharpe **−5.201698358740081** vs the
  carried-signal Sharpe **−3.5204429235768973**); the shipped `--decision` path restates at cost only (both
  halves agree at **−3.877740023296727**), so it is latent/export-level. No fold-back row. `run_all` is now
  **79 steps, 48 gated, 0 fails**. **No pure, lab-consumed analysis module remains un-audited.**
  CYCLE-064 (F-80) turned the technique on the **model itself** — the five pure kernel bags under
  `hivemind/kernels/` (`activations`, `linalg`, `normalization`, `sampling`, `statistics`; SHIPPED via
  `gradients.js`/`transformer/*`, installed on `HiveMind.prototype`). `e72_hivemind_kernels_audit.js`
  (**11/11 guards**, 18 ms) confirms the finite path is exact (silu/sigmoid/softmax, the linalg helpers, RMSNorm,
  RoPE, the Irwin-Hall normal, the Dirichlet sampler, the MAD proxy and the gradient/spectral/percentile
  helpers). Four latent rows. **L10-co**: `_sigmoid`/`_silu` map `+Infinity` to **0** (the `isFiniteNumber` guard
  short-circuits the `±100` clamp, so a maximally-positive logit reads as probability 0). **L10-cp**: the
  falsy-zero family — `_computeGradientNorm`/`_computeSpectralNorm` return **1** for the zero vector/matrix and
  `_computePercentile` returns **1.0** for a genuine 0. **L10-cq**: the vector helpers disagree on a length
  mismatch (`_fastVectorDot` → NaN, `_vectorDot` → 0, `_fastVectorAdd` → a copy of `a`). **L10-cr**: two dead
  clamps (`_computeDualEMA` 0.8, `_computeNTKStability` −0.1) and `_computeFractalDimension` not a fractal
  dimension. No fold-back row. `run_all` is now **80 steps, 49 gated, 0 fails**.
  CYCLE-065 (the operator's 2026-09-26/27 run corpus) is a **read-only cross-check** (`RUN-CROSSCHECK.md`,
  no experiment). CYCLE-066 (F-81) is the **port verification** — the first cycle where the REPO's V2 code
  must reproduce the LAB, not the other way round. `e73_port_verify.js` imports the repo's
  `core/primitives/*` + `plugins/sleeves/*` read-only, rebuilds the lab's real 6 557-period carry panel, and
  drives each sleeve through its `signal()`/`returns()`: all three published books come back **bit-for-bit**
  (R8 `6.18 / 10× / 46.04`, R7 `1.07 / 8× / 182.59`, OI `0.92 / 198× / 15.22`), and the repo's `cleanBook` is
  **fingerprint-identical** to `prototypes/port.js`. The exercise exposed a lab-internal ambiguity, **L10-ct**:
  the two construction shells read **different** arrays off the same `buildXsSeries` result (`e17#buildBook`
  uses `legs.times.length` = 6558 → 6557 rows; `e21#xsBookImpl` is handed `times.length` = 6557 → 6556 rows),
  so the V2 primitives take the book grid as an explicit `n`. The randomized half added in the R31c coherence pass then drove every ported primitive against the lab module it was ported from on **250 seeded random panels** (`fuzzBooks`/`fuzzWeights`/`fuzzMisc`) → **zero divergences**, so `e73` now reports **10/10** checks (the step count is unchanged). Read-only; no number moves, no fold-back row.
  `run_all` is now **81 steps, 50 gated, 0 fails**.

## Code (`lib/`, `prototypes/`, `experiments/`, `results/`, `data/`)

* `lib/lab.js` — the measurement harness. Loads candles, aligns panels, scores with the repo's own
  `analysis/*`. **The only place numeric plumbing lives.**
* `prototypes/signals.js` — cross-sectional and sizing primitives the repo lacks. More prototypes are
  added per lead as they need them.
* `prototypes/port.js` — the **port artefact** (F-60): the shared book post-processing (`clipWeights` +
  `bandWeights` + `cleanBook` = cap-then-band) that reproduces all three sleeves' books, plus `SLEEVE_SPECS`
  and `MIN_TRAIN_PERIODS = 2555` (the F-49/F-55/F-59 ~2.3 y frozen-parameter rule). Validated by `e52`.
* `experiments/` — one file per experiment, each `export async function run(options)`. `run_all.js`
  regenerates every artefact in one pass (**145 steps, ~8–25 min** depending on machine load; `e0d` alone
  is ~140–610 s). `e14_data_integrity.js` is a suite of regression tests, not a measurement (now **14
  checks**) — its `pass` is reported beside the controls'. `e25_maker_fill.js` supplies the reusable execution primitive
  `fillSelection()` (passive/maker fill replay) whose taker arm must reproduce `e24`'s reversal book;
  `e26_meta_label.js` supplies the reusable OOS classifier `causalOos()` + `fitLogisticFlat()` (purged
  expanding-window meta-label test); `e27_decay.js` supplies the reusable decay test (block-Sharpe trend
  with a permutation null) and validates itself against `e23`'s books; `e28_regime_retune.js` re-audits a
  policy family on a chosen window, and `e29_regime_retune_oos.js` supplies the reusable **walk-forward
  selection** test (pick a parameter by trailing score, trade it forward, compare to pinned policies) with
  a gross-blind control; `e30_retuned_capacity.js` measures both size bounds for a weight family (impact
  via `e19#capacityOf`, open interest via `e21`'s construction); `e31_ported_spec_oos.js` runs the joint
  (λ, cap) walk-forward + fee-stress that produced the port-ready R8 spec; `e32_fade_retune.js` applies the
  same machinery to the L18 fade (and exports `e22#buildMasked` as a reusable primitive);
  `e33_oi_capacity_distribution.js` restates the OI capacity as a **distribution** — it reports the
  published ratio-of-means, the true mean-of-ratios and the true min-of-ratios side by side, plus the
  time-varying bound `G_t = f·min_j OI_j(t)/|w_j(t)|`, the participation the published size implies period
  by period, and the capacity during stress, with guards on the published convention;
  `e34_oi_scaled_sizing.js` sizes each book to a mean gross of 1 and compares seven causal sizing
  *policies* (`const_trail_p5`, `const_trail_min`, `clipped_trail_median`, `scaled_full`, `scaled_half`,
  `scaled_ewma`, `placebo_shuffle`) by mean deployable size, breach, dollar Sharpe and drawdown; it also
  made `e19#turnoverAndCost` an exported primitive (per-period turnover, cost and traded dollars for a
  weight-row series); `e35_portfolio_mix.js` builds the two final port-spec books on one return-interval
  alignment, reports the mix net@4 ladder and a walk-forward allocation rule, and measures each book's
  **individual** OI schedule against the **joint** schedule of the combined weights (the portfolio-level
  capacity object), guarding each individual mean against `e34`'s stored `meanGcap`;
  `e36_portfolio_oi_frontier.js` solves the exact joint-capacity LP per period (`lpFrontier`, vertex
  enumeration including the axis vertices — exported), reports the frontier distribution, the optimal
  split, and the LP-scheduled book's churn/net Sharpe, and reuses `e35#buildPair`;
  `e37_oi_signal_rescue.js` rebuilds the `e21` Δlog(OI) book (`e21#xsBookImpl`, exported) under an EWMA λ
  ladder, audits each with `e16`, runs the F-37 walk-forward λ-selection and a fee stress, and guards the
  daily book against `e21`'s stored `dLogOI_pos`;
  `e38_oi_signal_holdout.js` runs L19's pre-registered falsifier — it scores the sign+1 / λ∈{0.1, 0.25}
  books on the pre-2024 vs post-2024 calendar split, runs the regime-λ selection and the F-36 block-trend
  decay test, compares the rank construction, checks the L18 / toptrader / momentum confounds, reads the
  book's OI schedule, builds a fixed (unfitted) 50/50 cross-scale blend, and guards the daily book against
  `e21`'s stored `dLogOI_pos`;
  `e39_oi_portfolio_add.js` answers whether the L19 OI stream *adds to R8* — it aligns the blend onto the two
  port-spec books (`e35#buildPair`), runs the capital and risk-normalised mix ladders + walk-forwards, solves
  the per-period **3-D joint OI LP** (`lp3`, vertex enumeration over the 2k+3 constraint planes), reports the
  optimal OI share, the LP-scheduled churn and the all-three-at-individual-sizes breach, and guards `e34`'s
  OI means and `e36`'s 2-D LP;
  `e40_retune_blend.js` tests whether R8's walk-forward λ *rule* is needed — it builds the R8 λ family (rank
  funding + EWMA + 12.5 % cap), forms **fixed equal-capital blends** over five pre-registered sub-sets, and
  compares them with the λ-only walk-forward on one shared OOS span, guarding the pinned λ=0.02 book against
  `e30`'s full-history Sharpe and `e31`'s OOS net@4;
  `e41_blend_hindsight.js` then tests whether that simplification survives **without hindsight** — a frozen-λ
  ladder (pick λ once on `[0,S)`, freeze, score `[S,end)`), a 10-blend no-hindsight menu, and a
  blend-selection walk-forward, guarding the rebuild against `e40` exactly;
  `e42_cap_hindsight.js` then removes the last fitted object — it rebuilds the 40-book (λ, cap) grid, runs
  the joint (λ, cap) walk-forward, a frozen combined / frozen-λ / frozen-cap ladder, and the cap-sensitivity
  and cap-binding reads, guarding the rebuild against `e31` exactly;
  `e43_fade_pinned.js` then runs that same chain on **R7** (the fade) — it rebuilds e32's fade (λ, cap) grid,
  runs the joint (λ, cap) walk-forward, a frozen-cap / frozen-λ / frozen-joint ladder, and the λ-flatness
  and cap-sensitivity reads, guarding the rebuild against `e32` exactly;
  `e44_cap_mechanism.js` decomposes the cap's benefit — it rebuilds the R8 λ=0.02 book, applies the 12.5 %
  clip and a swept **no-trade band**, and compares gross/net Sharpe, turnover, concentration (max `|w|`) and
  both OI capacities (ratio-of-means and min-of-ratio) at matched turnover, guarding the rebuild against
  `e30` exactly;
  `e45_fade_cap_mechanism.js` runs the same decomposition on **R7** (the fade) — it rebuilds the fade λ=0.05
  book, applies the clip and the swept band, and reads the same metrics, guarding the rebuild against `e32`
  exactly;
  `e46_cap_shrinkage.js` closes the mechanism thread — it applies a hard clip, a smooth saturation, a power
  shrink and an equal-weight control to the R8 λ=0.02 rows and reads net/turnover/concentration, guarding
  base/`hard_0.125` against `e30` exactly;
  `e47_split_robustness.js` challenges the split points themselves — it builds the R8 λ-ladder, sweeps a
  **dense** split grid under a rolling-1-year and an expanding `[0,S)` freeze, and compares the frozen book
  to the in-sample-best pinned book, guarding `e30` exactly;
  `e48_oi_construction.js` closes L19's construction thread — it builds the cross-sectional Δlog(OI) books
  and compares a fixed non-equal two-scale mix, a `hold-N` cadence and a **no-hindsight** inverse-vol mix,
  guarding both `e21#dLogOI_pos` (daily) and F-46's `e38` 50/50 ensemble exactly;
  `e49_hold_drift.js` stresses the `hold-N` claim — it sweeps a **fine** hold grid and runs a **drift-aware
  true-hold** simulation (weights drift between updates, traded back only at updates), guarding `e21` and
  F-46's `e38` ensemble exactly;
  `e50_oi_band.js` ports the F-52/F-53 **no-trade band** onto the OI sleeve — it sweeps a band `eps` grid and
  compares the net@4-vs-turnover curve to the hold-N grid at matched turnover, guarding `e21` and F-46's
  `e38` ensemble exactly;
  `e51_band_holdout.js` gives the band the dense-split holdout — it picks `eps*`/`N*` in-sample, freezes them,
  and scores forward, guarding `e21` and F-46's `e38` ensemble exactly;
  `e52_port_artefact.js` validates the port module — it rebuilds each sleeve's raw rows (R8/R7/OI) and applies
  **`prototypes/port.js` only**, checking the outputs against `e30`, `e32`, F-52's band/stack and `e50`;
  `e53_carry_grid_audit.js` audits the **repo's own** funding→bar-grid join — it measures
  `analysis/carry.js#carryOnBarGrid` against a synthetic ground truth (8h/4h/2h/1h funding), finds the
  shipped-built SOLUSDT sub-8h (FTX) window understated **3×** and `auditFundingProblems` blind to it, and
  reads the pooled 8h sleeve shipped vs bucket-summed (guarding F-61);
  `e54_dependence_audit.js` audits the repo's **dependence/DSR backbone** against closed forms — it builds
  synthetic equicorrelated / identical / negatively-correlated / i.i.d. panels with known design effects,
  ensembles `dependenceSummary` over seeded trials, measures the estimator's own noise at C = 36 vs C = 288
  folds, and probes the `effectiveBars = n/DE` bound with a hedged pair, handing the result to
  `backtestMetrics` (guarding F-62, settling L10-f/L10-i);
  `e55_split_audit.js` audits the **purge/embargo contract** — it checks `purgedKFoldSplit` and
  `combinatorialPurgedSplit` for zero label-window leakage on a synthetic overlap grid, then counts the
  leak edges of `walkForwardSplit` against the closed form `H(H−1)/2` per fold, probes the fold metadata,
  the causality guard and the label-argument path, and measures the leak's exploitability with an
  index-lookup model over seeded worlds (guarding F-63).
  `e56_labels_audit.js` audits the **labelling / event-sampling / fractional-diff module** — it checks
  `tripleBarrierLabels`' first crossing against `ceil(level/step)` on 192 monotone cases and its three-way
  `ret` / first-crossing / timeout-index contracts on 60 seeded random paths, matches `cusumFilter` to an
  **independent** drawup/drawdown formulation of its reset rule, verifies `fractionalDiffWeights` against
  the binomial closed form (integer `d` exactly, non-integer `d` via an independent Lanczos-`Γ`), probes the
  `pt`-before-`sl` tie-break, the default event set, the `events` argument and the auto-window rule, and
  checks the **shipped** `fracDiffAt`/`fracMomentum` against the weights convolution (guarding F-64).
  `e57_overfitting_audit.js` audits the **PBO / CSCV module** — it checks `cscvBlocks`' partition,
  `cscvSplit`'s `C(S,S/2)` split count / disjoint cover / block multiplicity / complement closure / cap,
  `relativeRank`'s best/worst/tie formulas, and `oosOnIsRegression` against an **independent sum-formula
  OLS**, builds exact constructed PBOs (all-flat, one dominant, an anti-persistent pair, a hand-computed
  metric override), reproduces the repo's quoted calibration draw (**117/252**) with its own RNG, ensembles
  60 i.i.d. matrices to measure the estimator's own spread (sd 0.2546 vs a binomial 0.0315 → design effect
  **65.4**), and probes the `relativeRank` NaN path, the fully-tied convention, the `degradation` `n` and
  the `cscvBlocks` degenerate case (guarding F-65).
  `e58_reality_check_audit.js` audits the **resampling hub** — it replays `stationaryBlockIndices` against
  the rng stream (b = 1 → i.i.d. with replacement; the geometric restart law; mean run length) and measures
  the restart rate, checks `neweyWestSE` against an **independent Bartlett** implementation / slice
  invariance / the default bandwidth, ports `arch.bootstrap.base._single_optimal_block` (from its source) to
  compare the **Politis-White selector** and rebuilds the arch AR(1) reference vector from an
  **independently implemented NumPy legacy-RandomState stream**, checks the RC/SPA closed forms, the exact
  consistent-recentring bound, the bit-equality of the step-down's first step with the consistent SPA, the
  one-shared-reference property of the subsampling family, its determinism and its segment awareness, and
  re-measures the RC/SPA/subsampling sizes against the block bootstrap across the persistence sweep
  (guarding F-66).
  `e59_forecast_audit.js` audits the **shipped forecast scoring layer** — it checks `forecastPairs` against
  the `confidenceFromProb` inverse + next-bar sign + fold-last-bar drop + non-finite skip, the
  `brierBinIndex`/`brierScore`/`logScore` closed forms (with the eps clip and NaN handling), the Murphy
  decomposition **against the repo's own independent second implementation**
  (`observer/legion_metrics.js#brierDecomposition`, agreeing to 1e−12) and the exact raw-minus-binned gap
  identity `gap = withinVar − 2·withinCov` (to 1e−12), `bootstrapMeans`' determinism / default block /
  paired index draw, the DM statistic against an independent reconstruction (incl. the degenerate arms and
  a 400-rep i.i.d. size battery), the MCS structure (sample-best retention over 4 ensembles × 200, near-nominal
  coverage, an independent HLN elimination-denominator comparison over 150 configs), and the
  `forecastComparison` grouping / skill formulas / alignment guard (incl. the 6 count-coincident
  misalignment witnesses) (guarding F-67).
  `e60_race_audit.js` audits the **successive-halving racing engine** (engine-only, `analysis/race.js`) — it
  checks the round count against its closed form and guards, the schedule's `keep` / monotone budgets / top
  rung / early stop, and the engine's arm order, `nonFinite` elimination, `maximize:false` selection,
  sync-vs-async equality, tie stability, cost-counter reconstruction and guards; it **replaces the fixture's
  budget-independent oracle test** with a budget-dependent evaluator to measure the disagreement the
  docstring's "decided set" claim denies, sweeps the budget expenditure against a full grid, and instruments
  the small-`eta` rung collapse (guarding F-68).
  `e61_benchmark_audit.js` audits the **shipped P1 model-class benchmark** (`analysis/benchmark.js`) — it
  checks the standardiser (zero-mean/unit-std, a collapsed constant column, the empty-input shape),
  `fitRidge`'s closed form against an **independently solved** centred ridge, the unpenalised intercept,
  `predictRidge`'s `(0,1)` range and the `standardise:false` path, `fitBaseRate` = the training prior, the
  ridge/MLP separable-rule accuracy, MLP byte-determinism, `BENCHMARK_KINDS` + the `tsfm`/unknown-kind
  refusals, and a perfect classifier beating the base rate on Brier; then it **instruments the output map** —
  the dead training-base-rate term in `predictRidge`, the sigmoid band cap on the linear arm's probability,
  the unverified "hand solve" claim and the eps constant-column amplification (guarding F-69).
  `e62_backtest_audit.js` audits the **measurement layer** (`analysis/backtest.js` + its instrument
  `analysis/performance.js`) — it checks the instrument's error bounds and identities against **independent
  references** (Simpson quadrature for `erf`; a Lentz-erfc reference for the normal tail; a hand recompute of
  the Lo SE, PSR, the expected-max closed form and MinTRL; a 1000-series size-calibration battery for the
  stationary bootstrap), the backtest arithmetic against independent recomputes (positions, turnover,
  gross/cost/net, equity, drawdown, tradeCount, the break-even identity, a `poolFolds` restatement and the
  serial↔concurrent byte-identity), and then instruments the **hit-rate criterion** (`r === 0` where the
  docstring promises "no position", with exit-cost bars counted as misses), the **fold scorer's within-slice
  re-lag** and the **NaN-sharpe → `beyond-horizon`** mislabel (plus the disproof of the negative-MinTRL lead by
  Pearson's inequality) — guarding F-70.
* `e63_features_audit.js` audits the **causal signal family** (`analysis/features.js`) — it checks the
  **causality contract** for all 16 candidates (a strict-future perturbation of closes/returns/volumes/panel
  leaves `positionAt` bit-unchanged; 0 mismatches over 16×100 bars, non-vacuous), the **abstain contract**
  (returns-only view → 0 on exactly the five channel-dependent candidates; degenerate series finite in [−1,1];
  `clampPosition` exact), 13 single-feature references exact to 1e-12 (with `fracDiffAt` also equal to the
  shipped `labels.js#fractionalDiff` convolution), the cross-section and the regime gate against independent
  recomputes, and then pins the **zero-dispersion guard's defeat by rounding** (an exactly-constant window reads
  `|z| = sqrt((n−1)/n)`, not 0 — the L10-bs headline), the `finiteSum` empty-range 0 vs `meanOf` NaN,
  `networkMomentum`'s self-inclusion without `streamIndex`, and the regime gate's window mis-scale — guarding
  F-71 and settling L10-e.
* `e64_uniqueness_audit.js` audits **sample uniqueness** (`analysis/uniqueness.js` — the López de Prado ch.4
  reference: average uniqueness, ESS, sequential bootstrap). It checks `sampleUniqueness` against an
  **independent per-bar scan-all-spans** recompute (1e-12) and against the **shipped** `overlapUniqueness`
  (exactly 0 on 8 fixtures), per-label order-invariance, and the ESS identities; then it pins the sequential
  bootstrap's **draw law** — the weight is the uniqueness **sum** (`avgU[i] = acc`), not the average, so two
  non-overlapping (maximally unique) labels are drawn in the ratio of their lengths (L10-bx: measured 0.7480
  vs the intended 0.5000), and the implemented heuristic (static numerator + `1/(1+count)`) is **not** the
  AFML ch.4 bootstrap it cites (L10-by: second-draw TV gap **0.1190**), with unvalidated spans returning
  NaN/−0 (L10-bz) — guarding F-72.
* `e65_streams_audit.js` audits the **stream design layer** (`analysis/streams.js` — shipped; `analyze.js`
  prints it): the resampler against a hand recompute + the OHLCV invariants, the Kish identities
  (`rawBars = K*T`, `DE = 1+(K-1)*rbar`, `effectiveBars = rawBars/DE`, `effectiveStreams = K/DE`), the closed
  forms, the `fold-sharpe`-iff-tiles rule and the selector contract; then it pins the **constant-stream
  inflation** (a zero-variance stream is skipped from `rbar` but counted in `K`/`rawBars` — rbar bit-identical,
  effectiveStreams 2.0270 -> 3.0821) and `maxStreams <= 0` = unlimited — guarding F-73.
* `e66_world_audit.js` audits the **audited evaluation world** (`analysis/world.js` — shipped; the module that
  gives `auditNoLookahead` its teeth): the shock factor bounds/phase shift, `shockCandles`' identity/scaling/
  non-uniformity, the view's base+probe contracts (self-consistency, past-unchanged, future-moved) and the
  panel attachment; then it pins the **missing-`streamIndex` vacuous audit** (the panel's own slot is never
  replaced, so a cross-sectional candidate reads an unperturbed series) and the `maxBars <= 0` slice flip
  (0 = all bars; −5 drops the first 5) — guarding F-74.
* `e67_parallel_audit.js` audits the **order-preserving scheduler** (`analysis/parallel.js` — shipped; the
  serial/parallel byte-identity claim rests on it): the concurrency normaliser's serial/floor/cap contract, the
  queue contract (unit order under out-of-order completion, exactly-once exec, the in-flight bound, best-effort
  `onResult`), the failure semantics (first error wins, no new start after it, every started unit awaited, sync
  throws propagate) and the fold executor's reply adaptation; then it pins the **unvalidated `max`** cap and the
  **silently-nulled `confidence`/`stats`** — guarding F-75.
* `e68_holding_audit.js` audits the **turnover policy grid** (`analysis/holding.js` — shipped; `analyze.js` runs
  it as `runTurnoverSweep` behind `--turnover-sweep`): the cartesian grid construction, each row against a direct
  `restateReportAtPolicy` recompute, the break-even ordering / `byId` / `bestTurnoverPolicy` readout, the two
  bail-outs and the formatter; then it pins the **dead `costBps`** (echoed, never threaded — the rows are
  cost-free), the **unreachable `requireCleanAudit` hurdle** (the restatement drops the `audit` block, so a
  dirty-audit candidate still promotes) and the **shallow-frozen default grid** — guarding F-76.
* `e69_replication_audit.js` audits the **seed-replication layer** (`analysis/replication.js` — shipped; the
  honest-summary module behind `--seeds`): the IQM contract, the stratified bootstrap's determinism / size
  preservation / abstentions and its empirical coverage, the variance-decomposition identities, the CRN
  `pairedVarianceRatio` arithmetic, the `seedDistribution` structure and the formatter; then it pins the **IQM
  that is not the cited Agarwal estimator** (rank-slice vs quantile-filter) and the **CI label that can lie**
  (the formatter prints its own `alpha`) — guarding F-77.
* `e70_dependence_audit.js` audits the **cluster-inference module** (`analysis/dependence.js` — shipped; the
  delete-one-cluster jackknife behind the pooled cross-stream Sharpe SE; pure and imports nothing): the
  correlations and their NaN guards, the equicorrelation identities, the fold-window grouping, the jackknife
  against a hand recompute, the Student-t tails against the exact df = 1/2 closed forms, the critical-value round
  trip, the exact sign test and the two paired cluster tests; then it pins the **stability flag that drops half
  its rule** and the **sign test that underflows** — guarding F-78.
* `e71_decision_audit.js` audits the **decision-grade report** (`analysis/decision.js` — shipped; the six-block
  report behind `--decision`; pure): `foldConcentration` against a direct `strategyReturns`+`sharpeRatio` replay,
  `confidencePersistence`'s pooled within-fold lag-1 and half-life, `pairedUnitsNeeded` against a brute-force
  minimal-n search, all six `cheapestFlip` kinds, the `promotionAcrossCadences` majority/veto rule, and the
  `decisionReport`/`formatDecision` shape; then it pins the **policy restatement that mixes two position-series
  bases** — guarding F-79.
* `e72_hivemind_kernels_audit.js` audits the **hivemind numeric kernels** (`hivemind/kernels/*` — SHIPPED; the
  model's pure math primitives, installed on `HiveMind.prototype`): the activations (silu/sigmoid/softmax), the
  linalg helpers, RMSNorm / RoPE / semantic normalization, the samplers, and the statistics helpers (the MAD
  proxy, EMA, conformity, percentile/threshold, gradient/spectral norm, the stateful drop/stagnation detectors);
  then it pins the **`+∞` activation that reads as 0**, the **falsy-zero family**, the **length-mismatch
  divergence** and the **dead clamps / mis-named fractal dimension** — guarding F-80.
* `e73_port_verify.js` is the **port verification** (the repo must reproduce the lab, not the reverse): it
  imports the repo's `core/primitives/*` + `plugins/sleeves/*` **read-only**, rebuilds the lab's real
  8-symbol / 6 557-period carry panel (`e12#buildXsSeries`), drives each sleeve through its
  `signal()`/`returns()`, and checks the rows bit-for-bit, the returns, and the stored metrics against
  `e30`/`e32`/`e50`; it also fingerprints the repo `cleanBook` against `prototypes/port.js`. All ten checks
  pass (the three books and the chain fingerprint **plus** a 250-trial seeded differential fuzz of every ported primitive against the lab module it was ported from; guarding F-81, and registering **L10-ct**, the two-array book-grid ambiguity).
* `results/` — measured JSON artefacts, written by the experiments. `RUN_SUMMARY.json` records the
  last full regeneration (timestamps, per-step ms, control and integrity `pass`).
* `data/` — durable samples of fetched/derived data that must survive `scratch/` being wiped. Kept
  compact (derived series, not raw dumps). **Every join between two data files has a regression test
  in `e14`** — they were all silent join bugs.

## Cycles (`cycles/`)

One file per research cycle, numbered, never deleted. `CYCLE-000.md` is the founding session
(F-01…F-12). Each cycle states its goal, the hypotheses it tested, what it changed, what it
concluded, and what is now false that used to be believed.

| cycle | goal | outcome |
| --- | --- | --- |
| [000](cycles/CYCLE-000.md) | founding sweep: measure the frontier | F-01…F-12; 5 leads closed |
| [001](cycles/CYCLE-001.md) | build the lead library | 13 leads registered, runner/protocol/map written |
| [002](cycles/CYCLE-002.md) | challenge L01 through the repo's own aggregation; verify the ledger | F-13/F-14 added, F-10 corrected, L10-c closed |
| [003](cycles/CYCLE-003.md) | open the frontier: harvest order flow (L07 probe 1) | F-15: flow is independent but directionless; data stored |
| [004](cycles/CYCLE-004.md) | volatility predictability & sizing (L09) | F-16: EWMA forecastable; carry DD 10.2→0.7 %, DE 234→24 |
| [005](cycles/CYCLE-005.md) | cross-sectional carry dispersion (L12) | F-17: Sharpe 6.1 vs 0.96, DD 1.6 %; carry window is only 2.9 y |
| [006](cycles/CYCLE-006.md) | extend the carry window through the crashes (the F-17 caveat) | F-18…F-21; **four silent bugs fixed**; L11 un-parked; all carry numbers revised |
| [007](cycles/CYCLE-007.md) | is the carry complex tradable, or a mark-price construction? (L14) | F-22: **suspicion falsified** — traded leg moves nothing; L14 closed; R4/R8 un-gated |
| [008](cycles/CYCLE-008.md) | cost audit: can the carry complex be traded, or only measured? | F-23: dispersion/reversion **cost-fragile** (break-even 1.9–3.5 bps, 465–803×/yr turnover); flat book cost-robust; R8 re-gated; L15/L16 opened |
| [009](cycles/CYCLE-009.md) | low-turnover dispersion: can the rank signal be harvested cheaply? (L16) | F-24: **EWMA(0.1) weights** cut turnover 803×→85×/yr, break-even **12.78 bps**, net@4 **+3.55**, 7/9 regimes; R8 un-gated with the smoothed spec; L16 closed |
| [010](cycles/CYCLE-010.md) | does smoothing rescue the reversion book too? (L11) | F-25: pure convergence leg **unrescuable** (smoothed 9.15→2.66); timed-carry rescuable but net Sharpe 4.05 < flat 4.54 → drawdown overlay, not alpha; L11 closed |
| [011](cycles/CYCLE-011.md) | capacity/impact: what size can the carry complex carry? (L15) | F-26: harvested perp flow; dispersion capacity **$13 M** (Y=1, 4 bps), timed-carry **$95 M**, flat hold not impact-limited, DOGE binds (~1 % ADV); L15 closed, L17 opened |
| [012](cycles/CYCLE-012.md) | capacity-aware weighting: can the dispersion capacity be raised? (L17) | F-27: a **strict per-symbol cap 12.5 %** doubles capacity ($13.2 M→**$26.7 M**), turnover 85→35×, DD 0.94→0.47 %, regimes 7/9→8/9; soft cap buys nothing; <1/k degenerate; L17 closed |
| [013](cycles/CYCLE-013.md) | open interest: a signal, and the flat book's size limit (L07 probe 2) | F-28: Δlog(OI) next-8h IC **0.020** (contemporaneous 0.595 — a fixed look-ahead); OI caps the flat hold at **$6.9 M/$34.3 M/$68.6 M** → whole carry complex ~**$5–70 M**. Challenging the verdict exposed **F-29**: the toptrader ratio cross-sectionally fades to net@4 **+0.77** (break-even 15.1 bps) → new lead L18; two silent bugs fixed (L10-q/L10-r) |
| [014](cycles/CYCLE-014.md) | validating the toptrader fade: held-out, cost, confound, capacity (L18) | F-30: the fade passes all four tests — held-out (halves net-positive, opposite sign loses both), smoothing (EWMA 0.1: turnover 126×→**23×/yr**, break-even **15→74 bps**, net@4 **+0.79**), not funding (H2 unstable), OI capacity $8–10 M; L18 validated |
| [015](cycles/CYCLE-015.md) | combining the two independent cross-sectional streams (L18 × L12) | F-31: corr(topLS, carry dispersion) **−0.001**; a 25 % toptrader allocation turns the carry book's decayed net@4 second half **−0.12→+0.75** (combined net@4 +1.38, both halves positive) |
| [016](cycles/CYCLE-016.md) | short-horizon reversal — the last open mechanism (L13) | F-32: reversal is a **real gross** cross-sectional edge at 1h/15m (placebo z 5.5/12.1, both halves +) but break-evens are **0.32–1.31 bps** and smoothing does **not** lift them → **P3's PARK confirmed on 6 y**; F-33: "the edge lives in signs" is contradicted; the lead's status had been **stale since CYCLE-001** (L10-t) |
| [017](cycles/CYCLE-017.md) | execution realism — the maker fill model (L08) | F-34: a conservative passive-fill replay removes the reversal edge before any fee — maker book gross Sharpe **−0.002 (1h) / −0.271 (15m)** vs taker **+0.415 / +0.534**; per-fill friction **−0.6…−1.6 bps** at every depth 0–20 bps (identical for a seeded-random side → pure execution cost) → L08 closed NEGATIVE with an L2/queue data requirement; a draft bug (L10-u) found and fixed |
| [018](cycles/CYCLE-018.md) | meta-labelling: is "will this rule's trade pay?" predictable? (L06) | F-35: OOS Brier skill vs the causal base rate is **≤ 0** for all three base rules at 1h & 15m (−0.0003…−0.0013) — the pre-registered falsifier fires; AUC ≈ **0.505–0.508** is a detectable whisper that overfits with capacity; the abstention overlay reaches a positive net@4 only by keeping **0.3–0.7 %** of bars (15m: fewer, mostly still negative) → L06 closed NEGATIVE; no fully-open lead remains |
| [019](cycles/CYCLE-019.md) | decay on the two working sleeves (L12, L18) | F-36: the carry dispersion book's **net** edge has decayed — 2025 net@4 −0.01, 2026 −1.88 (net trend ρ −0.79, p 0.023) — because its **break-even fell to 2.9–3.4 bps** (below the 4 bps fee) while the gross trend is flat (p 0.39); the **toptrader fade has NOT decayed** (last-12m net@4 **+1.91**, trend p 0.68) and the 25 % mix survives on it (+1.76), so the fade is now the lab's only live sleeve |
| [020](cycles/CYCLE-020.md) | re-tuning the dispersion book for the decayed regime (L12, L16) | F-37: the decay was the **EWMA(0.1) policy**, not the sleeve — `e28` shows 7/16 policies clear 4 bps recently with break-even **monotone in slowness**, leader `ewma_0.01_norm` at recent-24m break-even **27.07 bps** / net@4 **+3.86** / **9-by-9** regimes; `e29` shows a **walk-forward λ-selection** (blind to the future) nets **+5.71 OOS** vs the pinned spec's **+2.76** (recent-24m +3.41 vs −0.53) across **12/12** parameterisations while a **gross-blind** selector nets only **+0.28** → the retune is a cost-aware **rule**; R8 re-un-gated with an amended (walk-forward λ) spec |
| [021](cycles/CYCLE-021.md) | sizing the retuned dispersion book (L15, L17) | F-38: the retuned book's binding limit **switches from impact to open interest** — the λ=0.1 spec is impact-bound at **$13.2 M** (DOGE) while `ewma_0.01` is **OI-bound at $19.2 M** (LINK) and `ewma_0.02 + cap12.5 %` reaches **$35.9 M** at recent net@4 **+4.24** / break-even **15.97 bps**; a hold-like book's square-root capacity is fictional (λ=0.005 reads **$4.0 B**), so the OI bound is the honest size limit → R8 spec becomes `ewma 0.02 + 12.5 % cap`, ~$36 M |
| [022](cycles/CYCLE-022.md) | R8 capstone: joint (λ, cap) walk-forward, fee-stressed (L12, L15, L16, L17) | F-39: a **joint (λ, cap) walk-forward** over a 40-book grid, blind to the future, beats the pinned F-24 spec OOS (**+6.13 vs +2.76**; recent-24m **+4.49 vs −0.53**) and stays net-positive at a **10 bps** fee (net@4 +4.43, ~6× headroom); `λ=0.1 + cap12.5 %` is still broken (+1.93) → the slower λ repairs the margin, the cap is a capacity add; **R8 is port-ready** |
| [023](cycles/CYCLE-023.md) | does the F-37 slowness lesson transfer to the fade? (L18) | F-40: **mixed** — the fade is not cost-fragile at any λ (recent-24m break-even **55 bps** at EWMA 0.1, ≥19 bps at λ=0.5) and the walk-forward rule is *worse* than pinning (+0.70 vs +0.94 OOS, because Sharpe ~0.8 makes trailing windows noise-dominated), so the retune **does not transfer**; but the F-27/F-38 **12.5 % cap does** (OI bound **$37 M→$54 M**, net@4 +0.79→+1.00) → R7's fade spec is finalised; `e22#buildMasked` exported |
| [024](cycles/CYCLE-024.md) | is the OI capacity bound a mean or a distribution? (L07, L15, L17, L18, L10) | F-41: the published bounds are **`f·mean(OI)/mean\|w\|`** — a *ratio of means* (average-case), not the desk's `min_t(OI/\|w\|)` constraint. The true min-of-ratio is **2.6–8.8×** lower (dispersion spec $23.41 M→**$4.37 M**, fade $36.99 M→**$4.19 M**, fade+cap $53.84 M→**$12.62 M**); at the published sizes the books breach the 5 %-of-OI cap in **65–77 %** of periods (peak **16–44 %** of LINK's OI), so the restated usable sizes (recent-24 m p5) are **$10.2–21.9 M**; the F-27/F-40 cap is the fix (fade never-breach $4.19 M→$12.62 M); **L07's liquidation half is closed DATA-BLOCKED** (empty `liquidationSnapshot` prefix; APIs realtime-only); new bug register entry **L10-w** |
| [025](cycles/CYCLE-025.md) | is the OI capacity a number or a schedule? (L07, L15, L17, L18, L10) | F-42: the compliant construction is a **schedule**, not a number. A constant trailing-p5 size still breaches the 5 % cap (**2.7–3.7 %**, peak 6–10 %) and a lagged EWMA size breaches **53–55 %**; the working recipe is a **clipped trailing-median** — target the trailing-median, hard-clip at `G_t^cap` — deploying a mean **$16.94 M** (R8) / **$19.34 M** (R7) at **zero breach** (clip binds ~44 %), Sharpe **4.41 / 0.96**. Full-follow (`G_t^cap`) buys **2.0–4.1×** mean size but lowers dollar Sharpe (R8 5.02→3.26; fade 1.21→0.77) and deepens drawdown (22.8 %→58.2 %) and the placebo is catastrophic (turnover 14→564×/yr, Sharpe −0.7…−18.5) → the schedule is *compliance at low churn*, not alpha. Also **fixed `e33`'s measurement**: a min-of-ratio required a *partial* symbol set → a bogus $936 B print at 2021-11-04, now requiring **every traded symbol** to have OI (L10-x), which raised the breach fractions to **65–77 %** and made the dispersion coverage **78.9 %** |
| [026](cycles/CYCLE-026.md) | does the sleeve mix survive the re-spec, and do the two capacities add? (L12, L18, L15, L17) | F-43: **mixed**. (a) F-31's 25 % mix does **not** survive the re-spec — ρ is still **0.010** but the re-tuned carry book's net@4 second half is now **+4.66** (F-37 removed what the mix hedged), so the fade (net@4 **1.00**) dilutes carry (**6.49**) at every weight: 25 % mix nets **1.62**, and a **walk-forward allocation rule picks the fade at 0 % in 11/11 blocks** (6.59 OOS vs 1.67). (b) The two sleeves' OI capacities **do not add**: both bind on the same thin alts, individual means are $23.72 M + $31.85 M = $55.57 M but the **joint** schedule at the mix is **$31.32 M (56 %)**, and running both at their individual compliant sizes breaches the 5 %-of-OI cap in **78.4 %** of periods (peak **10.0 % = 2× the cap**, median 8.1 %; LINK weight corr −0.20, same-sign 51 %) — **a min-of-ratios capacity is not diversifiable** |
| [027](cycles/CYCLE-027.md) | what is the exact joint OI frontier? (L12, L18, L15, L17) | F-44: **refines F-43** — the free-split joint capacity is a per-period 2-D LP `max Σ g_s G_s s.t. \|Σ G_s w^s_j\| ≤ 5 %·OI_j`. Its total gross is **mean $62.72 M (1.13× the $55.64 M sum), median $37.11 M (0.88×), p99 $624 M, 2.00× the fixed 25 % mix**, so F-43's "56 %" was the *fixed split*, not the constraint — the constraint is cheap. But the optimal fade share is **p5 0 / p95 1** (no stable allocation), and the LP-optimal size schedule churns **48.5× gross/yr** for **net@4 0.62** (vs carry's 6.49) → the frontier is a **capability**, not a deployable size; `e35#buildPair` extracted (artefact byte-identical) |
| [028](cycles/CYCLE-028.md) | is the OI-change signal unrescuable, or was it F-23 again? (L07 → L19) | F-45: **F-28 was the F-23 mistake again** — the daily Δlog(OI) book (gross 0.96, **1501×/yr**, break-even 1.89 bps, net@4 −1.07) is an *implementation* artefact; EWMA-smoothed, **3 of 6** policies clear a 4 bps fee (λ=0.25: break-even **8.93 bps**, net@4 **+0.65**; λ=0.1: **14.73 bps**, +0.52), independent of carry (corr **0.007**), sign control −3.00. But weak/churny/recent: 338×/yr, net halves **0.07/1.47**, 2023 −0.86 vs 2024–26 +1.56/+0.96/+2.30, walk-forward λ +0.44 < pinned +0.76/+0.99 → **not port-ready**; new open lead **L19**; `e21#xsBookImpl` extracted (artefact byte-identical) |
| [029](cycles/CYCLE-029.md) | is the OI-change signal a 2024–26 artefact? (L19, its own falsifier) | F-46: **refines F-45** — with sign +1 and λ∈{0.1, 0.25} fixed a priori, the pre-2024 (n=2270) net@4 is **λ=0.25 −0.12** but **λ=0.1 +0.47** (break-even 15.23 bps), so the *signal* is not a 2024–26 artefact but F-45's "best" λ=0.25 **is** (pre −0.12 / post +1.45); the two λ are anti-phase and a fixed **50/50 blend** reads **+0.33 pre / +1.24 post**, **positive every calendar year 2022–26** (0.34/0.73/0.89/1.45/1.88), break-even **11.33 bps**, 254×/yr, beating both single λ (full net@4 **0.77**); no decay (net trend **+0.67**, p 0.053); **rank does not help**; independent of L18 (**−0.045**); OI bound mean $23–28 M, p5 $6–8 M (DOGE/LINK/ADA) |
| [030](cycles/CYCLE-030.md) | does the L19 OI stream add to R8? (L19 × L12 × L18 × L15/L17) | F-47: **MIXED — L19 does not add; opens L10-y**. Return side: independent (corr carry **+0.01**, fade 0.00) but **too weak** — capital ladder monotone down (carry net@4 6.48 → 2.82 at 5 % OI, walk-forward OI **0 % in 11/11**), risk-normalised max-Sharpe OI weight **0.10** for **+0.04** Sharpe. Capacity side: the **3-sleeve LP** reads mean **$142.2 M = 1.76× the sum** of the three individual means ($80.9 M) and **2.27×** the 2-D carry+fade LP, OI share **0.374** (not crowded out) — but the LP schedule churns **129.6× gross/yr** for net@4 0.82 and all-three-at-individual-sizes breaches in **58.8 %** of periods → standalone, not a joint member. Methodological bug **L10-y**: the carry book's net4 vol is **0.4 %/yr** vs the fade's **13.6 %** and the OI's **24.3 %** (31–55×), so capital-fraction mixes measure the vol ratio (F-43's direction stands, its magnitude 6.49→1.62 does not) |
| [031](cycles/CYCLE-031.md) | does a fixed cross-scale blend beat R8's walk-forward λ? (L12, L16; tests F-37/F-39) | F-48: **the blend matches the rule with half the turnover.** On the shared OOS span (net@4): walk-forward **6.63** (14×/yr, 25.55 bps) vs best fixed blend λ∈{0.01, 0.02} **6.66** (recent-24m **4.58**, **7×/yr**, break-even **46.14 bps**) — within 0.2 Sharpe (falsifier does not fire) and every pre-registered blend recent-positive → a fixed two-scale blend with **no rule/lookback/block** matches the walk-forward; the `all5` control (incl. the broken λ=0.1) is the *worst* (4.36), so nothing rewards blind mixing; the pinned λ=0.02 reads **6.86** but was tuned on the full history and the rule's value over it is **−0.23** → the walk-forward bought *slowness*, not a selection rule. Open: whether a *single* λ frozen before the span suffices |
| [032](cycles/CYCLE-032.md) | is F-48's "fixed blend replaces the λ rule" robust, or hindsight? (L12, L16; tests F-48) | F-49: **MIXED — scopes F-48 down.** The blend claim is **menu-dependent**: only **1 of 10** pre-registered blends clears the 0.2 bar (the cherry-picked `{0.01,0.02}` 6.66; the no-hindsight F-37-slow sets read **5.74** and **6.08**), a blend-selection walk-forward reads **5.81** vs the rule's 6.63, and the blend ranking flips by window. **But** the honest simplification survives in a sharper form: a λ **frozen** on `[0,S)` picks the F-37-broken λ=0.1 for S ≤ 1825 → OOS **1.76–1.93**, and **0.02** for S ≥ 2555 → OOS **6.81 / 6.64 / 4.10** (matching the rule's 6.69 / 6.48 / 4.27). So R8's walk-forward λ can be replaced by a **frozen λ chosen on ≥ ~2.3 y of trailing data** — not a blend — and the rule's value is concentrated in the first ~2 years; the freeze knob is non-monotone (a 730-period train picks worse than 365). Guard: the rebuild reproduces `e40`'s 6.63 / 6.86 / 6.66 with diffs 0.00 |
| [033](cycles/CYCLE-033.md) | is R8's cap rule removable too? (L12, L16, L17; tests F-39/F-49) | F-50: **MIXED — corrects F-39; the pinned book wins.** The joint (λ, cap) walk-forward reads OOS net@4 **6.13** vs the pinned `ewma 0.02 + cap12.5 %` **6.86** (plain 0.02 6.63), and the pinned book is ≥ the rule on **4/5** sub-spans → the rule's edge was over the *broken F-24 spec* (+2.76), the F-48/F-49 pattern once more. The cap is a **flat plateau** at λ=0.02 (OOS 6.63 none / 6.77 cap0.10 / 6.86 cap0.125 / 6.90 cap0.15; clips **42.3 %** of weight entries), so `1/k=0.125` is **structural, not tuned** — the first **OOS confirmation of F-27**. A frozen *pair* fails (early regime `0.075+cap0.1`, OOS 2.29–2.48) but a frozen **cap** (λ=0.02) reads 6.77/6.84/6.81/6.64/4.10 ≥ the rule at every split → **R8's spec is pinned** (λ on ≥2 y + cap = 1/k), no walk-forward. Guard: the rebuild reproduces `e31`'s 6.13 / 6.63 / 6.86 / 1.93 with diffs 0.00 |
| [034](cycles/CYCLE-034.md) | is the fade's spec pinned too? The F-48/49/50 chain on R7 (L18; tests F-40) | F-51: **MIXED — R7 is a pinned book; extends F-40.** The joint (λ, cap) walk-forward reads OOS net@4 **0.70** vs the best pinned `ewma 0.05 + cap12.5 %` fade **1.14** (pinned `ewma 0.1` 0.94, per F-40). A λ **frozen** on `[0,S)` with the cap at `1/k` picks **0.05** and reads **1.14 / 1.15 / 0.37 / 0.83 / 0.87** vs the rule's **0.70 / 0.87 / 0.31 / 0.60 / 0.93** (≥ or within 0.2 at every split, and — unlike R8 — **no ≥2 y minimum needed**). The mechanism is **λ-flatness**: with the cap fixed the eight λ's span only **0.16** OOS (0.25 uncapped), so the rule ranks near-ties (F-40's noise-dominated trailing window, quantified). The cap transfers (λ=0.1: OOS **0.94→1.11**, turnover **28→16×/yr**, recent-24m 0.84→0.47). So **R7's spec is pinned too** (`ewma 0.05 + cap 12.5 %`), and the port conclusion is **symmetric: both deployable sleeves are pinned books, no walk-forward**. Guard: the rebuild reproduces `e32`'s 0.70 / 0.94 / 1.11 / 1.14 / 0.69 / 1.03 with diffs 0.00 |
| [035](cycles/CYCLE-035.md) | What is the cap actually doing — concentration or a no-trade band? (L17 × L16; tests F-27/F-50) | F-52: **SUPPORTED — the cap is a concentration tool.** A no-trade band swept to the cap's exact turnover (eps=0.008 → **10×/yr**) reads net@4 **5.05** vs the cap's **6.18** — only **+0.13 of +1.26** — and across the whole band sweep (turnover 16→6×/yr) net@4 stays in **[4.95, 5.05]**, so the cap's Sharpe edge is the **shape** not churn. The band leaves max `\|w\|` at **0.436** and OI capacity a **1.00×** multiple of base ($20.44 M vs $20.42 M ratio-of-means; $19.88 M vs $19.84 M min-of-ratio) while the cap is **1.76× / 1.70×** → the capacity gain is **concentration**. And the tools **stack**: capped + band reads net@4 **6.36** at turnover **6×/yr** (vs 6.18 at 10) → the port cost recipe is **cap 1/k + a no-trade band**. Guard: the rebuild reproduces `e30`'s 4.92 / 6.18, 17 / 10, 39.63 / 46.04 and $20,415,294 / $35,937,181 with diffs 0.00 |
| [036](cycles/CYCLE-036.md) | Does the cap-mechanism transfer to the fade? Concentration vs turnover on R7 (L18 × L17; tests F-51/F-52) | F-53: **SUPPORTED — generalises F-52; the band stack is R8-only.** The fade cap lifts net@4 **0.82 → 1.07** (**+0.25**), but a no-trade band swept to the cap's exact turnover (eps=0.05 → **8×/yr**) reads **0.78** — *below* base (**−0.04**) — and the whole band sweep (14→6×/yr) stays in **[0.78, 0.95]**, far from the cap's 1.07. The band leaves max \`\|w\|\` at 0.456 (base 0.500, capped 0.125) and capacity a **1.03–1.04×** multiple of base while the cap is **1.43–1.47×** ($37.38 M → $54.78 M ratio-of-means; $32.43 M → $46.36 M min-of-ratio) → the cap is a **concentration** tool on R7 too. But a band on the capped fade gains only **+0.06** (1.13 vs 1.07, threshold 0.1) vs R8's +0.18 → the mechanism is general, the **band stack is R8-specific**. Guard: the rebuild reproduces `e32`'s 0.82 / 1.07, 14 / 8, 118.38 / 182.59 and $37,378,256 / $54,782,334 with diffs 0.00 |
| [037](cycles/CYCLE-037.md) | Why does clipping help — tail winsorisation vs a hard constraint? (L16 × L17; tests F-27/F-50/F-52) | F-54: **SUPPORTED — the cap is a tail winsorisation; the hard form is not special.** A smooth saturation `c·tanh(w/c)` at c=0.125 matches the hard clip (net@4 **6.04 vs 6.18**; 6.11 at c=0.10) — only the **level** matters, and it is a plateau (hard **6.18/6.18/6.13/5.84/5.23**, soft **6.11/6.04/5.94/5.74/5.43** for c = 0.10/0.125/0.15/0.20/0.30). But **wholesale shrinkage fails**: `sign(w)·\|w\|^p` reads **4.44/3.99/3.25/2.27** for p=1.25/1.5/2/3 (all *below* base 4.92) and equal-weight reads **1.51** → it **winsorises the extreme tail while preserving the body**, it does not lower concentration per se. Guard: the rebuild reproduces `e30`'s 4.92 / 6.18, 17 / 10 and $20,415,294 / $35,937,181 with diffs 0.00 |
| [038](cycles/CYCLE-038.md) | Is the "frozen λ matches the pinned book" conclusion split-point robust? (L12 × L16; tests F-49/F-50) | F-55: **MIXED — refines F-49/F-50; only robust past ~2.3 y.** On a **dense** 14-split grid the pre-registered 0.80 bar narrowly fails — the **expanding** `[0,S)` freeze is within 0.2 of the in-sample-best pinned book at **0.71** (median gap 0.00), the **rolling 1-year** freeze at **0.79** (median **+0.30**) — but every failure is in the first ~2 y: the expanding freeze collapses at **every split S ≤ 2190** (−3.4…−4.4) picking a fast λ, then picks **0.03** and matches at **10/10** splits from S = 2555. So the safe boundary is **~2.3 y**; the dense grid also shows the broken fast λ is **0.075** (not 0.1) once training > 1.3 y, the rolling freeze beats the expanding one (0.79 vs 0.71), and the **cap stabilises** the frozen policy (**0.50 uncapped → 0.79 capped**). Guard: the rebuild reproduces `e30`'s 4.92 / 6.18, 17 / 10 and $20,415,294 / $35,937,181 with diffs 0.00 |
| [039](cycles/CYCLE-039.md) | L19's construction thread: hold-N cadence or a non-equal two-scale mix, without fitting a λ? (L19; tests F-45/F-46) | F-56: **SUPPORTED — the mix is null, the cadence adds (fee-driven).** No fixed non-equal mix beats equal capital (0.76 / 0.77 / 0.74 / 0.69 vs **0.77**), and a **no-hindsight** inverse-vol mix picks `w = 0.51` → OOS **1.18** vs the blend's **1.19**, so 50/50 is vol-optimal. But a **hold-6** cadence on the blend lifts net@4 **0.77 → 0.87** while the gross Sharpe *falls* 1.18 → 1.03 — turnover 254 → **93×/yr** pays for the staleness (break-even 11.33 → **27.03 bps**, positive every year 2022–26; 0.70/0.98/1.16/0.77/2.23); hold-3 **0.82** and hold-9 **0.83** (loses 2024) define a **1–3 day plateau** (hold-6 is the grid max, so +0.10 is an upper bound). A **lab-internal bug** (the blend averaged without renormalising → 0.70/10.75/220) was fixed and pinned by a second guard. Guards: the daily book reproduces `e21#dLogOI_pos` (0.9612 / 1501.11) and the 50/50 blend reproduces F-46's `e38` ensemble (0.77 / 11.33 / 254) exactly |
| [040](cycles/CYCLE-040.md) | Stressing F-56: is hold-6 a plateau, and does it survive a drift-aware backtest? (L19; tests F-56) | F-57: **MIXED — the drift caveat does not bite; the cadence gain is a spike.** A true-hold **drift-aware** simulation gives turnover within **2×/yr** of the lab's target-change measure at **every** N and a slightly *higher* net@4 (hold-6 **0.94**) → `turnoverSeries` is not optimistic. But the **fine grid** (N = 1…36) is jagged: the best hold-6 is an **isolated spike** (**+0.10** over neighbours 5/7), only **4 of 15** holds beat daily by ≥ 0.05 (non-contiguous: 2/3/6/9), the short-hold region (2–9) averages **0.80** vs 0.77 daily and the long region (10–24) collapses to **0.60** → `gridRobust` **false**. Honest result: **hold ≤ ~3 days (254 → 73×/yr) is no worse, but no specific cadence reliably adds.** Guards: `e21` (0.9612 / 1501.11) and F-46's `e38` (0.77 / 11.33 / 254), diffs 0.00 |
| [041](cycles/CYCLE-041.md) | What is the OI sleeve's right cost tool — a hold cadence or a no-trade band? (L19; tests F-56/F-57) | F-58: **SUPPORTED — the band is better (smooth plateau).** Porting the F-52/F-53 **no-trade band** onto the OI sleeve, `eps = 0.03` reads net@4 **0.92** at turnover **198×/yr** (break-even **15.22 bps**, **positive every year 2022–26**) — above hold-6's 0.87 and the daily 0.77 — as a **plateau** (3 sweep points within 0.05 of the peak, neighbours close) with **no interior re-rise** (`bandReRisers` 0 vs hold-N's 1). At matched turnover it wins **7 of 18** points (turnover ≈ 173–200+); the cadence's residual low-turnover edge is exactly its fine-grid spikes (F-57). → the OI sleeve is **50/50 + band (eps ≈ 0.03)**, and the band is confirmed as the lab's **general** cost tool (R8 stacks with the cap, R7 alone, OI alone). Guards: `e21` and F-46's `e38`, diffs 0.00 |
| [042](cycles/CYCLE-042.md) | Is the OI sleeve's band robust out of sample, and is its eps stable? (L19; tests F-58) | F-59: **MIXED — band > cadence out of sample (11/11); the eps needs ≥ ~2.3 y.** On an 11-split dense grid (S = 1095…5110) the **frozen-eps** band beats the **frozen-N** hold at **11/11** splits, and the **fixed** `eps = 0.03` band beats both the daily blend and fixed `hold-6` at **every** split → F-58 is not a full-sample artefact. **But** the trailing `eps` pick takes 4 values: S = 1460/1825/2190 choose the **largest** eps (`0.1`) and underperform fixed 0.03 OOS (1.03–1.22 vs 1.40–1.65); from **S ≥ 2555** picks collapse to {0.025,0.03,0.04} and from **S ≥ 3650** to `0.03` alone. Pre-registered stability bar **fails overall**, **passes late** — the **~2.3 y** boundary of F-49/F-55, now for the band → **pin `eps ≈ 0.03`** or pick it on ≥ ~2.3 y. Guards: `e21` and F-46's `e38`, diffs 0.00 |
| [043](cycles/CYCLE-043.md) | Can one module reproduce all three sleeves' books? (L12 × L18 × L19; packages F-27/F-50/F-52/F-53/F-54/F-58/F-59) | F-60: **SUPPORTED — the port artefact passes 5/5.** `prototypes/port.js` (`clipWeights` + `bandWeights` + `cleanBook` = cap-then-band) reproduces every stored book across R8/R7/OI: R8 cap **6.18 / 10× / 46.04** = `e30`; R8 matched band **5.05 / 10×** = F-52; R8 cap+band **6.31 / 7×** = F-52's stack (6.36 / 6×); R7 cap **1.07 / 8× / 182.59** = `e32`; OI band **0.92 / 198× / 15.22** = `e50`. The shared chain is one signal-agnostic module with `SLEEVE_SPECS` + `MIN_TRAIN_PERIODS = 2555` (the ~2.3 y rule), so the port is executable, not prose. Guards: `e21`/`e30`/`e32`/F-46's `e38`, diffs 0.00 |
| [044](cycles/CYCLE-044.md) | Does the shipped carry grid join handle sub-8h funding? (L10; settles the pre-registered FOLD-BACK R4(b)) | F-61: **SUPPORTED — a shipped-path defect (silent, fails safe).** The repo's `analysis/carry.js#carryOnBarGrid` divides every funding row by the *default* 8h bar count rather than the observed interval (contradicting its own header comment), so a synthetic 8h period at 8h/4h/2h/1h funding returns **one rate at every interval** (**1×/2×/4×/8×**). On the shipped data the only sub-8h symbol is SOLUSDT (**3 × 4h + 98 × 2h** steps, FTX 2022-11-09→18): the FTX window receipts **−0.107** (shipped) vs **−0.324** (bucket-summed) = **3.03×**, and the pooled 8h sleeve reads ann **9.985 %→9.531 %**, Sharpe **11.96→9.60** — the defect **flatters** the book (the F-18 direction trap). `auditFundingProblems` is **blind** to it (**[]**: the steps are 1.47 % < the 2 % budget and shorter than a period), and a **latent** single-pair `barsPerPeriod` inference would double a symbol's carry across a first-bar gap. The lab's loader is unaffected (it buckets rows first, L10-o) and is now pinned by `e14#sub_8h_sleeve_equality`; fold-back **R4** carries the fix. Guards: the synthetic scaling ratios, SOL's interval histogram, the FTX ratio and the pooled deltas, all pinned by `e53` |
| [045](cycles/CYCLE-045.md) | Does the dependence/DSR backbone mean what it says? (L10; settles L10-f/L10-i) | F-62: **SUPPORTED — unbiased but low-precision; `effectiveBars` unbounded.** Ensemble means over synthetic panels match the closed forms `1+(K−1)ρ` / `K` / `1+ρ` / 1 within **2.5 SE** (max gap **0.318**, 0 biased rows) → the estimator is **unbiased**, so F-02's DE 4.92 is the estimand it claims. But on true-i.i.d. data a *single* reading at C = 36 folds spans **0.644–1.452** (sd **0.243**; **0.097** at C = 288; lab mirror centered 0.98–1.06) → a two-decimal DE overstates resolution ~10×. **L10-f settled**: `effectiveBars` is **unbounded** — a ρ = −0.5 pair reads mean DE **0.506** with `effectiveBars > rawBars` in **25/25**, and a perfectly hedged pair gives DE **4.7e−32** → `effectiveBars ≈ 3.4e34` while `adjustmentNeeded` reads **false** (DE is a *squared* ratio). **L10-i settled**: `backtestMetrics`' `2 ≤ effectiveBars < n` clamp declines the explosion (`nEff`/`dsrAdjusted` = `null`) — intended, but lossy (hedged vs degenerate both read `null`; new row **L10-ae**). No fold-back (intended behaviour). Guards: 11 checks in `e54`, all pass |
| [046](cycles/CYCLE-046.md) | Does the split family purge/embargo as claimed? (L10; audits the purge contract) | F-63: **SUPPORTED — the purged variants hold; the walk-forward does not purge.** `purgedKFoldSplit`/`combinatorialPurgedSplit` are **leak-free on every fold** of a synthetic label-overlap grid (0 overlap pairs; embargo honoured; CPCV multiplicity `C(k−1,m−1)`), but `walkForwardSplit` — the path the A/B and F-13 use — has **no** `labels`/`labelSpan`/`embargo` (passing them returns byte-identical folds), carries no purge metadata, and leaks exactly **`H(H−1)/2`** label-overlap edges per fold for horizon **H > 1** (H=5 → 10/fold, 120 at testSize 40; **0** at H=1). `isCausalFold` (index order only) passes every leaky fold; the repo's `assertNoLeakage` flags it but is never called on the walk-forward (**L10-ag**: the lock-registry's "zero label-window leakage" claim covers only the purged variants). An index-lookup model recovers test returns in the leak zone (**+0.0035**/bar, se 7e−5, vs 0.0000 clean / +0.0001 purged). Lab unaffected (span-1 signals); shipped controller trains on horizon labels → **FOLD-BACK R9 (candidate; later scoped latent by CYCLE-047)**. Guards: 12 checks in `e55`, all pass |
| [047](cycles/CYCLE-047.md) | Does F-63's leak reach the shipped controller? (L10-ag follow-up; scoping) | *No new finding — F-63 amended.* The **code trace** resolves it: the shipped controller is **online** — `analyze.js#makeControllerModelFactory` fits a fold by replaying bars `1 … testStart`, each call seeing a window ending at `i − 1` (`analyze.js:1018`), so the last training bar is **`testStart − 1`** and the fold's declared `train` list is **ignored** — and `hivemind/controller/trades.js` labels a trade by its outcome at the **exit** bar, only *closed* trades entering training. So every training label is realised at an exit `≤ testStart − 1`, causally before the test; the leak (which needs a training label realised *inside* the test window) cannot occur even though the labels overlap (`heldBars {mean 8.30, max 54}`). **F-63 scoped LATENT; R9 downgraded to latent / low-priority**; `e55` guard kept. Register: **L10-ah**. No new experiment — `run_all` stays 63 steps |
| [048](cycles/CYCLE-048.md) | Does `analysis/labels.js` (triple barrier / CUSUM / fractional diff) mean what it says? (L10; the F-63 label-span follow-up) | F-64: **SUPPORTED — the contracts hold; five warts, all latent.** `e56_labels_audit.js` (23/23 guards, 77 ms) checks the module against **closed forms**: `tripleBarrierLabels`' first crossing is exactly `ceil(level/step)` on **192** monotone cases and the three-way `ret` / first-crossing / timeout-index contracts hold on **60** seeded random paths (the touch bar **overshoots** the barrier level **1362** times on gaps, so `ret` is a realised price change, not the barrier magnitude); `cusumFilter` matches an **independent** drawup/drawdown formulation of its own reset rule on **160/160**; `fractionalDiffWeights` = `(−1)^k C(d,k)` for integer `d` (1e−12) and vs an independent **Lanczos-`Γ`** for non-integer `d` (max rel. err **2.3e−14**); the shipped `fracDiffAt`/`fracMomentum` = the convolution exactly. **Warts (all latent):** the `pt`-before-`sl` tie-break is **unreachable for `vol > 0`** (0 of 6 bars) and degenerate at `vol ≤ 0` — at `vol = 0` the barrier collapses to a **one-bar sign label** and a flat series labels **11/12** events **+1 at `ret = 0`** (**L10-ak**); the default event set emits a **zero-horizon** `{t1 = event, label 0, ret 0}` bet (**L10-al**); `cusumFilter` **ignores its `events` argument** (**L10-ai**) and its `lastEmit` guard is **dead** (**L10-aj**); the "`size <= 0` uses `DEFAULT_FD_WINDOW`" docstring is **false** (auto widths **1/2/3/4** for `d = 0/1/2/3`) (**L10-am**). Plus a **killed candidate** (**L10-an**: `d = 0` → `[1]`, the exact identity — the NaN-at-0 case is `d = 1`), the scope trace **only 1 of 6 exports is shipped** (**L10-ao**), and the `window 16` vs **100** calibration (**L10-ap**). No fold-back row; `run_all` is now **64 steps, 32 gated, 0 fails** |
| [049](cycles/CYCLE-049.md) | Does `analysis/overfitting.js` (PBO / CSCV) mean what it says — and is its calibration figure a measurement? (L10; new L10-aq…L10-av) | F-65: **SUPPORTED — structure validated; the calibration is one draw; five latent rows.** `e57_overfitting_audit.js` (29/29 guards) confirms the exact structure: `cscvBlocks` partition (7/7), `cscvSplit` = `C(S,S/2)` splits (6/6) each a disjoint cover with block multiplicity `C(S−1,S/2−1)` and complement closure, the cap (**705432 throws / 184756 passes**), `relativeRank` (best `N/(N+1)`, worst `1/(N+1)`, ties, `[5,5,1,1]` → 0.7/0.3), `oosOnIsRegression` vs an **independent sum-formula OLS** (40 vectors, 1e−9), and exact constructed PBOs (all-flat **1**, one dominant **0**, anti-persistent pair **1**, hand-computed override **0.5/1.0**); invariant under annualisation and positive scaling. The repo's quoted calibration reproduces **exactly — 117/252 = 0.46429** (seed 20240) — but the ensemble (60 matrices, N=8/T=400/S=10) centres at **0.4769** (se 0.0329) with **sd 0.2546** (p05–p95 **0.099–0.885**) vs a binomial split SE of **0.0315** → split **design effect 65.4, ≈3.9 effective splits**; a persistent edge gives PBO 0 / slope ≈ +1.0, a planted regime flip gives 1. Rows (all **latent**, **L10-av**: no shipped importer): **L10-aq** `relativeRank` skips NaN but divides by full `n` (0.60 vs 0.75) → PBO biased up; **L10-ar** a fully-tied roster is forced to PBO exactly 1, though partial duplication does not bias (0.5806→0.5401, 6/10 — guess falsified); **L10-as** `degradation`'s pooled `n = N·splits = 2016` vs 80 block performances → naive t exceeds 1.96 on **91.2 %** of skill-less matrices; **L10-at** 252 splits ≈ 4; **L10-au** `cscvBlocks(6,6)` gives 1-observation blocks and the message says "per half" where the rule is per block. No fold-back row; `run_all` is now **65 steps, 32 gated, 0 fails** |
| [050](cycles/CYCLE-050.md) | Does `analysis/reality_check.js` (the resampling hub) mean what it says? (L10; new L10-aw…L10-az) | F-66: **SUPPORTED — the shipped primitives are exact; the selector does not reproduce its documented reference; three latent rows.** `e58_reality_check_audit.js` (39/39 guards) verifies every exact identity: `stationaryBlockIndices` at `b=1` is **byte-equal to an independent hand replay** of its rng stream and is i.i.d.-with-replacement (the geometric restart law replays byte-for-byte; restart rate `≈1/b`, mean run `≈b` within 2.5 SEs); `neweyWestSE` matches an **independent Bartlett** implementation on 24 windows × bandwidths (1e−12) and is slice-invariant; RC = `sqrt(T)·max mean` (a constant benchmark shifts it `−sqrt(T)·b`); SPA = `max(0,max fbar/ω)` (bootstrap SE independently recomputed); `A_k = ω_k·sqrt(2 log log T)` exact; SPA_c == SPA when all valid; the step-down first step is **bit-equal** to the consistent SPA; the subsampling family shares **one** reference (k-FWER `k=1` == step-down first p == consistent SPA p), is deterministic and segment-aware; and the arch AR(1) reference vector reproduces (**13.635665 / 15.608940**) from an **independently implemented NumPy legacy-RandomState(0) stream**. **L10-aw**: `politisWhiteBlockLength` returns exactly **0** when its flat-top `g ≤ 0` while the referenced `arch._single_optimal_block` **squares `g`** — **198/200** AR(−0.5) T=400 draws diverge (repo 0 vs arch e.g. **22.0**), so `autoBlockLength` floors to **1 (i.i.d.)** on 99/100 (the comment's floating-point-agreement claim is false for `g ≤ 0`); **L10-ax**: the `median` arm reduction is the **upper** median on even `K` (**4.84761** vs **4.25907**); **L10-ay**: the `neweyWestSE` `v < 0` clamp is **unreachable** (Bartlett PSD; min taper exactly 0); **L10-az**: the block-bootstrap RC/SPA family is **test-only** (shipped: `stationaryBlockIndices` via `forecast.js`, `neweyWestSE`+subsampling via `walkforward.js`). Calibration re-measured: subsampling **0.040/0.045/0.045/0.030** across φ vs block bootstrap **0.090/0.105/0.180/0.385**. Also fixed a lab bug (`e56`/`e57` were ungated). No fold-back row; `run_all` is now **66 steps, 35 gated, 0 fails** |
| [051](cycles/CYCLE-051.md) | Does `analysis/forecast.js` (Brier / Murphy / Diebold-Mariano / MCS) mean what it says? (L10; new L10-ba…L10-bf) | F-67: **SUPPORTED — the shipped forecast scoring layer's arithmetic is exact against the repo's own second Murphy implementation; a false docstring identity, a count-only alignment guard, and an off-target benchmark branch.** `e59_forecast_audit.js` (33/33 guards) verifies `forecastPairs` IS the inverse of `confidenceFromProb` (1e−12) + next-bar sign + fold-last-bar drop + non-finite skip; `brierBinIndex`/`brierScore`/`logScore` are the closed forms with the documented clip/NaN handling; the Murphy partition satisfies `brierBinned = REL − RES + UNC` (1e−17); **`observer/legion_metrics.js`'s independent second `brierDecomposition` agrees on REL/RES/UNC/Brier to 1e−12** and its explicit `within` equals forecast's raw-minus-binned gap to **1e−17**; `bootstrapMeans` is deterministic (`max(1,floor(cbrt(T)))`, one paired index draw, reports its block); the DM statistic is exactly `dbar/boot-SE` with the documented degenerate arms (zero → 0/1/null, constant positive → Infinity/0), i.i.d. size **0.0525/0.1075**, and the block bootstrap controls φ=0.5 size where `blockLength=1` does not (**0.095** vs **0.135**); the MCS eliminates a uniformly worse arm, keeps an identical pair, **always contains the sample-best** (4 ensembles × 200 = 800/800), is deterministic/monotone and covers **0.880/0.855/0.865/0.925** (the lower edge of the 2.5-SE band). Five rows: **L10-ba** (headline) — the comment's claim that the raw-minus-binned gap *IS* the within-bin forecast variance is **false**; the exact identity (the repo's own `observer/legion_metrics.js`) is `gap = WITHIN = withinVar − 2·withinCov`, and the gap is **negative on 5/6** configs while `withinVar > 0` (T=64/bins=1 **−0.0531** vs **+0.0774**), wrong by up to **0.13**; **L10-bb** — the `forecastComparison` alignment guard checks bar **counts**, so a count-coincident misalignment is silently paired index-wise and the DM verdict **flipped in 6/6** crafted witnesses; **L10-bd** — `groupOf` maps `benchmark` to the **baseline's** kind → with a `'signal'` baseline a calibrated-probability benchmark joins the z-score group and gets a DM test (contradicts the `reader`/`docs/LOCKED.md`; **unreachable from `analyze.js`**, reachable through the API, untested); **L10-be** — the MCS elimination denominator is `sd(L_i)`, not HLN's `sd(d_i)` (up to **77×** apart, **0/150** set or order changes → inert); **L10-bc** — `bootstrapMeans` silently NaNs on unequal-length series and the MCS returns `available:true` for a NaN-containing series (latent). **L10-bf** is the negative control: the calibration battery **upholds** the module (a probe's 0.82 coverage reading was Monte-Carlo noise). No fold-back row; `run_all` is now **67 steps, 36 gated, 0 fails** |
| [052](cycles/CYCLE-052.md) | Does `analysis/race.js` (successive halving) mean what it says? (L10; new L10-bg…L10-bk) | F-68: **SUPPORTED — the closed forms and engine contracts are exact; the \"decided set\" claim is a tautology on the fixture and false on a budget-dependent evaluator; the race can out-spend the grid.** `e60_race_audit.js` (18/18 guards, 27 ms) verifies `halvingRounds` = `max(1, floor(log(max/min)/log(eta))+1)` on 6 grids + 4 guards → 0; `halvingSchedule`'s `keep = max(1, ceil(survivors/eta))` on 5 grids (100 arms), monotone budgets, top rung `= maxBudget` when all rounds run, early stop; `successiveHalving` full-rung arm order, `nonFinite` elimination, `maximize:false` (winner `a8`), determinism / sync+async equality / stable ties, 6-grid cost reconstruction, the `arms`/`evaluate`/`maxBudget` guards, and `formatRace`. Four rows: **L10-bg** (headline) — the `docs/LOCKED.md`/docstring claim that \"a racing budget does not change the decided set\" is a **tautology** on the §AM fixture (its `evaluate = q ± 0.05/budget` ranks every budget identically, `rank(1) == rank(9)`, and its top rung 3 < the oracle's budget 9), and **false** on a budget-dependent evaluator — the race discards the top-budget best on **0.617/0.617/0.700/0.625** of seeded fixtures (K=16, 120 reps); **L10-bh** — `spentBudget < gridBudget` holds only at a large budget ratio (fixture 0.222) and reads **1.000** (16,2,2)/(100,2,2), **1.056** (9,2,2), **1.222** (9,3,2), **2.890** (100,10,1.1); **L10-bi** — small-`eta` integer rounding repeats consecutive rungs (**15 of 25** at `eta = 1.1`; cost ratio 2.89); **L10-bj** — `successiveHalving` does not validate `eta`/`minBudget` (η=1/0.5/0, `minBudget>maxBudget` → silent `available:true`, `winner:null`, 0 evaluations). **L10-bk** is the scope: engine-only / test-only (no shipped importer; `analyze.js` exposes no `--race` flag), so every row is latent — but the claim that licenses the gate is the one that fails. No fold-back row; `run_all` is now **68 steps, 37 gated, 0 fails** |
| [053](cycles/CYCLE-053.md) | Does `analysis/benchmark.js` (the P1 model-class benchmark) mean what it says? (L10; new L10-bl…L10-bo) | F-69: **SUPPORTED — the documented contracts are exact; the ridge arm's probability is anchored at 0.5 (its training base rate is computed and never restored), the sigmoid caps its skill, and the "hand solve" claim is untested.** `e61_benchmark_audit.js` (12/12 guards, 67 ms) verifies the standardiser (zero-mean/unit-std; constant column → `std 1e-8`, `z 0`; empty → `d 0`), `fitRidge` against an **independently solved** centred ridge (**w diff 0**), the unpenalised intercept, `predictRidge` ∈ (0,1), `fitBaseRate` = the training prior (empty → 0.5), the ridge/MLP separable-rule accuracy, MLP byte-determinism, `BENCHMARK_KINDS` + the `tsfm`/unknown-kind refusals, and a perfect classifier beating the base rate on Brier (**0.1425** vs 0.2500). Four rows: **L10-bl** (headline) — `fitRidge` centres the target on `ybar` and **`predictRidge` never restores it**, so the arm is anchored at 0.5 (a constant-`y` fold → exactly **0.5**; a **0.833**-base-rate fold → mean **0.50**, Brier **0.22475** vs **0.13533** with `ybar` restored), and the shipped test checks **accuracy only** (a 0.5 threshold, invariant) so it cannot fail; **L10-bm** — the sigmoid of a bounded [0,1] least-squares fit confines the arm to `sigmoid([-1,1])` (a perfect feature → Brier **0.1425** floor; a constant-y MLP → **0.99**); **L10-bn** — the LOCKED/lock-registry "ridge closed form matches a hand-computed solve" is **unverified** (the closed form IS exact, but the 5 shipped §P1 checks assert accuracy/determinism/standardiser/factory/grouping only); **L10-bo** — the eps constant-column fallback maps a one-unit train→test deviation to `z = 1e8` (latent). Two rows are SHIPPED (a forecast arm's probability readout; no golden moves); no fold-back row; `run_all` is now **69 steps, 38 gated, 0 fails** |
| [054](cycles/CYCLE-054.md) | Does the measurement layer (`analysis/backtest.js` + its instrument `analysis/performance.js`) mean what it says? (L10; new L10-bp…L10-br) | F-70: **SUPPORTED — both halves validated against independent references; the hit rate's exclusion is unimplementable as documented and counts exit costs as misses, the fold scorer re-lags inside the test slice, and a probe's negative-MinTRL lead is disproved.** `e62_backtest_audit.js` (26/26 guards, 4.13 s) verifies `erf` vs **Simpson quadrature** (max err **1.393e-7** < 1.5e-7), `normalCdf(0) = 0.5` exactly and odd, `normalInvCdf` round-tripping **2.46e-10** vs a **Lentz-erfc** reference (< 1.15e-9) and antisymmetric to 2.8e-14, the moment conventions (`kurtosis([1..5]) = 1.7`, `stdSample = √2.5`), the Lo (2002) SE = `√(1.5/99)`, PSR **exactly 0.5** at its benchmark, DSR = PSR at the expected-max hurdle to **1e-15** (with DSR ≤ PSR and `expectedMaxSharpe` reproduced to 5.1e-11, ∝ √V and monotone in trials), MinTRL = **13.1749455166** vs the documented 13.174945 and an independent recompute (13.17494554), and the stationary bootstrap size-calibrated on **1000** i.i.d. noise series (**5.9 %** at 5 %, **11.0 %** at 10 %, mean p **0.502** — the repo's 5.8 % claim reproduced), plus the backtest arithmetic (positions lag one bar; turnover counts the initial entry; gross/cost/net recomputed to 1e-15; equity `[1,1.1,0.88,0.924]`; drawdown 0.5/0.19/0; tradeCount transitions; the break-even identity; the participation fields), a `poolFolds` restatement identity (and equality with a direct `poolFolds`), and `purgedCVBacktestAsync` **byte-identical** to the serial path. Three rows: **L10-bq** (headline) — `hitRate(strategyReturnSeries)` receives **only returns**, so its "bars with no position are excluded" docstring is unimplementable, and the implemented `r === 0` skip drops a zero-return in-market bar (**0.6667** vs 0.5) while `backtestMetrics` feeding it the **net** series makes every exit-cost flat bar a **miss** (**0.5** vs **1.0** for a perfectly-timed 3-round-trip book at 10 bps); the shipped check's flat bars *are* its zero-return bars, so it cannot discriminate; **L10-br** — `scoreFold` re-lags the signal **inside** the slice (`pos[0] = 0`), so on the supported fixed-signal path the first bar of every fold is flat and a **CPCV** run boundary holds the previous *test* bar's signal (bar 30 pooled **+0.05** vs the global **−0.05**; 3/64 bars differ on a 4-fold split) — latent; **L10-bp** — the negative-MinTRL probe lead is **DISPROVED** by **Pearson's inequality** (`kurt ≥ skew² + 1` ⇒ `v ≥ (1 − skew·SR/2)² ≥ 0`; a 60 000-histogram search bottoms at `v = −2.4e-15`, 20 000 random series violate nothing, MinTRL from measured moments ≥ **2.17**), leaving the real residual that a **NaN** sharpe yields Infinity and is labelled `beyond-horizon` instead of `unavailable`. Report-level/latent; no fold-back row; `run_all` is now **70 steps, 39 gated, 0 fails** |
| [055](cycles/CYCLE-055.md) | Does the causal signal family (`analysis/features.js`) mean what it says? (L10; new L10-bs…L10-bv; L10-e settled) | F-71: **SUPPORTED — the causality and abstain contracts hold exactly for all 16 candidates and every reference is exact to 1e-12; four latent/export-level defects.** `e63_features_audit.js` (11/11 guards, 70 ms) verifies causality (strict-future perturbation → 0 mismatches over 16×100 bars; non-vacuous), the abstain contract (returns-only view → 0 on exactly 5 channel-dependent candidates; degenerate series finite in [−1,1]; `clampPosition` exact), and 13 single-feature references exact to 1e-12 (`momentum, fracDiffAt, fracMomentum, volRegime, momentumAgreement, rangeLocation, volumeImbalance, autocorr1, acceleration, reversal, reversalWindow, reversalVol, volScaledMomentum, blendedMomentum`) with `fracDiffAt` = the shipped `fractionalDiff(log closes, 0.4, 16)`; the cross-section and regime gate match their references; **L10-e SETTLED** (`{close}` singular → `rangeLocation` NaN, `positionAt` 0; `{closes}` → 0.0211625225). Four latent rows: **L10-bs** (headline) — the `std is 0` abstain guard is defeated by rounding (an exactly-constant window leaves `std` a denormal positive → the feature reads `|z| = sqrt((n−1)/n)` = **−0.9682458366**/**−0.9842509843**/**−0.9746794345** for n = 16/32/20, a **0.468–0.492** position at saturation 2 from an information-free feature; the guard fires only where the mean is bit-exact, e.g. the 0.03125 fixture, so the shipped test gives no warning); **L10-bt** — `finiteSum` on an empty range returns **0** where `meanOf` returns **NaN**; **L10-bu** — `networkMomentum` self-skip `i === panel.streamIndex` never matches when `streamIndex` is absent (**−0.9066812992** with vs **−1.8820447956** without); **L10-bv** — `regimeGatedMomentum` scales the crash gate by the momentum window variance, not the gate window (**−0.0806448623** vs **−0.0922736938**, ratio **1.309**). Latent; no fold-back row; `run_all` is now **71 steps, 40 gated, 0 fails** |
| [056](cycles/CYCLE-056.md) | Does sample uniqueness (`analysis/uniqueness.js`) mean what it says? (L10; new L10-bx…L10-bz) | F-72: **SUPPORTED — the average uniqueness and ESS identities are exact (and the shipped `overlapUniqueness` matches bit-for-bit), but the sequential bootstrap is length-biased (it weights by the uniqueness sum, not the average) and is not the AFML ch.4 algorithm it cites.** `e64_uniqueness_audit.js` (8/8 guards, 82 ms) verifies `sampleUniqueness` against an **independent per-bar scan-all-spans** recompute to 1e-12 (`[[0,2],[1,3]]` -> **2/3, 2/3**; `[[0,0],[0,5]]` -> **1/2, 11/12**) and against the shipped `hivemind/training/sample_weights.js#overlapUniqueness` to **exactly 0** (8 fixtures); it is per-label order-invariant and the ESS identities hold (point labels -> **n**; `ESS = sum`; `averageUniqueness = ESS/n`; `ESS <= n` — 6 overlapping labels read **5.5833**; empty -> []/NaN/0); `sequentialBootstrap` is deterministic per seed, in range, defaults size to `n` and returns [] on empty. Three rows: **L10-bx** (headline) — the draw weight is the uniqueness **SUM** (`avgU[i] = acc`), not the average the comment/ch.4 specify, so two NON-overlapping labels with identical (maximal) average uniqueness are drawn in proportion to their lengths (first-draw P(3-bar) measured **0.7480** vs the intended **0.5000**; a 1/2/3-length fixture reads **0.1688/0.3299/0.5014** vs 1/3 each); **L10-by** — the implemented heuristic (static numerator, `1/(1+count)` conditioning) is not the AFML ch.4 sequential bootstrap (which recomputes each candidate’s average uniqueness against the current selection) — on `[[0,1],[0,1],[2,3],[2,3]]` the second-draw law is **1/7,2/7,2/7,2/7** vs AFML **1/6,1/6,1/3,1/3** (TV gap **0.1190**); **L10-bz** — spans are unvalidated (zero-length -> NaN, poisoning the ESS; negative-length -> -0). All test-only/latent; no fold-back row; `run_all` is now **72 steps, 41 gated, 0 fails** |
| [057](cycles/CYCLE-057.md) | Does the stream design layer (`analysis/streams.js`) mean what it says? (L10; new L10-ca…L10-cb) | F-73: **SUPPORTED — the resampler, the Kish design-effect identities and the greedy selector are exact against independent references; a constant stream is counted as a full unit of effective breadth, and `maxStreams <= 0` means unlimited.** `e65_streams_audit.js` (9/9 guards, 16 ms) verifies `resampleCandles` against a **hand recompute** to 1e-12 (factors 2/3/4/7 x keepIncomplete) with every OHLCV invariant (open = first open, close = last close, high = max finite high, low = min finite low, volume = sum, timestamp = first), never mutates its input, `factor === 1` is a shallow copy, a trailing partial group is dropped unless `keepIncomplete` (10 bars / factor 4 -> 2 groups, keep -> 3; 3 bars -> 0 / 1), a bad factor (`0, -1, 1.5, NaN, `2``) or non-array throws, and the non-finite fallbacks hold (missing high/low -> max/min(open,close); a missing volume counts as **1**); `designEffectOfStreams` satisfies **every** Kish identity (`rawBars = K*T` 720, `designEffect = 1+(K-1)*rbar` 2.9458671265, `effectiveBars = rawBars/DE` 244.4102, `effectiveStreams = K/DE` 1.0184, `effectiveBarsPerBar = 1/DE`) with rbar = an independent mean pairwise correlation to 1e-15 (0.9729335633), reports K=1 as the trivial panel (DE 1, effectiveBars = rawBars = T), identical streams as one bet (rbar **1**, DE **2**/**3**, effectiveStreams **1**), aligns different lengths on **T = min** (240/120 -> T 120), chooses `fold-sharpe` iff the fold tiles T (rbar 0.2657996327 = an independent segmentation) and abstains on the degenerates; `selectStreams` is deterministic, tie-breaks by label (a fully redundant pool -> `[`x`]`), monotone in effective bars, computes marginalBars/marginalEfficiency exactly, and honours a positive `maxStreams`. Two latent rows: **L10-ca** (headline) — a zero-variance (constant) stream is **skipped from `rbar` but still counted in `K` and `rawBars = K*T`**: adding one constant stream leaves rbar **bit-identical** (−0.0133166822) yet takes `effectiveStreams` **2.0270 -> 3.0821** and rawBars 480 -> 720, so a no-information stream buys a full unit of breadth, while `selectStreams` **does** skip it (the two shipped functions disagree); **L10-cb** — `maxStreams <= 0` is treated as **UNLIMITED** (`0` and `-3` both select the full greedy set instead of none; the shipped check only tries 2). Diagnostic-layer/latent; no fold-back row; `run_all` is now **73 steps, 42 gated, 0 fails** |
| [058](cycles/CYCLE-058.md) | Does the audited evaluation world (`analysis/world.js`) mean what it says? (L10; new L10-cc…L10-cd) | F-74: **SUPPORTED — the shock, the candle view and the alignment are exact against their documented contracts; a missing `streamIndex` makes the cross-sectional look-ahead audit vacuous, and `maxBars <= 0` flips the slice.** `e66_world_audit.js` (7/7 guards, 49 ms) verifies `shockFactor`/`volumeShockFactor` are **1** at and before `after` and strictly inside `[1, 1+2*probe]` after (probe 0.07 -> max 1.14), deterministic, non-uniform and phase-shifted (t=after+2: price 1.0494 vs volume 1.1369; `probe: 0` a no-op); `shockCandles(null)` is the same array, every bar `<= after` is the SAME object, every bar `> after` a new one with OHLC x `f(t)` and volume x `fv(t)`, the input is never mutated, it is deterministic, the path stays positive and the SHAPE changes (close ratio 1.0001-1.0993); `makeCandleViewFor` returns the real candles on the base pass (`returns = barReturns(closes)`; a caller returns array used verbatim) and on a probe pass a self-consistent tuple (`view.returns === barReturns(view.closes)` exactly) with the past bit-unchanged and all 19/19 future bars moved; `worldFromCandles` aligns candles/closes/volumes/returns and keeps the last `maxBars`. Two latent rows: **L10-cc** (headline) — `panelFor` replaces the own-stream slot only when `panel.streamIndex` matches an index, so with `streamIndex` **absent** (or out of range) EVERY slot stays the unperturbed original while `view.returns` is shocked — a cross-sectional candidate (`sig-reversal-xs`, `sig-network-momentum`) reads its own unshocked series and the look-ahead audit is **VACUOUS** (the trap world.js exists to close; same root cause as L10-bu, opposite consequence); **L10-cd** — `worldFromCandles`'s `maxBars` guard treats `0` as **all bars** (falsy) and `-5` as **drop the first 5** (`slice(-maxBars)`), with a fractional value truncated silently — reachable from `--bars`. Latent; no fold-back row; `run_all` is now **74 steps, 43 gated, 0 fails** |
| [059](cycles/CYCLE-059.md) | Does the order-preserving scheduler (`analysis/parallel.js`) mean what it says? (L10; new L10-ce…L10-cf) | F-75: **SUPPORTED — the queue contract, the failure semantics and the reply adaptation are exact; `normaliseConcurrency` never validates its `max`, and the fold executor silently nulls a malformed `confidence`.** `e67_parallel_audit.js` (7/7 guards, 49 ms) verifies `normaliseConcurrency` maps every non-finite/non-positive width to serial 1 (0, -3, NaN, Infinity, null, undefined, `3`, true, false, 0.5, 1) and floors/caps the rest (2.9 -> 2; 1e6 -> **64**); `scheduleUnits` returns results in **unit order** under an out-of-order completion schedule (finish order 2,1,0,5,4,3,6,8,7,9), calls `exec` exactly once per unit, peaks at exactly the requested concurrency (3, and n when the request exceeds n), reports through `onResult` out of order with a throwing reporter harmless, rejects with the **FIRST** error (two failures -> `e0`), starts no unit past the start window and settles every started exec (`settled === started`, no dangling promise), propagates a synchronous throw, and returns `[]` on empty; and `makeFoldExecutor` maps `{positions, confidence, stats}` to `{signals, confidence, stats}`, passes the request through verbatim, and throws a named malformed-reply for a null/undefined reply or a non-array `positions` (incl. a Float32Array). Two latent rows: **L10-ce** — `normaliseConcurrency` never validates its `max` cap, so `{max: 0}` -> **0**, `{max: -2}` -> **-2** and `{max: 2.5}` -> **2.5** (a non-positive/fractional "concurrency"; not reachable via `scheduleUnits`, which passes max = n >= 1); **L10-cf** — `makeFoldExecutor` throws on a bad `positions` but **silently nulls** a non-array `confidence` (5, a `Float32Array`) and any falsy `stats` (0, missing), so a worker switching to a typed-array confidence would silently lose the R26-3 raw pre-policy confidence the turnover experiment is built on. Latent; no fold-back row; `run_all` is now **75 steps, 44 gated, 0 fails** |
| [060](cycles/CYCLE-060.md) | Does the turnover policy grid (`analysis/holding.js`) mean what it says? (L10; new L10-cg…L10-ci) | F-76: **SUPPORTED — the grid, the restatement surfacing, the ordering/`byId` readout and the formatter are exact; `costBps` is dead, the audit hurdle is unreachable, and the default grid is only shallowly frozen.** `e68_holding_audit.js` (8/8 guards, 45 ms) verifies the grid is the cartesian product `deadZones × scales × holdings` (3×1×3 -> `policies` 9, `rows` 18 for two candidates; each policy `{...holding, deadZone, scale}`), that every row's `turnover`/`grossPnl`/`netSharpe`/`breakEvenCostBps` equals a direct `restateReportAtPolicy(candidate, policy)` recompute to **1e-9**, that rows are non-increasing in break-even with a missing value last, that `byId.best` is the highest-break-even row and `bestPromoting` the highest-break-even promoting one, that `bestTurnoverPolicy` prefers promoting and returns `null` for an unknown id, that the two bail-outs return `available:false`, and that `formatTurnoverSweep` renders the ids and the target. Three latent rows: **L10-cg** — `turnoverSweep` accepts and echoes `costBps` but **never threads it into `restateReportAtPolicy`**, so every `netSharpe`/`dsr` and every promotion decision is at **zero cost** (`{costBps: 0}` and `{costBps: 25}` rows are byte-identical apart from the echo — both `netSharpe` **0.6864950785702724** at dz 0.1 — while a direct restatement at 25 bps reads **−3.156645069841796**; the shipped caller passes `--cost-bps`); **L10-ch** — the `requireCleanAudit` hurdle the caller passes is **structurally inapplicable** because `restateReportAtPolicy` drops the `audit` block (unlike `restateReportAtCost`), so a candidate that **failed the look-ahead audit** still promotes; **L10-ci** — `DEFAULT_TURNOVER_GRID` is only **shallowly** frozen (`Object.isFrozen(deadZones)` false), so `deadZones.push(0.9)` takes the default sweep 48 → 54 policies. Latent; no fold-back row. |
| [061](cycles/CYCLE-061.md) | Does the seed-replication layer (`analysis/replication.js`) mean what it says? (L10; new L10-cj…L10-ck) | F-77: **SUPPORTED — the IQM contract, the stratified bootstrap, the variance decomposition and the CRN criterion are exact; the "IQM" is not the cited Agarwal estimator, and the formatter can mislabel its CI.** `e69_replication_audit.js` (8/8 guards, 359 ms) verifies `interquartileMean` is the rank-slice middle on every hand case (`[1,2,3,4]` -> **2.5**, `[1..8]` -> **4.5**, `[]` -> NaN, `<4` -> plain mean, non-finite filtered); `stratifiedBootstrapCI` is deterministic per seed, seed-sensitive, preserves each stratum size in every replicate (probe statistic = sample length == 12 for strata [4,5,3]), returns `lo <= median <= hi` and abstains on empty/all-non-finite; its empirical coverage of a known mean is **0.92** (400 panels, nominal 0.95); `varianceComponents` satisfies `total = between + within + residual` (1e-9) with the fractions summing to 1 in the pure-between-seed (seedFraction **1**), pure-within-seed (foldFraction **1**), repeated-cell (residualFraction **1**) and mixed (0.02703/0.97297/0) panels, `totalVariance` = the population variance, `<2` obs abstains; `pairedVarianceRatio` = `var(paired)/var(unpaired)` with reduction = 1 - ratio exactly (ratio **0.000635**), abstaining on short / zero-unpaired-variance input and going negative when the pairing hurts; and `seedDistribution`/`formatSeedReplication` carry/render the documented fields. Two latent rows: **L10-cj** — the IQM drops `floor(n/4)` by RANK, not a quarter of the MASS — witness `[0,0,5,10]` reads **2.5** vs the cited Agarwal/`rliable` quantile-filter **1.6667**, and **149/300** right-skewed panels differ (max gap **1.016**); **L10-ck** — `formatSeedReplication({ label, dist, alpha = 0.05 })` prints its OWN `alpha` in the CI label, never `dist.ci.alpha`, so a distribution built at `alpha = 0.10` is printed as **`95%CI`** (its bounds the 90% ones). Latent; no fold-back row. |
| [062](cycles/CYCLE-062.md) | Does the cluster-inference module (`analysis/dependence.js`) mean what it says? (L10; new L10-cl…L10-cm) | F-78: **SUPPORTED — the correlations, the equicorrelation identities, the fold grouping, the jackknife, the Student-t tails and the exact sign test are all exact; the stability flag drops half its own rule and the sign test underflows.** `e70_dependence_audit.js` (10/10 guards, 47 ms) verifies `pearsonCorrelation` = `Σdₐd_b/√(Σdₐ²Σd_b²)` with ±1 monotone and NaN guards (<3 points, zero variance, unequal length), `meanPairwiseCorrelation` averages the finite pairs (`[[1..4],[1..4],[4..1]]` -> **-1/3**); the equicorrelation deff = `1+(K-1)rho` and effective size `K/deff` (K=1 -> 1; non-positive deff abstains); `foldWindowClusters([[1,2,3,4],[5,6,7,8]],2)` -> `[[1,2,5,6],[3,4,7,8]]` with throws on non-rectangular/non-divisible/bad-foldLength; `clusterJackknife` on `[[1,2],[3,4],[5,6]]` gives estimate **3.5**, leave-one-out **[4.5,3.5,2.5]**, se **1.1547005383792515**; `studentTPValue`/`regularizedIncompleteBeta` reproduce the exact df=1 (Cauchy) and df=2 closed forms to 5e-7, t=0 -> 0.5/1, symmetric, and `studentTCritical` inverts them (**1.6895724578** / **2.0301079283** at df=35; table 1.68957/2.03011); `signTest` matches an independent `Σ_{k>=wins} C(n,k)/2^n` to 1e-12 (7/10 -> **0.171875**) with `signTestFloor(n) = 2^-n`; and `pairedClusterTest`/`pairedClusterSignTest` carry the documented fields. Two latent rows: **L10-cl** — `clusterStability.stable` omits the `worstDelta > minDelta` half of its documented rule (witness fractionPositive **0.6667**, worstDelta **-0.5**, `stable: true` where the doc rule says false, coinciding only at the shipped minFraction 1); **L10-cm** — `signTest`'s `pmf0 = 0.5^n` underflows for n >= ~1075, so `{wins:1000,n:2000}`, `{wins:1,n:2000}` and `{wins:2000,n:2000}` all read **pValue 0** while `{wins:500,n:1000}` reads 0.5126. Latent; no fold-back row. |
| [063](cycles/CYCLE-063.md) | Does the decision-grade report (`analysis/decision.js`) mean what it says? (L10; new L10-cn) | F-79: **SUPPORTED — `foldConcentration`, `confidencePersistence`, `nextRunPlan`/`pairedUnitsNeeded`, `promotionAcrossCadences` and the six-block `decisionReport`/`formatDecision` are exact; but `restateReportAtPolicy` carries a stale `foldInputs`.** `e71_decision_audit.js` (10/10 guards, 34 ms) verifies `foldConcentration` reproduces a direct `strategyReturns`+`sharpeRatio` recompute to 1e-12 (top-K shares `8/9`,`15/9`,`9/9` on a total gross 9; signed sums; delete-one-cluster full **-3.5204429235768973**, min **-5.253810564276818**, max **-1.6034020777212812** with the right worst/best index; per-fold marginals = `full - leaveOut[i]`, mean **0.023595765513707272**; a non-positive gross total -> null shares) with explicit-na abstentions; `confidencePersistence`'s pooled within-fold lag-1 (**0.666707822740828**) and half-life (**1.709771604681528**) with no cross-fold pairs; `pairedUnitsNeeded` = the smallest cluster count whose one-sided cluster-t resolves the target (**9** observed / **18** at 80 % power; brute-force agreement) with `reference.pairedMde95 = tCritical(35,0.05)*0.08 = 0.13516579662244632`; `nextRunPlan`'s `barsToDetectDependent = ceil(620*2.95) = 1829`, `clearsBps {0:t,2:t,5:t,10:f}`, timing/cadence blocks; all six `cheapestFlip` kinds; `promotionAcrossCadences` majority-pass + `defaultCatastrophic` veto; and `decisionReport` (`schema 'nl.decision.v1'`, six blocks, referent/run label policies, explicit-na family blocks) / `formatDecision`. One latent row: **L10-cn** — `restateReportAtPolicy` replaces `folds` with restated-position metrics but carries the original `foldInputs`, so a policy-restated report handed to `foldConcentration` mixes bases (gross half from the restated positions vs Sharpe half from the original signals: restated net Sharpe **-5.201698358740081** vs carried-signal Sharpe **-3.5204429235768973**); the shipped `--decision` path restates at cost only (both halves agree at **-3.877740023296727**), so it is latent/export-level. No golden moves and no fold-back row. |
| [064](cycles/CYCLE-064.md) | Do the hivemind numeric kernels (`hivemind/kernels/*`) mean what they say? (L10; new L10-co…L10-cr) | F-80: **SUPPORTED — the finite path is exact for all five kernel bags; but a non-finite guard kills the `+∞` activation, a `|| 1` family replaces a legitimate zero, and the vector helpers disagree on a length mismatch.** `e72_hivemind_kernels_audit.js` (11/11 guards, 18 ms) verifies the finite path (silu/siluDerivative = `x·σ(x)`/`σ(x)(1+x(1−σ(x)))`, sigmoid to 1e-15, softmax, the linalg helpers, RMSNorm/RoPE, the Irwin-Hall normal, the Dirichlet sampler, the MAD proxy, EMA, conformity, the lower nearest-rank percentile, the gradient/spectral norms, and the stateful detectors). Four latent rows: **L10-co** — `_sigmoid`/`_silu` return **0** for `+Infinity` (the `isFiniteNumber` guard runs before the `±100` clamp; `_sigmoid(±100)` = 1/3.7e-44), so a maximally-positive logit reads as probability 0; **L10-cp** — the falsy-zero family (`_computeGradientNorm`/`_computeSpectralNorm` → **1** for the zero input, `_computePercentile` → **1.0** for a 0 value); **L10-cq** — the vector helpers disagree on a length mismatch (`_fastVectorDot` → NaN, `_vectorDot` → 0, `_fastVectorAdd` → a copy of `a`); **L10-cr** — two dead clamps (`_computeDualEMA` 0.8, `_computeNTKStability` −0.1) and `_computeFractalDimension` an ad-hoc clamped dispersion (a constant series reads the max 2). All latent; no golden moves and no fold-back row. |
| [065](cycles/CYCLE-065.md) | The operator's uploaded local run corpus (`src/runs/`) read against the ledger (L10; read-only, no experiment, new **L10-cs**) | **READ-ONLY CROSS-CHECK — the shipped path's own artefacts reproduce the project's multiplicity table and confirm F-01/F-03/F-32/F-69/F-71/F-74/F-77 in production; one new gate coupling.** Seven `npm run analyze` runs; four K=3 momentum A/Bs share **byte-identical `folds.jsonl`** (SHA prefix `a87a1de7b666c3f9`). The K=3/K=6 adj.-DSR columns reproduce the repo's `RUN-ANALYSIS.md` §13.5/§15.4 **exactly** (`sig-accel` **0.9742028** ✓ at K=3, nothing at K=6; `sig-momentum` **0.9487614**/**0.8742840** ✗). Every promotion is the **600-bar window artefact** (F-01/F-13: promoted `sig-momentum` **+1.0848** at `maxBars 600`, break-even **14.64 bps**). `sig-reversal-4` is the corpus's only family-wise-significant arm (family **SPA p 0.4382**, arm StepM p **0.0474**, 87/129 windows, paired p 0.0018) at break-even **1.50 bps** (F-32); `sig-reversal-xs` reads **designEffect 0.361** / **effectiveStreams 12.05 of 8** (F-03/L02). `sig-network-momentum` (top Sharpe **1.3005**) has a **VACUOUS audit** (`reachable 0/288`, 8 violations) — F-71/F-74 live in production. `replication.json` `perSeedMean` is seed-free (F-77/L10-cj); 1h runs are **UNDERPOWERED** (MDE95 **1.044** dependent), 15m powered (**0.382**) (F-02/F-62). **One new row, `L10-cs`:** `walkforward.js#clustersOf` builds the paired test's clusters from `poolReports().streamReturns`, which **includes the funding sleeve**, so appending the sleeve to **byte-identical price folds** flips the promoted arm (`sig-momentum` adjDSR **0.9488→0.9633**, paired Δ **1.1995→1.0977**; `sig-accel` **0.9742→0.9830** but paired Δ **1.1341→1.0364**, p **0.0493→0.0546** ✗) — intended semantics unresolved (triage, not a defect); fix = thread price-only `streamReturns` into `clustersOf` (a LOCKED-module re-freeze). No repo number or lab number moves; no fold-back row. Readout: `RUN-CROSSCHECK.md` (lab), repo `docs/RUN-ANALYSIS.md` §18 (project). |
| [066](cycles/CYCLE-066.md) | Does the REPO's V2 sleeve layer reproduce the lab's published books? (port verification; all three books bit-for-bit on the real panel; new **L10-ct** — the two shells disagree about the book grid) | F-81: **SUPPORTED — the repo's `core/primitives` + `plugins/sleeves` reproduce every published sleeve book exactly.** `e73_port_verify.js` (registered in `run_all`; 10/10 checks — the three books **plus** a 250-trial seeded differential fuzz) imports the repo modules **read-only**, rebuilds the lab's real 8-symbol / 6 557-period carry panel, and drives each sleeve through its `signal()`/`returns()`: the repo **rows** and **returns** equal the lab construction (`e17#buildBook`+`port.js`, `e22#buildMasked`, `e21#xsBookImpl`+50/50 blend) **bit-for-bit**, giving R8 **6.18 / 10× / 46.04** = `e30`, R7 **1.07 / 8× / 182.59** = `e32`, OI **0.92 / 198× / 15.22** = `e50`; the repo `cleanBook` is **fingerprint-identical** to `prototypes/port.js` (`cleanChainIdentical`). **One new row, `L10-ct`:** `e12#buildXsSeries` returns **two** time arrays (outer `times` length n−1 = 6557; `legs.times` length n = 6558) and the lab's two shells read **different** ones (`e17#buildBook` → 6557 rows; `e21#xsBookImpl` handed `times.length` → 6556 rows), so the books sit on grids one period apart and no single rule reproduces all three — the V2 primitives take the grid as an explicit `n`. Latent (no published number is wrong). Read-only; no repo/lab number moves; no fold-back row (it *is* the port evidence). |
| [067](cycles/CYCLE-067.md) | Port record: the REPO's R1 long-sample scorer (lab-side record of the round-33 port; no experiment, no new row) | **PORTED — the repo's `--history=full` mode scores every active signal arm contiguously over the full history and pools it as an equal-weight basket at the run's K.** The F-13 equivalence is a pinned identity (contiguous == walk-forward bar-for-bar, modulo the fold's no-exposure first bar); the long-sample path is deliberately dependence-free (F-14 cost) and the pooled row carries no raw series. `FOLD-BACK.md` R1 → PORTED; repo ledger 2753 → 2768 (`walkforward` 74 → 83, `analyze` 280 → 286; default reports byte-identical). |
| [068](cycles/CYCLE-068.md) | work the round-31 W6 queue first (fixes before new numbers), then lay the W3 foundation — each item with synthetic ground truth in the repo harness and the ledger updated in the same change. | 34a F-61 (`analysis/carry.js`): `carryOnBarGrid` divides by the **observed** funding interval (`observedFundingIntervalMs`, median step) instead of the 8h default; `auditFundingSeries` returns `gridMs` + `medianIntervalMs`; `auditFundingProblems` flags a median-vs-grid interval change. Two `analysis` checks (8h/4h/2h/1h scaling ladder totals 1×/2×/4×/8×; median + flag). 638 → 6 |
| [069](cycles/CYCLE-069.md) | close the W6 remainder that CYCLE-068 deferred (fixes before new numbers), six latent shipped-path defects with synthetic ground truth in the repo harness and the ledger updated in the same change. | F-71 (`analysis/features.js`): `finiteSum` on an empty window is NaN (was 0); `causalZScore` abstains below a scale-aware 1e-12 epsilon (the exactly-constant window whose mean is not bit-exact read /z/ ~0.97 from denormal std); `networkMomentum` abstains without a valid `streamIndex` (was folding the stream's own momentum in); `regimeGatedMomentum` scales the crash gate by the  |
| [070](cycles/CYCLE-070.md) | cut the two load-bearing round-31 gates into code before the next number is believed: A2 (no market-beta promotion) and G2 (a sleeve book scores through the repo's own arithmetic). | R36 A2 (`analysis/dependence.js`): `firstPCWeights` (power-iteration eigenvector from the e1 basis, so perfectly anti-correlated panels converge), `factorNeutralResidual` (OLS beta of the series on the raw first-PC scores), `factorNeutralSharpe` (raw + neutral Sharpe with a scale-aware 1e-12 floor so a ~0-variance residual reads 0, not ±1e11). Six `analysis` checks: unit-vector |
| [071](cycles/CYCLE-071.md) | compose the two new gates into the single object the `--sleeve` driver will score: book economics + factor-neutral hurdle, one call. | `scoreSleeveBook(weightRows, retRows, panel, {costBps})` (`analysis/portfolio.js`, imports the A2 primitive): `{book, neutralSharpe, rawSharpe, panelStreams}`; NaN-neutral without a panel, null on a ragged book. |
| [072](cycles/CYCLE-072.md) | close the last named W6 measurement row (L10-cs) and cut the audit amendment's stress requirement (A18) into executable primitives — both with synthetic ground truth in the repo harness. | L10-cs (`analysis/walkforward.js`): `poolReports`/`restateReportAtCost`/`restateReportAtPolicy` retain the price-only panel (`priceStreamReturns`/`priceStreamFoldLengths`) beside the sleeve-extended one, and `clustersOf` clusters the price panel — so the paired test is byte-identical with or without an identical sleeve on both reports. The DSR design effect still counts the sle |
| [073](cycles/CYCLE-073.md) | land the scoring half of round-31 W2/W3 (MIGRATION-V2 §8 item 1) — every V2.2 sleeve scored through the repo's own gate arithmetic — as the driver-side composer the import law forces, with synthetic ground truth in the repo harness. | `scoreBookReturns(gross, weightRows, {costBps})` (`analysis/portfolio.js`): the `scoreBook` arithmetic factored onto a precomputed gross series (sleeve plugins emit their own P&L, not per-symbol returns, so the dot form cannot score them). `scoreBook` is now a thin wrapper (dot → core); the §K identity check pins byte-equality. Null on empty/non-finite gross or ragged weights. |
| [074](cycles/CYCLE-074.md) | make the audit's tightened G5 (A8) a function call — five computable knobs plus two human attestations — with synthetic ground truth in the repo harness. | `blockSharpes(net, blocks)` (`analysis/portfolio.js`): the per-block Sharpes `worstBlock` reads, factored underneath it byte-identically (the A18 checks pin the equality). |
| [075](cycles/CYCLE-075.md) | land the data-layer half of MIGRATION-V2 §8 item 1 for the carry sleeve — parsed funding rows + spot closes → the aligned `{fRate, basisPnl, times}` panel — with the L10-m/n/o lessons as contract, plus synthetic ground truth in the repo harness. | `buildCarrySleeveView({streams, gridMs})` (`src/sleeve_score.js`, beside the R40 composer): buckets funding rows by grid (sub-grid rows SUMMED — the L10-o fix), intersects to buckets present in every stream (the fixed-split rule), reads spot closes at EXACT bucket boundaries only (no carry-forward — the L10-m fix) with the perp leg from the bucket's own first/last marks, and em |
| [076](cycles/CYCLE-076.md) | close the R40/R42 loop — drive the repo's own `buildCarrySleeveView` + `scoreSleeve` chain on the real 8-symbol panel and check the economics against the stored R8 book, then read the first real-data G5 knobs. | `experiments/e74_composer_verify.js` (11 checks): view coverage (buckets ≥ 6500, 8 streams, null-basis < 5%), economics vs stored R8 (net@4 ±0.5, turnover ±2/yr, break-even ±3 bps), G5 knob identities, G5 verdict false on unscored dsr + unattested decay/unseen. |
| [077](cycles/CYCLE-077.md) | land the W2 acceptance — sleeves as a first-class `analyze` mode (books scored by the gate's metrics, not controller candidates), with everything scored under the browser harness and only the file reads / run-dir writes left to native cover. | `src/sleeve_score.js`: `parseSleeveInputs` (funding + candle JSONL texts → the R42 view + marked/null-basis fractions), `runSleeveReport` (view → `scoreSleeve` → factor-neutral panel → `scoreG5` → the G2 report object with annualized economics), `formatSleeveReport` (the CLI summary). Only carry-dispersion runs on shipped data; the positioning sleeves land `available:false` nam |
| [078](cycles/CYCLE-078.md) | port FOLD-BACK R5 — the cross-sectional demean — as a tool, never an arm (K untouched), with F-03 reproduced through the repo's own functions. | `analysis/features.js`: `panelMean` (masked finite mean, L10-r, <2 live → NaN) + `demeanedFn(fn)` (any returns-computable feature net of its panel mean; siblings through returns-only views so closes-dependent features abstain there by the existing guards; missing panel/bad streamIndex abstains; causal — reads ≤ t only) + `xsMomentum` (the F-03 object, following the `crossSectio |
| [079](cycles/CYCLE-079.md) | land PLAN-round31 P0's W4a design half — the `MemoryBank` interface + registry with the default stack resolving to today's behavior by construction. No engine rewire (that is V2.3 with its own byte-identity gate). | `src/hivemind/memory/contract.js` (new): `BANK_CONTRACT_METHODS` (write/read/decay/merge/consolidate/stats), `BANK_IDS` (episodic/adaptive/semantic/core — the `hiveMind.js` state they own), `ENGINE_BANK_METHODS` (each bank grounded to its shipped methods: episodic → `_updateMemoryBanks`/`_pruneMemory`/`_retrieveTopRelevantProtos`, adaptive → `_updateMemoryBanks`, semantic → `_u |
| [080](cycles/CYCLE-080.md) | close the three W6 rows whose fix is provably behavior-identical at shipped defaults — the rounds-34/35 pattern (claim in a comment is auditable code). | L10-ca (constant stream buys breadth): real shipped-path number change — needs verdict-neutrality proof only native runs can give. Deferred to a native-verified round. |
| [081](cycles/CYCLE-081.md) | land the six W6 rows whose fix is provably behavior-identical at shipped defaults (backfilled 2026-09-30; no contemporaneous cycle was kept). | Round 48: L10-ca/cb/ce/cf/cj/cn fixes (fail-closed design effect, validated limits, throwing fold executor, documented IQM + rliableIqm, restated signals); ten §AP checks; no golden moves. |
| [082](cycles/CYCLE-082.md) | give W4b its measurement footing (backfilled 2026-09-30; no contemporaneous cycle was kept). | Round 49: realizedVolatility + ewmaVolForecast + volForecastSkill in analysis/forecast.js; ten §AQ checks, three lock-registry exports; additive, no golden moves. |
| [083](cycles/CYCLE-083.md) | give W4b's falsifier ("a learned forecaster beats causal EWMA on realized vol, OOS, at matched exposure") a runnable mechanism — the first repo code a model plugs into. | `forecast.js#fitArVolForecast` (causal OLS AR via normal equations + Gauss-Jordan, fail-closed on short/singular trains), `#predictArVolForecast` (history-only one-step-ahead), `#tournamentVolForecast` (half-split OOS skill of EWMA vs AR against the train-mean baseline, winner + beatsEwma flag). Additive; no scored path reads them. |
| [084](cycles/CYCLE-084.md) | apply the F-55 lesson to the E79 headline — a single-split win can be a split pick — before building the gate. | `forecast.js#tournamentVolForecastAcrossSplits` (the half-split tournament at splits 0.3–0.7 with AR win fraction + EWMA-always-positive flag). Additive; no scored path reads it. |
| [085](cycles/CYCLE-085.md) | build the exact mechanism a learner plugs into — a three-way OOS skill of EWMA vs AR vs an arbitrary model forecast. | `forecast.js#tournamentVolModel` (three-way skill vs the actual-mean baseline, ties preferring the references — an exact-clone parks). Additive; no scored path reads it. |
| [086](cycles/CYCLE-086.md) | fold the per-stream tournament into the decide-view — one shipped call rendering the whole panel verdict. | `forecast.js#tournamentVolPanel` (`{id: vols}` → per-stream across-splits + AR-majority/EWMA-clean counts, fractions, unanimity flags; names the failing stream). Additive; no scored path reads it. |
| [087](cycles/CYCLE-087.md) | make the ranking survive the loss function (F-16's own metric) and audit the new OLS solver against synthetic ground truth. | `forecast.js#volForecastQlike` (Patton-2011 `r − ln r − 1` with MSE-style skill vs a baseline; skips non-positive pairs, fails closed on degenerate baselines). |
| [088](cycles/CYCLE-088.md) | close G4's runnable loop — any model function through the three-way at every split, plus a promote/park rule with reasons. | `forecast.js#tournamentVolModelAcrossSplits` (modelFn(train, history) → forecast; train never contains the test bar; throwing/NaN models fail closed) + `#decideVolPromotion` (promote iff model wins ≥ the split-majority threshold, ties preferring references). |
| [089](cycles/CYCLE-089.md) | test whether the AR(1) reference is a choice or a result — higher orders and shrinkage seated beside it OOS. | `forecast.js#fitRidgeArVolForecast` (L2-penalized AR, intercept unpenalized; l2=0 reproduces OLS bit-exactly, l2→∞ collapses to the target mean — both pinned, so the dial is exact at its endpoints). |
| [090](cycles/CYCLE-090.md) | ship the F-01 lesson (window grid as a helper) and close the W4b arc on applied books. | `forecast.js#tournamentVolLadder` (across-splits tournament at every realized-vol window from raw returns; names the failing window). One check initially tripped on its own fixture (window 100 fails before window 2 on 8 bars — the guard names the first failure, correctly) — fixed in the check. |
| [091](cycles/CYCLE-091.md) | give the vol program measurement breadth (range-based estimators) and a literature-grade challenger (HAR-RV), and promote HAR to the reference. | `forecast.js` W4c block (10 exports): `rangeBarVariance` (cc/Parkinson/Garman-Klass/Rogers-Satchell per-bar variances, strict OHLC validation, fail-closed), `rangeRealizedVolatility` (rolling RMS, same `n-window+1` shape as `realizedVolatility`), `yangZhangVariance` (full-sample, with `k`/components exposed), `yangZhangRealizedVolatility` (rolling, exact per-window overnights), |
| [092](cycles/CYCLE-092.md) | open V2.3 (model plugins) with the one learner the evidence endorses as the reference: the base rate nothing beats. | `plugins/learners/base-rate.js` (new): stateful Learner factory — online 0/1 counts with sample weights, `predict` = signed prior 2p-1, `diagnostics` = {n, positives, p}. Pure (contracts only), so the import law holds unchanged. |
| [093](cycles/CYCLE-093.md) | ship the refit grid the sizing payoff refits through, and close the W4c arc on the applied book and the hostile timeframe. | `forecast.js#expandingVolForecasts` (expanding-window refit OOS series for EWMA/AR(1)/HAR with a causal train-mean baseline, configurable minTrain/step/horizons; ties break toward the simpler model). |
| [094](cycles/CYCLE-094.md) | give the learner slot its second measured model: the P1 ridge closed form as a plugin. | `plugins/learners/ridge.js` (new): stateful Learner factory — buffered rows with per-row weights, training-fold standardiser, weighted least squares with the intercept unpenalized, `predict` = signed 2p-1, `diagnostics` = {n, dim}. Pure (contracts only); the import-law question is settled by porting, per the V2.1 precedent. |
| [095](cycles/CYCLE-095.md) | complete the P1 model-class set behind the Learner contract with the MLP arm. | `plugins/learners/mlp.js` (new): stateful Learner factory — buffered rows (unit weights only, refused otherwise), training-fold standardiser, seeded mulberry32 init + Fisher-Yates SGD (full or mini-batch) with L2, `predict` = signed 2p-1, `diagnostics` = {n, dim, hidden, epochs, seed}. Pure (contracts only). |
| [096](cycles/CYCLE-096.md) | ask the slot-level question the three ports exist to answer: does any of them beat the prior out of sample? | `e100_learner_gate.js` (3/3): walk-forward Brier skill vs the base-rate plugin — ridge **+0.0036**, mlp **−0.0222** over 24 cells, all finite (F-110). |
| [097](cycles/CYCLE-097.md) | give the vol program its literature-standard next step after HAR: combinations of rival forecasts, with estimated weights kept honest by a weight-train/weight-test split. | `forecast.js` W4c-y block (7 exports): `fitCombineWeights` (OLS, no-intercept default, singular guard via the shared `w4cSolveNormal`), `inverseMseWeights` (Bates-Granger-style 1/MSE, refuses exact columns), `fitLassoCombineWeights` (deterministic coordinate descent, zero init, soft-threshold), `predictCombine` (NaN fail-closed, matching the predictAr/Har convention), `tourname |
| [098](cycles/CYCLE-098.md) | wire the lab's sizing payoff into the repo as a tested, causal primitive — and settle whether F-111's combination edge survives the sizing transform. | `forecast.js#applyVolTargetScaling` (W4c-z): pure causal scaler — scalar or per-bar-array target, hard cap, skips (never Infs) on non-finite returns, non-positive forecast vols, or non-positive targets; returns scored index + scales + sized returns. |
| [099](cycles/CYCLE-099.md) | confirm or overturn F-111's combination ranking under the robust second skill (Patton 2011), and fix what the abstention exposes. | `tournamentCombineVolForecast` gains an additive QLIKE block (same weight-train/weight-test split, all-positive intersection so all seven arms read identical bars; abstains honestly when fewer than 2 intersection bars); `...AcrossSplits` gains decided/abstained counts, per-model QLIKE wins and combine share; `...Panel` gains QLIKE combine/HAR majorities. No new exports (return- |
| [100](cycles/CYCLE-100.md) | test the stationarity assumption behind F-111's frozen weights: if the best blend drifts, rolling re-fits should beat frozen; if not, F-112's gap is structural. | `forecast.js` W4c-w block (5 exports): `gibbsCombineWeights` (exponential-loss weights, eta=0 is exactly equal weights), `rollingCombineWeights` (per-bar causal re-fits on a trailing window for ols/eq/inv/gibbs/lasso, null before the fitting minimum), `tournamentRollingCombineVolForecast` (frozen OLS vs 3 rolling arms on identical scoring bars, 8 arms), `...AcrossSplits`, `...P |
| [101](cycles/CYCLE-101.md) | wire the measured sizing payoff into the V2 risk layer: the W4c-z scaler as a `RiskPolicy#sizing` plugin, ported (not imported) per the V2.1 precedent. | `plugins/risk/vol-target.js` (new): `volTargetRisk` — `position` is the shipped clamp bit-identical to cap-band; `sizing` vendors the `applyVolTargetScaling` arithmetic loop verbatim (import law forbids analysis/ imports); `sizingForSleeve` applies per-sleeve caps from `VOL_TARGET_SPECS` with the target caller-supplied (a cap is policy, a target is a measurement — documented in |
| [102](cycles/CYCLE-102.md) | wire the measured sizing payoff into the `--sleeve` run mode: score the sleeve book sized through the vol-target risk plugin behind the driver seam, with the target caller-supplied. | `sleeve_score.js`: `trailingBookVol` (causal strictly-before-t trailing RMS, the e105 convention), `parseSleeveSizing` (pure option parser: absent = unsized default path; present needs a positive per-bar vol target, window defaults 24 — BUGS.md #69 errors), `scoreSleeveSized` (base `scoreSleeve` book → plugin `sizingForSleeve` → skipped bars flat at scale 0 on returns AND weigh |
| [103](cycles/CYCLE-103.md) | F-116 left the CLI's scalar mode a documented footgun (targets 18–73× above book vol lever to the cap). Wire the mode that actually carries the payoff: the trailing-mean target as a first-class `--sleeve-sizing=adaptive`. | `sleeve_score.js`: `adaptiveTargets` (the expanding causal mean of the vol forecast — NaN until the first finite-positive vol, which the plugin skips); `parseSleeveSizing` accepts `adaptive` in any case (window still validated, scalar errors unchanged); `scoreSleeveSized` routes `'adaptive'` through the expanding-mean array (scalar path untouched, pinned by a regression check)  |
| [104](cycles/CYCLE-104.md) | `analysis/forecast.js` (~1850 lines, 50 exports, rounds 26–67) is the biggest module left — split it into managed parts per the CYCLE-097 recipe, with zero behavior change. | `analysis/forecast/` (6 parts, byte-exact `copy_lines` moves): `scoring.js` (Brier/Murphy/DM/MCS/comparison/renderer, keeps the original header + the only external imports), `vol.js` (W4b core, zero imports), `range.js` (range estimators + HAR + expanding grid; exports the shared `w4cSolveNormal` instead of duplicating the solver), `combine.js` (frozen combination), `sizing.js` |
| [105](cycles/CYCLE-105.md) | close the two open sizing items — the `voltarget2603` feedback-control | Fresh date-sorted arXiv sweep → `docs/research/raw/arxiv-sweep-2026-09k.json` (76 entries, 12 triaged: 2 already cited, 9 new registry keys, 1 noted alternative). |
| [106](cycles/CYCLE-106.md) | `analysis/walkforward.js` (2264 lines, 37 exports — the protocol layer | `analysis/walkforward/` (7 parts, byte-exact `copy_lines` moves): `returns.js` (signal/position primitives, no imports), `folds.js` (aggregation + R1/R2 scorers), `audit.js` (evaluators + the no-lookahead audit), `power.js` (power/sizing/dependence readers), `report.js` (pooling + the gate), `restate.js` (cost/policy/cadence/exposure restatements), `search.js` (family-wise sear |
| [107](cycles/CYCLE-107.md) | TODO 110 pre-native gate — verify `oi-change` + `toptrader-fade` score their lab levels through the repo `runSleeveReport` (vendored OI, real funding + candles as text) before asking the operator for a native run. | `e112_oi_sleeve_score.js` (15/15, ~2 s, artefact `results/e112_oi_sleeve_score.json`): oi-change net@4 **0.67** / 197x / BE 11.4 (F-45 band), fade **1.054** / 7.93x / BE 185.1 (F-51), both 6606x8, coverage 81%/67%, slopes +0.02/+0.01 (no decay), DSR 0.9305/0.9664. F-123. |
| [108](cycles/CYCLE-108.md) | `src/sleeve_score.js` (884 lines, 23 exports — the sleeve→book→risk→gate | `src/sleeve/` (6 parts, sliced bodies byte-identical to the single file): `registry.js` (ids + resolver), `view.js` (carry view + marks/positioning inputs + OI panels), `scoring.js` (sleeve→single book→cap-band→gate), `evidence.js` (DSR/yearly/first-last), `sizing.js` (trailing vol + adaptive/drawdown + sized re-score), `report.js` (runSleeveReport + formatter). DAG is acyclic  |
| [109](cycles/CYCLE-109.md) | close the TODO 110 native gate from the operator's two uploaded runs | Native gate (read-only artefacts `src/runs/20260930T012415-seed1-sleeve`, `20260930T012431-seed1-sleeve` + npm 132/132): oi 0.670/197.11/11.40, DSR 0.9305, G5 (dsr,decay,unseen); fade 1.054/7.93/185.13, DSR 0.9664, G5 (decay,unseen). Both reproduce e112 to the printed digit — cross-machine determinism of the sleeve path. F-124. |
| [110](cycles/CYCLE-110.md) | `src/analyze.js` (3674 lines, 45 exports — the biggest module left after | `src/analyze/` (4 parts, sliced bodies byte-identical to the single file): `roster.js` (505 lines: constants, variant tables, register contract, guards, policies), `models.js` (587 lines: feature vector, factories, signal wiring — newly exports `emptyModelAccumulator`/`mergeModelStats`/`summarizeModelStats`, previously module-private, for the evaluate/cli parts), `evaluate.js`  |
| [111](cycles/CYCLE-111.md) | per the operator's reprioritisation (HiveMind demoted but NOT | 2603.16886 (918 controlled DL-vs-DLinear-vs-TCN experiments, crypto/4h/24h): directional accuracy ≈50% for ALL MSE-trained models at hourly resolution; ModernTCN best, architecture >> seed. The directional door is shut from the outside too — matches F-110 and e114. |
| [112](cycles/CYCLE-112.md) | close the model track's payoff branch honestly: e115's 1h skill must | `e116_bucket_bigmove.js` (3/3, `results/e116_bucket_bigmove.json`): bucket big-move skill **−0.0105**, 8/24 positive (F-128 NEGATIVE). One self-caught bug (bucket-major spotRet transposition). The e117 timed book is screened OUT. Recent-split positivity (7/8 at split 0.7) recorded, not chased. |
| [113](cycles/CYCLE-113.md) | answer the last book-actionable model question: does the HiveMind | `e117_har_residual.js` (3/3, `results/e117_har_residual.json`): 8h-analogue HAR(1,3,21) per stream, OLS on train, positive-residual label — HiveMind skill **−0.0090**, ≤5/24 positive (best +0.016, noise-shaped). F-129 NEGATIVE, exactly the pre-registered hypothesis. |
| [114](cycles/CYCLE-114.md) | answer the highest-EV locked-core question (is the Sharpe-1.3 | 2607.28323 (passive execution: fill probability decays exponentially with quote distance; price responds linearly to order-flow imbalance): the queue/TOB dynamics that set maker economics live below bar resolution — exactly what e25 already concluded from the bar side (spread estimators volatility-contaminated, selection −0.6…−1.6 bps/fill). |
| [115](cycles/CYCLE-115.md) | implement the F-130 fix in the repo (audit-layer only), pin it in the | `src/analysis/world.js` (R40): probe passes now shock non-own panel slots additively after `after` (the audit's own-returns perturbation law). Arms that never read siblings are unaffected by construction (shock strictly post-`after`, base pass untouched); scored path and goldens unmoved. |
| [116](cycles/CYCLE-116.md) | close the round-86 W6 re-freeze arc on the operator's 132/132 proof, set the | Operator proof accepted: `npm test` 132/132 green (~348 s, 2026-09-30) — the exact gate round 86 asked for (the wrap mirror pins the 856 `analysis` count). |
| [117](cycles/CYCLE-117.md) | operator-ordered end-to-end bug + sanity pass; fix coherence gaps; consolidate docs. | 33/33 browser entries green AI-side, ledger 3119 confirmed; SIGUP states set from the corpus (TODO 102 closed); index table rebuilt 000-116 with 081/082 backfilled; S33 + operator commands (npm test, then the gh re-run). |
| [118](cycles/CYCLE-118.md) | focused test/run scripts (operator request): run only what you need. | scripts/test.sh (quick/names/full), sleeve-runs.sh no-arg no longer runs all, test:quick shortcut; AI-side verified, no ledger impact. |
| [119](cycles/CYCLE-119.md) | fix the gh ENOENT (resolveSymbolFiles one .. short since the round-83 split) and pin it. | cli.js root steps up twice + exported; four §J2 checks (analyze 290-294, ledger 3119-3123); AI-side 294/294; S34; same three operator commands. |
| [120](cycles/CYCLE-120.md) | read the uploaded K=6 re-run as evidence; close TODO 113 (measured-not-promoted). | network clean 288/288 0 viol (P11 RESOLVED), Sharpe 1.3005, adjDSR 0.8654 single binding hurdle; vol nearest (0.9173); momentum~regime r=0.9964 → TODO 114 trims gh roster; S35; docs only, no operator commands. |
| [121](cycles/CYCLE-121.md) | close TODO 114 (gh K=6→K=5); run e119 on the decorrelated-XS question. | trim verified AI-side; e119 9/9 NEGATIVE (F-132: demeaned 0.09, z-scored 0.20 — edge was market); direction CLOSED for 1h panel; S36; AI-side only, no operator commands. |
| [122](cycles/CYCLE-122.md) | test W5.4 frequency breadth (e120); file the symbol-breadth follow-up. | e120 7/7 NEGATIVE (F-133: xf corr ~0.90, stacked effStreams 1.73→1.80); W5.4 CLOSED; 111-tail DATA-BLOCKED; TODO 115 (mid-cap harvest+e121); S37; no operator commands. |
| [123](cycles/CYCLE-123.md) | harvest midcaps + run e121; close TODO 115, file 116. | 216/216 zips, zero gaps, vendored (~17MB); e121 6/6 SUPPORTED (F-134: stacked effStreams 2.35, rbar 0.51→0.39); calibration 1.0848; S38; no operator commands. |
| [124](cycles/CYCLE-124.md) | round-94: reality_check split (foundations) + 09z sweep + wave-2 harvest + e122. | split verified (locks 41/analysis 856/contracts 255/walkforward 90/analyze 294, e58 39/39); 09z files 8 grounded notes; 216/216 wave-2 zips zero gaps; e122 6/6 MIXED (F-135: S24 2.63 vs S16 2.35, 1.12x); S39; `npm test` owed. |
| [125](cycles/CYCLE-125.md) | cli.js (1826 lines, biggest code module) → cli/ ×4 + shim; 10a sweep (8 notes); midcap funding 216/216 + e123 | contract exact (analyze 294/locks 41/contracts 255, shims bundle, orchestrator intact); TIA 4h grid tolerated; e123 4/4 (F-136: 2466×8 available, net 18.11 vs 11.26 descriptive); S40; `npm test` owed. |
| [126](cycles/CYCLE-126.md) | evaluate.js (764 lines) → evaluate/ ×3 + shim; e124 stacked-16 carry; 10b sweep (TODO 88 task-defined) | contract exact (294/41/255); wiring audit 124/124; e124 4/4 (F-137: 16-wide available, corr −0.02 SUPPORTED); S41; `npm test` owed. |
| [127](cycles/CYCLE-127.md) | decision.js (689 lines, registered) → decision/ ×5 + shim + registry/locks; e125 flow-reversal; 10c attempted | 856/294/41/255 green; guard bug self-caught by harness; e125 3/3 NEGATIVE (F-138: no quintile gradient); S42; `npm test` owed. |
| [128](cycles/CYCLE-128.md) | models.js (587 lines) → models/ ×5 + shim; e126 dispersion-sizing; 10c blocked | 294/41/255 green first try; e126 3/3 NEGATIVE (F-139: turnover mechanism, flat stands, TODO 119 filed); S43; `npm test` owed. |
| [129](cycles/CYCLE-129.md) | roster.js (505 lines) → roster/ ×3 + shim (analyze/ fully modular); e127 quantized-sizing; 10c (1 grounding) | 294/41/255 green; two path bugs self-caught; e127 4/4 NEGATIVE (F-140: rank-not-level); S44; `npm test` owed. |
| [130](cycles/CYCLE-130.md) | candle_fetcher.js (655 lines) → candle_fetcher/ ×5 + shim; e128 rank-persistence; 10d blocked | exact 28-name contract (fetcher 111/0, candles 192/0); one self-caught import; e128 4/3 NEGATIVE-descriptive (F-141: raw ranks churn, slow EWMA constructs); S45; `npm test` owed. |
| [131](cycles/CYCLE-131.md) | dependence.js (556 lines, registered) → dependence/ ×3 + shim + registry/locks; e129 smoothed-rank | exact contract (locks 41/0, analysis 856/0 first try); e129 4/4 SUPPORTED (F-142: EWMA manufactures rho1 0.99, raw replicated); 10d still paused; S46; `npm test` owed (covers R100+R101). |
| [132](cycles/CYCLE-132.md) | features.js (545 lines, registered) → features/ ×4 + shim + registry/locks; e130 lambda-plateau; 10e (6 notes) | exact 29-name contract (locks 41/0, analysis 856/0 first try); one self-caught import; e130 4/3 (F-143: plateau range 0.03, turnover sign corrected); S47; `npm test` owed. |
| [133](cycles/CYCLE-133.md) | backtest.js (410 lines, registered) → backtest/ ×3 + shim + registry/locks; e131 cap-plateau; 10f (5 notes) | exact 13-name contract (locks 41/0, analysis 856/0, walkforward 90/0, analyze 294/0 first try); one self-caught import; e131 4/4 SUPPORTED (F-144: cap plateau range 0.02, binds monotonically); S48; `npm test` owed. |
| [134](cycles/CYCLE-134.md) | scoring.js (521 lines, registered) → scoring/ ×3 + shim + registry/locks; e132 stacked-cap; 10g (3 notes) | exact 11-name contract (locks 41/0, analysis 856/0, walkforward 90/0, analyze 294/0 first try); no cross-calls; e132 4/4 SUPPORTED (F-145: stacked plateau range 0.01, caps ≥ 0.25 no-ops); S49; `npm test` owed. |
| [135](cycles/CYCLE-135.md) | restate.js (555 lines, registered) → restate/ ×3 + shim + registry/locks; e133 predictive-smoother; 10h (thin) | exact 7-name contract (locks 41/0, analysis 856/0, walkforward 90/0, analyze 294/0 first try); one unused import dropped; e133 4/2 NEGATIVE (F-146: predicted 0.70/0.72 lose to 0.992); S50; `npm test` owed. |
| [136](cycles/CYCLE-136.md) | report.js (513 lines, registered) → report/ ×2 + shim + registry/locks; e134 cost-ladder; 10i blocked | exact 3-name contract (locks 41/0, analysis 856/0, walkforward 90/0, analyze 294/0 first try); one unused import dropped; e134 4/3 (F-147: majors crosses above ladder, stacked at 25bps); S51; `npm test` owed. |
| [137](cycles/CYCLE-137.md) | bootstrap.js (574 lines, registered) → bootstrap/ ×3 + shim + registry/locks; e135 stacked-band; 10j (5 new + 3 convergence) | exact 12-name contract (locks 41/0, analysis 856/0, walkforward 90/0, analyze 294/0 second run); one self-caught import + one registry correction; e135 3/3 SUPPORTED (F-148: band transfers, best 0.01 at 0.44, smooth); S52; `npm test` owed. |
| [138](cycles/CYCLE-138.md) | subsampling.js (536 lines, registered) → subsampling/ ×2 + shim + registry/locks; e136 band-holdout; 10k (4 new + 5 convergence) | exact 6-name contract (locks 41/0, analysis 856/0, walkforward 90/0, analyze 294/0 first try); mean import dropped; e136 4/4 SUPPORTED (F-149: pick 0.01 at 8/8, frozen + fixed beat daily 8/8); S53; `npm test` owed. |
| [139](cycles/CYCLE-139.md) | vol.js (405 lines, registered) -> vol/ x2 + shim + registry/locks; e137 portfolio audit; 10l partial | exact 14-name contract (locks 41/0, analysis 856/0, walkforward 90/0, analyze 294/0 first try); e137 27/27 SUPPORTED (F-150: scoring path exact, no L10 rows); S54; `npm test` owed. |
| [140](cycles/CYCLE-140.md) | coherency sweep: 78 unused bindings removed (26 files), doc sync, backlog rerank + 6 archived, 10l carryovers closed as 10m | 0 dead targets repo-wide + lab cross-tree; browser 3123/0 ledger-equal, e136 4/4 + e137 27/27 re-green; F-151; `npm test` owed (R109 + sweep). |
| [141](cycles/CYCLE-141.md) | sweep S2 bug-hunt: shim contracts both directions, DAG/CJS, ledger/mirrors, lineage/goldens/registry, results reds, corpus gap | 0 problems everywhere checkable; 2 doc fixes + deliberate-keeps recorded; F-152; `npm test` still owed. |
| [142](cycles/CYCLE-142.md) | sweep S3 cross-doc consistency: DROPPED↔lineage, FOLD-BACK queue, THEORY frontier | 12/12 DROPPED named; R8 band-0.01 + J5 risk-layer gaps closed; F-153; `npm test` still owed. |
| [143](cycles/CYCLE-143.md) | sweep S4 lead refresh: archived cross-refs, PROTOCOL compound statuses, 5 lead files to latest measurements | verdicts unchanged; F-154; `npm test` still owed. |
| [144](cycles/CYCLE-144.md) | sweep S5 dead-import round two (23 across 16 files, two batches), 10l JSON repair, sweep 10n, rerank refresh | 0 dangling/cycles/CJS in 303 files; entries green ledger-equal, e58 39/39 + e63 11/11; F-155; `npm test` still owed. |
| [145](cycles/CYCLE-145.md) | sweep S6 alias-aware re-scan (0 dead/dangling/cycles), shim + registration census, ledger-shape audit, STATUS.md pointer, rerank refresh | shims 18/18; run_all 152 steps / 138 exps; 33 entries / 45 mirrors ledger-equal; F-156; `npm test` still owed. |
| [146](cycles/CYCLE-146.md) | shim audit S7: page-ESM probe 10/11, analyze.js node:url latent fix (L10-cu) | dispatch preserved (node CLI/test/worker/harness unaffected); F-157; `npm test` owed (now covers the fix). |
| [147](cycles/CYCLE-147.md) | registry census S8: 916/916 exports resolve, 30/30 proves refs, 72/72 lead cites | capability registries exempt by shape; F-158; `npm test` still owed. |
| [148](cycles/CYCLE-148.md) | reference census S9: 301 doc refs, 6 stale exonerated, 12 pre-split coordinates, standing rule | frozen history left intact; F-159; `npm test` still owed. |
| [149](cycles/CYCLE-149.md) | collision census S10: 883 names, top-30 benign chains, L10-cv/cw latent rows, no miswiring | single-source proposed for weight tools; F-160; `npm test` still owed. |
| [150](cycles/CYCLE-150.md) | ledger sync S11: 43/43 raws parse, 11/11 goldens, R4 port status appended | queue otherwise current; F-161; `npm test` still owed. |
| [151](cycles/CYCLE-151.md) | ledger arithmetic S12: table sums to 3123, data dirs 9 files each, THEORY folded | no gaps; F-162; `npm test` still owed. |
| [152](cycles/CYCLE-152.md) | gate CLOSED (operator 132/132 ~350 s) + re-verification: S7 fix intact, 0 dead (1 exonerated), run_all 138/138, ledger 81+81 | no owed gate; F-163. |
| [153](cycles/CYCLE-153.md) | opens audit S14: all 18 opens re-checked, dispositions stand, archive bar not met | rerank unchanged (116→118→117); F-164. |
| [154](cycles/CYCLE-154.md) | doc-pointer sync S15: STATUS/README/INDEX/FINDINGS/TODO/RUN-ANALYSIS counts + gate | no live "owed" line at write time (post-write grep); F-165. |
| [155](cycles/CYCLE-155.md) | next-step plan: post-109 roadmap (PLAN-next.md), no code | phases A-D + parked; rerank unchanged. |
| [156](cycles/CYCLE-156.md) | pre-point sweep S16: 0 dangling, plan refs resolve; sweep 10o (4 notes); Phase-A recipe audit (GAP 1 needs round 110) | F-166; gate still owed. |
| [157](cycles/CYCLE-157.md) | round 110: sleeve risk-spec override flags + band stage (A2 enabler) | analyze 298/298 AI-side; F-167; npm test 133 owed. |
| [158](cycles/CYCLE-158.md) | experiment e138: vol-tournament level alignment 8/8, flip needs >= 1 sigma | 10o-1 closed, no L10 row; F-168. |
| [159](cycles/CYCLE-159.md) | coherency sweep C1: ledger/test/run_all counts verified, stale pins fixed, analyze 298/298 AI-side | STATUS/RUNBOOK/TODO/PLAN-next updated; operator queue 121 → 116 → 118 → 117 turnkey. |
| [160](cycles/CYCLE-160.md) | Phase-D scoping: 84/85/87 — P2 machinery already pinned, 87 needs no code, 85 proposal recorded | application runs queued on 116; matched-exposure-only proposed, family thresholds rejected. |
| [161](cycles/CYCLE-161.md) | research sync 10p: decay/MRP task form for C3 + 4 convergences + L07 unchanged | snapshot filed; README later-sweeps list updated. |
| [162](cycles/CYCLE-162.md) | D2 L10-hygiene review (read-only): dual SE agrees to off-by-one, weight tools canonical-vs-legacy, stale R8 0.005 trap inert | no code; both cleanups proposed owner-gated. |
| [163](cycles/CYCLE-163.md) | 121 pre-verification: base + honest score AI-side, band dividend confirmed shape, honest level 6.25 vs 11.26 | turnkey proof + predicted comparators for the native runs. |
| [164](cycles/CYCLE-164.md) | bug-check round: none/null alias-sentinel fix, 15/15 unit + 298/298 + 31/31 wiring re-proof | native npm test re-owed by the 2-line scoring.js change. |
| [165](cycles/CYCLE-165.md) | banking the 121 pair: base confirms pre-read, DE 32.6→2.8 + decay artefact via honest marks | 121 closed; G5 must score the honest book. |
| [166](cycles/CYCLE-166.md) | mechanism + trust test: null-basis rows earn funding-only, ext exact to 0.004%, midcap funding has zero marks | decay = measurement-regime change; 118 honesty gate set. |
| [167](cycles/CYCLE-167.md) | 116 port package: midcap 8/8 verified (19728 rows, 0 gaps), byte-exact copy + manifest + 3 run commands | §76 legs folded in; repo §83 is the executable recipe. |
| [168](cycles/CYCLE-168.md) | full bug + sanity sweep: 27/27 + 7/7 re-proof, fixed §83 file-count (15 not 16) + added bare-flag native case | 2 issues found, both fixed in place. |
| [169](cycles/CYCLE-169.md) | 116 turnkey script: one command (port+gate+runs, self-checked, idempotent manifest edit) | manifest edit replay-verified; §83.1 + TODO 116 point at it. |
| [170](cycles/CYCLE-170.md) | standalone-rule fix: 8 midcap series ported byte-exact into repo src/data/; script verifies in place, zero lab refs in scripts/ | TODO 116 + §83 rewritten to match. |
| [171](cycles/CYCLE-171.md) | 116 investigation: breadth without edge — half-gate + 87 pass, all keep-off, test=10 shift reproduces | 117 park recommended; 118 next. |
| [172](cycles/CYCLE-172.md) | 116 deep-dive: per-variant fold-stats table, sign-gap mechanism, TIA benign; created PLAN.md | 117 parked; 122 opened; S1 operator's. |
| [173](cycles/CYCLE-173.md) | executed S3: 122a gap explained, 122b run.json P2 flags + native test, 122c power bound; research sync 10q | 122 done AI-side; 122b native owed. |
| [174](cycles/CYCLE-174.md) | director rule locked; S1 resolved by harvest (marks_midcap + stacked16 land in repo); 118 script ready | S2 queued; operator runs S0+S2. |
| [175](cycles/CYCLE-175.md) | sanity sweep on CYCLE-174 touch set: fixed $0-recursion + added manifest guard; verified resolution order + parser compat | 2 issues fixed; S0+S2 unchanged. |
| [176](cycles/CYCLE-176.md) | 118 investigation (3/4 stages) + S4 G5 attestation decided: unseen PASS, decay FAIL measured | mid flat missing; S6 allocation next. |
| [177](cycles/CYCLE-177.md) | 118 complete (4/4): mid-flat deep dig — haircut exact (45% retained), BE inversion, lane-independent decay; S6 allocation plan scoped | S0 owed; S6a AI reads; S6b design before runs. |
| [178](cycles/CYCLE-178.md) | S6a executed (7/7): trailing hedge fails (no overlay), D-14 corrected to first-PC hedge, band/decay attribution, S6b/c fleshed with gates | S0 owed; S6b DESIGN (AI); native runs after. |
| [179](cycles/CYCLE-179.md) | S6b executed (5/5): blend frontier bulges inward — operating blend a=0.25 decided (9.87/62.0); research 10r synced (8 grounded); touch-set sweep clean | S0 owed; S6c gated-open. |
| [180](cycles/CYCLE-180.md) | evaluation + rerank (no code): native gate closed (134/134), 20261002 run dirs removed (no impact — numbers re-derivable), full open-item rerank, N1–N4 plan | No operator load; S6c next (AI). |
| [181](cycles/CYCLE-181.md) | S6c executed (6/6): scenarios 9.87/7.31/4.67, L≤10 interim (judgment), cap rule, OI 8/16 gap; S6e/S6f opened; research 10s (4 grounded); sweep clean | No operator load; S6e DESIGN next. |
| [182](cycles/CYCLE-182.md) | CORE PIVOT: full HiveMind/Legion map, weights/memory/transformer verdicts, model plan M1–M6 (M1 benchmark first, M2 gated, M3 spec, M4 wire-or-drop); research 10t (7 grounded) | No operator load; M1 DESIGN next. |
| [183](cycles/CYCLE-183.md) | CORE READ from source: Llama-block + spec-modulation + distill sandwich + mean-pool readout; per-component verdicts (keep/retire-test/needs-testing/replaceable with groundings); fleshed M1 spec; research 10u (5 grounded) | No operator load; M1+M4 execution next. |
| [184](cycles/CYCLE-184.md) | FULL CORE MAP controllers→core (L0–L6 with file paths): 5 incorrect-as-designed, 8 needs-testing probes, 9-row replacement table with groundings/gates; research re-sync (no new sweep); exact M1/M4/M3/S6e handoff | No code touched; no operator load; M1 execution FIRST. |
| [185](cycles/CYCLE-185.md) | ONE LEVEL DEEPER: regulation-layer mechanism (spec-modulation amplifies noise at zero skill — A17 sharpened to identity-spec ablation); broadcast dead path quantified with M4 acceptance; kernels confirmed exact; 10v deltas (TSFM-probe 29/30 confirmed, EGGROLL-v2 M5 population rule, AdaRDiff M1-ext trigger); work orders | No code touched; no operator load; M1 FIRST (+probe expectation), M4 parallel, M3 after M1. |
| [186](cycles/CYCLE-186.md) | S6e EXECUTED 6/6: unit maxDD 0.072% (maxDD-sizing voided 277×); governor inert/adverse (credited nothing); gap ladder binds → operating L≤5, equity ≤$2.3M; research 10w | S6e DONE-decided; M1 execution FIRST next. |
| [187](cycles/CYCLE-187.md) | M1 PHASE 1 EXECUTED 3/3 (53k rows): linear 0.24906 skill +0.0038 DM≈0.001 MCS-survive (TARGET nearly-binding); MLP≡base p=0.76 eliminated (ARCHITECTURE fires vs small nets); persistence dies; denoise no-op; phase 2 native-queued | M1 phase-1 DONE; M4 probe next. |
| [188](cycles/CYCLE-188.md) | M4 DECIDED 3/3 both fixtures: easy ceilinged (rerun harder); hard def 0.887/mp 0.987/qm 0.967 — boundary lift → PARK multiprobes+querymod (mp recorded as probe-of-choice); binarypc untouched | M4 DONE-decided; M3 spec next. |
| [189](cycles/CYCLE-189.md) | M3 DELIVERED (docs-only): same-venue L2 + prints + latency spec with sync/history rules; pre-registered E-a/E-b fill-gated builds; research 10x (3 grounded); build needs harvest | M3 DONE; operator queue stacks next. |
| [190](cycles/CYCLE-190.md) | COHERENCY SWEEP (all counts agree; F-148…154 pipe fix; no repo touched → no re-gate owed) + S6f harvest spec with director GO (8 mids, binance-vision zips, oi_8h.json schema, header-dependent aggregator next) + operator download block | S6f harvesting; aggregator next on CSV header. |
| [191](cycles/CYCLE-191.md) | SCRIPT-FORMAT FIX (S6f block → `scripts/s6f-oi-harvest.sh fetch\|sample\|all`; PLAN conventions locked to scripts) + full bug/sanity re-run (s6e 6/6, m1 3/3, m4 3/3+hard, bit-identical; stray artefact deleted, m4 pair restored; shell hazards swept) | S6f harvesting via script; aggregator next on header. |
| [192](cycles/CYCLE-192.md) | LAB PURGE + CORE-CODE UNLOCK AUDIT (director order, docs-only): allocation S0–S6e ARCHIVED, S6f/M3-builds/M1p2 PARKED, operator queue CLOSED, leads L01–L19 ARCHIVED, data pulls BANNED; every locked piece judged KEEP/REDESIGN/PROBE/PARKED; live queue C1→C2→C3 | C1 readout-head replacement next (repo edit + test script). |
| [193](cycles/CYCLE-193.md) | MAP v2 CODE-VERIFIED (docs-only): 3 corrections (C3 reframed to live-reader upgrades-or-delete-broadcast; sandwich = 1 scaled task + KD per window; optimizer is moment-free SGD); scores.js mechanism pinned (Brier root diluted by trust/spec blends; dispersion reward; laggard-rescue LR; agreement herding); legion six-boost + noise-seed pinned; research appendix + 3 gated needs | C1 readout-head replacement next (repo edit + test script). |
| [194](cycles/CYCLE-194.md) | DEEP LAYER (docs-only): dims = shape-packing (replace post-skill); tier>1 stream-disconnected by construction (skill PROBE — may be noise amplifier); quality exponents arbitrary; Brier ledger + dedup KEEP; intra-hive sharing is the LIVE transfer; init KEEP. Fresh 10y/10z (4 grounded): uniform-pool beats learned-weighting (C1 = A/B/C incl. learned-may-lose); hedged combinations ground S7 | C1 readout A/B/C next (repo edit + test script; read 2510.03339 first). |
| [195](cycles/CYCLE-195.md) | FINAL GAP LAYER (docs-only): prune KEEP + promotion-sign PROBE (worst archive most — possibly harmful); bank architecture best-grounded, dynamics ungrounded; EMA-100 never warms up on 60-bar windows; full leakage-audit recipe specified (runs before post-C1 A/B trusted). MAP COMPLETE; live queue final | C1 readout A/B/C next (repo edit + test script; read 2510.03339 first). |
| [196](cycles/CYCLE-196.md) | PRE-C1 HOMEWORK (docs-only): pooling-bounds abstract read (C1 A/B/C literature-shaped; full text = C1 step 1); consolidation scorer audited (all constants unvalidated → ±20% perturbation probe; sharpness asymmetry noted); merge threshold adaptive KEEP. Standing probe pool = 10, same-harness | C1 readout A/B/C next (repo edit + test script; full text of 2510.03339 first). |
| [197](cycles/CYCLE-197.md) | C1 EXECUTED (harness, 53k rows): lastpos≡meanpool (DM p=0.925, ORDER IRRELEVANT); learned-pool collapses to exactly uniform; MCS survivor flatridge alone. Rule fires → C1 CLOSED, NO repo edit (goldens untouched). Execution phase opened; coherency green | C2 optimizer retire-test next (lab probes; repo-trainer A/B as operator script if needed). |
| [198](cycles/CYCLE-198.md) | C2 PROBES EXECUTED (harness, green): scorer ROBUST (keep); uniqueness NEUTRAL (default-off stands); adamw<sgd (supports swap), distill/laggard add nothing. NATIVE ABLATION SHIPPED (`c2-optimizer-ablation.sh gate\|runs\|all`, golden-safe). Research 11b = noisy-teacher distillation ignored | OPERATOR: run the C2 script, paste back stdout. |
| [199](cycles/CYCLE-199.md) | C2 SCRIPT AUDIT (docs-only): 2 critical + 1 significant + 3 minor bugs fixed in `c2-ablation.mjs` (Adam walker never descended the weight tree; rollback clone ~30× too large; lr double-scaling); all interfaces verified; DM output untruncated; result data sufficient (output-only, no upload) | OPERATOR: `bash scripts/c2-optimizer-ablation.sh all`, paste stdout. |
| [200](cycles/CYCLE-200.md) | C2 VERDICT EXECUTED: runs (n=800) plain_vs_stock p=0.856 → DELETE branch fires, adamw ns → no adopt. Delete applied: `_scaleGradients`→global clip (matrix/vector scalers kept as manifest-contracted dead code), rank-LR retired (homeostasis hook kept), registry notes updated. Firewall owed | OPERATOR: `npm test` (paste failures) → re-bless → post-delete ablation (expect plain≡stock bit-identical). |
| [201](cycles/CYCLE-201.md) | FIREWALL GREEN: `npm test` 134/134 post re-bless (only the 8 trajectory goldens moved; translate/counts intact). Post-delete ablation identity check owed (plain_vs_stock must be meanDiff=0, p=1) → then C2 CLOSED, C3 opens | OPERATOR: re-run the C2 script, paste stdout. |
