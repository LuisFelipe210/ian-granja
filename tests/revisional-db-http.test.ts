import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    criarCategoria,
    listarCalculos,
    obterSessaoAtiva,
    salvarConfigEscritorio,
    salvarTimbradoEscritorio,
    type RevisionalSession,
} from "../src/lib/revisional-db.ts";

function criarMockBrowser(sessaoInicial: RevisionalSession) {
    const store = new Map<string, string>();
    store.set("ig_revisional_session_v1", JSON.stringify(sessaoInicial));
    return {
        localStorage: {
            getItem: (k: string) => store.get(k) ?? null,
            setItem: (k: string, v: string) => {
                store.set(k, String(v));
            },
            removeItem: (k: string) => {
                store.delete(k);
            },
        },
        location: { hash: "", pathname: "/ferramentas/calculadora-revisional", search: "", origin: "http://localhost:8080" },
        history: { replaceState: () => undefined },
    };
}

describe("revisional-db camada HTTP (single-flight refresh, paginação Range e retry 401)", () => {
    it("obterSessaoAtiva(true) deduplica refresh simultâneo (single-flight)", async () => {
        const g = globalThis as unknown as { window?: unknown };
        const prevWindow = g.window;
        const prevFetch = globalThis.fetch;

        g.window = criarMockBrowser({
            accessToken: "tok-antigo",
            refreshToken: "ref-1",
            expiresAt: Date.now() - 10_000,
            user: { id: "u1", email: "ian@iangranja.adv.br" },
        });

        let refreshCalls = 0;
        globalThis.fetch = (async (input: string | URL | Request) => {
            const url = String(input);
            if (url.includes("/auth/v1/token?grant_type=refresh_token")) {
                refreshCalls += 1;
                await new Promise((r) => setTimeout(r, 20));
                return new Response(
                    JSON.stringify({
                        access_token: "tok-novo",
                        refresh_token: "ref-2",
                        expires_in: 3600,
                        user: { id: "u1", email: "ian@iangranja.adv.br" },
                    }),
                    { status: 200, headers: { "Content-Type": "application/json" } },
                );
            }
            return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
        }) as typeof fetch;

        try {
            const [s1, s2, s3] = await Promise.all([
                obterSessaoAtiva(true),
                obterSessaoAtiva(true),
                obterSessaoAtiva(true),
            ]);
            assert.equal(refreshCalls, 1, "deve executar apenas 1 refresh em voo");
            assert.equal(s1?.accessToken, "tok-novo");
            assert.equal(s2?.accessToken, "tok-novo");
            assert.equal(s3?.accessToken, "tok-novo");
        } finally {
            globalThis.fetch = prevFetch;
            g.window = prevWindow;
        }
    });

    it("listarCalculos pagina automaticamente além de 1.000 registros usando Range", async () => {
        const g = globalThis as unknown as { window?: unknown };
        const prevWindow = g.window;
        const prevFetch = globalThis.fetch;

        g.window = criarMockBrowser({
            accessToken: "tok-ok",
            refreshToken: "ref-ok",
            expiresAt: Date.now() + 3600_000,
            user: { id: "u1", email: "ian@iangranja.adv.br" },
        });

        const rangesRecebidos: string[] = [];
        globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
            const headers = (init?.headers ?? {}) as Record<string, string>;
            const range = headers.Range || headers.range || "";
            rangesRecebidos.push(range);
            if (range === "0-999") {
                const lote1 = Array.from({ length: 1000 }, (_, i) => ({ id: `c-${i}`, cliente_nome: `Cliente ${i}` }));
                return new Response(JSON.stringify(lote1), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                });
            }
            return new Response(JSON.stringify([{ id: "c-1000", cliente_nome: "Cliente 1000" }]), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        }) as typeof fetch;

        try {
            const todos = await listarCalculos();
            assert.equal(todos.length, 1001);
            assert.deepEqual(rangesRecebidos, ["0-999", "1000-1999"]);
        } finally {
            globalThis.fetch = prevFetch;
            g.window = prevWindow;
        }
    });

    it("criarCategoria faz retry único após 401 e falha claramente se PostgREST devolver array vazio", async () => {
        const g = globalThis as unknown as { window?: unknown };
        const prevWindow = g.window;
        const prevFetch = globalThis.fetch;

        g.window = criarMockBrowser({
            accessToken: "tok-expirado",
            refreshToken: "ref-1",
            expiresAt: Date.now() + 3600_000,
            user: { id: "u1", email: "ian@iangranja.adv.br" },
        });

        let postCalls = 0;
        globalThis.fetch = (async (input: string | URL | Request) => {
            const url = String(input);
            if (url.includes("/auth/v1/token?grant_type=refresh_token")) {
                return new Response(
                    JSON.stringify({
                        access_token: "tok-renovado",
                        refresh_token: "ref-2",
                        expires_in: 3600,
                        user: { id: "u1", email: "ian@iangranja.adv.br" },
                    }),
                    { status: 200, headers: { "Content-Type": "application/json" } },
                );
            }
            postCalls += 1;
            if (postCalls === 1) {
                return new Response(JSON.stringify({ message: "JWT expired" }), { status: 401 });
            }
            return new Response("[]", { status: 201, headers: { "Content-Type": "application/json" } });
        }) as typeof fetch;

        try {
            await assert.rejects(() => criarCategoria("Triagem"), /Registro não encontrado ou já removido/i);
            assert.equal(postCalls, 2, "deve tentar 1x, renovar token no 401 e repetir 1x");
        } finally {
            globalThis.fetch = prevFetch;
            g.window = prevWindow;
        }
    });
});

describe("revisional-db configurações do escritório e papel timbrado", () => {
    const sessao: RevisionalSession = {
        accessToken: "tok-ok",
        refreshToken: "ref-1",
        expiresAt: Date.now() + 3600_000,
        user: { id: "u1", email: "ian@iangranja.adv.br" },
    };
    const json = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    const linhaBanco = {
        id: "escritorio",
        nome_advogado: "Fulano de Tal",
        oab_numero: "12345",
        oab_uf: "BA",
        cidade: "Juazeiro",
        uf: "BA",
    };

    async function comFetch(
        responder: (url: string, init: RequestInit | undefined) => Response,
        fn: () => Promise<void>,
    ) {
        const g = globalThis as unknown as { window?: unknown };
        const prevWindow = g.window;
        const prevFetch = globalThis.fetch;
        g.window = criarMockBrowser(sessao);
        globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) =>
            responder(String(input), init)) as typeof fetch;
        try {
            await fn();
        } finally {
            globalThis.fetch = prevFetch;
            g.window = prevWindow;
        }
    }

    it("salva nome/OAB/cidade mesmo em banco sem a coluna timbrado_imagem_url", async () => {
        const corpos: Array<Record<string, unknown>> = [];
        await comFetch(
            (_url, init) => {
                const corpo = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
                corpos.push(corpo);
                if ("timbrado_imagem_url" in corpo) {
                    return json(
                        {
                            code: "PGRST204",
                            message: "Could not find the 'timbrado_imagem_url' column of 'revisional_configuracoes' in the schema cache",
                        },
                        400,
                    );
                }
                return json([{ ...linhaBanco, ...corpo }], 201);
            },
            async () => {
                const salvo = await salvarConfigEscritorio({
                    nomeAdvogado: "Fulano de Tal",
                    oabNumero: "12345",
                    oabUf: "BA",
                    cidade: "Juazeiro",
                    uf: "BA",
                    timbradoImagemUrl: "",
                });
                assert.equal(salvo.nomeAdvogado, "Fulano de Tal");
            },
        );
        assert.equal(corpos.length, 2, "tenta com a coluna e repete sem ela");
        assert.ok(!("timbrado_imagem_url" in corpos[1]));
    });

    it("com timbrado próprio e sem a coluna, avisa da migração em vez de descartar a imagem", async () => {
        await comFetch(
            () =>
                json(
                    { code: "PGRST204", message: "Could not find the 'timbrado_imagem_url' column" },
                    400,
                ),
            async () => {
                await assert.rejects(
                    () =>
                        salvarConfigEscritorio({
                            nomeAdvogado: "A",
                            oabNumero: "1",
                            oabUf: "PE",
                            cidade: "C",
                            uf: "PE",
                            timbradoImagemUrl: "data:image/png;base64,iVBORw0KGgo=",
                        }),
                    /migração do banco/,
                );
            },
        );
    });

    it("salvarTimbradoEscritorio grava só a coluna do timbrado (PATCH), sem tocar em nome/OAB", async () => {
        const chamadas: Array<{ url: string; metodo: string; corpo: Record<string, unknown> }> = [];
        await comFetch(
            (url, init) => {
                const corpo = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
                chamadas.push({ url, metodo: String(init?.method ?? "GET"), corpo });
                return json([{ ...linhaBanco, ...corpo }]);
            },
            async () => {
                const salvo = await salvarTimbradoEscritorio("data:image/png;base64,iVBORw0KGgo=");
                assert.equal(salvo.nomeAdvogado, "Fulano de Tal");
                assert.equal(salvo.timbradoImagemUrl, "data:image/png;base64,iVBORw0KGgo=");
            },
        );
        assert.equal(chamadas.length, 1);
        assert.equal(chamadas[0].metodo, "PATCH");
        assert.match(chamadas[0].url, /revisional_configuracoes\?id=eq\.escritorio$/);
        assert.deepEqual(Object.keys(chamadas[0].corpo), ["timbrado_imagem_url"]);
    });

    it("salvarTimbradoEscritorio recusa imagem inválida em vez de gravar vazio em silêncio", async () => {
        await comFetch(
            () => json([]),
            async () => {
                await assert.rejects(
                    () => salvarTimbradoEscritorio("data:application/octet-stream;base64,AAAA"),
                    /inválida/,
                );
            },
        );
    });
});
