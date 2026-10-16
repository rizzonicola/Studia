#!/usr/bin/env node
/**
 * Verifica del livello dati degli appunti (services/notesDb.ts) in un browser VERO (Chromium via Playwright, IndexedDB e
 * BroadcastChannel reali). Il modulo viene compilato con esbuild e caricato in una pagina; due pagine nello stesso contesto
 * simulano due schede.
 *
 *   1  migrazione dal vecchio localStorage: idempotente, la vecchia chiave viene eliminata, svuotando il DB nulla "risuscita";
 *   2  il DB vince sul vecchio dato (put-se-assente): modifiche successive non vengono annullate da una nuova migrazione;
 *   3  record corrotti/incompleti: la lettura non lancia, i buoni si salvano, albero riparato (e riparazioni scritte solo sul campo);
 *   4  due schede: una scheda "vecchia" non sovrascrive più con una copia obsoleta (e la riproduzione del vecchio comportamento);
 *   5  sincronizzazione: la scrittura di una scheda arriva all'altra via BroadcastChannel;
 *   6  una versione più nuova dell'app può aggiornare lo schema: la scheda vecchia chiude la connessione (blocking) invece di bloccarla;
 *   7  scritture accodate in ordine; richiesta di archiviazione persistente una sola volta.
 *
 * Uso:   node tools/browser-checks/idb-check.mjs [--idb-shim percorso/idb-shim.mjs]
 * Serve: `npm i -D playwright` + `npx playwright install chromium`; esbuild c'è già (lo porta vite). `idb` vero viene usato se
 *        installato; altrimenti serve --idb-shim (un guscio sull'IndexedDB nativo).
 * Variabili: PLAYWRIGHT_MODULE_PATH, ESBUILD_MODULE_PATH per indicare dove trovare i due pacchetti.
 */
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..', '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const require = createRequire(import.meta.url);
const load = (envName, names) => {
  for (const n of [process.env[envName], ...names].filter(Boolean)) { try { return require(n); } catch { /* prossimo */ } }
  throw new Error(`Modulo non trovato (${names[0]}). Installalo o imposta ${envName}.`);
};
const { chromium } = load('PLAYWRIGHT_MODULE_PATH', ['playwright', path.join(projectRoot, 'node_modules', 'playwright')]);
const esbuild = load('ESBUILD_MODULE_PATH', ['esbuild', path.join(projectRoot, 'node_modules', 'esbuild')]);

const idbShim = opt('idb-shim', null);
if (!idbShim) { try { require.resolve('idb', { paths: [projectRoot] }); } catch { throw new Error('`idb` non installato: esegui `npm ci`, oppure passa --idb-shim <file> (guscio sull\'IndexedDB nativo).'); } }
console.log(`idb usato: ${idbShim ? 'GUSCIO di verifica (' + path.basename(idbShim) + ')' : 'pacchetto idb vero'}`);

// ------------------------------------------------------------------------------------------------ build + server
const built = await esbuild.build({
  entryPoints: [path.join(here, 'idb-entry.ts')], bundle: true, write: false, format: 'iife', target: 'es2022',
  alias: idbShim ? { idb: path.resolve(idbShim) } : {}, define: { __APP_VERSION__: '"check"', 'import.meta.env.PROD': 'true', 'import.meta.env.DEV': 'false' }, logLevel: 'error',
});
const bundle = built.outputFiles[0].text;
const server = http.createServer((req, res) => {
  if (req.url === '/bundle.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(bundle); }
  else { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><title>idb-check</title><script src="/bundle.js"></script>'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}/`;

// ------------------------------------------------------------------------------------------------ utilità
let failures = 0;
const check = (ok, label, detail = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`); if (!ok) failures++; };
const section = (s) => console.log(`\n${s}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const iso = (d) => new Date(d).toISOString();
const note = (id, extra = {}) => ({ id, title: id, content: `c-${id}`, emoji: '📚', color: 'bg-red-100', folderId: null, createdAt: iso('2025-03-01'), ...extra });
const folder = (id, extra = {}) => ({ id, name: id, emoji: '📚', color: 'bg-red-100', createdAt: iso('2025-03-01'), parentId: null, ...extra });

const browser = await chromium.launch();
const context = await browser.newContext();
const open = async () => { const p = await context.newPage(); p.on('pageerror', (e) => console.log('  [errore pagina]', e.message)); await p.goto(origin); await p.waitForFunction(() => !!window.__notesDb); return p; };
const fresh = async (p) => { await p.evaluate(async () => { await window.__raw.deleteDb(); localStorage.clear(); }); };

try {
  const A = await open();

  // ---------------------------------------------------------------- 1. migrazione
  section('1. Migrazione dal vecchio localStorage (studia_data)');
  await fresh(A);
  const legacy = { notes: [note('n1', { folderId: 'f1' }), note('n2'), { id: 'n3', title: 'senza data' }], folders: [{ id: 'f1', name: 'Vecchia', emoji: '📜', color: 'bg-blue-100', createdAt: iso('2024-01-01'), tabColor: 'x' }] };
  await A.evaluate((l) => localStorage.setItem(window.__KEYS.legacyData, JSON.stringify(l)), legacy);
  const r1 = await A.evaluate(async () => { const r = await window.__notesDb.loadAll(); return { notes: r.notes.length, folders: r.folders.length, migrated: r.migrated, parentId: r.folders[0]?.parentId, key: localStorage.getItem(window.__KEYS.legacyData), n3: r.notes.find((n) => n.id === 'n3') }; });
  check(r1.migrated === 4 && r1.notes === 3 && r1.folders === 1, 'tutti gli elementi vecchi sono nel DB', JSON.stringify({ notes: r1.notes, folders: r1.folders, migrated: r1.migrated }));
  check(r1.parentId === null, 'la cartella senza parentId (dato vecchio) torna visibile alla radice');
  check(r1.n3 && typeof r1.n3.createdAt === 'string' && r1.n3.content === '', 'appunto incompleto riparato in lettura invece di far cadere la UI');
  check(r1.key === null, 'la vecchia chiave studia_data è stata ELIMINATA dopo la conferma della transazione');
  const r1b = await A.evaluate(async () => { await window.__notesDb.closeDB(); const r = await window.__notesDb.loadAll(); return { notes: r.notes.length, migrated: r.migrated }; });
  check(r1b.migrated === 0 && r1b.notes === 3, 'riaprire l\'app non duplica né rimigra', JSON.stringify(r1b));
  // svuotando tutto, i vecchi appunti NON risuscitano (con il vecchio codice sì: vedi sezione 4b)
  await A.evaluate(async () => { const { dbJobs, enqueueWrite, whenWritesSettled, closeDB } = window.__notesDb; enqueueWrite(dbJobs.deleteTree(['f1'], ['n1', 'n2', 'n3'])); await whenWritesSettled(); await closeDB(); });
  const r1c = await A.evaluate(async () => { const r = await window.__notesDb.loadAll(); return { notes: r.notes.length, folders: r.folders.length }; });
  check(r1c.notes === 0 && r1c.folders === 0, 'dopo aver cancellato tutto, al riavvio il DB resta vuoto (nessuna risurrezione)', JSON.stringify(r1c));

  // ---------------------------------------------------------------- 2. DB vince sul vecchio
  section('2. Il DB è la fonte di verità (put-se-assente)');
  await fresh(A);
  await A.evaluate(async (l) => { await window.__raw.put('notes', [{ id: 'n1', title: 'MODIFICATO OGGI', content: 'nuovo', emoji: '🧠', color: 'bg-red-100', folderId: null, createdAt: '2026-01-01T00:00:00.000Z' }]); localStorage.setItem(window.__KEYS.legacyData, JSON.stringify(l)); }, legacy);
  const r2 = await A.evaluate(async () => { const r = await window.__notesDb.loadAll(); return { title: r.notes.find((n) => n.id === 'n1').title, total: r.notes.length, migrated: r.migrated }; });
  check(r2.title === 'MODIFICATO OGGI' && r2.total === 3 && r2.migrated === 3, 'n1 resta quello modificato; solo i mancanti vengono aggiunti', JSON.stringify(r2));
  await A.evaluate(() => { localStorage.setItem(window.__KEYS.legacyData, '{non json'); });
  const r2b = await A.evaluate(async () => { await window.__notesDb.loadAll(); return localStorage.getItem(window.__KEYS.legacyData); });
  check(r2b === '{non json', 'un vecchio dato illeggibile NON viene cancellato (non si distrugge ciò che non si è capito)');

  // ---------------------------------------------------------------- 3. record corrotti
  section('3. Record corrotti, incompleti, albero rotto');
  await fresh(A);
  await A.evaluate(async () => {
    await window.__raw.put('notes', [
      { id: 'ok', title: 'Buono', content: 'x', emoji: '📚', color: 'bg-red-100', folderId: 'a', createdAt: '2025-01-01T00:00:00.000Z', quizData: { title: 'Q', questions: [{ questionText: 'd?', options: ['si', 'no'], correctAnswer: 'si', explanation: 'e' }] } },
      { id: 'senza-data', title: 7 },
      { id: 'orfano', title: 'In cartella sparita', content: '', emoji: '📚', color: 'bg-red-100', folderId: 'non-esiste', createdAt: '2025-01-01T00:00:00.000Z' },
      { id: 'quiz-rotto', title: 'Quiz rotto', content: '', emoji: '📚', color: 'bg-red-100', folderId: null, createdAt: '2025-01-01T00:00:00.000Z', quizData: { title: 'Q', questions: 'no' } },
      { id: 'stringa-non-oggetto-ma-con-id' },
    ]);
    await window.__raw.put('folders', [
      { id: 'a', name: 'A', emoji: '📚', color: 'bg-red-100', createdAt: '2025-01-01T00:00:00.000Z', parentId: 'b' },
      { id: 'b', name: 'B', emoji: '📚', color: 'bg-red-100', createdAt: '2025-01-01T00:00:00.000Z', parentId: 'a' },
      { id: 'c', name: 'C', emoji: '📚', color: 'bg-red-100', createdAt: '2025-01-01T00:00:00.000Z', parentId: 'fantasma' },
      { id: 'd', name: 'D' },
    ]);
  });
  const r3 = await A.evaluate(async () => {
    let error = null, r = null;
    try { r = await window.__notesDb.loadAll(); } catch (e) { error = String(e); }
    const rawNotes = await window.__raw.getAll('notes'); const rawFolders = await window.__raw.getAll('folders');
    return { error, notes: r?.notes.map((n) => n.id).sort(), folders: r?.folders.map((f) => f.id).sort(), repaired: r?.repaired, quizOfRotto: r?.notes.find((n) => n.id === 'quiz-rotto')?.quizData, okQuiz: !!r?.notes.find((n) => n.id === 'ok')?.quizData,
      rawQuizRotto: rawNotes.find((n) => n.id === 'quiz-rotto')?.quizData, rawOrfano: rawNotes.find((n) => n.id === 'orfano')?.folderId, rawTitleSenzaData: rawNotes.find((n) => n.id === 'senza-data')?.title,
      byId: Object.fromEntries((r?.folders ?? []).map((f) => [f.id, f.parentId])) };
  });
  check(r3.error === null, 'la lettura non lancia nonostante i record corrotti');
  check(JSON.stringify(r3.notes) === JSON.stringify(['ok', 'orfano', 'quiz-rotto', 'senza-data', 'stringa-non-oggetto-ma-con-id']) && JSON.stringify(r3.folders) === JSON.stringify(['a', 'b', 'c', 'd']), 'nessun record con id va perso', `${r3.notes?.length} appunti, ${r3.folders?.length} cartelle`);
  check(r3.quizOfRotto === null && r3.okQuiz, 'il quiz malformato diventa null; quello valido resta');
  check(r3.byId.c === null && (r3.byId.a === null || r3.byId.b === null) && r3.byId.d === null, 'ciclo spezzato, genitore inesistente e parentId assente → radice', JSON.stringify(r3.byId));
  check(r3.rawOrfano === null, 'la riparazione dell\'appunto orfano è scritta nel DB');
  check(r3.rawQuizRotto && r3.rawQuizRotto.questions === 'no', 'la lettura NON riscrive il quiz malformato nel DB (nessuna perdita silenziosa)');
  check(r3.rawTitleSenzaData === 7, 'né altri campi dei record non riparati');

  // ---------------------------------------------------------------- 4. due schede
  section('4. Due schede: scheda "vecchia" con copia obsoleta');
  await fresh(A);
  await A.evaluate(async () => { await window.__raw.put('notes', [{ id: 'n', title: 'Titolo originale', content: 'originale', emoji: '📚', color: 'bg-red-100', folderId: null, createdAt: '2025-01-01T00:00:00.000Z' }]); await window.__raw.put('folders', [{ id: 'f', name: 'F', emoji: '📚', color: 'bg-red-100', createdAt: '2025-01-01T00:00:00.000Z', parentId: null }]); });
  // Scheda A modifica titolo e contenuto; la scheda B (copia obsoleta in memoria) sposta l'appunto in una cartella
  const stale = { id: 'n', title: 'Titolo originale', content: 'originale', emoji: '📚', color: 'bg-red-100', folderId: 'f', createdAt: '2025-01-01T00:00:00.000Z' };
  const r4 = await A.evaluate(async (staleNote) => {
    const { dbJobs, enqueueWrite, whenWritesSettled } = window.__notesDb;
    enqueueWrite(dbJobs.patch([{ id: 'n', patch: { title: 'MODIFICATO IN A', content: 'testo lungo scritto in A' }, full: { id: 'n' } }]));      // scheda A
    enqueueWrite(dbJobs.patch([{ id: 'n', patch: { folderId: 'f' }, full: staleNote }]));                                                           // scheda B (copia obsoleta)
    await whenWritesSettled();
    return (await window.__raw.getAll('notes')).find((n) => n.id === 'n');
  }, stale);
  check(r4.title === 'MODIFICATO IN A' && r4.content === 'testo lungo scritto in A' && r4.folderId === 'f', 'con le patch le modifiche di A e B convivono', JSON.stringify({ title: r4.title, folderId: r4.folderId }));
  section('4b. Riproduzione del comportamento PRECEDENTE (stessa logica del vecchio useNotesStore, riscritta qui)');
  const old = await A.evaluate(async (staleNote) => {
    // vecchio updateNote/moveNote: db.put('notes', copiaCompletaInMemoria)
    await window.__raw.put('notes', [{ id: 'n', title: 'MODIFICATO IN A', content: 'testo lungo scritto in A', emoji: '📚', color: 'bg-red-100', folderId: null, createdAt: '2025-01-01T00:00:00.000Z' }]);
    await window.__raw.put('notes', [staleNote]); // la scheda B scrive la sua copia completa e obsoleta
    const afterStale = (await window.__raw.getAll('notes')).find((n) => n.id === 'n');
    // vecchia migrazione: "se il DB è vuoto e c'è studia_data, importa" e studia_data non veniva mai tolta
    await window.__raw.clear();
    localStorage.setItem('studia_data', JSON.stringify({ notes: [{ id: 'zombie', title: 'cancellato da tempo' }], folders: [] }));
    const empty = (await window.__raw.getAll('notes')).length === 0;
    const wouldResurrect = empty && localStorage.getItem('studia_data') !== null;
    return { lostTitle: afterStale.title !== 'MODIFICATO IN A', wouldResurrect };
  }, stale);
  check(old.lostTitle === true, 'VECCHIO codice: la scrittura della scheda obsoleta cancella le modifiche dell\'altra (perdita di dati riprodotta)');
  check(old.wouldResurrect === true, 'VECCHIO codice: con DB vuoto e studia_data ancora presente i vecchi appunti sarebbero risuscitati');

  // ---------------------------------------------------------------- 5. sincronizzazione
  section('5. Sincronizzazione fra schede (BroadcastChannel)');
  await fresh(A);
  const B = await open();
  await B.evaluate(() => { window.__remote = 0; window.__off = window.__notesDb.onRemoteChange(() => { window.__remote++; }); });
  await A.evaluate(async () => { const { dbJobs, enqueueWrite, whenWritesSettled } = window.__notesDb; enqueueWrite(dbJobs.putNotes([{ id: 'sync1', title: 'Da A', content: '', emoji: '📚', color: 'bg-red-100', folderId: null, createdAt: '2026-01-01T00:00:00.000Z' }])); await whenWritesSettled(); });
  await B.waitForFunction(() => window.__remote >= 1, null, { timeout: 5000 });
  const seen = await B.evaluate(async () => (await window.__notesDb.readAll()).notes.map((n) => n.id));
  check(seen.includes('sync1'), 'la scheda B riceve la notifica e rilegge la nota scritta da A', `notifiche: ${await B.evaluate(() => window.__remote)}`);
  const aGotOwn = await A.evaluate(() => new Promise((res) => { let n = 0; const off = window.__notesDb.onRemoteChange(() => n++); setTimeout(() => { off(); res(n); }, 300); }));
  check(aGotOwn === 0, 'la scheda che scrive non riceve la propria notifica');
  await B.close();

  // ---------------------------------------------------------------- 6. aggiornamento schema da una scheda nuova
  section('6. Una scheda più NUOVA vuole aggiornare lo schema (v2) mentre questa è aperta');
  await A.evaluate(async () => { await window.__notesDb.closeDB(); await window.__notesDb.getDB(); }); // connessione aperta, come in una scheda in uso
  const up = await A.evaluate(() => window.__raw.upgradeToV2(4000));
  check(up.ok && up.ms < 2000, 'l\'upgrade non resta bloccato: la scheda vecchia chiude la connessione', `${Math.round(up.ms)} ms`);
  const reopened = await A.evaluate(async () => { try { await window.__notesDb.readAll(); return 'riaperto'; } catch (e) { return String(e.name || e); } });
  check(reopened === 'VersionError', 'la scheda vecchia, dopo l\'upgrade, non scrive su uno schema che non conosce (VersionError: va ricaricata l\'app nuova)', reopened);

  // ---------------------------------------------------------------- 7. coda e persistenza
  section('7. Scritture in ordine e archiviazione persistente');
  await A.evaluate(() => window.__raw.deleteDb());
  const r7 = await A.evaluate(async () => {
    const { dbJobs, enqueueWrite, whenWritesSettled, pendingWrites, requestPersistentStorage } = window.__notesDb;
    const mk = (title) => [{ id: 'q', title, content: '', emoji: '📚', color: 'bg-red-100', folderId: null, createdAt: '2026-01-01T00:00:00.000Z' }];
    for (let i = 1; i <= 25; i++) enqueueWrite(dbJobs.putNotes(mk(`v${i}`)));
    const pendingBefore = pendingWrites();
    await whenWritesSettled();
    const last = (await window.__raw.getAll('notes'))[0].title;
    const first = await requestPersistentStorage(); // già chiesta dalla prima scrittura: ora deve restituire false senza richiedere di nuovo
    return { last, pendingBefore, pendingAfter: pendingWrites(), first, persisted: navigator.storage?.persisted ? await navigator.storage.persisted() : 'n/d' };
  });
  check(r7.last === 'v25' && r7.pendingAfter === 0 && r7.pendingBefore > 0, '25 scritture ravvicinate: l\'ultima vince, nessuna in sospeso', JSON.stringify({ last: r7.last, pending: r7.pendingBefore }));
  check(r7.first === false, 'navigator.storage.persist() viene chiesta una sola volta per sessione', `persisted ora: ${r7.persisted}`);
} finally {
  await browser.close().catch(() => {});
  server.close();
}
console.log(failures === 0 ? '\nTUTTE LE PROVE SUPERATE' : `\n${failures} PROVA/E FALLITA/E`);
process.exit(failures === 0 ? 0 : 1);
