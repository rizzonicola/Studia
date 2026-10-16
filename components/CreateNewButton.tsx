import React, { useState, useRef, useEffect } from 'react';
import { Plus, FolderPlus, FilePlus, Download, FileText, FolderInput, FileCode } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotesStore } from '../hooks/useNotesStore';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../i18n/I18nProvider';
import { MAX_IMPORT_BYTES } from '../config/appConfig';
import { alertDialog, promptDialog } from '../utils/dialogs';
import { readFileAsText, readImportFiles, summarizeNames, type ImportKind, type ImportResult } from '../utils/importFiles';

/** L'indicatore di importazione compare solo se l'import dura più di così (un file singolo non deve far lampeggiare nulla)... */
const IMPORT_INDICATOR_DELAY_MS = 300;
/** ...e si aggiorna al massimo ~10 volte al secondo. */
const IMPORT_INDICATOR_INTERVAL_MS = 100;

interface CreateNewButtonProps {
  parentId?: string | null;
}

const CreateNewButton: React.FC<CreateNewButtonProps> = ({ parentId = null }) => {
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [isImportOpen, setImportOpen] = useState(false);
  // Avanzamento dell'importazione: stato locale a questo componente (non passa dallo store, quindi non rirenderizza le card)
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);
  const importingRef = useRef(false);
  
  const { addFolder, addNote, addNotes } = useNotesStore();
  const { getThemeClasses } = useTheme();
  const { t, tp, formatNumber } = useI18n();
  const theme = getThemeClasses();
  
  const navigate = useNavigate();
  
  const createMenuRef = useRef<HTMLDivElement>(null);
  const importMenuRef = useRef<HTMLDivElement>(null);
  
  // Refs distinti per i tre tipi di import
  const htmlInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  
  // Gestione chiusura menu al click esterno
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      if (createMenuRef.current && !createMenuRef.current.contains(target)) {
        setCreateOpen(false);
      }
      
      if (importMenuRef.current && !importMenuRef.current.contains(target)) {
        setImportOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCreateOpen(false);
        setImportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  /** Un solo avviso per tutti i file non importati (prima: un avviso per file, e gli errori di lettura erano silenziosi). */
  const reportProblems = (names: string[]) => {
    if (names.length === 0) return;
    const { shown, others } = summarizeNames(names);
    const list = others > 0 ? `${shown} ${tp('files.othersMore', others)}` : shown;
    void alertDialog({
      message: tp('create.importProblems', names.length, { size: formatNumber(MAX_IMPORT_BYTES / 1024 / 1024), names: list }),
      tone: 'error',
    });
  };

  /** Legge i file scelti e crea tutti gli appunti in un colpo solo (un aggiornamento di stato, una transazione nel database). */
  const importSelection = async (
    input: HTMLInputElement,
    accept: ImportKind[],
    options: { reportUnsupported: boolean; sortByPath?: boolean },
    folderFor: (dirParts: string[]) => string | null
  ) => {
    const files = Array.from(input.files ?? []); // copia PRIMA di azzerare il campo: in alcuni browser svuotarlo svuota anche la lista
    input.value = ''; // permette di riselezionare gli stessi file
    if (files.length === 0) return;
    if (importingRef.current) return; // un secondo import parte solo quando il primo è finito
    importingRef.current = true;

    // Avanzamento non modale: compare dopo IMPORT_INDICATOR_DELAY_MS e si aggiorna al massimo ogni IMPORT_INDICATOR_INTERVAL_MS
    let latest = { done: 0, total: 0 };
    let shown = false;
    let lastPaint = 0;
    const reveal = window.setTimeout(() => {
      shown = true;
      lastPaint = performance.now();
      setImportProgress(latest);
    }, IMPORT_INDICATOR_DELAY_MS);
    const onProgress = (done: number, total: number) => {
      latest = { done, total };
      if (!shown) return;
      const now = performance.now();
      if (done < total && now - lastPaint < IMPORT_INDICATOR_INTERVAL_MS) return;
      lastPaint = now;
      setImportProgress(latest);
    };

    let result: ImportResult<File>;
    try {
      result = await readImportFiles<File>(files, { accept, maxBytes: MAX_IMPORT_BYTES, read: readFileAsText, ...options, onProgress });
    } finally {
      window.clearTimeout(reveal);
      importingRef.current = false;
      setImportProgress(null);
    }
    addNotes(result.notes.map((n) => ({ title: n.title, content: n.content, folderId: folderFor(n.dirParts), contentType: n.contentType })));
    reportProblems(result.problems);
  };

  // --- Handlers Creazione ---
  const handleCreateFolder = async () => {
    setCreateOpen(false);
    const name = await promptDialog({
      title: t('create.folderTitle'),
      label: t('create.folderLabel'),
      placeholder: t('create.folderPlaceholder'),
      confirmLabel: t('common.create'),
      maxLength: 100,
    });
    if (name) addFolder(name, parentId);
  };

  const handleCreateNote = () => {
    const newNote = addNote({ title: t('notes.defaultTitle'), folderId: parentId });
    setCreateOpen(false);
    navigate(`/note/${newNote.id}?edit=true`);
  };

  // --- Handlers Trigger ---
  const triggerHtmlImport = () => {
    setImportOpen(false);
    htmlInputRef.current?.click();
  };

  const triggerNoteImport = () => {
    setImportOpen(false);
    noteInputRef.current?.click();
  };

  const triggerFolderImport = () => {
    setImportOpen(false);
    folderInputRef.current?.click();
  };
  
  // --- Handlers File Processing ---

  // 1. Pagine HTML (mostrate sempre in iframe sandbox + sanificate)
  const handleImportHtmlFiles = (event: React.ChangeEvent<HTMLInputElement>) =>
    importSelection(event.target, ['html'], { reportUnsupported: true }, () => parentId);

  // 2. Appunti testuali (MD, TXT, JSON)
  const handleImportNoteFiles = (event: React.ChangeEvent<HTMLInputElement>) =>
    importSelection(event.target, ['markdown'], { reportUnsupported: true }, () => parentId);

  // 3. Cartelle (ricorsivo): si ricrea l'albero e si importano solo i formati supportati
  const handleImportFolder = (event: React.ChangeEvent<HTMLInputElement>) => {
    const createdFolders = new Map<string, string>(); // percorso → id della cartella creata

    const ensurePath = (dirParts: string[]): string | null => {
      if (dirParts.length === 0) return parentId;
      const pathKey = dirParts.join('/');
      const known = createdFolders.get(pathKey);
      if (known) return known;
      const parent = ensurePath(dirParts.slice(0, -1));
      const folder = addFolder(dirParts[dirParts.length - 1], parent);
      createdFolders.set(pathKey, folder.id);
      return folder.id;
    };

    return importSelection(event.target, ['html', 'markdown'], { reportUnsupported: false, sortByPath: true }, ensurePath);
  };


  return (
    <>
       {/* Hidden Inputs */}
       <input
        type="file"
        ref={htmlInputRef}
        onChange={handleImportHtmlFiles}
        multiple
        accept=".html,.htm"
        className="hidden"
      />
      <input
        type="file"
        ref={noteInputRef}
        onChange={handleImportNoteFiles}
        multiple
        accept=".md,.txt,.json"
        className="hidden"
      />
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleImportFolder}
        // @ts-ignore
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
      />

      {/*
        Barra dei pulsanti flottanti.
        È l'ULTIMO elemento del contenuto della pagina (subito prima del footer) e usa `position: sticky`:
        - finché la fine della pagina è lontana, resta ancorata al fondo dello schermo (a `bottom-4`,
          più la safe-area di iOS), come un elemento fisso;
        - quando si scorre fino in fondo, raggiunge la sua posizione naturale nel flusso e da lì in poi
          scorre con la pagina (sopra al footer). Tornando su, si riaggancia da sola al fondo schermo.
        Niente JS, niente misure del footer, niente listener di scroll.
        `pointer-events-none` sulla barra: gli spazi vuoti non bloccano i click sulle card sottostanti.
      */}
      {/* Spaziatore: minimo 1.5rem; se la pagina è più corta dello schermo (es. vuota) si allarga e spinge la barra in fondo */}
      <div className="flex-1 min-h-6" aria-hidden="true" />
      <div className="sticky bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 -mx-4 sm:-mx-6 lg:-mx-8 h-14 pointer-events-none flex items-end justify-center md:gap-3">

      {/* 1. CENTRAL BUTTON: CREATE NEW (Folder, Note) */}
      <div className="pointer-events-auto" ref={createMenuRef}>
        <div className="relative">
          {isCreateOpen && (
            <div role="menu" aria-label={t('create.button')} className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-56 bg-surface rounded-xl shadow-xl border border-gray-200 p-1.5 space-y-0.5 animate-dialog-in origin-bottom">
              <button
                onClick={handleCreateFolder}
                role="menuitem" className="w-full flex items-center text-left px-3 py-2 min-h-11 pointer-fine:min-h-10 text-sm text-gray-700 rounded-lg hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-offset-[-2px] transition-colors"
              >
                <FolderPlus className="w-4 h-4 mr-3 text-gray-500" />
                {t('create.folder')}
              </button>
              <button
                onClick={handleCreateNote}
                role="menuitem" className="w-full flex items-center text-left px-3 py-2 min-h-11 pointer-fine:min-h-10 text-sm text-gray-700 rounded-lg hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-offset-[-2px] transition-colors"
              >
                <FilePlus className="w-4 h-4 mr-3 text-gray-500" />
                {t('create.note')}
              </button>
            </div>
          )}
          <button
            onClick={() => { setCreateOpen(!isCreateOpen); setImportOpen(false); }}
            aria-expanded={isCreateOpen}
            aria-haspopup="menu"
            className={`${theme.bg} ${theme.hover} ${theme.fg} rounded-full px-6 py-3.5 flex items-center space-x-2 shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95`}
          >
            <Plus className={`w-5 h-5 transition-transform duration-200 ${isCreateOpen ? 'rotate-45' : ''}`} />
            <span className="font-semibold tracking-wide">{t('create.button')}</span>
          </button>
        </div>
      </div>

      {/* 2. RIGHT BOTTOM BUTTON: IMPORT (HTML, Notes, Folders) */}
      <div className="absolute bottom-0 right-4 sm:right-10 md:static pointer-events-auto" ref={importMenuRef}>
        <div className="relative flex flex-col items-end">
           {/* Avanzamento dell'importazione. Il contenitore c'è sempre (così i lettori di schermo annunciano il testo quando compare);
               il contatore è nascosto agli screen reader: annunciare ogni numero sarebbe solo rumore. */}
           <div role="status" aria-live="polite" className="absolute bottom-full right-0 mb-4">
             {importProgress && (
               <div className="flex items-center gap-2 whitespace-nowrap bg-surface text-gray-700 rounded-full shadow-lg border border-gray-200 px-4 py-2 text-sm">
                 <span>{t('create.importing')}</span>
                 <span aria-hidden="true" className="font-medium tabular-nums">{formatNumber(importProgress.done)}/{formatNumber(importProgress.total)}</span>
               </div>
             )}
           </div>
           {isImportOpen && (
             <div role="menu" aria-label={t('create.importTitle')} className="absolute bottom-full right-0 mb-4 w-64 bg-surface rounded-xl shadow-xl border border-gray-200 p-1.5 space-y-0.5 animate-dialog-in origin-bottom-right">
                {/* 1. Importa HTML */}
                <button
                  onClick={triggerHtmlImport}
                  role="menuitem" className="w-full flex items-center text-left px-3 py-2 min-h-11 pointer-fine:min-h-10 text-sm text-gray-700 rounded-lg hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-offset-[-2px] transition-colors"
                >
                  <FileCode className="w-4 h-4 mr-3 text-indigo-500" />
                  <div>
                    <span className="block font-medium">{t('create.importHtml')}</span>
                    <span className="text-xs text-gray-600">{t('create.importHtmlDesc')}</span>
                  </div>
                </button>
                
                {/* 2. Importa Appunti */}
                <button
                  onClick={triggerNoteImport}
                  role="menuitem" className="w-full flex items-center text-left px-3 py-2 min-h-11 pointer-fine:min-h-10 text-sm text-gray-700 rounded-lg hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-offset-[-2px] transition-colors"
                >
                  <FileText className="w-4 h-4 mr-3 text-gray-500" />
                  <div>
                    <span className="block font-medium">{t('create.importNotes')}</span>
                    <span className="text-xs text-gray-600">{t('create.importNotesDesc')}</span>
                  </div>
                </button>

                {/* 3. Importa Cartella */}
                <button
                  onClick={triggerFolderImport}
                  role="menuitem" className="w-full flex items-center text-left px-3 py-2 min-h-11 pointer-fine:min-h-10 text-sm text-gray-700 rounded-lg hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-offset-[-2px] transition-colors"
                >
                  <FolderInput className="w-4 h-4 mr-3 text-blue-500" />
                   <div>
                    <span className="block font-medium">{t('create.importFolder')}</span>
                    <span className="text-xs text-gray-600">{t('create.importFolderDesc')}</span>
                  </div>
                </button>
             </div>
           )}
           <button
             onClick={() => { setImportOpen(!isImportOpen); setCreateOpen(false); }}
             className="h-12 min-w-12 lg:px-5 lg:gap-2 bg-surface text-gray-700 rounded-full shadow-lg hover:shadow-xl border border-gray-200 flex items-center justify-center transition-all duration-200 hover:bg-gray-50 active:scale-95 disabled:opacity-50 disabled:cursor-wait"
             disabled={importProgress !== null}
             title={t('create.importTitle')}
             aria-label={t('create.importTitle')}
             aria-expanded={isImportOpen}
             aria-haspopup="menu"
           >
             <Download className="w-5 h-5" aria-hidden="true" />
             <span className="hidden lg:inline text-sm font-semibold">{t('create.import')}</span>
           </button>
        </div>
      </div>

      </div>
    </>
  );
};

export default CreateNewButton;
