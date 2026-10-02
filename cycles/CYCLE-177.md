# CYCLE-177 — 118 complete (4/4): mid-flat deep dig + S6 allocation plan (2026-10-02)

**Round:** operator ran the missing `sleeve-midcap-118.sh mid` stage —
`src/runs/20261002T171237-seed1-sleeve` banked. Provenance verified from
`run.json`: 8 midcap candle inputs + 8 midcap funding files +
`carryMarks: src/data/marks_midcap_8h.json`, costBps 4 — the honest mid-8
flat leg, no fallback involved. Investigation + documentation only; no code
touched.

## The 4-lane honest book (all @ cost 4, cap 0.125, 2466 buckets)

| lane | run | net/yr | turnover | BE bps | neutral | slope/yr | first→last | DSR | markedFrac | worstBlock |
|---|---|---|---|---|---|---|---|---|---|---|
| mid-8 flat | …171237 | 8.16 | 11.09 | 34.2 | 8.24 | −0.128 | 0.36→0.17 | 1.0000 | 0 | 0.045 |
| mid-8 +band | …170204 | 8.56 | 5.22 | 69.6 | 8.65 | −0.128 | 0.37→0.18 | 1.0000 | 0 | 0.065 |
| stacked-16 flat | …170205 | 8.87 | 17.26 | 24.7 | 9.31 | −0.098 | 0.34→0.20 | 1.0000 | 0.317 | 0.113 |
| stacked-16 +band | …170206 | 9.50 | 6.65 | 60.1 | 9.97 | −0.095 | 0.36→0.22 | 1.0000 | 0.317 | 0.138 |

(All first-last CIs exclude 0; 6/6 blocks positive every lane; nullBasis
0.0024 mid / 0.0012 stacked; `g5verdict` false in-machine everywhere — the
two attestations are human, recorded CYCLE-176.)

## What the 4th leg teaches (PLAN D-09…D-14)

* **D-09 — honesty haircut, now exact.** e123 funding-only 18.11 vs honest
  flat 8.16 ⇒ 9.95/yr illusion (55%); the honest book retains 45%.
  Funding-only numbers stay unquotable.
* **D-10 — band dividend on mid-8.** Net +0.40 (8.16→8.56), turnover ÷2.1,
  BE ×2.0 (34.2→69.6). Smaller net gain than stacked (+0.63) but the same
  BE-doubling shape — the band is a cost mechanism, not a panel one.
* **D-11 — BE inversion: breadth without band LOWERS the buffer.**
  Mid-flat BE 34.2 > stacked-flat BE 24.7, while net rises (8.16→8.87).
  Breadth is the net lever, the band is the BE lever; quote them as a pair.
* **D-12 — breadth decomposition at flat.** Majors 6.25 → mid-8 8.16
  (+1.91) → stacked-16 8.87 (+0.71 over mid-8). The midcap legs beat the
  majors legs outright; stacking adds, diminishing but positive.
* **D-13 — decay is lane-independent.** Slopes −0.095…−0.128, yearly shape
  0.43–0.47 → 0.17–0.23 → 0.20–0.25 in ALL lanes, incl. a universal
  2025→2026 uptick (+0.02…+0.03). Regime shape, not policy artefact. S4
  stands, strengthened (4 lanes, not 3).
* **D-14 — no lane dominates: the net-vs-BE frontier IS the S6 question.**
  Best net = stacked-band (9.50); best BE = mid-band (69.6). And
  neutralAnnual ≥ netAnnual in all 4 lanes (+0.08…+0.46) — dispersion
  trails naive equal-weight on net; what it buys (turnover? BE?) is
  unscored because neutral turnover is not journaled (S6a).

## Budget correction

Sleeve scoring itself is sub-second (280 ms this leg) — the "minutes"
budget was script + test overhead. Future sleeve-only legs: ~seconds.

## S6 allocation plan (director-scoped; detail in PLAN.md)

S6a neutral-vs-dispersion decomposition (AI-side) → S6b within-book
allocation design (mid vs majors legs, flat vs band — the D-14 frontier;
DESIGN + gate like the 122a proposal, native runs only after design) →
S6c carry-vs-cash sizing under decay (forward haircut from −0.10/yr,
target-risk, worstBlock thin at 0.045). S6d (momentum weight) stays
linked to the 117 revisit number (p≲0.07): no unpark needed.

## Next

Operator: S0 only (122b native test — still the single owed gate). No new
native runs until S6b design lands. AI: S6a reads.
