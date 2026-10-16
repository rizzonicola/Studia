import React, { Suspense, use, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import type { Language } from '../i18n/resolve';
import { createModuleRegistry } from '../utils/moduleRegistry';

export type LegalTab = 'terms' | 'privacy';

type LegalModule = { TermsContent: React.FC; PrivacyContent: React.FC };

/**
 * I testi legali (lunghi) sono caricati con import() dinamico e solo nella lingua attiva (un chunk per lingua, Termini e Privacy insieme).
 * Il registro tiene i moduli già risolti: se il testo è pronto lo si disegna subito, senza sospendere (con `lazy()` si mostrava
 * comunque un fallback, tenuto a schermo da React per almeno ~300 ms). Solo se manca si sospende, con `use()` sulla promessa in cache.
 */
const legalModules = createModuleRegistry<Language, LegalModule>({
  it: () => import('./content/it'),
  en: () => import('./content/en'),
  fr: () => import('./content/fr'),
});

/** Scarica (una volta sola) i testi legali della lingua. Idempotente; chi la usa solo come precarico deve ignorare l'eventuale errore. */
export const preloadLegal = (language: Language): Promise<unknown> => legalModules.load(language);

const Fallback: React.FC = () => {
  const { t } = useI18n();
  return (
    <p role="status" className="text-sm text-gray-500">
      {t('legal.loading')}
    </p>
  );
};

const LegalDocument: React.FC<{ which: keyof LegalModule }> = ({ which }) => {
  const { language } = useI18n();
  // Modulo già pronto: lettura sincrona. Altrimenti `use()` sospende sulla promessa in cache (stessa identità a ogni render).
  const loaded = legalModules.peek(language) ?? use(legalModules.load(language));
  const Doc = loaded[which];
  return <Doc />;
};

export const TermsContent: React.FC = () => (
  <Suspense fallback={<Fallback />}>
    <LegalDocument which="TermsContent" />
  </Suspense>
);

export const PrivacyContent: React.FC = () => (
  <Suspense fallback={<Fallback />}>
    <LegalDocument which="PrivacyContent" />
  </Suspense>
);

/** Tab "Termini / Privacy" riutilizzabile (onboarding, pagine dedicate). */
export const LegalTabs: React.FC<{ initialTab?: LegalTab; className?: string }> = ({ initialTab = 'terms', className = '' }) => {
  const { t } = useI18n();
  const [tab, setTab] = useState<LegalTab>(initialTab);
  const base = 'px-4 py-3 min-h-11 text-sm font-medium border-b-2 transition-colors -mb-px';
  return (
    <div className={className}>
      <div role="tablist" className="flex border-b border-gray-200 mb-4">
        <button
          role="tab"
          id="legal-tab-terms"
          aria-selected={tab === 'terms'}
          aria-controls="legal-panel"
          onClick={() => setTab('terms')}
          className={`${base} ${tab === 'terms' ? 'border-accent-ink text-gray-900' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
        >
          {t('footer.terms')}
        </button>
        <button
          role="tab"
          id="legal-tab-privacy"
          aria-selected={tab === 'privacy'}
          aria-controls="legal-panel"
          onClick={() => setTab('privacy')}
          className={`${base} ${tab === 'privacy' ? 'border-accent-ink text-gray-900' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
        >
          {t('footer.privacy')}
        </button>
      </div>
      <div role="tabpanel" id="legal-panel" aria-labelledby={`legal-tab-${tab}`}>
        {tab === 'terms' ? <TermsContent /> : <PrivacyContent />}
      </div>
    </div>
  );
};
