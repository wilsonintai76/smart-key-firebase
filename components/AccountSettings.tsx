
import React, { useState } from 'react';
import { updateUserProfile } from '../services/firebaseUsers';

interface AccountSettingsProps {
  user: any;
  setUser: (user: any) => void;
  onShowToast: (toast: any) => void;
}

export const AccountSettings: React.FC<AccountSettingsProps> = ({ user, setUser, onShowToast }) => {
  const [name, setName] = useState(user.name);
  const [contact, setContact] = useState(user.contact || '');

  const handleSave = async () => {
    setUser({ ...user, name, contact });
    const synced = await updateUserProfile(user.id, { name, contact });
    onShowToast({
      title: synced ? 'Profile Updated' : 'Saved On This Device',
      message: synced ? 'Your account details have been synced.' : 'Cloud sync failed — changes are stored locally for now.',
      type: synced ? 'success' : 'warning'
    });
  };

  return (
    <div className="space-y-10 animate-fadeIn">
      <div>
        <h3 className="text-2xl font-black text-slate-900 mb-2">Account Information</h3>
        <p className="text-xs text-slate-500 font-medium">Manage your Google identity profile and device settings.</p>
      </div>

      <div className="space-y-8">
        {/* Avatar Section */}
        <div className="flex items-center gap-6">
          <div className="relative group cursor-pointer">
            <img 
              src={user.avatar} 
              className="w-24 h-24 rounded-[32px] border-4 border-slate-50 shadow-xl group-hover:opacity-80 transition-opacity" 
              alt="Profile" 
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <i className="fa-solid fa-camera text-white text-xl"></i>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Profile Avatar</p>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-slate-100 text-slate-700 text-[10px] font-black uppercase rounded-xl hover:bg-slate-200 transition-colors">Change Photo</button>
              <button className="px-4 py-2 text-rose-500 text-[10px] font-black uppercase rounded-xl hover:bg-rose-50 transition-colors">Remove</button>
            </div>
          </div>
        </div>

        {/* Form Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block ml-1">Full Name</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl text-sm font-bold text-slate-800 focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block ml-1">Contact No.</label>
            <div className="relative">
              <input 
                type="text" 
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="+60 12-345 6789"
                className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl text-sm font-bold text-slate-800 focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none" 
              />
              <i className="fa-solid fa-phone absolute right-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
            </div>
          </div>
        </div>

        <button 
          onClick={handleSave}
          className="bg-slate-900 text-white px-8 py-4 rounded-2xl text-xs font-black uppercase shadow-xl shadow-slate-200 hover:bg-slate-800 active:scale-95 transition-all"
        >
          Save Identity Changes
        </button>
      </div>
    </div>
  );
};
