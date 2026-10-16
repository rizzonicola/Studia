import React from 'react';
import Logo from './Logo';
import MainNav from './MainNav';
import StatusIndicator from './StatusIndicator';
import { Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';

const Header: React.FC = () => {
  const { t } = useI18n();

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-surface z-50 transition-all duration-200 border-b border-transparent md:border-gray-200">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:shadow-lg"
      >
        {t('nav.skip')}
      </a>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-3 min-h-11 shrink-0">
            <Logo className="w-7 h-7" />
            <span className="font-semibold text-xl text-gray-800">StudIA</span>
          </Link>

          {/* Navigazione desktop: stesse sezioni della barra mobile, ma dentro l'header */}
          <MainNav className="hidden md:flex items-center gap-1 ml-6 lg:ml-10 shrink-0" />

          <div className="flex-1" />

          <div className="flex items-center gap-1 sm:gap-2">
            {/* Elaborazione in corso (rotella) o errore (triangolo): si tocca per i dettagli. Sostituisce le vecchie barre di stato. */}
            <StatusIndicator />
            <Link
              to="/settings"
              className="p-3 rounded-full text-gray-700 hover:bg-gray-100 transition-colors"
              title={t('nav.settings')}
              aria-label={t('nav.settings')}
            >
              <Settings size={20} />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
