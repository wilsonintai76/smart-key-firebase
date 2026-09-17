import React from 'react';
import { KeyStatus, KeySlot } from '../types';

const STATUS_STYLES: Record<KeyStatus, { badge: string; dot: string; icon: string }> = {
  [KeyStatus.AVAILABLE]: {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    icon: 'fa-check',
  },
  [KeyStatus.BORROWED]: {
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
    icon: 'fa-user-tag',
  },
  [KeyStatus.UNLOCKED]: {
    badge: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    dot: 'bg-yellow-500 animate-pulse',
    icon: 'fa-unlock',
  },
};

interface SlotStatusBadgeProps {
  slot: KeySlot;
}

export const SlotStatusBadge: React.FC<SlotStatusBadgeProps> = ({ slot }) => {
  const styles = STATUS_STYLES[slot.status];
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-sm ${styles.badge}`}>
      <div className={`w-2 h-2 rounded-full ${styles.dot}`}></div>
      <span className="text-[10px] font-black uppercase tracking-wider">
        CH-{String(slot.id).padStart(2, '0')}: {slot.status}
      </span>
      <i className={`fa-solid ${styles.icon} text-[10px] ml-1 opacity-70`}></i>
    </div>
  );
};
