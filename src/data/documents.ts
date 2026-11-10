// Documentos ilustrativos usados nas folhas grifadas do site.
// São exemplos redigidos para o site, não documentos reais de clientes.
// As notas explicam o trecho em linguagem simples e não prometem resultado.

export type DocPart = string | { mark: string };

export interface DocClause {
    parts: DocPart[];
    /** Nota de margem em português claro, ligada ao trecho grifado da cláusula. */
    note?: string;
}

export interface LegalDoc {
    /** Rótulo curto usado nas abas do início. */
    tab: string;
    /** Versão curta do rótulo, para as abas caberem lado a lado no celular. */
    tabShort?: string;
    kind: string;
    ref: string;
    clauses: DocClause[];
}

/** A frase com que o cliente costuma chegar, por área. */
export const areaPhrases: Record<string, string> = {
    "direito-bancario": "Levaram meu carro.",
    "direito-trabalhista": "Saí da empresa e não recebi tudo.",
    "direito-consumidor": "Negativaram meu nome.",
    "direito-empresarial": "Preciso de um contrato que me proteja.",
    superendividamento: "As dívidas passaram do meu salário.",
    "planos-saude": "O plano negou o tratamento.",
    "direito-imobiliario": "A construtora atrasou a entrega.",
    "direito-civil": "Preciso resolver inventário, divórcio ou pensão.",
};

export const areaDocuments: Record<string, LegalDoc> = {
    "direito-bancario": {
        tab: "Financiamento",
        tabShort: "Banco",
        kind: "Cédula de crédito bancário",
        ref: "Cláusula 7ª",
        clauses: [
            {
                parts: [
                    "O emitente declara ciência de que sobre o saldo devedor incidirão ",
                    { mark: "juros capitalizados mensalmente" },
                    ", à taxa efetiva indicada no quadro resumo, acrescidos de tarifas, seguros e demais despesas previstas neste instrumento.",
                ],
                note: "Juros sobre juros. Quando a taxa fica muito acima da média do Banco Central, cabe pedir revisão.",
            },
            {
                parts: [
                    "O atraso de qualquer parcela autoriza o credor a considerar vencida toda a dívida e a promover a ",
                    { mark: "busca e apreensão do bem" },
                    " dado em garantia.",
                ],
                note: "Antes de apreender, o banco precisa comprovar que avisou do atraso. Sem isso, há defesa.",
            },
            {
                parts: ["O emitente autoriza o débito em conta de quaisquer valores devidos em razão deste contrato."],
            },
        ],
    },
    "planos-saude": {
        tab: "Plano de saúde",
        tabShort: "Plano",
        kind: "Resposta da operadora",
        ref: "Solicitação de cobertura",
        clauses: [
            {
                parts: [
                    "Informamos que a solicitação de cobertura foi indeferida, uma vez que o ",
                    { mark: "procedimento não consta do rol da ANS" },
                    ", conforme as condições gerais do contrato.",
                ],
                note: "O rol não encerra a conversa: a Lei 14.454/2022 prevê cobertura fora dele em certos casos.",
            },
            {
                parts: [
                    "Ressaltamos ainda que o beneficiário se encontra em ",
                    { mark: "período de carência" },
                    " para internações, nos termos da cláusula 12.",
                ],
                note: "Em urgência e emergência, a carência máxima é de 24 horas.",
            },
            {
                parts: ["Permanecemos à disposição pela central de atendimento."],
            },
        ],
    },
    "direito-trabalhista": {
        tab: "Rescisão",
        kind: "Termo de rescisão do contrato de trabalho",
        ref: "Quitação",
        clauses: [
            {
                parts: [
                    "O empregado declara ter recebido as verbas discriminadas neste termo, dando ",
                    { mark: "plena, geral e irrevogável quitação" },
                    " do contrato de trabalho.",
                ],
                note: "A quitação vale só para o que está discriminado no termo. O que ficou de fora ainda pode ser cobrado.",
            },
            {
                parts: [
                    "Horas extraordinárias: ",
                    { mark: "não há valores a pagar" },
                    ". Adicional de insalubridade: não se aplica.",
                ],
                note: "Fazia hora extra e ela não aparece aqui? O prazo para cobrar é de dois anos após a saída.",
            },
            {
                parts: ["Saldo de salário, férias proporcionais e 13º proporcional conforme demonstrativo anexo."],
            },
        ],
    },
    "direito-consumidor": {
        tab: "Negativação",
        kind: "Comunicado de inclusão em cadastro de inadimplentes",
        ref: "Aviso ao consumidor",
        clauses: [
            {
                parts: [
                    "Comunicamos que, não havendo pagamento em 10 dias, ",
                    { mark: "seu nome será incluído" },
                    " nos cadastros de proteção ao crédito.",
                ],
                note: "O aviso por escrito é obrigatório. Negativação sem aviso, ou por dívida que não existe, gera direito a indenização.",
            },
            {
                parts: [
                    "O débito refere-se ao ",
                    { mark: "contrato nº 0048-2219" },
                    ", no valor atualizado constante deste comunicado.",
                ],
                note: "Não reconhece esse contrato? Quem cobra é que precisa provar que a dívida existe.",
            },
            {
                parts: ["Caso o pagamento já tenha sido efetuado, desconsidere este aviso."],
            },
        ],
    },
    superendividamento: {
        tab: "Dívidas",
        kind: "Demonstrativo de operações de crédito",
        ref: "Resumo mensal",
        clauses: [
            {
                parts: [
                    "Total de parcelas consignadas e debitadas em conta no período: ",
                    { mark: "68% da remuneração líquida" },
                    ".",
                ],
                note: "A Lei 14.181/2021 protege o mínimo para viver. Dá para pedir um plano único de pagamento com todos os credores.",
            },
            {
                parts: [
                    "Crédito pré-aprovado disponível para contratação imediata, ",
                    { mark: "sem análise de comprometimento de renda" },
                    ".",
                ],
                note: "Banco que empresta sem avaliar se você consegue pagar também responde por isso.",
            },
            {
                parts: ["Consulte as condições no aplicativo."],
            },
        ],
    },
    "direito-imobiliario": {
        tab: "Imóvel",
        kind: "Promessa de compra e venda de imóvel",
        ref: "Cláusulas 9ª e 14ª",
        clauses: [
            {
                parts: [
                    "A entrega das chaves poderá ser prorrogada por ",
                    { mark: "180 dias de tolerância" },
                    ", sem qualquer ônus à vendedora.",
                ],
                note: "A tolerância de 180 dias é aceita. Passou disso, o atraso gera direito a indenização ou ao desfazimento do negócio.",
            },
            {
                parts: [
                    "Em caso de distrato por iniciativa do comprador, a vendedora reterá ",
                    { mark: "70% dos valores pagos" },
                    ".",
                ],
                note: "A lei limita a retenção: em regra até 25%, e até 50% só em casos específicos.",
            },
            {
                parts: ["As despesas de corretagem não serão restituídas."],
            },
        ],
    },
    "direito-empresarial": {
        tab: "Contrato",
        kind: "Contrato de prestação de serviços",
        ref: "Cláusulas 11ª e 15ª",
        clauses: [
            {
                parts: [
                    "O descumprimento de qualquer obrigação sujeita a contratada a ",
                    { mark: "multa de 200% do valor do contrato" },
                    ".",
                ],
                note: "Multa não pode passar do valor da obrigação principal, e o juiz pode reduzir a que for excessiva.",
            },
            {
                parts: [
                    "O presente contrato será ",
                    { mark: "renovado automaticamente" },
                    " por períodos iguais e sucessivos, salvo denúncia com 180 dias de antecedência.",
                ],
                note: "Renovação automática com aviso tão longo é ponto para negociar antes de assinar.",
            },
            {
                parts: ["As partes elegem o foro da sede da contratante."],
            },
        ],
    },
    "direito-civil": {
        tab: "Inventário",
        kind: "Inventário e partilha",
        ref: "Primeiras declarações",
        clauses: [
            {
                parts: [
                    "O inventário deve ser aberto em ",
                    { mark: "até dois meses" },
                    " a contar do falecimento.",
                ],
                note: "Passou do prazo, o estado cobra multa sobre o imposto de herança. Vale abrir o quanto antes.",
            },
            {
                parts: [
                    "Havendo consenso entre herdeiros maiores e capazes, a partilha poderá ser feita ",
                    { mark: "por escritura pública" },
                    ".",
                ],
                note: "Em cartório costuma ser mais rápido do que na Justiça, e ainda assim exige advogado.",
            },
            {
                parts: ["Os bens serão avaliados para fins de recolhimento do imposto."],
            },
        ],
    },
};

/** Documentos que aparecem nas abas do início, nesta ordem. */
export const heroDocumentSlugs = [
    "direito-bancario",
    "planos-saude",
    "direito-trabalhista",
    "direito-consumidor",
];
