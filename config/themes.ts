/**
 * Definizione dei temi di StudIA: tipi, tavolozze predefinite, colori d'accento, opzioni di testo/forma e
 * validazione rigorosa della configurazione (che arriva da localStorage o da file importati dall'utente).
 *
 * Sicurezza: nei CSS finiscono SOLO colori esadecimali validati, numeri limitati a un intervallo e valori scelti
 * da elenchi chiusi (enum). Nessuna stringa libera dell'utente viene mai scritta nello stile.
 */
import { normalizeHex } from '../utils/color';

// ---------------------------------------------------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------------------------------------------------

export type Scheme = 'light' | 'dark';
export type ThemeMode = 'system' | 'light' | 'dark' | 'schedule';

export type ThemeColor = 'blue' | 'indigo' | 'purple' | 'pink' | 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'cyan' | 'gray' | 'black';
export const THEME_COLORS: readonly ThemeColor[] = ['black', 'gray', 'blue', 'indigo', 'purple', 'pink', 'red', 'orange', 'yellow', 'green', 'teal', 'cyan'];

/** 'auto' = accento suggerito dalla tavolozza; 'custom' = colore scelto dall'utente. 'black' è l'accento "neutro". */
export type AccentChoice = 'auto' | ThemeColor | 'custom';

/** Colori di base di una tavolozza: da questi si ricava tutto il resto. */
export interface BaseTokens {
  bg: string; // sfondo della pagina
  surface: string; // schede, barre, menu
  fg: string; // testo principale
  muted: string; // testo secondario
  border: string; // bordi e separatori
}
export const TOKEN_KEYS = ['bg', 'surface', 'fg', 'muted', 'border'] as const;
export type TokenKey = (typeof TOKEN_KEYS)[number];

export interface Preset {
  id: string;
  scheme: Scheme;
  tokens: BaseTokens;
  /** Accento usato con "Automatico" (null = neutro: il colore del testo). */
  accent: string | null;
  /** Il tema chiaro originale: non sovrascrive le classi di Tailwind (l'aspetto resta identico a prima). */
  native?: boolean;
}

export const FONT_IDS = ['system', 'humanist', 'rounded', 'serif', 'mono', 'readable'] as const;
export type FontId = (typeof FONT_IDS)[number];
/** Il carattere delle note può essere "come l'interfaccia" (inherit) oppure uno specifico. */
export const READER_FONT_IDS = ['inherit', ...FONT_IDS] as const;
export type ReaderFontId = (typeof READER_FONT_IDS)[number];
export const LETTER_SPACING_IDS = ['tight', 'normal', 'wide', 'wider'] as const;
export type LetterSpacingId = (typeof LETTER_SPACING_IDS)[number];
export const RADIUS_IDS = ['sharp', 'soft', 'normal', 'round', 'pill'] as const;
export type RadiusId = (typeof RADIUS_IDS)[number];
export const READER_SIZE_IDS = ['auto', 'sm', 'base', 'lg', 'xl', '2xl'] as const;
export type ReaderSizeId = (typeof READER_SIZE_IDS)[number];
export const LINE_HEIGHT_IDS = ['compact', 'normal', 'relaxed', 'loose'] as const;
export type LineHeightId = (typeof LINE_HEIGHT_IDS)[number];
export const READER_WIDTH_IDS = ['narrow', 'medium', 'wide', 'full'] as const;
export type ReaderWidthId = (typeof READER_WIDTH_IDS)[number];
export const PATTERN_IDS = ['none', 'dots', 'grid', 'lines'] as const;
export type PatternId = (typeof PATTERN_IDS)[number];
export const MOTION_IDS = ['system', 'reduce', 'full'] as const;
export type MotionId = (typeof MOTION_IDS)[number];
export const CARD_SIZE_IDS = ['compact', 'normal', 'large'] as const;
export type CardSizeId = (typeof CARD_SIZE_IDS)[number];
export const NOTE_HTML_IDS = ['adapt', 'original'] as const;
export type NoteHtmlId = (typeof NOTE_HTML_IDS)[number];
export const CONTRAST_IDS = ['normal', 'high'] as const;
export type ContrastId = (typeof CONTRAST_IDS)[number];

export interface SchemeConfig {
  preset: string;
  accent: AccentChoice;
  customAccent: string;
  /** Colori di base modificati dall'utente (sovrascrivono quelli della tavolozza). */
  custom: Partial<BaseTokens>;
}

export interface SavedTheme {
  id: string;
  name: string;
  scheme: Scheme;
  config: SchemeConfig;
}

export interface ThemeConfig {
  v: 1;
  mode: ThemeMode;
  /** Modalità "orario": il tema scuro è attivo dalle `darkFrom` alle `darkTo` (HH:MM). */
  darkFrom: string;
  darkTo: string;
  light: SchemeConfig;
  dark: SchemeConfig;
  contrast: ContrastId;
  /** Intensità (%) dei colori di note e cartelle nei temi scuri. */
  noteTint: number;
  noteHtml: NoteHtmlId;
  uiFont: FontId;
  readerFont: ReaderFontId;
  /** Dimensione del testo dell'app (%). */
  fontScale: number;
  letterSpacing: LetterSpacingId;
  readerSize: ReaderSizeId;
  readerLineHeight: LineHeightId;
  readerWidth: ReaderWidthId;
  radius: RadiusId;
  cardSize: CardSizeId;
  pattern: PatternId;
  motion: MotionId;
  savedThemes: SavedTheme[];
}

// ---------------------------------------------------------------------------------------------------------------------
// Tavolozze predefinite
// ---------------------------------------------------------------------------------------------------------------------

export const LIGHT_PRESETS: readonly Preset[] = [
  // "Classico" = l'aspetto originale dell'app: valori identici ai grigi di Tailwind, nessuna sovrascrittura
  { id: 'classic', scheme: 'light', native: true, accent: null, tokens: { bg: '#f9fafb', surface: '#ffffff', fg: '#111827', muted: '#6b7280', border: '#e5e7eb' } },
  { id: 'paper', scheme: 'light', accent: '#b45309', tokens: { bg: '#f4efe6', surface: '#fffcf5', fg: '#2b2620', muted: '#6b6257', border: '#e2d9c8' } },
  { id: 'mint', scheme: 'light', accent: '#0f766e', tokens: { bg: '#eef6f3', surface: '#ffffff', fg: '#12302a', muted: '#4f6b64', border: '#cfe3dc' } },
  { id: 'lavender', scheme: 'light', accent: '#6d28d9', tokens: { bg: '#f3f1fa', surface: '#ffffff', fg: '#231f3a', muted: '#5d5880', border: '#dcd8ee' } },
  { id: 'sky', scheme: 'light', accent: '#0369a1', tokens: { bg: '#eef4fb', surface: '#ffffff', fg: '#10233a', muted: '#506580', border: '#d3e0ef' } },
  { id: 'rose', scheme: 'light', accent: '#be123c', tokens: { bg: '#fbf1f3', surface: '#ffffff', fg: '#3a1d25', muted: '#7a5560', border: '#efd6db' } },
  { id: 'contrast', scheme: 'light', accent: '#000000', tokens: { bg: '#ffffff', surface: '#ffffff', fg: '#000000', muted: '#262626', border: '#525252' } },
];

export const DARK_PRESETS: readonly Preset[] = [
  // "Ardesia": i colori della palette di riferimento (grigio-blu #282c35 / #20232a e verde acqua #0c9488)
  { id: 'slate', scheme: 'dark', accent: '#0c9488', tokens: { bg: '#20232a', surface: '#282c35', fg: '#e8eaed', muted: '#a0a7b4', border: '#3a404b' } },
  { id: 'amoled', scheme: 'dark', accent: '#3b82f6', tokens: { bg: '#000000', surface: '#0d0d0f', fg: '#f2f2f2', muted: '#a3a3a3', border: '#262628' } },
  { id: 'midnight', scheme: 'dark', accent: '#6366f1', tokens: { bg: '#0b1120', surface: '#111a2e', fg: '#e6ecf7', muted: '#98a6c0', border: '#22304d' } },
  { id: 'forest', scheme: 'dark', accent: '#22c55e', tokens: { bg: '#0f1a16', surface: '#16251f', fg: '#e3efe9', muted: '#9bb5a9', border: '#25392f' } },
  { id: 'plum', scheme: 'dark', accent: '#c084fc', tokens: { bg: '#1a1423', surface: '#231a2f', fg: '#efe8f7', muted: '#b1a3c4', border: '#382a4a' } },
  { id: 'mocha', scheme: 'dark', accent: '#f59e0b', tokens: { bg: '#1c1714', surface: '#262019', fg: '#f0e7dc', muted: '#b3a596', border: '#3b3229' } },
  { id: 'graphite', scheme: 'dark', accent: '#94a3b8', tokens: { bg: '#18181b', surface: '#202024', fg: '#ececee', muted: '#a1a1aa', border: '#34343a' } },
  { id: 'ocean', scheme: 'dark', accent: '#22d3ee', tokens: { bg: '#0c1a20', surface: '#122830', fg: '#e0f0f2', muted: '#8fb3ba', border: '#1f3d47' } },
  { id: 'contrast', scheme: 'dark', accent: '#ffd60a', tokens: { bg: '#000000', surface: '#000000', fg: '#ffffff', muted: '#e5e5e5', border: '#a3a3a3' } },
];

export const PRESETS: Record<Scheme, readonly Preset[]> = { light: LIGHT_PRESETS, dark: DARK_PRESETS };
export const DEFAULT_PRESET: Record<Scheme, string> = { light: 'classic', dark: 'slate' };

export const findPreset = (scheme: Scheme, id: string): Preset => PRESETS[scheme].find((p) => p.id === id) ?? PRESETS[scheme][0];

// ---------------------------------------------------------------------------------------------------------------------
// Colori d'accento
// ---------------------------------------------------------------------------------------------------------------------

/**
 * `light`: tinte 600/700 di Tailwind (quelle usate finora: testo bianco leggibile);
 * `dark`: tinte 500, più luminose sugli sfondi scuri; `soft`: tinta 50 (sfondo delicato nel tema chiaro).
 * 'black' non è in tabella: è l'accento neutro (il colore del testo).
 */
export const ACCENT_HEX: Record<Exclude<ThemeColor, 'black'>, { light: string; dark: string; soft: string }> = {
  blue: { light: '#2563eb', dark: '#3b82f6', soft: '#eff6ff' },
  indigo: { light: '#4f46e5', dark: '#6366f1', soft: '#eef2ff' },
  purple: { light: '#9333ea', dark: '#a855f7', soft: '#faf5ff' },
  pink: { light: '#db2777', dark: '#ec4899', soft: '#fdf2f8' },
  red: { light: '#dc2626', dark: '#ef4444', soft: '#fef2f2' },
  orange: { light: '#c2410c', dark: '#f97316', soft: '#fff7ed' },
  yellow: { light: '#a16207', dark: '#eab308', soft: '#fefce8' },
  green: { light: '#15803d', dark: '#22c55e', soft: '#f0fdf4' },
  teal: { light: '#0f766e', dark: '#14b8a6', soft: '#f0fdfa' },
  cyan: { light: '#0e7490', dark: '#06b6d4', soft: '#ecfeff' },
  gray: { light: '#4b5563', dark: '#9ca3af', soft: '#f9fafb' },
};

/** Tinta 500 di ogni famiglia di colori usata da note e cartelle (per generare i toni scuri). */
export const HUE_500: Record<string, string> = {
  red: '#ef4444',
  orange: '#f97316',
  amber: '#f59e0b',
  yellow: '#eab308',
  lime: '#84cc16',
  green: '#22c55e',
  emerald: '#10b981',
  teal: '#14b8a6',
  cyan: '#06b6d4',
  sky: '#0ea5e9',
  blue: '#3b82f6',
  indigo: '#6366f1',
  violet: '#8b5cf6',
  purple: '#a855f7',
  fuchsia: '#d946ef',
  pink: '#ec4899',
  rose: '#f43f5e',
};

// ---------------------------------------------------------------------------------------------------------------------
// Testo e forma: valori associati agli enum (solo costanti, mai input libero)
// ---------------------------------------------------------------------------------------------------------------------

/** Solo caratteri già installati sul dispositivo: la CSP non consente font esterni e nessun font viene scaricato. */
export const FONT_STACKS: Record<FontId, string> = {
  system: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  humanist: 'Seravek, "Gill Sans Nova", Ubuntu, Calibri, "DejaVu Sans", "Source Sans Pro", sans-serif',
  rounded: 'ui-rounded, "Hiragino Maru Gothic ProN", Quicksand, Comfortaa, Manjari, "Arial Rounded MT", "Arial Rounded MT Bold", Calibri, sans-serif',
  serif: 'Charter, "Bitstream Charter", "Sitka Text", Cambria, Georgia, serif',
  mono: 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, "DejaVu Sans Mono", monospace',
  readable: 'Verdana, Tahoma, "DejaVu Sans", "Trebuchet MS", sans-serif',
};

export const LETTER_SPACING_EM: Record<LetterSpacingId, string> = { tight: '-0.01em', normal: '0em', wide: '0.02em', wider: '0.05em' };
export const RADIUS_SCALE: Record<RadiusId, number> = { sharp: 0, soft: 0.5, normal: 1, round: 1.6, pill: 2.4 };
export const LINE_HEIGHT_VALUE: Record<LineHeightId, string> = { compact: '1.5', normal: '1.75', relaxed: '1.95', loose: '2.2' };
export const READER_WIDTH_VALUE: Record<ReaderWidthId, string> = { narrow: '55ch', medium: '70ch', wide: '95ch', full: 'none' };

/** Classi del plugin typography per la dimensione del testo degli appunti (scritte per intero: Tailwind non vede quelle costruite a pezzi). */
export const READER_SIZE_CLASS: Record<ReaderSizeId, string> = {
  auto: 'prose lg:prose-xl',
  sm: 'prose prose-sm',
  base: 'prose prose-base',
  lg: 'prose prose-lg',
  xl: 'prose prose-xl',
  '2xl': 'prose prose-2xl',
};

export const NOTE_TINT_MIN = 40;
export const NOTE_TINT_MAX = 180;
export const FONT_SCALE_MIN = 85;
export const FONT_SCALE_MAX = 140;
export const MAX_SAVED_THEMES = 12;
export const MAX_THEME_NAME = 40;

// ---------------------------------------------------------------------------------------------------------------------
// Predefiniti e validazione
// ---------------------------------------------------------------------------------------------------------------------

export const defaultSchemeConfig = (scheme: Scheme): SchemeConfig => ({
  preset: DEFAULT_PRESET[scheme],
  accent: 'auto',
  customAccent: '#0c9488',
  custom: {},
});

export const defaultThemeConfig = (): ThemeConfig => ({
  v: 1,
  mode: 'system',
  darkFrom: '20:00',
  darkTo: '07:00',
  light: defaultSchemeConfig('light'),
  dark: defaultSchemeConfig('dark'),
  contrast: 'normal',
  noteTint: 100,
  noteHtml: 'adapt',
  uiFont: 'system',
  readerFont: 'inherit',
  fontScale: 100,
  letterSpacing: 'normal',
  readerSize: 'auto',
  readerLineHeight: 'normal',
  readerWidth: 'full',
  radius: 'normal',
  cardSize: 'normal',
  pattern: 'none',
  motion: 'system',
  savedThemes: [],
});

const pick = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : fallback);
const num = (v: unknown, min: number, max: number, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback);
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const time = (v: unknown, fallback: string): string => (typeof v === 'string' && TIME.test(v) ? v : fallback);
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export const isThemeColor = (v: unknown): v is ThemeColor => typeof v === 'string' && (THEME_COLORS as readonly string[]).includes(v);

export function sanitizeSchemeConfig(raw: unknown, scheme: Scheme): SchemeConfig {
  const base = defaultSchemeConfig(scheme);
  if (!isRecord(raw)) return base;
  const preset = typeof raw.preset === 'string' && PRESETS[scheme].some((p) => p.id === raw.preset) ? raw.preset : base.preset;
  const accent: AccentChoice = raw.accent === 'auto' || raw.accent === 'custom' || isThemeColor(raw.accent) ? (raw.accent as AccentChoice) : 'auto';
  const customAccent = normalizeHex(raw.customAccent) ?? base.customAccent;
  const custom: Partial<BaseTokens> = {};
  if (isRecord(raw.custom)) {
    for (const k of TOKEN_KEYS) {
      const hex = normalizeHex(raw.custom[k]);
      if (hex) custom[k] = hex;
    }
  }
  return { preset, accent, customAccent, custom };
}

/** Valida e ripulisce qualunque cosa arrivi da localStorage o da un file importato. Non lancia mai eccezioni. */
export function sanitizeThemeConfig(raw: unknown): ThemeConfig {
  const d = defaultThemeConfig();
  if (!isRecord(raw)) return d;

  const saved: SavedTheme[] = [];
  if (Array.isArray(raw.savedThemes)) {
    for (const item of raw.savedThemes) {
      if (saved.length >= MAX_SAVED_THEMES) break;
      if (!isRecord(item)) continue;
      const scheme: Scheme = item.scheme === 'dark' ? 'dark' : 'light';
      const name = typeof item.name === 'string' ? item.name.replace(/\s+/g, ' ').trim().slice(0, MAX_THEME_NAME) : '';
      if (!name) continue;
      const id = typeof item.id === 'string' && /^[\w-]{1,40}$/.test(item.id) ? item.id : `t-${saved.length}-${Date.now().toString(36)}`;
      if (saved.some((s) => s.id === id)) continue;
      saved.push({ id, name, scheme, config: sanitizeSchemeConfig(item.config, scheme) });
    }
  }

  return {
    v: 1,
    mode: pick(raw.mode, ['system', 'light', 'dark', 'schedule'] as const, d.mode),
    darkFrom: time(raw.darkFrom, d.darkFrom),
    darkTo: time(raw.darkTo, d.darkTo),
    light: sanitizeSchemeConfig(raw.light, 'light'),
    dark: sanitizeSchemeConfig(raw.dark, 'dark'),
    contrast: pick(raw.contrast, CONTRAST_IDS, d.contrast),
    noteTint: num(raw.noteTint, NOTE_TINT_MIN, NOTE_TINT_MAX, d.noteTint),
    noteHtml: pick(raw.noteHtml, NOTE_HTML_IDS, d.noteHtml),
    uiFont: pick(raw.uiFont, FONT_IDS, d.uiFont),
    readerFont: pick(raw.readerFont, READER_FONT_IDS, d.readerFont),
    fontScale: num(raw.fontScale, FONT_SCALE_MIN, FONT_SCALE_MAX, d.fontScale),
    letterSpacing: pick(raw.letterSpacing, LETTER_SPACING_IDS, d.letterSpacing),
    readerSize: pick(raw.readerSize, READER_SIZE_IDS, d.readerSize),
    readerLineHeight: pick(raw.readerLineHeight, LINE_HEIGHT_IDS, d.readerLineHeight),
    readerWidth: pick(raw.readerWidth, READER_WIDTH_IDS, d.readerWidth),
    radius: pick(raw.radius, RADIUS_IDS, d.radius),
    cardSize: pick(raw.cardSize, CARD_SIZE_IDS, d.cardSize),
    pattern: pick(raw.pattern, PATTERN_IDS, d.pattern),
    motion: pick(raw.motion, MOTION_IDS, d.motion),
    savedThemes: saved,
  };
}

/**
 * Migrazione dalla vecchia impostazione (una sola stringa con il nome del colore, chiave "studia_theme").
 * "black" era il valore predefinito → diventa "Automatico".
 */
export function migrateLegacyThemeColor(legacy: string | null): ThemeConfig {
  const cfg = defaultThemeConfig();
  if (isThemeColor(legacy) && legacy !== 'black') {
    cfg.light.accent = legacy;
    cfg.dark.accent = legacy;
  }
  return cfg;
}
