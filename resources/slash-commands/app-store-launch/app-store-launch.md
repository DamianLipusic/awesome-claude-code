# /app-store-launch

Mobile-first Claude Code skill: Take an existing app and ship it to the App Store (iOS + Android) with monetization — fully automated, triggerable from your phone.

## Usage

```
/app-store-launch
```

Optionally with target platform and monetization model:

```
/app-store-launch --platform ios --monetize subscriptions
/app-store-launch --platform both --monetize iap
/app-store-launch --platform android --monetize free
```

---

## What This Command Does

1. **Detects your app** – Reads your current project (Expo, React Native, or Flutter) and extracts package name, version, and entry points.
2. **Audits App Store readiness** – Checks icons, splash screens, permissions, privacy manifest (iOS 17+), and required metadata.
3. **Sets up EAS (Expo) or Fastlane (RN/Flutter)** – Configures build profiles for `preview`, `staging`, and `production`.
4. **Adds monetization** – Installs and wires up RevenueCat for in-app purchases / subscriptions, or Google Admob for ad-based monetization.
5. **Generates App Store metadata** – Creates `store-metadata/` folder with App Store description, keywords, screenshots spec, and privacy policy stub.
6. **Creates GitHub Actions CI/CD** – Automated pipeline: test → build → submit, triggered on `git push` to `release/*` branch — works from your phone.
7. **Commits & pushes everything** – One commit, one push, then the pipeline does the rest while you're at work.

---

## Step-by-Step Behavior

### 1. Project Detection

Read `package.json` / `pubspec.yaml` and detect:
- Framework: Expo / bare React Native / Flutter
- App name, bundle ID, version
- Existing EAS / Fastlane config (if any)

```bash
cat package.json | grep -E '"name"|"version"|"expo"'
ls eas.json 2>/dev/null && echo "EAS already configured"
```

### 2. App Store Readiness Checklist

Run through each item and auto-fix where possible:

| Item | Auto-Fix |
|---|---|
| App icon 1024x1024 | Generate with ImageMagick from existing icon |
| Splash screen | Configure via `expo-splash-screen` |
| iOS Privacy Manifest (`PrivacyInfo.xcprivacy`) | Generate stub |
| Android permissions in manifest | Audit and prune unused |
| Version bump | Increment patch version |
| Bundle ID matches App Store Connect | Warn if mismatch |

### 3. EAS Configuration (Expo projects)

Create or update `eas.json`:

```json
{
  "cli": { "version": ">= 7.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": false },
      "android": { "buildType": "apk" }
    },
    "production": {
      "ios": { "autoIncrement": true },
      "android": { "autoIncrement": true }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "$APPLE_ID",
        "ascAppId": "$ASC_APP_ID",
        "appleTeamId": "$APPLE_TEAM_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./google-services-key.json",
        "track": "production"
      }
    }
  }
}
```

### 4. Monetization Setup

#### Option A: Subscriptions / IAP (RevenueCat)

Install dependencies:

```bash
npx expo install react-native-purchases
```

Create `src/monetization/revenue-cat.ts`:

```typescript
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';

const REVENUECAT_API_KEYS = {
  ios: process.env.EXPO_PUBLIC_RC_IOS_KEY!,
  android: process.env.EXPO_PUBLIC_RC_ANDROID_KEY!,
};

export async function initMonetization() {
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  await Purchases.configure({
    apiKey: Platform.OS === 'ios'
      ? REVENUECAT_API_KEYS.ios
      : REVENUECAT_API_KEYS.android,
  });
}

export async function getOfferings() {
  const { current } = await Purchases.getOfferings();
  return current;
}

export async function purchasePackage(pkg: Purchases.PurchasesPackage) {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

export async function restorePurchases() {
  return Purchases.restorePurchases();
}

export async function isSubscribed(): Promise<boolean> {
  const info = await Purchases.getCustomerInfo();
  return Object.keys(info.entitlements.active).length > 0;
}
```

Add to `app/_layout.tsx` (or root component):

```typescript
import { initMonetization } from '@/src/monetization/revenue-cat';
import { useEffect } from 'react';

export default function RootLayout() {
  useEffect(() => { initMonetization(); }, []);
  // ...
}
```

Add required env vars to `.env.local` (gitignored) and to GitHub Secrets:
- `EXPO_PUBLIC_RC_IOS_KEY` — RevenueCat iOS API key
- `EXPO_PUBLIC_RC_ANDROID_KEY` — RevenueCat Android API key

#### Option B: Ad-based (Google AdMob)

```bash
npx expo install react-native-google-mobile-ads
```

Create `src/monetization/admob.ts`:

```typescript
import mobileAds, { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

const AD_UNIT_ID = __DEV__
  ? TestIds.BANNER
  : process.env.EXPO_PUBLIC_ADMOB_BANNER_ID!;

export { BannerAd, BannerAdSize, AD_UNIT_ID };
export const initAds = () => mobileAds().initialize();
```

### 5. App Store Metadata

Generate `store-metadata/` folder:

```
store-metadata/
  ios/
    en-US/
      name.txt           # App name (max 30 chars)
      subtitle.txt       # Subtitle (max 30 chars)
      description.txt    # Full description (max 4000 chars)
      keywords.txt       # Comma-separated keywords (max 100 chars)
      promotional_text.txt
      release_notes.txt
  android/
    en-US/
      title.txt
      short_description.txt
      full_description.txt
      changelogs/
        default.txt
  screenshots-spec.md    # What screenshots to capture
  privacy-policy.md      # Privacy policy stub
```

Claude will generate all copy based on your app's README and code.

### 6. GitHub Actions CI/CD Pipeline

Create `.github/workflows/app-store-release.yml`:

```yaml
name: App Store Release

on:
  push:
    branches: ['release/*']
  workflow_dispatch:
    inputs:
      platform:
        description: 'Platform'
        required: true
        default: 'both'
        type: choice
        options: [ios, android, both]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm test -- --passWithNoTests

  build-and-submit-ios:
    needs: test
    if: ${{ github.event.inputs.platform != 'android' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - uses: expo/expo-github-action@v8
        with:
          expo-version: latest
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: npm ci
      - run: eas build --platform ios --profile production --non-interactive
        env:
          EXPO_PUBLIC_RC_IOS_KEY: ${{ secrets.RC_IOS_KEY }}
      - run: eas submit --platform ios --latest --non-interactive
        env:
          APPLE_ID: ${{ secrets.APPLE_ID }}
          ASC_APP_ID: ${{ secrets.ASC_APP_ID }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}

  build-and-submit-android:
    needs: test
    if: ${{ github.event.inputs.platform != 'ios' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - uses: expo/expo-github-action@v8
        with:
          expo-version: latest
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: npm ci
      - run: eas build --platform android --profile production --non-interactive
        env:
          EXPO_PUBLIC_RC_ANDROID_KEY: ${{ secrets.RC_ANDROID_KEY }}
      - run: eas submit --platform android --latest --non-interactive
        env:
          EXPO_PUBLIC_RC_ANDROID_KEY: ${{ secrets.RC_ANDROID_KEY }}
```

### 7. Required GitHub Secrets

Tell the user to add these secrets to their GitHub repo (`Settings → Secrets → Actions`):

| Secret | Where to get it |
|---|---|
| `EXPO_TOKEN` | [expo.dev/accounts/[you]/settings/access-tokens](https://expo.dev) |
| `APPLE_ID` | Your Apple Developer email |
| `ASC_APP_ID` | App Store Connect → App → App Information → Apple ID |
| `APPLE_TEAM_ID` | [developer.apple.com/account](https://developer.apple.com/account) → Membership |
| `APPLE_APP_SPECIFIC_PASSWORD` | [appleid.apple.com](https://appleid.apple.com) → App-Specific Passwords |
| `RC_IOS_KEY` | RevenueCat Dashboard → iOS app → API Keys |
| `RC_ANDROID_KEY` | RevenueCat Dashboard → Android app → API Keys |

### 8. Ship It

```bash
git checkout -b release/$(date +%Y.%-m.%-d)
git add -A
git commit -m "release: v$(cat package.json | jq -r .version) to App Store"
git push origin HEAD
```

The GitHub Actions pipeline triggers automatically. Monitor from your phone at:
`https://github.com/<your-repo>/actions`

---

## Mobile Workflow (from your phone)

1. Open Claude.ai or Claude Code on your phone
2. Navigate to your app repo
3. Type `/app-store-launch`
4. Claude sets everything up and creates the release branch
5. GitHub Actions builds + submits automatically in the background
6. Check App Store Connect from your phone for review status

---

## Options

| Flag | Values | Default | Description |
|---|---|---|---|
| `--platform` | `ios`, `android`, `both` | `both` | Which store(s) to target |
| `--monetize` | `subscriptions`, `iap`, `ads`, `free` | `subscriptions` | Monetization model |
| `--bump` | `patch`, `minor`, `major` | `patch` | Version increment |
| `--skip-metadata` | — | false | Skip generating store metadata |
| `--dry-run` | — | false | Set up everything but don't push |

---

## Prerequisites

- Expo SDK 50+ project (or bare React Native with EAS CLI)
- GitHub repository with Actions enabled
- Apple Developer account ($99/year)
- Google Play Console account ($25 one-time)
- RevenueCat account (free tier covers early-stage apps)
- EAS account (free tier: 30 iOS + 30 Android builds/month)

---

## Notes

- This command is **idempotent** — safe to run multiple times. It detects existing config and only adds what's missing.
- All secrets stay in GitHub — never committed to the repo.
- The `workflow_dispatch` trigger means you can also manually kick off a release from the GitHub Actions UI on your phone.
- RevenueCat's dashboard works great on mobile for tracking revenue in real time.
