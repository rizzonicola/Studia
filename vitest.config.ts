import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

/**
 * Configurazione dei test (solo `npm test`): `vite build` e `vite` NON la leggono, quindi non pesa sull'app né sulla SEO.
 * Non carica i plugin di vite.config.ts (Tailwind, service worker, SEO): i test sono su logica pura e non servono.
 */
export default defineConfig({
  // Stesso `define` di vite.config.ts: config/appConfig.ts legge __APP_VERSION__, che esiste solo se la definisce Vite.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // Stesso alias "@" di vite.config.ts e tsconfig.json
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  // JSX automatico (come "jsx": "react-jsx" in tsconfig.json): i test fanno il render di componenti con renderToStaticMarkup
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
