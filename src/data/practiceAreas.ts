export interface PracticeArea {
    slug: string;
    title: string;
    description: string;
    fullDescription: string;
    services: string[];
}

export const practiceAreas: PracticeArea[] = [
    {
        slug: "direito-bancario",
        title: "Direito Bancário",
        description:
            "Defesa contra práticas abusivas de bancos e financeiras, com foco em busca e apreensão de veículos, revisão de contratos e defesa em cobranças judiciais.",
        fullDescription:
            "O Direito Bancário ajuda a equilibrar a relação entre quem toma crédito e as instituições financeiras. O trabalho começa pela leitura do contrato para identificar juros muito acima da média do Banco Central, tarifas embutidas e falhas de notificação. Atuamos na defesa em ações de busca e apreensão de veículos, na revisão de contratos de financiamento e empréstimo e na resposta a execuções e cobranças judiciais movidas por bancos.",
        services: [
            "Recuperação de veículos financiados",
            "Revisão de contratos bancários",
            "Defesa em execuções bancárias",
            "Questionamento de juros abusivos",
            "Ações contra cobranças indevidas",
        ],
    },
    {
        slug: "direito-trabalhista",
        title: "Direito Trabalhista",
        description:
            "Atuação para trabalhadores e empresas em acordos e ações trabalhistas, envolvendo rescisões, verbas não pagas, horas extras e relações de trabalho.",
        fullDescription:
            "No Direito Trabalhista, atendemos tanto trabalhadores quanto empregadores. Para quem saiu do emprego ou ainda está trabalhando, conferimos o termo de rescisão e apuramos diferenças de vínculo, horas extras, adicionais de insalubridade ou periculosidade e pedidos de indenização por assédio. Para empresas, fazemos revisão preventiva de contratos e rotinas internas e defesa técnica em reclamações trabalhistas.",
        services: [
            "Reclamações trabalhistas",
            "Rescisões contratuais",
            "Horas extras e adicionais",
            "Assédio moral e dano moral",
            "Consultoria preventiva para empresas",
        ],
    },
    {
        slug: "direito-consumidor",
        title: "Direito do Consumidor",
        description:
            "Defesa do consumidor em casos de negativação indevida, cobranças sem origem, produto com defeito, falha na prestação de serviço e cancelamento de contrato.",
        fullDescription:
            "Quando uma empresa cobra por algo que não foi contratado, deixa de entregar o combinado ou inclui o nome do cliente no SPC ou Serasa sem aviso ou sem dívida válida, o Código de Defesa do Consumidor prevê a correção do problema e possível reparação. Atuamos em casos de negativação indevida, falhas de serviço, cancelamentos unilaterais e conflitos com operadoras de telefonia, bancos e companhias aéreas.",
        services: [
            "Negativação indevida",
            "Defeitos em produtos e serviços",
            "Cobranças abusivas",
            "Cancelamento de contratos",
            "Indenizações por danos morais e materiais",
        ],
    },
    {
        slug: "direito-empresarial",
        title: "Direito Empresarial",
        description:
            "Assessoria jurídica para empresas e associações de proteção veicular em contratos, questões societárias, adequação regulatória e defesa administrativa.",
        fullDescription:
            "Empresas e associações precisam de contratos claros para trabalhar com segurança no dia a dia. Oferecemos acompanhamento jurídico na elaboração e revisão de contratos sociais, estatutos e contratos de prestação de serviços, com experiência específica junto a Associações de Proteção Veicular. Também atuamos em defesas administrativas, processos judiciais, recuperação judicial e organização preventiva de riscos do negócio.",
        services: [
            "Elaboração e revisão de contratos",
            "Consultoria societária",
            "Recuperação judicial",
            "Defesas administrativas",
            "Compliance empresarial",
        ],
    },
    {
        slug: "superendividamento",
        title: "Superendividamento",
        description:
            "Reorganização de dívidas com base na Lei do Superendividamento, buscando renegociação conjunta com credores e preservação do mínimo para viver.",
        fullDescription:
            "Com base na Lei 14.181/2021 (Lei do Superendividamento), analisamos o conjunto de dívidas de consumo que passou a comprometer a renda básica do mês. O trabalho envolve montar um plano de pagamento compatível com o orçamento familiar, negociar com os credores em conjunto e verificar se houve concessão de crédito sem avaliação da capacidade de pagamento ou encargos irregulares nos contratos.",
        services: [
            "Negociação de dívidas",
            "Ações de superendividamento",
            "Suspensão de protestos",
            "Planejamento financeiro jurídico",
            "Defesa contra execuções múltiplas",
        ],
    },
    {
        slug: "planos-saude",
        title: "Planos de Saúde",
        description:
            "Defesa de beneficiários contra negativa de tratamento, reajuste abusivo, cancelamento de contrato e demora na autorização de exames e cirurgias.",
        fullDescription:
            "Quando o plano de saúde recusa uma cirurgia, um exame, um medicamento prescrito pelo médico ou uma internação de urgência, avaliamos rapidamente a negativa à luz do contrato, da Lei 14.454/2022 e das regras da ANS para pedir autorização judicial quando cabível. Também analisamos aumentos por faixa etária ou sinistralidade e casos de cancelamento indevido do plano.",
        services: [
            "Negativas de cobertura",
            "Reajustes abusivos",
            "Cancelamento indevido",
            "Autorização de cirurgias e exames",
            "Internações de emergência",
        ],
    },
    {
        slug: "direito-imobiliario",
        title: "Direito Imobiliário",
        description:
            "Acompanhamento em compra e venda de imóveis, atraso na entrega pela construtora, distrato, financiamento e regularização por usucapião.",
        fullDescription:
            "Na compra ou venda de um imóvel, conferimos a documentação do bem e as cláusulas do contrato para evitar problemas futuros. Para quem comprou na planta e enfrenta atraso além do prazo de tolerância, defeitos na construção ou retenção excessiva na devolução do imóvel (distrato), atuamos na cobrança dos direitos previstos em lei. Também cuidamos de regularização por usucapião judicial ou em cartório, reintegração de posse e despejo.",
        services: [
            "Contratos de compra e venda",
            "Distrato e rescisão",
            "Usucapião",
            "Ações contra construtoras",
            "Regularização imobiliária",
        ],
    },
    {
        slug: "direito-civil",
        title: "Direito Civil",
        description:
            "Atuação em inventário, divórcio, pensão alimentícia, elaboração e revisão de contratos e ações de indenização por danos materiais ou morais.",
        fullDescription:
            "No Direito Civil, cuidamos de questões do dia a dia pessoal e familiar que exigem orientação técnica clara: abertura de inventário e partilha de bens em cartório ou na Justiça, divórcio, guarda e pensão alimentícia. Também atuamos na revisão de contratos particulares e em ações indenizatórias por prejuízos materiais ou morais, buscando a solução mais direta e adequada para o caso.",
        services: [
            "Ações indenizatórias",
            "Contratos em geral",
            "Inventários e partilhas",
            "Divórcios e união estável",
            "Pensão alimentícia",
        ],
    },
];
