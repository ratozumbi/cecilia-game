import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

const oldSession = '11111111-1111-4111-8111-111111111111';
const session = randomUUID(), token = randomUUID();
const hash = value => createHash('sha256').update(value).digest('hex');
const nodes = [
  { type: 'question', id: 'single', mode: 'single', min: 1, max: 1, options: [
    { id: 'yes', text: 'Canonical yes', save: true, correct: true },
    { id: 'no', text: 'Canonical no', save: false, correct: false }] },
  { type: 'question', id: 'multi', mode: 'multiple', min: 2, max: 3, options: [
    { id: 'a', text: 'Canonical A', save: true, correct: false },
    { id: 'b', text: 'Canonical B', save: true, correct: null },
    { id: 'c', text: 'Canonical C', save: false, correct: true },
    { id: 'd', text: 'Canonical D', save: true, correct: true }] },
];

async function setup(existing = true) {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;`);
  if (existing) await db.exec(`
    CREATE TABLE public.characters(session_id uuid PRIMARY KEY, name text CHECK (char_length(btrim(name)) BETWEEN 1 AND 60), sex text CHECK (sex IN ('female','male','other','prefer_not_to_say')), age integer CHECK (age BETWEEN 18 AND 120), created_at timestamptz DEFAULT now());
    CREATE TABLE public.answers(session_id uuid REFERENCES public.characters(session_id) ON DELETE CASCADE, story_version text, question_id text, option_id text, option_text text, correct boolean, created_at timestamptz DEFAULT now(), PRIMARY KEY(session_id,story_version,question_id,option_id));
    CREATE TABLE public.submissions(session_id uuid REFERENCES public.characters(session_id) ON DELETE CASCADE, story_version text, question_id text, selection_hash text, PRIMARY KEY(session_id,story_version,question_id));
    INSERT INTO public.characters VALUES ('${oldSession}', 'Legacy', 'other', 25, '2020-01-01');
    INSERT INTO public.answers VALUES ('${oldSession}', 'old', 'old', 'old', 'Legacy answer', true, '2020-01-01');
    INSERT INTO public.submissions VALUES ('${oldSession}', 'old', 'old', 'legacy-hash');
    GRANT ALL ON public.characters, public.answers, public.submissions TO service_role;
    GRANT ALL ON public.characters, public.answers, public.submissions TO anon, authenticated;
    GRANT SELECT(name), UPDATE(name), INSERT(name) ON public.characters TO PUBLIC, anon, authenticated;
    CREATE FUNCTION public.save_answers() RETURNS text LANGUAGE sql AS $$ SELECT 'legacy'::text $$;
    REVOKE ALL ON FUNCTION public.save_answers() FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.save_answers() TO service_role;`);
  const sql = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
  await db.exec(sql);
  await db.exec(sql);
  await db.query('INSERT INTO public.game_stories(version,nodes) VALUES ($1,$2)', ['v1', JSON.stringify(nodes)]);
  return db;
}
async function rpc(db, name, args, role = 'anon') {
  await db.exec(`SET ROLE ${role}`);
  try { return (await db.query(`SELECT public.${name}(${args.map((_, i) => `$${i + 1}`).join(',')}) AS result`, args)).rows[0].result; }
  finally { await db.exec('RESET ROLE'); }
}
const character = (db, id = session, key = token, name = 'Cecília', age = 22, sex = 'female', role) => rpc(db, 'save_game_character', [id, key, name, age, sex], role);
const answer = (db, question = 'single', ids = ['yes'], key = token, id = session, version = 'v1', role) => rpc(db, 'save_game_answer', [id, key, version, question, ids], role);

test('email is immutable per session and links answers and submissions across new games', async () => {
  const db = await setup();
  try {
    for (let i = 0; i < 2; i++) {
      const id = randomUUID(), key = randomUUID();
      const args = [id, key, 'Ana', 24, 'female', 'ana+teste@example.com'];
      assert.deepEqual(await rpc(db, 'save_game_character', args), { status: 'saved' });
      assert.deepEqual(await rpc(db, 'save_game_character', args), { status: 'saved' });
      await answer(db, 'single', ['yes'], key, id);
      await assert.rejects(rpc(db, 'save_game_character', [...args.slice(0, 5), 'outra@example.com']), /immutable/i);
    }
    for (const table of ['answers', 'submissions']) {
      const rows = (await db.query(`SELECT c.email FROM public.${table} a JOIN public.characters c USING (session_id) WHERE c.email=$1`, ['ana+teste@example.com'])).rows;
      assert.deepEqual(rows, [{ email: 'ana+teste@example.com' }, { email: 'ana+teste@example.com' }]);
    }
    assert.equal((await db.query('SELECT email FROM public.characters WHERE session_id=$1', [oldSession])).rows[0].email, null);
    for (const email of ['', 'sem-arroba', 'a b@example.com', 'a\n@example.com', `${'a'.repeat(250)}@b.com`]) {
      await assert.rejects(rpc(db, 'save_game_character', [randomUUID(), randomUUID(), 'Ana', 24, 'female', email]), /email/i);
    }
  } finally { await db.close(); }
});

test('migration runs twice over legacy tables; anon saves an immutable character using a hashed ownership token', async () => {
  const db = await setup();
  try {
    assert.deepEqual(await character(db), { status: 'saved' });
    assert.deepEqual(await character(db), { status: 'saved' });
    assert.deepEqual((await db.query('SELECT name,age,sex FROM public.characters WHERE session_id=$1', [session])).rows, [{ name: 'Cecília', age: 22, sex: 'female' }]);
    assert.equal((await db.query('SELECT token_hash FROM public.game_session_keys WHERE session_id=$1', [session])).rows[0].token_hash, hash(token));
    assert.equal((await db.query('SELECT name FROM public.characters WHERE session_id=$1', [oldSession])).rows[0].name, 'Legacy');
  } finally { await db.close(); }
});

test('answers are canonical, saved selectively, order-independent and immutable with atomic conflicts', async () => {
  const db = await setup();
  try {
    await character(db);
    assert.deepEqual(await answer(db), { status: 'saved', recorded: 1 });
    assert.deepEqual(await answer(db), { status: 'saved', recorded: 1 });
    assert.deepEqual(await answer(db, 'multi', ['b', 'a', 'c']), { status: 'saved', recorded: 2 });
    assert.deepEqual(await answer(db, 'multi', ['c', 'a', 'b']), { status: 'saved', recorded: 2 });
    const before = (await db.query('SELECT * FROM public.answers WHERE session_id=$1 ORDER BY option_id', [session])).rows;
    assert.deepEqual(before.map(({option_id,option_text,correct}) => ({option_id,option_text,correct})), [
      {option_id:'a', option_text:'Canonical A', correct:false},
      {option_id:'b', option_text:'Canonical B', correct:null},
      {option_id:'yes', option_text:'Canonical yes', correct:true},
    ]);
    await assert.rejects(answer(db, 'multi', ['a', 'd']), /conflict/i);
    await assert.rejects(answer(db, 'single', ['no']), /conflict/i);
    assert.deepEqual((await db.query('SELECT * FROM public.answers WHERE session_id=$1 ORDER BY option_id', [session])).rows, before);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.submissions WHERE session_id=$1', [session])).rows[0].n, 2);
    const id = randomUUID(), key = randomUUID();
    await character(db, id, key);
    assert.deepEqual(await answer(db, 'single', ['no'], key, id), {status:'not-recorded',recorded:0});
    assert.deepEqual(await answer(db, 'single', ['no'], key, id), {status:'not-recorded',recorded:0});
    await assert.rejects(answer(db, 'single', ['yes'], key, id), /conflict/i);
  } finally { await db.close(); }
});

test('ownership is required before any disclosure; legacy sessions cannot be claimed and characters cannot change', async () => {
  const db = await setup();
  try {
    await character(db);
    await answer(db);
    const thief = randomUUID();
    await assert.rejects(character(db, session, thief), /credentials/i);
    await assert.rejects(answer(db, 'single', ['yes'], thief), /credentials/i);
    await assert.rejects(answer(db, 'nonexistent', [], thief, session, 'unknown'), /credentials/i);
    await assert.rejects(character(db, oldSession, thief, 'Legacy', 25, 'other'), /credentials/i);
    await assert.rejects(answer(db, 'single', ['yes'], thief, oldSession), /credentials/i);
    await assert.rejects(character(db, session, token, 'Changed'), /immutable/i);
    await assert.rejects(character(db, session, token, 'Cecília', 23), /immutable/i);
    await assert.rejects(character(db, session, token, 'Cecília', 22, 'male'), /immutable/i);
    for (const [name,age,sex] of [['',22,'female'],['x'.repeat(61),22,'female'],['a\nb',22,'female'],['A',17,'female'],['A',121,'female'],['A',22,'invalid'],[null,22,'female'],['A',null,'female'],['A',22,null]]) {
      await assert.rejects(character(db, randomUUID(), randomUUID(), name, age, sex), /adult character/i);
    }
    await assert.rejects(character(db, null, token));
    await assert.rejects(character(db, randomUUID(), null));
    const dump = await db.query(`SELECT (SELECT jsonb_agg(t) FROM public.game_session_keys t) AS keys,
      (SELECT jsonb_agg(t) FROM public.characters t) AS characters,
      (SELECT jsonb_agg(t) FROM public.answers t) AS answers,
      (SELECT jsonb_agg(t) FROM public.submissions t) AS submissions`);
    assert.ok(!JSON.stringify(dump.rows).includes(token));
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.game_session_keys')).rows[0].n, 1);
  } finally { await db.close(); }
});

test('anon and authenticated have RPC execution only; table reads/writes and legacy RPC are denied, service grants survive', async () => {
  const db = await setup();
  try {
    for (const role of ['anon', 'authenticated']) {
      const id = randomUUID(), key = randomUUID();
      assert.deepEqual(await character(db, id, key, 'Adult', 18, 'other', role), {status:'saved'});
      assert.deepEqual(await answer(db, 'single', ['yes'], key, id, 'v1', role), {status:'saved',recorded:1});
      await db.exec(`SET ROLE ${role}`);
      try {
        for (const table of ['characters','answers','submissions','game_session_keys','game_stories']) {
          for (const sql of [`SELECT * FROM public.${table}`, `INSERT INTO public.${table} DEFAULT VALUES`, `DELETE FROM public.${table}`, `UPDATE public.${table} SET ${table === 'game_stories' ? 'version=version' : 'session_id=session_id'}`]) {
            await assert.rejects(db.query(sql), /permission denied/i);
          }
        }
        await assert.rejects(db.query('SELECT name FROM public.characters'), /permission denied/i);
        await assert.rejects(db.query('SELECT public.save_answers()'), /permission denied/i);
      } finally { await db.exec('RESET ROLE'); }
    }
    await db.exec('SET ROLE service_role');
    try {
      assert.equal((await db.query('SELECT public.save_answers() AS result')).rows[0].result, 'legacy');
      assert.equal((await db.query('SELECT name FROM public.characters WHERE session_id=$1',[oldSession])).rows[0].name, 'Legacy');
      assert.equal((await db.query('SELECT option_text FROM public.answers WHERE session_id=$1',[oldSession])).rows[0].option_text, 'Legacy answer');
      assert.equal((await db.query('SELECT selection_hash FROM public.submissions WHERE session_id=$1',[oldSession])).rows[0].selection_hash, 'legacy-hash');
    } finally { await db.exec('RESET ROLE'); }
    const functions = (await db.query(`SELECT prosecdef,proconfig FROM pg_proc WHERE oid IN
      ('public.save_game_character(uuid,uuid,text,integer,text,text)'::regprocedure,'public.save_game_answer(uuid,uuid,text,text,text[])'::regprocedure)`)).rows;
    assert.equal(functions.length,2);
    assert.ok(functions.every(fn => fn.prosecdef && fn.proconfig.includes('search_path=""')));
    const rls = (await db.query(`SELECT relrowsecurity FROM pg_class WHERE oid IN
      ('public.characters'::regclass,'public.answers'::regclass,'public.submissions'::regclass,'public.game_session_keys'::regclass,'public.game_stories'::regclass)`)).rows;
    assert.equal(rls.length,5);
    assert.ok(rls.every(row => row.relrowsecurity));
  } finally { await db.close(); }
});

test('fresh databases get checked tables and statement failures roll back both submission and answer inserts', async () => {
  const db = await setup(false);
  try {
    await character(db);
    await db.exec(`ALTER TABLE public.answers ADD CONSTRAINT deliberate_failure CHECK (option_id <> 'yes')`);
    await assert.rejects(answer(db), /deliberate_failure/i);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.submissions')).rows[0].n,0);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.answers')).rows[0].n,0);
    await db.exec('ALTER TABLE public.answers DROP CONSTRAINT deliberate_failure');
    assert.deepEqual(await answer(db),{status:'saved',recorded:1});
    await assert.rejects(db.query('INSERT INTO public.game_stories(version,nodes) VALUES ($1,$2)',['bad','{}']), /check constraint/i);
    await assert.rejects(db.query('UPDATE public.game_session_keys SET token_hash=$1 WHERE session_id=$2',[token,session]), /check constraint/i);
  } finally { await db.close(); }
});

test('tampered IDs, invalid selection counts, stale versions and missing character are rejected without writes', async () => {
  const db = await setup();
  try {
    await assert.rejects(answer(db), /credentials|character/i);
    await character(db);
    for (const [q, ids] of [['single',['fake']], ['fake',['yes']], ['single',[]], ['single',['yes','no']], ['single',['yes','yes']], ['single',[null]], ['single',null], ['multi',['a']], ['multi',['a','b','c','d']]]) {
      await assert.rejects(answer(db,q,ids));
    }
    await assert.rejects(answer(db, 'single', ['yes'], token, session, 'stale'), /version/i);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.answers WHERE session_id=$1', [session])).rows[0].n, 0);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.submissions WHERE session_id=$1', [session])).rows[0].n, 0);
  } finally { await db.close(); }
});
