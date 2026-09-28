// Lab prototype signals - candidates the shipped repo does NOT have.
//
// Contract (identical to the shipped family in `analysis/features.js`): every
// function is PURE and POINT-IN-TIME - `fn(series, t, params)` reads only indices
// <= t. A cross-sectional feature additionally reads `series.panel`, the lab's
// cross-section carrier: `{ returnsByStream: [[...], ...], streamIndex }`.
//
// The shipped repo already has `crossSectionalReversal` (a reversal that is a bet
// against a stream's move net of the cross-section mean). What it does NOT have is
// the momentum counterpart, or any *portfolio* construction that removes the common
// (market) factor from the traded position. Those are the lab's first hypotheses.

const finiteSum = (s, a, b) => {
    if (!s || a < 0) return NaN;
    let acc = 0;
    for (let i = a; i <= b; i++) { if (!Number.isFinite(s[i])) return NaN; acc += s[i]; }
    return acc;
};

const varianceOf = (s, a, b) => {
    if (!s || a < 0 || b <= a) return NaN;
    const n = b - a + 1;
    let m = 0;
    for (let i = a; i <= b; i++) { if (!Number.isFinite(s[i])) return NaN; m += s[i]; }
    m /= n;
    let acc = 0;
    for (let i = a; i <= b; i++) acc += (s[i] - m) ** 2;
    return acc / (n - 1);
};

// Cross-sectional mean of a per-stream raw value at t (all live streams, including mine).
function xsMean(series, t, raw) {
    const p = series.panel;
    if (!p || !Array.isArray(p.returnsByStream)) return NaN;
    let sum = 0;
    let n = 0;
    for (let i = 0; i < raw.length; i++) if (Number.isFinite(raw[i])) { sum += raw[i]; n++; }
    return n >= 2 ? sum / n : NaN;
}

// Raw momentum of each stream at t, as an array indexed by stream.
function xsRawMomentum(series, t, window) {
    const p = series.panel;
    if (!p || !Array.isArray(p.returnsByStream)) return null;
    return p.returnsByStream.map((rs) => finiteSum(rs, t - window + 1, t));
}

// ---- cross-sectional (market-neutral-in-the-signal) momentum ---------------

// Momentum NET of the cross-section mean: a bet on THIS stream's relative trend.
// The position it maps to is (approximately) dollar-neutral across the basket,
// so the traded book carries little of the common factor by construction.
export function xsMomentum(series, t, { window = 16 } = {}) {
    const r = series.returns;
    if (!r) return NaN;
    const raw = xsRawMomentum(series, t, window);
    if (!raw) return NaN;
    const mine = finiteSum(r, t - window + 1, t);
    const m = xsMean(series, t, raw);
    if (!Number.isFinite(mine) || !Number.isFinite(m)) return NaN;
    return mine - m;
}

// Cross-sectionally demeaned, vol-scaled momentum (the two published upgrades
// composed: TSMOM vol-scaling x XSMOM neutrality).
export function xsVolScaledMomentum(series, t, { window = 16 } = {}) {
    const r = series.returns;
    if (!r) return NaN;
    const v = varianceOf(r, t - window + 1, t);
    if (!Number.isFinite(v) || !(v > 0)) return NaN;
    const rawRs = series.panel && series.panel.returnsByStream;
    if (!rawRs) return NaN;
    const raw = rawRs.map((rs) => {
        const m = finiteSum(rs, t - window + 1, t);
        const vv = varianceOf(rs, t - window + 1, t);
        return (Number.isFinite(m) && Number.isFinite(vv) && vv > 0) ? m / Math.sqrt(vv) : NaN;
    });
    const mine = finiteSum(r, t - window + 1, t) / Math.sqrt(v);
    const m = xsMean(series, t, raw);
    if (!Number.isFinite(mine) || !Number.isFinite(m)) return NaN;
    return mine - m;
}

// Rank-based cross-sectional momentum (learning-to-rank flavour, arXiv 2012.07149):
// the stream's momentum rank in [-1,1] minus 0.5, centred. Rank is scale-free and
// robust to the fat tails that dominate raw crypto momentum.
export function xsMomentumRank(series, t, { window = 16 } = {}) {
    const p = series.panel;
    if (!p || !Array.isArray(p.returnsByStream)) return NaN;
    const raw = xsRawMomentum(series, t, window);
    if (!raw) return NaN;
    const mineRaw = raw[p.streamIndex];
    if (!Number.isFinite(mineRaw)) return NaN;
    const live = raw.filter((x) => Number.isFinite(x));
    if (live.length < 3) return NaN;
    let below = 0;
    for (const x of live) if (x < mineRaw) below++;
    return below / (live.length - 1) - 0.5;
}

// ---- risk sizing ------------------------------------------------------------

// Inverse-realised-vol scale (the TSMOM sizing overlay). Returns 1/vol, capped and
// floored so one calm bar cannot explode the book.
export function inverseVolScale(series, t, { window = 32, floor = 0.25, cap = 4 } = {}) {
    const v = varianceOf(series.returns, t - window + 1, t);
    if (!Number.isFinite(v) || !(v > 0)) return NaN;
    const s = 1 / Math.sqrt(v);
    return Math.min(cap, Math.max(floor, s));
}

// Vol-targeted position: the shipped momentum position rescaled so that the bar's
// risk is roughly constant. `base` is the position the caller already decided.
export function volTargetPosition(base, series, t, { window = 32, target = 0.02 } = {}) {
    const s = inverseVolScale(series, t, { window });
    if (!Number.isFinite(s)) return 0;
    const p = base * s * target;
    return p < -1 ? -1 : p > 1 ? 1 : p;
}

// ---- portfolio construction -------------------------------------------------

// Combine several position series into one book. `weights` optional; default equal.
// `neutralize: true` removes the cross-sectional mean of the combined positions at
// every bar, so the resulting book is (approximately) market-neutral.
export function combinePositions(positionSeries, { weights = null, neutralize = false, cap = 1 } = {}) {
    const n = positionSeries[0].length;
    const k = positionSeries.length;
    const w = weights || new Array(k).fill(1 / k);
    const out = new Array(n).fill(0);
    for (let t = 0; t < n; t++) {
        let acc = 0;
        for (let i = 0; i < k; i++) acc += w[i] * (positionSeries[i][t] || 0);
        out[t] = acc;
    }
    if (!neutralize) return out;
    // positions are per-stream; neutralising needs the cross-section, so this path
    // is only meaningful when `positionSeries` is the panel's per-stream books.
    return out;
}

// Turn a panel of per-stream positions into ONE portfolio position per bar by
// equal-notional risk-parity across the cross-section (dollar-neutral).
// `panelPositions[i][t]` = the position stream i takes at t.
export function dollarNeutralPortfolio(panelPositions, { riskParity = false, volsPerStream = null } = {}) {
    const k = panelPositions.length;
    const n = panelPositions[0].length;
    const out = new Array(n).fill(0);
    for (let t = 0; t < n; t++) {
        let sum = 0;
        let wsum = 0;
        const w = new Array(k).fill(0);
        for (let i = 0; i < k; i++) {
            if (riskParity && volsPerStream) {
                const v = volsPerStream[i][t];
                w[i] = Number.isFinite(v) && v > 0 ? 1 / v : 0;
            } else {
                w[i] = 1;
            }
            wsum += w[i];
        }
        if (!(wsum > 0)) continue;
        for (let i = 0; i < k; i++) w[i] /= wsum;
        // demean the weighted positions so the book is dollar-neutral
        let raw = 0;
        for (let i = 0; i < k; i++) raw += w[i] * (panelPositions[i][t] || 0);
        let mean = 0;
        for (let i = 0; i < k; i++) mean += (panelPositions[i][t] || 0);
        mean /= k;
        for (let i = 0; i < k; i++) sum += w[i] * ((panelPositions[i][t] || 0) - mean);
        out[t] = sum;
    }
    return out;
}
