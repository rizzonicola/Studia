#!/usr/bin/env node
/**
 * Controllo statico della PWA (solo Node, nessuna dipendenza, nessun browser):   npm run check:pwa
 * Legge i file sorgente (public/, index.html, utils/, config/) e segnala ciò che farebbe tornare i problemi già risolti.
 *
 *   manifest     theme_color e background_color = sfondo del tema predefinito (la barra di navigazione di Android prende il colore da lì);
 *                icone presenti, della dimensione dichiarata, con le tre «purpose» (any, maskable, monochrome);
 *   per tema     un manifest per ogni colore di sfondo delle palette (public/manifests/<colore>.json), identico a quello di base tranne i due
 *                colori; nessun file in più; il service worker li serve «rete per prima»;
 *   icone        le maskable hanno sfondo a tutto campo e il logo entro la ZONA SICURA (≤ 31 % del lato dal centro; oltre, la maschera
 *                circolare di Android taglia gli angoli e l'icona sembra «zoomata»); la monochrome è trasparente con la stessa regola;
 *   tema         index.html ha le due meta theme-color (chiaro/scuro) e theme-init.js e utils/themeEngine.ts le uniscono nello stesso modo
 *                e collegano gli stessi manifest;
 *   index.html   viewport-fit=cover, manifest, icone e apple-touch-icon esistenti.
 * Per la verifica esatta dei manifest per tema (rigenerati dalle palette): npm run check:manifests.
 *
 * Uso:   node tools/pwa-check.mjs [--root cartella-del-progetto]
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const root = path.resolve(args.includes('--root') ? args[args.indexOf('--root') + 1] : path.join(here, '..'));
const pub = (p) => path.join(root, 'public', p.replace(/^\//, ''));
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

let failures = 0;
const check = (ok, label, detail = '') => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'OK    ' : 'ERRORE'} ${label}${detail ? `  (${detail})` : ''}`);
};
const section = (t) => console.log(`\n${t}`);

// ------------------------------------------------------------------------------------------------ lettore PNG (non interlacciato)
/** Decodifica un PNG in RGBA a 8 bit. Supporta scala di grigi, RGB, palette (anche a 1/2/4 bit, come dopo una compressione tipo TinyPNG), con o senza trasparenza. */
function decodePng(buf) {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error('non è un PNG');
  let pos = 8, width = 0, height = 0, depth = 0, colorType = 0, interlace = 0, palette = Buffer.alloc(0), transparency = Buffer.alloc(0);
  const idat = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); depth = data[8]; colorType = data[9]; interlace = data[12]; }
    else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') transparency = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const samples = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!samples || ![1, 2, 4, 8, 16].includes(depth)) throw new Error(`formato PNG non riconosciuto (tipo colore ${colorType}, ${depth} bit)`);
  if (interlace !== 0) throw new Error('PNG interlacciato: non supportato dal controllo');

  const bitsPerPixel = samples * depth;
  const bpp = Math.max(1, bitsPerPixel >> 3);
  const stride = Math.ceil((width * bitsPerPixel) / 8);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const rows = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? rows[y * stride + x - bpp] : 0;
      const b = y > 0 ? rows[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? rows[(y - 1) * stride + x - bpp] : 0;
      let v = row[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += Math.floor((a + b) / 2);
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      rows[y * stride + x] = v & 255;
    }
  }

  // Un campione di un pixel; a 16 bit si tiene il byte alto, sotto gli 8 bit i valori sono quelli grezzi (indice o livello di grigio)
  const sampleAt = (row, x, s) => {
    if (depth === 8) return row[x * samples + s];
    if (depth === 16) return row[(x * samples + s) * 2];
    const bit = (x * samples + s) * depth;
    return (row[bit >> 3] >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
  };
  const gray = (v) => (depth < 8 ? Math.round((v * 255) / ((1 << depth) - 1)) : v);
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = rows.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < width; x++) {
      let r, g, b, a = 255;
      if (colorType === 0) { r = g = b = gray(sampleAt(row, x, 0)); }
      else if (colorType === 2) { r = sampleAt(row, x, 0); g = sampleAt(row, x, 1); b = sampleAt(row, x, 2); }
      else if (colorType === 3) {
        const i = sampleAt(row, x, 0);
        r = palette[i * 3] ?? 0; g = palette[i * 3 + 1] ?? 0; b = palette[i * 3 + 2] ?? 0;
        a = i < transparency.length ? transparency[i] : 255;
      }
      else if (colorType === 4) { r = g = b = sampleAt(row, x, 0); a = sampleAt(row, x, 1); }
      else { r = sampleAt(row, x, 0); g = sampleAt(row, x, 1); b = sampleAt(row, x, 2); a = sampleAt(row, x, 3); }
      const o = (y * width + x) * 4;
      rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = a;
    }
  }
  return { width, height, data: rgba };
}

/** Punto «di inchiostro» più lontano dal centro (frazione del lato) e trasparenza/opacità dei quattro angoli. */
function measureIcon(png, inkIsAlpha) {
  const { width, height, data } = png;
  const px = (x, y) => { const i = (y * width + x) * 4; return { r: data[i], a: data[i + 3] }; };
  let r2 = 0, ink = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = px(x, y);
      const isInk = inkIsAlpha ? p.a > 128 : p.a > 128 && p.r < 128;
      if (isInk) {
        ink++;
        const dx = x + 0.5 - width / 2, dy = y + 0.5 - height / 2;
        r2 = Math.max(r2, dx * dx + dy * dy);
      }
    }
  }
  const corners = [px(0, 0), px(width - 1, 0), px(0, height - 1), px(width - 1, height - 1)];
  return { radius: Math.sqrt(r2) / width, ink, opaqueCorners: corners.every((c) => c.a === 255), transparentCorners: corners.every((c) => c.a === 0) };
}

/** Misura un'icona; se il file non si legge, lo segnala come errore (senza interrompere il resto dei controlli). */
function tryMeasure(src, inkIsAlpha) {
  try {
    return measureIcon(decodePng(fs.readFileSync(pub(src))), inkIsAlpha);
  } catch (error) {
    check(false, `${src}: icona non leggibile dal controllo`, error.message);
    return null;
  }
}

const SAFE_LIMIT = 0.31; // zona sicura di Android: 0,305 del lato dal centro

// ------------------------------------------------------------------------------------------------ palette (da config/themes.ts)
const themesSrc = read('config', 'themes.ts');
const presets = [...themesSrc.matchAll(/\{ id: '([a-z]+)', scheme: '(light|dark)'[^\n]*?tokens: \{ bg: '(#[0-9a-fA-F]{6})'/g)].map((m) => ({ id: m[1], scheme: m[2], bg: m[3].toLowerCase() }));
const defaults = themesSrc.match(/DEFAULT_PRESET[^=]*=\s*\{\s*light:\s*'([^']+)'\s*,\s*dark:\s*'([^']+)'/);
const defaultBg = (scheme) => presets.find((p) => p.scheme === scheme && p.id === defaults?.[scheme === 'light' ? 1 : 2])?.bg;
const lightBg = defaultBg('light');
const darkBg = defaultBg('dark');

// ------------------------------------------------------------------------------------------------ manifest
section('Manifest (public/manifest.json)');
const baseText = read('public', 'manifest.json');
const manifest = JSON.parse(baseText);
check(presets.length >= 10 && Boolean(lightBg) && Boolean(darkBg), 'palette lette da config/themes.ts', `${presets.length} palette, sfondi predefiniti ${lightBg} / ${darkBg}`);
check(/^#[0-9a-f]{6}$/i.test(manifest.theme_color ?? ''), 'theme_color presente (colore della barra di navigazione di Android)', manifest.theme_color);
check(manifest.theme_color === lightBg, 'theme_color = sfondo del tema chiaro predefinito (/manifest.json è il manifest di base)', `${manifest.theme_color} / ${lightBg}`);
check(manifest.background_color === manifest.theme_color, 'background_color = theme_color (la schermata di avvio ha il colore dell\'app)', manifest.background_color);
for (const key of ['name', 'short_name', 'start_url', 'scope', 'id', 'display']) check(Boolean(manifest[key]), `campo «${key}» presente`, String(manifest[key] ?? ''));
check(!('share_target' in manifest), 'nessun share_target (non funziona con i browser che installano come scorciatoia, es. Brave, né su iPhone)');

const icons = manifest.icons ?? [];
const byPurpose = (purpose) => icons.filter((i) => (i.purpose ?? 'any').split(/\s+/).includes(purpose));
for (const icon of icons) {
  const file = pub(icon.src);
  if (!fs.existsSync(file)) { check(false, `file icona presente: ${icon.src}`); continue; }
  if (icon.type === 'image/png') {
    const buf = fs.readFileSync(file);
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    check(`${w}x${h}` === icon.sizes, `${icon.src}: dimensione reale = dichiarata`, `${w}x${h} / ${icon.sizes}`);
  } else check(true, `${icon.src} presente`);
}
check(byPurpose('any').some((i) => i.sizes === '192x192') && byPurpose('any').some((i) => i.sizes === '512x512'), 'icone «any» 192 e 512');
check(byPurpose('maskable').some((i) => i.sizes === '512x512'), 'icona «maskable» 512');
check(byPurpose('monochrome').length > 0, 'icona «monochrome» (icone a tema di Android 13+)');
check(!icons.some((i) => (i.purpose ?? '').includes('any') && (i.purpose ?? '').includes('maskable')), 'nessuna icona con purpose «any maskable» insieme (andrebbe ritagliata anche dove non serve)');

section('Manifest per tema (public/manifests/)');
const colorField = (name) => new RegExp(`("${name}":\\s*")(#[0-9a-fA-F]{6})(")`);
const variantText = (bg) => baseText.replace(colorField('theme_color'), `$1${bg}$3`).replace(colorField('background_color'), `$1${bg}$3`);
const wantedBgs = [...new Set(presets.map((p) => p.bg))].filter((bg) => bg !== lightBg);
const variantDir = path.join(root, 'public', 'manifests');
const variantFiles = fs.existsSync(variantDir) ? fs.readdirSync(variantDir) : [];
check(wantedBgs.length > 0 && wantedBgs.every((bg) => variantFiles.includes(`${bg.slice(1)}.json`)), 'c\'è un manifest per ogni sfondo delle palette', `${wantedBgs.length} attesi, ${variantFiles.length} trovati`);
for (const bg of wantedBgs) {
  const f = path.join(variantDir, `${bg.slice(1)}.json`);
  if (!fs.existsSync(f)) { check(false, `manca manifests/${bg.slice(1)}.json`); continue; }
  check(fs.readFileSync(f, 'utf8') === variantText(bg), `manifests/${bg.slice(1)}.json: identico al manifest di base tranne i due colori (= ${bg})`);
}
check(variantFiles.every((f) => /^[0-9a-f]{6}\.json$/.test(f) && wantedBgs.includes(`#${f.slice(0, 6)}`)), 'nessun manifest in più di quelli delle palette', variantFiles.filter((f) => !wantedBgs.includes(`#${f.slice(0, 6)}`)).join(', '));
const swSrc = read('public', 'service-worker.js');
const variantRe = swSrc.match(/MANIFEST_VARIANT_PATH = \/(.+)\/;/)?.[1];
check(Boolean(variantRe) && wantedBgs.every((bg) => new RegExp(variantRe).test(`/manifests/${bg.slice(1)}.json`)), 'il service worker riconosce tutti i manifest per tema (rete per prima)');
check(/pathname === MANIFEST_PATH/.test(swSrc) && /isManifest\(url\.pathname\)/.test(swSrc), 'e anche /manifest.json');

// ------------------------------------------------------------------------------------------------ icone: geometria
section('Icone: geometria (zona sicura delle maskable)');
for (const icon of byPurpose('maskable').filter((i) => i.type === 'image/png')) {
  const m = tryMeasure(icon.src, false);
  if (!m) continue;
  check(m.opaqueCorners, `${icon.src}: sfondo a tutto campo (angoli opachi)`);
  check(m.ink > 0 && m.radius <= SAFE_LIMIT, `${icon.src}: logo entro la zona sicura`, `punto più lontano a ${(m.radius * 100).toFixed(1)} % del lato, limite ${(SAFE_LIMIT * 100).toFixed(0)} %`);
}
for (const icon of byPurpose('monochrome').filter((i) => i.type === 'image/png')) {
  const m = tryMeasure(icon.src, true);
  if (!m) continue;
  check(m.transparentCorners, `${icon.src}: sfondo trasparente`);
  check(m.ink > 0 && m.radius <= SAFE_LIMIT, `${icon.src}: forma entro la zona sicura`, `${(m.radius * 100).toFixed(1)} % del lato`);
}

section('Scorciatoie (shortcuts)');
const app = read('App.tsx');
for (const sc of manifest.shortcuts ?? []) {
  const route = sc.url.replace(/^\//, '');
  check(fs.existsSync(pub(sc.icons?.[0]?.src ?? '/__manca__')), `scorciatoia «${sc.name}»: icona presente`);
  check(route === '' || app.includes(`path="${route}"`), `scorciatoia «${sc.name}»: la rotta ${sc.url} esiste in App.tsx`);
}

// ------------------------------------------------------------------------------------------------ index.html e tema
section('index.html, colore della barra di stato e manifest del tema');
const html = read('index.html');
check(/<meta name="viewport"[^>]*viewport-fit=cover/.test(html), 'viewport con viewport-fit=cover');
check(/<link rel="manifest" href="\/manifest\.json"/.test(html), 'collegamento al manifest di base');
const themeMetas = [...html.matchAll(/<meta name="theme-color"[^>]*>/g)].map((m) => m[0]);
check(themeMetas.length === 2 && themeMetas.some((m) => /prefers-color-scheme: light/.test(m)) && themeMetas.some((m) => /prefers-color-scheme: dark/.test(m)), 'due meta theme-color (chiaro e scuro) per il primo disegno', `${themeMetas.length} trovate`);
for (const href of [...html.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)].map((m) => m[1])) check(fs.existsSync(pub(href)), `icona collegata esistente: ${href}`);
const init = read('public', 'theme-init.js');
const engine = read('utils', 'themeEngine.ts');
check(/removeAttribute\('media'\)/.test(init) && /removeAttribute\('media'\)/.test(engine), 'theme-init.js e themeEngine.ts uniscono le due meta in una sola, senza media query (stessa logica)');
check(/export function applyThemeColorMeta/.test(engine) && /applyThemeColorMeta\(result\.palette\.surface\)/.test(engine), 'applyThemeToDocument aggiorna la meta con il colore della superficie del tema');
check(/export function applyManifestLink/.test(engine) && /applyManifestLink\(manifestUrlForBackground\(result\.palette\.bg\)\)/.test(engine), 'applyThemeToDocument collega il manifest della palette con lo sfondo più vicino');
check(/manifest: manifestUrlForBackground\(light\.palette\.bg\)/.test(engine) && /manifest: manifestUrlForBackground\(dark\.palette\.bg\)/.test(engine), 'lo snapshot di avvio contiene il manifest per tema chiaro e scuro');
check(/link\[rel="manifest"\]/.test(init) && /t\.manifest/.test(init) && init.includes(String.raw`/^\/manifests\/[0-9a-f]{6}\.json$/`), 'theme-init.js collega il manifest dello snapshot (accetta solo indirizzi che esistono)');
const firstVisit = init.match(/setManifest\('(\/manifests\/[0-9a-f]{6}\.json)'\)/)?.[1];
check(Boolean(firstVisit) && firstVisit === `/manifests/${darkBg?.slice(1)}.json`, 'alla prima visita con dispositivo scuro theme-init.js usa il manifest del tema scuro predefinito', `${firstVisit} / ${darkBg}`);

console.log(failures ? `\n${failures} errori` : '\nTutto in ordine');
process.exit(failures ? 1 : 0);
