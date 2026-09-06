# Bivia core

Shared TypeScript models, visual tokens, practice content, and authoring feedback for Bivia's player app and admin dashboard.

All bundled questions are development practice examples with intentionally public answer keys. Scores calculated here are for local practice. A ranked API must withhold answer keys and calculate and persist scores using trusted server data. Never accept a `Result` object from a client as a verified leaderboard entry.

Bible hints are short KJV excerpts used as associative clues. Sample content should receive editorial review before publication.

`timeLimit` returns the 30-second bonus window in category/challenger mode. In timed mode it returns the per-question deadline: 30, 28, 26, 24, 22, 20, 18, 16, then a 15-second minimum. Only timed mode should expire a question automatically.

`validateQuiz` returns an array of validation messages (empty means valid). It is feedback for authors, not a replacement for backend authorization or validation.

Run the test script with `npm test --workspace @bivia/core` from the repository root after dependencies are installed.
