# CYCLE-021 — Sizing the retuned dispersion book: the binding limit switches from impact to open interest (L15, L17)

**Date:** 2026-11-18
**Goal:** F-37 (CYCLE-020) recovered the dispersion sleeve's fee margin with a slower, cost-aware weight
policy, and its own "next" named the open item: the F-26/F-27 **capacity** numbers ($13 M → $27 M with a
12.5 % cap) were measured on the old λ=0.1 book and are stale in exactly the way the F-24 fee economics
were. A slower book trades less per period — so square-root **impact** (F-26) should ease — but it also
holds a more persistent position, so the **open-interest position limit** (F-28) should tighten. The two
bounds move in opposite directions.

> **Does the retuned (slower) book carry more size than the λ=0.1 spec — and which constraint binds it,
> impact or OI?**

## Work

1. **`experiments/e30_retuned_capacity.js`** (new, registered as `e30_retuned_capacity`) — builds the λ
   family (0.005/0.01/0.02/0.05/0.1, rank target, EWMA + renorm) and the F-27 strict-cap variants
   (λ 0.02/0.05/0.1 + 12.5 % clip-and-hold), then measures **both** size bounds on the same legs:
   the square-root impact capacity via `e19#capacityOf` (single cost model) and the OI position limit via
   `e21`'s construction (G such that `mean|w_j|·G` reaches 1 %/5 %/10 % of the symbol's mean open
   interest). It reports each book's recent net@4 / break-even alongside, so size and edge sit on one row.
2. **Validation guard:** the λ=0.1 book must reproduce `e19`'s stored `xsRank_ewma0.1_norm` capacity
   exactly — it does ($13 211 348.6 at Y=1, break-even 12.7768 bps, to the last digit).
3. **Falsifier (pre-registered):** if the retuned book's *usable* size — min(impact capacity, OI position
   limit at 5 % of mean OI) — does not exceed the λ=0.1 spec's, then F-37's fee recovery does not extend
   to size and R8 stays a small-size sleeve.

## Results

**(a) The falsifier is refuted — usable size rises, and the binding constraint switches.** `Y=1` impact
capacity unless noted; OI bound at 5 % of mean OI.

| book | turnover ×/yr | recent net@4 | recent break-even | impact capacity (Y1) | OI bound | **usable size** | binding |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `ewma_0.1_norm` (F-24 spec) | 85 | −0.58 | 3.68 bps | **$13.2 M** | $23.4 M | **$13.2 M** | impact (DOGE) |
| `ewma_0.01_norm` (F-37 leader) | 9 | **+3.86** | **27.07 bps** | $1 986 M | $19.2 M | **$19.2 M** | **OI (LINK)** |
| `ewma_0.02_norm + cap12.5 %` | 11 | **+4.24** | **15.97 bps** | $726 M | $35.9 M | **$35.9 M** | OI (LINK) |
| `ewma_0.05_norm + cap12.5 %` | 26 | +2.67 | 7.03 bps | $80 M | $37.9 M | **$37.9 M** | OI (LINK) |

The λ=0.1 spec is **impact-bound** ($13.2 M, DOGE at 1.01 % of ADV) — F-26's story. Every slower book has
a *huge* impact capacity (per-period trade collapses) and is instead **OI-bound** (the persistent position
in the thinnest name, LINK, is the limit). So the retune does not merely move the same number: it changes
*which* constraint binds.

**(b) The F-27 cap and the slower λ compound, roughly tripling usable size.** With the 12.5 % clip-and-hold
cap the OI bound rises from $19 M → **$36–38 M** (the cap reduces the thin symbol's average weight, so the
OI-constrained notional rises) *and* the recent cost margin stays far above the fee (break-even 16.0 / 7.0
bps vs 4 bps). The **best combined R8 spec is `ewma_0.02_norm + cap12.5 %`**: usable **~$36 M**,
recent-24m net@4 **+4.24**, recent break-even **15.97 bps**, 11×/yr — i.e. **$13 M → $36 M (+173 %)**
against the old spec, at a *better* recent net Sharpe than either the old spec or the uncapped slow book.

**(c) A methodological point that matters for any hold-like sleeve.** The square-root impact capacity of a
slow book is *meaningless*: as turnover → 0 it diverges ($4.0 B at λ=0.005), because the model charges only
the per-period trade and a buy-and-hold never trades. The honest size limit for a persistent book is
**open interest**, exactly F-28's insight for the flat hold — and it is what binds here. Any future
capacity claim for a smoothed/hold book must carry the OI bound, or it will report a fictional billions.

## What is now false that used to be believed

* **"The dispersion book's size limit is impact, ~$13 M → $27 M" (F-26/F-27).** True for λ=0.1 only. For
  the retuned book the binding limit is **open interest (LINK)**, and usable size is **$19 M uncapped /
  ~$36 M with the cap** — the impact capacity is finite only for fast books.
* **"Slower weighting buys cheapness but costs size."** False: slowing the book *raises* usable size (it
  removes the impact bound) and the F-27 cap raises the OI bound too, so `ewma_0.02 + cap12.5 %` is both
  cheaper (break-even 16 bps) and larger ($36 M) than the λ=0.1 spec.
* **"Capacity can be read off the square-root model alone."** For any smoothed/hold book the model returns
  a diverging number; the OI position limit is the real constraint and must be reported alongside (this
  generalises F-28 from the flat hold to the dispersion family).

## Ledger effects

* New **F-38**; new experiment `e30_retuned_capacity.js`, new artefact `results/e30_retuned_capacity.json`.
  `run_all` is now **38 steps**.
* **L15** (capacity/impact) and **L17** (capacity-aware weighting) are re-opened with a size answer for the
  retuned spec. **L12/L16** inherit it. **FOLD-BACK R8** now carries the combined spec
  (`ewma 0.02 + 12.5 % cap`, ~$36 M) and the OI-bound caveat.
* No shipped number moves; `e14` unchanged (13 checks). `RUNNER.md` records the "for a hold-like book,
  report the OI bound" convention.

## Next

* The best combined spec (`ewma_0.02 + cap12.5 %`) was picked from e30's frontier, not walk-forward-selected
  like the λ in F-37; if R8 is ported, run the e29 walk-forward treatment on the *cap* too.
* The OI bound uses **mean** open interest over the sample; OI has grown, so the number should be re-read
  against the *current* OI before sizing (e21 keeps the per-symbol min as well).
* L18's fade capacity ($8–10 M, LINK-bound) and L07's liquidation-print half remain open.

## Run

`e30` ~2.4 s (registered). Full `run_all` regeneration **38 steps, 24.5 min** (`RUN_SUMMARY` at
**2026-09-26T19:25:43Z**); controls `e0c`, `e5` (1h/15m), the 13-check `e14`, and the validation guards
`e28` (F-36 cross-check), `e29` (OOS guard) and `e30` (e19 cross-check) all report `pass`.
