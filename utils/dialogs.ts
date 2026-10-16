/**
 * Dialoghi personalizzati al posto di window.alert / confirm / prompt.
 *
 * Store minimale a livello di modulo (nessun Context): funziona sia dai componenti sia da codice non-React
 * (es. utils/exportUtils.ts). Il rendering è affidato a <DialogHost /> (components/DialogHost.tsx), montato una volta in App.
 * Le richieste vengono messe in coda e mostrate una alla volta.
 *
 *   if (await confirmDialog({ title, message, tone: 'danger' })) ...
 *   const name = await promptDialog({ title, label });   // string | null (null = annullato)
 *   await alertDialog({ message, tone: 'error' });
 */

export type DialogTone = 'default' | 'danger';
export type AlertTone = 'info' | 'error' | 'success';

interface BaseRequest {
  title?: string;
  message?: string;
}

export interface ConfirmOptions extends BaseRequest {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" = pulsante rosso, il focus iniziale va su "Annulla". */
  tone?: DialogTone;
}

export interface PromptOptions extends BaseRequest {
  label: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  maxLength?: number;
  /** Se il testo non è valido restituisce il messaggio d'errore da mostrare, altrimenti null. Il valore passato è già "trimmato". */
  validate?: (value: string) => string | null;
}

export interface AlertOptions extends BaseRequest {
  message: string;
  okLabel?: string;
  tone?: AlertTone;
}

export type DialogRequest =
  | { id: number; kind: 'confirm'; options: ConfirmOptions; resolve: (v: boolean) => void }
  | { id: number; kind: 'prompt'; options: PromptOptions; resolve: (v: string | null) => void }
  | { id: number; kind: 'alert'; options: AlertOptions; resolve: () => void };

type Listener = () => void;

let queue: readonly DialogRequest[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

const emit = () => listeners.forEach((l) => l());

export const subscribeDialogs = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Dialogo attualmente mostrato (il primo della coda). Riferimento stabile finché la coda non cambia. */
export const getActiveDialog = (): DialogRequest | null => queue[0] ?? null;

/** Chiamata da <DialogHost /> quando il dialogo viene chiuso: risolve la Promise e passa al successivo. */
export const closeActiveDialog = (id: number) => {
  if (queue[0]?.id !== id) return;
  queue = queue.slice(1);
  emit();
};

const enqueue = (request: DialogRequest) => {
  queue = [...queue, request];
  emit();
};

export const confirmDialog = (options: ConfirmOptions): Promise<boolean> =>
  new Promise((resolve) => enqueue({ id: nextId++, kind: 'confirm', options, resolve }));

export const promptDialog = (options: PromptOptions): Promise<string | null> =>
  new Promise((resolve) => enqueue({ id: nextId++, kind: 'prompt', options, resolve }));

export const alertDialog = (options: AlertOptions): Promise<void> =>
  new Promise((resolve) => enqueue({ id: nextId++, kind: 'alert', options, resolve }));
