import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Check, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODALIDADES, num } from "@/lib/juros";
import {
    consultarTaxasOlinda,
    type TaxaOlindaRegistro,
    type TaxaOlindaSelecao,
} from "@/lib/juros/revisional-pro";
import { ModalDialog } from "@/components/juros/ModalDialog";

interface ModalRankingOlindaProps {
    aberto: boolean;
    modalidadeId: string;
    dataRef: string;
    bancoAtual: string;
    onFechar: () => void;
    onSelecionarTaxa: (sel: TaxaOlindaSelecao) => void;
    onPreencherBanco: (nome: string) => void;
}

function normalizarTextoBanco(s: string): string {
    return s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\bbco\b/g, "banco")
        .replace(/\s+/g, " ")
        .trim();
}

export const ModalRankingOlinda = ({
    aberto,
    modalidadeId,
    dataRef,
    bancoAtual,
    onFechar,
    onSelecionarTaxa,
    onPreencherBanco,
}: ModalRankingOlindaProps) => {
    const [carregando, setCarregando] = useState(false);
    const [registros, setRegistros] = useState<TaxaOlindaRegistro[]>([]);
    const [busca, setBusca] = useState("");
    const [erro, setErro] = useState<string | null>(null);
    const buscaInputRef = useRef<HTMLInputElement>(null);

    const mod = useMemo(() => MODALIDADES.find((m) => m.id === modalidadeId) ?? null, [modalidadeId]);

    useEffect(() => {
        if (!aberto) return;
        const raf = requestAnimationFrame(() => {
            buscaInputRef.current?.focus({ preventScroll: true });
        });
        return () => cancelAnimationFrame(raf);
    }, [aberto]);

    useEffect(() => {
        if (!aberto || !mod) return;
        setBusca("");
        setErro(null);

        if (!mod.olindaModalidade || !mod.olindaSegmento) {
            setRegistros([]);
            setErro("O Banco Central (API Olinda) não publica tabela diária por instituição para esta modalidade.");
            return;
        }

        let ativo = true;
        setCarregando(true);
        consultarTaxasOlinda(mod, dataRef)
            .then((rows) => {
                if (!ativo) return;
                setRegistros(rows);
                if (rows.length === 0) {
                    setErro("Não foi possível obter a tabela do BCB Olinda neste momento. Tente novamente em instantes.");
                }
            })
            .catch(() => {
                if (!ativo) return;
                setRegistros([]);
                setErro("Não foi possível consultar a tabela do BCB Olinda agora. Tente novamente em instantes.");
            })
            .finally(() => {
                if (ativo) setCarregando(false);
            });

        return () => {
            ativo = false;
        };
    }, [aberto, mod, dataRef]);

    const filtrados = useMemo(() => {
        const qRaw = busca.trim();
        const qNorm = normalizarTextoBanco(qRaw);
        if (!qNorm) return registros;
        return registros.filter(
            (r) => normalizarTextoBanco(r.instituicao).includes(qNorm) || r.cnpj8.includes(qRaw),
        );
    }, [busca, registros]);

    if (!aberto) return null;

    const periodo = registros[0]
        ? `${registros[0].inicioPeriodo.split("-").reverse().join("/")} a ${registros[0].fimPeriodo.split("-").reverse().join("/")}`
        : "";
    const bancoAtualNorm = normalizarTextoBanco(bancoAtual);

    return (
        <ModalDialog
            aberto={aberto}
            onFechar={onFechar}
            ariaLabelledBy="titulo-olinda"
            tituloAcessivel="Taxas por instituição financeira"
            contentClassName="flex h-[85vh] max-h-[44rem] w-[calc(100vw-1.5rem)] max-w-4xl flex-col overflow-hidden border border-ink/30 bg-card shadow-2xl sm:w-[calc(100vw-3rem)]"
        >
                <div className="shrink-0 flex items-start justify-between gap-4 border-b border-ink/20 bg-card px-5 py-4">
                    <div>
                        <h2 id="titulo-olinda" className="sys-title text-ink">
                            Taxas por instituição financeira
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {mod?.nome} ({mod?.pessoa.toUpperCase()})
                            {periodo ? ` · Período de referência: ${periodo}` : ""}
                            {" · Banco Central (API Olinda)"}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onFechar}
                        aria-label="Fechar tabela BCB"
                        className="inline-flex size-9 shrink-0 items-center justify-center text-ink/60 hover:text-ink"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                <div className="shrink-0 border-b border-ink/15 bg-background/70 px-5 py-3 sm:px-6">
                    <div className="relative">
                        <Search
                            aria-hidden
                            className="pointer-events-none absolute left-0 top-1/2 size-4 -translate-y-1/2 text-ink/50"
                        />
                        <input
                            ref={buscaInputRef}
                            type="search"
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            placeholder="Filtrar por banco (ex.: Santander, Pan, BV, Itaú, Bradesco, Banco do Brasil)..."
                            aria-label="Filtrar instituição financeira"
                            className="field pl-7 pr-8 [&::-webkit-search-cancel-button]:hidden"
                        />
                        {busca && (
                            <button
                                type="button"
                                onClick={() => {
                                    setBusca("");
                                    buscaInputRef.current?.focus();
                                }}
                                aria-label="Limpar filtro"
                                className="absolute right-0 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center text-ink/55 hover:text-ink"
                            >
                                <X className="size-4" />
                            </button>
                        )}
                    </div>
                </div>

                <div
                    tabIndex={0}
                    className="min-h-0 flex-1 overflow-auto overscroll-contain bg-card focus:outline-none"
                >
                    {carregando ? (
                        <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-muted-foreground">
                            <Loader2 className="size-6 animate-spin text-ink" />
                            <p className="text-sm">Consultando taxas por instituição no Banco Central…</p>
                        </div>
                    ) : erro ? (
                        <p className="px-6 py-16 text-center text-sm text-muted-foreground">{erro}</p>
                    ) : filtrados.length === 0 ? (
                        <p className="px-6 py-16 text-center text-sm text-muted-foreground">
                            Nenhuma instituição encontrada para "{busca}". Limpe o filtro para ver todo o ranking (
                            {registros.length} instituições).
                        </p>
                    ) : (
                        <table className="w-full min-w-[36rem] border-collapse text-sm tabular-nums">
                            <thead className="sticky top-0 z-10 bg-secondary text-xs text-muted-foreground shadow-[0_1px_0_hsl(var(--primary)/0.2)]">
                                <tr>
                                    <th className="py-3 pl-5 pr-3 text-left font-semibold sm:pl-6">Pos.</th>
                                    <th className="px-3 py-3 text-left font-semibold">Instituição Financeira</th>
                                    <th className="px-3 py-3 text-right font-semibold">Taxa % a.m.</th>
                                    <th className="px-3 py-3 text-right font-semibold">Taxa % a.a.</th>
                                    <th className="py-3 pl-3 pr-5 text-right font-semibold sm:pr-6">Aplicar</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-ink/10">
                                {filtrados.map((r) => {
                                    const match =
                                        bancoAtualNorm.length > 2 &&
                                        normalizarTextoBanco(r.instituicao).includes(bancoAtualNorm);
                                    return (
                                        <tr
                                            key={`${r.posicao}-${r.cnpj8 || r.instituicao}`}
                                            className={cn(
                                                "transition-colors hover:bg-ink/[0.03]",
                                                match && "bg-gold-light/30 hover:bg-gold-light/40",
                                            )}
                                        >
                                            <td className="py-2.5 pl-5 pr-3 text-muted-foreground sm:pl-6">
                                                {r.posicao}º
                                            </td>
                                            <td className="px-3 py-2.5 font-medium text-ink">{r.instituicao}</td>
                                            <td className="px-3 py-2.5 text-right font-semibold text-ink">
                                                {num(r.taxaAm)}%
                                            </td>
                                            <td className="px-3 py-2.5 text-right text-muted-foreground">
                                                {num(r.taxaAa)}%
                                            </td>
                                            <td className="py-2.5 pl-3 pr-5 text-right sm:pr-6">
                                                <div className="inline-flex items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            onSelecionarTaxa({
                                                                instituicao: r.instituicao,
                                                                taxaAm: r.taxaAm,
                                                                taxaAa: r.taxaAa,
                                                                periodo: r.inicioPeriodo,
                                                            });
                                                            onFechar();
                                                        }}
                                                        className="inline-flex h-8 items-center gap-1 whitespace-nowrap bg-ink px-2.5 text-xs font-semibold text-paper hover:bg-ink-soft"
                                                    >
                                                        <Check className="size-3" />
                                                        Usar taxa
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            onPreencherBanco(r.instituicao);
                                                            onFechar();
                                                        }}
                                                        title="Preencher só o nome do banco"
                                                        className="inline-flex h-8 items-center gap-1 whitespace-nowrap border border-ink/25 px-2 text-xs font-semibold text-ink hover:bg-ink/5"
                                                    >
                                                        <Building2 className="size-3" />
                                                        Só nome
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="shrink-0 flex items-center justify-between gap-4 border-t border-ink/20 bg-card px-5 py-3 text-xs text-muted-foreground sm:px-6">
                    <span>Total exibido: {filtrados.length} de {registros.length} instituições</span>
                    <button
                        type="button"
                        onClick={onFechar}
                        className="border border-ink/30 px-3 py-1.5 font-semibold text-ink hover:bg-ink/5"
                    >
                        Fechar
                    </button>
                </div>
        </ModalDialog>
    );
};
