
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { MarketData, TradeInputs, TradeCalculation, OptionContract } from './types';
import { DEFAULT_TARGET_APY, DEFAULT_TARGET_DISCOUNT, DEFAULT_TICKER } from './constants';
import { marketService } from './services/marketDataService';
import { InputPanel } from './components/InputPanel';
import { ResultsDisplay } from './components/ResultsDisplay';
import { ExpirationSelector } from './components/ExpirationSelector';
import { GeminiInsight } from './components/GeminiInsight';

const App: React.FC = () => {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fetchingQuote, setFetchingQuote] = useState(false);
  const [activeQuote, setActiveQuote] = useState<Partial<OptionContract> | null>(null);
  const [lastTickTime, setLastTickTime] = useState(0);
  const [isSim, setIsSim] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  const [inputs, setInputs] = useState<TradeInputs>({
    ticker: DEFAULT_TICKER,
    targetAPY: DEFAULT_TARGET_APY,
    targetDiscount: DEFAULT_TARGET_DISCOUNT,
    selectedDate: null,
  });

  const logsEndRef = useRef<HTMLDivElement>(null);

  const [backendStatus, setBackendStatus] = useState<{ hasApiKey: boolean; status: string } | null>(null);

  useEffect(() => {
    fetch('/api/status')
      .then(res => res.json())
      .then(data => setBackendStatus(data))
      .catch(() => setBackendStatus({ hasApiKey: false, status: 'error' }));
  }, []);

  useEffect(() => {
    const unsubscribeLogs = marketService.subscribeLogs((msg) => {
      setLogs(prev => [...prev.slice(-99), msg]);
      if (msg.includes('[ERROR]')) {
        setErrorMsg(msg.split('[ERROR]: ')[1] || 'Sync Error');
      }
    });
    return () => unsubscribeLogs();
  }, []);

  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, showLogs]);

  useEffect(() => {
    setInputs(prev => ({ ...prev, selectedDate: null }));
    setMarketData(null); 
    setErrorMsg(null);
    setActiveQuote(null);

    const unsubscribe = marketService.subscribe(inputs.ticker, (data) => {
      setMarketData(data);
      setLastTickTime(Date.now());
      setIsSim(marketService.getIsSimulated());
    });

    return () => unsubscribe();
  }, [inputs.ticker]);

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await marketService.refresh();
    setTimeout(() => setRefreshing(false), 600);
  };

  const handleReconnect = async () => {
    setReconnecting(true);
    await marketService.reconnect();
    setTimeout(() => setReconnecting(false), 1000);
  };

  useEffect(() => {
    let isMounted = true;
    const updateQuote = async () => {
      if (!marketData || !inputs.selectedDate) return;
      
      const currentPrice = marketData.currentPrice;
      const targetStrike = currentPrice * (1 - inputs.targetDiscount / 100);
      const expirationData = marketData.chain.find(exp => exp.date === inputs.selectedDate);
      
      if (!expirationData || expirationData.strikes.length === 0) return;

      const closest = expirationData.strikes.reduce((prev, curr) => {
        return (Math.abs(curr.strike - targetStrike) < Math.abs(prev.strike - targetStrike) ? curr : prev);
      });

      const optTicker = closest.ticker;
      if (optTicker) {
        setFetchingQuote(true);
        const quote = await marketService.fetchContractQuote(optTicker);
        if (isMounted) {
          setActiveQuote(quote);
          setFetchingQuote(false);
        }
      }
    };

    updateQuote();
    return () => { isMounted = false; };
  }, [marketData, inputs.selectedDate, inputs.targetDiscount]);

  const calculation: TradeCalculation | null = useMemo(() => {
    if (!marketData || !inputs.selectedDate) return null;

    const currentPrice = marketData.currentPrice;
    const targetStrike = currentPrice * (1 - inputs.targetDiscount / 100);
    const expirationData = marketData.chain.find(exp => exp.date === inputs.selectedDate);
    
    if (!expirationData || expirationData.strikes.length === 0) return null;

    const closestOption = expirationData.strikes.reduce((prev, curr) => {
      return (Math.abs(curr.strike - targetStrike) < Math.abs(prev.strike - targetStrike) ? curr : prev);
    });

    const dte = expirationData.daysToExpiration;
    const strike = closestOption.strike;
    const collateral = strike * 100;
    const requiredTotalCredit = collateral * (inputs.targetAPY / 100) * (dte / 365);

    const mergedOption: OptionContract = {
      ...closestOption,
      bid: activeQuote?.bid ?? closestOption.bid,
      ask: activeQuote?.ask ?? closestOption.ask,
      last: activeQuote?.last ?? closestOption.last
    };

    const actualPremiumPerShare = mergedOption.bid || mergedOption.last || 0; 
    const actualTotalCredit = actualPremiumPerShare * 100;
    const actualAPY = collateral > 0 ? (actualTotalCredit / collateral) * (365 / dte) * 100 : 0;
    const netPurchasePrice = strike - actualPremiumPerShare;

    return {
      calculatedStrike: strike,
      collateral,
      dte,
      requiredTotalCredit,
      actualTotalCredit,
      actualAPY,
      netPurchasePrice,
      isTargetMet: actualTotalCredit >= requiredTotalCredit && actualTotalCredit > 0,
      actualPremiumPerShare,
      option: mergedOption
    };
  }, [marketData, inputs.selectedDate, inputs.targetAPY, inputs.targetDiscount, activeQuote]);

  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (lastTickTime > 0) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 300);
      return () => clearTimeout(timer);
    }
  }, [lastTickTime]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 pb-80 selection:bg-indigo-500/30">
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 backdrop-blur-xl bg-opacity-90">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
             <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black font-mono shadow-lg shadow-indigo-600/20">
               DB
             </div>
             <h1 className="text-lg font-black tracking-tighter text-white uppercase">
               CSP <span className="text-indigo-500">PRO</span>
             </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            {backendStatus && !backendStatus.hasApiKey && (
              <div className="px-3 py-1 bg-red-950/30 border border-red-900/50 rounded-lg text-[10px] font-bold text-red-400 uppercase tracking-tighter animate-pulse">
                MISSING MARKETDATA_API_KEY
              </div>
            )}
            <button 
              onClick={handleReconnect}
              title="Retry MarketData.app Sync"
              className={`flex items-center px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest border transition-all hover:scale-105 active:scale-95 ${reconnecting ? 'bg-indigo-600 text-white border-indigo-500' : (isSim ? 'bg-amber-950/20 text-amber-500 border-amber-900/50' : 'bg-emerald-950/20 text-emerald-400 border-emerald-900/50')}`}
            >
               <span className={`w-2 h-2 rounded-full mr-2 ${reconnecting ? 'bg-white animate-ping' : (isSim ? 'bg-amber-500' : 'bg-emerald-400 animate-pulse')}`}></span>
               {reconnecting ? 'RECONNECTING...' : (isSim ? 'FEED: SIMULATED' : 'FEED: LIVE')}
            </button>

            <button 
              onClick={() => setShowLogs(!showLogs)}
              className="p-2 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors"
              title="Toggle Debug Logs"
            >
              <svg className={`w-5 h-5 ${showLogs ? 'text-indigo-400' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>

            <div className={`flex items-center space-x-4 bg-slate-950 rounded-2xl px-5 py-2 border transition-all duration-300 ${pulse ? 'border-indigo-500 shadow-lg shadow-indigo-500/10' : 'border-slate-800'}`}>
              <div className="flex flex-col items-start">
                <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest leading-none mb-1">Ticker</span>
                <span className="font-mono font-black text-indigo-400 uppercase text-sm leading-none">{inputs.ticker}</span>
              </div>
              <span className="h-6 w-px bg-slate-800"></span>
              <div className="flex flex-col items-start min-w-[80px]">
                <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest leading-none mb-1">Price</span>
                <span className={`font-mono font-bold text-sm leading-none transition-all duration-200 ${!marketData ? 'animate-pulse text-slate-600' : (pulse ? 'text-indigo-400' : 'text-slate-100')}`}>
                  {marketData ? `$${marketData.currentPrice.toFixed(2)}` : 'SCANNING...'}
                </span>
              </div>
              <button 
                onClick={handleRefresh}
                disabled={refreshing || !marketData}
                className={`p-1.5 rounded-lg transition-all ${refreshing ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-indigo-400 hover:bg-slate-700'}`}
                title="Refresh Price"
              >
                <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12 space-y-10">
        <div className="max-w-3xl">
          <h2 className="text-4xl font-black text-white mb-4 tracking-tighter">Cash Secured Puts: Yields, Verified</h2>
          <p className="text-slate-500 leading-relaxed text-lg">
            Verify your CSP yield with real-time data and institutional-grade trade math. Powered by MarketData.app for the precision every CSP trader needs.
          </p>
          {isSim && (
            <div className="mt-6 p-4 bg-amber-950/20 border border-amber-900/50 rounded-2xl flex items-center gap-4">
              <span className="text-amber-500 text-xl font-bold italic">SIM</span>
              <p className="text-amber-400 text-sm font-bold uppercase tracking-wide">
                Network Restricted: Feed is currently in High-Fidelity Simulation. 
                <button onClick={handleReconnect} className="ml-3 underline hover:text-white transition-colors">Try Reconnect</button>
              </p>
            </div>
          )}
        </div>

        <InputPanel inputs={inputs} setInputs={setInputs} />

        {marketData && (
          <div className="bg-slate-900/30 p-8 rounded-3xl border border-slate-800/40 backdrop-blur-sm">
             <ExpirationSelector 
               chain={marketData.chain} 
               selectedDate={inputs.selectedDate} 
               onSelect={(date) => setInputs(prev => ({ ...prev, selectedDate: date }))}
             />
             
             <div className={fetchingQuote ? 'opacity-40 grayscale blur-[1px] transition-all duration-300' : 'transition-all duration-300'}>
               <ResultsDisplay calculation={calculation} inputs={inputs} />
             </div>

             {calculation && marketData && !fetchingQuote && (
               <GeminiInsight 
                 inputs={inputs} 
                 calculation={calculation} 
                 currentPrice={marketData.currentPrice} 
               />
             )}
          </div>
        )}

        <footer className="pt-12 border-t border-slate-800/50">
          <p className="text-[10px] text-slate-600 leading-relaxed max-w-4xl">
            <span className="font-bold text-slate-500">Disclaimer:</span> Options involve risk and are not suitable for all investors. This app provides data analysis and mathematical validation for informational and entertainment purposes only; it does not constitute financial advice or a recommendation to buy or sell any security. Past performance is not indicative of future results. Real-time data is provided by MarketData.app; while we strive for accuracy, system errors or lag can occur.
          </p>
        </footer>
      </main>

      <div className={`fixed bottom-0 left-0 right-0 bg-slate-950 border-t border-slate-800 transition-all duration-500 ease-in-out ${showLogs ? 'h-72' : 'h-12'}`}>
        <div 
          className="flex items-center justify-between px-6 h-12 bg-slate-900 cursor-pointer hover:bg-slate-850"
          onClick={() => setShowLogs(!showLogs)}
        >
           <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-3">
             <span className={`w-2 h-2 rounded-full ${isSim ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`}></span>
             MarketData.app Engine Traffic
           </h3>
           <span className="text-slate-600 text-[10px] font-black uppercase tracking-widest">{showLogs ? 'Hide Activity' : 'Show Activity'}</span>
        </div>
        
        {showLogs && (
          <div className="h-60 overflow-y-auto p-6 font-mono text-[11px] leading-relaxed text-slate-400 bg-slate-950/50">
            {logs.map((log, i) => {
              const isError = log.includes('[ERROR]') || log.includes('failed');
              const isDebug = log.includes('[DEBUG]');
              return (
                <div key={i} className={`mb-1 border-l-2 pl-3 py-0.5 ${
                  isError ? 'border-rose-800 bg-rose-950/10 text-rose-300' : 
                  isDebug ? 'border-amber-800/40 text-amber-500/80' : 
                  'border-indigo-900/40'
                }`}>
                  {log}
                </div>
              );
            })}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
