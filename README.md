# Cecilia — Um pouco mais perto

Um romance visual interativo feito com Phaser 3, com uma história fictícia original e ilustrações SVG locais. Não depende de serviços externos de imagens ou fontes.

## Documentação do projeto

O vault Obsidian fica em `obsidian/`, dentro deste projeto, com notas organizadas por tema:

- [Índice do vault](<obsidian/Início.md>).
- [Progresso e pendências](<obsidian/Projeto/Progresso.md>).
- [Decisões estruturais](<obsidian/Arquitetura/Decisões estruturais.md>).
- [Ferramentas em uso](<obsidian/Desenvolvimento/Ferramentas em uso.md>).
- [Técnicas e verificações](<obsidian/Desenvolvimento/Técnicas e verificações.md>).

Os registros distinguem resultados já verificados, decisões implementadas e recomendações ainda não executadas. Abra a pasta `obsidian/` como vault no Obsidian para navegar pelos links internos.

## Executar

Requer Node 22.12 ou superior e npm.

    npm install
    npm run dev

Abra http://127.0.0.1:3000. O jogo envia o personagem e as escolhas ao banco em segundo plano. Somente informações técnicas de envio, conexão e armazenamento aparecem no console do navegador, nunca na página. Use informações fictícias. Recarregar a página ou recomeçar inicia uma nova partida, sem descartar os envios pendentes das partidas anteriores.

Para gerar e testar a versão estática de produção:

    npm run build
    npm run preview

A pasta `dist/` contém o site completo e `story.json`; pode ser publicada no Cloudflare Pages com o comando `npm run build` e diretório de saída `dist`, sem servidor Node em produção. `npm start` continua disponível para servir a compilação localmente com Express.

Defina `PORT` se a porta 3000 estiver ocupada. O servidor aceita apenas acesso local por padrão. Mantenha essa configuração para testes; o projeto não tem autenticação para publicação aberta.

## Identificar partidas pelo email do link

Use `https://cecilia-jogo.pages.dev/?email=ana%40example.com`. Ao montar o link em código, aplique `encodeURIComponent(email)` ao valor; por exemplo, `ana+teste@example.com` vira `ana%2Bteste%40example.com`.

O email é opcional e deve ter até 254 caracteres, sem espaços, com usuário, `@` e domínio com ponto. Valores inválidos são ignorados e o jogo continua sem email. O valor válido é preservado, sem conversão para minúsculas. Reiniciar ou recarregar com o mesmo link cria outra partida associada ao mesmo email. Abrir um link sem o parâmetro não reutiliza o email de outro acesso.

O banco guarda o email em `characters.email`. Todas as respostas e submissões registradas ficam associadas por `session_id`; não há duplicação do email em cada resposta. Os envios pendentes guardam o email original, mesmo quando outro link é aberto antes da sincronização. Partidas antigas continuam sem email. As regras `save` da história continuam valendo; isso não adiciona rastreamento de cada diálogo ou clique.

O email do link não é verificado e não autentica o jogador. Ele fica visível na URL e pode aparecer no histórico e em links compartilhados; use endereços fictícios nos testes. O jogo não imprime esse email nos seus logs técnicos.

Antes de publicar esta versão de `dist/`, aplique a atualização compatível do banco com `npm run db:publish`. O frontend antigo continua podendo enviar partidas sem email.

## O jogo

- Criação de personagem com nome, sexo (incluindo outro e prefiro não informar) e idade adulta, de 18 a 120 anos. Cecilia tem 26 anos.
- Um encontro no café, um passeio pelo jardim e uma vista da cidade, com três cenários SVG originais.
- Seis perguntas: cinco de escolha única e uma de seleção múltipla, com um ou dois interesses.
- Escolhas respeitosas podem levar a um segundo encontro. Distração, desprezo ou desrespeito aos limites podem encerrar a noite. Uma despedida honesta e gentil também é possível.
- Diálogos, cenários e caminhos são definidos em `script.md`.
- As lembranças da conversa ficam apenas na memória da página durante a partida.

## Editar a história

Durante o desenvolvimento, o Vite gera `/story.json` a partir de `script.md`. Na compilação, o roteiro público é incluído em `dist/story.json`, sem as marcações internas de registro ou correção. Após editar o roteiro, publique sua versão no banco e gere novamente o site antes de disponibilizá-lo:

    npm run db:publish
    npm run build

O formato aceita títulos e comentários HTML em linhas próprias. Texto sem identificação de personagem vira narração. Diretivas e identificadores diferenciam maiúsculas de minúsculas e devem ser preservados.

    # Minha história
    @label start
    @background cafe.svg
    Narrador: Uma noite começa.
    Cecilia: Que bom que você veio.
    Você: Também estou feliz.

    @question greeting single
    O que você diz?
    - kind | Como foi seu dia? | goto=walk
    - leave | Preciso ir para casa. | goto=goodbye
    @end

    @label walk
    @background garden.svg
    @question interests multiple min=1 max=2
    Do que você gosta? Escolha uma ou duas opções.
    - books | Livros.
    - music | Música.
    - quiet | Tardes tranquilas.
    @end
    @jump ending

    @label ending
    @background rooftop.svg
    Cecilia: Vamos nos encontrar de novo?
    @finish success | Um segundo encontro espera por vocês.

    @label goodbye
    @finish failure | A noite termina aqui.

### Referência do formato

- `@background filename.svg`: carrega um arquivo de `public/backgrounds/`. Adicione a imagem nessa pasta antes de jogar. Use somente o nome do arquivo, sem pastas.
- `Personagem: diálogo`: uma fala por linha. `Você` (ou `You`) é substituído pelo nome escolhido na criação do personagem. Texto sem personagem usa `Narrador`.
- `@question id single`: uma resposta; `@question id multiple min=1 max=2`: seleção múltipla dentro dos limites. Exige enunciado e pelo menos duas opções.
- `- option_id | Texto da resposta. | flags`: as marcações são opcionais e separadas por espaços. Identificadores começam com letra minúscula e podem conter letras minúsculas, dígitos, hífens e sublinhados. O caractere `|` é o separador.
- `save`: registra a opção selecionada no banco. Opções sem essa marcação não geram uma linha em `answers`.
- `correct` / `incorrect`: marcações opcionais de correção. O banco deriva esses valores do roteiro canônico; o navegador não decide a correção nem o texto registrado. Preferências sem marcação ficam sem classificação.
- `goto=label`: desvia o caminho após uma pergunta de escolha única. Perguntas de seleção múltipla não podem desviar diretamente para destinos diferentes.
- `@label id` / `@jump id`: cenas nomeadas e transições diretas. Identificadores devem ser únicos; referências desconhecidas, limites inválidos e blocos não encerrados geram erro.
- `@finish success | texto` / `@finish failure | texto`: encerra a história. `@finish texto` também aceita um final sem classificação. Evite caminhos circulares.

## Banco e segurança

`public/backend.json` contém somente a URL e a chave publicável do projeto existente. Esse arquivo é público por definição; nunca coloque uma chave secreta nele. Não é necessário ler `.env` para compilar ou jogar.

`npm run db:publish` usa a autenticação já existente da CLI do Supabase para aplicar `supabase/schema.sql`, registrar o roteiro canônico e confirmar por leitura que a versão publicada corresponde ao arquivo local. Não cria projetos nem apaga partidas antigas. Requer uma sessão autenticada da CLI; se necessário, execute `npx supabase@3.1.0 login`.

O navegador chama somente as funções `save_game_character` e `save_game_answer`. As tabelas têm RLS e não permitem leitura ou escrita direta pelos papéis públicos. Cada partida usa um identificador e um token aleatório; apenas o hash do token fica no banco. Reenvios idênticos não duplicam registros e tentativas de alterar um personagem ou uma resposta já registrados são recusadas.

Os estados técnicos ficam no console. Envios pendentes ficam no armazenamento do navegador e são tentados novamente ao recuperar a conexão e a cada 15 segundos com a aba aberta. Sem armazenamento disponível, a fila continua funcionando somente em memória; fechar a aba perde o que ainda não foi enviado. Erros permanentes ficam retidos para diagnóstico e não entram em repetição automática.

As funções são um ponto público de coleta sem login: não permitem consultar dados de outros jogadores, mas não impedem spam ou provam que alguém realmente percorreu a história. Antes de divulgação ampla, acrescente proteção contra abuso, uma política de retenção e consentimento adequado. Não use o jogo para coletar dados sensíveis nem como avaliação segura.

## Verificar

    npm test
    npm run build
    npm run test:e2e

Os testes verificam o roteiro, a compilação estática, o envio ordenado e as novas tentativas. O esquema SQL é executado localmente com PGlite para testar permissões, validação e idempotência; os testes de navegador interceptam os envios para não criar partidas reais e verificam a interface em telas grandes e pequenas.

O Playwright usa o Google Chrome instalado no Windows quando disponível; caso contrário, usa sua instalação do Chromium. Se necessário, execute `npx playwright install chromium`. Gere `dist/` antes de testar o navegador. A variável `PLAYWRIGHT_CHANNEL` permite escolher outro navegador instalado.

## Estrutura do projeto

    script.md                  História editável e caminhos das escolhas
    public/backgrounds/        Ilustrações SVG do café, jardim e vista da cidade
    src/                       Cenários Phaser, interface acessível e lógica do jogo
    scripts/                   Geração do roteiro e publicação no banco
    public/backend.json        URL e chave publicável, sem segredos
    supabase/schema.sql        Tabelas protegidas e funções de registro
    server/                    Servidor local e leitor do roteiro
    tests/                     Testes de Node e de navegador

Arquivos locais de dados e configurações privadas de versões anteriores não são apagados. Novas partidas são enviadas ao projeto configurado em `public/backend.json`.
