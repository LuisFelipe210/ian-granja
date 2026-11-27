-- O limite de 60KB em `fatos` era menor do que o app permite gravar (até 120 fatos × 120 caracteres de
-- rótulo + 600 de valor, LIMITES_CONHECIMENTO em src/lib/atendimento/base-conhecimento.ts). Com acentos
-- (2 bytes em UTF-8) e o JSON em volta isso chega perto de 180KB, então o teto sobe para 200KB.

alter table public.revisional_cliente_conhecimento
    drop constraint if exists revisional_cliente_conhecimento_fatos_check;

alter table public.revisional_cliente_conhecimento
    add constraint revisional_cliente_conhecimento_fatos_check
    check (jsonb_typeof(fatos) = 'array' and jsonb_array_length(fatos) <= 120 and pg_column_size(fatos) <= 200000);
