#!/usr/bin/env node
/**
 * Verifica in un browser VERO (Chromium via Playwright) dell'indicatore di stato nell'intestazione (components/StatusIndicatorView.tsx),
 * che ha sostituito la barra di caricamento a tutta larghezza (su telefono copriva le schede Notes/Upload/Camera sotto l'intestazione).
 * Il componente è quello vero, compilato con esbuild; solo le icone sono finte. Gli stili sono quelli di Tailwind riscritti a mano per le
 * sole classi usate: contano posizioni e comportamento, non l'estetica.
 *
 *   A RIPOSO      nessun pulsante; le aree per gli screen reader (stato ed errore) ci sono, vuote;
 *   ELABORAZIONE  rotella che gira, schede sotto l'intestazione NON coperte, pannello con messaggio completo e tempo trascorso che avanza,
 *                 «Annulla», chiusura con Esc / tocco fuori / Tab, il pannello si chiude da solo a fine elaborazione;
 *   ERRORE        triangolo, pannello con l'errore completo (anche lungo, che scorre) e «Chiudi»; annuncio come alert;
 *   LAYOUT        telefono 360 px: pannello a tutta larghezza sotto l'intestazione; desktop: riquadro ancorato al pulsante, dentro lo schermo.
 *
 * Uso:   node tools/browser-checks/status-indicator-check.mjs
 * Serve: `npm i -D playwright` + `npx playwright install chromium`; esbuild c'è già (lo porta vite).
 * Variabili: PLAYWRIGHT_MODULE_PATH, ESBUILD_MODULE_PATH per indicare dove trovare i due pacchetti.
 */
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..', '..');
const require = createRequire(import.meta.url);
const load = (envName, names) => {
  for (const n of [process.env[envName], ...names].filter(Boolean)) { try { return require(n); } catch { /* prossimo */ } }
  throw new Error(`Modulo non trovato (${names[0]}). Installalo o imposta ${envName}.`);
};
const { chromium } = load('PLAYWRIGHT_MODULE_PATH', ['playwright', path.join(projectRoot, 'node_modules', 'playwright')]);
const esbuild = load('ESBUILD_MODULE_PATH', ['esbuild', path.join(projectRoot, 'node_modules', 'esbuild')]);

const built = await esbuild.build({
  entryPoints: [path.join(here, 'status-indicator-entry.tsx')],
  bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022', jsx: 'automatic', logLevel: 'error',
  alias: { 'lucide-react': path.join(here, 'stubs', 'lucide.tsx') },
  define: { 'process.env.NODE_ENV': '"production"' },
});
const bundle = built.outputFiles[0].text;

const css = `
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#f9fafb;color:#111}button{font:inherit;cursor:pointer;background:none;border:0;color:inherit}a{color:inherit;text-decoration:none}
.hdr{position:fixed;top:0;left:0;right:0;height:4rem;background:#fff;z-index:50;border-bottom:1px solid #e5e7eb}.hdr-inner{display:flex;align-items:center;height:4rem;padding:0 1rem}.gear{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:9999px}
.subnav{position:fixed;top:4rem;left:0;right:0;display:flex;gap:8px;padding:8px 1rem;z-index:30;background:#f9fafb}.subnav button{min-height:44px;padding:0 16px;border-radius:9999px;background:#e5e7eb}.content{padding-top:9rem}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border-width:0}
.relative{position:relative}.fixed{position:fixed}.absolute{position:absolute}.flex{display:flex}.inline-flex{display:inline-flex}.items-center{align-items:center}.items-start{align-items:flex-start}.justify-center{justify-content:center}
.gap-1{gap:.25rem}.gap-3{gap:.75rem}.h-11{height:2.75rem}.w-11{width:2.75rem}.min-h-11{min-height:2.75rem}.w-full{width:100%}.shrink-0{flex-shrink:0}.min-w-0{min-width:0}.flex-1{flex:1 1 0%}
.rounded-full{border-radius:9999px}.rounded-xl{border-radius:.75rem}.rounded-lg{border-radius:.5rem}.border{border:1px solid}.border-t{border-top:1px solid}.border-gray-200{border-color:#e5e7eb}.border-gray-300{border-color:#d1d5db}
.bg-surface{background:#fff}.bg-red-50{background:#fef2f2}.bg-accent-soft{background:#ccfbf1}.text-red-700{color:#b91c1c}.text-accent-ink{color:#0f766e}.text-gray-900{color:#111827}.text-gray-800{color:#1f2937}.text-gray-700{color:#374151}.text-gray-600{color:#4b5563}
.hover\\:bg-red-100:hover{background:#fee2e2}.hover\\:bg-gray-100:hover{background:#f3f4f6}.p-4{padding:1rem}.px-4{padding-left:1rem;padding-right:1rem}.pt-4{padding-top:1rem}
.mt-0\\.5{margin-top:.125rem}.mt-1{margin-top:.25rem}.mt-3{margin-top:.75rem}.mt-4{margin-top:1rem}.text-sm{font-size:.875rem;line-height:1.25rem}.text-xs{font-size:.75rem;line-height:1rem}.font-semibold{font-weight:600}.font-medium{font-weight:500}
.text-left{text-align:left}.tabular-nums{font-variant-numeric:tabular-nums}.max-h-56{max-height:14rem}.select-text{user-select:text}.overflow-y-auto{overflow-y:auto}.whitespace-pre-wrap{white-space:pre-wrap}.break-words{overflow-wrap:break-word}
.shadow-xl{box-shadow:0 20px 25px -5px rgba(0,0,0,.1),0 8px 10px -6px rgba(0,0,0,.1)}.outline-none{outline:2px solid transparent;outline-offset:2px}.transition-colors{transition-property:color,background-color,border-color;transition-duration:.15s}
.left-3{left:.75rem}.right-3{right:.75rem}.top-\\[4\\.25rem\\]{top:4.25rem}.z-50{z-index:50}@keyframes spin{to{transform:rotate(360deg)}}.animate-spin{animation:spin 1s linear infinite}
@media (prefers-reduced-motion:reduce){.motion-reduce\\:animate-none{animation:none}}
@media (min-width:640px){.sm\\:gap-2{gap:.5rem}.sm\\:absolute{position:absolute}.sm\\:left-auto{left:auto}.sm\\:right-0{right:0}.sm\\:top-full{top:100%}.sm\\:mt-2{margin-top:.5rem}.sm\\:w-80{width:20rem}}
:focus-visible{outline:2px solid #111827;outline-offset:2px}`;

let failures = 0;
const check = (ok, label, detail = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`); if (!ok) failures++; };
const section = (s) => console.log(`\n${s}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T = 'button[aria-controls], button[aria-expanded]';
const PANEL = '[role="region"]';
const set = (page, patch) => page.evaluate((p) => window.__setState(p), patch);
const rect = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; }, sel);
const tabsFree = (page) => page.evaluate(() => [...document.querySelectorAll('.subnav button')].every((b) => { const r = b.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return el === b || b.contains(el); }));
const LONG_ERROR = `Google ha risposto con un errore (503): il servizio è temporaneamente sovraccarico.\n${'Dettaglio tecnico della richiesta fallita. '.repeat(40)}\nRiprova tra qualche minuto.`;

const browser = await chromium.launch();
async function open(context) {
  const page = await context.newPage();
  page.on('pageerror', (e) => check(false, 'errore JavaScript nella pagina', e.message));
  await page.setContent(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style><div id="root"></div>`);
  await page.addScriptTag({ content: bundle });
  await page.waitForSelector('header');
  return page;
}

try {
  section('A RIPOSO');
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await open(ctx);
    check((await page.$(T)) === null, 'nessun pulsante quando non c\'è nulla da mostrare');
    check((await page.$$('[role="status"]')).length === 1 && (await page.$$('[role="alert"]')).length === 1, 'le aree per gli screen reader (stato ed errore) esistono già, vuote');
    check((await page.textContent('[role="status"]')) === '' && (await page.textContent('[role="alert"]')) === '', 'e sono vuote');
    await ctx.close();
  }

  section('ELABORAZIONE – telefono 360×640 (tocco)');
  {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
    const page = await open(ctx);
    const MESSAGE = 'Google sta limitando le richieste. Nuovo tentativo automatico tra 12 s...';
    await set(page, { isProcessing: true, statusMessage: MESSAGE });
    await page.waitForSelector(T);
    check((await page.getAttribute(T, 'aria-label')) === 'Processing: tap for details', 'pulsante con nome accessibile «Processing: tap for details»');
    check((await page.getAttribute(T, 'aria-expanded')) === 'false', 'chiuso: aria-expanded=false');
    check(await page.$eval(`${T} svg`, (s) => s.classList.contains('animate-spin')), 'l\'icona è la rotella che gira');
    const trigger = await rect(page, T);
    check(trigger.width >= 44 && trigger.height >= 44, 'bersaglio da tocco di almeno 44 px', `${trigger.width}×${trigger.height}`);
    check(await tabsFree(page), 'le schede sotto l\'intestazione NON sono coperte (prima la barra a tutta larghezza le copriva)');
    check((await page.textContent('[role="status"]')) === MESSAGE, 'lo screen reader riceve il messaggio di stato');

    await page.tap(T); await page.waitForSelector(PANEL); await sleep(60);
    const panel = await rect(page, PANEL);
    check((await page.getAttribute(T, 'aria-expanded')) === 'true' && (await page.getAttribute(T, 'aria-controls')) === (await page.getAttribute(PANEL, 'id')), 'aperto: aria-expanded=true e aria-controls punta al pannello');
    check(Math.abs(panel.left - 12) <= 1 && Math.abs(360 - panel.right - 12) <= 1 && Math.abs(panel.top - 68) <= 1, 'su telefono il pannello è a tutta larghezza (margini 12 px) subito sotto l\'intestazione', `${panel.left.toFixed(0)}–${panel.right.toFixed(0)}, top ${panel.top.toFixed(0)}`);
    check((await page.textContent(PANEL)).includes(MESSAGE), 'mostra il messaggio COMPLETO (nella vecchia barra veniva troncato)');
    check((await page.textContent(PANEL)).includes('Running for 0:00'), 'mostra da quanto dura l\'elaborazione', (await page.textContent(PANEL)).match(/Running for [\d:]+/)?.[0]);
    await sleep(2200);
    check(/Running for 0:0[2-3]/.test(await page.textContent(PANEL)), 'il tempo avanza da solo', (await page.textContent(PANEL)).match(/Running for [\d:]+/)?.[0]);
    check(await page.$eval(PANEL, (e) => !!e.querySelector('button')) && (await page.textContent(PANEL)).includes('Cancel processing'), 'c\'è il pulsante «Cancel processing»');

    await page.tap(`${PANEL} button`);
    check((await page.evaluate(() => window.__calls.cancel)) === 1, 'tocco su «Annulla»: viene chiamata onCancel');

    await page.touchscreen.tap(180, 560); // tocco fuori dal pannello (nell'area del contenuto): chiude
    await sleep(60);
    check((await page.$(PANEL)) === null, 'tocco fuori: il pannello si chiude');
    check(await tabsFree(page), 'a pannello chiuso le schede tornano libere');

    await page.tap(T); await page.waitForSelector(PANEL);
    await page.tap(`${PANEL} p:first-of-type`); await sleep(60);
    check((await page.$(PANEL)) !== null, 'un tocco sul testo del pannello NON lo chiude');
    await set(page, { isProcessing: false, statusMessage: '' }); await sleep(60);
    check((await page.$(PANEL)) === null && (await page.$(T)) === null, 'a fine elaborazione il pannello si chiude e il pulsante sparisce');
    await ctx.close();
  }

  section('ELABORAZIONE – desktop 1280×800 (mouse e tastiera)');
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await open(ctx);
    await set(page, { isProcessing: true, statusMessage: 'Caricamento del file su Google...' });
    await page.waitForSelector(T);
    await page.click(T); await page.waitForSelector(PANEL); await sleep(60);
    const t = await rect(page, T), panel = await rect(page, PANEL);
    check(Math.abs(panel.right - t.right) <= 1 && Math.abs(panel.width - 320) <= 1 && panel.top >= t.bottom, 'da sm in su è un riquadro di 20 rem ancorato al pulsante, allineato a destra e sotto di esso', `larghezza ${panel.width}`);
    check(panel.left >= 0 && panel.right <= 1280 && panel.bottom <= 800, 'resta dentro lo schermo');
    check((await page.evaluate(() => getComputedStyle(document.querySelector('[role="region"]')).position)) === 'absolute', 'posizione assoluta (non fissa) su schermo largo');

    await page.keyboard.press('Escape'); await sleep(40);
    check((await page.$(PANEL)) === null, 'Esc: chiude');
    check(await page.evaluate(() => document.activeElement === document.querySelector('button[aria-expanded]')), 'Esc: il fuoco torna sul pulsante');

    await page.keyboard.press('Enter'); await page.waitForSelector(PANEL);
    check(true, 'Invio sul pulsante: apre');
    await page.keyboard.press('Tab'); // dal pulsante al «Cancel processing» dentro il pannello
    check(await page.evaluate(() => document.activeElement?.textContent === 'Cancel processing'), 'Tab dal pulsante porta al «Cancel processing» nel pannello (ordine naturale)');
    await page.keyboard.press('Tab'); await sleep(60); // esce dal componente (verso le Impostazioni)
    check((await page.$(PANEL)) === null, 'Tab fuori dal componente: il pannello si chiude');

    await page.click(T); await page.waitForSelector(PANEL);
    await page.mouse.click(40, 700); await sleep(60);
    check((await page.$(PANEL)) === null, 'clic fuori: chiude');
    await ctx.close();
  }

  section('ERRORE');
  {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const page = await open(ctx);
    await set(page, { error: LONG_ERROR });
    await page.waitForSelector(T);
    check((await page.getAttribute(T, 'aria-label')) === 'Error: tap to see the details', 'pulsante con nome «Error: tap to see the details»');
    check(!(await page.$eval(`${T} svg`, (s) => s.classList.contains('animate-spin'))), 'l\'icona è il triangolo (non gira)');
    check((await page.evaluate(() => getComputedStyle(document.querySelector('button[aria-expanded]')).color)) === 'rgb(185, 28, 28)', 'triangolo rosso');
    check((await page.textContent('[role="alert"]')).startsWith('Google ha risposto con un errore'), 'lo screen reader riceve l\'errore come alert');
    check(await tabsFree(page), 'le schede sotto l\'intestazione NON sono coperte');

    await page.tap(T); await page.waitForSelector(PANEL); await sleep(60);
    check((await page.textContent(PANEL)).includes('Something went wrong'), 'il pannello ha il titolo');
    const scroll = await page.$eval(`${PANEL} p.select-text`, (e) => ({ client: e.clientHeight, scroll: e.scrollHeight, text: e.textContent }));
    check(scroll.text === LONG_ERROR, 'mostra l\'errore COMPLETO, identico (anche con le righe a capo)');
    check(scroll.scroll > scroll.client, 'un errore lungo scorre dentro il pannello invece di allungarlo', `${scroll.client}/${scroll.scroll}`);
    const panel = await rect(page, PANEL);
    check(panel.bottom <= 640, 'il pannello resta dentro lo schermo anche con un errore lungo', `fondo ${panel.bottom.toFixed(0)}`);
    check((await page.textContent(`${PANEL} button`)) === 'Dismiss' && (await page.getAttribute(`${PANEL} button`, 'aria-label')) === 'Dismiss error message', 'pulsante «Dismiss» con nome accessibile «Dismiss error message»');
    await page.tap(`${PANEL} button`);
    check((await page.evaluate(() => window.__calls.dismiss)) === 1, 'tocco su «Chiudi»: viene chiamata onDismiss');
    await set(page, { error: null }); await sleep(60);
    check((await page.$(PANEL)) === null && (await page.$(T)) === null, 'senza più errore il pannello e il pulsante spariscono');
    check((await page.textContent('[role="alert"]')) === '', 'e l\'area degli errori si svuota');

    section('ERRORE + ELABORAZIONE insieme');
    await set(page, { error: 'Errore di rete', isProcessing: true, statusMessage: 'Nuovo tentativo...' });
    await page.waitForSelector(T);
    check(!(await page.$eval(`${T} svg`, (s) => s.classList.contains('animate-spin'))), 'il pulsante mostra il triangolo (l\'errore ha la precedenza)');
    await page.tap(T); await page.waitForSelector(PANEL);
    const both = await page.textContent(PANEL);
    check(both.includes('Errore di rete') && both.includes('Nuovo tentativo...') && both.includes('Dismiss') && both.includes('Cancel processing'), 'il pannello mostra entrambe le sezioni, con i due pulsanti');
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} prove FALLITE` : '\nTutte le prove superate');
process.exit(failures ? 1 : 0);
