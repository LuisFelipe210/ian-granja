# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Pessoas físicas e pequenos empresários, principalmente de Petrolina-PE e região do Vale do São Francisco, com um problema jurídico concreto e geralmente urgente: veículo em busca e apreensão, juros abusivos, nome negativado, plano de saúde negando tratamento, rescisão trabalhista, dívidas fora de controle. Chegam pelo celular, quase sempre por indicação, Instagram ou busca, e querem saber rápido se esse advogado cuida do caso deles e como falar com ele.

## Product Purpose

Site institucional do escritório Ian Granja Advogados. Existe para apresentar o advogado e as áreas de atuação e levar o visitante a iniciar uma conversa, principalmente pelo WhatsApp. Sucesso é o visitante reconhecer o próprio problema numa área de atuação e chamar no WhatsApp.

## Positioning

Escritório de um advogado identificado (Ian Granja, OAB/PE 61.107), com atendimento direto por WhatsApp e linguagem sem "juridiquês", sediado em Petrolina-PE e com atendimento online.

## Operating Context

- Contato principal: WhatsApp (87) 9 8844-8690. Também e-mail contato@iangranja.adv.br e Instagram @iangranja.adv.
- Endereço: Av. Cardoso de Sá, 860, sala 5, Centro Empresarial Sergio Cabral, Cidade Universitária, Petrolina-PE, CEP 56302-110.
- Horário: segunda a sexta, 08h às 18h. Atendimento presencial e online.

## Capabilities and Constraints

- Stack: Vite + React 18 + TypeScript + Tailwind 3 + shadcn/ui, react-router, deploy na Vercel.
- Rotas: `/`, `/sobre`, `/atuacao`, `/atuacao/:slug` (8 áreas em `src/data/practiceAreas.ts`), `/faq`, `/contato`.
- Formulário de contato hoje simula o envio (`api/send-contact.ts` existe, a página não o chama).
- Publicidade de advocacia é regulada pela OAB (Provimento 205/2021): sem promessa de resultado, sem mercantilização.

## Brand Commitments

- Logo atual (G dourado + "ADVOGADOS", `src/assets/logo2.png`, `logo3.jpg`, `logo.png`) permanece sem alteração.
- Azul-marinho e dourado da marca permanecem (confirmado pelo usuário em 2026-11-09).
- O retrato do advogado (`src/assets/lawyer-portrait.jpg`) não é substituído nem regenerado.
- Imagens novas podem ser geradas para o site, exceto fotos do advogado e logo.

## Evidence on Hand

- OAB/PE 61.107; pós-graduado em direito civil, processo civil e direito bancário; 5+ anos de atuação.
- Três depoimentos de clientes com foto (`src/assets/cliente1-3.jpg`): mantidos por decisão do usuário.
- Removidos por decisão do usuário (não reintroduzir): "+2.000 consultas", "98% taxa de sucesso", "24h".
- Não há fotos reais do escritório nem vídeo.

## Product Principles

1. O visitante reconhece o próprio problema antes de ler sobre o escritório.
2. Falar com o advogado está sempre a um toque, pelo WhatsApp.
3. Só fatos verificáveis; nenhuma promessa de resultado.
4. Linguagem direta, sem juridiquês.
