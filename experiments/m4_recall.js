// M4 probe — do the LSH upgrades earn a route into the scored path? (CYCLE-188 DESIGN, executed same cycle).
// Standalone: NOT in run_all.js. Pure (no data files). Seconds via the harness.
//
// DESIGN (director, CYCLE-184/185). `_getGlobalLSHCandidates` serves ONLY the
// discarded broadcast (BUGS #44); its consumers multiprobes/querymod can never
// move the scored path today. This probe isolates the ONLY question that could
// change that: do the upgrades lift candidate recall over the default probe on
// the SAME function? Seeded clustered fixture (10 centers × 20 members,
// hidden 16 / lowDim 4 / bits 8 / tables 3), 60 noisy queries, ground truth =
// top-5 by euclid on the mean. Arms: default, +multiprobe, +querymod,
// +both (default shipped configs). Metric: mean recall of truth top-5 in the
// candidate set + mean set size (cost).
// RULE (pre-registered): best upgrade lifts mean recall ≥ +0.10 over default
//   → ROUTE that upgrade (into the LIVE reader, follow-up build + native A/B);
//   else PARK multiprobes + querymod (broadcast-only, unproven). BinaryPC/
//   bitweight are NOT covered by this probe (pca-hash refreshes buckets the
//   LIVE reader reads — R27-2 — so they stay as-is, default-off).
import { lshMethods } from '../../NeuLegion-master/NeuLegion-master/src/hivemind/memory/lsh.js';
import { linalgMethods } from '../../NeuLegion-master/NeuLegion-master/src/hivemind/kernels/linalg.js';

const mulberry32 = (seed) => { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const randn = (rng) => { const u = Math.max(rng(), 1e-12); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); };

export async function run({ seed = 20261002, noise = 0.05, bits = 8, centers = 10, members = 20 } = {}) {
    const checks = [];
    const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail).slice(0, 300) });
    const rng = mulberry32(seed);
    const H = 16, LD = 4, NP = 2, SETS = 1, TABLES = 3, BITS = bits;
    const stub = {
        _ensembleSize: 1, _numLshSets: SETS, _lshNumTables: TABLES, _lshHashBits: BITS,
        _lowDim: LD, _hiddenSize: H, _numProjections: NP,
        _projectionMatrices: Array.from({ length: NP }, () => Array.from({ length: H }, () => Array.from({ length: LD }, () => randn(rng)))),
        _lshHyperplanes: [Array.from({ length: TABLES }, () => Array.from({ length: BITS }, () => Array.from({ length: LD }, () => randn(rng))))],
        _semanticLSHBuckets: [[Array.from({ length: TABLES }, () => new Map())]],
        _projCache: new Map(), _priorityIndices: [[]],
        _lshBitMasks: null, _multiProbeConfig: null, _queryModConfig: null,
        _semanticProtos: [[]],
    };
    Object.assign(stub, lshMethods, linalgMethods);
    const protos = [];
    for (let c = 0; c < centers; c++) {
        const center = Array.from({ length: H }, () => randn(rng) * 2);
        for (let m = 0; m < members; m++) {
            const mean = center.map((v) => v + randn(rng) * 0.15);
            const p = { mean, size: 1 };
            p.projNorms = stub._computeProjNorms(mean);
            stub._insertProtoToLSH(0, p);
            stub._semanticProtos[0].push(p);
            protos.push(p);
        }
    }
    check('m4: protos indexed', stub._semanticProtos[0].length === centers * members, `${stub._semanticProtos[0].length}`);
    const queries = [];
    for (let q = 0; q < 60; q++) {
        const src = protos[Math.floor(rng() * protos.length)];
        const qm = src.mean.map((v) => v + randn(rng) * noise);
        const dists = protos.map((p) => ({ p, d: p.mean.reduce((s, v, i) => s + (v - qm[i]) ** 2, 0) }));
        dists.sort((a, b) => a.d - b.d);
        queries.push({ qm, truth: new Set(dists.slice(0, 5).map((r) => r.p)) });
    }
    const arms = {
        def: { _multiProbeConfig: null, _queryModConfig: null },
        mp: { _multiProbeConfig: { maxFlips: 2, budget: 8 }, _queryModConfig: null },
        qm: { _multiProbeConfig: null, _queryModConfig: {} },
        both: { _multiProbeConfig: { maxFlips: 2, budget: 8 }, _queryModConfig: {} },
    };
    const recall = {};
    for (const [name, cfg] of Object.entries(arms)) {
        stub._multiProbeConfig = cfg._multiProbeConfig;
        stub._queryModConfig = cfg._queryModConfig;
        let hit = 0, size = 0;
        for (const { qm, truth } of queries) {
            const qp = stub._computeProjNorms(qm);
            const cands = stub._getGlobalLSHCandidates(qm, qp, 200);
            const set = new Set(cands);
            for (const t of truth) if (set.has(t)) hit++;
            size += cands.length;
        }
        recall[name] = { mean: +(hit / (queries.length * 5)).toFixed(4), meanSize: +(size / queries.length).toFixed(1) };
    }
    check('m4: all arms measured on 60 queries', Object.keys(recall).length === 4, JSON.stringify(recall));
    const lift = Math.max(recall.mp.mean, recall.qm.mean, recall.both.mean) - recall.def.mean;
    const best = Object.entries(recall).sort((a, b) => b[1].mean - a[1].mean)[0][0];
    const route = lift >= 0.10;
    check('m4: route-or-park rule applied', Number.isFinite(lift), `best ${best} lift ${lift.toFixed(4)} → ${route ? 'ROUTE' : 'PARK'}`);
    return { pass: checks.every((c) => c.pass), checks, recall, verdict: route ? `ROUTE:${best}` : 'PARK:multiprobes+querymod', note: 'binarypc/bitweight not covered (pca-hash is live per R27-2, stays default-off)' };
}
