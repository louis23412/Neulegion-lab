# CYCLE-165 — Banking the 121 operator round (base + honest confirm)

**Date:** 2026-10-02
**Goal:** investigate-only round on the operator's 121 pair, per instruction
(no code, no new runs — document learnings + next plan).

## Verified (native report.json)

* Base `20261002T085226`: {11.26, 10.01/yr, 42.9}, risk pinned, 6606x8 —
  matches the CYCLE-163 pre-read to display precision.
* Honest `20261002T085240`: {6.25, 28,901 substituted, 10.01/yr, 43.8}.
* Both: every measured G5 knob passes; only decay/unseen attestations fail.

## Learned (repo §81, the round record)

1. **Band dividend measured:** 10.01 → 4.95 turnover, 42.9 → 83.5 BE,
   11.26 → 11.80 net. F-52 stacking holds through the gate. 121 closes.
2. **DE 32.6 → 2.8 via null-basis fill (0.52 → 0.006):** a third of the
   gate's harshness on the base book is shared-missingness artefact.
3. **Decay −0.093 → −0.015, halves −0.27 → −0.016:** the decay is a
   marks-window artefact; the honest book is lower but flat. C3 question
   flips to "which book is truthful" — G5 must score honest.

## Docs touched

Repo `RUN-ANALYSIS.md` §81 (+81.1 queue), `TODO.md` 121 closed; lab STATUS
queue → 116 next. Next plan focus: 116 (16-panel + cadence/exposure legs),
then 118 → 117; MRP-on-honest when a G5 run nears.
