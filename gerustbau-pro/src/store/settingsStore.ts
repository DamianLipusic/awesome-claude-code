import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'gerustbau_einstellungen';

interface EinstellungenState {
  firmenname: string;
  standardEinheit: 'm' | 'cm';

  ladeEinstellungen: () => Promise<void>;
  setzeFiremenname: (name: string) => void;
  setzeStandardEinheit: (einheit: 'm' | 'cm') => void;
  speichereEinstellungen: () => Promise<void>;
}

export const useEinstellungenStore = create<EinstellungenState>((set, get) => ({
  firmenname: '',
  standardEinheit: 'm',

  ladeEinstellungen: async () => {
    try {
      const gespeichert = await AsyncStorage.getItem(STORAGE_KEY);
      if (gespeichert) {
        const daten = JSON.parse(gespeichert);
        set({
          firmenname: daten.firmenname ?? '',
          standardEinheit: daten.standardEinheit ?? 'm',
        });
      }
    } catch (e) {
      console.error('Fehler beim Laden der Einstellungen:', e);
    }
  },

  setzeFiremenname: (name) => set({ firmenname: name }),

  setzeStandardEinheit: (einheit) => set({ standardEinheit: einheit }),

  speichereEinstellungen: async () => {
    try {
      const { firmenname, standardEinheit } = get();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ firmenname, standardEinheit }));
    } catch (e) {
      console.error('Fehler beim Speichern der Einstellungen:', e);
    }
  },
}));
