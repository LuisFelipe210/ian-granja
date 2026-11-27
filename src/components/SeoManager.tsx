import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import seo from "@/data/seo.json";
import { practiceAreas } from "@/data/practiceAreas";

const pages = seo.pages as Record<string, { title: string; description: string }>;

/** Páginas de uso interno (e suas sub-rotas): título próprio, fora do Google e do sitemap. */
const BASE_SISTEMA = "/ferramentas/calculadora-revisional";

/** Título da aba do navegador para cada tela do sistema interno (mesmos nomes do menu lateral). */
const TITULOS_SISTEMA: Array<[prefixo: string, titulo: string]> = [
    ["/agenda", "Agenda"],
    ["/processos", "Processos DJEN"],
    ["/historico", "Carteira"],
    ["/crm", "CRM"],
    ["/painel", "Painel analítico"],
    ["/clientes", "Clientes"],
    ["/documentos", "Documentos"],
    ["/configuracoes", "Configurações"],
    ["/categorias", "Configurações"],
    ["/caso/", "Ficha do cliente"],
    ["/calculo", "Calculadora"],
];

const resolvePrivatePage = (path: string): { title: string; description: string } | null => {
    if (path !== BASE_SISTEMA && !path.startsWith(`${BASE_SISTEMA}/`)) return null;
    const subRota = path.slice(BASE_SISTEMA.length);
    const tela =
        subRota === "" || subRota === "/"
            ? "Início"
            : TITULOS_SISTEMA.find(([prefixo]) => subRota.startsWith(prefixo))?.[1];
    return {
        title: `${tela ?? "Sistema"} | Calculadora revisional`,
        description: "Ferramenta interna.",
    };
};

const NOT_FOUND = {
    title: `Página não encontrada | ${seo.siteName}`,
    description: "A página que você procurou não existe ou foi movida.",
};

const setAttr = (selector: string, attr: string, value: string) => {
    document.head.querySelector(selector)?.setAttribute(attr, value);
};

const BREADCRUMB_ID = "ld-breadcrumb";

/** Trilha de navegação em dados estruturados, só nas páginas de área. */
const breadcrumbFor = (path: string) => {
    const area = practiceAreas.find((item) => `/atuacao/${item.slug}` === path);
    if (!area) return null;

    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem", position: 1, name: "Início", item: `${seo.siteUrl}/` },
            { "@type": "ListItem", position: 2, name: "Áreas de atuação", item: `${seo.siteUrl}/atuacao` },
            { "@type": "ListItem", position: 3, name: area.title, item: `${seo.siteUrl}${path}` },
        ],
    };
};

/**
 * Mantém título, descrição, canonical e Open Graph em dia a cada troca de rota.
 * Os mesmos textos (src/data/seo.json) são gravados no HTML de cada rota pelo
 * scripts/generate-seo.mjs durante o build, para quem não executa JavaScript.
 */
export const SeoManager = () => {
    const { pathname } = useLocation();

    useEffect(() => {
        const path = pathname === "/" ? "/" : pathname.replace(/\/+$/, "");
        const page = pages[path];
        const privatePage = resolvePrivatePage(path);
        const { title, description } = page ?? privatePage ?? NOT_FOUND;
        const url = `${seo.siteUrl}${path === "/" ? "/" : path}`;

        document.title = title;
        setAttr('meta[name="description"]', "content", description);
        setAttr('meta[name="robots"]', "content", page ? "index, follow" : privatePage ? "noindex, nofollow" : "noindex, follow");
        const canonicalEl = document.head.querySelector('link[rel="canonical"]');
        if (page) {
            if (canonicalEl) {
                canonicalEl.setAttribute("href", url);
            } else {
                const link = document.createElement("link");
                link.rel = "canonical";
                link.href = url;
                document.head.appendChild(link);
            }
        } else {
            canonicalEl?.remove();
        }
        setAttr('meta[property="og:title"]', "content", title);
        setAttr('meta[property="og:description"]', "content", description);
        setAttr('meta[property="og:url"]', "content", url);
        setAttr('meta[name="twitter:title"]', "content", title);
        setAttr('meta[name="twitter:description"]', "content", description);

        document.getElementById(BREADCRUMB_ID)?.remove();
        const breadcrumb = breadcrumbFor(path);
        if (breadcrumb) {
            const script = document.createElement("script");
            script.id = BREADCRUMB_ID;
            script.type = "application/ld+json";
            script.textContent = JSON.stringify(breadcrumb);
            document.head.appendChild(script);
        }
    }, [pathname]);

    return null;
};
