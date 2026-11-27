import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    ErroGoogleDrive,
    baixarArquivoDrive,
    contaDriveSalva,
    desconectarContaDrive,
    enviarArquivoDrive,
    esquecerUltimaPastaDrive,
    lembrarUltimaPastaDrive,
    ultimaPastaDrive,
} from "../src/lib/google-drive.ts";

function criarMockLocalStorage() {
    const store = new Map<string, string>();
    return {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
            store.set(k, String(v));
        },
        removeItem: (k: string) => {
            store.delete(k);
        },
    };
}

describe("google-drive (armazenamento local e validações de segurança/limites)", () => {
    it("lembra, lê e esquece a última pasta salva no localStorage com resiliência", async () => {
        const g = globalThis as unknown as { window?: unknown; localStorage?: unknown };
        const prevWindow = g.window;
        const prevLs = g.localStorage;
        const ls = criarMockLocalStorage();
        g.window = { localStorage: ls };
        g.localStorage = ls;
        try {
            assert.equal(ultimaPastaDrive(), null);
            lembrarUltimaPastaDrive({
                id: "folder-1",
                nome: "Processos 2026",
            });
            assert.deepEqual(ultimaPastaDrive(), {
                id: "folder-1",
                nome: "Processos 2026",
                mimeType: "application/vnd.google-apps.folder",
            });

            esquecerUltimaPastaDrive();
            assert.equal(ultimaPastaDrive(), null);

            // JSON corrompido não lança exceção
            ls.setItem("ig-google-drive-ultima-pasta", "{invalido");
            assert.equal(ultimaPastaDrive(), null);

            // desconectarContaDrive limpa conta e última pasta
            ls.setItem("ig-google-drive-conta", "adv@escritorio.adv.br");
            assert.equal(contaDriveSalva(), "adv@escritorio.adv.br");
            await desconectarContaDrive();
            assert.equal(contaDriveSalva(), null);
            assert.equal(ultimaPastaDrive(), null);
        } finally {
            g.window = prevWindow;
            g.localStorage = prevLs;
        }
    });

    it("enviarArquivoDrive rejeita arquivos acima de 5 MB antes de iniciar upload", async () => {
        const blobGrande = new Blob([new Uint8Array(6 * 1024 * 1024)], { type: "application/pdf" });
        await assert.rejects(
            () =>
                enviarArquivoDrive({
                    nome: "laudo-enorme.pdf",
                    conteudo: blobGrande,
                    mimeType: "application/pdf",
                }),
            (err: unknown) => err instanceof ErroGoogleDrive && /limite/i.test(err.message),
        );
    });

    it("baixarArquivoDrive rejeita Google Docs nativos sem chamar a rede", async () => {
        await assert.rejects(
            () =>
                baixarArquivoDrive({
                    id: "doc-1",
                    nome: "Contrato.gdoc",
                    mimeType: "application/vnd.google-apps.document",
                }),
            (err: unknown) => err instanceof ErroGoogleDrive && /Google Docs|exporte/i.test(err.message),
        );
    });
});
