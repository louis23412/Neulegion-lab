# NeuLegion research lab (`src/NeuLegion-lab/`)

**What this is.** An *out-of-tree* research sandbox for `src/NeuLegion-master/NeuLegion-master`
(the shipped NeuLegion project). It exists to hunt for ideas with a real chance of giving the
project an edge, and to measure them on the project's own data with the project's own statistics.

**The lab is a library of leads.** Every line of research is a *lead* with its own file under
`leads/`, its own status, the experiment that measures it, the prototypes it owns, the result
artefacts it produced, and the measurement that would kill it. Work happens in numbered *cycles*
(`cycles/`), each a closed unit of hypothesis → experiment → result → ledger update, so a future
reader can see exactly what was tried, in what order, with what outcome — and continue from any
point. Start at `leads/INDEX.md`.

**Ground rules.**

1. **The lab never edits the repo.** It only *reads* repo modules (via relative imports) and repo
   data files. Nothing here is on the shipped path; nothing here can move a golden fingerprint or a
   test count. A good idea graduates to the repo by an explicit, pre-registered port (see
   `FOLD-BACK.md`), not by editing the repo from here.
2. **Every claim is measured.** Each finding cites a runnable experiment under `experiments/` and a
   result artefact under `results/`. Numbers are the repo's own (`analysis/*`), not a
   re-implementation.
3. **Separate budget.** No repo file lists, imports or references the lab. `npm test` ignores it
   (`test/node/*.test.js` glob); the browser entries never import it.
4. **Critical data and tests live in the lab, not in scratch.** `scratch/` is wiped between
   sessions; anything a future iteration needs (experiment code, result artefacts, fetched data
   samples) goes under `src/NeuLegion-lab/`.

**Why it lives under `src/`.** Perchance's generator tree persists `src/` across sessions; anything
outside `src/`, `main.pjs` and `index.html` is ephemeral. Keeping the lab here means the findings
survive a lost chat (which is the point of a research record). It is a *sibling* of the repo
(`src/NeuLegion-lab/` next to `src/NeuLegion-master/`), so it is clearly not part of the project.

## Layout

```
README.md            this file
RUNNER.md            how to run an experiment (exact snippets) and read its output
run_lab.mjs          the LOCAL Node runner: `node src/NeuLegion-lab/run_lab.mjs <experiment.js>`
PROTOCOL.md          the research method: cycles, lead template, statuses, evidence rules
INDEX.md             the top-level map: docs, leads, experiments, results, cycles
THEORY.md            the system model, the ranked frontier, the edge-hunt map
FINDINGS.md          the measured ledger: F-<n> hypothesis -> experiment -> number -> verdict
FOLD-BACK.md         the pre-registered port contract + the port queue (R1..R8)
leads/               ONE FILE PER LEAD: status, evidence, prototype, falsifier, next action
  INDEX.md           the lead board (id, title, status, owner experiment, result, fold-back row)
lib/lab.js           the measurement harness (loads candles, builds panels, scores with repo metrics)
prototypes/          candidate signals / portfolio constructions the repo does NOT have
experiments/         one runnable file per experiment, each exporting `run()` -> small JSON
results/             measured outputs (written by the experiments)
cycles/              one file per research cycle: what was tried, changed, concluded, and next
data/                durable samples of fetched/derived data that must survive scratch being wiped
```

## Current status (short)

* **19 leads** on the board: 1 critical-methodological (L01), 8 supported (L02, L03, L09, L12, L15, L16,
  L17, L18), **7 closed negatives (L04, L05, L06, L08, L11, L13, L14)**, and — re-opened in CYCLE-028 and
  strengthened in CYCLE-029 — **one live open lead (L19, the OI-change cross-sectional signal: weak and
  churny, but the pre-registered pre-2024 holdout does **not** kill it — the unfitted cross-scale blend is
  positive every year 2022–26 — and it does **not add** to R8 and cannot be sized jointly, so it is a
  standalone small sleeve; F-45/F-46/F-47)**, plus
  L07 — partially closed (its OI *signal* half is corrected by F-45 into L19; OI is positive as a sizing
  tool but CYCLE-024/025 restated the bound as a *schedule* — F-41/F-42; the toptrader ratio spun out to
  L18; the liquidation half is **data-blocked**, not testable) — and the standing audit L10. See
  `leads/INDEX.md`.
* **81 findings** in `FINDINGS.md` (F-01…F-81), all reproducible via `RUNNER.md`.
* **The 2026-09-26/27 local run corpus was cross-checked (CYCLE-065; read-only, no experiment).** The operator's seven `npm run analyze` runs (`src/runs/`) reproduce the project's K=3/K=6 momentum verdicts, confirm F-01/F-03/F-32/F-69/F-71/F-74/F-77 in production, and expose one new gate coupling (the funding sleeve enters the paired promotion test — proposed `L10-cs`). See `RUN-CROSSCHECK.md`.
* **Nothing has been folded back into the repo.** `FOLD-BACK.md` holds the port queue: R1–R3 are
  measurement fixes that need no promotion; R4–R8 are sleeves/features gated on the repo's own gate.
* **The headline result stands: the reported edge is a 25-day window artefact (F-01).**
* **Second headline (CYCLE-006): the carry complex is real but was being measured wrongly.** Every
  basis-marked carry number had been read off a 2.9-year crash-free window, and the extended history
  plus four fixed alignment bugs moved the honest delta-neutral book from Sharpe 0.96 to **4.54**
  (F-18/F-19). The dollar-neutral dispersion book (L12) is now the lab's strongest sleeve: Sharpe
  5.03 at a **2.93 %** drawdown, positive in 5/5 years and 9/9 regimes, uncorrelated with price.
* **Third headline (CYCLE-007): the carry complex survives its own measurement falsifier.** Every carry
  number had marked the perp leg at Binance's *smoothed mark price*; re-running the flat, dispersion and
  reversion books against the **traded** 8h perp close (`data/perp_8h.json`, `e15_traded_basis.js`) moves
  nothing — flat 4.54 → 4.65, dispersion 5.03 → 4.98, reversion 9.15 → 9.17 (F-22). L14 closed negative.
* **Fourth headline (CYCLE-008): the lab's best-looking sleeves are cost-fragile.** Every headline
  number is *gross*. Measuring each book's own turnover (`e16_cost_capacity.js`) shows the flat carry
  book is essentially free to trade (0.2×/yr turnover, break-even 5422 bps) while the dispersion and
  reversion "improvements" reshuffle 803× / 465× gross notional per year and **break even at only
  1.9–3.5 bps** — below a base-tier taker fee (F-23).
* **Fifth headline (CYCLE-009): the dispersion sleeve is rescued by smoothing its weights.** The F-23
  turnover was an implementation artefact, not the signal. **EWMA-smoothed, renormalised rank weights**
  (`w_t = 0.9 w_{t−1} + 0.1 w*_t`) cut turnover 803× → **85×/yr**, *keep* the gross Sharpe (5.03 →
  **5.18**) and lift the break-even to **12.78 bps** — net Sharpe **+3.55** at a 4 bps fee, positive in
  every crash window and 7/9 regimes (F-24). So the flat carry book (R4) and the smoothed dispersion
  book (R8) are both tradable; **capacity/impact (L15)** is the binding limit left. Caveat: the
  dispersion edge has decayed since 2024.
* **Sixth headline (CYCLE-010): basis timing is a risk tool, not an alpha.** The same smoothing test was
  applied to the reversion book (F-25). Its *pure convergence* leg is unrescuable — smoothing cuts
  turnover but destroys the edge (gross Sharpe 9.15 → 2.66), so the signal is genuinely fast. Its
  *z-timed carry* leg *is* rescuable and gives net Sharpe +4.05 at 4 bps with a **2.09 %** drawdown (vs
  flat carry's 7.96 % at equal exposure) — but that Sharpe is below the cost-free flat hold's 4.54, so
  the overlay buys drawdown, not return. Also explains F-10's implausible 9.54 gross Sharpe as churn.
* **Seventh headline (CYCLE-011): impact, not the fee, is what binds.** The fee question was answered in
  CYCLE-008/009, so this cycle measured the other cost term and the size a book can carry. Harvesting the
  perp 8h **quote volume** (`data/perp_flow_8h.json`) and applying a square-root impact law
  (`e19_capacity_impact.js`), the F-24 dispersion book has a **capacity of ~$13 M** (Y=1, 4 bps fee;
  $53 M at Y=0.5), the timed-carry overlay ~$95 M, and the **flat carry hold is not impact-limited** (it
  barely trades). The binding symbol is DOGE, at ~1 % of ADV, because the top/bottom funding rank
  concentrates weight there. So the complex splits by size: the *flat* hold scales, while the
  Sharpe-improving *improvements* are capacity-bound to tens of millions (F-26; L15 closed, L17 opened).
* **Eighth headline (CYCLE-012): a per-symbol position cap roughly doubles the dispersion capacity.** The
  one lever F-26 left untested was a position limit, and it works (`e20_capacity_aware.js`, F-27). A
  **strict** per-symbol gross cap at ~1/k (12.5 %) — clip and *hold*, do not renormalise — lifts the
  dispersion capacity **$13.2 M → $26.7 M** (Y=1, 4 bps; ~$107 M at Y=0.5) while cutting turnover 85×→35×,
  drawdown 0.94 %→0.47 % and the design effect 7.9→2.2, and it turns 7/9 net-of-fee regimes positive into
  8/9 (cap 0.12: 9/9). A *soft* cap (clip then renormalise) buys nothing, caps below ~0.12 are degenerate,
  and ADV-tilting / dropping thin symbols destroys the edge. R8's port spec now includes the 12.5 % cap;
  the sleeve stays small but is cheaper and safer.
* **Ninth headline (CYCLE-013): positioning — one field has no signal, another does (cross-sectionally).**
  Binance's free `futures/um` metrics give open interest and the top-trader long/short ratio. Their *level*
  screens read ≈0 (OI change: pooled next-8h IC **0.020**), and a contemporaneous mis-alignment would read
  IC 0.60 / Sharpe 17 (an F-11-class trap this cycle hit and fixed). But OI also answers what a *held*
  position can be: the flat carry book's `G/k` per symbol reaches 1 %/5 %/10 % of the thinnest symbol's
  open interest at **$6.9 M / $34.3 M / $68.6 M**, so the flat hold is **OI-limited to tens of millions**,
  not $50 B — the whole carry complex is a **~$5–70 M strategy** (F-28). And, challenging that very
  conclusion, the **toptrader ratio used cross-sectionally is a real (modest) contrarian edge**: a
  dollar-neutral fade book scores gross Sharpe **1.055**, break-even **15.1 bps**, **net@4 +0.77**, positive
  in 4/4 quartiles and 5/6 years (F-29, lead L18) — invisible to a level-IC screen, visible only after
  demeaning (F-03's lesson on new data). The lab's **first new-data signal**. Two silent bugs were fixed
  on the way (a book-index look-ahead, L10-q; missing-data zeroing, L10-r).
* **Tenth headline (CYCLE-014): the toptrader signal is validated — and smoothing makes it cheap.** The
  L18 fade passes all four tests (F-30): a held-out sign test (both halves net-positive; the opposite
  sign loses in both), a cost audit, a confound check, and capacity. **EWMA(0.1)-smoothed weights** cut
  turnover **126× → 23×/yr**, lift the break-even **15 → 74 bps** (EWMA 0.05: 118 bps) and net@4 **+0.79**
  with halves 0.81/0.79 — the F-24 trick, repeated on a non-carry signal. It is *not* the funding rate:
  funding-fade-on-spot has the same gross Sharpe but is unstable (second half negative) at 896×/yr. It is
  a small sleeve — OI-bound to tens of millions (the binding symbol is LINK, again). So the lab now has a
  **second independent, validated cross-sectional stream**, separate from carry.
* **Eleventh headline (CYCLE-015): that stream diversifies the carry book — and fixes its weak half.** The
  toptrader fade is essentially **uncorrelated** with the carry dispersion book (return corr **−0.001**),
  so the max-Sharpe mix is ~98 % carry and full-sample Sharpe is not raised. But the carry book's own
  net@4 **second half is negative (−0.12)** — the F-24 decay — and a **25 %** allocation to the fade turns
  it into **+0.75** (combined net@4 **+1.38**, *both halves positive*). Because ρ ≈ 0, the fade is
  insurance against the carry decay: the first time the lab can point to a portfolio whose worst half is
  positive net of costs (F-31).
* **Twelfth headline (CYCLE-016): reversal is real, and it is still dead.** L13 — the last open mechanism —
  is closed. Short-horizon reversal is a *genuine gross* cross-sectional edge at both 1h and 15m (the
  dollar-neutral book is **z = 5.5 / 12.1** outside a 40-seed shuffle null, positive in both halves, causal;
  the per-stream family is positive in 7–8 of 8 streams at 15m) — unlike cross-sectional momentum (F-07).
  But its **break-even is 0.32–1.31 bps** at every arm and every construction, and, unlike the carry
  dispersion, **smoothing cannot lift it** (EWMA λ=0.5→0.05 leaves the break-even flat at ~0.4–0.6 bps;
  the gross Sharpe decays in step with the turnover) — the F-25 pattern, not F-24. So P3's PARK is
  confirmed on 6 years rather than 25 days (F-32), and the generalisable lesson is **demeaning buys power,
  not tradability**. The cycle also found the P3 doc's "the edge lives in signs rather than magnitudes"
  contradicted (magnitude IC is ~2× sign IC; F-33) and that **L13's status had been stale since
  CYCLE-001** — `e2` already scored the arm at both timeframes (L10-t: audit the board, not just the repo).
* **Thirteenth headline (CYCLE-017): passive execution does not rescue a fast edge — it eats it.** L08 (the
  last open execution question) is closed. A conservative maker-fill replay (`e25_maker_fill.js`: a resting
  quote at the signal close fills only if the next bar *touches* it, unfilled exposure is cancelled) turns
  the CYCLE-016 reversal book's gross Sharpe from **+0.415 (1h) / +0.534 (15m)** under a taker fill into
  **−0.002 / −0.271** — the passive fill *removes the edge before any fee*. The per-fill friction is
  **−0.6…−1.6 bps** at every quote depth 0–20 bps, and is **identical for a seeded-random trade side**, so
  it is pure execution cost (adverse selection on fills), not a signal effect. OHLCV spread estimators are
  unusable here (Corwin–Schultz 33.4/13.3 bps, Roll 23.3/9.2 bps). What remains is a **data requirement**:
  only L2 book / queue position could decide whether a *queue-priority* maker capture is positive, and the
  unachievable `oracle` replay's break-even (67.9 bps at 1h) bounds how much any fill model could help
  (F-34). Along the way a draft bug (`simBook` used `close.length`=8 instead of the bar count) was caught
  (L10-u: validate the primitive's control arm). With L08 closed, **L06 (meta-labelling) was the only
  fully-open lead.**
* **Fourteenth headline (CYCLE-018): re-labelling the learner does not give it a job.** L06 — THEORY's
  E-D, the highest-expected-value direction left — is closed. Asking the inert learned layer the *easier*
  question ("will this rule's trade pay?", the AFML meta-label) instead of "which way is the next bar?"
  does not help: out-of-sample **Brier skill vs the causal base rate is ≤ 0** for all three base rules
  (`sig-momentum`, `sig-acceleration`, `sig-reversal`) at both 1h and 15m (−0.0003…−0.0013), i.e. L06's
  pre-registered falsifier fires. Pooled **AUC ≈ 0.505–0.508** is a *detectable* rank whisper, but a
  capacity probe shows it is positive only at one gradient iteration and grows negative with fitting, and
  the abstention overlay can lift net@4 from negative to ≈+0.02–0.06 **only by keeping 0.3–0.7 % of bars**
  (at 15m the trend rules stay negative). So `NL-BENCH`'s closure extends to the meta target (F-35), and
  **no fully-open lead remains** — the only live questions are the two decay risks on the working sleeves
  (F-24 carry decay 2025–26; L18 post-2024), both since resolved (F-37 recovered the carry margin, F-36/40
  showed the fade alive), and L07's liquidation-print half, which CYCLE-024 **closed as data-blocked**
  (Binance no longer publishes `liquidationSnapshot`; the exchange APIs serve only recent fills).
* **Fifteenth headline (CYCLE-019): the working sleeves have diverged — the carry dispersion book's net edge
  is gone, the toptrader fade is alive, and only the fade keeps a book positive.** The two decay risks were
  measured. The dispersion book's decay is a **cost-margin** decay, not signal death: its *gross* Sharpe
  trend is flat (ρ −0.35, p 0.39) but its **break-even fell from 10–29 bps (2022–23) to 2.9–3.4 bps in the
  last two blocks (2025-07 → 2026-09)** — below a 4 bps fee — as the per-period edge shrank while turnover
  rose 75 → 98×/yr; net@4 went 2024 **+5.41** → 2025 **−0.01** → 2026 **−1.88** (net trend ρ −0.79,
  p 0.023). The **toptrader fade has not decayed** (2025 +1.24, 2026 +1.27, last-12m **+1.91**, trend
  p 0.68), and the F-31 **25 % mix is still net-positive** recently (+1.76) *because the fade carries it* —
  so F-31's hedge now holds out of sample in time, and the fade (or the mix) is the lab's only live sleeve.
  The F-24/F-26/F-27 break-even and capacity economics are full-sample and now stale for the recent regime
  (F-36).
* **Sixteenth headline (CYCLE-020): the carry dispersion book is recoverable — the decay was the *policy*,
  and the re-tune is a rule.** F-36 left the re-tune as L16's live question. Finding one is easy
  (`e28_regime_retune.js`, F-37): auditing 16 policies against the **recent 24 months**, **7 clear a 4 bps
  fee**, the recent break-even is **monotone in policy slowness** (the direct F-36 mechanism), and the
  leader `ewma_0.01_norm` reads recent-24m break-even **27.07 bps**, net@4 **+3.86** at just 9×/yr
  turnover, and is net-positive in **9/9** regimes. The hard part is *believing* it — that winner was
  selected on the very window it fixes. So `e29_regime_retune_oos.js` walks forward, choosing λ each block
  from *trailing* net@4 only and trading it: the resulting series — which the selector never saw — nets
  **+5.71 OOS** against the pinned F-24 spec's **+2.76** (recent-24m **+3.41** vs **−0.53**), on **12/12**
  (lookback, block) parameterisations. The decisive control: a selector that optimises **gross** Sharpe
  nets only **+0.28** (it picks λ=0.3 and dies on the churn) — so the re-tune is **cost-awareness**, not
  smoothing, and it is a **rule, not a hindsight pick**. R8 is un-gated again with an amended spec (a
  cost-aware, walk-forward λ ≈ 0.01–0.02); capacity at the new turnover is the open follow-up.
* **Seventeenth headline (CYCLE-021): the retune improves size too, and the binding limit switches from
  impact to open interest.** F-37's faster-and-slower trade-off had a testable shape: a slower book trades
  less per period (square-root **impact** should fall, F-26) but holds a more persistent position (**open
  interest** should bind, F-28). `e30_retuned_capacity.js` (validated against `e19`'s stored λ=0.1 capacity
  to the last digit) measures both. The λ=0.1 spec is impact-bound at **$13.2 M** (DOGE ~1 % of ADV); every
  slower book has a *diverging* impact capacity (a near-hold never trades — λ=0.005 reads **$4.0 B**,
  fictional) and is instead **OI-bound (LINK)**: **$19.2 M** at λ=0.01 and **$35.9 M** at
  `ewma_0.02 + cap12.5 %` (recent net@4 **+4.24**, break-even 15.97 bps). So the F-27 cap compounds with
  the slower λ — usable size is **~173 % higher** than the old spec *and* the recent fee margin is ~4× the
  fee. The R8 port spec becomes **`ewma 0.02 + 12.5 % cap`, ~$36 M (OI-bound)**; the generalisable lesson is
  that a hold-like book's square-root capacity is meaningless, so the OI position limit is its honest size
  (F-38).
* **Eighteenth headline (CYCLE-022): R8 is port-ready — a joint walk-forward spec that survives a 10 bps
  fee.** F-38's combined spec was frontier-picked, so F-39 tests it the way the lab demands.
  `e31_ported_spec_oos.js` walks forward over the whole **10 λ × 4 cap = 40-book** surface — every 12
  months it picks the (λ, cap) with the best *trailing* net@4 Sharpe and trades it, never seeing the block.
  That never-seen OOS series nets **+6.13** against the pinned F-24 spec's **+2.76** (recent-24m **+4.49**
  vs −0.53), and fee-stressed on the same series it stays net-positive at a **10 bps** fee (net@4 **+4.43**,
  recent-24m +3.12) — ~6× headroom above a taker fee. The cap is not a cost crutch: `λ=0.1 + cap12.5 %` is
  still broken out of sample (+1.93), so the *slower λ* repairs the margin. The final R8 spec is a
  walk-forward, cost-aware λ (recent ≈ 0.02) plus the strict 12.5 % cap, ~$36 M, ~25 bps break-even — the
  carry-dispersion line is now closed end-to-end: signal → cost → capacity → OOS rule → fee robustness
  (F-39). *(CYCLE-031/032/033 (F-48/F-49/F-50) later removed the need for the **rule**: the pinned
  `ewma 0.02 + cap12.5 %` book matches or beats every walk-forward variant out of sample.)*
* **Nineteenth headline (CYCLE-023): the slowness fix is *not* general — but the cap is.** The lab's other
  working sleeve is the L18 toptrader fade, so the obvious test is whether F-37's methods transfer.
  `e32_fade_retune.js` (reusing the now-exported `e22#buildMasked`; `e22`'s artefact verified
  byte-identical) says **no on the retune, yes on the cap**. The fade is **not cost-fragile at any λ** —
  its recent-24m break-even is **55 bps** even at EWMA(0.1) (and ≥19 bps at λ=0.5), versus the dispersion
  book's pre-retune 3.7 bps — so there is nothing for slowness to fix; and the walk-forward *selection rule*
  is actually **worse** than pinning (+0.70 vs +0.94 OOS) because the fade's Sharpe (~0.8) makes a trailing
  window noise-dominated. What *does* transfer is the F-27/F-38 **12.5 % cap**: the fade's OI bound rises
  **$37 M → $54 M** (5 % of mean OI), full net@4 **+0.79 → +1.00**, break-even **74 → 109 bps**, turnover
  23 → 13×/yr. So the theory is sharper: slowness buys nothing where the break-even already clears the fee,
  and a walk-forward parameter rule needs a signal strong enough to score on a trailing window (F-40). R7's
  fade spec is finalised as a pinned EWMA(0.1) + cap.
* **Twentieth headline (CYCLE-024): the capacity numbers were a statistic too optimistic — ratios of means,
  not the min of the ratios.** Every OI capacity in F-28/F-38/F-40 was `f·mean(OI)/mean|w|`: an
  *average-case* bound. `e33_oi_capacity_distribution.js` measures the constraint the desk actually faces —
  `f·min_t(OI_j(t)/|w_j(t)|)` — and it is **2.6–8.8×** smaller: the dispersion spec's $23.41 M is really
  **$4.37 M**, the fade's $36.99 M is **$4.19 M**, the capped fade's $53.84 M is **$12.62 M** (binding
  symbol LINK). At the published sizes the books breach the 5 %-of-OI cap in **65–77 %** of periods and peak
  at **16–44 % of LINK's open interest**, and the binding moments are the dislocations (2022-05 LUNA,
  2023-06/07) *and the current year* (2026-03/07). Restated, the port sizes (recent-24 m p5) are
  **$10.2–21.9 M** per sleeve; the F-27/F-40 12.5 % cap is the fix (it triples the fade's never-breach
  bound). The same cycle **closes L07**: Binance no longer publishes `liquidationSnapshot` and the exchange
  APIs serve only recent fills, so the liquidation-print test is *data-blocked*, not merely undone (F-41).
* **Twenty-first headline (CYCLE-025): the OI capacity is a *schedule*, not a number.** F-41 restated the
  bound as a distribution, which raises the obvious question: can a book simply *float* to the bound? The
  answer is a qualified yes — but not by naïvely following it. `e34_oi_scaled_sizing.js` (with `e33`'s
  min-of-ratio now requiring **every traded symbol** to have an OI print — a partial-set min had printed a
  bogus **$936 B** at 2021-11-04; new bug register entry L10-x) measures seven causal sizing policies.
  Three results (F-42). **(i) A *constant* size picked from the past does not comply:** the trailing-p5 size
  still breaches the 5 %-OI cap in **2.7–3.7 %** of periods (peak 6–10 %), so the certified-safe constant
  is the *running minimum* (~20 % smaller). **(ii) A *lagged* size is worse than useless:** an EWMA(0.1)
  target breaches **53–55 %** of periods, because a lagged size sits above a falling bound — the OI limit
  must be a **hard clip**, never a smoothed target. **(iii) The working recipe is a clipped trailing-median:**
  target the trailing-median size and clip at `G_t^cap`; it deploys a mean **$16.94 M** (R8 spec) / **$19.34 M**
  (R7 fade) — **1.5–1.8×** the constant-p5 size — at **zero breach** (clip binds ~44 % of periods), Sharpe
  **4.41 / 0.96**, and *more* absolute dollars ($469 k vs $378 k per year on R8). Floating *all the way* to
  the bound (`scaled_full`) buys **2.0–4.1×** mean size but lowers the dollar Sharpe (R8 5.02→3.26; fade
  1.21→0.77) and deepens the fade drawdown (22.8 %→58.2 %) — it is a capacity device, not alpha — and a
  seeded **placebo** (the size shuffled in time) blows turnover from 14–23×/yr to **564–870×/yr** and drives
  Sharpe to **−0.7…−18.5**, so the schedule's value is *compliance at low resize churn*, not timing.
* **Twenty-second headline (CYCLE-026): the sleeve mix is stale, and capacity does not add across sleeves.**
  F-31's 25 % fade allocation was *insurance* against the carry book's decayed second half (−0.12 net@4 at
  the F-24 spec). But F-37 **re-tuned** the carry book, and at the final port specs its second half is
  **+4.66** — so there is nothing left to hedge, and the fade (net@4 **1.00**, break-even 109 bps) simply
  dilutes the carry book (net@4 **6.49**): the 25 % mix nets **1.62**, and a walk-forward allocation rule
  picks the fade at **0 % in 11/11 blocks** (6.59 OOS vs 1.67). The correlation is still ≈0 (ρ = 0.010), so
  F-31's *mechanism* was right — its *premise* was removed by the re-tune. Separately, and more generally,
  **an OI capacity is a portfolio constraint, not a per-sleeve one** (F-43): both books bind on the same
  thin alts (LINK, ADA, DOGE), their individual OI schedules are $23.72 M (carry) + $31.85 M (fade) but the
  **joint** schedule at the mix is **$31.32 M — 56 % of the sum** — and if each sleeve is run at its own
  individually-compliant size the combined book breaches the 5 %-of-OI cap in **78.4 %** of periods, peaking
  at **10.0 % (twice the cap)**. Because the constraint is on the summed *positions* (the books' LINK
  weights correlate only −0.20), **a min-of-ratios capacity is not diversifiable** by return correlation.
* **Twenty-third headline (CYCLE-027): the constraint is cheap — it is a *stable allocation* that is
  impossible.** F-43's "the joint size is 56 % of the sum" was a statement about a **fixed** split, so
  CYCLE-027 computed the exact object: the per-period 2-D linear program `max Σ_s g_s G_s` s.t.
  `|Σ_s G_s w^s_j| ≤ 5 %·OI_j`. Its total gross is **mean $62.72 M (1.13× the $55.64 M sum), median
  $37.11 M (0.88×), p99 $624 M, 2.00× the fixed 25 % mix** — the two books' positions **net** in some thin
  symbols, so the frontier is ≈ the sum, not 56 % of it. But the free-split optimum is not a portfolio:
  the optimal fade share is **0 in some periods and 1 in others** (p5 0 / p95 1) and the binding symbol
  rotates (ADA 2 448, LINK 1 713, DOGE 606), and deploying the LP-optimal size — re-optimised every period,
  paying the fee on the actual dollars traded — churns **48.5× gross/yr** and nets **net@4 0.62** against
  the carry book's **6.49**. So F-44 refines F-43: the per-symbol cap is not the costly part; the costly
  part is that the two sleeves do not form a stable portfolio, and the frontier is a **capability**, not a
  size. The deployable portfolio size remains F-43's fixed-split joint bound (and, if a joint schedule is
  wanted, a two-dimensional version of F-42's clip).
* **Twenty-fourth headline (CYCLE-028): a settled claim was re-opened and corrected — F-28 was the F-23
  mistake again.** The lab had carried "open interest has no directional signal; do not port it" (F-28)
  since CYCLE-013. But that verdict was read off the **daily** Δlog(OI) book (gross Sharpe 0.96) whose
  turnover is **1501×/yr**, so its break-even is **1.89 bps** and net@4 is **−1.07** — which is *exactly*
  the F-23 pattern that F-24 corrected for the funding book (daily 803×/yr, 1.87 bps → smoothed 85×/yr,
  12.78 bps). Applying the same F-24/F-37 treatment (`e37`, reusing the extracted `e21#xsBookImpl`), the
  OI-change book's break-even rises to a peak **14.73 bps** and **3 of 6** EWMA policies clear a 4 bps fee
  (λ=0.25: break-even **8.93 bps**, net@4 **+0.65**; λ=0.1: **14.73 bps**, +0.52). It is independent of
  the carry book (return corr **0.007**) and the sign control loses in both halves (net@4 **−3.00**). So
  **F-28's "no signal" is corrected to "weak signal"** — but the new answer is bounded immediately: at the
  best policy the book still turns over **338×/yr** (15× the fade), its **net halves are 0.07 / 1.47**, its
  net@4 by year is 2023 **−0.86** vs 2024–26 **+1.56/+0.96/+2.30**, and the F-37 walk-forward λ rule
  **underperforms pinning** (+0.44 vs +0.76/+0.99). Not a port candidate; opened as the lab's **first
  re-opened signal lead (L19)**, and the board's only live open question again.
* **Twenty-fifth headline (CYCLE-029): the re-opened signal survives its own holdout — but the *parameter*
  did not.** CYCLE-028 had labelled the OI-change signal "recent-regime", leaving L19 one live falsifier: a
  pre-2024 read with the sign fixed. CYCLE-029 (`e38`) ran it with the sign (+1) and the λ window
  ({0.1, 0.25}) fixed **a priori** — the *signal* survives (λ=0.1 clears a fee pre-2024, net@4 **+0.47**,
  break-even 15.23 bps, and a fixed **unfitted** 50/50 blend of the two λ is net-positive in **every**
  calendar year 2022–26), but the λ=0.25 policy CYCLE-028 called *best* does **not** (pre-2024 **−0.12** vs
  post-2024 **+1.45**) — so what was regime-specific was the single parameter, not the phenomenon. The two λ
  are anti-phase year-to-year, and their blend (**+0.33 pre / +1.24 post**, break-even **11.33 bps**,
  254×/yr, full net@4 **+0.77**) beats both single λ. There is **no decay** (the net block trend is
  *positive*, rho +0.67, p 0.053), the **rank** construction does **not** help, and the stream is independent
  of the L18 fade (corr **−0.045**). The book stays weak, churny and thin-alt-bound (individual OI bound
  mean **$23–28 M**, p5 **$6–8 M**, DOGE/LINK/ADA) → L19 remains **OPEN** and **not port-ready**, and a
  joint capacity read with R8 is the next gate.
* **Twenty-sixth headline (CYCLE-030): the L19 OI stream does not add to R8 — and the lab's mix convention
  was measuring volatility, not diversification.** CYCLE-029 closed L19's signal question; the last one was
  whether the OI stream is a *portfolio member* with the port-ready R8 carry book. `e39` answers both halves.
  On returns: independent (corr with the carry book **+0.01**, the fade **0.00**) but **too weak** — the
  capital-fraction carry+OI ladder is monotone down (carry net@4 **6.48** → 2.82 at 5 % OI; a walk-forward
  picks **OI 0 % in 11/11**) and, risk-normalised, the max-Sharpe OI weight is only **0.10** for **+0.04**
  Sharpe. On capacity: the exact **3-sleeve joint OI LP** reads mean **$142.2 M = 1.76× the sum** of the three
  individual bounds ($80.9 M) with optimal **OI share 0.374** — the three books *net* across symbols, so the
  OI stream is **not crowded out** — but the LP-optimal schedule churns **129.6× gross/yr** for net@4 **0.82**,
  so it is uninvestable and the deployable size still needs a clipped schedule (the F-44 lesson). The cycle's
  second result is a **measurement-basis bug (L10-y)**: the carry book's net4 vol is **0.4 %/yr** per unit
  gross while the spot-based fade and OI books are **13.6 %** and **24.3 %** (31–55×), so every
  *capital-fraction* mix the lab has quoted (F-31, F-43) is dominated by the vol ratio — F-43's **direction**
  ("mixing adds ~nothing") stands, but its headline **magnitude** ("the fade dilutes carry 6.49→1.62") does
  not.
* **Twenty-seventh headline (CYCLE-031): R8's λ *rule* is not needed — a fixed two-scale blend matches it
  out of sample, at half the turnover.** F-37/F-39 gave the port-ready carry sleeve a **walk-forward,
  cost-aware λ selection**. CYCLE-031 (`e40`) asks whether that fitted rule earns its keep: it builds the R8
  spec family for the pre-registered λ grid, forms **fixed equal-capital blends** over five sub-sets, and
  scores them against the λ-only walk-forward (lookback 1095, block 365) on one shared OOS span. The best
  blend — **λ = 0.01 + 0.02, unfitted** — reads **OOS net@4 6.66 vs the walk-forward's 6.63** (within the
  0.2-Sharpe falsifier, indeed above it) with **half the turnover** (7 vs 14×/yr) and **1.8×** the
  break-even (46.1 vs 25.5 bps), and **every** pre-registered blend is recent-positive. So a fixed
  two-scale blend — **no rule, no lookback, no block** — matches R8's λ walk-forward out of sample, and the
  rule's F-37/F-39 advantage was over the *broken* λ=0.1 spec, i.e. it bought **slowness**, not a selection
  rule. Two controls pin it down: the only set that includes the broken fast λ (`all5`) is the *worst*
  blend (4.36), so nothing here rewards blind mixing; and the pinned λ=0.02 book reads **6.86** — *higher*
  than both — but λ=0.02 was chosen on the **full history**, so its edge is in-sample and the rule's value
  over it is **−0.23**. The open question the cycle registers: whether a **single λ frozen before the OOS
  span** would have done as well (the honest analogue of "pinned 0.02"). *(Scoped by CYCLE-032/F-49 below:
  the blend headline is menu-dependent; the frozen-λ form is what survives.)*
* **Twenty-eighth headline (CYCLE-032): F-48's blend simplification was menu-dependent — the honest
  simplification is a frozen λ on ≥2 years of history.** CYCLE-031 left two holes, and this cycle
  (`e41_blend_hindsight.js`, guarding a rebuild that reproduces `e40`'s 6.63 / 6.86 / 6.66 with diffs
  **0.00**) closes both — and **scopes F-48 down**. **(a)** On the shared OOS span, only **1 of 10**
  pre-registered blends clears the 0.2-Sharpe bar — the cherry-picked `{0.01, 0.02}` (6.66); the
  **no-hindsight** sets justified by F-37's cost-aware slow range read `{0.005,0.01,0.02,0.05}` **5.74**
  and `{0.005,0.01,0.02}` **6.08** (0.55–0.89 below the rule), and the blend ranking **flips by window**.
  So "a fixed blend replaces the rule" was the best of a menu. **(b)** A blend-selection walk-forward —
  pick the best set each block by trailing net@4 — reads OOS **5.81** vs the rule's 6.63, so the blend
  choice is **not learnable forward** either. **(c)** But a **single λ frozen** on `[0, S)` *is* the honest
  simplification: for S ≤ 1825 periods (≤1.7 y) the trailing winner is the F-37-**broken** λ=0.1 and the
  frozen spec collapses (OOS net@4 **1.76–1.93**); from S ≥ 2555 (≥2.3 y) the winner is **0.02** and the
  frozen spec **matches or beats the walk-forward** (OOS **6.81 / 6.64 / 4.10** vs the rule's
  **6.69 / 6.48 / 4.27**). So R8's walk-forward λ rule can be replaced by a **frozen λ chosen on ≥ ~2.3
  years of trailing data** — and the rule's real contribution is confined to the **first ~2 years**, where
  short windows pick the broken λ. **(d)** The freeze knob is non-monotone (a 730-period train at S = 1095
  picks the broken λ and reads 1.93, while a 365-period train picks 0.02 and reads 6.86), so there is no
  safe *short* history. Net: F-48's useful core survives, but as **"freeze a λ on enough history"**, not
  **"blend"**.
* **Twenty-ninth headline (CYCLE-033): R8's last fitted object — the cap — is removable too; the port spec
  is a pinned book.** F-48/F-49 removed the λ rule, leaving the **cap**. But F-39's "port-ready" spec was a
  **joint (λ, cap) walk-forward**, and `e42_cap_hindsight.js` (guarding a rebuild that reproduces `e31`'s
  6.13 / 6.63 / 6.86 / 1.93 with diffs **0.00**) shows the rule **loses** to a pinned book: the joint
  walk-forward reads OOS net@4 **6.13** while the pinned `ewma 0.02 + cap12.5 %` book reads **6.86** (and
  plain `ewma 0.02` reads 6.63), and the pinned book is ≥ the rule on **4 of 5** sub-spans. Its F-39 edge
  was over the *broken F-24 spec* (+2.76) — the third time the same pattern appears (F-37's λ rule, F-48's
  blend, F-39's cap rule). The cap is a **flat plateau**, not a tuned parameter: at λ=0.02, OOS net@4 is
  **6.63** (no cap) / **6.77** (0.10) / **6.86** (0.125) / **6.90** (0.15), so the structural `1/k = 0.125`
  is a principled, non-tuned pick; the cap **binds** (it clips **42.3 %** of weight entries), giving the
  first **out-of-sample** confirmation of F-27. Freezing the *pair* fails (short history picks the
  early-regime `0.075+cap0.1`, OOS 2.29–2.48), but a frozen **cap** with λ=0.02 reads 6.77 / 6.84 / 6.81 /
  6.64 / 4.10 — ≥ the rule at every split. So **R8's port spec is pinned** — λ chosen on ≥ ~2 y (F-49) plus
  the structural cap `1/k` — with **no walk-forward**, and R8 now has no fitted-object rule at all.
* **Thirtieth headline (CYCLE-034): the fade is a pinned book too — both port specs are rule-free.**
  CYCLE-031/032/033 made **R8** (carry dispersion) a pinned book. R7 (the toptrader fade) is the lab's only
  other deployable sleeve, so `e43_fade_pinned.js` (guarding a rebuild that reproduces `e32`'s 0.70 / 0.94 /
  1.11 / 1.14 / 0.69 / 1.03 with diffs **0.00**) ran the same chain on it. The joint (λ, cap) walk-forward
  reads OOS net@4 **0.70** vs the best pinned `ewma 0.05 + cap12.5 %` fade **1.14** (pinned `ewma 0.1`
  0.94) — the rule loses again. A λ **frozen** on `[0,S)` with the cap at `1/k` picks **0.05** and reads
  **1.14 / 1.15 / 0.37 / 0.83 / 0.87** vs the rule's **0.70 / 0.87 / 0.31 / 0.60 / 0.93** (≥ or within 0.2
  at every split, and — unlike R8 — **no ≥2 y minimum needed**). The mechanism is **λ-flatness**: with the
  cap fixed the eight λ's span only **0.16** OOS (0.25 uncapped), so the walk-forward is ranking near-ties
  and churns eight keys for a worse result — F-40's "trailing windows are noise-dominated at Sharpe ~0.8",
  now quantified. The cap transfers (λ=0.1: OOS **0.94→1.11**, turnover **28→16×/yr**, though recent-24m
  0.84→0.47 — a capacity add, not a recent-Sharpe add). So **R7's port spec is pinned** (`ewma 0.05 +
  cap 12.5 %`), and the port conclusion is **symmetric: both deployable sleeves are pinned books with no
  walk-forward** — the F-39/F-40 walk-forward machinery is unnecessary for either.
* **Thirty-first headline (CYCLE-035): the cap works by *concentration*, not by cutting churn — and a
  no-trade band stacks on top.** F-27/F-50 showed the strict 12.5 % cap lifts R8's net@4 **4.92 → 6.18**
  and its OI capacity **$20.4 M → $35.9 M**, but never said *why*. `e44_cap_mechanism.js` (guarding `e30`
  exactly) isolates the two channels: the cap both **clips the concentrated extremes** (max `|w|` 0.438 →
  0.125) and **shortens the weight path** (turnover 17 → 10×/yr). A **no-trade band** is a pure turnover
  tool. Swept to the cap's exact turnover (eps=0.008 → **10×/yr**), it reads net@4 **5.05** vs the cap's
  **6.18** — recovering only **+0.13 of the cap's +1.26** — and across the entire band sweep (turnover
  16 → 6×/yr) net@4 stays in **[4.95, 5.05]**. So the cap's Sharpe edge is the *shape* of the book, not its
  churn. Symmetrically, the band leaves concentration untouched (max `|w|` **0.436**) and its OI capacity is
  a **1.00×** multiple of base ($20.44 M vs $20.42 M ratio-of-means; $19.88 M vs $19.84 M min-of-ratio),
  while the cap is **1.76× / 1.70×** → the capacity gain is **concentration**. And the two tools **stack**:
  a band on the capped book reads net@4 **6.36** at turnover **6×/yr** (vs capped 6.18 at 10). So the cap is
  a concentration tool on both axes, and the port cost recipe is **cap `1/k` + a no-trade band**.
* **Thirty-second headline (CYCLE-036): the cap-mechanism is general — but the band remedy is R8-only.**
  F-52 found the R8 cap works by concentration. `e45_fade_cap_mechanism.js` (guarding `e32` exactly) runs the
  same decomposition on **R7** (the fade): its cap lifts net@4 **0.82 → 1.07** (**+0.25**), but a no-trade
  band swept to the cap's exact turnover (eps=0.05 → **8×/yr**) reads **0.78** — *below* base (**−0.04**) —
  and the whole band sweep (14 → 6×/yr) stays in **[0.78, 0.95]**. The band leaves max `|w|` at **0.456**
  (base 0.500, capped 0.125) and capacity a **1.03–1.04×** multiple of base while the cap is **1.43–1.47×**
  ($37.38 M → $54.78 M ratio-of-means; $32.43 M → $46.36 M min-of-ratio). So the cap is a **concentration**
  tool on **both** sleeves — the mechanism is a property of *clipping*, not of the dispersion book. **But**
  the band does **not** stack on the fade: capped+band tops out at net@4 **1.13** at 6×/yr vs the capped
  fade's **1.07** at 8 (**+0.06**, below the +0.1 threshold; R8 stacked +0.18). The port cost recipe is
  therefore **cap `1/k` + a band for R8, cap `1/k` alone for R7** — the band helps the churny dispersion
  book, not the already-cheap fade.
* **Thirty-third headline (CYCLE-037): the cap is a *tail winsorisation* — the hard form is not special.**
  F-52/F-53 left the mechanism open. `e46_cap_shrinkage.js` (guarding `e30` exactly) tests three families.
  A **smooth saturation** `c·tanh(w/c)` at c=0.125 reads net@4 **6.04** vs the hard clip's **6.18** (6.11 at
  c=0.10) — the *form* of the clamp barely matters, only the **level** — and the level is a plateau on the
  full window too (hard **6.18 / 6.18 / 6.13 / 5.84 / 5.23**, soft **6.11 / 6.04 / 5.94 / 5.74 / 5.43** for
  c = 0.10 / 0.125 / 0.15 / 0.20 / 0.30). But **wholesale shrinkage destroys the edge**: `sign(w)·|w|^p`
  reads **4.44 / 3.99 / 3.25 / 2.27** for p = 1.25 / 1.5 / 2 / 3 — *all below base* (4.92) — because it
  shrinks the small weights too, and the equal-weight book (least-concentrated) is worst at **1.51**. So the
  cap is a **winsorisation of the extreme tail while preserving the body** — not "lower concentration", and
  not a hard constraint. The mechanism thread F-52 opened is now closed.
* **Thirty-fourth headline (CYCLE-038): the "frozen λ matches the pinned book" conclusion is a *past-2.3-y*
  claim, not an everywhere-claim — and the cap stabilises it.** F-49/F-50 used a five-point split ladder;
  `e47_split_robustness.js` (guarding `e30` exactly) sweeps a **dense** 14-point grid under two freeze
  constructions. The pre-registered 0.80 robustness bar **narrowly fails**: the **expanding** `[0,S)` freeze
  is within 0.2 of the in-sample-best pinned book at **0.71** (median gap 0.00), the **rolling 1-year**
  freeze at **0.79** (median **+0.30**). But every failure is in the first ~2 years: the expanding freeze
  picks a fast λ and collapses at **every split S ≤ 2190** (−3.4…−4.4), then picks **0.03** and matches at
  **10/10** splits from S = 2555. So F-49's caveat is **widened and sharpened** — the safe boundary is
  **~2.3 y**, and the "broken" fast λ is **0.075** (not 0.1) once training exceeds ~1.3 y. The **rolling**
  freeze is strictly more robust than the expanding one (0.79 vs 0.71, median +0.30), so the freeze should
  *forget* the early regime. Finally, the **cap stabilises the policy**: rolled robustness is **0.50
  uncapped → 0.79 capped** — a third independent benefit of the 12.5 % cap.
* **Thirty-fifth headline (CYCLE-039): L19's OI mix is vol-optimal at 50/50, but holding it 1–2 days buys
  the fees back.** F-46's regime-robust OI book is a *fixed* 50/50 blend of two EWMA scales, chosen for
  robustness. `e48_oi_construction.js` (guarding **both** the daily `e21` book — 0.9612 / 1501.11 — and
  F-46's `e38` 50/50 ensemble — 0.77 / 11.33 / 254 — exactly) asks whether a construction beats it, with no
  λ fitted. **The mix is null:** every non-equal fixed mix is ≤ equal capital (0.76 / 0.77 / 0.74 / 0.69 vs
  **0.77**), and an *unfitted* **inverse-vol** mix picks `w = 0.51` — essentially 50/50 — for OOS **1.18** vs
  the blend's **1.19**. **The cadence is positive:** a **hold-6** (~2-day) cadence on the blend lifts net@4
  **0.77 → 0.87** while **gross falls** 1.18 → 1.03 — turnover 254 → **93×/yr** more than pays for the
  staleness (break-even 11.33 → **27.03 bps**, positive every year 2022–26). hold-3 **0.82** and hold-9
  **0.83** (loses 2024) place the gain on a **1–3 day plateau** (hold-6 is the grid max, so +0.10 is an
  upper bound). The mechanism is **cost, not decay** — the *opposite* of the R7 no-trade band (F-53) and the
  *same* direction as the R8 band (F-52). A lab-internal bug was found and fixed on the way (the blend
  averaged weight vectors **without renormalising**, reading 0.70 / 10.75 / 220); a second guard now pins it.
* **Thirty-sixth headline (CYCLE-040): F-56's hold-6 gain is a spike, not a plateau — but the drift caveat
  does not fire.** F-56 rested on a five-point cadence grid and a turnover measure that ignores
  inter-rebalance drift. `e49_hold_drift.js` (guarding `e21` and F-46's `e38` ensemble exactly) does both.
  **Drift:** a true-hold simulation (weights drift `w′ⱼ = wⱼ(1+rⱼ)/(1+R)` between updates, traded back only
  at updates) gives turnover **within 2×/yr** of the lab's target-change measure at **every** N — so
  `turnoverSeries` is *not* optimistic for a hold policy — and a slightly **higher** net@4 (hold-6
  **0.94** vs the lab 0.87). **Grid:** the fine grid (N = 1…36) is **jagged** — the best hold-6 (0.87) is an
  **isolated spike** (**+0.10** over its neighbours 5/7), only **4 of 15** holds clear the +0.05 bar
  (non-contiguously: 2/3/6/9), the short-hold region (2–9) averages **0.80** vs the daily 0.77 and the long
  region (10–24) collapses to **0.60**. So F-56's cadence claim is **scoped down**: holding the 50/50 blend
  **≤ ~3 days** is cheaper (254 → 73×/yr) and no worse, but **no specific cadence reliably adds** — the
  +0.10 at hold-6 is noise. The *mix* half of F-56 (50/50 is vol-optimal) stands.
* **Thirty-seventh headline (CYCLE-041): the OI sleeve's right cost tool is a no-trade BAND, not a cadence —
  a smooth plateau at net@4 0.92.** F-57 left the sleeve with a weak construction ("hold ≤ ~3 days"). But a
  hold ignores fresh information until the clock says so, so its Sharpe is a noisy function of N. The lab's
  *proven* turnover tool — the F-52/F-53 **no-trade band** (per symbol, move only when the target moved more
  than `eps`) — is state-dependent and had never been applied to the OI sleeve. `e50_oi_band.js` (guarding
  `e21` and F-46's `e38` ensemble exactly) ports it: at `eps = 0.03` the blend reads net@4 **0.92** at
  turnover **198×/yr** (break-even **15.22 bps**, **positive every year 2022–26**) — **above** hold-6's 0.87
  and the daily 0.77 — and it is a **plateau** (3 sweep points within 0.05 of the peak, neighbours close) with
  **no interior re-rise** (`bandReRisers` 0 vs hold-N's 1). At matched turnover it wins **7 of 18** sweep
  points (all at turnover ≈ 173–200+); the cadence's residual low-turnover edge is exactly its fine-grid
  spikes. So the sleeve's construction is **50/50 + band (eps ≈ 0.03)**, and the band is now confirmed as the
  lab's **general** cost tool (R8 stacks with the cap, R7 alone, OI alone).
* **Thirty-eighth headline (CYCLE-042): the OI band's edge over the cadence survives out of sample (11/11),
  but its eps needs ≥ ~2.3 y to settle.** F-58 chose `eps = 0.03` on the full sweep. `e51_band_holdout.js`
  (guarding `e21` and F-46's `e38` ensemble exactly) gives both tools the dense-split treatment: at each split
  it picks `eps*`/`N*` in-sample, freezes them, and scores forward. The **frozen-eps band beats the frozen-N
  hold at 11/11** splits, and a **fixed** `eps = 0.03` beats both the daily blend and fixed `hold-6` at
  **every** split — so F-58 is **not** a full-sample artefact. **But** the trailing `eps` pick is unstable
  below ~2.3 y: S = 1460/1825/2190 choose the **largest** eps (`0.1`) and underperform fixed 0.03 OOS
  (1.03–1.22 vs 1.40–1.65); picks collapse to a single `0.03` from S ≥ 3650. So the pre-registered stability
  bar fails overall but passes late — the **~2.3 y** boundary of F-49/F-55, now recurring for a third
  parameter. **Pin `eps ≈ 0.03`**, or choose it on ≥ ~2.3 y.
* **Thirty-ninth headline (CYCLE-043): the port artefact — one module reproduces all three sleeves' books.**
  The roadmap's last item. `prototypes/port.js` extracts the lab's shared book post-processing
  (`clipWeights` = clip-and-hold, `bandWeights` = per-symbol no-trade band, `cleanBook` = cap **then** band)
  plus `SLEEVE_SPECS` and `MIN_TRAIN_PERIODS = 2555` (~2.3 y, the F-49/F-55/F-59 rule). `e52_port_artefact.js`
  rebuilds each sleeve's raw rows (R8, R7, OI) and applies **`port.js` only**, checking the stored numbers:
  R8 cap **6.18 / 10× / 46.04** = `e30`; R8 matched band **5.05 / 10×** = F-52; R8 cap+band **6.31 / 7×** =
  F-52's stack (6.36 / 6×); R7 cap **1.07 / 8× / 182.59** = `e32`; OI band **0.92 / 198× / 15.22** = `e50`. All
  **5/5 pass**, so the port is **one executable module**, not three hand-rolled copies or a prose recipe.
* **Fortieth headline (CYCLE-044): the repo's own carry grid join mis-scales sub-8h funding — and it fails
  safe, so only a synthetic test catches it.** FOLD-BACK R4 had pre-registered (CYCLE-006) an audit of the
  shipped `analysis/carry.js#carryOnBarGrid`/`carryPanelStream` funding→bar-grid join for (a) a candle-tail
  guard, (b) sub-8h aggregation, (c) exact alignment. CYCLE-044 (`e53_carry_grid_audit.js`) settles it: (b)
  is **missing**, and the function **contradicts its own comment** ("the bar-grid projection divides by the
  period actually observed"). `carryOnBarGrid` divides every funding row by the *default* 8h bar count, so a
  synthetic 8h period at 8h/4h/2h/1h funding returns **one rate at every interval** — a **1×/2×/4×/8×**
  understatement (`L10-aa`). It bites the shipped data: the only sub-8h symbol is **SOLUSDT** (3 × 4h + **98
  × 2h** steps, FTX 2022-11-09→18), whose FTX window receipts **−0.107** (shipped) vs **−0.324** (the
  bucket-summed truth) = **3.03×**, making the pooled 8h sleeve read ann **9.985 %→9.531 %** and Sharpe
  **11.96→9.60** — the defect **flatters** the book, so the F-11 "implausibly large" alarm could never fire
  (the F-18 direction lesson, third appearance). And the shipped audit is **blind** to it: `L10-ac` —
  SOL's 98 sub-grid steps are 1.47 % of the file (under the 2 % off-grid budget) and *shorter* than a grid
  period (so not `missingPeriods`), and `auditFundingProblems` returns **[]**. A latent sibling (`L10-ab`)
  is a single-pair `barsPerPeriod` inference that would double a symbol's carry if its first two bars
  straddled a gap. The lab never calls the function (its loader buckets rows first, L10-o), so no lab number
  moves — and `e14` now pins that with check 13 `sub_8h_sleeve_equality`. This is the audit's **first
  shipped-path arithmetic defect**; FOLD-BACK **R4** carries the fix (bucket rows into 8h sums before
  projecting).
* **Forty-first headline (CYCLE-045): the dependence/DSR backbone is unbiased but low-precision, and
  `effectiveBars` is unbounded.** Every pooled significance verdict the lab reports rides on the repo's
  `walkforward#dependenceSummary` → `effectiveBars = n/designEffect` → `backtest#backtestMetrics` chain.
  CYCLE-045 (`e54_dependence_audit.js`) audits it against **closed forms**: ensemble means over synthetic
  panels match the survey-sampling design effect — `1+(K−1)ρ` for K equicorrelated streams, `K` for
  identical streams, `1+ρ` for negatively correlated pairs, and the i.i.d. null 1 — within **2.5 SE**
  (max gap **0.318**, **0 biased rows**), so F-02's real-basket DE 4.92 is the estimand it claims. **But
  the precision is the finding**: on true-i.i.d. data a *single* reading at the repo's own **C = 36** folds
  spans **0.644–1.452** (sd **0.243**; **0.097** at C = 288), so a two-decimal `designEffect` overstates
  the resolution ~10× and a single `adjustmentNeeded` verdict within ~1 ± 0.25 of the gate is not
  resolvable. And it settled the bound question: **L10-f** — `effectiveBars` is not merely able to exceed
  `n`, it is **unbounded** — a ρ = −0.5 pair reads `effectiveBars > rawBars` in **25/25**, and a
  perfectly hedged pair gives DE **4.7e−32** → `effectiveBars ≈ 3.4e34` while `adjustmentNeeded` reads
  **false** (DE is a *squared* ratio, so the `> 0` guard is not a bound). **L10-i** — the DSR path's
  `2 ≤ effectiveBars < n` clamp **declines** the explosion (`nEff`/`dsrAdjusted` = `null`), which is the
  intended, documented behaviour — not a defect, though lossy (a hedged panel and a degenerate one both
  read `null`; new row **L10-ae**). This is the audit's **second** synthetic-ground-truth experiment on a
  repo function (after `e53`), and its **closed-form + seeded ensemble + 2.5-SE band** method is now the
  standing recipe for auditing any statistic.
* **Forty-second headline (CYCLE-046): the split family's purge contract — the purged variants hold, the
  walk-forward does not purge.** `analysis/splits.js` opens "Time-series cross-validation with purging and
  embargoing", and the repo's lock-registry claims the family proves "**zero label-window leakage**".
  CYCLE-046 (`e55_split_audit.js`) audits that against a **closed-form label-overlap ground truth** (a fold
  leaks iff some training label window `[i, i+H−1]` overlaps a test window `[j, j+H−1]`, i.e.
  `0 < j−i ≤ H−1`). It finds the family splits: `purgedKFoldSplit` and `combinatorialPurgedSplit` are
  **leak-free on every fold** of a synthetic grid (0 overlap pairs; embargo honoured; CPCV test multiplicity
  exactly `C(k−1, m−1)`), but **`walkForwardSplit` — the path the repo A/B and the lab's F-13 actually use —
  performs no purging or embargoing at all**. It has no `labels`/`labelSpan`/`embargo` parameters (passing
  them returns **byte-identical** folds) and its folds carry no purge metadata, so for a label horizon
  H > 1 the fold boundary leaks exactly **`H(H−1)/2`** train/test label-overlap edges per fold (10/fold at
  H=5; 120 edges at testSize 40; **0** at H=1). The causality guard `isCausalFold` tests index order only,
  so it **passes every leaky fold** — a *look-ahead-in-time* check, not a *leakage* check — while the repo's
  own `assertNoLeakage` flags it but is **never called on the walk-forward** (**L10-ag**: the test-ledger
  claim is itself a claim — the L10-t lesson). The leak is exploitable: an index-lookup model, permitted
  because the API hands it `trainIdx`, recovers test-period returns in the leak zone (**+0.0035**/bar P&L
  edge, se 7e−5, vs 0.0000 clean and +0.0001 purged). Every lab walk-forward result scores parameter-free
  signals (span 1 → zero leak), so **no lab number moves**; the shipped controller trains on horizon labels
  (`labelHorizonBars`; the opt-in `label:triple` vertical barrier), so the precondition is met on the
  shipped model path — but CYCLE-047 **scoped F-63 to LATENT**: the shipped controller is **online** (the
  fold is fitted by replaying bars `1 … testStart`, each call seeing a window ending at `i − 1`, so the last
  training bar is `testStart − 1` and the fold's `train` list is ignored; a trade is labelled by its outcome
  at the **exit** bar, and only *closed* trades train), so every training label is realised before the test
  and the leak cannot occur. **FOLD-BACK R9 (latent, low-priority)**: purge the walk-forward boundary for a
  future *fixed-label offline* model (accept label spans; drop training labels overlapping the test window —
  the purged K-fold's own rule).

* **Forty-third headline (CYCLE-048): the labelling module is correct on its contracts, and its five warts
  are all latent because only one of its six exports is shipped.** `analysis/labels.js` owns the label
  spans CYCLE-046/047 turned on, so `e56_labels_audit.js` (23/23 guards, 77 ms) audits it against **closed
  forms**. The contracts hold: `tripleBarrierLabels`' first crossing is exactly `ceil(level/step)` on **192**
  monotone cases and its three-way `ret` / first-crossing / timeout-index contracts hold on **60** seeded
  random paths — with the caveat that `ret` is a **realised price change** (the touch bar **overshoots** the
  barrier level **1362** times on gaps, so it is not the barrier magnitude); `cusumFilter` matches an
  **independent** drawup/drawdown formulation of its own reset rule on **160/160**; `fractionalDiffWeights`
  equals `(−1)^k C(d,k)` exactly for integer `d` and against an independent **Lanczos-`Γ`** for non-integer
  `d` (max rel. err **2.3e−14**); and the one **shipped consumer** (`features.js#fracDiffAt`/`fracMomentum`)
  equals the weights convolution exactly. Five warts follow. **(1)** The `pt`-before-`sl` tie-break
  (a bar satisfying both barriers reads **+1**) is **unreachable for `vol > 0`** — both can hold only if
  `(ptMult + slMult)·vol ≤ 0`, measured **0 of 6** bars at `vol ∈ {2.7, 1.4, 0.3}` but **3** at `vol = 0`
  and **6** at `vol < 0` — so it is a no-op on the sane domain; at `vol = 0` the barrier collapses to a
  **one-bar sign label** (horizon ignored) and a flat series labels **11/12** events **+1 at `ret = 0`**
  (**L10-ak**). **(2)** The default event set includes `n−1`, emitting a **zero-horizon**
  `{t1 = event, label 0, ret 0}` bet indistinguishable from a vertical timeout, while exactly `H` events get
  a truncated vertical barrier; the repo test asserts only `t1 >= event` (**L10-al**). **(3)** `cusumFilter`
  **ignores its `events` argument** (**L10-ai**). **(4)** Its `lastEmit` guard is **dead** — `t` strictly
  increases, so `t !== lastEmit` is always true (the guard-free independent reference matches exactly)
  (**L10-aj**). **(5)** The "`size <= 0` uses `DEFAULT_FD_WINDOW`" docstring is **false**: the auto branch
  stops at `|w| < 1e−12`, giving widths **1/2/3/4** for `d = 0/1/2/3` — the repo test samples only `d = 0.4`,
  the one case that cannot catch it (**L10-am**). The cycle also **killed a candidate before writing it
  down**: `fractionalDiffWeights(0, 0)` is `[1]` and the `d = 0` identity is exact with no NaN — the
  width-2/NaN-at-0 behaviour belongs to `d = 1` (**L10-an**). The **scope trace** (**L10-ao**) is what makes
  every wart latent: only **1 of the module's 6 exports** (`fractionalDiffWeights`) is on the shipped path
  via `analysis/features.js`; `tripleBarrierLabels`, `cusumFilter`, `fractionalDiff`, `fracDiffLogPrices`
  and `DEFAULT_FD_WINDOW` are consumed by tests only (the shipped controller labels trades in
  `hivemind/controller/trades.js`). **L10-ap** records the calibration: the shipped arm uses `window 16` at
  `d = 0.4` where the module's own auto rule is **100**, with **6.27 %** of the `|w|` mass beyond `k = 15`.
  No shipped behaviour moves and there is **no new fold-back row**.

* **Forty-fourth headline (CYCLE-049): the PBO/CSCV module is structurally exact, its quoted calibration is
  one draw, and its split count is really ~4.** `analysis/overfitting.js` implements the Probability of
  Backtest Overfitting over `C(S, S/2)` combinatorially symmetric splits, and the repo's lock-registry makes
  both exact structural claims and quotes a calibration. `e57_overfitting_audit.js` (29/29 guards) confirms
  the structure against closed forms: `cscvBlocks` partitions the bar grid (remainder on the first blocks,
  7/7); `cscvSplit` yields exactly `C(S, S/2)` splits (6/6 `S ∈ {2…12}`), each a disjoint cover, each block
  in exactly `C(S−1, S/2−1)` in-sample sets, the set closed under complement, and the cap rejects
  `C(22,11) = 705432` while passing `C(20,10) = 184756`; `relativeRank` matches best `N/(N+1)`, worst
  `1/(N+1)` and the average tie rank (`[5,5,1,1]` → 0.7/0.3); `oosOnIsRegression` matches an **independent
  sum-formula OLS** on 40 vectors (1e−9); and constructed PBOs are exact (all-flat **1**, one dominant
  strategy **0** — the IS winner `j = 0` in all 252 splits — an anti-persistent pair **1** with slope ≈ −1,
  and a hand-computed metric-override pair **0.5 / 1.0**). PBO is exactly invariant under annualisation and
  positive per-column scaling. **The calibration reproduces exactly and is one draw:** with the repo's own
  RNG at seed 20240 the quoted figure reproduces to the split — **PBO = 117/252 = 0.46429**, degradation
  slope **−0.0936** — but a 60-matrix ensemble centres at **0.4769** (se 0.0329) with **sd 0.2546** and
  p05–p95 **0.099–0.885**, while the binomial split SE of one 252-split PBO is only **0.0315** → a split
  **design effect of 65.4**, i.e. **≈3.9 independent splits** (the **F-62** lesson, one level up — last
  cycle a `designEffect`, this cycle the whole estimator). The other two regimes hold (a persistent edge →
  PBO 0, slope ≈ +1.00, 12/12 seeds; a planted regime flip → 1). **Five latent rows**, all masked by the
  scope trace (**L10-av**: no shipped module imports `overfitting.js` — only `analysis.test.js` and
  `test/lock-registry.js`; the `decision.js`/`reality_check.js`/`walkforward.js` matches are comments):
  **L10-aq** — `relativeRank` skips `NaN` in the rank but divides by the **full** length
  (`relativeRank([1,2,3,NaN],2) = 3/5 = 0.60` vs 0.75), so a `NaN`-producing metric depresses `omega` and
  biases PBO **up**; **L10-ar** — the `lambda ≤ 0` convention forces a **fully-tied** roster to PBO
  **exactly 1**, though *partial* duplication does **not** bias it (**0.5806 → 0.5671 → 0.5401** for
  0/5/19 duplicate columns, sign 6/10 — the pre-registered mechanism guess is **falsified**); **L10-as** —
  `degradation` returns `n = N·splits` (**2016**) dependent pairs though only `N·S = 80` block performances
  determine them, so a naive `t = sqrt(r²(n−2)/(1−r²))` exceeds 1.96 on **91.2 %** of skill-less matrices
  (nominal 5 %); **L10-at** — a 252-split PBO is worth ~4 independent splits; **L10-au** — `cscvBlocks(6,6)`
  alone yields six **1-observation** blocks (only the PBO entry enforces `blocks ≤ floor(T/2)`, and its
  message says "per half" where the rule is per block). No fold-back row; `run_all` is now **65 steps,
  32 gated, 0 fails**.

* **Forty-fifth headline (CYCLE-050): the resampling hub's live primitives are exact, but the block-length
  selector does not reproduce the reference its own comment names.** `analysis/reality_check.js` is the
  module family the whole evaluation stack resamples through, and it is the first in this audit queue that
  is *partly shipped* — `forecast.js` imports `stationaryBlockIndices` (Diebold-Mariano + Model Confidence
  Set) and `walkforward.js` imports the four subsampling procedures (familywise search).
  `e58_reality_check_audit.js` (39/39 guards) verifies every exact identity: `stationaryBlockIndices` at
  `b = 1` is **byte-equal to an independent hand replay** of its rng stream and is i.i.d.-with-replacement,
  and the geometric restart law replays byte-for-byte (measured restart rate `≈ 1/b`, mean run `≈ b`, both
  within 2.5 bootstrap SEs); `neweyWestSE` matches an **independent Bartlett** implementation on 24 windows
  × bandwidths (1e−12) and is slice-invariant; RC = `sqrt(T)·max_k mean(f_k)` (a constant benchmark shifts
  it by exactly `−sqrt(T)·b`); SPA = `max(0, max_k fbar_k/ω_k)` with the bootstrap SE (independently
  recomputed); the consistent-recentring bound `A_k = ω_k·sqrt(2 log log T)` is exact and consistent ==
  upper recentring when every candidate is valid; the step-down's **first step is bit-equal to the
  single-step consistent SPA**; and the subsampling family shares **one** reference (k-FWER at `k = 1` ==
  the step-down's first p == the consistent SPA p), is deterministic, and is segment-aware (`groups = [T]`
  bit-identical to ungrouped). It also reproduces the arch AR(1) reference vector (**13.635665 /
  15.608940**) from an **independently implemented NumPy legacy-RandomState(0) stream**. But the module's
  comment claims `politisWhiteBlockLength` \"reproduces the reference implementation
  `arch.bootstrap.optimal_block_length` … to floating-point precision\", and that is **false for `g ≤ 0`**:
  the code returns **exactly 0** unless its flat-top long-run `g > 0`, while the referenced
  `_single_optimal_block` **squares `g`**. Over 200 AR(−0.5) T=400 draws the repo reads 0 in **198** and
  arch a positive length (e.g. **22.0** at `g = −0.858`, **5.99**, **10.86**), so `autoBlockLength` floors
  to **1 (i.i.d.)** on **99/100** of them — the automatic block bootstrap silently degrades to i.i.d.
  resampling on exactly the anti-persistent streams that need it most (**L10-aw**; the guard also fires on
  **58 %** of i.i.d. T = 120 columns). Two more latent rows: the `median` arm reduction is the **upper**
  median on an even arm count (**4.84761** vs **4.25907** — **L10-ax**; the test uses odd `K = 5`, the one
  case that cannot see it) and the `neweyWestSE` non-positive-variance clamp's `v < 0` arm is
  **unreachable**, because the Bartlett-tapered sum is a **PSD quadratic form** (an exhaustive ±1 search up
  to length 18 × every bandwidth plus 3000 random windows finds minimum taper exactly 0 — **L10-ay**).
  **L10-az** records the scope: the block-bootstrap RC/SPA family is **test-only**; only
  `stationaryBlockIndices` and `neweyWestSE` + the four subsampling procedures are shipped, and those are
  exact. Independent calibration: subsampling SPA holds its 5 % size across the persistence sweep
  (**0.040 / 0.045 / 0.045 / 0.030** for φ = 0 / 0.2 / 0.5 / 0.8) while the block bootstrap over-rejects
  (**0.090 / 0.105 / 0.180 / 0.385**), and RC/SPA keep their size under a pure i.i.d. null (0.035 / 0.065).
  The cycle also fixed a **lab bug**: `e56` and `e57` never exposed `verdict.validationPass`, so `run_all`
  left their `pass` **undefined** since CYCLE-048/049 — two validation suites were reported but **not
  gated**; both now return it. No fold-back row; `run_all` is now **66 steps, 35 gated, 0 fails**.

* **Forty-sixth headline (CYCLE-051): the shipped forecast scoring layer is exact — against the repo's own
  second Murphy implementation — but its docstring's decomposition identity is false, its alignment guard
  counts bars instead of identifying them, and its benchmark-grouping branch contradicts its own reader.**
  `analysis/forecast.js` is the next module in the audit queue and — unlike the three before it — **shipped**:
  `analyze.js` runs the forecast block by default (`--forecast=0` disables), so its output reaches a run
  report. `e59_forecast_audit.js` (33/33 guards) gets a **free second reference** — the repo already
  contains an independent Murphy implementation in `observer/legion_metrics.js`. The arithmetic is exact:
  `forecastPairs` IS the inverse of `confidenceFromProb(prob) = clamp(prob,0,100)/50 − 1` (to 1e−12) plus
  the next-bar sign, the fold-last-bar drop and the non-finite skip; `brierBinIndex`/`brierScore`/`logScore`
  are the closed forms with the documented eps clip and NaN handling; the Murphy partition satisfies
  `brierBinned = REL − RES + UNC` (1e−17); **the two implementations agree on REL/RES/UNC/Brier to 1e−12**
  and the observer's explicit `within` equals forecast's raw-minus-binned gap to **1e−17**; `bootstrapMeans`
  is deterministic with the documented `max(1, floor(cbrt(T)))` block and one **paired** index draw; the DM
  statistic is exactly `dbar / bootstrap-SE` with the documented degenerate arms (zero differential →
  0 / 1 / `null`, constant positive → `Infinity` / 0), an i.i.d. size of **0.0525 / 0.1075**, and a block
  bootstrap that controls the φ = 0.5 size where `blockLength = 1` does not (**0.095** vs **0.135**); the
  MCS eliminates a uniformly worse arm, keeps an identical pair, **always contains the sample-best**
  (4 ensembles × 200 runs = 800/800), is deterministic and monotone in the confidence level, and covers
  **0.880 / 0.855 / 0.865 / 0.925** (the lower edge of the 2.5-SE band — a probe's 0.82 reading was
  Monte-Carlo noise). **L10-ba** is the headline: the comment's claim that the raw-minus-binned gap *is the
  within-bin forecast variance* is **false** — the exact identity (the repo's own
  `observer/legion_metrics.js`) is `gap = WITHIN = withinVar − 2·withinCov` — and the gap is **negative on
  5 of 6** configs while `withinVar > 0` (T = 64 / bins = 1: **−0.0531** vs **+0.0774**), the claimed value
  wrong by up to **0.13**. **L10-bb**: the `forecastComparison` alignment guard only compares bar
  **counts**, so a count-coincident misalignment (two variants dropping the same *number* of bars at
  *different* positions) is silently paired index-wise and the DM verdict **flipped in 6/6** crafted
  witnesses — the module's own "refuse rather than silently compare mismatched windows" invariant is not
  enforced. **L10-bd**: `groupOf` maps `benchmark` to the **baseline's** kind, so with a `'signal'` baseline
  a calibrated-probability benchmark joins the **z-score** signal group and receives a DM test against it,
  while a genuine controller candidate is refused as cross-kind — the exact mismatch R27-5 exists to
  prevent; it is **unreachable from `analyze.js`** (the `id:'baseline'` controller variant is forced to
  index 0) and the §AI test only exercises `baselineKind='controller'`. **L10-be**: the MCS elimination
  denominator is `sd(L_i)` where Hansen-Lunde-Nason's `t_i` uses `sd(d_i)` (the two differ by up to **77×**
  on 150 heteroskedastic configs) — real on paper, **empirically inert** (**0/150** surviving-set or order
  changes). **L10-bc**: the exported `bootstrapMeans` silently NaNs on unequal-length series and the MCS
  returns `available:true` for a NaN-containing loss series (latent; the shipped path is finite). **L10-bf**
  is the negative control: the calibration battery **upholds** the module. No fold-back row
  (docstring/branch/export level, not the scored path); `run_all` is now **67 steps, 36 gated, 0 fails**.

* **Forty-seventh headline (CYCLE-052): the successive-halving racing engine's closed forms are exact, but
  the correctness requirement that would license using it — "a racing budget does not change the decided
  set" — is a tautology on its own test fixture, and the race can cost more than the grid it replaces.**
  `analysis/race.js` (round 26, R26-15) is the SHA/Hyperband family-search engine, and the repo itself has
  **gated it off** — no shipped module imports it and `analyze.js` exposes **no `--race` flag** (RUN-ANALYSIS
  §7 measured neither an economics nor a diversity win), so it is **engine-only / test-only**.
  `e60_race_audit.js` (18/18 guards, 27 ms) validates every closed form and contract: `halvingRounds` =
  `max(1, floor(log(max/min)/log(eta)) + 1)` on six grids plus its four guards, `halvingSchedule`'s
  `keep = max(1, ceil(survivors/eta))` / monotone budgets / top rung `= maxBudget` (when every round runs) /
  early stop when one arm remains, and `successiveHalving`'s full-rung arm order, `nonFinite` elimination,
  `maximize:false` selection, sync-vs-async equality, stable arm-order ties, cost-counter reconstruction,
  the `arms`/`evaluate`/`maxBudget` guards and `formatRace`. But the *claim* fails. **L10-bg** is the
  headline: the §AM fixture's `evaluate = q ± 0.05/budget` has a **budget-independent ranking**
  (`rank(1) == rank(9)`), so "race winner == full-grid oracle" cannot fail — a **tautology** — and the
  fixture's own top rung (3) is below its oracle's budget (9); with a budget-dependent evaluator (the SHA
  premise) the race eliminates the top-budget best and disagrees with the top-budget argmax on
  **0.617 / 0.617 / 0.700 / 0.625** of seeded fixtures (K = 16, 120 reps; (η,B) = (3,27)/(3,9)/(3,3)/(2,16)).
  **L10-bh**: `spentBudget < gridBudget` holds only at a large budget ratio (0.222 on the fixture) and reads
  **1.000 / 1.056 / 1.222 / 2.890×** in the small-ratio regimes — the race can cost *more* than the grid.
  **L10-bi**: small-`eta` integer rounding leaves consecutive rungs at the same budget (**15 of 25** at
  `eta = 1.1`). **L10-bj**: `successiveHalving` does not validate `eta`/`minBudget`, so η = 1/0.5/0 and
  `minBudget > maxBudget` return a silent `available:true` with `winner:null` and zero evaluations.
  **L10-bk** is the scope: engine-only, so every row is **latent** — but the claim that licenses the gate is
  the one that fails. No fold-back row; `run_all` is now **68 steps, 37 gated, 0 fails**.

* **Forty-eighth headline (CYCLE-053): the shipped P1 model-class benchmark's documented contracts are
  exact, but the ridge arm's probability is anchored at 0.5 — its training base rate is computed and then
  discarded — and a sigmoid over a bounded least-squares fit caps the arm's skill.** `analysis/benchmark.js`
  feeds the opt-in `--variants=bench-base-rate,bench-linear,bench-mlp` arms; the ridge arm is the MCS
  survivor and the best of the set, so its probability is load-bearing for the round-29 "negative branch"
  (G-A). `e61_benchmark_audit.js` (12/12 guards, 67 ms) validates the documented contracts — the
  standardiser (zero-mean/unit-std, a collapsed constant column, the empty-input shape), `fitRidge` against
  an **independently solved** centred ridge (matching to **0**), `predictRidge`'s `(0,1)` range,
  `fitBaseRate` = the training prior, the ridge/MLP separable-rule accuracy, MLP byte-determinism,
  `BENCHMARK_KINDS` + the `tsfm`/unknown-kind refusals, and a perfect classifier beating the base rate on
  Brier. **L10-bl** is the headline: `fitRidge` computes `ybar`, centres the target on it, and
  **`predictRidge` never restores it**, so the arm's probability is anchored at 0.5 — a constant-`y` fold
  reads exactly **0.5**, and a **0.833**-base-rate fold reads a mean of **0.50** (Brier **0.22475** vs
  **0.13533** with the module's own term restored); the shipped §P1 test checks **accuracy only** (a 0.5
  threshold, invariant to the offset), so it cannot fail — the F-68 lesson on a shipped arm. **L10-bm**: the
  sigmoid is applied to a least-squares fit of a bounded [0,1] label, so the arm's output is confined to
  `sigmoid([-1,1])` (at `p̄ = 0.5`: `[0.378, 0.622]`) — a perfectly separable feature reads Brier **0.1425**
  (the arm's floor, not ~0) while the MLP (a free logit bias) reaches **0.99** on a constant-`y` fold.
  **L10-bn**: the LOCKED/lock-registry claim that the test proves the ridge closed form "against a
  hand-computed solve" is **unverified** — the closed form is exact, but the five shipped §P1 checks assert
  accuracy/determinism/standardiser/factory/grouping only. **L10-bo** is latent: the eps constant-column
  fallback turns a one-unit train→test deviation into `z = 1e8`. Two rows are shipped (a forecast arm's
  readout) but no golden moves and there is **no fold-back row**; `run_all` is now **69 steps, 38 gated,
  0 fails**.

* **Forty-ninth headline (CYCLE-054): the measurement layer is exact to its documented bounds, but
  `hitRate`'s exclusion cannot be implemented as documented (and its implemented one counts exit-cost bars as
  misses), the fold scorer re-lags the signal inside the test slice, and a probe's negative-MinTRL lead is
  disproved by Pearson.**
  `analysis/performance.js` is the lab's significance instrument and `analysis/backtest.js` is the layer that
  feeds it — every pooled `report.json` number flows through `purgedCVBacktest`/`poolFolds`/`backtestMetrics`,
  and `performance.js` is imported by eight `analysis/` modules. `e62_backtest_audit.js` (26/26 guards, 4.13 s)
  validates both halves against **independent references**: `erf` vs **Simpson quadrature** (max err
  **1.393e-7**, inside A&S's 1.5e-7) with `normalCdf(0) = 0.5` exactly and odd; `normalInvCdf` round-tripping
  **2.46e-10** against a **Lentz-erfc** reference (inside Acklam's 1.15e-9) and antisymmetric to 2.8e-14; the
  population moments exact (`kurtosis([1..5]) = 1.7`, `stdSample = √2.5`); the Lo (2002) SE = `√(1.5/99)`; PSR
  **exactly 0.5** at its own benchmark; DSR = PSR at the expected-max hurdle to **1e-15** (DSR ≤ PSR,
  `expectedMaxSharpe` reproduced to 5.1e-11, ∝ √V, monotone in trials); MinTRL(SR = 0.5, 95 %) =
  **13.1749455166** vs the documented vector 13.174945 and an independent recompute (13.17494554); and the
  stationary bootstrap size-calibrated on **1000** i.i.d. noise series (**5.9 %** at 5 %, **11.0 %** at 10 %,
  mean p **0.502** — the repo's 5.8 % claim reproduced) — plus the backtest arithmetic exactly (positions lag
  one bar, turnover counts the initial entry, gross/cost/net to 1e-15, equity `[1,1.1,0.88,0.924]`, drawdown
  0.5/0.19/0, tradeCount transitions, the break-even identity), a `poolFolds` restatement identity, and
  `purgedCVBacktestAsync` **byte-identical** to the serial path at concurrency 4. Three rows. **L10-bq** is the
  actionable one: `hitRate(strategyReturnSeries)` receives **only a return series**, so its docstring ("bars
  with no position are excluded") is a criterion its signature cannot express, and the implemented `r === 0`
  skip both drops a zero-return in-market bar (**0.6667** where the documented rule gives 0.5) and — because
  `backtestMetrics` passes the **net** series — counts every exit-cost flat bar as a **miss** (a
  perfectly-timed 3-round-trip book at 10 bps reads **0.5** where the documented rule gives **1.0**); the
  shipped check's flat bars *are* its zero-return bars, so it cannot discriminate. **L10-br**: `scoreFold`
  re-lags the signal **inside** the test slice (`pos[0] = 0`), so on the supported fixed-signal path the first
  bar of every fold is flat and a **CPCV** run boundary holds the previous *test* bar's signal (bar 30 pooled
  **+0.05** vs the global **−0.05**; 3/64 bars differ on a 4-fold split) — latent. **L10-bp** is a **disproved
  lead**: the probe's negative MinTRL (−3.058 at skew 3 / kurtosis 3) is unreachable, because **Pearson's
  inequality** `kurt ≥ skew² + 1` forces `v ≥ (1 − skew·SR/2)² ≥ 0` (a 60 000-histogram search bottoms at
  `v = −2.4e-15`, 20 000 random series violate nothing, MinTRL from measured moments ≥ **2.17**) — the real
  residual is that a **NaN** sharpe returns Infinity and is labelled `beyond-horizon` instead of
  `unavailable`. All three rows are report-level/latent; no golden moves and there is **no fold-back row**;
  `run_all` is now **70 steps, 39 gated, 0 fails**.

* **Fiftieth headline (CYCLE-055): the causal signal family's two headline contracts hold exactly for all 16
  candidates, but the zero-dispersion guard is defeated by floating-point rounding and three other latent
  defects hide in the arithmetic.**
  `analysis/features.js` turns a panel of prices/returns/volumes into the position each arm would hold at bar
  `t`; every strategy the project has evaluated is a weighted combination of its 16 candidates (8
  `SIGNAL_CANDIDATES`, 4 `REVERSAL_CANDIDATES`, 4 `SIGUP_CANDIDATES`). `e63_features_audit.js` (11/11 guards,
  70 ms) finds the **causality** contract exact — for every candidate and every test bar, a strict-future
  perturbation of closes/returns/volumes/panel leaves `positionAt` bit-unchanged (0 mismatches over 16×100
  bars, non-vacuous: all 100 bars non-zero, 77–79 later bars moved) — and the **abstain** contract exact (a
  returns-only view reads 0 on exactly the five channel-dependent candidates; degenerate series stay finite in
  [−1,1]; `clampPosition` exact; all **13** single-feature references exact to 1e-12, with `fracDiffAt` also
  equal to the shipped `labels.js#fractionalDiff(log closes, 0.4, 16)` convolution; the cross-section and the
  regime gate match independent recomputes). **L10-e is SETTLED**: a singular `{close}` series abstains
  (`rangeLocation` NaN, `positionAt` 0) while the plural `{closes}` gives **0.0211625225**. Four latent rows.
  **L10-bs** is the headline: the `std is 0` abstain guard is defeated by rounding — for an exactly-constant
  window the sample mean is **not bit-equal** to the value, so `std = |d|·√(n/(n−1))` is a **denormal
  positive** number the guard cannot reject, and the feature reads `|z| = sqrt((n−1)/n)`
  (**−0.9682458366** n=16, **−0.9842509843** n=32, **−0.9746794345** n=20) instead of 0 — a **0.468–0.492**
  position at saturation 2 from a feature carrying no information (the intended value is exactly 0). It is a
  rounding-boundary effect (where the mean IS bit-exact, e.g. n=8/n=32 on 0.001 and the 0.03125 fixture, the
  guard fires), so the shipped 0.03125 test gives no warning. **L10-bt**: `finiteSum` guards `a < 0` but not
  `b < a`, so an empty window returns **0** where `meanOf` returns **NaN** — momentum/acceleration read a
  plausible 0 for a 0-width window instead of abstaining. **L10-bu**: `networkMomentum`'s self-skip
  `i === panel.streamIndex` never matches when `streamIndex` is absent, silently folding the stream's own
  lagged momentum into its network average (**−0.9066812992** with the field vs **−1.8820447956** without).
  **L10-bv**: `regimeGatedMomentum` scales the crash gate by the **momentum** window's variance, not the gate
  window's, so the threshold is off by **1.309** at 16 vs 32 and the gate fires too rarely in a hot short-term
  regime. All four are latent/export-level; no golden moves and there is **no fold-back row**; `run_all` is now
  **71 steps, 40 gated, 0 fails**.

* **Fifty-first headline (CYCLE-056): the sample-uniqueness reference is exact — and the shipped
  re-implementation matches it bit-for-bit — but its sequential bootstrap weights by the uniqueness *sum*
  rather than the average, so it is length-biased, and it is not the AFML ch.4 algorithm it cites.**
  `analysis/uniqueness.js` is the López de Prado ch.4 reference (average uniqueness, effective sample size,
  sequential bootstrap); it is reference-only (the hot path re-implements average uniqueness in
  `hivemind/training/sample_weights.js#overlapUniqueness`). `e64_uniqueness_audit.js` (8/8 guards, 82 ms)
  verifies `sampleUniqueness` against an **independent per-bar scan-all-spans recompute** to 1e-12
  (`[[0,2],[1,3]]` → **2/3, 2/3**; `[[0,0],[0,5]]` → **1/2, 11/12**) and against the shipped
  `overlapUniqueness` to **exactly 0** (8 fixtures), plus per-label order-invariance and the ESS identities
  (point labels → **n**; `ESS = sum`; `averageUniqueness = ESS/n`; `ESS ≤ n` — 6 overlapping labels read
  **5.5833**). Three latent/test-only rows. **L10-bx** (headline): `sequentialBootstrap` stores
  `avgU[i] = acc` — the **sum** of `1/concurrency` — while the comment says "average" and ch.4 weights by the
  average (which the module itself computes one function above), so the draw is biased toward long labels:
  two **non-overlapping** labels, both maximally unique (average 1.0), are drawn in the ratio of their lengths
  (measured first-draw P(3-bar) **0.7480** vs the intended **0.5000**; a 1/2/3-length fixture reads
  **0.1688/0.3299/0.5014** vs 1/3 each). **L10-by**: the implemented heuristic (static numerator,
  `1/(1+count)` conditioning) is **not** the AFML ch.4 sequential bootstrap — the reference recomputes each
  candidate's average uniqueness *against the current selection* — so on `[[0,1],[0,1],[2,3],[2,3]]` the
  second-draw law is **1/7, 2/7, 2/7, 2/7** vs AFML **1/6, 1/6, 1/3, 1/3** (total-variation gap **0.1190**).
  **L10-bz**: spans are unvalidated (a zero-length span returns NaN and poisons the ESS; a negative-length span
  returns −0). No golden moves and there is **no fold-back row**; `run_all` is now **72 steps, 41 gated,
  0 fails**.

* **Fifty-second headline (CYCLE-057): the stream design layer's resampler, Kish design-effect identities and
  greedy selector are exact — but a zero-variance stream is counted as a full unit of effective breadth, and
  `maxStreams <= 0` means "unlimited".**
  `analysis/streams.js` is the shipped "buying effective independence, not bars" layer (round 26, R26-6):
  `resampleCandles` builds a second bar interval, `designEffectOfStreams` measures the panel's Kish (1965)
  design effect, `selectStreams` greedily orders by marginal effective bars per raw bar, and `analyze.js` prints
  all of it. `e65_streams_audit.js` (9/9 guards, 16 ms) verifies the resampler against a **hand recompute** to
  1e-12 (factors 2/3/4/7 × `keepIncomplete`) with every OHLCV invariant, plus `never mutates`,
  `factor === 1` = shallow copy, partial-group dropping (10 bars / factor 4 → 2 groups, keep → 3; 3 bars → 0/1),
  bad-factor/non-array throws, and the non-finite fallbacks (missing high/low → max/min(open,close); missing
  volume = 1). The design effect satisfies **every** Kish identity (`rawBars = K·T` 720; `DE = 1+(K−1)·rbar`
  2.9458671265; `effectiveBars = rawBars/DE`; `effectiveStreams = K/DE`; `effectiveBarsPerBar = 1/DE`) with
  `rbar` = an independent mean pairwise correlation to 1e-15, plus the closed forms (K = 1 → DE 1; identical
  streams → rbar 1, DE 2/3, effectiveStreams 1; T = min length) and the `fold-sharpe`-iff-tiles rule. The
  selector is deterministic, tie-breaks by label, is monotone, and computes its marginal arithmetic exactly.
  Two latent rows. **L10-ca** (headline): a **zero-variance (constant) stream is skipped from `rbar` but still
  counted in `K` and `rawBars = K·T`** — adding one constant stream leaves `rbar` **bit-identical**
  (−0.0133166822) yet takes `effectiveStreams` **2.0270 → 3.0821** and `rawBars` 480 → 720, so a
  no-information stream buys a full unit of "effective breadth" (while `selectStreams` **does** skip it — the
  two shipped functions disagree about what a stream is). **L10-cb**: `maxStreams <= 0` is treated as
  **unlimited** (`0` and `−3` both select the full greedy set instead of none). Diagnostic-layer/latent; no
  golden moves and there is **no fold-back row**; `run_all` is now **73 steps, 42 gated, 0 fails**.

* **Fifty-third headline (CYCLE-058): the audited evaluation world's shock, candle view and alignment are
  exact — but a missing `streamIndex` makes the cross-sectional look-ahead audit vacuous, and `maxBars <= 0`
  flips the slice.**
  `analysis/world.js` (round 23, N0) is the module that gives `auditNoLookahead` its teeth after a returns-only
  perturbation passed vacuously (BUGS.md #22); it is shipped (`analyze.js`, `fold_worker.js`).
  `e66_world_audit.js` (7/7 guards, 49 ms) verifies `shockFactor`/`volumeShockFactor` are **1** at and before
  `after` and strictly inside `[1, 1+2·probe]` after (probe 0.07 → max 1.14), deterministic, non-uniform and
  phase-shifted (`t=after+2`: price 1.0494 vs volume 1.1369; `probe: 0` a no-op); `shockCandles(null)` is the
  same array, every bar ≤ `after` is the **same object**, every bar > `after` a new one with OHLC × `f(t)` and
  volume × `fv(t)`, the input is never mutated, it is deterministic, the path stays positive and the **shape**
  changes (close ratio 1.0001–1.0993); `makeCandleViewFor` returns the real candles on the base pass and a
  self-consistent tuple on a probe pass (`view.returns === barReturns(view.closes)` exactly) with the past
  bit-unchanged and all 19/19 future bars moved; `worldFromCandles` aligns and keeps the last `maxBars`. Two
  latent rows. **L10-cc** (headline): `panelFor` replaces the panel's own-stream slot only when
  `panel.streamIndex` matches an index — with `streamIndex` **absent** (or out of range) every slot stays the
  unperturbed original while `view.returns` is shocked, so a cross-sectional candidate
  (`sig-reversal-xs`, `sig-network-momentum`) reads its own **unshocked** series and the look-ahead audit is
  **vacuous** (the trap the module exists to close; same root cause as L10-bu, opposite consequence).
  **L10-cd**: `worldFromCandles`' `maxBars` guard treats `0` as **all bars** (falsy) and `−5` as **drop the first
  5** (`slice(-maxBars)`), with a fractional value truncated silently — reachable from `--bars`. Latent; no
  golden moves and there is **no fold-back row**; `run_all` is now **74 steps, 43 gated, 0 fails**.

* **Fifty-fourth headline (CYCLE-059): the order-preserving scheduler's queue contract and failure semantics are
  exact — but `normaliseConcurrency` never validates its `max`, and the fold executor silently nulls a malformed
  `confidence`.**
  `analysis/parallel.js` (round 26, R26-4) is the module the parallel fold loop stands on: run N units with C in
  flight and return the results in **unit order**, so `folds.jsonl` stays byte-identical serial vs parallel; it
  is shipped (`backtest.js`/`walkforward.js`/`analyze.js`/`fold_worker.js`). `e67_parallel_audit.js` (7/7 guards,
  49 ms) verifies `normaliseConcurrency` maps every non-finite/non-positive width to serial 1 and floors/caps
  the rest (`2.9 → 2`; `1e6 → 64`); `scheduleUnits` returns results in **unit order** under an out-of-order
  completion schedule (`2,1,0,5,4,3,6,8,7,9`), calls `exec` exactly once per unit, peaks at exactly the requested
  concurrency, reports through `onResult` out of order with a throwing reporter harmless, rejects with the
  **first** error (`boom-1`, two failures → `e0`), starts no unit past the start window, settles every started
  `exec` (`settled === started`, no dangling promise), propagates a synchronous throw and returns `[]` on empty;
  and `makeFoldExecutor` maps `{positions, confidence, stats}` → `{signals, confidence, stats}`, passes the
  request through verbatim, and throws a named malformed-reply for a null reply or a non-array `positions`. Two
  latent rows. **L10-ce**: `normaliseConcurrency` never validates its `max` cap — `{max: 0}` → **0**,
  `{max: −2}` → **−2**, `{max: 2.5}` → **2.5** (a non-positive/fractional "concurrency"; not reachable via
  `scheduleUnits`, which passes `max = n ≥ 1`). **L10-cf**: `makeFoldExecutor` throws on a bad `positions` but
  **silently nulls** a non-array `confidence` (5, a `Float32Array`) and any falsy `stats` (0, missing), so a
  worker switching to a typed-array confidence would silently lose the R26-3 raw pre-policy confidence the
  turnover experiment is built on. Latent; no golden moves and there is **no fold-back row**; `run_all` is now
  **75 steps, 44 gated, 0 fails**.

* **Fifty-fifth headline (CYCLE-060): the turnover policy grid reproduces the restatement exactly — but its
  `costBps` is dead, its `requireCleanAudit` hurdle is structurally inapplicable, and the default grid is only
  shallowly frozen.**
  `analysis/holding.js` (round 26, R26-5) is the **turnover attack**: it restates the journaled raw pre-policy
  confidence under a dead-zone × scale × entry/exit-hysteresis × minimum-holding grid and, per (candidate,
  policy), reports turnover / gross / break-even / Sharpe plus a full promotion decision; it is shipped
  (`analyze.js` runs it as `runTurnoverSweep` behind `--turnover-sweep`). `e68_holding_audit.js` (8/8 guards,
  45 ms) verifies the grid is the cartesian product (`3×1×3` → 9 policies, 18 rows for two candidates; each
  policy `{...holding, deadZone, scale}`), that every row equals a direct `restateReportAtPolicy(candidate,
  policy)` recompute to **1e-9**, that rows are non-increasing in break-even with a missing value last, that
  `byId.best`/`bestPromoting`/`bestTurnoverPolicy` behave (promoting preferred; `null` for an unknown id), that
  the two bail-outs return `available:false`, and that `formatTurnoverSweep` renders the ids and the target.
  Three latent rows. **L10-cg**: `turnoverSweep` accepts and echoes `costBps` but **never threads it into
  `restateReportAtPolicy`**, so every `netSharpe`/`dsr` and every promotion decision is at **zero cost** —
  `{costBps: 0}` and `{costBps: 25}` rows are byte-identical apart from the echo (both `netSharpe`
  **0.6864950785702724** at dz 0.1) while a direct restatement at 25 bps reads **−3.156645069841796** (the
  shipped caller passes `--cost-bps`). **L10-ch**: the `requireCleanAudit` hurdle is **structurally
  inapplicable** because `restateReportAtPolicy` drops the `audit` block (unlike its sibling
  `restateReportAtCost`), so a candidate that **failed the run's look-ahead audit** still promotes. **L10-ci**:
  `DEFAULT_TURNOVER_GRID` is only **shallowly** frozen (`Object.isFrozen(deadZones)` false), so
  `deadZones.push(0.9)` takes the default sweep 48 → 54 policies. Latent; no golden moves and there is **no
  fold-back row**; `run_all` is now **76 steps, 45 gated, 0 fails**.

* **Fifty-sixth headline (CYCLE-061): the seed-replication layer's IQM, stratified bootstrap, variance split and
  CRN criterion are exact — but the "IQM" is not the cited Agarwal estimator, and the formatter can mislabel its
  own CI.**
  `analysis/replication.js` (round 26, R26-13) is the honest-summary layer behind `--seeds` (a single-seed
  ordering is not a ranking), shipped via `analyze.js` → `replication.json`. `e69_replication_audit.js` (8/8
  guards, 359 ms) verifies `interquartileMean` is the rank-slice middle on every hand case (`[1,2,3,4]` → 2.5,
  `[1..8]` → 4.5, `[]` → NaN, `<4` → plain mean, non-finite filtered); `stratifiedBootstrapCI` is deterministic
  per seed, preserves each stratum size in every replicate (a probe statistic returns the sample length),
  `lo ≤ median ≤ hi`, abstaining on empty/all-non-finite; its coverage of a known mean is **0.92** (400 panels,
  nominal 0.95); `varianceComponents` satisfies `total = between + within + residual` with fractions summing to 1
  in the pure-between / pure-within / repeated-cell / mixed panels; `pairedVarianceRatio` is exactly
  `var(paired)/var(unpaired)` with `reduction = 1 − ratio`; and `seedDistribution`/`formatSeedReplication` carry
  the documented fields. Two latent rows. **L10-cj**: the **IQM** drops `floor(n/4)` by **rank**, not a quarter
  of the **mass** — witness `[0,0,5,10]` reads **2.5** vs the cited Agarwal et al. / `rliable` quantile-filter
  **1.6667**, and **149/300** right-skewed panels differ (max gap **1.016**). **L10-ck**: `formatSeedReplication`
  prints its **own** `alpha` in the CI label, never `dist.ci.alpha`, so a distribution built at `alpha = 0.10` is
  printed as **`95%CI`** (bounds the 90 % ones). Latent; no golden moves and there is **no fold-back row**;
  `run_all` is now **77 steps, 46 gated, 0 fails**.

* **Fifty-seventh headline (CYCLE-062): the cluster-inference module's correlations, jackknife, Student-t tails
  and exact sign test are exact — but the stability flag drops half its own rule, and the sign test underflows.**
  `analysis/dependence.js` (round 25) is the delete-one-cluster jackknife behind the pooled cross-stream Sharpe SE
  (the 8 majors' per-fold Sharpe series correlate 0.41–0.52, so the Lo i.i.d. SE understates); it is pure and
  imports nothing, and is shipped via `walkforward.js#promoteDecision`. `e70_dependence_audit.js` (10/10 guards,
  47 ms) verifies `pearsonCorrelation`/`meanPairwiseCorrelation` are the textbook formulas with the documented NaN
  guards; the equicorrelation deff/effective size are `1+(K−1)ρ` and `K/deff`; `foldWindowClusters` groups exactly
  and throws on a bad panel; `clusterJackknife` reproduces a hand jackknife (estimate 3.5, leave-one-out
  [4.5,3.5,2.5], se √(4/3)); `studentTPValue`/`regularizedIncompleteBeta` reproduce the exact df = 1 (Cauchy) and
  df = 2 closed forms and `studentTCritical` inverts them (1.68957 / 2.03011 at df = 35); `signTest` is the exact
  binomial tail (7/10 → 0.171875); and the paired cluster tests carry the documented fields. Two latent rows.
  **L10-cl**: `clusterStability.stable` omits the `worstDelta > minDelta` half of its own documented rule —
  witness fractionPositive **0.6667**, worstDelta **−0.5**, `stable: true` where the doc rule says false (the two
  coincide only at the shipped `minFraction = 1`). **L10-cm**: `signTest`'s `0.5ⁿ` pmf start underflows for
  `n ≥ ~1075`, so `{wins: 1000, n: 2000}`, `{wins: 1, n: 2000}` and `{wins: 2000, n: 2000}` all read **pValue 0**
  (a balanced 2 000-cluster test reading "certainly significant"). Latent; no golden moves and there is **no
  fold-back row**; `run_all` is now **78 steps, 47 gated, 0 fails**.

* **Fifty-eighth headline (CYCLE-063): the decision-grade report's concentration, persistence, power and
  promotion blocks are exact — but `restateReportAtPolicy` carries a stale `foldInputs`, so a policy-restated
  report mixes two position-series bases.** `analysis/decision.js` (round 26, R26-8) is the SHIPPED six-block
  report (`analyze.js` composes it behind `--decision`); it computes no new strategy statistic and is pure.
  `e71_decision_audit.js` (10/10 guards, 34 ms) verifies `foldConcentration` reproduces a direct
  `strategyReturns`+`sharpeRatio` recompute to 1e-12 (top-K shares, signed sums, delete-one-cluster range,
  per-fold marginals; a non-positive gross total gives null shares) and abstains explicitly;
  `confidencePersistence` is the pooled within-fold lag-1 (0.666707822740828) and `ln 0.5/ln ρ` half-life with
  no cross-fold pairs; `pairedUnitsNeeded` returns the smallest cluster count whose one-sided cluster-t resolves
  the target (9 observed / 18 at 80 % power; brute-force agreement) with `reference.pairedMde95 =
  tCritical(C−1,α)·se`; all six `cheapestFlip` kinds fire; `promotionAcrossCadences` is majority-pass +
  catastrophic veto; and the six-block `decisionReport` carries the explicit-na discipline. One latent row.
  **L10-cn**: `restateReportAtPolicy` replaces `folds` with restated-position metrics but carries the original
  `foldInputs`, so a policy-restated report handed to `foldConcentration` mixes the two (restated net Sharpe
  **−5.201698358740081** vs the carried-signal Sharpe **−3.5204429235768973**); the shipped `--decision` path
  restates at cost only (both halves agree at **−3.877740023296727**), so it is latent/export-level. Latent; no
  golden moves and there is **no fold-back row**; `run_all` is now **79 steps, 48 gated, 0 fails**. No pure,
  lab-consumed analysis module remains un-audited.

* **Fifty-ninth headline (CYCLE-064): the hivemind numeric kernels are exact on the finite path — but a
  non-finite guard kills the `+∞` activation, a `|| 1` family replaces a legitimate zero, and the vector helpers
  disagree on a length mismatch.** The five pure kernel bags under `hivemind/kernels/` (`activations`, `linalg`,
  `normalization`, `sampling`, `statistics`) are SHIPPED (`gradients.js` and `transformer/*`, installed on
  `HiveMind.prototype`). `e72_hivemind_kernels_audit.js` (11/11 guards, 18 ms) confirms the finite path is exact
  (silu/sigmoid/softmax, the linalg helpers, RMSNorm/RoPE, the Irwin-Hall normal, the Dirichlet sampler, the
  documented MAD proxy, EMA, conformity, the percentile/threshold helpers, the gradient/spectral norms and the
  stateful detectors). Four latent rows. **L10-co**: `_sigmoid`/`_silu` map `+Infinity` to **0** (the
  `isFiniteNumber` guard short-circuits the `±100` clamp, so a maximally-positive logit reads as probability 0;
  `_sigmoid(±100)` = 1 / 3.7e-44). **L10-cp**: the falsy-zero family — `_computeGradientNorm` and
  `_computeSpectralNorm` return **1** for the zero vector/matrix and `_computePercentile` returns **1.0** for a
  genuine 0. **L10-cq**: the vector helpers disagree on a length mismatch (`_fastVectorDot` → NaN, `_vectorDot`
  → 0, `_fastVectorAdd` → a copy of `a`). **L10-cr**: two dead clamps (`_computeDualEMA` 0.8,
  `_computeNTKStability` −0.1) and `_computeFractalDimension` an ad-hoc clamped dispersion (a constant series
  reads the maximum 2), not a fractal dimension. All latent; no golden moves and there is **no fold-back row**;
  `run_all` is now **80 steps, 49 gated, 0 fails**. This is the first audit outside `analysis/`.

* **Sixtieth headline (CYCLE-066): the REPO's V2 sleeve layer reproduces every published book bit-for-bit — and
  the port exposed that the lab's own shells disagree about the book grid.** With round 31 moving the project's
  edge from the (inert) learned layer to the lab's structural sleeves, `docs/ARCHITECTURE-v2.md` /
  `docs/MIGRATION-V2.md` ported the shared book arithmetic and the three pinned specs into the repo
  (`src/core/primitives/*`, `src/plugins/sleeves/*`). `e73_port_verify.js` (registered; 10/10 checks — the three books **plus** a 250-trial seeded differential fuzz of every ported primitive against the lab module it came from) imports the
  repo modules **read-only**, rebuilds the lab's real 8-symbol / 6 557-period carry panel, and drives each
  sleeve through its `signal()`/`returns()`: all three books come back **bit-for-bit** — R8
  `6.18 / 10× / 46.04` (= `e30`), R7 `1.07 / 8× / 182.59` (= `e32`), OI `0.92 / 198× / 15.22` (= `e50`) — and
  the repo `cleanBook` is fingerprint-identical to `prototypes/port.js`. One new row, **L10-ct**: `buildXsSeries`
  returns two time arrays (`times` = 6557; `legs.times` = 6558) and the two construction shells read different
  ones (`e17#buildBook` → 6557 rows; `e21#xsBookImpl` → 6556), so the book grid is a parameter, not a
  convention — the V2 primitives take it as an explicit `n`. Read-only on the repo; no number moves and there is
  **no fold-back row** (the verification *is* the R7/R8 port evidence); `run_all` is now **81 steps, 50 gated,
  0 fails**.

## How to run

See `RUNNER.md`. On a machine with Node (≥ 22), run an experiment directly with
`node src/NeuLegion-lab/run_lab.mjs <experiment.js>` (e.g. `e73_port_verify.js`, or `run_all.js` to
regenerate every artefact); the runner wires `globalThis.__fs` to `node:fs` and exits non-zero on a
failed verdict. In the no-Node workspace, every experiment runs through the repo's browser harness from
`execute_js` (esbuild-wasm bundles the lab file + its repo imports into an ES module). `run_all.js` regenerates
every artefact in **~8–25 min** from one code revision (**81 steps**; dominated by `e0d`'s
`poolReports`, 140–610 s depending on machine load, with `e26` adding ~4.5 min) and reports the control
(`e0c`, `e5`), integrity (`e14`, now **14 checks**) and validation (`e25`, `e28`, `e29`, `e30`, `e31`, `e32`, `e33`, `e34`,
`e35`, `e36`, `e37`, `e38`, `e39`, `e40`, `e41`, `e42`, `e43`, `e44`, `e45`, `e46`, `e47`, `e48`, `e49`, `e50`, `e51`, `e52`, `e53`, `e54`, `e55`, `e56`, `e57`, `e58`, `e59`, `e60`, `e61`, `e62`, `e63`, `e64`, `e65`, `e66`, `e67`, `e68`, `e69`, `e70`, `e71`, `e72`, `e73`) verdicts
(**50 gated**; `e56`/`e57` did not expose a `validationPass` before CYCLE-050, so two validation steps were
reported but ungated).

## Method

See `PROTOCOL.md`. The five non-negotiables: **controls first** (F-11), **out-of-sample or it did
not happen** (F-09), **the repo's arithmetic, not the lab's**, **bar labels are open times** (the
F-11 look-ahead), and **two data sources joined is two bugs until a test says otherwise** (F-18 —
`e14_data_integrity.js` is that test, and it runs on every regeneration).
