import { LIMITE_ABUSIVO, brl, mNome, num } from "./index.ts";
import { composicaoCustoContrato, serieSaldoDevedorContrato } from "./graficos-dados.ts";
import { cidadeAssinatura, configEscritorioAtual, formatarOab } from "../config-escritorio.ts";
import {
    INDICES_CORRECAO_OPCOES,
    TIPOS_JUROS_OPCOES,
    type ResultadoProcessoRevisional,
} from "./revisional-pro.ts";

export interface LaudoMetadata {
    clienteNome: string;
    processoGlobal?: string;
    categoriaNome?: string;
    observacoes?: string;
    /** Quando omitido ou true, desenha gráficos vetoriais periciais em cada contrato do PDF. */
    incluirGraficos?: boolean;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatDataBR(iso: string): string {
    if (!iso) return "—";
    if (/^\d{4}-\d{2}$/.test(iso)) return mNome(iso);
    const [a, m, d] = iso.split("-");
    if (!a || !m || !d) return iso;
    return `${d}/${m}/${a}`;
}

export function gerarHtmlLaudoRevisional(res: ResultadoProcessoRevisional, meta: LaudoMetadata): string {
    const p = res.parametros;
    const r = res.resumo;

    const rotuloIndice =
        p.tipoJuros === "SELIC"
            ? "Englobada na Taxa SELIC"
            : (INDICES_CORRECAO_OPCOES.find((o) => o.id === p.indiceCorrecao)?.label ?? p.indiceCorrecao);
    const rotuloJuros =
        p.tipoJuros === "FIXO_CUSTOM"
            ? `Juros simples de ${num(p.jurosFixoMensal)}% a.m.`
            : (TIPOS_JUROS_OPCOES.find((o) => o.id === p.tipoJuros)?.label ?? p.tipoJuros);

    const cliente = escapeHtml(meta.clienteNome.trim() || "Não informado");
    const processo = escapeHtml(meta.processoGlobal?.trim() || "Pré-ajuizamento / Administrativo");
    const categoria = escapeHtml(meta.categoriaNome?.trim() || "Revisional Bancária");
    const dataEmissao = new Date().toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    });

    const contratosHtml = res.contratos
        .map((rc, idx) => {
            const c = rc.contrato;
            const a = rc.analise;
            const linhasHtml = rc.linhas
                .filter((l) => l.paga)
                .map(
                    (l) => `
                <tr>
                    <td>${l.numero}</td>
                    <td>${escapeHtml(formatDataBR(l.vencimento))}${l.conferirVencimento ? " *" : ""}</td>
                    <td class="num">${brl(l.valorDevido)}</td>
                    <td class="num">${brl(l.valorPago)}</td>
                    <td class="num">${brl(l.diferencaBaseRestituicao)}</td>
                    <td class="num">${brl(l.correcao)}</td>
                    <td class="num">${brl(l.juros)}</td>
                    <td class="num bold">${brl(l.totalAtualizado)}</td>
                </tr>`,
                )
                .join("");

            const extrasHtml =
                rc.extras.length > 0
                    ? `
                <h4 class="subtable-title">Pagamentos Extras / Antecipações (${escapeHtml(c.descricao || `Contrato ${idx + 1}`)})</h4>
                <table>
                    <thead>
                        <tr>
                            <th>Descrição</th>
                            <th>Data</th>
                            <th class="num">Valor Base</th>
                            <th class="num">Correção</th>
                            <th class="num">Juros</th>
                            <th class="num">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rc.extras
                            .map(
                                (ex) => `
                            <tr>
                                <td>${escapeHtml(ex.descricao)}</td>
                                <td>${escapeHtml(formatDataBR(ex.data))}</td>
                                <td class="num">${brl(ex.valorBase)}</td>
                                <td class="num">${brl(ex.correcao)}</td>
                                <td class="num">${brl(ex.juros)}</td>
                                <td class="num bold">${brl(ex.total)}</td>
                            </tr>`,
                            )
                            .join("")}
                    </tbody>
                </table>`
                    : "";

            return `
            <section class="section">
                <div class="section-header">
                    <h3>Contrato ${idx + 1}: ${escapeHtml(c.descricao || a.entrada.mod.nome)}</h3>
                    <span class="badge">${escapeHtml(rc.nivel === "abuso" ? "Indício de Abuso" : rc.nivel === "acima" ? "Acima da Média" : "Na Média")} (${num(a.razaoAm, 2)}x)</span>
                </div>

                <div class="meta-grid">
                    <div><span>Instituição:</span> <strong>${escapeHtml(c.instituicao || "Não informada")}</strong></div>
                    <div><span>Nº Contrato:</span> <strong>${escapeHtml(c.numeroContrato || "—")}</strong></div>
                    <div><span>Modalidade:</span> <strong>${escapeHtml(a.entrada.mod.nome)} (${escapeHtml(String(c.pessoa).toUpperCase())})</strong></div>
                    <div><span>Data Contratação:</span> <strong>${escapeHtml(formatDataBR(c.dataContrato))}</strong></div>
                    <div><span>Valor Financiado:</span> <strong>${brl(c.valorFinanciado)}</strong></div>
                    <div><span>Parcelas:</span> <strong>${c.parcelas}x de ${brl(c.valorParcela)} (${c.pagas} pagas)</strong></div>
                    <div><span>Taxa Contrato:</span> <strong>${num(a.contratoAm)}% a.m. / ${num(a.contratoAa)}% a.a.</strong></div>
                    <div><span>Taxa Revisional:</span> <strong>${num(rc.taxaRevisionalAm)}% a.m. / ${num(rc.taxaRevisionalAa)}% a.a.</strong></div>
                    <div class="full"><span>Fonte da Taxa Paradigma:</span> <strong>${escapeHtml(rc.fonteTaxaRotulo)}</strong></div>
                </div>

                <div class="kpi-strip">
                    <div><span>Parcela na Taxa Média</span><strong>${brl(a.parcelaNaMedia)}</strong></div>
                    <div><span>Diferença nas Pagas (Atualizada)</span><strong>${brl(rc.totalAtualizadoParcelas)}</strong></div>
                    <div><span>Economia nas Vincendas</span><strong>${brl(rc.economiaVincendas)}</strong></div>
                    <div><span>Saldo Recalculado (Abatendo Pagas)</span><strong>${brl(a.saldoRecalculado)}</strong></div>
                </div>

                ${(rc.alertas ?? [])
                    .map((al) => `<div class="notes alerta"><strong>* Atenção:</strong> ${escapeHtml(al)}</div>`)
                    .join("")}

                ${
                    linhasHtml
                        ? `
                <table>
                    <thead>
                        <tr>
                            <th>Nº</th>
                            <th>Vencimento</th>
                            <th class="num">Devido</th>
                            <th class="num">Pago</th>
                            <th class="num">${p.restituicaoDobroParcelas ? "Dif. (Dobro)" : "Diferença"}</th>
                            <th class="num">Correção</th>
                            <th class="num">Juros</th>
                            <th class="num">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${linhasHtml}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="4"><strong>Totais das parcelas pagas</strong></td>
                            <td class="num"><strong>${brl(rc.diferencaBaseRestituicao)}</strong></td>
                            <td class="num"><strong>${brl(rc.correcaoTotal)}</strong></td>
                            <td class="num"><strong>${brl(rc.jurosTotal)}</strong></td>
                            <td class="num"><strong>${brl(rc.totalAtualizadoParcelas)}</strong></td>
                        </tr>
                    </tfoot>
                </table>`
                        : `<p class="muted">Nenhuma parcela paga marcada neste contrato.</p>`
                }
                ${extrasHtml}
            </section>`;
        })
        .join("");

    const tarifasHtml =
        res.tarifas.length > 0
            ? `
        <section class="section">
            <div class="section-header">
                <h3>Seguros Prestamistas e Tarifas Abusivas</h3>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Descrição</th>
                        <th>Data</th>
                        <th>Restituição</th>
                        <th class="num">Original</th>
                        <th class="num">Base</th>
                        <th class="num">Correção</th>
                        <th class="num">Juros</th>
                        <th class="num">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${res.tarifas
                        .map(
                            (t) => `
                        <tr>
                            <td>${escapeHtml(t.titulo)}</td>
                            <td>${escapeHtml(formatDataBR(t.item.dataCobranca))}</td>
                            <td>${t.item.emDobro ? "Em Dobro (Art. 42 CDC)" : "Simples"}</td>
                            <td class="num">${brl(t.valorOriginal)}</td>
                            <td class="num">${brl(t.valorBaseRestituicao)}</td>
                            <td class="num">${brl(t.correcao)}</td>
                            <td class="num">${brl(t.juros)}</td>
                            <td class="num bold">${brl(t.total)}</td>
                        </tr>`,
                        )
                        .join("")}
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="7"><strong>Subtotal de Seguros e Tarifas Atualizado</strong></td>
                        <td class="num"><strong>${brl(r.tarifasAtualizado)}</strong></td>
                    </tr>
                </tfoot>
            </table>
        </section>`
            : "";

    const deducoesHtml =
        res.deducoes.length > 0
            ? `
        <section class="section">
            <div class="section-header">
                <h3>Valores a Deduzir (Pagamentos / Alvarás)</h3>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Descrição</th>
                        <th>Data</th>
                        <th class="num">Valor Base</th>
                        <th class="num">Correção</th>
                        <th class="num">Juros</th>
                        <th class="num">Total Deduzido</th>
                    </tr>
                </thead>
                <tbody>
                    ${res.deducoes
                        .map(
                            (d) => `
                        <tr>
                            <td>${escapeHtml(d.item.descricao || "Dedução / Alvará")}</td>
                            <td>${escapeHtml(formatDataBR(d.item.data))}</td>
                            <td class="num">${brl(d.valorBase)}</td>
                            <td class="num">${brl(d.correcao)}</td>
                            <td class="num">${brl(d.juros)}</td>
                            <td class="num bold">${brl(d.total)}</td>
                        </tr>`,
                        )
                        .join("")}
                </tbody>
            </table>
        </section>`
            : "";

    const escCfg = configEscritorioAtual();
    const oabEsc = formatarOab(escCfg);
    const cidadeEsc = cidadeAssinatura(escCfg);
    const advogadoEsc = escCfg.nomeAdvogado || "Ian Granja";

    return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Laudo Técnico Revisional — ${cliente}</title>
<style>
  @page { size: A4 portrait; margin: 13mm 12mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #061237;
    background: #f4f5f8;
    font-size: 11px;
    line-height: 1.45;
  }
  .toolbar {
    position: sticky;
    top: 0;
    z-index: 10;
    background: #061237;
    color: #f3f4f8;
    padding: 10px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  .toolbar button {
    border: 1px solid #dfc996;
    background: #dfc996;
    color: #061237;
    font-weight: 700;
    padding: 8px 16px;
    cursor: pointer;
    font-size: 12px;
  }
  .toolbar button.sec {
    background: transparent;
    color: #f3f4f8;
  }
  .page {
    max-width: 210mm;
    margin: 16px auto;
    background: #ffffff;
    padding: 24px 26px;
    box-shadow: 0 4px 24px rgba(6, 18, 55, 0.14);
  }
  .doc-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-bottom: 2.5px solid #061237;
    padding-bottom: 12px;
    margin-bottom: 16px;
  }
  .brand h1 { margin: 0; font-size: 17px; letter-spacing: 0.04em; text-transform: uppercase; }
  .brand p { margin: 2px 0 0; color: #475273; font-size: 10px; }
  .doc-title { text-align: right; }
  .doc-title h2 { margin: 0; font-size: 13px; text-transform: uppercase; color: #7a5e2b; }
  .doc-title p { margin: 2px 0 0; color: #475273; font-size: 10px; }
  .meta-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px 18px;
    border: 1px solid #cdd3e1;
    background: #fafbfd;
    padding: 10px 12px;
    margin-bottom: 14px;
  }
  .meta-grid .full { grid-column: 1 / -1; }
  .meta-grid span { color: #546080; }
  .summary-box {
    border: 1.5px solid #061237;
    margin-bottom: 18px;
  }
  .summary-box h3 {
    margin: 0;
    background: #061237;
    color: #ffffff;
    padding: 7px 12px;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: 6px 12px;
    border-bottom: 1px solid #e4e7f0;
  }
  .summary-row.total {
    background: #f7f0dc;
    font-size: 13px;
    font-weight: 800;
    border-bottom: 0;
    border-top: 2px solid #a1824a;
  }
  .section { margin-bottom: 20px; page-break-inside: avoid; }
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1.5px solid #a1824a;
    padding-bottom: 4px;
    margin-bottom: 10px;
  }
  .section-header h3 { margin: 0; font-size: 13px; }
  .badge {
    background: #061237;
    color: #dfc996;
    font-weight: 700;
    padding: 2px 8px;
    font-size: 10px;
  }
  .kpi-strip {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 10px;
  }
  .kpi-strip > div {
    border: 1px solid #cdd3e1;
    padding: 6px 8px;
    background: #fff;
  }
  .kpi-strip span { display: block; font-size: 9px; color: #546080; text-transform: uppercase; }
  .kpi-strip strong { font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; font-variant-numeric: tabular-nums; }
  thead { display: table-header-group; }
  th, td { border-bottom: 1px solid #dce1ec; padding: 5px 6px; text-align: left; font-size: 10px; }
  th { background: #eef1f7; color: #061237; font-weight: 700; }
  tfoot td { background: #fafbfd; border-top: 1.5px solid #061237; }
  .num { text-align: right; white-space: nowrap; }
  .bold { font-weight: 700; }
  .subtable-title { margin: 12px 0 4px; font-size: 11px; }
  .notes {
    border-left: 3px solid #a1824a;
    padding: 6px 12px;
    background: #fafbfd;
    margin-top: 12px;
  }
  .notes.alerta { border-left-color: #b42318; color: #b42318; margin-bottom: 8px; }
  .signature {
    margin-top: 28px;
    display: flex;
    justify-content: flex-end;
  }
  .signature-box {
    width: 240px;
    border-top: 1px solid #061237;
    padding-top: 5px;
    text-align: center;
    font-size: 10px;
  }
  .muted { color: #546080; font-style: italic; }
  @media print {
    body { background: #ffffff; }
    .toolbar { display: none !important; }
    .page { margin: 0; padding: 0; box-shadow: none; max-width: none; }
    .section { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="toolbar no-print">
    <span>Pré-visualização do Laudo Técnico A4 — <strong>${cliente}</strong></span>
    <div>
      <button type="button" onclick="window.print()">Imprimir / Salvar em PDF</button>
      <button type="button" class="sec" onclick="window.close()">Fechar</button>
    </div>
  </div>
  <main class="page">
    <header class="doc-header">
      <div class="brand">
        <h1>Ian Granja Advogados</h1>
        <p>${escapeHtml(oabEsc)} · Av. Cardoso de Sá, 860, sala 5, ${escapeHtml(cidadeEsc)} · contato@iangranja.adv.br</p>
      </div>
      <div class="doc-title">
        <h2>Laudo Técnico Revisional</h2>
        <p>Emitido em ${escapeHtml(dataEmissao)}</p>
      </div>
    </header>

    <section class="meta-grid">
      <div><span>Requerente / Autor(a):</span> <strong>${cliente}</strong></div>
      <div><span>Nº do Processo:</span> <strong>${processo}</strong></div>
      <div><span>Categoria:</span> <strong>${categoria}</strong></div>
      <div><span>Data-base da Atualização:</span> <strong>${escapeHtml(formatDataBR(p.dataBaseAtualizacao))}</strong></div>
      <div><span>Correção Monetária:</span> <strong>${escapeHtml(rotuloIndice)}</strong></div>
      <div><span>Juros Moratórios:</span> <strong>${escapeHtml(rotuloJuros)}</strong></div>
    </section>

    <section class="summary-box">
      <h3>Resumo Global do Laudo</h3>
      <div class="summary-row"><span>Diferenças nas parcelas pagas (atualizadas)${p.restituicaoDobroParcelas ? " — Art. 42 CDC em dobro" : ""}</span><strong>${brl(r.principalContratosAtualizado)}</strong></div>
      ${r.extrasAtualizado > 0 ? `<div class="summary-row"><span>Pagamentos extras / avulsos atualizados</span><strong>${brl(r.extrasAtualizado)}</strong></div>` : ""}
      ${r.tarifasAtualizado > 0 ? `<div class="summary-row"><span>Seguros prestamistas e tarifas abusivas (atualizadas)</span><strong>${brl(r.tarifasAtualizado)}</strong></div>` : ""}
      ${r.deducoesAtualizado > 0 ? `<div class="summary-row"><span>(-) Deduções / Alvarás abatidos</span><strong>- ${brl(r.deducoesAtualizado)}</strong></div>` : ""}
      ${r.valorMultaGlobal > 0 ? `<div class="summary-row"><span>Multa global (${num(p.multaGlobalPercentual)}%)</span><strong>${brl(r.valorMultaGlobal)}</strong></div>` : ""}
      ${r.valorHonorarios > 0 ? `<div class="summary-row"><span>Honorários advocatícios (${num(p.honorariosPercentual)}%)</span><strong>${brl(r.valorHonorarios)}</strong></div>` : ""}
      <div class="summary-row"><span>Total líquido a restituir / compensar</span><strong>${brl(r.totalRestituicaoAtualizado)}</strong></div>
      ${r.economiaVincendasTotal > 0 ? `<div class="summary-row"><span>Economia projetada nas parcelas vincendas</span><strong>${brl(r.economiaVincendasTotal)}</strong></div>` : ""}
      <div class="summary-row total"><span>PROVEITO ECONÔMICO / VALOR TOTAL DA AÇÃO</span><span>${brl(r.valorTotalAcao)}</span></div>
    </section>

    ${contratosHtml}
    ${tarifasHtml}
    ${deducoesHtml}

    ${meta.observacoes?.trim() ? `<div class="notes"><strong>Observações do Caso:</strong><br/>${escapeHtml(meta.observacoes.trim()).replace(/\r?\n/g, "<br/>")}</div>` : ""}

    <footer class="signature">
      <div class="signature-box">
        <strong>${escapeHtml(advogadoEsc)}</strong><br/>
        Advogado · ${escapeHtml(oabEsc)}
      </div>
    </footer>
  </main>
</body>
</html>`;
}

export function gerarCsvDemonstrativo(res: ResultadoProcessoRevisional, meta: LaudoMetadata): string {
    // Neutraliza CSV/Formula Injection (Excel/LibreOffice) em células textuais iniciadas por =, +, -, @, \t ou \r.
    const esc = (v: string | number) => {
        let s = String(v);
        if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) {
            s = `'${s}`;
        }
        return `"${s.replace(/"/g, '""')}"`;
    };
    const money = (v: number) => num(v, 2);
    const oabCsv = formatarOab(configEscritorioAtual());
    const linhas: string[] = [
        ["LAUDO TÉCNICO REVISIONAL", `Ian Granja Advogados (${oabCsv})`].map(esc).join(";"),
        ["Cliente", meta.clienteNome, "Processo", meta.processoGlobal || ""].map(esc).join(";"),
        ["Valor Total da Ação", money(res.resumo.valorTotalAcao), "Total a Restituir", money(res.resumo.totalRestituicaoAtualizado)].map(esc).join(";"),
        "",
    ];

    res.contratos.forEach((rc, idx) => {
        linhas.push(["CONTRATO " + (idx + 1), rc.contrato.descricao, rc.contrato.instituicao, rc.fonteTaxaRotulo].map(esc).join(";"));
        linhas.push(["Nº", "Vencimento", "Status", "Devido (R$)", "Pago (R$)", "Diferença Base (R$)", "Correção (R$)", "Juros (R$)", "Total Atualizado (R$)"].map(esc).join(";"));
        for (const l of rc.linhas) {
            linhas.push(
                [
                    l.numero,
                    l.vencimento,
                    l.paga ? "Paga" : "Vincenda",
                    money(l.valorDevido),
                    money(l.valorPago),
                    money(l.diferencaBaseRestituicao),
                    money(l.correcao),
                    money(l.juros),
                    money(l.totalAtualizado),
                ]
                    .map(esc)
                    .join(";"),
            );
        }
        if (rc.extras.length > 0) {
            linhas.push("");
            linhas.push(["PAGAMENTOS EXTRAS — CONTRATO " + (idx + 1)].map(esc).join(";"));
            linhas.push(["Descrição", "Data", "Valor Base (R$)", "Correção (R$)", "Juros (R$)", "Total (R$)"].map(esc).join(";"));
            for (const ex of rc.extras) {
                linhas.push([ex.descricao, ex.data, money(ex.valorBase), money(ex.correcao), money(ex.juros), money(ex.total)].map(esc).join(";"));
            }
        }
        linhas.push("");
    });

    if (res.tarifas.length > 0) {
        linhas.push(["SEGUROS E TARIFAS ABUSIVAS"].map(esc).join(";"));
        linhas.push(["Descrição", "Data", "Modalidade", "Original (R$)", "Base (R$)", "Correção (R$)", "Juros (R$)", "Total (R$)"].map(esc).join(";"));
        for (const t of res.tarifas) {
            linhas.push(
                [
                    t.titulo,
                    t.item.dataCobranca,
                    t.item.emDobro ? "Em Dobro" : "Simples",
                    money(t.valorOriginal),
                    money(t.valorBaseRestituicao),
                    money(t.correcao),
                    money(t.juros),
                    money(t.total),
                ]
                    .map(esc)
                    .join(";"),
            );
        }
        linhas.push("");
    }

    if (res.deducoes.length > 0) {
        linhas.push(["DEDUÇÕES / ALVARÁS"].map(esc).join(";"));
        linhas.push(["Descrição", "Data", "Valor Base (R$)", "Correção (R$)", "Juros (R$)", "Total Deduzido (R$)"].map(esc).join(";"));
        for (const d of res.deducoes) {
            linhas.push([d.item.descricao, d.item.data, money(d.valorBase), money(d.correcao), money(d.juros), money(d.total)].map(esc).join(";"));
        }
        linhas.push("");
    }

    if (res.resumo.valorMultaGlobal > 0 || res.resumo.valorHonorarios > 0) {
        linhas.push(["ACRESCIMOS FINAIS"].map(esc).join(";"));
        linhas.push(["Base Líquida (R$)", "Multa Global (R$)", "Honorários (R$)", "Total a Restituir (R$)"].map(esc).join(";"));
        linhas.push(
            [
                money(res.resumo.baseLiquidaCondenacao),
                money(res.resumo.valorMultaGlobal),
                money(res.resumo.valorHonorarios),
                money(res.resumo.totalRestituicaoAtualizado),
            ]
                .map(esc)
                .join(";"),
        );
        linhas.push("");
    }

    return "\uFEFF" + linhas.join("\r\n");
}

interface BrowserWindowLike {
    URL: { createObjectURL(blob: Blob): string; revokeObjectURL(url: string): void };
    document: {
        createElement(tag: string): { href: string; download: string; click(): void; remove(): void };
        body: { appendChild(el: unknown): void };
    };
}

function getWin(): BrowserWindowLike | null {
    const g = globalThis as unknown as { window?: BrowserWindowLike };
    return g.window ?? null;
}

function nomeArquivoSeguro(clienteNome: string, sufixo: string): string {
    const slug = (clienteNome || "cliente")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    return `${slug || "cliente"}-${sufixo}`;
}

function dispararDownloadBlob(blob: Blob, nomeArquivo: string): boolean {
    const win = getWin();
    if (!win) return false;
    const url = win.URL.createObjectURL(blob);
    const a = win.document.createElement("a");
    a.href = url;
    a.download = nomeArquivo;
    win.document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => win.URL.revokeObjectURL(url), 15_000);
    return true;
}

const CP1252_EXTRA: Record<number, number> = {
    0x20ac: 0x80,
    0x201a: 0x82,
    0x0192: 0x83,
    0x201e: 0x84,
    0x2026: 0x85,
    0x2020: 0x86,
    0x2021: 0x87,
    0x02c6: 0x88,
    0x2030: 0x89,
    0x0160: 0x8a,
    0x2039: 0x8b,
    0x0152: 0x8c,
    0x017d: 0x8e,
    0x2018: 0x91,
    0x2019: 0x92,
    0x201c: 0x93,
    0x201d: 0x94,
    0x2022: 0x95,
    0x2013: 0x96,
    0x2014: 0x97,
    0x02dc: 0x98,
    0x2122: 0x99,
    0x0161: 0x9a,
    0x203a: 0x9b,
    0x0153: 0x9c,
    0x017e: 0x9e,
    0x0178: 0x9f,
};

function normalizarTextoPdf(text: string): string {
    return text.replace(/[\u00A0\u202F\t]/g, " ").replace(/\u2212/g, "-");
}

function fmtPdfNum(n: number): string {
    return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function toWinAnsiBytes(text: string): number[] {
    const normalized = normalizarTextoPdf(text);
    const bytes: number[] = [];
    for (const ch of normalized) {
        const code = ch.codePointAt(0) ?? 0x3f;
        if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) {
            bytes.push(code);
        } else if (CP1252_EXTRA[code] !== undefined) {
            bytes.push(CP1252_EXTRA[code]);
        } else if (code >= 0x20) {
            bytes.push(0x3f);
        }
    }
    return bytes;
}

function encodePdfHex(text: string): string {
    const hex = toWinAnsiBytes(text)
        .map((b) => b.toString(16).toUpperCase().padStart(2, "0"))
        .join("");
    return `<${hex}>`;
}

function charWidthUnits(ch: string, bold: boolean): number {
    if ("ilI.,:;|!'[]() ".includes(ch)) return bold && ch !== " " ? 0.3 : 0.278;
    if (ch === "j") return bold ? 0.278 : 0.222;
    if ("frt-/\\ºª".includes(ch)) return bold ? 0.36 : 0.333;
    if (ch >= "0" && ch <= "9") return 0.556;
    if (ch === "$" || ch === "+") return 0.58;
    if ("MW%@#&".includes(ch)) return bold ? 0.92 : 0.88;
    if ("mw".includes(ch)) return bold ? 0.83 : 0.78;
    if (ch >= "A" && ch <= "Z") return bold ? 0.71 : 0.68;
    if ("sczvxy".includes(ch)) return bold ? 0.556 : 0.5;
    return bold ? 0.6 : 0.556;
}

function measurePdfText(text: string, fontSize: number, bold: boolean): number {
    const base = normalizarTextoPdf(text)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    let total = 0;
    for (const ch of base) {
        total += charWidthUnits(ch, bold);
    }
    return total * fontSize;
}

function truncatePdfText(text: string, maxWidth: number, fontSize: number, bold: boolean): string {
    if (measurePdfText(text, fontSize, bold) <= maxWidth) return text;
    const ellipsis = "...";
    const ellW = measurePdfText(ellipsis, fontSize, bold);
    if (maxWidth <= ellW) return "";
    let out = "";
    let accW = 0;
    for (const ch of text) {
        const w = measurePdfText(ch, fontSize, bold);
        if (accW + w + ellW > maxWidth) break;
        accW += w;
        out += ch;
    }
    return out.trimEnd() + ellipsis;
}

function wrapPdfText(text: string, maxWidth: number, fontSize: number, bold: boolean): string[] {
    const paragraphs = normalizarTextoPdf(text).split(/\r?\n/);
    const lines: string[] = [];

    for (const para of paragraphs) {
        const trimmed = para.trim();
        if (!trimmed) {
            lines.push("");
            continue;
        }
        const words = trimmed.split(/\s+/);
        let current = "";
        for (const word of words) {
            const candidate = current ? `${current} ${word}` : word;
            if (measurePdfText(candidate, fontSize, bold) <= maxWidth) {
                current = candidate;
            } else {
                if (current) {
                    lines.push(current);
                    current = "";
                }
                if (measurePdfText(word, fontSize, bold) <= maxWidth) {
                    current = word;
                } else {
                    let chunk = "";
                    for (const ch of word) {
                        if (measurePdfText(chunk + ch, fontSize, bold) > maxWidth && chunk) {
                            lines.push(chunk);
                            chunk = ch;
                        } else {
                            chunk += ch;
                        }
                    }
                    current = chunk;
                }
            }
        }
        if (current) lines.push(current);
    }
    return lines;
}

const PDF_COLORS = {
    navy: "0.024 0.071 0.216",
    gold: "0.631 0.510 0.290",
    goldDeep: "0.478 0.369 0.169",
    goldLight: "0.875 0.788 0.588",
    goldPale: "0.969 0.941 0.863",
    slate: "0.278 0.322 0.451",
    headerFill: "0.933 0.945 0.969",
    cardSubtle: "0.980 0.984 0.992",
    rowAlt: "0.969 0.975 0.988",
    border: "0.804 0.827 0.882",
    borderLight: "0.867 0.886 0.925",
    destructive: "0.714 0.125 0.125",
    badgeAboveBg: "0.894 0.792 0.553",
    white: "1 1 1",
} as const;

interface PdfColumn {
    label: string;
    width: number;
    align?: "left" | "right" | "center";
}

interface PdfCell {
    text: string;
    bold?: boolean;
    color?: string;
    colSpan?: number;
}

function pdfMetaRotulos(res: ResultadoProcessoRevisional, meta: LaudoMetadata) {
    const p = res.parametros;
    const rotuloIndice =
        p.tipoJuros === "SELIC"
            ? "Englobada na Taxa SELIC"
            : (INDICES_CORRECAO_OPCOES.find((o) => o.id === p.indiceCorrecao)?.label ?? p.indiceCorrecao);
    const rotuloJuros =
        p.tipoJuros === "FIXO_CUSTOM"
            ? `Juros simples de ${num(p.jurosFixoMensal)}% a.m.`
            : (TIPOS_JUROS_OPCOES.find((o) => o.id === p.tipoJuros)?.label ?? p.tipoJuros);

    return {
        cliente: meta.clienteNome.trim() || "Não informado",
        processo: meta.processoGlobal?.trim() || "Pré-ajuizamento / Administrativo",
        categoria: meta.categoriaNome?.trim() || "Revisional Bancária",
        dataEmissao: new Date().toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
        }),
        rotuloIndice,
        rotuloJuros,
    };
}

/**
 * Gera um PDF 1.4 vetorial multi-página A4 (sem diálogo de impressão) para download direto.
 * Usa fontes padrão Type1 com WinAnsiEncoding e strings hexadecimais ASCII puras.
 */
export function gerarBytesLaudoPdf(res: ResultadoProcessoRevisional, meta: LaudoMetadata): Uint8Array<ArrayBuffer> {
    const W = 595.28;
    const H = 841.89;
    const ML = 36;
    const MR = 36;
    const CW = W - ML - MR;
    const TOP_Y = H - 36;
    const BOTTOM_Y = 54;

    const info = pdfMetaRotulos(res, meta);
    const pages: string[][] = [[]];
    let curPage = pages[0];
    let curY = TOP_Y;

    const pushCmd = (cmd: string) => {
        curPage.push(cmd);
    };

    const fillRect = (x: number, y: number, w: number, h: number, rgb: string) => {
        pushCmd(`${rgb} rg ${fmtPdfNum(x)} ${fmtPdfNum(y)} ${fmtPdfNum(w)} ${fmtPdfNum(h)} re f`);
    };

    const strokeRect = (x: number, y: number, w: number, h: number, rgb: string, lw = 0.6) => {
        pushCmd(`${rgb} RG ${fmtPdfNum(lw)} w ${fmtPdfNum(x)} ${fmtPdfNum(y)} ${fmtPdfNum(w)} ${fmtPdfNum(h)} re S`);
    };

    const drawLine = (x1: number, y1: number, x2: number, y2: number, rgb: string, lw = 0.6) => {
        pushCmd(`${rgb} RG ${fmtPdfNum(lw)} w ${fmtPdfNum(x1)} ${fmtPdfNum(y1)} m ${fmtPdfNum(x2)} ${fmtPdfNum(y2)} l S`);
    };

    const drawText = (
        text: string,
        x: number,
        y: number,
        size: number,
        options?: { bold?: boolean; color?: string; align?: "left" | "right" | "center" },
    ) => {
        const bold = options?.bold ?? false;
        const color = options?.color ?? PDF_COLORS.navy;
        const align = options?.align ?? "left";
        const font = bold ? "F2" : "F1";
        let tx = x;
        if (align === "right") {
            tx = x - measurePdfText(text, size, bold);
        } else if (align === "center") {
            tx = x - measurePdfText(text, size, bold) / 2;
        }
        pushCmd(`BT /${font} ${fmtPdfNum(size)} Tf ${color} rg ${fmtPdfNum(tx)} ${fmtPdfNum(y)} Td ${encodePdfHex(text)} Tj ET`);
    };

    const cfgEscPdf = configEscritorioAtual();
    const oabPdf = formatarOab(cfgEscPdf);
    const cidadePdf = cidadeAssinatura(cfgEscPdf);
    const advogadoPdf = cfgEscPdf.nomeAdvogado || "Ian Granja";

    const newPage = () => {
        const next: string[] = [];
        pages.push(next);
        curPage = next;
        curY = TOP_Y;
        drawText(`IAN GRANJA ADVOGADOS · ${oabPdf}`, ML, curY - 9, 7.5, {
            bold: true,
            color: PDF_COLORS.navy,
        });
        drawText(
            truncatePdfText(`Laudo Técnico Revisional — ${info.cliente}`, 260, 7.5, false),
            W - MR,
            curY - 9,
            7.5,
            { color: PDF_COLORS.slate, align: "right" },
        );
        drawLine(ML, curY - 14, W - MR, curY - 14, PDF_COLORS.gold, 0.75);
        curY -= 26;
    };

    const ensureSpace = (heightNeeded: number): boolean => {
        if (curY - heightNeeded < BOTTOM_Y) {
            newPage();
            return true;
        }
        return false;
    };

    const drawKeyValGrid = (items: Array<{ label: string; value: string; full?: boolean }>) => {
        const colW = CW / 2;
        const rowH = 16;
        const rows: Array<{ left: { label: string; value: string }; right?: { label: string; value: string }; full?: boolean }> =
            [];
        let i = 0;
        while (i < items.length) {
            const cur = items[i];
            if (cur.full) {
                rows.push({ left: cur, full: true });
                i += 1;
            } else {
                const nxt = i + 1 < items.length && !items[i + 1].full ? items[i + 1] : undefined;
                rows.push({ left: cur, right: nxt });
                i += nxt ? 2 : 1;
            }
        }
        const boxH = rows.length * rowH + 10;
        ensureSpace(boxH + 8);

        const boxBottom = curY - boxH;
        fillRect(ML, boxBottom, CW, boxH, PDF_COLORS.cardSubtle);
        strokeRect(ML, boxBottom, CW, boxH, PDF_COLORS.border, 0.75);

        let ry = curY - 14;
        for (const row of rows) {
            const drawPair = (xStart: number, maxW: number, pair: { label: string; value: string }) => {
                const lblTxt = `${pair.label}: `;
                const lblW = measurePdfText(lblTxt, 8, false);
                drawText(lblTxt, xStart, ry, 8, { color: PDF_COLORS.slate });
                const valTxt = truncatePdfText(pair.value, Math.max(24, maxW - lblW), 8, true);
                drawText(valTxt, xStart + lblW, ry, 8, { bold: true, color: PDF_COLORS.navy });
            };

            if (row.full) {
                drawPair(ML + 8, CW - 16, row.left);
            } else {
                drawPair(ML + 8, colW - 14, row.left);
                if (row.right) {
                    drawPair(ML + colW + 4, colW - 14, row.right);
                }
            }
            ry -= rowH;
        }
        curY = boxBottom - 10;
    };

    const drawPaginatedTable = (
        columns: PdfColumn[],
        rows: PdfCell[][],
        options?: {
            continuationTitle?: string;
            footerRow?: PdfCell[];
            fontSize?: number;
        },
    ) => {
        const fontSize = options?.fontSize ?? 7.5;
        const headH = 19;
        const rowH = 15.5;
        const footH = 18;
        const padX = 5;

        const drawHeaderBar = (contTitle?: string) => {
            if (contTitle) {
                drawText(contTitle, ML, curY - 9, 8.5, { bold: true, color: PDF_COLORS.goldDeep });
                curY -= 14;
            }
            const top = curY;
            const bottom = top - headH;
            fillRect(ML, bottom, CW, headH, PDF_COLORS.headerFill);
            drawLine(ML, top, W - MR, top, PDF_COLORS.border, 0.6);
            drawLine(ML, bottom, W - MR, bottom, PDF_COLORS.navy, 0.9);
            let cx = ML;
            for (const col of columns) {
                const txt = truncatePdfText(col.label, col.width - padX * 2, fontSize, true);
                const yTxt = bottom + 6.5;
                if (col.align === "right") {
                    drawText(txt, cx + col.width - padX, yTxt, fontSize, { bold: true, align: "right" });
                } else if (col.align === "center") {
                    drawText(txt, cx + col.width / 2, yTxt, fontSize, { bold: true, align: "center" });
                } else {
                    drawText(txt, cx + padX, yTxt, fontSize, { bold: true });
                }
                cx += col.width;
            }
            curY = bottom;
        };

        ensureSpace(headH + (rows.length > 0 ? rowH : footH));
        drawHeaderBar();

        rows.forEach((cells, idx) => {
            if (curY - rowH < BOTTOM_Y) {
                newPage();
                drawHeaderBar(options?.continuationTitle);
            }
            const bottom = curY - rowH;
            if (idx % 2 === 1) {
                fillRect(ML, bottom, CW, rowH, PDF_COLORS.rowAlt);
            }
            drawLine(ML, bottom, W - MR, bottom, PDF_COLORS.borderLight, 0.4);
            let cx = ML;
            columns.forEach((col, ci) => {
                const cell = cells[ci] ?? { text: "" };
                const txt = truncatePdfText(cell.text, col.width - padX * 2, fontSize, Boolean(cell.bold));
                const yTxt = bottom + 5;
                if (col.align === "right") {
                    drawText(txt, cx + col.width - padX, yTxt, fontSize, {
                        bold: cell.bold,
                        color: cell.color,
                        align: "right",
                    });
                } else if (col.align === "center") {
                    drawText(txt, cx + col.width / 2, yTxt, fontSize, {
                        bold: cell.bold,
                        color: cell.color,
                        align: "center",
                    });
                } else {
                    drawText(txt, cx + padX, yTxt, fontSize, {
                        bold: cell.bold,
                        color: cell.color,
                    });
                }
                cx += col.width;
            });
            curY = bottom;
        });

        if (options?.footerRow) {
            if (curY - footH < BOTTOM_Y) {
                newPage();
                drawHeaderBar(options.continuationTitle);
            }
            const top = curY;
            const bottom = top - footH;
            fillRect(ML, bottom, CW, footH, PDF_COLORS.cardSubtle);
            drawLine(ML, top, W - MR, top, PDF_COLORS.navy, 1);
            drawLine(ML, bottom, W - MR, bottom, PDF_COLORS.border, 0.7);
            let cx = ML;
            let ci = 0;
            while (ci < columns.length) {
                const cell = options.footerRow?.[ci];
                const span = Math.max(1, Math.min(columns.length - ci, cell?.colSpan ?? 1));
                let spanW = 0;
                for (let s = 0; s < span; s++) spanW += columns[ci + s].width;
                const align = span > 1 ? "left" : columns[ci].align;
                if (cell && cell.text) {
                    const txt = truncatePdfText(cell.text, spanW - padX * 2, fontSize, true);
                    const yTxt = bottom + 6;
                    if (align === "right") {
                        drawText(txt, cx + spanW - padX, yTxt, fontSize, {
                            bold: true,
                            color: cell.color,
                            align: "right",
                        });
                    } else {
                        drawText(txt, cx + padX, yTxt, fontSize, {
                            bold: true,
                            color: cell.color,
                        });
                    }
                }
                cx += spanW;
                ci += span;
            }
            curY = bottom;
        }

        curY -= 12;
    };

    // 1. Cabeçalho principal da página 1
    drawText("IAN GRANJA ADVOGADOS", ML, curY - 14, 15, { bold: true, color: PDF_COLORS.navy });
    drawText(
        `${oabPdf} · Av. Cardoso de Sá, 860, sala 5, ${cidadePdf} · contato@iangranja.adv.br`,
        ML,
        curY - 27,
        7.8,
        { color: PDF_COLORS.slate },
    );
    drawText("LAUDO TÉCNICO REVISIONAL", W - MR, curY - 12, 10.5, {
        bold: true,
        color: PDF_COLORS.goldDeep,
        align: "right",
    });
    drawText(`Emitido em ${info.dataEmissao}`, W - MR, curY - 25, 8, {
        color: PDF_COLORS.slate,
        align: "right",
    });
    drawLine(ML, curY - 35, W - MR, curY - 35, PDF_COLORS.navy, 2);
    drawLine(ML, curY - 37.5, W - MR, curY - 37.5, PDF_COLORS.gold, 0.75);
    curY -= 48;

    // 2. Quadro de identificação e parâmetros globais
    drawKeyValGrid([
        { label: "Requerente / Autor(a)", value: info.cliente },
        { label: "Nº do Processo", value: info.processo },
        { label: "Categoria", value: info.categoria },
        { label: "Data-base da Atualização", value: formatDataBR(res.parametros.dataBaseAtualizacao) },
        { label: "Correção Monetária", value: info.rotuloIndice, full: true },
        { label: "Juros Moratórios", value: info.rotuloJuros, full: true },
    ]);

    // 3. Resumo Global do Laudo
    const r = res.resumo;
    const summaryRows: Array<{ label: string; value: string; bold?: boolean; destructive?: boolean }> = [
        {
            label: `Diferenças nas parcelas pagas (atualizadas)${res.parametros.restituicaoDobroParcelas ? " — Art. 42 CDC em dobro" : ""}`,
            value: brl(r.principalContratosAtualizado),
        },
    ];
    if (r.extrasAtualizado > 0) {
        summaryRows.push({ label: "Pagamentos extras / avulsos atualizados", value: brl(r.extrasAtualizado) });
    }
    if (r.tarifasAtualizado > 0) {
        summaryRows.push({
            label: "Seguros prestamistas e tarifas abusivas (atualizadas)",
            value: brl(r.tarifasAtualizado),
        });
    }
    if (r.deducoesAtualizado > 0) {
        summaryRows.push({
            label: "(-) Deduções / Alvarás abatidos",
            value: `- ${brl(r.deducoesAtualizado)}`,
            destructive: true,
        });
    }
    if (r.valorMultaGlobal > 0) {
        summaryRows.push({
            label: `Multa global (${num(res.parametros.multaGlobalPercentual)}%)`,
            value: brl(r.valorMultaGlobal),
        });
    }
    if (r.valorHonorarios > 0) {
        summaryRows.push({
            label: `Honorários advocatícios (${num(res.parametros.honorariosPercentual)}%)`,
            value: brl(r.valorHonorarios),
        });
    }
    summaryRows.push({
        label: "Total líquido a restituir / compensar",
        value: brl(r.totalRestituicaoAtualizado),
        bold: true,
    });
    if (r.economiaVincendasTotal > 0) {
        summaryRows.push({
            label: "Economia projetada nas parcelas vincendas",
            value: brl(r.economiaVincendasTotal),
        });
    }

    const sumHeaderH = 22;
    const sumRowH = 18;
    const sumTotalH = 24;
    const sumBoxH = sumHeaderH + summaryRows.length * sumRowH + sumTotalH;
    ensureSpace(sumBoxH + 10);

    const sumTop = curY;
    fillRect(ML, sumTop - sumHeaderH, CW, sumHeaderH, PDF_COLORS.navy);
    drawText("RESUMO GLOBAL DO LAUDO", ML + 10, sumTop - 14.5, 9, {
        bold: true,
        color: PDF_COLORS.goldLight,
    });
    drawText(
        `${res.contratos.length} ${res.contratos.length === 1 ? "contrato" : "contratos"} · atualização até ${formatDataBR(res.parametros.dataBaseAtualizacao)}`,
        W - MR - 10,
        sumTop - 14,
        7.5,
        { color: PDF_COLORS.white, align: "right" },
    );

    let sy = sumTop - sumHeaderH;
    for (const srow of summaryRows) {
        const rb = sy - sumRowH;
        fillRect(ML, rb, CW, sumRowH, PDF_COLORS.white);
        drawLine(ML, rb, W - MR, rb, PDF_COLORS.borderLight, 0.5);
        drawText(truncatePdfText(srow.label, CW - 140, 8.5, Boolean(srow.bold)), ML + 10, rb + 6, 8.5, {
            bold: srow.bold,
            color: PDF_COLORS.navy,
        });
        drawText(srow.value, W - MR - 10, rb + 6, 8.5, {
            bold: true,
            color: srow.destructive ? PDF_COLORS.destructive : PDF_COLORS.navy,
            align: "right",
        });
        sy = rb;
    }

    const totalBottom = sy - sumTotalH;
    fillRect(ML, totalBottom, CW, sumTotalH, PDF_COLORS.goldPale);
    drawLine(ML, sy, W - MR, sy, PDF_COLORS.gold, 1.4);
    drawText("PROVEITO ECONÔMICO / VALOR TOTAL DA AÇÃO", ML + 10, totalBottom + 8.5, 9.5, {
        bold: true,
        color: PDF_COLORS.navy,
    });
    drawText(brl(r.valorTotalAcao), W - MR - 10, totalBottom + 8, 11, {
        bold: true,
        color: PDF_COLORS.navy,
        align: "right",
    });
    strokeRect(ML, totalBottom, CW, sumBoxH, PDF_COLORS.navy, 1.1);
    curY = totalBottom - 16;

    // 4. Seções por contrato
    res.contratos.forEach((rc, idx) => {
        const c = rc.contrato;
        const a = rc.analise;
        const tituloContrato = `Contrato ${idx + 1}: ${c.descricao || a.entrada.mod.nome}`;

        // Cabeçalho + ficha + KPIs juntos
        ensureSpace(168);

        const badgeTxt = `${rc.nivel === "abuso" ? "Indício de Abuso" : rc.nivel === "acima" ? "Acima da Média" : "Na Média"} (${num(a.razaoAm, 2)}x)`;
        const badgeW = measurePdfText(badgeTxt, 7.5, true) + 14;
        drawText(truncatePdfText(tituloContrato, CW - badgeW - 12, 11, true), ML, curY - 12, 11, {
            bold: true,
            color: PDF_COLORS.navy,
        });
        const badgeBg =
            rc.nivel === "abuso"
                ? PDF_COLORS.destructive
                : rc.nivel === "acima"
                  ? PDF_COLORS.badgeAboveBg
                  : PDF_COLORS.navy;
        const badgeFg =
            rc.nivel === "abuso"
                ? PDF_COLORS.white
                : rc.nivel === "acima"
                  ? PDF_COLORS.navy
                  : PDF_COLORS.goldLight;
        fillRect(W - MR - badgeW, curY - 16, badgeW, 14, badgeBg);
        drawText(badgeTxt, W - MR - badgeW / 2, curY - 11.5, 7.5, {
            bold: true,
            color: badgeFg,
            align: "center",
        });
        drawLine(ML, curY - 21, W - MR, curY - 21, PDF_COLORS.gold, 1.2);
        curY -= 27;

        drawKeyValGrid([
            { label: "Instituição", value: c.instituicao || "Não informada" },
            { label: "Nº Contrato", value: c.numeroContrato || "—" },
            { label: "Modalidade", value: `${a.entrada.mod.nome} (${c.pessoa.toUpperCase()})` },
            { label: "Data Contratação", value: formatDataBR(c.dataContrato) },
            { label: "Valor Financiado", value: brl(c.valorFinanciado) },
            { label: "Parcelas", value: `${c.parcelas}x de ${brl(c.valorParcela)} (${c.pagas} pagas)` },
            { label: "Taxa Contrato", value: `${num(a.contratoAm)}% a.m. / ${num(a.contratoAa)}% a.a.` },
            { label: "Taxa Revisional", value: `${num(rc.taxaRevisionalAm)}% a.m. / ${num(rc.taxaRevisionalAa)}% a.a.` },
            { label: "Fonte da Taxa Paradigma", value: rc.fonteTaxaRotulo, full: true },
        ]);

        // Faixa de 4 KPIs
        const kpiGap = 6;
        const kpiW = (CW - kpiGap * 3) / 4;
        const kpiH = 34;
        ensureSpace(kpiH + 10);
        const kpiItems = [
            { label: "PARCELA NA TAXA MÉDIA", val: brl(a.parcelaNaMedia) },
            { label: "DIF. NAS PAGAS (ATUALIZ.)", val: brl(rc.totalAtualizadoParcelas) },
            { label: "ECONOMIA NAS VINCENDAS", val: brl(rc.economiaVincendas) },
            { label: "SALDO RECALCULADO", val: brl(a.saldoRecalculado) },
        ];
        const kpiBottom = curY - kpiH;
        kpiItems.forEach((k, ki) => {
            const kx = ML + ki * (kpiW + kpiGap);
            fillRect(kx, kpiBottom, kpiW, kpiH, PDF_COLORS.white);
            strokeRect(kx, kpiBottom, kpiW, kpiH, PDF_COLORS.border, 0.7);
            drawText(truncatePdfText(k.label, kpiW - 10, 6.5, true), kx + 6, curY - 12, 6.5, {
                bold: true,
                color: PDF_COLORS.slate,
            });
            drawText(truncatePdfText(k.val, kpiW - 10, 9.5, true), kx + 6, kpiBottom + 8, 9.5, {
                bold: true,
                color: PDF_COLORS.navy,
            });
        });
        curY = kpiBottom - 10;

        // Quadro gráfico pericial vetorial (Taxas/Custos + Curva de Saldo Devedor)
        if (meta.incluirGraficos !== false) {
            const chartGap = 8;
            const pw = (CW - chartGap) / 2;
            const ph = 118;
            ensureSpace(ph + 12);

            const cTop = curY;
            const cBottom = cTop - ph;
            const lx = ML;
            const rx = ML + pw + chartGap;

            // Painel esquerdo: Comparativo de Taxas e Custo Total
            fillRect(lx, cBottom, pw, ph, PDF_COLORS.white);
            strokeRect(lx, cBottom, pw, ph, PDF_COLORS.border, 0.7);
            drawText("COMPARATIVO DE TAXAS E CUSTO TOTAL", lx + 8, cTop - 11, 6.6, {
                bold: true,
                color: PDF_COLORS.slate,
            });

            const barAreaW = pw - 16;
            const limAm = rc.taxaRevisionalAm * LIMITE_ABUSIVO;
            const maxT = Math.max(0.01, a.contratoAm, limAm, rc.taxaRevisionalAm) * 1.12;
            const wContrato = Math.max(3, (a.contratoAm / maxT) * barAreaW);
            const wParadigma = Math.max(3, (rc.taxaRevisionalAm / maxT) * barAreaW);
            const xLim = lx + 8 + Math.min(barAreaW - 2, (limAm / maxT) * barAreaW);

            drawText("Taxa Contrato", lx + 8, cTop - 22, 6.8, { bold: true, color: PDF_COLORS.navy });
            drawText(`${num(a.contratoAm)}% a.m.`, lx + pw - 8, cTop - 22, 6.8, {
                bold: true,
                color: rc.nivel === "abuso" ? PDF_COLORS.destructive : PDF_COLORS.navy,
                align: "right",
            });
            fillRect(lx + 8, cTop - 30.5, barAreaW, 6, PDF_COLORS.headerFill);
            fillRect(
                lx + 8,
                cTop - 30.5,
                wContrato,
                6,
                rc.nivel === "abuso" ? PDF_COLORS.destructive : PDF_COLORS.gold,
            );

            drawText("Taxa Paradigma", lx + 8, cTop - 40, 6.8, { color: PDF_COLORS.slate });
            drawText(`${num(rc.taxaRevisionalAm)}% a.m.`, lx + pw - 8, cTop - 40, 6.8, {
                bold: true,
                color: PDF_COLORS.navy,
                align: "right",
            });
            fillRect(lx + 8, cTop - 48.5, barAreaW, 6, PDF_COLORS.headerFill);
            fillRect(lx + 8, cTop - 48.5, wParadigma, 6, PDF_COLORS.navy);

            // Linha guia tracejada de 1,5x
            pushCmd(
                `q ${PDF_COLORS.goldDeep} RG 0.80 w [2 2] 0 d ${xLim.toFixed(2)} ${(cTop - 51).toFixed(2)} m ${xLim.toFixed(2)} ${(cTop - 22).toFixed(2)} l S Q`,
            );

            drawLine(lx + 8, cTop - 56, lx + pw - 8, cTop - 56, PDF_COLORS.borderLight, 0.5);

            // Barras empilhadas de Custo Total (Capital + Juros)
            const comp = composicaoCustoContrato(rc);
            const maxCusto = Math.max(1, comp.principal, comp.totalContrato, comp.totalParadigma);
            const wCap = Math.min(barAreaW, (comp.principal / maxCusto) * barAreaW);
            const wJurBanco = Math.min(barAreaW - wCap, (comp.jurosContrato / maxCusto) * barAreaW);
            const wJurJusto = Math.min(barAreaW - wCap, (comp.jurosParadigma / maxCusto) * barAreaW);

            drawText("Total Cobrado", lx + 8, cTop - 66, 6.8, { bold: true, color: PDF_COLORS.navy });
            drawText(brl(comp.totalContrato), lx + pw - 8, cTop - 66, 6.8, {
                bold: true,
                color: PDF_COLORS.navy,
                align: "right",
            });
            fillRect(lx + 8, cTop - 74.5, barAreaW, 6.5, PDF_COLORS.headerFill);
            fillRect(lx + 8, cTop - 74.5, wCap, 6.5, PDF_COLORS.navy);
            if (wJurBanco > 0.5) {
                fillRect(lx + 8 + wCap, cTop - 74.5, wJurBanco, 6.5, PDF_COLORS.destructive);
            }

            drawText("Total Recalculado", lx + 8, cTop - 85, 6.8, { color: PDF_COLORS.slate });
            drawText(brl(comp.totalParadigma), lx + pw - 8, cTop - 85, 6.8, {
                bold: true,
                color: PDF_COLORS.navy,
                align: "right",
            });
            fillRect(lx + 8, cTop - 93.5, barAreaW, 6.5, PDF_COLORS.headerFill);
            fillRect(lx + 8, cTop - 93.5, wCap, 6.5, PDF_COLORS.navy);
            if (wJurJusto > 0.5) {
                fillRect(lx + 8 + wCap, cTop - 93.5, wJurJusto, 6.5, PDF_COLORS.gold);
            }

            fillRect(lx + 8, cBottom + 6.5, 5, 5, PDF_COLORS.navy);
            drawText("Capital", lx + 15, cBottom + 7, 6.1, { color: PDF_COLORS.slate });
            fillRect(lx + 52, cBottom + 6.5, 5, 5, PDF_COLORS.destructive);
            drawText("Juros contrato", lx + 59, cBottom + 7, 6.1, { color: PDF_COLORS.slate });
            fillRect(lx + 116, cBottom + 6.5, 5, 5, PDF_COLORS.gold);
            drawText("Juros paradigma", lx + 123, cBottom + 7, 6.1, { color: PDF_COLORS.slate });
            drawText(`1,5x=${num(limAm)}%`, lx + pw - 8, cBottom + 7, 6.1, {
                bold: true,
                color: PDF_COLORS.goldDeep,
                align: "right",
            });

            // Painel direito: Curva de Evolução do Saldo Devedor
            fillRect(rx, cBottom, pw, ph, PDF_COLORS.white);
            strokeRect(rx, cBottom, pw, ph, PDF_COLORS.border, 0.7);
            drawText("EVOLUÇÃO DO SALDO DEVEDOR", rx + 8, cTop - 11, 6.6, {
                bold: true,
                color: PDF_COLORS.slate,
            });

            const serieSaldo = serieSaldoDevedorContrato(rc);
            if (serieSaldo.parcelaQuitacaoAntecipada !== null) {
                drawText(
                    `Quita na ${serieSaldo.parcelaQuitacaoAntecipada}ª de ${c.parcelas}`,
                    rx + pw - 8,
                    cTop - 11,
                    6.4,
                    { bold: true, color: PDF_COLORS.goldDeep, align: "right" },
                );
            }

            const px0 = rx + 42;
            const px1 = rx + pw - 10;
            const py0 = cBottom + 21;
            const py1 = cTop - 20;
            const plotW = px1 - px0;
            const plotH = py1 - py0;
            const nParc = Math.max(1, c.parcelas);
            const yMaxSaldo = Math.max(1, c.valorFinanciado, ...serieSaldo.pontos.map((pt) => pt.saldoBanco)) * 1.05;
            const sx = (k: number) => px0 + (k / nParc) * plotW;
            const sySaldo = (val: number) => py0 + (val / yMaxSaldo) * plotH;

            const fmtEixoY = (val: number) =>
                val >= 1000 ? `${num(val / 1000, 0)}k` : num(val, 0);

            for (const frac of [0, 0.5, 1]) {
                const gy = py0 + frac * plotH;
                drawLine(px0, gy, px1, gy, PDF_COLORS.borderLight, 0.45);
                drawText(fmtEixoY(yMaxSaldo * frac), px0 - 4, gy - 2, 6, {
                    color: PDF_COLORS.slate,
                    align: "right",
                });
            }

            drawText("0ª", px0, py0 - 8, 6, { color: PDF_COLORS.slate, align: "center" });
            drawText(`${c.parcelas}ª`, px1, py0 - 8, 6, { color: PDF_COLORS.slate, align: "center" });

            if (serieSaldo.pontos.length >= 2) {
                // Área sombreada de economia de saldo
                const polyUp = serieSaldo.pontos.map(
                    (pt, idxP) =>
                        `${sx(pt.parcela).toFixed(2)} ${sySaldo(pt.saldoBanco).toFixed(2)} ${idxP === 0 ? "m" : "l"}`,
                );
                const polyDown = [...serieSaldo.pontos]
                    .reverse()
                    .map((pt) => `${sx(pt.parcela).toFixed(2)} ${sySaldo(pt.saldoAbatendoPagas).toFixed(2)} l`);
                pushCmd(`q ${PDF_COLORS.goldPale} rg ${polyUp.join(" ")} ${polyDown.join(" ")} h f Q`);

                // Curva do banco (tracejada vermelha)
                const pathBanco = serieSaldo.pontos
                    .map(
                        (pt, idxP) =>
                            `${sx(pt.parcela).toFixed(2)} ${sySaldo(pt.saldoBanco).toFixed(2)} ${idxP === 0 ? "m" : "l"}`,
                    )
                    .join(" ");
                pushCmd(`q ${PDF_COLORS.destructive} RG 1.25 w [3 2] 0 d ${pathBanco} S Q`);

                // Curva recalculada (sólida marinho)
                const pathJusto = serieSaldo.pontos
                    .map(
                        (pt, idxP) =>
                            `${sx(pt.parcela).toFixed(2)} ${sySaldo(pt.saldoAbatendoPagas).toFixed(2)} ${idxP === 0 ? "m" : "l"}`,
                    )
                    .join(" ");
                pushCmd(`q ${PDF_COLORS.navy} RG 1.45 w [] 0 d ${pathJusto} S Q`);
            }

            if (c.pagas > 0 && c.pagas < c.parcelas) {
                const xHoje = sx(c.pagas);
                pushCmd(
                    `q ${PDF_COLORS.goldDeep} RG 0.80 w [2 2] 0 d ${xHoje.toFixed(2)} ${py0.toFixed(2)} m ${xHoje.toFixed(2)} ${py1.toFixed(2)} l S Q`,
                );
                drawText(`${c.pagas}ª`, xHoje, py0 - 8, 6, {
                    bold: true,
                    color: PDF_COLORS.goldDeep,
                    align: "center",
                });
            }

            pushCmd(
                `q ${PDF_COLORS.destructive} RG 1.25 w [3 2] 0 d ${(rx + 8).toFixed(2)} ${(cBottom + 9).toFixed(2)} m ${(rx + 20).toFixed(2)} ${(cBottom + 9).toFixed(2)} l S Q`,
            );
            drawText("Saldo banco", rx + 23, cBottom + 7, 6.1, { color: PDF_COLORS.slate });
            drawLine(rx + 82, cBottom + 9, rx + 94, cBottom + 9, PDF_COLORS.navy, 1.45);
            drawText("Saldo recalculado (abatendo pagas)", rx + 97, cBottom + 7, 6.1, {
                color: PDF_COLORS.slate,
            });

            curY = cBottom - 10;
        }

        // Alertas de consistência (ex.: parcela marcada como paga que ainda não venceu)
        for (const alerta of rc.alertas ?? []) {
            const alLines = wrapPdfText(`* Atenção: ${alerta}`, CW - 20, 8.5, false);
            const alLineH = 11.5;
            const alH = 10 + alLines.length * alLineH + 4;
            ensureSpace(alH + 10);
            const alBottom = curY - alH;
            fillRect(ML, alBottom, CW, alH, PDF_COLORS.cardSubtle);
            fillRect(ML, alBottom, 3, alH, PDF_COLORS.destructive);
            let aly = curY - 13;
            for (const line of alLines) {
                if (line) drawText(line, ML + 10, aly, 8.5, { color: PDF_COLORS.destructive });
                aly -= alLineH;
            }
            curY = alBottom - 10;
        }

        // Tabela de parcelas pagas
        const pagas = rc.linhas.filter((l) => l.paga);
        if (pagas.length > 0) {
            const colsParcelas: PdfColumn[] = [
                { label: "Nº", width: 30, align: "left" },
                { label: "Vencimento", width: 64, align: "left" },
                { label: "Devido", width: 70, align: "right" },
                { label: "Pago", width: 70, align: "right" },
                {
                    label: res.parametros.restituicaoDobroParcelas ? "Dif. (Dobro)" : "Diferença",
                    width: 72,
                    align: "right",
                },
                { label: "Correção", width: 68, align: "right" },
                { label: "Juros", width: 68, align: "right" },
                { label: "Total", width: 81.28, align: "right" },
            ];
            const rowsParcelas: PdfCell[][] = pagas.map((l) => [
                { text: String(l.numero) },
                { text: formatDataBR(l.vencimento) + (l.conferirVencimento ? " *" : "") },
                { text: brl(l.valorDevido) },
                { text: brl(l.valorPago) },
                { text: brl(l.diferencaBaseRestituicao) },
                { text: brl(l.correcao) },
                { text: brl(l.juros) },
                { text: brl(l.totalAtualizado), bold: true },
            ]);
            drawPaginatedTable(colsParcelas, rowsParcelas, {
                continuationTitle: `${tituloContrato} — Parcelas pagas (continuação)`,
                footerRow: [
                    { text: "Totais das parcelas pagas", bold: true, colSpan: 4 },
                    { text: "" },
                    { text: "" },
                    { text: "" },
                    { text: brl(rc.diferencaBaseRestituicao), bold: true },
                    { text: brl(rc.correcaoTotal), bold: true },
                    { text: brl(rc.jurosTotal), bold: true },
                    { text: brl(rc.totalAtualizadoParcelas), bold: true },
                ],
            });
        } else {
            ensureSpace(22);
            drawText("Nenhuma parcela paga marcada neste contrato.", ML, curY - 10, 8.5, { color: PDF_COLORS.slate });
            curY -= 20;
        }

        // Pagamentos extras
        if (rc.extras.length > 0) {
            ensureSpace(46);
            drawText(
                truncatePdfText(`Pagamentos Extras / Antecipações (${c.descricao || `Contrato ${idx + 1}`})`, CW, 9, true),
                ML,
                curY - 10,
                9,
                { bold: true, color: PDF_COLORS.navy },
            );
            curY -= 15;

            const colsExtras: PdfColumn[] = [
                { label: "Descrição", width: 165.28, align: "left" },
                { label: "Data", width: 68, align: "left" },
                { label: "Valor Base", width: 72, align: "right" },
                { label: "Correção", width: 70, align: "right" },
                { label: "Juros", width: 70, align: "right" },
                { label: "Total", width: 78, align: "right" },
            ];
            const rowsExtras: PdfCell[][] = rc.extras.map((ex) => [
                { text: ex.descricao || "Pagamento extra" },
                { text: formatDataBR(ex.data) },
                { text: brl(ex.valorBase) },
                { text: brl(ex.correcao) },
                { text: brl(ex.juros) },
                { text: brl(ex.total), bold: true },
            ]);
            drawPaginatedTable(colsExtras, rowsExtras, {
                continuationTitle: `${tituloContrato} — Pagamentos extras (continuação)`,
            });
        }
    });

    // 5. Seguros Prestamistas e Tarifas Abusivas
    if (res.tarifas.length > 0) {
        ensureSpace(58);
        drawText("Seguros Prestamistas e Tarifas Abusivas", ML, curY - 11, 10.5, {
            bold: true,
            color: PDF_COLORS.navy,
        });
        drawLine(ML, curY - 16, W - MR, curY - 16, PDF_COLORS.gold, 1.2);
        curY -= 22;

        const colsTarifas: PdfColumn[] = [
            { label: "Descrição", width: 105.28, align: "left" },
            { label: "Data", width: 54, align: "left" },
            { label: "Restituição", width: 64, align: "left" },
            { label: "Original", width: 60, align: "right" },
            { label: "Base", width: 60, align: "right" },
            { label: "Correção", width: 58, align: "right" },
            { label: "Juros", width: 56, align: "right" },
            { label: "Total", width: 66, align: "right" },
        ];
        const rowsTarifas: PdfCell[][] = res.tarifas.map((t) => [
            { text: t.titulo },
            { text: formatDataBR(t.item.dataCobranca) },
            { text: t.item.emDobro ? "Dobro (Art. 42)" : "Simples" },
            { text: brl(t.valorOriginal) },
            { text: brl(t.valorBaseRestituicao) },
            { text: brl(t.correcao) },
            { text: brl(t.juros) },
            { text: brl(t.total), bold: true },
        ]);
        drawPaginatedTable(colsTarifas, rowsTarifas, {
            continuationTitle: "Seguros Prestamistas e Tarifas Abusivas (continuação)",
            fontSize: 7.3,
            footerRow: [
                { text: "Subtotal de Seguros e Tarifas Atualizado", bold: true, colSpan: 7 },
                { text: "" },
                { text: "" },
                { text: "" },
                { text: "" },
                { text: "" },
                { text: "" },
                { text: brl(r.tarifasAtualizado), bold: true },
            ],
        });
    }

    // 6. Valores a Deduzir (Pagamentos / Alvarás)
    if (res.deducoes.length > 0) {
        ensureSpace(58);
        drawText("Valores a Deduzir (Pagamentos / Alvarás)", ML, curY - 11, 10.5, {
            bold: true,
            color: PDF_COLORS.navy,
        });
        drawLine(ML, curY - 16, W - MR, curY - 16, PDF_COLORS.gold, 1.2);
        curY -= 22;

        const colsDed: PdfColumn[] = [
            { label: "Descrição", width: 165.28, align: "left" },
            { label: "Data", width: 68, align: "left" },
            { label: "Valor Base", width: 72, align: "right" },
            { label: "Correção", width: 70, align: "right" },
            { label: "Juros", width: 70, align: "right" },
            { label: "Total Deduzido", width: 78, align: "right" },
        ];
        const rowsDed: PdfCell[][] = res.deducoes.map((d) => [
            { text: d.item.descricao || "Dedução / Alvará" },
            { text: formatDataBR(d.item.data) },
            { text: brl(d.valorBase) },
            { text: brl(d.correcao) },
            { text: brl(d.juros) },
            { text: `- ${brl(d.total)}`, bold: true, color: PDF_COLORS.destructive },
        ]);
        drawPaginatedTable(colsDed, rowsDed, {
            continuationTitle: "Valores a Deduzir (continuação)",
            footerRow: [
                { text: "Subtotal Deduzido", bold: true, colSpan: 5 },
                { text: "" },
                { text: "" },
                { text: "" },
                { text: "" },
                { text: `- ${brl(r.deducoesAtualizado)}`, bold: true, color: PDF_COLORS.destructive },
            ],
        });
    }

    // 7. Observações do Caso
    const obsTrim = meta.observacoes?.trim();
    if (obsTrim) {
        const obsLines = wrapPdfText(obsTrim, CW - 20, 8.5, false);
        const lineH = 11.5;
        let idxLine = 0;
        let firstObsChunk = true;
        while (idxLine < obsLines.length) {
            if (curY - 36 < BOTTOM_Y) {
                newPage();
            }
            const maxLinesHere = Math.max(1, Math.floor((curY - BOTTOM_Y - (firstObsChunk ? 24 : 14)) / lineH));
            const slice = obsLines.slice(idxLine, idxLine + maxLinesHere);
            const blockH = (firstObsChunk ? 22 : 10) + slice.length * lineH + 6;
            const boxBottom = curY - blockH;

            fillRect(ML, boxBottom, CW, blockH, PDF_COLORS.cardSubtle);
            fillRect(ML, boxBottom, 3, blockH, PDF_COLORS.gold);

            let ly = curY - 13;
            if (firstObsChunk) {
                drawText("Observações do Caso:", ML + 10, ly, 8.5, { bold: true, color: PDF_COLORS.navy });
                ly -= 13;
            }
            for (const line of slice) {
                if (line) {
                    drawText(line, ML + 10, ly, 8.5, { color: PDF_COLORS.navy });
                }
                ly -= lineH;
            }
            curY = boxBottom - 10;
            idxLine += slice.length;
            firstObsChunk = false;
        }
    }

    // 8. Assinatura técnica
    ensureSpace(56);
    curY -= 14;
    const sigW = 200;
    const sigX1 = W - MR - sigW;
    const sigX2 = W - MR;
    const sigCenter = (sigX1 + sigX2) / 2;
    drawLine(sigX1, curY, sigX2, curY, PDF_COLORS.navy, 0.8);
    drawText(advogadoPdf, sigCenter, curY - 12, 9.5, { bold: true, color: PDF_COLORS.navy, align: "center" });
    drawText(`Advogado · ${oabPdf}`, sigCenter, curY - 23, 8, {
        color: PDF_COLORS.slate,
        align: "center",
    });

    // 9. Rodapé em todas as páginas
    const totalPages = pages.length;
    pages.forEach((cmds, idx) => {
        cmds.push(
            `${PDF_COLORS.border} RG 0.50 w ${ML.toFixed(2)} 38.00 m ${(W - MR).toFixed(2)} 38.00 l S`,
            `BT /F1 7.50 Tf ${PDF_COLORS.slate} rg ${ML.toFixed(2)} 25.00 Td ${encodePdfHex(`Ian Granja Advogados · ${oabPdf} — Laudo Técnico Revisional`)} Tj ET`,
        );
        const pagTxt = `Página ${idx + 1} de ${totalPages}`;
        const pagX = W - MR - measurePdfText(pagTxt, 7.5, false);
        cmds.push(
            `BT /F1 7.50 Tf ${PDF_COLORS.slate} rg ${pagX.toFixed(2)} 25.00 Td ${encodePdfHex(pagTxt)} Tj ET`,
        );
    });

    // Montagem dos objetos PDF 1.4 com xref em offsets exatos de 20 bytes
    const objects: string[] = [];
    const pageObjIds = pages.map((_, idx) => 7 + idx * 2);

    objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
    objects.push(
        `2 0 obj\n<< /Type /Pages /Count ${pages.length} /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(" ")}] >>\nendobj\n`,
    );
    objects.push("3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n");
    objects.push(
        "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n",
    );
    objects.push(
        `5 0 obj\n<< /Title ${encodePdfHex(`Laudo Técnico Revisional — ${info.cliente}`)} /Author ${encodePdfHex(`Ian Granja Advogados · ${oabPdf}`)} /Creator ${encodePdfHex("Calculadora Revisional Ian Granja Advogados")} >>\nendobj\n`,
    );

    pages.forEach((cmds, idx) => {
        const contentId = 6 + idx * 2;
        const pageId = 7 + idx * 2;
        const stream = cmds.join("\n");
        objects.push(`${contentId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`);
        objects.push(
            `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W.toFixed(2)} ${H.toFixed(2)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`,
        );
    });

    const parts: string[] = ["%PDF-1.4\n%IGPDF\n"];
    let cursor = parts[0].length;
    const offsets: number[] = [];

    for (const obj of objects) {
        offsets.push(cursor);
        parts.push(obj);
        cursor += obj.length;
    }

    const xrefOffset = cursor;
    parts.push(`xref\n0 ${objects.length + 1}\n`);
    parts.push("0000000000 65535 f \n");
    for (const off of offsets) {
        parts.push(`${String(off).padStart(10, "0")} 00000 n \n`);
    }
    parts.push(
        `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
    );

    const pdfAscii = parts.join("");
    const out = new Uint8Array(new ArrayBuffer(pdfAscii.length));
    for (let i = 0; i < pdfAscii.length; i++) {
        out[i] = pdfAscii.charCodeAt(i) & 0x7f;
    }
    return out;
}

/** Gera o PDF A4 completo em memória e inicia o download direto no navegador, sem painel de impressão. */
export function baixarLaudoPdf(res: ResultadoProcessoRevisional, meta: LaudoMetadata): boolean {
    if (!getWin()) return false;
    const bytes = gerarBytesLaudoPdf(res, meta);
    const blob = new Blob([bytes], { type: "application/pdf" });
    return dispararDownloadBlob(blob, nomeArquivoSeguro(meta.clienteNome, "laudo-revisional.pdf"));
}

export function baixarCsvDemonstrativo(res: ResultadoProcessoRevisional, meta: LaudoMetadata): void {
    if (!getWin()) return;
    const csv = gerarCsvDemonstrativo(res, meta);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    dispararDownloadBlob(blob, nomeArquivoSeguro(meta.clienteNome, "revisional.csv"));
}
