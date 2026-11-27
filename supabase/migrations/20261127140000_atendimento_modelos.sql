-- Modelo de IA do atendimento escolhido pelo escritório na tela Configurações.
-- Vazio = usa a variável de ambiente (ATENDIMENTO_MODEL / ATENDIMENTO_MODEL_EXTRACAO) ou o padrão do código
-- (Haiku nos rascunhos, Sonnet na leitura de documentos). O servidor só aceita ids da lista em
-- src/lib/atendimento/modelos.ts; aqui o banco só garante um formato seguro.

alter table public.revisional_configuracoes
    add column if not exists atendimento_modelo_resposta text not null default ''
        check (atendimento_modelo_resposta ~ '^[a-z0-9.-]{0,60}$');

alter table public.revisional_configuracoes
    add column if not exists atendimento_modelo_extracao text not null default ''
        check (atendimento_modelo_extracao ~ '^[a-z0-9.-]{0,60}$');
