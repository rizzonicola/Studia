import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { STORAGE_KEYS } from '../config/appConfig';
import {
  AccentChoice,
  Scheme,
  SchemeConfig,
  ThemeConfig,
  defaultThemeConfig,
  migrateLegacyThemeColor,
  sanitizeThemeConfig,
} from '../config/themes';
import { Palette, applyThemeToDocument, buildBootSnapshot, computeTheme, resolveScheme } from '../utils/themeEngine';
import { safeStorage } from '../utils/safeStorage';

export type { ThemeColor } from '../config/themes';
export type ViewMode = 'grid' | 'list';

/**
 * Classi Tailwind dell'accento. Sono costanti: i colori reali arrivano dalle variabili CSS (--color-accent, ...)
 * calcolate dal motore dei temi, quindi funzionano con qualunque colore (anche personalizzato) e in chiaro/scuro.
 */
export interface ThemeClasses {
  bg: string;
  hover: string;
  text: string;
  ring: string;
  border: string;
  bgSoft: string;
  /** Colore del testo sopra lo sfondo dell'accento (scelto in automatico per un buon contrasto). */
  fg: string;
}

const THEME_CLASSES: ThemeClasses = {
  bg: 'bg-accent',
  hover: 'hover:bg-accent-hover',
  text: 'text-accent-ink',
  ring: 'ring-accent-ink',
  border: 'border-accent-ink',
  bgSoft: 'bg-accent-soft',
  fg: 'text-accent-fg',
};

interface ThemeContextType {
  /** Configurazione completa dell'aspetto (modalità, tavolozze, accento, testo, forma...). */
  config: ThemeConfig;
  /** Modifica una parte della configurazione. */
  updateConfig: (patch: Partial<ThemeConfig>) => void;
  /** Modifica le impostazioni di uno schema (chiaro o scuro). */
  updateScheme: (scheme: Scheme, patch: Partial<SchemeConfig>) => void;
  /** Sostituisce tutta la configurazione (importazione da file): i dati vengono sempre validati. */
  replaceConfig: (raw: unknown) => void;
  resetConfig: () => void;
  /** Schema effettivamente in uso ora (risolve "automatica" e "orario"). */
  scheme: Scheme;
  /** Tono reale dei colori (scuro se le schede sono scure). */
  tone: Scheme;
  /** Colori risolti in esadecimale (per elementi non stilabili con CSS, come la mappa concettuale). */
  palette: Palette;

  // Compatibilità con il codice esistente
  themeColor: AccentChoice;
  setThemeColor: (color: AccentChoice) => void;
  getThemeClasses: () => ThemeClasses;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

/** Configurazione salvata (sempre validata); null se non c'è. Nessun effetto collaterale. */
function readStoredConfig(): ThemeConfig | null {
  const raw = safeStorage.get(STORAGE_KEYS.themeConfig);
  if (!raw) return null;
  try {
    return sanitizeThemeConfig(JSON.parse(raw));
  } catch {
    return defaultThemeConfig();
  }
}

function readConfig(): ThemeConfig {
  const stored = readStoredConfig();
  if (stored) return stored;
  // Prima apertura dopo l'aggiornamento: si recupera il vecchio colore (se c'era) e si elimina la vecchia chiave
  const legacy = safeStorage.get(STORAGE_KEYS.theme);
  if (legacy !== null) safeStorage.remove(STORAGE_KEYS.theme);
  return migrateLegacyThemeColor(legacy);
}

const prefersDarkQuery = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Lettura sincrona: niente "flash" del tema predefinito al primo render
  const [config, setConfig] = useState<ThemeConfig>(readConfig);
  const [viewMode, setViewModeState] = useState<ViewMode>(() => (safeStorage.get(STORAGE_KEYS.viewMode) === 'list' ? 'list' : 'grid'));
  const [prefersDark, setPrefersDark] = useState<boolean>(() => prefersDarkQuery()?.matches ?? false);
  // Nella modalità "orario" serve rivalutare l'ora ogni tanto
  const [tick, setTick] = useState(0);

  // Preferenza di sistema (tema chiaro/scuro del dispositivo): segue i cambiamenti in tempo reale
  useEffect(() => {
    const mq = prefersDarkQuery();
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    setPrefersDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (config.mode !== 'schedule') return;
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000);
    const onVisible = () => setTick((n) => n + 1); // al ritorno sulla scheda l'ora può essere cambiata
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [config.mode]);

  const scheme = useMemo<Scheme>(
    () => resolveScheme(config.mode, prefersDark, new Date(), config.darkFrom, config.darkTo),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.mode, config.darkFrom, config.darkTo, prefersDark, tick]
  );

  const result = useMemo(() => computeTheme(config, scheme), [config, scheme]);

  // Un'altra scheda ha cambiato aspetto o vista: si segue (prima ogni scheda restava con il proprio stato e poteva sovrascrivere l'altra).
  // Nessun "rimbalzo": riscrivere un valore identico non scrive nulla (safeStorage.set) e quindi non genera altri eventi.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === STORAGE_KEYS.themeConfig) {
        const incoming = readStoredConfig();
        if (incoming) setConfig((current) => (JSON.stringify(current) === JSON.stringify(incoming) ? current : incoming));
      }
      if (e.key === null || e.key === STORAGE_KEYS.viewMode) setViewModeState(safeStorage.get(STORAGE_KEYS.viewMode) === 'list' ? 'list' : 'grid');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Applicazione sincrona prima della pittura: nessun lampo durante i cambi di tema
  useLayoutEffect(() => {
    applyThemeToDocument(result);
  }, [result]);

  // Salvataggio (con breve attesa: i selettori colore e i cursori generano molti eventi ravvicinati)
  const firstRun = useRef(true);
  useEffect(() => {
    const save = () => {
      safeStorage.set(STORAGE_KEYS.themeConfig, JSON.stringify(config));
      // Istantanea per public/theme-init.js: applica il tema prima che React parta
      safeStorage.set(STORAGE_KEYS.themeBoot, JSON.stringify(buildBootSnapshot(config)));
    };
    if (firstRun.current) {
      firstRun.current = false;
      // Al primo avvio si scrive subito (serve anche per rigenerare l'istantanea dopo un aggiornamento dell'app);
      // se il contenuto non è cambiato safeStorage.set non scrive nulla
      save();
      return;
    }
    const id = window.setTimeout(save, 150);
    return () => window.clearTimeout(id);
  }, [config]);

  const updateConfig = useCallback((patch: Partial<ThemeConfig>) => setConfig((c) => sanitizeThemeConfig({ ...c, ...patch })), []);

  const updateScheme = useCallback(
    (target: Scheme, patch: Partial<SchemeConfig>) => setConfig((c) => sanitizeThemeConfig({ ...c, [target]: { ...c[target], ...patch } })),
    []
  );

  const replaceConfig = useCallback((raw: unknown) => setConfig(sanitizeThemeConfig(raw)), []);
  const resetConfig = useCallback(() => setConfig(defaultThemeConfig()), []);

  const setThemeColor = useCallback((color: AccentChoice) => setConfig((c) => sanitizeThemeConfig({ ...c, [scheme]: { ...c[scheme], accent: color } })), [scheme]);

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    safeStorage.set(STORAGE_KEYS.viewMode, mode);
  }, []);

  const getThemeClasses = useCallback(() => THEME_CLASSES, []);

  const value = useMemo<ThemeContextType>(
    () => ({
      config,
      updateConfig,
      updateScheme,
      replaceConfig,
      resetConfig,
      scheme,
      tone: result.tone,
      palette: result.palette,
      themeColor: config[scheme].accent,
      setThemeColor,
      getThemeClasses,
      viewMode,
      setViewMode,
    }),
    [config, updateConfig, updateScheme, replaceConfig, resetConfig, scheme, result, setThemeColor, getThemeClasses, viewMode, setViewMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
