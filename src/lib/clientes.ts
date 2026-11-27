/**
 * Cadastro de clientes: CPF/CNPJ, CEP, endereço e a "qualificação completa" usada nas petições
 * ("FULANO, brasileiro, casado, motorista, portador do RG nº..., inscrito no CPF sob o nº...").
 * Funções puras (rodam no navegador e nos testes), exceto `buscarCep`, que consulta o ViaCEP.
 */
import type { Cliente } from "./revisional-db.ts";

export const somenteDigitos = (s: string) => (s ?? "").replace(/\D+/g, "");

/* ------------------------------------------------------- CPF / CNPJ */

export function cpfValido(valor: string): boolean {
    const d = somenteDigitos(valor);
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    const dv = (base: string, pesoInicial: number) => {
        let soma = 0;
        for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
        const resto = (soma * 10) % 11;
        return resto === 10 ? 0 : resto;
    };
    return dv(d.slice(0, 9), 10) === Number(d[9]) && dv(d.slice(0, 10), 11) === Number(d[10]);
}

export function cnpjValido(valor: string): boolean {
    const d = somenteDigitos(valor);
    if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
    const dv = (base: string) => {
        const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        const soma = base.split("").reduce((acc, n, i) => acc + Number(n) * pesos[i], 0);
        const resto = soma % 11;
        return resto < 2 ? 0 : 11 - resto;
    };
    return dv(d.slice(0, 12)) === Number(d[12]) && dv(d.slice(0, 13)) === Number(d[13]);
}

export function formatarCpf(valor: string): string {
    const d = somenteDigitos(valor);
    return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : valor;
}

export function formatarCnpj(valor: string): string {
    const d = somenteDigitos(valor);
    return d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : valor;
}

export function formatarCpfCnpj(valor: string): string {
    const d = somenteDigitos(valor);
    return d.length === 14 ? formatarCnpj(d) : d.length === 11 ? formatarCpf(d) : valor;
}

/** Máscara enquanto digita: 123.456.789-0 / 12.345.678/0001-9. */
export function mascaraCpfCnpj(valor: string, tipo: "pf" | "pj"): string {
    const d = somenteDigitos(valor).slice(0, tipo === "pj" ? 14 : 11);
    if (tipo === "pj") {
        return d
            .replace(/^(\d{2})(\d)/, "$1.$2")
            .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
            .replace(/\.(\d{3})(\d)/, ".$1/$2")
            .replace(/(\d{4})(\d)/, "$1-$2");
    }
    return d
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function formatarCep(valor: string): string {
    const d = somenteDigitos(valor).slice(0, 8);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function formatarTelefone(valor: string): string {
    const d = somenteDigitos(valor);
    if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    return valor;
}

/* ------------------------------------------------------- Concordância */

export const ESTADOS_CIVIS = [
    { id: "solteiro", m: "solteiro", f: "solteira", neutro: "solteiro(a)" },
    { id: "casado", m: "casado", f: "casada", neutro: "casado(a)" },
    { id: "uniao_estavel", m: "em união estável", f: "em união estável", neutro: "em união estável" },
    { id: "divorciado", m: "divorciado", f: "divorciada", neutro: "divorciado(a)" },
    { id: "separado", m: "separado judicialmente", f: "separada judicialmente", neutro: "separado(a) judicialmente" },
    { id: "viuvo", m: "viúvo", f: "viúva", neutro: "viúvo(a)" },
] as const;

type Genero = "m" | "f" | "";

function flex(genero: Genero, m: string, f: string, neutro: string): string {
    return genero === "m" ? m : genero === "f" ? f : neutro;
}

export function estadoCivilPorExtenso(id: string, genero: Genero): string {
    const e = ESTADOS_CIVIS.find((x) => x.id === id);
    if (!e) return id.trim();
    return flex(genero, e.m, e.f, e.neutro);
}

/** "brasileiro" → "brasileira" quando feminino (só ajusta a terminação -o). */
export function nacionalidadeFlexionada(nacionalidade: string, genero: Genero): string {
    const n = nacionalidade.trim().toLowerCase();
    if (!n) return "";
    if (genero === "f" && n.endsWith("o")) return `${n.slice(0, -1)}a`;
    if (genero === "" && n.endsWith("o")) return `${n}(a)`;
    return n;
}

/* ------------------------------------------------------- Endereço e qualificação */

export function enderecoCompleto(c: Pick<Cliente, "logradouro" | "numero" | "complemento" | "bairro" | "cidade" | "uf" | "cep">): string {
    const rua = [c.logradouro.trim(), c.numero.trim() ? `nº ${c.numero.trim()}` : ""].filter(Boolean).join(", ");
    const partes = [
        rua,
        c.complemento.trim(),
        c.bairro.trim(),
        [c.cidade.trim(), c.uf.trim()].filter(Boolean).join("/"),
        c.cep ? `CEP ${formatarCep(c.cep)}` : "",
    ].filter(Boolean);
    return partes.join(", ");
}

/**
 * Parágrafo de qualificação da parte, pronto para a petição.
 * Pula o que não foi cadastrado em vez de deixar buraco ("portador do RG nº ,").
 */
export function qualificacaoCompleta(c: Cliente): string {
    const nome = c.nome.trim().toUpperCase();
    // Só o CEP não basta para "residente na ..." / "com sede na ...".
    const endereco = c.logradouro.trim() || c.cidade.trim() ? enderecoCompleto(c) : "";
    const g = c.genero as Genero;

    if (c.tipo_pessoa === "pj") {
        const partes = [nome, "pessoa jurídica de direito privado"];
        if (c.cpf_cnpj) partes.push(`inscrita no CNPJ sob o nº ${formatarCnpj(c.cpf_cnpj)}`);
        if (endereco) partes.push(`com sede na ${endereco}`);
        if (c.email.trim()) partes.push(`e-mail ${c.email.trim()}`);
        let texto = partes.join(", ");
        if (c.representante_nome.trim()) {
            texto += `, neste ato representada por ${c.representante_nome.trim()}`;
            if (c.representante_cpf) texto += `, inscrito(a) no CPF sob o nº ${formatarCpf(c.representante_cpf)}`;
        }
        return texto;
    }

    const partes = [nome];
    const nacionalidade = nacionalidadeFlexionada(c.nacionalidade, g);
    if (nacionalidade) partes.push(nacionalidade);
    if (c.estado_civil) partes.push(estadoCivilPorExtenso(c.estado_civil, g));
    if (c.profissao.trim()) partes.push(c.profissao.trim().toLowerCase());
    if (c.rg.trim()) {
        const orgao = c.rg_orgao.trim() ? ` ${c.rg_orgao.trim().toUpperCase()}` : "";
        partes.push(`${flex(g, "portador", "portadora", "portador(a)")} do RG nº ${c.rg.trim()}${orgao}`);
    }
    if (c.cpf_cnpj) {
        partes.push(`${flex(g, "inscrito", "inscrita", "inscrito(a)")} no CPF sob o nº ${formatarCpf(c.cpf_cnpj)}`);
    }
    if (endereco) {
        partes.push(`${flex(g, "residente e domiciliado", "residente e domiciliada", "residente e domiciliado(a)")} na ${endereco}`);
    }
    if (c.email.trim()) partes.push(`e-mail ${c.email.trim()}`);
    return partes.join(", ");
}

/** O que ainda falta para a qualificação ficar completa (para avisar na lista). */
export function pendenciasCadastro(c: Cliente): string[] {
    const faltando: string[] = [];
    if (!c.cpf_cnpj) faltando.push(c.tipo_pessoa === "pj" ? "CNPJ" : "CPF");
    if (c.tipo_pessoa === "pf") {
        if (!c.rg.trim()) faltando.push("RG");
        if (!c.estado_civil) faltando.push("estado civil");
        if (!c.profissao.trim()) faltando.push("profissão");
    } else if (!c.representante_nome.trim()) {
        faltando.push("representante");
    }
    if (!c.logradouro.trim() || !c.cidade.trim()) faltando.push("endereço");
    return faltando;
}

/* ------------------------------------------------------- CEP (ViaCEP) */

export interface EnderecoCep {
    logradouro: string;
    bairro: string;
    cidade: string;
    uf: string;
}

export async function buscarCep(cep: string, fetchImpl: typeof fetch = fetch): Promise<EnderecoCep | null> {
    const d = somenteDigitos(cep);
    if (d.length !== 8) return null;
    const res = await fetchImpl(`https://viacep.com.br/ws/${d}/json/`, {
        signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error("Não foi possível consultar o CEP agora.");
    const j = (await res.json()) as { erro?: boolean | string; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
    if (j.erro) return null;
    return {
        logradouro: j.logradouro ?? "",
        bairro: j.bairro ?? "",
        cidade: j.localidade ?? "",
        uf: (j.uf ?? "").toUpperCase(),
    };
}
