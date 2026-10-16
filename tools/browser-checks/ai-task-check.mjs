#!/usr/bin/env node
/**
 * Prova di hooks/useAIProcessor.tsx con React VERO in Chromium (Playwright): le generazioni quiz/mappa in background.
 *   A  rilanciare lo stesso task mentre è in corso: la voce "in corso" della nuova esecuzione non deve sparire;
 *   B  il risultato va nella nota anche se nessuna pagina di dettaglio è aperta (prima si perdeva);
 *   C  annullare (clearTask) non lascia stati né scrive nella nota;
 *   D  un errore resta visibile come errore.
 * Uso:  node tools/browser-checks/ai-task-check.mjs [--root /percorso/di/un/altro/checkout]   (--root serve per provare la versione precedente)
 * Serve: playwright + esbuild + react/react-dom (installati dal progetto). Variabili: PLAYWRIGHT_MODULE_PATH, ESBUILD_MODULE_PATH, REACT_NODE_PATH.
 */
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..', '..');
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const root = path.resolve(opt('root', projectRoot));
const require = createRequire(import.meta.url);
const load = (env, names) => { for (const n of [process.env[env], ...names].filter(Boolean)) { try { return require(n); } catch { /* prossimo */ } } throw new Error(`Modulo non trovato: ${names[0]} (imposta ${env})`); };
const { chromium } = load('PLAYWRIGHT_MODULE_PATH', ['playwright', path.join(projectRoot, 'node_modules', 'playwright')]);
const esbuild = load('ESBUILD_MODULE_PATH', ['esbuild', path.join(projectRoot, 'node_modules', 'esbuild')]);
const nodePaths = [process.env.REACT_NODE_PATH, path.join(projectRoot, 'node_modules')].filter(Boolean);

const stub = (f) => path.join(here, 'stubs', f);
const plugin = {
  name: 'stubs',
  setup(build) {
    build.onResolve({ filter: /^__HOOK__$/ }, () => ({ path: path.join(root, 'hooks', 'useAIProcessor.tsx') }));
    build.onResolve({ filter: /^react-router-dom$/ }, () => ({ path: stub('router.ts') }));
    build.onResolve({ filter: /(^|\/)useNotesStore$/ }, () => ({ path: stub('notes.ts') }));
    build.onResolve({ filter: /(^|\/)useSettings$/ }, () => ({ path: stub('settings.ts') }));
    build.onResolve({ filter: /(^|\/)I18nProvider$/ }, () => ({ path: stub('i18n.ts') }));
    build.onResolve({ filter: /(^|\/)services\/gemini$/ }, () => ({ path: stub('gemini.ts') }));
  },
};
const built = await esbuild.build({
  entryPoints: [path.join(here, 'ai-task-entry.tsx')], bundle: true, write: false, format: 'iife', target: 'es2022', jsx: 'automatic',
  nodePaths, plugins: [plugin], define: { __APP_VERSION__: '"check"', 'import.meta.env.PROD': 'false', 'import.meta.env.DEV': 'true', 'process.env.NODE_ENV': '"development"' }, logLevel: 'error',
});
const bundle = built.outputFiles[0].text;
const server = http.createServer((req, res) => {
  if (req.url === '/b.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(bundle); }
  else { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><div id="root"></div><script src="/b.js"></script>'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));

let failures = 0;
const check = (ok, label, detail = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`); if (!ok) failures++; };
console.log(`Hook sotto prova: ${path.relative(process.cwd(), path.join(root, 'hooks', 'useAIProcessor.tsx'))}\n`);
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [errore pagina]', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.waitForFunction(() => !!window.__ai);

const quiz = { title: 'Q', questions: [{ questionText: 'a?', options: ['x', 'y'], correctAnswer: 'x', explanation: '' }] };
const settle = (ms = 80) => new Promise((r) => setTimeout(r, ms));
const state = (key) => page.evaluate((k) => { const t = window.__ai.backgroundTasks[k]; return t ? { status: t.status, error: t.error } : null; }, key);
const waitCalls = (n) => page.waitForFunction((count) => window.__gen.calls.length >= count, n, { timeout: 5000 });

try {
  console.log('A. Rilancio lo stesso quiz mentre il primo è ancora in corso');
  await page.evaluate(() => { window.__run1 = window.__ai.generateQuiz('n1', 'testo'); });
  await waitCalls(1);
  check((await state('n1-quiz'))?.status === 'loading', 'dopo il primo avvio: in corso');
  await page.evaluate(() => { window.__run2 = window.__ai.generateQuiz('n1', 'testo'); });
  await waitCalls(2);
  await page.evaluate(() => window.__run1); // la prima esecuzione, annullata, termina adesso
  await settle();
  const afterFirstEnds = await state('n1-quiz');
  check(afterFirstEnds?.status === 'loading', 'quando la PRIMA esecuzione (annullata) termina, la voce "in corso" della seconda resta', JSON.stringify(afterFirstEnds));

  console.log('\nB. La seconda esecuzione finisce SENZA nessuna pagina di dettaglio aperta');
  await page.evaluate((q) => window.__gen.calls[1].resolve(q), quiz);
  await page.evaluate(() => window.__run2);
  await settle();
  const updates = await page.evaluate(() => window.__notes.updates);
  check(updates.length === 1 && updates[0].id === 'n1' && updates[0].patch.quizData?.title === 'Q', 'il quiz è stato scritto nella nota dal provider', `scritture: ${updates.length}`);
  check((await state('n1-quiz')) === null, 'la voce del task è stata rimossa');

  console.log('\nC. clearTask durante la generazione');
  await page.evaluate(() => { window.__notes.updates.length = 0; window.__run3 = window.__ai.generateMap('n2', 'testo'); });
  await waitCalls(3);
  await page.evaluate(() => window.__ai.clearTask('n2', 'map'));
  await page.evaluate(() => window.__run3);
  await settle();
  check((await state('n2-map')) === null, 'nessuno stato residuo dopo l\'annullamento');
  check((await page.evaluate(() => window.__notes.updates.length)) === 0, 'nulla viene scritto nella nota');

  console.log('\nD. Errore della generazione');
  await page.evaluate(() => { window.__run4 = window.__ai.generateQuiz('n3', 'testo'); });
  await waitCalls(4);
  await page.evaluate(() => window.__gen.calls[3].reject({ status: 400, message: 'API key not valid' }));
  await page.evaluate(() => window.__run4);
  await settle();
  const err = await state('n3-quiz');
  check(err?.status === 'error' && !!err.error, 'l\'errore resta visibile alla UI', JSON.stringify(err));
} finally {
  await browser.close();
  server.close();
}
console.log(failures === 0 ? '\nTUTTE LE PROVE SUPERATE' : `\n${failures} PROVA/E FALLITA/E`);
process.exit(failures === 0 ? 0 : 1);
