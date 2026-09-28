# CYCLE-034 — Is the fade's spec pinned too? The F-48/49/50 chain on R7 (L18; tests F-40)

**Date:** 2027-05-10
**Goal:** CYCLE-031/032/033 (F-48/F-49/F-50) removed every fitted object from **R8**'s port spec: the λ rule
is replaceable by a **frozen λ on ≥ ~2 y** (F-49), and the cap is a **structural plateau** at `1/k = 0.125`
(F-50) — so R8 is a **pinned book**, with no walk-forward. R8 is the carry-dispersion sleeve. The lab's other
deployable sleeve is **R7**, the toptrader **fade**. F-40 already showed the fade's own walk-forward was
*worse* than pinning (+0.70 vs +0.94 OOS) because its Sharpe ~0.8 makes trailing windows noise-dominated —
but that was a single pinned comparison, not the F-48/F-49/F-50 chain. If R8 is rule-free, the natural
capstone is to run the **same three tests** on the fade: does a fixed blend replace its λ rule, does a
**frozen λ** match it, and is the cap a **structural plateau** here too? The pre-registered expectation is
that the fade should come out rule-free **trivially** (its rule already loses), but it is worth one artefact
to confirm the pattern and to quantify *why* the fade's rule is noise-driven.

## Work

**`experiments/e43_fade_pinned.js`** (new, registered as `e43_fade_pinned`) — rebuilds e32's fade (λ, cap)
grid (λ ∈ eight values {0.02 … 0.5}, cap ∈ {none, 0.125}; joint (λ, cap) walk-forward, 365-period blocks;
guards reproduce `e32` **exactly** — joint WF 0.70, pinned `ewma 0.1` 0.94, `+cap` 1.11, `ewma 0.05+cap`
1.14, `ewma 0.02` 0.69, `ewma 0.02+cap` 1.03, all diffs **0.00**), then applies the cycle-031/032/033
machinery to the fade:

1. The **joint (λ, cap) walk-forward** (e32 construction) and the **best pinned** book on the shared OOS span.
2. **Frozen λ with the cap fixed** at the structural `1/k = 0.125` — pick λ once on `[0, S)`, freeze, score
   `[S, end)`; compare to the walk-forward on the *same* span.
3. **Frozen λ with no cap** and **frozen (λ, cap) joint** — the two controls.
4. **λ-flatness** — the OOS net@4 across all eight λ's, with and without the cap (the reason the rule is
   noise-driven), plus **cap sensitivity** at λ=0.1.

**Pre-registered read.** The fade is **rule-free** if the joint (λ, cap) walk-forward does **not** beat the
best pinned book, **and** a λ frozen on ≥ ~2 y is within 0.2 Sharpe of the walk-forward on the shared OOS span.

## Results

**(a) The joint (λ, cap) walk-forward LOSES to the best pinned book.** On the shared OOS span
`[1095, 5110)`, the joint rule reads **0.70** (recent-24m 0.46) while the best pinned book
(`ewma 0.05 + cap12.5 %`) reads **1.14** and even the pinned `ewma 0.1` spec reads **0.94**. So the fade's
F-40 result reproduces in the full F-48/F-49/F-50 form: **the rule does not earn its keep.**

| test span `[S, end)` | joint (λ, cap) WF | frozen λ (cap = 1/k) | frozen λ (no cap) | frozen (λ, cap) |
| --- | ---: | ---: | ---: | ---: |
| 1095 (4015) | 0.70 | **1.14** (`0.05+cap0.125`) | 0.69 (`0.02`) | 0.69 (`0.02`) |
| 1825 (3285) | 0.87 | **1.15** (`0.05+cap0.125`) | 0.72 (`0.02`) | 0.72 (`0.02`) |
| 2555 (2555) | 0.31 | **0.37** (`0.075+cap0.125`) | 0.72 (`0.5`) | 0.37 (`0.075+cap0.125`) |
| 3285 (1825) | 0.60 | **0.83** (`0.05+cap0.125`) | 1.47 (`0.03`) | 0.83 (`0.05+cap0.125`) |
| 4380 (730) | 0.93 | 0.87 (`0.05+cap0.125`) | 1.13 (`0.05`) | 0.87 (`0.05+cap0.125`) |

A λ frozen on `[0, S)` with the cap fixed picks **0.05** at essentially every split (0.075 only at S=2555)
and reads **1.14 / 1.15 / 0.37 / 0.83 / 0.87** vs the walk-forward's **0.70 / 0.87 / 0.31 / 0.60 / 0.93** —
beats-or-within-0.2 at every split (`frozenCapFixedLateMatchesWf: true`, `fadeRuleFree: true`). Unlike R8,
the fade does **not** need a ≥2 y minimum history for the freeze: even a 1-year train picks 0.05 (a
consequence of (c) below).

**(b) The cap helps here too, at λ=0.1.** OOS net@4 **0.94** (no cap) → **1.11** (cap 0.125), turnover
**28 → 16×/yr**. (F-40/F-32's "the 12.5 % cap transfers to the fade" reproduced: OI bound and net both rise.)
The cost is a worse recent-24m read (0.84 → 0.47) — the cap slows the book, and the fade's recent edge lives
in the faster λ, so the cap is a *capacity/robustness* add, not a recent-Sharpe add. This is the same
trade-off F-40 flagged, now measured on the OOS span.

**(c) The fade's rule is noise-driven because its Sharpe surface is nearly flat in λ.** With the cap fixed at
0.125, the OOS net@4 across the eight λ's (0.02 → 0.5) spans only **0.16** (1.14 / 1.14 / 1.11 / 1.11 / 1.10
/ 1.10 / 1.07 / 1.03); without the cap the spread is **0.25**. So there is no λ to *find*: the walk-forward's
trailing-window comparisons (F-40's mechanism) are ranking near-ties, and it churns between `0.15+cap` (3×),
`0.05` (2×), and six other keys (1× each) — for a *worse* OOS than simply pinning 0.05. **This is the
quantified form of F-40's "trailing windows are noise-dominated at Sharpe ~0.8".**

**(d) Freezing the joint pair is not needed here.** Because the fade's λ surface is so flat, the frozen
*joint* (λ, cap) picks land on the same books as the frozen λ (0.05/0.075 + cap), and read identically at
every split except S=3285/4380 where the frozen λ's no-cap control wanders (0.03, 0.05). So on the fade the
distinction between "freeze the cap" and "freeze the pair" that mattered for R8 (F-50c/d) **does not matter**
— the plateau is flat enough that any reasonable freeze works.

## What is now false that used to be believed

* **"R7 (the fade) needs a walk-forward to choose its λ."** Reversed: the joint (λ, cap) walk-forward reads
  **0.70** OOS vs the pinned **1.14**, and a λ frozen on ≥1 y with the cap at `1/k` matches-or-beats it at
  **every** split. F-40 said the walk-forward was "worse than pinning" in one comparison; this confirms it in
  the full F-48/F-49/F-50 form and supplies the mechanism — the fade's λ surface spans only **0.16** OOS, so
  the rule is choosing among near-ties. **R7 is a pinned book.**
* **"The λ ≥ 2 y minimum-history requirement generalises."** Scoped: R8's frozen λ needs ≥ ~2 y (F-49,
  because its early-regime winner λ=0.1 is *broken*); the fade's frozen λ does **not** (pick 0.05 even on
  1 y), because the fade has no broken λ in the first place. The "≥ ~2 y" rule is a property of R8's
  broken-early-λ, not of freezing as such.
* **"The cap's effect is sleeve-specific."** Refined: the `1/k = 0.125` cap lifts the fade's OOS net@4
  0.94 → 1.11 and halves turnover 28 → 16×/yr — the same direction as R8 (F-50/F-27) — but on the fade it
  costs recent-24m Sharpe (0.84 → 0.47). So the cap is a **capacity** add on both sleeves, but the fade
  pays for it in recent performance whereas R8 did not.

## Ledger effects

* New **F-51**; new experiment `e43_fade_pinned.js`, new artefact `results/e43_fade_pinned.json`; `run_all`
  is now **51 steps** with the `e32` cross-check guard (all diffs 0.00).
* **F-40** extended (its "walk-forward worse than pinning" is now the full chain, with the λ-flatness
  mechanism); **F-50/F-49/F-48** extended (the pattern now covers **both** deployable sleeves — R8 *and* R7
  are pinned books); **F-27** gets a second sleeve confirmation (the cap helps the fade too).
* **L18** updated; **FOLD-BACK R7** amended (the port spec is a **pinned** book: λ=0.05, cap = 1/k).
* **The port conclusion is now symmetric:** both deployable sleeves (R8 carry dispersion, R7 toptrader fade)
  have **pinned** port specs with a structural cap and no walk-forward. The lab's F-39/F-40 walk-forward
  machinery is unnecessary for *either* sleeve.

## Next

* **Both port specs are pinned.** Write-down: `R8 = ewma 0.02 + cap 12.5 %` (λ on ≥ ~2 y), `R7 = ewma 0.05 +
  cap 12.5 %`, both sized by F-42's clipped trailing-median schedule and bounded by F-41's min-of-ratio OI
  capacity.
* L19's construction lead (a `hold-N` cadence / non-equal two-scale blend) remains open — the one place a
  *construction* (not a fitted rule) could still beat pinning.
* L10-y's vol-scale caveat (capital-fraction mixes measure the vol ratio) remains open for any joint sizing.

## Run

`e43` ~1.6 s (registered). Full `run_all` regeneration **51 steps** (`RUN_SUMMARY` at
**2026-09-27T00:44:00Z**, ~8.1 min wall); controls `e0c`, `e5` (1h/15m), the 13-check `e14`, and the
validation guards `e28`–`e43` all report `pass` (0 fails).
