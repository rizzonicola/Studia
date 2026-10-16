import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';

/**
 * Indirizzo inesistente. Prima ogni percorso sconosciuto mostrava la home con stato 200 (contenuto duplicato all'infinito per i motori di ricerca):
 * ora mostra un messaggio chiaro e DocumentMeta la marca noindex.
 */
const NotFoundPage: React.FC = () => {
  const { t } = useI18n();
  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
      <h1 className="text-2xl font-bold text-gray-900">{t('notFound.title')}</h1>
      <p className="mt-3 text-gray-600">{t('notFound.body')}</p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center justify-center min-h-11 px-5 rounded-lg bg-accent text-accent-fg font-semibold hover:bg-accent-hover transition-colors"
      >
        {t('notFound.home')}
      </Link>
    </div>
  );
};

export default NotFoundPage;
