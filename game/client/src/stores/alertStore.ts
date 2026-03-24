import { create } from 'zustand';
import type { GameAlert } from '@economy-game/shared';

interface AlertState {
  alerts: GameAlert[];
  unreadCount: number;
}

interface AlertActions {
  addAlert: (alert: GameAlert) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  setAlerts: (alerts: GameAlert[]) => void;
}

type AlertStore = AlertState & AlertActions;

export const useAlertStore = create<AlertStore>((set, get) => ({
  alerts: [],
  unreadCount: 0,

  addAlert: (alert: GameAlert) => {
    const { alerts } = get();
    // Avoid duplicates
    if (alerts.some((a) => a.id === alert.id)) return;

    const newAlerts = [alert, ...alerts].slice(0, 100);
    const unreadCount = newAlerts.filter((a) => !a.read).length;
    set({ alerts: newAlerts, unreadCount });
  },

  markRead: (id: string) => {
    const { alerts } = get();
    const updated = alerts.map((a) => (a.id === id ? { ...a, read: true } : a));
    const unreadCount = updated.filter((a) => !a.read).length;
    set({ alerts: updated, unreadCount });
  },

  markAllRead: () => {
    const { alerts } = get();
    const updated = alerts.map((a) => ({ ...a, read: true }));
    set({ alerts: updated, unreadCount: 0 });
  },

  setAlerts: (alerts: GameAlert[]) => {
    const unreadCount = alerts.filter((a) => !a.read).length;
    set({ alerts, unreadCount });
  },
}));
