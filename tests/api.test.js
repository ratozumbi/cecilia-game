import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createApp } from '../server/app.js';

async function serve(t, options) {
  const server = createApp(options).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('a API pública entrega a história sem sinalizadores internos', async t => {
  const base = await serve(t);
  const response = await fetch(base + '/api/story');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('referrer-policy'), 'same-origin');
  const story = await response.json();
  assert.ok(story.nodes.some(node => node.type === 'background'));
  assert.ok(story.nodes.some(node => node.type === 'question'));
  for (const node of story.nodes.filter(node => node.type === 'question')) {
    for (const option of node.options) {
      assert.equal('correct' in option, false);
      assert.equal('save' in option, false);
    }
  }
});

test('a verificação de funcionamento retorna somente ok', async t => {
  const base = await serve(t);
  const response = await fetch(base + '/api/health');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test('rotas de gravação e rotas desconhecidas não existem', async t => {
  const base = await serve(t);
  for (const path of ['/api/characters', '/api/answers', '/api/desconhecida']) {
    for (const body of ['{}', '{', JSON.stringify({ text: 'x'.repeat(9000) })]) {
      const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://outro.invalid' }, body });
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: 'Rota da API não encontrada.' });
    }
  }
  assert.equal((await fetch(base + '/api/desconhecida')).status, 404);
});

test('arquivos privados nunca são publicados', async t => {
  const base = await serve(t);
  for (const path of ['/.env', '/script.md', '/server/app.js', '/data/cecilia.sqlite', '/supabase/schema.sql', '/tests/api.test.js', '/.git/config', '/copia.sqlite-wal', '/%ZZ']) {
    assert.ok((await fetch(base + path)).status >= 400, path);
  }
});

test('erros de leitura e análise da história não revelam detalhes internos', async t => {
  const dir = await mkdtemp(join(process.env.TMPDIR, 'cecilia-api-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const storyPath = join(dir, 'historia.md');
  const base = await serve(t, { storyPath });
  let response = await fetch(base + '/api/story');
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Não foi possível carregar a história.' });
  await writeFile(storyPath, '@diretiva-interna-secreta');
  response = await fetch(base + '/api/story');
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Não foi possível carregar a história.' });
});