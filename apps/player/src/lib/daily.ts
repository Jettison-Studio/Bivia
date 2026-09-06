import type { Mode } from '@bivia/core';
import { rpc } from './supabase';
import type { Catalog, RankedAttempt } from './remote';
export interface DailyRound {
  id: string; quizId: string; categoryId: string | null; mode: Mode;
  title: string; questionCount: number; attemptId: string | null;
  status: 'unplayed' | 'active' | 'completed'; score: number | null;
}
export interface DailyCatalog {
  day: string; serverNow: string; nextDayAt: string;
  categories: Catalog['categories']; rounds: DailyRound[];
}
export const listDaily = () => rpc<DailyCatalog>('bivia_daily_catalog_v1');
export const startDaily = (id: string) => rpc<RankedAttempt>('bivia_start_daily_v1', {p_round_id:id});
export function dailyLabel(round?: DailyRound, loading = false, error = false) {
  if (loading) return 'Loading…';
  if (error) return 'Tap to retry';
  if (!round) return 'Coming soon';
  if (round.status === 'completed') return `${round.score ?? 0} pts · View results`;
  return round.status === 'active' ? 'Continue' : 'Play today';
}
