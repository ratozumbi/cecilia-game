import test from 'node:test';
import assert from 'node:assert/strict';

test('rejects malformed authoring with useful line-numbered errors', async () => {
  const { parseStory } = await import('../server/story.js');
  const invalid = [
    ['@background ../.env', /fundo.*linha 1/i],
    ['@question x single\nQ?\n- a | A\n@end', /pelo menos duas/i],
    ['@question x multiple min=3 max=1\nQ?\n- a | A\n- b | B\n@end', /limites/i],
    ['@question x single\nQ?\n- a | A\n- a | B\n@end', /identificador de opção duplicado/i],
    ['@question x single\nQ?\n- a | A | correct incorrect\n- b | B\n@end', /conflitantes/i],
    ['@question x single\nQ?\n- a | A | typo\n- b | B\n@end', /sinalizador desconhecido/i],
    ['@question x single\nQ?\n- a | A', /pergunta não encerrada/i],
    ['@end', /inesperado/i],
    ['@something else', /diretiva desconhecida/i],
    ['@question x single\nQ?\n- a | A\n- b | B\n@end\n@question x single\nQ?\n- a | A\n- b | B\n@end', /identificador de pergunta duplicado/i],
    ['@question x single\n@background cafe.svg', /dentro de uma pergunta/i],
    ['@jump missing', /rótulo de destino desconhecido/i]
  ];
  for (const [text, expected] of invalid) assert.throws(() => parseStory(text), expected);
});

test('usa narrador e encerramento padrão em português', async () => {
  const { parseStory } = await import('../server/story.js');
  const story = parseStory('Uma tarde tranquila.');
  assert.equal(story.nodes[0].speaker, 'Narrador');
  assert.deepEqual(story.nodes.at(-1), { type: 'end', text: 'Até a próxima.' });
});
