import { AUTHOR_GITHUB_LABEL, AUTHOR_GITHUB_URL, AUTHOR_NAME, LICENSE_NAME, LICENSE_URL, SITE_URL } from './site';

/**
 * Configurazione centrale dell'app.
 * OWNER_NAME e CONTACT_EMAIL compaiono nei testi legali (Termini di Servizio e Privacy).
 * Autore e licenza del codice (footer, "Informazioni", pagine statiche) vivono in config/site.ts.
 */
export { SITE_URL, AUTHOR_NAME, AUTHOR_GITHUB_URL, AUTHOR_GITHUB_LABEL, LICENSE_NAME, LICENSE_URL };
export const APP_NAME = 'StudIA';
export const APP_VERSION: string = __APP_VERSION__;

/** Titolare e gestore del sito / titolare del trattamento, ed email di riferimento. */
export const OWNER_NAME = 'Nicola Rizzo';
export const CONTACT_EMAIL = 'info@poppi.cc';

/**
 * Incrementa questa versione quando modifichi i testi legali: all'utente verrà richiesta una nuova accettazione.
 * 2026-09-29: testi legali tradotti in inglese e francese, riferimenti al dominio studia.poppi.cc.
 * 2026-10-01: informativa privacy aggiornata (preferenze di aspetto e temi salvati nel browser).
 * 2026-10-01 (rev. 2): indicati titolare e gestore (Nicola Rizzo) ed email di riferimento (info@poppi.cc).
 * 2026-10-02: modello di riserva facoltativo; file caricati su Google conservati dopo un errore per il ritentativo (cancellati a fine elaborazione, alla rimozione, dopo 30 min di inattività o alla chiusura).
 * 2026-10-03: chiave API facoltativamente solo per la sessione (sessionStorage, punti 3.1, 5 e 8); sessionStorage tra gli strumenti tecnici (punto 5);
 *             richiesta al browser di archiviazione persistente (punto 7); il vecchio archivio localStorage "studia_data" viene eliminato dopo la migrazione a IndexedDB.
 * 2026-10-11: modello di riserva ATTIVO di default (Privacy punti 3.1 e 3.2, Termini punto 3): se il principale è sovraccarico o ha esaurito i limiti, gli stessi
 *             contenuti vanno a un secondo modello Gemini con la stessa chiave API; l'utente può disattivarlo da Impostazioni → Modello.
 * 2026-10-14: rimossa ogni menzione della pubblicità (Google Ads) e del consenso ai cookie pubblicitari: Termini (ex punto 8; i punti
 *             successivi sono ora 8-12) e Privacy (punti 2, 3.4, 4 e 5). Se in futuro aggiungerai pubblicità, vanno reintrodotti i testi e uno
 *             strumento di consenso, ed estesa la Content-Security-Policy in public/_headers.
 */
export const LEGAL_VERSION = '2026-10-14';
/** Data di ultimo aggiornamento dei testi legali (ISO). Viene formattata con Intl nella lingua attiva. */
export const LEGAL_LAST_UPDATED_ISO = '2026-10-14';

export const AI_STUDIO_KEYS_URL = 'https://aistudio.google.com/api-keys';

/** Modello Gemini predefinito. L'utente può cambiarlo da Impostazioni → Modello. */
export const DEFAULT_MODEL = 'gemini-3.8-flash';

/**
 * Modello di riserva predefinito (Impostazioni → Modello → Modello di riserva). Di predefinito è ATTIVO (DEFAULT_FALLBACK_ENABLED):
 * se il modello principale è sovraccarico, ha esaurito i limiti o non è disponibile, StudIA riprova con questo, con la stessa chiave API.
 * Deve restare diverso da DEFAULT_MODEL (a nomi uguali la riserva non si attiverebbe mai: lo verifica tests/logic.test.ts).
 * gemini-3.7-flash: versione stabile (GA), con quota anche nel piano gratuito (separata da quella del modello principale).
 */
export const DEFAULT_FALLBACK_MODEL = 'gemini-3.7-flash';

/**
 * La riserva è ATTIVA di default; l'utente la disattiva da Impostazioni → Modello. In localStorage finisce solo la scelta esplicita
 * (services/fallbackPreference.ts). Termini (punto 3) e Privacy (punti 3.1 e 3.2) descrivono la riserva come attiva di default:
 * cambiare questo valore cambia ciò che i testi legali dichiarano, quindi vanno aggiornati insieme a LEGAL_VERSION
 * (tests/logic.test.ts verifica che i testi in italiano, inglese e francese non dichiarino il contrario).
 */
export const DEFAULT_FALLBACK_ENABLED: boolean = true;

/** Caratteri massimi di testo inviati per la generazione di quiz e mappe. */
export const MAX_CONTEXT_CHARS = 30000;

/** Dimensione massima (in byte) dei file JSON importati (quiz/mappe) e dei file di testo importati come appunti. */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/**
 * Lunghezza massima (caratteri) di un prompt personalizzato. I prompt stanno in localStorage, che ha circa 5 MB per sito condivisi con
 * chiave API, tema e impostazioni: un testo enorme incollato per sbaglio li riempirebbe e impedirebbe di salvare tutto il resto.
 * 20.000 caratteri sono ~10 pagine: molto più dei prompt predefiniti (circa 1.500-3.000).
 */
export const MAX_CUSTOM_PROMPT_CHARS = 20_000;

/** Dimensione massima (in byte) di un singolo file caricato su Google per la generazione degli appunti. */
export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

/** Lato massimo (px) delle foto inviate a Gemini e salvate: sopra questa soglia vengono ridimensionate. */
export const MAX_IMAGE_SIDE = 2000;

/** Chiavi localStorage */
export const STORAGE_KEYS = {
  apiKey: 'studia_gemini_api_key',
  /** '1' = l'utente ha scelto di NON ricordare la chiave: resta in sessionStorage (solo questa scheda). Assente = si ricorda (predefinito). */
  apiKeySessionOnly: 'studia_key_session_only',
  model: 'studia_gemini_model',
  /**
   * Modello di riserva: attivazione e nome. Per l'attivazione vale il predefinito (DEFAULT_FALLBACK_ENABLED, attiva) finché l'utente non sceglie:
   * '0' = disattivata dall'utente; '1' = valore scritto dalle versioni precedenti (quando era disattivata di default), oggi equivale a «attiva».
   */
  fallbackEnabled: 'studia_fallback_enabled',
  fallbackModel: 'studia_fallback_model',
  prompts: 'studia_custom_prompts',
  legal: 'studia_legal_acceptance',
  /** Vecchia chiave (solo il nome del colore): letta una volta per la migrazione e poi eliminata. */
  theme: 'studia_theme',
  /** Configurazione completa dell'aspetto (JSON validato da sanitizeThemeConfig). */
  themeConfig: 'studia_theme_config',
  /** Istantanea dei temi chiaro/scuro calcolati: la legge public/theme-init.js prima del primo render. */
  themeBoot: 'studia_theme_boot',
  viewMode: 'studia_view_mode',
  language: 'studia_language',
  contentLanguage: 'studia_content_language',
  /** Vecchio archivio degli appunti (prima di IndexedDB): letto per la migrazione e poi ELIMINATO (services/notesDb.ts). */
  legacyData: 'studia_data',
} as const;
