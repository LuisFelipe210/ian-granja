/**
 * Motor pericial completo de cálculo revisional bancário:
 * - Múltiplos contratos por processo
 * - Consulta por instituição financeira na API Olinda do BACEN
 * - Grade individual de parcelas editável + pagamentos extras/avulsos
 * - Seguros prestamistas e tarifas abusivas (simples ou em dobro, Art. 42 CDC)
 * - Correção monetária (INPC, IPCA, IGP-M, INPC/IPCA híbrido) e juros (Lei 14.905/2024, SELIC, 1% a.m. ou fixo)
 * - Deduções/alvarás, multa global e honorários advocatícios
 */
import {
    MODALIDADES,
    aaParaAm,
    amParaAa,
    analisar,
    consultarBacen,
    consultarSerieSgsMeses,
    lerDecimal,
    lerMoeda,
    mIdx,
    mKey,
    num,
    taxaMedia,
    type Analise,
    type Modalidade,
    type Nivel,
    type Pessoa,
} from "./index.ts";

export type IndiceCorrecao = "INPC_IPCA" | "INPC" | "IPCA" | "IGPM" | "NENHUM";
export type TipoJuros = "LEI_14905" | "SELIC" | "FIXO_1" | "FIXO_CUSTOM" | "NENHUM";
export type TermoInicialCorrecao = "VENCIMENTO" | "DATA_FIXA";
export type TermoInicialJuros = "VENCIMENTO" | "CITACAO";
export type FonteTaxaRevisional = "media_sgs" | "banco_olinda" | "manual";

export interface ParametrosDecisao {
    indiceCorrecao: IndiceCorrecao;
    tipoJuros: TipoJuros;
    jurosFixoMensal: number;
    termoInicialCorrecao: TermoInicialCorrecao;
    dataFixaCorrecao: string;
    termoInicialJuros: TermoInicialJuros;
    dataCitacao: string;
    dataBaseAtualizacao: string;
    restituicaoDobroParcelas: boolean;
    multaGlobalPercentual: number;
    honorariosPercentual: number;
}

export interface ParcelaGradeItem {
    numero: number;
    vencimento: string;
    valorPago: number;
    paga: boolean;
}

export interface PagamentoExtraItem {
    id: string;
    descricao: string;
    data: string;
    valor: number;
}

export interface TaxaOlindaSelecao {
    instituicao: string;
    taxaAm: number;
    taxaAa: number;
    periodo: string;
}

export interface TaxaOlindaRegistro {
    posicao: number;
    instituicao: string;
    cnpj8: string;
    taxaAm: number;
    taxaAa: number;
    inicioPeriodo: string;
    fimPeriodo: string;
}

export interface ContratoInput {
    id: string;
    descricao: string;
    instituicao: string;
    numeroContrato: string;
    pessoa: Pessoa;
    modalidadeId: string;
    /** "AAAA-MM-DD" ou "AAAA-MM" */
    dataContrato: string;
    /** "AAAA-MM-DD" */
    primeiroVencimento: string;
    valorFinanciado: number;
    valorParcela: number;
    parcelas: number;
    pagas: number;
    taxaMensal?: number;
    taxaAnual?: number;
    fonteTaxaRevisional: FonteTaxaRevisional;
    taxaRevisionalManualAm?: number;
    taxaRevisionalManualAa?: number;
    bancoOlinda?: TaxaOlindaSelecao | null;
    gradePersonalizada?: ParcelaGradeItem[];
    pagamentosExtras: PagamentoExtraItem[];
}

export interface TarifaItem {
    id: string;
    tipo: string;
    descricaoCustom: string;
    valor: number;
    dataCobranca: string;
    emDobro: boolean;
}

export interface DeducaoItem {
    id: string;
    descricao: string;
    valor: number;
    data: string;
    atualizar: boolean;
}

export interface ProcessoRevisionalInput {
    parametros: ParametrosDecisao;
    contratos: ContratoInput[];
    tarifas: TarifaItem[];
    deducoes: DeducaoItem[];
}

export interface SeriesEconomicas {
    inpc: Record<string, number>;
    ipca: Record<string, number>;
    igpm: Record<string, number>;
    selic: Record<string, number>;
}

export interface AtualizacaoResultado {
    valorBase: number;
    correcao: number;
    juros: number;
    total: number;
    fatorCorrecao: number;
    percentualJuros: number;
}

export interface LinhaDemonstrativoParcela {
    numero: number;
    vencimento: string;
    paga: boolean;
    valorDevido: number;
    valorPago: number;
    diferencaNominal: number;
    diferencaBaseRestituicao: number;
    correcao: number;
    juros: number;
    totalAtualizado: number;
}

export interface ResultadoPagamentoExtra {
    id: string;
    descricao: string;
    data: string;
    valorBase: number;
    correcao: number;
    juros: number;
    total: number;
}

export interface ResultadoContrato {
    contrato: ContratoInput;
    analise: Analise;
    onlineBacen: boolean;
    taxaRevisionalAm: number;
    taxaRevisionalAa: number;
    fonteTaxaRotulo: string;
    linhas: LinhaDemonstrativoParcela[];
    extras: ResultadoPagamentoExtra[];
    totalPago: number;
    totalDevidoNasPagas: number;
    diferencaNominalPagas: number;
    diferencaBaseRestituicao: number;
    correcaoTotal: number;
    jurosTotal: number;
    totalAtualizadoParcelas: number;
    extrasAtualizado: number;
    totalContratoAtualizado: number;
    economiaVincendas: number;
    nivel: Nivel;
}

export interface ResultadoTarifa {
    item: TarifaItem;
    titulo: string;
    valorOriginal: number;
    valorBaseRestituicao: number;
    correcao: number;
    juros: number;
    total: number;
}

export interface ResultadoDeducao {
    item: DeducaoItem;
    valorBase: number;
    correcao: number;
    juros: number;
    total: number;
}

export interface ResumoGlobalAcao {
    principalContratosNominal: number;
    principalContratosAtualizado: number;
    extrasAtualizado: number;
    tarifasNominal: number;
    tarifasAtualizado: number;
    deducoesAtualizado: number;
    baseLiquidaCondenacao: number;
    valorMultaGlobal: number;
    subtotalComMulta: number;
    valorHonorarios: number;
    totalRestituicaoAtualizado: number;
    economiaVincendasTotal: number;
    valorTotalAcao: number;
}

export interface ResultadoProcessoRevisional {
    parametros: ParametrosDecisao;
    contratos: ResultadoContrato[];
    tarifas: ResultadoTarifa[];
    deducoes: ResultadoDeducao[];
    resumo: ResumoGlobalAcao;
}

export const BANCOS_USUAIS: string[] = [
    "BANCO SANTANDER (BRASIL) S.A.",
    "BANCO PAN S.A.",
    "BANCO BV S.A.",
    "ITAÚ UNIBANCO S.A.",
    "BCO BRADESCO S.A.",
    "CAIXA ECONOMICA FEDERAL",
    "BCO DO BRASIL S.A.",
    "BCO CETELEM S.A.",
    "BCO BMG S.A.",
    "BANCO INTER S.A.",
    "BCO C6 S.A.",
    "NU FINANCEIRA S.A.",
    "BCO SAFRA S.A.",
    "BCO DAYCOVAL S.A.",
    "BANCO SICOOB S.A.",
    "BCO COOPERATIVO SICREDI S.A.",
    "BCO MERCANTIL DO BRASIL S.A.",
    "BCO YAMAHA MOTOR S.A.",
    "BCO HONDA S.A.",
    "BCO VOLKSWAGEN S.A.",
    "BCO TOYOTA DO BRASIL S.A.",
    "BCO GM S.A.",
];

export const TIPOS_TARIFA: string[] = [
    "Seguro Prestamista",
    "Tarifa de Abertura de Crédito (TAC)",
    "Tarifa de Emissão de Carnê (TEC)",
    "Tarifa de Avaliação do Bem",
    "Serviços de Terceiros",
    "Registro de Contrato",
    "IOF Financiado",
    "Outra",
];

export const INDICES_CORRECAO_OPCOES: { id: IndiceCorrecao; label: string }[] = [
    { id: "INPC_IPCA", label: "INPC até ago/2024 + IPCA (Lei 14.905/2024)" },
    { id: "INPC", label: "INPC (IBGE)" },
    { id: "IPCA", label: "IPCA (IBGE)" },
    { id: "IGPM", label: "IGP-M (FGV)" },
    { id: "NENHUM", label: "Sem correção monetária" },
];

export const TIPOS_JUROS_OPCOES: { id: TipoJuros; label: string }[] = [
    { id: "LEI_14905", label: "Juros Legais (Lei 14.905/2024: 1% até ago/24 + SELIC-IPCA)" },
    { id: "SELIC", label: "Taxa SELIC acumulada (substitui índice + juros)" },
    { id: "FIXO_1", label: "Juros simples de 1% ao mês" },
    { id: "FIXO_CUSTOM", label: "Percentual fixo mensal personalizado" },
    { id: "NENHUM", label: "Sem juros moratórios" },
];

export const hojeISO = (): string => new Date().toISOString().slice(0, 10);

export const PARAMETROS_DECISAO_PADRAO = (): ParametrosDecisao => ({
    indiceCorrecao: "INPC_IPCA",
    tipoJuros: "LEI_14905",
    jurosFixoMensal: 1,
    termoInicialCorrecao: "VENCIMENTO",
    dataFixaCorrecao: "",
    termoInicialJuros: "VENCIMENTO",
    dataCitacao: "",
    dataBaseAtualizacao: hojeISO(),
    restituicaoDobroParcelas: false,
    multaGlobalPercentual: 0,
    honorariosPercentual: 0,
});

export const criarContratoEmBranco = (idx = 1): ContratoInput => ({
    id: `c-${idx}-${Math.random().toString(36).slice(2, 7)}`,
    descricao: `Contrato ${idx}`,
    instituicao: "",
    numeroContrato: "",
    pessoa: "pf",
    modalidadeId: "veiculo-pf",
    dataContrato: "",
    primeiroVencimento: "",
    valorFinanciado: 0,
    valorParcela: 0,
    parcelas: 48,
    pagas: 0,
    fonteTaxaRevisional: "media_sgs",
    bancoOlinda: null,
    pagamentosExtras: [],
});

/* ----------------------------------------------------- Datas & Grade */

const pad2 = (n: number) => String(n).padStart(2, "0");

export function adicionarMesesISO(dataIso: string, meses: number): string {
    const clean = dataIso.trim();
    const parts = clean.split("-");
    const ano = Number(parts[0]);
    const mes = Number(parts[1] || "1");
    const dia = Number(parts[2] || "10");
    if (!ano || !mes) return "";

    const totalMeses = ano * 12 + (mes - 1) + meses;
    const novoAno = Math.floor(totalMeses / 12);
    const novoMes = (totalMeses % 12) + 1;
    const ultimoDiaDoMes = new Date(novoAno, novoMes, 0).getDate();
    const novoDia = Math.min(Math.max(1, dia), ultimoDiaDoMes);
    return `${novoAno}-${pad2(novoMes)}-${pad2(novoDia)}`;
}

export function primeiroVencimentoSugerido(dataContrato: string): string {
    if (!dataContrato) return "";
    const base = dataContrato.length === 7 ? `${dataContrato}-10` : dataContrato;
    return adicionarMesesISO(base, 1);
}

export function gerarGradePadrao(
    primeiroVencimento: string,
    dataContrato: string,
    parcelas: number,
    valorParcela: number,
    pagas: number,
): ParcelaGradeItem[] {
    const baseInicio = primeiroVencimento || primeiroVencimentoSugerido(dataContrato) || hojeISO();
    const out: ParcelaGradeItem[] = [];
    for (let q = 1; q <= parcelas; q++) {
        out.push({
            numero: q,
            vencimento: adicionarMesesISO(baseInicio, q - 1),
            valorPago: valorParcela,
            paga: q <= pagas,
        });
    }
    return out;
}

/* ----------------------------------------------------- Séries Econômicas & Atualização */

const SERIES_ECO_VAZIAS: SeriesEconomicas = { inpc: {}, ipca: {}, igpm: {}, selic: {} };

export async function carregarSeriesEconomicas(iniAno: number, fimAno: number): Promise<SeriesEconomicas> {
    const [inpc, ipca, igpm, selic] = await Promise.all([
        consultarSerieSgsMeses(188, iniAno, fimAno),
        consultarSerieSgsMeses(433, iniAno, fimAno),
        consultarSerieSgsMeses(189, iniAno, fimAno),
        consultarSerieSgsMeses(4390, iniAno, fimAno),
    ]);
    return { inpc, ipca, igpm, selic };
}

const maxMes = (a: string, b: string) => (mIdx(a) >= mIdx(b) ? a : b);

export function atualizarValorMonetario(
    valorBase: number,
    dataEvento: string,
    parametros: ParametrosDecisao,
    series: SeriesEconomicas = SERIES_ECO_VAZIAS,
): AtualizacaoResultado {
    if (!(valorBase > 0) || !dataEvento) {
        return { valorBase: Math.max(0, valorBase), correcao: 0, juros: 0, total: Math.max(0, valorBase), fatorCorrecao: 1, percentualJuros: 0 };
    }

    const mesEvento = dataEvento.slice(0, 7);
    const mesBase = (parametros.dataBaseAtualizacao || hojeISO()).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(mesEvento) || !/^\d{4}-\d{2}$/.test(mesBase)) {
        return { valorBase, correcao: 0, juros: 0, total: valorBase, fatorCorrecao: 1, percentualJuros: 0 };
    }

    const idxBase = mIdx(mesBase);
    const idxEvento = mIdx(mesEvento);
    if (idxEvento >= idxBase) {
        return { valorBase, correcao: 0, juros: 0, total: valorBase, fatorCorrecao: 1, percentualJuros: 0 };
    }

    // Correção monetária composta
    const mesIniCorr =
        parametros.termoInicialCorrecao === "DATA_FIXA" && /^\d{4}-\d{2}/.test(parametros.dataFixaCorrecao)
            ? maxMes(mesEvento, parametros.dataFixaCorrecao.slice(0, 7))
            : mesEvento;

    let fatorCorrecao = 1;
    if (parametros.tipoJuros !== "SELIC" && parametros.indiceCorrecao !== "NENHUM") {
        const idxIniCorr = mIdx(mesIniCorr);
        for (let ix = idxIniCorr; ix < idxBase; ix++) {
            const k = mKey(ix);
            let varPct = 0;
            if (parametros.indiceCorrecao === "INPC") varPct = series.inpc[k] ?? 0;
            else if (parametros.indiceCorrecao === "IPCA") varPct = series.ipca[k] ?? 0;
            else if (parametros.indiceCorrecao === "IGPM") varPct = series.igpm[k] ?? 0;
            else if (parametros.indiceCorrecao === "INPC_IPCA") {
                varPct = ix < mIdx("2024-09") ? (series.inpc[k] ?? 0) : (series.ipca[k] ?? 0);
            }
            fatorCorrecao *= 1 + varPct / 100;
        }
        if (fatorCorrecao < 1) fatorCorrecao = 1;
    }

    const valorCorrigido = valorBase * fatorCorrecao;
    const correcao = Math.max(0, valorCorrigido - valorBase);

    // Juros moratórios acumulados sobre o valor corrigido (ou nominal no caso SELIC)
    const mesIniJuros =
        parametros.termoInicialJuros === "CITACAO" && /^\d{4}-\d{2}/.test(parametros.dataCitacao)
            ? maxMes(mesEvento, parametros.dataCitacao.slice(0, 7))
            : mesEvento;

    let percentualJuros = 0;
    const idxIniJuros = mIdx(mesIniJuros);
    if (idxIniJuros < idxBase && parametros.tipoJuros !== "NENHUM") {
        for (let ix = idxIniJuros; ix < idxBase; ix++) {
            const k = mKey(ix);
            if (parametros.tipoJuros === "FIXO_1") {
                percentualJuros += 1;
            } else if (parametros.tipoJuros === "FIXO_CUSTOM") {
                percentualJuros += Math.max(0, parametros.jurosFixoMensal || 0);
            } else if (parametros.tipoJuros === "SELIC") {
                percentualJuros += Math.max(0, series.selic[k] ?? 0);
            } else if (parametros.tipoJuros === "LEI_14905") {
                if (ix < mIdx("2024-09")) {
                    percentualJuros += 1;
                } else {
                    const se = series.selic[k] ?? 0;
                    const ip = series.ipca[k] ?? 0;
                    const taxaLegalMes = ((1 + se / 100) / (1 + ip / 100) - 1) * 100;
                    percentualJuros += Math.max(0, taxaLegalMes);
                }
            }
        }
    }

    const juros = valorCorrigido * (percentualJuros / 100);
    const total = valorBase + correcao + juros;

    return { valorBase, correcao, juros, total, fatorCorrecao, percentualJuros };
}

/* ----------------------------------------------------- API Olinda BCB */

const OLINDA_CACHE = new Map<string, TaxaOlindaRegistro[]>();

function mapOlindaRows(rawValue: unknown): TaxaOlindaRegistro[] {
    if (!Array.isArray(rawValue)) return [];
    const rows: TaxaOlindaRegistro[] = [];
    for (const item of rawValue as Record<string, unknown>[]) {
        const inst = typeof item.InstituicaoFinanceira === "string" ? item.InstituicaoFinanceira.trim() : "";
        const am = Number(item.TaxaJurosAoMes);
        const aa = Number(item.TaxaJurosAoAno);
        const ini = typeof item.InicioPeriodo === "string" ? item.InicioPeriodo : "";
        const fim = typeof item.FimPeriodo === "string" ? item.FimPeriodo : "";
        const pos = Number(item.Posicao) || rows.length + 1;
        const cnpj8 = typeof item.cnpj8 === "string" ? item.cnpj8 : "";
        if (inst && Number.isFinite(am) && Number.isFinite(aa)) {
            rows.push({ posicao: pos, instituicao: inst, cnpj8, taxaAm: am, taxaAa: aa, inicioPeriodo: ini, fimPeriodo: fim });
        }
    }
    return rows;
}

export async function consultarTaxasOlinda(mod: Modalidade, dataRef: string): Promise<TaxaOlindaRegistro[]> {
    if (!mod.olindaModalidade || !mod.olindaSegmento) return [];

    const baseDateStr =
        dataRef.length === 10 ? dataRef : /^\d{4}-\d{2}$/.test(dataRef) ? `${dataRef}-15` : hojeISO();
    const cacheKey = `${mod.id}:${baseDateStr}`;
    const cached = OLINDA_CACHE.get(cacheKey);
    if (cached) return cached;

    const target = new Date(`${baseDateStr}T12:00:00Z`);
    const ini = new Date(target.getTime() - 10 * 86400_000).toISOString().slice(0, 10);
    const fim = new Date(target.getTime() + 10 * 86400_000).toISOString().slice(0, 10);

    const enc = encodeURIComponent;
    const modEsc = mod.olindaModalidade.replace(/'/g, "''");
    const segEsc = mod.olindaSegmento.replace(/'/g, "''");

    const fetchOlinda = async (filter: string, orderBy: string, top: number) => {
        const url = `https://olinda.bcb.gov.br/olinda/servico/taxaJuros/versao/v2/odata/TaxasJurosDiariaPorInicioPeriodo?$filter=${enc(filter)}&$orderby=${enc(orderBy)}&$top=${top}&$format=json`;
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 9000);
        try {
            const res = await fetch(url, { signal: ctl.signal });
            if (!res.ok) return [];
            const json = (await res.json()) as { value?: unknown };
            return mapOlindaRows(json.value);
        } catch {
            return [];
        } finally {
            clearTimeout(timer);
        }
    };

    const filterPeriodo = `InicioPeriodo ge '${ini}' and InicioPeriodo le '${fim}' and Modalidade eq '${modEsc}' and Segmento eq '${segEsc}'`;
    let rows = await fetchOlinda(filterPeriodo, "Posicao asc", 800);

    if (rows.length === 0) {
        const refMs = Math.min(target.getTime(), Date.now());
        const iniRecente = new Date(refMs - 90 * 86400_000).toISOString().slice(0, 10);
        const filterFallback = `InicioPeriodo ge '${iniRecente}' and Modalidade eq '${modEsc}' and Segmento eq '${segEsc}'`;
        rows = await fetchOlinda(filterFallback, "InicioPeriodo desc", 250);
    }

    if (rows.length > 0) {
        // Escolhe o InicioPeriodo mais próximo da data solicitada
        const targetMs = target.getTime();
        const periodos = [...new Set(rows.map((r) => r.inicioPeriodo))];
        periodos.sort(
            (a, b) =>
                Math.abs(new Date(`${a}T12:00:00Z`).getTime() - targetMs) -
                Math.abs(new Date(`${b}T12:00:00Z`).getTime() - targetMs),
        );
        const escolhido = periodos[0];
        const filtrados = rows
            .filter((r) => r.inicioPeriodo === escolhido)
            .sort((a, b) => a.posicao - b.posicao);
        OLINDA_CACHE.set(cacheKey, filtrados);
        return filtrados;
    }

    return [];
}

/* ----------------------------------------------------- Motor Completo */

export async function prepararDadosBacenProcesso(input: ProcessoRevisionalInput): Promise<{
    onlineByContrato: Record<string, boolean>;
    seriesEconomicas: SeriesEconomicas;
}> {
    let minAno = new Date().getFullYear() - 1;
    let maxAno = new Date().getFullYear();

    const onlineByContrato: Record<string, boolean> = {};
    await Promise.all(
        input.contratos.map(async (c) => {
            const mod = MODALIDADES.find((m) => m.id === c.modalidadeId);
            const mes = c.dataContrato.slice(0, 7);
            const ano = Number(mes.slice(0, 4));
            if (ano > 1990) minAno = Math.min(minAno, ano);
            if (mod && /^\d{4}-\d{2}$/.test(mes)) {
                onlineByContrato[c.id] = await consultarBacen(mod, mes);
            } else {
                onlineByContrato[c.id] = false;
            }
        }),
    );

    for (const t of input.tarifas) {
        const ano = Number(t.dataCobranca.slice(0, 4));
        if (ano > 1990) minAno = Math.min(minAno, ano);
    }

    const baseAno = Number((input.parametros.dataBaseAtualizacao || hojeISO()).slice(0, 4));
    if (baseAno > maxAno) maxAno = baseAno;

    const seriesEconomicas =
        input.parametros.indiceCorrecao === "NENHUM" &&
        (input.parametros.tipoJuros === "NENHUM" ||
            input.parametros.tipoJuros === "FIXO_1" ||
            input.parametros.tipoJuros === "FIXO_CUSTOM")
            ? SERIES_ECO_VAZIAS
            : await carregarSeriesEconomicas(minAno, maxAno);

    return { onlineByContrato, seriesEconomicas };
}

export function calcularProcessoRevisional(
    input: ProcessoRevisionalInput,
    seriesEconomicas: SeriesEconomicas = SERIES_ECO_VAZIAS,
    onlineByContrato: Record<string, boolean> = {},
): ResultadoProcessoRevisional {
    const resultadosContratos: ResultadoContrato[] = [];

    for (const c of input.contratos) {
        const mod = MODALIDADES.find((m) => m.id === c.modalidadeId);
        if (!mod) {
            throw new Error(`Modalidade "${c.modalidadeId}" não encontrada.`);
        }
        const mesContrato = c.dataContrato.slice(0, 7);

        let mediaMensal: number | undefined;
        let mediaAnual: number | undefined;
        let fonteTaxaRotulo = "Média de mercado BACEN (SGS)";

        if (c.fonteTaxaRevisional === "banco_olinda" && c.bancoOlinda && c.bancoOlinda.taxaAm > 0) {
            mediaMensal = c.bancoOlinda.taxaAm;
            mediaAnual = c.bancoOlinda.taxaAa > 0 ? c.bancoOlinda.taxaAa : amParaAa(c.bancoOlinda.taxaAm);
            fonteTaxaRotulo = `Olinda BCB · ${c.bancoOlinda.instituicao} (${c.bancoOlinda.periodo})`;
        } else if (
            c.fonteTaxaRevisional === "manual" &&
            ((c.taxaRevisionalManualAm && c.taxaRevisionalManualAm > 0) ||
                (c.taxaRevisionalManualAa && c.taxaRevisionalManualAa > 0))
        ) {
            mediaMensal =
                c.taxaRevisionalManualAm && c.taxaRevisionalManualAm > 0
                    ? c.taxaRevisionalManualAm
                    : aaParaAm(c.taxaRevisionalManualAa!);
            mediaAnual =
                c.taxaRevisionalManualAa && c.taxaRevisionalManualAa > 0
                    ? c.taxaRevisionalManualAa
                    : amParaAa(mediaMensal);
            fonteTaxaRotulo = "Taxa revisional manual";
        } else {
            const m = taxaMedia(mod, mesContrato);
            if (!m) {
                throw new Error(`Sem taxa média do BACEN para ${mesContrato}. Informe manualmente.`);
            }
            fonteTaxaRotulo = `Média BACEN/SGS (${m.serieAm ?? "-"})`;
        }

        const analise = analisar({
            mod,
            mes: mesContrato,
            valor: c.valorFinanciado,
            parcela: c.valorParcela,
            parcelas: c.parcelas,
            pagas: c.pagas,
            taxaMensal: c.taxaMensal,
            taxaAnual: c.taxaAnual,
            mediaMensal,
            mediaAnual,
        });
        if (!analise) {
            throw new Error("Não foi possível analisar o contrato informado.");
        }

        const grade =
            c.gradePersonalizada && c.gradePersonalizada.length === c.parcelas
                ? c.gradePersonalizada
                : gerarGradePadrao(c.primeiroVencimento, c.dataContrato, c.parcelas, c.valorParcela, c.pagas);

        const fatorDobro = input.parametros.restituicaoDobroParcelas ? 2 : 1;
        const linhas: LinhaDemonstrativoParcela[] = [];

        let totalPago = 0;
        let totalDevidoNasPagas = 0;
        let diferencaNominalPagas = 0;
        let diferencaBaseRestituicao = 0;
        let correcaoTotal = 0;
        let jurosTotal = 0;
        let totalAtualizadoParcelas = 0;
        let economiaVincendas = 0;

        for (const row of grade) {
            const valorDevido = analise.parcelaNaMedia;
            const valorPago = row.paga ? row.valorPago : 0;
            const diffNominal = row.paga ? Math.max(0, valorPago - valorDevido) : 0;
            const diffBase = diffNominal * fatorDobro;

            let correcao = 0;
            let juros = 0;
            let totalAtualizado = 0;

            if (row.paga && diffBase > 0) {
                const upd = atualizarValorMonetario(diffBase, row.vencimento, input.parametros, seriesEconomicas);
                correcao = upd.correcao;
                juros = upd.juros;
                totalAtualizado = upd.total;

                totalPago += valorPago;
                totalDevidoNasPagas += valorDevido;
                diferencaNominalPagas += diffNominal;
                diferencaBaseRestituicao += diffBase;
                correcaoTotal += correcao;
                jurosTotal += juros;
                totalAtualizadoParcelas += totalAtualizado;
            } else if (row.paga) {
                totalPago += valorPago;
                totalDevidoNasPagas += valorDevido;
            } else {
                economiaVincendas += Math.max(0, c.valorParcela - valorDevido);
            }

            linhas.push({
                numero: row.numero,
                vencimento: row.vencimento,
                paga: row.paga,
                valorDevido,
                valorPago,
                diferencaNominal: diffNominal,
                diferencaBaseRestituicao: diffBase,
                correcao,
                juros,
                totalAtualizado,
            });
        }

        const extras: ResultadoPagamentoExtra[] = [];
        let extrasAtualizado = 0;
        for (const ex of c.pagamentosExtras) {
            if (!(ex.valor > 0)) continue;
            const valorBase = ex.valor * fatorDobro;
            const upd = atualizarValorMonetario(valorBase, ex.data || c.dataContrato, input.parametros, seriesEconomicas);
            extras.push({
                id: ex.id,
                descricao: ex.descricao.trim() || "Pagamento extra / avulso",
                data: ex.data || c.dataContrato,
                valorBase,
                correcao: upd.correcao,
                juros: upd.juros,
                total: upd.total,
            });
            extrasAtualizado += upd.total;
        }

        resultadosContratos.push({
            contrato: c,
            analise,
            onlineBacen: onlineByContrato[c.id] ?? false,
            taxaRevisionalAm: analise.media.am,
            taxaRevisionalAa: analise.media.aa,
            fonteTaxaRotulo,
            linhas,
            extras,
            totalPago,
            totalDevidoNasPagas,
            diferencaNominalPagas,
            diferencaBaseRestituicao,
            correcaoTotal,
            jurosTotal,
            totalAtualizadoParcelas,
            extrasAtualizado,
            totalContratoAtualizado: totalAtualizadoParcelas + extrasAtualizado,
            economiaVincendas,
            nivel: analise.nivel,
        });
    }

    const tarifasResultado: ResultadoTarifa[] = [];
    let tarifasNominal = 0;
    let tarifasAtualizado = 0;
    for (const t of input.tarifas) {
        if (!(t.valor > 0)) continue;
        const titulo = t.tipo === "Outra" && t.descricaoCustom.trim() ? t.descricaoCustom.trim() : t.tipo;
        const valorBaseRestituicao = t.valor * (t.emDobro ? 2 : 1);
        const dataRef = t.dataCobranca || input.contratos[0]?.dataContrato || hojeISO();
        const upd = atualizarValorMonetario(valorBaseRestituicao, dataRef, input.parametros, seriesEconomicas);
        tarifasResultado.push({
            item: t,
            titulo,
            valorOriginal: t.valor,
            valorBaseRestituicao,
            correcao: upd.correcao,
            juros: upd.juros,
            total: upd.total,
        });
        tarifasNominal += t.valor;
        tarifasAtualizado += upd.total;
    }

    const deducoesResultado: ResultadoDeducao[] = [];
    let deducoesAtualizado = 0;
    for (const d of input.deducoes) {
        if (!(d.valor > 0)) continue;
        const upd = d.atualizar
            ? atualizarValorMonetario(d.valor, d.data || hojeISO(), input.parametros, seriesEconomicas)
            : { valorBase: d.valor, correcao: 0, juros: 0, total: d.valor, fatorCorrecao: 1, percentualJuros: 0 };
        deducoesResultado.push({
            item: d,
            valorBase: d.valor,
            correcao: upd.correcao,
            juros: upd.juros,
            total: upd.total,
        });
        deducoesAtualizado += upd.total;
    }

    const principalContratosNominal = resultadosContratos.reduce((s, r) => s + r.diferencaNominalPagas, 0);
    const principalContratosAtualizado = resultadosContratos.reduce((s, r) => s + r.totalAtualizadoParcelas, 0);
    const extrasAtualizado = resultadosContratos.reduce((s, r) => s + r.extrasAtualizado, 0);
    const economiaVincendasTotal = resultadosContratos.reduce((s, r) => s + r.economiaVincendas, 0);

    const baseLiquidaCondenacao = Math.max(
        0,
        principalContratosAtualizado + extrasAtualizado + tarifasAtualizado - deducoesAtualizado,
    );
    const valorMultaGlobal = baseLiquidaCondenacao * (Math.max(0, input.parametros.multaGlobalPercentual) / 100);
    const subtotalComMulta = baseLiquidaCondenacao + valorMultaGlobal;
    const valorHonorarios = subtotalComMulta * (Math.max(0, input.parametros.honorariosPercentual) / 100);
    const totalRestituicaoAtualizado = subtotalComMulta + valorHonorarios;
    const valorTotalAcao = totalRestituicaoAtualizado + economiaVincendasTotal;

    return {
        parametros: input.parametros,
        contratos: resultadosContratos,
        tarifas: tarifasResultado,
        deducoes: deducoesResultado,
        resumo: {
            principalContratosNominal,
            principalContratosAtualizado,
            extrasAtualizado,
            tarifasNominal,
            tarifasAtualizado,
            deducoesAtualizado,
            baseLiquidaCondenacao,
            valorMultaGlobal,
            subtotalComMulta,
            valorHonorarios,
            totalRestituicaoAtualizado,
            economiaVincendasTotal,
            valorTotalAcao,
        },
    };
}

/* ----------------------------------------------------- Estado de Formulário */

export interface PagamentoExtraForm {
    id: string;
    descricao: string;
    data: string;
    valorStr: string;
}

export interface ContratoFormState {
    id: string;
    descricao: string;
    instituicao: string;
    numeroContrato: string;
    pessoa: Pessoa;
    modalidadeId: string;
    dataContrato: string;
    primeiroVencimento: string;
    valorF: string;
    parcela: string;
    parcelas: string;
    pagas: string;
    taxaM: string;
    taxaA: string;
    fonteTaxaRevisional: FonteTaxaRevisional;
    revisionalM: string;
    revisionalA: string;
    bancoOlinda: TaxaOlindaSelecao | null;
    gradePersonalizada: ParcelaGradeItem[] | null;
    pagamentosExtras: PagamentoExtraForm[];
}

export function criarContratoFormEmBranco(idx = 1): ContratoFormState {
    return {
        id: `c-${idx}-${Math.random().toString(36).slice(2, 7)}`,
        descricao: `Contrato ${idx}`,
        instituicao: "",
        numeroContrato: "",
        pessoa: "pf",
        modalidadeId: "veiculo-pf",
        dataContrato: "",
        primeiroVencimento: "",
        valorF: "",
        parcela: "",
        parcelas: "",
        pagas: "",
        taxaM: "",
        taxaA: "",
        fonteTaxaRevisional: "media_sgs",
        revisionalM: "",
        revisionalA: "",
        bancoOlinda: null,
        gradePersonalizada: null,
        pagamentosExtras: [],
    };
}

export function contratoInputParaForm(c: ContratoInput): ContratoFormState {
    return {
        id: c.id,
        descricao: c.descricao,
        instituicao: c.instituicao,
        numeroContrato: c.numeroContrato,
        pessoa: c.pessoa,
        modalidadeId: c.modalidadeId,
        dataContrato: c.dataContrato.length === 7 ? `${c.dataContrato}-10` : c.dataContrato,
        primeiroVencimento: c.primeiroVencimento || primeiroVencimentoSugerido(c.dataContrato),
        valorF: c.valorFinanciado > 0 ? num(c.valorFinanciado) : "",
        parcela: c.valorParcela > 0 ? num(c.valorParcela) : "",
        parcelas: c.parcelas > 0 ? String(c.parcelas) : "",
        pagas: c.pagas >= 0 ? String(c.pagas) : "",
        taxaM: c.taxaMensal != null && c.taxaMensal > 0 ? num(c.taxaMensal) : "",
        taxaA: c.taxaAnual != null && c.taxaAnual > 0 ? num(c.taxaAnual) : "",
        fonteTaxaRevisional: c.fonteTaxaRevisional,
        revisionalM: c.taxaRevisionalManualAm != null && c.taxaRevisionalManualAm > 0 ? num(c.taxaRevisionalManualAm) : "",
        revisionalA: c.taxaRevisionalManualAa != null && c.taxaRevisionalManualAa > 0 ? num(c.taxaRevisionalManualAa) : "",
        bancoOlinda: c.bancoOlinda ?? null,
        gradePersonalizada: c.gradePersonalizada ?? null,
        pagamentosExtras: (c.pagamentosExtras ?? []).map((ex) => ({
            id: ex.id,
            descricao: ex.descricao,
            data: ex.data,
            valorStr: ex.valor > 0 ? num(ex.valor) : "",
        })),
    };
}

export function formParaContratoInput(f: ContratoFormState): ContratoInput {
    return {
        id: f.id,
        descricao: f.descricao.trim() || "Contrato",
        instituicao: f.instituicao.trim(),
        numeroContrato: f.numeroContrato.trim(),
        pessoa: f.pessoa,
        modalidadeId: f.modalidadeId,
        dataContrato: f.dataContrato,
        primeiroVencimento: f.primeiroVencimento || primeiroVencimentoSugerido(f.dataContrato),
        valorFinanciado: lerMoeda(f.valorF),
        valorParcela: lerMoeda(f.parcela),
        parcelas: parseInt(f.parcelas, 10) || 0,
        pagas: parseInt(f.pagas || "0", 10),
        taxaMensal: lerDecimal(f.taxaM),
        taxaAnual: lerDecimal(f.taxaA),
        fonteTaxaRevisional: f.fonteTaxaRevisional,
        taxaRevisionalManualAm: lerDecimal(f.revisionalM),
        taxaRevisionalManualAa: lerDecimal(f.revisionalA),
        bancoOlinda: f.bancoOlinda,
        gradePersonalizada: f.gradePersonalizada ?? undefined,
        pagamentosExtras: f.pagamentosExtras.map((ex) => ({
            id: ex.id,
            descricao: ex.descricao.trim(),
            data: ex.data,
            valor: lerMoeda(ex.valorStr),
        })),
    };
}
