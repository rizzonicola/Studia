import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { STORAGE_KEYS } from '../config/appConfig';
import { safeStorage } from '../utils/safeStorage';
import {
  activateLanguage,
  formatDate,
  formatNumber,
  getDeviceLanguages,
  getLanguage,
  readLanguagePreference,
  t,
  tp,
} from './core';
import { Language, LanguagePreference, resolveLanguage } from './resolve';

interface I18nContextType {
  /** Lingua effettivamente in uso (già risolta se la preferenza è "Sistema"). */
  language: Language;
  /** Preferenza salvata: 'system' | 'it' | 'en' | 'fr'. */
  preference: LanguagePreference;
  setPreference: (pref: LanguagePreference) => void;
  t: typeof t;
  tp: typeof tp;
  formatDate: typeof formatDate;
  formatNumber: typeof formatNumber;
}

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [preference, setPreferenceState] = useState<LanguagePreference>(() => readLanguagePreference());
  const [deviceLanguages, setDeviceLanguages] = useState<readonly string[]>(() => getDeviceLanguages());
  // Il dizionario iniziale è già stato caricato da initI18n() prima del render.
  const [language, setLanguage] = useState<Language>(() => getLanguage());
  const requestId = useRef(0);

  // Con "Sistema" attivo l'app segue il cambio di lingua del dispositivo
  useEffect(() => {
    const onLanguageChange = () => setDeviceLanguages(getDeviceLanguages());
    window.addEventListener('languagechange', onLanguageChange);
    return () => window.removeEventListener('languagechange', onLanguageChange);
  }, []);

  // Sincronizza la preferenza modificata da un'altra scheda
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === STORAGE_KEYS.language) setPreferenceState(readLanguagePreference());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Applica la lingua risolta: caricamento lazy del dizionario, poi aggiornamento immediato senza ricaricare la pagina
  useEffect(() => {
    const target = resolveLanguage(preference, deviceLanguages);
    if (target === getLanguage() && target === language) return;
    const id = ++requestId.current;
    activateLanguage(target)
      .then(() => {
        if (id === requestId.current) setLanguage(target);
      })
      .catch(() => {
        /* dizionario non scaricabile (offline senza cache): si resta nella lingua corrente */
      });
  }, [preference, deviceLanguages, language]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setPreference = useCallback((pref: LanguagePreference) => {
    safeStorage.set(STORAGE_KEYS.language, pref);
    setPreferenceState(pref);
  }, []);

  const value = useMemo<I18nContextType>(
    () => ({ language, preference, setPreference, t, tp, formatDate, formatNumber }),
    [language, preference, setPreference]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextType => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
};
