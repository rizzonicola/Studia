import React from 'react';
import { WifiOff } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

/**
 * Striscia sotto l'intestazione quando manca la connessione: gli appunti sono salvati sul dispositivo e restano consultabili,
 * ma la generazione con l'AI ha bisogno della rete. Il contenitore role="status" esiste sempre (vuoto, alto 0): gli screen reader
 * annunciano il testo quando compare, e l'impaginazione non salta.
 */
const OfflineBanner: React.FC = () => {
  const { t } = useI18n();
  const online = useOnlineStatus();
  return (
    <div role="status">
      {!online && (
        <div className="flex items-start justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 sm:text-sm">
          <WifiOff size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{t('offline.banner')}</span>
        </div>
      )}
    </div>
  );
};

export default OfflineBanner;
