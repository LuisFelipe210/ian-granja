// Roda depois do `vite build`.
// Para cada rota de src/data/seo.json, grava dist/<rota>/index.html com o título,
// a descrição, o canonical e o Open Graph daquela página já no HTML. Assim buscadores
// e prévias de link (WhatsApp, Instagram) leem os dados certos sem executar JavaScript.
// Também gera dist/sitemap.xml.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const seo = JSON.parse(readFileSync(join(root, "src/data/seo.json"), "utf8"));
const template = readFileSync(join(dist, "index.html"), "utf8");

const escapeHtml = (text) =>
    text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Troca um trecho do HTML e falha se o trecho não existir, para o build não passar em silêncio. */
const replaceOnce = (html, pattern, replacement, label) => {
    if (!pattern.test(html)) {
        throw new Error(`generate-seo: não encontrei ${label} em dist/index.html`);
    }
    return html.replace(pattern, replacement);
};

const attr = (selector, attribute) => new RegExp(`(<(?:meta|link) ${selector} ${attribute}=")[^"]*(")`);

const render = (path, page) => {
    const url = `${seo.siteUrl}${path === "/" ? "/" : path}`;
    const title = escapeHtml(page.title);
    const description = escapeHtml(page.description);

    let html = template;
    html = replaceOnce(html, /<title>[\s\S]*?<\/title>/, `<title>${title}</title>`, "<title>");
    html = replaceOnce(html, attr('name="description"', "content"), `$1${description}$2`, "meta description");
    html = replaceOnce(html, attr('rel="canonical"', "href"), `$1${url}$2`, "link canonical");
    html = replaceOnce(html, attr('property="og:title"', "content"), `$1${title}$2`, "og:title");
    html = replaceOnce(html, attr('property="og:description"', "content"), `$1${description}$2`, "og:description");
    html = replaceOnce(html, attr('property="og:url"', "content"), `$1${url}$2`, "og:url");
    html = replaceOnce(html, attr('name="twitter:title"', "content"), `$1${title}$2`, "twitter:title");
    html = replaceOnce(html, attr('name="twitter:description"', "content"), `$1${description}$2`, "twitter:description");
    return html;
};

const paths = Object.keys(seo.pages);

for (const path of paths) {
    const html = render(path, seo.pages[path]);
    const file = path === "/" ? join(dist, "index.html") : join(dist, path, "index.html");
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, html);
}

const today = new Date().toISOString().slice(0, 10);
const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...paths.map(
        (path) =>
            `  <url><loc>${seo.siteUrl}${path === "/" ? "/" : path}</loc><lastmod>${today}</lastmod></url>`,
    ),
    "</urlset>",
    "",
].join("\n");

writeFileSync(join(dist, "sitemap.xml"), sitemap);

console.log(`generate-seo: ${paths.length} páginas e sitemap.xml gravados em dist/`);
