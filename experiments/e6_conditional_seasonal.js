// E6 - conditional / seasonal structure, with an honest out-of-sample split.
//
// Two families the shipped roster does not test:
//
//   (A) VOLATILITY CONDITIONING. The same momentum position, gated by a CAUSAL
//       expanding-median realised-vol state (low-vol vs high-vol). The repo's
//       `sig-vol-regime` was DROPPED as a standalone signal; this asks the
//       conditional question instead (does momentum work in one vol state?). The
//       vol split is causal (expanding median, min 500 obs), so it is a real filter.
//
//   (B) CALENDAR SEASONALITY (hour-of-day, day-of-week), tested with a strict
//       SPLIT-HALF: the hour/day pattern is FIT on the first half and SCORED on the
//       second half. Only the out-of-sample half is evidence. Crypto has strong
//       intraday turnover structure, so this is worth one honest look - with the
//       explicit caveat that a single OOS window is one draw, not a validation.

import { buildPanel, positionsOfFast, score, netSeries, stats, SYMBOLS, PERIODS_PER_YEAR } from '../lib/lab.js';
import { blockStability } from './e2_arm_sweep.js';
import { momentum } from '../../NeuLegion-master/NeuLegion-master/src/analysis/features.js';
import { sharpeRatio } from '../../NeuLegion-master/NeuLegion-master/src/analysis/performance.js';

const clamp = (x) => (x < -1 ? -1 : x > 1 ? 1 : x);

function varianceOf(s, a, b) {
    if (!s || a < 0 || b <= a) return NaN;
    const n = b - a + 1;
    let m = 0;
    for (let i = a; i <= b; i++) m += s[i];
    m /= n;
    let acc = 0;
    for (let i = a; i <= b; i++) acc += (s[i] - m) ** 2;
    return acc / (n - 1);
}

export async function run({ tf = '1h', blocks = 6, costBps = 0 } = {}) {
    const panel = await buildPanel({ symbols: SYMBOLS, tf });
    const n = panel[0].n;
    const out = { config: { tf, bars: n, streams: panel.length, costBps, blocks }, volConditioning: {}, seasonality: {} };

    // ---- (A) volatility conditioning ----
    const mom = panel.map((s) => positionsOfFast(momentum, s, { window: 16 }));
    const lowVol = new Array(panel.length);
    const highVol = new Array(panel.length);
    for (let i = 0; i < panel.length; i++) {
        const s = panel[i];
        const lo = new Array(n).fill(0);
        const hi = new Array(n).fill(0);
        let med = NaN;
        const seen = [];
        for (let t = 0; t < n; t++) {
            const v = varianceOf(s.returns, t - 96 + 1, t);
            if (Number.isFinite(v) && v > 0) { seen.push(v); if (seen.length > 500) seen.shift(); }
            if (seen.length >= 500) {
                const sorted = seen.slice().sort((a, b) => a - b);
                med = sorted[Math.floor(sorted.length / 2)];
            }
            if (Number.isFinite(v) && Number.isFinite(med)) {
                if (v < med) lo[t] = mom[i][t]; else hi[t] = mom[i][t];
            }
        }
        lowVol[i] = lo;
        highVol[i] = hi;
    }
    for (const [name, sig] of [['momentum-lowVol', lowVol], ['momentum-highVol', highVol]]) {
        const per = panel.map((s, i) => score(s.returns, sig[i], { costBps }));
        const net = panel.map((s, i) => netSeries(s.returns, sig[i], costBps));
        out.volConditioning[name] = {
            meanSharpe: stats(per.map((p) => p.netSharpe)),
            meanBreakEvenCostBps: stats(per.map((p) => p.breakEvenCostBps)).mean,
            positiveStreams: per.filter((p) => p.netSharpe > 0).length,
            stability: blockStability(net, blocks),
            pooledSharpe: sharpeRatio(net.flat(), { periodsPerYear: PERIODS_PER_YEAR }),
        };
    }

    // ---- (B) seasonality, split-half OOS ----
    const half = Math.floor(n / 2);
    const buckets = {
        hourOfDay: (t) => (tf === '1h' ? new Date(panel[0].t[t]).getUTCHours() : new Date(panel[0].t[t]).getUTCHours() * 4 + Math.floor(new Date(panel[0].t[t]).getUTCMinutes() / 15)),
        dayOfWeek: (t) => new Date(panel[0].t[t]).getUTCDay(),
    };
    for (const [bname, keyOf] of Object.entries(buckets)) {
        const K = bname === 'hourOfDay' ? (tf === '1h' ? 24 : 96) : 7;
        // FIT on the first half: average per-bucket return (equal weight across streams)
        const sum = new Array(K).fill(0);
        const cnt = new Array(K).fill(0);
        for (let i = 0; i < panel.length; i++) {
            const s = panel[i];
            for (let t = 1; t < half; t++) { const k = keyOf(t); sum[k] += s.returns[t]; cnt[k]++; }
        }
        const meanByBucket = sum.map((v, k) => (cnt[k] ? v / cnt[k] : 0));
        const rank = meanByBucket.map((v, k) => ({ k, v })).sort((a, b) => b.v - a.v);
        const half_k = Math.max(1, Math.floor(K / 4));
        const pos = new Array(K).fill(0);
        for (let j = 0; j < rank.length; j++) {
            if (j < half_k) pos[rank[j].k] = 1;
            else if (j >= rank.length - half_k) pos[rank[j].k] = -1;
        }
        // SCORE on the second half, per stream
        const sig = panel.map((s) => s.returns.map((_, t) => (t >= half ? clamp(pos[keyOf(t)]) : 0)));
        const per = panel.map((s, i) => score(s.returns, sig[i], { costBps }));
        const net = panel.map((s, i) => netSeries(s.returns, sig[i], costBps));
        out.seasonality[bname] = {
            buckets: K,
            fittedLongBuckets: rank.slice(0, half_k).map((r) => r.k),
            fittedShortBuckets: rank.slice(-half_k).map((r) => r.k),
            fittedMeanSpread: meanByBucket[rank[0].k] - meanByBucket[rank[rank.length - 1].k],
            oosPerStream: per.map((p) => p.netSharpe),
            oosMeanSharpe: stats(per.map((p) => p.netSharpe)),
            oosBreakEvenCostBps: stats(per.map((p) => p.breakEvenCostBps)).mean,
            oosPositiveStreams: per.filter((p) => p.netSharpe > 0).length,
            pooledOosSharpe: sharpeRatio(net.flat(), { periodsPerYear: PERIODS_PER_YEAR }),
        };
    }
    return out;
}
