import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, Loader } from 'lucide-react';
import type { TranslationKey } from '../i18n/types';

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

export interface StatusIndicatorViewProps {
  isProcessing: boolean;
  statusMessage: string;
  error: string | null;
  onCancel: () => void;
  onDismiss: () => void;
  t: Translate;
}

/** 75 s → «1:15». */
const formatElapsed = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

const secondaryButton =
  'mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100';

/**
 * Stato dell'elaborazione nell'intestazione: al posto della barra a tutta larghezza (che su telefono copriva le schede sotto l'intestazione)
 * c'è un solo pulsante rotondo accanto alle Impostazioni.
 *  - elaborazione in corso → rotella che gira; errore → triangolo rosso; niente da mostrare → il pulsante non c'è;
 *  - toccandolo si apre un pannello con il messaggio COMPLETO (anche un errore lungo, che scorre), da quanto dura l'elaborazione e il
 *    pulsante «Annulla» o «Chiudi errore». Su telefono il pannello occupa la larghezza dello schermo sotto l'intestazione, da sm in su
 *    è un riquadro ancorato al pulsante.
 *  - si chiude con Esc, toccando fuori, uscendo con Tab, o da solo quando non c'è più nulla da mostrare.
 *  - gli screen reader ricevono comunque i cambi di stato (area role="status") e gli errori (role="alert"), anche a pannello chiuso.
 * Componente puro (non usa hook dell'app): lo collega a useAIProcessor components/StatusIndicator.tsx.
 */
const StatusIndicatorView: React.FC<StatusIndicatorViewProps> = ({ isProcessing, statusMessage, error, onCancel, onDismiss, t }) => {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const startedAt = useRef<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const hasError = Boolean(error);
  const active = hasError || isProcessing;

  // Si ricorda quando è iniziata l'elaborazione (per «In corso da …»)
  useEffect(() => {
    if (!isProcessing) {
      startedAt.current = null;
      return;
    }
    startedAt.current ??= Date.now();
    setNow(Date.now());
  }, [isProcessing]);

  // Con il pannello aperto il tempo trascorso si aggiorna ogni secondo
  useEffect(() => {
    if (!open || !isProcessing) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [open, isProcessing]);

  // Nulla da mostrare → il pannello si chiude da solo
  useEffect(() => {
    if (!active) setOpen(false);
  }, [active]);

  // Si chiude toccando fuori o con Esc (che riporta il fuoco sul pulsante)
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const elapsed = formatElapsed(now - (startedAt.current ?? now));
  const liveMessage = isProcessing && !hasError ? statusMessage || t('header.processing') : '';

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onBlur={(event: React.FocusEvent<HTMLDivElement>) => {
        // Il fuoco esce dal pulsante e dal pannello (es. con Tab): si chiude. Il pannello ha tabIndex=-1: un tocco sul suo testo non lo chiude.
        if (open && !event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      {/* Sempre presenti (anche a pannello chiuso o senza pulsante): gli screen reader annunciano quando il testo cambia */}
      <span role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </span>
      <span role="alert" className="sr-only">
        {error ?? ''}
      </span>

      {active && (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-label={hasError ? t('header.status.errorLabel') : t('header.status.processingLabel')}
          title={hasError ? t('header.status.errorLabel') : t('header.status.processingLabel')}
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors ${
            hasError ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-accent-soft text-accent-ink hover:bg-accent-soft/80'
          }`}
        >
          {hasError ? (
            <AlertTriangle size={20} aria-hidden="true" />
          ) : (
            <Loader size={20} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          )}
        </button>
      )}

      {active && open && (
        <div
          id={panelId}
          role="region"
          aria-label={t('header.status.panelLabel')}
          tabIndex={-1}
          className="fixed left-3 right-3 top-[4.25rem] z-50 rounded-xl border border-gray-200 bg-surface p-4 text-left shadow-xl outline-none animate-dialog-fade sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80"
        >
          {hasError && (
            <section>
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-700" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">{t('header.status.errorTitle')}</p>
                  <p className="mt-1 max-h-56 select-text overflow-y-auto whitespace-pre-wrap break-words text-sm text-gray-800">{error}</p>
                </div>
              </div>
              <button type="button" onClick={onDismiss} aria-label={t('header.dismissError')} className={secondaryButton}>
                {t('header.status.dismiss')}
              </button>
            </section>
          )}

          {isProcessing && (
            <section className={hasError ? 'mt-4 border-t border-gray-200 pt-4' : ''}>
              <div className="flex items-start gap-3">
                <Loader size={18} className="mt-0.5 shrink-0 animate-spin text-accent-ink motion-reduce:animate-none" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">{t('header.processing')}</p>
                  {statusMessage ? <p className="mt-1 break-words text-sm text-gray-700">{statusMessage}</p> : null}
                  <p className="mt-1 text-xs tabular-nums text-gray-600">{t('header.status.elapsed', { time: elapsed })}</p>
                </div>
              </div>
              <button type="button" onClick={onCancel} className={secondaryButton}>
                {t('header.cancel')}
              </button>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default StatusIndicatorView;
