import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, access, rm } from 'node:fs/promises';
import { join } from 'node:path';

// Tests the actual dev middleware, not merely Express's default 404.
test('o servidor inicia sem persistência e bloqueia arquivos privados e desvios de caminho', async t => {
  const dir = await mkdtemp(join(process.env.TMPDIR, 'cecilia-startup-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'nao-criar.sqlite');
  const guard = `import { registerHooks } from 'node:module';
    registerHooks({ resolve(specifier, context, nextResolve) {
      if (specifier === 'node:sqlite' || /(?:database|supabase)\\.js$/.test(specifier)) throw new Error('Persistência não permitida');
      return nextResolve(specifier, context);
    } });`;
  const child = spawn(process.execPath, ['--import', 'data:text/javascript,' + encodeURIComponent(guard), 'server/index.js', '--dev'], { env: { ...process.env, HOST: '127.0.0.1', PORT: '0', DATABASE_PATH: file, DATABASE_MODE: 'ignorar-configuracao-antiga' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  const base = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Server startup timeout: ' + output)); }, 25000);
    child.stdout.on('data', data => {
      output += data;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) { clearTimeout(timeout); resolve(match[0]); }
    });
    child.stderr.on('data', data => { output += data; });
    child.once('exit', () => { clearTimeout(timeout); reject(new Error('Server did not start: ' + output)); });
  });
  try {
    assert.deepEqual(await (await fetch(base + '/api/health')).json(), { ok: true });
    await assert.rejects(access(file), { code: 'ENOENT' });
    assert.match(output, /Cecília está disponível em/);
    const paths = ['/.env', '/.env?raw', '/script.md', '/server/app.js', '/data/cecilia.sqlite', '/@fs/H:/dev/cecilia/.env', '/supabase/schema.sql'];
    for (const path of paths) {
      const response = await fetch(base + path);
      const text = await response.text();
      assert.ok(response.status >= 400, `${path} should be blocked, got ${response.status}`);
      assert.equal(text.includes('sb_secret_'), false);
    }
  } finally { child.kill(); await once(child, 'exit'); }
});
