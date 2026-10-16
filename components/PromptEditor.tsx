import React, { useEffect, useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { useI18n } from '../i18n/I18nProvider';
import type { PromptKey } from '../services/prompts';
import type { TranslationKey } from '../i18n/types';
import { MAX_CUSTOM_PROMPT_CHARS } from '../config/appConfig';

/**
 * Editor del prompt di sistema.
 *
 * Il prompt predefinito resta nel codice (services/prompts/<lingua>.ts) e NON viene mai mostrato qui:
 *  - campo vuoto  → l'app usa il prompt predefinito integrato, nella lingua attiva
 *  - campo pieno  → il testo dell'utente sostituisce completamente il predefinito (in qualunque lingua)
 *  - "Ripristina" → cancella il testo personalizzato e torna al predefinito
 * Cambiando lingua i prompt personalizzati salvati non vengono toccati.
 */
const PromptEditor: React.FC<{ promptKey: PromptKey }> = ({ promptKey: key }) => {
  const { getCustomPrompt, isPromptCustomized, setPrompt, resetPrompt } = useSettings();
  const { t, formatNumber } = useI18n();
  const saved = getCustomPrompt(key);
  const [draft, setDraft] = useState(saved);
  const [justSaved, setJustSaved] = useState(false);

  // Riallinea la bozza quando cambia il prompt salvato o si passa a un'altra scheda
  useEffect(() => {
    setDraft(saved);
    setJustSaved(false);
  }, [saved, key]);

  // Il messaggio "Salvato" sparisce dopo 2 secondi (timer ripulito allo smontaggio)
  useEffect(() => {
    if (!justSaved) return;
    const timer = setTimeout(() => setJustSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [justSaved]);

  const dirty = draft !== saved;
  const customized = isPromptCustomized(key);

  const handleSave = () => {
    setPrompt(key, draft);
    if (!draft.trim()) setDraft('');
    setJustSaved(true);
  };

  const handleReset = () => {
    resetPrompt(key);
    setDraft('');
  };

  return (
    <div>
      <p className="text-sm text-gray-600 mb-3">{t(`prompt.${key}.description` as TranslationKey)}</p>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={6}
        maxLength={MAX_CUSTOM_PROMPT_CHARS}
        spellCheck={false}
        placeholder={t('promptEditor.placeholder')}
        aria-label={t('promptEditor.aria', { label: t(`prompt.${key}.label` as TranslationKey) })}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs leading-relaxed placeholder:font-sans placeholder:text-sm placeholder:text-gray-500 focus:ring-2 focus:ring-accent-ink focus:border-accent-ink outline-hidden resize-y"
      />

      <p className="mt-1 text-xs text-gray-600 text-right">
        {t('promptEditor.counter', { count: formatNumber(draft.length), max: formatNumber(MAX_CUSTOM_PROMPT_CHARS) })}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!dirty}
          className="inline-flex items-center px-4 py-2.5 min-h-11 rounded-lg bg-accent text-accent-fg text-sm font-semibold hover:bg-accent-hover disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
        >
          <Save size={16} className="mr-2" aria-hidden="true" /> {t('promptEditor.save')}
        </button>
        <button
          onClick={handleReset}
          disabled={!customized && !draft}
          className="inline-flex items-center px-4 py-2.5 min-h-11 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RotateCcw size={16} className="mr-2" aria-hidden="true" /> {t('promptEditor.reset')}
        </button>
        {justSaved && <span className="text-sm text-green-700" role="status">{t('common.saved')}</span>}
        {customized && !dirty && !justSaved && <span className="text-xs text-gray-600">{t('settings.prompts.customized')}</span>}
      </div>
    </div>
  );
};

export default PromptEditor;
