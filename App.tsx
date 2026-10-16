import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, useLocation } from 'react-router-dom';
import Header from './components/Header';
import MainNav from './components/MainNav';
import NotesPage from './pages/NotesPage';
import Footer from './components/Footer';
import OnboardingGate from './components/OnboardingGate';
import DocumentMeta from './components/DocumentMeta';
import ErrorBoundary from './components/ErrorBoundary';
import { NotesProvider } from './hooks/useNotesStore';
import { SettingsProvider } from './hooks/useSettings';
import { ThemeProvider } from './hooks/useTheme';
import { AIProcessorProvider } from './hooks/useAIProcessor';
import { useI18n } from './i18n/I18nProvider';
import DialogHost from './components/DialogHost';
import StorageNotifier from './components/StorageNotifier';
import OfflineBanner from './components/OfflineBanner';
import { loadLegalPage } from './legal/legalRoute';
import { preloadMarkdownView } from './components/markdownViewModule';

// Code splitting per route: ogni pagina (e le librerie pesanti che usa) viene scaricata solo quando serve
const FolderPage = lazy(() => import('./pages/FolderPage'));
// La pagina dell'appunto attende anche MarkdownView (in parallelo): niente fallback annidato al primo appunto. Se il suo download fallisce
// non blocca la pagina: la gestisce NoteDetailPage (nuovo tentativo al prossimo accesso).
const NoteDetailPage = lazy(() =>
  Promise.all([import('./pages/NoteDetailPage'), preloadMarkdownView().catch(() => undefined)]).then(([page]) => page)
);
const UploadPage = lazy(() => import('./pages/UploadPage'));
const CameraPage = lazy(() => import('./pages/CameraPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const LegalPage = lazy(loadLegalPage); // pagina + testo della lingua attiva insieme (vedi legal/legalRoute.ts)
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

const PageFallback: React.FC = () => {
  const { t } = useI18n();
  return (
    <div role="status" className="py-16 text-center text-sm text-gray-500">
      {t('app.loadingPage')}
    </div>
  );
};

/** Mobile: le sezioni stanno in una barra sotto l'header. Da `md` in su vivono nell'header (components/Header.tsx). */
const SubHeaderNav = () => (
  <div className="md:hidden sticky top-16 bg-surface z-30 transition-all duration-200 border-none shadow-none">
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
      <MainNav className="flex items-center space-x-2 py-1" />
    </div>
  </div>
);

const MainPagesLayout = () => (
  <>
    <SubHeaderNav />
    <Outlet />
  </>
);

// Riporta la pagina in cima ad ogni cambio di route (con eccezione delle ancore, gestite dalla pagina)
const ScrollToTop = () => {
  const { pathname } = useLocation();
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const AppLayout = () => {
  // Cambiando pagina, un eventuale errore mostrato dal confine d'errore viene dimenticato
  const { pathname } = useLocation();
  return (
  <div className="app-shell bg-gray-50 min-h-dvh font-sans flex flex-col">
    <ScrollToTop />
    <Header />
    <main id="main" className="w-full pt-16 flex-1 flex flex-col [&>*]:w-full">
      <OfflineBanner />
      <ErrorBoundary resetKey={pathname}>
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </ErrorBoundary>
    </main>
    <Footer />
  </div>
  );
};

const App: React.FC = () => {
  return (
    <SettingsProvider>
      <ThemeProvider>
        <DialogHost />
        <StorageNotifier />
        <NotesProvider>
          <Router>
            <DocumentMeta />
            <AIProcessorProvider>
              <OnboardingGate>
                <Routes>
                  <Route path="/" element={<AppLayout />}>
                    <Route element={<MainPagesLayout />}>
                      <Route index element={<NotesPage />} />
                      <Route path="upload" element={<UploadPage />} />
                      <Route path="camera" element={<CameraPage />} />
                    </Route>
                    <Route path="folder/:folderId" element={<FolderPage />} />
                    <Route path="note/:id" element={<NoteDetailPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="terms" element={<LegalPage type="terms" />} />
                    <Route path="privacy" element={<LegalPage type="privacy" />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                </Routes>
              </OnboardingGate>
            </AIProcessorProvider>
          </Router>
        </NotesProvider>
      </ThemeProvider>
    </SettingsProvider>
  );
};

export default App;
