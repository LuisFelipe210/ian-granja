import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    buscarCep,
    cnpjValido,
    cpfValido,
    enderecoCompleto,
    formatarCpfCnpj,
    mascaraCpfCnpj,
    pendenciasCadastro,
    qualificacaoCompleta,
} from "../src/lib/clientes.ts";
import { extrairCampos, preencherModelo, valoresIniciaisCampos } from "../src/lib/documentos.ts";
import { clienteEmBranco, sanitizarClientePayload, type Cliente } from "../src/lib/revisional-db.ts";

// CPF/CNPJ sintéticos com dígitos verificadores válidos (gerados para teste, não pertencem a ninguém).
const CPF_TESTE = "52998224725";
const CNPJ_TESTE = "11222333000181";

function cliente(parcial: Partial<Cliente>): Cliente {
    return {
        ...clienteEmBranco(),
        id: "cli-1",
        created_by_email: "",
        created_at: "2026-11-20T10:00:00Z",
        updated_at: "2026-11-20T10:00:00Z",
        ...parcial,
    } as Cliente;
}

const maria = cliente({
    nome: "Maria Exemplo da Silva",
    genero: "f",
    nacionalidade: "brasileiro",
    estado_civil: "casado",
    profissao: "Professora",
    rg: "1234567",
    rg_orgao: "sds/pe",
    cpf_cnpj: CPF_TESTE,
    cep: "56300000",
    logradouro: "Rua Exemplo",
    numero: "100",
    complemento: "Apto 2",
    bairro: "Centro",
    cidade: "Petrolina",
    uf: "PE",
});

describe("CPF e CNPJ", () => {
    it("valida dígitos verificadores", () => {
        assert.equal(cpfValido(CPF_TESTE), true);
        assert.equal(cpfValido("529.982.247-25"), true);
        assert.equal(cpfValido("52998224724"), false);
        assert.equal(cpfValido("11111111111"), false);
        assert.equal(cpfValido("123"), false);
        assert.equal(cnpjValido(CNPJ_TESTE), true);
        assert.equal(cnpjValido("11.222.333/0001-81"), true);
        assert.equal(cnpjValido("11222333000182"), false);
        assert.equal(cnpjValido("00000000000000"), false);
    });

    it("formata e mascara enquanto digita", () => {
        assert.equal(formatarCpfCnpj(CPF_TESTE), "529.982.247-25");
        assert.equal(formatarCpfCnpj(CNPJ_TESTE), "11.222.333/0001-81");
        assert.equal(mascaraCpfCnpj("5299822", "pf"), "529.982.2");
        assert.equal(mascaraCpfCnpj("52998224725999", "pf"), "529.982.247-25");
        assert.equal(mascaraCpfCnpj("112223330001", "pj"), "11.222.333/0001");
    });
});

describe("qualificação completa", () => {
    it("pessoa física com concordância no feminino", () => {
        assert.equal(
            qualificacaoCompleta(maria),
            "MARIA EXEMPLO DA SILVA, brasileira, casada, professora, portadora do RG nº 1234567 SDS/PE, " +
                "inscrita no CPF sob o nº 529.982.247-25, residente e domiciliada na Rua Exemplo, nº 100, Apto 2, " +
                "Centro, Petrolina/PE, CEP 56300-000",
        );
    });

    it("sem gênero usa (a) e pula o que não foi cadastrado", () => {
        const c = cliente({ nome: "José Teste", nacionalidade: "brasileiro", estado_civil: "solteiro", cpf_cnpj: CPF_TESTE });
        assert.equal(
            qualificacaoCompleta(c),
            "JOSÉ TESTE, brasileiro(a), solteiro(a), inscrito(a) no CPF sob o nº 529.982.247-25",
        );
    });

    it("pessoa jurídica com representante", () => {
        const c = cliente({
            tipo_pessoa: "pj",
            nome: "Transportadora Exemplo Ltda",
            cpf_cnpj: CNPJ_TESTE,
            logradouro: "Av. Teste",
            numero: "5",
            cidade: "Petrolina",
            uf: "PE",
            representante_nome: "João Exemplo",
            representante_cpf: CPF_TESTE,
        });
        assert.equal(
            qualificacaoCompleta(c),
            "TRANSPORTADORA EXEMPLO LTDA, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 11.222.333/0001-81, " +
                "com sede na Av. Teste, nº 5, Petrolina/PE, neste ato representada por João Exemplo, " +
                "inscrito(a) no CPF sob o nº 529.982.247-25",
        );
    });

    it("só CEP, sem rua nem cidade, não vira endereço na qualificação", () => {
        const c = cliente({ nome: "Ana", tipo_pessoa: "pj", cep: "56300000" });
        assert.equal(qualificacaoCompleta(c), "ANA, pessoa jurídica de direito privado");
    });

    it("lista o que falta no cadastro", () => {
        assert.deepEqual(pendenciasCadastro(maria), []);
        assert.deepEqual(pendenciasCadastro(cliente({ nome: "X" })), ["CPF", "RG", "estado civil", "profissão", "endereço"]);
        assert.deepEqual(pendenciasCadastro(cliente({ nome: "Y", tipo_pessoa: "pj" })), ["CNPJ", "representante", "endereço"]);
        assert.equal(enderecoCompleto(cliente({ cidade: "Recife", uf: "PE" })), "Recife/PE");
    });
});

describe("campos do cliente nos documentos", () => {
    it("[qualificação completa], [CPF do cliente] e [endereço do cliente] vêm do cadastro", () => {
        const html =
            "<p>[qualificação completa], vem propor ação. CPF: [cpf]. Endereço: [endereço do cliente]. [estado civil].</p>";
        const campos = extrairCampos(html);
        const valores = valoresIniciaisCampos(campos, { cliente: maria, calculo: null, hoje: new Date(2026, 10, 20) });
        const out = preencherModelo(html, valores);
        assert.match(out, /^<p>MARIA EXEMPLO DA SILVA, brasileira, casada/);
        assert.match(out, /CPF: 529\.982\.247-25\./);
        assert.match(out, /Endereço: Rua Exemplo, nº 100, Apto 2, Centro, Petrolina\/PE, CEP 56300-000\./);
        assert.match(out, /casada\.<\/p>$/);
    });

    it("nome do cliente vem do cadastro; sem cadastro, do caso", () => {
        const v1 = valoresIniciaisCampos(["nome do cliente"], { cliente: maria, calculo: null, hoje: new Date() });
        assert.equal(v1["nome do cliente"], "Maria Exemplo da Silva");
        const v2 = valoresIniciaisCampos(["nome do cliente"], {
            cliente: null,
            calculo: { cliente_nome: "Caso Sem Cadastro" } as never,
            hoje: new Date(),
        });
        assert.equal(v2["nome do cliente"], "Caso Sem Cadastro");
    });
});

describe("validação antes de salvar", () => {
    it("limpa máscaras, exige nome e confere tamanhos", () => {
        assert.deepEqual(
            sanitizarClientePayload({ nome: "  Ana   Teste ", cpf_cnpj: "529.982.247-25", cep: "56300-000", uf: "pe" }),
            { nome: "Ana Teste", cpf_cnpj: CPF_TESTE, cep: "56300000", uf: "PE" },
        );
        assert.throws(() => sanitizarClientePayload({ nome: " " }), /nome/);
        assert.throws(() => sanitizarClientePayload({ cpf_cnpj: "123" }), /11 dígitos/);
        assert.throws(() => sanitizarClientePayload({ cep: "123" }), /CEP/);
        assert.throws(() => sanitizarClientePayload({ uf: "Pernambuco" }), /UF/);
        assert.deepEqual(sanitizarClientePayload({ data_nascimento: "" }), { data_nascimento: null });
        assert.deepEqual(sanitizarClientePayload({ genero: "x" as never }), { genero: "" });
    });

    it("rejeita CPF/CNPJ com dígitos verificadores inválidos e divergência entre tipo_pessoa e documento", () => {
        assert.throws(() => sanitizarClientePayload({ cpf_cnpj: "111.111.111-11" }), /CPF inválido/);
        assert.throws(() => sanitizarClientePayload({ cpf_cnpj: "52998224724" }), /CPF inválido/);
        assert.throws(() => sanitizarClientePayload({ cpf_cnpj: "00.000.000/0000-00" }), /CNPJ inválido/);
        assert.throws(() => sanitizarClientePayload({ cpf_cnpj: "11222333000182" }), /CNPJ inválido/);
        assert.throws(
            () => sanitizarClientePayload({ tipo_pessoa: "pf", cpf_cnpj: CNPJ_TESTE }),
            /Pessoa física deve informar CPF/,
        );
        assert.throws(
            () => sanitizarClientePayload({ tipo_pessoa: "pj", cpf_cnpj: CPF_TESTE }),
            /Pessoa jurídica deve informar CNPJ/,
        );
        assert.throws(() => sanitizarClientePayload({ representante_cpf: "11111111111" }), /CPF do representante inválido/);
    });
});

describe("CEP (ViaCEP)", () => {
    it("preenche o endereço e trata CEP inexistente", async () => {
        const fakeOk = (async () =>
            new Response(JSON.stringify({ logradouro: "Rua A", bairro: "Centro", localidade: "Petrolina", uf: "pe" }))) as typeof fetch;
        assert.deepEqual(await buscarCep("56300-000", fakeOk), {
            logradouro: "Rua A",
            bairro: "Centro",
            cidade: "Petrolina",
            uf: "PE",
        });
        const fakeErro = (async () => new Response(JSON.stringify({ erro: true }))) as typeof fetch;
        assert.equal(await buscarCep("00000000", fakeErro), null);
        assert.equal(await buscarCep("123", fakeOk), null);
    });
});
