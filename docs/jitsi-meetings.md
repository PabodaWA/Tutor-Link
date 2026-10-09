# Jitsi meetings

Tutor Link keeps its existing Expo Go workflow for everyday UI work and uses an Expo development build for Jitsi. Expo Go does not contain Jitsi's native camera, audio, and WebRTC modules, so the meeting route shows a safe fallback there instead of loading the SDK.

## How meeting rooms work

- The backend creates a cryptographically random `roomCode` for each booking and stores it in the booking's one-to-one `Session` document.
- The room is never hardcoded in the mobile app and is not returned by the session details endpoint.
- `POST /api/sessions/:bookingId/join` checks that the caller belongs to the booking, that the online lesson is paid, and that it is inside the join window before returning the room.
- `JITSI_SERVER_URL` selects the Jitsi deployment. It defaults to `https://meet.jit.si`; use your own deployment URL in production.
- The existing app JWT returned as `roomToken` is retained for API compatibility, but it is not passed to Jitsi. A secured Jitsi deployment should issue a Jitsi-compatible JWT from the backend.

## Run the backend

```powershell
Copy-Item Backend/.env.example Backend/.env
# Set MONGODB_URI, JWT_SECRET, and optionally JITSI_SERVER_URL in Backend/.env
cd Backend
npm install
npm run dev
```

## Run with Expo Go

Use this for all ordinary screens and flows. The Join Meeting route explains that a development build is required, while the rest of the app remains usable.

```powershell
cd mobile
Copy-Item .env.example .env
# Set EXPO_PUBLIC_API_URL in .env
npm install
npm run start:go
```

Scan the QR code with Expo Go. Installing Jitsi dependencies does not replace the Expo Go workflow.

## Run a local Jitsi development build

Android requires Android Studio/the Android SDK. Local iOS builds require macOS and Xcode.

```powershell
cd mobile
npm install
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk" # Windows, if not already configured
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
npx expo prebuild --clean
npm run android:dev
# Or, on macOS: npm run ios:dev
```

After the development client is installed, start Metro for that client:

```powershell
npm run start:dev
```

Re-run `npx expo prebuild --clean` and rebuild whenever `app.json` or a native dependency changes. For JavaScript-only changes, restarting Metro is sufficient.

## Build the development client with EAS

```powershell
cd mobile
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --profile development --platform android
# Use --platform ios for an iOS build.
npm run start:dev
```

Install the resulting build on the device before starting Metro.

## Files added or changed

- `Backend/.env.example` — documents `JITSI_SERVER_URL`.
- `Backend/src/routes/session.routes.js` — returns authorized Jitsi connection details at join time.
- `mobile/.npmrc` — permits Jitsi's pinned peer set alongside Expo-managed package versions.
- `mobile/app.json` — native permissions, identifiers, deployment targets, and development-client configuration.
- `mobile/eas.json` — EAS development-client build profile.
- `mobile/metro.config.js` — SVG transformation required by the Jitsi SDK.
- `mobile/package.json` and `mobile/package-lock.json` — Jitsi, development-client, and native peer dependencies plus run scripts.
- `mobile/src/app/_layout.tsx` — registers the meeting route.
- `mobile/src/app/meeting/[bookingId].tsx` — Expo Router entry for a booking meeting.
- `mobile/src/features/meetings/jitsi-meeting-screen.tsx` — reusable loading, error, Expo Go fallback, and authenticated join screen.
- `mobile/src/features/meetings/jitsi-meeting-types.ts` — shared meeting view contract.
- `mobile/src/features/meetings/jitsi-meeting-view.native.tsx` — native Jitsi SDK view.
- `mobile/src/features/meetings/jitsi-meeting-view.tsx` and `.web.tsx` — type-check/web fallbacks that never load Jitsi native code.
- `mobile/src/features/hiruni/tutor-request-details.tsx` — updates confirmed online-lesson copy to point to Jitsi access.
- `mobile/src/features/medhani/session-payment.tsx` — adds Join Meeting and preserves the existing live lesson workspace.
- `docs/jitsi-meetings.md` — documents the architecture, Expo Go workflow, and local/EAS development-build commands.
- `README.md` — links this setup guide.
