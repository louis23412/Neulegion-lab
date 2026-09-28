# CYCLE-066 — Port verification: the REPO's V2 sleeve layer reproduces every published book bit-for-bit on the lab's real data — and the exercise exposes that the lab's own shells disagree about which array is the book grid (L10-ct)

**Date:** 2028-08-22
**Goal:** `PLAN-round31.md` pivots the project off the (inert) learned layer and onto the lab's
**structural sleeves**; `docs/ARCHITECTURE-v2.md` / `docs/MIGRATION-V2.md` turn that into a modular V2
(contracts + registry + this session's V2.2: the shared book arithmetic in `src/core/primitives/*` and the
three pinned sleeve specs in `src/plugins/sleeves/*`). The lab's numbers (F-17/F-21/F-39/F-41/F-50/F-51/
F-60) are, strictly, statements about the **lab's** code until the repo runs the same arithmetic. F-60
validated the shared chain inside the lab (`prototypes/port.js` reproduces 5/5 stored books); this cycle
validates the **port**: the REPO modules, driven by the repo's own sleeves, must reproduce those same books
on the same real data. That is the G2 evidence `MIGRATION-V2.md` §1 names, and it is the one check the
repo cannot run itself (the real panel lives in the lab).

## Work

New experiment `experiments/e73_port_verify.js` (registered in `run_all.js`; **81 steps, 50 gated,
0 fails**; **10 checks, all pass**). It is **read-only on the repo**: it imports
`core/primitives/fingerprint.js`, `core/primitives/weights.js#cleanBook`, the three
`plugins/sleeves/*` modules and `plugins/risk/cap-band.js`, rebuilds the lab's aligned carry panel
(`e12#buildXsSeries`), reconstructs each sleeve through the **repo** `signal()`/`returns()` methods, and
compares the result to (a) the lab's own construction (`e17#buildBook` + `e22#buildMasked` + `e21#xsBookImpl`
+ `prototypes/port.js`) and (b) the stored numbers in `results/e30_retuned_capacity.json`,
`e32_fade_retune.json` and `e50_oi_band.json`.

**Pre-registered read.** PASS iff, for all three sleeves: (1) the repo weight rows are **exactly** the lab
book's rows (bit-for-bit), (2) the repo's cap/band chain equals the lab's `port.js` chain on the real rows,
and (3) the repo book's metrics reproduce the stored numbers to display precision (net@4 within 0.02,
turnover within 1/yr, break-even within 0.05 bps). A failure means the port changed the arithmetic and must
not be called a port.

## Results

### A. All three published books reproduce bit-for-bit (validated)

| sleeve | repo rows == lab rows | repo returns == lab returns | net@4 | turnover /yr | break-even bps | == stored (e30/e32/e50) |
| --- | :---: | :---: | ---: | ---: | ---: | :---: |
| R8 `carry-dispersion` (`ewma 0.02` + cap 1/8, no band) | yes | yes | **6.18** | **10** | **46.04** | yes |
| R7 `toptrader-fade` (`ewma 0.05` + cap 1/8, no band, sign −1) | yes | yes | **1.07** | **8** | **182.59** | yes |
| OI `oi-change` (50/50 of `ewma 0.1`+`ewma 0.25`, band 0.03, no cap) | yes | yes | **0.92** | **198** | **15.22** | yes |

The panel is the real 8-symbol basket (btcusdt…linkusdt), 6 557 book periods, fee 4 bps, `NEXT = 2`.
The chain check is separate and also exact: `cleanBook` on a raw rank-funding book is **fingerprint-identical**
between the lab's `port.js` and the repo's `core/primitives/weights.js` (`cleanChainIdentical: true`). So the
repo is not merely "close" to the lab — the rows, the returns and the post-processing chain are the same
functions.

### B. The book-grid discovery (L10-ct)

The port surfaced a **lab-internal inconsistency the lab had never had to name**, because until now the two
shells never had to agree with each other:

* `e12#buildXsSeries` returns **two** time arrays on the same object: the outer `times` (= `bookTimes`,
  length **n−1 = 6557**) and `legs.times` (length **n = 6558**).
* `e17#buildBook` (the R8/R7 construction shell) reads `const n = legs.times.length` → steps = **6558**,
  producing **6557** weight rows.
* `e21#xsBookImpl` (the OI shell) is handed `n` by its caller (`e21` passes `times.length`) → steps =
  **6557**, producing **6556** weight rows.

Both books are internally consistent and both published numbers are correct — but they are built on grids
that differ by one period, purely as an artefact of **which of two arrays of the same series object each
experiment happened to read**. A single hard-coded rule therefore cannot reproduce all three published books,
and a bit-level cross-check (which is what a port needs) cannot even line the rows up. The V2 primitives
resolve this the only honest way: the **book-grid length is an explicit input** (`buildFundingBook` /
`buildCrossSectionalBook` take `n`, defaulting to the leg rows), so the caller states the grid instead of the
primitive guessing. The three sleeves pass their own `view.n` through, and `e73` passes `n = times.length`
for the OI view only. Registered as **L10-ct** (lab-internal convention, latent: no published number is
wrong; the defect is that the two shells disagree about the meaning of "the book grid").

### C. Scope

Read-only on the repo; no lab number and no repo number moves. The experiment is the lab's **first
port-verification rig** — the inverse of the earlier audits (there the lab measures the repo; here the repo
must reproduce the lab). It is also the fifth consumer of `prototypes/port.js`, so F-60's "one module, five
books" claim is now confirmed from **both** sides of the port.

## What is now false that used to be believed

* **"A sleeve's book grid is unambiguous."** It is not: the lab's own two construction shells read two
  different arrays off the same `buildXsSeries` result (`legs.times` vs `times`), so they build on grids one
  period apart. The grid is a parameter, not a convention.
* **"The lab's stored sleeve numbers are only a claim about lab code."** They are now a claim about the
  repo's `core/primitives` + `plugins/sleeves` modules too — the repo reproduces them bit-for-bit.

## Ledger effects

* **F-81** is added: the repo's V2 sleeve layer reproduces the lab's three published books exactly; the new
  row **L10-ct** records the two-array book-grid disagreement.
* `e73_port_verify.js` is registered in `run_all.js` (gated on `verdict.validationPass`), so a future change
  to either side of the port fails loudly. `run_all` is now **81 steps, 50 gated, 0 fails**.
* Repo-side ledger: F-81 is the acceptance evidence in `docs/MIGRATION-V2.md` §1 (the V2.1 row now cites it
  explicitly) and `docs/research/core-contracts.md`.

## Next

* **Wire the sleeve book into the repo's scoring path** (round-31 W2/W3): a `--sleeve` run mode that builds
  the panel view from the repo data layer, calls sleeve → book → risk, and scores through the unchanged gate
  — that is when repo gate **G2/G5** gets a number, and the sleeves can leave `UNTESTED`.
* The repo-side `port.js` arithmetic is now triple-proved (exact vectors in `contracts.test.js` §D, the
  real-data re-derivation here, and the fingerprint identity of the chain).

## Run

No repo file is touched. `e73_port_verify.js` runs through the repo browser harness (imports resolved
against both trees); it wrote `results/e73_port_verify.json`. Full regeneration: `run_all` → **81 steps,
50 gated, 0 fails**.
