import { test, expect } from '@playwright/test';

for (const [query, email] of [
  ['?email=ana%2Bteste%40example.com', 'ana+teste@example.com'],
  ['?email=sem-arroba', undefined],
  ['?email=a%0Ab%40example.com', undefined],
  ['', undefined]
]) {
  test(`email da URL acompanha respostas, reinício e recarga: ${query || 'sem parâmetro'}`, async ({ page }) => {
    const rpcs = [], logs = [];
    page.on('console', message => logs.push(message.text()));
    await page.route('**/backend.json', route => route.fulfill({ json: { url: 'https://projeto.supabase.co', publishableKey: 'sb_publishable_teste' } }));
    await page.route('**/rest/v1/rpc/**', async route => {
      rpcs.push({ url: route.request().url(), body: route.request().postDataJSON() });
      await route.fulfill({ json: { status: 'saved', recorded: 1 } });
    });
    await page.route('**/story.json', route => route.fulfill({ json: { version: 'v1', nodes: [
      { type: 'question', id: 'coffee', mode: 'single', min: 1, max: 1, prompt: 'Vamos ficar?', options: [{ id: 'yes', text: 'Sim.' }] },
      { type: 'end', outcome: 'success', text: 'Até a próxima.' }
    ] } }));
    await page.goto(`/${query}`);
    for (let i = 0; i < 3; i++) {
      await page.getByLabel('Seu nome').fill('Ana');
      await page.getByLabel('Idade', { exact: true }).fill('24');
      await page.getByLabel('Sexo', { exact: true }).selectOption('female');
      await page.getByRole('button', { name: /Que a noite comece/ }).click();
      await page.locator('input[value="yes"]').check();
      await page.getByRole('button', { name: /Essa é minha resposta/ }).click();
      await expect.poll(() => rpcs.length).toBe((i + 1) * 2);
      const [character, answer] = rpcs.slice(i * 2, i * 2 + 2);
      expect(character.body.p_email).toBe(email);
      expect(answer.body.p_session_id).toBe(character.body.p_session_id);
      // Receiving a POST is not confirmation that the client drained its queue.
      // Wait before reloading, otherwise the interrupted request is retried.
      await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cecilia.pending.v2') || '[]'))).toEqual([]);
      if (i === 0) {
        await page.getByRole('button', { name: /Encontrar de novo/ }).click();
        await page.getByRole('button', { name: /Começar de novo/ }).click();
      } else if (i === 1) await page.reload();
    }
    expect(new Set(rpcs.filter(rpc => rpc.url.endsWith('save_game_character')).map(rpc => rpc.body.p_session_id)).size).toBe(3);
    if (email) expect(logs.join('\n')).not.toContain(email);
  });
}
