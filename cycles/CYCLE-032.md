# CYCLE-032 — Is F-48's "fixed blend replaces the λ rule" robust, or hindsight? (L12 × L16, tests F-48)

**Date:** 2027-03-20
**Goal:** F-48 (CYCLE-031) concluded that R8's fitted walk-forward λ policy can be replaced by a **fixed
two-scale blend**. Two holes were left open, and CYCLE-031's own results flagged the first:
**(i)** only *one* of five pre-registered blends cleared the 0.2-Sharpe falsifier bar (`pair0102` 6.66 vs
the rule's 6.63); the others were **0.55–0.89** below — so "a fixed blend matches" might be a statement
about one hand-picked set, i.e. hindsight among a menu. **(ii)** the pinned λ=0.02 is in-sample; a *single
λ chosen before the test span* had never been tested. This cycle closes both, on the same construction and
the same shared OOS span as `e40`, and it **scopes F-48 down** — then finds a cleaner simplification that
does survive.

## Work

**`experiments/e41_blend_hindsight.js`** (new, registered as `e41_blend_hindsight`) — rebuilds the R8 λ
family (rank funding, EWMA(λ), strict 12.5 % cap) and the equal-capital blends, then:

1. **A frozen-λ ladder.** For split points S ∈ {1095, 1825, 2555, 3285, 4380}, pick λ **once** on `[0, S)`,
   freeze it, and score `[S, end)` — no rule, no re-selection. Report the picked λ and the test net@4,
   alongside the λ-only walk-forward (which re-picks each block), the pinned λ=0.02, and `pair0102`, all on
   the *same* sub-span. Plus a **fixed-length trailing-train** sweep (train lengths 365/730/1095/2190) to
   ask how much history the freeze needs.
2. **A no-hindsight blend menu** — 10 pre-registered blends, each annotated by the prior its membership
   needs. `slow4` = {0.005, 0.01, 0.02, 0.05} and `slow3` = {0.005, 0.01, 0.02} are the **no-hindsight**
   sets (membership follows from F-37's cost-aware *slow range* alone — the broken fast λ=0.1 dropped, no
   OOS performance consulted). Count how many clear the 0.2 bar.
3. **A blend-selection walk-forward** — pick the best blend *set* each block by trailing net@4 and trade it
   (can the blend choice itself be learned forward?).

**Pre-registered read.** F-48 is **robust** if a no-hindsight blend clears the 0.2 bar **and** the frozen-λ
ladder never picks the F-37-broken fast λ on short trains; it is **menu-dependent** if only the
cherry-picked pair clears the bar while the no-hindsight sets fail it.

**Guards.** The rebuild must reproduce `e40` exactly — λ-only walk-forward OOS **6.63**, pinned λ=0.02 OOS
**6.86**, `pair0102` OOS **6.66** — and `e30`/`e31` on the pinned full-history book. All five diffs are
**0.00** (absolute 0.01 per L10-z), so this cycle's numbers are on the same construction as F-48's.

## Results

**(a) The claim is menu-dependent: 1 of 10 blends clears the bar — and it is the cherry-picked one.**
On the shared OOS span `[1095, 6205)` (rule = 6.63; 0.2 bar = 6.43):

| blend set | membership prior | OOS net@4 | recent-24m | ×/yr | clears? |
| --- | --- | ---: | ---: | ---: | --- |
| {0.005,0.01,0.02,0.05} (`slow4`) | **no-hindsight** (F-37 slow range) | 5.74 | 4.24 | 10 | ✗ |
| {0.005,0.01,0.02} (`slow3`) | **no-hindsight** | 6.08 | 4.63 | 6 | ✗ |
| {0.01,0.02,0.05} (`mid3`) | slow range minus bottom | 6.02 | 4.04 | 13 | ✗ |
| {0.01,0.02} (`p01_02`, the F-48 winner) | **pair, chosen from OOS** | **6.66** | 4.58 | 7 | **✓** |
| {0.005,0.01} | pair | 5.58 | **4.74** | 4 | ✗ |
| {0.005,0.02} | pair | 5.93 | 4.53 | 6 | ✗ |
| {0.005,0.05} | pair | 4.78 | 3.85 | 13 | ✗ |
| {0.01,0.05} | pair | 5.51 | 3.89 | 14 | ✗ |
| {0.02,0.05} | pair | 5.75 | 3.56 | 17 | ✗ |
| {0.005,0.01,0.02,0.05,0.1} (`all5`) | naive (includes broken λ=0.1) | 4.36 | 3.43 | 18 | ✗ |

Only `p01_02` clears 0.2; **no** no-hindsight set does. So F-48's "a fixed blend replaces the rule" is a
statement about the *best of a menu* — the winning pair's membership is hindsight. (Three near-misses,
`slow3`/`mid3`/`slow4`, are 0.55/0.61/0.89 below the rule.) The menu also **re-ranks by window**: the best
*OOS* blend is `p01_02` (6.66), but the best *recent* blends are `{0.005,0.01}` (4.74) and `slow3` (4.63)
— so even the blend ordering is not stable.

**(b) The blend choice is not learnable forward.** A **blend-selection walk-forward** — pick the best set
each block by trailing net@4 — reads **OOS 5.81** vs the λ rule's 6.63 (recent-24m 4.12 vs 4.43), i.e.
**0.82 below** the bar. Its picks rotate `{0.02,0.05}` ×5, `{0.01,0.02}` ×4, `{0.005,0.01}` ×3, `all5` ×2.
So you cannot recover the blend ex ante either; the F-48 simplification does not come from a rule.

**(c) A single frozen λ *is* the honest simplification — but only with enough history.**

| split S | train | frozen λ | frozen OOS net@4 | λ rule (same span) | pinned 0.02 (same span) |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1095 | 1.0 y | **0.1** (broken) | **1.93** | 6.63 | 6.86 |
| 1825 | 1.7 y | **0.1** (broken) | **1.76** | 6.79 | 6.87 |
| 2555 | 2.3 y | 0.02 | **6.81** | 6.69 | 6.81 |
| 3285 | 3.0 y | 0.02 | **6.64** | 6.48 | 6.64 |
| 4380 | 4.0 y | 0.02 | 4.10 | 4.27 | 4.10 |

A λ frozen on **≤ 1.7 years** picks the F-37-broken fast λ=0.1 and **collapses** (1.76–1.93, i.e. 4.7–4.9
Sharpe below the rule). From **~2.3 years** on, the trailing winner is **0.02** and the frozen spec
**matches or beats the walk-forward** (6.81/6.64 vs 6.69/6.48; equal at 4.10 vs 4.27). So the walk-forward
rule's value is **concentrated in the early sample**, where short trailing windows are dominated by the
pre-2022 fast-λ era: it is insurance against locking in a broken λ, not a source of OOS alpha once ≥2
years of history exist. (The frozen-*blend* pick, `{0.02,0.05}` for every S, reads 5.75/5.54/6.39/6.17/3.42
— also below the rule; so the frozen-λ form is the better freeze, not the blend.)

**(d) The freeze knob is itself unreliable (non-monotone).** Fixed-length trailing trains show there is no
safe short window. At S = 1095 a **365-period** train picks λ=0.02 (frozen OOS **6.86**) but a **730- or
1095-period** train picks the broken 0.1 (1.93) — *more* training history, worse pick. At S = 3285 a
365/730-period train picks λ=0.005 (5.93) and the 1095+ trains pick 0.02 (6.64). Only from S = 2555 does
every train length agree on 0.02. So "freeze a λ on the recent past" is not a safe rule on a short history.

## What is now false that used to be believed

* **"A fixed two-scale blend replaces R8's walk-forward λ rule" (F-48's headline).** **Scoped down:** it
  holds only for the *best of a ten-blend menu* (the cherry-picked `{0.01, 0.02}`); **no** pre-registered
  no-hindsight blend clears the 0.2 bar (the F-37-justified slow sets read 5.74–6.08), and a
  blend-selection walk-forward fails it too (5.81). The blend simplification is therefore **not** free of
  hindsight.
* **"The pinned λ=0.02 is just in-sample — the walk-forward is what makes the spec honest."** Partly
  reversed: given **≥ ~2.3 years** of trailing data the frozen λ **is** 0.02 and matches the rule OOS
  (6.64–6.81 vs 6.48–6.69). The rule's real contribution is confined to the **first ~2 years**, where a
  frozen pick would be the broken λ=0.1.
* **(Constructive) The defensible simplification is a frozen λ on ≥2 y, not a blend.** F-48's useful core
  survives in a sharper form: R8 does **not** need a walk-forward *rule* for a mature sample — a single λ
  chosen on a ≥~2.3-year trailing window is equivalent OOS. The blend framing was the detour.

## Ledger effects

* New **F-49**; new experiment `e41_blend_hindsight.js`, new artefact `results/e41_blend_hindsight.json`;
  `run_all` is now **49 steps** with the `e40`/`e30`/`e31` cross-check guard (all diffs 0.00).
* **F-48** is scope-corrected (its blend headline is menu-dependent); **F-37**'s "cost-aware slowness is a
  rule" is refined (the rule matters for *short* history; a long-history freeze suffices).
* **L12**/**L16** updated; **FOLD-BACK R8** amended (the λ policy may be a frozen λ on ≥2 y, **not** a fixed
  blend).

## Next

* R8's **cap** half is now the only fitted object left in the port spec: CYCLE-031 dropped the λ rule, this
  cycle shows *how* to drop it honestly; whether the **cap** can equally be frozen/blended ex ante (or
  whether the joint (λ, cap) walk-forward of F-39 is doing real work) is the obvious next test.
* The frozen-λ result suggests a **minimum-history** requirement for the port: state "λ chosen on the last
  ≥ 2 years" and test the port spec on a rolling re-freeze (e.g. re-freeze annually).
* L19's construction lead (a `hold-N` cadence / non-equal two-scale blend) remains open.

## Run

`e41` ~2.1 s (registered). Full `run_all` regeneration **49 steps** (`RUN_SUMMARY` at
**2026-09-27T00:20:31Z**, ~11.9 min wall); controls `e0c`, `e5` (1h/15m), the 13-check `e14`, and the
validation guards `e28`–`e41` all report `pass` (0 fails).
