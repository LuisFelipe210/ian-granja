-- Cadastro de clientes (pessoas): CPF/CNPJ, RG, estado civil, profissão, endereço e contato.
-- Os casos (revisional_calculos) e os documentos passam a apontar para o cliente.
-- Casos existentes e casos novos são ligados automaticamente pelo nome (gatilho abaixo).

create table if not exists public.revisional_clientes (
    id uuid primary key default gen_random_uuid(),
    tipo_pessoa text not null default 'pf' check (tipo_pessoa in ('pf', 'pj')),
    nome text not null check (char_length(btrim(nome)) between 1 and 200),
    cpf_cnpj text not null default '' check (cpf_cnpj ~ '^([0-9]{11}|[0-9]{14})?$'),
    rg text not null default '' check (char_length(rg) <= 40),
    rg_orgao text not null default '' check (char_length(rg_orgao) <= 40),
    nacionalidade text not null default '' check (char_length(nacionalidade) <= 60),
    estado_civil text not null default '' check (char_length(estado_civil) <= 40),
    profissao text not null default '' check (char_length(profissao) <= 100),
    genero text not null default '' check (genero in ('', 'm', 'f')),
    data_nascimento date,
    email text not null default '' check (char_length(email) <= 200),
    telefone text not null default '' check (char_length(telefone) <= 40),
    cep text not null default '' check (cep ~ '^([0-9]{8})?$'),
    logradouro text not null default '' check (char_length(logradouro) <= 200),
    numero text not null default '' check (char_length(numero) <= 20),
    complemento text not null default '' check (char_length(complemento) <= 100),
    bairro text not null default '' check (char_length(bairro) <= 100),
    cidade text not null default '' check (char_length(cidade) <= 100),
    uf text not null default '' check (uf ~ '^([A-Z]{2})?$'),
    representante_nome text not null default '' check (char_length(representante_nome) <= 200),
    representante_cpf text not null default '' check (representante_cpf ~ '^([0-9]{11})?$'),
    observacoes text not null default '' check (char_length(observacoes) <= 4000),
    created_by uuid references auth.users(id) on delete set null default auth.uid(),
    created_by_email text not null default coalesce(auth.jwt() ->> 'email', ''),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create or replace function public.revisional_nome_normalizado(nome text)
returns text
language sql
immutable
as $$
    select lower(btrim(regexp_replace(coalesce(nome, ''), '\s+', ' ', 'g')));
$$;

create unique index if not exists revisional_clientes_cpf_cnpj_uidx
    on public.revisional_clientes (cpf_cnpj) where cpf_cnpj <> '';

create index if not exists revisional_clientes_nome_idx
    on public.revisional_clientes (public.revisional_nome_normalizado(nome));

drop trigger if exists trg_revisional_clientes_updated_at on public.revisional_clientes;
create trigger trg_revisional_clientes_updated_at
    before update on public.revisional_clientes
    for each row
    execute function public.set_revisional_updated_at();

alter table public.revisional_clientes enable row level security;
revoke all on public.revisional_clientes from anon;
grant select, insert, update, delete on public.revisional_clientes to authenticated;

drop policy if exists "revisional_clientes_all_auth" on public.revisional_clientes;
create policy "revisional_clientes_all_auth"
    on public.revisional_clientes for all
    to authenticated
    using (public.is_escritorio_autorizado())
    with check (public.is_escritorio_autorizado());

-- Vínculos
alter table public.revisional_calculos
    add column if not exists cliente_id uuid references public.revisional_clientes(id) on delete set null;
create index if not exists revisional_calculos_cliente_idx on public.revisional_calculos (cliente_id);

alter table public.revisional_documentos
    add column if not exists cliente_id uuid references public.revisional_clientes(id) on delete set null;
create index if not exists revisional_documentos_cliente_idx on public.revisional_documentos (cliente_id);

-- Nome que não é de pessoa (processo importado do DJEN sem parte identificada): não vira cliente.
create or replace function public.revisional_nome_e_de_cliente(nome text)
returns boolean
language sql
immutable
as $$
    select btrim(coalesce(nome, '')) <> ''
       and btrim(nome) !~* '^(processo|publica[cç][aã]o djen)\s';
$$;

-- Liga o caso ao cliente com o mesmo nome (ou cria o cliente) quando o caso é salvo sem cliente
-- ou quando o nome do cliente no caso muda para outra pessoa.
create or replace function public.revisional_vincular_cliente_do_caso()
returns trigger
language plpgsql
as $$
declare
    v_cliente uuid;
    v_nome_atual text;
begin
    if not public.revisional_nome_e_de_cliente(new.cliente_nome) then
        return new;
    end if;

    if new.cliente_id is not null then
        -- cliente_id escolhido explicitamente nesta gravação: respeita.
        if tg_op = 'UPDATE' and new.cliente_id is distinct from old.cliente_id then
            return new;
        end if;
        select nome into v_nome_atual from public.revisional_clientes where id = new.cliente_id;
        if v_nome_atual is not null
           and public.revisional_nome_normalizado(v_nome_atual) = public.revisional_nome_normalizado(new.cliente_nome) then
            return new;
        end if;
    end if;

    select id into v_cliente
    from public.revisional_clientes
    where public.revisional_nome_normalizado(nome) = public.revisional_nome_normalizado(new.cliente_nome)
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

drop trigger if exists trg_revisional_calculos_vincular_cliente on public.revisional_calculos;
create trigger trg_revisional_calculos_vincular_cliente
    before insert or update of cliente_nome, cliente_id on public.revisional_calculos
    for each row
    execute function public.revisional_vincular_cliente_do_caso();

-- Nome do cliente alterado no cadastro: atualiza o nome mostrado nos casos dele.
create or replace function public.revisional_propagar_nome_cliente()
returns trigger
language plpgsql
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

drop trigger if exists trg_revisional_clientes_propagar_nome on public.revisional_clientes;
create trigger trg_revisional_clientes_propagar_nome
    after update of nome on public.revisional_clientes
    for each row
    execute function public.revisional_propagar_nome_cliente();

-- Casos já existentes: um cliente por nome (repetidos viram um só) e vínculo.
insert into public.revisional_clientes (nome, tipo_pessoa, created_by, created_by_email)
select distinct on (public.revisional_nome_normalizado(c.cliente_nome))
    btrim(regexp_replace(c.cliente_nome, '\s+', ' ', 'g')),
    case when lower(coalesce(c.pessoa, '')) = 'pj' then 'pj' else 'pf' end,
    null,
    ''
from public.revisional_calculos c
where public.revisional_nome_e_de_cliente(c.cliente_nome)
  and not exists (
      select 1 from public.revisional_clientes x
      where public.revisional_nome_normalizado(x.nome) = public.revisional_nome_normalizado(c.cliente_nome)
  )
order by public.revisional_nome_normalizado(c.cliente_nome), c.created_at;

update public.revisional_calculos c
set cliente_id = x.id
from public.revisional_clientes x
where c.cliente_id is null
  and public.revisional_nome_e_de_cliente(c.cliente_nome)
  and public.revisional_nome_normalizado(x.nome) = public.revisional_nome_normalizado(c.cliente_nome);

update public.revisional_documentos d
set cliente_id = c.cliente_id
from public.revisional_calculos c
where d.cliente_id is null and d.calculo_id = c.id and c.cliente_id is not null;
