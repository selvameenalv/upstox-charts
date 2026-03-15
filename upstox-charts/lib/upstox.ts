// lib/upstox.ts
import { OHLCV } from './indicators';

const BASE = 'https://api.upstox.com/v2';

export async function fetchOHLCV(symbol: string, days = 200): Promise<OHLCV[]> {
  const token = process.env.UPSTOX_TOKEN;
  if (!token) throw new Error('UPSTOX_TOKEN env variable is not set');

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };

  // Build instrument key — NSE equity standard format
  const instrumentKey = encodeURIComponent(`NSE_EQ|${symbol.toUpperCase()}`);

  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(toDate.getDate() - days);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const url = `${BASE}/historical-candle/${instrumentKey}/day/${fmt(toDate)}/${fmt(fromDate)}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Upstox API error for ${symbol}: ${res.status} — ${txt.slice(0, 200)}`);
  }

  const json = await res.json();
  const candles: number[][] = json?.data?.candles ?? [];

  if (!candles.length) throw new Error(`No data returned for ${symbol}`);

  return candles
    .map(c => ({
      date: new Date(c[0]).toISOString().slice(0, 10),
      open: c[1],
      high: c[2],
      low: c[3],
      close: c[4],
      volume: c[5],
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
