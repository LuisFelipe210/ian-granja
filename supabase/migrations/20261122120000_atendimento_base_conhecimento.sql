-- Base de conhecimento do atendimento por IA (Fase 1 do bot de WhatsApp).
-- Cada linha é uma informação de UM cliente: o que a IA extraiu de um PDF (resumo + fatos com a página
-- de origem) ou uma anotação escrita pelo escritório. O PDF em si não é guardado aqui: só o texto
-- extraído, que é leve e é exatamente o que a IA pode usar para responder àquele cliente.

create table if not exists public.revisional_cliente_conhecimento (
    id uuid primary key default gen_random_uuid(),
    cliente_id uuid not null references public.revisional_clientes(id) on delete cascade,
    origem text not null default 'documento' check (origem in ('documento', 'anotacao')),
    titulo text not null check (char_length(btrim(titulo)) between 1 and 200),
    arquivo_nome text not null default '' check (char_length(arquivo_nome) <= 255),
    resumo text not null default '' check (char_length(resumo) <= 4000),
    -- [{ "rotulo": "Número do contrato", "valor": "123", "pagina": 2 }, ...]
    fatos jsonb not null default '[]'::jsonb
        check (jsonb_typeof(fatos) = 'array' and jsonb_array_length(fatos) <= 120 and pg_column_size(fatos) <= 60000),
    -- Pode ser usado nas respostas ao cliente? (anotações internas ficam false)
    visivel_cliente boolean not null default true,
    created_by uuid references auth.users(id) on delete set null default auth.uid(),
    created_by_email text not null default coalesce(auth.jwt() ->> 'email', ''),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists revisional_cliente_conhecimento_cliente_idx
    on public.revisional_cliente_conhecimento (cliente_id, created_at desc);

drop trigger if exists trg_revisional_cliente_conhecimento_updated_at on public.revisional_cliente_conhecimento;
create trigger trg_revisional_cliente_conhecimento_updated_at
    before update on public.revisional_cliente_conhecimento
    for each row
    execute function public.set_revisional_updated_at();

alter table public.revisional_cliente_conhecimento enable row level security;
revoke all on public.revisional_cliente_conhecimento from anon;
grant select, insert, update, delete on public.revisional_cliente_conhecimento to authenticated;

drop policy if exists "revisional_cliente_conhecimento_all_auth" on public.revisional_cliente_conhecimento;
create policy "revisional_cliente_conhecimento_all_auth"
    on public.revisional_cliente_conhecimento for all
    to authenticated
    using (public.is_escritorio_autorizado())
    with check (public.is_escritorio_autorizado());
