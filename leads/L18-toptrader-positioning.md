# L18 — Cross-sectional toptrader positioning: fade the crowded side

**Status:** SUPPORTED — **validated** (F-30, CYCLE-014). Held-out sign test, cost/smoothing, confound
and capacity all pass; the tradable construction is EWMA-smoothed weights. Small-size (OI-bound to tens
of millions). Opened by F-29 (CYCLE-013), spun out of L07 probe 2.
**Decay check (CYCLE-019 / F-36): PASSED — the fade has NOT decayed.** On the aligned 2021-12+ grid its
net@4 is 2025 **+1.24**, 2026 **+1.27**, last-12-months **+1.91** (above the full-sample 0.79), halves
0.82/0.76, and the block-trend test is null (ρ 0.19, p 0.68). It is now the lab's only live sleeve: the
carry dispersion book's net edge decayed below the fee in the same window (F-36a).
**Retune check (CYCLE-023 / F-40): NO retune — but the cap transfers.** The fade is **not cost-fragile at
any λ** (recent-24m break-even **55 bps** at EWMA 0.1, ≥19 bps even at λ=0.5), so F-37's slowness fix has
no purchase; and a walk-forward λ-selection is *worse* than pinning (+0.70 vs +0.94 OOS) because the fade's
Sharpe ~0.8 makes trailing windows noise-dominated. The **F-27/F-38 12.5 % cap does transfer**: OI bound
**$37 M → $54 M** (5 % of mean OI), full net@4 **+0.79 → +1.00**, break-even 74 → 109 bps.
**Pinned-spec check (CYCLE-034 / F-51): the fade's λ is PINNED — no walk-forward.** `e43_fade_pinned.js`
runs the F-48/49/50 chain on R7. The joint (λ, cap) walk-forward reads OOS net@4 **0.70** vs the best pinned
book `ewma 0.05 + cap12.5 %` **1.14** (pinned `ewma 0.1` 0.94) — the rule loses, exactly as F-40 suspected.
A λ **frozen** on `[0,S)` with the cap at `1/k` picks **0.05** and reads **1.14 / 1.15 / 0.37 / 0.83 / 0.87**
vs the rule's **0.70 / 0.87 / 0.31 / 0.60 / 0.93** (≥ or within 0.2 at every split), with **no ≥2 y minimum
needed** and no broken early-λ to dodge (unlike R8). The mechanism is **λ-flatness**: with the cap fixed the
OOS net@4 across the eight λ spans only **0.16** (0.25 uncapped) — the walk-forward ranks near-ties. Port R7
with a **pinned EWMA(0.05)** + the 12.5 % cap.
**Cap mechanism (CYCLE-036 / F-53): the cap is a *concentration* tool — do NOT add a band here.**
`e45_fade_cap_mechanism.js` (guards `e32` to 0.00) applies F-52's decomposition. The cap lifts net@4
**0.82 → 1.07** (**+0.25**), but a no-trade band swept to the cap's exact turnover (eps=0.05 → **8×/yr**)
reads **0.78** — *below* base (**−0.04**) — and the band's whole sweep (14 → 6×/yr) stays in **[0.78, 0.95]**.
The band leaves max `|w|` at **0.456** (base 0.500, capped 0.125) and capacity a **1.03–1.04×** multiple of
base while the cap is **1.43–1.47×** → so the cap is a **concentration** tool on the fade too (the mechanism
is a property of *clipping*). **But** a band on the capped fade gains only **+0.06** (1.13 vs 1.07; R8
stacked +0.18), so the **band remedy is R8-specific** — port R7 with the pinned cap and **no** band.
**Capacity check (CYCLE-024 / F-41): the numbers are ratios of means — restated.** The 5 %-of-OI bound
$37 M → $54 M was computed as `f·mean(OI)/mean|w|` (an *average-case* bound). Measured as a distribution,
the true min-of-ratio is **$4.19 M (no cap) / $12.62 M (cap)** and the recent-24 m p5 is **$12.27 M /
$21.87 M** — at the published size the fade breaches the 5 % cap in **69 % / 77 %** of periods (peak
participation 44 % / 21 % of LINK's OI). The cap *still* transfers (it triples the never-breach bound);
only its level was overstated.
**Sizing policy (CYCLE-025 / F-42): the bound is a CLIP, not a target.** `e34_oi_scaled_sizing.js` shows a
constant **trailing-p5** size still breaches the 5 % cap (2.7 %, peak 6.1 %), a **lagged (EWMA)** size
breaches **55 %** of periods, and following OI exactly raises the mean size 3.09× ($10.9 M → $33.6 M) but
*lowers* the dollar Sharpe (1.21 → 0.77, DD 22.8 % → 58.2 %). The compliant recipe is to **target the
trailing-median size and clip at `f·min_j(OI/|w|)`**: mean **$19.34 M**, zero breach, Sharpe 0.96.
**Mix check (CYCLE-026 / F-43): the fade is no longer a useful *mix* component.** At the final port specs
the carry dispersion book's net@4 second half is **+4.66** (F-37 removed the decay F-31 hedged), so the
25 % fade allocation (F-31) is a pure Sharpe cost: combined net@4 **6.49 → 1.62**, and a walk-forward
allocation rule picks the fade at **0 % in 11/11 blocks**. The fade's standalone case is unchanged
(net@4 1.00, break-even 109 bps, both halves positive, ρ with carry still 0.010) — it is simply dominated
by the re-tuned carry book.
**Opened:** CYCLE-013
**Last updated:** CYCLE-036
**Owner experiments:** `e21_open_interest.js` (the signal), `e22_toptrader_validate.js` (the validation),
`e23_combine.js` (the diversifier), `e27_decay.js` (the decay check), `e32_fade_retune.js` (the retune/cap),
`e33_oi_capacity_distribution.js` (the OI-bound restatement), `e34_oi_scaled_sizing.js` (the sizing policy),
`e35_portfolio_mix.js` (the mix at the final specs), `e43_fade_pinned.js` (the pinned-spec / rule-free test),
`e45_fade_cap_mechanism.js` (the cap concentration-vs-turnover decomposition)
**Prototypes:** `prototypes/port.js#cleanForSleeve('R7')` (candidate signal: cross-sectional demeaned
`sum_toptrader_long_short_ratio`, **pinned EWMA(0.05)**-smoothed weights per F-51, **+ a strict 12.5 %
per-symbol cap** per F-40 — and **no** no-trade band per F-53; the cap comes from the shared port primitive
F-60, validated by `e52`)
**Result artefacts:** `results/e21_open_interest.json` (`signalBooks.topLS_neg`, `topLSRobustness`),
`results/e22_toptrader_validate.json`, `results/e23_combine.json`, `results/e32_fade_retune.json`,
`results/e43_fade_pinned.json`, `results/e45_fade_cap_mechanism.json`
**Data:** `data/open_interest_8h.json` (field `topLS` = Binance `sum_toptrader_long_short_ratio`,
position-weighted top-trader long/short ratio, 8h grid; rebuild in `data/README.md`)
**Fold-back rows:** R7 (revisit)
**Falsifier:** a **held-out** evaluation (done) or a capacity read that kills it (done). The fade sign is
a prior, not fitted, so the test is: fix the sign, score each half on its own, and check the opposite
sign loses in both. **Not falsified** — H1/H2 net@4 +1.04/+0.51 (daily), +0.81/+0.79 (EWMA 0.1); the
opposite sign loses in both halves. Remaining falsifier: if the effect has died post-2024 (the weakest
year is 2024 at ≈0), the full-history edge rests on 2021–2023.

## Claim

The **cross-sectional** ordering of Binance's position-weighted top-trader long/short ratio carries a
modest **contrarian** edge: the side of the basket on which top-trader accounts are most crowded
underperforms the other side over the next 8h. A causal, dollar-neutral book that fades it is **net
positive** at the repo's own taker-cost assumption.

## Why we care

This is the lab's **first positive signal from new data** (the L07 family), where every OHLCV+funding
rule and every free microstructure field had been ~0. The field is free (Binance publishes it in the
same `futures/um` metrics bucket the repo could fetch at no extra cost), it is *not* the funding signal
(return correlation 0.21 with funding-on-spot, β ≈ 0 with the carry book), and it is exactly the kind of
power the lab has argued for (F-03: demean across the basket) applied to positioning.

## Evidence

Causal, dollar-neutral book `w_j = −(topLS_j − mean)/Σ|·|` at funding-grid time `t`, earning the next
8h spot return; missing symbols masked; window 2021-12 → 2026-08 (5 247 book periods, where all 8 majors
have the field). Audited by `e16#audit`.

| metric | value |
| --- | ---: |
| gross Sharpe | **1.055** |
| annualised return / max drawdown | 18.9 % / 26.4 % |
| turnover | 126×/yr |
| break-even | **15.1 bps** |
| net@4 / net@5 / net@10 | **+0.77 / +0.70 / +0.35** |
| half-sample Sharpe | 1.27 / 0.84 |
| quartile Sharpes | 1.18 / 1.38 / 0.31 / 1.52 |
| per-year Sharpe | 2021 +1.21, 2022 +0.65, 2023 +1.76, 2024 +0.07, 2025 +1.57, 2026 +1.69 |
| block-bootstrap Sharpe p5 / p50 / p95 | +0.36 / +1.06 / +1.83 |
| placebo (40-seed cross-sectional label shuffle) | z = **2.1** |

* **Only visible cross-sectionally.** The *level* IC of the ratio against the next return is ≤ 0.02
  (F-28's table) — a level that barely varies within a symbol has no time-series information. The
  demeaned cross-section does.
* **Not funding.** The same contrarian construction on the **funding rank** (long low-funding, short
  high-funding, on spot returns) scores Sharpe **0.49**, and correlates only **0.21** with this book.
  The top-trader ratio carries information beyond funding.
* **Not carry, not reversal.** Regression β of this book's returns on the funding-rank *carry* book
  (e17 `rank_daily`) is −0.013 (residual Sharpe 1.06); correlation with 8h reversal is −0.03.
* **The other stored field is weaker.** `takerLS` (`sum_taker_long_short_vol_ratio`) fades to Sharpe
  −0.33, so it does not help.

## Validation (CYCLE-014 / F-30) — `e22_toptrader_validate.js`

Four tests, all passed:

| test | result |
| --- | --- |
| **held-out sign** (fix the prior sign, score each half) | daily net@4 H1/H2 **+1.04 / +0.51**; opposite sign loses both halves; EWMA(0.1) net@4 **+0.81 / +0.79** |
| **cost / smoothing** | EWMA(0.1) weights: turnover **126×→23×/yr**, break-even **15→74 bps**, net@4 **+0.79** (EWMA 0.05: 118 bps) |
| **confound** (is it funding?) | funding-fade-on-spot: gross 1.03 but 896×/yr (break-even 2.9 bps) and *unstable* (H2 −0.43); cross-sectional signal corr **0.29**, return corr **0.20** |
| **capacity** | E19 impact $15 M (Y=1) for the daily book, **$4.2 B** smoothed; binding limit is **OI** — 1 %/5 %/10 % of LINK's OI at **$8–10 M / $40–50 M / $81–101 M** |

So the tradable construction is **EWMA(0.1)-smoothed, renormalised weights** — cheap, stable, and still
OI-bound to tens of millions (the same size class as the carry complex, F-28).

## Decay check (CYCLE-019 / F-36) — `e27_decay.js`

The one remaining falsifier was "has the effect died post-2024 (2024 was the weakest year at ≈0)?" It has
**not**. Rebuilt on the same aligned grid as `e23` (validated against its gross Sharpe 0.834), and split
into 8 contiguous blocks with a permutation-null trend test:

* **net@4 Sharpe by calendar year:** 2021 +1.90, 2022 **−0.18**, 2023 +1.98, 2024 +0.05, 2025 **+1.24**,
  2026 **+1.27**;
* **last-12-months net@4 +1.91** (above the full-sample +0.79), last-24m +0.73; halves 0.82/0.76;
* **trend test:** net ρ **0.19 (p 0.68)**, gross ρ 0.20 (p 0.66) — no decay;
* per-block net@4 (2021-12 → 2026-09): 0.77, −0.01, 1.15, 1.33, −1.44, 2.42, 1.13, 0.83 — noisy, no drift;
* its break-even stays **47–202 bps**, far above the fee, unlike the carry dispersion book's collapse to
  2.9–3.4 bps in the same window (F-36a).

So 2024's ≈0 year was noise, not the start of a decay, and the fade is now the lab's **only currently
net-positive sleeve** (or, equivalently, the 25 % mix whose recent net@4 is +1.76, F-36c).

## Next actions

1. ~~Held-out validation.~~ **DONE (CYCLE-014, F-30).** Passes; smoothing is the right construction.
2. ~~Capacity / concentration.~~ **DONE (CYCLE-014).** OI-bound to tens of millions (LINK binds, again).
3. **Combine with the carry dispersion book (F-24).** **DONE (CYCLE-015, F-31):** ρ = −0.001; a **25 %**
   allocation rescues the carry book's decayed second half (net@4 **−0.12 → +0.75**), combined net@4
   +1.38 with both halves positive. Refinement: risk-parity / max-decorrelation weighting + the F-30
   per-symbol cap.
4. **Fold-back (R7, revisit).** Spec is now concrete: fetch the `futures/um` metrics fields; add the
   toptrader ratio as a cross-sectional panel stream with EWMA-smoothed weights, a per-symbol cap and a
   size estimate. Port only through the repo's own gate.
5. **Decay check.** ~~Test whether the edge has died post-2024.~~ **DONE (CYCLE-019, F-36): it has NOT
   decayed.** Last-12m net@4 +1.91, trend p 0.68; the fade is now the lab's only live sleeve.
6. **Make it bigger / cheaper.** The binding constraints are capacity (OI-bound to tens of millions) and,
   secondarily, turnover (23×/yr). A lower-turnover or capacity-aware variant (the F-27/F-30 cap) is the
   natural follow-up now that the fade is the only working book.
   **DONE (CYCLE-023 / F-40):** the **12.5 % strict cap** transfers — OI bound $37 M→$54 M, net@4 +0.79→
   +1.00, break-even 74→109 bps, turnover 23→13×/yr. **Do NOT** retune λ (the fade is not cost-fragile;
   walk-forward selection hurts at Sharpe ~0.8). Port R7 with the cap and a *pinned* EWMA(0.1).

## Log

* **CYCLE-013** — opened. `e21` (extended) builds the masked causal book and its robustness; F-29
  records gross Sharpe 1.055, break-even 15.1 bps, net@4 +0.77. Found while *challenging* F-28's own
  "both fields directionless" claim — the level-IC screen had hidden a cross-sectional edge.
* **CYCLE-014** — **validated**. `e22` applies the held-out / cost / confound / capacity tests: the fade
  passes all four; EWMA(0.1) smoothing cuts turnover 126×→23×/yr and lifts the break-even 15→74 bps
  (F-30). L18 → SUPPORTED (validated); R7's spec is now concrete.
* **CYCLE-015** — **diversifier**. `e23` shows the fade is orthogonal to the carry dispersion book
  (ρ = −0.001) and a 25 % allocation turns the carry book's negative net@4 second half (−0.12) into
  +0.75 (F-31). L18's combine-next-action closed.
* **CYCLE-019** — **decay check passed (F-36).** `e27_decay.js` finds no decay: per-year net@4 2025 +1.24,
  2026 +1.27, last-12-months **+1.91** (above full-sample), halves 0.82/0.76, trend ρ 0.19 (p 0.68),
  break-even stays 47–202 bps. 2024's ≈0 year was noise. With the carry dispersion book's net edge gone in
  the same window (F-36a) and the 25 % mix still positive (+1.76) on the fade's carry, L18 is now the
  lab's **only live sleeve** — and the smaller one.
* **CYCLE-023** — **retune does not transfer; the cap does (F-40).** `e32_fade_retune.js` (reusing the
  now-exported `e22#buildMasked`; `e22`'s artefact verified byte-identical) sweeps λ ∈ {0.02…0.5} ×
  {no cap, 12.5 %}. The fade's recent-24m break-even is **55 bps** already (≥19 bps even at λ=0.5), so
  there is nothing for slowness to fix, and the walk-forward selection is *worse* than pinning
  (+0.70 vs +0.94 OOS) on this weak (Sharpe ~0.8) signal. The **12.5 % cap transfers**: OI bound
  $37 M→$54 M, net@4 +0.79→+1.00, break-even 74→109 bps. R7 should port the pinned EWMA(0.1) + cap.
* **CYCLE-024** — **OI bound restated (F-41).** The $54 M figure is a ratio-of-means; as a distribution
  the capped fade's true min-of-ratio is **$12.62 M** (recent-24 m p5 $21.87 M) and the published size
  breaches the 5 % cap in 77 % of periods. The cap still transfers; only its level was overstated.
* **CYCLE-025** — **the bound is a clip (F-42).** A constant trailing-p5 fade size breaches 2.7 %, a
  lagged (EWMA) size breaches 55 %; the compliant recipe is a clipped trailing-median (**$19.34 M**,
  zero breach, Sharpe 0.96).
* **CYCLE-026** — **the mix is stale (F-43).** With the re-tuned carry book no longer decaying, the 25 %
  allocation costs Sharpe (6.49→1.62) and a walk-forward allocation rule picks 0 %. The fade stands on
  its own; it is not needed as carry insurance.
* **CYCLE-034** — **the spec is pinned (F-51).** `e43_fade_pinned.js` (guarding a rebuild that reproduces
  `e32` to 0.00) runs the F-48/49/50 chain on the fade: the joint (λ, cap) walk-forward reads OOS net@4
  **0.70** vs the best pinned `ewma 0.05 + cap12.5 %` **1.14** — the rule loses (F-40 confirmed in full).
  A λ frozen on `[0,S)` with the cap at `1/k` picks **0.05** and matches-or-beats the rule at every split
  (**1.14 / 1.15 / 0.37 / 0.83 / 0.87** vs 0.70 / 0.87 / 0.31 / 0.60 / 0.93), with **no ≥2 y minimum**
  (no broken early-λ here). The mechanism is **λ-flatness** (0.16 spread across eight λ). Port R7 with a
  **pinned EWMA(0.05)**; both deployable sleeves (R8 and R7) are now pinned books with no rule.
* **CYCLE-036** — **the cap's mechanism is concentration on the fade too; no band (F-53).**
  `e45_fade_cap_mechanism.js` (guards `e32` to 0.00) applies F-52's decomposition to R7. The cap lifts net@4
  **0.82 → 1.07** (+0.25), but a turnover-matched band reads **0.78** (below base) and its whole sweep
  (14→6×/yr) stays in [0.78, 0.95]. The band leaves max `|w|` at 0.456 and capacity a **1.03–1.04×** multiple
  of base while the cap is **1.43–1.47×** → the cap is a **concentration** tool on R7 too. But the band does
  **not** stack here (+0.06 vs R8's +0.18) → port R7 with the pinned cap and **no** band.
