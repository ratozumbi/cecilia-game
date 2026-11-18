import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, cp, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, createServer } from 'vite';
import { parseStory, publicStory } from '../server/story.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const configFile = join(root, 'vite.config.js');
const source = () => readFile(join(root, 'script.md'), 'utf8');

async function scratch(t) {
  assert.ok(process.env.TMPDIR, 'TMPDIR must point to the safe scratch directory');
  const dir = await mkdtemp(join(process.env.TMPDIR, 'cecilia-static-story-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

function options(projectRoot, outDir) {
  return { root: projectRoot, configFile, envFile: false, logLevel: 'silent', build: {
    outDir, emptyOutDir: true,
    ...(projectRoot !== root ? { rollupOptions: { output: { manualChunks: () => undefined } } } : {})
  } };
}

async function fixture(t, script) {
  script ??= await source();
  const dir = await scratch(t);
  await writeFile(join(dir, 'index.html'), '<!doctype html><title>Story fixture</title>');
  await writeFile(join(dir, 'script.md'), script);
  await cp(join(root, 'public'), join(dir, 'public'), { recursive: true });
  return dir;
}

async function files(dir, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory()
    ? files(join(dir, entry.name), prefix + entry.name + '/')
    : prefix + entry.name))).flat();
}

function assertPublic(story) {
  for (const node of story.nodes) for (const option of node.options ?? []) {
    assert.equal(Object.hasOwn(option, 'save'), false);
    assert.equal(Object.hasOwn(option, 'correct'), false);
    assert.equal(Object.hasOwn(option, 'incorrect'), false);
  }
}

test('actual Vite build emits only the public story and no private source files', async t => {
  const dir = await scratch(t);
  const outDir = join(dir, 'dist');
  await build(options(root, outDir));
  const story = JSON.parse(await readFile(join(outDir, 'story.json'), 'utf8'));
  assert.deepEqual(story, publicStory(parseStory(await source())));
  assertPublic(story);
  const output = await files(outDir);
  assert.ok(output.some(file => file.startsWith('backgrounds/')));
  assert.deepEqual(output.filter(file => /(^|\/)(script\.md|server|\.env(?:\..*)?)(\/|$)/.test(file)), []);
});

test('Vite build rejects malformed story directives', async t => {
  const dir = await fixture(t, '@question unfinished single\nUnclosed prompt');
  await assert.rejects(build(options(dir, join(dir, 'dist'))), /Pergunta não encerrada/);
});

test('Vite build rejects missing background files', async t => {
  const dir = await fixture(t, '@background missing.svg\n@finish Fim.');
  await assert.rejects(build(options(dir, join(dir, 'dist'))), /fundo/i);
});

test('Vite build rejects background paths that are directories', async t => {
  const dir = await fixture(t, '@background directory.svg\n@finish Fim.');
  await mkdir(join(dir, 'public', 'backgrounds', 'directory.svg'));
  await assert.rejects(build(options(dir, join(dir, 'dist'))), /fundo/i);
});

test('dev serves fresh public JSON with no-store and sanitizes story failures', async t => {
  const dir = await fixture(t);
  const server = await createServer({
    ...options(dir, join(dir, 'dist')),
    server: { host: '127.0.0.1', port: 0 },
    optimizeDeps: { noDiscovery: true, include: [] }
  });
  t.after(() => server.close());
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  let response = await fetch(base + '/story.json?fresh=1');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const story = await response.json();
  assert.deepEqual(story, publicStory(parseStory(await source())));
  assertPublic(story);

  const changed = '# História atualizada\n@finish Fim novo.';
  await writeFile(join(dir, 'script.md'), changed);
  response = await fetch(base + '/story.json');
  assert.deepEqual(await response.json(), publicStory(parseStory(changed)));

  for (const broken of ['@private-source-marker', '@background private-source-marker.svg']) {
    await writeFile(join(dir, 'script.md'), broken);
    response = await fetch(base + '/story.json');
    assert.equal(response.status, 500);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(response.headers.get('content-type'), /application\/json/);
    assert.deepEqual(await response.json(), { error: 'Não foi possível carregar a história.' });
  }
  await rm(join(dir, 'script.md'));
  response = await fetch(base + '/story.json');
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Não foi possível carregar a história.' });

  await writeFile(join(dir, 'script.md'), changed);
  await mkdir(join(dir, 'server'));
  await writeFile(join(dir, 'server', 'private.js'), 'private-source-marker');
  for (const path of ['/script.md', '/server/private.js']) {
    response = await fetch(base + path);
    assert.equal(response.status, 403, `${path} must retain the private-file deny rule`);
    assert.equal((await response.text()).includes('private-source-marker'), false);
  }
});
