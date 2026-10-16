#!/usr/bin/env node
/**
 * Verifica del service worker in un browser VERO (Chromium via Playwright). Non è un test unitario: avvia un mini-"dist" con un
 * server che imita Cloudflare Pages (header di cache di public/_headers, ripiego SPA con index.html e stato 200) e fa
 * girare davvero public/service-worker.js attraverso tre deploy successivi.
 *
 * Prove:
 *   1  prima visita: la shell e tutti i file della lista di precache finiscono in cache; ogni file con hash scaricato UNA volta sola;
 *   2  offline reale (il server viene spento): la pagina, una rotta profonda e un chunk lazy si aprono dalla cache;
 *   3  deploy v2: i file con hash invariati vengono COPIATI dalla cache precedente (0 richieste), si scarica solo il cambiato;
 *   4  deploy v3: la cache v1 (più vecchia della precedente) viene eliminata, v2 e v3 restano;
 *   5  rete lenta: una navigazione che tarda oltre il tempo massimo apre comunque la shell dalla cache;
 *   6  cache avvelenata: l'HTML di ripiego restituito per uno script inesistente NON viene salvato come se fosse lo script;
 *   7  precarica della navigazione attiva (dove il browser la supporta).
 *
 * Uso:   node tools/browser-checks/sw-check.mjs [--sw percorso/del/service-worker.js] [--files 40] [--changed 3]
 * Serve: `npm i -D playwright` + `npx playwright install chromium` (oppure PLAYWRIGHT_MODULE_PATH=/percorso/a/playwright).
 * Con --sw si prova un altro service worker (es. quello vecchio, per il confronto prima/dopo); le prove 5-7 descrivono
 * funzioni NUOVE e sul vecchio possono fallire: è il risultato atteso del confronto.
 */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..', '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const swSource = path.resolve(opt('sw', path.join(projectRoot, 'public', 'service-worker.js')));
const FILES = Number(opt('files', 40)); // quanti file con hash ha il "dist" finto (l'app vera ne ha circa 40-60)
const CHANGED = Number(opt('changed', 3)); // quanti ne cambiano a ogni deploy (di solito pochi: i chunk di vendor sono stabili)
const ASSET_BYTES = 50_000;

const require = createRequire(import.meta.url);
const loadPlaywright = () => {
  const tries = [process.env.PLAYWRIGHT_MODULE_PATH, 'playwright', path.join(projectRoot, 'node_modules', 'playwright')].filter(Boolean);
  for (const t of tries) { try { return require(t); } catch { /* prossimo */ } }
  throw new Error('Playwright non trovato: `npm i -D playwright && npx playwright install chromium`, oppure imposta PLAYWRIGHT_MODULE_PATH.');
};
const { chromium } = loadPlaywright();

// ------------------------------------------------------------------------------------------------ dist finto
const filler = (seed) => '/*' + (seed + ' ').repeat(Math.ceil(ASSET_BYTES / (seed.length + 1))).slice(0, ASSET_BYTES) + '*/';
/** Un "build": mappa percorso → { body, type }. `appHash` cambia a ogni deploy, come l'hash del chunk dell'app. */
function makeDist(version, appHash, changedSet) {
  const files = new Map();
  const add = (p, body, type) => files.set(p, { body, type });
  const assets = [];
  for (let i = 0; i < FILES; i++) {
    // i primi CHANGED file cambiano nome a ogni deploy (hash nuovo); gli altri restano identici (chunk di vendor stabili)
    const hash = i < CHANGED ? `${version}x${i}` : `stable${i}`;
    const p = `/assets/chunk${i}-${hash}.js`;
    assets.push(p);
    add(p, `export default ${JSON.stringify(p)};${filler(p)}`, 'text/javascript');
  }
  changedSet.push(...assets.slice(0, CHANGED));
  add('/assets/style-stable.css', 'body{color:#222}', 'text/css');
  add(`/assets/app-${appHash}.js`, `document.getElementById('root').textContent='app-${version}';window.__lazy=()=>import(${JSON.stringify(assets[FILES - 1])});`, 'text/javascript');
  add('/index.html', `<!doctype html><html><head><meta charset="utf-8"><script src="/theme-init.js"></script><link rel="stylesheet" href="/assets/style-stable.css"></head><body><div id="root">shell-${version}</div><script type="module" crossorigin src="/assets/app-${appHash}.js"></script></body></html>`, 'text/html');
  add('/theme-init.js', `window.__theme=${JSON.stringify(version)};`, 'text/javascript');
  add('/manifest.json', JSON.stringify({ name: 'x', version }), 'application/json');
  add('/THIRD-PARTY-NOTICES.txt', `avvisi-${version}`, 'text/plain');
  add('/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg"><title>${version}</title></svg>`, 'image/svg+xml');

  // Stesso lavoro del plugin "studia-pwa" di vite.config.ts (closeBundle): ID di build + elenco di precache
  const precache = [...files.keys()].map((f) => f.slice(1)).filter((f) => /^assets\/.+\.(js|css|woff2)$/.test(f) || /^icons\/.+\.(png|svg)$/.test(f) || f === 'manifest.json' || f === 'favicon.svg' || f === 'theme-init.js' || f === 'THIRD-PARTY-NOTICES.txt').map((f) => `/${f}`);
  const sw = fs.readFileSync(swSource, 'utf8').replace(/'__BUILD_ID__'/g, JSON.stringify(`${version}-test`)).replace(/'__PRECACHE__'/g, JSON.stringify(precache));
  add('/service-worker.js', sw, 'text/javascript');
  return { files, precache, cacheName: `studia-${version}-test` };
}

// ------------------------------------------------------------------------------------------------ server finto
let currentDist = null;
let requestLog = [];
let slowHtmlMs = 0;
let server;
const cacheControl = (p) => (p.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache');
const handler = (req, res) => {
  const url = new URL(req.url, 'http://x');
  requestLog.push({ path: url.pathname, mode: req.headers['sec-fetch-mode'], dest: req.headers['sec-fetch-dest'] });
  const known = currentDist.files.get(url.pathname === '/' ? '/index.html' : url.pathname);
  // Come _redirects di Cloudflare ("/* /index.html 200"): qualunque percorso sconosciuto restituisce la shell con stato 200
  const entry = known ?? currentDist.files.get('/index.html');
  const isHtml = entry.type === 'text/html';
  const send = () => {
    res.writeHead(200, { 'content-type': entry.type, 'cache-control': known ? cacheControl(url.pathname) : 'no-cache', 'content-length': Buffer.byteLength(entry.body) });
    res.end(entry.body);
  };
  if (isHtml && url.pathname === '/slow' && slowHtmlMs) setTimeout(send, slowHtmlMs);
  else send();
};
const startServer = (port = 0) => new Promise((resolve) => {
  server = http.createServer(handler);
  server.keepAliveTimeout = 1;
  server.listen(port, '127.0.0.1', () => resolve(server.address().port));
});
const stopServer = () => new Promise((resolve) => { server.closeAllConnections?.(); server.close(() => resolve()); });

// ------------------------------------------------------------------------------------------------ utilità di prova
let failures = 0;
const check = (ok, label, detail = '') => { console.log(`${ok ? '  PASS' : '  FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`); if (!ok) failures++; };
const countFor = (pred) => requestLog.filter(pred).length;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sectionTitle = (s) => console.log(`\n${s}`);

async function waitFor(fn, label, timeout = 15000) {
  const t0 = Date.now();
  for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > timeout) throw new Error(`timeout in attesa di: ${label}`); await sleep(50); }
}

async function main() {
  console.log(`Service worker sotto prova: ${path.relative(projectRoot, swSource)}\nDist finto: ${FILES} file con hash da ~${ASSET_BYTES / 1000} kB, ${CHANGED} cambiano a ogni deploy\n`);
  const changedV2 = []; const changedV3 = [];
  const v1 = makeDist('v1', 'a1', []);
  const v2 = makeDist('v2', 'a2', changedV2);
  const v3 = makeDist('v3', 'a3', changedV3);
  currentDist = v1;
  const port = await startServer();
  const origin = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const cacheNames = () => page.evaluate(async () => (await caches.keys()).sort());
  const cacheKeys = (name) => page.evaluate(async (n) => (await (await caches.open(n)).keys()).map((r) => new URL(r.url).pathname).sort(), name);
  const regState = () => page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return { active: !!r?.active, waiting: !!r?.waiting, installing: !!r?.installing }; });

  try {
    // ---------------------------------------------------------------- 1. prima visita
    sectionTitle('1. Prima visita');
    await page.goto(`${origin}/`, { waitUntil: 'load' });
    // La registrazione parte DOPO il load, come fa pwa.ts: così la pagina scarica già i suoi file prima dell'installazione del SW
    await page.evaluate(() => navigator.serviceWorker.register('/service-worker.js', { updateViaCache: 'none' }).then(() => navigator.serviceWorker.ready).then(() => true));
    await waitFor(async () => (await cacheNames()).length > 0 && (await cacheKeys(v1.cacheName)).length >= v1.precache.length + 1, 'precache della v1 completo');
    const keys1 = await cacheKeys(v1.cacheName);
    check(keys1.includes('/index.html') && v1.precache.every((u) => keys1.includes(u)), 'shell e tutti i file di precache sono in cache', `${keys1.length} voci`);
    const hashedFetchedMoreThanOnce = v1.precache.filter((u) => u.startsWith('/assets/') && countFor((r) => r.path === u) > 1);
    const downloadsV1 = countFor((r) => r.path.startsWith('/assets/'));
    check(hashedFetchedMoreThanOnce.length === 0, 'ogni file con hash è scaricato una sola volta (niente doppio download alla prima visita)', `${downloadsV1} richieste per /assets/ su ${FILES + 2} file`);
    METRICS.firstVisitAssetRequests = downloadsV1;

    // ---------------------------------------------------------------- 2. offline reale
    sectionTitle('2. Offline (il server viene spento davvero)');
    await page.reload({ waitUntil: 'load' }); // ora la pagina è controllata dal SW
    await waitFor(() => page.evaluate(() => !!navigator.serviceWorker.controller), 'pagina controllata dal SW');
    await stopServer();
    await page.reload({ waitUntil: 'load' });
    check((await page.textContent('#root')) === 'app-v1', 'ricarica offline: l\'app si apre dalla cache');
    await page.goto(`${origin}/note/abc123`, { waitUntil: 'load' });
    check((await page.textContent('#root')) === 'app-v1', 'rotta profonda offline (/note/abc123): shell servita dalla cache');
    await page.goto(`${origin}/THIRD-PARTY-NOTICES.txt`, { waitUntil: 'load' });
    check((await page.textContent('body')).includes('avvisi-v1'), 'file statico non HTML in cache (THIRD-PARTY-NOTICES.txt) offline: si apre il file, non la shell');
    await page.goto(`${origin}/note/abc123`, { waitUntil: 'load' });
    const lazy = await page.evaluate(() => window.__lazy().then((m) => m.default));
    check(lazy.startsWith('/assets/chunk'), 'chunk caricato in lazy mentre si è offline', lazy);
    await startServer(port);

    // ---------------------------------------------------------------- 3. deploy v2
    sectionTitle('3. Deploy v2 (cambiano pochi file con hash)');
    currentDist = v2; requestLog = [];
    await page.goto(`${origin}/`, { waitUntil: 'load' });
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
    await waitFor(async () => (await regState()).waiting, 'v2 installata (in attesa)');
    const installed = requestLog.filter((r) => r.path !== '/' && r.path !== '/service-worker.js');
    const unchangedHashed = v2.precache.filter((u) => u.startsWith('/assets/') && !changedV2.includes(u) && !u.includes('app-a2'));
    const redownloaded = unchangedHashed.filter((u) => installed.some((r) => r.path === u));
    const hashedRequests = installed.filter((r) => r.path.startsWith('/assets/')).length;
    METRICS.deployAssetRequests = hashedRequests; METRICS.deployUnchangedRedownloaded = redownloaded.length; METRICS.deployUnchangedTotal = unchangedHashed.length;
    check(redownloaded.length === 0, `file con hash INVARIATI riscaricati: ${redownloaded.length} su ${unchangedHashed.length}`, `richieste /assets/ durante l'installazione: ${hashedRequests}`);
    const newOnes = [...changedV2, '/assets/app-a2.js'];
    check(newOnes.every((u) => installed.some((r) => r.path === u)), `i file cambiati vengono scaricati (${newOnes.length})`);
    const keys2 = await cacheKeys(v2.cacheName);
    check(v2.precache.every((u) => keys2.includes(u)) && keys2.includes('/index.html'), 'la cache v2 è completa (anche con i file copiati)', `${keys2.length} voci`);
    check((await cacheNames()).includes(v1.cacheName), 'la cache v1 resta finché la v2 non è attiva');
    const nonHashedReloaded = ['/theme-init.js', '/manifest.json', '/favicon.svg', '/index.html'].every((u) => installed.some((r) => r.path === u));
    check(nonHashedReloaded, 'i file SENZA hash (theme-init.js, manifest, icone, shell) vengono sempre rivalidati');

    await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => { r.waiting?.postMessage({ type: 'SKIP_WAITING' }); }));
    await waitFor(async () => !(await regState()).waiting, 'v2 attivata');
    check(JSON.stringify(await cacheNames()) === JSON.stringify([v1.cacheName, v2.cacheName].sort()), 'dopo l\'attivazione restano v1 (precedente) e v2', (await cacheNames()).join(', '));

    // ---------------------------------------------------------------- 4. deploy v3
    sectionTitle('4. Deploy v3: pulizia delle cache vecchie');
    currentDist = v3; requestLog = [];
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
    await waitFor(async () => (await regState()).waiting, 'v3 installata');
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => { r.waiting?.postMessage({ type: 'SKIP_WAITING' }); }));
    await waitFor(async () => (await cacheNames()).length === 2, 'pulizia cache');
    check(JSON.stringify(await cacheNames()) === JSON.stringify([v2.cacheName, v3.cacheName].sort()), 'v1 eliminata; restano v2 e v3', (await cacheNames()).join(', '));

    // ---------------------------------------------------------------- 5. rete lenta
    sectionTitle('5. Rete lenta: la navigazione non resta appesa');
    await page.goto(`${origin}/`, { waitUntil: 'load' });
    await waitFor(() => page.evaluate(() => !!navigator.serviceWorker.controller), 'pagina controllata (v3)');
    slowHtmlMs = 9000;
    const t0 = Date.now();
    await page.goto(`${origin}/slow`, { waitUntil: 'load', timeout: 20000 });
    const elapsed = Date.now() - t0;
    slowHtmlMs = 0;
    // Il tempo massimo è quello dichiarato dal service worker sotto prova (così la prova vale anche con --sw su un SW più vecchio)
    const navTimeoutMs = Number(/const NAVIGATION_TIMEOUT_MS = (\d+)/.exec(fs.readFileSync(swSource, 'utf8'))?.[1] ?? 4000);
    check(elapsed < navTimeoutMs + 2500, `rete che risponde dopo 9 s: la shell in cache si apre in ${(elapsed / 1000).toFixed(1)} s`, `limite: ${(navTimeoutMs / 1000).toFixed(1)} s + margine`);
    METRICS.slowNavigationMs = elapsed;

    // ---------------------------------------------------------------- 6. cache avvelenata
    sectionTitle('6. Risposta HTML di ripiego per uno script inesistente');
    const type = await page.evaluate(() => fetch('/assets/inesistente-zzz.js').then((r) => r.headers.get('content-type')));
    await sleep(300); // il salvataggio in cache è asincrono (waitUntil)
    const poisoned = await page.evaluate(async () => !!(await caches.match('/assets/inesistente-zzz.js')));
    check(/text\/html/.test(type), 'il server (come Cloudflare) risponde con HTML a un file inesistente', type);
    check(!poisoned, 'quell\'HTML NON viene salvato in cache al posto dello script');

    // ---------------------------------------------------------------- 7. precarica
    sectionTitle('7. Precarica della navigazione');
    const preload = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return r?.navigationPreload ? (await r.navigationPreload.getState()).enabled : null; });
    check(preload === true, 'navigationPreload attiva', String(preload));
  } finally {
    await browser.close().catch(() => {});
    await stopServer().catch(() => {});
  }

  console.log('\nMetriche (dist finto):', JSON.stringify(METRICS));
  console.log(failures === 0 ? '\nTUTTE LE PROVE SUPERATE' : `\n${failures} PROVA/E FALLITA/E`);
  process.exit(failures === 0 ? 0 : 1);
}
const METRICS = {};
main().catch((e) => { console.error('\nERRORE:', e.message); process.exit(2); });
