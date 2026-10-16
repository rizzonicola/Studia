import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectOption<V extends string = string> {
  value: V;
  label: string;
  /** Riga secondaria sotto l'etichetta (es. «In uso: Italiano»). */
  description?: string;
}

interface SelectProps<V extends string> {
  value: V;
  options: readonly SelectOption<V>[];
  onChange: (value: V) => void;
  /** Nome del campo: lo leggono gli screen reader insieme al valore corrente («Lingua: Italiano») e dà il nome all'elenco. */
  label: string;
  /** Icona decorativa a sinistra del valore. */
  icon?: React.ReactNode;
  className?: string;
}

interface Placement {
  /** Il menu si apre sopra il pulsante (se sotto non c'è abbastanza spazio). */
  up: boolean;
  /** Il bordo destro del menu coincide con quello del pulsante (altrimenti il sinistro). */
  end: boolean;
  /** Altezza massima in px: oltre, l'elenco scorre. */
  maxHeight: number;
}

/** Distanza minima dal bordo dell'area visibile, in px. */
const MARGIN = 8;
/** Spazio tra pulsante e menu, in px. */
const GAP = 4;
/** Altezza minima concessa al menu anche in spazi stretti (poi scorre), in px. */
const MIN_HEIGHT = 112;
/** Pausa dopo la quale la ricerca a digitazione riparte da zero. */
const TYPEAHEAD_MS = 700;

/** Senza accenti e maiuscole: «è» e «E» si trovano digitando «e». */
const normalize = (text: string): string => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();

interface Bounds {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

/**
 * Area in cui il menu può stare: la parte visibile dello schermo, ristretta da ogni antenato che taglia il contenuto
 * (un dialogo con overflow-hidden, un pannello che scorre...). Il menu è un normale elemento assoluto dentro il suo contenitore:
 * si muove con la pagina e non finisce mai fuori dal dialogo in cui si trova.
 */
function visibleBounds(from: HTMLElement): Bounds {
  const viewport = window.visualViewport;
  const top = viewport ? viewport.offsetTop : 0;
  const left = viewport ? viewport.offsetLeft : 0;
  const bounds: Bounds = {
    top,
    left,
    right: left + (viewport ? viewport.width : document.documentElement.clientWidth),
    bottom: top + (viewport ? viewport.height : document.documentElement.clientHeight),
  };
  for (let el = from.parentElement; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    const style = getComputedStyle(el);
    if (/(auto|scroll|hidden|clip)/.test(style.overflowX + style.overflowY)) {
      const rect = el.getBoundingClientRect();
      bounds.top = Math.max(bounds.top, rect.top);
      bounds.left = Math.max(bounds.left, rect.left);
      bounds.right = Math.min(bounds.right, rect.right);
      bounds.bottom = Math.min(bounds.bottom, rect.bottom);
    }
  }
  return bounds;
}

/** Sopra o sotto? A destra o a sinistra? Quanto può essere alto? Dipende dallo spazio che c'è attorno al pulsante. */
function computePlacement(trigger: HTMLElement, list: HTMLElement): Placement {
  const t = trigger.getBoundingClientRect();
  const b = visibleBounds(trigger);
  const height = list.scrollHeight;
  const width = list.offsetWidth;
  const below = b.bottom - t.bottom - GAP - MARGIN;
  const above = t.top - b.top - GAP - MARGIN;
  const up = height > below && above > below;
  const maxHeight = Math.max(MIN_HEIGHT, Math.floor(up ? above : below));
  const fitsEnd = t.right - width >= b.left + MARGIN;
  const fitsStart = t.left + width <= b.right - MARGIN;
  return { up, end: fitsEnd || !fitsStart, maxHeight };
}

/** Porta in vista una voce nell'elenco che scorre, senza toccare lo scorrimento della pagina. */
function revealOption(list: HTMLElement, option: HTMLElement): void {
  const pad = 6;
  if (option.offsetTop - pad < list.scrollTop) list.scrollTop = Math.max(0, option.offsetTop - pad);
  else if (option.offsetTop + option.offsetHeight + pad > list.scrollTop + list.clientHeight) list.scrollTop = option.offsetTop + option.offsetHeight + pad - list.clientHeight;
}

/**
 * Menu a tendina al posto del <select> nativo: stesso aspetto degli altri menu dell'app (CardMenu, Crea nuovo), ovunque uguale
 * (telefono, tablet, desktop) invece del selettore diverso di ogni sistema.
 *
 *  - Tocco e mouse: righe alte almeno 44 px (40 con puntatore preciso); si chiude toccando fuori.
 *  - Tastiera: Invio/Spazio/frecce sul pulsante lo aprono; ↑ ↓ Home End scorrono le voci, una lettera salta alla voce che inizia così,
 *    Invio o Spazio scelgono, Esc chiude e riporta il fuoco sul pulsante, Tab chiude e prosegue.
 *  - Screen reader: pulsante con aria-haspopup="listbox" ed elenco con ruolo listbox; il fuoco vero si sposta sulle voci.
 *  - Posizione: sotto il pulsante, oppure sopra se sotto manca spazio; allineato a destra o a sinistra a seconda di dove entra; con
 *    poco spazio l'elenco scorre. Il menu resta DENTRO il contenitore del pulsante (niente portale su <body>): così, dentro un dialogo
 *    aria-modal come quello di benvenuto, gli screen reader lo vedono come parte del dialogo.
 */
function Select<V extends string>({ value, options, onChange, label, icon, className = '' }: SelectProps<V>): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ text: '', timer: 0 });
  const listId = useId();

  const selected = options.find((o) => o.value === value) ?? options[0];

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus({ preventScroll: true });
  }, []);

  const optionElements = (): HTMLElement[] => (listRef.current ? Array.from(listRef.current.querySelectorAll<HTMLElement>('[role="option"]')) : []);

  const focusOption = (index: number) => {
    const list = listRef.current;
    const el = optionElements()[index];
    if (!list || !el) return;
    el.focus({ preventScroll: true });
    revealOption(list, el);
  };

  // Posizione: si calcola a menu aperto (serve la sua misura) e si aggiorna se cambia lo spazio disponibile. Essendo un layout effect,
  // il primo disegno avviene già con il menu al suo posto (React elabora subito l'aggiornamento di stato, prima del paint).
  useLayoutEffect(() => {
    if (!open) {
      setPlacement(null);
      return;
    }
    let frame = 0;
    const update = () => {
      const trigger = triggerRef.current;
      const list = listRef.current;
      if (!trigger || !list) return;
      const next = computePlacement(trigger, list);
      setPlacement((prev) => (prev && prev.up === next.up && prev.end === next.end && prev.maxHeight === next.maxHeight ? prev : next));
    };
    const schedule = () => {
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          update();
        });
      }
    };
    update();
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    window.visualViewport?.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      window.visualViewport?.removeEventListener('resize', schedule);
    };
  }, [open, options.length]);

  // Appena il menu è posizionato, il fuoco va alla voce scelta (o alla prima). Se il browser non lo concede subito (elemento non ancora
  // pronto, es. per un'animazione in corso) si riprova al fotogramma successivo.
  const positioned = open && placement !== null;
  useEffect(() => {
    if (!positioned) return;
    const items = optionElements();
    const current = items.findIndex((el) => el.getAttribute('aria-selected') === 'true');
    const target = items[current >= 0 ? current : 0];
    if (!target) return;
    focusOption(items.indexOf(target));
    if (document.activeElement === target) return;
    const frame = requestAnimationFrame(() => focusOption(items.indexOf(target)));
    return () => cancelAnimationFrame(frame);
  }, [positioned]);

  // Si chiude toccando o spostando il fuoco fuori dal componente.
  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => {
      if (!wrapperRef.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('focusin', outside);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('focusin', outside);
    };
  }, [open, close]);

  useEffect(() => () => window.clearTimeout(typeahead.current.timer), []);

  const choose = (option: SelectOption<V>) => {
    close(true);
    if (option.value !== value) onChange(option.value);
  };

  const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
    }
  };

  const onListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = optionElements();
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusOption((current + 1) % items.length);
        return;
      case 'ArrowUp':
        event.preventDefault();
        focusOption(current <= 0 ? items.length - 1 : current - 1);
        return;
      case 'Home':
        event.preventDefault();
        focusOption(0);
        return;
      case 'End':
        event.preventDefault();
        focusOption(items.length - 1);
        return;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation(); // chiude solo il menu, non il dialogo che lo contiene
        close(true);
        return;
      case 'Tab':
        close(false); // il fuoco prosegue da solo
        return;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (current >= 0) choose(options[current]);
        return;
      default:
    }
    // Ricerca a digitazione: «f» → Français; «e» due volte → seconda voce che inizia per «e».
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      window.clearTimeout(typeahead.current.timer);
      typeahead.current.text += normalize(event.key);
      typeahead.current.timer = window.setTimeout(() => {
        typeahead.current.text = '';
      }, TYPEAHEAD_MS);
      const text = typeahead.current.text;
      const sameLetter = text.length > 1 && [...text].every((c) => c === text[0]);
      const needle = sameLetter ? text[0] : text;
      const start = sameLetter ? current + 1 : Math.max(current, 0);
      for (let i = 0; i < items.length; i++) {
        const index = (start + i) % items.length;
        if (normalize(options[index].label).startsWith(needle)) {
          focusOption(index);
          break;
        }
      }
    }
  };

  const up = placement?.up === true;
  const alignStart = placement !== null && !placement.end;
  const position: React.CSSProperties = {
    position: 'absolute',
    zIndex: 50,
    minWidth: 'max(12rem, 100%)',
    maxWidth: 'calc(100vw - 1rem)',
    top: up ? undefined : '100%',
    bottom: up ? '100%' : undefined,
    marginTop: up ? undefined : GAP,
    marginBottom: up ? GAP : undefined,
    left: alignStart ? 0 : undefined,
    right: alignStart ? undefined : 0,
    maxHeight: placement?.maxHeight,
  };

  return (
    <div ref={wrapperRef} className={`relative inline-block ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${label}: ${selected.label}`}
        className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg border border-gray-300 bg-surface pl-2.5 pr-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100 pointer-fine:min-h-10"
      >
        {icon ? (
          <span className="shrink-0 text-gray-600" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <span className="min-w-0 truncate">{selected.label}</span>
        <ChevronDown size={16} aria-hidden="true" className={`shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={label}
          onKeyDown={onListKeyDown}
          style={position}
          className="overflow-y-auto overscroll-contain rounded-xl border border-gray-200 bg-surface p-1.5 shadow-xl animate-dialog-fade"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <div
                key={option.value}
                role="option"
                aria-selected={isSelected}
                tabIndex={-1}
                onClick={() => choose(option)}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-gray-100 focus:bg-gray-100 focus-visible:outline-offset-[-2px] pointer-fine:min-h-10 ${
                  isSelected ? 'font-semibold text-gray-900' : 'font-medium text-gray-800'
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{option.label}</span>
                  {option.description ? <span className="block truncate text-xs font-normal text-gray-600">{option.description}</span> : null}
                </span>
                {isSelected ? <Check size={16} aria-hidden="true" className="shrink-0 text-accent-ink" /> : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Select;
