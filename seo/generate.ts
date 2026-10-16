/**
 * Genera al build (chiamato da vite.config.ts → plugin "studia-pwa") tutti i file SEO nella cartella di output:
 *  - /it/, /en/, /fr/ e le guide: una cartella con index.html per pagina (URL pulite, servite così come sono da Cloudflare Pages);
 *  - sitemap.xml con <lastmod> reale (data di ultima modifica del testo, non quella del build) e alternate hreflang;
 *  - robots.txt.
 * Nome del titolare, email e data dei testi legali si leggono da config/appConfig.ts: restano l'unica fonte di verità
 * (il file non si può importare in Node perché usa __APP_VERSION__, definita da Vite).
 * Autore (GitHub) e licenza del codice vengono invece da config/site.ts, che è importabile anche da Node.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { PAGE_KEYS, PAGE_LANGS, SEO_LANGS, pagePath } from '../config/seoRoutes';
import { AUTHOR_GITHUB_URL, AUTHOR_NAME, LICENSE_NAME, LICENSE_URL } from '../config/site';
import { PAGES } from './content';
import { alternates, renderPage, type Alternate, type Site } from './render';

function readConst(source: string, name: string): string {
  const match = source.match(new RegExp(`export const ${name}\\s*(?::\\s*string)?\\s*=\\s*'([^']*)'`));
  if (!match) throw new Error(`seo: costante ${name} non trovata in config/appConfig.ts`);
  return match[1];
}

/** Testo e rotte devono coincidere: il build fallisce invece di pubblicare pagine mancanti o orfane. */
function validate(): void {
  // Footer e onboarding dell'app linkano queste due pagine in ogni lingua: devono esistere sempre.
  for (const lang of SEO_LANGS) {
    for (const key of ['home', 'apiKey'] as const) {
      if (!PAGE_LANGS[key].includes(lang)) throw new Error(`seo: la pagina "${key}" deve esistere in "${lang}" (è linkata dall'app)`);
    }
  }
  for (const key of PAGE_KEYS) {
    for (const lang of SEO_LANGS) {
      const declared = PAGE_LANGS[key].includes(lang);
      const hasText = Boolean(PAGES[lang][key]);
      if (declared !== hasText) {
        throw new Error(`seo: "${key}" in "${lang}" ${declared ? 'è dichiarata ma non ha testo (seo/content.ts)' : 'ha un testo ma non è dichiarata (config/seoRoutes.ts)'}`);
      }
    }
  }
}

interface Entry { loc: string; lastmod: string; alts: Alternate[] }

export function generateSeoFiles(opts: { outDir: string; root: string; siteUrl: string }): string[] {
  validate();
  const config = readFileSync(path.join(opts.root, 'config/appConfig.ts'), 'utf-8');
  const site: Site = {
    url: opts.siteUrl,
    owner: readConst(config, 'OWNER_NAME'),
    email: readConst(config, 'CONTACT_EMAIL'),
    authorName: AUTHOR_NAME,
    authorUrl: AUTHOR_GITHUB_URL,
    licenseName: LICENSE_NAME,
    licenseUrl: LICENSE_URL,
  };
  const legalDate = readConst(config, 'LEGAL_LAST_UPDATED_ISO');
  const written: string[] = [];
  const write = (relative: string, data: string): void => {
    const file = path.join(opts.outDir, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, data);
    written.push(relative);
  };

  // Pagine dell'app aperte al pubblico: la home è l'app stessa (/), poi i testi legali.
  const entries: Entry[] = [
    { loc: '/', lastmod: PAGES.it.home?.modified ?? legalDate, alts: [] },
    { loc: '/terms', lastmod: legalDate, alts: [] },
    { loc: '/privacy', lastmod: legalDate, alts: [] },
  ];

  for (const key of PAGE_KEYS) {
    for (const lang of PAGE_LANGS[key]) {
      const route = pagePath(lang, key);
      write(`${route.slice(1)}index.html`, renderPage(site, lang, key));
      entries.push({ loc: route, lastmod: PAGES[lang][key]?.modified ?? legalDate, alts: alternates(site, key) });
    }
  }

  const urls = entries
    .map((e) => {
      const alts = e.alts.map((a) => `\n    <xhtml:link rel="alternate" hreflang="${a.lang}" href="${a.href}"/>`).join('');
      return `  <url>\n    <loc>${site.url}${e.loc}</loc>\n    <lastmod>${e.lastmod}</lastmod>${alts}\n  </url>`;
    })
    .join('\n');
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`);
  write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);
  return written;
}
