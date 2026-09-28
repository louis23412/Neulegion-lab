# CYCLE-056 — Sample uniqueness: the sequential bootstrap's draw weight is the uniqueness *sum*, not the average, so it is length-biased — and the module does not implement the AFML bootstrap it cites (L10-bx…L10-bz)

**Date:** 2028-06-13
**Goal:** `analysis/uniqueness.js` is the reference implementation of López de Prado ch.4 sample uniqueness: the
per-observation **average uniqueness**, the **effective sample size** (sum of uniqueness) and a **sequential
bootstrap**. It is not on the shipped path (`analysis/` may not be imported by the hot path); the shipped
uniqueness weighting is a re-implementation in `hivemind/training/sample_weights.js#overlapUniqueness`, which
the repo cross-checks against this module. But this file is what the lock-registry bills as the proof of the
ch.4 formula, and `sequentialBootstrap` is its only algorithm, so it is the natural next audit: the question is
whether the module that *defines* uniqueness for the project computes what it says.

## Work

New experiment `experiments/e64_uniqueness_audit.js` (registered; **72 steps, 41 gated, 0 fails**; 82 ms in the
suite; **8 checks, all pass**). No probe was needed. The audit verifies the average uniqueness against an
**independent recompute** (a per-bar scan-all-spans count — a different data structure from the module's
typed-array concurrency) and against the shipped `overlapUniqueness`; the order-invariance and ESS identities;
the sequential bootstrap's basic contract (length, determinism, range, default size, empty); and then pins the
**draw law** itself — enumerating the module's own formula and comparing it to a Monte-Carlo of the real
generator, and to an independent **AFML ch.4** reference implementation. Three findings followed.

## Results

### A. The average uniqueness is exact — and the shipped re-implementation agrees bit-for-bit (validated)

`sampleUniqueness` reproduces the independent recompute to **1e-12** on the documented fixtures and on seeded
random spans: `[[0,2],[1,3]]` → **2/3, 2/3**; `[[0,0],[0,5]]` → **1/2, 11/12**. It is **per-label
order-invariant** (permuting the input permutes the output identically), and it matches the shipped
`overlapUniqueness` to **exactly 0** across 8 seeded fixtures. The ESS identities hold: point labels → **n**;
`ESS = sum of uniqueness`; `averageUniqueness = ESS/n`; `ESS ≤ n` (the fixture's 6 overlapping labels read
**5.5833** of 6); empty input → `[]` / `NaN` / `0`. So the module's headline quantity, and the shipped
averaged form, are correct.

### B. The sequential bootstrap's draw weight is the uniqueness *sum*, not the average (L10-bx)

`sequentialBootstrap` stores `avgU[i] = acc`, the **sum** of `1/concurrency` over the span — but the comment
calls it the "running **average** uniqueness", and the ch.4 weight **is** the average (`acc / (e − s + 1)`)
that the module itself computes one function above. Because the two differ by the span length, the draw is
biased toward **long** labels:

| fixture | average uniqueness | uniqueness sum | first-draw P(long) |
| --- | --- | --- | --- |
| `[0,0]` (1 bar) vs `[1,3]` (3 bars), **non-overlapping** | **1.0, 1.0** | 1, **3** | measured **0.7480** (module law **0.7500**) vs the intended **0.5000** |
| `[0,0]`,`[1,2]`,`[3,5]` (lengths 1,2,3), non-overlapping | 1.0, 1.0, 1.0 | 1, 2, 3 | measured **0.1688 / 0.3299 / 0.5014** vs the intended **1/3 each** |

The first witness is the clean one: two **non-overlapping** labels are each maximally unique (average
uniqueness 1.0), so the ch.4 weight is 50/50 — but the module draws the 3-bar label **3× as often**. The bias
grows without bound in the span-length ratio. LATENT/test-only (`sequentialBootstrap` has no shipped importer),
and the shipped check asserts only length/determinism/range, so it cannot detect it (the F-68 class).

### C. The implemented bootstrap is not the AFML ch.4 sequential bootstrap it cites (L10-by)

The module's heuristics is `uniqueness_sum / (1 + pick_count)` with a **static** numerator; the ch.4 reference
recomputes each candidate's **average uniqueness against the current selection** (so the numerator is
conditional, and the overlaps of what has already been drawn matter). On the two-cluster fixture
`[[0,1],[0,1],[2,3],[2,3]]`, conditioned on the first draw:

| second-draw P(i) | i=0 | i=1 | i=2 | i=3 |
| --- | --- | --- | --- | --- |
| module law (enumerated) | **1/7** | 2/7 | 2/7 | 2/7 |
| AFML ch.4 reference | 1/6 | 1/6 | **1/3** | **1/3** |

Total-variation gap **0.1190**. The reference prefers a label from the *other* cluster (its conditional
average uniqueness is 1.0 once the first label is drawn), while the module only discounts the just-drawn label
by `1/(1+count)`. Monte-Carlo (60 000 seeds, 15 140 conditioned pairs) matches the module's own law to within
2.5 SE, so the check is a faithful pin of the implemented behaviour, and the gap is a genuine algorithm
divergence. LATENT/test-only.

### D. Spans are unvalidated, so a degenerate span returns NaN or −0 (L10-bz)

| input | `sampleUniqueness` | `effectiveSampleSize` |
| --- | --- | --- |
| `[[0,2],[5,4]]` (zero-length: `start = end + 1`) | `[1, **NaN**]` (`0/0`) | **NaN** (the NaN poisons the sum) |
| `[[0,2],[6,4]]` (negative-length) | `[1, **−0**]` (`0/−1`) | 1 (the −0 does not) |

No throw, no abstain — just an inconsistent degenerate value, though the module docstring says uniqueness is
"in (0, 1]". LATENT (bar indices are never empty/negative in the shipped paths), but it is the same
degenerate-input gap the F-71 family is about.

### E. Scope

`analysis/uniqueness.js` is **reference-only**: no shipped module imports it (grep finds only the test suite
and the lock registry). The shipped path re-implements the average uniqueness in
`hivemind/training/sample_weights.js#overlapUniqueness` — which this cycle **validates to 0 deviation** from
`sampleUniqueness`. So all three findings are test-only/export-level reads of a reference module; nothing here
moves a report, and `no fold-back row`.

## What is now false that used to be believed

* **"`sequentialBootstrap` weights each observation by its (average) uniqueness."** It weights by the
  uniqueness **sum**, i.e. the average times the span length — so two non-overlapping labels with identical
  (maximal) average uniqueness are not drawn equally; the longer one is drawn in proportion to its length.
* **"The module implements the López de Prado ch.4 sequential bootstrap."** It implements a static-numerator,
  count-only heuristic. The reference reweights every candidate by its average uniqueness *against the current
  selection*, which the module never computes; on a two-cluster fixture the conditional draw distributions
  differ by 0.119 total variation.
* **"The shipped uniqueness weighting is a re-implementation that could drift from the reference."** It cannot:
  `overlapUniqueness` matches `sampleUniqueness` **exactly** (0 deviation, 8 fixtures) — and it is the *correct*
  average form, unlike `sequentialBootstrap`.
* **"A label span is a valid (start ≤ end) interval."** Nothing validates it: a zero-length span returns NaN
  (poisoning the ESS) and a negative-length span returns −0, rather than abstaining.

## Ledger effects

* **F-72** is added: `uniqueness.js` is **validated** against independent references (8/8 checks) with three
  registered rows — **L10-bx** (the sequential draw weight is the uniqueness sum, not the average; witnesses
  0.750 vs 0.500 and 1/6,2/6,3/6 vs 1/3 each), **L10-by** (the implemented heuristic is not the cited AFML
  ch.4 bootstrap; second-draw TV gap 0.1190) and **L10-bz** (unvalidated spans: NaN/−0 and an ESS poison). All
  three are test-only/latent; no fold-back row.
* `e64_uniqueness_audit.js` is the register's **eleventh synthetic-ground-truth experiment on a repo module**
  (after `e53`…`e63`). `run_all` is now **72 steps, 41 gated, 0 fails** (`RUN_SUMMARY` at
  **2026-09-27T08:02:05Z**).

## Next

* Remaining pure modules: **`holding.js`** (the turnover policy grid), the **`streams.js`/`world.js`** data
  layer, then `decision.js` / `parallel.js` / `replication.js` / `dependence.js`.
* Remaining L10 rows: **L10-h** (golden movement for any R1–R9 port), **L10-ad** (the carry attribution lag),
  **L10-ae** (`effectiveBars` unbounded).

## Run

No repo file is touched. Full regeneration: `run_all` → **72 steps, 41 gated, 0 fails**, `RUN_SUMMARY` at
**2026-09-27T08:02:05Z** (`e64` 82 ms; `e63` 90 ms; `e62` ~4.4 s; `e0d` the slowest; total **1232 s** this run).
