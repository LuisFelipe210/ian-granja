import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    MODALIDADES,
    analisar,
    lerDecimal,
    nivel,
    parcelaPrice,
    saldoDevedor,
    taxaMedia,
    taxaPelasParcelas,
    validar,
} from "../src/lib/juros/index.ts";

const mod = (id: string) => {
    const found = MODALIDADES.find((m) => m.id === id);
    assert.ok(found, `Modalidade ${id} deveria existir`);
    return found;
};

describe("cálculo Tabela Price", () => {
    it("parcelaPrice e taxaPelasParcelas são inversas consistentes", () => {
        const pv = 50000;
        const taxaMensalPct = 2.49;
        const n = 48;
        const p = parcelaPrice(pv, taxaMensalPct / 100, n);
        const calculada = taxaPelasParcelas(pv, p, n);
        assert.ok(Math.abs(calculada - taxaMensalPct) < 1e-6);
    });

    it("saldoDevedor zera exatamente ao fim das n parcelas", () => {
        const pv = 30000;
        const i = 0.02;
        const n = 36;
        const p = parcelaPrice(pv, i, n);
        const saldoFinal = saldoDevedor(pv, i, p, n);
        assert.ok(Math.abs(saldoFinal) < 1e-6);
    });
});

describe("lerDecimal", () => {
    it("aceita formatos brasileiros e ponto decimal simples", () => {
        assert.equal(lerDecimal("2,49"), 2.49);
        assert.equal(lerDecimal("2.49"), 2.49);
        assert.equal(lerDecimal("1.234,56"), 1234.56);
        assert.equal(lerDecimal("12,5%"), 12.5);
    });

    it("rejeita strings vazias, negativas e formatos ambíguos", () => {
        for (const entrada of ["", "   ", "2.5,0", "1,2,3", "1.2.3", ".", ",", "-2", "-2,5"]) {
            assert.ok(Number.isNaN(lerDecimal(entrada)), `Esperava NaN para "${entrada}"`);
        }
    });
});

describe("validar", () => {
    const base = {
        mod: mod("veiculo-pf"),
        mes: "2024-06",
        valor: 50000,
        parcela: 1850,
        parcelas: 48,
        pagas: 12,
    };

    it("aceita entrada válida", () => {
        assert.equal(validar(base), null);
    });

    it("rejeita campos obrigatórios ausentes", () => {
        assert.ok(validar({ ...base, mod: undefined }));
        assert.ok(validar({ ...base, mes: "" }));
        assert.ok(validar({ ...base, valor: 0 }));
        assert.ok(validar({ ...base, parcela: 0 }));
        assert.ok(validar({ ...base, parcelas: 0 }));
    });

    it("rejeita soma das parcelas menor ou igual ao valor financiado", () => {
        assert.ok(validar({ ...base, valor: 50000, parcela: 1000, parcelas: 48 }));
        assert.ok(validar({ ...base, valor: 48000, parcela: 1000, parcelas: 48 }));
    });

    it("rejeita parcelas pagas fora do intervalo [0, parcelas] e NaN/não-inteiro", () => {
        assert.ok(validar({ ...base, pagas: -1 }));
        assert.ok(validar({ ...base, pagas: 49 }));
        assert.ok(validar({ ...base, pagas: Number.NaN }));
        assert.ok(validar({ ...base, parcelas: 1000 }));
        assert.ok(validar({ ...base, parcelas: 12.5 }));
    });

    it("analisar e funções Price não produzem NaN nem Infinity em entradas inválidas ou extremas", () => {
        assert.equal(taxaPelasParcelas(0, 0, 48), 0);
        assert.equal(taxaPelasParcelas(50000, 500, 48), 0);
        assert.equal(parcelaPrice(50000, 0, 0), 0);
        assert.ok(Number.isFinite(saldoDevedor(10000, 0.15, 1600, 240)));
        assert.equal(
            analisar({
                mod: mod("veiculo-pf"),
                mes: "2024-06",
                valor: 0,
                parcela: 1000,
                parcelas: 48,
                pagas: 0,
            }),
            null,
        );
    });

    it("rejeita mês no futuro", () => {
        assert.ok(validar({ ...base, mes: "2099-01" }));
    });
});

describe("analisar e séries BACEN", () => {
    it("mantém razao === razaoAm e nivel === nivel(razaoAm) mesmo com capitalização anual alta", () => {
        const pv = 10000;
        const n = 12;
        const p = parcelaPrice(pv, 0.1, n); // 10% a.m. (~1,37x de 7,29% a.m., porém > 1,5x na taxa anual)
        const a = analisar({
            mod: mod("sem-garantia"),
            mes: "2025-11",
            valor: pv,
            parcela: p,
            parcelas: n,
            pagas: 3,
            taxaMensal: 10,
        });
        assert.ok(a);
        assert.ok(a.razaoAm < 1.5);
        assert.ok(a.razaoAa >= 1.5);
        assert.equal(a.razao, a.razaoAm);
        assert.equal(a.nivel, nivel(a.razaoAm));
        assert.equal(a.nivel, "acima");
    });

    it("calcula saldoRecalculado < saldoHojeNaMedia < saldoHoje quando a parcela paga é maior que a média", () => {
        const a = analisar({
            mod: mod("veiculo-pf"),
            mes: "2025-11",
            valor: 50000,
            parcela: 2000,
            parcelas: 48,
            pagas: 12,
        });
        assert.ok(a);
        assert.ok(a.saldoRecalculado < a.saldoHojeNaMedia);
        assert.ok(a.saldoHojeNaMedia < a.saldoHoje);
    });

    it("usa série alternativa antes de nov/2025 para empréstimo sem garantia e com garantia PF", () => {
        const mSem = taxaMedia(mod("sem-garantia"), "2024-06");
        assert.ok(mSem);
        assert.equal(mSem.serieAm, 25464);
        assert.equal(mSem.serieAa, 20742);
        assert.match(mSem.nota, /crédito pessoal não consignado \(total\)/i);

        const mCom = taxaMedia(mod("garantia-pf"), "2024-06");
        assert.ok(mCom);
        assert.equal(mCom.serieAm, 25471);
        assert.equal(mCom.serieAa, 20749);
        assert.match(mCom.nota, /aquisição de veículos \(PF\)/i);
    });

    it("todas as 13 modalidades possuem fallback offline em bacen-series.json (incluindo mês futuro sem cair em jan/2012)", () => {
        for (const m of MODALIDADES) {
            const historico = taxaMedia(m, "2024-06");
            assert.ok(historico, `Modalidade ${m.id} sem taxaMedia offline em 2024-06`);
            assert.ok(historico.am > 0 && historico.aa > 0, `Taxa inválida em ${m.id}`);

            const recente = taxaMedia(m, "2026-11");
            assert.ok(recente, `Modalidade ${m.id} sem fallback recente em 2026-11`);
            assert.notEqual(recente.mes, "2012-01", `Modalidade ${m.id} caiu no primeiro mês (2012-01) em vez do mais recente`);
        }
    });
});
