import { useEffect } from "react";

/**
 * Trava a rolagem da página enquanto um modal, painel lateral ou gaveta estiver aberto.
 * Conta quantos estão abertos ao mesmo tempo: a página só volta a rolar quando o último fechar.
 * Compensa a largura da barra de rolagem para o conteúdo não "pular" para o lado.
 */
let travasAtivas = 0;
let estiloAnterior: { overflow: string; paddingRight: string } | null = null;

function travar() {
    const html = document.documentElement;
    if (travasAtivas === 0) {
        const larguraBarra = window.innerWidth - html.clientWidth;
        // Com `scrollbar-gutter: stable` (index.css) o espaço da barra continua reservado mesmo com
        // overflow hidden: compensar de novo com padding empurraria o conteúdo para o lado.
        const reservaEspaco = getComputedStyle(html).getPropertyValue("scrollbar-gutter").includes("stable");
        estiloAnterior = { overflow: html.style.overflow, paddingRight: html.style.paddingRight };
        html.style.overflow = "hidden";
        if (larguraBarra > 0 && !reservaEspaco) html.style.paddingRight = `${larguraBarra}px`;
    }
    travasAtivas += 1;
}

function destravar() {
    travasAtivas = Math.max(0, travasAtivas - 1);
    if (travasAtivas === 0 && estiloAnterior) {
        const html = document.documentElement;
        html.style.overflow = estiloAnterior.overflow;
        html.style.paddingRight = estiloAnterior.paddingRight;
        estiloAnterior = null;
    }
}

/**
 * Versão fora do React (ex.: o seletor do Google Drive, que é montado pelo próprio Google).
 * Devolve a função que destrava; chamar mais de uma vez não destrava duas vezes.
 */
export function travarRolagemPagina(): () => void {
    if (typeof document === "undefined") return () => undefined;
    travar();
    let liberado = false;
    return () => {
        if (liberado) return;
        liberado = true;
        destravar();
    };
}

export function useTravarRolagem(ativo: boolean): void {
    useEffect(() => {
        if (!ativo || typeof document === "undefined") return;
        travar();
        return destravar;
    }, [ativo]);
}
