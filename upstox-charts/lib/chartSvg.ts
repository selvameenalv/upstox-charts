// lib/chartSvg.ts
// Renders a 4-panel trading chart as an SVG string

import { OHLCV, ema, bollingerBands, keltnerChannels, squeezeMomentum, rsi, adx } from './indicators';

const W = 1280;
const PAD_L = 72;   // left: date area + left price axis
const PAD_R = 72;   // right: right price axis
const PAD_TOP = 50;
const PAD_BOT = 52; // extra room for date labels
const CHART_W = W - PAD_L - PAD_R;

// Panel heights
const H_PRICE = 340;
const H_SQ = 100;
const H_RSI = 100;
const H_ADX = 100;
const GAP = 8;

const TOTAL_H = PAD_TOP + H_PRICE + GAP + H_SQ + GAP + H_RSI + GAP + H_ADX + PAD_BOT;

// Y-axis offsets
const Y_PRICE = PAD_TOP;
const Y_SQ = Y_PRICE + H_PRICE + GAP;
const Y_RSI = Y_SQ + H_SQ + GAP;
const Y_ADX = Y_RSI + H_RSI + GAP;

const BG = '#0d1117';
const PANEL_BG = '#0d1117';
const GRID = '#21262d';
const TEXT = '#8b949e';
const TEXT_BRIGHT = '#e6edf3';
const GREEN = '#26a641';
const RED = '#f85149';
const BLUE = '#58a6ff';
const ORANGE = '#f0883e';
const YELLOW = '#d29922';
const PURPLE = '#a371f7';

function scaleY(val: number, min: number, max: number, panelTop: number, panelH: number): number {
  const range = max - min || 1;
  return panelTop + panelH - ((val - min) / range) * panelH;
}

function xPos(i: number, total: number): number {
  return PAD_L + (i / (total - 1)) * CHART_W;
}

function polyline(points: [number, number][], color: string, width = 1.2, dash = ''): string {
  const pts = points.filter(([, y]) => !isNaN(y));
  if (pts.length < 2) return '';
  const d = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return `<polyline points="${d}" fill="none" stroke="${color}" stroke-width="${width}" ${dash ? `stroke-dasharray="${dash}"` : ''} />`;
}

function hline(y: number, panelTop: number, panelH: number, color: string, dash = ''): string {
  const cy = panelTop + y * panelH;
  return `<line x1="${PAD_L}" y1="${cy.toFixed(1)}" x2="${PAD_L + CHART_W}" y2="${cy.toFixed(1)}" stroke="${color}" stroke-width="0.6" ${dash ? `stroke-dasharray="${dash}"` : ''} />`;
}

export function renderChartSvg(data: OHLCV[], symbol: string, stockName: string): string {
  const n = data.length;
  const close = data.map(d => d.close);
  const high = data.map(d => d.high);
  const low = data.map(d => d.low);
  const open = data.map(d => d.open);

  // Indicators — ADX(13,8)
  const ema20 = ema(close, 20);
  const bb = bollingerBands(close);
  const kc = keltnerChannels(close, high, low);
  const sq = squeezeMomentum(close, high, low);
  const rsiVals = rsi(close);
  const adxVals = adx(high, low, close, 13, 8);

  // ── Price panel scale ──
  const allPriceVals = [...close, ...bb.upper, ...bb.lower].filter(v => !isNaN(v));
  const priceMin = Math.min(...allPriceVals) * 0.998;
  const priceMax = Math.max(...allPriceVals) * 1.002;

  // ── Squeeze panel scale ──
  const momVals = sq.momentum.filter(v => !isNaN(v));
  const momMax = Math.max(Math.abs(Math.min(...momVals)), Math.abs(Math.max(...momVals))) * 1.1 || 1;
  const momMin = -momMax;

  const xs = data.map((_, i) => xPos(i, n));

  // ─── PRICE PANEL ───────────────────────────────────────────────────
  // BB fill
  const bbUpperPts = bb.upper.map((v, i) => [xs[i], scaleY(v, priceMin, priceMax, Y_PRICE, H_PRICE)] as [number, number]);
  const bbLowerPts = bb.lower.map((v, i) => [xs[i], scaleY(v, priceMin, priceMax, Y_PRICE, H_PRICE)] as [number, number]);

  const bbFillPath = (() => {
    const top = bbUpperPts.filter(([, y]) => !isNaN(y));
    const bot = [...bbLowerPts.filter(([, y]) => !isNaN(y))].reverse();
    if (top.length < 2) return '';
    const d = top.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ') +
      ' L ' + bot.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ');
    return `<path d="M ${d} Z" fill="${BLUE}" fill-opacity="0.07" />`;
  })();

  // Candlesticks
  const barW = Math.max(1, (CHART_W / n) * 0.6);
  const candles = data.map((d, i) => {
    const x = xs[i];
    const color = d.close >= d.open ? GREEN : RED;
    const yHigh = scaleY(d.high, priceMin, priceMax, Y_PRICE, H_PRICE);
    const yLow = scaleY(d.low, priceMin, priceMax, Y_PRICE, H_PRICE);
    const yOpen = scaleY(d.open, priceMin, priceMax, Y_PRICE, H_PRICE);
    const yClose = scaleY(d.close, priceMin, priceMax, Y_PRICE, H_PRICE);
    const bodyTop = Math.min(yOpen, yClose);
    const bodyH = Math.max(1, Math.abs(yClose - yOpen));
    return `
      <line x1="${x.toFixed(1)}" y1="${yHigh.toFixed(1)}" x2="${x.toFixed(1)}" y2="${yLow.toFixed(1)}" stroke="${color}" stroke-width="0.8"/>
      <rect x="${(x - barW / 2).toFixed(1)}" y="${bodyTop.toFixed(1)}" width="${barW.toFixed(1)}" height="${bodyH.toFixed(1)}" fill="${color}" stroke="${color}" stroke-width="0.3"/>`;
  }).join('');

  // KC lines
  const kcUpperLine = polyline(kc.upper.map((v, i) => [xs[i], scaleY(v, priceMin, priceMax, Y_PRICE, H_PRICE)]), YELLOW, 0.9, '4,3');
  const kcLowerLine = polyline(kc.lower.map((v, i) => [xs[i], scaleY(v, priceMin, priceMax, Y_PRICE, H_PRICE)]), YELLOW, 0.9, '4,3');

  // BB lines
  const bbUpperLine = polyline(bbUpperPts, BLUE, 0.7, '2,2');
  const bbLowerLine = polyline(bbLowerPts, BLUE, 0.7, '2,2');

  // EMA20
  const emaLine = polyline(ema20.map((v, i) => [xs[i], scaleY(v, priceMin, priceMax, Y_PRICE, H_PRICE)]), ORANGE, 1.5);

  // Price grid lines + labels — 8 horizontal levels
  const priceLevels = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1];
  const priceGridLines = priceLevels.slice(1, -1).map(frac =>
    `<line x1="${PAD_L}" y1="${(Y_PRICE + H_PRICE * (1 - frac)).toFixed(1)}" x2="${PAD_L + CHART_W}" y2="${(Y_PRICE + H_PRICE * (1 - frac)).toFixed(1)}" stroke="${GRID}" stroke-width="0.5" stroke-dasharray="3,3"/>`
  ).join('');

  // Left + right price axis labels
  const priceYLabels = priceLevels.map(frac => {
    const val = priceMin + (priceMax - priceMin) * frac;
    const y = Y_PRICE + H_PRICE * (1 - frac);
    const fmt = val >= 10000 ? val.toFixed(0) : val >= 1000 ? val.toFixed(1) : val.toFixed(2);
    return [
      `<text x="${(PAD_L - 6).toFixed(1)}" y="${y.toFixed(1)}" fill="${TEXT_BRIGHT}" font-size="9.5" text-anchor="end" dominant-baseline="middle">${fmt}</text>`,
      `<text x="${(PAD_L + CHART_W + 6).toFixed(1)}" y="${y.toFixed(1)}" fill="${TEXT_BRIGHT}" font-size="9.5" text-anchor="start" dominant-baseline="middle">${fmt}</text>`,
    ].join('');
  }).join('');

  // ─── SQUEEZE PANEL ─────────────────────────────────────────────────
  const zeroY = scaleY(0, momMin, momMax, Y_SQ, H_SQ);
  const sqBars = sq.momentum.map((v, i) => {
    if (isNaN(v)) return '';
    const color = v >= 0 ? GREEN : RED;
    const barTop = Math.min(scaleY(v, momMin, momMax, Y_SQ, H_SQ), zeroY);
    const barH = Math.abs(scaleY(v, momMin, momMax, Y_SQ, H_SQ) - zeroY);
    return `<rect x="${(xs[i] - barW / 2).toFixed(1)}" y="${barTop.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(1, barH).toFixed(1)}" fill="${color}" opacity="0.85"/>`;
  }).join('');

  const sqDots = sq.squeezeOn.map((on, i) => {
    const color = on ? RED : GREEN;
    return `<circle cx="${xs[i].toFixed(1)}" cy="${zeroY.toFixed(1)}" r="1.8" fill="${color}"/>`;
  }).join('');

  const sqZeroLine = `<line x1="${PAD_L}" y1="${zeroY.toFixed(1)}" x2="${PAD_L + CHART_W}" y2="${zeroY.toFixed(1)}" stroke="${GRID}" stroke-width="0.8"/>`;

  // ─── RSI PANEL ─────────────────────────────────────────────────────
  const rsiLine = polyline(rsiVals.map((v, i) => [xs[i], scaleY(v, 0, 100, Y_RSI, H_RSI)]), PURPLE, 1.3);
  const rsi70Y = scaleY(70, 0, 100, Y_RSI, H_RSI);
  const rsi30Y = scaleY(30, 0, 100, Y_RSI, H_RSI);
  const rsi50Y = scaleY(50, 0, 100, Y_RSI, H_RSI);

  const rsiOBFill = (() => {
    const pts = rsiVals.map((v, i) => v >= 70 ? `${xs[i].toFixed(1)},${scaleY(v, 0, 100, Y_RSI, H_RSI).toFixed(1)}` : null);
    // Simple approach: draw fill polygon for OB zone
    const valid = rsiVals.map((v, i) => ({ v, i })).filter(({ v }) => v >= 70);
    if (valid.length === 0) return '';
    return valid.map(({ v, i }) => {
      const x = xs[i];
      const y1 = scaleY(v, 0, 100, Y_RSI, H_RSI);
      const y2 = rsi70Y;
      return `<line x1="${x.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${RED}" stroke-width="${barW.toFixed(1)}" opacity="0.15"/>`;
    }).join('');
  })();

  const rsiOSFill = (() => {
    const valid = rsiVals.map((v, i) => ({ v, i })).filter(({ v }) => v <= 30);
    if (valid.length === 0) return '';
    return valid.map(({ v, i }) => {
      const x = xs[i];
      const y1 = scaleY(v, 0, 100, Y_RSI, H_RSI);
      const y2 = rsi30Y;
      return `<line x1="${x.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${GREEN}" stroke-width="${barW.toFixed(1)}" opacity="0.15"/>`;
    }).join('');
  })();

  const rsiHlines = [
    `<line x1="${PAD_L}" y1="${rsi70Y.toFixed(1)}" x2="${PAD_L + CHART_W}" y2="${rsi70Y.toFixed(1)}" stroke="${RED}" stroke-width="0.6" stroke-dasharray="3,3" opacity="0.7"/>`,
    `<line x1="${PAD_L}" y1="${rsi30Y.toFixed(1)}" x2="${PAD_L + CHART_W}" y2="${rsi30Y.toFixed(1)}" stroke="${GREEN}" stroke-width="0.6" stroke-dasharray="3,3" opacity="0.7"/>`,
    `<line x1="${PAD_L}" y1="${rsi50Y.toFixed(1)}" x2="${PAD_L + CHART_W}" y2="${rsi50Y.toFixed(1)}" stroke="${GRID}" stroke-width="0.6"/>`,
  ].join('');

  const rsiLabels = [
    `<text x="${(PAD_L - 5).toFixed(1)}" y="${rsi70Y.toFixed(1)}" fill="${RED}" font-size="8" text-anchor="end" dominant-baseline="middle">70</text>`,
    `<text x="${(PAD_L - 5).toFixed(1)}" y="${rsi50Y.toFixed(1)}" fill="${TEXT}" font-size="8" text-anchor="end" dominant-baseline="middle">50</text>`,
    `<text x="${(PAD_L - 5).toFixed(1)}" y="${rsi30Y.toFixed(1)}" fill="${GREEN}" font-size="8" text-anchor="end" dominant-baseline="middle">30</text>`,
  ].join('');

  // ─── ADX PANEL ─────────────────────────────────────────────────────
  const adxAll = [...adxVals.adx, ...adxVals.plusDI, ...adxVals.minusDI].filter(v => !isNaN(v));
  const adxMax = Math.min(100, Math.max(...adxAll) * 1.1 || 60);
  const adxMin2 = 0;

  const adxLine = polyline(adxVals.adx.map((v, i) => [xs[i], scaleY(v, adxMin2, adxMax, Y_ADX, H_ADX)]), TEXT_BRIGHT, 1.4);
  const plusDILine = polyline(adxVals.plusDI.map((v, i) => [xs[i], scaleY(v, adxMin2, adxMax, Y_ADX, H_ADX)]), GREEN, 1.0);
  const minusDILine = polyline(adxVals.minusDI.map((v, i) => [xs[i], scaleY(v, adxMin2, adxMax, Y_ADX, H_ADX)]), RED, 1.0);
  const adx25Y = scaleY(25, adxMin2, adxMax, Y_ADX, H_ADX);
  const adx25Line = `<line x1="${PAD_L}" y1="${adx25Y.toFixed(1)}" x2="${PAD_L + CHART_W}" y2="${adx25Y.toFixed(1)}" stroke="${YELLOW}" stroke-width="0.6" stroke-dasharray="4,3" opacity="0.7"/>`;
  const adx25Label = `<text x="${(PAD_L - 5).toFixed(1)}" y="${adx25Y.toFixed(1)}" fill="${YELLOW}" font-size="8" text-anchor="end" dominant-baseline="middle">25</text>`;

  // ─── X-AXIS DATE LABELS ────────────────────────────────────────────
  // Show ~15 date labels evenly spaced with tick marks
  const step = Math.max(1, Math.floor(n / 15));
  const dateLabels = data.map((d, i) => {
    if (i % step !== 0 && i !== n - 1) return '';
    const dt = new Date(d.date);
    const day = String(dt.getDate()).padStart(2, '0');
    const mon = dt.toLocaleString('default', { month: 'short' }).toUpperCase();
    const label = `${day} ${mon}`;
    const x = xs[i];
    const tickY = TOTAL_H - PAD_BOT + 2;
    return [
      // tick mark
      `<line x1="${x.toFixed(1)}" y1="${tickY.toFixed(1)}" x2="${x.toFixed(1)}" y2="${(tickY + 5).toFixed(1)}" stroke="${TEXT}" stroke-width="0.8"/>`,
      // rotated date label
      `<text x="${x.toFixed(1)}" y="${(tickY + 8).toFixed(1)}" fill="${TEXT_BRIGHT}" font-size="10" font-weight="500" text-anchor="end" transform="rotate(-45,${x.toFixed(1)},${(tickY + 8).toFixed(1)})">${label}</text>`,
    ].join('');
  }).join('');

  // X axis baseline
  const xAxisLine = `<line x1="${PAD_L}" y1="${(TOTAL_H - PAD_BOT + 2).toFixed(1)}" x2="${(PAD_L + CHART_W).toFixed(1)}" y2="${(TOTAL_H - PAD_BOT + 2).toFixed(1)}" stroke="${GRID}" stroke-width="0.8"/>`;

  // ─── PANEL LABELS ──────────────────────────────────────────────────
  const panelLabels = [
    `<text x="${(PAD_L + 4)}" y="${(Y_SQ + 14)}" fill="${TEXT}" font-size="9.5" font-weight="600">BB/KC SQUEEZE</text>`,
    `<text x="${(PAD_L + 4)}" y="${(Y_RSI + 14)}" fill="${PURPLE}" font-size="9.5" font-weight="600">RSI (14)</text>`,
    `<text x="${(PAD_L + 4)}" y="${(Y_ADX + 14)}" fill="${TEXT_BRIGHT}" font-size="9.5" font-weight="600">ADX(13,8)</text>`,
    `<text x="${(PAD_L + 78)}" y="${(Y_ADX + 14)}" fill="${GREEN}" font-size="9.5" font-weight="600">+DI</text>`,
    `<text x="${(PAD_L + 106)}" y="${(Y_ADX + 14)}" fill="${RED}" font-size="9.5" font-weight="600">-DI</text>`,
  ].join('');

  // Sub-panel Y labels (RSI levels already handled; ADX scale)
  const adxYLabels = [0, 25, 50, 75].map(val => {
    const y = scaleY(val, adxMin2, adxMax, Y_ADX, H_ADX);
    return [
      `<text x="${(PAD_L - 5).toFixed(1)}" y="${y.toFixed(1)}" fill="${TEXT}" font-size="8.5" text-anchor="end" dominant-baseline="middle">${val}</text>`,
      `<text x="${(PAD_L + CHART_W + 5).toFixed(1)}" y="${y.toFixed(1)}" fill="${TEXT}" font-size="8.5" text-anchor="start" dominant-baseline="middle">${val}</text>`,
    ].join('');
  }).join('');

  // ─── LEGEND ────────────────────────────────────────────────────────
  const legend = [
    `<rect x="${PAD_L + 4}" y="${Y_PRICE + 6}" width="20" height="2" fill="${ORANGE}"/>`,
    `<text x="${PAD_L + 28}" y="${Y_PRICE + 12}" fill="${ORANGE}" font-size="9">20 EMA</text>`,
    `<rect x="${PAD_L + 80}" y="${Y_PRICE + 6}" width="20" height="2" fill="${BLUE}" opacity="0.7" stroke-dasharray="2,2"/>`,
    `<text x="${PAD_L + 104}" y="${Y_PRICE + 12}" fill="${BLUE}" font-size="9" opacity="0.85">BB (20,2)</text>`,
    `<rect x="${PAD_L + 168}" y="${Y_PRICE + 6}" width="20" height="2" fill="${YELLOW}" opacity="0.8" stroke-dasharray="4,3"/>`,
    `<text x="${PAD_L + 192}" y="${Y_PRICE + 12}" fill="${YELLOW}" font-size="9" opacity="0.9">KC (20,1.5)</text>`,
  ].join('');

  // ─── TITLE ─────────────────────────────────────────────────────────
  const title = `
    <text x="${W / 2}" y="30" fill="${TEXT_BRIGHT}" font-size="16" font-weight="700" text-anchor="middle" font-family="monospace">${stockName} (${symbol}) — Daily Chart</text>
  `;

  // ─── PANEL BORDERS ─────────────────────────────────────────────────
  const borders = [
    [Y_PRICE, H_PRICE],
    [Y_SQ, H_SQ],
    [Y_RSI, H_RSI],
    [Y_ADX, H_ADX],
  ].map(([y, h]) =>
    `<rect x="${PAD_L}" y="${y}" width="${CHART_W}" height="${h}" fill="none" stroke="#30363d" stroke-width="0.8"/>`
  ).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${TOTAL_H}" viewBox="0 0 ${W} ${TOTAL_H}" style="background:${BG}">
  <defs>
    <style>text { font-family: 'JetBrains Mono', 'Courier New', monospace; }</style>
  </defs>
  <!-- Background -->
  <rect width="${W}" height="${TOTAL_H}" fill="${BG}"/>
  ${title}
  <!-- Price panel -->
  ${priceGridLines}
  ${bbFillPath}
  ${candles}
  ${kcUpperLine}${kcLowerLine}
  ${bbUpperLine}${bbLowerLine}
  ${emaLine}
  ${borders}
  ${priceYLabels}
  ${legend}
  <!-- Squeeze -->
  ${sqBars}
  ${sqZeroLine}
  ${sqDots}
  <!-- RSI -->
  ${rsiHlines}
  ${rsiOBFill}
  ${rsiOSFill}
  ${rsiLine}
  ${rsiLabels}
  <!-- ADX -->
  ${adx25Line}
  ${adxLine}
  ${plusDILine}
  ${minusDILine}
  ${adx25Label}
  <!-- Panel labels -->
  ${panelLabels}
  ${adxYLabels}
  <!-- X axis -->
  ${xAxisLine}
  ${dateLabels}
</svg>`;
}
