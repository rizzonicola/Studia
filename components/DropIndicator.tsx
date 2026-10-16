import React from 'react';

interface DropIndicatorProps {
  /** Su quale lato della card compare la linea: 'before' = prima di essa, 'after' = dopo di essa. */
  position: 'before' | 'after';
  /** 'vertical' = linea verticale tra due card affiancate (griglia); 'horizontal' = linea orizzontale tra due righe (elenco). */
  orientation: 'vertical' | 'horizontal';
}

/**
 * Linea di inserimento mostrata mentre si trascina un elemento (sostituisce le quattro copie in NoteCard e FolderCard).
 *
 * Stesso principio dell'indicatore di Atlassian (Trello, Jira): linea sottile, centrata nello spazio TRA i due elementi
 * invece che incollata a quello su cui si trova il puntatore. Il centro dello spazio si ricava da --item-gap, la variabile
 * che ItemsGrid imposta sul contenitore insieme al gap: la linea resta centrata con qualsiasi dimensione della griglia
 * (compatta, normale, grande) e in modalità elenco. È posizionata rispetto alla card ("relative"): non sposta nulla nel layout.
 */
const DropIndicator: React.FC<DropIndicatorProps> = ({ position, orientation }) => {
  const offset =
    position === 'before' ? 'calc(var(--item-gap, 1rem) / -2)' : 'calc(100% + var(--item-gap, 1rem) / 2)';

  return orientation === 'vertical' ? (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 z-30 w-[3px] -translate-x-1/2 rounded-full bg-accent-ink animate-drop-in"
      style={{ left: offset }}
    />
  ) : (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 z-30 h-[3px] -translate-y-1/2 rounded-full bg-accent-ink animate-drop-in"
      style={{ top: offset }}
    />
  );
};

export default DropIndicator;
