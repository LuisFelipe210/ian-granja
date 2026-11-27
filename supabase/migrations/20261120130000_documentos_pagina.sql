-- Configuração de página (papel e margens em cm) dos modelos e documentos do editor.
-- O documento gerado herda a configuração do modelo; Word e PDF saem com o mesmo papel/margens.

alter table public.revisional_modelos
    add column if not exists pagina jsonb not null
    default '{"formato":"a4","margens":{"superior":3,"inferior":2,"esquerda":3,"direita":2}}'::jsonb;

alter table public.revisional_documentos
    add column if not exists pagina jsonb not null
    default '{"formato":"a4","margens":{"superior":3,"inferior":2,"esquerda":3,"direita":2}}'::jsonb;

alter table public.revisional_modelos
    drop constraint if exists revisional_modelos_pagina_objeto;
alter table public.revisional_modelos
    add constraint revisional_modelos_pagina_objeto check (jsonb_typeof(pagina) = 'object');

alter table public.revisional_documentos
    drop constraint if exists revisional_documentos_pagina_objeto;
alter table public.revisional_documentos
    add constraint revisional_documentos_pagina_objeto check (jsonb_typeof(pagina) = 'object');
