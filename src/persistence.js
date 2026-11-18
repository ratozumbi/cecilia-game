export const STORAGE_KEY = 'cecilia.pending.v2';

export function createPersistence({ storage, config, email = null, fetch = globalThis.fetch, log = console.log } = {}) {
  let entries = [], current, running, configuration;
  try {
    const saved = JSON.parse(storage?.getItem(STORAGE_KEY) || '[]');
    if (Array.isArray(saved)) entries = saved.filter(entry => entry && ['character', 'answer'].includes(entry.kind) && entry.payload && typeof entry.sessionId === 'string' && typeof entry.token === 'string');
  } catch { log('Armazenamento indisponível: os envios pendentes ficam somente nesta aba.'); }
  const persist = () => {
    try {
      if (!storage) throw new Error();
      storage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch { log('Armazenamento indisponível: os envios pendentes ficam somente nesta aba.'); }
  };
  const enqueue = (kind, payload) => {
    entries.push({ kind, payload, ...current, blocked: false });
    persist();
    log('Envio pendente:', { tipo: kind, quantidade: entries.length });
  };
  const loadConfig = async () => {
    if (config) return config;
    if (!configuration) configuration = fetch('/backend.json', { signal: AbortSignal.timeout(10000) }).then(async response => {
      if (!response.ok) throw new Error();
      const value = await response.json();
      if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(value.url) || !value.publishableKey?.startsWith('sb_publishable_')) throw new Error();
      return value;
    }).catch(() => { configuration = undefined; throw new Error('Configuração pública do banco indisponível.'); });
    return configuration;
  };
  const drain = async () => {
    while (true) {
      const entry = entries.find(item => !item.blocked && (item.kind === 'character' || !entries.some(other => other.kind === 'character' && other.sessionId === item.sessionId)));
      if (!entry) return;
      try {
        const settings = await loadConfig();
        const payload = entry.payload;
        const body = { p_session_id: entry.sessionId, p_token: entry.token, ...(entry.kind === 'character'
          ? { p_name: payload.name, p_age: payload.age, p_sex: payload.sex, ...(entry.email ? { p_email: entry.email } : {}) }
          : { p_story_version: payload.storyVersion, p_question_id: payload.questionId, p_option_ids: payload.optionIds }) };
        const response = await fetch(`${settings.url}/rest/v1/rpc/save_game_${entry.kind}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', apikey: settings.publishableKey },
          body: JSON.stringify(body), signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) {
          entry.blocked = response.status >= 400 && response.status < 500 && ![401, 403, 408, 429].includes(response.status);
          persist();
          log(entry.blocked ? 'Envio recusado:' : 'Envio adiado:', { tipo: entry.kind, status: response.status, quantidade: entries.length });
          if (entry.blocked) continue;
          return;
        }
        const result = await response.json();
        if (!['saved', 'not-recorded'].includes(result?.status)) throw new Error('Resposta do banco não reconhecida.');
        entries = entries.filter(item => item !== entry);
        persist();
        log('Envio concluído:', { tipo: entry.kind, status: result.status, registrados: result.recorded ?? 0, pendentes: entries.length });
      } catch {
        log('Envio adiado: nova tentativa ao recuperar a conexão.', { tipo: entry.kind, pendentes: entries.length });
        return;
      }
    }
  };
  return {
    beginCharacter(character) {
      current = { sessionId: crypto.randomUUID(), token: crypto.randomUUID(), email };
      enqueue('character', { ...character });
    },
    recordAnswer(answer) {
      if (!current) throw new Error('Crie um personagem antes de responder.');
      enqueue('answer', { ...answer, optionIds: [...answer.optionIds] });
    },
    restart() { current = undefined; },
    flush() {
      if (!running) running = drain().finally(() => { running = undefined; });
      return running;
    }
  };
}
