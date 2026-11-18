import test from 'node:test';
import assert from 'node:assert/strict';
import { publicationSql, confirmationSql, projectRef } from '../scripts/publish-database.js';

test('publicação usa somente o projeto configurado e escapa o roteiro como dados', () => {
  assert.equal(projectRef('https://abcdefghijklmnopqrst.supabase.co'), 'abcdefghijklmnopqrst');
  for (const url of ['https://evil.test', 'https://abcdefghijklmnopqrst.supabase.co/extra', 'http://abcdefghijklmnopqrst.supabase.co']) assert.throws(() => projectRef(url));
  const story = { version: 'a'.repeat(64), nodes: [{ text: "Cecilia: O'Brien; DROP TABLE characters;", type: 'dialogue' }] };
  const sql = publicationSql('-- esquema', story);
  assert.ok(sql.startsWith('-- esquema'));
  assert.ok(sql.includes("O''Brien; DROP TABLE characters;"));
  assert.ok(sql.includes('INSERT INTO public.game_stories'));
  assert.ok(sql.includes('ON CONFLICT (version)'));
  assert.ok(confirmationSql(story).includes('nodes ='));
  assert.throws(() => publicationSql('', { version: "';DELETE", nodes: [] }));
});
