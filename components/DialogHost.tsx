import React, { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { CircleAlert, CircleCheck, Info, Pencil, TriangleAlert } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { closeActiveDialog, getActiveDialog, subscribeDialogs, type DialogRequest } from '../utils/dialogs';

/**
 * Mostra i dialoghi richiesti con confirmDialog / promptDialog / alertDialog (utils/dialogs.ts).
 * Va montato UNA volta, dentro I18nProvider e ThemeProvider. Il rendering avviene in un portale su <body>,
 * quindi resta fuori dall'area resa "inert" da OnboardingGate.
 */
const DialogHost: React.FC = () => {
  const active = useSyncExternalStore(subscribeDialogs, getActiveDialog, getActiveDialog);
  if (!active) return null;
  // key = id: ogni richiesta ha il proprio stato (testo digitato, errori) e il proprio ciclo di focus
  return createPortal(<DialogView key={active.id} request={active} />, document.body);
};

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])';

const DialogView: React.FC<{ request: DialogRequest }> = ({ request }) => {
  const { t } = useI18n();
  const uid = useId();
  const titleId = `${uid}-title`;
  const descId = `${uid}-desc`;
  const errorId = `${uid}-error`;

  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef(false);

  const initialValue = request.kind === 'prompt' ? request.options.initialValue ?? '' : '';
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  const isDanger = (request.kind === 'confirm' && request.options.tone === 'danger') || (request.kind === 'alert' && request.options.tone === 'error');

  /** Chiude il dialogo una sola volta (evita doppi click / Invio + click). */
  const finish = (result: boolean | string | null) => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (request.kind === 'confirm') request.resolve(result === true);
    else if (request.kind === 'prompt') request.resolve(typeof result === 'string' ? result : null);
    else request.resolve();
    closeActiveDialog(request.id);
  };
  const cancel = () => finish(request.kind === 'confirm' ? false : null);

  // Resta sempre aggiornato l'ultimo "cancel" per i listener registrati una volta sola
  const cancelRefFn = useRef(cancel);
  cancelRefFn.current = cancel;

  // Modale: blocca scroll e interazione con l'app sotto, sposta il focus nel dialogo e lo ripristina alla chiusura
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const root = document.getElementById('root');
    const wasInert = root?.inert ?? false;
    const previousOverflow = document.body.style.overflow;
    if (root) root.inert = true;
    document.body.style.overflow = 'hidden';

    // Azione distruttiva: il focus parte su "Annulla" (un Invio distratto non cancella nulla)
    const target =
      request.kind === 'prompt' ? inputRef.current : isDanger && request.kind === 'confirm' ? cancelRef.current : primaryRef.current;
    target?.focus();
    if (request.kind === 'prompt') inputRef.current?.select();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation(); // non deve chiudere anche altro (es. schermo intero degli appunti)
        cancelRefFn.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement as HTMLElement | null;
      const inside = !!current && panel.contains(current);
      if (e.shiftKey && (!inside || current === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || current === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (root) root.inert = wasInert;
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (request.kind !== 'prompt') return;
    const trimmed = value.trim();
    const problem = trimmed === '' ? t('dialog.required') : request.options.validate?.(trimmed) ?? null;
    if (problem) {
      setError(problem);
      inputRef.current?.focus();
      return;
    }
    finish(trimmed);
  };

  const onBackdropMouseDown = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    // Mentre si sta scrivendo un nome, un tocco fuori dal riquadro non deve far perdere il testo
    if (request.kind === 'prompt' && value !== initialValue) return;
    cancel();
  };

  // --- Testi e icona in base al tipo ---
  const options = request.options;
  let title: string;
  let icon: React.ReactNode;
  if (request.kind === 'confirm') {
    title = options.title ?? t('dialog.confirmTitle');
    icon = isDanger ? <TriangleAlert className="w-5 h-5" /> : <Info className="w-5 h-5" />;
  } else if (request.kind === 'prompt') {
    title = options.title ?? request.options.label;
    icon = <Pencil className="w-5 h-5" />;
  } else {
    const tone = request.options.tone ?? 'info';
    title = options.title ?? t(tone === 'error' ? 'dialog.errorTitle' : tone === 'success' ? 'dialog.successTitle' : 'dialog.infoTitle');
    icon = tone === 'error' ? <CircleAlert className="w-5 h-5" /> : tone === 'success' ? <CircleCheck className="w-5 h-5" /> : <Info className="w-5 h-5" />;
  }
  const message = options.message;

  const primaryClass = isDanger
    ? 'bg-danger text-white hover:bg-danger-hover'
    : 'bg-accent text-accent-fg hover:bg-accent-hover';
  const buttonBase = 'min-h-11 px-5 rounded-full text-sm font-semibold transition-colors active:scale-[0.98]';

  const primaryLabel =
    request.kind === 'alert'
      ? request.options.okLabel ?? t('dialog.ok')
      : request.options.confirmLabel ?? (request.kind === 'prompt' ? t('common.save') : t('dialog.confirm'));
  const cancelLabel = request.kind === 'alert' ? null : request.options.cancelLabel ?? t('common.cancel');

  const buttons = (
    <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
      {cancelLabel && (
        <button
          ref={cancelRef}
          type="button"
          onClick={cancel}
          className={`${buttonBase} border border-gray-300 bg-surface text-gray-700 hover:bg-gray-100`}
        >
          {cancelLabel}
        </button>
      )}
      <button
        ref={primaryRef}
        type={request.kind === 'prompt' ? 'submit' : 'button'}
        onClick={request.kind === 'prompt' ? undefined : () => finish(true)}
        className={`${buttonBase} ${primaryClass}`}
      >
        {primaryLabel}
      </button>
    </div>
  );

  const header = (
    <div className="flex items-start gap-4">
      <span
        aria-hidden="true"
        className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center ${isDanger ? 'bg-danger/10 text-danger' : 'bg-accent-soft text-accent-ink'}`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <h2 id={titleId} className="text-lg font-semibold text-gray-900 leading-snug break-words">
          {title}
        </h2>
        {message && (
          <p id={descId} className="mt-1 text-sm text-gray-600 whitespace-pre-line break-words">
            {message}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs sm:p-6 animate-dialog-fade"
      onMouseDown={onBackdropMouseDown}
    >
      <div
        ref={panelRef}
        role={request.kind === 'prompt' || (request.kind === 'confirm' && !isDanger) ? 'dialog' : 'alertdialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? descId : undefined}
        className="w-full sm:max-w-md max-h-[90dvh] overflow-y-auto bg-surface text-fg border border-gray-200 shadow-2xl rounded-t-3xl sm:rounded-2xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6 animate-dialog-in"
      >
        {request.kind === 'prompt' ? (
          <form onSubmit={submitPrompt} noValidate>
            {header}
            <div className="mt-4">
              <label htmlFor={`${uid}-input`} className="block text-xs font-semibold text-gray-600 mb-1.5 px-1">
                {request.options.label}
              </label>
              <input
                id={`${uid}-input`}
                ref={inputRef}
                type="text"
                value={value}
                maxLength={request.options.maxLength}
                placeholder={request.options.placeholder}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (error) setError(null);
                }}
                autoComplete="off"
                autoCapitalize="sentences"
                enterKeyHint="done"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                className={`w-full min-h-11 px-3 py-2 text-base sm:text-sm border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-accent-ink focus:border-transparent ${error ? 'border-danger' : 'border-gray-300'}`}
              />
              <p id={errorId} role="alert" className={`mt-1.5 px-1 text-xs text-danger ${error ? '' : 'hidden'}`}>
                {error}
              </p>
            </div>
            {buttons}
          </form>
        ) : (
          <>
            {header}
            {buttons}
          </>
        )}
      </div>
    </div>
  );
};

export default DialogHost;
