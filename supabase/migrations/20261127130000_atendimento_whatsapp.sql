-- Atendimento por IA no WhatsApp (Fase 2).
-- O webhook da Meta grava cada mensagem recebida; a IA prepara um RASCUNHO de resposta com a base do
-- cliente e o advogado revisa e envia pelo sistema. Nada sai para o cliente sem um clique do escritório.

-- Uma conversa por número de WhatsApp.
create table if not exists public.revisional_atendimento_conversas (
    id uuid primary key default gen_random_uuid(),
    -- wa_id da Meta: só dígitos, com DDI (ex.: 5581987654321).
    telefone text not null unique check (telefone ~ '^[0-9]{8,15}$'),
    nome_contato text not null default '' check (char_length(nome_contato) <= 200),
    -- Nulo enquanto o número não for reconhecido como de um cliente cadastrado.
    cliente_id uuid references public.revisional_clientes(id) on delete set null,
    -- pendente = tem mensagem do cliente esperando o escritório.
    status text not null default 'pendente' check (status in ('pendente', 'respondida', 'encerrada')),
    -- A Meta só deixa mandar texto livre até 24h depois da última mensagem do cliente.
    ultima_mensagem_cliente_em timestamptz,
    ultima_mensagem_em timestamptz not null default now(),
    ultima_mensagem_previa text not null default '' check (char_length(ultima_mensagem_previa) <= 300),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists revisional_atendimento_conversas_status_idx
    on public.revisional_atendimento_conversas (status, ultima_mensagem_em desc);

create table if not exists public.revisional_atendimento_mensagens (
    id uuid primary key default gen_random_uuid(),
    conversa_id uuid not null references public.revisional_atendimento_conversas(id) on delete cascade,
    direcao text not null check (direcao in ('entrada', 'saida')),
    autor text not null check (autor in ('cliente', 'ia', 'advogado')),
    -- 'midia' = áudio, foto, documento etc. (o texto guarda só a legenda ou um rótulo como "[áudio]").
    tipo text not null default 'texto' check (tipo in ('texto', 'midia')),
    texto text not null default '' check (char_length(texto) <= 4096),
    status text not null check (status in ('recebida', 'rascunho', 'enviada', 'falhou', 'descartada')),
    wa_message_id text unique check (wa_message_id is null or char_length(wa_message_id) <= 200),
    -- Só nos rascunhos da IA: o que a trava anti-alucinação decidiu.
    situacao_ia text check (situacao_ia is null or situacao_ia in ('respondido', 'sem_informacao', 'encaminhar_advogado')),
    fontes jsonb not null default '[]'::jsonb check (jsonb_typeof(fontes) = 'array' and pg_column_size(fontes) <= 20000),
    motivo_interno text not null default '' check (char_length(motivo_interno) <= 1000),
    erro text not null default '' check (char_length(erro) <= 1000),
    enviado_por_email text not null default '',
    enviado_em timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists revisional_atendimento_mensagens_conversa_idx
    on public.revisional_atendimento_mensagens (conversa_id, created_at);

-- Quem envia fica registrado pelo próprio banco (não dá para forjar pelo navegador).
create or replace function public.set_atendimento_enviado_por()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if new.status = 'enviada' and (tg_op = 'INSERT' or old.status is distinct from 'enviada') then
        new.enviado_por_email := coalesce(nullif(auth.jwt() ->> 'email', ''), new.enviado_por_email, '');
        new.enviado_em := coalesce(new.enviado_em, now());
    end if;
    return new;
end;
$$;

drop trigger if exists trg_revisional_atendimento_mensagens_enviado_por on public.revisional_atendimento_mensagens;
create trigger trg_revisional_atendimento_mensagens_enviado_por
    before insert or update on public.revisional_atendimento_mensagens
    for each row
    execute function public.set_atendimento_enviado_por();

-- Como cada pessoa do escritório quer ser avisada. A caixa de entrada do sistema vale para todos;
-- o aviso no WhatsApp pessoal é opcional e cada um liga o seu.
create table if not exists public.revisional_atendimento_avisos (
    user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
    email text not null default coalesce(auth.jwt() ->> 'email', ''),
    avisar_whatsapp boolean not null default false,
    telefone text not null default '' check (telefone ~ '^[0-9]{0,15}$'),
    updated_at timestamptz not null default now(),
    check (not avisar_whatsapp or char_length(telefone) between 12 and 15)
);

drop trigger if exists trg_revisional_atendimento_conversas_updated_at on public.revisional_atendimento_conversas;
create trigger trg_revisional_atendimento_conversas_updated_at
    before update on public.revisional_atendimento_conversas
    for each row
    execute function public.set_revisional_updated_at();

drop trigger if exists trg_revisional_atendimento_mensagens_updated_at on public.revisional_atendimento_mensagens;
create trigger trg_revisional_atendimento_mensagens_updated_at
    before update on public.revisional_atendimento_mensagens
    for each row
    execute function public.set_revisional_updated_at();

drop trigger if exists trg_revisional_atendimento_avisos_updated_at on public.revisional_atendimento_avisos;
create trigger trg_revisional_atendimento_avisos_updated_at
    before update on public.revisional_atendimento_avisos
    for each row
    execute function public.set_revisional_updated_at();

alter table public.revisional_atendimento_conversas enable row level security;
alter table public.revisional_atendimento_mensagens enable row level security;
alter table public.revisional_atendimento_avisos enable row level security;

revoke all on public.revisional_atendimento_conversas from anon;
revoke all on public.revisional_atendimento_mensagens from anon;
revoke all on public.revisional_atendimento_avisos from anon;
grant select, insert, update, delete on public.revisional_atendimento_conversas to authenticated;
grant select, insert, update, delete on public.revisional_atendimento_mensagens to authenticated;
grant select, insert, update, delete on public.revisional_atendimento_avisos to authenticated;

drop policy if exists "revisional_atendimento_conversas_all_auth" on public.revisional_atendimento_conversas;
create policy "revisional_atendimento_conversas_all_auth"
    on public.revisional_atendimento_conversas for all
    to authenticated
    using (public.is_escritorio_autorizado())
    with check (public.is_escritorio_autorizado());

drop policy if exists "revisional_atendimento_mensagens_all_auth" on public.revisional_atendimento_mensagens;
create policy "revisional_atendimento_mensagens_all_auth"
    on public.revisional_atendimento_mensagens for all
    to authenticated
    using (public.is_escritorio_autorizado())
    with check (public.is_escritorio_autorizado());

-- Cada pessoa só vê e muda o próprio aviso. O webhook (service role) lê todos para mandar os avisos.
drop policy if exists "revisional_atendimento_avisos_proprio" on public.revisional_atendimento_avisos;
create policy "revisional_atendimento_avisos_proprio"
    on public.revisional_atendimento_avisos for all
    to authenticated
    using (user_id = auth.uid() and public.is_escritorio_autorizado())
    with check (user_id = auth.uid() and public.is_escritorio_autorizado());
