import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';
import { APP_NAME, SITE_URL } from '../config/appConfig';
import type { TranslationKey } from '../i18n/types';

const setMeta = (selector: string, attr: 'content' | 'href', value: string) => {
  document.head.querySelector(selector)?.setAttribute(attr, value);
};

/** Aggiorna <meta name="robots"> (la crea se manca). */
const setRobots = (value: string) => {
  let el = document.head.querySelector('meta[name="robots"]');
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', 'robots');
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
};

/** Canonical solo sulle pagine indicizzabili: con noindex indicare un'altra URL "preferita" darebbe un segnale contraddittorio. */
const setCanonical = (href: string | null) => {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (href === null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
};

/**
 * Uniche schermate dell'app da indicizzare: la home e i testi legali. Tutto il resto (appunti, cartelle, upload, fotocamera,
 * impostazioni, indirizzi inesistenti) è privato o operativo → noindex. Le pagine pubbliche con contenuti sono statiche (/it/, /en/, /fr/).
 */
const INDEXABLE = new Set(['/', '/terms', '/privacy']);

const PAGE_TITLES: Record<string, TranslationKey> = {
  '/terms': 'meta.title.terms',
  '/privacy': 'meta.title.privacy',
  '/settings': 'meta.title.settings',
  '/upload': 'nav.upload',
  '/camera': 'nav.camera',
};

/**
 * Aggiorna <html lang> (in I18nProvider), <title>, description, robots, canonical e i meta Open Graph/Twitter
 * in base alla lingua scelta e alla pagina corrente. Non renderizza nulla.
 */
const DocumentMeta = () => {
  const { t, language } = useI18n();
  const { pathname } = useLocation();

  useEffect(() => {
    const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname; // "/terms/" = "/terms"
    const indexable = INDEXABLE.has(path);
    const pageKey = PAGE_TITLES[path];
    const title = path === '/' ? `${APP_NAME} – ${t('meta.title.home')}` : pageKey ? `${t(pageKey)} – ${APP_NAME}` : APP_NAME;
    const description = t('meta.description');
    const url = `${SITE_URL}${indexable ? path : '/'}`;

    document.title = title;
    setRobots(indexable ? 'index, follow, max-image-preview:large, max-snippet:-1' : 'noindex, nofollow');
    setCanonical(indexable ? url : null);
    setMeta('meta[name="description"]', 'content', description);
    setMeta('meta[property="og:title"]', 'content', title);
    setMeta('meta[property="og:description"]', 'content', description);
    setMeta('meta[property="og:url"]', 'content', url);
    setMeta('meta[property="og:locale"]', 'content', t('meta.ogLocale'));
    setMeta('meta[name="twitter:title"]', 'content', title);
    setMeta('meta[name="twitter:description"]', 'content', description);
  }, [t, language, pathname]);

  return null;
};

export default DocumentMeta;
