export function toggleOption(question, selected, id) {
  if (!question.options.some(option => option.id === id)) return selected;
  if (question.mode === 'single') return [id];
  if (selected.includes(id)) return selected.filter(value => value !== id);
  return selected.length < (question.max ?? question.options.length) ? [...selected, id] : selected;
}

export function selectionValid(question, selected) {
  return new Set(selected).size === selected.length && selected.length >= (question.min ?? 1)
    && selected.length <= (question.mode === 'single' ? 1 : question.max ?? question.options.length)
    && selected.every(id => question.options.some(option => option.id === id));
}

export function validateCharacter(input) {
  const name = String(input.name ?? '').trim();
  const age = Number(input.age);
  return name.length >= 1 && name.length <= 60 && Number.isInteger(age) && age >= 18 && age <= 120 && ['female','male','other','prefer_not_to_say'].includes(input.sex) ? {name,age,sex:input.sex} : null;
}

export function nextPlayable(nodes, current, target) {
  if (nodes[current]?.type === 'end' && !target) return {index:current};
  const labelIndex = id => {
    const index = nodes.findIndex(node => node.type === 'label' && node.id === id);
    if (index < 0) throw Error(`Trecho da história não encontrado: ${id}`);
    return index;
  };
  let index = target ? labelIndex(target) : current + 1;
  let background;
  let steps = 0;
  while (nodes[index] && ['background','label','jump'].includes(nodes[index].type)) {
    if (++steps > nodes.length * 2) throw Error('A história contém um caminho circular.');
    const node = nodes[index];
    if (node.type === 'background') background = node.file;
    index = node.type === 'jump' ? labelIndex(node.target) : index + 1;
  }
  if (!nodes[index]) throw Error('Este caminho da história não tem um final.');
  return {index,...(background ? {background} : {})};
}
