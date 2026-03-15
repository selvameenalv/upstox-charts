// pages/api/generate.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchOHLCV } from '../../lib/upstox';
import { renderChartSvg } from '../../lib/chartSvg';
import JSZip from 'jszip';

export const config = {
  api: {
    responseLimit: false,
    bodyParser: { sizeLimit: '1mb' },
  },
};

interface StockInput {
  symbol: string;
  name: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { stocks }: { stocks: StockInput[] } = req.body;
  if (!stocks || !Array.isArray(stocks) || stocks.length === 0) {
    return res.status(400).json({ error: 'No stocks provided' });
  }

  const zip = new JSZip();
  const folder = zip.folder('upstox_charts')!;
  const errors: string[] = [];

  for (let i = 0; i < stocks.length; i++) {
    const { symbol, name } = stocks[i];
    try {
      const ohlcv = await fetchOHLCV(symbol, 200);
      // Use last 120 candles for display
      const display = ohlcv.slice(-120);
      const svg = renderChartSvg(display, symbol, name);
      const filename = `${String(i + 1).padStart(2, '0')}_${symbol}_daily.svg`;
      folder.file(filename, svg);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${symbol}: ${msg}`);
    }
  }

  if (errors.length > 0) {
    folder.file('_errors.txt', errors.join('\n'));
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="upstox_charts.zip"');
  res.send(zipBuffer);
}
