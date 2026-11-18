import { test, expect } from '@playwright/test';

const targetUrl = () => process.env.FRONTEND_URL || test.info().project.use.baseURL || 'http://127.0.0.1:5173';
const story = { id: 'cecilia', version: 'test-version', title: 'Cecilia', nodes: [
  { type: 'label', id: 'cafe' }, { type: 'background', file: 'cafe.svg' },
  { type: 'dialogue', speaker: 'Cecilia', text: 'Você encontrou meu cantinho favorito da cidade.' },
  { type: 'question', id: 'coffee', mode: 'single', min: 1, max: 1, prompt: 'O que você vai tomar?', options: [{ id: 'espresso', text: 'Um expresso e um pouco de coragem.' }, { id: 'leave', text: 'Na verdade, preciso ir.', goto: 'fail' }] },
  { type: 'background', file: 'garden.svg' }, { type: 'dialogue', speaker: 'Você', text: 'Vamos pelo caminho mais longo?' },
  { type: 'question', id: 'interests', mode: 'multiple', min: 1, max: 2, prompt: 'O que torna uma noite especial?', options: [{ id: 'books', text: 'Um livro que não consigo largar.' }, { id: 'music', text: 'Uma música para compartilhar.' }, { id: 'walks', text: 'Uma caminhada sem destino.' }] },
  { type: 'background', file: 'rooftop.svg' }, { type: 'end', outcome: 'success', text: 'Ela fica mais um pouco. Você também.' },
  { type: 'label', id: 'fail' }, { type: 'end', outcome: 'failure', text: 'Algumas noites terminam com uma despedida gentil.' }
] };

async function fixture(page, blockStorage = false, respond) {
  const events = [], posts = [], errors = [], rpcs = [];
  page.on('console', message => {
    if (message.type() === 'log') events.push(Promise.all(message.args().map(arg => arg.jsonValue())));
  });
  page.on('request', request => { if (request.method() === 'POST') posts.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ blockStorage }) => {
    if (blockStorage) Object.defineProperty(window, 'localStorage', { get() { throw new Error('Armazenamento indisponível'); } });
  }, { blockStorage });
  await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  await page.route('**/story.json', route => route.fulfill({ json: story }));
  await page.route('**/backend.json', route => route.fulfill({ json: { url: 'https://projeto.supabase.co', publishableKey: 'sb_publishable_teste' } }));
  await page.route('**/rest/v1/rpc/**', async route => {
    const request = route.request();
    rpcs.push({ method: request.method(), url: request.url(), body: request.postDataJSON(), headers: request.headers() });
    if (respond) return respond(route, rpcs);
    await route.fulfill({ json: { status: 'saved', recorded: 1 } });
  });
  return {
    rpcs, events, errors,
    async verify(expected) {
      const gameplay = (await Promise.all(events)).filter(([label]) => ['Personagem criado:', 'Resposta escolhida:'].includes(label));
      expect(gameplay).toEqual(expected);
      await expect.poll(() => rpcs.length).toBe(expected.length);
      expect(posts).toEqual(rpcs.map(rpc => rpc.url));
      let session, token;
      const sessions = new Set();
      expected.forEach(([label, payload], index) => {
        const rpc = rpcs[index];
        expect(rpc.method).toBe('POST');
        expect(rpc.headers.apikey).toBe('sb_publishable_teste');
        if (label === 'Personagem criado:') {
          session = rpc.body.p_session_id; token = rpc.body.p_token;
          expect(session).toMatch(/^[0-9a-f-]{36}$/i);
          expect(token).toMatch(/^[0-9a-f-]{36}$/i);
          expect(sessions.has(session)).toBe(false); sessions.add(session);
          expect(rpc.url).toBe('https://projeto.supabase.co/rest/v1/rpc/save_game_character');
          expect(rpc.body).toEqual({ p_session_id: session, p_token: token, p_name: payload.name, p_age: payload.age, p_sex: payload.sex });
        } else {
          expect(rpc.url).toBe('https://projeto.supabase.co/rest/v1/rpc/save_game_answer');
          expect(rpc.body).toEqual({ p_session_id: session, p_token: token, p_story_version: payload.storyVersion, p_question_id: payload.questionId, p_option_ids: payload.optionIds });
        }
      });
      expect(errors).toEqual([]);
      if (!blockStorage) await expect.poll(() => pending(page)).toEqual([]);
      await consoleOnly(page);
      await expect.poll(async () => (await Promise.all(events)).some(([label]) => label === 'Envio concluído:')).toBe(true);
    }
  };
}

const pending = page => page.evaluate(() => JSON.parse(localStorage.getItem('cecilia.pending.v2') || '[]'));
async function consoleOnly(page) {
  await expect(page.locator('#save-status, #pending-list')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(/supabase|status da conexão|conexão com o servidor|cache|outbox|saved locally|Envio pendente|Envio concluído|Envio adiado|Envio recusado|Armazenamento indisponível|sb_publishable_/i);
}

async function createCharacter(page) {
  await page.getByLabel('Seu nome').fill('Ana');
  await page.getByLabel('Idade', { exact: true }).fill('24');
  await page.getByLabel('Sexo', { exact: true }).selectOption('female');
  await page.getByRole('button', { name: /Que a noite comece/ }).click();
}
const characterEvent = ['Personagem criado:', { name: 'Ana', age: 24, sex: 'female' }];
const answerEvent = (questionId, optionIds) => ['Resposta escolhida:', { storyVersion: story.version, questionId, optionIds }];

test('conversa continua abaixo da arte sem sobrepor o cenário', async ({ page }) => {
  await fixture(page);
  await page.goto(targetUrl());
  await expect(page.getByLabel('Seu nome')).toBeVisible();
  async function checkLayout() {
    const art = await page.locator('#scene').boundingBox();
    const panel = await page.locator('#story-panel').boundingBox();
    const novel = await page.locator('.novel').boundingBox();
    expect(panel.y).toBeGreaterThanOrEqual(art.y + art.height - 1);
    expect(panel.x).toBe(novel.x);
    expect(panel.width).toBe(novel.width);
    expect(await page.locator('#story-panel').evaluate(node => node.scrollHeight <= node.clientHeight)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await checkLayout();
  await createCharacter(page);
  await checkLayout();
  await page.getByRole('button', { name: /Continuar/ }).click();
  await expect(page.locator('.question-panel')).toBeVisible();
  await checkLayout();
  await page.screenshot({ path: test.info().outputPath('conversation-below-art.png'), fullPage: true });
});

test('personagem é salvo em segundo plano com status técnico somente no console', async ({ page }) => {
  const observation = await fixture(page);
  await page.goto(targetUrl());
  await createCharacter(page);
  await expect(page.locator('.dialogue-text')).toHaveText('Você encontrou meu cantinho favorito da cidade.');
  await observation.verify([characterEvent]);
});

test('noite completa: teclado, escolhas únicas e múltiplas, cenários, lembranças e reinício', async ({ page }) => {
  const observation = await fixture(page);
  await page.goto(targetUrl());
  await expect(page.getByRole('heading', { name: 'Toda história começa com você.' })).toBeVisible();
  await expect(page.locator('#scene canvas')).toBeVisible();
  await createCharacter(page);
  await expect(page.getByText('Você encontrou meu cantinho favorito da cidade.')).toBeVisible();
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: /Essa é minha resposta/ })).toBeDisabled();
  await page.locator('input[value="espresso"]').check();
  await page.getByRole('button', { name: /Essa é minha resposta/ }).click();
  await expect(page.locator('#location')).toHaveText('O JARDIM TRANQUILO');
  await expect(page.locator('.speaker-name')).toHaveText('Ana');
  await page.getByRole('button', { name: /Continuar/ }).click();
  await page.locator('input[value="books"]').check();
  await page.locator('input[value="music"]').check();
  await expect(page.locator('input[value="walks"]')).toBeDisabled();
  await page.getByRole('button', { name: /Essa é minha resposta/ }).click();
  await expect(page.getByRole('heading', { name: 'Talvez este seja um começo.' })).toBeVisible();
  await expect(page.locator('#location')).toHaveText('ACIMA DA CIDADE');
  await page.getByRole('button', { name: 'Reler nossa noite' }).click();
  await expect(page.locator('#notes-content')).toContainText('Ana');
  await expect(page.locator('#notes-content')).toContainText('Um livro que não consigo largar.');
  await page.getByRole('button', { name: 'Fechar lembranças da noite' }).click();
  await observation.verify([characterEvent, answerEvent('coffee', ['espresso']), answerEvent('interests', ['books', 'music'])]);
  await page.getByRole('button', { name: /Recomeçar/ }).click();
  await page.getByRole('button', { name: /Começar de novo/ }).click();
  await expect(page.getByLabel('Seu nome')).toHaveValue('');
  await page.getByRole('button', { name: /Lembranças da noite/ }).click();
  await expect(page.locator('#notes-content')).not.toContainText('Ana');
  await page.getByRole('button', { name: 'Fechar lembranças da noite' }).click();
  await createCharacter(page);
  await expect(page.locator('.dialogue-text')).toHaveText('Você encontrou meu cantinho favorito da cidade.');
  await observation.verify([characterEvent, answerEvent('coffee', ['espresso']), answerEvent('interests', ['books', 'music']), characterEvent]);
});

test('armazenamento local indisponível não impede escolhas, final ou recarregamento', async ({ page }) => {
  const observation = await fixture(page, true);
  await page.goto(targetUrl());
  await createCharacter(page);
  await page.getByRole('button', { name: /Continuar/ }).click();
  await page.locator('input[value="leave"]').check();
  await page.getByRole('button', { name: /Essa é minha resposta/ }).click();
  await expect(page.getByRole('heading', { name: 'Um outro tipo de final.' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Continuar/ })).toHaveCount(0);
  await observation.verify([characterEvent, answerEvent('coffee', ['leave'])]);
  expect((await Promise.all(observation.events)).some(([label]) => label.startsWith('Armazenamento indisponível:'))).toBe(true);
  await page.reload();
  await expect(page.getByLabel('Seu nome')).toHaveValue('');
  await createCharacter(page);
  await expect(page.locator('.dialogue-text')).toHaveText('Você encontrou meu cantinho favorito da cidade.');
  await observation.verify([characterEvent, answerEvent('coffee', ['leave']), characterEvent]);
});

test('celular sem rolagem horizontal e final de escolha única acessível', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const observation = await fixture(page);
  await page.goto(targetUrl());
  await createCharacter(page);
  await page.getByRole('button', { name: /Continuar/ }).click();
  await page.getByRole('radio', { name: /Na verdade, preciso ir/ }).check();
  await page.getByRole('button', { name: /Essa é minha resposta/ }).click();
  await expect(page.getByRole('heading', { name: 'Um outro tipo de final.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await observation.verify([characterEvent, answerEvent('coffee', ['leave'])]);
});

test('503 mantém personagem e resposta na fila após recarregar e online reenvia na ordem', async ({ page }) => {
  let available = false;
  const saved = [];
  const observation = await fixture(page, false, async (route, rpcs) => {
    if (!available) return route.fulfill({ status: 503, json: { error: 'Serviço temporariamente indisponível' } });
    saved.push(rpcs.at(-1));
    await route.fulfill({ json: { status: 'saved', recorded: 1 } });
  });
  await page.goto(targetUrl());
  await createCharacter(page);
  await page.getByRole('button', { name: /Continuar/ }).click();
  await page.locator('input[value="leave"]').check();
  await page.getByRole('button', { name: /Essa é minha resposta/ }).click();
  await expect(page.getByRole('heading', { name: 'Um outro tipo de final.' })).toBeVisible();
  await expect.poll(async () => (await pending(page)).map(entry => entry.kind)).toEqual(['character', 'answer']);
  await expect.poll(async () => (await Promise.all(observation.events)).some(([label]) => label === 'Envio adiado:')).toBe(true);
  const queued = await pending(page);
  expect(queued[0].payload).toEqual(characterEvent[1]);
  expect(queued[1].payload).toEqual(answerEvent('coffee', ['leave'])[1]);
  expect(queued[1].sessionId).toBe(queued[0].sessionId);
  expect(queued[1].token).toBe(queued[0].token);
  expect(queued.every(entry => entry.blocked === false)).toBe(true);
  expect(observation.rpcs.every(rpc => rpc.url.endsWith('/save_game_character'))).toBe(true);
  await consoleOnly(page);
  const beforeReload = observation.rpcs.length;
  const deferredBeforeReload = (await Promise.all(observation.events)).filter(([label]) => label === 'Envio adiado:').length;
  await page.reload();
  await expect(page.getByLabel('Seu nome')).toHaveValue('');
  await expect.poll(() => observation.rpcs.length).toBeGreaterThan(beforeReload);
  expect(await pending(page)).toEqual(queued);
  // Wait until the failed startup flush completes, then trigger the retry explicitly.
  await expect.poll(async () => (await Promise.all(observation.events)).filter(([label]) => label === 'Envio adiado:').length).toBeGreaterThan(deferredBeforeReload);
  available = true;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => pending(page)).toEqual([]);
  expect(saved.map(rpc => rpc.url)).toEqual([
    'https://projeto.supabase.co/rest/v1/rpc/save_game_character',
    'https://projeto.supabase.co/rest/v1/rpc/save_game_answer'
  ]);
  expect(saved[0].body).toEqual({ p_session_id: queued[0].sessionId, p_token: queued[0].token, p_name: 'Ana', p_age: 24, p_sex: 'female' });
  expect(saved[1].body).toEqual({ p_session_id: queued[0].sessionId, p_token: queued[0].token, p_story_version: story.version, p_question_id: 'coffee', p_option_ids: ['leave'] });
  expect(observation.errors).toEqual([]);
  await consoleOnly(page);
});

test('duplo envio não duplica personagem ou resposta enquanto o personagem aguarda confirmação', async ({ page }) => {
  let releaseCharacter;
  const gate = new Promise(resolve => { releaseCharacter = resolve; });
  const observation = await fixture(page, false, async route => {
    if (route.request().url().endsWith('/save_game_character')) await gate;
    await route.fulfill({ json: { status: 'saved', recorded: 1 } });
  });
  await page.goto(targetUrl());
  await page.getByLabel('Seu nome').fill('Ana');
  await page.getByLabel('Idade', { exact: true }).fill('24');
  await page.getByLabel('Sexo', { exact: true }).selectOption('female');
  try {
    await page.locator('.character-form').evaluate(form => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await expect(page.locator('.dialogue-text')).toHaveText('Você encontrou meu cantinho favorito da cidade.');
    await expect.poll(() => observation.rpcs.length).toBe(1);
    await page.getByRole('button', { name: /Continuar/ }).click();
    await page.locator('input[value="leave"]').check();
    await page.locator('.choice-form').evaluate(form => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await expect(page.getByRole('heading', { name: 'Um outro tipo de final.' })).toBeVisible();
    expect(observation.rpcs).toHaveLength(1);
    expect((await pending(page)).map(entry => entry.kind)).toEqual(['character', 'answer']);
  } finally {
    releaseCharacter();
  }
  await observation.verify([characterEvent, answerEvent('coffee', ['leave'])]);
});

test('erro 400 bloqueia reenvio mas não interrompe a história nem mostra detalhes técnicos', async ({ page }) => {
  const observation = await fixture(page, false, route => route.fulfill({ status: 400, json: { error: 'RPC inválida: detalhe técnico privado' } }));
  await page.goto(targetUrl());
  await createCharacter(page);
  await expect.poll(async () => (await Promise.all(observation.events)).some(([label, details]) => label === 'Envio recusado:' && details.status === 400)).toBe(true);
  await page.getByRole('button', { name: /Continuar/ }).click();
  await page.locator('input[value="leave"]').check();
  await page.getByRole('button', { name: /Essa é minha resposta/ }).click();
  await expect(page.getByRole('heading', { name: 'Um outro tipo de final.' })).toBeVisible();
  const queued = await pending(page);
  expect(queued.map(({ kind, blocked }) => ({ kind, blocked }))).toEqual([
    { kind: 'character', blocked: true }, { kind: 'answer', blocked: false }
  ]);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  // An independent session is a flush barrier: blocked entries must not retry.
  await page.getByRole('button', { name: /Recomeçar/ }).click();
  await page.getByRole('button', { name: /Começar de novo/ }).click();
  await createCharacter(page);
  await expect.poll(() => observation.rpcs.length).toBe(2);
  await expect.poll(async () => (await pending(page)).filter(entry => entry.blocked).length).toBe(2);
  expect(observation.rpcs.every(rpc => rpc.url.endsWith('/save_game_character'))).toBe(true);
  expect(observation.rpcs[1].body.p_session_id).not.toBe(observation.rpcs[0].body.p_session_id);
  expect(observation.errors).toEqual([]);
  await consoleOnly(page);
  await expect(page.locator('body')).not.toContainText(/400|RPC inválida|detalhe técnico privado/);
});