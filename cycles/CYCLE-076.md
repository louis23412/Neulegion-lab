# CYCLE-076 — Round 43: the e74 composer verification (repo chain reproduces R8 on real data)

**Date:** 2026-09-28
**Goal:** close the R40/R42 loop — drive the repo's own `buildCarrySleeveView` + `scoreSleeve` chain on the real 8-symbol panel and check the economics against the stored R8 book, then read the first real-data G5 knobs.

## The read (pre-registered, e74)

* `experiments/e74_composer_verify.js` (11 checks): view coverage (buckets ≥ 6500, 8 streams, null-basis < 5%), economics vs stored R8 (net@4 ±0.5, turnover ±2/yr, break-even ±3 bps), G5 knob identities, G5 verdict false on unscored dsr + unattested decay/unseen.
* First run (stale builder): **2 fails** — net@4 0.25 vs 6.18, break-even 72.32 vs 46.04, turnover exact. Turnover intact + economics off = the weights matched, the P&L did not.

## Diagnosis (two builder defects, both real-data-only — e73's lab-panel port never touches them)

1. **Double-counted funding (2.02 vs 6.18).** The builder stored spot−perp+funding in `basisPnl` while every consumer (`buildFundingBook`, sleeve `returns`, `e12#buildXsSeries` legs) earns basis+funding — funding counted twice. Proved by driving the repo sleeve on the lab's own legs: **6.19 vs 6.18**, weights bit-identical. Fix: `basisPnl` is spot-minus-perp only.
2. **Zero mark read as a price (0.76 vs 6.18).** A shipped `markPrice` of 0 (the missing-mark sentinel before 2023-10-31, where the ext substitution has no bucket) passed the finite guard as `markLast = 0`, fabricating −100 % perp / +100 % basis prints (−5.3 % book periods at 2023-02-24, +4.1 % at 2022-07-31). On the common grid the books already matched (6.88 vs 6.76, corr 0.53); 51 fabricated periods collapsed the full book 6.88 → 0.88. Fix: `mark > 0` required (the lab's own `loadFundingBuckets` rule).

## Landed (repo, round 43)

* `src/sleeve_score.js`: legs-separated contract in the header comment; `basisPnl` pure; 0-mark missing.
* Two new `contracts` §K2 checks (legs-separated identity on the synthetic grid; zero-mark nulls with the lab-consistent next-period skip). 155 → **157**, node mirror in the same change.
* Ledger: **2834 → 2836** (RUNBOOK §6 table + round note, node mirror, ROADMAP suite line, PLAN-round31 status, `src/README.md` ledger). No golden moves; no registry change (bug fix, no new module).

## Verification (browser harness)

* `contracts` **157/0** green at the freeze.
* `e74` **11/11 PASS**, artefact rewritten: repo **6.25 vs 6.18**, turnover **10.01 vs 10×/yr**, break-even **43.83 vs 46.04 bps**.
* First real-data G5 knobs for R8: level **6.25**, **6/6** positive blocks, neutral **6.29** (raw 6.25), stress halves 7.01/6.47, worst block 3.91; verdict false exactly on dsr/decay/unseen (the operator run owns them).

## Lab effects

* `e74` registered in `run_all.js` (now 82 steps worth of coverage); FINDINGS **F-85** (this cycle).
* FOLD-BACK: W2 scoring half now closed end-to-end on real data; remaining queue is the `--sleeve` CLI flag plus R5.
* Standing lesson (third instance): a claim the lab panel cannot make (e73's lab legs) needs a real-data read (e74) — the composer had TWO stacked defects and each fix moved the number (0.25 → 2.02 → 0.76 → 6.25), so a single partial fix would have "confirmed" a wrong story.

## Next

* Round 44: the `--sleeve` CLI flag + report block (W2 acceptance: sleeves as a first-class `analyze` mode). Needs native `npm test` cover — the flag parse path is node-side.
* Native `npm test` on the operator machine required before further landings (four report-path rounds since the 131/131 confirmation).
