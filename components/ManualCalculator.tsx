
import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Calculator, Calendar, DollarSign, TrendingUp, Info, ArrowRight } from 'lucide-react';
import { YieldBooster } from './YieldBooster';

export const ManualCalculator: React.FC = () => {
  const [inputs, setInputs] = useState({
    strikePrice: 150,
    premium: 2.50,
    expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    collateralYield: 4.5,
  });

  const calculation = useMemo(() => {
    const strike = Number(inputs.strikePrice);
    const premium = Number(inputs.premium);
    const collateralYield = Number(inputs.collateralYield);
    
    if (isNaN(strike) || isNaN(premium) || isNaN(collateralYield) || strike <= 0) return null;

    const expiration = new Date(inputs.expirationDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diffTime = expiration.getTime() - today.getTime();
    const dte = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    const collateral = strike * 100;
    const totalCredit = premium * 100;
    
    const optionYield = (totalCredit / collateral) * 100;
    const optionAPY = (optionYield / dte) * 365;
    const totalAPY = optionAPY + collateralYield;
    const netPurchasePrice = strike - premium;

    return {
      dte,
      collateral,
      totalCredit,
      optionYield,
      optionAPY,
      collateralYield,
      totalAPY,
      netPurchasePrice
    };
  }, [inputs]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* Input Section */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-indigo-500/10 rounded-xl">
                <Calculator className="w-5 h-5 text-indigo-400" />
              </div>
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">Manual Parameters</h3>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Strike Price ($)</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <DollarSign className="h-4 w-4 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
                  </div>
                  <input
                    type="number"
                    value={inputs.strikePrice}
                    onChange={(e) => setInputs(prev => ({ ...prev, strikePrice: parseFloat(e.target.value) || 0 }))}
                    className="block w-full pl-11 pr-4 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-white font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Premium Received ($)</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <TrendingUp className="h-4 w-4 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={inputs.premium}
                    onChange={(e) => setInputs(prev => ({ ...prev, premium: parseFloat(e.target.value) || 0 }))}
                    className="block w-full pl-11 pr-4 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-white font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Expiration Date</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Calendar className="h-4 w-4 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
                    </div>
                    <input
                      type="date"
                      value={inputs.expirationDate}
                      onChange={(e) => setInputs(prev => ({ ...prev, expirationDate: e.target.value }))}
                      className="block w-full pl-11 pr-4 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-white font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none [color-scheme:dark]"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Collateral Yield (%)</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Info className="h-4 w-4 text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
                    </div>
                    <input
                      type="number"
                      step="0.1"
                      value={inputs.collateralYield}
                      onChange={(e) => setInputs(prev => ({ ...prev, collateralYield: parseFloat(e.target.value) || 0 }))}
                      className="block w-full pl-11 pr-4 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-white font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                      placeholder="0.0"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <YieldBooster />
        </div>

        {/* Results Section */}
        <div className="bg-indigo-600 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-500/20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
          
          <div className="relative z-10 h-full flex flex-col">
            <div className="flex justify-between items-start mb-12">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-200 mb-1">Total Annualized Yield</p>
                <h4 className="text-6xl font-black tracking-tighter">
                  {calculation ? calculation.totalAPY.toFixed(2) : '0.00'}%
                </h4>
              </div>
              <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                {calculation?.dte} Days
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mt-auto">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Option APY</p>
                <p className="text-xl font-bold font-mono">{calculation ? calculation.optionAPY.toFixed(2) : '0.00'}%</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Collateral APY</p>
                <p className="text-xl font-bold font-mono">{calculation ? calculation.collateralYield.toFixed(2) : '0.00'}%</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Net Purchase</p>
                <p className="text-xl font-bold font-mono">${calculation ? calculation.netPurchasePrice.toFixed(2) : '0.00'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Total Credit</p>
                <p className="text-xl font-bold font-mono">${calculation ? calculation.totalCredit.toFixed(2) : '0.00'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/40 border border-slate-800/60 p-6 rounded-2xl">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Collateral Required</p>
          <p className="text-2xl font-black text-white font-mono">${calculation?.collateral.toLocaleString()}</p>
        </div>
        <div className="bg-slate-900/40 border border-slate-800/60 p-6 rounded-2xl">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Unannualized Yield</p>
          <p className="text-2xl font-black text-white font-mono">{calculation?.optionYield.toFixed(2)}%</p>
        </div>
        <div className="bg-slate-900/40 border border-slate-800/60 p-6 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Break Even</p>
            <p className="text-2xl font-black text-indigo-400 font-mono">${calculation?.netPurchasePrice.toFixed(2)}</p>
          </div>
          <div className="w-10 h-10 bg-indigo-500/10 rounded-full flex items-center justify-center">
            <ArrowRight className="w-5 h-5 text-indigo-400" />
          </div>
        </div>
      </div>

    </motion.div>
  );
};
