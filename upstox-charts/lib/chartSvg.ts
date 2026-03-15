// lib/chartSvg.ts — TradingView-style chart
import { OHLCV, ema, bollingerBands, keltnerChannels, squeezeMomentum, rsi, adx } from './indicators';

const W       = 1400;
const PAD_L   = 8;
const PAD_R   = 72;
const PAD_TOP = 56;
const PAD_BOT = 48;
const CHART_W = W - PAD_L - PAD_R;

const H_PRICE = 360;
const H_VOL   = 60;
const H_SQ    = 90;
const H_RSI   = 90;
const H_ADX   = 90;

const Y_PRICE = PAD_TOP;
const Y_VOL   = Y_PRICE + H_PRICE + 1;
const Y_SQ    = Y_VOL   + H_VOL   + 1;
const Y_RSI   = Y_SQ    + H_SQ    + 1;
const Y_ADX   = Y_RSI   + H_RSI   + 1;
const TOTAL_H = Y_ADX   + H_ADX   + PAD_BOT;

const BG         = '#131722';
const PANEL_SEP  = '#2a2e39';
const GRID       = '#1e222d';
const AXIS_LINE  = '#363a45';
const TEXT_DIM   = '#5d6374';
const TEXT_MED   = '#9598a1';
const TEXT_BRIGHT= '#d1d4dc';
const GREEN_C    = '#26a69a';
const RED_C      = '#ef5350';
const BB_COLOR   = '#2962ff';
const KC_COLOR   = '#ff9800';
const EMA_COLOR  = '#e040fb';
const RSI_COLOR  = '#7b1fa2';
const ADX_COLOR  = '#d1d4dc';
const DI_POS     = '#26a69a';
const DI_NEG     = '#ef5350';
const ADX_25_COL = '#f5a623';

function sy(val: number, min: number, max: number, top: number, h: number): number {
  return top + h - ((val - min) / (max - min || 1)) * h;
}
function sx(i: number, n: number): number {
  const p = CHART_W * 0.005;
  return PAD_L + p + (i / Math.max(n - 1, 1)) * (CHART_W - p * 2);
}
function pth(pts: [number,number][], color: string, w=1.2, dash='', op=1): string {
  const v = pts.filter(([,y]) => isFinite(y));
  if (v.length < 2) return '';
  return `<path d="M ${v.map(([x,y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ')}" fill="none" stroke="${color}" stroke-width="${w}" ${dash?`stroke-dasharray="${dash}"`:''}  opacity="${op}"/>`;
}
function hRule(y: number, col: string, w=0.5, dash=''): string {
  return `<line x1="${PAD_L}" y1="${y.toFixed(1)}" x2="${(PAD_L+CHART_W).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${col}" stroke-width="${w}" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
}
function rLabel(y: number, txt: string, col=TEXT_DIM): string {
  return `<text x="${PAD_L+CHART_W+6}" y="${y.toFixed(1)}" fill="${col}" font-size="10" dominant-baseline="middle">${txt}</text>`;
}
function fmtP(v: number): string {
  if (v>=100000) return (v/1000).toFixed(1)+'k';
  if (v>=10000)  return v.toFixed(0);
  if (v>=1000)   return v.toFixed(1);
  return v.toFixed(2);
}
function fmtV(v: number): string {
  if (v>=1e7) return (v/1e7).toFixed(1)+'Cr';
  if (v>=1e5) return (v/1e5).toFixed(1)+'L';
  return (v/1000).toFixed(0)+'K';
}
function niceSteps(min: number, max: number, count=6): number[] {
  const range = max-min;
  const mag   = Math.pow(10, Math.floor(Math.log10(range/count)));
  const nice  = [1,2,2.5,5,10].map(f=>f*mag).find(s=>range/s<=count+1)||mag;
  const start = Math.ceil(min/nice)*nice;
  const ticks: number[] = [];
  for (let v=start; v<=max+nice*0.01; v+=nice) ticks.push(parseFloat(v.toFixed(10)));
  return ticks;
}
function fillBetween(upper: [number,number][], lower: [number,number][], color: string, opacity: number): string {
  const u = upper.filter(([,y])=>isFinite(y));
  const l = lower.filter(([,y])=>isFinite(y));
  if (u.length<2||l.length<2) return '';
  const fwd = u.map(([x,y])=>`${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ');
  const rev = [...l].reverse().map(([x,y])=>`${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ');
  return `<path d="M ${fwd} L ${rev} Z" fill="${color}" opacity="${opacity}"/>`;
}

export function renderChartSvg(data: OHLCV[], symbol: string, stockName: string): string {
  const n      = data.length;
  const close  = data.map(d=>d.close);
  const high   = data.map(d=>d.high);
  const low    = data.map(d=>d.low);
  const open   = data.map(d=>d.open);
  const volume = data.map(d=>d.volume);

  const ema20   = ema(close, 20);
  const bb      = bollingerBands(close, 20, 2);
  const kc      = keltnerChannels(close, high, low, 20, 1.5);
  const sq      = squeezeMomentum(close, high, low);
  const rsiVals = rsi(close, 14);
  const adxVals = adx(high, low, close, 13, 8);

  const xs   = data.map((_,i)=>sx(i,n));
  const barW = Math.max(1.5, (CHART_W/n)*0.7);

  // ── PRICE ──────────────────────────────────────────────────────────
  const allPx  = [...high,...low,...bb.upper,...bb.lower].filter(isFinite);
  const rawMin = Math.min(...allPx), rawMax = Math.max(...allPx);
  const pad5   = (rawMax-rawMin)*0.04;
  const pMin   = rawMin-pad5, pMax = rawMax+pad5;

  const pTicks    = niceSteps(pMin, pMax, 7);
  const priceGrid = pTicks.map(v=>{
    const y=sy(v,pMin,pMax,Y_PRICE,H_PRICE);
    return (y<Y_PRICE||y>Y_PRICE+H_PRICE)?'':hRule(y,GRID,0.5);
  }).join('');
  const priceAxis = pTicks.map(v=>{
    const y=sy(v,pMin,pMax,Y_PRICE,H_PRICE);
    return (y<Y_PRICE-5||y>Y_PRICE+H_PRICE+5)?'':rLabel(y,fmtP(v));
  }).join('');

  const bbUpPts = bb.upper.map((v,i)=>[xs[i],sy(v,pMin,pMax,Y_PRICE,H_PRICE)] as [number,number]);
  const bbLoPts = bb.lower.map((v,i)=>[xs[i],sy(v,pMin,pMax,Y_PRICE,H_PRICE)] as [number,number]);
  const kcUpPts = kc.upper.map((v,i)=>[xs[i],sy(v,pMin,pMax,Y_PRICE,H_PRICE)] as [number,number]);
  const kcLoPts = kc.lower.map((v,i)=>[xs[i],sy(v,pMin,pMax,Y_PRICE,H_PRICE)] as [number,number]);

  const bbFill  = fillBetween(bbUpPts, bbLoPts, BB_COLOR, 0.07);
  const bbUpL   = pth(bbUpPts, BB_COLOR, 1.0);
  const bbLoL   = pth(bbLoPts, BB_COLOR, 1.0);
  const kcUpL   = pth(kcUpPts, KC_COLOR, 1.0, '5,3');
  const kcLoL   = pth(kcLoPts, KC_COLOR, 1.0, '5,3');
  const emaL    = pth(ema20.map((v,i)=>[xs[i],sy(v,pMin,pMax,Y_PRICE,H_PRICE)] as [number,number]), EMA_COLOR, 1.6);

  const candles = data.map((d,i)=>{
    const x=xs[i], up=d.close>=d.open;
    const col=up?GREEN_C:RED_C;
    const yH=sy(d.high,pMin,pMax,Y_PRICE,H_PRICE);
    const yL=sy(d.low, pMin,pMax,Y_PRICE,H_PRICE);
    const yO=sy(d.open, pMin,pMax,Y_PRICE,H_PRICE);
    const yC=sy(d.close,pMin,pMax,Y_PRICE,H_PRICE);
    const bTop=Math.min(yO,yC), bH=Math.max(1,Math.abs(yC-yO));
    return `<line x1="${x.toFixed(1)}" y1="${yH.toFixed(1)}" x2="${x.toFixed(1)}" y2="${yL.toFixed(1)}" stroke="${col}" stroke-width="1"/>
<rect x="${(x-barW/2).toFixed(1)}" y="${bTop.toFixed(1)}" width="${barW.toFixed(1)}" height="${bH.toFixed(1)}" fill="${col}"/>`;
  }).join('');

  const lastC    = close[close.length-1];
  const lastPY   = sy(lastC, pMin, pMax, Y_PRICE, H_PRICE);
  const lastLine = hRule(lastPY, GREEN_C, 0.7, '3,3');
  const lastPill = `<rect x="${PAD_L+CHART_W}" y="${(lastPY-9).toFixed(1)}" width="${PAD_R-2}" height="18" rx="2" fill="${GREEN_C}"/>
<text x="${(PAD_L+CHART_W+PAD_R/2-1).toFixed(1)}" y="${(lastPY+1).toFixed(1)}" fill="#fff" font-size="10" font-weight="700" text-anchor="middle" dominant-baseline="middle">${fmtP(lastC)}</text>`;

  // ── VOLUME ─────────────────────────────────────────────────────────
  const volMax  = Math.max(...volume)*1.05;
  const volBars = data.map((d,i)=>{
    const up=d.close>=d.open;
    const vH=sy(d.volume,0,volMax,Y_VOL,H_VOL);
    const vB=Y_VOL+H_VOL;
    const fill=up?`rgba(38,166,154,0.5)`:`rgba(239,83,80,0.5)`;
    return `<rect x="${(xs[i]-barW/2).toFixed(1)}" y="${vH.toFixed(1)}" width="${barW.toFixed(1)}" height="${(vB-vH).toFixed(1)}" fill="${fill}"/>`;
  }).join('');

  // ── SQUEEZE ────────────────────────────────────────────────────────
  const momVals   = sq.momentum.filter(isFinite);
  const mAbsMax   = Math.max(...momVals.map(Math.abs),1)*1.1;
  const mMin      = -mAbsMax, mMax = mAbsMax;
  const zeroSq    = sy(0,mMin,mMax,Y_SQ,H_SQ);

  const sqBars = sq.momentum.map((v,i)=>{
    if (!isFinite(v)) return '';
    const prev = i>0?sq.momentum[i-1]:v;
    let col: string;
    if (v>=0) col = v>=prev ? GREEN_C : 'rgba(38,166,154,0.45)';
    else      col = v<=prev ? RED_C   : 'rgba(239,83,80,0.45)';
    const yTop=Math.min(sy(v,mMin,mMax,Y_SQ,H_SQ),zeroSq);
    const bH  =Math.max(1,Math.abs(sy(v,mMin,mMax,Y_SQ,H_SQ)-zeroSq));
    return `<rect x="${(xs[i]-barW/2).toFixed(1)}" y="${yTop.toFixed(1)}" width="${barW.toFixed(1)}" height="${bH.toFixed(1)}" fill="${col}"/>`;
  }).join('');

  const sqDots = sq.squeezeOn.map((on,i)=>{
    const col = on ? '#ef5350' : '#26a69a';
    return `<circle cx="${xs[i].toFixed(1)}" cy="${zeroSq.toFixed(1)}" r="1.5" fill="${col}"/>`;
  }).join('');

  // ── RSI ────────────────────────────────────────────────────────────
  const rsiPts  = rsiVals.map((v,i)=>[xs[i],sy(v,0,100,Y_RSI,H_RSI)] as [number,number]);
  const r70y=sy(70,0,100,Y_RSI,H_RSI), r50y=sy(50,0,100,Y_RSI,H_RSI), r30y=sy(30,0,100,Y_RSI,H_RSI);

  const rsiObFill = rsiVals.map((v,i)=>{
    if (v<70||!isFinite(v)) return '';
    return `<line x1="${xs[i].toFixed(1)}" y1="${sy(v,0,100,Y_RSI,H_RSI).toFixed(1)}" x2="${xs[i].toFixed(1)}" y2="${r70y.toFixed(1)}" stroke="${RED_C}" stroke-width="${barW.toFixed(1)}" opacity="0.15"/>`;
  }).join('');
  const rsiOsFill = rsiVals.map((v,i)=>{
    if (v>30||!isFinite(v)) return '';
    return `<line x1="${xs[i].toFixed(1)}" y1="${sy(v,0,100,Y_RSI,H_RSI).toFixed(1)}" x2="${xs[i].toFixed(1)}" y2="${r30y.toFixed(1)}" stroke="${GREEN_C}" stroke-width="${barW.toFixed(1)}" opacity="0.15"/>`;
  }).join('');

  const lastRsi  = rsiVals.filter(isFinite).slice(-1)[0]??50;
  const lastRsiY = sy(lastRsi,0,100,Y_RSI,H_RSI);
  const rsiPill  = `<rect x="${PAD_L+CHART_W}" y="${(lastRsiY-8).toFixed(1)}" width="${PAD_R-2}" height="16" rx="2" fill="${RSI_COLOR}" opacity="0.9"/>
<text x="${(PAD_L+CHART_W+PAD_R/2-1).toFixed(1)}" y="${(lastRsiY+1).toFixed(1)}" fill="#fff" font-size="9.5" font-weight="700" text-anchor="middle" dominant-baseline="middle">${lastRsi.toFixed(1)}</text>`;

  // ── ADX ────────────────────────────────────────────────────────────
  const adxAll = [...adxVals.adx,...adxVals.plusDI,...adxVals.minusDI].filter(isFinite);
  const adxMax = Math.min(100,Math.max(...adxAll)*1.1||60);
  const adxMin2= 0;

  const adxPts    = adxVals.adx.map((v,i)    =>[xs[i],sy(v,adxMin2,adxMax,Y_ADX,H_ADX)] as [number,number]);
  const pDIPts    = adxVals.plusDI.map((v,i) =>[xs[i],sy(v,adxMin2,adxMax,Y_ADX,H_ADX)] as [number,number]);
  const mDIPts    = adxVals.minusDI.map((v,i)=>[xs[i],sy(v,adxMin2,adxMax,Y_ADX,H_ADX)] as [number,number]);
  const adx25y    = sy(25,adxMin2,adxMax,Y_ADX,H_ADX);

  const adxTicks  = niceSteps(adxMin2,adxMax,4);
  const adxAxis   = adxTicks.map(v=>{
    const y=sy(v,adxMin2,adxMax,Y_ADX,H_ADX);
    return (y<Y_ADX-5||y>Y_ADX+H_ADX+5)?'':rLabel(y,v.toFixed(0));
  }).join('');

  const lastAdx = adxVals.adx.filter(isFinite).slice(-1)[0]??0;
  const lastPDI = adxVals.plusDI.filter(isFinite).slice(-1)[0]??0;
  const lastMDI = adxVals.minusDI.filter(isFinite).slice(-1)[0]??0;

  // ── X-AXIS ─────────────────────────────────────────────────────────
  const xAxisY = Y_ADX+H_ADX;
  let lastMon = -1;
  const tickIdx: number[] = [];
  data.forEach((d,i)=>{
    const m=new Date(d.date).getMonth();
    if (m!==lastMon){ tickIdx.push(i); lastMon=m; }
  });
  const usedIdx = tickIdx.length>=4 ? tickIdx : data.map((_,i)=>i).filter(i=>i%15===0);

  const dateLabels = usedIdx.map(i=>{
    const dt=new Date(data[i].date);
    const lbl=`${dt.toLocaleString('default',{month:'short'})} '${dt.getFullYear().toString().slice(2)}`;
    const x=xs[i];
    return `<line x1="${x.toFixed(1)}" y1="${xAxisY}" x2="${x.toFixed(1)}" y2="${(xAxisY+4).toFixed(1)}" stroke="${TEXT_DIM}" stroke-width="0.8"/>
<text x="${x.toFixed(1)}" y="${(xAxisY+16).toFixed(1)}" fill="${TEXT_DIM}" font-size="10" text-anchor="middle">${lbl}</text>`;
  }).join('');

  const vertGrid = usedIdx.map(i=>{
    const x=xs[i];
    return `<line x1="${x.toFixed(1)}" y1="${Y_PRICE}" x2="${x.toFixed(1)}" y2="${xAxisY}" stroke="${GRID}" stroke-width="0.5"/>`;
  }).join('');

  // ── TITLE ──────────────────────────────────────────────────────────
  const last=data[data.length-1], prev=data[data.length-2];
  const chg=last.close-prev.close, chgPct=(chg/prev.close)*100;
  const isUp=chg>=0, chgCol=isUp?GREEN_C:RED_C, sign=isUp?'+':'';

  const title=`<text x="${PAD_L+8}" y="22" fill="${TEXT_BRIGHT}" font-size="15" font-weight="700">${stockName}</text>
<text x="${PAD_L+8}" y="40" fill="${TEXT_DIM}" font-size="11">${symbol} · NSE · Daily</text>
<text x="${PAD_L+240}" y="22" fill="${TEXT_BRIGHT}" font-size="12.5" font-weight="600">O ${fmtP(last.open)}  H ${fmtP(last.high)}  L ${fmtP(last.low)}  C ${fmtP(last.close)}</text>
<text x="${PAD_L+240}" y="40" fill="${chgCol}" font-size="11" font-weight="600">${sign}${fmtP(chg)}  (${sign}${chgPct.toFixed(2)}%)</text>`;

  const legend=`<text x="${PAD_L+6}" y="${(Y_PRICE+14).toFixed(1)}" fill="${EMA_COLOR}" font-size="9.5">EMA 20</text>
<text x="${PAD_L+64}" y="${(Y_PRICE+14).toFixed(1)}" fill="${BB_COLOR}" font-size="9.5">BB(20,2)</text>
<text x="${PAD_L+130}" y="${(Y_PRICE+14).toFixed(1)}" fill="${KC_COLOR}" font-size="9.5">KC(20,1.5)</text>`;

  const panelLabel=(y:number,txt:string,col:string)=>
    `<text x="${PAD_L+6}" y="${(y+13).toFixed(1)}" fill="${col}" font-size="9.5" font-weight="600">${txt}</text>`;

  // ══════════════════════════════════════════════
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${TOTAL_H}" viewBox="0 0 ${W} ${TOTAL_H}">
<defs>
  <style>text{font-family:-apple-system,'Trebuchet MS','Segoe UI',sans-serif}</style>
  <clipPath id="cp"><rect x="${PAD_L}" y="${Y_PRICE}" width="${CHART_W}" height="${H_PRICE}"/></clipPath>
  <clipPath id="cv"><rect x="${PAD_L}" y="${Y_VOL}"   width="${CHART_W}" height="${H_VOL}"/></clipPath>
  <clipPath id="cs"><rect x="${PAD_L}" y="${Y_SQ}"    width="${CHART_W}" height="${H_SQ}"/></clipPath>
  <clipPath id="cr"><rect x="${PAD_L}" y="${Y_RSI}"   width="${CHART_W}" height="${H_RSI}"/></clipPath>
  <clipPath id="ca"><rect x="${PAD_L}" y="${Y_ADX}"   width="${CHART_W}" height="${H_ADX}"/></clipPath>
</defs>
<rect width="${W}" height="${TOTAL_H}" fill="${BG}"/>
${vertGrid}
<!-- PRICE -->
${priceGrid}
<g clip-path="url(#cp)">${bbFill}${bbUpL}${bbLoL}${kcUpL}${kcLoL}${emaL}${candles}${lastLine}</g>
${priceAxis}${lastPill}${legend}
<!-- VOLUME -->
<g clip-path="url(#cv)">${volBars}</g>
${panelLabel(Y_VOL,'VOLUME',TEXT_MED)}
${rLabel(Y_VOL+10, fmtV(volMax))}
<!-- SQUEEZE -->
${hRule(zeroSq,AXIS_LINE,0.8)}
<g clip-path="url(#cs)">${sqBars}${sqDots}</g>
${panelLabel(Y_SQ,'BB/KC SQUEEZE',TEXT_MED)}
<!-- RSI -->
${hRule(r70y,RED_C,0.6,'3,3')}${hRule(r50y,GRID,0.5)}${hRule(r30y,GREEN_C,0.6,'3,3')}
<g clip-path="url(#cr)">${rsiObFill}${rsiOsFill}${pth(rsiPts,RSI_COLOR,1.3)}</g>
${rLabel(r70y,'70',RED_C)}${rLabel(r50y,'50',TEXT_DIM)}${rLabel(r30y,'30',GREEN_C)}
${rsiPill}
${panelLabel(Y_RSI,`RSI(14)  ${lastRsi.toFixed(1)}`,RSI_COLOR)}
<!-- ADX -->
${hRule(adx25y,ADX_25_COL,0.6,'4,3')}
<g clip-path="url(#ca)">${pth(adxPts,ADX_COLOR,1.4)}${pth(pDIPts,DI_POS,1.1)}${pth(mDIPts,DI_NEG,1.1)}</g>
${adxAxis}
${panelLabel(Y_ADX,`ADX(13,8) ${lastAdx.toFixed(1)}`,ADX_COLOR)}
<text x="${PAD_L+112}" y="${(Y_ADX+13).toFixed(1)}" fill="${DI_POS}" font-size="9.5" font-weight="600">+DI ${lastPDI.toFixed(1)}</text>
<text x="${PAD_L+172}" y="${(Y_ADX+13).toFixed(1)}" fill="${DI_NEG}" font-size="9.5" font-weight="600">-DI ${lastMDI.toFixed(1)}</text>
<!-- SEPARATORS -->
${[Y_VOL,Y_SQ,Y_RSI,Y_ADX].map(y=>`<line x1="${PAD_L}" y1="${y}" x2="${PAD_L+CHART_W}" y2="${y}" stroke="${PANEL_SEP}" stroke-width="1"/>`).join('')}
<line x1="${PAD_L+CHART_W}" y1="${Y_PRICE}" x2="${PAD_L+CHART_W}" y2="${xAxisY}" stroke="${AXIS_LINE}" stroke-width="1"/>
<line x1="${PAD_L}" y1="${xAxisY}" x2="${PAD_L+CHART_W}" y2="${xAxisY}" stroke="${AXIS_LINE}" stroke-width="1"/>
<!-- TITLE -->
${title}
<!-- X AXIS -->
${dateLabels}
</svg>`;
}
