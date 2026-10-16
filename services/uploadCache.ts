/**
 * Cache (solo in memoria) dei file già caricati sulla File API di Google.
 *
 * Perché: se la generazione fallisce (rate limit, server sovraccarico, ecc.) e l'utente riprova, il caricamento
 * dei file NON viene rifatto: si riusa il riferimento già valido. Meno richieste (e meno banda) = meno rischio di 429.
 *
 * Sicurezza / privacy:
 *  - i riferimenti vivono solo in memoria: ricaricando la pagina spariscono insieme agli oggetti File;
 *  - una voce è valida solo con la stessa chiave API con cui è stata creata e solo se mancano > SAFETY_MARGIN_MS alla
 *    scadenza indicata da Google (48 ore); prima del riuso, gemini.ts verifica comunque lo stato con files.get;
 *  - i file remoti vengono cancellati: a generazione riuscita, quando l'utente rimuove il file dalla lista o svuota la lista,
 *    dopo IDLE_CLEANUP_MS senza utilizzi e (best effort) alla chiusura della scheda.
 *  Questo modulo NON importa l'SDK: la cancellazione usa una semplice chiamata REST, quindi resta leggero.
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
/** Non riuso file che scadono tra meno di 15 minuti: la generazione potrebbe non finire in tempo. */
const SAFETY_MARGIN_MS = 15 * 60 * 1000;
/** Una richiesta di cancellazione che non risponde entro questo tempo viene abbandonata (il file scade comunque da solo). */
const DELETE_TIMEOUT_MS = 10_000;
/** Se l'utente non ritenta entro questo tempo, i file rimasti su Google vengono cancellati. */
const IDLE_CLEANUP_MS = 30 * 60 * 1000;
/** Scadenza predefinita della File API quando la risposta non la riporta (48 h, con margine). */
const DEFAULT_TTL_MS = 47 * 60 * 60 * 1000;

export interface CachedUpload {
  /** Nome risorsa, es. "files/abc123" */
  name: string;
  uri: string;
  mimeType: string;
  expiresAt: number;
  apiKey: string;
}

const entries = new Map<string, CachedUpload>();
let idleTimer: ReturnType<typeof setTimeout> | undefined;

/** Identifica "lo stesso file" senza leggerne il contenuto. */
const fingerprint = (file: File): string => `${file.name}|${file.size}|${file.lastModified}`;

/** Converte la scadenza restituita da Google (ISO) in timestamp. */
export function parseExpiry(expirationTime: unknown): number {
  const ts = typeof expirationTime === 'string' ? Date.parse(expirationTime) : NaN;
  return Number.isFinite(ts) ? ts : Date.now() + DEFAULT_TTL_MS;
}

/** Cancella un file remoto. Non lancia mai: è un'operazione di pulizia "best effort". */
async function deleteRemote(entry: CachedUpload, keepalive = false): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DELETE_TIMEOUT_MS);
  try {
    await fetch(`${API_BASE}/${entry.name}`, {
      method: 'DELETE',
      headers: { 'x-goog-api-key': entry.apiKey.trim() },
      keepalive,
      signal: controller.signal,
    });
  } catch {
    /* il file scade comunque da solo dopo 48 ore */
  } finally {
    clearTimeout(timer);
  }
}

function armIdleCleanup(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = undefined;
  if (entries.size === 0) return;
  idleTimer = setTimeout(() => void releaseAll(), IDLE_CLEANUP_MS);
}

/** L'utente sta ancora usando questi file: riparte il conto dei 30 minuti di inattività. */
export const touchUploads = (): void => armIdleCleanup();

export function getCachedUpload(apiKey: string, file: File): CachedUpload | null {
  const entry = entries.get(fingerprint(file));
  if (!entry || entry.apiKey !== apiKey) return null;
  if (entry.expiresAt - Date.now() < SAFETY_MARGIN_MS) {
    entries.delete(fingerprint(file));
    return null;
  }
  return entry;
}

export function setCachedUpload(apiKey: string, file: File, upload: Omit<CachedUpload, 'apiKey'>): void {
  entries.set(fingerprint(file), { ...upload, apiKey });
  armIdleCleanup();
}

/** Vero se almeno uno dei file ha già un caricamento valido (per avvisare l'utente che il ritentativo sarà più rapido). */
export const hasCachedUploads = (apiKey: string, files: File[]): boolean =>
  files.some((f) => getCachedUpload(apiKey, f) !== null);

/** Dimentica (e cancella da Google) il caricamento di questi file. */
export async function releaseUploads(apiKey: string, files: File[]): Promise<void> {
  const removed: CachedUpload[] = [];
  for (const file of files) {
    const key = fingerprint(file);
    const entry = entries.get(key);
    if (entry && entry.apiKey === apiKey) {
      entries.delete(key);
      removed.push(entry);
    }
  }
  armIdleCleanup();
  await Promise.allSettled(removed.map((e) => deleteRemote(e)));
}

/** Rimuove la voce senza cancellare il file remoto (usato quando il file remoto risulta già scaduto/inesistente). */
export function forgetUpload(file: File): void {
  entries.delete(fingerprint(file));
  armIdleCleanup();
}

/**
 * Mantiene solo i caricamenti dei file ancora presenti nella lista (e della chiave in uso):
 * un file tolto dalla lista, o una chiave cambiata (o rimossa: `null`), comporta la cancellazione su Google.
 */
export async function pruneUploads(apiKey: string | null, keep: File[]): Promise<void> {
  if (entries.size === 0) return;
  const keepKeys = new Set(keep.map(fingerprint));
  const removed: CachedUpload[] = [];
  for (const [key, entry] of entries) {
    if (entry.apiKey !== apiKey || !keepKeys.has(key)) {
      entries.delete(key);
      removed.push(entry);
    }
  }
  armIdleCleanup();
  await Promise.allSettled(removed.map((e) => deleteRemote(e)));
}

/** Cancella tutto ciò che è rimasto su Google. */
export async function releaseAll(keepalive = false): Promise<void> {
  const all = [...entries.values()];
  entries.clear();
  armIdleCleanup();
  await Promise.allSettled(all.map((e) => deleteRemote(e, keepalive)));
}

// Chiusura della scheda: cancellazione best effort (keepalive permette alla richiesta di completarsi).
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => void releaseAll(true));
}
