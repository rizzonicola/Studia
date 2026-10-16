#!/usr/bin/env node
/**
 * Analisi STATICA del grafo degli import (nessuna build necessaria).
 *
 * Per ogni "radice di chunk" (l'entry `index.tsx` e ogni modulo importato con `import()` dinamico) calcola quali moduli del
 * progetto e quali pacchetti npm sono raggiungibili seguendo SOLO gli import statici. Serve a verificare che le librerie pesanti
 * (jszip, vis-network, KaTeX, SDK Gemini...) NON siano nel download iniziale. Non misura byte: per quelli usare `vite build`.
 *
 * Uso:  node tools/import-graph.mjs [--json]      (richiede `typescript`, già tra le devDependencies)
 */
import { createRequire } from 'node:module';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXTS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.css'];

const resolveLocal = (from, spec) => {
  const base = spec.startsWith('@/') ? path.join(root, spec.slice(2)) : path.resolve(path.dirname(from), spec);
  const candidates = [base, ...EXTS.map((e) => base + e), ...EXTS.map((e) => path.join(base, 'index' + e))];
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? null;
};
const pkgName = (spec) => (spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]);
const isLocal = (spec) => spec.startsWith('.') || spec.startsWith('@/');

const cache = new Map();
function parse(file) {
  if (cache.has(file)) return cache.get(file);
  const out = { static: [], dynamic: [], pkgsStatic: new Set(), pkgsDynamic: new Set(), size: 0 };
  cache.set(file, out);
  if (!/\.(tsx?|jsx?)$/.test(file)) return out;
  const text = readFileSync(file, 'utf8');
  out.size = Buffer.byteLength(text);
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const add = (spec, dynamic, typeOnly) => {
    if (typeOnly) return;
    if (isLocal(spec)) {
      const r = resolveLocal(file, spec);
      if (r) (dynamic ? out.dynamic : out.static).push(r);
    } else (dynamic ? out.pkgsDynamic : out.pkgsStatic).add(pkgName(spec));
  };
  const visit = (n) => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
      const clause = n.importClause;
      const typeOnly = !!clause && (clause.isTypeOnly || (!clause.name && clause.namedBindings && ts.isNamedImports(clause.namedBindings) && clause.namedBindings.elements.length > 0 && clause.namedBindings.elements.every((e) => e.isTypeOnly)));
      add(n.moduleSpecifier.text, false, typeOnly);
    } else if (ts.isExportDeclaration(n) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier) && !n.isTypeOnly) {
      add(n.moduleSpecifier.text, false, false);
    } else if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && n.arguments[0] && ts.isStringLiteral(n.arguments[0])) {
      add(n.arguments[0].text, true, false);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

function closure(entry) {
  const files = new Set();
  const pkgs = new Set();
  const dynamicTargets = new Set();
  const dynamicPkgs = new Set();
  const stack = [entry];
  while (stack.length) {
    const f = stack.pop();
    if (files.has(f)) continue;
    files.add(f);
    const p = parse(f);
    p.pkgsStatic.forEach((x) => pkgs.add(x));
    p.pkgsDynamic.forEach((x) => dynamicPkgs.add(x));
    p.dynamic.forEach((d) => dynamicTargets.add(d));
    p.static.forEach((s) => stack.push(s));
  }
  return { files, pkgs, dynamicTargets, dynamicPkgs };
}

const entry = path.join(root, 'index.tsx');
const main = closure(entry);
const rel = (f) => path.relative(root, f);
const report = { entry: { files: [...main.files].map(rel).sort(), bytes: [...main.files].reduce((a, f) => a + parse(f).size, 0), packages: [...main.pkgs].sort(), dynamicPackagesFromEntry: [...main.dynamicPkgs].sort() }, chunks: {} };

// Radici dinamiche (ricorsivo): ogni import() è un possibile chunk a sé
const seen = new Set();
const queue = [...main.dynamicTargets];
while (queue.length) {
  const t = queue.pop();
  if (seen.has(t)) continue;
  seen.add(t);
  const c = closure(t);
  // si mostrano solo i pacchetti e i file che NON sono già nell'entry
  report.chunks[rel(t)] = {
    ownFiles: [...c.files].filter((f) => !main.files.has(f)).map(rel).sort(),
    packagesNotInEntry: [...c.pkgs].filter((p) => !main.pkgs.has(p)).sort(),
    dynamicPackages: [...c.dynamicPkgs].sort(),
  };
  c.dynamicTargets.forEach((d) => queue.push(d));
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`ENTRY (index.tsx) — moduli del progetto raggiunti con import statici: ${report.entry.files.length} (${(report.entry.bytes / 1024).toFixed(1)} kB di sorgente)`);
  console.log(`  pacchetti npm nel download iniziale: ${report.entry.packages.join(', ')}`);
  if (report.entry.dynamicPackagesFromEntry.length) console.log(`  pacchetti importati dinamicamente dall'entry: ${report.entry.dynamicPackagesFromEntry.join(', ')}`);
  console.log('\nCHUNK DINAMICI (solo ciò che NON è già nell\'entry):');
  for (const [k, v] of Object.entries(report.chunks).sort()) {
    console.log(`  ${k}\n     file propri: ${v.ownFiles.length}  |  pacchetti: ${v.packagesNotInEntry.join(', ') || '—'}${v.dynamicPackages.length ? `  |  import() di pacchetti: ${v.dynamicPackages.join(', ')}` : ''}`);
  }
}
