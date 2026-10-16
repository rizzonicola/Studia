import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../i18n/I18nProvider';

interface MainNavProps {
  /** Classi del <nav>: chi lo usa decide dove e quando mostrarlo (es. "hidden md:flex" nell'header). */
  className?: string;
}

/**
 * Sezioni principali (Appunti, Carica, Fotocamera).
 * Un solo componente, due posizioni: sotto l'header su mobile (App.tsx → SubHeaderNav) e dentro l'header da `md` in su.
 * Quello nascosto con display:none esce dall'albero di accessibilità, quindi la landmark non viene duplicata.
 */
const MainNav: React.FC<MainNavProps> = ({ className = 'flex items-center space-x-2' }) => {
  const { getThemeClasses } = useTheme();
  const { t } = useI18n();
  const theme = getThemeClasses();

  const base = 'px-3 py-2.5 min-h-11 inline-flex items-center rounded-full text-sm font-medium transition-colors';
  const cls = ({ isActive }: { isActive: boolean }) =>
    `${base} ${isActive ? `${theme.bgSoft} ${theme.text}` : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`;

  return (
    <nav aria-label={t('nav.main')} className={className}>
      <NavLink to="/" end className={cls}>{t('nav.notes')}</NavLink>
      <NavLink to="/upload" className={cls}>{t('nav.upload')}</NavLink>
      <NavLink to="/camera" className={cls}>{t('nav.camera')}</NavLink>
    </nav>
  );
};

export default MainNav;
