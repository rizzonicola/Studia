import React from 'react';
import ReactMarkdown from 'react-markdown';
import { REMARK_PLUGINS, REHYPE_PLUGINS, MARKDOWN_COMPONENTS } from '../utils/markdownMath';
import { normalizeMath } from '../utils/normalizeMath';
import { useTheme } from '../hooks/useTheme';
import { READER_SIZE_CLASS } from '../config/themes';

/** Visualizza un appunto Markdown (con tabelle e formule). Caricato in lazy da NoteDetailPage. */
const MarkdownView: React.FC<{ content: string }> = ({ content }) => {
  const normalized = React.useMemo(() => normalizeMath(content), [content]);
  const { config } = useTheme();
  return (
    <div className={`${READER_SIZE_CLASS[config.readerSize]} reader`}>
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS} components={MARKDOWN_COMPONENTS}>
        {normalized}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownView;
