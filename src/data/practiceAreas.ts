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
        services: [
            "Ações indenizatórias",
            "Contratos em geral",
            "Inventários e partilhas",
            "Divórcios e união estável",
            "Pensão alimentícia",
        ],
    },
];