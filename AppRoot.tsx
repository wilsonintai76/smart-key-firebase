import React, { useState, useEffect, useRef } from 'react';
// @ts-ignore
const APP_VERSION = (typeof __APP_VERSION__ !== 'undefined') ? __APP_VERSION__ : 'dev';
console.log('[SmartKey] v' + APP_VERSION);
import { useVersionCheck } from './hooks/useVersionCheck';
import {
  KeySlot, LogEntry, UserAccount as UserProfileData,
  SystemConfig, ControllerStatus, KeyStatus, BluetoothStatus,
} from './types';
import { INITIAL_SLOTS, DEFAULT_SYSTEM_CONFIG } from './constants';
import { bluetoothService } from './services/bluetoothService';
import { queueAuditEvent, flushAuditQueue, getQueueLength } from './services/offlineQueue';
import { consumeGoogleRedirectResult, signInWithGoogle, signOutUser, subscribeAuthUser } from './services/firebaseAuth';
import { deleteUserProfile, subscribeUsers, updateUserProfile, writeAuditEvent } from './services/firebaseUsers';
import { isFirebaseConfigured } from './services/firebase';

import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { AdminHub } from './components/AdminHub';
import { Analytics } from './components/Analytics';
import { LoadingSpinner } from './components/LoadingSpinner';
import { SettingsView } from './components/SettingsView';
import { OnboardingWizard } from './components/OnboardingWizard';
import { UserProfile } from './components/UserProfile';
import { SystemGuide } from './components/SystemGuide';
import { Header } from './components/Header';
import { ToastContainer } from './components/ToastContainer';
import { MobileNavigation } from './components/MobileNavigation';
import { MainContent } from './components/MainContent';

interface Toast {
  title: string; message: string;
  type: 'success' | 'warning' | 'danger' | 'info';
  action?: () => void;
}

/** Shape shared by the RTDB profile and the auth profile. */
type RemoteUser = {
  uid: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'staff' | 'admin';
  contact?: string;
  status?: 'active' | 'inactive' | 'locked';
};

const mapRemoteUser = (u: RemoteUser): UserProfileData => ({
  id: u.uid,
  name: u.name,
  email: u.email || '',
  avatar: u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=6366f1&color=fff&size=128`,
  status: u.status || 'active',
  role: u.role,
  contact: u.contact || '',
});

/** Merge RTDB profiles into the local list. */
const mergeUsers = (current: UserProfileData[], incoming: UserProfileData[]): UserProfileData[] => {
  const merged = [...current];
  for (const user of incoming) {
    const idx = merged.findIndex(u => u.id === user.id);
    if (idx === -1) merged.push(user);
    else merged[idx] = { ...merged[idx], ...user };
  }
  return merged;
};

export const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<UserProfileData | null>(null);
  const [authResolved, setAuthResolved] = useState(!isFirebaseConfigured);
  const [registeredUsers, setRegisteredUsers] = useState<UserProfileData[]>([]);
  const [config, setConfig] = useState<SystemConfig>(DEFAULT_SYSTEM_CONFIG);

  const [uiState, setUiState] = useState({
    view: 'dashboard' as 'dashboard' | 'admin' | 'analytics',
    showSettings: false,
    settingsTab: 'account' as 'account' | 'security',
    showGuide: false,
    toast: null as Toast | null,
    isAuthenticating: false,
    isGlobalLoading: false,
    globalError: null as string | null,
  });

  const updateUI = (updates: Partial<typeof uiState>) => setUiState(prev => ({ ...prev, ...updates }));
  const showToast = (toast: Toast) => updateUI({ toast });
  const clearToast = () => updateUI({ toast: null });
  const setView = (view: 'dashboard' | 'admin' | 'analytics') => updateUI({ view, showSettings: false });
  const showGlobalError = (message: string) => {
    updateUI({ globalError: message });
    setTimeout(() => setUiState(prev => prev.globalError === message ? { ...prev, globalError: null } : prev), 5000);
  };
  const clearGlobalError = () => updateUI({ globalError: null });

  const [slots, setSlots] = useState<KeySlot[]>(INITIAL_SLOTS);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [bluetoothStatus, setBluetoothStatus] = useState<BluetoothStatus>('disconnected');
  const isBluetoothConnected = bluetoothStatus === 'connected';
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [controllerStatus, setControllerStatus] = useState<ControllerStatus | undefined>(undefined);

  const [tempConfig, setTempConfig] = useState<SystemConfig>(DEFAULT_SYSTEM_CONFIG);
  const [activeModuleIndex, setActiveModuleIndex] = useState(0);
  const [activeAdminModuleIndex, setActiveAdminModuleIndex] = useState(0);
  const [isAddingModule, setIsAddingModule] = useState(false);

  const [isSystemLocked, setIsSystemLocked] = useState(false);
  const [unlockQueue, setUnlockQueue] = useState<number[]>([]);
  const [isEmergencySequencing, setIsEmergencySequencing] = useState(false);
  const [sequenceProgress, setSequenceProgress] = useState('');
  const [isHardwareTriggerActive, setIsHardwareTriggerActive] = useState(false);
  const [isPostEmergency, setIsPostEmergency] = useState(false);
  const [recentlyMaintained, setRecentlyMaintained] = useState<number | null>(null);

  // ── Init: Load local data + try session recovery ────────────────
  useEffect(() => {
    const stored = localStorage.getItem('smartkey_config');
    if (stored) { try { const parsed = JSON.parse(stored); setConfig(parsed); setTempConfig(parsed); } catch {} }
    const storedUsers = localStorage.getItem('smartkey_users');
    if (storedUsers) { try { setRegisteredUsers(JSON.parse(storedUsers)); } catch {} }
    const storedSlots = localStorage.getItem('smartkey_slots');
    if (storedSlots) { try { setSlots(JSON.parse(storedSlots)); } catch {} }

    // Live cross-device sync: every RTDB profile is merged into the local list.
    const unsubscribe = subscribeUsers(cloudUsers => {
      if (cloudUsers.length === 0) return;
      const mapped = cloudUsers.map(mapRemoteUser);
      setRegisteredUsers(prev => mergeUsers(prev, mapped));
      // RTDB is authoritative for role/status: an admin's change must reach the
      // affected session without a reload (auth only re-fires on sign-in).
      setUser(prev => {
        if (!prev) return prev;
        const self = mapped.find(u => u.id === prev.id);
        if (!self || (self.role === prev.role && self.status === prev.status)) return prev;
        return { ...prev, role: self.role, status: self.status };
      });
    });

    // Complete a pending Google redirect sign-in (no-op for popup flows).
    consumeGoogleRedirectResult().catch(() => {});

    setIsLoading(false);
    return unsubscribe;
  }, []);

  // ── Google auth subscription → session user ─────────────────────
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let settled = false;
    // Don't hang the splash screen if RTDB is unreachable.
    const timeout = setTimeout(() => { if (!settled) setAuthResolved(true); }, 5000);
    const unsub = subscribeAuthUser(authUser => {
      settled = true;
      clearTimeout(timeout);
      if (!authUser) {
        setUser(null);
        setAuthResolved(true);
        return;
      }
      const mapped = mapRemoteUser(authUser);
      setRegisteredUsers(prev => mergeUsers(prev, [mapped]));
      setUser(mapped);
      setAuthResolved(true);
    });
    return () => { clearTimeout(timeout); unsub(); };
  }, []);

  // Tell the affected session about a live role change and never leave it on
  // an admin-only view once admin access is gone.
  const lastRole = useRef<string | null>(null);
  useEffect(() => {
    if (!user) { lastRole.current = null; return; }
    const previous = lastRole.current;
    lastRole.current = user.role;
    if (previous && previous !== user.role) {
      showToast({
        title: 'Role Updated',
        message: `Your role is now ${user.role === 'admin' ? 'Administrator' : 'Staff'}.`,
        type: 'info',
      });
    }
    if (user.role !== 'admin' && uiState.view !== 'dashboard') setView('dashboard');
  }, [user, uiState.view]);

  useEffect(() => { localStorage.setItem('smartkey_config', JSON.stringify(config)); }, [config]);
  useEffect(() => { localStorage.setItem('smartkey_users', JSON.stringify(registeredUsers)); }, [registeredUsers]);
  useEffect(() => { localStorage.setItem('smartkey_slots', JSON.stringify(slots)); }, [slots]);

  // ── Version check: detect new deployments ──────────────────────
  useVersionCheck((current, latest) => {
    showToast({
      title: 'Update Available',
      message: `New version ${latest} available (you're on ${current}). Tap to refresh.`,
      type: 'info',
      action: () => window.location.reload(),
    });
  });

  // ── Online/Offline + Offline Queue Flush ────────────────────────
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Flush any queued audit events to Realtime Database
      flushAuditQueue(async (event) => writeAuditEvent({
        action: event.action,
        slotLabel: event.slotLabel,
        pegStateBefore: event.pegStateBefore,
        pegStateAfter: event.pegStateAfter,
        timestamp: event.timestamp,
      })).then(({ flushed }) => {
        if (flushed > 0) showToast({ title: 'Queue Flushed', message: `${flushed} offline event(s) synced to cloud.`, type: 'success' });
      }).catch(() => {});
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  // ── BLE Lifecycle ───────────────────────────────────────────────
  useEffect(() => {
    const unsub = bluetoothService.onStatusChange(status => {
      setBluetoothStatus(status);
      if (status === 'connected') showToast({ title: 'Bluetooth Linked', message: 'Secure peer-to-peer connection established.', type: 'success' });
      else if (status === 'disconnected' || status === 'error') setControllerStatus(undefined); // clear stale telemetry
      if (status === 'error') showToast({ title: 'Bluetooth Error', message: 'Pairing failed.', type: 'danger' });
    });
    bluetoothService.onDataReceived(data => {
      const status = bluetoothService.parseStatus(data);
      if (status) setControllerStatus(status);
    });
    return () => unsub();
  }, []);

  // ── BLE Key Presence → Slot State + Cloud Audit (Realtime Database) ──
  useEffect(() => {
    const unsub = bluetoothService.onKeyPresence(keyPresent => {
      const action = keyPresent ? 'cabinet_close' : 'cabinet_open';
      const pegBefore = keyPresent ? 'BORROWED' : 'AVAILABLE';
      const pegAfter = keyPresent ? 'AVAILABLE' : 'BORROWED';

      if (user?.id) {
        if (navigator.onLine) {
          writeAuditEvent({ action, slotLabel: 'Cabinet', pegStateBefore: pegBefore, pegStateAfter: pegAfter }).catch(() => {});
        } else {
          queueAuditEvent({ action, slotLabel: 'Cabinet', pegStateBefore: pegBefore, pegStateAfter: pegAfter });
        }
      }

      // ── Update slot state from hardware microswitch ─────────────
      setSlots(prev => {
        if (!keyPresent) {
          // Key physically removed: transition UNLOCKED → BORROWED (or AVAILABLE → BORROWED for forced removal)
          const targetIdx = prev.findIndex(s => s.status === KeyStatus.UNLOCKED);
          if (targetIdx === -1) {
            // Fallback: if no unlocked slot, mark first AVAILABLE as BORROWED (forced removal)
            const availIdx = prev.findIndex(s => s.status === KeyStatus.AVAILABLE);
            if (availIdx === -1) return prev;
            const updated = [...prev];
            updated[availIdx] = {
              ...updated[availIdx],
              status: KeyStatus.BORROWED,
              borrowedBy: user?.name || 'Unknown',
              borrowerId: user?.id || 'unknown',
              borrowedAt: new Date().toISOString(),
              usageCount: updated[availIdx].usageCount + 1,
            };
            return updated;
          }
          const updated = [...prev];
          updated[targetIdx] = {
            ...updated[targetIdx],
            status: KeyStatus.BORROWED,
            borrowedBy: user?.name || 'Unknown',
            borrowerId: user?.id || 'unknown',
            borrowedAt: new Date().toISOString(),
            usageCount: updated[targetIdx].usageCount + 1,
          };
          return updated;
        } else {
          // Key physically returned: transition BORROWED → AVAILABLE (or UNLOCKED → AVAILABLE)
          const targetIdx = prev.findIndex(s => s.status === KeyStatus.BORROWED);
          if (targetIdx === -1) {
            // Fallback: if no borrowed slot, reset first UNLOCKED to AVAILABLE
            const unlockedIdx = prev.findIndex(s => s.status === KeyStatus.UNLOCKED);
            if (unlockedIdx === -1) return prev;
            const updated = [...prev];
            updated[unlockedIdx] = {
              ...updated[unlockedIdx],
              status: KeyStatus.AVAILABLE,
              borrowedBy: undefined,
              borrowerId: undefined,
              borrowedAt: undefined,
            };
            return updated;
          }
          const updated = [...prev];
          updated[targetIdx] = {
            ...updated[targetIdx],
            status: KeyStatus.AVAILABLE,
            borrowedBy: undefined,
            borrowerId: undefined,
            borrowedAt: undefined,
          };
          return updated;
        }
      });
    });
    return () => unsub();
  }, [user]);

  // ── Cleanup on exit ─────────────────────────────────────────────
  useEffect(() => {
    const cleanup = () => { bluetoothService.disconnect(); };
    const onHidden = () => { if (document.visibilityState === 'hidden') cleanup(); };
    window.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', cleanup);
    return () => { window.removeEventListener('visibilitychange', onHidden); window.removeEventListener('pagehide', cleanup); };
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────
  const addLog = (userName: string, action: string, keyLabel: string, type: 'success' | 'warning' | 'info', userId?: string, slotId?: number) => {
    const formattedAction = slotId !== undefined ? `${action}: Slot ${slotId}` : action;
    const newLog: LogEntry = { id: Date.now().toString(), timestamp: new Date().toLocaleString(), user: userName, userId: userId || user?.id, action: formattedAction, keyLabel, type };
    setLogs(prev => [newLog, ...prev]);
  };

  const handleGoogleLogin = async () => {
    updateUI({ isAuthenticating: true });
    try {
      await signInWithGoogle();
      // The auth subscription effect takes over once the popup resolves.
    } catch (err: any) {
      const code = err?.code || '';
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        showToast({
          title: 'Sign-In Failed',
          message: code === 'auth/operation-not-allowed'
            ? 'Google Sign-In is not enabled for this Firebase project yet.'
            : err?.message || 'Google Sign-In failed. Check your connection and try again.',
          type: 'danger',
        });
      }
    } finally {
      updateUI({ isAuthenticating: false });
    }
  };

  const handleLogout = () => {
    signOutUser().catch(() => {});
    setUser(null);
    setView('dashboard');
  };

  // ── Slot Actions (BLE-only) ─────────────────────────────────────
  const initiateUnlock = (id: number) => {
    const slot = slots.find(s => s.id === id);
    if (!slot || !user) return;
    if (isBluetoothConnected) bluetoothService.sendCommand(JSON.stringify({ action: 'unlock', slotId: id, user: user.name })).catch(() => {});
    const updated = slots.map(s => s.id === id ? { ...s, status: KeyStatus.UNLOCKED } : s);
    setSlots(updated);
    addLog(user.name, 'Key Unlocked', slot.label, 'info', user.id, id);
  };

  const handleForceReturn = (id: number) => {
    const slot = slots.find(s => s.id === id);
    if (!slot || !user) return;
    if (isBluetoothConnected) bluetoothService.sendCommand(JSON.stringify({ action: 'force_return', slotId: id, user: user.name })).catch(() => {});
    setSlots(prev => prev.map(s => s.id === id ? { ...s, status: KeyStatus.AVAILABLE, borrowedBy: undefined, borrowerId: undefined, borrowedAt: undefined } : s));
    addLog(user.name, 'Force Return', slot.label, 'warning', user.id, id);
  };

  const handleMaintenanceRequest = (id: number) => {
    setRecentlyMaintained(id);
    if (isBluetoothConnected) bluetoothService.sendCommand(JSON.stringify({ action: 'maintenance', slotId: id, type: 'cycle_test' })).catch(() => {});
    setTimeout(() => setRecentlyMaintained(null), 3000);
    if (user) addLog(user.name, 'Maintenance Cycle', `Slot ${id}`, 'info', user.id, id);
  };

  const handleUnlockDoor = () => {
    if (!user) return;
    if (isBluetoothConnected) bluetoothService.sendCommand(JSON.stringify({ action: 'unlock_door', user: user.name })).catch(() => {});
    addLog(user.name, 'Cabinet Unlock', 'Main Door', 'success', user.id);
    showToast({ title: 'Command Sent', message: 'Unlock signal transmitted.', type: 'info' });
  };

  const saveConfig = () => {
    if (!tempConfig) return;
    setConfig(tempConfig);
    if (isBluetoothConnected) bluetoothService.sendCommand(JSON.stringify({ action: 'config_sync', data: tempConfig })).catch(() => {});
    addLog(user?.name || 'System', 'Config Updated', 'Global Policy', 'info', user?.id);
    showToast({ title: 'Configuration Saved', message: 'System policies updated.', type: 'success' });
  };

  const handleUpdateSlot = (id: number, updates: Partial<KeySlot>) => {
    setSlots(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  // ── Render ──────────────────────────────────────────────────────
  if (isLoading) return <LoadingSpinner />;

  if (!user) {
    return (<>
      <ToastContainer toast={uiState.toast} globalError={uiState.globalError} onClearToast={clearToast} onClearGlobalError={clearGlobalError} />
      <Login onGoogleLogin={handleGoogleLogin} isAuthenticating={uiState.isAuthenticating}
        systemID={config.systemID} bluetoothStatus={bluetoothStatus} />
    </>);
  }

  const isAdmin = user.role === 'admin';
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-100 flex flex-col relative overflow-hidden pb-20 md:pb-0">
      <ToastContainer toast={uiState.toast} globalError={uiState.globalError} onClearToast={clearToast} onClearGlobalError={clearGlobalError} />
      <Header networkMode="local" bluetoothStatus={bluetoothStatus} showSettings={uiState.showSettings}
        view={uiState.view} isAdmin={isAdmin} user={user} onViewChange={setView}
        onOpenGuide={() => updateUI({ showGuide: true })} onLogout={handleLogout}
        onOpenSettings={tab => updateUI({ settingsTab: tab, showSettings: true })}
        onConnectBluetooth={() => bluetoothService.connect().catch(e => showGlobalError(e.message))} />
      <MainContent view={uiState.view} showSettings={uiState.showSettings} settingsTab={uiState.settingsTab}
        user={user} setUser={setUser} config={config} setConfig={setConfig} tempConfig={tempConfig} setTempConfig={setTempConfig}
        registeredUsers={registeredUsers} slots={slots} logs={logs} isAdmin={isAdmin} isSystemLocked={isSystemLocked}
        setIsSystemLocked={setIsSystemLocked} bluetoothStatus={bluetoothStatus}
        isCloudConnected={false} isBluetoothConnected={isBluetoothConnected}
        controllerStatus={controllerStatus} activeModuleIndex={activeModuleIndex} setActiveModuleIndex={setActiveModuleIndex}
        activeAdminModuleIndex={activeAdminModuleIndex} setActiveAdminModuleIndex={setActiveAdminModuleIndex}
        isAddingModule={isAddingModule} setIsAddingModule={setIsAddingModule} recentlyMaintained={recentlyMaintained}
        unlockQueue={unlockQueue} isEmergencySequencing={isEmergencySequencing} sequenceProgress={sequenceProgress}
        isPostEmergency={isPostEmergency} setIsPostEmergency={setIsPostEmergency} isHardwareTriggerActive={isHardwareTriggerActive}
        onViewChange={setView} onUpdateUI={updateUI} onShowToast={showToast} onAddLog={addLog}
        onExportLogs={() => {
          const csv = 'data:text/csv;charset=utf-8,' + logs.map(e => `${e.timestamp},${e.user},${e.action},${e.keyLabel},${e.type}`).join('\n');
          window.open(encodeURI(csv));
        }}
        onInitiateUnlock={initiateUnlock} onUnlockDoor={handleUnlockDoor}
        handleForceReturn={handleForceReturn} handleMaintenanceRequest={handleMaintenanceRequest} onSaveConfig={saveConfig}
        onApproveUser={id => {
          setRegisteredUsers(prev => prev.map(u => u.id === id ? { ...u, status: 'active' } : u));
          updateUserProfile(id, { status: 'active' }).catch(() => {});
        }}
        onToggleUserRole={id => {
          const target = registeredUsers.find(u => u.id === id);
          const nextRole: 'staff' | 'admin' = target?.role === 'admin' ? 'staff' : 'admin';
          setRegisteredUsers(prev => prev.map(u => u.id === id ? { ...u, role: nextRole } : u));
          updateUserProfile(id, { role: nextRole }).then(ok => {
            if (!ok) showToast({ title: 'Role Change Failed', message: 'Only admins can change roles.', type: 'danger' });
          }).catch(() => {});
        }}
        onDeactivateUser={id => {
          setRegisteredUsers(prev => prev.map(u => u.id === id ? { ...u, status: 'inactive' } : u));
          updateUserProfile(id, { status: 'inactive' }).catch(() => {});
        }}
        onActivateUser={id => {
          setRegisteredUsers(prev => prev.map(u => u.id === id ? { ...u, status: 'active' } : u));
          updateUserProfile(id, { status: 'active' }).catch(() => {});
        }}
        onUnlockUser={id => {
          setRegisteredUsers(prev => prev.map(u => u.id === id ? { ...u, status: 'active' } : u));
          updateUserProfile(id, { status: 'active' }).catch(() => {});
        }}
        onDeleteUser={id => {
          setRegisteredUsers(prev => prev.filter(u => u.id !== id));
          deleteUserProfile(id).catch(() => {});
        }}
        onAddModule={() => {
          setIsAddingModule(false);
          const newId = slots.length + 1;
          setSlots([...slots, ...Array.from({ length: 4 }, (_, i) => ({ id: newId + i, label: `Slot ${newId + i}`, status: KeyStatus.AVAILABLE, usageCount: 0, lastUpdated: new Date().toISOString() } as KeySlot))]);
        }}
        onDeleteModule={idx => { const start = idx * 4; setSlots(prev => { const n = [...prev]; n.splice(start, 4); return n; }); }}
        onUpdateSlotLabel={(id, label) => setSlots(prev => prev.map(s => s.id === id ? { ...s, label } : s))}
        onUpdateSlot={handleUpdateSlot}
        onToggleSlotLock={id => setSlots(prev => prev.map(s => s.id === id ? { ...s, isLocked: !s.isLocked } : s))}
        onSwitchToLocalMode={() => {}}
        onConnectBluetooth={() => bluetoothService.connect().catch(e => showGlobalError(e.message))}
        onConnectCloud={async () => {}}
        onDisconnectCloud={() => {}}
        networkMode="local" setNetworkMode={() => {}} />
      <SystemGuide isOpen={uiState.showGuide} onClose={() => updateUI({ showGuide: false })} />
      <MobileNavigation view={uiState.view} isAdmin={isAdmin} showSettings={uiState.showSettings}
        onViewChange={setView} onShowSettings={show => updateUI({ showSettings: show })} />
    </div>
  );
};
