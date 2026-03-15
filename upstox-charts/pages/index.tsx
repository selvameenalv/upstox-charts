// pages/index.tsx
import { useState, useMemo } from 'react';
import Head from 'next/head';
import styles from '../styles/Home.module.css';

interface Stock {
  sr: string;
  name: string;
  symbol: string;
  chg: number;
  price: number;
  volume: number;
}

function parseStocks(raw: string): Stock[] {
  return raw
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .flatMap(line => {
      const parts = line.split(/\t/);
      if (parts.length < 7) return [];
      try {
        return [{
          sr: parts[0].trim(),
          name: parts[1].trim(),
          symbol: parts[2].trim(),
          chg: parseFloat(parts[4]),
          price: parseFloat(parts[5]),
          volume: parseInt(parts[6].replace(/,/g, ''), 10),
        }];
      } catch {
        return [];
      }
    });
}

type LogEntry = { symbol: string; status: 'ok' | 'err'; msg: string };

export default function Home() {
  const [raw, setRaw] = useState('');
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [done, setDone] = useState(false);

  const parsed = useMemo(() => {
    const stocks = parseStocks(raw);
    return stocks.sort((a, b) => b.volume - a.volume).slice(0, 10);
  }, [raw]);

  async function handleGenerate() {
    if (!parsed.length) return;
    setLoading(true);
    setLog([]);
    setDone(false);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stocks: parsed.map(s => ({ symbol: s.symbol, name: s.name })),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setLog([{ symbol: 'ERROR', status: 'err', msg: err.error || 'Unknown error' }]);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'upstox_charts.zip';
      a.click();
      URL.revokeObjectURL(url);

      setLog(parsed.map(s => ({ symbol: s.symbol, status: 'ok' as const, msg: s.name })));
      setDone(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLog([{ symbol: 'NETWORK', status: 'err', msg }]);
    } finally {
      setLoading(false);
    }
  }

  const fmt = (n: number) => n.toLocaleString('en-IN');

  return (
    <>
      <Head>
        <title>Upstox Chart Generator</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Syne:wght@400;600;700;800&display=swap" rel="stylesheet" />
      </Head>

      <div className={styles.root}>
        {/* ── Header ── */}
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <div className={styles.logo}>
              <span className={styles.logoIcon}>▲</span>
              <span className={styles.logoText}>CHART<span className={styles.logoAccent}>GEN</span></span>
            </div>
            <div className={styles.headerMeta}>
              <span className={styles.chip}>BB · KC · EMA · RSI · ADX</span>
              <span className={styles.chip}>Daily · NSE</span>
            </div>
          </div>
        </header>

        <main className={styles.main}>
          {/* ── Input ── */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.stepNum}>01</span>
              <h2 className={styles.cardTitle}>Paste Stock Data</h2>
              <span className={styles.cardHint}>Tab-separated · Sr · Name · Symbol · Links · %Chg · Price · Volume</span>
            </div>

            <textarea
              className={styles.textarea}
              value={raw}
              onChange={e => setRaw(e.target.value)}
              placeholder={`1\tInfosys Limited\tINFY\tP&F | F.A\t2.89\t1686\t23097876\n2\tWipro Limited\tWIPRO\tP&F | F.A\t3.1\t272.65\t14649962`}
              spellCheck={false}
            />
            <div className={styles.inputMeta}>
              {raw.trim() ? (
                <span className={styles.parseOk}>
                  {parseStocks(raw).length} stocks parsed · showing top {parsed.length} by volume
                </span>
              ) : (
                <span className={styles.parseDim}>Paste your screener export above</span>
              )}
            </div>
          </section>

          {/* ── Preview Table ── */}
          {parsed.length > 0 && (
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.stepNum}>02</span>
                <h2 className={styles.cardTitle}>Top {parsed.length} by Volume</h2>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Symbol</th>
                      <th>Stock Name</th>
                      <th className={styles.right}>Price ₹</th>
                      <th className={styles.right}>%Chg</th>
                      <th className={styles.right}>Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.map((s, i) => (
                      <tr key={s.symbol}>
                        <td className={styles.dim}>{i + 1}</td>
                        <td className={styles.symbol}>{s.symbol}</td>
                        <td>{s.name}</td>
                        <td className={styles.right}>{s.price.toFixed(2)}</td>
                        <td className={`${styles.right} ${s.chg >= 0 ? styles.green : styles.red}`}>
                          {s.chg >= 0 ? '+' : ''}{s.chg.toFixed(2)}%
                        </td>
                        <td className={styles.right}>{fmt(s.volume)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── Generate ── */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.stepNum}>03</span>
              <h2 className={styles.cardTitle}>Generate Charts</h2>
              <span className={styles.cardHint}>Fetches from Upstox API · plots locally · downloads ZIP</span>
            </div>

            <button
              className={styles.btn}
              onClick={handleGenerate}
              disabled={loading || parsed.length === 0}
            >
              {loading ? (
                <><span className={styles.spinner} /> Generating charts…</>
              ) : (
                <><span className={styles.btnIcon}>⬇</span> Generate &amp; Download ZIP</>
              )}
            </button>

            {/* Log */}
            {log.length > 0 && (
              <div className={styles.log}>
                {log.map((entry, i) => (
                  <div key={i} className={`${styles.logRow} ${entry.status === 'ok' ? styles.logOk : styles.logErr}`}>
                    <span className={styles.logIcon}>{entry.status === 'ok' ? '✓' : '✗'}</span>
                    <span className={styles.logSymbol}>{entry.symbol}</span>
                    <span className={styles.logMsg}>{entry.msg}</span>
                  </div>
                ))}
              </div>
            )}

            {done && (
              <div className={styles.successBanner}>
                ✓ {parsed.length} chart{parsed.length > 1 ? 's' : ''} generated — check your downloads folder
              </div>
            )}
          </section>
        </main>

        <footer className={styles.footer}>
          BB / KC Squeeze · 20 EMA · RSI (14) · ADX (14) +DI / -DI · Daily · NSE
        </footer>
      </div>
    </>
  );
}
