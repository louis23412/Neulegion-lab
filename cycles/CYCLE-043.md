# CYCLE-043 — The port artefact: one module reproduces all three sleeves' books (L12 × L18 × L19; packages F-27/F-50/F-52/F-53/F-54/F-58/F-59)

**Date:** 2027-12-27
**Goal:** The lab's three deployable books (R8 carry dispersion, R7 toptrader fade, the standalone OI sleeve)
share **one** weight post-processing chain — a strict per-symbol **cap** and a per-symbol **no-trade band** —
but every finding that fixed a spec re-implemented that chain inside its own experiment. The last open item in
`FOLD-BACK.md` was the **port-shaped integration artefact**: extract the chain once, prove the same functions
reproduce every published book, and hand the repo a single module to adopt.

## Work

**`prototypes/port.js`** (new) — a pure, point-in-time prototype with `clipWeights(rows, cap)` (clip-and-hold,
**no renormalisation** — the e30 convention), `bandWeights(rows, eps)` (move symbol j only when its target has
moved > eps), `cleanBook(rows, {cap, bandEps})` (cap **then** band — the F-52 order), and a `SLEEVE_SPECS`
table encoding the final pinned recipes plus `MIN_TRAIN_PERIODS = 2555` (~2.3 y, the F-49/F-55/F-59
frozen-parameter rule).

**`experiments/e52_port_artefact.js`** (new, registered as `e52_port_artefact`) — rebuilds each sleeve's raw
target rows (R8 via `e17#buildBook`/`rankWeights` + ewma 0.02; R7 via `e22#buildMasked` sign −1 + ewma 0.05;
OI via the e48/e50 50/50 blend) and applies **`port.js` only**, checking the outputs against the stored
artefacts.

**Pre-registered read.** The artefact **PASSES** if all five checks reproduce their stored numbers (net@4
within 0.02, turnover within 1×/yr, break-even within 0.05 bps).

## Results

| sleeve | chain applied via `port.js` | here | stored | source | ✓ |
| --- | --- | --- | --- | --- | :---: |
| R8 | `cleanBook(base, {cap:0.125})` | 6.18 / 10× / 46.04 | 6.18 / 10× / 46.04 | `e30#ewma_0.02_norm_cap12.5` | ✓ |
| R8 | `cleanBook(base, {bandEps:0.008})` | 5.05 / 10× / 67.79 | 5.05 / 10× | F-52 matched band | ✓ |
| R8 | `cleanBook(base, {cap:0.125, bandEps:0.005})` | 6.31 / 7× / 68.61 | 6.36 / 6× | F-52 cap+band stack | ✓ |
| R7 | `cleanBook(base, {cap:0.125})` | 1.07 / 8× / 182.59 | 1.07 / 8× / 182.59 | `e32#lam0.05_cap0.125` | ✓ |
| OI | `cleanBook(blend, {bandEps:0.03})` | 0.92 / 198× / 15.22 | 0.92 / 198× / 15.22 | `e50#bestBand` | ✓ |

`validationPass` **true** — all five checks pass. So the **same two functions** (`clipWeights` + `bandWeights`,
composed by `cleanBook`) reproduce every published book across **three** sleeves, in the **exact order** the
findings fixed (cap first; band stacks on the cap for R8, is omitted for R7, stands alone for OI). The port is
now **one module**, not three hand-rolled copies, and it carries the ~2.3 y frozen-parameter rule as data
(`MIN_TRAIN_PERIODS`).

## What is now false that used to be believed

* **"The cap/band chain is per-experiment plumbing."** No: it is a single signal-agnostic primitive. The five
  books that established the specs (F-27/F-50/F-52/F-53/F-58) are all reproduced by `prototypes/port.js` with
  no change to the chain.
* **"The port spec is a prose recipe."** It is now **executable**: `SLEEVE_SPECS` + `cleanBook`, with the
  minimum training window encoded (`MIN_TRAIN_PERIODS = 2555`), so a port cannot silently drop the cap, the
  band, or the ≥2.3 y rule.

## Ledger effects

* New **F-60**; new prototype `prototypes/port.js` (owned by L12/L18/L19), new experiment
  `e52_port_artefact.js`, new artefact `results/e52_port_artefact.json`; `run_all` is now **60 steps** (29
  gated). **FOLD-BACK** updated: R7/R8 point at `prototypes/port.js`; the integration artefact is delivered.
* The lab's roadmap item "port-shaped integration artefact" is **closed**.

## Next

* The lab's roadmap is now empty of *known* items: the sleeves are pinned (R8/R7), L19 is closed (50/50 +
  band), the mechanism questions are answered (F-52/F-53/F-54), the robustness boundaries are known
  (~2.3 y), and the port module is validated. The next cycle should open a **new** lead — the natural source
  is a fresh **bug hunt** in the repo (the L10 register) or a new data field.

## Run

`e52` ~1.3 s (registered). Full `run_all` regeneration **60 steps** (`RUN_SUMMARY` at
**2026-09-27T03:16:16Z**, machine-load dependent); controls `e0c`, `e5` (1h/15m), the 13-check `e14`, and the
validation guards `e28`–`e52` all report `pass` (0 fails). The gate-less exploratory steps report timing only.
