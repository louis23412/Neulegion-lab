# L08 — Execution realism: the maker-fill model

**Status:** **NEGATIVE — closed (CYCLE-017, F-34).** A conservative maker model (no impossible fills, no
spread credited, unfilled orders cancelled) removes the whole reversal edge before any fee: the maker
book's gross Sharpe is −0.002 (1h) / −0.271 (15m) against the taker book's +0.415 / +0.534.
**Opened:** CYCLE-000 (identified), CYCLE-001 (registered)
**Last updated:** CYCLE-017
**Owner experiments:** `e25_maker_fill.js`
**Prototypes:** `e25#fillSelection` (a pure, point-in-time passive-fill / selection measurement — the
lab's reusable execution primitive)
**Result artefacts:** `results/e25_maker_fill_1h.json`, `results/e25_maker_fill_15m.json`
**Fold-back rows:** — (a data requirement, not a port)
**Falsifier:** a maker model that (a) never assumes a fill that could not have happened and (b) still
leaves the reversal/short-horizon family below a realistic net — then execution is not the binding
constraint and the lead closes with the cost verdict intact. **MET (CYCLE-017).**
**Residual (data requirement):** the bar model cannot locate fill *quality within* a bar — the
unachievable "fill at the bar extreme" replay is hugely profitable (break-even 67.9 bps at 1h) — so the
question "how near the extreme does a real queue-aware maker land?" needs L2/queue data.

## Claim

The short-horizon reversal family is real and dies on **taker** cost (the project's P3 is PARK for exactly
this reason; the lab's full-history break-even is 0.32–1.31 bps vs a 5–10 bps taker — F-32). A
**queue-position-aware maker-fill model with adverse selection** is a different and possibly winning
arithmetic. This is `TODO.md` 94; the lab's contribution is the measurement.

## Why we care

Cost is J4 and it is the single gate that kills every family. Two lab leads (L13 reversal, L07 cascade
reversion) are short-horizon and their fate is decided here. A realistic fill model also bears on
whether F-01's 1–2 bps break-evens are "dead" or "dead unless maker".

## Evidence (CYCLE-017 / F-34)

A passive quote at the signal bar's close (optionally offset `depth` bps into the market); fill if the
NEXT bar's low (buy) / high (sell) reaches the quote; **no spread credited**; unfilled orders cancelled.
`taker` is a validation guard and reproduces E24's `rank_w1_rev` to 0.0004 Sharpe (0.4147 vs 0.4143).

| book | 1h gross Sharpe | 1h break-even | 15m gross Sharpe | 15m break-even |
| --- | ---: | ---: | ---: | ---: |
| `taker` | +0.415 | **+0.709 bps** | +0.534 | **+0.324 bps** |
| `maker_d0` | **−0.002** | **−0.003 bps** | **−0.271** | **−0.173 bps** |
| `maker_d5bp` | −0.354 | −0.778 | −0.769 | −0.847 |
| `maker_d20bp` | +0.004 | +0.013 | −0.071 | −0.194 |
| `oracle` (fill at the bar extreme — unachievable) | +16.87 | +67.9 | +18.85 | +26.6 |

The friction is measured per fill and is **fill selection**: quoting deeper selects correspondingly
worse fills, so `net vs taking` stays **−0.6…−1.6 bps at every depth 0–20 bps** (1h and 15m). A
**seeded-random side** reproduces it (−0.65 bps at 1h, depth 0), so it is a pure execution cost, not
signal decay. It is ~1–2× the entire reversal edge (0.3–0.7 bps). Classic OHLCV spread estimators are
unusable: Corwin-Schultz 33.4 bps / Roll 23.3 bps at 1h against a real spread of ~1 bp.

## Verdict

**NEGATIVE — closed.** Under the only bar-level fill rule that never assumes an impossible fill, the
maker model removes the reversal edge *before any fee*: the passive route is not a rescue. Execution is
therefore **not** the binding constraint that could revive the family — the cost verdict of F-32 stands
under the maker model too. The residual fill-*quality* question (how near the bar extreme a real maker
fills) cannot be answered from OHLCV and is recorded as a data requirement (L2/queue), not as an open
lead; the `oracle` row shows that if such data ever shows near-extreme fills the answer would flip, but
no bar-level rule does.

## Next actions

1. ~~Build a conservative fill rule from OHLC.~~ **DONE (CYCLE-017).**
2. ~~Re-score the reversal family under it.~~ **DONE.** Maker book gross ≤ 0 at both timeframes.
3. **Data requirement (not a lab action):** the residual question needs L2 order-book / queue data.
4. **Reusable primitive:** `e25#fillSelection` prices the execution friction of *any* signal at ~1 bps
   per fill; apply it to the toptrader fade (L18) if a maker construction is ever considered there.

## Log

* **CYCLE-000** — identified as E-E / TODO 94.
* **CYCLE-001** — registered as a lead with a falsifier.
* **CYCLE-016** — scope narrowed by L13's closure (F-32): reversal's best break-even is 1.02 bps
  per-stream / 0.50 bps as a book and does not improve under smoothing, so this lead's whole bar is now
  "can a maker model find < 0.3 bps net?".
* **CYCLE-017** — **closed NEGATIVE.** Built `e25_maker_fill.js`: the conservative maker model has zero
  or negative gross edge; the per-fill friction (−0.6…−1.6 bps) is ~1–2× the edge and is reproduced by a
  seeded-random side, so it is execution and not signal. A validation guard caught a draft bug (the book
  loop used `close.length` = symbols instead of the bar count). F-34.
