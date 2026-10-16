import React, { useRef, useState } from 'react';
import { Check, Download, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../i18n/I18nProvider';
import type { TranslationKey } from '../i18n/types';
import {
  ACCENT_HEX,
  AccentChoice,
  CARD_SIZE_IDS,
  FONT_IDS,
  FONT_SCALE_MAX,
  FONT_SCALE_MIN,
  LETTER_SPACING_IDS,
  LINE_HEIGHT_IDS,
  MAX_SAVED_THEMES,
  MAX_THEME_NAME,
  MOTION_IDS,
  NOTE_TINT_MAX,
  NOTE_TINT_MIN,
  PATTERN_IDS,
  PRESETS,
  RADIUS_IDS,
  READER_FONT_IDS,
  READER_SIZE_CLASS,
  READER_SIZE_IDS,
  READER_WIDTH_IDS,
  Scheme,
  THEME_COLORS,
  ThemeColor,
  TOKEN_KEYS,
  TokenKey,
  findPreset,
  sanitizeThemeConfig,
} from '../config/themes';
import { MAX_IMPORT_BYTES } from '../config/appConfig';
import { computeTheme, textContrast } from '../utils/themeEngine';
import { normalizeHex, readableOn } from '../utils/color';
import { downloadFile } from '../utils/download';
import { generateUniqueId } from '../utils/helpers';
import { confirmDialog } from '../utils/dialogs';

// ---------------------------------------------------------------------------------------------------------------------
// Mattoncini riutilizzabili
// ---------------------------------------------------------------------------------------------------------------------

const Group: React.FC<{ title: string; defaultOpen?: boolean; children: React.ReactNode }> = ({ title, defaultOpen = false, children }) => (
  <details open={defaultOpen} className="group border-t border-gray-200 first:border-t-0 py-1">
    <summary className="flex items-center justify-between cursor-pointer select-none min-h-11 py-2 text-base font-semibold text-gray-800 list-none [&::-webkit-details-marker]:hidden">
      {title}
      <span aria-hidden="true" className="ml-2 text-gray-500 transition-transform group-open:rotate-180">▾</span>
    </summary>
    <div className="pb-4 space-y-5">{children}</div>
  </details>
);

const FieldLabel: React.FC<{ id?: string; children: React.ReactNode }> = ({ id, children }) => (
  <p id={id} className="text-sm font-medium text-gray-800 mb-2">
    {children}
  </p>
);

interface Opt<V extends string> {
  value: V;
  label: string;
  desc?: string;
}

/** Gruppo di scelte esclusive (radio) con grafica a pulsanti, accessibile da tastiera e screen reader. */
function Choice<V extends string>({ label, value, options, onChange, cols = 'grid-cols-2 sm:grid-cols-3' }: { label: string; value: V; options: Opt<V>[]; onChange: (v: V) => void; cols?: string }) {
  const labelId = `lbl-${label.replace(/\W+/g, '-')}`;
  return (
    <div>
      <FieldLabel id={labelId}>{label}</FieldLabel>
      <div role="radiogroup" aria-labelledby={labelId} className={`grid ${cols} gap-2`}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`px-3 py-2 min-h-11 rounded-lg border-2 text-left transition-colors ${value === o.value ? 'border-accent-ink bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}
          >
            <span className="block text-sm font-semibold text-gray-900">{o.label}</span>
            {o.desc && <span className="block text-xs text-gray-600">{o.desc}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

const Slider: React.FC<{ label: string; value: number; min: number; max: number; step?: number; onChange: (n: number) => void }> = ({ label, value, min, max, step = 5, onChange }) => (
  <label className="block">
    <span className="block text-sm font-medium text-gray-800 mb-2">{label}</span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full min-h-11" />
  </label>
);

const Switch: React.FC<{ label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, desc, checked, onChange }) => (
  <label className="flex items-start gap-3 min-h-11 cursor-pointer">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-5 w-5 shrink-0" />
    <span>
      <span className="block text-sm font-medium text-gray-800">{label}</span>
      {desc && <span className="block text-xs text-gray-600">{desc}</span>}
    </span>
  </label>
);

const ColorField: React.FC<{ label: string; ariaLabel: string; value: string; onChange: (hex: string) => void }> = ({ label, ariaLabel, value, onChange }) => (
  <label className="flex items-center justify-between gap-3 min-h-11">
    <span className="text-sm text-gray-800">{label}</span>
    <span className="flex items-center gap-2">
      <span className="font-mono text-xs text-gray-600">{value}</span>
      <input
        type="color"
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => {
          const hex = normalizeHex(e.target.value);
          if (hex) onChange(hex);
        }}
        className="h-10 w-14 cursor-pointer rounded-md border border-gray-300 bg-surface p-1"
      />
    </span>
  </label>
);

// ---------------------------------------------------------------------------------------------------------------------
// Componente principale
// ---------------------------------------------------------------------------------------------------------------------

const opts = <V extends string>(ids: readonly V[], prefix: string, t: (k: TranslationKey) => string): Opt<V>[] =>
  ids.map((id) => ({ value: id, label: t(`${prefix}.${id}` as TranslationKey) }));

const ThemeSettings: React.FC = () => {
  const { t } = useI18n();
  const { config, updateConfig, updateScheme, replaceConfig, resetConfig, scheme: activeScheme } = useTheme();
  const [saveName, setSaveName] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const tt = (k: TranslationKey) => t(k);
  const schemeName = (s: Scheme) => t(`theme.scheme.${s}` as TranslationKey);
  const colorName = (c: ThemeColor) => t(`color.${c}` as TranslationKey);

  // --- Modalità ---------------------------------------------------------------------------------------------------
  const modeOptions: Opt<typeof config.mode>[] = [
    { value: 'system', label: t('theme.mode.system'), desc: t('theme.mode.systemDesc') },
    { value: 'light', label: t('theme.mode.light'), desc: t('theme.mode.lightDesc') },
    { value: 'dark', label: t('theme.mode.dark'), desc: t('theme.mode.darkDesc') },
    { value: 'schedule', label: t('theme.mode.schedule'), desc: t('theme.mode.scheduleDesc') },
  ];

  // --- Una sezione per ogni schema --------------------------------------------------------------------------------
  const renderScheme = (scheme: Scheme) => {
    const sc = config[scheme];
    const preset = findPreset(scheme, sc.preset);
    const resolved = computeTheme(config, scheme).palette;
    const ratio = textContrast(resolved);
    const hasCustom = Object.keys(sc.custom).length > 0;
    const tokenLabel: Record<TokenKey, string> = {
      bg: t('theme.custom.bg'),
      surface: t('theme.custom.surface'),
      fg: t('theme.custom.fg'),
      muted: t('theme.custom.muted'),
      border: t('theme.custom.border'),
    };

    const accentSwatch = (c: ThemeColor) => (c === 'black' ? resolved.fg : ACCENT_HEX[c][resolved.isDark ? 'dark' : 'light']);
    const accentChoices: { value: AccentChoice; label: string; color: string }[] = [
      { value: 'auto', label: t('theme.accent.auto'), color: preset.accent ?? resolved.fg },
      ...THEME_COLORS.map((c) => ({ value: c as AccentChoice, label: colorName(c), color: accentSwatch(c) })),
      { value: 'custom', label: t('theme.accent.custom'), color: sc.customAccent },
    ];

    return (
      <Group key={scheme} title={schemeName(scheme)} defaultOpen={scheme === activeScheme}>
        {/* Tavolozze */}
        <div>
          <FieldLabel>{t('theme.palette.group', { scheme: schemeName(scheme).toLowerCase() })}</FieldLabel>
          <div role="radiogroup" aria-label={t('theme.palette.group', { scheme: schemeName(scheme).toLowerCase() })} className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {PRESETS[scheme].map((p) => {
              const name = t(`theme.preset.${scheme}.${p.id}` as TranslationKey);
              const selected = sc.preset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={t('theme.preset.aria', { name })}
                  onClick={() => updateScheme(scheme, { preset: p.id, custom: {} })}
                  className={`rounded-lg border-2 p-2 text-left transition-colors ${selected ? 'border-accent-ink' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  {/* Miniatura: colori reali della tavolozza (stili in linea consentiti dalla CSP: style-src 'unsafe-inline') */}
                  <span className="block rounded-md p-2 mb-2" style={{ backgroundColor: p.tokens.bg, border: `1px solid ${p.tokens.border}` }} aria-hidden="true">
                    <span className="block rounded p-1.5" style={{ backgroundColor: p.tokens.surface, border: `1px solid ${p.tokens.border}` }}>
                      <span className="block h-1.5 w-3/4 rounded-full mb-1" style={{ backgroundColor: p.tokens.fg }} />
                      <span className="block h-1.5 w-1/2 rounded-full mb-1.5" style={{ backgroundColor: p.tokens.muted }} />
                      <span className="block h-3 w-8 rounded" style={{ backgroundColor: p.accent ?? p.tokens.fg }} />
                    </span>
                  </span>
                  <span className="flex items-center justify-between text-sm font-semibold text-gray-900">
                    {name}
                    {selected && <Check size={16} aria-hidden="true" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Colore principale */}
        <div>
          <FieldLabel>{t('theme.accent')}</FieldLabel>
          <p className="text-xs text-gray-600 mb-3">{t('theme.accent.desc')}</p>
          <div role="radiogroup" aria-label={t('theme.accent')} className="grid grid-cols-4 sm:grid-cols-7 gap-3">
            {accentChoices.map((c) => {
              const selected = sc.accent === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={c.label}
                  title={c.label}
                  onClick={() => updateScheme(scheme, { accent: c.value })}
                  className={`h-12 w-12 mx-auto rounded-full flex items-center justify-center ring-offset-2 ring-offset-surface transition-transform hover:scale-110 ${selected ? 'ring-2 ring-accent-ink scale-110' : 'border border-gray-300'}`}
                  style={{ backgroundColor: c.color }}
                >
                  {selected ? <Check size={22} aria-hidden="true" style={{ color: readableOn(c.color) }} /> : c.value === 'auto' ? <span className="text-xs font-bold" style={{ color: readableOn(c.color) }} aria-hidden="true">A</span> : null}
                </button>
              );
            })}
          </div>
          {sc.accent === 'custom' && (
            <div className="mt-3">
              <ColorField label={t('theme.accent.pick')} ariaLabel={t('theme.accent.pick')} value={sc.customAccent} onChange={(hex) => updateScheme(scheme, { customAccent: hex })} />
            </div>
          )}
          <p className="mt-2 text-xs text-gray-600">{t('theme.accent.note')}</p>
        </div>

        {/* Colori personalizzati */}
        <div>
          <FieldLabel>{t('theme.custom.title')}</FieldLabel>
          <p className="text-xs text-gray-600 mb-2">{t('theme.custom.desc')}</p>
          <div className="divide-y divide-gray-100">
            {TOKEN_KEYS.map((k) => (
              <ColorField
                key={k}
                label={tokenLabel[k]}
                ariaLabel={t('theme.custom.aria', { name: tokenLabel[k] })}
                value={normalizeHex(sc.custom[k]) ?? preset.tokens[k]}
                onChange={(hex) => updateScheme(scheme, { custom: { ...sc.custom, [k]: hex } })}
              />
            ))}
          </div>
          {ratio < 4.5 && (
            <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {t('theme.custom.lowContrast', { ratio: ratio.toFixed(1) })}
            </p>
          )}
          <button
            type="button"
            onClick={() => updateScheme(scheme, { custom: {} })}
            disabled={!hasCustom}
            className="mt-3 inline-flex items-center min-h-11 text-sm text-gray-700 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw size={14} className="mr-2" aria-hidden="true" /> {t('theme.custom.reset')}
          </button>
        </div>
      </Group>
    );
  };

  // --- Temi salvati -----------------------------------------------------------------------------------------------
  const canSave = saveName.trim().length > 0 && config.savedThemes.length < MAX_SAVED_THEMES;
  const saveCurrent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    updateConfig({
      savedThemes: [...config.savedThemes, { id: generateUniqueId(), name: saveName.trim().slice(0, MAX_THEME_NAME), scheme: activeScheme, config: config[activeScheme] }],
    });
    setSaveName('');
    setMessage(null);
  };

  // --- Esporta / importa / ripristina ----------------------------------------------------------------------------
  const handleExport = () => downloadFile(JSON.stringify(config, null, 2), 'studia-theme.json', 'application/json');

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setMessage({ type: 'error', text: t('theme.io.tooBig') });
      return;
    }
    try {
      const parsed: unknown = JSON.parse(await file.text());
      // Il contenuto viene sempre ripulito da sanitizeThemeConfig: nessun valore del file arriva "grezzo" nel CSS
      if (typeof parsed !== 'object' || parsed === null || (parsed as { v?: unknown }).v !== 1) throw new Error('format');
      replaceConfig(sanitizeThemeConfig(parsed));
      setMessage({ type: 'success', text: t('theme.io.ok') });
    } catch {
      setMessage({ type: 'error', text: t('theme.io.error') });
    }
  };

  const handleReset = async () => {
    const confirmed = await confirmDialog({
      title: t('theme.reset.title'),
      message: t('theme.reset.confirm'),
      confirmLabel: t('common.reset'),
      tone: 'danger',
    });
    if (confirmed) {
      resetConfig();
      setMessage({ type: 'success', text: t('theme.reset.done') });
    }
  };

  const readerLabel = (id: (typeof READER_FONT_IDS)[number]) => (id === 'inherit' ? t('theme.text.readerInherit') : t(`theme.font.${id}` as TranslationKey));

  return (
    <div>
      <p className="text-gray-600 mb-4">{t('settings.appearance.desc')}</p>

      {/* Modalità */}
      <Group title={t('theme.mode.title')} defaultOpen>
        <p className="text-sm text-gray-600 -mt-2">{t('theme.mode.desc')}</p>
        <Choice label={t('theme.mode.group')} value={config.mode} options={modeOptions} onChange={(mode) => updateConfig({ mode })} cols="grid-cols-2 sm:grid-cols-4" />
        {config.mode === 'schedule' && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-800">
              {t('theme.mode.from')}
              <input type="time" value={config.darkFrom} onChange={(e) => e.target.value && updateConfig({ darkFrom: e.target.value })} className="min-h-11 rounded-md border border-gray-300 bg-surface px-2" />
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-800">
              {t('theme.mode.to')}
              <input type="time" value={config.darkTo} onChange={(e) => e.target.value && updateConfig({ darkTo: e.target.value })} className="min-h-11 rounded-md border border-gray-300 bg-surface px-2" />
            </label>
          </div>
        )}
        <p role="status" className="text-xs text-gray-600">
          {t('theme.mode.now', { scheme: schemeName(activeScheme).toLowerCase() })}
        </p>
        <Choice
          label={t('theme.display.noteHtml')}
          value={config.noteHtml}
          options={[
            { value: 'adapt', label: t('theme.display.noteHtmlAdapt') },
            { value: 'original', label: t('theme.display.noteHtmlOriginal') },
          ]}
          onChange={(noteHtml) => updateConfig({ noteHtml })}
          cols="grid-cols-2"
        />
      </Group>

      {/* Tavolozze: prima quella del tema in uso */}
      {(activeScheme === 'dark' ? (['dark', 'light'] as const) : (['light', 'dark'] as const)).map(renderScheme)}

      {/* Contrasto e colori */}
      <Group title={t('theme.display.title')}>
        <Switch label={t('theme.display.contrast')} desc={t('theme.display.contrastDesc')} checked={config.contrast === 'high'} onChange={(v) => updateConfig({ contrast: v ? 'high' : 'normal' })} />
        <Slider label={t('theme.display.tint', { value: config.noteTint })} value={config.noteTint} min={NOTE_TINT_MIN} max={NOTE_TINT_MAX} step={10} onChange={(noteTint) => updateConfig({ noteTint })} />
      </Group>

      {/* Testo e lettura */}
      <Group title={t('theme.text.title')}>
        <p className="text-sm text-gray-600 -mt-2">{t('theme.text.desc')}</p>
        <Choice label={t('theme.text.uiFont')} value={config.uiFont} options={opts(FONT_IDS, 'theme.font', tt)} onChange={(uiFont) => updateConfig({ uiFont })} />
        <Choice
          label={t('theme.text.readerFont')}
          value={config.readerFont}
          options={READER_FONT_IDS.map((id) => ({ value: id, label: readerLabel(id) }))}
          onChange={(readerFont) => updateConfig({ readerFont })}
        />
        <Slider label={t('theme.text.scale', { value: config.fontScale })} value={config.fontScale} min={FONT_SCALE_MIN} max={FONT_SCALE_MAX} step={5} onChange={(fontScale) => updateConfig({ fontScale })} />
        <Choice label={t('theme.text.letter')} value={config.letterSpacing} options={opts(LETTER_SPACING_IDS, 'theme.letter', tt)} onChange={(letterSpacing) => updateConfig({ letterSpacing })} cols="grid-cols-2 sm:grid-cols-4" />
        <Choice label={t('theme.text.readerSize')} value={config.readerSize} options={opts(READER_SIZE_IDS, 'theme.readerSize', tt)} onChange={(readerSize) => updateConfig({ readerSize })} />
        <Choice label={t('theme.text.lineHeight')} value={config.readerLineHeight} options={opts(LINE_HEIGHT_IDS, 'theme.lineHeight', tt)} onChange={(readerLineHeight) => updateConfig({ readerLineHeight })} cols="grid-cols-2 sm:grid-cols-4" />
        <Choice label={t('theme.text.readerWidth')} value={config.readerWidth} options={opts(READER_WIDTH_IDS, 'theme.readerWidth', tt)} onChange={(readerWidth) => updateConfig({ readerWidth })} cols="grid-cols-2 sm:grid-cols-4" />
        <div>
          <FieldLabel>{t('theme.text.sampleTitle')}</FieldLabel>
          <div className="rounded-lg border border-gray-200 bg-surface p-4 overflow-hidden">
            <div className={`${READER_SIZE_CLASS[config.readerSize]} reader`}>
              <p>{t('theme.text.sample')}</p>
            </div>
          </div>
        </div>
      </Group>

      {/* Forma e layout */}
      <Group title={t('theme.shape.title')}>
        <Choice label={t('theme.shape.radius')} value={config.radius} options={opts(RADIUS_IDS, 'theme.radius', tt)} onChange={(radius) => updateConfig({ radius })} />
        <Choice label={t('theme.shape.cardSize')} value={config.cardSize} options={opts(CARD_SIZE_IDS, 'theme.cardSize', tt)} onChange={(cardSize) => updateConfig({ cardSize })} />
        <Choice label={t('theme.shape.pattern')} value={config.pattern} options={opts(PATTERN_IDS, 'theme.pattern', tt)} onChange={(pattern) => updateConfig({ pattern })} cols="grid-cols-2 sm:grid-cols-4" />
        <Choice label={t('theme.shape.motion')} value={config.motion} options={opts(MOTION_IDS, 'theme.motion', tt)} onChange={(motion) => updateConfig({ motion })} />
      </Group>

      {/* Temi salvati */}
      <Group title={t('theme.saved.title')}>
        <p className="text-sm text-gray-600 -mt-2">{t('theme.saved.desc')}</p>
        <form onSubmit={saveCurrent} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={saveName}
            maxLength={MAX_THEME_NAME}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder={t('theme.saved.name')}
            aria-label={t('theme.saved.name')}
            className="flex-1 px-3 py-2 border border-gray-300 bg-surface rounded-lg text-sm focus:ring-2 focus:ring-accent-ink focus:border-accent-ink outline-hidden"
          />
          <button type="submit" disabled={!canSave} className="px-4 py-2.5 min-h-11 rounded-lg bg-accent text-accent-fg text-sm font-semibold hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed">
            {t('theme.saved.save')}
          </button>
        </form>
        <p className="text-xs text-gray-600 -mt-3">{t('theme.saved.forScheme', { scheme: schemeName(activeScheme).toLowerCase() })}</p>
        {config.savedThemes.length >= MAX_SAVED_THEMES && <p className="text-xs text-amber-900">{t('theme.saved.max', { max: MAX_SAVED_THEMES })}</p>}
        {config.savedThemes.length === 0 ? (
          <p className="text-sm text-gray-600">{t('theme.saved.empty')}</p>
        ) : (
          <ul className="space-y-2">
            {config.savedThemes.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-1">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-gray-900">{s.name}</span>
                  <span className="block text-xs text-gray-600">{schemeName(s.scheme)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <button type="button" aria-label={t('theme.saved.applyAria', { name: s.name })} onClick={() => updateScheme(s.scheme, s.config)} className="px-3 min-h-11 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    {t('theme.saved.apply')}
                  </button>
                  <button type="button" aria-label={t('theme.saved.delete', { name: s.name })} title={t('theme.saved.delete', { name: s.name })} onClick={() => updateConfig({ savedThemes: config.savedThemes.filter((x) => x.id !== s.id) })} className="p-3 rounded-full text-gray-700 hover:bg-red-100 hover:text-red-700">
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Group>

      {/* Backup */}
      <Group title={t('theme.io.title')}>
        <p className="text-sm text-gray-600 -mt-2">{t('theme.io.desc')}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleExport} className="inline-flex items-center px-4 py-2.5 min-h-11 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Download size={14} className="mr-2" aria-hidden="true" /> {t('theme.io.export')}
          </button>
          <button type="button" onClick={() => importRef.current?.click()} className="inline-flex items-center px-4 py-2.5 min-h-11 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Upload size={14} className="mr-2" aria-hidden="true" /> {t('theme.io.import')}
          </button>
          <input ref={importRef} type="file" accept=".json,application/json" onChange={handleImport} className="hidden" tabIndex={-1} aria-hidden="true" />
        </div>
        <button type="button" onClick={handleReset} className="inline-flex items-center min-h-11 text-sm text-red-700 hover:underline">
          <RotateCcw size={14} className="mr-2" aria-hidden="true" /> {t('theme.reset')}
        </button>
      </Group>

      {message && (
        <div role="status" className={`mt-3 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message.text}
        </div>
      )}
    </div>
  );
};

export default ThemeSettings;
