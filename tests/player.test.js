import test from 'node:test';
import assert from 'node:assert/strict';
import * as player from '../src/player.js';
const { nextPlayable } = player;

test('branches resolve labels and jumps while end stops immediately', () => {
  const nodes = [{type:'label',id:'cafe'},{type:'dialogue',text:'Hello'},{type:'jump',target:'yes'},{type:'end',text:'No',outcome:'failure'},{type:'label',id:'yes'},{type:'background',file:'garden.svg'},{type:'end',text:'Yes',outcome:'success'}];
  assert.equal(nextPlayable(nodes,-1).index,1);
  assert.deepEqual(nextPlayable(nodes,1), {index:6,background:'garden.svg'});
  assert.equal(nextPlayable(nodes,3).index,3);
  assert.equal(nextPlayable(nodes,1,'yes').index,6);
});

test('character validation enforces adults without storing character data', () => {
  assert.deepEqual(player.validateCharacter({name:'  Ana  ',age:'24',sex:'female'}), {name:'Ana',age:24,sex:'female'});
  for (const age of [17,121,'x',18.2]) assert.equal(player.validateCharacter({name:'Ana',age,sex:'female'}),null);
  assert.equal(player.validateCharacter({name:' ',age:20,sex:'other'}),null);
  assert.equal(player.validateCharacter({name:'Ana',age:20,sex:'bad'}),null);
});


test('advance consumes scenery without skipping dialogue and stops at end', () => {
  const nodes = [{type:'background',file:'cafe.svg'}, {type:'dialogue',text:'Hi'}, {type:'background',file:'garden.svg'}, {type:'end',text:'Bye'}];
  assert.deepEqual(nextPlayable(nodes, -1), {index:1, background:'cafe.svg'});
  assert.deepEqual(nextPlayable(nodes, 1), {index:3, background:'garden.svg'});
  assert.equal(nextPlayable(nodes, 3).index, 3);
});

test('selection respects radio replacement, checkbox limits and valid option IDs', () => {
  const q = {mode:'multiple', min:1, max:2, options:[{id:'a'},{id:'b'},{id:'c'}]};
  assert.deepEqual(player.toggleOption(q, ['a'], 'b'), ['a','b']);
  assert.deepEqual(player.toggleOption(q, ['a','b'], 'c'), ['a','b']);
  assert.deepEqual(player.toggleOption(q, ['a','b'], 'a'), ['b']);
  assert.deepEqual(player.toggleOption({...q,mode:'single'}, ['a'], 'b'), ['b']);
  assert.equal(player.selectionValid(q, []), false);
  assert.equal(player.selectionValid(q, ['a','a']), false);
  assert.equal(player.selectionValid(q, ['fake']), false);
  assert.equal(player.selectionValid(q, ['a','b']), true);
});
