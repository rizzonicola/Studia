/**
 * Rendering HTML delle pagine informative statiche (nessuna dipendenza, nessun JavaScript lato client).
 *
 * Scelte tecniche:
 *  - HTML completo e leggibile senza JS: i motori di ricerca (e i crawler dei sistemi AI) vedono subito testo, titoli e link;
 *  - CSS inline (~2 KB) → zero richieste bloccanti; compatibile con la CSP del sito (style-src 'unsafe-inline', nessuno script);
 *  - font di sistema, tema chiaro/scuro come l'app (prefers-color-scheme), contrasto AA, focus visibile, target tocco ≥ 44 px;
 *  - hreflang reciproci + x-default solo per le pagine che esistono in più lingue; dati strutturati JSON-LD collegati da @id.
 */
import { PAGE_KEYS, PAGE_LANGS, SEO_LANGS, hasPage, pagePath, type PageKey, type SeoLang } from '../config/seoRoutes';
import { PAGES, UI } from './content';

export interface Site {
  url: string;
  owner: string;
  email: string;
  /** Autore del codice (con il suo profilo GitHub) e licenza con cui è distribuito: vedi config/site.ts. */
  authorName: string;
  authorUrl: string;
  licenseName: string;
  licenseUrl: string;
}
export interface Alternate { lang: SeoLang | 'x-default'; href: string }

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const TOKEN = /\{([^{}|]+)\|([^{}]+)\}/g;

/** Testo senza la sintassi dei link (per dati strutturati e meta). */
export const plain = (s: string): string => s.replace(TOKEN, (_m, _target: string, text: string) => text);

function resolveLink(lang: SeoLang, target: string): { href: string; external: boolean } | null {
  if (target === 'app') return { href: '/', external: false };
  if (target.startsWith('/')) return { href: target, external: false };
  if (/^https?:\/\//.test(target)) return { href: target, external: true };
  if ((PAGE_KEYS as readonly string[]).includes(target)) {
    const key = target as PageKey;
    return hasPage(lang, key) ? { href: pagePath(lang, key), external: false } : null;
  }
  throw new Error(`seo: destinazione di link sconosciuta "${target}"`);
}

/** Testo con link → HTML sicuro (escape di tutto il resto). Se la pagina non esiste in quella lingua il link diventa testo. */
export function inline(lang: SeoLang, s: string): string {
  let out = '';
  let last = 0;
  for (const m of s.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    out += esc(s.slice(last, at));
    const link = resolveLink(lang, m[1]);
    out += link ? `<a href="${esc(link.href)}"${link.external ? ' rel="noopener noreferrer"' : ''}>${esc(m[2])}</a>` : esc(m[2]);
    last = at + m[0].length;
  }
  return out + esc(s.slice(last));
}

/** Versioni linguistiche di una pagina (con x-default). Vuoto se esiste in una sola lingua: niente hreflang inutili. */
export function alternates(site: Site, key: PageKey): Alternate[] {
  const langs = PAGE_LANGS[key];
  if (langs.length < 2) return [];
  const list: Alternate[] = langs.map((l) => ({ lang: l, href: site.url + pagePath(l, key) }));
  list.push({ lang: 'x-default', href: site.url + pagePath(langs.includes('en') ? 'en' : langs[0], key) });
  return list;
}

const LOGO =
  '<svg viewBox="20 130 430 270" aria-hidden="true" focusable="false"><g fill="currentColor" stroke="currentColor" stroke-width="6" stroke-linejoin="round" transform="translate(18.9,-18.2)">' +
  '<path d="M 76.7 159.5 L 386 163.6 C 420.5 169.5 415.3 224.4 391.2 227.7 C 391.2 227.7 287 225.8 78.5 221.9 C 81.4 222.2 135.4 195.6 76.7 159.5 Z"/>' +
  '<path d="M 96.8 242.3 L 387.5 247.5 C 410.1 250 408.1 288.3 392.1 289.7 C 392.1 289.7 293.5 287 96.2 281.6 C 101.9 279.8 131.1 260.3 96.8 242.3 Z"/>' +
  '<path d="M 50.5 299.1 L 393.8 308.9 C 424.3 314.1 424.1 366.6 403.6 369 C 403.6 369 286.1 368.8 51 368.4 C 57.5 369.2 102.6 332.8 50.5 299.1 Z"/></g></svg>';

const CSS =
  ':root{color-scheme:light dark;--bg:#fff;--fg:#111827;--mut:#4b5563;--line:#e5e7eb;--btn:#111827;--btnfg:#fff}' +
  '@media(prefers-color-scheme:dark){:root{--bg:#20232a;--fg:#f3f4f6;--mut:#aab2c0;--line:#3a3f4a;--btn:#f3f4f6;--btnfg:#111827}}' +
  '*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}' +
  'body{margin:0;background:var(--bg);color:var(--fg);font:17px/1.65 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}' +
  'a{color:inherit;text-underline-offset:.2em}a:focus-visible{outline:3px solid currentColor;outline-offset:3px;border-radius:2px}' +
  '.skip{position:absolute;left:-999px}.skip:focus{left:1rem;top:1rem;z-index:9;background:var(--bg);padding:.6rem 1rem}' +
  '.wrap{max-width:44rem;margin:0 auto;padding:0 1.25rem}' +
  '.bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.75rem 1.25rem;padding-top:1rem;padding-bottom:1rem}' +
  '.brand{display:inline-flex;align-items:center;gap:.55rem;font-size:1.2rem;font-weight:700;text-decoration:none}.brand svg{width:1.9rem;height:1.9rem}' +
  '.langs{display:flex;gap:.25rem;font-size:.95rem}.langs a{display:inline-flex;align-items:center;min-height:44px;padding:0 .6rem;color:var(--mut)}.langs a[aria-current]{color:var(--fg);font-weight:600}' +
  'h1{font-size:clamp(2rem,6.4vw,3.1rem);line-height:1.08;letter-spacing:-.025em;margin:2rem 0 1rem}' +
  'h2{font-size:1.45rem;line-height:1.25;letter-spacing:-.01em;margin:2.75rem 0 .75rem;padding-top:1.5rem;border-top:1px solid var(--line)}' +
  'h3{font-size:1.05rem;margin:1.5rem 0 .25rem}p{margin:.75rem 0}' +
  '.lead{font-size:1.2rem;color:var(--mut);max-width:38rem}ul,ol{padding-left:1.4rem}li{margin:.5rem 0}' +
  '.btn{display:inline-flex;align-items:center;min-height:44px;padding:0 1.4rem;border-radius:.6rem;background:var(--btn);color:var(--btnfg);font-weight:600;text-decoration:none}' +
  '.btn:focus-visible{outline-color:var(--fg);outline-offset:3px}.bar .btn{min-height:40px;padding:0 1rem;font-size:.95rem}' +
  '.crumbs{font-size:.92rem;color:var(--mut);margin-top:1.25rem}.crumbs ol{display:flex;flex-wrap:wrap;gap:.25rem .6rem;list-style:none;padding:0;margin:0}.crumbs li{margin:0}.crumbs li+li::before{content:"/";margin-right:.6rem}' +
  '.cta{margin-top:3rem;padding:1.5rem;border:1px solid var(--line);border-radius:.8rem}.cta h2{border:0;margin:0 0 .25rem;padding:0;font-size:1.3rem}' +
  'footer{margin-top:4rem;border-top:1px solid var(--line);padding:1.75rem 0 3rem;font-size:.92rem;color:var(--mut)}' +
  'footer ul{display:flex;flex-wrap:wrap;gap:0 1.25rem;list-style:none;padding:0;margin:.25rem 0 1rem}footer li{margin:0}footer li a{display:inline-flex;align-items:center;min-height:44px}' +
  '@media(max-width:34rem){body{font-size:16.5px}}';

const ROBOTS = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
const json = (v: unknown): string => JSON.stringify(v).replace(/</g, '\\u003c');

export function renderPage(site: Site, lang: SeoLang, key: PageKey): string {
  const page = PAGES[lang][key];
  if (!page) throw new Error(`seo: manca il testo di "${key}" in "${lang}"`);
  const ui = UI[lang];
  const isHome = key === 'home';
  const url = site.url + pagePath(lang, key);
  const homeUrl = site.url + pagePath(lang, 'home');
  const alts = alternates(site, key);
  const orgId = `${site.url}/#org`;
  const authorId = `${site.url}/#author`;
  const image = `${site.url}/og-image.png`;
  const otherLangs = alts.filter((a) => a.lang !== 'x-default' && a.lang !== lang);
  const guides = PAGE_KEYS.filter((k) => k !== 'home' && hasPage(lang, k));
  const label = (k: PageKey): string => PAGES[lang][k]?.crumb ?? PAGES[lang][k]?.h1 ?? k;

  // ── Dati strutturati (JSON-LD): entità collegate da @id e coerenti con il testo visibile ──
  const graph: Record<string, unknown>[] = [
    { '@type': 'Organization', '@id': orgId, name: 'StudIA', url: `${site.url}/`, logo: { '@type': 'ImageObject', url: `${site.url}/icons/icon-512.png`, width: 512, height: 512 }, email: site.email },
    { '@type': 'WebSite', '@id': `${site.url}/#website`, url: `${site.url}/`, name: 'StudIA', alternateName: ['Studia AI'], inLanguage: SEO_LANGS, publisher: { '@id': orgId } },
    { '@type': 'WebPage', '@id': `${url}#webpage`, url, name: page.title, description: page.description, inLanguage: ui.htmlLang, isPartOf: { '@id': `${site.url}/#website` }, primaryImageOfPage: { '@type': 'ImageObject', url: image }, ...(isHome ? { about: { '@id': `${site.url}/#app` } } : {}) },
  ];
  if (isHome) {
    graph.push({ '@type': 'WebApplication', '@id': `${site.url}/#app`, name: 'StudIA', url: `${site.url}/`, description: page.description, applicationCategory: 'EducationalApplication', operatingSystem: 'Any', browserRequirements: 'Requires JavaScript', inLanguage: SEO_LANGS, isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }, featureList: ui.features, author: { '@id': authorId }, license: site.licenseUrl, publisher: { '@id': orgId } });
    graph.push({ '@type': 'Person', '@id': authorId, name: site.authorName, url: site.authorUrl, sameAs: [site.authorUrl] });
  } else {
    graph.push(
      { '@type': 'Article', '@id': `${url}#article`, headline: page.h1, description: page.description, inLanguage: ui.htmlLang, datePublished: page.published, dateModified: page.modified, image, mainEntityOfPage: { '@id': `${url}#webpage` }, author: { '@id': orgId }, publisher: { '@id': orgId } },
      { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'StudIA', item: homeUrl }, { '@type': 'ListItem', position: 2, name: label(key), item: url }] },
    );
  }
  graph.push({ '@type': 'FAQPage', '@id': `${url}#faq`, mainEntity: page.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: plain(f.a) } })) });

  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}">`,
    `<link rel="canonical" href="${url}">`,
    `<meta name="robots" content="${ROBOTS}">`,
    ...alts.map((a) => `<link rel="alternate" hreflang="${a.lang}" href="${a.href}">`),
    `<meta property="og:type" content="${isHome ? 'website' : 'article'}">`,
    '<meta property="og:site_name" content="StudIA">',
    `<meta property="og:title" content="${esc(page.title)}">`,
    `<meta property="og:description" content="${esc(page.description)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${image}">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${esc(ui.imageAlt)}">`,
    `<meta property="og:locale" content="${ui.ogLocale}">`,
    ...otherLangs.map((a) => `<meta property="og:locale:alternate" content="${UI[a.lang as SeoLang].ogLocale}">`),
    ...(isHome ? [] : [`<meta property="article:published_time" content="${page.published}">`, `<meta property="article:modified_time" content="${page.modified}">`]),
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${esc(page.title)}">`,
    `<meta name="twitter:description" content="${esc(page.description)}">`,
    `<meta name="twitter:image" content="${image}">`,
    '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff">',
    '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#20232a">',
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg">',
    '<link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png">',
    '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">',
    `<style>${CSS}</style>`,
    `<script type="application/ld+json">${json({ '@context': 'https://schema.org', '@graph': graph })}</script>`,
  ].join('\n');

  // ── Contenuto ──
  const sections = page.sections
    .map((s) => {
      const parts = [`<h2>${esc(s.h)}</h2>`];
      for (const p of s.p ?? []) parts.push(`<p>${inline(lang, p)}</p>`);
      if (s.ul) parts.push(`<ul>${s.ul.map((li) => `<li>${inline(lang, li)}</li>`).join('')}</ul>`);
      if (s.ol) parts.push(`<ol>${s.ol.map((li) => `<li>${inline(lang, li)}</li>`).join('')}</ol>`);
      return `<section>${parts.join('')}</section>`;
    })
    .join('\n');

  const faq = `<section><h2>${esc(ui.faqTitle)}</h2>${page.faq.map((f) => `<h3>${esc(f.q)}</h3><p>${inline(lang, f.a)}</p>`).join('')}</section>`;
  const related = guides.filter((k) => k !== key);
  const relatedHtml = !isHome && related.length
    ? `<section><h2>${esc(ui.otherGuides)}</h2><ul>${related.map((k) => `<li><a href="${pagePath(lang, k)}">${esc(PAGES[lang][k]?.h1 ?? k)}</a></li>`).join('')}</ul></section>`
    : '';
  const crumbs = isHome
    ? ''
    : `<nav class="crumbs" aria-label="${esc(ui.crumbNav)}"><ol><li><a href="${pagePath(lang, 'home')}">StudIA</a></li><li><span aria-current="page">${esc(label(key))}</span></li></ol></nav>`;

  const langNav = SEO_LANGS.map((l) => {
    const target = pagePath(l, hasPage(l, key) ? key : 'home');
    return `<a href="${target}" hreflang="${l}" lang="${l}"${l === lang ? ' aria-current="true"' : ''}>${esc(UI[l].nativeName)}</a>`;
  }).join('');

  const footerGuides = guides.length
    ? `<nav aria-label="${esc(ui.guides)}"><strong>${esc(ui.guides)}</strong><ul><li><a href="${pagePath(lang, 'home')}">StudIA</a></li>${guides.map((k) => `<li><a href="${pagePath(lang, k)}">${esc(label(k))}</a></li>`).join('')}</ul></nav>`
    : '';

  const body = `<a class="skip" href="#main">${esc(ui.skip)}</a>
<header><div class="wrap bar">
<a class="brand" href="${pagePath(lang, 'home')}" aria-label="StudIA">${LOGO}<span>StudIA</span></a>
<nav class="langs" aria-label="${esc(ui.languages)}">${langNav}</nav>
<a class="btn" href="/">${esc(ui.openApp)}</a>
</div></header>
<main id="main"><div class="wrap"><article>
${crumbs}
<h1>${esc(page.h1)}</h1>
<p class="lead">${inline(lang, page.lead)}</p>
<p><a class="btn" href="/">${esc(ui.openApp)}</a></p>
${sections}
${faq}
<section class="cta"><h2>${esc(ui.ctaTitle)}</h2><p>${esc(ui.ctaText)}</p><a class="btn" href="/">${esc(ui.openApp)}</a></section>
${relatedHtml}
</article></div></main>
<footer><div class="wrap">
${footerGuides}
<ul><li><a href="/terms">${esc(ui.terms)}</a></li><li><a href="/privacy">${esc(ui.privacy)}</a></li><li><a href="mailto:${esc(site.email)}">${esc(ui.contact)}: ${esc(site.email)}</a></li></ul>
<p>${esc(ui.managedBy)} ${esc(site.owner)}. ${esc(ui.disclaimer)}</p>
<p>${esc(ui.madeBy)} <a href="${esc(site.authorUrl)}" rel="author noopener noreferrer">${esc(site.authorName)}</a> (<a href="${esc(site.authorUrl)}" rel="author noopener noreferrer">${esc(site.authorUrl.replace(/^https?:\/\//, ''))}</a>). ${esc(ui.licensedUnder)} <a href="${esc(site.licenseUrl)}" rel="license noopener noreferrer">${esc(site.licenseName)}</a>.</p>
</div></footer>`;

  return `<!doctype html>\n<html lang="${ui.htmlLang}">\n<head>\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`;
}
