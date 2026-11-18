---
projeto: Cecilia
atualizado_em: 2026-11-13
estado: publicado_e_verificado
---

# Implantação Cloudflare

Relacionado: [[Início]] · [[Segurança/Riscos de segurança|Riscos de segurança]]

## Escopo autorizado

Publicar os arquivos estáticos do jogo; não implementar as recomendações de segurança documentadas. Não contratar plano pago, comprar domínio ou iniciar recursos cobrados sem aprovação explícita.

## Estado verificado

- `H:\dev\cecilia\dist\index.html` e `dist\story.json` existem.
- O jogo usa uma URL e uma chave publicável em `public/backend.json`; não requer chave secreta no site.
- O Supabase existente já recebeu o roteiro canônico e teve gravação de teste confirmada na etapa anterior.
- A primeira autorização OAuth expirou. Um novo fluxo com `account:read`, `user:read` e `pages:write` foi concluído pelo usuário; `wrangler whoami` confirmou a conta antes da criação do projeto. Nenhuma senha ou token foi solicitado no chat.
- A inspeção de `dist/` encontrou nove arquivos, maior arquivo com 1.208.056 bytes e nenhum `.env`, `.sql`, `.sqlite` ou `script.md` na pasta de publicação. Essa checagem é limitada aos nomes e tipos inspecionados, não uma auditoria de todos os conteúdos.
- Projeto Pages Direct Upload criado: `cecilia-jogo`, produção na branch `main`, sem Functions adicionais.
- URL de produção: https://cecilia-jogo.pages.dev
- Implantação confirmada: `9e573144-1da3-4ed2-906c-0ff1a88f1a82`.
- URL imutável desta implantação: https://9e573144.cecilia-jogo.pages.dev
- A publicação enviou nove arquivos. A leitura pública retornou HTTP 200 para a página, `story.json`, `backend.json`, cenário do café e os três arquivos JavaScript/CSS referenciados. O JSON do roteiro e a configuração pública foram comparados integralmente com a compilação local.
- Um navegador Chrome real, em viewport móvel de 390 × 844, confirmou a tela inicial, canvas Phaser, idioma `pt-BR`, ausência de rolagem horizontal e nenhum erro JavaScript de página. Essa verificação não enviou novos dados ao banco.
- Nenhuma recomendação de segurança de [[Segurança/Riscos de segurança|Riscos de segurança]] foi implementada. Não foi contratado plano pago, comprado domínio nem criado banco adicional.

## Domínio personalizado solicitado — DNS externo pendente

Endereço desejado: https://jogo.ratozumbi.com.br

- O domínio foi associado ao projeto `cecilia-jogo` e a associação foi confirmada por leitura da API do Pages.
- Identificador da associação: `fd1366a9-86c6-4b30-bfb5-45da22c8122b`.
- Estado observado: `pending`, com `verification_data.error_message` igual a `CNAME record not set`.
- A zona `ratozumbi.com.br` existe na conta Cloudflare, mas está pendente de ativação. A consulta DNS pública confirmou que os servidores autoritativos continuam `a.auto.dns.br` e `b.auto.dns.br` (Registro.br).
- `jogo.ratozumbi.com.br` não tinha registro CNAME na consulta realizada. Criar um registro somente na zona Cloudflare pendente não resolveria o DNS público.
- A etapa de autenticação segura no Registro.br não foi concluída; nenhum registro DNS nem nameserver foi alterado.

Registro necessário no DNS ativo do Registro.br:

    Tipo: CNAME
    Nome: jogo
    Nome completo: jogo.ratozumbi.com.br
    Destino: cecilia-jogo.pages.dev
    TTL: padrão do provedor

Não é necessária a migração dos nameservers para configurar apenas este subdomínio. Depois de criar o CNAME, é necessário confirmar a resolução pública, o estado ativo no Pages e o acesso HTTPS antes de declarar o novo endereço operacional. O endereço `cecilia-jogo.pages.dev` continua sendo a publicação já verificada.

## Requisitos da publicação original

1. Conta Cloudflare e autorização OAuth local do Wrangler pelo navegador.
2. Selecionar a conta se houver mais de uma.
3. Um nome disponível para o projeto; sugestão inicial: `cecilia-jogo`.
4. Criar um projeto **Pages / Direct Upload**, sem Functions e sem serviços pagos adicionais.
5. Publicar somente a pasta `dist`, nunca a raiz do projeto.
6. Verificar a URL retornada, o carregamento de `/story.json`, `/backend.json`, cenários e JavaScript.

O domínio próprio é opcional. A publicação pode usar o subdomínio `pages.dev` fornecido pelo serviço.

## Preparação e comandos previstos

Executar na pasta `H:\dev\cecilia`:

    npm run build
    npx wrangler login
    npx wrangler pages project create cecilia-jogo --production-branch main
    npx wrangler pages deploy dist --project-name cecilia-jogo --branch main

O nome poderá ser ajustado se já estiver ocupado. Não executar comandos de criação antes de autenticar e verificar a conta selecionada. Não usar contas temporárias de prévia como substituição silenciosa da conta do usuário.

## Consideração sobre o tipo de projeto

Direct Upload é adequado para publicar a compilação local atual e não exige repositório Git. A documentação informa que um projeto Direct Upload não pode ser convertido posteriormente para integração Git; seria necessário criar outro projeto para adotar esse modo. Isso não impede novas publicações manuais no mesmo projeto.

## Requisitos que não são necessários nesta arquitetura

- Servidor Node em produção.
- Banco no Cloudflare ou migração do Supabase.
- Chave secreta em variável pública ou no pacote do navegador.
- Domínio comprado ou alteração de DNS de domínio próprio.
- Resolver os riscos registrados neste vault para concluir esta tarefa, pois o usuário separou expressamente os dois escopos. A exposição pública mantém esses riscos conhecidos.

## Fontes oficiais consultadas

- Cloudflare Pages — Direct Upload: https://developers.cloudflare.com/pages/get-started/direct-upload/
- Wrangler — Pages commands: https://developers.cloudflare.com/workers/wrangler/commands/pages/

São referências de procedimento; autenticação, criação e publicação precisam ser verificadas por execução e leitura do resultado, não presumidas a partir da documentação.
