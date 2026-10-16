#!/usr/bin/env node
/**
 * Controlli SEO sul risultato del build:   npm run build && npm run check:seo   (oppure: node tools/seo-check.mjs <cartella>)
 * Nessuna dipendenza. Esce con codice 1 se trova errori; gli avvisi non bloccano.
 * Verifica per ogni pagina della sitemap: file presente, <title> e description di lunghezza adatta, un solo <h1>, canonical corretto,
 * nessun noindex, hreflang reciproci con x-default, JSON-LD valido, link interni funzionanti, immagine social presente,
 * testo sufficiente e pagine non orfane (raggiunte da almeno un altro link interno).
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const dist = path.resolve(process.argv[2] ?? 'dist');
const errors = [];
const warnings = [];
const fail = (page, msg) => errors.push(`${page}: ${msg}`);
const warn = (page, msg) => warnings.push(`${page}: ${msg}`);
const read = (relative) => readFileSync(path.join(dist, relative), 'utf8');
const exists = (relative) => existsSync(path.join(dist, relative));

/** Rotte gestite dall'app (SPA): nel build non hanno un file proprio. */
const APP_ROUTES = new Set(['/', '/terms', '/privacy', '/upload', '/camera', '/settings']);
const fileFor = (pathname) => (pathname.endsWith('/') ? `${pathname.slice(1)}index.html` : pathname.slice(1));
const first = (html, re) => html.match(re)?.[1];

if (!exists('sitemap.xml')) fail('sitemap.xml', 'mancante');
if (!exists('robots.txt')) fail('robots.txt', 'mancante');
const sitemap = exists('sitemap.xml') ? read('sitemap.xml') : '';
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const origin = locs[0] ? new URL(locs[0]).origin : '';
if (exists('robots.txt') && !read('robots.txt').includes(`${origin}/sitemap.xml`)) fail('robots.txt', 'non punta alla sitemap');

const pages = new Map();
for (const loc of locs) {
  const pathname = new URL(loc).pathname;
  if (APP_ROUTES.has(pathname)) continue;
  if (!exists(fileFor(pathname))) fail(pathname, `file ${fileFor(pathname)} mancante`);
  else pages.set(pathname, read(fileFor(pathname)));
}

const linkedFrom = new Map([...pages.keys()].map((p) => [p, new Set()]));
const hreflangsOf = (html) => [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => ({ lang: m[1], href: m[2] }));

for (const [pathname, html] of pages) {
  const title = first(html, /<title>([^<]*)<\/title>/);
  const description = first(html, /<meta name="description" content="([^"]*)"/);
  if (!title) fail(pathname, '<title> mancante');
  else if (title.length > 65 || title.length < 20) warn(pathname, `<title> di ${title.length} caratteri (ideale 20-65)`);
  if (!description) fail(pathname, 'meta description mancante');
  else if (description.length > 165 || description.length < 70) warn(pathname, `description di ${description.length} caratteri (ideale 70-165)`);
  const h1s = (html.match(/<h1[\s>]/g) ?? []).length;
  if (h1s !== 1) fail(pathname, `${h1s} tag <h1> (deve essercene uno)`);
  if (first(html, /<link rel="canonical" href="([^"]+)"/) !== origin + pathname) fail(pathname, 'canonical mancante o diverso dall\'URL della pagina');
  if (/noindex/i.test(first(html, /<meta name="robots" content="([^"]*)"/) ?? '')) fail(pathname, 'contiene noindex');
  if (!first(html, /<html lang="([a-z-]+)"/)) fail(pathname, 'attributo lang mancante su <html>');

  // hreflang: reciproci, con la pagina stessa e con x-default
  const alts = hreflangsOf(html);
  if (alts.length) {
    if (!alts.some((a) => a.lang === 'x-default')) fail(pathname, 'hreflang senza x-default');
    if (!alts.some((a) => a.href === origin + pathname)) fail(pathname, 'hreflang senza riferimento a se stessa');
    for (const a of alts) {
      const target = new URL(a.href).pathname;
      const other = pages.get(target);
      if (!other) fail(pathname, `hreflang ${a.lang} punta a una pagina inesistente (${target})`);
      else if (!hreflangsOf(other).some((b) => b.href === origin + pathname)) fail(pathname, `hreflang non reciproco con ${target}`);
    }
  }

  // JSON-LD valido
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (!blocks.length) fail(pathname, 'nessun JSON-LD');
  for (const b of blocks) {
    try {
      const data = JSON.parse(b[1]);
      if (!data['@context'] || !(data['@graph'] ?? [data]).length) fail(pathname, 'JSON-LD senza @context o senza entità');
    } catch (e) {
      fail(pathname, `JSON-LD non valido (${e.message})`);
    }
  }

  // Link interni e immagine social
  const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '');
  for (const m of body.matchAll(/href="(\/[^"#?]*)/g)) {
    const target = m[1];
    if (target.startsWith('//')) continue;
    if (linkedFrom.has(target) && target !== pathname) linkedFrom.get(target).add(pathname);
    if (APP_ROUTES.has(target) || pages.has(target)) continue;
    if (!exists(fileFor(target))) fail(pathname, `link interno rotto: ${target}`);
  }
  const og = first(html, /<meta property="og:image" content="([^"]+)"/);
  if (!og || !exists(new URL(og).pathname.slice(1))) fail(pathname, 'immagine Open Graph mancante');
  if (/<script[^>]+src=/.test(html)) warn(pathname, 'carica script esterni (la pagina dovrebbe funzionare senza JavaScript)');
  const words = body.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  if (words < 250) warn(pathname, `solo ${words} parole di testo (rischio contenuto sottile)`);
}

for (const [pathname, from] of linkedFrom) {
  if (!from.size) fail(pathname, 'pagina orfana: nessun altro link interno la raggiunge');
}

// Shell dell'app (index.html): deve restare indicizzabile e descrittiva
if (exists('index.html')) {
  const shell = read('index.html');
  if (/<link rel="canonical"/.test(shell)) fail('/', "la shell non deve avere un canonical nell'HTML: lo imposta DocumentMeta (vedi docs/SEO.md)");
  const leftovers = [...new Set(shell.match(/__[A-Z][A-Z_]*__/g) ?? [])];
  if (leftovers.length) fail('/', `segnaposto non sostituiti in index.html: ${leftovers.join(', ')}`);
  if (/noindex/i.test(first(shell, /<meta name="robots" content="([^"]*)"/) ?? '')) fail('/', 'la shell contiene noindex');
  let shellGraph = [];
  for (const b of shell.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(b[1]);
      shellGraph = shellGraph.concat(data['@graph'] ?? [data]);
    } catch (e) { fail('/', `JSON-LD non valido (${e.message})`); }
  }
  // Autore e licenza: la shell dichiara chi è l'autore (con il profilo GitHub) e con quale licenza è distribuita l'app
  const app = shellGraph.find((n) => n['@type'] === 'WebApplication');
  const author = shellGraph.find((n) => n['@type'] === 'Person');
  if (app && !app.license) fail('/', 'JSON-LD: la WebApplication non dichiara la licenza');
  if (app && !app.author) fail('/', 'JSON-LD: la WebApplication non dichiara l\'autore');
  if (app && author && app.author?.['@id'] !== author['@id']) fail('/', 'JSON-LD: author della WebApplication e Person non coincidono');
  if (author && !/^https:\/\/github\.com\//.test(author.url ?? '')) fail('/', 'JSON-LD: la Person autore non rimanda a un profilo GitHub');
  if (!/<link rel="author" href="https?:\/\//.test(shell) || !/<link rel="license" href="https?:\/\//.test(shell)) fail('/', 'index.html: mancano <link rel="author"> o <link rel="license">');
}

console.log(`SEO check su ${dist}: ${pages.size} pagine statiche, ${locs.length} URL in sitemap`);
for (const w of warnings) console.log(`  avviso  ${w}`);
for (const e of errors) console.log(`  ERRORE  ${e}`);
console.log(errors.length ? `\n${errors.length} errori` : '\nTutto in ordine');
process.exit(errors.length ? 1 : 0);
