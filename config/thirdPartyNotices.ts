/**
 * Avvisi di software di terze parti: dalla lista dei moduli finiti davvero nel bundle (quelli in node_modules) si ricavano i pacchetti
 * e, per ciascuno, nome, versione, licenza, indirizzo e testo della licenza (il file LICENSE del pacchetto). Le licenze MIT, ISC e
 * Apache-2.0 chiedono di conservare l'avviso di copyright e il testo della licenza quando il codice viene distribuito: la build ne
 * ricava `THIRD-PARTY-NOTICES.txt`, raggiungibile da Impostazioni → Informazioni (e disponibile offline).
 * Funzioni pure: la lettura dei file arriva da fuori (usate da vite.config.ts, provate in tests/logic.test.ts).
 */

export interface NoticeSource {
  /** Contenuto di un file di testo, o null se non esiste o non è leggibile. */
  readText(file: string): string | null;
  /** Nomi dei file di una cartella (facoltativo): serve a trovare licenze con nomi insoliti, come LICENSE.markdown. */
  listDir?(dir: string): string[];
}

const LICENSE_FILES = [
  'LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'LICENCE.md', 'LICENCE.txt',
  'license', 'license.md', 'license.txt', 'LICENSE-MIT', 'LICENSE-MIT.txt', 'LICENSE.MIT', 'COPYING', 'COPYING.txt',
];

/** Radice del pacchetto npm a cui appartiene un modulo (…/node_modules/@scope/nome/…), o null se non è in node_modules. */
export function packageRootFromModuleId(id: string): { name: string; root: string } | null {
  const normalized = id.replace(/\\/g, '/').split('?')[0];
  const marker = '/node_modules/';
  const at = normalized.lastIndexOf(marker); // l'ultimo: con pnpm i pacchetti stanno dentro .pnpm/…/node_modules/
  if (at < 0) return null;
  const parts = normalized.slice(at + marker.length).split('/');
  if (!parts[0]) return null;
  if (parts[0].startsWith('@') && !parts[1]) return null;
  const name = parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
  return { name, root: normalized.slice(0, at + marker.length) + name };
}

interface PackageJson {
  name?: string;
  version?: string;
  license?: string | { type?: string };
  licenses?: Array<{ type?: string }>;
  homepage?: string;
  repository?: string | { url?: string };
}

const licenseOf = (pkg: PackageJson): string => {
  if (typeof pkg.license === 'string') return pkg.license;
  if (pkg.license && typeof pkg.license.type === 'string') return pkg.license.type;
  if (Array.isArray(pkg.licenses)) return pkg.licenses.map((l) => l.type).filter(Boolean).join(' OR ');
  return 'non dichiarata / not declared';
};

const addressOf = (pkg: PackageJson): string => {
  const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
  const raw = pkg.homepage || repo || '';
  return raw.replace(/^git\+/, '').replace(/^git:\/\//, 'https://').replace(/\.git$/, '');
};

export interface NoticesResult {
  text: string;
  /** `nome@versione` di ogni pacchetto incluso, in ordine alfabetico. */
  packages: string[];
  /** Pacchetti per cui non è stato trovato un file di licenza (nel testo c'è un rimando alla licenza dichiarata). */
  withoutLicenseFile: string[];
}

const RULE = '='.repeat(80);
const THIN = '-'.repeat(80);

export function collectNotices(moduleIds: Iterable<string>, source: NoticeSource): NoticesResult {
  const roots = new Map<string, string>(); // radice → nome
  for (const id of moduleIds) {
    const found = packageRootFromModuleId(id);
    if (found) roots.set(found.root, found.name);
  }

  const entries = new Map<string, { label: string; block: string; hasLicenseFile: boolean }>(); // nome@versione → voce
  // Stesso pacchetto in più cartelle: per primo il percorso più corto (quello al primo livello), così la scelta è sempre la stessa
  for (const [root, fallbackName] of [...roots].sort((a, b) => a[1].localeCompare(b[1]) || a[0].length - b[0].length || a[0].localeCompare(b[0]))) {
    let pkg: PackageJson = {};
    try {
      pkg = JSON.parse(source.readText(`${root}/package.json`) ?? '{}') as PackageJson;
    } catch {
      pkg = {};
    }
    const name = pkg.name || fallbackName;
    const label = `${name}@${pkg.version ?? '?'}`;
    if (entries.has(label)) continue; // la stessa versione può comparire in più cartelle: una voce sola

    let licenseText: string | null = null;
    const listed = (source.listDir?.(root) ?? []).filter((f) => /^(licen[cs]e|copying)([._-].*)?$/i.test(f)).sort();
    for (const file of [...new Set([...LICENSE_FILES, ...listed])]) {
      const text = source.readText(`${root}/${file}`);
      if (text && text.trim()) {
        licenseText = text.replace(/\r\n?/g, '\n').trim();
        break;
      }
    }
    const license = licenseOf(pkg);
    const address = addressOf(pkg);
    const lines = [RULE, label, `Licenza / License: ${license}`];
    if (address) lines.push(`Fonte / Source: ${address}`);
    // Doppia licenza con MIT (es. jszip: MIT OR GPL-3.0-or-later): il Gestore usa i termini MIT
    if (/\bOR\b/i.test(license) && /\bMIT\b/.test(license)) lines.push('Usato secondo i termini della licenza MIT / Used under the terms of the MIT License.');
    lines.push(THIN, licenseText ?? `(Il pacchetto non include un file di licenza: vale il testo standard della licenza dichiarata, ${license}. / The package ships no license file: the standard text of the declared license, ${license}, applies.)`);
    entries.set(label, { label, block: lines.join('\n'), hasLicenseFile: licenseText !== null });
  }

  const ordered = [...entries.values()].sort((a, b) => a.label.localeCompare(b.label));
  const header = [
    'AVVISI DI SOFTWARE DI TERZE PARTI / THIRD-PARTY SOFTWARE NOTICES',
    '',
    "Questa app include i seguenti pacchetti open source, distribuiti con le rispettive licenze, che si riportano qui insieme agli avvisi di copyright.",
    'This app includes the following open source packages, distributed under their respective licenses, reproduced here together with their copyright notices.',
    '',
    `Pacchetti / Packages: ${ordered.length}`,
    '',
  ].join('\n');
  return {
    text: `${header}\n${ordered.map((e) => e.block).join('\n\n')}\n`,
    packages: ordered.map((e) => e.label),
    withoutLicenseFile: ordered.filter((e) => !e.hasLicenseFile).map((e) => e.label),
  };
}
