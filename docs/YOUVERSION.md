# Local YouVersion integration

The player and editorial dashboard read full NIV verses on demand through the `bible-passage` Edge function. It uses NIV version 111, with the app key in the server-only `YOUVERSION_API_KEY` variable. The player never receives the key. API text is displayed as plain text with the returned copyright notice and YouVersion attribution; no passage text is written into source files or the database.

Start the local stack, then serve functions with:

```
supabase functions serve --env-file supabase/functions/.env.local
```

The endpoint requires a verified Supabase user and accepts full English book names with a chapter and verse, or up to ten verses within one chapter. Invalid or nonexistent references fail without substituting invented text. It uses fixed YouVersion URLs, timeouts and generic errors. KJV practice retains its current text. Engine original-clue references now fetch the NIV passage for the reading screen; on a retrieval failure their fallback remains clearly labeled as an original clue. The paid hint remains the original clue.

While a full passage loads, the Ready button waits. On failure, the player can retry or explicitly continue with the existing excerpt. Read in context is currently hidden at the user’s request. The required copyright remains visible beneath the reading controls. Full NIV text is for display here; this integration does not send it to the generation engine.

Official documentation: https://developers.youversion.com/api-usage

Nothing has been deployed. Hosted integration requires configuring the secret on the hosted backend when deployment is authorized.
