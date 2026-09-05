import postgres from "postgres";
import { runStage, PROMPT_VERSION, type EngineState, type ModelRequest, type ModelResponse, type Source } from "../_shared/trivia-engine.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const canonical = (value: any): string => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key,item[key]])) : item);
const response = (data: unknown, status = 200) => Response.json(data, { status, headers: cors });
type Config = { model: string; reasoningEffort: string; serviceTier: string; maxOutputTokens: number; maxInputChars: number; maxToolCalls: number; providerTimeoutMs: number };
type Run = { id: string; status: string; version: number; state: EngineState; config: Config };

/** Metadata is taken only from provider tool outputs and annotations, never generated JSON. */
function sourceMetadata(output: any[]): Source[] {
  const sources: Source[] = [];
  for (const item of output) {
    if (item.type === "web_search_call") {
      for (const source of item.action?.sources ?? []) {
        if (typeof source.url === "string") sources.push({ url: source.url, title: source.title || source.url, kind: "web_search" });
      }
    }
    for (const content of item.content ?? []) {
      for (const annotation of content.annotations ?? []) {
        if (annotation.type === "url_citation" && typeof annotation.url === "string") sources.push({ url: annotation.url, title: annotation.title || annotation.url, kind: "citation" });
      }
    }
  }
  return [...new Map(sources.map(source => [source.url, source])).values()];
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return response({ error: "Use POST to advance one generation stage." }, 405);
  const api = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const database = Deno.env.get("BIVIA_DATABASE_URL") || Deno.env.get("SUPABASE_DB_URL");
  const providerKey = Deno.env.get("OPENAI_API_KEY");
  if (!api || !serviceKey || !database) return response({ error: "The generation service is not configured." }, 503);
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return response({ error: "Live administrator session required." }, 401);
  let user: { id: string }; let sessionId: string;
  try {
    const auth = await fetch(`${api}/auth/v1/user`, { headers: { Authorization: authorization, apikey: serviceKey } });
    if (!auth.ok) return response({ error: "Live administrator session required." }, 401);
    user = await auth.json();
    const encoded = authorization.slice(7).split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    sessionId = JSON.parse(atob(encoded)).session_id;
    if (!sessionId) return response({ error: "A current signed-in session is required." }, 401);
  } catch { return response({ error: "Invalid authentication." }, 401); }
  let body: { runId: string; expectedVersion: number };
  try {
    const text = await request.text();
    if (text.length > 2000) return response({ error: "Request too large." }, 413);
    body = JSON.parse(text);
    if (!/^[0-9a-f-]{36}$/i.test(body.runId) || !Number.isInteger(body.expectedVersion) || body.expectedVersion < 0) throw new Error();
  } catch { return response({ error: "Supply runId and expectedVersion." }, 400); }

  const sql = postgres(database, { max: 1, prepare: false, connect_timeout: 10, idle_timeout: 10 });
  let lease: string | null = null; let run: Run | null = null; let call: any = null;
  let dispatched = false; let recorded = false; let hasProviderId = false;
  const release = async (message: string | null = null) => {
    const rows = await sql`select private.engine_release_pending(${body.runId}::uuid,${lease}::uuid,${message}) as result`;
    return response(rows[0].result);
  };
  const cleanup = async () => {
    // Retry bounded cleanup of already-persisted terminal responses on later requests.
    const rows = await sql`select c.id,c.provider_response_id from private.engine_calls c join private.engine_runs r on r.id=c.run_id where c.run_id=${body.runId}::uuid and c.provider_result is not null and c.provider_deleted_at is null and c.id is distinct from r.active_call_id limit 3`;
    for (const item of rows) {
      try {
        const removed = await fetch(`https://api.openai.com/v1/responses/${encodeURIComponent(item.provider_response_id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${providerKey}` }, signal: AbortSignal.timeout(5000) });
        if (removed.ok || removed.status === 404) await sql`update private.engine_calls set provider_deleted_at=clock_timestamp(),provider_cleanup_error=null where id=${item.id}::uuid`;
        else await sql`update private.engine_calls set provider_cleanup_error=${`Provider cleanup HTTP ${removed.status}`} where id=${item.id}::uuid`;
      } catch { await sql`update private.engine_calls set provider_cleanup_error='Provider cleanup interrupted; retry on next engine request' where id=${item.id}::uuid`; }
    }
  };
  try {
    const allowed = await sql`select private.engine_session_admin(${user.id}::uuid,${sessionId}) as allowed`;
    if (!allowed[0].allowed) return response({ error: "Live administrator session required." }, 403);
    if (!providerKey) return response({ error: "OPENAI_API_KEY is not configured on the server." }, 503);
    await cleanup();
    const claims = await sql`select private.engine_claim(${body.runId}::uuid,${body.expectedVersion},${user.id}::uuid,${sessionId}) as result`;
    lease = claims[0].result.leaseToken; run = claims[0].result.run as Run; call = claims[0].result.activeCall;
    const current = run;
    const providerHeaders = { Authorization: `Bearer ${providerKey}`, "Content-Type": "application/json" };
    let providerResult: any = call?.provider_result ?? null;
    hasProviderId = !!call?.provider_response_id;
    if (hasProviderId && !providerResult) {
      // Polling never creates or reserves another model request.
      let fetched: Response;
      try { fetched = await fetch(`https://api.openai.com/v1/responses/${encodeURIComponent(call.provider_response_id)}?include[]=web_search_call.action.sources`, { headers: providerHeaders, signal: AbortSignal.timeout(20000) }); }
      catch { return await release("Provider polling interrupted. Resume retrieves the same response without another generation call."); }
      if (!fetched.ok) {
        if (fetched.status === 404) {
          await sql`select private.engine_finish(${body.runId}::uuid,${lease}::uuid,${user.id}::uuid,${sessionId},${sql.json(current.state as any)},'Saved provider response is unavailable; its cost reservation remains for explicit reconciliation.',true)`;
          const rows = await sql`select private.engine_run_json(${body.runId}::uuid) as result`;
          return response(rows[0].result);
        }
        return await release(`Provider polling HTTP ${fetched.status}. Resume retrieves the same response.`);
      }
      providerResult = await fetched.json();
      await sql`select private.engine_provider_save(${body.runId}::uuid,${lease}::uuid,${call.id}::uuid,${sql.json(providerResult)})`;
      if (["queued", "in_progress"].includes(providerResult.status)) return await release();
    }
    if (providerResult && !["queued", "in_progress"].includes(providerResult.status)) {
      const output = Array.isArray(providerResult.output) ? providerResult.output : [];
      const reliableUsage = Number.isInteger(providerResult.usage?.input_tokens) && Number.isInteger(providerResult.usage?.output_tokens);
      const metadata: any = {
        model: typeof providerResult.model === "string" ? providerResult.model : current.config.model,
        responseId: providerResult.id,
        ...(reliableUsage ? { inputTokens: providerResult.usage.input_tokens, outputTokens: providerResult.usage.output_tokens } : {}),
        webSearchCalls: output.filter((item: any) => item.type === "web_search_call").length,
        sources: sourceMetadata(output), providerUsage: providerResult.usage ?? null,
      };
      if (call.status === "reserved") {
        await sql`select private.engine_record_call(${body.runId}::uuid,${lease}::uuid,${call.id}::uuid,${reliableUsage ? "succeeded" : "uncertain"},${sql.json(metadata)},${reliableUsage ? null : "Provider returned no reliable usage; reservation retained."})`;
      }
      recorded = true;
      if (!reliableUsage) throw new Error("Provider returned no reliable usage; review the retained reservation.");
      if (providerResult.status !== "completed") throw new Error(`Provider response ended ${providerResult.status}; recorded usage is retained. ${providerResult.error?.code ?? ""}`);
      const outputText = output.flatMap((item: any) => item.content ?? []).filter((item: any) => item.type === "output_text").map((item: any) => item.text).join("");
      if (!outputText) throw new Error("Provider returned no structured output; response and usage are retained.");
      const data = JSON.parse(outputText);
      const next = await runStage(current.state, async request => {
        if (request.stage !== call.stage || canonical(request.schema) !== canonical(call.prompt.schema)) throw new Error("Saved response schema differs from the current engine. Restore a compatible engine before replay; no new model call was issued.");
        return { data, metadata } as ModelResponse;
      });
      // Preserve the actual dispatched prompt, even if prompt text changed after submission.
      const last = next.records.at(-1)!;
      last.request = call.prompt; last.promptVersion = call.prompt_version;
      const rows = await sql`select private.engine_finish(${body.runId}::uuid,${lease}::uuid,${user.id}::uuid,${sessionId},${sql.json(next as any)},${null},false) as result`;
      await cleanup();
      return response(rows[0].result);
    }
    // No saved response exists only for a newly claimed stage. Capture its exact request
    // through the pure engine callback; throwing this sentinel prevents state advancement.
    let modelRequest: ModelRequest | null = null;
    const captured = new Error("request-captured");
    let assembled: EngineState | null = null;
    try { assembled = await runStage(current.state, async request => { modelRequest = request; throw captured; }); }
    catch (error) { if (error !== captured) throw error; }
    if (assembled) {
      const rows = await sql`select private.engine_finish(${body.runId}::uuid,${lease}::uuid,${user.id}::uuid,${sessionId},${sql.json(assembled as any)},${null},false) as result`;
      return response(rows[0].result);
    }
    if (!modelRequest) throw new Error("The engine did not produce a stage request.");
    const requestSpec = modelRequest as ModelRequest;
    const savedPrompt = { ...requestSpec, promptVersion: PROMPT_VERSION };
    const prompt = JSON.stringify(savedPrompt);
    if (prompt.length > current.config.maxInputChars) throw new Error("Stage prompt exceeds the server input limit.");
    const reserved = await sql`select private.engine_reserve(${body.runId}::uuid,${lease}::uuid,${user.id}::uuid,${sessionId},${sql.json(savedPrompt as any)},${new TextEncoder().encode(prompt).length},${!!requestSpec.webSearch}) as result`;
    call = { id: reserved[0].result.callId, status: "reserved" };
    const providerBody: Record<string, unknown> = {
      model: current.config.model, reasoning: { effort: current.config.reasoningEffort }, service_tier: current.config.serviceTier,
      instructions: requestSpec.instructions, input: JSON.stringify(requestSpec.input), max_output_tokens: current.config.maxOutputTokens,
      text: { format: { type: "json_schema", name: `bivia_${requestSpec.stage}`, strict: true, schema: requestSpec.schema } },
      background: true, store: true,
    };
    // Each stage is isolated; blind playtesting never receives provider conversation history.
    if (requestSpec.webSearch) {
      providerBody.tools = [{ type: "web_search", ...(requestSpec.stage === "theology" ? { filters: { allowed_domains: ["ebible.org", "worldenglish.bible"] } } : {}) }];
      providerBody.max_tool_calls = current.config.maxToolCalls; providerBody.include = ["web_search_call.action.sources"];
    }
    dispatched = true;
    const created = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { ...providerHeaders, "X-Client-Request-Id": call.id }, body: JSON.stringify(providerBody), signal: AbortSignal.timeout(30000) });
    if (!created.ok) {
      const uncertain = created.status >= 500 || created.status === 408;
      await sql`select private.engine_record_call(${body.runId}::uuid,${lease}::uuid,${call.id}::uuid,${uncertain ? "uncertain" : "failed"},${sql.json({})},${`OpenAI request HTTP ${created.status}`})`;
      recorded = true;
      throw new Error(`OpenAI request returned HTTP ${created.status}.`);
    }
    providerResult = await created.json();
    await sql`select private.engine_provider_save(${body.runId}::uuid,${lease}::uuid,${call.id}::uuid,${sql.json(providerResult)})`;
    hasProviderId = true;
    return await release();
  } catch (error) {
    const message = (error as Error).message || "Generation stage failed.";
    if (lease) {
      try {
        // Once a provider ID exists, unexpected GET/persistence failures are resumable reads.
        if (hasProviderId && !recorded) return await release(message);
        if (call && dispatched && !recorded) await sql`select private.engine_record_call(${body.runId}::uuid,${lease}::uuid,${call.id}::uuid,'uncertain',${sql.json({})},'Provider creation outcome unknown. No automatic retry.' )`;
        const rows = await sql`select private.engine_finish(${body.runId}::uuid,${lease}::uuid,${user.id}::uuid,${sessionId},${sql.json(run?.state as any)},${message},${!!call && dispatched && !recorded}) as result`;
        await cleanup();
        return response(rows[0].result);
      } catch { return response({ error: "The stage result could not be persisted. Refresh the run; never automatically recreate a provider request." }, 503); }
    }
    return response({ error: message }, message.includes("administrator") ? 403 : 409);
  } finally { await sql.end({ timeout: 1 }); }
});
