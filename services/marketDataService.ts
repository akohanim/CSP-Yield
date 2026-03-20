import { MarketData, ExpirationDate, OptionContract } from '../types';
import { MARKETDATA_API_BASE } from '../constants';

type MarketCallback = (data: MarketData) => void;
type LogCallback = (message: string) => void;

export class MarketDataService {
  private subscribers: Map<string, Set<MarketCallback>> = new Map();
  private logSubscribers: Set<LogCallback> = new Set();
  private currentTicker: string | null = null;
  private lastMarketData: MarketData | null = null;
  private pollInterval: number | null = null;
  private isSimulated = false;

  constructor() {}

  private roundTo(val: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(val * factor) / factor;
  }

  /**
   * Calls the backend proxy to fetch market data.
   */
  private async proxyFetch(targetUrl: string): Promise<any> {
    try {
      this.log(`Syncing with MarketData.app via Backend Proxy...`);
      const response = await fetch(`/api/market-data?url=${encodeURIComponent(targetUrl)}`);
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errorMsg = errData.error || `Status ${response.status}`;
        this.log(`[DEBUG] Backend Error: ${errorMsg}`);
        if (errData.details) {
          this.log(`[DEBUG] Details: ${JSON.stringify(errData.details)}`);
        }
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
    
    // Always trigger a fetch if we don't have data for this ticker yet
    if (this.currentTicker !== upperTicker || !this.lastMarketData || this.lastMarketData.ticker !== upperTicker) {
      this.currentTicker = upperTicker;
      this.lastMarketData = null; // Reset to show loading state
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

  public async reconnect() {
    if (!this.currentTicker) return;
    this.log(`Manually re-triggering MarketData.app synchronization for ${this.currentTicker}...`);
    await this.fetchInitialMetadata(this.currentTicker);
  }

  public async refresh() {
    if (!this.currentTicker) return;
    this.log(`Manual refresh requested for ${this.currentTicker}...`);
    if (this.isSimulated) {
      this.simulatePriceTick();
    } else {
      await this.fetchLatestPrice(this.currentTicker);
    }
  }

  private startPolling() {
    // Automatic polling disabled per user request
    this.stopPolling();
  }

  private stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private simulatePriceTick() {
    if (!this.lastMarketData) return;
    const volatility = 0.0005;
    const change = this.lastMarketData.currentPrice * (Math.random() - 0.5) * volatility;
    this.updatePrice(this.lastMarketData.ticker, this.lastMarketData.currentPrice + change);
  }

  private async fetchLatestPrice(ticker: string) {
    if (this.isSimulated) return;
    try {
      const url = `${MARKETDATA_API_BASE}/stocks/quotes/${ticker}/`;
      const data = await this.proxyFetch(url);
      
      if (data && data.s === 'ok' && data.last && Array.isArray(data.last) && data.last.length > 0) {
        this.updatePrice(ticker, data.last[0]);
      }
    } catch (e) {
      // Quietly handle transient poll errors
    }
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
      // 1. Fetch Stock Quote
      const priceUrl = `${MARKETDATA_API_BASE}/stocks/quotes/${ticker}/`;
      const priceData = await this.proxyFetch(priceUrl);

      if (priceData && priceData.s === 'ok' && priceData.last && Array.isArray(priceData.last) && priceData.last.length > 0) {
        const currentPrice = priceData.last[0];
        
        // Check if we are still interested in this ticker
        if (ticker !== this.currentTicker) return;

        this.isSimulated = false;
        
        // 2. Fetch Option Chain
        await this.fetchAndProcessChain(ticker, currentPrice);
        
        if (ticker === this.currentTicker) {
          this.log(`Handshake complete. Live MarketData.app feed active for ${ticker}.`);
        }
      } else {
        const errorMsg = priceData?.errmsg || priceData?.error || "Empty response from data source.";
        throw new Error(errorMsg);
      }
    } catch (e: any) {
      if (ticker !== this.currentTicker) return;
      
      this.log(`Backend Sync Failed for ${ticker}: ${e.message}.`);
      this.isSimulated = false;
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
      this.log(`Fetching optimized bulk options chain for ${ticker}...`);
      const response = await fetch(`/api/bulk-options?ticker=${ticker}`);
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Status ${response.status}`);
      }

      const data = await response.json();
      
      if (data && data.s === 'ok' && data.expirations) {
        const expirationsMap = data.expirations;
        
        // Final check before state update
        if (ticker !== this.currentTicker) return;

        const now = new Date();
        const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

        const chain: ExpirationDate[] = Object.entries(expirationsMap)
          .map(([date, strikes]: [string, any]) => {
            const expDateObj = new Date(date); // YYYY-MM-DD is parsed as UTC midnight
            const diffTime = expDateObj.getTime() - today.getTime();
            const dte = Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));
            
            // Round values for the client
            const roundedStrikes = strikes.map((s: any) => ({
              ...s,
              bid: this.roundTo(s.bid, 3),
              ask: this.roundTo(s.ask, 3),
              last: this.roundTo(s.last, 3),
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
          .sort((a, b) => a.daysToExpiration - b.daysToExpiration)
          .slice(0, 50);

        this.log(`Successfully mapped ${chain.length} unique expiration dates for ${ticker} via optimized bulk fetch.`);

        const newData: MarketData = {
          ticker: ticker,
          currentPrice,
          lastUpdated: Date.now(),
          chain
        };

        this.lastMarketData = newData;
        this.subscribers.get(ticker)?.forEach(cb => cb(this.lastMarketData!));
      } else {
        throw new Error("Invalid response from bulk options endpoint");
      }
    } catch (e: any) {
      if (ticker !== this.currentTicker) return;
      this.log(`Optimized Chain Fetch Failed for ${ticker}: ${e.message}.`);
      
      // Fallback to the old method if the new one fails for some reason
      this.log(`Attempting legacy fallback fetch for ${ticker}...`);
      await this.legacyFetchAndProcessChain(ticker, currentPrice);
    }
  }

  private async legacyFetchAndProcessChain(ticker: string, currentPrice: number) {
    try {
      this.log(`Fetching expirations list for ${ticker}...`);
      const expUrl = `${MARKETDATA_API_BASE}/options/expirations/${ticker}/`;
      const expData = await this.proxyFetch(expUrl);
      
      let expirationsMap: Map<string, OptionContract[]> = new Map();

      if (expData && expData.s === 'ok' && expData.expirations && Array.isArray(expData.expirations)) {
        // Get up to 25 expirations to show a good range
        const expirations = expData.expirations.slice(0, 25);
        this.log(`Found ${expData.expirations.length} expirations for ${ticker}. Fetching chains for top ${expirations.length}...`);
        
        // Fetch chains in parallel batches to avoid overwhelming the proxy/API
        const batchSize = 5;
        for (let i = 0; i < expirations.length; i += batchSize) {
          // Check if ticker changed mid-fetch
          if (ticker !== this.currentTicker) return;

          const batch = expirations.slice(i, i + batchSize);
          await Promise.all(batch.map(async (expDate) => {
            try {
              const chainUrl = `${MARKETDATA_API_BASE}/options/chain/${ticker}/?side=put&expiration=${expDate}`;
              const data = await this.proxyFetch(chainUrl);
              
              if (data && data.s === 'ok' && data.strike && Array.isArray(data.strike)) {
                const contracts: OptionContract[] = [];
                for (let j = 0; j < data.strike.length; j++) {
                  contracts.push({
                    ticker: (data.optionSymbol && data.optionSymbol[j]) || (data.symbol && data.symbol[j]) || 'UNKNOWN',
                    strike: data.strike[j],
                    bid: this.roundTo((data.bid && data.bid[j]) || 0, 3),
                    ask: this.roundTo((data.ask && data.ask[j]) || 0, 3),
                    last: this.roundTo((data.last && data.last[j]) || 0, 3),
                    vol: (data.volume && data.volume[j]) || 0,
                    oi: (data.openInterest && data.openInterest[j]) || 0,
                    delta: this.roundTo((data.delta && data.delta[j]) !== undefined ? data.delta[j] : -0.3, 3), 
                    theta: this.roundTo((data.theta && data.theta[j]) !== undefined ? data.theta[j] : -0.05, 3)
                  });
                }
                expirationsMap.set(expDate, contracts);
              }
            } catch (e) {
              this.log(`Skipping ${expDate} for ${ticker} due to fetch error.`);
            }
          }));
        }
      } else {
        // Fallback to range=all if expirations list is not available
        this.log(`Expirations list unavailable for ${ticker}. Falling back to range=all...`);
        const chainUrl = `${MARKETDATA_API_BASE}/options/chain/${ticker}/?side=put&range=all`;
        const data = await this.proxyFetch(chainUrl);

        if (data && data.s === 'ok' && data.strike && Array.isArray(data.strike)) {
          for (let i = 0; i < data.strike.length; i++) {
            if (!data.expiration || data.expiration[i] === undefined) continue;
            const expValue = data.expiration[i];
            let expDateObj: Date;
            if (typeof expValue === 'number') {
              let ts = expValue;
              if (ts < 10000000000) ts *= 1000;
              expDateObj = new Date(ts);
            } else {
              expDateObj = new Date(expValue);
            }
            if (isNaN(expDateObj.getTime())) continue;
            const expDate = expDateObj.toISOString().split('T')[0];
            if (!expirationsMap.has(expDate)) expirationsMap.set(expDate, []);
            expirationsMap.get(expDate)?.push({
              ticker: (data.optionSymbol && data.optionSymbol[i]) || (data.symbol && data.symbol[i]) || 'UNKNOWN',
              strike: data.strike[i],
              bid: this.roundTo((data.bid && data.bid[i]) || 0, 3),
              ask: this.roundTo((data.ask && data.ask[i]) || 0, 3),
              last: this.roundTo((data.last && data.last[i]) || 0, 3),
              vol: (data.volume && data.volume[i]) || 0,
              oi: (data.openInterest && data.openInterest[i]) || 0,
              delta: this.roundTo((data.delta && data.delta[i]) !== undefined ? data.delta[i] : -0.3, 3), 
              theta: this.roundTo((data.theta && data.theta[i]) !== undefined ? data.theta[i] : -0.05, 3)
            });
          }
        }
      }

      // Final check before state update
      if (ticker !== this.currentTicker) return;

      const now = new Date();
      const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

      const chain: ExpirationDate[] = Array.from(expirationsMap.entries())
        .map(([date, strikes]) => {
          const expDateObj = new Date(date); // YYYY-MM-DD is parsed as UTC midnight
          const diffTime = expDateObj.getTime() - today.getTime();
          const dte = Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));
          return {
            date,
            daysToExpiration: dte,
            strikes: strikes.sort((a, b) => b.strike - a.strike)
          };
        })
        .filter(exp => exp.daysToExpiration > 0)
        .sort((a, b) => a.daysToExpiration - b.daysToExpiration)
        .slice(0, 50);

      this.log(`Successfully mapped ${chain.length} unique expiration dates for ${ticker}.`);

      const newData: MarketData = {
        ticker: ticker,
        currentPrice,
        lastUpdated: Date.now(),
        chain
      };

      this.lastMarketData = newData;
      this.subscribers.get(ticker)?.forEach(cb => cb(this.lastMarketData!));
    } catch (e: any) {
      if (ticker !== this.currentTicker) return;
      this.log(`Legacy Chain Fetch Failed for ${ticker}: ${e.message}.`);
    }
  }

  public getIsSimulated(): boolean {
    return false;
  }

  public async fetchContractQuote(ticker: string): Promise<Partial<OptionContract> | null> {
    if (!this.isSimulated) {
       this.log(`Fetching specific quote via Proxy: ${ticker}`);
       try {
         const url = `${MARKETDATA_API_BASE}/options/quotes/${ticker}/`;
         const data = await this.proxyFetch(url);
         if (data && data.s === 'ok' && data.last && Array.isArray(data.last) && data.last.length > 0) {
           return {
             bid: this.roundTo(data.bid ? data.bid[0] : 0, 3),
             ask: this.roundTo(data.ask ? data.ask[0] : 0, 3),
             last: this.roundTo(data.last ? data.last[0] : 0, 3)
           };
         }
         if (data && data.s === 'error') {
           this.log(`API returned error for ${ticker}: ${data.errmsg || 'Unknown error'}`);
           return null;
         }
       } catch (e) {
         this.log(`Contract quote fetch failed: ${e instanceof Error ? e.message : String(e)}`);
         return null;
       }
    }
    return null;
  }
}

export const marketService = new MarketDataService();
