import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import seo from "@/data/seo.json";
import { practiceAreas } from "@/data/practiceAreas";

const pages = seo.pages as Record<string, { title: string; description: string }>;

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
        const { title, description } = page ?? NOT_FOUND;
        const url = `${seo.siteUrl}${path === "/" ? "/" : path}`;

        document.title = title;
        setAttr('meta[name="description"]', "content", description);
        setAttr('meta[name="robots"]', "content", page ? "index, follow" : "noindex, follow");
        setAttr('link[rel="canonical"]', "href", url);
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
