/**
 * Cálculo de juros abusivos: compara a taxa de um contrato com a taxa média de
 * mercado divulgada pelo Banco Central (BACEN/SGS) no mês da contratação.
 *
 * As taxas médias vêm da API pública do SGS (api.bcb.gov.br), consultada na hora
 * do cálculo. Se ela não responder, usamos a cópia em bacen-series.json
 * (jan/2012 em diante), gerada a partir da mesma API.
 */
import guardadas from "./bacen-series.json" with { type: "json" };

/* ------------------------------------------------------------------ séries */

type Serie = { i: string; v: (number | null)[] };
const SERIES: Record<string, Serie> = JSON.parse(JSON.stringify(guardadas));

export type Pessoa = "pf" | "pj";

interface Fonte {
    /** Série da taxa média mensal (% a.m.). */
    am: number;
    /** Série da taxa média anual (% a.a.). */
    aa: number;
}

export interface Modalidade extends Fonte {
    id: string;
    pessoa: Pessoa;
    nome: string;
    /** Explicação curta para o cliente. */
    resumo: string;
    /** Série usada quando a principal ainda não existia na data do contrato. */
    alt?: Fonte & { nome: string };
    /** Aviso fixo sobre a série escolhida. */
    obs?: string;
}

const VEICULOS_PF: Fonte = { am: 25471, aa: 20749 };
const VEICULOS_PJ: Fonte = { am: 25447, aa: 20728 };
const NAO_CONSIGNADO: Fonte = { am: 25464, aa: 20742 };

export const MODALIDADES: Modalidade[] = [
    { id: "veiculo-pf", pessoa: "pf", nome: "Financiamento de veículo", resumo: "Carro ou moto financiado", ...VEICULOS_PF },
    {
        id: "sem-garantia",
        pessoa: "pf",
        nome: "Empréstimo pessoal",
        resumo: "Sem garantia, não consignado",
        am: 29977,
        aa: 29974,
        alt: { ...NAO_CONSIGNADO, nome: "crédito pessoal não consignado (total)" },
    },
    {
        id: "garantia-pf",
        pessoa: "pf",
        nome: "Empréstimo com garantia",
        resumo: "Carro ou imóvel dado em garantia",
        am: 29976,
        aa: 29973,
        alt: { ...VEICULOS_PF, nome: "aquisição de veículos (PF)" },
    },
    { id: "consig-publico", pessoa: "pf", nome: "Consignado de servidor", resumo: "Desconto na folha, setor público", am: 25467, aa: 20745 },
    { id: "consig-privado", pessoa: "pf", nome: "Consignado CLT", resumo: "Desconto na folha, setor privado", am: 25466, aa: 20744 },
    { id: "consig-inss", pessoa: "pf", nome: "Consignado do INSS", resumo: "Aposentados e pensionistas", am: 25468, aa: 20746 },
    { id: "veiculo-pj", pessoa: "pj", nome: "Financiamento de veículo", resumo: "Veículo da empresa", ...VEICULOS_PJ },
    {
        id: "garantia-pj",
        pessoa: "pj",
        nome: "Empréstimo com garantia",
        resumo: "Veículo da empresa dado em garantia",
        ...VEICULOS_PJ,
        obs: "O BACEN não divulga série de empréstimo com garantia real para PJ; usamos a série de aquisição de veículos (PJ).",
    },
];

/* ------------------------------------------------------------------ meses */

export const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Primeiro ano com dados guardados. */
export const PRIMEIRO_ANO = 2012;

/** "2022-01" → índice absoluto de meses. */
export const mIdx = (k: string) => {
    const [a, m] = k.split("-").map(Number);
    return a * 12 + m - 1;
};
export const mKey = (ix: number) => `${Math.floor(ix / 12)}-${String((ix % 12) + 1).padStart(2, "0")}`;
/** "2022-01" → "jan/2022". */
export const mNome = (k: string) => {
    const [a, m] = k.split("-");
    return `${MESES_CURTOS[Number(m) - 1]}/${a}`;
};

export const valor = (c: number, k: string): number | null => {
    const s = SERIES[c];
    if (!s) return null;
    return s.v[mIdx(k) - mIdx(s.i)] ?? null;
};

export const ultimoMes = (c: number): string | null => {
    const s = SERIES[c];
    return s ? mKey(mIdx(s.i) + s.v.length - 1) : null;
};

export const primeiroMes = (c: number): string | null => SERIES[c]?.i ?? null;

const gravar = (c: number, k: string, v: number) => {
    let s = SERIES[c];
    if (!s) s = SERIES[c] = { i: k, v: [] };
    let ix = mIdx(k) - mIdx(s.i);
    if (ix < 0) {
        s.v = [...Array(-ix).fill(null), ...s.v];
        s.i = k;
        ix = 0;
    }
    while (s.v.length < ix) s.v.push(null);
    s.v[ix] = v;
};

const SERIES_CONSULTADAS = new Set<string>();

/** Consulta a série no BACEN em janela máxima de 10 anos a partir de 3 anos antes do contrato. */
const consultarSerie = async (c: number, k: string): Promise<boolean> => {
    const [a] = k.split("-");
    const anoContrato = Number(a);
    const iniAno = Math.max(PRIMEIRO_ANO, anoContrato - 3);
    const anoAtual = new Date().getFullYear();
    const fimAno = Math.min(anoAtual, iniAno + 9);
    const cacheKey = `${c}:${iniAno}:${fimAno}`;
    if (SERIES_CONSULTADAS.has(cacheKey)) return true;

    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${c}/dados?formato=json&dataInicial=01/01/${iniAno}&dataFinal=31/12/${fimAno}`;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    try {
        const r = await fetch(url, { signal: ctl.signal });
        if (!r.ok) return false;
        const raw: unknown = await r.json();
        if (!Array.isArray(raw)) return false;
        const dados = raw as { data: string; valor: string }[];
        for (const d of dados) {
            const [, mm, aa] = d.data.split("/");
            const v = parseFloat(d.valor);
            if (!Number.isNaN(v)) gravar(c, `${aa}-${mm}`, v);
        }
        if (dados.length > 0) {
            SERIES_CONSULTADAS.add(cacheKey);
            return true;
        }
        return false;
    } catch {
        return false;
    } finally {
        clearTimeout(timer);
    }
};

/** Atualiza as séries de uma modalidade com o BACEN. Devolve true se ao menos uma respondeu. */
export const consultarBacen = async (mod: Modalidade, k: string) => {
    const cods = [mod.am, mod.aa, ...(mod.alt ? [mod.alt.am, mod.alt.aa] : [])];
    const ok = await Promise.all(cods.map((c) => consultarSerie(c, k)));
    return ok.some(Boolean);
};

/* ------------------------------------------------------------------ taxas */

export const amParaAa = (m: number) => (Math.pow(1 + m / 100, 12) - 1) * 100;
export const aaParaAm = (a: number) => (Math.pow(1 + a / 100, 1 / 12) - 1) * 100;
const arred2 = (x: number) => Math.round(x * 100) / 100;

export interface Media {
    /** % a.m. */
    am: number;
    /** % a.a. */
    aa: number;
    serieAm: number | null;
    serieAa: number | null;
    /** Mês efetivamente usado ("AAAA-MM"). */
    mes: string;
    nota: string;
}

/** Escolhe a taxa média (mensal e anual) da modalidade para o mês do contrato. */
export const taxaMedia = (mod: Modalidade, k: string): Media | null => {
    const cands: (Fonte & { nome?: string })[] = [mod, ...(mod.alt ? [mod.alt] : [])];
    for (const c of cands) {
        let vm = valor(c.am, k);
        let va = valor(c.aa, k);
        if (vm == null && va != null) vm = arred2(aaParaAm(va));
        if (va == null && vm != null) va = arred2(amParaAa(vm));
        if (vm != null && va != null) {
            const nota =
                c !== mod && c.nome
                    ? `Em ${mNome(k)} o BACEN ainda não divulgava a série específica desta modalidade; usamos a série de ${c.nome}.`
                    : (mod.obs ?? "");
            return { am: vm, aa: va, serieAm: c.am, serieAa: c.aa, mes: k, nota };
        }
    }

    const u = ultimoMes(mod.am);
    if (u && mIdx(k) > mIdx(u)) {
        const vm = valor(mod.am, u);
        const va = valor(mod.aa, u);
        if (vm != null && va != null)
            return {
                am: vm,
                aa: va,
                serieAm: mod.am,
                serieAa: mod.aa,
                mes: u,
                nota: `A taxa média de ${mNome(k)} ainda não foi divulgada pelo BACEN; usamos a mais recente (${mNome(u)}).`,
            };
    }

    const s = mod.alt ?? mod;
    const f = primeiroMes(s.am);
    if (f) {
        const vm = valor(s.am, f);
        const va = valor(s.aa, f);
        if (vm != null && va != null)
            return {
                am: vm,
                aa: va,
                serieAm: s.am,
                serieAa: s.aa,
                mes: f,
                nota: `Não há taxa média para ${mNome(k)}; usamos a mais antiga disponível (${mNome(f)}).`,
            };
    }
    return null;
};

/** Pontos da série mensal para gráfico: de 36 meses antes do contrato até o último mês. */
export const historico = (c: number, k: string) => {
    const s = SERIES[c];
    const u = ultimoMes(c);
    if (!s || !u) return [];
    const fim = mIdx(u);
    const ini = Math.max(mIdx(s.i), Math.min(mIdx(k), fim) - 36);
    const pts: { mes: string; v: number }[] = [];
    for (let ix = ini; ix <= fim; ix++) {
        const v = valor(c, mKey(ix));
        if (v != null) pts.push({ mes: mKey(ix), v });
    }
    return pts;
};

/* ------------------------------------------------------- Tabela Price */

/** Parcela pela Tabela Price. i em fração (0,02 = 2%). */
export const parcelaPrice = (pv: number, i: number, n: number) => (i === 0 ? pv / n : (pv * i) / (1 - Math.pow(1 + i, -n)));

/** Taxa mensal (%) que faz pv virar n parcelas de p. */
export const taxaPelasParcelas = (pv: number, p: number, n: number) => {
    let lo = 0;
    let hi = 1;
    while (parcelaPrice(pv, hi, n) < p && hi < 1e3) hi *= 2;
    for (let k = 0; k < 200; k++) {
        const m = (lo + hi) / 2;
        if (parcelaPrice(pv, m, n) > p) hi = m;
        else lo = m;
    }
    return ((lo + hi) / 2) * 100;
};

/** Saldo devedor depois de k parcelas. */
export const saldoDevedor = (pv: number, i: number, p: number, k: number) =>
    i === 0 ? pv - p * k : pv * Math.pow(1 + i, k) - (p * (Math.pow(1 + i, k) - 1)) / i;

/* ------------------------------------------------------------- análise */

/** Taxa a partir da qual há forte indício de abuso (parâmetro usual do STJ). */
export const LIMITE_ABUSIVO = 1.5;

export type Nivel = "abuso" | "acima" | "media";
export const nivel = (razao: number): Nivel => (razao >= LIMITE_ABUSIVO ? "abuso" : razao > 1.1 ? "acima" : "media");

export interface Entrada {
    mod: Modalidade;
    /** "AAAA-MM" */
    mes: string;
    valor: number;
    parcela: number;
    parcelas: number;
    pagas: number;
    /** Taxas informadas no contrato (% a.m. e % a.a.); NaN quando em branco. */
    taxaMensal?: number;
    taxaAnual?: number;
    /** Taxa média informada manualmente; substitui a do BACEN. */
    mediaMensal?: number;
    mediaAnual?: number;
}

export interface Analise {
    entrada: Entrada;
    media: Media;
    manual: boolean;
    /** Taxa efetiva calculada pelas parcelas (% a.m.). */
    taxaEfetiva: number;
    /** Taxas do contrato usadas na comparação. */
    contratoAm: number;
    contratoAa: number;
    taxasInformadas: boolean;
    razaoAm: number;
    razaoAa: number;
    razao: number;
    nivel: Nivel;
    /** A taxa efetiva supera a informada: há custos embutidos. */
    custosEmbutidos: boolean;
    parcelaNaMedia: number;
    total: number;
    totalNaMedia: number;
    juros: number;
    jurosNaMedia: number;
    diferenca: number;
    pagoAMais: number;
    saldoHoje: number;
    saldoHojeNaMedia: number;
    /** Saldo devedor hoje aplicando a taxa média e abatendo as parcelas efetivamente pagas. */
    saldoRecalculado: number;
}

const valido = (x?: number) => typeof x === "number" && x > 0 && Number.isFinite(x);

export const analisar = (e: Entrada): Analise | null => {
    let media = taxaMedia(e.mod, e.mes);
    let manual = false;
    if (valido(e.mediaMensal) || valido(e.mediaAnual)) {
        const am = valido(e.mediaMensal) ? e.mediaMensal! : aaParaAm(e.mediaAnual!);
        const aa = valido(e.mediaAnual) ? e.mediaAnual! : amParaAa(e.mediaMensal!);
        media = { am, aa, serieAm: null, serieAa: null, mes: e.mes, nota: "Taxa média informada manualmente." };
        manual = true;
    }
    if (!media) return null;

    const taxaEfetiva = taxaPelasParcelas(e.valor, e.parcela, e.parcelas);
    const tm = valido(e.taxaMensal) ? e.taxaMensal! : undefined;
    const ta = valido(e.taxaAnual) ? e.taxaAnual! : undefined;
    const contratoAm = tm ?? (ta ? aaParaAm(ta) : taxaEfetiva);
    const contratoAa = ta ?? amParaAa(contratoAm);
    const razaoAm = contratoAm / media.am;
    const razaoAa = contratoAa / media.aa;
    const razao = razaoAm;

    const im = media.am / 100;
    const parcelaNaMedia = parcelaPrice(e.valor, im, e.parcelas);
    const total = e.parcela * e.parcelas;
    const totalNaMedia = parcelaNaMedia * e.parcelas;

    return {
        entrada: e,
        media,
        manual,
        taxaEfetiva,
        contratoAm,
        contratoAa,
        taxasInformadas: Boolean(tm || ta),
        razaoAm,
        razaoAa,
        razao,
        nivel: nivel(razaoAm),
        custosEmbutidos: tm !== undefined && taxaEfetiva - tm > 0.05,
        parcelaNaMedia,
        total,
        totalNaMedia,
        juros: total - e.valor,
        jurosNaMedia: totalNaMedia - e.valor,
        diferenca: Math.max(0, total - totalNaMedia),
        pagoAMais: Math.max(0, (e.parcela - parcelaNaMedia) * e.pagas),
        saldoHoje: Math.max(0, saldoDevedor(e.valor, taxaEfetiva / 100, e.parcela, e.pagas)),
        saldoHojeNaMedia: Math.max(0, saldoDevedor(e.valor, im, parcelaNaMedia, e.pagas)),
        saldoRecalculado: Math.max(0, saldoDevedor(e.valor, im, e.parcela, e.pagas)),
    };
};

/** Validação comum aos dois formulários. Devolve a mensagem de erro ou null. */
export const validar = (e: Partial<Entrada>): string | null => {
    if (!e.mod) return "Escolha o tipo de contrato.";
    if (!e.mes || !/^\d{4}-(0[1-9]|1[0-2])$/.test(e.mes)) return "Informe o mês e o ano em que o contrato foi assinado.";
    const hoje = new Date();
    const maxIdx = hoje.getFullYear() * 12 + hoje.getMonth();
    if (mIdx(e.mes) > maxIdx) return "A data do contrato não pode estar no futuro.";
    if (!valido(e.valor) || !valido(e.parcela) || !e.parcelas || e.parcelas < 1)
        return "Preencha o valor financiado, o valor da parcela e a quantidade de parcelas.";
    if (e.parcela! * e.parcelas! <= e.valor!) return "A soma das parcelas precisa ser maior que o valor financiado. Confira os números.";
    if ((e.pagas ?? 0) < 0 || (e.pagas ?? 0) > e.parcelas!) return `As parcelas pagas precisam estar entre 0 e ${e.parcelas}.`;
    return null;
};

/* ------------------------------------------------------------ formatos */

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const num = (v: number, d = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

/** "12,5" ou "1.234,5" → número; vazio ou formato ambíguo → NaN. */
export const lerDecimal = (s: string): number => {
    const t = s.trim().replace(/%$/, "").trim();
    if (!t) return NaN;
    if (/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/.test(t)) {
        return Number(t.replace(/\./g, "").replace(",", "."));
    }
    if (/^\d+(?:\.\d+)?$/.test(t)) {
        return Number(t);
    }
    return NaN;
};

/** Máscara de moeda: só dígitos, sempre com 2 casas. */
export const mascaraMoeda = (s: string) => {
    const d = s.replace(/\D/g, "").replace(/^0+/, "");
    return d ? num(parseInt(d, 10) / 100) : "";
};
export const lerMoeda = (s: string) => parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;

/** Resumo em texto para petição / WhatsApp. */
export const resumo = (a: Analise) => {
    const e = a.entrada;
    const m = a.media;
    const pessoa = e.mod.pessoa === "pj" ? "PJ" : "PF";
    const linhas = [
        `Modalidade: ${e.mod.nome} (${pessoa})`,
        `Data da contratação: ${mNome(e.mes)}`,
        `Taxa contratada: ${num(a.contratoAm)}% a.m. / ${num(a.contratoAa)}% a.a.${a.taxasInformadas ? "" : " (calculada pelas parcelas)"}`,
        `Taxa média BACEN (${mNome(m.mes)}): ${num(m.am)}% a.m.${m.serieAm ? ` (SGS ${m.serieAm})` : ""} / ${num(m.aa)}% a.a.${m.serieAa ? ` (SGS ${m.serieAa})` : ""}`,
        `Contrato / média: ${num(a.razaoAm)}x (mensal) / ${num(a.razaoAa)}x (anual)`,
        `Valor financiado: ${brl(e.valor)} | Parcela: ${brl(e.parcela)} x ${e.parcelas}${e.pagas ? ` (${e.pagas} pagas)` : ""}`,
        `Parcela na taxa média: ${brl(a.parcelaNaMedia)} | Diferença no contrato: ${brl(a.diferenca)}${e.pagas ? ` | Já pago a mais: ${brl(a.pagoAMais)}` : ""}`,
    ];
    if (a.custosEmbutidos) linhas.push(`Taxa efetiva pelas parcelas: ${num(a.taxaEfetiva)}% a.m. (maior que a informada)`);
    if (m.nota) linhas.push(`Obs.: ${m.nota}`);
    return linhas.join("\n");
};
