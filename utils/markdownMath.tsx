import type { Components } from 'react-markdown';
import type { PluggableList } from 'unified';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

/**
 * Questo modulo è importato SOLO da components/MarkdownView.tsx, che a sua volta è caricato in lazy:
 * KaTeX (JS, CSS e font) e i plugin remark/rehype non fanno parte del download iniziale.
 *
 * Sicurezza: NON si usa rehype-raw → l'HTML grezzo scritto nel Markdown viene mostrato come testo, mai interpretato.
 */

/** Plugin per react-markdown: tabelle GFM + formule LaTeX ($...$ e $$...$$) renderizzate con KaTeX. */
export const REMARK_PLUGINS: PluggableList = [remarkGfm, remarkMath];
export const REHYPE_PLUGINS: PluggableList = [
  // throwOnError:false → una formula errata resta visibile come testo rosso invece di rompere la pagina
  [rehypeKatex, { throwOnError: false, strict: 'ignore', output: 'htmlAndMathml' }],
];

export const MARKDOWN_COMPONENTS: Components = {
  // Le tabelle larghe scorrono in orizzontale invece di uscire dallo schermo
  table: ({ node: _node, ...props }) => (
    <div className="overflow-x-auto">
      <table {...props} />
    </div>
  ),
  // I link esterni si aprono in una nuova scheda senza passare l'opener né il referrer
  a: ({ node: _node, href, children, ...props }) => (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" {...props}>
      {children}
    </a>
  ),
};
