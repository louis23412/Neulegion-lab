# L19 — OI-change cross-sectional signal: F-23 was repeated, and this one is weak

**Status:** **OPEN — rescuable but weak, churny, recent-regime.** Opened by F-45 (CYCLE-028), which
re-opened F-28's verdict. F-28 closed open interest as a *directional* signal because the e21
cross-sectional book is churned to death (daily: gross Sharpe +0.96, turnover **1501×/yr**, break-even
**1.89 bps**, net@4 −1.07). But that is the **F-23 pattern** — the funding-rank book was killed the same way
(803×/yr, 1.87 bps) and **F-24 rescued it by smoothing**. Given the F-24/F-37 treatment, the OI book's
break-even rises to a peak **14.73 bps** and **3 of 6** EWMA policies clear a 4 bps fee (λ=0.25: net@4
**+0.65**, break-even **8.93 bps**; λ=0.1: **+0.52**, 14.73 bps). So F-28's blanket "do not port OI as a
directional stream" is **too strong**. The signal is independent of the carry book (return corr **0.007**)
and the sign control loses in both halves (−0.961 gross), but it is **weak, churny and recent-regime**:
turnover **338×/yr** at the best policy, **net halves 0.07 / 1.47**, net-by-year 2023 **−0.86** but 2024
**+1.56** / 2025 +0.96 / 2026 **+2.30**, and a **walk-forward λ rule underperforms pinning** (+0.44 vs
+0.76/+0.99 OOS) — the F-40 pattern on a weak signal. **Not a port candidate yet.**
**CYCLE-029 (F-46) tested the live falsifier and it does NOT fire.** With sign +1 and λ∈{0.1, 0.25} fixed
**a priori** (`e38`), the **pre-2024** (≤2023) net@4 is **λ=0.25 −0.12** but **λ=0.1 +0.47** (break-even
15.23 bps) — so the *signal* is present before 2024 at the slower scale, and the **sign control is negative
in both regimes** (−0.80 / −2.66). What F-45 got wrong was its **parameter**: the λ=0.25 it called "best" is
*entirely* a post-2024 phenomenon (pre −0.12 / post +1.45). The two λ are **anti-phase** year-to-year, and a
fixed **50/50 blend** (no fitting) is net@4 **+0.33 pre / +1.24 post** and **positive in every calendar year
2022–26** (0.34/0.73/0.89/1.45/1.88), at break-even **11.33 bps** and **254×/yr** — beating both single λ on
the full window (net@4 **+0.77**). So the signal is **weak and churny but regime-robust at the blended
scale**. It remains **not port-ready** (churny and thin-alt-bound).
**CYCLE-030 (F-47) closed the additivity question.** The OI stream does **not add to R8**: independent
(return corr with the carry book **+0.01**, the fade **0.00**) but **too weak** — the capital-fraction
carry+OI ladder is monotone down (carry net@4 6.48 → 2.82 at 5 % OI; walk-forward picks OI **0 % in 11/11**)
and **risk-normalised** (each stream at unit vol) the max-Sharpe OI weight is only **0.10** for a **+0.04**
Sharpe gain (6.48 → 6.52). On the capacity side the **3-sleeve LP** is *not* crowded out — mean
**$142.2 M = 1.76×** the sum of the three individual bounds, optimal **OI share 0.374** — but its schedule
churns **129.6× gross/yr** for net@4 **0.82** (uninvestable), and all three at individual sizes breaches the
5 % cap in **58.8 %** of periods. So L19 is a **confirmed standalone stream**, not a portfolio member with
R8.
**CYCLE-039 (F-56) closed the construction thread.** `e48_oi_construction.js` (guarding both the daily
`e21` book — **0.9612 / 1501.11** — and F-46's `e38` 50/50 ensemble — **0.77 / 11.33 / 254** — exactly) asks
whether a cheaper construction beats F-46's fixed 50/50 blend without fitting a λ. **The mix is null:** every
non-equal fixed mix is ≤ equal capital (0.76 / 0.77 / 0.74 / 0.69 vs **0.77**), and an *unfitted* inverse-vol
mix picks `w = **0.51**` (OOS **1.18** vs the blend's **1.19**) — so 50/50 is vol-optimal, not a convention.
**The cadence is positive:** a **hold-6** (~2-day) cadence lifts net@4 **0.77 → 0.87** while the gross Sharpe
*falls* **1.18 → 1.03** — turnover 254 → **93×/yr** pays for the staleness (break-even 11.33 → **27.03 bps**,
positive every year 2022–26), with a **1–3 day plateau** (hold-3 0.82 / hold-9 0.83). A lab-internal bug (the
blend averaged weight vectors **without renormalising** → 0.70 / 10.75 / 220) was found and fixed, now pinned
by a second guard. The sleeve remains **standalone** (F-47) and **not ported**, but its construction is final:
**50/50 blend, held ~1–2 days.**
**CYCLE-040 (F-57) stressed that cadence claim — and scoped it down.** `e49_hold_drift.js` (guards `e21` and
F-46's `e38` ensemble) runs a **fine** hold grid (N = 1…36) and a **drift-aware true-hold** simulation. The
drift caveat **does not fire**: a true-hold simulation (weights drift `w′ⱼ = wⱼ(1+rⱼ)/(1+R)` between updates,
traded back only at updates) gives turnover within **2×/yr** of the lab's target-change measure at every N
(and a slightly *higher* net@4, hold-6 **0.94**) → `turnoverSeries` is **not** optimistic. But the fine grid
is **jagged**: the best hold-6 (0.87) is an **isolated spike** (+0.10 over neighbours 5/7), only **4 of 15**
holds beat daily by ≥ 0.05 (non-contiguous 2/3/6/9), the short-hold region (2–9) averages **0.80** vs 0.77,
and the long region (10–24) collapses to **0.60**. So **no specific cadence reliably adds** — the +0.10 at
hold-6 is noise. The sleeve's final construction is therefore the weaker honest statement: **F-46's 50/50
blend held ≤ ~3 days (turnover 254 → 73×/yr, no worse than daily)**; it stays **standalone, not ported**.
**CYCLE-041 (F-58) then found the sleeve's *actual* cost tool — a no-trade band.** `e50_oi_band.js` ports the
F-52/F-53 **no-trade band** (per symbol, move only when the target moved more than `eps`; state-dependent, so
it does not alias like a clock) onto the OI blend. At `eps = 0.03` the blend reads net@4 **0.92** at turnover
**198×/yr** (break-even **15.22 bps**, **positive every year 2022–26**) — **above** the cadence's spike
(hold-6 0.87) and the daily 0.77 — and the curve is a **smooth plateau** (3 sweep points within 0.05 of the
peak, **no** interior re-rise vs hold-N's 1). At matched turnover it wins **7 of 18** sweep points (all at
turnover ≈ 173–200+); the cadence's residual low-turnover edge is exactly its fine-grid spikes. **So the OI
sleeve's final construction is F-46's 50/50 blend + a no-trade band (eps ≈ 0.03)** — and the band is now
confirmed as the lab's **general** cost tool (R8 stacks with the cap, R7 alone, OI alone). Still
**standalone, not ported** (F-47).
**CYCLE-042 (F-59) then gave the band the dense-split holdout — and refined the *parameter* rule.** On an
11-split grid (S = 1095…5110), picking `eps*`/`N*` in-sample and freezing them, `e51_band_holdout.js` shows
the frozen-eps band beats the frozen-N hold at **11/11** splits, and the **fixed** `eps = 0.03` beats the
daily blend and fixed `hold-6` at **every** split — so F-58 is **not** a full-sample artefact. But the
trailing `eps` pick is **unstable below ~2.3 y** (S = 1460/1825/2190 choose the **largest** eps `0.1` and
underperform fixed 0.03 OOS, 1.03–1.22 vs 1.40–1.65); picks collapse to `0.03` from S ≥ 3650. **So: pin
`eps ≈ 0.03`** (or choose it on ≥ ~2.3 y) — the same minimum-training-window boundary F-49/F-55 found for
R8's λ, now recurring for a third parameter.
**Opened:** CYCLE-028
**Last updated:** CYCLE-042
**Owner experiments:** `e21_open_interest.js` (the original book + `xsBookImpl`), `e37_oi_signal_rescue.js`
(the smoothing/walk-forward rescue), `e38_oi_signal_holdout.js` (the pre-2024 holdout, decay, rank,
confound and capacity reads + the cross-scale blend), `e39_oi_portfolio_add.js` (return + capacity
additivity vs the R8/R7 port specs), `e48_oi_construction.js` (the hold-N cadence + non-equal/two-scale mix
+ no-hindsight inverse-vol blend), `e49_hold_drift.js` (the fine hold grid + drift-aware true-hold stress),
`e50_oi_band.js` (the no-trade band sweep vs the hold-N grid), `e51_band_holdout.js` (the dense-split
holdout for the band vs the cadence), `e52_port_artefact.js` (validates `prototypes/port.js` on the OI book)
**Prototypes:** `prototypes/port.js#cleanForSleeve('OI')` (candidate signal: cross-sectional demeaned
**Δlog(OI notional)**, sign +1, EWMA λ **blend** (0.1 + 0.25) + a **no-trade band (eps ≈ 0.03, pinned)** from
the shared port primitive F-60; a *third* positioning stream — **standalone**, not a joint member with R8, F-47)
**Result artefacts:** `results/e52_port_artefact.json`, `results/e51_band_holdout.json`,
`results/e50_oi_band.json`, `results/e49_hold_drift.json`, `results/e48_oi_construction.json`,
`results/e39_oi_portfolio_add.json`, `results/e38_oi_signal_holdout.json`,
`results/e37_oi_signal_rescue.json`, `results/e21_open_interest.json`
**Data:** `data/open_interest_8h.json` (field `oiVal` = Binance `sum_open_interest_value`, USDT notional, 8h
grid; BTC covers 2020-09, the other seven 2021-12, so the common book starts 2021-12)
**Fold-back rows:** R7 (new-data branch; **do not port yet**)
**Falsifier:** (a) no smoothing policy clears a 4 bps fee (tested CYCLE-028 — **does not fire**); (b) the edge
is a 2024–26 artefact — a held-out split or a pre-2024 read with the sign fixed would kill it. **Tested
CYCLE-029 — does NOT fire:** λ=0.1 clears a fee pre-2024 (**+0.47**), the sign control loses in both regimes,
and the unfitted 50/50 λ blend is positive in every calendar year 2022–26. What *was* regime-specific is the
single λ=0.25 (pre −0.12 / post +1.45). **Falsifier (c)** — the stream's *joint* capacity with R8's thin
alts (DOGE/LINK/ADA): **tested CYCLE-030 — the stream is not crowded out** (the 3-sleeve LP is 1.76× the sum
of individual bounds, OI share 0.374) **but it does not add** on the return side and its LP schedule churns
129.6× gross/yr → it is a standalone sleeve, not a joint member.

## Claim

The **cross-sectional** ordering of open-interest *changes* carries a directional edge: the symbols whose
open interest grew most (Δlog OI, sign **+1**, the F-28 pooled-IC prior) outperform over the next 8h, and a
causal dollar-neutral book that holds that ordering earns a positive net return at a realistic fee **once
its weights are smoothed**. The signal is invisible at the pooled-IC level (0.020) — F-03's demean lesson
again — and distinct from funding (return corr with the carry dispersion book **0.007**).

## Why we care

It is the lab's **second independent positioning signal** (after the L18 toptrader fade), from a field
already in the data harvest, and it re-opens a claim (F-28) the lab had carried as settled. If it holds up
across a held-out split it is another orthogonal stream; if it does not, F-28 is restored with a sharper
boundary ("level-IC ≈ 0 *and* the smoothed book dies out of sample").

## Evidence

`e37_oi_signal_rescue.js` — the e21 book under an EWMA policy, audited by `e16#audit`; guard: the daily
sign+1 book reproduces `e21#dLogOI_pos` exactly (0.9612 / 1501.11). Window 2021-12 → 2026-09 (5 246
periods).

| policy | gross Sharpe | turnover /yr | break-even | net@4 |
| --- | ---: | ---: | ---: | ---: |
| daily (F-28) | 0.961 | 1501× | 1.89 bps | −1.07 |
| EWMA 0.50 | 1.009 | 849× | 3.21 bps | −0.25 |
| **EWMA 0.25** | **1.178** | 338× | **8.93 bps** | **+0.65** |
| EWMA 0.10 | 0.713 | 116× | **14.73 bps** | +0.52 |
| EWMA 0.05 | 0.170 | 55× | 7.43 bps | +0.08 |
| EWMA 0.02 | 0.005 | 21× | 0.54 bps | −0.03 |
| EWMA 0.01 | 0.019 | 11× | 3.67 bps | 0.00 |

* **A window, not a point.** Too fast (0.5) fails on cost; too slow (≤0.05) fails because the gross signal
  collapses — the **F-25/F-32** "genuinely fast" pattern (contrast F-24, where the signal survived any λ).
* **Independent.** Return corr with the funding-rank dispersion book **0.007**; the sign control (−1) reads
  −0.961 gross / net@4 **−3.00**, losing in both halves.
* **Weak and recent.** At λ=0.25: net halves **0.07 / 1.47**; net-by-year 2022 +0.52, 2023 **−0.86**, 2024
  +1.56, 2025 +0.96, 2026 **+2.30**. Walk-forward λ OOS net@4 **+0.44** vs pinned λ=0.25 **+0.76** and
  λ=0.1 **+0.99**; fee-stressed pinned λ=0.25 reads +0.76 / +0.44 / +0.13 at 4 / 6 / 8 bps (recent-24m
  +1.73 / +1.42 / +1.10).

**Holdout, decay, rank, confound, capacity (CYCLE-029, F-46).** `e38` re-runs the sign+1 / λ∈{0.1, 0.25}
books (all fixed a priori) on the calendar split, plus the F-36 decay test, the rank construction, the
confounds, the book's OI schedule and a fixed 50/50 blend of the two λ:

| book | pre-2024 (n=2270) | post-2024 (n=2976) |
| --- | ---: | ---: |
| λ=0.25 (F-45's "best") | gross 0.34 · b/e **2.96 bps** · net@4 **−0.12** | gross 2.06 · 13.60 · **+1.45** |
| λ=0.10 | gross 0.64 · b/e **15.23** · net@4 **+0.47** | gross 0.82 · 14.33 · **+0.59** |
| sign control (−1, 0.25) | net@4 **−0.80** | net@4 **−2.66** |
| **50/50 blend (fixed)** | gross 0.69 · b/e 7.70 · net@4 **+0.33** | gross 1.73 · 14.15 · **+1.24** |

* **The falsifier does not fire.** The signal clears a fee pre-2024 at λ=0.1 (break-even 15.23 bps) and the
  sign control loses in **both** regimes. What was regime-specific was the **single λ=0.25** CYCLE-028 chose.
* **Cross-scale robustness.** The two λ are anti-phase year-to-year (2023: 0.25 −0.86 vs 0.1 +1.88; 2024:
  +1.56 vs −0.26); their fixed blend reads net@4 **+0.77 full** (vs 0.65 / 0.52), break-even **11.33 bps**,
  254×/yr, and is **positive in every calendar year 2022–26** (0.34/0.73/0.89/1.45/1.88).
* **No decay:** the net block trend is **positive** (λ=0.25 rho +0.67, p 0.053; gross rho +0.77, p 0.018).
* **Rank does not help** (λ=0.25 rank pre −0.42 vs level −0.12; λ=0.1 rank post −0.36) — F-17 is scoped to
  the funding book. **Confounds:** corr with the L18 fade **−0.045**, x-sec corr with the toptrader ratio
  **−0.016**; Δlog(OI) vs its own-interval price move **0.595** (the F-28 echo) while the causal forward IC
  stays **0.020**. **Capacity:** individual OI schedule mean **$23–28 M**, p5 **$6–8 M**, min $3.7–4.5 M,
  binding **DOGE/LINK/ADA** — shared with R8.

**Additivity vs R8 (CYCLE-030, F-47).** `e39` aligns the blend onto the two port-spec books and asks both
halves. *Return:* corr with carry **+0.01**, fade **0.00** (independent) but the capital-fraction carry+OI
ladder is monotone down (carry net@4 **6.48** → 2.82 at 5 % OI; walk-forward OI **0 % in 11/11**) and
risk-normalised the max-Sharpe OI weight is **0.10** for **+0.04** Sharpe. *Capacity:* the 3-sleeve LP reads
mean **$142.2 M = 1.76× the sum** of the three individual means ($80.9 M) with optimal **OI share 0.374** —
not crowded out — but the LP schedule churns **129.6× gross/yr** for net@4 **0.82** and all three at their
individual sizes breaches the 5 % cap in **58.8 %** of periods. ⇒ **standalone, not a member.**

## Next actions

1. ~~**Held-out / decay test (the live falsifier).**~~ **DONE (CYCLE-029, F-46): a pre-registered pre-2024
   read does *not* kill the signal** — λ=0.1 is net-positive pre-2024 (+0.47) and the unfitted 50/50 λ blend
   is positive every year 2022–26; only the single λ=0.25 was regime-specific, and there is no decay (the
   trend is positive). See the evidence above.
2. ~~**Capacity (open).**~~ **DONE (CYCLE-030, F-47).** The 3-sleeve LP **does not** crowd the OI stream
   out (mean $142.2 M, OI share 0.374), but the stream does **not add** on the return side (max-Sharpe weight
   0.10, +0.04 Sharpe; walk-forward OI 0 %) and its LP schedule churns 129.6× gross/yr → **standalone, not a
   joint member with R8**. See the evidence above.
3. ~~**Construction.**~~ **DONE (CYCLE-039/040/041, F-56/F-57/F-58).** The **rank** form was tested and does
   **not** help (negative, CYCLE-029), and the momentum-vs-crowding question is answered negative (the 0.595
   echo is measurement, not signal). `e48` closed the mix question (the two-scale mix is **null** — no
   non-equal mix beats 50/50; an unfitted inverse-vol mix picks **0.51**); F-56 reported a hold-6 net@4 lift
   **0.77 → 0.87**; `e49` **stressed** it (the drift caveat does not fire, but the fine grid shows hold-6 is
   an **isolated spike** — no specific cadence reliably adds); and `e50` found the **actual** cost tool: the
   **F-52/F-53 no-trade band** at `eps ≈ 0.03` reads net@4 **0.92** (**above** hold-6's 0.87) as a **smooth
   plateau**, positive every year. The sleeve's construction is final as: **F-46's 50/50 blend + a no-trade
   band (eps ≈ 0.03), turnover ≈ 200×/yr**. **F-59** adds the port rule: the band's edge over the cadence is
   OOS-robust (11/11 splits), but `eps` must be **pinned** or chosen on **≥ ~2.3 y** of trailing data (short
   windows pick the largest eps and underperform).
4. **Do not port as a joint member.** FOLD-BACK R7's OI branch stays **open but not ported**; the only
   remaining use is a *standalone* small sleeve (F-46's blend) with its own clipped schedule.

## Log

* **CYCLE-028** — **opened (F-45).** `e37` reuses the extracted `e21#xsBookImpl` and applies the F-24/F-37
  smoothing ladder + walk-forward. The falsifier "no policy clears 4 bps" **fires against a rescue** (3 of 6
  clear, peak 14.73 bps), so **F-28's "OI is directionless / do not port" is corrected** to "weak, churny,
  recent-regime". New open lead; `e21#xsBookImpl` exported (artefact byte-identical).
* **CYCLE-029** — **falsifier (b) tested (F-46).** `e38` runs the pre-registered pre-2024 holdout: the
  *signal* survives (λ=0.1 net@4 **+0.47** pre / **+0.59** post, break-even ~15 bps both regimes; sign
  control negative in both), but F-45's "best" λ=0.25 is *itself* a post-2024 artefact (pre **−0.12**).
  The two λ are anti-phase and a fixed 50/50 blend is net-positive in **every** year 2022–26 (net@4 **+0.77**
  full, break-even 11.33 bps). No decay (net trend **+0.67**); **rank does not help**; independent of L18
  (**−0.045**); individual OI bound $6–28 M on shared thin alts. Status sharpened: **weak + churny, but
  regime-robust at the blended scale**; the remaining live test is the **joint capacity with R8**.
* **CYCLE-030** — **falsifier (c) tested (F-47): additivity.** `e39` aligns the blend onto the R8/R7 port
  specs. The stream is independent (corr carry **+0.01**, fade 0.00) but **does not add** — capital ladder
  monotone down (carry net@4 6.48 → 2.82 at 5 % OI), walk-forward OI **0 % in 11/11**, risk-normalised
  max-Sharpe OI weight **0.10** for **+0.04** Sharpe (carry net4 vol **0.4 %/yr** vs OI **24.3 %**, 55×).
  The **3-sleeve LP** is *not* crowded out ($142.2 M = **1.76× the sum** of individual bounds, OI share
  **0.374**) but churns **129.6× gross/yr** for net@4 0.82 → **standalone sleeve, never a joint member with
  R8**. Registered the mix-convention basis bug **L10-y**.
* **CYCLE-039** — **construction closed (F-56).** `e48_oi_construction.js` compares a fixed non-equal
  two-scale mix, a `hold-N` cadence and a **no-hindsight** inverse-vol mix, with **two** guards (the daily
  `e21` book = 0.9612 / 1501.11, and F-46's `e38` 50/50 ensemble = 0.77 / 11.33 / 254). **Mix: null** — no
  non-equal mix beats equal capital (0.76/0.77/0.74/0.69 vs **0.77**), and the unfitted inverse-vol mix picks
  `w = 0.51`. **Cadence: positive** — hold-6 lifts net@4 **0.77 → 0.87** because turnover 254 → **93×/yr**
  outweighs the gross loss (1.18 → 1.03), with a **1–3 day plateau** (hold-3 0.82 / hold-9 0.83). A
  lab-internal bug — the blend averaged weight vectors **without renormalising** (0.70/10.75/220 vs F-46's
  0.77/11.33/254) — was found and fixed, and a second guard now pins it. L19's construction thread is closed;
  the sleeve stays **standalone, not ported**. Open follow-up (**CYCLE-040**): a **drift-aware** turnover read
  (the `Σ|Δw|` measure omits inter-rebalance drift for a hold policy) and a finer hold grid.
* **CYCLE-040** — **F-56's cadence claim scoped down (F-57).** `e49_hold_drift.js` (guards `e21` and F-46's
  `e38` ensemble) runs a **fine** hold grid (N = 1…36) and a **drift-aware true-hold** simulation.
  **Drift: does not fire** — the drift-aware turnover is within **2×/yr** of the lab's target-change measure
  at every N (and a slightly *higher* net@4), so `turnoverSeries` is **not** optimistic for a hold policy.
  **Grid: scopes F-56 down** — hold-6 (0.87) is an **isolated spike** (+0.10 over neighbours 5/7); only
  **4 of 15** holds beat daily by ≥ 0.05 (non-contiguous 2/3/6/9); the short-hold region (2–9) averages
  **0.80** vs 0.77; the long region (10–24) collapses to **0.60**. So **no specific cadence reliably adds** —
  the final recipe is the weaker honest one: **50/50 blend held ≤ ~3 days (turnover 254 → 73×/yr)**. Open
  methodological carry-forward: add "any construction chosen from a coarse grid needs a fine-grid pass" to
  `PROTOCOL.md`.
* **CYCLE-041** — **the band, not the cadence (F-58): the sleeve's construction is closed.** `e50_oi_band.js`
  (guards `e21` and F-46's `e38` ensemble) ports the F-52/F-53 **no-trade band** onto the OI blend. At
  `eps = 0.03` it reads net@4 **0.92** at turnover **198×/yr** (break-even **15.22 bps**, **positive every
  year 2022–26**) — **above** the cadence spike (hold-6 0.87) and the daily 0.77 — as a **smooth plateau**
  (3 sweep points within 0.05 of the peak, **no** interior re-rise vs hold-N's 1). At matched turnover the
  band wins **7 of 18** sweep points (turnover ≈ 173–200+); the cadence's residual low-turnover edge is its
  fine-grid spikes. **Final OI construction: F-46's 50/50 blend + a no-trade band (eps ≈ 0.03); standalone,
  not ported.** The band is now the lab's **general** cost tool (R8 stacks with the cap, R7 alone, OI alone).
  Added the fine-grid rule to `PROTOCOL.md` §3.
* **CYCLE-042** — **the band's OOS robustness (F-59).** `e51_band_holdout.js` (guards `e21` and F-46's `e38`
  ensemble) runs the dense-split holdout for the band vs the cadence. The frozen-eps band beats the frozen-N
  hold at **11/11** splits, and the fixed `eps = 0.03` beats the daily blend and fixed `hold-6` at **every**
  split → F-58 is not a full-sample artefact. But the trailing `eps` pick is unstable below **~2.3 y**
  (S = 1460/1825/2190 pick the **largest** eps `0.1`, underperforming fixed 0.03 OOS 1.03–1.22 vs 1.40–1.65);
  picks collapse to `0.03` from S ≥ 3650. **Port rule: pin `eps ≈ 0.03`** (or choose it on ≥ ~2.3 y) — the
  same minimum-training-window boundary F-49/F-55 gave R8's λ, now for a third parameter. L19 stays closed.
* **CYCLE-043** — **the port artefact (F-60).** `prototypes/port.js` (`clipWeights` + `bandWeights` +
  `cleanBook` = cap-then-band) is the shared book post-processing for all three sleeves; `e52_port_artefact.js`
  applies it to R8/R7/OI and reproduces **5/5** stored books (including the OI band `0.92 / 198× / 15.22` =
  `e50`). L19's OI sleeve now ports as `port.js#cleanForSleeve('OI')`. The lab's roadmap is closed.
