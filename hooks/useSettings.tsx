import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { DEFAULT_FALLBACK_MODEL, DEFAULT_MODEL, LEGAL_VERSION, MAX_CUSTOM_PROMPT_CHARS, STORAGE_KEYS } from '../config/appConfig';
import { PROMPT_KEYS, PromptKey } from '../services/prompts';
import { ContentLanguageMode, isContentLanguageMode } from '../i18n/resolve';
import { safeStorage as storage, safeSession } from '../utils/safeStorage';
import { moveApiKey, readApiKey, removeApiKey, saveApiKey, type KeyStores, type StoredKey } from '../services/apiKeyStore';
import { readFallbackEnabled, saveFallbackEnabled } from '../services/fallbackPreference';

/** Dove vive la chiave API: localStorage (ricordata) o sessionStorage (solo questa sessione), a scelta dell'utente. */
const keyStores: KeyStores = { local: storage, session: safeSession };

export type CustomPrompts = Partial<Record<PromptKey, string>>;

function readCustomPrompts(): CustomPrompts {
  const raw = storage.get(STORAGE_KEYS.prompts);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: CustomPrompts = {};
    PROMPT_KEYS.forEach((k) => {
      if (typeof parsed[k] === 'string' && parsed[k].trim()) out[k] = parsed[k];
    });
    return out;
  } catch {
    return {};
  }
}

function readLegalAccepted(): boolean {
  const raw = storage.get(STORAGE_KEYS.legal);
  if (!raw) return false;
  try {
    return JSON.parse(raw)?.version === LEGAL_VERSION;
  } catch {
    return false;
  }
}

function readContentLanguage(): ContentLanguageMode {
  const raw = storage.get(STORAGE_KEYS.contentLanguage);
  return isContentLanguageMode(raw) ? raw : 'source';
}

interface SettingsContextType {
  // API key
  apiKey: string | null;
  hasApiKey: boolean;
  /** true = la chiave si ricorda su questo dispositivo; false = solo per la sessione (sessionStorage). */
  rememberKey: boolean;
  /** `remember` omesso = si mantiene la scelta corrente. */
  setApiKey: (key: string, remember?: boolean) => void;
  setRememberKey: (remember: boolean) => void;
  clearApiKey: () => void;

  // Modello
  model: string;
  setModel: (model: string) => void;
  resetModel: () => void;

  // Modello di riserva: attivo di default (DEFAULT_FALLBACK_ENABLED), l'utente può disattivarlo. Il NOME non è mai vuoto (predefinito:
  // DEFAULT_FALLBACK_MODEL); l'attivazione è una scelta separata (interruttore in Impostazioni) e nessuna azione la cambia al posto dell'utente.
  fallbackEnabled: boolean;
  fallbackModel: string;
  setFallbackEnabled: (enabled: boolean) => void;
  /** Nome vuoto = si torna al predefinito (per disattivare la riserva si usa setFallbackEnabled). */
  setFallbackModel: (model: string) => void;
  resetFallbackModel: () => void;

  // Prompt di sistema (personalizzati). Il predefinito NON è qui: vive in services/prompts/<lingua>.ts
  /** Prompt personalizzati salvati: chiave assente = si usa il predefinito nella lingua attiva */
  customPrompts: CustomPrompts;
  isPromptCustomized: (key: PromptKey) => boolean;
  /** Testo personalizzato salvato dall'utente ('' se sta usando il predefinito integrato) */
  getCustomPrompt: (key: PromptKey) => string;
  setPrompt: (key: PromptKey, value: string) => void;
  resetPrompt: (key: PromptKey) => void;
  resetAllPrompts: () => void;

  // Lingua dei contenuti generati
  contentLanguage: ContentLanguageMode;
  setContentLanguage: (mode: ContentLanguageMode) => void;

  // Legale
  legalAccepted: boolean;
  acceptLegal: () => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [keyState, setKeyState] = useState<StoredKey>(() => readApiKey(keyStores));
  const keyRef = useRef<StoredKey>(keyState); // copia sincrona: i callback non leggono valori obsoleti
  const commitKey = useCallback((next: StoredKey) => {
    keyRef.current = next;
    setKeyState(next);
  }, []);
  const { key: apiKey, remember: rememberKey } = keyState;
  const [model, setModelState] = useState<string>(() => storage.get(STORAGE_KEYS.model) || DEFAULT_MODEL);
  const [fallbackModel, setFallbackModelState] = useState<string>(() => storage.get(STORAGE_KEYS.fallbackModel) || DEFAULT_FALLBACK_MODEL);
  const [fallbackOn, setFallbackOn] = useState<boolean>(() => readFallbackEnabled(storage));
  const [customPrompts, setCustomPrompts] = useState<CustomPrompts>(() => readCustomPrompts());
  const [legalAccepted, setLegalAccepted] = useState<boolean>(() => readLegalAccepted());
  const [contentLanguage, setContentLanguageState] = useState<ContentLanguageMode>(() => readContentLanguage());

  // Copia sincrona dei prompt: evita effetti collaterali (scrittura su localStorage) dentro gli updater di setState
  const promptsRef = useRef<CustomPrompts>(customPrompts);

  // Sincronizza le modifiche fatte da un'altra scheda del browser
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === STORAGE_KEYS.apiKey || e.key === STORAGE_KEYS.apiKeySessionOnly) commitKey(readApiKey(keyStores));
      if (e.key === null || e.key === STORAGE_KEYS.model) setModelState(storage.get(STORAGE_KEYS.model) || DEFAULT_MODEL);
      if (e.key === null || e.key === STORAGE_KEYS.fallbackModel) setFallbackModelState(storage.get(STORAGE_KEYS.fallbackModel) || DEFAULT_FALLBACK_MODEL);
      if (e.key === null || e.key === STORAGE_KEYS.fallbackEnabled) setFallbackOn(readFallbackEnabled(storage));
      if (e.key === null || e.key === STORAGE_KEYS.prompts) {
        const next = readCustomPrompts();
        promptsRef.current = next;
        setCustomPrompts(next);
      }
      if (e.key === null || e.key === STORAGE_KEYS.legal) setLegalAccepted(readLegalAccepted());
      if (e.key === null || e.key === STORAGE_KEYS.contentLanguage) setContentLanguageState(readContentLanguage());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [commitKey]);

  const setApiKey = useCallback(
    (key: string, remember: boolean = keyRef.current.remember) => {
      const clean = key.trim();
      saveApiKey(keyStores, clean, remember); // se il salvataggio fallisce l'utente viene avvisato (utils/storageStatus) e la chiave resta in memoria
      commitKey({ key: clean, remember });
    },
    [commitKey]
  );

  const setRememberKey = useCallback(
    (remember: boolean) => {
      moveApiKey(keyStores, keyRef.current.key, remember);
      commitKey({ key: keyRef.current.key, remember });
    },
    [commitKey]
  );

  const clearApiKey = useCallback(() => {
    removeApiKey(keyStores);
    commitKey({ key: null, remember: keyRef.current.remember });
  }, [commitKey]);

  const setModel = useCallback((value: string) => {
    const clean = value.trim();
    if (!clean) return;
    storage.set(STORAGE_KEYS.model, clean);
    setModelState(clean);
  }, []);

  const resetModel = useCallback(() => {
    storage.remove(STORAGE_KEYS.model);
    setModelState(DEFAULT_MODEL);
  }, []);

  const resetFallbackModel = useCallback(() => {
    storage.remove(STORAGE_KEYS.fallbackModel);
    setFallbackModelState(DEFAULT_FALLBACK_MODEL);
  }, []);

  const setFallbackModel = useCallback(
    (value: string) => {
      const clean = value.trim();
      if (!clean) return resetFallbackModel();
      storage.set(STORAGE_KEYS.fallbackModel, clean);
      setFallbackModelState(clean);
    },
    [resetFallbackModel]
  );

  const setFallbackEnabled = useCallback((enabled: boolean) => {
    saveFallbackEnabled(storage, enabled); // si salva solo la scelta che si discosta dal predefinito (services/fallbackPreference.ts)
    setFallbackOn(enabled);
  }, []);

  const commitPrompts = useCallback((next: CustomPrompts) => {
    promptsRef.current = next;
    if (Object.keys(next).length === 0) storage.remove(STORAGE_KEYS.prompts);
    else storage.set(STORAGE_KEYS.prompts, JSON.stringify(next));
    setCustomPrompts(next);
  }, []);

  const setPrompt = useCallback(
    (key: PromptKey, value: string) => {
      const next = { ...promptsRef.current };
      // Prompt vuoto = nessuna personalizzazione: si torna al predefinito integrato nel codice
      if (!value.trim()) delete next[key];
      else next[key] = value.slice(0, MAX_CUSTOM_PROMPT_CHARS);
      commitPrompts(next);
    },
    [commitPrompts]
  );

  const resetPrompt = useCallback(
    (key: PromptKey) => {
      const next = { ...promptsRef.current };
      delete next[key];
      commitPrompts(next);
    },
    [commitPrompts]
  );

  const resetAllPrompts = useCallback(() => commitPrompts({}), [commitPrompts]);

  const setContentLanguage = useCallback((mode: ContentLanguageMode) => {
    storage.set(STORAGE_KEYS.contentLanguage, mode);
    setContentLanguageState(mode);
  }, []);

  const acceptLegal = useCallback(() => {
    storage.set(STORAGE_KEYS.legal, JSON.stringify({ version: LEGAL_VERSION, acceptedAt: new Date().toISOString() }));
    setLegalAccepted(true);
  }, []);

  const isPromptCustomized = useCallback((key: PromptKey) => key in customPrompts, [customPrompts]);
  const getCustomPrompt = useCallback((key: PromptKey) => customPrompts[key] ?? '', [customPrompts]);

  const value = useMemo<SettingsContextType>(
    () => ({
      apiKey,
      hasApiKey: !!apiKey,
      rememberKey,
      setApiKey,
      setRememberKey,
      clearApiKey,
      model,
      setModel,
      resetModel,
      // Attivo solo se non è stato disattivato, con un nome valido e diverso dal modello principale
      fallbackEnabled: fallbackOn && !!fallbackModel && fallbackModel !== model,
      fallbackModel,
      setFallbackEnabled,
      setFallbackModel,
      resetFallbackModel,
      customPrompts,
      isPromptCustomized,
      getCustomPrompt,
      setPrompt,
      resetPrompt,
      resetAllPrompts,
      contentLanguage,
      setContentLanguage,
      legalAccepted,
      acceptLegal,
    }),
    [
      apiKey, rememberKey, setApiKey, setRememberKey, clearApiKey, model, setModel, resetModel, fallbackOn, fallbackModel, setFallbackEnabled, setFallbackModel, resetFallbackModel, customPrompts, isPromptCustomized, getCustomPrompt,
      setPrompt, resetPrompt, resetAllPrompts, contentLanguage, setContentLanguage, legalAccepted, acceptLegal,
    ]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
};
