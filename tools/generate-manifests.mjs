#!/usr/bin/env node
/**
 * Genera i manifest per tema:   node tools/generate-manifests.mjs          (scrive public/manifests/<colore>.json)
 *                               node tools/generate-manifests.mjs --check  (non scrive: segnala file mancanti, vecchi o in più)
 *
 * Perché ce ne sono tanti: la barra di navigazione di Android la colora il browser con il theme_color del manifest, letto quando
 * installa o aggiorna l'app (nessuna API web la cambia a runtime, e Android non supporta varianti scure nel manifest). Per far somigliare
 * la barra al tema dell'app, il sito collega a <link rel="manifest"> il manifest della palette più vicina (utils/manifestVariants.ts).
 * Qui si creano: uno per ogni colore di sfondo delle palette predefinite di config/themes.ts, tutti IDENTICI a public/manifest.json
 * tranne theme_color e background_color (stesso id, stesso scope, stesse icone: per il browser è sempre la stessa app).
 * public/manifest.json è il manifest di base (tema «Classico»): qui si controlla che abbia i colori giusti, non lo si riscrive.
 *
 * Rilancialo dopo aver cambiato le palette (config/themes.ts); `--check` serve in CI (npm run check:manifests).
 * Serve esbuild (c'è già: lo porta vite). Variabile ESBUILD_MODULE_PATH per indicare dove trovarlo.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'manifests');
const checkOnly = process.argv.includes('--check');

const require = createRequire(import.meta.url);
const loadEsbuild = () => {
  for (const n of [process.env.ESBUILD_MODULE_PATH, 'esbuild', path.join(root, 'node_modules', 'esbuild')].filter(Boolean)) {
    try { return require(n); } catch { /* prossimo */ }
  }
  throw new Error('esbuild non trovato: `npm install`, oppure imposta ESBUILD_MODULE_PATH.');
};

// Si compila utils/manifestVariants.ts (TypeScript) in un file temporaneo e lo si importa: le palette restano in UN solo posto.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'studia-manifests-'));
const bundled = path.join(tmp, 'manifestVariants.mjs');
loadEsbuild().buildSync({ entryPoints: [path.join(root, 'utils', 'manifestVariants.ts')], bundle: true, format: 'esm', platform: 'node', outfile: bundled, logLevel: 'error' });
const { manifestBackgrounds, DEFAULT_MANIFEST_BG } = await import(pathToFileURL(bundled).href);
fs.rmSync(tmp, { recursive: true, force: true });

const basePath = path.join(root, 'public', 'manifest.json');
const baseText = fs.readFileSync(basePath, 'utf8');
const colorField = (name) => new RegExp(`("${name}":\\s*")(#[0-9a-fA-F]{6})(")`);
for (const field of ['theme_color', 'background_color']) {
  const m = colorField(field).exec(baseText);
  if (!m) { console.error(`public/manifest.json: manca "${field}" (colore esadecimale a 6 cifre).`); process.exit(1); }
  if (m[2].toLowerCase() !== DEFAULT_MANIFEST_BG) {
    console.error(`public/manifest.json: "${field}" è ${m[2]}, dovrebbe essere ${DEFAULT_MANIFEST_BG} (sfondo del tema chiaro predefinito).`);
    process.exit(1);
  }
}

const variantText = (bg) => baseText.replace(colorField('theme_color'), `$1${bg}$3`).replace(colorField('background_color'), `$1${bg}$3`);
const expected = new Map(manifestBackgrounds().filter((bg) => bg !== DEFAULT_MANIFEST_BG).map((bg) => [`${bg.slice(1)}.json`, variantText(bg)]));

const existing = fs.existsSync(outDir) ? fs.readdirSync(outDir).filter((f) => f.endsWith('.json')) : [];
const missing = [...expected.keys()].filter((f) => !existing.includes(f));
const stale = [...expected].filter(([f, text]) => existing.includes(f) && fs.readFileSync(path.join(outDir, f), 'utf8') !== text).map(([f]) => f);
const extra = existing.filter((f) => !expected.has(f));

if (checkOnly) {
  for (const f of missing) console.log(`  MANCA    public/manifests/${f}`);
  for (const f of stale) console.log(`  VECCHIO  public/manifests/${f} (non coincide con manifest.json + il colore del file)`);
  for (const f of extra) console.log(`  IN PIÙ   public/manifests/${f} (nessuna palette ha quello sfondo)`);
  const problems = missing.length + stale.length + extra.length;
  console.log(problems ? `\n${problems} problemi: lancia \`npm run manifests\`.` : `Manifest per tema in ordine (${expected.size} file + quello di base).`);
  process.exit(problems ? 1 : 0);
}

fs.mkdirSync(outDir, { recursive: true });
for (const f of extra) { fs.rmSync(path.join(outDir, f)); console.log(`  rimosso  public/manifests/${f}`); }
for (const [f, text] of expected) {
  fs.writeFileSync(path.join(outDir, f), text);
  console.log(`  scritto  public/manifests/${f}`);
}
console.log(`\n${expected.size} manifest per tema (+ /manifest.json per lo sfondo ${DEFAULT_MANIFEST_BG}).`);
