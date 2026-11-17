# ТЫ.УРОВЕНЬ v0.7 — online RPG

Android client with eight generated character presets, original audio, offline quests, budget tracking, weight/photo diary and optional online account.

## Verified
GitHub Actions workflow built the Android APK and passed server integration tests for auth, private profiles, revisioned sync, friend requests and friends-only leaderboard.

## Start locally
Requires Node.js 22.13+.

```bash
cd server
npm test
npm start
```

Open http://localhost:8787. The Android client opens the local packaged UI and connects to a configured HTTPS server from the 🌐 button.

## Deploy online
This repository includes `render.yaml` and a Dockerfile. Create a Render Blueprint from this repository/branch. The blueprint provisions a persistent disk at `/data`. Configure a HTTPS domain. Add its URL in the Android app's online panel. For self-hosting use `docker compose up -d --build` and a TLS reverse proxy.

The source code being in GitHub **does not automatically deploy** the backend. Hosting, HTTPS and persistent storage must be provisioned.

## Privacy / security
Accounts private by default. Friend search opt-in. Financial data and cloud saves are private. Photos remain local. Passwords use salted scrypt and sessions use hashed tokens. Sync is manual and revision-protected; conflicting writes are rejected. Leaderboard XP is self-reported and is not cheat-proof. This is a test application, not an audited service for sensitive personal or financial information.

## Android
Open `android/` in Android Studio, compileSdk 35, JDK 17. The GitHub workflow also builds a test APK. Test builds are debug-signed and not ready for a store release.
