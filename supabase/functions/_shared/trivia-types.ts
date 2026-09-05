export type Stage = 'plan' | 'write' | 'accuracy' | 'theology' | 'clues' | 'playtest' | 'assemble';
export type ReviewStage = 'accuracy' | 'theology' | 'clues' | 'playtest';
export type Brief = {
  kind: 'category' | 'progressive' | 'timed';
  categoryIds: string[];
  count: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'rising';
  translation: 'NIV';
  notes: string;
  sourceMode: 'references' | 'licensed_niv';
};
/** Server-selected history is calibration data, never executable instructions. */
export type EditorialContext = {
  recentQuestions: string[];
  examples: { prompt: string; hint: string; reference: string; decision: 'accepted' | 'rejected'; reason: string }[];
};
/** Supplied only by the trusted server after rights/verification checks. */
export type ApprovedPassage = {
  id: string;
  reference: string;
  text: string;
  translation: 'NIV';
  verified: true;
  rightsApproved: true;
  aiRightsApproved: true;
};
/** URLs must be extracted from provider tool sources/citations, never model JSON. */
export type Source = { url: string; title: string; kind: 'citation' | 'web_search' };
export type Candidate = {
  id: string;
  revision: number;
  categoryId: string;
  subtopic: string;
  prompt: string;
  answers: [string, string, string, string];
  correctIndex: number;
  hint: string;
  reference: string;
  passageId: string | null;
  connectionExplanation: string;
  factDifficulty: number;
  clueDifficulty: number;
  estimatedSeconds: number;
  sources: Source[];
};
export type PlanSlot = {
  id: string;
  categoryId: string;
  subtopic: string;
  factDifficulty: number;
  clueDifficulty: number;
  targetSeconds: number;
};
export type AccuracyReview = {
  candidateId: string;
  verdict: 'pass' | 'repair' | 'reject';
  score: number;
  reasons: string[];
  evidenceUrls: string[];
  verifiedCorrectIndex: number;
  estimatedFactDifficulty: number;
  unambiguous: boolean;
  primarySource: boolean;
};
export type TheologyReview = {
  candidateId: string;
  verdict: 'pass' | 'repair' | 'reject';
  score: number;
  reasons: string[];
  evidenceUrls: string[];
  contextFaithful: boolean;
  paraphraseSafe: boolean;
  primarySource: boolean;
  doctrineRisk: 'low' | 'medium' | 'high';
};
export type ClueReview = {
  candidateId: string;
  verdict: 'pass' | 'repair' | 'reject';
  score: number;
  reasons: string[];
  fair: boolean;
  givesAwayAnswer: boolean;
  answerSupported: boolean;
  estimatedDifficulty: number;
};
export type PlaytestReview = {
  candidateId: string;
  answerIndex: number;
  confidence: number;
  estimatedSeconds: number;
  reasoning: string;
  ambiguous: boolean;
};
export type CandidateReviews = {
  accuracy?: AccuracyReview;
  theology?: TheologyReview;
  clues?: ClueReview;
  playtest?: PlaytestReview;
};
export type ModelRequest = {
  stage: Exclude<Stage, 'assemble'>;
  instructions: string;
  input: unknown;
  schema: Record<string, unknown>;
  webSearch?: boolean;
};
export type ModelMetadata = {
  model: string;
  responseId?: string;
  inputTokens: number;
  outputTokens: number;
  webSearchCalls: number;
  sources: Source[];
};
export type ModelResponse = { data: unknown; metadata: ModelMetadata };
export type CallModel = (request: ModelRequest) => Promise<ModelResponse>;
export type StageRecord = {
  stage: Exclude<Stage, 'assemble'>;
  promptVersion: string;
  request: ModelRequest;
  metadata: ModelMetadata;
  output: unknown;
};
export type Assembly = {
  selectedIds: string[];
  rejected: { candidateId: string; reasons: string[] }[];
  shortfall: number;
  reasons: string[];
  /** Machine checks passed; a human must still approve before publication. */
  requiresHumanApproval: true;
};
export type EngineState = {
  version: string;
  brief: Brief;
  editorialContext: EditorialContext;
  nextStage: Stage | null;
  status: 'running' | 'ready' | 'shortfall';
  plan: PlanSlot[];
  candidates: Candidate[];
  reviews: Record<string, CandidateReviews>;
  records: StageRecord[];
  repairIds: string[];
  repairReason?: string;
  repairContext: Record<string, CandidateReviews>;
  repairCycles: number;
  approvedPassages: ApprovedPassage[];
  assembly: Assembly | null;
};
