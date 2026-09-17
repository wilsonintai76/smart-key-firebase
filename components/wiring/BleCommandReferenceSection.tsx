import React from 'react';

interface CommandRow {
  cmd: string;
  use: string;
}

export const BleCommandReferenceSection: React.FC<{ commands: CommandRow[] }> = ({ commands }) => (
  <div className="bg-white border border-slate-100 rounded-[28px] overflow-hidden">
    <div className="px-5 py-4 border-b border-slate-100">
      <p className="text-[10px] font-black uppercase text-slate-900 tracking-tight">BLE Command Reference</p>
      <p className="text-[9px] text-slate-400 mt-1">
        ASCII, newline-terminated, 19 bytes maximum — the write characteristic never negotiates a larger MTU.
      </p>
    </div>
    {commands.map((c, i) => (
      <div key={c.cmd} className={`flex items-center justify-between gap-4 px-5 py-3 ${i > 0 ? 'border-t border-slate-100' : ''}`}>
        <span className="font-mono text-[10px] font-bold text-blue-600">{c.cmd}</span>
        <span className="text-[9px] font-bold text-slate-400 uppercase text-right">{c.use}</span>
      </div>
    ))}
  </div>
);
