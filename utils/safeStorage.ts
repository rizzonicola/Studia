import { classifyStorageError, reportStorageProblem } from './storageStatus';

type StorageArea = 'local' | 'session';

/** Il Storage del browser (localStorage / sessionStorage); può lanciare già al solo accesso (modalità privata, cookie bloccati). */
const area = (which: StorageArea): Storage => (which === 'local' ? window.localStorage : window.sessionStorage);

/** Storage "sicuro": non lancia eccezioni; gli errori di scrittura vengono segnalati (vedi utils/storageStatus.ts). */
const makeSafeStorage = (which: StorageArea) => ({
  get(key: string): string | null {
    try {
      return area(which).getItem(key);
    } catch {
      return null;
    }
  },
  /**
   * Scrive solo se il valore è davvero cambiato: niente scritture sincrone inutili (il tema, per esempio, viene riscritto a ogni
   * avvio) e niente eventi "storage" superflui nelle altre schede. Restituisce false (e segnala il problema) se non riesce.
   */
  set(key: string, value: string): boolean {
    try {
      const storage = area(which);
      if (storage.getItem(key) === value) return true;
      storage.setItem(key, value);
      return true;
    } catch (error) {
      reportStorageProblem({ area: which, reason: classifyStorageError(error) });
      return false;
    }
  },
  remove(key: string): void {
    try {
      area(which).removeItem(key);
    } catch {
      /* noop */
    }
  },
});

/** localStorage "sicuro": non lancia eccezioni (modalità privata, quota piena, storage disabilitato). */
export const safeStorage = makeSafeStorage('local');
/** sessionStorage "sicuro": dura quanto la scheda (usato per la chiave API quando l'utente sceglie di non ricordarla). */
export const safeSession = makeSafeStorage('session');
