// lib/upstox.ts
import { OHLCV } from './indicators';

const BASE = 'https://api.upstox.com/v2';
const INSTRUMENTS_URL = 'https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz';

let instrumentCache: Map<string, string> | null = null;

async function getInstrumentKey(symbol: string): Promise<string> {
  if (!instrumentCache) {
    instrumentCache = new Map();
    try {
      const res = await fetch(INSTRUMENTS_URL);
      const buffer = await res.arrayBuffer();

      // Decompress gzip using DecompressionStream
      const ds = new DecompressionStream('gzip');
      const writer = ds.writable.getWriter();
      const reader = ds.readable.getReader();
      writer.write(new Uint8Array(buffer));
      writer.close();

      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
      const merged = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }

      const text = new TextDecoder().decode(merged);
      const instruments = JSON.parse(text);

      for (const inst of instruments) {
        if (inst.segment === 'NSE_EQ' && inst.instrument_type === 'EQ') {
          instrumentCache.set(inst.trading_symbol.toUpperCase(), inst.instrument_key);
        }
      }
    } catch (e) {
      console.error('Failed to load instruments file:', e);
    }
  }

  const key = instrumentCache.get(symbol.toUpperCase());
  if (!key) throw new Error(`Instrument key not found for symbol: ${symbol}`);
  return key;
}

export async function fetchOHLCV(symbol: string, days = 200): Promise<OHLCV[]> {
  const token = process.env.UPSTOX_TOKEN;
  if (!token) throw new Error('UPSTOX_TOKEN env variable is not set');

  const instrumentKey = await getInstrumentKey(symbol);
  const instrumentKeyEncoded = encodeURIComponent(instrumentKey);

  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(toDate.getDate() - days);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const url = `${BASE}/historical-candle/${instrumentKeyEncoded}/day/${fmt(toDate)}/${fmt(fromDate)}`;

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Upstox API error for ${symbol}: ${res.status} — ${txt.slice(0, 300)}`);
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
