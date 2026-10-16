import React from 'react';
import { Languages } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { LANGUAGE_NATIVE_NAMES, LanguagePreference, SUPPORTED_LANGUAGES } from '../i18n/resolve';
import Select, { type SelectOption } from './Select';

/**
 * Selettore della lingua (usato nell'onboarding, prima ancora di entrare nelle Impostazioni).
 * Menu personalizzato (components/Select.tsx) al posto del <select> nativo: lo stesso aspetto e lo stesso comportamento
 * degli altri menu dell'app su telefono, tablet e desktop, invece del selettore diverso di ogni sistema.
 */
const LanguageSelect: React.FC = () => {
  const { preference, setPreference, language, t } = useI18n();

  const options: SelectOption<LanguagePreference>[] = [
    {
      value: 'system',
      label: t('settings.language.system'),
      // «In uso: …» solo quando "Sistema" è la scelta attiva: allora la lingua in uso è proprio quella del dispositivo.
      description: preference === 'system' ? t('settings.language.systemInUse', { language: LANGUAGE_NATIVE_NAMES[language] }) : undefined,
    },
    ...SUPPORTED_LANGUAGES.map((l): SelectOption<LanguagePreference> => ({ value: l, label: LANGUAGE_NATIVE_NAMES[l] })),
  ];

  return (
    <Select<LanguagePreference>
      value={preference}
      options={options}
      onChange={setPreference}
      label={t('settings.language.title')}
      icon={<Languages size={16} />}
      className="shrink-0" // accanto a «Passaggio X di Y» e al logo: se manca spazio va a capo il testo, non si accorcia la lingua
    />
  );
};

export default LanguageSelect;
