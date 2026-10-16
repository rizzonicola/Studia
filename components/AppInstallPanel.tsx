import React, { useState } from 'react';
import { Check, Download, Share } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { usePwaInstall } from '../hooks/usePwaInstall';

/**
 * Contenuto della sezione «App» in Impostazioni: installare StudIA come app.
 *  - Chrome, Edge, Samsung Internet: pulsante che mostra la finestra di installazione del browser;
 *  - Safari su iPhone/iPad: nessuna finestra disponibile, si spiega il menu Condividi;
 *  - altri browser (o prima che il browser offra l'installazione): si indica il menu del browser;
 *  - già installata: lo si dice e si spiega quando la barra di navigazione di Android prende il colore del tema (non cambia a runtime).
 */
const AppInstallPanel: React.FC = () => {
  const { t } = useI18n();
  const { canInstall, installed, isIos, install } = usePwaInstall();
  const [busy, setBusy] = useState(false);

  const handleInstall = async () => {
    setBusy(true);
    try {
      await install();
    } finally {
      setBusy(false);
    }
  };

  if (installed) {
    return (
      <div className="space-y-3">
        <p role="status" className="flex items-start gap-2 text-sm font-medium text-gray-800">
          <Check size={18} className="mt-0.5 shrink-0 text-accent-ink" aria-hidden="true" />
          {t('settings.app.installed')}
        </p>
        {!isIos && <p className="text-sm text-gray-600">{t('settings.app.barHint')}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">{t('settings.app.desc')}</p>
      {canInstall ? (
        <button
          type="button"
          onClick={handleInstall}
          disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2.5 min-h-11 rounded-lg bg-accent text-accent-fg text-sm font-semibold hover:bg-accent-hover disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          <Download size={18} aria-hidden="true" />
          {t('settings.app.install')}
        </button>
      ) : (
        <p className="flex items-start gap-2 text-sm text-gray-700">
          {isIos ? <Share size={18} className="mt-0.5 shrink-0 text-gray-500" aria-hidden="true" /> : <Download size={18} className="mt-0.5 shrink-0 text-gray-500" aria-hidden="true" />}
          {isIos ? t('settings.app.iosHint') : t('settings.app.browserHint')}
        </p>
      )}
    </div>
  );
};

export default AppInstallPanel;
