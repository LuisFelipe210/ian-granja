# Plano: sistema interno em formato dashboard

Data: 18/11/2026 · Branch: `revisional-claude-mcp-djen`
Status: **planejado, nenhum código alterado ainda.**

Área afetada: `/ferramentas/calculadora-revisional/*` (uso interno, login Supabase).
O site público (`/`, `/sobre`, `/atuacao`, …) **não muda**.

---

## 1. Decisões já tomadas com o usuário

| Pergunta | Resposta |
|---|---|
| Tela que abre ao entrar | **Início com resumo do dia** (não mais a calculadora) |
| Escopo | **Layout + funções novas** (Agenda, prazos e tarefas, com tabela nova no Supabase) |
| Menu lateral | **Azul-marinho escuro** com logo dourado; conteúdo em fundo claro |
| Referência | LinkLei (app.linklei.com.br): copiar a **organização e as funções**, nunca o visual |

Fica igual (compromissos de marca no `PRODUCT.md`): azul-marinho + dourado, logo PNG, fonte Archivo, cantos retos.

## 2. O que NÃO fazer (anti "AI slop")

Coisas que o LinkLei e todo template de IA fazem e que ficam de fora:

- Faixa com gradiente (tipo o banner "Atlas" do LinkLei)
- Saudação com emoji ("Olá, Luis 👋")
- KPIs em cards com ícone dentro de quadradinho colorido, um ao lado do outro
- Botões em pílula, glassmorphism, sombras grandes, borda colorida de um lado só no card
- Animação de entrada na página. No sistema, só movimento que comunica estado (150–250 ms)
- Títulos largos de "site" (`.display`, `.subdisplay` em 2rem) e rótulos `rubric` em caixa-alta em toda seção

O que fazer no lugar:

- **KPIs numa faixa só**, dividida por linhas finas (1px), com números grandes `tabular-nums` e rótulo curto. Cada número é clicável e abre a lista já filtrada.
- Títulos em Archivo normal (sem `font-stretch` largo), escala apertada (1.125–1.2).
- Dourado só para: ação primária, item ativo e alerta de prazo. Nunca para decoração.
- Tabelas densas, com linhas de 40–44px, cabeçalho fixo e números alinhados à direita.

## 3. Estrutura nova (rotas)

Base: `BASE_ROTA = "/ferramentas/calculadora-revisional"`

| Rota | Tela | Antes |
|---|---|---|
| `BASE_ROTA` | **Início** (nova) | era a Calculadora |
| `BASE_ROTA/calculo` | Calculadora em branco | era `BASE_ROTA` |
| `BASE_ROTA/caso/:id` | Calculadora com caso | igual |
| `BASE_ROTA/historico` | Carteira | igual |
| `BASE_ROTA/processos[/:id]` | Processos DJEN | igual |
| `BASE_ROTA/agenda` | **Agenda** (nova) | não existia |
| `BASE_ROTA/painel` | Painel gráfico | igual |
| `BASE_ROTA/categorias` | Categorias | igual |

**Atenção:** em `src/pages/CalculadoraAdvogado.tsx`, toda chamada `navigate(BASE_ROTA)` que quer dizer "ir para a calculadora" precisa virar `navigate(ROTA_CALCULO)`. Estão nas linhas ~1049–1050 (`limparFormulario`), ~1112 (`duplicarCasoDoHistorico`), ~1661 (`usarPublicacaoDjenNaCalculadora`) e ~1860 (`onIrCalculadora`). Também o `<Link>` da aba Calculadora (~1735). A detecção de `aba` (linhas ~804–813) ganha `"inicio"` (subRota vazia) e `"agenda"`.

## 4. Banco: tabela de tarefas e prazos

Migração nova: `supabase/migrations/20261118120000_revisional_tarefas.sql`

```sql
create table if not exists public.revisional_tarefas (
    id uuid primary key default gen_random_uuid(),
    titulo text not null check (char_length(btrim(titulo)) between 1 and 200),
    tipo text not null default 'tarefa'
        check (tipo in ('tarefa', 'prazo', 'audiencia', 'reuniao')),
    data date not null,
    hora time,
    calculo_id uuid references public.revisional_calculos(id) on delete set null,
    concluida boolean not null default false,
    observacoes text not null default '' check (char_length(observacoes) <= 2000),
    created_by uuid references auth.users(id) on delete set null default auth.uid(),
    created_by_email text not null default coalesce(auth.jwt() ->> 'email', ''),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists revisional_tarefas_data_idx on public.revisional_tarefas (data, concluida);
create index if not exists revisional_tarefas_calculo_idx on public.revisional_tarefas (calculo_id);

drop trigger if exists trg_revisional_tarefas_updated_at on public.revisional_tarefas;
create trigger trg_revisional_tarefas_updated_at
    before update on public.revisional_tarefas
    for each row execute function public.set_revisional_updated_at();

alter table public.revisional_tarefas enable row level security;
revoke all on public.revisional_tarefas from anon;
grant select, insert, update, delete on public.revisional_tarefas to authenticated;

-- mesmas 4 políticas das outras tabelas, usando public.is_escritorio_autorizado()
-- (select / insert with check / update using+with check / delete)
```

Seguir exatamente o padrão de `20261117195500_lockdown_whitelist.sql` (whitelist de e-mails).

Local: `supabase migration up` (ou `supabase db reset` + `npm run db:seed`).
**Produção:** o usuário aplica com `supabase db push`. Não aplicar sem pedir.

Opcional: no `scripts/seed-local.ts`, criar 6–8 tarefas de exemplo (prazos em hoje, amanhã e próxima semana, ligados a casos do seed).

### Camada de dados (`src/lib/revisional-db.ts`)

```ts
export type TipoTarefa = "tarefa" | "prazo" | "audiencia" | "reuniao";
export interface Tarefa { id; titulo; tipo: TipoTarefa; data: string; hora: string | null;
  calculo_id: string | null; concluida: boolean; observacoes: string;
  created_by_email: string; created_at: string; updated_at: string; }
export type TarefaPayload = Pick<Tarefa, "titulo"|"tipo"|"data"|"hora"|"calculo_id"|"concluida"|"observacoes">;

listarTarefas()          // GET revisional_tarefas?select=*&order=data.asc,hora.asc.nullslast
criarTarefa(payload)     // POST, Prefer: return=representation
atualizarTarefa(id, patch)
excluirTarefa(id)
```

Usar `restRequest` como as outras. **Se a tabela não existir** (PostgREST devolve 404 ou código `42P01`/`PGRST205`), lançar um erro específico, e a Agenda mostra "A agenda precisa da migração do banco" em vez de quebrar a tela toda. Carregar tarefas em `carregarDadosEscritorio` com `Promise.allSettled`, para que uma falha nas tarefas não derrube a carteira.

Testes: adicionar casos em `tests/revisional-db.test.ts` para o mapeamento e o fallback de tabela ausente.

## 5. Shell (moldura do app)

Novo componente: `src/components/juros/ShellSistema.tsx`, que envolve todas as telas após o login.

**Menu lateral (desktop ≥ 1024px), 240px, fundo `bg-ink`:**

```
[logo2.png]  · selo "Banco local · teste" quando IS_LOCAL_SUPABASE

Início
Calculadora
Carteira            28
Processos            4   ● (ponto dourado se houver publicação nova)
Agenda               2   (prazos de hoje + atrasados)
Painel
──────────
Categorias
Radar DJEN          (abre o ModalConsultaDjen modo "oab")
──────────
email do usuário
Senha · Sair · Ver site ↗
```

- Item ativo: fundo `ink-soft`, texto `paper`, barra de 2px `gold-light` na esquerda **do item** (não do card), ícone lucide 16px.
- Inativo: `paper/70`, hover `paper`.
- Contadores alinhados à direita, `tabular-nums`, `paper/55`.

**Barra superior (área de conteúdo), 56px, fundo `card`, borda inferior 1px:**

- Esquerda: título da tela (Archivo 600, 1.125rem) + breadcrumb quando for caso/processo ("Carteira › Rafael Augusto Moura").
- Centro: **busca global** (cliente, CNJ, banco, contrato) sobre `calculos`. O dropdown mostra até 8 resultados agrupados (Carteira / Processos) e abre com `/` ou `Ctrl+K`. Usar portal ou `position: fixed` para não ser cortado.
- Direita: botão primário dourado **"Novo"** com menu: Novo cálculo · Nova tarefa ou prazo · Consultar processo no DJEN.

**Mobile (< 1024px):** a barra superior ganha um botão de menu que abre o menu lateral como gaveta (overlay, foco preso, `Esc` fecha). A busca vira ícone que expande. Sem scroll horizontal.

Mover para dentro do shell o que hoje está no `<header>` de `CalculadoraAdvogado.tsx` (linhas ~1680–1819), incluindo Senha, Sair, Radar DJEN e "Novo cálculo em branco". O `<main>` de cada aba perde o `container py-10 lg:py-14` e passa a usar o padding do shell (`px-6 py-6`, largura fluida, `max-w-[1440px]`).

## 6. Tela Início (nova)

Componente: `src/components/juros/InicioSistema.tsx`. Recebe `calculos`, `categorias`, `tarefas` e callbacks.

Layout desktop (grid de 12 colunas, gap 24px):

1. **Linha de atalhos** (sem saudação): `Novo cálculo` · `Nova tarefa` · `Consultar DJEN` · `Verificar publicações agora`. Botões secundários com borda; o `Novo` da topbar continua sendo o primário.
2. **Faixa de KPIs** (12 col, uma faixa só com divisórias):
   - Publicações novas (soma de `idsNovos` de `lerDadosProcessoDjen`) → Processos
   - Prazos em aberto (processos com `statusProcesso === "prazo_aberto"`) → Processos filtrado
   - Agenda hoje (tarefas de hoje não concluídas; atrasadas em vermelho) → Agenda
   - Casos com indício de abuso (`razao_am ≥ 1,5`) → Carteira filtrada
   - Proveito econômico da carteira (`agregarEstatisticasCarteira`) → Painel
3. **Coluna esquerda (8 col):**
   - "Hoje e próximos 7 dias": lista de tarefas e prazos agrupada por dia, com checkbox para concluir inline, tipo em texto pequeno (Prazo em vermelho/dourado, Audiência, Reunião, Tarefa) e link para o caso vinculado. Estado vazio: "Nada agendado para esta semana" + botão "Adicionar prazo".
   - "Publicações recentes do DJEN": as 6 movimentações mais novas de todos os processos (data, tribunal, cliente, tipo, marcador "nova"). Clique abre `/processos/:id`.
4. **Coluna direita (4 col):**
   - "Casos recentes": os 6 últimos por `updated_at` (cliente, banco, razão `1,71x`, valor). Reaproveita a lista que hoje fica no painel vazio da calculadora (linhas ~2252–2303).
   - "Carteira por fase": barras horizontais finas por categoria (reaproveitar as cores de `PainelEstatisticas`).

Loading: **skeleton** com as formas reais, não spinner no meio.

## 7. Tela Agenda (nova)

Componente: `src/components/juros/AgendaSistema.tsx`

- Barra: `‹ Novembro 2026 ›` · alternância **Mês / Lista** · filtro por tipo · checkbox "Mostrar concluídas".
- **Mês:** grade seg–dom, fim de semana em fundo `secondary`, hoje marcado com o número em círculo `ink` (só esse caso é círculo). Em cada dia, até 3 linhas "• 1 Prazo / • 1 Audiência" e "+N".
- **Lista:** agrupada por dia, mesma linha usada no Início.
- **Painel direito "A fazer"** (desktop): atrasadas + hoje + amanhã, com toggle de concluir.
- **Criar e editar:** painel lateral (sheet) à direita, não modal no meio da tela. Campos: título, tipo (segmented), data, hora (opcional), caso vinculado (combobox buscando `calculos`), observações. Ações: Salvar, Excluir (com confirmação), Cancelar.
- Clicar num dia vazio abre o sheet já com a data preenchida.
- Integração: no detalhe do processo (`ProcessosSalvosDjen`) e no `HistoricoCalculos`, botão "Adicionar prazo" que abre o mesmo sheet com `calculo_id` preenchido.

## 8. Ajustar as telas existentes ao shell

Em cada uma, trocar o cabeçalho grande "de site" por uma **toolbar compacta**. O título passa a ficar na topbar do shell.

| Arquivo | Mudança |
|---|---|
| `PainelEstatisticas.tsx` | tirar o bloco `sheet-on-paper` com h1 `subdisplay`; filtros de categoria viram toolbar; KPIs no padrão da faixa única |
| `HistoricoCalculos.tsx` | tirar o h1 "Pauta de clientes salvos"; resumo (28 casos · 11 com abuso…) vai para a toolbar; botões Tabela/Por fase/Quadro como segmented |
| `ProcessosSalvosDjen.tsx` | abas no topo, como no LinkLei: **Processos · Publicações** (lista plana de todas as movimentações, filtro Não lidas/Todas) |
| `GerenciarCategorias.tsx` | só remover o header grande |
| Calculadora (`CalculadoraAdvogado.tsx` ~1951–2307) | tirar o bloco "Suite Pericial Bancária / Cálculo revisional completo"; o painel vazio da direita perde o `HeroArt` e a folha de rosto e vira um estado vazio curto ("O resultado aparece aqui") |

Trocar `.subdisplay` e `.rubric` dentro do sistema por classes utilitárias simples. Se ajudar, criar em `index.css`: `.sys-title` (Archivo 600, 1.125rem), `.sys-label` (0.8125rem, 500, `muted-foreground`, sentence case).

## 9. Verificação

1. `npm run typecheck` · `npm run lint` · `npm test`
2. Preview local (`.claude/launch.json` → "dev"; usa Supabase local via `.env.development.local`). Login com a conta do seed (`scripts/seed-local.ts`).
3. Conferir em 1440×900 e 390×844: Início, Calculadora, Carteira, Processos, Agenda, Painel, Categorias. Testar: menu mobile, busca global, criar/concluir/excluir tarefa, links dos KPIs, Radar DJEN, Sair.
4. Rodar `impeccable detect --json` nos arquivos alterados e corrigir os achados.
5. Ao final, gerar `DESIGN.md` com o sistema do dashboard (skill impeccable: documenter).

## 10. Ordem sugerida de execução

1. Migração + `revisional-db.ts` + testes
2. `ShellSistema` + rotas novas (corrigir os `navigate(BASE_ROTA)`)
3. `InicioSistema`
4. `AgendaSistema` + sheet de tarefa
5. Ajustar as telas existentes (seção 8)
6. Verificação (seção 9)

Fora do escopo desta rodada (ideias para depois): ferramentas de tarefa no MCP (`src/lib/mcp/revisional-mcp-core.ts`), financeiro, documentos, notificações.
