import { ChevronDown, Eye, EyeOff, Pipette } from 'lucide-react';
import { FONT_OPTIONS, getFontFamily } from '../../data/fonts';
import { logoAlignmentOptions, textAlignmentOptions, visualStyleOptions } from '../../config/editorConfig';

export const clampNumber = (value, min, max, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

export const getLogoDisplay = (settings = {}) => {
  const logoDisplay = settings.logoDisplay || {};
  const size = Number(logoDisplay.size);
  return {
    visible: logoDisplay.visible !== false,
    alignment: logoAlignmentOptions.some(option => option.id === logoDisplay.alignment) ? logoDisplay.alignment : 'left',
    size: Number.isFinite(size) ? Math.min(176, Math.max(48, size)) : 96
  };
};

export const parseAmountToCents = (value) => {
  const normalized = String(value || '')
    .replace(/[^0-9.,-]/g, '')
    .replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
};

export const getBannerDisplay = (settings = {}) => {
  const bannerDisplay = settings.bannerDisplay || {};
  const height = Number(bannerDisplay.height);
  const position = ['top', 'center', 'bottom'].includes(bannerDisplay.position) ? bannerDisplay.position : 'center';
  return {
    visible: bannerDisplay.visible !== false,
    height: Number.isFinite(height) ? Math.min(360, Math.max(120, height)) : 220,
    position,
    objectPosition: position === 'top' ? 'center top' : position === 'bottom' ? 'center bottom' : 'center center'
  };
};

export const identityTextControls = [
  {
    id: 'brandName',
    label: 'Business Name',
    hint: 'Main booking page heading.',
    fieldKey: 'brandName',
    sizeKey: 'brandNameSize',
    fontKey: 'brandNameFontFamily',
    fallbackFontKey: 'headingFontFamily',
    fallbackSize: 76,
    min: 36,
    max: 120,
    step: 2,
    multiline: false,
    preview: 'Studio Noir'
  },
  {
    id: 'tagline',
    label: 'Eyebrow / Tagline',
    hint: 'Small line above the title.',
    fieldKey: 'tagline',
    sizeKey: 'taglineSize',
    fontKey: 'taglineFontFamily',
    fallbackFontKey: 'bodyFontFamily',
    fallbackSize: 9,
    min: 8,
    max: 22,
    step: 1,
    multiline: false,
    preview: 'Atelier 7B / Private'
  },
  {
    id: 'welcome',
    label: 'Welcome Text',
    hint: 'Intro copy under the heading.',
    fieldKey: 'welcomeMessage',
    sizeKey: 'welcomeSize',
    fontKey: 'welcomeFontFamily',
    fallbackFontKey: 'bodyFontFamily',
    fallbackSize: 20,
    min: 13,
    max: 32,
    step: 1,
    multiline: true,
    preview: 'Reserve your private session.'
  }
];

export const getIdentityTextSettings = (settings = {}, config) => {
  const size = clampNumber(settings[config.sizeKey], config.min, config.max, config.fallbackSize);
  const font = settings[config.fontKey] || settings[config.fallbackFontKey] || settings.fontFamily || 'inter';
  return { size, font };
};

export const getSpacingControlValue = (settings = {}, key) => {
  const value = settings[key];
  if (value === '' || value === null || value === undefined) return 0;
  return clampNumber(value, -4, 8, 0);
};

export function LetterSpacingControl({ settings, onChange }) {
  const controls = [
    {
      key: 'headingLetterSpacing',
      label: 'Heading Space',
      note: 'Business name, section titles, and success headline.',
      sample: 'Studio Noir',
      min: -4,
      max: 8
    },
    {
      key: 'subtextLetterSpacing',
      label: 'Subtext Space',
      note: 'Tagline and welcome copy below the heading.',
      sample: 'Reserve your private session.',
      min: -1,
      max: 6
    }
  ];

  return (
    <div className="rounded-lg border border-neutral-100 bg-white p-4 md:p-6 shadow-[0_24px_80px_-72px_rgba(15,23,42,0.75)]">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-sm font-bold text-black">Master Text Spacing</p>
          <p className="text-xs text-neutral-400 font-medium mt-1 max-w-xl">A Canva-style letter spacing pass for tighter luxury headings or airy editorial copy.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange('headingLetterSpacing', '');
            onChange('subtextLetterSpacing', '');
          }}
          className="h-9 px-4 rounded-lg bg-neutral-50 border border-neutral-100 text-[9px] font-bold uppercase tracking-widest text-neutral-400 hover:text-black hover:bg-white transition-all"
        >
          Reset
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {controls.map(control => {
          const value = getSpacingControlValue(settings, control.key);
          return (
            <div key={control.key} className="rounded-lg bg-neutral-50 border border-neutral-100 p-4">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-black">{control.label}</p>
                  <p className="text-xs text-neutral-400 font-medium mt-1 leading-relaxed">{control.note}</p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-black bg-white border border-neutral-100 px-2 py-1 rounded-md shrink-0">{value.toFixed(1)}px</span>
              </div>
              <div
                className="h-16 rounded-lg bg-white border border-neutral-100 flex items-center justify-center px-4 text-lg font-bold text-black overflow-hidden"
                style={{
                  letterSpacing: `${value}px`,
                  fontFamily: getFontFamily(control.key === 'headingLetterSpacing'
                    ? (settings.headingFontFamily || settings.fontFamily)
                    : (settings.bodyFontFamily || settings.fontFamily))
                }}
              >
                <span className="truncate">{control.sample}</span>
              </div>
              <input
                type="range"
                min={control.min}
                max={control.max}
                step="0.1"
                value={value}
                onChange={(event) => onChange(control.key, Number(event.target.value))}
                className="w-full accent-black mt-4"
              />
              <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest text-neutral-300 mt-1">
                <span>Tight</span>
                <span>Airy</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AlignmentButtonGroup({ value, onChange, label = 'Alignment' }) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-300 mb-2">{label}</p>
      <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-neutral-100 p-1">
        {textAlignmentOptions.map(option => {
          const IconCmp = option.icon;
          const isActive = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={`h-10 rounded-md flex items-center justify-center gap-1.5 text-[9px] font-bold uppercase tracking-widest transition-all ${isActive ? 'bg-black text-white shadow-lg' : 'text-neutral-400 hover:bg-white hover:text-black'}`}
              aria-label={`${label} ${option.label}`}
            >
              <IconCmp size={14} />
              <span className="hidden xl:inline">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function FontDropdown({ value, onChange, fallbackLabel = 'Theme Default' }) {
  return (
    <div className="relative">
      <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-300 mb-2">Font</p>
      <select
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        className="w-full h-11 rounded-lg bg-neutral-50 border border-neutral-100 px-3 pr-9 text-[10px] font-bold uppercase tracking-widest text-black outline-none appearance-none cursor-pointer focus:bg-white focus:border-neutral-200 transition-all"
        style={{ fontFamily: getFontFamily(value || '') }}
      >
        <option value="">{fallbackLabel}</option>
        {FONT_OPTIONS.map(font => (
          <option key={font.id} value={font.id} style={{ fontFamily: font.family }}>
            {font.name} ({font.category})
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-3 bottom-3.5 pointer-events-none text-neutral-400" />
    </div>
  );
}

export function LogoDisplayControls({ settings, onChange, className = '' }) {
  const logoDisplay = getLogoDisplay(settings);
  return (
    <div className={`space-y-5 ${className}`}>
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm font-bold text-black">Booking Page Logo</p>
          <p className="text-xs text-neutral-400 leading-relaxed max-w-sm">Control logo visibility, position, and size above the page heading.</p>
        </div>
        <div className="grid grid-cols-2 rounded-lg bg-neutral-100 p-1 w-full">
          {[
            { value: true, label: 'Shown', icon: Eye },
            { value: false, label: 'Hidden', icon: EyeOff }
          ].map(option => {
            const IconCmp = option.icon;
            const isActive = logoDisplay.visible === option.value;
            return (
              <button
                key={option.label}
                type="button"
                onClick={() => onChange('visible', option.value)}
                className={`h-10 rounded-md flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all ${isActive ? 'bg-black text-white shadow-lg' : 'text-neutral-400 hover:bg-white hover:text-black'}`}
              >
                <IconCmp size={14} />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
        <div className="h-20 rounded-lg bg-neutral-50 border border-neutral-100 px-4 flex items-center mb-5" style={{ justifyContent: logoDisplay.alignment === 'center' ? 'center' : logoDisplay.alignment === 'right' ? 'flex-end' : 'flex-start' }}>
          <div className="rounded-lg bg-black text-white flex items-center justify-center font-bold text-xs shadow-xl" style={{ width: Math.max(34, logoDisplay.size * 0.32), height: Math.max(34, logoDisplay.size * 0.32) }}>
            LOGO
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5">
          <AlignmentButtonGroup value={logoDisplay.alignment} onChange={(value) => onChange('alignment', value)} label="Position" />

          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-300">Size</p>
              <span className="text-[10px] font-bold uppercase tracking-widest text-black bg-neutral-100 px-2 py-1 rounded-md">{logoDisplay.size}px</span>
            </div>
            <input
              type="range"
              min="48"
              max="176"
              step="4"
              value={logoDisplay.size}
              onChange={(event) => onChange('size', Number(event.target.value))}
              className="w-full accent-black"
            />
            <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest text-neutral-300 mt-1">
              <span>Small</span>
              <span>Large</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function IdentityTextControl({ settings, config, onChange }) {
  const appearance = getIdentityTextSettings(settings, config);
  const masterAlignment = getLogoDisplay(settings).alignment;
  const value = settings[config.fieldKey] || '';
  const inputStyle = {
    textAlign: masterAlignment,
    fontFamily: getFontFamily(appearance.font),
    fontSize: `${config.id === 'brandName' ? Math.min(28, Math.max(18, appearance.size * 0.32)) : Math.min(18, Math.max(12, appearance.size))}px`
  };

  return (
    <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-4 md:p-5 space-y-5 shadow-inner">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-black">{config.label}</p>
          <p className="text-xs text-neutral-400 leading-relaxed">{config.hint}</p>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-black bg-white border border-neutral-100 px-2 py-1 rounded-md shrink-0">{appearance.size}px</span>
      </div>

      {config.multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(config.fieldKey, event.target.value)}
          className="w-full min-h-[118px] rounded-lg bg-white border border-neutral-100 px-5 py-4 text-black outline-none focus:border-neutral-200 resize-none transition-all"
          style={inputStyle}
          placeholder={config.preview}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(config.fieldKey, event.target.value)}
          className={`w-full rounded-lg bg-white border border-neutral-100 px-5 py-4 text-black outline-none focus:border-neutral-200 transition-all ${config.id === 'tagline' ? 'uppercase tracking-[0.35em] font-bold' : 'font-bold tracking-tight'}`}
          style={inputStyle}
          placeholder={config.preview}
        />
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-300">Size</p>
          </div>
          <input
            type="range"
            min={config.min}
            max={config.max}
            step={config.step}
            value={appearance.size}
            onChange={(event) => onChange(config.sizeKey, Number(event.target.value))}
            className="w-full accent-black"
          />
          <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest text-neutral-300 mt-1">
            <span>{config.min}px</span>
            <span>{config.max}px</span>
          </div>
        </div>

        <FontDropdown value={settings[config.fontKey] || ''} onChange={(value) => onChange(config.fontKey, value)} />
      </div>

      <div className="rounded-lg bg-white border border-neutral-100 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
        Uses logo position: <span className="text-black">{masterAlignment}</span>
      </div>
    </div>
  );
}

export function StyleSegmentedControl({ value, onChange, label = 'Style' }) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-300 mb-2">{label}</p>
      <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-neutral-100 p-1">
        {visualStyleOptions.map(option => {
          const isActive = (value || 'minimal') === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={`h-10 rounded-md text-[9px] font-bold uppercase tracking-widest transition-all ${isActive ? 'bg-black text-white shadow-lg' : 'text-neutral-400 hover:bg-white hover:text-black'}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function InterfaceLookGrid({ value, onChange, looks = [], label = 'Display look' }) {
  const activeValue = value || looks[0]?.id;

  return (
    <div className="cinema-look-picker">
      <div className="cinema-look-picker-head">
        <span>{label}</span>
        <small>{looks.length} looks</small>
      </div>
      <div className="cinema-look-grid">
        {looks.map((look) => {
          const isActive = activeValue === look.id;
          return (
            <button
              key={look.id}
              type="button"
              onClick={() => onChange(look.id)}
              className={isActive ? 'is-active' : ''}
            >
              <i aria-hidden="true">
                <b />
                <b />
                <b />
              </i>
              <span>{look.label}</span>
              <small>{look.note}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ButtonShapeControl({ value, onChange }) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-300 mb-2">Button Shape</p>
      <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-neutral-100 p-1">
        {[
          { id: 'pill', label: 'Pill' },
          { id: 'sharp', label: 'Boxed' }
        ].map(option => {
          const isActive = (value || 'pill') === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={`h-10 rounded-md text-[9px] font-bold uppercase tracking-widest transition-all ${isActive ? 'bg-black text-white shadow-lg' : 'text-neutral-400 hover:bg-white hover:text-black'}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function VisualEditorGroup({ title, note, children }) {
  return (
    <section className="rounded-lg border border-neutral-100 bg-white p-4 md:p-5 shadow-sm space-y-5">
      <div>
        <p className="text-sm font-bold text-black">{title}</p>
        {note && <p className="text-xs text-neutral-400 leading-relaxed mt-1">{note}</p>}
      </div>
      {children}
    </section>
  );
}

export function ColorFontControl({ settings, item, onChange }) {
  const colorValue = settings[item.key] || item.fallback || (item.key.toLowerCase().includes('bg') ? 'transparent' : '#000000');
  return (
    <div className="flex flex-col bg-neutral-50 p-4 rounded-lg group relative border border-neutral-100/50 hover:border-neutral-200 transition-all">
      <div className="flex items-center gap-4 w-full">
        <label className="cursor-pointer flex-shrink-0">
          <div className="w-12 h-12 rounded-[1rem] shadow-sm border border-black/5 hover:scale-110 transition-transform overflow-hidden relative" style={{ backgroundColor: colorValue }}>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 backdrop-blur-sm">
              <Pipette size={16} className="text-white drop-shadow-md" />
            </div>
          </div>
          <input type="color" className="sr-only" value={colorValue === 'transparent' ? '#ffffff' : colorValue} onChange={(event) => onChange(item.key, event.target.value)} />
        </label>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-400 mb-1 truncate">{item.label}</p>
          <input type="text" value={colorValue} onChange={(event) => onChange(item.key, event.target.value)} className="w-full bg-transparent text-sm font-mono font-bold uppercase outline-none text-black" />
        </div>
      </div>
      {item.fontKey && (
        <div className="mt-4 pt-3 border-t border-neutral-200/50 w-full">
          <FontDropdown value={settings[item.fontKey] || ''} onChange={(value) => onChange(item.fontKey, value)} />
        </div>
      )}
    </div>
  );
}
