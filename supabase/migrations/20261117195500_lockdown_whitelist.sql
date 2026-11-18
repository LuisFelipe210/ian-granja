-- Lista de e-mails autorizados do escritório (segunda camada de proteção além de enable_signup = false)

create table if not exists public.revisional_usuarios_autorizados (
    email text primary key check (char_length(btrim(email)) between 3 and 254),
    created_at timestamptz not null default now()
);

insert into public.revisional_usuarios_autorizados (email)
values
    ('contato@iangranja.adv.br'),
    ('lf210400@gmail.com')
on conflict (email) do nothing;

create or replace function public.is_escritorio_autorizado()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.revisional_usuarios_autorizados
        where lower(btrim(email)) = lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
    );
$$;

grant execute on function public.is_escritorio_autorizado() to authenticated;

alter table public.revisional_usuarios_autorizados enable row level security;
revoke all on public.revisional_usuarios_autorizados from anon;
grant select on public.revisional_usuarios_autorizados to authenticated;

drop policy if exists "revisional_usuarios_select_auth" on public.revisional_usuarios_autorizados;
create policy "revisional_usuarios_select_auth"
    on public.revisional_usuarios_autorizados for select
    to authenticated
    using (public.is_escritorio_autorizado());

-- Atualiza políticas de categorias para exigir e-mail autorizado
drop policy if exists "revisional_categorias_select_auth" on public.revisional_categorias;
create policy "revisional_categorias_select_auth"
    on public.revisional_categorias for select
    to authenticated
    using (public.is_escritorio_autorizado());

drop policy if exists "revisional_categorias_insert_auth" on public.revisional_categorias;
create policy "revisional_categorias_insert_auth"
    on public.revisional_categorias for insert
    to authenticated
    with check (public.is_escritorio_autorizado());

drop policy if exists "revisional_categorias_update_auth" on public.revisional_categorias;
create policy "revisional_categorias_update_auth"
    on public.revisional_categorias for update
    to authenticated
    using (public.is_escritorio_autorizado())
    with check (public.is_escritorio_autorizado());

drop policy if exists "revisional_categorias_delete_auth" on public.revisional_categorias;
create policy "revisional_categorias_delete_auth"
    on public.revisional_categorias for delete
    to authenticated
    using (public.is_escritorio_autorizado());

-- Atualiza políticas de cálculos para exigir e-mail autorizado
drop policy if exists "revisional_calculos_select_auth" on public.revisional_calculos;
create policy "revisional_calculos_select_auth"
    on public.revisional_calculos for select
    to authenticated
    using (public.is_escritorio_autorizado());

drop policy if exists "revisional_calculos_insert_auth" on public.revisional_calculos;
create policy "revisional_calculos_insert_auth"
    on public.revisional_calculos for insert
    to authenticated
    with check (public.is_escritorio_autorizado());

drop policy if exists "revisional_calculos_update_auth" on public.revisional_calculos;
create policy "revisional_calculos_update_auth"
    on public.revisional_calculos for update
    to authenticated
    using (public.is_escritorio_autorizado())
    with check (public.is_escritorio_autorizado());

drop policy if exists "revisional_calculos_delete_auth" on public.revisional_calculos;
create policy "revisional_calculos_delete_auth"
    on public.revisional_calculos for delete
    to authenticated
    using (public.is_escritorio_autorizado());
