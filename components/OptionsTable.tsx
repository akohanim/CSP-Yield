import React from 'react';
import { MarketData, TradeInputs, OptionContract } from '../types';

interface OptionsTableProps {
  marketData: MarketData;
  inputs: TradeInputs;
  onSelect: (date: string) => void;
}

export const OptionsTable: React.FC<OptionsTableProps> = ({ marketData, inputs, onSelect }) => {
  const { chain, currentPrice } = marketData;

  if (!chain || chain.length === 0) {
    return (
      <div className="mb-6 p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center">
        <p className="text-slate-400 font-medium">No valid option contracts found for {marketData.ticker}.</p>
      </div>
    );
  }

  const targetStrike = currentPrice * (1 - inputs.targetDiscount / 100);

  const rows = chain.map(exp => {
    // Find the strike closest to our target discount
    if (!exp.strikes || exp.strikes.length === 0) return null;

    const closestOption = exp.strikes.reduce((prev, curr) => {
      return (Math.abs(curr.strike - targetStrike) < Math.abs(prev.strike - targetStrike) ? curr : prev);
    });

    const premium = closestOption.bid || closestOption.last || 0;
    const dte = exp.daysToExpiration;
    const apy = closestOption.strike > 0 && dte > 0
      ? (premium / closestOption.strike) * (365 / dte) * 100 
      : 0;

    return {
      date: exp.date,
      dte,
      strike: closestOption.strike,
      premium,
      apy,
      option: closestOption
    };
  }).filter((row): row is NonNullable<typeof row> => row !== null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center space-x-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest leading-none mb-1">Target Strike</span>
            <span className="text-xl font-black text-emerald-400 tracking-tighter">${targetStrike.toFixed(2)}</span>
          </div>
          <div className="h-8 w-px bg-slate-800"></div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest leading-none mb-1">Target Discount</span>
            <span className="text-xl font-black text-white tracking-tighter">{inputs.targetDiscount}%</span>
          </div>
        </div>
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
          Showing {rows.length} expirations
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900 border-b border-slate-800">
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Expiration</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">DTE</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Strike</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Premium</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Eff. Yield (APY)</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {rows.map((row) => (
              <tr 
                key={row.date} 
                className={`group transition-colors hover:bg-slate-800/40 ${inputs.selectedDate === row.date ? 'bg-indigo-500/10' : ''}`}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-200">
                      {new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="font-mono text-slate-400">{row.dte}d</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="font-mono font-bold text-emerald-400">${row.strike.toFixed(2)}</span>
                  <span className="ml-2 text-[10px] text-slate-600 font-bold">
                    ({((1 - row.strike / currentPrice) * 100).toFixed(1)}% OTM)
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="font-mono font-bold text-indigo-400">${row.premium.toFixed(2)}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className={`font-mono font-black ${row.apy >= inputs.targetAPY ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {row.apy.toFixed(2)}%
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <button
                    onClick={() => onSelect(row.date)}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                      inputs.selectedDate === row.date
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {inputs.selectedDate === row.date ? 'Selected' : 'Select'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  );
};
