# CYCLE-033 — Is R8's cap rule removable too? Frozen (λ, cap) vs the joint walk-forward (L12 × L17, tests F-39/F-49)

**Date:** 2027-04-15
**Goal:** CYCLE-031/032 (F-48/F-49) removed R8's fitted **λ rule**: a λ frozen on ≥ ~2.3 years of trailing
data matches the λ-only walk-forward out of sample, and the rule's value is confined to the first ~2 years.
That leaves **one** fitted object in the R8 port spec: the **cap**. F-39 reached "port-ready" with a
**joint (λ, cap) walk-forward** over a 40-book grid — but its own stored picks are a warning sign: it selects
`cap=null` through 2021–2023 and `cap=0.1` from 2024 on (never the pinned 0.125), and its OOS net@4 is
**6.13** while the *best pinned* book (λ=0.02, cap=0.125) reads **6.86**. Same pattern as F-48/F-49 — the
rule beats the *broken* F-24 spec, not a well-chosen pinned one. So: does the cap rule earn its keep, or is
R8's whole spec a pinned book?

## Work

**`experiments/e42_cap_hindsight.js`** (new, registered as `e42_cap_hindsight`) — rebuilds the 40-book
(λ, cap) grid (λ ∈ ten values, cap ∈ {none, 0.10, 0.125, 0.15}; guards reproduce `e31` **exactly** — joint
WF 6.13, pinned 0.02 6.63 / 0.02+cap 6.86 / 0.1+cap 1.93, all diffs **0.00**), then:

1. The **joint (λ, cap) walk-forward** (e31 construction) and its OOS / recent / pick frequency.
2. **Frozen combined (λ, cap)** — pick the pair once on `[0, S)`, freeze, score `[S, end)`.
3. **Frozen λ with the cap fixed** at the structural `1/k = 0.125` (F-27's equal-weight choice).
4. **Frozen cap with λ fixed** at 0.02.
5. **Cap sensitivity** at λ=0.02 (OOS / recent / turnover across the cap grid) and whether the cap **binds**.

**Pre-registered read.** The cap rule **earns its keep** if the joint (λ, cap) walk-forward beats the best
pinned single book on the shared OOS span. Otherwise the cap should be pinned. Freezing the *joint* spec is
only usable if a frozen (λ, cap) chosen on ≥ ~2.3 y matches the walk-forward OOS.

## Results

**(a) The joint (λ, cap) walk-forward does NOT beat the best pinned book.** On the shared OOS span
`[1095, 6205)`, the joint rule reads **6.13** (recent-24m 4.49) while the pinned `ewma 0.02 + cap12.5 %`
book reads **6.86** (recent 4.30) and `ewma 0.02` plain reads **6.63**. The pinned book is ≥ the rule on
**4 of 5** sub-spans:

| test span `[S, end)` | joint (λ, cap) WF | pinned 0.02 + cap0.125 | frozen (λ, cap) | frozen cap (λ=0.02) |
| --- | ---: | ---: | ---: | ---: |
| 1095 (5110) | 6.13 | **6.86** | 2.48 (`0.075+cap0.1`) | 6.77 |
| 1825 (4380) | 6.29 | **6.87** | 2.29 (`0.075+cap0.1`) | 6.84 |
| 2555 (3650) | 6.78 | **6.81** | 6.49 (`0.03+cap0.15`) | 6.81 |
| 3285 (2920) | 6.41 | **6.64** | 6.12 (`0.03+cap0.15`) | 6.64 |
| 4380 (1825) | 4.42 | 4.10 | 3.53 (`0.03+cap0.15`) | 4.10 |

So the rule's F-39 edge was over the **broken F-24 spec** (+2.76), exactly the F-48/F-49 pattern: the
walk-forward does not beat a well-chosen pinned book. **F-39's "the port spec is a joint walk-forward" is
scope-corrected: the port spec is a pinned book.**

**(b) The cap is a flat plateau and it binds.** At λ=0.02, OOS net@4 is **6.63** (no cap) / **6.77** (0.10)
/ **6.86** (0.125) / **6.90** (0.15); recent-24m **3.43 / 4.40 / 4.30 / 4.16**; turnover 17 / 8 / 10 / 11×.
Every cap ≥ 0.10 beats no-cap, and the exact level barely matters — so the structural **`1/k = 0.125`** is a
principled, *non-tuned* pick, not a knife-edge. The cap **binds**: **42.3 %** of weight entries are clipped
(max vector weight without it is 0.438). This confirms F-27's cap value **out of sample** for the first
time (it lifts OOS net@4 6.63 → 6.86 and cuts turnover 17 → 10×).

**(c) Freezing the *joint* pair is unreliable.** S ≤ 1825 picks the early-regime winner `0.075+cap0.1`
(frozen OOS **2.29–2.48**); S ≥ 2555 picks `0.03+cap0.15` (6.49 / 6.12 / 3.53) — **0.29–0.89 below** the
walk-forward. So "just freeze (λ, cap)" does **not** work (the early regime's no-cap/fast-λ winner is wrong
for the later regime).

**(d) The robust freeze is the CAP, not the pair.** With λ fixed at 0.02, the cap chosen on trailing data
reads **6.77 / 6.84 / 6.81 / 6.64 / 4.10** — **≥ the joint walk-forward at every split**, and it works even
on **1 year** of history (the plateau flattens the choice). The λ freeze with the cap fixed lands on 0.03
(6.55 / 6.36) — slightly below 0.02, i.e. F-49's λ fragility persists inside the capped family. So the right
division of labour is: **freeze the λ (needs ≥2 y, F-49) and pin the cap (a flat plateau, robust even on
short history).**

## What is now false that used to be believed

* **"R8's port spec is a joint (λ, cap) walk-forward" (F-39).** **Scope-corrected:** the joint rule is
  **dominated** by the pinned `ewma 0.02 + cap12.5 %` book out of sample (6.13 vs **6.86**, pinned ≥ rule on
  4/5 sub-spans). The rule's advantage was over the *broken F-24 spec* (+2.76), not over a well-chosen
  pinned book — the third appearance of F-48/F-49's pattern (F-37's λ rule, F-48's blend, F-39's cap rule).
* **"The cap is a tuned parameter you need a rule to choose."** Reversed: the cap is a **flat plateau**
  (anything in [0.10, 0.15] gives 6.77–6.90 OOS vs 6.63 uncapped), so the structural `1/k = 0.125` is
  non-tuned, and freezing the cap is robust even on short history. The cap is a **structural** choice that
  *helps* (it binds 42 % of the time), not a fitted one.

## Ledger effects

* New **F-50**; new experiment `e42_cap_hindsight.js`, new artefact `results/e42_cap_hindsight.json`;
  `run_all` is now **50 steps** with the `e31` cross-check guard (all diffs 0.00).
* **F-39** scope-corrected (the joint walk-forward is unnecessary — pin the spec; its OOS edge was over the
  F-24 spec); **F-27** gets its first **out-of-sample** confirmation (cap lifts OOS net@4 6.63→6.86, cuts
  turnover 17→10×, binds 42 %); **F-48/F-49** extended (the same "rule vs pinned" pattern now covers the cap).
* **L12 / L16 / L17** updated; **FOLD-BACK R8** amended (the port spec is a **pinned** book: λ chosen on
  ≥ ~2 y, cap = 1/k).
* R8 now has **no fitted-object rule**: the spec is a pinned construction with one minimum-history
  requirement (λ) and one structural parameter (cap).

## Next

* **R8 is now rule-free.** The last fitted object was the cap; it is a structural plateau. The port spec to
  write down is `ewma 0.02 + cap 12.5 %`, sized by F-42's clipped trailing-median, with λ's ≥ ~2 y
  minimum-history caveat.
* **Port the same chain to R7 (the fade).** F-40 showed the fade needs no λ retune and the cap transfers;
  the natural capstone is to confirm the fade's **pinned** spec is equally rule-free (the fade's own
  walk-forward was already *worse* than pinning, F-40 — so the pattern should hold trivially, but it is
  worth one artefact).
* L19's construction lead (a `hold-N` cadence / non-equal two-scale blend) remains open.

## Run

`e42` ~1.7 s (registered). Full `run_all` regeneration **50 steps** (`RUN_SUMMARY` at
**2026-09-27T00:32:13Z**, ~8.0 min wall); controls `e0c`, `e5` (1h/15m), the 13-check `e14`, and the
validation guards `e28`–`e42` all report `pass` (0 fails).
