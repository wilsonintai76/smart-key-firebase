import React from 'react';

interface FeatureCardProps {
  iconClass: string;
  accent: string;
  title: string;
  children: React.ReactNode;
}

/** Icon + heading + body card used by the guide's "offline architecture" grid. */
export const FeatureCard: React.FC<FeatureCardProps> = ({ iconClass, accent, title, children }) => (
  <div className="p-5 bg-white border border-slate-100 rounded-[24px]">
    <div className={`w-10 h-10 ${accent} rounded-xl flex items-center justify-center mb-3`}>
      <i className={iconClass}></i>
    </div>
    <h4 className="text-xs font-black text-slate-900 uppercase mb-2">{title}</h4>
    <p className="text-[10px] text-slate-500 leading-relaxed">{children}</p>
  </div>
);
