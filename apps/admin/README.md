# Bivia editorial workspace

Run from the repository root with `npm run dev:admin`; Vite serves port 5174.

The default workspace is local. Sample questions start as drafts, edits persist in this browser, and JSON export creates portable copies. Local publication and scheduling are explicitly labeled and do not change the player catalog.

To edit backend content, configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` using `.env.example`. Open **Workspace** and sign in with a Supabase account granted an administrator role. The server checks `bivia_is_admin_v1()` and every editorial RPC enforces that role independently. No service-role secret belongs in this application.

Connected saves call `bivia_admin_v1('save_quiz', payload)`. Published quizzes appear immediately; scheduled quizzes use a future `publish_at` and become catalog-visible at that time. Game mode is selected by players for connected quizzes. Local drafts remain separate when signing into or out of the backend.

Draft titles are required. Publication requires complete, distinct answers, a valid answer index, and Bible hint/reference. Backend constraints require complete questions even for connected drafts. JSON imports accept an array of questions or an object containing `questions`, with `prompt`, `answers` (four strings), `correctIndex` (0–3), `hint`, and `reference`. Imports replace the current question set after a confirmation when it contains written content.

User moderation and group administration are not part of this editorial interface yet. The Trivia engine is available in a connected administrator workspace; it invokes the real backend and never simulates provider output.

Checks:

- `npm run typecheck --workspace @bivia/admin`
- `npm run build --workspace @bivia/admin`
- `npm run test --workspace @bivia/admin`

Self-hosted Inter fonts retain their license in `public/fonts/LICENSE_FONT`.

The **Categories** screen supports creating and editing stable category IDs, names, descriptions, icon identifiers, colors, and display order. Local categories persist separately in the browser; connected categories use the permission-protected `save_category` RPC. Workspace export includes both quizzes and categories.

Verified locally: authenticated admin sign-in, backend list, new draft save, future schedule, and return to draft through IAB. The disposable QA draft was archived after verification; seed quizzes remained unchanged. Category save/list round-trip passed against the local API with unchanged seed values. Build/typecheck and five focused validation/import/category tests pass.


## Trivia engine

The **Trivia engine** workspace creates server-persisted round briefs (category, progressive, or timed; 3–10 questions) and advances the `trivia-engine` Edge Function one stage at a time. A running stage is a durable background provider job; repeated Edge requests poll that same saved job. Editors can run one stage at a time or continue sequentially. The UI checks a running stage approximately every three seconds, including in one-stage mode, and stops before the next stage unless continuing all stages was selected. **Pause checks** or leaving the screen stops polling and additional stage dispatch. It does not cancel an already-started provider job, which may finish and incur cost. **Check current stage** resumes the saved job later. Cancel is available only when no provider stage is active.

Candidate review exposes research-source URLs, answer keys, scripture context, original-clue/quotation labels, separate fact and clue difficulty, reviewer findings, disagreements, and blind playtest results. Approvals apply to a particular candidate revision. Shortfalls are visible; quality gates are never relaxed to fill a requested round. Only a complete approved round can export, and export creates a **draft**, then opens the existing quiz editor. Publication remains a separate editorial action.

Run details show model, token counts, web searches, configured budgets, estimated costs, uncertain reservations, and audit history. A known failed stage requires an explicit retry reason. An uncertain provider outcome additionally requires acknowledgement of possible duplicate cost; the UI never automatically retries a failed request.

The default source mode is **Original clue + scripture reference**. It does not present a model-generated clue as an NIV quotation. Exact NIV text must come from the supplied passage library, with editor-verified source/context, source URL, and an explicit attestation that the license permits **AI processing**. A public Bible URL is not treated as an AI-use license. Provider keys remain on the backend.

Backend contracts: `bivia_engine_v1` for create/list/get/decide/retry/retry_stage/resolve_uncertain/cancel/export_draft/passages_list/passage_save, and the `trivia-engine` Edge Function for one persisted stage. The UI uses the canonical brief/candidate types in `supabase/functions/_shared/trivia-types.ts`.

A stale-version HTTP 409 refreshes the saved run and stops. It never silently recreates provider work. Polling tests verify one-stage boundaries, sequential continuation, latest-version reuse, pause, conflict stopping, uncertain/failed stopping, and interruptible timers.
