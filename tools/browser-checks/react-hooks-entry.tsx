// Ingresso della pagina di prova per react-hooks-check.mjs: monta i VERI SettingsProvider, ThemeProvider ed ErrorBoundary.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SettingsProvider, useSettings } from '../../hooks/useSettings';
import { ThemeProvider, useTheme } from '../../hooks/useTheme';
import ErrorBoundary from '../../components/ErrorBoundary';

// Conta le scritture reali su localStorage (setItem), per chiave
const writes: Record<string, number> = {};
const originalSetItem = Storage.prototype.setItem;
Storage.prototype.setItem = function (key: string, value: string) {
  writes[key] = (writes[key] ?? 0) + 1;
  return originalSetItem.call(this, key, value);
};
(window as any).__writes = writes;

const Probe = () => {
  const settings = useSettings();
  const theme = useTheme();
  useEffect(() => {
    (window as any).__settings = settings;
    (window as any).__theme = theme;
  });
  return null;
};

const Bomb = ({ kind }: { kind: 'render' | 'chunk' | 'ok' }) => {
  if (kind === 'render') throw new Error('errore di rendering');
  if (kind === 'chunk') throw new TypeError('Failed to fetch dynamically imported module: x');
  return <p>contenuto ok</p>;
};

const Boundary = () => {
  const [state, setState] = useState<{ path: string; kind: 'render' | 'chunk' | 'ok' }>({ path: '/a', kind: 'render' });
  (window as any).__go = (path: string, kind: 'render' | 'chunk' | 'ok') => setState({ path, kind });
  return (
    <div id="boundary">
      <ErrorBoundary resetKey={state.path}>
        <Bomb kind={state.kind} />
      </ErrorBoundary>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <SettingsProvider>
    <ThemeProvider>
      <Probe />
      <Boundary />
    </ThemeProvider>
  </SettingsProvider>
);
