import type { Folder, Note } from '../types';
import { t } from '../i18n/core';
import { ALL_EMOJIS, ALL_PASTEL_COLORS } from '../utils/helpers';
import { sanitizeMap, sanitizeQuiz } from './validators';

/**
 * Parte PURA del livello dati degli appunti: validazione/normalizzazione dei record, lettura del vecchio formato localStorage e
 * riparazione dell'albero cartelle. Nessun accesso al browser (IndexedDB, localStorage): è interamente testabile (tests/logic.test.ts).
 * Le usa services/notesDb.ts (che si occupa di IndexedDB).
 */

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const nonEmptyString = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const text = (v: unknown, fallback: string): string =>
  typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : fallback;
const isoDate = (v: unknown): string => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? v : new Date(0).toISOString());
const finiteNumber = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** Valida un appunto letto dal DB (o dal vecchio localStorage). Senza `id` il record è inutilizzabile: null. */
export function normalizeNote(raw: unknown): Note | null {
  if (!isRecord(raw)) return null;
  const id = nonEmptyString(raw.id);
  if (!id) return null;
  const note: Note = {
    id,
    title: text(raw.title, t('notes.untitled')),
    content: text(raw.content, ''),
    emoji: nonEmptyString(raw.emoji) ?? ALL_EMOJIS[0],
    color: nonEmptyString(raw.color) ?? ALL_PASTEL_COLORS[0],
    folderId: nonEmptyString(raw.folderId),
    createdAt: isoDate(raw.createdAt),
  };
  if (raw.contentType === 'html' || raw.contentType === 'markdown') note.contentType = raw.contentType;
  const order = finiteNumber(raw.order);
  if (order !== undefined) note.order = order;
  // Quiz e mappa passano dai validatori (come quando vengono generati): dati malformati non possono rompere le viste
  if (raw.quizData != null) note.quizData = sanitizeQuiz(raw.quizData);
  if (raw.mapData != null) note.mapData = sanitizeMap(raw.mapData);
  return note;
}

/** Valida una cartella. `parentId` assente (dati molto vecchi) diventa null: prima la cartella risultava invisibile. */
export function normalizeFolder(raw: unknown): Folder | null {
  if (!isRecord(raw)) return null;
  const id = nonEmptyString(raw.id);
  if (!id) return null;
  const folder: Folder = {
    id,
    name: text(raw.name, t('create.folder')),
    emoji: nonEmptyString(raw.emoji) ?? ALL_EMOJIS[0],
    color: nonEmptyString(raw.color) ?? ALL_PASTEL_COLORS[0],
    createdAt: isoDate(raw.createdAt),
    parentId: nonEmptyString(raw.parentId),
  };
  const order = finiteNumber(raw.order);
  if (order !== undefined) folder.order = order;
  return folder; // il vecchio campo `tabColor` e qualunque campo sconosciuto non vengono riportati
}

export interface NormalizedData {
  notes: Note[];
  folders: Folder[];
  /** Record scartati perché inutilizzabili (non oggetti o senza id). */
  skipped: number;
}

/** Normalizza due liste di record grezzi isolando gli errori: un record cattivo non fa perdere gli altri. */
export function normalizeAll(rawNotes: readonly unknown[], rawFolders: readonly unknown[]): NormalizedData {
  const notes: Note[] = [];
  const folders: Folder[] = [];
  let skipped = 0;
  for (const raw of rawNotes) {
    const note = normalizeNote(raw);
    if (note) notes.push(note);
    else skipped++;
  }
  for (const raw of rawFolders) {
    const folder = normalizeFolder(raw);
    if (folder) folders.push(folder);
    else skipped++;
  }
  return { notes, folders, skipped };
}

/** Formato del vecchio localStorage ("studia_data"): { notes: [...], folders: [...] }. null se non è leggibile. */
export function parseLegacyData(json: string): NormalizedData | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.notes) || !Array.isArray(parsed.folders)) return null;
  return normalizeAll(parsed.notes, parsed.folders);
}

export interface TreeRepair {
  notes: Note[];
  folders: Folder[];
  changedNotes: Note[];
  changedFolders: Folder[];
}

/**
 * Ripara la struttura ad albero senza cancellare nulla:
 *  - cartella con genitore inesistente (o genitore di se stessa) → torna alla radice;
 *  - cicli (A dentro B e B dentro A, possibili con modifiche concorrenti da due schede) → il ciclo viene spezzato;
 *  - appunto in una cartella inesistente → torna alla radice.
 * Così un elemento non diventa mai "invisibile" (né nella radice né in una cartella raggiungibile).
 */
export function repairTree(notes: readonly Note[], folders: readonly Folder[]): TreeRepair {
  const fixed = new Map<string, Folder>(folders.map((f) => [f.id, f]));
  const changedFolderIds = new Set<string>();
  const detach = (id: string) => {
    const f = fixed.get(id);
    if (!f) return;
    fixed.set(id, { ...f, parentId: null });
    changedFolderIds.add(id);
  };

  for (const f of folders) {
    if (f.parentId !== null && (f.parentId === f.id || !fixed.has(f.parentId))) detach(f.id);
  }
  for (const id of [...fixed.keys()]) {
    const seen = new Set<string>([id]);
    let cursor = fixed.get(id)?.parentId ?? null;
    while (cursor !== null) {
      if (seen.has(cursor)) {
        detach(cursor); // si spezza il ciclo nel punto in cui si richiude: chi vi sta appeso resta dov'è
        break;
      }
      seen.add(cursor);
      cursor = fixed.get(cursor)?.parentId ?? null;
    }
  }

  const changedNotes: Note[] = [];
  const repairedNotes = notes.map((n) => {
    if (n.folderId !== null && !fixed.has(n.folderId)) {
      const repaired = { ...n, folderId: null };
      changedNotes.push(repaired);
      return repaired;
    }
    return n;
  });
  const repairedFolders = folders.map((f) => fixed.get(f.id) ?? f);
  return {
    notes: repairedNotes,
    folders: repairedFolders,
    changedNotes,
    changedFolders: repairedFolders.filter((f) => changedFolderIds.has(f.id)),
  };
}
