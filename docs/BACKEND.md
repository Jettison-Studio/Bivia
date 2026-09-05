# Bivia standalone backend

This is a fresh Supabase/PostgreSQL implementation. It does not read, call, or require WordPress. The seed contains 15 original development questions across three quizzes; these are fixtures, not a reviewed launch library.

## Local development

Docker is required. Tested with Supabase CLI **2.116.0**, PostgreSQL 17, and all four versioned migrations.

```sh
npx --yes supabase@2.116.0 start --exclude realtime,imgproxy,studio,logflare,vector,supavisor
```

Run this from the Bivia repository root. The player uses dedicated port 8093; port 8081 belongs to another local project and must not be stopped. Dedicated backend ports avoid other local Supabase projects:

- API/Auth: `http://127.0.0.1:56321`
- PostgreSQL: `127.0.0.1:56322`
- Development email inbox: `http://127.0.0.1:56324`
- Web authentication redirect: `http://localhost:8093`
- Admin authentication redirect allowlist: `http://localhost:5174` (both localhost and 127.0.0.1 origins/routes are allowed for player/admin)
- Native redirect allowlist: `bivia://**`

Use the publishable key shown by `supabase status` in the client. Never put a service-role key, secret key, or database password in an `EXPO_PUBLIC_*` variable. Local credentials are for local development only. A physical phone must use the development computer's reachable LAN hostname/IP instead of `127.0.0.1`.

The app's local guest practice is independent of this database. Online attempts require a registered Supabase account. The auth trigger creates a profile, copying the `display_name` signup metadata value only; user metadata never controls permissions.

To reset this **local project's** data and replay the migrations and seed:

```sh
npx --yes supabase@2.116.0 db reset --local
```

This deletes local accounts and attempts. Do not run it while another developer is using the local app. No hosted Supabase project has been created, linked, or deployed.

## Database and security boundaries

Public tables are `profiles`, `categories`, `quizzes`, `attempts`, `groups`, and `group_members`. Every public table has RLS, and access grants are explicit. Direct client writes are limited to a user's own `profiles.display_name`, `avatar_url`, and `preferred_categories`. Players cannot insert/update/delete scores, attempts, questions, group memberships, or admin grants.

The unexposed `private` schema holds answer keys, immutable per-attempt question snapshots, idempotency responses, hashed invitation tokens, and administrator IDs. Do **not** add `private` to the Data API schemas. Private tables also have RLS and no client grants.

Versioned public RPCs use `SECURITY INVOKER`. They call narrowly granted private `SECURITY DEFINER` implementations, which authenticate and authorize their operation and use an empty `search_path`. Default public execution is revoked. Catalog reading is deliberately public and never includes questions/keys. Internal state/progression helpers are not executable by API roles.

Auth users cascade to their profile and owned records. The `avatars` Storage bucket is public for profile photo display, limited to 2 MiB and JPEG/PNG/WebP MIME types. New uploads go through the authenticated `avatar-upload` Edge Function, which chooses the current user’s `userId/filename` path. Direct client INSERT/UPDATE is denied. Listing and deletion are restricted to the current live account’s own folder. The app additionally decodes/reencodes selected photos; the bucket’s MIME allowlist is not a substitute for image decoding.

## Gameplay contract

Call these with `supabase.rpc(name, args)` and the signed-in player's normal JWT.

| RPC | Arguments | Result |
| --- | --- | --- |
| `bivia_catalog_v1` | none | `{categories, quizzes}` |
| `bivia_start_attempt_v1` | `p_quiz_id: UUID`, `p_mode: "category" \| "timed" \| "challenger" = "category"`, `p_ranked: boolean = true` | Attempt state |
| `bivia_attempt_v1` | `p_attempt_id: UUID` | Fresh state; processes the current timed timeout if expired |
| `bivia_answer_v1` | `p_attempt_id: UUID`, `p_question_id: UUID`, `p_option_index: integer`, `p_request_id: UUID` | State with feedback |

Catalog categories have `{id, name, icon, color, description, sort_order}`. Quizzes have `{id, category_id, title, description, status, publish_at, created_at, question_count}`. Only published quizzes whose publication time has arrived appear. Questions are delivered individually when an authenticated attempt starts.

```ts
type AttemptState = {
  id: string;
  quizId: string;
  mode: 'category' | 'timed' | 'challenger';
  ranked: boolean;
  score: number;
  wrongCount: number;
  status: 'active' | 'completed';
  questionIndex: number; // zero-based; questionCount on completion
  questionCount: number;
  questionStartedAt: string; // server UTC ISO instant after 5-second hint preview
  deadlineAt: string | null;
  serverNow: string; // use to estimate client/server clock offset
  question: null | {
    id: string;
    prompt: string;
    options: [string, string, string, string];
    hint: string;
    hintReference: string;
    selectedIndexes: number[];
  };
  feedback?: {
    questionId: string; // the question just submitted, not the next question
    correct: boolean;
    resolved: boolean;
    timedOut: boolean;
    pointsAwarded: number;
    selectedIndexes: number[];
    correctIndex?: number; // ONLY supplied when the question is resolved
    explanation?: string;
  };
};
```

Resolved submissions advance the state to the next question; feedback describes the previous question. The next five-second preview begins immediately at successful submission. Completed attempts return `question: null`. Keep the same request UUID when retrying a submission after a transport failure. An idempotent replay returns the original response exactly, including original clocks; fetch `bivia_attempt_v1` after recovery to obtain current state.

### Enforced rules

- Server time controls the five-second hint preview. Answers before it finishes are rejected.
- Category/challenger questions award up to three points. After 30 seconds, the maximum is two. Each distinct wrong guess subtracts one from the eventual award; scores never go below zero.
- A question resolves when answered correctly, after three distinct wrong guesses, on a timed timeout, or when challenger reaches five wrong answers total.
- Timed questions receive 30, 25, 20, 15, 10, 5, then 2.5 seconds per question. Correct timed answers start with a three-point maximum. Wrong guesses can be retried while time remains.
- A timed-out question awards zero and advances. The client may send `p_option_index: -1` (or null) after the deadline, or resume the attempt to process timeout. Invalid indexes before the deadline are rejected.
- Zero-score games are persisted and counted as completed games.
- There is one ranked attempt per user/quiz/mode/UTC day. Repeated starts resume that attempt, including its completed result.
- Online practice played first prevents ranked entry for that quiz for the remainder of the UTC day. Guest fixtures are a separate local content set. Publicly known trivia cannot be protected from memorization; this is score integrity, not a claim of cheat-proof competition.
- Attempt and question rows lock during submission. The unique idempotency key plus transaction prevents concurrent point duplication.
- Each attempt snapshots the questions and keys. Editing a quiz does not change an in-progress attempt.

## Profiles and accounts

`profiles` columns: `id` (same as auth user ID), `display_name`, nullable `avatar_url`, `preferred_categories` (text array), and `created_at`. Select and update only the signed-in user's profile. Other players' limited display identity is returned by authorized group/leaderboard RPCs.

Use Supabase Auth for signup, password sign-in, password recovery and signout. Native recovery links still need real-device release verification. Anonymous Supabase users cannot start online attempts.

## Groups and leaderboards

`bivia_groups_v1()` returns an array of visible groups plus `member_count` and `membership` (`active`, `pending`, or null). Public groups are discoverable by signed-in users. Private groups appear only for their owner or an existing membership/request.

`bivia_group_v1(p_group_id)` returns `{group, members, invites}`. Members have `{userId, displayName, avatarUrl, status, joinedAt}`. Pending members and invitation metadata are visible only to the owner. Pending requesters cannot read the private group's member list or leaderboard.

`bivia_group_action_v1(p_action, p_group_id = null, p_payload = {})` supports:

| Action | Payload | Result/behavior |
| --- | --- | --- |
| `create` | `{name, description?, visibility?: "public" \| "private"}` | `{id, status: "active"}`; owner is automatically a member |
| `join` | none | Public groups only |
| `invite` | none | Owner only; `{id, groupId, token, expiresAt}`; seven-day expiry |
| `accept_invite` | `{token}` | Private groups create a pending request; public groups join immediately |
| `approve` | `{userId}` | Owner approves an existing pending request |
| `remove` | `{userId}` | Owner removes a member; owner cannot remove self |
| `leave` | none | A member leaves; owner must delete instead |
| `revoke_invite` | `{inviteId}` | Owner revokes invitation |
| `edit` | `{name?, description?, visibility?}` | Owner only |
| `delete` | none | Owner only; cascades memberships and invites |

Normal action results are `{id, status}` describing the caller's current membership (`none` after leaving/deleting). Invitation plaintext is returned once and only a SHA-256 hash is stored. Invites are reusable until revoked/expired; each private recipient requires approval.

`bivia_leaderboard_v1(p_period = "weekly", p_group_id = null)` returns up to 100 rows: `{rank, userId, displayName, avatarUrl, score, gamesPlayed}`. Periods are `daily`, `weekly`, `monthly`, `yearly`, and `all`; boundaries use UTC, with Monday-start weeks. Tied scores share a dense rank. Only completed ranked attempts count. Group scores count attempts started after the player's most recent active membership began; leaving removes the player from that group's leaderboard. No score column is writable by a client.

## Admin authoring

An operator grants administrators in `private.admins` through a trusted database session, never through signup metadata or client code:

```sql
insert into private.admins(user_id) values ('THE_AUTH_USER_UUID');
```

`bivia_is_admin_v1()` returns a boolean. `bivia_admin_v1(p_action, p_payload = {})` checks this table on every operation, so removal takes effect immediately for authoring.

- `list`: `{categories, quizzes}`. Each quiz includes `questions` with `{id, quiz_id, position, prompt, options, correct_index, hint, hint_reference, explanation}`.
- `save_quiz`: accepts `{id?, category_id, title, description?, status?, publish_at?, questions}`. Each question requires `{prompt, options: string[4], correct_index: 0|1|2|3, hint, hint_reference, explanation?}`. Returns `{id}`. An existing quiz's editable question set is atomically replaced; active attempt snapshots remain intact.
- `archive_quiz`: `{id}` removes it from public availability while retaining history.
- `save_category`: `{id, name, icon?, color?, description?, sort_order?}` creates/updates a category.

Statuses are `draft`, `published`, and `archived`. Schedule by saving `published` with a future `publish_at`; the catalog automatically begins exposing the quiz at that instant, with no cron dependency. No AI provider calls or generation jobs are implemented in this backend yet.

## Verification

Executed successfully against the local Docker database:

- `supabase/tests/gameplay.sql`: 27 pgTAP assertions covering RLS, hidden answer keys, metadata escalation, server scoring, idempotency, private groups, and timed expiry.
- `supabase/tests/edge_cases.sql`: 13 pgTAP assertions covering zero-score completions, challenger limits, deductions, timed progression, and admin scheduling.
- `supabase/tests/concurrency.py`: two independent authenticated PostgreSQL sessions concurrently submit the same answer request; exactly three points persist and both responses match.
- Supabase security advisors: no warning/error issues.
- Supabase schema lint for `public,private`: no errors.
- Avatar Edge Function: explicit `deno check` passed with Deno 2.9.6 and pinned `postgres@3.4.9`; generated dependency lockfile included.
- `supabase/tests/storage_account.py`: real HTTP signup, authenticated Edge upload/public read, direct upload/update denial, cross-user delete denial, MIME/size rejection, safe file cleanup, account/owned-group deletion, stale JWT denial, and concurrent upload/delete serialization.
- Local migration history verified.

```sh
docker exec -i supabase_db_Bivia psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/gameplay.sql
docker exec -i supabase_db_Bivia psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/edge_cases.sql
python3 supabase/tests/concurrency.py
python3 supabase/tests/storage_account.py
npx --yes supabase@2.116.0 db advisors --local --type security --level warn --fail-on error
npx --yes supabase@2.116.0 db lint --local --schema public,private --fail-on error
```

Run the complete suite with `python3 supabase/tests/run.py`; this runner fails correctly on any pgTAP assertion failure or HTTP/concurrency failure.

pgTAP scripts run in rolled-back transactions. Inspect TAP for `not ok`; psql's exit status alone does not indicate assertion failures. The concurrency script creates and cleans up its own random test account.

The installed system CLI was an incomplete shim, so development used the full npm CLI. Its `db query --file` rejected multiple SQL commands in one prepared statement; multi-statement development SQL was applied with psql to the same local database. All four migration filenames were generated with `supabase migration new`; local history includes foundation, avatar/account deletion, initial transaction coordination, and the final server-owned upload boundary.

## Before production

Still required: a user-owned hosted project and environment configuration, email delivery/recovery verification, native auth deep-link QA, account deletion retention/legal review, production avatar upload QA, abuse/rate-limit strategy, reviewed launch content, AI generation/background jobs if desired, operational monitoring/backups, and real-device/network interruption testing. The local database and passing SQL tests do not constitute a production deployment.

## Avatar cleanup and account deletion

Call `supabase.functions.invoke("avatar-upload", { body: imageArrayBuffer, headers: { "Content-Type": "image/jpeg" } })`. The response is `{path}`; use `storage.from("avatars").getPublicUrl(path)` and save its URL in `profiles.avatar_url`. The function verifies the bearer token through Auth, enforces the 2 MiB limit and JPEG/PNG/WebP MIME plus magic-byte match, and generates the filename under the authenticated user’s folder. The player reencodes selected photos before upload. Profile photos are visible to other players. Direct Storage upload/update is intentionally denied; other users cannot list or delete someone else’s folder.

`bivia_delete_account_v1(p_confirmation: "DELETE MY ACCOUNT")` deletes the caller's auth sessions and auth user, cascading to profile, attempts, answer snapshots, memberships, admin grant, and groups they own. It returns `{deleted: true, deletedOwnedGroups: number}`. Display the owned-group deletion consequence before invoking it.

The caller must first list and remove all files in their own avatar folder through the **Storage API**. The RPC rejects deletion while any avatar objects remain. Do not delete `storage.objects` rows with SQL: that would orphan physical files. Only two path segments are permitted, so no recursive folder cleanup is required. The Edge Function keeps a per-user PostgreSQL transaction lock open until the Storage API has finished finalizing the upload. Account deletion takes the same lock before checking files and deleting the user. RLS permission checks alone were insufficient because Storage can finalize uploads in a separate privileged transaction; the regression test caught this race and direct client upload was removed. No custom trigger or alteration to Storage’s managed tables was introduced. Paginate/list until the folder is empty if there are many files. After successful deletion, clear the client's session with local signout.

The backend checks live account existence for avatar writes and authenticated group/leaderboard operations. A deleted user's still-unexpired access JWT cannot use those endpoints. Private attempts and memberships disappear through cascading deletion. This implementation is for a complete delete, with no soft-delete retention.

For operator/admin cleanup, use the same order with a trusted server-side Storage API client: remove physical avatar objects, then delete the auth account. Never expose service-role credentials to the app or admin browser.

## Avatar Edge runtime

`supabase/functions/avatar-upload` imports pinned `postgres@3.4.9` and uses a direct PostgreSQL transaction to coordinate uploads with deletion. The public gateway JWT check is disabled only because the function performs a live Auth user verification itself; no anonymous uploads are accepted.

Run locally with the Edge runtime enabled in `supabase start`, or explicitly run `npx --yes supabase@2.116.0 functions serve`. It uses the server-provided `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_DB_URL`. An optional server-only `BIVIA_DATABASE_URL` overrides the database connection. For a custom local override, copy `supabase/functions/.env.example` to ignored `.env.local`, then serve with `--env-file supabase/functions/.env.local`. The local Docker database hostname is `db`, not the container display name.

Deploy the function alongside migrations before enabling profile uploads. Neither the service-role key nor database URL belongs in player/admin browser environment variables. A crashed upload worker or interrupted Storage service still warrants periodic orphan reconciliation during production operations; the verified locking contract handles normal concurrent upload/deletion requests, not distributed service crashes.
