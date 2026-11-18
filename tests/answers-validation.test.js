import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

test('uses story-owned flags and rejects invalid or stale answer submissions', async () => {
  const { validateAnswers } = await import('../server/validation.js');
  const story = { version: 'v1', nodes: [{ type: 'question', id: 'q', min: 1, max: 2, options: [{ id: 'a', text: 'A', save: true, correct: true }, { id: 'b', text: 'B', save: false, correct: null }, { id: 'c', text: 'C', save: true, correct: null }] }] };
  const body = { sessionId: randomUUID(), storyVersion: 'v1', questionId: 'q', optionIds: ['a', 'b'] };
  const result = validateAnswers(body, story);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].option_id, 'a');
  assert.equal(result.rows[0].correct, true);
  assert.equal(validateAnswers({ ...body, optionIds: ['c'] }, story).rows[0].correct, null);
  assert.equal(validateAnswers({ ...body, optionIds: ['b'] }, story).rows.length, 0);
  assert.throws(() => validateAnswers({ ...body, storyVersion: 'old' }, story), e => e.status === 409);
  for (const optionIds of [[], ['a', 'a'], ['unknown'], ['a', 'b', 'c'], 'a']) assert.throws(() => validateAnswers({ ...body, optionIds }, story), e => e.status === 400);
  assert.throws(() => validateAnswers({ ...body, correct: true }, story), e => e.status === 400);
});
