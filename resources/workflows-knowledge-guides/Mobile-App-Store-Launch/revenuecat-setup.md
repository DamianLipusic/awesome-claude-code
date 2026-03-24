# RevenueCat Monetization Setup

Drop-in monetization for Expo apps. Supports subscriptions, one-time purchases, and free trials.

## Install

```bash
npx expo install react-native-purchases
```

Add to `app.json` plugins:

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-purchases",
        {
          "androidPurchasesEnabled": true
        }
      ]
    ]
  }
}
```

## Core Module

Create `src/monetization/index.ts`:

```typescript
import Purchases, {
  LOG_LEVEL,
  type PurchasesOffering,
  type PurchasesPackage,
  type CustomerInfo,
} from 'react-native-purchases';
import { Platform } from 'react-native';

// Set these in .env and GitHub Secrets
const API_KEYS = {
  ios: process.env.EXPO_PUBLIC_RC_IOS_KEY ?? '',
  android: process.env.EXPO_PUBLIC_RC_ANDROID_KEY ?? '',
};

export async function initMonetization(): Promise<void> {
  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }
  await Purchases.configure({
    apiKey: Platform.OS === 'ios' ? API_KEYS.ios : API_KEYS.android,
  });
}

/** Get current offerings from RevenueCat dashboard */
export async function getOfferings(): Promise<PurchasesOffering | null> {
  const offerings = await Purchases.getOfferings();
  return offerings.current;
}

/** Purchase a package. Throws on cancellation / error. */
export async function purchasePackage(
  pkg: PurchasesPackage
): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

/** Restore previous purchases (required by App Store guidelines) */
export async function restorePurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}

/** Check if user has an active entitlement */
export async function isSubscribed(
  entitlementId = 'pro'
): Promise<boolean> {
  const info = await Purchases.getCustomerInfo();
  return entitlementId in info.entitlements.active;
}

/** Get customer info for analytics / UI */
export async function getCustomerInfo(): Promise<CustomerInfo> {
  return Purchases.getCustomerInfo();
}
```

## Paywall Component

Create `src/monetization/Paywall.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import type { PurchasesPackage, PurchasesOffering } from 'react-native-purchases';
import { getOfferings, purchasePackage, restorePurchases } from './index';

interface PaywallProps {
  onSuccess: () => void;
  onDismiss: () => void;
}

export function Paywall({ onSuccess, onDismiss }: PaywallProps) {
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    getOfferings().then(setOffering).finally(() => setLoading(false));
  }, []);

  async function handlePurchase(pkg: PurchasesPackage) {
    setPurchasing(true);
    try {
      await purchasePackage(pkg);
      onSuccess();
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert('Purchase failed', e.message);
      }
    } finally {
      setPurchasing(false);
    }
  }

  async function handleRestore() {
    setPurchasing(true);
    try {
      await restorePurchases();
      onSuccess();
    } catch (e: any) {
      Alert.alert('Restore failed', e.message);
    } finally {
      setPurchasing(false);
    }
  }

  if (loading) return <ActivityIndicator style={styles.center} />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upgrade to Pro</Text>

      {offering?.availablePackages.map((pkg) => (
        <TouchableOpacity
          key={pkg.identifier}
          style={styles.packageButton}
          onPress={() => handlePurchase(pkg)}
          disabled={purchasing}
        >
          <Text style={styles.packageTitle}>{pkg.product.title}</Text>
          <Text style={styles.packagePrice}>{pkg.product.priceString}</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity onPress={handleRestore} disabled={purchasing}>
        <Text style={styles.restore}>Restore Purchases</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onDismiss}>
        <Text style={styles.dismiss}>Not now</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, padding: 24, gap: 16 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  packageButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  packageTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  packagePrice: { color: '#fff', fontSize: 14, opacity: 0.85 },
  restore: { textAlign: 'center', color: '#666', fontSize: 14 },
  dismiss: { textAlign: 'center', color: '#999', fontSize: 14 },
});
```

## Root Layout Integration

In `app/_layout.tsx`:

```typescript
import { initMonetization } from '@/src/monetization';
import { useEffect } from 'react';

export default function RootLayout() {
  useEffect(() => {
    initMonetization().catch(console.error);
  }, []);

  return (/* your layout */);
}
```

## RevenueCat Dashboard Setup

1. Create a project at [app.revenuecat.com](https://app.revenuecat.com)
2. Add iOS app → copy **Public API Key** → GitHub Secret `RC_IOS_KEY`
3. Add Android app → copy **Public API Key** → GitHub Secret `RC_ANDROID_KEY`
4. Create products in App Store Connect and Google Play Console first
5. Add products as **Entitlements** → **Offerings** → **Packages** in RevenueCat
6. Name your main entitlement `pro` (or change `entitlementId` in `isSubscribed()`)

## Environment Variables

`.env.local` (gitignored):
```
EXPO_PUBLIC_RC_IOS_KEY=appl_xxxxxxxxxxxx
EXPO_PUBLIC_RC_ANDROID_KEY=goog_xxxxxxxxxxxx
```

These same values go into GitHub Secrets as `RC_IOS_KEY` and `RC_ANDROID_KEY`.
