// Pagina di prova per select-check.mjs: monta components/Select (quello vero) in vari punti dello schermo.
// Le opzioni arrivano da window.__opts = { layout, many, tall }; le scelte fatte si accumulano in window.__changes.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Languages } from 'lucide-react';
import Select, { type SelectOption } from '../../components/Select';

declare global {
  interface Window {
    __opts: { layout: string; many?: boolean; tall?: boolean };
    __changes: string[];
  }
}
window.__changes = [];

const LANGUAGES: SelectOption<string>[] = [
  { value: 'system', label: 'Sistema', description: 'In uso: Italiano' },
  { value: 'it', label: 'Italiano' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
];

function Demo() {
  const { layout, many, tall } = window.__opts;
  const [value, setValue] = useState('system');
  const options = many ? Array.from({ length: 30 }, (_, i) => ({ value: `o${i}`, label: `Voce ${i + 1}` })) : LANGUAGES;
  const select = (
    <Select
      value={value}
      options={options}
      onChange={(v) => { window.__changes.push(v); setValue(v); }}
      label="Lingua / Language / Langue"
      icon={<Languages size={16} />}
    />
  );
  if (layout === 'dialog' || layout === 'dialog-bottom') {
    // Imita il dialogo di benvenuto: overflow-hidden, angoli arrotondati, transform (animazione) e sfondo sfocato
    return (
      <div className="overlay">
        <div className="dialog" data-testid="dialog" role="dialog" aria-modal="true">
          <div className="dlg-head">
            <b>StudIA</b>
            {layout === 'dialog' ? select : null}
          </div>
          <div className="dlg-body">
            {Array.from({ length: tall ? 14 : 3 }, (_, i) => <div key={i}>Contenuto del dialogo di benvenuto…</div>)}
          </div>
          {layout === 'dialog-bottom' ? <div className="dlg-foot">{select}</div> : null}
        </div>
      </div>
    );
  }
  return <div className={`pos-${layout}`}>{select}</div>;
}

createRoot(document.getElementById('root')!).render(<Demo />);
