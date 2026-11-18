import { createHash } from 'node:crypto';

const ID = /^[a-z][a-z0-9_-]{0,63}$/;
const BACKGROUND = /^[a-zA-Z0-9][a-zA-Z0-9_-]*\.(?:svg|png|jpe?g|webp)$/;

export function parseStory(source) {
  const nodes = [], questionIds = new Set(), labels = new Set(), references = [];
  let title = 'Cecília', question = null, questionLine = 0;
  const fail = (message, line) => { throw new Error(`${message} (linha ${line})`); };
  for (const [index, raw] of source.split(/\r?\n/).entries()) {
    const lineNo = index + 1, line = raw.trim();
    if (!line || (line.startsWith('<!--') && line.endsWith('-->'))) continue;
    if (question) {
      if (line === '@end') {
        if (!question.prompt) fail('O enunciado da pergunta está vazio', questionLine);
        if (question.options.length < 2) fail('A pergunta precisa de pelo menos duas opções', questionLine);
        if (question.max === null) question.max = question.options.length;
        if (!Number.isInteger(question.min) || !Number.isInteger(question.max) || question.min < 1 || question.max < question.min || question.max > question.options.length || (question.mode === 'single' && (question.min !== 1 || question.max !== 1))) fail('Limites de seleção inválidos', questionLine);
        nodes.push(question); question = null;
      } else if (line.startsWith('@')) {
        fail('Diretiva inesperada dentro de uma pergunta; encerre-a com @end', lineNo);
      } else if (line.startsWith('- ')) {
        const parts = line.slice(2).split('|').map(part => part.trim());
        if (parts.length < 2 || parts.length > 3 || !ID.test(parts[0]) || !parts[1]) fail('Resposta inválida: use - id | texto | sinalizadores opcionais', lineNo);
        const [id, text, flags = ''] = parts;
        if (question.options.some(option => option.id === id)) fail('Identificador de opção duplicado', lineNo);
        const tags = flags.split(/\s+/).filter(Boolean);
        for (const tag of tags) if (!['save', 'correct', 'incorrect'].includes(tag) && !/^goto=[a-z][a-z0-9_-]{0,63}$/.test(tag)) fail(`Sinalizador desconhecido: ${tag}`, lineNo);
        if (tags.includes('correct') && tags.includes('incorrect')) fail('Sinalizadores de correção conflitantes', lineNo);
        const destinations = tags.filter(tag => tag.startsWith('goto='));
        if (destinations.length > 1) fail('É permitido apenas um goto por resposta', lineNo);
        const option = { id, text, save: tags.includes('save'), correct: tags.includes('correct') ? true : tags.includes('incorrect') ? false : null };
        if (destinations.length) {
          if (question.mode === 'multiple') fail('Perguntas de seleção múltipla não permitem ramificações; use uma pergunta de seleção única em seguida', lineNo);
          option.goto = destinations[0].slice(5); references.push([option.goto, lineNo]);
        }
        question.options.push(option);
      } else question.prompt += `${question.prompt ? '\n' : ''}${line}`;
      continue;
    }
    if (line.startsWith('# ')) { title = line.slice(2); continue; }
    if (line.startsWith('@background ')) {
      const file = line.slice(12).trim();
      if (!BACKGROUND.test(file)) fail('Nome de arquivo de fundo inválido; use um nome sem pastas', lineNo);
      nodes.push({ type: 'background', file });
    } else if (line.startsWith('@question ')) {
      const [id, mode = 'single', ...settings] = line.slice(10).split(/\s+/);
      if (!ID.test(id) || !['single', 'multiple'].includes(mode)) fail('Identificador ou modo de pergunta inválido', lineNo);
      if (questionIds.has(id)) fail('Identificador de pergunta duplicado', lineNo);
      questionIds.add(id);
      const limits = {};
      for (const setting of settings) {
        const match = /^(min|max)=(\d+)$/.exec(setting);
        if (!match || match[1] in limits) fail('Configuração de pergunta inválida ou duplicada', lineNo);
        limits[match[1]] = Number(match[2]);
      }
      question = { type: 'question', id, mode, min: limits.min ?? 1, max: limits.max ?? (mode === 'single' ? 1 : null), prompt: '', options: [] }; questionLine = lineNo;
    } else if (line.startsWith('@label ')) {
      const id = line.slice(7).trim();
      if (!ID.test(id)) fail('Identificador de rótulo inválido', lineNo);
      if (labels.has(id)) fail('Rótulo duplicado', lineNo);
      labels.add(id); nodes.push({ type: 'label', id });
    } else if (line.startsWith('@jump ')) {
      const target = line.slice(6).trim();
      if (!ID.test(target)) fail('Rótulo de salto inválido', lineNo);
      references.push([target, lineNo]); nodes.push({ type: 'jump', target });
    } else if (line.startsWith('@finish ')) {
      const payload = line.slice(8), match = /^(success|failure)\s*\|\s*(.+)$/.exec(payload);
      nodes.push(match ? { type: 'end', outcome: match[1], text: match[2] } : { type: 'end', text: payload });
    } else if (line.startsWith('@')) fail('@end inesperado ou diretiva desconhecida', lineNo);
    else {
      const colon = line.indexOf(':');
      nodes.push({ type: 'dialogue', speaker: colon > 0 ? line.slice(0, colon).trim() : 'Narrador', text: colon > 0 ? line.slice(colon + 1).trim() : line });
    }
  }
  if (question) fail('Pergunta não encerrada; esperado @end', questionLine);
  for (const [target, lineNo] of references) if (!labels.has(target)) fail(`Rótulo de destino desconhecido: ${target}`, lineNo);
  if (!nodes.some(node => node.type === 'end')) nodes.push({ type: 'end', text: 'Até a próxima.' });
  return { id: 'cecilia', title, version: createHash('sha256').update(source).digest('hex'), nodes };
}

export function publicStory(story) {
  return { ...story, nodes: story.nodes.map(node => node.type === 'question' ? { ...node, options: node.options.map(({ id, text, goto }) => ({ id, text, ...(goto ? { goto } : {}) })) } : { ...node }) };
}
