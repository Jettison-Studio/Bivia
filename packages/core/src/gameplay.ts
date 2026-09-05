import type { Mode, Quiz } from './types';

export const modeLabels: Record<Mode, string> = {
  category: 'Category trivia',
  timed: 'Timed trivia',
  challenger: 'Challenger',
};

/** Seconds until bonus ends, or timed mode expires. Index is zero-based. */
export function timeLimit(mode: Mode, index = 0): number {
  if (mode !== 'timed') return 30;
  const safeIndex = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  return [30, 25, 20, 15, 10, 5, 2.5][Math.min(safeIndex, 6)]!;
}

/** Practice scoring only. Ranked results must be computed on the server. */
export function scoreAnswer(wrongCount: number, elapsedSeconds: number): number {
  // Malformed inputs must never manufacture extra points.
  if (!Number.isFinite(wrongCount) || !Number.isFinite(elapsedSeconds)) return 0;
  const mistakes = Math.max(0, Math.floor(wrongCount));
  const speedPenalty = Math.max(0, elapsedSeconds) >= 30 ? 1 : 0;
  return Math.max(0, 3 - mistakes - speedPenalty);
}

/** Client-side authoring feedback; server validation is independently required. */
export function validateQuiz(value: unknown): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['Quiz must be an object.'];
  const quiz = value as Partial<Quiz>;
  const text = (input: unknown) => typeof input === 'string' && input.trim().length > 0;
  if (!text(quiz.id)) errors.push('Quiz ID is required.');
  if (!text(quiz.title)) errors.push('Quiz title is required.');
  if (!text(quiz.subtitle)) errors.push('Quiz subtitle is required.');
  if (!text(quiz.categoryId)) errors.push('Choose a category.');
  if (!['category', 'timed', 'challenger'].includes(quiz.mode ?? '')) errors.push('Choose a supported game mode.');
  if (!text(quiz.publishedAt) || !Number.isFinite(Date.parse(quiz.publishedAt ?? ''))) errors.push('Publication date must be valid.');
  if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
    errors.push('Add at least one question.');
    return errors;
  }
  const ids = new Set<string>();
  quiz.questions.forEach((question, index) => {
    const prefix = `Question ${index + 1}: `;
    if (!question || typeof question !== 'object') {
      errors.push(`${prefix}must be an object.`);
      return;
    }
    if (!text(question.id)) errors.push(`${prefix}ID is required.`);
    else if (ids.has(question.id)) errors.push(`${prefix}ID must be unique within the quiz.`);
    else ids.add(question.id);
    if (!text(question.prompt)) errors.push(`${prefix}prompt is required.`);
    const answers = question.answers;
    if (!Array.isArray(answers) || answers.length !== 4 || answers.some(answer => !text(answer))) {
      errors.push(`${prefix}provide four nonempty answers.`);
    } else if (new Set(answers.map(answer => answer.trim().toLowerCase())).size !== answers.length) {
      errors.push(`${prefix}answer choices must be distinct.`);
    }
    if (!Number.isInteger(question.correctIndex) || question.correctIndex < 0 || !Array.isArray(answers) || question.correctIndex >= answers.length) {
      errors.push(`${prefix}select a valid correct answer.`);
    }
    if (!text(question.hint)) errors.push(`${prefix}Bible hint is required.`);
    if (!text(question.reference)) errors.push(`${prefix}Bible reference is required.`);
  });
  return errors;
}
