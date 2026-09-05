# Bivia WordPress audit and rebuild plan

September 5, 2026 · Local Bivia plugin v1.4

**Assessment:** Preserve the product concept, content, and user relationships. Rebuild the gameplay service and client interfaces. The plugin contains useful functionality, but score integrity and private-group authorization need correction before it becomes the backend for new public clients.

This is a source-code audit, not a live penetration test or rendered usability review. Database contents, active theme, other plugins, server configuration, deployed version, email delivery, and scheduled publication were not verified. No application code or data was changed. The separate React workspace was empty before this report.

**Environment finding:** The external volume containing WordPress reports 0 bytes available. Saving this report there failed, so it is saved in the React workspace. Uploads, logs, or other writes on that volume can also fail. Free space before runtime testing; no cleanup was performed.

**Existing product inventory**

| Area | Functionality found |
|---|---|
| Discovery | Timed/challenger carousels, topic categories, latest quizzes, completion indicators |
| Gameplay | Four choices, Bible hints, five-second hint previews, three starting points per question, wrong-answer deductions |
| Modes | Category trivia, decreasing timed limits, challenger with a five-wrong-selection limit |
| Results | Completion tracking, points, free play/replay paths, clipboard/browser sharing |
| Accounts | Email/password registration, WordPress login/reset links, names, category preferences, cropped profile photos |
| Groups | Creation, public joining, private requests, approval/denial, numeric-ID invite links |
| Competition | Group day/week/month/year/all-time leaderboards and quiz-specific leaderboard rendering |
| Administration | Question editing, category icons, OpenAI generation, scheduled publishing, points inspection |
| Installation | Browser installation banner; no manifest/service-worker implementation found inside this plugin |

The newer interface is approximately 1,600 lines of vanilla JavaScript, not React. It runs alongside PHP shortcodes and legacy JavaScript. AJAX operations depend on WordPress sessions and page-injected nonces. The SPA does not provide full legacy feature parity, including group creation and period-based leaderboards.

**High-priority findings**

1. **Players can submit invented scores.** [includes/ajax-handlers.php:27](</Volumes/Extreme Pro/Projects/Local Sites/bivia/app/public/wp-content/plugins/bivia/includes/ajax-handlers.php:27>) accepts caller-supplied positive points/category/quiz IDs without checking answers, quiz validity, elapsed time, category ownership, or maximum score. A signed-in player can use the normal page nonce. Correct answers are also exposed by the public trivia payload ([includes/spa/api-endpoints.php:50](</Volumes/Extreme Pro/Projects/Local Sites/bivia/app/public/wp-content/plugins/bivia/includes/spa/api-endpoints.php:50>)) and legacy HTML ([includes/category-trivia/trivia-shortcode.php:109](</Volumes/Extreme Pro/Projects/Local Sites/bivia/app/public/wp-content/plugins/bivia/includes/category-trivia/trivia-shortcode.php:109>)). Create server-owned attempts and score validated answers; do not send answer keys in ranked-play payloads.

2. **Private-group authorization can be bypassed.** The approval handler never checks whether the caller owns/manages the group ([includes/ajax-handlers.php:185](</Volumes/Extreme Pro/Projects/Local Sites/bivia/app/public/wp-content/plugins/bivia/includes/ajax-handlers.php:185>)). The public-join handler does not check visibility or target post type ([includes/ajax-handlers.php:227](</Volumes/Extreme Pro/Projects/Local Sites/bivia/app/public/wp-content/plugins/bivia/includes/ajax-handlers.php:227>)). Registration joins a group using only its numeric ID ([includes/users/onboarding-handler.php:96](</Volumes/Extreme Pro/Projects/Local Sites/bivia/app/public/wp-content/plugins/bivia/includes/users/onboarding-handler.php:96>)). Validate the target and actor on every operation. Replace numeric invite credentials with unguessable, revocable tokens. Nonces do not establish ownership.

3. **Private-group members are disclosed to nonmembers.** [includes/spa/api-endpoints.php:346](</Volumes/Extreme Pro/Projects/Local Sites/bivia/app/public/wp-content/plugins/bivia/includes/spa/api-endpoints.php:346>) checks login but returns member IDs, names, avatars, and points irrespective of group visibility or membership. Restrict sensitive response fields server-side; separately decide whether private group names should be discoverable.

4. **Duplicate or orphan points can be created.** The score handler checks completion, inserts points, then inserts completion, without a transaction ([includes/ajax-handlers.php:41](</Volumes/Extreme Pro/Projects/Local Sites/bivia/app/public/wp-content/plugins/bivia/includes/ajax-handlers.php:41>)). Concurrent requests can both write points before one loses the completion uniqueness race. A failed completion insert leaves points behind. The points table has no equivalent uniqueness constraint ([includes/points/database-setup.php:8](</Volumes/Extreme Pro/Projects/Local Sites/bivia/app/public/wp-content/plugins/bivia/includes/points/database-setup.php:8>)). Use atomic writes and idempotency/uniqueness for ranked attempts; reconcile existing rows before import.

5. **Zero-point finishes are rejected.** The save handler rejects `points <= 0` ([includes/ajax-handlers.php:33](</Volumes/Extreme Pro/Projects/Local Sites/bivia/app/public/wp-content/plugins/bivia/includes/ajax-handlers.php:33>)). Legitimate zero-score games remain incomplete. Persist completion independently of a positive score while rejecting negative/invalid scores.

6. **A test endpoint is loaded in production code.** The entry point includes `includes/test.php`; its `test_save_points` action accepts caller-supplied scores, skips completion tracking, and is registered for guests as well as signed-in users. It still requires a specific nonce, generated by `[test_save_button]` if that shortcode is published. Actual page usage is unverified. Remove this write path and inspect records for test data/user ID 0. Evidence: [includes/test.php:62](</Volumes/Extreme Pro/Projects/Local Sites/bivia/app/public/wp-content/plugins/bivia/includes/test.php:62>), [prayfit-trivia.php:91](</Volumes/Extreme Pro/Projects/Local Sites/bivia/app/public/wp-content/plugins/bivia/prayfit-trivia.php:91>).

7. **Registration and photo handling lack application-level abuse controls.** The public registration handler does not verify its onboarding nonce or implement throttling/email verification. Registration and account editing decode arbitrary base64 bytes into `.jpg` files without image validation, dimension checks, or an application size limit ([includes/users/onboarding-handler.php:80](</Volumes/Extreme Pro/Projects/Local Sites/bivia/app/public/wp-content/plugins/bivia/includes/users/onboarding-handler.php:80>), [includes/users/profile-ajax.php:32](</Volumes/Extreme Pro/Projects/Local Sites/bivia/app/public/wp-content/plugins/bivia/includes/users/profile-ajax.php:32>)). This creates account-spam/storage-abuse risk, not proof of executable upload. Validate/re-encode images, cap sizes, and throttle registration. Preserve passwords as entered rather than applying text sanitization.

8. **AI generation lacks form CSRF protection and a batch limit.** The admin submenu is capability-restricted, but the POST form/handler has no nonce and accepts unbounded post counts ([includes/ai/generate-trivia.php:26](</Volumes/Extreme Pro/Projects/Local Sites/bivia/app/public/wp-content/plugins/bivia/includes/ai/generate-trivia.php:26>), line 93). An induced request from an authenticated administrator could incur generation costs and schedule content; deployment/session behavior affects exploitability. Verify capability and nonce, cap batches, and use bounded background jobs.

**Integration and correctness defects**

| Problem | Evidence | Fix direction |
|---|---|---|
| SPA captures boot configuration too early | [assets/bivia-spa/api.js:2](</Volumes/Extreme Pro/Projects/Local Sites/bivia/app/public/wp-content/plugins/bivia/assets/bivia-spa/api.js:2>); [includes/spa/app-shell.php:95](</Volumes/Extreme Pro/Projects/Local Sites/bivia/app/public/wp-content/plugins/bivia/includes/spa/app-shell.php:95>) loads API before boot injection ahead of the app script | Inject boot before API load or resolve it on each request |
| SPA sends incompatible nonce actions | API uses `bivia_nonce`; group writes require `prayfit-group-nonce`; account writes require `prayfit_account_update_nonce` | Establish a consistent API security contract |
| Display-name edit is ignored | [assets/bivia-spa/bivia-app.js:893](</Volumes/Extreme Pro/Projects/Local Sites/bivia/app/public/wp-content/plugins/bivia/assets/bivia-spa/bivia-app.js:893>) sends `display_name`; [includes/users/profile-ajax.php:6](</Volumes/Extreme Pro/Projects/Local Sites/bivia/app/public/wp-content/plugins/bivia/includes/users/profile-ajax.php:6>) does not process it | Align persisted fields with the UI |
| SPA checkbox cannot enable SPA by itself | [prayfit-trivia.php:14](</Volumes/Extreme Pro/Projects/Local Sites/bivia/app/public/wp-content/plugins/bivia/prayfit-trivia.php:14>) always defines the constant; helper returns it before the saved option | Distinguish explicit override from default |
| Game mode IDs disagree | Legacy [assets/js/trivia.js:15](</Volumes/Extreme Pro/Projects/Local Sites/bivia/app/public/wp-content/plugins/bivia/assets/js/trivia.js:15>) uses timed 14/challenger 15; SPA line 971 and generator use 9/8 | Use an explicit mode enum and map real database terms |
| Editor saves empty questions | [includes/category-trivia/trivia-cpt.php:160](</Volumes/Extreme Pro/Projects/Local Sites/bivia/app/public/wp-content/plugins/bivia/includes/category-trivia/trivia-cpt.php:160>) pads to 20 slots; renderers iterate stored rows | Remove blanks and validate published question counts |
| Advertised speed bonus is absent | Both clients start at 3 points; ordinary timer expiry never removes a bonus ([assets/js/trivia.js:151](</Volumes/Extreme Pro/Projects/Local Sites/bivia/app/public/wp-content/plugins/bivia/assets/js/trivia.js:151>), SPA line 1267) | Specify and implement one authoritative scoring rule |
| Denial email callback argument mismatch | [includes/ajax-handlers.php:218](</Volumes/Extreme Pro/Projects/Local Sites/bivia/app/public/wp-content/plugins/bivia/includes/ajax-handlers.php:218>) emits two arguments; [includes/groups/groups-email-handler.php:70](</Volumes/Extreme Pro/Projects/Local Sites/bivia/app/public/wp-content/plugins/bivia/includes/groups/groups-email-handler.php:70>) requires three | Align signature; denial can update data then fail before success response |
| Existing-user invite hook registered too late | [includes/groups/individual-groups-shortcode.php:87](</Volumes/Extreme Pro/Projects/Local Sites/bivia/app/public/wp-content/plugins/bivia/includes/groups/individual-groups-shortcode.php:87>) adds `template_redirect` during shortcode rendering | Register routing at plugin load and use authorized invite acceptance |
| Results can appear saved after failure | SPA line 1338 resets only an internal flag and navigates to results | Show persistence state and retry idempotently |
| Points screens use different sources | [includes/points/points-shortcode.php:17](</Volumes/Extreme Pro/Projects/Local Sites/bivia/app/public/wp-content/plugins/bivia/includes/points/points-shortcode.php:17>) reads user metadata; current writes/leaderboards use tables | Reconcile and choose one source of truth |

The boot defect was reproduced with the actual API JavaScript in an isolated Node VM and mocked fetch. Configuration before load produced the expected nonce/custom endpoint; configuration after load produced empty nonce/security fields and the fallback endpoint. No network or score write was performed. All 11 JavaScript files passed syntax parsing. PHP was not on PATH, so PHP lint/runtime checks were not completed.

**Operations and maintainability**

- Global asset loading includes duplicate onboarding execution under different handles. Trivia initialization polls every 100 ms until elements exist. Scope assets and initialize each screen once ([prayfit-trivia.php:105](</Volumes/Extreme Pro/Projects/Local Sites/bivia/app/public/wp-content/plugins/bivia/prayfit-trivia.php:105>), line 175; [assets/js/trivia.js:2](</Volumes/Extreme Pro/Projects/Local Sites/bivia/app/public/wp-content/plugins/bivia/assets/js/trivia.js:2>)).
- Leaderboards run a points query per member for each of five periods; discovery queries per category. Points have no supporting user/date/trivia indexes. Use grouped queries, pagination, appropriate indexes, and measurements with real data.
- Membership/pending lists are serialized arrays. Concurrent read-modify-write operations can lose changes. Normalize membership rows with unique group/user constraints.
- Date calculations mix WordPress local time, PHP dates, and database `CURDATE()`/`YEARWEEK()`. Choose a competition timezone and UTC storage; preserve historical interpretation explicitly.
- Generation is synchronous with up to three 160-second requests per quiz; partial nonempty question sets are scheduled. Validation checks formatting/wording, not factual or verse accuracy. Difficulty is not included in the prompt. Add a review queue, exact-count checks, deduplication, and verified verse sources ([includes/ai/generate-trivia.php:188](</Volumes/Extreme Pro/Projects/Local Sites/bivia/app/public/wp-content/plugins/bivia/includes/ai/generate-trivia.php:188>)).
- Registration logs names/emails. AJAX logs write unconditionally under `wp-content`, and errors expose database details. Redact/restrict/rotate logs and return generic client errors. Public downloadability was not tested.
- All login sessions, including administrators, are extended to one year ([includes/users/user-login.php:5](</Volumes/Extreme Pro/Projects/Local Sites/bivia/app/public/wp-content/plugins/bivia/includes/users/user-login.php:5>)); registration calls `wp_signon` with secure-cookie flag false. Review session policy and HTTPS behavior in the deployment.
- SVG uploads are enabled without a sanitizer in this plugin ([includes/category-svg-icons.php:71](</Volumes/Extreme Pro/Projects/Local Sites/bivia/app/public/wp-content/plugins/bivia/includes/category-svg-icons.php:71>)). Restrict roles and sanitize content; other plugins may affect effective policy.
- Absolute `bivia.app`/`prayfit.app` URLs occur across login, sharing, and onboarding. Centralize URLs and map old media/links on migration.
- `trivia-uploader.php` duplicates shortcode functions but is not included by the entry point; AI settings are duplicated behind guards. Retire obsolete implementations after checking usage.
- No automated test suite, dependency manifest, schema-version migration framework, custom account-deletion/export flow, or native push/offline synchronization was found in this plugin. Other site components remain unreviewed.
- Rendered keyboard, screen-reader, focus, timer, and reduced-motion testing remains necessary; static review cannot establish accessibility compliance.

**Migration inventory**

| Current storage | Preserve/transform |
|---|---|
| WordPress users/user metadata | Profiles/preferences, legacy ID map, email collision checks; reviewed login bridge or password-reset migration |
| `prayfit_trivia` posts | Quiz ID/slug/title/status/publication time; explicit mode |
| `_prayfit_questions` | Ordered question/answer rows with stable IDs; remove blanks, validate correct indices and hints |
| Categories/relationships/`svg_icon` | Topics and assets, separate from mode identifiers |
| Group posts/authors/visibility | Groups and ownership; validate unknown visibility values |
| `_group_members`, `_group_pending_users` | Membership/request rows; deduplicate, normalize ID types, resolve deleted users/conflicting states |
| `trivia_points`, `trivia_completions` | Historical results; reconcile duplicates, missing counterparts, invalid IDs/categories, suspect scores, dates |
| `prayfit_*_points`, `joined_groups` | Reconciliation inputs; current writes do not consistently maintain these |
| Uploads/profile photo URLs | Copy with manifest/checksums/URL map; include files without Media Library attachment records |
| Future posts/settings | Schedule/editorial settings; handle secrets separately through a protected channel |

Historical records contain totals/completion, not full answer/timing history. Do not fabricate per-question analytics. Browser-only guest results cannot be recovered from a server database export.

**Proposed application architecture**

Start with a shared TypeScript React Native application using Expo for iOS, Android, and the app-like web experience. Expo supports these targets in its [official universal-app tutorial](https://docs.expo.dev/tutorial/introduction/). Validate trivia timing, accessibility, navigation, and web layout in a small prototype before committing. A separate React web client can share types/API logic if its interface needs to diverge significantly.

Use a versioned JSON API for authentication, quizzes, attempts, answers, results, membership, invitations, and leaderboards. The server owns ranked scoring and permissions. Return data/image URLs rather than rendered HTML. Use a relational schema with constraints and migrations; select hosting/auth vendors after clarifying budget, operating preferences, and account migration.

WordPress can remain the editorial CMS temporarily after hardening its boundaries. Its page-cookie/nonces are not a complete mobile authentication design; see the official [WordPress authentication documentation](https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/). Do not put administrator credentials in clients.

**Delivery sequence and completion gates**

1. Stabilize high-priority score/group paths if the old app remains active. Restore disk headroom and inventory the full site, data counts, media, theme/shortcodes, mail, and scheduled jobs.
2. Specify ranked/practice rules, zero scores, bonuses, time limits, retries, daily boundaries, privacy, invites, and API contracts. Map real terms and historical data.
3. Build register/login → quiz → server attempt → answer submission → saved result → leaderboard across web/iOS/Android. Verify reconnect/retry and background/resume behavior.
4. Add group creation/requests, ownership, preferences/photos, sharing/deep links, editorial review, and account deletion. Test owner/member/nonmember/guest permissions.
5. Rehearse repeatable migration. Compare content/member counts, per-user totals, sampled history, assets, and scheduled dates. Resolve suspect scores using an agreed policy.
6. Back up, freeze or explicitly synchronize writes, import the final delta, switch URLs/clients, smoke-test, and retain a tested rollback path. Avoid two independent ranked-score backends.

Before estimating the full build, confirm whether existing accounts/scores must migrate, whether editors should keep WordPress, expected audience/traffic, and whether offline play is practice-only. Also identify functionality supplied by the theme or other plugins. Those decisions materially affect backend, authentication, and migration scope.
