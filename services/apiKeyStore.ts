import { STORAGE_KEYS } from '../config/appConfig';

/**
 * Dove si conserva la chiave API Gemini (BYOK). Di predefinito resta in localStorage (come sempre); l'utente può scegliere
 * di NON ricordarla su questo dispositivo: in quel caso vive solo in sessionStorage (scompare alla chiusura della scheda) e
 * non resta nulla su disco. Utile su computer condivisi (scuola, biblioteca).
 *
 * Logica pura con "storage" iniettabili (testabile senza browser). Nessuna funzione qui scrive la chiave in log o messaggi.
 */

export interface SimpleStorage {
  get(key: string): string | null;
  set(key: string, value: string): boolean;
  remove(key: string): void;
}
export interface KeyStores {
  local: SimpleStorage;
  session: SimpleStorage;
}
export interface StoredKey {
  key: string | null;
  /** true = la chiave si ricorda su questo dispositivo (localStorage); false = solo per la sessione (sessionStorage). */
  remember: boolean;
}

const SESSION_ONLY = '1';

/** La preferenza dell'utente (di predefinito si ricorda). */
export const readRemember = (local: SimpleStorage): boolean => local.get(STORAGE_KEYS.apiKeySessionOnly) !== SESSION_ONLY;

/** Legge la chiave dal posto scelto dall'utente. */
export function readApiKey({ local, session }: KeyStores): StoredKey {
  const remember = readRemember(local);
  if (remember) return { key: local.get(STORAGE_KEYS.apiKey) || null, remember };

  // Modalità "solo sessione": se la chiave è rimasta anche in localStorage (es. scritta da una scheda con una versione vecchia
  // dell'app) la si sposta: la scelta dell'utente è non lasciarla sul dispositivo.
  const leftover = local.get(STORAGE_KEYS.apiKey);
  if (leftover) {
    if (!session.get(STORAGE_KEYS.apiKey)) session.set(STORAGE_KEYS.apiKey, leftover);
    local.remove(STORAGE_KEYS.apiKey);
  }
  return { key: session.get(STORAGE_KEYS.apiKey) || null, remember };
}

/**
 * Salva la chiave nel posto scelto. Restituisce false se la scrittura nel posto scelto non è riuscita (la chiave resta valida
 * solo in memoria finché la scheda è aperta). La copia nell'altro posto viene tolta solo se la nuova scrittura è andata a buon fine
 * (in modalità "ricorda"), così un errore di spazio non fa perdere la chiave.
 */
export function saveApiKey({ local, session }: KeyStores, key: string, remember: boolean): boolean {
  const clean = key.trim();
  if (remember) {
    local.remove(STORAGE_KEYS.apiKeySessionOnly);
    const ok = local.set(STORAGE_KEYS.apiKey, clean);
    if (ok) session.remove(STORAGE_KEYS.apiKey);
    return ok;
  }
  local.set(STORAGE_KEYS.apiKeySessionOnly, SESSION_ONLY);
  local.remove(STORAGE_KEYS.apiKey); // chi non vuole la chiave sul dispositivo non la trova lì nemmeno se sessionStorage non è disponibile
  return session.set(STORAGE_KEYS.apiKey, clean);
}

/** Elimina la chiave da entrambi i posti (la preferenza ricorda/non ricordare resta). */
export function removeApiKey({ local, session }: KeyStores): void {
  local.remove(STORAGE_KEYS.apiKey);
  session.remove(STORAGE_KEYS.apiKey);
}

/** Cambia dove si conserva la chiave senza doverla reinserire. Senza chiave si registra solo la preferenza. */
export function moveApiKey(stores: KeyStores, key: string | null, remember: boolean): boolean {
  if (key) return saveApiKey(stores, key, remember);
  if (remember) stores.local.remove(STORAGE_KEYS.apiKeySessionOnly);
  else stores.local.set(STORAGE_KEYS.apiKeySessionOnly, SESSION_ONLY);
  return true;
}
