/**
 * Font KaTeX in formati datati. katex.min.css dichiara per ogni font tre sorgenti (woff2, woff, ttf): ogni browser attuale usa la
 * prima (woff2) e non scarica mai le altre, ma la build le copia comunque in `dist` (decine di file, centinaia di KiB di deploy
 * che nessuno richiede). Qui si tolgono dal CSS le sorgenti woff/ttf dei font KaTeX e si eliminano dal bundle i file che nessun CSS
 * nomina più. Se per qualunque motivo una sorgente non si riesce a togliere dal CSS, il file resta: non può mai mancare un file citato.
 * Funzioni pure, senza dipendenze (usate da vite.config.ts e provate in tests/logic.test.ts).
 */

const QUOTE = `["']?`;
// , url(.../KaTeX_xxx.woff)  format("woff")   |   , url(data:font/woff;base64,...) format("woff")   (ttf: format("truetype"))
const LEGACY_SOURCE = new RegExp(
  `,\\s*url\\(\\s*${QUOTE}(?:[^)"']*\\.(?:woff|ttf)(?:\\?[^)"']*)?|data:(?:font|application)/(?:x-font-)?(?:woff|ttf|truetype|sfnt)[;,][^)"']*)${QUOTE}\\s*\\)\\s*format\\(\\s*${QUOTE}(?:woff|truetype)${QUOTE}\\s*\\)`,
  'g'
);

/** Toglie dal CSS le sorgenti woff/ttf che seguono la sorgente woff2 (mai l'unica sorgente di un font). */
export function stripLegacyFontSources(css: string): { css: string; removed: number } {
  let removed = 0;
  const out = css.replace(LEGACY_SOURCE, () => {
    removed++;
    return '';
  });
  return { css: out, removed };
}

/** Font KaTeX .woff o .ttf (non .woff2) tra i file della build. */
export const isLegacyKatexFont = (fileName: string): boolean => /(^|\/)KaTeX_[^/]+\.(?:woff|ttf)$/.test(fileName);

/** Parte dell'output di Rollup che serve qui: file → asset (con `source`) o chunk. */
export interface BundleLike {
  [fileName: string]: { type: string; source?: string | Uint8Array };
}

/** Il CSS nomina questo file? Il nome non deve essere solo l'inizio di un altro ("X.woff" è dentro "X.woff2"). */
const cites = (css: string, fileName: string): boolean =>
  new RegExp(`${fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`).test(css);

/**
 * Per ogni CSS del bundle toglie le sorgenti datate dei font KaTeX; poi elimina dal bundle i file .woff/.ttf KaTeX che nessun CSS
 * nomina più. Restituisce i file eliminati e quelli rimasti perché ancora citati.
 */
export function pruneLegacyKatexFonts(bundle: BundleLike): { deleted: string[]; kept: string[] } {
  const legacy = Object.keys(bundle).filter(isLegacyKatexFont);
  if (legacy.length === 0) return { deleted: [], kept: [] };

  const stillCited = new Set<string>();
  for (const [fileName, item] of Object.entries(bundle)) {
    if (item.type !== 'asset' || !fileName.endsWith('.css') || item.source === undefined) continue;
    const original = typeof item.source === 'string' ? item.source : new TextDecoder().decode(item.source);
    const { css, removed } = stripLegacyFontSources(original);
    if (removed > 0) item.source = css;
    for (const legacyFile of legacy) {
      if (cites(css, legacyFile.slice(legacyFile.lastIndexOf('/') + 1))) stillCited.add(legacyFile);
    }
  }
  const deleted: string[] = [];
  const kept: string[] = [];
  for (const legacyFile of legacy) {
    if (stillCited.has(legacyFile)) {
      kept.push(legacyFile);
    } else {
      delete bundle[legacyFile];
      deleted.push(legacyFile);
    }
  }
  return { deleted, kept };
}
