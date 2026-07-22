
import React, { useState } from 'react';
import { Heart, Coffee, ExternalLink } from 'lucide-react';

const BMAC_URL = 'https://buymeacoffee.com/arikohanim';

export const TipJar: React.FC = () => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800/60 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-amber-950/10 p-6 sm:p-8 backdrop-blur-sm">
      {/* Subtle ambient glow */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex flex-col sm:flex-row items-center gap-5 sm:gap-8">
        {/* Icon + Text */}
        <div className="flex-1 text-center sm:text-left space-y-2">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <Coffee className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] font-black text-amber-400/80 uppercase tracking-[0.2em]">
              Support This Project
            </span>
          </div>
          <p className="text-slate-400 text-sm leading-relaxed max-w-md">
            If CSP PRO helps you validate trades, consider buying me a coffee. It keeps the servers running & the data flowing.
          </p>
        </div>

        {/* CTA Button */}
        <a
          href={BMAC_URL}
          target="_blank"
          rel="noopener noreferrer"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="group relative flex items-center gap-3 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-300 border border-amber-500/30 bg-gradient-to-r from-amber-600/20 to-amber-500/10 text-amber-300 hover:from-amber-600 hover:to-amber-500 hover:text-white hover:border-amber-400/60 hover:shadow-lg hover:shadow-amber-500/20 hover:scale-[1.03] active:scale-[0.98]"
        >
          <span
            className={`transition-transform duration-500 ${isHovered ? 'animate-bounce' : ''}`}
          >
            ☕
          </span>
          Buy Me a Coffee
          <ExternalLink className="w-3 h-3 opacity-40 group-hover:opacity-80 transition-opacity" />
        </a>
      </div>
    </div>
  );
};

/**
 * Compact version for the header area.
 */
export const TipButton: React.FC = () => {
  return (
    <a
      href={BMAC_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 text-amber-400/70 hover:text-amber-300 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20"
      title="Buy Me a Coffee"
    >
      <Heart className="w-3.5 h-3.5 group-hover:text-red-400 group-hover:fill-red-400 transition-colors duration-300" />
      <span className="hidden lg:inline">Tip</span>
    </a>
  );
};
