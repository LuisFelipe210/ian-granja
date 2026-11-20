-- Separa FASE (etapa do caso no fluxo, colunas do quadro) de CATEGORIA (tipo da ação).
--
-- revisional_categorias continua sendo a lista de FASES (é o que o quadro, o painel, o Início
-- e o conector do Claude já tratam como fase; o nome da tabela fica por compatibilidade).
-- revisional_tipos é a lista nova de CATEGORIAS (tipo da ação: Revisional, Busca e Apreensão...).
--
-- Migração dos dados:
--   * casos nas fases Triagem / Ajuizado / Acordo / Concluído: mantêm a fase, ficam sem categoria;
--   * casos em Busca e Apreensão / Revisional / Superendividamento: ganham essa categoria e vão
--     para a fase Ajuizado (se já têm número de processo) ou Triagem (se não têm);
--   * essas três saem da lista de fases e entra a fase "Em análise".
-- É idempotente: rodar de novo não duplica nada.

-- 1. Tabela de categorias (tipo da ação), mesmo formato e mesmas regras de acesso das fases
create table if not exists public.revisional_tipos (
    id uuid primary key default gen_random_uuid(),
    nome text not null check (char_length(btrim(nome)) between 1 and 60),
    cor text not null default 'ink' check (cor in ('gold', 'ink', 'crimson', 'emerald', 'slate')),
    ordem integer not null default 0,
    created_by uuid references auth.users(id) on delete set null default auth.uid(),
    created_at timestamptz not null default now()
);

create unique index if not exists revisional_tipos_nome_lower_idx
    on public.revisional_tipos (lower(btrim(nome)));

alter table public.revisional_tipos enable row level security;
revoke all on public.revisional_tipos from anon;
grant select, insert, update, delete on public.revisional_tipos to authenticated;

drop policy if exists "revisional_tipos_select_auth" on public.revisional_tipos;
create policy "revisional_tipos_select_auth"
    on public.revisional_tipos for select
    to authenticated
    using (public.is_escritorio_autorizado());

drop policy if exists "revisional_tipos_insert_auth" on public.revisional_tipos;
create policy "revisional_tipos_insert_auth"
    on public.revisional_tipos for insert
    to authenticated
    with check (public.is_escritorio_autorizado());

drop policy if exists "revisional_tipos_update_auth" on public.revisional_tipos;
create policy "revisional_tipos_update_auth"
    on public.revisional_tipos for update
    to authenticated
    using (public.is_escritorio_autorizado())
    with check (public.is_escritorio_autorizado());

drop policy if exists "revisional_tipos_delete_auth" on public.revisional_tipos;
create policy "revisional_tipos_delete_auth"
    on public.revisional_tipos for delete
    to authenticated
    using (public.is_escritorio_autorizado());

-- 2. Categoria do caso
alter table public.revisional_calculos
    add column if not exists tipo_id uuid references public.revisional_tipos(id) on delete set null;

create index if not exists revisional_calculos_tipo_idx on public.revisional_calculos (tipo_id);

-- 3. Migração dos dados
do $$
declare
    v_triagem uuid;
    v_ajuizado uuid;
    v_fase record;
    v_tipo uuid;
begin
    -- garante as fases de destino
    select id into v_triagem from public.revisional_categorias where lower(btrim(nome)) = 'triagem';
    if v_triagem is null then
        insert into public.revisional_categorias (nome, cor, ordem) values ('Triagem', 'gold', 1)
        returning id into v_triagem;
    end if;

    select id into v_ajuizado from public.revisional_categorias where lower(btrim(nome)) = 'ajuizado';
    if v_ajuizado is null then
        insert into public.revisional_categorias (nome, cor, ordem) values ('Ajuizado', 'emerald', 3)
        returning id into v_ajuizado;
    end if;

    -- cada "fase" que na verdade é tipo de ação vira categoria
    for v_fase in
        select id, nome, cor, ordem
        from public.revisional_categorias
        where lower(btrim(nome)) in ('busca e apreensão', 'busca e apreensao', 'revisional', 'superendividamento')
    loop
        insert into public.revisional_tipos (nome, cor, ordem)
        values (v_fase.nome, v_fase.cor, v_fase.ordem)
        on conflict ((lower(btrim(nome)))) do nothing;

        select id into v_tipo from public.revisional_tipos where lower(btrim(nome)) = lower(btrim(v_fase.nome));

        update public.revisional_calculos
        set tipo_id = v_tipo,
            categoria_id = case when btrim(coalesce(processo_global, '')) <> '' then v_ajuizado else v_triagem end
        where categoria_id = v_fase.id;

        delete from public.revisional_categorias where id = v_fase.id;
    end loop;

    -- fase nova entre Triagem e Ajuizado
    insert into public.revisional_categorias (nome, cor, ordem)
    values ('Em análise', 'ink', 2)
    on conflict ((lower(btrim(nome)))) do nothing;

    -- ordem do fluxo
    update public.revisional_categorias set ordem = 1 where lower(btrim(nome)) = 'triagem';
    update public.revisional_categorias set ordem = 2 where lower(btrim(nome)) = 'em análise';
    update public.revisional_categorias set ordem = 3 where lower(btrim(nome)) = 'ajuizado';
    update public.revisional_categorias set ordem = 4 where lower(btrim(nome)) = 'acordo / concluído';
end $$;
