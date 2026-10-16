import React from 'react';
import { useAIProcessor } from '../hooks/useAIProcessor';
import { useI18n } from '../i18n/I18nProvider';
import StatusIndicatorView from './StatusIndicatorView';

/** Stato globale dell'elaborazione AI (rotella / triangolo di errore) nell'intestazione: vedi StatusIndicatorView. */
const StatusIndicator: React.FC = () => {
  const { isProcessing, statusMessage, error, dismissError, cancelProcessing } = useAIProcessor();
  const { t } = useI18n();
  return <StatusIndicatorView isProcessing={isProcessing} statusMessage={statusMessage} error={error} onCancel={cancelProcessing} onDismiss={dismissError} t={t} />;
};

export default StatusIndicator;
