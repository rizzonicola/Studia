#!/usr/bin/env node
/**
 * Prova veloce (solo Node ≥ 20, nessuna dipendenza, nessun browser) delle parti del service worker che riguardano il manifest:
 *   npm run check:sw-manifest   (oppure: node tools/sw-manifest-check.mjs [--sw percorso])
 *
 * Carica public/service-worker.js in un ambiente simulato (self, caches, fetch...) e verifica che:
 *   - /manifest.json e i manifest per tema (/manifests/<colore>.json) seguano «rete per prima»: rete ok → risposta fresca e salvata in cache;
 *     rete assente o troppo lenta → copia in cache; se al posto del manifest arriva HTML (ripiego SPA) NON si salva;
 *   - un indirizzo che somiglia a un manifest ma non lo è (/manifests/zz.json, .json.bak) NON riceva quel trattamento;
 *   - i POST, gli altri metodi, i domini diversi e le pagine statiche /it/ non vengano toccati;
 *   - la pulizia delle cache di build vecchie (evento activate) funzioni come prima.
 * Non sostituisce tools/browser-checks/sw-check.mjs (browser vero: precache, offline, aggiornamenti), lo completa.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const swPath = path.resolve(args.includes('--sw') ? args[args.indexOf('--sw') + 1] : path.join(here, '..', 'public', 'service-worker.js'));
const ORIGIN = 'https://example.test';

let failures = 0;
const check = (ok, label, detail = '') => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'OK  ' : 'FALLITO'} ${label}${detail ? `  (${detail})` : ''}`);
};
const section = (title) => console.log(`\n${title}`);

// ------------------------------------------------------------------------------------------------ ambiente simulato
class FakeCache {
  constructor() { this.entries = new Map(); }
  static key(request) { return typeof request === 'string' ? new URL(request, ORIGIN).href : request.url; }
  async put(request, response) { this.entries.set(FakeCache.key(request), response); }
  async add(request) { this.entries.set(FakeCache.key(request), new Response('x')); }
  async match(request) { return this.entries.get(FakeCache.key(request))?.clone(); }
  async keys() { return [...this.entries.keys()].map((u) => new Request(u)); }
  async delete(request) { return this.entries.delete(FakeCache.key(request)); }
}
class FakeCacheStorage {
  constructor() { this.map = new Map(); }
  async open(name) { if (!this.map.has(name)) this.map.set(name, new FakeCache()); return this.map.get(name); }
  async has(name) { return this.map.has(name); }
  async keys() { return [...this.map.keys()]; }
  async delete(name) { return this.map.delete(name); }
  async match(request) {
    for (const cache of this.map.values()) {
      const hit = await cache.match(request);
      if (hit) return hit;
    }
    return undefined;
  }
}

/** Nel browser un Request creato dal service worker con un percorso relativo ("/index.html") usa l'indirizzo del SW come base; in Node serve farlo a mano. */
class SwRequest extends Request {
  constructor(input, init) {
    super(typeof input === 'string' ? new URL(input, ORIGIN).href : input, init);
  }
}

/** Una nuova istanza del service worker (con tempo massimo del manifest ridotto, per non attendere secondi veri). */
function loadServiceWorker({ fetchImpl, precache = [] }) {
  const source = fs
    .readFileSync(swPath, 'utf8')
    .replace(/'__BUILD_ID__'/g, '"test-build"')
    .replace(/'__PRECACHE__'/g, JSON.stringify(precache))
    .replace(/const MANIFEST_TIMEOUT_MS = \d+;/, 'const MANIFEST_TIMEOUT_MS = 60;');
  const handlers = {};
  const caches = new FakeCacheStorage();
  const self = {
    location: new URL(`${ORIGIN}/service-worker.js`),
    addEventListener: (type, fn) => { handlers[type] = fn; },
    registration: { navigationPreload: undefined },
    clients: { claim: async () => undefined },
    skipWaiting: () => undefined,
  };
  const context = vm.createContext({ self, caches, fetch: (...a) => fetchImpl(...a), Request: SwRequest, Response, Headers, URL, URLSearchParams, FormData, File, Blob, Promise, setTimeout, clearTimeout, Date, String, Array, Error, console });
  vm.runInContext(source, context, { filename: 'service-worker.js' });
  return { handlers, caches };
}

/** Simula l'evento "fetch": restituisce la risposta data a respondWith (o null se il service worker non interviene). */
async function dispatchFetch(sw, request) {
  const waiting = [];
  let responded = null;
  sw.handlers.fetch({
    request,
    preloadResponse: undefined,
    respondWith: (value) => { responded = Promise.resolve(value); },
    waitUntil: (promise) => waiting.push(promise),
  });
  const response = responded ? await responded : null;
  await Promise.allSettled(waiting);
  return response;
}

const noNetwork = async () => { throw new TypeError('offline'); };
// ------------------------------------------------------------------------------------------------ prove
console.log(`Service worker: ${swPath}`);

const manifestPaths = ['/manifest.json', '/manifests/20232a.json', '/manifests/000000.json', '/manifests/f4efe6.json'];

section('1. Manifest e manifest per tema: rete per prima');
for (const manifestPath of manifestPaths) {
  const url = `${ORIGIN}${manifestPath}`;
  const json = (v) => new Response(JSON.stringify({ v }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  let calls = 0;
  const sw = loadServiceWorker({ fetchImpl: async () => { calls++; return json('nuovo'); } });
  await (await sw.caches.open('studia-test-build')).put(url, json('vecchio'));
  const res = await dispatchFetch(sw, new Request(url));
  check((await res.json()).v === 'nuovo' && calls === 1, `${manifestPath}: con la rete risponde il file NUOVO, non quello in cache`);
  const saved = await (await sw.caches.open('studia-test-build')).match(url);
  check((await saved.json()).v === 'nuovo', `${manifestPath}: e la copia in cache viene aggiornata`);

  const swOffline = loadServiceWorker({ fetchImpl: noNetwork });
  await (await swOffline.caches.open('studia-test-build')).put(url, json('in-cache'));
  check((await (await dispatchFetch(swOffline, new Request(url))).json()).v === 'in-cache', `${manifestPath}: senza rete risponde la copia in cache`);

  const swSlow = loadServiceWorker({ fetchImpl: () => new Promise(() => undefined) }); // non risponde mai
  await (await swSlow.caches.open('studia-test-build')).put(url, json('in-cache'));
  const t0 = Date.now();
  const late = await dispatchFetch(swSlow, new Request(url));
  check((await late.json()).v === 'in-cache' && Date.now() - t0 < 1500, `${manifestPath}: con la rete che non risponde, dopo il tempo massimo, la copia in cache`, `${Date.now() - t0} ms`);

  const swHtml = loadServiceWorker({ fetchImpl: async () => new Response('<!doctype html>', { status: 200, headers: { 'Content-Type': 'text/html' } }) });
  await dispatchFetch(swHtml, new Request(url));
  check(!(await (await swHtml.caches.open('studia-test-build')).match(url)), `${manifestPath}: se arriva HTML al posto del manifest (ripiego SPA) NON si salva in cache`);
}

section('2. Indirizzi simili ma che NON sono manifest');
for (const lookalike of ['/manifests/zz.json', '/manifests/20232a.json.bak', '/manifests/20232.json', '/manifests/20232aa.json', '/manifests/sub/20232a.json', '/manifest.json.old']) {
  const url = `${ORIGIN}${lookalike}`;
  const sw = loadServiceWorker({ fetchImpl: async () => new Response('fresco', { status: 200, headers: { 'Content-Type': 'application/json' } }) });
  await (await sw.caches.open('studia-test-build')).put(url, new Response('vecchio', { status: 200, headers: { 'Content-Type': 'application/json' } }));
  const res = await dispatchFetch(sw, new Request(url));
  check(res && (await res.text()) === 'vecchio', `${lookalike}: trattamento normale (prima la cache), non «rete per prima»`);
}

section('3. Richieste che il service worker NON deve toccare');
{
  const sw = loadServiceWorker({ fetchImpl: noNetwork });
  check((await dispatchFetch(sw, new Request(`${ORIGIN}/altro`, { method: 'POST', body: 'x' }))) === null, 'POST: nessun intervento');
  check((await dispatchFetch(sw, new Request(`${ORIGIN}/manifest.json`, { method: 'POST', body: 'x' }))) === null, 'POST sul manifest: nessun intervento');
  check((await dispatchFetch(sw, new Request(`${ORIGIN}/altro`, { method: 'PUT', body: 'x' }))) === null, 'PUT: nessun intervento');
  check((await dispatchFetch(sw, new Request('https://generativelanguage.googleapis.com/v1/models'))) === null, 'chiamate a Google (cross-origin): mai intercettate');
  check((await dispatchFetch(sw, new Request('https://evil.test/manifest.json'))) === null, 'manifest di un altro dominio: mai intercettato');
  check((await dispatchFetch(sw, new Request(`${ORIGIN}/it/`))) === null, 'pagine statiche /it/: lasciate alla rete');
}

section('4. Pulizia delle cache di build vecchie (evento activate)');
{
  const sw = loadServiceWorker({ fetchImpl: noNetwork });
  for (const name of ['studia-v1', 'studia-v2', 'studia-v3', 'studia-test-build']) await sw.caches.open(name);
  const waiting = [];
  sw.handlers.activate({ waitUntil: (p) => waiting.push(p) });
  await Promise.all(waiting);
  const left = (await sw.caches.keys()).sort();
  check(left.includes('studia-test-build') && !left.includes('studia-v1'), 'si tiene la build attuale e la precedente, si eliminano le più vecchie', left.join(', '));
}

section('5. Installazione: pochi download alla volta, ma tutto in cache');
{
  const FILES = 30;
  const urls = Array.from({ length: FILES }, (_, i) => `/assets/chunk${i}-h${i}.js`);
  const broken = urls[7]; // un file che non si scarica: non deve fermare gli altri
  let inFlight = 0;
  let maxInFlight = 0;
  const fetchImpl = async (request) => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 5));
    inFlight--;
    if (new URL(request.url).pathname === broken) throw new TypeError('rete');
    return new Response('/*js*/', { status: 200, headers: { 'Content-Type': 'text/javascript' } });
  };
  const declared = /const PRECACHE_CONCURRENCY = (\d+)/.exec(fs.readFileSync(swPath, 'utf8'));
  const limit = declared ? Number(declared[1]) : 0;
  const sw = loadServiceWorker({ fetchImpl, precache: urls });
  const waiting = [];
  sw.handlers.install({ waitUntil: (p) => waiting.push(p) });
  await Promise.all(waiting);
  const cache = await sw.caches.open('studia-test-build');
  const saved = (await cache.keys()).map((r) => new URL(r.url).pathname);
  check(saved.length === FILES - 1 + 1 && saved.includes('/index.html') && !saved.includes(broken), `i file si scaricano e vanno in cache (${FILES - 1} su ${FILES}: uno non scaricabile; più la shell)`, `${saved.length} voci`);
  check(maxInFlight > 1, 'i download restano in parallelo (non uno alla volta)', `massimo ${maxInFlight} insieme`);
  check(declared !== null, 'il service worker dichiara un limite ai download simultanei (PRECACHE_CONCURRENCY)');
  check(declared !== null && maxInFlight <= limit, `mai più di ${limit} download insieme (limite del service worker)`, `massimo ${maxInFlight}`);
}

section('6. Navigazione senza rete: file statico non HTML in cache o shell');
{
  const nav = (p) => ({ method: 'GET', url: `${ORIGIN}${p}`, mode: 'navigate', destination: 'document', headers: new Headers() });
  const sw = loadServiceWorker({ fetchImpl: noNetwork });
  const cache = await sw.caches.open('studia-test-build');
  await cache.put(`${ORIGIN}/index.html`, new Response('<!doctype html>shell', { status: 200, headers: { 'Content-Type': 'text/html' } }));
  await cache.put(`${ORIGIN}/THIRD-PARTY-NOTICES.txt`, new Response('avvisi', { status: 200, headers: { 'Content-Type': 'text/plain' } }));
  await cache.put(`${ORIGIN}/pagina-html`, new Response('<!doctype html>altra', { status: 200, headers: { 'Content-Type': 'text/html' } }));
  const text = async (p) => (await (await dispatchFetch(sw, nav(p))).text());
  check((await text('/THIRD-PARTY-NOTICES.txt')) === 'avvisi', 'file statico non HTML in cache: si apre il file');
  check((await text('/note/abc')).endsWith('shell'), 'rotta dell\'app sconosciuta alla cache: la shell');
  check((await text('/')).endsWith('shell'), 'radice: la shell');
  check((await text('/pagina-html')).endsWith('shell'), 'una pagina HTML in cache NON si apre al posto della shell (solo i file non HTML)');
  const swNoShell = loadServiceWorker({ fetchImpl: noNetwork });
  const res = await dispatchFetch(swNoShell, nav('/THIRD-PARTY-NOTICES.txt')).catch(() => 'errore');
  check(res instanceof Response ? res.type === 'error' || res.status === 0 : res === 'errore', 'senza cache e senza rete: errore di rete, nessuna risposta inventata');
}

console.log(failures ? `\n${failures} prove FALLITE` : '\nTutte le prove superate');
process.exit(failures ? 1 : 0);
