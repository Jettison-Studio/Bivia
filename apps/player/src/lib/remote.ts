import type { Mode } from "@bivia/core";
import { rpc } from "./supabase";

export interface Catalog {
  categories: {
    id: string;
    name: string;
    icon: string;
    color: string;
    description: string;
    sort_order: number;
  }[];
  quizzes: {
    id: string;
    category_id: string;
    title: string;
    description: string;
    status: string;
    publish_at: string;
    created_at: string;
    question_count: number;
  }[];
}
export interface RankedQuestion {
  id: string;
  prompt: string;
  options: string[];
  hint: string;
  hintReference: string;
  selectedIndexes: number[];
}
export interface RankedFeedback {
  correct: boolean;
  resolved: boolean;
  timedOut: boolean;
  pointsAwarded: number;
  selectedIndexes: number[];
  questionId: string;
  correctIndex?: number;
  explanation?: string;
}
export interface RankedAttempt {
  id: string;
  quizId: string;
  mode: Mode;
  ranked: boolean;
  score: number;
  wrongCount: number;
  status: "active" | "completed";
  questionIndex: number;
  questionCount: number;
  questionStartedAt: string;
  deadlineAt: string | null;
  serverNow: string;
  question: RankedQuestion | null;
  feedback?: RankedFeedback;
}
export interface AnswerRequest {
  attemptId: string;
  questionId: string;
  optionIndex: number;
  requestId: string;
}

export const listCatalog = () => rpc<Catalog>("bivia_catalog_v1");
export const startAttempt = (quizId: string, mode: Mode = "category") =>
  rpc<RankedAttempt>("bivia_start_attempt_v1", {
    p_quiz_id: quizId,
    p_mode: mode,
    p_ranked: true,
  });
export const getAttempt = (attemptId: string) =>
  rpc<RankedAttempt>("bivia_attempt_v1", { p_attempt_id: attemptId });
/** Keep requestId and all other fields identical when retrying an uncertain response. */
export const submitAnswer = (request: AnswerRequest) =>
  rpc<RankedAttempt>("bivia_answer_v1", {
    p_attempt_id: request.attemptId,
    p_question_id: request.questionId,
    p_option_index: request.optionIndex,
    p_request_id: request.requestId,
  });
