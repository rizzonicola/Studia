import React, { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ALL_EMOJIS, ALL_PASTEL_COLORS } from '../utils/helpers';
import { useI18n } from '../i18n/I18nProvider';

interface CustomizePopoverProps {
  isOpen: boolean;
  onClose: () => void;
  anchorEl: React.RefObject<HTMLElement | null>;
  itemType: 'note' | 'folder';
  onSelectEmoji: (emoji: string) => void;
  onSelectColor: (color: string) => void;
  isHtmlNote?: boolean;
  initialTitle?: string;
  onTitleChange?: (newTitle: string) => void;
}

const CustomizePopover: React.FC<CustomizePopoverProps> = ({
  isOpen,
  onClose,
  anchorEl,
  itemType,
  onSelectEmoji,
  onSelectColor,
  isHtmlNote,
  initialTitle,
  onTitleChange,
}) => {
  const { t } = useI18n();
  const popoverRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const [title, setTitle] = useState(initialTitle || '');

  // Reset local title state when the popover is opened with a new item
  useEffect(() => {
    if (isOpen) {
        setTitle(initialTitle || '');
    }
  }, [initialTitle, isOpen]);

  // Reusable function to save the title if it has changed
  const saveTitle = () => {
    if (onTitleChange && title.trim() !== '' && title.trim() !== initialTitle?.trim()) {
      onTitleChange(title.trim());
    }
  };

  // Handle clicks outside the popover to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        anchorEl.current &&
        !anchorEl.current.contains(event.target as Node)
      ) {
        saveTitle(); // Save title changes before closing
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, anchorEl, title, initialTitle, onTitleChange]);

  // Escape chiude il popover salvando il titolo (navigazione da tastiera)
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        saveTitle();
        onClose();
        anchorEl.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, title, initialTitle, onTitleChange]);

  // Posizione: sotto l'àncora (o sopra se manca spazio), sempre dentro lo schermo.
  // Il popover è "fixed": con la rotella del mouse la pagina scorre sotto di lui, quindi si riposiziona a ogni scroll/resize.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const place = () => {
      const anchor = anchorEl.current;
      const node = popoverRef.current;
      if (!anchor || !node) return;
      const rect = anchor.getBoundingClientRect();
      const popoverHeight = node.offsetHeight;
      const popoverWidth = node.offsetWidth;
      const margin = 8;

      let top: number;
      const spaceBelow = window.innerHeight - rect.bottom - margin;
      const spaceAbove = rect.top - margin;
      if (spaceBelow >= popoverHeight || spaceAbove < popoverHeight) {
        top = rect.bottom + margin; // preferisce sotto
      } else {
        top = rect.top - popoverHeight - margin; // altrimenti sopra
      }

      let left = rect.right - popoverWidth; // bordi destri allineati
      if (left < margin) left = rect.left;

      top = Math.max(margin, Math.min(top, window.innerHeight - popoverHeight - margin));
      left = Math.max(margin, Math.min(left, window.innerWidth - popoverWidth - margin));

      const next: React.CSSProperties = { position: 'fixed', top: `${top}px`, left: `${left}px`, zIndex: 100, visibility: 'visible' };
      // Niente nuovo render se la posizione non è cambiata (lo scroll interno al popover genera molti eventi)
      setStyle((prev) => (prev.top === next.top && prev.left === next.left ? prev : next));
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [isOpen, anchorEl]);

  // Tastiera: all'apertura il focus entra nel popover (la prima volta che è posizionato)
  const isPositioned = isOpen && !!style.top;
  useEffect(() => {
    if (isPositioned) popoverRef.current?.querySelector<HTMLElement>('input, button')?.focus({ preventScroll: true });
  }, [isPositioned]);

  // Handler for when the input loses focus
  const handleTitleBlur = () => {
    saveTitle();
  };
  
  // Wrapper for selecting an emoji, ensures title is saved first
  const handleSelectEmoji = (emoji: string) => {
    saveTitle();
    onSelectEmoji(emoji);
  };
  
  // Wrapper for selecting a color, ensures title is saved first
  const handleSelectColor = (color: string) => {
    saveTitle();
    onSelectColor(color);
  };


  if (!isOpen) return null;

  // Portale su <body>: le carte sono contenitori (@container) e il loro contenimento cambierebbe il riferimento di "position: fixed"
  return createPortal(
    <div
      ref={popoverRef}
      style={{ ...style, visibility: isOpen && style.top ? 'visible' : 'hidden' }}
      role="dialog"
      aria-label={t('popover.label')}
      className="w-64 max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain bg-surface rounded-xl shadow-xl border border-gray-200 p-3 space-y-3"
      onClick={(e) => e.stopPropagation()}
    >
      {((itemType === 'note' && isHtmlNote) || itemType === 'folder') && (
        <div>
            <p className="text-xs font-semibold text-gray-600 mb-2 px-1">{itemType === 'folder' ? t('popover.name') : t('popover.title')}</p>
            <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-accent-ink focus:border-transparent"
                placeholder={itemType === 'folder' ? t('popover.editName') : t('popover.editTitle')}
                aria-label={itemType === 'folder' ? t('popover.name') : t('popover.title')}
            />
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-gray-600 mb-2 px-1">
          {t('popover.color')}
        </p>
        <div className="grid grid-cols-6 gap-2">
          {ALL_PASTEL_COLORS.map((color, i) => (
            <button
              key={color}
              onClick={() => handleSelectColor(color)}
              className={`w-9 h-9 rounded-full ${color} border-2 border-surface hover:ring-2 hover:ring-accent-ink focus-visible:ring-2 focus-visible:ring-accent-ink`}
              aria-label={t('popover.colorAria', { n: i + 1, total: ALL_PASTEL_COLORS.length })}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-600 mb-2 px-1">{t('popover.emoji')}</p>
        <div className="grid grid-cols-6 gap-1">
          {ALL_EMOJIS.map(emoji => (
            <button
              key={emoji}
              onClick={() => handleSelectEmoji(emoji)}
              className="text-2xl rounded-md p-1.5 min-w-10 min-h-10 hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-accent-ink"
              aria-label={t('popover.emojiAria', { emoji })}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CustomizePopover;