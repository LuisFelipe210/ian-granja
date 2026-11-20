import { useEffect, useState } from "react";
import { Plus, Scale, ShieldAlert, Trash2 } from "lucide-react";
import { labelClass } from "@/components/juros/Campos";
import { lerDecimal, lerMoeda, mascaraMoeda, num } from "@/lib/juros";
import {
    INDICES_CORRECAO_OPCOES,
    TIPOS_JUROS_OPCOES,
    TIPOS_TARIFA,
    hojeISO,
    type DeducaoItem,
    type IndiceCorrecao,
    type ParametrosDecisao,
    type TarifaItem,
    type TermoInicialCorrecao,
    type TermoInicialJuros,
    type TipoJuros,
} from "@/lib/juros/revisional-pro";

interface SecoesPericiaisExtrasProps {
    parametros: ParametrosDecisao;
    onParametrosChange: (p: ParametrosDecisao) => void;
    tarifas: TarifaItem[];
    onTarifasChange: (t: TarifaItem[]) => void;
    deducoes: DeducaoItem[];
    onDeducoesChange: (d: DeducaoItem[]) => void;
    dataContratoPadrao: string;
}

export const SecoesPericiaisExtras = ({
    parametros,
    onParametrosChange,
    tarifas,
    onTarifasChange,
    deducoes,
    onDeducoesChange,
    dataContratoPadrao,
}: SecoesPericiaisExtrasProps) => {
    const patchParam = (p: Partial<ParametrosDecisao>) => onParametrosChange({ ...parametros, ...p });

    const adicionarTarifa = () => {
        onTarifasChange([
            ...tarifas,
            {
                id: `tar-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                tipo: TIPOS_TARIFA[0],
                descricaoCustom: "",
                valor: 0,
                dataCobranca: dataContratoPadrao || hojeISO(),
                emDobro: true,
            },
        ]);
    };

    const adicionarDeducao = () => {
        onDeducoesChange([
            ...deducoes,
            {
                id: `ded-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                descricao: "",
                valor: 0,
                data: hojeISO(),
                atualizar: true,
            },
        ]);
    };

    const dataBaseBr = parametros.dataBaseAtualizacao
        ? parametros.dataBaseAtualizacao.split("-").reverse().join("/")
        : "Hoje";
    const resumoIndice =
        parametros.tipoJuros === "SELIC"
            ? "SELIC"
            : parametros.indiceCorrecao === "INPC_IPCA"
              ? "INPC+IPCA"
              : parametros.indiceCorrecao;

    const [tarifasAberto, setTarifasAberto] = useState(tarifas.length > 0);
    const [decisaoAberto, setDecisaoAberto] = useState(deducoes.length > 0);
    const [jurosFixoTexto, setJurosFixoTexto] = useState(() => num(parametros.jurosFixoMensal));
    const [multaTexto, setMultaTexto] = useState(() =>
        parametros.multaGlobalPercentual > 0 ? num(parametros.multaGlobalPercentual) : "",
    );
    const [honorariosTexto, setHonorariosTexto] = useState(() =>
        parametros.honorariosPercentual > 0 ? num(parametros.honorariosPercentual) : "",
    );

    useEffect(() => {
        if (tarifas.length > 0) setTarifasAberto(true);
    }, [tarifas.length]);

    useEffect(() => {
        if (deducoes.length > 0) setDecisaoAberto(true);
    }, [deducoes.length]);

    useEffect(() => {
        setJurosFixoTexto((atual) => {
            const parsed = lerDecimal(atual);
            return !Number.isNaN(parsed) && Math.abs(parsed - parametros.jurosFixoMensal) < 1e-6
                ? atual
                : num(parametros.jurosFixoMensal);
        });
    }, [parametros.jurosFixoMensal]);

    useEffect(() => {
        setMultaTexto((atual) => {
            const parsed = atual.trim() === "" ? 0 : lerDecimal(atual);
            return !Number.isNaN(parsed) && Math.abs(parsed - parametros.multaGlobalPercentual) < 1e-6
                ? atual
                : parametros.multaGlobalPercentual > 0
                  ? num(parametros.multaGlobalPercentual)
                  : "";
        });
    }, [parametros.multaGlobalPercentual]);

    useEffect(() => {
        setHonorariosTexto((atual) => {
            const parsed = atual.trim() === "" ? 0 : lerDecimal(atual);
            return !Number.isNaN(parsed) && Math.abs(parsed - parametros.honorariosPercentual) < 1e-6
                ? atual
                : parametros.honorariosPercentual > 0
                  ? num(parametros.honorariosPercentual)
                  : "";
        });
    }, [parametros.honorariosPercentual]);

    return (
        <div className="space-y-3.5">
            {/* 1. Seguros Prestamistas e Tarifas Abusivas */}
            <details
                open={tarifasAberto}
                onToggle={(e) => setTarifasAberto(e.currentTarget.open)}
                className="border border-ink/20 bg-card"
            >
                <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-3.5 text-sm font-semibold text-ink hover:bg-ink/[0.02]">
                    <span className="inline-flex items-center gap-2">
                        <ShieldAlert className="size-4 text-gold-deep" />
                        <span className="sys-section">Seguros prestamistas e tarifas</span>
                    </span>
                    <span className="bg-secondary px-2 py-0.5 text-[11px] font-bold tabular-nums text-ink">
                        {tarifas.length}
                    </span>
                </summary>
                <div className="space-y-4 border-t border-ink/15 p-5">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                        Adicione Seguro Prestamista, TAC, TEC, Avaliação do Bem, Registro ou Serviços de Terceiros para
                        incluir no cálculo e no laudo.
                    </p>

                    {tarifas.map((t) => (
                        <div key={t.id} className="space-y-4 border border-ink/20 bg-background/50 p-4">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                    <label className="block text-xs font-semibold text-ink">Tipo de tarifa / seguro</label>
                                    <select
                                        value={t.tipo}
                                        onChange={(e) =>
                                            onTarifasChange(
                                                tarifas.map((x) => (x.id === t.id ? { ...x, tipo: e.target.value } : x)),
                                            )
                                        }
                                        className="field py-2 text-sm [&>option]:text-ink"
                                    >
                                        {TIPOS_TARIFA.map((tipo) => (
                                            <option key={tipo} value={tipo}>
                                                {tipo}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    type="button"
                                    aria-label="Remover tarifa"
                                    onClick={() => onTarifasChange(tarifas.filter((x) => x.id !== t.id))}
                                    className="mt-5 inline-flex size-8 items-center justify-center text-ink/60 hover:text-destructive"
                                >
                                    <Trash2 className="size-4" />
                                </button>
                            </div>

                            {t.tipo === "Outra" && (
                                <div>
                                    <label className="block text-xs font-semibold text-ink">Especificar tarifa</label>
                                    <input
                                        value={t.descricaoCustom}
                                        onChange={(e) =>
                                            onTarifasChange(
                                                tarifas.map((x) =>
                                                    x.id === t.id ? { ...x, descricaoCustom: e.target.value } : x,
                                                ),
                                            )
                                        }
                                        placeholder="Ex.: Tarifa de gravame"
                                        className="field py-2 text-sm"
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-ink">Valor cobrado (R$)</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={t.valor > 0 ? num(t.valor) : ""}
                                        onChange={(e) => {
                                            const masked = mascaraMoeda(e.target.value);
                                            onTarifasChange(
                                                tarifas.map((x) =>
                                                    x.id === t.id ? { ...x, valor: lerMoeda(masked) } : x,
                                                ),
                                            );
                                        }}
                                        placeholder="0,00"
                                        className="field py-2 text-sm tabular-nums"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-ink">Data da cobrança</label>
                                    <input
                                        type="date"
                                        value={t.dataCobranca}
                                        onChange={(e) =>
                                            onTarifasChange(
                                                tarifas.map((x) =>
                                                    x.id === t.id ? { ...x, dataCobranca: e.target.value } : x,
                                                ),
                                            )
                                        }
                                        className="field py-2 text-xs tabular-nums"
                                    />
                                </div>
                            </div>

                            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink">
                                <input
                                    type="checkbox"
                                    checked={t.emDobro}
                                    onChange={(e) =>
                                        onTarifasChange(
                                            tarifas.map((x) => (x.id === t.id ? { ...x, emDobro: e.target.checked } : x)),
                                        )
                                    }
                                />
                                Restituição em dobro desta cobrança (Art. 42, parágrafo único, CDC)
                            </label>
                        </div>
                    ))}

                    <button
                        type="button"
                        onClick={adicionarTarifa}
                        className="inline-flex h-10 items-center gap-2 border border-ink/35 px-4 text-xs font-semibold text-ink hover:bg-ink hover:text-paper"
                    >
                        <Plus className="size-4" />
                        Adicionar tarifa / seguro
                    </button>
                </div>
            </details>

            {/* 2. Parâmetros da Decisão (Correção, Juros, Dobro, Multa, Honorários e Deduções) */}
            <details
                open={decisaoAberto}
                onToggle={(e) => setDecisaoAberto(e.currentTarget.open)}
                className="border border-ink/20 bg-card"
            >
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-5 py-3.5 text-sm font-semibold text-ink hover:bg-ink/[0.02]">
                    <span className="inline-flex items-center gap-2">
                        <Scale className="size-4 text-gold-deep" />
                        <span className="sys-section">Correção, juros, honorários e alvarás</span>
                    </span>
                    <span className="bg-secondary px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                        {resumoIndice} · até {dataBaseBr}
                        {deducoes.length > 0 ? ` · ${deducoes.length} ded.` : ""}
                    </span>
                </summary>

                <div className="space-y-6 border-t border-ink/15 p-5">
                    <div>
                        <label htmlFor="dec-indice" className={labelClass}>
                            Índice de correção monetária
                        </label>
                        <select
                            id="dec-indice"
                            value={parametros.indiceCorrecao}
                            disabled={parametros.tipoJuros === "SELIC" && parametros.termoInicialJuros !== "CITACAO"}
                            onChange={(e) => patchParam({ indiceCorrecao: e.target.value as IndiceCorrecao })}
                            className="field cursor-pointer text-sm disabled:opacity-50 [&>option]:text-ink"
                        >
                            {INDICES_CORRECAO_OPCOES.map((o) => (
                                <option key={o.id} value={o.id}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                        {parametros.tipoJuros === "SELIC" && (
                            <p className="mt-1 text-xs text-muted-foreground">
                                {parametros.termoInicialJuros === "CITACAO"
                                    ? "Antes da citação aplica-se o índice de correção acima; a partir da citação incide apenas a SELIC (Tema 905/STJ)."
                                    : "A Taxa SELIC já engloba correção monetária e juros moratórios (Tema 905/STJ)."}
                            </p>
                        )}
                    </div>

                    <div>
                        <label htmlFor="dec-juros" className={labelClass}>
                            Juros sobre as diferenças
                        </label>
                        <select
                            id="dec-juros"
                            value={parametros.tipoJuros}
                            onChange={(e) => patchParam({ tipoJuros: e.target.value as TipoJuros })}
                            className="field cursor-pointer text-sm [&>option]:text-ink"
                        >
                            {TIPOS_JUROS_OPCOES.map((o) => (
                                <option key={o.id} value={o.id}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {parametros.tipoJuros === "FIXO_CUSTOM" && (
                        <div>
                            <label htmlFor="dec-juros-fixo" className={labelClass}>
                                Juros mensal personalizado (% a.m.)
                            </label>
                            <input
                                id="dec-juros-fixo"
                                type="text"
                                value={jurosFixoTexto}
                                onChange={(e) => {
                                    setJurosFixoTexto(e.target.value);
                                    const val = lerDecimal(e.target.value);
                                    if (!Number.isNaN(val)) patchParam({ jurosFixoMensal: val });
                                }}
                                className="field tabular-nums"
                            />
                        </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label htmlFor="dec-term-corr" className={labelClass}>
                                Início da correção
                            </label>
                            <select
                                id="dec-term-corr"
                                value={parametros.termoInicialCorrecao}
                                onChange={(e) =>
                                    patchParam({ termoInicialCorrecao: e.target.value as TermoInicialCorrecao })
                                }
                                className="field text-sm [&>option]:text-ink"
                            >
                                <option value="VENCIMENTO">Vencimento / Pagamento</option>
                                <option value="DATA_FIXA">Data fixa</option>
                            </select>
                        </div>

                        <div>
                            <label htmlFor="dec-term-jur" className={labelClass}>
                                Início dos juros
                            </label>
                            <select
                                id="dec-term-jur"
                                value={parametros.termoInicialJuros}
                                onChange={(e) => patchParam({ termoInicialJuros: e.target.value as TermoInicialJuros })}
                                className="field text-sm [&>option]:text-ink"
                            >
                                <option value="VENCIMENTO">Vencimento / Pagamento</option>
                                <option value="CITACAO">A partir da citação</option>
                            </select>
                        </div>
                    </div>

                    {parametros.termoInicialCorrecao === "DATA_FIXA" && (
                        <div>
                            <label htmlFor="dec-data-fixa" className={labelClass}>
                                Data fixa inicial da correção
                            </label>
                            <input
                                id="dec-data-fixa"
                                type="date"
                                value={parametros.dataFixaCorrecao}
                                onChange={(e) => patchParam({ dataFixaCorrecao: e.target.value })}
                                className="field tabular-nums"
                            />
                        </div>
                    )}

                    {parametros.termoInicialJuros === "CITACAO" && (
                        <div>
                            <label htmlFor="dec-data-cit" className={labelClass}>
                                Data da citação
                            </label>
                            <input
                                id="dec-data-cit"
                                type="date"
                                value={parametros.dataCitacao}
                                onChange={(e) => patchParam({ dataCitacao: e.target.value })}
                                className="field tabular-nums"
                            />
                        </div>
                    )}

                    <div>
                        <label htmlFor="dec-data-base" className={labelClass}>
                            Atualizar até qual data?
                        </label>
                        <input
                            id="dec-data-base"
                            type="date"
                            value={parametros.dataBaseAtualizacao}
                            onChange={(e) => patchParam({ dataBaseAtualizacao: e.target.value })}
                            className="field tabular-nums"
                        />
                    </div>

                    <label className="flex cursor-pointer items-center gap-2.5 border-y border-ink/15 py-3 text-sm font-semibold text-ink">
                        <input
                            type="checkbox"
                            checked={parametros.restituicaoDobroParcelas}
                            onChange={(e) => patchParam({ restituicaoDobroParcelas: e.target.checked })}
                        />
                        Aplicar restituição em dobro nas parcelas (Art. 42, CDC)
                    </label>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="dec-multa" className={labelClass}>
                                Multa global (%)
                            </label>
                            <input
                                id="dec-multa"
                                type="text"
                                value={multaTexto}
                                placeholder="Ex.: 10,00"
                                onChange={(e) => {
                                    setMultaTexto(e.target.value);
                                    const v = lerDecimal(e.target.value);
                                    patchParam({ multaGlobalPercentual: Number.isNaN(v) ? 0 : v });
                                }}
                                className="field tabular-nums"
                            />
                        </div>
                        <div>
                            <label htmlFor="dec-hon" className={labelClass}>
                                Honorários (%)
                            </label>
                            <input
                                id="dec-hon"
                                type="text"
                                value={honorariosTexto}
                                placeholder="Ex.: 20,00"
                                onChange={(e) => {
                                    setHonorariosTexto(e.target.value);
                                    const v = lerDecimal(e.target.value);
                                    patchParam({ honorariosPercentual: Number.isNaN(v) ? 0 : v });
                                }}
                                className="field tabular-nums"
                            />
                        </div>
                    </div>

                    {/* Deduções / Alvarás */}
                    <div className="space-y-3 border-t border-ink/15 pt-4">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[13px] font-semibold text-ink">
                                Valores a deduzir (pagamentos / alvarás)
                            </span>
                            <button
                                type="button"
                                onClick={adicionarDeducao}
                                className="inline-flex h-8 items-center gap-1 border border-ink/30 px-2.5 text-xs font-semibold text-ink hover:bg-ink/5"
                            >
                                <Plus className="size-3.5" />
                                Adicionar dedução
                            </button>
                        </div>

                        {deducoes.map((d) => (
                            <div key={d.id} className="space-y-3 border border-ink/15 bg-background/50 p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <input
                                        value={d.descricao}
                                        onChange={(e) =>
                                            onDeducoesChange(
                                                deducoes.map((x) =>
                                                    x.id === d.id ? { ...x, descricao: e.target.value } : x,
                                                ),
                                            )
                                        }
                                        placeholder="Ex.: Alvará nº 123 / Devolução administrativa"
                                        className="field py-1.5 text-sm"
                                    />
                                    <button
                                        type="button"
                                        aria-label="Remover dedução"
                                        onClick={() => onDeducoesChange(deducoes.filter((x) => x.id !== d.id))}
                                        className="inline-flex size-8 items-center justify-center text-ink/60 hover:text-destructive"
                                    >
                                        <Trash2 className="size-4" />
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={d.valor > 0 ? num(d.valor) : ""}
                                        placeholder="Valor (R$)"
                                        onChange={(e) => {
                                            const masked = mascaraMoeda(e.target.value);
                                            onDeducoesChange(
                                                deducoes.map((x) =>
                                                    x.id === d.id ? { ...x, valor: lerMoeda(masked) } : x,
                                                ),
                                            );
                                        }}
                                        className="field py-1.5 text-sm tabular-nums"
                                    />
                                    <input
                                        type="date"
                                        value={d.data}
                                        onChange={(e) =>
                                            onDeducoesChange(
                                                deducoes.map((x) => (x.id === d.id ? { ...x, data: e.target.value } : x)),
                                            )
                                        }
                                        className="field py-1.5 text-xs tabular-nums"
                                    />
                                </div>
                                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-ink">
                                    <input
                                        type="checkbox"
                                        checked={d.atualizar}
                                        onChange={(e) =>
                                            onDeducoesChange(
                                                deducoes.map((x) =>
                                                    x.id === d.id ? { ...x, atualizar: e.target.checked } : x,
                                                ),
                                            )
                                        }
                                    />
                                    Atualizar dedução pelo mesmo índice e juros
                                </label>
                            </div>
                        ))}
                    </div>
                </div>
            </details>
        </div>
    );
};
