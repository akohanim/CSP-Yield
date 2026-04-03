import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// Simple in-memory cache for bulk options (limited effectiveness in serverless)
const bulkCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export default async function handler(req: any, res: any) {
  const { ticker } = req.query;
  if (!ticker || typeof ticker !== 'string') {
    return res.status(400).json({ error: "Ticker is required", s: "error" });
  }

  const upperTicker = ticker.toUpperCase();
  const now = Date.now();

  // Check cache
  const cached = bulkCache.get(upperTicker);
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return res.json(cached.data);
  }

  try {
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
    return res.status(500).json({ error: err.message, s: "error" });
  }
}
