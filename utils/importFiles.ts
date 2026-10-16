/**
 * Importazione di file e cartelle come appunti: logica pura (testabile senza browser). La lettura vera dei file è iniettata (`read`).
 *
 * Rispetto a prima:
 *  - nelle cartelle si importano solo i formati supportati (prima ogni file, anche immagini o PDF, diventava un "appunto" di caratteri
 *    illeggibili) e si ignorano i file nascosti/di sistema (.DS_Store, .git, __MACOSX...);
 *  - un file illeggibile o troppo grande NON interrompe gli altri e viene riportato in un solo messaggio finale (prima: un avviso per
 *    ogni file, e gli errori di lettura erano silenziosi);
 *  - l'ordine di creazione è deterministico (ordine di selezione, o ordine "naturale" dei nomi per le cartelle): prima dipendeva da
 *    quale lettura asincrona finiva per prima.
 */

export type ImportKind = 'markdown' | 'html';

const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown', 'txt', 'json']);
const HTML_EXTENSIONS = new Set(['html', 'htm']);

/** Estensione in minuscolo, "" se manca (un punto iniziale, come in ".gitignore", non è un'estensione). */
export const extensionOf = (fileName: string): string => {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(dot + 1).toLowerCase() : '';
};

export function classifyImportFile(fileName: string): ImportKind | null {
  const ext = extensionOf(fileName);
  if (HTML_EXTENSIONS.has(ext)) return 'html';
  if (MARKDOWN_EXTENSIONS.has(ext)) return 'markdown';
  return null;
}

/** Titolo dell'appunto: nome del file senza l'estensione dei formati importabili (le altre estensioni restano). */
export const titleFromFileName = (fileName: string): string =>
  classifyImportFile(fileName) ? fileName.slice(0, fileName.lastIndexOf('.')) : fileName;

/** Cartelle di sistema o di dipendenze che non contengono appunti (confronto senza distinguere maiuscole/minuscole). */
const IGNORED_DIRECTORIES = new Set(['__macosx', 'node_modules', '__pycache__']);

/**
 * File o cartelle nascosti / di sistema: ".DS_Store", ".git/...", "__MACOSX/...", "node_modules/...", "Thumbs.db", "desktop.ini".
 * node_modules è escluso perché scegliendo la cartella di un progetto contiene migliaia di README.md, LICENSE.txt e package.json:
 * senza questo filtro diventavano tutti appunti (lettura lenta, database gonfio, interfaccia piena di rumore).
 * Il backslash (separatore Windows) viene trattato come "/" per non dipendere dal modo in cui il percorso è stato prodotto.
 */
export function isIgnoredPath(relativePath: string): boolean {
  const parts = relativePath.split(/[\\/]/).filter(Boolean);
  if (parts.some((p) => p.startsWith('.') || IGNORED_DIRECTORIES.has(p.toLowerCase()))) return true;
  const leaf = (parts[parts.length - 1] ?? '').toLowerCase();
  return leaf === 'thumbs.db' || leaf === 'desktop.ini';
}

// Un solo collator per tutto il modulo: `a.localeCompare(b, undefined, {…})` con opzioni ne costruisce uno a ogni confronto, e
// l'ordinamento ne fa O(N log N). Stessa semantica (lingua predefinita del browser, numeri "naturali", maiuscole/accenti ignorati).
const naturalCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const naturalCompare = (a: string, b: string): number => naturalCollator.compare(a, b);

export interface ImportCandidate {
  name: string;
  size: number;
  /** Percorso relativo scelto con un selettore di cartelle (webkitRelativePath): "Radice/sotto/file.md". Vuoto per file singoli. */
  webkitRelativePath?: string;
}

export interface ImportedNote<F extends ImportCandidate> {
  file: F;
  title: string;
  content: string;
  contentType: ImportKind;
  /** Cartelle del percorso (senza il nome del file), dalla più esterna alla più interna. Vuoto = nessuna cartella. */
  dirParts: string[];
}

export interface ImportResult<F extends ImportCandidate> {
  notes: ImportedNote<F>[];
  /** Nomi dei file NON importati (formato non supportato se richiesto, troppo grandi, illeggibili). */
  problems: string[];
}

export interface ReadOptions<F extends ImportCandidate> {
  /** Tipi accettati da questo selettore. */
  accept: readonly ImportKind[];
  /** true = un file di formato non accettato è un problema da riportare (selettore di file); false = si salta in silenzio (cartelle). */
  reportUnsupported: boolean;
  maxBytes: number;
  read: (file: F) => Promise<string>;
  /** true = ordina per percorso con ordinamento "naturale" (cartelle); false = mantiene l'ordine dato (selezione dell'utente). */
  sortByPath?: boolean;
  /** Quante letture tenere in corso insieme (predefinito {@link DEFAULT_READ_CONCURRENCY}; 1 = una alla volta come prima). */
  concurrency?: number;
  /**
   * Avanzamento: chiamata una volta all'inizio con (0, totale) e poi a ogni lettura finita (riuscita o no) con (fatti, totale).
   * `totale` conta solo i file che verranno davvero letti (non quelli ignorati, non supportati o troppo grandi). Un'eccezione qui dentro è ignorata.
   */
  onProgress?: (done: number, total: number) => void;
}

/** Letture in volo contemporaneamente: la memoria resta limitata a questo numero di file, ma la latenza di accesso (dischi lenti, cartelle di rete o sincronizzate) non si somma più file per file. */
export const DEFAULT_READ_CONCURRENCY = 8;

/** Un file da leggere nella fase di lettura. `content === null` = lettura fallita (o non ancora fatta). */
interface PlannedRead<F extends ImportCandidate> {
  file: F;
  kind: ImportKind;
  path: string;
  content: string | null;
}

/**
 * Separa gli importabili dai problemi, leggendo i file con al massimo `concurrency` letture in volo.
 * In tre fasi, così l'esito non dipende da quale lettura finisce per prima:
 * 1. pianificazione sincrona, nell'ordine dei file: ogni file scartato (ignorato, non supportato, troppo grande) è già un problema o un salto;
 * 2. lettura con un pool: ogni lettura scrive il suo contenuto nel proprio posto;
 * 3. assemblaggio nell'ordine della pianificazione: note e problemi escono esattamente come con la lettura seriale.
 */
export async function readImportFiles<F extends ImportCandidate>(files: readonly F[], options: ReadOptions<F>): Promise<ImportResult<F>> {
  const pathOf = (f: F) => f.webkitRelativePath || f.name;
  const ordered = options.sortByPath ? [...files].sort((a, b) => naturalCompare(pathOf(a), pathOf(b))) : [...files];

  // 1. Pianificazione: una stringa è un file già scartato (il suo nome è un problema), un oggetto è un file da leggere.
  const plan: Array<string | PlannedRead<F>> = [];
  for (const file of ordered) {
    const path = pathOf(file);
    if (isIgnoredPath(path)) continue;
    const kind = classifyImportFile(file.name);
    if (!kind || !options.accept.includes(kind)) {
      if (options.reportUnsupported) plan.push(file.name);
      continue;
    }
    if (file.size > options.maxBytes) {
      plan.push(file.name);
      continue;
    }
    plan.push({ file, kind, path, content: null });
  }

  // 2. Lettura: ogni worker prende il prossimo file non ancora preso. Un errore (anche sincrono) lascia content a null.
  const toRead = plan.filter((entry): entry is PlannedRead<F> => typeof entry !== 'string');
  let next = 0;
  let done = 0;
  const notify = () => {
    try {
      options.onProgress?.(done, toRead.length);
    } catch {
      /* un indicatore che si rompe non deve far fallire l'import */
    }
  };
  if (toRead.length > 0) notify();
  const worker = async () => {
    while (next < toRead.length) {
      const item = toRead[next++];
      try {
        item.content = await options.read(item.file);
      } catch {
        item.content = null;
      }
      done++;
      notify();
    }
  };
  const concurrency = Math.max(1, Math.min(Math.floor(options.concurrency ?? DEFAULT_READ_CONCURRENCY) || 1, toRead.length));
  await Promise.all(Array.from({ length: concurrency }, worker));

  // 3. Assemblaggio nell'ordine della pianificazione.
  const result: ImportResult<F> = { notes: [], problems: [] };
  for (const entry of plan) {
    if (typeof entry === 'string') {
      result.problems.push(entry);
    } else if (entry.content === null) {
      result.problems.push(entry.file.name);
    } else {
      const dirParts = entry.path.split(/[\\/]/).filter(Boolean).slice(0, -1);
      result.notes.push({ file: entry.file, title: titleFromFileName(entry.file.name), content: entry.content, contentType: entry.kind, dirParts });
    }
  }
  return result;
}

/** Elenco breve di nomi per un messaggio: i primi `max` e il numero degli altri. */
export function summarizeNames(names: readonly string[], max = 3): { shown: string; others: number } {
  return { shown: names.slice(0, max).join(', '), others: Math.max(0, names.length - max) };
}

/**
 * Legge un file come testo con FileReader, come faceva il codice precedente (stessa decodifica). Provato in Chromium 141 su UTF-8,
 * UTF-8 con BOM e UTF-16 LE con BOM (Blocco Note di Windows): in tutti e tre i casi il testo è corretto. Non è stato provato su Firefox/Safari.
 */
export const readFileAsText = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.onabort = () => reject(new Error('read aborted'));
    reader.readAsText(file);
  });
