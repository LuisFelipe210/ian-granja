# Resumo do app: Ian Granja Advogados + Calculadora Revisional

O projeto junta duas coisas no mesmo app (React + Vite, hospedado na Vercel, banco no Supabase):

1. **Site institucional do escritório**, aberto ao público.
2. **Sistema interno de revisional bancária** (`/ferramentas/calculadora-revisional/*`), com login restrito, fora do menu e do sitemap (`noindex`).

---

## 1. Site público

| Rota | O que tem |
|---|---|
| `/` | Home do escritório |
| `/sobre` | Sobre o advogado e o escritório |
| `/atuacao` e `/atuacao/:slug` | Áreas de atuação, com uma página por área |
| `/faq` | Perguntas frequentes |
| `/contato` | Formulário de contato (enviado pela função `api/send-contact`) |
| `/privacidade` | Política de privacidade |
| `/calculadora-juros-abusivos` | **Calculadora pública** de juros abusivos (explicada abaixo) |

Extras: botão flutuante de WhatsApp, SEO por página (`SeoManager` + `seo.json`, gerado no build) e cabeçalhos de segurança (CSP, HSTS e afins, em `vercel.json`).

### Calculadora pública de juros abusivos
- Não pede cadastro e nada sai do aparelho: a conta roda toda no navegador.
- A pessoa informa quem assinou (PF ou PJ), o tipo de contrato, o mês e o ano da assinatura, o valor financiado, o valor da parcela, a quantidade de parcelas e quantas já pagou.
- O resultado mostra a taxa do contrato comparada com a média do Banco Central, a parcela que seria cobrada na taxa média e quanto pode estar sendo pago a mais.
- Usa o mesmo motor de cálculo básico do sistema interno (`src/lib/juros/index.ts`).

---

## 2. Sistema interno (Calculadora Revisional)

### Acesso
- Login com e-mail e senha pelo Supabase Auth, com recuperação e troca de senha.
- O cadastro público fica desligado, e uma **lista de e-mails autorizados** no banco (`revisional_usuarios_autorizados` + RLS) bloqueia qualquer conta fora do escritório.

### Menu (shell do sistema)

**Operação e prazos**
| Tela | Função |
|---|---|
| **Início** | Resumo do dia: pauta de prazos e compromissos, intimações novas do DJEN, carteira por fase, proveito total e processos atualizados por último |
| **Clientes** | Cadastro das pessoas (PF/PJ): CPF/CNPJ validado, RG, nacionalidade, estado civil, profissão, gênero (para concordância), endereço com busca por CEP (ViaCEP), contato e representante legal de empresa. Mostra o que falta no cadastro, a **qualificação completa** pronta para a petição e os casos do cliente. Os casos da carteira são ligados ao cliente pelo nome automaticamente (gatilho no banco); renomear o cliente atualiza os casos |
| **Agenda** | Calendário do mês e pauta da semana com tarefas e prazos (tipos de compromisso, atrasados) e botão "Adicionar ao Google Agenda" |
| **Documentos** | Editor de texto tipo Word, **paginado em folhas** como no Word (o texto passa sozinho para a folha seguinte, inclusive no meio do parágrafo; "Página X de N"; quebra de página manual com Ctrl+Enter). Papel (A4, Ofício, Carta) e margens (ABNT, Normal, Estreita ou personalizadas) escolhidos por modelo/documento; o documento gerado herda os do modelo. Times 12, entrelinha 1,5. **Modelos** com campos entre colchetes (`[nome do cliente], `[qualificação completa]`, `[CPF do cliente]`, `[endereço do cliente]``, `[número do processo]`, `[parte contrária]`, `[vara]`, `[valor da causa por extenso]`, `[data por extenso]`...) que são preenchidos com a ficha do cliente da carteira ao **gerar o documento**; campo desconhecido (ex.: `[CPF do cliente]`) é perguntado na hora. O documento gerado fica salvo (salvamento automático) e sai em Word (.doc), PDF/impressão ou texto copiado. Lógica dos campos em `src/lib/documentos.ts`; tabelas `revisional_modelos` e `revisional_documentos` |
| **Processos DJEN** | Processos acompanhados no Diário de Justiça Eletrônico: dados do processo, partes e advogados intimados, publicações, anotações internas e filtros por fase, tribunal e situação |
| **Radar DJEN** | Consulta livre no DJEN (por OAB, número CNJ, parte, tribunal, texto ou período), cruzada com a carteira de clientes. Dá para importar um processo da publicação direto para a carteira |

**Perícia e carteira**
| Tela | Função |
|---|---|
| **Calculadora** | Cálculo pericial completo do processo revisional (seção 3) |
| **Carteira** | Lista/Kanban de clientes e cálculos salvos: busca, filtros (fase, categoria, banco, grau de abuso, com observações), ordenação, paginação, baixar laudo PDF, ver resumo, atualizar (renovar) cálculo e mover de fase |
| **Painel Analítico** | Estatísticas da carteira: proveito total, valor pago a mais + tarifas, ticket médio, distribuição por fase, categoria e banco, faixas de abusividade e evolução mensal |
| **Configurações** | Abas: **Perfil e OAB** (nome do advogado, OAB, seccional e cidade, usados nas petições, no Radar DJEN e na verificação automática), **Conta e senha** (e-mail de acesso, trocar senha, sair), **Fases e categorias** e **Integrações** (conector MCP do Claude e Google Drive). Fica no rodapé do menu lateral, junto de Sair e do link do site (abre em outra aba) |

### Outras funções que atravessam o sistema
- **Paginação em todas as listas** (componente único `PaginacaoLista.tsx` + `src/lib/use-paginacao.ts`): Carteira (tabela e agrupado por fase), colunas do CRM, Clientes, Processos DJEN e publicações de cada processo, Radar DJEN, Documentos, Modelos, bancos do Painel e atrasados da Agenda. Nenhuma lista cresce sem fim; a página não muda de largura quando um filtro encurta a lista (`scrollbar-gutter: stable`).
- **Assistente Claude** (dentro da Calculadora): recebe o contrato em PDF, foto ou texto (do computador ou do Google Drive), lê o documento e **preenche a ficha e os contratos sozinho**. Também aceita comandos em texto ("adiciona a tarifa de cadastro de R$ 800", por exemplo). Roda na função `api/claude-revisional`; o modelo padrão é o `claude-sonnet-5-5`.
- **Ranking Olinda (BCB)**: tabela com a taxa praticada por **cada banco** na modalidade e na data do contrato. Dá para aplicar a taxa de um banco específico como paradigma, ou só preencher o nome do banco.
- **Laudo PDF pericial**: gerado no navegador, com comparativo de taxas e custo total, demonstrativo parcela a parcela, correção e juros, tarifas, deduções, multa e honorários, economia nas vincendas e gráficos vetoriais (evolução do saldo devedor).
- **Texto para petição**: resumo pronto para colar na petição ou mandar no WhatsApp.
- **Gráficos do caso**: régua de abusividade, saldo devedor (banco × recalculado), taxa média do BACEN ao longo do tempo × taxa do contrato e composição do proveito econômico.
- **Google Drive**: buscar o contrato no Drive e salvar o laudo numa pasta (na última pasta usada ou numa pasta nova). Usa o escopo `drive.file`, ou seja, só enxerga o que a pessoa escolhe ou o que o próprio sistema cria.
- **Rotinas automáticas (Vercel Cron)**:
  - `api/djen-sync`, todo dia às 10h UTC: procura publicações novas no DJEN para os processos salvos e marca as intimações novas.
  - `api/keep-alive`, todo dia às 9h UTC: mantém o banco Supabase ativo.

---

## 3. Como as contas são feitas

O código está em `src/lib/juros/index.ts` (motor básico) e `src/lib/juros/revisional-pro.ts` (motor pericial).

### 3.1 Taxa média de mercado (paradigma)
- Cada modalidade (veículo PF/PJ, empréstimo pessoal, consignado público/CLT/INSS, cartão parcelado/rotativo, cheque especial PF/PJ, capital de giro, empréstimo com garantia) aponta para duas séries do **BACEN/SGS**: uma da taxa mensal (% a.m.) e outra da anual (% a.a.).
- Na hora do cálculo o sistema consulta a API do BACEN (`api.bcb.gov.br`). Se ela não responder, usa a cópia guardada em `bacen-series.json` (de jan/2012 em diante).
- A taxa usada é a do **mês da assinatura do contrato**. As regras de reserva:
  - se a série específica ainda não existia naquele mês, usa uma série alternativa (por exemplo, crédito pessoal não consignado total);
  - se o mês ainda não foi divulgado, usa o mais recente;
  - se o mês é anterior ao início da série, usa o mais antigo disponível.
  Em todos esses casos o laudo traz uma observação explicando a troca.
- **Fontes alternativas de paradigma**: a taxa de um banco específico (API **Olinda** do BCB, no período mais próximo da data do contrato) ou uma taxa digitada à mão.

### 3.2 Conversão de taxas
- Mensal → anual: `aa = (1 + am)^12 − 1`
- Anual → mensal: `am = (1 + aa)^(1/12) − 1`

### 3.3 Tabela Price
- **Parcela**: `P = PV · i / (1 − (1 + i)^−n)` (com taxa zero, `P = PV / n`)
- **Taxa efetiva pelas parcelas**: descobre a taxa que transforma o valor financiado em *n* parcelas de *P*. A busca é numérica, por **bisseção** (200 iterações).
- **Saldo devedor depois de k parcelas**: `S = PV·(1+i)^k − P·((1+i)^k − 1)/i`

### 3.4 Análise do contrato (abusividade)
1. **Taxa do contrato**: a taxa mensal informada; se não houver, a anual convertida; se nenhuma das duas foi informada, a taxa efetiva calculada pelas parcelas.
2. **Razão** = taxa do contrato ÷ taxa média (calculada no mensal e no anual; a classificação usa a mensal).
3. **Classificação**:
   - **Indício de abuso**: razão ≥ **1,5x** (o parâmetro usual do STJ)
   - **Acima da média**: entre 1,1x e 1,5x
   - **Dentro da média**: até 1,1x
4. **Custos embutidos**: quando a taxa efetiva pelas parcelas passa a taxa informada em mais de 0,05 p.p., o sistema avisa que há custos escondidos na parcela.
5. **Números principais**:
   - parcela na taxa média = Price(valor financiado, taxa média, n)
   - total do contrato = parcela × n; total na média = parcela na média × n
   - diferença no contrato = total − total na média
   - já pago a mais = (parcela − parcela na média) × parcelas pagas
   - saldo hoje (banco) × saldo hoje na média × **saldo recalculado** (taxa média, abatendo o que foi efetivamente pago)

### 3.5 Cálculo pericial do processo (vários contratos)
Para cada contrato:
1. Monta a **grade de parcelas**: vencimentos mensais a partir do 1º vencimento, que pode ser editada uma por uma (valor pago, paga ou não).
2. Para cada **parcela paga**: diferença = valor pago − parcela na taxa paradigma (nunca negativa).
   - Com a opção **restituição em dobro** (art. 42 do CDC) ligada, a diferença é multiplicada por 2.
   - A diferença é **atualizada** (correção + juros, item 3.6) desde o vencimento até a data-base.
3. **Pagamentos extras/avulsos**: também são atualizados desde a data do pagamento e entram em dobro se a opção estiver ligada.
4. **Parcelas a vencer**: economia = (parcela contratada − parcela na taxa paradigma) × parcelas não pagas. Esse valor não é atualizado.

Depois, no nível do processo:
- **Tarifas e seguros** (prestamista, avaliação do bem, registro, TAC, TEC, IOF etc.): valor simples ou em dobro, atualizado desde a data da cobrança.
- **Deduções/alvarás** (valores já devolvidos): abatidos, com ou sem atualização.

```
Base líquida      = diferenças atualizadas + extras atualizados + tarifas atualizadas − deduções
Multa global      = base líquida × % multa
Subtotal          = base líquida + multa
Honorários        = subtotal × % honorários
Total restituição = subtotal + honorários
VALOR DA AÇÃO     = total restituição + economia nas parcelas a vencer
```

### 3.6 Atualização monetária (correção + juros)
Aplicada a cada valor desde a data do evento (vencimento, cobrança ou pagamento) até a **data-base** escolhida. As séries vêm do BACEN/SGS: INPC (188), IPCA (433), IGP-M (189) e SELIC (4390).

**Correção monetária (composta, mês a mês)**
- Fator = produto de (1 + índice do mês), do mês inicial até o mês anterior à data-base.
- Índices disponíveis: **INPC/IPCA** (INPC até ago/2024 e IPCA a partir de set/2024, conforme a Lei 14.905/2024, que é o padrão), INPC, IPCA, IGP-M ou nenhum.
- Se o fator ficar abaixo de 1 (deflação acumulada), o sistema usa 1, então a correção nunca reduz o valor.
- O termo inicial pode ser o vencimento ou uma data fixa.

**Juros de mora (simples: as taxas mensais são somadas, sem capitalização)**
- **Lei 14.905/2024** (padrão): 1% a.m. até ago/2024; a partir de set/2024, a taxa legal do mês = `(1 + SELIC) / (1 + IPCA) − 1` (nunca negativa).
- **SELIC**: soma da SELIC mensal. Nesse modo a SELIC **substitui** correção + juros, e a correção não é aplicada.
- **1% a.m. fixo**, ou uma **taxa fixa personalizada**.
- O termo inicial pode ser o vencimento ou a **data da citação**.
- Juros = valor corrigido × (soma das taxas mensais).

**Total atualizado** = valor original + correção + juros.

---

## 4. Banco de dados (Supabase)
- **Cálculos/clientes**: ficha do cliente (nome, CNJ, banco, contrato, categoria, fase do Kanban, observações) e o processo revisional completo, que pode ser reaberto, editado e **renovado** (recalculado com índices novos e data-base nova).
- **Fases e categorias/tipos de ação**: configuráveis.
- **Tarefas/prazos**: alimentam a Agenda e o Início.
- **Dados do DJEN** guardados junto ao processo: publicações, movimentações e marcação de "vistas".

---

## 5. Conector MCP (Claude Desktop / claude.ai)
Servidor MCP próprio (`api/mcp` em produção, `npm run mcp` localmente) que deixa o Claude operar o sistema direto pela conversa:

| Ferramenta | O que faz |
|---|---|
| `calcular_e_cadastrar_caso_revisional` | Lê os dados de um contrato (PDF ou foto lidos pelo Claude), roda o cálculo completo e salva na carteira (ou só simula) |
| `renovar_e_atualizar_caso` | Atualiza índices e data-base, adiciona tarifas, alvarás ou número CNJ e muda a fase |
| `mover_cartao_kanban` | Muda o cliente de fase |
| `consultar_carteira_clientes` | Pesquisa a carteira por banco, grau de abuso (ex.: razão ≥ 1,8x) ou fase |
| `consultar_taxas_bacen_olinda` | Consulta a média SGS e o ranking por banco |
| `consultar_publicacoes_djen` | Consulta publicações no DJEN |
| `listar_fases_e_modalidades` | Lista as fases do Kanban e as modalidades BACEN aceitas |
| `consultar_agenda` | Lista tarefas, prazos, audiências e reuniões (hoje, próximos dias, atrasados ou por cliente), com link para o Google Agenda |
| `agendar_compromisso` | Cria um item na Agenda, vinculado ou não a um cliente/processo da carteira |
| `atualizar_compromisso` | Conclui, reabre, remarca, edita, vincula ou exclui um item da Agenda |

---

## 6. Integrações externas
| Serviço | Uso |
|---|---|
| BACEN SGS (`api.bcb.gov.br`) | Taxas médias por modalidade e índices (INPC, IPCA, IGP-M, SELIC) |
| BACEN Olinda (`olinda.bcb.gov.br`) | Taxa de juros por instituição financeira |
| DJEN / PJe (`comunicaapi.pje.jus.br`) | Publicações e intimações |
| Anthropic (Claude) | Leitura de contratos e comandos no assistente |
| Google Drive / Picker / Agenda | Importar contratos, salvar laudos, criar eventos |
| Supabase | Login, banco de dados e RLS |
| Vercel | Hospedagem, funções `api/*` e cron |
