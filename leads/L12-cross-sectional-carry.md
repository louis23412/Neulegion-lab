# L12 — Cross-sectional carry dispersion

**Status:** SUPPORTED — **tradable via a cost-aware EWMA-smoothed weight policy (F-24, refined by F-37)**.
The measurement is sound (6.0 years, crash-surviving, mark-price objection cleared by L14/F-22). It
*looked* cost-fragile under the daily rank reshuffle (F-23: 803×/yr, break-even 1.87 bps), but that was
the implementation, not the signal: smoothing the weights (`w_t = 0.9 w_{t−1} + 0.1 w*_t`) cuts turnover
~9× and lifts the break-even to **12.78 bps** while keeping the gross Sharpe (F-24). The λ=0.1 form then
decayed below the fee in 2025–26 (F-36), but CYCLE-020 (F-37) shows a **slower, cost-aware λ** restores it
(recent break-even **27 bps**, net@4 **+3.86**) and that a **walk-forward λ-selection** reproduces the fix
out of sample — so the sleeve is tradable again, given the cadence is chosen by trailing **net** cost.
See lead **L16** for the construction.
**Opened:** CYCLE-001 (new lead — outside the original shortlist)
**Last updated:** CYCLE-038
**Owner experiments:** `e12_xs_carry.js` (also exports `buildXsSeries`/`weightSeries`/`legs`),
`e13_carry_robustness.js`, `e15_traded_basis.js`, `e16_cost_capacity.js`, `e17_low_turnover.js`,
`e27_decay.js`, `e28_regime_retune.js`, `e29_regime_retune_oos.js`, `e30_retuned_capacity.js`,
`e31_ported_spec_oos.js`, `e35_portfolio_mix.js`, `e40_retune_blend.js`, `e41_blend_hindsight.js`,
`e42_cap_hindsight.js`, `e47_split_robustness.js`
**Mix check (CYCLE-026 / F-43).** At the final port spec the re-tuned book's net@4 **second half is +4.66**
(the F-36 decay is repaired), so F-31's 25 % fade allocation is no longer a hedge but a cost — combined
net@4 falls **6.49 → 1.62** and a walk-forward allocation rule picks the fade at **0 % in 11/11 blocks**.
The sleeve stands alone (net@4 6.49, break-even 31.9 bps, both halves positive). Its OI capacity does
**not** add with the fade's: see F-43 / L15.
**λ-policy check (CYCLE-031 / F-48).** The R8 port spec's **walk-forward λ selection rule is optional**:
`e40_retune_blend.js` shows a fixed, unfitted two-scale blend (**λ = 0.01 + 0.02**, equal capital) matches
the λ-only walk-forward out of sample (net@4 **6.66 vs 6.63**) at **half the turnover** (7 vs 14×/yr) and
**1.8×** the break-even (46.1 vs 25.5 bps), and the rule's edge was really over the *broken* λ=0.1 spec.
So R8's λ can be a fixed blend rather than a fitted rule. Open: the pinned λ=0.02 (6.86) is in-sample — a
single λ frozen before the OOS span has not been tested.
**CYCLE-032 (F-49) closed that and scoped F-48 down — the blend claim was menu-dependent.** `e41` shows
only **1 of 10** pre-registered blends clears the 0.2 bar (the cherry-picked `{0.01,0.02}`; the no-hindsight
F-37-slow sets read 5.74 / 6.08), a blend-selection walk-forward reads 5.81, and the blend ranking flips by
window. **But a λ *frozen* on `[0,S)` is robust given enough history**: S ≤ 1.7 y picks the F-37-broken
λ=0.1 (OOS 1.76–1.93), S ≥ 2.3 y picks **0.02** and matches the rule (OOS **6.81 / 6.64 / 4.10** vs
**6.69 / 6.48 / 4.27**). So the recommended λ policy is a **λ frozen on ≥ ~2.3 years of trailing data** —
not a blend — and the walk-forward rule's value is confined to the first ~2 years.
**CYCLE-033 (F-50) removed the last fitted object — the cap.** The joint (λ, cap) walk-forward reads OOS
net@4 **6.13** while the **pinned** `ewma 0.02 + cap12.5 %` book reads **6.86** (pinned ≥ rule on 4/5
sub-spans) — its F-39 edge was over the *broken F-24 spec*. The cap is a **flat plateau** at λ=0.02 (OOS
6.63 / 6.77 / 6.86 / 6.90 for cap none / 0.10 / 0.125 / 0.15; it clips **42.3 %** of weight entries), so
`1/k = 0.125` is **structural, not tuned** — the first OOS confirmation of F-27. **R8's port spec is now a
fully pinned book: λ frozen on ≥2 y + cap = 1/k, no walk-forward.**
**Split-point robustness (CYCLE-038 / F-55).** On a **dense** 14-point split grid the "frozen λ matches the
pinned book" claim narrowly fails the pre-registered 0.80 bar — the **expanding** `[0,S)` freeze is within
0.2 of the in-sample-best pinned book at **0.71** (median gap 0.00), the **rolling 1-year** freeze at
**0.79** (median **+0.30**) — but every failure is in the first ~2 y (the expanding freeze collapses at
S ≤ 2190 and matches at 10/10 splits from S = 2555). So the safe boundary is **~2.3 y**, the broken fast λ
is **0.075** (not 0.1), the rolling freeze beats the expanding one, and the **cap stabilises** the policy
(rolled robustness **0.50 uncapped → 0.79 capped**).
**Prototypes:** `prototypes/signals.js#xsMomentum` (the demanding shape); cross-sectional weights built
in `e12#buildXsSeries`; the **smoothed** weights in `e17` (the R8 spec)
**Result artefacts:** `results/e12_xs_carry.json`, `results/e13_carry_robustness.json`,
`results/e15_traded_basis.json`, `results/e16_cost_capacity.json`, `results/e17_low_turnover.json`,
`results/e28_regime_retune.json`, `results/e29_regime_retune_oos.json`, `results/e47_split_robustness.json`
**Fold-back rows:** **R8** (dollar-neutral rank-weighted carry, **with a cost-aware, walk-forward-slow
EWMA weight policy** — F-37), alongside R4
**Falsifier:** the cross-sectional carry book's full-history Sharpe ≤ the flat book's, **or** its
correlation with the price basket is not lower, **or** its block stability is not better, **or** (F-23)
its break-even cost does not clear a realistic fee.
**Not falsified on statistics** — on the crash-containing 6.0-year history the rank book has a *higher*
Sharpe than the flat book with **one third** the drawdown, is positive in **5/5** full years and **9/9**
named regimes, sits at **z = 12.6** outside a 40-seed permutation null, and on the **traded** perp leg
(CYCLE-007) reads 4.98 Sharpe at 3.05 % drawdown.
**Not falsified on tradability either (F-24)** — the smoothed book clears a 4 bps fee at net Sharpe
**+3.55**, is positive in every crash window, and 7/9 regimes. *Caveat: the edge has decayed since 2024
(2025/2026 ≈ 0 net of fees).*
**CYCLE-019 (F-36) measured that caveat and it is a COST-MARGIN decay, not signal death:** on the aligned
2021-12+ grid the book's **gross** Sharpe trend is flat (ρ −0.35, p 0.39) but its **break-even fell from
10–29 bps (2022–23) to 2.9–3.4 bps (the last two blocks, 2025-07 → 2026-09)** — below a 4 bps fee — as the
per-period edge shrank while turnover rose 75 → 98×/yr. Net@4: 2024 **+5.41** → 2025 **−0.01** → 2026
**−1.88** (net trend ρ −0.79, p 0.023); last-12-months −1.37. So the sleeve remains a *gross* fact but is
**no longer tradable at 4 bps in the current regime**; the F-24/F-26/F-27 break-even/capacity economics are
full-sample. See lead L16 for a possible re-tuned low-turnover construction.
**CYCLE-020 (F-37) recovered it — the decay was the *policy*, not the sleeve:** `e28` shows a slower weight
policy restores the recent cost margin (`ewma 0.01_norm`, 9×/yr: recent-24m break-even **27.07 bps**,
net@4 **+3.86**, net-positive in **9/9** regimes), 7/16 policies clear 4 bps recently with break-even
**monotone in slowness**; `e29` then shows the retune is a **rule, not a hindsight pick** — a walk-forward
selector that cannot see the future nets **+5.71 OOS** (vs the pinned F-24 spec's **+2.76**; recent-24m
**+3.41** vs **−0.53**) across 12/12 parameterisations, while a **gross-blind** selector nets only **+0.28**.
So L12 is **SUPPORTED again**, with the R8 spec amended to a **cost-aware, walk-forward λ** (recent λ ≈
0.01–0.02). **CYCLE-021 (F-38) then sized it:** the retuned book is **OI-bound, not impact-bound** —
usable size **$19 M** (λ=0.01) and **~$36 M** (`ewma 0.02 + cap12.5 %`) vs the λ=0.1 spec's $13.2 M — so
the retune improves both the fee margin *and* the deployable size.

## Claim

L03 (F-04) trades carry *per asset* — every symbol holds its own basis book. But funding is also a
**positioning/crowding** variable, and the informative part of a crowded book is usually the
**relative** crowding. Demeaning the funding rate across the correlated basket (L02's construction,
applied to a *yield* rather than a price signal) isolates the relative component: a dollar-neutral
book with weights `w_i ∝ z(f_i)` that is **long the carry book on the highest-funding symbols** and
**short it on the lowest**, holding the common carry **level** out. Its return is the *dispersion* of
funding, not its level — which is exactly why it does not collapse when the level does.

## Why we care

L02 showed the price panel is one factor and demeaning collapses its dependence. The same is true of
funding — a common level plus a relatively-informative cross-section — so this construction buys
*decorrelated breadth* (the one thing the project cannot manufacture, J3) from a variable already in
the data, and it converts a crash-fragile level exposure into a level-neutral one.

## Evidence

`e12_xs_carry.js` + `e13_carry_robustness.js`, 2020-09 → 2026-09 (6.0 y, 6 558 8h periods):

| book | full history | **old window** | max DD | corr w/ price |
| --- | ---: | ---: | ---: | ---: |
| flat equal-weight carry (F-04) | 4.54 | **10.27** | 7.96 % | −0.01 |
| xs funding level | 3.27 | **13.90** | 6.63 % | +0.08 |
| **xs funding rank** | **5.03** | **14.14** | **2.93 %** | +0.08 |
| xs funding only (no basis leg, decomposition) | 6.68 | 18.53 | 0.09 % | +0.04 |
| shuffled-weight placebo (seed 1 of 40) | 0.33 | 0.27 | 8.7 % | — |

**By regime (Sharpe) — this is the decisive table (`e13`):**

| window | flat carry | xs level | xs rank |
| --- | ---: | ---: | ---: |
| crash 2021-05 | +3.51 | +12.08 | +14.09 |
| bear 2022 | **−1.43** | +2.33 | +2.98 |
| LUNA 2022-05 | **−4.19** | +12.70 | +13.18 |
| **FTX 2022-11** | **−5.12** | +5.19 | **+5.51** |
| positive full years (2021–25) | 4/5 | 5/5 | **5/5** |

**Controls.** The permutation placebo is now a **distribution** over 40 seeds (mean −0.03, sd 0.40,
range −0.96 … +0.58); xs rank sits at **z = 12.6**, xs level at z = 8.2. Both books stay
price-uncorrelated (0.08) — the independence property is kept. Significance with the F-20 treatment:
xs rank Sharpe 5.03, design effect 168.6 raw / **2.52 winsorised**, block-bootstrap CI [3.27, 12.79].

**The mark-price test (L14, CYCLE-007).** Re-measured with the perp leg set to the **traded** 8h close
(`data/perp_8h.json`): xs rank Sharpe **4.98** (vs 5.03) at a **3.05 %** drawdown (vs 2.93 %), with the
advantage over the flat book preserved (4.92 pp vs 5.03 pp). The dispersion result is not a
mark-smoothing construction.

## Verdict

**SUPPORTED.** Relative funding is informative, the construction converts the carry yield into a
level-neutral stream with a third of the drawdown, it is the only sleeve in the lab positive in every
crash window measured, and both objections that were raised against it — the benign window and the
smoothed mark price — have been tested and survived. The remaining caveats: (i) the raw design effect is
large, so the evidence is the winsorised/bootstrap/cross-year readings; (ii) the rank variant beats the
level variant, which is itself informative — level weights are dominated by outlier funding rates, so
**use rank weights**; (iii) **turnover — measured (F-23) and fixed (F-24): the daily reshuffle clears
only 1.87 bps, but EWMA(0.1)-smoothed weights clear 12.78 bps at a *higher* gross Sharpe.**

## Next actions

1. **Port R8 with the smoothed weights (F-24).** NOT the daily reshuffle (F-23). The spec is
   `w_t = 0.9·w_{t−1} + 0.1·w*_t` (target from funding at `t−1`), renormalised to `Σ|w|=1` — see
   `e17_low_turnover.js` and lead L16.
2. **Measure capacity/impact (lead L15)**, not just the fee: fee is now cleared (12.78 bps break-even),
   but at ~85×/yr impact may still bound the deployable size, and no depth/volume data is stored yet.
3. **The 2025–2026 decay is now measured (F-36): it is the break-even, not the signal.** The gross trend
   is flat while the break-even fell to 2.9–3.4 bps (below 4 bps) as turnover rose. **Answered (F-37):**
   a slower policy (`ewma 0.01_norm`) lifts the recent break-even to **27.07 bps** (net@4 +3.86), and a
   walk-forward λ-selection reproduces it **out of sample**, so it is a rule. Action: port R8 with a
   **cost-aware, walk-forward λ** (recent λ ≈ 0.01–0.02), and re-measure capacity at the new (much lower)
   turnover (next action 6). The 2021–2024-only sizing restriction is lifted.
4. Confirm the result is not driven by one regime: the 9/9 gross regime table is the evidence — re-check
   it if the symbol basket changes (it is an 8-major basket, so a new listing changes `n`).
5. **The decay caveat has a portfolio answer (F-31, CYCLE-015):** mixing in the uncorrelated L18
   toptrader fade (25 %) turns the book's negative net@4 *second half* (−0.12) into **+0.75**. A
   risk-parity / max-decorrelation weighting of the two is the refinement.
6. **Re-measure capacity at the retuned λ (F-37).** **Answered (F-38, CYCLE-021):** the retuned book is
   **OI-bound**, not impact-bound — usable size **$19 M** at λ=0.01 and **~$36 M** at
   `ewma_0.02 + cap12.5 %` (recent net@4 +4.24, break-even 15.97 bps), vs the λ=0.1 spec's $13.2 M. The
   R8 port spec is now **`ewma 0.02 + 12.5 % cap`, ~$36 M (OI-bound on LINK)**.

## Log

* **CYCLE-001** — opened as a new lead (outside the founding shortlist), with a falsifier.
* **CYCLE-005** — **done**: built `e12_xs_carry.js`; F-17 recorded (weights informative, book
  price-uncorrelated, drawdown 10.2 % → 1.6 %, Sharpe 6.1 — not banked). Discovered that the repo's
  `markPrice` is 0 before 2023-10, which bounds the whole carry complex to 2.9 crash-free years.
* **CYCLE-006** — **re-measured on the extended 6.0-year history** (F-19/F-21): rank book Sharpe 5.03
  with **2.93 %** drawdown, positive in **5/5** full years and **9/9** regimes, z = 12.6 against a
  40-seed permutation null. The old 1.6 % drawdown became 2.93 % (the old window was flattering), but
  the *relative* advantage over the flat book strengthened. Placebo upgraded from one draw to a
  distribution. E13 added for the regime breakdown.
* **CYCLE-007** — **mark-price objection cleared** (F-22): on the traded perp leg the rank book reads
  4.98 / 3.05 % drawdown with the flat-book advantage intact (4.92 pp). R8 un-gated; turnover moved to
  the front of the queue.
* **CYCLE-008** — **turnover measured, and it is the binding constraint (F-23).** Against the book's
  actual exposure vectors (`e12#weightSeries`), the rank book turns over **803× gross notional/yr** and
  **breaks even at 1.87 bps**; the level book 876×/2.42 bps; net Sharpe at a 4 bps fee is −5.6 (rank)
  and −2.1 (level). The flat book, by contrast, turns over 0.2×/yr and clears every tier. Verdict:
  the dispersion edge is **gross-only**; R8 is re-gated on finding a low-turnover construction (L16).
* **CYCLE-009** — **rescue found (F-24).** `e17` tests 14 weight policies on the same legs: the daily
  reshuffle's churn was an implementation artefact. **EWMA(0.1)-smoothed, renormalised rank weights**
  cut turnover 803× → **85×/yr**, *keep* the gross Sharpe (5.03 → **5.18**), and lift the break-even to
  **12.78 bps** — net Sharpe **+3.55 at 4 bps**, still positive in every crash window and 7/9 regimes,
  still dollar- and price-neutral. R8 is un-gated *given the smoothed weights*. Caveat recorded: the edge
  has decayed (2025/2026 ≈ 0 net of fees).
* **CYCLE-015** — **diversifier found (F-31).** `e23_combine.js` measures this book against the L18
  toptrader fade: return correlation **−0.001**, and a 25 % allocation to the fade turns the book's
  negative net@4 second half (−0.12, the F-24 decay) into **+0.75** (combined net@4 +1.38). The decay
  caveat now has a portfolio answer.
* **CYCLE-019** — **the decay characterised (F-36).** `e27_decay.js` (validated against `e23`'s gross
  Sharpes) shows the book's net edge died in 2025–26 because its **break-even fell to 2.9–3.4 bps**
  (below the 4 bps fee) while turnover rose 75 → 98×/yr, even though the gross Sharpe trend is flat
  (p 0.39). Net@4 by year 2024 +5.41 → 2025 −0.01 → 2026 −1.88 (net trend ρ −0.79, p 0.023). The
  F-24/F-26/F-27 tradability economics are full-sample and stale; the sleeve is now gross-only at 4 bps,
  and the F-31 mix survives on the fade's carry (F-36c).
* **CYCLE-020** — **recovered, and the recovery is a rule (F-37).** `e28` re-tunes the weight policy for
  the decayed regime: 7/16 policies clear a 4 bps fee on the recent 24 months, break-even **monotone in
  policy slowness** (the F-36 mechanism), and the leader `ewma_0.01_norm` reads recent-24m break-even
  **27.07 bps**, net@4 **+3.86** at 9×/yr, net-positive in **9/9** regimes. `e29` then pre-empts the
  selection objection: a **walk-forward λ-selection** (training on trailing net@4 only) nets **+5.71 OOS**
  vs the pinned F-24 spec's **+2.76** (recent-24m +3.41 vs −0.53) across 12/12 parameterisations, while a
  **gross-blind** selector nets only **+0.28** — the retune is a cost-aware rule, not a hindsight pick.
  R8 is un-gated with the amended spec.
* **CYCLE-021** — **sized (F-38).** `e30_retuned_capacity.js` (validated against `e19` to the last digit)
  shows the retuned book's limit is **open interest, not impact** (a hold-like book's square-root capacity
  diverges — $4.0 B at λ=0.005 — so the OI bound is the honest one). Usable size: **$19 M** at λ=0.01
  (LINK-bound), **~$36 M** at `ewma 0.02 + cap12.5 %` (recent net@4 **+4.24**, break-even 15.97 bps), vs
  the λ=0.1 spec's **$13.2 M** — so the retune raises size by ~173 % as well as repairing the fee.
* **CYCLE-022** — **port-ready (F-39).** `e31_ported_spec_oos.js` runs a **joint (λ, cap) walk-forward**
  over a 40-book grid: blind to the future, it beats the pinned F-24 spec OOS (**+6.13 vs +2.76**;
  recent-24m **+4.49 vs −0.53**) and, fee-stressed on the same OOS series, stays net-positive at a **10 bps**
  fee (net@4 +4.43) — ~6× headroom. `λ=0.1 + cap12.5 %` is still broken (+1.93), so the slower λ is the fix
  and the cap is a capacity add. The R8 port spec is final: walk-forward λ ≈ 0.02 + strict 12.5 % cap.
* **CYCLE-024** — **capacity restated (F-41).** The $35.9 M OI bound is a ratio-of-means; the true
  min-of-ratio is **$11.50 M** (recent-24 m p5 $20.34 M) and the published size breaches the 5 % cap in
  69 % of periods.
* **CYCLE-025** — **the OI bound is a schedule (F-42).** A constant trailing-p5 size breaches 2.9 %, a
  lagged size breaches 53 %; the compliant recipe is a clipped trailing-median (**$16.94 M**, zero breach,
  Sharpe 4.41).
* **CYCLE-038** — **split-point robustness of the pinned-λ fix (F-55).** `e47_split_robustness.js` sweeps a
  dense 14-point grid: the pre-registered 0.80 bar narrowly fails (expanding freeze 0.71, rolling 0.79),
  because the expanding freeze collapses at every split S ≤ 2190 and only works from S = 2555 — safe
  boundary **~2.3 y**. A **rolling** 1-year freeze beats the expanding one (0.79 vs 0.71, median +0.30),
  the broken fast λ is 0.075, and the cap stabilises the policy (0.50 → 0.79).
* **CYCLE-026** — **the mix is stale and the capacities do not add (F-43).** At the final spec the carry
  book's second half is +4.66, so F-31's 25 % fade allocation is a Sharpe cost (6.49→1.62) and a
  walk-forward rule picks 0 %. Portfolio-level, the carry and fade OI schedules do not add (joint at the
  mix = 56 % of the sum; both at their individual sizes breaches the 5 % cap in 78 % of periods).
