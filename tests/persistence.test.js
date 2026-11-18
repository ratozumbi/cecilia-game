import test from 'node:test';
import assert from 'node:assert/strict';
import { createPersistence, STORAGE_KEY } from '../src/persistence.js';

const config = { url: 'https://projeto.supabase.co', publishableKey: 'sb_publishable_teste' };
const character = { name: 'Ana', age: 24, sex: 'female' };
const answer = { storyVersion: 'v1', questionId: 'coffee', optionIds: ['tea'] };
const memory = () => { const values = new Map(); return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }; };
const ok = result => ({ ok: true, status: 200, json: async () => result });

test('email acompanha novas partidas e mantém a identidade original dos envios pendentes', async () => {
  const storage = memory(), calls = [];
  const first = createPersistence({ storage, config, email: 'ana+teste@example.com', log() {}, fetch: async () => ({ ok: false, status: 503 }) });
  first.beginCharacter(character); first.recordAnswer(answer); await first.flush();
  const saves = createPersistence({ storage, config, email: 'outra@example.com', log() {}, fetch: async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) }); return ok({ status: 'saved' });
  } });
  saves.beginCharacter(character); saves.recordAnswer(answer); await saves.flush();
  saves.restart(); saves.beginCharacter(character); saves.recordAnswer(answer); await saves.flush();
  const characters = calls.filter(call => call.url.endsWith('save_game_character')).map(call => call.body);
  assert.deepEqual(characters.map(body => body.p_email), ['ana+teste@example.com', 'outra@example.com', 'outra@example.com']);
  assert.equal(new Set(characters.map(body => body.p_session_id)).size, 3);
  for (const call of calls.filter(call => call.url.endsWith('save_game_answer'))) {
    assert.ok(characters.some(body => body.p_session_id === call.body.p_session_id));
  }
});

test('envia personagem antes de respostas e mantém dados de estado somente no console', async () => {
  const calls = [], logs = [], storage = memory();
  const saves = createPersistence({ storage, config, log: (...args) => logs.push(args), fetch: async (url, options) => {
    calls.push({ url, headers: options.headers, body: JSON.parse(options.body) });
    return ok({ status: 'saved', recorded: 1 });
  } });
  saves.beginCharacter(character);
  saves.recordAnswer(answer);
  await saves.flush();
  assert.deepEqual(calls.map(call => call.url), [`${config.url}/rest/v1/rpc/save_game_character`, `${config.url}/rest/v1/rpc/save_game_answer`]);
  assert.equal(calls[0].headers.apikey, config.publishableKey);
  assert.equal(calls[0].headers.Authorization, undefined);
  assert.equal(calls[0].body.p_name, 'Ana');
  assert.deepEqual(calls[1].body.p_option_ids, ['tea']);
  assert.equal(calls[0].body.p_session_id, calls[1].body.p_session_id);
  assert.equal(calls[0].body.p_token, calls[1].body.p_token);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).length, 0);
  assert.ok(logs.some(([label]) => label === 'Envio concluído:'));
  assert.ok(!JSON.stringify(logs).includes(calls[0].body.p_token));
});

test('uma falha mantém a fila após recarregar e reenvia com a mesma identidade', async () => {
  const storage = memory(), sent = [];
  const first = createPersistence({ storage, config, log() {}, fetch: async (url, options) => {
    sent.push(JSON.parse(options.body)); return { ok: false, status: 503 };
  } });
  first.beginCharacter(character);
  first.recordAnswer(answer);
  await first.flush();
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).length, 2);
  const second = createPersistence({ storage, config, log() {}, fetch: async (url, options) => {
    sent.push(JSON.parse(options.body)); return ok({ status: 'saved', recorded: 1 });
  } });
  await second.flush();
  assert.deepEqual(sent[0], sent[1]);
  assert.equal(sent[1].p_token, sent[2].p_token);
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), []);
});

test('a mesma execução envia respostas adicionadas durante uma gravação em andamento', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const calls = [], saves = createPersistence({ storage: memory(), config, log() {}, fetch: async (url, options) => {
    calls.push(JSON.parse(options.body));
    if (calls.length === 1) await gate;
    return ok({ status: 'saved' });
  } });
  saves.beginCharacter(character);
  const task = saves.flush();
  saves.recordAnswer(answer);
  assert.equal(saves.flush(), task);
  release(); await task;
  assert.equal(calls.length, 2);
  assert.equal(calls[1].p_question_id, 'coffee');
});

test('personagem recusado bloqueia suas respostas sem impedir uma nova partida', async () => {
  let fail = true;
  const storage = memory(), calls = [];
  const saves = createPersistence({ storage, config, log() {}, fetch: async (url, options) => {
    calls.push(JSON.parse(options.body)); return fail ? { ok: false, status: 400 } : ok({ status: 'saved' });
  } });
  saves.beginCharacter(character); saves.recordAnswer(answer); await saves.flush();
  assert.equal(calls.length, 1);
  fail = false; saves.restart(); saves.beginCharacter(character); saves.recordAnswer(answer); await saves.flush();
  assert.equal(calls.length, 3);
  assert.notEqual(calls[0].p_session_id, calls[1].p_session_id);
  assert.equal(calls[1].p_session_id, calls[2].p_session_id);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).length, 2);
});

test('armazenamento negado ou corrompido não interrompe o jogo nem uma resposta de banco inválida perde dados', async () => {
  for (const storage of [undefined, { getItem() { throw Error(); }, setItem() { throw Error(); } }, { getItem: () => '{', setItem() {} }]) {
    let valid = false;
    const logs = [], calls = [];
    const saves = createPersistence({ storage, config, log: (...args) => logs.push(args), fetch: async (url, options) => {
      calls.push(JSON.parse(options.body)); return ok(valid ? { status: 'saved' } : { status: 'unexpected' });
    } });
    saves.beginCharacter(character); await saves.flush();
    valid = true; await saves.flush();
    assert.deepEqual(calls[0], calls[1]);
    assert.ok(logs.some(([label]) => label.startsWith('Envio adiado:')));
  }
});

test('configuração só aceita chave publicável e permite nova tentativa após erro', async () => {
  const storage = memory(), calls = [];
  let valid = false;
  const saves = createPersistence({ storage, log() {}, fetch: async (url, options) => {
    calls.push(url);
    if (url === '/backend.json') return ok({ ...config, publishableKey: valid ? config.publishableKey : 'sb_secret_NAO_PUBLICAR' });
    return ok({ status: 'saved' });
  } });
  saves.beginCharacter(character); await saves.flush();
  assert.deepEqual(calls, ['/backend.json']);
  valid = true; await saves.flush();
  assert.equal(calls.length, 3);
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), []);
});
