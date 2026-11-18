import express from 'express';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp, root } from './app.js';
import { parseStory } from './story.js';

const dev = process.argv.includes('--dev');
const story = parseStory(readFileSync(resolve(root, 'script.md'), 'utf8'));
for (const node of story.nodes.filter(n => n.type === 'background')) {
  if (!existsSync(resolve(root, 'public/backgrounds', node.file))) console.log(`Imagem de fundo não encontrada: ${node.file}`);
}
const app = createApp();
let vite;
if (dev) {
  const { createServer } = await import('vite');
  vite = await createServer({ root, configFile: resolve(root, 'vite.config.js'), server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
} else {
  const dist = resolve(root, 'dist');
  if (!existsSync(resolve(dist, 'index.html'))) {
    throw new Error('Compilação não encontrada. Execute npm run build antes de npm start ou use npm run dev.');
  }
  app.use(express.static(dist, { dotfiles: 'deny' }));
  app.get('/', (req, res) => res.sendFile(resolve(dist, 'index.html')));
  app.use((req, res) => res.status(404).send('Não encontrado.'));
}
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST || '127.0.0.1';
const server = app.listen(port, host, () => {
  console.log(`Cecília está disponível em http://${host}:${server.address().port}`);
});
server.on('error', error => { console.log(error.code === 'EADDRINUSE' ? `A porta ${port} já está em uso. Defina outra porta em PORT.` : 'Não foi possível iniciar o servidor.'); process.exitCode = 1; });
async function close() { server.close(); if (vite) await vite.close(); process.exit(0); }
process.on('SIGINT', close);
process.on('SIGTERM', close);
