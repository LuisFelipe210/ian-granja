/**
 * Armazena o certificado A1 (.pfx/.p12) apenas na memória RAM enquanto a aba está aberta.
 * Nunca grava o arquivo nem a senha em localStorage, sessionStorage ou servidor.
 */
import { useSyncExternalStore } from "react";
import type { CertificadoA1Carregado } from "./assinatura-icp.ts";

let certificadoAtual: CertificadoA1Carregado | null = null;
const ouvintes = new Set<() => void>();

export function obterCertificadoSessao(): CertificadoA1Carregado | null {
    return certificadoAtual;
}

export function definirCertificadoSessao(cert: CertificadoA1Carregado | null): void {
    certificadoAtual = cert;
    for (const fn of ouvintes) fn();
}

export function assinarCertificadoSessao(fn: () => void): () => void {
    ouvintes.add(fn);
    return () => {
        ouvintes.delete(fn);
    };
}

export function useCertificadoSessao(): CertificadoA1Carregado | null {
    return useSyncExternalStore(assinarCertificadoSessao, obterCertificadoSessao, obterCertificadoSessao);
}
