import { test, expect } from '@playwright/test';

test('recomeçar busca a revisão estática atual e salva os IDs novos sem status técnico na página', async ({ page }) => {
  let reads = 0;
  let releaseStory;
  const nextStory = new Promise(resolve => { releaseStory = resolve; });
  const events = [], posts = [], rpcs = [], errors = [];
  page.on('console', message => {
    if (message.type() === 'log') events.push(Promise.all(message.args().map(arg => arg.jsonValue())));
  });
  page.on('request', request => { if (request.method() === 'POST') posts.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  await page.route('**/backend.json', route => route.fulfill({ json: { url: 'https://projeto.supabase.co', publishableKey: 'sb_publishable_teste' } }));
  await page.route('**/rest/v1/rpc/**', async route => {
    rpcs.push({ url: route.request().url(), body: route.request().postDataJSON() });
    await route.fulfill({ json: { status: 'saved', recorded: 1 } });
  });
  await page.route('**/story.json', async route => {
    reads++;
    if (reads === 2) await nextStory;
    await route.fulfill({ json: { id: 'cecilia', title: 'Teste', version: `version-${reads}`, nodes: [
      { type: 'dialogue', speaker: 'Cecilia', text: `Revisão ${reads}` },
      { type: 'question', id: `question-${reads}`, mode: 'single', min: 1, max: 1, prompt: 'Ficamos mais um pouco?', options: [{ id: `option-${reads}`, text: 'Sim, vamos ficar.' }] },
      { type: 'end', outcome: 'success', text: 'A noite continua.' }
    ] } });
  });
  await page.goto('/');
  await expect(page.getByLabel('Seu nome')).toBeVisible();
  await page.getByRole('button', { name: /Recomeçar/ }).click();
  await page.getByRole('button', { name: 'Ficar aqui' }).click();
  expect(reads).toBe(1);
  await page.getByRole('button', { name: /Recomeçar/ }).click();
  await page.getByRole('button', { name: /Começar de novo/ }).click();
  await expect.poll(() => reads).toBe(2);
  await expect(page.getByLabel('Seu nome')).toHaveCount(0);
  releaseStory();
  await page.getByLabel('Seu nome').fill('Nova revisão');
  await page.getByLabel('Idade', { exact: true }).fill('27');
  await page.getByLabel('Sexo', { exact: true }).selectOption('other');
  await page.getByRole('button', { name: /Que a noite comece/ }).click();
  await expect(page.locator('.dialogue-text')).toHaveText('Revisão 2');
  await page.getByRole('button', { name: /Continuar/ }).click();
  await page.locator('input[value="option-2"]').check();
  await page.getByRole('button', { name: /Essa é minha resposta/ }).click();
  await expect(page.getByRole('heading', { name: 'Talvez este seja um começo.' })).toBeVisible();
  expect((await Promise.all(events)).filter(([label]) => ['Personagem criado:', 'Resposta escolhida:'].includes(label))).toEqual([
    ['Personagem criado:', { name: 'Nova revisão', age: 27, sex: 'other' }],
    ['Resposta escolhida:', { storyVersion: 'version-2', questionId: 'question-2', optionIds: ['option-2'] }]
  ]);
  await expect.poll(() => rpcs.length).toBe(2);
  expect(posts).toEqual(rpcs.map(rpc => rpc.url));
  expect(rpcs.map(rpc => rpc.url)).toEqual([
    'https://projeto.supabase.co/rest/v1/rpc/save_game_character',
    'https://projeto.supabase.co/rest/v1/rpc/save_game_answer'
  ]);
  const { p_session_id: session, p_token: token } = rpcs[0].body;
  expect(session).toMatch(/^[0-9a-f-]{36}$/i);
  expect(token).toMatch(/^[0-9a-f-]{36}$/i);
  expect(rpcs[0].body).toEqual({ p_session_id: session, p_token: token, p_name: 'Nova revisão', p_age: 27, p_sex: 'other' });
  expect(rpcs[1].body).toEqual({ p_session_id: session, p_token: token, p_story_version: 'version-2', p_question_id: 'question-2', p_option_ids: ['option-2'] });
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cecilia.pending.v2') || '[]'))).toEqual([]);
  expect(errors).toEqual([]);
  await expect(page.locator('#save-status, #pending-list')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(/supabase|status da conexão|conexão com o servidor|cache|outbox|saved locally|Envio pendente|Envio concluído|Envio adiado|Envio recusado/i);
  expect((await Promise.all(events)).some(([label]) => label === 'Envio concluído:')).toBe(true);
});