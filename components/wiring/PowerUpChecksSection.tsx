import React from 'react';

export const PowerUpChecksSection: React.FC<{ steps: string[] }> = ({ steps }) => (
  <div className="relative overflow-hidden p-6 bg-slate-900 rounded-4xl text-white">
    <h4 className="text-[10px] font-black uppercase text-amber-400 tracking-widest flex items-center gap-2 mb-4">
      <i className="fa-solid fa-triangle-exclamation"></i> First Power-Up Checks
    </h4>
    <ol className="space-y-3 relative z-10">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3">
          <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px] font-bold shrink-0">
            {i + 1}
          </span>
          <p className="text-[10px] text-slate-300 leading-relaxed">{step}</p>
        </li>
      ))}
    </ol>
    <i className="fa-solid fa-bolt absolute -right-10 -bottom-10 text-[160px] text-white/5 rotate-12 pointer-events-none"></i>
  </div>
);
