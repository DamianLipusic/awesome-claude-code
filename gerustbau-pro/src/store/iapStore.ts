/**
 * IAP Store — RevenueCat subscription state
 *
 * Freemium model:
 *   - FREE_PROJEKT_LIMIT  = 1 project, unlimited editing
 *   - Entitlement "premium" unlocks unlimited projects + all export features
 *
 * Products (configure in RevenueCat dashboard):
 *   - gerustbau_pro_monthly  → €9.99/Monat
 *   - gerustbau_pro_annual   → €79.99/Jahr (~€6.67/Monat, -33%)
 *
 * SETUP: Replace REVENUECAT_API_KEY_IOS / ANDROID with your real keys.
 */

import { create } from 'zustand';
import Purchases, {
  type PurchasesOfferings,
  type CustomerInfo,
  LOG_LEVEL,
} from 'react-native-purchases';
import { Platform } from 'react-native';

// ─── Configuration ────────────────────────────────────────────────────────────

export const REVENUECAT_API_KEY_IOS = 'appl_XXXXXXXXXXXXXXXXXXXXXXXXXXXX';
export const REVENUECAT_API_KEY_ANDROID = 'goog_XXXXXXXXXXXXXXXXXXXXXXXXXXXX';
export const PREMIUM_ENTITLEMENT = 'premium';
export const FREE_PROJEKT_LIMIT = 1;

// ─── Types ────────────────────────────────────────────────────────────────────

interface IapState {
  /** true while RevenueCat is initializing */
  laedt: boolean;
  /** true if the user has an active premium subscription */
  istPremium: boolean;
  /** Latest offerings fetched from RevenueCat (null = not loaded yet) */
  angebote: PurchasesOfferings | null;
  /** Last known CustomerInfo */
  kundenInfo: CustomerInfo | null;
  /** Non-fatal error message (e.g. network) */
  fehler: string | null;

  // Actions
  initialisieren: () => Promise<void>;
  kaufen: (paketId: string) => Promise<{ erfolg: boolean; fehler?: string }>;
  kaeufeWiederherstellen: () => Promise<{ erfolg: boolean; fehler?: string }>;
  angeboteLaden: () => Promise<void>;
  kundenInfoAktualisieren: () => Promise<void>;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useIapStore = create<IapState>((set, get) => ({
  laedt: false,
  istPremium: false,
  angebote: null,
  kundenInfo: null,
  fehler: null,

  async initialisieren() {
    set({ laedt: true, fehler: null });
    try {
      const apiKey =
        Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;

      if (__DEV__) {
        Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      }

      await Purchases.configure({ apiKey });

      const info = await Purchases.getCustomerInfo();
      const istPremium = !!info.entitlements.active[PREMIUM_ENTITLEMENT];

      set({ kundenInfo: info, istPremium, laedt: false });

      // Pre-load offerings in background
      get().angeboteLaden();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'RevenueCat-Initialisierung fehlgeschlagen';
      set({ laedt: false, fehler: msg });
    }
  },

  async angeboteLaden() {
    try {
      const angebote = await Purchases.getOfferings();
      set({ angebote });
    } catch {
      // Offerings are optional; app still works without them
    }
  },

  async kaufen(paketId: string) {
    try {
      const angebote = get().angebote;
      const paket = angebote?.current?.availablePackages.find(p => p.identifier === paketId);
      if (!paket) return { erfolg: false, fehler: 'Paket nicht gefunden.' };

      const { customerInfo } = await Purchases.purchasePackage(paket);
      const istPremium = !!customerInfo.entitlements.active[PREMIUM_ENTITLEMENT];
      set({ kundenInfo: customerInfo, istPremium });
      return { erfolg: istPremium };
    } catch (e: unknown) {
      // PurchasesError has a userCancelled flag
      const cancelled = (e as { userCancelled?: boolean }).userCancelled === true;
      if (cancelled) return { erfolg: false };
      const msg = e instanceof Error ? e.message : 'Kauf fehlgeschlagen.';
      return { erfolg: false, fehler: msg };
    }
  },

  async kaeufeWiederherstellen() {
    try {
      const info = await Purchases.restorePurchases();
      const istPremium = !!info.entitlements.active[PREMIUM_ENTITLEMENT];
      set({ kundenInfo: info, istPremium });
      return { erfolg: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Wiederherstellung fehlgeschlagen.';
      return { erfolg: false, fehler: msg };
    }
  },

  async kundenInfoAktualisieren() {
    try {
      const info = await Purchases.getCustomerInfo();
      const istPremium = !!info.entitlements.active[PREMIUM_ENTITLEMENT];
      set({ kundenInfo: info, istPremium });
    } catch {
      // Keep previous state
    }
  },
}));
