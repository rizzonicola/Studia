#!/usr/bin/env node
/**
 * Prova dell'integrazione dei provider React con lo storage REALE del browser (Chromium via Playwright, React vero):
 *   A  chiave API: ricordata (localStorage) oppure solo per la sessione (sessionStorage); nessuna traccia in localStorage in modalità sessione;
 *   B  riavvio del browser simulato con una nuova scheda (sessionStorage vuoto, localStorage conservato);
 *   C  tema e vista sincronizzati fra due schede, senza "rimbalzi" di scritture e senza scritture inutili all'avvio;
 *   D  ErrorBoundary: dopo un errore si ripristina cambiando pagina e mostra il messaggio giusto per errori di rendering e di caricamento.
 *   E  modello di riserva: attivo di default (senza scrivere nulla), disattivazione dell'utente ricordata e sincronizzata fra schede, valore storico "1", nessuna riaccensione involontaria.
 * Uso: node tools/browser-checks/react-hooks-check.mjs      Serve: playwright, esbuild, react/react-dom (npm ci li installa).
 * Variabili: PLAYWRIGHT_MODULE_PATH, ESBUILD_MODULE_PATH, REACT_NODE_PATH (cartella node_modules con react, se non è quella del progetto).
 */
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..', '..');
const require = createRequire(import.meta.url);
const load = (env, names) => { for (const n of [process.env[env], ...names].filter(Boolean)) { try { return require(n); } catch { /* prossimo */ } } throw new Error(`Modulo non trovato: ${names[0]} (imposta ${env})`); };
const { chromium } = load('PLAYWRIGHT_MODULE_PATH', ['playwright', path.join(projectRoot, 'node_modules', 'playwright')]);
const esbuild = load('ESBUILD_MODULE_PATH', ['esbuild', path.join(projectRoot, 'node_modules', 'esbuild')]);

const built = await esbuild.build({
  entryPoints: [path.join(here, 'react-hooks-entry.tsx')], bundle: true, write: false, format: 'iife', target: 'es2022', jsx: 'automatic',
  nodePaths: [process.env.REACT_NODE_PATH, path.join(projectRoot, 'node_modules')].filter(Boolean),
  define: { __APP_VERSION__: '"check"', 'import.meta.env.PROD': 'false', 'import.meta.env.DEV': 'true', 'process.env.NODE_ENV': '"development"' }, logLevel: 'error',
});
const server = http.createServer((req, res) => {
  if (req.url === '/b.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(built.outputFiles[0].text); }
  else { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><div id="root"></div><script src="/b.js"></script>'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;

let failures = 0;
const check = (ok, label, detail = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`); if (!ok) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const KEY = 'AIzaSyFAKE-fake-fake-fake-fake-fake-fake01'; // chiave finta
const browser = await chromium.launch();
const context = await browser.newContext();
const open = async () => { const p = await context.newPage(); p.on('pageerror', (e) => console.log('  [errore pagina]', e.message)); await p.goto(url); await p.waitForFunction(() => !!window.__settings && !!window.__theme); return p; };
const stores = (p) => p.evaluate((k) => ({ localHasKey: Object.keys(localStorage).some((n) => (localStorage.getItem(n) ?? '').includes('AIza')), sessionHasKey: (sessionStorage.getItem('studia_gemini_api_key') ?? '') === k, flag: localStorage.getItem('studia_key_session_only'), localKeyName: localStorage.getItem('studia_gemini_api_key') !== null }), KEY);
const settings = (p) => p.evaluate(() => ({ apiKey: window.__settings.apiKey, remember: window.__settings.rememberKey }));

try {
  const A = await open();
  console.log('A. Chiave API');
  check(JSON.stringify(await settings(A)) === JSON.stringify({ apiKey: null, remember: true }), 'primo avvio: nessuna chiave, "ricorda" attivo (comportamento storico)');
  await A.evaluate((k) => window.__settings.setApiKey(k), KEY); await sleep(50);
  let s = await stores(A);
  check(s.localKeyName && !s.sessionHasKey && s.flag === null, 'ricordata: la chiave sta in localStorage, nulla in sessionStorage, nessun flag', JSON.stringify(s));
  await A.evaluate(() => window.__settings.setRememberKey(false)); await sleep(50);
  s = await stores(A);
  check(!s.localHasKey && s.sessionHasKey && s.flag === '1', 'passando a "solo sessione" la chiave SPARISCE da localStorage (nessun valore con "AIza") e passa in sessionStorage', JSON.stringify(s));
  check((await settings(A)).apiKey === KEY, 'la chiave resta utilizzabile in questa scheda senza reinserirla');
  const B = await open(); // altra scheda = sessionStorage nuovo; localStorage condiviso (come dopo aver riaperto il browser)
  const sb = await settings(B);
  check(sb.apiKey === null && sb.remember === false, 'nuova scheda/riavvio: la chiave non c\'è più, la preferenza "solo sessione" resta', JSON.stringify(sb));
  await B.evaluate((k) => window.__settings.setApiKey(k), KEY); await sleep(50);
  s = await stores(B);
  check(!s.localHasKey && s.sessionHasKey, 'reinserendola con la preferenza "solo sessione" non viene scritta in localStorage');
  await B.evaluate((k) => window.__settings.setApiKey(k, true), KEY); await sleep(50);
  s = await stores(B);
  check(s.localKeyName && !s.sessionHasKey && s.flag === null, 'scegliendo "ricorda" torna in localStorage e il flag sparisce');
  await sleep(200);
  check((await settings(A)).apiKey === KEY && (await settings(A)).remember === true, 'l\'altra scheda segue la modifica (evento storage)', JSON.stringify(await settings(A)));
  await B.evaluate(() => window.__settings.clearApiKey()); await sleep(100);
  s = await stores(B);
  check(!s.localHasKey && !s.sessionHasKey, 'eliminando la chiave sparisce da entrambi i posti');
  await B.close();

  console.log('\nC. Tema e vista fra due schede');
  const T1 = await open(); const T2 = await open();
  const w1 = await T1.evaluate(() => ({ ...window.__writes }));
  await T1.reload(); await T1.waitForFunction(() => !!window.__theme);
  const w2 = await T1.evaluate(() => ({ ...window.__writes }));
  check(!('studia_theme_config' in w2) && !('studia_theme_boot' in w2), 'riavvio con tema invariato: nessuna scrittura inutile su localStorage', `primo avvio: ${JSON.stringify(w1)} | riavvio: ${JSON.stringify(w2)}`);
  await T1.evaluate(() => window.__theme.updateConfig({ mode: 'dark' })); await sleep(600);
  check((await T2.evaluate(() => window.__theme.config.mode)) === 'dark', 'cambio di modalità in una scheda → l\'altra lo segue');
  check(!(await T2.evaluate(() => ({ ...window.__writes }))).studia_theme_config, 'la scheda che segue NON riscrive (nessun rimbalzo)');
  await T2.evaluate(() => window.__theme.setViewMode('list')); await sleep(300);
  check((await T1.evaluate(() => window.__theme.viewMode)) === 'list', 'vista griglia/elenco sincronizzata');
  await T1.close(); await T2.close();

  console.log('\nD. ErrorBoundary');
  const E = await open();
  const text = async () => (await E.textContent('#boundary')).replace(/\s+/g, ' ').trim();
  check((await text()) === 'app.renderErrorapp.reload', 'errore di rendering → messaggio generico', await text());
  await E.evaluate(() => window.__go('/a', 'ok'));
  check((await text()) === 'app.renderErrorapp.reload', 'restando sulla stessa pagina l\'errore resta');
  await E.evaluate(() => window.__go('/b', 'ok'));
  check((await text()) === 'contenuto ok', 'cambiando pagina l\'errore viene dimenticato (prima restava fino al ricaricamento)');
  await E.evaluate(() => window.__go('/c', 'chunk'));
  check((await text()) === 'app.chunkErrorapp.reload', 'errore di caricamento di un file → messaggio "controlla la connessione"', await text());
  await E.close();

  console.log('\nE. Modello di riserva (attivo di default)');
  const FB_KEYS = ['studia_fallback_enabled', 'studia_fallback_model', 'studia_gemini_model'];
  const fb = (p) => p.evaluate(() => ({ enabled: window.__settings.fallbackEnabled, name: window.__settings.fallbackModel, main: window.__settings.model }));
  const fbFlag = (p) => p.evaluate(() => localStorage.getItem('studia_fallback_enabled'));
  const reloadSettings = async (p) => { await p.reload(); await p.waitForFunction(() => !!window.__settings); };
  const F1 = await open();
  await F1.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), FB_KEYS); // parte da un browser senza scelte salvate
  await reloadSettings(F1);
  let f = await fb(F1);
  check(f.enabled === true && !!f.name && f.name !== f.main, 'primo avvio: riserva ATTIVA di default, con un nome valido e diverso dal modello principale', JSON.stringify(f));
  const w = await F1.evaluate(() => ({ ...window.__writes }));
  check((await fbFlag(F1)) === null && !('studia_fallback_enabled' in w), 'e all\'avvio non scrive nulla: in localStorage restano solo le scelte esplicite', JSON.stringify(w));
  await F1.evaluate(() => window.__settings.setFallbackEnabled(false)); await sleep(50);
  f = await fb(F1);
  check(!f.enabled && (await fbFlag(F1)) === '0', 'disattivata dall\'utente: spenta e salvata come "0"', `${JSON.stringify(f)} | flag: ${await fbFlag(F1)}`);
  await reloadSettings(F1);
  check(!(await fb(F1)).enabled, 'dopo il riavvio la scelta dell\'utente resta: riserva spenta');
  await F1.evaluate(() => window.__settings.setFallbackModel('gemini-prova-x')); await sleep(50);
  f = await fb(F1);
  check(f.name === 'gemini-prova-x' && !f.enabled, 'cambiare il nome della riserva NON la riaccende (conta solo l\'interruttore)', JSON.stringify(f));
  await F1.evaluate(() => window.__settings.resetFallbackModel()); await sleep(50);
  check(!(await fb(F1)).enabled, 'ripristinare il nome predefinito non la riaccende');

  const F2 = await open(); // altra scheda: localStorage condiviso
  check(!(await fb(F2)).enabled, 'una nuova scheda trova la riserva spenta (la scelta sta in localStorage)');
  await F2.evaluate(() => window.__settings.setFallbackEnabled(true)); await sleep(250);
  check((await fbFlag(F2)) === null && (await fb(F1)).enabled, 'riattivandola in una scheda si torna al predefinito: la chiave sparisce e l\'altra scheda la segue (evento storage)', `flag: ${await fbFlag(F2)} | altra scheda: ${JSON.stringify(await fb(F1))}`);
  check(!('studia_fallback_enabled' in (await F1.evaluate(() => ({ ...window.__writes })))), 'la scheda che segue non riscrive nulla (nessun rimbalzo)');

  await F1.evaluate(() => localStorage.setItem('studia_fallback_enabled', '1')); await reloadSettings(F1);
  check((await fb(F1)).enabled, 'valore storico "1" (scritto dalle versioni precedenti) = riserva attiva');
  await F1.evaluate(() => window.__settings.setFallbackEnabled(false)); await sleep(50);
  check(!(await fb(F1)).enabled && (await fbFlag(F1)) === '0', 'e si può spegnere: "1" diventa "0"');

  await F1.evaluate(() => window.__settings.setFallbackEnabled(true)); await sleep(50); // torna al predefinito
  f = await fb(F1);
  await F1.evaluate((name) => window.__settings.setModel(name), f.name); await sleep(50);
  check(!(await fb(F1)).enabled, 'con il modello principale uguale a quello di riserva la riserva non è attiva (non avrebbe senso)');
  await F1.evaluate(() => window.__settings.resetModel()); await sleep(50);
  check((await fb(F1)).enabled, 'tornando a un principale diverso la riserva (attiva di default) si riattiva da sola');
  await F1.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), FB_KEYS);
  await F1.close(); await F2.close();
} finally {
  await browser.close();
  server.close();
}
console.log(failures === 0 ? '\nTUTTE LE PROVE SUPERATE' : `\n${failures} PROVA/E FALLITA/E`);
process.exit(failures === 0 ? 0 : 1);
