import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const sessionId = randomUUID();

test('validates adult character data and normalizes whitespace', async () => {
  const { validateCharacter } = await import('../server/validation.js');
  assert.deepEqual(validateCharacter({ sessionId, name: '  Alex  ', sex: 'other', age: 24 }), { sessionId, name: 'Alex', sex: 'other', age: 24 });
  for (const values of [{ age: 17 }, { age: 121 }, { age: 22.5 }, { age: '25' }, { name: '' }, { name: 'x'.repeat(61) }, { sex: 'invalid' }, { sessionId: 'not-a-uuid' }]) {
    assert.throws(() => validateCharacter({ sessionId, name: 'Alex', sex: 'female', age: 24, ...values }), error => error.status === 400);
  }
});
