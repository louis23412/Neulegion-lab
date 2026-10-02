# L16 — Low-turnover dispersion: can the rank signal be harvested cheaply?

**Status:** **SUPPORTED — re-opened and re-answered (CYCLE-020 / F-37); the R8 spec is PINNED — frozen λ on ≥2 y + cap 1/k (CYCLE-031/032/033 / F-48/F-49/F-50).** The cheap harvest exists:
**EWMA-smoothed, renormalised rank weights** (`w_t = (1−λ)·w_{t−1} + λ·w*_t`, target from funding at
`t−1`) cut turnover **~9×** (803× → 85×/yr) while *keeping* the gross Sharpe (5.03 → 5.18) and lifting the
break-even from 1.87 to **12.78 bps**. Net of a 4 bps fee it is positive in every crash window and 7/9
regimes. λ=0.1 is *no longer* the right point in the family: it decayed below the fee in 2025–26 (F-36),
and a **slower, cost-aware λ** restores the margin (F-37). CYCLE-031 (F-48) then showed the **selection
rule is optional**: an unfitted fixed blend of the two slow scales matches the walk-forward λ out of
sample at half the turnover. This *is* the R8 construction, re-specified.
**Cost recipe (CYCLE-035 / F-52):** `e44_cap_mechanism.js` isolates what the 12.5 % cap does — it is a
**concentration** tool, not a turnover filter. A **no-trade band** swept to the cap's exact turnover
(10×/yr) recovers only **+0.13 of the cap's +1.26** net@4 gain, so the cap's edge is the weight *shape*
(max `|w|` 0.438 → 0.125), and the band leaves OI capacity a **1.00×** multiple of base while the cap is
**1.76×/1.70×**. The two **stack**: capped + band reads net@4 **6.36** at turnover **6×/yr**. So the R8
cost recipe is **EWMA (λ frozen ≥ ~2 y) + cap `1/k` + a no-trade band**. The cap's mechanism is now closed
(CYCLE-037 / F-54): it is a **tail winsorisation** — a smooth `c·tanh(w/c)` matches the hard clip (6.04 vs
6.18), so only the level (≈ `1/k`) matters, while `sign(w)·|w|^p` reads 4.44/3.99/3.25/2.27 for
p=1.25/1.5/2/3 (all below base 4.92) and equal-weight reads 1.51. CYCLE-038 (F-55) then challenged the **split points**: on a dense 14-point grid the pre-registered 0.80 robustness bar narrowly fails (expanding freeze 0.71, rolling 1-year 0.79), but every failure is in the first ~2 y — the expanding freeze collapses at S ≤ 2190 and matches at 10/10 splits from S = 2555 (safe boundary **~2.3 y**). The **rolling** freeze beats the expanding one (0.79 vs 0.71), the broken fast λ is **0.075**, and the **cap stabilises** the frozen policy (**0.50 uncapped → 0.79 capped**).
**Opened:** CYCLE-008
**Last updated:** CYCLE-138
**Owner experiments:** `e17_low_turnover.js` (reuses `e16#audit`, `e13#windowStats/REGIMES`),
`e28_regime_retune.js`, `e29_regime_retune_oos.js`, `e30_retuned_capacity.js`, `e31_ported_spec_oos.js`,
`e40_retune_blend.js`, `e41_blend_hindsight.js`, `e42_cap_hindsight.js`, `e44_cap_mechanism.js`, `e46_cap_shrinkage.js`, `e47_split_robustness.js`
**Prototypes:** `prototypes/port.js#bandWeights` (+ `cleanBook`; the no-trade band stacks on the cap per F-52;
extracted as the shared port primitive in F-60, validated by `e52`)
**Result artefacts:** `results/e17_low_turnover.json`, `results/e28_regime_retune.json`,
`results/e29_regime_retune_oos.json`, `results/e30_retuned_capacity.json`,
`results/e31_ported_spec_oos.json`, `results/e40_retune_blend.json`, `results/e41_blend_hindsight.json`,
`results/e42_cap_hindsight.json`, `results/e44_cap_mechanism.json`, `results/e46_cap_shrinkage.json`, `results/e47_split_robustness.json`
**Fold-back rows:** **R8** — this is the port spec
**Falsifier:** no construction keeps the gross edge while cutting turnover below a realistic fee.
**Applied and it did NOT falsify:** the EWMA(λ=0.1) variant clears every fee tier down to 12.78 bps.
**Re-opened and re-answered (F-37):** the λ=0.1 harvest decayed below the fee in 2025–26 (F-36), but a
*slower* EWMA restores the margin, and a walk-forward λ-selection reproduces it out of sample.

## Claim (answered)

F-23 (CYCLE-008) showed the dispersion book breaks even at 1.87 bps because its daily rank recompute
churns 803×/yr. `e17` tests whether that turnover is intrinsic to the signal or an artefact of the
implementation. It is an artefact: the signal is the slow cross-sectional funding spread, and the churn
was noise trading between nearly-equivalent rank vectors. Filtering the weights (λ=0.1) removes the
churn, keeps the edge, and even nudges the gross Sharpe up (removing zero-mean churn reduces variance).

## Evidence

See `CYCLE-009.md` and F-24 for the full table. Headline, on the mark leg (`net4` = net Sharpe at 4 bps):

| policy | gross Sharpe | turnover / yr | break-even | net@4 | net@10 |
| --- | ---: | ---: | ---: | ---: | ---: |
| daily (F-23 baseline) | 5.03 | 803× | 1.87 bps | −5.62 | −19.75 |
| hold9 | 3.09 | 119× | 7.45 bps | +1.42 | −0.99 |
| **ewma_0.1_norm (winner)** | **5.18** | **85×** | **12.78 bps** | **+3.55** | **+1.12** |
| deadband_0.10 | 4.90 | 654× | 2.22 bps | −3.83 | −15.43 |
| tail3 | 4.98 | 846× | 1.87 bps | −5.56 | −19.54 |

*Deadband and tail-weighting do not work* — they barely move turnover. *Hold-N* cuts turnover but gives
up too much gross edge (hold9 gross Sharpe 3.09). *EWMA smoothing* is the only one that keeps both.
The winner stays dollar-neutral (`Σw=0`) and price-neutral (corr 0.074), and on the traded perp leg it
holds (gross 5.37, 84×/yr, break-even 12.52 bps, net@4 +3.65, 7/9 regimes).
**Caveat:** the edge has decayed — 2025 and 2026 are ≈0 / slightly negative net of fees.

### Re-tune for the decayed regime (F-37, CYCLE-020)

`e28` re-audits the policy family against the **recent 24 months**. 7/16 policies clear a 4 bps fee, and
the recent break-even is **monotone in policy slowness** — the direct consequence of F-36's mechanism:

| policy | recent turnover ×/yr | recent break-even | recent net@4 |
| --- | ---: | ---: | ---: |
| **ewma_0.01_norm** | **9** | **27.07 bps** | **+3.86** |
| ewma_0.02_norm | 18 | 14.65 bps | +3.62 |
| ewma_0.05_norm + cap12.5 % | 26 | 7.03 bps | +2.67 |
| ewma_0.05_norm | 46 | 6.66 bps | +2.33 |
| *(λ=0.1 spec)* | 93 | 3.68 bps | −0.58 |

`ewma_0.01_norm` is net-positive in **9/9** regimes. `e29` then rules out the selection objection it
invites: a **walk-forward λ-selection** (trailing net@4 only, never the traded block) nets **+5.71 OOS**
vs the pinned λ=0.1's **+2.76** on the same span (recent-24m **+3.41** vs **−0.53**) across **12/12**
(lookback, block) parameterisations; a **gross-blind** selector nets only **+0.28**. So the correct
construction is a **cost-aware, walk-forward λ** (recent λ ≈ 0.01–0.02), not a fixed 0.1 — and the fix is
cost-awareness, not variance smoothing.
**Capacity (F-38, CYCLE-021):** the retuned book is **OI-bound, not impact-bound** — usable size
**$19 M** (λ=0.01, LINK) / **~$36 M** (`ewma 0.02 + cap12.5 %`, recent net@4 +4.24, break-even 15.97 bps)
vs the λ=0.1 spec's $13.2 M. So the slower harvest is both cheaper *and* larger.

### The λ-selection rule is optional (F-48, CYCLE-031)

F-37/F-39 reached the port spec with a **walk-forward λ selection**. `e40_retune_blend.js` asks whether
that fitted rule earns its keep, by comparing it against **fixed, unfitted** equal-capital blends of the
λ family on one shared OOS span (`[1095, 6205)`). The best blend — **λ = 0.01 + 0.02** — reads **OOS
net@4 6.66 vs the walk-forward's 6.63** (within the pre-registered 0.2-Sharpe falsifier, indeed above it)
with **half the turnover** (7 vs 14×/yr) and **1.8×** the break-even (46.1 vs 25.5 bps), and every
pre-registered blend is recent-positive. So the walk-forward *rule* adds nothing over a fixed two-scale
blend — its F-37/F-39 edge was over the *broken* λ=0.1 spec (the one blend containing λ=0.1 is the worst,
4.36): it bought **slowness**, not a selection rule. **Caveat:** the pinned λ=0.02 (6.86) is in-sample, so
*which* scales to blend is still a choice; a single λ frozen before the span is untested (see L12 / F-48).

### Correction: the blend was the best of a menu — freeze a λ instead (F-49, CYCLE-032)

`e41_blend_hindsight.js` closed the caveat and **scoped F-48 down**. (i) Only **1 of 10** pre-registered
blends clears the 0.2 bar — the cherry-picked `{0.01,0.02}`; the **no-hindsight** F-37-slow sets read
`{0.005,0.01,0.02,0.05}` **5.74** and `{0.005,0.01,0.02}` **6.08** (0.55–0.89 below the rule), a
blend-selection walk-forward reads **5.81**, and the blend ranking flips by window. So "a fixed blend
replaces the rule" was the best of a menu, not a free lunch. (ii) But a **single λ frozen** on `[0, S)` is
honest and works: for S ≤ 1.7 y the trailing winner is the F-37-**broken** λ=0.1 and the frozen spec
collapses (OOS net@4 **1.76–1.93**); from S ≥ 2.3 y it is **0.02** and the frozen spec **matches or beats**
the walk-forward (OOS **6.81 / 6.64 / 4.10** vs **6.69 / 6.48 / 4.27**). **So R8's λ policy should be a λ
frozen on ≥ ~2.3 years of trailing data, not a blend** — and the walk-forward's value is confined to the
first ~2 years. The freeze knob is non-monotone (a 730-period train at S=1095 picks worse than a 365 one).

### The cap is structural too — R8 is fully pinned (F-50, CYCLE-033)

The last fitted object was the **cap**. `e42_cap_hindsight.js` (40-book grid; guards `e31` exactly) shows
the **joint (λ, cap) walk-forward loses to the pinned book** out of sample — **6.13 vs 6.86** (pinned ≥ rule
on 4/5 sub-spans) — its F-39 edge was over the *broken F-24 spec*. The cap is a **flat plateau** at λ=0.02:
OOS net@4 **6.63** (none) / **6.77** (0.10) / **6.86** (0.125) / **6.90** (0.15), and it **binds** (clips
**42.3 %** of weight entries) — so `1/k = 0.125` is **structural, not tuned** (the first OOS confirmation of
F-27). Freezing the *pair* fails; freezing the **cap** (λ=0.02) works even on one year of history. **R8 is
now fully pinned: freeze λ on ≥2 y + cap = 1/k, no walk-forward.**

1. **Fold into R8**: port the dispersion sleeve with EWMA weights — **final spec (F-39): a walk-forward,
   cost-aware λ (recent ≈ 0.02) + a strict 12.5 % cap**, *not* the fixed λ=0.1 and not the daily reshuffle.
   `e31` shows this is port-ready (OOS +6.13, net-positive at a 10 bps fee). **Simplification (F-48 → F-49):**
   the λ policy can drop the walk-forward rule, but **not** for a fixed blend — CYCLE-032 shows the blend
   claim is menu-dependent (1 of 10 sets clears, no no-hindsight set does). Instead **pick λ once on the last
   ≥ ~2.3 years of trailing data and freeze it** (it lands on 0.02 and matches the rule OOS, 6.64–6.81).
   **Cap (F-50):** the cap also does **not** need a rule — it is a structural plateau, so pin it at
   `1/k = 0.125` (the joint (λ, cap) walk-forward loses to the pinned book OOS, 6.13 vs 6.86).
2. **Capacity (L15)** is now the binding limit — fee is cleared, impact is not.
3. **Watch the 2025–2026 decay** — decide whether the recent flatness is regime or signal death.
   **Measured (CYCLE-019 / F-36): it is a cost-margin decay, not signal death.** The gross Sharpe trend is
   flat (ρ −0.35, p 0.39) but the *break-even* fell to **2.9–3.4 bps** in the last two blocks (2025-07 →
   2026-09), below a 4 bps fee (turnover rose 75 → 98×/yr). **ANSWERED (CYCLE-020 / F-37):** a slower
   policy re-tunes it — `ewma_0.01_norm` reads recent-24m break-even **27.07 bps**, net@4 **+3.86**, and a
   walk-forward λ-selection reproduces the outperform **out of sample** (+5.71 vs +2.76), so the fix is a
   *rule*. R8's spec is amended to a **cost-aware, walk-forward λ** (recent λ ≈ 0.01–0.02); capacity at
   the new λ is the remaining item.
4. Apply the same smoothing to the **reversion** book (L11) — the open analogue (CYCLE-010 candidate).

## Log

* **CYCLE-008** — opened. F-23 killed the daily-reshuffle version; this became the gating question for R8.
* **CYCLE-009** — **closed (SUPPORTED).** Built `e17_low_turnover.js`; tested 14 weight policies;
  the EWMA(0.1) renormalised rank book is the winner (F-24). Reproducibility guard
  (`rank_daily` ≡ `e12`'s `xsRank`, `maxAbsDiff=0`) passes. R8 un-gated *given the smoothed weights*.
* **CYCLE-019** — **decay mechanism identified (F-36).** `e27_decay.js` shows the EWMA(0.1) book's recent
  break-even (2.9–3.4 bps) is below the fee while its gross trend is flat — so the construction still
  harvests the signal but no longer cheaply enough in 2025–26. The re-tuned low-turnover question is
  re-opened as L16's live action and remains the gate on R8.
* **CYCLE-020** — **re-opened and re-answered (F-37).** `e28_regime_retune.js` sweeps the policy family on
  the recent window: 7/16 clear 4 bps, break-even monotone in slowness, leader `ewma_0.01_norm` at recent
  break-even **27.07 bps** / net@4 **+3.86** / 9×/yr. `e29_regime_retune_oos.js` shows a **walk-forward
  λ-selection** (blind to the future) nets **+5.71 OOS** vs the pinned λ=0.1's **+2.76** across 12/12
  parameterisations, and that a **gross-blind** selector nets only **+0.28** — the re-tune is a
  cost-aware rule, so R8 is un-gated with an amended (walk-forward λ) spec.
* **CYCLE-021** — **sized (F-38).** `e30_retuned_capacity.js` measures both size bounds for the λ family:
  the retuned book's impact capacity diverges (hold-like) and it is **OI-bound (LINK)** — $19.2 M at
  λ=0.01, **$35.9 M** at `ewma 0.02 + cap12.5 %` (recent net@4 +4.24), vs the λ=0.1 spec's $13.2 M
  (impact-bound, DOGE). The slower harvest is cheaper *and* larger; the honest limit for a smoothed book
  is open interest, not impact.
* **CYCLE-022** — **port-ready (F-39).** `e31_ported_spec_oos.js` walks forward over the joint (λ, cap)
  surface (40 books): the never-seen OOS series nets **+6.13** vs the pinned λ=0.1 spec's **+2.76**
  (recent-24m +4.49 vs −0.53) and stays net-positive at a **10 bps** fee (net@4 +4.43, ~6× headroom).
  The harvest spec is final: **walk-forward λ (recent ≈ 0.02) + strict 12.5 % cap**.
* **CYCLE-031** — **the λ rule simplified to a fixed blend (F-48).** `e40_retune_blend.js` compares the
  λ-only walk-forward against five fixed equal-capital blends on one shared OOS span. The unfitted blend
  **λ = 0.01 + 0.02** matches the rule (net@4 **6.66 vs 6.63**) at **half the turnover** (7 vs 14×/yr) and
  **1.8×** the break-even (46.1 vs 25.5 bps); the only blend containing the broken λ=0.1 is the worst
  (4.36), so the rule's value was *slowness*, not selection. The port spec can drop the walk-forward for a
  fixed two-scale blend; the open caveat is whether a single λ frozen before the span would suffice.
* **CYCLE-032** — **the blend claim was the best of a menu; freeze a λ instead (F-49).**
  `e41_blend_hindsight.js` (guarding a rebuild that reproduces `e40` to 0.00) shows only **1 of 10**
  pre-registered blends clears the 0.2 bar (the cherry-picked `{0.01,0.02}`; the no-hindsight F-37-slow
  sets read 5.74 / 6.08), a blend-selection walk-forward reads 5.81, and the blend ranking flips by
  window — so F-48's blend headline is **menu-dependent**. But a **λ frozen** on `[0,S)` is robust on
  enough history: S ≤ 1.7 y picks the broken λ=0.1 (OOS 1.76–1.93); S ≥ 2.3 y picks **0.02** and matches
  the rule (OOS 6.81 / 6.64 / 4.10 vs 6.69 / 6.48 / 4.27). **Port λ policy: freeze λ on ≥ ~2.3 y, not a
  blend.** The rule's value is confined to the first ~2 years.
* **CYCLE-033** — **the cap is removed too; the spec is pinned (F-50).** `e42_cap_hindsight.js` (guards
  `e31` to 0.00) shows the joint (λ, cap) walk-forward **loses** to the pinned `ewma 0.02 + cap12.5 %` book
  OOS (**6.13 vs 6.86**; pinned ≥ rule on 4/5 sub-spans) — its F-39 edge was over the *broken F-24 spec*. The
  cap is a **flat plateau** (at λ=0.02: 6.63/6.77/6.86/6.90 for cap none/0.10/0.125/0.15) and **binds**
  (clips 42.3 % of entries) → `1/k=0.125` is structural. **Final R8 spec: pinned λ (≥2 y) + pinned cap
  1/k, no walk-forward.**
* **CYCLE-035** — **the cap is a concentration tool; a band stacks (F-52).** `e44_cap_mechanism.js` (guards
  `e30` to 0.00) isolates the cap's two effects with a **no-trade band**: turnover-matched to the cap
  (eps=0.008 → 10×/yr) the band reads net@4 **5.05** vs the cap's **6.18** (only **+0.13 of +1.26**), and
  across the band sweep (16→6×/yr) net@4 stays in **[4.95, 5.05]** — so the cap's edge is the weight
  *shape*, not churn. The band leaves OI capacity a **1.00×** multiple of base while the cap is
  **1.76×/1.70×** → the capacity gain is concentration. The two **stack**: capped+band net@4 **6.36** at
  **6×/yr**. Cost recipe becomes **EWMA + cap `1/k` + a no-trade band**.
* **CYCLE-037** — **the cap is a tail winsorisation (F-54).** `e46_cap_shrinkage.js` (guards `e30` to 0.00)
  closes the mechanism thread: a smooth saturation `c·tanh(w/c)` matches the hard clip (6.04 vs 6.18), so
  the hard form is not special — only the level (a plateau) — while `sign(w)·|w|^p` and equal-weight both
  destroy the edge (4.44…2.27, and 1.51). Keep the cap at ≈ `1/k`; implement it as a clip or a saturation.
* **CYCLE-038** — **split-point robustness (F-55).** `e47_split_robustness.js` (guards `e30` to 0.00) sweeps
  a dense 14-point grid under rolling-1y and expanding freezes. The pre-registered 0.80 bar narrowly fails
  (0.71 expanding / 0.79 rolling) because the expanding freeze collapses at every split S ≤ 2190 and works
  only from S = 2555 (safe boundary **~2.3 y**). The rolling freeze is more robust (median +0.30), the
  broken fast λ is **0.075** (not 0.1), and the **cap stabilises** the policy (0.50 → 0.79).
* **CYCLE-137/138** — **the band transfers to the stacked-16 panel (F-148/F-149).** `e135_stacked_band.js`
  (3/3): every band lane beats daily net at lower turnover (best eps 0.01 at 0.44, smooth; null lane
  reproduces e132 to the digit). `e136_stacked_band_holdout.js` (4/4): trailing pick 0.01 at ALL 8
  splits; frozen + fixed beat daily 8/8. Stacked native read: cap 0.125 + band ~0.01 (TODO 118).
