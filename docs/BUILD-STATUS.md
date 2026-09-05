# Build status — September 5, 2026

This is the first working standalone build. It is configured for local development, with a shared web/iOS/Android player and a separate admin dashboard. No WordPress runtime or content migration is involved. The hosted Supabase schema and Edge Functions are deployed; see [hosted status](HOSTED.md) for pending secrets and authentication setup.

## Delivered

- Original brand palette, Inter type, original SVG navigation assets, responsive trivia cards, Bible hints, and adapted gameplay screens.
- Practice category/timed/challenger rounds, wrong-answer deductions, result sharing, and local history.
- Supabase accounts, profile editing, photo handling, password reset screens, and account deletion.
- Server-authoritative ranked attempts, hidden answer keys, stable request IDs for retries, timeouts, immutable question snapshots, and daily attempt limits.
- Public/private groups, reusable expiring/revocable invitations, private membership approvals, member removal, owner group deletion, and period-filtered leaderboards.
- Admin category and quiz authoring, question preview, JSON import/export, validation, draft/schedule/publish/archive, and backend-enforced administrator access.
- Database migrations, development seed content, focused unit tests, SQL permission/scoring checks, and real HTTP/concurrency tests.
- OpenAI trivia engine with durable stages, evidence reviews, blind playtesting, category/progressive/timed briefs, bounded repairs, cost limits, human approval and draft-only export.

## Verification

- Web: completed a five-question ranked round through real sign-in, received 11 points from the server, reloaded the result route, and confirmed the same saved result. Verified a 390px phone layout.
- iOS: built and installed `app.bivia.mobile` on iPhone 17 Pro Simulator. Completed five-question Fitness practice with a wrong guess, received 14 points, force-quit/relaunched, and confirmed persisted history. See [native evidence and commands](NATIVE.md).
- Android: built and installed on Pixel 8 Emulator. Completed all five Fitness questions with a wrong guess and deliberately slower answers (9 points), cold-launched the app, and confirmed persisted history.
- Admin: authenticated connected workspace, saved a draft, scheduled it, returned it to draft, and archived the disposable test quiz. Verified category save/list against the local API.
- Groups: verified creation, private owner view, invitation creation/revocation, and owner deletion through a confirmation dialog. Removed the disposable test group.

- Automated: all 41 application/engine/dependency tests and 77 SQL assertions pass. Server scoring concurrency and real HTTP avatar/account checks pass, including four additional concurrent upload/deletion runs. TypeScript, Edge Deno checks, database lint, and security advisors pass.
- Engine trial: 36 candidates plus three revisions completed across fitness, science and mixed progressive briefs. Four candidates met every current machine gate; no complete round was exported or published. Source coverage and difficulty calibration remain launch work. See [live evidence](engine-evidence/BENCHMARK.md).
- Builds: player web, admin web, and iOS/Android JavaScript production exports pass. Native iOS and Android development builds succeed.
- Native development warning: rapid Android cold launch followed by Profile can produce a non-crashing React state-update warning in Expo Router’s initial-link handling (`useLinking.native.js`). The round and saved history remain correct. No warning suppression or speculative framework patch was applied; track this during release QA. See [native notes](NATIVE.md).
- Dependency review: fixed the URL-decoder denial-of-service and esbuild findings. The remaining 10 moderate transitive findings derive from an upstream uuid/build-tool advisory; the inspected Xcode path uses an unaffected API. See [dependency notes](DEPENDENCIES.md).

See README commands and [backend test documentation](BACKEND.md) for repeatable checks. Screenshots: [web player](web-evidence/player.jpg), [connected admin](web-evidence/admin.jpg), and [native evidence](NATIVE.md).

## Remaining before launch

1. Review the design against rendered screens of the original plugin. This build preserves its visual language but has not been checked for exact screenshot parity.
2. Expand and editorially review launch trivia, Bible references, category coverage, and accessibility/content details.
3. Create/configure a hosted backend and frontend hosting, production domains, email delivery, monitoring, backups, abuse controls, and orphan-file reconciliation for infrastructure failures during uploads.
4. Complete real-device and unreliable-network tests, especially authentication deep links, uploads, and recovery.
5. Supply final app/store artwork, signing accounts, store listings, privacy/support pages, and complete store submission.
6. Calibrate the trivia engine against human reviews and real player difficulty. Confirm NIV licensing that permits AI use and supply verified licensed passages; current development uses original scripture-reference clues.
7. Add administrative user/group moderation and any additional launch requirements beyond the current editorial dashboard.

The Supabase schema and Edge Functions are deployed; frontend hosting and store submission have not been performed. A server-only OpenAI credential is configured for the authorized engine trial. Local environments and unapproved development questions are not production data.
