// Lab prototype: order-flow (taker buy/sell imbalance) features - L07.
//
// The repo has no order-flow input at all. `series.flow[k]` carries the signed
// taker imbalance `2*(takerBuyBaseVolume/volume) - 1` in [-1, 1] (NaN without a
// bar), attached by `lib/lab.js#attachFlow`. Every function here is pure and reads
// only indices <= t (the causal contract), so it drops into the repo's
// `causalZScore` + `clampPosition` pipeline exactly like a shipped feature.
//
// Interpretation: flow > 0 means aggressive buyers lifted the offer (net taker
// buying); flow < 0 means sellers hit the bid. Microstructure theory says the
// *short-horizon* move continues (order-flow autocorrelation / Kyle lambda) and the
// multi-bar *pressure* mean-reverts; both are testable here.

const F = (x) => Number.isFinite(x);

function meanFlow(series, a, b) {
    const f = series.flow;
    if (!f) return NaN;
    let s = 0;
    let n = 0;
    for (let i = Math.max(0, a); i <= b; i++) { const v = f[i]; if (F(v)) { s += v; n++; } }
    return n ? s / n : NaN;
}

// The bar's own signed imbalance (the fastest, noisiest read).
export function flowImbalance(series, t) {
    const v = series.flow ? series.flow[t] : NaN;
    return F(v) ? v : NaN;
}

// Mean signed imbalance over the trailing `window` bars (pressure level).
export function flowMean(series, t, { window = 8 } = {}) {
    return meanFlow(series, t - window + 1, t);
}

// Cumulative signed flow over the trailing `window` (pressure total; scale grows
// with window, which the z-score pipeline removes).
export function flowPressure(series, t, { window = 8 } = {}) {
    const f = series.flow;
    if (!f) return NaN;
    let s = 0;
    let n = 0;
    for (let i = Math.max(0, t - window + 1); i <= t; i++) { const v = f[i]; if (F(v)) { s += v; n++; } }
    return n >= Math.ceil(window / 2) ? s : NaN;
}

// Surprise: this bar's imbalance minus the trailing mean EXCLUDING t (the causal
// "flow shock"). Positive = buyers arriving faster than recently.
export function flowChange(series, t, { window = 8 } = {}) {
    const v = series.flow ? series.flow[t] : NaN;
    if (!F(v)) return NaN;
    const m = meanFlow(series, t - window, t - 1);
    return F(m) ? v - m : NaN;
}

// Price-flow divergence: +1 when trailing price return and trailing flow pressure
// point the same way, -1 when they disagree ("price up on selling" is the classic
// bearish divergence). NaN when either side is undefined.
export function flowDivergence(series, t, { window = 8 } = {}) {
    const f = flowPressure(series, t, { window });
    const c = series.closes || series.close;
    if (!F(f) || !c) return NaN;
    const past = c[Math.max(0, t - window)];
    if (!F(past) || !(past > 0)) return NaN;
    const ret = c[t] / past - 1;
    if (!F(ret)) return NaN;
    const sf = Math.sign(f);
    const sr = Math.sign(ret);
    if (sf === 0 || sr === 0) return NaN;
    return sf * sr;
}

// Cross-sectional flow: this stream's trailing mean flow NET of the panel mean.
// Positive = this asset is being bought relative to the basket (the relative-flow
// bet, mirroring the repo's `crossSectionalReversal`). Reads `panel.flowByStream`.
export function flowXs(series, t, { window = 8 } = {}) {
    const p = series.panel;
    if (!p || !Array.isArray(p.flowByStream)) return NaN;
    const mine = meanFlow(series, t - window + 1, t);
    if (!F(mine)) return NaN;
    let sum = 0;
    let n = 0;
    for (const fs of p.flowByStream) {
        if (!fs) continue;
        let s = 0, k = 0;
        for (let i = Math.max(0, t - window + 1); i <= t; i++) if (F(fs[i])) { s += fs[i]; k++; }
        if (k) { sum += s / k; n++; }
    }
    if (n < 2) return NaN;
    return mine - sum / n;
}

// Flow-conditioned momentum: trend, but ABSTAIN when the trailing flow disagrees
// with the trailing price move (the divergence case). A causal, pre-registered
// conditioning feature - not a fitted gate.
export function flowGatedMomentum(series, t, { window = 16, flowWindow = 8 } = {}) {
    const c = series.closes || series.close;
    const r = series.returns;
    if (!c || !r) return NaN;
    let m = 0;
    for (let i = Math.max(1, t - window + 1); i <= t; i++) { const v = r[i]; if (!F(v)) return NaN; m += v; }
    const d = flowDivergence(series, t, { window: flowWindow });
    if (!F(d) || d <= 0) return NaN;
    return m;
}
