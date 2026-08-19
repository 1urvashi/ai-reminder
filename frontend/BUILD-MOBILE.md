# RemindAI — Android APK build (Capacitor)

The web app is wrapped into a native Android app with [Capacitor](https://capacitorjs.com).
The `android/` folder is a ready Android Studio project.

## Prerequisites (one time)

- **Android Studio** (includes the Android SDK + JDK) — https://developer.android.com/studio
- Node.js (already used for the web app)

## 1. Point the app at your deployed backend

On a phone, `localhost` is the phone itself — it cannot reach your PC's backend.
Deploy the backend somewhere public (Render, Railway, a VPS, etc.) and set the API URL
at build time. Create `frontend/.env.production`:

```
VITE_API_URL=https://your-backend-domain.com/api
```

(For a quick test you can use your PC's LAN IP, e.g. `http://192.168.1.5:5000/api`,
with the phone on the same Wi‑Fi and CORS `CLIENT_ORIGIN` set accordingly.)

## 2. Build the web assets and sync into Android

```bash
cd frontend
npm run cap:sync      # vite build + cap sync android
npm run cap:open      # opens the project in Android Studio
```

## 3. Produce the APK

In Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
The APK lands in `android/app/build/outputs/apk/`.
For the Play Store, use **Build → Generate Signed Bundle / APK** (create a keystore).

## Native features (follow-ups)

The core app (typing reminders, dashboard, WhatsApp/email/AI-call channels via the
backend) works inside the Android WebView as-is. Two browser-only features need a
native plugin to work well in the APK:

- **Voice input** — the browser Web Speech API is unreliable in the Android WebView.
  Add `@capacitor-community/speech-recognition` and gate the mic on
  `Capacitor.isNativePlatform()`.
- **Reminder pop-ups when the app is closed** — use `@capacitor/local-notifications`
  or Firebase push instead of the browser Notification API.

These are optional; add them when you want full native parity.
