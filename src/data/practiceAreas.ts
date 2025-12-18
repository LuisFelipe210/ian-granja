import {
    Briefcase,
    Users,
    Shield,
    Scale,
    TrendingUp,
    Home,
    Heart,
    Building2
} from "lucide-react";

export const practiceAreas = [
    {
        slug: "direito-bancario",
        icon: Briefcase,
        title: "Direito Bancário",
        description:
            "Defendemos os consumidores contra práticas abusivas de instituições financeiras, com foco na recuperação de veículos apreendidos, revisão de contratos e defesa em execuções bancárias.",
        fullDescription:
            "O Direito Bancário é uma área fundamental para restabelecer o equilíbrio nas relações entre clientes e instituições financeiras. Nossa atuação é focada em identificar e combater cláusulas abusivas, juros exorbitantes e práticas ilegais que comprometem o patrimônio do consumidor. Atuamos fortemente na defesa de busca e apreensão de veículos, analisando minuciosamente os contratos para encontrar irregularidades que possam reverter a medida ou reduzir drasticamente o saldo devedor. Além disso, defendemos clientes em ações de execução e cobrança, garantindo que nenhum excesso seja cometido pelos bancos.",
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
        icon: Users,
        title: "Direito Trabalhista",
        description:
            "Representamos trabalhadores e empresas em disputas judiciais e extrajudiciais, priorizando soluções céleres e seguras para rescisões, verbas e relações de trabalho.",
        fullDescription:
            "No âmbito do Direito Trabalhista, oferecemos uma advocacia estratégica tanto para reclamantes quanto para reclamadas. Para os trabalhadores, lutamos pelo reconhecimento de vínculos empregatícios, pagamento correto de horas extras, adicionais de insalubridade ou periculosidade e indenizações por danos morais ou assédio. Para as empresas, atuamos de forma preventiva e contenciosa, auditando contratos, reduzindo passivos trabalhistas e realizando defesas técnicas em reclamações, sempre buscando a segurança jurídica e a redução de custos com litígios desnecessários.",
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
        icon: Shield,
        title: "Direito do Consumidor",
        description:
            "Atuamos na defesa de consumidores em casos de cobranças indevidas, negativação irregular, falhas na prestação de serviços e descumprimento contratual.",
        fullDescription:
            "O Código de Defesa do Consumidor é uma ferramenta poderosa para proteger a parte mais vulnerável da relação comercial. Nossa equipe é especialista em reparar danos causados por grandes empresas, seja por falha na prestação de serviços, produtos defeituosos ou práticas comerciais desleais. Atuamos com vigor em casos de negativação indevida nos órgãos de proteção ao crédito (SPC/Serasa), buscando não apenas a limpeza do nome, mas a devida reparação financeira. Também lidamos com cancelamentos abusivos de serviços, problemas com companhias aéreas e telefonia.",
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
        icon: Scale,
        title: "Direito Empresarial",
        description:
            "Assessoria jurídica completa para empresas e associações de proteção veicular, com foco em contratos, responsabilidade civil, regulamentação e defesa administrativa.",
        fullDescription:
            "O Direito Empresarial moderno exige uma visão de negócios aliada ao conhecimento jurídico. Oferecemos suporte integral para a estruturação e manutenção de empresas, com expertise especial em Associações de Proteção Veicular. Cuidamos desde a elaboração e análise de contratos sociais e estatutos até a defesa em processos administrativos e judiciais. Nossa consultoria visa blindar a operação da empresa, garantindo compliance com as normas vigentes, gestão de riscos e proteção patrimonial dos sócios, permitindo que o empresário foque no crescimento do seu negócio.",
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
        icon: TrendingUp,
        title: "Superendividamento",
        description:
            "Ajudamos consumidores a reorganizar sua vida financeira, com ações para revisão de dívidas, negociação com bancos e defesa contra abusos de crédito.",
        fullDescription:
            "Com base na Lei do Superendividamento (Lei 14.181/2021), atuamos para devolver a dignidade financeira a pessoas que perderam o controle de suas dívidas. Nosso trabalho consiste em elaborar um plano de repactuação de débitos, negociando diretamente com credores para obter descontos significativos e parcelamentos que caibam no bolso do cliente, preservando o mínimo existencial. Analisamos se houve concessão irresponsável de crédito por parte das instituições e buscamos judicialmente a revisão de contratos que levaram à situação de insolvência civil.",
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
        icon: Heart,
        title: "Planos de Saúde",
        description:
            "Defesa de usuários contra negativas de cobertura, reajustes abusivos, cancelamentos indevidos e demora em autorizações de tratamentos médicos.",
        fullDescription:
            "A saúde não pode esperar, e as operadoras de planos de saúde frequentemente desrespeitam as normas da ANS e o contrato firmado. Nossa atuação é focada na obtenção rápida de liminares para garantir tratamentos, cirurgias, fornecimento de medicamentos de alto custo e internações de emergência negadas indevidamente. Combatemos também os reajustes abusivos (seja por faixa etária ou sinistralidade) e os cancelamentos unilaterais de contratos, garantindo que o beneficiário mantenha seu acesso à saúde com qualidade e respeito.",
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
        icon: Home,
        title: "Direito Imobiliário",
        description:
            "Atuamos em questões relacionadas a compra e venda de imóveis, distratos, financiamentos, usucapião e problemas com construtoras e incorporadoras.",
        fullDescription:
            "O patrimônio imobiliário é, muitas vezes, o bem mais valioso de uma família ou empresa. Oferecemos segurança jurídica em transações de compra e venda, analisando toda a documentação para evitar fraudes e passivos ocultos. Atuamos fortemente em casos de atraso na entrega de imóveis na planta, vícios construtivos e distratos (devolução do imóvel). Além disso, somos especialistas em regularização fundiária através de usucapião (judicial e extrajudicial) e em ações de reintegração de posse e despejo.",
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
        icon: Building2,
        title: "Direito Civil",
        description:
            "Atuação ampla em questões cíveis, incluindo responsabilidade civil, contratos, família e sucessões, sempre com foco na melhor solução para nossos clientes.",
        fullDescription:
            "O Direito Civil é a base das relações privadas e exige uma advocacia sensível e técnica. Atuamos na resolução de conflitos familiares (divórcios, guarda, pensão), sucessórios (inventários e testamentos) e obrigacionais. Temos forte expertise em responsabilidade civil, buscando indenizações justas para quem sofreu danos materiais ou morais. Seja na elaboração de um contrato complexo ou na defesa em uma disputa judicial, nosso objetivo é garantir que os direitos civis de nossos clientes sejam integralmente respeitados.",
        services: [
            "Ações indenizatórias",
            "Contratos em geral",
            "Inventários e partilhas",
            "Divórcios e união estável",
            "Pensão alimentícia",
        ],
    },
];