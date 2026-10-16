// Ingresso della pagina di prova per idb-check.mjs: espone il livello dati reale (services/notesDb.ts) e alcuni strumenti
// "crudi" (IndexedDB nativo, senza il livello dati) per preparare scenari difficili (record corrotti, altro schema, ecc.).
import * as notesDb from '../../services/notesDb';
import { STORAGE_KEYS } from '../../config/appConfig';

const rawOpen = (version?: number): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = version === undefined ? indexedDB.open(notesDb.DB_NAME) : indexedDB.open(notesDb.DB_NAME, version);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('notes')) db.createObjectStore('notes', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('folders')) db.createObjectStore('folders', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('open bloccato'));
  });

const done = (tx: IDBTransaction) => new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });

const raw = {
  /** Scrive record GREZZI (anche malformati) bypassando il livello dati. */
  async put(store: 'notes' | 'folders', records: unknown[]): Promise<void> {
    const db = await rawOpen();
    const tx = db.transaction(store, 'readwrite');
    records.forEach((r) => tx.objectStore(store).put(r));
    await done(tx);
    db.close();
  },
  async getAll(store: 'notes' | 'folders'): Promise<any[]> {
    const db = await rawOpen();
    const out = await new Promise<any[]>((res, rej) => { const r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    db.close();
    return out;
  },
  async clear(): Promise<void> {
    const db = await rawOpen();
    const tx = db.transaction(['notes', 'folders'], 'readwrite');
    tx.objectStore('notes').clear(); tx.objectStore('folders').clear();
    await done(tx);
    db.close();
  },
  /** Prova a portare lo schema alla versione 2 come farebbe una scheda con una versione NUOVA dell'app. Restituisce quanti ms ha atteso. */
  async upgradeToV2(timeoutMs: number): Promise<{ ok: boolean; ms: number }> {
    const t0 = performance.now();
    return new Promise((resolve) => {
      const req = indexedDB.open(notesDb.DB_NAME, 2);
      const timer = setTimeout(() => resolve({ ok: false, ms: performance.now() - t0 }), timeoutMs);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('meta')) req.result.createObjectStore('meta'); };
      req.onsuccess = () => { clearTimeout(timer); req.result.close(); resolve({ ok: true, ms: performance.now() - t0 }); };
      req.onerror = () => { clearTimeout(timer); resolve({ ok: false, ms: performance.now() - t0 }); };
    });
  },
  async deleteDb(): Promise<void> {
    await notesDb.closeDB();
    await new Promise<void>((res, rej) => { const r = indexedDB.deleteDatabase(notesDb.DB_NAME); r.onsuccess = () => res(); r.onerror = () => rej(r.error); r.onblocked = () => res(); });
  },
};

Object.assign(window, { __notesDb: notesDb, __KEYS: STORAGE_KEYS, __raw: raw });
