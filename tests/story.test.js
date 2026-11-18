import test from 'node:test';
import assert from 'node:assert/strict';

const source = `# A little closer
@background cafe.svg
Cecilia: You made it.

@question coffee single
What would you like?
- espresso | An espresso. | save correct
- tea | A cup of tea.
@end
@question interests multiple min=1 max=2
What do you love?
- art | Art. | save
- music | Music. | save
- rain | Rain.
@end
@background garden.svg
You: A walk sounds lovely.
@finish Until next time.
`;

test('parses editable story text, optional flags, question modes and background changes', async () => {
  const { parseStory, publicStory } = await import('../server/story.js');
  const story = parseStory(source);
  assert.equal(story.title, 'A little closer');
  assert.match(story.version, /^[a-f0-9]{64}$/);
  assert.deepEqual(story.nodes[0], { type: 'background', file: 'cafe.svg' });
  assert.deepEqual(story.nodes[1], { type: 'dialogue', speaker: 'Cecilia', text: 'You made it.' });
  const coffee = story.nodes[2];
  assert.equal(coffee.id, 'coffee');
  assert.equal(coffee.mode, 'single');
  assert.equal(coffee.min, 1);
  assert.equal(coffee.max, 1);
  assert.deepEqual(coffee.options[0], { id: 'espresso', text: 'An espresso.', save: true, correct: true });
  assert.equal(coffee.options[1].correct, null);
  assert.equal(coffee.options[1].save, false);
  assert.equal(story.nodes[3].max, 2);
  assert.equal(story.nodes[4].file, 'garden.svg');
  assert.deepEqual(story.nodes.at(-1), { type: 'end', text: 'Until next time.' });
  const clean = publicStory(story);
  assert.equal(clean.nodes[2].options[0].save, undefined);
  assert.equal(clean.nodes[2].options[0].correct, undefined);
  assert.equal(story.nodes[2].options[0].save, true);
});

export { source };
