import { DEFAULT_FALLBACK_ENABLED, STORAGE_KEYS } from '../config/appConfig';
import type { SimpleStorage } from './apiKeyStore';

/**
 * Attivazione del modello di riserva. Di predefinito è ATTIVA (DEFAULT_FALLBACK_ENABLED); l'utente può disattivarla da
 * Impostazioni → Modello. Come per «Ricorda la chiave» (services/apiKeyStore.ts), in localStorage finisce solo la scelta
 * che si discosta dal predefinito:
 *   - chiave assente → vale il predefinito (attiva);
 *   - '0'            → l'utente l'ha disattivata: nessuna azione dell'app la riaccende, solo l'interruttore;
 *   - '1'            → valore scritto dalle versioni precedenti, quando la riserva era disattivata di default: continua a
 *                      significare «attiva» e al primo salvataggio viene sostituito (rimosso se resta attiva, '0' se l'utente la spegne).
 * Il nome del modello di riserva ha una chiave a parte (STORAGE_KEYS.fallbackModel).
 *
 * Logica pura con "storage" iniettabile (testabile senza browser).
 */

const ON = '1';
const OFF = '0';

/** La scelta dell'utente; senza una scelta salvata (o con un valore non riconosciuto) vale il predefinito. */
export const readFallbackEnabled = (store: Pick<SimpleStorage, 'get'>): boolean => {
  const raw = store.get(STORAGE_KEYS.fallbackEnabled);
  if (raw === OFF) return false;
  if (raw === ON) return true;
  return DEFAULT_FALLBACK_ENABLED;
};

/**
 * Salva la scelta. Tornare al predefinito cancella la chiave (così un futuro cambio del predefinito, con il relativo
 * aggiornamento dei testi legali, arriva a chi non ha personalizzato nulla). Restituisce false se la scrittura non è riuscita.
 */
export const saveFallbackEnabled = (store: SimpleStorage, enabled: boolean): boolean => {
  if (enabled === DEFAULT_FALLBACK_ENABLED) {
    store.remove(STORAGE_KEYS.fallbackEnabled);
    return true;
  }
  return store.set(STORAGE_KEYS.fallbackEnabled, enabled ? ON : OFF);
};
