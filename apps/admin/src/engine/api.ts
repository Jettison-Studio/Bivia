import type { EngineState } from "../../../../supabase/functions/_shared/trivia-types";
import type { RoundBrief } from "./brief";
import { backend } from "../backend";
export type Decision = {
  candidateId: string;
  revision: number;
  decision: "approved" | "rejected";
  reason: string;
  decidedAt: string;
};
export type RunUsage = {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  webSearchCalls: number;
  estimatedCostUsd: number;
  reservedCostUsd: number;
  budgetCommittedUsd: number;
};
export type EngineRun = {
  id: string;
  title: string;
  usage: RunUsage;
  status:
    | "queued"
    | "running"
    | "review"
    | "failed"
    | "uncertain"
    | "exported"
    | "cancelled";
  version: number;
  state: EngineState;
  config: Record<string, unknown>;
  decisions: Decision[];
  calls: Record<string, unknown>[];
  audit: Record<string, unknown>[];
  createdAt: string;
  updatedAt: string;
  exportedQuizId: string | null;
  leaseExpiresAt: string | null;
  lastError: string | null;
};
export type RunSummary = Pick<
  EngineRun,
  "id" | "status" | "createdAt" | "updatedAt"
> & {
  archived?: boolean;
  title?: string;
  callCount?: number;
  estimatedCostUsd?: number;
  reservedCostUsd?: number;
  brief?: RoundBrief;
  nextStage?: string | null;
  exportedQuizId?: string | null;
  lastError?: string | null;
};
export type Passage = {
  id: string;
  reference: string;
  text: string;
  translation: "NIV";
  verified: boolean;
  rightsAttested: boolean;
  aiUseAttested: boolean;
  rightsNote: string;
  sourceUrl: string;
  context: string;
};
export async function engineRpc<T>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  if (!backend) throw new Error("The content service is not configured.");
  const { data, error } = await backend.rpc("bivia_engine_v1", {
    p_action: action,
    p_payload: payload,
  });
  if (error) throw new Error(error.message);
  return data as T;
}
export class EngineRequestError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "EngineRequestError";
  }
}
export async function runStage(run: EngineRun): Promise<EngineRun> {
  if (!backend) throw new Error("The content service is not configured.");
  const { data, error } = await backend.functions.invoke("trivia-engine", {
    body: { runId: run.id, expectedVersion: run.version },
  });
  if (error) {
    let message = error.message;
    const status =
      error.context instanceof Response ? error.context.status : undefined;
    if (error.context instanceof Response) {
      try {
        const body = await error.context.json();
        message = body.error ?? body.message ?? message;
      } catch {
        /* Keep the HTTP error when response is not JSON. */
      }
    }
    throw new EngineRequestError(message, status);
  }
  if (!data || typeof data.id !== "string" || !data.state)
    throw new Error(
      "The engine returned an unexpected response. Refresh the saved run before continuing.",
    );
  return data as EngineRun;
}
