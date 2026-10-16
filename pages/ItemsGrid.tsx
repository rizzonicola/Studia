
import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  CollisionDetection,
  DragOverEvent,
  MeasuringStrategy,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useNavigate } from 'react-router-dom';
import { Note, Folder } from '../types';
import NoteCard from '../components/NoteCard';
import FolderCard from '../components/FolderCard';
import BackToHomeDropZone from '../components/BackToHomeDropZone';
import { useNotesStore } from '../hooks/useNotesStore';
import { Folder as FolderIcon } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../i18n/I18nProvider';

/**
 * Colonne e spaziatura della griglia in base alla dimensione scelta in Impostazioni → Forma e layout (classi scritte per intero per Tailwind).
 * La spaziatura passa da --item-gap: la usano sia il gap della griglia sia la linea di inserimento (components/DropIndicator.tsx),
 * che così resta sempre centrata tra due carte.
 */
const GRID_CLASS = {
  compact: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9 gap-(--item-gap) [--item-gap:0.75rem] sm:[--item-gap:1rem]',
  normal: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-(--item-gap) [--item-gap:1rem] sm:[--item-gap:1.5rem]',
  large: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-(--item-gap) [--item-gap:1.25rem] sm:[--item-gap:2rem]',
} as const;

type Item = (Note & { type: 'note' }) | (Folder & { type: 'folder' });

interface ItemsGridProps {
  notes: Note[];
  folders: Folder[];
  showBackToHomeDropZones?: boolean;
}

const ItemsGrid: React.FC<ItemsGridProps> = ({ notes, folders, showBackToHomeDropZones = false }) => {
  const { moveNoteToFolder, deleteNote, deleteFolder, moveFolderToFolder, reorderItems } = useNotesStore();
  const { viewMode, config } = useTheme();
  const { t } = useI18n();
  const [activeDragItem, setActiveDragItem] = useState<Item | null>(null);
  
  // Traccia l'elemento attualmente sotto il cursore per disegnare le linee guida
  const [currentOverId, setCurrentOverId] = useState<string | null>(null);

  const navigate = useNavigate();

  // Stato per tracciare quale cartella è pronta a ricevere l'elemento (basato sulla posizione geometrica)
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null);
  // Cartella-bersaglio rilevata dall'ultimo calcolo delle collisioni (aggiornata in modo sincrono) e stato "trascinamento in corso":
  // servono a non programmare un timer a ogni movimento del puntatore e a non applicare un timer in ritardo a trascinamento finito.
  const detectedFolderRef = useRef<string | null>(null);
  const dragActiveRef = useRef(false);

  // Elenco ordinato derivato dallo store (che si aggiorna in modo sincrono): niente stato duplicato né effetto
  const items = useMemo<Item[]>(() => {
    const combined: Item[] = [
      ...folders.map((f): Folder & { type: 'folder' } => ({ ...f, type: 'folder' })),
      ...notes.map((n): Note & { type: 'note' } => ({ ...n, type: 'note' })),
    ];
    combined.sort((a, b) => {
      const orderA = a.order ?? 0;
      const orderB = b.order ?? 0;
      if (orderA === orderB) return a.createdAt.localeCompare(b.createdAt); // ordinamento stabile
      return orderA - orderB;
    });
    return combined;
  }, [notes, folders]);
  const itemIds = useMemo(() => items.map((i) => i.id), [items]);

  // CONFIGURAZIONE SENSORI
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 8,
      },
    })
  );

  // Helper per determinare se siamo nel "centro" del target (per annidamento) o ai bordi (per ordinamento)
  const isPointerInCenterZone = (
    pointer: { x: number; y: number },
    rect: { width: number; height: number; top: number; bottom: number; left: number; right: number }
  ) => {
      const { top, bottom, left, right, width, height } = rect;
      
      // Definiamo una "zona morta" ai bordi (es. 25%). 
      // Se il cursore è in questa zona, stiamo ordinando.
      // Se è nel 50% centrale, stiamo inserendo.
      const xMargin = width * 0.25;
      const yMargin = height * 0.25;

      const inCenterX = pointer.x > (left + xMargin) && pointer.x < (right - xMargin);
      const inCenterY = pointer.y > (top + yMargin) && pointer.y < (bottom - yMargin);

      return inCenterX && inCenterY;
  };

  // Strategia di Collisione Custom Geometrica
  // Poiché handleDragOver non ha le coordinate, spostiamo la logica di "setTargetFolderId"
  // DIRETTAMENTE dentro customCollisionDetection. 
  // È una funzione pura per dnd-kit, ma React ci permette di chiamare setState (con attenzione).
  // Per evitare "Too many re-renders", controlliamo se il valore è cambiato prima di settarlo.
  const collisionDetectionWithSideEffects: CollisionDetection = useCallback((args) => {
    const { droppableContainers, pointerCoordinates, active, droppableRects } = args;
    
    // Default: nessun target folder
    let detectedFolderId: string | null = null;
    let finalCollisions = rectIntersection(args); // Default behavior

    if (pointerCoordinates) {
        const collisions = pointerWithin(args);
        const folderCollision = collisions.find((c) => {
            const container = droppableContainers.find(dc => dc.id === c.id);
            return container?.data.current?.type === 'folder' && container.id !== active.id;
        });

        if (folderCollision) {
             const container = droppableContainers.find(dc => dc.id === folderCollision.id);
             const folderRect = droppableRects.get(folderCollision.id);

             if (container && folderRect) {
                 const inCenter = isPointerInCenterZone(
                     pointerCoordinates, 
                     folderRect
                 );

                 if (inCenter) {
                     detectedFolderId = String(folderCollision.id);
                     finalCollisions = [folderCollision]; // Force drop inside
                 }
             }
        }
    }

    // Side effect controllato: lo stato React si aggiorna solo quando il bersaglio CAMBIA (prima si programmava un timer a ogni
    // movimento del puntatore, decine al secondo). Il timer serve a uscire dal ciclo di render corrente di dnd-kit; applica sempre
    // l'ultimo valore rilevato e solo se il trascinamento è ancora in corso.
    if (detectedFolderRef.current !== detectedFolderId) {
        detectedFolderRef.current = detectedFolderId;
        setTimeout(() => {
            if (dragActiveRef.current) setTargetFolderId(detectedFolderRef.current);
        }, 0);
    }

    return finalCollisions;
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const item = items.find(i => i.id === active.id);
    dragActiveRef.current = true;
    detectedFolderRef.current = null;
    if (item) {
      setActiveDragItem(item);
    }
  };

  /** Fine del trascinamento (rilascio o annullamento): azzera tutto lo stato temporaneo. */
  const resetDrag = () => {
    dragActiveRef.current = false;
    detectedFolderRef.current = null;
    setCurrentOverId(null);
    setActiveDragItem(null);
    setTargetFolderId(null);
  };

  const handleDragOver = (event: DragOverEvent) => {
     setCurrentOverId(event.over ? String(event.over.id) : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    // Cartella-bersaglio dell'ultimo calcolo di collisione (la sorgente più fresca), letta prima di azzerare lo stato
    const finalDropFolderId = detectedFolderRef.current;
    resetDrag();

    // Caso 1: Drop nelle zone "Torna Indietro" (Back to Home)
    if (over && String(over.id).startsWith('back-to-home-dropzone')) {
        const activeItem = items.find(i => i.id === active.id);
        if (activeItem?.type === 'note') moveNoteToFolder(activeItem.id, null);
        else if (activeItem?.type === 'folder') moveFolderToFolder(activeItem.id, null);
        navigate('/');
        return;
    }

    // Caso 2: Inserimento in una Cartella (Nesting) - Priorità se siamo nel "centro"
    if (finalDropFolderId) {
        if (active.id === finalDropFolderId) return; 

        const activeItem = items.find(i => i.id === active.id);
        if (activeItem?.type === 'note') {
            moveNoteToFolder(active.id as string, finalDropFolderId);
        } else if (activeItem?.type === 'folder') {
            moveFolderToFolder(active.id as string, finalDropFolderId);
        }
        return;
    }
  
    // Caso 3: Riordinamento (Sorting) - Solo se NON siamo nel targetFolderId
    if (over && active.id !== over.id) {
        const activeId = active.id as string;
        const overId = String(over.id);
        
        const oldIndex = items.findIndex((item) => item.id === activeId);
        const newIndex = items.findIndex((item) => item.id === overId);
        if (oldIndex === -1 || newIndex === -1) return;

        // Ordine persistente = posizione nell'array; lo store scrive solo gli elementi cambiati
        const newItems = arrayMove(items, oldIndex, newIndex);
        reorderItems(newItems.map((item, index) => ({ id: item.id, type: item.type, order: index })));
    }
  };

  if (items.length === 0) {
    return (
        <div className="text-center py-20 animate-fade-in">
            <FolderIcon className="mx-auto h-12 w-12 text-gray-500 mb-3" aria-hidden="true" />
            <h3 className="text-lg font-medium text-gray-900">{t('items.emptyTitle')}</h3>
            <p className="text-gray-600">{t('items.emptyDesc')}</p>
        </div>
    );
  }

  // Helper per calcolare la posizione della linea di inserimento
  const getInsertionPosition = (itemId: string): 'before' | 'after' | null => {
      // Se abbiamo un targetFolderId attivo (siamo nel centro), NASCONDIAMO le linee di inserimento ovunque
      if (targetFolderId) return null;

      if (!activeDragItem || !currentOverId) return null;
      if (currentOverId !== itemId) return null; 
      if (activeDragItem.id === itemId) return null;

      const activeIndex = items.findIndex(i => i.id === activeDragItem.id);
      const overIndex = items.findIndex(i => i.id === itemId);

      if (activeIndex === -1 || overIndex === -1) return null;

      return activeIndex < overIndex ? 'after' : 'before';
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetectionWithSideEffects}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={resetDrag}
      measuring={{
        droppable: {
          strategy: MeasuringStrategy.Always,
        },
      }}
      autoScroll={{
        threshold: { x: 0.1, y: 0.1 },
        acceleration: 15
      }}
    >
      {showBackToHomeDropZones && activeDragItem && (
        <>
          <BackToHomeDropZone side="left" />
          <BackToHomeDropZone side="right" />
        </>
      )}
      
      <SortableContext 
        items={itemIds} 
        strategy={viewMode === 'list' ? verticalListSortingStrategy : rectSortingStrategy}
      >
        <div className={viewMode === 'grid' 
            ? `grid ${GRID_CLASS[config.cardSize]} p-2 pb-24`
            : "flex flex-col gap-(--item-gap) [--item-gap:0.75rem] pb-24 w-full max-w-4xl mx-auto"
        }>
          {items.map(item => {
            const isTarget = targetFolderId === item.id;
            // Calcoliamo la linea solo se non è il target di drop
            const insertPos = isTarget ? null : getInsertionPosition(item.id);

            if (item.type === 'folder') {
              return (
                <FolderCard 
                  key={item.id} 
                  folder={item} 
                  onDelete={() => deleteFolder(item.id)}
                  isDropTarget={isTarget} 
                  insertPosition={insertPos}
                  viewMode={viewMode}
                />
              );
            }
            if (item.type === 'note') {
              return (
                <NoteCard 
                  key={item.id} 
                  note={item} 
                  onDelete={() => deleteNote(item.id)} 
                  viewMode={viewMode} 
                  insertPosition={insertPos}
                />
              );
            }
            return null;
          })}
        </div>
      </SortableContext>
      
      <DragOverlay dropAnimation={{
          duration: 250,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
      }}>
        {activeDragItem ? (
           <div className="transform scale-105 opacity-90 rotate-2 pointer-events-none">
               {activeDragItem.type === 'note' 
                  ? <NoteCard note={activeDragItem as Note} onDelete={() => {}} viewMode={viewMode} isOverlay={true} /> 
                  : <FolderCard folder={activeDragItem as Folder} onDelete={() => {}} viewMode={viewMode} isOverlay={true} />
               }
           </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default ItemsGrid;
