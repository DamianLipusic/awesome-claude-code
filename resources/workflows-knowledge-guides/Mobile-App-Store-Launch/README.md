# Mobile App Store Launch Workflow

Ship your Claude Code-built apps to the App Store and Google Play — with monetization — straight from your phone. No Mac required during working hours.

## Concept

This workflow turns a finished (or nearly finished) app into a production-ready App Store release in one command. The heavy lifting (building, code-signing, submitting) happens in GitHub Actions, so you only need a phone and internet access to trigger a release.

**Core Methodology:**
- **Single command** – `/app-store-launch` detects your project, audits it for store readiness, and sets up everything automatically.
- **Monetization first** – RevenueCat (subscriptions/IAP) or AdMob (ads) is wired up before the first build.
- **CI/CD in the cloud** – EAS Build + EAS Submit handle iOS code-signing and Play Store uploads. No local Xcode or Android Studio needed.
- **Mobile-triggerable releases** – Push a `release/*` branch from your phone → GitHub Actions does the rest.

## Resources

### Templates & Files
- [App Store Launch Slash Command](../../slash-commands/app-store-launch/app-store-launch.md) – Drop this into `.claude/commands/app-store-launch.md` in any Expo project.
- [GitHub Actions Release Pipeline](./github-actions-release.yml) – Copy to `.github/workflows/app-store-release.yml`.
- [RevenueCat Setup Snippet](./revenuecat-setup.md) – Copy-paste monetization bootstrap code.
- [Store Metadata Template](./store-metadata-template.md) – App Store and Google Play copy templates.

## Quick Setup (5 minutes)

### 1. Add the slash command to your app repo

```bash
mkdir -p .claude/commands
curl -o .claude/commands/app-store-launch.md \
  https://raw.githubusercontent.com/damianlipusic/awesome-claude-code/main/resources/slash-commands/app-store-launch/app-store-launch.md
```

### 2. Add GitHub Secrets

Go to your repo → **Settings → Secrets and variables → Actions** and add:

| Secret | Description |
|---|---|
| `EXPO_TOKEN` | From [expo.dev](https://expo.dev) → Account Settings → Access Tokens |
| `APPLE_ID` | Your Apple Developer email |
| `ASC_APP_ID` | App Store Connect → App Information → Apple ID number |
| `APPLE_TEAM_ID` | [developer.apple.com](https://developer.apple.com) → Membership |
| `APPLE_APP_SPECIFIC_PASSWORD` | [appleid.apple.com](https://appleid.apple.com) → App-Specific Passwords |
| `RC_IOS_KEY` | RevenueCat → Project → iOS App → Public API Key |
| `RC_ANDROID_KEY` | RevenueCat → Project → Android App → Public API Key |

### 3. Run the command

Open Claude Code (mobile or desktop), navigate to your app, and type:

```
/app-store-launch
```

### 4. Push to release branch (from your phone)

Claude will stage and commit everything, then:

```bash
git push origin release/2025.1.0
```

GitHub Actions picks it up, builds both platforms, and submits to both stores.

## Mobile Workflow In Practice

```
[Phone] → Claude Code / Claude.ai
  → /app-store-launch --platform both --monetize subscriptions
  → Claude audits, configures, commits
  → git push origin release/2025.1.0
  → [GitHub Actions] build iOS → sign → submit to App Store Connect
  → [GitHub Actions] build Android → sign → submit to Play Store
  → [Phone] github.com/<repo>/actions  ← monitor progress
  → [Phone] App Store Connect app     ← submit for review
  → [Phone] RevenueCat dashboard      ← watch revenue
```

## Monetization Models

| Model | Best For | Setup |
|---|---|---|
| `--monetize subscriptions` | SaaS, productivity, content apps | RevenueCat + weekly/monthly/annual offerings |
| `--monetize iap` | Games, one-time unlocks | RevenueCat + consumable/non-consumable products |
| `--monetize ads` | Utility, free tools | Google AdMob banner + interstitial |
| `--monetize free` | Open source, lead gen | No monetization setup |

## Prerequisites

- Expo SDK 50+ project (managed or bare workflow)
- GitHub repository with Actions enabled
- Apple Developer Program membership ($99/year)
- Google Play Console account ($25 one-time fee)
- [EAS account](https://expo.dev) (free tier: 30 builds/month per platform)
- [RevenueCat account](https://revenuecat.com) (free up to $2.5k MRR)

## Why This Approach

| Problem | Solution |
|---|---|
| Need a Mac to build iOS | EAS Build runs on Expo's Mac fleet |
| Code signing is painful | EAS manages certificates automatically |
| Manual App Store uploads | EAS Submit + Transporter handles it |
| Monetization takes days to wire up | `/app-store-launch` does it in minutes |
| Can't release from phone | GitHub Actions + workflow_dispatch |
