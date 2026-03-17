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
    
    if (this.currentTicker !== upperTicker) {
      this.currentTicker = upperTicker;
      this.fetchInitialMetadata();
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
    this.log("Manually re-triggering MarketData.app synchronization...");
    await this.fetchInitialMetadata();
  }

  public async refresh() {
    if (!this.currentTicker) return;
    this.log(`Manual refresh requested for ${this.currentTicker}...`);
    if (this.isSimulated) {
      this.simulatePriceTick();
    } else {
      await this.fetchLatestPrice();
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
    this.updatePrice(this.lastMarketData.currentPrice + change);
  }

  private async fetchLatestPrice() {
    if (!this.currentTicker || this.isSimulated) return;
    try {
      const url = `${MARKETDATA_API_BASE}/stocks/quotes/${this.currentTicker}/`;
      const data = await this.proxyFetch(url);
      
      if (data && data.s === 'ok' && data.last && data.last.length > 0) {
        this.updatePrice(data.last[0]);
      }
    } catch (e) {
      // Quietly handle transient poll errors
    }
  }

  private updatePrice(newPrice: number) {
    if (this.lastMarketData) {
      this.lastMarketData = {
        ...this.lastMarketData,
        currentPrice: newPrice,
        lastUpdated: Date.now()
      };
      this.subscribers.get(this.currentTicker!)?.forEach(cb => cb(this.lastMarketData!));
    }
  }

  private async fetchInitialMetadata() {
    if (!this.currentTicker) return;
    
    try {
      // 1. Fetch Stock Quote
      const priceUrl = `${MARKETDATA_API_BASE}/stocks/quotes/${this.currentTicker}/`;
      const priceData = await this.proxyFetch(priceUrl);

      if (priceData && priceData.s === 'ok' && priceData.last && priceData.last.length > 0) {
        const currentPrice = priceData.last[0];
        this.isSimulated = false;
        
        // 2. Fetch Option Chain
        await this.fetchAndProcessChain(currentPrice);
        
        this.log(`Handshake complete. Live MarketData.app feed active for ${this.currentTicker}.`);
      } else {
        throw new Error("Empty response from data source.");
      }
    } catch (e: any) {
      this.log(`Backend Sync Failed: ${e.message}. Activating Institutional Simulation Mode.`);
      this.isSimulated = true;
      const fallbackPrices: Record<string, number> = {
        'SPY': 512.30, 'QQQ': 440.15, 'IWM': 205.50, 'TSLA': 172.80, 
        'AAPL': 185.20, 'AMD': 160.40, 'NVDA': 890.10, 'RIVN': 11.20
      };
      this.generateSimulatedChain(fallbackPrices[this.currentTicker] || 150.00);
    }
  }

  private async fetchAndProcessChain(currentPrice: number) {
    try {
      // Fetch put options only for the next 60 days to keep it manageable
      const chainUrl = `${MARKETDATA_API_BASE}/options/chain/${this.currentTicker}/?side=put`;
      const data = await this.proxyFetch(chainUrl);

      if (data && data.s === 'ok' && data.strike) {
        const expirationsMap: Map<string, OptionContract[]> = new Map();
        
        for (let i = 0; i < data.strike.length; i++) {
          const expTimestamp = data.expiration[i] * 1000;
          const expDate = new Date(expTimestamp).toISOString().split('T')[0];
          
          if (!expirationsMap.has(expDate)) {
            expirationsMap.set(expDate, []);
          }
          
          expirationsMap.get(expDate)?.push({
            ticker: data.symbol[i],
            strike: data.strike[i],
            bid: this.roundTo(data.bid[i] || 0, 3),
            ask: this.roundTo(data.ask[i] || 0, 3),
            last: this.roundTo(data.last[i] || 0, 3),
            vol: data.volume[i] || 0,
            oi: data.openInterest[i] || 0,
            delta: this.roundTo(data.delta ? data.delta[i] : -0.3, 3), 
            theta: this.roundTo(data.theta ? data.theta[i] : -0.05, 3)
          });
        }

        const today = new Date();
        const chain: ExpirationDate[] = Array.from(expirationsMap.entries())
          .map(([date, strikes]) => {
            const expDate = new Date(date);
            const dte = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            return {
              date,
              daysToExpiration: dte,
              strikes: strikes.sort((a, b) => b.strike - a.strike) // Sort strikes descending
            };
          })
          .filter(exp => exp.daysToExpiration > 0)
          .sort((a, b) => a.daysToExpiration - b.daysToExpiration)
          .slice(0, 8); // Limit to first 8 expirations

        this.lastMarketData = {
          ticker: this.currentTicker!,
          currentPrice,
          lastUpdated: Date.now(),
          chain
        };
        this.subscribers.get(this.currentTicker!)?.forEach(cb => cb(this.lastMarketData!));
      } else {
        this.generateSimulatedChain(currentPrice);
      }
    } catch (e) {
      this.log(`Chain Fetch Failed: ${e instanceof Error ? e.message : String(e)}. Using simulation.`);
      this.generateSimulatedChain(currentPrice);
    }
  }

  private generateSimulatedChain(currentPrice: number) {
    const today = new Date();
    const chain: ExpirationDate[] = [];
    
    for (let i = 1; i <= 6; i++) {
      const expDate = new Date();
      expDate.setDate(today.getDate() + (i * 7) + (5 - today.getDay()));
      const dateStr = expDate.toISOString().split('T')[0];
      const dte = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      const strikes: OptionContract[] = [];
      const baseStrike = Math.round(currentPrice);
      const increment = currentPrice > 300 ? 5 : (currentPrice > 100 ? 2 : 1);
      
      for (let s = -15; s <= 2; s++) {
        const strikePrice = baseStrike + (s * increment);
        strikes.push({
          ticker: `${this.currentTicker}${expDate.getFullYear().toString().slice(-2)}${String(expDate.getMonth()+1).padStart(2,'0')}${String(expDate.getDate()).padStart(2,'0')}P${String(strikePrice * 1000).padStart(8, '0')}`,
          strike: strikePrice,
          bid: this.roundTo(Math.max(0.01, (currentPrice - strikePrice) * 0.05 + Math.random()), 3),
          ask: this.roundTo(Math.max(0.05, (currentPrice - strikePrice) * 0.06 + Math.random()), 3),
          last: this.roundTo(Math.max(0.01, (currentPrice - strikePrice) * 0.05 + Math.random()), 3),
          vol: Math.floor(Math.random() * 200),
          oi: Math.floor(Math.random() * 1000),
          delta: this.roundTo(-Math.random() * 0.5, 3),
          theta: this.roundTo(-Math.random() * 0.1, 3)
        });
      }
      chain.push({ date: dateStr, daysToExpiration: dte, strikes });
    }

    this.lastMarketData = {
      ticker: this.currentTicker!,
      currentPrice,
      lastUpdated: Date.now(),
      chain
    };
    this.subscribers.get(this.currentTicker!)?.forEach(cb => cb(this.lastMarketData!));
  }

  public getIsSimulated(): boolean {
    return this.isSimulated;
  }

  public async fetchContractQuote(ticker: string): Promise<Partial<OptionContract> | null> {
    if (!this.isSimulated) {
       this.log(`Fetching specific quote via Proxy: ${ticker}`);
       try {
         const url = `${MARKETDATA_API_BASE}/options/quotes/${ticker}/`;
         const data = await this.proxyFetch(url);
         if (data && data.s === 'ok' && data.last && data.last.length > 0) {
           return {
             bid: this.roundTo(data.bid[0], 3),
             ask: this.roundTo(data.ask[0], 3),
             last: this.roundTo(data.last[0], 3)
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
