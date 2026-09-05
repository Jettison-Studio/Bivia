import postgres from "postgres";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const maxBytes = 2 * 1024 * 1024;
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: cors });

async function readImage(request: Request): Promise<Uint8Array> {
  if (!request.body) throw new Error("Choose a photo to upload.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maxBytes) {
      await reader.cancel();
      throw new Error("Choose a photo under 2 MB.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

function matchesImage(bytes: Uint8Array, type: string): boolean {
  if (type === "image/jpeg")
    return (
      bytes.length > 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  if (type === "image/png")
    return (
      bytes.length > 8 &&
      [137, 80, 78, 71, 13, 10, 26, 10].every(
        (value, index) => bytes[index] === value,
      )
    );
  if (type === "image/webp")
    return (
      bytes.length > 12 &&
      new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
      new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
    );
  return false;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: cors });
  if (request.method !== "POST")
    return json({ error: "Use POST to upload a photo." }, 405);
  const api = Deno.env.get("SUPABASE_URL");
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const database =
    Deno.env.get("BIVIA_DATABASE_URL") || Deno.env.get("SUPABASE_DB_URL");
  if (!api || !secret || !database)
    return json({ error: "Photo uploads are not configured." }, 503);
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer "))
    return json({ error: "Sign in to upload a photo." }, 401);
  const authResponse = await fetch(`${api}/auth/v1/user`, {
    headers: { Authorization: authorization, apikey: secret },
  });
  if (!authResponse.ok)
    return json({ error: "Sign in to upload a photo." }, 401);
  const user = await authResponse.json();
  if (!user.id || user.is_anonymous)
    return json({ error: "A registered account is required." }, 403);
  const contentType = request.headers.get("Content-Type")?.split(";")[0] || "";
  if (!["image/jpeg", "image/png", "image/webp"].includes(contentType))
    return json({ error: "Choose a JPEG, PNG, or WebP photo." }, 415);
  let bytes: Uint8Array;
  try {
    bytes = await readImage(request);
  } catch (error) {
    return json({ error: (error as Error).message }, 413);
  }
  if (!matchesImage(bytes, contentType))
    return json(
      { error: "The photo format does not match its contents." },
      415,
    );
  const extension =
    contentType === "image/jpeg"
      ? "jpg"
      : contentType === "image/png"
        ? "png"
        : "webp";
  const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
  const sql = postgres(database, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 10,
  });
  try {
    await sql.begin(async (transaction) => {
      // The transaction remains open until Storage has finalized the object. Account deletion
      // takes this exact lock before checking files and deleting the account.
      await transaction`select pg_advisory_xact_lock(hashtextextended(${user.id}::text, 0))`;
      const accounts =
        await transaction`select id from auth.users where id=${user.id}::uuid and not coalesce(is_anonymous,false)`;
      if (!accounts.length) throw new Error("ACCOUNT_DELETED");
      const upload = await fetch(`${api}/storage/v1/object/avatars/${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          apikey: secret,
          "Content-Type": contentType,
          "x-upsert": "false",
        },
        body: bytes.buffer as ArrayBuffer,
      });
      if (!upload.ok) throw new Error("STORAGE_UPLOAD_FAILED");
    });
    return json({ path });
  } catch (error) {
    console.error(
      "Avatar operation failed",
      (error as { code?: string }).code || (error as Error).message,
    );
    // If the Storage write succeeded but the DB transaction failed, remove the physical
    // object through Storage API. Never delete storage metadata directly.
    await fetch(`${api}/storage/v1/object/avatars`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${secret}`,
        apikey: secret,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefixes: [path] }),
    }).catch(() => {});
    return json(
      {
        error:
          (error as Error).message === "ACCOUNT_DELETED"
            ? "Your account is no longer available."
            : "Your photo could not be saved. Please try again.",
      },
      (error as Error).message === "ACCOUNT_DELETED" ? 401 : 500,
    );
  } finally {
    await sql.end({ timeout: 1 });
  }
});
