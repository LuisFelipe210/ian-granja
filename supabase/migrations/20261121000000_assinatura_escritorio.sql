-- Assinatura visual (rubrica) do advogado em Configurações do sistema (data URI PNG/JPG/WebP otimizada).
-- Quando vazia, os blocos de assinatura exibem a linha tradicional com Nome + OAB (e selo ICP-Brasil se assinado).

alter table public.revisional_configuracoes
    add column if not exists assinatura_imagem_url text not null default '';

alter table public.revisional_configuracoes
    drop constraint if exists revisional_configuracoes_assinatura_len;

alter table public.revisional_configuracoes
    add constraint revisional_configuracoes_assinatura_len
    check (
        char_length(assinatura_imagem_url) <= 600000
        and (
            assinatura_imagem_url = ''
            or assinatura_imagem_url ~ '^data:image/(png|jpeg|jpg|webp);base64,'
        )
    );

notify pgrst, 'reload schema';
