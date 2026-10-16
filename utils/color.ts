/**
 * Utilità di calcolo dei colori, senza dipendenze esterne.
 * Tutti i colori sono stringhe esadecimali a 6 cifre ("#rrggbb", minuscole).
 * Usate dal motore dei temi (utils/themeEngine.ts) per derivare tutta la scala di grigi, i toni pastello
 * e i colori dell'accento a partire da pochi colori di base, garantendo un contrasto leggibile (WCAG).
 */

const HEX6 = /^#[0-9a-f]{6}$/i;
const HEX3 = /^#[0-9a-f]{3}$/i;

export type RGB = readonly [number, number, number];

export const isHex = (v: unknown): v is string => typeof v === 'string' && HEX6.test(v);

/** Accetta "#rgb", "#rrggbb" (con o senza #) e restituisce "#rrggbb" minuscolo; altrimenti null. */
export function normalizeHex(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  let v = input.trim();
  if (!v.startsWith('#')) v = `#${v}`;
  if (HEX3.test(v)) v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return HEX6.test(v) ? v.toLowerCase() : null;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function hexToRgb(hex: string): RGB {
  const v = isHex(hex) ? hex : '#000000';
  return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)];
}

export function rgbToHex([r, g, b]: RGB): string {
  const h = (n: number) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Interpolazione lineare in sRGB: t = 0 → a, t = 1 → b. */
export function mix(a: string, b: string, t: number): string {
  const k = clamp(t, 0, 1);
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex([ar + (br - ar) * k, ag + (bg - ag) * k, ab + (bb - ab) * k]);
}

/** Luminanza relativa WCAG (0 = nero, 1 = bianco). */
export function luminance(hex: string): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Rapporto di contrasto WCAG (da 1 a 21). */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Sceglie tra testo chiaro e scuro quello più leggibile su `bg`. */
export function readableOn(bg: string, light = '#ffffff', dark = '#04070d'): string {
  return contrast(bg, light) >= contrast(bg, dark) ? light : dark;
}

/**
 * Avvicina `color` a `toward` a piccoli passi finché il contrasto con TUTTI i colori di `against` raggiunge `min`.
 * Se non ci riesce restituisce il colore più vicino possibile a `toward`.
 */
export function ensureContrast(color: string, against: string | readonly string[], min: number, toward: string): string {
  const list = typeof against === 'string' ? [against] : against;
  const ok = (c: string) => list.every((bg) => contrast(c, bg) >= min);
  if (ok(color)) return color;
  for (let i = 1; i <= 25; i++) {
    const c = mix(color, toward, i / 25);
    if (ok(c)) return c;
  }
  return toward;
}

/** Colore "negativo" (255 − canale). */
export function invertHex(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex([255 - r, 255 - g, 255 - b]);
}

/** true se il colore è scuro (il testo bianco vi risulterebbe più leggibile di quello nero). */
export function isDarkColor(hex: string): boolean {
  return contrast(hex, '#ffffff') > contrast(hex, '#000000');
}
