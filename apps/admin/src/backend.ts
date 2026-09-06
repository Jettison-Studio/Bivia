import { createClient } from '@supabase/supabase-js';
import type { EditorialCategory } from './categories';
import type { EditorialQuiz } from './workspace';
type BackendQuestion = { id: string; prompt: string; options: string[]; correct_index: number; hint: string; hint_reference: string; explanation: string };
type BackendQuiz = { mode: EditorialQuiz['mode']; id: string; title: string; description: string; category_id: string; publish_at: string; updated_at?: string; status: string; questions: BackendQuestion[] };
const env = import.meta.env;
export const backend = env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { storageKey: 'bivia.admin.auth' } }) : null;
export type DailySlot = { id: string; edition_day: string; mode: EditorialQuiz["mode"]; category_id: string | null; quiz_id: string };
export async function loadContent(): Promise<{ dailyRounds: DailySlot[]; quizzes: EditorialQuiz[]; categories: EditorialCategory[] }> {
  if (!backend) throw new Error('Backend is not configured.');
  const permission = await backend.rpc('bivia_is_admin_v1');
  if (permission.error) throw permission.error;
  if (permission.data !== true) throw new Error('This account does not have editorial access. Ask your project administrator to grant the admin role.');
  const { data, error } = await backend.rpc('bivia_admin_v1', { p_action: 'list', p_payload: {} });
  if (error) throw error;
  return { dailyRounds: data.dailyRounds ?? [], categories: data.categories, quizzes: (data.quizzes ?? []).filter((q: BackendQuiz) => q.status !== 'archived').map((q: BackendQuiz) => ({ id: q.id, title: q.title, subtitle: q.description ?? '', categoryId: q.category_id, mode: q.mode ?? 'category', publishedAt: q.publish_at ?? '', scheduledAt: q.publish_at ? toLocalInput(q.publish_at) : '', updatedAt: q.updated_at ?? '', status: q.status === 'published' ? (q.publish_at && new Date(q.publish_at) > new Date() ? 'scheduled' : 'published') : 'draft', questions: (q.questions ?? []).map((question: BackendQuestion) => ({ id: question.id, prompt: question.prompt, answers: question.options, correctIndex: question.correct_index, hint: question.hint, reference: question.hint_reference, explanation: question.explanation })) })) };
}
function toLocalInput(value: string): string { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
export async function saveContent(quiz: EditorialQuiz, replaceDaily = false): Promise<string> {
  if (!backend) throw new Error('Backend is not configured.');
  const { data, error } = await backend.rpc('bivia_admin_v1', { p_action: 'save_quiz', p_payload: { id: quiz.id, mode: quiz.mode, replace_daily: replaceDaily, category_id: quiz.categoryId, title: quiz.title, description: quiz.subtitle, status: quiz.status === 'draft' ? 'draft' : 'published', publish_at: quiz.status === 'scheduled' ? new Date(quiz.scheduledAt).toISOString() : quiz.status === 'published' ? new Date().toISOString() : null, questions: quiz.questions.map(q => ({ prompt: q.prompt, options: q.answers, correct_index: q.correctIndex, hint: q.hint, hint_reference: q.reference, explanation: q.explanation ?? '' })) } });
  if (error) throw error;
  return data.id;
}

export async function saveBackendCategory(category: EditorialCategory): Promise<void> {
  if (!backend) throw new Error('Backend is not configured.');
  const { error } = await backend.rpc('bivia_admin_v1', { p_action: 'save_category', p_payload: { ...category, description: category.description ?? '', sort_order: category.sort_order ?? 0 } });
  if (error) throw error;
}
