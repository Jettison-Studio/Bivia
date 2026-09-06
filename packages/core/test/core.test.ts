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

test('timed questions accelerate gradually with a readable 15-second floor while other modes retain the 30-second bonus', () => {
  assert.deepEqual(Array.from({ length: 10 }, (_, i) => timeLimit('timed', i)), [30, 28, 26, 24, 22, 20, 18, 16, 15, 15]);
  assert.equal(timeLimit('category', 19), 30);
  assert.equal(timeLimit('challenger', 19), 30);
  assert.equal(timeLimit('timed', 100), 15);
  assert.equal(timeLimit('timed', 1.9), 28);
  assert.equal(timeLimit('timed', -1), 30);
  assert.equal(timeLimit('timed', Number.NaN), 30);
});

test('public practice library contains only the reviewed NIV guest round', () => {
  assert.equal(quizzes.length, 1);
  assert.equal(quizzes[0].id, 'guest-niv-day-one');
  assert.equal(quizzes[0].questions.length, 5);
  for (const question of quizzes[0].questions) assert.ok(question.reference.endsWith(' · NIV'));
  assert.deepEqual(validateQuiz(quizzes[0]), []);
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
