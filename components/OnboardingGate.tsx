import React, { ReactNode, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Check, Eye, EyeOff, ExternalLink, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import Logo from './Logo';
import LanguageSelect from './LanguageSelect';
import { LegalTabs } from '../legal/LegalDocuments';
import { useSettings } from '../hooks/useSettings';
import { useI18n } from '../i18n/I18nProvider';
import { validateApiKeyFormat } from '../services/apiKey';
import { AI_STUDIO_KEYS_URL, APP_NAME } from '../config/appConfig';
import { pagePath } from '../config/seoRoutes';

/** Impedisce di usare l'app finché non sono stati accettati i documenti legali e inserita l'API key. */
const OnboardingGate: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { legalAccepted, hasApiKey } = useSettings();
  const { pathname } = useLocation();
  const dialogRef = useRef<HTMLDivElement>(null);
  // Benvenuto: solo a chi non ha ancora accettato i Termini (prima visita). Chi ha già completato l'onboarding non lo rivede mai;
  // per rileggerlo c'è la pagina informativa statica, linkata dal footer.
  const [welcomed, setWelcomed] = useState(false);

  // Le pagine legali restano sempre consultabili
  const isLegalRoute = pathname === '/privacy' || pathname === '/terms';
  const step: 'welcome' | 'legal' | 'key' | null = isLegalRoute ? null : !legalAccepted ? (welcomed ? 'legal' : 'welcome') : !hasApiKey ? 'key' : null;

  useEffect(() => {
    if (!step) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    // Il focus entra nel dialog a ogni passaggio; l'app sotto è "inert" quindi Tab non può uscirne
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [step]);

  return (
    <>
      <div inert={!!step} aria-hidden={!!step}>
        {children}
      </div>
      {step && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-title"
            className="bg-surface w-full max-w-2xl max-h-[92dvh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in-up outline-hidden"
          >
            {step === 'welcome' ? <WelcomeStep onStart={() => setWelcomed(true)} /> : step === 'legal' ? <LegalStep /> : <ApiKeyStep />}
          </div>
        </div>
      )}
    </>
  );
};

/**
 * Prima schermata per chi arriva per la prima volta (e per i crawler, che sono sempre "nuovi visitatori" senza localStorage):
 * spiega a cosa serve StudIA prima dei Termini. È l'unico <h1> della home in questo stato. Il testo completo sta nelle pagine /it/, /en/, /fr/.
 */
const WelcomeStep: React.FC<{ onStart: () => void }> = ({ onStart }) => {
  const { t, language } = useI18n();
  const points = ['onboarding.welcome.p1', 'onboarding.welcome.p2', 'onboarding.welcome.p3', 'onboarding.welcome.p4'] as const;
  return (
    <>
      <div className="px-6 pt-6 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <Logo className="w-7 h-7" />
            <span className="font-semibold text-lg text-gray-800">{APP_NAME}</span>
          </div>
          <LanguageSelect />
        </div>
        <h1 id="onboarding-title" className="text-2xl font-bold text-gray-900 mt-4">{t('onboarding.welcome.title')}</h1>
        <p className="text-sm text-gray-600 mt-1">{t('onboarding.welcome.subtitle')}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
        <ul className="space-y-3 text-sm text-gray-800">
          {points.map((key) => (
            <li key={key} className="flex">
              <Check className="w-4 h-4 mr-2 mt-0.5 shrink-0" aria-hidden="true" />
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-gray-600">{t('onboarding.welcome.note')}</p>
      </div>
      <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
        <button
          onClick={onStart}
          className="w-full bg-accent text-accent-fg font-semibold py-3 min-h-11 rounded-lg hover:bg-accent-hover transition-colors"
        >
          {t('onboarding.welcome.start')}
        </button>
        <a href={pagePath(language, 'home')} className="mt-2 flex items-center justify-center min-h-11 text-sm font-medium text-accent-ink underline">
          {t('onboarding.welcome.more')}
        </a>
      </div>
    </>
  );
};

const StepHeader: React.FC<{ title: string; subtitle: string; step: number }> = ({ title, subtitle, step }) => {
  const { t } = useI18n();
  return (
    <div className="px-6 pt-6 pb-4 border-b border-gray-100">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <Logo className="w-7 h-7" />
          <span className="font-semibold text-lg text-gray-800">{APP_NAME}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-600">{t('onboarding.step', { step })}</span>
          <LanguageSelect />
        </div>
      </div>
      <h2 id="onboarding-title" className="text-2xl font-bold text-gray-900 mt-4">{title}</h2>
      <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
    </div>
  );
};

const LegalStep: React.FC = () => {
  const { acceptLegal } = useSettings();
  const { t } = useI18n();
  const [checked, setChecked] = useState(false);

  return (
    <>
      <StepHeader step={1} title={t('onboarding.legal.title')} subtitle={t('onboarding.legal.subtitle')} />
      <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
        <div className="mb-4 flex items-start rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
          <ShieldCheck className="w-4 h-4 mr-2 mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            <strong>{t('onboarding.legal.consentTitle')}</strong> {t('onboarding.legal.consentBody')}
          </p>
        </div>
        <LegalTabs />
      </div>
      <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
        <label className="flex items-start cursor-pointer text-sm text-gray-800">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-1 mr-3 h-5 w-5 rounded-sm border-gray-300 shrink-0"
          />
          <span>{t('onboarding.legal.checkbox')}</span>
        </label>
        <button
          onClick={acceptLegal}
          disabled={!checked}
          className="mt-4 w-full bg-accent text-accent-fg font-semibold py-3 min-h-11 rounded-lg hover:bg-accent-hover transition-colors disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed"
        >
          {t('onboarding.legal.accept')}
        </button>
      </div>
    </>
  );
};

const ApiKeyStep: React.FC = () => {
  const { setApiKey, rememberKey } = useSettings();
  const { t, language } = useI18n();
  const [value, setValue] = useState('');
  const [remember, setRemember] = useState(rememberKey);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateApiKeyFormat(value);
    if (problem) {
      setError(problem);
      return;
    }
    setApiKey(value, remember); // salvataggio immediato: il gate si chiude da solo
  };

  const badge = 'mr-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-fg';

  return (
    <>
      <StepHeader step={2} title={t('onboarding.key.title')} subtitle={t('onboarding.key.subtitle')} />
      <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
        <ol className="space-y-3 text-sm text-gray-800">
          <li className="flex">
            <span className={badge}>1</span>
            <span>
              {t('onboarding.key.step1')}{' '}
              <a href={AI_STUDIO_KEYS_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-accent-ink underline inline-flex items-center">
                aistudio.google.com/api-keys <ExternalLink className="w-3 h-3 ml-1" aria-hidden="true" />
              </a>
              .
            </span>
          </li>
          <li className="flex">
            <span className={badge}>2</span>
            <span>{t('onboarding.key.step2')}</span>
          </li>
          <li className="flex">
            <span className={badge}>3</span>
            <span>
              {t('onboarding.key.step3Before')} <strong>"Create API key"</strong> {t('onboarding.key.step3After')}
            </span>
          </li>
          <li className="flex">
            <span className={badge}>4</span>
            <span>{t('onboarding.key.step4')}</span>
          </li>
        </ol>
        <p className="mt-3 text-sm">
          <a href={pagePath(language, 'apiKey')} target="_blank" rel="noopener" className="font-medium text-accent-ink underline inline-flex items-center min-h-11">
            {t('onboarding.key.guide')} <ExternalLink className="w-3 h-3 ml-1" aria-hidden="true" />
          </a>
        </p>

        <form onSubmit={handleSave} className="mt-6">
          <label htmlFor="api-key-input" className="block text-sm font-medium text-gray-700 mb-1">{t('onboarding.key.label')}</label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" aria-hidden="true" />
            <input
              id="api-key-input"
              type={visible ? 'text' : 'password'}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              placeholder={t('onboarding.key.placeholder')}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-invalid={!!error}
              aria-describedby={error ? 'api-key-error' : undefined}
              className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-accent-ink focus:border-accent-ink outline-hidden"
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-3 text-gray-600 hover:text-gray-900"
              aria-label={visible ? t('onboarding.key.hide') : t('onboarding.key.show')}
              aria-pressed={visible}
            >
              {visible ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {error && <p id="api-key-error" role="alert" className="mt-2 text-sm text-red-700">{error}</p>}

          <label htmlFor="api-key-remember" className="mt-3 flex items-start min-h-11 cursor-pointer text-sm text-gray-700">
            <input
              id="api-key-remember"
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="mt-0.5 mr-3 h-5 w-5 rounded-sm border-gray-300 shrink-0"
            />
            <span>
              <span className="font-medium">{t('apiKey.remember')}</span>
              <span className="block text-xs text-gray-600 mt-0.5">{t('apiKey.rememberHint')}</span>
            </span>
          </label>

          <button
            type="submit"
            disabled={!value.trim()}
            className="mt-4 w-full bg-accent text-accent-fg font-semibold py-3 min-h-11 rounded-lg hover:bg-accent-hover transition-colors disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed"
          >
            {t('onboarding.key.save')}
          </button>
        </form>

        <div className="mt-5 flex items-start rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-700">
          <Lock className="w-4 h-4 mr-2 mt-0.5 shrink-0" aria-hidden="true" />
          <p>{t('onboarding.key.privacy')}</p>
        </div>
      </div>
    </>
  );
};

export default OnboardingGate;
