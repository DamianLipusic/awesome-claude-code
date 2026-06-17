/**
 * Stores material unit prices (EUR) keyed by scaffold system + component ID.
 * Prices are global (per company) so they apply to all projects of the same system.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'gerustbau_preise';

// komponenteId → price in EUR per unit
type PreisMap = Record<string, number>;

interface CostsState {
  preise: PreisMap;
  ladePreise: () => Promise<void>;
  setzePreis: (komponenteId: string, preis: number) => void;
  speicherePreise: () => Promise<void>;
}

export const useCostsStore = create<CostsState>((set, get) => ({
  preise: {},

  ladePreise: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        set({ preise: JSON.parse(raw) });
      }
    } catch (e) {
      console.error('Fehler beim Laden der Preise:', e);
    }
  },

  setzePreis: (komponenteId, preis) => {
    set(state => ({
      preise: { ...state.preise, [komponenteId]: preis },
    }));
  },

  speicherePreise: async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(get().preise));
    } catch (e) {
      console.error('Fehler beim Speichern der Preise:', e);
    }
  },
}));
