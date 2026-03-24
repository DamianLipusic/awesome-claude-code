# App Store Metadata Template

Copy this structure into `store-metadata/` in your app repo. Fill in the blanks — or let Claude generate the copy for you by running `/app-store-launch`.

## File Structure

```
store-metadata/
├── ios/
│   └── en-US/
│       ├── name.txt
│       ├── subtitle.txt
│       ├── description.txt
│       ├── keywords.txt
│       ├── promotional_text.txt
│       └── release_notes.txt
├── android/
│   └── en-US/
│       ├── title.txt
│       ├── short_description.txt
│       ├── full_description.txt
│       └── changelogs/
│           └── default.txt
├── screenshots-spec.md
└── privacy-policy.md
```

---

## iOS Templates

### `ios/en-US/name.txt`
```
[App Name]
```
Max 30 characters. This is the name users see on the App Store and their home screen.

### `ios/en-US/subtitle.txt`
```
[One-line value prop]
```
Max 30 characters. Shown below the app name. Make it descriptive and keyword-rich.

### `ios/en-US/description.txt`
```
[First paragraph — hook. What problem does this solve? What makes it unique?]

KEY FEATURES
• [Feature 1] — [brief benefit]
• [Feature 2] — [brief benefit]
• [Feature 3] — [brief benefit]
• [Feature 4] — [brief benefit]
• [Feature 5] — [brief benefit]

[Second paragraph — expand on the main use case. Be specific.]

[Third paragraph — social proof, awards, or press mentions if any.]

[Final paragraph — call to action. Download today.]
```
Max 4000 characters. Only the first 3 lines show before "more" — make them count.

### `ios/en-US/keywords.txt`
```
keyword1,keyword2,keyword3,keyword4,keyword5,keyword6,keyword7
```
Max 100 characters total. Comma-separated. Don't repeat words from your title/subtitle — the App Store already indexes those.

### `ios/en-US/promotional_text.txt`
```
[Updatable promotional line — use for announcements, sales, new features]
```
Max 170 characters. Unlike the description, this can be updated without a new app version.

### `ios/en-US/release_notes.txt`
```
What's new in [version]:
• [Change 1]
• [Change 2]
• [Bug fix / improvement]

Thanks for using [App Name]! Leave a review if you're enjoying it.
```

---

## Android Templates

### `android/en-US/title.txt`
```
[App Name]
```
Max 50 characters.

### `android/en-US/short_description.txt`
```
[One sentence. What does the app do and who is it for?]
```
Max 80 characters. Shown in search results.

### `android/en-US/full_description.txt`
```
[Hook paragraph — make it compelling.]

FEATURES
★ [Feature 1]
★ [Feature 2]
★ [Feature 3]
★ [Feature 4]
★ [Feature 5]

[Expanded description. Explain the main use cases.]

[Permissions explanation if needed — Play Store reviewers appreciate this.]

[Contact / support info]
```
Max 4000 characters.

### `android/en-US/changelogs/default.txt`
```
[version] — [date]
• [What changed]
• [What was fixed]
```
Max 500 characters.

---

## Screenshots Spec

### `store-metadata/screenshots-spec.md`

```markdown
# Screenshot Requirements

## iOS
- 6.9" (iPhone 16 Pro Max): 1320 × 2868 px — REQUIRED
- 6.5" (iPhone 11 Pro Max): 1284 × 2778 px — optional but recommended
- 12.9" iPad Pro: 2048 × 2732 px — required if supporting iPad

## Android
- Phone: 1080 × 1920 px minimum
- 7" tablet: 1200 × 1920 px (optional)
- 10" tablet: 1600 × 2560 px (optional)

## Screenshot Scenes (create these 5)

1. **Hero** — Main screen with value prop overlay text
2. **Feature 1** — [Describe your killer feature]
3. **Feature 2** — [Second best feature]
4. **Feature 3** — [Third feature]
5. **Social proof / CTA** — Reviews, stats, or final call to action

## Tools
- [Rotato](https://rotato.app) — 3D device mockups
- [Previewed](https://previewed.app) — Screenshot templates
- [AppLaunchpad](https://theapplaunchpad.com) — Bulk generation
- Figma + community screenshot templates
```

---

## Privacy Policy Stub

### `store-metadata/privacy-policy.md`

```markdown
# Privacy Policy

Last updated: [DATE]

## Overview

[App Name] ("we", "us", "our") respects your privacy. This policy explains what data we collect and how we use it.

## Data We Collect

### Data you provide
- [e.g., Account information if you sign up]
- [e.g., Content you create within the app]

### Data collected automatically
- [e.g., App crash reports via Expo / Sentry]
- [e.g., Purchase history via RevenueCat (no payment details — processed by Apple/Google)]
- [e.g., Anonymous usage analytics]

## Data We Do NOT Collect
- We do not sell your data.
- We do not collect payment information (handled by Apple App Store / Google Play).

## Third-Party Services

| Service | Purpose | Privacy Policy |
|---|---|---|
| RevenueCat | In-app purchases | [revenuecat.com/privacy](https://revenuecat.com/privacy) |
| Expo | App infrastructure | [expo.dev/privacy](https://expo.dev/privacy) |
| [Add others] | | |

## Contact

Questions? [your-email@example.com]
```

> Deploy your privacy policy as a GitHub Pages page or a simple hosted URL. App Store Connect requires a public URL.
