import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initInstallPrompt, registerPWA } from './pwa';
import { activateLanguage, initI18n } from './i18n/core';
import { I18nProvider } from './i18n/I18nProvider';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}
const root = ReactDOM.createRoot(rootElement);

const render = () =>
  root.render(
    <React.StrictMode>
      <I18nProvider>
        <App />
      </I18nProvider>
    </React.StrictMode>
  );

// Il dizionario della lingua attiva viene caricato PRIMA del primo render: nessun "flash" di testo nella lingua sbagliata
initI18n()
  .catch(() => activateLanguage('en')) // dizionario non raggiungibile: si tenta l'inglese
  .catch(() => undefined) // ultima spiaggia: t() restituisce la chiave, l'app resta utilizzabile
  .finally(render);

// "beforeinstallprompt" scatta presto e una volta sola: va ascoltato fin dall'avvio, non quando si apre Impostazioni
initInstallPrompt();
registerPWA();
