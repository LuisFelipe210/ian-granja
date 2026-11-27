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
import { normalizarConfigPagina, sanitizarHtmlDocumento, type ConfigPagina } from "./documentos.ts";
import { cnpjValido, cpfValido } from "./clientes.ts";
import {
    normalizarItemConhecimento,
    sanitizarItemConhecimento,
    type ItemConhecimento,
    type ItemConhecimentoPayload,
} from "./atendimento/base-conhecimento.ts";
import type { ConversaRow, MensagemRow } from "./atendimento/processar-whatsapp.ts";
import {
    configEscritorioAtual,
    configParaLinha,
    normalizarConfigEscritorio,
    sanitizarAssinaturaImagemUrl,
    sanitizarTimbradoImagemUrl,
    type ConfigEscritorio,
} from "./config-escritorio.ts";

const DEFAULT_SUPABASE_URL = "https://smeaktuuuxahmbzpjwqa.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtZWFrdHV1dXhhaG1ienBqd3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1MDkwNDYsImV4cCI6MjExMDA4NTA0Nn0.w9BajnZKcF3wgzCxxK45QfZAzayKNCYK_ynqyG17Rb4";

const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
export const SUPABASE_URL = metaEnv?.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
export const SUPABASE_ANON_KEY = metaEnv?.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
/** Supabase local: loopback ou IP da rede interna (ao abrir o dev server em outro PC do mesmo Wi-Fi). */
export const IS_LOCAL_SUPABASE =
    /^https?:\/\/(127\.0\.0\.1|localhost|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?(\/|$)/.test(
        SUPABASE_URL,
    );

const SESSION_KEY = IS_LOCAL_SUPABASE ? "ig_revisional_session_local_v1" : "ig_revisional_session_v1";

export type CategoriaCor = "gold" | "ink" | "crimson" | "emerald" | "slate";

/**
 * FASE do caso (etapa no fluxo: Triagem, Em análise, Ajuizado, Acordo / Concluído).
 * O nome "Categoria" e a tabela revisional_categorias ficaram por compatibilidade.
 */
export interface Categoria {
    id: string;
    nome: string;
    cor: CategoriaCor;
    ordem: number;
    created_at: string;
}

/** CATEGORIA do caso no sentido de tipo da ação (Revisional, Busca e Apreensão...). Tabela revisional_tipos. */
export type TipoAcao = Categoria;

export interface FichaCliente {
    clienteNome: string;
    processoGlobal?: string;
    banco: string;
    documentoContrato: string;
    categoriaId: string | null;
    /** Categoria (tipo da ação). Indefinido = não mexe na categoria ao salvar. */
    tipoId?: string | null;
    observacoes: string;
}

export interface CalculoSalvo {
    id: string;
    /** Fase do caso (revisional_categorias). */
    categoria_id: string | null;
    /** Categoria / tipo da ação (revisional_tipos). Ausente em bancos sem a migração 20261119120000. */
    tipo_id?: string | null;
    /** Cliente cadastrado (revisional_clientes). Ligado automaticamente pelo nome no banco. */
    cliente_id?: string | null;
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
    code?: string;
    constructor(message: string, status: number, code?: string) {
        super(message);
        this.name = "RevisionalApiError";
        this.status = status;
        this.code = code;
    }
}

export function isTabelaTarefasAusente(err: unknown): boolean {
    if (!(err instanceof RevisionalApiError)) return false;
    return (
        err.code === "42P01" ||
        err.code === "PGRST205" ||
        err.code === "TABELA_AUSENTE" ||
        err.status === 404
    );
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
        ...(ficha.tipoId !== undefined ? { tipo_id: ficha.tipoId || null } : {}),
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
        ...(ficha.tipoId !== undefined ? { tipo_id: ficha.tipoId || null } : {}),
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
        tipoId: c.tipo_id ?? null,
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
            tipoId: c.tipo_id ?? null,
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
    try {
        if (!session) {
            win.localStorage.removeItem(SESSION_KEY);
        } else {
            win.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        }
    } catch {
        /* modo privado / quota excedida */
    }
}

interface GoTrueTokenResponse {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user: { id: string; email?: string };
}

function mapTokenResponse(data: GoTrueTokenResponse): RevisionalSession {
    const expiresInSec = Number(data.expires_in);
    const ttlMs = Number.isFinite(expiresInSec) && expiresInSec > 0 ? expiresInSec * 1000 : 3600 * 1000;
    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + ttlMs,
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
    const rawExpires = Number(params.get("expires_in") || "3600");
    const expiresIn = Number.isFinite(rawExpires) && rawExpires > 0 ? rawExpires : 3600;
    const type = params.get("type");
    win.history.replaceState(null, "", win.location.pathname + win.location.search);

    if (!accessToken || !refreshToken) return null;

    try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            signal: AbortSignal.timeout(10_000),
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
    } catch {
        return null;
    }
}

export async function entrarComSenha(email: string, password: string): Promise<RevisionalSession> {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
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

/** Deduplica chamadas concorrentes de refresh para evitar revogação por GoTrue Refresh Token Rotation. */
let refreshEmAndamento: Promise<RevisionalSession | null> | null = null;

export async function obterSessaoAtiva(forcarRefresh = false): Promise<RevisionalSession | null> {
    const current = readStoredSession();
    if (!current) return null;
    if (!forcarRefresh && current.expiresAt - 60_000 > Date.now()) {
        return current;
    }

    if (refreshEmAndamento) return refreshEmAndamento;

    refreshEmAndamento = (async () => {
        // Releitura após aguardar microtask (outra aba pode já ter renovado).
        const maisRecente = readStoredSession();
        if (!maisRecente) return null;
        if (!forcarRefresh && maisRecente.expiresAt - 60_000 > Date.now()) {
            return maisRecente;
        }
        try {
            const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
                method: "POST",
                signal: AbortSignal.timeout(12_000),
                headers: {
                    apikey: SUPABASE_ANON_KEY,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ refresh_token: maisRecente.refreshToken }),
            });
            if (!res.ok) {
                if (res.status === 400 || res.status === 401) {
                    // Só limpa se outra aba não tiver acabado de gravar um token mais novo.
                    const depois = readStoredSession();
                    if (!depois || depois.refreshToken === maisRecente.refreshToken) {
                        writeStoredSession(null);
                    } else {
                        return depois;
                    }
                }
                return null;
            }
            const refreshed = mapTokenResponse((await res.json()) as GoTrueTokenResponse);
            writeStoredSession(refreshed);
            return refreshed;
        } catch {
            return forcarRefresh ? null : maisRecente;
        }
    })().finally(() => {
        refreshEmAndamento = null;
    });

    return refreshEmAndamento;
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

function firstOrThrow<T>(rows: T[] | undefined, mensagem = "Registro não encontrado ou já removido."): T {
    if (!rows || rows.length === 0) {
        throw new RevisionalApiError(mensagem, 404);
    }
    return rows[0];
}

async function restRequest<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
    const session = await obterSessaoAtiva(retried);
    if (!session) {
        throw new RevisionalApiError("Sua sessão expirou. Entre novamente.", 401);
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        ...init,
        signal: init.signal ?? AbortSignal.timeout(20_000),
        headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${session.accessToken}`,
            "Content-Type": "application/json",
            ...(init.headers ?? {}),
        },
    });

    if (res.status === 401) {
        if (!retried) {
            return restRequest<T>(path, init, true);
        }
        writeStoredSession(null);
        throw new RevisionalApiError("Sessão expirada. Entre novamente.", 401);
    }

    if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
        if (errBody.code === "23505") {
            const msgDuplicado = path.startsWith("revisional_clientes")
                ? "Já existe um cliente com este CPF/CNPJ."
                : path.startsWith("revisional_tipos")
                  ? "Já existe um tipo de ação com este nome."
                  : path.startsWith("revisional_categorias")
                    ? "Já existe uma fase com este nome."
                    : "Já existe um registro com estes dados.";
            throw new RevisionalApiError(msgDuplicado, 409, errBody.code);
        }
        if (res.status === 403 || errBody.code === "42501") {
            throw new RevisionalApiError(
                "Esta conta não tem permissão para acessar o histórico do escritório.",
                403,
                errBody.code,
            );
        }
        if (
            path.startsWith("revisional_tarefas") &&
            (res.status === 404 || errBody.code === "42P01" || errBody.code === "PGRST205")
        ) {
            throw new RevisionalApiError(
                "A agenda precisa da migração do banco.",
                res.status,
                errBody.code || "TABELA_AUSENTE",
            );
        }
        if (
            path.startsWith("revisional_atendimento_") &&
            (res.status === 404 || errBody.code === "42P01" || errBody.code === "PGRST205")
        ) {
            throw new RevisionalApiError(
                "O atendimento pelo WhatsApp precisa da migração do banco (20261127130000).",
                res.status,
                errBody.code || "TABELA_AUSENTE",
            );
        }
        if (path.startsWith("revisional_cliente_conhecimento") && errBody.code === "23514") {
            throw new RevisionalApiError(
                "Este item ficou grande demais para a base do atendimento. Remova alguns fatos ou encurte o resumo e salve de novo.",
                400,
                errBody.code,
            );
        }
        if (
            path.startsWith("revisional_cliente_conhecimento") &&
            (res.status === 404 || errBody.code === "42P01" || errBody.code === "PGRST205")
        ) {
            throw new RevisionalApiError(
                "A base do atendimento por IA precisa da migração do banco.",
                res.status,
                errBody.code || "TABELA_AUSENTE",
            );
        }
        if (
            (path.startsWith("revisional_modelos") ||
                path.startsWith("revisional_documentos") ||
                path.startsWith("revisional_clientes") ||
                path.startsWith("revisional_configuracoes")) &&
            (res.status === 404 || errBody.code === "42P01" || errBody.code === "PGRST205")
        ) {
            throw new RevisionalApiError(
                path.startsWith("revisional_clientes")
                    ? "O cadastro de clientes precisa da migração do banco."
                    : path.startsWith("revisional_configuracoes")
                      ? "As configurações do escritório precisam da migração do banco."
                      : "Os documentos precisam da migração do banco.",
                res.status,
                errBody.code || "TABELA_AUSENTE",
            );
        }
        throw new RevisionalApiError(
            errBody.message || "Erro ao comunicar com o banco de dados.",
            res.status,
            errBody.code,
        );
    }

    if (res.status === 204) return undefined as T;
    // POST com "return=minimal" responde 201 sem corpo.
    const texto = await res.text();
    if (!texto) return undefined as T;
    const raw: unknown = JSON.parse(texto);
    return (path.startsWith("revisional_calculos") ? normalizeNumericRow(raw) : raw) as T;
}

const TAMANHO_PAGINA_POSTGREST = 1000;
const MAX_PAGINAS_LISTAGEM = 20;

/**
 * Lê todas as páginas de uma tabela PostgREST sem truncamento silencioso em 1.000 linhas.
 */
async function restRequestList<T>(path: string): Promise<T[]> {
    const acumulado: T[] = [];
    for (let pagina = 0; pagina < MAX_PAGINAS_LISTAGEM; pagina++) {
        const inicio = pagina * TAMANHO_PAGINA_POSTGREST;
        const fim = inicio + TAMANHO_PAGINA_POSTGREST - 1;
        const lote = await restRequest<T[]>(path, {
            headers: {
                "Range-Unit": "items",
                Range: `${inicio}-${fim}`,
            },
        });
        acumulado.push(...lote);
        if (lote.length < TAMANHO_PAGINA_POSTGREST) break;
    }
    return acumulado;
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
    return restRequestList<Categoria>("revisional_categorias?select=*&order=ordem.asc,nome.asc");
}

export async function criarCategoria(nome: string, cor: CategoriaCor = "gold", ordem = 10): Promise<Categoria> {
    const rows = await restRequest<Categoria[]>("revisional_categorias", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ nome: nome.trim(), cor, ordem }),
    });
    return firstOrThrow(rows);
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
    return firstOrThrow(rows);
}

export async function excluirCategoria(id: string): Promise<void> {
    await restRequest<void>(`revisional_categorias?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
    });
}

export async function listarTipos(): Promise<TipoAcao[]> {
    return restRequestList<TipoAcao>("revisional_tipos?select=*&order=ordem.asc,nome.asc");
}

export async function criarTipo(nome: string, cor: CategoriaCor = "ink", ordem = 10): Promise<TipoAcao> {
    const rows = await restRequest<TipoAcao[]>("revisional_tipos", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ nome: nome.trim(), cor, ordem }),
    });
    return firstOrThrow(rows);
}

export async function atualizarTipo(
    id: string,
    patch: Partial<Pick<TipoAcao, "nome" | "cor" | "ordem">>,
): Promise<TipoAcao> {
    const rows = await restRequest<TipoAcao[]>(`revisional_tipos?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(patch),
    });
    return firstOrThrow(rows);
}

export async function excluirTipo(id: string): Promise<void> {
    await restRequest<void>(`revisional_tipos?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
    });
}

/** Já existe registro com este número de processo (exatamente como gravado)? Só leitura. */
export async function existeCalculoComProcesso(processoGlobal: string): Promise<boolean> {
    const numero = processoGlobal.trim();
    if (!numero) return false;
    const rows = await restRequest<Array<{ id: string }>>(
        `revisional_calculos?select=id&processo_global=eq.${encodeURIComponent(numero)}&limit=1`,
    );
    return rows.length > 0;
}

export async function listarCalculos(): Promise<CalculoSalvo[]> {
    return restRequestList<CalculoSalvo>("revisional_calculos?select=*&order=updated_at.desc");
}

export async function criarCalculo(payload: CalculoPayload): Promise<CalculoSalvo> {
    const rows = await restRequest<CalculoSalvo[]>("revisional_calculos", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload),
    });
    return firstOrThrow(rows);
}

export async function atualizarCalculo(id: string, payload: Partial<CalculoPayload>): Promise<CalculoSalvo> {
    const rows = await restRequest<CalculoSalvo[]>(`revisional_calculos?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload),
    });
    return firstOrThrow(rows, "Caso não encontrado ou já removido.");
}

export async function excluirCalculo(id: string): Promise<void> {
    await restRequest<void>(`revisional_calculos?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
    });
}

/* ----------------------------------------------------- Agenda / Tarefas */

export type TipoTarefa = "tarefa" | "prazo" | "audiencia" | "reuniao";

export interface Tarefa {
    id: string;
    titulo: string;
    tipo: TipoTarefa;
    data: string;
    hora: string | null;
    calculo_id: string | null;
    concluida: boolean;
    observacoes: string;
    created_by_email: string;
    created_at: string;
    updated_at: string;
}

export type TarefaPayload = Pick<
    Tarefa,
    "titulo" | "tipo" | "data" | "hora" | "calculo_id" | "concluida" | "observacoes"
>;

const TIPOS_TAREFA_VALIDOS = new Set<TipoTarefa>(["tarefa", "prazo", "audiencia", "reuniao"]);

function normalizarHoraTarefa(horaRaw: unknown): string | null {
    if (typeof horaRaw !== "string") return null;
    const limpo = horaRaw.trim();
    if (!limpo) return null;
    const match = limpo.match(/^(\d{2}:\d{2})/);
    return match ? match[1] : null;
}

export function normalizarTarefaRow(raw: Record<string, unknown>): Tarefa {
    const tipoRaw = String(raw.tipo ?? "tarefa").trim().toLowerCase() as TipoTarefa;
    const tipo: TipoTarefa = TIPOS_TAREFA_VALIDOS.has(tipoRaw) ? tipoRaw : "tarefa";
    return {
        id: String(raw.id ?? ""),
        titulo: String(raw.titulo ?? "").trim(),
        tipo,
        data: String(raw.data ?? "").slice(0, 10),
        hora: normalizarHoraTarefa(raw.hora),
        calculo_id: raw.calculo_id ? String(raw.calculo_id) : null,
        concluida: Boolean(raw.concluida),
        observacoes: String(raw.observacoes ?? ""),
        created_by_email: String(raw.created_by_email ?? ""),
        created_at: String(raw.created_at ?? ""),
        updated_at: String(raw.updated_at ?? ""),
    };
}

export function sanitizarTarefaPayload(payload: Partial<TarefaPayload>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (payload.titulo !== undefined) {
        const titulo = payload.titulo.trim().slice(0, 200);
        if (!titulo) {
            throw new Error("Informe o título da tarefa ou prazo.");
        }
        out.titulo = titulo;
    }
    if (payload.tipo !== undefined) {
        out.tipo = TIPOS_TAREFA_VALIDOS.has(payload.tipo) ? payload.tipo : "tarefa";
    }
    if (payload.data !== undefined) {
        out.data = payload.data.slice(0, 10);
    }
    if (payload.hora !== undefined) {
        out.hora = normalizarHoraTarefa(payload.hora);
    }
    if (payload.calculo_id !== undefined) {
        out.calculo_id = payload.calculo_id || null;
    }
    if (payload.concluida !== undefined) {
        out.concluida = Boolean(payload.concluida);
    }
    if (payload.observacoes !== undefined) {
        out.observacoes = payload.observacoes.trim().slice(0, 2000);
    }
    return out;
}

export async function listarTarefas(): Promise<Tarefa[]> {
    const rows = await restRequestList<Record<string, unknown>>(
        "revisional_tarefas?select=*&order=data.asc,hora.asc.nullslast",
    );
    return rows.map(normalizarTarefaRow);
}

export async function criarTarefa(payload: TarefaPayload): Promise<Tarefa> {
    const body = sanitizarTarefaPayload(payload);
    const rows = await restRequest<Record<string, unknown>[]>("revisional_tarefas", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(body),
    });
    return normalizarTarefaRow(firstOrThrow(rows));
}

export async function atualizarTarefa(id: string, patch: Partial<TarefaPayload>): Promise<Tarefa> {
    const body = sanitizarTarefaPayload(patch);
    const rows = await restRequest<Record<string, unknown>[]>(
        `revisional_tarefas?id=eq.${encodeURIComponent(id)}`,
        {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify(body),
        },
    );
    return normalizarTarefaRow(firstOrThrow(rows, "Compromisso não encontrado ou já removido."));
}

export const ROTULO_TIPO_TAREFA: Record<TipoTarefa, string> = {
    prazo: "Prazo",
    audiencia: "Audiência",
    reuniao: "Reunião",
    tarefa: "Tarefa",
};

export function dataHojeLocalISO(ref: Date = new Date()): string {
    try {
        return new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Recife",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(ref);
    } catch {
        const ano = ref.getFullYear();
        const mes = String(ref.getMonth() + 1).padStart(2, "0");
        const dia = String(ref.getDate()).padStart(2, "0");
        return `${ano}-${mes}-${dia}`;
    }
}

export function somarDiasISO(dataIso: string, dias: number): string {
    const [ano, mes, dia] = dataIso.slice(0, 10).split("-").map(Number);
    const d = new Date(ano, (mes || 1) - 1, (dia || 1) + dias, 12, 0, 0);
    return dataHojeLocalISO(d);
}

export function formatarDataDiaTitulo(dataIso: string, hojeIso: string): string {
    if (dataIso === hojeIso) return `Hoje · ${dataIso.split("-").reverse().join("/")}`;
    if (dataIso === somarDiasISO(hojeIso, 1)) return `Amanhã · ${dataIso.split("-").reverse().join("/")}`;
    const [ano, mes, dia] = dataIso.split("-").map(Number);
    const d = new Date(ano, (mes || 1) - 1, dia || 1, 12, 0, 0);
    const diaSemana = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
    return `${diaSemana.charAt(0).toUpperCase()}${diaSemana.slice(1)} · ${dataIso.split("-").reverse().join("/")}`;
}

/**
 * Monta link de evento pré-preenchido no Google Agenda (zero-OAuth, gratuito).
 * Eventos sem hora usam formato dia inteiro (data fim exclusiva no dia seguinte).
 */
export function gerarUrlGoogleCalendar(
    tarefa: Pick<Tarefa, "titulo" | "tipo" | "data" | "hora" | "observacoes">,
    caso?: Pick<CalculoSalvo, "cliente_nome" | "processo_global" | "banco"> | null,
): string {
    const dataLimpa = tarefa.data.slice(0, 10);
    const dataCompacta = dataLimpa.replace(/-/g, "");
    const rotuloTipo = ROTULO_TIPO_TAREFA[tarefa.tipo] ?? "Compromisso";
    const titulo = `[${rotuloTipo}] ${tarefa.titulo}`.trim();

    let dates: string;
    const params = new URLSearchParams({
        action: "TEMPLATE",
        text: titulo,
    });

    if (tarefa.hora && /^\d{2}:\d{2}/.test(tarefa.hora)) {
        const [hh, mm] = tarefa.hora.slice(0, 5).split(":").map(Number);
        const inicio = `${dataCompacta}T${String(hh).padStart(2, "0")}${String(mm).padStart(2, "0")}00`;
        const fimTotalMin = hh * 60 + mm + 60;
        const diaFim =
            fimTotalMin >= 24 * 60
                ? somarDiasISO(dataLimpa, Math.floor(fimTotalMin / (24 * 60))).replace(/-/g, "")
                : dataCompacta;
        const hhFim = String(Math.floor((fimTotalMin % (24 * 60)) / 60)).padStart(2, "0");
        const mmFim = String(fimTotalMin % 60).padStart(2, "0");
        dates = `${inicio}/${diaFim}T${hhFim}${mmFim}00`;
        params.set("dates", dates);
        params.set("ctz", "America/Recife");
    } else {
        const diaSeguinte = somarDiasISO(dataLimpa, 1).replace(/-/g, "");
        dates = `${dataCompacta}/${diaSeguinte}`;
        params.set("dates", dates);
    }

    const linhasDetalhes: string[] = [];
    if (caso?.cliente_nome) linhasDetalhes.push(`Cliente: ${caso.cliente_nome}`);
    if (caso?.processo_global) linhasDetalhes.push(`Processo: ${caso.processo_global}`);
    if (caso?.banco) linhasDetalhes.push(`Instituição: ${caso.banco}`);
    if (tarefa.observacoes?.trim()) linhasDetalhes.push("", tarefa.observacoes.trim());
    if (linhasDetalhes.length > 0) {
        params.set("details", linhasDetalhes.join("\n"));
    }

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export async function excluirTarefa(id: string): Promise<void> {
    await restRequest<void>(`revisional_tarefas?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
    });
}

/* ----------------------------------------------------- Documentos e modelos */

export interface ModeloDocumento {
    id: string;
    nome: string;
    descricao: string;
    conteudo_html: string;
    /** Papel e margens; pode faltar em bancos sem a migração 20261120130000 (use normalizarConfigPagina). */
    pagina?: ConfigPagina;
    created_by_email: string;
    created_at: string;
    updated_at: string;
}

export interface DocumentoGerado {
    id: string;
    titulo: string;
    calculo_id: string | null;
    /** Ausente em bancos sem a migração 20261120140000. */
    cliente_id?: string | null;
    modelo_id: string | null;
    conteudo_html: string;
    pagina?: ConfigPagina;
    created_by_email: string;
    created_at: string;
    updated_at: string;
}

export type ModeloPayload = Pick<ModeloDocumento, "nome" | "descricao" | "conteudo_html" | "pagina">;
export type DocumentoPayload = Pick<
    DocumentoGerado,
    "titulo" | "calculo_id" | "cliente_id" | "modelo_id" | "conteudo_html" | "pagina"
>;

const LIMITE_HTML_DOCUMENTO = 500_000;

export function sanitizarModeloPayload(p: Partial<ModeloPayload>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (p.nome !== undefined) {
        const nome = p.nome.trim().slice(0, 160);
        if (!nome) throw new Error("Dê um nome ao modelo.");
        out.nome = nome;
    }
    if (p.descricao !== undefined) out.descricao = p.descricao.trim().slice(0, 500);
    if (p.conteudo_html !== undefined) {
        const limpo = sanitizarHtmlDocumento(p.conteudo_html);
        if (limpo.length > LIMITE_HTML_DOCUMENTO) {
            throw new Error("O modelo ficou grande demais para salvar (limite de cerca de 500 mil caracteres).");
        }
        out.conteudo_html = limpo;
    }
    if (p.pagina !== undefined) out.pagina = normalizarConfigPagina(p.pagina);
    return out;
}

export function sanitizarDocumentoPayload(p: Partial<DocumentoPayload>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (p.titulo !== undefined) {
        const titulo = p.titulo.trim().slice(0, 200);
        if (!titulo) throw new Error("Dê um título ao documento.");
        out.titulo = titulo;
    }
    if (p.calculo_id !== undefined) out.calculo_id = p.calculo_id || null;
    if (p.cliente_id !== undefined) out.cliente_id = p.cliente_id || null;
    if (p.modelo_id !== undefined) out.modelo_id = p.modelo_id || null;
    if (p.conteudo_html !== undefined) {
        const limpo = sanitizarHtmlDocumento(p.conteudo_html);
        if (limpo.length > LIMITE_HTML_DOCUMENTO) {
            throw new Error("O documento ficou grande demais para salvar (limite de cerca de 500 mil caracteres).");
        }
        out.conteudo_html = limpo;
    }
    if (p.pagina !== undefined) out.pagina = normalizarConfigPagina(p.pagina);
    return out;
}

export async function listarModelos(): Promise<ModeloDocumento[]> {
    return restRequestList<ModeloDocumento>("revisional_modelos?select=*&order=nome.asc");
}

export async function criarModelo(payload: ModeloPayload): Promise<ModeloDocumento> {
    const rows = await restRequest<ModeloDocumento[]>("revisional_modelos", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(sanitizarModeloPayload(payload)),
    });
    return firstOrThrow(rows);
}

export async function atualizarModelo(id: string, patch: Partial<ModeloPayload>): Promise<ModeloDocumento> {
    const rows = await restRequest<ModeloDocumento[]>(`revisional_modelos?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(sanitizarModeloPayload(patch)),
    });
    return firstOrThrow(rows, "Modelo não encontrado ou já removido.");
}

export async function excluirModelo(id: string): Promise<void> {
    await restRequest<void>(`revisional_modelos?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function listarDocumentos(): Promise<DocumentoGerado[]> {
    return restRequestList<DocumentoGerado>("revisional_documentos?select=*&order=updated_at.desc");
}

export async function criarDocumento(payload: DocumentoPayload): Promise<DocumentoGerado> {
    const rows = await restRequest<DocumentoGerado[]>("revisional_documentos", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(sanitizarDocumentoPayload(payload)),
    });
    return firstOrThrow(rows);
}

export async function atualizarDocumento(id: string, patch: Partial<DocumentoPayload>): Promise<DocumentoGerado> {
    const rows = await restRequest<DocumentoGerado[]>(`revisional_documentos?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(sanitizarDocumentoPayload(patch)),
    });
    return firstOrThrow(rows, "Documento não encontrado ou já removido.");
}

export async function excluirDocumento(id: string): Promise<void> {
    await restRequest<void>(`revisional_documentos?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}

/* ----------------------------------------------------- Clientes */

export type TipoPessoaCliente = "pf" | "pj";

export interface Cliente {
    id: string;
    tipo_pessoa: TipoPessoaCliente;
    nome: string;
    /** Só dígitos (11 = CPF, 14 = CNPJ) ou vazio. */
    cpf_cnpj: string;
    rg: string;
    rg_orgao: string;
    nacionalidade: string;
    /** Id de ESTADOS_CIVIS (src/lib/clientes.ts) ou vazio. */
    estado_civil: string;
    profissao: string;
    genero: "" | "m" | "f";
    data_nascimento: string | null;
    email: string;
    telefone: string;
    /** Só dígitos (8) ou vazio. */
    cep: string;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cidade: string;
    uf: string;
    representante_nome: string;
    representante_cpf: string;
    observacoes: string;
    created_by_email: string;
    created_at: string;
    updated_at: string;
}

export type ClientePayload = Omit<Cliente, "id" | "created_by_email" | "created_at" | "updated_at">;

const LIMITES_TEXTO_CLIENTE: Partial<Record<keyof ClientePayload, number>> = {
    nome: 200,
    rg: 40,
    rg_orgao: 40,
    nacionalidade: 60,
    estado_civil: 40,
    profissao: 100,
    email: 200,
    telefone: 40,
    logradouro: 200,
    numero: 20,
    complemento: 100,
    bairro: 100,
    cidade: 100,
    representante_nome: 200,
};

export function clienteEmBranco(): ClientePayload {
    return {
        tipo_pessoa: "pf",
        nome: "",
        cpf_cnpj: "",
        rg: "",
        rg_orgao: "",
        nacionalidade: "brasileiro",
        estado_civil: "",
        profissao: "",
        genero: "",
        data_nascimento: null,
        email: "",
        telefone: "",
        cep: "",
        logradouro: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        uf: "",
        representante_nome: "",
        representante_cpf: "",
        observacoes: "",
    };
}

/** Limpa e valida antes de gravar (o banco também confere formato e tamanho). */
export function sanitizarClientePayload(p: Partial<ClientePayload>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [chave, limite] of Object.entries(LIMITES_TEXTO_CLIENTE) as Array<[keyof ClientePayload, number]>) {
        const v = p[chave];
        if (v !== undefined) out[chave] = String(v ?? "").trim().replace(/\s+/g, " ").slice(0, limite);
    }
    if (p.observacoes !== undefined) out.observacoes = String(p.observacoes ?? "").trim().slice(0, 4000);
    if (p.nome !== undefined && !out.nome) throw new Error("Informe o nome do cliente.");
    if (p.tipo_pessoa !== undefined) out.tipo_pessoa = p.tipo_pessoa === "pj" ? "pj" : "pf";
    if (p.genero !== undefined) out.genero = p.genero === "m" || p.genero === "f" ? p.genero : "";
    if (p.cpf_cnpj !== undefined) {
        const d = String(p.cpf_cnpj ?? "").replace(/\D+/g, "");
        if (d && d.length !== 11 && d.length !== 14) throw new Error("CPF deve ter 11 dígitos e CNPJ, 14.");
        if (d.length === 11 && !cpfValido(d)) throw new Error("CPF inválido (confira os dígitos verificadores).");
        if (d.length === 14 && !cnpjValido(d)) throw new Error("CNPJ inválido (confira os dígitos verificadores).");
        if (out.tipo_pessoa === "pf" && d.length === 14) throw new Error("Pessoa física deve informar CPF (11 dígitos).");
        if (out.tipo_pessoa === "pj" && d.length === 11) throw new Error("Pessoa jurídica deve informar CNPJ (14 dígitos).");
        out.cpf_cnpj = d;
    }
    if (p.representante_cpf !== undefined) {
        const d = String(p.representante_cpf ?? "").replace(/\D+/g, "");
        if (d && d.length !== 11) throw new Error("O CPF do representante deve ter 11 dígitos.");
        if (d && !cpfValido(d)) throw new Error("CPF do representante inválido.");
        out.representante_cpf = d;
    }
    if (p.cep !== undefined) {
        const d = String(p.cep ?? "").replace(/\D+/g, "");
        if (d && d.length !== 8) throw new Error("O CEP deve ter 8 dígitos.");
        out.cep = d;
    }
    if (p.uf !== undefined) {
        const uf = String(p.uf ?? "").trim().toUpperCase();
        if (uf && !/^[A-Z]{2}$/.test(uf)) throw new Error("UF deve ter 2 letras (ex.: PE).");
        out.uf = uf;
    }
    if (p.data_nascimento !== undefined) {
        const d = String(p.data_nascimento ?? "").slice(0, 10);
        out.data_nascimento = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
    }
    return out;
}

function erroCliente(err: unknown): never {
    if (err instanceof RevisionalApiError && err.code === "23505") {
        throw new RevisionalApiError("Já existe um cliente com este CPF/CNPJ.", 409, err.code);
    }
    throw err;
}

export async function listarClientes(): Promise<Cliente[]> {
    return restRequestList<Cliente>("revisional_clientes?select=*&order=nome.asc");
}

export async function criarCliente(payload: Partial<ClientePayload>): Promise<Cliente> {
    try {
        const rows = await restRequest<Cliente[]>("revisional_clientes", {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify(sanitizarClientePayload(payload)),
        });
        return firstOrThrow(rows);
    } catch (err) {
        return erroCliente(err);
    }
}

export async function atualizarCliente(id: string, patch: Partial<ClientePayload>): Promise<Cliente> {
    try {
        const rows = await restRequest<Cliente[]>(`revisional_clientes?id=eq.${encodeURIComponent(id)}`, {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify(sanitizarClientePayload(patch)),
        });
        return firstOrThrow(rows, "Cliente não encontrado ou já removido.");
    } catch (err) {
        return erroCliente(err);
    }
}

export async function excluirCliente(id: string): Promise<void> {
    await restRequest<void>(`revisional_clientes?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** Exclui vários clientes, em lotes de 100 para a URL não passar do limite. */
export async function excluirClientes(ids: string[]): Promise<void> {
    for (let i = 0; i < ids.length; i += 100) {
        const lote = ids.slice(i, i + 100).map((id) => encodeURIComponent(`"${id}"`));
        if (lote.length === 0) continue;
        await restRequest<void>(`revisional_clientes?id=in.(${lote.join(",")})`, { method: "DELETE" });
    }
}

/* ----------------------------------------------------- Base do atendimento por IA */

export async function listarConhecimentoCliente(clienteId: string): Promise<ItemConhecimento[]> {
    const rows = await restRequestList<Record<string, unknown>>(
        `revisional_cliente_conhecimento?select=*&cliente_id=eq.${encodeURIComponent(clienteId)}&order=created_at.desc`,
    );
    return rows.map(normalizarItemConhecimento);
}

export async function criarItemConhecimento(payload: ItemConhecimentoPayload): Promise<ItemConhecimento> {
    const rows = await restRequest<Record<string, unknown>[]>("revisional_cliente_conhecimento", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(sanitizarItemConhecimento(payload)),
    });
    return normalizarItemConhecimento(firstOrThrow(rows));
}

export async function excluirItemConhecimento(id: string): Promise<void> {
    await restRequest<void>(`revisional_cliente_conhecimento?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}

/* ----------------------------------------------------- Atendimento pelo WhatsApp */

export type ConversaAtendimento = ConversaRow;
export type MensagemAtendimento = MensagemRow;

export interface AvisoAtendimento {
    avisar_whatsapp: boolean;
    telefone: string;
}

export async function listarConversasAtendimento(): Promise<ConversaAtendimento[]> {
    return restRequest<ConversaAtendimento[]>(
        "revisional_atendimento_conversas?select=*&order=ultima_mensagem_em.desc&limit=300",
    );
}

export async function contarConversasPendentes(): Promise<number> {
    const rows = await restRequest<Array<{ id: string }>>(
        "revisional_atendimento_conversas?select=id&status=eq.pendente&limit=500",
    );
    return rows.length;
}

export async function listarMensagensConversa(conversaId: string): Promise<MensagemAtendimento[]> {
    return restRequest<MensagemAtendimento[]>(
        `revisional_atendimento_mensagens?select=*&conversa_id=eq.${encodeURIComponent(conversaId)}&status=neq.descartada&order=created_at.asc&limit=500`,
    );
}

export async function atualizarConversaAtendimento(
    id: string,
    patch: Partial<Pick<ConversaAtendimento, "status" | "cliente_id">>,
): Promise<void> {
    await restRequest<void>(`revisional_atendimento_conversas?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
    });
}

export async function descartarRascunhoAtendimento(id: string): Promise<void> {
    await restRequest<void>(
        `revisional_atendimento_mensagens?id=eq.${encodeURIComponent(id)}&status=eq.rascunho`,
        { method: "PATCH", body: JSON.stringify({ status: "descartada" }) },
    );
}

/** Modelos de IA do atendimento escolhidos no site ("" = padrão do sistema). */
export async function obterModelosAtendimento(): Promise<{ resposta: string; extracao: string }> {
    try {
        const rows = await restRequest<Array<{ atendimento_modelo_resposta?: string; atendimento_modelo_extracao?: string }>>(
            "revisional_configuracoes?select=atendimento_modelo_resposta,atendimento_modelo_extracao&id=eq.escritorio",
        );
        return { resposta: rows[0]?.atendimento_modelo_resposta ?? "", extracao: rows[0]?.atendimento_modelo_extracao ?? "" };
    } catch (err) {
        if (err instanceof RevisionalApiError && (err.code === "42703" || err.code === "PGRST204")) {
            throw new RevisionalApiError("A escolha do modelo precisa da migração do banco (20261127140000).", 400, err.code);
        }
        throw err;
    }
}

export async function salvarModelosAtendimento(m: { resposta: string; extracao: string }): Promise<void> {
    try {
        await restRequest<void>("revisional_configuracoes?on_conflict=id", {
            method: "POST",
            headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
            body: JSON.stringify({
                id: "escritorio",
                atendimento_modelo_resposta: m.resposta,
                atendimento_modelo_extracao: m.extracao,
            }),
        });
    } catch (err) {
        if (err instanceof RevisionalApiError && (err.code === "42703" || err.code === "PGRST204")) {
            throw new RevisionalApiError("A escolha do modelo precisa da migração do banco (20261127140000).", 400, err.code);
        }
        throw err;
    }
}

/** O aviso da pessoa logada (a RLS só deixa ver e mudar o próprio). */
export async function obterMeuAvisoAtendimento(): Promise<AvisoAtendimento> {
    const rows = await restRequest<AvisoAtendimento[]>("revisional_atendimento_avisos?select=avisar_whatsapp,telefone&limit=1");
    return rows[0] ?? { avisar_whatsapp: false, telefone: "" };
}

export async function salvarMeuAvisoAtendimento(aviso: AvisoAtendimento): Promise<void> {
    const telefone = aviso.telefone.replace(/\D/g, "");
    const comDdi = telefone.length === 10 || telefone.length === 11 ? `55${telefone}` : telefone;
    await restRequest<void>("revisional_atendimento_avisos?on_conflict=user_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ avisar_whatsapp: aviso.avisar_whatsapp, telefone: comDdi.slice(0, 15) }),
    });
}

/** Liga um caso a outro cliente (o gatilho do banco respeita a escolha) e alinha o nome do caso. */
export async function vincularCasoAoCliente(calculoId: string, cliente: Pick<Cliente, "id" | "nome">): Promise<CalculoSalvo> {
    const rows = await restRequest<CalculoSalvo[]>(`revisional_calculos?id=eq.${encodeURIComponent(calculoId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ cliente_id: cliente.id, cliente_nome: cliente.nome }),
    });
    return firstOrThrow(rows, "Caso não encontrado ou já removido.");
}

/* ----------------------------------------------------- Configurações do escritório */

/**
 * Nome, OAB e cidade salvos em Configurações. `null` se a tabela ainda não existe no banco
 * (migração 20261120150000): aí o sistema segue com os valores padrão.
 */
export async function obterConfigEscritorio(): Promise<ConfigEscritorio | null> {
    try {
        const rows = await restRequest<Record<string, unknown>[]>("revisional_configuracoes?id=eq.escritorio&select=*");
        return rows[0] ? normalizarConfigEscritorio(rows[0]) : null;
    } catch (err) {
        if (isTabelaTarefasAusente(err)) return null;
        throw err;
    }
}

const MSG_MIGRACAO_TIMBRADO =
    "O papel timbrado próprio precisa da migração do banco (20261120170000_timbrado_escritorio).";
const MSG_MIGRACAO_ASSINATURA =
    "A rubrica salva do escritório precisa da migração do banco (20261121000000_assinatura_escritorio).";

/** Banco sem a coluna `timbrado_imagem_url` (migração 20261120170000 ainda não aplicada). */
export function isColunaTimbradoAusente(err: unknown): boolean {
    return (
        err instanceof RevisionalApiError &&
        (err.code === "PGRST204" || err.code === "42703") &&
        /timbrado_imagem_url/.test(err.message)
    );
}

/** Banco sem a coluna `assinatura_imagem_url` (migração 20261121000000 ainda não aplicada). */
export function isColunaAssinaturaAusente(err: unknown): boolean {
    return (
        err instanceof RevisionalApiError &&
        (err.code === "PGRST204" || err.code === "42703") &&
        /assinatura_imagem_url/.test(err.message)
    );
}

async function upsertConfigEscritorio(linha: Record<string, string>): Promise<ConfigEscritorio> {
    const rows = await restRequest<Record<string, unknown>[]>("revisional_configuracoes?on_conflict=id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(linha),
    });
    return normalizarConfigEscritorio(firstOrThrow(rows));
}

export async function salvarConfigEscritorio(c: ConfigEscritorio): Promise<ConfigEscritorio> {
    let linha = configParaLinha(c);
    for (let tentativa = 0; tentativa < 2; tentativa++) {
        try {
            return await upsertConfigEscritorio(linha);
        } catch (err) {
            if (isColunaTimbradoAusente(err) && "timbrado_imagem_url" in linha) {
                if (linha.timbrado_imagem_url) {
                    throw new RevisionalApiError(MSG_MIGRACAO_TIMBRADO, 400, "TABELA_AUSENTE");
                }
                const { timbrado_imagem_url: _semColuna, ...semTimbrado } = linha;
                linha = semTimbrado;
                continue;
            }
            if (isColunaAssinaturaAusente(err) && "assinatura_imagem_url" in linha) {
                if (linha.assinatura_imagem_url) {
                    throw new RevisionalApiError(MSG_MIGRACAO_ASSINATURA, 400, "TABELA_AUSENTE");
                }
                const { assinatura_imagem_url: _semAss, ...semAssinatura } = linha;
                linha = semAssinatura;
                continue;
            }
            throw err;
        }
    }
    return upsertConfigEscritorio(linha);
}

/**
 * Grava só o papel timbrado próprio ("" = volta ao padrão), sem tocar em nome/OAB/cidade:
 * evita sobrescrever os dados do escritório com valores ainda não carregados na tela.
 */
export async function salvarTimbradoEscritorio(timbradoImagemUrl: string): Promise<ConfigEscritorio> {
    const valor = sanitizarTimbradoImagemUrl(timbradoImagemUrl);
    if (timbradoImagemUrl.trim() && !valor) {
        throw new Error("A imagem do timbrado é inválida ou grande demais. Envie um PNG, JPG ou WebP.");
    }
    try {
        const rows = await restRequest<Record<string, unknown>[]>("revisional_configuracoes?id=eq.escritorio", {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({ timbrado_imagem_url: valor }),
        });
        if (rows[0]) return normalizarConfigEscritorio(rows[0]);
    } catch (err) {
        if (isColunaTimbradoAusente(err)) throw new RevisionalApiError(MSG_MIGRACAO_TIMBRADO, 400, "TABELA_AUSENTE");
        throw err;
    }
    // Linha do escritório ainda não existe: cria a partir do que está no banco (ou dos padrões).
    const base = (await obterConfigEscritorio()) ?? configEscritorioAtual();
    return salvarConfigEscritorio({ ...base, timbradoImagemUrl: valor });
}

/**
 * Grava só a rubrica/assinatura visual do advogado ("" = remove a imagem), sem tocar em nome/OAB/cidade.
 */
export async function salvarAssinaturaEscritorio(assinaturaImagemUrl: string): Promise<ConfigEscritorio> {
    const valor = sanitizarAssinaturaImagemUrl(assinaturaImagemUrl);
    if (assinaturaImagemUrl.trim() && !valor) {
        throw new Error("A imagem da assinatura é inválida ou grande demais. Envie um PNG, JPG ou WebP.");
    }
    try {
        const rows = await restRequest<Record<string, unknown>[]>("revisional_configuracoes?id=eq.escritorio", {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({ assinatura_imagem_url: valor }),
        });
        if (rows[0]) return normalizarConfigEscritorio(rows[0]);
    } catch (err) {
        if (isColunaAssinaturaAusente(err)) throw new RevisionalApiError(MSG_MIGRACAO_ASSINATURA, 400, "TABELA_AUSENTE");
        throw err;
    }
    const base = (await obterConfigEscritorio()) ?? configEscritorioAtual();
    return salvarConfigEscritorio({ ...base, assinaturaImagemUrl: valor });
}
