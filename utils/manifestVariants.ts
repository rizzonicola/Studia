import { DARK_PRESETS, DEFAULT_PRESET, LIGHT_PRESETS, findPreset } from '../config/themes';

/**
 * Manifest per tema: la barra di navigazione di Android (la striscia con la maniglia dei gesti) la colora il BROWSER, con il theme_color
 * del manifest letto quando installa l'app o controlla se aggiornarla. Nessuna API web la cambia mentre l'app è aperta.
 * Per farla somigliare al tema in uso esiste un manifest per ogni colore di sfondo delle palette predefinite
 * (public/manifests/<colore>.json, creati da tools/generate-manifests.mjs) e il sito collega a <link rel="manifest"> quello più vicino
 * allo sfondo del tema. Vedi docs/PWA.md.
 *
 * File puro (niente DOM, niente variabili di Vite): lo importano anche gli strumenti Node.
 */

/** Sfondo del tema chiaro predefinito («Classico»): il suo manifest è quello di base, /manifest.json. */
export const DEFAULT_MANIFEST_BG: string = findPreset('light', DEFAULT_PRESET.light).tokens.bg.toLowerCase();
export const DEFAULT_MANIFEST_URL = '/manifest.json';

/** Colori di sfondo distinti delle palette predefinite (AMOLED e «Alto contrasto» scuro condividono il nero: un solo manifest). */
export const manifestBackgrounds = (): string[] => [...new Set([...LIGHT_PRESETS, ...DARK_PRESETS].map((p) => p.tokens.bg.toLowerCase()))];

/** Percorso del manifest per un colore di sfondo che ha il suo file (#20232a → /manifests/20232a.json). */
export const manifestUrlFor = (bg: string): string => (bg.toLowerCase() === DEFAULT_MANIFEST_BG ? DEFAULT_MANIFEST_URL : `/manifests/${bg.slice(1).toLowerCase()}.json`);

const toRgb = (color: string): [number, number, number] | null => {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return null;
  const hex = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
};

/**
 * Manifest da collegare per uno sfondo qualsiasi (anche personalizzato dall'utente): quello della palette predefinita con lo sfondo più
 * vicino (distanza tra colori RGB). Con un colore illeggibile si usa il manifest di base.
 */
export function manifestUrlForBackground(bg: string): string {
  const rgb = toRgb(bg);
  if (!rgb) return DEFAULT_MANIFEST_URL;
  let best = DEFAULT_MANIFEST_BG;
  let bestDistance = Infinity;
  for (const candidate of manifestBackgrounds()) {
    const c = toRgb(candidate);
    if (!c) continue;
    const distance = (c[0] - rgb[0]) ** 2 + (c[1] - rgb[1]) ** 2 + (c[2] - rgb[2]) ** 2;
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return manifestUrlFor(best);
}
