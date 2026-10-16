import type { Note, Folder } from '../types';
import { t } from '../i18n/core';
import { downloadBlob, sanitizeFilename } from './download';
import { alertDialog } from './dialogs';

export { sanitizeFilename };

export interface ExportPlan {
  /** File da inserire nello ZIP (percorsi con "/", relativi alla cartella radice). */
  files: { path: string; content: string }[];
  /** Cartelle (anche vuote) da creare. */
  dirs: string[];
}

/**
 * Nome univoco dentro una cartella dello ZIP: aggiunge " (1)", " (2)"... prima dell'estensione.
 * Il confronto ignora maiuscole/minuscole: "Note.md" e "note.md" non possono convivere su Windows e macOS.
 */
export function uniqueName(base: string, extension: string, used: Set<string>): string {
  let candidate = `${base}${extension}`;
  for (let counter = 1; used.has(candidate.toLowerCase()); counter++) candidate = `${base} (${counter})${extension}`;
  used.add(candidate.toLowerCase());
  return candidate;
}

/**
 * Decide cosa finisce nello ZIP di una cartella (funzione pura: nessun JSZip, testabile).
 * Protegge dai cicli (cartella A dentro B e B dentro A, possibili con dati corrotti o modifiche concorrenti da più schede).
 */
export function planFolderExport(rootId: string, notes: readonly Note[], folders: readonly Folder[]): ExportPlan {
  const plan: ExportPlan = { files: [], dirs: [] };
  const visited = new Set<string>();

  const walk = (folderId: string, prefix: string) => {
    if (visited.has(folderId)) return;
    visited.add(folderId);
    const used = new Set<string>();

    for (const note of notes) {
      if (note.folderId !== folderId) continue;
      const name = uniqueName(sanitizeFilename(note.title, 'note'), note.contentType === 'html' ? '.html' : '.md', used);
      plan.files.push({ path: prefix + name, content: note.content });
    }
    for (const sub of folders) {
      if (sub.parentId !== folderId || visited.has(sub.id)) continue;
      const dirPath = `${prefix}${uniqueName(sanitizeFilename(sub.name, 'folder'), '', used)}/`;
      plan.dirs.push(dirPath);
      walk(sub.id, dirPath);
    }
  };

  walk(rootId, '');
  return plan;
}

/**
 * Crea e scarica lo ZIP di una cartella. JSZip (~100 kB) viene scaricato solo qui, alla prima esportazione:
 * prima era importato in modo statico e finiva nel bundle iniziale (FolderCard importa questo modulo).
 */
export const downloadFolderAsZip = async (folderId: string, notes: Note[], folders: Folder[]): Promise<void> => {
  const rootFolder = folders.find((f) => f.id === folderId);
  if (!rootFolder) return;

  try {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    const plan = planFolderExport(folderId, notes, folders);
    plan.dirs.forEach((dir) => zip.folder(dir));
    plan.files.forEach((file) => zip.file(file.path, file.content));
    // DEFLATE: gli appunti sono testo e si riducono parecchio (JSZip, per impostazione predefinita, non comprime)
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    downloadBlob(blob, `${sanitizeFilename(rootFolder.name, 'folder')}.zip`);
  } catch (error) {
    console.error('Failed to generate zip', error);
    void alertDialog({ message: t('export.zipError'), tone: 'error' });
  }
};
