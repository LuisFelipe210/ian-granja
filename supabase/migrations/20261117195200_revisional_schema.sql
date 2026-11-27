-- Schema dedicado da Calculadora Revisional (Ian Granja Advogados)

create extension if not exists pgcrypto;

-- 1. Categorias editáveis do escritório
create table if not exists public.revisional_categorias (
    id uuid primary key default gen_random_uuid(),
    nome text not null check (char_length(btrim(nome)) between 1 and 60),
    cor text not null default 'gold' check (cor in ('gold', 'ink', 'crimson', 'emerald', 'slate')),
    ordem integer not null default 0,
    created_by uuid references auth.users(id) on delete set null default auth.uid(),
    created_at timestamptz not null default now()
);

create unique index if not exists revisional_categorias_nome_lower_idx
    on public.revisional_categorias (lower(btrim(nome)));

alter table public.revisional_categorias enable row level security;
revoke all on public.revisional_categorias from anon;
grant select, insert, update, delete on public.revisional_categorias to authenticated;

drop policy if exists "revisional_categorias_select_auth" on public.revisional_categorias;
create policy "revisional_categorias_select_auth"
    on public.revisional_categorias for select
    to authenticated
    using (true);

drop policy if exists "revisional_categorias_insert_auth" on public.revisional_categorias;
create policy "revisional_categorias_insert_auth"
    on public.revisional_categorias for insert
    to authenticated
    with check (true);

drop policy if exists "revisional_categorias_update_auth" on public.revisional_categorias;
create policy "revisional_categorias_update_auth"
    on public.revisional_categorias for update
    to authenticated
    using (true)
    with check (true);

drop policy if exists "revisional_categorias_delete_auth" on public.revisional_categorias;
create policy "revisional_categorias_delete_auth"
    on public.revisional_categorias for delete
    to authenticated
    using (true);

-- Seed inicial das categorias do escritório
insert into public.revisional_categorias (nome, cor, ordem)
values
    ('Triagem', 'gold', 1),
    ('Busca e Apreensão', 'crimson', 2),
    ('Revisional', 'ink', 3),
    ('Superendividamento', 'slate', 4),
    ('Ajuizado', 'emerald', 5),
    ('Acordo / Concluído', 'slate', 6)
on conflict ((lower(btrim(nome)))) do nothing;

-- 2. Histórico de cálculos revisionais salvos por cliente
create table if not exists public.revisional_calculos (
    id uuid primary key default gen_random_uuid(),
    categoria_id uuid references public.revisional_categorias(id) on delete set null,
    cliente_nome text not null check (char_length(btrim(cliente_nome)) between 1 and 160),
    banco text not null default '' check (char_length(banco) <= 100),
    documento_contrato text not null default '' check (char_length(documento_contrato) <= 80),
    observacoes text not null default '' check (char_length(observacoes) <= 4000),

    -- Parâmetros de entrada do contrato
    pessoa text not null check (pessoa in ('pf', 'pj')),
    modalidade_id text not null check (char_length(modalidade_id) between 1 and 50),
    modalidade_nome text not null check (char_length(modalidade_nome) between 1 and 120),
    mes_contrato text not null check (mes_contrato ~ '^\d{4}-(0[1-9]|1[0-2])$'),
    valor_financiado numeric(14, 2) not null check (valor_financiado > 0),
    valor_parcela numeric(14, 2) not null check (valor_parcela > 0),
    parcelas integer not null check (parcelas >= 1 and parcelas <= 999),
    pagas integer not null default 0 check (pagas >= 0 and pagas <= parcelas),
    taxa_mensal_informada numeric(8, 4),
    taxa_anual_informada numeric(10, 4),
    media_mensal_manual numeric(8, 4),
    media_anual_manual numeric(10, 4),

    -- Snapshot do resultado calculado na data
    contrato_am numeric(8, 4) not null,
    contrato_aa numeric(10, 4) not null,
    taxa_efetiva numeric(8, 4) not null,
    media_am numeric(8, 4) not null,
    media_aa numeric(10, 4) not null,
    media_mes text not null,
    serie_am integer,
    serie_aa integer,
    razao_am numeric(8, 4) not null,
    razao_aa numeric(8, 4) not null,
    nivel text not null check (nivel in ('abuso', 'acima', 'media')),
    diferenca_total numeric(14, 2) not null,
    pago_a_mais numeric(14, 2) not null,
    saldo_recalculado numeric(14, 2) not null,

    created_by uuid references auth.users(id) on delete set null default auth.uid(),
    created_by_email text not null default coalesce(auth.jwt() ->> 'email', ''),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists revisional_calculos_updated_at_idx
    on public.revisional_calculos (updated_at desc);

create index if not exists revisional_calculos_categoria_id_idx
    on public.revisional_calculos (categoria_id);

create index if not exists revisional_calculos_nivel_idx
    on public.revisional_calculos (nivel);

create index if not exists revisional_calculos_cliente_lower_idx
    on public.revisional_calculos (lower(cliente_nome));

create or replace function public.set_revisional_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_revisional_calculos_updated_at on public.revisional_calculos;
create trigger trg_revisional_calculos_updated_at
    before update on public.revisional_calculos
    for each row
    execute function public.set_revisional_updated_at();

alter table public.revisional_calculos enable row level security;
revoke all on public.revisional_calculos from anon;
grant select, insert, update, delete on public.revisional_calculos to authenticated;

drop policy if exists "revisional_calculos_select_auth" on public.revisional_calculos;
create policy "revisional_calculos_select_auth"
    on public.revisional_calculos for select
    to authenticated
    using (true);

drop policy if exists "revisional_calculos_insert_auth" on public.revisional_calculos;
create policy "revisional_calculos_insert_auth"
    on public.revisional_calculos for insert
    to authenticated
    with check (true);

drop policy if exists "revisional_calculos_update_auth" on public.revisional_calculos;
create policy "revisional_calculos_update_auth"
    on public.revisional_calculos for update
    to authenticated
    using (true)
    with check (true);

drop policy if exists "revisional_calculos_delete_auth" on public.revisional_calculos;
create policy "revisional_calculos_delete_auth"
    on public.revisional_calculos for delete
    to authenticated
    using (true);

-- 3. Heartbeat de keep-alive (evita pausa de 7 dias no Free Tier sem expor dados)
create table if not exists public.keep_alive_heartbeat (
    id integer primary key check (id = 1),
    pinged_at timestamptz not null default now()
);

alter table public.keep_alive_heartbeat enable row level security;
revoke all on public.keep_alive_heartbeat from anon, authenticated;

create or replace function public.keep_alive_ping()
returns timestamptz
language sql
security definer
set search_path = public
as $$
    insert into public.keep_alive_heartbeat (id, pinged_at)
    values (1, now())
    on conflict (id) do update set pinged_at = excluded.pinged_at
    returning pinged_at;
$$;

grant execute on function public.keep_alive_ping() to anon, authenticated;
