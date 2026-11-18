import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { parseStory, publicStory } from '../server/story.js';

async function readPublicStory(root, publicDir) {
  const story = parseStory(await readFile(join(root, 'script.md'), 'utf8'));
  const backgrounds = new Set(story.nodes.filter(node => node.type === 'background').map(node => node.file));
  for (const file of backgrounds) {
    const info = publicDir && await stat(join(publicDir, 'backgrounds', file)).catch(() => null);
    if (!info || !info.isFile()) throw new Error(`Arquivo de fundo ausente ou inválido: ${file}`);
  }
  return publicStory(story);
}

export function storyAssets() {
  let root, publicDir;
  return {
    name: 'cecilia-story-assets',
    configResolved(config) { root = config.root; publicDir = config.publicDir; },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'GET' || req.url?.split('?')[0] !== '/story.json') return next();
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        try {
          const story = await readPublicStory(root, publicDir);
          res.statusCode = 200;
          res.end(JSON.stringify(story));
        } catch {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Não foi possível carregar a história.' }));
        }
      });
    },
    async generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'story.json', source: JSON.stringify(await readPublicStory(root, publicDir)) });
    }
  };
}
