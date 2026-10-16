/**
 * Dominio di produzione e crediti del progetto: UNICA fonte di verità.
 * Usata da vite.config.ts (canonical, Open Graph, robots.txt, sitemap.xml, dati strutturati), dalle pagine statiche SEO
 * (seo/generate.ts) e dall'app (meta dinamici, footer, "Informazioni").
 * Questo file non deve importare nulla e non deve usare variabili globali di Vite,
 * perché viene caricato anche da vite.config.ts (Node).
 */
export const SITE_URL = 'https://studia.poppi.cc';

/** Autore del progetto. Il titolare del trattamento dei dati (testi legali) è un'altra cosa: vedi OWNER_NAME in config/appConfig.ts. */
export const AUTHOR_NAME = 'Nicola Rizzo';
export const AUTHOR_GITHUB_URL = 'https://github.com/rizzonicola';
/** Testo visibile del collegamento al profilo GitHub (senza "https://"). */
export const AUTHOR_GITHUB_LABEL = 'github.com/rizzonicola';

/** Licenza del codice: PolyForm Strict License 1.0.0 (solo uso non commerciale, senza diritto di distribuire né di modificare). */
export const LICENSE_NAME = 'PolyForm Strict License 1.0.0';
export const LICENSE_URL = 'https://polyformproject.org/licenses/strict/1.0.0';
