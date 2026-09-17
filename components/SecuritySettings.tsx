
import React from 'react';
import { SystemConfig } from '../types';

interface SecuritySettingsProps {
  user: any;
  config: SystemConfig;
  setConfig: React.Dispatch<React.SetStateAction<SystemConfig>>;
  onShowToast: (toast: any) => void;
}

export const SecuritySettings: React.FC<SecuritySettingsProps> = ({ user, config, setConfig, onShowToast }) => {

  const updateTimeout = (minutes: number) => {
    setConfig(prev => ({ ...prev, sessionTimeout: minutes }));
  };

  return (
    <div className="space-y-10 animate-fadeIn">
      <div>
        <h3 className="text-2xl font-black text-slate-900 mb-2">Security Policy</h3>
        <p className="text-xs text-slate-500 font-medium">Configure authorization protocols and session protection.</p>
      </div>

      <div className="space-y-8">
        {/* Toggle Sections */}
        <div className="grid grid-cols-1 gap-4">
          {/* Session Timeout Config */}
          <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-100">
                  <i className="fa-solid fa-clock-rotate-left"></i>
                </div>
                <div>
                  <p className="text-xs font-black text-slate-900 uppercase mb-0.5">Auto-Session Termination</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Security watchdog for inactivity</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-blue-600">{config.sessionTimeout}</span>
                <span className="text-[10px] font-black text-slate-400 ml-1 uppercase">Min</span>
              </div>
            </div>
            
            <div className="px-2">
              <input 
                type="range" 
                min="1" 
                max="120" 
                value={config.sessionTimeout} 
                onChange={(e) => updateTimeout(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between mt-2">
                <span className="text-[8px] font-black text-slate-300 uppercase">1 Minute</span>
                <span className="text-[8px] font-black text-slate-300 uppercase">2 Hours</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 ml-1">Recent Login Events</h4>
          <div className="overflow-hidden rounded-[32px] border border-slate-100">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-4 text-[9px] font-black uppercase text-slate-400">Timestamp</th>
                  <th className="p-4 text-[9px] font-black uppercase text-slate-400">Location / Device</th>
                  <th className="p-4 text-right text-[9px] font-black uppercase text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="bg-white">
                  <td className="p-4 text-[10px] font-bold text-slate-700">Today, 09:24 AM</td>
                  <td className="p-4 text-[10px] font-medium text-slate-500">Chrome (Windows) • KL, MY</td>
                  <td className="p-4 text-right"><span className="text-[8px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">Current</span></td>
                </tr>
                <tr className="bg-white">
                  <td className="p-4 text-[10px] font-bold text-slate-700">Yesterday, 10:15 PM</td>
                  <td className="p-4 text-[10px] font-medium text-slate-500">Safari (iPhone) • KL, MY</td>
                  <td className="p-4 text-right"><span className="text-[8px] font-black uppercase text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">Expired</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <button 
          onClick={() => onShowToast({ title: 'Password Reset', message: 'Verification link sent to ' + user.email, type: 'info' })}
          className="w-full py-4 text-[10px] font-black uppercase text-rose-500 hover:bg-rose-50 border border-rose-100 rounded-2xl transition-all"
        >
          Request Emergency Credential Reset
        </button>
      </div>
    </div>
  );
};
