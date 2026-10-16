#!/usr/bin/env node
/**
 * Verifica in un browser VERO (Chromium via Playwright) dei colori delle barre di sistema legati al tema dell'app:
 *
 *  - BARRA DI STATO (<meta name="theme-color">): l'HTML parte con DUE meta (chiaro/scuro del dispositivo, per il primo disegno); appena il
 *    tema dell'app è noto devono diventare UNA sola, senza media query, con il colore del tema scelto NELL'APP anche se diverso da quello
 *    del dispositivo. Lo fanno public/theme-init.js (prima del primo render) e utils/themeEngine.ts → applyThemeColorMeta (a ogni cambio).
 *
 *  - BARRA DI NAVIGAZIONE DI ANDROID (in basso): la colora il browser con il theme_color del manifest, letto quando installa o aggiorna
 *    l'app (nessuna API web la cambia a runtime). Per questo il sito collega a <link rel="manifest"> il manifest della palette in uso
 *    (public/manifests/<colore>.json, vedi utils/manifestVariants.ts): qui si controlla che per OGNI palette (le 16 predefinite, più
 *    colori personalizzati) il manifest collegato sia quello con lo sfondo giusto, sia all'avvio (theme-init.js, con uno snapshot prodotto
 *    dal vero buildBootSnapshot) sia a ogni cambio di tema (applyThemeToDocument).
 *
 * Uso:   node tools/browser-checks/theme-color-check.mjs
 * Serve: `npm i -D playwright` + `npx playwright install chromium`; esbuild c'è già (lo porta vite).
 * Variabili: PLAYWRIGHT_MODULE_PATH, ESBUILD_MODULE_PATH per indicare dove trovare i due pacchetti.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);
const load = (envName, names) => {
  for (const n of [process.env[envName], ...names].filter(Boolean)) { try { return require(n); } catch { /* prossimo */ } }
  throw new Error(`Modulo non trovato (${names[0]}). Installalo o imposta ${envName}.`);
};
const { chromium } = load('PLAYWRIGHT_MODULE_PATH', ['playwright', path.join(projectRoot, 'node_modules', 'playwright')]);
const esbuild = load('ESBUILD_MODULE_PATH', ['esbuild', path.join(projectRoot, 'node_modules', 'esbuild')]);

const built = await esbuild.build({
  stdin: {
    contents: `
      import { applyThemeColorMeta, applyThemeToDocument, buildBootSnapshot, computeTheme } from './utils/themeEngine';
      import { DARK_PRESETS, LIGHT_PRESETS, defaultThemeConfig } from './config/themes';
      window.engine = { applyThemeColorMeta, applyThemeToDocument, buildBootSnapshot, computeTheme, DARK_PRESETS, LIGHT_PRESETS, defaultThemeConfig };`,
    resolveDir: projectRoot,
    sourcefile: 'theme-entry.ts',
    loader: 'ts',
  },
  bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022', logLevel: 'error',
});
const bundle = built.outputFiles[0].text;
const themeInit = fs.readFileSync(path.join(projectRoot, 'public', 'theme-init.js'), 'utf8');
const head = `<meta charset="utf-8">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#282c35" />
<link rel="manifest" href="/manifest.json" />`;
const server = http.createServer((req, res) => {
  const send = (type, body) => { res.writeHead(200, { 'content-type': type }); res.end(body); };
  if (req.url === '/theme-init.js') send('text/javascript', themeInit);
  else if (req.url === '/bundle.js') send('text/javascript', bundle);
  else if (req.url.startsWith('/bare')) send('text/html', '<!doctype html><head><meta charset="utf-8"><script src="/bundle.js"></script></head><body></body>'); // senza meta né manifest
  else send('text/html', `<!doctype html><head>${head}<script src="/theme-init.js"></script><script src="/bundle.js"></script></head><body></body>`);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://localhost:${server.address().port}`;

let failures = 0;
const check = (ok, label, detail = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`); if (!ok) failures++; };
const metas = (page) => page.evaluate(() => [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => ({ content: m.getAttribute('content'), media: m.getAttribute('media') })));
const manifestHref = (page) => page.evaluate(() => document.querySelector('link[rel="manifest"]')?.getAttribute('href') ?? null);
/** Indirizzo atteso del manifest per uno sfondo che ha il suo file (il tema «Classico» usa il manifest di base). */
const manifestFor = (bg) => (bg.toLowerCase() === '#f9fafb' ? '/manifest.json' : `/manifests/${bg.slice(1).toLowerCase()}.json`);

const browser = await chromium.launch();
try {
  /** Snapshot prodotto dal VERO buildBootSnapshot per una configurazione ritoccata da `edit`. */
  const engine = await (await browser.newContext()).newPage();
  await engine.goto(`${base}/bare`);
  const snapshotFor = (edit) => engine.evaluate((editSource) => {
    const cfg = window.engine.defaultThemeConfig();
    new Function('cfg', editSource)(cfg);
    return JSON.stringify(window.engine.buildBootSnapshot(cfg));
  }, edit);

  const open = async (deviceScheme, stored) => {
    const ctx = await browser.newContext({ colorScheme: deviceScheme });
    if (stored) await ctx.addInitScript((s) => localStorage.setItem('studia_theme_boot', s), stored);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => check(false, 'errore JavaScript nella pagina', e.message));
    await page.goto(`${base}/`);
    return page;
  };

  console.log('\nBARRA DI STATO – theme-init.js (prima del primo render)');
  let page = await open('light', null);
  let m = await metas(page);
  check(m.length === 2 && Boolean(m[0].media) && Boolean(m[1].media), 'prima visita (nessuno snapshot): le due meta restano, seguono il dispositivo', JSON.stringify(m));
  for (const [device, mode, expected, label] of [
    ['dark', 'dark', '#282c35', 'app scura su dispositivo scuro'],
    ['light', 'dark', '#282c35', 'app FORZATA scura su dispositivo CHIARO: vince l\'app'],
    ['dark', 'light', '#ffffff', 'app FORZATA chiara su dispositivo SCURO: vince l\'app'],
    ['dark', 'system', '#282c35', 'modalità «sistema» su dispositivo scuro'],
    ['light', 'system', '#ffffff', 'modalità «sistema» su dispositivo chiaro'],
  ]) {
    m = await metas(await open(device, await snapshotFor(`cfg.mode = '${mode}';`)));
    check(m.length === 1 && m[0].media === null && m[0].content === expected, `${label}: una sola meta, senza media, ${expected}`, JSON.stringify(m));
  }
  check((await metas(await open('light', '{"v":99}'))).length === 2, 'snapshot di formato sconosciuto: non fa nulla');
  check((await metas(await open('light', '{rotto'))).length === 2, 'snapshot corrotto: non blocca l\'avvio e non fa nulla');

  console.log('\nBARRA DI STATO – applyThemeColorMeta (a ogni cambio di tema)');
  page = await open('dark', null);
  await page.evaluate(() => window.engine.applyThemeColorMeta('#112233'));
  m = await metas(page);
  check(m.length === 1 && m[0].content === '#112233' && m[0].media === null, 'dalle due meta iniziali ne resta una, senza media, col colore nuovo', JSON.stringify(m));
  await page.evaluate(() => { for (let i = 0; i < 5; i++) window.engine.applyThemeColorMeta(i % 2 ? '#0c9488' : '#aabbcc'); });
  m = await metas(page);
  check(m.length === 1 && m[0].content === '#aabbcc', 'cambi ripetuti: sempre una sola meta, con l\'ultimo colore');
  check(await page.evaluate(() => { const a = document.querySelector('meta[name="theme-color"]'); window.engine.applyThemeColorMeta('#aabbcc'); return a === document.querySelector('meta[name="theme-color"]'); }), 'stesso colore: nessuna riscrittura inutile');
  const bare = await (await browser.newContext()).newPage();
  await bare.goto(`${base}/bare`);
  await bare.evaluate(() => window.engine.applyThemeColorMeta('#123456'));
  m = await metas(bare);
  check(m.length === 1 && m[0].content === '#123456', 'senza nessuna meta di partenza: la crea');

  console.log('\nBARRA DI NAVIGAZIONE – manifest collegato all\'avvio (theme-init.js, snapshot del vero buildBootSnapshot)');
  page = await open('light', null);
  check((await manifestHref(page)) === '/manifest.json', 'prima visita, dispositivo chiaro: manifest di base', String(await manifestHref(page)));
  page = await open('dark', null);
  check((await manifestHref(page)) === '/manifests/20232a.json', 'prima visita, dispositivo scuro: manifest del tema scuro predefinito', String(await manifestHref(page)));
  for (const [device, edit, expected, label] of [
    ['light', "cfg.mode = 'dark'; cfg.dark.preset = 'midnight';", '/manifests/0b1120.json', 'app scura «Midnight» su dispositivo CHIARO'],
    ['dark', "cfg.mode = 'light'; cfg.light.preset = 'mint';", '/manifests/eef6f3.json', 'app chiara «Mint» su dispositivo SCURO'],
    ['dark', "cfg.mode = 'system'; cfg.dark.preset = 'ocean';", '/manifests/0c1a20.json', 'modalità «sistema», dispositivo scuro, «Ocean»'],
    ['light', "cfg.mode = 'system';", '/manifest.json', 'modalità «sistema», dispositivo chiaro, tema predefinito'],
    ['light', "cfg.mode = 'dark'; cfg.dark.custom = { bg: '#21242b' };", '/manifests/20232a.json', 'sfondo scuro personalizzato (#21242b): la palette più vicina (Ardesia)'],
    ['light', "cfg.mode = 'dark'; cfg.dark.custom = { bg: '#040404' };", '/manifests/000000.json', 'sfondo scuro personalizzato (#040404): la palette più vicina (nero)'],
  ]) {
    page = await open(device, await snapshotFor(edit));
    check((await manifestHref(page)) === expected, `${label}: ${expected}`, String(await manifestHref(page)));
  }
  // Snapshot scritti da una versione precedente (senza «manifest») o con indirizzi non validi: il manifest resta quello di base
  const legacy = JSON.parse(await snapshotFor("cfg.mode = 'dark';"));
  delete legacy.dark.manifest;
  delete legacy.light.manifest;
  check((await manifestHref(await open('dark', JSON.stringify(legacy)))) === '/manifest.json', 'snapshot vecchio (senza «manifest»): resta il manifest di base');
  for (const bad of ['https://evil.test/m.json', '/manifests/zz.json', '/manifests/20232a.json.bak', '//evil.test/manifest.json', '/altro.json', 'javascript:alert(1)']) {
    const s = JSON.parse(await snapshotFor("cfg.mode = 'dark';"));
    s.dark.manifest = bad;
    check((await manifestHref(await open('dark', JSON.stringify(s)))) === '/manifest.json', `indirizzo non valido nello snapshot («${bad}»): ignorato`);
  }

  console.log('\nBARRA DI NAVIGAZIONE – ogni palette, a ogni cambio di tema (applyThemeToDocument)');
  page = await open('light', null);
  const palettes = await page.evaluate(() => [...window.engine.LIGHT_PRESETS, ...window.engine.DARK_PRESETS].map((p) => ({ id: p.id, scheme: p.scheme, bg: p.tokens.bg })));
  check(palettes.length === 16, '16 palette predefinite (7 chiare + 9 scure)', String(palettes.length));
  for (const p of palettes) {
    const got = await page.evaluate(({ id, scheme }) => {
      const cfg = window.engine.defaultThemeConfig();
      cfg[scheme].preset = id;
      const result = window.engine.computeTheme(cfg, scheme);
      window.engine.applyThemeToDocument(result);
      return { bg: result.palette.bg, href: document.querySelector('link[rel="manifest"]').getAttribute('href') };
    }, p);
    check(got.bg.toLowerCase() === p.bg.toLowerCase() && got.href === manifestFor(p.bg), `${p.scheme === 'dark' ? 'scuro' : 'chiaro'} «${p.id}» (sfondo ${p.bg}) → ${manifestFor(p.bg)}`, got.href);
  }
  await page.evaluate(() => document.querySelector('link[rel="manifest"]').remove());
  check(await page.evaluate(() => { try { window.engine.applyThemeToDocument(window.engine.computeTheme(window.engine.defaultThemeConfig(), 'dark')); return true; } catch { return false; } }), 'senza <link rel="manifest"> nella pagina non va in errore');
} finally {
  await browser.close();
  server.close();
}
console.log(failures ? `\n${failures} prove FALLITE` : '\nTutte le prove superate');
process.exit(failures ? 1 : 0);
