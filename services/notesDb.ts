import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Folder, Note } from '../types';
import { STORAGE_KEYS } from '../config/appConfig';
import { safeStorage } from '../utils/safeStorage';
import { classifyStorageError, reportStorageProblem } from '../utils/storageStatus';
import { normalizeAll, parseLegacyData, repairTree, type NormalizedData } from './notesData';

export { normalizeAll, normalizeFolder, normalizeNote, parseLegacyData, repairTree } from './notesData';
export type { NormalizedData, TreeRepair } from './notesData';

/**
 * Livello dati degli appunti (IndexedDB), senza React: lo usa hooks/useNotesStore.ts.
 *
 * Schema (invariato rispetto alle versioni precedenti, quindi NESSUNA migrazione di formato):
 *   db "studia_db" v1 → store "notes" (keyPath id → Note) e "folders" (keyPath id → Folder).
 *
 * Cosa fa questo modulo in più rispetto a prima:
 *  - LETTURA TOLLERANTE: ogni record viene validato/normalizzato; un record corrotto o incompleto non fa cadere gli altri e non
 *    manda in errore la UI (prima un `createdAt` mancante rompeva l'ordinamento della griglia, un `parentId` assente rendeva
 *    "invisibile" una cartella). Cartelle e appunti orfani (cartella inesistente, cicli) tornano alla radice invece di sparire.
 *  - MIGRAZIONE dal vecchio localStorage ("studia_data") idempotente: non sovrascrive mai ciò che è già nel DB e, a fine
 *    migrazione, elimina la vecchia chiave (prima restava per sempre e, svuotando il DB, i vecchi appunti risuscitavano).
 *  - SCRITTURE A PATCH: ogni modifica legge il record dal DB e vi applica solo i campi cambiati, nella stessa transazione.
 *    Con due schede aperte, la scheda "vecchia" non può più sovrascrivere con una copia obsoleta le modifiche dell'altra.
 *  - SINCRONIZZAZIONE fra schede con BroadcastChannel (le altre schede rileggono il DB dopo una scrittura).
 *  - ERRORI VISIBILI: spazio esaurito / archiviazione non disponibile vengono segnalati (utils/storageStatus.ts), non solo loggati.
 *  - ARCHIVIAZIONE PERSISTENTE: dopo la prima scrittura riuscita si chiede navigator.storage.persist() (il browser non sfratta il DB).
 */

export const DB_NAME = 'studia_db';
export const DB_VERSION = 1;

export interface StudiaDB extends DBSchema {
  notes: { key: string; value: Note };
  folders: { key: string; value: Folder };
}
export type StudiaDatabase = IDBPDatabase<StudiaDB>;

// ---------------------------------------------------------------------------------------------------------------------
// Connessione al database
// ---------------------------------------------------------------------------------------------------------------------

let dbPromise: Promise<StudiaDatabase> | null = null;

export function getDB(): Promise<StudiaDatabase> {
  if (!dbPromise) {
    const opening: Promise<StudiaDatabase> = openDB<StudiaDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('notes')) db.createObjectStore('notes', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('folders')) db.createObjectStore('folders', { keyPath: 'id' });
      },
      // Un'altra scheda (versione più nuova dell'app) vuole aggiornare lo schema: si chiude la connessione per non bloccarla
      blocking() {
        if (dbPromise === opening) dbPromise = null;
        opening.then((db) => db.close()).catch(() => undefined);
      },
      // Il browser ha chiuso la connessione (es. dati del sito cancellati): alla prossima operazione si riapre
      terminated() {
        if (dbPromise === opening) dbPromise = null;
      },
    });
    dbPromise = opening;
    // Se l'apertura fallisce (es. modalità privata) si può ritentare al prossimo accesso
    opening.catch(() => {
      if (dbPromise === opening) dbPromise = null;
    });
  }
  return dbPromise;
}

/** Chiude la connessione (serve ai test e alla riapertura dopo un cambio di schema). */
export async function closeDB(): Promise<void> {
  const current = dbPromise;
  dbPromise = null;
  if (current) (await current.catch(() => null))?.close();
}

// ---------------------------------------------------------------------------------------------------------------------
// Lettura, migrazione, riparazione
// ---------------------------------------------------------------------------------------------------------------------

export interface Snapshot extends NormalizedData {
  /** Elementi riportati alla radice perché orfani o in un ciclo. */
  repaired: number;
}

/** Scrive nel DB le riparazioni dell'albero rileggendo i dati NELLA STESSA transazione (non si fida di letture precedenti). */
async function applyRepairs(db: StudiaDatabase): Promise<void> {
  const tx = db.transaction(['notes', 'folders'], 'readwrite');
  const notesStore = tx.objectStore('notes');
  const foldersStore = tx.objectStore('folders');
  const [rawNotes, rawFolders] = await Promise.all([notesStore.getAll(), foldersStore.getAll()]);
  const { notes, folders } = normalizeAll(rawNotes, rawFolders);
  const fixed = repairTree(notes, folders);
  const rawNoteById = new Map(rawNotes.map((n) => [n.id, n]));
  const rawFolderById = new Map(rawFolders.map((f) => [f.id, f]));
  const writes: Promise<unknown>[] = [tx.done];
  for (const n of fixed.changedNotes) {
    const raw = rawNoteById.get(n.id);
    if (raw) writes.push(notesStore.put({ ...raw, folderId: null })); // si tocca solo il campo riparato
  }
  for (const f of fixed.changedFolders) {
    const raw = rawFolderById.get(f.id);
    if (raw) writes.push(foldersStore.put({ ...raw, parentId: null }));
  }
  await Promise.all(writes);
}

/** Legge tutto in UNA transazione (istantanea coerente), valida i record e ripara l'albero. */
async function readSnapshot(db: StudiaDatabase): Promise<Snapshot> {
  const tx = db.transaction(['notes', 'folders'], 'readonly');
  const [rawNotes, rawFolders] = await Promise.all([tx.objectStore('notes').getAll(), tx.objectStore('folders').getAll(), tx.done]);
  const normalized = normalizeAll(rawNotes, rawFolders);
  const fixed = repairTree(normalized.notes, normalized.folders);
  const repaired = fixed.changedNotes.length + fixed.changedFolders.length;
  if (repaired > 0) {
    try {
      await applyRepairs(db);
    } catch (error) {
      console.error('IndexedDB: riparazione non riuscita', error); // i dati riparati restano comunque corretti in memoria
    }
  }
  return { notes: fixed.notes, folders: fixed.folders, skipped: normalized.skipped, repaired };
}

/**
 * Porta nel DB i dati del vecchio localStorage ("studia_data") e poi elimina la vecchia chiave.
 *  - IDEMPOTENTE: aggiunge solo ciò che nel DB manca ("put se assente"): il DB è la fonte di verità, un'esecuzione ripetuta
 *    (es. chiusura della scheda a metà) non duplica e non annulla modifiche successive;
 *  - la chiave viene tolta SOLO dopo che la transazione è stata confermata, e solo se il contenuto era leggibile.
 * Restituisce quanti elementi sono stati aggiunti.
 */
async function migrateLegacy(db: StudiaDatabase): Promise<number> {
  const raw = safeStorage.get(STORAGE_KEYS.legacyData);
  if (raw === null) return 0;
  const legacy = parseLegacyData(raw);
  if (!legacy) return 0; // contenuto illeggibile: non si cancella ciò che non si è capito

  const tx = db.transaction(['notes', 'folders'], 'readwrite');
  const notesStore = tx.objectStore('notes');
  const foldersStore = tx.objectStore('folders');
  const [noteIds, folderIds] = await Promise.all([notesStore.getAllKeys(), foldersStore.getAllKeys()]);
  const haveNotes = new Set<string>(noteIds);
  const haveFolders = new Set<string>(folderIds);
  const addNotes = legacy.notes.filter((n) => !haveNotes.has(n.id));
  const addFolders = legacy.folders.filter((f) => !haveFolders.has(f.id));
  await Promise.all([...addNotes.map((n) => notesStore.put(n)), ...addFolders.map((f) => foldersStore.put(f)), tx.done]);

  safeStorage.remove(STORAGE_KEYS.legacyData);
  return addNotes.length + addFolders.length;
}

export interface LoadResult extends Snapshot {
  /** Elementi portati dal vecchio localStorage in questa apertura. */
  migrated: number;
}

/** Caricamento iniziale: migrazione dal vecchio formato (se serve) + lettura validata. Può lanciare se IndexedDB non è disponibile. */
export async function loadAll(): Promise<LoadResult> {
  const db = await getDB();
  let migrated = 0;
  try {
    migrated = await migrateLegacy(db);
  } catch (error) {
    // Il vecchio dato resta dov'è (si riproverà al prossimo avvio) e il resto dell'app parte lo stesso
    console.error('Migration failed', error);
    reportStorageProblem({ area: 'indexeddb', reason: classifyStorageError(error) });
  }
  return { ...(await readSnapshot(db)), migrated };
}

/** Rilettura (dopo una modifica fatta da un'altra scheda). */
export async function readAll(): Promise<Snapshot> {
  return readSnapshot(await getDB());
}

// ---------------------------------------------------------------------------------------------------------------------
// Scritture: coda ordinata, patch nel DB, notifica alle altre schede
// ---------------------------------------------------------------------------------------------------------------------

export type DbJob = (db: StudiaDatabase) => Promise<void>;
export interface PatchEntry<T> {
  id: string;
  patch: Partial<T>;
  /** Copia completa dello stato in memoria: si usa solo se il record non esiste più nel DB (la modifica non va persa). */
  full: T;
}

/**
 * Operazioni di scrittura. Le "patch" leggono il record dal DB e applicano SOLO i campi cambiati, nella stessa transazione:
 * non si sovrascrive mai con una copia obsoleta quanto un'altra scheda ha modificato su altri campi.
 */
export const dbJobs = {
  putNotes(notes: readonly Note[]): DbJob {
    return async (db) => {
      const tx = db.transaction('notes', 'readwrite');
      const store = tx.objectStore('notes');
      await Promise.all([...notes.map((n) => store.put(n)), tx.done]);
    };
  },
  putFolder(folder: Folder): DbJob {
    return async (db) => {
      const tx = db.transaction('folders', 'readwrite');
      await Promise.all([tx.objectStore('folders').put(folder), tx.done]);
    };
  },
  patch(notes: readonly PatchEntry<Note>[], folders: readonly PatchEntry<Folder>[] = []): DbJob {
    return async (db) => {
      const tx = db.transaction(['notes', 'folders'], 'readwrite');
      const notesStore = tx.objectStore('notes');
      const foldersStore = tx.objectStore('folders');
      const writes: Promise<unknown>[] = [tx.done];
      for (const { id, patch, full } of notes) {
        writes.push(notesStore.get(id).then((existing) => notesStore.put(existing ? { ...existing, ...patch, id } : full)));
      }
      for (const { id, patch, full } of folders) {
        writes.push(foldersStore.get(id).then((existing) => foldersStore.put(existing ? { ...existing, ...patch, id } : full)));
      }
      await Promise.all(writes);
    };
  },
  deleteNote(id: string): DbJob {
    return async (db) => {
      const tx = db.transaction('notes', 'readwrite');
      await Promise.all([tx.objectStore('notes').delete(id), tx.done]);
    };
  },
  deleteTree(folderIds: readonly string[], noteIds: readonly string[]): DbJob {
    return async (db) => {
      const tx = db.transaction(['notes', 'folders'], 'readwrite');
      await Promise.all([
        ...folderIds.map((id) => tx.objectStore('folders').delete(id)),
        ...noteIds.map((id) => tx.objectStore('notes').delete(id)),
        tx.done,
      ]);
    };
  },
};

let queue: Promise<void> = Promise.resolve();
let pending = 0;
const idleWaiters: Array<() => void> = [];

/** Quante scritture sono ancora in corso o in coda. */
export const pendingWrites = (): number => pending;
/** Si risolve quando non ci sono più scritture in corso o in coda. */
export const whenWritesSettled = (): Promise<void> => (pending === 0 ? Promise.resolve() : new Promise<void>((resolve) => idleWaiters.push(resolve)));

/**
 * Accoda una scrittura (senza bloccare la UI) mantenendo l'ordine di arrivo. Se fallisce, l'utente viene avvisato
 * (spazio esaurito, archiviazione non disponibile...) invece di scoprire la perdita al prossimo avvio.
 */
export function enqueueWrite(job: DbJob): void {
  pending++;
  queue = queue.then(async () => {
    try {
      await job(await getDB());
      notifyChanged();
      void requestPersistentStorage();
    } catch (error) {
      reportStorageProblem({ area: 'indexeddb', reason: classifyStorageError(error) });
      console.error('IndexedDB: scrittura non riuscita', error); // nessun dato personale nei log
    } finally {
      pending--;
      if (pending === 0) idleWaiters.splice(0).forEach((resolve) => resolve());
    }
  });
}

// --- Sincronizzazione fra schede ------------------------------------------------------------------------------------

const CHANNEL_NAME = 'studia-notes-sync';
let channel: BroadcastChannel | null | undefined;

const getChannel = (): BroadcastChannel | null => {
  if (channel === undefined) {
    try {
      channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL_NAME);
    } catch {
      channel = null;
    }
  }
  return channel;
};

function notifyChanged(): void {
  getChannel()?.postMessage({ type: 'changed' });
}

/** Chiama `handler` quando un'ALTRA scheda ha scritto nel DB. Restituisce la funzione per annullare l'iscrizione. */
export function onRemoteChange(handler: () => void): () => void {
  const ch = getChannel();
  if (!ch) return () => undefined;
  const listener = () => handler();
  ch.addEventListener('message', listener);
  return () => ch.removeEventListener('message', listener);
}

// --- Archiviazione persistente ----------------------------------------------------------------------------------------

let persistenceRequested = false;

/**
 * Chiede al browser di non sfrattare i dati del sito (navigator.storage.persist). Senza, sotto pressione di spazio il browser
 * può cancellare IndexedDB e localStorage senza avvisare. Si chiede una sola volta per sessione, dopo la prima scrittura
 * riuscita (il momento in cui esistono dati da proteggere): su Firefox compare una richiesta di conferma.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (persistenceRequested) return false;
  persistenceRequested = true;
  try {
    const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
    if (!storage || typeof storage.persist !== 'function') return false;
    if (typeof storage.persisted === 'function' && (await storage.persisted())) return true;
    return await storage.persist();
  } catch {
    return false;
  }
}
