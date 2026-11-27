import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import {
    AlertTriangle,
    ChevronRight,
    Check,
    ImagePlus,
    Loader2,
    LogOut,
    MessageCircle,
    PenTool,
    Plug,
    Trash2,
    UserRoundCog,
    X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ConteudoConectorMcp } from "@/components/juros/ModalConectorMcp";
import { IconeGoogleDrive } from "@/components/juros/IconeGoogleDrive";
import { QuadroAssinatura } from "@/components/juros/QuadroAssinatura";
import {
    cidadeAssinatura,
    definirConfigEscritorio,
    formatarOab,
    normalizarConfigEscritorio,
    type ConfigEscritorio,
} from "@/lib/config-escritorio";
import { useConfigEscritorio } from "@/lib/use-config-escritorio";
import { dataPorExtenso } from "@/lib/documentos";
import { prepararImagemAssinatura, prepararImagemTimbradoA4 } from "@/lib/timbrado-imagem";
import {
    alterarSenha,
    obterConfigEscritorio,
    obterMeuAvisoAtendimento,
    obterModelosAtendimento,
    salvarConfigEscritorio,
    salvarMeuAvisoAtendimento,
    salvarModelosAtendimento,
} from "@/lib/revisional-db";
import {
    MODELO_EXTRACAO_PADRAO,
    MODELO_RESPOSTA_PADRAO,
    MODELOS_ATENDIMENTO,
    modeloPermitido,
} from "@/lib/atendimento/modelos";
import { chamarAtendimento } from "@/lib/atendimento/api-cliente";
import { normalizarTelefone, telefoneLegivel } from "@/lib/atendimento/telefone";
import {
    ErroGoogleDrive,
    GOOGLE_DRIVE_CONFIGURADO,
    desconectarContaDrive,
    trocarContaDrive,
} from "@/lib/google-drive";
import { useContaDrive } from "@/lib/use-conta-drive";
import { useTravarRolagem } from "@/lib/use-travar-rolagem";

const UFS = [
    "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR",
    "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

export type AbaConfiguracoes = "perfil" | "conta" | "fases" | "integracoes";

const ABAS: Array<{ id: AbaConfiguracoes; rotulo: string }> = [
    { id: "perfil", rotulo: "Perfil e OAB" },
    { id: "conta", rotulo: "Conta e senha" },
    { id: "fases", rotulo: "Fases e categorias" },
    { id: "integracoes", rotulo: "Integrações" },
];

/** Uma folha por aba: linhas separadas por filete, título e explicação à esquerda, campos à direita. */
function Folha({ children, aviso, rodape }: { children: ReactNode; aviso?: ReactNode; rodape?: ReactNode }) {
    return (
        <section className="border border-ink/15 bg-card">
            {aviso}
            <div className="divide-y divide-ink/10">{children}</div>
            {rodape && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/15 bg-secondary/40 px-5 py-3">
                    {rodape}
                </div>
            )}
        </section>
    );
}

function Linha({
    titulo,
    descricao,
    children,
    idRotulo,
}: {
    titulo: string;
    descricao?: ReactNode;
    children: ReactNode;
    /** id do campo principal: o título vira o rótulo dele. */
    idRotulo?: string;
}) {
    const Titulo = idRotulo ? "label" : "h3";
    return (
        <div className="grid gap-x-10 gap-y-3 px-5 py-5 md:grid-cols-[15rem_minmax(0,1fr)]">
            <div>
                <Titulo {...(idRotulo ? { htmlFor: idRotulo } : {})} className="sys-section block text-ink">
                    {titulo}
                </Titulo>
                {descricao && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{descricao}</p>}
            </div>
            <div className="min-w-0">{children}</div>
        </div>
    );
}

const classeCampo = "field py-1.5 text-sm";
const classeBotaoPrimario =
    "inline-flex h-9 items-center gap-1.5 bg-gold px-4 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-gold-light disabled:pointer-events-none disabled:opacity-45";
const classeBotaoContorno =
    "inline-flex h-8 items-center gap-1.5 border border-ink/25 bg-card px-3 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-ink/5 disabled:opacity-50";

/* ------------------------------------------------------- Perfil e OAB */

function AbaPerfil() {
    const salvo = useConfigEscritorio();
    const [form, setForm] = useState<ConfigEscritorio>(salvo);
    const [salvando, setSalvando] = useState(false);
    const [processandoTimbrado, setProcessandoTimbrado] = useState(false);
    const [processandoAssinatura, setProcessandoAssinatura] = useState(false);
    const [desenhandoAssinatura, setDesenhandoAssinatura] = useState(false);
    const [semTabela, setSemTabela] = useState(false);
    const inputTimbradoRef = useRef<HTMLInputElement>(null);
    const inputAssinaturaRef = useRef<HTMLInputElement>(null);

    const selecionarImagemTimbrado = async (arquivo?: File) => {
        if (!arquivo) return;
        setProcessandoTimbrado(true);
        try {
            const dataUrl = await prepararImagemTimbradoA4(arquivo);
            setForm((f) => ({ ...f, timbradoImagemUrl: dataUrl }));
            toast.info("Imagem carregada. Clique em “Salvar alterações” para aplicar em todos os documentos.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Não foi possível ler a imagem.");
        } finally {
            setProcessandoTimbrado(false);
            if (inputTimbradoRef.current) inputTimbradoRef.current.value = "";
        }
    };

    const selecionarImagemAssinatura = async (arquivo?: File) => {
        if (!arquivo) return;
        setProcessandoAssinatura(true);
        try {
            const dataUrl = await prepararImagemAssinatura(arquivo);
            setForm((f) => ({ ...f, assinaturaImagemUrl: dataUrl }));
            setDesenhandoAssinatura(false);
            toast.info("Rubrica carregada. Clique em “Salvar alterações” para aplicar.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Não foi possível ler a imagem da rubrica.");
        } finally {
            setProcessandoAssinatura(false);
            if (inputAssinaturaRef.current) inputAssinaturaRef.current.value = "";
        }
    };

    // Busca a versão mais nova do banco ao abrir a aba.
    useEffect(() => {
        let ativo = true;
        void obterConfigEscritorio()
            .then((c) => {
                if (!ativo) return;
                if (c) {
                    definirConfigEscritorio(c);
                    setForm(c);
                } else {
                    setSemTabela(true);
                }
            })
            .catch(() => undefined);
        return () => {
            ativo = false;
        };
    }, []);

    const alterado = JSON.stringify(normalizarConfigEscritorio(form)) !== JSON.stringify(salvo);
    const oabValida = /^\d{3,10}$/.test(form.oabNumero.replace(/\D+/g, ""));
    const previa = normalizarConfigEscritorio(form);

    const salvar = async (e: FormEvent) => {
        e.preventDefault();
        if (!form.nomeAdvogado.trim()) {
            toast.error("Informe o nome do advogado.");
            return;
        }
        if (!oabValida) {
            toast.error("Informe o número da OAB (só números).");
            return;
        }
        setSalvando(true);
        try {
            const novo = await salvarConfigEscritorio(normalizarConfigEscritorio(form));
            definirConfigEscritorio(novo);
            setForm(novo);
            setSemTabela(false);
            toast.success("Dados do escritório salvos.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
        } finally {
            setSalvando(false);
        }
    };

    return (
        <form onSubmit={salvar}>
            <Folha
                aviso={
                    semTabela && (
                        <p className="flex items-start gap-2 border-b border-gold/40 bg-gold/10 px-5 py-2.5 text-xs text-ink">
                            <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0 text-gold-deep" />
                            Este banco ainda não tem a tabela de configurações (migração 20261120150000). Os valores abaixo
                            são os padrões e só poderão ser salvos depois da migração.
                        </p>
                    )
                }
                rodape={
                    <>
                        <span
                            aria-live="polite"
                            className={cn(
                                "inline-flex items-center gap-1.5 text-xs font-medium",
                                alterado ? "text-gold-deep" : "text-emerald-700",
                            )}
                        >
                            {alterado ? (
                                <>
                                    <span aria-hidden className="size-1.5 bg-gold" />
                                    Alterações não salvas
                                </>
                            ) : (
                                <>
                                    <Check aria-hidden className="size-3.5" />
                                    Tudo salvo
                                </>
                            )}
                        </span>
                        <span className="flex items-center gap-3">
                            {alterado && (
                                <button
                                    type="button"
                                    onClick={() => setForm(salvo)}
                                    className="text-xs font-semibold text-muted-foreground transition-colors duration-150 hover:text-ink"
                                >
                                    Desfazer
                                </button>
                            )}
                            <button type="submit" disabled={salvando || !alterado} className={classeBotaoPrimario}>
                                {salvando && <Loader2 className="size-4 animate-spin" />}
                                Salvar alterações
                            </button>
                        </span>
                    </>
                }
            >
                <Linha titulo="Advogado" descricao="Nome completo, como assina nas petições." idRotulo="cfg-nome">
                    <input
                        id="cfg-nome"
                        value={form.nomeAdvogado}
                        onChange={(e) => setForm((f) => ({ ...f, nomeAdvogado: e.target.value }))}
                        maxLength={200}
                        required
                        autoComplete="name"
                        className={cn(classeCampo, "max-w-md")}
                    />
                </Linha>

                <Linha
                    titulo="Inscrição na OAB"
                    descricao="O Radar DJEN e a verificação automática procuram as publicações desta inscrição."
                >
                    <div className="grid max-w-xs grid-cols-[minmax(0,1fr)_5.5rem] gap-4">
                        <div>
                            <label htmlFor="cfg-oab" className="sys-label block">
                                Número
                            </label>
                            <input
                                id="cfg-oab"
                                inputMode="numeric"
                                value={form.oabNumero}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, oabNumero: e.target.value.replace(/\D+/g, "").slice(0, 10) }))
                                }
                                aria-invalid={!oabValida}
                                className={cn(classeCampo, "tabular-nums")}
                            />
                        </div>
                        <div>
                            <label htmlFor="cfg-oab-uf" className="sys-label block">
                                Seccional
                            </label>
                            <select
                                id="cfg-oab-uf"
                                value={form.oabUf}
                                onChange={(e) => setForm((f) => ({ ...f, oabUf: e.target.value }))}
                                className={classeCampo}
                            >
                                {UFS.map((uf) => (
                                    <option key={uf} value={uf}>
                                        {uf}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    {!oabValida && (
                        <p className="mt-1.5 text-[11px] font-medium text-destructive">Informe o número da OAB, só números.</p>
                    )}
                </Linha>

                <Linha titulo="Cidade do escritório" descricao="Vai no local e data do fim da petição.">
                    <div className="grid max-w-xs grid-cols-[minmax(0,1fr)_5.5rem] gap-4">
                        <div>
                            <label htmlFor="cfg-cidade" className="sys-label block">
                                Cidade
                            </label>
                            <input
                                id="cfg-cidade"
                                value={form.cidade}
                                onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))}
                                maxLength={100}
                                className={classeCampo}
                            />
                        </div>
                        <div>
                            <label htmlFor="cfg-uf" className="sys-label block">
                                UF
                            </label>
                            <select
                                id="cfg-uf"
                                value={form.uf}
                                onChange={(e) => setForm((f) => ({ ...f, uf: e.target.value }))}
                                className={classeCampo}
                            >
                                {UFS.map((uf) => (
                                    <option key={uf} value={uf}>
                                        {uf}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </Linha>

                <Linha
                    titulo="Papel timbrado (A4)"
                    descricao="Importe a imagem A4 do seu papel timbrado (PNG, JPG ou WebP). Ela aparece no fundo de todas as folhas em Documentos, no PDF e no Word."
                >
                    <div className="flex flex-wrap items-start gap-4">
                        <div className="relative h-36 w-[6.35rem] shrink-0 overflow-hidden border border-ink/20 bg-white shadow-sm">
                            {form.timbradoImagemUrl ? (
                                <img
                                    src={form.timbradoImagemUrl}
                                    alt="Prévia do papel timbrado A4"
                                    className="size-full object-fill"
                                />
                            ) : (
                                <div className="flex size-full flex-col justify-between p-2 text-center">
                                    <div className="border-b border-[#061237] pb-1">
                                        <div className="text-[7px] font-bold tracking-wider text-[#061237]">IAN GRANJA</div>
                                        <div className="text-[5px] tracking-[0.25em] text-[#8b6d3b]">ADVOGADOS</div>
                                    </div>
                                    <span className="text-[9px] text-muted-foreground">Padrão</span>
                                    <div className="border-t border-[#b6a182] pt-1 text-[5px] text-muted-foreground">
                                        {cidadeAssinatura(previa)}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="space-y-2.5">
                            <input
                                id="input-timbrado-config"
                                ref={inputTimbradoRef}
                                type="file"
                                accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                                className="sr-only"
                                disabled={processandoTimbrado}
                                onChange={(e) => void selecionarImagemTimbrado(e.target.files?.[0])}
                            />
                            <div className="flex flex-wrap items-center gap-2">
                                <label
                                    htmlFor="input-timbrado-config"
                                    className={cn(
                                        classeBotaoContorno,
                                        "cursor-pointer",
                                        processandoTimbrado && "pointer-events-none opacity-50",
                                    )}
                                >
                                    {processandoTimbrado ? (
                                        <Loader2 aria-hidden className="size-3.5 animate-spin" />
                                    ) : (
                                        <ImagePlus aria-hidden className="size-3.5 text-gold-deep" />
                                    )}
                                    {form.timbradoImagemUrl ? "Trocar imagem A4" : "Importar timbrado A4"}
                                </label>
                                {form.timbradoImagemUrl && (
                                    <button
                                        type="button"
                                        onClick={() => setForm((f) => ({ ...f, timbradoImagemUrl: "" }))}
                                        className="inline-flex h-8 items-center gap-1.5 border border-ink/20 px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                                    >
                                        <Trash2 aria-hidden className="size-3.5" />
                                        Usar padrão
                                    </button>
                                )}
                            </div>
                            <p className="max-w-sm text-[11px] leading-relaxed text-muted-foreground">
                                {form.timbradoImagemUrl
                                    ? "Timbrado próprio carregado. Você pode ativar ou desativar folha por folha no botão “Timbrado” do editor."
                                    : "Envie sua arte em proporção A4 (21 × 29,7 cm), em PNG ou JPG. O sistema otimiza automaticamente para manter nitidez na impressão."}
                            </p>
                        </div>
                    </div>
                </Linha>

                <Linha
                    titulo="Assinatura do advogado (rubrica)"
                    descricao="Opcional. Desenhe ou importe sua assinatura (PNG transparente, JPG ou WebP) para aparecer no bloco [assinatura] e no carimbo do PDF."
                >
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex h-20 w-52 shrink-0 items-center justify-center overflow-hidden border border-ink/15 bg-white p-2">
                                {form.assinaturaImagemUrl ? (
                                    <img
                                        src={form.assinaturaImagemUrl}
                                        alt="Prévia da rubrica do advogado"
                                        className="max-h-full max-w-full object-contain"
                                    />
                                ) : (
                                    <span className="text-[11px] text-muted-foreground">Sem rubrica cadastrada</span>
                                )}
                            </div>
                            <div className="space-y-2">
                                <input
                                    id="input-assinatura-config"
                                    ref={inputAssinaturaRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                                    className="sr-only"
                                    disabled={processandoAssinatura}
                                    onChange={(e) => void selecionarImagemAssinatura(e.target.files?.[0])}
                                />
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setDesenhandoAssinatura((v) => !v)}
                                        className={classeBotaoContorno}
                                    >
                                        <PenTool aria-hidden className="size-3.5 text-gold-deep" />
                                        {desenhandoAssinatura ? "Fechar quadro" : "Desenhar rubrica"}
                                    </button>
                                    <label
                                        htmlFor="input-assinatura-config"
                                        className={cn(
                                            classeBotaoContorno,
                                            "cursor-pointer",
                                            processandoAssinatura && "pointer-events-none opacity-50",
                                        )}
                                    >
                                        {processandoAssinatura ? (
                                            <Loader2 aria-hidden className="size-3.5 animate-spin" />
                                        ) : (
                                            <ImagePlus aria-hidden className="size-3.5 text-gold-deep" />
                                        )}
                                        Importar imagem
                                    </label>
                                    {form.assinaturaImagemUrl && (
                                        <button
                                            type="button"
                                            onClick={() => setForm((f) => ({ ...f, assinaturaImagemUrl: "" }))}
                                            className="inline-flex h-8 items-center gap-1.5 border border-ink/20 px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                                        >
                                            <Trash2 aria-hidden className="size-3.5" />
                                            Remover
                                        </button>
                                    )}
                                </div>
                                <p className="max-w-sm text-[11px] text-muted-foreground">
                                    Você também pode gerenciar a rubrica e assinar com certificado ICP-Brasil (A1/A3) direto pelo editor de Documentos.
                                </p>
                            </div>
                        </div>
                        {desenhandoAssinatura && (
                            <QuadroAssinatura
                                className="max-w-md"
                                onCancelar={() => setDesenhandoAssinatura(false)}
                                onConfirmar={(png) => {
                                    setForm((f) => ({ ...f, assinaturaImagemUrl: png }));
                                    setDesenhandoAssinatura(false);
                                    toast.info("Rubrica desenhada. Clique em “Salvar alterações” para gravar.");
                                }}
                            />
                        )}
                    </div>
                </Linha>

                <Linha
                    titulo="Prévia na petição"
                    descricao={
                        <>
                            Fim do documento com os campos <span className="text-ink">[cidade]</span>,{" "}
                            <span className="text-ink">[advogado]</span>, <span className="text-ink">[oab]</span> e{" "}
                            <span className="text-ink">[assinatura]</span>.
                        </>
                    }
                >
                    <div className="max-w-md border border-ink/10 bg-white px-6 py-5 text-center font-serif text-[13px] leading-relaxed text-black">
                        <p>
                            {cidadeAssinatura(previa)}, {dataPorExtenso(new Date())}.
                        </p>
                        {previa.assinaturaImagemUrl ? (
                            <img
                                src={previa.assinaturaImagemUrl}
                                alt="Rubrica"
                                className="mx-auto mt-3 max-h-14 max-w-[200px] object-contain"
                            />
                        ) : (
                            <div className="h-6" />
                        )}
                        <div className="mx-auto mb-1.5 w-56 border-t border-black" />
                        <p className="font-bold">{previa.nomeAdvogado}</p>
                        <p>{formatarOab(previa)}</p>
                    </div>
                </Linha>
            </Folha>
        </form>
    );
}

/* ------------------------------------------------------- Conta e senha */

function AbaConta({ userEmail, onSair }: { userEmail: string; onSair: () => void }) {
    const [novaSenha, setNovaSenha] = useState("");
    const [confirmacao, setConfirmacao] = useState("");
    const [erro, setErro] = useState<string | null>(null);
    const [salvando, setSalvando] = useState(false);

    const salvar = async (e: FormEvent) => {
        e.preventDefault();
        if (novaSenha.length < 8) {
            setErro("A nova senha precisa ter pelo menos 8 caracteres.");
            return;
        }
        if (novaSenha !== confirmacao) {
            setErro("As duas senhas digitadas não conferem.");
            return;
        }
        setErro(null);
        setSalvando(true);
        try {
            await alterarSenha(novaSenha);
            setNovaSenha("");
            setConfirmacao("");
            toast.success("Senha atualizada.");
        } catch (err) {
            setErro(err instanceof Error ? err.message : "Não foi possível atualizar a senha.");
        } finally {
            setSalvando(false);
        }
    };

    return (
        <Folha>
            <Linha titulo="E-mail de acesso" descricao="Só e-mails autorizados pelo escritório entram no sistema.">
                <p className="truncate pt-0.5 text-sm font-medium text-ink" title={userEmail}>
                    {userEmail}
                </p>
            </Linha>

            <Linha titulo="Senha" descricao="Pelo menos 8 caracteres. Vale para o próximo acesso em qualquer aparelho.">
                <form onSubmit={salvar} className="max-w-xs space-y-4">
                    {/* Campo de usuário escondido: ajuda o gerenciador de senhas a salvar no lugar certo. */}
                    <input type="email" name="username" autoComplete="username" value={userEmail} readOnly hidden />
                    <div>
                        <label htmlFor="cfg-senha" className="sys-label block">
                            Nova senha
                        </label>
                        <input
                            id="cfg-senha"
                            type="password"
                            autoComplete="new-password"
                            value={novaSenha}
                            onChange={(e) => setNovaSenha(e.target.value)}
                            className={classeCampo}
                        />
                    </div>
                    <div>
                        <label htmlFor="cfg-senha2" className="sys-label block">
                            Confirme a nova senha
                        </label>
                        <input
                            id="cfg-senha2"
                            type="password"
                            autoComplete="new-password"
                            value={confirmacao}
                            onChange={(e) => setConfirmacao(e.target.value)}
                            className={classeCampo}
                        />
                    </div>
                    {erro && (
                        <p role="alert" className="text-xs font-medium text-destructive">
                            {erro}
                        </p>
                    )}
                    <button type="submit" disabled={salvando || !novaSenha || !confirmacao} className={classeBotaoPrimario}>
                        {salvando && <Loader2 className="size-4 animate-spin" />}
                        Trocar senha
                    </button>
                </form>
            </Linha>

            <Linha titulo="Sair" descricao="Encerra a sessão neste navegador.">
                <button type="button" onClick={onSair} className={classeBotaoContorno}>
                    <LogOut className="size-3.5" />
                    Sair do sistema
                </button>
            </Linha>
        </Folha>
    );
}

/* ------------------------------------------------------- Integrações */

function ControleGoogleDrive() {
    const conta = useContaDrive();
    const [ocupado, setOcupado] = useState(false);

    const conectar = async () => {
        setOcupado(true);
        try {
            const nova = await trocarContaDrive();
            if (nova) toast.success(`Google Drive conectado como ${nova}.`);
        } catch (e) {
            if (!(e instanceof ErroGoogleDrive && e.codigo === "cancelado")) {
                toast.error(e instanceof Error ? e.message : "Não foi possível conectar o Google Drive.");
            }
        } finally {
            setOcupado(false);
        }
    };

    if (!GOOGLE_DRIVE_CONFIGURADO) {
        return <p className="pt-0.5 text-sm text-muted-foreground">Não configurado neste ambiente.</p>;
    }

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-ink/15 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
                <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                        <span aria-hidden className={cn("size-1.5", conta ? "bg-emerald-700" : "bg-ink/30")} />
                        {conta ? "Conectado" : "Não conectado"}
                    </p>
                    {conta && <p className="truncate text-xs text-muted-foreground">{conta}</p>}
                </div>
            </div>
            <div className="flex items-center gap-1">
                <button type="button" disabled={ocupado} onClick={() => void conectar()} className={classeBotaoContorno}>
                    {ocupado ? <Loader2 className="size-3.5 animate-spin" /> : <UserRoundCog className="size-3.5" />}
                    {conta ? "Trocar conta" : "Conectar"}
                </button>
                {conta && (
                    <button
                        type="button"
                        onClick={() =>
                            void desconectarContaDrive().then(() => toast.success("Google Drive desconectado deste navegador."))
                        }
                        className="inline-flex h-8 items-center px-2 text-xs font-semibold text-muted-foreground transition-colors duration-150 hover:text-destructive"
                    >
                        Desconectar
                    </button>
                )}
            </div>
        </div>
    );
}

/* ------------------------------------------------------- WhatsApp */

function useStatusWhatsApp() {
    const [status, setStatus] = useState<{ configurado: boolean; avisoPorWhatsApp: boolean } | null>(null);
    useEffect(() => {
        let ativo = true;
        void chamarAtendimento<{ configurado: boolean; avisoPorWhatsApp: boolean }>({ acao: "status_whatsapp" })
            .then((s) => ativo && setStatus({ configurado: s.configurado, avisoPorWhatsApp: s.avisoPorWhatsApp }))
            .catch(() => ativo && setStatus({ configurado: false, avisoPorWhatsApp: false }));
        return () => {
            ativo = false;
        };
    }, []);
    return status;
}

const VARIAVEIS_WHATSAPP: Array<[string, string]> = [
    ["YCLOUD_API_KEY", "Chave da API criada no painel da YCloud."],
    ["YCLOUD_WEBHOOK_SECRET", "Segredo do webhook (começa com whsec_), mostrado ao cadastrar o endereço abaixo."],
    ["WHATSAPP_NUMERO_ESCRITORIO", "Número do WhatsApp do escritório com DDD, ex.: (81) 3000-0000."],
    ["SUPABASE_SERVICE_ROLE_KEY", "Chave service role do Supabase: o webhook grava as mensagens sem usuário logado."],
    ["WHATSAPP_TEMPLATE_AVISO", "Opcional: nome do template aprovado para avisar o advogado ({{1}} = cliente, {{2}} = mensagem)."],
];

const EVENTOS_YCLOUD = ["whatsapp.inbound_message.received", "whatsapp.smb.message.echoes", "whatsapp.message.updated"];

/** Modelo de IA do atendimento: vale para o escritório todo. */
function EscolhaModeloIa() {
    const [carregado, setCarregado] = useState(false);
    const [erro, setErro] = useState("");
    const [resposta, setResposta] = useState(MODELO_RESPOSTA_PADRAO);
    const [extracao, setExtracao] = useState(MODELO_EXTRACAO_PADRAO);
    const [salvando, setSalvando] = useState(false);

    useEffect(() => {
        void obterModelosAtendimento()
            .then((m) => {
                if (modeloPermitido(m.resposta)) setResposta(m.resposta);
                if (modeloPermitido(m.extracao)) setExtracao(m.extracao);
            })
            .catch((err) => setErro((err as Error).message))
            .finally(() => setCarregado(true));
    }, []);

    const salvar = async (e: FormEvent) => {
        e.preventDefault();
        setSalvando(true);
        try {
            await salvarModelosAtendimento({ resposta, extracao });
            toast.success("Modelo de IA salvo para o escritório.");
        } catch (err) {
            toast.error((err as Error).message);
        } finally {
            setSalvando(false);
        }
    };

    const campo = (
        id: string,
        rotulo: string,
        ajuda: string,
        valor: string,
        setValor: (v: string) => void,
        custo: (m: (typeof MODELOS_ATENDIMENTO)[number]) => string,
        padrao: string,
    ) => (
        <div className="space-y-1">
            <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
                {rotulo}
            </label>
            <select
                id={id}
                value={valor}
                disabled={!carregado || Boolean(erro)}
                onChange={(e) => setValor(e.target.value)}
                className={cn(classeCampo, "w-full")}
            >
                {MODELOS_ATENDIMENTO.map((m) => (
                    <option key={m.id} value={m.id}>
                        {m.nome} · {custo(m)}
                        {m.id === padrao ? " (recomendado)" : ""}
                    </option>
                ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
                {MODELOS_ATENDIMENTO.find((m) => m.id === valor)?.resumo} {ajuda}
            </p>
        </div>
    );

    return (
        <form onSubmit={(e) => void salvar(e)} className="space-y-3">
            <div>
                <h3 className="sys-section text-ink">Modelo de IA</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    Vale para o escritório todo: WhatsApp, simulador e leitura de documentos. A trava contra resposta
                    inventada e a sua aprovação continuam valendo com qualquer modelo.
                </p>
            </div>
            {erro ? (
                <p className="text-xs text-destructive">{erro}</p>
            ) : (
                <>
                    {campo(
                        "modelo-resposta",
                        "Rascunhos de resposta",
                        "Custo por 1.000 rascunhos.",
                        resposta,
                        setResposta,
                        (m) => `${m.custoMilRascunhos} / mil`,
                        MODELO_RESPOSTA_PADRAO,
                    )}
                    {campo(
                        "modelo-extracao",
                        "Leitura de documentos (PDF e foto)",
                        "Custo por documento de ~20 páginas.",
                        extracao,
                        setExtracao,
                        (m) => `${m.custoDocumento} / doc`,
                        MODELO_EXTRACAO_PADRAO,
                    )}
                    <button type="submit" disabled={!carregado || salvando} className={classeBotaoPrimario}>
                        {salvando ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                        Salvar modelo
                    </button>
                </>
            )}
        </form>
    );
}

function ControleWhatsApp() {
    const status = useStatusWhatsApp();
    const [carregado, setCarregado] = useState(false);
    const [avisar, setAvisar] = useState(false);
    const [telefone, setTelefone] = useState("");
    const [salvando, setSalvando] = useState(false);
    const [erroCarregar, setErroCarregar] = useState("");

    useEffect(() => {
        void obterMeuAvisoAtendimento()
            .then((a) => {
                setAvisar(a.avisar_whatsapp);
                setTelefone(a.telefone ? telefoneLegivel(a.telefone) : "");
            })
            .catch((err) => setErroCarregar((err as Error).message))
            .finally(() => setCarregado(true));
    }, []);

    const digitos = normalizarTelefone(telefone);
    const telefoneValido = digitos.length >= 12 && digitos.length <= 15;

    const salvar = async (e: FormEvent) => {
        e.preventDefault();
        if (avisar && !telefoneValido) {
            toast.error("Informe o seu celular com DDD, ex.: (81) 98765-4321.");
            return;
        }
        setSalvando(true);
        try {
            await salvarMeuAvisoAtendimento({ avisar_whatsapp: avisar, telefone: telefoneValido ? digitos : "" });
            toast.success(avisar ? "Pronto: você vai ser avisado no WhatsApp." : "Aviso pelo WhatsApp desligado.");
        } catch (err) {
            toast.error((err as Error).message);
        } finally {
            setSalvando(false);
        }
    };

    const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/whatsapp-webhook` : "/api/whatsapp-webhook";

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 border border-ink/15 p-3 text-sm">
                <span aria-hidden className={cn("size-1.5 shrink-0", status?.configurado ? "bg-emerald-700" : "bg-ink/30")} />
                <span className="text-ink">
                    {status === null
                        ? "Verificando…"
                        : status.configurado
                          ? "Número do escritório ligado. As mensagens chegam no menu Atendimento."
                          : "Ainda não configurado no servidor."}
                </span>
            </div>

            <EscolhaModeloIa />

            <form onSubmit={(e) => void salvar(e)} className="space-y-3 border-t border-ink/10 pt-5">
                <div>
                    <h3 className="sys-section text-ink">Como eu quero ser avisado</h3>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        Toda mensagem nova aparece no menu <strong className="text-ink">Atendimento</strong>, com contador.
                        Se quiser, receba também um aviso no seu WhatsApp pessoal. Vale só para a sua conta.
                    </p>
                </div>
                {erroCarregar ? (
                    <p className="text-xs text-destructive">{erroCarregar}</p>
                ) : (
                    <>
                        <label className="flex items-center gap-2 text-sm text-ink">
                            <input
                                type="checkbox"
                                checked={avisar}
                                disabled={!carregado}
                                onChange={(e) => setAvisar(e.target.checked)}
                            />
                            Me avisar no meu WhatsApp quando um cliente mandar mensagem
                        </label>
                        <div className="max-w-xs space-y-1">
                            <label htmlFor="aviso-telefone" className="text-xs font-medium text-muted-foreground">
                                Meu celular
                            </label>
                            <input
                                id="aviso-telefone"
                                inputMode="tel"
                                autoComplete="tel"
                                value={telefone}
                                disabled={!carregado}
                                onChange={(e) => setTelefone(e.target.value)}
                                placeholder="(81) 98765-4321"
                                className={classeCampo}
                            />
                        </div>
                        {avisar && status && !status.avisoPorWhatsApp && (
                            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0 text-gold-deep" />
                                O aviso no WhatsApp só sai depois que o template de aviso for aprovado na Meta
                                (WHATSAPP_TEMPLATE_AVISO). Até lá, use o menu Atendimento.
                            </p>
                        )}
                        <button type="submit" disabled={!carregado || salvando} className={classeBotaoPrimario}>
                            {salvando ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                            Salvar meu aviso
                        </button>
                    </>
                )}
            </form>

            <details className="group border-t border-ink/10 pt-4">
                <summary className="cursor-pointer text-sm font-semibold text-ink">Como ligar o número do escritório</summary>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    O número continua no WhatsApp Business do celular (coexistência) e passa também pelo sistema, via
                    YCloud (parceira oficial da Meta, plano grátis).
                </p>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs leading-relaxed text-muted-foreground">
                    <li>
                        Crie a conta em ycloud.com e conecte o WhatsApp Business do escritório pela opção de coexistência
                        (“WhatsApp Business App”), escaneando o QR code com o celular do escritório.
                    </li>
                    <li>
                        No painel da YCloud, crie uma chave de API e cadastre o webhook{" "}
                        <code className="break-all bg-secondary px-1 py-0.5 text-[11px] text-ink">{webhookUrl}</code> com os
                        eventos{" "}
                        {EVENTOS_YCLOUD.map((ev, i) => (
                            <span key={ev}>
                                <code className="bg-secondary px-1 py-0.5 text-[11px] text-ink">{ev}</code>
                                {i < EVENTOS_YCLOUD.length - 1 ? ", " : "."}
                            </span>
                        ))}
                    </li>
                    <li>
                        Na Vercel (Settings → Environment Variables), cadastre:
                        <ul className="mt-1.5 space-y-1">
                            {VARIAVEIS_WHATSAPP.map(([nome, desc]) => (
                                <li key={nome}>
                                    <code className="bg-secondary px-1 py-0.5 text-[11px] text-ink">{nome}</code> {desc}
                                </li>
                            ))}
                        </ul>
                    </li>
                    <li>
                        Abra o WhatsApp Business do celular pelo menos a cada 13 dias: sem isso a Meta desliga a
                        coexistência.
                    </li>
                    <li>
                        Confira se o telefone dos clientes está no cadastro: é por ele que o sistema reconhece quem está
                        escrevendo. Números desconhecidos chegam como “Sem cadastro” e você liga ao cliente na conversa.
                    </li>
                </ol>
            </details>
        </div>
    );
}

type IdIntegracao = "claude" | "drive" | "whatsapp";

const INTEGRACOES: Array<{ id: IdIntegracao; nome: string; resumo: string; descricao: string }> = [
    {
        id: "claude",
        nome: "Claude",
        resumo: "Conector MCP para operar o sistema pela conversa.",
        descricao:
            "Mande o contrato em PDF ou foto no Claude e ele calcula, cadastra o cliente, renova cálculos, muda fases e consulta a carteira.",
    },
    {
        id: "whatsapp",
        nome: "WhatsApp",
        resumo: "Mensagens dos clientes com resposta preparada pela IA.",
        descricao:
            "A IA lê a base do cliente e deixa um rascunho; o escritório revisa e clica em Enviar. Nada sai sem aprovação.",
    },
    {
        id: "drive",
        nome: "Google Drive",
        resumo: "Buscar contratos e salvar laudos numa pasta.",
        descricao:
            "O sistema só enxerga os arquivos que você escolhe ou os que ele mesmo cria. A conta fica conectada só neste navegador.",
    },
];

function IconeIntegracao({ id, className }: { id: IdIntegracao; className?: string }) {
    if (id === "whatsapp") return <MessageCircle aria-hidden className={cn("text-ink", className)} strokeWidth={1.85} />;
    return id === "drive" ? (
        <IconeGoogleDrive className={className} />
    ) : (
        <Plug aria-hidden className={cn("text-ink", className)} strokeWidth={1.85} />
    );
}

/** Painel que desliza da direita com a página da integração (mesmo padrão do painel de tarefas). */
function PainelIntegracao({ id, onFechar }: { id: IdIntegracao | null; onFechar: () => void }) {
    useTravarRolagem(Boolean(id));
    const fecharRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!id) return;
        const anterior = document.activeElement as HTMLElement | null;
        fecharRef.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onFechar();
        };
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("keydown", onKey);
            anterior?.focus?.();
        };
    }, [id, onFechar]);

    const item = INTEGRACOES.find((i) => i.id === id);
    if (!item) return null;

    return createPortal(
        <div role="dialog" aria-modal="true" aria-labelledby="titulo-integracao" className="fixed inset-0 z-50 flex justify-end">
            <div aria-hidden onClick={onFechar} className="fixed inset-0 bg-ink-deep/45" />
            <div className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-ink/20 bg-card shadow-2xl">
                <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-ink/15 px-5">
                    <h2 id="titulo-integracao" className="sys-title flex items-center gap-2.5 text-ink">
                        <IconeIntegracao id={item.id} className="size-5 shrink-0" />
                        {item.nome}
                    </h2>
                    <button
                        ref={fecharRef}
                        type="button"
                        onClick={onFechar}
                        aria-label="Fechar"
                        className="inline-flex size-8 items-center justify-center text-muted-foreground transition-colors duration-150 hover:text-ink"
                    >
                        <X className="size-4" />
                    </button>
                </div>
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-5">
                    <p className="text-sm leading-relaxed text-muted-foreground">{item.descricao}</p>
                    {item.id === "claude" ? (
                        <ConteudoConectorMcp semIntro />
                    ) : item.id === "whatsapp" ? (
                        <ControleWhatsApp />
                    ) : (
                        <ControleGoogleDrive />
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
}

function StatusWhatsAppCartao() {
    const status = useStatusWhatsApp();
    return (
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span aria-hidden className={cn("size-1.5 shrink-0", status?.configurado ? "bg-emerald-700" : "bg-ink/30")} />
            <span className="truncate">{status === null ? "…" : status.configurado ? "Conectado" : "Não configurado"}</span>
        </span>
    );
}

function StatusIntegracao({ id }: { id: IdIntegracao }) {
    const conta = useContaDrive();
    if (id === "whatsapp") return <StatusWhatsAppCartao />;
    if (id === "claude") {
        return <span className="text-xs text-muted-foreground">Ver como conectar</span>;
    }
    if (!GOOGLE_DRIVE_CONFIGURADO) {
        return <span className="text-xs text-muted-foreground">Não configurado</span>;
    }
    return (
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span aria-hidden className={cn("size-1.5 shrink-0", conta ? "bg-emerald-700" : "bg-ink/30")} />
            <span className="truncate">{conta ? `Conectado · ${conta}` : "Não conectado"}</span>
        </span>
    );
}

function AbaIntegracoes() {
    const [params, setParams] = useSearchParams();
    const aberta = params.get("integracao");
    const idAberto: IdIntegracao | null =
        aberta === "claude" || aberta === "drive" || aberta === "whatsapp" ? aberta : null;

    const abrir = (id: IdIntegracao | null) => {
        const p = new URLSearchParams(params);
        if (id) p.set("integracao", id);
        else p.delete("integracao");
        setParams(p, { replace: true });
    };

    return (
        <>
            <ul className="grid gap-4 sm:grid-cols-2">
                {INTEGRACOES.map((item) => (
                    <li key={item.id}>
                        <button
                            type="button"
                            onClick={() => abrir(item.id)}
                            aria-haspopup="dialog"
                            className="group flex h-full w-full items-start gap-3.5 border border-ink/15 bg-card p-5 text-left transition-colors duration-150 hover:border-ink/35 hover:bg-ink/[0.02]"
                        >
                            <IconeIntegracao id={item.id} className="mt-0.5 size-6 shrink-0" />
                            <span className="min-w-0 flex-1">
                                <span className="sys-section block text-ink">{item.nome}</span>
                                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                                    {item.resumo}
                                </span>
                                <span className="mt-3 block border-t border-ink/10 pt-2.5">
                                    <StatusIntegracao id={item.id} />
                                </span>
                            </span>
                            <ChevronRight
                                aria-hidden
                                className="mt-0.5 size-4 shrink-0 text-ink/35 transition-colors duration-150 group-hover:text-ink"
                            />
                        </button>
                    </li>
                ))}
            </ul>
            <PainelIntegracao id={idAberto} onFechar={() => abrir(null)} />
        </>
    );
}

/* ------------------------------------------------------- Página */

interface ConfiguracoesSistemaProps {
    userEmail: string;
    onSair: () => void;
    /** Conteúdo da aba Fases e categorias (o mesmo cadastro que existia na tela própria). */
    fasesECategorias: ReactNode;
}

export const ConfiguracoesSistema = ({ userEmail, onSair, fasesECategorias }: ConfiguracoesSistemaProps) => {
    const [params, setParams] = useSearchParams();
    const abaParam = params.get("aba");
    const aba: AbaConfiguracoes = ABAS.some((a) => a.id === abaParam) ? (abaParam as AbaConfiguracoes) : "perfil";
    const abasRef = useRef<HTMLDivElement>(null);

    // No celular as abas rolam de lado: a aba aberta fica sempre visível.
    useEffect(() => {
        abasRef.current
            ?.querySelector<HTMLElement>('[aria-selected="true"]')
            ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }, [aba]);

    return (
        <div className="max-w-5xl space-y-5">
            <div
                role="tablist"
                aria-label="Seções das configurações"
                ref={abasRef}
                className="flex gap-6 overflow-x-auto border-b border-ink/15 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
                {ABAS.map(({ id, rotulo }) => (
                    <button
                        key={id}
                        type="button"
                        role="tab"
                        id={`aba-config-${id}`}
                        aria-selected={aba === id}
                        aria-controls="painel-config"
                        onClick={() => setParams(id === "perfil" ? {} : { aba: id }, { replace: true })}
                        className={cn(
                            "-mb-px inline-flex h-10 shrink-0 items-center rounded-none border-b-2 text-sm font-semibold transition-colors duration-150",
                            aba === id ? "border-ink text-ink" : "border-transparent text-muted-foreground hover:text-ink",
                        )}
                    >
                        {rotulo}
                    </button>
                ))}
            </div>

            <div role="tabpanel" id="painel-config" aria-labelledby={`aba-config-${aba}`}>
                {aba === "perfil" && <AbaPerfil />}
                {aba === "conta" && <AbaConta userEmail={userEmail} onSair={onSair} />}
                {aba === "fases" && fasesECategorias}
                {aba === "integracoes" && <AbaIntegracoes />}
            </div>
        </div>
    );
};
