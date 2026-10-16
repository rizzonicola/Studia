import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { useSettings } from '../hooks/useSettings';
import { PROMPT_KEYS, PromptKey } from '../services/prompts';
import { validateApiKeyFormat, verifyApiKey } from '../services/apiKey';
import { AI_STUDIO_KEYS_URL, DEFAULT_FALLBACK_MODEL, DEFAULT_MODEL } from '../config/appConfig';
import { useI18n } from '../i18n/I18nProvider';
import { LANGUAGE_NATIVE_NAMES, LanguagePreference, SUPPORTED_LANGUAGES } from '../i18n/resolve';
import type { TranslationKey } from '../i18n/types';
import PromptEditor from '../components/PromptEditor';
import AboutPanel from '../components/AboutPanel';
import ThemeSettings from '../components/ThemeSettings';
import AppInstallPanel from '../components/AppInstallPanel';
import { Palette, LayoutGrid, List, KeyRound, Loader, RotateCcw, Trash2, MessageSquareText, Cpu, Languages, FileText, Info, Smartphone } from 'lucide-react';

const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode; id?: string }> = ({ icon, title, children, id }) => (
  <section id={id} className="bg-surface rounded-xl shadow-xs border border-gray-200 overflow-hidden mb-8 scroll-mt-24">
    <div className="p-6 border-b border-gray-100">
      <h2 className="text-xl font-semibold text-gray-800 flex items-center">
        <span className="mr-2 flex" aria-hidden="true">{icon}</span> {title}
      </h2>
    </div>
    <div className="p-6">{children}</div>
  </section>
);

/** Id delle sezioni: servono all'indice laterale (solo desktop) e alle ancore (es. /settings#info dal footer). */
const SECTION_IDS = ['lingua', 'chiave', 'modello', 'prompt', 'vista', 'aspetto', 'app', 'info'] as const;
type SectionId = (typeof SECTION_IDS)[number];

const maskKey = (key: string) => (key.length > 8 ? `${key.slice(0, 4)}••••••••${key.slice(-4)}` : '••••••••');

const SettingsPage: React.FC = () => {
  const { viewMode, setViewMode } = useTheme();
  const { apiKey, rememberKey, setApiKey, setRememberKey, clearApiKey, model, setModel, resetModel, resetAllPrompts, isPromptCustomized } = useSettings();
  const { fallbackEnabled, fallbackModel, setFallbackEnabled, setFallbackModel, resetFallbackModel } = useSettings();
  const { hash } = useLocation();
  const { t, language, preference, setPreference } = useI18n();
  const { contentLanguage, setContentLanguage } = useSettings();

  const [newKey, setNewKey] = useState('');
  const [keyMessage, setKeyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [modelDraft, setModelDraft] = useState(model);
  const [fallbackDraft, setFallbackDraft] = useState(fallbackModel);
  const [activePrompt, setActivePrompt] = useState<PromptKey>('notes');
  const [activeSection, setActiveSection] = useState<SectionId>('lingua');

  useEffect(() => setModelDraft(model), [model]);
  useEffect(() => setFallbackDraft(fallbackModel), [fallbackModel]);

  // Scroll verso le ancore (es. /settings#info dal footer)
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  // Evidenzia nell'indice la sezione che sta nella parte alta dello schermo
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const elements = SECTION_IDS.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveSection(visible[0].target.id as SectionId);
      },
      { rootMargin: '-96px 0px -60% 0px' }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const goToSection = (id: SectionId) => (e: React.MouseEvent) => {
    e.preventDefault();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    setActiveSection(id);
  };

  const handleReplaceKey = (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateApiKeyFormat(newKey);
    if (problem) {
      setKeyMessage({ type: 'error', text: problem });
      return;
    }
    setApiKey(newKey);
    setNewKey('');
    setKeyMessage({ type: 'success', text: t('settings.apiKey.updated') });
  };

  const handleVerify = async () => {
    if (!apiKey) return;
    setIsVerifying(true);
    setKeyMessage(null);
    const result = await verifyApiKey(apiKey);
    setKeyMessage({ type: result.ok ? 'success' : 'error', text: result.message });
    setIsVerifying(false);
  };

  const handleRemove = () => {
    // Rimuovendo la chiave riparte l'onboarding
    clearApiKey();
    setConfirmRemove(false);
  };

  const anyCustomized = PROMPT_KEYS.some((k) => isPromptCustomized(k));
  const languageOptions: { value: LanguagePreference; label: string; hint?: string }[] = [
    { value: 'system', label: t('settings.language.system'), hint: t('settings.language.systemInUse', { language: LANGUAGE_NATIVE_NAMES[language] }) },
    ...SUPPORTED_LANGUAGES.map((l) => ({ value: l as LanguagePreference, label: LANGUAGE_NATIVE_NAMES[l] })),
  ];

  const navItems: { id: SectionId; icon: React.ReactNode; label: string }[] = [
    { id: 'lingua', icon: <Languages size={18} />, label: t('settings.language.title') },
    { id: 'chiave', icon: <KeyRound size={18} />, label: t('settings.apiKey.title') },
    { id: 'modello', icon: <Cpu size={18} />, label: t('settings.model.title') },
    { id: 'prompt', icon: <MessageSquareText size={18} />, label: t('settings.prompts.title') },
    { id: 'vista', icon: <LayoutGrid size={18} />, label: t('settings.view.title') },
    { id: 'aspetto', icon: <Palette size={18} />, label: t('settings.appearance.title') },
    { id: 'app', icon: <Smartphone size={18} />, label: t('settings.app.title') },
    { id: 'info', icon: <Info size={18} />, label: t('about.title') },
  ];

  return (
    <div className="max-w-3xl lg:max-w-[68rem] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">{t('settings.title')}</h1>

      <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10 lg:items-start">
        {/* Indice: da lg le sezioni sono raggiungibili con un clic, senza scorrere tutta la pagina */}
        <nav aria-label={t('settings.title')} className="hidden lg:block sticky top-24">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={goToSection(item.id)}
                  aria-current={activeSection === item.id ? 'true' : undefined}
                  className={`flex items-center gap-3 min-h-10 px-3 rounded-lg text-sm font-medium transition-colors ${
                    activeSection === item.id ? 'bg-accent-soft text-accent-ink' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <span aria-hidden="true" className="shrink-0">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0">

      {/* Lingua */}
      <Section id="lingua" icon={<Languages size={20} />} title={t('settings.language.title')}>
        <p className="text-sm text-gray-600 mb-3">{t('settings.language.desc')}</p>
        <div role="radiogroup" aria-label={t('settings.language.group')} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {languageOptions.map((o) => (
            <button
              key={o.value}
              role="radio"
              aria-checked={preference === o.value}
              onClick={() => setPreference(o.value)}
              className={`p-3 min-h-11 rounded-lg border-2 text-left transition-colors ${preference === o.value ? 'border-accent-ink bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <span className="block text-sm font-semibold text-gray-900">{o.label}</span>
              {o.hint && <span className="block text-xs text-gray-600">{o.hint}</span>}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-600">{t('settings.language.note')}</p>

        <h3 className="mt-6 text-sm font-semibold text-gray-800 flex items-center">
          <FileText size={16} className="mr-2" aria-hidden="true" /> {t('settings.content.title')}
        </h3>
        <p className="text-sm text-gray-600 mb-3">{t('settings.content.desc')}</p>
        <div role="radiogroup" aria-label={t('settings.content.title')} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([
            { value: 'source' as const, label: t('settings.content.source'), desc: t('settings.content.sourceDesc') },
            { value: 'app' as const, label: t('settings.content.app'), desc: t('settings.content.appDesc', { language: LANGUAGE_NATIVE_NAMES[language] }) },
          ]).map((o) => (
            <button
              key={o.value}
              role="radio"
              aria-checked={contentLanguage === o.value}
              onClick={() => setContentLanguage(o.value)}
              className={`p-3 min-h-11 rounded-lg border-2 text-left transition-colors ${contentLanguage === o.value ? 'border-accent-ink bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <span className="block text-sm font-semibold text-gray-900">{o.label}</span>
              <span className="block text-xs text-gray-600">{o.desc}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-600">{t('settings.content.note')}</p>
      </Section>

      {/* API key */}
      <Section id="chiave" icon={<KeyRound size={20} />} title={t('settings.apiKey.title')}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-sm text-gray-600">{t('settings.apiKey.saved')}</p>
            <p className="font-mono text-sm font-semibold text-gray-900">{apiKey ? maskKey(apiKey) : t('settings.apiKey.none')}</p>
            {apiKey && !rememberKey && <p className="text-xs text-gray-600 mt-0.5">{t('apiKey.sessionOnlyBadge')}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleVerify}
              disabled={!apiKey || isVerifying}
              className="inline-flex items-center px-4 py-2.5 min-h-11 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {isVerifying && <Loader size={14} className="animate-spin mr-2" />} {t('settings.apiKey.verify')}
            </button>
            {confirmRemove ? (
              <button onClick={handleRemove} className="inline-flex items-center px-4 py-2.5 min-h-11 rounded-lg bg-danger text-white text-sm font-semibold hover:bg-danger-hover">
                <Trash2 size={14} className="mr-2" /> {t('settings.apiKey.confirmRemove')}
              </button>
            ) : (
              <button onClick={() => setConfirmRemove(true)} disabled={!apiKey} className="inline-flex items-center px-4 py-2.5 min-h-11 rounded-lg border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
                <Trash2 size={14} className="mr-2" /> {t('settings.apiKey.remove')}
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleReplaceKey} className="flex flex-col sm:flex-row gap-2">
          <input
            type="password"
            value={newKey}
            onChange={(e) => {
              setNewKey(e.target.value);
              setKeyMessage(null);
            }}
            placeholder={t('settings.apiKey.newPlaceholder')}
            autoComplete="off"
            spellCheck={false}
            aria-label={t('settings.apiKey.newAria')}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-accent-ink focus:border-accent-ink outline-hidden"
          />
          <button type="submit" disabled={!newKey.trim()} className="px-4 py-2.5 min-h-11 rounded-lg bg-accent text-accent-fg text-sm font-semibold hover:bg-accent-hover disabled:bg-gray-300 disabled:cursor-not-allowed">
            {t('settings.apiKey.replace')}
          </button>
        </form>

        <label htmlFor="api-key-remember" className="mt-4 flex items-start min-h-11 cursor-pointer text-sm text-gray-700">
          <input
            id="api-key-remember"
            type="checkbox"
            checked={rememberKey}
            onChange={(e) => setRememberKey(e.target.checked)}
            className="mt-0.5 mr-3 h-5 w-5 rounded-sm border-gray-300 shrink-0"
          />
          <span>
            <span className="font-medium">{t('apiKey.remember')}</span>
            <span className="block text-xs text-gray-600 mt-0.5">{t('apiKey.rememberHint')}</span>
          </span>
        </label>

        {keyMessage && (
          <div role="status" className={`mt-3 p-3 rounded-lg text-sm ${keyMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {keyMessage.text}
          </div>
        )}
        <p className="mt-4 text-xs text-gray-500">
          {t('settings.apiKey.helpBefore')}{' '}
          <a href={AI_STUDIO_KEYS_URL} target="_blank" rel="noopener noreferrer" className="text-accent-ink underline">Google AI Studio</a>.{' '}
          {t('settings.apiKey.helpAfter')}
        </p>
      </Section>

      {/* Modello */}
      <Section id="modello" icon={<Cpu size={20} />} title={t('settings.model.title')}>
        <p className="text-sm text-gray-600 mb-3">{t('settings.model.desc')}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setModel(modelDraft);
          }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <input
            type="text"
            value={modelDraft}
            onChange={(e) => setModelDraft(e.target.value)}
            spellCheck={false}
            aria-label={t('settings.model.aria')}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-accent-ink focus:border-accent-ink outline-hidden"
          />
          <button type="submit" disabled={!modelDraft.trim() || modelDraft.trim() === model} className="px-4 py-2.5 min-h-11 rounded-lg bg-accent text-accent-fg text-sm font-semibold hover:bg-accent-hover disabled:bg-gray-300 disabled:cursor-not-allowed">
            {t('common.save')}
          </button>
          <button type="button" onClick={resetModel} disabled={model === DEFAULT_MODEL} className="inline-flex items-center justify-center px-4 py-2.5 min-h-11 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <RotateCcw size={14} className="mr-2" /> {t('settings.model.default')}
          </button>
        </form>

        {/* Modello di riserva */}
        <div className="mt-6 pt-5 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">{t('settings.fallback.title')}</h3>
          <p className="text-sm text-gray-600 mt-1 mb-3">{t('settings.fallback.desc')}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const clean = fallbackDraft.trim();
              if (!clean) return; // il nome non può restare vuoto (il pulsante è disattivato); per spegnere la riserva c'è l'interruttore
              // Si salva solo il nome. La riserva è attiva di default e solo l'interruttore la accende o la spegne: cambiare il nome
              // non deve riaccenderla a chi l'ha disattivata.
              setFallbackModel(clean);
            }}
            className="flex flex-col sm:flex-row gap-2"
          >
            <input
              type="text"
              value={fallbackDraft}
              onChange={(e) => setFallbackDraft(e.target.value)}
              spellCheck={false}
              placeholder={t('settings.fallback.placeholder')}
              aria-label={t('settings.fallback.aria')}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-accent-ink focus:border-accent-ink outline-hidden"
            />
            <button type="submit" disabled={!fallbackDraft.trim() || fallbackDraft.trim() === fallbackModel} className="px-4 py-2.5 min-h-11 rounded-lg bg-accent text-accent-fg text-sm font-semibold hover:bg-accent-hover disabled:bg-gray-300 disabled:cursor-not-allowed">
              {t('common.save')}
            </button>
            <button
              type="button"
              onClick={() => {
                setFallbackDraft(DEFAULT_FALLBACK_MODEL);
                resetFallbackModel();
              }}
              disabled={fallbackModel === DEFAULT_FALLBACK_MODEL && fallbackDraft.trim() === DEFAULT_FALLBACK_MODEL}
              className="inline-flex items-center justify-center px-4 py-2.5 min-h-11 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <RotateCcw size={14} className="mr-2" /> {t('settings.model.default')}
            </button>
          </form>
          {fallbackDraft.trim() !== '' && fallbackDraft.trim() === model && (
            <p role="alert" className="mt-2 text-xs text-red-700">{t('settings.fallback.same')}</p>
          )}
          <label className="flex items-start gap-3 min-h-11 mt-3 cursor-pointer">
            <input
              type="checkbox"
              checked={fallbackEnabled}
              disabled={!fallbackModel || fallbackModel === model}
              onChange={(e) => setFallbackEnabled(e.target.checked)}
              className="mt-1 h-5 w-5 shrink-0"
            />
            <span>
              <span className="block text-sm font-medium text-gray-800">{t('settings.fallback.toggle')}</span>
              <span className="block text-xs text-gray-600">{t('settings.fallback.toggleDesc')}</span>
            </span>
          </label>
        </div>
      </Section>

      {/* Prompt di sistema */}
      <Section id="prompt" icon={<MessageSquareText size={20} />} title={t('settings.prompts.title')}>
        <div role="tablist" className="flex flex-wrap gap-2 mb-4">
          {PROMPT_KEYS.map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={activePrompt === k}
              onClick={() => setActivePrompt(k)}
              className={`px-3 py-2 min-h-11 rounded-full text-sm font-medium transition-colors ${activePrompt === k ? 'bg-accent text-accent-fg' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {t(`prompt.${k}.label` as TranslationKey)}
              {isPromptCustomized(k) && (
                <span
                  className="ml-1.5 inline-block w-2 h-2 rounded-full bg-amber-400 align-middle"
                  title={t('settings.prompts.customized')}
                  role="img"
                  aria-label={t('settings.prompts.customized')}
                />
              )}
            </button>
          ))}
        </div>
        <PromptEditor promptKey={activePrompt} />
        <div className="mt-6 pt-4 border-t border-gray-100">
          <button onClick={resetAllPrompts} disabled={!anyCustomized} className="inline-flex items-center min-h-11 text-sm text-gray-700 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed">
            <RotateCcw size={14} className="mr-2" /> {t('settings.prompts.resetAll')}
          </button>
        </div>
      </Section>

      {/* Visualizzazione */}
      <Section id="vista" icon={<LayoutGrid size={20} />} title={t('settings.view.title')}>
        <p className="text-gray-600 mb-4">{t('settings.view.desc')}</p>
        <div className="flex space-x-4">
          <button
            onClick={() => setViewMode('grid')}
            className={`flex-1 p-4 rounded-lg border-2 flex flex-col items-center justify-center space-y-2 transition-all ${viewMode === 'grid' ? 'border-accent-ink bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}
          >
            <LayoutGrid size={24} className={viewMode === 'grid' ? 'text-fg' : 'text-gray-400'} />
            <span className={`font-medium ${viewMode === 'grid' ? 'text-fg' : 'text-gray-600'}`}>{t('settings.view.grid')}</span>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex-1 p-4 rounded-lg border-2 flex flex-col items-center justify-center space-y-2 transition-all ${viewMode === 'list' ? 'border-accent-ink bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}
          >
            <List size={24} className={viewMode === 'list' ? 'text-fg' : 'text-gray-400'} />
            <span className={`font-medium ${viewMode === 'list' ? 'text-fg' : 'text-gray-600'}`}>{t('settings.view.list')}</span>
          </button>
        </div>
      </Section>

      {/* Tema */}
      <Section id="aspetto" icon={<Palette size={20} />} title={t('settings.appearance.title')}>
        <ThemeSettings />
      </Section>

      {/* Installazione come app */}
      <Section id="app" icon={<Smartphone size={20} />} title={t('settings.app.title')}>
        <AppInstallPanel />
      </Section>

      {/* Info e dipendenze */}
      <AboutPanel />
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
