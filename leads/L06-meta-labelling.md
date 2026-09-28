# L06 — Re-aim the learner: meta-labelling / abstention

**Status:** NEGATIVE — closed (F-35)
**Opened:** CYCLE-000 (identified), CYCLE-001 (registered)
**Last updated:** CYCLE-018
**Owner experiments:** `e26_meta_label.js`
**Prototypes:** `e26#causalOos` + `e26#fitLogisticFlat` (a purged expanding-window OOS classifier)
**Result artefacts:** `results/e26_meta_label_1h.json`, `results/e26_meta_label_15m.json`
**Fold-back rows:** R6
**Falsifier:** Brier skill of `P(rule's trade profitable)` vs the *rule's* base rate ≤ 0 → the
machinery has no role and `NL-BENCH`'s closure extends to the meta target.

## Claim

Direction is not predictable at this horizon (the project's own `NL-BENCH` G-A: no model class beats
the base rate on Brier score), but *whether a given rule's trade will pay* is a different, easier
target — it conditions on a setup whose context matters — and it is directly actionable (take / pass
/ size). The learner's only defensible job given the evidence is **abstention and sizing on top of a
rule**, not predicting the next bar's sign.

## Why we care

This was the reframing that would make the large, well-tested, currently-inert learned layer (memory,
LSH, legion) actually useful without inventing a new mechanism — only a new *label*. If it worked, the
project's real asset (the evaluation harness) would finally have something worth evaluating.

## Evidence

CYCLE-018 measured the target itself (not the architecture): the repo's eight causal features plus the
rule's own position, an L2 logistic regression refit on an expanding, horizon-purged window, scored OOS
against the causal training-window base rate, with a shuffled-label null and an oracle/anti-oracle
control — for three base rules (`sig-momentum`, `sig-acceleration`, `sig-reversal`) at 1h and 15m
(`e26_meta_label.js`).

* **The falsifier fires.** OOS Brier skill vs the causal base rate is **≤ 0 for every rule at both
  timeframes**: −0.0013 / −0.0011 / −0.0003 at 1h and −0.0007 / −0.0010 / −0.0010 at 15m. The
  shuffled-label null scores ≈ −0.003, so the real model is ~+0.002 above the null but at or below the
  base rate; the skill is positive in only 10–48 % of 29 blocks.
* **AUC is a whisper, not an edge.** Pooled AUC **0.504–0.508** (per-stream 0.497–0.521) — a real,
  detectable rank signal at n ≈ 4–6×10⁵, but the probabilities are not calibrated and a capacity probe
  shows the (tiny) skill is positive only at one gradient iteration (+0.002) and goes more negative as
  capacity rises (overfitting).
* **The abstention overlay is not a strategy.** At 1h, filtering to the top predicted probabilities
  lifts net@4 from −0.081/−0.063/−0.588 to **+0.020/+0.025/+0.061** — but only by keeping
  **0.68 % / 0.49 % / 0.27 %** of acting bars (vs a null-model filter mean of −0.056/−0.046/−0.021). At
  15m the trend rules stay negative (−0.016 / −0.009) and only `rev` turns positive on 0.016 % of bars,
  mostly without beating the null.
* **Controls green.** Oracle filter gross Sharpe +2.1…+2.3, anti-oracle −1.9…−2.3.

## Verdict

**NEGATIVE.** The meta-label target is not predictable enough to beat the rule's own base rate, so the
learned layer still has no job — and re-labelling it does not give it one. NL-BENCH's closure extends
to the meta target. The residual to record is narrow: a *detectable but negligible* rank signal
(AUC ≈ 0.51) that shows up only as a marginal, tiny-subset abstention gain at 1h and not at 15m.

## Next actions

None — closed. If a genuinely new feature family (`E-C`: new venue/asset data, liquidation prints)
ever appears, `e26#causalOos` is the cheapest honest test of whether a target is predictable at all;
re-run it before designing any learner.

## Log

* **CYCLE-000** — identified as J6 / E-D; not yet measured.
* **CYCLE-001** — registered as a lead with a falsifier and a planned experiment.
* **CYCLE-018** — measured (`e26_meta_label.js`, F-35): the falsifier fires at every rule, timeframe and
  capacity. **L06 → NEGATIVE (closed).** No fully-open lead remains.
