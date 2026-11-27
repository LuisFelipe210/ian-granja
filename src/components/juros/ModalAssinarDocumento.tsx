import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
    AlertTriangle,
    CheckCircle2,
    Download,
    ExternalLink,
    FileCheck2,
    FileUp,
    ImagePlus,
    KeyRound,
    Loader2,
    Lock,
    PenTool,
    ShieldCheck,
    Trash2,
    Upload,
    Usb,
    X,
} from "lucide-react";
import { toast } from "sonner";
import { QuadroAssinatura } from "@/components/juros/QuadroAssinatura";
import type { CertificadoA1Carregado, ResultadoAssinaturaPdf } from "@/lib/assinatura-icp";
import { definirCertificadoSessao, useCertificadoSessao } from "@/lib/certificado-sessao";
import {
    cidadeAssinatura,
    definirConfigEscritorio,
    formatarOab,
} from "@/lib/config-escritorio";
import { nomeArquivoDocumento, type ConfigPagina } from "@/lib/documentos";
import { salvarAssinaturaEscritorio } from "@/lib/revisional-db";
import { prepararImagemAssinatura } from "@/lib/timbrado-imagem";
import { useConfigEscritorio } from "@/lib/use-config-escritorio";
import { cn } from "@/lib/utils";

type AbaModalAssinatura = "a1" | "a3" | "rubrica";

interface ModalAssinarDocumentoProps {
    aberto: boolean;
    onFechar: () => void;
    titulo: string;
    corpoHtml: string;
    pagina: ConfigPagina;
    obterLogoSrc?: () => Promise<string>;
}

/** Converte `data:image/webp` em JPEG para compatibilidade com `pdf-lib` (que suporta PNG/JPEG). */
async function garantirImagemParaPdf(dataUrl?: string): Promise<string> {
    if (!dataUrl) return "";
    if (!/^data:image\/webp;base64,/i.test(dataUrl.trim())) return dataUrl;
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) return resolve("");
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/jpeg", 0.92));
        };
        img.onerror = () => resolve("");
        img.src = dataUrl;
    });
}

function dispararDownloadPdf(bytes: Uint8Array, nomeArquivo: string) {
    const copia = new Uint8Array(bytes.byteLength);
    copia.set(bytes);
    const blob = new Blob([copia.buffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function formatarDataCurta(d: Date): string {
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function ModalAssinarDocumento({
    aberto,
    onFechar,
    titulo,
    corpoHtml,
    pagina,
    obterLogoSrc,
}: ModalAssinarDocumentoProps) {
    const config = useConfigEscritorio();
    const certSessao = useCertificadoSessao();

    const [aba, setAba] = useState<AbaModalAssinatura>("a1");

    // Estado A1 (.pfx/.p12)
    const [trocandoCert, setTrocandoCert] = useState(false);
    const [arquivoPfx, setArquivoPfx] = useState<File | null>(null);
    const [senhaPfx, setSenhaPfx] = useState("");
    const [manterEmMemoria, setManterEmMemoria] = useState(true);
    const [carregandoCert, setCarregandoCert] = useState(false);
    const [origemPdf, setOrigemPdf] = useState<"documento" | "externo">("documento");
    const [pdfExterno, setPdfExterno] = useState<File | null>(null);
    const [razao, setRazao] = useState("Assinatura digital de documento jurídico");
    const [localizacao, setLocalizacao] = useState(() => cidadeAssinatura(config));
    const [desenharSelo, setDesenharSelo] = useState(true);
    const [processandoPdf, setProcessandoPdf] = useState(false);
    const [resultadoA1, setResultadoA1] = useState<ResultadoAssinaturaPdf | null>(null);

    // Estado Rubrica visual
    const [modoRubrica, setModoRubrica] = useState<"desenhar" | "imagem">("desenhar");
    const [rubricaRascunho, setRubricaRascunho] = useState<string>(config.assinaturaImagemUrl ?? "");
    const [salvandoRubrica, setSalvandoRubrica] = useState(false);
    const [processandoImgRubrica, setProcessandoImgRubrica] = useState(false);
    const inputRubricaRef = useRef<HTMLInputElement>(null);

    // Reinicia os campos só quando a janela ABRE: salvar a rubrica (que troca `config`) com ela aberta
    // não pode apagar a Localização digitada nem o resultado da assinatura.
    const estavaAbertoRef = useRef(false);
    useEffect(() => {
        if (aberto && !estavaAbertoRef.current) {
            setLocalizacao(cidadeAssinatura(config));
            setRubricaRascunho(config.assinaturaImagemUrl ?? "");
            setResultadoA1(null);
        }
        estavaAbertoRef.current = aberto;
    }, [aberto, config]);

    const carregarCertificado = async (): Promise<CertificadoA1Carregado | null> => {
        if (!arquivoPfx) {
            toast.error("Selecione o arquivo do certificado A1 (.pfx ou .p12).");
            return null;
        }
        setCarregandoCert(true);
        try {
            const [{ lerCertificadoPfx }, buffer] = await Promise.all([
                import("@/lib/assinatura-icp"),
                arquivoPfx.arrayBuffer(),
            ]);
            const cert = lerCertificadoPfx(new Uint8Array(buffer), senhaPfx);
            if (manterEmMemoria) {
                definirCertificadoSessao(cert);
                setTrocandoCert(false);
                setSenhaPfx("");
            }
            if (cert.info.expirado) {
                toast.error("Este certificado está vencido e não pode assinar. Renove o certificado A1.");
            } else if (cert.info.aindaNaoValido) {
                toast.error("Este certificado ainda não está em vigor e não pode assinar.");
            } else {
                toast.success(`Certificado carregado: ${cert.info.titular}`);
            }
            return cert;
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Não foi possível abrir o certificado A1.");
            return null;
        } finally {
            setCarregandoCert(false);
        }
    };

    const montarPdfBaseDocumento = async () => {
        const [{ gerarPdfDocumento }, logoSrc, timbradoImg, rubricaImg] = await Promise.all([
            import("@/lib/documento-pdf"),
            obterLogoSrc ? obterLogoSrc() : Promise.resolve(""),
            garantirImagemParaPdf(config.timbradoImagemUrl),
            garantirImagemParaPdf(config.assinaturaImagemUrl),
        ]);
        return gerarPdfDocumento({
            titulo: titulo.trim() || "Documento",
            corpoHtml,
            pagina,
            escritorio: config,
            logoSrc,
            timbradoImagemUrl: timbradoImg,
            assinaturaImagemUrl: rubricaImg,
        });
    };

    const assinarEBaixarA1 = async () => {
        setProcessandoPdf(true);
        setResultadoA1(null);
        try {
            const cert = certSessao && !trocandoCert ? certSessao : await carregarCertificado();
            if (!cert) return;

            const { assinarPdfComCertificadoA1, validarVigenciaCertificado } = await import("@/lib/assinatura-icp");
            // Confere a validade agora (o certificado pode ter vencido com a aba aberta).
            validarVigenciaCertificado(cert.cert, new Date());
            let pdfBytes: Uint8Array;
            let posicao;
            let nomeSaida: string;

            if (origemPdf === "externo") {
                if (!pdfExterno) {
                    toast.error("Selecione o arquivo .pdf que deseja assinar.");
                    return;
                }
                pdfBytes = new Uint8Array(await pdfExterno.arrayBuffer());
                nomeSaida = `${nomeArquivoDocumento(pdfExterno.name.replace(/\.pdf$/i, ""))}-assinado.pdf`;
            } else {
                const gerado = await montarPdfBaseDocumento();
                pdfBytes = gerado.pdfBytes;
                posicao = gerado.posicaoAssinatura;
                nomeSaida = `${nomeArquivoDocumento(titulo || "documento")}-assinado.pdf`;
            }

            const rubricaParaSelo =
                origemPdf === "externo" ? await garantirImagemParaPdf(config.assinaturaImagemUrl) : undefined;

            const res = await assinarPdfComCertificadoA1(pdfBytes, cert, {
                razao: razao.trim() || "Assinatura digital de documento jurídico",
                localizacao: localizacao.trim() || cidadeAssinatura(config),
                posicao,
                desenharSelo,
                rubricaDataUrl: rubricaParaSelo,
                oabTexto: formatarOab(config),
            });

            dispararDownloadPdf(res.pdfBytes, nomeSaida);
            setResultadoA1(res);
            toast.success("PDF assinado digitalmente com sucesso!");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Não foi possível assinar o PDF.");
        } finally {
            setProcessandoPdf(false);
        }
    };

    const baixarParaA3 = async () => {
        setProcessandoPdf(true);
        try {
            const [{ prepararPdfParaAssinaturaA3 }, gerado] = await Promise.all([
                import("@/lib/assinatura-icp"),
                montarPdfBaseDocumento(),
            ]);
            const pronto = await prepararPdfParaAssinaturaA3(gerado.pdfBytes, {
                posicao: gerado.posicaoAssinatura,
                desenharMoldura: true,
            });
            dispararDownloadPdf(pronto, `${nomeArquivoDocumento(titulo || "documento")}-para-assinar.pdf`);
            toast.success("PDF preparado com campo ICP-Brasil! Abra no Assinador Gov.br, Serpro ou PJeOffice para assinar com seu token A3.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Não foi possível gerar o PDF para assinatura.");
        } finally {
            setProcessandoPdf(false);
        }
    };

    const selecionarArquivoRubrica = async (file?: File) => {
        if (!file) return;
        setProcessandoImgRubrica(true);
        try {
            const dataUrl = await prepararImagemAssinatura(file);
            setRubricaRascunho(dataUrl);
            toast.success("Imagem da rubrica carregada. Clique em “Salvar rubrica no escritório”.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Não foi possível ler a imagem.");
        } finally {
            setProcessandoImgRubrica(false);
            if (inputRubricaRef.current) inputRubricaRef.current.value = "";
        }
    };

    const salvarRubrica = async (novaUrl: string) => {
        setSalvandoRubrica(true);
        try {
            const atualizado = await salvarAssinaturaEscritorio(novaUrl);
            definirConfigEscritorio(atualizado);
            setRubricaRascunho(atualizado.assinaturaImagemUrl ?? "");
            toast.success(novaUrl ? "Rubrica salva nos dados do escritório." : "Rubrica removida do escritório.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Não foi possível salvar a rubrica.");
        } finally {
            setSalvandoRubrica(false);
        }
    };

    const certAtivo = certSessao && !trocandoCert ? certSessao : null;
    const rubricaMudou = (rubricaRascunho || "") !== (config.assinaturaImagemUrl || "");

    return (
        <Dialog.Root
            open={aberto}
            onOpenChange={(open) => {
                if (!open && !processandoPdf && !salvandoRubrica) onFechar();
            }}
        >
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-deep/45 backdrop-blur-[2px]" />
                <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col border border-ink/20 bg-card shadow-2xl focus:outline-none">
                    {/* Cabeçalho */}
                    <div className="flex shrink-0 items-center justify-between border-b border-ink/15 px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                            <div className="flex size-8 items-center justify-center bg-ink text-gold-light">
                                <ShieldCheck aria-hidden className="size-4" />
                            </div>
                            <div>
                                <Dialog.Title className="text-base font-semibold tracking-tight text-ink">
                                    Assinatura digital e rubrica do advogado
                                </Dialog.Title>
                                <Dialog.Description className="text-xs text-muted-foreground">
                                    Assine em PDF com certificado ICP-Brasil (A1/A3) ou configure sua rubrica visual.
                                </Dialog.Description>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onFechar}
                            aria-label="Fechar janela de assinatura"
                            className="inline-flex size-8 items-center justify-center text-muted-foreground hover:text-ink"
                        >
                            <X className="size-4" />
                        </button>
                    </div>

                    {/* Abas */}
                    <div role="tablist" className="grid shrink-0 grid-cols-3 border-b border-ink/15 bg-secondary/50 text-xs font-semibold">
                        {(
                            [
                                { id: "a1", rotulo: "Certificado A1 (.pfx)", Icone: KeyRound },
                                { id: "a3", rotulo: "Token A3 / Gov.br / PJe", Icone: Usb },
                                { id: "rubrica", rotulo: "Rubrica visual", Icone: PenTool },
                            ] as const
                        ).map(({ id, rotulo, Icone }) => (
                            <button
                                key={id}
                                type="button"
                                role="tab"
                                aria-selected={aba === id}
                                onClick={() => setAba(id)}
                                className={cn(
                                    "flex items-center justify-center gap-1.5 border-b-2 px-3 py-2.5 transition-colors",
                                    aba === id
                                        ? "border-gold-deep bg-card text-ink"
                                        : "border-transparent text-muted-foreground hover:text-ink",
                                )}
                            >
                                <Icone aria-hidden className="size-3.5" />
                                <span className="truncate">{rotulo}</span>
                            </button>
                        ))}
                    </div>

                    {/* Conteúdo */}
                    <div className="flex-1 space-y-4 overflow-y-auto p-5 text-sm">
                        {aba === "a1" && (
                            <>
                                {/* Segurança client-side */}
                                <div className="flex items-start gap-2.5 border border-emerald-700/20 bg-emerald-50/70 px-3.5 py-2.5 text-xs text-emerald-950">
                                    <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0 text-emerald-700" />
                                    <span>
                                        Seu certificado <code className="font-semibold">.pfx/.p12</code> e sua senha{" "}
                                        <strong>nunca saem do seu navegador</strong>: a assinatura PAdES-BES ICP-Brasil é
                                        calculada localmente no seu computador.
                                    </span>
                                </div>

                                {certAtivo ? (
                                    <div className="border border-ink/20 bg-secondary/35 p-3.5">
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div>
                                                <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gold-deep">
                                                    <CheckCircle2 aria-hidden className="size-3.5 text-emerald-700" />
                                                    Certificado carregado na memória
                                                </p>
                                                <p className="mt-1 text-sm font-semibold text-ink">{certAtivo.info.titular}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {[
                                                        certAtivo.info.cpfCnpj ? `CPF/CNPJ: ${certAtivo.info.cpfCnpj}` : "",
                                                        `Emissor: ${certAtivo.info.emissor}`,
                                                    ]
                                                        .filter(Boolean)
                                                        .join(" · ")}
                                                </p>
                                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                                    Validade: {formatarDataCurta(certAtivo.info.validoDe)} até{" "}
                                                    {formatarDataCurta(certAtivo.info.validoAte)} · Cadeia:{" "}
                                                    {certAtivo.info.cadeiaTotal}{" "}
                                                    {certAtivo.info.cadeiaTotal === 1 ? "certificado" : "certificados"}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setTrocandoCert(true)}
                                                    className="inline-flex h-7 items-center border border-ink/20 bg-card px-2.5 text-[11px] font-semibold text-ink hover:bg-ink/5"
                                                >
                                                    Trocar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        definirCertificadoSessao(null);
                                                        setTrocandoCert(false);
                                                    }}
                                                    className="inline-flex h-7 items-center border border-ink/20 bg-card px-2 text-[11px] font-medium text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                                                    title="Limpar da memória agora"
                                                >
                                                    Remover
                                                </button>
                                            </div>
                                        </div>
                                        {certAtivo.info.expirado && (
                                            <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-destructive">
                                                <AlertTriangle className="size-3.5" /> Certificado expirado em{" "}
                                                {formatarDataCurta(certAtivo.info.validoAte)}.
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-3 border border-ink/15 bg-secondary/30 p-3.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-semibold text-ink">1. Selecionar certificado A1</span>
                                            {certSessao && (
                                                <button
                                                    type="button"
                                                    onClick={() => setTrocandoCert(false)}
                                                    className="text-xs font-medium text-muted-foreground underline hover:text-ink"
                                                >
                                                    Usar o carregado
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div>
                                                <label
                                                    htmlFor="input-certificado-pfx"
                                                    className="flex h-9 cursor-pointer items-center gap-2 border border-ink/25 bg-card px-3 text-xs font-medium text-ink hover:bg-ink/5"
                                                >
                                                    <FileUp aria-hidden className="size-3.5 shrink-0 text-gold-deep" />
                                                    <span className="truncate">
                                                        {arquivoPfx ? arquivoPfx.name : "Escolher arquivo .pfx ou .p12"}
                                                    </span>
                                                </label>
                                                <input
                                                    id="input-certificado-pfx"
                                                    type="file"
                                                    accept=".pfx,.p12,application/x-pkcs12"
                                                    className="sr-only"
                                                    onChange={(e) => setArquivoPfx(e.target.files?.[0] ?? null)}
                                                />
                                            </div>
                                            <div>
                                                <input
                                                    type="password"
                                                    value={senhaPfx}
                                                    onChange={(e) => setSenhaPfx(e.target.value)}
                                                    placeholder="Senha do certificado A1"
                                                    aria-label="Senha do certificado A1"
                                                    autoComplete="off"
                                                    className="h-9 w-full border border-ink/25 bg-card px-3 text-xs text-ink focus:border-ink focus:outline-none"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <label className="flex cursor-pointer items-center gap-2 text-xs text-ink">
                                                <input
                                                    type="checkbox"
                                                    checked={manterEmMemoria}
                                                    onChange={(e) => setManterEmMemoria(e.target.checked)}
                                                    className="accent-ink"
                                                />
                                                Manter carregado nesta aba (só na memória RAM)
                                            </label>
                                            <button
                                                type="button"
                                                disabled={!arquivoPfx || carregandoCert}
                                                onClick={() => void carregarCertificado()}
                                                className="inline-flex h-8 items-center gap-1.5 border border-ink/25 bg-card px-3 text-xs font-semibold text-ink hover:bg-ink/5 disabled:opacity-50"
                                            >
                                                {carregandoCert && <Loader2 className="size-3.5 animate-spin" />}
                                                Testar / carregar
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Fonte do PDF */}
                                <div className="space-y-2.5 border border-ink/15 p-3.5">
                                    <p className="text-xs font-semibold text-ink">2. Qual PDF deseja assinar?</p>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        <label
                                            className={cn(
                                                "flex cursor-pointer items-start gap-2 border p-2.5 text-xs transition-colors",
                                                origemPdf === "documento" ? "border-ink bg-ink/[0.04]" : "border-ink/15 hover:bg-ink/[0.02]",
                                            )}
                                        >
                                            <input
                                                type="radio"
                                                name="origem-pdf"
                                                checked={origemPdf === "documento"}
                                                onChange={() => setOrigemPdf("documento")}
                                                className="mt-0.5 accent-ink"
                                            />
                                            <span>
                                                <strong className="block text-ink">Este documento do editor</strong>
                                                <span className="text-[11px] text-muted-foreground">
                                                    Gera o PDF com timbrado e assina no bloco [assinatura].
                                                </span>
                                            </span>
                                        </label>
                                        <label
                                            className={cn(
                                                "flex cursor-pointer items-start gap-2 border p-2.5 text-xs transition-colors",
                                                origemPdf === "externo" ? "border-ink bg-ink/[0.04]" : "border-ink/15 hover:bg-ink/[0.02]",
                                            )}
                                        >
                                            <input
                                                type="radio"
                                                name="origem-pdf"
                                                checked={origemPdf === "externo"}
                                                onChange={() => setOrigemPdf("externo")}
                                                className="mt-0.5 accent-ink"
                                            />
                                            <span>
                                                <strong className="block text-ink">Outro PDF já pronto (.pdf)</strong>
                                                <span className="text-[11px] text-muted-foreground">
                                                    Ex.: Laudo pericial ou PDF exportado pelo Word.
                                                </span>
                                            </span>
                                        </label>
                                    </div>

                                    {origemPdf === "externo" && (
                                        <div className="pt-1">
                                            <label
                                                htmlFor="input-pdf-externo"
                                                className="flex h-9 cursor-pointer items-center gap-2 border border-dashed border-ink/30 bg-card px-3 text-xs font-medium text-ink hover:bg-ink/5"
                                            >
                                                <Upload aria-hidden className="size-3.5 text-gold-deep" />
                                                <span className="truncate">
                                                    {pdfExterno ? pdfExterno.name : "Selecionar arquivo .pdf para assinar"}
                                                </span>
                                            </label>
                                            <input
                                                id="input-pdf-externo"
                                                type="file"
                                                accept="application/pdf,.pdf"
                                                className="sr-only"
                                                onChange={(e) => setPdfExterno(e.target.files?.[0] ?? null)}
                                            />
                                        </div>
                                    )}

                                    <div className="grid gap-2.5 pt-1 sm:grid-cols-2">
                                        <div>
                                            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                                                Finalidade (Reason)
                                            </label>
                                            <input
                                                value={razao}
                                                onChange={(e) => setRazao(e.target.value)}
                                                maxLength={120}
                                                className="h-8 w-full border border-ink/20 bg-card px-2.5 text-xs text-ink focus:border-ink focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                                                Localização
                                            </label>
                                            <input
                                                value={localizacao}
                                                onChange={(e) => setLocalizacao(e.target.value)}
                                                maxLength={100}
                                                className="h-8 w-full border border-ink/20 bg-card px-2.5 text-xs text-ink focus:border-ink focus:outline-none"
                                            />
                                        </div>
                                    </div>

                                    <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs text-ink">
                                        <input
                                            type="checkbox"
                                            checked={desenharSelo}
                                            onChange={(e) => setDesenharSelo(e.target.checked)}
                                            className="accent-ink"
                                        />
                                        Desenhar carimbo visual ICP-Brasil na folha (com nome, OAB e data/hora)
                                    </label>
                                </div>

                                {resultadoA1 && (
                                    <div className="border border-emerald-700/25 bg-emerald-50/70 p-3.5 text-xs text-emerald-950">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <span className="inline-flex items-center gap-1.5 font-semibold">
                                                <FileCheck2 aria-hidden className="size-4 text-emerald-700" />
                                                PDF assinado baixado!
                                            </span>
                                            <a
                                                href="https://validar.iti.gov.br/"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 font-semibold text-emerald-800 underline hover:text-emerald-950"
                                            >
                                                Conferir no Validador ITI
                                                <ExternalLink className="size-3" />
                                            </a>
                                        </div>
                                        <p className="mt-1.5 break-all font-mono text-[10px] text-emerald-900/80">
                                            SHA-256: {resultadoA1.hashSha256Hex}
                                        </p>
                                    </div>
                                )}
                            </>
                        )}

                        {aba === "a3" && (
                            <div className="space-y-4">
                                <div className="border border-ink/15 bg-secondary/35 p-4 text-xs leading-relaxed text-ink">
                                    <p className="font-semibold">Como funciona com Token USB ou Cartão OAB com chip (A3)</p>
                                    <p className="mt-1.5 text-muted-foreground">
                                        Por segurança do próprio navegador, sites não acessam diretamente o chip do
                                        token USB sem conector local. Aqui você gera o PDF já formatado com o{" "}
                                        <strong>campo oficial de assinatura digital (AcroForm /Sig)</strong> posicionado
                                        no bloco do advogado para assinar com 1 clique no seu assinador preferido:
                                    </p>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                    <a
                                        href="https://assinador.iti.br/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-start justify-between gap-2 border border-ink/20 bg-card p-3.5 text-xs transition-colors hover:border-ink/40 hover:bg-ink/[0.02]"
                                    >
                                        <div>
                                            <span className="font-semibold text-ink">Assinador Gov.br (gratuito)</span>
                                            <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                                Assina direto pelo portal do governo ou aplicativo com validade jurídica
                                                ICP-Brasil.
                                            </span>
                                        </div>
                                        <ExternalLink className="size-3.5 shrink-0 text-gold-deep" />
                                    </a>
                                    <a
                                        href="https://validar.iti.gov.br/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-start justify-between gap-2 border border-ink/20 bg-card p-3.5 text-xs transition-colors hover:border-ink/40 hover:bg-ink/[0.02]"
                                    >
                                        <div>
                                            <span className="font-semibold text-ink">Validador oficial ITI</span>
                                            <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                                Comprova conformidade PAdES ICP-Brasil antes de protocolar nos autos.
                                            </span>
                                        </div>
                                        <ExternalLink className="size-3.5 shrink-0 text-gold-deep" />
                                    </a>
                                </div>

                                <div className="border border-dashed border-gold-deep/60 bg-gold/10 p-3.5 text-xs text-ink">
                                    <strong>Dica para PJeOffice / Assinador Serpro / Shodo:</strong> após baixar o PDF
                                    preparado abaixo, basta arrastá-lo para o seu assinador com o token A3 conectado — o
                                    campo da assinatura do advogado já estará demarcado no final da petição.
                                </div>
                            </div>
                        )}

                        {aba === "rubrica" && (
                            <div className="space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-3 border border-ink/15 bg-secondary/35 p-3.5">
                                    <div>
                                        <p className="text-xs font-semibold text-ink">Prévia no documento</p>
                                        <p className="text-[11px] text-muted-foreground">
                                            Aparece automaticamente acima do seu nome nos blocos [assinatura] e nos PDFs.
                                        </p>
                                    </div>
                                    <div className="flex h-16 w-48 items-center justify-center border border-ink/15 bg-white p-2">
                                        {rubricaRascunho ? (
                                            <img
                                                src={rubricaRascunho}
                                                alt="Prévia da rubrica"
                                                className="max-h-full max-w-full object-contain"
                                            />
                                        ) : (
                                            <span className="text-[11px] text-muted-foreground">Sem rubrica</span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setModoRubrica("desenhar")}
                                        className={cn(
                                            "inline-flex h-8 items-center gap-1.5 border px-3 text-xs font-semibold",
                                            modoRubrica === "desenhar"
                                                ? "border-ink bg-ink text-paper"
                                                : "border-ink/20 bg-card text-ink hover:bg-ink/5",
                                        )}
                                    >
                                        <PenTool className="size-3.5" />
                                        Desenhar na tela
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setModoRubrica("imagem")}
                                        className={cn(
                                            "inline-flex h-8 items-center gap-1.5 border px-3 text-xs font-semibold",
                                            modoRubrica === "imagem"
                                                ? "border-ink bg-ink text-paper"
                                                : "border-ink/20 bg-card text-ink hover:bg-ink/5",
                                        )}
                                    >
                                        <ImagePlus className="size-3.5" />
                                        Importar imagem PNG/JPG
                                    </button>
                                    {rubricaRascunho && (
                                        <button
                                            type="button"
                                            disabled={salvandoRubrica}
                                            onClick={() => {
                                                setRubricaRascunho("");
                                                if (config.assinaturaImagemUrl) void salvarRubrica("");
                                            }}
                                            className="ml-auto inline-flex h-8 items-center gap-1.5 border border-ink/20 px-2.5 text-xs font-medium text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                                        >
                                            <Trash2 className="size-3.5" />
                                            Remover
                                        </button>
                                    )}
                                </div>

                                {modoRubrica === "desenhar" ? (
                                    <QuadroAssinatura
                                        rotuloConfirmar="Aplicar desenho"
                                        onConfirmar={(png) => {
                                            setRubricaRascunho(png);
                                            toast.info("Desenho aplicado na prévia. Clique em “Salvar rubrica no escritório”.");
                                        }}
                                    />
                                ) : (
                                    <div className="border border-dashed border-ink/25 bg-white p-5 text-center">
                                        <input
                                            id="input-rubrica-modal"
                                            ref={inputRubricaRef}
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                                            className="sr-only"
                                            disabled={processandoImgRubrica}
                                            onChange={(e) => void selecionarArquivoRubrica(e.target.files?.[0])}
                                        />
                                        <label
                                            htmlFor="input-rubrica-modal"
                                            className={cn(
                                                "inline-flex h-9 cursor-pointer items-center gap-2 border border-ink/25 bg-card px-4 text-xs font-semibold text-ink hover:bg-ink/5",
                                                processandoImgRubrica && "pointer-events-none opacity-50",
                                            )}
                                        >
                                            {processandoImgRubrica ? (
                                                <Loader2 className="size-3.5 animate-spin" />
                                            ) : (
                                                <ImagePlus className="size-3.5 text-gold-deep" />
                                            )}
                                            Selecionar PNG transparente ou JPG da assinatura
                                        </label>
                                        <p className="mt-2 text-[11px] text-muted-foreground">
                                            Dica: PNG sem fundo fica ideal sobre a linha da assinatura e o timbrado.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Rodapé */}
                    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-ink/15 bg-secondary/40 px-5 py-3">
                        <button
                            type="button"
                            onClick={onFechar}
                            className="inline-flex h-9 items-center border border-ink/25 bg-card px-4 text-xs font-semibold text-ink hover:bg-ink/5"
                        >
                            Fechar
                        </button>

                        {aba === "a1" && (
                            <button
                                type="button"
                                disabled={processandoPdf || carregandoCert}
                                onClick={() => void assinarEBaixarA1()}
                                className="inline-flex h-9 items-center gap-1.5 bg-ink px-4 text-xs font-semibold text-paper transition-colors hover:bg-ink-deep disabled:opacity-55"
                            >
                                {processandoPdf ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                    <ShieldCheck className="size-3.5 text-gold-light" />
                                )}
                                Assinar e baixar PDF (ICP-Brasil)
                            </button>
                        )}

                        {aba === "a3" && (
                            <button
                                type="button"
                                disabled={processandoPdf}
                                onClick={() => void baixarParaA3()}
                                className="inline-flex h-9 items-center gap-1.5 bg-gold px-4 text-xs font-semibold text-ink transition-colors hover:bg-gold-light disabled:opacity-55"
                            >
                                {processandoPdf ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                                Baixar PDF pronto para A3 / Gov.br / PJe
                            </button>
                        )}

                        {aba === "rubrica" && (
                            <button
                                type="button"
                                disabled={salvandoRubrica || !rubricaMudou}
                                onClick={() => void salvarRubrica(rubricaRascunho)}
                                className="inline-flex h-9 items-center gap-1.5 bg-gold px-4 text-xs font-semibold text-ink transition-colors hover:bg-gold-light disabled:opacity-50"
                            >
                                {salvandoRubrica && <Loader2 className="size-3.5 animate-spin" />}
                                Salvar rubrica no escritório
                            </button>
                        )}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
