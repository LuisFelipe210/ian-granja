import {
    LIMITE_ABUSIVO,
    historico,
    saldoDevedor,
    taxaMedia,
    type Nivel,
} from "./index.ts";
import type { ResultadoContrato, ResultadoProcessoRevisional } from "./revisional-pro.ts";
import type { CalculoSalvo, Categoria } from "../revisional-db.ts";

export interface PontoSaldoDevedor {
    parcela: number;
    /** Saldo exigido no cronograma original do banco */
    saldoBanco: number;
    /** Saldo se o contrato seguisse parcelas na taxa paradigma desde o início */
    saldoCronogramaParadigma: number;
    /** Saldo real recalculado aplicando a taxa paradigma e abatendo o valor efetivamente pago */
    saldoAbatendoPagas: number;
}

export interface SerieSaldoContrato {
    pontos: PontoSaldoDevedor[];
    /** Parcela em que o financiamento já estaria quitado mantendo o valor da parcela atual na taxa justa */
    parcelaQuitacaoAntecipada: number | null;
    saldoBancoHoje: number;
    saldoRecalculadoHoje: number;
    reducaoDividaHoje: number;
}

/** Calcula as curvas completas de evolução do saldo devedor do mês 0 até a última parcela. */
export function serieSaldoDevedorContrato(rc: ResultadoContrato): SerieSaldoContrato {
    const a = rc.analise;
    const e = a.entrada;
    const n = Math.max(1, e.parcelas);
    const iBanco = a.taxaEfetiva / 100;
    const iJusta = rc.taxaRevisionalAm / 100;

    let parcelaQuitacaoAntecipada: number | null = null;
    for (let k = 1; k < n; k++) {
        const s = saldoDevedor(e.valor, iJusta, e.parcela, k);
        if (s <= 0.01) {
            parcelaQuitacaoAntecipada = k;
            break;
        }
    }

    const indices = new Set<number>([0, e.pagas, n]);
    if (parcelaQuitacaoAntecipada !== null) {
        indices.add(parcelaQuitacaoAntecipada);
    }

    const passo = n <= 60 ? 1 : Math.ceil(n / 60);
    for (let k = 0; k <= n; k += passo) {
        indices.add(k);
    }

    const ordenados = [...indices].filter((k) => k >= 0 && k <= n).sort((x, y) => x - y);
    const pontos: PontoSaldoDevedor[] = ordenados.map((k) => ({
        parcela: k,
        saldoBanco: Math.max(0, saldoDevedor(e.valor, iBanco, e.parcela, k)),
        saldoCronogramaParadigma: Math.max(0, saldoDevedor(e.valor, iJusta, a.parcelaNaMedia, k)),
        saldoAbatendoPagas: Math.max(0, saldoDevedor(e.valor, iJusta, e.parcela, k)),
    }));

    const saldoBancoHoje = a.saldoHoje;
    const saldoRecalculadoHoje = a.saldoRecalculado;

    return {
        pontos,
        parcelaQuitacaoAntecipada,
        saldoBancoHoje,
        saldoRecalculadoHoje,
        reducaoDividaHoje: Math.max(0, saldoBancoHoje - saldoRecalculadoHoje),
    };
}

export interface ComposicaoCustoContrato {
    principal: number;
    jurosContrato: number;
    jurosParadigma: number;
    excessoJurosNominal: number;
    totalContrato: number;
    totalParadigma: number;
}

export function composicaoCustoContrato(rc: ResultadoContrato): ComposicaoCustoContrato {
    const a = rc.analise;
    const principal = a.entrada.valor;
    const totalContrato = a.total;
    const totalParadigma = a.totalNaMedia;
    const jurosContrato = Math.max(0, totalContrato - principal);
    const jurosParadigma = Math.max(0, totalParadigma - principal);
    return {
        principal,
        jurosContrato,
        jurosParadigma,
        excessoJurosNominal: Math.max(0, totalContrato - totalParadigma),
        totalContrato,
        totalParadigma,
    };
}

export interface DadosSerieBacenContrato {
    serieCodigo: number;
    mesReferencia: string;
    mediaSgsAm: number;
    pontos: { mes: string; v: number }[];
    usandoParadigmaExterno: boolean;
    taxaParadigmaAm: number;
    limiteAbusoAm: number;
}

/** Obtém sempre a curva oficial do BACEN/SGS, mesmo quando o paradigma escolhido for Olinda BCB ou Manual. */
export function historicoBacenContrato(rc: ResultadoContrato): DadosSerieBacenContrato | null {
    const a = rc.analise;
    const mediaOficial = a.media.serieAm ? a.media : taxaMedia(a.entrada.mod, a.entrada.mes);
    if (!mediaOficial || !mediaOficial.serieAm) return null;

    const serieCodigo = mediaOficial.serieAm;
    let pontos = historico(serieCodigo, a.entrada.mes);

    // Séries recentes (ex.: 29977 criada em nov/2025) têm poucos meses; complementa o período anterior com a série equivalente
    if (pontos.length < 24 && a.entrada.mod.alt) {
        const pontosAlt = historico(a.entrada.mod.alt.am, a.entrada.mes);
        if (pontosAlt.length > pontos.length) {
            const primeiroPrimario = pontos[0]?.mes;
            pontos = primeiroPrimario
                ? [...pontosAlt.filter((p) => p.mes < primeiroPrimario), ...pontos]
                : pontosAlt;
        }
    }

    if (pontos.length < 2) return null;

    const usandoParadigmaExterno = rc.contrato.fonteTaxaRevisional !== "media_sgs";

    return {
        serieCodigo,
        mesReferencia: mediaOficial.mes,
        mediaSgsAm: mediaOficial.am,
        pontos,
        usandoParadigmaExterno,
        taxaParadigmaAm: rc.taxaRevisionalAm,
        limiteAbusoAm: rc.taxaRevisionalAm * LIMITE_ABUSIVO,
    };
}

export interface FatiaProveitoGlobal {
    id: string;
    rotulo: string;
    valor: number;
    corHex: string;
}

export function decomporProveitoGlobal(res: ResultadoProcessoRevisional): FatiaProveitoGlobal[] {
    const r = res.resumo;
    const fatias: FatiaProveitoGlobal[] = [];
    if (r.principalContratosAtualizado > 0.005) {
        fatias.push({
            id: "parcelas",
            rotulo: "Diferenças nas parcelas pagas (atualizadas)",
            valor: r.principalContratosAtualizado,
            corHex: "#061237",
        });
    }
    if (r.extrasAtualizado > 0.005) {
        fatias.push({
            id: "extras",
            rotulo: "Pagamentos extras / antecipações",
            valor: r.extrasAtualizado,
            corHex: "#1E3269",
        });
    }
    if (r.tarifasAtualizado > 0.005) {
        fatias.push({
            id: "tarifas",
            rotulo: "Seguros prestamistas e tarifas abusivas",
            valor: r.tarifasAtualizado,
            corHex: "#A1824A",
        });
    }
    if (r.valorMultaGlobal + r.valorHonorarios > 0.005) {
        fatias.push({
            id: "encargos",
            rotulo: "Multa e honorários advocatícios",
            valor: r.valorMultaGlobal + r.valorHonorarios,
            corHex: "#7A5E2B",
        });
    }
    if (r.economiaVincendasTotal > 0.005) {
        fatias.push({
            id: "vincendas",
            rotulo: "Economia projetada nas parcelas vincendas",
            valor: r.economiaVincendasTotal,
            corHex: "#3C528A",
        });
    }
    return fatias;
}

/* ---------------- Agregação estratégica da carteira (aba Painel) ---------------- */

export interface EstatisticaCategoria {
    id: string;
    nome: string;
    cor: string;
    casos: number;
    valorTotal: number;
    abusos: number;
}

export interface EstatisticaBanco {
    nome: string;
    casos: number;
    valorTotal: number;
    razaoMedia: number;
    abusos: number;
}

export interface EstatisticaModalidade {
    nome: string;
    casos: number;
    valorTotal: number;
    razaoMedia: number;
}

export interface EstatisticasCarteira {
    totalCasos: number;
    proveitoTotal: number;
    pagoAMaisETarifasTotal: number;
    valorFinanciadoTotal: number;
    ticketMedio: number;
    qtdPorNivel: Record<Nivel, number>;
    valorPorNivel: Record<Nivel, number>;
    percentualAbuso: number;
    razaoMediaGeral: number;
    porCategoria: EstatisticaCategoria[];
    porBanco: EstatisticaBanco[];
    porModalidade: EstatisticaModalidade[];
}

export function normalizarRotuloBanco(raw: string): string {
    const s = raw.trim();
    if (!s) return "Instituição não informada";
    const norm = s
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ");

    if (norm.includes("BANCO DO BRASIL") || norm.includes("BCO DO BRASIL")) return "Banco do Brasil";
    if (norm.includes("SANTANDER")) return "Santander";
    if (/\bPAN\b/.test(norm)) return "Banco Pan";
    if (/\bBV\b|VOTORANTIM/.test(norm)) return "Banco BV";
    if (norm.includes("ITAU")) return "Itaú Unibanco";
    if (norm.includes("BRADESCO")) return "Bradesco";
    if (norm.includes("CAIXA ECONOMICA") || norm === "CEF" || norm === "CAIXA") return "Caixa Econômica";
    if (norm.includes("CETELEM")) return "Banco Cetelem";
    if (norm.includes("BMG")) return "Banco BMG";
    if (/\bINTER\b/.test(norm)) return "Banco Inter";
    if (/\bC6\b/.test(norm)) return "C6 Bank";
    if (norm.includes("NU FINANCEIRA") || norm.includes("NUBANK")) return "Nubank";
    if (norm.includes("SAFRA")) return "Banco Safra";
    if (norm.includes("DAYCOVAL")) return "Banco Daycoval";
    if (norm.includes("SICOOB")) return "Sicoob";
    if (norm.includes("SICREDI")) return "Sicredi";
    if (norm.includes("MERCANTIL")) return "Mercantil do Brasil";
    if (norm.includes("VOLKSWAGEN")) return "Banco Volkswagen";
    if (norm.includes("TOYOTA")) return "Banco Toyota";
    if (norm.includes("HONDA")) return "Banco Honda";
    if (norm.includes("YAMAHA")) return "Banco Yamaha";
    if (/\bGM\b|CHEVROLET/.test(norm)) return "Banco GM";
    return s;
}

export function agregarEstatisticasCarteira(
    calculos: CalculoSalvo[],
    categorias: Categoria[],
): EstatisticasCarteira {
    const qtdPorNivel: Record<Nivel, number> = { abuso: 0, acima: 0, media: 0 };
    const valorPorNivel: Record<Nivel, number> = { abuso: 0, acima: 0, media: 0 };

    let proveitoTotal = 0;
    let pagoAMaisETarifasTotal = 0;
    let valorFinanciadoTotal = 0;
    let somaRazoes = 0;

    const catMap = new Map<string, EstatisticaCategoria>();
    for (const cat of categorias) {
        catMap.set(cat.id, {
            id: cat.id,
            nome: cat.nome,
            cor: cat.cor,
            casos: 0,
            valorTotal: 0,
            abusos: 0,
        });
    }
    const semCat: EstatisticaCategoria = {
        id: "sem",
        nome: "Sem categoria",
        cor: "navy",
        casos: 0,
        valorTotal: 0,
        abusos: 0,
    };

    const bancoMap = new Map<
        string,
        { casos: number; casosComRazao: number; valorTotal: number; somaRazao: number; abusos: number }
    >();
    const modMap = new Map<string, { casos: number; casosComRazao: number; valorTotal: number; somaRazao: number }>();
    let casosComRazaoGeral = 0;

    for (const c of calculos) {
        const valAcao = Number(c.valor_total_acao) || Number(c.diferenca_total) || 0;
        const pagoMais = (Number(c.pago_a_mais) || 0) + (Number(c.total_tarifas) || 0);
        const financiado = Number(c.valor_financiado) || 0;
        const razao = Number(c.razao_am) || 0;
        const temRazao = Number.isFinite(razao) && razao > 0;
        const niv: Nivel = c.nivel === "abuso" || c.nivel === "acima" ? c.nivel : "media";

        proveitoTotal += valAcao;
        pagoAMaisETarifasTotal += pagoMais;
        valorFinanciadoTotal += financiado;
        if (temRazao) {
            somaRazoes += razao;
            casosComRazaoGeral += 1;
        }

        qtdPorNivel[niv] += 1;
        valorPorNivel[niv] += valAcao;

        const bucketCat = c.categoria_id && catMap.has(c.categoria_id) ? catMap.get(c.categoria_id)! : semCat;
        bucketCat.casos += 1;
        bucketCat.valorTotal += valAcao;
        if (niv === "abuso") bucketCat.abusos += 1;

        const nomeBanco = normalizarRotuloBanco(c.banco || "");
        const bPrev = bancoMap.get(nomeBanco) ?? {
            casos: 0,
            casosComRazao: 0,
            valorTotal: 0,
            somaRazao: 0,
            abusos: 0,
        };
        bPrev.casos += 1;
        bPrev.valorTotal += valAcao;
        if (temRazao) {
            bPrev.somaRazao += razao;
            bPrev.casosComRazao += 1;
        }
        if (niv === "abuso") bPrev.abusos += 1;
        bancoMap.set(nomeBanco, bPrev);

        const nomeMod = `${c.modalidade_nome || "Modalidade"} (${(c.pessoa || "pf").toUpperCase()})`;
        const mPrev = modMap.get(nomeMod) ?? { casos: 0, casosComRazao: 0, valorTotal: 0, somaRazao: 0 };
        mPrev.casos += 1;
        mPrev.valorTotal += valAcao;
        if (temRazao) {
            mPrev.somaRazao += razao;
            mPrev.casosComRazao += 1;
        }
        modMap.set(nomeMod, mPrev);
    }

    const totalCasos = calculos.length;
    const porCategoria = [...catMap.values(), ...(semCat.casos > 0 ? [semCat] : [])].sort(
        (a, b) => b.valorTotal - a.valorTotal || b.casos - a.casos,
    );

    const porBanco: EstatisticaBanco[] = [...bancoMap.entries()]
        .map(([nome, d]) => ({
            nome,
            casos: d.casos,
            valorTotal: d.valorTotal,
            razaoMedia: d.casosComRazao > 0 ? d.somaRazao / d.casosComRazao : 0,
            abusos: d.abusos,
        }))
        .sort((a, b) => b.valorTotal - a.valorTotal || b.casos - a.casos);

    const porModalidade: EstatisticaModalidade[] = [...modMap.entries()]
        .map(([nome, d]) => ({
            nome,
            casos: d.casos,
            valorTotal: d.valorTotal,
            razaoMedia: d.casosComRazao > 0 ? d.somaRazao / d.casosComRazao : 0,
        }))
        .sort((a, b) => b.valorTotal - a.valorTotal || b.casos - a.casos);

    return {
        totalCasos,
        proveitoTotal,
        pagoAMaisETarifasTotal,
        valorFinanciadoTotal,
        ticketMedio: totalCasos > 0 ? proveitoTotal / totalCasos : 0,
        qtdPorNivel,
        valorPorNivel,
        percentualAbuso: totalCasos > 0 ? (qtdPorNivel.abuso / totalCasos) * 100 : 0,
        razaoMediaGeral: casosComRazaoGeral > 0 ? somaRazoes / casosComRazaoGeral : 0,
        porCategoria,
        porBanco,
        porModalidade,
    };
}
