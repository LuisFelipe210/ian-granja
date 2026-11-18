import { Building2, CalendarDays, Plus, RotateCcw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Campo, ModalidadeSelect, PessoaToggle, labelClass } from "@/components/juros/Campos";
import { MODALIDADES, lerMoeda, mascaraMoeda, num } from "@/lib/juros";
import {
    BANCOS_USUAIS,
    gerarGradePadrao,
    primeiroVencimentoSugerido,
    type ContratoFormState,
    type FonteTaxaRevisional,
} from "@/lib/juros/revisional-pro";

interface FormContratoRevisionalProps {
    index: number;
    totalContratos: number;
    form: ContratoFormState;
    onChange: (atualizado: ContratoFormState) => void;
    onRemover: () => void;
    onAbrirOlinda: () => void;
}

export const FormContratoRevisional = ({
    index,
    totalContratos,
    form,
    onChange,
    onRemover,
    onAbrirOlinda,
}: FormContratoRevisionalProps) => {
    const patch = (parcial: Partial<ContratoFormState>) => onChange({ ...form, ...parcial });
    const idP = `ct-${index}`;
    const modAtual = MODALIDADES.find((m) => m.id === form.modalidadeId) ?? null;

    const handleDataContrato = (novaData: string) => {
        const atualizaPrimeiro = !form.primeiroVencimento || form.primeiroVencimento === primeiroVencimentoSugerido(form.dataContrato);
        patch({
            dataContrato: novaData,
            primeiroVencimento: atualizaPrimeiro ? primeiroVencimentoSugerido(novaData) : form.primeiroVencimento,
        });
    };

    const regenerarGrade = () => {
        const n = parseInt(form.parcelas, 10) || 0;
        const val = lerMoeda(form.parcela);
        const pagas = parseInt(form.pagas || "0", 10) || 0;
        if (n < 1 || !(val > 0)) return;
        const novaGrade = gerarGradePadrao(form.primeiroVencimento, form.dataContrato, n, val, pagas);
        patch({ gradePersonalizada: novaGrade });
    };

    const atualizarParcelaGrade = (numParcela: number, changes: { paga?: boolean; vencimento?: string; valorPago?: number }) => {
        if (!form.gradePersonalizada) return;
        const atualizada = form.gradePersonalizada.map((item) =>
            item.numero === numParcela ? { ...item, ...changes } : item,
        );
        const pagasContadas = atualizada.filter((i) => i.paga).length;
        patch({
            gradePersonalizada: atualizada,
            pagas: String(pagasContadas),
        });
    };

    const adicionarExtra = () => {
        patch({
            pagamentosExtras: [
                ...form.pagamentosExtras,
                {
                    id: `ext-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    descricao: "",
                    data: form.dataContrato || "",
                    valorStr: "",
                },
            ],
        });
    };

    return (
        <section className="sheet-on-paper space-y-6 border border-ink/20 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/15 pb-3">
                <div>
                    <span className="rubric text-gold-deep">02 · Contrato {index + 1}</span>
                    <h3 className="subdisplay mt-0.5 text-xl text-ink">
                        {form.descricao || `Contrato ${index + 1}`}
                    </h3>
                </div>
                <div className="flex items-center gap-2">
                    {form.instituicao.trim() && (
                        <span className="border border-ink/15 bg-secondary/70 px-2.5 py-1 text-[11px] font-semibold text-ink">
                            {form.instituicao.trim()}
                        </span>
                    )}
                    {totalContratos > 1 && (
                        <button
                            type="button"
                            onClick={onRemover}
                            className="inline-flex h-8 items-center gap-1 border border-ink/25 px-2.5 text-xs font-semibold text-destructive hover:border-destructive"
                        >
                            <Trash2 className="size-3.5" />
                            Remover
                        </button>
                    )}
                </div>
            </div>

            {/* Metadados do contrato */}
            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <label htmlFor={`${idP}-banco`} className={labelClass}>
                        Instituição financeira
                    </label>
                    <input
                        id={`${idP}-banco`}
                        list={`${idP}-bancos-list`}
                        value={form.instituicao}
                        onChange={(e) => patch({ instituicao: e.target.value })}
                        placeholder="Digite ou escolha..."
                        className="field py-2 text-sm"
                    />
                    <datalist id={`${idP}-bancos-list`}>
                        {BANCOS_USUAIS.map((b) => (
                            <option key={b} value={b} />
                        ))}
                    </datalist>
                </div>

                <div>
                    <label htmlFor={`${idP}-num`} className={labelClass}>
                        Nº do contrato
                    </label>
                    <input
                        id={`${idP}-num`}
                        value={form.numeroContrato}
                        onChange={(e) => patch({ numeroContrato: e.target.value })}
                        placeholder="Opcional"
                        className="field py-2 text-sm"
                    />
                </div>

                <div className="sm:col-span-2">
                    <label htmlFor={`${idP}-desc`} className={labelClass}>
                        Descrição do contrato
                    </label>
                    <input
                        id={`${idP}-desc`}
                        value={form.descricao}
                        onChange={(e) => patch({ descricao: e.target.value })}
                        placeholder="Ex.: Financiamento Honda Civic, Empréstimo Consignado..."
                        className="field py-2 text-sm"
                    />
                </div>
            </div>

            <div className="space-y-4">
                <fieldset className="space-y-2.5">
                    <legend className={labelClass}>Contratante</legend>
                    <PessoaToggle
                        value={form.pessoa}
                        onChange={(p) => {
                            const primeira = MODALIDADES.find((m) => m.pessoa === p);
                            patch({ pessoa: p, modalidadeId: primeira?.id ?? "", bancoOlinda: null });
                        }}
                    />
                </fieldset>

                <fieldset className="space-y-2">
                    <legend className={labelClass}>Modalidade BACEN</legend>
                    <ModalidadeSelect
                        id={`${idP}-mod`}
                        pessoa={form.pessoa}
                        value={form.modalidadeId || null}
                        onChange={(m) => patch({ modalidadeId: m?.id ?? "", bancoOlinda: null })}
                        tecnico
                    />
                </fieldset>
            </div>

            {/* Bloco numérico-financeiro agrupado */}
            <div className="space-y-5 border border-ink/15 bg-secondary/35 p-4">
                <div className="flex items-center justify-between border-b border-ink/15 pb-2">
                    <span className="rubric text-ink/75">Dados numéricos da contratação</span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                        <label htmlFor={`${idP}-data`} className={labelClass}>
                            Data da contratação
                        </label>
                        <input
                            id={`${idP}-data`}
                            type="date"
                            value={form.dataContrato}
                            max={new Date().toISOString().slice(0, 10)}
                            onChange={(e) => handleDataContrato(e.target.value)}
                            className="field py-2 text-sm tabular-nums"
                        />
                    </div>
                    <div>
                        <label htmlFor={`${idP}-venc1`} className={labelClass}>
                            1º vencimento
                        </label>
                        <input
                            id={`${idP}-venc1`}
                            type="date"
                            value={form.primeiroVencimento}
                            onChange={(e) => patch({ primeiroVencimento: e.target.value })}
                            className="field py-2 text-sm tabular-nums"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-x-5 gap-y-5">
                    <Campo
                        id={`${idP}-valor`}
                        label="Valor financiado"
                        tipo="moeda"
                        value={form.valorF}
                        onChange={(v) => patch({ valorF: v })}
                        placeholder="0,00"
                    />
                    <Campo
                        id={`${idP}-parcela`}
                        label="Valor da parcela"
                        tipo="moeda"
                        value={form.parcela}
                        onChange={(v) => patch({ parcela: v })}
                        placeholder="0,00"
                    />
                    <Campo
                        id={`${idP}-n`}
                        label="Nº de parcelas"
                        tipo="inteiro"
                        value={form.parcelas}
                        onChange={(v) => patch({ parcelas: v, gradePersonalizada: null })}
                        placeholder="48"
                    />
                    <Campo
                        id={`${idP}-pagas`}
                        label="Parcelas pagas"
                        tipo="inteiro"
                        value={form.pagas}
                        onChange={(v) => patch({ pagas: v, gradePersonalizada: null })}
                        placeholder="0"
                    />
                    <Campo
                        id={`${idP}-tm`}
                        label="Taxa do contrato"
                        tipo="taxa"
                        sufixo="% a.m."
                        value={form.taxaM}
                        onChange={(v) => patch({ taxaM: v })}
                        placeholder="2,99"
                    />
                    <Campo
                        id={`${idP}-ta`}
                        label="Taxa do contrato"
                        tipo="taxa"
                        sufixo="% a.a."
                        value={form.taxaA}
                        onChange={(v) => patch({ taxaA: v })}
                        placeholder="42,48"
                    />
                </div>
            </div>

            {/* Fonte da Taxa Revisional + Botão Olinda */}
            <div className="space-y-4 border-t border-ink/15 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={labelClass}>Taxa paradigma (revisional)</span>
                    <button
                        type="button"
                        disabled={!modAtual}
                        onClick={onAbrirOlinda}
                        className="inline-flex h-8 items-center gap-1.5 border border-ink/35 px-3 text-xs font-semibold text-ink hover:bg-ink hover:text-paper disabled:opacity-50"
                    >
                        <Building2 className="size-3.5" />
                        Ver Tabela BCB (Olinda)
                    </button>
                </div>

                <div className="grid grid-cols-3 border border-ink/25 text-xs font-semibold">
                    {(
                        [
                            ["media_sgs", "Média BACEN"],
                            ["banco_olinda", "Banco (Olinda)"],
                            ["manual", "Manual"],
                        ] as [FonteTaxaRevisional, string][]
                    ).map(([id, rotulo]) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => patch({ fonteTaxaRevisional: id })}
                            className={cn(
                                "min-h-10 px-2 py-2 text-center transition-colors border-r border-ink/25 last:border-r-0",
                                form.fonteTaxaRevisional === id ? "bg-ink text-paper" : "text-ink hover:bg-ink/5",
                            )}
                        >
                            {rotulo}
                        </button>
                    ))}
                </div>

                {form.fonteTaxaRevisional === "banco_olinda" && (
                    <div className="border border-gold bg-gold-light/25 px-4 py-3 text-sm">
                        {form.bancoOlinda ? (
                            <p className="text-ink">
                                <strong>{form.bancoOlinda.instituicao}</strong>: {num(form.bancoOlinda.taxaAm)}% a.m. /{" "}
                                {num(form.bancoOlinda.taxaAa)}% a.a. ({form.bancoOlinda.periodo})
                            </p>
                        ) : (
                            <p className="text-muted-foreground">
                                Clique em <strong>Ver Tabela BCB (Olinda)</strong> acima para escolher a instituição financeira.
                            </p>
                        )}
                    </div>
                )}

                {form.fonteTaxaRevisional === "manual" && (
                    <div className="grid grid-cols-2 gap-4">
                        <Campo
                            id={`${idP}-revm`}
                            label="Taxa revisional"
                            tipo="taxa"
                            sufixo="% a.m."
                            value={form.revisionalM}
                            onChange={(v) => patch({ revisionalM: v })}
                        />
                        <Campo
                            id={`${idP}-reva`}
                            label="Taxa revisional"
                            tipo="taxa"
                            sufixo="% a.a."
                            value={form.revisionalA}
                            onChange={(v) => patch({ revisionalA: v })}
                        />
                    </div>
                )}
            </div>

            {/* Grade individual de parcelas & Pagamentos extras */}
            <details className="border-t border-ink/20 pt-3">
                <summary className="flex cursor-pointer items-center justify-between py-2 text-sm font-semibold text-ink">
                    <span className="inline-flex items-center gap-2">
                        <CalendarDays className="size-4 text-gold-deep" />
                        Grade de parcelas e pagamentos extras
                        {form.gradePersonalizada && (
                            <span className="bg-gold-light px-1.5 py-0.5 text-[11px] font-bold text-ink">
                                Personalizada
                            </span>
                        )}
                        {form.pagamentosExtras.length > 0 && (
                            <span className="bg-ink/10 px-1.5 py-0.5 text-[11px] font-semibold text-ink">
                                +{form.pagamentosExtras.length} extra(s)
                            </span>
                        )}
                    </span>
                </summary>

                <div className="mt-4 space-y-5">
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={regenerarGrade}
                            className="inline-flex h-9 items-center gap-1.5 bg-ink px-3 text-xs font-semibold text-paper hover:bg-ink-soft"
                        >
                            <RotateCcw className="size-3.5" />
                            {form.gradePersonalizada ? "Regerar grade padrão" : "Gerar grade editável"}
                        </button>
                        {form.gradePersonalizada && (
                            <button
                                type="button"
                                onClick={() => patch({ gradePersonalizada: null })}
                                className="inline-flex h-9 items-center border border-ink/30 px-3 text-xs font-semibold text-ink hover:bg-ink/5"
                            >
                                Voltar ao automático
                            </button>
                        )}
                    </div>

                    {form.gradePersonalizada && (
                        <div className="max-h-72 overflow-auto border border-ink/20">
                            <table className="w-full text-xs tabular-nums">
                                <thead className="sticky top-0 bg-secondary text-muted-foreground">
                                    <tr>
                                        <th className="px-2.5 py-2 text-left">Paga</th>
                                        <th className="px-2.5 py-2 text-left">Nº</th>
                                        <th className="px-2.5 py-2 text-left">Vencimento</th>
                                        <th className="px-2.5 py-2 text-right">Valor pago (R$)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-ink/10">
                                    {form.gradePersonalizada.map((item) => (
                                        <tr key={item.numero}>
                                            <td className="px-2.5 py-1.5">
                                                <input
                                                    type="checkbox"
                                                    checked={item.paga}
                                                    aria-label={`Parcela ${item.numero} paga`}
                                                    onChange={(e) =>
                                                        atualizarParcelaGrade(item.numero, { paga: e.target.checked })
                                                    }
                                                />
                                            </td>
                                            <td className="px-2.5 py-1.5 font-semibold">{item.numero}</td>
                                            <td className="px-2.5 py-1.5">
                                                <input
                                                    type="date"
                                                    value={item.vencimento}
                                                    aria-label={`Vencimento parcela ${item.numero}`}
                                                    onChange={(e) =>
                                                        atualizarParcelaGrade(item.numero, { vencimento: e.target.value })
                                                    }
                                                    className="border-b border-ink/25 bg-transparent py-0.5 text-xs"
                                                />
                                            </td>
                                            <td className="px-2.5 py-1.5 text-right">
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={item.valorPago > 0 ? num(item.valorPago) : ""}
                                                    aria-label={`Valor pago parcela ${item.numero}`}
                                                    onChange={(e) => {
                                                        const masked = mascaraMoeda(e.target.value);
                                                        atualizarParcelaGrade(item.numero, {
                                                            valorPago: lerMoeda(masked),
                                                        });
                                                    }}
                                                    className="w-24 border-b border-ink/25 bg-transparent py-0.5 text-right text-xs"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagamentos extras */}
                    <div className="space-y-3 border-t border-ink/15 pt-4">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Pagamentos extras / antecipações
                            </span>
                            <button
                                type="button"
                                onClick={adicionarExtra}
                                className="inline-flex h-8 items-center gap-1 border border-ink/30 px-2.5 text-xs font-semibold text-ink hover:bg-ink/5"
                            >
                                <Plus className="size-3.5" />
                                Adicionar extra
                            </button>
                        </div>

                        {form.pagamentosExtras.map((ex) => (
                            <div
                                key={ex.id}
                                className="grid gap-3 border border-ink/15 bg-background/60 p-3 sm:grid-cols-[minmax(0,1fr)_9.5rem_7.5rem_auto] sm:items-end"
                            >
                                <div>
                                    <label className="block text-xs font-semibold text-ink">Descrição</label>
                                    <input
                                        value={ex.descricao}
                                        onChange={(e) =>
                                            patch({
                                                pagamentosExtras: form.pagamentosExtras.map((x) =>
                                                    x.id === ex.id ? { ...x, descricao: e.target.value } : x,
                                                ),
                                            })
                                        }
                                        placeholder="Ex.: Quitação antecipada"
                                        className="field py-1.5 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-ink">Data</label>
                                    <input
                                        type="date"
                                        value={ex.data}
                                        onChange={(e) =>
                                            patch({
                                                pagamentosExtras: form.pagamentosExtras.map((x) =>
                                                    x.id === ex.id ? { ...x, data: e.target.value } : x,
                                                ),
                                            })
                                        }
                                        className="field py-1.5 text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-ink">Valor (R$)</label>
                                    <input
                                        value={ex.valorStr}
                                        inputMode="numeric"
                                        onChange={(e) =>
                                            patch({
                                                pagamentosExtras: form.pagamentosExtras.map((x) =>
                                                    x.id === ex.id ? { ...x, valorStr: mascaraMoeda(e.target.value) } : x,
                                                ),
                                            })
                                        }
                                        placeholder="0,00"
                                        className="field py-1.5 text-sm tabular-nums"
                                    />
                                </div>
                                <button
                                    type="button"
                                    aria-label="Remover pagamento extra"
                                    onClick={() =>
                                        patch({
                                            pagamentosExtras: form.pagamentosExtras.filter((x) => x.id !== ex.id),
                                        })
                                    }
                                    className="inline-flex size-8 items-center justify-center text-ink/60 hover:text-destructive"
                                >
                                    <Trash2 className="size-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </details>
        </section>
    );
};
