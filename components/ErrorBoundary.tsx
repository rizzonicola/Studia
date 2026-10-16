import React from 'react';
import { t } from '../i18n/core';

interface Props {
  children: React.ReactNode;
  /** Quando cambia (es. il percorso della pagina) un errore precedente viene dimenticato e si riprova a mostrare il contenuto. */
  resetKey?: string;
}

interface State {
  failed: boolean;
  chunk: boolean;
}

/** Errore di caricamento di un file dell'app (rete assente, nuova versione pubblicata): i messaggi dei browser sono diversi. */
export const isChunkLoadError = (error: unknown): boolean => {
  const name = typeof error === 'object' && error !== null ? String((error as { name?: unknown }).name ?? '') : '';
  const message = error instanceof Error ? error.message : String(error ?? '');
  return (
    name === 'ChunkLoadError' ||
    /dynamically imported module|importing a module script failed|error loading dynamically imported module|loading chunk|failed to fetch/i.test(message)
  );
};

/**
 * Intercetta gli errori di rendering e di caricamento dei chunk e propone di ricaricare.
 * Si ripristina da sola al cambio di `resetKey`: prima, dopo un errore, anche passando a un'altra pagina dal menu (fuori dal
 * confine) restava il messaggio d'errore fino al ricaricamento manuale.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { failed: false, chunk: false };

  static getDerivedStateFromError(error: unknown): State {
    return { failed: true, chunk: isChunkLoadError(error) };
  }

  componentDidCatch(error: unknown) {
    console.error('UI error boundary', error);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.failed && prevProps.resetKey !== this.props.resetKey) this.setState({ failed: false, chunk: false });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-gray-800 mb-6">{t(this.state.chunk ? 'app.chunkError' : 'app.renderError')}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 min-h-11 rounded-lg bg-accent text-accent-fg font-semibold hover:bg-accent-hover"
        >
          {t('app.reload')}
        </button>
      </div>
    );
  }
}
