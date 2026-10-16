import { getLanguage } from '../i18n/core';
import { preloadLegal } from './LegalDocuments';

/**
 * Caricamento della rotta dei Termini / Privacy: il chunk della pagina E il testo della lingua attiva, in parallelo.
 * La rotta (`lazy` in App.tsx) risolve solo quando entrambi sono pronti: grazie alla transizione di react-router la pagina
 * precedente resta a schermo e quella legale appare già completa, senza un secondo fallback (che React terrebbe ≥300 ms).
 * Un errore nel testo non blocca la pagina: se manca davvero, lo gestisce LegalDocuments (nuovo tentativo al prossimo accesso).
 */
export const loadLegalPage = () =>
  Promise.all([import('../pages/LegalPage'), preloadLegal(getLanguage()).catch(() => undefined)]).then(([page]) => page);

/** Precarico (idempotente, errori ignorati): da chiamare su hover / focus / tocco dei link ai testi legali. */
export const warmLegalRoute = (): void => {
  loadLegalPage().catch(() => undefined);
};

let idleWarmScheduled = false;

/** Precarico una sola volta per sessione, a riposo, solo per la lingua attiva (le altre due non si scaricano). */
export const warmLegalRouteWhenIdle = (): void => {
  if (idleWarmScheduled || typeof window === 'undefined') return;
  idleWarmScheduled = true;
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(warmLegalRoute, { timeout: 5000 });
  else window.setTimeout(warmLegalRoute, 2000);
};
