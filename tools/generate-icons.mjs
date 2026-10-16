#!/usr/bin/env node
/**
 * Rigenera le icone della PWA a partire dal logo vettoriale (public/favicon.svg, l'UNICA fonte).
 *
 *   node tools/generate-icons.mjs
 *
 * Serve `sharp` (npm i -D sharp, oppure SHARP_MODULE_PATH=/percorso/a/sharp). Non fa parte della build né del deploy:
 * le icone generate sono file normali in public/ e vanno committate.
 *
 * File prodotti (cartella public/):
 *   icons/icon-192.png, icons/icon-512.png      "any"        logo largo il 75 % del lato, sfondo bianco
 *   icons/apple-touch-icon.png (180)            iOS          come "any" (iOS arrotonda gli angoli da solo: niente trasparenza)
 *   icons/maskable-192.png, icons/maskable-512.png  "maskable"  sfondo a tutto campo + logo dentro la ZONA SICURA
 *   icons/monochrome-512.png                    "monochrome" solo forma, nero su trasparente (icone a tema di Android 13+)
 *   favicon.ico                                 16, 32 e 48 px (PNG incorporati)
 *
 * Perché la zona sicura: Android ritaglia le icone "maskable" con un cerchio (o un'altra forma, a scelta del produttore del
 * telefono) che può lasciare visibile solo ~66 % del lato. Il punto del logo più lontano dal centro deve quindi stare entro
 * ~30 % del lato (SAFE_RADIUS): oltre, gli angoli vengono tagliati e l'icona sembra "zoomata".
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const loadSharp = () => {
  const tries = [process.env.SHARP_MODULE_PATH, 'sharp', path.join(root, 'node_modules', 'sharp')].filter(Boolean);
  for (const t of tries) {
    try { return require(t); } catch { /* prossimo */ }
  }
  throw new Error('sharp non trovato: `npm i -D sharp`, oppure imposta SHARP_MODULE_PATH.');
};
const sharp = loadSharp();

// ---------------------------------------------------------------------------------------------- parametri di progetto
const FG = '#000000';
const BG = '#ffffff';
/** Larghezza del logo nelle icone "any" e iOS (frazione del lato). */
const ANY_WIDTH = 0.75;
/** Raggio massimo del logo nelle icone "maskable" e "monochrome" (frazione del lato): zona sicura di Android (66 dp su 108 dp ≈ 0,305). */
const SAFE_RADIUS = 0.3;
/** Larghezza del logo nelle favicon (frazione del lato): più grande, perché a 16 px ogni pixel conta. */
const FAVICON_WIDTH = 0.88;

// ---------------------------------------------------------------------------------------------- lettura del logo
const logoSvg = fs.readFileSync(path.join(root, 'public', 'favicon.svg'), 'utf8');
const groupTransform = logoSvg.match(/<g transform="([^"]+)"/)?.[1] ?? '';
const paths = [...logoSvg.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]);
const strokeWidth = Number(logoSvg.match(/stroke-width:\s*([\d.]+)/)?.[1] ?? 6);
if (paths.length === 0) throw new Error('public/favicon.svg: nessun <path> trovato');

const logoGroup = (color) =>
  `<g transform="${groupTransform}" fill="${color}" stroke="${color}" stroke-width="${strokeWidth}" stroke-linejoin="round">${paths.map((d) => `<path d="${d}"/>`).join('')}</g>`;

/** Misura il logo: riquadro, centro e punto più lontano dal centro (in unità del disegno originale). */
async function measureLogo() {
  const W = 600;
  const H = 500;
  const PX = 4; // pixel per unità: precisione di ~0,25 unità
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * PX}" height="${H * PX}" viewBox="0 0 ${W} ${H}">${logoGroup('#000')}</svg>`;
  const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  const opaque = [];
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 128) {
        opaque.push(x, y);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (minX === 0 || minY === 0 || maxX === info.width - 1 || maxY === info.height - 1) throw new Error('il logo tocca il bordo dell\'area di misura: ingrandirla');
  const box = { x0: minX / PX, y0: minY / PX, x1: (maxX + 1) / PX, y1: (maxY + 1) / PX };
  const cx = (box.x0 + box.x1) / 2;
  const cy = (box.y0 + box.y1) / 2;
  let r2 = 0;
  for (let i = 0; i < opaque.length; i += 2) {
    const dx = (opaque[i] + 0.5) / PX - cx;
    const dy = (opaque[i + 1] + 0.5) / PX - cy;
    r2 = Math.max(r2, dx * dx + dy * dy);
  }
  return { cx, cy, width: box.x1 - box.x0, height: box.y1 - box.y0, radius: Math.sqrt(r2) };
}

const logo = await measureLogo();

/** SVG di un'icona quadrata di lato `size`: logo centrato, scalato di `k`. */
const iconSvg = (size, k, { background = BG, color = FG } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
  (background ? `<rect width="${size}" height="${size}" fill="${background}"/>` : '') +
  `<g transform="translate(${size / 2} ${size / 2}) scale(${k}) translate(${-logo.cx} ${-logo.cy})">${logoGroup(color)}</g></svg>`;

const scaleForWidth = (size, fraction) => (size * fraction) / logo.width;
const scaleForRadius = (size, fraction) => (size * fraction) / logo.radius;

const render = (svg) => sharp(Buffer.from(svg)).png({ compressionLevel: 9 });
const out = (relative) => {
  const file = path.join(root, 'public', relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return file;
};

/** Contenitore .ico con PNG incorporati (supportato da tutti i browser moderni). */
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // riservato
  header.writeUInt16LE(1, 2); // tipo: icona
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, data } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); // tavolozza
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4); // piani
    e.writeUInt16LE(32, 6); // bit per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

// ---------------------------------------------------------------------------------------------- generazione
const written = [];
const save = async (relative, svg, size) => {
  await render(svg).toFile(out(relative));
  written.push(`${relative} (${size}×${size})`);
};

for (const size of [192, 512]) {
  await save(`icons/icon-${size}.png`, iconSvg(size, scaleForWidth(size, ANY_WIDTH)), size);
  await save(`icons/maskable-${size}.png`, iconSvg(size, scaleForRadius(size, SAFE_RADIUS)), size);
}
await save('icons/apple-touch-icon.png', iconSvg(180, scaleForWidth(180, ANY_WIDTH)), 180);
await save('icons/monochrome-512.png', iconSvg(512, scaleForRadius(512, SAFE_RADIUS), { background: null }), 512);

const icoImages = [];
for (const size of [16, 32, 48]) {
  icoImages.push({ size, data: await render(iconSvg(size, scaleForWidth(size, FAVICON_WIDTH))).toBuffer() });
}
fs.writeFileSync(out('favicon.ico'), buildIco(icoImages));
written.push('favicon.ico (16, 32, 48)');

console.log(`Logo: ${logo.width.toFixed(1)} × ${logo.height.toFixed(1)} unità, punto più lontano dal centro: ${logo.radius.toFixed(1)}`);
console.log(`Zona sicura maskable: ${(SAFE_RADIUS * 100).toFixed(0)} % del lato\n`);
for (const w of written) console.log(`  scritto  public/${w}`);
