import React from 'react';

interface WiringStep {
  icon: string;
  title: string;
  body: string;
}

export const WiringStepsSection: React.FC<{ steps: WiringStep[] }> = ({ steps }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {steps.map(step => (
      <div key={step.title} className="p-5 bg-white border border-slate-100 rounded-[24px]">
        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-3">
          <i className={`fa-solid ${step.icon}`}></i>
        </div>
        <h4 className="text-xs font-black text-slate-900 uppercase mb-2">{step.title}</h4>
        <p className="text-[10px] text-slate-500 leading-relaxed">{step.body}</p>
      </div>
    ))}
  </div>
);
