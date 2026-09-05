# Hosted Supabase deployment

Project: **Bivia** (`lluycxbwwiiivnkoxfai`), us-west-2. [Dashboard](https://supabase.com/dashboard/project/lluycxbwwiiivnkoxfai). API: `https://lluycxbwwiiivnkoxfai.supabase.co`.

## Deployed September 5, 2026

All nine repository migrations were applied to the initially empty hosted project through the authenticated Supabase connector. The final migration supplies the base category catalog without the development quizzes in `seed.sql`. Both `avatar-upload` and `trivia-engine` are active at version 1. They deliberately use `verify_jwt=false` and authenticate requests inside their handlers via Supabase Auth, with live-session and administrator checks where required.

The hosted runtime supplies `SUPABASE_DB_URL` and its Supabase server credentials. Do not upload a local `BIVIA_DATABASE_URL`: it would override the hosted connection. [Default function secrets](https://supabase.com/docs/guides/functions/secrets).

The existing OpenAI key remains local. Its hosted `OPENAI_API_KEY` secret was not uploaded because CLI authentication stalled and the Mac screen lock prevented the browser fallback. The deployed engine therefore cannot yet generate hosted trivia. Upload only that key through authenticated Supabase secret management; never upload the entire local function environment file without checking its contents.

## Verification

- 10 categories; zero accounts, quizzes, or engine runs imported.
- Every table in `public` and `private` has RLS enabled.
- Public category and quiz queries return HTTP 200.
- Private answer data is absent from the exposed API (HTTP 404).
- Anonymous engine RPC and both unauthenticated Edge requests return HTTP 401.
- Security advisor returned informational notices only for intentionally inaccessible private tables with RLS and no policies. Keep this deny-by-default behavior; do not add permissive policies to silence the notice. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- Authenticated hosted gameplay, uploads and paid generation are not yet end-to-end tested; no hosted administrator exists.

## Client configuration and sign-in

Ignored `apps/admin/.env.production.local` and `apps/player/.env.production.local` contain the hosted URL and public publishable key. Local `.env.local` files remain on the development backend. No server secret is in either client configuration.

Before using hosted authentication, configure the Site URL and allowlisted redirects for the actual web host, local development origins as needed (`http://localhost:8093/**`, `http://127.0.0.1:8093/**`, admin port 5174), and native `bivia://**`. The final public web origin has not been supplied. Do not push local `auth.email.enable_confirmations=false` into the hosted project. Public email delivery needs review: Supabase's default SMTP is limited to project-team recipients; configure custom SMTP for broader signup/recovery. [SMTP guidance](https://supabase.com/docs/guides/auth/auth-smtp).

Create the owner's hosted account and grant its UUID editorial access in `private.admins` through a trusted database session. No local test credentials were copied or administrator access inferred from a Git identity.

## Migration history

The connector assigned deployment timestamps to the applied migrations. Their names and exact repository source files are recorded in [hosted-deployment.json](hosted-deployment.json). The database ledger remains unchanged: automatic approval review rejected rewriting timestamps due to migration-integrity risk.

**Do not run an ordinary CLI `db push` against this project until the local/remote version mapping is reconciled explicitly.** It may treat already-applied migrations as new. Future connector deployments should apply only genuinely new migration files and extend the recorded mapping. The current schema deployment is complete despite the differing migration versions.
