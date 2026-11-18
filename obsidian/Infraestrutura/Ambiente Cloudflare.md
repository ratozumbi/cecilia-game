---
criado_em: 2026-11-13
estado: mcp_ativo_skills_parcialmente_instaladas
---

# Ambiente Cloudflare

Relacionado: [[Infraestrutura/Implantação Cloudflare|Implantação Cloudflare]] · [[Segurança/Riscos de segurança|Riscos de segurança]]

## Solicitação

O usuário solicitou buscar e executar as instruções oficiais de preparação de agentes publicadas em https://developers.cloudflare.com/agent-setup/prompt.md.

O agente desta sessão é Hermes. Os exemplos específicos de Claude Code, Codex, Pi e outros agentes não devem alterar configurações desses outros aplicativos nem de perfis Hermes diferentes.

## Escopo

- Instalar as skills oficiais de `cloudflare/skills` no perfil Hermes padrão, preservando a verificação de segurança e os arquivos de apoio.
- Registrar o MCP remoto oficial https://mcp.cloudflare.com/mcp no Hermes com OAuth.
- Manter o Wrangler já autenticado para a publicação do Pages.
- Não instalar a CLI beta opcional `cf` sem escolha específica do usuário.
- Não executar remediações de [[Segurança/Riscos de segurança|Riscos de segurança]].

## Estado confirmado

- O site foi publicado e verificado: https://cecilia-jogo.pages.dev.
- Wrangler autenticado com permissões `account:read`, `user:read` e `pages:write`.
- O MCP `cloudflare` consta como habilitado em `hermes mcp list`, com URL `https://mcp.cloudflare.com/mcp` e autenticação OAuth configurada.
- A conexão inicial do assistente interativo excedeu seu limite de 30 segundos. O processo foi encerrado; a configuração foi registrada pela CLI nativa `hermes config set`, sem edição manual do YAML e preservando o MCP `rea`.
- O fluxo explícito `hermes mcp login cloudflare` foi autorizado no navegador e terminou com sucesso. A autenticação do MCP é independente do Wrangler.
- `hermes mcp test cloudflare` confirmou conexão HTTP com OAuth e quatro ferramentas disponíveis: `docs`, `search`, `execute` e `whoami`. O runtime recarregou o MCP na sessão corrente; uma chamada real a `whoami` confirmou a identidade autenticada. Não é necessário reiniciar esta sessão para ativar esse MCP.
- Foram instaladas e descobertas pelo Hermes **15 de 22 skills oficiais**. A verificação independente comparou os 62 arquivos instalados, incluindo 47 arquivos de apoio, com o ZIP upstream e não encontrou divergências de hash. Os sete destinos bloqueados estão ausentes.
- As sete skills restantes foram bloqueadas pelo scanner de segurança. Nenhum bloqueio foi ignorado, nenhuma skill upstream foi editada e nenhum perfil diferente foi alterado. Bloqueio automático não é conclusão de que o conteúdo seja malicioso; requer revisão antes de qualquer decisão de instalação.

## Skills instaladas

`agents-sdk`, `cf-cli`, `cloudflare-app-bootstrap`, `cloudflare-email-service`, `durable-objects`, `frameworks-on-cloudflare`, `gateway-workers`, `k2`, `nextjs-on-cloudflare`, `sandbox-next`, `web-perf`, `workers-best-practices`, `workers-development`, `workers-profiling` e `wrangler`.

## Skills bloqueadas — não instaladas

`basin`, `cloudflare-one-migrations`, `cloudflare-one`, `cloudflare`, `sandbox-migrate-to-next`, `sandbox-stable` e `turnstile-spin`.

Commit upstream registrado: `cbf893b954222276bf1af57e5f23379231e0efb9`.

Relatório detalhado e logs locais: `C:\Users\bruno\AppData\Local\hermes\cache\scratch\cloudflare-skills-install\report.json`. Esse caminho fica no cache e não deve ser tratado como arquivo permanente do vault.

O pacote de conhecimento `cf-cli` foi instalado, mas a CLI beta executável `cf` continua não instalada. A documentação de uma ferramenta não equivale à instalação do executável.

## Caminhos

- Perfil ativo: `C:\Users\bruno\AppData\Local\hermes`.
- Configuração do MCP: `C:\Users\bruno\AppData\Local\hermes\config.yaml`.
- Skills do perfil: `C:\Users\bruno\AppData\Local\hermes\skills`.
- Inicializador local da CLI: `C:\Users\bruno\AppData\Local\hermes\bin\hermes.cmd`.

Não copiar credenciais para este vault. Nenhum arquivo de tokens foi lido para produzir esta nota.

## Referências

- Instruções Cloudflare: https://developers.cloudflare.com/agent-setup/prompt.md
- MCP no Hermes: https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp
- Repositório oficial de skills: https://github.com/cloudflare/skills
