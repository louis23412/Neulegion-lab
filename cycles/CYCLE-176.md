# CYCLE-176 — 118 investigation + S4 G5 attestation (director's decision)

**Round:** operator ran `sleeve-midcap-118.sh all` — tests green; 3 of 4
stages banked (`src/runs/20261002T170204/05/06-seed1-sleeve`). `mid` flat
missing — re-run requested. Investigation only; no code touched.

## What went well

* Honesty-gate premise confirmed natively: mid-8 markedFraction = 0
  (22,166 ext substitutions, zero shipped marks). The harvest works.
* Band dividend reproduces on the honest book (stacked: turnover 17.26 →
  6.65, net 8.87 → 9.50, BE 24.7 → ~60).
* Breadth adds on honest: stacked-16 flat 8.87 > majors flat 6.25 (+2.6/yr).
* Pre-registered BE 30–50 beaten on both band lanes (69.6, ~60).
* G5 knobs pass except the two human attestations (by design).

## What failed / is missing

* `mid` flat not uploaded — blocks the e123 apples-to-apples (funding-only
  18.11 vs honest flat) and flat-vs-band on mid-8.
* Within-window decline on the honest 2024–26 book: yearly 0.43 → 0.20 →
  0.23, slope −0.10/yr, first-last CIs exclude 0. Descriptive (2.2-yr
  window), but it is real and it is the S4 content.

## Director's S4 decision (recorded repo §85.1, PLAN.md)

* `unseen` PASS (midcap legs — spec froze round 42, data harvested 2026-09/10).
* `decay` FAIL with measured numbers (slope −0.10/yr, first-last −0.15±0.08).
* `g5verdict` stays false. Next edge push (S6): allocation over the
  paying-but-declining honest carry book vs keep-off momentum arms.

## Also this cycle

* Caught and repaired a bad edit that deleted the §84 header (sections
  re-verified 1–85 contiguous). Lesson: append sections via script, never
  by heading-adjacent edit.

## Next

Operator: `sleeve-midcap-118.sh mid` + upload. Then S6 scoping (director).
