import React from 'react';

export const YieldBooster: React.FC = () => {
  return (
    <div className="bg-gradient-to-br from-slate-900 to-indigo-950/20 rounded-2xl border border-indigo-500/20 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
          <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
          Yield Booster
        </h3>
        <span className="text-[10px] text-indigo-500 font-black uppercase tracking-widest">Boost your yield</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <a 
          href="https://robinhood.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="group p-4 bg-slate-950/40 rounded-xl border border-slate-800 hover:border-emerald-500/50 transition-all flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">Robinhood Gold</p>
            <p className="text-[10px] text-slate-500">Earn 5.0% APY on idle cash</p>
          </div>
          <div className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded uppercase">Get 5%</div>
        </a>
        <a 
          href="https://www.fidelity.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="group p-4 bg-slate-950/40 rounded-xl border border-slate-800 hover:border-blue-500/50 transition-all flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">Fidelity Spire</p>
            <p className="text-[10px] text-slate-500">Automatic sweep to SPAXX (4.9%+)</p>
          </div>
          <div className="text-[10px] font-black text-blue-500 bg-blue-500/10 px-2 py-1 rounded uppercase">Sweep On</div>
        </a>
      </div>
    </div>
  );
};
