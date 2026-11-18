import { test, expect } from '@playwright/test';

const observations = new WeakMap();
test.beforeEach(async ({ page }) => {
  const observation = { events: [], posts: [], rpcs: [], errors: [] };
  observations.set(page, observation);
  page.on('console', message => {
    if (message.type() === 'log') observation.events.push(Promise.all(message.args().map(arg => arg.jsonValue())));
  });
  page.on('request', request => { if (request.method() === 'POST') observation.posts.push(request.url()); });
  page.on('pageerror', error => observation.errors.push(error.message));
  await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  await page.route('**/backend.json', route => route.fulfill({ json: { url: 'https://projeto.supabase.co', publishableKey: 'sb_publishable_teste' } }));
  await page.route('**/rest/v1/rpc/**', async route => {
    observation.rpcs.push({ url: route.request().url(), body: route.request().postDataJSON(), headers: route.request().headers() });
    await route.fulfill({ json: { status: 'saved', recorded: 1 } });
  });
});
test.afterEach(async ({ page }) => {
  const observation = observations.get(page);
  const gameplay = await gameplayEvents(page);
  await expect.poll(() => observation.rpcs.length).toBe(gameplay.length);
  expect(observation.posts).toEqual(observation.rpcs.map(rpc => rpc.url));
  let session, token;
  const sessions = new Set();
  gameplay.forEach(([label, payload], index) => {
    const rpc = observation.rpcs[index];
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
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cecilia.pending.v2') || '[]'))).toEqual([]);
  expect(observation.errors).toEqual([]);
  await expect(page.locator('#save-status, #pending-list')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(/supabase|status da conexão|conexão com o servidor|cache|outbox|saved locally|Envio pendente|Envio concluído|Envio adiado|Envio recusado/i);
  expect((await Promise.all(observation.events)).some(([label]) => label === 'Envio concluído:')).toBe(true);
});

async function gameplayEvents(page) {
  return (await Promise.all(observations.get(page).events)).filter(([label]) => ['Personagem criado:', 'Resposta escolhida:'].includes(label));
}
async function createCharacter(page, name = 'Alex do navegador') {
  await page.getByLabel('Seu nome').fill(name);
  await page.getByLabel('Idade', { exact: true }).fill('27');
  await page.getByLabel('Sexo', { exact: true }).selectOption('other');
  await page.getByRole('button', { name: /Que a noite comece/ }).click();
  await expect(page.getByLabel('Seu nome')).toHaveCount(0);
  return ['Personagem criado:', { name, age: 27, sex: 'other' }];
}
async function play(page, story, choices) {
  const selected = [];
  for (let step = 0; step < 100; step++) {
    const confirm = page.getByRole('button', { name: /Essa é minha resposta/ });
    if (await confirm.count()) {
      const prompt = await page.locator('#story-panel h2').innerText();
      const question = story.nodes.find(node => node.type === 'question' && node.prompt === prompt);
      expect(question).toBeTruthy();
      const ids = choices[question.id];
      expect(ids, `Escolha para ${question.id}`).toBeTruthy();
      for (const id of ids) await page.locator(`.options input[value="${id}"]`).check();
      await confirm.click();
      selected.push(['Resposta escolhida:', { storyVersion: story.version, questionId: question.id, optionIds: ids }]);
    } else {
      const next = page.getByRole('button', { name: /^Continuar/ });
      if (!await next.count()) break;
      await next.click();
    }
  }
  await expect(page.getByRole('button', { name: 'Reler nossa noite' })).toBeVisible();
  expect(selected.map(([, payload]) => payload.questionId)).toEqual(Object.keys(choices));
  return selected;
}

test('história estática real chega ao segundo encontro e salva personagem antes das escolhas em segundo plano', async ({ page, request }, testInfo) => {
  const response = await request.get('/story.json');
  expect(response.ok()).toBe(true);
  const story = await response.json();
  await page.goto('/');
  await page.getByRole('button', { name: 'Animações ativadas' }).click();
  await expect(page.getByRole('button', { name: 'Animações desativadas' })).toHaveAttribute('aria-pressed', 'true');
  const character = await createCharacter(page);
  const answers = await play(page, story, { greeting: ['present'], coffee: ['chocolate'], interests: ['books', 'quiet'], listening: ['ask'], closeness: ['ask'], invitation: ['again'] });
  await expect(page.getByRole('heading', { name: 'Talvez este seja um começo.' })).toBeVisible();
  await expect(page.locator('#location')).toHaveText('ACIMA DA CIDADE');
  expect(await gameplayEvents(page)).toEqual([character, ...answers]);
  await page.screenshot({ path: testInfo.outputPath('segundo-encontro.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('convite gentil também chega ao final de sucesso', async ({ page, request }) => {
  const story = await (await request.get('/story.json')).json();
  await page.goto('/');
  const character = await createCharacter(page);
  const answers = await play(page, story, { greeting: ['nervous'], coffee: ['espresso'], interests: ['outdoors'], listening: ['share'], closeness: ['space'], invitation: ['gentle'] });
  await expect(page.getByRole('heading', { name: 'Talvez este seja um começo.' })).toBeVisible();
  expect(await gameplayEvents(page)).toEqual([character, ...answers]);
});

for (const [route, choices] of [
  ['despedida antecipada', { greeting: ['distracted'] }],
  ['falta de escuta', { greeting: ['present'], coffee: ['tea'], interests: ['music'], listening: ['dismiss'] }],
  ['limite durante a caminhada', { greeting: ['present'], coffee: ['espresso'], interests: ['books'], listening: ['ask'], closeness: ['insist'] }],
  ['despedida gentil', { greeting: ['nervous'], coffee: ['chocolate'], interests: ['quiet'], listening: ['share'], closeness: ['space'], invitation: ['goodbye'] }],
  ['limite no convite final', { greeting: ['nervous'], coffee: ['tea'], interests: ['music'], listening: ['share'], closeness: ['space'], invitation: ['pressure'] }]
]) {
  test(`história real termina sem segundo encontro: ${route}`, async ({ page, request }) => {
    const story = await (await request.get('/story.json')).json();
    await page.goto('/');
    const character = await createCharacter(page);
    const answers = await play(page, story, choices);
    await expect(page.getByRole('heading', { name: 'Um outro tipo de final.' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Continuar/ })).toHaveCount(0);
    expect(await gameplayEvents(page)).toEqual([character, ...answers]);
  });
}

test('recarregar começa um novo personagem jogável sem restaurar dados anteriores', async ({ page, request }) => {
  const story = await (await request.get('/story.json')).json();
  await page.goto('/');
  const first = await createCharacter(page, 'Antes de recarregar');
  const firstAnswers = await play(page, story, { greeting: ['distracted'] });
  expect(await gameplayEvents(page)).toEqual([first, ...firstAnswers]);
  await expect.poll(() => observations.get(page).rpcs.length).toBe(2);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cecilia.pending.v2') || '[]'))).toEqual([]);
  await page.reload();
  await expect(page.getByLabel('Seu nome')).toHaveValue('');
  const second = await createCharacter(page, 'Depois de recarregar');
  const secondAnswers = await play(page, story, { greeting: ['distracted'] });
  await expect(page.getByRole('heading', { name: 'Um outro tipo de final.' })).toBeVisible();
  expect(await gameplayEvents(page)).toEqual([first, ...firstAnswers, second, ...secondAnswers]);
});