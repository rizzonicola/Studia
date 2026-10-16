import { t, tp } from '../i18n/core';
/**
 * Formati file supportati nativamente da Gemini.
 * Unica fonte di verità per l'attributo `accept` degli input e per i controlli lato codice.
 */

export const DOCUMENT_EXTENSIONS = [
  'pdf', 'txt', 'html', 'md', 'csv', 'rtf', 'py', 'js', 'ts', 'cpp', 'c', 'java', 'css', 'json', 'xml', 'sh', 'php', 'go',
] as const;
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic'] as const;
export const AUDIO_EXTENSIONS = ['wav', 'mp3', 'aac', 'flac', 'ogg', 'aiff', 'opus'] as const;
export const VIDEO_EXTENSIONS = ['mp4', 'mpeg', 'mov', 'avi', 'webm', '3gp', 'flv', 'wmv'] as const;

const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic'];

const toAccept = (exts: readonly string[]) => exts.map((e) => `.${e}`).join(',');

/** Attributo `accept` per la pagina di upload (documenti, immagini, audio, video). */
export const UPLOAD_ACCEPT = [
  toAccept(DOCUMENT_EXTENSIONS),
  toAccept(IMAGE_EXTENSIONS),
  toAccept(AUDIO_EXTENSIONS),
  toAccept(VIDEO_EXTENSIONS),
  'application/pdf,text/*,application/json,application/rtf',
  IMAGE_MIMES.join(','),
  'audio/*',
  'video/*',
].join(',');

/** Attributo `accept` per la fotocamera / galleria (solo immagini supportate). */
export const IMAGE_ACCEPT = [toAccept(IMAGE_EXTENSIONS), IMAGE_MIMES.join(',')].join(',');

/** Elenco leggibile per i messaggi all'utente (i nomi dei formati sono internazionali; solo le categorie sono tradotte). */
export const supportedFormatsText = (): string =>
  `PDF, TXT, HTML, MD, CSV, RTF, ${t('files.docs')} (PY, JS, TS, CPP, C, JAVA, CSS, JSON, XML, SH, PHP, GO), ` +
  `${t('files.images')} (PNG, JPG, WEBP, GIF, HEIC), ${t('files.audio')} (WAV, MP3, AAC, FLAC, OGG, AIFF, OPUS) ${t('files.and')} ` +
  `${t('files.video')} (MP4, MPEG, MOV, AVI, WEBM, 3GP, FLV, WMV)`;

export const imageFormatsText = (): string => t('files.imageFormats');

const extOf = (name: string): string => {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
};

const inList = (list: readonly string[], ext: string) => list.includes(ext);

/** Vero se il file è in uno dei formati supportati (controllo su estensione e MIME type). */
export function isSupportedFile(file: File): boolean {
  const ext = extOf(file.name);
  const mime = (file.type || '').split(';')[0].trim().toLowerCase();

  if (
    inList(DOCUMENT_EXTENSIONS, ext) ||
    inList(IMAGE_EXTENSIONS, ext) ||
    inList(AUDIO_EXTENSIONS, ext) ||
    inList(VIDEO_EXTENSIONS, ext)
  ) {
    return true;
  }

  // Nessuna estensione riconosciuta (es. registrazioni dal browser): decide il MIME type
  if (!mime) return false;
  if (IMAGE_MIMES.includes(mime)) return true;
  return (
    mime === 'application/pdf' ||
    mime === 'application/json' ||
    mime === 'application/rtf' ||
    mime.startsWith('text/') ||
    mime.startsWith('audio/') ||
    mime.startsWith('video/')
  );
}

/** Vero se il file è un'immagine in un formato supportato. */
export function isSupportedImage(file: File): boolean {
  const ext = extOf(file.name);
  const mime = (file.type || '').split(';')[0].trim().toLowerCase();
  return IMAGE_MIMES.includes(mime) || (!mime && inList(IMAGE_EXTENSIONS, ext)) || (!!mime && mime === 'image/heif' && ext === 'heic');
}

/** Divide i file in accettati e rifiutati e prepara un messaggio d'errore chiaro. */
export function filterSupportedFiles(files: File[]): { accepted: File[]; error: string | null } {
  const accepted: File[] = [];
  const rejected: File[] = [];
  files.forEach((f) => (isSupportedFile(f) ? accepted : rejected).push(f));

  if (rejected.length === 0) return { accepted, error: null };

  const rest = rejected.length - 3;
  const names = rejected.slice(0, 3).map((f) => `"${f.name}"`).join(', ') + (rest > 0 ? ` ${tp('files.othersMore', rest)}` : '');
  const error = tp('files.unsupported', rejected.length, { names, formats: supportedFormatsText() });
  return { accepted, error };
}
