---
projeto: Cecilia
tipo: práticas_de_implementação_e_verificação
atualizado_em: 2026-11-13
---

# Técnicas e verificações

Relacionado: [[Início]] · [[Projeto/Progresso|Progresso]] · [[Arquitetura/Decisões estruturais|Decisões estruturais]] · [[Desenvolvimento/Ferramentas em uso|Ferramentas em uso]] · [[Segurança/Riscos de segurança|Riscos de segurança]]

## Roteiro declarativo e compilação

- Linguagem textual em `script.md`: falas, `@background`, `@label`, `@question`, `goto=`, `@jump`, `@end` e `@finish`.
- Perguntas únicas ou múltiplas, com limites `min`/`max` e identificadores validados.
- Marcações `save`, `correct` e `incorrect` pertencem ao roteiro canônico.
- Validação antecipada de referências, blocos, opções e arquivos de cenário; erros incluem linha do roteiro.
- SHA-256 do texto fonte identifica a versão. Alterar o roteiro exige manter essa versão disponível no banco.
- Plugin Vite compartilha a leitura/validação entre desenvolvimento e compilação. Em desenvolvimento, `/story.json` é gerado novamente e servido com `no-store`; a compilação emite um arquivo público sem as marcações internas.
- Bundle do Phaser separado do código da aplicação para organizar os arquivos de produção; ver `vite.config.js`.

**Fontes locais:** `server/story.js`, `scripts/story-assets.js`, `vite.config.js`.

## Interface e fluxo narrativo

- Separação entre a cena visual Phaser e os controles DOM.
- Navegação por rótulos e saltos, sem exibir nós técnicos do roteiro; finais encerram o percurso.
- Validação de seleção única/múltipla, limites e opções existentes.
- Uso de `textContent` e criação de nós DOM para texto do roteiro, em vez de tratá-lo como HTML.
- Preferência de movimento reduzido, controle de animações e atalhos de teclado.
- Histórico da conversa em memória; não representa um salvamento do ponto da história.

**Regressões corrigidas e cobertas:**

1. Ao recomeçar, remover o formulário anterior antes de aguardar o novo roteiro. Evita preencher um formulário que seria substituído por uma resposta assíncrona.
2. Ignorar eventos de submissão de formulários desconectados do DOM. Evita criar personagens duplicados ou avançar a história duas vezes com o mesmo formulário retido.

**Fontes locais:** `src/main.js:79–82`, `:107–109`, `:128–138`, `src/player.js` e `tests/lifecycle.spec.js`.

## Fila durável e novas tentativas

- Padrão de fila de saída: registrar localmente a intenção de envio antes de tentar a rede.
- Separação por sessão; cada partida recebe UUID de sessão e token aleatório distintos.
- Personagem é pré-requisito para respostas da mesma sessão.
- Uma promessa compartilhada evita duas drenagens simultâneas na mesma instância.
- A fila é consultada novamente após cada operação aguardada: respostas adicionadas durante uma gravação em andamento não ficam esquecidas num snapshot antigo.
- Tentativas no início, após novas entradas, no evento `online` e a cada 15 segundos com a página aberta.
- Limite de 10 segundos por pedido de configuração ou gravação.
- Falhas de rede e respostas temporárias preservam a entrada. HTTP 401, 403, 408 e 429 continuam aptos a nova tentativa; outros erros 4xx bloqueiam a entrada para diagnóstico.
- Personagem bloqueado impede o envio de suas respostas, sem impedir sessões independentes de prosseguir.
- Resposta de sucesso inesperada não remove a entrada da fila.
- Sem armazenamento disponível, funcionar em memória e avisar somente no console.

**Limites:** não há serviço de sincronização depois que a aba fecha, retomada narrativa persistida, backoff exponencial implementado ou expiração automática de pendências. Essas características não devem ser presumidas.

**Fontes locais:** `src/persistence.js:3–75`, `src/main.js:146–148`, `tests/persistence.test.js`.

## Integridade e privacidade no banco

- RLS e revogação do acesso direto às tabelas para papéis públicos.
- RPCs com `SECURITY DEFINER`, `search_path` vazio e nomes de objetos qualificados.
- Token de sessão validado antes de revelar informações sobre perguntas ou submissões; hash do token armazenado no banco.
- Lock transacional por sessão serializa operações, inclusive a criação concorrente da sessão.
- Personagem imutável: repetição idêntica é permitida; conteúdo diferente é recusado.
- Hash da seleção ordenada permite reenvio idempotente independentemente da ordem dos IDs.
- Escrita atômica de metadados da submissão e das opções selecionadas que tenham `save`.
- Valores `option_text` e `correct` derivados do roteiro canônico.
- Publicação administrativa confirma por leitura que o JSON canônico no banco corresponde ao roteiro local.

Isso controla integridade e posse da sessão, não identidade real, automação, taxa de criação de partidas ou percurso narrativo. As limitações seguem documentadas, sem remediação autorizada.

**Fontes locais:** `supabase/schema.sql`, `scripts/publish-database.js`, `tests/schema.test.js`.

## Estratégia de testes e força de cada evidência

| Camada | Técnica aplicada | O que demonstra | O que não demonstra |
| --- | --- | --- | --- |
| Lógica e fila | `node:test`, assertions e funções de rede/armazenamento controladas | Validação, ordenação, concorrência assíncrona e novas tentativas | Disponibilidade real do serviço remoto |
| SQL | PGlite com papéis e esquema aplicado duas vezes | Validação, grants, idempotência e rollback local | Implantação remota ou carga concorrente entre clientes reais |
| Compilação | Build Vite em pasta isolada | JSON público, validação dos cenários e ausência de fontes privadas nos arquivos esperados | Configuração da hospedagem remota |
| Navegador | Playwright desktop/mobile com RPCs interceptadas | Fluxo, seleções, reinício, fila, console e comportamento de interface | Persistência remota real |
| Banco remoto | Envio fictício pela API pública e leitura independente da mesma sessão | Dados realmente registrados e repetição sem duplicação | Proteção contra spam ou teste de carga |
| Publicação | Leitura da API do Pages, HTTP e navegador real | Implantação disponível e interface carregando | Operação de um domínio personalizado ainda sem DNS |
| Documentação | Inventário, hashes e resolução de links locais | Notas preservadas e navegação consistente | Correção das falhas descritas nas notas |

Durante a implementação foram usados ciclos de teste com falha antes da correção e reexecução após o ajuste, além de promessas controláveis para reproduzir corridas de reinício e envio. Os testes de navegador guardam screenshot e trace quando falham.

## Rotina de verificação para alterações futuras

Executar na raiz do projeto, quando houver mudanças de código:

    npm test
    npm run build
    npm run test:e2e

Esses comandos não substituem uma publicação nem uma verificação do banco remoto. Para mudanças apenas documentais, conferir links, caminhos e evidências sem realizar migrações ou implantações desnecessárias.

Após uma publicação autorizada, verificar separadamente: identificação da implantação, página HTTP, recursos, JSON esperado, carregamento do canvas e erros do navegador. Para novo domínio, acrescentar DNS e certificado HTTPS à verificação.

## Limites de atuação

- Não guardar senhas, tokens de sessão ou chaves secretas no vault.
- Não usar resultados fictícios como prova de operação real; identificar fixtures e testes de forma explícita.
- Não ignorar alertas do scanner para instalar skills bloqueadas sem autorização.
- Não alterar segurança, DNS ou serviços remotos porque uma melhoria foi documentada.
- Preservar a convenção de estados técnicos somente no console e de documentação dentro da pasta do projeto.
