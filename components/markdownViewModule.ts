import { createModuleRegistry } from '../utils/moduleRegistry';

/**
 * MarkdownView (con react-markdown e KaTeX) resta un chunk separato, caricato con import() dinamico. Il registro tiene il modulo
 * già risolto: NoteDetailPage lo legge in modo sincrono e la rotta della pagina (App.tsx) lo attende insieme alla pagina stessa, così il
 * primo appunto della sessione non mostra un fallback annidato (che React terrebbe a schermo per almeno ~300 ms).
 */
export const markdownViewModule = createModuleRegistry<'view', typeof import('./MarkdownView')>({
  view: () => import('./MarkdownView'),
});

/** Scarica (una volta sola) MarkdownView. Idempotente; chi la usa solo come precarico deve ignorare l'eventuale errore. */
export const preloadMarkdownView = (): Promise<unknown> => markdownViewModule.load('view');
