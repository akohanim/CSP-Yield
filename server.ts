import express from "express";
import YahooFinance from 'yahoo-finance2';
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Health check
  app.get("/api/status", (req, res) => {
    res.json({ 
      status: "ok", 
      backend: "node/yahoo-finance",
      env: process.env.NODE_ENV 
    });
  });

  // Simple in-memory cache for bulk options
  const bulkCache = new Map<string, { data: any, timestamp: number }>();
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Optimized Bulk Options Endpoint using Yahoo Finance
  app.get("/api/bulk-options", async (req, res) => {
    const { ticker } = req.query;
    if (!ticker || typeof ticker !== 'string') {
      return res.status(400).json({ error: "Ticker is required", s: "error" });
    }

    const upperTicker = ticker.toUpperCase();
    const now = Date.now();

    // Check cache
    const cached = bulkCache.get(upperTicker);
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      console.log(`[Bulk Options Cache Hit] Ticker: ${upperTicker}`);
      return res.json(cached.data);
    }

    console.log(`[Bulk Options Request] Ticker: ${upperTicker}`);

    try {
      console.log(`[Bulk Options] Fetching initial Yahoo data for ${upperTicker}...`);
      const initialData = await yahooFinance.options(upperTicker) as any;
      const expirationDates = initialData.expirationDates || [];

      if (expirationDates.length === 0) {
        return res.json({ s: 'ok', expirations: {} });
      }

      const topExpirations = expirationDates.slice(0, 10);
      const expirationsMap: Record<string, any[]> = {};

      const chainPromises = topExpirations.map(async (expDate: Date) => {
        try {
          const formattedDate = expDate.toISOString().split('T')[0];
          const chainData = await yahooFinance.options(upperTicker, { date: formattedDate }) as any;
          const currentOption = chainData.options?.[0];
          if (currentOption && currentOption.puts) {
            const contracts = currentOption.puts.map((row: any) => ({
              ticker: row.contractSymbol || 'UNKNOWN',
              strike: row.strike || 0,
              bid: row.bid || 0,
              ask: row.ask || 0,
              last: row.lastPrice || 0,
              vol: row.volume || 0,
              oi: row.openInterest || 0,
              updated: row.lastTradeDate ? row.lastTradeDate.toISOString() : '',
              iv: row.impliedVolatility || 0,
              delta: -0.3,
              theta: -0.05
            }));
            if (contracts.length > 0) {
              expirationsMap[formattedDate] = contracts;
            }
          }
        } catch (err: any) {
          console.error(`[Bulk Options] Yahoo failed for ${expDate}: ${err.message}`);
        }
      });

      await Promise.all(chainPromises);
      const result = { s: 'ok', expirations: expirationsMap };
      bulkCache.set(upperTicker, { timestamp: now, data: result });
      return res.json(result);

    } catch (err: any) {
      console.error(`[Bulk Options Error] ${upperTicker}: ${err.message}`);
      return res.status(500).json({ error: err.message, s: "error" });
    }
  });

  // API Proxy for Yahoo Finance
  app.get("/api/market-data", async (req, res) => {
    const { ticker, url } = req.query;
    let targetTicker = ticker as string;

    // Handle legacy url parameter if present
    if (url && typeof url === 'string') {
      const quoteMatch = url.match(/\/quotes\/([^\/]+)\//);
      if (quoteMatch) {
        targetTicker = quoteMatch[1].toUpperCase();
        try {
          const quote = await yahooFinance.quote(targetTicker);
          return res.json({
            s: 'ok',
            last: [quote.regularMarketPrice || quote.lastPrice || 0],
            ticker: [targetTicker],
            symbol: [targetTicker]
          });
        } catch (err: any) {
          return res.status(500).json({ error: err.message, s: "error" });
        }
      }
      
      const expMatch = url.match(/\/expirations\/([^\/]+)\//);
      if (expMatch) {
        targetTicker = expMatch[1].toUpperCase();
        try {
          const optionsData = await yahooFinance.options(targetTicker) as any;
          const expirations = (optionsData.expirationDates || []).map((d: Date) => d.toISOString().split('T')[0]);
          return res.json({ s: 'ok', expirations });
        } catch (err: any) {
          return res.status(500).json({ error: err.message, s: "error" });
        }
      }

      const chainMatch = url.match(/\/chain\/([^\/]+)\//);
      if (chainMatch) {
        targetTicker = chainMatch[1].toUpperCase();
        const urlObj = new URL(url, "http://localhost");
        const expiration = urlObj.searchParams.get("expiration");
        if (expiration) {
          try {
            const chainData = await yahooFinance.options(targetTicker, { date: expiration }) as any;
            const currentOption = chainData.options?.[0];
            if (currentOption && currentOption.puts) {
              return res.json({
                s: 'ok',
                strike: currentOption.puts.map((p: any) => p.strike),
                bid: currentOption.puts.map((p: any) => p.bid),
                ask: currentOption.puts.map((p: any) => p.ask),
                last: currentOption.puts.map((p: any) => p.lastPrice),
                volume: currentOption.puts.map((p: any) => p.volume),
                openInterest: currentOption.puts.map((p: any) => p.openInterest),
                symbol: currentOption.puts.map((p: any) => p.contractSymbol),
                updated: currentOption.puts.map((p: any) => p.lastTradeDate ? p.lastTradeDate.toISOString() : ''),
                iv: currentOption.puts.map((p: any) => p.impliedVolatility)
              });
            }
            return res.json({ s: 'ok', strike: [], bid: [], ask: [], last: [], volume: [], openInterest: [], symbol: [], updated: [], iv: [] });
          } catch (err: any) {
            return res.status(500).json({ error: err.message, s: "error" });
          }
        }
      }
    }

    if (targetTicker) {
      try {
        const quote = await yahooFinance.quote(targetTicker.toUpperCase());
        return res.json({
          s: 'ok',
          last: [quote.regularMarketPrice || quote.lastPrice || 0],
          symbol: [targetTicker.toUpperCase()],
          ticker: [targetTicker.toUpperCase()]
        });
      } catch (err: any) {
        return res.status(500).json({ error: err.message, s: "error" });
      }
    }

    return res.status(400).json({ error: "Invalid request", s: "error" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
