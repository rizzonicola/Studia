#!/usr/bin/env node
/**
 * Verifica in un browser VERO (Chromium via Playwright) del menu a tendina personalizzato (components/Select.tsx, usato da LanguageSelect
 * nel dialogo di benvenuto al posto del <select> nativo). Il componente è quello vero, compilato con esbuild; solo le icone sono finte.
 * Gli stili sono quelli di Tailwind riscritti a mano per le sole classi usate dal componente (qui non c'è Tailwind): contano le misure e
 * il comportamento, non l'estetica.
 *
 *   DESKTOP     apertura sotto il pulsante, allineamento, fuoco sulla voce scelta, frecce/Home/End con ritorno a capo, ricerca a digitazione,
 *               Invio/Spazio/Esc/Tab, clic fuori, clic su una voce, secondo clic sul pulsante;
 *   TELEFONO    360×640 con tocco, pulsante nell'intestazione di un dialogo con overflow:hidden e transform: il menu resta DENTRO il dialogo,
 *               le righe sono alte almeno 44 px, il menu sta nel nodo role="dialog" (accessibile con aria-modal);
 *   BORDI       in basso → si apre sopra; sul bordo sinistro/destro → si allinea dal lato giusto; in fondo a un dialogo → sopra e dentro il dialogo;
 *   SPAZIO POCO schermo basso e 30 voci: il menu resta nello schermo, scorre, End porta in vista l'ultima voce senza scorrere la pagina.
 *
 * Uso:   node tools/browser-checks/select-check.mjs
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
  entryPoints: [path.join(here, 'select-entry.tsx')],
  bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022', jsx: 'automatic', logLevel: 'error',
  alias: { 'lucide-react': path.join(here, 'stubs', 'lucide.tsx') },
  define: { 'process.env.NODE_ENV': '"production"' },
});
const bundle = built.outputFiles[0].text;

// Le sole utility di Tailwind che usa Select.tsx, scritte a mano (stesso ordine di precedenza: pointer-fine dopo min-h-11)
const css = `
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#f9fafb;color:#111}button{font:inherit;cursor:pointer;background:none}
.relative{position:relative}.inline-block{display:inline-block}.inline-flex{display:inline-flex}.flex{display:flex}.block{display:block}.shrink-0{flex-shrink:0}
.min-h-11{min-height:2.75rem}.max-w-full{max-width:100%}.items-center{align-items:center}.gap-2{gap:.5rem}.gap-3{gap:.75rem}
.rounded-lg{border-radius:.5rem}.rounded-xl{border-radius:.75rem}.border{border:1px solid}.border-gray-300{border-color:#d1d5db}.border-gray-200{border-color:#e5e7eb}
.bg-surface{background:#fff}.pl-2\\.5{padding-left:.625rem}.pr-2{padding-right:.5rem}.p-1\\.5{padding:.375rem}.px-3{padding-left:.75rem;padding-right:.75rem}.py-1\\.5{padding-top:.375rem;padding-bottom:.375rem}
.text-sm{font-size:.875rem;line-height:1.25rem}.text-xs{font-size:.75rem;line-height:1rem}.font-medium{font-weight:500}.font-semibold{font-weight:600}.font-normal{font-weight:400}
.text-gray-800{color:#1f2937}.text-gray-900{color:#111827}.text-gray-600{color:#4b5563}.text-gray-500{color:#6b7280}.text-accent-ink{color:#111827}
.hover\\:bg-gray-100:hover,.focus\\:bg-gray-100:focus{background:#f3f4f6}.min-w-0{min-width:0}.flex-1{flex:1 1 0%}.truncate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.overflow-y-auto{overflow-y:auto}.overscroll-contain{overscroll-behavior:contain}.shadow-xl{box-shadow:0 20px 25px -5px rgba(0,0,0,.1),0 8px 10px -6px rgba(0,0,0,.1)}
.cursor-pointer{cursor:pointer}.rotate-180{transform:rotate(180deg)}
.transition-colors{transition-property:color,background-color,border-color,outline-color,fill,stroke;transition-duration:.15s}.transition-transform{transition-property:transform;transition-duration:.15s}
@media (pointer:fine){.pointer-fine\\:min-h-10{min-height:2.5rem}}
:focus-visible{outline:2px solid #111827;outline-offset:2px}.focus-visible\\:outline-offset-\\[-2px\\]:focus-visible{outline-offset:-2px}
.pos-center{padding:200px 0 0 300px}.pos-bottom{position:fixed;bottom:12px;right:12px}.pos-left{position:fixed;left:4px;top:100px}.pos-right{position:fixed;right:4px;top:100px}
.overlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:12px;background:rgba(0,0,0,.45);backdrop-filter:blur(2px)}
.dialog{width:100%;max-width:28rem;max-height:92vh;overflow:hidden;border-radius:1rem;background:#fff;display:flex;flex-direction:column;transform:translateY(0)}
.dlg-head{display:flex;justify-content:space-between;align-items:center;padding:24px 24px 16px;border-bottom:1px solid #eee}
.dlg-body{padding:20px 24px;flex:1;overflow:auto;line-height:1.7;color:#555}.dlg-foot{padding:16px 24px;border-top:1px solid #eee;display:flex;justify-content:flex-end}`;

// ------------------------------------------------------------------------------------------------ utilità
let failures = 0;
const check = (ok, label, detail = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`); if (!ok) failures++; };
const section = (s) => console.log(`\n${s}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T = 'button[aria-haspopup="listbox"]';
const L = '[role="listbox"]';
const rect = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; }, sel);
const active = (page) => page.evaluate(() => {
  const a = document.activeElement;
  if (!a) return null;
  return a.getAttribute('role') === 'option' ? `option:${a.querySelector('span span')?.textContent}` : `${a.tagName}:`;
});
const changes = (page) => page.evaluate(() => JSON.stringify(window.__changes));

const browser = await chromium.launch();
async function open(context, opts) {
  const page = await context.newPage();
  page.on('pageerror', (e) => check(false, 'errore JavaScript nella pagina', e.message));
  await page.setContent(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style><div id="root"></div>`);
  await page.evaluate((o) => { window.__opts = o; }, opts);
  await page.addScriptTag({ content: bundle });
  await page.waitForSelector(T);
  return page;
}
const openMenu = async (page, how = 'click') => { await (how === 'tap' ? page.tap(T) : page.click(T)); await page.waitForSelector(L); await sleep(60); };

try {
  section('DESKTOP 1280×800 (mouse e tastiera)');
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await open(ctx, { layout: 'center' });
    check((await page.getAttribute(T, 'aria-expanded')) === 'false', 'chiuso: aria-expanded=false');
    check((await page.getAttribute(T, 'aria-label')) === 'Lingua / Language / Langue: Sistema', 'nome accessibile = «campo: valore»');
    check((await page.$(L)) === null, 'nessun elenco nel DOM quando è chiuso');

    await openMenu(page);
    const t = await rect(page, T), l = await rect(page, L);
    check((await page.getAttribute(T, 'aria-expanded')) === 'true', 'aperto: aria-expanded=true');
    check((await page.getAttribute(L, 'aria-label')) === 'Lingua / Language / Langue', 'l\'elenco ha un nome accessibile');
    check((await page.$$('[role="option"]')).length === 4, '4 voci');
    check(l.top >= t.bottom && l.top - t.bottom <= 8, 'si apre SOTTO il pulsante', `scarto ${(l.top - t.bottom).toFixed(1)} px`);
    check(Math.abs(l.right - t.right) <= 1, 'bordo destro allineato a quello del pulsante');
    check(l.left >= 0 && l.right <= 1280 && l.bottom <= 800, 'resta dentro lo schermo');
    check(l.width >= 192, 'larghezza minima 12rem', `${l.width.toFixed(0)} px`);
    check((await active(page)) === 'option:Sistema', 'il fuoco va alla voce selezionata', String(await active(page)));
    check((await page.$eval('[role="option"][aria-selected="true"]', (e) => e.textContent)).includes('Sistema'), 'aria-selected sulla voce corrente');
    check((await rect(page, '[role="option"]')).height >= 40, 'righe alte almeno 40 px con puntatore preciso');

    await page.keyboard.press('ArrowDown'); check((await active(page)) === 'option:Italiano', 'ArrowDown → Italiano');
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); check((await active(page)) === 'option:Français', 'ArrowDown ×2 → Français');
    await page.keyboard.press('ArrowDown'); check((await active(page)) === 'option:Sistema', 'ArrowDown dall\'ultima → torna alla prima');
    await page.keyboard.press('ArrowUp'); check((await active(page)) === 'option:Français', 'ArrowUp dalla prima → va all\'ultima');
    await page.keyboard.press('Home'); check((await active(page)) === 'option:Sistema', 'Home');
    await page.keyboard.press('End'); check((await active(page)) === 'option:Français', 'End');
    for (const [key, expected] of [['e', 'English'], ['i', 'Italiano'], ['f', 'Français'], ['s', 'Sistema']]) {
      await page.keyboard.press(key);
      check((await active(page)) === `option:${expected}`, `digitare «${key}» → ${expected}`);
      await sleep(800); // la ricerca a digitazione riparte da zero dopo una pausa
    }

    await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); // English
    await page.keyboard.press('Enter');
    check((await page.$(L)) === null, 'Invio: il menu si chiude');
    check((await changes(page)) === '["en"]', 'Invio: onChange("en")');
    check((await active(page)) === 'BUTTON:', 'il fuoco torna sul pulsante');
    check((await page.getAttribute(T, 'aria-label')) === 'Lingua / Language / Langue: English', 'il pulsante mostra il nuovo valore');

    await page.keyboard.press('ArrowDown'); await page.waitForSelector(L); await sleep(40);
    check((await active(page)) === 'option:English', 'ArrowDown sul pulsante apre e va sulla voce scelta');
    await page.keyboard.press('Escape');
    check((await page.$(L)) === null && (await changes(page)) === '["en"]' && (await active(page)) === 'BUTTON:', 'Esc: chiude, nessuna modifica, il fuoco torna sul pulsante');

    await page.keyboard.press('Enter'); await page.waitForSelector(L); await sleep(40);
    await page.keyboard.press('Space');
    check((await page.$(L)) === null && (await changes(page)) === '["en"]', 'Invio apre; Spazio su una voce già scelta chiude senza richiamare onChange');

    await page.click(T); await page.waitForSelector(L);
    await page.mouse.click(20, 20); await sleep(40);
    check((await page.$(L)) === null && (await changes(page)) === '["en"]', 'clic fuori: chiude senza modifiche');

    await page.click(T); await page.waitForSelector(L); await sleep(40);
    await page.keyboard.press('Tab'); await sleep(40);
    check((await page.$(L)) === null, 'Tab: chiude');

    await page.click(T); await page.waitForSelector(L);
    await page.click('[role="option"]:has-text("Français")');
    check((await changes(page)) === '["en","fr"]' && (await page.$(L)) === null, 'clic su una voce: onChange("fr") e chiude');
    await page.click(T); await page.waitForSelector(L);
    await page.click(T);
    check((await page.$(L)) === null, 'secondo clic sul pulsante: chiude');
    await ctx.close();
  }

  section('TELEFONO 360×640 (tocco), pulsante nell\'intestazione di un dialogo con overflow:hidden e transform');
  {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
    const page = await open(ctx, { layout: 'dialog', tall: true });
    await openMenu(page, 'tap');
    const d = await rect(page, '[data-testid="dialog"]'), l = await rect(page, L), t = await rect(page, T);
    check(l.left >= d.left - 0.5 && l.right <= d.right + 0.5 && l.top >= d.top && l.bottom <= d.bottom + 0.5, 'il menu sta interamente DENTRO il dialogo (non tagliato)');
    check(l.left >= 0 && l.right <= 360, 'e dentro lo schermo');
    check(Math.abs(l.right - t.right) <= 1, 'allineato a destra come il pulsante');
    const heights = await page.$$eval('[role="option"]', (els) => els.map((e) => e.getBoundingClientRect().height));
    check(heights.every((h) => h >= 44), 'ogni riga è alta almeno 44 px (bersaglio da tocco)', heights.map((h) => h.toFixed(0)).join(', '));
    check(await page.$eval(L, (e) => !!e.closest('[role="dialog"]')), 'il menu è DENTRO il nodo role="dialog": gli screen reader lo vedono con aria-modal');
    await page.tap('[role="option"]:has-text("English")');
    check((await changes(page)) === '["en"]' && (await page.$(L)) === null, 'tocco su una voce: onChange("en") e chiude');
    await page.tap(T); await page.waitForSelector(L);
    await page.touchscreen.tap(30, 600); await sleep(50);
    check((await page.$(L)) === null, 'tocco fuori: chiude');
    await ctx.close();
  }

  section('POSIZIONAMENTO ai bordi dello schermo (1280×800)');
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    let page = await open(ctx, { layout: 'bottom' }); await openMenu(page);
    let t = await rect(page, T), l = await rect(page, L);
    check(l.bottom <= t.top && l.top >= 0, 'pulsante in fondo allo schermo → il menu si apre SOPRA');
    await page.close();
    page = await open(ctx, { layout: 'left' }); await openMenu(page);
    t = await rect(page, T); l = await rect(page, L);
    check(l.left >= 0 && Math.abs(l.left - t.left) <= 1, 'pulsante sul bordo sinistro → allineato a sinistra, non esce dallo schermo');
    await page.close();
    page = await open(ctx, { layout: 'right' }); await openMenu(page);
    t = await rect(page, T); l = await rect(page, L);
    check(l.right <= 1280 && Math.abs(l.right - t.right) <= 1, 'pulsante sul bordo destro → allineato a destra, non esce dallo schermo');
    await page.close();
    page = await open(ctx, { layout: 'dialog-bottom' }); await openMenu(page);
    const d = await rect(page, '[data-testid="dialog"]'); t = await rect(page, T); l = await rect(page, L);
    check(l.top >= d.top && l.bottom <= d.bottom + 0.5 && l.bottom <= t.top, 'pulsante in fondo al dialogo → il menu si apre sopra e resta nel dialogo');
    await ctx.close();
  }

  section('SCHERMO BASSO (1280×300) e ELENCO LUNGO (30 voci)');
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 300 } });
    const page = await open(ctx, { layout: 'bottom', many: true }); await openMenu(page);
    const l = await rect(page, L);
    const size = await page.$eval(L, (e) => ({ client: e.clientHeight, scroll: e.scrollHeight }));
    check(l.top >= 0 && l.bottom <= 300, 'il menu resta dentro lo schermo', `${l.top.toFixed(0)}–${l.bottom.toFixed(0)}`);
    check(size.scroll > size.client, 'e l\'elenco scorre', `${size.client}/${size.scroll}`);
    await page.keyboard.press('End'); await sleep(40);
    const last = await rect(page, '[role="option"]:last-child'), lr = await rect(page, L);
    check(last.top >= lr.top - 1 && last.bottom <= lr.bottom + 1, 'End: l\'ultima voce viene portata in vista nell\'elenco');
    check((await page.evaluate(() => window.scrollY)) === 0, 'la pagina non scorre mentre si naviga nell\'elenco');
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} prove FALLITE` : '\nTutte le prove superate');
process.exit(failures ? 1 : 0);
