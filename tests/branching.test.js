import test from 'node:test';
import assert from 'node:assert/strict';

test('supports named scene jumps, per-answer branches, and failure endings', async () => {
  const { parseStory, publicStory } = await import('../server/story.js');
  const story = parseStory(`# A date
@label start
@background cafe.svg
@question greeting single
How do you greet Cecilia?
- kind | Ask about her day. | save correct goto=walk
- rude | Look at your phone. | save incorrect goto=fail
@end
@label walk
Cecilia: Let's take a walk.
@finish success | A second date awaits.
@label fail
Cecilia: I think I'll head home.
@finish failure | The evening ends early.
`);
  assert.deepEqual(story.nodes[0], { type: 'label', id: 'start' });
  assert.equal(publicStory(story).nodes[2].options[0].goto, 'walk');
  assert.equal(story.nodes.at(-1).outcome, 'failure');
  assert.equal(story.nodes.at(-1).text, 'The evening ends early.');
  assert.throws(() => parseStory('@label repeat\n@label repeat'), /rótulo duplicado/i);
  assert.throws(() => parseStory('@question q multiple\nQ\n- a | A | goto=end\n- b | B\n@end\n@label end'), /seleção múltipla.*ramificações/i);
});
