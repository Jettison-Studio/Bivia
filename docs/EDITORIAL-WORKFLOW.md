# Local editorial workflow

Open http://localhost:5174/ and sign in with an editorial account. The builder opens directly after sign-in; there is no offline demo workspace. Sessions restore after refresh; every content request still checks the admin role on the server.

1. Open Trivia engine → New round. Choose a category, Timed, or Progressive round, categories, difficulty, and 3–10 questions. Progressive maps to Challenger in the player. Default source mode creates an original clue and a Scripture reference.
2. Create the brief, then run one stage or continue all stages. Planning, writing, factual review, Scripture context review, clue review, blind playtest, and assembly save their progress. Budgets and failed/uncertain-call recovery are retained.
3. Inspect each candidate, sources, rejected gates, and **Preview full NIV passage**. Check the whole passage for answer leakage and context. YouVersion text is display-only and never sent to the AI pipeline. A reference can specify a single verse or up to ten verses within one chapter.
4. Approve or reject each current revision. Request revisions for weak questions. All selected candidates need passing gates and human approval before export. The Science calibration examples influence planning/writing only, never the blind playtest.
5. Create the approved round as a draft. Review/edit the question, choices, key, original paid hint and reference. Editorial answer review is an inspection tool, not a simulation of gameplay timers.
6. Choose the game mode and publish for today, or schedule a future date/time. The input uses your local time; its UTC date determines the daily edition. One slot exists per topic per UTC day, plus one Timed and one Challenger slot. Upcoming placements are shown beside publishing controls. Occupied slots reject the entire save unless **Replace existing daily round** is explicitly selected. Returning a quiz to draft removes its upcoming placement. A quiz has one upcoming placement; make a new quiz for a new edition.
7. The player daily catalog exposes the quiz only on its edition day and after its publish time. Existing attempt snapshots are preserved. No automatic AI publication is enabled.

## Legacy content cleanup

KJV browser demos are no longer loaded. Known legacy local quizzes are archived; the NIV Science pilot and September 6 builder run remain active. Older generated runs are available under View archive with their reviews intact. No KJV text has been relabeled as NIV.

## Verification — September 6, 2026

- Admin build and player TypeScript passed; 18 admin tests and 16 engine tests passed.
- All existing local database/gameplay suites and concurrency/storage checks passed. Twelve additional editorial assertions cover permissions, scheduling, future hiding, conflict rollback, replacement, export mode, and draft withdrawal.
- Browser: authenticated dashboard, restored session, saved candidate review, full NIV retrieval with attribution, and enabled mode/publishing controls checked.
- A real three-question Science run completed all stages: five candidates, three selected, two rejected, zero shortfall, estimated cost $1.216214. Run `3fc4966b-5d8d-45fe-94a8-bb5476e7d49b` remains unapproved for human review. Evidence: `docs/engine-evidence/editorial-sprint.json`.
- Native simulator verification and production deployment were not performed in this sprint. All changes remain local.
