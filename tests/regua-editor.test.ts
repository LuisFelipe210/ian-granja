import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    ajustarAoPasso,
    arrastarMargem,
    arrastarMarcador,
    formatarCmRegua,
    marcasRegua,
    posicoesMarcadores,
} from "../src/lib/regua-editor.ts";

// A4 com margens ABNT: 21 − 3 − 2 = 16 cm de texto.
const LARGURA_TEXTO = 16;

describe("régua do editor: marcadores de recuo", () => {
    it("posiciona os marcadores como no Word", () => {
        assert.deepEqual(posicoesMarcadores({ esquerda: 1, direita: 0.5, primeira: 1.5 }), {
            primeira: 2.5,
            deslocado: 1,
            esquerdo: 1,
            direito: 0.5,
        });
    });

    it("triângulo de cima muda só a 1ª linha (pode virar deslocado)", () => {
        assert.deepEqual(arrastarMarcador("primeira", 2.5, { esquerda: 1, direita: 0, primeira: 0 }, LARGURA_TEXTO), {
            esquerda: 1,
            direita: 0,
            primeira: 1.5,
        });
        assert.deepEqual(arrastarMarcador("primeira", 0, { esquerda: 1.25, direita: 0, primeira: 0 }, LARGURA_TEXTO), {
            esquerda: 1.25,
            direita: 0,
            primeira: -1.25,
        });
    });

    it("triângulo de baixo move o recuo esquerdo e deixa a 1ª linha no lugar", () => {
        assert.deepEqual(arrastarMarcador("deslocado", 1.25, { esquerda: 0, direita: 0, primeira: 0 }, LARGURA_TEXTO), {
            esquerda: 1.25,
            direita: 0,
            primeira: -1.25,
        });
    });

    it("retângulo move o parágrafo inteiro, mantendo a 1ª linha relativa", () => {
        assert.deepEqual(arrastarMarcador("esquerdo", 4, { esquerda: 0, direita: 0, primeira: 1.5 }, LARGURA_TEXTO), {
            esquerda: 4,
            direita: 0,
            primeira: 1.5,
        });
        // Com deslocado, não deixa a 1ª linha passar para dentro da margem.
        assert.equal(
            arrastarMarcador("esquerdo", 0, { esquerda: 2, direita: 0, primeira: -1.25 }, LARGURA_TEXTO).esquerda,
            1.25,
        );
    });

    it("recuo direito e limites: sempre sobra 1 cm de texto e nada entra na margem por padrão", () => {
        assert.equal(arrastarMarcador("direito", 2, { esquerda: 0, direita: 0, primeira: 0 }, LARGURA_TEXTO).direita, 2);
        assert.equal(arrastarMarcador("direito", 20, { esquerda: 4, direita: 0, primeira: 0 }, LARGURA_TEXTO).direita, 11);
        assert.equal(arrastarMarcador("primeira", -3, { esquerda: 0, direita: 0, primeira: 0 }, LARGURA_TEXTO).primeira, 0);
        assert.equal(arrastarMarcador("deslocado", 30, { esquerda: 0, direita: 2, primeira: 0 }, LARGURA_TEXTO).esquerda, 13);
    });

    it("permite arrastar marcadores para dentro da margem cinza até a borda do papel (recuo negativo)", () => {
        const limites = { minEsq: -3, minDir: -2 };
        // Arrasta o parágrafo inteiro até a borda esquerda da folha (-3 cm), sem passar para fora do papel.
        assert.deepEqual(arrastarMarcador("esquerdo", -1.5, { esquerda: 0, direita: 0, primeira: 0 }, LARGURA_TEXTO, limites), {
            esquerda: -1.5,
            direita: 0,
            primeira: 0,
        });
        assert.equal(
            arrastarMarcador("esquerdo", -5, { esquerda: 0, direita: 0, primeira: 0 }, LARGURA_TEXTO, limites).esquerda,
            -3,
        );
        // Com recuo deslocado (-1 cm), não deixa a 1ª linha sair para fora da borda esquerda da folha.
        assert.equal(
            arrastarMarcador("esquerdo", -3, { esquerda: 0, direita: 0, primeira: -1 }, LARGURA_TEXTO, limites).esquerda,
            -2,
        );
        // 1ª linha e recuo direito também entram na área cinza até a borda.
        assert.equal(
            arrastarMarcador("primeira", -1.5, { esquerda: 0, direita: 0, primeira: 0 }, LARGURA_TEXTO, limites).primeira,
            -1.5,
        );
        assert.equal(
            arrastarMarcador("direito", -1.5, { esquerda: 0, direita: 0, primeira: 0 }, LARGURA_TEXTO, limites).direita,
            -1.5,
        );
        assert.equal(
            arrastarMarcador("direito", -4, { esquerda: 0, direita: 0, primeira: 0 }, LARGURA_TEXTO, limites).direita,
            -2,
        );
    });
});

describe("régua do editor: passo, margens e marcas", () => {
    it("encaixa a cada 0,25 cm; com Alt fica livre (0,01 cm)", () => {
        assert.equal(ajustarAoPasso(1.37), 1.25);
        assert.equal(ajustarAoPasso(1.38), 1.5);
        assert.equal(ajustarAoPasso(1.376, true), 1.38);
        assert.equal(ajustarAoPasso(Number.NaN), 0);
    });

    it("margem fica entre 0,5 e 6 cm e deixa pelo menos 2 cm de texto", () => {
        assert.equal(arrastarMargem(0.1, 2, 21), 0.5);
        assert.equal(arrastarMargem(4.5, 2, 21), 4.5);
        assert.equal(arrastarMargem(9, 2, 21), 6);
        assert.equal(arrastarMargem(6, 13, 21), 6);
        assert.equal(arrastarMargem(6, 14, 21), 5);
    });

    it("numera a partir da margem para os dois lados, com meio e quarto de cm", () => {
        const marcas = marcasRegua(21, 3);
        const rotulos = marcas.filter((m) => m.rotulo).map((m) => `${m.posCm}:${m.rotulo}`);
        assert.deepEqual(rotulos.slice(0, 4), ["1:2", "2:1", "4:1", "5:2"]);
        assert.ok(rotulos.includes("20:17"));
        assert.ok(!marcas.some((m) => m.posCm === 3 && m.rotulo), "o zero (na margem) não tem número");
        assert.equal(marcas.find((m) => m.posCm === 3.5)?.tipo, "meio");
        assert.equal(marcas.find((m) => m.posCm === 3.25)?.tipo, "quarto");
        assert.equal(marcas.find((m) => m.posCm === 2.75)?.tipo, "quarto");
        assert.equal(formatarCmRegua(1.25), "1,25 cm");
    });
});
