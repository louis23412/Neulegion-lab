# L13 — Short-horizon reversal: the gross edge and its break-even

**Status:** **NEGATIVE — closed (CYCLE-016, F-32).** The gross edge is real; the break-even is 0.3–1.3 bps
at both 1h and 15m, so it is dead under any realistic fill model — including a 4 bps VIP-maker fee.
**Opened:** CYCLE-001 (new lead)
**Last updated:** CYCLE-016
**Owner experiments:** `e2_arm_sweep.js` (the per-stream `reversal-1` arm, both timeframes — since
CYCLE-001), `e24_reversal.js` (the full study: the P3 arms at 1h/15m, the cross-sectional book, the
mechanism, the sign-vs-magnitude decomposition, and the smoothing sweep)
**Prototypes:** —
**Result artefacts:** `results/e24_reversal_1h.json`, `results/e24_reversal_15m.json` (plus
`results/e2_arm_sweep_{1h,15m}.json` for the pre-existing arm)
**Fold-back rows:** — (its verdict is the input to **L08**)
**Falsifier:** a full-history gross break-even **below 1 bps**, or a gross Sharpe indistinguishable from
the oracle-free nulls. **MET on the first clause; the second clause is *not* met** — the edge is real
gross (placebo z 5.5 / 12.1, both halves positive) but untradeable. See Verdict.

## Claim

The project's reversal family (P3) is **PARK** on taker cost: the lab's long-sample readouts put every
family's break-even at 0.5–2.6 bps against the 5–10 bps taker the project assumes. "Gross edge" and "net
edge" are different objects, so this lead measures the reversal **gross** Sharpe and its **break-even**
on the full history, at 1h and 15m, with block stability — so that (a) if it is dead gross, P3's PARK is
confirmed on 6 years rather than 25 days, and (b) if it is alive gross, L08's maker model decides.

## Why we care

It is the one family in the repo whose fate is an *execution* question rather than a *signal* question —
the place where L08 (maker fills) could change a decision. It also cross-checks `RUN-ANALYSIS.md` §7's
"cost kills everything" on the long sample.

## Evidence

**(0) Mechanism — model-free.** Cross-sectional IC of the past 1-bar return against the forward 1-bar
return: **−0.049 (1h) / −0.046 (15m)**; it decays to ~0 by 16–32 bars (w1, 1h, h = 1…64: −0.049, −0.042,
−0.030, −0.020, −0.009, −0.003, −0.002). Time-series lag-1 autocorrelation −0.0133 / −0.0138, negative in
7/8 symbols; VR(2/4/8/16) 0.93–0.99. So mean reversion is real, small, and short-lived, and its
**cross-sectional** part is ~3.5× its time-series part.

**(A) The repo's P3 arms, full history** (mean Sharpe / break-even bps / positive streams / block
stability):

| arm | 1h | 1h BE | 1h pos/stab | 15m | 15m BE | 15m pos/stab |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `rev-1` `-r[t]` | +0.057 | **0.47** | 7/8, 0.50 | +0.113 | **0.34** | 8/8, 0.63 |
| `rev-2` | +0.123 | 1.31 | 7/8, 0.63 | +0.137 | 0.58 | 8/8, **1.00** |
| `rev-4` | +0.069 | 1.02 | 7/8, 0.63 | +0.098 | 0.56 | 8/8, 0.88 |
| `rev-8` | −0.015 | −0.12 | 3/8, 0.50 | +0.080 | 0.61 | 7/8, 0.63 |
| `rev-vol16` | +0.045 | 0.38 | 5/8, 0.50 | +0.112 | 0.32 | 8/8, 0.63 |
| `rev-sign1` `-sign(r[t])` | +0.096 | 0.60 | 6/8, 0.75 | +0.143 | 0.35 | 8/8, 0.75 |
| `rev-xs` (1-bar xs) | **+0.162** | 1.02 | **8/8, 1.00** | +0.105 | 0.34 | 6/8, **1.00** |

At 15m the family is uniformly positive across windows 1–8 and both constructions (7–8/8 streams
positive). `rev-xs` is the most stable arm in the lab (8/8 streams and 8/8 blocks at 1h). `e24#rev-1`
reproduces `e2`'s stored `reversal-1` to 4 decimals.

**(B) The new shape — a dollar-neutral cross-sectional reversal book** (`w_j = −(pastReturn_j − mean)/Σ|·|`):

| book | tf | gross Sharpe (252 basis) | turnover /yr | break-even | net@4 | halves | mkt corr |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `rank_w1_rev` | 1h | **0.414** | 11 653× | **0.71 bps** | −1.92 | +0.52/+0.27 | −0.01 |
| `rank_w2_rev` | 15m | **0.583** | 33 510× | **0.50 bps** | −4.05 | +0.50/+0.72 | +0.07 |
| `rank_w1_rev` | 15m | 0.534 | 46 591× | 0.32 bps | −6.03 | +0.39/+0.75 | +0.08 |

Causal (next Sharpe 0.41/0.58 vs contemporaneous −16.98/−13.83, ratio 0.02–0.04); not a null (40-seed
cross-sectional shuffle placebo **z = 5.5 / 12.1**); positive in both halves; market-neutral
(|corr| ≤ 0.08); the mirror momentum book is the exact negation. Sharpe is quoted on the ledger's 252
baseline; on the true calendar basis multiply by 5.90 (1h) / 11.79 (15m) — the honest tradability metric
is the break-even, not the annualised Sharpe.

**(C) Smoothing does not rescue it** (F-24's lever, applied to `rank_w2_rev` 15m):

| policy | gross Sharpe | turnover /yr | break-even |
| --- | ---: | ---: | ---: |
| daily | 0.583 | 33 510× | 0.50 bps |
| EWMA 0.5 | 0.512 | 27 471× | 0.55 bps |
| EWMA 0.25 | 0.386 | 20 810× | 0.56 bps |
| EWMA 0.1 | 0.243 | 13 794× | 0.54 bps |
| EWMA 0.05 | 0.142 | 9 971× | 0.43 bps |

The Sharpe decays roughly in step with the turnover, so the break-even is flat at ~0.4–0.6 bps. Reversal
is the F-25 animal (fast signals do not smooth), not the F-24 one.

## Verdict

**NEGATIVE — closed.** The L13 falsifier ("a full-history gross break-even below 1 bps") is **met**: every
arm and book reads 0.32–1.31 bps, an order of magnitude below any realistic fee. P3's PARK is therefore
confirmed on the full 6.0-year (1h) / 2.3-year (15m) history, and on a shape (the cross-sectional book)
the repo never tested, not just on the per-stream arm. The second falsifier clause is *not* met — the
gross edge genuinely exists (unlike F-07's cross-sectional momentum) — so the honest statement is
**"reversal is real and fast, not absent"**: real gross edge, 0.3–1.3 bps of it, and no construction
tested here can widen the break-even. The lead closes because the *trade* is dead, not because the
*signal* is.

## Next actions

1. None in this family. Its closure is an **input to L08**: the only thing that could revive reversal is a
   maker model delivering a net execution cost **below ~0.3 bps**, which is the entire bar for L08.
2. Do not re-derive: (i) the per-stream P3 arms (this file, table A), (ii) the cross-sectional reversal
   book at 1h/15m (table B), (iii) EWMA smoothing of reversal weights (table C). All measured.

## Log

* **CYCLE-001** — opened as a new lead.
* **CYCLE-016** — **closed NEGATIVE**. Built `e24_reversal.js` (mechanism, the P3 arms at 1h/15m, the
  new dollar-neutral book, the smoothing sweep, controls and a shuffle placebo). Found the lead had been
  **stale** since CYCLE-001 — `e2` already scored `reversal-1` at both timeframes. F-32 (reversal is real
  gross, dead net, unsmoothable) and F-33 (the repo's "edge lives in signs" claim is contradicted).
