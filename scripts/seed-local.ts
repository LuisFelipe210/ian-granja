/**
 * Popula o banco PostgreSQL LOCAL (Supabase CLI via OrbStack/Docker em 127.0.0.1:54321)
 * com os usuários do escritório e 16 clientes revisionais completos para testes.
 *
 * Trava de segurança: recusa execução se a URL não apontar estritamente para 127.0.0.1 ou localhost.
 */
import {
    PARAMETROS_DECISAO_PADRAO,
    calcularProcessoRevisional,
    prepararDadosBacenProcesso,
    primeiroVencimentoSugerido,
    type ContratoInput,
    type DeducaoItem,
    type ParametrosDecisao,
    type ProcessoRevisionalInput,
    type TarifaItem,
} from "../src/lib/juros/revisional-pro.ts";
import { processoParaPayload, type Categoria } from "../src/lib/revisional-db.ts";

interface NodeRuntimeLike {
    process?: {
        env: Record<string, string | undefined>;
    };
}

const env = (globalThis as unknown as NodeRuntimeLike).process?.env ?? {};

const LOCAL_URL = (env.LOCAL_SUPABASE_URL || "http://127.0.0.1:54321").replace(/\/+$/, "");
const SERVICE_KEY =
    env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ||
    "eyJhbGciOiJFUzI1NiIsImtpZCI6ImI4MTI2OWYxLTIxZDgtNGYyZS1iNzE5LWMyMjQwYTg0MGQ5MCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MjExMDMzMDY2NX0.MuXMaOCpB3WO1ZRCRABUP8ou3-YvE-h74tuJ-jpi4oWs4T7rLDPO-x4kLHqqLTTgiYGDFeuG7yLpTMfU9sfCbw";

if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(LOCAL_URL)) {
    throw new Error(`BLOQUEADO POR SEGURANÇA: seed-local só roda em localhost/127.0.0.1 (recebido: ${LOCAL_URL}).`);
}

const USUARIOS_TESTE = [
    { email: "contato@iangranja.adv.br", password: env.INITIAL_PASS_IAN || "IG-y5DL-wG5lS3y" },
    { email: "lf210400@gmail.com", password: env.INITIAL_PASS_DEV || "IG-IkO0syI8L-ZS" },
];

async function adminReq<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${LOCAL_URL}${path}`, {
        ...init,
        headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            "Content-Type": "application/json",
            ...(init.headers ?? {}),
        },
    });
    const text = await res.text();
    const json = text ? (JSON.parse(text) as unknown) : null;
    if (!res.ok) {
        throw new Error(`Erro HTTP ${res.status} em ${path}: ${text}`);
    }
    return json as T;
}

async function garantirUsuariosLocais(): Promise<Record<string, string>> {
    const lista = await adminReq<{ users: Array<{ id: string; email?: string }> }>("/auth/v1/admin/users");
    const existentes = new Map(
        (lista.users ?? []).filter((u) => u.email).map((u) => [u.email!.toLowerCase(), u.id]),
    );
    const idsPorEmail: Record<string, string> = {};

    for (const u of USUARIOS_TESTE) {
        const key = u.email.toLowerCase();
        const existenteId = existentes.get(key);
        if (existenteId) {
            await adminReq(`/auth/v1/admin/users/${existenteId}`, {
                method: "PUT",
                body: JSON.stringify({ password: u.password, email_confirm: true }),
            });
            idsPorEmail[key] = existenteId;
        } else {
            const criado = await adminReq<{ id: string }>("/auth/v1/admin/users", {
                method: "POST",
                body: JSON.stringify({
                    email: u.email,
                    password: u.password,
                    email_confirm: true,
                }),
            });
            idsPorEmail[key] = criado.id;
        }
    }
    return idsPorEmail;
}

function contratoBase(
    id: string,
    parcial: Partial<ContratoInput> &
        Pick<
            ContratoInput,
            | "descricao"
            | "instituicao"
            | "pessoa"
            | "modalidadeId"
            | "dataContrato"
            | "valorFinanciado"
            | "valorParcela"
            | "parcelas"
            | "pagas"
        >,
): ContratoInput {
    return {
        id,
        numeroContrato: "",
        primeiroVencimento: primeiroVencimentoSugerido(parcial.dataContrato),
        fonteTaxaRevisional: "media_sgs",
        pagamentosExtras: [],
        ...parcial,
    };
}

interface CasoSeed {
    clienteNome: string;
    categoriaNome: string;
    processoGlobal: string;
    observacoes: string;
    autorEmail: string;
    diasAtras: number;
    parametros?: Partial<ParametrosDecisao>;
    contratos: ContratoInput[];
    tarifas?: TarifaItem[];
    deducoes?: DeducaoItem[];
}

const CASOS_SEED: CasoSeed[] = [
    {
        clienteNome: "Antônio Marcos Coelho",
        categoriaNome: "Busca e Apreensão",
        processoGlobal: "0004112-38.2026.8.17.1130",
        observacoes:
            "Liminar de busca e apreensão na 2ª Vara Cível de Petrolina. Seguro prestamista e tarifa de avaliação impostos sem opção de escolha (venda casada).",
        autorEmail: "contato@iangranja.adv.br",
        diasAtras: 1,
        parametros: { restituicaoDobroParcelas: true, honorariosPercentual: 15 },
        contratos: [
            contratoBase("ct-1", {
                descricao: "Financiamento Caminhonete Hilux SRV",
                instituicao: "BANCO SANTANDER (BRASIL) S.A.",
                numeroContrato: "200948112-9",
                pessoa: "pf",
                modalidadeId: "veiculo-pf",
                dataContrato: "2024-02-14",
                valorFinanciado: 138000,
                valorParcela: 4690,
                parcelas: 60,
                pagas: 20,
            }),
        ],
        tarifas: [
            {
                id: "t-1",
                tipo: "Seguro Prestamista",
                descricaoCustom: "",
                valor: 4200,
                dataCobranca: "2024-02-14",
                emDobro: true,
            },
            {
                id: "t-2",
                tipo: "Tarifa de Avaliação do Bem",
                descricaoCustom: "",
                valor: 1850,
                dataCobranca: "2024-02-14",
                emDobro: true,
            },
        ],
    },
    {
        clienteNome: "José Roberto Alencar",
        categoriaNome: "Busca e Apreensão",
        processoGlobal: "0003890-70.2026.8.17.1130",
        observacoes: "Reconhecimento de descaracterização da mora por cobrança de juros acima de 1,8x a média no período normal.",
        autorEmail: "contato@iangranja.adv.br",
        diasAtras: 2,
        parametros: { restituicaoDobroParcelas: true },
        contratos: [
            contratoBase("ct-1", {
                descricao: "Financiamento Chevrolet Onix Plus",
                instituicao: "BANCO PAN S.A.",
                numeroContrato: "PAN-7741902",
                pessoa: "pf",
                modalidadeId: "veiculo-pf",
                dataContrato: "2024-05-10",
                valorFinanciado: 68500,
                valorParcela: 2890,
                parcelas: 48,
                pagas: 15,
            }),
        ],
        tarifas: [
            {
                id: "t-1",
                tipo: "Seguro Prestamista",
                descricaoCustom: "",
                valor: 2950,
                dataCobranca: "2024-05-10",
                emDobro: true,
            },
        ],
    },
    {
        clienteNome: "Pedro Henrique Damasceno",
        categoriaNome: "Busca e Apreensão",
        processoGlobal: "0006018-63.2026.8.05.0146",
        observacoes: "Tramitação na 1ª Vara Cível de Juazeiro-BA. Cliente realizou amortização avulsa de R$ 5.000,00 não abatida corretamente.",
        autorEmail: "lf210400@gmail.com",
        diasAtras: 4,
        contratos: [
            contratoBase("ct-1", {
                descricao: "Financiamento Jeep Compass Longitude",
                instituicao: "BANCO BV S.A.",
                numeroContrato: "BV-99104432",
                pessoa: "pf",
                modalidadeId: "veiculo-pf",
                dataContrato: "2023-11-20",
                valorFinanciado: 112000,
                valorParcela: 4350,
                parcelas: 48,
                pagas: 22,
                pagamentosExtras: [
                    { id: "ex-1", descricao: "Amortização extraordinária via PIX", data: "2024-08-15", valor: 5000 },
                ],
            }),
        ],
        tarifas: [
            {
                id: "t-1",
                tipo: "Registro de Contrato / Gravame",
                descricaoCustom: "",
                valor: 1620,
                dataCobranca: "2023-11-20",
                emDobro: false,
            },
        ],
    },
    {
        clienteNome: "Fruticultura Vale Verde Ltda.",
        categoriaNome: "Ajuizado",
        processoGlobal: "0001945-48.2026.8.17.1130",
        observacoes: "Produtor de manga e uva no Projeto Senador Nilo Coelho. Capital de giro com taxa muito superior à divulgada no BCB.",
        autorEmail: "contato@iangranja.adv.br",
        diasAtras: 5,
        parametros: { honorariosPercentual: 10 },
        contratos: [
            contratoBase("ct-1", {
                descricao: "Cédula de Crédito Bancário · Capital de Giro",
                instituicao: "BCO DO BRASIL S.A.",
                numeroContrato: "CCB-44019283",
                pessoa: "pj",
                modalidadeId: "capital-giro-pj",
                dataContrato: "2024-01-18",
                valorFinanciado: 240000,
                valorParcela: 11400,
                parcelas: 36,
                pagas: 18,
            }),
        ],
        tarifas: [
            {
                id: "t-1",
                tipo: "Tarifa de Abertura de Crédito (TAC)",
                descricaoCustom: "",
                valor: 3600,
                dataCobranca: "2024-01-18",
                emDobro: false,
            },
        ],
    },
    {
        clienteNome: "Maria das Graças Nogueira",
        categoriaNome: "Superendividamento",
        processoGlobal: "0005510-20.2026.8.17.1130",
        observacoes: "Aposentada com comprometimento superior a 65% dos proventos. Repactuação cumulada com revisão de 2 contratos (Lei 14.181/2021).",
        autorEmail: "contato@iangranja.adv.br",
        diasAtras: 6,
        parametros: { restituicaoDobroParcelas: true },
        contratos: [
            contratoBase("ct-1", {
                descricao: "Empréstimo Pessoal Não Consignado",
                instituicao: "BCO CETELEM S.A.",
                numeroContrato: "CET-88231",
                pessoa: "pf",
                modalidadeId: "sem-garantia",
                dataContrato: "2024-04-08",
                valorFinanciado: 22000,
                valorParcela: 1680,
                parcelas: 36,
                pagas: 14,
            }),
            contratoBase("ct-2", {
                descricao: "Parcelamento de Cartão RMC",
                instituicao: "BCO BMG S.A.",
                numeroContrato: "BMG-552019",
                pessoa: "pf",
                modalidadeId: "cartao-parcelado",
                dataContrato: "2024-06-12",
                valorFinanciado: 9500,
                valorParcela: 940,
                parcelas: 24,
                pagas: 11,
            }),
        ],
        tarifas: [
            {
                id: "t-1",
                tipo: "Seguro Prestamista",
                descricaoCustom: "",
                valor: 1780,
                dataCobranca: "2024-04-08",
                emDobro: true,
            },
        ],
    },
    {
        clienteNome: "Cláudia Regina Batista",
        categoriaNome: "Revisional",
        processoGlobal: "0005201-96.2026.8.17.1130",
        observacoes: "Renegociação sucessiva de crédito pessoal com capitalização de encargos e seguro embutido.",
        autorEmail: "contato@iangranja.adv.br",
        diasAtras: 8,
        contratos: [
            contratoBase("ct-1", {
                descricao: "Crédito Pessoal Unificado",
                instituicao: "ITAÚ UNIBANCO S.A.",
                numeroContrato: "IT-00391827",
                pessoa: "pf",
                modalidadeId: "sem-garantia",
                dataContrato: "2024-07-05",
                valorFinanciado: 35000,
                valorParcela: 2590,
                parcelas: 36,
                pagas: 12,
            }),
        ],
        tarifas: [
            {
                id: "t-1",
                tipo: "Seguro Prestamista",
                descricaoCustom: "",
                valor: 1890,
                dataCobranca: "2024-07-05",
                emDobro: true,
            },
        ],
    },
    {
        clienteNome: "Transportadora São Francisco ME",
        categoriaNome: "Revisional",
        processoGlobal: "0002788-36.2026.8.17.1130",
        observacoes: "Frota leve de entregas regionais. Financiamento empresarial com seguros atrelados ao pacote.",
        autorEmail: "lf210400@gmail.com",
        diasAtras: 10,
        contratos: [
            contratoBase("ct-1", {
                descricao: "Financiamento Furgão Master PJ",
                instituicao: "BCO BRADESCO S.A.",
                numeroContrato: "BRAD-661209",
                pessoa: "pj",
                modalidadeId: "veiculo-pj",
                dataContrato: "2023-09-12",
                valorFinanciado: 185000,
                valorParcela: 6850,
                parcelas: 48,
                pagas: 24,
            }),
        ],
        tarifas: [
            {
                id: "t-1",
                tipo: "Seguro Prestamista",
                descricaoCustom: "",
                valor: 5400,
                dataCobranca: "2023-09-12",
                emDobro: false,
            },
        ],
    },
    {
        clienteNome: "Francisca Severina Lima",
        categoriaNome: "Superendividamento",
        processoGlobal: "",
        observacoes: "Fatura parcelada compulsoriamente a mais de 14% a.m. Preparando audiência conciliatória no CEJUSC.",
        autorEmail: "contato@iangranja.adv.br",
        diasAtras: 11,
        contratos: [
            contratoBase("ct-1", {
                descricao: "Parcelamento Automático de Fatura",
                instituicao: "NU FINANCEIRA S.A.",
                numeroContrato: "NU-998120",
                pessoa: "pf",
                modalidadeId: "cartao-parcelado",
                dataContrato: "2024-09-10",
                valorFinanciado: 14800,
                valorParcela: 2380,
                parcelas: 18,
                pagas: 8,
            }),
        ],
    },
    {
        clienteNome: "Carlos Eduardo Cavalcanti",
        categoriaNome: "Acordo / Concluído",
        processoGlobal: "0008412-77.2025.8.17.1130",
        observacoes: "Acordo homologado após alvará parcial de R$ 8.500,00 levantado nos autos e quitação do saldo remanescente com 42% de desconto.",
        autorEmail: "contato@iangranja.adv.br",
        diasAtras: 14,
        parametros: { restituicaoDobroParcelas: false, honorariosPercentual: 15 },
        contratos: [
            contratoBase("ct-1", {
                descricao: "Financiamento Toyota Corolla XEi",
                instituicao: "BANCO SANTANDER (BRASIL) S.A.",
                numeroContrato: "SANT-551092",
                pessoa: "pf",
                modalidadeId: "veiculo-pf",
                dataContrato: "2023-04-18",
                valorFinanciado: 95000,
                valorParcela: 3780,
                parcelas: 48,
                pagas: 30,
            }),
        ],
        deducoes: [
            {
                id: "d-1",
                descricao: "Alvará judicial parcial levantado",
                valor: 8500,
                data: "2025-09-10",
                atualizar: false,
            },
        ],
    },
    {
        clienteNome: "Luciana Aparecida Ferraz",
        categoriaNome: "Ajuizado",
        processoGlobal: "0001120-07.2026.8.17.1130",
        observacoes: "Servidora municipal. Taxa efetiva acima do pactuado por inclusão de seguro não contratado.",
        autorEmail: "contato@iangranja.adv.br",
        diasAtras: 16,
        parametros: { restituicaoDobroParcelas: true },
        contratos: [
            contratoBase("ct-1", {
                descricao: "Consignado Servidor Municipal",
                instituicao: "CAIXA ECONOMICA FEDERAL",
                numeroContrato: "CEF-7102938",
                pessoa: "pf",
                modalidadeId: "consig-publico",
                dataContrato: "2023-08-22",
                valorFinanciado: 48000,
                valorParcela: 1520,
                parcelas: 72,
                pagas: 26,
            }),
        ],
        tarifas: [
            {
                id: "t-1",
                tipo: "Seguro Prestamista",
                descricaoCustom: "",
                valor: 2400,
                dataCobranca: "2023-08-22",
                emDobro: true,
            },
        ],
    },
    {
        clienteNome: "Marcos Vinícius Peixoto",
        categoriaNome: "Revisional",
        processoGlobal: "0006310-12.2026.8.17.1130",
        observacoes: "Dois contratos assinados na mesma concessionária: financiamento da motocicleta + empréstimo pessoal atrelado.",
        autorEmail: "lf210400@gmail.com",
        diasAtras: 18,
        parametros: { restituicaoDobroParcelas: true },
        contratos: [
            contratoBase("ct-1", {
                descricao: "Financiamento Honda XRE 300",
                instituicao: "BANCO PAN S.A.",
                numeroContrato: "PAN-310998",
                pessoa: "pf",
                modalidadeId: "veiculo-pf",
                dataContrato: "2024-03-25",
                valorFinanciado: 24500,
                valorParcela: 1180,
                parcelas: 48,
                pagas: 16,
            }),
            contratoBase("ct-2", {
                descricao: "Empréstimo Pessoal Acessório",
                instituicao: "BANCO PAN S.A.",
                numeroContrato: "PAN-310999",
                pessoa: "pf",
                modalidadeId: "sem-garantia",
                dataContrato: "2024-03-25",
                valorFinanciado: 6500,
                valorParcela: 690,
                parcelas: 24,
                pagas: 16,
            }),
        ],
    },
    {
        clienteNome: "Sebastião Ferreira Neto",
        categoriaNome: "Ajuizado",
        processoGlobal: "0004991-45.2026.8.17.1130",
        observacoes: "Aposentado rural. Contrato consignado simulado como operação pessoal muito acima do teto previdenciário.",
        autorEmail: "contato@iangranja.adv.br",
        diasAtras: 20,
        parametros: { restituicaoDobroParcelas: true },
        contratos: [
            contratoBase("ct-1", {
                descricao: "Contrato Averbado em Benefício INSS",
                instituicao: "BCO BMG S.A.",
                numeroContrato: "BMG-900112",
                pessoa: "pf",
                modalidadeId: "consig-inss",
                dataContrato: "2023-06-15",
                valorFinanciado: 19500,
                valorParcela: 740,
                parcelas: 84,
                pagas: 28,
            }),
        ],
        tarifas: [
            {
                id: "t-1",
                tipo: "Seguro Prestamista",
                descricaoCustom: "",
                valor: 1450,
                dataCobranca: "2023-06-15",
                emDobro: true,
            },
        ],
    },
    {
        clienteNome: "Distribuidora Sertão Bebidas Ltda.",
        categoriaNome: "Acordo / Concluído",
        processoGlobal: "0007301-58.2025.8.17.1130",
        observacoes: "Confissão de dívida oriunda de cheque especial empresarial encerrada mediante acordo extrajudicial.",
        autorEmail: "contato@iangranja.adv.br",
        diasAtras: 23,
        contratos: [
            contratoBase("ct-1", {
                descricao: "Confissão de Limite Empresarial",
                instituicao: "ITAÚ UNIBANCO S.A.",
                numeroContrato: "IT-PJ-88210",
                pessoa: "pj",
                modalidadeId: "capital-giro-pj",
                dataContrato: "2023-10-05",
                valorFinanciado: 85000,
                valorParcela: 5980,
                parcelas: 24,
                pagas: 16,
            }),
        ],
    },
    {
        clienteNome: "Rafael Augusto Moura",
        categoriaNome: "Triagem",
        processoGlobal: "",
        observacoes: "Cliente enviou contrato pelo WhatsApp hoje cedo. Comparado também pela tabela Olinda BCB do próprio C6.",
        autorEmail: "contato@iangranja.adv.br",
        diasAtras: 0,
        contratos: [
            contratoBase("ct-1", {
                descricao: "Financiamento Honda Civic Touring",
                instituicao: "BCO C6 S.A.",
                numeroContrato: "C6-402918",
                pessoa: "pf",
                modalidadeId: "veiculo-pf",
                dataContrato: "2024-08-19",
                valorFinanciado: 74000,
                valorParcela: 2860,
                parcelas: 48,
                pagas: 9,
                fonteTaxaRevisional: "banco_olinda",
                bancoOlinda: {
                    instituicao: "BCO C6 S.A.",
                    taxaAm: 1.68,
                    taxaAa: 22.13,
                    periodo: "2024-08-19",
                },
            }),
        ],
    },
    {
        clienteNome: "Patrícia Gomes de Souza",
        categoriaNome: "Triagem",
        processoGlobal: "",
        observacoes: "Taxa cerca de 1,32x acima da média (faixa intermediária). Avaliando viabilidade apenas quanto ao seguro embutido.",
        autorEmail: "lf210400@gmail.com",
        diasAtras: 3,
        contratos: [
            contratoBase("ct-1", {
                descricao: "Consignado Privado Folha CLT",
                instituicao: "BCO BRADESCO S.A.",
                numeroContrato: "BRAD-CLT-419",
                pessoa: "pf",
                modalidadeId: "consig-privado",
                dataContrato: "2024-04-20",
                valorFinanciado: 26000,
                valorParcela: 1095,
                parcelas: 48,
                pagas: 11,
            }),
        ],
    },
    {
        clienteNome: "Fernanda Cristina Sá",
        categoriaNome: "Triagem",
        processoGlobal: "",
        observacoes: "Triagem concluída: taxa contratual de 1,95% a.m. está alinhada à média de mercado do BACEN na época. Orientada a não ajuizar.",
        autorEmail: "contato@iangranja.adv.br",
        diasAtras: 7,
        contratos: [
            contratoBase("ct-1", {
                descricao: "Financiamento VW T-Cross Comfortline",
                instituicao: "BCO DO BRASIL S.A.",
                numeroContrato: "BB-9012841",
                pessoa: "pf",
                modalidadeId: "veiculo-pf",
                dataContrato: "2024-03-12",
                valorFinanciado: 82000,
                valorParcela: 2620,
                parcelas: 48,
                pagas: 12,
            }),
        ],
    },
    {
        clienteNome: "Roberto Carlos Medeiros",
        categoriaNome: "Triagem",
        processoGlobal: "",
        observacoes: "Cooperado Sicoob: taxa de 1,44% a.m. ficou bem abaixo da média de mercado do BACEN (ótimo contrato, sem abusividade).",
        autorEmail: "contato@iangranja.adv.br",
        diasAtras: 0.4,
        contratos: [
            contratoBase("ct-1", {
                descricao: "Financiamento Fiat Strada Freedom",
                instituicao: "BANCO SICOOB S.A.",
                numeroContrato: "SIC-209184",
                pessoa: "pf",
                modalidadeId: "veiculo-pf",
                dataContrato: "2024-05-15",
                valorFinanciado: 76000,
                valorParcela: 2210,
                parcelas: 48,
                pagas: 10,
            }),
        ],
    },
    {
        clienteNome: "Helena Beatriz Vasconcelos",
        categoriaNome: "Triagem",
        processoGlobal: "",
        observacoes: "Taxa subsidiada pela montadora (1,28% a.m., cerca de 0,67x da média BACEN). Contrato exemplar, parecer pela manutenção.",
        autorEmail: "lf210400@gmail.com",
        diasAtras: 1.5,
        contratos: [
            contratoBase("ct-1", {
                descricao: "Financiamento Toyota Corolla Cross",
                instituicao: "BCO TOYOTA DO BRASIL S.A.",
                numeroContrato: "TOY-550192",
                pessoa: "pf",
                modalidadeId: "veiculo-pf",
                dataContrato: "2024-06-20",
                valorFinanciado: 92000,
                valorParcela: 3200,
                parcelas: 36,
                pagas: 9,
            }),
        ],
    },
    {
        clienteNome: "Agropecuária Rio Corrente Ltda.",
        categoriaNome: "Acordo / Concluído",
        processoGlobal: "",
        observacoes: "Análise preventiva de CCB cooperativa: juros de 1,29% a.m. abaixo da média PJ. Parecer favorável entregue ao cliente.",
        autorEmail: "contato@iangranja.adv.br",
        diasAtras: 3.5,
        contratos: [
            contratoBase("ct-1", {
                descricao: "Capital de Giro Cooperativo PJ",
                instituicao: "BCO COOPERATIVO SICREDI S.A.",
                numeroContrato: "SICR-88102",
                pessoa: "pj",
                modalidadeId: "capital-giro-pj",
                dataContrato: "2024-02-28",
                valorFinanciado: 150000,
                valorParcela: 5210,
                parcelas: 36,
                pagas: 14,
            }),
        ],
    },
    {
        clienteNome: "Manoel Messias Cavalcante",
        categoriaNome: "Triagem",
        processoGlobal: "",
        observacoes: "Consignado INSS rigorosamente dentro do teto previdenciário (1,62% a.m.) e sem seguros embutidos.",
        autorEmail: "contato@iangranja.adv.br",
        diasAtras: 5.5,
        contratos: [
            contratoBase("ct-1", {
                descricao: "Empréstimo Consignado Aposentadoria",
                instituicao: "CAIXA ECONOMICA FEDERAL",
                numeroContrato: "CEF-INSS-11920",
                pessoa: "pf",
                modalidadeId: "consig-inss",
                dataContrato: "2024-04-10",
                valorFinanciado: 25000,
                valorParcela: 598,
                parcelas: 72,
                pagas: 12,
            }),
        ],
    },
    {
        clienteNome: "Gustavo Henrique Lira",
        categoriaNome: "Triagem",
        processoGlobal: "",
        observacoes: "Campanha de taxa reduzida da financeira da marca (1,59% a.m. contra 1,91% da média BACEN). Sem cobrança indevida.",
        autorEmail: "lf210400@gmail.com",
        diasAtras: 9,
        contratos: [
            contratoBase("ct-1", {
                descricao: "Financiamento VW Nivus Highline",
                instituicao: "BCO VOLKSWAGEN S.A.",
                numeroContrato: "VW-771290",
                pessoa: "pf",
                modalidadeId: "veiculo-pf",
                dataContrato: "2024-03-28",
                valorFinanciado: 75000,
                valorParcela: 2265,
                parcelas: 48,
                pagas: 13,
            }),
        ],
    },
    {
        clienteNome: "Beatriz Nogueira Dantas",
        categoriaNome: "Triagem",
        processoGlobal: "",
        observacoes: "Consignado de servidora estadual com taxa competitiva (1,55% a.m.). Orientada sobre regularidade dos encargos.",
        autorEmail: "contato@iangranja.adv.br",
        diasAtras: 12,
        contratos: [
            contratoBase("ct-1", {
                descricao: "Consignado Folha Governo PE",
                instituicao: "BCO DO BRASIL S.A.",
                numeroContrato: "BB-SERV-3019",
                pessoa: "pf",
                modalidadeId: "consig-publico",
                dataContrato: "2024-01-22",
                valorFinanciado: 42000,
                valorParcela: 1080,
                parcelas: 60,
                pagas: 15,
            }),
        ],
    },
    {
        clienteNome: "Camila Rocha Albuquerque",
        categoriaNome: "Acordo / Concluído",
        processoGlobal: "",
        observacoes: "Financiamento Honda com taxa na média de mercado (1,82% a.m.) sem tarifas ocultas.",
        autorEmail: "lf210400@gmail.com",
        diasAtras: 15,
        contratos: [
            contratoBase("ct-1", {
                descricao: "Financiamento Honda HR-V EXL",
                instituicao: "BCO HONDA S.A.",
                numeroContrato: "HND-640192",
                pessoa: "pf",
                modalidadeId: "veiculo-pf",
                dataContrato: "2024-02-09",
                valorFinanciado: 88000,
                valorParcela: 2770,
                parcelas: 48,
                pagas: 14,
            }),
        ],
    },
    {
        clienteNome: "Edson Luiz Sampaio",
        categoriaNome: "Busca e Apreensão",
        processoGlobal: "0007190-14.2026.8.17.1130",
        observacoes: "Veículo apreendido; contestação apresentada demonstrando taxa efetiva superior a 3,6% a.m. e seguro casado.",
        autorEmail: "contato@iangranja.adv.br",
        diasAtras: 17,
        parametros: { restituicaoDobroParcelas: true, honorariosPercentual: 15 },
        contratos: [
            contratoBase("ct-1", {
                descricao: "Financiamento Renault Duster Iconic",
                instituicao: "BANCO BV S.A.",
                numeroContrato: "BV-6120984",
                pessoa: "pf",
                modalidadeId: "veiculo-pf",
                dataContrato: "2023-12-11",
                valorFinanciado: 72000,
                valorParcela: 3290,
                parcelas: 48,
                pagas: 16,
            }),
        ],
        tarifas: [
            {
                id: "t-1",
                tipo: "Seguro Prestamista",
                descricaoCustom: "",
                valor: 3100,
                dataCobranca: "2023-12-11",
                emDobro: true,
            },
        ],
    },
    {
        clienteNome: " Raimundo Nonato Queiroz".trim(),
        categoriaNome: "Ajuizado",
        processoGlobal: "0003402-52.2026.8.17.1130",
        observacoes: "Empréstimo pessoal a aposentado a 9,8% a.m. contra média de mercado muito inferior.",
        autorEmail: "contato@iangranja.adv.br",
        diasAtras: 19,
        parametros: { restituicaoDobroParcelas: true },
        contratos: [
            contratoBase("ct-1", {
                descricao: "Empréstimo Pessoal Débito em Conta",
                instituicao: "BCO MERCANTIL DO BRASIL S.A.",
                numeroContrato: "MB-449012",
                pessoa: "pf",
                modalidadeId: "sem-garantia",
                dataContrato: "2024-02-05",
                valorFinanciado: 12000,
                valorParcela: 1380,
                parcelas: 24,
                pagas: 13,
            }),
        ],
    },
    {
        clienteNome: "Clínica Odontológica Sorriso do Vale Ltda.",
        categoriaNome: "Triagem",
        processoGlobal: "",
        observacoes: "Financiamento PJ de veículo utilitário com taxa excelente (1,34% a.m.) pelo Sicredi. Sem reparos a fazer.",
        autorEmail: "contato@iangranja.adv.br",
        diasAtras: 21,
        contratos: [
            contratoBase("ct-1", {
                descricao: "Financiamento Fiat Fiorino PJ",
                instituicao: "BCO COOPERATIVO SICREDI S.A.",
                numeroContrato: "SICR-VEIC-908",
                pessoa: "pj",
                modalidadeId: "veiculo-pj",
                dataContrato: "2024-05-06",
                valorFinanciado: 94000,
                valorParcela: 2670,
                parcelas: 48,
                pagas: 10,
            }),
        ],
    },
    {
        clienteNome: "Vanessa Aparecida Miranda",
        categoriaNome: "Superendividamento",
        processoGlobal: "0006892-19.2026.8.17.1130",
        observacoes: "Rotativo e parcelamento compulsório de cartão com juros acima de 13% a.m.",
        autorEmail: "lf210400@gmail.com",
        diasAtras: 24,
        contratos: [
            contratoBase("ct-1", {
                descricao: "Renegociação de Cartão de Crédito",
                instituicao: "ITAÚ UNIBANCO S.A.",
                numeroContrato: "IT-CARD-7712",
                pessoa: "pf",
                modalidadeId: "cartao-parcelado",
                dataContrato: "2024-03-18",
                valorFinanciado: 18500,
                valorParcela: 2420,
                parcelas: 24,
                pagas: 11,
            }),
        ],
    },
    {
        clienteNome: " Joaquim Pereira da Costa".trim(),
        categoriaNome: "Revisional",
        processoGlobal: "0002109-64.2026.8.05.0146",
        observacoes: "Caminhonete financiada com taxa 1,38x acima da média e seguro prestamista de R$ 3.800,00.",
        autorEmail: "contato@iangranja.adv.br",
        diasAtras: 26,
        parametros: { restituicaoDobroParcelas: true },
        contratos: [
            contratoBase("ct-1", {
                descricao: "Financiamento Chevrolet S10 LTZ",
                instituicao: "BCO DAYCOVAL S.A.",
                numeroContrato: "DAY-881209",
                pessoa: "pf",
                modalidadeId: "veiculo-pf",
                dataContrato: "2023-10-25",
                valorFinanciado: 128000,
                valorParcela: 4890,
                parcelas: 48,
                pagas: 19,
            }),
        ],
        tarifas: [
            {
                id: "t-1",
                tipo: "Seguro Prestamista",
                descricaoCustom: "",
                valor: 3800,
                dataCobranca: "2023-10-25",
                emDobro: true,
            },
        ],
    },
];

async function executarSeedLocal() {
    console.log(`Conectando ao banco local em ${LOCAL_URL}...`);
    const idsUsuarios = await garantirUsuariosLocais();
    console.log("Usuários locais prontos:", Object.keys(idsUsuarios).join(", "));

    const categorias = await adminReq<Categoria[]>("/rest/v1/revisional_categorias?select=*&order=ordem.asc");
    const catPorNome = new Map(categorias.map((c) => [c.nome.toLowerCase(), c.id]));

    // Limpa registros anteriores do banco local para manter o seed idempotente
    await adminReq<unknown>("/rest/v1/revisional_calculos?id=not.is.null", {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
    });

    const baseParams = PARAMETROS_DECISAO_PADRAO();
    const registrosParaInserir: Array<Record<string, unknown>> = [];

    for (const caso of CASOS_SEED) {
        const input: ProcessoRevisionalInput = {
            parametros: {
                ...baseParams,
                ...caso.parametros,
            },
            contratos: caso.contratos,
            tarifas: caso.tarifas ?? [],
            deducoes: caso.deducoes ?? [],
        };

        const { onlineByContrato, seriesEconomicas } = await prepararDadosBacenProcesso(input);
        const resultado = calcularProcessoRevisional(input, seriesEconomicas, onlineByContrato);
        const catId = catPorNome.get(caso.categoriaNome.toLowerCase()) ?? null;

        const payload = processoParaPayload(resultado, input, {
            clienteNome: caso.clienteNome,
            processoGlobal: caso.processoGlobal,
            banco: caso.contratos[0]?.instituicao ?? "",
            documentoContrato: caso.contratos[0]?.numeroContrato ?? "",
            categoriaId: catId,
            observacoes: caso.observacoes,
        });

        const ts = new Date(Date.now() - caso.diasAtras * 86400_000).toISOString();
        const emailLower = caso.autorEmail.toLowerCase();

        registrosParaInserir.push({
            ...payload,
            created_by: idsUsuarios[emailLower] ?? null,
            created_by_email: caso.autorEmail,
            created_at: ts,
            updated_at: ts,
        });
    }

    const inseridos = await adminReq<Array<{ id: string; cliente_nome: string; nivel: string; valor_total_acao: number }>>(
        "/rest/v1/revisional_calculos",
        {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify(registrosParaInserir),
        },
    );

    console.log(`Seed local concluído: ${inseridos.length} clientes gravados em ${LOCAL_URL}!`);
    for (const row of inseridos) {
        console.log(
            ` - ${row.cliente_nome} [${row.nivel}] -> R$ ${Number(row.valor_total_acao).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        );
    }
}

executarSeedLocal().catch((err) => {
    console.error("Falha no seed local:", err);
    throw err;
});
