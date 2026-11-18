import {
    MODALIDADES,
    brl,
    num,
    resumo,
    type Analise,
    type Modalidade,
    type Nivel,
    type Pessoa,
} from "./juros/index.ts";
import {
    INDICES_CORRECAO_OPCOES,
    PARAMETROS_DECISAO_PADRAO,
    TIPOS_JUROS_OPCOES,
    calcularProcessoRevisional,
    hojeISO,
    prepararDadosBacenProcesso,
    primeiroVencimentoSugerido,
    type ContratoInput,
    type DeducaoItem,
    type ParametrosDecisao,
    type ProcessoRevisionalInput,
    type ResultadoProcessoRevisional,
    type TarifaItem,
} from "./juros/revisional-pro.ts";

const DEFAULT_SUPABASE_URL = "https://smeaktuuuxahmbzpjwqa.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtZWFrdHV1dXhhaG1ienBqd3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1MDkwNDYsImV4cCI6MjExMDA4NTA0Nn0.w9BajnZKcF3wgzCxxK45QfZAzayKNCYK_ynqyG17Rb4";

const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
export const SUPABASE_URL = metaEnv?.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
export const SUPABASE_ANON_KEY = metaEnv?.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
export const IS_LOCAL_SUPABASE = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(SUPABASE_URL);

const SESSION_KEY = IS_LOCAL_SUPABASE ? "ig_revisional_session_local_v1" : "ig_revisional_session_v1";

export type CategoriaCor = "gold" | "ink" | "crimson" | "emerald" | "slate";

export interface Categoria {
    id: string;
    nome: string;
    cor: CategoriaCor;
    ordem: number;
    created_at: string;
}

export interface FichaCliente {
    clienteNome: string;
    processoGlobal?: string;
    banco: string;
    documentoContrato: string;
    categoriaId: string | null;
    observacoes: string;
}

export interface CalculoSalvo {
    id: string;
    categoria_id: string | null;
    cliente_nome: string;
    processo_global: string;
    banco: string;
    documento_contrato: string;
    observacoes: string;
    pessoa: Pessoa;
    modalidade_id: string;
    modalidade_nome: string;
    mes_contrato: string;
    valor_financiado: number;
    valor_parcela: number;
    parcelas: number;
    pagas: number;
    taxa_mensal_informada: number | null;
    taxa_anual_informada: number | null;
    media_mensal_manual: number | null;
    media_anual_manual: number | null;
    contrato_am: number;
    contrato_aa: number;
    taxa_efetiva: number;
    media_am: number;
    media_aa: number;
    media_mes: string;
    serie_am: number | null;
    serie_aa: number | null;
    razao_am: number;
    razao_aa: number;
    nivel: Nivel;
    diferenca_total: number;
    pago_a_mais: number;
    saldo_recalculado: number;
    qtd_contratos: number;
    total_tarifas: number;
    valor_total_acao: number;
    dados_completos: Partial<ProcessoRevisionalInput>;
    created_by_email: string;
    created_at: string;
    updated_at: string;
}

export type CalculoPayload = Omit<
    CalculoSalvo,
    "id" | "created_by_email" | "created_at" | "updated_at"
>;

export interface RevisionalSession {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    user: {
        id: string;
        email: string;
    };
}

export class RevisionalApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = "RevisionalApiError";
        this.status = status;
    }
}

const round4 = (n: number) => Math.round(n * 10000) / 10000;
const round2 = (n: number) => Math.round(n * 100) / 100;
const optNum = (n?: number) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? round4(n) : null);

export function analiseParaPayload(a: Analise, ficha: FichaCliente): CalculoPayload {
    const e = a.entrada;
    const clienteNome = ficha.clienteNome.trim();
    if (!clienteNome) {
        throw new Error("Informe o nome do cliente antes de salvar.");
    }

    return {
        categoria_id: ficha.categoriaId || null,
        cliente_nome: clienteNome,
        processo_global: (ficha.processoGlobal ?? "").trim(),
        banco: ficha.banco.trim(),
        documento_contrato: ficha.documentoContrato.trim(),
        observacoes: ficha.observacoes.trim(),
        pessoa: e.mod.pessoa,
        modalidade_id: e.mod.id,
        modalidade_nome: e.mod.nome,
        mes_contrato: e.mes,
        valor_financiado: round2(e.valor),
        valor_parcela: round2(e.parcela),
        parcelas: e.parcelas,
        pagas: e.pagas,
        taxa_mensal_informada: optNum(e.taxaMensal),
        taxa_anual_informada: optNum(e.taxaAnual),
        media_mensal_manual: optNum(e.mediaMensal),
        media_anual_manual: optNum(e.mediaAnual),
        contrato_am: round4(a.contratoAm),
        contrato_aa: round4(a.contratoAa),
        taxa_efetiva: round4(a.taxaEfetiva),
        media_am: round4(a.media.am),
        media_aa: round4(a.media.aa),
        media_mes: a.media.mes,
        serie_am: a.media.serieAm,
        serie_aa: a.media.serieAa,
        razao_am: round4(a.razaoAm),
        razao_aa: round4(a.razaoAa),
        nivel: a.nivel,
        diferenca_total: round2(a.diferenca),
        pago_a_mais: round2(a.pagoAMais),
        saldo_recalculado: round2(a.saldoRecalculado),
        qtd_contratos: 1,
        total_tarifas: 0,
        valor_total_acao: round2(a.diferenca),
        dados_completos: {},
    };
}

/** Chaves de `dados_completos` que pertencem ao cálculo e são sempre regravadas a partir do input. */
const CHAVES_DADOS_DO_CALCULO = new Set(["parametros", "contratos", "tarifas", "deducoes", "pendenteCalculo"]);

/**
 * Mescla o input do cálculo com os metadados já gravados em `dados_completos` que não pertencem ao
 * cálculo (ex.: `origemDjen` com movimentações, anotações internas e status do prazo), para que
 * recalcular e salvar um caso não os apague. A marca `pendenteCalculo` é descartada: o caso passa a
 * ter cálculo.
 */
function mesclarDadosCompletos(
    input: ProcessoRevisionalInput,
    existente?: Pick<CalculoSalvo, "dados_completos"> | null,
): Partial<ProcessoRevisionalInput> {
    const anterior = (existente?.dados_completos ?? {}) as Record<string, unknown>;
    const metadados = Object.fromEntries(
        Object.entries(anterior).filter(([chave]) => !CHAVES_DADOS_DO_CALCULO.has(chave)),
    );
    return { ...metadados, ...input };
}

/**
 * Monta o payload do cálculo. Ao atualizar um registro existente, passe-o em `existente` para
 * preservar os metadados não relacionados ao cálculo guardados em `dados_completos`.
 */
export function processoParaPayload(
    resultado: ResultadoProcessoRevisional,
    input: ProcessoRevisionalInput,
    ficha: FichaCliente,
    existente?: Pick<CalculoSalvo, "dados_completos"> | null,
): CalculoPayload {
    const principal = resultado.contratos[0];
    if (!principal) {
        throw new Error("Adicione pelo menos um contrato antes de salvar.");
    }
    const base = analiseParaPayload(principal.analise, {
        ...ficha,
        banco: ficha.banco.trim() || principal.contrato.instituicao,
        documentoContrato: ficha.documentoContrato.trim() || principal.contrato.numeroContrato,
    });

    const pagoAMaisTotal = resultado.contratos.reduce((s, r) => s + r.analise.pagoAMais, 0);
    const diferencaTotalContratos = resultado.contratos.reduce((s, r) => s + r.analise.diferenca, 0);
    const saldoRecalculadoTotal = resultado.contratos.reduce((s, r) => s + r.analise.saldoRecalculado, 0);

    return {
        ...base,
        diferenca_total: round2(diferencaTotalContratos),
        pago_a_mais: round2(pagoAMaisTotal),
        saldo_recalculado: round2(saldoRecalculadoTotal),
        qtd_contratos: resultado.contratos.length,
        total_tarifas: round2(resultado.resumo.tarifasAtualizado),
        valor_total_acao: round2(resultado.resumo.valorTotalAcao),
        dados_completos: mesclarDadosCompletos(input, existente),
    };
}

export function isCalculoPendente(
    c: Pick<CalculoSalvo, "dados_completos" | "valor_financiado" | "diferenca_total">,
): boolean {
    const dc = c.dados_completos as { pendenteCalculo?: boolean } | undefined;
    if (dc?.pendenteCalculo === true) return true;
    return Number(c.valor_financiado) <= 0.01 && Number(c.diferenca_total) === 0;
}

function inferirPessoaPorNome(clienteNome: string): Pessoa {
    const norm = clienteNome
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();
    return /(?:^|\b)(?:LTDA|S\.A\.?|S\/A|ME|EPP|EIRELI|ASSOCIACAO|COOPERATIVA|COMERCIO|TRANSPORTADORA|DISTRIBUIDORA|FRUTICULTURA)(?:\b|$)/.test(
        norm,
    )
        ? "pj"
        : "pf";
}

/**
 * Gera payload válido no Supabase para salvar uma ficha de cliente/processo na carteira
 * antes de o advogado preencher os valores financeiros do contrato (ex.: importado do DJEN).
 */
export function fichaSemCalculoParaPayload(
    ficha: FichaCliente,
    opcoes: {
        modalidadeId?: string;
        mesContrato?: string;
        valorEstimadoAcao?: number;
        origemDjen?: Record<string, unknown>;
    } = {},
): CalculoPayload {
    const clienteNome = ficha.clienteNome.trim().slice(0, 160);
    if (!clienteNome) {
        throw new Error("Informe o nome do cliente antes de salvar na carteira.");
    }

    const pessoaInferida = inferirPessoaPorNome(clienteNome);
    const contextoTexto = `${ficha.documentoContrato} ${ficha.observacoes}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

    let mod = opcoes.modalidadeId
        ? MODALIDADES.find((m) => m.id === opcoes.modalidadeId)
        : undefined;

    if (!mod) {
        // Sem \b final: "apreens" segue com "ao" e "veicul" com "o"/"os".
        if (/\b(?:busca e apreens|alienacao fiduciaria|veicul)/.test(contextoTexto)) {
            mod = MODALIDADES.find((m) => m.id === (pessoaInferida === "pj" ? "veiculo-pj" : "veiculo-pf"));
        } else {
            mod = MODALIDADES.find((m) => m.id === (pessoaInferida === "pj" ? "capital-giro-pj" : "sem-garantia"));
        }
    }

    const modFinal = mod ?? MODALIDADES[0];
    const mesHoje = hojeISO().slice(0, 7);
    const mesCand = opcoes.mesContrato?.trim() ?? "";
    const mesContrato =
        /^\d{4}-(0[1-9]|1[0-2])$/.test(mesCand) && mesCand <= mesHoje ? mesCand : mesHoje;

    const valorEstimado =
        typeof opcoes.valorEstimadoAcao === "number" &&
        Number.isFinite(opcoes.valorEstimadoAcao) &&
        opcoes.valorEstimadoAcao > 0
            ? round2(opcoes.valorEstimadoAcao)
            : 0;

    return {
        categoria_id: ficha.categoriaId || null,
        cliente_nome: clienteNome,
        processo_global: (ficha.processoGlobal ?? "").trim().slice(0, 80),
        banco: ficha.banco.trim().slice(0, 100),
        documento_contrato: ficha.documentoContrato.trim().slice(0, 80),
        observacoes: ficha.observacoes.trim().slice(0, 4000),
        pessoa: modFinal.pessoa,
        modalidade_id: modFinal.id,
        modalidade_nome: modFinal.nome,
        mes_contrato: mesContrato,
        valor_financiado: 0.01,
        valor_parcela: 0.01,
        parcelas: 1,
        pagas: 0,
        taxa_mensal_informada: null,
        taxa_anual_informada: null,
        media_mensal_manual: null,
        media_anual_manual: null,
        contrato_am: 0,
        contrato_aa: 0,
        taxa_efetiva: 0,
        media_am: 0,
        media_aa: 0,
        media_mes: mesContrato,
        serie_am: modFinal.am,
        serie_aa: modFinal.aa,
        razao_am: 1,
        razao_aa: 1,
        nivel: "media",
        diferenca_total: 0,
        pago_a_mais: 0,
        saldo_recalculado: 0,
        qtd_contratos: 1,
        total_tarifas: 0,
        valor_total_acao: valorEstimado,
        dados_completos: {
            pendenteCalculo: true,
            ...(opcoes.origemDjen ? { origemDjen: opcoes.origemDjen } : {}),
        } as unknown as Partial<ProcessoRevisionalInput>,
    };
}

export function calculoParaProcesso(c: CalculoSalvo): {
    ficha: FichaCliente;
    processo: ProcessoRevisionalInput;
} {
    const ficha: FichaCliente = {
        clienteNome: c.cliente_nome,
        processoGlobal: c.processo_global ?? "",
        banco: c.banco ?? "",
        documentoContrato: c.documento_contrato ?? "",
        categoriaId: c.categoria_id,
        observacoes: c.observacoes ?? "",
    };

    const padrao = PARAMETROS_DECISAO_PADRAO();
    const dc = c.dados_completos;
    if (dc && Array.isArray(dc.contratos) && dc.contratos.length > 0) {
        return {
            ficha,
            processo: {
                parametros: { ...padrao, ...(dc.parametros ?? {}) },
                contratos: dc.contratos.map((ct, idx) => ({
                    ...ct,
                    id: ct.id || `c-${idx + 1}`,
                    pagamentosExtras: Array.isArray(ct.pagamentosExtras) ? ct.pagamentosExtras : [],
                })),
                tarifas: Array.isArray(dc.tarifas) ? dc.tarifas : [],
                deducoes: Array.isArray(dc.deducoes) ? dc.deducoes : [],
            },
        };
    }

    if (isCalculoPendente(c)) {
        const dataContrato = `${c.mes_contrato}-10`;
        return {
            ficha,
            processo: {
                parametros: { ...padrao, ...(dc?.parametros ?? {}) },
                contratos: [
                    {
                        id: "c-1",
                        descricao: "Contrato 1",
                        instituicao: c.banco ?? "",
                        numeroContrato: c.documento_contrato ?? "",
                        pessoa: c.pessoa,
                        modalidadeId: c.modalidade_id,
                        dataContrato,
                        primeiroVencimento: primeiroVencimentoSugerido(dataContrato),
                        valorFinanciado: 0,
                        valorParcela: 0,
                        parcelas: 0,
                        pagas: 0,
                        fonteTaxaRevisional: "media_sgs",
                        bancoOlinda: null,
                        pagamentosExtras: [],
                    },
                ],
                tarifas: Array.isArray(dc?.tarifas) ? dc.tarifas : [],
                deducoes: Array.isArray(dc?.deducoes) ? dc.deducoes : [],
            },
        };
    }

    // Retrocompatibilidade para registros antigos sem dados_completos
    const dataContrato = `${c.mes_contrato}-10`;
    const contratoLegado: ContratoInput = {
        id: "c-1",
        descricao: "Contrato 1",
        instituicao: c.banco ?? "",
        numeroContrato: c.documento_contrato ?? "",
        pessoa: c.pessoa,
        modalidadeId: c.modalidade_id,
        dataContrato,
        primeiroVencimento: primeiroVencimentoSugerido(dataContrato),
        valorFinanciado: Number(c.valor_financiado),
        valorParcela: Number(c.valor_parcela),
        parcelas: c.parcelas,
        pagas: c.pagas,
        taxaMensal: c.taxa_mensal_informada ?? undefined,
        taxaAnual: c.taxa_anual_informada ?? undefined,
        fonteTaxaRevisional:
            c.media_mensal_manual != null || c.media_anual_manual != null ? "manual" : "media_sgs",
        taxaRevisionalManualAm: c.media_mensal_manual ?? undefined,
        taxaRevisionalManualAa: c.media_anual_manual ?? undefined,
        bancoOlinda: null,
        pagamentosExtras: [],
    };

    return {
        ficha,
        processo: {
            parametros: padrao,
            contratos: [contratoLegado],
            tarifas: [],
            deducoes: [],
        },
    };
}

export function montarTextoPeticaoPro(
    res: ResultadoProcessoRevisional,
    ficha: FichaCliente,
    categoria?: Categoria | null,
): string {
    const linhas: string[] = [];
    if (ficha.clienteNome.trim()) linhas.push(`Cliente / Autor(a): ${ficha.clienteNome.trim()}`);
    if (ficha.processoGlobal?.trim()) linhas.push(`Processo nº: ${ficha.processoGlobal.trim()}`);
    if (categoria) linhas.push(`Categoria: ${categoria.nome}`);

    const indiceLabel =
        res.parametros.tipoJuros === "SELIC"
            ? "SELIC (englobando correção + juros)"
            : (INDICES_CORRECAO_OPCOES.find((o) => o.id === res.parametros.indiceCorrecao)?.label ?? "");
    const jurosLabel =
        res.parametros.tipoJuros === "FIXO_CUSTOM"
            ? `${num(res.parametros.jurosFixoMensal)}% a.m.`
            : (TIPOS_JUROS_OPCOES.find((o) => o.id === res.parametros.tipoJuros)?.label ?? "");

    linhas.push(`Atualização até ${res.parametros.dataBaseAtualizacao}: ${indiceLabel} | Juros: ${jurosLabel}`);

    const blocosContratos = res.contratos.map((rc, idx) => {
        const analiseTexto: Analise =
            rc.contrato.fonteTaxaRevisional === "banco_olinda"
                ? { ...rc.analise, media: { ...rc.analise.media, nota: "" } }
                : rc.analise;
        const cab = [
            `--- Contrato ${idx + 1}: ${rc.contrato.descricao || rc.analise.entrada.mod.nome} ---`,
            rc.contrato.instituicao ? `Instituição financeira: ${rc.contrato.instituicao}` : "",
            rc.contrato.numeroContrato ? `Nº contrato: ${rc.contrato.numeroContrato}` : "",
            `Paradigma: ${rc.fonteTaxaRotulo}`,
            resumo(analiseTexto),
            `Diferença nas pagas atualizada: ${brl(rc.totalAtualizadoParcelas)}${rc.extrasAtualizado > 0 ? ` | Extras: ${brl(rc.extrasAtualizado)}` : ""}`,
        ]
            .filter(Boolean)
            .join("\n");
        return cab;
    });

    const partes = [linhas.join("\n"), ...blocosContratos];

    if (res.tarifas.length > 0) {
        const tarLines = res.tarifas.map(
            (t) =>
                `- ${t.titulo}: ${brl(t.valorOriginal)} (${t.item.emDobro ? "em dobro" : "simples"}) -> atualizado: ${brl(t.total)}`,
        );
        partes.push(["Seguros e Tarifas Abusivas:", ...tarLines].join("\n"));
    }

    const r = res.resumo;
    partes.push(
        [
            "Resumo Global da Ação:",
            `Total líquido a restituir / compensar: ${brl(r.totalRestituicaoAtualizado)}`,
            r.economiaVincendasTotal > 0 ? `Economia nas parcelas vincendas: ${brl(r.economiaVincendasTotal)}` : "",
            `Proveito econômico / Valor total da ação: ${brl(r.valorTotalAcao)}`,
        ]
            .filter(Boolean)
            .join("\n"),
    );

    if (ficha.observacoes.trim()) {
        partes.push(`Observações: ${ficha.observacoes.trim()}`);
    }

    return partes.join("\n\n");
}

export interface OpcoesRenovacaoCalculo {
    novaDataBase?: string;
    fichaPatch?: Partial<FichaCliente>;
    observacoesAdicionais?: string;
    parametrosPatch?: Partial<ParametrosDecisao>;
    pagasContratoPrincipal?: number;
    novosContratos?: ContratoInput[];
    novasTarifas?: TarifaItem[];
    novasDeducoes?: DeducaoItem[];
}

export interface ResultadoRenovacaoCalculo {
    ficha: FichaCliente;
    processo: ProcessoRevisionalInput;
    resultado: ResultadoProcessoRevisional;
    payload: CalculoPayload;
    dataBaseAnterior: string;
    dataBaseNova: string;
    valorAnterior: number;
    valorNovo: number;
    diferencaGanho: number;
}

/**
 * Recalcula um caso salvo atualizando a data-base monetária (padrão: hoje) e aplicando
 * eventuais acréscimos (novos contratos, tarifas, alvarás, nº CNJ, parcelas pagas).
 */
export async function prepararRenovacaoCalculo(
    c: CalculoSalvo,
    opcoes: OpcoesRenovacaoCalculo = {},
): Promise<ResultadoRenovacaoCalculo> {
    const pendente = isCalculoPendente(c);
    if (pendente && !opcoes.novosContratos?.length) {
        throw new Error(
            "Este processo foi salvo sem dados do contrato. Abra o caso na calculadora e preencha o contrato para calcular e gerar o laudo.",
        );
    }
    const { ficha: fichaBase, processo: procBase } = calculoParaProcesso(c);
    const dataBaseAnterior = procBase.parametros.dataBaseAtualizacao || c.updated_at.slice(0, 10);
    const dataBaseNova = opcoes.novaDataBase || hojeISO();

    const obsBase = (opcoes.fichaPatch?.observacoes ?? fichaBase.observacoes).trim();
    const obsExtra = (opcoes.observacoesAdicionais ?? "").trim();
    const observacoes = obsBase && obsExtra ? `${obsBase}\n${obsExtra}` : obsBase || obsExtra;

    const ficha: FichaCliente = {
        ...fichaBase,
        ...(opcoes.fichaPatch ?? {}),
        observacoes,
    };

    // Ficha pendente (ex.: salva pelo DJEN) só traz um contrato-placeholder zerado: os novos contratos
    // o substituem. Se fossem anexados depois dele, o placeholder viraria o contrato principal do laudo.
    const contratosBase = pendente ? [] : procBase.contratos;
    const contratos = [...contratosBase, ...(opcoes.novosContratos ?? [])].map((ct, idx) => {
        if (idx === 0 && opcoes.pagasContratoPrincipal !== undefined) {
            const pagasClamped = Math.max(0, Math.min(ct.parcelas, Math.round(opcoes.pagasContratoPrincipal)));
            const gradeIncompativel =
                ct.gradePersonalizada &&
                (ct.gradePersonalizada.length !== ct.parcelas ||
                    ct.gradePersonalizada.filter((row) => row.paga).length !== pagasClamped);
            return {
                ...ct,
                pagas: pagasClamped,
                gradePersonalizada: gradeIncompativel ? undefined : ct.gradePersonalizada,
            };
        }
        return ct;
    });

    const processo: ProcessoRevisionalInput = {
        parametros: {
            ...procBase.parametros,
            ...(opcoes.parametrosPatch ?? {}),
            dataBaseAtualizacao: dataBaseNova,
        },
        contratos,
        tarifas: [...procBase.tarifas, ...(opcoes.novasTarifas ?? [])],
        deducoes: [...procBase.deducoes, ...(opcoes.novasDeducoes ?? [])],
    };

    const { onlineByContrato, seriesEconomicas } = await prepararDadosBacenProcesso(processo);
    const resultado = calcularProcessoRevisional(processo, seriesEconomicas, onlineByContrato);
    const payload = processoParaPayload(resultado, processo, ficha, c);

    const valorAnterior = Number(c.valor_total_acao) || Number(c.diferenca_total) || 0;
    const valorNovo = payload.valor_total_acao;
    const diferencaGanho = round2(valorNovo - valorAnterior);

    return {
        ficha,
        processo,
        resultado,
        payload,
        dataBaseAnterior,
        dataBaseNova,
        valorAnterior,
        valorNovo,
        diferencaGanho,
    };
}

/**
 * Executa a renovação de um cálculo salvo buscando os índices do BACEN até a data-base
 * e persiste imediatamente o resultado atualizado no Supabase.
 */
export async function renovarCalculoSalvo(
    c: CalculoSalvo,
    opcoes: OpcoesRenovacaoCalculo = {},
): Promise<ResultadoRenovacaoCalculo & { atualizado: CalculoSalvo }> {
    const prep = await prepararRenovacaoCalculo(c, opcoes);
    const atualizado = await atualizarCalculo(c.id, prep.payload);
    return {
        ...prep,
        atualizado,
    };
}

export interface FormularioRestaurado {
    pessoa: Pessoa;
    mod: Modalidade | null;
    mes: string;
    ano: string;
    valorF: string;
    parcela: string;
    parcelas: string;
    pagas: string;
    taxaM: string;
    taxaA: string;
    mediaM: string;
    mediaA: string;
    ficha: FichaCliente;
}

export function calculoParaFormulario(c: CalculoSalvo): FormularioRestaurado {
    const [ano = "", mes = ""] = c.mes_contrato.split("-");
    const mod = MODALIDADES.find((m) => m.id === c.modalidade_id) ?? null;
    return {
        pessoa: c.pessoa,
        mod,
        mes,
        ano,
        valorF: num(Number(c.valor_financiado)),
        parcela: num(Number(c.valor_parcela)),
        parcelas: String(c.parcelas),
        pagas: String(c.pagas),
        taxaM: c.taxa_mensal_informada != null ? num(Number(c.taxa_mensal_informada)) : "",
        taxaA: c.taxa_anual_informada != null ? num(Number(c.taxa_anual_informada)) : "",
        mediaM: c.media_mensal_manual != null ? num(Number(c.media_mensal_manual)) : "",
        mediaA: c.media_anual_manual != null ? num(Number(c.media_anual_manual)) : "",
        ficha: {
            clienteNome: c.cliente_nome,
            processoGlobal: c.processo_global ?? "",
            banco: c.banco ?? "",
            documentoContrato: c.documento_contrato ?? "",
            categoriaId: c.categoria_id,
            observacoes: c.observacoes ?? "",
        },
    };
}

/* ----------------------------------------------------- Sessão / GoTrue Auth */

interface BrowserEnv {
    localStorage: {
        getItem(key: string): string | null;
        setItem(key: string, value: string): void;
        removeItem(key: string): void;
    };
    location: {
        hash: string;
        pathname: string;
        search: string;
        origin: string;
    };
    history: {
        replaceState(data: unknown, unused: string, url?: string | null): void;
    };
}

function getBrowser(): BrowserEnv | null {
    const g = globalThis as unknown as { window?: BrowserEnv };
    return g.window ?? null;
}

function readStoredSession(): RevisionalSession | null {
    const win = getBrowser();
    if (!win) return null;
    try {
        const raw = win.localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as RevisionalSession;
        if (!parsed?.accessToken || !parsed?.refreshToken || !parsed?.user?.email) return null;
        return parsed;
    } catch {
        return null;
    }
}

function writeStoredSession(session: RevisionalSession | null) {
    const win = getBrowser();
    if (!win) return;
    if (!session) {
        win.localStorage.removeItem(SESSION_KEY);
    } else {
        win.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
}

interface GoTrueTokenResponse {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user: { id: string; email?: string };
}

function mapTokenResponse(data: GoTrueTokenResponse): RevisionalSession {
    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
        user: {
            id: data.user.id,
            email: data.user.email ?? "",
        },
    };
}

function traduzirErroAuth(status: number, msg: string): string {
    const lower = msg.toLowerCase();
    if (lower.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
    if (lower.includes("signups not allowed")) return "Cadastro público desativado. Solicite acesso ao administrador.";
    if (status === 429 || lower.includes("rate limit") || lower.includes("security purposes")) {
        return "Muitas solicitações seguidas. Aguarde um minuto e tente novamente.";
    }
    if (lower.includes("password should be at least")) return "A senha precisa ter pelo menos 6 caracteres.";
    return "Não foi possível autenticar agora. Tente novamente.";
}

/** Verifica se a URL veio de um link de redefinição de senha (#access_token=...&type=recovery). */
export async function consumirHashRecuperacao(): Promise<{ session: RevisionalSession; recovery: boolean } | null> {
    const win = getBrowser();
    if (!win || !win.location.hash.includes("access_token=")) return null;
    const params = new URLSearchParams(win.location.hash.replace(/^#/, ""));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const expiresIn = Number(params.get("expires_in") || "3600");
    const type = params.get("type");
    win.history.replaceState(null, "", win.location.pathname + win.location.search);

    if (!accessToken || !refreshToken) return null;

    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${accessToken}`,
        },
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { id: string; email?: string };
    const session: RevisionalSession = {
        accessToken,
        refreshToken,
        expiresAt: Date.now() + expiresIn * 1000,
        user: { id: user.id, email: user.email ?? "" },
    };
    writeStoredSession(session);
    return { session, recovery: type === "recovery" };
}

export async function entrarComSenha(email: string, password: string): Promise<RevisionalSession> {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
            apikey: SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim(), password }),
    });

    const body = (await res.json().catch(() => ({}))) as Partial<GoTrueTokenResponse> & {
        msg?: string;
        error_description?: string;
        message?: string;
    };

    if (!res.ok || !body.access_token || !body.refresh_token || !body.user) {
        const rawMsg = body.error_description || body.msg || body.message || "";
        throw new RevisionalApiError(traduzirErroAuth(res.status, rawMsg), res.status);
    }

    const session = mapTokenResponse(body as GoTrueTokenResponse);
    writeStoredSession(session);
    return session;
}

export async function obterSessaoAtiva(): Promise<RevisionalSession | null> {
    const current = readStoredSession();
    if (!current) return null;
    if (current.expiresAt - 60_000 > Date.now()) {
        return current;
    }

    try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
            method: "POST",
            headers: {
                apikey: SUPABASE_ANON_KEY,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ refresh_token: current.refreshToken }),
        });
        if (!res.ok) {
            writeStoredSession(null);
            return null;
        }
        const refreshed = mapTokenResponse((await res.json()) as GoTrueTokenResponse);
        writeStoredSession(refreshed);
        return refreshed;
    } catch {
        return current;
    }
}

export async function sairDaSessao(): Promise<void> {
    const current = readStoredSession();
    writeStoredSession(null);
    if (!current) return;
    try {
        await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
            method: "POST",
            headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${current.accessToken}`,
            },
        });
    } catch {
        /* token local já removido */
    }
}

export async function solicitarRecuperacaoSenha(email: string): Promise<void> {
    const win = getBrowser();
    const redirectTo = win
        ? `${win.location.origin}/ferramentas/calculadora-revisional`
        : "https://www.iangranja.adv.br/ferramentas/calculadora-revisional";

    const res = await fetch(`${SUPABASE_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
        method: "POST",
        headers: {
            apikey: SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim() }),
    });

    if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { msg?: string; message?: string };
        throw new RevisionalApiError(traduzirErroAuth(res.status, body.msg || body.message || ""), res.status);
    }
}

export async function alterarSenha(novaSenha: string): Promise<void> {
    if (novaSenha.length < 8) {
        throw new Error("Escolha uma senha com pelo menos 8 caracteres.");
    }
    const session = await obterSessaoAtiva();
    if (!session) throw new RevisionalApiError("Sessão expirada. Entre novamente.", 401);

    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: "PUT",
        headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${session.accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: novaSenha }),
    });

    if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { msg?: string; message?: string };
        throw new RevisionalApiError(traduzirErroAuth(res.status, body.msg || body.message || ""), res.status);
    }
}

/* ----------------------------------------------------- PostgREST Data Layer */

async function restRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
    const session = await obterSessaoAtiva();
    if (!session) {
        throw new RevisionalApiError("Sua sessão expirou. Entre novamente.", 401);
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        ...init,
        headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${session.accessToken}`,
            "Content-Type": "application/json",
            ...(init.headers ?? {}),
        },
    });

    if (res.status === 401) {
        writeStoredSession(null);
        throw new RevisionalApiError("Sessão expirada. Entre novamente.", 401);
    }

    if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
        if (errBody.code === "23505") {
            throw new RevisionalApiError("Já existe uma categoria com este nome.", 409);
        }
        if (res.status === 403 || errBody.code === "42501") {
            throw new RevisionalApiError("Esta conta não tem permissão para acessar o histórico do escritório.", 403);
        }
        throw new RevisionalApiError(errBody.message || "Erro ao comunicar com o banco de dados.", res.status);
    }

    if (res.status === 204) return undefined as T;
    const raw: unknown = await res.json();
    return normalizeNumericRow(raw) as T;
}

const NUMERIC_CALCULO_KEYS = new Set([
    "valor_financiado",
    "valor_parcela",
    "taxa_mensal_informada",
    "taxa_anual_informada",
    "media_mensal_manual",
    "media_anual_manual",
    "contrato_am",
    "contrato_aa",
    "taxa_efetiva",
    "media_am",
    "media_aa",
    "razao_am",
    "razao_aa",
    "diferenca_total",
    "pago_a_mais",
    "saldo_recalculado",
    "total_tarifas",
    "valor_total_acao",
]);

export function normalizeNumericRow(input: unknown): unknown {
    if (Array.isArray(input)) return input.map(normalizeNumericRow);
    if (!input || typeof input !== "object") return input;
    const obj = { ...(input as Record<string, unknown>) };
    for (const key of NUMERIC_CALCULO_KEYS) {
        if (key in obj && obj[key] != null) {
            obj[key] = Number(obj[key]);
        }
    }
    return obj;
}

export async function listarCategorias(): Promise<Categoria[]> {
    return restRequest<Categoria[]>("revisional_categorias?select=*&order=ordem.asc,nome.asc");
}

export async function criarCategoria(nome: string, cor: CategoriaCor = "gold", ordem = 10): Promise<Categoria> {
    const rows = await restRequest<Categoria[]>("revisional_categorias", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ nome: nome.trim(), cor, ordem }),
    });
    return rows[0];
}

export async function atualizarCategoria(
    id: string,
    patch: Partial<Pick<Categoria, "nome" | "cor" | "ordem">>,
): Promise<Categoria> {
    const rows = await restRequest<Categoria[]>(`revisional_categorias?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(patch),
    });
    return rows[0];
}

export async function excluirCategoria(id: string): Promise<void> {
    await restRequest<void>(`revisional_categorias?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
    });
}

export async function listarCalculos(): Promise<CalculoSalvo[]> {
    return restRequest<CalculoSalvo[]>("revisional_calculos?select=*&order=updated_at.desc");
}

export async function criarCalculo(payload: CalculoPayload): Promise<CalculoSalvo> {
    const rows = await restRequest<CalculoSalvo[]>("revisional_calculos", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload),
    });
    return rows[0];
}

export async function atualizarCalculo(id: string, payload: Partial<CalculoPayload>): Promise<CalculoSalvo> {
    const rows = await restRequest<CalculoSalvo[]>(`revisional_calculos?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload),
    });
    return rows[0];
}

export async function excluirCalculo(id: string): Promise<void> {
    await restRequest<void>(`revisional_calculos?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
    });
}
