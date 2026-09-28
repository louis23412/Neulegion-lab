# L17 — Capacity-aware weighting: cap / vol-scale the per-symbol weight

**Status:** SUPPORTED — F-27 (CYCLE-012) closed the *λ=0.1* question, and **CYCLE-021 (F-38) re-opened it
for the F-37 retuned (slow) book**, where the cap compounds with the slower λ: the binding limit is open
interest, and the cap lifts that bound from $19 M to ~$36 M. A **strict per-symbol position cap** (~1/k)
roughly doubles the dispersion book's capacity, cuts its turnover, drawdown and design effect, and
(in-sample) raises its Sharpe. The soft cap (clip + renormalise) buys nothing; ADV-tilting and dropping
thin symbols destroy the edge.
**Capacity restatement (CYCLE-024 / F-41).** The $19 M → $36 M lift is *average-case* (ratio-of-means).
As a distribution the cap lifts the true never-breach bound **$4.99 M → $11.50 M** and the recent-24 m p5
**$10.25 M → $20.34 M**, and cuts peak participation **19 % → 16 %** of LINK's OI; at the published sizes
the book is over the 5 % cap in 65 % / 69 % of periods. The cap's benefit is real, its level was inflated.
**Sizing policy (CYCLE-025 / F-42).** The cap is a **clip, not a target**: target the trailing-median size and
clip at `f·min_j(OI/|w|)` → $16.94 M, zero breach, Sharpe 4.41 (a constant trailing-p5 breaches 2.9 %, a
lagged EWMA size 53 %). Following OI exactly gains size (2.05×) but loses Sharpe (5.02 → 3.26).
**Cap is structural, not tuned (CYCLE-033 / F-50).** `e42_cap_hindsight.js` shows the joint (λ, cap)
walk-forward is **dominated** by the pinned `ewma 0.02 + cap12.5 %` book out of sample (**6.13 vs 6.86**;
pinned ≥ rule on 4/5 sub-spans), and the cap is a **flat plateau**: at λ=0.02 the OOS net@4 is
**6.63** (none) / **6.77** (0.10) / **6.86** (0.125) / **6.90** (0.15). So `1/k = 0.125` is a principled,
**non-tuned** pick, and the cap **binds** (clips **42.3 %** of weight entries) — the first **out-of-sample**
confirmation of F-27. Freezing the (λ, cap) pair fails, but freezing the **cap** (with λ=0.02) works even on
one year of history.
**Cap mechanism (CYCLE-035 / F-52): the cap is a *concentration* tool, not a turnover filter.** The cap
does two things at once — clips the extremes (max `|w|` 0.438 → 0.125) **and** shortens the weight path
(turnover 17 → 10×/yr). `e44_cap_mechanism.js` isolates them with a **no-trade band** (a pure turnover
tool): swept to the cap's exact turnover (eps=0.008 → 10×/yr) the band reads net@4 **5.05** vs the cap's
**6.18** (only **+0.13 of +1.26**), and the band's whole sweep (16 → 6×/yr) stays in **[4.95, 5.05]** — so
the cap's Sharpe gain is the **shape**, not churn. The band also leaves max `|w|` at **0.436** and OI
capacity a **1.00×** multiple of base while the cap is **1.76× / 1.70×** (ratio-of-means / min-of-ratio) →
the *capacity* gain is concentration too. And a band **stacks** on the cap (net@4 **6.36** at **6×/yr**).
**Cap is a tail winsorisation (CYCLE-037 / F-54).** `e46_cap_shrinkage.js` shows the cap's benefit is a
**saturation of the tail** — not a hard constraint and not wholesale shrinkage. A smooth `c·tanh(w/c)` at
c=0.125 matches the hard clip (net@4 **6.04 vs 6.18**; 6.11 at c=0.10), so the *form* is not special (the
level ≈ `1/k` is). But `sign(w)·|w|^p` reads **4.44 / 3.99 / 3.25 / 2.27** for p = 1.25 / 1.5 / 2 / 3 —
*all below base* (4.92) — and equal-weight reads **1.51**: clip the extremes, **never** shrink the book.
**Opened:** CYCLE-011 (by F-26)
**Last updated:** CYCLE-037
**Owner experiments:** `e20_capacity_aware.js`, `e30_retuned_capacity.js` (the retuned-book follow-up),
`e31_ported_spec_oos.js` (the joint walk-forward), `e33_oi_capacity_distribution.js` (the OI-bound restatement),
`e34_oi_scaled_sizing.js` (the sizing policy), `e42_cap_hindsight.js` (the cap-rule test),
`e44_cap_mechanism.js` (the concentration-vs-turnover decomposition), `e46_cap_shrinkage.js` (the winsorisation mechanism)
**Prototypes:** `prototypes/port.js#clipWeights` (+ `cleanBook`; the cap may be a hard clip **or** a smooth
saturation, but never a shrinkage, per F-54; extracted as the shared port primitive in F-60, validated by `e52`)
**Result artefacts:** `results/e20_capacity_aware.json`, `results/e30_retuned_capacity.json`,
`results/e42_cap_hindsight.json`, `results/e44_cap_mechanism.json`, `results/e46_cap_shrinkage.json`
**Fold-back rows:** R8 (spec amendment), R4 extension
**Falsifier:** a capacity-aware construction that raises capacity materially without losing the gross
Sharpe / crash-survival. **Not falsified** — the strict cap does both in-sample.

## Claim / opening

F-26 (CYCLE-011, `e19_capacity_impact.js`) showed the dispersion sleeve's capacity is ~$13 M (Y=1, 4 bps)
and that the binding symbol is **DOGE at ~1 % of ADV**. The F-24 construction can concentrate up to
**50 % of gross in one symbol** (`max|w| = 0.5`): when funding ranks flip, the EWMA state cancels and the
`Σ|w|=1` renormalisation re-inflates it. That concentration is a property of the weight scheme, not of the
signal, so a position limit should buy capacity.

## Evidence

`e20` applies transforms to the F-24 target on the same legs, scoring each with `e16#audit` **and**
`e19#capacityOf` (one cost model). `soft cap` = clip then renormalise; `strict cap` = clip and hold
(genuinely under-invested when concentrated).

| construction | gross Sharpe | turn / yr | net@4 | DD | design eff. | capacity $ (Y=1 / Y=0.5) | regimes +ve |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline (F-24) | 5.18 | 85× | +3.55 | 0.94 % | 7.9 | 13.2 M / 52.8 M | 7 |
| soft cap 0.18 | 8.62 | 72× | +5.83 | 0.30 % | 4.8 | 13.5 M / 54.1 M | 8 |
| **strict cap 0.12** | 6.37 | 30× | +4.91 | 0.48 % | 4.5 | **28.4 M / 113 M** | **9** |
| **strict cap 0.125** | 6.97 | 35× | +5.32 | 0.47 % | 2.2 | **26.7 M / 107 M** | 8 |
| strict cap 0.14 | 8.24 | 49× | +5.97 | 0.24 % | 2.9 | 18.3 M / 73.4 M | 8 |
| strict cap 0.175 | 8.71 | 67× | +6.00 | 0.30 % | 3.8 | 14.0 M / 56.0 M | 8 |
| ADV-tilt (p=1) | 1.11 | 87× | −1.75 | 7.8 % | 8.5 | 0 | 4 |
| drop 2 thinnest | 3.82 | 86× | +2.45 | 1.2 % | 3.0 | 8.9 M / 35.7 M | 7 |

Capacity is smooth and monotone in the cap (0.12→$28 M, 0.13→$20 M, 0.15→$15 M, 0.20→$15 M). **Guards:**
`baseline` reproduces E17's `rank_ewma0.1_norm` exactly (`maxAbsDiff = 0`); a cap above `max|w|`
reproduces the baseline; all capacities from `e19#capacityOf`.

**Traps:** the *soft* cap buys zero capacity ($13.5 M) — renormalising re-inflates the clipped positions.
Caps **below ~0.12 (=1/k)** are degenerate — the rank information is clipped away, so "capacity" explodes
($348 M at 0.10) while Sharpe collapses to 3.1 and the design effect jumps to 30.

**Caveat:** the capacity doubling is the robust (monotone, turnover-driven) result; the large *in-sample*
Sharpe lift at caps 0.14–0.20 needs a pre-registered port test — though it is above baseline in **every**
calendar year.

## Verdict

**Closed — SUPPORTED.** A per-symbol position limit is the capacity-aware construction the rank book was
missing. Recommend amending R8's port spec to include a **strict per-symbol gross cap at ~1/k (12.5 %)**:
capacity ~$27 M (Y=1, 4 bps) / ~$107 M (Y=0.5), turnover 85→35×, DD 0.94→0.47 %, net@4 +3.55→+5.32,
8/9 regimes positive. It remains a small-size sleeve, but a cheaper and safer one.

## Next actions

1. **Port-test the cap** (pre-registered): does a 12.5 % per-symbol cap survive the repo's own gate, and
   does the in-sample Sharpe lift hold on a held-out block? **Extended (F-38):** the cap now also raises
   the *OI* bound for the retuned book ($19 M→$36 M), so it is doing double duty on the slow spec.
2. The timed-carry overlay (F-25, capacity ~$95 M) may benefit from the same cap; untested.
3. The flat book's real size limit is open interest (L07), not impact — **and (F-38) so is the retuned
   dispersion book's**.
4. **Walk-forward the cap** (F-38's residual): the `ewma_0.02 + cap12.5 %` combination was picked from a
   frontier, not selected by the e29 rule; give the cap size the same trailing-score treatment as λ.
   **Answered (F-39, CYCLE-022):** a joint (λ, cap) walk-forward beats the pinned spec OOS (+6.13 vs
   +2.76) and survives a 10 bps fee — the cap does not need to be pinned. **Corrected (F-50, CYCLE-033):**
   that "beats the pinned spec" comparator was the *broken F-24* spec. Against the **best pinned** book
   (`ewma 0.02 + cap12.5 %`, OOS 6.86) the joint walk-forward **loses** (6.13), and it is lower on 4/5
   sub-spans — so the cap **should** be pinned. See the cap note below.

## Log

* **CYCLE-011** — opened by F-26. Binding symbol at capacity is DOGE (~1 % ADV); concentration is a
  ranking artefact, so it should be reducible.
* **CYCLE-012** — **closed (F-27).** `e20_capacity_aware.js`: strict cap 12.5 % doubles capacity
  ($13.2 M→$26.7 M) at higher in-sample Sharpe and lower turnover/DD/dependence; soft cap and ADV-tilt
  fail; caps <1/k degenerate.
* **CYCLE-021** — **re-opened for the retuned book (F-38).** `e30_retuned_capacity.js` shows the cap
  compounds with the F-37 slower λ: at λ=0.02 the 12.5 % cap lifts the (now binding) **OI** bound from
  $19.2 M to **$35.9 M**, at recent net@4 **+4.24** and break-even 15.97 bps — the best combined R8 spec
  found so far. The cap's in-sample Sharpe lift still needs the walk-forward/port test (next action 4).
* **CYCLE-022** — **the cap's walk-forward test is done (F-39).** `e31_ported_spec_oos.js` selects (λ, cap)
  jointly out of sample: the never-seen series beats the pinned λ=0.1 spec (+6.13 vs +2.76) and is
  net-positive at a 10 bps fee. The cap is a capacity add, not a cost crutch — `λ=0.1 + cap12.5 %` is still
  broken OOS (+1.93), so the slower λ is what fixes the margin.
* **CYCLE-033** — **the cap rule is removed (F-50).** `e42_cap_hindsight.js` (guarding a rebuild that
  reproduces `e31` to 0.00) shows the joint (λ, cap) walk-forward **loses** to the pinned book out of sample
  (6.13 vs 6.86, pinned ≥ rule on 4/5 sub-spans) — its F-39 edge was over the *broken F-24 spec*. The cap is
  a **flat plateau** (at λ=0.02: 6.63/6.77/6.86/6.90 for cap none/0.10/0.125/0.15) and **binds** (clips
  42.3 % of entries) — so `1/k=0.125` is structural, and the cap should be **pinned**, not walked forward.
  R8's spec is now fully pinned (λ on ≥2 y + cap = 1/k).
* **CYCLE-035** — **the cap's mechanism is concentration, not churn (F-52).** `e44_cap_mechanism.js`
  (guarding a rebuild that reproduces `e30` to 0.00) isolates the cap's two effects with a **no-trade band**.
  Turnover-matched to the cap (eps=0.008 → 10×/yr) the band recovers only **+0.13 of the cap's +1.26** net@4
  gain (5.05 vs 6.18); the band's whole sweep stays in **[4.95, 5.05]** vs the cap's 6.18. The band also
  leaves OI capacity a **1.00×** multiple of base while the cap is **1.76×/1.70×** → the cap is a
  **concentration** tool on both net and size. And the tools **stack** (capped+band: net@4 **6.36** at
  **6×/yr**) → the R8 cost recipe adds a no-trade band.
* **CYCLE-037** — **the cap is a tail winsorisation (F-54).** `e46_cap_shrinkage.js` (guards `e30` to 0.00)
  shows a smooth saturation `c·tanh(w/c)` at c=0.125 matches the hard clip (**6.04 vs 6.18**) — only the
  level matters (a plateau) — while `sign(w)·|w|^p` reads **4.44/3.99/3.25/2.27** for p=1.25/1.5/2/3 (all
  below base 4.92) and equal-weight reads **1.51**. The cap **winsorises the extreme tail**; it does not
  lower concentration in general, and the hard form is not essential.
