import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Schema, type Node as PmNode } from "@tiptap/pm/model";
import { EditorState, TextSelection, type Transaction } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { substituirOcorrencias, transformarCaixaSelecao } from "../src/components/juros/extensoes-word-editor.ts";

const schema = new Schema({
    nodes: {
        doc: { content: "paragraph+" },
        paragraph: { content: "text*", group: "block" },
        text: {},
    },
    marks: { bold: {} },
});
const negrito = schema.marks.bold.create();

/** Editor mínimo com o que as funções usam: state, view.dispatch e commands.focus. */
function criarEditor(doc: PmNode, selecionarTudo = true) {
    let state = EditorState.create({ schema, doc });
    if (selecionarTudo) {
        state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1, state.doc.content.size - 1)));
    }
    const editor = {
        get state() {
            return state;
        },
        view: {
            dispatch(tr: Transaction) {
                state = state.apply(tr);
            },
        },
        commands: { focus: () => true },
    };
    return editor as unknown as Editor & { state: EditorState };
}

function trechos(doc: PmNode): Array<[string, boolean]> {
    const out: Array<[string, boolean]> = [];
    doc.descendants((n) => {
        if (n.isText) out.push([n.text ?? "", n.marks.some((m) => m.type.name === "bold")]);
    });
    return out;
}

describe("editor estilo Word: caixa do texto", () => {
    it("Frase olha o parágrafo inteiro, sem capitalizar cada trecho em negrito", () => {
        const doc = schema.node("doc", null, [
            schema.node("paragraph", null, [
                schema.text("O CONTRATO "),
                schema.text("FOI", [negrito]),
                schema.text(" ASSINADO. DEPOIS PAGOU."),
            ]),
        ]);
        const editor = criarEditor(doc);
        assert.equal(transformarCaixaSelecao(editor, "frase"), true);
        assert.deepEqual(trechos(editor.state.doc), [
            ["O contrato ", false],
            ["foi", true],
            [" assinado. Depois pagou.", false],
        ]);
    });

    it("Iniciais Maiúsculas mantém partículas minúsculas mesmo em outro trecho", () => {
        const doc = schema.node("doc", null, [
            schema.node("paragraph", null, [schema.text("banco "), schema.text("do brasil", [negrito])]),
        ]);
        const editor = criarEditor(doc);
        transformarCaixaSelecao(editor, "titulo");
        assert.deepEqual(trechos(editor.state.doc), [
            ["Banco ", false],
            ["do Brasil", true],
        ]);
    });

    it("cada parágrafo começa uma frase nova", () => {
        const doc = schema.node("doc", null, [
            schema.node("paragraph", null, [schema.text("PRIMEIRO")]),
            schema.node("paragraph", null, [schema.text("SEGUNDO")]),
        ]);
        const editor = criarEditor(doc);
        transformarCaixaSelecao(editor, "frase");
        assert.equal(editor.state.doc.textBetween(0, editor.state.doc.content.size, "|"), "Primeiro|Segundo");
    });
});

describe("editor estilo Word: localizar e substituir", () => {
    it("preserva o negrito do trecho substituído quando ele começa junto com a formatação", () => {
        const doc = schema.node("doc", null, [
            schema.node("paragraph", null, [schema.text("valor de "), schema.text("R$ 1.000", [negrito])]),
        ]);
        const editor = criarEditor(doc, false);
        assert.equal(substituirOcorrencias(editor, "R$ 1.000", "R$ 2.000", true), 1);
        assert.deepEqual(trechos(editor.state.doc), [
            ["valor de ", false],
            ["R$ 2.000", true],
        ]);
    });
});
