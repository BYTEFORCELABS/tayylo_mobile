# Tayylo Mobile

The native iOS and Android app for **Tayylo**, the modern tailor's notebook.
It reproduces the Tayylo web app screen for screen — same design language,
features and workflows — as a React Native (Expo) app that talks to the same
backend.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the code is organised
and how web components map to native ones.

## Requirements

- Node 20+ and npm
- Xcode (iOS) and/or Android Studio with an emulator
- A running Tayylo backend: the Next.js web app in `../tayylo` (`npm run dev` there)

## Getting started

```bash
npm install
cp .env.example .env      # optional — see "Backend URL"
npm run ios               # builds the dev client and opens the iOS simulator
npm run android           # same for Android
npm start                 # Metro only, once a dev client is installed
```

The app uses native modules (secure storage, camera, image processing, Lottie,
printing), so it runs in a **development build**, not Expo Go.

### Backend URL

`EXPO_PUBLIC_API_URL` points the app at the Tayylo backend. When it is unset in
development the app uses `http://<the machine running Metro>:3000`, so the
simulator, emulator or a phone on the same Wi-Fi reaches the web app's
`npm run dev` server without extra setup. Set it to your deployed web app's
origin for release builds.

### Sign in with Apple

iOS only, using the native sheet (`expo-apple-authentication`). `app.json`
enables the entitlement (`ios.usesAppleSignIn`), so after pulling run
`npx expo prebuild --clean --platform ios` before `npx expo run:ios`. The
backend must have the `APPLE_*` server variables set. Setup, Apple portal
steps and the test checklist are in the web repo:
`docs/SIGN_IN_WITH_APPLE.md`.

### Password-reset links

Reset emails link to the web's `/auth/reset?token=…`. The app also handles
`tayylo://auth/reset?token=…`, so the token can be opened in the app directly.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run ios` / `npm run android` | Build and run the dev client |
| `npm start` | Start Metro |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run generate-assets` | Rebuild `src/generated/measurement-svgs.ts` from the web app's measurement artwork |

Native folders (`ios/`, `android/`) are generated from `app.json` by
`expo prebuild` and are not committed.
