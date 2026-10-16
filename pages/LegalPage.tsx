import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PrivacyContent, TermsContent } from '../legal/LegalDocuments';
import { useI18n } from '../i18n/I18nProvider';

const LegalPage: React.FC<{ type: 'terms' | 'privacy' }> = ({ type }) => {
  const { t } = useI18n();
  const other = type === 'terms' ? { to: '/privacy', label: t('footer.privacy') } : { to: '/terms', label: t('footer.terms') };
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link to="/settings" className="inline-flex items-center min-h-11 text-sm text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeft size={16} className="mr-1" aria-hidden="true" /> {t('legal.back')}
      </Link>
      <div className="bg-surface rounded-xl shadow-xs border border-gray-200 p-6 sm:p-8">
        {type === 'terms' ? <TermsContent /> : <PrivacyContent />}
      </div>
      <p className="mt-6 text-sm text-gray-600">
        {t('legal.alsoRead')}{' '}
        <Link to={other.to} className="text-accent-ink underline">
          {other.label}
        </Link>
      </p>
    </div>
  );
};

export default LegalPage;
