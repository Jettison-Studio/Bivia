# Daily rounds

Local implementation: each topic has one scheduled regular round per UTC date, plus one mixed Timed and one mixed Challenger round. `public.daily_rounds` maps slots to published quiz IDs. Schedules without published questions are unavailable, never replaced with practice content. Question counts come from the assigned quiz.

`bivia_daily_catalog_v1` returns today's slots and only the caller's saved ranked attempt status/score. It uses the server's UTC date and returns the next rollover time. The player refreshes on home focus, app foreground, every 30 seconds while home is focused, and at rollover. Changing accounts clears the displayed account state. Practice history never marks a daily card complete.

Cards open server-scored RankedGame. Starts go through `bivia_start_daily_v1`; expired editions cannot create new attempts. Existing attempt IDs resume or show results through the owner-checked attempt RPC. The unique daily-attempt index prevents duplicate scoring. Completed results remain in account history and can be reopened after rollover. The hero remains a device-local guest sample.

## Local test content

`scripts/seed-local-daily.sql` schedules existing private development fixtures for the current UTC day: Geography, Science, Food & Drink, a 10-question mixed Timed round, and a 15-question mixed Challenger round. It is opt-in, idempotent, and not part of a production migration. Do not run it against hosted Supabase. These are test questions; the Challenger fixture is not a calibrated progression. Other categories show Coming soon.

To schedule an actual edition, create/review/publish a quiz through the editorial workflow, then insert its UUID into `daily_rounds` with `edition_day`, `mode`, and `category_id` (null for mixed modes). Use a fresh quiz ID for each edition and leave already-played schedules unchanged. Unique indexes reject duplicate slots. Never grant player write access to the schedule. Automatic daily generation/scheduling is not enabled by this change; no fresh content is invented at midnight if tomorrow has no approved schedule.

## Checks

`supabase/tests/daily.sql` verifies today's visibility, unplayed/active/completed states, persisted scores, retry/resume IDs, UTC rollover, and guest restrictions inside a rollback transaction. Included in `supabase/tests/run.py`.
