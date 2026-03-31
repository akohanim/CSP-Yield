import React, { useState } from 'react';
import { TradeInputs } from '../types';
import { Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface InputPanelProps {
  inputs: TradeInputs;
  setInputs: React.Dispatch<React.SetStateAction<TradeInputs>>;
  className?: string;
}

export const InputPanel: React.FC<InputPanelProps> = ({ inputs, setInputs, className }) => {
  const [showDiscountInfo, setShowDiscountInfo] = useState(false);
  const [showYieldInfo, setShowYieldInfo] = useState(false);
  
  const handleChange = (field: keyof TradeInputs, value: string | number) => {
    setInputs(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-6 bg-slate-900 rounded-xl border border-slate-800 shadow-xl relative ${className}`}>
      
      <AnimatePresence>
        {showDiscountInfo && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="absolute z-50 top-[-100px] left-1/4 -translate-x-1/2 w-full max-w-xs bg-slate-950 border border-slate-800 p-4 rounded-2xl shadow-2xl"
          >
            <div className="flex justify-between items-start mb-2">
              <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest">Target Discount</h4>
              <button onClick={() => setShowDiscountInfo(false)} className="text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              The percentage below the current market price where you want to set your strike. 
              A 5% discount means you're looking for strikes 5% below current market price.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showYieldInfo && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="absolute z-50 top-[-100px] left-3/4 -translate-x-1/2 w-full max-w-xs bg-slate-950 border border-slate-800 p-4 rounded-2xl shadow-2xl"
          >
            <div className="flex justify-between items-start mb-2">
              <h4 className="text-xs font-black text-amber-400 uppercase tracking-widest">Collateral Yield</h4>
              <button onClick={() => setShowYieldInfo(false)} className="text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              The annual interest rate you earn on your idle cash collateral (e.g., from a High-Yield Savings Account or broker sweep). 
              This yield is added to your option premium to calculate your total Effective APY.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ticker Input */}
      <div className="flex flex-col space-y-2">
        <label className="text-sm font-medium text-slate-400 uppercase tracking-wider">Ticker Symbol</label>
        <div className="relative">
          <input
            type="text"
            value={inputs.ticker}
            onChange={(e) => handleChange('ticker', e.target.value.toUpperCase())}
            className="w-full bg-slate-950 text-white border border-slate-700 rounded-lg py-3 px-4 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-mono text-lg uppercase"
            placeholder="e.g. SPYM"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">
            Equity/ETF
          </div>
        </div>
      </div>

      {/* Target APY */}
      <div className="flex flex-col space-y-2">
        <label className="text-sm font-medium text-slate-400 uppercase tracking-wider flex justify-between">
          <span>Target APY</span>
          <span className="text-indigo-400 font-bold">{inputs.targetAPY}%</span>
        </label>
        <div className="relative pt-2">
           <input
            type="range"
            min="1"
            max="100"
            step="1"
            value={inputs.targetAPY}
            onChange={(e) => handleChange('targetAPY', Number(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-2 font-mono">
            <span>1%</span>
            <span>Conserv.</span>
            <span>Aggr.</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      {/* Target Discount */}
      <div className="flex flex-col space-y-2">
        <label className="text-sm font-medium text-slate-400 uppercase tracking-wider flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span>Target Discount</span>
            <button 
              onClick={() => setShowDiscountInfo(true)}
              className="p-1 hover:bg-slate-800 rounded-md transition-colors text-slate-500 hover:text-indigo-400"
            >
              <Info className="w-3 h-3" />
            </button>
          </div>
          <span className="text-emerald-400 font-bold">{inputs.targetDiscount}%</span>
        </label>
         <div className="relative pt-2">
           <input
            type="range"
            min="0.5"
            max="30"
            step="0.5"
            value={inputs.targetDiscount}
            onChange={(e) => handleChange('targetDiscount', Number(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
           <div className="flex justify-between text-xs text-slate-500 mt-2 font-mono">
            <span>0.5%</span>
            <span>OTM</span>
            <span>Deep OTM</span>
            <span>30%</span>
          </div>
        </div>
      </div>

      {/* Collateral Yield */}
      <div className="flex flex-col space-y-2">
        <label className="text-sm font-medium text-slate-400 uppercase tracking-wider flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span>Collateral Yield</span>
            <button 
              onClick={() => setShowYieldInfo(true)}
              className="p-1 hover:bg-slate-800 rounded-md transition-colors text-slate-500 hover:text-indigo-400"
            >
              <Info className="w-3 h-3" />
            </button>
          </div>
          <span className="text-amber-400 font-bold">{inputs.collateralYield}%</span>
        </label>
         <div className="relative pt-2">
           <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={inputs.collateralYield}
            onChange={(e) => handleChange('collateralYield', Number(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
           <div className="flex justify-between text-xs text-slate-500 mt-2 font-mono">
            <span>0%</span>
            <span>HYSA</span>
            <span>Sweep</span>
            <span>10%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
