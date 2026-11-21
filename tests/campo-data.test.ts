import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    dataPorExtensoCurta,
    dentroDoIntervalo,
    gradeDoMes,
    interpretarDataDigitada,
    isoParaBr,
    mascararDataBr,
    somarDiasIso,
    somarMesesIso,
} from "../src/lib/campo-data.ts";

describe("seletor de data da calculadora (campo-data)", () => {
    it("aplica a máscara dd/mm/aaaa enquanto digita", () => {
        assert.equal(mascararDataBr("0"), "0");
        assert.equal(mascararDataBr("0503"), "05/03");
        assert.equal(mascararDataBr("05032024"), "05/03/2024");
        assert.equal(mascararDataBr("05/03/20249"), "05/03/2024");
        assert.equal(mascararDataBr("ab05c03"), "05/03");
    });

    it("interpreta digitado e colado nos formatos usuais e recusa datas inexistentes", () => {
        assert.equal(interpretarDataDigitada("05/03/2024"), "2024-03-05");
        assert.equal(interpretarDataDigitada("5/3/2024"), "2024-03-05");
        assert.equal(interpretarDataDigitada("05.03.2024"), "2024-03-05");
        assert.equal(interpretarDataDigitada("05032024"), "2024-03-05");
        assert.equal(interpretarDataDigitada("2024-03-05"), "2024-03-05");
        assert.equal(interpretarDataDigitada("29/02/2023"), "");
        assert.equal(interpretarDataDigitada("31/04/2024"), "");
        assert.equal(interpretarDataDigitada("05/03"), "");
        assert.equal(interpretarDataDigitada(""), "");
    });

    it("ano com 2 dígitos vira 20xx até o ano atual + 30, senão 19xx", () => {
        assert.equal(interpretarDataDigitada("050324", 2026), "2024-03-05");
        assert.equal(interpretarDataDigitada("10/01/56", 2026), "2056-01-10");
        assert.equal(interpretarDataDigitada("10/01/57", 2026), "1957-01-10");
    });

    it("converte ISO ⇄ BR sem efeito de fuso horário", () => {
        assert.equal(isoParaBr("2024-01-01"), "01/01/2024");
        assert.equal(isoParaBr("2024-13-01"), "");
        assert.equal(isoParaBr(""), "");
    });

    it("soma dias e meses respeitando fim de mês e ano bissexto", () => {
        assert.equal(somarDiasIso("2024-12-31", 1), "2025-01-01");
        assert.equal(somarDiasIso("2024-03-01", -1), "2024-02-29");
        assert.equal(somarMesesIso("2024-01-31", 1), "2024-02-29");
        assert.equal(somarMesesIso("2024-03-15", -12), "2023-03-15");
        assert.equal(somarMesesIso("2024-12-10", 1), "2025-01-10");
    });

    it("grade do mês tem 6 semanas começando no domingo", () => {
        const g = gradeDoMes(2026, 11);
        assert.equal(g.length, 42);
        assert.equal(g[0].iso, "2026-11-01"); // 01/11/2026 é domingo
        assert.equal(g.filter((c) => c.noMes).length, 30);
        const marco = gradeDoMes(2024, 3);
        assert.equal(marco[0].iso, "2024-02-25");
        assert.equal(marco[0].noMes, false);
    });

    it("limites min/max e texto para leitor de tela", () => {
        assert.equal(dentroDoIntervalo("2024-03-05", "2024-01-01", "2024-12-31"), true);
        assert.equal(dentroDoIntervalo("2025-01-01", undefined, "2024-12-31"), false);
        assert.equal(dentroDoIntervalo("", undefined, undefined), false);
        assert.equal(dataPorExtensoCurta("2024-03-05"), "terça-feira, 5 de março de 2024");
    });
});
