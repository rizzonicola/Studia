import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotesStore } from './useNotesStore';
import { useSettings } from './useSettings';
import { useI18n } from '../i18n/I18nProvider';
import { CancelledError, normalizeError } from '../services/errors';
import { PromptKey, languageDirective, loadPromptPack, resolvePrompt } from '../services/prompts';
import { beginBusy } from '../pwa';
import { hasCachedUploads, pruneUploads } from '../services/uploadCache';

// Il modulo dell'SDK Gemini (@google/genai) viene scaricato solo alla prima generazione
const loadGemini = () => import('../services/gemini');

type TaskType = 'quiz' | 'map';

/**
 * Stato di una generazione in background (quiz/mappa) ancora visibile alla UI: "loading" o "error".
 * Un task riuscito NON resta qui: il risultato viene scritto subito nella nota (vedi runTask) e la voce sparisce.
 */
export interface BackgroundTask {
  id: string; // noteId-type
  noteId: string;
  type: TaskType;
  status: 'loading' | 'error';
  error?: string;
}

interface AIContextType {
  // Stati di Processo (Upload/Camera)
  isProcessing: boolean;
  statusMessage: string;
  error: string | null;

  // Dati persistenti (input dell'utente che non devono sparire navigando)
  uploadedFiles: File[];
  setUploadedFiles: React.Dispatch<React.SetStateAction<File[]>>;
  capturedImage: string | null;
  setCapturedImage: (img: string | null) => void;

  // Background Tasks (Quiz/Map)
  backgroundTasks: Record<string, BackgroundTask>;
  generateQuiz: (noteId: string, content: string) => Promise<void>;
  generateMap: (noteId: string, content: string) => Promise<void>;
  clearTask: (noteId: string, type: TaskType) => void;

  // Azioni Generali
  processUploads: () => Promise<void>;
  processImage: () => Promise<void>;
  /** Annulla l'elaborazione in corso (upload/foto) */
  cancelProcessing: () => void;
  resetState: () => void;
  dismissError: () => void;
}

const AIContext = createContext<AIContextType | null>(null);

export const AIProcessorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const { addNote, updateNote } = useNotesStore();
  const { apiKey, model, fallbackEnabled, fallbackModel, customPrompts, contentLanguage } = useSettings();
  const { language, t } = useI18n();

  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const [backgroundTasks, setBackgroundTasks] = useState<Record<string, BackgroundTask>>({});

  // AbortController: uno per l'elaborazione principale, uno per ogni task quiz/mappa
  const processAbort = useRef<AbortController | null>(null);
  const taskAborts = useRef<Map<string, AbortController>>(new Map());

  // Il provider vive sopra le pagine: cambiare pagina NON interrompe le generazioni.
  // Si annulla solo alla chiusura dell'app (smontaggio del provider).
  useEffect(() => {
    const tasks = taskAborts.current;
    return () => {
      processAbort.current?.abort();
      tasks.forEach((c) => c.abort());
    };
  }, []);

  // Un file tolto dalla lista (o la chiave cambiata) → cancello su Google la copia caricata per un eventuale ritentativo
  // (non durante l'elaborazione: il file serve ancora; la pulizia avviene appena finisce)
  useEffect(() => {
    if (!isProcessing) void pruneUploads(apiKey, uploadedFiles);
  }, [apiKey, uploadedFiles, isProcessing]);

  const dismissError = useCallback(() => setError(null), []);

  const resetState = useCallback(() => {
    setIsProcessing(false);
    setStatusMessage('');
    setError(null);
  }, []);

  const cancelProcessing = useCallback(() => {
    processAbort.current?.abort();
  }, []);

  const clearTask = useCallback((noteId: string, type: TaskType) => {
    const key = `${noteId}-${type}`;
    taskAborts.current.get(key)?.abort();
    taskAborts.current.delete(key);
    setBackgroundTasks((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  /** Risolve prompt (personalizzato > predefinito nella lingua attiva) e riga tecnica della lingua di risposta. */
  const preparePrompt = useCallback(
    async (key: PromptKey) => {
      const [systemPrompt, pack] = await Promise.all([
        resolvePrompt(key, language, customPrompts[key]),
        loadPromptPack(language),
      ]);
      return { systemPrompt, pack, directive: languageDirective(contentLanguage, language) };
    },
    [language, customPrompts, contentLanguage]
  );

  const checkReady = useCallback((): string | null => {
    if (!apiKey) return t('error.missingKey');
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return t('error.offline');
    return null;
  }, [apiKey, t]);

  // --- Quiz e mappe (task in background) ---

  const runTask = useCallback(
    async (type: TaskType, noteId: string, content: string) => {
      const key = `${noteId}-${type}`;
      const setTask = (task: BackgroundTask) => setBackgroundTasks((prev) => ({ ...prev, [key]: task }));
      const dropTask = () =>
        setBackgroundTasks((prev) => {
          if (!(key in prev)) return prev;
          const next = { ...prev };
          delete next[key];
          return next;
        });
      const base = { id: key, noteId, type };

      const problem = checkReady();
      if (problem || !apiKey) {
        setTask({ ...base, status: 'error', error: problem ?? t('error.missingKey') });
        return;
      }

      taskAborts.current.get(key)?.abort();
      const controller = new AbortController();
      taskAborts.current.set(key, controller);
      // Solo l'ULTIMA esecuzione di questo task può toccare lo stato. Un'esecuzione sostituita da una nuova (o annullata con
      // clearTask) termina dopo, con un errore di annullamento: prima quel "fine" cancellava la voce "in corso" della nuova esecuzione.
      const isCurrent = () => taskAborts.current.get(key) === controller;
      setTask({ ...base, status: 'loading' });
      const release = beginBusy();

      try {
        const [{ generateQuizData, generateMapData }, { systemPrompt, pack, directive }] = await Promise.all([
          loadGemini(),
          preparePrompt(type),
        ]);
        const common = {
          creds: { apiKey, model, fallbackModel: fallbackEnabled ? fallbackModel : null },
          systemPrompt,
          content,
          textHeader: pack.requests.textHeader,
          languageDirective: directive,
          signal: controller.signal,
        };
        // Il risultato va DIRETTAMENTE nella nota: resta salvato anche se nel frattempo l'utente ha lasciato la pagina
        // (prima lo applicava la pagina del dettaglio e, se non era aperta, la generazione andava persa).
        if (type === 'quiz') {
          const quizData = await generateQuizData(common);
          if (isCurrent()) void updateNote(noteId, { quizData });
        } else {
          const mapData = await generateMapData(common);
          if (isCurrent()) void updateNote(noteId, { mapData });
        }
        if (isCurrent()) dropTask();
      } catch (err) {
        if (!isCurrent()) return; // sostituita o annullata dall'utente: lo stato non è più nostro
        const normalized = normalizeError(err);
        if (normalized instanceof CancelledError) dropTask();
        else setTask({ ...base, status: 'error', error: normalized.message });
      } finally {
        release();
        if (isCurrent()) taskAborts.current.delete(key);
      }
    },
    [apiKey, model, fallbackEnabled, fallbackModel, checkReady, preparePrompt, updateNote, t]
  );

  const generateQuiz = useCallback((noteId: string, content: string) => runTask('quiz', noteId, content), [runTask]);
  const generateMap = useCallback((noteId: string, content: string) => runTask('map', noteId, content), [runTask]);

  // --- Upload di documenti / audio (File API di Google, tutto dal browser) ---

  const processUploads = useCallback(async () => {
    if (uploadedFiles.length === 0 || processAbort.current) return;
    const problem = checkReady();
    if (problem || !apiKey) {
      setError(problem ?? t('error.missingKey'));
      return;
    }

    const controller = new AbortController();
    processAbort.current = controller;
    const release = beginBusy();
    setIsProcessing(true);
    setStatusMessage(t('status.init'));
    setError(null);

    try {
      const [{ generateNotesFromFiles }, { systemPrompt, pack, directive }] = await Promise.all([loadGemini(), preparePrompt('notes')]);
      const text = await generateNotesFromFiles({
        creds: { apiKey, model, fallbackModel: fallbackEnabled ? fallbackModel : null },
        systemPrompt,
        requestText: pack.requests.notes,
        languageDirective: directive,
        files: uploadedFiles,
        onStatus: setStatusMessage,
        signal: controller.signal,
      });

      const first = uploadedFiles[0].name;
      const extra = uploadedFiles.length > 1 ? ` (+${uploadedFiles.length - 1})` : '';
      const newNote = addNote({ title: t('notes.autoTitle', { first, extra }), content: text });

      setUploadedFiles([]);
      navigate(`/note/${newNote.id}`);
    } catch (err) {
      const normalized = normalizeError(err);
      if (!(normalized instanceof CancelledError)) {
        const message = normalized.message || t('error.processing');
        // Se i file sono già su Google, dillo: il ritentativo sarà più veloce e non rifà l'upload
        setError(hasCachedUploads(apiKey, uploadedFiles) ? `${message} ${t('error.uploadKept')}` : message);
      }
    } finally {
      release();
      processAbort.current = null;
      setIsProcessing(false);
      setStatusMessage('');
    }
  }, [uploadedFiles, apiKey, model, fallbackEnabled, fallbackModel, checkReady, preparePrompt, addNote, navigate, t]);

  // --- Foto → pagina HTML ---

  const processImage = useCallback(async () => {
    if (!capturedImage || processAbort.current) return;
    const problem = checkReady();
    if (problem || !apiKey) {
      setError(problem ?? t('error.missingKey'));
      return;
    }

    const controller = new AbortController();
    processAbort.current = controller;
    const release = beginBusy();
    setIsProcessing(true);
    setStatusMessage(t('status.readingImage'));
    setError(null);

    try {
      const [{ processImageToHtml }, { systemPrompt, pack, directive }] = await Promise.all([loadGemini(), preparePrompt('image')]);
      const match = capturedImage.match(/^data:([^;]+);base64,(.*)$/);
      const mimeType = match?.[1] ?? 'image/jpeg';
      const base64Data = match?.[2] ?? capturedImage.split(',')[1];

      const html = await processImageToHtml({
        creds: { apiKey, model, fallbackModel: fallbackEnabled ? fallbackModel : null },
        systemPrompt,
        requestText: pack.requests.image,
        languageDirective: directive,
        base64: base64Data,
        mimeType,
        signal: controller.signal,
      });

      const newNote = addNote({ title: t('notes.photoTitle'), content: html, contentType: 'html', folderId: null });
      setCapturedImage(null);
      navigate(`/note/${newNote.id}`);
    } catch (err) {
      const normalized = normalizeError(err);
      if (!(normalized instanceof CancelledError)) setError(normalized.message || t('error.processing'));
    } finally {
      release();
      processAbort.current = null;
      setIsProcessing(false);
      setStatusMessage('');
    }
  }, [capturedImage, apiKey, model, fallbackEnabled, fallbackModel, checkReady, preparePrompt, addNote, navigate, t]);

  const value = useMemo<AIContextType>(
    () => ({
      isProcessing,
      statusMessage,
      error,
      uploadedFiles,
      setUploadedFiles,
      capturedImage,
      setCapturedImage,
      backgroundTasks,
      generateQuiz,
      generateMap,
      clearTask,
      processUploads,
      processImage,
      cancelProcessing,
      resetState,
      dismissError,
    }),
    [
      isProcessing, statusMessage, error, uploadedFiles, capturedImage, backgroundTasks, generateQuiz, generateMap,
      clearTask, processUploads, processImage, cancelProcessing, resetState, dismissError,
    ]
  );

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
};

export const useAIProcessor = () => {
  const context = useContext(AIContext);
  if (!context) throw new Error('useAIProcessor must be used within AIProcessorProvider');
  return context;
};
