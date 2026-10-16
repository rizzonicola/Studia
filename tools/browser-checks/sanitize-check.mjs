#!/usr/bin/env node
/**
 * Prova a strati dell'HTML delle note (utils/sanitizeHtml.ts) in un browser VERO (Chromium via Playwright), con un corpus di vettori XSS
 * e di caricamenti remoti. Un "canarino" (server HTTP locale) registra ogni richiesta di rete; la pagina ospite registra i messaggi
 * "pwn" che i payload inviano se riescono a eseguire codice.
 *
 *   CONTROLLO POSITIVO  payload GREZZI in un iframe con script permessi → devono eseguire / contattare il canarino (altrimenti la prova non prova nulla);
 *   STRATO 1 (solo sanificatore)  output di sanitizeHtml in un iframe con script permessi e SENZA la CSP interna → 0 esecuzioni, 0 richieste;
 *   STRATO 2 (solo sandbox + CSP interna)  payload grezzi in sandbox="" con la CSP di buildSafeSrcDoc → 0 esecuzioni, 0 richieste;
 *   COME IN PRODUZIONE  buildSafeSrcDoc in sandbox="" dentro una pagina servita con la CSP letta da public/_headers → 0 e 0.
 * Un controllo statico verifica anche che l'output non contenga elementi/attributi pericolosi.
 *
 * Uso: node tools/browser-checks/sanitize-check.mjs [--root /percorso/di/un/altro/checkout]   (--root: prova un'altra versione del sanificatore)
 * Variabili: PLAYWRIGHT_MODULE_PATH, ESBUILD_MODULE_PATH
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..', '..');
const args = process.argv.slice(2);
const sanitizerRoot = path.resolve(args.includes('--root') ? args[args.indexOf('--root') + 1] : projectRoot);
const require = createRequire(import.meta.url);
const load = (env, names) => { for (const n of [process.env[env], ...names].filter(Boolean)) { try { return require(n); } catch { /* prossimo */ } } throw new Error(`Modulo non trovato: ${names[0]} (imposta ${env})`); };
const { chromium } = load('PLAYWRIGHT_MODULE_PATH', ['playwright', path.join(projectRoot, 'node_modules', 'playwright')]);
const esbuild = load('ESBUILD_MODULE_PATH', ['esbuild', path.join(projectRoot, 'node_modules', 'esbuild')]);

// CSP reale del sito (la riga Content-Security-Policy della regola /* di public/_headers)
const headersFile = fs.readFileSync(path.join(projectRoot, 'public', '_headers'), 'utf8');
const SITE_CSP = headersFile.match(/^\s*Content-Security-Policy:\s*(.+)$/m)?.[1].trim();
if (!SITE_CSP) throw new Error('CSP non trovata in public/_headers');

// ----------------------------------------------------------------------------------------------------------- canarino e pagine
const hits = [];
let CANARY = '';
const canary = http.createServer((req, res) => { hits.push(req.url); res.writeHead(200, { 'content-type': 'image/png', 'access-control-allow-origin': '*' }); res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64')); });
await new Promise((r) => canary.listen(0, '127.0.0.1', r));
CANARY = `http://127.0.0.1:${canary.address().port}`;

const built = await esbuild.build({ entryPoints: [path.join(sanitizerRoot, 'utils', 'sanitizeHtml.ts')], bundle: true, write: false, format: 'iife', globalName: 'SAN', logLevel: 'error' });
const sanitizerBundle = built.outputFiles[0].text;
const hostScript = `
  window.__pwn = [];
  addEventListener('message', (e) => { if (typeof e.data === 'string' && e.data.startsWith('pwn:')) window.__pwn.push(e.data); });
  window.__render = async (html, sandbox) => {
    document.querySelectorAll('iframe').forEach((f) => f.remove());
    const f = document.createElement('iframe'); f.setAttribute('sandbox', sandbox); f.style.cssText = 'width:600px;height:400px';
    f.srcdoc = html; document.body.appendChild(f);
    await new Promise((r) => { f.onload = () => r(); setTimeout(r, 1500); });
  };`;
const pageHtml = '<!doctype html><title>sanitize-check</title><script src="/san.js"></script><script src="/host.js"></script>';
const host = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (u === '/san.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(sanitizerBundle); }
  if (u === '/host.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(hostScript); }
  const headers = { 'content-type': 'text/html' };
  if (u === '/csp') headers['content-security-policy'] = SITE_CSP; // come in produzione
  res.writeHead(200, headers); res.end(pageHtml);
});
await new Promise((r) => host.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${host.address().port}`;

// ----------------------------------------------------------------------------------------------------------- corpus
const P = (id) => `parent.postMessage('pwn:${id}','*')`;
const C = (n) => `${CANARY}/${n}`;
const corpus = [
  ['script', `<p>x</p><script>${P(1)}</script>`],
  ['img onerror', `<img src=x onerror="${P(2)}">`],
  ['svg onload', `<svg onload="${P(3)}"></svg>`],
  ['javascript: link (clic)', `<a id="l" href="javascript:${P(4)}">x</a>`],
  ['body onload', `<body onload="${P(5)}"><p>x</p>`],
  ['iframe srcdoc annidato', `<iframe srcdoc="<script>parent.parent.postMessage('pwn:6','*')<\/script>"></iframe>`],
  ['object data', `<object data="javascript:${P(7)}"></object><embed src="${C('embed')}">`],
  ['form + button', `<form id="f" action="javascript:${P(8)}"><button id="l">go</button></form>`],
  ['input autofocus', `<input autofocus onfocus="${P(9)}">`],
  ['meta refresh js', `<meta http-equiv="refresh" content="0;url=javascript:${P(10)}">`],
  ['meta refresh remoto', `<meta http-equiv="refresh" content="0;url=${C('refresh')}">`],
  ['link stylesheet', `<link rel="stylesheet" href="${C('link.css')}">`],
  ['@import', `<style>@import url(${C('import.css')});</style>`],
  ['@import con escape', `<style>@\\69mport '${C('esc-import.css')}';</style>`],
  ['style url()', `<style>body{background:url(${C('bg.png')})}</style>`],
  ['style url() con escape', `<style>body{background:\\75rl(${C('esc-bg.png')})}</style>`],
  ['style attr url()', `<div style="background:url('${C('inline.png')}');width:20px;height:20px">x</div>`],
  ['image-set()', `<style>body{background:image-set("${C('imgset.png')}" 1x)}</style><div style="background:-webkit-image-set('${C('imgset2.png')}' 1x);width:10px;height:10px">x</div>`],
  ['@font-face remoto', `<style>@font-face{font-family:x;src:url(${C('font.woff')})}p{font-family:x}</style><p>t</p>`],
  ['img remota', `<img src="${C('pixel.png')}">`],
  ['img srcset', `<img srcset="${C('a.png')} 1x, ${C('b.png')} 2x">`],
  ['img protocol-relative', `<img src="//127.0.0.1:${canary.address().port}/proto.png">`],
  ['svg image href', `<svg width="20" height="20"><image href="${C('svgimg.png')}" width="20" height="20"/></svg>`],
  ['svg use', `<svg><use href="${C('use.svg')}#a"/></svg>`],
  ['svg script', `<svg><script>${P(11)}</script></svg>`],
  ['svg a xlink:href js', `<svg><a id="l" xlink:href="javascript:${P(12)}"><text x="5" y="20">x</text></a></svg>`],
  ['svg animate href', `<svg><a id="l" href="#"><animate attributeName="href" values="javascript:${P(13)}" dur="1ms" fill="freeze"/><text x="5" y="20">x</text></a></svg>`],
  ['base + relativo', `<base href="${CANARY}/"><img src="rel.png">`],
  ['noscript mXSS', `<noscript><p title="</noscript><img src=x onerror=${P(14)}>">x</p></noscript>`],
  ['math mXSS', `<math><mtext><table><mglyph><style><!--</style><img title="--&gt;&lt;img src=1 onerror=${P(15)}&gt;">`],
  ['svg style mXSS', `<svg></p><style><a id="</style><img src=1 onerror=${P(16)}>">`],
  ['video/audio', `<video poster="${C('poster.png')}"><source src="${C('v.mp4')}" onerror="${P(17)}"></video><audio src="${C('a.mp3')}" autoplay></audio>`],
  ['details ontoggle', `<details open ontoggle="${P(18)}"><summary>x</summary></details>`],
  ['marquee', `<marquee onstart="${P(19)}">x</marquee>`],
  ['ONERROR maiuscolo', `<IMG SRC=x ONERROR="${P(20)}">`],
  ['js: con tab/entità', `<a id="l" href="jav&#x09;ascript:${P(21)}">x</a><a href="&#106;avascript:${P(22)}">y</a>`],
  ['data:text/html', `<a id="l" href="data:text/html;base64,${Buffer.from(`<script>${P(23)}<\/script>`).toString('base64')}">x</a>`],
  ['data:image/svg+xml', `<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' onload=&quot;${P(24)}&quot;/%3E">`],
  ['table/body background', `<table background="${C('tbg.png')}"><tr><td>x</td></tr></table>`],
  ['a ping', `<a id="l" href="#" ping="${C('ping')}">x</a>`],
  ['link remoto (clic)', `<a id="l" href="${C('click')}">x</a>`],
  ['behavior/expression', `<div style="behavior:url(${C('beh.htc')});width:expression(${P(25)})">x</div>`],
  ['template/contenteditable', `<template><img src="${C('tpl.png')}"></template><div contenteditable onfocus="${P(26)}" autofocus>x</div>`],
];
// Limite NOTO della sola sandbox: cliccare un link http(s) dentro l'iframe lo fa navigare verso quell'URL (la CSP default-src non governa la
// navigazione). Ci pensa lo strato 1, che toglie ogni href non ammesso: queste voci sono incluse nelle prove 2 e 4.
const CLICK_NAVIGATION = new Set(['link remoto (clic)']);
const BENIGN = `<h1 style="color:#c00">Titolo</h1><p>Testo con <b>grassetto</b> e <a href="#sec">ancora</a></p><img alt="px" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==">`;

// ----------------------------------------------------------------------------------------------------------- esecuzione
let failures = 0;
const check = (ok, label, detail = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`); if (!ok) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const ctx = await browser.newContext();

/** Mostra `html` e restituisce { pwn, requests } prodotti da QUEL payload. */
async function run(page, html, sandbox) {
  hits.length = 0;
  await page.evaluate(() => { window.__pwn.length = 0; });
  await page.evaluate(([h, s]) => window.__render(h, s), [html, sandbox]);
  const frame = page.frames().find((f) => f !== page.mainFrame());
  if (frame) { for (const sel of ['#l', '#f button']) { const el = await frame.$(sel).catch(() => null); if (el) await el.click({ timeout: 500, force: true }).catch(() => undefined); } }
  await sleep(350);
  return { pwn: await page.evaluate(() => [...window.__pwn]), requests: [...hits] };
}

try {
  const plain = await ctx.newPage(); await plain.goto(`${origin}/plain`);
  const cspPage = await ctx.newPage(); await cspPage.goto(`${origin}/csp`);
  const san = (page, html, withCsp) => page.evaluate(([h, c]) => (c ? SAN.buildSafeSrcDoc(h) : SAN.sanitizeHtml(h)), [html, withCsp]);

  // ---- statico: l'output non contiene nulla di pericoloso
  console.log(`Corpus: ${corpus.length} payload | CSP del sito letta da public/_headers (${SITE_CSP.length} caratteri)\n`);
  console.log('0. Controllo statico dell\'output di sanitizeHtml');
  const staticReport = await plain.evaluate((items) => {
    const bad = [];
    for (const [name, html] of items) {
      const out = SAN.sanitizeHtml(html);
      const doc = new DOMParser().parseFromString(out, 'text/html');
      const forbidden = doc.querySelectorAll('script,iframe,frame,object,embed,form,input,button,link,base,meta,audio,video,source,template,noscript');
      const handlers = [...doc.querySelectorAll('*')].flatMap((e) => [...e.attributes].filter((a) => /^on/i.test(a.name)).map((a) => a.name));
      const urls = [...doc.querySelectorAll('*')].flatMap((e) => [...e.attributes].filter((a) => ['href', 'src', 'srcset', 'xlink:href', 'poster', 'background', 'data', 'action', 'ping'].includes(a.name.toLowerCase())).map((a) => a.value)).filter((v) => !/^(#|data:image\/(png|jpeg|gif|webp))/i.test(v.trim()));
      const css = [...doc.querySelectorAll('style')].map((s) => s.textContent).concat([...doc.querySelectorAll('[style]')].map((e) => e.getAttribute('style'))).join('\n');
      const remoteCss = /@import|expression\s*\(|url\s*\(\s*['"]?\s*(?!data:image\/)/i.test(css);
      if (forbidden.length || handlers.length || urls.length || remoteCss) bad.push({ name, forbidden: forbidden.length, handlers, urls, remoteCss });
    }
    return bad;
  }, corpus);
  check(staticReport.length === 0, 'nessun elemento vietato, gestore on*, URL non ammesso o CSS remoto nell\'output', staticReport.length ? JSON.stringify(staticReport.slice(0, 3)) : `${corpus.length}/${corpus.length} puliti`);
  const benign = await plain.evaluate((h) => SAN.sanitizeHtml(h), BENIGN);
  check(/<h1 style="color:#c00">/.test(benign) && /href="#sec"/.test(benign) && /src="data:image\/png/.test(benign), 'il contenuto legittimo (stile, ancora interna, immagine data:) NON viene rovinato');

  // ---- controllo positivo
  console.log('\n1. CONTROLLO POSITIVO — payload grezzi, iframe con script permessi, nessuna difesa');
  let pwnRaw = 0, netRaw = 0; const effective = new Set();
  for (const [name, html] of corpus) { const r = await run(plain, html, 'allow-scripts'); if (r.pwn.length) pwnRaw++; if (r.requests.length) netRaw++; if (r.pwn.length || r.requests.length) effective.add(name); }
  check(pwnRaw >= 8 && netRaw >= 8, `i payload funzionano davvero senza difese (esecuzioni: ${pwnRaw}, richieste di rete: ${netRaw}, almeno uno dei due: ${effective.size}/${corpus.length})`, 'se questo fallisse, i risultati sotto non proverebbero nulla');

  // ---- strato 1
  console.log('\n2. STRATO 1 da solo — output del sanificatore, script permessi, senza sandbox severa né CSP interna');
  const s1 = []; for (const [name, html] of corpus) { const r = await run(plain, await san(plain, html, false), 'allow-scripts'); if (r.pwn.length || r.requests.length) s1.push({ name, pwn: r.pwn, requests: r.requests.map((u) => u.slice(0, 40)) }); }
  check(s1.length === 0, 'il solo sanificatore ferma esecuzioni e richieste di rete', s1.length ? JSON.stringify(s1) : '0 esecuzioni, 0 richieste');

  // ---- strato 2
  console.log('\n3. STRATO 2 da solo — payload GREZZI in sandbox="" con la CSP interna di buildSafeSrcDoc ma senza sanificare');
  const s2 = []; for (const [name, html] of corpus) {
    if (CLICK_NAVIGATION.has(name)) continue; // vedi nota sotto
    const withCsp = html.replace(/^/, '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:; font-src data:;">');
    const r = await run(plain, withCsp, ''); if (r.pwn.length || r.requests.length) s2.push({ name, pwn: r.pwn, requests: r.requests.map((u) => u.slice(0, 40)) });
  }
  {
    const withCsp = (h) => `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:;">${h}`;
    for (const name of CLICK_NAVIGATION) { const r = await run(plain, withCsp(corpus.find(([n]) => n === name)[1]), ''); console.log(`  NOTA  "${name}" in sola sandbox: ${r.requests.length ? 'il clic naviga verso l\'URL remoto (richieste: ' + r.requests.length + ')' : 'nessuna richiesta'} — lo strato 1 lo evita rimuovendo l'href`); }
  }
  check(s2.length === 0, 'sandbox="" + CSP interna fermano da sole esecuzioni e richieste automatiche di rete (clic su link remoti esclusi: vedi NOTA)', s2.length ? JSON.stringify(s2) : '0 esecuzioni, 0 richieste');

  // ---- produzione
  console.log('\n4. COME IN PRODUZIONE — buildSafeSrcDoc in sandbox="" dentro una pagina con la CSP di public/_headers');
  const s3 = []; for (const [name, html] of corpus) { const r = await run(cspPage, await san(cspPage, html, true), ''); if (r.pwn.length || r.requests.length) s3.push({ name, pwn: r.pwn, requests: r.requests.map((u) => u.slice(0, 40)) }); }
  check(s3.length === 0, 'nessuna esecuzione e nessuna richiesta di rete', s3.length ? JSON.stringify(s3) : '0 esecuzioni, 0 richieste');
  const okBenign = await run(cspPage, await san(cspPage, BENIGN, true), '');
  const frame = cspPage.frames().find((f) => f !== cspPage.mainFrame());
  const rendered = await frame.evaluate(() => ({ h1: getComputedStyle(document.querySelector('h1')).color, img: !!document.querySelector('img') && document.querySelector('img').naturalWidth > 0 }));
  check(rendered.h1 === 'rgb(204, 0, 0)' && rendered.img && okBenign.requests.length === 0, 'in produzione il contenuto legittimo si vede (stile inline e immagine data: funzionano)', JSON.stringify(rendered));
} finally {
  await browser.close();
  canary.close(); host.close();
}
console.log(failures === 0 ? '\nTUTTE LE PROVE SUPERATE' : `\n${failures} PROVA/E FALLITA/E`);
process.exit(failures === 0 ? 0 : 1);
