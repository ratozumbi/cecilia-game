import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseStory } from '../server/story.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const literal = value => `'${value.replaceAll("'", "''")}'`;
const storyValues = story => {
  if (!/^[a-f0-9]{64}$/.test(story.version) || !Array.isArray(story.nodes)) throw new Error('Roteiro inválido.');
  return { version: literal(story.version), nodes: literal(JSON.stringify(story.nodes)) };
};
export function projectRef(url) {
  const match = /^https:\/\/([a-z]{20})\.supabase\.co$/.exec(url);
  if (!match) throw new Error('URL do projeto inválida.');
  return match[1];
}
export function publicationSql(schema, story) {
  const { version, nodes } = storyValues(story);
  return `${schema}\nINSERT INTO public.game_stories (version, nodes) VALUES (${version}, ${nodes}::jsonb) ON CONFLICT (version) DO UPDATE SET nodes = EXCLUDED.nodes;\nNOTIFY pgrst, 'reload schema';\n`;
}
export function confirmationSql(story) {
  const { version, nodes } = storyValues(story);
  return `SELECT version, nodes = ${nodes}::jsonb AS matches FROM public.game_stories WHERE version = ${version};`;
}
function publish() {
  const config = JSON.parse(readFileSync(join(root, 'public/backend.json'), 'utf8'));
  const ref = projectRef(config.url);
  const story = parseStory(readFileSync(join(root, 'script.md'), 'utf8'));
  const schema = readFileSync(join(root, 'supabase/schema.sql'), 'utf8');
  const dir = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'cecilia-publish-'));
  const run = (sql, readOnly = false) => {
    const file = join(dir, readOnly ? 'confirm.sql' : 'publish.sql');
    writeFileSync(file, sql);
    const args = ['--yes', 'supabase@3.1.0', 'db', 'query', `--remote=${ref}`, '--file', process.platform === 'win32' ? `"${file}"` : file, '--output', 'json', readOnly ? '--read-only' : '--yes'];
    const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, { cwd: root, shell: process.platform === 'win32', encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
    if (result.error || result.status !== 0) throw new Error(`Publicação não concluída. ${result.stderr || result.error?.message || ''}`);
    return JSON.parse(result.stdout);
  };
  try {
    run(publicationSql(schema, story));
    const check = run(confirmationSql(story), true);
    if (check.rows?.length !== 1 || check.rows[0].version !== story.version || check.rows[0].matches !== true) throw new Error('Não foi possível confirmar o roteiro no banco.');
    console.log(`Banco atualizado e roteiro confirmado: ${story.version}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { publish(); } catch (error) { console.log(error.message); process.exitCode = 1; }
}
