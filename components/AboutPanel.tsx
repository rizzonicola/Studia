import React from 'react';
import { Link } from 'react-router-dom';
import { Info, ExternalLink } from 'lucide-react';
import pkg from '../package.json';
import { APP_NAME, APP_VERSION, AUTHOR_GITHUB_LABEL, AUTHOR_GITHUB_URL, AUTHOR_NAME, LICENSE_NAME, LICENSE_URL } from '../config/appConfig';
import { useI18n } from '../i18n/I18nProvider';
import type { TranslationKey } from '../i18n/types';

interface LibInfo {
  name: string; // nome del pacchetto npm
  license: string;
  url: string;
  purpose: TranslationKey;
}

const LIBRARIES: LibInfo[] = [
  { name: 'react', license: 'MIT', url: 'https://react.dev', purpose: 'about.purpose.react' },
  { name: 'react-dom', license: 'MIT', url: 'https://react.dev', purpose: 'about.purpose.reactDom' },
  { name: 'react-router-dom', license: 'MIT', url: 'https://reactrouter.com', purpose: 'about.purpose.router' },
  { name: '@google/genai', license: 'Apache-2.0', url: 'https://github.com/googleapis/js-genai', purpose: 'about.purpose.genai' },
  { name: 'lucide-react', license: 'ISC', url: 'https://lucide.dev', purpose: 'about.purpose.lucide' },
  { name: '@dnd-kit/core', license: 'MIT', url: 'https://dndkit.com', purpose: 'about.purpose.dndCore' },
  { name: '@dnd-kit/sortable', license: 'MIT', url: 'https://dndkit.com', purpose: 'about.purpose.dndSortable' },
  { name: '@dnd-kit/utilities', license: 'MIT', url: 'https://dndkit.com', purpose: 'about.purpose.dndUtilities' },
  { name: 'react-markdown', license: 'MIT', url: 'https://github.com/remarkjs/react-markdown', purpose: 'about.purpose.markdown' },
  { name: 'remark-gfm', license: 'MIT', url: 'https://github.com/remarkjs/remark-gfm', purpose: 'about.purpose.gfm' },
  { name: 'remark-math', license: 'MIT', url: 'https://github.com/remarkjs/remark-math', purpose: 'about.purpose.math' },
  { name: 'rehype-katex', license: 'MIT', url: 'https://github.com/remarkjs/remark-math/tree/main/packages/rehype-katex', purpose: 'about.purpose.rehypeKatex' },
  { name: 'katex', license: 'MIT', url: 'https://katex.org', purpose: 'about.purpose.katex' },
  { name: 'react-graph-vis', license: 'MIT', url: 'https://github.com/crubier/react-graph-vis', purpose: 'about.purpose.graphVis' },
  { name: 'idb', license: 'ISC', url: 'https://github.com/jakearchibald/idb', purpose: 'about.purpose.idb' },
  // JSZip è a doppia licenza (MIT oppure GPL-3.0-or-later, a scelta): qui si usa con i termini MIT
  { name: 'jszip', license: 'MIT', url: 'https://stuk.github.io/jszip/', purpose: 'about.purpose.jszip' },
  { name: 'tailwindcss', license: 'MIT', url: 'https://tailwindcss.com', purpose: 'about.purpose.tailwind' },
  { name: '@tailwindcss/typography', license: 'MIT', url: 'https://github.com/tailwindlabs/tailwindcss-typography', purpose: 'about.purpose.typography' },
  { name: 'vite', license: 'MIT', url: 'https://vite.dev', purpose: 'about.purpose.vite' },
  { name: 'typescript', license: 'Apache-2.0', url: 'https://www.typescriptlang.org', purpose: 'about.purpose.typescript' },
];

const allDeps: Record<string, string> = {
  ...((pkg as { dependencies?: Record<string, string> }).dependencies ?? {}),
  ...((pkg as { devDependencies?: Record<string, string> }).devDependencies ?? {}),
};

/** Stesso aspetto dei pulsanti «Termini» e «Privacy» sopra l'elenco delle librerie. */
const linkButtonClass = 'px-4 py-2.5 min-h-11 inline-flex items-center rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50';

const AboutPanel: React.FC = () => {
  const { t } = useI18n();
  return (
    <section id="info" className="bg-surface rounded-xl shadow-xs border border-gray-200 overflow-hidden mb-8 scroll-mt-24">
      <div className="p-6 border-b border-gray-100">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center">
          <Info className="mr-2" size={20} aria-hidden="true" /> {t('about.title')}
        </h2>
      </div>
      <div className="p-6">
        <dl className="flex items-center justify-between text-sm mb-6">
          <dt className="text-gray-600">{t('about.version', { app: APP_NAME })}</dt>
          <dd className="font-mono font-semibold text-gray-900">{APP_VERSION}</dd>
        </dl>

        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">{t('about.authorTitle')}</h3>
          <p className="text-sm text-gray-700">{t('about.authorText', { author: AUTHOR_NAME, license: LICENSE_NAME })}</p>
          <p className="text-xs text-gray-600 mt-2">{t('about.licenseScope')}</p>
          <div className="flex flex-wrap gap-3 mt-3">
            <a href={AUTHOR_GITHUB_URL} target="_blank" rel="author noopener noreferrer" className={linkButtonClass}>
              {AUTHOR_GITHUB_LABEL} <ExternalLink className="w-3.5 h-3.5 ml-2 text-gray-500" aria-hidden="true" />
            </a>
            <a href={LICENSE_URL} target="_blank" rel="license noopener noreferrer" className={linkButtonClass}>
              {t('about.licenseLink')} <ExternalLink className="w-3.5 h-3.5 ml-2 text-gray-500" aria-hidden="true" />
            </a>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mb-6">
          <Link to="/terms" className="px-4 py-2.5 min-h-11 inline-flex items-center rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
            {t('footer.terms')}
          </Link>
          <Link to="/privacy" className="px-4 py-2.5 min-h-11 inline-flex items-center rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
            {t('footer.privacy')}
          </Link>
          {/* Licenze e avvisi di copyright dei pacchetti nel bundle: file generato dalla build (vite.config.ts), disponibile anche offline */}
          <a href="/THIRD-PARTY-NOTICES.txt" target="_blank" rel="noopener noreferrer" className={linkButtonClass}>
            {t('about.noticesLink')} <ExternalLink className="w-3.5 h-3.5 ml-2 text-gray-500" aria-hidden="true" />
          </a>
        </div>

        <h3 className="text-sm font-semibold text-gray-800 mb-2">{t('about.libs')}</h3>
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600 border-b border-gray-200">
                <th scope="col" className="py-2 px-2 font-medium">{t('about.colLib')}</th>
                <th scope="col" className="py-2 px-2 font-medium">{t('about.colVersion')}</th>
                <th scope="col" className="py-2 px-2 font-medium">{t('about.colLicense')}</th>
              </tr>
            </thead>
            <tbody>
              {LIBRARIES.map((lib) => (
                <tr key={lib.name} className="border-b border-gray-100 last:border-0 align-top">
                  <td className="py-2 px-2">
                    <a href={lib.url} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-900 hover:underline inline-flex items-center">
                      {lib.name} <ExternalLink className="w-3 h-3 ml-1 text-gray-500" aria-hidden="true" />
                    </a>
                    <div className="text-xs text-gray-600">{t(lib.purpose)}</div>
                  </td>
                  <td className="py-2 px-2 font-mono text-xs text-gray-700 whitespace-nowrap">{allDeps[lib.name] ?? '—'}</td>
                  <td className="py-2 px-2 text-gray-700 whitespace-nowrap">{lib.license}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-600 mt-4">{t('about.purpose.themeEngine')}</p>
        <p className="text-xs text-gray-600 mt-2">{t('about.notice', { app: APP_NAME })}</p>
      </div>
    </section>
  );
};

export default AboutPanel;
