# Durable trivia engine API

The admin browser calls `bivia_engine_v1(p_action text, p_payload jsonb = '{}')` with a current signed-in administrator session. Every action checks the live administrator table and Auth session; JWT metadata cannot grant access. Engine tables and provider operations are private. No provider key is accepted from a browser.

Actions:

| Action | Payload | Result |
| --- | --- | --- |
| list | `{}` | latest 100 run summaries |
| settings | `{}` | server configuration |
| create | `{requestId,title?,brief}` | run; request UUID makes creation idempotent |
| get | `{id}` | full run, including expired-lease reconciliation |
| decide | `{id,candidateId,revision,decision,reason}` | run; approved or rejected, current revision only |
| retry | `{id,candidateIds,reason}` | run; selected repairs, two cycles maximum |
| retry_stage | `{id,reason}` | run; only a known failed stage |
| resolve_uncertain | `{id,reason,acknowledgePotentialDuplicateCost:true}` | run; explicit potential duplicate-cost acknowledgment |
| cancel | `{id}` | run; active leases must finish first |
| export_draft | `{id,title?,candidateIds?}` | `{quizId,reused}`; full assembled selection only |
| passages_list | `{}` | editor passage library |
| passage_save | `{id?,reference,text,translation:'NIV',context?,sourceUrl?,verified,rightsAttested,aiUseAttested,rightsNote}` | passage |
| passage_delete | `{id}` | `{deleted:true}` |

Canonical brief, candidate, review and stage-state interfaces live in `supabase/functions/_shared/trivia-types.ts`. A brief requests 3–10 questions, known unique category IDs, an intended category/progressive/timed format, and references or licensed_niv source mode. Progressive requires rising difficulty. New runs snapshot recent published prompts and up to ten prior human decisions as untrusted editorial calibration.

Full runs contain `id,title,status,version,state,config,createdAt,updatedAt,exportedQuizId,leaseExpiresAt,lastError,decisions,calls,audit,usage`. Status is queued, running, review, failed, uncertain, exported or cancelled. `usage` contains calls, inputTokens, outputTokens, webSearchCalls, estimatedCostUsd, reservedCostUsd and budgetCommittedUsd. Each call records stage, sequence, model, promptVersion, exact prompt/schema, provider response ID/status, token counts, tool call count, actual provider metadata, retrieved sources and outcome. Raw terminal provider JSON is private server data; the admin run response exposes providerStatus, providerDeletedAt and providerCleanupError. Failed stage output is not treated as a passed review.

POST `/functions/v1/trivia-engine` with a live bearer token and `{runId,expectedVersion}` starts one stage or polls its existing provider response and returns the updated full run. A queued run creates one background Responses request; a running run with a saved response ID only performs GET. Poll running results every `pollAfterMs` (3000), using the latest version. A queued result means that stage finished; review means assembly finished. Fetch get after a connection loss; never automatically recreate a paid request. Pausing stops browser polling and subsequent stages; the already submitted provider job continues and can be resumed later. HTTP 409 indicates a stale version or unavailable stage; 401/403 indicates authentication; 503 indicates configuration or a persistence failure. A model or validation failure usually returns HTTP 200 with durable failed/uncertain status so the editor can review it.

New configurations use a 90-second worker lease, a 30-second provider-creation timeout, and a 20-second single-poll timeout. The model itself can run longer in background mode. The database permits one reserved call per stage. A saved response ID survives worker lease expiry; resuming claims a new polling lease for the same call. Creation interrupted before a response ID was persisted remains uncertain and requires explicit editor recovery. Poll connection errors keep the run resumable without additional generation spend. Calls reserve conservative estimated input, output and search cost before dispatch, enforcing per-run and workspace-day estimates and the 21-call ceiling. Known provider usage replaces the reservation; unknown outcomes retain their reservation. These are configurable estimates, not guaranteed invoice totals or provider billing limits. Set an OpenAI project budget independently for production. No automatic retries, schedules or publication occur.

Each model stage starts a fresh Responses request with `background:true,store:true`, allowing return after the temporary polling window. Terminal raw responses and actual usage are stored locally before validation/replay; exact dispatched prompt/schema and canonical prompt version are preserved. Provider records are deleted after local persistence on a best-effort basis; failed cleanup is recorded and retried on a later endpoint request for the run. Unvisited paused runs remain at the provider under its configured retention policy; production operators should reconcile cleanup failures and abandoned runs. No sensitive account information is included in generation prompts. This uses the official [background Responses flow](https://developers.openai.com/api/docs/guides/background). Blind playtesting receives only its explicitly whitelisted question context. Theology search tools restrict domains to ebible.org and worldenglish.bible. Reference-mode hints are original clues, exported with the marker ` · Original clue (not a Bible quotation)`. Licensed NIV mode requires editor-supplied passages, verification and an explicit AI-use rights attestation; passage snapshots and current permissions are checked again before generation/export.

Start the local Edge service with `npx --yes supabase@2.116.0 functions serve --env-file supabase/functions/.env.local`. Keep OPENAI_API_KEY and optional BIVIA_DATABASE_URL only in that ignored server file. The existing local Supabase runtime supplies Auth/service/database environment variables. Never put secrets in VITE_ or EXPO_PUBLIC_ variables.

Run persistence/security verification without provider spend:

```sh
python3 supabase/tests/run.py
```

The engine's rolled-back pgTAP fixture checks anonymous/non-admin denial, live-session revocation, private table/function privileges, creation idempotency, input validation, editorial history, one-call leases, same-response polling after worker expiry, terminal-result replay persistence, retained uncertain reservations, explicit recovery, required human decisions and idempotent draft-only export. Root's separate benchmark script performs explicitly authorized live model evaluations.

## Evidence-search capacity

Future runs allow up to 16 web tool calls in each accuracy/theology stage, supporting independent primary-source checks for up to twelve planned candidates. Existing run snapshots retain their original limits. With observed roughly 12 KB stage prompts, the conservative reservation is about $2.51 per evidence stage, $1.32 more than the previous four-call allowance. Actual reported usage replaces this reservation. The $10 run and $30 workspace UTC-day guards remain unchanged; they may prevent a call whose worst-case reservation would exceed the remaining allowance. More tool capacity does not relax the requirement for actual retrieved evidence.
