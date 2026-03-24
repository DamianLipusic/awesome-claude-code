# 💸 Cash Empire — Mobile Tycoon Game

An addictive idle tycoon game for iOS built with React Native + Expo.

## Features

- **Tap to earn** — Manual tapping with haptic feedback and floating labels
- **8 businesses** — Food Cart → Crypto Exchange, buy and upgrade for passive income
- **Auto-management** — Enable auto mode per business for true idle income
- **Flex shop** — 16 luxury items (vehicles, properties, status symbols) each granting income bonuses
- **Prestige system** — Reset for permanent multipliers, prestige coins, and upgrades
- **Offline income** — Earn while away (capped at 12 hours)
- **Save/load** — Progress saved automatically every 10 seconds
- **Dark theme** — Sleek black & gold design

## Getting Started

```bash
cd game
npm install
npx expo start
```

Scan the QR code with **Expo Go** on your iPhone.

## Tech Stack

- **React Native + Expo** (SDK 52)
- **expo-router** for tab navigation
- **Zustand** for game state management
- **react-native-reanimated** for smooth animations
- **expo-haptics** for tactile feedback
- **AsyncStorage** for persistent save data

## Game Structure

```
app/
├── _layout.tsx          # Tab navigation root
├── index.tsx            # Home (tap screen)
├── businesses.tsx       # Business management
├── shop.tsx             # Luxury item shop
└── prestige.tsx         # Prestige & reset

src/
├── store/
│   ├── gameStore.ts     # Zustand game state + actions
│   └── types.ts         # TypeScript interfaces
├── data/
│   ├── businesses.ts    # 8 business definitions
│   ├── shopItems.ts     # 16 luxury items
│   └── prestige.ts      # Prestige tiers & upgrades
├── screens/             # Full screen components
├── components/          # Reusable UI components
└── utils/
    ├── formatMoney.ts   # $1.2M, $4.5B formatting
    ├── gameLogic.ts     # Income calculations
    └── offlineIncome.ts # Idle earnings math
```

## Monetization (Planned IAP)

| Product | Price | Description |
|---|---|---|
| Cash Boost | $0.99 | 5× income for 30 minutes |
| Premium Pass | $2.99/mo | 2× offline income + 1.5× passive income |
| Remove Ads | $1.99 | One-time ad removal |

## Building for App Store

```bash
npm install -g eas-cli
eas login
eas build --platform ios
```
