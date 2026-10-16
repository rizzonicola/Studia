/**
 * Pagine informative statiche (landing + guide), prerenderizzate al build da seo/generate.ts in /it/, /en/, /fr/.
 * UNICA fonte di verità per URL e lingue disponibili: la usano sia il generatore (build, Node) sia l'app (link nel footer
 * e nell'onboarding). Questo file non deve importare nulla (viene caricato anche da vite.config.ts).
 *
 * Per aggiungere una guida: 1) nuova chiave in PAGE_KEYS, 2) slug per lingua in SLUGS, 3) lingue in PAGE_LANGS,
 * 4) testo in seo/content.ts. Il build fallisce se contenuto e rotte non coincidono (niente pagine orfane o mancanti).
 */
export type SeoLang = 'it' | 'en' | 'fr';
export type PageKey = 'home' | 'apiKey' | 'notes' | 'quiz' | 'maps';

export const SEO_LANGS: readonly SeoLang[] = ['it', 'en', 'fr'];
export const PAGE_KEYS: readonly PageKey[] = ['home', 'apiKey', 'notes', 'quiz', 'maps'];

/** In quali lingue esiste ciascuna pagina (le guide su appunti/quiz/mappe per ora solo in italiano, mercato principale). */
export const PAGE_LANGS: Record<PageKey, readonly SeoLang[]> = {
  home: ['it', 'en', 'fr'],
  apiKey: ['it', 'en', 'fr'],
  notes: ['it'],
  quiz: ['it'],
  maps: ['it'],
};

const GUIDES_DIR: Record<SeoLang, string> = { it: 'guide', en: 'guides', fr: 'guides' };

const SLUGS: Record<Exclude<PageKey, 'home'>, Partial<Record<SeoLang, string>>> = {
  apiKey: { it: 'chiave-api-gemini-gratis', en: 'gemini-api-key-free', fr: 'cle-api-gemini-gratuite' },
  notes: { it: 'appunti-ai-da-pdf-foto-audio' },
  quiz: { it: 'quiz-da-appunti-con-ai' },
  maps: { it: 'mappe-concettuali-con-ai' },
};

export const hasPage = (lang: SeoLang, key: PageKey): boolean => PAGE_LANGS[key].includes(lang);

/** Percorso assoluto (con slash finale) della pagina. Lancia un errore se la pagina non esiste in quella lingua. */
export function pagePath(lang: SeoLang, key: PageKey): string {
  if (!hasPage(lang, key)) throw new Error(`seoRoutes: la pagina "${key}" non esiste in "${lang}"`);
  if (key === 'home') return `/${lang}/`;
  const slug = SLUGS[key][lang];
  if (!slug) throw new Error(`seoRoutes: manca lo slug di "${key}" per "${lang}"`);
  return `/${lang}/${GUIDES_DIR[lang]}/${slug}/`;
}
