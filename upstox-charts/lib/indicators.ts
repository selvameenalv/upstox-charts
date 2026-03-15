// lib/indicators.ts
// Pure TypeScript indicator calculations — no Python dependency

export interface OHLCV {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ── EMA ──────────────────────────────────────────────────────────────
export function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = new Array(values.length).fill(NaN);
  let prev = NaN;
  for (let i = 0; i < values.length; i++) {
    if (isNaN(prev)) {
      if (i >= period - 1) {
        const slice = values.slice(i - period + 1, i + 1);
        prev = slice.reduce((a, b) => a + b, 0) / period;
        result[i] = prev;
      }
    } else {
      prev = values[i] * k + prev * (1 - k);
      result[i] = prev;
    }
  }
  return result;
}

// ── SMA ──────────────────────────────────────────────────────────────
export function sma(values: number[], period: number): number[] {
  return values.map((_, i) => {
    if (i < period - 1) return NaN;
    const slice = values.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

// ── STD ──────────────────────────────────────────────────────────────
function rollingStd(values: number[], period: number): number[] {
  const means = sma(values, period);
  return values.map((_, i) => {
    if (i < period - 1) return NaN;
    const slice = values.slice(i - period + 1, i + 1);
    const mean = means[i];
    const variance = slice.reduce((acc, v) => acc + (v - mean) ** 2, 0) / period;
    return Math.sqrt(variance);
  });
}

// ── TRUE RANGE ────────────────────────────────────────────────────────
function trueRange(high: number[], low: number[], close: number[]): number[] {
  return high.map((h, i) => {
    if (i === 0) return h - low[i];
    return Math.max(h - low[i], Math.abs(h - close[i - 1]), Math.abs(low[i] - close[i - 1]));
  });
}

// ── BOLLINGER BANDS ───────────────────────────────────────────────────
export function bollingerBands(close: number[], period = 20, mult = 2.0) {
  const mid = sma(close, period);
  const std = rollingStd(close, period);
  const upper = mid.map((m, i) => m + mult * std[i]);
  const lower = mid.map((m, i) => m - mult * std[i]);
  return { upper, mid, lower };
}

// ── KELTNER CHANNELS ──────────────────────────────────────────────────
export function keltnerChannels(close: number[], high: number[], low: number[], period = 20, mult = 1.5) {
  const mid = ema(close, period);
  const tr = trueRange(high, low, close);
  const atr = ema(tr, period);
  const upper = mid.map((m, i) => m + mult * atr[i]);
  const lower = mid.map((m, i) => m - mult * atr[i]);
  return { upper, mid, lower };
}

// ── SQUEEZE MOMENTUM ──────────────────────────────────────────────────
export function squeezeMomentum(close: number[], high: number[], low: number[]) {
  const bb = bollingerBands(close);
  const kc = keltnerChannels(close, high, low);

  const squeezeOn = bb.upper.map((bu, i) => bu < kc.upper[i] && bb.lower[i] > kc.lower[i]);

  // Momentum: close minus midpoint of (highest high + lowest low)/2 and KC mid
  const momentum = close.map((c, i) => {
    if (i < 19) return NaN;
    const hhSlice = high.slice(i - 19, i + 1);
    const llSlice = low.slice(i - 19, i + 1);
    const hh = Math.max(...hhSlice);
    const ll = Math.min(...llSlice);
    const delta = c - ((hh + ll) / 2 + kc.mid[i]) / 2;
    return delta;
  });

  // Smooth momentum with linreg-style 5-period EMA
  const smoothMom = ema(momentum.map(v => isNaN(v) ? 0 : v), 5);

  return { squeezeOn, momentum: smoothMom };
}

// ── RSI ──────────────────────────────────────────────────────────────
export function rsi(close: number[], period = 14): number[] {
  const result: number[] = new Array(close.length).fill(NaN);
  let avgGain = 0, avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const diff = close[i] - close[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;
  result[period] = 100 - 100 / (1 + avgGain / (avgLoss || 1e-10));

  for (let i = period + 1; i < close.length; i++) {
    const diff = close[i] - close[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = 100 - 100 / (1 + avgGain / (avgLoss || 1e-10));
  }
  return result;
}

// ── ADX ──────────────────────────────────────────────────────────────
// diPeriod = DI smoothing (13), adxPeriod = ADX smoothing (8)
export function adx(high: number[], low: number[], close: number[], diPeriod = 13, adxPeriod = 8) {
  const period = diPeriod;
  const n = high.length;
  const plusDI: number[] = new Array(n).fill(NaN);
  const minusDI: number[] = new Array(n).fill(NaN);
  const adxArr: number[] = new Array(n).fill(NaN);

  const tr = trueRange(high, low, close);
  const plusDM = high.map((h, i) => {
    if (i === 0) return 0;
    const up = h - high[i - 1];
    const dn = low[i - 1] - low[i];
    return up > dn && up > 0 ? up : 0;
  });
  const minusDM = high.map((h, i) => {
    if (i === 0) return 0;
    const up = h - high[i - 1];
    const dn = low[i - 1] - low[i];
    return dn > up && dn > 0 ? dn : 0;
  });

  // Wilder smoothing
  let smoothTR = tr.slice(1, period + 1).reduce((a, b) => a + b, 0);
  let smoothPlusDM = plusDM.slice(1, period + 1).reduce((a, b) => a + b, 0);
  let smoothMinusDM = minusDM.slice(1, period + 1).reduce((a, b) => a + b, 0);

  plusDI[period] = 100 * smoothPlusDM / smoothTR;
  minusDI[period] = 100 * smoothMinusDM / smoothTR;

  const dxArr: number[] = new Array(n).fill(NaN);
  dxArr[period] = 100 * Math.abs(plusDI[period] - minusDI[period]) / (plusDI[period] + minusDI[period] || 1e-10);

  for (let i = period + 1; i < n; i++) {
    smoothTR = smoothTR - smoothTR / period + tr[i];
    smoothPlusDM = smoothPlusDM - smoothPlusDM / period + plusDM[i];
    smoothMinusDM = smoothMinusDM - smoothMinusDM / period + minusDM[i];

    plusDI[i] = 100 * smoothPlusDM / smoothTR;
    minusDI[i] = 100 * smoothMinusDM / smoothTR;
    dxArr[i] = 100 * Math.abs(plusDI[i] - minusDI[i]) / (plusDI[i] + minusDI[i] || 1e-10);
  }

  // Smooth DX into ADX using adxPeriod
  const firstDxIdx = dxArr.findIndex(v => !isNaN(v));
  if (firstDxIdx === -1 || firstDxIdx + adxPeriod > n) return { adx: adxArr, plusDI, minusDI };

  let adxVal = dxArr.slice(firstDxIdx, firstDxIdx + adxPeriod).reduce((a, b) => a + b, 0) / adxPeriod;
  adxArr[firstDxIdx + adxPeriod - 1] = adxVal;
  for (let i = firstDxIdx + adxPeriod; i < n; i++) {
    if (!isNaN(dxArr[i])) {
      adxVal = (adxVal * (adxPeriod - 1) + dxArr[i]) / adxPeriod;
      adxArr[i] = adxVal;
    }
  }

  return { adx: adxArr, plusDI, minusDI };
}
