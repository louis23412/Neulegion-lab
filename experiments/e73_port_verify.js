// E73 - THE PORT VERIFICATION: does the REPO's V2 sleeve layer reproduce the lab's books?
//
// CYCLE-046. `e52_port_artefact.js` (F-60) validated the lab's shared book post-processor
// (`prototypes/port.js`) against five stored books. The V2 port moved that chain and the
// three pinned sleeve specs into the repo (`src/core/primitives/*`,
// `src/plugins/sleeves/*`), so the lab's numbers are only a statement about the repo's code
// if the REPO modules, run on the lab's real data, reproduce those same books. That is what
// this experiment measures. It is the G2 evidence (`docs/MIGRATION-V2.md` §1) and it is
// read-only on the repo: it IMPORTS the repo modules, it never edits them.
//
// PRE-REGISTERED READ. PASS iff, for all three sleeves:
//   (1) the repo sleeve's weight rows are EXACTLY the lab book's rows (bit-for-bit);
//   (2) the repo's cap/band chain equals the lab's `port.js` chain on the real rows;
//   (3) the repo book's metrics reproduce the stored numbers to display precision
//       (net@4 within 0.02, turnover within 1/yr, break-even within 0.05 bps).
// A failure means the port changed the arithmetic and must NOT be called a port.
//
// SECOND, RANDOMIZED HALF (added in the R31c coherence pass). Three real books are
// three points; a rule that coincides on THIS panel but not in general (a tie order,
// a policy phase, a forward-index offset, a guard placed out of reach) would still
// pass (1)-(3). So the same claim is run on RANDOM synthetic panels, each repo
// primitive against the LAB module it was ported from:
//   fuzzBooks   : repo buildFundingBook / buildCrossSectionalBook vs e17#buildBook,
//                 e21#xsBookImpl and e22#buildMasked (daily / ewma / hold policies,
//                 random k, grid, `from`, sign and NEXT, masked nulls in the panel)
//   fuzzWeights : repo rowRankWeights / rowLevelWeights / cleanBook / turnoverSeries
//                 vs e17#rankWeights, e17#levelWeights, port.js#cleanBook, e16#turnoverSeries
//   fuzzMisc    : repo dlogMatrix vs e21's `dlog` (including an ABSENT column, which
//                 must read as a `null` column rather than throwing), and repo
//                 blendBooks vs the repo's own blendRows∘normalizeL1 identity
// Seeded, so the run is reproducible; any divergence fails the run.

import { SYMBOLS, loadOpenInterest, flowIndexAt } from '../lib/lab.js';
import { buildXsSeries } from './e12_xs_carry.js';
import { buildBook, rankWeights, levelWeights } from './e17_low_turnover.js';
import { buildMasked } from './e22_toptrader_validate.js';
import { xsBookImpl } from './e21_open_interest.js';
import { turnoverSeries } from './e16_cost_capacity.js';
import { cleanBook as labCleanBook } from '../prototypes/port.js';
import { fingerprint } from '../../NeuLegion-master/NeuLegion-master/src/core/primitives/fingerprint.js';
import { cleanBook as repoCleanBook } from '../../NeuLegion-master/NeuLegion-master/src/core/primitives/weights.js';
import {
    buildFundingBook as repoBuildFundingBook,
    buildCrossSectionalBook as repoBuildCrossSectionalBook,
    rowRankWeights as repoRowRankWeights,
    rowLevelWeights as repoRowLevelWeights,
    turnoverSeries as repoTurnoverSeries,
    dlogMatrix,
    blendBooks,
    blendRows,
    normalizeL1,
} from '../../NeuLegion-master/NeuLegion-master/src/core/primitives/index.js';
import { carryDispersionSleeve } from '../../NeuLegion-master/NeuLegion-master/src/plugins/sleeves/carry-dispersion.js';
import { toptraderFadeSleeve } from '../../NeuLegion-master/NeuLegion-master/src/plugins/sleeves/toptrader-fade.js';
import { oiChangeSleeve } from '../../NeuLegion-master/NeuLegion-master/src/plugins/sleeves/oi-change.js';
import { CAP_BAND_SPECS } from '../../NeuLegion-master/NeuLegion-master/src/plugins/risk/cap-band.js';

const PPY = 365 * 3;
const FEE_BPS = 4;
const NEXT = 2;
const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };
const sdOf = (a) => { const v = a.filter(Number.isFinite); if (v.length < 2) return NaN; const m = mean(v); return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1)); };
const sharpe = (a) => { const v = a.filter(Number.isFinite); if (v.length < 3) return NaN; const s = sdOf(v); return s > 0 ? (mean(v) / s) * Math.sqrt(PPY) : NaN; };
const r2 = (x) => (Number.isFinite(x) ? +x.toFixed(2) : null);
const fin = (x) => (Number.isFinite(x) ? x : 0);
const normRow = (v) => { const g = v.reduce((a, x) => a + Math.abs(x), 0) || 1; return v.map((x) => x / g); };
const near = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= tol;

// Seeded PRNG (the lab rule: anything not reproducible is not a finding) for the
// RANDOMIZED half of the verification below.
const mulberry32 = (a) => () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
// Exact-or-1e-12-relative equality: the repo and the lab must run the SAME float
// operations, so a real divergence shows as a bit difference, and only the last
// ulp of an associativity-preserving rewrite could need the tolerance.
const fzEq = (a, b) => a === b || (Number.isNaN(a) && Number.isNaN(b)) || (Object.is(a, -0) && Object.is(b, -0)) || Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(a), Math.abs(b));
const fzRows = (A, B) => A.length === B.length && A.every((r, i) => r.length === B[i].length && r.every((x, j) => fzEq(x, B[i][j])));
const fzArr = (A, B) => A.length === B.length && A.every((x, i) => fzEq(x, B[i]));

// The repo book vs the lab book on the REAL rows: identical rows, and a metrics readout.
const compare = (label, repoRows, labRows, repoRets, labRets, stored) => {
    const rowsMatch = repoRows.length === labRows.length &&
        repoRows.every((row, i) => row.length === labRows[i].length && row.every((x, j) => x === labRows[i][j]));
    const retsMatch = repoRets.length === labRets.length && repoRets.every((r, i) => r === labRets[i]);
    const repoMetrics = metrics(repoRows, repoRets);
    const matches = stored ? match(repoMetrics, stored) : null;
    return {
        label,
        rowsFingerprint: fingerprint(repoRows),
        rowsMatch,
        retsMatch,
        repo: repoMetrics,
        stored: stored || null,
        matchesStored: matches,
        pass: rowsMatch && retsMatch && (matches === null || matches === true),
    };
};

const metrics = (rows, rets) => {
    const T = turnoverSeries(rows);
    const net4 = rets.map((r, i) => r - (FEE_BPS / 1e4) * T[i]);
    return {
        net4: r2(sharpe(net4)),
        turnoverAnnual: Math.round(mean(T) * PPY),
        breakEvenBps: mean(T) > 0 ? r2((mean(rets) * 1e4) / mean(T)) : null,
    };
};

const match = (m, expected) => near(m.net4, expected.net4, 0.02) && near(m.turnoverAnnual, expected.turnoverAnnual, 1) && near(m.breakEvenBps, expected.breakEvenBps, 0.05);

export async function run({ symbols = SYMBOLS, perp = 'mark' } = {}) {
    const s = await buildXsSeries(symbols, { perp });
    if (!s.available) return { available: false };
    const names = s.config.symbolList;
    const k = names.length;
    const times = s.times;
    const n = times.length;
    const legs = s.legs;
    const oi = await loadOpenInterest();

    const readResult = async (file) => {
        try { return JSON.parse(await globalThis.__fs.readTextFile(`src/NeuLegion-lab/results/${file}`)); } catch { return null; }
    };
    const e30 = await readResult('e30_retuned_capacity.json');
    const e32 = await readResult('e32_fade_retune.json');
    const e50 = await readResult('e50_oi_band.json');

    // ---------- R8: carry dispersion -----------------------------------------
    const r8Base = buildBook(legs, k, { targetFn: rankWeights, policy: { kind: 'ewma', lambda: 0.02, normalize: true } }).weightRows;
    const r8LabRows = labCleanBook(r8Base, { cap: CAP_BAND_SPECS['carry-dispersion'].cap, bandEps: CAP_BAND_SPECS['carry-dispersion'].bandEps });
    const r8LabRets = (rows) => rows.map((w, t) => {
        const bp = legs.basisPnl[t + 1];
        const fr = legs.fRate[t + 1];
        return w.reduce((a, x, j) => a + x * (fin(bp[j]) + fin(fr[j])), 0);
    });
    const carryView = { fRate: legs.fRate, basisPnl: legs.basisPnl, times };
    const r8RepoRows = carryDispersionSleeve.signal(carryView);
    const r8RepoRets = carryDispersionSleeve.returns(carryView, r8RepoRows);
    const e30c = e30 ? e30.books['ewma_0.02_norm_cap12.5'] : null;
    const r8 = compare('r8 carry dispersion', r8RepoRows, r8LabRows, r8RepoRets, r8LabRets(r8LabRows),
        e30c ? { net4: e30c.windows.full.net4Sharpe, turnoverAnnual: e30c.windows.full.turnoverAnnual, breakEvenBps: e30c.windows.full.breakEvenBps } : null);

    // ---------- R7: toptrader fade -------------------------------------------
    const topLS = names.map((nm) => {
        const o = oi[nm];
        const arr = new Array(n).fill(null);
        for (let i = 0; i < n; i++) { const idx = flowIndexAt(o, times[i]); arr[i] = idx >= 0 ? o.topLS[idx] : null; }
        return arr;
    });
    let firstTop = -1;
    for (let i = 1; i < n - 2; i++) {
        let all = true;
        for (let j = 0; j < k; j++) if (!Number.isFinite(topLS[j][i])) all = false;
        if (all) { firstTop = i; break; }
    }
    const r7LabRows = labCleanBook(buildMasked(topLS, k, legs, times, { sign: -1, from: firstTop, policy: { kind: 'ewma', lambda: 0.05, normalize: true } }).weightRows, { cap: CAP_BAND_SPECS['toptrader-fade'].cap });
    const r7LabRets = (rows) => rows.map((w, t) => {
        const sr = legs.spotRet[firstTop + t + NEXT];
        return w.reduce((a, x, j) => a + x * (sr && Number.isFinite(sr[j]) ? sr[j] : 0), 0);
    });
    const fadeView = { topLS, spotRet: legs.spotRet, times, from: firstTop };
    const r7RepoRows = toptraderFadeSleeve.signal(fadeView);
    const r7RepoRets = toptraderFadeSleeve.returns(fadeView, r7RepoRows);
    const e32c = e32 ? e32.books['lam0.05_cap0.125'] : null;
    const r7 = compare('r7 toptrader fade', r7RepoRows, r7LabRows, r7RepoRets, r7LabRets(r7LabRows),
        e32c ? { net4: e32c.full.net4Sharpe, turnoverAnnual: e32c.full.turnoverAnnual, breakEvenBps: e32c.full.breakEvenBps } : null);
    if (firstTop < 0) return { available: false, reason: 'no full toptrader cross-section' };

    // ---------- OI: 50/50 blend + band ---------------------------------------
    const oiValBySym = names.map((nm) => {
        const o = oi[nm];
        if (!o) return null;
        const arr = new Array(n).fill(null);
        for (let i = 0; i < n; i++) { const idx = flowIndexAt(o, times[i]); arr[i] = idx >= 0 ? o.oiVal[idx] : null; }
        return arr;
    });
    const dlog = (arr, i) => { if (!arr) return null; const a = arr[i]; const b = arr[i - 1]; return (a > 0 && b > 0) ? Math.log(a / b) : null; };
    const dOI = names.map((_, j) => times.map((_, i) => dlog(oiValBySym[j], i)));
    let firstOI = -1;
    for (let i = 1; i < n - 1; i++) {
        let all = true;
        for (let j = 0; j < k; j++) if (!Number.isFinite(dOI[j][i])) all = false;
        if (all) { firstOI = i; break; }
    }
    if (firstOI < 0) return { available: false, reason: 'no full OI cross-section' };
    const loopStart = Math.max(1, firstOI);
    const mk = (lam) => xsBookImpl(dOI, { k, n, times, legs, NEXT }, { sign: 1, from: firstOI, policy: { kind: 'ewma', lambda: lam, normalize: true } });
    const b1 = mk(0.1);
    const b25 = mk(0.25);
    const oiLabBlend = b1.weightRows.map((w, i) => normRow(w.map((x, j) => 0.5 * x + 0.5 * b25.weightRows[i][j])));
    const r8SpecO = CAP_BAND_SPECS['oi-change'];
    const oiLabRows = labCleanBook(oiLabBlend, { cap: r8SpecO.cap, bandEps: r8SpecO.bandEps });
    const oiLabRets = (rows) => rows.map((w, i) => w.reduce((a, x, j) => a + x * fin((legs.spotRet[loopStart + NEXT + i] || [])[j]), 0));
    // The book grid the lab's OI experiment uses is the SHORTER `times` array
    // (e21 passes `n = times.length` to `xsBookImpl`), while the funding and fade
    // shells read the leg arrays. The repo takes the grid explicitly so all three
    // published books can be reproduced by one primitive.
    const oiView = { oiValue: oiValBySym, spotRet: legs.spotRet, times, from: firstOI, n: times.length };
    const oiRepoRows = oiChangeSleeve.signal(oiView);
    const oiRepoRets = oiChangeSleeve.returns(oiView, oiRepoRows);
    const e50b = e50 ? e50.verdict.bestBand : null;
    const oiCheck = compare('oi change', oiRepoRows, oiLabRows, oiRepoRets, oiLabRets(oiLabRows),
        e50b ? { net4: e50b.net4, turnoverAnnual: e50b.turn, breakEvenBps: e50b.be } : null);

    // ---------- the chain itself must be the same function --------------------
    const chainProbe = labCleanBook(r8Base, { cap: 0.125, bandEps: 0.005 });
    const chainRepo = repoCleanBook(r8Base, { cap: 0.125, bandEps: 0.005 });
    const chainIdentical = fingerprint(chainProbe) === fingerprint(chainRepo);

    // ---------- the randomized half of the same claim -------------------------
    // See the header: three real books are three points, so every ported primitive
    // is also compared against the lab module it came from on random finite panels.
    const FUZZ_TRIALS = 250;
    const fz = { books: 0, weights: 0, misc: 0 };
    {
        const rand = mulberry32(0x73f0);
        for (let trial = 0; trial < FUZZ_TRIALS; trial++) {
            const fk = 3 + Math.floor(rand() * 6);
            const fn = 12 + Math.floor(rand() * 40);
            const ftimes = Array.from({ length: fn }, (_, i) => new Date(Date.UTC(2024, 0, 1) + i * 28800000).toISOString());
            const fspot = Array.from({ length: fn + NEXT }, () => Array.from({ length: fk }, () => (rand() - 0.5) * 0.05));
            const fsig = Array.from({ length: fk }, () => Array.from({ length: fn }, () => (rand() < 0.15 ? null : (rand() - 0.5) * 4)));
            const ffRate = Array.from({ length: fn }, () => Array.from({ length: fk }, () => (rand() - 0.5) * 2e-3));
            const fbasis = Array.from({ length: fn }, () => Array.from({ length: fk }, () => (rand() - 0.5) * 1e-3));
            const ffrom = Math.floor(rand() * Math.max(1, fn - 6));
            const fsign = rand() < 0.5 ? -1 : 1;
            const fspotShort = fspot.slice(0, fn);

            // (1) the cross-sectional shells, on the masked signal (daily / ewma only:
            //     e21/e22 reject `hold`, the repo supports it — see the funding shell).
            for (const policy of [{ kind: 'daily' }, { kind: 'ewma', lambda: 0.05, normalize: true }, { kind: 'ewma', lambda: 0.5 }]) {
                const lab21 = xsBookImpl(fsig.map((c) => c.slice()), { k: fk, n: fn, times: ftimes, legs: { spotRet: fspot }, NEXT }, { sign: fsign, from: ffrom, policy });
                const repo21 = repoBuildCrossSectionalBook({ sig: fsig, spotRet: fspot, times: ftimes, NEXT, from: ffrom, sign: fsign, policy, n: fn });
                if (!fzRows(lab21.weightRows, repo21.weightRows) || !fzArr(lab21.rets, repo21.rets)) fz.books += 1;
                const lab22 = buildMasked(fsig.map((c) => c.slice()), fk, { spotRet: fspotShort }, ftimes, { sign: fsign, from: ffrom, policy });
                const repo22 = repoBuildCrossSectionalBook({ sig: fsig, spotRet: fspotShort, times: ftimes, NEXT, from: ffrom, sign: fsign, policy, n: fn });
                if (!fzRows(lab22.weightRows, repo22.weightRows) || !fzArr(lab22.rets, repo22.rets)) fz.books += 1;
            }
            // (2) the funding shell (the only one that has a `hold` policy).
            for (const policy of [{ kind: 'daily' }, { kind: 'ewma', lambda: 0.02, normalize: true }, { kind: 'hold', N: 3 }]) {
                const lab17 = buildBook({ fRate: ffRate, basisPnl: fbasis, times: ftimes }, fk, { targetFn: rankWeights, policy });
                const repo17 = repoBuildFundingBook({ fRate: ffRate, basisPnl: fbasis, times: ftimes, targetFn: repoRowRankWeights, policy, n: fn });
                if (!fzRows(lab17.weightRows, repo17.weightRows) || !fzArr(lab17.rets, repo17.rets)) fz.books += 1;
            }
            // (3) the row weighting + the hygiene chain.
            for (let q = 0; q < 20; q++) {
                const frow = Array.from({ length: fk }, () => (rand() - 0.5) * 10);
                if (!fzArr(rankWeights(frow.slice()), repoRowRankWeights(frow.slice()))) fz.weights += 1;
                if (!fzArr(levelWeights(frow.slice()), repoRowLevelWeights(frow.slice()))) fz.weights += 1;
            }
            const fbook = Array.from({ length: 20 }, () => Array.from({ length: fk }, () => (rand() - 0.5) * 0.6));
            for (const [cap, bandEps] of [[0.125, null], [null, 0.03], [0.125, 0.005], [0.2, 0.01], [null, 0.5]]) {
                if (!fzRows(labCleanBook(fbook.map((r) => r.slice()), { cap, bandEps }), repoCleanBook(fbook.map((r) => r.slice()), { cap, bandEps }))) fz.weights += 1;
            }
            if (!fzArr(turnoverSeries(fbook.map((r) => r.slice())), repoTurnoverSeries(fbook.map((r) => r.slice())))) fz.weights += 1;

            // (4) dlogMatrix (incl. an ABSENT column) and blendBooks' internal identity.
            const flevels = Array.from({ length: fk }, () => (rand() < 0.15 ? null : Array.from({ length: fn }, () => (rand() < 0.2 ? null : Math.exp((rand() - 0.5) * 2)))));
            const repoM = dlogMatrix(flevels);
            let logOk = repoM.length === fk;
            for (let j = 0; j < fk && logOk; j++) {
                if (!flevels[j]) logOk = repoM[j] === null;
                else logOk = fzArr(repoM[j], Array.from({ length: fn }, (_, i) => dlog(flevels[j], i)));
            }
            if (!logOk) fz.misc += 1;
            const fA = Array.from({ length: 20 }, () => Array.from({ length: fk }, () => (rand() - 0.5) * 0.5));
            const fB = Array.from({ length: 20 }, () => Array.from({ length: fk }, () => (rand() - 0.5) * 0.5));
            const blendRef = fA.map((row, i) => normalizeL1(blendRows(row, fB[i], 0.5)));
            if (!fzRows(blendRef, blendBooks({ weightRows: fA, bookTimes: [] }, { weightRows: fB, bookTimes: [] }, 0.5).weightRows)) fz.misc += 1;
        }
    }

    const checks = {
        r8: r8.pass,
        r7: r7.pass,
        oi: oiCheck.pass,
        cleanChainIdentical: chainIdentical,
        r8StoredMatch: r8.matchesStored,
        r7StoredMatch: r7.matchesStored,
        oiStoredMatch: oiCheck.matchesStored,
        fuzzBooks: fz.books === 0,
        fuzzWeights: fz.weights === 0,
        fuzzMisc: fz.misc === 0,
    };
    const validationPass = Object.values(checks).every((x) => x === true);

    return {
        config: { symbols: k, symbolList: names, periods: r8Base.length, firstTop, firstOI, feeBps: FEE_BPS },
        verdict: {
            note: 'The REPO V2 sleeve layer must reproduce the lab books bit-for-bit on the lab data.',
            specs: CAP_BAND_SPECS,
            checks,
            fuzz: { trials: FUZZ_TRIALS, divergences: fz, seed: '0x73f0' },
            r8, r7, oi: oiCheck,
            validationPass,
        },
    };
}
