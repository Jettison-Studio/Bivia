import test from 'node:test';
import assert from 'node:assert/strict';
import { initialQuizzes, parseQuestions, validate } from '../src/workspace';

test('sample drafts including mixed-topic quizzes are ready for review', () => {
  for (const quiz of initialQuizzes()) assert.deepEqual(validate(quiz), [], quiz.title);
});
test('publishing rejects ambiguous choices and missing biblical source', () => {
  const quiz = initialQuizzes()[0];
  quiz.questions[0].answers = ['Apple', ' apple ', 'Pear', 'Orange'];
  quiz.questions[0].reference = '';
  assert.equal(validate(quiz).length, 2);
});
test('untrusted JSON import rejects invalid answer keys and malformed arrays', () => {
  for (const data of [[], [{}], [{ prompt: 'Q', answers: ['A', 'B', 'C', 'D'], correctIndex: 4, hint: 'H', reference: 'R' }], 'questions']) {
    assert.throws(() => parseQuestions(JSON.stringify(data)));
  }
});
test('import allocates independent IDs and preserves all editorial question fields', () => {
  const source = { prompt: 'Q', answers: ['A', 'B', 'C', 'D'], correctIndex: 2, hint: 'H', reference: 'R' };
  const rows = parseQuestions(JSON.stringify({ questions: [source, source] }));
  assert.notEqual(rows[0].id, rows[1].id);
  assert.equal(rows[0].correctIndex, 2);
  assert.equal(rows[0].reference, 'R');
});

test('category identities and colors reject unsafe or ambiguous inputs', async () => {
  const { validateCategory } = await import('../src/categories');
  assert.deepEqual(validateCategory({ id: 'new-topic', name: 'New topic', color: '#5f00e6', icon: 'globe', sort_order: 1 }), []);
  assert.equal(validateCategory({ id: 'New topic!', name: '', color: 'red', icon: '', sort_order: 1.5 }).length, 5);
});
