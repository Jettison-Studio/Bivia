import { categories, type Quiz, type Question } from '@bivia/core';

export type EditorialQuiz = Omit<Quiz, 'questions'> & { questions: (Question & { explanation?: string })[]; status: 'draft' | 'scheduled' | 'published'; scheduledAt: string; updatedAt: string };
export const storageKey = 'bivia.editorial.v1';
export function blankQuestion(): Question { return { id: crypto.randomUUID(), prompt: '', answers: ['', '', '', ''], correctIndex: 0, hint: '', reference: '' }; }
export function blankQuiz(): EditorialQuiz { return { id: crypto.randomUUID(), title: '', subtitle: '', categoryId: categories[0]?.id ?? '', mode: 'category', questions: [blankQuestion()], publishedAt: '', status: 'draft', scheduledAt: '', updatedAt: new Date().toISOString() }; }
export function initialQuizzes(): EditorialQuiz[] { return []; }
export function validate(quiz: EditorialQuiz): string[] {
  const errors: string[] = [];
  if (!quiz.title.trim()) errors.push('Give your quiz a title.');
  if (quiz.categoryId !== 'mixed' && !categories.some(c => c.id === quiz.categoryId)) errors.push('Choose a category.');
  if (!quiz.questions.length) errors.push('Add at least one question.');
  quiz.questions.forEach((q, i) => {
    const label = `Question ${i + 1}`;
    if (!q.prompt.trim()) errors.push(`${label}: enter the question.`);
    if (q.answers.length !== 4 || q.answers.some(a => !a.trim())) errors.push(`${label}: fill in all four answers.`);
    if (new Set(q.answers.map(a => a.trim().toLowerCase())).size !== 4) errors.push(`${label}: answers must be distinct.`);
    if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 3) errors.push(`${label}: select the correct answer.`);
    if (!q.hint.trim() || !q.reference.trim()) errors.push(`${label}: add a Bible hint and reference.`);
  });
  return errors;
}
export function parseQuestions(text: string): Question[] {
  const data: unknown = JSON.parse(text);
  const rows = Array.isArray(data) ? data : (data && typeof data === 'object' && 'questions' in data ? data.questions : null);
  if (!Array.isArray(rows) || !rows.length || rows.length > 100) throw new Error('Import an array of 1–100 questions, or an object with a questions array.');
  return rows.map((value, index) => {
    if (!value || typeof value !== 'object') throw new Error(`Question ${index + 1} must be an object.`);
    const q = value as Record<string, unknown>;
    if (typeof q.prompt !== 'string' || !Array.isArray(q.answers) || q.answers.length !== 4 || !q.answers.every(a => typeof a === 'string') || typeof q.correctIndex !== 'number' || !Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 3 || typeof q.hint !== 'string' || typeof q.reference !== 'string') throw new Error(`Question ${index + 1} needs prompt, four answers, correctIndex (0–3), hint, and reference.`);
    return { id: crypto.randomUUID(), prompt: q.prompt, answers: q.answers as string[], correctIndex: q.correctIndex, hint: q.hint, reference: q.reference };
  });
}
// Legacy browser drafts are intentionally no longer loaded into the connected builder.
export function loadWorkspace(): { quizzes: EditorialQuiz[]; error: string } { return { quizzes: [], error: '' }; }
export function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
}
