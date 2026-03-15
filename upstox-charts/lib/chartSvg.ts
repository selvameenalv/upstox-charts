// lib/chartSvg.ts — Upstox/TradingView accurate style
import { OHLCV, ema, bollingerBands, keltnerChannels, squeezeMomentum, rsi, adx } from './indicators';

// ── Canvas ───────────────────────────────────────────────────────────
const W        = 1400;
const PAD_L    = 10;
const PAD_R    = 80;   // right price axis
const PAD_TOP  = 60;
const PAD_BOT  = 44;
const CHART_W  = W - PAD_L - PAD_R;

const H_PRICE  = 370;
const H_VOL    = 58;
const H_SQ     = 80;
const H_RSI    = 85;
const H_ADX    = 90;

const Y_PRICE  = PAD_TOP;
const Y_VOL    = Y_PRICE + H_PRICE + 1;
const Y_SQ     = Y_VOL   + H_VOL   + 1;
const Y_RSI    = Y_SQ    + H_SQ    + 1;
const Y_ADX    = Y_RSI   + H_RSI   + 1;
const TOTAL_H  = Y_ADX   + H_ADX   + PAD_BOT;

// ── Upstox colour palette (matched from screenshot) ──────────────────
const BG         = '#131722';   // Upstox dark bg
const PANEL_SEP  = '#2a2e39';
const GRID_COL   = '#1c2030';   // very subtle grid
const AXIS_COL   = '#2a2e39';
const TEXT_DIM   = '#4e5369';
const TEXT_MED   = '#787b86';
const TEXT_BRIGHT= '#d1d4dc';

// Candles — Upstox teal/red
const UP_COL     = '#26a69a';
const DN_COL     = '#ef5350';

// BB — grey/silver fill like Upstox, grey lines
const BB_FILL    = 'rgba(180,185,210,0.13)';
const BB_LINE    = 'rgba(170,175,200,0.6)';

// KC — golden/amber fill + lines (Upstox yellow band)
const KC_FILL    = 'rgba(220,170,60,0.22)';
const KC_LINE    = '#c8951a';

// EMA — thick black/dark line like Upstox
const EMA_COL    = '#d4d4d4';   // white-grey, Upstox style

// Squeeze
const SQ_UP_BRT  = '#26a69a';
const SQ_UP_DIM  = 'rgba(38,166,154,0.4)';
const SQ_DN_BRT  = '#ef5350';
const SQ_DN_DIM  = 'rgba(239,83,80,0.4)';
const SQ_DOT_ON  = '#ef5350';   // red dot = squeeze active
const SQ_DOT_OFF = '#26a69a';   // green dot = squeeze off

// RSI — purple/violet like Upstox
const RSI_COL    = '#9c27b0';
const RSI_OB_COL = '#ef5350';
const RSI_OS_COL = '#26a69a';

// ADX — Upstox uses black/white for ADX, green/red for DI
const ADX_COL    = '#ffffff';
const DI_POS     = '#26a69a';
const DI_NEG     = '#ef5350';
const ADX_25_COL = 'rgba(255,255,255,0.2)';

// ── Helpers ───────────────────────────────────────────────────────────
function sy(val: number, min: number, max: number, top: number, h: number): number {
  return top + h - ((val - min) / (max - min || 1)) * h;
}

function sx(i: number, n: number): number {
  const p = CHART_W * 0.004;
  return PAD_L + p + (i / Math.max(n - 1, 1)) * (CHART_W - p * 2);
}

function pth(pts: [number, number][], color: string, w = 1.2, dash = ''): string {
  const v = pts.filter(([, y]) => isFinite(y));
  if (v.length < 2) return '';
  return `<path d="M ${v.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ')}" fill="none" stroke="${color}" stroke-width="${w}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
}

function hRule(y: number, col: string, w = 0.5, dash = ''): string {
  return `<line x1="${PAD_L}" y1="${y.toFixed(1)}" x2="${(PAD_L + CHART_W).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${col}" stroke-width="${w}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
}

function rLabel(y: number, txt: string, col = TEXT_DIM, bold = false): string {
  return `<text x="${PAD_L + CHART_W + 7}" y="${y.toFixed(1)}" fill="${col}" font-size="10" dominant-baseline="middle" ${bold ? 'font-weight="600"' : ''}>${txt}</text>`;
}

function fmtP(v: number): string {
  if (v >= 100000) return (v / 1000).toFixed(1) + 'k';
  if (v >= 10000) return v.toFixed(0);
  if (v >= 1000) return v.toFixed(2);
  return v.toFixed(2);
}

function fmtV(v: number): string {
  if (v >= 1e7) return (v / 1e7).toFixed(1) + 'Cr';
  if (v >= 1e5) return (v / 1e5).toFixed(1) + 'L';
  return (v / 1000).toFixed(0) + 'K';
}

// Nice price steps — many ticks like Upstox
function niceSteps(min: number, max: number, count = 10): number[] {
  const range = max - min;
  const mag = Math.pow(10, Math.floor(Math.log10(range / count)));
  const nice = [1, 2, 2.5, 5, 10].map(f => f * mag).find(s => range / s <= count + 1) || mag;
  const start = Math.ceil(min / nice) * nice;
  const ticks: number[] = [];
  for (let v = start; v <= max + nice * 0.01; v += nice) ticks.push(parseFloat(v.toFixed(10)));
  return ticks;
}

function fillBetween(upper: [number, number][], lower: [number, number][], fill: string): string {
  const u = upper.filter(([, y]) => isFinite(y));
  const l = lower.filter(([, y]) => isFinite(y));
  if (u.length < 2 || l.length < 2) return '';
  const fwd = u.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ');
  const rev = [...l].reverse().map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ');
  return `<path d="M ${fwd} L ${rev} Z" fill="${fill}"/>`;
}

// ════════════════════════════════════════════════════════════════════
export function renderChartSvg(data: OHLCV[], symbol: string, stockName: string): string {
  const n = data.length;
  const close  = data.map(d => d.close);
  const high   = data.map(d => d.high);
  const low    = data.map(d => d.low);
  const open   = data.map(d => d.open);
  const volume = data.map(d => d.volume);

  const ema20   = ema(close, 20);
  const bb      = bollingerBands(close, 20, 2);
  const kc      = keltnerChannels(close, high, low, 20, 1.5);
  const sq      = squeezeMomentum(close, high, low);
  const rsiVals = rsi(close, 14);
  const adxVals = adx(high, low, close, 13, 8);

  const xs   = data.map((_, i) => sx(i, n));
  const barW = Math.max(1.5, (CHART_W / n) * 0.72);

  // ══ PRICE SCALE ════════════════════════════════════════════════════
  // Include BB + KC extremes so bands are always visible
  const allPx  = [...high, ...low, ...bb.upper, ...bb.lower, ...kc.upper, ...kc.lower].filter(isFinite);
  const rawMin = Math.min(...allPx), rawMax = Math.max(...allPx);
  const padPct = (rawMax - rawMin) * 0.05;
  const pMin   = rawMin - padPct, pMax = rawMax + padPct;

  // Dense price ticks like Upstox right axis
  const pTicks    = niceSteps(pMin, pMax, 10);
  const priceGrid = pTicks.map(v => {
    const y = sy(v, pMin, pMax, Y_PRICE, H_PRICE);
    if (y < Y_PRICE || y > Y_PRICE + H_PRICE) return '';
    return hRule(y, GRID_COL, 0.4);
  }).join('');
  const priceAxis = pTicks.map(v => {
    const y = sy(v, pMin, pMax, Y_PRICE, H_PRICE);
    if (y < Y_PRICE - 4 || y > Y_PRICE + H_PRICE + 4) return '';
    return rLabel(y, fmtP(v));
  }).join('');

  // ── BB band (grey fill, grey lines) ──
  const bbUpPts = bb.upper.map((v, i) => [xs[i], sy(v, pMin, pMax, Y_PRICE, H_PRICE)] as [number, number]);
  const bbLoPts = bb.lower.map((v, i) => [xs[i], sy(v, pMin, pMax, Y_PRICE, H_PRICE)] as [number, number]);
  const bbFillSvg = fillBetween(bbUpPts, bbLoPts, BB_FILL);
  const bbUpL     = pth(bbUpPts, BB_LINE, 0.9);
  const bbLoL     = pth(bbLoPts, BB_LINE, 0.9);

  // ── KC band (golden fill, dashed amber lines) ──
  const kcUpPts = kc.upper.map((v, i) => [xs[i], sy(v, pMin, pMax, Y_PRICE, H_PRICE)] as [number, number]);
  const kcLoPts = kc.lower.map((v, i) => [xs[i], sy(v, pMin, pMax, Y_PRICE, H_PRICE)] as [number, number]);
  const kcFillSvg = fillBetween(kcUpPts, kcLoPts, KC_FILL);
  const kcUpL     = pth(kcUpPts, KC_LINE, 1.1, '6,3');
  const kcLoL     = pth(kcLoPts, KC_LINE, 1.1, '6,3');

  // ── EMA 20 (thick, Upstox dark/grey) ──
  const emaL = pth(
    ema20.map((v, i) => [xs[i], sy(v, pMin, pMax, Y_PRICE, H_PRICE)] as [number, number]),
    EMA_COL, 2.0
  );

  // ── Candles ──
  const candles = data.map((d, i) => {
    const x   = xs[i];
    const up  = d.close >= d.open;
    const col = up ? UP_COL : DN_COL;
    const yH  = sy(d.high,  pMin, pMax, Y_PRICE, H_PRICE);
    const yL  = sy(d.low,   pMin, pMax, Y_PRICE, H_PRICE);
    const yO  = sy(d.open,  pMin, pMax, Y_PRICE, H_PRICE);
    const yC  = sy(d.close, pMin, pMax, Y_PRICE, H_PRICE);
    const bT  = Math.min(yO, yC);
    const bH  = Math.max(1, Math.abs(yC - yO));
    return [
      `<line x1="${x.toFixed(1)}" y1="${yH.toFixed(1)}" x2="${x.toFixed(1)}" y2="${yL.toFixed(1)}" stroke="${col}" stroke-width="1"/>`,
      `<rect x="${(x - barW / 2).toFixed(1)}" y="${bT.toFixed(1)}" width="${barW.toFixed(1)}" height="${bH.toFixed(1)}" fill="${col}"/>`,
    ].join('');
  }).join('');

  // ── Last price pill (Upstox teal pill on right axis) ──
  const lastC   = close[close.length - 1];
  const lastPY  = sy(lastC, pMin, pMax, Y_PRICE, H_PRICE);
  const lastLine = hRule(lastPY, UP_COL, 0.6, '3,3');
  const lastPill = `
    <rect x="${PAD_L + CHART_W}" y="${(lastPY - 9).toFixed(1)}" width="${PAD_R - 2}" height="18" rx="2" fill="${UP_COL}"/>
    <text x="${(PAD_L + CHART_W + PAD_R / 2 - 1).toFixed(1)}" y="${(lastPY + 1).toFixed(1)}" fill="#fff" font-size="10.5" font-weight="700" text-anchor="middle" dominant-baseline="middle">${fmtP(lastC)}</text>`;

  // ══ VOLUME ═════════════════════════════════════════════════════════
  const volMax  = Math.max(...volume) * 1.08;
  const volBars = data.map((d, i) => {
    const up  = d.close >= d.open;
    const col = up ? `rgba(38,166,154,0.55)` : `rgba(239,83,80,0.55)`;
    const yH  = sy(d.volume, 0, volMax, Y_VOL, H_VOL);
    const yB  = Y_VOL + H_VOL;
    return `<rect x="${(xs[i] - barW / 2).toFixed(1)}" y="${yH.toFixed(1)}" width="${barW.toFixed(1)}" height="${(yB - yH).toFixed(1)}" fill="${col}"/>`;
  }).join('');

  // ══ SQUEEZE ════════════════════════════════════════════════════════
  const momArr    = sq.momentum.filter(isFinite);
  const mAbsMax   = Math.max(...momArr.map(Math.abs), 1) * 1.1;
  const mMin      = -mAbsMax, mMax = mAbsMax;
  const zeroSqY   = sy(0, mMin, mMax, Y_SQ, H_SQ);

  const sqBars = sq.momentum.map((v, i) => {
    if (!isFinite(v)) return '';
    const prev = i > 0 ? sq.momentum[i - 1] : v;
    let col: string;
    if (v >= 0)  col = v >= prev ? SQ_UP_BRT : SQ_UP_DIM;
    else         col = v <= prev ? SQ_DN_BRT : SQ_DN_DIM;
    const yTop = Math.min(sy(v, mMin, mMax, Y_SQ, H_SQ), zeroSqY);
    const bH   = Math.max(1, Math.abs(sy(v, mMin, mMax, Y_SQ, H_SQ) - zeroSqY));
    return `<rect x="${(xs[i] - barW / 2).toFixed(1)}" y="${yTop.toFixed(1)}" width="${barW.toFixed(1)}" height="${bH.toFixed(1)}" fill="${col}"/>`;
  }).join('');

  // Squeeze dots on zero line
  const sqDots = sq.squeezeOn.map((on, i) =>
    `<circle cx="${xs[i].toFixed(1)}" cy="${zeroSqY.toFixed(1)}" r="1.8" fill="${on ? SQ_DOT_ON : SQ_DOT_OFF}"/>`
  ).join('');

  // ══ RSI ════════════════════════════════════════════════════════════
  const rsiPts = rsiVals.map((v, i) => [xs[i], sy(v, 0, 100, Y_RSI, H_RSI)] as [number, number]);
  const r70y   = sy(70, 0, 100, Y_RSI, H_RSI);
  const r50y   = sy(50, 0, 100, Y_RSI, H_RSI);
  const r30y   = sy(30, 0, 100, Y_RSI, H_RSI);

  // OB/OS shading
  const rsiObShade = rsiVals.map((v, i) => {
    if (v < 70 || !isFinite(v)) return '';
    const y1 = sy(v, 0, 100, Y_RSI, H_RSI);
    return `<line x1="${xs[i].toFixed(1)}" y1="${y1.toFixed(1)}" x2="${xs[i].toFixed(1)}" y2="${r70y.toFixed(1)}" stroke="${RSI_OB_COL}" stroke-width="${barW.toFixed(1)}" opacity="0.18"/>`;
  }).join('');
  const rsiOsShade = rsiVals.map((v, i) => {
    if (v > 30 || !isFinite(v)) return '';
    const y1 = sy(v, 0, 100, Y_RSI, H_RSI);
    return `<line x1="${xs[i].toFixed(1)}" y1="${y1.toFixed(1)}" x2="${xs[i].toFixed(1)}" y2="${r30y.toFixed(1)}" stroke="${RSI_OS_COL}" stroke-width="${barW.toFixed(1)}" opacity="0.18"/>`;
  }).join('');

  const lastRsi  = rsiVals.filter(isFinite).slice(-1)[0] ?? 50;
  const lastRsiY = sy(lastRsi, 0, 100, Y_RSI, H_RSI);

  // RSI pill
  const rsiPill = `
    <rect x="${PAD_L + CHART_W}" y="${(lastRsiY - 8).toFixed(1)}" width="${PAD_R - 2}" height="16" rx="2" fill="${RSI_COL}"/>
    <text x="${(PAD_L + CHART_W + PAD_R / 2 - 1).toFixed(1)}" y="${(lastRsiY + 1).toFixed(1)}" fill="#fff" font-size="10" font-weight="700" text-anchor="middle" dominant-baseline="middle">${lastRsi.toFixed(1)}</text>`;

  // ══ ADX ════════════════════════════════════════════════════════════
  const adxAll  = [...adxVals.adx, ...adxVals.plusDI, ...adxVals.minusDI].filter(isFinite);
  const adxMax  = Math.min(100, Math.max(...adxAll) * 1.12 || 60);
  const adxMin2 = 0;

  const adxPts  = adxVals.adx.map((v, i)     => [xs[i], sy(v, adxMin2, adxMax, Y_ADX, H_ADX)] as [number, number]);
  const pDIPts  = adxVals.plusDI.map((v, i)  => [xs[i], sy(v, adxMin2, adxMax, Y_ADX, H_ADX)] as [number, number]);
  const mDIPts  = adxVals.minusDI.map((v, i) => [xs[i], sy(v, adxMin2, adxMax, Y_ADX, H_ADX)] as [number, number]);
  const adx25y  = sy(25, adxMin2, adxMax, Y_ADX, H_ADX);

  // ADX right-axis ticks (0, 20, 40 style)
  const adxTicks = niceSteps(adxMin2, adxMax, 4);
  const adxAxis  = adxTicks.map(v => {
    const y = sy(v, adxMin2, adxMax, Y_ADX, H_ADX);
    return (y < Y_ADX - 4 || y > Y_ADX + H_ADX + 4) ? '' : rLabel(y, v.toFixed(0));
  }).join('');

  // ADX grid lines
  const adxGrid = adxTicks.map(v => {
    const y = sy(v, adxMin2, adxMax, Y_ADX, H_ADX);
    return (y < Y_ADX || y > Y_ADX + H_ADX) ? '' : hRule(y, GRID_COL, 0.4);
  }).join('');

  const lastAdx = adxVals.adx.filter(isFinite).slice(-1)[0] ?? 0;
  const lastPDI = adxVals.plusDI.filter(isFinite).slice(-1)[0] ?? 0;
  const lastMDI = adxVals.minusDI.filter(isFinite).slice(-1)[0] ?? 0;

  // ══ X-AXIS (monthly ticks) ════════════════════════════════════════
  const xAxisY = Y_ADX + H_ADX;
  let lastMon  = -1;
  const tickIdx: number[] = [];
  data.forEach((d, i) => {
    const m = new Date(d.date).getMonth();
    if (m !== lastMon) { tickIdx.push(i); lastMon = m; }
  });
  const usedIdx = tickIdx.length >= 4 ? tickIdx : data.map((_, i) => i).filter(i => i % 15 === 0);

  const vertGrid = usedIdx.map(i =>
    `<line x1="${xs[i].toFixed(1)}" y1="${Y_PRICE}" x2="${xs[i].toFixed(1)}" y2="${xAxisY}" stroke="${GRID_COL}" stroke-width="0.5"/>`
  ).join('');

  const dateLabels = usedIdx.map(i => {
    const dt  = new Date(data[i].date);
    const mon = dt.toLocaleString('default', { month: 'short' });
    const yr  = `'${dt.getFullYear().toString().slice(2)}`;
    // Show year only on Jan, otherwise just month
    const lbl = dt.getMonth() === 0 ? `${dt.getFullYear()}` : mon;
    const x   = xs[i];
    return [
      `<line x1="${x.toFixed(1)}" y1="${xAxisY}" x2="${x.toFixed(1)}" y2="${(xAxisY + 3).toFixed(1)}" stroke="${TEXT_DIM}" stroke-width="0.8"/>`,
      `<text x="${x.toFixed(1)}" y="${(xAxisY + 16).toFixed(1)}" fill="${TEXT_MED}" font-size="10.5" text-anchor="middle">${lbl}</text>`,
    ].join('');
  }).join('');

  // ══ TITLE + LEGEND ════════════════════════════════════════════════
  const last   = data[data.length - 1];
  const prev   = data[data.length - 2];
  const chg    = last.close - prev.close;
  const chgPct = (chg / prev.close) * 100;
  const isUp   = chg >= 0;
  const chgCol = isUp ? UP_COL : DN_COL;
  const sign   = isUp ? '+' : '';

  const titleBlock = `
    <text x="${PAD_L + 10}" y="20" fill="${TEXT_BRIGHT}" font-size="14" font-weight="700">${stockName}</text>
    <text x="${PAD_L + 10}" y="38" fill="${TEXT_DIM}" font-size="10.5">${symbol} · NSE · Daily</text>
    <text x="${PAD_L + 210}" y="20" fill="${TEXT_BRIGHT}" font-size="11.5" font-weight="600">O ${fmtP(last.open)}  H ${fmtP(last.high)}  L ${fmtP(last.low)}  C ${fmtP(last.close)}</text>
    <text x="${PAD_L + 210}" y="38" fill="${chgCol}" font-size="11" font-weight="600">${sign}${fmtP(chg)}  (${sign}${chgPct.toFixed(2)}%)</text>`;

  // Legend — match Upstox label style
  const legendBlock = `
    <text x="${PAD_L + 10}" y="${(Y_PRICE + 16).toFixed(1)}" fill="${EMA_COL}" font-size="10" font-weight="600">EMA 20</text>
    <text x="${PAD_L + 76}" y="${(Y_PRICE + 16).toFixed(1)}" fill="${BB_LINE}" font-size="10" font-weight="600">BB(20,2)</text>
    <text x="${PAD_L + 148}" y="${(Y_PRICE + 16).toFixed(1)}" fill="${KC_LINE}" font-size="10" font-weight="600">KC(20,1.5)</text>`;

  const panelLbl = (y: number, txt: string, col: string) =>
    `<text x="${PAD_L + 10}" y="${(y + 14).toFixed(1)}" fill="${col}" font-size="10" font-weight="600">${txt}</text>`;

  // ══ ASSEMBLE ══════════════════════════════════════════════════════
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${TOTAL_H}" viewBox="0 0 ${W} ${TOTAL_H}">
<defs>
  <style>text { font-family: -apple-system, 'Segoe UI', 'Trebuchet MS', sans-serif; }</style>
  <clipPath id="cp"><rect x="${PAD_L}" y="${Y_PRICE}" width="${CHART_W}" height="${H_PRICE}"/></clipPath>
  <clipPath id="cv"><rect x="${PAD_L}" y="${Y_VOL}"   width="${CHART_W}" height="${H_VOL}"/></clipPath>
  <clipPath id="cs"><rect x="${PAD_L}" y="${Y_SQ}"    width="${CHART_W}" height="${H_SQ}"/></clipPath>
  <clipPath id="cr"><rect x="${PAD_L}" y="${Y_RSI}"   width="${CHART_W}" height="${H_RSI}"/></clipPath>
  <clipPath id="ca"><rect x="${PAD_L}" y="${Y_ADX}"   width="${CHART_W}" height="${H_ADX}"/></clipPath>
</defs>

<!-- BG -->
<rect width="${W}" height="${TOTAL_H}" fill="${BG}"/>

<!-- Vertical grid -->
${vertGrid}

<!-- ── PRICE PANEL ─────────────────────────────────────── -->
${priceGrid}
<g clip-path="url(#cp)">
  ${kcFillSvg}
  ${kcUpL}${kcLoL}
  ${bbFillSvg}
  ${bbUpL}${bbLoL}
  ${emaL}
  ${candles}
  ${lastLine}
</g>
${priceAxis}
${lastPill}
${legendBlock}

<!-- ── VOLUME ──────────────────────────────────────────── -->
<g clip-path="url(#cv)">${volBars}</g>
${panelLbl(Y_VOL, 'VOLUME', TEXT_MED)}
${rLabel(Y_VOL + 9, fmtV(volMax))}

<!-- ── SQUEEZE ─────────────────────────────────────────── -->
${hRule(zeroSqY, AXIS_COL, 0.8)}
<g clip-path="url(#cs)">${sqBars}</g>
${sqDots}
${panelLbl(Y_SQ, 'BB/KC SQUEEZE', TEXT_MED)}

<!-- ── RSI ─────────────────────────────────────────────── -->
${hRule(r70y, RSI_OB_COL, 0.6, '3,3')}
${hRule(r50y, GRID_COL, 0.5)}
${hRule(r30y, RSI_OS_COL, 0.6, '3,3')}
<g clip-path="url(#cr)">${rsiObShade}${rsiOsShade}${pth(rsiPts, RSI_COL, 1.3)}</g>
${rLabel(r70y, '70', RSI_OB_COL)}
${rLabel(r50y, '50', TEXT_DIM)}
${rLabel(r30y, '30', RSI_OS_COL)}
${rsiPill}
${panelLbl(Y_RSI, `RSI(14) ${lastRsi.toFixed(1)}`, RSI_COL)}

<!-- ── ADX ─────────────────────────────────────────────── -->
${adxGrid}
${hRule(adx25y, ADX_25_COL, 0.7, '5,3')}
<g clip-path="url(#ca)">
  ${pth(adxPts,  ADX_COL, 1.8)}
  ${pth(pDIPts,  DI_POS,  1.2)}
  ${pth(mDIPts,  DI_NEG,  1.2)}
</g>
${adxAxis}
${panelLbl(Y_ADX, `ADX(13,8) ${lastAdx.toFixed(1)}`, ADX_COL)}
<text x="${PAD_L + 118}" y="${(Y_ADX + 14).toFixed(1)}" fill="${DI_POS}" font-size="10" font-weight="600">+DI ${lastPDI.toFixed(1)}</text>
<text x="${PAD_L + 180}" y="${(Y_ADX + 14).toFixed(1)}" fill="${DI_NEG}" font-size="10" font-weight="600">-DI ${lastMDI.toFixed(1)}</text>

<!-- ── BORDERS / SEPARATORS ────────────────────────────── -->
${[Y_VOL, Y_SQ, Y_RSI, Y_ADX].map(y =>
  `<line x1="${PAD_L}" y1="${y}" x2="${PAD_L + CHART_W}" y2="${y}" stroke="${PANEL_SEP}" stroke-width="1"/>`
).join('')}
<line x1="${PAD_L + CHART_W}" y1="${Y_PRICE}" x2="${PAD_L + CHART_W}" y2="${xAxisY}" stroke="${AXIS_COL}" stroke-width="1"/>
<line x1="${PAD_L}" y1="${xAxisY}" x2="${PAD_L + CHART_W}" y2="${xAxisY}" stroke="${AXIS_COL}" stroke-width="1"/>

<!-- ── TITLE ───────────────────────────────────────────── -->
${titleBlock}

<!-- ── X AXIS ──────────────────────────────────────────── -->
${dateLabels}
</svg>`;
}
