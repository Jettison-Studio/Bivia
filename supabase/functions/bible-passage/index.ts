import { isGuestPassage } from "../_shared/guest-passages.ts";
import { scriptureReference } from "../_shared/scripture-reference.ts";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Use POST." }, 405);
  const key = Deno.env.get("YOUVERSION_API_KEY");
  const api = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!key || !api || !service) return json({ error: "Scripture is not connected yet." }, 503);
  try {
    const body = await request.json();
    const usfm = scriptureReference(body.reference);
    if (!usfm) return json({ error: "Use a Bible book, chapter and verse, with up to ten verses in one chapter." }, 400);
    // Anonymous access is limited to the public sample, never arbitrary passages.
    if (!isGuestPassage(usfm)) {
      const authorization = request.headers.get("Authorization") ?? "";
      if (!authorization.startsWith("Bearer ")) return json({ error: "Sign in to read this passage." }, 401);
      const auth = await fetch(`${api}/auth/v1/user`, { headers: { Authorization: authorization, apikey: service }, signal: AbortSignal.timeout(8000) });
      if (!auth.ok) return json({ error: "Sign in to read this passage." }, 401);
      const user = await auth.json();
      if (!user.id || user.is_anonymous) return json({ error: "Sign in to read this passage." }, 403);
    }
    const headers = { "X-YVP-App-Key": key };
    const [passageResponse, bibleResponse] = await Promise.all([
      fetch(`https://api.youversion.com/v1/bibles/111/passages/${usfm}?format=text`, { headers, signal: AbortSignal.timeout(10000) }),
      fetch("https://api.youversion.com/v1/bibles/111", { headers, signal: AbortSignal.timeout(10000) }),
    ]);
    if (!passageResponse.ok || !bibleResponse.ok) return json({ error: "Couldn’t load the full passage. Please retry." }, 502);
    const passage = await passageResponse.json(); const bible = await bibleResponse.json();
    if (typeof passage.content !== "string" || !passage.content.trim()) return json({ error: "The passage text is unavailable." }, 502);
    return json({ text: passage.content, reference: passage.reference, translation: "NIV", copyright: bible.copyright, contextUrl: `https://www.bible.com/bible/111/${usfm.split('.').slice(0,2).join('.')}.NIV`, provider: "YouVersion" });
  } catch { return json({ error: "Couldn’t load the full passage. Please retry." }, 502); }
});
