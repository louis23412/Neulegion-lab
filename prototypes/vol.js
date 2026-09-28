// Lab prototype: volatility forecasting and risk sizing - L09.
//
// The one universally documented predictability in returns is volatility. The repo
// has a `volRegime` feature but no sizing layer: positions are a fixed ±1 clamp on a
// z-score. These helpers are pure and causal (read only indices <= t).

// Trailing realised vol (std of returns over [a, b]); NaN if fewer than 2 finite.
export function trailingVol(returns, a, b) {
    let n = 0, s = 0, ss = 0;
    for (let i = Math.max(0, a); i <= b; i++) { const v = returns[i]; if (Number.isFinite(v)) { n++; s += v; ss += v * v; } }
    if (n < 2) return NaN;
    const m = s / n;
    return Math.sqrt(Math.max(0, (ss - n * m * m) / (n - 1)));
}

// EWMA vol estimate from squared returns, using returns up to and INCLUDING t
// (causal forecast for t+1). NaN until `minObs` returns are seen.
export function ewmaVol(returns, t, { lambda = 0.94, minObs = 20 } = {}) {
    let v = null;
    let n = 0;
    for (let i = 0; i <= t; i++) {
        const r = returns[i];
        if (!Number.isFinite(r)) continue;
        v = v == null ? r * r : lambda * v + (1 - lambda) * r * r;
        n++;
    }
    return n >= minObs && v != null && v > 0 ? Math.sqrt(v) : NaN;
}

// HAR-style realised-vol components (Corsi 2009): trailing mean squared return over
// daily / weekly / monthly windows, expressed as vols. Causal at t.
export function harComponents(returns, t, { d = 24, w = 168, m = 720 } = {}) {
    const rv = (L) => {
        let n = 0, ss = 0;
        for (let i = Math.max(0, t - L + 1); i <= t; i++) { const v = returns[i]; if (Number.isFinite(v)) { n++; ss += v * v; } }
        return n >= 2 ? Math.sqrt(ss / n) : NaN;
    };
    return { d: rv(d), w: rv(w), m: rv(m) };
}

// Vol-target leverage: scale a unit position so forecast risk ≈ `target` per period.
// Capped (default 4x) so a quiet regime cannot imply unbounded gearing. Returns 0
// when the forecast is unusable.
export function volTargetLeverage(volForecast, target, { cap = 4, floor = 0 } = {}) {
    if (!Number.isFinite(volForecast) || !(volForecast > 0) || !(target > 0)) return 0;
    const l = target / volForecast;
    return Math.max(floor, Math.min(cap, l));
}

// Small least-squares solve (normal equations, Gaussian elimination) for a k-param
// design. Returns coefficients, or null if singular. Used for HAR fitting.
export function olsFit(X, y) {
    const k = X[0].length;
    const A = Array.from({ length: k }, () => new Array(k + 1).fill(0));
    for (let i = 0; i < X.length; i++) {
        for (let a = 0; a < k; a++) {
            for (let b = 0; b < k; b++) A[a][b] += X[i][a] * X[i][b];
            A[a][k] += X[i][a] * y[i];
        }
    }
    for (let c = 0; c < k; c++) {
        let piv = c;
        for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
        if (Math.abs(A[piv][c]) < 1e-12) return null;
        [A[c], A[piv]] = [A[piv], A[c]];
        for (let r = 0; r < k; r++) {
            if (r === c) continue;
            const f = A[r][c] / A[c][c];
            for (let cc = c; cc <= k; cc++) A[r][cc] -= f * A[c][cc];
        }
    }
    return A.map((row, i) => row[k] / row[i]);
}
