import { create } from 'zustand';
import type { MarketListing, ResourceCategory } from '@economy-game/shared';

export interface PricePoint {
  timestamp: string;
  price: number;
}

interface MarketState {
  listings: MarketListing[];
  selectedCity: string;
  selectedCategory: ResourceCategory | 'ALL';
  priceHistory: Record<string, PricePoint[]>;
  isLoadingListings: boolean;
}

interface MarketActions {
  setCity: (city: string) => void;
  setCategory: (category: ResourceCategory | 'ALL') => void;
  setListings: (listings: MarketListing[]) => void;
  updatePrices: (data: { listings?: MarketListing[]; resource_id?: string; price?: number; timestamp?: string }) => void;
  addPricePoint: (resourceId: string, point: PricePoint) => void;
  setLoadingListings: (loading: boolean) => void;
}

type MarketStore = MarketState & MarketActions;

export const useMarketStore = create<MarketStore>((set, get) => ({
  listings: [],
  selectedCity: 'Ironport',
  selectedCategory: 'ALL',
  priceHistory: {},
  isLoadingListings: false,

  setCity: (city: string) => {
    set({ selectedCity: city, listings: [] });
  },

  setCategory: (category: ResourceCategory | 'ALL') => {
    set({ selectedCategory: category });
  },

  setListings: (listings: MarketListing[]) => {
    set({ listings });
  },

  updatePrices: (data) => {
    if (data.listings) {
      // Full listings update from WebSocket
      set({ listings: data.listings });
    } else if (data.resource_id && data.price != null && data.timestamp) {
      // Individual price update
      const { listings, priceHistory } = get();
      const updatedListings = listings.map((listing) =>
        listing.resource_id === data.resource_id
          ? { ...listing, price_per_unit: data.price! }
          : listing
      );

      const history = priceHistory[data.resource_id] ?? [];
      const newHistory = [
        ...history.slice(-99), // keep last 100 points
        { timestamp: data.timestamp!, price: data.price! },
      ];

      set({
        listings: updatedListings,
        priceHistory: {
          ...priceHistory,
          [data.resource_id!]: newHistory,
        },
      });
    }
  },

  addPricePoint: (resourceId: string, point: PricePoint) => {
    const { priceHistory } = get();
    const history = priceHistory[resourceId] ?? [];
    set({
      priceHistory: {
        ...priceHistory,
        [resourceId]: [...history.slice(-99), point],
      },
    });
  },

  setLoadingListings: (loading: boolean) => {
    set({ isLoadingListings: loading });
  },
}));
