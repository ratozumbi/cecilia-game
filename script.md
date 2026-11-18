# Cecilia — Um pouco mais perto

<!-- História de ficção original. Cecilia tem 26 anos; todos os personagens dos jogadores devem ter 18 anos ou mais. -->
<!-- As diretivas e os sinalizadores estão documentados em README.md. A qualidade das escolhas diz respeito à gentileza e ao respeito, não a um teste de identidade ou interesses. -->

@label cafe
@background cafe.svg
Narrador: Aos vinte e seis anos, Cecilia aprendeu a chegar cedo para duas coisas: um bom café e as pessoas que quer conhecer. Hoje à noite, ela reservou para você o lugar junto à janela.
Cecilia: Você achou! Fiquei com medo de ter explicado o caminho só descrevendo gatos.
Você: O gato dormindo na vitrine da padaria foi surpreendentemente útil.
Cecilia: Então meu método funciona. Antes de fazermos o pedido, como foi seu dia?

@question greeting single
Uma primeira impressão, com suas próprias palavras.
- present | Melhor agora. E o seu? | save correct goto=coffee
- nervous | Sinceramente? Estou com um pouco de nervosismo. Mas feliz por estar aqui. | save correct goto=coffee
- distracted | Só um minuto. Meu celular está mais interessante. | save incorrect goto=fail_phone
@end

@label coffee
Cecilia: O meu foi corrido. Restaurei uma página rasgada de um livro antigo. Falando assim, parece menos emocionante do que foi.
Você: Dar outra chance a uma história parece um ótimo jeito de passar o dia.
Cecilia: Que jeito bonito de ver as coisas. Eu costumo pedir um cappuccino. O que você vai querer?

@question coffee single
Escolha algo para você. Não existe bebida errada.
- espresso | Um expresso. Xícara pequena, grandes ambições. | save
- tea | Chá, por favor. Hoje estou sem pressa. | save
- chocolate | Chocolate quente. Não abro mão dos clássicos.
@end

Cecilia: Excelente. Acho importante levar a sério os nossos pequenos prazeres.
Narrador: As xícaras chegam. Lá fora, a última luz do dia repousa sobre a pracinha.
Cecilia: Aquela foto do mar nos aproximou no aplicativo, mas percebi que nunca perguntei o que você gosta de fazer nos fins de semana.

@question interests multiple min=1 max=2
O que você gostaria de contar? Escolha uma ou duas opções.
- books | Me perder em uma livraria. | save
- music | Descobrir músicas que nunca ouvi antes. | save
- outdoors | Caminhar por aí sem um destino certo. | save
- quiet | Uma tarde tranquila e absolutamente nenhum plano.
@end

Cecilia: Gosto disso. Não precisamos gostar das mesmas coisas. Só gosto de ouvir alguém falar sobre o que faz essa pessoa se sentir em casa.
Você: E o que faz você se sentir em casa?
Cecilia: Domingos sem pressa. As piadas horríveis da minha irmã. Gente que se lembra dos pequenos detalhes.

@question listening single
A conversa dá uma pequena pausa. O que você faz nesse momento?
- ask | Perguntar sobre a irmã dela e ouvir a história. | save correct goto=park
- share | Contar uma pequena coisa que faz você se sentir em casa. | save correct goto=park
- dismiss | Dizer que essas coisas parecem entediantes. | save incorrect goto=fail_unheard
@end

@label park
@background garden.svg
Narrador: O café recolhe seu toldo listrado. Nenhum de vocês parece querer que a noite termine.
Cecilia: Tem um jardim logo ali na esquina. Quer dar uma voltinha? Sem problema se você precisar ir para casa.
Você: Uma voltinha parece uma ótima ideia.
Narrador: Sob os plátanos, os passos de vocês encontram um ritmo sem pressa. Cecilia aponta uma flor teimosa crescendo entre duas pedras.
Cecilia: Passo por aqui toda semana. De algum jeito, ela continua sempre ali.

@question closeness single
As mãos de vocês quase se tocam durante a caminhada. Como você reage?
- ask | Quer andar de mãos dadas? | save correct goto=hands
- space | Manter uma distância confortável e aproveitar a conversa. | save correct goto=rooftop
- insist | Segurar a mão dela e ignorar quando ela tenta se afastar. | save incorrect goto=fail_boundary
@end

@label hands
Cecilia: Eu gostaria. Obrigada por perguntar.
Narrador: A mão dela se acomoda de leve na sua. Sem pressa. Só uma pequena certeza compartilhada.
@jump rooftop

@label rooftop
@background rooftop.svg
Narrador: No mirante do jardim, as luzes da cidade se acendem, uma janela de cada vez. Vocês param junto ao parapeito.
Cecilia: Eu ia preparar alguma frase inteligente para dizer hoje à noite. Acho que prefiro isso.
Você: Isso?
Cecilia: Só estar aqui. Sem me esforçar tanto.

@question invitation single
A noite está quase no fim. O que você gostaria de dizer?
- again | Gostaria de te ver de novo. Domingo seria bom para você? | save correct goto=success
- gentle | Gostei de passar esse tempo com você. Posso te mandar uma mensagem amanhã? | save correct goto=success
- goodbye | Obrigado pela noite. Não senti uma conexão romântica. | save goto=kind_goodbye
- pressure | Você me deve outro encontro, já que eu paguei o café. | save incorrect goto=fail_boundary
@end

@label success
Cecilia: Eu adoraria. Algo simples. Quem sabe aquela livraria por onde você passou?
Você: Está marcado.
Narrador: Antes de vocês irem embora, ela tira uma folha do seu ombro. O sorriso dela acompanha você até em casa.
@finish success | Um pouco mais perto. Uma conversa gentil se transforma na promessa de um segundo encontro.

@label kind_goodbye
Cecilia: Obrigada pela sinceridade. Fico feliz por termos nos conhecido, mesmo que seja só por esta noite.
Narrador: Vocês se despedem com um aceno carinhoso. Nem toda noite boa precisa de um segundo capítulo.
@finish failure | Uma despedida gentil. Não há um segundo encontro, mas vocês dois vão embora com a dignidade intacta.

@label fail_phone
Cecilia: Eu esperava que a gente pudesse conversar de verdade. Acho que vou terminar meu café e ir para casa.
Narrador: Você guarda o celular, mas o momento já passou. Haverá outras chances de estar de fato presente.
@finish failure | A cadeira vazia. O encontro termina cedo quando a conversa nem chega a ter a chance de começar.

@label fail_unheard
Cecilia: Essas coisas são importantes para mim. Acho que não estamos na mesma sintonia.
Narrador: Vocês se despedem do lado de fora do café. Escutar teria aberto espaço para uma noite diferente.
@finish failure | Páginas diferentes. A conexão se desfaz quando as pequenas alegrias dela são menosprezadas.

@label fail_boundary
Cecilia: Preciso que você respeite minhas escolhas. Vou embora agora.
Narrador: Você a deixa ir. Uma conexão só pode crescer quando as duas pessoas se sentem à vontade para escolhê-la.
@finish failure | Os limites importam. O encontro acabou. Um novo começo é uma chance de escolher com mais cuidado.
