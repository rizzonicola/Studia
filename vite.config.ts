import path from 'path';
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { AUTHOR_GITHUB_URL, AUTHOR_NAME, LICENSE_URL, SITE_URL } from './config/site';
import { generateSeoFiles } from './seo/generate';
import { pruneLegacyKatexFonts } from './config/legacyFonts';
import { collectNotices } from './config/thirdPartyNotices';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

/** Identificativo della build: cambia a ogni build → cache del service worker versionata in automatico. */
const BUILD_ID = `${pkg.version}-${Date.now().toString(36)}`;

/** Elenca ricorsivamente i file di una cartella (percorsi relativi con "/"). */
function listFiles(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full, base) : [path.relative(base, full).split(path.sep).join('/')];
  });
}

/**
 * Plugin "studia-pwa":
 *  - sostituisce i segnaposto di index.html (__SITE_URL__, __AUTHOR_NAME__, __AUTHOR_URL__, __LICENSE_URL__: canonical, Open Graph,
 *    dati strutturati, autore e licenza): dominio e crediti vivono solo in config/site.ts;
 *  - a build finita, inietta nel service worker l'ID di build e l'elenco dei file da precaricare (funzionamento offline);
 *  - genera le pagine informative statiche (/it/, /en/, /fr/ e guide), sitemap.xml (con hreflang) e robots.txt: vedi seo/generate.ts.
 */
/** Segnaposto di index.html → valori di config/site.ts. Un segnaposto sconosciuto resta com'è (tools/seo-check.mjs lo segnala). */
const HTML_PLACEHOLDERS: Record<string, string> = {
  __SITE_URL__: SITE_URL,
  __AUTHOR_NAME__: AUTHOR_NAME,
  __AUTHOR_URL__: AUTHOR_GITHUB_URL,
  __LICENSE_URL__: LICENSE_URL,
};

const studiaPwa = (): Plugin => {
  let outDir = 'dist';
  let root = process.cwd();
  // Lingua → file (con hash) del dizionario i18n, raccolto a bundle pronto: public/theme-init.js ne precarica uno insieme al bundle principale
  let localeChunks: Record<string, string> = {};
  // Moduli finiti davvero nel bundle: servono a ricavare i pacchetti di terze parti per THIRD-PARTY-NOTICES.txt
  let bundledModuleIds: string[] = [];
  return {
    name: 'studia-pwa',
    configResolved(config) {
      root = config.root;
      outDir = path.resolve(config.root, config.build.outDir);
    },
    transformIndexHtml(html) {
      return html.replace(/__[A-Z][A-Z_]*__/g, (placeholder) => HTML_PLACEHOLDERS[placeholder] ?? placeholder);
    },
    generateBundle(_options, bundle) {
      localeChunks = {};
      for (const item of Object.values(bundle)) {
        if (item.type !== 'chunk' || !item.facadeModuleId) continue;
        const match = /[\\/]i18n[\\/]locales[\\/](it|en|fr)\.ts$/.exec(item.facadeModuleId);
        if (match) localeChunks[match[1]] = `/${item.fileName}`;
      }
      bundledModuleIds = [];
      for (const item of Object.values(bundle)) {
        if (item.type !== 'chunk') continue;
        for (const [id, rendered] of Object.entries(item.modules)) if (rendered.renderedLength > 0) bundledModuleIds.push(id);
      }
      // Font KaTeX .woff/.ttf: i browser usano solo il .woff2; si tolgono dal CSS e non si copiano in dist (vedi config/legacyFonts.ts)
      const { kept } = pruneLegacyKatexFonts(bundle);
      if (kept.length > 0) this.warn(`${kept.length} font KaTeX .woff/.ttf sono ancora citati dal CSS e restano in dist: ${kept[0]}…`);
    },
    closeBundle() {
      if (!existsSync(outDir)) return;

      // 0. Avvisi di terze parti (licenze dei pacchetti nel bundle), prima dell'elenco di precache: così finiscono anche offline.
      //    Un errore qui non deve far fallire la build: si segnala e basta.
      try {
        const notices = collectNotices(bundledModuleIds, {
          readText: (file) => (existsSync(file) && statSync(file).isFile() ? readFileSync(file, 'utf-8') : null),
          listDir: (dir) => (existsSync(dir) ? readdirSync(dir) : []),
        });
        if (notices.packages.length > 0) writeFileSync(path.join(outDir, 'THIRD-PARTY-NOTICES.txt'), notices.text);
        if (notices.withoutLicenseFile.length > 0) console.warn(`[studia-pwa] pacchetti senza file di licenza: ${notices.withoutLicenseFile.join(', ')}`);
      } catch (error) {
        console.warn('[studia-pwa] THIRD-PARTY-NOTICES.txt non generato:', error);
      }

      // 1. Service worker: ID di build + precache (JS, CSS, font WOFF2, icone, manifest, avvisi di terze parti)
      const swPath = path.join(outDir, 'service-worker.js');
      if (existsSync(swPath)) {
        const precache = listFiles(outDir)
          .filter((f) => /^assets\/.+\.(js|css|woff2)$/.test(f) || /^icons\/.+\.(png|svg)$/.test(f) || f === 'manifest.json' || f === 'favicon.svg' || f === 'theme-init.js' || f === 'THIRD-PARTY-NOTICES.txt')
          .map((f) => `/${f}`);
        const sw = readFileSync(swPath, 'utf-8')
          .replace(/'__BUILD_ID__'/g, JSON.stringify(BUILD_ID))
          .replace(/'__PRECACHE__'/g, JSON.stringify(precache));
        writeFileSync(swPath, sw);
      }

      // 1b. theme-init.js: al posto del segnaposto va la mappa lingua → dizionario (senza hash nel nome del file di questo script, quindi
      //     niente da aggiornare nel precache). Se la mappa è vuota il precarico non fa nulla.
      const initPath = path.join(outDir, 'theme-init.js');
      if (existsSync(initPath)) {
        writeFileSync(initPath, readFileSync(initPath, 'utf-8').replace(/'__LOCALE_CHUNKS__'/g, () => JSON.stringify(localeChunks)));
      }

      // 2. Pagine informative statiche + sitemap.xml + robots.txt (il build fallisce se testo e rotte non coincidono)
      generateSeoFiles({ outDir, root, siteUrl: SITE_URL });
    },
  };
};

// Nessuna API key nel bundle: la chiave Gemini viene inserita dall'utente a runtime
// e resta solo nel localStorage del suo browser.
export default defineConfig({
  plugins: [react(), tailwindcss(), studiaPwa()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  build: {
    outDir: 'dist', // Cloudflare Pages: "Build output directory" = dist
    sourcemap: false,
    target: 'es2022',
    // vis-network (mappa concettuale) è ~600 kB, ma viene scaricato solo aprendo una mappa: soglia alzata di conseguenza.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Chunk di vendor stabili → restano in cache a lungo tra un deploy e l'altro.
        // Le librerie caricate in lazy (markdown, jszip, ...) vengono separate da Rollup tramite gli import dinamici.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/.test(id)) return 'vendor-react';
          if (id.includes('@google/genai')) return 'vendor-genai';
          if (/[\\/]node_modules[\\/](vis-network|vis-data|vis-util|react-graph-vis|component-emitter|timsort|propagating-hammerjs|keycharm|hammerjs)[\\/]/.test(id)) return 'vendor-vis';
          if (/[\\/]node_modules[\\/]katex[\\/]/.test(id)) return 'vendor-katex';
          if (id.includes('@dnd-kit')) return 'vendor-dnd';
          return undefined;
        },
      },
    },
  },
});
