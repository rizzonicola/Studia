import { GoogleGenAI, Type } from '@google/genai';
import type { Part } from '@google/genai';
import { MapData, QuizData } from '../types';
import { MAX_CONTEXT_CHARS } from '../config/appConfig';
import { t } from '../i18n/core';
import { CancelledError, RateLimitError, UserFacingError, normalizeError } from './errors';
import { isCoolingDown, sleep, withRetry } from './rateLimit';
import { forgetUpload, getCachedUpload, parseExpiry, releaseUploads, setCachedUpload, touchUploads } from './uploadCache';
import { sanitizeMap, sanitizeQuiz, safeJsonParse } from './validators';
import { JSON_DIRECTIVE } from './prompts';
import { sanitizeHtml } from '../utils/sanitizeHtml';

/**
 * Tutte le chiamate a Gemini partono direttamente dal browser dell'utente,
 * usando la SUA API key (Google AI Studio). Nessun server intermedio.
 *
 * Questo modulo importa l'SDK (@google/genai): viene caricato in lazy (import dinamico)
 * solo alla prima generazione, così non pesa sul download iniziale.
 */

export interface GeminiCredentials {
  apiKey: string;
  model: string;
  /** Modello di riserva: va passato solo se la riserva è attiva (di default lo è; l'utente può disattivarla nelle Impostazioni). Usa la stessa chiave API. */
  fallbackModel?: string | null;
}

const client = (apiKey: string) => new GoogleGenAI({ apiKey: apiKey.trim() });

/** Aggiunge l'abortSignal alla config solo se presente (spread: nessun problema di tipi tra versioni dell'SDK). */
const withSignal = (signal?: AbortSignal) => (signal ? { abortSignal: signal } : {});

const throwIfCancelled = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new CancelledError(t('error.cancelled'));
};


/** Ambito dei limiti per le chiamate alla File API (non dipendono dal modello). */
const FILES_SCOPE = 'files';

/**
 * Tempo massimo per un singolo tentativo di generazione. È largo di proposito (un output lungo di un modello "ragionante" può
 * richiedere minuti): serve solo a non restare appesi all'infinito su una connessione morta. Scaduto, si ritenta come per la rete.
 */
const GENERATE_TIMEOUT_MS = 10 * 60 * 1000;
/** Tempo massimo per leggere lo stato di un file (chiamata leggera). L'upload invece non ha limite: lo ferma l'utente con Annulla. */
const FILE_STATUS_TIMEOUT_MS = 30_000;

/**
 * Esegue una chiamata di generazione con ritentativi e, se la riserva è attiva (di default lo è), modello di riserva.
 *  - Senza riserva: retry completo sul modello scelto (attese di Google, countdown).
 *  - Con riserva: il modello principale ha pochi tentativi e, appena risponde con limite di richieste, quota giornaliera
 *    esaurita, sovraccarico o "modello non trovato", si passa subito alla riserva (la quota di Google è per modello,
 *    quindi non serve aspettare). Se il principale è già in attesa/esaurito, si parte direttamente dalla riserva.
 *  I file caricati e i contenuti sono gli stessi: cambia solo il nome del modello.
 */
async function generateWithFallback<T>(
  creds: GeminiCredentials,
  signal: AbortSignal | undefined,
  onStatus: ((message: string) => void) | undefined,
  call: (model: string, attemptSignal: AbortSignal) => Promise<T>
): Promise<T> {
  const fallback = creds.fallbackModel?.trim();
  if (!fallback || fallback === creds.model) {
    return withRetry((s) => call(creds.model, s), signal, onStatus, { scope: creds.model, timeoutMs: GENERATE_TIMEOUT_MS });
  }

  const [first, second] = isCoolingDown(creds.model) && !isCoolingDown(fallback) ? [fallback, creds.model] : [creds.model, fallback];
  try {
    return await withRetry((s) => call(first, s), signal, onStatus, {
      scope: first,
      maxAttempts: 2,
      failFast: true,
      timeoutMs: GENERATE_TIMEOUT_MS,
    });
  } catch (err) {
    if (!(err instanceof UserFacingError) || err instanceof CancelledError || !err.canFallback) throw err;
    throwIfCancelled(signal);
    onStatus?.(t('status.fallback', { model: second }));
    return withRetry((s) => call(second, s), signal, onStatus, { scope: second, timeoutMs: GENERATE_TIMEOUT_MS });
  }
}

// ---------------------------------------------------------------------------
// Utilità
// ---------------------------------------------------------------------------

const EXT_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  html: 'text/html',
  xml: 'text/xml',
  rtf: 'text/rtf',
  json: 'application/json',
  // Codice sorgente: inviato come testo semplice
  py: 'text/x-python',
  js: 'text/javascript',
  ts: 'text/plain',
  cpp: 'text/x-c++src',
  c: 'text/x-csrc',
  java: 'text/x-java-source',
  css: 'text/css',
  sh: 'text/x-shellscript',
  php: 'text/x-php',
  go: 'text/plain',
  // Audio
  mp3: 'audio/mp3',
  wav: 'audio/wav',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  aiff: 'audio/aiff',
  opus: 'audio/ogg',
  // Immagini
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  // Video
  mp4: 'video/mp4',
  mpeg: 'video/mpeg',
  mov: 'video/mov',
  avi: 'video/avi',
  webm: 'video/webm',
  '3gp': 'video/3gpp',
  flv: 'video/x-flv',
  wmv: 'video/wmv',
};

export function resolveMimeType(file: File): string {
  const base = (file.type || '').split(';')[0].trim();
  if (base) return base;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXT_MIME[ext] ?? 'application/octet-stream';
}

function stripCodeFence(text: string, lang?: string): string {
  const trimmed = text.trim();
  const re = new RegExp('^```(?:' + (lang ?? '[a-zA-Z]*') + ')?\\s*\\n([\\s\\S]*?)\\n?```$', 'i');
  const m = trimmed.match(re);
  return m ? m[1].trim() : trimmed;
}

function parseJson(text: string | undefined): unknown {
  if (!text) throw new UserFacingError(t('error.noContent'));
  const parsed = safeJsonParse(stripCodeFence(text, 'json'));
  if (parsed === null) throw new UserFacingError(t('error.invalidJson'));
  return parsed;
}

// ---------------------------------------------------------------------------
// Appunti da file (documenti / audio) tramite File API
// ---------------------------------------------------------------------------

type GeminiClient = ReturnType<typeof client>;
type RemoteFile = Awaited<ReturnType<GeminiClient['files']['get']>>;

/** Attesa massima (ms) che Google finisca di elaborare un file prima di arrendersi. */
const MAX_PROCESSING_MS = 10 * 60 * 1000;

/**
 * Garantisce che `file` sia su Google e pronto (ACTIVE) e restituisce il riferimento da usare nella richiesta.
 * Se un tentativo precedente lo aveva già caricato, lo riusa (dopo averne verificato lo stato) invece di ricaricarlo.
 */
async function ensureUploaded(opts: {
  ai: GeminiClient;
  creds: GeminiCredentials;
  file: File;
  label: string;
  onStatus?: (message: string) => void;
  signal?: AbortSignal;
}): Promise<{ uri: string; mimeType: string }> {
  const { ai, creds, file, label, onStatus, signal } = opts;
  const mimeType = resolveMimeType(file);
  let remote: RemoteFile | null = null;

  // 1) Riuso di un caricamento precedente (stesso file, stessa chiave, non scaduto)
  const cached = getCachedUpload(creds.apiKey, file);
  if (cached) {
    onStatus?.(t('status.reusingFile', { label }));
    try {
      touchUploads();
      remote = await withRetry(() => ai.files.get({ name: cached.name }), signal, onStatus, {
        scope: FILES_SCOPE,
        timeoutMs: FILE_STATUS_TIMEOUT_MS,
      });
      if (String(remote.state) === 'FAILED' || !remote.uri) {
        forgetUpload(file);
        remote = null;
      }
    } catch (err) {
      // Annullamento, rate limit o guasto transitorio (rete, 5xx, timeout): non è colpa del file, e ricaricarlo peggiorerebbe
      // solo le cose. Il riferimento resta in cache per il tentativo successivo.
      if (err instanceof CancelledError || err instanceof RateLimitError) throw err;
      if (err instanceof UserFacingError && (err.kind === 'network' || err.kind === 'server')) throw err;
      // File scaduto o cancellato su Google (404/403): si ricarica normalmente
      forgetUpload(file);
      remote = null;
    }
  }

  // 2) Caricamento nuovo
  if (!remote) {
    onStatus?.(t('status.uploading', { label }));
    remote = await withRetry(
      (attemptSignal) => ai.files.upload({ file, config: { mimeType, displayName: file.name, ...withSignal(attemptSignal) } }),
      signal,
      onStatus,
      { scope: FILES_SCOPE }
    );
    if (!remote?.uri || !remote.name) throw new UserFacingError(t('error.uploadRef'));
    // Salvo SUBITO il riferimento: se la generazione fallisce (o l'utente annulla) il file non va ricaricato
    setCachedUpload(creds.apiKey, file, {
      name: remote.name,
      uri: remote.uri,
      mimeType: remote.mimeType || mimeType,
      expiresAt: parseExpiry(remote.expirationTime),
    });
  }

  // 3) Attesa che Google finisca di elaborarlo (polling con intervallo crescente: meno richieste inutili)
  const remoteName: string = remote.name ?? '';
  const startedAt = Date.now();
  let pause = 2000;
  while (String(remote.state) === 'PROCESSING') {
    throwIfCancelled(signal);
    if (Date.now() - startedAt > MAX_PROCESSING_MS) throw new UserFacingError(t('error.fileFailed', { name: file.name }));
    onStatus?.(t('status.processingFile', { label }));
    await sleep(pause, signal);
    pause = Math.min(pause + 1000, 6000);
    remote = await withRetry(() => ai.files.get({ name: remoteName }), signal, onStatus, {
      scope: FILES_SCOPE,
      timeoutMs: FILE_STATUS_TIMEOUT_MS,
    });
  }
  if (String(remote.state) === 'FAILED' || !remote.uri) {
    forgetUpload(file);
    void releaseUploads(creds.apiKey, [file]);
    throw new UserFacingError(t('error.fileFailed', { name: file.name }));
  }
  return { uri: remote.uri, mimeType: remote.mimeType || mimeType };
}

export async function generateNotesFromFiles(opts: {
  creds: GeminiCredentials;
  systemPrompt: string;
  /** Testo della richiesta con segnaposto {names} */
  requestText: string;
  /** Riga tecnica con la lingua di risposta */
  languageDirective: string;
  files: File[];
  onStatus?: (message: string) => void;
  signal?: AbortSignal;
}): Promise<string> {
  const { creds, systemPrompt, requestText, languageDirective, files, onStatus, signal } = opts;
  const ai = client(creds.apiKey);
  let succeeded = false;

  try {
    const parts: Part[] = [];

    for (let i = 0; i < files.length; i++) {
      throwIfCancelled(signal);
      const label = files.length > 1 ? ` (${i + 1}/${files.length})` : '';
      const { uri, mimeType } = await ensureUploaded({ ai, creds, file: files[i], label, onStatus, signal });
      parts.push({ fileData: { fileUri: uri, mimeType } });
    }

    throwIfCancelled(signal);
    const names = files.map((f) => f.name).join(', ');
    parts.push({ text: `${requestText.replace('{names}', names)}\n\n${languageDirective}` });

    onStatus?.(t('status.generatingNotes'));
    const response = await generateWithFallback(creds, signal, onStatus, (model, attemptSignal) =>
      ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts }],
        config: { systemInstruction: systemPrompt, temperature: 0.7, ...withSignal(attemptSignal) },
      })
    );

    const text = response.text;
    if (!text) throw new UserFacingError(t('error.blocked'));
    succeeded = true;
    return text;
  } catch (err) {
    throw normalizeError(err);
  } finally {
    // Privacy: a generazione riuscita i file vengono cancellati subito dai server Google.
    // Se invece fallisce restano (in cache) per il ritentativo senza nuovo upload; vengono cancellati
    // quando l'utente li rimuove, dopo 30 minuti di inattività o alla chiusura della scheda (vedi uploadCache.ts).
    // La cancellazione NON si attende: gli appunti sono già pronti e non devono aspettare una pulizia (che non lancia mai ed è
    // "best effort"); prima, con una rete lenta, il risultato restava bloccato fino al termine delle richieste DELETE.
    if (succeeded) void releaseUploads(creds.apiKey, files);
  }
}

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------

export async function generateQuizData(opts: {
  creds: GeminiCredentials;
  systemPrompt: string;
  content: string;
  textHeader: string;
  languageDirective: string;
  signal?: AbortSignal;
}): Promise<QuizData> {
  const { creds, systemPrompt, content, textHeader, languageDirective, signal } = opts;
  const ai = client(creds.apiKey);

  const response = await generateWithFallback(creds, signal, undefined, (model, attemptSignal) =>
    ai.models.generateContent({
      model,
      contents: `${textHeader}\n${content.substring(0, MAX_CONTEXT_CHARS)}\n\n${languageDirective}\n${JSON_DIRECTIVE}`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        // Schema INVARIATO in tutte le lingue: chiavi e tipi non si traducono
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  questionText: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctAnswer: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                },
                required: ['questionText', 'options', 'correctAnswer', 'explanation'],
              },
            },
          },
          required: ['title', 'questions'],
        },
        ...withSignal(attemptSignal),
      },
    })
  );

  const data = sanitizeQuiz(parseJson(response.text));
  if (!data) throw new UserFacingError(t('error.invalidQuiz'));
  return data;
}

// ---------------------------------------------------------------------------
// Mappa concettuale
// ---------------------------------------------------------------------------

export async function generateMapData(opts: {
  creds: GeminiCredentials;
  systemPrompt: string;
  content: string;
  textHeader: string;
  languageDirective: string;
  signal?: AbortSignal;
}): Promise<MapData> {
  const { creds, systemPrompt, content, textHeader, languageDirective, signal } = opts;
  const ai = client(creds.apiKey);

  const response = await generateWithFallback(creds, signal, undefined, (model, attemptSignal) =>
    ai.models.generateContent({
      model,
      contents: `${textHeader}\n${content.substring(0, MAX_CONTEXT_CHARS)}\n\n${languageDirective}\n${JSON_DIRECTIVE}`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            graph: {
              type: Type.OBJECT,
              properties: {
                nodes: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.INTEGER },
                      label: { type: Type.STRING },
                      color: { type: Type.STRING, nullable: true },
                      mass: { type: Type.NUMBER, nullable: true },
                    },
                    required: ['id', 'label'],
                  },
                },
                edges: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      from: { type: Type.INTEGER },
                      to: { type: Type.INTEGER },
                      label: { type: Type.STRING, nullable: true },
                    },
                    required: ['from', 'to'],
                  },
                },
              },
              required: ['nodes', 'edges'],
            },
          },
          required: ['title', 'graph'],
        },
        ...withSignal(attemptSignal),
      },
    })
  );

  const data = sanitizeMap(parseJson(response.text));
  if (!data) throw new UserFacingError(t('error.invalidMap'));
  return data;
}

// ---------------------------------------------------------------------------
// Foto → pagina HTML
// ---------------------------------------------------------------------------

export async function processImageToHtml(opts: {
  creds: GeminiCredentials;
  systemPrompt: string;
  requestText: string;
  languageDirective: string;
  base64: string;
  mimeType?: string;
  signal?: AbortSignal;
}): Promise<string> {
  const { creds, systemPrompt, requestText, languageDirective, base64, mimeType, signal } = opts;
  const ai = client(creds.apiKey);

  const response = await generateWithFallback(creds, signal, undefined, (model, attemptSignal) =>
    ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { data: base64, mimeType: mimeType || 'image/jpeg' } },
            { text: `${requestText}\n\n${languageDirective}` },
          ],
        },
      ],
      config: { systemInstruction: systemPrompt, ...withSignal(attemptSignal) },
    })
  );

  const text = response.text;
  if (!text) throw new UserFacingError(t('error.noContent'));
  // L'HTML generato dall'AI è "non fidato": viene sanificato prima di essere salvato
  return sanitizeHtml(stripCodeFence(text, 'html'));
}
