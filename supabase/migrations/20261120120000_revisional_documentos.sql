-- Editor de documentos do sistema interno revisional:
-- modelos com campos entre colchetes ([nome do cliente], [número do processo]...) e
-- documentos gerados a partir deles, vinculados (ou não) a um cliente da carteira.

create table if not exists public.revisional_modelos (
    id uuid primary key default gen_random_uuid(),
    nome text not null check (char_length(btrim(nome)) between 1 and 160),
    descricao text not null default '' check (char_length(descricao) <= 500),
    conteudo_html text not null default '' check (char_length(conteudo_html) <= 500000),
    created_by uuid references auth.users(id) on delete set null default auth.uid(),
    created_by_email text not null default coalesce(auth.jwt() ->> 'email', ''),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.revisional_documentos (
    id uuid primary key default gen_random_uuid(),
    titulo text not null check (char_length(btrim(titulo)) between 1 and 200),
    calculo_id uuid references public.revisional_calculos(id) on delete set null,
    modelo_id uuid references public.revisional_modelos(id) on delete set null,
    conteudo_html text not null default '' check (char_length(conteudo_html) <= 500000),
    created_by uuid references auth.users(id) on delete set null default auth.uid(),
    created_by_email text not null default coalesce(auth.jwt() ->> 'email', ''),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists revisional_documentos_calculo_idx
    on public.revisional_documentos (calculo_id);

create index if not exists revisional_documentos_updated_idx
    on public.revisional_documentos (updated_at desc);

drop trigger if exists trg_revisional_modelos_updated_at on public.revisional_modelos;
create trigger trg_revisional_modelos_updated_at
    before update on public.revisional_modelos
    for each row
    execute function public.set_revisional_updated_at();

drop trigger if exists trg_revisional_documentos_updated_at on public.revisional_documentos;
create trigger trg_revisional_documentos_updated_at
    before update on public.revisional_documentos
    for each row
    execute function public.set_revisional_updated_at();

alter table public.revisional_modelos enable row level security;
alter table public.revisional_documentos enable row level security;
revoke all on public.revisional_modelos from anon;
revoke all on public.revisional_documentos from anon;
grant select, insert, update, delete on public.revisional_modelos to authenticated;
grant select, insert, update, delete on public.revisional_documentos to authenticated;

drop policy if exists "revisional_modelos_all_auth" on public.revisional_modelos;
create policy "revisional_modelos_all_auth"
    on public.revisional_modelos for all
    to authenticated
    using (public.is_escritorio_autorizado())
    with check (public.is_escritorio_autorizado());

drop policy if exists "revisional_documentos_all_auth" on public.revisional_documentos;
create policy "revisional_documentos_all_auth"
    on public.revisional_documentos for all
    to authenticated
    using (public.is_escritorio_autorizado())
    with check (public.is_escritorio_autorizado());

-- Modelo de exemplo (o mesmo que o Ian usa no dia a dia), criado só uma vez.
insert into public.revisional_modelos (nome, descricao, conteudo_html, created_by, created_by_email)
select
    'Petição — Ciente da audiência',
    'Petição simples informando ciência da designação de audiência.',
    '<p style="text-align: justify"><strong>EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA [vara]</strong></p>'
    || '<p></p><p></p>'
    || '<p><strong>Processo nº [número do processo]</strong></p>'
    || '<p></p>'
    || '<p style="text-align: justify"><strong>[nome do cliente]</strong>, já qualificado(a) nos autos da ação em epígrafe, movida em face de <strong>[parte contrária]</strong>, vem, respeitosamente, por intermédio de seu advogado que esta subscreve, perante Vossa Excelência, informar que está <strong>ciente</strong> da designação da audiência.</p>'
    || '<p></p>'
    || '<p style="text-align: justify">Termos em que pede deferimento.</p>'
    || '<p></p>'
    || '<p style="text-align: center">[cidade], [data por extenso].</p>'
    || '<p></p><p></p>'
    || '<p style="text-align: center"><strong>[advogado]</strong><br>[oab]</p>',
    null,
    ''
where not exists (select 1 from public.revisional_modelos);
