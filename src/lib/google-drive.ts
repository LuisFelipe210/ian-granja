/**
 * Integração com o Google Drive feita no navegador (sem servidor intermediário):
 * - Google Identity Services (token client) entrega um token de acesso de curta duração (~1h),
 *   guardado só em memória (nunca em localStorage). Só o e-mail da conta usada fica lembrado no
 *   navegador, para o login não pedir a conta toda vez (dá para trocar ou desconectar no menu do botão);
 * - Google Picker deixa a pessoa escolher arquivos ou uma pasta no próprio Drive;
 * - Drive API v3 baixa o arquivo escolhido e envia o laudo PDF.
 *
 * Escopo `drive.file`: o sistema só enxerga os arquivos que a pessoa escolher no Picker
 * ou que ele mesmo criar. Ele nunca lista nem lê o Drive inteiro.
 *
 * Configuração (ver docs/GOOGLE-DRIVE.md): VITE_GOOGLE_CLIENT_ID, VITE_GOOGLE_API_KEY e VITE_GOOGLE_APP_ID.
 */

import { travarRolagemPagina } from "./use-travar-rolagem.ts";

const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
const CLIENT_ID = metaEnv?.VITE_GOOGLE_CLIENT_ID?.trim() ?? "";
const API_KEY = metaEnv?.VITE_GOOGLE_API_KEY?.trim() ?? "";
/** Número do projeto no Google Cloud; o Picker usa para liberar o acesso `drive.file` aos itens escolhidos. */
const APP_ID = metaEnv?.VITE_GOOGLE_APP_ID?.trim() ?? "";

export const GOOGLE_DRIVE_CONFIGURADO = Boolean(CLIENT_ID && API_KEY);

const ESCOPO_DRIVE = "https://www.googleapis.com/auth/drive.file";
const SCRIPT_GIS = "https://accounts.google.com/gsi/client";
const SCRIPT_GAPI = "https://apis.google.com/js/api.js";
const MIME_PASTA = "application/vnd.google-apps.folder";

export type CodigoErroDrive = "nao_configurado" | "cancelado" | "popup_bloqueado" | "sem_permissao" | "falha";

export class ErroGoogleDrive extends Error {
    readonly codigo: CodigoErroDrive;

    constructor(codigo: CodigoErroDrive, mensagem: string) {
        super(mensagem);
        this.name = "ErroGoogleDrive";
        this.codigo = codigo;
    }
}

export interface ItemDrive {
    id: string;
    nome: string;
    mimeType: string;
    tamanhoBytes?: number;
}

export interface ArquivoEnviadoDrive {
    id: string;
    nome: string;
    link: string | null;
}

/* ------------------------------------------------------------------ Tipos mínimos das bibliotecas do Google */

interface RespostaToken {
    access_token?: string;
    expires_in?: number | string;
    error?: string;
    error_description?: string;
}

interface ClienteToken {
    requestAccessToken: (opcoes?: { prompt?: string }) => void;
}

interface DocumentoPicker {
    id?: string;
    name?: string;
    mimeType?: string;
    sizeBytes?: number | string;
}

interface DadosPicker {
    action?: string;
    docs?: DocumentoPicker[];
}

interface DocsViewPicker {
    setMimeTypes: (tipos: string) => DocsViewPicker;
    setIncludeFolders: (incluir: boolean) => DocsViewPicker;
    setSelectFolderEnabled: (habilitar: boolean) => DocsViewPicker;
    setMode: (modo: unknown) => DocsViewPicker;
}

interface PickerBuilder {
    addView: (view: DocsViewPicker) => PickerBuilder;
    setOAuthToken: (token: string) => PickerBuilder;
    setDeveloperKey: (chave: string) => PickerBuilder;
    setAppId: (id: string) => PickerBuilder;
    setLocale: (locale: string) => PickerBuilder;
    setTitle: (titulo: string) => PickerBuilder;
    enableFeature: (feature: unknown) => PickerBuilder;
    setCallback: (cb: (dados: DadosPicker) => void) => PickerBuilder;
    build: () => { setVisible: (visivel: boolean) => void };
}

interface GooglePickerNamespace {
    PickerBuilder: new () => PickerBuilder;
    DocsView: new (viewId?: unknown) => DocsViewPicker;
    ViewId: { DOCS: unknown; FOLDERS: unknown };
    DocsViewMode: { LIST: unknown };
    Feature: { MULTISELECT_ENABLED: unknown; SUPPORT_DRIVES: unknown };
    Action: { PICKED: string; CANCEL: string };
}

interface JanelaGoogle {
    google?: {
        accounts?: {
            oauth2?: {
                initTokenClient: (config: {
                    client_id: string;
                    scope: string;
                    hint?: string;
                    callback: (resp: RespostaToken) => void;
                    error_callback?: (erro: { type?: string; message?: string }) => void;
                }) => ClienteToken;
                revoke: (token: string, done?: () => void) => void;
            };
        };
        picker?: GooglePickerNamespace;
    };
    gapi?: {
        load: (api: string, opcoes: { callback: () => void; onerror?: () => void; timeout?: number; ontimeout?: () => void }) => void;
    };
}

const janela = () => window as unknown as Window & JanelaGoogle;

/* ------------------------------------------------------------------ Carregamento dos scripts do Google */

const scriptsCarregando = new Map<string, Promise<void>>();

function carregarScript(src: string): Promise<void> {
    const existente = scriptsCarregando.get(src);
    if (existente) return existente;

    const promessa = new Promise<void>((resolve, reject) => {
        const el = document.createElement("script");
        el.src = src;
        el.async = true;
        el.defer = true;
        el.onload = () => resolve();
        el.onerror = () => {
            scriptsCarregando.delete(src);
            el.remove();
            reject(new ErroGoogleDrive("falha", "Não foi possível carregar o Google. Verifique a internet e tente de novo."));
        };
        document.head.appendChild(el);
    });
    scriptsCarregando.set(src, promessa);
    return promessa;
}

let pickerPronto: Promise<void> | null = null;

function carregarPicker(): Promise<void> {
    if (pickerPronto) return pickerPronto;
    pickerPronto = carregarScript(SCRIPT_GAPI)
        .then(
            () =>
                new Promise<void>((resolve, reject) => {
                    const gapi = janela().gapi;
                    if (!gapi) {
                        reject(new ErroGoogleDrive("falha", "Biblioteca do Google indisponível."));
                        return;
                    }
                    gapi.load("picker", {
                        callback: () => resolve(),
                        onerror: () => reject(new ErroGoogleDrive("falha", "Não foi possível abrir o seletor do Drive.")),
                        timeout: 10_000,
                        ontimeout: () => reject(new ErroGoogleDrive("falha", "O seletor do Drive demorou demais para abrir.")),
                    });
                }),
        )
        .catch((erro) => {
            pickerPronto = null;
            throw erro;
        });
    return pickerPronto;
}

/**
 * Pré-carrega os scripts do Google assim que a tela que usa o Drive aparece. O popup de login precisa
 * abrir logo após o clique (senão o navegador bloqueia), então os scripts já devem estar prontos.
 */
export function prepararGoogleDrive(): void {
    if (!GOOGLE_DRIVE_CONFIGURADO || typeof window === "undefined") return;
    void carregarScript(SCRIPT_GIS).catch(() => undefined);
    void carregarPicker().catch(() => undefined);
}

/* ------------------------------------------------------------------ Conta lembrada (só o e-mail) */

/**
 * Guarda só o e-mail da conta Google usada (não é segredo). Ele vai como `hint` no login: com a
 * autorização já dada, a janela do Google abre e fecha sozinha, sem pedir para escolher a conta.
 * O token de acesso continua só em memória.
 */
const CHAVE_CONTA_DRIVE = "ig-google-drive-conta";
const ouvintesConta = new Set<(email: string | null) => void>();

function lerContaSalva(): string | null {
    try {
        return localStorage.getItem(CHAVE_CONTA_DRIVE) || null;
    } catch {
        return null;
    }
}

function gravarContaSalva(email: string | null): void {
    try {
        if (email) localStorage.setItem(CHAVE_CONTA_DRIVE, email);
        else localStorage.removeItem(CHAVE_CONTA_DRIVE);
    } catch {
        /* navegador sem armazenamento: só não lembra a conta */
    }
    ouvintesConta.forEach((ouvinte) => ouvinte(email));
}

/** E-mail da conta Google lembrada neste navegador, ou `null`. */
export function contaDriveSalva(): string | null {
    return typeof window === "undefined" ? null : lerContaSalva();
}

/** Avisa quando a conta lembrada muda (inclusive em outra aba). Devolve a função para parar de ouvir. */
export function ouvirContaDrive(ouvinte: (email: string | null) => void): () => void {
    ouvintesConta.add(ouvinte);
    const onStorage = (e: StorageEvent) => {
        if (e.key === CHAVE_CONTA_DRIVE) ouvinte(e.newValue || null);
    };
    window.addEventListener("storage", onStorage);
    return () => {
        ouvintesConta.delete(ouvinte);
        window.removeEventListener("storage", onStorage);
    };
}

/* ------------------------------------------------------------------ Última pasta usada (por conta) */

const CHAVE_ULTIMA_PASTA = "ig-google-drive-ultima-pasta";

/**
 * Última pasta onde um laudo foi salvo, só se for da conta lembrada agora. Com `drive.file` o acesso
 * a uma pasta escolhida no seletor (ou criada pelo sistema) continua valendo nas próximas vezes.
 */
export function ultimaPastaDrive(): ItemDrive | null {
    if (typeof window === "undefined") return null;
    try {
        const salvo = JSON.parse(localStorage.getItem(CHAVE_ULTIMA_PASTA) || "null") as
            | { conta?: string | null; id?: string; nome?: string }
            | null;
        if (!salvo?.id || (salvo.conta ?? null) !== lerContaSalva()) return null;
        return { id: salvo.id, nome: salvo.nome || "Pasta", mimeType: MIME_PASTA };
    } catch {
        return null;
    }
}

export function lembrarUltimaPastaDrive(pasta: { id: string; nome: string }): void {
    try {
        localStorage.setItem(
            CHAVE_ULTIMA_PASTA,
            JSON.stringify({ conta: lerContaSalva(), id: pasta.id, nome: pasta.nome }),
        );
    } catch {
        /* sem armazenamento: só não lembra a pasta */
    }
}

export function esquecerUltimaPastaDrive(): void {
    try {
        localStorage.removeItem(CHAVE_ULTIMA_PASTA);
    } catch {
        /* nada a fazer */
    }
}

/** Descobre o e-mail da conta autorizada (a Drive API responde com o escopo `drive.file`). */
async function lembrarConta(token: string): Promise<void> {
    try {
        const res = await fetch("https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)", {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const json = (await res.json()) as { user?: { emailAddress?: string } };
        const email = json.user?.emailAddress?.trim();
        if (email && email !== lerContaSalva()) gravarContaSalva(email);
    } catch {
        /* sem e-mail: o login só volta a pedir a conta na próxima vez */
    }
}

/* ------------------------------------------------------------------ Token de acesso (só em memória) */

let tokenAtual: { valor: string; expiraEm: number } | null = null;
let tokenEmAndamento: Promise<string> | null = null;

function exigirConfiguracao(): void {
    if (!GOOGLE_DRIVE_CONFIGURADO) {
        throw new ErroGoogleDrive(
            "nao_configurado",
            "O Google Drive ainda não foi configurado neste sistema (faltam as chaves do Google Cloud).",
        );
    }
}

async function obterTokenDrive(opcoes: { escolherConta?: boolean } = {}): Promise<string> {
    exigirConfiguracao();
    if (!opcoes.escolherConta && tokenAtual && tokenAtual.expiraEm - 60_000 > Date.now()) return tokenAtual.valor;
    if (!opcoes.escolherConta && tokenEmAndamento) return tokenEmAndamento;

    const executar = async (): Promise<string> => {
        await carregarScript(SCRIPT_GIS);
        const oauth2 = janela().google?.accounts?.oauth2;
        if (!oauth2) throw new ErroGoogleDrive("falha", "Login do Google indisponível no momento.");

        const contaLembrada = opcoes.escolherConta ? null : lerContaSalva();

        return new Promise<string>((resolve, reject) => {
            let finalizado = false;
            const concluir = (fn: () => void) => {
                if (finalizado) return;
                finalizado = true;
                clearTimeout(timeoutId);
                fn();
            };
            const timeoutId = setTimeout(() => {
                concluir(() =>
                    reject(
                        new ErroGoogleDrive(
                            "falha",
                            "O login do Google demorou demais para responder. Tente novamente.",
                        ),
                    ),
                );
            }, 120_000);

            const cliente = oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: ESCOPO_DRIVE,
                ...(contaLembrada ? { hint: contaLembrada } : {}),
                callback: (resp) => {
                    if (resp.error || !resp.access_token) {
                        concluir(() =>
                            reject(
                                new ErroGoogleDrive(
                                    resp.error === "access_denied" ? "sem_permissao" : "falha",
                                    resp.error === "access_denied"
                                        ? "O acesso ao Google Drive não foi autorizado."
                                        : "Não foi possível conectar ao Google Drive.",
                                ),
                            ),
                        );
                        return;
                    }
                    const expiresInSec = Number(resp.expires_in);
                    const ttlMs = Number.isFinite(expiresInSec) && expiresInSec > 0 ? expiresInSec * 1000 : 3600 * 1000;
                    tokenAtual = {
                        valor: resp.access_token,
                        expiraEm: Date.now() + ttlMs,
                    };
                    const token = resp.access_token;
                    void lembrarConta(token).then(() => concluir(() => resolve(token)));
                },
                error_callback: (erro) => {
                    concluir(() => {
                        if (erro.type === "popup_closed") {
                            reject(new ErroGoogleDrive("cancelado", "Conexão com o Google Drive cancelada."));
                        } else if (erro.type === "popup_failed_to_open") {
                            reject(
                                new ErroGoogleDrive(
                                    "popup_bloqueado",
                                    "O navegador bloqueou a janela do Google. Permita pop-ups deste site e tente de novo.",
                                ),
                            );
                        } else {
                            reject(new ErroGoogleDrive("falha", "Não foi possível conectar ao Google Drive."));
                        }
                    });
                },
            });
            cliente.requestAccessToken({ prompt: opcoes.escolherConta ? "select_account" : "" });
        });
    };

    if (opcoes.escolherConta) {
        return executar();
    }

    tokenEmAndamento = executar().finally(() => {
        tokenEmAndamento = null;
    });
    return tokenEmAndamento;
}

/** Esquece o token atual (ex.: quando o Google responde 401 ou ao sair do sistema). */
export function desconectarGoogleDrive(): void {
    tokenAtual = null;
}

/** Abre o Google pedindo para escolher outra conta; a nova passa a ser a lembrada. */
export async function trocarContaDrive(): Promise<string | null> {
    tokenAtual = null;
    esquecerUltimaPastaDrive();
    gravarContaSalva(null);
    await obterTokenDrive({ escolherConta: true });
    return lerContaSalva();
}

/**
 * Desconecta o Google Drive deste sistema: revoga a autorização no Google (quando há token em memória)
 * e esquece a conta lembrada. No próximo "Salvar no Drive" o Google volta a pedir a conta e a permissão.
 */
export async function desconectarContaDrive(): Promise<void> {
    const token = tokenAtual?.valor;
    tokenAtual = null;
    esquecerUltimaPastaDrive();
    gravarContaSalva(null);
    if (!token) return;
    try {
        await carregarScript(SCRIPT_GIS);
        const oauth2 = janela().google?.accounts?.oauth2;
        if (oauth2?.revoke) {
            await new Promise<void>((resolve) => oauth2.revoke(token, () => resolve()));
        }
    } catch {
        /* a conta já foi esquecida aqui; a autorização expira sozinha em até 1h */
    }
}

/* ------------------------------------------------------------------ Picker: escolher arquivos ou pasta */

async function abrirPicker(opcoes: {
    titulo: string;
    pasta: boolean;
    multiplos?: boolean;
    mimeTypes?: string[];
}): Promise<ItemDrive[]> {
    const token = await obterTokenDrive();
    await carregarPicker();
    const g = janela().google?.picker;
    if (!g) throw new ErroGoogleDrive("falha", "Não foi possível abrir o seletor do Drive.");

    return new Promise<ItemDrive[]>((resolve) => {
        const view = opcoes.pasta
            ? new g.DocsView(g.ViewId.FOLDERS)
                  .setIncludeFolders(true)
                  .setSelectFolderEnabled(true)
                  .setMimeTypes(MIME_PASTA)
            : new g.DocsView(g.ViewId.DOCS)
                  .setIncludeFolders(true)
                  .setSelectFolderEnabled(false)
                  .setMimeTypes((opcoes.mimeTypes ?? []).join(","));
        view.setMode(g.DocsViewMode.LIST);

        let builder = new g.PickerBuilder()
            .addView(view)
            .setOAuthToken(token)
            .setDeveloperKey(API_KEY)
            .setLocale("pt-BR")
            .setTitle(opcoes.titulo)
            .enableFeature(g.Feature.SUPPORT_DRIVES)
            .setCallback((dados) => {
                if (dados.action === g.Action.PICKED) {
                    destravar();
                    resolve(
                        (dados.docs ?? [])
                            .filter((d) => d.id)
                            .map((d) => ({
                                id: String(d.id),
                                nome: d.name || "arquivo",
                                mimeType: d.mimeType || "",
                                tamanhoBytes: d.sizeBytes ? Number(d.sizeBytes) : undefined,
                            })),
                    );
                } else if (dados.action === g.Action.CANCEL) {
                    destravar();
                    resolve([]);
                }
            });
        if (APP_ID) builder = builder.setAppId(APP_ID);
        if (opcoes.multiplos) builder = builder.enableFeature(g.Feature.MULTISELECT_ENABLED);
        // Com o seletor aberto a página não rola: senão a rolagem "vaza" do seletor para o site.
        const destravar = travarRolagemPagina();
        try {
            builder.build().setVisible(true);
        } catch {
            destravar();
            resolve([]);
        }
    });
}

/** Abre o Drive para escolher um ou mais arquivos (filtrados pelos tipos aceitos). Lista vazia = cancelou. */
export function escolherArquivosDrive(opcoes: { mimeTypes: string[]; multiplos?: boolean; titulo?: string }) {
    return abrirPicker({
        titulo: opcoes.titulo ?? "Escolha o arquivo no Google Drive",
        pasta: false,
        multiplos: opcoes.multiplos,
        mimeTypes: opcoes.mimeTypes,
    });
}

/** Abre o Drive para escolher uma pasta de destino. `null` = cancelou. */
export async function escolherPastaDrive(titulo = "Escolha a pasta do cliente no Google Drive"): Promise<ItemDrive | null> {
    const [pasta] = await abrirPicker({ titulo, pasta: true });
    return pasta ?? null;
}

/* ------------------------------------------------------------------ Drive API: baixar e enviar */

async function respostaComErro(res: Response, acao: string): Promise<never> {
    if (res.status === 401) desconectarGoogleDrive();
    if (res.status === 401 || res.status === 403 || res.status === 404) {
        throw new ErroGoogleDrive(
            "sem_permissao",
            `O Google Drive não permitiu ${acao}. Escolha o arquivo ou a pasta de novo pelo seletor do Drive.`,
        );
    }
    throw new ErroGoogleDrive("falha", `Não foi possível ${acao} no Google Drive (erro ${res.status}).`);
}

const MAX_DOWNLOAD_DRIVE_BYTES = 25 * 1024 * 1024;
const MAX_UPLOAD_MULTIPART_BYTES = 5 * 1024 * 1024;
const MIME_TYPE_SEGURO_RE = /^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/i;

function sanitizarMimeDrive(raw: string): string {
    const limpo = raw.replace(/[\r\n]/g, "").trim();
    if (!MIME_TYPE_SEGURO_RE.test(limpo)) {
        return "application/octet-stream";
    }
    return limpo;
}

function gerarFronteiraMultipart(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return `ig-${crypto.randomUUID().replace(/-/g, "")}`;
    }
    return `ig-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/** Baixa o conteúdo de um arquivo escolhido no Picker e devolve como `File`, igual a um anexo do computador. */
export async function baixarArquivoDrive(item: ItemDrive): Promise<File> {
    if (item.mimeType.startsWith("application/vnd.google-apps.")) {
        throw new ErroGoogleDrive(
            "falha",
            "Arquivos nativos do Google Docs/Planilhas precisam ser exportados em PDF antes de anexar aqui.",
        );
    }
    if (typeof item.tamanhoBytes === "number" && item.tamanhoBytes > MAX_DOWNLOAD_DRIVE_BYTES) {
        throw new ErroGoogleDrive(
            "falha",
            `O arquivo "${item.nome}" excede o limite de ${Math.round(MAX_DOWNLOAD_DRIVE_BYTES / (1024 * 1024))} MB.`,
        );
    }
    const token = await obterTokenDrive();
    const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(item.id)}?alt=media&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30_000) },
    );
    if (!res.ok) await respostaComErro(res, "baixar o arquivo");
    const blob = await res.blob();
    if (blob.size > MAX_DOWNLOAD_DRIVE_BYTES) {
        throw new ErroGoogleDrive(
            "falha",
            `O arquivo "${item.nome}" excede o limite de ${Math.round(MAX_DOWNLOAD_DRIVE_BYTES / (1024 * 1024))} MB.`,
        );
    }
    return new File([blob], item.nome, { type: item.mimeType || blob.type });
}

/**
 * Cria uma pasta no Drive (o seletor do Google não tem "Nova pasta"). Com `drive.file` o sistema pode
 * criar pastas e, dentro de uma pasta escolhida no seletor, criar subpastas.
 */
export async function criarPastaDrive(opcoes: { nome: string; pastaPaiId?: string | null }): Promise<ItemDrive> {
    const nome = opcoes.nome.trim();
    if (!nome) throw new ErroGoogleDrive("falha", "Informe o nome da pasta nova.");
    const token = await obterTokenDrive();
    const res = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name,mimeType", {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({
            name: nome,
            mimeType: MIME_PASTA,
            ...(opcoes.pastaPaiId ? { parents: [opcoes.pastaPaiId] } : {}),
        }),
    });
    if (!res.ok) await respostaComErro(res, "criar a pasta");
    const json = (await res.json()) as { id: string; name?: string; mimeType?: string };
    return { id: json.id, nome: json.name ?? nome, mimeType: json.mimeType ?? MIME_PASTA };
}

/** Envia um arquivo (ex.: o Laudo PDF) para a pasta escolhida no Drive. */
export async function enviarArquivoDrive(opcoes: {
    nome: string;
    conteudo: Blob;
    mimeType: string;
    pastaId?: string | null;
}): Promise<ArquivoEnviadoDrive> {
    if (opcoes.conteudo.size > MAX_UPLOAD_MULTIPART_BYTES) {
        throw new ErroGoogleDrive(
            "falha",
            "O arquivo excede o limite de 5 MB para envio direto ao Google Drive.",
        );
    }
    const mimeSeguro = sanitizarMimeDrive(opcoes.mimeType);
    const token = await obterTokenDrive();
    const fronteira = gerarFronteiraMultipart();
    const metadados = JSON.stringify({
        name: opcoes.nome,
        mimeType: mimeSeguro,
        ...(opcoes.pastaId ? { parents: [opcoes.pastaId] } : {}),
    });
    const corpo = new Blob(
        [
            `--${fronteira}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadados}\r\n`,
            `--${fronteira}\r\nContent-Type: ${mimeSeguro}\r\n\r\n`,
            opcoes.conteudo,
            `\r\n--${fronteira}--`,
        ],
        { type: `multipart/related; boundary=${fronteira}` },
    );

    const res = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink",
        {
            method: "POST",
            signal: AbortSignal.timeout(30_000),
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": `multipart/related; boundary=${fronteira}`,
            },
            body: corpo,
        },
    );
    if (!res.ok) await respostaComErro(res, "salvar o arquivo");
    const json = (await res.json()) as { id: string; name?: string; webViewLink?: string };
    return { id: json.id, nome: json.name ?? opcoes.nome, link: json.webViewLink ?? null };
}
