/**
 * Stili condivisi da NoteCard e FolderCard (modalità griglia).
 *
 * Le carte sono "@container": le misure interne seguono la LARGHEZZA DELLA CARTA (unità cqw), non quella dello schermo.
 * Così lo stesso markup funziona con 1, 2, 3 o 9 colonne (Impostazioni → Forma e layout) senza sovrapposizioni:
 * margini, emoji, titolo e data si ridimensionano insieme, entro limiti leggibili (clamp).
 * Le classi sono scritte per intero perché Tailwind le trovi nel sorgente.
 */

/** Margine interno della carta. */
export const CARD_PAD = 'p-[clamp(0.5rem,7cqw,1rem)]';

/** Emoji dentro un tondino leggermente più scuro dello sfondo (segue il tema grazie a bg-fg/10). */
export const CARD_EMOJI =
  'grid shrink-0 place-items-center rounded-xl bg-fg/10 leading-none size-[clamp(1.75rem,22cqw,3rem)] text-[length:clamp(1rem,14cqw,1.75rem)]';

/** Titolo: max 2 righe (1 sola nelle carte molto strette, dove la seconda non troverebbe posto). */
export const CARD_TITLE =
  'font-semibold text-gray-800 leading-snug break-words line-clamp-2 @max-[6.75rem]:line-clamp-1 text-[length:clamp(0.8125rem,8.5cqw,1.0625rem)]';

/** Data di creazione. */
export const CARD_DATE = 'mt-1 truncate text-gray-600 text-[length:clamp(0.6875rem,6.5cqw,0.75rem)]';

/** Posizione del pulsante "⋯" nell'angolo in alto a destra (si avvicina al bordo nelle carte piccole). */
export const CARD_MENU_POS = 'absolute z-10 top-[clamp(0.125rem,3cqw,0.5rem)] right-[clamp(0.125rem,3cqw,0.5rem)]';
