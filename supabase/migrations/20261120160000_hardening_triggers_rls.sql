-- Hardening de triggers, search_path, grants RLS e índices (Code Review P1/P2)
--
-- 1. Corrige o bug do "cliente zumbi": deletar um cliente (ON DELETE SET NULL em
--    revisional_calculos.cliente_id) ou desvincular manualmente não deve recriar o cliente.
-- 2. Fixa `search_path = pg_catalog, public` nas 4 funções da migração de clientes e adiciona
--    lock transacional contra criação duplicada concorrente pelo mesmo nome.
-- 3. Alinha tamanho máximo de `revisional_calculos.cliente_nome` (200 chars) com `revisional_clientes.nome`.
-- 4. Restringe grants de funções auxiliares (`PUBLIC`/`anon`) e `keep_alive_ping()` para `service_role`.
-- 5. Atualiza `updated_by_email` automaticamente em `revisional_configuracoes`.
-- 6. Adiciona índices ausentes em FKs e ordenações frequentes.

-- 1/3. Alinha limite de cliente_nome para evitar violação ao propagar nomes > 160 chars
alter table public.revisional_calculos
    drop constraint if exists revisional_calculos_cliente_nome_check;
alter table public.revisional_calculos
    add constraint revisional_calculos_cliente_nome_check
    check (char_length(btrim(cliente_nome)) between 1 and 200);

-- 2. Funções com search_path fixo e trigger de vínculo corrigido
create or replace function public.revisional_nome_normalizado(nome text)
returns text
language sql
immutable
set search_path = pg_catalog, public
as $$
    select lower(btrim(regexp_replace(coalesce(nome, ''), '\s+', ' ', 'g')));
$$;

create or replace function public.revisional_nome_e_de_cliente(nome text)
returns boolean
language sql
immutable
set search_path = pg_catalog, public
as $$
    select btrim(coalesce(nome, '')) <> ''
       and btrim(nome) !~* '^(processo|publica[cç][aã]o djen)\s';
$$;

create or replace function public.revisional_vincular_cliente_do_caso()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
    v_cliente uuid;
    v_nome_atual text;
    v_norm text;
begin
    if not public.revisional_nome_e_de_cliente(new.cliente_nome) then
        return new;
    end if;

    -- DELETE de cliente (ON DELETE SET NULL) ou desvinculação manual mantendo o mesmo nome:
    -- respeita cliente_id = null e NÃO ressuscita o cliente excluído.
    if tg_op = 'UPDATE'
       and old.cliente_id is not null
       and new.cliente_id is null
       and public.revisional_nome_normalizado(new.cliente_nome)
           = public.revisional_nome_normalizado(old.cliente_nome) then
        return new;
    end if;

    if new.cliente_id is not null then
        -- cliente_id informado explicitamente no INSERT ou trocado no UPDATE: respeita.
        if tg_op = 'INSERT' or new.cliente_id is distinct from old.cliente_id then
            return new;
        end if;
        select nome into v_nome_atual from public.revisional_clientes where id = new.cliente_id;
        if v_nome_atual is not null
           and public.revisional_nome_normalizado(v_nome_atual)
               = public.revisional_nome_normalizado(new.cliente_nome) then
            return new;
        end if;
    end if;

    v_norm := public.revisional_nome_normalizado(new.cliente_nome);
    -- Serializa busca/criação por nome normalizado para evitar clientes duplicados em concorrência.
    perform pg_advisory_xact_lock(hashtext('revisional_cliente:' || v_norm));

    select id into v_cliente
    from public.revisional_clientes
    where public.revisional_nome_normalizado(nome) = v_norm
    order by created_at
    limit 1;

    if v_cliente is null then
        insert into public.revisional_clientes (nome, tipo_pessoa)
        values (
            btrim(regexp_replace(new.cliente_nome, '\s+', ' ', 'g')),
            case when lower(coalesce(new.pessoa, '')) = 'pj' then 'pj' else 'pf' end
        )
        returning id into v_cliente;
    end if;

    new.cliente_id := v_cliente;
    return new;
end;
$$;

create or replace function public.revisional_propagar_nome_cliente()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
    if new.nome is distinct from old.nome then
        update public.revisional_calculos
        set cliente_nome = new.nome
        where cliente_id = new.id and cliente_nome is distinct from new.nome;
    end if;
    return new;
end;
$$;

-- 4. Hardening de grants em funções
revoke all on function public.is_escritorio_autorizado() from public, anon;
grant execute on function public.is_escritorio_autorizado() to authenticated;

revoke all on function public.revisional_nome_normalizado(text) from public, anon;
grant execute on function public.revisional_nome_normalizado(text) to authenticated;

revoke all on function public.revisional_nome_e_de_cliente(text) from public, anon;
grant execute on function public.revisional_nome_e_de_cliente(text) to authenticated;

revoke all on function public.keep_alive_ping() from public, anon, authenticated;
grant execute on function public.keep_alive_ping() to service_role;

-- 5. Atualiza updated_by_email em revisional_configuracoes
create or replace function public.set_revisional_config_audit()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
    new.updated_at := now();
    if coalesce(auth.jwt() ->> 'email', '') <> '' then
        new.updated_by_email := auth.jwt() ->> 'email';
    end if;
    return new;
end;
$$;

drop trigger if exists trg_revisional_configuracoes_updated_at on public.revisional_configuracoes;
create trigger trg_revisional_configuracoes_updated_at
    before insert or update on public.revisional_configuracoes
    for each row
    execute function public.set_revisional_config_audit();

-- 6. Índices ausentes em FKs e ordenações frequentes
create index if not exists revisional_documentos_modelo_idx
    on public.revisional_documentos (modelo_id);

create index if not exists revisional_modelos_nome_idx
    on public.revisional_modelos (nome);

create index if not exists revisional_tarefas_data_hora_idx
    on public.revisional_tarefas (data, hora);

create index if not exists revisional_calculos_processo_nao_vazio_idx
    on public.revisional_calculos (processo_global)
    where processo_global <> '';
