import {
    useCallback,
    useEffect,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type ClipboardEvent as ReactClipboardEvent,
    type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    DIAS_SEMANA_CAMPO_DATA,
    MESES_CAMPO_DATA,
    dataPorExtensoCurta,
    dentroDoIntervalo,
    gradeDoMes,
    hojeIsoLocal,
    interpretarDataDigitada,
    isoParaBr,
    mascararDataBr,
    partesIso,
    somarDiasIso,
    somarMesesIso,
} from "@/lib/campo-data";

export interface CampoDataProps {
    id?: string;
    /** Data ISO "AAAA-MM-DD" ("" = vazio), o mesmo valor do antigo <input type="date">. */
    value: string;
    onChange: (iso: string) => void;
    min?: string;
    max?: string;
    /** Classes do campo de texto (ex.: "field py-2 text-sm"). */
    className?: string;
    /** Classes do contêiner (padrão ocupa a largura toda). */
    classNameContainer?: string;
    disabled?: boolean;
    "aria-label"?: string;
    /** Permite apagar a data pelo botão "Limpar" do calendário. */
    permitirLimpar?: boolean;
}

const LARGURA_POPOVER = 288;
const ALTURA_POPOVER = 356;
const ANO_MIN_PADRAO = 1990;

type Posicao = { top: number; left: number };

export function CampoData({
    id,
    value,
    onChange,
    min,
    max,
    className,
    classNameContainer,
    disabled,
    "aria-label": ariaLabel,
    permitirLimpar = true,
}: CampoDataProps) {
    const idGerado = useId();
    const idCampo = id ?? `campo-data-${idGerado}`;
    const idPopover = `${idCampo}-calendario`;

    const [texto, setTexto] = useState(() => isoParaBr(value));
    const [invalido, setInvalido] = useState(false);
    const [aberto, setAberto] = useState(false);
    const [posicao, setPosicao] = useState<Posicao | null>(null);
    const hoje = hojeIsoLocal();

    const editandoRef = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const focarDiaRef = useRef(false);

    // Valor mudou por fora (preenchido pelo Claude, cálculo automático, outro campo): atualiza o texto.
    useEffect(() => {
        if (!editandoRef.current) {
            setTexto(isoParaBr(value));
            setInvalido(false);
        }
    }, [value]);

    const anoMin = partesIso(min ?? "")?.ano ?? ANO_MIN_PADRAO;
    const anoMax = partesIso(max ?? "")?.ano ?? new Date().getFullYear() + 40;

    const inicial = (): string => {
        if (partesIso(value)) return value;
        if (dentroDoIntervalo(hoje, min, max)) return hoje;
        return min || max || hoje;
    };
    const [foco, setFoco] = useState<string>(inicial);
    const pFoco = partesIso(foco) ?? partesIso(hoje)!;
    const celulas = useMemo(() => gradeDoMes(pFoco.ano, pFoco.mes), [pFoco.ano, pFoco.mes]);

    const aplicar = useCallback(
        (iso: string) => {
            setInvalido(false);
            setTexto(isoParaBr(iso));
            if (iso !== value) onChange(iso);
        },
        [onChange, value],
    );

    /* ---------------- Digitação */

    const aoDigitar = (bruto: string) => {
        editandoRef.current = true;
        const limpo = bruto.trim();
        if (!limpo) {
            setTexto("");
            setInvalido(false);
            if (value) onChange("");
            return;
        }
        // Colou no formato ISO (planilha, sistema do banco): converte na hora.
        if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(limpo)) {
            const iso = interpretarDataDigitada(limpo);
            if (iso && dentroDoIntervalo(iso, min, max)) return aplicar(iso);
        }
        const mascarado = mascararDataBr(bruto);
        setTexto(mascarado);
        if (mascarado.length === 10) {
            const iso = interpretarDataDigitada(mascarado);
            const ok = Boolean(iso) && dentroDoIntervalo(iso, min, max);
            setInvalido(!ok);
            if (ok && iso !== value) onChange(iso);
        } else {
            setInvalido(false);
        }
    };

    const aoColar = (e: ReactClipboardEvent<HTMLInputElement>) => {
        const colado = e.clipboardData.getData("text");
        const iso = interpretarDataDigitada(colado);
        if (iso && dentroDoIntervalo(iso, min, max)) {
            e.preventDefault();
            aplicar(iso);
        }
    };

    const aoSairDoCampo = () => {
        editandoRef.current = false;
        if (!texto) return;
        // Aceita formas curtas na saída ("050324", "5/3/24"); senão volta para o último valor válido.
        const iso = interpretarDataDigitada(texto);
        if (iso && dentroDoIntervalo(iso, min, max)) {
            aplicar(iso);
        } else {
            setTexto(isoParaBr(value));
            setInvalido(false);
        }
    };

    /* ---------------- Calendário */

    const calcularPosicao = useCallback(() => {
        const el = containerRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const margem = 8;
        const left = Math.min(Math.max(margem, r.left), window.innerWidth - LARGURA_POPOVER - margem);
        const cabeAbaixo = r.bottom + 4 + ALTURA_POPOVER <= window.innerHeight - margem;
        const cabeAcima = r.top - 4 - ALTURA_POPOVER >= margem;
        const top = !cabeAbaixo && cabeAcima ? r.top - 4 - ALTURA_POPOVER : r.bottom + 4;
        setPosicao({ top, left: Math.max(margem, left) });
    }, []);

    const abrir = () => {
        if (disabled) return;
        setFoco(inicial());
        focarDiaRef.current = true;
        calcularPosicao();
        setAberto(true);
    };

    const fechar = useCallback((devolverFoco = true) => {
        setAberto(false);
        if (devolverFoco) inputRef.current?.focus();
    }, []);

    useLayoutEffect(() => {
        if (!aberto) return;
        const reposicionar = () => calcularPosicao();
        window.addEventListener("resize", reposicionar);
        window.addEventListener("scroll", reposicionar, true);
        const foraDoCampo = (e: MouseEvent) => {
            const alvo = e.target as Node;
            if (containerRef.current?.contains(alvo) || popoverRef.current?.contains(alvo)) return;
            fechar(false);
        };
        document.addEventListener("mousedown", foraDoCampo);
        return () => {
            window.removeEventListener("resize", reposicionar);
            window.removeEventListener("scroll", reposicionar, true);
            document.removeEventListener("mousedown", foraDoCampo);
        };
    }, [aberto, calcularPosicao, fechar]);

    // Move o foco do teclado para o dia ativo ao abrir e ao navegar pelas setas.
    useEffect(() => {
        if (!aberto || !focarDiaRef.current) return;
        focarDiaRef.current = false;
        popoverRef.current?.querySelector<HTMLButtonElement>(`button[data-iso="${foco}"]`)?.focus();
    }, [aberto, foco]);

    const escolher = (iso: string) => {
        if (!dentroDoIntervalo(iso, min, max)) return;
        aplicar(iso);
        fechar();
    };

    const irPara = (iso: string, focar = true) => {
        if (!iso) return;
        const p = partesIso(iso);
        if (!p || p.ano < anoMin || p.ano > anoMax) return;
        focarDiaRef.current = focar;
        setFoco(iso);
    };

    const tecladoNoDia = (e: ReactKeyboardEvent<HTMLButtonElement>, iso: string) => {
        const diaSemana = new Date(pFoco.ano, pFoco.mes - 1, pFoco.dia).getDay();
        const mapa: Record<string, () => string> = {
            ArrowLeft: () => somarDiasIso(iso, -1),
            ArrowRight: () => somarDiasIso(iso, 1),
            ArrowUp: () => somarDiasIso(iso, -7),
            ArrowDown: () => somarDiasIso(iso, 7),
            Home: () => somarDiasIso(iso, -diaSemana),
            End: () => somarDiasIso(iso, 6 - diaSemana),
            PageUp: () => somarMesesIso(iso, e.shiftKey ? -12 : -1),
            PageDown: () => somarMesesIso(iso, e.shiftKey ? 12 : 1),
        };
        if (e.key === "Escape") {
            e.preventDefault();
            fechar();
            return;
        }
        const destino = mapa[e.key]?.();
        if (destino) {
            e.preventDefault();
            irPara(destino);
        }
    };

    const tecladoNoCampo = (e: ReactKeyboardEvent<HTMLInputElement>) => {
        if ((e.altKey && e.key === "ArrowDown") || e.key === "F4") {
            e.preventDefault();
            abrir();
        } else if (e.key === "Escape" && aberto) {
            e.preventDefault();
            fechar();
        }
    };

    const mudarMes = (delta: number) => irPara(somarMesesIso(foco, delta), false);
    const anos = useMemo(() => {
        const lista: number[] = [];
        for (let a = anoMax; a >= anoMin; a--) lista.push(a);
        return lista;
    }, [anoMin, anoMax]);

    const mesAnteriorOk = pFoco.ano > anoMin || pFoco.mes > 1;
    const proximoMesOk = pFoco.ano < anoMax || pFoco.mes < 12;
    const hojeOk = dentroDoIntervalo(hoje, min, max);

    const botaoNav =
        "inline-flex size-8 items-center justify-center text-paper/80 transition-colors duration-150 hover:bg-paper/10 hover:text-paper disabled:pointer-events-none disabled:opacity-30";
    const selectCab =
        "cursor-pointer bg-transparent py-1 text-sm font-semibold text-paper focus:outline-none focus-visible:ring-1 focus-visible:ring-gold-light";

    const popover =
        aberto && posicao
            ? createPortal(
                  <div
                      ref={popoverRef}
                      id={idPopover}
                      role="dialog"
                      aria-modal="false"
                      aria-label="Escolher data"
                      className="fixed z-[70] border border-ink/20 bg-card shadow-lg"
                      style={{ top: posicao.top, left: posicao.left, width: LARGURA_POPOVER }}
                      onKeyDown={(e) => {
                          if (e.key === "Escape") {
                              e.preventDefault();
                              fechar();
                          }
                      }}
                  >
                      <div className="flex items-center justify-between gap-1 bg-ink px-1.5 py-1">
                          <button
                              type="button"
                              onClick={() => mudarMes(-1)}
                              disabled={!mesAnteriorOk}
                              aria-label="Mês anterior"
                              className={botaoNav}
                          >
                              <ChevronLeft aria-hidden className="size-4" />
                          </button>
                          <div className="flex items-center gap-1">
                              <select
                                  aria-label="Mês"
                                  value={pFoco.mes}
                                  onChange={(e) =>
                                      irPara(
                                          somarMesesIso(foco, Number(e.target.value) - pFoco.mes),
                                          false,
                                      )
                                  }
                                  className={selectCab}
                              >
                                  {MESES_CAMPO_DATA.map((m, i) => (
                                      <option key={m} value={i + 1} className="text-ink">
                                          {m.charAt(0).toUpperCase() + m.slice(1)}
                                      </option>
                                  ))}
                              </select>
                              <select
                                  aria-label="Ano"
                                  value={pFoco.ano}
                                  onChange={(e) =>
                                      irPara(somarMesesIso(foco, (Number(e.target.value) - pFoco.ano) * 12), false)
                                  }
                                  className={cn(selectCab, "tabular-nums")}
                              >
                                  {anos.map((a) => (
                                      <option key={a} value={a} className="text-ink">
                                          {a}
                                      </option>
                                  ))}
                              </select>
                          </div>
                          <button
                              type="button"
                              onClick={() => mudarMes(1)}
                              disabled={!proximoMesOk}
                              aria-label="Próximo mês"
                              className={botaoNav}
                          >
                              <ChevronRight aria-hidden className="size-4" />
                          </button>
                      </div>

                      <div className="px-2.5 pb-2 pt-1.5">
                          <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-muted-foreground" aria-hidden>
                              {DIAS_SEMANA_CAMPO_DATA.map((d, i) => (
                                  <span key={i} className="py-1">
                                      {d}
                                  </span>
                              ))}
                          </div>
                          <div
                              className="grid grid-cols-7"
                              role="group"
                              aria-label={`${MESES_CAMPO_DATA[pFoco.mes - 1]} de ${pFoco.ano}`}
                          >
                              {celulas.map((c) => {
                                  const selecionado = c.iso === value;
                                  const ehHoje = c.iso === hoje;
                                  const permitido = dentroDoIntervalo(c.iso, min, max);
                                  return (
                                      <button
                                          key={c.iso}
                                          type="button"
                                          data-iso={c.iso}
                                          tabIndex={c.iso === foco ? 0 : -1}
                                          disabled={!permitido}
                                          onClick={() => escolher(c.iso)}
                                          onKeyDown={(e) => tecladoNoDia(e, c.iso)}
                                          onFocus={() => c.iso !== foco && setFoco(c.iso)}
                                          aria-label={dataPorExtensoCurta(c.iso)}
                                          aria-pressed={selecionado}
                                          aria-current={ehHoje ? "date" : undefined}
                                          className={cn(
                                              "flex h-9 items-center justify-center text-xs tabular-nums transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold",
                                              selecionado
                                                  ? "bg-ink font-semibold text-paper"
                                                  : permitido
                                                    ? "hover:bg-ink/[0.06]"
                                                    : "cursor-not-allowed",
                                              !selecionado && (c.noMes ? "font-medium text-ink" : "text-muted-foreground/50"),
                                              !permitido && "text-muted-foreground/30",
                                              ehHoje &&
                                                  !selecionado &&
                                                  "font-semibold underline decoration-gold-deep decoration-2 underline-offset-4",
                                          )}
                                      >
                                          {c.dia}
                                      </button>
                                  );
                              })}
                          </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-ink/15 px-2.5 py-1.5 text-xs">
                          <span className="text-muted-foreground">
                              {value ? isoParaBr(value) : "Digite dd/mm/aaaa"}
                          </span>
                          <span className="flex items-center gap-1">
                              {permitirLimpar && value && (
                                  <button
                                      type="button"
                                      onClick={() => {
                                          aplicar("");
                                          fechar();
                                      }}
                                      className="px-2 py-1 font-semibold text-muted-foreground transition-colors hover:text-ink"
                                  >
                                      Limpar
                                  </button>
                              )}
                              {hojeOk && (
                                  <button
                                      type="button"
                                      onClick={() => escolher(hoje)}
                                      className="border border-ink/25 px-2.5 py-1 font-semibold text-ink transition-colors hover:bg-ink/5"
                                  >
                                      Hoje
                                  </button>
                              )}
                          </span>
                      </div>
                  </div>,
                  document.body,
              )
            : null;

    return (
        <div ref={containerRef} className={cn("relative", classNameContainer ?? "w-full")}>
            <input
                ref={inputRef}
                id={idCampo}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="dd/mm/aaaa"
                maxLength={10}
                value={texto}
                disabled={disabled}
                aria-label={ariaLabel}
                aria-invalid={invalido || undefined}
                aria-haspopup="dialog"
                aria-expanded={aberto}
                aria-controls={aberto ? idPopover : undefined}
                onChange={(e) => aoDigitar(e.target.value)}
                onPaste={aoColar}
                onBlur={aoSairDoCampo}
                onKeyDown={tecladoNoCampo}
                className={cn(
                    "tabular-nums",
                    className,
                    "pr-5",
                    invalido && "border-b-destructive text-destructive",
                )}
            />
            <button
                type="button"
                disabled={disabled}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => (aberto ? fechar() : abrir())}
                aria-label={aberto ? "Fechar calendário" : "Abrir calendário"}
                title="Abrir calendário (Alt+↓)"
                className={cn(
                    "absolute right-0 top-1/2 inline-flex h-7 w-6 -translate-y-1/2 items-center justify-end text-ink/50 transition-colors duration-150 hover:text-ink disabled:opacity-40",
                    aberto && "text-ink",
                )}
            >
                <CalendarDays aria-hidden className="size-3.5" />
            </button>
            {popover}
        </div>
    );
}
