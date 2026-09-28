// E60 - THE SUCCESSIVE-HALVING RACING ENGINE, AUDITED AGAINST ITS OWN STATED CORRECTNESS REQUIREMENT AND A
// BUDGET-EXPENDITURE MODEL. CYCLE-052 (L10-bg ...).
//
// `analysis/race.js` (round 26, R26-15) is the family-search racing engine (Jamieson & Talwalkar 2016;
// Li et al. 2018): every arm is scored at the cheapest rung, only the top 1/eta survive to a budget eta
// times larger, and the race stops when one arm remains. The shipped `analyze` driver deliberately has NO
// `--race` flag (the gate is closed), so the module is ENGINE-ONLY / test-only - but its own docstring and
// `docs/LOCKED.md` make a strong correctness claim that is worth testing while it is still cheap to do so.
//
// PRE-REGISTERED READ. PASSES if (i) `halvingRounds`/`halvingSchedule` are the documented closed forms
// (the round count for eta=3/eta=2, `keep = max(1, ceil(survivors/eta))`, the earliest rung at
// `maxBudget/eta^(rounds-1)`, the top rung at exactly `maxBudget` when every round runs, an early stop once
// one arm remains, and the guard arms for eta <= 1 / minBudget > maxBudget / non-numeric inputs);
// (ii) `successiveHalving` is evaluator-agnostic (sync and async), deterministic, scores the full rung in
// arm order, keeps exactly the top `keep` finite arms, eliminates a non-finite evaluation rather than
// ranking it, honours `maximize:false`, reports the full per-rung table (`scored`/`survivors`/`lost`/
// `nonFinite`/`survivorIds`), reconstructs both cost counters (`evaluated`, budget-weighted `spentBudget`
// vs `gridBudget`), refuses an empty arm list / a missing evaluator / a bad `maxBudget`, and renders via
// `formatRace`. The DEFECTS - the module's stated correctness requirement (a racing budget must not change
// the decided set), the budget-saving framing, the small-eta rung collapse and the unvalidated eta/minBudget
// arms - are reported in `findings`, where the claim is tested against a budget-DEPENDENT evaluator (the
// SHA premise) rather than the budget-order-preserving fixture the repo test uses.

import { halvingRounds, halvingSchedule, successiveHalving, formatRace } from '../../NeuLegion-master/NeuLegion-master/src/analysis/race.js';

// ---- deterministic helpers -----------------------------------------------------------------------------
function repoRng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gauss(r) { let u = 0; let v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const mkArms = (n = 9) => Array.from({ length: n }, (_, i) => ({ id: 'a' + i, q: 3.0 - 0.4 * i }));
const ampEval = (arm, budget) => arm.q + (arm.q > 0 ? 0.05 : -0.05) / budget;

export async function run() {
    const checks = {};

    // ============================== A. halvingRounds ==================================================
    checks.roundsClosedForm = halvingRounds({ maxBudget: 9, minBudget: 1, eta: 3 }) === 3
        && halvingRounds({ maxBudget: 9, minBudget: 1, eta: 2 }) === 4
        && halvingRounds({ maxBudget: 27, minBudget: 1, eta: 3 }) === 4
        && halvingRounds({ maxBudget: 3, minBudget: 1, eta: 3 }) === 2
        && halvingRounds({ maxBudget: 2, minBudget: 1, eta: 3 }) === 1
        && halvingRounds({ maxBudget: 9, minBudget: 9, eta: 3 }) === 1;
    checks.roundsGuards = halvingRounds({ maxBudget: 9, minBudget: 1, eta: 1 }) === 0
        && halvingRounds({ maxBudget: 9, minBudget: 1, eta: 0.5 }) === 0
        && halvingRounds({ maxBudget: 9, minBudget: 100, eta: 3 }) === 0
        && halvingRounds({ maxBudget: 9, eta: NaN }) === 0
        && halvingRounds({}) === 0;

    // ============================== B. halvingSchedule ================================================
    const sch925 = halvingSchedule({ arms: mkArms(9), maxBudget: 9, eta: 3 });
    checks.scheduleExactFixture = sch925.length === 2
        && sch925[0].budget === 1 && sch925[0].arms === 9 && sch925[0].keep === 3
        && sch925[1].budget === 3 && sch925[1].arms === 3 && sch925[1].keep === 1;
    // keep = max(1, ceil(survivors/eta)) at every rung, the first rung is full width, the budgets are
    // monotone, the rung count never exceeds `halvingRounds`, and the top rung reaches exactly maxBudget
    // when every round runs.
    const schRows = [];
    let schedOk = true;
    for (const [n, B, eta] of [[9, 9, 2], [100, 27, 3], [16, 4, 2], [9, 27, 3], [3, 9, 3]]) {
        const s = halvingSchedule({ arms: mkArms(n), maxBudget: B, eta });
        const rounds = halvingRounds({ maxBudget: B, minBudget: 1, eta });
        const budgets = s.map((x) => x.budget);
        const keeps = s.map((x) => x.keep);
        const survivorsWalk = [n];
        for (let i = 0; i < keeps.length; i++) survivorsWalk.push(Math.max(1, Math.ceil(survivorsWalk[i] / eta)));
        let kOk = s[0].arms === n;
        for (let i = 0; i < s.length; i++) if (s[i].keep !== keeps[i] || s[i].arms !== survivorsWalk[i]) kOk = false;
        let mono = true;
        for (let i = 1; i < budgets.length; i++) if (budgets[i] < budgets[i - 1]) mono = false;
        const full = s.length === rounds;
        const topOk = full ? budgets[budgets.length - 1] === B : true;
        if (!(kOk && mono && topOk && s.length <= rounds)) schedOk = false;
        schRows.push({ n, B, eta, rounds, roundsUsed: s.length, budgets, keeps, fullRounds: full, topEqualsMax: budgets[budgets.length - 1] === B });
    }
    checks.scheduleGeneralForms = schedOk;

    // ============================== C. successiveHalving contracts ====================================
    const race = await successiveHalving({ arms: mkArms(9), evaluate: ampEval, maxBudget: 9, eta: 3 });
    checks.raceFixture = race.available && race.winnerId === 'a0' && race.evaluated === 12
        && race.spentBudget === 18 && race.gridBudget === 81 && race.fullGrid === 9
        && race.rounds[0].scored.length === 9 && race.rounds[0].survivorIds.join(',') === 'a0,a1,a2'
        && race.rounds[0].lostIds.length === 6 && race.rounds[0].nonFinite.length === 0
        && race.rounds[1].budget === 3 && race.winner && race.winner.id === 'a0';
    checks.raceScoredIsFullRungInArmOrder = race.rounds[0].scored.map((s) => s.id).join(',') === mkArms(9).map((a) => a.id).join(',')
        && race.rounds[0].scored.every((s, i) => s.arm === mkArms(9)[i] || s.id === mkArms(9)[i].id);
    checks.raceNonFiniteEliminated = (() => {
        return successiveHalving({ arms: mkArms(9), maxBudget: 9, eta: 3, evaluate: (a, b) => (a.id === 'a0' ? NaN : ampEval(a, b)) })
            .then((r) => r.available && r.winnerId === 'a1' && r.rounds[0].nonFinite.includes('a0')
                && !r.rounds[0].lostIds.includes('a0') && !r.rounds[0].survivorIds.includes('a0'));
    })();
    checks.raceMinimize = (async () => {
        const m = await successiveHalving({ arms: mkArms(9), evaluate: (a) => a.q, maxBudget: 9, eta: 3, maximize: false });
        return m.winnerId === 'a8' && m.rounds[0].survivorIds.join(',') === 'a8,a7,a6' && m.maximize === false;
    })();
    checks.raceDeterministicAndAsync = (async () => {
        const a1 = await successiveHalving({ arms: mkArms(9), evaluate: ampEval, maxBudget: 9, eta: 3 });
        const a2 = await successiveHalving({ arms: mkArms(9), evaluate: ampEval, maxBudget: 9, eta: 3 });
        const a3 = await successiveHalving({ arms: mkArms(9), evaluate: async (arm, budget) => { await Promise.resolve(); return ampEval(arm, budget); }, maxBudget: 9, eta: 3 });
        return JSON.stringify(a1) === JSON.stringify(a2) && a3.winnerId === a1.winnerId
            && JSON.stringify(a3.rounds) === JSON.stringify(a1.rounds) && a3.spentBudget === a1.spentBudget;
    })();
    checks.raceTiesAreStable = (async () => {
        const t = await successiveHalving({ arms: [{ id: 'x', q: 1 }, { id: 'y', q: 1 }, { id: 'z', q: 1 }], evaluate: (a) => a.q, maxBudget: 1, eta: 3 });
        return t.winnerId === 'x' && t.rounds[0].survivorIds.join(',') === 'x';
    })();
    checks.raceCostCounters = (() => {
        const spent = race.rounds.reduce((a, r) => a + r.budget * r.scored.length, 0);
        const evald = race.rounds.reduce((a, r) => a + r.scored.length, 0);
        return race.spentBudget === spent && race.evaluated === evald && race.survivorEvaluations === race.rounds.reduce((a, r) => a + r.survivors.length, 0)
            && race.gridBudget === 9 * 9 && race.spentBudget < race.gridBudget;
    })();
    checks.raceGuards = (async () => {
        const a = await successiveHalving({ arms: [], evaluate: ampEval });
        const b = await successiveHalving({ arms: mkArms(9), maxBudget: 9 });
        const c = await successiveHalving({ arms: mkArms(9), evaluate: ampEval, maxBudget: NaN });
        const d = await successiveHalving({ arms: mkArms(9), evaluate: ampEval, maxBudget: 0 });
        return a.available === false && b.available === false && c.available === false && d.available === false
            && typeof a.reason === 'string' && typeof b.reason === 'string';
    })();
    checks.formatRaceRenders = formatRace(race) === 'race: winner=a0 rungs=1x9 -> 3x3 evals=12/9 arms'
        && formatRace(null) === 'race: unavailable (none)'
        && formatRace({ available: false, reason: 'x' }) === 'race: unavailable (x)'
        && formatRace({ available: true, winnerId: 'w', rounds: [], fullGrid: 1, evaluated: 0 }).includes('winner=w');
    checks.raceSingleArm = (async () => {
        const one = await successiveHalving({ arms: [{ id: 'solo', q: 1 }], evaluate: ampEval, maxBudget: 9, eta: 3 });
        return one.available && one.winnerId === 'solo' && one.rounds.length === 0 && one.evaluated === 0
            && one.spentBudget === 0 && one.gridBudget === 9;
    })();
    checks.raceEvaluatesScheduleBudgets = (async () => {
        const seen = [];
        const arms = mkArms(9);
        await successiveHalving({ arms, maxBudget: 9, eta: 3, evaluate: (arm, budget) => { seen.push(budget); return ampEval(arm, budget); } });
        const expected = [1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3];
        return JSON.stringify(seen) === JSON.stringify(expected);
    })();
    checks.raceDefaultsEta = (async () => {
        const d = await successiveHalving({ arms: mkArms(9), evaluate: ampEval, maxBudget: 9 });
        const e = await successiveHalving({ arms: mkArms(9), evaluate: ampEval, maxBudget: 9, eta: 3 });
        return JSON.stringify(d) === JSON.stringify(e);
    })();
    checks.raceLostIsFiniteArmsBeyondKeep = race.rounds.every((r) =>
        r.lostIds.length === r.scored.filter((s) => s.score != null).length - r.keep
        && r.lostIds.every((id) => !r.survivorIds.includes(id))
        && r.scored.length === r.survivorIds.length + r.lostIds.length + r.nonFinite.length);
    checks.costIdentitiesAcrossGrid = (async () => {
        for (const [n, B, eta] of [[9, 9, 3], [9, 4, 2], [9, 3, 2], [9, 2, 2], [16, 2, 2], [100, 10, 1.1]]) {
            const r2 = await successiveHalving({ arms: mkArms(n), evaluate: (a) => a.q, maxBudget: B, eta });
            const spent = r2.rounds.reduce((a, r) => a + r.budget * r.scored.length, 0);
            const evald = r2.rounds.reduce((a, r) => a + r.scored.length, 0);
            if (r2.spentBudget !== spent || r2.evaluated !== evald || r2.gridBudget !== n * Math.round(B)) return false;
            if (r2.survivorEvaluations !== r2.rounds.reduce((a, r) => a + r.survivors.length, 0)) return false;
        }
        return true;
    })();

    // ============================== findings =========================================================
    // (1) The repo test's "full-grid oracle" fixture ranks arms identically at every budget, so the
    // agreement is a tautology; with a budget-DEPENDENT evaluator (the SHA premise: a low budget is
    // noisier) the race eliminates the true best, and the top rung the fixture actually reaches is 3, not 9.
    const rankAt = (b) => mkArms(9).map((a) => ({ id: a.id, v: ampEval(a, b) })).sort((x, y) => y.v - x.v).map((x) => x.id);
    const fixtureTautology = { topRung: race.rounds[race.rounds.length - 1].budget, maxBudget: 9, schedule: sch925.map((s) => s.budget), rankBudget1EqualsRankBudget9: JSON.stringify(rankAt(1)) === JSON.stringify(rankAt(9)), winner: race.winnerId, oracleAtMaxBudget: rankAt(9)[0] };
    const wArms = Array.from({ length: 8 }, (_, i) => ({ id: 'early' + i, low: 3 - 0.1 * i, high: 0.5 - 0.01 * i }));
    wArms.push({ id: 'late', low: 0.0, high: 4.0 });
    const wEval = (arm, budget) => (budget < 9 ? arm.low : arm.high);
    const wRace = await successiveHalving({ arms: wArms, evaluate: wEval, maxBudget: 9, eta: 3 });
    const wOracle = wArms.map((a) => ({ id: a.id, v: wEval(a, 9) })).sort((x, y) => y.v - x.v)[0].id;
    const witness = { raceWinner: wRace.winnerId, gridOracle: wOracle, agree: wRace.winnerId === wOracle, eliminatedAtRung0: wRace.rounds[0].lostIds, rungBudgets: wRace.rounds.map((r) => r.budget) };
    // ensemble: true quality = the top-budget score; the low-budget score is that plus 1/sqrt(budget) noise
    const disagreement = [];
    for (const [eta, B] of [[3, 27], [3, 9], [3, 3], [2, 16]]) {
        let dis = 0; const R = 120;
        for (let r = 0; r < R; r++) {
            const rr = repoRng(31000 + 7 * eta + r); const K = 16;
            const q = Array.from({ length: K }, () => Math.abs(gauss(rr)));
            const arms = q.map((v, i) => ({ id: 'm' + i, q: v }));
            const race2 = await successiveHalving({ arms, maxBudget: B, eta, evaluate: (arm, budget) => arm.q + gauss(rr) * (2 / Math.sqrt(budget)) });
            let best = 0; for (let i = 1; i < K; i++) if (q[i] > q[best]) best = i;
            if (race2.winnerId !== 'm' + best) dis++;
        }
        disagreement.push({ eta, maxBudget: B, K: 16, reps: R, disagreeRate: dis / R });
    }
    const findingDecidedSet = {
        claim: 'the race winner equals the full-grid oracle (a racing budget does not change the decided set)',
        fixtureIsTautological: fixtureTautology,
        witness,
        ensemble: disagreement,
        note: 'successive halving is a best-arm-identification HEURISTIC, not an exact selector: eliminating all but the top 1/eta at a cheap rung can and does discard the arm that is best at the full budget. The repo test passes only because its fixture scores arms in a budget-independent order, and because its top rung (3) is below maxBudget (9), so its oracle is evaluated at a budget the race never visits.',
    };

    // (2) The budget-saving identity is not universal: the race can spend MORE than the grid it replaces.
    const cost = [];
    for (const [n, B, eta] of [[9, 9, 3], [9, 4, 2], [9, 3, 2], [9, 2, 2], [16, 2, 2], [100, 10, 1.1]]) {
        const r2 = await successiveHalving({ arms: mkArms(n), evaluate: (a) => a.q, maxBudget: B, eta });
        cost.push({ n, B, eta, spentBudget: r2.spentBudget, gridBudget: r2.gridBudget, ratio: +(r2.spentBudget / r2.gridBudget).toFixed(3), rungBudgets: r2.rounds.map((r) => r.budget) });
    }
    const findingCost = {
        claim: 'the search cost is O(arms) at the cheapest rung instead of O(arms) at the full budget / spentBudget < gridBudget',
        rows: cost,
        inversions: cost.filter((c) => c.spentBudget > c.gridBudget),
        note: 'when the budget ratio maxBudget/minBudget is small relative to the round count, the early full-width rungs dominate and the race costs more than the grid. The repo test uses 9 arms at maxBudget 9, eta 3 (ratio 0.222), the one regime where the saving is large.',
    };

    // (3) halvingSchedule rounds every rung to an integer, so a small eta collapses consecutive rungs to the
    // SAME budget (the docstring's "a budget eta times larger" is then false and the extra rungs buy nothing).
    const etaSmall = [];
    for (const eta of [1.1, 1.2, 1.5, 2]) {
        const s = halvingSchedule({ arms: mkArms(100), maxBudget: 10, eta });
        const b = s.map((x) => x.budget);
        let rep = 0; for (let i = 1; i < b.length; i++) if (b[i] === b[i - 1]) rep++;
        const r2 = await successiveHalving({ arms: mkArms(100), evaluate: (a) => a.q, maxBudget: 10, eta });
        etaSmall.push({ eta, rounds: s.length, repeatedConsecutiveBudgets: rep, budgets: b, spentBudget: r2.spentBudget, gridBudget: r2.gridBudget, costRatio: +(r2.spentBudget / r2.gridBudget).toFixed(3) });
    }
    const findingEtaSmall = {
        claim: 'a budget eta times larger / the freed budget is reallocated',
        rows: etaSmall,
        collapsed: etaSmall.filter((r) => r.repeatedConsecutiveBudgets > 0),
        note: 'the schedule multiplies an UNROUNDED budget by eta but stores and evaluates Math.round(budget); for a small eta (or a small budget) round(budget) is unchanged across several rungs, so those rungs re-score the survivors at the same budget.',
    };

    // (4) eta and minBudget are not validated: an invalid race reports available:true with winner null.
    const bad = {};
    for (const [k, opts] of Object.entries({ etaOne: { eta: 1 }, etaHalf: { eta: 0.5 }, minGtMax: { minBudget: 100 }, etaZero: { eta: 0 } })) {
        const r2 = await successiveHalving({ arms: mkArms(9), evaluate: ampEval, maxBudget: 9, ...opts });
        bad[k] = { available: r2.available, winnerId: r2.winnerId, winner: r2.winner, rounds: Array.isArray(r2.rounds) ? r2.rounds.length : null, evaluated: r2.evaluated, spentBudget: r2.spentBudget, gridBudget: r2.gridBudget, reason: r2.reason };
    }
    const findingUnvalidated = {
        claim: 'the engine refuses an invalid configuration (it validates arms, evaluate and maxBudget)',
        observed: bad,
        note: 'halvingRounds itself guards eta <= 1 and minBudget > maxBudget (returns 0 rounds), but successiveHalving does not check its own eta/minBudget: the schedule is empty, no arm is ever evaluated, and the result is available:true with winner null and winnerId null - a silent degenerate success rather than available:false.',
    };

    // ============================== verdict ==========================================================
    const resolved = {};
    for (const [k, v] of Object.entries(checks)) resolved[k] = await v;
    const validationPass = Object.values(resolved).every((x) => x === true);
    const failed = Object.entries(resolved).filter(([, v]) => v !== true).map(([k]) => k);
    const verdict = {
        note: 'L10-bg..: `race.js` is the successive-halving family-search ENGINE, and the shipped `analyze` driver deliberately has no `--race` flag (the R26-15 gate is closed), so it is test-only (the `locks.test.js` export pin and §AM are its only callers). PASSES the pre-registered read: `halvingRounds` is the documented closed form for eta=3/eta=2 and returns 0 for eta<=1 / minBudget>maxBudget / non-numeric input; `halvingSchedule` keeps `max(1, ceil(survivors/eta))`, starts at `maxBudget/eta^(rounds-1)`, reaches exactly `maxBudget` when every round runs, is monotone in the budget and stops once one arm remains; `successiveHalving` scores the full rung in arm order, keeps the top `keep` finite arms, eliminates a non-finite evaluation (`nonFinite`, never ranked), honours `maximize:false`, is deterministic and works with an async evaluator, reports the full per-rung table and both cost counters, refuses an empty arm list / missing evaluator / bad `maxBudget`, and `formatRace` renders the winner/rungs/evaluation count. FINDINGS: (1) the claimed correctness requirement - the race winner equals the full-grid oracle, i.e. a racing budget does not change the decided set - is only true because the repo test\'s fixture scores arms in a BUDGET-INDEPENDENT order (`rank(b=1) == rank(b=9)`), and because its top rung is 3 while the "oracle" is evaluated at 9; on a budget-dependent evaluator (the SHA premise that a cheap rung is noisier) the race eliminates the true best at rung 0 and disagrees with the top-budget oracle on **0.617-0.70** of seeded fixtures; (2) the budget-saving claim is not universal - the race spends MORE than the grid when the budget ratio is small relative to the round count (`spentBudget/gridBudget` = **1.056** at (9 arms, B=2, eta=2), **1.222** at (9, 3, 2), **1.00** at (16, 2, 2) and **2.89** at (100, 10, eta=1.1)); (3) the same integer rounding collapses consecutive rungs to the SAME budget for a small eta (eta=1.1, B=10, 100 arms: **15** repeated consecutive budgets, 25 rungs), so the "budget eta times larger" framing and the reallocation story fail in that regime; (4) `successiveHalving` does not validate eta/minBudget, so eta=1, eta=0.5, eta=0 and minBudget>maxBudget all return `available:true` with `winner:null` after scoring nothing (a silent degenerate success). Scope: engine-only / test-only (no shipped importer; the `--race` driver is gated).',
        checks: resolved,
        validationPass,
        failed,
        findings: {
            decidedSetClaim: findingDecidedSet,
            budgetSavingNotUniversal: findingCost,
            smallEtaRungCollapse: findingEtaSmall,
            unvalidatedEtaAndMinBudget: findingUnvalidated,
        },
        scope: { shipped: [], testOnly: ['halvingRounds', 'halvingSchedule', 'successiveHalving', 'formatRace'], why: 'the shipped analyze driver deliberately exposes no --race flag (R26-15 is gated on an economics/diversity win, RUN-ANALYSIS.md §7 measured neither); only analysis.test.js §AM and locks.test.js import the module' },
    };
    return {
        config: { scheduleGrid: schRows.map((r) => [r.n, r.B, r.eta]), costGrid: cost.map((c) => [c.n, c.B, c.eta]), etaGrid: etaSmall.map((e) => e.eta), ensemble: disagreement.map((d) => [d.eta, d.maxBudget]) },
        rows: { schedule: schRows, race: { winner: race.winnerId, evaluated: race.evaluated, spentBudget: race.spentBudget, gridBudget: race.gridBudget, rungs: race.rounds.map((r) => ({ budget: r.budget, scored: r.scored.length, keep: r.keep, survivors: r.survivorIds })) }, cost },
        validation: resolved,
        verdict,
    };
}
