import type { ReactNode } from "react";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { PageHero } from "@/components/PageHero";
import { Grifo } from "@/components/Grifo";
import { ADDRESS_LINES, EMAIL, OAB } from "@/lib/contact";

const ATUALIZADO_EM = "18 de novembro de 2026";

const Secao = ({ titulo, children }: { titulo: string; children: ReactNode }) => (
    <section className="border-t border-ink/15 py-10 first:border-t-0 first:pt-0">
        <h2 className="subdisplay text-2xl text-ink">{titulo}</h2>
        <div className="mt-4 max-w-[68ch] space-y-4 text-lg leading-relaxed text-ink/80">{children}</div>
    </section>
);

const Lista = ({ itens }: { itens: ReactNode[] }) => (
    <ul className="list-disc space-y-2 pl-6 marker:text-gold-deep">
        {itens.map((item, i) => (
            <li key={i}>{item}</li>
        ))}
    </ul>
);

const LinkTexto = ({ href, children }: { href: string; children: ReactNode }) => (
    <a
        href={href}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
        className="font-medium text-ink underline decoration-gold underline-offset-4 hover:decoration-ink"
    >
        {children}
    </a>
);

const Privacidade = () => (
    <div className="min-h-screen bg-background">
        <Navigation />

        <main>
            <PageHero
                title={[
                    "Política de",
                    <>
                        <Grifo delay={900}>privacidade.</Grifo>
                    </>,
                ]}
                lead="Quais dados o escritório recebe, para que usa, com quem compartilha e como você exerce os seus direitos pela Lei Geral de Proteção de Dados (LGPD)."
            />

            <section className="bg-background">
                <div className="container py-16 md:py-24">
                    <div className="mx-auto max-w-3xl">
                        <p className="text-sm text-muted-foreground">Última atualização: {ATUALIZADO_EM}.</p>

                        <div className="mt-10">
                            <Secao titulo="Quem cuida dos seus dados">
                                <p>
                                    O responsável pelo tratamento dos dados (controlador) é o escritório Ian Granja
                                    Advogados, do advogado Ian Granja, {OAB}, com endereço em {ADDRESS_LINES.join(", ")}.
                                </p>
                                <p>
                                    Para qualquer assunto sobre os seus dados, inclusive como encarregado (art. 41 da
                                    LGPD), fale pelo e-mail <LinkTexto href={`mailto:${EMAIL}`}>{EMAIL}</LinkTexto>.
                                </p>
                            </Secao>

                            <Secao titulo="Que dados recebemos">
                                <Lista
                                    itens={[
                                        <>
                                            <strong className="text-ink">Formulário de contato:</strong> nome,
                                            telefone, e-mail e a mensagem que você escrever.
                                        </>,
                                        <>
                                            <strong className="text-ink">WhatsApp, e-mail e Instagram:</strong> o que
                                            você enviar nessas conversas, inclusive documentos como contratos, extratos
                                            e notificações.
                                        </>,
                                        <>
                                            <strong className="text-ink">Atendimento do seu caso:</strong> dados
                                            necessários para analisar e conduzir o caso, como dados pessoais, contratos,
                                            valores e informações de processos. Em alguns casos, isso pode incluir dados
                                            sensíveis, como informações de saúde em causas contra planos de saúde.
                                        </>,
                                        <>
                                            <strong className="text-ink">Navegação no site:</strong> o site não usa
                                            cookies de publicidade nem ferramentas de rastreamento ou estatística. A
                                            empresa de hospedagem registra dados técnicos de acesso, como endereço IP e
                                            tipo de navegador, para segurança e funcionamento do site.
                                        </>,
                                        <>
                                            <strong className="text-ink">Calculadora de juros:</strong> os valores que
                                            você digita ficam no seu navegador e são comparados com dados públicos do
                                            Banco Central. Eles não são enviados ao escritório.
                                        </>,
                                    ]}
                                />
                            </Secao>

                            <Secao titulo="Para que usamos e com qual base legal">
                                <Lista
                                    itens={[
                                        <>
                                            Responder ao seu contato e avaliar o seu caso, a seu pedido (art. 7º, V,
                                            da LGPD).
                                        </>,
                                        <>
                                            Prestar o serviço jurídico contratado, inclusive em processos judiciais e
                                            administrativos (art. 7º, V e VI; e art. 11, II, "d", para dados
                                            sensíveis).
                                        </>,
                                        <>Cumprir obrigações legais e as regras da OAB (art. 7º, II).</>,
                                        <>
                                            Manter o site e o sistema do escritório seguros e funcionando (art. 7º,
                                            IX, legítimo interesse).
                                        </>,
                                    ]}
                                />
                                <p>Os seus dados não são vendidos nem usados para publicidade.</p>
                            </Secao>

                            <Secao titulo="Sistema interno do escritório">
                                <p>
                                    Os dados dos casos em andamento ficam num sistema interno de acesso restrito à
                                    equipe autorizada do escritório, protegido por login. Nele o escritório faz
                                    cálculos revisionais, organiza prazos e acompanha publicações processuais.
                                </p>
                                <p>
                                    As publicações vêm do Diário de Justiça Eletrônico Nacional (DJEN, do CNJ) e as
                                    taxas de juros, do Banco Central, ambas fontes públicas. Para agilizar a leitura de
                                    contratos, o escritório pode enviar o documento ao serviço de inteligência artificial
                                    Claude, da Anthropic, apenas para extrair os dados do contrato. Pelos termos
                                    comerciais da Anthropic, os dados enviados pela API não são usados para treinar
                                    modelos de IA.
                                </p>
                            </Secao>

                            <Secao titulo="Google Drive">
                                <p>
                                    O sistema interno pode se conectar ao Google Drive da equipe do escritório para
                                    anexar contratos guardados no Drive e salvar os laudos gerados nas pastas dos
                                    clientes.
                                </p>
                                <p>
                                    Para isso ele usa só a permissão restrita do Google (<code>drive.file</code>): acessa
                                    apenas os arquivos e pastas que a pessoa escolhe no seletor do Drive ou que o
                                    próprio sistema cria. Ele não lista nem lê o restante do Drive. O acesso fica só na
                                    sessão aberta do navegador, expira em cerca de uma hora e não é gravado no sistema.
                                </p>
                                <p>
                                    O uso e a transferência, para qualquer outro aplicativo, de informações recebidas
                                    das APIs do Google seguem a{" "}
                                    <LinkTexto href="https://developers.google.com/terms/api-services-user-data-policy">
                                        Política de Dados do Usuário dos Serviços de API do Google
                                    </LinkTexto>
                                    , incluindo os requisitos de Uso Limitado. Os dados obtidos do Google Drive são
                                    usados só para essas funções do sistema, não são vendidos, não são usados para
                                    publicidade e não são usados para treinar modelos de inteligência artificial.
                                </p>
                            </Secao>

                            <Secao titulo="Com quem compartilhamos">
                                <p>
                                    O escritório usa prestadores de serviço (operadores) que tratam dados em nome dele,
                                    apenas para as finalidades acima:
                                </p>
                                <Lista
                                    itens={[
                                        "Vercel: hospedagem do site.",
                                        "Google: envio dos e-mails do formulário de contato (Gmail) e, quando usado, Google Drive.",
                                        "Supabase: banco de dados do sistema interno.",
                                        "Anthropic: leitura automática de contratos (Claude).",
                                        "Meta: WhatsApp e Instagram, quando você usa esses canais para falar com o escritório.",
                                    ]}
                                />
                                <p>
                                    Alguns desses serviços podem processar dados fora do Brasil, com as garantias
                                    previstas no art. 33 da LGPD. Dados também podem ser apresentados ao Poder
                                    Judiciário e a outros órgãos públicos quando isso for necessário ao seu caso ou
                                    exigido por lei.
                                </p>
                            </Secao>

                            <Secao titulo="Por quanto tempo guardamos">
                                <p>
                                    Os dados ficam guardados enquanto forem necessários para o atendimento e para o seu
                                    caso. Depois disso, podem ser mantidos pelo prazo exigido por lei ou pelo tempo
                                    necessário para a defesa de direitos, e então são apagados. Contatos que não viraram
                                    um caso são apagados quando deixam de ser necessários.
                                </p>
                            </Secao>

                            <Secao titulo="Seus direitos">
                                <p>Pela LGPD (art. 18), você pode pedir a qualquer momento:</p>
                                <Lista
                                    itens={[
                                        "confirmação de que tratamos os seus dados e acesso a eles;",
                                        "correção de dados incompletos, inexatos ou desatualizados;",
                                        "anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade com a lei;",
                                        "portabilidade dos dados;",
                                        "informação sobre com quem os seus dados foram compartilhados;",
                                        "revogação do consentimento, quando ele for a base do tratamento.",
                                    ]}
                                />
                                <p>
                                    Para fazer um pedido, escreva para{" "}
                                    <LinkTexto href={`mailto:${EMAIL}`}>{EMAIL}</LinkTexto>. Você também pode reclamar
                                    à{" "}
                                    <LinkTexto href="https://www.gov.br/anpd">
                                        Autoridade Nacional de Proteção de Dados (ANPD)
                                    </LinkTexto>
                                    .
                                </p>
                            </Secao>

                            <Secao titulo="Segurança">
                                <p>
                                    O site e o sistema usam conexão criptografada (HTTPS), e o acesso ao sistema interno é
                                    restrito à equipe autorizada, com login. O sigilo profissional do advogado também se
                                    aplica às informações do seu caso.
                                </p>
                            </Secao>

                            <Secao titulo="Mudanças nesta política">
                                <p>
                                    Esta política pode ser atualizada. A data da última atualização fica sempre no topo
                                    desta página.
                                </p>
                            </Secao>
                        </div>
                    </div>
                </div>
            </section>
        </main>

        <Footer />
    </div>
);

export default Privacidade;
