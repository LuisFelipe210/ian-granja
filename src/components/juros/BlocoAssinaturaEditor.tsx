import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { AlignCenter, AlignLeft, AlignRight, Calendar, GripVertical, PenLine, ShieldCheck, Trash2 } from "lucide-react";
import { cidadeAssinatura, formatarOab } from "@/lib/config-escritorio";
import { useConfigEscritorio } from "@/lib/use-config-escritorio";
import { dataPorExtenso, type AlinhamentoAssinatura } from "@/lib/documentos";
import { cn } from "@/lib/utils";

const BOTAO_BARRA = "inline-flex h-6 items-center justify-center gap-1 whitespace-nowrap transition-colors";
const BOTAO_ATIVO = "bg-ink/[0.08] text-ink";
const BOTAO_INATIVO = "text-ink/50 hover:bg-ink/5 hover:text-ink";

export interface OpcoesBlocoAssinaturaExt {
    onAssinar?: () => void;
}

function VisualBlocoAssinatura({ node, updateAttributes, deleteNode, selected, extension }: NodeViewProps) {
    const config = useConfigEscritorio();
    const alinhamento = (node.attrs.alinhamento as AlinhamentoAssinatura) || "center";
    const mostrarData = node.attrs.mostrarData !== false;
    const mostrarSelo = node.attrs.mostrarSelo !== false;

    const storageOnAssinar = (extension.storage as { onAssinar?: (() => void) | null } | undefined)?.onAssinar;
    const opcoesOnAssinar = (extension.options as OpcoesBlocoAssinaturaExt | undefined)?.onAssinar;
    const onAssinar = storageOnAssinar ?? opcoesOnAssinar;

    return (
        <NodeViewWrapper
            as="div"
            data-assinatura-advogado="true"
            data-alinhamento={alinhamento}
            data-mostrar-data={String(mostrarData)}
            data-mostrar-selo={String(mostrarSelo)}
            className={cn(
                "bloco-assinatura-editor group/ass relative my-4 select-none transition-shadow",
                selected && "ring-2 ring-gold/80 ring-offset-4",
            )}
            style={{ textAlign: alinhamento }}
        >
            {/* Micro-barra de ajuste rápido ao selecionar ou passar o mouse */}
            <div
                contentEditable={false}
                className={cn(
                    "absolute -top-9 left-1/2 z-10 flex w-max -translate-x-1/2 items-center gap-0.5 border border-ink/15 bg-card p-0.5 font-sans text-[11px] leading-none text-ink shadow-md shadow-ink/15 transition-opacity",
                    selected
                        ? "opacity-100"
                        : "pointer-events-none opacity-0 group-hover/ass:pointer-events-auto group-hover/ass:opacity-100",
                )}
            >
                {/* Alça de arrasto: precisa ser span (o TipTap ignora drag iniciado em <button>). */}
                <span
                    data-drag-handle=""
                    draggable="true"
                    title="Arrastar para mover a assinatura"
                    aria-label="Arrastar para mover a assinatura"
                    className="inline-flex h-6 w-5 cursor-grab items-center justify-center text-ink/35 transition-colors hover:text-ink active:cursor-grabbing"
                >
                    <GripVertical className="size-3.5" />
                </span>
                <span aria-hidden className="mx-1 h-4 w-px bg-ink/10" />
                {(
                    [
                        ["left", AlignLeft, "Alinhar assinatura à esquerda"],
                        ["center", AlignCenter, "Centralizar assinatura"],
                        ["right", AlignRight, "Alinhar assinatura à direita"],
                    ] as const
                ).map(([al, Icone, rotulo]) => (
                    <button
                        key={al}
                        type="button"
                        title={rotulo}
                        aria-label={rotulo}
                        aria-pressed={alinhamento === al}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => updateAttributes({ alinhamento: al })}
                        className={cn(BOTAO_BARRA, "w-6", alinhamento === al ? BOTAO_ATIVO : BOTAO_INATIVO)}
                    >
                        <Icone className="size-3.5" />
                    </button>
                ))}
                <span aria-hidden className="mx-1 h-4 w-px bg-ink/10" />
                <button
                    type="button"
                    title="Mostrar ou ocultar cidade e data"
                    aria-pressed={mostrarData}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => updateAttributes({ mostrarData: !mostrarData })}
                    className={cn(BOTAO_BARRA, "px-1.5 font-medium", mostrarData ? BOTAO_ATIVO : BOTAO_INATIVO)}
                >
                    <Calendar className="size-3.5" />
                    Data
                </button>
                <button
                    type="button"
                    title="Mostrar ou ocultar espaço/selo ICP-Brasil"
                    aria-pressed={mostrarSelo}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => updateAttributes({ mostrarSelo: !mostrarSelo })}
                    className={cn(BOTAO_BARRA, "px-1.5 font-medium", mostrarSelo ? BOTAO_ATIVO : BOTAO_INATIVO)}
                >
                    <ShieldCheck className="size-3.5" />
                    Selo
                </button>
                {onAssinar && (
                    <>
                        <span aria-hidden className="mx-1 h-4 w-px bg-ink/10" />
                        <button
                            type="button"
                            title="Assinar documento em PDF com certificado ICP-Brasil (A1/A3)"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={onAssinar}
                            className={cn(BOTAO_BARRA, "bg-ink px-2 font-semibold text-paper hover:bg-ink-deep")}
                        >
                            <PenLine className="size-3.5 text-gold-light" />
                            Assinar PDF
                        </button>
                    </>
                )}
                <button
                    type="button"
                    title="Remover bloco de assinatura"
                    aria-label="Remover bloco de assinatura"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={deleteNode}
                    className={cn(BOTAO_BARRA, "ml-0.5 w-6 text-ink/45 hover:bg-destructive/10 hover:text-destructive")}
                >
                    <Trash2 className="size-3.5" />
                </button>
            </div>

            {mostrarData && (
                <div className="mb-2 text-[12pt] leading-normal text-black">
                    {cidadeAssinatura(config)}, {dataPorExtenso(new Date())}.
                </div>
            )}

            <div className="inline-block text-center text-black">
                {config.assinaturaImagemUrl ? (
                    <img
                        src={config.assinaturaImagemUrl}
                        alt="Assinatura do advogado"
                        className="mx-auto mb-0.5 max-h-16 max-w-[240px] object-contain"
                    />
                ) : (
                    <div className="h-7" />
                )}
                <div className="mx-auto w-[7.5cm] border-t border-black pt-1 text-center">
                    <div className="text-[11.5pt] font-bold leading-snug">{config.nomeAdvogado}</div>
                    <div className="text-[10.5pt] leading-snug">{formatarOab(config)}</div>
                </div>
                {mostrarSelo && (
                    <div className="mt-1.5 inline-flex items-center gap-1 border border-[#8b6d3b]/70 bg-[#faf7f0] px-2 py-0.5 font-sans text-[9.5px] font-medium tracking-wide text-[#061237]">
                        <ShieldCheck aria-hidden className="size-3 text-[#8b6d3b]" />
                        Espaço para assinatura digital · <strong>ICP-Brasil</strong>
                    </div>
                )}
            </div>
        </NodeViewWrapper>
    );
}

export const BlocoAssinatura = Node.create<OpcoesBlocoAssinaturaExt>({
    name: "blocoAssinatura",
    group: "block",
    atom: true,
    selectable: true,
    draggable: true,

    addOptions() {
        return {
            onAssinar: undefined,
        };
    },

    addStorage() {
        return {
            onAssinar: null as (() => void) | null,
        };
    },

    addAttributes() {
        return {
            alinhamento: {
                default: "center",
                parseHTML: (el) => {
                    const v = ((el as HTMLElement).getAttribute("data-alinhamento") || "center").toLowerCase();
                    return v === "left" || v === "right" ? v : "center";
                },
                renderHTML: (attrs) => ({ "data-alinhamento": attrs.alinhamento || "center" }),
            },
            mostrarData: {
                default: true,
                parseHTML: (el) => (el as HTMLElement).getAttribute("data-mostrar-data") !== "false",
                renderHTML: (attrs) => ({ "data-mostrar-data": String(attrs.mostrarData !== false) }),
            },
            mostrarSelo: {
                default: true,
                parseHTML: (el) => (el as HTMLElement).getAttribute("data-mostrar-selo") !== "false",
                renderHTML: (attrs) => ({ "data-mostrar-selo": String(attrs.mostrarSelo !== false) }),
            },
        };
    },

    parseHTML() {
        return [{ tag: "div[data-assinatura-advogado]" }];
    },

    renderHTML({ HTMLAttributes }) {
        return ["div", mergeAttributes(HTMLAttributes, { "data-assinatura-advogado": "true" })];
    },

    addNodeView() {
        return ReactNodeViewRenderer(VisualBlocoAssinatura);
    },
});
