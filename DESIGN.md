---
name: Ian Granja Advogados — Sistema Revisional & Site
description: Sistema editorial jurídico em azul-marinho e dourado, dividido entre a vitrine pública de documentos grifados e o dashboard operacional de cálculos, carteira, DJEN e agenda.
colors:
  ink-navy: "#061237"
  ink-deep: "#040b25"
  ink-soft: "#12204e"
  gold-pen: "#a18c5e"
  gold-highlighter: "#d9c89b"
  gold-deep: "#746139"
  cool-paper: "#eff1f6"
  card-sheet: "#fcfcfd"
  secondary-tint: "#e0e3eb"
  muted-slate: "#37446c"
  hairline-border: "#c6cbdc"
  input-rule: "#a0a9c5"
  crimson-alert: "#b62020"
  emerald-regular: "#126a35"
typography:
  display:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 800
    lineHeight: 0.96
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.3
  caption:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.25
  micro:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 600
    lineHeight: 1.2
rounded:
  none: "0px"
  sm: "3px"
  md: "5px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  sidebar: "264px"
  sidebarCollapsed: "68px"
  topbar: "56px"
components:
  button-primary-gold:
    backgroundColor: "{colors.gold-pen}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 14px"
  button-primary-gold-hover:
    backgroundColor: "{colors.gold-highlighter}"
  button-ink:
    backgroundColor: "{colors.ink-navy}"
    textColor: "{colors.cool-paper}"
    rounded: "{rounded.md}"
    height: "32px"
    padding: "0 12px"
  button-secondary:
    backgroundColor: "{colors.card-sheet}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.md}"
    height: "32px"
    padding: "0 12px"
  sidebar-item-active:
    backgroundColor: "{colors.ink-soft}"
    textColor: "{colors.cool-paper}"
    padding: "10px 16px"
  kpi-strip-cell:
    backgroundColor: "{colors.card-sheet}"
    textColor: "{colors.ink-navy}"
    padding: "14px 16px"
  input-underline:
    backgroundColor: "transparent"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.none}"
    padding: "8px 0"
---

# Design System: Ian Granja Advogados — Sistema Revisional & Site

## Overview

**Creative North Star: "A Mesa do Advogado"**

O sistema visual une duas superfícies com o mesmo DNA material de escritório bancário: o site institucional público (modo Persuade, onde o visitante lê documentos grifados sobre uma mesa azul-marinho) e o sistema interno revisional em formato dashboard (`/ferramentas/calculadora-revisional/*`, modo Operate). No sistema interno, a navegação veste a mesa em azul-marinho escuro com o logotipo dourado fixo à esquerda, enquanto o trabalho diário acontece sobre folhas claras de papel branco-frio com linhas finas de 1px, densidade tabular e zero ornamento.

O dashboard interno recusa explicitamente clichês de templates administrativos: não há faixas em gradiente, saudações com emoji, cards com ícone colorido em quadradinho, botões em pílula, glassmorphism, sombras grandes ou bordas grossas decorativas. A precisão tipográfica em `Archivo Variable` com numerais tabulares, a separação por divisórias de 1px e a reserva rigorosa do dourado apenas para ação primária, item ativo e alerta de publicação criam leitura instantânea de prazos e valores.

**Key Characteristics:**
- Barra lateral retrátil em azul-marinho profundo (`264px` expandida, `68px` recolhida, atalho `Ctrl+B`), com grupos sanfonados (*Operação e prazos*, *Perícia e carteira*) e ícones de `20px`, contrastando com canvas operacional claro e barra superior fixa (`56px`).
- Cantos de `5px` em botões, campos com caixa, cartões, menus e modais (`3px` em selos e checkboxes); campos sublinhados `.field` e linhas da sidebar seguem retos, e o único círculo é o marcador do dia de hoje no calendário mensal.
- Tela Início abre com cabeçalho do dia: data + uma frase de pendências em que cada contagem é link (atrasados, hoje, intimações novas, processos com prazo aberto). Sem botões de criação ali — criar cálculo, prazo ou abrir o Radar fica no `Novo` da barra superior. Abaixo, 2 colunas (`8/4`): **Pauta** (pendentes agrupados em Atrasados / Hoje / Próximos, até 8, com "Mais N na Agenda") + **Intimações do DJEN** (tribunal · CNJ · status do processo, resumo a partir do ato processual, ponto dourado para nova); à direita um bloco único **Carteira** (casos · abuso ≥ 1,5x · proveito, fases com barra só em tinta, atualizados por último). Cabeçalhos de bloco em faixa Ink Navy com título em Cool Paper, botões de contorno `paper/30` e links `paper/80` (pedido do usuário em 19/11/2026), sem ícone em quadradinho. Cada intimação mostra à direita quando entrou no sistema (`recebidaEm`: "entrou hoje, 06:12") e a data do DJEN na linha de metadados. Faixas contínuas de KPI no topo ficam restritas ao Painel Analítico e à tela de Resultado.
- Tela Agenda (19/11/2026), visão padrão **Semana** em formato de pauta: cabeçalho com o período em destaque ("16 – 22 de novembro de 2026", `text-xl`), setas de semana, `Hoje`, `Semana | Mês` e o botão Ink `Agendar`. Abaixo, faixa de 7 blocos de dia (número grande `1.75rem`, dia da semana, pontos por tipo; o dia selecionado vira bloco Ink Navy) e a pauta da semana: trilho à esquerda com o número do dia (Ink Navy no selecionado), hora numa coluna própria (`Dia todo` quando não há), compromisso, e dias vazios como "Livre" com atalho para agendar. Coluna direita: mini-calendário (cabeçalho Ink Navy, semana atual em faixa `gold-light/30`, pontos por tipo), bloco **Atrasados** com faixa `destructive` e a lista de filtros "Mostrar" (tipos com ponto de cor + contagem, "Incluir concluídos"). A visão **Mês** ocupa a largura toda, com etiquetas por tipo (prazo `destructive/10`, audiência `gold/20`, reunião `ink/10`, tarefa `ink/5`) e clicar num dia abre a semana dele.
- Tela Processos DJEN (19/11/2026): cabeçalho de página com "N processos acompanhados", linha de resumo (prazos em aberto · verificação automática) e ações `Radar DJEN` (contorno) + `Verificar agora` (Ink). Abas sublinhadas Processos / Publicações com contagem. Filtros numa fileira: situações em botões com ponto de cor e contagem, busca e dois selects. Tabela com cabeçalho Ink Navy e `table-fixed` (não estoura em `1440px`), Situação e Fase empilhadas numa coluna só como selects discretos, linha com publicação nova em `gold-light/15`. Nomes de partes vindos do DJEN em CAIXA ALTA são exibidos na forma usual (`formatarNomeParte`) e os resumos começam no ato processual (`resumirTeorPublicacao`).
- Tela Carteira (19/11/2026): sem caixa de controles; cabeçalho "N casos · R$ X em proveito" com resumo de abuso, `Tabela | Por fase | Quadro`, `Radar DJEN`, `Fases` e atualizar (todos em contorno, nada dourado). Fases como botões com ponto da cor + contagem, filtros numa fileira. Tabela com cabeçalho Ink Navy, linha inteira abre o caso (ficam só `Laudo PDF` e `⋯`, que ganha "Abrir caso"), seletor de fase próprio com ponto da cor, selos de grau tingidos (`destructive/10`, `gold-light/60`, `#126A35/10`) e "—" quando não há valor. Abaixo de `lg` a tabela vira lista de cartões (cartão inteiro abre o caso; fase, PDF e `⋯` embaixo).
- Fase × categoria (19/11/2026): **fase** é a etapa do fluxo (Triagem → Em análise → Ajuizado → Acordo / Concluído; tabela `revisional_categorias`, colunas do Quadro); **categoria** é o tipo da ação (Revisional, Busca e Apreensão, Superendividamento; tabela `revisional_tipos`), exibida como etiqueta discreta (`border-ink/15 bg-secondary/60`, ponto da cor, `10px`) e filtro "Todas as categorias". As duas listas se gerenciam na tela "Fases e categorias".
- Quadro da Carteira = kanban por fase, como o Trello: cada fase é uma coluna de `16.5rem` (`bg-secondary/60`) com nome (clicar renomeia, texto já selecionado), contagem, soma e abusos; cartões curtos (nome, banco, valor, razão `x`), clicar abre o caso, arrastar ou `⋯ › Mover para [fase]` muda de fase; a última coluna é "+ Adicionar fase", que cria a fase ali mesmo. Sem seletor de fase dentro do cartão, sem densidade/recolher colunas.
- Tabelas densas (`40–44px` por linha), cabeçalho fixo (`sticky top-0`) e valores financeiros alinhados à direita em `tabular-nums`.

## Colors

A paleta deriva da mesa azul-marinho, do papel frio levemente azulado e da tinta dourada da marca, acrescida de vermelho e verde funcionais exclusivamente para risco de abuso/atraso e regularidade.

### Primary
- **Ink Navy** (`#061237` / `hsl(226 79% 12%)`): Fundo do menu lateral do sistema interno, botões de ação de linha, marcador de hoje na agenda e texto principal.
- **Gold Pen** (`#a18c5e` / `hsl(41 26% 50%)`): Reservado para o botão primário global `"Novo"` na barra superior, anel de foco e barras de destaque financeiro.
- **Gold Highlighter** (`#d9c89b` / `hsl(43 45% 73%)`): Barra esquerda de `2px` no item ativo do menu lateral, ponto de publicação nova no DJEN, badge `"Nova"` e hover do botão primário dourado.

### Secondary
- **Ink Soft** (`#12204e` / `hsl(226 62% 19%)`): Fundo do item ativo na barra lateral e estado hover de botões escuros.
- **Ink Deep** (`#040b25` / `hsl(227 82% 8%)`): Fundo de overlays e backrops modais/gavetas (`45%–65%` de opacidade).
- **Gold Deep** (`#746139` / `hsl(40 34% 34%)`): Texto dourado escurecido sobre fundo claro para links de casos vinculados, rótulos de audiência e ações secundárias em texto (garantindo contraste ≥ 4.5:1 sobre papel).

### Neutral
- **Cool Paper** (`#eff1f6` / `hsl(224 26% 95%)`): Fundo principal do canvas do dashboard e cor do texto claro sobre o azul-marinho.
- **Card Sheet** (`#fcfcfd` / `hsl(220 33% 99%)`): Superfície de tabelas, faixas de KPI, barra superior, painéis laterais e formulários.
- **Secondary Tint** (`#e0e3eb` / `hsl(224 22% 90%)`): Cabeçalhos fixos de tabelas, colunas de fim de semana na agenda e agrupadores de dia.
- **Muted Slate** (`#37446c` / `hsl(226 32% 32%)`): Rótulos secundários (`.sys-label`), metadados de contrato/banco e textos auxiliares.
- **Hairline Border** (`#c6cbdc` / `hsl(226 24% 82%)`): Divisórias e contornos estruturais de `1px`.
- **Input Rule** (`#a0a9c5` / `hsl(226 24% 70%)`): Linha inferior dos campos de formulário `.field`.

### Semantic
- **Crimson Alert** (`#b62020` / `hsl(0 70% 42%)`): Prazos fatais, tarefas atrasadas, exclusões e taxa contratual com indício de abuso (`≥ 1,50x`).
- **Emerald Regular** (`#126a35`): Contratos dentro da média de mercado, status `"Manifestado"` e confirmação de salvamento.

**The Restrained Gold Rule.** No dashboard interno, o dourado aparece apenas na ação primária (`Novo`), na indicação de item ativo na sidebar (`3px` à esquerda), no ponto de publicação nova e em alertas de prazo/audiência — nunca em fundos decorativos ou bordas ornamentais.

## Typography

**Display Font (Site Público):** `Archivo Variable` (avec fallback `Archivo, system-ui, sans-serif`) — mantida larga (`font-stretch: 116%`, peso `800`) apenas nas classes `.display` e `.subdisplay` do site institucional.
**Dashboard UI Font:** `Archivo Variable` com `font-stretch: 100%` (largura normal) para títulos de barra, seções, botões, rótulos e tabelas.
**Editorial Prose Font:** `Literata Variable` (`Literata, Georgia, serif`) para teores integrais de publicações do DJEN e observações jurídicas de processo.

**Character:** Escala fixa e compacta (razão ~`1.125–1.20` entre níveis), sem tamanhos fluidos em `clamp()` no sistema interno, garantindo alinhamento denso e escaneabilidade numérica.

### Hierarchy
- **Tela / Topbar Title (`.sys-title`)** (`600`, `1.125rem` / `18px`, `line-height: 1.25`, `letter-spacing: -0.01em`, `font-stretch: 100%`): Título da view na barra superior e título do painel lateral de tarefa.
- **KPI Value (`.sys-kpi-value`)** (`700`, `1.5rem` / `24px`, `line-height: 1.15`, `letter-spacing: -0.02em`, `tabular-nums`): Números grandes nas faixas de KPI do Início, Painel e Resultado.
- **Section Heading (`.sys-section`)** (`600`, `0.9375rem` / `15px`, `line-height: 1.3`, `font-stretch: 100%`): Títulos de blocos e painéis (`Hoje e próximos 7 dias`, `Casos recentes`, `A fazer`).
- **Body / Table Cell** (`400`–`500`, `0.875rem` / `14px`, `line-height: 1.45`): Texto corrente e células principais das tabelas.
- **Label (`.sys-label`)** (`500`, `0.8125rem` / `13px`, `line-height: 1.3`, sentence case): Rótulos de campos, métricas da faixa de KPI e cabeçalhos de coluna.

**The Normal-Width Rule.** Dentro do sistema interno, `.display`, `.subdisplay` e `.rubric` em caixa-alta não são usados para títulos operacionais; utiliza-se `Archivo` em largura padrão (`100%`) e capitalização normal (sentence case).

## Layout

Estrutura com barra lateral retrátil à esquerda e área de trabalho fluida à direita:
- **Desktop (`≥ 1024px`)**: Sidebar retrátil à esquerda (`264px` expandida <-> `68px` recolhida via botão ou `Ctrl+B`, `fixed inset-y-0` com espaçador de mesma largura no fluxo, para que o quique elástico da rolagem não arraste o menu; o `<html>` recebe `overscroll-behavior-y: none` enquanto o sistema está aberto) + coluna de conteúdo (`flex-1 min-w-0`) com topbar fixa (`56px` / `h-14`).
- **Container de Conteúdo**: Largura máxima de `1440px`, padding `24px` (`px-6 py-6`) no desktop e `16px 20px` no mobile.
- **Grids de Conteúdo**: Grade de `12 colunas` com `gap: 24px` (`gap-6`). Todas as colunas (`lg:col-span-8`, `lg:col-span-4`, `lg:col-span-5`, `lg:col-span-7`) carregam obrigatoriamente `min-w-0` para impedir que tabelas largas expandam a largura da página no mobile.
- **Mobile (`< 1024px`)**: Sidebar recolhe para gaveta deslizante com foco preso (`256px`), acionada pelo botão de menu na topbar e fechada por `Escape` ou clique fora. A busca global vira ícone de lupa que expande em faixa logo abaixo da barra superior. Zero scroll horizontal em nível de página (`390×844`).

## Elevation & Depth

Superfície plana por padrão: a hierarquia no sistema interno é comunicada por contraste de fundo (`#eff1f6` vs `#fcfcfd` vs `#e0e3eb`) e bordas de `1px` (`#c6cbdc` / `ink/20`), sem sombras de elevação em repouso.

### Shadow Vocabulary
- **Overlay Elevation** (`shadow-xl` / `shadow-2xl`): Aplicada exclusivamente em camadas flutuantes renderizadas em Portal acima do fluxo (`Dropdown` de busca global, menu `"Novo"`, gaveta mobile e `SheetTarefa` lateral).

**The Flat-By-Default Rule.** Cards, faixas de KPI e tabelas no sistema interno são planos (`border 1px`) sem `box-shadow` em repouso nem ao passar o mouse.

## Shapes

Papel cortado com quinas suavizadas (aprovado pelo usuário em 18/11/2026):
- **Raio padrão do sistema interno**: `5px` em botões, campos com caixa, selects, cartões, tabelas, menus flutuantes e modais centrais; `3px` em selos, contadores, checkboxes e abas internas de controles segmentados. Aplicado pela classe `sys-arredondado` no `<html>` (ligada pelo `ShellSistema`, regras no fim de `src/index.css`), para o site público continuar com cantos retos (`--radius: 2px`).
- **Sem raio**: campos sublinhados `.field`, linhas de navegação da sidebar (barra ativa de `3px`), faixas de KPI (`border-y`) e a gaveta lateral `SheetTarefa`. Grupos de botões colados usam `.sys-grupo` (só as pontas arredondam).
- **Exceção única de círculo**: Marcador do dia atual no calendário mensal da Agenda (`rounded-full size-6 bg-ink text-paper`).
- **Sem bordas decorativas laterais**: Linhas de tabela e cartões não utilizam `border-left` ou `border-right` de `3px` por nível de risco; o indicador ativo de `3px` pertence exclusivamente ao item ativo da sidebar.

## Components

### Buttons
- **Shape:** Cantos de `5px`.
- **Primary (`Novo` / Salvar tarefa):** Fundo Gold Pen (`#a18c5e`), texto Ink Navy (`#061237`), peso `600`, `12px`, altura `36px`, padding `0 14px`. Hover muda para Gold Highlighter (`#d9c89b`) em `150ms`.
- **Action (`Abrir` / `Criar`):** Fundo Ink Navy (`#061237`), texto Cool Paper (`#eff1f6`), peso `600`, `12px`, altura `28px–36px`. Hover em Ink Soft (`#12204e`).
- **Secondary / Toolbar:** Fundo Card Sheet (`#fcfcfd`), borda `1px` `ink/25`, texto Ink Navy, altura `32px`, hover `ink/5`.

### KPI Strip (Painel e Resultado)
- **Estrutura:** Régua contábil única (`border-y 1px`, sem caixa flutuante) dividida internamente por linhas verticais de `1px` (`divide-x` no desktop, `divide-y` no mobile), utilizada apenas em telas analíticas (Painel Analítico e Resultado da Calculadora — nunca como faixa no topo do Início).

### Gráficos (Painel e caso)
- **Cor por função:** séries comuns em Ink Navy (uma cor só; `ink/70` para a secundária). Vermelho/dourado/verde são **cores de status** e só aparecem para o grau de abusividade (≥ 1,5x / 1,1–1,49x / ≤ 1,1x), sempre com rótulo ou legenda. Nunca colorir categorias/fases com vermelho ou verde, nem usar dourado como cor de série.
- **Marcas:** barras finas (`≤ 24px`, `h-2`–`h-2.5` nas horizontais), ponta de dado com raio `3px` e base reta, `2px` de espaço entre colunas/segmentos, pontos de `10px` com anel de `2px` da cor do cartão, linhas de `2px`. Grade e eixos em hairline sólida (`ink/25`), nunca tracejada. Dado real em linha sólida; tracejado/pontilhado só para projeção.
- **Rótulos seletivos:** valor no maior item e no período atual, não em todo ponto; texto sempre em tinta (`ink` / `muted-foreground`), nunca na cor da série. Cada marca tem `title`/`aria-label` com o valor.
- **Uma escala por gráfico:** duas medidas (ex.: nº de casos e R$) viram dois gráficos pequenos com o mesmo eixo de tempo, nunca eixo duplo; barra segmentada é dividida por uma medida só, e a outra vai numa tabela ao lado.
- **Painel Analítico (19/11/2026):** cabeçalho de página com "N casos · R$ X em proveito" e o recorte atual; filtros independentes por **fase** (botões com contagem) e **categoria** (select); cartões com cabeçalho Ink Navy. *Carteira por categoria* (barras `ink/70`, abusos em vermelho, clique abre a Carteira filtrada) fica ao lado de *Carteira por fase*; *Carteira por fase* ignora o filtro de fase e *Carteira por categoria* ignora o de categoria. Demais gráficos: *Carteira por fase* (nº de casos na ordem do campo `ordem` das categorias, clicável para a Carteira) · *Grau de abusividade* (barra segmentada por nº de casos + tabela Casos/Proveito) · *Distribuição das taxas* (histograma da razão com faixas alinhadas a 1,1x e 1,5x, eixo marcando os limites e aviso dos casos entre 1,4x e 1,5x) · *Evolução mensal* (casos e proveito por mês de cadastro, 12 meses) · *Abuso por banco* (um ponto por caso na escala 0,5x–3x, referências em 1,0x e 1,5x, mediana, ordenado pela mediana, "n casos · R$"; no celular o nome sobe e a faixa ocupa a largura toda) · *Volume por modalidade*. O filtro por categoria no topo vale para todos, exceto *Carteira por fase*.

### Navigation (Sidebar & Topbar)
- **Sidebar (`264px` expandida / `68px` recolhida):** Fundo `#061237`, texto `paper/75`, hover `paper` sobre `paper/[0.06]`, ícones de `20px` (`size-5`) e duas seções retráteis (*Operação e prazos*, *Perícia e carteira*). Item ativo ganha fundo `#12204e`, texto `#eff1f6` e barra esquerda `border-l-[3px] border-gold-light`. No rodapé, cartão de conta com iniciais + ações `Senha`, `Sair` e `Site ↗`. Recolhida, o topo mostra o "G" da logo (`logo.png`, `44px`, fundo igual ao da sidebar) no lugar do logotipo completo; botões de ícone da sidebar não têm borda (hover `paper/[0.08]`).
- **Topbar (`56px`):** Fundo `#fcfcfd`, borda inferior `1px`. Esquerda traz título `.sys-title` (ou breadcrumb `Seção › Cliente`); centro traz busca global acionável por `/` ou `Ctrl+K` com resultados agrupados (`Carteira` / `Processos`) em portal `position: fixed`; direita traz o botão dourado `"Novo"` com menu em portal.

### Inputs / Fields
- **Underlined Field (`.field`):** Fundo transparente, borda inferior `1.5px` (`#a0a9c5`), `border-radius: 0`, foco desloca borda para `#061237` com sublinhado dourado `0 2px 0 hsl(var(--gold))`.
- **Search / Toolbar Box:** Fundo `#eff1f6`, borda completa `1px` (`ink/20`), altura `36px`, foco em `#061237`.

### Tables & Lists
- **Densidade:** Linhas de `40–44px` (`py-2`), cabeçalho fixo (`sticky top-0 bg-secondary`), números alinhados à direita com `tabular-nums`.
- **Linhas de Tarefa (`LinhaTarefaAgenda`):** Compartilhadas entre Início e Agenda — checkbox quadrado `16px`, tipo em texto pequeno colorido por urgência (`Prazo` em crimson, `Audiência` em gold-deep, `Reunião` em ink), título clicável para editar no `SheetTarefa`, horário e link clicável para o caso vinculado. O atalho para o Google Agenda é um ícone discreto (`BotaoGoogleAgenda`, `size-7`, `ink/45` → `ink` no hover), nunca um botão com texto repetido em cada linha.
- **Ações de linha (Carteira, Quadro e Processos):** no máximo dois controles visíveis — `Abrir` (Action) e, na Carteira, o ícone `Laudo PDF` — e as demais ações (prazo, DJEN, renovar, duplicar, excluir) no menu `⋯` (`MenuAcoesLinha`, Radix em portal, ação destrutiva separada por divisória e em crimson). A tabela nunca deve estourar a largura útil em `1440px`.

### Side Sheet (`SheetTarefa`)
- **Estrutura:** Painel fixo à direita (`max-w-md w-full`, borda esquerda `1px`, fundo `#fcfcfd`) sobre backdrop `ink-deep/45`. Fecha por `Escape` ou clique no backdrop. Inclui segmented control de tipo (`Prazo` · `Audiência` · `Reunião` · `Tarefa`) e combobox com busca instantânea sobre a carteira e processos.

## Do's and Don'ts

### Do:
- **Do** agrupar KPIs numa faixa contínua dividida por linhas de `1px` com números `tabular-nums` clicáveis.
- **Do** manter `min-w-0` em todas as colunas de CSS Grid que contenham tabelas ou grades roláveis.
- **Do** renderizar dropdowns da barra superior (busca global e menu `Novo`) via Portal com `position: fixed`.
- **Do** usar skeleton com a geometria real da página durante o carregamento inicial do Início (`InicioSkeleton`).
- **Do** manter transições rápidas (`150–250ms`) apenas para comunicar estado (hover, foco, conclusão de tarefa, abertura de gaveta).

### Don't:
- **Don't** colocar saudações com emoji, banners em gradiente ou cards individuais com ícone colorido para KPIs no sistema.
- **Don't** usar `.display`, `.subdisplay`, `.rubric` em caixa-alta nem `HeroArt` nas telas operacionais do dashboard.
- **Don't** usar bordas arredondadas em pílula (`rounded-full`), exceto no círculo do dia atual na grade mensal da Agenda.
- **Don't** aplicar `border-left` espessa (`3px+`) em linhas de tabela ou cartões de caso para sinalizar status; prefira selos de contraste leve com ponto indicador.
- **Don't** aplicar `backdrop-blur`, glassmorphism ou sombras pesadas sobre superfícies estáticas.
