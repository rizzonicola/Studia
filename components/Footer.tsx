import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { APP_NAME, APP_VERSION, AUTHOR_GITHUB_LABEL, AUTHOR_GITHUB_URL, AUTHOR_NAME, LICENSE_NAME, LICENSE_URL } from '../config/appConfig';
import { useI18n } from '../i18n/I18nProvider';
import { pagePath } from '../config/seoRoutes';
import { warmLegalRoute, warmLegalRouteWhenIdle } from '../legal/legalRoute';

const linkBase = 'hover:text-gray-900 max-sm:active:text-gray-900 underline-offset-2 hover:underline'; // max-sm:active = feedback al tocco, solo su telefono
/**
 * Telefono (< sm): area di tocco di almeno 44 × 44 px, larga quanto il testo più 8 px per lato; quegli 8 px fanno anche da spazio fra le voci.
 * Con questo respiro le quattro voci stanno su una riga anche in francese a 320 px (il caso più largo: 283 px su 288 disponibili; il budget di
 * caratteri delle etichette è verificato da tests/logic.test.ts).
 * Da `sm` in su torna l'aspetto di sempre: nessun respiro laterale, py-2, e lo spazio lo dà il gap del <nav>.
 */
const linkClass = `${linkBase} inline-flex items-center justify-center min-h-11 min-w-11 px-2 sm:inline-block sm:min-h-0 sm:min-w-0 sm:px-0 sm:py-2`;
/** Solo da `sm` in su: su telefono la licenza si trova in Impostazioni → Informazioni e Dipendenze (stessa fonte: config/site.ts). */
const wideOnlyLinkClass = `${linkBase} hidden sm:inline-block sm:py-2`;
/** «PolyForm Strict License 1.0.0» → «PolyForm Strict License»: nel footer il numero di versione non serve (sta in Informazioni). */
const LICENSE_SHORT_NAME = LICENSE_NAME.replace(/\s+\d[\d.]*$/, '');

/**
 * Etichetta breve su telefono, completa da `sm`. I due testi non convivono mai: quello nascosto (display:none) esce anche
 * dall'albero di accessibilità, quindi lettori di schermo e tastiera vedono una sola etichetta.
 */
const Label: React.FC<{ short: string; full: string }> = ({ short, full }) => (
  <>
    <span className="sm:hidden">{short}</span>
    <span className="hidden sm:inline">{full}</span>
  </>
);

/**
 * Il footer resta l'ultimo elemento della pagina (sempre in fondo, sotto a tutto). Deve restare BASSO: sulle pagine corte il contenuto
 * "entra per un soffio" nello schermo, e una riga in più fa comparire lo scorrimento.
 *
 *  - Telefono (< sm): UNA sola riga, «Guide · Termini · Privacy · Info», con etichette brevi (stanno su una riga in tutte e tre le lingue
 *    anche a 320 px). Versione, autore, profilo GitHub e licenza non spariscono: restano nell'HTML ma nascosti, e si leggono in
 *    Impostazioni → Informazioni e Dipendenze (la voce «Info»), che li contiene già tutti.
 *  - Da `sm` in su: com'era, con etichette complete. Per restare basso, versione, autore e profilo GitHub stanno sulla stessa riga e la licenza è
 *    tra i link; da `lg` tutto sta sulla stessa riga.
 *
 * Invarianti (SEO e aspetti legali: non toglierli nemmeno in una versione compatta):
 *  - «Guide» (pagina statica, link interno verso /it/, /en/, /fr/), «Termini» e «Privacy» sono visibili a ogni larghezza e in ogni pagina;
 *  - autore e licenza mantengono rel="author" e rel="license" e le stesse URL (config/site.ts è l'unica fonte);
 *  - il footer resta un <footer> con un <nav> etichettato (landmark).
 */
const Footer: React.FC = () => {
  const { t, language } = useI18n();

  // Dopo il primo render, a riposo: scarica pagina e testo dei Termini/Privacy della lingua attiva (una sola volta per sessione)
  useEffect(() => {
    warmLegalRouteWhenIdle();
  }, []);

  return (
    <footer className="w-full border-t border-gray-200 mt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-[env(safe-area-inset-bottom)] sm:pt-3 sm:pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex flex-col-reverse lg:flex-row items-center justify-between gap-2 text-xs text-gray-600">
        <p className="hidden sm:flex flex-wrap items-center justify-center lg:justify-start gap-x-3">
          <span>{APP_NAME} v{APP_VERSION}</span>
          <span>{AUTHOR_NAME}</span>
          {/* L'area di tocco è alta 32 px (py-2) senza allungare la riga (-my-2) */}
          <a href={AUTHOR_GITHUB_URL} target="_blank" rel="author noopener noreferrer" className="hover:text-gray-900 underline underline-offset-2 -my-2 py-2 inline-block">
            {AUTHOR_GITHUB_LABEL}
          </a>
        </p>
        <nav className="flex flex-wrap items-center justify-center sm:gap-x-4 sm:gap-y-1" aria-label={t('footer.legalNav')}>
          {/* Pagine informative statiche (non fanno parte della SPA): link normale, caricamento completo della pagina */}
          <a href={pagePath(language, 'home')} className={linkClass}>{t('footer.guides')}</a>
          <Link to="/terms" onPointerEnter={warmLegalRoute} onFocus={warmLegalRoute} onTouchStart={warmLegalRoute} className={linkClass}><Label short={t('footer.termsShort')} full={t('footer.terms')} /></Link>
          <Link to="/privacy" onPointerEnter={warmLegalRoute} onFocus={warmLegalRoute} onTouchStart={warmLegalRoute} className={linkClass}><Label short={t('footer.privacyShort')} full={t('footer.privacy')} /></Link>
          <Link to="/settings#info" className={linkClass}><Label short={t('footer.aboutShort')} full={t('footer.about')} /></Link>
          <a href={LICENSE_URL} target="_blank" rel="license noopener noreferrer" className={wideOnlyLinkClass}>{LICENSE_SHORT_NAME}</a>
        </nav>
      </div>
    </footer>
  );
};

export default Footer;
