import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

export default async function handler(req: any, res: any) {
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
}
