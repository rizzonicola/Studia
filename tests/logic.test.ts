/**
 * Test (Vitest) per le funzioni pure critiche e per la logica di servizio (errori, rate limit, storage, export).
 * Per eseguirli: npm test (vitest è tra le devDependencies; configurazione in vitest.config.ts).
 * La cartella resta esclusa dal typecheck (tsconfig.json).
 * I test che richiedono un browser vero (IndexedDB, service worker, DOMParser) stanno in tools/browser-checks (vedi docs/SVILUPPO.md, «Test e controlli»).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolveSystemLanguage, resolveLanguage, isLanguagePreference } from '../i18n/resolve';
import { sanitizeQuiz, sanitizeMap } from '../services/validators';
import { pickPrompt } from '../services/prompts';
import { normalizeMath } from '../utils/normalizeMath';
import { contrast, normalizeHex } from '../utils/color';
import { PRESETS, defaultThemeConfig, sanitizeThemeConfig } from '../config/themes';
import { computeTheme, resolveScheme } from '../utils/themeEngine';
import { CancelledError, RateLimitError, RequestTimeoutError, UserFacingError, classifyError, inspectError, normalizeError, redactSecrets } from '../services/errors';
import { configureRateLimit, isCoolingDown, resetRateLimitState, startCooldown, withRetry } from '../services/rateLimit';
import { sanitizeFilename } from '../utils/download';
import { planFolderExport, uniqueName } from '../utils/exportUtils';
import { normalizeAll, normalizeFolder, normalizeNote, parseLegacyData, repairTree } from '../services/notesData';
import { classifyStorageError } from '../utils/storageStatus';
import { moveApiKey, readApiKey, removeApiKey, saveApiKey, type SimpleStorage } from '../services/apiKeyStore';
import { DEFAULT_FALLBACK_ENABLED, DEFAULT_FALLBACK_MODEL, DEFAULT_MODEL, LEGAL_LAST_UPDATED_ISO, LEGAL_VERSION, STORAGE_KEYS } from '../config/appConfig';
import { readFallbackEnabled, saveFallbackEnabled } from '../services/fallbackPreference';
import itDictionary from '../i18n/locales/it';
import enDictionary from '../i18n/locales/en';
import frDictionary from '../i18n/locales/fr';
import { activateLanguage, formatDate, formatNumber, tp } from '../i18n/core';
import { I18nProvider } from '../i18n/I18nProvider';
import { createModuleRegistry } from '../utils/moduleRegistry';
import { isLegacyKatexFont, pruneLegacyKatexFonts, stripLegacyFontSources } from '../config/legacyFonts';
import { collectNotices, packageRootFromModuleId } from '../config/thirdPartyNotices';
import { PrivacyContent as LegalPrivacy, TermsContent as LegalTerms, preloadLegal } from '../legal/LegalDocuments';
import { decodeCssEscapes, sanitizeCss } from '../utils/sanitizeHtml';
import { DEFAULT_READ_CONCURRENCY, classifyImportFile, extensionOf, isIgnoredPath, readImportFiles, summarizeNames, titleFromFileName } from '../utils/importFiles';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createElement, type FC } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PrivacyContent as PrivacyIt, TermsContent as TermsIt } from '../legal/content/it';
import { PrivacyContent as PrivacyEn, TermsContent as TermsEn } from '../legal/content/en';
import { PrivacyContent as PrivacyFr, TermsContent as TermsFr } from '../legal/content/fr';
import type { Folder, Note } from '../types';

describe('risoluzione lingua', () => {
  it('riconosce le varianti regionali', () => {
    expect(resolveSystemLanguage(['fr-CA'])).toBe('fr');
    expect(resolveSystemLanguage(['en-GB'])).toBe('en');
    expect(resolveSystemLanguage(['it-CH'])).toBe('it');
    expect(resolveSystemLanguage(['FR_ca'])).toBe('fr');
  });
  it('sceglie la prima lingua supportata', () => {
    expect(resolveSystemLanguage(['de-DE', 'fr-FR', 'it'])).toBe('fr');
  });
  it('ripiega su English', () => {
    expect(resolveSystemLanguage(['de-DE', 'es'])).toBe('en');
    expect(resolveSystemLanguage([])).toBe('en');
    expect(resolveSystemLanguage(undefined)).toBe('en');
  });
  it('rispetta la scelta esplicita', () => {
    expect(resolveLanguage('it', ['fr'])).toBe('it');
    expect(resolveLanguage('system', ['fr'])).toBe('fr');
  });
  it('valida le preferenze', () => {
    expect(isLanguagePreference('system')).toBe(true);
    expect(isLanguagePreference('de')).toBe(false);
  });
});

describe('risoluzione prompt', () => {
  it('il prompt personalizzato sostituisce il predefinito', () => {
    expect(pickPrompt('mio prompt', 'default')).toBe('mio prompt');
  });
  it('campo vuoto o solo spazi → predefinito', () => {
    expect(pickPrompt('', 'default')).toBe('default');
    expect(pickPrompt('   \n', 'default')).toBe('default');
    expect(pickPrompt(undefined, 'default')).toBe('default');
  });
});

describe('validazione quiz', () => {
  const valid = {
    title: 'Quiz',
    questions: [{ questionText: 'Q?', options: ['a', 'b', 'c', 'd'], correctAnswer: 'B', explanation: 'perché' }],
  };
  it('accetta un quiz valido e normalizza correctAnswer', () => {
    expect(sanitizeQuiz(valid)?.questions[0].correctAnswer).toBe('b');
  });
  it('scarta domande con risposta non presente tra le opzioni', () => {
    expect(sanitizeQuiz({ title: 'x', questions: [{ ...valid.questions[0], correctAnswer: 'zzz' }] })).toBeNull();
  });
  it('rifiuta input malformati', () => {
    expect(sanitizeQuiz(null)).toBeNull();
    expect(sanitizeQuiz({ title: 'x' })).toBeNull();
    expect(sanitizeQuiz({ title: '', questions: [] })).toBeNull();
  });
});

describe('validazione mappa', () => {
  it('elimina archi verso nodi inesistenti e colori non validi', () => {
    const map = sanitizeMap({
      title: 'M',
      graph: {
        nodes: [{ id: 1, label: 'A', color: 'red;background:url(x)' }, { id: 2, label: 'B', color: '#ffadad' }],
        edges: [{ from: 1, to: 2, label: 'causa' }, { from: 1, to: 99 }],
      },
    });
    expect(map?.graph.edges).toHaveLength(1);
    expect(map?.graph.nodes[0].color).toBeUndefined();
    expect(map?.graph.nodes[1].color).toBe('#ffadad');
  });
  it('rifiuta mappe senza nodi', () => {
    expect(sanitizeMap({ title: 'M', graph: { nodes: [], edges: [] } })).toBeNull();
  });
});

describe('normalizeMath', () => {
  it('converte \\( \\) e \\[ \\]', () => {
    expect(normalizeMath('a \\(x^2\\) b')).toBe('a $x^2$ b');
    expect(normalizeMath('\\[x\\]')).toContain('$$');
  });
  it('non tocca i blocchi di codice', () => {
    expect(normalizeMath('`\\(x\\)`')).toBe('`\\(x\\)`');
  });
});


describe('temi', () => {
  it('normalizza i colori e scarta quelli non validi', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc');
    expect(normalizeHex('0c9488')).toBe('#0c9488');
    expect(normalizeHex('red;background:url(x)')).toBeNull();
  });
  it('il tema chiaro Classico non sovrascrive la scala dei grigi', () => {
    const vars = computeTheme(defaultThemeConfig(), 'light').vars;
    expect(Object.keys(vars).some((k) => k.startsWith('--color-gray-'))).toBe(false);
  });
  it('tutte le tavolozze e gli accenti restano leggibili (WCAG AA)', () => {
    for (const scheme of ['light', 'dark'] as const) {
      for (const p of PRESETS[scheme]) {
        for (const accent of ['auto', 'black', 'blue', 'yellow', 'custom'] as const) {
          const cfg = defaultThemeConfig();
          cfg[scheme].preset = p.id;
          cfg[scheme].accent = accent;
          cfg[scheme].customAccent = '#ffff00';
          const pal = computeTheme(cfg, scheme).palette;
          expect(contrast(pal.accent, pal.accentFg)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(pal.accentInk, pal.surface)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(pal.muted, pal.surface)).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });
  it('la modalità a orario gestisce anche le fasce che passano la mezzanotte', () => {
    const at = (h: number, m: number) => new Date(2026, 9, 1, h, m);
    expect(resolveScheme('schedule', false, at(23, 0), '20:00', '07:00')).toBe('dark');
    expect(resolveScheme('schedule', false, at(12, 0), '20:00', '07:00')).toBe('light');
    expect(resolveScheme('system', true, at(12, 0), '20:00', '07:00')).toBe('dark');
  });
  it('la configurazione importata viene sempre ripulita', () => {
    const cfg = sanitizeThemeConfig({ mode: 'x', fontScale: 9999, light: { accent: 'url(javascript:1)', customAccent: 'red;x', custom: { bg: 'zzz' } } });
    expect(cfg.mode).toBe('system');
    expect(cfg.fontScale).toBe(140);
    expect(cfg.light.accent).toBe('auto');
    expect(cfg.light.custom).toEqual({});
  });
});

describe('errori Google e rate limit', () => {
  const apiError = (error: Record<string, unknown>) => ({ status: error.code, message: JSON.stringify({ error }) });
  it('429 al minuto: ritentabile, usa il retryDelay di Google', () => {
    const f = classifyError(
      apiError({
        code: 429,
        message: 'You exceeded your current quota',
        details: [
          { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateContentInputTokensPerModelPerMinute-FreeTier' }] },
          { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '34s' },
        ],
      })
    );
    expect(f.kind).toBe('rate');
    expect(f.retryAfterMs).toBe(34000);
  });
  it('quota giornaliera o limit: 0: non si ritenta', () => {
    const day = apiError({ code: 429, message: 'quota', details: [{ '@type': 'x.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }] });
    expect(classifyError(day).kind).toBe('daily');
    expect(classifyError(apiError({ code: 429, message: 'Quota exceeded, limit: 0' })).kind).toBe('daily');
  });
  it('429 con retry nel solo testo, 5xx, rete e annullamento', () => {
    expect(classifyError({ status: 429, message: 'Please retry in 12.5s.' }).retryAfterMs).toBe(12500);
    expect(classifyError(apiError({ code: 503, message: 'overloaded' })).kind).toBe('server');
    expect(classifyError(new TypeError('Failed to fetch')).kind).toBe('network');
    expect(classifyError({ name: 'AbortError', message: 'x' }).kind).toBe('abort');
    expect(classifyError({ status: 400, message: 'max 500 MB' }).kind).toBe('fatal');
  });
  it('il limite al minuto diventa un RateLimitError con i secondi da attendere', () => {
    const e = normalizeError(apiError({ code: 429, message: 'q', details: [{ '@type': 'x.RetryInfo', retryDelay: '20s' }] }));
    expect(e).toBeInstanceOf(RateLimitError);
    expect((e as RateLimitError).retryAfterSec).toBe(20);
  });
});

describe('modello di riserva: instradamento degli errori', () => {
  const apiError = (error: Record<string, unknown>) => ({ status: error.code, message: JSON.stringify({ error }) });
  it('429 con failFast: errore immediato, cooldown solo sul modello che ha fallito', async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw apiError({ code: 429, message: 'q', details: [{ '@type': 'x.RetryInfo', retryDelay: '30s' }] });
        },
        undefined,
        undefined,
        { scope: 'modello-a', maxAttempts: 2, failFast: true }
      )
    ).rejects.toMatchObject({ canFallback: true, kind: 'rate' });
    expect(calls).toBe(1);
    expect(isCoolingDown('modello-a')).toBe(true);
    expect(isCoolingDown('modello-b')).toBe(false);
  });
  it('errori che il modello di riserva non può risolvere non passano al fallback', async () => {
    await expect(
      withRetry(async () => { throw apiError({ code: 400, message: 'API key not valid' }); }, undefined, undefined, { scope: 'x' })
    ).rejects.toMatchObject({ canFallback: false });
  });
});

describe('modello di riserva: nome predefinito', () => {
  it('è valorizzato, ha la forma di un modello Gemini ed è diverso dal principale (a nomi uguali la riserva non si attiverebbe mai)', () => {
    expect(DEFAULT_FALLBACK_MODEL.trim()).not.toBe('');
    expect(DEFAULT_FALLBACK_MODEL).toMatch(/^gemini-[a-z0-9.-]+$/);
    expect(DEFAULT_FALLBACK_MODEL).not.toBe(DEFAULT_MODEL);
  });
  it('nessuno spazio ai lati: viene confrontato e inviato così com\'è', () => {
    expect(DEFAULT_FALLBACK_MODEL).toBe(DEFAULT_FALLBACK_MODEL.trim());
  });
});

describe('modello di riserva: attivazione predefinita', () => {
  const fake = (failWrites = false): SimpleStorage & { data: Map<string, string> } => {
    const data = new Map<string, string>();
    return { data, get: (k) => data.get(k) ?? null, set: (k, v) => { if (failWrites) return false; data.set(k, v); return true; }, remove: (k) => void data.delete(k) };
  };

  it('di predefinito è ATTIVA: senza una scelta salvata la riserva è accesa e nel browser non resta nulla', () => {
    const store = fake();
    expect(DEFAULT_FALLBACK_ENABLED).toBe(true);
    expect(readFallbackEnabled(store)).toBe(true);
    expect(store.data.size).toBe(0);
  });
  it('disattivata dall\'utente: si salva solo \'0\' e la scelta resta dopo il riavvio', () => {
    const store = fake();
    expect(saveFallbackEnabled(store, false)).toBe(true);
    expect([...store.data.entries()]).toEqual([[STORAGE_KEYS.fallbackEnabled, '0']]);
    expect(readFallbackEnabled(store)).toBe(false);
  });
  it('riattivata: si torna al predefinito, la chiave sparisce e non resta nessun valore superfluo', () => {
    const store = fake();
    saveFallbackEnabled(store, false);
    expect(saveFallbackEnabled(store, true)).toBe(true);
    expect(store.data.size).toBe(0);
    expect(readFallbackEnabled(store)).toBe(true);
  });
  it('chi l\'aveva accesa con la versione precedente (\'1\') la ritrova accesa e può spegnerla', () => {
    const store = fake();
    store.set(STORAGE_KEYS.fallbackEnabled, '1');
    expect(readFallbackEnabled(store)).toBe(true);
    saveFallbackEnabled(store, true); // il valore storico viene ripulito
    expect(store.data.has(STORAGE_KEYS.fallbackEnabled)).toBe(false);
    store.set(STORAGE_KEYS.fallbackEnabled, '1');
    saveFallbackEnabled(store, false);
    expect(readFallbackEnabled(store)).toBe(false);
  });
  it('un valore non riconosciuto vale come il predefinito (solo \'0\' spegne la riserva)', () => {
    for (const raw of ['', 'true', 'false', 'off', '2', ' 0']) {
      const store = fake();
      store.set(STORAGE_KEYS.fallbackEnabled, raw);
      expect(readFallbackEnabled(store), `valore «${raw}»`).toBe(true);
    }
  });
  it('se la scrittura non riesce lo segnala (false), senza toccare il nome del modello di riserva', () => {
    const store = fake(true);
    expect(saveFallbackEnabled(store, false)).toBe(false);
    expect(store.data.size).toBe(0);
    const ok = fake();
    ok.set(STORAGE_KEYS.fallbackModel, 'gemini-x');
    saveFallbackEnabled(ok, false);
    expect(ok.data.get(STORAGE_KEYS.fallbackModel)).toBe('gemini-x');
  });
});

describe('modello di riserva attivo di default: testi coerenti (interfaccia, Termini, Privacy)', () => {
  // Se cambi DEFAULT_FALLBACK_ENABLED, questo blocco fallisce: rivedi le frasi qui sotto, i testi legali e LEGAL_VERSION.
  const render = (Component: FC) => renderToStaticMarkup(createElement(Component));
  // Il rendering sta in una funzione (non nel corpo del describe): se un testo legale non si compila, fallisce solo questo test.
  const legalTexts = () => ({
    it: { terms: render(TermsIt), privacy: render(PrivacyIt), on: 'Modello di riserva (attivo di default)', stale: ['disattivata di default', 'Modello di riserva (facoltativo)'], term: 'modello di riserva' },
    en: { terms: render(TermsEn), privacy: render(PrivacyEn), on: 'Fallback model (on by default)', stale: ['off by default', 'Fallback model (optional)'], term: 'fallback model' },
    fr: { terms: render(TermsFr), privacy: render(PrivacyFr), on: 'Modèle de secours (activé par défaut)', stale: ['désactivée par défaut', 'Modèle de secours (facultatif)'], term: 'modèle de secours' },
  });
  const dictionaries = { it: itDictionary, en: enDictionary, fr: frDictionary } as const;

  it('la riserva è attiva di default (se cambia, vanno rivisti i testi e LEGAL_VERSION)', () => {
    expect(DEFAULT_FALLBACK_ENABLED).toBe(true);
  });
  it('la Privacy (it/en/fr) dichiara la riserva attiva di default e non dice più il contrario', () => {
    for (const [lang, d] of Object.entries(legalTexts())) {
      expect(d.privacy, `${lang}: manca «${d.on}»`).toContain(d.on);
      for (const stale of d.stale) expect(d.privacy, `${lang}: frase superata «${stale}»`).not.toContain(stale);
    }
  });
  it('anche i Termini (punto 3: costi e limiti) citano la riserva e non dicono che è disattivata di default', () => {
    for (const [lang, d] of Object.entries(legalTexts())) {
      expect(d.terms.toLowerCase(), `${lang}: i Termini non citano la riserva`).toContain(d.term);
      for (const stale of d.stale) expect(d.terms, `${lang}: frase superata «${stale}»`).not.toContain(stale);
    }
  });
  it('le stringhe dell\'interfaccia dicono «attivo di default» e non «disattivato di default / si attiva da solo»', () => {
    const on = { it: 'Attivo di default', en: 'On by default', fr: 'Activé par défaut' } as const;
    const stale = { it: ['Disattivato di default', 'Facoltativo', 'si attiva da solo'], en: ['Off by default', 'Optional.', 'turns it on automatically'], fr: ['Désactivé par défaut', 'Facultatif', 'l\'active automatiquement'] } as const;
    for (const [lang, d] of Object.entries(dictionaries)) {
      const l = lang as keyof typeof dictionaries;
      for (const key of ['settings.fallback.desc', 'settings.fallback.toggleDesc'] as const) {
        expect(d[key], `${lang} ${key}`).toContain(on[l]);
        for (const phrase of stale[l]) expect(d[key], `${lang} ${key}: frase superata «${phrase}»`).not.toContain(phrase);
      }
    }
  });
  it('la data di aggiornamento dei testi legali è una data ISO valida e la versione non è anteriore alla riserva attiva di default', () => {
    expect(LEGAL_LAST_UPDATED_ISO).toMatch(/^\d{4}-\d{2}-\d{2}$/); // compare nei documenti, formattata con Intl
    expect(Number.isNaN(Date.parse(`${LEGAL_LAST_UPDATED_ISO}T12:00:00`))).toBe(false);
    // la riserva attiva di default è stata introdotta con la versione 2026-10-11: una versione anteriore non farebbe riaccettare i nuovi testi
    expect(LEGAL_VERSION >= '2026-10-11').toBe(true);
  });
});

describe('footer su telefono: etichette brevi', () => {
  const dictionaries = { it: itDictionary, en: enDictionary, fr: frDictionary } as const;
  it('ogni lingua ha le tre etichette brevi, non vuote e non più lunghe di quelle complete', () => {
    for (const [lang, d] of Object.entries(dictionaries)) {
      const pairs = [
        [d['footer.termsShort'], d['footer.terms']],
        [d['footer.privacyShort'], d['footer.privacy']],
        [d['footer.aboutShort'], d['footer.about']],
      ];
      for (const [short, full] of pairs) {
        expect(short.trim(), `${lang}: etichetta breve vuota`).not.toBe('');
        expect(short.length, `${lang}: «${short}» più lunga di «${full}»`).toBeLessThanOrEqual(full.length);
      }
    }
  });
  it('le quattro voci del telefono (Guide + 3 brevi) stanno su UNA riga a 320 px: al massimo 40 caratteri in totale', () => {
    // Misurato nel browser: in francese (il caso più largo) 39 caratteri occupano 283 px su 288 disponibili a 320 px di schermo.
    for (const [lang, d] of Object.entries(dictionaries)) {
      const total = [d['footer.guides'], d['footer.termsShort'], d['footer.privacyShort'], d['footer.aboutShort']].join('').length;
      expect(total, `${lang}: etichette troppo lunghe per la riga unica del footer su telefono`).toBeLessThanOrEqual(40);
    }
  });
});

describe('errori: stato HTTP nel testo, segreti, timeout', () => {
  it('un numero qualunque nel testo non è uno stato HTTP (prima "max 500 MB" diventava un 500 ritentabile)', () => {
    expect(inspectError(new Error('File too large: max 500 MB')).status).toBeUndefined();
    expect(inspectError(new Error('connection closed after 503 ms')).status).toBeUndefined();
    expect(classifyError(new Error('File too large: max 500 MB')).kind).toBe('fatal');
  });
  it('un codice HTTP con un contesto credibile viene riconosciuto', () => {
    expect(inspectError(new Error('[429 Too Many Requests] slow down')).status).toBe(429);
    expect(inspectError(new Error('got status: 503 Service Unavailable')).status).toBe(503);
    expect(inspectError(new Error('HTTP/1.1 502 Bad Gateway')).status).toBe(502);
    expect(inspectError(new Error('error code 404')).status).toBe(404);
    expect(inspectError(new Error('{"status": 500, "x": 1}')).status).toBe(500);
  });
  it('redactSecrets toglie chiavi Google e parametri key= da qualunque testo', () => {
    const key = 'AIzaSyD-1234567890abcdefghijklmnopqrstu'; // chiave finta
    expect(redactSecrets(`https://x.googleapis.com/v1/files?key=${key}&alt=json`)).not.toContain(key);
    expect(redactSecrets(`Invalid key ${key} supplied`)).not.toContain('AIza');
    expect(redactSecrets('x-goog-api-key: segretissimo123')).not.toContain('segretissimo123');
    expect(redactSecrets('nessun segreto qui')).toBe('nessun segreto qui');
    expect(inspectError(new Error(`Bad request key=${key}`)).message).not.toContain(key);
    expect(normalizeError(new Error(`Strano errore ${key}`)).message).not.toContain(key);
  });
  it('il timeout è un guasto di rete ritentabile con un messaggio suo (non un annullamento)', () => {
    const failure = classifyError(new RequestTimeoutError());
    expect(failure.kind).toBe('network');
    expect(failure.timedOut).toBe(true);
    const e = normalizeError(new RequestTimeoutError());
    expect(e).not.toBeInstanceOf(CancelledError);
    expect(e.message).toBe('error.timeout'); // t() senza dizionario restituisce la chiave
  });
});

describe('rate limit: timeout, annullamento e code', () => {
  let previous: ReturnType<typeof configureRateLimit>;
  beforeAll(() => {
    previous = configureRateLimit({ gapMs: 0, backoffScale: 0.002 }); // niente attese vere nei test
  });
  afterAll(() => {
    configureRateLimit(previous);
    resetRateLimitState();
  });

  it('il timeout interrompe il tentativo (segnale abortito) e ritenta', async () => {
    let calls = 0;
    let sawAbort = false;
    const out = await withRetry(
      async (signal) => {
        calls++;
        if (calls === 1) {
          signal.addEventListener('abort', () => (sawAbort = true));
          await new Promise(() => undefined); // non risponde mai
        }
        return 'ok';
      },
      undefined,
      undefined,
      { scope: 'rl-timeout', timeoutMs: 30 }
    );
    expect(out).toBe('ok');
    expect(calls).toBe(2);
    expect(sawAbort).toBe(true);
  });

  it('dopo troppi timeout l\'errore ha il messaggio dedicato e non è un annullamento', async () => {
    let calls = 0;
    const p = withRetry(() => { calls++; return new Promise<never>(() => undefined); }, undefined, undefined, { scope: 'rl-timeout2', timeoutMs: 20, maxAttempts: 2 });
    await expect(p).rejects.toMatchObject({ message: 'error.timeout' });
    expect(calls).toBe(2);
  });

  it('annullare chiude subito anche una chiamata che ignora il segnale', async () => {
    const controller = new AbortController();
    const started = Date.now();
    const p = withRetry(() => new Promise<never>(() => undefined), controller.signal, undefined, { scope: 'rl-cancel' });
    setTimeout(() => controller.abort(), 20);
    await expect(p).rejects.toBeInstanceOf(CancelledError);
    expect(Date.now() - started).toBeLessThan(500);
  });

  it('il segnale ricevuto dalla funzione si attiva anche quando annulla l\'utente', async () => {
    let attemptSignal: AbortSignal | undefined;
    const controller = new AbortController();
    const p = withRetry((s) => { attemptSignal = s; return new Promise<never>(() => undefined); }, controller.signal, undefined, { scope: 'rl-cancel2' });
    await new Promise((r) => setTimeout(r, 15));
    controller.abort();
    await p.catch(() => undefined);
    expect(attemptSignal?.aborted).toBe(true);
  });

  it('un 5xx viene ritentato fino al successo; un errore fatale no', async () => {
    let n = 0;
    const value = await withRetry(async () => { n++; if (n < 3) throw { status: 503, message: 'overloaded' }; return 7; }, undefined, undefined, { scope: 'rl-retry' });
    expect(value).toBe(7);
    expect(n).toBe(3);
    let m = 0;
    await expect(withRetry(async () => { m++; throw { status: 400, message: 'bad request' }; }, undefined, undefined, { scope: 'rl-retry' })).rejects.toBeInstanceOf(UserFacingError);
    expect(m).toBe(1);
  });

  it('chi aspetta il cooldown del proprio modello non blocca le richieste di un altro ambito', async () => {
    startCooldown('rl-lento', 3000); // > 1 s: la richiesta attende (con countdown)
    const controller = new AbortController();
    const slow = withRetry(async () => 'lento', controller.signal, undefined, { scope: 'rl-lento' });
    const t0 = Date.now();
    const fast = await withRetry(async () => 'veloce', undefined, undefined, { scope: 'rl-libero' });
    expect(fast).toBe('veloce');
    expect(Date.now() - t0).toBeLessThan(1000); // col vecchio codice qui si aspettavano ~3 s
    controller.abort();
    await expect(slow).rejects.toBeInstanceOf(CancelledError);
  });

  it('le richieste simultanee partono distanziate di gapMs', async () => {
    const before = configureRateLimit({ gapMs: 60 });
    try {
      const starts: number[] = [];
      await Promise.all([1, 2, 3].map(() => withRetry(async () => { starts.push(Date.now()); }, undefined, undefined, { scope: 'rl-gap' })));
      expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(50);
      expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(50);
    } finally {
      configureRateLimit(before);
    }
  });
});


// ---------------------------------------------------------------------------------------------------------------------
// Dati degli appunti: validazione in lettura, vecchio formato localStorage, riparazione dell'albero
// ---------------------------------------------------------------------------------------------------------------------

describe('appunti e cartelle: normalizzazione dei record letti dal DB', () => {
  const validNote = { id: 'n1', title: 'Biologia', content: '# Cellula', contentType: 'markdown', emoji: '🧠', color: 'bg-red-100', folderId: 'f1', createdAt: '2026-01-02T10:00:00.000Z', order: 5 };
  it('un record valido passa invariato (nessun campo perso)', () => {
    expect(normalizeNote(validNote)).toEqual(validNote);
  });
  it('un record senza id o non-oggetto è inutilizzabile (null), senza lanciare', () => {
    expect(normalizeNote(null)).toBeNull();
    expect(normalizeNote('testo')).toBeNull();
    expect(normalizeNote([1, 2])).toBeNull();
    expect(normalizeNote({ title: 'senza id' })).toBeNull();
    expect(normalizeNote({ id: '' })).toBeNull();
    expect(normalizeFolder({ name: 'senza id' })).toBeNull();
  });
  it('campi mancanti o di tipo sbagliato vengono sostituiti, non propagati (prima rompevano l\'ordinamento e la UI)', () => {
    const n = normalizeNote({ id: 'x', title: 42, content: undefined, createdAt: 'non una data', folderId: 7, order: 'alto', contentType: 'pdf' })!;
    expect(typeof n.title).toBe('string');
    expect(n.content).toBe('');
    expect(Number.isFinite(Date.parse(n.createdAt))).toBe(true);
    expect(n.folderId).toBeNull();
    expect(n.order).toBeUndefined();
    expect(n.contentType).toBeUndefined();
    expect(() => n.createdAt.localeCompare('2026')).not.toThrow(); // è ciò che fa ItemsGrid per ordinare
  });
  it('cartella senza parentId (dati vecchi) → radice; il vecchio tabColor non viene riportato', () => {
    const f = normalizeFolder({ id: 'f', name: 'Storia', emoji: '📜', color: 'bg-blue-100', createdAt: '2025-05-05T00:00:00.000Z', tabColor: 'x' })!;
    expect(f.parentId).toBeNull();
    expect('tabColor' in f).toBe(false);
  });
  it('quiz e mappa malformati vengono resi null; quelli validi restano uguali (idempotenza del validatore)', () => {
    const quiz = { title: 'Q', questions: [{ questionText: 'a?', options: ['x', 'y'], correctAnswer: 'x', explanation: 'perché' }] };
    expect(normalizeNote({ ...validNote, quizData: quiz })!.quizData).toEqual(quiz);
    expect(normalizeNote({ ...validNote, quizData: { title: 'Q', questions: 'no' } })!.quizData).toBeNull();
    expect(normalizeNote({ ...validNote, mapData: 123 })!.mapData).toBeNull();
    const clean = sanitizeQuiz(quiz)!;
    expect(sanitizeQuiz(clean)).toEqual(clean);
  });
  it('normalizeAll isola i record cattivi e conta gli scartati', () => {
    const r = normalizeAll([validNote, null, { title: 'x' }, { id: 'n2' }], [{ id: 'f1', name: 'A' }, 'rotto']);
    expect(r.notes.map((n) => n.id)).toEqual(['n1', 'n2']);
    expect(r.folders.map((f) => f.id)).toEqual(['f1']);
    expect(r.skipped).toBe(3);
  });
});

describe('vecchio formato localStorage ("studia_data")', () => {
  it('legge appunti e cartelle; JSON illeggibile o di forma diversa → null (non si cancella ciò che non si capisce)', () => {
    const json = JSON.stringify({ notes: [{ id: 'a', title: 'A', content: 'c', emoji: '📚', color: 'bg-red-100', folderId: null, createdAt: '2025-01-01T00:00:00.000Z' }], folders: [{ id: 'f', name: 'F', emoji: '📚', color: 'bg-red-100', createdAt: '2025-01-01T00:00:00.000Z', tabColor: 'x' }] });
    const parsed = parseLegacyData(json)!;
    expect(parsed.notes).toHaveLength(1);
    expect(parsed.folders[0].parentId).toBeNull();
    expect(parseLegacyData('{non json')).toBeNull();
    expect(parseLegacyData('{"notes":[]}')).toBeNull();
    expect(parseLegacyData('[]')).toBeNull();
    expect(parseLegacyData('null')).toBeNull();
  });
});

describe('riparazione dell\'albero cartelle (mai cancellare, mai nascondere)', () => {
  const folder = (id: string, parentId: string | null): Folder => ({ id, name: id, emoji: '📚', color: 'bg-red-100', createdAt: '2026-01-01T00:00:00.000Z', parentId });
  const note = (id: string, folderId: string | null): Note => ({ id, title: id, content: '', emoji: '📚', color: 'bg-red-100', folderId, createdAt: '2026-01-01T00:00:00.000Z' });

  it('un albero sano non cambia', () => {
    const r = repairTree([note('n', 'b')], [folder('a', null), folder('b', 'a')]);
    expect(r.changedFolders).toHaveLength(0);
    expect(r.changedNotes).toHaveLength(0);
  });
  it('cartella con genitore inesistente o genitore di se stessa → radice', () => {
    const r = repairTree([], [folder('a', 'fantasma'), folder('b', 'b')]);
    expect(r.folders.find((f) => f.id === 'a')!.parentId).toBeNull();
    expect(r.folders.find((f) => f.id === 'b')!.parentId).toBeNull();
    expect(r.changedFolders.map((f) => f.id).sort()).toEqual(['a', 'b']);
  });
  it('un ciclo A↔B viene spezzato in un punto e tutto resta raggiungibile dalla radice', () => {
    const r = repairTree([], [folder('a', 'b'), folder('b', 'a')]);
    const byId = new Map(r.folders.map((f) => [f.id, f]));
    const reachesRoot = (id: string): boolean => { const seen = new Set<string>(); let c: string | null = id; while (c !== null) { if (seen.has(c)) return false; seen.add(c); c = byId.get(c)!.parentId; } return true; };
    expect(reachesRoot('a')).toBe(true);
    expect(reachesRoot('b')).toBe(true);
    expect(r.changedFolders).toHaveLength(1);
  });
  it('ciclo con una coda (C → A → B → A): si spezza il ciclo, C resta appesa dove è', () => {
    const r = repairTree([], [folder('c', 'a'), folder('a', 'b'), folder('b', 'a')]);
    expect(r.folders.find((f) => f.id === 'c')!.parentId).toBe('a');
    expect(r.changedFolders).toHaveLength(1);
  });
  it('un appunto in una cartella inesistente torna alla radice', () => {
    const r = repairTree([note('n', 'sparita'), note('m', null)], [folder('a', null)]);
    expect(r.notes.find((n) => n.id === 'n')!.folderId).toBeNull();
    expect(r.changedNotes.map((n) => n.id)).toEqual(['n']);
  });
});

describe('errori di salvataggio: classificazione per il messaggio all\'utente', () => {
  it('spazio esaurito (varie forme dei browser), archiviazione non disponibile, altro', () => {
    expect(classifyStorageError({ name: 'QuotaExceededError' })).toBe('quota');
    expect(classifyStorageError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })).toBe('quota');
    expect(classifyStorageError({ code: 22 })).toBe('quota');
    expect(classifyStorageError({ name: 'SecurityError' })).toBe('unavailable');
    expect(classifyStorageError({ name: 'InvalidStateError' })).toBe('unavailable');
    expect(classifyStorageError(new Error('boh'))).toBe('write');
    expect(classifyStorageError(undefined)).toBe('write');
    expect(classifyStorageError('stringa')).toBe('write');
  });
});


// ---------------------------------------------------------------------------------------------------------------------
// Chiave API: "ricorda su questo dispositivo" oppure solo per la sessione
// ---------------------------------------------------------------------------------------------------------------------

describe('chiave API: localStorage (ricordata) o sessionStorage (solo sessione)', () => {
  const fake = (failWrites = false): SimpleStorage & { data: Map<string, string> } => {
    const data = new Map<string, string>();
    return { data, get: (k) => data.get(k) ?? null, set: (k, v) => { if (failWrites) return false; data.set(k, v); return true; }, remove: (k) => void data.delete(k) };
  };
  const KEY = 'AIzaSyFAKE-fake-fake-fake-fake-fake-fake01';

  it('di predefinito nessuna chiave e "ricorda" attivo (comportamento storico invariato)', () => {
    expect(readApiKey({ local: fake(), session: fake() })).toEqual({ key: null, remember: true });
  });
  it('ricorda: la chiave sta solo in localStorage, nessun flag aggiunto', () => {
    const stores = { local: fake(), session: fake() };
    expect(saveApiKey(stores, `  ${KEY}  `, true)).toBe(true);
    expect(stores.local.data.get(STORAGE_KEYS.apiKey)).toBe(KEY); // trim
    expect(stores.session.data.size).toBe(0);
    expect(stores.local.data.has(STORAGE_KEYS.apiKeySessionOnly)).toBe(false);
    expect(readApiKey(stores)).toEqual({ key: KEY, remember: true });
  });
  it('solo sessione: la chiave NON finisce in localStorage (nemmeno se c\'era già), solo la preferenza', () => {
    const stores = { local: fake(), session: fake() };
    stores.local.set(STORAGE_KEYS.apiKey, 'vecchia-chiave-persistita');
    expect(saveApiKey(stores, KEY, false)).toBe(true);
    expect(stores.local.data.has(STORAGE_KEYS.apiKey)).toBe(false);
    expect([...stores.local.data.values()].some((v) => v.includes('AIza') || v.includes('vecchia'))).toBe(false);
    expect(stores.session.data.get(STORAGE_KEYS.apiKey)).toBe(KEY);
    expect(readApiKey(stores)).toEqual({ key: KEY, remember: false });
  });
  it('solo sessione dopo il riavvio del browser: la chiave non c\'è più, la preferenza resta', () => {
    const local = fake();
    saveApiKey({ local, session: fake() }, KEY, false);
    expect(readApiKey({ local, session: fake() /* sessionStorage nuovo */ })).toEqual({ key: null, remember: false });
  });
  it('una copia rimasta in localStorage (scheda con versione vecchia) viene spostata in sessionStorage', () => {
    const stores = { local: fake(), session: fake() };
    stores.local.set(STORAGE_KEYS.apiKeySessionOnly, '1');
    stores.local.set(STORAGE_KEYS.apiKey, KEY);
    expect(readApiKey(stores)).toEqual({ key: KEY, remember: false });
    expect(stores.local.data.has(STORAGE_KEYS.apiKey)).toBe(false);
  });
  it('cambiare scelta sposta la chiave senza reinserirla; senza chiave registra solo la preferenza', () => {
    const stores = { local: fake(), session: fake() };
    saveApiKey(stores, KEY, true);
    expect(moveApiKey(stores, KEY, false)).toBe(true);
    expect(readApiKey(stores)).toEqual({ key: KEY, remember: false });
    expect(moveApiKey(stores, KEY, true)).toBe(true);
    expect(readApiKey(stores)).toEqual({ key: KEY, remember: true });
    expect(stores.session.data.size).toBe(0);
    const empty = { local: fake(), session: fake() };
    moveApiKey(empty, null, false);
    expect(readApiKey(empty)).toEqual({ key: null, remember: false });
  });
  it('rimuovere la chiave la toglie da entrambi i posti ma non cambia la preferenza', () => {
    const stores = { local: fake(), session: fake() };
    saveApiKey(stores, KEY, false);
    removeApiKey(stores);
    expect(readApiKey(stores)).toEqual({ key: null, remember: false });
  });
  it('se la scrittura in localStorage fallisce (spazio pieno) si segnala false e la copia di sessione non viene persa', () => {
    const stores = { local: fake(true), session: fake() };
    stores.session.set(STORAGE_KEYS.apiKey, KEY);
    expect(saveApiKey(stores, KEY, true)).toBe(false);
    expect(stores.session.data.get(STORAGE_KEYS.apiKey)).toBe(KEY);
  });
});


// ---------------------------------------------------------------------------------------------------------------------
// Importazione di file e cartelle
// ---------------------------------------------------------------------------------------------------------------------

describe('importazione: classificazione dei file', () => {
  it('estensione, tipo e titolo', () => {
    expect(extensionOf('Appunti.MD')).toBe('md');
    expect(extensionOf('.gitignore')).toBe('');
    expect(extensionOf('senza-estensione')).toBe('');
    expect(classifyImportFile('a.md')).toBe('markdown');
    expect(classifyImportFile('a.TXT')).toBe('markdown');
    expect(classifyImportFile('a.json')).toBe('markdown');
    expect(classifyImportFile('a.markdown')).toBe('markdown');
    expect(classifyImportFile('a.html')).toBe('html');
    expect(classifyImportFile('a.HTM')).toBe('html');
    expect(classifyImportFile('foto.png')).toBeNull();
    expect(classifyImportFile('doc.pdf')).toBeNull();
    expect(titleFromFileName('Storia.antica.md')).toBe('Storia.antica');
    expect(titleFromFileName('pagina.html')).toBe('pagina');
    expect(titleFromFileName('versione.v2')).toBe('versione.v2'); // estensione non importabile: resta nel titolo
  });
  it('file e cartelle nascosti o di sistema vengono ignorati', () => {
    expect(isIgnoredPath('.DS_Store')).toBe(true);
    expect(isIgnoredPath('Materie/.git/config')).toBe(true);
    expect(isIgnoredPath('__MACOSX/Materie/._a.md')).toBe(true);
    expect(isIgnoredPath('Materie/Thumbs.db')).toBe(true);
    expect(isIgnoredPath('Progetto/node_modules/lodash/README.md')).toBe(true);
    expect(isIgnoredPath('Progetto/Node_Modules/x.md')).toBe(true);
    expect(isIgnoredPath('Materie\\.git\\config')).toBe(true); // separatore Windows
    expect(isIgnoredPath('Materie/node_modules_note.md')).toBe(false); // solo il nome esatto della cartella
    expect(isIgnoredPath('Materie/storia.md')).toBe(false);
    expect(isIgnoredPath('a.md')).toBe(false);
  });
  it('summarizeNames mostra i primi e conta gli altri', () => {
    expect(summarizeNames(['a', 'b'])).toEqual({ shown: 'a, b', others: 0 });
    expect(summarizeNames(['a', 'b', 'c', 'd', 'e'])).toEqual({ shown: 'a, b, c', others: 2 });
  });
});

describe('importazione: lettura dei file', () => {
  const f = (name: string, size = 10, webkitRelativePath = '') => ({ name, size, webkitRelativePath });
  const readOk = async (file: { name: string }) => `contenuto di ${file.name}`;

  it('cartella: solo formati supportati, niente file di sistema, percorso ricostruito, ordine naturale dei nomi', async () => {
    const r = await readImportFiles(
      [f('capitolo10.md', 10, 'Corso/capitolo10.md'), f('foto.png', 10, 'Corso/img/foto.png'), f('.DS_Store', 10, 'Corso/.DS_Store'), f('capitolo2.md', 10, 'Corso/capitolo2.md'), f('pagina.html', 10, 'Corso/web/pagina.html')],
      { accept: ['html', 'markdown'], reportUnsupported: false, maxBytes: 100, read: readOk, sortByPath: true }
    );
    expect(r.problems).toEqual([]); // le immagini in una cartella non sono un problema: si saltano
    expect(r.notes.map((n) => n.file.name)).toEqual(['capitolo2.md', 'capitolo10.md', 'pagina.html']); // 2 prima di 10
    expect(r.notes[0].dirParts).toEqual(['Corso']);
    expect(r.notes[2].dirParts).toEqual(['Corso', 'web']);
    expect(r.notes[2].contentType).toBe('html');
    expect(r.notes[0].title).toBe('capitolo2');
  });
  it('selettore di file: il formato non supportato è un problema da riportare e gli altri file vengono importati', async () => {
    const r = await readImportFiles([f('ok.md'), f('foto.png'), f('altro.txt')], { accept: ['markdown'], reportUnsupported: true, maxBytes: 100, read: readOk });
    expect(r.notes.map((n) => n.file.name)).toEqual(['ok.md', 'altro.txt']); // ordine di selezione conservato
    expect(r.problems).toEqual(['foto.png']);
  });
  it('un file troppo grande o illeggibile non ferma gli altri e finisce nell\'elenco dei problemi', async () => {
    const read = async (file: { name: string }) => { if (file.name === 'rotto.md') throw new Error('lettura fallita'); return 'x'; };
    const r = await readImportFiles([f('a.md'), f('enorme.md', 1000), f('rotto.md'), f('b.md')], { accept: ['markdown'], reportUnsupported: true, maxBytes: 100, read });
    expect(r.notes.map((n) => n.file.name)).toEqual(['a.md', 'b.md']);
    expect(r.problems).toEqual(['enorme.md', 'rotto.md']);
  });
  it('ordine naturale dei percorsi: identico a localeCompare con numeric/base (2 prima di 10, maiuscole e accenti ignorati)', async () => {
    const paths = [
      'Corso/sezione-10/nota-2.md', 'Corso/sezione-2/nota-10.md', 'Corso/sezione-2/nota-9.md', 'corso/Sezione-1/Nota-1.md',
      'Corso/sezione-2/nota-1.md', 'Corso/Éra/a.md', 'Corso/era/b.md', 'Corso/Zeta/a.md', 'Corso/alfa/a.md', 'Corso/alfa/A.md',
      'Corso/file2.md', 'Corso/file10.md', 'Corso/file1.md', 'Corso/File 3.md', 'Corso/file-20.md',
    ];
    const files = paths.map((p) => f(p.slice(p.lastIndexOf('/') + 1), 10, p));
    const expected = [...paths].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    const r = await readImportFiles(files, { accept: ['markdown'], reportUnsupported: false, maxBytes: 100, read: readOk, sortByPath: true });
    expect(r.notes.map((n) => (n.file as { webkitRelativePath: string }).webkitRelativePath)).toEqual(expected);
    const names = r.notes.map((n) => n.file.name);
    expect(names.indexOf('file2.md')).toBeLessThan(names.indexOf('file10.md'));
    expect(names.indexOf('file1.md')).toBeLessThan(names.indexOf('file2.md'));
  });
  it('file singoli: nessuna cartella (dirParts vuoto)', async () => {
    const r = await readImportFiles([f('a.md')], { accept: ['markdown'], reportUnsupported: true, maxBytes: 100, read: readOk });
    expect(r.notes[0].dirParts).toEqual([]);
  });
  it('una selezione vuota o fatta solo di file di sistema non produce nulla', async () => {
    expect((await readImportFiles([], { accept: ['markdown'], reportUnsupported: true, maxBytes: 1, read: readOk })).notes).toEqual([]);
    const r = await readImportFiles([f('.DS_Store')], { accept: ['markdown'], reportUnsupported: true, maxBytes: 1, read: readOk });
    expect(r.notes).toEqual([]);
    expect(r.problems).toEqual([]);
  });
});


// ---------------------------------------------------------------------------------------------------------------------
// Sanificazione del CSS delle note HTML (le prove con un browser vero sono in tools/browser-checks/sanitize-check.mjs)
// ---------------------------------------------------------------------------------------------------------------------

describe('CSS delle note HTML: escape, image-set e risorse remote', () => {
  it('decodeCssEscapes decodifica le escape esadecimali e di carattere fuori da stringhe e commenti', () => {
    expect(decodeCssEscapes('\\75rl(x)')).toBe('url(x)');
    expect(decodeCssEscapes('\\75 rl(x)')).toBe('url(x)'); // lo spazio dopo l'escape è un terminatore, non fa parte del testo
    expect(decodeCssEscapes('@\\69mport')).toBe('@import');
    expect(decodeCssEscapes('u\\rl(x)')).toBe('url(x)');
    expect(decodeCssEscapes('\\000075rl(x)')).toBe('url(x)');
    expect(decodeCssEscapes('a{content:"\\75rl("}')).toBe('a{content:"\\75rl("}'); // dentro una stringa resta com'è
    expect(decodeCssEscapes('/* \\75rl( */a{}')).toBe('/* \\75rl( */a{}'); // e nei commenti
    expect(decodeCssEscapes('\\0 x')).toBe('\ufffdx'); // punto di codice nullo → carattere di sostituzione
    expect(decodeCssEscapes('\\110000 x')).toBe('\ufffdx'); // oltre U+10FFFF
  });

  it('toglie @import, url() e image-set() remoti, anche scritti con escape', () => {
    const remote = 'http://evil.example/x.png';
    const bad = [
      `@import url(${remote});`,
      `@import '${remote}';`,
      `@\\69mport '${remote}';`,
      `@\\000069mport '${remote}';`,
      `a{background:url(${remote})}`,
      `a{background:\\75rl(${remote})}`,
      `a{background:u\\72l(${remote})}`,
      `a{background:URL( "${remote}" )}`,
      `a{background:image-set("${remote}" 1x)}`,
      `a{background:-webkit-image-set('${remote}' 1x)}`,
      `a{background:\\69mage-set("${remote}" 1x)}`,
      `a{content:src("${remote}")}`,
      `a{background:cross-fade(url(${remote}), red)}`,
    ];
    for (const css of bad) {
      const out = sanitizeCss(css);
      expect(decodeCssEscapes(out).includes('evil.example') && /(@import|url\s*\(|image-set\s*\(|(?<![\w-])src\s*\(|cross-fade\s*\()/i.test(decodeCssEscapes(out))).toBe(false);
    }
  });

  it('neutralizza expression(), behavior e -moz-binding', () => {
    expect(sanitizeCss('a{width:expression(alert(1))}')).not.toMatch(/expression\s*\(/i);
    expect(sanitizeCss('a{behavior:url(x.htc)}')).not.toMatch(/behavior/i);
    expect(sanitizeCss('a{-moz-binding:url(x)}')).not.toMatch(/binding/i);
    expect(sanitizeCss('a{width:\\65xpression(alert(1))}')).not.toMatch(/expression\s*\(/i);
  });

  it('il CSS legittimo resta IDENTICO (compresi data:image e selettori con escape)', () => {
    const ok = [
      'body{font-family:Arial,sans-serif;background:#f5f5f5;color:#222}h1{border-bottom:2px solid #c00}',
      'div{background:url(data:image/png;base64,iVBORw0KGgo=)}',
      '.md\\:flex{display:flex}.w-1\\/2{width:50%}',
      'a{content:"\\201C";font-family:"Segoe UI",system-ui}',
      '@media (max-width:600px){.card{padding:8px}}',
      'table{border-collapse:collapse}td,th{border:1px solid #999;padding:4px 8px}',
    ];
    for (const css of ok) expect(sanitizeCss(css)).toBe(css);
  });
});


// ---------------------------------------------------------------------------------------------------------------------
// Export ZIP e nomi di file
// ---------------------------------------------------------------------------------------------------------------------

describe('nomi di file', () => {
  it('mantiene lettere accentate e altri alfabeti (prima diventavano "_")', () => {
    expect(sanitizeFilename('Città e perché')).toBe('Città_e_perché');
    expect(sanitizeFilename('日本語のノート')).toBe('日本語のノート');
  });
  it('sostituisce i caratteri vietati e gli spazi, come prima per l\'ASCII', () => {
    expect(sanitizeFilename('a/b\\c:d*e?"f<g>h|i')).toBe('a_b_c_d_e__f_g_h_i');
    expect(sanitizeFilename('Storia: l\'arte')).toBe('Storia__l_arte');
  });
  it('i punti iniziali e finali non producono percorsi né nomi nascosti', () => {
    expect(sanitizeFilename('..')).toBe('note');
    expect(sanitizeFilename('../../etc/passwd')).not.toContain('/');
    expect(sanitizeFilename('.nascosto')).toBe('nascosto');
    expect(sanitizeFilename('fine...')).toBe('fine');
  });
  it('titolo vuoto o senza lettere → nome di ripiego', () => {
    expect(sanitizeFilename('')).toBe('note');
    expect(sanitizeFilename('📚')).toBe('note');
    expect(sanitizeFilename('???', 'folder')).toBe('folder');
  });
  it('evita i nomi riservati di Windows e limita la lunghezza', () => {
    expect(sanitizeFilename('CON')).toBe('_CON');
    expect(sanitizeFilename('com1')).toBe('_com1');
    expect(Array.from(sanitizeFilename('x'.repeat(500)))).toHaveLength(100);
  });
  it('non spezza le coppie surrogate quando tronca', () => {
    const out = sanitizeFilename('a'.repeat(99) + '𠮷𠮷');
    expect(out.includes('\ud842') && !out.includes('𠮷')).toBe(false); // nessuna metà di carattere
  });
});

describe('export di una cartella', () => {
  const note = (id: string, title: string, folderId: string | null, contentType: Note['contentType'] = 'markdown'): Note => ({
    id, title, content: `# ${title}`, contentType, emoji: '💡', color: 'bg-red-100', folderId, createdAt: '2026-01-01T00:00:00.000Z',
  });
  const folder = (id: string, name: string, parentId: string | null): Folder => ({
    id, name, emoji: '📚', color: 'bg-red-100', createdAt: '2026-01-01T00:00:00.000Z', parentId,
  });

  it('nomi duplicati: (1), (2), senza distinguere maiuscole e minuscole', () => {
    const used = new Set<string>();
    expect(uniqueName('Note', '.md', used)).toBe('Note.md');
    expect(uniqueName('note', '.md', used)).toBe('note (1).md');
    expect(uniqueName('Note', '.md', used)).toBe('Note (2).md');
    expect(uniqueName('Note', '.html', used)).toBe('Note.html');
  });
  it('percorsi annidati, estensione per tipo, cartelle vuote incluse', () => {
    const plan = planFolderExport(
      'root',
      [note('1', 'Intro', 'root'), note('2', 'Pagina', 'sub', 'html'), note('3', 'Fuori', null)],
      [folder('root', 'Corso', null), folder('sub', 'Capitolo 1', 'root'), folder('vuota', 'Vuota', 'root')]
    );
    expect(plan.files.map((f) => f.path)).toEqual(['Intro.md', 'Capitolo_1/Pagina.html']);
    expect(plan.dirs).toEqual(['Capitolo_1/', 'Vuota/']);
  });
  it('una cartella e una nota con lo stesso nome non si sovrappongono', () => {
    const plan = planFolderExport('root', [note('1', 'Prova', 'root')], [folder('root', 'R', null), folder('s', 'prova.md', 'root')]);
    const names = [...plan.files.map((f) => f.path), ...plan.dirs].map((p) => p.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });
  it('un ciclo tra cartelle (A dentro B, B dentro A) non manda in loop', () => {
    const plan = planFolderExport('a', [note('1', 'x', 'b')], [folder('a', 'A', 'b'), folder('b', 'B', 'a')]);
    expect(plan.files.map((f) => f.path)).toEqual(['B/x.md']);
  });
  it('cartella radice inesistente → piano vuoto', () => {
    expect(planFolderExport('zzz', [note('1', 'x', null)], [])).toEqual({ files: [], dirs: [] });
  });
});

describe('i18n: formattatori Intl riusati (stesso output di prima)', () => {
  const when = '2026-03-05T10:20:30Z';
  const optionSets: Array<Intl.DateTimeFormatOptions | undefined> = [undefined, { dateStyle: 'long' }, { month: 'short', day: 'numeric' }];

  it('formatDate: identico a un Intl.DateTimeFormat nuovo, per lingua e per opzioni', async () => {
    for (const lang of ['it', 'en', 'fr'] as const) {
      await activateLanguage(lang);
      for (const options of optionSets) {
        const expected = new Intl.DateTimeFormat(lang, options ?? { dateStyle: 'medium' }).format(new Date(when));
        expect(options === undefined ? formatDate(when) : formatDate(when, options)).toBe(expected);
        expect(options === undefined ? formatDate(new Date(when)) : formatDate(new Date(when), options)).toBe(expected);
      }
    }
  });
  it('formatDate: data non valida → stringa vuota', async () => {
    await activateLanguage('it');
    expect(formatDate('non è una data')).toBe('');
    expect(formatDate(Number.NaN)).toBe('');
    expect(formatDate(new Date('x'))).toBe('');
  });
  it('formatDate: il cambio lingua dopo l\'uso cambia l\'output (la cache non fissa il locale)', async () => {
    await activateLanguage('it');
    const it1 = formatDate(when);
    await activateLanguage('en');
    const en1 = formatDate(when);
    await activateLanguage('it');
    expect(it1).toBe(new Intl.DateTimeFormat('it', { dateStyle: 'medium' }).format(new Date(when)));
    expect(en1).toBe(new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(when)));
    expect(formatDate(when)).toBe(it1);
    expect(it1).not.toBe(en1);
  });
  it('formatNumber: identico a un Intl.NumberFormat nuovo', async () => {
    for (const lang of ['it', 'en', 'fr'] as const) {
      await activateLanguage(lang);
      for (const options of [undefined, { maximumFractionDigits: 0 }, { maximumFractionDigits: 2 }] as const) {
        for (const value of [0, 1234.567, -5, 1e6]) {
          expect(formatNumber(value, options)).toBe(new Intl.NumberFormat(lang, options).format(value));
        }
      }
    }
  });
  it('tp: plurale in base alla lingua attiva', async () => {
    await activateLanguage('it');
    expect(tp('files.othersMore', 1)).toBe(itDictionary['files.othersMore_one']);
    expect(tp('files.othersMore', 3)).toBe(itDictionary['files.othersMore_other'].replace('{count}', '3'));
    await activateLanguage('en');
    expect(tp('files.othersMore', 1)).toBe(enDictionary['files.othersMore_one']);
    expect(tp('files.othersMore', 0)).toBe(enDictionary['files.othersMore_other'].replace('{count}', '0'));
    await activateLanguage('fr');
    expect(tp('files.othersMore', 1)).toBe(frDictionary['files.othersMore_one']);
    expect(tp('files.othersMore', 5)).toBe(frDictionary['files.othersMore_other'].replace('{count}', '5'));
  });
  it('il formattatore viene costruito una volta sola per le stesse opzioni; la cache ha un tetto', async () => {
    await activateLanguage('it');
    const RealDateTimeFormat = Intl.DateTimeFormat;
    let built = 0;
    const Counting = function (this: unknown, ...args: ConstructorParameters<typeof Intl.DateTimeFormat>) {
      built++;
      return new RealDateTimeFormat(...args);
    } as unknown as typeof Intl.DateTimeFormat;
    (Intl as { DateTimeFormat: typeof Intl.DateTimeFormat }).DateTimeFormat = Counting;
    try {
      for (let i = 0; i < 100; i++) formatDate(when, { dateStyle: 'full' });
      expect(built).toBe(1);
      // Opzioni sempre diverse (chiave distinta per ognuna): oltre il tetto di 50 voci nessun errore e output corretto.
      for (let i = 0; i < 120; i++) {
        const options = { dateStyle: 'short', timeZone: 'UTC', [`extra${i}`]: i } as Intl.DateTimeFormatOptions;
        expect(formatDate(when, options)).toBe(new RealDateTimeFormat('it', options).format(new Date(when)));
      }
      expect(built).toBeGreaterThanOrEqual(121);
    } finally {
      (Intl as { DateTimeFormat: typeof Intl.DateTimeFormat }).DateTimeFormat = RealDateTimeFormat;
    }
  });
});

describe('registro dei moduli caricati in lazy (precarico dei testi legali)', () => {
  it('una sola promessa per chiave finché è in corso; dopo, lettura sincrona con peek', async () => {
    let calls = 0;
    let finish!: (value: { n: number }) => void;
    const registry = createModuleRegistry<'a' | 'b', { n: number }>({
      a: () => { calls++; return new Promise((resolve) => { finish = resolve; }); },
      b: async () => ({ n: 2 }),
    });
    expect(registry.peek('a')).toBeUndefined();
    const p1 = registry.load('a');
    const p2 = registry.load('a');
    expect(p2).toBe(p1); // identità stabile: serve a use() di React
    expect(calls).toBe(1);
    expect(registry.peek('a')).toBeUndefined(); // ancora in corso
    const mod = { n: 1 };
    finish(mod);
    expect(await p1).toBe(mod);
    expect(registry.peek('a')).toBe(mod);
    expect(await registry.load('a')).toBe(mod);
    expect(calls).toBe(1); // nessun secondo caricamento
    expect(registry.peek('b')).toBeUndefined(); // le chiavi sono indipendenti
  });
  it('se il caricamento fallisce la promessa viene scartata e il tentativo successivo riparte', async () => {
    let calls = 0;
    const registry = createModuleRegistry<'x', { ok: boolean }>({
      x: async () => { calls++; if (calls === 1) throw new Error('rete assente'); return { ok: true }; },
    });
    await expect(registry.load('x')).rejects.toBeInstanceOf(Error);
    expect(registry.peek('x')).toBeUndefined();
    expect(await registry.load('x')).toEqual({ ok: true });
    expect(calls).toBe(2);
    expect(registry.peek('x')).toEqual({ ok: true });
  });
});

describe('testi legali: nessun fallback quando il testo è già stato precaricato', () => {
  const render = (Doc: typeof LegalTerms) => renderToStaticMarkup(createElement(I18nProvider, null, createElement(Doc)));
  it('prima del precarico compare il fallback; dopo il precarico il documento è disegnato subito, senza fallback', async () => {
    await activateLanguage('fr'); // lingua non ancora precaricata dal registro in questo file di test
    const before = render(LegalTerms);
    expect(before).toContain(frDictionary['legal.loading']);
    expect(before).not.toContain('Conditions');
    await preloadLegal('fr');
    const expected = renderToStaticMarkup(createElement(TermsFr));
    const after = render(LegalTerms);
    expect(after).toBe(expected); // identico al documento reso direttamente: stesso testo, nessun contorno in più
    expect(after).not.toContain(frDictionary['legal.loading']);
    expect(render(LegalPrivacy)).toBe(renderToStaticMarkup(createElement(PrivacyFr)));
  });
  it('preloadLegal è idempotente e funziona per ogni lingua', async () => {
    for (const lang of ['it', 'en', 'fr'] as const) {
      const first = preloadLegal(lang);
      const second = preloadLegal(lang);
      expect(await second).toBe(await first); // stesso modulo, anche se il registro lo aveva già risolto
      await activateLanguage(lang);
      const text = render(LegalTerms);
      expect(text).not.toContain({ it: itDictionary, en: enDictionary, fr: frDictionary }[lang]['legal.loading']);
    }
  });
});

describe('precarico del dizionario: public/theme-init.js sceglie la stessa lingua dell\'app', () => {
  const source = readFileSync(new URL('../public/theme-init.js', import.meta.url), 'utf8');
  const MAP: Record<string, string> = { it: '/assets/it-AAAA.js', en: '/assets/en-BBBB.js', fr: '/assets/fr-CCCC.js' };

  interface Scenario { stored?: string | null; languages?: string[]; language?: string; map?: unknown; keepPlaceholder?: boolean }
  /** Esegue lo script con un browser finto e restituisce i <link> aggiunti all'<head>. */
  const run = (sc: Scenario) => {
    const links: Array<{ rel?: string; crossOrigin?: string; href?: string }> = [];
    const code = sc.keepPlaceholder ? source : source.replace(/'__LOCALE_CHUNKS__'/g, () => JSON.stringify(sc.map ?? MAP));
    const document = {
      documentElement: { style: { setProperty() {} }, setAttribute() {} },
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({}) as { rel?: string; crossOrigin?: string; href?: string },
      head: { appendChild: (el: { rel?: string; crossOrigin?: string; href?: string }) => links.push(el) },
    };
    const window = {
      matchMedia: () => ({ matches: false }),
      localStorage: {
        getItem: (key: string) => {
          if (sc.stored === 'THROW') throw new Error('storage bloccato');
          return key === 'studia_language' ? (sc.stored ?? null) : null;
        },
      },
    };
    runInNewContext(code, { window, document, navigator: { languages: sc.languages, language: sc.language } });
    return links;
  };

  it('stessa scelta di resolveLanguage + readLanguagePreference (preferenza, lingue del dispositivo, ripiego inglese)', () => {
    const scenarios: Scenario[] = [
      { stored: 'fr', languages: ['en-US'] },
      { stored: 'it', languages: ['fr'] },
      { stored: 'system', languages: ['fr-CA', 'en'] },
      { stored: null, languages: ['de', 'es'] },
      { stored: null, languages: ['pt-BR', 'IT_ch'] },
      { stored: null, languages: ['EN'] },
      { stored: 'xx', languages: ['en-GB'] },
      { stored: 'constructor', languages: ['fr'] },
      { stored: 'THROW', languages: ['it-IT'] },
      { stored: null, languages: [] },
      { stored: null, languages: undefined, language: 'fr-FR' },
      { stored: null, languages: undefined, language: undefined },
    ];
    for (const sc of scenarios) {
      const devices = sc.languages && sc.languages.length > 0 ? sc.languages : sc.language ? [sc.language] : [];
      const preference = isLanguagePreference(sc.stored) ? sc.stored : 'system';
      const expected = resolveLanguage(preference, devices);
      const links = run(sc);
      expect(links.map((l) => l.href), JSON.stringify(sc)).toEqual([MAP[expected]]);
    }
  });
  it('il link è un modulepreload con crossorigin vuoto e l\'indirizzo esatto della mappa', () => {
    const [link, ...rest] = run({ stored: 'en' });
    expect(rest).toHaveLength(0);
    expect(link.rel).toBe('modulepreload');
    expect(link.crossOrigin).toBe('');
    expect(link.href).toBe(MAP.en);
  });
  it('senza mappa (segnaposto non sostituito, come in `vite dev`) o con valori non validi non fa nulla e non lancia', () => {
    expect(run({ stored: 'it', keepPlaceholder: true })).toHaveLength(0);
    expect(run({ stored: 'it', map: {} })).toHaveLength(0);
    expect(run({ stored: 'it', map: { en: MAP.en } })).toHaveLength(0); // manca la lingua scelta
    for (const bad of ['https://evil.example/x.js', '//evil.example/x.js', '/assets/sub/x.js', '/assets/x.css', '/altro/x.js', 42, null]) {
      expect(run({ stored: 'it', map: { it: bad } })).toHaveLength(0);
    }
  });
  it('il segnaposto è uno solo ed è lo stesso che sostituisce vite.config.ts', () => {
    const viteConfig = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
    expect(source.split("'__LOCALE_CHUNKS__'").length - 1).toBe(1);
    expect(viteConfig).toContain("'__LOCALE_CHUNKS__'");
  });
});

describe('importazione: lettura con pool (stesso risultato della lettura seriale)', () => {
  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  const f = (name: string, size = 10, webkitRelativePath = '') => ({ name, size, webkitRelativePath });
  const base = { accept: ['html', 'markdown'] as const, maxBytes: 100 };

  /** Generatore pseudo-casuale con seme fisso: stessi ritardi a ogni esecuzione. */
  const lcg = (seed: number) => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

  /** Lettore finto: ritardo per file, errori scelti per nome, conteggio delle letture in volo. */
  const makeReader = (delayOf: (name: string) => number, failing: ReadonlySet<string> = new Set()) => {
    let inFlight = 0;
    const stats = { max: 0, started: [] as string[] };
    const read = async (file: { name: string }) => {
      stats.started.push(file.name);
      inFlight++;
      stats.max = Math.max(stats.max, inFlight);
      await sleep(delayOf(file.name));
      inFlight--;
      if (failing.has(file.name)) throw new Error('illeggibile');
      return `contenuto di ${file.name}`;
    };
    return { read, stats };
  };

  const buildFolder = () => {
    const files: Array<ReturnType<typeof f>> = [];
    for (let i = 0; i < 40; i++) files.push(f(`n${i}.md`, 10, `Corso/sez${i % 4}/n${i}.md`));
    files.push(f('pagina.html', 10, 'Corso/pagina.html'));
    files.push(f('foto.png', 10, 'Corso/foto.png')); // non supportato
    files.push(f('enorme.md', 5000, 'Corso/sez0/enorme.md')); // oltre maxBytes
    files.push(f('config', 10, 'Corso/node_modules/x/README.md')); // ignorato
    files.push(f('.nascosto.md', 10, 'Corso/.nascosto.md')); // ignorato
    return files;
  };

  it('ordine di note e problemi identico alla lettura seriale, con ritardi casuali ed errori in mezzo', async () => {
    const files = buildFolder();
    const failing = new Set(['n3.md', 'n17.md', 'n18.md', 'pagina.html', 'n39.md']);
    for (const sortByPath of [true, false]) {
      for (const reportUnsupported of [true, false]) {
        const rand = lcg(7);
        const delays = new Map(files.map((file) => [file.name, Math.floor(rand() * 6)]));
        const options = { ...base, reportUnsupported, sortByPath };
        const serial = await readImportFiles(files, { ...options, read: makeReader((n) => delays.get(n) ?? 0, failing).read, concurrency: 1 });
        const pooled = await readImportFiles(files, { ...options, read: makeReader((n) => delays.get(n) ?? 0, failing).read });
        expect(pooled.notes.map((n) => n.file.name)).toEqual(serial.notes.map((n) => n.file.name));
        expect(pooled.notes.map((n) => n.content)).toEqual(serial.notes.map((n) => n.content));
        expect(pooled.notes.map((n) => n.dirParts)).toEqual(serial.notes.map((n) => n.dirParts));
        expect(pooled.problems).toEqual(serial.problems);
        expect(pooled.notes.length + pooled.problems.length).toBeGreaterThan(40);
      }
    }
  });
  it('i problemi escono nell\'ordine dei file anche se le letture finiscono in ordine diverso', async () => {
    const files = [f('a.md'), f('foto.png'), f('lenta-che-fallisce.md'), f('grande.md', 5000), f('veloce.md'), f('lenta-che-fallisce-2.md'), f('ultima.md')];
    const delay = (n: string) => (n.startsWith('lenta') ? 25 : 0);
    const { read } = makeReader(delay, new Set(['lenta-che-fallisce.md', 'lenta-che-fallisce-2.md']));
    const r = await readImportFiles(files, { ...base, reportUnsupported: true, read });
    expect(r.problems).toEqual(['foto.png', 'lenta-che-fallisce.md', 'grande.md', 'lenta-che-fallisce-2.md']);
    expect(r.notes.map((n) => n.file.name)).toEqual(['a.md', 'veloce.md', 'ultima.md']);
  });
  it('mai più di `concurrency` letture in volo; di norma ne parte più d\'una insieme', async () => {
    const files = Array.from({ length: 30 }, (_, i) => f(`n${i}.md`));
    const run = async (concurrency?: number) => {
      const { read, stats } = makeReader(() => 3);
      const r = await readImportFiles(files, { ...base, reportUnsupported: true, read, concurrency });
      expect(r.notes).toHaveLength(30);
      return stats;
    };
    const byDefault = await run();
    expect(DEFAULT_READ_CONCURRENCY).toBe(8);
    expect(byDefault.max).toBe(DEFAULT_READ_CONCURRENCY);
    expect((await run(3)).max).toBe(3);
    const one = await run(1);
    expect(one.max).toBe(1);
    expect(one.started).toEqual(files.map((x) => x.name)); // con 1 le letture partono nell'ordine dei file
  });
  it('concurrency non valida → una alla volta; più concurrency che file → nessun problema', async () => {
    const files = [f('a.md'), f('b.md'), f('c.md')];
    for (const concurrency of [0, -4, Number.NaN, 2.7, 50]) {
      const { read, stats } = makeReader(() => 1);
      const r = await readImportFiles(files, { ...base, reportUnsupported: true, read, concurrency });
      expect(r.notes.map((n) => n.file.name)).toEqual(['a.md', 'b.md', 'c.md']);
      expect(stats.max).toBeLessThanOrEqual(Math.max(1, Math.min(Math.floor(concurrency) || 1, 3)));
    }
  });
  it('un errore anche sincrono del lettore è un problema di quel file, non fa fallire l\'import', async () => {
    const files = [f('a.md'), f('rotto.md'), f('c.md')];
    const read = (file: { name: string }): Promise<string> => {
      if (file.name === 'rotto.md') throw new Error('lancio sincrono');
      return Promise.resolve('ok');
    };
    const r = await readImportFiles(files, { ...base, reportUnsupported: true, read });
    expect(r.notes.map((n) => n.file.name)).toEqual(['a.md', 'c.md']);
    expect(r.problems).toEqual(['rotto.md']);
  });
  it('nessun file da leggere: il lettore non viene mai chiamato', async () => {
    let calls = 0;
    const read = async () => { calls++; return ''; };
    const r = await readImportFiles([f('foto.png'), f('grande.md', 5000), f('x.md', 10, '.git/x.md')], { ...base, reportUnsupported: true, read });
    expect(calls).toBe(0);
    expect(r.notes).toEqual([]);
    expect(r.problems).toEqual(['foto.png', 'grande.md']);
    expect(await readImportFiles([], { ...base, reportUnsupported: true, read })).toEqual({ notes: [], problems: [] });
  });
});

describe('importazione: avanzamento (onProgress)', () => {
  const f = (name: string, size = 10, webkitRelativePath = '') => ({ name, size, webkitRelativePath });
  const base = { accept: ['html', 'markdown'] as const, maxBytes: 100, reportUnsupported: true };
  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  it('prima (0, totale), poi un passo per ogni lettura finita, anche se fallita; il totale conta solo i file da leggere', async () => {
    const files = [f('a.md'), f('foto.png'), f('b.md'), f('grande.md', 5000), f('rotto.md'), f('c.md', 10, '.git/c.md'), f('d.md')];
    const read = async (file: { name: string }) => {
      await sleep(file.name === 'rotto.md' ? 8 : 1);
      if (file.name === 'rotto.md') throw new Error('illeggibile');
      return 'x';
    };
    for (const concurrency of [1, undefined]) {
      const calls: Array<[number, number]> = [];
      const r = await readImportFiles(files, { ...base, read, concurrency, onProgress: (done, total) => calls.push([done, total]) });
      expect(calls).toEqual([[0, 4], [1, 4], [2, 4], [3, 4], [4, 4]]); // a, b, rotto, d = 4 letture
      expect(r.problems).toEqual(['foto.png', 'grande.md', 'rotto.md']);
      expect(r.notes.map((n) => n.file.name)).toEqual(['a.md', 'b.md', 'd.md']);
    }
  });
  it('nessun file da leggere → nessuna chiamata', async () => {
    const calls: Array<[number, number]> = [];
    await readImportFiles([f('foto.png'), f('grande.md', 5000)], { ...base, read: async () => '', onProgress: (d, t) => calls.push([d, t]) });
    expect(calls).toEqual([]);
  });
  it('un onProgress che lancia non cambia il risultato dell\'import', async () => {
    const files = [f('a.md'), f('b.md'), f('foto.png')];
    const read = async (file: { name: string }) => `c ${file.name}`;
    const plain = await readImportFiles(files, { ...base, read });
    const withBroken = await readImportFiles(files, { ...base, read, onProgress: () => { throw new Error('indicatore rotto'); } });
    expect(withBroken).toEqual(plain);
  });
  it('la stringa dell\'indicatore esiste nelle tre lingue (senza segnaposto)', () => {
    for (const dict of [itDictionary, enDictionary, frDictionary]) {
      expect(typeof dict['create.importing']).toBe('string');
      expect(dict['create.importing'].length).toBeGreaterThan(3);
      expect(dict['create.importing']).not.toContain('{');
    }
  });
});

describe('testi legali: stessa struttura e numerazione consecutiva nelle tre lingue', () => {
  const numbers = (Doc: FC) =>
    [...renderToStaticMarkup(createElement(Doc)).matchAll(/<h[34]>(\d+(?:\.\d+)?)\.?\s/g)].map((m) => m[1]);
  const range = (n: number) => Array.from({ length: n }, (_, i) => String(i + 1));

  it('Termini: punti da 1 a 12 senza buchi, uguali in italiano, inglese e francese', () => {
    for (const Doc of [TermsIt, TermsEn, TermsFr]) expect(numbers(Doc)).toEqual(range(12));
  });
  it('Privacy: punti da 1 a 11 (con 3.1-3.3) senza buchi, uguali nelle tre lingue', () => {
    const expected = [...range(3), '3.1', '3.2', '3.3', ...range(11).slice(3)];
    for (const Doc of [PrivacyIt, PrivacyEn, PrivacyFr]) expect(numbers(Doc)).toEqual(expected);
  });
});

describe('build: font KaTeX datati (.woff/.ttf) fuori da CSS e dist', () => {
  const face = (name: string, quote = '"') =>
    `@font-face{font-display:block;font-family:KaTeX_${name};font-style:normal;font-weight:400;` +
    `src:url(/assets/KaTeX_${name}-Regular-AAA.woff2) format(${quote}woff2${quote}),` +
    `url(/assets/KaTeX_${name}-Regular-BBB.woff) format(${quote}woff${quote}),` +
    `url(/assets/KaTeX_${name}-Regular-CCC.ttf) format(${quote}truetype${quote})}`;

  it('toglie woff e ttf e tiene il woff2 (con format tra virgolette, apici o senza)', () => {
    for (const quote of ['"', "'", '']) {
      const { css, removed } = stripLegacyFontSources(face('AMS', quote));
      expect(removed).toBe(2);
      expect(css).toContain('KaTeX_AMS-Regular-AAA.woff2');
      expect(css).toContain(`format(${quote}woff2${quote})`);
      expect(css).not.toContain('.woff)');
      expect(css).not.toContain('.ttf');
      expect(css.endsWith('}')).toBe(true);
      expect(css).toContain('font-family:KaTeX_AMS;font-style:normal'); // il resto della regola è intatto
    }
  });
  it('anche le sorgenti incorporate come data URI; il woff2 incorporato resta', () => {
    const css = '@font-face{font-family:K;src:url(data:font/woff2;base64,AAAA) format("woff2"),url(data:font/woff;base64,BBBB) format("woff"),url(data:font/ttf;base64,CCCC) format("truetype")}';
    const out = stripLegacyFontSources(css);
    expect(out.removed).toBe(2);
    expect(out.css).toBe('@font-face{font-family:K;src:url(data:font/woff2;base64,AAAA) format("woff2")}');
  });
  it('più regole: le conta tutte; CSS senza sorgenti datate o con il solo woff non cambia', () => {
    const two = face('Main') + face('Math');
    expect(stripLegacyFontSources(two).removed).toBe(4);
    const woff2Only = '@font-face{font-family:K;src:url(/assets/K-1.woff2) format("woff2")}';
    expect(stripLegacyFontSources(woff2Only)).toEqual({ css: woff2Only, removed: 0 });
    const onlyWoff = '@font-face{font-family:K;src:url(/assets/K-1.woff) format("woff")}'; // unica sorgente: mai toglierla
    expect(stripLegacyFontSources(onlyWoff)).toEqual({ css: onlyWoff, removed: 0 });
    expect(stripLegacyFontSources('.a{background:url(/assets/x.woff2)} .b{color:red}').removed).toBe(0);
  });
  it('isLegacyKatexFont: solo .woff e .ttf dei font KaTeX', () => {
    expect(isLegacyKatexFont('assets/KaTeX_AMS-Regular-BBB.woff')).toBe(true);
    expect(isLegacyKatexFont('assets/KaTeX_AMS-Regular-CCC.ttf')).toBe(true);
    expect(isLegacyKatexFont('assets/KaTeX_AMS-Regular-AAA.woff2')).toBe(false);
    expect(isLegacyKatexFont('assets/Altro-Regular.woff')).toBe(false);
    expect(isLegacyKatexFont('assets/MarkdownView-x.css')).toBe(false);
  });
  it('pruneLegacyKatexFonts: elimina i file non più citati, riscrive il CSS, lascia il resto', () => {
    const bundle: Record<string, { type: string; source?: string | Uint8Array }> = {
      'assets/MarkdownView-x.css': { type: 'asset', source: new TextEncoder().encode(face('AMS')) },
      'assets/index-y.css': { type: 'asset', source: '.a{color:red}' },
      'assets/KaTeX_AMS-Regular-AAA.woff2': { type: 'asset', source: new Uint8Array([1]) },
      'assets/KaTeX_AMS-Regular-BBB.woff': { type: 'asset', source: new Uint8Array([2]) },
      'assets/KaTeX_AMS-Regular-CCC.ttf': { type: 'asset', source: new Uint8Array([3]) },
      'assets/index-z.js': { type: 'chunk' },
    };
    const r = pruneLegacyKatexFonts(bundle);
    expect(r.deleted.sort()).toEqual(['assets/KaTeX_AMS-Regular-BBB.woff', 'assets/KaTeX_AMS-Regular-CCC.ttf']);
    expect(r.kept).toEqual([]);
    expect(Object.keys(bundle).sort()).toEqual(['assets/KaTeX_AMS-Regular-AAA.woff2', 'assets/MarkdownView-x.css', 'assets/index-y.css', 'assets/index-z.js']);
    expect(String(bundle['assets/MarkdownView-x.css'].source)).toContain('KaTeX_AMS-Regular-AAA.woff2');
    expect(String(bundle['assets/MarkdownView-x.css'].source)).not.toContain('BBB');
    expect(bundle['assets/index-y.css'].source).toBe('.a{color:red}');
  });
  it('pruneLegacyKatexFonts: se il CSS cita ancora un file (sorgente non riconosciuta) quel file resta', () => {
    const odd = '@font-face{font-family:K;src:local(K),url(/assets/KaTeX_Odd-Regular-BBB.woff)}'; // senza format(): non riconosciuta
    const bundle: Record<string, { type: string; source?: string | Uint8Array }> = {
      'assets/odd.css': { type: 'asset', source: odd },
      'assets/KaTeX_Odd-Regular-BBB.woff': { type: 'asset', source: new Uint8Array([2]) },
      'assets/KaTeX_Other-Regular-CCC.ttf': { type: 'asset', source: new Uint8Array([3]) },
    };
    const r = pruneLegacyKatexFonts(bundle);
    expect(r.kept).toEqual(['assets/KaTeX_Odd-Regular-BBB.woff']);
    expect(r.deleted).toEqual(['assets/KaTeX_Other-Regular-CCC.ttf']);
    expect('assets/KaTeX_Odd-Regular-BBB.woff' in bundle).toBe(true);
    expect(bundle['assets/odd.css'].source).toBe(odd);
  });
  it('pruneLegacyKatexFonts: «X.woff» non è considerato citato solo perché il CSS nomina «X.woff2» (stesso hash)', () => {
    const css = '@font-face{font-family:K;src:url(/assets/KaTeX_Same-H4sh.woff2) format("woff2"),url(/assets/KaTeX_Same-H4sh.woff) format("woff"),url(/assets/KaTeX_Same-H4sh.ttf) format("truetype")}';
    const bundle: Record<string, { type: string; source?: string | Uint8Array }> = {
      'assets/k.css': { type: 'asset', source: css },
      'assets/KaTeX_Same-H4sh.woff2': { type: 'asset', source: new Uint8Array([1]) },
      'assets/KaTeX_Same-H4sh.woff': { type: 'asset', source: new Uint8Array([2]) },
      'assets/KaTeX_Same-H4sh.ttf': { type: 'asset', source: new Uint8Array([3]) },
    };
    const r = pruneLegacyKatexFonts(bundle);
    expect(r.kept).toEqual([]);
    expect(r.deleted.sort()).toEqual(['assets/KaTeX_Same-H4sh.ttf', 'assets/KaTeX_Same-H4sh.woff']);
    expect(Object.keys(bundle).sort()).toEqual(['assets/KaTeX_Same-H4sh.woff2', 'assets/k.css']);
  });
  it('senza font datati nel bundle non tocca nulla', () => {
    const bundle = { 'assets/a.css': { type: 'asset', source: '.a{}' } as { type: string; source?: string } };
    expect(pruneLegacyKatexFonts(bundle)).toEqual({ deleted: [], kept: [] });
  });
});

describe('build: avvisi di software di terze parti (THIRD-PARTY-NOTICES.txt)', () => {
  const files: Record<string, string> = {
    '/p/node_modules/react/package.json': JSON.stringify({ name: 'react', version: '19.0.0', license: 'MIT', repository: { url: 'git+https://github.com/facebook/react.git' } }),
    '/p/node_modules/react/LICENSE': 'MIT License\r\n\r\nCopyright (c) Meta\r\n',
    '/p/node_modules/@scope/pkg/package.json': JSON.stringify({ name: '@scope/pkg', version: '2.1.0', license: 'Apache-2.0', homepage: 'https://scope.example/pkg' }),
    '/p/node_modules/@scope/pkg/LICENSE.markdown': 'Apache License 2.0 testo',
    '/p/node_modules/jszip/package.json': JSON.stringify({ name: 'jszip', version: '3.10.1', license: '(MIT OR GPL-3.0-or-later)', repository: 'git://github.com/Stuk/jszip.git' }),
    '/p/node_modules/jszip/LICENSE.markdown': 'Dual licensed: MIT or GPLv3',
    '/p/node_modules/nolic/package.json': JSON.stringify({ name: 'nolic', version: '0.1.0', license: 'ISC' }),
    '/p/node_modules/rotto/package.json': '{ non è json',
    '/p/node_modules/old/package.json': JSON.stringify({ name: 'old', version: '1.0.0', licenses: [{ type: 'MIT' }, { type: 'BSD-3-Clause' }] }),
    '/p/node_modules/old/COPYING': 'Copying text',
    '/p/node_modules/a/node_modules/react/package.json': JSON.stringify({ name: 'react', version: '19.0.0', license: 'MIT' }),
    '/p/node_modules/a/node_modules/react/LICENSE': 'altra copia identica',
  };
  const source = {
    readText: (f: string) => files[f] ?? null,
    listDir: (dir: string) => Object.keys(files).filter((f) => f.startsWith(`${dir}/`) && !f.slice(dir.length + 1).includes('/')).map((f) => f.slice(dir.length + 1)),
  };
  const ids = [
    '/p/node_modules/react/index.js', '/p/node_modules/react/cjs/react.js', '/p/node_modules/@scope/pkg/dist/a.js?v=1', '/p/node_modules/jszip/lib/index.js',
    '/p/node_modules/nolic/x.js', '/p/node_modules/rotto/x.js', '/p/node_modules/old/x.js', '/p/node_modules/a/node_modules/react/index.js',
    '/p/src/App.tsx', '\0vite/preload-helper',
  ];

  it('packageRootFromModuleId: pacchetti normali, con scope, pnpm, percorsi Windows, query; scarta il resto', () => {
    expect(packageRootFromModuleId('/p/node_modules/react/index.js')).toEqual({ name: 'react', root: '/p/node_modules/react' });
    expect(packageRootFromModuleId('/p/node_modules/@scope/pkg/dist/a.js?v=1')).toEqual({ name: '@scope/pkg', root: '/p/node_modules/@scope/pkg' });
    expect(packageRootFromModuleId('/p/node_modules/.pnpm/x@1/node_modules/@s/n/i.js')).toEqual({ name: '@s/n', root: '/p/node_modules/.pnpm/x@1/node_modules/@s/n' });
    expect(packageRootFromModuleId('C:\\p\\node_modules\\idb\\build\\index.js')).toEqual({ name: 'idb', root: 'C:/p/node_modules/idb' });
    expect(packageRootFromModuleId('/p/src/App.tsx')).toBeNull();
    expect(packageRootFromModuleId('\0vite/preload-helper')).toBeNull();
    expect(packageRootFromModuleId('/p/node_modules/@scope')).toBeNull();
  });
  it('collectNotices: un blocco per pacchetto, in ordine alfabetico, senza duplicati della stessa versione', () => {
    const r = collectNotices(ids, source);
    expect(r.packages).toEqual(['@scope/pkg@2.1.0', 'jszip@3.10.1', 'nolic@0.1.0', 'old@1.0.0', 'react@19.0.0', 'rotto@?']);
    expect(r.text).toContain('Pacchetti / Packages: 6');
    expect(r.text.match(/^react@19\.0\.0$/gm)).toHaveLength(1);
    expect(r.text).not.toContain('altra copia identica');
  });
  it('collectNotices: testi di licenza (anche LICENSE.markdown e COPYING), righe a capo normalizzate, indirizzo ripulito', () => {
    const r = collectNotices(ids, source);
    expect(r.text).toContain('MIT License\n\nCopyright (c) Meta');
    expect(r.text).not.toContain('\r');
    expect(r.text).toContain('Apache License 2.0 testo');
    expect(r.text).toContain('Copying text');
    expect(r.text).toContain('Fonte / Source: https://github.com/facebook/react');
    expect(r.text).toContain('Fonte / Source: https://github.com/Stuk/jszip');
    expect(r.text).toContain('Fonte / Source: https://scope.example/pkg');
    expect(r.text).toContain('Licenza / License: MIT OR BSD-3-Clause');
  });
  it('collectNotices: doppia licenza con MIT → nota «usato con MIT» solo lì; pacchetto senza licenza o con package.json rotto non fa fallire', () => {
    const r = collectNotices(ids, source);
    expect(r.text.match(/Usato secondo i termini della licenza MIT/g)).toHaveLength(2); // jszip e old (MIT OR BSD-3-Clause)
    expect(r.withoutLicenseFile.sort()).toEqual(['nolic@0.1.0', 'rotto@?']);
    expect(r.text).toContain('Il pacchetto non include un file di licenza');
  });
  it('collectNotices: nessun modulo di terze parti → testo con 0 pacchetti, senza errori', () => {
    const r = collectNotices(['/p/src/App.tsx'], source);
    expect(r.packages).toEqual([]);
    expect(r.text).toContain('Pacchetti / Packages: 0');
  });
});
