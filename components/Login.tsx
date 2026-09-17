import React, { useEffect, useState } from 'react';
import { bluetoothService } from '../services/bluetoothService';
import { isFirebaseConfigured } from '../services/firebase';

interface LoginProps {
  onGoogleLogin: () => void | Promise<void>;
  isAuthenticating: boolean;
  systemID: string;
  bluetoothStatus?: string;
}

export const Login: React.FC<LoginProps> = ({
  onGoogleLogin,
  isAuthenticating,
  systemID,
  bluetoothStatus = 'disconnected',
}) => {
  const [discoveredDevices, setDiscoveredDevices] = useState<BluetoothDevice[]>([]);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    if (!navigator.bluetooth) return;
    const unsub = bluetoothService.onDiscovery((devices) => setDiscoveredDevices(devices));
    bluetoothService.startScanning();
    return () => unsub();
  }, []);

  const busy = isSigningIn || isAuthenticating;

  const handleGoogleSignIn = async () => {
    if (busy) return;
    setIsSigningIn(true);
    try {
      await onGoogleLogin();
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6">
      <div className="bg-white rounded-[40px] shadow-2xl p-10 max-w-md w-full text-center animate-fadeIn border-t-8 border-blue-600 relative overflow-hidden">

        {/* Background Decor */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-50 rounded-full opacity-50"></div>
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-slate-50 rounded-full opacity-50"></div>

        <div className="relative z-10">
          <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
            <i className="fa-solid fa-tower-broadcast text-4xl text-blue-600"></i>
          </div>

          <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">SecureKey</h1>
          <p className="text-slate-500 mb-8 text-sm font-bold uppercase tracking-widest opacity-60">Key Management System</p>

          <div className="space-y-4 animate-fadeIn">
            {/* BLE Status — distinct states */}
            <div className={`p-4 rounded-2xl border text-xs font-medium mb-4 ${
              bluetoothStatus === 'connected' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' :
              bluetoothStatus === 'connecting' ? 'bg-blue-50 border-blue-100 text-blue-800' :
              bluetoothStatus === 'scanning' ? 'bg-amber-50 border-amber-100 text-amber-800' :
              'bg-slate-50 border-slate-100 text-slate-500'
            }`}>
              <p className="font-black uppercase mb-1">
                <i className={`fa-solid mr-1 ${
                  bluetoothStatus === 'connected' ? 'fa-link text-emerald-500' :
                  bluetoothStatus === 'connecting' ? 'fa-spinner animate-spin text-blue-500' :
                  bluetoothStatus === 'scanning' ? 'fa-rss animate-pulse text-amber-500' :
                  'fa-bluetooth-b'
                }`}></i>
                {bluetoothStatus === 'connected' ? 'Cabinet Connected' :
                 bluetoothStatus === 'connecting' ? 'Connecting to cabinet...' :
                 bluetoothStatus === 'scanning' ? 'Scanning for cabinets...' :
                 'Bluetooth Disconnected'}
              </p>
              {bluetoothStatus === 'disconnected' && (
                <button onClick={() => bluetoothService.startScanning()}
                  className="text-[10px] font-bold text-blue-600 underline mt-1 min-h-[44px] flex items-center">
                  <i className="fa-solid fa-magnifying-glass mr-1"></i> Tap to Scan
                </button>
              )}
              {bluetoothStatus === 'connected' && (
                <p className="text-[10px] font-bold mt-1">Secure link active — ready to unlock</p>
              )}
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {discoveredDevices.map((device) => (
                <button
                  key={device.id}
                  onClick={() => bluetoothService.connectToDevice(device)}
                  disabled={bluetoothStatus === 'connecting' || bluetoothStatus === 'connected'}
                  className={`w-full p-3.5 rounded-2xl border-2 transition-all duration-150 text-left flex items-center justify-between gap-3 min-h-[52px] active:scale-[0.98] ${
                    bluetoothStatus === 'connected' ? 'bg-slate-50 border-slate-100 opacity-60' :
                    'bg-white border-slate-200 active:border-blue-400 active:shadow-md'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <i className="fa-solid fa-bluetooth-b text-blue-600"></i>
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-900 line-clamp-1">{device.name || 'Unknown Node'}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Tap to connect</p>
                    </div>
                  </div>
                  <i className={`fa-solid ${bluetoothStatus === 'connected' ? 'fa-circle-check text-emerald-500' : 'fa-chevron-right text-slate-300'}`}></i>
                </button>
              ))}
            </div>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest">
                <span className="bg-white px-4 text-slate-300">Sign in</span>
              </div>
            </div>

            <button
              onClick={handleGoogleSignIn}
              disabled={busy || !isFirebaseConfigured}
              className="w-full py-4 rounded-2xl font-black uppercase text-xs tracking-wider flex items-center justify-center gap-3 bg-white border-2 border-slate-200 text-slate-700 active:border-blue-400 active:text-blue-600 disabled:opacity-50 transition-colors duration-150 min-h-[52px]"
            >
              {busy ? (
                <><i className="fa-solid fa-spinner animate-spin"></i> Signing in...</>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.77 24c0-1.6.28-3.14.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.88.93 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 47.5c6.47 0 11.9-2.12 15.86-5.79l-7.73-6c-2.13 1.43-4.86 2.29-8.13 2.29-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.12 14.62 47.5 24 47.5z" />
                  </svg>
                  Continue with Google
                </>
              )}
            </button>

            <p className="text-[10px] font-bold text-slate-400 leading-relaxed">
              Sign in with your organisation Google account.<br />
              Access is granted by an administrator invitation.
            </p>

            {!isFirebaseConfigured && (
              <p className="text-[10px] font-bold text-rose-500">
                Firebase is not configured. Add VITE_FIREBASE_* values to .env.
              </p>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-slate-50 flex flex-col items-center gap-2">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              Workshop Node ID
            </p>
            <div className="bg-slate-900 text-blue-400 px-4 py-1.5 rounded-full text-[10px] font-mono font-black border border-blue-900/30">
              {systemID}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
