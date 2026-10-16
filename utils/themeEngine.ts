/**
 * Motore dei temi: trasforma la configurazione (config/themes.ts) in variabili CSS da applicare su <html>.
 *
 * Come funziona:
 *  - Tailwind 4 genera le utilità leggendo variabili come var(--color-gray-200) o var(--radius-lg).
 *    Sovrascrivendo quelle variabili su :root cambia l'intera app senza toccare le classi dei componenti.
 *  - Dai 5 colori di base (sfondo, schede, testo, testo secondario, bordi) si ricava l'intera scala dei grigi;
 *    nei temi scuri anche i toni pastello di note/cartelle e i colori di stato (errore, info, successo).
 *  - Dall'accento si ricavano sfondo, hover, testo sopra l'accento e colore "inchiostro" con contrasto WCAG AA.
 *  - Il tema chiaro "Classico" non sovrascrive nulla: l'aspetto originale resta identico.
 */
import {
  ACCENT_HEX,
  BaseTokens,
  FONT_STACKS,
  HUE_500,
  LETTER_SPACING_EM,
  LINE_HEIGHT_VALUE,
  RADIUS_SCALE,
  READER_WIDTH_VALUE,
  Scheme,
  ThemeConfig,
  ThemeMode,
  TOKEN_KEYS,
  findPreset,
  SchemeConfig,
  Preset,
} from '../config/themes';
import { contrast, ensureContrast, isDarkColor, mix, normalizeHex, readableOn } from './color';
import { manifestUrlForBackground } from './manifestVariants';

export interface Palette {
  bg: string;
  surface: string;
  fg: string;
  muted: string;
  border: string;
  accent: string;
  accentHover: string;
  accentFg: string;
  accentInk: string;
  accentSoft: string;
  isDark: boolean;
}

export interface ThemeResult {
  scheme: Scheme;
  /** Tono effettivo (dalla luminosità delle schede): un tema "chiaro" con schede scure si comporta da scuro. */
  tone: Scheme;
  vars: Record<string, string>;
  attrs: Record<string, string>;
  palette: Palette;
}

/** Istantanea usata da public/theme-init.js per applicare il tema PRIMA del primo render (nessun lampo di tema sbagliato). */
export interface BootSnapshot {
  v: 1;
  mode: ThemeMode;
  from: string;
  to: string;
  light: BootScheme;
  dark: BootScheme;
}

export interface BootScheme {
  vars: Record<string, string>;
  attrs: Record<string, string>;
  /** Colore della barra di stato (la superficie del tema). */
  themeColor: string;
  /** Manifest da collegare con questo tema (la barra di navigazione di Android prende il colore da lì): vedi utils/manifestVariants.ts. */
  manifest: string;
}

const timeToMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Quale schema (chiaro/scuro) è attivo in questo momento. */
export function resolveScheme(mode: ThemeMode, prefersDark: boolean, now: Date, from: string, to: string): Scheme {
  if (mode === 'light' || mode === 'dark') return mode;
  if (mode === 'system') return prefersDark ? 'dark' : 'light';
  const minutes = now.getHours() * 60 + now.getMinutes();
  const a = timeToMinutes(from);
  const b = timeToMinutes(to);
  if (a === b) return 'light';
  const dark = a < b ? minutes >= a && minutes < b : minutes >= a || minutes < b;
  return dark ? 'dark' : 'light';
}

const round = (n: number) => Math.round(n * 1000) / 1000;

function resolveTokens(sc: SchemeConfig, preset: Preset, high: boolean): { tokens: BaseTokens; tone: Scheme; native: boolean } {
  const custom: Partial<BaseTokens> = {};
  let hasCustom = false;
  for (const k of TOKEN_KEYS) {
    const v = normalizeHex(sc.custom[k]);
    if (v) {
      custom[k] = v;
      hasCustom = true;
    }
  }
  let tokens: BaseTokens = { ...preset.tokens, ...custom };
  const tone: Scheme = isDarkColor(tokens.surface) ? 'dark' : 'light';
  if (high) {
    const pure = tone === 'dark' ? '#ffffff' : '#000000';
    tokens = { ...tokens, fg: mix(tokens.fg, pure, 0.7), muted: mix(tokens.muted, pure, 0.55), border: mix(tokens.border, pure, 0.55) };
  }
  const native = !!preset.native && !hasCustom && !high;
  if (!native) {
    // Il testo secondario deve restare leggibile (almeno 4,5:1) su sfondo e schede
    tokens.muted = ensureContrast(tokens.muted, [tokens.surface, tokens.bg], 4.5, tokens.fg);
  }
  return { tokens, tone, native };
}

function resolveAccent(sc: SchemeConfig, preset: Preset, tk: BaseTokens, tone: Scheme, native: boolean) {
  let neutral = false;
  let base = '#000000';
  if (sc.accent === 'auto') {
    if (preset.accent) base = preset.accent;
    else neutral = true;
  } else if (sc.accent === 'custom') {
    base = normalizeHex(sc.customAccent) ?? preset.accent ?? '#0c9488';
  } else if (sc.accent === 'black') {
    neutral = true;
  } else {
    base = ACCENT_HEX[sc.accent][tone];
  }

  const fill = neutral ? tk.fg : base;
  const fg = readableOn(fill);
  let hover: string;
  if (neutral) hover = tone === 'dark' ? '#ffffff' : '#000000';
  else hover = fg === '#ffffff' ? mix(fill, '#000000', 0.16) : mix(fill, '#ffffff', 0.16);

  let soft: string;
  if (neutral) soft = native ? '#f3f4f6' : mix(tk.surface, tk.fg, 0.07);
  else if (native && tone === 'light' && sc.accent !== 'auto' && sc.accent !== 'custom' && sc.accent !== 'black') soft = ACCENT_HEX[sc.accent].soft;
  else soft = mix(tk.surface, fill, tone === 'dark' ? 0.2 : 0.1);

  const ink = ensureContrast(fill, [tk.surface, soft, tk.bg], 4.5, tk.fg);
  return { fill, hover, fg, ink, soft };
}

/** Calcola variabili CSS, attributi e palette per uno schema (chiaro o scuro) della configurazione. */
export function computeTheme(cfg: ThemeConfig, scheme: Scheme): ThemeResult {
  const sc = cfg[scheme];
  const preset = findPreset(scheme, sc.preset);
  const { tokens: tk, tone, native } = resolveTokens(sc, preset, cfg.contrast === 'high');
  const accent = resolveAccent(sc, preset, tk, tone, native);

  const vars: Record<string, string> = {
    '--color-surface': tk.surface,
    '--color-fg': tk.fg,
    '--color-accent': accent.fill,
    '--color-accent-hover': accent.hover,
    '--color-accent-fg': accent.fg,
    '--color-accent-ink': accent.ink,
    '--color-accent-soft': accent.soft,
  };

  // Scala dei grigi: il tema "Classico" usa quella originale di Tailwind (nessuna sovrascrittura)
  if (!native) {
    vars['--color-gray-50'] = tk.bg;
    vars['--color-gray-100'] = mix(tk.surface, tk.border, 0.55);
    vars['--color-gray-200'] = tk.border;
    vars['--color-gray-300'] = mix(tk.border, tk.muted, 0.25);
    vars['--color-gray-400'] = mix(tk.border, tk.muted, 0.6);
    vars['--color-gray-500'] = tk.muted;
    vars['--color-gray-600'] = mix(tk.muted, tk.fg, 0.4);
    vars['--color-gray-700'] = mix(tk.muted, tk.fg, 0.65);
    vars['--color-gray-800'] = mix(tk.muted, tk.fg, 0.85);
    vars['--color-gray-900'] = tk.fg;
  }

  // Sugli sfondi scuri i toni pastello di note/cartelle diventano tinte scure e i testi colorati (errori, info, successo) si schiariscono
  if (tone === 'dark') {
    const k = cfg.noteTint / 100;
    const t = (p: number) => Math.min(0.85, p * k);
    for (const [hue, h500] of Object.entries(HUE_500)) {
      vars[`--color-${hue}-50`] = mix(tk.surface, h500, t(0.1));
      vars[`--color-${hue}-100`] = mix(tk.surface, h500, t(0.17));
      vars[`--color-${hue}-200`] = mix(tk.surface, h500, t(0.25));
      vars[`--color-${hue}-300`] = mix(tk.surface, h500, t(0.36));
      vars[`--color-${hue}-600`] = mix(h500, '#ffffff', 0.3);
      vars[`--color-${hue}-700`] = mix(h500, '#ffffff', 0.48);
      vars[`--color-${hue}-800`] = mix(h500, '#ffffff', 0.62);
      vars[`--color-${hue}-900`] = mix(h500, '#ffffff', 0.75);
    }
  }

  // Testo e forma
  vars['--ui-font'] = FONT_STACKS[cfg.uiFont];
  vars['--reader-font'] = cfg.readerFont === 'inherit' ? 'inherit' : FONT_STACKS[cfg.readerFont];
  vars['--ui-font-size'] = `${cfg.fontScale}%`;
  vars['--ui-letter'] = LETTER_SPACING_EM[cfg.letterSpacing];
  vars['--ui-radius'] = String(round(RADIUS_SCALE[cfg.radius]));
  vars['--reader-lh'] = LINE_HEIGHT_VALUE[cfg.readerLineHeight];
  vars['--reader-width'] = READER_WIDTH_VALUE[cfg.readerWidth];

  const attrs: Record<string, string> = {
    'data-scheme': scheme,
    'data-tone': tone,
    'data-pattern': cfg.pattern,
    'data-motion': cfg.motion,
  };

  return {
    scheme,
    tone,
    vars,
    attrs,
    palette: {
      bg: tk.bg,
      surface: tk.surface,
      fg: tk.fg,
      muted: tk.muted,
      border: tk.border,
      accent: accent.fill,
      accentHover: accent.hover,
      accentFg: accent.fg,
      accentInk: accent.ink,
      accentSoft: accent.soft,
      isDark: tone === 'dark',
    },
  };
}

/** Rapporto di contrasto tra testo e schede (per avvisare l'utente se ha scelto colori poco leggibili). */
export function textContrast(palette: Pick<Palette, 'fg' | 'surface' | 'bg'>): number {
  return Math.min(contrast(palette.fg, palette.surface), contrast(palette.fg, palette.bg));
}

export function buildBootSnapshot(cfg: ThemeConfig): BootSnapshot {
  const light = computeTheme(cfg, 'light');
  const dark = computeTheme(cfg, 'dark');
  return {
    v: 1,
    mode: cfg.mode,
    from: cfg.darkFrom,
    to: cfg.darkTo,
    light: { vars: light.vars, attrs: light.attrs, themeColor: light.palette.surface, manifest: manifestUrlForBackground(light.palette.bg) },
    dark: { vars: dark.vars, attrs: dark.attrs, themeColor: dark.palette.surface, manifest: manifestUrlForBackground(dark.palette.bg) },
  };
}

/**
 * Applica il risultato su <html>. Rimuove le variabili personalizzate rimaste da un tema precedente
 * (comprese quelle impostate dallo script di avvio), così il passaggio chiaro ↔ scuro non lascia residui.
 */
export function applyThemeToDocument(result: Pick<ThemeResult, 'vars' | 'attrs' | 'palette'>): void {
  const root = document.documentElement;
  const style = root.style;
  for (let i = style.length - 1; i >= 0; i--) {
    const name = style.item(i);
    if (name.startsWith('--') && !(name in result.vars)) style.removeProperty(name);
  }
  for (const [k, v] of Object.entries(result.vars)) style.setProperty(k, v);
  for (const [k, v] of Object.entries(result.attrs)) root.setAttribute(k, v);
  applyThemeColorMeta(result.palette.surface);
  applyManifestLink(manifestUrlForBackground(result.palette.bg));
}

/**
 * Collega a <link rel="manifest"> il manifest del tema in uso: il browser lo rilegge quando l'app viene installata o aggiornata, e da lì
 * Android prende il colore della barra di navigazione (nessuna API web la cambia a runtime). Stessa logica in public/theme-init.js (che
 * gira prima del primo render): se cambi una, cambia l'altra.
 */
export function applyManifestLink(url: string): void {
  const link = document.head.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (link && link.getAttribute('href') !== url) link.setAttribute('href', url);
}

/**
 * Colore della barra di stato (PWA installata, barra del browser sul telefono, barra del titolo sul desktop).
 * L'HTML parte con DUE meta theme-color scelte dal tema del dispositivo (solo per il primo disegno): qui diventano UNA sola, senza
 * media query. Con la media query il browser userebbe sempre il valore del tema del DISPOSITIVO, ignorando quello scelto nell'app.
 * Stessa logica in public/theme-init.js (che gira prima del primo render): se cambi una, cambia l'altra.
 */
export function applyThemeColorMeta(color: string): void {
  const metas = document.head.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  let meta = metas[0];
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  for (let i = 1; i < metas.length; i++) metas[i].remove();
  meta.removeAttribute('media');
  if (meta.getAttribute('content') !== color) meta.setAttribute('content', color);
}

