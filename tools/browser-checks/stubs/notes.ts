// Sostituto di hooks/useNotesStore: registra cosa il provider scrive nelle note.
const log = ((window as any).__notes ??= { updates: [] as unknown[], added: [] as unknown[] });
export const useNotesStore = () => ({
  addNote: (n: unknown) => { log.added.push(n); return { id: 'new-note' }; },
  updateNote: async (id: string, patch: unknown) => { log.updates.push({ id, patch }); },
});
