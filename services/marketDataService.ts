import { MarketData, ExpirationDate, OptionContract } from '../types';

type MarketCallback = (data: MarketData) => void;
type LogCallback = (message: string) => void;

export class MarketDataService {
  private subscribers: Map<string, Set<MarketCallback>> = new Map();
  private logSubscribers: Set<LogCallback> = new Set();
  private currentTicker: string | null = null;
  private lastMarketData: MarketData | null = null;
  private pollInterval: number | null = null;

  constructor() {}

  private roundTo(val: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(val * factor) / factor;
  }

  private async proxyFetch(targetUrl: string): Promise<any> {
    try {
      this.log(`Syncing with Backend Proxy...`);
      const response = await fetch(`/api/market-data?url=${encodeURIComponent(targetUrl)}`);
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errorMsg = errData.error || `Status ${response.status}`;
        this.log(`[DEBUG] Backend Error: ${errorMsg}`);
        throw new Error(errorMsg);
      }
      
      return await response.json();
    } catch (e: any) {
      this.log(`[ERROR] Backend Proxy Error: ${e.message}`);
      throw e;
    }
  }

  public subscribeLogs(callback: LogCallback): () => void {
    this.logSubscribers.add(callback);
    return () => this.logSubscribers.delete(callback);
  }

  private log(msg: string) {
    const timestamp = new Date().toLocaleTimeString();
    this.logSubscribers.forEach(cb => cb(`[${timestamp}] ${msg}`));
  }

  public subscribe(ticker: string, callback: MarketCallback): () => void {
    const upperTicker = ticker.toUpperCase();
    if (!this.subscribers.has(upperTicker)) {
      this.subscribers.set(upperTicker, new Set());
    }
    this.subscribers.get(upperTicker)?.add(callback);
    
    if (this.currentTicker !== upperTicker || !this.lastMarketData || this.lastMarketData.ticker !== upperTicker) {
      this.currentTicker = upperTicker;
      this.lastMarketData = null;
      this.fetchInitialMetadata(upperTicker);
      this.startPolling();
    } else if (this.lastMarketData) {
       callback(this.lastMarketData);
    }

    return () => {
      const subs = this.subscribers.get(upperTicker);
      subs?.delete(callback);
      if (subs?.size === 0) {
        this.subscribers.delete(upperTicker);
        if (this.subscribers.size === 0) this.stopPolling();
      }
    };
  }

  private startPolling() {
    this.stopPolling();
    this.pollInterval = window.setInterval(() => {
      if (this.currentTicker) {
        this.fetchLatestPrice(this.currentTicker);
      }
    }, 30000); // Poll every 30 seconds for price updates
  }

  private stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  public async reconnect() {
    if (!this.currentTicker) return;
    this.log(`Re-triggering synchronization for ${this.currentTicker}...`);
    await this.fetchInitialMetadata(this.currentTicker);
  }

  public async refresh() {
    if (!this.currentTicker) return;
    this.log(`Manual refresh requested for ${this.currentTicker}...`);
    await this.fetchLatestPrice(this.currentTicker);
  }

  private async fetchLatestPrice(ticker: string) {
    try {
      const data = await this.proxyFetch(`/quotes/${ticker}/`);
      if (data && data.s === 'ok' && data.last && data.last[0]) {
        this.updatePrice(ticker, data.last[0]);
      }
    } catch (e) {}
  }

  private updatePrice(ticker: string, newPrice: number) {
    if (this.lastMarketData && this.lastMarketData.ticker === ticker) {
      this.lastMarketData = {
        ...this.lastMarketData,
        currentPrice: newPrice,
        lastUpdated: Date.now()
      };
      this.subscribers.get(ticker)?.forEach(cb => cb(this.lastMarketData!));
    }
  }

  private async fetchInitialMetadata(ticker: string) {
    try {
      this.log(`Fetching price for ${ticker}...`);
      const priceData = await this.proxyFetch(`/quotes/${ticker}/`);

      if (priceData && priceData.s === 'ok' && priceData.last && priceData.last[0]) {
        const currentPrice = priceData.last[0];
        if (ticker !== this.currentTicker) return;
        
        await this.fetchAndProcessChain(ticker, currentPrice);
        this.log(`Feed active for ${ticker}.`);
      } else {
        throw new Error("Ticker not found or service unavailable.");
      }
    } catch (e: any) {
      if (ticker !== this.currentTicker) return;
      this.log(`Sync Failed for ${ticker}: ${e.message}.`);
      this.lastMarketData = null;
      this.subscribers.get(ticker)?.forEach(cb => cb({
        ticker: ticker,
        currentPrice: 0,
        lastUpdated: Date.now(),
        chain: []
      }));
    }
  }

  private async fetchAndProcessChain(ticker: string, currentPrice: number) {
    try {
      this.log(`Fetching bulk options chain for ${ticker}...`);
      const response = await fetch(`/api/bulk-options?ticker=${ticker}`);
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Status ${response.status}`);
      }

      const data = await response.json();
      
      if (data && data.s === 'ok' && data.expirations) {
        if (ticker !== this.currentTicker) return;

        const now = new Date();
        const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

        const chain: ExpirationDate[] = Object.entries(data.expirations)
          .map(([date, strikes]: [string, any]) => {
            const expDateObj = new Date(date);
            const diffTime = expDateObj.getTime() - today.getTime();
            const dte = Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));
            
            const roundedStrikes = strikes.map((s: any) => ({
              ...s,
              bid: this.roundTo(s.bid, 3),
              ask: this.roundTo(s.ask, 3),
              last: this.roundTo(s.last, 3),
              iv: this.roundTo(s.iv, 3),
              delta: this.roundTo(s.delta, 3),
              theta: this.roundTo(s.theta, 3)
            }));

            return {
              date,
              daysToExpiration: dte,
              strikes: roundedStrikes.sort((a: any, b: any) => b.strike - a.strike)
            };
          })
          .filter(exp => exp.daysToExpiration > 0)
          .sort((a, b) => a.daysToExpiration - b.daysToExpiration);

        this.log(`Mapped ${chain.length} expirations for ${ticker}.`);

        this.lastMarketData = {
          ticker: ticker,
          currentPrice,
          lastUpdated: Date.now(),
          chain
        };
        this.subscribers.get(ticker)?.forEach(cb => cb(this.lastMarketData!));
      } else {
        throw new Error("No options data found.");
      }
    } catch (e: any) {
      if (ticker !== this.currentTicker) return;
      this.log(`Chain Fetch Failed: ${e.message}.`);
    }
  }

  public async fetchContractQuote(ticker: string): Promise<Partial<OptionContract> | null> {
     this.log(`Fetching quote for ${ticker}`);
     try {
       const data = await this.proxyFetch(`/options/quotes/${ticker}/`);
       if (data && data.s === 'ok' && data.last && data.last[0]) {
         return {
           bid: this.roundTo(data.bid ? data.bid[0] : 0, 3),
           ask: this.roundTo(data.ask ? data.ask[0] : 0, 3),
           last: this.roundTo(data.last ? data.last[0] : 0, 3)
         };
       }
     } catch (e) {
       this.log(`Quote fetch failed: ${e instanceof Error ? e.message : String(e)}`);
     }
     return null;
  }
}

export const marketService = new MarketDataService();
