// Ingresso della pagina di prova: monta il VERO AIProcessorProvider (React reale) con le dipendenze sostituite da stub.
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
// @ts-expect-error il percorso viene riscritto da ai-task-check.mjs (--root) per provare anche la versione originale
import { AIProcessorProvider, useAIProcessor } from '__HOOK__';

const Probe = () => {
  const ctx = useAIProcessor();
  useEffect(() => { (window as any).__ai = ctx; });
  return null;
};
createRoot(document.getElementById('root')!).render(<AIProcessorProvider><Probe /></AIProcessorProvider>);
