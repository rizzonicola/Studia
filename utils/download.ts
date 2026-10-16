/**
 * Nome di file sicuro su ogni sistema operativo.
 *  - Lettere e cifre di qualsiasi alfabeto restano (prima \w ASCII trasformava "Città" in "Citt_" e un titolo cinese in soli "_");
 *  - il resto, tranne spazio, punto, trattino e underscore, diventa "_"; gli spazi diventano "_" (come prima);
 *  - niente punti iniziali o finali: ".." non può trasformarsi in un percorso dentro uno ZIP e Windows ignora i punti finali;
 *  - lunghezza limitata (i file system arrivano a 255 byte) e nomi riservati di Windows (CON, NUL, COM1...) evitati;
 *  - se non resta nessuna lettera o cifra (titolo vuoto, solo emoji...) si usa `fallback`.
 */
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export const sanitizeFilename = (name: string, fallback = 'note', maxLength = 100): string => {
  let out = name
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\p{M}\s._-]/gu, '_')
    .replace(/\s+/g, '_')
    .replace(/^\.+|\.+$/g, '');
  if (!/[\p{L}\p{N}]/u.test(out)) return fallback;
  // Il taglio avviene per caratteri interi (code point), non per unità UTF-16: nessuna coppia surrogata spezzata
  const chars = Array.from(out);
  if (chars.length > maxLength) out = chars.slice(0, maxLength).join('').replace(/\.+$/g, '');
  return WINDOWS_RESERVED.test(out) ? `_${out}` : out;
};

/** Scarica un Blob come file. L'object URL viene liberato dopo un po': alcuni browser mobili leggono il blob in modo asincrono. */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
};

/** Scarica un contenuto testuale come file. */
export const downloadFile = (content: string, filename: string, mimeType: string): void => {
  downloadBlob(new Blob([content], { type: mimeType }), filename);
};
