-- Tabela de tarefas, prazos, audiências e reuniões do sistema interno revisional

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

create index if not exists revisional_tarefas_data_idx
    on public.revisional_tarefas (data, concluida);

create index if not exists revisional_tarefas_calculo_idx
    on public.revisional_tarefas (calculo_id);

drop trigger if exists trg_revisional_tarefas_updated_at on public.revisional_tarefas;
create trigger trg_revisional_tarefas_updated_at
    before update on public.revisional_tarefas
    for each row
    execute function public.set_revisional_updated_at();

alter table public.revisional_tarefas enable row level security;
revoke all on public.revisional_tarefas from anon;
grant select, insert, update, delete on public.revisional_tarefas to authenticated;

drop policy if exists "revisional_tarefas_select_auth" on public.revisional_tarefas;
create policy "revisional_tarefas_select_auth"
    on public.revisional_tarefas for select
    to authenticated
    using (public.is_escritorio_autorizado());

drop policy if exists "revisional_tarefas_insert_auth" on public.revisional_tarefas;
create policy "revisional_tarefas_insert_auth"
    on public.revisional_tarefas for insert
    to authenticated
    with check (public.is_escritorio_autorizado());

drop policy if exists "revisional_tarefas_update_auth" on public.revisional_tarefas;
create policy "revisional_tarefas_update_auth"
    on public.revisional_tarefas for update
    to authenticated
    using (public.is_escritorio_autorizado())
    with check (public.is_escritorio_autorizado());

drop policy if exists "revisional_tarefas_delete_auth" on public.revisional_tarefas;
create policy "revisional_tarefas_delete_auth"
    on public.revisional_tarefas for delete
    to authenticated
    using (public.is_escritorio_autorizado());
