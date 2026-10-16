import React, { useState, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { Note } from '../types';
import { Trash2, Palette } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useNotesStore } from '../hooks/useNotesStore';
import CustomizePopover from './CustomizePopover';
import CardMenu, { CardMenuItem } from './CardMenu';
import { CARD_DATE, CARD_EMOJI, CARD_MENU_POS, CARD_PAD, CARD_TITLE } from './cardStyles';
import DropIndicator from './DropIndicator';
import { useI18n } from '../i18n/I18nProvider';
import { confirmDialog } from '../utils/dialogs';

interface NoteCardProps {
  note: Note;
  onDelete: (id: string) => void;
  viewMode?: 'grid' | 'list';
  isOverlay?: boolean;
  insertPosition?: 'before' | 'after' | null;
}

const NoteCard: React.FC<NoteCardProps> = ({ 
  note, 
  onDelete, 
  viewMode = 'grid', 
  isOverlay = false,
  insertPosition = null 
}) => {
  const { updateNote } = useNotesStore();
  const { t, formatDate } = useI18n();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  // Il pulsante "⋯" è anche l'àncora del popover "Personalizza"
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useSortable({
    id: note.id,
    data: { type: 'note', note },
  });

  // Se è l'overlay (la copia che segue il dito/mouse) resta opaco; l'originale nella griglia diventa "fantasma"
  const opacity = isOverlay ? 1 : (isDragging ? 0.3 : 1);

  const style = {
    opacity,
    // NO transform or transition here to ensure the grid stays static
    zIndex: isOverlay ? 999 : (isDragging ? 50 : 'auto'),
    touchAction: 'manipulation',
    WebkitTouchCallout: 'none',
  } as React.CSSProperties;

  const requestDelete = async () => {
    const confirmed = await confirmDialog({
      title: t('card.deleteNoteTitle', { name: note.title }),
      message: t('card.confirmDeleteNote'),
      confirmLabel: t('common.delete'),
      tone: 'danger',
    });
    if (confirmed) onDelete(note.id);
  };

  const menuItems: CardMenuItem[] = [
    { id: 'customize', label: t('card.menuCustomize'), icon: <Palette size={18} />, onSelect: () => setIsPopoverOpen(true) },
    { id: 'delete', label: t('common.delete'), icon: <Trash2 size={18} />, onSelect: requestDelete, tone: 'danger' },
  ];

  const menu = (
    <CardMenu
      buttonRef={menuButtonRef}
      label={t('card.menu', { name: note.title })}
      items={menuItems}
      forceVisible={isPopoverOpen}
      onOpen={() => setIsPopoverOpen(false)}
    />
  );

  const popover = (
    <CustomizePopover
      isOpen={isPopoverOpen}
      onClose={() => setIsPopoverOpen(false)}
      anchorEl={menuButtonRef}
      itemType="note"
      onSelectEmoji={(emoji) => {
        updateNote(note.id, { emoji });
        setIsPopoverOpen(false);
      }}
      onSelectColor={(color) => {
        updateNote(note.id, { color });
        setIsPopoverOpen(false);
      }}
      isHtmlNote={note.contentType === 'html'}
      initialTitle={note.title}
      onTitleChange={(newTitle) => {
        updateNote(note.id, { title: newTitle });
      }}
    />
  );

  if (viewMode === 'list') {
      return (
        <div
            ref={setNodeRef}
            style={style}
            className={`relative group h-16 w-full ${note.color}/40 rounded-xl border border-fg/10 transition-shadow hover:shadow-md cursor-grab flex items-center pr-1.5 select-none ${isOverlay ? 'shadow-2xl' : ''}`}
        >
             {!isOverlay && insertPosition && <DropIndicator position={insertPosition} orientation="horizontal" />}

             <Link
                to={`/note/${note.id}`}
                className="flex items-center grow h-full min-w-0 gap-3 pl-3 pr-2 rounded-l-[inherit]"
                {...attributes}
                {...listeners}
              >
                 <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-fg/10 text-xl leading-none">{note.emoji}</span>
                 <span className="min-w-0 grow">
                   <h3 className="font-semibold text-gray-800 truncate">{note.title}</h3>
                   {/* Su schermi stretti la data sta sotto al titolo, da sm in su a destra */}
                   <p className="text-xs text-gray-600 truncate sm:hidden">{formatDate(note.createdAt)}</p>
                 </span>
                 <span className="hidden sm:block text-xs text-gray-600 whitespace-nowrap">{formatDate(note.createdAt)}</span>
              </Link>

             {menu}
             {popover}
        </div>
      )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group @container ${note.color} rounded-2xl aspect-square relative border border-fg/10 shadow-xs transition-shadow hover:shadow-md cursor-grab select-none ${isOverlay ? 'shadow-2xl' : ''}`}
    >
      {!isOverlay && insertPosition && <DropIndicator position={insertPosition} orientation="vertical" />}

      <Link
        to={`/note/${note.id}`}
        className={`absolute inset-0 flex flex-col justify-between rounded-[inherit] ${CARD_PAD}`}
        {...attributes}
        {...listeners}
      >
        <span aria-hidden="true" className={CARD_EMOJI}>{note.emoji}</span>
        <span className="block min-w-0">
          <h3 className={CARD_TITLE}>{note.title}</h3>
          <p className={CARD_DATE}>{formatDate(note.createdAt)}</p>
        </span>
      </Link>

      <div className={CARD_MENU_POS}>{menu}</div>
      {popover}
    </div>
  );
};

export default NoteCard;
