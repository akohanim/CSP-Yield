
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { MarketData, TradeInputs, TradeCalculation, OptionContract } from './types';
import { DEFAULT_TARGET_APY, DEFAULT_TARGET_DISCOUNT, DEFAULT_TICKER } from './constants';
import { marketService } from './services/marketDataService';
import { InputPanel } from './components/InputPanel';
import { YieldBooster } from './components/YieldBooster';
import { ResultsDisplay } from './components/ResultsDisplay';
import { OptionsTable } from './components/OptionsTable';
import { GeminiInsight } from './components/GeminiInsight';
import { TutorialModal } from './components/TutorialModal';
import { ManualCalculator } from './components/ManualCalculator';
import { HelpCircle, Activity, Calculator } from 'lucide-react';
import { TipButton, TipJar } from './components/TipJar';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'live' | 'manual'>('live');
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fetchingQuote, setFetchingQuote] = useState(false);
  const [activeQuote, setActiveQuote] = useState<Partial<OptionContract> | null>(null);
  const [lastTickTime, setLastTickTime] = useState(0);
  const [reconnecting, setReconnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [inputs, setInputs] = useState<TradeInputs>({
    ticker: DEFAULT_TICKER,
    targetAPY: DEFAULT_TARGET_APY,
    targetDiscount: DEFAULT_TARGET_DISCOUNT,
    selectedDate: null,
    collateralYield: 0, // Default to 0 as requested
  });

  const [backendStatus, setBackendStatus] = useState<{ status: string } | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);

  // Check for first-time user
  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('hasSeenTutorial');
    if (!hasSeenTutorial) {
      setShowTutorial(true);
    }
  }, []);

  const handleTutorialClose = () => {
    setShowTutorial(false);
    localStorage.setItem('hasSeenTutorial', 'true');
  };

  useEffect(() => {
    fetch('/api/status')
      .then(res => res.json())
      .then(data => setBackendStatus(data))
      .catch(() => setBackendStatus({ status: 'error' }));
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
    setInputs(prev => ({ ...prev, selectedDate: null }));
    setMarketData(null); 
    setErrorMsg(null);
    setActiveQuote(null);
    setIsSyncing(true);

    let unsubscribe: (() => void) | null = null;
    const timer = setTimeout(() => {
      unsubscribe = marketService.subscribe(inputs.ticker, (data) => {
        setMarketData(data);
        setLastTickTime(Date.now());
        setIsSyncing(false);
      });
    }, 600);

    return () => {
      clearTimeout(timer);
      if (unsubscribe) unsubscribe();
    };
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

  const allCalculations: TradeCalculation[] = useMemo(() => {
    if (!marketData) return [];
    
    const currentPrice = marketData.currentPrice;
    const targetStrike = currentPrice * (1 - inputs.targetDiscount / 100);
    
    return marketData.chain.map(exp => {
      if (!exp.strikes || exp.strikes.length === 0) return null;
      
      const closestOption = exp.strikes.reduce((prev, curr) => {
        return (Math.abs(curr.strike - targetStrike) < Math.abs(prev.strike - targetStrike) ? curr : prev);
      });
      
      const dte = exp.daysToExpiration;
      if (dte === 0) return null;

      const strike = closestOption.strike;
      const collateral = strike * 100;
      const requiredTotalCredit = collateral * (inputs.targetAPY / 100) * (dte / 365);
      
      const actualPremiumPerShare = closestOption.bid || closestOption.last || 0;
      const actualTotalCredit = actualPremiumPerShare * 100;
      
      const optionAPY = collateral > 0 ? (actualTotalCredit / collateral) * (365 / dte) * 100 : 0;
      const collateralAPY = inputs.collateralYield;
      const actualAPY = optionAPY + collateralAPY;
      
      const netPurchasePrice = strike - actualPremiumPerShare;

      return {
        date: exp.date,
        calculatedStrike: strike,
        collateral,
        dte,
        requiredTotalCredit,
        actualTotalCredit,
        actualAPY,
        optionAPY,
        collateralAPY,
        netPurchasePrice,
        isTargetMet: actualAPY >= inputs.targetAPY && actualTotalCredit > 0,
        actualPremiumPerShare,
        option: closestOption
      };
    }).filter((c): c is TradeCalculation => c !== null);
  }, [marketData, inputs.targetAPY, inputs.targetDiscount, inputs.collateralYield]);

  const calculation: TradeCalculation | null = useMemo(() => {
    if (!marketData || !inputs.selectedDate) return null;

    const currentPrice = marketData.currentPrice;
    const targetStrike = currentPrice * (1 - inputs.targetDiscount / 100);
    const expirationData = marketData.chain.find(exp => exp.date === inputs.selectedDate);
    
    if (!expirationData || !expirationData.strikes || expirationData.strikes.length === 0) return null;

    const closestOption = expirationData.strikes.reduce((prev, curr) => {
      return (Math.abs(curr.strike - targetStrike) < Math.abs(prev.strike - targetStrike) ? curr : prev);
    });

    const dte = expirationData.daysToExpiration;
    if (dte === 0) return null;

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
    
    const optionAPY = collateral > 0 ? (actualTotalCredit / collateral) * (365 / dte) * 100 : 0;
    const collateralAPY = inputs.collateralYield;
    const actualAPY = optionAPY + collateralAPY;
    
    const netPurchasePrice = strike - actualPremiumPerShare;

    return {
      date: expirationData.date,
      calculatedStrike: strike,
      collateral,
      dte,
      requiredTotalCredit,
      actualTotalCredit,
      actualAPY,
      optionAPY,
      collateralAPY,
      netPurchasePrice,
      isTargetMet: actualAPY >= inputs.targetAPY && actualTotalCredit > 0,
      actualPremiumPerShare,
      option: mergedOption
    };
  }, [marketData, inputs.selectedDate, inputs.targetAPY, inputs.targetDiscount, inputs.collateralYield, activeQuote]);

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
      {showTutorial && <TutorialModal onClose={handleTutorialClose} />}

      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 backdrop-blur-xl bg-opacity-90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-3">
             <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-600 rounded-xl sm:rounded-2xl flex items-center justify-center text-white font-black font-mono shadow-lg shadow-indigo-600/20 text-xs sm:text-base">
               DB
             </div>
             <h1 className="text-sm sm:text-lg font-black tracking-tighter text-white uppercase">
               CSP <span className="text-indigo-500">PRO</span>
             </h1>
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-4">
            <button 
              onClick={() => setShowTutorial(true)}
              className="p-1.5 sm:p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-400 hover:text-white flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
              title="Show Tutorial"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="hidden md:inline">Help</span>
             </button>
             <TipButton />
            <div className="hidden sm:block h-4 w-[1px] bg-slate-800"></div>
            <div className={`flex items-center space-x-2 sm:space-x-4 bg-slate-950 rounded-xl sm:rounded-2xl px-3 sm:px-5 py-1.5 sm:py-2 border transition-all duration-300 ${pulse ? 'border-indigo-500 shadow-lg shadow-indigo-500/10' : 'border-slate-800'}`}>
              <div className="flex flex-col items-start">
                <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest leading-none mb-1">Ticker</span>
                <span className="font-mono font-black text-indigo-400 uppercase text-xs sm:text-sm leading-none">{inputs.ticker}</span>
              </div>
              <span className="h-4 sm:h-6 w-px bg-slate-800"></span>
              <div className="flex flex-col items-start min-w-[60px] sm:min-w-[80px]">
                <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest leading-none mb-1">Price</span>
                <span className={`font-mono font-bold text-xs sm:text-sm leading-none transition-all duration-200 ${isSyncing ? 'animate-pulse text-slate-600' : (pulse ? 'text-indigo-400' : 'text-slate-100')}`}>
                  {marketData && marketData.currentPrice > 0 ? `$${marketData.currentPrice.toFixed(2)}` : (isSyncing ? 'SYNC' : '---')}
                </span>
              </div>
              <button 
                onClick={handleRefresh}
                disabled={refreshing || !marketData}
                className={`p-1 rounded-lg transition-all ${refreshing ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-indigo-400 hover:bg-slate-700'}`}
                title="Refresh Price"
              >
                <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-12 space-y-6 sm:space-y-10">
        <div className="max-w-3xl">
          <h2 className="text-4xl font-black text-white mb-4 tracking-tighter">Cash Secured Puts: Yields, Verified</h2>
          <p className="text-slate-500 leading-relaxed text-lg">
            Verify your CSP yield with data and institutional-grade trade math.
            <br />
            <span className="text-[10px] opacity-20">Impact-Site-Verification: 2b58e978-3639-4f7d-bb34-1882b41888b5</span>
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex p-1.5 bg-slate-900 border border-slate-800 rounded-2xl w-fit">
          <button 
            onClick={() => setActiveTab('live')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'live' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Activity className="w-4 h-4" />
            Market Data
          </button>
          <button 
            onClick={() => setActiveTab('manual')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'manual' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Calculator className="w-4 h-4" />
            Manual Calc
          </button>
        </div>

        {activeTab === 'live' ? (
          <>
            <InputPanel inputs={inputs} setInputs={setInputs} />

            <YieldBooster />

            {isSyncing && !marketData && (
              <div className="bg-slate-900/30 p-20 rounded-3xl border border-slate-800/40 backdrop-blur-sm flex flex-col items-center justify-center space-y-4">
                <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                <p className="text-slate-500 font-black uppercase tracking-widest text-xs">Synchronizing with Market Data...</p>
              </div>
            )}

            {!isSyncing && !marketData && (
              <div className="bg-slate-900/30 p-20 rounded-3xl border border-slate-800/40 backdrop-blur-sm flex flex-col items-center justify-center space-y-6 text-center">
                <div className="w-16 h-16 bg-red-950/20 rounded-full flex items-center justify-center text-red-500">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">Connection Failed</h3>
                  <p className="text-slate-500 max-w-md mx-auto">
                    {errorMsg || "We couldn't retrieve market data for this ticker. Please verify the ticker symbol."}
                  </p>
                </div>
                <button 
                  onClick={handleReconnect}
                  className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20"
                >
                  Retry Connection
                </button>
              </div>
            )}

            {marketData && (
              <div className="bg-slate-900/30 p-8 rounded-3xl border border-slate-800/40 backdrop-blur-sm">
                <OptionsTable 
                  marketData={marketData} 
                  inputs={inputs} 
                  onSelect={(date) => setInputs(prev => ({ ...prev, selectedDate: date }))}
                />
                
                <div className={fetchingQuote ? 'opacity-40 grayscale blur-[1px] transition-all duration-300' : 'transition-all duration-300'}>
                  <ResultsDisplay 
                      calculation={calculation} 
                      inputs={inputs} 
                    />
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
          </>
        ) : (
          <ManualCalculator />
        )}

        <TipJar />

        <footer className="pt-12 border-t border-slate-800/50">
          <p className="text-[10px] text-slate-600 leading-relaxed max-w-4xl">
            <span className="font-bold text-slate-500">Disclaimer:</span> Options involve risk and are not suitable for all investors. This app provides data analysis and mathematical validation for informational and entertainment purposes only; it does not constitute financial advice or a recommendation to buy or sell any security. Past performance is not indicative of future results. Data is provided by Yahoo Finance; while we strive for accuracy, system errors or lag can occur.
          </p>
        </footer>
      </main>
    </div>
  );
};

export default App;
