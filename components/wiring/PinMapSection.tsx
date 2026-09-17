import React from 'react';

interface PinRow {
  pin: string;
  role: string;
  signal: string;
  note: string;
}

export const PinMapSection: React.FC<{ pins: PinRow[] }> = ({ pins }) => (
  <div className="bg-white border border-slate-100 rounded-[28px] overflow-hidden">
    {pins.map((row, i) => (
      <div
        key={row.pin}
        className={`flex flex-col md:flex-row md:items-center gap-2 md:gap-4 px-5 py-4 ${i > 0 ? 'border-t border-slate-100' : ''}`}
      >
        <span className="font-mono text-[11px] font-bold text-white bg-slate-900 rounded-lg px-3 py-1.5 w-fit shrink-0">
          {row.pin}
        </span>
        <div className="md:w-40 shrink-0">
          <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{row.role}</p>
          <p className="text-[8px] font-bold text-slate-400 uppercase">{row.signal}</p>
        </div>
        <p className="text-[10px] text-slate-500 leading-relaxed">{row.note}</p>
      </div>
    ))}
  </div>
);
