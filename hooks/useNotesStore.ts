import React, { useState, useEffect, useCallback, useMemo, useRef, createContext, useContext, ReactNode } from 'react';
import { AppData, Note, Folder } from '../types';
import { generateUniqueId, getRandomEmoji, getRandomColor } from '../utils/helpers';
import { t } from '../i18n/core';
import { reportStorageProblem } from '../utils/storageStatus';
import { dbJobs, enqueueWrite, loadAll, onRemoteChange, pendingWrites, readAll, whenWritesSettled } from '../services/notesDb';

/**
 * Archivio degli appunti per la UI. Lo stato vive in memoria (aggiornamento immediato, "ottimistico") e ogni modifica viene
 * scritta su IndexedDB dal livello dati (services/notesDb.ts): scritture a patch, errori segnalati all'utente, sincronizzazione
 * fra schede. Qui resta solo la logica di stato.
 */

export interface NewNoteOptions {
  title?: string;
  content?: string;
  folderId?: string | null;
  contentType?: 'markdown' | 'html';
}

const mergeById = <T extends { id: string }>(loaded: T[], current: T[]): T[] => {
  const ids = new Set(loaded.map((i) => i.id));
  return [...loaded, ...current.filter((i) => !ids.has(i.id))];
};

const buildNote = (options: NewNoteOptions, order: number): Note => {
  const { title = t('notes.defaultTitle'), folderId = null, contentType = 'markdown' } = options;
  const noteTitle = title || t('notes.untitled');
  return {
    id: generateUniqueId(),
    title: noteTitle,
    content: options.content ?? `# ${noteTitle}\n\n${t('notes.defaultBody')}`,
    contentType,
    emoji: getRandomEmoji(),
    color: getRandomColor(),
    folderId,
    createdAt: new Date().toISOString(),
    order,
  };
};

const useNotesStoreLogic = () => {
  const [data, setData] = useState<AppData>({ notes: [], folders: [] });
  const [isInitialized, setIsInitialized] = useState(false);

  // Fonte di verità sincrona: gli aggiornamenti non dipendono più da callback di setState con effetti collaterali
  const dataRef = useRef<AppData>(data);
  /** Cresce a ogni modifica locale: una rilettura dal DB (dopo una modifica di un'altra scheda) non deve sovrascrivere modifiche in volo. */
  const localVersion = useRef(0);
  const commit = useCallback((next: AppData) => {
    dataRef.current = next;
    setData(next);
  }, []);
  const change = useCallback(
    (next: AppData) => {
      localVersion.current++;
      commit(next);
    },
    [commit]
  );

  // Carica i dati da IndexedDB al primo avvio (migrazione dal vecchio localStorage inclusa)
  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      try {
        const snapshot = await loadAll();
        if (cancelled) return;
        // Né i record inutilizzabili (senza id) né le riparazioni dell'albero devono passare sotto silenzio: solo conteggi, nessun contenuto
        if (snapshot.skipped > 0 || snapshot.repaired > 0) {
          console.warn(`IndexedDB: ${snapshot.skipped} record ignorati (senza id), ${snapshot.repaired} elementi riportati alla radice`);
        }
        // Unisce con eventuali elementi creati mentre il DB si stava caricando
        commit({
          notes: mergeById(snapshot.notes, dataRef.current.notes),
          folders: mergeById(snapshot.folders, dataRef.current.folders),
        });
      } catch (error) {
        console.error('Failed to load data from IndexedDB', error);
        // L'app funziona comunque (in memoria), ma l'utente deve sapere che le modifiche non verranno conservate
        reportStorageProblem({ area: 'indexeddb', reason: 'unavailable' });
      } finally {
        if (!cancelled) setIsInitialized(true);
      }
    };
    void loadData();
    return () => {
      cancelled = true;
    };
  }, [commit]);

  // Un'altra scheda ha scritto: si rilegge il DB (dopo aver atteso le NOSTRE scritture e solo se nel frattempo non abbiamo modificato altro)
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 150);
    };
    const refresh = async (): Promise<void> => {
      if (cancelled) return;
      await whenWritesSettled();
      const before = localVersion.current;
      try {
        const snapshot = await readAll();
        if (cancelled) return;
        if (localVersion.current !== before || pendingWrites() > 0) return schedule();
        commit({ notes: snapshot.notes, folders: snapshot.folders });
      } catch (error) {
        console.error('IndexedDB: rilettura non riuscita', error);
      }
    };
    const unsubscribe = onRemoteChange(schedule);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsubscribe();
    };
  }, [commit]);

  const addFolder = useCallback(
    (name: string, parentId: string | null = null): Folder => {
      const newFolder: Folder = {
        id: generateUniqueId(),
        name,
        emoji: getRandomEmoji(),
        color: getRandomColor(),
        createdAt: new Date().toISOString(),
        parentId,
        order: Date.now(), // timestamp: di default in fondo alla lista
      };
      change({ ...dataRef.current, folders: [...dataRef.current.folders, newFolder] });
      enqueueWrite(dbJobs.putFolder(newFolder));
      return newFolder;
    },
    [change]
  );

  /** Crea più appunti con UN solo aggiornamento di stato e UNA transazione (importazioni di cartelle intere). */
  const addNotes = useCallback(
    (list: NewNoteOptions[]): Note[] => {
      if (list.length === 0) return [];
      const base = Date.now();
      const created = list.map((options, index) => buildNote(options, base + index)); // ordine crescente anche nello stesso millisecondo
      change({ ...dataRef.current, notes: [...dataRef.current.notes, ...created] });
      enqueueWrite(dbJobs.putNotes(created));
      return created;
    },
    [change]
  );

  const addNote = useCallback((options: NewNoteOptions = {}): Note => addNotes([options])[0], [addNotes]);

  const updateNote = useCallback(
    async (noteId: string, updates: Partial<Note>) => {
      const current = dataRef.current.notes.find((n) => n.id === noteId);
      if (!current) return;
      const updated: Note = { ...current, ...updates };
      change({ ...dataRef.current, notes: dataRef.current.notes.map((n) => (n.id === noteId ? updated : n)) });
      enqueueWrite(dbJobs.patch([{ id: noteId, patch: updates, full: updated }]));
    },
    [change]
  );

  const updateFolder = useCallback(
    async (folderId: string, updates: Partial<Folder>) => {
      const current = dataRef.current.folders.find((f) => f.id === folderId);
      if (!current) return;
      const updated: Folder = { ...current, ...updates };
      change({ ...dataRef.current, folders: dataRef.current.folders.map((f) => (f.id === folderId ? updated : f)) });
      enqueueWrite(dbJobs.patch([], [{ id: folderId, patch: updates, full: updated }]));
    },
    [change]
  );

  const deleteNote = useCallback(
    async (noteId: string) => {
      change({ ...dataRef.current, notes: dataRef.current.notes.filter((n) => n.id !== noteId) });
      enqueueWrite(dbJobs.deleteNote(noteId));
    },
    [change]
  );

  const deleteFolder = useCallback(
    async (folderId: string) => {
      const { folders, notes } = dataRef.current;

      // Cartella + tutte le sotto-cartelle
      const foldersToDelete = new Set<string>([folderId]);
      let size = 0;
      while (size !== foldersToDelete.size) {
        size = foldersToDelete.size;
        folders.forEach((f) => {
          if (f.parentId && foldersToDelete.has(f.parentId)) foldersToDelete.add(f.id);
        });
      }
      const notesToDelete = new Set<string>();
      notes.forEach((n) => {
        if (n.folderId && foldersToDelete.has(n.folderId)) notesToDelete.add(n.id);
      });

      change({
        folders: folders.filter((f) => !foldersToDelete.has(f.id)),
        notes: notes.filter((n) => !notesToDelete.has(n.id)),
      });
      enqueueWrite(dbJobs.deleteTree([...foldersToDelete], [...notesToDelete]));
    },
    [change]
  );

  const moveNoteToFolder = useCallback(
    async (noteId: string, targetFolderId: string | null) => {
      const current = dataRef.current.notes.find((n) => n.id === noteId);
      if (!current) return;
      const updated: Note = { ...current, folderId: targetFolderId };
      change({ ...dataRef.current, notes: dataRef.current.notes.map((n) => (n.id === noteId ? updated : n)) });
      enqueueWrite(dbJobs.patch([{ id: noteId, patch: { folderId: targetFolderId }, full: updated }]));
    },
    [change]
  );

  const moveFolderToFolder = useCallback(
    async (folderId: string, targetFolderId: string | null) => {
      const { folders } = dataRef.current;
      const current = folders.find((f) => f.id === folderId);
      if (!current) return;

      // Non si può spostare una cartella dentro se stessa o in un suo discendente
      let cursor: string | null = targetFolderId;
      while (cursor !== null) {
        if (cursor === folderId) return;
        cursor = folders.find((f) => f.id === cursor)?.parentId ?? null;
      }

      const updated: Folder = { ...current, parentId: targetFolderId };
      change({ ...dataRef.current, folders: folders.map((f) => (f.id === folderId ? updated : f)) });
      enqueueWrite(dbJobs.patch([], [{ id: folderId, patch: { parentId: targetFolderId }, full: updated }]));
    },
    [change]
  );

  const reorderItems = useCallback(
    async (items: { id: string; type: 'note' | 'folder'; order: number }[]) => {
      const notesMap = new Map(dataRef.current.notes.map((n) => [n.id, n] as [string, Note]));
      const foldersMap = new Map(dataRef.current.folders.map((f) => [f.id, f] as [string, Folder]));
      const changedNotes: Note[] = [];
      const changedFolders: Folder[] = [];

      items.forEach((item) => {
        if (item.type === 'note') {
          const note = notesMap.get(item.id);
          if (note && note.order !== item.order) {
            const updated = { ...note, order: item.order };
            notesMap.set(item.id, updated);
            changedNotes.push(updated);
          }
        } else {
          const folder = foldersMap.get(item.id);
          if (folder && folder.order !== item.order) {
            const updated = { ...folder, order: item.order };
            foldersMap.set(item.id, updated);
            changedFolders.push(updated);
          }
        }
      });
      if (changedNotes.length === 0 && changedFolders.length === 0) return;

      change({ notes: Array.from(notesMap.values()), folders: Array.from(foldersMap.values()) });

      // Scrive solo gli elementi il cui ordine è realmente cambiato, e solo il campo `order`
      enqueueWrite(
        dbJobs.patch(
          changedNotes.map((n) => ({ id: n.id, patch: { order: n.order }, full: n })),
          changedFolders.map((f) => ({ id: f.id, patch: { order: f.order }, full: f }))
        )
      );
    },
    [change]
  );

  const getNoteById = useCallback((noteId: string): Note | undefined => data.notes.find((note) => note.id === noteId), [data.notes]);
  const getFolderById = useCallback((folderId: string): Folder | undefined => data.folders.find((folder) => folder.id === folderId), [data.folders]);

  return useMemo(
    () => ({
      notes: data.notes,
      folders: data.folders,
      addFolder,
      addNote,
      addNotes,
      updateNote,
      updateFolder,
      deleteNote,
      deleteFolder,
      moveNoteToFolder,
      moveFolderToFolder,
      reorderItems,
      getNoteById,
      getFolderById,
      isInitialized,
    }),
    [
      data.notes, data.folders, addFolder, addNote, addNotes, updateNote, updateFolder, deleteNote, deleteFolder,
      moveNoteToFolder, moveFolderToFolder, reorderItems, getNoteById, getFolderById, isInitialized,
    ]
  );
};

type NotesStoreType = ReturnType<typeof useNotesStoreLogic>;

const NotesContext = createContext<NotesStoreType | null>(null);

export const NotesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const store = useNotesStoreLogic();
  return React.createElement(NotesContext.Provider, { value: store }, children);
};

export const useNotesStore = () => {
  const context = useContext(NotesContext);
  if (!context) {
    throw new Error('useNotesStore must be used within a NotesProvider');
  }
  return context;
};
