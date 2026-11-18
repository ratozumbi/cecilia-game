---
projeto: Cecilia
avaliado_em: 2026-11-13
estado: documentado_sem_remediação
escopo: revisão direcionada do código local
---

# Riscos de segurança

Relacionado: [[Início]] · [[Infraestrutura/Implantação Cloudflare|Implantação Cloudflare]]

## Escopo e decisão

Registro direcionado das lacunas discutidas antes da publicação. Base: leitura de `src/persistence.js`, `src/main.js` e `supabase/schema.sql` em `H:\dev\cecilia`. As prioridades abaixo são estimativas para uma demonstração pública; não constituem pontuação CVSS nem auditoria integral.

**Decisão do usuário: documentar, sem executar correções.** Não foram adicionados CAPTCHA, limitação de frequência, gateway, autenticação de conta ou expiração. Nenhuma alteração de segurança no aplicativo ou no banco foi autorizada nesta etapa.

## Proteções já presentes

- RLS habilitada nas cinco tabelas do jogo, com acesso direto revogado de `PUBLIC`, `anon` e `authenticated`: `supabase/schema.sql:37–43`.
- RPCs com `SECURITY DEFINER`, caminho de busca vazio e nomes de tabelas qualificados.
- Token aleatório por partida; somente seu hash é armazenado no banco. O token é necessário para os registros daquela sessão.
- Validação de idade declarada, nome e opção de sexo; respostas conferidas contra o roteiro canônico.
- Texto e correção derivados pelo banco, não aceitos do navegador.
- Reenvios idênticos idempotentes e alterações conflitantes recusadas.

Essas medidas não são uma proteção contra criação massiva de novas sessões.

## SEG-01 — Criação pública de sessões sem barreira contra automação

**Prioridade sugerida: alta antes de divulgação ampla.**

Evidências:
- `supabase/schema.sql:84` permite ao papel `anon` executar `save_game_character`.
- `src/persistence.js:63–65` gera identificador e token no navegador, sem prova externa de legitimidade.
- A função valida os campos, mas não aplica limite por IP, CAPTCHA ou uma cota global de novas sessões.

Impacto plausível: um script pode criar muitas partidas válidas e consumir espaço, processamento e limites do projeto. Não é necessário roubar uma chave secreta; a chave publicável é pública por definição.

Recomendação não executada: verificação Turnstile validada no servidor, limites por IP/sessão e cota global. Monitorar volume sem registrar tokens ou dados pessoais desnecessários.

## SEG-02 — Chamadas diretas às RPCs contornariam uma proteção apenas no site

**Prioridade sugerida: alta caso seja introduzido um CAPTCHA ou gateway.**

Evidências:
- `src/persistence.js:40–42` envia pedidos diretamente à API de RPC do Supabase.
- `supabase/schema.sql:84` e `:160` concedem execução aos papéis públicos do cliente.

Estado atual: esse caminho direto é intencional na arquitetura existente. A lacuna está em não existir uma camada obrigatória de controle contra abuso. Ocultar botões, esconder a URL ou validar somente no JavaScript não fecha esse caminho.

Recomendação não executada: centralizar a entrada numa função protegida e retirar as permissões de execução direta dos visitantes. A função intermediária usaria uma identidade restrita no servidor. Não colocar chaves secretas no site.

## SEG-03 — Token de partida não identifica uma pessoa nem atesta o percurso

**Prioridade sugerida: média; alta se os dados forem usados como avaliação ou pesquisa identificável.**

Evidências:
- O token prova posse da credencial da sessão, não uma identidade de conta.
- `save_game_answer` valida versão, pergunta e opções, mas não verifica que as cenas anteriores foram realmente percorridas na ordem narrativa.
- A idade é declarada, não verificada documentalmente.

Impacto plausível: partidas inventadas, respostas fora da ordem e várias sessões pela mesma pessoa podem ser aceitas. Isso não equivale a acesso a sessões de outras pessoas.

Recomendação não executada: definir se é necessária autenticação de conta ou validação de transições no servidor. Não tratar registros como avaliação à prova de fraude ou comprovação de maioridade.

## SEG-04 — Credenciais e dados pendentes no armazenamento local

**Prioridade sugerida: média, condicionada ao uso de dados reais ou a comprometimento do navegador.**

Evidências:
- `src/persistence.js:7`, `:12` e `:16` restauram e persistem entradas com dados, identificador e token em `localStorage`, na chave `cecilia.pending.v2`.
- A fila local permite recuperar envios após recarregar; isso é funcionalidade deliberada, não vulnerabilidade por si só.

Impacto condicional: se houver XSS na mesma origem, extensão maliciosa ou acesso ao perfil local do navegador, a fila e os tokens pendentes podem ser lidos. **Não foi identificada nem explorada uma falha de XSS nesta revisão.**

Recomendação não executada: avaliar política de retenção local, isolamento da origem e medidas contra XSS. Manter tokens fora dos logs. Não remover a persistência sem preservar os requisitos de novas tentativas.

## SEG-05 — Ausência de expiração e política de retenção no código revisado

**Prioridade sugerida: média.**

Evidências:
- `public.game_session_keys` armazena `session_id` e `token_hash`, sem prazo de validade: `supabase/schema.sql:28–31`.
- As funções não aplicam TTL de sessão.
- A fila local retém recusas permanentes para diagnóstico e não contém rotina de expiração.

Impacto plausível: retenção indefinida de registros/pendências e maior tempo de utilidade de credenciais eventualmente comprometidas. A revisão não investigou eventuais tarefas administrativas externas ao repositório.

Recomendação não executada: estabelecer retenção, prazo de validade e exclusão controlada. Conciliar o prazo com partidas longas e reenvios offline; não descartar pendências silenciosamente.

## SEG-06 — Dados do personagem no console do navegador

**Prioridade sugerida: baixa para personagens fictícios; reavaliar se houver dados reais.**

Evidência: `src/main.js` registra o objeto do personagem em `console.log('Personagem criado:', input)` e registra identificadores das escolhas.

Impacto condicional: dados podem aparecer em capturas de tela, compartilhamento do console ou extensões. Não foi identificado envio desses logs a um serviço externo. O token da sessão não é incluído nos logs técnicos revisados.

Recomendação não executada: revisar a necessidade de valores pessoais em logs, sem mudar a convenção de exibir estados técnicos somente no console.

## Não confundir com falhas demonstradas

- Chave publicável exposta é parte prevista do funcionamento, não vazamento de chave secreta.
- Os testes anteriores confirmaram rejeição de leitura direta e de token incorreto; este documento não afirma acesso público irrestrito às tabelas.
- A presença de CORS não substitui autenticação ou controle de abuso.
- Limitar somente cliques no navegador não impede scripts externos.
- Nenhuma exploração de carga, tentativa de invasão ou alteração de permissões foi executada para produzir este documento.

## Critérios para uma futura resolução, se autorizada

1. Pedidos sem verificação válida não criam novas partidas.
2. Pedidos diretos às RPCs públicas não contornam a camada protegida.
3. Limites persistem entre instâncias concorrentes e distinguem abuso de usuários em rede compartilhada.
4. Reenvios legítimos continuam idempotentes; falhas temporárias não perdem respostas.
5. Sessões e pendências seguem uma política de retenção explícita.
6. A interface permanece em português, sem estados técnicos na página.

**Estado de todos os itens: documentados; sem remediação nesta etapa.**
