import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'gerustbau_einstellungen';

interface EinstellungenState {
  firmenname: string;
  firmenadresse: string;
  firmentelefon: string;
  firmenemail: string;
  standardEinheit: 'm' | 'cm';
  standardLastklasse: '2' | '3' | '4' | '5' | '6';
  sicherheitszuschlag: number; // percent, e.g. 5

  ladeEinstellungen: () => Promise<void>;
  setzeFiremenname: (name: string) => void;
  setzeFirmenadresse: (adr: string) => void;
  setzeFirmentelefon: (tel: string) => void;
  setzeFirmenemail: (email: string) => void;
  setzeStandardEinheit: (einheit: 'm' | 'cm') => void;
  setzeStandardLastklasse: (lk: '2' | '3' | '4' | '5' | '6') => void;
  setzeSicherheitszuschlag: (pct: number) => void;
  speichereEinstellungen: () => Promise<void>;
}

export const useEinstellungenStore = create<EinstellungenState>((set, get) => ({
  firmenname: '',
  firmenadresse: '',
  firmentelefon: '',
  firmenemail: '',
  standardEinheit: 'm',
  standardLastklasse: '3',
  sicherheitszuschlag: 5,

  ladeEinstellungen: async () => {
    try {
      const gespeichert = await AsyncStorage.getItem(STORAGE_KEY);
      if (gespeichert) {
        const daten = JSON.parse(gespeichert);
        set({
          firmenname: daten.firmenname ?? '',
          firmenadresse: daten.firmenadresse ?? '',
          firmentelefon: daten.firmentelefon ?? '',
          firmenemail: daten.firmenemail ?? '',
          standardEinheit: daten.standardEinheit ?? 'm',
          standardLastklasse: daten.standardLastklasse ?? '3',
          sicherheitszuschlag: daten.sicherheitszuschlag ?? 5,
        });
      }
    } catch (e) {
      console.error('Fehler beim Laden der Einstellungen:', e);
    }
  },

  setzeFiremenname: (name) => set({ firmenname: name }),
  setzeFirmenadresse: (adr) => set({ firmenadresse: adr }),
  setzeFirmentelefon: (tel) => set({ firmentelefon: tel }),
  setzeFirmenemail: (email) => set({ firmenemail: email }),
  setzeStandardEinheit: (einheit) => set({ standardEinheit: einheit }),
  setzeStandardLastklasse: (lk) => set({ standardLastklasse: lk }),
  setzeSicherheitszuschlag: (pct) => set({ sicherheitszuschlag: pct }),

  speichereEinstellungen: async () => {
    try {
      const { firmenname, firmenadresse, firmentelefon, firmenemail, standardEinheit, standardLastklasse, sicherheitszuschlag } = get();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
        firmenname, firmenadresse, firmentelefon, firmenemail, standardEinheit, standardLastklasse, sicherheitszuschlag,
      }));
    } catch (e) {
      console.error('Fehler beim Speichern der Einstellungen:', e);
    }
  },
}));
