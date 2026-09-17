import React from 'react';

interface SensorMode {
  name: string;
  badge: string;
  badgeClass: string;
  cost: string;
  tells: string;
  detail: string;
  change: string;
}

export const ModuleSlotsSection: React.FC<{ modes: SensorMode[] }> = ({ modes }) => (
  <div className="p-6 bg-slate-50 border border-slate-200 rounded-4xl space-y-5">
    <div>
      <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2 mb-2">
        <i className="fa-solid fa-table-cells"></i> One Module = 4 Slots
      </h4>
      <p className="text-[10px] text-slate-500 leading-relaxed">
        Adding a module in Control Hub creates <strong>4 key slots</strong>, so one row of your pegboard holds
        <strong> 4 pegs</strong>, not one. The shipped firmware puts one switch on each peg, so the cabinet reports
        the <strong>individual peg</strong> that moved and the app simply believes it. Only the row-level fallback
        leaves the app to infer which peg was taken by looking for the slot you just unlocked.
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {modes.map(mode => (
        <div key={mode.name} className="p-5 bg-white border border-slate-200 rounded-2xl space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase text-slate-900 tracking-tight">{mode.name}</p>
            <span className={`text-[8px] font-black uppercase rounded-lg px-2 py-1 border ${mode.badgeClass}`}>
              {mode.badge}
            </span>
          </div>
          <p className="text-[9px] font-mono font-bold text-blue-600">{mode.cost}</p>
          <p className="text-[9px] font-bold text-slate-700 leading-relaxed">{mode.tells}</p>
          <p className="text-[9px] text-slate-500 leading-relaxed">{mode.detail}</p>
          <p className="text-[9px] font-black uppercase text-slate-400 tracking-tight">{mode.change}</p>
        </div>
      ))}
    </div>

    <div className="p-4 bg-white rounded-2xl border border-slate-200">
      <p className="text-[9px] font-black uppercase text-rose-500 tracking-tight mb-1">
        Row-level mode infers the peg
      </p>
      <p className="text-[9px] text-slate-500 leading-relaxed">
        Only when <code>PEG_SWITCH_COUNT</code> is 0 does the app guess: it marks the slot sitting in
        <code> UNLOCKED</code> state as BORROWED, and falls back to the first <code>AVAILABLE</code> one if none is.
        That is accurate while a single key leaves at a time — take two together and the second is blamed on
        whichever slot happens to sort first. Per-peg wiring removes that guess entirely.
      </p>
    </div>
  </div>
);
