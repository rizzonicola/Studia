import React, { Suspense, lazy, use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useNotesStore } from '../hooks/useNotesStore';
import { ArrowLeft, BookOpen, BrainCircuit, HelpCircle, Download, Maximize, Minimize } from 'lucide-react';
import QuizView from '../components/QuizView';
import { QuizData, MapData } from '../types';
import { useI18n } from '../i18n/I18nProvider';
import { useTheme } from '../hooks/useTheme';
import { sanitizeMap, sanitizeQuiz, safeJsonParse } from '../services/validators';
import { buildSafeSrcDoc } from '../utils/sanitizeHtml';
import { downloadFile, sanitizeFilename } from '../utils/download';
import { alertDialog } from '../utils/dialogs';
import { markdownViewModule } from '../components/markdownViewModule';

// Librerie pesanti caricate solo quando servono: markdown+KaTeX (solo vista Appunti), vis-network (solo vista Mappa)
const ConceptMapView = lazy(() => import('../components/ConceptMapView'));

/**
 * MarkdownView arriva da un registro (components/markdownViewModule.ts), non da lazy(): di norma la rotta l'ha già atteso insieme alla
 * pagina e qui lo si legge in modo sincrono, senza sospendere. Solo se manca (es. precarico fallito) si sospende con use() sulla promessa
 * in cache, dentro il <Suspense> che avvolge questo componente.
 */
const NoteMarkdown: React.FC<{ content: string }> = ({ content }) => {
  const { default: MarkdownView } = markdownViewModule.peek('view') ?? use(markdownViewModule.load('view'));
  return <MarkdownView content={content} />;
};

type ViewMode = 'appunti' | 'quiz' | 'mappa';
const isViewMode = (v: string | null): v is ViewMode => v === 'appunti' || v === 'quiz' || v === 'mappa';

const EMPTY_QUIZ_JSON = '{\n  "title": "",\n  "questions": []\n}';
const EMPTY_MAP_JSON = '{\n  "title": "",\n  "graph": {\n    "nodes": [],\n    "edges": []\n  }\n}';

const NoteDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { getNoteById, updateNote, isInitialized } = useNotesStore();
  const { t } = useI18n();
  const { palette, config } = useTheme();

  const note = useMemo(() => (id ? getNoteById(id) : undefined), [id, getNoteById]);
  const isHtmlNote = note?.contentType === 'html';

  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState('');
  const [activeView, setActiveView] = useState<ViewMode>('appunti');
  const [editingMode, setEditingMode] = useState<ViewMode | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const initialEditHandled = useRef(false);

  const quizData = note?.quizData || null;
  const mapData = note?.mapData || null;

  // HTML della nota: sanificato e con CSP interna, mostrato in un iframe senza script né accesso all'origine
  // Nei temi scuri i colori della nota possono essere adattati (Impostazioni → Aspetto → Note in formato web)
  const darkSurface = palette.isDark && config.noteHtml === 'adapt' ? palette.surface : undefined;
  const safeHtml = useMemo(() => (note && isHtmlNote ? buildSafeSrcDoc(note.content, { darkSurface }) : ''), [note, isHtmlNote, darkSurface]);

  const startEdit = useCallback(
    (mode: ViewMode) => {
      if (!note) return;
      setIsEditing(true);
      setEditingMode(mode);
      setIsFullscreen(false);
      if (mode === 'appunti') setContent(note.content);
      else if (mode === 'quiz') setContent(note.quizData ? JSON.stringify(note.quizData, null, 2) : EMPTY_QUIZ_JSON);
      else setContent(note.mapData ? JSON.stringify(note.mapData, null, 2) : EMPTY_MAP_JSON);
    },
    [note]
  );

  // Apertura diretta in modalità modifica (?edit=true): una sola volta, senza sovrascrivere ciò che l'utente sta scrivendo
  useEffect(() => {
    if (!note || initialEditHandled.current) return;
    if (searchParams.get('edit') === 'true') {
      initialEditHandled.current = true;
      const requested = searchParams.get('view');
      startEdit(!isHtmlNote && isViewMode(requested) ? requested : 'appunti');
    }
  }, [note, searchParams, isHtmlNote, startEdit]);

  // Esc esce dallo schermo intero
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  if (!note) {
    // Finché lo store non ha finito di leggere IndexedDB non si può sapere se la nota esiste
    if (!isInitialized) {
      return (
        <div role="status" className="py-16 text-center text-sm text-gray-500">
          {t('common.loading')}
        </div>
      );
    }
    return (
      <div className="py-8 text-center">
        <h2 className="text-2xl font-bold">{t('note.notFound')}</h2>
        <button onClick={() => navigate('/')} className="text-accent-ink hover:underline mt-4 min-h-11">
          {t('note.backNotes')}
        </button>
      </div>
    );
  }

  const finishEditing = () => {
    setIsEditing(false);
    setEditingMode(null);
    if (searchParams.has('edit')) {
      const next = new URLSearchParams(searchParams);
      next.delete('edit');
      setSearchParams(next, { replace: true });
    }
  };

  const handleSave = () => {
    if (!editingMode) return;

    if (editingMode === 'appunti') {
      let newTitle = note.title;
      if (!isHtmlNote) {
        const lines = content.split('\n').filter((line) => line.trim() !== '');
        if (lines.length > 0) {
          const headingLine = lines.find((line) => line.trim().startsWith('# '));
          const extractedTitle = headingLine ? headingLine.trim().substring(2).trim() : lines[0].trim();
          if (extractedTitle) newTitle = extractedTitle;
        }
      }
      updateNote(note.id, { content, title: newTitle });
    } else if (editingMode === 'quiz') {
      if (content.trim() === '') {
        updateNote(note.id, { quizData: null });
      } else {
        const valid = sanitizeQuiz(safeJsonParse(content));
        if (!valid) {
          void alertDialog({ message: t('note.invalidQuiz'), tone: 'error' });
          return;
        }
        updateNote(note.id, { quizData: valid });
      }
    } else {
      if (content.trim() === '') {
        updateNote(note.id, { mapData: null });
      } else {
        const valid = sanitizeMap(safeJsonParse(content));
        if (!valid) {
          void alertDialog({ message: t('note.invalidMap'), tone: 'error' });
          return;
        }
        updateNote(note.id, { mapData: valid });
      }
    }
    finishEditing();
  };

  const handleDownload = () => {
    const base = sanitizeFilename(note.title);
    if (isHtmlNote) {
      downloadFile(note.content, `${base}_note.html`, 'text/html;charset=utf-8;');
      return;
    }
    if (activeView === 'appunti') {
      downloadFile(note.content, `${base}_note.md`, 'text/markdown;charset=utf-8;');
    } else if (activeView === 'quiz' && quizData) {
      downloadFile(JSON.stringify(quizData, null, 2), `${base}_quiz.json`, 'application/json;charset=utf-8;');
    } else if (activeView === 'mappa' && mapData) {
      downloadFile(JSON.stringify(mapData, null, 2), `${base}_map.json`, 'application/json;charset=utf-8;');
    }
  };

  const isDownloadDisabled = isHtmlNote ? false : (activeView === 'quiz' && !quizData) || (activeView === 'mappa' && !mapData);

  const renderContent = () => {
    if (isEditing) {
      return (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          aria-label={t('note.editorLabel')}
          spellCheck={false}
          className="w-full h-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-ink focus:border-accent-ink transition-shadow font-mono text-sm"
          style={{ minHeight: '60vh' }}
        />
      );
    }

    if (isHtmlNote) {
      return (
        <iframe
          srcDoc={safeHtml}
          title={note.title}
          // sandbox vuoto = massima restrizione: niente script, niente same-origin (nessun accesso a localStorage/API key), niente form, niente popup
          sandbox=""
          referrerPolicy="no-referrer"
          className="w-full border border-gray-200 rounded-lg"
          style={{ height: isFullscreen ? 'calc(100dvh - 140px)' : 'calc(100dvh - 250px)' }}
        />
      );
    }

    switch (activeView) {
      case 'appunti':
        return (
          <Suspense fallback={<p role="status" className="text-sm text-gray-500">{t('common.loading')}</p>}>
            <NoteMarkdown content={note.content} />
          </Suspense>
        );
      case 'quiz':
        return (
          <QuizView
            noteId={note.id}
            quizData={quizData}
            onQuizDataChange={(data: QuizData | null) => updateNote(note.id, { quizData: data })}
            sourceContent={note.content}
          />
        );
      case 'mappa':
        return (
          <Suspense fallback={<p role="status" className="text-sm text-gray-500">{t('map.loading')}</p>}>
            <ConceptMapView
              noteId={note.id}
              mapData={mapData}
              onMapDataChange={(data: MapData | null) => updateNote(note.id, { mapData: data })}
              sourceContent={note.content}
              isFullscreen={isFullscreen}
            />
          </Suspense>
        );
      default:
        return null;
    }
  };

  // Schermo intero: overlay
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-[100] bg-surface overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 py-4 min-h-dvh flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center truncate">
              <span className="text-3xl mr-3" aria-hidden="true">{note.emoji}</span>
              {note.title}
            </h1>
            <button
              onClick={() => setIsFullscreen(false)}
              className="p-3 bg-gray-100 rounded-full hover:bg-gray-200 text-gray-700 transition-colors"
              title={t('note.exitFullscreen')}
              aria-label={t('note.exitFullscreen')}
            >
              <Minimize size={24} />
            </button>
          </div>
          <div className="grow">{renderContent()}</div>
        </div>
      </div>
    );
  }

  const barButton = 'px-4 py-2.5 min-h-11 bg-gray-200 text-gray-800 rounded-md text-sm font-semibold hover:bg-gray-300';

  return (
    <div>
      <div className="sticky top-16 bg-surface z-30 transition-all duration-200 border-none shadow-none">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between">
          <button
            onClick={() => navigate(note.folderId ? `/folder/${note.folderId}` : '/')}
            className="flex items-center min-h-11 text-sm text-gray-700 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5 mr-2" aria-hidden="true" />
            {t('common.back')}
          </button>
          {!isEditing && !isHtmlNote && (
            <div className="hidden lg:flex flex-1 justify-center px-4">
              <ViewTabs
                className="bg-gray-100 p-1"
                label={t('note.viewSwitch')}
                activeView={activeView}
                onChange={setActiveView}
                t={t}
              />
            </div>
          )}
          {isEditing ? (
            <button onClick={handleSave} className="px-4 py-2.5 min-h-11 bg-accent text-accent-fg rounded-md text-sm font-semibold hover:bg-accent-hover">
              {t('common.save')}
            </button>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsFullscreen(true)}
                className="p-3 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                title={t('note.fullscreen')}
                aria-label={t('note.fullscreen')}
              >
                <Maximize size={20} />
              </button>
              <button
                onClick={handleDownload}
                disabled={isDownloadDisabled}
                className={`${barButton} flex items-center disabled:opacity-50 disabled:cursor-not-allowed`}
                title={t('note.downloadTitle')}
              >
                <Download size={16} className="mr-2" aria-hidden="true" />
                {t('common.download')}
              </button>
              <button onClick={() => startEdit(isHtmlNote ? 'appunti' : activeView)} className={barButton}>
                {t('common.edit')}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isEditing && (
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 flex items-center break-words min-w-0">
              <span className="text-4xl sm:text-5xl mr-3 sm:mr-4 shrink-0" aria-hidden="true">{note.emoji}</span>
              {note.title}
            </h1>
          </div>
        )}
        <div className="pb-24">{renderContent()}</div>
      </div>

      {!isEditing && !isHtmlNote && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 flex justify-center pb-[calc(1rem+env(safe-area-inset-bottom))] z-40 pointer-events-none">
          <ViewTabs
            className="pointer-events-auto bg-surface p-2 shadow-lg border border-gray-200"
            label={t('note.viewSwitch')}
            activeView={activeView}
            onChange={setActiveView}
            t={t}
          />
        </div>
      )}
    </div>
  );
};

/** Selettore Quiz / Appunti / Mappa: lo stesso componente è il dock mobile e il controllo segmentato della barra desktop. */
const ViewTabs: React.FC<{
  className?: string;
  label: string;
  activeView: ViewMode;
  onChange: (v: ViewMode) => void;
  t: ReturnType<typeof useI18n>['t'];
}> = ({ className = '', label, activeView, onChange, t }) => (
  <div role="group" aria-label={label} className={`flex items-center space-x-2 rounded-full ${className}`}>
    <ActionButton icon={HelpCircle} label={t('note.tabQuiz')} isActive={activeView === 'quiz'} onClick={() => onChange('quiz')} />
    <ActionButton icon={BookOpen} label={t('note.tabNotes')} isActive={activeView === 'appunti'} onClick={() => onChange('appunti')} />
    <ActionButton icon={BrainCircuit} label={t('note.tabMap')} isActive={activeView === 'mappa'} onClick={() => onChange('mappa')} />
  </div>
);

interface ActionButtonProps {
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const ActionButton: React.FC<ActionButtonProps> = ({ icon: Icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    aria-pressed={isActive}
    className={`flex items-center px-4 py-2.5 min-h-11 rounded-full text-sm font-medium transition-colors ${isActive ? 'bg-accent text-accent-fg' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
  >
    <Icon className="w-5 h-5 mr-2" aria-hidden="true" />
    {label}
  </button>
);

export default NoteDetailPage;
