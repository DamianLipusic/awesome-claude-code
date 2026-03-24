export interface StockDefinition {
  id: string;
  name: string;
  ticker: string;
  emoji: string;
  sector: string;
  basePrice: number;
  volatility: number; // 0-1, how wild the swings are
  trend: number;      // -0.01 to 0.01, slight long-term bias
  description: string;
}

export const STOCKS: StockDefinition[] = [
  {
    id: 'techx',
    name: 'TechX Corp',
    ticker: 'TCHX',
    emoji: '💻',
    sector: 'Technology',
    basePrice: 150,
    volatility: 0.08,
    trend: 0.002,
    description: 'AI & cloud computing giant.',
  },
  {
    id: 'oilmax',
    name: 'OilMax Energy',
    ticker: 'OILM',
    emoji: '🛢️',
    sector: 'Energy',
    basePrice: 85,
    volatility: 0.05,
    trend: 0.001,
    description: 'Global oil & gas empire.',
  },
  {
    id: 'cryptobank',
    name: 'CryptoBank',
    ticker: 'CBNK',
    emoji: '₿',
    sector: 'Finance',
    basePrice: 320,
    volatility: 0.15,
    trend: 0.003,
    description: 'The most volatile bank on earth.',
  },
  {
    id: 'luxbrand',
    name: 'LuxBrand',
    ticker: 'LUXB',
    emoji: '👜',
    sector: 'Luxury',
    basePrice: 240,
    volatility: 0.04,
    trend: 0.002,
    description: 'Handbags that cost more than cars.',
  },
  {
    id: 'spacerace',
    name: 'SpaceRace Inc',
    ticker: 'SPRC',
    emoji: '🚀',
    sector: 'Aerospace',
    basePrice: 450,
    volatility: 0.12,
    trend: 0.004,
    description: 'The next frontier. Literally.',
  },
  {
    id: 'casinoking',
    name: 'CasinoKing',
    ticker: 'CSKN',
    emoji: '🎰',
    sector: 'Gaming',
    basePrice: 120,
    volatility: 0.07,
    trend: 0.001,
    description: 'The house always wins.',
  },
  {
    id: 'pharmarich',
    name: 'PharmaRich',
    ticker: 'PHRX',
    emoji: '💊',
    sector: 'Pharma',
    basePrice: 190,
    volatility: 0.06,
    trend: 0.002,
    description: 'They own the patents.',
  },
  {
    id: 'memecoin',
    name: 'DogeCoin 2.0',
    ticker: 'DGE2',
    emoji: '🐕',
    sector: 'Crypto',
    basePrice: 0.05,
    volatility: 0.35,
    trend: -0.001,
    description: 'Such wow. Very volatile.',
  },
];

export interface StockEvent {
  stockId: string;
  title: string;
  description: string;
  priceMultiplier: number; // e.g. 1.5 = +50%, 0.7 = -30%
  duration: number; // seconds the effect lasts
}

export const STOCK_EVENTS: StockEvent[] = [
  { stockId: 'techx', title: '🚀 Tech Earnings Beat!', description: 'TechX crushed earnings. Analysts shocked.', priceMultiplier: 1.4, duration: 120 },
  { stockId: 'techx', title: '📉 AI Bubble Fears', description: 'Investors panic about AI valuations.', priceMultiplier: 0.7, duration: 90 },
  { stockId: 'oilmax', title: '🛢️ OPEC Cuts Supply', description: 'Oil prices surge on supply cut announcement.', priceMultiplier: 1.3, duration: 150 },
  { stockId: 'cryptobank', title: '💥 Crypto Winter', description: 'Regulation hammer hits crypto sector.', priceMultiplier: 0.5, duration: 60 },
  { stockId: 'cryptobank', title: '🌕 To The Moon', description: 'Institutional buyers flood in. Massive rally.', priceMultiplier: 2.0, duration: 90 },
  { stockId: 'spacerace', title: '🚀 Mars Mission Announced', description: 'SpaceRace reveals Mars colonization plan.', priceMultiplier: 1.6, duration: 120 },
  { stockId: 'memecoin', title: '🐕 Elon Tweets Again', description: "One tweet changed everything.", priceMultiplier: 3.0, duration: 60 },
  { stockId: 'pharmarich', title: '💊 Patent Expired', description: 'Key patent runs out. Generic drugs flood market.', priceMultiplier: 0.6, duration: 180 },
];
