// Roda depois do `vite build`.
// Para cada rota de src/data/seo.json, grava dist/<rota>/index.html com o título,
// a descrição, o canonical e o Open Graph daquela página já no HTML. Assim buscadores
// e prévias de link (WhatsApp, Instagram) leem os dados certos sem executar JavaScript.
// Também gera dist/sitemap.xml.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const seo = JSON.parse(readFileSync(join(root, "src/data/seo.json"), "utf8"));
const template = readFileSync(join(dist, "index.html"), "utf8");

const escapeHtml = (text) =>
    text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&#39;");

const escapeXml = (text) =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** Troca um trecho do HTML usando função (imune a sequências `$` como `R$`) e falha se não existir. */
const replaceOnce = (html, pattern, replacer, label) => {
    if (!pattern.test(html)) {
        throw new Error(`generate-seo: não encontrei ${label} em dist/index.html`);
    }
    return html.replace(pattern, replacer);
};

const attr = (selector, attribute) => new RegExp(`(<(?:meta|link) ${selector} ${attribute}=")[^"]*(")`);

const render = (path, page) => {
    const url = escapeHtml(`${seo.siteUrl}${path === "/" ? "/" : path}`);
    const title = escapeHtml(page.title);
    const description = escapeHtml(page.description);

    let html = template;
    html = replaceOnce(html, /<title>[\s\S]*?<\/title>/, () => `<title>${title}</title>`, "<title>");
    html = replaceOnce(html, attr('name="description"', "content"), (_m, a, b) => `${a}${description}${b}`, "meta description");
    html = replaceOnce(html, attr('rel="canonical"', "href"), (_m, a, b) => `${a}${url}${b}`, "link canonical");
    html = replaceOnce(html, attr('property="og:title"', "content"), (_m, a, b) => `${a}${title}${b}`, "og:title");
    html = replaceOnce(html, attr('property="og:description"', "content"), (_m, a, b) => `${a}${description}${b}`, "og:description");
    html = replaceOnce(html, attr('property="og:url"', "content"), (_m, a, b) => `${a}${url}${b}`, "og:url");
    html = replaceOnce(html, attr('name="twitter:title"', "content"), (_m, a, b) => `${a}${title}${b}`, "twitter:title");
    html = replaceOnce(html, attr('name="twitter:description"', "content"), (_m, a, b) => `${a}${description}${b}`, "twitter:description");
    return html;
};

const paths = Object.keys(seo.pages);

for (const path of paths) {
    const html = render(path, seo.pages[path]);
    const file = path === "/" ? join(dist, "index.html") : resolve(dist, `.${path}`, "index.html");
    if (file !== join(dist, "index.html") && !file.startsWith(dist + sep)) {
        throw new Error(`generate-seo: caminho fora de dist/: ${path}`);
    }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, html);
}

const today = new Date().toISOString().slice(0, 10);
const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...paths.map(
        (path) =>
            `  <url><loc>${escapeXml(`${seo.siteUrl}${path === "/" ? "/" : path}`)}</loc><lastmod>${today}</lastmod></url>`,
    ),
    "</urlset>",
    "",
].join("\n");

writeFileSync(join(dist, "sitemap.xml"), sitemap);

console.log(`generate-seo: ${paths.length} páginas e sitemap.xml gravados em dist/`);
