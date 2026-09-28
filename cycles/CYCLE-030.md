# CYCLE-030 — Does the L19 OI stream add to R8? (L19 × L12 × L18 × L15/L17, extends F-44, audits F-31/F-43)

**Date:** 2027-01-24
**Goal:** CYCLE-029 (F-46) left L19's last open falsifier as **capacity/additivity**: the OI change is an
*independent* positioning signal, but it binds the same thin alts (DOGE/LINK/ADA) as R8. If it shares R8's
per-symbol OI budget, running it may force R8's size down more than it adds — making it a non-member at any
Sharpe. The other half is the plain return question: does adding the OI stream *help* the R8 book?

The lab's existing answer for the fade (F-31 "the fade rescues carry"; F-43 "the fade now dilutes carry
6.49→1.62", walk-forward picks it 0 % in 11/11) were all computed on the **capital-fraction** mix — but the
carry book is a basis+funding stream with tiny per-period P&L while the fade (and the OI book) are
unit-gross **spot** streams. This cycle therefore measures both the **capital-fraction** and a
**risk-normalised** mix, and the exact **three-sleeve** joint OI frontier.

## Work

**`experiments/e39_oi_portfolio_add.js`** (new, registered as `e39_oi_portfolio_add`) — reuses `e35#buildPair`
(R8's `ewma 0.02 + 12.5 % cap` carry book + R7's `ewma 0.1 + 12.5 % cap` fade on one return interval) and
aligns the **fixed 50/50 λ OI blend** (F-46's regime-robust book) onto the same leg. Then:

1. **Return additivity** — the OI book's correlation with each sleeve; a capital-fraction ladder
   (carry + OI) and a **risk-normalised** ladder (each stream at unit annualised vol) with their
   max-Sharpe weights; a two-way walk-forward allocation on each scale.
2. **Capacity additivity** — the exact per-period **3-D LP**
   `max gC·G_C + gF·G_F + gO·G_O  s.t.  |G_C·wC_j + G_F·wF_j + G_O·wO_j| ≤ 5 %·OI_j`, compared with the sum
   of the three individual bounds and with `e36`'s 2-D carry+fade LP; the optimal **OI share**; the
   LP-scheduled book's churn/net; and the breach when all three run at their own individual sizes.
3. The fade's own risk-normalised contribution, to state the effect of the mix convention on F-31/F-43.

**Guards.** The two port-spec books' individual OI bounds must reproduce `e34`'s `meanGcap` within 5 %
(carry 0.44 %, fade 1.15 %), the 2-D carry+fade LP must reproduce `e36`'s `lpMeanTotalGross` within 0.01 %,
and the 3-D LP must be ≥ the 2-D one (`G_O = 0` is feasible) — all pass.

## Results

**(a) Return side — the OI stream does NOT add to R8, on either scale.**

* **Independent**: return corr with the carry book **+0.01**, with the fade **0.00**.
* **Capital-fraction ladder** (the lab's F-31/F-43 convention): adding OI to carry strictly *lowers*
  net@4 (carry alone **6.48**; 5 % OI → 2.82; 25 % → 1.11), and a walk-forward picks **OI = 0 % in 11/11**
  blocks (OOS net@4 6.58 = carry-only). But this is mostly the **vol mismatch**: the carry book's net4 vol
  is **0.4 %/yr** per unit gross vs the OI book's **24.3 %** — a **55×** ratio.
* **Risk-normalised** (both streams at unit vol): the max-Sharpe weight on OI is **0.10** and gains only
  **+0.04** Sharpe (6.48 → **6.52**); a risk-normalised walk-forward picks OI rising 0 → 0.24 but reads OOS
  Sharpe **6.58 ≈ carry-only 6.58**. So the stream is independent but **too weak to add** to a ~6.5-Sharpe
  book even on a common risk scale.

**(b) Capacity side — the 3-sleeve LP finds room, but only via an uninvestable schedule.**

| | mean total gross | median | p5 |
| --- | ---: | ---: | ---: |
| 3-sleeve LP (carry+fade+OI) | **$142.2 M** | $77.7 M | $20.2 M |
| 2-sleeve LP (carry+fade, F-44) | $62.7 M | $37.1 M | $11.9 M |
| sum of the three individual means | $80.9 M | — | — |

The 3-D LP mean is **2.27×** the 2-D LP and **1.76×** the sum of the three individual bounds, with the
optimal **OI share mean 0.374** (median 0.383, p95 0.77, ≈0 in 11 % of periods) — so the three books'
positions **net substantially** across symbols and the OI stream is **not crowded out** at the capacity
level. **But the LP-optimal size schedule churns 129.6× gross/yr for net@4 0.82** (carry's is 6.49) — the
same F-44 outcome: the frontier is a *capability*, not a deployable size. Running all three at their
individual compliant sizes breaches the 5 %-of-OI cap in **58.8 %** of periods (peak 12.9 %; LINK 2 088,
ADA 2 139, DOGE 470, XRP 264, SOL 87, BNB 126).

**(c) Methodological (bug-hunt) — the mix convention is a vol-basis artefact.** The fade's net4 vol is
**13.6 %/yr** per unit gross vs carry's **0.4 %** (**31×**). Risk-normalised, the max-Sharpe carry+fade mix
puts weight **0.13** on the fade for **6.55** (vs carry-only 6.48), and the 3-stream unit-vol tangency reads
**6.58** — a total gain of ~**+0.10** Sharpe. So F-43's *direction* (mixing the fade/dilution adds ~nothing)
**stands**, but its *magnitude* ("the fade dilutes carry 6.49→1.62") is the vol ratio, not diversification.
Registered as **L10-y**.

## What is now false that used to be believed

* **"The OI stream is a candidate third sleeve / it might add to the portfolio."** On the return side it
  does **not** add — independent (corr ~0) but too weak (max-Sharpe weight ~0.10, +0.04 Sharpe; walk-forward
  OOS = carry-only), on both a capital and a risk-normalised basis.
* **"Sharing the thin alts means the OI stream cannot be sized alongside R8."** Reversed: the 3-sleeve LP
  finds **1.76× the sum** of the individual bounds (OI share ~38 %), because the three books net across
  symbols. The obstruction to sizing is not the cap — it is the **churn** (129.6× gross/yr) of a
  re-optimised schedule, exactly as in F-44. The deployable size still requires a fixed-split/clipped
  schedule.
* **(Nuance / measurement basis) F-31/F-43's mix numbers are capital-fraction, not risk-normalised.**
  F-43's conclusion survives; its headline magnitude does not. New bug-register entry **L10-y**.

## Ledger effects

* New **F-47**; new experiment `e39_oi_portfolio_add.js`, new artefact `results/e39_oi_portfolio_add.json`;
  `run_all` is now **47 steps** with a new validation guard (E34/E36-LP cross-checks + the LP≥2-D check).
* New bug-register entry **L10-y** (mix convention is vol-basis confounded).
* **L19** updated: its capacity falsifier (c) is now **tested** — the stream does **not add** to R8 and is
  not crowded out, but is uninvestable as an LP schedule → still **not port-ready**, and now explicitly a
  *standalone* small sleeve rather than a portfolio member.
* **FOLD-BACK R7** amended for the additivity result; **F-43/F-31** carry an L10-y basis note.

## Next

* The frontier now has **no untested free-data mechanism**: L19 is measured (weak, regime-robust, doesn't
  add), L07's liquidation half is data-blocked, L10 is an ongoing audit.
* Remaining L19 work is *construction*, not signal: a `hold-N` cadence and non-equal two-scale blends
  (F-47's "doesn't add" is about the current construction at the port spec, not about every construction).
* L10's next audit target is the **convention registry**: every place the lab quotes a *mix* or a
  *combined* Sharpe should state the risk scale (L10-y).

## Run

`e39` ~2.3 s (registered). Full `run_all` regeneration **47 steps** (`RUN_SUMMARY` at
**2026-09-26T23:42:12Z**, ~19.3 min wall); controls `e0c`, `e5` (1h/15m), the 13-check `e14`, and the
validation guards `e28`–`e39` all report `pass` (0 fails).
