import { createHash } from 'node:crypto';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEX = new Set(['female', 'male', 'other', 'prefer_not_to_say']);
export function validateCharacter(body) {
  if (!body || !UUID.test(body.sessionId) || typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 60 || /[\u0000-\u001f\u007f]/.test(body.name) || !Number.isInteger(body.age) || body.age < 18 || body.age > 120 || !SEX.has(body.sex)) {
    throw new HttpError(400, 'Enter a name (1–60 characters), an age from 18 to 120, and a valid sex selection.');
  }
  return { sessionId: body.sessionId, name: body.name.trim(), age: body.age, sex: body.sex };
}

export function validateAnswers(body, story) {
  const allowed = new Set(['sessionId', 'storyVersion', 'questionId', 'optionIds']);
  if (!body || typeof body !== 'object' || Object.keys(body).some(key => !allowed.has(key)) || !UUID.test(body.sessionId)) throw new HttpError(400, 'Invalid answer submission.');
  if (body.storyVersion !== story.version) throw new HttpError(409, 'The story changed. Restart to play the current version.');
  const question = story.nodes.find(node => node.type === 'question' && node.id === body.questionId);
  const ids = body.optionIds;
  if (!question || !Array.isArray(ids) || ids.length < question.min || ids.length > question.max || new Set(ids).size !== ids.length || ids.some(id => !question.options.some(option => option.id === id))) throw new HttpError(400, 'Choose a valid number of available answers.');
  return {
    sessionId: body.sessionId,
    storyVersion: story.version,
    questionId: question.id,
    selectionHash: createHash('sha256').update(JSON.stringify([...ids].sort())).digest('hex'),
    rows: question.options.filter(option => ids.includes(option.id) && option.save).map(option => ({ session_id: body.sessionId, story_version: story.version, question_id: question.id, option_id: option.id, option_text: option.text, correct: option.correct }))
  };
}

