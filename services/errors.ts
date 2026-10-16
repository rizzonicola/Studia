import { t } from '../i18n/core';

/** Errore già formattato (e tradotto) per l'utente: non viene rielaborato. */
export class UserFacingError extends Error {
  /** Tipo di guasto (solo per gli errori delle chiamate a Google): serve a decidere se passare al modello di riserva. */
  kind?: FailureKind;
  /** Vero se un altro modello potrebbe riuscire dove questo ha fallito (limiti, sovraccarico, modello non trovato). */
  canFallback = false;
}

/** Operazione annullata dall'utente: non va mostrata come errore. */
export class CancelledError extends UserFacingError {}

/**
 * Una singola chiamata è rimasta senza risposta oltre il tempo massimo (connessione "appesa").
 * Non è un annullamento dell'utente (name diverso da AbortError): viene classificato come guasto di rete e ritentato.
 */
export class RequestTimeoutError extends Error {
  constructor(message = 'Request timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

type ErrorLike = { status?: unknown; name?: unknown; message?: unknown };
const asLike = (err: unknown): ErrorLike => (typeof err === 'object' && err !== null ? (err as ErrorLike) : {});

// ---------------------------------------------------------------------------
// Analisi dell'errore
// ---------------------------------------------------------------------------

/**
 * Cosa ha limitato la richiesta (solo per i 429):
 *  - minute: limite al minuto (RPM/TPM) → basta aspettare pochi secondi;
 *  - day: quota giornaliera finita → inutile riprovare adesso;
 *  - zero: il modello non ha quota per questo piano (limit: 0) → serve un altro modello o la fatturazione;
 *  - unknown: Google non ha dato dettagli.
 */
export type QuotaScope = 'minute' | 'day' | 'zero' | 'unknown';

export interface ErrorInfo {
  status?: number;
  message: string;
  /** Attesa suggerita da Google (RetryInfo.retryDelay o "Please retry in 34s"). */
  retryAfterMs?: number;
  quotaScope?: QuotaScope;
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null;

/** Il messaggio dell'SDK @google/genai è spesso il JSON del corpo di errore: lo estraggo se possibile. */
function parseErrorBody(raw: string): Json | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isObj(parsed)) return isObj(parsed.error) ? parsed.error : parsed;
  } catch {
    /* il messaggio non è JSON */
  }
  return null;
}

/**
 * Toglie da un testo qualunque cosa somigli a una chiave API Google ("AIza...") o a un parametro `key=` di un URL.
 * La chiave viaggia solo nell'header x-goog-api-key e Google non la ripete negli errori, ma un messaggio d'errore che
 * finisce a schermo (o in un log) non deve poterla contenere in nessun caso: difesa in profondità.
 */
export function redactSecrets(text: string): string {
  return text
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[redacted]')
    .replace(/([?&;]key=)[^&\s"'<>]+/gi, '$1[redacted]')
    .replace(/(x-goog-api-key["']?\s*[:=]\s*["']?)[^\s"',}]+/gi, '$1[redacted]');
}

/** "34s" / "34.5s" / "1m" → millisecondi. */
function parseDurationMs(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value * 1000;
  if (typeof value !== 'string') return undefined;
  const m = value.trim().match(/^(\d+(?:\.\d+)?)\s*(ms|s|m)?$/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  const unit = (m[2] ?? 's').toLowerCase();
  return unit === 'ms' ? n : unit === 'm' ? n * 60_000 : n * 1000;
}

export function inspectError(err: unknown): ErrorInfo {
  const like = asLike(err);
  const raw = String(like.message ?? err ?? '');
  const body = parseErrorBody(raw);
  const message = redactSecrets(body && typeof body.message === 'string' ? body.message : raw);

  // Stato HTTP: campo dell'SDK, poi "code" del corpo, poi (ultima spiaggia) un codice nel testo
  let status: number | undefined = typeof like.status === 'number' ? like.status : undefined;
  if (status === undefined && body && typeof body.code === 'number') status = body.code;
  if (status === undefined) {
    // Ultima spiaggia: un codice HTTP nel testo, ma solo con un contesto che lo renda credibile
    // ("[429 Too Many Requests]", "status: 503", "HTTP 500"). Un numero qualunque ("max 500 MB") non basta.
    const m = raw.match(/(?:\[|\bstatus\b["'\s:=]+|\bcode\b["'\s:=]+|\bhttp\/?\s*[\d.]*\s+)(400|401|403|404|408|429|500|502|503|504)\b/i);
    if (m) status = Number(m[1]);
  }

  const details: Json[] = body && Array.isArray(body.details) ? body.details.filter(isObj) : [];

  // Attesa suggerita
  let retryAfterMs: number | undefined;
  for (const d of details) {
    if (String(d['@type'] ?? '').endsWith('RetryInfo')) retryAfterMs = parseDurationMs(d.retryDelay);
  }
  if (retryAfterMs === undefined) {
    const m = raw.match(/retry in (\d+(?:\.\d+)?)\s*s/i) ?? raw.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/i);
    if (m) retryAfterMs = Number(m[1]) * 1000;
  }

  // Tipo di quota
  const lower = `${message} ${raw}`.toLowerCase();
  let quotaScope: QuotaScope | undefined;
  const isQuotaError = status === 429 || lower.includes('quota') || lower.includes('resource_exhausted');
  if (isQuotaError) {
    const ids = details
      .filter((d) => String(d['@type'] ?? '').endsWith('QuotaFailure'))
      .flatMap((d) => (Array.isArray(d.violations) ? d.violations.filter(isObj) : []))
      .map((v) => `${String(v.quotaId ?? '')} ${String(v.quotaMetric ?? '')}`)
      .join(' ')
      .toLowerCase();
    if (/limit:\s*0\b/.test(lower)) quotaScope = 'zero';
    else if (/perday|per_day|per day/.test(ids) || /perday|per day/.test(lower)) quotaScope = 'day';
    else if (/perminute|per_minute|per minute/.test(ids) || /perminute|per minute/.test(lower)) quotaScope = 'minute';
    else quotaScope = 'unknown';
  }

  return { status, message, retryAfterMs, quotaScope };
}

// Compatibilità con il codice esistente
export const extractStatus = (err: unknown): number | undefined => inspectError(err).status;
export const extractMessage = (err: unknown): string => inspectError(err).message;

export const isAbortError = (err: unknown): boolean => {
  const like = asLike(err);
  return like.name === 'AbortError' || /\babort(ed)?\b/i.test(String(like.message ?? ''));
};

const isNetworkError = (lowerMessage: string): boolean =>
  lowerMessage.includes('failed to fetch') ||
  lowerMessage.includes('networkerror') ||
  lowerMessage.includes('network error') ||
  lowerMessage.includes('load failed');

// ---------------------------------------------------------------------------
// Classificazione: decide se (e come) ritentare
// ---------------------------------------------------------------------------

export type FailureKind =
  | 'abort' // annullato dall'utente
  | 'rate' // limite al minuto / generico: si risolve aspettando
  | 'daily' // quota giornaliera o modello senza quota: inutile ritentare ora
  | 'server' // 5xx / sovraccarico: temporaneo
  | 'network' // rete assente o instabile
  | 'fatal'; // chiave non valida, richiesta errata, ecc.

export interface Failure {
  kind: FailureKind;
  retryAfterMs?: number;
  info: ErrorInfo;
  /** Vero se la chiamata è stata interrotta perché ha superato il tempo massimo (kind è "network": si ritenta). */
  timedOut?: boolean;
}

export function classifyError(err: unknown): Failure {
  const info = inspectError(err);
  const lower = info.message.toLowerCase();
  const base = { retryAfterMs: info.retryAfterMs, info };

  if (err instanceof RequestTimeoutError) return { kind: 'network', timedOut: true, ...base };
  if (err instanceof CancelledError || isAbortError(err)) return { kind: 'abort', info };
  if (info.quotaScope) {
    return { kind: info.quotaScope === 'day' || info.quotaScope === 'zero' ? 'daily' : 'rate', ...base };
  }
  const s = info.status;
  if (s === 408 || (s !== undefined && s >= 500) || lower.includes('unavailable') || lower.includes('overloaded')) {
    return { kind: 'server', ...base };
  }
  if (isNetworkError(lower) && !(typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return { kind: 'network', ...base };
  }
  return { kind: 'fatal', ...base };
}

export const isRetryable = (err: unknown): boolean => {
  const { kind } = classifyError(err);
  return kind === 'rate' || kind === 'server' || kind === 'network';
};

/** Errore di limite di richieste: espone quanti secondi attendere prima di riprovare. */
export class RateLimitError extends UserFacingError {
  constructor(message: string, readonly retryAfterSec: number) {
    super(message);
    this.kind = 'rate';
    this.canFallback = true;
  }
}

/** Converte gli errori dell'SDK / della rete in messaggi comprensibili e tradotti. */
export function normalizeError(err: unknown): UserFacingError {
  if (err instanceof UserFacingError) return err;
  const failure = classifyError(err);
  const out = buildUserError(failure);
  out.kind = failure.kind;
  out.canFallback =
    failure.kind === 'rate' ||
    failure.kind === 'daily' ||
    failure.kind === 'server' ||
    (failure.kind === 'fatal' && failure.info.status === 404);
  return out;
}

function buildUserError(failure: Failure): UserFacingError {
  if (failure.kind === 'abort') return new CancelledError(t('error.cancelled'));
  if (failure.timedOut) return new UserFacingError(t('error.timeout'));

  const { status, message } = failure.info;
  const lower = message.toLowerCase();

  if (lower.includes('api key not valid') || lower.includes('api_key_invalid') || status === 401) {
    return new UserFacingError(t('error.apiKeyInvalid'));
  }
  if (failure.kind === 'daily') return new UserFacingError(t('error.quotaDaily'));
  if (failure.kind === 'rate') {
    const seconds = Math.max(5, Math.ceil((failure.retryAfterMs ?? 60_000) / 1000));
    return new RateLimitError(t('error.rateLimited', { seconds }), seconds);
  }
  if (status === 403) return new UserFacingError(t('error.forbidden'));
  if (status === 404 || lower.includes('not found')) return new UserFacingError(t('error.modelNotFound'));
  if (failure.kind === 'server') return new UserFacingError(t('error.serverBusy'));
  if (isNetworkError(lower)) return new UserFacingError(t('error.network'));
  // Il messaggio grezzo dell'SDK non è tradotto ma è più utile di un errore generico
  return new UserFacingError(message || t('error.unexpected'));
}
