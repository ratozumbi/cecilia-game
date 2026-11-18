---
projeto: Cecilia
tipo: inventário_técnico
atualizado_em: 2026-11-13
---

# Ferramentas em uso

Relacionado: [[Início]] · [[Projeto/Progresso|Progresso]] · [[Arquitetura/Decisões estruturais|Decisões estruturais]] · [[Desenvolvimento/Técnicas e verificações|Técnicas e verificações]]

## Escopo e origem das versões

Versões locais abaixo foram obtidas de `node --version`, `npm --version` e `npm ls --depth=0 --json` durante a atualização documental. Não são recomendações de “última versão”. Os intervalos do manifesto e as versões efetivamente instaladas são informações diferentes; `package-lock.json` registra a resolução das dependências.

## Runtime e dependências locais

| Ferramenta | Versão instalada observada | Papel no projeto |
| --- | --- | --- |
| Node.js | 22.22.2 | Compilação, leitor do roteiro, scripts administrativos, testes e servidor local |
| npm | 10.9.7 | Instalação e execução dos comandos de `package.json` |
| Phaser | 3.90.0 | Canvas de cenários, transições e partículas |
| Vite | 7.3.8 | Desenvolvimento, compilação estática, plugin do roteiro e prévia local |
| Express | 5.3.0 | Servidor local de desenvolvimento/produção opcional e API auxiliar |
| express-rate-limit | 8.7.4 | Limite da API Express local; não protege as RPCs públicas da produção estática |
| @playwright/test | 1.65.0 | Testes E2E desktop/mobile, capturas e traces de falhas |
| @electric-sql/pglite | 0.5.16 | Execução local do esquema PostgreSQL para testes de validação e permissões |

O manifesto exige Node `>=22.12`. A instalação local foi inspecionada; nenhum pacote foi atualizado nesta tarefa documental.

## Serviços externos utilizados

### Cloudflare Pages

- Hospedagem dos arquivos de `dist/`, via Direct Upload.
- Projeto: `cecilia-jogo`; branch de produção: `main`.
- Site verificado: https://cecilia-jogo.pages.dev
- Sem servidor Node permanente e sem Pages Functions da aplicação nesta implantação.
- Domínio pretendido: `jogo.ratozumbi.com.br`; ver situação em [[Infraestrutura/Implantação Cloudflare|Implantação Cloudflare]].

### Supabase / PostgreSQL

- Banco remoto existente e API de RPC para personagem e respostas.
- Não usa SDK Supabase no frontend; `src/persistence.js` usa `fetch` nativo.
- O navegador recebe somente configuração publicável; nenhuma chave secreta deve entrar no bundle ou nas notas.
- A CLI Supabase `3.1.0` está fixada no script administrativo de publicação do banco.
- Versão do servidor PostgreSQL não foi novamente consultada nesta documentação.

### Registro.br

- DNS autoritativo do domínio na última verificação da configuração.
- CNAME necessário: `jogo` → `cecilia-jogo.pages.dev`.
- Não foi concluído acesso administrativo ao Registro.br nem foi modificado o DNS por esta tarefa.

## Ferramentas de operação e do agente

| Ferramenta | Uso efetivo | Limite ou observação |
| --- | --- | --- |
| Wrangler | Autenticação e publicação do Pages | Versão usada na implantação: 4.161.0; não foi reinstalada nem atualizada nesta documentação |
| MCP Cloudflare | Consulta à documentação, descoberta da API e operações autorizadas | OAuth e quatro ferramentas: `docs`, `search`, `execute`, `whoami` |
| Hermes Agent | Edição de arquivos, execução de verificações, automação de navegador e coordenação de subtarefas | Somente o perfil padrão foi configurado |
| Skills oficiais Cloudflare | Procedimentos consultáveis pelo agente | 15 instaladas e sete bloqueadas pelo scanner; ver [[Infraestrutura/Ambiente Cloudflare|Ambiente Cloudflare]] |
| Python / pathlib / hashlib | Inventário, movimentação e comparação de arquivos do vault | Ferramenta de manutenção, não runtime do jogo |
| Chrome / Chromium | Verificações reais de interface e execução do Playwright | O teste usa Chrome instalado quando disponível; `PLAYWRIGHT_CHANNEL` pode selecionar o canal |
| Obsidian | Navegação das notas locais, links e organização por temas | Vault em `H:\dev\cecilia\obsidian` |
| Git | Disponibilidade verificada, mas não integrado a esta raiz | `git rev-parse` não reconheceu a pasta atual como repositório |

A skill `cf-cli` é um pacote de conhecimento instalado; a CLI beta executável `cf` não foi instalada nesta implementação. Instalar documentação de uma ferramenta não instala seu executável.

## Comandos existentes e seus efeitos

Executar a partir de `H:\dev\cecilia`:

| Comando | Efeito | Altera serviço remoto? |
| --- | --- | --- |
| `npm install` | Instala dependências; pode atualizar a resolução conforme as regras do npm | Não altera o banco nem a hospedagem |
| `npm ci` | Instala dependências a partir do lockfile; requer consistência com o manifesto | Não altera o banco nem a hospedagem |
| `npm run dev` | Inicia servidor Express com Vite; padrão `127.0.0.1:3000` | Não por si só; jogar pode enviar dados ao banco configurado |
| `npm run build` | Gera a pasta `dist/` e o roteiro público | Não |
| `npm run preview` | Serve `dist/` localmente com Vite | Não por si só; jogar pode enviar dados ao banco configurado |
| `npm start` | Serve `dist/` localmente com Express; padrão `127.0.0.1:3000` | Não por si só; jogar pode enviar dados ao banco configurado |
| `npm test` | Executa testes Node, inclusive PGlite e compilação em pasta isolada | Não testa gravação no banco remoto |
| `npm run test:e2e` | Executa os testes de navegador com RPCs interceptadas | Não cria partidas reais |
| `npm run db:publish` | Aplica esquema e publica roteiro canônico no banco existente | **Sim; operação administrativa autorizada separadamente** |
| `npx wrangler pages deploy dist --project-name cecilia-jogo --branch main` | Publica a compilação no projeto Pages | **Sim; muda o site público** |

Os servidores locais são processos em primeiro plano: manter o terminal aberto enquanto estiverem em uso e encerrar com `Ctrl+C`. `HOST` e `PORT` podem alterar os padrões do servidor Express. Testes E2E usam sua própria prévia em `127.0.0.1:3007`.

Os comandos que alteram serviços remotos estão listados como referência, não foram executados nesta atualização. Não publicar a raiz do projeto, o vault, `.env`, dados locais ou arquivos SQL no lugar de `dist/`.
