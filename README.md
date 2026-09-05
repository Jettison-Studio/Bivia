# Bivia

Live web player: [bivia.vercel.app](https://bivia.vercel.app). Hosted setup and remaining account/AI configuration: [docs/HOSTED.md](docs/HOSTED.md).

A fresh standalone trivia app for web, iOS, and Android, with a separate editorial dashboard. WordPress is a design and behavior reference only. There is no WordPress runtime or data migration.

## Stack

- **Player:** React Native, Expo SDK 57, Expo Router, TypeScript; shared player routes across browsers, iOS, and Android.
- **Admin:** React and Vite, with a dedicated editorial interface.
- **Backend:** Supabase Auth, PostgreSQL, Storage, an authenticated avatar Edge Function, RLS, and versioned RPCs. Answer keys and scoring stay on the server.
- **Shared:** `packages/core` contains practice fixtures, types, scoring rules, validation, and design tokens.

The UI carries forward the original purple/pink palette, Inter typography, original navigation SVGs, rounded cards, Bible hints, and trivia flows. It is an adaptation for the new platforms, not a pixel-for-pixel reproduction.

## Run locally

Use Node 22.13+ and Docker Desktop. From this directory:

```sh
npm ci
npx --yes supabase@2.116.0 start --exclude realtime,imgproxy,studio,logflare,vector,supavisor
npm run dev
```

In a second terminal:

```sh
npm run dev:admin
```

Keep the authenticated avatar upload and trivia engine endpoints running in another terminal:

```sh
npx --yes supabase@2.116.0 functions serve --env-file supabase/functions/.env.local
```

It serves `http://127.0.0.1:56321/functions/v1/avatar-upload`. The function uses server-injected Supabase credentials and the database connection; none belong in a frontend environment file. If you need a custom server connection, use the ignored environment override described in [backend documentation](docs/BACKEND.md#avatar-edge-runtime).

- Player: http://localhost:8093
- Admin: http://localhost:5174
- Local email inbox: http://127.0.0.1:56324

The local `.env.local` files are configured on this workstation and ignored by version control. For a new checkout, copy each app's `.env.example` to `.env.local` and use the local API URL and **publishable** key from `supabase status`. Never include a service-role key in either frontend. Without backend configuration, guest practice and the admin's local draft workspace still work.

Create an account in the player. Local confirmation/reset emails appear in the development inbox. To grant editorial access, add that auth user's UUID to `private.admins` through a trusted local database session; see [backend documentation](docs/BACKEND.md). Admin local drafts are separate from connected server content.

## Mobile

```sh
npm run ios
npm run android
```

These commands build and launch the native app. Native features require Bivia’s compiled dependencies; a generic Expo Go host may be incompatible. iOS requires Xcode; Android requires Android Studio, its SDK, and a running emulator/device. See [native setup and verified commands](docs/NATIVE.md) for this workstation’s Ruby/JDK environment and dedicated-port launch settings. The app identifiers are `app.bivia.mobile`; the URL scheme is `bivia`.

The iOS simulator can reach the local backend at `127.0.0.1:56321`. An Android emulator normally uses `10.0.2.2:56321`; physical devices require the development computer's reachable LAN IP. Set `EXPO_PUBLIC_SUPABASE_URL` appropriately and restart Metro. Production builds need a hosted HTTPS backend. EAS build profiles are provided in `apps/player/eas.json`; store signing and an EAS project are not configured.

## Checks

```sh
npm run typecheck
npm test
npm run test:backend
npm run build
npm run build:native
```

`npm run test:backend` requires the local database, Storage, and avatar Edge Function running. It checks 77 SQL assertions, including engine permissions, budgets and draft-export gates, plus authenticated upload/deletion and concurrent scoring/upload requests.

Web output goes to `apps/player/dist` and `apps/admin/dist`. The player is a single-page app: its web host must rewrite application routes to `index.html`. `build:native` verifies iOS/Android JavaScript bundles; it is not an IPA/APK or a signed store build.

## What is implemented

Guest practice with persisted results; regular, timed, and challenger modes; server-verified ranked rounds; account signup/login/recovery; profiles and photos; account deletion; public/private groups, invitations, approvals, membership controls, and group leaderboards. The admin supports categories, quiz/question editing, preview, import/export, validation, drafts, scheduled publication, and archiving with server-enforced administrator permissions. Its OpenAI trivia engine plans category, timed, and progressive rounds, runs independent factual/context/clue reviews and a blind playtest, and requires human approval before draft export. See [engine workflow and operation](docs/TRIVIA-ENGINE.md).

Development content is deliberately small: 30 practice questions and 15 server questions. It needs editorial review and expansion before launch.

See [build status](docs/BUILD-STATUS.md), [backend contracts](docs/BACKEND.md), [admin usage](apps/admin/README.md), and the [WordPress audit](WORDPRESS-AUDIT.md).

## Hosted backend

The database and both Edge Functions are deployed to the Bivia Supabase project. Hosted AI secrets, sign-in configuration, and an administrator account still require setup. See [deployment status and migration mapping](docs/HOSTED.md) before pushing further database changes.
