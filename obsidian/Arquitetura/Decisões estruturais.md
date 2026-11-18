---
projeto: Cecilia
tipo: decisões_de_arquitetura
atualizado_em: 2026-11-13
estado: implementado_com_limitações_explícitas
---

# Decisões estruturais

Relacionado: [[Início]] · [[Projeto/Progresso|Progresso]] · [[Desenvolvimento/Ferramentas em uso|Ferramentas em uso]] · [[Desenvolvimento/Técnicas e verificações|Técnicas e verificações]]

Este documento distingue requisitos explícitos do usuário das decisões técnicas presentes no código. Não é autorização para modificar a arquitetura.

## Mapa do sistema

    Autoria: script.md
        → leitor do roteiro em server/story.js
        → plugin Vite em scripts/story-assets.js
        → dist/ com HTML, JavaScript, CSS, SVG, story.json e backend.json
        → Cloudflare Pages
        → navegador: interface DOM + cenários Phaser + fila de envios
        → API RPC do Supabase
        → funções SQL validadoras + tabelas protegidas

Separadamente, `npm run db:publish` usa a CLI autenticada para publicar no banco o roteiro canônico com suas marcações internas. Essa operação administrativa não acontece no navegador.

## DEC-01 — Produção estática, sem servidor Node permanente

**Origem:** direção aprovada pelo usuário para hospedagem estática. **Estado:** implementado e publicado.

- Publicar somente `dist/` no Cloudflare Pages Direct Upload.
- Manter Express e Node para desenvolvimento, testes e serviço local opcional; eles não participam do tráfego de produção do Pages.
- Não criar Pages Functions, Workers de aplicação ou banco Cloudflare para esta versão.

**Consequência:** a leitura do roteiro não depende de um servidor Express em produção. Editar `script.md` exige nova compilação e publicação. O salvamento remoto continua dependendo do Supabase e da rede.

**Evidências:** `package.json:9–16`, `scripts/story-assets.js`, `server/index.js`, [[Infraestrutura/Implantação Cloudflare|Implantação Cloudflare]].

## DEC-02 — Roteiro público e roteiro canônico separados

**Origem:** decisão técnica de implementação. **Estado:** implementado.

- `script.md` é a fonte autoral; não é o arquivo carregado pelo navegador em produção.
- `parseStory` valida a linguagem do roteiro e calcula uma versão SHA-256 do texto fonte.
- `publicStory` remove `save` e `correct` das opções antes de gerar o JSON público.
- `game_stories` mantém no banco a versão canônica com as marcações necessárias à validação.

**Consequência:** o cliente não escolhe quais textos/correções serão registrados. O roteiro público e a versão no banco precisam permanecer coerentes. A versão não torna o roteiro um segredo nem prova que o jogador o percorreu.

**Evidências:** `server/story.js:6–83`, `scripts/publish-database.js:19–25`.

## DEC-03 — Interface HTML acessível e cenários Phaser

**Origem:** estrutura da aplicação mantida. **Estado:** implementado.

- Phaser renderiza cenários SVG, transições e partículas no canvas.
- Formulários, diálogos, opções, progresso e lembranças são elementos DOM.
- Manter português, navegação por teclado e controle de animações; respeitar a preferência de movimento reduzido.

**Consequência:** a interface não precisa ser reimplementada dentro do canvas para funcionar. Preferências de animação e recursos de acessibilidade são funcionalidades do jogo, não indicadores técnicos a remover.

**Evidências:** `src/main.js:18–47`, `:65–123`, `:139–144`, `index.html` e `src/style.css`.

## DEC-04 — Persistência por RPC com validação no banco

**Origem:** pedido do usuário de reativar o envio ao banco; mecanismo definido na implementação. **Estado:** implementado e verificado remotamente.

- O navegador usa somente URL e chave publicável de `public/backend.json`.
- As chamadas públicas de escrita são `save_game_character` e `save_game_answer`.
- Tabelas: `characters`, `answers`, `submissions`, `game_session_keys` e `game_stories`.
- Funções conferem token, campos, versão, pergunta e seleção; texto e correção vêm do roteiro canônico.
- Somente opções marcadas `save` geram linhas em `answers`; `submissions` registra o hash da seleção para idempotência.
- RLS e permissões impedem acesso direto dos papéis públicos às tabelas.

**Consequência:** não é preciso distribuir uma chave secreta nem manter um backend Express para registrar escolhas. As funções continuam sendo um ponto público de coleta, sujeito a abuso; o token da partida não é autenticação de conta.

**Evidências:** `src/persistence.js:35–55`, `supabase/schema.sql` e [[Segurança/Riscos de segurança|Riscos de segurança]].

## DEC-05 — Fila de envios independente do andamento da história

**Origem:** funcionalidades preservadas após a clarificação do usuário. **Estado:** implementado.

- Enfileirar e tentar enviar em segundo plano, sem travar a narrativa.
- Persistir pendências na chave `cecilia.pending.v2`; usar memória quando o armazenamento não estiver disponível.
- Enviar personagem antes de suas respostas; impedir drenagens concorrentes da mesma instância.
- Reiniciar a partida cria outra identidade de sessão, mas preserva pendências anteriores.

**Consequência:** uma falha de gravação não interrompe o jogo. Isso não equivale a um jogo inteiramente offline nem a retomada do ponto narrativo: a página ainda precisa carregar seus arquivos, e recarregar volta à criação do personagem. Fechar a aba sem armazenamento perde pendências ainda não enviadas.

**Evidências:** `src/persistence.js:3–75`, `src/main.js:138–148`.

## DEC-06 — Estados técnicos no console, sem remover funcionalidades

**Origem:** requisito explícito e clarificado pelo usuário. **Estado:** implementado.

- Informações de conexão, envio, cache/armazenamento, fila e falhas técnicas ficam em `console.log`.
- Não mostrar indicadores técnicos de banco ou uma caixa de pendências na página.
- Preservar validação de formulário, progresso da história, lembretes da conversa, animações, reinício e mensagens funcionais de indisponibilidade da história.

**Consequência:** “somente console.log” não significa desabilitar gravação, novas tentativas ou interface. A primeira interpretação que retirou a persistência foi substituída após a clarificação.

**Evidências:** `src/main.js`, `src/persistence.js` e [[Projeto/Progresso|Histórico do progresso]].

## DEC-07 — Publicação manual verificável e domínio existente

**Origem:** publicação autorizada pelo usuário. **Estado:** site publicado; domínio personalizado pendente de DNS na última consulta.

- Usar o projeto Pages `cecilia-jogo`, com branch de produção `main` informada explicitamente.
- Usar o domínio existente `jogo.ratozumbi.com.br`, sem compra de domínio e sem migração automática dos nameservers.
- Manter `cecilia-jogo.pages.dev` como endereço já verificado enquanto o DNS personalizado não estiver operacional.
- Publicar o roteiro canônico antes de disponibilizar uma nova compilação que dependa dele.

**Consequência:** não há integração Git automática configurada; a raiz local também não é reconhecida como repositório Git. Upload bem-sucedido, associação do domínio, DNS e HTTPS são verificações diferentes.

**Evidências:** [[Infraestrutura/Implantação Cloudflare|Implantação Cloudflare]], `scripts/publish-database.js:41–45`.

## DEC-08 — Documentação local por tema; riscos sem remediação

**Origem:** regras explícitas do usuário. **Estado:** aplicado.

- Criar vaults dentro da pasta do projeto; padrão atual: `<raiz-do-projeto>/obsidian/`.
- Manter `Início.md` na raiz, `.obsidian/` preservado e notas em pastas temáticas.
- Registrar progresso, decisões, evidências e limites; atualizar links quando notas mudarem de pasta.
- Documentar os riscos conhecidos sem implementar CAPTCHA, limitação de frequência, gateway ou outras recomendações por iniciativa própria.
- Não iniciar recursos cobrados nem gastar créditos sem aprovação explícita.

**Consequência:** reorganizar ou atualizar documentos não altera código, permissões, DNS ou serviços externos. Recomendações continuam distintas de controles efetivamente presentes.
