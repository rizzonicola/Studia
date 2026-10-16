/**
 * Registrazione del service worker e gestione degli aggiornamenti "non distruttiva".
 *
 * Il nuovo service worker resta in attesa (non usa skipWaiting da solo) e viene attivato SOLO quando
 * nessuna generazione AI è in corso (vedi beginBusy). L'attivazione NON ricarica la pagina:
 * la sessione aperta continua a funzionare (il SW tiene in cache anche la versione precedente
 * per i file caricati in lazy) e la nuova versione parte alla prossima apertura/navigazione.
 */

/** Distanza minima fra due controlli di aggiornamento innescati dal ritorno nella scheda o dal ritorno online. */
const MIN_CHECK_INTERVAL_MS = 10 * 60 * 1000;

let busyCount = 0;
let waitingWorker: ServiceWorker | null = null;

const activateWaiting = () => {
  if (busyCount === 0 && waitingWorker) {
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    waitingWorker = null;
  }
};

/** Segna l'inizio di un lavoro da non interrompere. Restituisce la funzione da chiamare al termine. */
export const beginBusy = (): (() => void) => {
  busyCount++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    busyCount = Math.max(0, busyCount - 1);
    activateWaiting();
  };
};

// Registra il service worker solo in produzione (in dev interferirebbe con l'HMR di Vite).
export const registerPWA = () => {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  const trackInstalling = (registration: ServiceWorkerRegistration) => {
    const worker = registration.installing;
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      // "installed" con un controller già attivo = è un aggiornamento (non la prima installazione)
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        waitingWorker = worker;
        activateWaiting();
      }
    });
  };

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js', { scope: '/', updateViaCache: 'none' })
      .then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          waitingWorker = registration.waiting;
          activateWaiting();
        }
        // Un aggiornamento può essere già in installazione ora (lo scatto di "updatefound" è avvenuto prima del nostro ascolto)
        if (registration.installing) trackInstalling(registration);
        registration.addEventListener('updatefound', () => trackInstalling(registration));

        // Controllo degli aggiornamenti: ogni ora e al ritorno nella scheda, ma non più di una volta ogni 10 minuti
        // e mai senza rete (sarebbe una richiesta destinata a fallire).
        let lastCheck = Date.now();
        const check = (force = false) => {
          if (navigator.onLine === false) return;
          if (!force && Date.now() - lastCheck < MIN_CHECK_INTERVAL_MS) return;
          lastCheck = Date.now();
          registration.update().catch(() => undefined);
        };
        setInterval(() => check(true), 60 * 60 * 1000);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') check();
        });
        window.addEventListener('online', () => check());
      })
      .catch((error) => console.warn('Service Worker registration failed:', error));
  });
};

// ---------------------------------------------------------------------------------------------------------------------
// Installazione dell'app
// ---------------------------------------------------------------------------------------------------------------------

/** Evento "beforeinstallprompt": non è ancora nei tipi DOM (Chromium: Chrome, Edge, Samsung Internet, Opera). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface InstallSnapshot {
  /** Il browser offre l'installazione e si può avviare dal pulsante dell'app (Impostazioni → App). */
  canInstall: boolean;
  /** L'app sta girando come app installata (finestra propria) oppure è stata appena installata. */
  installed: boolean;
}

let installEvent: BeforeInstallPromptEvent | null = null;
let installSnapshot: InstallSnapshot = { canInstall: false, installed: false };
const installListeners = new Set<() => void>();

/** Vero se la pagina gira come app installata (Android/desktop: display-mode; iOS: navigator.standalone). */
export const isRunningInstalled = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia === 'function') {
    for (const mode of ['standalone', 'minimal-ui', 'window-controls-overlay']) {
      if (window.matchMedia(`(display-mode: ${mode})`).matches) return true;
    }
  }
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
};

/** iPhone, iPad (anche quando si presenta come Mac) e iPod: lì non esiste "beforeinstallprompt", si installa dal menu Condividi di Safari. */
export const isIosDevice = (): boolean =>
  typeof navigator !== 'undefined' && (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

const publishInstallState = (patch: Partial<InstallSnapshot> = {}) => {
  const next: InstallSnapshot = {
    canInstall: patch.canInstall ?? installEvent !== null,
    installed: patch.installed ?? (installSnapshot.installed || isRunningInstalled()),
  };
  if (next.canInstall === installSnapshot.canInstall && next.installed === installSnapshot.installed) return;
  installSnapshot = next; // nuovo oggetto solo se qualcosa cambia: serve a useSyncExternalStore
  installListeners.forEach((listener) => listener());
};

/**
 * Da chiamare subito all'avvio (index.tsx): "beforeinstallprompt" scatta una volta sola e presto, spesso prima che la pagina Impostazioni
 * esista. Lo si conserva qui; chi vuole il pulsante "Installa app" si iscrive con subscribeInstall (hook usePwaInstall).
 */
export const initInstallPrompt = () => {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // niente banner del browser: l'installazione parte dal pulsante in Impostazioni → App
    installEvent = event as BeforeInstallPromptEvent;
    publishInstallState({ canInstall: true });
  });
  window.addEventListener('appinstalled', () => {
    installEvent = null;
    publishInstallState({ canInstall: false, installed: true });
  });
  // La modalità di visualizzazione può cambiare con l'app aperta (es. «Apri nell'app» dal menu del browser)
  if (typeof window.matchMedia === 'function') {
    window.matchMedia('(display-mode: standalone)').addEventListener?.('change', () => publishInstallState());
  }
  publishInstallState();
};

export const getInstallSnapshot = (): InstallSnapshot => installSnapshot;

export const subscribeInstall = (listener: () => void): (() => void) => {
  installListeners.add(listener);
  return () => {
    installListeners.delete(listener);
  };
};

/** Mostra la finestra di installazione del browser. Va chiamata da un tocco/clic dell'utente. */
export const promptInstall = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
  const event = installEvent;
  if (!event) return 'unavailable';
  installEvent = null; // l'evento si può usare una volta sola
  publishInstallState({ canInstall: false });
  try {
    await event.prompt();
    return (await event.userChoice).outcome;
  } catch {
    return 'unavailable';
  }
};
