// Pagina di prova per status-indicator-check.mjs: monta StatusIndicatorView (quello vero) in un'intestazione fissa con le schede sotto,
// come nell'app. Lo stato si cambia dalla prova con window.__setState({...}); i clic su Annulla/Chiudi si contano in window.__calls.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import StatusIndicatorView from '../../components/StatusIndicatorView';

interface State { isProcessing: boolean; statusMessage: string; error: string | null }
declare global {
  interface Window {
    __setState: (patch: Partial<State>) => void;
    __calls: { cancel: number; dismiss: number };
  }
}
window.__calls = { cancel: 0, dismiss: 0 };

const TEXT: Record<string, string> = {
  'header.processing': 'Processing...',
  'header.cancel': 'Cancel processing',
  'header.dismissError': 'Dismiss error message',
  'header.status.processingLabel': 'Processing: tap for details',
  'header.status.errorLabel': 'Error: tap to see the details',
  'header.status.panelLabel': 'Processing status',
  'header.status.elapsed': 'Running for {time}',
  'header.status.errorTitle': 'Something went wrong',
  'header.status.dismiss': 'Dismiss',
};
const t = (key: string, params?: Record<string, string | number>) => (TEXT[key] ?? key).replace(/\{(\w+)\}/g, (_, k: string) => String(params?.[k] ?? ''));

function Demo() {
  const [state, setState] = useState<State>({ isProcessing: false, statusMessage: '', error: null });
  window.__setState = (patch) => setState((prev) => ({ ...prev, ...patch }));
  return (
    <>
      <header className="hdr">
        <div className="hdr-inner">
          <b>StudIA</b>
          <div style={{ flex: 1 }} />
          <div className="flex items-center gap-1 sm:gap-2">
            <StatusIndicatorView
              isProcessing={state.isProcessing}
              statusMessage={state.statusMessage}
              error={state.error}
              onCancel={() => { window.__calls.cancel++; }}
              onDismiss={() => { window.__calls.dismiss++; }}
              t={t as never}
            />
            <a href="#settings" className="gear" data-testid="settings">⚙</a>
          </div>
        </div>
      </header>
      <nav className="subnav" data-testid="subnav">
        <button>Notes</button>
        <button>Upload</button>
        <button>Camera</button>
      </nav>
      <main className="content">Contenuto della pagina</main>
    </>
  );
}
createRoot(document.getElementById('root')!).render(<Demo />);
