import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronRight, ChevronLeft, Info, Target, TrendingUp, ShieldCheck } from 'lucide-react';

interface TutorialModalProps {
  onClose: () => void;
}

const steps = [
  {
    title: "Welcome to CSP PRO",
    description: "Your ultimate tool for verifying Cash Secured Put yields with real-time data and institutional-grade trade math.",
    icon: <ShieldCheck className="w-12 h-12 text-indigo-500" />,
    example: null
  },
  {
    title: "How it Works",
    description: "Enter a ticker, set your target APY and Discount, and we'll find the best-fit options for you.",
    icon: <Target className="w-12 h-12 text-emerald-500" />,
    example: {
      ticker: "SPY",
      price: "$510.25",
      discount: "5%",
      strike: "$485.00"
    }
  },
  {
    title: "Target Discount",
    description: "This is the percentage below the current price where you want to set your strike. A 5% discount means you're looking for strikes 5% below current market price.",
    icon: <TrendingUp className="w-12 h-12 text-amber-500" />,
    example: null
  },
  {
    title: "Yield Verification",
    description: "We calculate the required premium to meet your APY goal and compare it with live market data to give you a clear 'Target Met' or 'Under Target' status.",
    icon: <Info className="w-12 h-12 text-blue-500" />,
    example: null
  }
];

export const TutorialModal: React.FC<TutorialModalProps> = ({ onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
      >
        <div className="p-8">
          <div className="flex justify-between items-start mb-8">
            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
              {steps[currentStep].icon}
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-500 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-black text-white tracking-tight uppercase">
              {steps[currentStep].title}
            </h2>
            <p className="text-slate-400 leading-relaxed">
              {steps[currentStep].description}
            </p>

            {steps[currentStep].example && (
              <div className="mt-6 p-4 bg-slate-950 rounded-2xl border border-slate-800 font-mono text-sm">
                <div className="flex justify-between mb-2">
                  <span className="text-slate-600 uppercase text-[10px] font-black">Ticker</span>
                  <span className="text-indigo-400 font-bold">{steps[currentStep].example.ticker}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-slate-600 uppercase text-[10px] font-black">Current Price</span>
                  <span className="text-white">{steps[currentStep].example.price}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-slate-600 uppercase text-[10px] font-black">Target Discount</span>
                  <span className="text-emerald-400">{steps[currentStep].example.discount}</span>
                </div>
                <div className="flex justify-between border-t border-slate-800 pt-2 mt-2">
                  <span className="text-slate-600 uppercase text-[10px] font-black">Calculated Strike</span>
                  <span className="text-white font-black">{steps[currentStep].example.strike}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <div 
                key={i} 
                className={`h-1.5 rounded-full transition-all duration-300 ${i === currentStep ? 'w-6 bg-indigo-500' : 'w-1.5 bg-slate-800'}`}
              />
            ))}
          </div>

          <div className="flex gap-3">
            {currentStep > 0 && (
              <button 
                onClick={prevStep}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
            <button 
              onClick={nextStep}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20"
            >
              {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
              {currentStep < steps.length - 1 && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
