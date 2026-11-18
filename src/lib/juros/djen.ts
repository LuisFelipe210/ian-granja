import { normalizarBancoInput } from "./claude-revisional.ts";
import { BANCOS_USUAIS, hojeISO, type ProcessoRevisionalInput } from "./revisional-pro.ts";
import {
    fichaSemCalculoParaPayload,
    isCalculoPendente,
    type CalculoPayload,
    type CalculoSalvo,
    type Categoria,
    type FichaCliente,
} from "../revisional-db.ts";

export const DJEN_API_URL = "https://comunicaapi.pje.jus.br/api/v1/comunicacao";

export const OAB_ESCRITORIO_PADRAO = {
    numeroOab: "61107",
    ufOab: "PE",
    nomeAdvogado: "IAN FELIPE MENEZES SOUZA GRANJA",
} as const;

export interface DjenFiltroConsulta {
    numeroProcesso?: string;
    numeroOab?: string;
    ufOab?: string;
    nomeParte?: string;
    nomeAdvogado?: string;
    siglaTribunal?: string;
    texto?: string;
    dataDisponibilizacaoInicio?: string;
    dataDisponibilizacaoFim?: string;
    meio?: "D" | "E";
    pagina?: number;
    itensPorPagina?: 5 | 100;
}

export interface DjenDestinatario {
    nome: string;
    polo: string;
}

export interface DjenAdvogado {
    nome: string;
    numeroOab: string;
    ufOab: string;
}

export interface DjenClienteVinculado {
    id: string;
    clienteNome: string;
    banco: string;
    faseKanban: string;
    processoGlobal: string;
    valorTotalAcao: number;
    correspondenciaPor: "cnj" | "nome";
}

export interface DjenComunicacao {
    id: number;
    dataDisponibilizacao: string;
    dataDisponibilizacaoBr: string;
    siglaTribunal: string;
    tipoComunicacao: string;
    tipoDocumento: string;
    nomeOrgao: string;
    nomeClasse: string;
    numeroProcessoDigitos: string;
    numeroProcessoMascara: string;
    meio: string;
    link: string;
    numeroComunicacao: number | null;
    texto: string;
    destinatarios: DjenDestinatario[];
    advogados: DjenAdvogado[];
    bancoDetectado: string;
    clienteSugerido: string;
    clienteVinculado: DjenClienteVinculado | null;
}

export interface DjenResultadoConsulta {
    totalRegistros: number;
    pagina: number;
    itensPorPagina: 5 | 100;
    items: DjenComunicacao[];
    urlConsulta: string;
}

function semAcentos(str: string): string {
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

/** Extrai apenas os dígitos do número do processo CNJ. */
export function normalizarNumeroProcessoDjen(raw: string): string {
    return (raw ?? "").replace(/\D/g, "").slice(0, 20);
}

/** Formata 20 dígitos CNJ no padrão NNNNNNN-DD.AAAA.J.TR.OOOO quando aplicável. */
export function formatarNumeroProcessoCnj(raw: string): string {
    const dig = normalizarNumeroProcessoDjen(raw);
    if (dig.length !== 20) return raw.trim();
    return `${dig.slice(0, 7)}-${dig.slice(7, 9)}.${dig.slice(9, 13)}.${dig.slice(13, 14)}.${dig.slice(14, 16)}.${dig.slice(16, 20)}`;
}

/** Remove tags HTML residuais e entidades comuns de publicações do DJEN preservando parágrafos. */
export function limparTextoDjen(raw: string): string {
    if (!raw) return "";
    let txt = raw
        .replace(/<\s*br\s*\/?>/gi, "\n")
        .replace(/<\/\s*(?:p|div|li|tr|h[1-6])\s*>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&#(\d+);/g, (_, dec) => {
            const code = Number(dec);
            return Number.isFinite(code) ? String.fromCharCode(code) : "";
        })
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
            const code = parseInt(hex, 16);
            return Number.isFinite(code) ? String.fromCharCode(code) : "";
        });

    txt = txt
        .split(/\r?\n/)
        .map((line) => line.replace(/[ \t]{2,}/g, " ").trim())
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    return txt;
}

const BANCOS_NORM_SET = new Set(BANCOS_USUAIS.map((b) => semAcentos(b)));
const PREPOSICOES_INICIAIS = new Set(["de", "da", "do", "das", "dos", "e"]);

const RX_INSTITUICAO_BANCARIA =
    /\b(banco rci|rci brasil|banco toyota|banco volkswagen|banco honda|banco gm|banco yamaha|sicredi|sicoob|votorantim|banco|bco|financeira|coop(?:erativa)?\s+de\s+credito|caixa economica|santander|bradesco|itau|bv|cetelem|daycoval|safra|mercantil|banco inter|nubank|nu financeira|banco c6|banco pan|bmg|aymore)\b/;

function iniciaisAdvogado(nomeCompleto: string): string[] {
    const tokens = semAcentos(nomeCompleto)
        .replace(/[^a-z\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean);
    if (tokens.length < 2) return [];
    const completas = tokens.map((t) => t[0]).join("");
    const semPreps = tokens.filter((t) => !PREPOSICOES_INICIAIS.has(t)).map((t) => t[0]).join("");
    return semPreps && semPreps !== completas ? [completas, semPreps] : [completas];
}

function extrairSiglaIniciais(destinatario: string): string | null {
    const norm = semAcentos(destinatario).trim();
    if (!/^(?:[a-z]\.?\s*){2,}$/.test(norm)) return null;
    if (!norm.includes(".") && norm.length > 5) return null;
    const tokens = norm
        .replace(/\./g, " ")
        .split(/\s+/)
        .filter(Boolean);
    if (tokens.length < 2 || !tokens.every((t) => t.length === 1)) return null;
    return tokens.join("");
}

export function ehAdvogadoDoProcesso(nomeDestinatario: string, advogados: DjenAdvogado[]): boolean {
    const destNorm = semAcentos(nomeDestinatario);
    if (!destNorm) return false;

    const nomesAdv = [
        OAB_ESCRITORIO_PADRAO.nomeAdvogado,
        ...advogados.map((a) => a.nome).filter(Boolean),
    ];

    const siglaDest = extrairSiglaIniciais(destinatarioLimpo(nomeDestinatario));

    for (const advNome of nomesAdv) {
        const advNorm = semAcentos(advNome);
        if (!advNorm) continue;
        if (destNorm === advNorm || nomeCorresponde(destNorm, advNorm)) {
            return true;
        }
        if (siglaDest && iniciaisAdvogado(advNome).includes(siglaDest)) {
            return true;
        }
    }
    return false;
}

function destinatarioLimpo(nome: string): string {
    return nome.replace(/\s+/g, " ").trim();
}

function ehInstituicaoFinanceira(nome: string): boolean {
    const clean = nome.trim();
    if (!clean) return false;
    const normalizado = normalizarBancoInput(clean);
    const norm = semAcentos(clean);
    return (
        BANCOS_NORM_SET.has(semAcentos(normalizado)) ||
        semAcentos(normalizado) !== norm ||
        RX_INSTITUICAO_BANCARIA.test(norm)
    );
}

function correspondeAoBanco(nomeParte: string, bancoDetectado: string): boolean {
    if (!bancoDetectado) return false;
    const bancoNorm = semAcentos(bancoDetectado);
    const parteNorm = semAcentos(nomeParte);
    if (!parteNorm) return false;
    if (parteNorm === bancoNorm) return true;
    const normViaAlias = semAcentos(normalizarBancoInput(nomeParte));
    return normViaAlias === bancoNorm;
}

function detectarBancoEmTexto(texto: string): string {
    if (!texto) return "";
    const m = texto.match(
        /\b(?:BANCO\s+(?:DO\s+BRASIL|BRADESCO|SANTANDER|ITAU|ITAÚ|PAN|BV|BMG|SAFRA|DAYCOVAL|CETELEM|RCI(?:\s+BRASIL)?|TOYOTA(?:\s+DO\s+BRASIL)?|VOLKSWAGEN|HONDA|GM|YAMAHA|INTER|C6|MERCANTIL|SICOOB|SICREDI)(?:\s+S\.?A\.?)?|ITA[UÚ]\s+UNIBANCO(?:\s+S\.?A\.?)?|CAIXA\s+ECON[OÔ]MICA\s+FEDERAL|SANTANDER\s+SOCIEDADE\s+DE\s+CR[EÉ]DITO[^.\n,;]*|NU\s+FINANCEIRA(?:\s+S\.?A\.?)?|BANCO\s+VOTORANTIM(?:\s+S\.?A\.?)?)/i,
    );
    return m ? normalizarBancoInput(m[0].trim()) : "";
}

function detectarBancoEmDestinatarios(destinatariosNaoAdvogados: DjenDestinatario[], texto = ""): string {
    for (const d of destinatariosNaoAdvogados) {
        const nome = d.nome.trim();
        if (!nome) continue;
        if (ehInstituicaoFinanceira(nome)) {
            return normalizarBancoInput(nome);
        }
    }
    return detectarBancoEmTexto(texto);
}

function sugerirClienteEmDestinatarios(
    destinatariosNaoAdvogados: DjenDestinatario[],
    bancoDetectado: string,
    texto = "",
): string {
    const poloAtivo = destinatariosNaoAdvogados.find((d) => {
        const p = semAcentos(d.polo);
        return (p === "a" || p.includes("ativ") || p.includes("autor")) && !correspondeAoBanco(d.nome, bancoDetectado);
    });
    if (poloAtivo) return poloAtivo.nome.trim();

    const naoBanco = destinatariosNaoAdvogados.find((d) => {
        const n = semAcentos(d.nome);
        if (!n) return false;
        if (correspondeAoBanco(d.nome, bancoDetectado) || ehInstituicaoFinanceira(d.nome)) return false;
        return true;
    });
    if (naoBanco) return naoBanco.nome.trim();

    if (destinatariosNaoAdvogados.length > 0) {
        return destinatariosNaoAdvogados[0].nome.trim();
    }

    const mAutor = texto.match(
        /\b(?:AUTOR(?:A)?|EXEQUENTE|REQUERENTE|AGRAVANTE|APELANTE|RECLAMANTE)\s*[:-]\s*([^\n.;]{3,90})/i,
    );
    return mAutor ? mAutor[1].trim() : "";
}

function detectarParteContraria(
    destinatariosNaoAdvogados: DjenDestinatario[],
    clienteSugerido: string,
): string {
    if (destinatariosNaoAdvogados.length < 2) return "";
    const cliNorm = semAcentos(clienteSugerido);
    const cliItem = destinatariosNaoAdvogados.find((d) => semAcentos(d.nome) === cliNorm);
    const poloCliente = semAcentos(cliItem?.polo ?? "");

    const poloOposto = destinatariosNaoAdvogados.find((d) => {
        if (semAcentos(d.nome) === cliNorm) return false;
        const p = semAcentos(d.polo);
        return Boolean(poloCliente && p && p !== poloCliente);
    });
    if (poloOposto) return poloOposto.nome.trim();

    const outro = destinatariosNaoAdvogados.find((d) => semAcentos(d.nome) !== cliNorm);
    return outro?.nome.trim() ?? "";
}

function formatarDataBrFallback(iso: string, br?: string): string {
    if (br && /^\d{2}\/\d{2}\/\d{4}$/.test(br.trim())) return br.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(iso)) {
        const [a, m, d] = iso.slice(0, 10).split("-");
        return `${d}/${m}/${a}`;
    }
    return iso;
}

function mapearItemDjen(raw: Record<string, unknown>): DjenComunicacao {
    const digitos = normalizarNumeroProcessoDjen(
        String(raw.numero_processo ?? raw.numeroprocesso ?? raw.numeroprocessocommascara ?? ""),
    );
    const mascaraRaw = String(raw.numeroprocessocommascara ?? "").trim();
    const numeroProcessoMascara =
        mascaraRaw || (digitos ? formatarNumeroProcessoCnj(digitos) : "");

    const dataIso = String(raw.data_disponibilizacao ?? "").slice(0, 10);
    const dataBr = formatarDataBrFallback(dataIso, String(raw.datadisponibilizacao ?? ""));

    const destRaw = Array.isArray(raw.destinatarios) ? raw.destinatarios : [];
    const destinatarios: DjenDestinatario[] = destRaw
        .filter((d): d is Record<string, unknown> => Boolean(d && typeof d === "object"))
        .map((d) => ({
            nome: String(d.nome ?? "").trim(),
            polo: String(d.polo ?? "").trim(),
        }))
        .filter((d) => d.nome.length > 0);

    const advRaw = Array.isArray(raw.destinatarioadvogados) ? raw.destinatarioadvogados : [];
    const advogados: DjenAdvogado[] = advRaw
        .filter((a): a is Record<string, unknown> => Boolean(a && typeof a === "object"))
        .map((a) => {
            const inner = (a.advogado && typeof a.advogado === "object"
                ? a.advogado
                : a) as Record<string, unknown>;
            return {
                nome: String(inner.nome ?? "").trim(),
                numeroOab: String(inner.numero_oab ?? inner.numeroOab ?? "").trim(),
                ufOab: String(inner.uf_oab ?? inner.ufOab ?? "").trim(),
            };
        })
        .filter((a) => a.nome.length > 0 || a.numeroOab.length > 0);

    const texto = limparTextoDjen(String(raw.texto ?? ""));
    const destinatariosNaoAdvogados = destinatarios.filter(
        (d) => !ehAdvogadoDoProcesso(d.nome, advogados),
    );
    let bancoDetectado = detectarBancoEmDestinatarios(destinatariosNaoAdvogados, texto);
    const clienteSugerido = sugerirClienteEmDestinatarios(
        destinatariosNaoAdvogados,
        bancoDetectado,
        texto,
    );
    if (!bancoDetectado && destinatariosNaoAdvogados.length >= 2) {
        bancoDetectado = detectarParteContraria(destinatariosNaoAdvogados, clienteSugerido);
    }

    return {
        id: Number(raw.id) || 0,
        dataDisponibilizacao: dataIso,
        dataDisponibilizacaoBr: dataBr,
        siglaTribunal: String(raw.siglaTribunal ?? "").trim(),
        tipoComunicacao: String(raw.tipoComunicacao ?? "Comunicação").trim(),
        tipoDocumento: String(raw.tipoDocumento ?? "").trim(),
        nomeOrgao: String(raw.nomeOrgao ?? "").trim(),
        nomeClasse: String(raw.nomeClasse ?? "").trim(),
        numeroProcessoDigitos: digitos,
        numeroProcessoMascara,
        meio: String(raw.meiocompleto ?? raw.meio ?? "").trim(),
        link: String(raw.link ?? "").trim(),
        numeroComunicacao:
            raw.numeroComunicacao != null && Number.isFinite(Number(raw.numeroComunicacao))
                ? Number(raw.numeroComunicacao)
                : null,
        texto,
        destinatarios,
        advogados,
        bancoDetectado,
        clienteSugerido,
        clienteVinculado: null,
    };
}

/**
 * Consulta a API pública oficial do DJEN (Comunica PJe / CNJ).
 * Respeita os valores aceitos pela especificação OpenAPI do CNJ (itensPorPagina: 5 ou 100).
 */
export async function consultarDjen(
    filtro: DjenFiltroConsulta,
    fetchFn: typeof fetch = fetch,
): Promise<DjenResultadoConsulta> {
    const params = new URLSearchParams();

    const numProc = filtro.numeroProcesso ? normalizarNumeroProcessoDjen(filtro.numeroProcesso) : "";
    if (numProc) params.set("numeroProcesso", numProc);

    const oab = filtro.numeroOab?.replace(/\D/g, "").trim();
    if (oab) params.set("numeroOab", oab);

    const uf = filtro.ufOab?.trim().toUpperCase();
    if (uf) params.set("ufOab", uf);

    if (filtro.nomeParte?.trim()) params.set("nomeParte", filtro.nomeParte.trim());
    if (filtro.nomeAdvogado?.trim()) params.set("nomeAdvogado", filtro.nomeAdvogado.trim());
    if (filtro.siglaTribunal?.trim()) params.set("siglaTribunal", filtro.siglaTribunal.trim().toUpperCase());
    if (filtro.texto?.trim()) params.set("texto", filtro.texto.trim());
    if (filtro.dataDisponibilizacaoInicio?.trim()) {
        params.set("dataDisponibilizacaoInicio", filtro.dataDisponibilizacaoInicio.trim().slice(0, 10));
    }
    if (filtro.dataDisponibilizacaoFim?.trim()) {
        params.set("dataDisponibilizacaoFim", filtro.dataDisponibilizacaoFim.trim().slice(0, 10));
    }
    if (filtro.meio === "D" || filtro.meio === "E") {
        params.set("meio", filtro.meio);
    }

    const temFiltroPrincipal = Boolean(
        numProc ||
            oab ||
            filtro.nomeParte?.trim() ||
            filtro.nomeAdvogado?.trim() ||
            filtro.siglaTribunal?.trim() ||
            filtro.texto?.trim(),
    );
    if (!temFiltroPrincipal) {
        throw new Error(
            "Informe o número do processo CNJ, OAB, nome da parte, nome do advogado, tribunal ou palavra-chave para consultar o DJEN.",
        );
    }

    const pagina = Math.max(1, Math.round(filtro.pagina ?? 1));
    const itensPorPagina: 5 | 100 = filtro.itensPorPagina === 5 ? 5 : 100;
    params.set("pagina", String(pagina));
    params.set("itensPorPagina", String(itensPorPagina));

    const urlConsulta = `${DJEN_API_URL}?${params.toString()}`;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 12_000);

    try {
        const res = await fetchFn(urlConsulta, {
            headers: { Accept: "application/json" },
            signal: ctl.signal,
        });

        if (res.status === 429) {
            throw new Error(
                "Limite temporário de requisições da API do DJEN (CNJ) atingido. Aguarde 1 minuto e tente novamente.",
            );
        }

        if (!res.ok) {
            const detail = await res.text().catch(() => "");
            throw new Error(
                `Falha ao consultar DJEN (${res.status}): ${detail.slice(0, 180) || "erro na API do CNJ"}`,
            );
        }

        const json = (await res.json()) as {
            count?: number;
            items?: unknown;
        };

        const rawItems = Array.isArray(json.items) ? json.items : [];
        const items = rawItems
            .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
            .map(mapearItemDjen);

        return {
            totalRegistros: Number(json.count) || items.length,
            pagina,
            itensPorPagina,
            items,
            urlConsulta,
        };
    } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
            throw new Error("A API do DJEN (comunicaapi.pje.jus.br) demorou para responder. Tente novamente.");
        }
        throw err;
    } finally {
        clearTimeout(timer);
    }
}

const STOPWORDS_NOME = new Set([
    "de",
    "da",
    "do",
    "das",
    "dos",
    "e",
    "me",
    "epp",
    "ltda",
    "s",
    "a",
    "sa",
    "s/a",
    "eireli",
]);

function extrairTokensNome(valor: string): string[] {
    const normalizado = semAcentos(valor)
        .replace(/\bs\/a\b/g, " ")
        .replace(/[^a-z0-9\s]/g, " ");
    return normalizado
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && !STOPWORDS_NOME.has(t));
}

function nomeCorresponde(destinatario: string, clienteNome: string): boolean {
    const tokensDest = extrairTokensNome(destinatario);
    const tokensCliente = extrairTokensNome(clienteNome);
    if (tokensCliente.length < 2 || tokensDest.length < 2) return false;
    if (tokensCliente.length !== tokensDest.length) return false;
    const tokensDestSet = new Set(tokensDest);
    const tokensClienteSet = new Set(tokensCliente);
    return (
        tokensCliente.every((t) => tokensDestSet.has(t)) &&
        tokensDest.every((t) => tokensClienteSet.has(t))
    );
}

/**
 * Cruza publicações retornadas pelo DJEN com a carteira de clientes salvos no banco,
 * priorizando correspondência exata pelos 20 dígitos CNJ e usando nome completo como fallback.
 */
export function cruzarComunicacoesComCarteira(
    comunicacoes: DjenComunicacao[],
    calculos: CalculoSalvo[],
    categorias: Categoria[] = [],
): DjenComunicacao[] {
    const mapaCategorias = new Map(categorias.map((c) => [c.id, c.nome]));
    const porCnj = new Map<string, CalculoSalvo>();

    for (const c of calculos) {
        const dig = normalizarNumeroProcessoDjen(c.processo_global || "");
        if (dig.length === 20 && !porCnj.has(dig)) {
            porCnj.set(dig, c);
        }
    }

    return comunicacoes.map((com) => {
        const matchCnj = com.numeroProcessoDigitos ? porCnj.get(com.numeroProcessoDigitos) : undefined;
        if (matchCnj) {
            return {
                ...com,
                clienteVinculado: {
                    id: matchCnj.id,
                    clienteNome: matchCnj.cliente_nome,
                    banco: matchCnj.banco,
                    faseKanban: matchCnj.categoria_id
                        ? mapaCategorias.get(matchCnj.categoria_id) ?? "Sem categoria"
                        : "Sem categoria",
                    processoGlobal: matchCnj.processo_global,
                    valorTotalAcao: Number(matchCnj.valor_total_acao) || Number(matchCnj.diferenca_total) || 0,
                    correspondenciaPor: "cnj",
                },
            };
        }

        for (const c of calculos) {
            const cnjSalvo = normalizarNumeroProcessoDjen(c.processo_global || "");
            if (cnjSalvo.length === 20 && com.numeroProcessoDigitos.length === 20) {
                continue;
            }
            if (
                com.destinatarios.some(
                    (d) => !ehAdvogadoDoProcesso(d.nome, com.advogados) && nomeCorresponde(d.nome, c.cliente_nome),
                )
            ) {
                return {
                    ...com,
                    clienteVinculado: {
                        id: c.id,
                        clienteNome: c.cliente_nome,
                        banco: c.banco,
                        faseKanban: c.categoria_id
                            ? mapaCategorias.get(c.categoria_id) ?? "Sem categoria"
                            : "Sem categoria",
                        processoGlobal: c.processo_global,
                        valorTotalAcao: Number(c.valor_total_acao) || Number(c.diferenca_total) || 0,
                        correspondenciaPor: "nome",
                    },
                };
            }
        }

        return com;
    });
}

function ehNomePessoaJuridica(nome: string): boolean {
    const norm = semAcentos(nome).toUpperCase();
    return /(?:^|\b)(?:LTDA|S\.A\.?|S\/A|ME|EPP|EIRELI|ASSOCIACAO|COOPERATIVA|COMERCIO|TRANSPORTADORA|DISTRIBUIDORA|FRUTICULTURA)(?:\b|$)/.test(
        norm,
    );
}

function extrairValorEstimadoTexto(texto: string): number {
    if (!texto) return 0;
    const mPrio = texto.match(
        /valor\s+(?:da\s+causa|da\s+a[cç][aã]o|da\s+execu[cç][aã]o|atualizado|do\s+d[eé]bito|da\s+condena[cç][aã]o)\s*(?:de|:)?\s*R\$\s*([\d.]+,\d{2})/i,
    );
    const cand = mPrio?.[1] ?? texto.match(/R\$\s*([\d.]+,\d{2})/i)?.[1];
    if (!cand) return 0;
    const val = parseFloat(cand.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(val) || val <= 0 || val >= 100_000_000) return 0;
    return Math.round(val * 100) / 100;
}

function extrairDocumentoContratoTexto(texto: string): string {
    if (!texto) return "";
    const m = texto.match(
        /\b(?:contrato|ccb|c[eé]dula)\s*(?:[^\n:;]{0,20}?)(?:n[ºo°.]*|:|#)\s*([A-Z0-9./-]*\d[A-Z0-9./-]{1,22})/i,
    );
    return m ? m[1].replace(/[./-]+$/, "").trim().slice(0, 80) : "";
}

export interface DadosCarteiraExtraidosDjen {
    ficha: FichaCliente;
    modalidadeId: string;
    mesContrato: string;
    valorEstimadoAcao: number;
    categoriaNomeSugerida: string;
}

/**
 * Extrai metadados de cliente, parte contrária/banco, fase sugerida, modalidade provável
 * e valor estimado de uma publicação do DJEN para cadastro direto na carteira.
 */
export function extrairDadosCarteiraDeDjen(
    item: DjenComunicacao,
    categorias: Categoria[] = [],
): DadosCarteiraExtraidosDjen {
    const contexto = semAcentos(`${item.nomeClasse} ${item.texto.slice(0, 1200)}`);

    let categoriaNomeSugerida = "Ajuizado";
    if (contexto.includes("busca e apreens") || contexto.includes("alienacao fiduciaria")) {
        categoriaNomeSugerida = "Busca e Apreensão";
    } else if (contexto.includes("superendividamento")) {
        categoriaNomeSugerida = "Superendividamento";
    } else if (contexto.includes("revisional")) {
        categoriaNomeSugerida = "Revisional";
    }

    const catAlvoNorm = semAcentos(categoriaNomeSugerida);
    const catMatch = categorias.find((c) => semAcentos(c.nome) === catAlvoNorm) ?? null;

    const clienteNome = (
        item.clienteSugerido.trim() ||
        (item.numeroProcessoMascara ? `Processo ${item.numeroProcessoMascara}` : `Publicação DJEN ${item.id}`)
    ).slice(0, 160);

    const isPj = ehNomePessoaJuridica(clienteNome);
    let modalidadeId = isPj ? "capital-giro-pj" : "sem-garantia";
    if (contexto.includes("busca e apreens") || contexto.includes("alienacao fiduciaria") || /\bveicul/.test(contexto)) {
        modalidadeId = isPj ? "veiculo-pj" : "veiculo-pf";
    } else if (/\bcheque especial\b/.test(contexto)) {
        modalidadeId = isPj ? "cheque-especial-pj" : "cheque-especial-pf";
    } else if (/\bcartao\b/.test(contexto)) {
        modalidadeId = "cartao-parcelado";
    } else if (/\bconsignad/.test(contexto)) {
        modalidadeId = "consig-inss";
    }

    const mesHoje = hojeISO().slice(0, 7);
    const mesCand = (item.dataDisponibilizacao || "").slice(0, 7);
    const mesContrato = /^\d{4}-(0[1-9]|1[0-2])$/.test(mesCand) && mesCand <= mesHoje ? mesCand : mesHoje;

    const valorEstimadoAcao = extrairValorEstimadoTexto(item.texto);
    const documentoContrato = extrairDocumentoContratoTexto(item.texto);

    const resumoTexto =
        item.texto.length > 1400 ? `${item.texto.slice(0, 1400).trim()}...` : item.texto;
    const cabecalho = [
        `[DJEN ${item.dataDisponibilizacaoBr || item.dataDisponibilizacao}`,
        item.siglaTribunal,
        item.nomeOrgao,
        item.nomeClasse,
        item.tipoComunicacao,
    ]
        .filter(Boolean)
        .join(" · ");
    const observacoes = [`${cabecalho}]`, resumoTexto, item.link ? `Link: ${item.link}` : ""]
        .filter(Boolean)
        .join("\n")
        .slice(0, 4000);

    return {
        ficha: {
            clienteNome,
            processoGlobal: item.numeroProcessoMascara.trim().slice(0, 80),
            banco: item.bancoDetectado.trim().slice(0, 100),
            documentoContrato,
            categoriaId: catMatch?.id ?? null,
            observacoes,
        },
        modalidadeId,
        mesContrato,
        valorEstimadoAcao,
        categoriaNomeSugerida,
    };
}

export type StatusProcessoDjen = "prazo_aberto" | "em_analise" | "manifestado" | "concluido";

export interface DjenMovimentacaoSalva {
    id: number;
    dataDisponibilizacao: string;
    dataDisponibilizacaoBr: string;
    tribunal: string;
    orgao: string;
    classe: string;
    tipoComunicacao: string;
    texto: string;
    link: string;
    numeroComunicacao: number | null;
}

export interface DjenOrigemSalva {
    id?: number;
    dataDisponibilizacao?: string;
    dataDisponibilizacaoBr?: string;
    tribunal?: string;
    orgao?: string;
    classe?: string;
    tipoComunicacao?: string;
    link?: string;
    numeroComunicacao?: number | null;
    destinatarios?: DjenDestinatario[];
    advogados?: DjenAdvogado[];
    statusProcesso?: StatusProcessoDjen;
    anotacoesInternas?: string;
    movimentacoes?: DjenMovimentacaoSalva[];
    /** ISO da última verificação automática de novas publicações deste processo. */
    ultimaSincronizacao?: string;
    /** IDs de publicações trazidas pela verificação automática e ainda não abertas. */
    idsNovos?: number[];
}

export interface ProcessoDjenSalvoView {
    id: string;
    clienteNome: string;
    parteContraria: string;
    processoGlobal: string;
    categoriaId: string | null;
    tribunal: string;
    orgao: string;
    classe: string;
    tipoComunicacao: string;
    dataUltimaPublicacao: string;
    dataUltimaPublicacaoBr: string;
    linkUltimaPublicacao: string;
    destinatarios: DjenDestinatario[];
    advogados: DjenAdvogado[];
    statusProcesso: StatusProcessoDjen;
    anotacoesInternas: string;
    movimentacoes: DjenMovimentacaoSalva[];
    valorCitado: number;
    ultimaSincronizacao: string;
    idsNovos: number[];
}

function comunicacaoParaMovimentacao(item: DjenComunicacao): DjenMovimentacaoSalva {
    return {
        id: item.id,
        dataDisponibilizacao: item.dataDisponibilizacao,
        dataDisponibilizacaoBr:
            item.dataDisponibilizacaoBr || formatarDataBrFallback(item.dataDisponibilizacao),
        tribunal: item.siglaTribunal,
        orgao: item.nomeOrgao,
        classe: item.nomeClasse,
        tipoComunicacao: item.tipoComunicacao || "Comunicação",
        texto: item.texto,
        link: item.link,
        numeroComunicacao: item.numeroComunicacao,
    };
}

/**
 * Monta payload completo e válido para inserir imediatamente um processo do DJEN
 * na tabela do Supabase, preservando partes, advogados e movimentações completas.
 */
export function criarPayloadCarteiraDeDjen(
    item: DjenComunicacao,
    categorias: Categoria[] = [],
    overrides: Partial<FichaCliente> = {},
): CalculoPayload {
    const extraido = extrairDadosCarteiraDeDjen(item, categorias);
    const movInicial = comunicacaoParaMovimentacao(item);
    const origemDjen: DjenOrigemSalva = {
        id: item.id,
        dataDisponibilizacao: item.dataDisponibilizacao,
        dataDisponibilizacaoBr: movInicial.dataDisponibilizacaoBr,
        tribunal: item.siglaTribunal,
        orgao: item.nomeOrgao,
        classe: item.nomeClasse,
        tipoComunicacao: item.tipoComunicacao,
        link: item.link,
        numeroComunicacao: item.numeroComunicacao,
        destinatarios: item.destinatarios,
        advogados: item.advogados,
        statusProcesso: "prazo_aberto",
        anotacoesInternas: "",
        movimentacoes: [movInicial],
    };

    return fichaSemCalculoParaPayload(
        {
            ...extraido.ficha,
            ...overrides,
        },
        {
            modalidadeId: extraido.modalidadeId,
            mesContrato: extraido.mesContrato,
            valorEstimadoAcao: extraido.valorEstimadoAcao,
            origemDjen: origemDjen as unknown as Record<string, unknown>,
        },
    );
}

const STATUS_PROCESSO_VALIDOS = new Set<StatusProcessoDjen>([
    "prazo_aberto",
    "em_analise",
    "manifestado",
    "concluido",
]);

function extrairMovimentacoesLegadasObservacoes(
    c: CalculoSalvo,
    origem?: DjenOrigemSalva,
): DjenMovimentacaoSalva[] {
    const obs = (c.observacoes ?? "").trim();
    const dataFallbackIso = origem?.dataDisponibilizacao || c.updated_at.slice(0, 10);
    const dataFallbackBr =
        origem?.dataDisponibilizacaoBr || formatarDataBrFallback(dataFallbackIso);

    if (!obs) {
        if (!origem?.tribunal && !origem?.orgao && !origem?.classe && !origem?.link) return [];
        return [
            {
                id: Number(origem?.id) || 1,
                dataDisponibilizacao: dataFallbackIso,
                dataDisponibilizacaoBr: dataFallbackBr,
                tribunal: origem?.tribunal ?? "",
                orgao: origem?.orgao ?? "",
                classe: origem?.classe ?? "",
                tipoComunicacao: origem?.tipoComunicacao ?? "Comunicação",
                texto: "",
                link: origem?.link ?? "",
                numeroComunicacao: origem?.numeroComunicacao ?? null,
            },
        ];
    }

    const linkMatch = obs.match(/^Link:\s*(https?:\/\/\S+)/im);
    const linkExtraido = origem?.link || linkMatch?.[1] || "";

    const cabMatch = obs.match(/^\[DJEN\s+([^\]]+)\]\s*\n?/i);
    let dataBr = dataFallbackBr;
    let tribunal = origem?.tribunal ?? "";
    let orgao = origem?.orgao ?? "";
    let classe = origem?.classe ?? "";
    let tipo = origem?.tipoComunicacao ?? "Comunicação";

    if (cabMatch) {
        const partesCab = cabMatch[1]
            .split("·")
            .map((p) => p.trim())
            .filter(Boolean);
        if (partesCab[0] && /\d{2}\/\d{2}\/\d{4}/.test(partesCab[0])) {
            dataBr = partesCab[0];
        }
        if (!tribunal && partesCab[1]) tribunal = partesCab[1];
        if (!orgao && partesCab[2]) orgao = partesCab[2];
        if (!classe && partesCab[3]) classe = partesCab[3];
        if (!origem?.tipoComunicacao && partesCab[4]) tipo = partesCab[4];
    }

    const textoLimpo = obs
        .replace(/^\[DJEN\s+[^\]]+\]\s*/i, "")
        .replace(/\n*Link:\s*https?:\/\/\S+\s*$/i, "")
        .trim();

    return [
        {
            id: Number(origem?.id) || 1,
            dataDisponibilizacao: dataFallbackIso,
            dataDisponibilizacaoBr: dataBr,
            tribunal,
            orgao,
            classe,
            tipoComunicacao: tipo,
            texto: textoLimpo,
            link: linkExtraido,
            numeroComunicacao: origem?.numeroComunicacao ?? null,
        },
    ];
}

/**
 * Extrai a visualização completa e normalizada de um processo salvo no DJEN,
 * com compatibilidade retroativa para fichas gravadas antes da inclusão da linha do tempo.
 */
export function lerDadosProcessoDjen(c: CalculoSalvo): ProcessoDjenSalvoView {
    const dc = (c.dados_completos ?? {}) as { origemDjen?: DjenOrigemSalva };
    const origem = dc.origemDjen;

    const statusCandidato = origem?.statusProcesso;
    const statusProcesso: StatusProcessoDjen =
        statusCandidato && STATUS_PROCESSO_VALIDOS.has(statusCandidato)
            ? statusCandidato
            : "prazo_aberto";

    const movsBrutas =
        Array.isArray(origem?.movimentacoes) && origem.movimentacoes.length > 0
            ? origem.movimentacoes
            : extrairMovimentacoesLegadasObservacoes(c, origem);

    const movimentacoes = [...movsBrutas].sort((a, b) =>
        (b.dataDisponibilizacao || "").localeCompare(a.dataDisponibilizacao || ""),
    );

    const maisRecente = movimentacoes[0];
    const dataUltima =
        maisRecente?.dataDisponibilizacao || origem?.dataDisponibilizacao || c.updated_at.slice(0, 10);

    return {
        id: c.id,
        clienteNome: c.cliente_nome,
        parteContraria: c.banco ?? "",
        processoGlobal: c.processo_global ?? "",
        categoriaId: c.categoria_id ?? null,
        tribunal: maisRecente?.tribunal || origem?.tribunal || "",
        orgao: maisRecente?.orgao || origem?.orgao || "",
        classe: maisRecente?.classe || origem?.classe || "",
        tipoComunicacao: maisRecente?.tipoComunicacao || origem?.tipoComunicacao || "Comunicação",
        dataUltimaPublicacao: dataUltima,
        dataUltimaPublicacaoBr:
            maisRecente?.dataDisponibilizacaoBr ||
            origem?.dataDisponibilizacaoBr ||
            formatarDataBrFallback(dataUltima),
        linkUltimaPublicacao: maisRecente?.link || origem?.link || "",
        destinatarios: Array.isArray(origem?.destinatarios) ? origem.destinatarios : [],
        advogados: Array.isArray(origem?.advogados) ? origem.advogados : [],
        statusProcesso,
        anotacoesInternas: origem?.anotacoesInternas ?? "",
        movimentacoes,
        valorCitado: Number(c.valor_total_acao) || 0,
        ultimaSincronizacao: origem?.ultimaSincronizacao ?? "",
        idsNovos: Array.isArray(origem?.idsNovos) ? origem.idsNovos.map(Number).filter((n) => n > 0) : [],
    };
}

/**
 * Anexa uma nova publicação do DJEN ao processo salvo (sem duplicar o mesmo id de comunicação).
 */
export function anexarMovimentacaoDjenAoProcesso(
    c: CalculoSalvo,
    item: DjenComunicacao,
): Partial<CalculoPayload> {
    const view = lerDadosProcessoDjen(c);
    const dcRaw = (c.dados_completos ?? {}) as Record<string, unknown>;
    const origemPrev = (dcRaw.origemDjen ?? {}) as DjenOrigemSalva;
    const novaMov = comunicacaoParaMovimentacao(item);

    const jaExiste =
        novaMov.id > 0 && view.movimentacoes.some((m) => Number(m.id) === Number(novaMov.id));
    const movimentacoesAtualizadas = jaExiste
        ? view.movimentacoes.map((m) => (Number(m.id) === Number(novaMov.id) ? novaMov : m))
        : [novaMov, ...view.movimentacoes];

    const destinatarios =
        item.destinatarios.length > 0 ? item.destinatarios : view.destinatarios;
    const advogados = item.advogados.length > 0 ? item.advogados : view.advogados;

    const origemAtualizada: DjenOrigemSalva = {
        ...origemPrev,
        id: item.id || origemPrev.id,
        dataDisponibilizacao: item.dataDisponibilizacao || origemPrev.dataDisponibilizacao,
        dataDisponibilizacaoBr:
            item.dataDisponibilizacaoBr ||
            novaMov.dataDisponibilizacaoBr ||
            origemPrev.dataDisponibilizacaoBr,
        tribunal: item.siglaTribunal || origemPrev.tribunal,
        orgao: item.nomeOrgao || origemPrev.orgao,
        classe: item.nomeClasse || origemPrev.classe,
        tipoComunicacao: item.tipoComunicacao || origemPrev.tipoComunicacao,
        link: item.link || origemPrev.link,
        numeroComunicacao: item.numeroComunicacao ?? origemPrev.numeroComunicacao ?? null,
        destinatarios,
        advogados,
        statusProcesso: view.statusProcesso,
        anotacoesInternas: view.anotacoesInternas,
        movimentacoes: movimentacoesAtualizadas,
    };

    const obsAtual = (c.observacoes ?? "").trim();
    const resumoTrecho =
        item.texto.length > 420 ? `${item.texto.slice(0, 420).trim()}...` : item.texto;
    const nota = `[DJEN ${novaMov.dataDisponibilizacaoBr} · ${item.siglaTribunal} · ${item.nomeOrgao}]: ${resumoTrecho}`;
    const obsAtualizada = (
        obsAtual
            ? obsAtual.includes(resumoTrecho)
                ? obsAtual
                : `${nota}\n${obsAtual}`
            : nota
    ).slice(0, 4000);

    const patch: Partial<CalculoPayload> = {
        observacoes: obsAtualizada,
        dados_completos: {
            ...dcRaw,
            pendenteCalculo:
                typeof dcRaw.pendenteCalculo === "boolean" ? dcRaw.pendenteCalculo : isCalculoPendente(c),
            origemDjen: origemAtualizada,
        } as unknown as Partial<ProcessoRevisionalInput>,
    };

    if (!c.processo_global?.trim() && item.numeroProcessoMascara.trim()) {
        patch.processo_global = item.numeroProcessoMascara.trim().slice(0, 80);
    }

    const valorExtraido = extrairValorEstimadoTexto(item.texto);
    if ((Number(c.valor_total_acao) || 0) === 0 && valorExtraido > 0) {
        patch.valor_total_acao = valorExtraido;
    }

    return patch;
}

/**
 * Monta atualização parcial da ficha e metadados de um processo salvo pelo DJEN.
 */
export function atualizarFichaProcessoDjen(
    c: CalculoSalvo,
    patch: {
        clienteNome?: string;
        parteContraria?: string;
        processoGlobal?: string;
        categoriaId?: string | null;
        statusProcesso?: StatusProcessoDjen;
        anotacoesInternas?: string;
    },
): Partial<CalculoPayload> {
    const view = lerDadosProcessoDjen(c);
    const dcRaw = (c.dados_completos ?? {}) as Record<string, unknown>;
    const origemPrev = (dcRaw.origemDjen ?? {}) as DjenOrigemSalva;

    const origemAtualizada: DjenOrigemSalva = {
        ...origemPrev,
        tribunal: origemPrev.tribunal || view.tribunal,
        orgao: origemPrev.orgao || view.orgao,
        classe: origemPrev.classe || view.classe,
        tipoComunicacao: origemPrev.tipoComunicacao || view.tipoComunicacao,
        dataDisponibilizacao: origemPrev.dataDisponibilizacao || view.dataUltimaPublicacao,
        dataDisponibilizacaoBr: origemPrev.dataDisponibilizacaoBr || view.dataUltimaPublicacaoBr,
        link: origemPrev.link || view.linkUltimaPublicacao,
        destinatarios: view.destinatarios,
        advogados: view.advogados,
        movimentacoes: view.movimentacoes,
        statusProcesso: patch.statusProcesso ?? view.statusProcesso,
        anotacoesInternas:
            patch.anotacoesInternas !== undefined
                ? patch.anotacoesInternas
                : view.anotacoesInternas,
    };

    const payloadPatch: Partial<CalculoPayload> = {
        dados_completos: {
            ...dcRaw,
            pendenteCalculo:
                typeof dcRaw.pendenteCalculo === "boolean" ? dcRaw.pendenteCalculo : isCalculoPendente(c),
            origemDjen: origemAtualizada,
        } as unknown as Partial<ProcessoRevisionalInput>,
    };

    if (patch.clienteNome !== undefined) {
        const trimmed = patch.clienteNome.trim().slice(0, 160);
        if (!trimmed) {
            throw new Error("Informe o nome do cliente ou parte antes de salvar.");
        }
        payloadPatch.cliente_nome = trimmed;
    }
    if (patch.parteContraria !== undefined) {
        payloadPatch.banco = patch.parteContraria.trim().slice(0, 100);
    }
    if (patch.processoGlobal !== undefined) {
        payloadPatch.processo_global = patch.processoGlobal.trim().slice(0, 80);
    }
    if (patch.categoriaId !== undefined) {
        payloadPatch.categoria_id = patch.categoriaId || null;
    }

    return payloadPatch;
}

/* ----------------------------------------------------- Verificação automática de publicações */

/** De quanto em quanto tempo cada processo salvo é consultado de novo no DJEN. */
export const INTERVALO_VERIFICACAO_DJEN_HORAS = 4;

/** Folga, em dias, antes da última verificação: cobre publicações disponibilizadas com atraso. */
const FOLGA_JANELA_DIAS = 3;
/** Sem histórico de verificação nem data de publicação, olha os últimos N dias. */
const JANELA_INICIAL_DIAS = 30;
/** Pausa entre consultas para não esbarrar no limite de requisições da API do CNJ. */
const PAUSA_ENTRE_CONSULTAS_MS = 1200;
/** Máximo de páginas de 100 itens por processo e por verificação. */
const MAX_PAGINAS_POR_PROCESSO = 3;

export interface ResultadoVerificacaoDjen {
    verificados: number;
    totalNovas: number;
    processosComNovidade: Array<{ id: string; clienteNome: string; novas: number }>;
    erros: Array<{ id: string; clienteNome: string; mensagem: string }>;
    /** Processos elegíveis que ficaram para a próxima rodada (tempo esgotado ou limite da API). */
    adiados: number;
    interrompidoPorLimite: boolean;
    atualizados: CalculoSalvo[];
}

export interface OpcoesVerificacaoDjen {
    calculos: CalculoSalvo[];
    atualizar: (id: string, patch: Partial<CalculoPayload>) => Promise<CalculoSalvo>;
    /** Versão mais recente do registro no momento de gravar (evita sobrescrever edições feitas durante a consulta). */
    obterAtual?: (id: string) => CalculoSalvo | undefined;
    fetchFn?: typeof fetch;
    agora?: () => Date;
    /** Só consulta processos verificados há mais que isso. 0 = todos. */
    intervaloHoras?: number;
    pausaEntreConsultasMs?: number;
    /** Tempo máximo da rodada; o que sobrar fica para a próxima (funções serverless têm limite). */
    orcamentoMs?: number;
    esperar?: (ms: number) => Promise<void>;
}

function isoDiasAntes(dataIso: string, dias: number): string {
    const base = new Date(`${dataIso.slice(0, 10)}T12:00:00Z`);
    base.setUTCDate(base.getUTCDate() - dias);
    return base.toISOString().slice(0, 10);
}

/** Processos salvos (aba Processos) com CNJ completo, do menos para o mais recentemente verificado. */
export function processosParaVerificarDjen(
    calculos: CalculoSalvo[],
    agora: Date,
    intervaloHoras: number = INTERVALO_VERIFICACAO_DJEN_HORAS,
): CalculoSalvo[] {
    const limite = agora.getTime() - intervaloHoras * 3_600_000;
    return calculos
        .filter((c) => isCalculoPendente(c) && normalizarNumeroProcessoDjen(c.processo_global || "").length === 20)
        .map((c) => ({ c, ultima: Date.parse(lerDadosProcessoDjen(c).ultimaSincronizacao) || 0 }))
        .filter(({ ultima }) => intervaloHoras <= 0 || ultima <= limite)
        .sort((a, b) => a.ultima - b.ultima)
        .map(({ c }) => c);
}

/**
 * Patch que incorpora as publicações novas ao histórico do processo, volta a situação para
 * "prazo em aberto" quando há novidade e registra o horário da verificação.
 */
export function aplicarVerificacaoDjen(
    c: CalculoSalvo,
    itens: DjenComunicacao[],
    verificadoEm: string,
): { patch: Partial<CalculoPayload>; novas: number } {
    const existentes = new Set(lerDadosProcessoDjen(c).movimentacoes.map((m) => Number(m.id)));
    const cnj = normalizarNumeroProcessoDjen(c.processo_global || "");
    const vistos = new Set<number>();
    const novas = itens
        .filter((item) => item.id > 0 && item.numeroProcessoDigitos === cnj && !existentes.has(item.id))
        .filter((item) => (vistos.has(item.id) ? false : (vistos.add(item.id), true)))
        .sort((a, b) => a.dataDisponibilizacao.localeCompare(b.dataDisponibilizacao));

    let atual = c;
    let patch: Partial<CalculoPayload> = {};
    for (const item of novas) {
        const parcial = anexarMovimentacaoDjenAoProcesso(atual, item);
        atual = { ...atual, ...parcial } as CalculoSalvo;
        patch = { ...patch, ...parcial };
    }

    const dc = (atual.dados_completos ?? {}) as Record<string, unknown>;
    const origem = (dc.origemDjen ?? {}) as DjenOrigemSalva;
    const idsNovos = [...new Set([...(origem.idsNovos ?? []).map(Number), ...novas.map((n) => n.id)])];
    const origemAtualizada: DjenOrigemSalva = {
        ...origem,
        ultimaSincronizacao: verificadoEm,
        idsNovos,
        ...(novas.length > 0 ? { statusProcesso: "prazo_aberto" as const } : {}),
    };

    return {
        patch: {
            ...patch,
            dados_completos: { ...dc, origemDjen: origemAtualizada } as unknown as Partial<ProcessoRevisionalInput>,
        },
        novas: novas.length,
    };
}

/** Patch que tira a marca de "nova" das publicações quando o processo é aberto. */
export function marcarPublicacoesDjenComoVistas(c: CalculoSalvo): Partial<CalculoPayload> | null {
    const dc = (c.dados_completos ?? {}) as Record<string, unknown>;
    const origem = dc.origemDjen as DjenOrigemSalva | undefined;
    if (!origem?.idsNovos?.length) return null;
    return {
        dados_completos: {
            ...dc,
            origemDjen: { ...origem, idsNovos: [] },
        } as unknown as Partial<ProcessoRevisionalInput>,
    };
}

/**
 * Consulta o DJEN para cada processo salvo que esteja há mais de `intervaloHoras` sem verificação e
 * anexa as publicações novas ao histórico. Usada pela tela (enquanto o sistema está aberto), pelo
 * botão "Verificar agora" e pelo cron diário da Vercel.
 */
export async function verificarPublicacoesDjen(opts: OpcoesVerificacaoDjen): Promise<ResultadoVerificacaoDjen> {
    const agora = opts.agora ?? (() => new Date());
    const esperar = opts.esperar ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    const pausa = opts.pausaEntreConsultasMs ?? PAUSA_ENTRE_CONSULTAS_MS;
    const orcamento = opts.orcamentoMs ?? 45_000;
    const inicioRodada = agora().getTime();

    const fila = processosParaVerificarDjen(
        opts.calculos,
        agora(),
        opts.intervaloHoras ?? INTERVALO_VERIFICACAO_DJEN_HORAS,
    );
    const resultado: ResultadoVerificacaoDjen = {
        verificados: 0,
        totalNovas: 0,
        processosComNovidade: [],
        erros: [],
        adiados: 0,
        interrompidoPorLimite: false,
        atualizados: [],
    };

    for (let i = 0; i < fila.length; i++) {
        if (agora().getTime() - inicioRodada > orcamento) {
            resultado.adiados = fila.length - i;
            break;
        }
        if (i > 0 && pausa > 0) await esperar(pausa);

        const alvo = fila[i];
        const view = lerDadosProcessoDjen(alvo);
        const hoje = agora().toISOString().slice(0, 10);
        const referencia =
            view.ultimaSincronizacao.slice(0, 10) ||
            view.dataUltimaPublicacao ||
            isoDiasAntes(hoje, JANELA_INICIAL_DIAS);

        try {
            const itens: DjenComunicacao[] = [];
            for (let pagina = 1; pagina <= MAX_PAGINAS_POR_PROCESSO; pagina++) {
                const res = await consultarDjen(
                    {
                        numeroProcesso: alvo.processo_global,
                        dataDisponibilizacaoInicio: isoDiasAntes(referencia, FOLGA_JANELA_DIAS),
                        dataDisponibilizacaoFim: hoje,
                        pagina,
                        itensPorPagina: 100,
                    },
                    opts.fetchFn,
                );
                itens.push(...res.items);
                if (res.items.length < 100) break;
                await esperar(pausa);
            }

            const base = opts.obterAtual?.(alvo.id) ?? alvo;
            const { patch, novas } = aplicarVerificacaoDjen(base, itens, agora().toISOString());
            const atualizado = await opts.atualizar(alvo.id, patch);
            resultado.verificados += 1;
            resultado.atualizados.push(atualizado);
            if (novas > 0) {
                resultado.totalNovas += novas;
                resultado.processosComNovidade.push({ id: alvo.id, clienteNome: alvo.cliente_nome, novas });
            }
        } catch (err) {
            const mensagem = err instanceof Error ? err.message : String(err);
            if (/limite temporário de requisições/i.test(mensagem)) {
                resultado.interrompidoPorLimite = true;
                resultado.adiados = fila.length - i;
                break;
            }
            resultado.erros.push({ id: alvo.id, clienteNome: alvo.cliente_nome, mensagem });
        }
    }

    return resultado;
}
