import { useEffect } from 'react';
import { t } from '../i18n/core';
import { alertDialog } from '../utils/dialogs';
import { onStorageProblem, type StorageProblemReason } from '../utils/storageStatus';

/** Stesso problema ripetuto (es. si continua a salvare con lo spazio pieno): si avvisa al massimo una volta al minuto. */
const REPEAT_AFTER_MS = 60_000;

const MESSAGE_KEY = {
  quota: 'storage.quota',
  unavailable: 'storage.unavailable',
  write: 'storage.write',
} as const satisfies Record<StorageProblemReason, 'storage.quota' | 'storage.unavailable' | 'storage.write'>;

/**
 * Mostra all'utente i problemi di salvataggio nel browser (spazio esaurito, archiviazione non disponibile, scrittura fallita),
 * segnalati da utils/safeStorage.ts e services/notesDb.ts. Non renderizza nulla.
 */
const StorageNotifier = () => {
  useEffect(() => {
    const lastShown = new Map<StorageProblemReason, number>();
    return onStorageProblem((problem) => {
      const now = Date.now();
      if (now - (lastShown.get(problem.reason) ?? 0) < REPEAT_AFTER_MS) return;
      lastShown.set(problem.reason, now);
      void alertDialog({ message: t(MESSAGE_KEY[problem.reason]), tone: 'error' });
    });
  }, []);
  return null;
};

export default StorageNotifier;
