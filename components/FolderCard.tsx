
import React, { useState, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { Folder } from '../types';
import { Trash2, Palette, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useNotesStore } from '../hooks/useNotesStore';
import CustomizePopover from './CustomizePopover';
import CardMenu, { CardMenuItem } from './CardMenu';
import { CARD_DATE, CARD_EMOJI, CARD_MENU_POS, CARD_PAD, CARD_TITLE } from './cardStyles';
import DropIndicator from './DropIndicator';
import { useI18n } from '../i18n/I18nProvider';
import FolderGraphic from './FolderGraphic';
import { BG_TO_SWATCH_MAP } from '../utils/helpers';
import { downloadFolderAsZip } from '../utils/exportUtils';
import { confirmDialog } from '../utils/dialogs';

interface FolderCardProps {
  folder: Folder;
  onDelete: (id: string) => void;
  isDropTarget?: boolean;
  viewMode?: 'grid' | 'list';
  isOverlay?: boolean;
  insertPosition?: 'before' | 'after' | null;
}

const FolderCard: React.FC<FolderCardProps> = ({ 
  folder, 
  onDelete, 
  isDropTarget = false, 
  viewMode = 'grid', 
  isOverlay = false,
  insertPosition = null
}) => {
  const { updateFolder, notes, folders } = useNotesStore();
  const { t, formatDate } = useI18n();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  // Il pulsante "⋯" è anche l'àncora del popover "Personalizza"
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useSortable({
    id: folder.id,
    data: { type: 'folder', folder },
  });

  // Opacity handling: Ghost the source, keep overlay opaque
  const opacity = isOverlay ? 1 : (isDragging ? 0.3 : 1);

  const style = {
    opacity,
    // NO transform or transition to keep grid static
    zIndex: isOverlay ? 999 : (isDragging ? 50 : 'auto'),
    touchAction: 'manipulation',
    WebkitTouchCallout: 'none',
  } as React.CSSProperties;

  const requestDelete = async () => {
    const confirmed = await confirmDialog({
      title: t('card.deleteFolderTitle', { name: folder.name }),
      message: t('card.confirmDeleteFolder'),
      confirmLabel: t('common.delete'),
      tone: 'danger',
    });
    if (confirmed) onDelete(folder.id);
  };

  const requestDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      await downloadFolderAsZip(folder.id, notes, folders);
    } finally {
      setIsDownloading(false);
    }
  };

  const menuItems: CardMenuItem[] = [
    { id: 'download', label: t('card.downloadZip'), icon: <Download size={18} />, onSelect: requestDownload },
    { id: 'customize', label: t('card.menuCustomize'), icon: <Palette size={18} />, onSelect: () => setIsPopoverOpen(true) },
    { id: 'delete', label: t('common.delete'), icon: <Trash2 size={18} />, onSelect: requestDelete, tone: 'danger' },
  ];

  const menu = (
    <CardMenu
      buttonRef={menuButtonRef}
      label={t('card.menu', { name: folder.name })}
      items={menuItems}
      busy={isDownloading}
      forceVisible={isPopoverOpen}
      onOpen={() => setIsPopoverOpen(false)}
    />
  );

  const popover = (
    <CustomizePopover
      isOpen={isPopoverOpen}
      onClose={() => setIsPopoverOpen(false)}
      anchorEl={menuButtonRef}
      itemType="folder"
      initialTitle={folder.name}
      onTitleChange={(newName) => {
        updateFolder(folder.id, { name: newName });
      }}
      onSelectEmoji={(emoji) => {
        updateFolder(folder.id, { emoji });
        setIsPopoverOpen(false);
      }}
      onSelectColor={(color) => {
        updateFolder(folder.id, { color });
        setIsPopoverOpen(false);
      }}
    />
  );

  // Colore della "parte posteriore" (linguetta e dorso): la tinta più scura abbinata al colore della cartella
  const backColorClass = BG_TO_SWATCH_MAP[folder.color] || 'bg-gray-400';
  const bodyFillClass = folder.color.replace('bg-', 'fill-');
  const tabFillClass = backColorClass.replace('bg-', 'fill-');

  // List View Rendering
  if (viewMode === 'list') {
      const dropStateClass = isDropTarget 
        ? 'ring-4 ring-accent-ink bg-accent-soft scale-[1.02] shadow-lg z-10' 
        : 'bg-surface hover:border-gray-300 hover:shadow-xs';
      
      const overlayClass = isOverlay ? 'shadow-2xl z-50 bg-surface' : '';

      return (
        <div
          ref={setNodeRef}
          style={style}
          className={`relative group h-16 w-full rounded-xl border border-gray-200 transition-all duration-200 cursor-grab flex items-center pr-1.5 select-none ${dropStateClass} ${overlayClass}`}
        >
           {!isOverlay && !isDropTarget && insertPosition && <DropIndicator position={insertPosition} orientation="horizontal" />}

           <Link
              to={`/folder/${folder.id}`}
              className="flex items-center grow h-full min-w-0 gap-3 pl-3 pr-2 rounded-l-[inherit]"
              {...attributes}
              {...listeners}
           >
             {/* Mini cartella con l'emoji al centro (stessa misura del tondino delle note) */}
             <span className="relative size-10 shrink-0">
                <FolderGraphic
                    bodyClassName={bodyFillClass}
                    tabClassName={tabFillClass}
                    className="size-full drop-shadow-xs"
                />
                <span aria-hidden="true" className="absolute inset-0 grid place-items-center pt-1 text-base leading-none">{folder.emoji}</span>
             </span>

             <span className="min-w-0 grow">
               <h3 className="font-semibold text-gray-800 truncate">{folder.name}</h3>
               {/* Su schermi stretti la data sta sotto al nome, da sm in su a destra */}
               <p className="text-xs text-gray-600 truncate sm:hidden">{formatDate(folder.createdAt)}</p>
             </span>
             <span className="hidden sm:block text-xs text-gray-600 whitespace-nowrap">{formatDate(folder.createdAt)}</span>
           </Link>

           {menu}
           {popover}
        </div>
      );
  }

  // Grid View Rendering (Default)
  /*
   * La cartella è composta da tre strati, tutti in percentuale: si adatta a qualsiasi larghezza della carta
   * (niente più SVG con proporzioni diverse dal contenuto: il testo sta SEMPRE dentro il corpo della cartella).
   *   1. dorso (scuro)      – striscia che si intravede sopra il corpo
   *   2. linguetta (scura)  – in alto a sinistra
   *   3. corpo (colore pieno) – contiene emoji, nome, data e il menu "⋯"
   */
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group @container aspect-square relative transition-transform duration-200 cursor-grab select-none ${isDropTarget ? 'scale-105 z-20' : ''}`}
    >
      {!isOverlay && !isDropTarget && insertPosition && <DropIndicator position={insertPosition} orientation="vertical" />}

      <div aria-hidden="true" className={`absolute inset-x-0 top-[5%] bottom-0 rounded-2xl ${backColorClass}`} />
      <div aria-hidden="true" className={`absolute left-0 top-0 h-[14%] w-[46%] rounded-t-2xl ${backColorClass}`} />

      <div
        className={`absolute inset-x-0 top-[10%] bottom-0 rounded-2xl border border-fg/10 ${folder.color} shadow-xs transition-shadow group-hover:shadow-md ${isOverlay ? 'shadow-2xl' : ''} ${isDropTarget ? 'ring-4 ring-accent-ink shadow-xl' : ''}`}
      >
        <Link
          to={`/folder/${folder.id}`}
          className={`absolute inset-0 flex flex-col justify-between rounded-[inherit] ${CARD_PAD}`}
          {...attributes}
          {...listeners}
        >
          <span aria-hidden="true" className={CARD_EMOJI}>{folder.emoji}</span>
          <span className="block min-w-0">
            <h3 className={CARD_TITLE}>{folder.name}</h3>
            <p className={CARD_DATE}>{formatDate(folder.createdAt)}</p>
          </span>
        </Link>

        <div className={CARD_MENU_POS}>{menu}</div>
      </div>

      {popover}
    </div>
  );
};

export default FolderCard;
