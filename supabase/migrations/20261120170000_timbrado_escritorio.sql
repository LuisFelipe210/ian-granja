-- Papel timbrado A4 personalizado do escritório (data URI de imagem PNG/JPEG/WebP otimizada).
-- Quando vazio, o editor usa o timbrado padrão gerado pelo sistema.

alter table public.revisional_configuracoes
    add column if not exists timbrado_imagem_url text not null default '';

alter table public.revisional_configuracoes
    drop constraint if exists revisional_configuracoes_timbrado_len;

alter table public.revisional_configuracoes
    add constraint revisional_configuracoes_timbrado_len
    check (
        char_length(timbrado_imagem_url) <= 2500000
        and (
            timbrado_imagem_url = ''
            or timbrado_imagem_url ~ '^data:image/(png|jpeg|jpg|webp);base64,'
        )
    );

notify pgrst, 'reload schema';
