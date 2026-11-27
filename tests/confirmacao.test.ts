import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fraseExclusaoClientes, frasesIguais } from "../src/lib/confirmacao.ts";

describe("confirmação digitada de exclusão", () => {
    it("aceita a frase sem diferenciar maiúsculas, acentos e espaços", () => {
        assert.equal(frasesIguais("maria teste da silva", "Maria Teste da Silva"), true);
        assert.equal(frasesIguais("  JOSÉ   da   Conceição ", "Jose da Conceicao"), true);
        assert.equal(frasesIguais("excluir 3 clientes", "excluir 3 clientes"), true);
    });

    it("recusa frase diferente, incompleta ou vazia", () => {
        assert.equal(frasesIguais("Maria Teste", "Maria Teste da Silva"), false);
        assert.equal(frasesIguais("excluir 2 clientes", "excluir 3 clientes"), false);
        assert.equal(frasesIguais("", ""), false);
        assert.equal(frasesIguais("   ", "   "), false);
    });

    it("pede o nome para um cliente e 'excluir N clientes' para vários", () => {
        assert.equal(fraseExclusaoClientes(["Maria Teste da Silva"]), "Maria Teste da Silva");
        assert.equal(fraseExclusaoClientes(["A", "B", "C"]), "excluir 3 clientes");
    });
});
