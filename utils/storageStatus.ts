/**
 * Problemi di salvataggio nel browser (spazio esaurito, archiviazione disattivata, scrittura fallita), come eventi.
 * I moduli che scrivono (safeStorage, services/notesDb) li segnalano senza conoscere la UI; un solo ascoltatore in App li mostra.
 * Se non c'è ancora nessun ascoltatore (es. un errore durante l'avvio) i primi eventi restano in coda e vengono consegnati dopo.
 */

export type StorageProblemReason = 'quota' | 'unavailable' | 'write';

export interface StorageProblem {
  area: 'local' | 'session' | 'indexeddb';
  reason: StorageProblemReason;
}

type Listener = (problem: StorageProblem) => void;

const listeners = new Set<Listener>();
const queue: StorageProblem[] = [];
const MAX_QUEUED = 5;

export function reportStorageProblem(problem: StorageProblem): void {
  if (listeners.size === 0) {
    if (queue.length < MAX_QUEUED) queue.push(problem);
    return;
  }
  listeners.forEach((listener) => listener(problem));
}

/** Si registra come ascoltatore e riceve subito i problemi accaduti prima. Restituisce la funzione per annullare l'iscrizione. */
export function onStorageProblem(listener: Listener): () => void {
  listeners.add(listener);
  queue.splice(0).forEach(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Distingue lo spazio esaurito (si risolve liberando spazio) dall'archiviazione non disponibile (modalità privata, disattivata) e dal resto. */
export function classifyStorageError(error: unknown): StorageProblemReason {
  const name = typeof error === 'object' && error !== null ? String((error as { name?: unknown }).name ?? '') : '';
  const code = typeof error === 'object' && error !== null ? Number((error as { code?: unknown }).code) : NaN;
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014) return 'quota';
  if (name === 'SecurityError' || name === 'NotAllowedError' || name === 'InvalidStateError' || name === 'UnknownError') return 'unavailable';
  return 'write';
}
