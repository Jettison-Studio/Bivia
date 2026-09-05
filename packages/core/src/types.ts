export type Mode = 'category' | 'timed' | 'challenger';

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

/** Public answer keys belong to local practice content only. */
export interface Question {
  id: string;
  prompt: string;
  answers: string[];
  correctIndex: number;
  hint: string;
  reference: string;
}

export interface Quiz {
  id: string;
  title: string;
  subtitle: string;
  categoryId: string;
  mode: Mode;
  questions: Question[];
  publishedAt: string;
}

/** A local practice result. Never trust this client shape as a ranked score. */
export interface Result {
  id: string;
  quizId: string;
  score: number;
  correct: number;
  total: number;
  completedAt: string;
  mode: Mode;
}
