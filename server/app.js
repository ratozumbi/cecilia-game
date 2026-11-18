import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseStory, publicStory } from './story.js';

export const root = fileURLToPath(new URL('../', import.meta.url));

export function createApp({ storyPath = new URL('../script.md', import.meta.url) } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'same-origin');
    let path;
    try { path = decodeURIComponent(req.path).replaceAll('\\', '/'); }
    catch { return res.status(400).send('Caminho inválido.'); }
    // A proteção também se aplica aos arquivos servidos pelo Vite.
    if (/(?:^|\/)(?:\.env[^/]*|script\.md|server|data|supabase|tests|\.git)(?:\/|$)/i.test(path) || /\.sqlite(?:-|$|\.)/i.test(path)) return res.status(404).send('Não encontrado.');
    next();
  });
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Muitas solicitações. Aguarde um minuto.' } }));
  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.get('/api/story', (req, res) => res.json(publicStory(parseStory(readFileSync(storyPath, 'utf8')))));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Rota da API não encontrada.' }));
  app.use((error, req, res, next) => {
    if (!req.path.startsWith('/api/')) return next(error);
    // Não divulgar detalhes internos da história ou do sistema de arquivos.
    res.status(500).json({ error: 'Não foi possível carregar a história.' });
  });
  return app;
}