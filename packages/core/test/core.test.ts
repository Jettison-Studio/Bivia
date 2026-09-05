import assert from 'node:assert/strict';
import test from 'node:test';
import { categories, quizzes, scoreAnswer, timeLimit, validateQuiz } from '../src/index';

test('practice scoring preserves the original speed bonus and wrong-answer penalties', () => {
  assert.equal(scoreAnswer(0, 0), 3);
  assert.equal(scoreAnswer(0, 29.999), 3);
  assert.equal(scoreAnswer(0, 30), 2);
  assert.equal(scoreAnswer(1, 12), 2);
  assert.equal(scoreAnswer(1, 31), 1);
  assert.equal(scoreAnswer(2, 31), 0);
  assert.equal(scoreAnswer(12, 80), 0);
});

test('invalid scoring inputs cannot inflate results or produce NaN', () => {
  assert.equal(scoreAnswer(Number.NaN, 0), 0);
  assert.equal(scoreAnswer(0, Infinity), 0);
  assert.equal(scoreAnswer(-2, -10), 3);
  for (let errors = -5; errors < 20; errors += 1) {
    for (const seconds of [0, 10, 30, 1000]) {
      const score = scoreAnswer(errors, seconds);
      assert.ok(Number.isInteger(score) && score >= 0 && score <= 3);
    }
  }
});

test('timed questions accelerate to 2.5 seconds while other modes retain the 30-second bonus', () => {
  assert.deepEqual(Array.from({ length: 10 }, (_, i) => timeLimit('timed', i)), [30, 25, 20, 15, 10, 5, 2.5, 2.5, 2.5, 2.5]);
  assert.equal(timeLimit('category', 19), 30);
  assert.equal(timeLimit('challenger', 19), 30);
  assert.equal(timeLimit('timed', -1), 30);
  assert.equal(timeLimit('timed', Number.NaN), 30);
});

test('sample library supplies six complete categories, a timed quiz, and a challenger', () => {
  assert.equal(categories.length, 6);
  assert.equal(new Set(categories.map(category => category.id)).size, 6);
  assert.equal(quizzes.filter(quiz => quiz.mode === 'category').length, 6);
  for (const category of categories) {
    const quiz = quizzes.find(quiz => quiz.categoryId === category.id);
    assert.equal(quiz?.questions.length, 5);
  }
  assert.equal(quizzes.find(quiz => quiz.mode === 'timed')?.questions.length, 10);
  assert.equal(quizzes.find(quiz => quiz.mode === 'challenger')?.questions.length, 20);
  for (const quiz of quizzes) assert.deepEqual(validateQuiz(quiz), [], quiz.id);
});

test('authoring validation rejects blank content, duplicate options, invalid keys, and repeated IDs', () => {
  const original = quizzes[0]!;
  const invalid = {
    ...original,
    title: ' ',
    publishedAt: 'not a date',
    questions: [
      { ...original.questions[0], prompt: '', hint: '', reference: '', answers: ['A', ' a ', 'B', 'C'], correctIndex: 4 },
      { ...original.questions[0] },
    ],
  };
  const errors = validateQuiz(invalid);
  for (const text of ['title', 'date', 'prompt', 'distinct', 'correct answer', 'hint', 'reference', 'unique']) {
    assert.ok(errors.some(error => error.includes(text)), `Missing ${text} error`);
  }
});

test('authoring validation handles malformed runtime payloads without throwing', () => {
  for (const input of [null, undefined, false, [], 'quiz', {}, { questions: [null] }, { ...quizzes[0], questions: [{ answers: null }] }]) {
    assert.ok(validateQuiz(input).length > 0);
  }
});
