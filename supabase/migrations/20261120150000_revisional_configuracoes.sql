-- Configurações do escritório (página Configurações do sistema): nome do advogado, OAB e cidade.
-- Usadas nas petições ([advogado], [oab], [cidade]), na consulta do DJEN pela OAB e na
-- verificação automática (api/djen-sync). Uma linha só, id = 'escritorio'.

create table if not exists public.revisional_configuracoes (
    id text primary key default 'escritorio' check (id = 'escritorio'),
    nome_advogado text not null default '' check (char_length(nome_advogado) <= 200),
    oab_numero text not null default '' check (oab_numero ~ '^[0-9]{0,10}$'),
    oab_uf text not null default '' check (oab_uf ~ '^([A-Z]{2})?$'),
    cidade text not null default '' check (char_length(cidade) <= 100),
    uf text not null default '' check (uf ~ '^([A-Z]{2})?$'),
    updated_by_email text not null default coalesce(auth.jwt() ->> 'email', ''),
    updated_at timestamptz not null default now()
);

drop trigger if exists trg_revisional_configuracoes_updated_at on public.revisional_configuracoes;
create trigger trg_revisional_configuracoes_updated_at
    before update on public.revisional_configuracoes
    for each row
    execute function public.set_revisional_updated_at();

alter table public.revisional_configuracoes enable row level security;
revoke all on public.revisional_configuracoes from anon;
grant select, insert, update on public.revisional_configuracoes to authenticated;

drop policy if exists "revisional_configuracoes_select_auth" on public.revisional_configuracoes;
create policy "revisional_configuracoes_select_auth"
    on public.revisional_configuracoes for select
    to authenticated
    using (public.is_escritorio_autorizado());

drop policy if exists "revisional_configuracoes_insert_auth" on public.revisional_configuracoes;
create policy "revisional_configuracoes_insert_auth"
    on public.revisional_configuracoes for insert
    to authenticated
    with check (public.is_escritorio_autorizado());

drop policy if exists "revisional_configuracoes_update_auth" on public.revisional_configuracoes;
create policy "revisional_configuracoes_update_auth"
    on public.revisional_configuracoes for update
    to authenticated
    using (public.is_escritorio_autorizado())
    with check (public.is_escritorio_autorizado());

-- Valores que estavam fixos no código até agora.
insert into public.revisional_configuracoes (id, nome_advogado, oab_numero, oab_uf, cidade, uf, updated_by_email)
values ('escritorio', 'Ian Felipe Menezes Souza Granja', '61107', 'PE', 'Petrolina', 'PE', '')
on conflict (id) do nothing;
