-- Suite pericial completa: processo global, múltiplos contratos, tarifas, deduções e snapshot completo em jsonb

alter table public.revisional_calculos
    add column if not exists processo_global text not null default '' check (char_length(processo_global) <= 80),
    add column if not exists qtd_contratos integer not null default 1 check (qtd_contratos >= 1 and qtd_contratos <= 20),
    add column if not exists total_tarifas numeric(14, 2) not null default 0,
    add column if not exists valor_total_acao numeric(14, 2) not null default 0,
    add column if not exists dados_completos jsonb not null default '{}'::jsonb;

create index if not exists revisional_calculos_processo_idx
    on public.revisional_calculos (processo_global);
