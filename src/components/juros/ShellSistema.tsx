import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent as ReactKeyboardEvent,
    type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import {
    BarChart3,
    Calculator,
    CalendarDays,
    CalendarPlus,
    ChevronDown,
    Columns3,
    ChevronRight,
    ExternalLink,
    FilePlus2,
    FileText,
    FolderClock,
    Gavel,
    Home,
    LogOut,
    Menu,
    MessageCircle,
    PanelLeftClose,
    PanelLeftOpen,
    Radar,
    Search,
    Settings,
    Users,
    X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizarRotuloBanco } from "@/lib/juros/graficos-dados";
import { IS_LOCAL_SUPABASE, isCalculoPendente, type CalculoSalvo } from "@/lib/revisional-db";
import { useTravarRolagem } from "@/lib/use-travar-rolagem";
import logo from "@/assets/logo2.png";
import logoIcone from "@/assets/logo.png";

export const BASE_ROTA = "/ferramentas/calculadora-revisional";
export const ROTA_CALCULO = `${BASE_ROTA}/calculo`;

export type AbaSistema =
    | "inicio"
    | "calculadora"
    | "historico"
    | "crm"
    | "clientes"
    | "processos"
    | "agenda"
    | "atendimento"
    | "documentos"
    | "painel"
    | "configuracoes";

interface BreadcrumbShell {
    label: string;
    to: string;
}

interface ShellSistemaProps {
    abaAtiva: AbaSistema;
    tituloTela: string;
    breadcrumb?: BreadcrumbShell | null;
    calculos: CalculoSalvo[];
    calculosCarteiraCount: number;
    processosSalvosCount: number;
    temPublicacaoNova: boolean;
    agendaPendentesCount: number;
    /** Conversas do WhatsApp esperando o escritório. */
    atendimentoPendentesCount?: number;
    calculoAtivoId: string | null;
    mostrarBotaoLimparCalculo?: boolean;
    onLimparCalculo?: () => void;
    onAbrirCaso: (c: CalculoSalvo) => void;
    onAbrirProcesso: (c: CalculoSalvo) => void;
    onNovoCalculo: () => void;
    onNovaTarefa: () => void;
    onAbrirRadarDjen: () => void;
    onSair: () => void;
    children: ReactNode;
}

interface ResultadoBuscaGlobal {
    calc: CalculoSalvo;
    grupo: "carteira" | "processos";
}

type GrupoNav = "operacao" | "pericia";

const STORAGE_SIDEBAR_RECOLHIDA = "ig_revisional_sidebar_recolhida_v1";
const STORAGE_GRUPOS_NAV = "ig_revisional_grupos_nav_v1";

export const ShellSistema = ({
    abaAtiva,
    tituloTela,
    breadcrumb,
    calculos,
    calculosCarteiraCount,
    processosSalvosCount,
    temPublicacaoNova,
    agendaPendentesCount,
    atendimentoPendentesCount = 0,
    calculoAtivoId,
    mostrarBotaoLimparCalculo = false,
    onLimparCalculo,
    onAbrirCaso,
    onAbrirProcesso,
    onNovoCalculo,
    onNovaTarefa,
    onAbrirRadarDjen,
    onSair,
    children,
}: ShellSistemaProps) => {
    const location = useLocation();
    const [menuMobileAberto, setMenuMobileAberto] = useState(false);
    const [sidebarRecolhida, setSidebarRecolhida] = useState<boolean>(() => {
        try {
            return localStorage.getItem(STORAGE_SIDEBAR_RECOLHIDA) === "1";
        } catch {
            return false;
        }
    });
    const [gruposAbertos, setGruposAbertos] = useState<Record<GrupoNav, boolean>>(() => {
        try {
            const raw = localStorage.getItem(STORAGE_GRUPOS_NAV);
            if (raw) {
                const parsed = JSON.parse(raw) as Partial<Record<GrupoNav, boolean>>;
                return {
                    operacao: parsed.operacao !== false,
                    pericia: parsed.pericia !== false,
                };
            }
        } catch {
            // ignora erro de leitura de preferência
        }
        return { operacao: true, pericia: true };
    });
    const [buscaMobileAberta, setBuscaMobileAberta] = useState(false);
    const [buscaGlobal, setBuscaGlobal] = useState("");
    const [buscaFocada, setBuscaFocada] = useState(false);
    const [indiceSelecao, setIndiceSelecao] = useState(0);
    const [menuNovoAberto, setMenuNovoAberto] = useState(false);

    const buscaBoxRef = useRef<HTMLDivElement>(null);
    const buscaInputDesktopRef = useRef<HTMLInputElement>(null);
    const buscaInputMobileRef = useRef<HTMLInputElement>(null);
    const dropdownBuscaRef = useRef<HTMLDivElement>(null);
    const [posBusca, setPosBusca] = useState<{ top: number; left: number; width: number } | null>(null);

    const botaoNovoRef = useRef<HTMLButtonElement>(null);
    const menuNovoRef = useRef<HTMLDivElement>(null);
    const [posMenuNovo, setPosMenuNovo] = useState<{ top: number; right: number } | null>(null);

    const drawerRef = useRef<HTMLElement>(null);
    const sidebarDesktopRef = useRef<HTMLElement>(null);

    // A roda do mouse sobre a barra lateral rola só o menu (quando ele tem o que rolar) e nunca a
    // página atrás. Precisa de listener não passivo: o onWheel do React não deixa cancelar a rolagem.
    useEffect(() => {
        const barra = sidebarDesktopRef.current;
        if (!barra) return;
        const aoRolar = (e: WheelEvent) => {
            if (e.ctrlKey) return; // zoom do navegador/trackpad continua livre
            e.preventDefault();
            const menu = barra.querySelector<HTMLElement>("nav");
            if (!menu || menu.scrollHeight <= menu.clientHeight) return;
            const fator = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? menu.clientHeight : 1;
            menu.scrollTop += e.deltaY * fator;
        };
        barra.addEventListener("wheel", aoRolar, { passive: false });
        return () => barra.removeEventListener("wheel", aoRolar);
    }, []);
    const hamburgerRef = useRef<HTMLButtonElement>(null);

    const resultadosBusca = useMemo(() => {
        const termo = buscaGlobal.trim().toLowerCase();
        if (!termo) return [] as ResultadoBuscaGlobal[];

        const filtrados: ResultadoBuscaGlobal[] = [];
        for (const c of calculos) {
            const bancoNorm = c.banco ? normalizarRotuloBanco(c.banco) : "";
            const texto = [
                c.cliente_nome,
                c.processo_global,
                c.banco,
                bancoNorm,
                c.documento_contrato,
            ]
                .join(" ")
                .toLowerCase();
            if (texto.includes(termo)) {
                filtrados.push({
                    calc: c,
                    grupo: isCalculoPendente(c) ? "processos" : "carteira",
                });
            }
            if (filtrados.length >= 8) break;
        }
        return filtrados;
    }, [buscaGlobal, calculos]);

    const gruposBusca = useMemo(() => {
        const carteira = resultadosBusca.filter((r) => r.grupo === "carteira");
        const processos = resultadosBusca.filter((r) => r.grupo === "processos");
        return { carteira, processos, ordenado: [...carteira, ...processos] };
    }, [resultadosBusca]);

    const mostrarDropdownBusca = buscaFocada && buscaGlobal.trim().length > 0;

    const atualizarPosBusca = useCallback(() => {
        const alvo = buscaMobileAberta ? buscaInputMobileRef.current : buscaBoxRef.current;
        if (!alvo) return;
        const rect = alvo.getBoundingClientRect();
        setPosBusca({
            top: rect.bottom + 4,
            left: Math.max(8, rect.left),
            width: Math.min(rect.width, window.innerWidth - 16),
        });
    }, [buscaMobileAberta]);

    const atualizarPosMenuNovo = useCallback(() => {
        const btn = botaoNovoRef.current;
        if (!btn) return;
        const rect = btn.getBoundingClientRect();
        setPosMenuNovo({
            top: rect.bottom + 4,
            right: Math.max(8, window.innerWidth - rect.right),
        });
    }, []);

    useEffect(() => {
        setMenuMobileAberto(false);
        setMenuNovoAberto(false);
        setBuscaFocada(false);
        setBuscaMobileAberta(false);
    }, [location.pathname, location.search]);

    // Classes no <html> enquanto o sistema está aberto (ver index.css):
    // `sys-app` trava o quique elástico da rolagem; `sys-arredondado` aplica os cantos de 5px do sistema.
    useEffect(() => {
        const raiz = document.documentElement;
        raiz.classList.add("sys-app", "sys-arredondado");
        return () => raiz.classList.remove("sys-app", "sys-arredondado");
    }, []);

    useEffect(() => {
        setIndiceSelecao(0);
    }, [buscaGlobal]);

    useEffect(() => {
        if (!mostrarDropdownBusca) return;
        atualizarPosBusca();
        const onMove = () => atualizarPosBusca();
        window.addEventListener("resize", onMove);
        window.addEventListener("scroll", onMove, true);
        return () => {
            window.removeEventListener("resize", onMove);
            window.removeEventListener("scroll", onMove, true);
        };
    }, [mostrarDropdownBusca, atualizarPosBusca]);

    useEffect(() => {
        if (!menuNovoAberto) return;
        atualizarPosMenuNovo();
        const onMove = () => atualizarPosMenuNovo();
        window.addEventListener("resize", onMove);
        window.addEventListener("scroll", onMove, true);
        return () => {
            window.removeEventListener("resize", onMove);
            window.removeEventListener("scroll", onMove, true);
        };
    }, [menuNovoAberto, atualizarPosMenuNovo]);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            const emCampoTexto =
                target &&
                (target.tagName === "INPUT" ||
                    target.tagName === "TEXTAREA" ||
                    target.tagName === "SELECT" ||
                    target.isContentEditable);

            if (
                !emCampoTexto &&
                !e.defaultPrevented &&
                (e.key === "b" || e.key === "B") &&
                (e.metaKey || e.ctrlKey) &&
                !e.shiftKey &&
                !e.altKey
            ) {
                e.preventDefault();
                setSidebarRecolhida((v) => !v);
                return;
            }

            if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                if (window.matchMedia("(min-width: 768px)").matches) {
                    buscaInputDesktopRef.current?.focus();
                    buscaInputDesktopRef.current?.select();
                } else {
                    setBuscaMobileAberta(true);
                    requestAnimationFrame(() => buscaInputMobileRef.current?.focus());
                }
                return;
            }

            if (e.key === "/" && !emCampoTexto && !e.metaKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                if (window.matchMedia("(min-width: 768px)").matches) {
                    buscaInputDesktopRef.current?.focus();
                } else {
                    setBuscaMobileAberta(true);
                    requestAnimationFrame(() => buscaInputMobileRef.current?.focus());
                }
                return;
            }

            if (e.key === "Escape") {
                if (menuNovoAberto) setMenuNovoAberto(false);
                if (buscaFocada) {
                    setBuscaFocada(false);
                    buscaInputDesktopRef.current?.blur();
                    buscaInputMobileRef.current?.blur();
                }
                if (menuMobileAberto) {
                    setMenuMobileAberto(false);
                    hamburgerRef.current?.focus();
                }
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [menuNovoAberto, buscaFocada, menuMobileAberto]);

    useEffect(() => {
        const onMouseDown = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                menuNovoAberto &&
                menuNovoRef.current &&
                !menuNovoRef.current.contains(target) &&
                botaoNovoRef.current &&
                !botaoNovoRef.current.contains(target)
            ) {
                setMenuNovoAberto(false);
            }
            if (
                mostrarDropdownBusca &&
                dropdownBuscaRef.current &&
                !dropdownBuscaRef.current.contains(target) &&
                (!buscaBoxRef.current || !buscaBoxRef.current.contains(target)) &&
                (!buscaInputMobileRef.current || !buscaInputMobileRef.current.contains(target))
            ) {
                setBuscaFocada(false);
            }
        };
        document.addEventListener("mousedown", onMouseDown);
        return () => document.removeEventListener("mousedown", onMouseDown);
    }, [menuNovoAberto, mostrarDropdownBusca]);

    useTravarRolagem(menuMobileAberto);

    // Foco preso na gaveta mobile
    useEffect(() => {
        if (!menuMobileAberto) return;
        const drawer = drawerRef.current;
        if (!drawer) return;
        const focaveis = drawer.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        const primeiro = focaveis[0];
        const ultimo = focaveis[focaveis.length - 1];
        primeiro?.focus();

        const onTrap = (e: KeyboardEvent) => {
            if (e.key !== "Tab" || focaveis.length === 0) return;
            if (e.shiftKey && document.activeElement === primeiro) {
                e.preventDefault();
                ultimo?.focus();
            } else if (!e.shiftKey && document.activeElement === ultimo) {
                e.preventDefault();
                primeiro?.focus();
            }
        };
        drawer.addEventListener("keydown", onTrap);
        return () => drawer.removeEventListener("keydown", onTrap);
    }, [menuMobileAberto]);

    const selecionarResultado = (item: ResultadoBuscaGlobal) => {
        setBuscaFocada(false);
        setBuscaGlobal("");
        setBuscaMobileAberta(false);
        if (item.grupo === "processos") {
            onAbrirProcesso(item.calc);
        } else {
            onAbrirCaso(item.calc);
        }
    };

    const handleBuscaKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
        const lista = gruposBusca.ordenado;
        if (!lista.length) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setIndiceSelecao((prev) => (prev + 1) % lista.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setIndiceSelecao((prev) => (prev - 1 + lista.length) % lista.length);
        } else if (e.key === "Enter") {
            e.preventDefault();
            const escolhido = lista[indiceSelecao] ?? lista[0];
            if (escolhido) selecionarResultado(escolhido);
        }
    };

    const rotaCalculadora = calculoAtivoId
        ? `${BASE_ROTA}/caso/${encodeURIComponent(calculoAtivoId)}`
        : ROTA_CALCULO;

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_SIDEBAR_RECOLHIDA, sidebarRecolhida ? "1" : "0");
        } catch {
            // ignora erro de storage
        }
    }, [sidebarRecolhida]);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_GRUPOS_NAV, JSON.stringify(gruposAbertos));
        } catch {
            // ignora erro de storage
        }
    }, [gruposAbertos]);

    const alternarGrupo = (grupo: GrupoNav) => {
        setGruposAbertos((prev) => ({ ...prev, [grupo]: !prev[grupo] }));
    };

    const gruposNavegacao: Array<{
        id: GrupoNav;
        titulo: string;
        itens: Array<{
            id: AbaSistema | "radar" | "mcp";
            rotulo: string;
            to?: string;
            onClickExtra?: () => void;
            Icone: typeof Home;
            badge: number | null;
            alerta?: boolean;
            destaqueDourado?: boolean;
        }>;
    }> = [
        {
            id: "operacao",
            titulo: "Operação e prazos",
            itens: [
                {
                    id: "inicio",
                    rotulo: "Início",
                    to: BASE_ROTA,
                    Icone: Home,
                    badge: null,
                },
                {
                    id: "crm",
                    rotulo: "CRM",
                    to: `${BASE_ROTA}/crm`,
                    Icone: Columns3,
                    badge: null,
                },
                {
                    id: "clientes",
                    rotulo: "Clientes",
                    to: `${BASE_ROTA}/clientes`,
                    Icone: Users,
                    badge: null,
                },
                {
                    id: "agenda",
                    rotulo: "Agenda",
                    to: `${BASE_ROTA}/agenda`,
                    Icone: CalendarDays,
                    badge: agendaPendentesCount > 0 ? agendaPendentesCount : null,
                },
                {
                    id: "atendimento",
                    rotulo: "Atendimento",
                    to: `${BASE_ROTA}/atendimento`,
                    Icone: MessageCircle,
                    badge: atendimentoPendentesCount > 0 ? atendimentoPendentesCount : null,
                },
                {
                    id: "documentos",
                    rotulo: "Documentos",
                    to: `${BASE_ROTA}/documentos`,
                    Icone: FileText,
                    badge: null,
                },
                {
                    id: "processos",
                    rotulo: "Processos DJEN",
                    to: `${BASE_ROTA}/processos`,
                    Icone: Gavel,
                    badge: processosSalvosCount,
                    alerta: temPublicacaoNova,
                },
                {
                    id: "radar",
                    rotulo: "Radar DJEN",
                    onClickExtra: onAbrirRadarDjen,
                    Icone: Radar,
                    badge: null,
                    destaqueDourado: true,
                },
            ],
        },
        {
            id: "pericia",
            titulo: "Perícia e carteira",
            itens: [
                {
                    id: "calculadora",
                    rotulo: "Calculadora",
                    to: rotaCalculadora,
                    Icone: Calculator,
                    badge: null,
                },
                {
                    id: "historico",
                    rotulo: "Carteira",
                    to: `${BASE_ROTA}/historico`,
                    Icone: FolderClock,
                    badge: calculosCarteiraCount,
                },
                {
                    id: "painel",
                    rotulo: "Painel Analítico",
                    to: `${BASE_ROTA}/painel`,
                    Icone: BarChart3,
                    badge: null,
                },
            ],
        },
    ];


    const renderConteudoSidebar = (emGaveta = false) => {
        const modoRecolhido = sidebarRecolhida && !emGaveta;

        return (
            <div className="flex h-full flex-col bg-ink text-paper">
                <div
                    className={cn(
                        "border-b border-paper/10",
                        modoRecolhido ? "px-2 py-3.5" : "px-4 py-4",
                    )}
                >
                    {modoRecolhido ? (
                        <div className="flex flex-col items-center gap-2.5">
                            <Link
                                to={BASE_ROTA}
                                title="Ian Granja Advogados — Início"
                                aria-label="Início do sistema"
                                className="inline-flex size-11 items-center justify-center transition-opacity duration-150 hover:opacity-85"
                            >
                                <img
                                    src={logoIcone}
                                    alt=""
                                    width={528}
                                    height={528}
                                    className="size-11"
                                />
                            </Link>
                            <button
                                type="button"
                                onClick={() => setSidebarRecolhida(false)}
                                title="Expandir menu lateral (Ctrl+B)"
                                aria-label="Expandir menu lateral"
                                aria-expanded={false}
                                className="inline-flex size-9 items-center justify-center text-paper/70 transition-colors duration-150 hover:bg-paper/[0.08] hover:text-paper"
                            >
                                <PanelLeftOpen aria-hidden className="size-5" strokeWidth={1.85} />
                            </button>
                            {IS_LOCAL_SUPABASE && (
                                <span
                                    title="Conectado ao banco PostgreSQL local (isolado de produção)"
                                    className="bg-gold-light/15 px-1.5 py-0.5 text-[10px] font-semibold text-gold-light"
                                >
                                    DEV
                                </span>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between gap-2">
                                <Link
                                    to={BASE_ROTA}
                                    onClick={() => emGaveta && setMenuMobileAberto(false)}
                                    aria-label="Início do sistema"
                                    className="inline-flex min-w-0 items-center"
                                >
                                    <img
                                        src={logo}
                                        alt="Ian Granja Advogados"
                                        width={768}
                                        height={132}
                                        className="h-7 w-auto"
                                    />
                                </Link>
                                {emGaveta ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMenuMobileAberto(false);
                                            hamburgerRef.current?.focus();
                                        }}
                                        aria-label="Fechar menu"
                                        className="inline-flex size-9 shrink-0 items-center justify-center text-paper/70 transition-colors duration-150 hover:bg-paper/[0.08] hover:text-paper"
                                    >
                                        <X className="size-5" strokeWidth={1.85} />
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setSidebarRecolhida(true)}
                                        title="Recolher menu lateral (Ctrl+B)"
                                        aria-label="Recolher menu lateral"
                                        aria-expanded={true}
                                        className="inline-flex size-8 shrink-0 items-center justify-center text-paper/70 transition-colors duration-150 hover:bg-paper/[0.08] hover:text-paper"
                                    >
                                        <PanelLeftClose aria-hidden className="size-4" strokeWidth={1.85} />
                                    </button>
                                )}
                            </div>
                            {IS_LOCAL_SUPABASE && (
                                <span
                                    title="Conectado ao banco PostgreSQL local via OrbStack/Docker (isolado de produção)"
                                    className="mt-2.5 inline-flex items-center bg-gold-light/15 px-2 py-0.5 text-[11px] font-medium text-gold-light"
                                >
                                    Banco local · teste
                                </span>
                            )}
                        </>
                    )}
                </div>

                <nav aria-label="Menu do sistema" className="flex-1 overflow-y-auto overscroll-contain py-3">
                    <div className="space-y-4">
                        {gruposNavegacao.map((grupo, idxGrupo) => {
                            const grupoAberto = modoRecolhido ? true : gruposAbertos[grupo.id];
                            const contemAbaAtiva = grupo.itens.some((i) => i.id === abaAtiva);

                            return (
                                <div
                                    key={grupo.id}
                                    className={cn(
                                        idxGrupo > 0 && "border-t border-paper/10 pt-3",
                                    )}
                                >
                                    {!modoRecolhido && (
                                        <button
                                            type="button"
                                            onClick={() => alternarGrupo(grupo.id)}
                                            aria-expanded={grupoAberto}
                                            className="flex w-full items-center justify-between px-4 py-1.5 text-left text-[11px] font-semibold tracking-wide text-paper/55 transition-colors duration-150 hover:text-paper/90"
                                        >
                                            <span className="flex items-center gap-2">
                                                <span>{grupo.titulo}</span>
                                                {!grupoAberto && contemAbaAtiva && (
                                                    <span
                                                        aria-label="Seção contém a tela atual"
                                                        className="inline-block size-1.5 bg-gold-light"
                                                    />
                                                )}
                                            </span>
                                            {grupoAberto ? (
                                                <ChevronDown aria-hidden className="size-4 text-paper/50" />
                                            ) : (
                                                <ChevronRight aria-hidden className="size-4 text-paper/50" />
                                            )}
                                        </button>
                                    )}

                                    {grupoAberto && (
                                        <ul className={cn("space-y-0.5", !modoRecolhido && "mt-1")}>
                                            {grupo.itens.map((item) => {
                                                const ativo = item.id !== "radar" && abaAtiva === item.id;
                                                const Icone = item.Icone;
                                                const tituloTooltip =
                                                    item.badge !== null
                                                        ? `${item.rotulo} (${item.badge})`
                                                        : item.rotulo;

                                                if (!item.to && item.onClickExtra) {
                                                    return (
                                                        <li key={item.id}>
                                                            <button
                                                                type="button"
                                                                title={modoRecolhido ? tituloTooltip : undefined}
                                                                aria-label={modoRecolhido ? item.rotulo : undefined}
                                                                onClick={() => {
                                                                    if (emGaveta) setMenuMobileAberto(false);
                                                                    item.onClickExtra?.();
                                                                }}
                                                                className={cn(
                                                                    "relative flex min-h-[42px] w-full items-center border-l-[3px] border-transparent text-left text-[13.5px] font-medium text-paper/75 transition-colors duration-150 hover:bg-paper/[0.06] hover:text-paper",
                                                                    modoRecolhido
                                                                        ? "justify-center px-0"
                                                                        : "justify-between gap-3 px-4 py-2.5",
                                                                )}
                                                            >
                                                                <span className="flex min-w-0 items-center gap-3">
                                                                    <Icone
                                                                        aria-hidden
                                                                        strokeWidth={1.85}
                                                                        className={cn(
                                                                            "size-5 shrink-0",
                                                                            item.destaqueDourado && "text-gold-light",
                                                                        )}
                                                                    />
                                                                    {!modoRecolhido && (
                                                                        <span className="truncate">{item.rotulo}</span>
                                                                    )}
                                                                </span>
                                                            </button>
                                                        </li>
                                                    );
                                                }

                                                return (
                                                    <li key={item.id}>
                                                        <Link
                                                            to={item.to ?? BASE_ROTA}
                                                            title={modoRecolhido ? tituloTooltip : undefined}
                                                            aria-label={modoRecolhido ? tituloTooltip : undefined}
                                                            onClick={() => emGaveta && setMenuMobileAberto(false)}
                                                            className={cn(
                                                                "relative flex min-h-[42px] items-center border-l-[3px] text-[13.5px] font-medium transition-colors duration-150",
                                                                modoRecolhido
                                                                    ? "justify-center px-0"
                                                                    : "justify-between gap-3 px-4 py-2.5",
                                                                ativo
                                                                    ? "border-gold-light bg-ink-soft text-paper"
                                                                    : "border-transparent text-paper/75 hover:bg-paper/[0.06] hover:text-paper",
                                                            )}
                                                        >
                                                            <span className="flex min-w-0 items-center gap-3">
                                                                <Icone
                                                                    aria-hidden
                                                                    strokeWidth={1.85}
                                                                    className={cn(
                                                                        "size-5 shrink-0",
                                                                        ativo && "text-gold-light",
                                                                    )}
                                                                />
                                                                {!modoRecolhido && (
                                                                    <span className="truncate">{item.rotulo}</span>
                                                                )}
                                                            </span>

                                                            {modoRecolhido && item.alerta && (
                                                                <span
                                                                    aria-label="Há publicações novas"
                                                                    className="absolute right-2.5 top-2 size-2 bg-gold-light"
                                                                />
                                                            )}

                                                            {!modoRecolhido &&
                                                                (item.badge !== null || item.alerta) && (
                                                                    <span className="flex shrink-0 items-center gap-1.5 tabular-nums text-[11px]">
                                                                        {item.alerta && (
                                                                            <span
                                                                                aria-label="Há publicações novas"
                                                                                className="inline-block size-2 bg-gold-light"
                                                                            />
                                                                        )}
                                                                        {item.badge !== null && (
                                                                            <span className="min-w-[22px] border border-paper/15 bg-paper/[0.06] px-1.5 py-0.5 text-center font-medium text-paper/80">
                                                                                {item.badge}
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                )}
                                                        </Link>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </nav>

                <div
                    className={cn(
                        "border-t border-paper/10 text-xs",
                        modoRecolhido ? "px-2 py-3" : "px-4 py-3.5",
                    )}
                >
                    {modoRecolhido ? (
                        <div className="flex flex-col items-center gap-1.5">
                            <Link
                                to={`${BASE_ROTA}/configuracoes`}
                                title="Configurações"
                                aria-label="Configurações"
                                aria-current={abaAtiva === "configuracoes" ? "page" : undefined}
                                className={cn(
                                    "inline-flex size-9 items-center justify-center transition-colors",
                                    abaAtiva === "configuracoes"
                                        ? "bg-ink-soft text-gold-light"
                                        : "text-paper/70 hover:bg-ink-soft hover:text-paper",
                                )}
                            >
                                <Settings aria-hidden className="size-[18px]" strokeWidth={1.85} />
                            </Link>
                            <button
                                type="button"
                                onClick={onSair}
                                title="Sair da conta"
                                aria-label="Sair"
                                className="inline-flex size-9 items-center justify-center text-paper/70 hover:bg-ink-soft hover:text-paper"
                            >
                                <LogOut aria-hidden className="size-4" strokeWidth={1.85} />
                            </button>
                            <a
                                href="/"
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Abrir o site em outra aba"
                                aria-label="Abrir o site em outra aba"
                                className="inline-flex size-9 items-center justify-center text-paper/70 hover:bg-ink-soft hover:text-paper"
                            >
                                <ExternalLink aria-hidden className="size-4" strokeWidth={1.85} />
                            </a>
                        </div>
                    ) : (
                        <div className="flex items-center gap-x-3.5 gap-y-1.5 text-paper/70">
                            <Link
                                to={`${BASE_ROTA}/configuracoes`}
                                onClick={() => {
                                    if (emGaveta) setMenuMobileAberto(false);
                                }}
                                aria-current={abaAtiva === "configuracoes" ? "page" : undefined}
                                className={cn(
                                    "inline-flex items-center gap-1.5 transition-colors hover:text-paper",
                                    abaAtiva === "configuracoes" && "font-semibold text-gold-light",
                                )}
                            >
                                <Settings aria-hidden className="size-4" strokeWidth={1.85} />
                                Configurações
                            </Link>
                            <button
                                type="button"
                                onClick={() => {
                                    if (emGaveta) setMenuMobileAberto(false);
                                    onSair();
                                }}
                                className="inline-flex items-center gap-1.5 transition-colors hover:text-paper"
                            >
                                <LogOut aria-hidden className="size-4" strokeWidth={1.85} />
                                Sair
                            </button>
                            <a
                                href="/"
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Abrir o site em outra aba"
                                className="ml-auto inline-flex items-center gap-1 transition-colors hover:text-paper"
                            >
                                Site
                                <ExternalLink aria-hidden className="size-3.5" strokeWidth={1.85} />
                            </a>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="flex min-h-screen bg-background text-foreground">
            {/* Menu lateral retrátil (desktop >= 1024px).
                Fixo na tela (não sticky): assim o "quique" elástico da rolagem não arrasta o menu.
                O espaçador mantém a largura no fluxo e anima junto ao recolher/expandir. */}
            <div
                aria-hidden
                className={cn(
                    "hidden lg:block lg:shrink-0 lg:transition-[width] lg:duration-200 lg:ease-out",
                    sidebarRecolhida ? "lg:w-[68px]" : "lg:w-[264px]",
                )}
            />
            <aside
                ref={sidebarDesktopRef}
                aria-label="Navegação principal"
                className={cn(
                    "hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:flex-col lg:border-r lg:border-paper/10 lg:bg-ink lg:transition-[width] lg:duration-200 lg:ease-out",
                    sidebarRecolhida ? "lg:w-[68px]" : "lg:w-[264px]",
                )}
            >
                {renderConteudoSidebar(false)}
            </aside>

            {/* Gaveta mobile (< 1024px) */}
            {menuMobileAberto &&
                createPortal(
                    <div className="fixed inset-0 z-50 flex lg:hidden">
                        <div
                            aria-hidden
                            onClick={() => {
                                setMenuMobileAberto(false);
                                hamburgerRef.current?.focus();
                            }}
                            className="fixed inset-0 bg-ink-deep/65 transition-opacity duration-200"
                        />
                        <aside
                            ref={drawerRef}
                            aria-label="Navegação principal"
                            className="relative z-10 h-full w-[256px] max-w-[85vw] border-r border-paper/15 shadow-2xl"
                        >
                            {renderConteudoSidebar(true)}
                        </aside>
                    </div>,
                    document.body,
                )}

            {/* Coluna principal: barra superior + conteúdo */}
            <div className="flex min-w-0 flex-1 flex-col">
                <header className="sticky top-0 z-30 border-b border-ink/15 bg-card">
                    <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
                        {/* Esquerda: hamburger + título/breadcrumb */}
                        <div className="flex min-w-0 items-center gap-2.5">
                            <button
                                ref={hamburgerRef}
                                type="button"
                                onClick={() => setMenuMobileAberto(true)}
                                aria-label="Abrir menu"
                                aria-expanded={menuMobileAberto}
                                className="inline-flex size-9 shrink-0 items-center justify-center border border-ink/20 text-ink hover:bg-ink/5 lg:hidden"
                            >
                                <Menu className="size-4" />
                            </button>

                            {breadcrumb ? (
                                <nav aria-label="Localização" className="flex min-w-0 items-center gap-1.5">
                                    <Link
                                        to={breadcrumb.to}
                                        className="hidden shrink-0 text-sm font-medium text-muted-foreground hover:text-ink hover:underline sm:inline"
                                    >
                                        {breadcrumb.label}
                                    </Link>
                                    <span aria-hidden className="hidden text-muted-foreground sm:inline">
                                        ›
                                    </span>
                                    <h1 className="sys-title truncate text-ink">{tituloTela}</h1>
                                </nav>
                            ) : (
                                <h1 className="sys-title truncate text-ink">{tituloTela}</h1>
                            )}

                            {mostrarBotaoLimparCalculo && onLimparCalculo && (
                                <button
                                    type="button"
                                    onClick={onLimparCalculo}
                                    className="hidden h-7 shrink-0 items-center gap-1 border border-ink/20 bg-background px-2 text-xs font-medium text-ink transition-colors duration-150 hover:bg-ink/5 sm:inline-flex"
                                >
                                    <FilePlus2 aria-hidden className="size-3.5" />
                                    Limpar ficha
                                </button>
                            )}
                        </div>

                        {/* Centro: busca global (desktop/tablet) */}
                        <div
                            ref={buscaBoxRef}
                            className="relative hidden max-w-md flex-1 md:block"
                        >
                            <Search
                                aria-hidden
                                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                            />
                            <input
                                ref={buscaInputDesktopRef}
                                type="search"
                                value={buscaGlobal}
                                onFocus={() => setBuscaFocada(true)}
                                onChange={(e) => {
                                    setBuscaGlobal(e.target.value);
                                    setBuscaFocada(true);
                                }}
                                onKeyDown={handleBuscaKeyDown}
                                placeholder="Buscar cliente, CNJ, banco ou contrato…"
                                aria-label="Busca global"
                                className="h-9 w-full border border-ink/20 bg-background pl-8 pr-14 text-sm text-ink placeholder:text-muted-foreground focus:border-ink focus:outline-none [&::-webkit-search-cancel-button]:hidden"
                            />
                            {buscaGlobal ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setBuscaGlobal("");
                                        buscaInputDesktopRef.current?.focus();
                                    }}
                                    aria-label="Limpar busca"
                                    className="absolute right-2 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-ink"
                                >
                                    <X className="size-3.5" />
                                </button>
                            ) : (
                                <span
                                    aria-hidden
                                    className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 border border-ink/15 bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                                >
                                    /
                                </span>
                            )}
                        </div>

                        {/* Direita: lupa mobile + botão primário dourado "Novo" */}
                        <div className="flex shrink-0 items-center gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setBuscaMobileAberta((v) => !v);
                                    requestAnimationFrame(() => buscaInputMobileRef.current?.focus());
                                }}
                                aria-label="Buscar"
                                aria-expanded={buscaMobileAberta}
                                className="inline-flex size-9 items-center justify-center border border-ink/20 text-ink hover:bg-ink/5 md:hidden"
                            >
                                <Search className="size-4" />
                            </button>

                            <button
                                ref={botaoNovoRef}
                                type="button"
                                onClick={() => setMenuNovoAberto((v) => !v)}
                                aria-haspopup="menu"
                                aria-expanded={menuNovoAberto}
                                className="inline-flex h-9 items-center gap-1.5 bg-gold px-3.5 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-gold-light"
                            >
                                <span>Novo</span>
                                <ChevronDown aria-hidden className="size-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Barra de busca expansível no mobile */}
                    {buscaMobileAberta && (
                        <div className="border-t border-ink/15 bg-background px-4 py-2 md:hidden">
                            <div className="relative">
                                <Search
                                    aria-hidden
                                    className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                                />
                                <input
                                    ref={buscaInputMobileRef}
                                    type="search"
                                    value={buscaGlobal}
                                    onFocus={() => setBuscaFocada(true)}
                                    onChange={(e) => {
                                        setBuscaGlobal(e.target.value);
                                        setBuscaFocada(true);
                                    }}
                                    onKeyDown={handleBuscaKeyDown}
                                    placeholder="Cliente, CNJ, banco ou contrato…"
                                    aria-label="Busca global"
                                    className="h-9 w-full border border-ink/20 bg-card pl-8 pr-8 text-sm text-ink placeholder:text-muted-foreground focus:border-ink focus:outline-none [&::-webkit-search-cancel-button]:hidden"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        setBuscaGlobal("");
                                        setBuscaMobileAberta(false);
                                    }}
                                    aria-label="Fechar busca"
                                    className="absolute right-1.5 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-ink"
                                >
                                    <X className="size-3.5" />
                                </button>
                            </div>
                        </div>
                    )}
                </header>

                {/* Dropdown da busca global via Portal */}
                {mostrarDropdownBusca &&
                    posBusca &&
                    createPortal(
                        <div
                            ref={dropdownBuscaRef}
                            role="listbox"
                            aria-label="Resultados da busca"
                            style={{
                                position: "fixed",
                                top: posBusca.top,
                                left: posBusca.left,
                                width: posBusca.width,
                            }}
                            className="z-50 max-h-[70vh] overflow-y-auto border border-ink/25 bg-card shadow-xl"
                        >
                            {gruposBusca.ordenado.length === 0 ? (
                                <p className="px-4 py-3 text-xs text-muted-foreground">
                                    Nenhum caso ou processo encontrado para &ldquo;{buscaGlobal.trim()}&rdquo;.
                                </p>
                            ) : (
                                <div className="divide-y divide-ink/10">
                                    {gruposBusca.carteira.length > 0 && (
                                        <div>
                                            <div className="bg-secondary/70 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
                                                Carteira
                                            </div>
                                            <ul>
                                                {gruposBusca.carteira.map((item) => {
                                                    const idxGlobal = gruposBusca.ordenado.indexOf(item);
                                                    const ativo = idxGlobal === indiceSelecao;
                                                    return (
                                                        <li key={item.calc.id}>
                                                            <button
                                                                type="button"
                                                                role="option"
                                                                aria-selected={ativo}
                                                                onClick={() => selecionarResultado(item)}
                                                                className={cn(
                                                                    "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition-colors",
                                                                    ativo ? "bg-ink/5" : "hover:bg-ink/[0.03]",
                                                                )}
                                                            >
                                                                <div className="min-w-0">
                                                                    <p className="truncate font-semibold text-ink">
                                                                        {item.calc.cliente_nome}
                                                                    </p>
                                                                    <p className="truncate text-muted-foreground">
                                                                        {[
                                                                            item.calc.banco
                                                                                ? normalizarRotuloBanco(item.calc.banco)
                                                                                : "",
                                                                            item.calc.processo_global,
                                                                        ]
                                                                            .filter(Boolean)
                                                                            .join(" · ") || "Sem processo vinculado"}
                                                                    </p>
                                                                </div>
                                                                <span className="shrink-0 tabular-nums text-[11px] font-medium text-muted-foreground">
                                                                    Caso
                                                                </span>
                                                            </button>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>
                                    )}

                                    {gruposBusca.processos.length > 0 && (
                                        <div>
                                            <div className="bg-secondary/70 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
                                                Processos
                                            </div>
                                            <ul>
                                                {gruposBusca.processos.map((item) => {
                                                    const idxGlobal = gruposBusca.ordenado.indexOf(item);
                                                    const ativo = idxGlobal === indiceSelecao;
                                                    return (
                                                        <li key={item.calc.id}>
                                                            <button
                                                                type="button"
                                                                role="option"
                                                                aria-selected={ativo}
                                                                onClick={() => selecionarResultado(item)}
                                                                className={cn(
                                                                    "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition-colors",
                                                                    ativo ? "bg-ink/5" : "hover:bg-ink/[0.03]",
                                                                )}
                                                            >
                                                                <div className="min-w-0">
                                                                    <p className="truncate font-semibold text-ink">
                                                                        {item.calc.cliente_nome}
                                                                    </p>
                                                                    <p className="truncate text-muted-foreground">
                                                                        {[item.calc.processo_global, item.calc.banco]
                                                                            .filter(Boolean)
                                                                            .join(" · ") || "Processo DJEN"}
                                                                    </p>
                                                                </div>
                                                                <span className="shrink-0 tabular-nums text-[11px] font-medium text-muted-foreground">
                                                                    DJEN
                                                                </span>
                                                            </button>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>,
                        document.body,
                    )}

                {/* Menu "Novo" via Portal */}
                {menuNovoAberto &&
                    posMenuNovo &&
                    createPortal(
                        <div
                            ref={menuNovoRef}
                            role="menu"
                            aria-label="Criar novo"
                            style={{
                                position: "fixed",
                                top: posMenuNovo.top,
                                right: posMenuNovo.right,
                            }}
                            className="z-50 w-60 border border-ink/25 bg-card py-1 shadow-xl"
                        >
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    setMenuNovoAberto(false);
                                    onNovoCalculo();
                                }}
                                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-ink hover:bg-ink/5"
                            >
                                <Calculator aria-hidden className="size-4 text-ink/70" />
                                Novo cálculo
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    setMenuNovoAberto(false);
                                    onNovaTarefa();
                                }}
                                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-ink hover:bg-ink/5"
                            >
                                <CalendarPlus aria-hidden className="size-4 text-ink/70" />
                                Nova tarefa ou prazo
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    setMenuNovoAberto(false);
                                    onAbrirRadarDjen();
                                }}
                                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-ink hover:bg-ink/5"
                            >
                                <Gavel aria-hidden className="size-4 text-ink/70" />
                                Consultar processo no DJEN
                            </button>
                        </div>,
                        document.body,
                    )}

                <main className="mx-auto w-full min-w-0 max-w-[1440px] flex-1 px-4 py-5 sm:px-6 sm:py-6">
                    {children}
                </main>
            </div>
        </div>
    );
};
