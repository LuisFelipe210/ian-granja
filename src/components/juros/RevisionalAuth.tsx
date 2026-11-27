import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, KeyRound, Loader2, Lock, X } from "lucide-react";
import { toast } from "sonner";
import { HeroArt } from "@/components/HeroArt";
import { labelClass } from "@/components/juros/Campos";
import { ModalDialog } from "@/components/juros/ModalDialog";
import {
    alterarSenha,
    entrarComSenha,
    solicitarRecuperacaoSenha,
    type RevisionalSession,
} from "@/lib/revisional-db";
import logo from "@/assets/logo2.png";

interface TelaLoginProps {
    onAutenticado: (session: RevisionalSession) => void;
}

export const TelaLogin = ({ onAutenticado }: TelaLoginProps) => {
    const [modo, setModo] = useState<"login" | "recuperar">("login");
    const [email, setEmail] = useState("");
    const [senha, setSenha] = useState("");
    const [mostrarSenha, setMostrarSenha] = useState(false);
    const [carregando, setCarregando] = useState(false);
    const [erro, setErro] = useState<string | null>(null);
    const [enviado, setEnviado] = useState(false);

    const submeterLogin = async (ev: FormEvent) => {
        ev.preventDefault();
        if (!email.trim() || !senha) {
            setErro("Informe o seu e-mail e a senha.");
            return;
        }
        setErro(null);
        setCarregando(true);
        try {
            const session = await entrarComSenha(email, senha);
            onAutenticado(session);
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível entrar agora.");
        } finally {
            setCarregando(false);
        }
    };

    const submeterRecuperacao = async (ev: FormEvent) => {
        ev.preventDefault();
        if (!email.trim()) {
            setErro("Informe o e-mail cadastrado do escritório.");
            return;
        }
        setErro(null);
        setCarregando(true);
        try {
            await solicitarRecuperacaoSenha(email);
            setEnviado(true);
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível enviar o e-mail de redefinição.");
        } finally {
            setCarregando(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col bg-ink text-paper">
            <header className="border-b border-paper/15">
                <div className="container flex h-16 items-center justify-between gap-6">
                    <Link to="/" aria-label="Ian Granja Advogados, página inicial">
                        <img src={logo} alt="Ian Granja Advogados" width={768} height={132} className="h-8 w-auto" />
                    </Link>
                    <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold-light">
                        <Lock aria-hidden className="size-3.5" />
                        Acesso interno
                    </p>
                </div>
            </header>

            <main className="container grid flex-1 items-center gap-x-16 gap-y-12 py-14 lg:grid-cols-12">
                <div className="lg:col-span-6 xl:col-span-5">
                    <div className="sheet px-6 py-8 sm:px-10 sm:py-10">
                        <div className="rubric flex items-baseline justify-between gap-4 border-b border-ink/25 pb-3 text-ink">
                            <span>Calculadora revisional</span>
                            <span className="text-ink/70">Escritório</span>
                        </div>

                        {modo === "login" ? (
                            <form onSubmit={submeterLogin} noValidate className="mt-7 space-y-6">
                                <div>
                                    <h1 className="subdisplay text-3xl text-ink">Entrar no sistema</h1>
                                    <p className="mt-2 text-sm text-muted-foreground">
                                        Acesse o cálculo revisional completo e o histórico de clientes salvos.
                                    </p>
                                </div>

                                <div>
                                    <label htmlFor="rev-email" className={labelClass}>
                                        E-mail do escritório
                                    </label>
                                    <input
                                        id="rev-email"
                                        type="email"
                                        autoComplete="username"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="contato@iangranja.adv.br"
                                        className="field"
                                        required
                                    />
                                </div>

                                <div>
                                    <div className="flex items-baseline justify-between gap-4">
                                        <label htmlFor="rev-senha" className={labelClass}>
                                            Senha
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setModo("recuperar");
                                                setErro(null);
                                                setEnviado(false);
                                            }}
                                            className="text-xs font-semibold text-ink/75 underline decoration-gold underline-offset-4 hover:text-ink"
                                        >
                                            Esqueci minha senha
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <input
                                            id="rev-senha"
                                            type={mostrarSenha ? "text" : "password"}
                                            autoComplete="current-password"
                                            value={senha}
                                            onChange={(e) => setSenha(e.target.value)}
                                            placeholder="••••••••"
                                            className="field pr-10"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setMostrarSenha((v) => !v)}
                                            aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                                            className="absolute right-0 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center text-ink/60 hover:text-ink"
                                        >
                                            {mostrarSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                        </button>
                                    </div>
                                </div>

                                {erro && (
                                    <p role="alert" className="border-t-2 border-destructive pt-3 text-sm font-medium text-destructive">
                                        {erro}
                                    </p>
                                )}

                                <button
                                    type="submit"
                                    disabled={carregando}
                                    className="inline-flex min-h-12 w-full items-center justify-center gap-3 bg-ink px-6 font-semibold text-paper transition-colors duration-200 hover:bg-ink-soft disabled:cursor-wait disabled:opacity-70"
                                >
                                    {carregando && <Loader2 aria-hidden className="size-4 animate-spin" />}
                                    {carregando ? "Entrando" : "Entrar"}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={submeterRecuperacao} noValidate className="mt-7 space-y-6">
                                <div>
                                    <h1 className="subdisplay text-3xl text-ink">Redefinir senha</h1>
                                    <p className="mt-2 text-sm text-muted-foreground">
                                        Enviaremos um link de redefinição para o e-mail autorizado do escritório.
                                    </p>
                                </div>

                                <div>
                                    <label htmlFor="rec-email" className={labelClass}>
                                        E-mail cadastrado
                                    </label>
                                    <input
                                        id="rec-email"
                                        type="email"
                                        autoComplete="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="contato@iangranja.adv.br"
                                        className="field"
                                        required
                                    />
                                </div>

                                {erro && (
                                    <p role="alert" className="border-t-2 border-destructive pt-3 text-sm font-medium text-destructive">
                                        {erro}
                                    </p>
                                )}

                                {enviado && (
                                    <p role="status" className="border-t-2 border-gold pt-3 text-sm font-medium text-ink">
                                        Se o e-mail estiver cadastrado no escritório, o link de redefinição já foi enviado.
                                    </p>
                                )}

                                <div className="flex flex-col gap-3 sm:flex-row">
                                    <button
                                        type="submit"
                                        disabled={carregando}
                                        className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 bg-ink px-5 font-semibold text-paper transition-colors duration-200 hover:bg-ink-soft disabled:opacity-70"
                                    >
                                        {carregando && <Loader2 aria-hidden className="size-4 animate-spin" />}
                                        Enviar link
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setModo("login");
                                            setErro(null);
                                        }}
                                        className="inline-flex min-h-12 items-center justify-center border border-ink/35 px-5 font-semibold text-ink transition-colors duration-200 hover:bg-ink/5"
                                    >
                                        Voltar
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>

                <div className="hidden lg:col-span-6 lg:block xl:col-span-7">
                    <div className="max-w-lg">
                        <p className="display text-[clamp(2rem,3.6vw,3.25rem)] text-paper">
                            Histórico revisional organizado por cliente.
                        </p>
                        <p className="mt-5 text-lg leading-relaxed text-paper/75">
                            Compare contratos com as séries oficiais do Banco Central, classifique por categoria e
                            retome qualquer cálculo salvo em segundos.
                        </p>
                        <HeroArt variant="calculo" className="mt-10 ml-0 max-w-[22rem]" />
                    </div>
                </div>
            </main>
        </div>
    );
};

interface ModalAlterarSenhaProps {
    aberto: boolean;
    obrigatorio?: boolean;
    onFechar: () => void;
}

export const ModalAlterarSenha = ({ aberto, obrigatorio = false, onFechar }: ModalAlterarSenhaProps) => {
    const [novaSenha, setNovaSenha] = useState("");
    const [confirmacao, setConfirmacao] = useState("");
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    if (!aberto) return null;

    const salvar = async (ev: FormEvent) => {
        ev.preventDefault();
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
            toast.success("Senha atualizada com sucesso.");
            setNovaSenha("");
            setConfirmacao("");
            onFechar();
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível atualizar a senha.");
        } finally {
            setSalvando(false);
        }
    };

    return (
        <ModalDialog
            aberto={aberto}
            onFechar={onFechar}
            bloquearFechamento={obrigatorio}
            ariaLabelledBy="titulo-alterar-senha"
            tituloAcessivel="Definir nova senha"
            overlayClassName="bg-ink-deep/80"
            contentClassName="sheet max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-md overflow-y-auto overscroll-contain p-6 sm:p-8"
        >
                <div className="flex items-start justify-between gap-4 border-b border-ink/20 pb-4">
                    <div className="flex items-center gap-2.5">
                        <KeyRound aria-hidden className="size-5 text-gold-deep" />
                        <h2 id="titulo-alterar-senha" className="subdisplay text-2xl text-ink">
                            Definir nova senha
                        </h2>
                    </div>
                    {!obrigatorio && (
                        <button
                            type="button"
                            onClick={onFechar}
                            aria-label="Fechar janela"
                            className="inline-flex size-8 items-center justify-center text-ink/60 hover:text-ink"
                        >
                            <X className="size-4" />
                        </button>
                    )}
                </div>

                <form onSubmit={salvar} className="mt-6 space-y-5">
                    <div>
                        <label htmlFor="nova-senha" className={labelClass}>
                            Nova senha (mínimo de 8 caracteres)
                        </label>
                        <input
                            id="nova-senha"
                            type="password"
                            autoComplete="new-password"
                            value={novaSenha}
                            onChange={(e) => setNovaSenha(e.target.value)}
                            className="field"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="confirma-senha" className={labelClass}>
                            Confirmar nova senha
                        </label>
                        <input
                            id="confirma-senha"
                            type="password"
                            autoComplete="new-password"
                            value={confirmacao}
                            onChange={(e) => setConfirmacao(e.target.value)}
                            className="field"
                            required
                        />
                    </div>

                    {erro && (
                        <p role="alert" className="border-t-2 border-destructive pt-2 text-sm font-medium text-destructive">
                            {erro}
                        </p>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                        {!obrigatorio && (
                            <button
                                type="button"
                                onClick={onFechar}
                                className="inline-flex min-h-11 items-center border border-ink/35 px-4 text-sm font-semibold text-ink hover:bg-ink/5"
                            >
                                Cancelar
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={salvando}
                            className="inline-flex min-h-11 items-center gap-2 bg-ink px-5 text-sm font-semibold text-paper hover:bg-ink-soft disabled:opacity-70"
                        >
                            {salvando && <Loader2 aria-hidden className="size-4 animate-spin" />}
                            Salvar senha
                        </button>
                    </div>
                </form>
        </ModalDialog>
    );
};
