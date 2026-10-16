import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EllipsisVertical } from 'lucide-react';

export interface CardMenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
  /** "danger" = voce rossa, separata dalle altre da una linea. */
  tone?: 'danger';
}

interface CardMenuProps {
  /** Ref del pulsante: le carte lo usano anche come àncora del popover "Personalizza". */
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  /** Etichetta per gli screen reader (es. «Azioni per "Biologia"»). */
  label: string;
  items: CardMenuItem[];
  /** Tiene visibile il pulsante anche su dispositivi con mouse (es. mentre è aperto il popover). */
  forceVisible?: boolean;
  /** Operazione lunga in corso (es. creazione dello ZIP): il pulsante pulsa. */
  busy?: boolean;
  /** Chiamata quando il menu si apre (le carte ne approfittano per chiudere altri popover). */
  onOpen?: () => void;
}

/**
 * Pulsante "⋯" con menu a comparsa per le azioni di una carta (personalizza, scarica, elimina).
 * Sostituisce la fila di 2-3 pulsanti circolari, che nelle carte piccole si sovrapponevano al contenuto.
 * Il menu è in un portale su <body>: non viene tagliato dalla carta né influenzato dal suo contenimento (@container).
 * Posizionare il pulsante dal contenitore genitore (absolute / flex): qui non ha classi di posizione.
 */
const CardMenu: React.FC<CardMenuProps> = ({ buttonRef, label, items, forceVisible = false, busy = false, onOpen }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback(
    (returnFocus = false) => {
      setOpen(false);
      setPos(null);
      if (returnFocus) buttonRef.current?.focus({ preventScroll: true });
    },
    [buttonRef]
  );

  // Posizione: sotto il pulsante, allineato a destra; se non c'è spazio si ribalta sopra; sempre dentro lo schermo
  useLayoutEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    const menu = menuRef.current;
    if (!button || !menu) return;
    const rect = button.getBoundingClientRect();
    const margin = 8;
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    let top = rect.bottom + 4;
    if (top + height + margin > window.innerHeight && rect.top - 4 - height >= margin) top = rect.top - 4 - height;
    top = Math.max(margin, Math.min(top, window.innerHeight - height - margin));
    const left = Math.max(margin, Math.min(rect.right - width, window.innerWidth - width - margin));
    setPos({ top, left });
  }, [open, buttonRef]);

  // Il focus passa alla prima voce appena il menu è posizionato
  const isPositioned = pos !== null;
  useEffect(() => {
    if (open && isPositioned) menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
  }, [open, isPositioned]);

  // Chiusura: tocco fuori, Esc, scroll o ridimensionamento (il menu è "fixed": resterebbe staccato dalla carta)
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close(true);
      }
    };
    const onViewportChange = () => close();
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [open, close, buttonRef]);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (open) {
      close();
    } else {
      onOpen?.();
      setOpen(true);
    }
  };

  const select = (item: CardMenuItem) => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    close();
    // Il focus torna al pulsante PRIMA dell'azione: se questa apre un dialogo, alla chiusura il focus rientra qui
    buttonRef.current?.focus({ preventScroll: true });
    item.onSelect();
  };

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const entries = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (entries.length === 0) return;
    const index = entries.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;
    if (e.key === 'ArrowDown') next = (index + 1) % entries.length;
    else if (e.key === 'ArrowUp') next = (index - 1 + entries.length) % entries.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = entries.length - 1;
    else if (e.key === 'Tab') close();
    if (next !== null) {
      e.preventDefault();
      entries[next].focus({ preventScroll: true });
    }
  };

  // Con il mouse il pulsante compare al passaggio sulla carta; su touch (o con menu aperto) è sempre visibile
  const visibility =
    open || forceVisible
      ? 'opacity-100'
      : 'opacity-100 [@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-focus-within:opacity-100';

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-busy={busy || undefined}
        className={`relative inline-flex size-9 shrink-0 items-center justify-center rounded-full text-gray-700 transition-[opacity,background-color] before:absolute before:-inset-1 hover:bg-fg/10 active:bg-fg/15 ${open ? 'bg-fg/10' : ''} ${busy ? 'animate-pulse' : ''} ${visibility}`}
      >
        <EllipsisVertical size={18} aria-hidden="true" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={label}
            onKeyDown={onMenuKeyDown}
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'fixed', top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden' }}
            className="z-[100] min-w-48 md:min-w-56 max-w-[calc(100vw-1rem)] animate-dialog-fade rounded-xl border border-gray-200 bg-surface p-1.5 shadow-xl"
          >
            {items.map((item, index) => (
              <React.Fragment key={item.id}>
                {item.tone === 'danger' && index > 0 && <div role="separator" className="my-1 h-px bg-gray-200" />}
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  onClick={select(item)}
                  className={`flex min-h-11 pointer-fine:min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition-colors focus-visible:outline-offset-[-2px] ${
                    item.tone === 'danger'
                      ? 'text-danger hover:bg-danger/10 focus-visible:bg-danger/10'
                      : 'text-gray-800 hover:bg-gray-100 focus-visible:bg-gray-100'
                  }`}
                >
                  <span aria-hidden="true" className="shrink-0">
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              </React.Fragment>
            ))}
          </div>,
          document.body
        )}
    </>
  );
};

export default CardMenu;
