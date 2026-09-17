
import React from 'react';
import { KeySlot, UserAccount, SystemConfig, ControllerStatus } from '../types';
import { IdentityList } from './IdentityList';
import { CbmPanel } from './CbmPanel';
import { GlobalPolicyConfig } from './GlobalPolicyConfig';
import { HardwareRegistration } from './HardwareRegistration';
import { RackTopology } from './RackTopology';
import { CloudConnectionConfig } from './CloudConnectionConfig';
import { ConnectivityStatus } from './ConnectivityStatus';
import { ConfirmModal, ConfirmActionType } from './ConfirmModal';

interface AdminHubProps {
  slots: KeySlot[];
  registeredUsers: UserAccount[];
  config: SystemConfig;
  tempConfig: SystemConfig;
  setTempConfig: React.Dispatch<React.SetStateAction<SystemConfig>>;
  saveConfig: () => void;
  onUpdateConfig: (updates: Partial<SystemConfig>) => void;
  isSystemLocked: boolean;
  setIsSystemLocked: (val: boolean) => void;
  isAdminMode: boolean;
  onApproveUser: (id: string) => void;
  onToggleUserRole: (id: string) => void;
  onDeactivateUser: (id: string) => void;
  onActivateUser: (id: string) => void;
  onUnlockUser: (id: string) => void;
  onDeleteUser: (id: string) => void;
  onAddModule: () => void;
  onDeleteModule: (idx: number) => void;
  onUpdateSlotLabel: (id: number, label: string) => void;
  onToggleSlotLock: (id: number) => void;
  onMaintenanceRequest: (id: number) => void;
  recentlyMaintained: number | null;
  isUserBorrowing: (name: string) => boolean;
  activeAdminModuleIndex: number;
  setActiveAdminModuleIndex: (idx: number) => void;
  isAddingModule: boolean;
  setIsAddingModule: (val: boolean) => void;
  isBluetoothConnected: boolean;
  bluetoothStatus: string;
  onConnectBluetooth?: () => void;
  currentUser: any;
  onEmergencyRelease: () => Promise<void>;
  onUnlockDoor: () => void;
  isEmergencySequencing: boolean;
  sequenceProgress: string;
  isHardwareTriggerActive?: boolean;
  controllerStatus?: ControllerStatus;
}

export const AdminHub: React.FC<AdminHubProps> = ({
  slots,
  registeredUsers,
  config,
  tempConfig,
  setTempConfig,
  saveConfig,
  onUpdateConfig,
  isSystemLocked,
  setIsSystemLocked,
  isAdminMode,
  onApproveUser,
  onToggleUserRole,
  onDeactivateUser,
  onActivateUser,
  onUnlockUser,
  onDeleteUser,
  onAddModule,
  onDeleteModule,
  onUpdateSlotLabel,
  onToggleSlotLock,
  onMaintenanceRequest,
  recentlyMaintained,
  isUserBorrowing,
  activeAdminModuleIndex,
  setActiveAdminModuleIndex,
  isAddingModule,
  setIsAddingModule,
  isBluetoothConnected,
  bluetoothStatus,
  onConnectBluetooth,
  currentUser,
  onEmergencyRelease,
  onUnlockDoor,
  isEmergencySequencing,
  sequenceProgress,
  isHardwareTriggerActive,
  controllerStatus
}) => {
  const [confirmModal, setConfirmModal] = React.useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionLabel: string;
    actionType: ConfirmActionType;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    actionLabel: 'Confirm',
    actionType: 'danger',
    onConfirm: () => {}
  });

  const confirmAction = (title: string, message: string, actionLabel: string, actionType: 'danger' | 'warning' | 'info', onConfirm: () => void) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      actionLabel,
      actionType,
      onConfirm
    });
  };

  const closeConfirm = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  };

  const handleConfirmSubmit = () => {
    confirmModal.onConfirm();
    closeConfirm();
  };

  if (!isAdminMode) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fadeIn relative">
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        actionLabel={confirmModal.actionLabel}
        actionType={confirmModal.actionType}
        onConfirm={handleConfirmSubmit}
        onClose={closeConfirm}
      />

      <ConnectivityStatus
        isCloudConnected={false}
        controllerStatus={controllerStatus}
        onSwitchToLocalMode={() => {}}
        isEmergencySequencing={isEmergencySequencing}
        isHardwareTriggerActive={isHardwareTriggerActive}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          
          <IdentityList 
            users={registeredUsers}
            isUserBorrowing={isUserBorrowing}
            onApproveUser={(id) => confirmAction(
              'Approve User',
              'Are you sure you want to approve this user? This will grant them access to the system.',
              'Approve',
              'info',
              () => onApproveUser(id)
            )}
            onToggleUserRole={(id) => confirmAction(
              'Change User Role',
              'Are you sure you want to change this user\'s role? This will alter their permissions across the system.',
              'Change Role',
              'warning',
              () => onToggleUserRole(id)
            )}
            onDeactivateUser={(id) => confirmAction(
              'Deactivate User',
              'Are you sure you want to deactivate this user? They will not be able to access the system until reactivated.',
              'Deactivate',
              'warning',
              () => onDeactivateUser(id)
            )}
            onActivateUser={(id) => confirmAction(
              'Activate User',
              'Are you sure you want to activate this user? They will regain access to the system.',
              'Activate',
              'info',
              () => onActivateUser(id)
            )}
            onUnlockUser={(id) => confirmAction(
              'Unlock User',
              'Are you sure you want to unlock this user? Their account will be accessible again.',
              'Unlock',
              'info',
              () => onUnlockUser(id)
            )}
            onDeleteUser={(id) => confirmAction(
              'Delete User',
              'Are you sure you want to permanently delete this user? This action cannot be undone and will remove all their access credentials.',
              'Delete User',
              'danger',
              () => onDeleteUser(id)
            )}
          />

          <CbmPanel 
            slots={slots}
            config={config}
            onMaintenanceRequest={onMaintenanceRequest}
            recentlyMaintained={recentlyMaintained}
            controllerStatus={controllerStatus}
          />

        </div>

        <div className="lg:col-span-4 space-y-6">
          <CloudConnectionConfig
            sysConfig={config}
            onUpdateSysConfig={onUpdateConfig}
            onConnect={async () => {}}
            onDisconnect={() => {}}
            isConnected={false}
            networkMode="local"
            setNetworkMode={() => {}}
            onConnectBluetooth={onConnectBluetooth}
            currentUser={currentUser}
          />

          <GlobalPolicyConfig
            tempConfig={tempConfig}
            setTempConfig={setTempConfig}
            onSave={saveConfig}
            isBluetoothConnected={isBluetoothConnected}
            bluetoothStatus={bluetoothStatus}
          />

          <HardwareRegistration 
            isAddingModule={isAddingModule}
            setIsAddingModule={setIsAddingModule}
            onAddModule={onAddModule}
            currentRackCount={Math.ceil(slots.length / 4)}
          />

          <RackTopology 
            slots={slots}
            activeAdminModuleIndex={activeAdminModuleIndex}
            setActiveAdminModuleIndex={setActiveAdminModuleIndex}
            onUpdateSlotLabel={onUpdateSlotLabel}
            onToggleSlotLock={onToggleSlotLock}
            onDeleteModule={(idx) => confirmAction(
              'Decommission Module',
              'Are you sure you want to decommission this module? All associated keys will be permanently unassigned from this physical pegboard.',
              'Decommission',
              'danger',
              () => onDeleteModule(idx)
            )}
            isSystemLocked={isSystemLocked}
            setIsSystemLocked={setIsSystemLocked}
            onEmergencyRelease={onEmergencyRelease}
            onUnlockDoor={onUnlockDoor}
            isEmergencySequencing={isEmergencySequencing}
            isHardwareTriggerActive={isHardwareTriggerActive}
            doorOpen={controllerStatus?.doorOpen}
            controllerStatus={controllerStatus}
          />
        </div>
      </div>
    </div>
  );
};
