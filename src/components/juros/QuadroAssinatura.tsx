import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Check, Eraser, PenLine } from "lucide-react";
import { sanitizarAssinaturaImagemUrl } from "@/lib/config-escritorio";
import { cn } from "@/lib/utils";

interface QuadroAssinaturaProps {
    corTinta?: string;
    rotuloConfirmar?: string;
    onConfirmar: (pngDataUrl: string) => void;
    onCancelar?: () => void;
    className?: string;
}

/**
 * Quadro para desenhar a assinatura/rubrica à mão livre (mouse, toque ou caneta)
 * e exportar PNG com fundo transparente recortado rente aos traços.
 */
export function QuadroAssinatura({
    rotuloConfirmar = "Usar este desenho",
    onConfirmar,
    onCancelar,
    className,
}: QuadroAssinaturaProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const desenhandoRef = useRef(false);
    const ultimoPontoRef = useRef<{ x: number; y: number } | null>(null);
    const [temTraco, setTemTraco] = useState(false);
    const [cor, setCor] = useState<"#000000" | "#061237">("#061237");

    const inicializarCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const escala = Math.min(2, window.devicePixelRatio || 1);
        const w = Math.max(300, Math.round((rect.width || 440) * escala));
        const h = Math.max(120, Math.round((rect.height || 150) * escala));
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
        }
        const ctx = canvas.getContext("2d");
        if (ctx) {
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.lineWidth = 2.6 * escala;
            ctx.strokeStyle = cor;
        }
    }, [cor]);

    useEffect(() => {
        inicializarCanvas();
    }, [inicializarCanvas]);

    const pontoDoEvento = (e: ReactPointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const sx = canvas.width / (rect.width || 1);
        const sy = canvas.height / (rect.height || 1);
        return {
            x: (e.clientX - rect.left) * sx,
            y: (e.clientY - rect.top) * sy,
        };
    };

    const iniciarTraco = (e: ReactPointerEvent<HTMLCanvasElement>) => {
        if (e.button !== 0 && e.pointerType === "mouse") return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        if (canvas.width === 0) inicializarCanvas();
        e.preventDefault();
        canvas.setPointerCapture(e.pointerId);
        const p = pontoDoEvento(e);
        const escala = Math.min(2, window.devicePixelRatio || 1);
        ctx.strokeStyle = cor;
        ctx.fillStyle = cor;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = (e.pointerType === "pen" && e.pressure > 0 ? 1.8 + e.pressure * 2 : 2.6) * escala;
        ctx.beginPath();
        ctx.arc(p.x, p.y, ctx.lineWidth / 2.2, 0, Math.PI * 2);
        ctx.fill();
        ultimoPontoRef.current = p;
        desenhandoRef.current = true;
        setTemTraco(true);
    };

    const moverTraco = (e: ReactPointerEvent<HTMLCanvasElement>) => {
        if (!desenhandoRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        const anterior = ultimoPontoRef.current;
        if (!canvas || !ctx || !anterior) return;
        const atual = pontoDoEvento(e);
        const escala = Math.min(2, window.devicePixelRatio || 1);
        ctx.strokeStyle = cor;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = (e.pointerType === "pen" && e.pressure > 0 ? 1.8 + e.pressure * 2 : 2.6) * escala;
        ctx.beginPath();
        ctx.moveTo(anterior.x, anterior.y);
        ctx.lineTo(atual.x, atual.y);
        ctx.stroke();
        ultimoPontoRef.current = atual;
    };

    const encerrarTraco = () => {
        desenhandoRef.current = false;
        ultimoPontoRef.current = null;
    };

    const limpar = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setTemTraco(false);
    };

    const exportarPngRecortado = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx || !temTraco) return;
        const { width, height } = canvas;
        const pixels = ctx.getImageData(0, 0, width, height).data;

        let minX = width;
        let minY = height;
        let maxX = -1;
        let maxY = -1;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (pixels[(y * width + x) * 4 + 3] > 8) {
                    if (x < minX) minX = x;
                    if (y < minY) minY = y;
                    if (x > maxX) maxX = x;
                    if (y > maxY) maxY = y;
                }
            }
        }
        if (maxX < minX || maxY < minY) return;

        const pad = 12;
        const sx = Math.max(0, minX - pad);
        const sy = Math.max(0, minY - pad);
        const sw = Math.min(width - sx, maxX - minX + 1 + pad * 2);
        const sh = Math.min(height - sy, maxY - minY + 1 + pad * 2);

        const escalaOut = Math.min(1, 800 / sw, 280 / sh);
        const out = document.createElement("canvas");
        out.width = Math.max(1, Math.round(sw * escalaOut));
        out.height = Math.max(1, Math.round(sh * escalaOut));
        const octx = out.getContext("2d");
        if (!octx) return;
        octx.drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);

        const dataUrl = out.toDataURL("image/png");
        if (sanitizarAssinaturaImagemUrl(dataUrl)) {
            onConfirmar(dataUrl);
        }
    };

    return (
        <div className={cn("space-y-2 border border-ink/20 bg-white p-3", className)}>
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                    <PenLine aria-hidden className="size-3.5 text-gold-deep" />
                    Desenhe sua assinatura abaixo
                </span>
                <div className="flex items-center gap-1.5">
                    <span>Caneta:</span>
                    {(
                        [
                            { id: "#061237", rotulo: "Azul-marinho" },
                            { id: "#000000", rotulo: "Preta" },
                        ] as const
                    ).map((c) => (
                        <button
                            key={c.id}
                            type="button"
                            onClick={() => setCor(c.id)}
                            title={c.rotulo}
                            aria-label={`Tinta ${c.rotulo}`}
                            className={cn(
                                "size-4 rounded-full border",
                                cor === c.id ? "ring-2 ring-gold-deep ring-offset-1" : "border-ink/25",
                            )}
                            style={{ backgroundColor: c.id }}
                        />
                    ))}
                </div>
            </div>

            <div className="relative overflow-hidden border border-dashed border-ink/25 bg-[#fdfcf9]">
                <canvas
                    ref={canvasRef}
                    onPointerDown={iniciarTraco}
                    onPointerMove={moverTraco}
                    onPointerUp={encerrarTraco}
                    onPointerCancel={encerrarTraco}
                    className="block h-36 w-full cursor-crosshair touch-none"
                />
                {!temTraco && (
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground/70">
                        Assine aqui com o mouse, touchpad ou dedo
                    </span>
                )}
                <div
                    aria-hidden
                    className="pointer-events-none absolute bottom-5 left-8 right-8 border-b border-ink/15"
                />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                    type="button"
                    disabled={!temTraco}
                    onClick={limpar}
                    className="inline-flex h-8 items-center gap-1.5 border border-ink/20 px-2.5 text-xs font-medium text-ink hover:bg-ink/5 disabled:opacity-45"
                >
                    <Eraser aria-hidden className="size-3.5" />
                    Limpar
                </button>
                <div className="flex items-center gap-2">
                    {onCancelar && (
                        <button
                            type="button"
                            onClick={onCancelar}
                            className="inline-flex h-8 items-center border border-ink/20 px-3 text-xs font-medium text-muted-foreground hover:text-ink"
                        >
                            Cancelar
                        </button>
                    )}
                    <button
                        type="button"
                        disabled={!temTraco}
                        onClick={exportarPngRecortado}
                        className="inline-flex h-8 items-center gap-1.5 bg-ink px-3 text-xs font-semibold text-paper hover:bg-ink-deep disabled:opacity-45"
                    >
                        <Check aria-hidden className="size-3.5" />
                        {rotuloConfirmar}
                    </button>
                </div>
            </div>
        </div>
    );
}
