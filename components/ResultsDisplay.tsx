import React from 'react';
import { TradeCalculation, TradeInputs } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface ResultsDisplayProps {
  calculation: TradeCalculation | null;
  inputs: TradeInputs;
}

const MetricBox: React.FC<{ title: string; value: string | number | null; suffix?: string; colorClass?: string; sub?: string }> = ({ title, value, suffix = "", colorClass = "text-white", sub }) => (
  <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800/60 hover:border-slate-700 transition-colors">
    <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1">{title}</span>
    <div className="flex items-baseline gap-1">
      <span className={`text-lg font-mono font-bold ${value === null ? 'text-slate-700' : colorClass}`}>
        {value === null ? 'Err' : `${value}${suffix}`}
      </span>
    </div>
    {sub && <span className="text-[10px] text-slate-600 block mt-1">{sub}</span>}
  </div>
);

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ calculation, inputs }) => {
  if (!calculation) {
    return (
      <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-xl bg-slate-950/30">
        <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-slate-500 font-medium">Please select an expiration date from the slider above</p>
      </div>
    );
  }

  const {
    calculatedStrike,
    collateral,
    requiredTotalCredit,
    actualTotalCredit,
    actualAPY,
    netPurchasePrice,
    isTargetMet,
    option
  } = calculation;

  const data = [
    { name: 'Actual', value: actualAPY },
    { name: 'Target Gap', value: Math.max(0, inputs.targetAPY - actualAPY) },
  ];

  const chartColors = isTargetMet ? ['#10b981', '#1e293b'] : ['#f43f5e', '#1e293b'];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Validation Summary */}
        <div className={`rounded-2xl border p-6 flex flex-col justify-between ${isTargetMet ? 'bg-emerald-950/10 border-emerald-900/40' : 'bg-rose-950/10 border-rose-900/40'}`}>
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-100 tracking-tight">Validation Check</h3>
              <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${isTargetMet ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'}`}>
                {isTargetMet ? 'Target Met' : 'Yield Under Target'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
                  <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Required Credit</p>
                  <p className="text-2xl font-mono text-slate-300">${requiredTotalCredit.toFixed(2)}</p>
                  <p className="text-[9px] text-slate-600 mt-2">Targeting {inputs.targetAPY}% APY</p>
              </div>
              <div className={`p-5 rounded-2xl border ${isTargetMet ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`}>
                  <p className={`text-[10px] uppercase font-black tracking-widest mb-1 ${isTargetMet ? 'text-emerald-400' : 'text-rose-400'}`}>Market Premium</p>
                  <p className={`text-2xl font-mono font-black ${isTargetMet ? 'text-emerald-300' : 'text-rose-300'}`}>${actualTotalCredit.toFixed(2)}</p>
                  <p className="text-[9px] opacity-70 mt-2 text-slate-400">Current Bid Price</p>
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-2">
              <span className="text-slate-500">Yield Progress</span>
              <span className={isTargetMet ? 'text-emerald-400' : 'text-rose-400'}>{((actualTotalCredit / requiredTotalCredit) * 100).toFixed(0)}%</span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ease-out ${isTargetMet ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                style={{ width: `${Math.min(100, (actualTotalCredit / requiredTotalCredit) * 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Right Column: Key Metrics */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 flex flex-col">
          <h3 className="text-lg font-bold text-slate-100 mb-6 tracking-tight">Trade Summary</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-6 flex-1">
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Strike Target</p>
              <p className="text-3xl font-mono text-white tracking-tighter">${calculatedStrike.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Collateral Required</p>
              <p className="text-3xl font-mono text-indigo-400 tracking-tighter">${collateral.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Break-Even Price</p>
              <p className="text-3xl font-mono text-emerald-400 tracking-tighter">${netPurchasePrice.toFixed(2)}</p>
            </div>
            <div className="relative">
              <div className="absolute right-0 top-0 w-16 h-16">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data} cx="50%" cy="50%" innerRadius={20} outerRadius={28} dataKey="value" startAngle={90} endAngle={-270} stroke="none">
                      {data.map((entry, index) => <Cell key={`c-${index}`} fill={chartColors[index % chartColors.length]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Effective APY</p>
              <p className={`text-3xl font-mono font-black tracking-tighter ${isTargetMet ? 'text-emerald-400' : 'text-rose-400'}`}>
                {actualAPY.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contract Deep Dive */}
      <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6">
         <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-3">
            <span className="w-8 h-px bg-slate-800"></span>
            Raw Contract Snapshot
            <span className="flex-1 h-px bg-slate-800"></span>
         </h3>
         <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricBox title="Strike" value={option.strike} suffix="" colorClass="text-slate-100" />
            <MetricBox 
              title="Bid / Ask" 
              value={option.bid !== null && option.ask !== null ? `${option.bid.toFixed(3)} / ${option.ask.toFixed(3)}` : null} 
              colorClass="text-indigo-300" 
            />
            <MetricBox title="Last Price" value={option.last?.toFixed(3) || null} colorClass="text-slate-400" />
            <MetricBox title="Volume" value={option.vol} colorClass="text-blue-400" />
            <MetricBox title="Open Int." value={option.oi} colorClass="text-purple-400" />
            <MetricBox title="Delta" value={option.delta?.toFixed(3) || null} colorClass="text-amber-400" />
            <MetricBox title="Theta" value={option.theta?.toFixed(3) || null} colorClass="text-orange-400" />
            <MetricBox title="DTE" value={calculation.dte} suffix="d" colorClass="text-emerald-400" />
         </div>
      </div>
    </div>
  );
};