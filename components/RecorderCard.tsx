import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Pause, Play, Square, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { confirmDialog } from '../utils/dialogs';

interface RecorderCardProps {
  /** Chiamata con il file audio quando la registrazione viene terminata e salvata. */
  onRecorded: (file: File) => void;
  /** Chiamata con un messaggio già tradotto se il microfono non è disponibile. */
  onError: (message: string) => void;
}

type Status = 'idle' | 'recording' | 'paused';

const BAR_COUNT = 28;
const MIN_BAR = 0.08; // altezza minima delle barre (frazione del contenitore)
const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4'];

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
};

/** Pulsante tondo con didascalia sotto (le didascalie aiutano chi non riconosce le icone). Definito fuori dal componente: così non viene ricreato a ogni secondo del timer (il focus resta sul pulsante). */
const Control: React.FC<{ onClick: () => void; label: string; caption: string; className: string; children: React.ReactNode }> = ({ onClick, label, caption, className, children }) => (
  <div className="flex flex-col items-center gap-2 w-20">
    <button type="button" onClick={onClick} title={label} aria-label={label} className={`rounded-full flex items-center justify-center transition-all active:scale-95 ${className}`}>
      {children}
    </button>
    <span className="text-xs font-medium text-gray-600 text-center leading-tight">{caption}</span>
  </div>
);

/**
 * Scheda di registrazione audio. Il microfono resta sul dispositivo: l'audio viene registrato con MediaRecorder,
 * il misuratore di livello usa un AnalyserNode locale (Web Audio) e nulla viene inviato finché non si genera il riassunto.
 */
const RecorderCard: React.FC<RecorderCardProps> = ({ onRecorded, onError }) => {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>('idle');
  const [seconds, setSeconds] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const discardRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const loopRef = useRef<(() => void) | null>(null);
  const barsRef = useRef<(HTMLSpanElement | null)[]>([]);

  const stopTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };
  const startTimer = () => {
    stopTimer();
    timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  /** Ferma l'animazione e riporta le barre al minimo (l'analizzatore audio resta pronto per riprendere). */
  const freezeMeter = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    barsRef.current.forEach((bar) => bar && (bar.style.transform = `scaleY(${MIN_BAR})`));
  }, []);

  const stopMeter = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    loopRef.current = null;
    analyserRef.current = null;
    audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    barsRef.current.forEach((bar) => bar && (bar.style.transform = `scaleY(${MIN_BAR})`));
  }, []);

  const startMeter = useCallback((stream: MediaStream) => {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return; // senza Web Audio la registrazione funziona comunque: resta solo il misuratore fermo
      const ctx = new Ctx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.7;
      ctx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      // Si usano le frequenze della voce (le prime ~2/3 dei canali) e si specchia il risultato attorno al centro
      const usable = Math.floor(data.length * 0.66);
      const half = BAR_COUNT / 2;
      const draw = () => {
        const a = analyserRef.current;
        if (!a) return;
        a.getByteFrequencyData(data);
        for (let i = 0; i < BAR_COUNT; i++) {
          const dist = i < half ? half - 1 - i : i - half; // 0 al centro, più alto verso i bordi
          const bin = Math.min(usable - 1, Math.floor((dist / half) * usable));
          const level = Math.min(1, (data[bin] / 255) * 1.25);
          const bar = barsRef.current[i];
          if (bar) bar.style.transform = `scaleY(${Math.max(MIN_BAR, level)})`;
        }
        rafRef.current = requestAnimationFrame(draw);
      };
      loopRef.current = draw;
      draw();
    } catch {
      /* il misuratore è solo estetico */
    }
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  // Pulizia allo smontaggio (cambio pagina): microfono e timer sempre rilasciati
  useEffect(
    () => () => {
      stopTimer();
      stopMeter();
      releaseStream();
    },
    [stopMeter, releaseStream]
  );

  const handleStart = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      discardRef.current = false;
      const mimeType = MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      recorder.onstop = () => {
        stopMeter();
        releaseStream();
        if (!discardRef.current && chunksRef.current.length > 0) {
          const type = mimeType ?? recorder.mimeType ?? 'audio/webm';
          const blob = new Blob(chunksRef.current, { type });
          const now = new Date();
          const pad = (n: number) => n.toString().padStart(2, '0');
          const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
          const ext = type.startsWith('audio/mp4') ? 'm4a' : type.startsWith('audio/ogg') ? 'ogg' : 'webm';
          onRecorded(new File([blob], `${t('upload.recordingName')}_${stamp}.${ext}`, { type: blob.type }));
        }
        chunksRef.current = [];
        setStatus('idle');
        setSeconds(0);
      };
      recorder.start();
      setSeconds(0);
      setStatus('recording');
      startTimer();
      startMeter(stream);
    } catch {
      // Permesso negato o microfono assente: si libera l'eventuale stream e si spiega cosa fare
      releaseStream();
      stopMeter();
      setStatus('idle');
      onError(t('upload.micError'));
    }
  };

  const handlePause = () => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.pause();
      stopTimer();
      freezeMeter(); // in pausa anche il misuratore si ferma del tutto (niente più richieste di animazione)
      setStatus('paused');
    }
  };

  const handleResume = () => {
    if (recorderRef.current?.state === 'paused') {
      recorderRef.current.resume();
      startTimer();
      if (rafRef.current === null) loopRef.current?.();
      setStatus('recording');
    }
  };

  const handleStop = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      stopTimer();
      recorderRef.current.stop();
    }
  };

  const handleDiscard = async () => {
    // Chiede sempre conferma: l'audio scartato non si può recuperare
    const confirmed = await confirmDialog({
      title: t('upload.discardTitle'),
      message: t('upload.discardConfirm'),
      confirmLabel: t('common.discard'),
      cancelLabel: t('upload.discardKeep'),
      tone: 'danger',
    });
    if (!confirmed) return;
    discardRef.current = true;
    handleStop();
  };

  const isActive = status !== 'idle';
  const isPaused = status === 'paused';

  return (
    <section
      aria-labelledby="recorder-title"
      className={`relative overflow-hidden bg-surface p-6 rounded-2xl shadow-xs border flex flex-col items-center min-h-[350px] transition-colors ${isActive && !isPaused ? 'border-danger/50' : 'border-gray-100'}`}
    >
      <h2 id="recorder-title" className="text-xl font-bold text-gray-800">
        {t('upload.recordTitle')}
      </h2>

      {!isActive ? (
        <div className="relative flex flex-col items-center justify-center grow w-full gap-5 py-4">
          <div className="relative flex items-center justify-center">
            <span aria-hidden="true" className="absolute h-40 w-40 rounded-full bg-danger/5" />
            <span aria-hidden="true" className="absolute h-32 w-32 rounded-full bg-danger/10" />
            <button
              type="button"
              onClick={handleStart}
              aria-label={t('upload.start')}
              title={t('upload.start')}
              className="relative h-24 w-24 rounded-full bg-danger text-white flex items-center justify-center shadow-lg shadow-danger/30 hover:bg-danger-hover hover:scale-105 active:scale-95 transition-all"
            >
              <Mic size={44} aria-hidden="true" />
            </button>
          </div>
          <div className="text-center space-y-1">
            <p className="text-base font-semibold text-gray-800">{t('upload.tapToRecord')}</p>
            <p className="text-sm text-gray-600">{t('upload.recordDesc')}</p>
          </div>
          <p className="text-xs text-gray-600 text-center max-w-xs rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">{t('upload.recordTip')}</p>
        </div>
      ) : (
        <div className="relative flex flex-col items-center justify-center grow w-full gap-5 py-4">
          {/* Stato */}
          <p
            role="status"
            aria-live="polite"
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${isPaused ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-700'}`}
          >
            <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
              {!isPaused && <span className="absolute inline-flex h-full w-full rounded-full bg-danger opacity-60 animate-ping" />}
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${isPaused ? 'bg-amber-500' : 'bg-danger'}`} />
            </span>
            {isPaused ? t('upload.paused') : t('upload.recording')}
          </p>

          {/* Timer (non annunciato a ogni secondo dagli screen reader) */}
          <div className={`text-6xl font-mono font-bold tabular-nums transition-colors ${isPaused ? 'text-gray-400' : 'text-gray-900'}`} aria-hidden="true">
            {formatTime(seconds)}
          </div>
          <span className="sr-only">{formatTime(seconds)}</span>

          {/* Misuratore di livello */}
          <div aria-hidden="true" className="flex h-14 w-full max-w-xs items-center justify-center gap-[3px]">
            {Array.from({ length: BAR_COUNT }, (_, i) => (
              <span
                key={i}
                ref={(el) => {
                  barsRef.current[i] = el;
                }}
                className={`h-full w-1 rounded-full origin-center ${isPaused ? 'bg-gray-300' : 'bg-danger'}`}
                style={{ transform: `scaleY(${MIN_BAR})`, transition: 'transform 80ms linear' }}
              />
            ))}
          </div>

          {/* Comandi */}
          <div className="flex items-start justify-center gap-4 sm:gap-6">
            <Control onClick={handleDiscard} label={t('upload.discard')} caption={t('upload.discard')} className="h-14 w-14 bg-gray-100 text-gray-700 hover:bg-red-100 hover:text-red-700">
              <Trash2 size={22} aria-hidden="true" />
            </Control>
            <Control onClick={handleStop} label={t('upload.stop')} caption={t('upload.save')} className="h-20 w-20 bg-danger text-white shadow-lg shadow-danger/30 hover:bg-danger-hover">
              <Square size={30} fill="currentColor" aria-hidden="true" />
            </Control>
            {isPaused ? (
              <Control onClick={handleResume} label={t('upload.resume')} caption={t('upload.resume')} className="h-14 w-14 bg-accent text-accent-fg hover:bg-accent-hover">
                <Play size={22} fill="currentColor" aria-hidden="true" />
              </Control>
            ) : (
              <Control onClick={handlePause} label={t('upload.pause')} caption={t('upload.pause')} className="h-14 w-14 bg-gray-100 text-gray-700 hover:bg-gray-200">
                <Pause size={22} fill="currentColor" aria-hidden="true" />
              </Control>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default RecorderCard;
