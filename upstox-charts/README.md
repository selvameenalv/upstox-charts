# 📈 Upstox Chart Generator

A Next.js app that generates trading charts for your top-10-by-volume NSE stocks,
downloadable as a ZIP of SVG files.

## Charts Include
- Candlesticks (120 daily bars)
- Bollinger Bands (20, 2σ) + Keltner Channels (20, 1.5×ATR)
- BB/KC Squeeze momentum histogram with squeeze dots
- 20 EMA
- RSI (14) with OB/OS zones
- ADX (14) with +DI and -DI

---

## Local Development

```bash
npm install

# Create environment file
cp .env.example .env.local
# Edit .env.local and paste your Upstox access token

npm run dev
# Open http://localhost:3000
```

---

## Deploy to Vercel

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "init"
gh repo create upstox-charts --public --push
```

### 2. Import on Vercel
- Go to https://vercel.com/new
- Import your GitHub repo
- Framework: **Next.js** (auto-detected)

### 3. Add Environment Variable
In Vercel Project Settings → **Environment Variables**:

| Key | Value |
|---|---|
| `UPSTOX_TOKEN` | `your_upstox_access_token` |

> ✅ This keeps your token secure — it's never exposed to the browser.

### 4. Deploy
Click **Deploy**. Done. Vercel auto-deploys on every push.

---

## How to Use

1. Paste your tab-separated stock list (from screener.in or similar)
2. App auto-picks top 10 by Volume
3. Click **Generate & Download ZIP**
4. Open the SVGs — they render perfectly in any browser

---

## File Structure

```
pages/
  index.tsx          — UI
  api/generate.ts    — API route (server-side, reads UPSTOX_TOKEN)
lib/
  upstox.ts          — Upstox API client
  indicators.ts      — BB, KC, Squeeze, RSI, ADX calculations (pure TS)
  chartSvg.ts        — SVG chart renderer
styles/
  Home.module.css    — Dark terminal UI
```

## Token Notes

- For a **read-only extended token** (valid 1 year): generate from
  https://pro.upstox.com/developer/apps
- Standard access tokens expire at 3:30 AM daily
- The token is only used server-side in the API route — never sent to the browser
