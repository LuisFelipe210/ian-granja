import { useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Check, Plus, Radar, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { brl, num } from "@/lib/juros";
import {
    formatarNomeParte,
    formatarRecebidaEm,
    lerDadosProcessoDjen,
    resumirTeorPublicacao,
    type DjenMovimentacaoSalva,
    type StatusProcessoDjen,
} from "@/lib/juros/djen";
import { agregarEstatisticasCarteira, normalizarRotuloBanco } from "@/lib/juros/graficos-dados";
import {
    ROTULO_TIPO_TAREFA,
    atualizarTarefa,
    dataHojeLocalISO,
    type CalculoSalvo,
    type Categoria,
    type Tarefa,
    type TipoTarefa,
} from "@/lib/revisional-db";
import { BASE_ROTA } from "@/components/juros/ShellSistema";
import { BotaoGoogleAgenda } from "@/components/juros/AgendaSistema";

const CLASSE_TIPO_COMPACTA: Record<TipoTarefa, string> = {
    prazo: "font-semibold text-destructive",
    audiencia: "font-semibold text-gold-deep",
    reuniao: "font-semibold text-ink",
    tarefa: "font-medium text-muted-foreground",
};

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DIAS_SEMANA_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** Quantos compromissos a pauta do Início mostra antes de mandar para a Agenda. */
const LIMITE_PAUTA = 8;

function rotuloDataCurta(dataIso: string): { semana: string; data: string } {
    const [anoStr, mesStr, diaStr] = dataIso.slice(0, 10).split("-");
    const ano = Number(anoStr);
    const mesIdx = Math.max(0, Math.min(11, Number(mesStr || 1) - 1));
    const dia = Number(diaStr || 1);
    const semanaIdx = Number.isFinite(ano) ? new Date(ano, mesIdx, dia).getDay() : -1;
    return {
        semana: DIAS_SEMANA_CURTOS[semanaIdx] ?? "",
        data: `${diaStr || "--"} ${MESES_CURTOS[mesIdx] ?? ""}`,
    };
}

function formatarCabecalhoDataHoje(ref: Date = new Date()): string {
    const bruto = ref.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    });
    return bruto.charAt(0).toUpperCase() + bruto.slice(1);
}

const ROTULO_STATUS_PROCESSO: Record<StatusProcessoDjen, string> = {
    prazo_aberto: "Prazo aberto",
    em_analise: "Em análise",
    manifestado: "Manifestado",
    concluido: "Concluído",
};

const CLASSE_STATUS_PROCESSO: Record<StatusProcessoDjen, string> = {
    prazo_aberto: "text-destructive",
    em_analise: "text-gold-deep",
    manifestado: "text-[#126A35]",
    concluido: "text-muted-foreground",
};

interface PublicacaoRecenteItem {
    calculo: CalculoSalvo;
    tribunal: string;
    dataBr: string;
    dataSort: string;
    /** Quando a publicação entrou no sistema (ISO); vazio em registros antigos sem essa informação. */
    recebidaEm?: string;
    resumo: string;
    nova: boolean;
    status: StatusProcessoDjen;
}

type GrupoPauta = "atrasados" | "hoje" | "proximos";

const TITULO_GRUPO_PAUTA: Record<GrupoPauta, string> = {
    atrasados: "Atrasados",
    hoje: "Hoje",
    proximos: "Próximos",
};

interface InicioSistemaProps {
    calculos: CalculoSalvo[];
    calculosCarteira: CalculoSalvo[];
    processosSalvos: CalculoSalvo[];
    categorias: Categoria[];
    tarefas: Tarefa[];
    carregando: boolean;
    verificandoDjen: boolean;
    agendaIndisponivel: boolean;
    onNovoCalculo: () => void;
    onNovaTarefa: (dataInicial?: string) => void;
    onEditarTarefa: (tarefa: Tarefa) => void;
    onTarefaAtualizada: (tarefa: Tarefa) => void;
    onAbrirRadarDjen: () => void;
    onVerificarDjen: () => void;
    onAbrirCaso: (c: CalculoSalvo) => void;
    onAbrirProcesso: (c: CalculoSalvo) => void;
    onAbrirCasoOuProcesso: (c: CalculoSalvo) => void;
    onNavegar: (rota: string) => void;
}

/** Cabeçalho de bloco em azul-marinho: título, contador opcional e ações à direita. Sem ícone decorativo. */
const CabecalhoBloco = ({ titulo, contador, children }: { titulo: string; contador?: string; children?: ReactNode }) => (
    <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-ink px-4 py-2.5">
        <h3 className="sys-section flex items-baseline gap-2 text-paper">
            {titulo}
            {contador && <span className="text-xs font-medium tabular-nums text-paper/65">{contador}</span>}
        </h3>
        {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </div>
);

/** Botão de contorno para usar dentro do cabeçalho azul-marinho. */
const CLASSE_BOTAO_CABECALHO =
    "inline-flex h-7 items-center gap-1.5 border border-paper/30 px-2.5 text-xs font-medium text-paper transition-colors duration-150 hover:border-paper/60 hover:bg-paper/10 disabled:opacity-50";

const LinkBloco = ({
    children,
    onClick,
    noCabecalho = false,
}: {
    children: ReactNode;
    onClick: () => void;
    /** true quando o link fica no cabeçalho azul-marinho. */
    noCabecalho?: boolean;
}) => (
    <button
        type="button"
        onClick={onClick}
        className={cn(
            "inline-flex items-center gap-1 text-xs font-semibold transition-colors duration-150",
            noCabecalho ? "text-paper/80 hover:text-paper" : "text-gold-deep hover:text-ink",
        )}
    >
        {children}
        <ArrowRight aria-hidden className="size-3.5" />
    </button>
);

const InicioSkeleton = () => (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando resumo do dia">
        <div className="space-y-2 border-b border-ink/15 pb-4">
            <div className="h-6 w-72 animate-pulse bg-ink/15" />
            <div className="h-4 w-96 max-w-full animate-pulse bg-ink/10" />
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
            <div className="min-w-0 space-y-6 lg:col-span-8">
                <div className="space-y-3 border border-ink/15 bg-card p-4">
                    <div className="h-4 w-24 animate-pulse bg-ink/15" />
                    <div className="h-11 w-full animate-pulse bg-ink/10" />
                    <div className="h-11 w-full animate-pulse bg-ink/10" />
                    <div className="h-11 w-full animate-pulse bg-ink/10" />
                </div>
                <div className="space-y-3 border border-ink/15 bg-card p-4">
                    <div className="h-4 w-44 animate-pulse bg-ink/15" />
                    <div className="h-12 w-full animate-pulse bg-ink/10" />
                    <div className="h-12 w-full animate-pulse bg-ink/10" />
                </div>
            </div>
            <div className="min-w-0 lg:col-span-4">
                <div className="space-y-3 border border-ink/15 bg-card p-4">
                    <div className="h-4 w-28 animate-pulse bg-ink/15" />
                    <div className="h-8 w-full animate-pulse bg-ink/10" />
                    <div className="h-8 w-full animate-pulse bg-ink/10" />
                    <div className="h-8 w-full animate-pulse bg-ink/10" />
                    <div className="h-11 w-full animate-pulse bg-ink/10" />
                    <div className="h-11 w-full animate-pulse bg-ink/10" />
                </div>
            </div>
        </div>
    </div>
);

export const InicioSistema = ({
    calculos,
    calculosCarteira,
    processosSalvos,
    categorias,
    tarefas,
    carregando,
    verificandoDjen,
    agendaIndisponivel,
    onNovoCalculo,
    onNovaTarefa,
    onEditarTarefa,
    onTarefaAtualizada,
    onAbrirRadarDjen,
    onVerificarDjen,
    onAbrirCaso,
    onAbrirProcesso,
    onAbrirCasoOuProcesso,
    onNavegar,
}: InicioSistemaProps) => {
    const [alternandoId, setAlternandoId] = useState<string | null>(null);

    const hojeIso = useMemo(() => dataHojeLocalISO(), []);
    const cabecalhoHoje = useMemo(() => formatarCabecalhoDataHoje(), []);

    const mapaCalculos = useMemo(() => {
        const m = new Map<string, CalculoSalvo>();
        for (const c of calculos) m.set(c.id, c);
        return m;
    }, [calculos]);

    const { publicacoesNovas, prazosAbertosCount, publicacoesRecentes } = useMemo(() => {
        let novas = 0;
        let prazosAbertos = 0;
        const itens: PublicacaoRecenteItem[] = [];

        for (const proc of processosSalvos) {
            const view = lerDadosProcessoDjen(proc);
            const qtdNovasProc = view.idsNovos.length;
            novas += qtdNovasProc;
            if (view.statusProcesso === "prazo_aberto") prazosAbertos += 1;

            const setNovos = new Set(view.idsNovos);
            const movPrincipal: DjenMovimentacaoSalva | undefined =
                view.movimentacoes.find((m) => setNovos.has(m.id)) ?? view.movimentacoes[0];

            itens.push({
                calculo: proc,
                tribunal: movPrincipal?.tribunal || view.tribunal || "DJEN",
                dataBr: movPrincipal?.dataDisponibilizacaoBr || view.dataUltimaPublicacaoBr || "—",
                dataSort: movPrincipal?.dataDisponibilizacao || view.dataUltimaPublicacao || proc.updated_at,
                recebidaEm: movPrincipal?.recebidaEm,
                resumo: resumirTeorPublicacao(movPrincipal?.texto ?? ""),
                nova: qtdNovasProc > 0,
                status: view.statusProcesso,
            });
        }

        itens.sort((a, b) => {
            if (a.nova !== b.nova) return a.nova ? -1 : 1;
            return b.dataSort.localeCompare(a.dataSort);
        });

        return {
            publicacoesNovas: novas,
            prazosAbertosCount: prazosAbertos,
            publicacoesRecentes: itens.slice(0, 5),
        };
    }, [processosSalvos]);

    const { atrasadasCount, pendentesHojeCount, pendentesTotalCount, gruposPauta } = useMemo(() => {
        const pendentes = tarefas
            .filter((t) => !t.concluida)
            .sort((a, b) => a.data.localeCompare(b.data) || (a.hora ?? "99:99").localeCompare(b.hora ?? "99:99"));

        let atrasadas = 0;
        let hojePendentes = 0;
        for (const t of pendentes) {
            if (t.data < hojeIso) atrasadas += 1;
            else if (t.data === hojeIso) hojePendentes += 1;
        }

        const grupos: Array<{ id: GrupoPauta; tarefas: Tarefa[] }> = [
            { id: "atrasados", tarefas: [] },
            { id: "hoje", tarefas: [] },
            { id: "proximos", tarefas: [] },
        ];
        for (const t of pendentes.slice(0, LIMITE_PAUTA)) {
            const grupo = t.data < hojeIso ? grupos[0] : t.data === hojeIso ? grupos[1] : grupos[2];
            grupo.tarefas.push(t);
        }

        return {
            atrasadasCount: atrasadas,
            pendentesHojeCount: hojePendentes,
            pendentesTotalCount: pendentes.length,
            gruposPauta: grupos.filter((g) => g.tarefas.length > 0),
        };
    }, [tarefas, hojeIso]);

    const statsCarteira = useMemo(
        () => agregarEstatisticasCarteira(calculosCarteira, categorias),
        [calculosCarteira, categorias],
    );

    const abusoCount = statsCarteira.qtdPorNivel.abuso;

    const fasesCarteira = useMemo(
        () =>
            [...statsCarteira.porCategoria]
                .filter((c) => c.casos > 0)
                .sort((a, b) => b.casos - a.casos || b.valorTotal - a.valorTotal)
                .slice(0, 6),
        [statsCarteira.porCategoria],
    );
    const maiorFase = fasesCarteira[0]?.casos ?? 0;

    const calculosRecentes = useMemo(
        () =>
            [...calculosCarteira]
                .sort((a, b) => (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at))
                .slice(0, 5),
        [calculosCarteira],
    );

    const alternarConclusao = async (t: Tarefa) => {
        if (alternandoId === t.id) return;
        setAlternandoId(t.id);
        try {
            const atualizada = await atualizarTarefa(t.id, { concluida: !t.concluida });
            onTarefaAtualizada(atualizada);
            toast.success(atualizada.concluida ? "Compromisso concluído." : "Compromisso reaberto.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Não foi possível atualizar a tarefa.");
        } finally {
            setAlternandoId(null);
        }
    };

    if (carregando && calculos.length === 0 && tarefas.length === 0) {
        return <InicioSkeleton />;
    }

    // Resumo do dia numa frase; cada contagem leva direto à lista correspondente.
    const pendencias: Array<{ chave: string; texto: string; classe: string; rota: string }> = [];
    if (atrasadasCount > 0) {
        pendencias.push({
            chave: "atrasados",
            texto: `${atrasadasCount} ${atrasadasCount === 1 ? "compromisso atrasado" : "compromissos atrasados"}`,
            classe: "font-semibold text-destructive",
            rota: `${BASE_ROTA}/agenda`,
        });
    }
    if (pendentesHojeCount > 0) {
        pendencias.push({
            chave: "hoje",
            texto: `${pendentesHojeCount} para hoje`,
            classe: "font-semibold text-ink",
            rota: `${BASE_ROTA}/agenda`,
        });
    }
    if (publicacoesNovas > 0) {
        pendencias.push({
            chave: "novas",
            texto: `${publicacoesNovas} ${publicacoesNovas === 1 ? "intimação nova" : "intimações novas"}`,
            classe: "font-semibold text-gold-deep",
            rota: `${BASE_ROTA}/processos`,
        });
    }
    if (prazosAbertosCount > 0) {
        pendencias.push({
            chave: "prazos-djen",
            texto: `${prazosAbertosCount} ${prazosAbertosCount === 1 ? "processo com prazo aberto" : "processos com prazo aberto"}`,
            classe: "font-medium text-ink",
            rota: `${BASE_ROTA}/processos?status=prazo_aberto`,
        });
    }

    const restantesNaAgenda = Math.max(0, pendentesTotalCount - LIMITE_PAUTA);

    return (
        <div className="space-y-6">
            {/* Cabeçalho do dia: data e o que pede atenção. Criar cálculo, prazo ou Radar fica no "Novo" da barra superior. */}
            <header className="border-b border-ink/15 pb-4">
                <h2 className="text-lg font-semibold tracking-tight text-ink">{cabecalhoHoje}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                    {pendencias.length === 0
                        ? "Nada atrasado, nada para hoje e nenhuma intimação nova."
                        : pendencias.map((p, i) => (
                              <span key={p.chave}>
                                  {i > 0 && (
                                      <span aria-hidden className="px-1.5 text-ink/30">
                                          ·
                                      </span>
                                  )}
                                  <button
                                      type="button"
                                      onClick={() => onNavegar(p.rota)}
                                      className={cn(
                                          "tabular-nums underline decoration-transparent underline-offset-4 transition-colors duration-150 hover:decoration-current",
                                          p.classe,
                                      )}
                                  >
                                      {p.texto}
                                  </button>
                              </span>
                          ))}
                </p>
            </header>

            <div className="grid gap-6 lg:grid-cols-12">
                {/* Coluna de trabalho: o que fazer e o que chegou */}
                <div className="min-w-0 space-y-6 lg:col-span-8">
                    <section className="overflow-hidden border border-ink/15 bg-card" aria-label="Pauta de prazos e compromissos">
                        <CabecalhoBloco
                            titulo="Pauta"
                            contador={pendentesTotalCount > 0 ? `${pendentesTotalCount} pendentes` : undefined}
                        >
                            <button
                                type="button"
                                onClick={() => onNovaTarefa(hojeIso)}
                                className={CLASSE_BOTAO_CABECALHO}
                            >
                                <Plus aria-hidden className="size-3.5" />
                                Adicionar
                            </button>
                            <LinkBloco noCabecalho onClick={() => onNavegar(`${BASE_ROTA}/agenda`)}>
                                Agenda
                            </LinkBloco>
                        </CabecalhoBloco>

                        {agendaIndisponivel ? (
                            <div className="px-4 py-6 text-sm text-muted-foreground">
                                A agenda precisa da migração do banco (`20261118120000_revisional_tarefas.sql`).
                            </div>
                        ) : gruposPauta.length === 0 ? (
                            <div className="flex flex-col items-start gap-2.5 px-4 py-7 text-sm text-muted-foreground">
                                <p>Nenhum compromisso pendente.</p>
                                <button
                                    type="button"
                                    onClick={() => onNovaTarefa(hojeIso)}
                                    className="inline-flex h-8 items-center gap-1.5 border border-ink/25 bg-background px-3 text-xs font-semibold text-ink hover:bg-ink/5"
                                >
                                    <Plus aria-hidden className="size-3.5" />
                                    Agendar prazo ou tarefa
                                </button>
                            </div>
                        ) : (
                            <>
                                {gruposPauta.map((grupo) => (
                                    <div key={grupo.id}>
                                        <p
                                            className={cn(
                                                "border-b border-ink/10 bg-secondary/50 px-4 py-1.5 text-[11px] font-semibold",
                                                grupo.id === "atrasados" ? "text-destructive" : "text-muted-foreground",
                                            )}
                                        >
                                            {TITULO_GRUPO_PAUTA[grupo.id]}
                                        </p>
                                        <ul className="divide-y divide-ink/10">
                                            {grupo.tarefas.map((t) => {
                                                const caso = t.calculo_id ? mapaCalculos.get(t.calculo_id) ?? null : null;
                                                const atrasada = grupo.id === "atrasados";
                                                const { semana, data } = rotuloDataCurta(t.data);

                                                return (
                                                    <li
                                                        key={t.id}
                                                        className="flex items-start gap-3 px-4 py-2.5 text-sm transition-colors duration-150 hover:bg-ink/[0.02]"
                                                    >
                                                        <button
                                                            type="button"
                                                            role="checkbox"
                                                            aria-checked={false}
                                                            aria-label={`Concluir "${t.titulo}"`}
                                                            disabled={alternandoId === t.id}
                                                            onClick={() => alternarConclusao(t)}
                                                            className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center border border-ink/40 bg-card transition-colors duration-150 hover:border-ink disabled:opacity-50"
                                                        >
                                                            {alternandoId === t.id && (
                                                                <Check aria-hidden className="size-3 text-ink/50" />
                                                            )}
                                                        </button>

                                                        <div
                                                            className={cn(
                                                                "w-14 shrink-0 text-xs leading-tight tabular-nums",
                                                                atrasada ? "text-destructive" : "text-muted-foreground",
                                                            )}
                                                        >
                                                            {grupo.id === "hoje" ? (
                                                                <span className="block font-semibold">{t.hora ?? "Dia todo"}</span>
                                                            ) : (
                                                                <>
                                                                    <span className="block font-semibold">{data}</span>
                                                                    <span className="block">{t.hora ?? semana}</span>
                                                                </>
                                                            )}
                                                        </div>

                                                        <div className="min-w-0 flex-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => onEditarTarefa(t)}
                                                                className="block max-w-full text-left font-medium leading-snug text-ink hover:underline"
                                                            >
                                                                {t.titulo}
                                                            </button>
                                                            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                                                <span className={CLASSE_TIPO_COMPACTA[t.tipo]}>
                                                                    {ROTULO_TIPO_TAREFA[t.tipo]}
                                                                </span>
                                                                {caso && (
                                                                    <>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => onAbrirCasoOuProcesso(caso)}
                                                                            className="max-w-[18rem] truncate font-medium text-gold-deep hover:text-ink hover:underline"
                                                                        >
                                                                            {caso.cliente_nome}
                                                                        </button>
                                                                    </>
                                                                )}
                                                                {t.observacoes && (
                                                                    <>
                                                                        <span className="line-clamp-1 max-w-md">{t.observacoes}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <BotaoGoogleAgenda tarefa={t} casoVinculado={caso} />
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                ))}
                                {restantesNaAgenda > 0 && (
                                    <div className="border-t border-ink/10 px-4 py-2.5">
                                        <LinkBloco onClick={() => onNavegar(`${BASE_ROTA}/agenda`)}>
                                            Mais {restantesNaAgenda} na Agenda
                                        </LinkBloco>
                                    </div>
                                )}
                            </>
                        )}
                    </section>

                    <section className="overflow-hidden border border-ink/15 bg-card" aria-label="Intimações do DJEN">
                        <CabecalhoBloco
                            titulo="Intimações do DJEN"
                            contador={
                                publicacoesNovas > 0
                                    ? `${publicacoesNovas} ${publicacoesNovas === 1 ? "nova" : "novas"}`
                                    : undefined
                            }
                        >
                            <button
                                type="button"
                                onClick={onVerificarDjen}
                                disabled={verificandoDjen}
                                className={CLASSE_BOTAO_CABECALHO}
                            >
                                <RefreshCw aria-hidden className={cn("size-3.5", verificandoDjen && "animate-spin")} />
                                {verificandoDjen ? "Verificando…" : "Verificar agora"}
                            </button>
                            <LinkBloco noCabecalho onClick={() => onNavegar(`${BASE_ROTA}/processos`)}>
                                Processos
                            </LinkBloco>
                        </CabecalhoBloco>

                        {publicacoesRecentes.length === 0 ? (
                            <div className="flex flex-col items-start gap-2.5 px-4 py-7 text-sm text-muted-foreground">
                                <p>Nenhum processo monitorado no DJEN ainda.</p>
                                <button
                                    type="button"
                                    onClick={onAbrirRadarDjen}
                                    className="inline-flex h-8 items-center gap-1.5 border border-ink/25 bg-background px-3 text-xs font-semibold text-ink hover:bg-ink/5"
                                >
                                    <Radar aria-hidden className="size-3.5 text-gold-deep" />
                                    Consultar no Radar DJEN
                                </button>
                            </div>
                        ) : (
                            <ul className="divide-y divide-ink/10">
                                {publicacoesRecentes.map((pub) => (
                                    <li key={pub.calculo.id}>
                                        <button
                                            type="button"
                                            onClick={() => onAbrirProcesso(pub.calculo)}
                                            className="block w-full px-4 py-3 text-left transition-colors duration-150 hover:bg-ink/[0.025]"
                                        >
                                            <div className="flex items-baseline justify-between gap-3">
                                                <span className="flex min-w-0 items-center gap-2">
                                                    {pub.nova && (
                                                        <span
                                                            role="img"
                                                            aria-label="Intimação nova"
                                                            className="size-1.5 shrink-0 bg-gold-light"
                                                        />
                                                    )}
                                                    <span className="truncate text-sm font-medium text-ink">
                                                        {formatarNomeParte(pub.calculo.cliente_nome)}
                                                    </span>
                                                </span>
                                                <span
                                                    className="shrink-0 text-xs tabular-nums text-muted-foreground"
                                                    title="Data em que a publicação saiu no DJEN"
                                                >
                                                    publicada <span className="font-semibold text-ink">{pub.dataBr}</span>
                                                </span>
                                            </div>
                                            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs tabular-nums text-muted-foreground">
                                                <span className="font-semibold text-ink/80">{pub.tribunal}</span>
                                                {pub.calculo.processo_global && <span>{pub.calculo.processo_global}</span>}
                                                {pub.recebidaEm && (
                                                    <span title="Quando a publicação entrou no sistema">
                                                        entrou {formatarRecebidaEm(pub.recebidaEm)}
                                                    </span>
                                                )}
                                                <span className={cn("font-semibold", CLASSE_STATUS_PROCESSO[pub.status])}>
                                                    {ROTULO_STATUS_PROCESSO[pub.status]}
                                                </span>
                                            </div>
                                            <p className="mt-1.5 line-clamp-2 max-w-[75ch] text-xs leading-relaxed text-muted-foreground">
                                                {pub.resumo}
                                            </p>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>

                {/* Coluna de contexto: a carteira num bloco só */}
                <section className="min-w-0 self-start overflow-hidden border border-ink/15 bg-card lg:col-span-4" aria-label="Carteira">
                    <CabecalhoBloco titulo="Carteira">
                        <LinkBloco noCabecalho onClick={() => onNavegar(`${BASE_ROTA}/painel`)}>
                            Painel
                        </LinkBloco>
                    </CabecalhoBloco>

                    {calculosCarteira.length === 0 ? (
                        <div className="flex flex-col items-start gap-2.5 px-4 py-6 text-xs text-muted-foreground">
                            <p>Nenhum cálculo salvo na carteira ainda.</p>
                            <button
                                type="button"
                                onClick={onNovoCalculo}
                                className="inline-flex h-8 items-center gap-1.5 border border-ink/25 bg-background px-3 font-semibold text-ink hover:bg-ink/5"
                            >
                                Abrir calculadora
                            </button>
                        </div>
                    ) : (
                        <>
                            <dl className="grid grid-cols-[auto_auto_minmax(0,1fr)] divide-x divide-ink/10 border-b border-ink/15">
                                <div className="px-4 py-3">
                                    <dt className="text-[11px] font-medium text-muted-foreground">Casos</dt>
                                    <dd className="mt-0.5 text-base font-semibold tabular-nums text-ink">
                                        {calculosCarteira.length}
                                    </dd>
                                </div>
                                <div className="px-4 py-3">
                                    <dt className="text-[11px] font-medium text-muted-foreground">Abuso ≥ 1,5x</dt>
                                    <dd className="mt-0.5 text-base font-semibold tabular-nums text-destructive">
                                        {abusoCount}
                                    </dd>
                                </div>
                                <div className="min-w-0 px-4 py-3">
                                    <dt className="text-[11px] font-medium text-muted-foreground">Proveito</dt>
                                    <dd className="mt-0.5 truncate text-base font-semibold tabular-nums text-ink">
                                        {brl(statsCarteira.proveitoTotal)}
                                    </dd>
                                </div>
                            </dl>

                            <div className="border-b border-ink/15 pb-2">
                                <p className="px-4 pb-1 pt-3 text-[11px] font-semibold text-muted-foreground">Por fase</p>
                                <ul>
                                    {fasesCarteira.map((cat) => (
                                        <li key={cat.id}>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    onNavegar(`${BASE_ROTA}/historico?cat=${encodeURIComponent(cat.id)}`)
                                                }
                                                title={`${cat.nome}: ${cat.casos} ${cat.casos === 1 ? "caso" : "casos"} · ${brl(cat.valorTotal)}`}
                                                className="grid w-full grid-cols-[minmax(0,1fr)_1.75rem_4.5rem] items-center gap-3 px-4 py-1.5 text-left text-xs transition-colors duration-150 hover:bg-ink/[0.025]"
                                            >
                                                <span className="truncate font-medium text-ink">{cat.nome}</span>
                                                <span className="text-right font-semibold tabular-nums text-ink">{cat.casos}</span>
                                                <span aria-hidden className="block h-1.5 bg-ink/[0.08]">
                                                    <span
                                                        className="block h-full bg-ink/75"
                                                        style={{
                                                            width: `${maiorFase > 0 ? Math.max(6, (cat.casos / maiorFase) * 100) : 0}%`,
                                                        }}
                                                    />
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div>
                                <div className="flex items-center justify-between px-4 pb-1 pt-3">
                                    <p className="text-[11px] font-semibold text-muted-foreground">Atualizados por último</p>
                                    <LinkBloco onClick={() => onNavegar(`${BASE_ROTA}/historico`)}>Carteira</LinkBloco>
                                </div>
                                <ul className="divide-y divide-ink/10">
                                    {calculosRecentes.map((c) => {
                                        const banco = c.banco ? normalizarRotuloBanco(c.banco) : "";
                                        const ehAbuso = c.razao_am >= 1.5;
                                        const acimaMedia = c.razao_am > 1.0 && !ehAbuso;

                                        return (
                                            <li key={c.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => onAbrirCaso(c)}
                                                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-ink/[0.025]"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-medium text-ink">{c.cliente_nome}</p>
                                                        <p className="truncate text-xs text-muted-foreground">
                                                            {banco || c.modalidade_nome || "Contrato revisional"}
                                                        </p>
                                                    </div>
                                                    <div className="shrink-0 text-right tabular-nums">
                                                        <p className="text-xs font-semibold text-ink">
                                                            {c.valor_total_acao > 0 ? brl(c.valor_total_acao) : "—"}
                                                        </p>
                                                        <p
                                                            className={cn(
                                                                "text-[11px]",
                                                                ehAbuso
                                                                    ? "font-semibold text-destructive"
                                                                    : acimaMedia
                                                                      ? "font-medium text-gold-deep"
                                                                      : "text-muted-foreground",
                                                            )}
                                                        >
                                                            {num(c.razao_am, 2)}x{ehAbuso ? " · abuso" : ""}
                                                        </p>
                                                    </div>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        </>
                    )}
                </section>
            </div>
        </div>
    );
};
