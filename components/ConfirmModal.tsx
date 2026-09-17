import React from 'react';

export type ConfirmActionType = 'danger' | 'warning' | 'info';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  actionLabel: string;
  actionType: ConfirmActionType;
  onConfirm: () => void;
  onClose: () => void;
}

/** Single source of truth for the action-type → visual treatment mapping. */
const STYLES: Record<ConfirmActionType, { box: string; icon: string; button: string }> = {
  danger: {
    box: 'bg-red-50 text-red-600',
    icon: 'fa-triangle-exclamation',
    button: 'bg-red-600 hover:bg-red-700 shadow-red-200',
  },
  warning: {
    box: 'bg-amber-50 text-amber-600',
    icon: 'fa-circle-exclamation',
    button: 'bg-amber-600 hover:bg-amber-700 shadow-amber-200',
  },
  info: {
    box: 'bg-blue-50 text-blue-600',
    icon: 'fa-circle-info',
    button: 'bg-blue-600 hover:bg-blue-700 shadow-blue-200',
  },
};

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  actionLabel,
  actionType,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  const styles = STYLES[actionType];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-inner ${styles.box}`}>
          <i className={`fa-solid text-2xl ${styles.icon}`}></i>
        </div>

        <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-3">{title}</h3>

        <p className="text-slate-500 font-medium mb-8 leading-relaxed text-sm">{message}</p>

        <div className="flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-4 rounded-xl font-bold transition-all text-sm uppercase tracking-wider"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-4 rounded-xl font-black transition-all text-white shadow-lg text-sm uppercase tracking-wider ${styles.button}`}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
