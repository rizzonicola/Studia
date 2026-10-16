import { t } from '../i18n/core';
import { CancelledError, RateLimitError, RequestTimeoutError, classifyError, normalizeError, type FailureKind } from './errors';

/**
 * Protezione dal rate limit di Google (piano gratuito incluso). Tre livelli:
 *  1. DISTANZIAMENTO: le richieste partono una alla volta con almeno MIN_GAP_MS tra una e l'altra
 *     (anche fra quiz, mappe e upload lanciati insieme, perché lo stato è condiviso nel modulo);
 *  2. RETRY INTELLIGENTE: su 429 si attende il tempo indicato da Google (retryDelay) + jitter,
 *     con un countdown visibile all'utente; gli errori temporanei 5xx/rete usano un backoff esponenziale;
 *  3. COOLDOWN PER MODELLO: dopo un 429 nessuna richiesta allo STESSO modello parte prima della fine dell'attesa
 *     (la quota di Google è per modello: un secondo task, o un nuovo clic, non peggiora la situazione e un modello
 *     di riserva resta utilizzabile).
 * La quota giornaliera esaurita NON viene ritentata: l'utente riceve subito un messaggio chiaro.
 *
 * Ogni tentativo ha inoltre un annullamento "duro" (anche se la funzione chiamata ignora il segnale, la promise si chiude subito
 * quando l'utente annulla) e, se richiesto, un tempo massimo: una connessione appesa non lascia più la UI in attesa all'infinito.
 */

/** Pausa minima tra l'inizio di due richieste consecutive. */
export const MIN_GAP_MS = 1200;
/** Tentativi totali per ogni chiamata (1 iniziale + 3 ritentativi). */
const MAX_ATTEMPTS = 4;
/** Oltre questa attesa non ha senso bloccare l'utente: si mostra l'errore con i secondi da attendere. */
const MAX_INLINE_WAIT_MS = 75_000;
/** Margine sul retryDelay indicato da Google (il conteggio lato server non è al millisecondo). */
const RETRY_MARGIN_MS = 1500;

/** Quota giornaliera esaurita: per quanto tempo il modello è considerato "non disponibile" per la scelta del modello di riserva. */
const UNAVAILABLE_MS = 15 * 60 * 1000;
const DEFAULT_SCOPE = 'default';

export interface RetryOptions {
  /** Ambito del limite (di solito il nome del modello): cooldown e quota sono separati per ambito. */
  scope?: string;
  /** Sovrascrive il numero di tentativi. */
  maxAttempts?: number;
  /** Su 429 non attendere: segnala subito l'errore (serve per passare al modello di riserva). */
  failFast?: boolean;
  /**
   * Tempo massimo (ms) per OGNI tentativo. Scaduto, il tentativo viene interrotto (abortSignal) e ritentato come un guasto di rete.
   * Assente = nessun limite (es. upload di file grandi su connessioni lente: li ferma l'utente con Annulla).
   */
  timeoutMs?: number;
}

/** Parametri regolabili SOLO dai test (per non attendere secondi veri). In produzione restano i valori predefiniti. */
const tuning = { gapMs: MIN_GAP_MS, backoffScale: 1 };
export type RateLimitTuning = typeof tuning;

/** Imposta i parametri di temporizzazione e restituisce quelli precedenti (per ripristinarli a fine test). */
export function configureRateLimit(next: Partial<RateLimitTuning>): RateLimitTuning {
  const previous = { ...tuning };
  Object.assign(tuning, next);
  return previous;
}

let tail: Promise<void> = Promise.resolve();
let lastStart = 0;
const blockedUntil = new Map<string, number>(); // attesa vera: le richieste dello stesso ambito aspettano
const unavailableUntil = new Map<string, number>(); // solo per instradare verso il modello di riserva

/** Azzera cooldown, coda e distanziamento (solo test: lo stato del modulo è condiviso fra i casi). */
export function resetRateLimitState(): void {
  tail = Promise.resolve();
  lastStart = 0;
  blockedUntil.clear();
  unavailableUntil.clear();
}

/** Attesa interrompibile con callback ogni secondo (per il countdown nella UI). */
export function sleep(ms: number, signal?: AbortSignal, onTick?: (remainingMs: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new CancelledError(t('error.cancelled')));
    const end = Date.now() + ms;
    let tick: ReturnType<typeof setInterval> | undefined;
    const cleanup = () => {
      clearTimeout(timer);
      if (tick) clearInterval(tick);
      signal?.removeEventListener('abort', onAbort);
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      cleanup();
      reject(new CancelledError(t('error.cancelled')));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    if (onTick) {
      onTick(ms);
      tick = setInterval(() => onTick(Math.max(0, end - Date.now())), 1000);
    }
  });
}

/** Vero se il modello è in attesa dopo un 429 o ha esaurito la quota giornaliera da poco. */
export const isCoolingDown = (scope: string): boolean =>
  (blockedUntil.get(scope) ?? 0) > Date.now() || (unavailableUntil.get(scope) ?? 0) > Date.now();

/** Registra un cooldown: nessuna richiesta di questo ambito parte prima della scadenza. */
export function startCooldown(scope: string, ms: number): void {
  blockedUntil.set(scope, Math.max(blockedUntil.get(scope) ?? 0, Date.now() + ms));
}

/**
 * Riserva il turno per una richiesta: la risoluzione della promise significa "puoi partire".
 * 1) Prima si attende l'eventuale cooldown dell'AMBITO (dopo un 429 di quel modello), FUORI dalla coda globale: così una richiesta
 *    ferma ad aspettare il proprio modello non blocca quelle di altri ambiti (modello di riserva, File API) accodate dietro di lei.
 * 2) Poi si prende il turno nella coda globale, che serve solo a distanziare di tuning.gapMs l'inizio delle richieste.
 */
async function acquire(scope: string, signal?: AbortSignal, onStatus?: (message: string) => void): Promise<void> {
  for (;;) {
    if (signal?.aborted) throw new CancelledError(t('error.cancelled'));
    // Il cooldown può essere esteso mentre si aspetta (un'altra richiesta riceve un nuovo 429): si ricontrolla a ogni giro
    const cooldown = (blockedUntil.get(scope) ?? 0) - Date.now();
    if (cooldown <= 1000) break;
    await sleep(cooldown, signal, (rem) => onStatus?.(t('status.waitRate', { seconds: Math.ceil(rem / 1000) })));
  }
  const run = tail.then(async () => {
    if (signal?.aborted) throw new CancelledError(t('error.cancelled'));
    const gap = lastStart + tuning.gapMs - Date.now();
    if (gap > 0) await sleep(gap, signal);
    lastStart = Date.now();
  });
  tail = run.catch(() => undefined); // un turno annullato non deve bloccare la coda
  return run;
}

/**
 * Esegue UN tentativo con annullamento e timeout "duri".
 * `fn` riceve un segnale proprio del tentativo (da passare all'SDK: così, se scade il tempo, la richiesta HTTP viene davvero interrotta).
 * Anche se `fn` ignora il segnale, la promise restituita si chiude subito a annullamento/timeout; l'eventuale esito tardivo di `fn`
 * viene ignorato (e il suo errore assorbito: nessuna "unhandled rejection").
 */
function runAttempt<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  parent: AbortSignal | undefined,
  timeoutMs: number | undefined
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onParentAbort: (() => void) | undefined;

  const interruption = new Promise<never>((_, reject) => {
    if (parent) {
      onParentAbort = () => {
        controller.abort();
        reject(new CancelledError(t('error.cancelled')));
      };
      if (parent.aborted) onParentAbort();
      else parent.addEventListener('abort', onParentAbort, { once: true });
    }
    if (timeoutMs !== undefined && timeoutMs > 0) {
      timer = setTimeout(() => {
        controller.abort();
        reject(new RequestTimeoutError());
      }, timeoutMs);
    }
  });

  let work: Promise<T>;
  try {
    work = fn(controller.signal);
  } catch (err) {
    work = Promise.reject(err); // `fn` sincrona che lancia: stesso trattamento di una promise rifiutata
  }
  work.catch(() => undefined); // esito tardivo dopo timeout/annullamento: ignorato

  return Promise.race([work, interruption]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
    if (parent && onParentAbort) parent.removeEventListener('abort', onParentAbort);
  });
}

/** Attesa prima del tentativo successivo: retryDelay di Google, altrimenti backoff esponenziale; sempre con jitter. */
function nextDelayMs(retryAfterMs: number | undefined, attempt: number, kind: FailureKind): number {
  const jitter = 1 + Math.random() * 0.25;
  if (retryAfterMs !== undefined) return Math.ceil((retryAfterMs + RETRY_MARGIN_MS) * jitter * tuning.backoffScale);
  const base = kind === 'rate' ? 5000 : 2000;
  return Math.ceil(base * 2 ** (attempt - 1) * jitter * tuning.backoffScale);
}

/**
 * Esegue `fn` con distanziamento e retry. Gli errori vengono sempre normalizzati (messaggi tradotti).
 * `onStatus` riceve il testo da mostrare durante le attese (countdown).
 */
export async function withRetry<T>(
  fn: (attemptSignal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
  onStatus?: (message: string) => void,
  options: RetryOptions = {}
): Promise<T> {
  const scope = options.scope ?? DEFAULT_SCOPE;
  const maxAttempts = options.maxAttempts ?? MAX_ATTEMPTS;
  for (let attempt = 1; ; attempt++) {
    await acquire(scope, signal, onStatus);
    try {
      return await runAttempt(fn, signal, options.timeoutMs);
    } catch (err) {
      const failure = classifyError(err);
      if (failure.kind === 'daily') unavailableUntil.set(scope, Date.now() + UNAVAILABLE_MS);
      const retryable = failure.kind === 'rate' || failure.kind === 'server' || failure.kind === 'network';
      if (!retryable) throw normalizeError(err);

      const delay = nextDelayMs(failure.retryAfterMs, attempt, failure.kind);
      // Il limite vale per quel modello: blocca subito le altre richieste in coda sullo stesso modello
      if (failure.kind === 'rate') startCooldown(scope, Math.min(delay, MAX_INLINE_WAIT_MS));

      const giveUp = attempt >= maxAttempts || delay > MAX_INLINE_WAIT_MS || (failure.kind === 'rate' && options.failFast);
      if (giveUp) {
        if (failure.kind === 'rate') {
          const seconds = Math.max(5, Math.ceil(delay / 1000));
          startCooldown(scope, delay);
          throw new RateLimitError(t('error.rateLimited', { seconds }), seconds);
        }
        throw normalizeError(err);
      }

      const key = failure.kind === 'rate' ? 'status.waitRate' : 'status.retrying';
      await sleep(delay, signal, (rem) =>
        onStatus?.(t(key, { seconds: Math.ceil(rem / 1000), attempt: attempt + 1, max: maxAttempts }))
      );
    }
  }
}
