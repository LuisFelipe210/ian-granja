import { useEffect, useRef, useState, type FormEvent } from "react";
import { FolderOpen, FolderPlus, HardDrive, Loader2, X } from "lucide-react";
import { labelClass } from "@/components/juros/Campos";
import { IconeGoogleDrive } from "@/components/juros/IconeGoogleDrive";
import { ModalDialog } from "@/components/juros/ModalDialog";
import type { ItemDrive } from "@/lib/google-drive";

/**
 * `pasta: null` = raiz do Meu Drive. Em "nova", a pasta é criada dentro de `pastaPai` (ou no Meu Drive).
 */
export type DestinoDrive =
    | { tipo: "pasta"; pasta: ItemDrive | null }
    | { tipo: "nova"; nome: string; pastaPai: ItemDrive | null };

interface ModalDestinoDriveProps {
    aberto: boolean;
    /** Sugestão de nome para a pasta nova (ex.: nome do cliente). */
    nomeSugerido: string;
    /** Conta Google em uso, mostrada para a pessoa conferir onde o laudo vai parar. */
    conta?: string | null;
    /** Última pasta onde um laudo foi salvo; vem escolhida por padrão. */
    ultimaPasta?: ItemDrive | null;
    enviando: boolean;
    /** Abre o seletor do Google para escolher uma pasta; `null` = cancelou. */
    onEscolherPasta: () => Promise<ItemDrive | null>;
    onConfirmar: (destino: DestinoDrive) => void;
    onFechar: () => void;
}

/**
 * Janela do "Salvar no Drive". Primeiro a pasta (a última usada já vem escolhida; "Trocar pasta" abre o
 * seletor do Google), depois duas ações separadas: salvar o laudo nessa pasta, ou criar uma pasta nova
 * dentro dela e salvar lá. O seletor do Google não tem "Nova pasta", por isso a criação fica aqui.
 */
export const ModalDestinoDrive = ({
    aberto,
    nomeSugerido,
    conta,
    ultimaPasta = null,
    enviando,
    onEscolherPasta,
    onConfirmar,
    onFechar,
}: ModalDestinoDriveProps) => {
    const [pasta, setPasta] = useState<ItemDrive | null>(ultimaPasta);
    const [nome, setNome] = useState(nomeSugerido);
    const [escolhendo, setEscolhendo] = useState(false);
    const [acaoEnviando, setAcaoEnviando] = useState<"salvar" | "criar" | null>(null);
    const [erro, setErro] = useState<string | null>(null);
    const campoNome = useRef<HTMLInputElement>(null);
    const ocupado = enviando || escolhendo;
    const nomePasta = pasta ? pasta.nome : "Meu Drive";
    const ehUltima = Boolean(pasta && ultimaPasta && pasta.id === ultimaPasta.id);

    useEffect(() => {
        if (!aberto) return;
        setPasta(ultimaPasta);
        setNome(nomeSugerido);
        setEscolhendo(false);
        setAcaoEnviando(null);
        setErro(null);
    }, [aberto, nomeSugerido, ultimaPasta]);

    useEffect(() => {
        if (!enviando) setAcaoEnviando(null);
    }, [enviando]);

    if (!aberto) return null;

    const trocarPasta = async () => {
        setErro(null);
        setEscolhendo(true);
        try {
            const escolhida = await onEscolherPasta();
            if (escolhida) setPasta(escolhida);
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível abrir o Google Drive.");
        } finally {
            setEscolhendo(false);
        }
    };

    const salvarNaPasta = () => {
        setErro(null);
        setAcaoEnviando("salvar");
        onConfirmar({ tipo: "pasta", pasta });
    };

    const criarESalvar = (ev: FormEvent) => {
        ev.preventDefault();
        const limpo = nome.trim();
        if (!limpo) {
            setErro("Informe o nome da pasta nova.");
            campoNome.current?.focus();
            return;
        }
        setErro(null);
        setAcaoEnviando("criar");
        onConfirmar({ tipo: "nova", nome: limpo, pastaPai: pasta });
    };

    const girando = (acao: "salvar" | "criar") => enviando && acaoEnviando === acao;

    const botaoPequeno =
        "inline-flex h-8 shrink-0 items-center gap-1.5 border border-ink/30 bg-card px-2.5 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-ink/5 disabled:opacity-60";

    return (
        <ModalDialog
            aberto={aberto}
            onFechar={onFechar}
            bloquearFechamento={ocupado}
            ariaLabelledBy="titulo-destino-drive"
            tituloAcessivel="Onde salvar o laudo?"
            overlayClassName="bg-ink-deep/80"
            contentClassName="sheet max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto overscroll-contain p-6 sm:p-8"
        >
                <div className="flex items-start justify-between gap-4 border-b border-ink/20 pb-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2.5">
                            <IconeGoogleDrive className="size-5 shrink-0" />
                            <h2 id="titulo-destino-drive" className="subdisplay text-2xl text-ink">
                                Onde salvar o laudo?
                            </h2>
                        </div>
                        {conta && (
                            <p className="mt-1.5 truncate text-xs text-ink/65">
                                Google Drive de <span className="font-semibold text-ink">{conta}</span>
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onFechar}
                        disabled={ocupado}
                        aria-label="Fechar janela"
                        className="inline-flex size-8 shrink-0 items-center justify-center text-ink/60 hover:text-ink disabled:opacity-50"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                {/* 1. A pasta */}
                <div className="mt-5">
                    <p className={labelClass}>Pasta no Drive</p>
                    <div className="mt-2 flex items-center gap-3 border border-ink/25 bg-ink/[0.03] px-3 py-2.5">
                        {pasta ? (
                            <FolderOpen aria-hidden className="size-5 shrink-0 text-ink/70" />
                        ) : (
                            <HardDrive aria-hidden className="size-5 shrink-0 text-ink/70" />
                        )}
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-ink">{nomePasta}</p>
                            {ehUltima && <p className="text-xs text-ink/60">Última pasta usada</p>}
                        </div>
                        <button type="button" onClick={() => void trocarPasta()} disabled={ocupado} className={botaoPequeno}>
                            {escolhendo ? (
                                <Loader2 aria-hidden className="size-3.5 animate-spin" />
                            ) : (
                                <FolderOpen aria-hidden className="size-3.5" />
                            )}
                            Trocar pasta
                        </button>
                    </div>
                    {pasta && (
                        <button
                            type="button"
                            onClick={() => setPasta(null)}
                            disabled={ocupado}
                            className="mt-1.5 text-xs font-medium text-ink/65 underline-offset-2 hover:text-ink hover:underline disabled:opacity-60"
                        >
                            Usar a raiz do Meu Drive
                        </button>
                    )}
                </div>

                {/* 2a. Salvar direto nela */}
                <button
                    type="button"
                    onClick={salvarNaPasta}
                    disabled={ocupado}
                    className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 bg-ink px-4 text-sm font-semibold text-paper transition-colors duration-150 hover:bg-ink-soft disabled:opacity-60"
                >
                    {girando("salvar") ? (
                        <Loader2 aria-hidden className="size-4 shrink-0 animate-spin" />
                    ) : (
                        <FolderOpen aria-hidden className="size-4 shrink-0" />
                    )}
                    <span className="truncate">{girando("salvar") ? "Salvando…" : `Salvar em ${nomePasta}`}</span>
                </button>

                <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-ink/45">
                    <span className="h-px flex-1 bg-ink/15" />
                    ou
                    <span className="h-px flex-1 bg-ink/15" />
                </div>

                {/* 2b. Criar uma subpasta nela */}
                <form onSubmit={criarESalvar} className="space-y-3">
                    <div>
                        <label htmlFor="nome-pasta-drive" className={labelClass}>
                            Criar pasta nova dentro de {nomePasta}
                        </label>
                        <input
                            id="nome-pasta-drive"
                            ref={campoNome}
                            type="text"
                            value={nome}
                            disabled={ocupado}
                            onChange={(e) => {
                                setNome(e.target.value);
                                if (erro) setErro(null);
                            }}
                            maxLength={200}
                            autoComplete="off"
                            className="field"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={ocupado}
                        className="inline-flex min-h-11 w-full items-center justify-center gap-2 border border-ink/35 bg-card px-4 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-ink/5 disabled:opacity-60"
                    >
                        {girando("criar") ? (
                            <Loader2 aria-hidden className="size-4 animate-spin" />
                        ) : (
                            <FolderPlus aria-hidden className="size-4" />
                        )}
                        {girando("criar") ? "Criando e salvando…" : "Criar pasta e salvar"}
                    </button>
                </form>

                {erro && (
                    <p role="alert" className="mt-4 border-t-2 border-destructive pt-2 text-sm font-medium text-destructive">
                        {erro}
                    </p>
                )}

                <div className="flex justify-end pt-5">
                    <button
                        type="button"
                        onClick={onFechar}
                        disabled={ocupado}
                        className="inline-flex min-h-11 items-center border border-ink/35 px-4 text-sm font-semibold text-ink hover:bg-ink/5 disabled:opacity-60"
                    >
                        Cancelar
                    </button>
                </div>
        </ModalDialog>
    );
};
