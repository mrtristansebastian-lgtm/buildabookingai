import { lazy, Suspense, startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import {
  AlignCenter, AlignLeft, AlignRight, ArrowRight, Battery, Bell, BookOpen, Briefcase, Calendar, CalendarCheck, Camera, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, Eye, EyeOff, FileText, Globe, History, Instagram, Layers, Layout, Mail, MessageCircle, MessageSquare, Monitor, Moon, MousePointerClick, Paintbrush, Palette, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Phone, Pipette, Plus, RefreshCw, Search, Share2, ShieldCheck, Signal, Sparkles, Star, Sun, Tag, Trash2, User, UserPlus, Users, Wifi, X, Zap
} from 'lucide-react';
import { BuildABookingBrand, BuildABookingMark } from './components/BuildABookingBrand';
import { EmailNotificationSettings } from './components/EmailNotificationSettings';
import { NotificationCenter } from './components/NotificationCenter';
import { ProButton } from './components/ProButton';
import { FONT_OPTIONS, getFontFamily } from './data/fonts';
import { PRESET_THEMES, generateThemeCollection } from './data/themes';
import * as FirebaseSDK from './services/firebase';
import { appId, auth, db, functions, initialAuthToken, isFirebaseConfigured, storage } from './services/firebase';
import { createDefaultEmailConfig, sendClientEmail } from './services/email';
import {
  GOOGLE_CALENDAR_EVENTS_SCOPE,
  syncConfirmedBookingsToGoogleCalendar
} from './services/googleCalendar';
import {
  getBrowserNotificationPermission,
  makeClientNotification,
  makeOwnerNotification,
  notificationEmailKey,
  requestBrowserNotificationPermission,
  showBrowserNotification,
  NOTIFICATION_TYPES
} from './services/notifications';
import { getLocalDateStr } from './utils/dates';
import { buildBookingSlug, prepareOnboardingDraftSettings, prepareOnboardingSettings } from './utils/onboarding';
import { normalizeHexColor, THEME_FILTER_GROUPS } from './utils/theme';

const OnboardingShowroom = lazy(() => (
  import('./components/OnboardingShowroom').then((module) => ({ default: module.OnboardingShowroom }))
));

const OwnerManual = lazy(() => (
  import('./components/OwnerManual').then((module) => ({ default: module.OwnerManual }))
));

const BusinessCalendar = lazy(() => (
  import('./components/BusinessCalendar').then((module) => ({ default: module.BusinessCalendar }))
));

const BookingFlow = lazy(() => (
  import('./components/BookingFlow').then((module) => ({ default: module.BookingFlow }))
));

const ClientPortal = lazy(() => (
  import('./components/ClientPortal').then((module) => ({ default: module.ClientPortal }))
));

const WorkspaceInbox = lazy(() => (
  import('./components/WorkspaceInbox').then((module) => ({ default: module.WorkspaceInbox }))
));

const BrandLoader = ({ label = 'Loading workspace', variant = 'dark' }) => (
  <div className="text-center">
    <div className="brand-loader-orbit mx-auto mb-6">
      <BuildABookingMark className="w-9 h-9" variant={variant} />
    </div>
    <p className={`text-[10px] font-bold uppercase tracking-[0.35em] ${variant === 'light' ? 'text-white/40' : 'text-neutral-300'}`}>{label}</p>
  </div>
);

const LazySectionFallback = ({ label = 'Loading workspace', variant = 'dark' }) => (
  <div className="min-h-[320px] w-full bg-white flex items-center justify-center text-center">
    <BrandLoader label={label} variant={variant} />
  </div>
);

const getPublicBookingSlug = () => {
  const url = new URL(window.location.href);
  const querySlug = url.searchParams.get('book') || url.searchParams.get('workspace');
  if (querySlug) return querySlug.trim().toLowerCase();
  const [, section, slug] = url.pathname.split('/');
  if (section === 'book' && slug) return slug.trim().toLowerCase();
  return '';
};

const logoAlignmentOptions = [
  { id: 'left', label: 'Left', icon: AlignLeft },
  { id: 'center', label: 'Center', icon: AlignCenter },
  { id: 'right', label: 'Right', icon: AlignRight }
];

const textAlignmentOptions = logoAlignmentOptions;

const legalPages = {
  privacy: {
    eyebrow: 'Privacy',
    title: 'Privacy at booking speed',
    body: [
      'Build A Booking stores the information needed to run a workspace: account details, booking requests, client contact fields, page settings, and uploaded assets.',
      'Business owners control their workspace data. Client details are used for booking operations, reminders, follow-ups, and the features each business enables.',
      'Before production launch, connect your final privacy policy, retention rules, and support contact here so clients and owners know exactly how data is handled.'
    ]
  },
  terms: {
    eyebrow: 'Terms',
    title: 'Simple product terms',
    body: [
      'Use Build A Booking to create booking pages, manage requests, and communicate with clients responsibly.',
      'Owners are responsible for accurate business information, client consent, staff access, and any messages sent through connected communication providers.',
      'Before paid launch, this section should be replaced with the final legal terms for subscriptions, cancellations, refunds, acceptable use, and support.'
    ]
  },
  support: {
    eyebrow: 'Support',
    title: 'Need help with your booking flow?',
    body: [
      'Use the profile, communication, schedule, and editor sections to keep your workspace ready before publishing.',
      'For production support, add the official support email, response window, help center, and account recovery process here.',
      'If something looks wrong, refresh once, check your connection, then contact support with the workspace name and page you were using.'
    ]
  }
};
const visualStyleOptions = [
  { id: 'minimal', label: 'Minimal' },
  { id: 'outline', label: 'Outline' },
  { id: 'solid', label: 'Solid' }
];

const themeTemplateKeys = [
  'primaryColor', 'headingColor', 'bodyColor', 'backgroundColor',
  'slotBgColor', 'slotTextColor', 'dateBgColor', 'dateTextColor',
  'dateActiveBgColor', 'dateActiveTextColor', 'buttonTextColor',
  'fontFamily', 'nativeAccent',
  'headingFontFamily', 'bodyFontFamily', 'buttonFontFamily', 'slotFontFamily', 'dateFontFamily',
  'brandNameSize', 'brandNameFontFamily', 'taglineSize', 'taglineFontFamily',
  'welcomeSize', 'welcomeFontFamily', 'headingLetterSpacing', 'subtextLetterSpacing',
  'buttonStyle', 'availabilityStyle', 'dateStyle', 'timeSlotStyle', 'actionButtonStyle',
  'faqStyle', 'faqBgColor', 'faqBorderColor', 'faqTextColor', 'faqAnswerColor', 'faqFontFamily',
  'socialIconStyle', 'socialIconBgColor', 'socialIconColor', 'socialIconTextColor'
];

const pickThemeTemplateSettings = (source = {}) => (
  themeTemplateKeys.reduce((template, key) => {
    if (source[key] !== undefined) template[key] = source[key];
    return template;
  }, {})
);

const nativeStarterTheme = PRESET_THEMES.find(theme => theme.id === 'build-a-booking-native') || PRESET_THEMES[0];
const mobileWebEditorThemes = [
  nativeStarterTheme,
  {
    ...nativeStarterTheme,
    id: 'mobile-web-modern-light',
    name: 'Modern Light',
    primaryColor: '#050505',
    backgroundColor: '#FFFFFF',
    headingColor: '#050505',
    bodyColor: '#616672',
    slotBgColor: '#F5F6F8',
    slotTextColor: '#050505',
    dateBgColor: '#F7F7F8',
    dateTextColor: '#7A808A',
    dateActiveBgColor: '#050505',
    dateActiveTextColor: '#FFFFFF',
    buttonTextColor: '#FFFFFF',
    buttonStyle: 'pill',
    fontFamily: 'plus-jakarta',
    availabilityStyle: 'solid',
    dateStyle: 'solid',
    timeSlotStyle: 'solid',
    actionButtonStyle: 'solid',
    palette: 'neutral',
    styleTags: ['modern', 'minimal'],
    industryTags: ['all'],
    nativeAccent: false
  },
  {
    ...nativeStarterTheme,
    id: 'mobile-web-modern-dark',
    name: 'Modern Dark',
    primaryColor: '#FFFFFF',
    backgroundColor: '#050505',
    headingColor: '#FFFFFF',
    bodyColor: '#A3A7AF',
    slotBgColor: '#16171A',
    slotTextColor: '#FFFFFF',
    dateBgColor: '#111215',
    dateTextColor: '#A3A7AF',
    dateActiveBgColor: '#FFFFFF',
    dateActiveTextColor: '#050505',
    buttonTextColor: '#050505',
    buttonStyle: 'pill',
    fontFamily: 'space-grotesk',
    availabilityStyle: 'solid',
    dateStyle: 'solid',
    timeSlotStyle: 'solid',
    actionButtonStyle: 'solid',
    faqBgColor: '#101114',
    faqBorderColor: '#24262B',
    faqTextColor: '#FFFFFF',
    faqAnswerColor: '#B5BAC4',
    socialIconBgColor: '#111215',
    socialIconColor: '#FFFFFF',
    socialIconTextColor: '#050505',
    palette: 'neutral',
    styleTags: ['modern', 'night'],
    industryTags: ['all'],
    nativeAccent: false
  }
];

const defaultFaqItems = [
  { q: 'How do I know my booking is confirmed?', a: 'You will see a confirmation on this page and receive a message when the business approves your request.' },
  { q: 'Can I join a waitlist if the day is full?', a: 'Yes. If waitlist is enabled, you can leave your details and the business can contact you when a slot opens.' }
];

const themePaletteLabel = (paletteId) => (
  THEME_FILTER_GROUPS.find(group => group.id === 'palette')?.filters.find(filter => filter.id === paletteId)?.name || 'brand'
);

const themeStyleLabel = (styleId) => (
  THEME_FILTER_GROUPS.find(group => group.id === 'style')?.filters.find(filter => filter.id === styleId)?.name || 'Modern'
);

const fontStylePresets = [
  {
    id: 'modern',
    label: 'Modern',
    note: 'Clean SaaS polish',
    fontFamily: 'inter',
    headingFontFamily: 'plus-jakarta',
    bodyFontFamily: 'inter',
    buttonFontFamily: 'space-grotesk',
    slotFontFamily: 'plus-jakarta',
    dateFontFamily: 'plus-jakarta',
    headingLetterSpacing: 0,
    subtextLetterSpacing: 0
  },
  {
    id: 'editorial',
    label: 'Editorial',
    note: 'Magazine calm',
    fontFamily: 'source-sans-3',
    headingFontFamily: 'newsreader',
    bodyFontFamily: 'source-sans-3',
    buttonFontFamily: 'work-sans',
    slotFontFamily: 'source-sans-3',
    dateFontFamily: 'newsreader',
    headingLetterSpacing: 0,
    subtextLetterSpacing: 1
  },
  {
    id: 'luxury',
    label: 'Luxury',
    note: 'Premium boutique',
    fontFamily: 'manrope',
    headingFontFamily: 'marcellus',
    bodyFontFamily: 'manrope',
    buttonFontFamily: 'cinzel',
    slotFontFamily: 'manrope',
    dateFontFamily: 'marcellus',
    headingLetterSpacing: 1,
    subtextLetterSpacing: 2
  },
  {
    id: 'bold',
    label: 'Bold',
    note: 'High impact',
    fontFamily: 'manrope',
    headingFontFamily: 'unbounded',
    bodyFontFamily: 'manrope',
    buttonFontFamily: 'space-grotesk',
    slotFontFamily: 'space-grotesk',
    dateFontFamily: 'unbounded',
    headingLetterSpacing: 0,
    subtextLetterSpacing: 0
  },
  {
    id: 'organic',
    label: 'Organic',
    note: 'Warm and soft',
    fontFamily: 'source-sans-3',
    headingFontFamily: 'spectral',
    bodyFontFamily: 'source-sans-3',
    buttonFontFamily: 'figtree',
    slotFontFamily: 'source-sans-3',
    dateFontFamily: 'spectral',
    headingLetterSpacing: 0,
    subtextLetterSpacing: 0.5
  },
  {
    id: 'tech',
    label: 'Tech',
    note: 'Precise mono',
    fontFamily: 'ibm-plex-sans',
    headingFontFamily: 'space-grotesk',
    bodyFontFamily: 'ibm-plex-sans',
    buttonFontFamily: 'ibm-plex-mono',
    slotFontFamily: 'ibm-plex-mono',
    dateFontFamily: 'ibm-plex-mono',
    headingLetterSpacing: 0,
    subtextLetterSpacing: 1.5
  }
];

const rgbToHsl = (red, green, blue) => {
  let r = red / 255;
  let g = green / 255;
  let b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;

  if (max !== min) {
    const delta = max - min;
    saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0);
    if (max === g) hue = (b - r) / delta + 2;
    if (max === b) hue = (r - g) / delta + 4;
    hue *= 60;
  }

  return { hue, saturation: saturation * 100, lightness: lightness * 100 };
};

const paletteIdFromHsl = ({ hue, saturation, lightness }) => {
  if (saturation < 16 || lightness < 10 || lightness > 94) return 'neutral';
  if (hue >= 345 || hue < 15) return 'red';
  if (hue >= 15 && hue < 38) return 'orange';
  if (hue >= 38 && hue < 75) return 'yellow';
  if (hue >= 75 && hue < 175) return 'green';
  if (hue >= 175 && hue < 255) return 'blue';
  if (hue >= 255 && hue < 295) return 'purple';
  return 'pink';
};

const inferStyleFromBrandSignal = ({ palette, dominantHsl, neutralShare, darkShare, lightShare, vividShare, contrastRange }) => {
  if (neutralShare > 0.78 && contrastRange > 120) return darkShare > 0.45 ? 'luxury' : 'minimal';
  if (darkShare > 0.52 && vividShare > 0.12) return palette === 'blue' || palette === 'purple' ? 'tech' : 'night';
  if (vividShare > 0.42 && dominantHsl?.saturation > 58) return palette === 'yellow' || palette === 'orange' ? 'commerce' : 'bold';
  if (['green', 'yellow'].includes(palette) && dominantHsl?.saturation < 58) return 'organic';
  if (['pink', 'red', 'purple'].includes(palette) && lightShare > 0.42) return 'luxury';
  if (['blue', 'neutral'].includes(palette) && neutralShare > 0.45) return 'modern';
  return 'modern';
};

const analyzePaletteFromImageSource = (source) => new Promise((resolve) => {
  if (!source || typeof window === 'undefined') {
    resolve({ palette: '', style: '', confidence: 0, colors: [] });
    return;
  }

  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      const size = 96;
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0, size, size);
      const pixels = context.getImageData(0, 0, size, size).data;
      const buckets = {};
      const colorSamples = [];
      let neutralScore = 0;
      let colorScore = 0;
      let darkScore = 0;
      let lightScore = 0;
      let vividScore = 0;
      let minLuma = 255;
      let maxLuma = 0;
      let sampled = 0;

      for (let index = 0; index < pixels.length; index += 16) {
        const alpha = pixels[index + 3];
        if (alpha < 160) continue;
        const red = pixels[index];
        const green = pixels[index + 1];
        const blue = pixels[index + 2];
        const luma = (red * 0.299) + (green * 0.587) + (blue * 0.114);
        const hsl = rgbToHsl(red, green, blue);
        if (hsl.lightness < 4 || hsl.lightness > 98) continue;
        const palette = paletteIdFromHsl(hsl);
        const colorWeight = Math.max(1, hsl.saturation) * (palette === 'neutral' ? 0.18 : 1);
        const contrastWeight = Math.abs(50 - hsl.lightness) / 50;
        const weight = colorWeight * (1 + contrastWeight * 0.45);
        buckets[palette] = (buckets[palette] || 0) + weight;
        sampled += 1;
        minLuma = Math.min(minLuma, luma);
        maxLuma = Math.max(maxLuma, luma);
        if (palette === 'neutral') neutralScore += weight;
        else colorScore += weight;
        if (hsl.lightness < 26) darkScore += weight;
        if (hsl.lightness > 76) lightScore += weight;
        if (hsl.saturation > 52 && hsl.lightness > 18 && hsl.lightness < 82) vividScore += weight;
        if (palette !== 'neutral') {
          colorSamples.push({
            palette,
            hsl,
            weight,
            hex: `#${[red, green, blue].map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`
          });
        }
      }

      const sortedBuckets = Object.entries(buckets).sort((a, b) => b[1] - a[1]);
      const [winner, winnerScore = 0] = sortedBuckets[0] || [];
      const totalScore = Object.values(buckets).reduce((sum, score) => sum + score, 0) || 1;
      const dominantSample = colorSamples.sort((a, b) => b.weight - a.weight)[0];
      const palette = winner || (sampled ? 'neutral' : '');
      const signal = {
        palette,
        style: palette ? inferStyleFromBrandSignal({
          palette,
          dominantHsl: dominantSample?.hsl,
          neutralShare: neutralScore / totalScore,
          darkShare: darkScore / totalScore,
          lightShare: lightScore / totalScore,
          vividShare: vividScore / Math.max(colorScore || totalScore, 1),
          contrastRange: maxLuma - minLuma
        }) : '',
        confidence: Math.min(1, winnerScore / totalScore),
        colors: colorSamples.slice(0, 4).map(sample => sample.hex),
        neutralShare: neutralScore / totalScore,
        contrastRange: maxLuma - minLuma
      };
      resolve(signal);
    } catch (error) {
      resolve({ palette: '', style: '', confidence: 0, colors: [] });
    }
  };
  image.onerror = () => resolve({ palette: '', style: '', confidence: 0, colors: [] });
  image.src = source;
});

const editorPreviewFrames = {
  desktop: {
    full: { width: 1100, height: 720, maxScale: 0.84, minScale: 0.28, paddingX: 150, paddingY: 160 },
    compact: { width: 900, height: 380, maxScale: 0.92, minScale: 0.26, paddingX: 22, paddingY: 118 }
  },
  mobile: {
    full: { width: 470, height: 880, maxScale: 0.82, minScale: 0.28, paddingX: 96, paddingY: 146 },
    compact: { width: 360, height: 520, maxScale: 0.82, minScale: 0.3, paddingX: 20, paddingY: 106 }
  }
};

const getEditorPreviewFrame = (device, compact) => {
  const frameSet = editorPreviewFrames[device] || editorPreviewFrames.desktop;
  return frameSet[compact ? 'compact' : 'full'];
};

const emailMessageKeys = ['confirmed', 'review', 'waitlist', 'runningLate'];

const createDefaultCommunications = () => ({
  confirmed: { active: true, text: "Your booking request is confirmed! We look forward to seeing you." },
  review: { active: true, text: "Hey! Thanks for coming in today. We'd love it if you could leave a quick review." },
  waitlist: { active: true, text: "A spot just opened up for you! Tap here to claim it." },
  runningLate: { active: true, text: "Running 10-15 mins behind. See you soon!" },
  emailProvider: createDefaultEmailConfig()
});

const normalizeCommunications = (communications = {}) => {
  const defaults = createDefaultCommunications();
  return {
    ...defaults,
    ...communications,
    confirmed: { ...defaults.confirmed, ...(communications.confirmed || {}) },
    review: { ...defaults.review, ...(communications.review || {}) },
    waitlist: { ...defaults.waitlist, ...(communications.waitlist || {}) },
    runningLate: { ...defaults.runningLate, ...(communications.runningLate || {}) },
    emailProvider: {
      ...defaults.emailProvider,
      ...(communications.emailProvider || {}),
      templates: {
        ...(defaults.emailProvider?.templates || {}),
        ...(communications.emailProvider?.templates || {})
      }
    }
  };
};

const clampNumber = (value, min, max, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const getLogoDisplay = (settings = {}) => {
  const logoDisplay = settings.logoDisplay || {};
  const size = Number(logoDisplay.size);
  return {
    visible: logoDisplay.visible !== false,
    alignment: logoAlignmentOptions.some(option => option.id === logoDisplay.alignment) ? logoDisplay.alignment : 'left',
    size: Number.isFinite(size) ? Math.min(176, Math.max(48, size)) : 96
  };
};

const identityTextControls = [
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

const getIdentityTextSettings = (settings = {}, config) => {
  const size = clampNumber(settings[config.sizeKey], config.min, config.max, config.fallbackSize);
  const font = settings[config.fontKey] || settings[config.fallbackFontKey] || settings.fontFamily || 'inter';
  return { size, font };
};

const getSpacingControlValue = (settings = {}, key) => {
  const value = settings[key];
  if (value === '' || value === null || value === undefined) return 0;
  return clampNumber(value, -4, 8, 0);
};

function LetterSpacingControl({ settings, onChange }) {
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

function AlignmentButtonGroup({ value, onChange, label = 'Alignment' }) {
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

function FontDropdown({ value, onChange, fallbackLabel = 'Theme Default' }) {
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

function LogoDisplayControls({ settings, onChange, className = '' }) {
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

function IdentityTextControl({ settings, config, onChange }) {
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

function StyleSegmentedControl({ value, onChange, label = 'Style' }) {
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

function ButtonShapeControl({ value, onChange }) {
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

function VisualEditorGroup({ title, note, children }) {
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

function ColorFontControl({ settings, item, onChange }) {
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

const normalizeEmail = (email = '') => email.trim().toLowerCase();
const cleanFirestoreIdPart = (value = '') => (
    String(value || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80) || 'item'
);
const buildSupportThreadId = (ownerId = '', bookingId = '') => (
    `${cleanFirestoreIdPart(ownerId)}_${cleanFirestoreIdPart(bookingId)}`
);

const safeStorageGet = (storage, key) => {
  try {
    return storage?.getItem(key) || null;
  } catch {
    return null;
  }
};

const safeStorageSet = (storage, key, value) => {
  try {
    storage?.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

const safeStorageRemove = (storage, key) => {
  try {
    storage?.removeItem(key);
  } catch {
    // Storage can be unavailable in private, embedded, or homescreen contexts.
  }
};

const safeLocalGet = (key) => safeStorageGet(typeof window !== 'undefined' ? window.localStorage : null, key);
const safeLocalSet = (key, value) => safeStorageSet(typeof window !== 'undefined' ? window.localStorage : null, key, value);
const safeLocalRemove = (key) => safeStorageRemove(typeof window !== 'undefined' ? window.localStorage : null, key);
const safeSessionGet = (key) => safeStorageGet(typeof window !== 'undefined' ? window.sessionStorage : null, key);
const safeSessionSet = (key, value) => safeStorageSet(typeof window !== 'undefined' ? window.sessionStorage : null, key, value);
const safeSessionRemove = (key) => safeStorageRemove(typeof window !== 'undefined' ? window.sessionStorage : null, key);

const getTimestampValue = (value) => {
  if (typeof value === 'number') return value;
  if (value?.toMillis) return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildStaffId = (email = '') => {
  const emailKey = normalizeEmail(email);
  return `staff-${emailKey.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || Date.now()}`;
};

const createOwnerStaffProfile = (signedInUser, color = '#39FF14') => ({
  id: 'owner',
  uid: signedInUser?.uid || '',
  name: signedInUser?.displayName || 'Workspace Owner',
  email: signedInUser?.email || '',
  phone: signedInUser?.phoneNumber || '',
  photoURL: signedInUser?.photoURL || '',
  role: 'owner',
  status: 'connected',
  color
});

const guestModeStorageKey = 'build-a-booking-guest-mode';
const rememberLoginStorageKey = 'build-a-booking-remember-login';
const workspaceRouteStorageKey = 'build-a-booking-workspace-route';
const authRedirectStorageKey = 'build-a-booking-auth-return';
const authRedirectStateStorageKey = 'build-a-booking-auth-return-state';
const authRedirectStartedStorageKey = 'build-a-booking-auth-started';
const googleCalendarRedirectStorageKey = 'build-a-booking-google-calendar-auth';
const workspaceTabIds = ['overview', 'bookings', 'business', 'communications', 'editor', 'clients', 'staff', 'profile'];
const editorTabIds = ['identity', 'themes', 'visuals', 'features', 'copy'];

const safeJsonParse = (value, fallback = null) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const areJsonEqual = (left, right) => {
  if (left === right) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
};

const mergeStateIfChanged = (current, incoming) => {
  const next = { ...current, ...incoming };
  return areJsonEqual(current, next) ? current : next;
};

const normalizeWorkspaceRoute = (route = {}, fallback = {}) => {
  const source = route || {};
  const requestedView = source.view || source.return || source.returnTarget;
  const nextView = ['dashboard', 'client', 'landing'].includes(requestedView)
    ? requestedView
    : fallback.view || 'landing';
  const nextActiveTab = workspaceTabIds.includes(source.activeTab || source.tab)
    ? (source.activeTab || source.tab)
    : fallback.activeTab || 'overview';
  const nextEditorTab = editorTabIds.includes(source.editorTab)
    ? source.editorTab
    : fallback.editorTab || 'themes';

  return {
    view: nextView,
    activeTab: nextView === 'dashboard' ? nextActiveTab : 'overview',
    editorTab: nextEditorTab,
    timestamp: Number(source.timestamp) || Date.now()
  };
};

const getWorkspaceRouteFromUrl = () => {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const dashboardHashMatch = url.hash.match(/^#\/dashboard(?:\/([a-z-]+))?/i);
  const clientHashMatch = url.hash.match(/^#\/client(?:\/portal)?/i);
  const returnTarget = url.searchParams.get('return');
  const tabParam = url.searchParams.get('tab');
  const editorTabParam = url.searchParams.get('editorTab');

  if (url.searchParams.get('auth') === 'google') {
    return normalizeWorkspaceRoute({
      view: ['dashboard', 'client'].includes(returnTarget) ? returnTarget : 'landing',
      activeTab: tabParam,
      editorTab: editorTabParam
    }, { view: 'dashboard', activeTab: 'overview', editorTab: 'themes' });
  }

  if (clientHashMatch) {
    return normalizeWorkspaceRoute({ view: 'client' }, { view: 'client', activeTab: 'overview', editorTab: 'themes' });
  }

  if (dashboardHashMatch) {
    return normalizeWorkspaceRoute({
      view: 'dashboard',
      activeTab: dashboardHashMatch[1],
      editorTab: editorTabParam || url.searchParams.get('editor')
    }, { view: 'dashboard', activeTab: 'overview', editorTab: 'themes' });
  }

  return null;
};

const getSavedWorkspaceRoute = () => (
  normalizeWorkspaceRoute(safeJsonParse(safeLocalGet(workspaceRouteStorageKey)), { view: 'landing', activeTab: 'overview', editorTab: 'themes' })
);

const getInitialWorkspaceRoute = () => {
  if (typeof window === 'undefined' || getPublicBookingSlug()) {
    return { view: 'landing', activeTab: 'overview', editorTab: 'themes', timestamp: Date.now() };
  }
  return getWorkspaceRouteFromUrl() || getSavedWorkspaceRoute();
};

const saveWorkspaceRoute = (route) => {
  const normalized = normalizeWorkspaceRoute(route);
  safeLocalSet(workspaceRouteStorageKey, JSON.stringify(normalized));
  return normalized;
};

const saveAuthReturnState = (route) => {
  const normalized = normalizeWorkspaceRoute(route, { view: 'dashboard', activeTab: 'overview', editorTab: 'themes' });
  const payload = JSON.stringify(normalized);
  safeSessionSet(authRedirectStorageKey, normalized.view);
  safeSessionSet(authRedirectStateStorageKey, payload);
  safeLocalSet(authRedirectStateStorageKey, payload);
  safeSessionSet(authRedirectStartedStorageKey, String(Date.now()));
  safeLocalSet(authRedirectStartedStorageKey, String(Date.now()));
  saveWorkspaceRoute(normalized);
  return normalized;
};

const getAuthReturnState = () => {
  const stored = safeJsonParse(safeSessionGet(authRedirectStateStorageKey)) || safeJsonParse(safeLocalGet(authRedirectStateStorageKey));
  if (stored) return normalizeWorkspaceRoute(stored, { view: 'dashboard', activeTab: 'overview', editorTab: 'themes' });
  const legacyTarget = safeSessionGet(authRedirectStorageKey);
  if (legacyTarget) return normalizeWorkspaceRoute({ view: legacyTarget }, { view: 'dashboard', activeTab: 'overview', editorTab: 'themes' });
  return getGoogleAuthIntent();
};

const clearAuthReturnState = () => {
  safeSessionRemove(authRedirectStorageKey);
  safeSessionRemove(authRedirectStateStorageKey);
  safeLocalRemove(authRedirectStateStorageKey);
  safeSessionRemove(authRedirectStartedStorageKey);
  safeLocalRemove(authRedirectStartedStorageKey);
};

const shouldUseRedirectGoogleAuth = () => {
  if (typeof window === 'undefined') return false;
  if (Capacitor?.isNativePlatform?.()) return true;
  return false;
};

const getGoogleAuthIntent = () => {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  if (url.searchParams.get('auth') !== 'google') return null;
  return normalizeWorkspaceRoute({
    view: ['dashboard', 'client'].includes(url.searchParams.get('return')) ? url.searchParams.get('return') : 'landing',
    activeTab: url.searchParams.get('tab'),
    editorTab: url.searchParams.get('editorTab')
  }, { view: 'dashboard', activeTab: 'overview', editorTab: 'themes' });
};

const clearGoogleAuthIntentUrl = () => {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has('auth')) return;
  url.searchParams.delete('auth');
  url.searchParams.delete('return');
  url.searchParams.delete('tab');
  url.searchParams.delete('editorTab');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
};

const writeGoogleAuthIntentUrl = (route = {}) => {
  if (typeof window === 'undefined') return;
  const normalized = normalizeWorkspaceRoute(route, { view: 'dashboard', activeTab: 'overview', editorTab: 'themes' });
  const url = new URL(window.location.href);
  url.searchParams.set('auth', 'google');
  url.searchParams.set('return', normalized.view);
  if (normalized.view === 'dashboard') {
    url.searchParams.set('tab', normalized.activeTab);
    url.searchParams.set('editorTab', normalized.editorTab);
  } else {
    url.searchParams.delete('tab');
    url.searchParams.delete('editorTab');
  }
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
};

const createGoogleProvider = (options = {}) => {
  const provider = new FirebaseSDK.GoogleAuthProvider();
  if (options.calendar) provider.addScope(GOOGLE_CALENDAR_EVENTS_SCOPE);
  provider.setCustomParameters({ prompt: options.calendar ? 'consent select_account' : 'select_account' });
  return provider;
};

const getGoogleAccessTokenFromResult = (result) => {
  const credential = FirebaseSDK.GoogleAuthProvider.credentialFromResult?.(result);
  return credential?.accessToken || result?._tokenResponse?.oauthAccessToken || '';
};

const signInWithNativeGoogle = async (authInstance, options = {}) => {
  const result = await FirebaseAuthentication.signInWithGoogle(options);
  const idToken = result?.credential?.idToken;
  const accessToken = result?.credential?.accessToken;
  if (!idToken && !accessToken) {
    throw new Error('Google did not return a usable sign-in token. Check the Android Firebase app setup.');
  }
  const credential = FirebaseSDK.GoogleAuthProvider.credential(idToken || null, accessToken || undefined);
  const firebaseResult = await FirebaseSDK.signInWithCredential(authInstance, credential);
  return { firebaseResult, accessToken };
};

// --- Main App Component ---
          export default function App() {
            const isNativeAppRuntime = Capacitor?.isNativePlatform?.() || false;
              const [initialWorkspaceRoute] = useState(getInitialWorkspaceRoute);
              const [user, setUser] = useState(null);
            const [workspaceAccess, setWorkspaceAccess] = useState([]);
            const [activeWorkspaceOwnerId, setActiveWorkspaceOwnerId] = useState('');
            const [accessLoading, setAccessLoading] = useState(false);
            const [view, setView] = useState(initialWorkspaceRoute.view);
            const [loading, setLoading] = useState(true);
            const [authMode, setAuthMode] = useState('signin');
            const [authPersona, setAuthPersona] = useState('owner');
            const [authForm, setAuthForm] = useState({ email: '', password: '' });
            const [authError, setAuthError] = useState('');
            const [authPanelOpen, setAuthPanelOpen] = useState(false);
            const [authBusy, setAuthBusy] = useState(false);
            const [googleCalendarAuth, setGoogleCalendarAuth] = useState({ accessToken: '', email: '', connectedAt: 0 });
            const [googleCalendarSyncing, setGoogleCalendarSyncing] = useState(false);
            const [keepLoggedIn, setKeepLoggedIn] = useState(() => safeLocalGet(rememberLoginStorageKey) !== 'false');
            const [authRedirectPending, setAuthRedirectPending] = useState(() => (
                Boolean(safeSessionGet(authRedirectStartedStorageKey) || safeLocalGet(authRedirectStartedStorageKey) || getGoogleAuthIntent())
            ));
            const [guestMode, setGuestMode] = useState(() => {
                return safeLocalGet(guestModeStorageKey) === 'true';
            });
            const [clientGuestMode, setClientGuestMode] = useState(false);
            const [publicSlug, setPublicSlug] = useState(getPublicBookingSlug);
            const [publicWorkspace, setPublicWorkspace] = useState(null);
            const [publicLoading, setPublicLoading] = useState(false);
            const [publicError, setPublicError] = useState('');
            const [publicReloadKey, setPublicReloadKey] = useState(0);
            const [activeTab, setActiveTab] = useState(initialWorkspaceRoute.activeTab);
            const [dashboardPeriod, setDashboardPeriod] = useState('today');
            const [dashboardThemeMode, setDashboardThemeMode] = useState(() => (
                safeLocalGet('build-a-booking-dashboard-theme') === 'dark' ? 'dark' : 'light'
            ));
            const [editorTab, setEditorTab] = useState(initialWorkspaceRoute.editorTab);
            const [themeFilters, setThemeFilters] = useState({ palette: '', industry: '', style: 'all-styles' });
            const [themeDisplayLimit, setThemeDisplayLimit] = useState(60);
            const [themeBatchLoading, setThemeBatchLoading] = useState(false);
            const [themeTemplateName, setThemeTemplateName] = useState('');
            const [detectedThemePalette, setDetectedThemePalette] = useState('');
            const [detectedThemeStyle, setDetectedThemeStyle] = useState('');
            const [customThemeColor, setCustomThemeColor] = useState('#755CFF');
            const [customThemePaletteOpen, setCustomThemePaletteOpen] = useState(false);
            const [paletteDetecting, setPaletteDetecting] = useState(false);
            const [device, setDevice] = useState('desktop'); 
            const [previewKey, setPreviewKey] = useState(0); 
            const [scale, setScale] = useState(1);
            const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
            const [editorCollapsed, setEditorCollapsed] = useState(false);
            const [, setInstallPromptDismissed] = useState(false);
            const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
            const [isCompactEditorViewport, setIsCompactEditorViewport] = useState(false);
            const [isMobileRuntime, setIsMobileRuntime] = useState(() => (
                typeof window !== 'undefined' && window.matchMedia?.('(max-width: 767px)')?.matches
            ));
            const [isPortraitMobileRuntime, setIsPortraitMobileRuntime] = useState(() => (
                typeof window !== 'undefined' && window.matchMedia?.('(max-width: 767px) and (orientation: portrait)')?.matches
            ));
            const [mobileNavCollapsed, setMobileNavCollapsed] = useState(false);
            const [bookingDeskPeriod, setBookingDeskPeriod] = useState('day');
            const [bookingCustomRange, setBookingCustomRange] = useState(() => {
                const today = getLocalDateStr(new Date());
                return { from: today, to: today };
            });
            const [bookingRangeDialogOpen, setBookingRangeDialogOpen] = useState(false);
            const [bookingFilter, setBookingFilter] = useState('upcoming');
            const [bookingSearch, setBookingSearch] = useState('');
            const [clientRecords, setClientRecords] = useState([]);
            const [clientSearch, setClientSearch] = useState('');
            const [clientDeskFilter, setClientDeskFilter] = useState('all');
            const [selectedClientId, setSelectedClientId] = useState(null);
            const [clientNoteDraft, setClientNoteDraft] = useState('');
            const [clientMobileView, setClientMobileView] = useState('directory');
            const [selectedStaffFileId, setSelectedStaffFileId] = useState(null);
            const [teamPanelMode, setTeamPanelMode] = useState('roster');
            const [activeProfileSection, setActiveProfileSection] = useState('');
            const [showOnboarding, setShowOnboarding] = useState(false);
            const [showOwnerManual, setShowOwnerManual] = useState(false);
            const [onboardingStartScene, setOnboardingStartScene] = useState('intro');
            const containerRef = useRef(null);
            const editorContentRef = useRef(null);
            const themePaletteRailRef = useRef(null);
            const scaleRef = useRef(1);
            const compactViewportRef = useRef(false);
            const settingsRef = useRef(null);
            const onboardingDraftSaveTimerRef = useRef(0);
            const themeBatchTimerRef = useRef(0);
            const [toast, setToast] = useState(null);
            const [confirmDialog, setConfirmDialog] = useState(null);
            const [runningLateDialog, setRunningLateDialog] = useState(null);
            const [supportThreadFocus, setSupportThreadFocus] = useState(null);
            const [legalPanel, setLegalPanel] = useState(null);
            const [ownerNotifications, setOwnerNotifications] = useState([]);
            const [browserNotificationPermission, setBrowserNotificationPermission] = useState(getBrowserNotificationPermission);
            const toastTimerRef = useRef(null);
            const ownerNotificationSeenRef = useRef(new Set());
            const ownerNotificationsReadyRef = useRef(false);
            
            const showToast = (msg) => {
                window.clearTimeout(toastTimerRef.current);
                setToast(msg);
                toastTimerRef.current = window.setTimeout(() => setToast(null), 4000);
            };

            useEffect(() => () => window.clearTimeout(toastTimerRef.current), []);
            useEffect(() => () => window.clearTimeout(onboardingDraftSaveTimerRef.current), []);
            useEffect(() => () => window.clearTimeout(themeBatchTimerRef.current), []);
            useEffect(() => {
                safeLocalSet('build-a-booking-dashboard-theme', dashboardThemeMode);
            }, [dashboardThemeMode]);
            useEffect(() => {
                if (activeTab !== 'profile') setActiveProfileSection('');
            }, [activeTab]);

            useEffect(() => {
                const syncPublicRoute = () => setPublicSlug(getPublicBookingSlug());
                window.addEventListener('popstate', syncPublicRoute);
                window.addEventListener('hashchange', syncPublicRoute);
                return () => {
                    window.removeEventListener('popstate', syncPublicRoute);
                    window.removeEventListener('hashchange', syncPublicRoute);
                };
            }, []);

            useEffect(() => {
                if (typeof document === 'undefined') return undefined;
                const root = document.documentElement;
                root.classList.toggle('capacitor-native', isNativeAppRuntime);
                if (isNativeAppRuntime) root.dataset.platform = Capacitor.getPlatform?.() || 'native';
                return () => {
                    root.classList.remove('capacitor-native');
                    if (root.dataset.platform === 'android' || root.dataset.platform === 'ios' || root.dataset.platform === 'native') {
                        delete root.dataset.platform;
                    }
                };
            }, [isNativeAppRuntime]);

            useEffect(() => {
                if (typeof window === 'undefined') return undefined;

                const mobileQuery = window.matchMedia('(max-width: 767px)');
                const portraitQuery = window.matchMedia('(max-width: 767px) and (orientation: portrait)');
                const updateMobileRuntime = () => {
                    setIsMobileRuntime(current => current === mobileQuery.matches ? current : mobileQuery.matches);
                    setIsPortraitMobileRuntime(current => current === portraitQuery.matches ? current : portraitQuery.matches);
                };

                updateMobileRuntime();
                if (mobileQuery.addEventListener) {
                    mobileQuery.addEventListener('change', updateMobileRuntime);
                    portraitQuery.addEventListener('change', updateMobileRuntime);
                } else {
                    mobileQuery.addListener(updateMobileRuntime);
                    portraitQuery.addListener(updateMobileRuntime);
                }
                window.addEventListener('orientationchange', updateMobileRuntime);
                return () => {
                    if (mobileQuery.removeEventListener) {
                        mobileQuery.removeEventListener('change', updateMobileRuntime);
                        portraitQuery.removeEventListener('change', updateMobileRuntime);
                    } else {
                        mobileQuery.removeListener(updateMobileRuntime);
                        portraitQuery.removeListener(updateMobileRuntime);
                    }
                    window.removeEventListener('orientationchange', updateMobileRuntime);
                };
            }, []);

            useEffect(() => {
                if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

                const root = document.documentElement;
                if (isNativeAppRuntime) {
                    root.classList.remove('app-idle', 'app-hidden');
                    return () => {
                        root.classList.remove('app-idle', 'app-hidden');
                    };
                }
                const idleDelay = window.matchMedia('(max-width: 767px)').matches ? 24000 : 45000;
                let idleTimer = 0;
                let lastActivityAt = 0;

                const setIdle = () => {
                    root.classList.add('app-idle');
                };

                const resetIdle = () => {
                    const now = Date.now();
                    const alreadyActive = !root.classList.contains('app-idle');
                    if (alreadyActive && now - lastActivityAt < 1200) return;
                    lastActivityAt = now;
                    root.classList.remove('app-idle');
                    root.classList.remove('app-hidden');
                    window.clearTimeout(idleTimer);
                    idleTimer = window.setTimeout(setIdle, idleDelay);
                };

                const pauseForPageHide = () => {
                    window.clearTimeout(idleTimer);
                    root.classList.add('app-hidden', 'app-idle');
                };

                const handleVisibility = () => {
                    const hidden = document.visibilityState !== 'visible';
                    root.classList.toggle('app-hidden', hidden);
                    if (hidden) {
                        pauseForPageHide();
                    } else {
                        resetIdle();
                    }
                };

                const passiveOptions = { passive: true };
                const activityEvents = ['pointerdown', 'touchstart', 'keydown', 'scroll', 'wheel'];

                activityEvents.forEach(eventName => {
                    window.addEventListener(eventName, resetIdle, passiveOptions);
                });
                document.addEventListener('visibilitychange', handleVisibility);
                window.addEventListener('pagehide', pauseForPageHide);
                window.addEventListener('pageshow', resetIdle);

                handleVisibility();

                return () => {
                    window.clearTimeout(idleTimer);
                    root.classList.remove('app-idle', 'app-hidden');
                    activityEvents.forEach(eventName => {
                        window.removeEventListener(eventName, resetIdle, passiveOptions);
                    });
                    document.removeEventListener('visibilitychange', handleVisibility);
                    window.removeEventListener('pagehide', pauseForPageHide);
                    window.removeEventListener('pageshow', resetIdle);
                };
            }, [isNativeAppRuntime]);

            const [settings, setSettings] = useState({
                slug: 'studio-noir', brandName: 'Studio Noir',
                welcomeMessage: 'Reserve your private session.', tagline: 'Atelier 7B / Private',
                primaryColor: '#755CFF', headingColor: '#000000', bodyColor: '#666666', backgroundColor: '#ffffff',
                slotBgColor: '#F8FAFC', slotTextColor: '#000000',
                dateBgColor: 'transparent', dateTextColor: '#666666', dateActiveBgColor: '#EEF7FF', dateActiveTextColor: '#000000',
                buttonTextColor: '#000000', 
                fontFamily: 'inter', 
                nativeAccent: true,
                headingFontFamily: '', bodyFontFamily: '', buttonFontFamily: '', slotFontFamily: '', dateFontFamily: '',
                brandNameSize: 76, brandNameFontFamily: '',
                taglineSize: 9, taglineFontFamily: '',
                welcomeSize: 20, welcomeFontFamily: '',
                buttonStyle: 'pill', availabilityStyle: 'solid', dateStyle: 'solid', timeSlotStyle: 'solid', actionButtonStyle: 'solid',
                faqStyle: 'minimal', faqBgColor: 'transparent', faqBorderColor: '#00000020', faqTextColor: '', faqAnswerColor: '', faqFontFamily: '',
                socialIconStyle: 'outline', socialIconBgColor: 'transparent', socialIconColor: '', socialIconTextColor: '',
                dateLabel: 'Which day are you looking to book ?', timeLabel: 'Lets see what time works', buttonText: 'Book Now', confirmButtonText: 'Confirm Booking', 
                detailsHeading: 'Your Details', detailsSubHeading: 'Secure Your Slot', successHeading: 'Booking Confirmed!', 
                availableTimes: ['09:00', '10:30', '12:00', '14:30', '16:00', '17:30'],
                schedule: {},
                staffCalendars: {},
                googleCalendar: { mode: 'manual-sync', connectedEmail: '', connectedAt: 0, lastSyncedAt: 0, lastSyncCount: 0 },
                features: { birthday: true, waitlist: true, socialProof: true, loadingScreen: true, firstAvailable: true, collectClientPhone: true, collectClientEmail: true, collectClientNotes: false, emailUpdates: true, faqEnabled: false, socialLinks: false, location: '', faqs: [] },
                onboarding: {},
                accountProfiles: {},
                themeTemplates: [],
                logoDisplay: { visible: true, alignment: 'left', size: 96 },
                logo: '', bannerImage: '', address: '', socials: { instagram: '', tiktok: '', facebook: '', website: '' }
            });

            useEffect(() => {
                settingsRef.current = settings;
            }, [settings]);

            useEffect(() => {
                setSettings(prev => {
                    if (!prev.nativeAccent || normalizeHexColor(prev.primaryColor, '#000000') !== '#39FF14') return prev;
                    return {
                        ...prev,
                        primaryColor: '#755CFF',
                        slotBgColor: '#F8FAFC',
                        dateActiveBgColor: '#EEF7FF',
                        buttonTextColor: '#050505',
                        availabilityStyle: 'solid',
                        dateStyle: 'solid',
                        timeSlotStyle: 'solid',
                        actionButtonStyle: 'solid'
                    };
                });
            }, []);

            const [bookings, setBookings] = useState([]);
            const [bookingsReady, setBookingsReady] = useState(!isFirebaseConfigured);
            const [staffList, setStaffList] = useState([{id: 'owner', name: 'Admin', color: '#39FF14'}]);
            const [accountProfileOverride, setAccountProfileOverride] = useState({});
            const [communications, setCommunications] = useState(createDefaultCommunications);
            const bookingPageUrl = useMemo(() => `${window.location.origin}/book/${settings.slug || 'studio'}`, [settings.slug]);
            const referralUrl = useMemo(() => `${window.location.origin}/ref/${user?.uid?.substring(0,6) || '10X'}`, [user?.uid]);
            const workspaceOwnerId = activeWorkspaceOwnerId || user?.uid || '';
            const isGuestWorkspace = Boolean(guestMode && !user && !publicSlug);
            const activeWorkspaceGrant = useMemo(
                () => workspaceAccess.find(grant => grant.ownerId === workspaceOwnerId),
                [workspaceAccess, workspaceOwnerId]
            );
            const workspaceRole = user
                ? (workspaceOwnerId === user.uid ? 'owner' : activeWorkspaceGrant?.role || 'staff')
                : (isGuestWorkspace ? 'guest' : 'demo');
            const isWorkspaceOwner = Boolean(user && workspaceOwnerId === user.uid);
            const canManageWorkspace = isGuestWorkspace || workspaceRole === 'owner' || workspaceRole === 'admin';
            const canManageTeam = canManageWorkspace;
            const canSetupWorkspace = !isFirebaseConfigured || canManageWorkspace;
            const onboardingStorageKey = useMemo(
                () => `build-a-booking-showroom-v1-${workspaceOwnerId || 'demo'}`,
                [workspaceOwnerId]
            );
            const workspaceChoices = useMemo(() => {
                if (!user) return [];
                return [
                    { ownerId: user.uid, workspaceName: settings.brandName || 'My Workspace', role: 'owner', ownerEmail: user.email || '' },
                    ...workspaceAccess
                ].filter((workspace, index, list) => list.findIndex(item => item.ownerId === workspace.ownerId) === index);
            }, [settings.brandName, user, workspaceAccess]);
            const accountProfileKey = useMemo(() => (
                user?.uid || normalizeEmail(user?.email || '') || (isGuestWorkspace ? 'guest-workspace' : 'local-account')
            ), [isGuestWorkspace, user?.email, user?.uid]);
            const fallbackAccountName = useMemo(() => {
                const source = user?.displayName || user?.email?.split('@')[0] || (isGuestWorkspace ? 'Guest Workspace' : 'Workspace Owner');
                const parts = String(source || '').trim().split(/\s+/).filter(Boolean);
                return {
                    firstName: parts[0] || '',
                    lastName: parts.slice(1).join(' ')
                };
            }, [isGuestWorkspace, user?.displayName, user?.email]);
            const storedAccountProfile = {
                ...(settings.accountProfiles?.[accountProfileKey] || {}),
                ...(accountProfileOverride || {})
            };
            const personalProfile = useMemo(() => ({
                uid: user?.uid || '',
                firstName: storedAccountProfile.firstName ?? fallbackAccountName.firstName,
                lastName: storedAccountProfile.lastName ?? fallbackAccountName.lastName,
                email: storedAccountProfile.email ?? user?.email ?? '',
                mobile: storedAccountProfile.mobile ?? storedAccountProfile.phone ?? '',
                photoURL: storedAccountProfile.photoURL ?? user?.photoURL ?? '',
                updatedAt: storedAccountProfile.updatedAt || 0
            }), [accountProfileKey, fallbackAccountName.firstName, fallbackAccountName.lastName, settings.accountProfiles, storedAccountProfile.email, storedAccountProfile.firstName, storedAccountProfile.lastName, storedAccountProfile.mobile, storedAccountProfile.phone, storedAccountProfile.photoURL, storedAccountProfile.updatedAt, user?.email, user?.photoURL, user?.uid]);
            const personalDisplayName = useMemo(() => (
                [personalProfile.firstName, personalProfile.lastName].filter(Boolean).join(' ').trim() ||
                user?.displayName ||
                user?.email?.split('@')[0] ||
                (isGuestWorkspace ? 'Guest Workspace' : 'Workspace Owner')
            ), [isGuestWorkspace, personalProfile.firstName, personalProfile.lastName, user?.displayName, user?.email]);
            const displayStaffList = useMemo(() => {
                const emailKey = normalizeEmail(user?.email || '');
                const profileEmailKey = normalizeEmail(personalProfile.email || '');
                return (staffList || []).map(staff => {
                    const isCurrentPerson = (
                        (user?.uid && staff.uid === user.uid) ||
                        (emailKey && normalizeEmail(staff.email || '') === emailKey) ||
                        (profileEmailKey && normalizeEmail(staff.email || '') === profileEmailKey) ||
                        (isWorkspaceOwner && staff.id === 'owner')
                    );
                    if (!isCurrentPerson) return staff;
                    return {
                        ...staff,
                        name: personalDisplayName || staff.name,
                        email: personalProfile.email || staff.email,
                        phone: personalProfile.mobile || staff.phone || '',
                        photoURL: personalProfile.photoURL || staff.photoURL || ''
                    };
                });
            }, [isWorkspaceOwner, personalDisplayName, personalProfile.email, personalProfile.mobile, personalProfile.photoURL, staffList, user?.email, user?.uid]);
            const activeStaffProfile = useMemo(() => {
                if (!user) return displayStaffList.find(staff => staff.id === 'owner') || null;
                const emailKey = normalizeEmail(user.email || '');
                return displayStaffList.find(staff => (
                    staff.id === activeWorkspaceGrant?.staffId ||
                    staff.uid === user.uid ||
                    normalizeEmail(staff.email || '') === emailKey
                )) || (isWorkspaceOwner ? displayStaffList.find(staff => staff.id === 'owner') : null) || displayStaffList[0] || null;
            }, [activeWorkspaceGrant?.staffId, displayStaffList, isWorkspaceOwner, user]);
            const dashboardGreetingName = useMemo(() => {
                const source = personalDisplayName || activeStaffProfile?.name || user?.displayName || user?.email?.split('@')[0] || settings.brandName || 'Builder';
                return String(source).trim().split(/\s+/)[0] || 'Builder';
            }, [activeStaffProfile?.name, personalDisplayName, settings.brandName, user?.displayName, user?.email]);

            const visibleBookings = bookings;
            const exampleBooking = useMemo(() => ({
                id: 'example-booking',
                clientName: 'Example Client',
                clientPhone: '+27 82 000 0000',
                clientEmail: 'client@example.com',
                clientNote: 'Example only. A real client note, app chat, and reschedule request can sit on the record.',
                clientBirthday: '',
                date: 'Example date',
                time: '10:30',
                status: 'pending',
                timestamp: 0,
                noShowHistory: false,
                isExample: true
            }), []);
            const exampleClient = useMemo(() => ({
                id: 'example-client',
                name: 'Example Client',
                phone: '+27 82 000 0000',
                email: 'client@example.com',
                birthday: '',
                notes: 'Example only. Real notes, labels, photos, and booking history will appear here once clients book or are added manually.',
                avatar: '',
                labels: ['Example'],
                autoLabels: ['First Time'],
                bookings: [{ ...exampleBooking, id: 'example-client-history', status: 'confirmed' }],
                bookingCount: 1,
                lastBooking: { ...exampleBooking, status: 'confirmed' },
                source: 'example',
                isExample: true
            }), [exampleBooking]);
            const workspaceMetrics = useMemo(() => {
                const confirmed = visibleBookings.filter(b => b.status === 'confirmed').length;
                const pending = visibleBookings.filter(b => b.status === 'pending' || b.status === 'waitlist').length;
                const conversion = visibleBookings.length ? Math.round((confirmed / visibleBookings.length) * 100) : 0;
                return {
                    requests: visibleBookings.length,
                    confirmed,
                    pending,
                    conversion
                };
            }, [visibleBookings]);

            const bookingDesk = useMemo(() => {
                const today = new Date();
                const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const todayKey = getLocalDateStr(todayStart);
                const tomorrow = new Date(todayStart);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const tomorrowKey = getLocalDateStr(tomorrow);
                const weekEnd = new Date(todayStart);
                weekEnd.setDate(weekEnd.getDate() + 6);
                const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
                const monthEnd = new Date(todayStart.getFullYear(), todayStart.getMonth() + 1, 0);
                const monthLookup = {
                    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
                    may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
                    sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
                };
                const formatRangeDate = (date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                const parseBookingDate = (booking) => {
                    if (booking.dateKey) return booking.dateKey;
                    const rawDate = String(booking.date || '').trim();
                    if (!rawDate) return null;
                    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return rawDate;
                    if (/^today$/i.test(rawDate)) return todayKey;
                    if (/^tomorrow$/i.test(rawDate)) return tomorrowKey;
                    const dayMonthMatch = rawDate.match(/(?:mon|tue|wed|thu|fri|sat|sun)?[a-z]*,?\s*(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?/i);
                    if (dayMonthMatch) {
                        const day = Number(dayMonthMatch[1]);
                        const month = monthLookup[dayMonthMatch[2].toLowerCase()];
                        const year = Number(dayMonthMatch[3]) || todayStart.getFullYear();
                        if (!Number.isNaN(day) && month !== undefined) return getLocalDateStr(new Date(year, month, day));
                    }
                    const parsed = new Date(rawDate);
                    return Number.isNaN(parsed.getTime()) ? null : getLocalDateStr(parsed);
                };
                const periodConfig = {
                    day: {
                        id: 'day',
                        label: 'Day',
                        periodName: 'Day',
                        rangeLabel: todayStart.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }),
                        start: todayStart,
                        end: todayStart
                    },
                    week: {
                        id: 'week',
                        label: 'Week',
                        periodName: 'Week',
                        rangeLabel: `${formatRangeDate(todayStart)} - ${formatRangeDate(weekEnd)}`,
                        start: todayStart,
                        end: weekEnd
                    },
                    month: {
                        id: 'month',
                        label: 'Month',
                        periodName: 'Month',
                        rangeLabel: todayStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
                        start: monthStart,
                        end: monthEnd
                    },
                    custom: {
                        id: 'custom',
                        label: 'Custom',
                        periodName: 'Custom',
                        rangeLabel: `${formatRangeDate(new Date(`${bookingCustomRange.from}T00:00:00`))} - ${formatRangeDate(new Date(`${bookingCustomRange.to || bookingCustomRange.from}T00:00:00`))}`,
                        start: new Date(`${bookingCustomRange.from}T00:00:00`),
                        end: new Date(`${bookingCustomRange.to || bookingCustomRange.from}T00:00:00`)
                    }
                };
                const activePeriod = periodConfig[bookingDeskPeriod] || periodConfig.day;
                const startKey = getLocalDateStr(activePeriod.start);
                const endKey = getLocalDateStr(activePeriod.end);
                const toMinutes = (time = '') => {
                    const match = String(time || '').match(/^(\d{1,2}):(\d{2})/);
                    return match ? (Number(match[1]) * 60) + Number(match[2]) : 9999;
                };
                const sortUpcoming = (rows = []) => [...rows].sort((a, b) => (
                    String(a.dateKeyResolved || '9999-12-31').localeCompare(String(b.dateKeyResolved || '9999-12-31')) ||
                    toMinutes(a.time) - toMinutes(b.time) ||
                    String(b.timestamp || 0).localeCompare(String(a.timestamp || 0))
                ));
                const sortRecent = (rows = []) => [...rows].sort((a, b) => (
                    String(b.dateKeyResolved || '').localeCompare(String(a.dateKeyResolved || '')) ||
                    toMinutes(b.time) - toMinutes(a.time) ||
                    Number(b.timestamp || 0) - Number(a.timestamp || 0)
                ));
                const records = visibleBookings.map(booking => ({
                    ...booking,
                    dateKeyResolved: parseBookingDate(booking)
                }));
                const periodRecords = records.filter(booking => (
                    booking.dateKeyResolved &&
                    booking.dateKeyResolved >= startKey &&
                    booking.dateKeyResolved <= endKey
                ));
                const normalizedSearch = bookingSearch.trim().toLowerCase();
                const searchedRecords = normalizedSearch
                    ? periodRecords.filter(booking => [
                        booking.clientName,
                        booking.clientPhone,
                        booking.clientEmail,
                        booking.clientBirthday,
                        booking.clientNote,
                        booking.date,
                        booking.dateKeyResolved,
                        booking.time,
                        booking.status,
                        booking.staffName,
                        staffList.find(staff => staff.id === booking.staffId)?.name
                    ].filter(Boolean).join(' ').toLowerCase().includes(normalizedSearch))
                    : periodRecords;
                const activeRecords = searchedRecords.filter(booking => booking.status !== 'declined');
                const pending = searchedRecords.filter(booking => booking.status === 'pending').length;
                const waitlist = searchedRecords.filter(booking => booking.status === 'waitlist').length;
                const confirmedRecords = searchedRecords.filter(booking => booking.status === 'confirmed');
                const declinedRecords = searchedRecords.filter(booking => booking.status === 'declined');
                const reviewRecords = searchedRecords.filter(booking => booking.status === 'pending' || booking.status === 'waitlist');
                const upcomingRecords = activeRecords.filter(booking => !booking.dateKeyResolved || booking.dateKeyResolved >= todayKey);
                const historyRecords = searchedRecords.filter(booking => (
                    booking.status === 'declined' ||
                    booking.status === 'completed' ||
                    (booking.dateKeyResolved && booking.dateKeyResolved < todayKey)
                ));
                const eligibleCount = activeRecords.length;
                const bookingRate = eligibleCount ? Math.round((confirmedRecords.length / eligibleCount) * 100) : 0;
                const rowsByFilter = {
                    all: [...sortUpcoming(activeRecords), ...sortRecent(declinedRecords)],
                    review: sortUpcoming(reviewRecords),
                    upcoming: sortUpcoming(upcomingRecords),
                    confirmed: sortUpcoming(confirmedRecords),
                    waitlist: sortUpcoming(searchedRecords.filter(booking => booking.status === 'waitlist')),
                    history: sortRecent(historyRecords)
                };
                const filters = [
                    { id: 'upcoming', label: 'Upcoming', count: upcomingRecords.length },
                    { id: 'review', label: 'Review', count: reviewRecords.length },
                    { id: 'confirmed', label: 'Confirmed', count: confirmedRecords.length },
                    { id: 'waitlist', label: 'Waitlist', count: waitlist },
                    { id: 'history', label: 'History', count: historyRecords.length },
                    { id: 'all', label: 'All', count: searchedRecords.length }
                ];
                const activeFilter = filters.some(filter => filter.id === bookingFilter) ? bookingFilter : 'upcoming';
                const activeFilterLabel = filters.find(filter => filter.id === activeFilter)?.label || 'Upcoming';

                return {
                    periods: Object.values(periodConfig),
                    period: activePeriod,
                    filters,
                    activeFilter,
                    activeFilterLabel,
                    rowsByFilter,
                    filteredRows: rowsByFilter[activeFilter] || rowsByFilter.all,
                    total: searchedRecords.length,
                    periodTotal: periodRecords.length,
                    searchActive: Boolean(normalizedSearch),
                    pending,
                    waitlist,
                    confirmed: confirmedRecords.length,
                    declined: declinedRecords.length,
                    review: reviewRecords.length,
                    upcoming: upcomingRecords.length,
                    history: historyRecords.length,
                    bookingRate,
                    eligibleCount,
                    metrics: [
                        { label: 'Upcoming', value: upcomingRecords.length, hint: activePeriod.id === 'day' ? 'Today' : activePeriod.id === 'week' ? 'This week' : 'This month', icon: CalendarCheck },
                        { label: 'Needs Review', value: reviewRecords.length, hint: `${pending} pending / ${waitlist} waitlist`, icon: Bell },
                        { label: 'Confirmed', value: confirmedRecords.length, hint: `${bookingRate}% booking rate`, icon: CheckCircle2 },
                        { label: 'History', value: historyRecords.length, hint: `${declinedRecords.length} declined`, icon: History }
                    ]
                };
            }, [bookingDeskPeriod, bookingFilter, bookingSearch, visibleBookings, staffList, bookingCustomRange]);

            const filteredBookings = bookingDesk.filteredRows;
            const showBookingExample = bookingsReady && visibleBookings.length === 0;
            const bookingRows = showBookingExample ? [exampleBooking] : filteredBookings;

            const clientLabelOptions = ['VIP', 'Needs Follow-up', 'Prefers Chat', 'High Value', 'No-show Risk'];
            const buildClientKey = (name, phone) => {
                const phoneKey = (phone || '').replace(/\D/g, '');
                const nameKey = (name || 'client').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                return phoneKey ? `phone-${phoneKey}` : `name-${nameKey || 'client'}`;
            };

            const bookingClients = useMemo(() => {
                const clients = new Map();
                visibleBookings.forEach(booking => {
                    const id = buildClientKey(booking.clientName, booking.clientPhone);
                    const existing = clients.get(id) || {
                        id,
                        name: booking.clientName || 'Unnamed Client',
                        phone: booking.clientPhone || '',
                        email: booking.clientEmail || '',
                        birthday: booking.clientBirthday || '',
                        notes: booking.clientNote || '',
                        source: 'booking',
                        bookings: []
                    };
                    existing.name = existing.name || booking.clientName || 'Unnamed Client';
                    existing.phone = existing.phone || booking.clientPhone || '';
                    existing.email = existing.email || booking.clientEmail || '';
                    existing.birthday = existing.birthday || booking.clientBirthday || '';
                    existing.notes = existing.notes || booking.clientNote || '';
                    existing.bookings.push(booking);
                    clients.set(id, existing);
                });

                return Array.from(clients.values()).map(client => {
                    const history = [...client.bookings].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                    const bookingCount = history.length;
                    const autoLabels = [];
                    if (bookingCount >= 3) autoLabels.push('Regular');
                    else if (bookingCount === 2) autoLabels.push('Returning');
                    else if (bookingCount === 1) autoLabels.push('First Time');
                    if (history.some(booking => booking.noShowHistory)) autoLabels.push('No-show Risk');
                    if (history.some(booking => booking.status === 'waitlist')) autoLabels.push('Waitlist');

                    return {
                        ...client,
                        email: client.email || history[0]?.clientEmail || '',
                        birthday: client.birthday || history[0]?.clientBirthday || '',
                        notes: client.notes || history.find(booking => booking.clientNote)?.clientNote || '',
                        bookings: history,
                        bookingCount,
                        lastBooking: history[0] || null,
                        autoLabels
                    };
                });
            }, [visibleBookings]);

            const clientDirectory = useMemo(() => {
                const clients = new Map(bookingClients.map(client => [client.id, client]));

                clientRecords.forEach(record => {
                    const id = record.id || buildClientKey(record.name, record.phone);
                    const bookingProfile = clients.get(id);
                    clients.set(id, {
                        ...(bookingProfile || {}),
                        ...record,
                        id,
                        name: record.name || bookingProfile?.name || 'Unnamed Client',
                        phone: record.phone || bookingProfile?.phone || '',
                        email: record.email || bookingProfile?.email || '',
                        birthday: record.birthday || bookingProfile?.birthday || '',
                        notes: record.notes || bookingProfile?.notes || '',
                        avatar: record.avatar || '',
                        labels: record.labels || [],
                        bookings: bookingProfile?.bookings || [],
                        bookingCount: bookingProfile?.bookingCount || 0,
                        lastBooking: bookingProfile?.lastBooking || null,
                        autoLabels: bookingProfile?.autoLabels?.length ? bookingProfile.autoLabels : ['Manual'],
                        source: bookingProfile?.source || record.source || 'manual',
                        createdAt: record.createdAt || bookingProfile?.lastBooking?.timestamp || Date.now(),
                        updatedAt: record.updatedAt || record.createdAt || bookingProfile?.lastBooking?.timestamp || Date.now()
                    });
                });

                return Array.from(clients.values()).sort((a, b) => (
                    (b.lastBooking?.timestamp || b.updatedAt || b.createdAt || 0) -
                    (a.lastBooking?.timestamp || a.updatedAt || a.createdAt || 0)
                ));
            }, [bookingClients, clientRecords]);

            const clientMetrics = useMemo(() => ({
                total: clientDirectory.length,
                regulars: clientDirectory.filter(client => client.autoLabels?.includes('Regular') || client.labels?.includes('VIP')).length,
                firstTimers: clientDirectory.filter(client => client.autoLabels?.includes('First Time')).length,
                enriched: clientDirectory.filter(client => client.notes || client.avatar || client.labels?.length).length
            }), [clientDirectory]);

            const createOwnerNotification = async (payload, options = {}) => {
                const ownerId = payload?.ownerId || workspaceOwnerId;
                if (!isFirebaseConfigured || !db || !ownerId) return false;
                const notification = {
                    ...payload,
                    ownerId,
                    audience: 'owner',
                    read: Boolean(payload?.read),
                    createdAtMs: payload?.createdAtMs || Date.now(),
                    createdAt: FirebaseSDK.serverTimestamp()
                };
                try {
                    const collectionRef = FirebaseSDK.collection(db, 'artifacts', appId, 'users', ownerId, 'notifications');
                    if (options.id) {
                        await FirebaseSDK.setDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'users', ownerId, 'notifications', options.id), notification, { merge: true });
                    } else {
                        await FirebaseSDK.addDoc(collectionRef, notification);
                    }
                    return true;
                } catch (error) {
                    console.error('Owner notification write failed', error);
                    return false;
                }
            };

            const createClientNotification = async (email, payload, options = {}) => {
                const emailKey = notificationEmailKey(email || payload?.clientEmail);
                if (!isFirebaseConfigured || !db || !emailKey) return false;
                const notification = {
                    ...payload,
                    clientEmail: emailKey,
                    ownerId: payload?.ownerId || workspaceOwnerId,
                    audience: 'client',
                    read: Boolean(payload?.read),
                    createdAtMs: payload?.createdAtMs || Date.now(),
                    createdAt: FirebaseSDK.serverTimestamp()
                };
                try {
                    const collectionRef = FirebaseSDK.collection(db, 'artifacts', appId, 'clientAccess', emailKey, 'notifications');
                    if (options.id) {
                        await FirebaseSDK.setDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'clientAccess', emailKey, 'notifications', options.id), notification, { merge: true });
                    } else {
                        await FirebaseSDK.addDoc(collectionRef, notification);
                    }
                    return true;
                } catch (error) {
                    console.error('Client notification write failed', error);
                    return false;
                }
            };

            const requestOwnerBrowserNotifications = async () => {
                const permission = await requestBrowserNotificationPermission();
                setBrowserNotificationPermission(permission);
                if (permission === 'granted') {
                    showToast('Browser notifications are on.');
                    showBrowserNotification({
                        title: 'Build A Booking alerts are on',
                        body: 'New bookings, chats, and reminders can now reach this device.',
                        tag: 'build-a-booking-permission'
                    });
                    return;
                }
                if (permission === 'denied') showToast('Browser notifications are blocked in this browser.');
                else showToast('Browser notifications are not supported here.');
            };

            const markOwnerNotificationRead = async (notificationId) => {
                if (!notificationId || !isFirebaseConfigured || !db || !workspaceOwnerId) return;
                setOwnerNotifications(prev => prev.map(item => item.id === notificationId ? { ...item, read: true } : item));
                await FirebaseSDK.updateDoc(
                    FirebaseSDK.doc(db, 'artifacts', appId, 'users', workspaceOwnerId, 'notifications', notificationId),
                    { read: true, readAt: FirebaseSDK.serverTimestamp() }
                ).catch(error => console.error('Notification read update failed', error));
            };

            const markAllOwnerNotificationsRead = async () => {
                const unread = ownerNotifications.filter(item => !item.read);
                if (!unread.length || !isFirebaseConfigured || !db || !workspaceOwnerId) return;
                setOwnerNotifications(prev => prev.map(item => ({ ...item, read: true })));
                await Promise.all(unread.slice(0, 40).map(notification => FirebaseSDK.updateDoc(
                    FirebaseSDK.doc(db, 'artifacts', appId, 'users', workspaceOwnerId, 'notifications', notification.id),
                    { read: true, readAt: FirebaseSDK.serverTimestamp() }
                ).catch(error => console.error('Notification read update failed', error))));
            };

            const openOwnerNotification = (notification) => {
                if (notification?.tab) setActiveTab(notification.tab);
                if (notification?.editorTab) setEditorTab(notification.editorTab);
            };

            const dashboardPortfolio = useMemo(() => {
                const today = new Date();
                const todayKey = getLocalDateStr(today);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const tomorrowKey = getLocalDateStr(tomorrow);
                const weekEnd = new Date(today);
                weekEnd.setDate(weekEnd.getDate() + 6);
                const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                const monthLookup = {
                    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
                    may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
                    sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
                };
                const addDays = (date, amount) => {
                    const nextDate = new Date(date);
                    nextDate.setDate(nextDate.getDate() + amount);
                    return nextDate;
                };
                const formatRangeDate = (date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                const parseBookingDate = (booking) => {
                    if (booking.dateKey) return booking.dateKey;
                    const rawDate = String(booking.date || '').trim();
                    if (!rawDate) return null;
                    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return rawDate;
                    if (/^today$/i.test(rawDate)) return todayKey;
                    if (/^tomorrow$/i.test(rawDate)) return tomorrowKey;
                    const dayMonthMatch = rawDate.match(/(?:mon|tue|wed|thu|fri|sat|sun)?[a-z]*,?\s*(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?/i);
                    if (dayMonthMatch) {
                        const day = Number(dayMonthMatch[1]);
                        const month = monthLookup[dayMonthMatch[2].toLowerCase()];
                        const year = Number(dayMonthMatch[3]) || today.getFullYear();
                        if (!Number.isNaN(day) && month !== undefined) return getLocalDateStr(new Date(year, month, day));
                    }
                    const parsed = new Date(rawDate);
                    return Number.isNaN(parsed.getTime()) ? null : getLocalDateStr(parsed);
                };
                const periodConfig = {
                    today: {
                        id: 'today',
                        label: 'Today',
                        title: 'Today at a glance',
                        rangeLabel: today.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }),
                        start: today,
                        end: today,
                        emptyTitle: 'No bookings today',
                        emptyText: 'Today is clear. New requests will appear here as clients book.'
                    },
                    week: {
                        id: 'week',
                        label: 'Week',
                        title: 'This week',
                        rangeLabel: `${formatRangeDate(today)} - ${formatRangeDate(weekEnd)}`,
                        start: today,
                        end: weekEnd,
                        emptyTitle: 'No bookings this week',
                        emptyText: 'This week is open. Confirmed bookings and requests will appear here.'
                    },
                    month: {
                        id: 'month',
                        label: 'Month',
                        title: 'This month',
                        rangeLabel: today.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
                        start: monthStart,
                        end: monthEnd,
                        emptyTitle: 'No bookings this month',
                        emptyText: 'Monthly activity will populate as real clients book.'
                    }
                };
                const activePeriod = periodConfig[dashboardPeriod] || periodConfig.today;
                const startKey = getLocalDateStr(activePeriod.start);
                const endKey = getLocalDateStr(activePeriod.end);
                const defaultTimes = settings.availableTimes || [];
                const dateKeys = [];
                for (let cursor = new Date(activePeriod.start), guard = 0; cursor <= activePeriod.end && guard < 45; cursor = addDays(cursor, 1), guard += 1) {
                    dateKeys.push(getLocalDateStr(cursor));
                }
                const periodCapacity = dateKeys.reduce((total, dateKey) => {
                    const daySchedule = settings.schedule?.[dateKey] || {};
                    const dayAvailable = daySchedule.available ?? true;
                    if (!dayAvailable) return total;
                    const dayTimes = Array.isArray(daySchedule.times) ? daySchedule.times : defaultTimes;
                    return total + dayTimes.length;
                }, 0);

                const bookingsWithDates = visibleBookings.map(booking => ({ ...booking, dateKeyResolved: parseBookingDate(booking) }));
                const activeBookings = bookingsWithDates.filter(booking => booking.status !== 'declined');
                const periodBookings = bookingsWithDates.filter(booking => booking.dateKeyResolved && booking.dateKeyResolved >= startKey && booking.dateKeyResolved <= endKey);
                const periodActiveBookings = periodBookings.filter(booking => booking.status !== 'declined');
                const pending = periodActiveBookings.filter(booking => booking.status === 'pending').length;
                const waitlist = periodActiveBookings.filter(booking => booking.status === 'waitlist').length;
                const confirmed = periodActiveBookings.filter(booking => booking.status === 'confirmed').length;
                const declined = periodBookings.filter(booking => booking.status === 'declined').length;
                const reservedSlots = periodActiveBookings.filter(booking => booking.status !== 'waitlist' && booking.time !== 'Waitlist').length;
                const openSlots = Math.max(0, periodCapacity - reservedSlots);
                const bookingRate = periodActiveBookings.length ? Math.round((confirmed / periodActiveBookings.length) * 100) : 0;
                const periodClientIds = new Set(periodActiveBookings.map(booking => buildClientKey(booking.clientName, booking.clientPhone)));
                const firstTimers = Array.from(periodClientIds).filter(id => {
                    const client = clientDirectory.find(profile => profile.id === id);
                    return !client || client.bookingCount <= 1 || client.autoLabels?.includes('First Time');
                }).length;
                const periodNoShowRisk = periodActiveBookings.filter(booking => booking.noShowHistory).length;
                const todaySchedule = settings.schedule?.[todayKey] || {};
                const todayTimes = Array.isArray(todaySchedule.times) ? todaySchedule.times : defaultTimes;
                const todayAvailable = todaySchedule.available ?? true;
                const todayBookings = bookingsWithDates.filter(booking => booking.dateKeyResolved === todayKey && booking.status !== 'declined');
                const todayReserved = todayBookings.filter(booking => booking.status !== 'waitlist' && booking.time !== 'Waitlist').length;
                const todayOpenSlots = todayAvailable ? Math.max(0, todayTimes.length - todayReserved) : 0;
                const upcomingBookings = activeBookings.filter(booking => !booking.dateKeyResolved || booking.dateKeyResolved >= todayKey);
                const emailAutomations = emailMessageKeys.filter(key => communications[key]?.active).length;
                const emailAutomationTotal = emailMessageKeys.length;
                const pageReadinessItems = [
                    Boolean(settings.brandName),
                    Boolean(settings.slug),
                    defaultTimes.length > 0,
                    Boolean(settings.welcomeMessage),
                    communications.confirmed?.active
                ];
                const pageReadiness = Math.round((pageReadinessItems.filter(Boolean).length / pageReadinessItems.length) * 100);
                const clientEnrichmentRate = clientMetrics.total ? Math.round((clientMetrics.enriched / clientMetrics.total) * 100) : 0;
                const hour = today.getHours();
                const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
                const needsAttention = pending + waitlist;

                return {
                    greeting,
                    periods: Object.values(periodConfig).map(period => ({ id: period.id, label: period.label })),
                    period: activePeriod,
                    startKey,
                    endKey,
                    periodBookings,
                    periodActiveBookings,
                    activityList: periodActiveBookings.length ? periodActiveBookings : [],
                    upcomingBookings,
                    todayBookings,
                    todayOpenSlots,
                    todayCapacity: todayAvailable ? todayTimes.length : 0,
                    todayAvailable,
                    bookingRate,
                    pending,
                    waitlist,
                    confirmed,
                    declined,
                    reservedSlots,
                    openSlots,
                    capacity: periodCapacity,
                    needsAttention,
                    firstTimers,
                    clientCount: periodClientIds.size,
                    noShowRisk: periodNoShowRisk,
                    pageReadiness,
                    clientEnrichmentRate,
                    emailAutomations,
                    emailAutomationTotal,
                    activeBookings: periodActiveBookings.length,
                    allActiveBookings: activeBookings.length
                };
            }, [visibleBookings, dashboardPeriod, settings.schedule, settings.availableTimes, settings.brandName, settings.slug, settings.welcomeMessage, communications, clientMetrics, clientDirectory]);

            const filteredClients = useMemo(() => {
                const query = clientSearch.trim().toLowerCase();
                if (!query) return clientDirectory;
                return clientDirectory.filter(client => (
                    [
                        client.name,
                        client.phone,
                        client.email,
                        ...(client.labels || []),
                        ...(client.autoLabels || [])
                    ].join(' ').toLowerCase().includes(query)
                ));
            }, [clientDirectory, clientSearch]);

            const filteredClientDirectory = useMemo(() => {
                if (clientDeskFilter === 'regulars') {
                    return filteredClients.filter(client => (
                        client.autoLabels?.includes('Regular') || client.labels?.includes('VIP') || client.labels?.includes('Regular')
                    ));
                }
                if (clientDeskFilter === 'first-time') {
                    return filteredClients.filter(client => client.autoLabels?.includes('First Time'));
                }
                if (clientDeskFilter === 'enriched') {
                    return filteredClients.filter(client => client.notes || client.avatar || client.labels?.length);
                }
                return filteredClients;
            }, [clientDeskFilter, filteredClients]);

            const clientDeskFilters = useMemo(() => ([
                { id: 'all', label: 'All', count: clientDirectory.length },
                { id: 'regulars', label: 'Regulars', count: clientMetrics.regulars },
                { id: 'first-time', label: 'First Time', count: clientMetrics.firstTimers },
                { id: 'enriched', label: 'Enriched', count: clientMetrics.enriched }
            ]), [clientDirectory.length, clientMetrics.enriched, clientMetrics.firstTimers, clientMetrics.regulars]);

            const selectedClient = useMemo(() => (
                clientDirectory.find(client => client.id === selectedClientId) || null
            ), [clientDirectory, selectedClientId]);
            const showClientExample = bookingsReady && clientDirectory.length === 0 && !clientSearch.trim();
            const displayClients = showClientExample ? [exampleClient] : filteredClientDirectory;
            const activeClient = selectedClient || (showClientExample && selectedClientId === exampleClient.id ? exampleClient : null);

            const clientProfileByKey = useMemo(() => (
                new Map(clientDirectory.map(client => [client.id, client]))
            ), [clientDirectory]);
            const getBookingClientProfile = (booking = {}) => (
                clientProfileByKey.get(buildClientKey(booking.clientName, booking.clientPhone)) || null
            );
            const getBookingClientAvatar = (booking = {}) => (
                booking.clientPhotoURL ||
                booking.clientAvatar ||
                booking.avatar ||
                getBookingClientProfile(booking)?.avatar ||
                ''
            );

            useEffect(() => {
                if (!clientDirectory.length) {
                    if (selectedClientId !== exampleClient.id) setSelectedClientId(null);
                    return;
                }
                if (selectedClientId && !clientDirectory.some(client => client.id === selectedClientId)) {
                    setSelectedClientId(null);
                    setClientMobileView('directory');
                }
            }, [clientDirectory, exampleClient.id, selectedClientId]);

            useEffect(() => {
                setClientNoteDraft(selectedClient?.notes || '');
            }, [selectedClient?.id]);

            useEffect(() => {
                const syncPermission = () => setBrowserNotificationPermission(getBrowserNotificationPermission());
                syncPermission();
                window.addEventListener('focus', syncPermission);
                document.addEventListener('visibilitychange', syncPermission);
                return () => {
                    window.removeEventListener('focus', syncPermission);
                    document.removeEventListener('visibilitychange', syncPermission);
                };
            }, []);

            useEffect(() => {
                if (!isFirebaseConfigured || !db || !user || !workspaceOwnerId || publicSlug) {
                    setOwnerNotifications([]);
                    ownerNotificationSeenRef.current = new Set();
                    ownerNotificationsReadyRef.current = false;
                    return undefined;
                }
                const notificationsQuery = FirebaseSDK.query(
                    FirebaseSDK.collection(db, 'artifacts', appId, 'users', workspaceOwnerId, 'notifications'),
                    FirebaseSDK.orderBy('createdAtMs', 'desc'),
                    FirebaseSDK.limit(60)
                );
                const unsubscribe = FirebaseSDK.onSnapshot(notificationsQuery, (snap) => {
                    const nextNotifications = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
                    setOwnerNotifications(nextNotifications);

                    const freshNotifications = nextNotifications.filter(notification => !ownerNotificationSeenRef.current.has(notification.id));
                    freshNotifications.forEach(notification => ownerNotificationSeenRef.current.add(notification.id));
                    if (ownerNotificationsReadyRef.current) {
                        freshNotifications
                            .filter(notification => !notification.read)
                            .reverse()
                            .forEach(notification => {
                                if (document.visibilityState !== 'visible' || notification.priority === 'high') {
                                    showBrowserNotification({
                                        title: notification.title,
                                        body: notification.body,
                                        tag: `owner-${notification.id}`,
                                        url: notification.tab ? `/dashboard/${notification.tab}` : '/dashboard/overview'
                                    });
                                }
                            });
                    }
                    ownerNotificationsReadyRef.current = true;
                }, (error) => console.error('Owner notifications sync failed', error));
                return () => unsubscribe();
            }, [user?.uid, workspaceOwnerId, publicSlug]);

            useEffect(() => {
                if (!isFirebaseConfigured || !db || !user || !workspaceOwnerId || !clientDirectory.length) return;
                const today = new Date();
                const todayMonth = today.getMonth() + 1;
                const todayDay = today.getDate();
                const year = today.getFullYear();

                const parseBirthday = (birthday = '') => {
                    const parts = String(birthday || '').match(/\d{1,2}/g);
                    if (!parts || parts.length < 2) return null;
                    const first = Number(parts[0]);
                    const second = Number(parts[1]);
                    if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
                    if (first > 12) return { day: first, month: second };
                    if (second > 12) return { day: second, month: first };
                    return { month: first, day: second };
                };

                clientDirectory.forEach(client => {
                    if (client.isExample || !client.birthday) return;
                    const parsed = parseBirthday(client.birthday);
                    if (!parsed || parsed.month !== todayMonth || parsed.day !== todayDay) return;
                    createOwnerNotification(makeOwnerNotification({
                        type: NOTIFICATION_TYPES.BIRTHDAY_REMINDER,
                        title: `${client.name}'s birthday is today`,
                        body: 'A small birthday note can turn a client profile into a relationship.',
                        ownerId: workspaceOwnerId,
                        tab: 'clients',
                        priority: 'normal',
                        metadata: { clientId: client.id, birthday: client.birthday }
                    }), { id: `birthday-${year}-${client.id}` });
                });
            }, [clientDirectory, db, isFirebaseConfigured, user?.uid, workspaceOwnerId]);

            useEffect(() => {
                if (publicSlug || loading || view !== 'dashboard' || !canSetupWorkspace || isGuestWorkspace) return;
                const workspaceAlreadyHandled = Boolean(settings.onboarding?.completedAt || settings.onboarding?.skippedAt);
                const locallyHandled = safeLocalGet(onboardingStorageKey) === 'done';
                if (workspaceAlreadyHandled || locallyHandled || showOnboarding) return;

                const timer = setTimeout(() => {
                    setOnboardingStartScene('intro');
                    setShowOnboarding(true);
                }, 650);
                return () => clearTimeout(timer);
            }, [
                publicSlug,
                loading,
                view,
                canSetupWorkspace,
                isGuestWorkspace,
                settings.onboarding?.completedAt,
                settings.onboarding?.skippedAt,
                onboardingStorageKey,
                showOnboarding
            ]);

            const navItems = [
                { id: 'overview', icon: Layout, label: 'Dashboard' },
                { id: 'bookings', icon: BookOpen, label: 'My Bookings', badge: visibleBookings.some(b => b.status === 'pending' || b.status === 'waitlist') },
                { id: 'business', icon: Calendar, label: 'Schedule' },
                { id: 'communications', icon: MessageSquare, label: 'Support Inbox' },
                { id: 'editor', icon: Paintbrush, label: 'Editor' },
                { id: 'clients', icon: Star, label: 'My Clients', mobileLabel: 'Clients', badge: clientMetrics.firstTimers > 0 },
                { id: 'staff', icon: Users, label: 'Team' },
                { id: 'profile', icon: User, label: 'Profile' }
            ];
            const normalizedComms = normalizeCommunications(communications);
            const collectsClientPhone = settings.features?.collectClientPhone !== false;
            const collectsClientEmail = settings.features?.collectClientEmail !== false;
            const collectsClientNotes = Boolean(settings.features?.collectClientNotes);
            const emailUpdatesEnabled = settings.features?.emailUpdates !== false;
            const isMobileEditorRuntime = isMobileRuntime || isCompactEditorViewport;
            const isMobileWebEditorRuntime = !isNativeAppRuntime && isMobileEditorRuntime;

            const themeGenerationInputs = useMemo(() => ({
                industry: themeFilters.industry || '',
                palette: themeFilters.palette || 'all',
                style: themeFilters.style || 'all-styles',
                detectedPalette: detectedThemePalette,
                detectedStyle: detectedThemeStyle,
                customColor: customThemeColor
            }), [themeFilters.industry, themeFilters.palette, themeFilters.style, detectedThemePalette, detectedThemeStyle, customThemeColor]);

            const industryThemeFilterGroup = useMemo(() => (
                THEME_FILTER_GROUPS.find(group => group.id === 'industry') || THEME_FILTER_GROUPS[0]
            ), []);
            const paletteThemeFilterGroup = useMemo(() => (
                THEME_FILTER_GROUPS.find(group => group.id === 'palette') || THEME_FILTER_GROUPS[0]
            ), []);
            const styleThemeFilterGroup = useMemo(() => (
                THEME_FILTER_GROUPS.find(group => group.id === 'style') || THEME_FILTER_GROUPS[0]
            ), []);
            const activeThemeFilterId = `${themeGenerationInputs.industry}-${themeGenerationInputs.palette}-${themeGenerationInputs.style}-${themeGenerationInputs.detectedPalette || 'none'}-${themeGenerationInputs.detectedStyle || 'none'}`;
            const shouldRunThemeEngine = activeTab === 'editor' && editorTab === 'themes';

            const visibleThemes = useMemo(() => {
                if (!shouldRunThemeEngine) return [];
                if (!isMobileWebEditorRuntime && !themeGenerationInputs.industry) return [];
                return isMobileWebEditorRuntime ? mobileWebEditorThemes : generateThemeCollection(themeGenerationInputs);
            }, [isMobileWebEditorRuntime, shouldRunThemeEngine, themeGenerationInputs]);

            const industryFilterOptions = useMemo(() => (
                industryThemeFilterGroup.filters.filter(filter => filter.id !== 'all-industries')
            ), [industryThemeFilterGroup]);
            const paletteFilterOptions = useMemo(() => (
                paletteThemeFilterGroup.filters.filter(filter => !['dark', 'earth'].includes(filter.id))
            ), [paletteThemeFilterGroup]);
            const styleFilterOptions = useMemo(() => (
                styleThemeFilterGroup.filters
            ), [styleThemeFilterGroup]);
            const selectedIndustryFilter = industryThemeFilterGroup.filters.find(filter => filter.id === themeGenerationInputs.industry) || null;
            const selectedPaletteFilter = paletteThemeFilterGroup.filters.find(filter => filter.id === themeGenerationInputs.palette) || paletteThemeFilterGroup.filters[0];
            const selectedStyleFilter = styleThemeFilterGroup.filters.find(filter => filter.id === themeGenerationInputs.style) || styleThemeFilterGroup.filters[0];
            const selectedIndustryName = selectedIndustryFilter?.name || 'Choose an industry';
            const selectedIndustryDescriptor = selectedIndustryFilter?.name ? selectedIndustryFilter.name.toLowerCase() : 'your industry';
            const selectedPaletteName = themeGenerationInputs.palette === 'custom' ? 'Custom' : selectedPaletteFilter.name;
            const selectedPaletteHint = themeGenerationInputs.palette === 'custom' ? 'Picked By You' : selectedPaletteFilter.hint;
            const selectedPalettePhrase = themeGenerationInputs.palette === 'custom'
                ? 'your custom color'
                : selectedPaletteFilter.id === 'all'
                    ? 'a full color range'
                    : `${selectedPaletteFilter.name.toLowerCase()} colors`;
            const brandSignalPhrase = detectedThemePalette
                ? `${themePaletteLabel(detectedThemePalette)} brand signal`
                : 'your uploaded brand media';
            const themeBriefSupportText = !themeGenerationInputs.industry
                ? 'Choose the business type first. The engine stays quiet until it knows the world your clients are booking into.'
                : `Now it builds ${selectedPalettePhrase}, then tunes fonts, surfaces, buttons, and booking rhythm for ${selectedIndustryDescriptor}.`;
            const themeBriefResultLabel = !themeGenerationInputs.industry
                ? 'Select an industry to generate custom theme directions'
                : themeGenerationInputs.palette === 'custom'
                    ? `${selectedIndustryDescriptor} consultant picks from your custom color`
                    : selectedPaletteFilter.id === 'all'
                    ? `${selectedIndustryDescriptor} consultant picks across the full palette`
                    : `${selectedIndustryDescriptor} consultant picks in ${selectedPaletteName}`;

            const visibleThemeCards = useMemo(() => (
                visibleThemes.slice(0, themeDisplayLimit)
            ), [visibleThemes, themeDisplayLimit]);
            const savedThemeTemplates = useMemo(() => (
                Array.isArray(settings.themeTemplates) ? settings.themeTemplates : []
            ), [settings.themeTemplates]);
            const currentThemeMatch = useMemo(() => (
                visibleThemes.find(theme => (
                    Boolean(settings.nativeAccent) === Boolean(theme.nativeAccent) &&
                    normalizeHexColor(settings.primaryColor, '#000000') === normalizeHexColor(theme.primaryColor, '#000000') &&
                    normalizeHexColor(settings.backgroundColor, '#ffffff') === normalizeHexColor(theme.backgroundColor, '#ffffff') &&
                    (settings.fontFamily || 'inter') === (theme.fontFamily || 'inter')
                )) || PRESET_THEMES.find(theme => (
                    Boolean(settings.nativeAccent) === Boolean(theme.nativeAccent) &&
                    normalizeHexColor(settings.primaryColor, '#000000') === normalizeHexColor(theme.primaryColor, '#000000') &&
                    normalizeHexColor(settings.backgroundColor, '#ffffff') === normalizeHexColor(theme.backgroundColor, '#ffffff') &&
                    (settings.fontFamily || 'inter') === (theme.fontFamily || 'inter')
                ))
            ), [settings.backgroundColor, settings.fontFamily, settings.nativeAccent, settings.primaryColor, visibleThemes]);
            const suggestedThemeTemplateName = currentThemeMatch?.name
                ? `${currentThemeMatch.name} Template`
                : `${settings.brandName || 'Custom'} Theme`;

            const hasMoreThemes = !isMobileWebEditorRuntime && themeDisplayLimit < visibleThemes.length;
            const nextThemeBatchSize = isMobileEditorRuntime ? 8 : 48;
            const shouldMountEditorPreview = activeTab === 'editor' && !isPortraitMobileRuntime;

            useEffect(() => {
                window.clearTimeout(themeBatchTimerRef.current);
                setThemeBatchLoading(false);
                setThemeDisplayLimit(isMobileWebEditorRuntime ? mobileWebEditorThemes.length : isMobileEditorRuntime ? 8 : 60);
            }, [activeThemeFilterId, isMobileEditorRuntime, isMobileWebEditorRuntime]);

            const loadMoreThemes = () => {
                if (!hasMoreThemes || themeBatchLoading) return;
                setThemeBatchLoading(true);
                window.clearTimeout(themeBatchTimerRef.current);
                themeBatchTimerRef.current = window.setTimeout(() => {
                    setThemeDisplayLimit(limit => Math.min(visibleThemes.length, limit + nextThemeBatchSize));
                    setThemeBatchLoading(false);
                }, isMobileEditorRuntime ? 140 : 70);
            };

            const setThemeFilterValue = (groupId, filterId) => {
                startTransition(() => {
                    setThemeFilters(prev => {
                        if (prev[groupId] === filterId) return prev;
                        if (groupId === 'industry') return { ...prev, industry: filterId, palette: prev.palette || 'all', style: 'all-styles' };
                        return { ...prev, [groupId]: filterId };
                    });
                });
            };

            useEffect(() => {
                const source = settings.logo || settings.bannerImage || '';
                let cancelled = false;

                if (!source) {
                    setDetectedThemePalette('');
                    setDetectedThemeStyle('');
                    return () => { cancelled = true; };
                }

                analyzePaletteFromImageSource(source).then((signal) => {
                    if (!cancelled) {
                        setDetectedThemePalette(signal.palette || '');
                        setDetectedThemeStyle(signal.style || '');
                    }
                });

                return () => { cancelled = true; };
            }, [settings.logo, settings.bannerImage]);

            const handleAutoDetectThemePalette = async () => {
                const source = settings.logo || settings.bannerImage || '';
                if (!source) {
                    showToast('Upload a logo or banner first, then I can read the palette.');
                    return;
                }

                setPaletteDetecting(true);
                const detected = await analyzePaletteFromImageSource(source);
                setPaletteDetecting(false);

                if (!detected.palette) {
                    showToast('I could not read enough color from that image yet.');
                    return;
                }

                setDetectedThemePalette(detected.palette);
                setDetectedThemeStyle(detected.style || '');
                setThemeFilters(prev => ({
                    ...prev,
                    palette: detected.palette
                }));
                showToast(`${themePaletteLabel(detected.palette)} palette detected from your brand media.`);
            };

            const scrollThemePaletteRail = (direction) => {
                if (!themePaletteRailRef.current) return;
                themePaletteRailRef.current.scrollBy({ left: direction * 312, behavior: 'smooth' });
            };

            const isMobileEditorViewport = (container = containerRef.current) => {
                const rect = container?.getBoundingClientRect();
                const constrainedStage = rect ? rect.height < 650 : false;
                const mobileLandscape = window.matchMedia('(pointer: coarse)').matches && window.matchMedia('(orientation: landscape)').matches;
                return (
                    window.innerWidth < 768 ||
                    window.innerHeight <= 560 ||
                    constrainedStage ||
                    mobileLandscape
                );
            };

            const handleAddToHomeScreen = async () => {
                setInstallPromptDismissed(true);

                if (deferredInstallPrompt) {
                    try {
                        deferredInstallPrompt.prompt();
                        const choice = await deferredInstallPrompt.userChoice;
                        setDeferredInstallPrompt(null);
                        showToast(choice?.outcome === 'accepted'
                            ? 'Build A Booking was added to your home screen.'
                            : 'You can add it later from the browser menu.'
                        );
                        return;
                    } catch (error) {
                        console.error(error);
                    }
                }

                const shareData = {
                    title: 'Build A Booking',
                    text: 'Open Build A Booking from your home screen for the cleanest editor view.',
                    url: window.location.href
                };

                try {
                    if (navigator.share) {
                        await navigator.share(shareData);
                        showToast('Choose Add to Home Screen from the share menu.');
                        return;
                    }
                } catch (error) {
                    if (error?.name === 'AbortError') return;
                    console.error(error);
                }

                showToast('Use your browser share button, then choose Add to Home Screen.');
            };

            useEffect(() => {
                if (activeTab !== 'editor' || !shouldMountEditorPreview) return undefined;

                let frameRequest = 0;
                const updateScale = () => {
                    window.cancelAnimationFrame(frameRequest);
                    frameRequest = window.requestAnimationFrame(() => {
                    if (!containerRef.current) return;
                    const c = containerRef.current;
                    const rect = c.getBoundingClientRect();
                    const compact = activeTab === 'editor' && isMobileEditorViewport(c);
                    if (compactViewportRef.current !== compact) {
                        compactViewportRef.current = compact;
                        setIsCompactEditorViewport(compact);
                    }
                    const frame = getEditorPreviewFrame(device, compact);
                    const collapsedNavGain = compact && mobileNavCollapsed ? 24 : 0;
                    const collapsedPanelGain = editorCollapsed ? (compact ? 16 : 28) : 0;
                    const paddingX = Math.max(12, frame.paddingX - collapsedPanelGain);
                    const paddingY = Math.max(58, frame.paddingY - collapsedNavGain);
                    const nextScale = Math.min(
                        (rect.width - paddingX) / frame.width,
                        (rect.height - paddingY) / frame.height,
                        frame.maxScale
                    );
                    const boundedScale = Math.max(frame.minScale, nextScale);
                    if (Math.abs(scaleRef.current - boundedScale) > 0.002) {
                        scaleRef.current = boundedScale;
                        setScale(boundedScale);
                    }
                    });
                };

                updateScale();
                const t1 = setTimeout(updateScale, 50);
                const t2 = setTimeout(updateScale, 400);
                const t3 = setTimeout(updateScale, 800);
                const t4 = setTimeout(updateScale, 1200);
                const resizeObserver = typeof ResizeObserver !== 'undefined' && containerRef.current
                    ? new ResizeObserver(updateScale)
                    : null;
                if (resizeObserver && containerRef.current) resizeObserver.observe(containerRef.current);
                
                window.addEventListener('resize', updateScale);
                
                return () => { 
                    clearTimeout(t1); 
                    clearTimeout(t2); 
                    clearTimeout(t3); 
                    clearTimeout(t4);
                    window.cancelAnimationFrame(frameRequest);
                    resizeObserver?.disconnect();
                    window.removeEventListener('resize', updateScale); 
                };
            }, [device, activeTab, sidebarCollapsed, editorCollapsed, mobileNavCollapsed, shouldMountEditorPreview]);

            useEffect(() => {
                if (activeTab !== 'editor') return;
                let lastLandscape = window.matchMedia('(orientation: landscape)').matches;
                let settleTimer = 0;

                const resetMobileEditorPosition = () => {
                    setEditorCollapsed(false);
                    setMobileNavCollapsed(false);
                    requestAnimationFrame(() => {
                        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
                        document.documentElement.scrollLeft = 0;
                        document.body.scrollLeft = 0;
                        containerRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
                        editorContentRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
                    });
                };

                const handleOrientationSettle = () => {
                    window.clearTimeout(settleTimer);
                    settleTimer = window.setTimeout(() => {
                        const nextLandscape = window.matchMedia('(orientation: landscape)').matches;
                        if (nextLandscape === lastLandscape) return;
                        lastLandscape = nextLandscape;
                        resetMobileEditorPosition();
                    }, 180);
                };

                window.addEventListener('orientationchange', handleOrientationSettle);
                window.addEventListener('resize', handleOrientationSettle);
                return () => {
                    window.clearTimeout(settleTimer);
                    window.removeEventListener('orientationchange', handleOrientationSettle);
                    window.removeEventListener('resize', handleOrientationSettle);
                };
            }, [activeTab]);

            useEffect(() => {
                const handleBeforeInstallPrompt = (event) => {
                    event.preventDefault();
                    setDeferredInstallPrompt(event);
                };
                window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
                return () => {
                    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
                };
            }, []);

            useEffect(() => {
                if (activeTab !== 'editor') {
                    setMobileNavCollapsed(false);
                }
            }, [activeTab]);

            useEffect(() => {
                if (typeof window === 'undefined') return;
                const shouldLoadDesignerFonts = publicSlug || (activeTab === 'editor' && editorTab === 'visuals' && !isMobileEditorRuntime);
                if (shouldLoadDesignerFonts) {
                    window.__loadBuildABookingFonts?.();
                    window.dispatchEvent(new Event('build-a-booking:load-fonts'));
                }
            }, [activeTab, editorTab, isMobileEditorRuntime, publicSlug]);

            useEffect(() => {
                if (publicSlug || loading) return;
                const route = saveWorkspaceRoute({ view, activeTab, editorTab });
                if (typeof window === 'undefined' || window.location.search.includes('auth=google')) return;
                const nextHash = route.view === 'dashboard'
                    ? `#/dashboard/${route.activeTab}`
                    : route.view === 'client'
                        ? '#/client'
                        : '';
                if (window.location.hash !== nextHash) {
                    window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}${nextHash}`);
                }
            }, [publicSlug, loading, view, activeTab, editorTab]);

            const applyWorkspaceRoute = (route = {}) => {
                const nextRoute = normalizeWorkspaceRoute(route, { view: 'dashboard', activeTab: 'overview', editorTab: 'themes' });
                setView(nextRoute.view);
                if (nextRoute.view === 'dashboard') {
                    setActiveTab(nextRoute.activeTab);
                    if (nextRoute.activeTab === 'editor') setEditorTab(nextRoute.editorTab || 'themes');
                }
                saveWorkspaceRoute(nextRoute);
            };

            useEffect(() => {
                if (publicSlug || loading || typeof window === 'undefined') return;

                const syncRouteFromLocation = () => {
                    if (window.location.search.includes('auth=google')) return;
                    const nextRoute = getWorkspaceRouteFromUrl();
                    if (!nextRoute) return;

                    saveWorkspaceRoute(nextRoute);
                    setView(currentView => currentView === nextRoute.view ? currentView : nextRoute.view);
                    if (nextRoute.view === 'dashboard') {
                        setActiveTab(currentTab => currentTab === nextRoute.activeTab ? currentTab : nextRoute.activeTab);
                        if (nextRoute.activeTab === 'editor') {
                            setEditorTab(currentEditorTab => currentEditorTab === nextRoute.editorTab ? currentEditorTab : nextRoute.editorTab);
                        }
                    }
                };

                window.addEventListener('hashchange', syncRouteFromLocation);
                window.addEventListener('popstate', syncRouteFromLocation);
                return () => {
                    window.removeEventListener('hashchange', syncRouteFromLocation);
                    window.removeEventListener('popstate', syncRouteFromLocation);
                };
            }, [publicSlug, loading]);

            const getCurrentAuthReturnRoute = () => normalizeWorkspaceRoute({
                view: 'dashboard',
                activeTab: view === 'dashboard' ? activeTab : 'overview',
                editorTab
            }, { view: 'dashboard', activeTab: 'overview', editorTab: 'themes' });

            const getAuthReturnRouteForPersona = (persona = authPersona) => (
                persona === 'client'
                    ? normalizeWorkspaceRoute({ view: 'client' }, { view: 'client', activeTab: 'overview', editorTab: 'themes' })
                    : getCurrentAuthReturnRoute()
            );

            const applyAuthPersistence = async (remember = keepLoggedIn) => {
                safeLocalSet(rememberLoginStorageKey, remember ? 'true' : 'false');
                if (!isFirebaseConfigured || !auth || !FirebaseSDK.setPersistence) return;
                const persistence = remember
                    ? FirebaseSDK.browserLocalPersistence
                    : FirebaseSDK.browserSessionPersistence;
                await FirebaseSDK.setPersistence(auth, persistence);
            };

            useEffect(() => {
                applyAuthPersistence(keepLoggedIn).catch((error) => {
                    console.error('Auth persistence could not be updated.', error);
                });
            }, [keepLoggedIn]);

            const syncCurrentAccount = async (signedInUser) => {
                if (!isFirebaseConfigured || !signedInUser?.email) return;
                const emailKey = normalizeEmail(signedInUser.email);
                const profile = {
                    uid: signedInUser.uid,
                    email: emailKey,
                    displayName: signedInUser.displayName || emailKey.split('@')[0],
                    photoURL: signedInUser.photoURL || '',
                    providerIds: signedInUser.providerData?.map(provider => provider.providerId) || [],
                    updatedAt: Date.now()
                };
                await Promise.all([
                    FirebaseSDK.setDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'accounts', signedInUser.uid), profile, { merge: true }),
                    FirebaseSDK.setDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'accountLookup', emailKey), profile, { merge: true })
                ]);
            };

            useEffect(() => {
                let cancelled = false;
                if (!isFirebaseConfigured || !user?.uid) {
                    setAccountProfileOverride({});
                    return undefined;
                }
                FirebaseSDK.getDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'accounts', user.uid))
                    .then((docSnap) => {
                        if (cancelled || !docSnap.exists()) return;
                        const accountData = docSnap.data();
                        const savedProfile = accountData.personalProfile || {};
                        setAccountProfileOverride({
                            firstName: savedProfile.firstName || accountData.firstName || '',
                            lastName: savedProfile.lastName || accountData.lastName || '',
                            email: savedProfile.email || accountData.email || user.email || '',
                            mobile: savedProfile.mobile || accountData.mobile || accountData.phone || '',
                            photoURL: savedProfile.photoURL || accountData.photoURL || user.photoURL || ''
                        });
                    })
                    .catch(error => console.error('Account profile load failed', error));
                return () => {
                    cancelled = true;
                };
            }, [user?.uid, user?.email, user?.photoURL]);

            const loadWorkspaceAccess = async (signedInUser) => {
                if (!isFirebaseConfigured || !signedInUser?.email) {
                    setWorkspaceAccess([]);
                    setActiveWorkspaceOwnerId(signedInUser?.uid || '');
                    return;
                }

                setAccessLoading(true);
                try {
                    const emailKey = normalizeEmail(signedInUser.email);
                    const grantsRef = FirebaseSDK.collection(db, 'artifacts', appId, 'staffAccess', emailKey, 'workspaces');
                    const grantsSnap = await FirebaseSDK.getDocs(grantsRef);
                    const grants = grantsSnap.docs
                        .map(grantDoc => ({ id: grantDoc.id, ...grantDoc.data() }))
                        .filter(grant => grant.status !== 'revoked');
                    const savedOwnerId = safeLocalGet('build-a-booking-active-workspace');
                    const hasSavedWorkspace = savedOwnerId && (savedOwnerId === signedInUser.uid || grants.some(grant => grant.ownerId === savedOwnerId));
                    const nextOwnerId = hasSavedWorkspace ? savedOwnerId : (grants[0]?.ownerId || signedInUser.uid);
                    setWorkspaceAccess(grants);
                    setActiveWorkspaceOwnerId(nextOwnerId);
                    safeLocalSet('build-a-booking-active-workspace', nextOwnerId);
                } catch (error) {
                    console.error(error);
                    setWorkspaceAccess([]);
                    setActiveWorkspaceOwnerId(signedInUser.uid);
                    setAuthError('Signed in, but staff workspace access could not be checked yet.');
                } finally {
                    setAccessLoading(false);
                }
            };

            const startGoogleRedirect = async (returnRoute = { view: 'dashboard' }, options = {}) => {
                const provider = createGoogleProvider({ calendar: Boolean(options.calendar) });
                await applyAuthPersistence(keepLoggedIn);
                setAuthRedirectPending(true);
                const savedReturnRoute = saveAuthReturnState(returnRoute);
                if (options.calendar) safeSessionSet(googleCalendarRedirectStorageKey, 'true');
                writeGoogleAuthIntentUrl(savedReturnRoute);
                try {
                    await FirebaseSDK.signInWithRedirect(auth, provider);
                } catch (error) {
                    setAuthRedirectPending(false);
                    clearAuthReturnState();
                    clearGoogleAuthIntentUrl();
                    safeSessionRemove(googleCalendarRedirectStorageKey);
                    throw error;
                }
            };

            useEffect(() => {
                const initAuth = async () => {
                    try {
                        if (isFirebaseConfigured) {
                            await applyAuthPersistence(keepLoggedIn);
                            const googleAuthIntent = getGoogleAuthIntent();
                            const redirectWasStarted = Boolean(safeSessionGet(authRedirectStartedStorageKey) || safeLocalGet(authRedirectStartedStorageKey));
                            if (redirectWasStarted || googleAuthIntent) setAuthRedirectPending(true);
                            if (!publicSlug) {
                                let redirectResult = null;
                                redirectResult = await FirebaseSDK.getRedirectResult(auth).catch((error) => {
                                    console.error(error);
                                    clearAuthReturnState();
                                    clearGoogleAuthIntentUrl();
                                    safeSessionRemove(googleCalendarRedirectStorageKey);
                                    const message = error?.code === 'auth/unauthorized-domain'
                                        ? 'Google sign-in needs this domain allowed in Firebase Authentication.'
                                        : error?.code === 'auth/web-storage-unsupported'
                                            ? 'Your browser blocked the secure Google return. Try again or turn off private browsing for this site.'
                                            : error.message || 'Google sign-in could not finish.';
                                    setAuthError(message);
                                    setAuthRedirectPending(false);
                                    return null;
                                });
                                if (redirectResult?.user && safeSessionGet(googleCalendarRedirectStorageKey) === 'true') {
                                    const accessToken = getGoogleAccessTokenFromResult(redirectResult);
                                    if (accessToken) {
                                        setGoogleCalendarAuth({
                                            accessToken,
                                            email: redirectResult.user.email || '',
                                            connectedAt: Date.now()
                                        });
                                    }
                                    safeSessionRemove(googleCalendarRedirectStorageKey);
                                }
                                if (redirectWasStarted) {
                                    safeSessionRemove(authRedirectStartedStorageKey);
                                    safeLocalRemove(authRedirectStartedStorageKey);
                                    clearGoogleAuthIntentUrl();
                                    if (!auth.currentUser && !redirectResult?.user) {
                                        clearAuthReturnState();
                                        setAuthRedirectPending(false);
                                    }
                                } else if (googleAuthIntent && !auth.currentUser) {
                                    await startGoogleRedirect(googleAuthIntent);
                                    return;
                                } else if (googleAuthIntent && auth.currentUser) {
                                    clearGoogleAuthIntentUrl();
                                }
                            }
                            if (!publicSlug && initialAuthToken) await FirebaseSDK.signInWithCustomToken(auth, initialAuthToken);
                        } else setLoading(false);
                    } catch (err) {
                        const message = err?.code === 'auth/configuration-not-found'
                            ? 'Firebase Auth is not enabled yet. Enable Email/Password and Anonymous sign-in in Firebase Authentication.'
                            : 'Firebase sign-in could not start. Check your Firebase Auth setup and try again.';
                        setAuthError(message);
                        if (publicSlug) setPublicError(message);
                        setLoading(false);
                        setPublicLoading(false);
                    }
                };
                initAuth();
                if (isFirebaseConfigured) {
                    return FirebaseSDK.onAuthStateChanged(auth, (u) => {
                        setUser(u);
                        setLoading(false);
                        setAuthBusy(false);
                        if (!u) {
                            setWorkspaceAccess([]);
                            setActiveWorkspaceOwnerId('');
                            const redirectStillStarting = Boolean(safeSessionGet(authRedirectStartedStorageKey) || safeLocalGet(authRedirectStartedStorageKey) || getGoogleAuthIntent());
                            setAuthRedirectPending(redirectStillStarting);
                            return;
                        }
                        setAuthRedirectPending(false);
                        setGuestMode(false);
                        setClientGuestMode(false);
                        safeLocalRemove(guestModeStorageKey);
                        const authReturnState = getAuthReturnState();
                        if (authReturnState?.view === 'dashboard' || authReturnState?.view === 'client') {
                            applyWorkspaceRoute(authReturnState);
                            clearAuthReturnState();
                            setAuthPanelOpen(false);
                            showToast('Signed in with Google');
                        }
                        if (!publicSlug) {
                            syncCurrentAccount(u).catch(console.error);
                            loadWorkspaceAccess(u);
                        }
                    });
                }
            }, [publicSlug]);

            useEffect(() => {
                if (isFirebaseConfigured && !publicSlug && !loading && view === 'dashboard' && !user && !guestMode && !authRedirectPending) {
                    setView('landing');
                }
            }, [view, user, publicSlug, guestMode, loading, authRedirectPending]);

            useEffect(() => {
                if (!publicSlug) return;
                if (!isFirebaseConfigured) {
                    setPublicError('Firebase is not configured yet.');
                    setPublicLoading(false);
                    return;
                }

                let cancelled = false;
                setPublicLoading(true);
                setPublicError('');
                setPublicWorkspace(null);
                const workspaceRef = FirebaseSDK.doc(db, 'artifacts', appId, 'public', 'data', 'workspaces', publicSlug);
                const timeoutId = window.setTimeout(() => {
                    if (cancelled) return;
                    setPublicError('This booking page is taking longer than expected to load. Check your connection and try again.');
                    setPublicLoading(false);
                }, 12000);
                FirebaseSDK.getDoc(workspaceRef)
                    .then((docSnap) => {
                        if (cancelled) return;
                        if (!docSnap.exists()) {
                            setPublicError('This booking page is not published yet.');
                            setPublicWorkspace(null);
                            return;
                        }
                        setPublicWorkspace(docSnap.data());
                    })
                    .catch((error) => {
                        if (cancelled) return;
                        console.error(error);
                        setPublicError('Could not load this booking page.');
                    })
                    .finally(() => {
                        if (cancelled) return;
                        window.clearTimeout(timeoutId);
                        setPublicLoading(false);
                    });

                return () => {
                    cancelled = true;
                    window.clearTimeout(timeoutId);
                };
            }, [publicSlug, publicReloadKey]);

            useEffect(() => {
                if (publicSlug) {
                    setBookingsReady(true);
                    return undefined;
                }
                if ((!user || !workspaceOwnerId) && isFirebaseConfigured) return undefined;
                if (!isFirebaseConfigured) {
                    setBookingsReady(true);
                    return undefined;
                }
                setBookingsReady(false);

                const handleSyncError = (label) => (error) => {
                    console.error(`${label} sync failed`, error);
                };
                const settingsRef = FirebaseSDK.doc(db, 'artifacts', appId, 'users', workspaceOwnerId, 'config', 'settings');
                const unsubSettings = FirebaseSDK.onSnapshot(settingsRef, (docSnap) => { 
                    if (docSnap.exists()) {
                        const data = { ...docSnap.data() };
                        if(data.fontFamily === 'sans') data.fontFamily = 'inter';
                        if(data.fontFamily === 'serif') data.fontFamily = 'playfair';
                        if(data.fontFamily === 'mono') data.fontFamily = 'space-mono';
                        if(data.fontFamily === 'display') data.fontFamily = 'syne';
                        setSettings(prev => mergeStateIfChanged(prev, data));
                    }
                }, handleSyncError('Settings'));
                
                const staffRef = FirebaseSDK.doc(db, 'artifacts', appId, 'users', workspaceOwnerId, 'config', 'staff');
                const unsubStaff = FirebaseSDK.onSnapshot(staffRef, (docSnap) => { 
                    if (docSnap.exists()) {
                        const nextStaff = docSnap.data().list || [];
                        setStaffList(prev => areJsonEqual(prev, nextStaff) ? prev : nextStaff);
                    } else if (isWorkspaceOwner) {
                        const ownerProfile = [createOwnerStaffProfile({
                            ...user,
                            displayName: personalDisplayName,
                            email: personalProfile.email || user?.email || '',
                            photoURL: personalProfile.photoURL || user?.photoURL || '',
                            phoneNumber: personalProfile.mobile || user?.phoneNumber || ''
                        })];
                        setStaffList(prev => areJsonEqual(prev, ownerProfile) ? prev : ownerProfile);
                    }
                }, handleSyncError('Staff'));

                const commsRef = FirebaseSDK.doc(db, 'artifacts', appId, 'users', workspaceOwnerId, 'config', 'communications');
                const unsubComms = FirebaseSDK.onSnapshot(commsRef, (docSnap) => { 
                    if (docSnap.exists()) {
                        const nextComms = normalizeCommunications(docSnap.data());
                        setCommunications(prev => areJsonEqual(prev, nextComms) ? prev : nextComms);
                    }
                }, handleSyncError('Communication'));

                const clientsRef = FirebaseSDK.doc(db, 'artifacts', appId, 'users', workspaceOwnerId, 'config', 'clients');
                const unsubClients = FirebaseSDK.onSnapshot(clientsRef, (docSnap) => { 
                    if (docSnap.exists()) {
                        const nextClients = docSnap.data().list || [];
                        setClientRecords(prev => areJsonEqual(prev, nextClients) ? prev : nextClients);
                    }
                }, handleSyncError('Client'));

                const bookingsCol = FirebaseSDK.collection(db, 'artifacts', appId, 'users', workspaceOwnerId, 'bookings');
                const unsubBookings = FirebaseSDK.onSnapshot(bookingsCol, (snap) => {
                    const nextBookings = snap.docs
                        .map(doc => ({ id: doc.id, ...doc.data() }))
                        .sort((a, b) => getTimestampValue(b.timestamp) - getTimestampValue(a.timestamp));
                    setBookings(prev => areJsonEqual(prev, nextBookings) ? prev : nextBookings);
                    setBookingsReady(true);
                }, (error) => {
                    handleSyncError('Booking')(error);
                    setBookingsReady(true);
                });
                return () => { unsubSettings(); unsubStaff(); unsubComms(); unsubClients(); unsubBookings(); };
            }, [user, workspaceOwnerId, isWorkspaceOwner, publicSlug, personalDisplayName, personalProfile.email, personalProfile.mobile, personalProfile.photoURL]);

            const publishSettings = async (nextSettings = settings, successMessage = "Booking page published!", options = {}) => {
                const silent = Boolean(options.silent);
                if (!user || !workspaceOwnerId || !isFirebaseConfigured) {
                    if (!silent) showToast("Workspace updated in demo mode.");
                    return true;
                }
                if (!canManageWorkspace) {
                    if (!silent) showToast("Only owners and admins can publish workspace settings.");
                    return false;
                }
                if (!silent) showToast("Publishing updates...");
                try {
                    const publicSlug = buildBookingSlug(nextSettings.slug || nextSettings.brandName);
                    const settingsToPublish = {
                        ...nextSettings,
                        slug: publicSlug,
                        publishedAt: nextSettings.publishedAt || Date.now(),
                        updatedAt: Date.now()
                    };
                    if (publicSlug !== settings.slug) {
                        setSettings(prev => ({ ...prev, slug: publicSlug }));
                    }
                    await FirebaseSDK.setDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'users', workspaceOwnerId, 'config', 'settings'), settingsToPublish);
                    const { accountProfiles, ...publicSettingsToPublish } = settingsToPublish;
                    await FirebaseSDK.setDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'public', 'data', 'workspaces', publicSlug), {
                        ...publicSettingsToPublish,
                        ownerId: workspaceOwnerId,
                        ownerEmail: user?.email || '',
                        workspaceName: publicSettingsToPublish.brandName || 'Build A Booking Workspace'
                    });
                    if (!silent) showToast(successMessage);
                    return true;
                } catch (err) {
                    console.error(err);
                    if (!silent) showToast("Failed to publish.");
                    return false;
                }
            };

            const saveSettings = async () => {
                await publishSettings(settings);
            };

            const saveSettingsDraft = async (nextSettings = settings, successMessage = "Editor draft saved.") => {
                const draftSettings = {
                    ...nextSettings,
                    updatedAt: Date.now()
                };
                if (!user || !workspaceOwnerId || !isFirebaseConfigured) {
                    setSettings(draftSettings);
                    showToast(successMessage);
                    return true;
                }
                if (!canManageWorkspace) {
                    showToast("Only owners and admins can save workspace settings.");
                    return false;
                }
                try {
                    await FirebaseSDK.setDoc(
                        FirebaseSDK.doc(db, 'artifacts', appId, 'users', workspaceOwnerId, 'config', 'settings'),
                        draftSettings,
                        { merge: true }
                    );
                    setSettings(prev => ({ ...prev, ...draftSettings }));
                    showToast(successMessage);
                    return true;
                } catch (err) {
                    console.error(err);
                    showToast("Draft could not be saved.");
                    return false;
                }
            };

            const markOnboardingHandled = () => {
                safeLocalSet(onboardingStorageKey, 'done');
            };

            const handleOnboardingSkip = () => {
                markOnboardingHandled();
                setShowOnboarding(false);
                showToast("Tour skipped. You can reopen it from Dashboard.");
            };

            const handleOnboardingNavigate = (tab) => {
                setView('dashboard');
                setActiveTab(tab);
                if (tab === 'editor') setEditorTab('themes');
            };

            const handleOnboardingDraftChange = (draft) => {
                const currentSettings = settingsRef.current || settings;
                const nextSettings = prepareOnboardingDraftSettings(currentSettings, draft, { draftUpdatedAt: Date.now() });
                const currentDraftKey = JSON.stringify(currentSettings.onboarding?.draft || {});
                const nextDraftKey = JSON.stringify(nextSettings.onboarding?.draft || {});

                if (
                    currentDraftKey === nextDraftKey &&
                    currentSettings.brandName === nextSettings.brandName &&
                    currentSettings.slug === nextSettings.slug &&
                    currentSettings.tagline === nextSettings.tagline
                ) {
                    return;
                }

                settingsRef.current = nextSettings;
                setSettings(nextSettings);
                safeLocalSet(`${onboardingStorageKey}-draft`, JSON.stringify({
                    draft: nextSettings.onboarding?.draft || {},
                    savedAt: Date.now()
                }));

                window.clearTimeout(onboardingDraftSaveTimerRef.current);
                if (canSetupWorkspace && !isGuestWorkspace) {
                    onboardingDraftSaveTimerRef.current = window.setTimeout(() => {
                        publishSettings(settingsRef.current || nextSettings, 'Setup progress saved.', { silent: true })
                            .catch(error => console.error('Setup progress save failed', error));
                    }, 900);
                }
            };

            const handleOnboardingComplete = async (draft, options = {}) => {
                window.clearTimeout(onboardingDraftSaveTimerRef.current);
                const nextSettings = prepareOnboardingSettings(settings, draft, { completedAt: Date.now() });
                settingsRef.current = nextSettings;
                setSettings(nextSettings);
                markOnboardingHandled();
                setShowOnboarding(false);
                setView('dashboard');
                setActiveTab(options.destination || 'overview');
                if (canSetupWorkspace) {
                    await publishSettings(nextSettings, "Workspace setup saved and published.");
                }
            };

            const writeStaffAccessGrant = async (staff) => {
                const emailKey = normalizeEmail(staff.email);
                if (!emailKey || !workspaceOwnerId) return;
                await FirebaseSDK.setDoc(
                    FirebaseSDK.doc(db, 'artifacts', appId, 'staffAccess', emailKey, 'workspaces', workspaceOwnerId),
                    {
                        ownerId: workspaceOwnerId,
                        ownerEmail: user?.email || '',
                        workspaceName: settings.brandName || 'Build A Booking Workspace',
                        email: emailKey,
                        staffId: staff.id,
                        staffName: staff.name,
                        role: staff.role || 'staff',
                        color: staff.color || '#39FF14',
                        status: staff.accessEnabled === false ? 'revoked' : 'active',
                        updatedAt: Date.now()
                    },
                    { merge: true }
                );
            };

            const removeStaffAccessGrant = async (staff) => {
                const emailKey = normalizeEmail(staff.email);
                if (!emailKey || !workspaceOwnerId) return;
                await FirebaseSDK.deleteDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'staffAccess', emailKey, 'workspaces', workspaceOwnerId));
            };

            const saveStaff = async (newList, previousList = staffList) => {
                const normalizedList = newList.map((staff, index) => {
                    if (staff.id === 'owner') {
                        return {
                            ...staff,
                            ...createOwnerStaffProfile({
                                ...user,
                                displayName: personalDisplayName,
                                email: personalProfile.email || user?.email || staff.email || '',
                                photoURL: personalProfile.photoURL || staff.photoURL || user?.photoURL || '',
                                phoneNumber: personalProfile.mobile || staff.phone || user?.phoneNumber || ''
                            }, staff.color || '#39FF14'),
                            color: staff.color || '#39FF14',
                            role: 'owner',
                            status: 'connected'
                        };
                    }
                    const emailKey = normalizeEmail(staff.email);
                    return {
                        ...staff,
                        id: staff.id || buildStaffId(emailKey),
                        email: emailKey,
                        role: staff.role || 'staff',
                        status: staff.status || 'access-ready',
                        accessEnabled: staff.accessEnabled !== false,
                        sortOrder: index
                    };
                });
                setStaffList(normalizedList);
                if (!user || !workspaceOwnerId || !isFirebaseConfigured) return;
                if (!canManageTeam) {
                    showToast("Only owners and admins can manage team access.");
                    return;
                }

                await FirebaseSDK.setDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'users', workspaceOwnerId, 'config', 'staff'), { list: normalizedList, updatedAt: Date.now() });

                const activeStaff = normalizedList.filter(staff => staff.id !== 'owner' && staff.accessEnabled !== false && normalizeEmail(staff.email));
                const previousStaff = previousList.filter(staff => staff.id !== 'owner' && normalizeEmail(staff.email));
                const activeEmails = new Set(activeStaff.map(staff => normalizeEmail(staff.email)));
                await Promise.all(activeStaff.map(writeStaffAccessGrant));
                await Promise.all(previousStaff.filter(staff => !activeEmails.has(normalizeEmail(staff.email))).map(removeStaffAccessGrant));
            };

            const createStaffMember = async ({ name, email, color, role }) => {
                const emailKey = normalizeEmail(email);
                if (!emailKey) return;
                if (!canManageTeam && isFirebaseConfigured) {
                    showToast("Only owners and admins can add staff.");
                    return;
                }

                let detectedAccount = null;
                if (isFirebaseConfigured) {
                    try {
                        const lookupSnap = await FirebaseSDK.getDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'accountLookup', emailKey));
                        if (lookupSnap.exists()) detectedAccount = lookupSnap.data();
                    } catch (error) {
                        console.error(error);
                    }
                }

                const nextStaff = {
                    id: buildStaffId(emailKey),
                    uid: detectedAccount?.uid || '',
                    name: name || detectedAccount?.displayName || emailKey.split('@')[0],
                    email: emailKey,
                    photoURL: detectedAccount?.photoURL || '',
                    color,
                    role,
                    status: detectedAccount ? 'connected' : 'access-ready',
                    accessEnabled: true,
                    updatedAt: Date.now()
                };
                const nextList = [
                    ...staffList.filter(staff => normalizeEmail(staff.email) !== emailKey),
                    nextStaff
                ];
                await saveStaff(nextList, staffList);
                showToast(detectedAccount ? "Google account detected and access granted." : "Access will activate when they sign in with this email.");
            };

            const saveClients = async (newList) => {
                setClientRecords(newList);
                if (!user || !workspaceOwnerId || !isFirebaseConfigured) return;
                await FirebaseSDK.setDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'users', workspaceOwnerId, 'config', 'clients'), { list: newList, updatedAt: Date.now() });
            };

            const upsertClientRecord = (clientId, updates) => {
                const bookingProfile = clientDirectory.find(client => client.id === clientId);
                const existingRecord = clientRecords.find(client => client.id === clientId);
                const nextRecord = {
                    id: clientId,
                    name: updates.name ?? existingRecord?.name ?? bookingProfile?.name ?? 'Unnamed Client',
                    phone: updates.phone ?? existingRecord?.phone ?? bookingProfile?.phone ?? '',
                    email: updates.email ?? existingRecord?.email ?? bookingProfile?.email ?? '',
                    birthday: updates.birthday ?? existingRecord?.birthday ?? bookingProfile?.birthday ?? '',
                    notes: updates.notes ?? existingRecord?.notes ?? bookingProfile?.notes ?? '',
                    avatar: updates.avatar ?? existingRecord?.avatar ?? bookingProfile?.avatar ?? '',
                    labels: updates.labels ?? existingRecord?.labels ?? bookingProfile?.labels ?? [],
                    source: existingRecord?.source || (bookingProfile?.source === 'booking' ? 'booking' : 'manual'),
                    createdAt: existingRecord?.createdAt || bookingProfile?.createdAt || Date.now(),
                    updatedAt: Date.now()
                };
                saveClients([nextRecord, ...clientRecords.filter(client => client.id !== clientId)]);
            };

            const toggleClientLabel = (client, label) => {
                if (!client) return;
                const currentLabels = client.labels || [];
                const nextLabels = currentLabels.includes(label)
                    ? currentLabels.filter(item => item !== label)
                    : [...currentLabels, label];
                upsertClientRecord(client.id, { labels: nextLabels });
            };

            const handleClientAvatarUpload = async (clientId, file) => {
                if (!file) return;
                try {
                    showToast('Uploading client photo...');
                    const avatarUrl = await uploadAsset(file, 'client-avatars');
                    upsertClientRecord(clientId, { avatar: avatarUrl });
                    showToast("Client photo updated");
                } catch (error) {
                    console.error(error);
                    showToast('Client photo upload failed');
                }
            };

            const handleManualClientSubmit = (event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const name = form.clientName.value.trim();
                const phone = form.clientPhone.value.trim();
                const email = form.clientEmail.value.trim();
                const birthday = form.clientBirthday.value.trim();
                const label = form.clientLabel.value;
                if (!name) return;

                const id = phone ? buildClientKey(name, phone) : `manual-${Date.now()}`;
                const existingClient = clientDirectory.find(client => client.id === id);
                const labels = label
                    ? Array.from(new Set([...(existingClient?.labels || []), label]))
                    : (existingClient?.labels || []);

                upsertClientRecord(id, { name, phone, email, birthday, labels });
                setSelectedClientId(id);
                setClientMobileView('profile');
                form.reset();
                showToast(existingClient ? "Client profile updated" : "Client added");
            };

            const saveComms = async (newComms) => {
                const normalizedComms = normalizeCommunications(newComms);
                setCommunications(normalizedComms);
                if (!user || !workspaceOwnerId || !isFirebaseConfigured) return;
                if (!canManageWorkspace) {
                    showToast("Only owners and admins can manage communication settings.");
                    return;
                }
                await FirebaseSDK.setDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'users', workspaceOwnerId, 'config', 'communications'), normalizedComms);
            };

            const applyTheme = (themeId) => {
                const theme = visibleThemes.find(t => t.id === themeId) || PRESET_THEMES.find(t => t.id === themeId);
                if(theme) {
                    setThemeTemplateName(`${theme.name} Template`);
                    setSettings(prev => ({
                        ...prev, 
                        ...theme,
                        nativeAccent: Boolean(theme.nativeAccent),
                        dateStyle: theme.dateStyle || theme.availabilityStyle || prev.dateStyle || 'minimal',
                        timeSlotStyle: theme.timeSlotStyle || theme.availabilityStyle || prev.timeSlotStyle || 'minimal',
                        headingFontFamily: theme.headingFontFamily || '',
                        bodyFontFamily: theme.bodyFontFamily || '',
                        buttonFontFamily: theme.buttonFontFamily || '',
                        slotFontFamily: theme.slotFontFamily || '',
                        dateFontFamily: theme.dateFontFamily || '',
                        headingLetterSpacing: theme.headingLetterSpacing ?? prev.headingLetterSpacing,
                        subtextLetterSpacing: theme.subtextLetterSpacing ?? prev.subtextLetterSpacing
                    }));
                }
            };

            const applySavedThemeTemplate = (template) => {
                const templateSettings = template?.settings || pickThemeTemplateSettings(template);
                if (!templateSettings || !Object.keys(templateSettings).length) return;
                setSettings(prev => ({
                    ...prev,
                    ...templateSettings
                }));
                setThemeTemplateName(template.name || 'Saved Theme Template');
                showToast(`${template.name || 'Theme template'} applied.`);
            };

            const saveCurrentThemeTemplate = async () => {
                const cleanName = (themeTemplateName || suggestedThemeTemplateName || 'Custom Theme').trim();
                const existingTemplates = Array.isArray(settings.themeTemplates) ? settings.themeTemplates : [];
                const templateSlug = buildBookingSlug(cleanName) || 'theme-template';
                const existingIndex = existingTemplates.findIndex(template => buildBookingSlug(template.name || '') === templateSlug);
                const existingTemplate = existingIndex >= 0 ? existingTemplates[existingIndex] : null;
                const nextTemplate = {
                    id: existingTemplate?.id || `${templateSlug}-${Date.now()}`,
                    name: cleanName,
                    sourceThemeId: currentThemeMatch?.id || '',
                    industry: themeGenerationInputs.industry,
                    palette: themeGenerationInputs.palette,
                    style: themeGenerationInputs.style,
                    settings: pickThemeTemplateSettings(settings),
                    createdAt: existingTemplate?.createdAt || Date.now(),
                    updatedAt: Date.now()
                };
                const nextTemplates = existingIndex >= 0
                    ? existingTemplates.map((template, index) => index === existingIndex ? nextTemplate : template)
                    : [nextTemplate, ...existingTemplates].slice(0, 12);
                const nextSettings = {
                    ...settings,
                    themeTemplates: nextTemplates
                };
                const saved = await saveSettingsDraft(nextSettings, `${cleanName} saved as a theme template.`);
                if (saved) setThemeTemplateName('');
            };

            const deleteThemeTemplate = async (templateId) => {
                const nextTemplates = savedThemeTemplates.filter(template => template.id !== templateId);
                await saveSettingsDraft({
                    ...settings,
                    themeTemplates: nextTemplates
                }, "Theme template removed.");
            };

            const handleInspect = (tab) => { if (activeTab !== 'editor') setActiveTab('editor'); setEditorCollapsed(false); setEditorTab(tab); };
            const handleSettingChange = (key, value) => { setSettings(prev => ({ ...prev, [key]: value })); };
            const applyFontStylePreset = (preset) => {
                if (!preset) return;
                setSettings(prev => ({
                    ...prev,
                    fontFamily: preset.fontFamily,
                    headingFontFamily: preset.headingFontFamily,
                    bodyFontFamily: preset.bodyFontFamily,
                    buttonFontFamily: preset.buttonFontFamily,
                    slotFontFamily: preset.slotFontFamily,
                    dateFontFamily: preset.dateFontFamily,
                    headingLetterSpacing: preset.headingLetterSpacing,
                    subtextLetterSpacing: preset.subtextLetterSpacing
                }));
                showToast(`${preset.label} font style applied`);
            };
            const handleLogoDisplayChange = (key, value) => {
                setSettings(prev => ({
                    ...prev,
                    logoDisplay: {
                        visible: true,
                        alignment: 'left',
                        size: 96,
                        ...(prev.logoDisplay || {}),
                        [key]: value
                    }
                }));
            };
            const handleFeatureChange = (key, value) => {
                setSettings(prev => {
                    const nextFeatures = { ...prev.features, [key]: value };
                    if (key === 'collectClientEmail' && value === false) {
                        nextFeatures.emailUpdates = false;
                    }
                    return { ...prev, features: nextFeatures };
                });
            };
            const toggleFaqFeature = () => {
                setSettings(prev => {
                    const enabled = !prev.features?.faqEnabled;
                    const existingFaqs = Array.isArray(prev.features?.faqs) ? prev.features.faqs : [];
                    return {
                        ...prev,
                        features: {
                            ...prev.features,
                            faqEnabled: enabled,
                            faqs: enabled && existingFaqs.length === 0 ? defaultFaqItems : existingFaqs
                        }
                    };
                });
            };
            const updateFaqItem = (index, field, value) => {
                const faqs = [...(settings.features?.faqs || [])];
                faqs[index] = { ...(faqs[index] || { q: '', a: '' }), [field]: value };
                handleFeatureChange('faqs', faqs);
            };
            const addFaqItem = () => handleFeatureChange('faqs', [...(settings.features?.faqs || []), { q: '', a: '' }]);
            const removeFaqItem = (index) => handleFeatureChange('faqs', (settings.features?.faqs || []).filter((_, idx) => idx !== index));
            const handleSocialChange = (key, value) => {
                setSettings(prev => ({ ...prev, socials: { ...(prev.socials || {}), [key]: value } }));
            };
            const copyToClipboard = async (value, label = 'Link') => {
                try {
                    await navigator.clipboard.writeText(value);
                    showToast(`${label} copied`);
                } catch (error) {
                    console.error(error);
                    showToast(`${label}: ${value}`);
                }
            };
            const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (event) => resolve(event.target.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            const uploadAsset = async (file, folder) => {
                if (!file) return '';
                if (!isFirebaseConfigured || !user || !storage) return readFileAsDataUrl(file);
                const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '');
                const assetRef = FirebaseSDK.ref(storage, `artifacts/${appId}/users/${workspaceOwnerId || user.uid}/${folder}/${Date.now()}-${safeName || 'asset'}`);
                await FirebaseSDK.uploadBytes(assetRef, file);
                return FirebaseSDK.getDownloadURL(assetRef);
            };
            const updatePersonalProfile = (updates = {}) => {
                const nextProfile = {
                    ...personalProfile,
                    ...updates,
                    uid: user?.uid || personalProfile.uid || '',
                    updatedAt: Date.now()
                };
                const nextDisplayName = [nextProfile.firstName, nextProfile.lastName].filter(Boolean).join(' ').trim() || personalDisplayName;
                const emailKey = normalizeEmail(user?.email || '');
                const profileEmailKey = normalizeEmail(nextProfile.email || '');

                setSettings(prev => ({
                    ...prev,
                    accountProfiles: {
                        ...(prev.accountProfiles || {}),
                        [accountProfileKey]: nextProfile
                    }
                }));
                setAccountProfileOverride(nextProfile);

                setStaffList(prev => (prev || []).map(staff => {
                    const isCurrentPerson = (
                        (user?.uid && staff.uid === user.uid) ||
                        (emailKey && normalizeEmail(staff.email || '') === emailKey) ||
                        (profileEmailKey && normalizeEmail(staff.email || '') === profileEmailKey) ||
                        (isWorkspaceOwner && staff.id === 'owner')
                    );
                    if (!isCurrentPerson) return staff;
                    return {
                        ...staff,
                        name: nextDisplayName || staff.name,
                        email: nextProfile.email || staff.email,
                        phone: nextProfile.mobile || staff.phone || '',
                        photoURL: nextProfile.photoURL || staff.photoURL || '',
                        updatedAt: Date.now()
                    };
                }));
            };
            const handlePersonalProfilePhotoUpload = async (file) => {
                if (!file) return;
                try {
                    showToast('Uploading profile photo...');
                    const url = await uploadAsset(file, 'account-avatars');
                    updatePersonalProfile({ photoURL: url });
                    showToast('Profile photo updated');
                } catch (error) {
                    console.error(error);
                    showToast('Profile photo upload failed');
                }
            };
            const saveProfileChanges = async () => {
                const displayName = [personalProfile.firstName, personalProfile.lastName].filter(Boolean).join(' ').trim() || personalDisplayName;
                const emailKey = normalizeEmail(personalProfile.email || user?.email || '');
                try {
                    if (isFirebaseConfigured && user?.uid) {
                        const accountPayload = {
                            uid: user.uid,
                            email: emailKey,
                            displayName,
                            firstName: personalProfile.firstName || '',
                            lastName: personalProfile.lastName || '',
                            mobile: personalProfile.mobile || '',
                            phone: personalProfile.mobile || '',
                            photoURL: personalProfile.photoURL || '',
                            personalProfile: {
                                ...personalProfile,
                                email: emailKey,
                                updatedAt: Date.now()
                            },
                            updatedAt: Date.now()
                        };
                        await FirebaseSDK.setDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'accounts', user.uid), accountPayload, { merge: true });
                        if (emailKey) {
                            await FirebaseSDK.setDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'accountLookup', emailKey), accountPayload, { merge: true });
                        }
                    }

                    if (canManageWorkspace) {
                        await publishSettings(settings, 'Profile updated.', { silent: true });
                    } else if (!isFirebaseConfigured) {
                        setSettings(settings);
                    }

                    if (canManageTeam) {
                        await saveStaff(displayStaffList, staffList);
                    }

                    showToast('Profile updated.');
                } catch (error) {
                    console.error(error);
                    showToast('Profile could not be saved.');
                }
            };
            const handleSettingImageUpload = async (key, file, folder) => {
                if (!file) return;
                try {
                    showToast('Uploading image...');
                    const url = await uploadAsset(file, folder);
                    handleSettingChange(key, url);
                    showToast('Image uploaded');
                } catch (error) {
                    console.error(error);
                    showToast('Image upload failed');
                }
            };
            const openDashboard = () => {
                if (!isFirebaseConfigured || user || guestMode) {
                    setView('dashboard');
                    return;
                }
                setAuthMode('signin');
                setAuthPersona('owner');
                setAuthPanelOpen(true);
                setAuthError('');
            };
            const openSignupOrDashboard = () => {
                if (!isFirebaseConfigured || user) {
                    setView('dashboard');
                    return;
                }
                openAuthPanel('signup', 'owner');
            };
            const openAuthPanel = (mode = 'signin', persona = 'owner') => {
                setAuthMode(mode);
                setAuthPersona(persona);
                setAuthError('');
                setAuthPanelOpen(true);
            };
            const openClientPortal = () => {
                if (!isFirebaseConfigured || user) {
                    setClientGuestMode(false);
                    applyWorkspaceRoute({ view: 'client' });
                    return;
                }
                openAuthPanel('signin', 'client');
            };
            const openClientGuestPortal = () => {
                setClientGuestMode(true);
                setAuthPanelOpen(false);
                setAuthError('');
                applyWorkspaceRoute({ view: 'client' });
                showToast('Client preview opened.');
            };
            const openBillingAction = async (action = 'checkout') => {
                if (!user || isGuestWorkspace) {
                    openAuthPanel('signup', 'owner');
                    showToast('Create an account first so billing can attach to your workspace.');
                    return;
                }
                if (!functions || !FirebaseSDK.httpsCallable) {
                    showToast('Billing functions are not connected yet.');
                    return;
                }
                try {
                    const callableName = action === 'portal' ? 'createBillingPortalSession' : 'createCheckoutSession';
                    const billingAction = FirebaseSDK.httpsCallable(functions, callableName);
                    const result = await billingAction({ appId, ownerId: workspaceOwnerId, plan: 'pro' });
                    if (result?.data?.url) {
                        window.location.href = result.data.url;
                        return;
                    }
                    showToast(action === 'portal' ? 'Billing portal is ready for Stripe setup.' : 'Checkout is ready for Stripe setup.');
                } catch (error) {
                    console.error(error);
                    showToast(error?.message || 'Billing is not configured yet.');
                }
            };
            const openGuestDashboard = () => {
                setGuestMode(true);
                setClientGuestMode(false);
                safeLocalSet(guestModeStorageKey, 'true');
                setAuthPanelOpen(false);
                setAuthError('');
                applyWorkspaceRoute({ view: 'dashboard', activeTab: view === 'dashboard' ? activeTab : 'overview', editorTab });
                showToast('Guest workspace opened.');
            };
            const handleAuthSubmit = async (event) => {
                event.preventDefault();
                if (!isFirebaseConfigured) {
                    setView('dashboard');
                    return;
                }
                setAuthError('');
                setAuthBusy(true);
                try {
                    await applyAuthPersistence(keepLoggedIn);
                    if (authMode === 'signup') {
                        await FirebaseSDK.createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
                    } else {
                        await FirebaseSDK.signInWithEmailAndPassword(auth, authForm.email, authForm.password);
                    }
                    setGuestMode(false);
                    setClientGuestMode(false);
                    safeLocalRemove(guestModeStorageKey);
                    setAuthPanelOpen(false);
                    applyWorkspaceRoute(getAuthReturnRouteForPersona());
                    showToast(authMode === 'signup' ? 'Account created' : 'Signed in');
                } catch (error) {
                    console.error(error);
                    setAuthError(error.message || 'Could not sign in.');
                } finally {
                    setAuthBusy(false);
                }
            };
            const handleGoogleAuth = async () => {
                if (!isFirebaseConfigured) {
                    setView('dashboard');
                    return;
                }
                setAuthError('');
                setAuthBusy(true);
                try {
                    const returnRoute = getAuthReturnRouteForPersona();
                    if (isNativeAppRuntime) {
                        await applyAuthPersistence(keepLoggedIn);
                        await signInWithNativeGoogle(auth);
                        setGuestMode(false);
                        setClientGuestMode(false);
                        safeLocalRemove(guestModeStorageKey);
                        setAuthPanelOpen(false);
                        applyWorkspaceRoute(returnRoute);
                        showToast('Signed in with Google');
                        return;
                    }
                    if (shouldUseRedirectGoogleAuth()) {
                        await startGoogleRedirect(returnRoute);
                        return;
                    }
                    const provider = createGoogleProvider();
                    await FirebaseSDK.signInWithPopup(auth, provider);
                    applyAuthPersistence(keepLoggedIn).catch((persistenceError) => {
                        console.error('Auth persistence could not be updated after Google sign-in.', persistenceError);
                    });
                    setGuestMode(false);
                    setClientGuestMode(false);
                    safeLocalRemove(guestModeStorageKey);
                    setAuthPanelOpen(false);
                    applyWorkspaceRoute(returnRoute);
                    showToast('Signed in with Google');
                } catch (error) {
                    console.error(error);
                    if (['auth/popup-blocked', 'auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/web-storage-unsupported'].includes(error?.code)) {
                        try {
                            await startGoogleRedirect(getAuthReturnRouteForPersona());
                            return;
                        } catch (redirectError) {
                            console.error(redirectError);
                            setAuthError(redirectError.message || 'Could not start Google sign-in.');
                            return;
                        }
                    }
                    const message = error?.code === 'auth/operation-not-allowed'
                        ? 'Google sign-in is not enabled yet. Enable Google under Firebase Authentication > Sign-in method.'
                        : error?.code === 'auth/popup-closed-by-user'
                            ? 'Google sign-in was closed before it finished.'
                            : error.message || 'Could not sign in with Google.';
                    setAuthError(message);
                } finally {
                    setAuthBusy(false);
                }
            };
            const handleSignOut = async () => {
                setAuthBusy(true);
                try {
                    if (isNativeAppRuntime) {
                        await FirebaseAuthentication.signOut().catch((error) => {
                            console.warn('Native Firebase sign out skipped.', error);
                        });
                    }
                    if (isFirebaseConfigured && user) {
                        await FirebaseSDK.signOut(auth);
                    }
                    showToast(isGuestWorkspace ? 'Guest mode closed.' : 'Signed out.');
                } catch (error) {
                    console.error(error);
                    showToast('Sign out could not finish. Please try again.');
                    return;
                } finally {
                    setAuthBusy(false);
                }
                clearAuthReturnState();
                setAuthRedirectPending(false);
                setGuestMode(false);
                setClientGuestMode(false);
                safeLocalRemove(guestModeStorageKey);
                setWorkspaceAccess([]);
                setActiveWorkspaceOwnerId('');
                saveWorkspaceRoute({ view: 'landing', activeTab: 'overview', editorTab: 'themes' });
                setView('landing');
                setActiveTab('overview');
                if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href);
                    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
                }
            };

            const handleBookingComplete = async (formData, date, time, status, dateKey) => {
                const bookingRecord = {
                    clientName: formData.name,
                    clientPhone: formData.phone,
                    clientEmail: formData.email || '',
                    clientBirthday: formData.birthday || '',
                    clientNote: formData.note || '',
                    clientEmailOptIn: Boolean(formData.emailOptIn && formData.email),
                    notificationChannels: {
                        email: Boolean(formData.email && formData.emailOptIn),
                        portal: Boolean(formData.email)
                    },
                    date,
                    dateKey: dateKey || null,
                    time,
                    status,
                    timestamp: Date.now(),
                    noShowHistory: false
                };

                if (!isFirebaseConfigured || !user) {
                    setBookings(prev => [{ id: `local-${Date.now()}`, ...bookingRecord }, ...prev]);
                    return true;
                }
                try {
                    const bookingRef = await FirebaseSDK.addDoc(FirebaseSDK.collection(db, 'artifacts', appId, 'users', workspaceOwnerId, 'bookings'), {
                        ...bookingRecord
                    });
                    await createOwnerNotification(makeOwnerNotification({
                        type: NOTIFICATION_TYPES.BOOKING_REQUEST,
                        title: `New booking request from ${bookingRecord.clientName}`,
                        body: `${bookingRecord.date} at ${bookingRecord.time}. Review, confirm, or reply from My Bookings.`,
                        ownerId: workspaceOwnerId,
                        booking: { ...bookingRecord, id: bookingRef.id },
                        bookingId: bookingRef.id,
                        tab: 'bookings',
                        priority: 'high'
                    }));
                    return true;
                } catch (err) {
                    console.error(err);
                    showToast('Booking could not be saved.');
                    return false;
                }
            };

            const handlePublicBookingComplete = async (formData, date, time, status, dateKey) => {
                if (!publicWorkspace?.ownerId) {
                    showToast('Booking page is missing an owner.');
                    return false;
                }
                const bookingRecord = {
                    ownerId: publicWorkspace.ownerId,
                    clientName: formData.name,
                    clientPhone: formData.phone,
                    clientEmail: formData.email || '',
                    clientBirthday: formData.birthday || '',
                    clientNote: formData.note || '',
                    clientEmailOptIn: Boolean(formData.emailOptIn && formData.email),
                    notificationChannels: {
                        email: Boolean(formData.email && formData.emailOptIn),
                        portal: Boolean(formData.email)
                    },
                    date,
                    dateKey: dateKey || null,
                    time,
                    status,
                    source: 'public-booking-page',
                    workspaceSlug: publicSlug,
                    workspaceName: publicWorkspace.workspaceName || publicWorkspace.brandName || '',
                    timestamp: Date.now(),
                    createdAt: FirebaseSDK.serverTimestamp()
                };

                try {
                    if (functions && FirebaseSDK.httpsCallable) {
                        try {
                            const createPublicBookingRequest = FirebaseSDK.httpsCallable(functions, 'createPublicBookingRequest');
                            await createPublicBookingRequest({
                                appId,
                                workspaceSlug: publicSlug,
                                booking: {
                                    clientName: bookingRecord.clientName,
                                    clientPhone: bookingRecord.clientPhone,
                                    clientEmail: bookingRecord.clientEmail,
                                    clientEmailOptIn: bookingRecord.clientEmailOptIn,
                                    clientBirthday: bookingRecord.clientBirthday,
                                    clientNote: bookingRecord.clientNote,
                                    date: bookingRecord.date,
                                    dateKey: bookingRecord.dateKey,
                                    time: bookingRecord.time,
                                    status: bookingRecord.status,
                                    notificationChannels: bookingRecord.notificationChannels
                                }
                            });
                            return true;
                        } catch (functionError) {
                            const fallbackCodes = new Set(['functions/not-found', 'functions/unavailable']);
                            if (!fallbackCodes.has(functionError?.code)) {
                                console.error(functionError);
                                if (functionError?.code === 'functions/already-exists') {
                                    showToast('That time was just requested. Pick another slot.');
                                } else {
                                    showToast(functionError?.message || 'Booking could not be submitted.');
                                }
                                return false;
                            }
                            console.warn('Falling back to direct public booking write until Functions are deployed.', functionError);
                        }
                    }
                    await FirebaseSDK.addDoc(FirebaseSDK.collection(db, 'artifacts', appId, 'users', publicWorkspace.ownerId, 'bookings'), bookingRecord);
                    await FirebaseSDK.addDoc(FirebaseSDK.collection(db, 'artifacts', appId, 'public', 'data', 'workspaces', publicSlug, 'bookingSubmissions'), bookingRecord);
                    return true;
                } catch (error) {
                    console.error(error);
                    showToast('Booking could not be submitted.');
                    return false;
                }
            };

            const sendBookingEmail = async (booking, templateKey, extra = {}) => {
                if (booking.notificationChannels?.email === false) {
                    showToast('Client email updates are off for this booking.');
                    return false;
                }
                if (!communications[templateKey]?.active) {
                    showToast(`Turn on the ${templateKey} email first.`);
                    return false;
                }
                try {
                    const result = await sendClientEmail({ communications, settings, booking, templateKey, extra });
                    if (result.skipped) {
                        showToast(result.reason);
                        return false;
                    }
                    showToast(`${templateKey === 'runningLate' ? 'Running late' : templateKey} email sent to ${booking.clientName}.`);
                    return true;
                } catch (error) {
                    console.error(error);
                    showToast('Email delivery is not connected yet.');
                    return false;
                }
            };

            const updateBooking = async (bookingId, updates) => {
                const existingBooking = visibleBookings.find(booking => booking.id === bookingId);
                const nextStaffId = updates.staffId ?? existingBooking?.staffId ?? '';
                const nextAssignedStaff = nextStaffId ? staffList.find(staff => staff.id === nextStaffId) : null;
                if (!isFirebaseConfigured || !user) {
                    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, ...updates } : b));
                    return;
                }
                try {
                    await FirebaseSDK.updateDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'users', workspaceOwnerId, 'bookings', bookingId), updates);
                    const threadId = updates.threadId ?? existingBooking?.threadId ?? '';
                    const emailKey = normalizeEmail(existingBooking?.clientEmail);
                    const portalUpdates = {
                        ...updates,
                        updatedAt: FirebaseSDK.serverTimestamp()
                    };
                    if (emailKey) {
                        FirebaseSDK.setDoc(
                            FirebaseSDK.doc(db, 'artifacts', appId, 'clientAccess', emailKey, 'bookings', bookingId),
                            {
                                bookingId,
                                threadId,
                                ownerId: workspaceOwnerId,
                                clientEmail: emailKey,
                                clientName: existingBooking?.clientName || '',
                                workspaceSlug: existingBooking?.workspaceSlug || settings.slug || '',
                                workspaceName: existingBooking?.workspaceName || settings.brandName || '',
                                workspaceLogo: existingBooking?.workspaceLogo || settings.logo || '',
                                date: updates.date ?? existingBooking?.date ?? '',
                                dateKey: updates.dateKey ?? existingBooking?.dateKey ?? null,
                                time: updates.time ?? existingBooking?.time ?? '',
                                status: updates.status ?? existingBooking?.status ?? 'pending',
                                staffId: nextStaffId,
                                staffName: nextAssignedStaff?.name || '',
                                staffPhotoURL: nextAssignedStaff?.photoURL || '',
                                timestamp: existingBooking?.timestamp || Date.now(),
                                ...portalUpdates
                            },
                            { merge: true }
                        ).catch(error => console.error('Client portal booking sync failed', error));
                    }
                    if (threadId) {
                        FirebaseSDK.updateDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'clientThreads', threadId), {
                            bookingStatus: updates.status ?? existingBooking?.status ?? 'pending',
                            lastMessage: updates.status ? `Booking status updated to ${updates.status}.` : 'Booking details updated.',
                            lastMessageAt: FirebaseSDK.serverTimestamp(),
                            updatedAt: FirebaseSDK.serverTimestamp(),
                            staffId: nextStaffId,
                            staffName: nextAssignedStaff?.name || '',
                            staffPhotoURL: nextAssignedStaff?.photoURL || '',
                            workspaceLogo: existingBooking?.workspaceLogo || settings.logo || '',
                            clientUnread: FirebaseSDK.increment(1)
                        }).catch(error => console.error('Client thread sync failed', error));
                    }
                    if (emailKey && existingBooking) {
                        const nextBooking = { ...existingBooking, ...updates, id: bookingId, ownerId: workspaceOwnerId };
                        const statusChanged = updates.status && updates.status !== existingBooking.status;
                        const scheduleChanged = (
                            (updates.date && updates.date !== existingBooking.date) ||
                            (updates.time && updates.time !== existingBooking.time && updates.time !== 'Waitlist')
                        );
                        if (statusChanged) {
                            const copyByStatus = {
                                confirmed: {
                                    type: NOTIFICATION_TYPES.BOOKING_CONFIRMED,
                                    title: 'Your booking was approved',
                                    body: `${settings.brandName || nextBooking.workspaceName || 'The business'} confirmed ${nextBooking.date} at ${nextBooking.time}.`
                                },
                                declined: {
                                    type: NOTIFICATION_TYPES.BOOKING_DECLINED,
                                    title: 'Your booking request was declined',
                                    body: `${settings.brandName || nextBooking.workspaceName || 'The business'} could not approve that request. Open your portal to chat or request another time.`
                                },
                                waitlist: {
                                    type: NOTIFICATION_TYPES.BOOKING_WAITLIST,
                                    title: 'You are on the waitlist',
                                    body: 'You are now on standby. If a slot opens, the business can message you from your booking thread.'
                                }
                            };
                            const copy = copyByStatus[updates.status];
                            if (copy) {
                                createClientNotification(emailKey, makeClientNotification({
                                    ...copy,
                                    ownerId: workspaceOwnerId,
                                    booking: nextBooking,
                                    view: 'bookings',
                                    priority: updates.status === 'confirmed' ? 'high' : 'normal'
                                })).catch(() => {});
                            }
                        }
                        if (scheduleChanged) {
                            createClientNotification(emailKey, makeClientNotification({
                                type: NOTIFICATION_TYPES.BOOKING_RESCHEDULED,
                                title: 'Your booking time changed',
                                body: `${settings.brandName || nextBooking.workspaceName || 'The business'} updated your booking to ${nextBooking.date} at ${nextBooking.time}.`,
                                ownerId: workspaceOwnerId,
                                booking: nextBooking,
                                view: 'bookings',
                                priority: 'high'
                            })).catch(() => {});
                        }
                    }
                } 
                catch (err) { console.error(err); }
            };

            const deleteBooking = async (bookingId) => {
                if (!isFirebaseConfigured || !user) {
                    setBookings(prev => prev.filter(b => b.id !== bookingId));
                    return;
                }
                try { await FirebaseSDK.deleteDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'users', workspaceOwnerId, 'bookings', bookingId)); } 
                catch (err) { console.error(err); }
            };

            const openBookingChat = async (booking) => {
                if (booking?.isExample) {
                    showToast('Example preview only. Live bookings open the linked client chat.');
                    return;
                }
                if (!booking?.id) {
                    showToast('This booking is missing its record ID.');
                    return;
                }
                const emailKey = normalizeEmail(booking.clientEmail || '');
                if (!emailKey) {
                    showToast('Add a client email before opening an in-app chat thread.');
                    return;
                }

                const threadId = booking.threadId || buildSupportThreadId(workspaceOwnerId, booking.id);

                if (isFirebaseConfigured && user && db && workspaceOwnerId) {
                    try {
                        const threadRef = FirebaseSDK.doc(db, 'artifacts', appId, 'clientThreads', threadId);
                        const threadSnap = await FirebaseSDK.getDoc(threadRef);
                        const clientPhotoURL = getBookingClientAvatar(booking);
                        if (!threadSnap.exists()) {
                            const assignedStaff = booking.staffId ? staffList.find(staff => staff.id === booking.staffId) : null;
                            await FirebaseSDK.setDoc(threadRef, {
                                ownerId: workspaceOwnerId,
                                clientEmail: emailKey,
                                clientName: booking.clientName || 'Client',
                                clientPhotoURL,
                                bookingId: booking.id,
                                workspaceSlug: booking.workspaceSlug || settings.slug || '',
                                workspaceName: booking.workspaceName || settings.brandName || '',
                                workspaceLogo: booking.workspaceLogo || settings.logo || '',
                                bookingStatus: booking.status || 'pending',
                                status: 'open',
                                lastMessage: `Booking chat opened for ${booking.date || 'this booking'} at ${booking.time || 'the requested time'}.`,
                                lastMessageAt: FirebaseSDK.serverTimestamp(),
                                ownerUnread: 0,
                                clientUnread: 0,
                                rescheduleStatus: '',
                                staffId: booking.staffId || '',
                                staffName: assignedStaff?.name || '',
                                staffPhotoURL: assignedStaff?.photoURL || '',
                                createdAt: FirebaseSDK.serverTimestamp(),
                                updatedAt: FirebaseSDK.serverTimestamp()
                            }, { merge: true });
                            await FirebaseSDK.addDoc(FirebaseSDK.collection(db, 'artifacts', appId, 'clientThreads', threadId, 'messages'), {
                                text: `Support thread opened for ${booking.date || 'this booking'} at ${booking.time || 'the requested time'}. The team can reply, reschedule, or send updates here.`,
                                kind: 'booking-linked',
                                bookingId: booking.id,
                                senderId: 'system',
                                senderName: 'Build A Booking',
                                senderRole: 'system',
                                createdAt: FirebaseSDK.serverTimestamp()
                            });
                        }
                        if (clientPhotoURL && !threadSnap.data()?.clientPhotoURL) {
                            await FirebaseSDK.setDoc(threadRef, {
                                clientPhotoURL,
                                updatedAt: FirebaseSDK.serverTimestamp()
                            }, { merge: true });
                        }
                        if (!booking.threadId) {
                            await updateBooking(booking.id, { threadId });
                        }
                    } catch (error) {
                        console.error('Could not open booking chat', error);
                        showToast('Could not open that client chat yet.');
                        return;
                    }
                }

                setSupportThreadFocus({ threadId, bookingId: booking.id, requestId: Date.now() });
                setActiveTab('communications');
            };

            const approveBooking = async (booking) => {
                await updateBooking(booking.id, { status: 'confirmed' });
                await sendBookingEmail({ ...booking, status: 'confirmed' }, 'confirmed');
            };

            const sendRunningLateToBooking = async (booking) => {
                setRunningLateDialog({
                    booking,
                    minutes: '15',
                    message: `Running 15 minutes late. Thanks for your patience - we will keep you posted here.`
                });
            };

            const submitRunningLateDialog = async () => {
                const booking = runningLateDialog?.booking;
                const minutes = String(runningLateDialog?.minutes || '').trim();
                if (!booking || !minutes) {
                    showToast('Add the number of minutes before sending.');
                    return;
                }
                await sendBookingEmail(booking, 'runningLate', { minutes });
                await createClientNotification(booking.clientEmail, makeClientNotification({
                    type: NOTIFICATION_TYPES.RUNNING_LATE,
                    title: `${settings.brandName || 'The business'} is running late`,
                    body: String(runningLateDialog?.message || '').trim() || `They are running about ${minutes} minutes behind. Your booking thread stays open for questions.`,
                    ownerId: workspaceOwnerId,
                    booking,
                    view: 'chats',
                    priority: 'high',
                    metadata: { minutes }
                }));
                setRunningLateDialog(null);
                showToast('Running-late update sent.');
            };

            const sendWaitlistToBooking = async (booking) => {
                if (booking.status !== 'waitlist') {
                    await updateBooking(booking.id, { status: 'waitlist', time: 'Waitlist' });
                    await sendBookingEmail({ ...booking, status: 'waitlist', time: 'Waitlist' }, 'waitlist');
                    showToast(`${booking.clientName} moved to waitlist.`);
                    return;
                }
                await sendBookingEmail(booking, 'waitlist');
                await createClientNotification(booking.clientEmail, makeClientNotification({
                    type: NOTIFICATION_TYPES.BOOKING_WAITLIST,
                    title: 'A waitlist update is ready',
                    body: `${settings.brandName || 'The business'} sent a waitlist update. Open your booking thread to keep moving.`,
                    ownerId: workspaceOwnerId,
                    booking,
                    view: 'bookings',
                    priority: 'normal'
                }));
            };

            const sendReviewToBooking = async (booking) => {
                await sendBookingEmail(booking, 'review');
                await createClientNotification(booking.clientEmail, makeClientNotification({
                    type: NOTIFICATION_TYPES.REVIEW_NUDGE,
                    title: 'Quick follow-up from your visit',
                    body: `${settings.brandName || 'The business'} sent a quick thank-you and review request.`,
                    ownerId: workspaceOwnerId,
                    booking,
                    view: 'chats',
                    priority: 'normal'
                }));
            };

            const sendNudgeToBooking = async (booking) => {
                const sent = await createClientNotification(booking.clientEmail, makeClientNotification({
                    type: NOTIFICATION_TYPES.BOOKING_NUDGE,
                    title: 'Your booking needs one quick look',
                    body: `${settings.brandName || 'The business'} nudged this booking so you can check the latest update or reply.`,
                    ownerId: workspaceOwnerId,
                    booking,
                    view: 'bookings',
                    priority: 'normal'
                }));
                showToast(sent ? `Nudge sent to ${booking.clientName}.` : 'Client portal nudges need a client email.');
            };

            const connectGoogleCalendar = async () => {
                if (!isFirebaseConfigured || !auth) {
                    showToast('Google Calendar sync needs Firebase Google sign-in.');
                    return '';
                }
                if (!user) {
                    setAuthPersona('owner');
                    setAuthMode('signin');
                    setAuthPanelOpen(true);
                    showToast('Sign in first, then connect Google Calendar.');
                    return '';
                }

                try {
                    if (isNativeAppRuntime) {
                        const nativeResult = await signInWithNativeGoogle(auth, {
                            scopes: [GOOGLE_CALENDAR_EVENTS_SCOPE],
                            useCredentialManager: false
                        });
                        const accessToken = nativeResult?.accessToken || '';
                        if (!accessToken) throw new Error('Google did not return Calendar permission yet.');
                        setGoogleCalendarAuth({
                            accessToken,
                            email: auth.currentUser?.email || user.email || '',
                            connectedAt: Date.now()
                        });
                        showToast('Google Calendar connected.');
                        return accessToken;
                    }

                    const provider = createGoogleProvider({ calendar: true });
                    await applyAuthPersistence(keepLoggedIn);
                    try {
                        const result = await FirebaseSDK.signInWithPopup(auth, provider);
                        const accessToken = getGoogleAccessTokenFromResult(result);
                        if (!accessToken) throw new Error('Google did not return Calendar permission yet.');
                        setGoogleCalendarAuth({
                            accessToken,
                            email: result.user?.email || user.email || '',
                            connectedAt: Date.now()
                        });
                        if (canManageWorkspace) {
                            await saveSettingsDraft({
                                ...settings,
                                googleCalendar: {
                                    ...(settings.googleCalendar || {}),
                                    connectedEmail: result.user?.email || user.email || '',
                                    connectedAt: Date.now(),
                                    mode: 'manual-sync'
                                }
                            }, 'Google Calendar connected.');
                        } else {
                            showToast('Google Calendar connected for this session.');
                        }
                        return accessToken;
                    } catch (error) {
                        if (['auth/popup-blocked', 'auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/web-storage-unsupported'].includes(error?.code)) {
                            await startGoogleRedirect(getCurrentAuthReturnRoute(), { calendar: true });
                            return '';
                        }
                        throw error;
                    }
                } catch (error) {
                    console.error(error);
                    showToast(error?.message || 'Google Calendar could not connect.');
                    return '';
                }
            };

            const markGoogleCalendarResults = async (results = []) => {
                if (!results.length) return;
                const syncedAt = Date.now();
                setBookings(prev => prev.map(booking => {
                    const match = results.find(result => result.bookingId === booking.id);
                    return match
                        ? { ...booking, googleCalendarEventId: match.eventId, googleCalendarSyncedAt: syncedAt, googleCalendarLink: match.htmlLink || '' }
                        : booking;
                }));
                if (!isFirebaseConfigured || !user || !workspaceOwnerId) return;
                await Promise.all(results.map(result => FirebaseSDK.updateDoc(
                    FirebaseSDK.doc(db, 'artifacts', appId, 'users', workspaceOwnerId, 'bookings', result.bookingId),
                    {
                        googleCalendarEventId: result.eventId,
                        googleCalendarLink: result.htmlLink || '',
                        googleCalendarSyncedAt: syncedAt
                    }
                ).catch(error => console.error('Google Calendar booking sync marker failed', error))));
            };

            const syncGoogleCalendarBookings = async (calendarId = 'workspace') => {
                if (googleCalendarSyncing) return;
                setGoogleCalendarSyncing(true);
                try {
                    let accessToken = googleCalendarAuth.accessToken;
                    if (!accessToken) {
                        accessToken = await connectGoogleCalendar();
                    }
                    if (!accessToken) return;

                    const result = await syncConfirmedBookingsToGoogleCalendar({
                        accessToken,
                        bookings: visibleBookings,
                        settings,
                        staffList: displayStaffList,
                        calendarId,
                        durationMinutes: Number(settings.defaultBookingDurationMinutes) || 60
                    });

                    await markGoogleCalendarResults(result.results);
                    const nextCalendarSettings = {
                        ...(settings.googleCalendar || {}),
                        connectedEmail: googleCalendarAuth.email || auth.currentUser?.email || user?.email || '',
                        connectedAt: googleCalendarAuth.connectedAt || Date.now(),
                        lastSyncedAt: Date.now(),
                        lastSyncCount: result.created,
                        mode: 'manual-sync'
                    };
                    if (canManageWorkspace) {
                        await saveSettingsDraft({ ...settings, googleCalendar: nextCalendarSettings }, result.created
                            ? `${result.created} booking${result.created === 1 ? '' : 's'} synced to Google Calendar.`
                            : 'Google Calendar is already up to date.'
                        );
                    } else {
                        showToast(result.created
                            ? `${result.created} booking${result.created === 1 ? '' : 's'} synced to Google Calendar.`
                            : 'Google Calendar is already up to date.'
                        );
                    }
                } catch (error) {
                    console.error(error);
                    const message = error?.status === 403
                        ? 'Google Calendar API needs to be enabled for this project, or the account needs Calendar permission.'
                        : error?.message || 'Google Calendar sync failed.';
                    showToast(message);
                } finally {
                    setGoogleCalendarSyncing(false);
                }
            };

            const authPersonaCopy = authPersona === 'client'
                ? {
                    eyebrow: 'Client Access',
                    title: authMode === 'signup' ? 'Create Client Account' : 'Client Sign In',
                    body: 'Clients can track bookings, request reschedules, get updates, and chat with the place they booked with.',
                    submit: authMode === 'signup' ? 'Create Client Login' : 'Open Client Portal'
                }
                : {
                    eyebrow: 'Workspace Access',
                    title: authMode === 'signup' ? 'Create Account' : 'Sign In',
                    body: 'Owners and invited staff can use the same secure sign-in.',
                    submit: authMode === 'signup' ? 'Create Workspace' : 'Sign In'
                };

            const googleAuthLabel = authBusy
                ? 'Connecting...'
                : authMode === 'signup'
                    ? 'Sign Up With Google'
                    : 'Continue With Google';

            const authDialog = authPanelOpen && (
                <div className="fixed inset-0 z-[1000] bg-black/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <form onSubmit={handleAuthSubmit} className="native-auth-panel w-full sm:max-w-md bg-white rounded-t-[1.5rem] sm:rounded-lg border border-neutral-100 shadow-2xl p-5 sm:p-6 md:p-8 animate-in fade-in zoom-in-95 duration-300 max-h-[calc(100dvh-1rem)] overflow-y-auto">
                        <div className="flex items-start justify-between gap-4 mb-6">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-neutral-400 mb-2">{authPersonaCopy.eyebrow}</p>
                                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-black">{authPersonaCopy.title}</h2>
                                <p className="text-sm text-neutral-500 mt-2">{authPersonaCopy.body}</p>
                            </div>
                            <button type="button" onClick={() => { setAuthPanelOpen(false); setAuthError(''); }} className="w-10 h-10 rounded-full bg-neutral-100 text-neutral-400 flex items-center justify-center hover:text-black transition-colors shrink-0"><X size={16}/></button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 rounded-full bg-neutral-100 p-1 mb-4">
                            {[
                                ['owner', 'Owner / Staff'],
                                ['client', 'Client']
                            ].map(([persona, label]) => (
                                <button
                                    key={persona}
                                    type="button"
                                    onClick={() => setAuthPersona(persona)}
                                    className={`h-10 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all ${authPersona === persona ? 'bg-black text-white shadow-lg' : 'text-neutral-500 hover:text-black'}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <button type="button" onClick={handleGoogleAuth} disabled={authBusy} className="w-full h-12 rounded-lg bg-white border border-neutral-200 text-black text-[11px] font-bold uppercase tracking-widest hover:bg-neutral-50 hover:border-neutral-300 transition-colors flex items-center justify-center gap-3 shadow-sm disabled:opacity-50 disabled:cursor-wait">
                            <Globe size={16}/> {googleAuthLabel}
                        </button>
                        {shouldUseRedirectGoogleAuth() && (
                            <p className="mt-3 text-xs leading-relaxed text-neutral-500">
                                On mobile, Google opens securely and brings you back to this workspace.
                            </p>
                        )}
                        <label className="mt-3 flex items-center justify-between gap-4 rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-3 cursor-pointer">
                            <span>
                                <span className="block text-[10px] font-bold uppercase tracking-widest text-black">Keep me logged in</span>
                                <span className="block text-xs text-neutral-500 mt-1">Remember this device for smoother return visits.</span>
                            </span>
                            <input
                                type="checkbox"
                                checked={keepLoggedIn}
                                onChange={(event) => setKeepLoggedIn(event.target.checked)}
                                className="sr-only"
                            />
                            <span className={`relative h-7 w-12 rounded-full transition-colors ${keepLoggedIn ? 'bg-black' : 'bg-neutral-200'}`}>
                                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${keepLoggedIn ? 'translate-x-6' : 'translate-x-1'}`} />
                            </span>
                        </label>
                        <button
                            type="button"
                            onClick={authPersona === 'client' ? openClientGuestPortal : openGuestDashboard}
                            className="mt-3 w-full h-12 rounded-lg bg-[#39FF14] text-black text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-[#39FF14]/20 hover:brightness-95 transition-all"
                        >
                            <Eye size={16}/> {authPersona === 'client' ? 'Preview Client Portal' : 'Browse As Guest'}
                        </button>
                        <div className="flex items-center gap-4 my-5">
                            <div className="h-px bg-neutral-100 flex-1" />
                            <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-300">or email</span>
                            <div className="h-px bg-neutral-100 flex-1" />
                        </div>
                        <div className="space-y-3">
                            <input type="email" value={authForm.email} onChange={(e) => setAuthForm(prev => ({ ...prev, email: e.target.value }))} required placeholder="Email address" autoComplete="email" className="w-full h-12 bg-neutral-50 border border-neutral-100 rounded-lg px-5 text-sm font-bold outline-none focus:bg-white focus:border-black transition-colors" />
                            <input type="password" value={authForm.password} onChange={(e) => setAuthForm(prev => ({ ...prev, password: e.target.value }))} required minLength={6} placeholder="Password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} className="w-full h-12 bg-neutral-50 border border-neutral-100 rounded-lg px-5 text-sm font-bold outline-none focus:bg-white focus:border-black transition-colors" />
                        </div>
                        {authError && <p className="mt-4 text-xs font-bold text-red-500 leading-relaxed">{authError}</p>}
                        <button type="submit" disabled={authBusy} className="mt-5 w-full h-12 rounded-lg bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-wait">
                            {authBusy ? 'Please Wait' : authPersonaCopy.submit}
                        </button>
                        <button type="button" onClick={() => { setAuthMode(authMode === 'signup' ? 'signin' : 'signup'); setAuthError(''); }} className="mt-4 w-full text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-black transition-colors">
                            {authMode === 'signup' ? 'Already have an account?' : 'Need an account? Create one'}
                        </button>
                    </form>
                </div>
            );

            const legalDialog = legalPanel && legalPages[legalPanel] && (
                <div className="fixed inset-0 z-[1000] bg-black/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="w-full sm:max-w-lg bg-white rounded-t-[1.5rem] sm:rounded-lg border border-neutral-100 shadow-2xl p-6 md:p-8 animate-in fade-in zoom-in-95 duration-300 max-h-[calc(100dvh-1rem)] overflow-y-auto">
                        <div className="flex items-start justify-between gap-4 mb-7">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-neutral-400 mb-2">{legalPages[legalPanel].eyebrow}</p>
                                <h2 className="text-3xl font-bold tracking-tight text-black">{legalPages[legalPanel].title}</h2>
                            </div>
                            <button type="button" onClick={() => setLegalPanel(null)} className="w-10 h-10 rounded-full bg-neutral-100 text-neutral-400 flex items-center justify-center hover:text-black transition-colors shrink-0"><X size={16}/></button>
                        </div>
                        <div className="space-y-4">
                            {legalPages[legalPanel].body.map((paragraph) => (
                                <p key={paragraph} className="text-sm leading-relaxed text-neutral-500">{paragraph}</p>
                            ))}
                        </div>
                        <button type="button" onClick={() => setLegalPanel(null)} className="mt-7 h-12 w-full rounded-full bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-800 transition-colors">
                            Close
                        </button>
                    </div>
                </div>
            );

            const confirmActionDialog = confirmDialog && (
                <div className="fixed inset-0 z-[1000] bg-black/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="w-full sm:max-w-md bg-white rounded-t-[1.5rem] sm:rounded-lg border border-neutral-100 shadow-2xl p-6 md:p-7 animate-in fade-in zoom-in-95 duration-300">
                        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-neutral-400 mb-3">{confirmDialog.eyebrow || 'Confirm Action'}</p>
                        <h2 className="text-2xl font-bold tracking-tight text-black mb-3">{confirmDialog.title}</h2>
                        <p className="text-sm leading-relaxed text-neutral-500 mb-6">{confirmDialog.body}</p>
                        <div className="grid grid-cols-2 gap-3">
                            <button type="button" onClick={() => setConfirmDialog(null)} className="h-12 rounded-full bg-white border border-neutral-200 text-black text-[10px] font-bold uppercase tracking-widest hover:border-black transition-colors">
                                Cancel
                            </button>
                            <button type="button" onClick={() => { const action = confirmDialog.onConfirm; setConfirmDialog(null); action?.(); }} className="h-12 rounded-full bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-800 transition-colors">
                                {confirmDialog.actionLabel || 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            );

            const runningLateActionDialog = runningLateDialog && (
                <div className="fixed inset-0 z-[1000] bg-black/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="w-full sm:max-w-lg bg-white rounded-t-[1.5rem] sm:rounded-lg border border-neutral-100 shadow-2xl p-6 md:p-7 animate-in fade-in zoom-in-95 duration-300">
                        <div className="flex items-start justify-between gap-4 mb-5">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400 mb-3">Running Late</p>
                                <h2 className="text-2xl font-bold tracking-tight text-black">Update {runningLateDialog.booking?.clientName || 'client'}</h2>
                                <p className="mt-2 text-sm leading-relaxed text-neutral-500">Send a clean in-app notification and email using your saved communication settings.</p>
                            </div>
                            <button type="button" onClick={() => setRunningLateDialog(null)} className="w-10 h-10 rounded-full bg-neutral-50 border border-neutral-100 flex items-center justify-center text-neutral-500 hover:text-black transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                        <label className="block mb-4">
                            <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-400 mb-2">Minutes Late</span>
                            <input
                                type="number"
                                min="1"
                                value={runningLateDialog.minutes}
                                onChange={(event) => {
                                    const minutes = event.target.value;
                                    setRunningLateDialog(prev => ({
                                        ...prev,
                                        minutes,
                                        message: prev.message?.startsWith('Running ') ? `Running ${minutes || '15'} minutes late. Thanks for your patience - we will keep you posted here.` : prev.message
                                    }));
                                }}
                                className="w-full h-12 rounded-lg bg-neutral-50 border border-neutral-100 px-4 text-sm font-bold text-black outline-none focus:bg-white focus:border-black transition-colors"
                            />
                        </label>
                        <label className="block mb-6">
                            <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-400 mb-2">Message</span>
                            <textarea
                                rows={4}
                                value={runningLateDialog.message}
                                onChange={(event) => setRunningLateDialog(prev => ({ ...prev, message: event.target.value }))}
                                className="w-full resize-none rounded-lg bg-neutral-50 border border-neutral-100 px-4 py-3 text-sm leading-relaxed text-black outline-none focus:bg-white focus:border-black transition-colors"
                            />
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button type="button" onClick={() => setRunningLateDialog(null)} className="h-12 rounded-full bg-white border border-neutral-200 text-black text-[10px] font-bold uppercase tracking-[0.12em] hover:border-black transition-colors">
                                Cancel
                            </button>
                            <button type="button" onClick={submitRunningLateDialog} className="h-12 rounded-full native-gradient-button text-black text-[10px] font-bold uppercase tracking-[0.12em]">
                                Send Update
                            </button>
                        </div>
                    </div>
                </div>
            );

            const editorPreviewFrame = getEditorPreviewFrame(device, isCompactEditorViewport);
            const editorPreviewFrameClass = device === 'desktop'
                ? (isCompactEditorViewport ? 'rounded-lg border-[12px]' : 'rounded-lg border-[22px]')
                : (isCompactEditorViewport ? 'rounded-[3rem] border-[12px]' : 'rounded-[5rem] md:rounded-[5.5rem] border-[16px] md:border-[18px]');
            const profileSections = [
                {
                    id: 'account',
                    title: 'Account & Access',
                    note: isGuestWorkspace ? 'Guest workspace controls' : user?.email || 'Owner account',
                    icon: ShieldCheck,
                    meta: workspaceRole
                },
                {
                    id: 'billing',
                    title: 'Plan & Billing',
                    note: 'Plans, checkout, and billing portal',
                    icon: Briefcase,
                    meta: 'Ready'
                },
                {
                    id: 'business',
                    title: 'Business Details',
                    note: settings.brandName || 'Brand, links, logo, and banner',
                    icon: Palette,
                    meta: settings.slug || 'booking'
                },
                {
                    id: 'manual',
                    title: 'Owner Manual',
                    note: 'Feature guide and setup help',
                    icon: BookOpen,
                    meta: 'Guide',
                    action: () => setShowOwnerManual(true)
                }
            ];
            const activeProfileSectionMeta = profileSections.find(section => section.id === activeProfileSection);

            if (loading || publicLoading) return (
                <div className="h-screen bg-white flex items-center justify-center">
                    <BrandLoader label={publicLoading ? 'Loading booking page' : 'Loading workspace'} />
                </div>
            );

            if (publicSlug) {
                if (publicError || !publicWorkspace) {
                    return (
                        <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6">
                            <div className="max-w-md text-center">
                                <div className="inline-flex mx-auto mb-8">
                                    <BuildABookingBrand className="w-56 max-w-full" variant="light" />
                                </div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.45em] text-white/40 mb-4">Booking Page</p>
                                <h1 className="text-4xl font-bold tracking-tight mb-4">Page unavailable</h1>
                                <p className="text-white/55 leading-relaxed">{publicError || 'This booking page is not available yet.'}</p>
                                <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                                    <button onClick={() => setPublicReloadKey(key => key + 1)} className="h-12 px-6 rounded-full bg-white text-black text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-100 transition-colors">
                                        Try Again
                                    </button>
                                    <button onClick={() => { window.location.href = window.location.origin; }} className="h-12 px-6 rounded-full border border-white/15 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-colors">
                                        Build A Booking
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                }

                return (
                    <div className="h-screen w-screen overflow-x-hidden overflow-y-auto" style={{ backgroundColor: publicWorkspace.backgroundColor || '#ffffff' }}>
                        <Suspense fallback={<LazySectionFallback label="Loading booking page" />}>
                            <BookingFlow settings={publicWorkspace} onComplete={handlePublicBookingComplete} onInstallApp={handleAddToHomeScreen} />
                        </Suspense>
                    </div>
                );
            }

            if (view === 'client') {
                const clientPortalUser = user || (clientGuestMode ? {
                    uid: 'guest-client-preview',
                    displayName: 'Guest Client',
                    email: 'client@example.com',
                    photoURL: ''
                } : null);

                if (!clientPortalUser) {
                    return (
                        <div className={`native-ui min-h-screen flex items-start sm:items-center justify-center px-6 pt-14 pb-10 sm:p-6 ${dashboardThemeMode === 'dark' ? 'dashboard-dark bg-[#050506] text-white' : 'bg-white text-black'}`}>
                            {authDialog}
                            <div className="max-w-md text-center">
                                <BuildABookingBrand className="w-52 sm:w-60 mx-auto mb-8 sm:mb-10" variant={dashboardThemeMode === 'dark' ? 'light' : 'dark'} />
                                <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-neutral-400 mb-4">Client Portal</p>
                                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 leading-tight">Sign in to stay close to your booking.</h1>
                                <p className="text-neutral-500 leading-relaxed mb-7 text-base sm:text-lg">Use the same email you booked with to manage updates, request changes, and chat with the business.</p>
                                <div className="grid gap-3">
                                    <button onClick={() => openAuthPanel('signin', 'client')} className="h-12 px-8 rounded-full bg-black text-white text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-black/10">
                                        Client Sign In
                                    </button>
                                    <button onClick={openClientGuestPortal} className="h-12 px-8 rounded-full bg-white border border-neutral-200 text-black text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-black/5 hover:border-black transition-colors">
                                        Preview Client Side
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                }

                return (
                    <Suspense fallback={<LazySectionFallback label="Loading client portal" />}>
                        <ClientPortal
                            appId={appId}
                            db={clientGuestMode ? null : db}
                            user={clientPortalUser}
                            themeMode={dashboardThemeMode}
                            isGuestPreview={clientGuestMode}
                            onSignOut={clientGuestMode ? () => {
                                setClientGuestMode(false);
                                applyWorkspaceRoute({ view: 'landing' });
                            } : handleSignOut}
                            onOwnerLogin={() => applyWorkspaceRoute({ view: 'dashboard', activeTab: 'overview', editorTab })}
                            onInstallApp={handleAddToHomeScreen}
                        />
                    </Suspense>
                );
            }

            if (view === 'landing') {
                return (
                  <div className={`native-ui native-home min-h-screen font-sans selection:bg-black selection:text-white overflow-x-hidden ${dashboardThemeMode === 'dark' ? 'native-home-dark dashboard-dark bg-[#050506] text-white' : 'bg-white text-black'}`}>
                    {/* Navigation */}
                    <nav className="fixed w-full z-50 bg-white/82 backdrop-blur-xl border-b border-neutral-200/50 transition-all native-home-nav">
                      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 h-16 md:h-20 flex items-center justify-between">
                        <div className="flex items-center cursor-pointer" onClick={() => setView('landing')}>
                          <BuildABookingBrand className="w-[156px] md:w-[188px] h-auto" variant={dashboardThemeMode === 'dark' ? 'light' : 'dark'} />
                        </div>
                        <div className="flex items-center gap-2 md:gap-6">
                          <button
                            type="button"
                            onClick={() => setDashboardThemeMode(mode => (mode === 'dark' ? 'light' : 'dark'))}
                            className="native-home-theme-toggle h-10 w-10 rounded-full bg-white border border-neutral-200 text-black flex items-center justify-center hover:border-black transition-colors"
                            aria-label={dashboardThemeMode === 'dark' ? 'Switch home to light mode' : 'Switch home to dark mode'}
                          >
                            {dashboardThemeMode === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                          </button>
                          <button onClick={() => openAuthPanel('signin', 'owner')} className="block text-[11px] md:text-sm font-semibold text-neutral-500 hover:text-black transition-colors">Sign In</button>
                        <button onClick={openClientPortal} className="hidden md:block text-sm font-semibold text-neutral-500 hover:text-black transition-colors">Client Login</button>
                          <button onClick={openGuestDashboard} className="hidden sm:block h-10 px-4 rounded-full bg-white border border-neutral-200 text-black font-bold text-[11px] hover:border-black transition-colors">Guest Mode</button>
                          <button onClick={openSignupOrDashboard} className="h-10 px-3 md:px-6 rounded-full bg-[#39FF14] text-black font-bold text-[10px] md:text-xs hover:scale-105 transition-transform shadow-lg shadow-[#39FF14]/20">Get Started</button>
                        </div>
                      </div>
                    </nav>

                    {authDialog}
                    {legalDialog}
            
                    {/* Hero Section */}
                    <section className="relative pt-32 md:pt-56 pb-20 md:pb-32 px-4 sm:px-6 flex flex-col items-center text-center border-b border-neutral-100">
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neutral-50 border border-neutral-200 text-xs font-bold mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 text-neutral-600">
                        <span className="w-5 h-5 rounded-full bg-[#39FF14] text-black flex items-center justify-center"><Sparkles size={13} /></span> The next generation of scheduling
                      </div>
                      
                      <h1 className="text-4xl sm:text-5xl md:text-[90px] lg:text-[110px] font-bold tracking-tighter leading-[0.95] md:leading-[0.9] max-w-6xl mb-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100">
                        Schedule like a studio. <br className="hidden md:block" />
                        <span className="native-accent-text">Not a spreadsheet.</span>
                      </h1>
                      
                      <p className="text-lg md:text-2xl font-medium text-neutral-500 max-w-2xl mb-12 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-200">
                        Give clients a booking page that feels premium from the first click, then manage every request, message, client, and open slot from one clean workspace.
                      </p>
                      
                      <div className="flex flex-col md:flex-row items-center gap-4 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300 w-full md:w-auto">
                        <button onClick={openSignupOrDashboard} className="h-14 px-10 rounded-full bg-[#39FF14] text-black font-bold text-sm hover:scale-105 transition-transform shadow-2xl shadow-[#39FF14]/20 flex items-center gap-2 w-full md:w-auto justify-center">
                          Start Building Now <ArrowRight size={16} />
                        </button>
                        <button onClick={openGuestDashboard} className="h-14 px-10 rounded-full bg-white text-black border border-neutral-200 font-bold text-sm hover:border-black transition-colors flex items-center gap-2 w-full md:w-auto justify-center">
                          Browse Dashboard <Eye size={16} />
                        </button>
                        <button onClick={openClientPortal} className="h-14 px-10 rounded-full bg-white text-black border border-neutral-200 font-bold text-sm hover:border-black transition-colors flex items-center gap-2 w-full md:w-auto justify-center">
                          Client Login <MessageCircle size={16} />
                        </button>
                      </div>
                    </section>
            
                    {/* Bento Grid Features */}
                    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-32">
                      <div className="text-center mb-16 md:mb-24">
                        <h2 className="text-3xl sm:text-4xl md:text-6xl font-bold tracking-tighter mb-6">Every tool behind a booking experience clients trust.</h2>
                        <p className="text-neutral-500 font-medium text-lg md:text-xl max-w-2xl mx-auto">Design the page, control availability, approve requests, message clients, and remember the people behind every booking.</p>
                      </div>
                      
                      <div className="native-feature-wave-list grid grid-cols-1 md:grid-cols-3 gap-6">
                        
                        {/* Box 1: Design (Span 2) */}
                        <div className="native-feature-card md:col-span-2 bg-[#fafafa] rounded-lg p-6 sm:p-8 md:p-14 border border-neutral-200/60 hover:shadow-xl transition-all group relative overflow-hidden">
                          <Palette className="mb-6 text-black relative z-10" size={36} strokeWidth={1.5} />
                          <h3 className="text-2xl md:text-4xl font-bold tracking-tight mb-4 text-black relative z-10">Editor.</h3>
                          <p className="text-neutral-500 font-medium text-lg max-w-md relative z-10">Design your booking page in minutes. Change colors, try fonts, upload your logo, and preview every detail as you go.</p>
                        </div>
                        
                        {/* Box 2: My Bookings (Span 1) */}
                        <div className="native-feature-card bg-[#fafafa] rounded-lg p-6 sm:p-8 md:p-14 border border-neutral-200/60 hover:shadow-xl transition-all group flex flex-col">
                          <BookOpen className="mb-6 text-black" size={36} strokeWidth={1.5} />
                          <h3 className="text-2xl font-bold tracking-tight mb-4 text-black">My Bookings.</h3>
                          <p className="text-neutral-500 font-medium flex-1">Review requests, confirm clients, manage waitlists, and keep every booking moving.</p>
                        </div>
                        
                        {/* Box 3: Schedule (Span 1) */}
                        <div className="native-feature-card bg-[#fafafa] rounded-lg p-6 sm:p-8 md:p-14 border border-neutral-200/60 hover:shadow-xl transition-all group">
                          <Calendar className="mb-6 text-black" size={36} strokeWidth={1.5} />
                          <h3 className="text-2xl font-bold tracking-tight mb-4 text-black">Schedule.</h3>
                          <p className="text-neutral-500 font-medium">Open days, close dates, adjust slots, and keep availability clear for clients.</p>
                        </div>

                        {/* Box 4: Support Inbox (Span 1) */}
                        <div className="native-feature-card bg-[#fafafa] rounded-lg p-6 sm:p-8 md:p-14 border border-neutral-200/60 hover:shadow-xl transition-all group">
                          <MessageSquare className="mb-6 text-black" size={36} strokeWidth={1.5} />
                          <h3 className="text-2xl font-bold tracking-tight mb-4 text-black">Support Inbox.</h3>
                          <p className="text-neutral-500 font-medium">Reply to clients, manage reschedule requests, and keep every booking conversation tied to the right request.</p>
                        </div>

                        {/* Box 5: My Clients (Span 1) */}
                        <div className="native-feature-card bg-[#fafafa] rounded-lg p-6 sm:p-8 md:p-14 border border-neutral-200/60 hover:shadow-xl transition-all group">
                          <Star className="mb-6 text-black" size={36} strokeWidth={1.5} />
                          <h3 className="text-2xl font-bold tracking-tight mb-4 text-black">My Clients.</h3>
                          <p className="text-neutral-500 font-medium">Build client profiles with notes, labels, photos, messages, and booking history.</p>
                        </div>
            
                        {/* Box 6: Team/Staff (Span 2) */}
                        <div className="native-feature-card native-feature-hero-card md:col-span-2 bg-[#fafafa] text-black rounded-lg p-6 sm:p-8 md:p-16 border border-neutral-200/60 hover:shadow-xl transition-all relative overflow-hidden group">
                          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-10">
                              <div className="max-w-xl">
                                  <Users className="mb-6 text-black" size={36} strokeWidth={1.5} />
                                  <h3 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Team.</h3>
                                  <p className="text-neutral-500 font-medium text-lg">Add your team, assign bookings, and see who handled each client at a glance.</p>
                              </div>
                          </div>
                        </div>

                        {/* Box 7: Profile (Span 1) */}
                        <div className="native-feature-card bg-[#fafafa] rounded-lg p-6 sm:p-8 md:p-14 border border-neutral-200/60 hover:shadow-xl transition-all group flex flex-col">
                          <User className="mb-6 text-black" size={36} strokeWidth={1.5} />
                          <h3 className="text-2xl font-bold tracking-tight mb-4 text-black">Profile.</h3>
                          <p className="text-neutral-500 font-medium flex-1">Keep business details, logos, social links, and referral tools in one place.</p>
                        </div>

                        {/* Box 8: Dashboard (Span 3) */}
                        <div className="native-feature-card md:col-span-3 bg-[#fafafa] rounded-lg p-6 sm:p-8 md:p-12 border border-neutral-200/60 hover:shadow-xl transition-all flex flex-col md:flex-row items-center justify-between gap-6 md:gap-10 text-center md:text-left">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-black shadow-sm shrink-0"><Layout size={24}/></div>
                                <div>
                                    <h3 className="text-xl font-bold tracking-tight text-black mb-1">Dashboard.</h3>
                                    <p className="text-neutral-500 font-medium">See today, requests, booking rate, clients, messages, and schedule health at a glance.</p>
                                </div>
                            </div>
                            <button onClick={openGuestDashboard} className="h-14 px-8 rounded-full bg-[#39FF14] text-black font-bold text-sm hover:scale-105 transition-transform shrink-0 w-full md:w-auto shadow-xl shadow-[#39FF14]/20">
                                Browse Dashboard
                            </button>
                        </div>

                      </div>
                    </section>
            
                    {/* Footer CTA */}
                    <section className="py-20 md:py-32 px-4 sm:px-6 text-center border-t border-neutral-200/50 bg-neutral-50/50">
                      <div className="flex flex-col items-center max-w-3xl mx-auto">
                        <h2 className="text-4xl md:text-7xl font-bold tracking-tighter mb-8 text-black leading-[0.95] md:leading-[0.9]">Ready to upgrade your booking flow?</h2>
                        <p className="text-xl text-neutral-500 font-medium mb-10">Build a booking experience that feels clean, premium, easy for you to manage, and effortless for clients to use.</p>
                        <button onClick={openSignupOrDashboard} className="h-16 px-12 rounded-full bg-[#39FF14] text-black font-bold text-sm hover:scale-105 transition-transform shadow-2xl shadow-[#39FF14]/20">
                          Build Your Booking Flow
                        </button>
                        <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                          <button type="button" onClick={() => setLegalPanel('privacy')} className="hover:text-black transition-colors">Privacy</button>
                          <span className="h-1 w-1 rounded-full bg-neutral-300" />
                          <button type="button" onClick={() => setLegalPanel('terms')} className="hover:text-black transition-colors">Terms</button>
                          <span className="h-1 w-1 rounded-full bg-neutral-300" />
                          <button type="button" onClick={() => setLegalPanel('support')} className="hover:text-black transition-colors">Support</button>
                        </div>
                      </div>
                    </section>
                  </div>
                );
            }

            return (
                <div
                    className={`flex h-screen overflow-hidden font-sans relative native-ui ${dashboardThemeMode === 'dark' ? 'dashboard-dark' : 'dashboard-light'}`}
                >
                {/* Global Toast */}
                {toast && (
                    <div className="native-toast fixed top-4 md:top-10 left-1/2 -translate-x-1/2 z-[9999] max-w-[calc(100vw-2rem)] px-5 md:px-8 py-3 md:py-4 bg-black text-white rounded-2xl md:rounded-full text-[10px] md:text-xs font-bold uppercase tracking-[0.18em] md:tracking-widest leading-relaxed shadow-2xl animate-in slide-in-from-top-10 fade-in duration-500 flex items-center gap-3 text-center">
                        <CheckCircle2 size={16} className="text-[#39FF14] shrink-0" /> {toast}
                    </div>
                )}
                {authDialog}
                {legalDialog}
                {confirmActionDialog}
                {runningLateActionDialog}
                {showOnboarding && (
                    <Suspense fallback={<LazySectionFallback label="Loading setup" />}>
                        <OnboardingShowroom
                            open={showOnboarding}
                            settings={settings}
                            bookingOrigin={window.location.origin}
                            initialSceneId={onboardingStartScene}
                            canApply={canSetupWorkspace}
                            onSkip={handleOnboardingSkip}
                            onComplete={handleOnboardingComplete}
                            onDraftChange={handleOnboardingDraftChange}
                            onNavigate={handleOnboardingNavigate}
                        />
                    </Suspense>
                )}
                {showOwnerManual && (
                    <Suspense fallback={<LazySectionFallback label="Loading manual" />}>
                        <OwnerManual
                            themeMode={dashboardThemeMode}
                            onClose={() => setShowOwnerManual(false)}
                            onNavigate={(targetTab, targetEditorTab) => {
                                setShowOwnerManual(false);
                                setActiveTab(targetTab);
                                if (targetEditorTab) setEditorTab(targetEditorTab);
                            }}
                        />
                    </Suspense>
                )}
                {user && !publicSlug && (
                    <NotificationCenter
                        title="Workspace Alerts"
                        subtitle="Booking requests, chat messages, client nudges, and birthday reminders."
                        notifications={ownerNotifications}
                        permission={browserNotificationPermission}
                        onRequestPermission={requestOwnerBrowserNotifications}
                        onMarkRead={markOwnerNotificationRead}
                        onMarkAllRead={markAllOwnerNotificationsRead}
                        onOpenNotification={openOwnerNotification}
                    />
                )}

                <div className={`dashboard-sidebar hidden md:flex transition-all duration-700 ease-in-out bg-white border-r border-neutral-100 flex-col relative z-50 shadow-sm ${sidebarCollapsed ? 'w-0 opacity-0 pointer-events-none' : 'w-80 p-8'}`}>
                    {!sidebarCollapsed && (
                    <>
                        <div className="flex items-center mb-8 px-2 cursor-pointer group" onClick={() => setView('landing')}>
                            <BuildABookingBrand className="w-[190px] h-auto transition-transform duration-300 group-hover:scale-[1.02]" variant={dashboardThemeMode === 'dark' ? 'light' : 'dark'} />
                        </div>
                        {user && (
                            <div className="mb-6 rounded-lg border border-neutral-100 bg-neutral-50 p-3">
                                <div className="flex items-center justify-between gap-3 mb-2">
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">Workspace</span>
                                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${workspaceRole === 'owner' || workspaceRole === 'guest' ? 'bg-[#39FF14] text-black' : workspaceRole === 'admin' ? 'bg-black text-white' : 'bg-white text-neutral-500 border border-neutral-100'}`}>
                                        {workspaceRole}
                                    </span>
                                </div>
                                <select
                                    value={workspaceOwnerId}
                                    onChange={(event) => {
                                        setActiveWorkspaceOwnerId(event.target.value);
                                        safeLocalSet('build-a-booking-active-workspace', event.target.value);
                                    }}
                                    className="w-full h-10 rounded-lg bg-white border border-neutral-100 px-3 text-xs font-bold text-black outline-none focus:border-black"
                                >
                                    {workspaceChoices.map(workspace => (
                                        <option key={workspace.ownerId} value={workspace.ownerId}>
                                            {workspace.workspaceName || workspace.ownerEmail || 'Workspace'}
                                        </option>
                                    ))}
                                </select>
                                {accessLoading && <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mt-2">Checking access...</p>}
                            </div>
                        )}
                        {isGuestWorkspace && (
                            <div className="mb-6 rounded-lg border border-neutral-100 bg-neutral-50 p-4">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-2">Guest Mode</p>
                                <p className="text-sm font-bold text-black mb-3">Browse every tool with local demo edits.</p>
                                <button onClick={() => openAuthPanel('signup', 'owner')} className="h-10 w-full rounded-lg bg-[#39FF14] text-black text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:brightness-95 transition-all">
                                    <ShieldCheck size={14}/> Save For Real
                                </button>
                            </div>
                        )}
                        <nav className="space-y-3 flex-1 overflow-y-auto no-scrollbar pb-10">
                        {navItems.map(item => {
                            const IconCmp = item.icon;
                            return (
                                <button key={item.id} data-tour={`nav-${item.id}`} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center gap-5 px-6 py-5 rounded-lg text-[11px] font-bold transition-all duration-700 ${activeTab === item.id ? 'bg-[#39FF14] text-black shadow-xl shadow-[#39FF14]/20 scale-[1.02]' : 'text-neutral-400 hover:bg-neutral-50 hover:text-black'}`}>
                                <IconCmp size={18} strokeWidth={2.5} /> {item.label.toUpperCase()}
                                {item.badge && <div className={`ml-auto w-2 h-2 rounded-full animate-pulse ${activeTab === item.id ? 'bg-black' : 'bg-[#39FF14]'}`} />}
                                </button>
                            );
                        })}
                        </nav>
                        <div className="mt-auto space-y-4 pt-6 border-t border-neutral-100">
                            <button
                                type="button"
                                onClick={() => setDashboardThemeMode(mode => mode === 'dark' ? 'light' : 'dark')}
                                className="w-full h-12 rounded-full border border-neutral-200 bg-white text-black text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:border-black transition-colors dashboard-theme-switch"
                                aria-pressed={dashboardThemeMode === 'dark'}
                            >
                                {dashboardThemeMode === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                                {dashboardThemeMode === 'dark' ? 'Light Mode' : 'Dark Mode'}
                            </button>
                            {isGuestWorkspace ? (
                                <div className="space-y-2">
                                    <ProButton onClick={() => openAuthPanel('signin', 'owner')} variant="neon" className="w-full py-4 text-[10px]">Sign In</ProButton>
                                    <ProButton onClick={handleSignOut} variant="outline" className="w-full py-4 text-[10px]">Exit Guest</ProButton>
                                </div>
                            ) : (
                                <ProButton onClick={handleSignOut} variant="outline" className="w-full py-4 text-[10px]">Sign Out</ProButton>
                            )}
                        </div>
                    </>
                    )}
                </div>

                <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="desktop-sidebar-toggle hidden md:flex fixed bottom-6 left-6 md:bottom-10 md:left-10 z-[100] w-12 h-12 bg-white border border-neutral-100 rounded-full shadow-2xl items-center justify-center text-neutral-400 hover:text-black transition-all hover:scale-110">
                    {sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
                </button>

                <button
                    type="button"
                    onClick={() => setDashboardThemeMode(mode => mode === 'dark' ? 'light' : 'dark')}
                    className="dashboard-theme-floating md:hidden fixed right-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-[140] w-11 h-11 rounded-full bg-white border border-neutral-200 shadow-xl shadow-black/10 flex items-center justify-center text-black"
                    aria-label={dashboardThemeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                    {dashboardThemeMode === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
                </button>

                {isGuestWorkspace && (
                    <div className="mobile-guest-auth-cta md:hidden fixed left-3 right-3 bottom-[5.35rem] z-[130] rounded-2xl border border-neutral-200 bg-white/95 backdrop-blur-xl shadow-2xl shadow-black/10 p-2 flex items-center gap-2">
                        <div className="min-w-0 flex-1 px-2">
                            <p className="text-[8px] font-bold uppercase tracking-[0.22em] text-neutral-400">Guest Mode</p>
                            <p className="text-xs font-bold text-black truncate">Save this workspace</p>
                        </div>
                        <button type="button" onClick={() => openAuthPanel('signin', 'owner')} className="h-10 px-3 rounded-xl bg-neutral-100 text-black text-[9px] font-bold uppercase tracking-widest">
                            Sign In
                        </button>
                        <button type="button" onClick={() => openAuthPanel('signup', 'owner')} className="h-10 px-3 rounded-xl bg-[#39FF14] text-black text-[9px] font-bold uppercase tracking-widest shadow-lg shadow-[#39FF14]/20">
                            Sign Up
                        </button>
                    </div>
                )}

                <nav className={`mobile-bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-[120] bg-white/95 backdrop-blur-xl border-t border-neutral-200 shadow-[0_-16px_40px_-30px_rgba(0,0,0,0.45)] transition-all duration-500 ${activeTab === 'editor' && mobileNavCollapsed ? 'mobile-bottom-nav-collapsed' : ''}`}>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar px-3 py-3 justify-around">
                        {navItems.map(item => {
                            const IconCmp = item.icon;
                            const isActive = activeTab === item.id;
                            return (
                                <button
                                    key={item.id}
                                    data-tour={`mobile-nav-${item.id}`}
                                    aria-label={item.label}
                                    onClick={() => setActiveTab(item.id)}
                                    className={`relative min-w-[56px] h-14 rounded-lg flex items-center justify-center transition-all ${isActive ? 'bg-[#39FF14] text-black shadow-lg shadow-[#39FF14]/20 scale-[1.03]' : 'text-neutral-400 bg-neutral-50'}`}
                                >
                                    <IconCmp size={20} strokeWidth={2.35} />
                                    {item.badge && <span className={`absolute top-1.5 right-2 w-2 h-2 rounded-full ${isActive ? 'bg-black' : 'bg-[#39FF14]'}`} />}
                                </button>
                            );
                        })}
                    </div>
                </nav>

                <div className={`dashboard-main relative z-10 flex-1 flex overflow-hidden ${isGuestWorkspace ? 'pb-36' : 'pb-20'} md:pb-0 ${activeTab === 'editor' && mobileNavCollapsed ? 'mobile-nav-space-collapsed' : ''}`}>
                    {activeTab === 'overview' && (
                        <div className="flex-1 overflow-y-auto bg-[#F6F7F9] p-4 sm:p-6 md:p-10 lg:p-12">
                            <header className="dashboard-page-header mb-4 md:mb-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                                <div>
                                    <h1 className="text-4xl md:text-4xl font-bold tracking-tight text-black">Dashboard</h1>
                                    <p className="text-neutral-500 text-sm md:text-base mt-2 max-w-2xl">A clean operating view for bookings, capacity, requests, and client movement.</p>
                                </div>
                                <div className="dashboard-overview-actions grid grid-cols-5 sm:flex sm:flex-row gap-1.5 sm:gap-3">
                                    <button onClick={() => { setOnboardingStartScene('intro'); setShowOnboarding(true); }} className="dashboard-overview-action h-10 sm:h-11 px-2 sm:px-5 rounded-lg bg-white border border-neutral-200 text-black text-[9px] sm:text-[11px] font-bold uppercase tracking-[0.14em] sm:tracking-widest flex items-center justify-center gap-1.5 sm:gap-2 hover:bg-neutral-50 transition-colors">
                                        <Sparkles size={14}/><span className="sm:hidden">Tour</span><span className="hidden sm:inline">Intro Tour</span>
                                    </button>
                                    <button onClick={() => { setOnboardingStartScene('name'); setShowOnboarding(true); }} className="dashboard-overview-action h-10 sm:h-11 px-2 sm:px-5 rounded-lg bg-white border border-neutral-200 text-black text-[9px] sm:text-[11px] font-bold uppercase tracking-[0.14em] sm:tracking-widest flex items-center justify-center gap-1.5 sm:gap-2 hover:bg-neutral-50 transition-colors">
                                        <ArrowRight size={14}/><span className="sm:hidden">Setup</span><span className="hidden sm:inline">Continue Setup</span>
                                    </button>
                                    <button onClick={() => setShowOwnerManual(true)} className="dashboard-overview-action h-10 sm:h-11 px-2 sm:px-5 rounded-lg bg-white border border-neutral-200 text-black text-[9px] sm:text-[11px] font-bold uppercase tracking-[0.14em] sm:tracking-widest flex items-center justify-center gap-1.5 sm:gap-2 hover:bg-neutral-50 transition-colors">
                                        <BookOpen size={14}/><span className="sm:hidden">Manual</span><span className="hidden sm:inline">Owner Manual</span>
                                    </button>
                                    <button onClick={() => setActiveTab('editor')} className="dashboard-overview-action h-10 sm:h-11 px-2 sm:px-5 rounded-lg bg-black text-white text-[9px] sm:text-[11px] font-bold uppercase tracking-[0.14em] sm:tracking-widest flex items-center justify-center gap-1.5 sm:gap-2 hover:bg-neutral-800 transition-colors">
                                        <Palette size={14}/><span className="sm:hidden">Edit</span><span className="hidden sm:inline">Edit Page</span>
                                    </button>
                                    <button data-tour="publish-button" onClick={saveSettings} className="dashboard-overview-action h-10 sm:h-11 px-2 sm:px-5 rounded-lg bg-[#39FF14] text-black text-[9px] sm:text-[11px] font-bold uppercase tracking-[0.14em] sm:tracking-widest flex items-center justify-center gap-1.5 sm:gap-2 hover:brightness-95 transition-all">
                                        <Check size={14}/> Publish
                                    </button>
                                </div>
                            </header>

                            <section data-tour="dashboard-hero" className="mb-6 saas-card p-5 md:p-6 lg:p-8">
                                <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6 mb-8">
                                    <div className="max-w-3xl">
                                        <div className="inline-flex items-center gap-2 rounded-lg bg-neutral-50 border border-neutral-100 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-5">
                                            <span className="w-2 h-2 rounded-full bg-[#39FF14] shadow-[0_0_0_4px_rgba(57,255,20,0.14)]" />
                                            Live Workspace
                                        </div>
                                        <h2 className="text-3xl md:text-5xl font-bold tracking-tight leading-none text-black mb-3">{dashboardPortfolio.greeting}, {dashboardGreetingName}</h2>
                                        <p className="text-neutral-500 text-base md:text-lg leading-relaxed">
                                            {dashboardPortfolio.period.title} / {dashboardPortfolio.period.rangeLabel}. Focus on requests, confirmed work, and available capacity.
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-stretch sm:items-end gap-3">
                                        <div className="inline-grid grid-cols-3 gap-1 rounded-lg bg-neutral-100 p-1">
                                            {dashboardPortfolio.periods.map(period => (
                                                <button
                                                    key={period.id}
                                                    onClick={() => setDashboardPeriod(period.id)}
                                                    className={`h-10 px-4 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${dashboardPeriod === period.id ? 'bg-[#39FF14] text-black shadow-lg shadow-[#39FF14]/20' : 'text-neutral-500 hover:text-black'}`}
                                                >
                                                    {period.label}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <button onClick={() => setActiveTab('bookings')} className="h-11 px-4 rounded-lg bg-[#39FF14] text-black text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:brightness-95 transition-all">
                                                <Bell size={15}/> Review
                                            </button>
                                            <button onClick={() => setActiveTab('business')} className="h-11 px-4 rounded-lg bg-white border border-neutral-200 text-black text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:border-black transition-colors">
                                                <Calendar size={15}/> Schedule
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="native-stat-grid grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 md:gap-3">
                                    {[
                                        { label: 'Bookings', value: dashboardPortfolio.activeBookings, hint: `${dashboardPortfolio.confirmed} confirmed`, icon: CalendarCheck },
                                        { label: 'Needs Review', value: dashboardPortfolio.needsAttention, hint: `${dashboardPortfolio.pending} requests / ${dashboardPortfolio.waitlist} waitlist`, icon: Bell },
                                        { label: 'Booking Rate', value: `${dashboardPortfolio.bookingRate}%`, hint: `${dashboardPortfolio.confirmed}/${dashboardPortfolio.activeBookings || 0} confirmed`, icon: ShieldCheck },
                                        { label: 'Open Slots', value: dashboardPortfolio.openSlots, hint: `${dashboardPortfolio.reservedSlots}/${dashboardPortfolio.capacity} booked`, icon: Clock }
                                    ].map(metric => {
                                    const IconCmp = metric.icon;
                                    return (
                                        <div key={metric.label} className="native-stat-card rounded-lg border border-neutral-100 bg-white p-5 text-black">
                                            <div className="flex items-start justify-between mb-7">
                                                <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center text-black"><IconCmp size={17}/></div>
                                                <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md bg-neutral-100 text-neutral-500">{metric.hint}</span>
                                            </div>
                                            <p className="text-[10px] font-bold uppercase tracking-[0.25em] mb-2 text-neutral-400">{metric.label}</p>
                                            <p className="metric-value text-3xl md:text-4xl font-bold tracking-tight text-black">{metric.value}</p>
                                        </div>
                                    );
                                })}
                                </div>
                            </section>

                            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                                <section className="xl:col-span-8 saas-card overflow-hidden">
                                    <div className="p-5 md:p-6 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div>
                                            <h2 className="text-lg font-bold tracking-tight">Activity</h2>
                                            <p className="text-sm text-neutral-500">{dashboardPortfolio.period.title} bookings, requests, and waitlist spots.</p>
                                        </div>
                                        <button onClick={() => setActiveTab('bookings')} className="h-10 px-4 rounded-lg bg-neutral-50 text-[10px] font-bold uppercase tracking-widest text-neutral-500 hover:text-black hover:bg-neutral-100 transition-colors">View Queue</button>
                                    </div>
                                    <div className="divide-y divide-neutral-100">
                                        {dashboardPortfolio.activityList.slice(0, 6).map(b => {
                                            const assignedStaff = staffList.find(staff => staff.id === b.staffId);
                                            const clientAvatar = getBookingClientAvatar(b);
                                            const contactSummary = [b.clientPhone, b.clientEmail, b.clientBirthday ? `Bday: ${b.clientBirthday}` : '', b.clientNote ? `Note: ${b.clientNote}` : ''].filter(Boolean).join(' / ');
                                            const statusStyle = b.status === 'confirmed'
                                                ? 'bg-[#39FF14] text-black'
                                                : b.status === 'waitlist'
                                                    ? 'bg-amber-100 text-amber-800'
                                                    : b.status === 'declined'
                                                        ? 'bg-red-50 text-red-600'
                                                        : 'bg-black text-white';
                                            return (
                                                <div key={b.id} className="p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-neutral-50 transition-colors">
                                                    <div className="flex items-center gap-4 min-w-0">
                                                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold shrink-0 overflow-hidden ${clientAvatar ? 'bg-neutral-100 text-black' : statusStyle}`}>
                                                            {clientAvatar ? <img src={clientAvatar} alt="" className="w-full h-full object-cover" /> : b.clientName.charAt(0)}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                                <h3 className="font-bold text-black truncate">{b.clientName}</h3>
                                                                {b.noShowHistory && <span className="px-2 py-1 rounded-md bg-red-50 text-red-600 text-[8px] font-bold uppercase tracking-widest">Risk</span>}
                                                            </div>
                                                            <p className="text-sm text-neutral-500 truncate">{contactSummary || 'No contact details collected'}{assignedStaff ? ` / ${assignedStaff.name}` : ''}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between md:justify-end gap-4">
                                                        <div className="text-left md:text-right">
                                                            <p className="metric-value text-base font-bold">{b.time}</p>
                                                            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{b.date}</p>
                                                        </div>
                                                        <span className={`min-w-[92px] text-center text-[10px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-md ${statusStyle}`}>{b.status === 'waitlist' ? 'Standby' : b.status}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {!dashboardPortfolio.activityList.length && (
                                            <div className="p-12 text-center">
                                                <div className="w-14 h-14 rounded-lg bg-neutral-100 flex items-center justify-center mx-auto mb-5 text-neutral-400"><CalendarCheck size={22}/></div>
                                                <h3 className="text-lg font-bold tracking-tight text-black mb-2">{dashboardPortfolio.period.emptyTitle}</h3>
                                                <p className="text-sm text-neutral-500">{dashboardPortfolio.period.emptyText}</p>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                <aside className="xl:col-span-4 space-y-6">
                                    <section className="saas-card p-5 md:p-6">
                                        <div className="flex items-center justify-between mb-6">
                                            <div>
                                                <h2 className="text-lg font-bold tracking-tight">Next Actions</h2>
                                                <p className="text-sm text-neutral-500">The work most likely to matter now.</p>
                                            </div>
                                            <div className="w-10 h-10 rounded-lg bg-[#39FF14] text-black flex items-center justify-center shadow-lg shadow-[#39FF14]/20"><Zap size={17}/></div>
                                        </div>
                                        <div className="space-y-3">
                                            {[
                                                {
                                                    title: dashboardPortfolio.needsAttention ? `Review ${dashboardPortfolio.needsAttention} booking${dashboardPortfolio.needsAttention === 1 ? '' : 's'}` : 'No requests waiting',
                                                    detail: `${dashboardPortfolio.pending} pending / ${dashboardPortfolio.waitlist} waitlist`,
                                                    tab: 'bookings',
                                                    icon: Bell,
                                                    active: dashboardPortfolio.needsAttention > 0
                                                },
                                                {
                                                    title: dashboardPortfolio.openSlots ? `${dashboardPortfolio.openSlots} slots still open` : 'No open slots in this period',
                                                    detail: `${dashboardPortfolio.reservedSlots}/${dashboardPortfolio.capacity} capacity booked`,
                                                    tab: 'business',
                                                    icon: Calendar,
                                                    active: dashboardPortfolio.openSlots > 0
                                                },
                                                {
                                                    title: `${dashboardPortfolio.clientCount} client${dashboardPortfolio.clientCount === 1 ? '' : 's'} in view`,
                                                    detail: `${dashboardPortfolio.firstTimers} first-time booker${dashboardPortfolio.firstTimers === 1 ? '' : 's'}`,
                                                    tab: 'clients',
                                                    icon: Users,
                                                    active: dashboardPortfolio.clientCount > 0
                                                },
                                                {
                                                    title: dashboardPortfolio.pageReadiness === 100 ? 'Booking page ready' : 'Finish booking page setup',
                                                    detail: `${dashboardPortfolio.pageReadiness}% setup complete`,
                                                    tab: 'editor',
                                                    icon: Palette,
                                                    active: dashboardPortfolio.pageReadiness < 100
                                                }
                                            ].map(action => {
                                                const IconCmp = action.icon;
                                                return (
                                                    <button key={action.title} onClick={() => setActiveTab(action.tab)} className="w-full rounded-lg border border-neutral-200 bg-white p-4 text-left text-black transition-all hover:border-neutral-300 hover:shadow-lg">
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-bold truncate text-black">{action.title}</p>
                                                                <p className="text-xs font-medium mt-1 text-neutral-500">{action.detail}</p>
                                                            </div>
                                                            <div className="w-9 h-9 rounded-lg bg-[#39FF14] text-black flex items-center justify-center shrink-0 shadow-lg shadow-[#39FF14]/20"><IconCmp size={15}/></div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </section>
                                </aside>

                                <section className="xl:col-span-4 saas-card p-5 md:p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <div>
                                            <h2 className="text-lg font-bold tracking-tight">Period Breakdown</h2>
                                            <p className="text-sm text-neutral-500">{dashboardPortfolio.period.rangeLabel}</p>
                                        </div>
                                        <Layers size={18} className="text-neutral-300" />
                                    </div>
                                    <div className="space-y-4">
                                        {[
                                            ['Confirmed', dashboardPortfolio.confirmed, 'bg-[#39FF14]'],
                                            ['Pending', dashboardPortfolio.pending, 'bg-black'],
                                            ['Waitlist', dashboardPortfolio.waitlist, 'bg-amber-400'],
                                            ['Declined', dashboardPortfolio.declined, 'bg-red-400']
                                        ].map(row => {
                                            const percent = dashboardPortfolio.periodBookings.length ? Math.round((row[1] / dashboardPortfolio.periodBookings.length) * 100) : 0;
                                            return (
                                                <div key={row[0]}>
                                                    <div className="flex items-center justify-between gap-4 mb-2">
                                                        <span className="text-sm font-bold text-black">{row[0]}</span>
                                                        <span className="metric-value text-sm font-bold text-neutral-500">{row[1]}</span>
                                                    </div>
                                                    <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                                                        <div className={`h-full rounded-full ${row[2]}`} style={{ width: `${percent}%` }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>

                                <section className="xl:col-span-4 saas-card p-5 md:p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <div>
                                            <h2 className="text-lg font-bold tracking-tight">Schedule</h2>
                                            <p className="text-sm text-neutral-500">Capacity for the selected timeframe.</p>
                                        </div>
                                        <Calendar size={18} className="text-neutral-300" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 mb-5">
                                        <div className="rounded-lg bg-neutral-50 border border-neutral-100 p-4">
                                            <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-2">Capacity</p>
                                            <p className="metric-value text-2xl font-bold text-black">{dashboardPortfolio.capacity}</p>
                                        </div>
                                        <div className="rounded-lg bg-neutral-50 border border-neutral-100 p-4">
                                            <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-2">Open</p>
                                            <p className="metric-value text-2xl font-bold text-black">{dashboardPortfolio.openSlots}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        {[
                                            ['Booked slots', `${dashboardPortfolio.reservedSlots}/${dashboardPortfolio.capacity}`],
                                            ['Today status', dashboardPortfolio.todayAvailable ? `${dashboardPortfolio.todayOpenSlots} open today` : 'Closed today'],
                                            ['Default slots', `${(settings.availableTimes || []).length} times`]
                                        ].map(row => (
                                            <div key={row[0]} className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-3 last:border-0 last:pb-0">
                                                <span className="text-sm text-neutral-500">{row[0]}</span>
                                                <span className="text-sm font-bold text-black text-right">{row[1]}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={() => setActiveTab('business')} className="mt-6 w-full h-11 rounded-lg bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-800 transition-colors">Tune Schedule</button>
                                </section>

                                <section className="xl:col-span-4 saas-card p-5 md:p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <div>
                                            <h2 className="text-lg font-bold tracking-tight">Clients</h2>
                                            <p className="text-sm text-neutral-500">People connected to this timeframe.</p>
                                        </div>
                                        <Star size={18} className="text-neutral-300" />
                                    </div>
                                    <div className="space-y-4">
                                        {[
                                            ['Clients in period', dashboardPortfolio.clientCount],
                                            ['First-time bookers', dashboardPortfolio.firstTimers],
                                            ['All saved profiles', clientMetrics.total],
                                            ['No-show risk flags', dashboardPortfolio.noShowRisk]
                                        ].map(row => (
                                            <div key={row[0]} className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-4 last:border-0 last:pb-0">
                                                <span className="text-sm text-neutral-500">{row[0]}</span>
                                                <span className="metric-value text-lg font-bold text-black">{row[1]}</span>
                                            </div>
                                            ))}
                                    </div>
                                    <button onClick={() => setActiveTab('clients')} className="mt-6 w-full h-11 rounded-lg bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-800 transition-colors">Open Clients</button>
                                </section>
                            </div>
                        </div>
                    )}

                    {activeTab === 'profile' && (
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10 lg:p-12 relative bg-[#F7F7F5]">
                            <header className="dashboard-page-header max-w-6xl mb-4 md:mb-6">
                                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                                    <div>
                                        <h2 className="text-4xl md:text-4xl font-bold tracking-tight text-black">Profile</h2>
                                        <p className="text-neutral-500 font-medium text-sm md:text-base mt-2 max-w-2xl">Manage your owner account, brand identity, and the links clients use to recognize your business.</p>
                                    </div>
                                    <div className="hidden md:flex flex-col sm:flex-row gap-3">
                                        <button onClick={() => setShowOwnerManual(true)} className="h-12 px-7 bg-white border border-neutral-200 text-black text-[10px] font-bold uppercase tracking-widest rounded-full shadow-xl shadow-black/5 hover:-translate-y-0.5 hover:border-black transition-all flex items-center justify-center gap-2">
                                            <BookOpen size={14}/> Owner Manual
                                        </button>
                                        <button onClick={saveProfileChanges} className="h-12 px-7 bg-black text-white text-[10px] font-bold uppercase tracking-widest rounded-full shadow-xl shadow-black/10 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
                                            <Check size={14}/> Save Profile
                                        </button>
                                    </div>
                                </div>
                            </header>

                            <div className="profile-mobile-hub md:hidden max-w-6xl mb-4">
                                {!activeProfileSection ? (
                                    <div className="space-y-3">
                                        {profileSections.map(section => {
                                            const IconCmp = section.icon;
                                            return (
                                                <button
                                                    key={section.id}
                                                    type="button"
                                                    onClick={() => section.action ? section.action() : setActiveProfileSection(section.id)}
                                                    className="w-full rounded-2xl border border-neutral-100 bg-white p-4 text-left shadow-[0_14px_36px_-30px_rgba(15,23,42,0.45)] flex items-center justify-between gap-4"
                                                >
                                                    <span className="flex items-center gap-3 min-w-0">
                                                        <span className="w-11 h-11 rounded-xl native-gradient-icon flex items-center justify-center shrink-0 text-black">
                                                            <IconCmp size={18} />
                                                        </span>
                                                        <span className="min-w-0">
                                                            <span className="block text-base font-bold tracking-tight text-black truncate">{section.title}</span>
                                                            <span className="block text-xs text-neutral-500 font-medium mt-0.5 truncate">{section.note}</span>
                                                        </span>
                                                    </span>
                                                    <span className="flex items-center gap-2 shrink-0">
                                                        <span className="max-w-[5.8rem] truncate rounded-full bg-neutral-50 border border-neutral-100 px-2.5 py-1 text-[8px] font-bold uppercase tracking-widest text-neutral-400">{section.meta}</span>
                                                        <ChevronRight size={17} className="text-neutral-300" />
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border border-neutral-100 bg-white p-3 shadow-[0_14px_36px_-30px_rgba(15,23,42,0.45)] flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setActiveProfileSection('')}
                                            className="w-10 h-10 rounded-xl bg-neutral-50 border border-neutral-100 flex items-center justify-center text-black shrink-0"
                                        >
                                            <ChevronLeft size={18} />
                                        </button>
                                        <div className="min-w-0">
                                            <p className="text-[8px] font-bold uppercase tracking-[0.24em] text-neutral-400">Profile Section</p>
                                            <h3 className="text-lg font-bold tracking-tight text-black truncate">{activeProfileSectionMeta?.title}</h3>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="max-w-6xl space-y-8">
                                <div className={`profile-section profile-section-account ${activeProfileSection === 'account' ? 'block' : 'hidden'} md:block overflow-hidden bg-white rounded-lg border border-neutral-100 shadow-[0_25px_80px_-60px_rgba(0,0,0,0.75)]`}>
                                    <div className="grid grid-cols-1 lg:grid-cols-12">
                                        <div className="lg:col-span-5 bg-black text-white p-6 md:p-8 flex flex-col justify-between gap-10">
                                            <div className="flex items-center gap-4">
                                                <label className="relative w-16 h-16 rounded-lg bg-white text-black flex items-center justify-center overflow-hidden font-bold text-2xl shadow-xl cursor-pointer group shrink-0">
                                                    {personalProfile.photoURL ? <img src={personalProfile.photoURL} alt="Account avatar" className="w-full h-full object-cover" /> : (personalDisplayName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || (isGuestWorkspace ? 'G' : 'A'))}
                                                    <span className="absolute inset-0 bg-black/55 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <Camera size={16} />
                                                    </span>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        className="hidden"
                                                        onChange={(event) => handlePersonalProfilePhotoUpload(event.target.files?.[0])}
                                                    />
                                                </label>
                                                <div className="min-w-0">
                                                    <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-white/35 mb-2">{isGuestWorkspace ? 'Browsing As' : 'Signed In As'}</p>
                                                    <p className="text-xl font-bold tracking-tight truncate">{personalDisplayName || (isGuestWorkspace ? 'Guest Workspace' : 'Admin User')}</p>
                                                    <p className="text-xs text-white/45 mt-1 truncate">{personalProfile.email || 'No contact email yet'}</p>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#39FF14] mb-3">{workspaceRole} access</p>
                                                <p className="text-sm leading-relaxed text-white/55">Your profile powers the business workspace, booking page identity, client communication, and staff access.</p>
                                            </div>
                                        </div>
                                        <div className="lg:col-span-7 p-5 md:p-8">
                                            <div className="mb-5 flex items-start justify-between gap-4">
                                                <div>
                                                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-300 mb-2">Personal Profile</p>
                                                    <h3 className="text-2xl font-bold tracking-tight text-black">Your account details</h3>
                                                    <p className="text-sm text-neutral-500 mt-1">Separate from business details. This is the person behind the workspace.</p>
                                                </div>
                                                <label className="hidden sm:flex h-10 px-4 rounded-full bg-neutral-50 border border-neutral-100 text-black text-[10px] font-bold uppercase tracking-widest items-center gap-2 cursor-pointer hover:border-black transition-colors shrink-0">
                                                    <Camera size={14} /> Photo
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        className="hidden"
                                                        onChange={(event) => handlePersonalProfilePhotoUpload(event.target.files?.[0])}
                                                    />
                                                </label>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <label className="rounded-lg bg-neutral-50 border border-neutral-100 p-4 focus-within:bg-white focus-within:border-black transition-colors">
                                                    <span className="text-[9px] font-bold uppercase tracking-[0.28em] text-neutral-300 mb-2 block">First Name</span>
                                                    <input
                                                        value={personalProfile.firstName || ''}
                                                        onChange={(event) => updatePersonalProfile({ firstName: event.target.value })}
                                                        className="w-full bg-transparent outline-none text-sm font-bold text-black"
                                                        placeholder="First name"
                                                    />
                                                </label>
                                                <label className="rounded-lg bg-neutral-50 border border-neutral-100 p-4 focus-within:bg-white focus-within:border-black transition-colors">
                                                    <span className="text-[9px] font-bold uppercase tracking-[0.28em] text-neutral-300 mb-2 block">Surname</span>
                                                    <input
                                                        value={personalProfile.lastName || ''}
                                                        onChange={(event) => updatePersonalProfile({ lastName: event.target.value })}
                                                        className="w-full bg-transparent outline-none text-sm font-bold text-black"
                                                        placeholder="Surname"
                                                    />
                                                </label>
                                                <label className="rounded-lg bg-neutral-50 border border-neutral-100 p-4 focus-within:bg-white focus-within:border-black transition-colors">
                                                    <span className="text-[9px] font-bold uppercase tracking-[0.28em] text-neutral-300 mb-2 flex items-center gap-2"><Mail size={12}/> Contact Email</span>
                                                    <input
                                                        type="email"
                                                        value={personalProfile.email || ''}
                                                        onChange={(event) => updatePersonalProfile({ email: event.target.value })}
                                                        className="w-full bg-transparent outline-none text-sm font-bold text-black"
                                                        placeholder="you@email.com"
                                                    />
                                                </label>
                                                <label className="rounded-lg bg-neutral-50 border border-neutral-100 p-4 focus-within:bg-white focus-within:border-black transition-colors">
                                                    <span className="text-[9px] font-bold uppercase tracking-[0.28em] text-neutral-300 mb-2 flex items-center gap-2"><Phone size={12}/> Mobile Number</span>
                                                    <input
                                                        type="tel"
                                                        value={personalProfile.mobile || ''}
                                                        onChange={(event) => updatePersonalProfile({ mobile: event.target.value })}
                                                        className="w-full bg-transparent outline-none text-sm font-bold text-black"
                                                        placeholder="+27 ..."
                                                    />
                                                </label>
                                                <div className="rounded-lg bg-white border border-neutral-100 p-4">
                                                    <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-neutral-300 mb-2">Account ID</p>
                                                    <p className="text-sm font-bold text-black break-all">{user?.uid || (isGuestWorkspace ? 'LOCAL-GUEST' : 'BUILD-BOOKING-001')}</p>
                                                </div>
                                                <div className="rounded-lg bg-white border border-neutral-100 p-4">
                                                    <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-neutral-300 mb-2">Workspace Role</p>
                                                    <p className="text-sm font-bold text-black capitalize">{workspaceRole}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className={`profile-section profile-section-account ${activeProfileSection === 'account' ? 'grid' : 'hidden'} md:grid grid-cols-1 lg:grid-cols-12 gap-5`}>
                                    <section className="lg:col-span-7 bg-white rounded-lg border border-neutral-100 p-5 md:p-7 shadow-[0_22px_70px_-60px_rgba(15,23,42,0.5)]">
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
                                            <div className="flex items-start gap-4">
                                                <div className="w-12 h-12 rounded-lg bg-neutral-50 border border-neutral-100 flex items-center justify-center text-black shrink-0">
                                                    <ShieldCheck size={18} />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-neutral-300 mb-2">Device Session</p>
                                                    <h3 className="text-xl md:text-2xl font-bold tracking-tight text-black">Keep me logged in</h3>
                                                    <p className="text-sm text-neutral-500 leading-relaxed mt-2 max-w-xl">Use this on trusted devices so Google and email sign-in return cleanly to the workspace you were using.</p>
                                                </div>
                                            </div>
                                            <label className="inline-flex items-center gap-3 rounded-full bg-neutral-50 border border-neutral-100 p-1.5 cursor-pointer shrink-0">
                                                <input
                                                    type="checkbox"
                                                    checked={keepLoggedIn}
                                                    onChange={(event) => setKeepLoggedIn(event.target.checked)}
                                                    className="sr-only"
                                                />
                                                <span className={`relative h-10 w-16 rounded-full transition-colors ${keepLoggedIn ? 'bg-black' : 'bg-neutral-200'}`}>
                                                    <span className={`absolute top-1 h-8 w-8 rounded-full bg-white shadow-lg transition-transform ${keepLoggedIn ? 'translate-x-7' : 'translate-x-1'}`} />
                                                </span>
                                                <span className="pr-4 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                                                    {keepLoggedIn ? 'On' : 'Off'}
                                                </span>
                                            </label>
                                        </div>
                                    </section>

                                    <section className="lg:col-span-5 bg-white rounded-lg border border-neutral-100 p-5 md:p-7 shadow-[0_22px_70px_-60px_rgba(15,23,42,0.5)]">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-neutral-300 mb-3">Account Control</p>
                                        <h3 className="text-xl md:text-2xl font-bold tracking-tight text-black">{isGuestWorkspace ? 'Exit guest mode' : 'Sign out safely'}</h3>
                                        <p className="text-sm text-neutral-500 leading-relaxed mt-2 mb-5">{isGuestWorkspace ? 'Close the local guest workspace and return to the public home screen.' : 'End this session and return to the home screen without leaving stale login redirects behind.'}</p>
                                        <button
                                            type="button"
                                            onClick={handleSignOut}
                                            disabled={authBusy}
                                            className="w-full h-12 rounded-full bg-black text-white text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-wait"
                                        >
                                            <X size={14}/> {isGuestWorkspace ? 'Exit Guest' : 'Sign Out'}
                                        </button>
                                    </section>
                                </div>

                                <section className={`profile-section profile-section-billing ${activeProfileSection === 'billing' ? 'block' : 'hidden'} md:block bg-white rounded-lg border border-neutral-100 p-5 md:p-7 shadow-[0_22px_70px_-60px_rgba(15,23,42,0.5)]`}>
                                    <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-lg bg-neutral-50 border border-neutral-100 flex items-center justify-center text-black shrink-0">
                                                <Briefcase size={18} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-neutral-300 mb-2">Plan & Billing</p>
                                                <h3 className="text-xl md:text-2xl font-bold tracking-tight text-black">Ready for paid plans</h3>
                                                <p className="text-sm text-neutral-500 leading-relaxed mt-2 max-w-2xl">Stripe checkout and billing portal actions are scaffolded for this workspace. When your price IDs and secret key are connected, these buttons become the upgrade and account management path.</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                                            <button type="button" onClick={() => openBillingAction('checkout')} className="h-12 px-6 rounded-full bg-[#39FF14] text-black text-[10px] font-bold uppercase tracking-widest hover:scale-[1.02] transition-transform">
                                                Upgrade Plan
                                            </button>
                                            <button type="button" onClick={() => openBillingAction('portal')} className="h-12 px-6 rounded-full bg-white border border-neutral-200 text-black text-[10px] font-bold uppercase tracking-widest hover:border-black transition-colors">
                                                Manage Billing
                                            </button>
                                        </div>
                                    </div>
                                </section>

                                <div data-tour="profile-business-info" className={`profile-section profile-section-business ${activeProfileSection === 'business' ? 'block' : 'hidden'} md:block bg-white p-5 sm:p-6 md:p-10 rounded-lg border border-neutral-100 shadow-[0_25px_80px_-65px_rgba(0,0,0,0.75)]`}>
                                    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-8">
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-[0.45em] text-neutral-300 mb-3">Business Profile</p>
                                            <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-black">Brand Details</h3>
                                        </div>
                                        <p className="text-sm text-neutral-400 max-w-md">These details sync into the booking page, client touchpoints, and the editor defaults.</p>
                                    </div>
                                    <div className="space-y-10">
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-[0.5em] opacity-40 mb-4 block text-black">Brand Logo</label>
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8">
                                                <div className="w-28 h-28 rounded-lg bg-neutral-50 border border-neutral-100 flex items-center justify-center overflow-hidden shadow-inner shrink-0">
                                                    {settings.logo ? <img src={settings.logo} className="w-full h-full object-contain" /> : <div className="font-bold text-4xl text-neutral-300">{settings.brandName?.charAt(0) || 'B'}</div>}
                                                </div>
                                                <div>
                                                    <label className="inline-flex px-6 py-3 bg-black text-white text-[10px] font-bold uppercase tracking-widest rounded-full cursor-pointer hover:bg-neutral-800 transition-colors mb-3">
                                                        Upload Logo
                                                        <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                                                            const file = e.target.files[0];
                                                            handleSettingImageUpload('logo', file, 'brand');
                                                            e.target.value = '';
                                                        }}/>
                                                    </label>
                                                    <p className="text-xs text-neutral-400 font-medium">Recommended: 400x400px (JPG/PNG)</p>
                                                    {settings.logo && <button onClick={() => handleSettingChange('logo', '')} className="text-[10px] font-bold text-red-500 uppercase tracking-widest hover:underline mt-2">Remove Image</button>}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-6 border-t border-neutral-50">
                                            <label className="text-[10px] font-bold uppercase tracking-[0.5em] opacity-40 mb-4 block text-black">Booking Page Banner</label>
                                            <div className="rounded-lg bg-neutral-50 border border-neutral-100 p-4 md:p-5">
                                                <div className="w-full aspect-[16/7] rounded-lg bg-white border border-neutral-100 flex items-center justify-center overflow-hidden shadow-inner mb-5">
                                                    {settings.bannerImage ? <img src={settings.bannerImage} className="w-full h-full object-cover" /> : (
                                                        <div className="text-center px-4">
                                                            <Monitor size={24} className="mx-auto text-neutral-300" />
                                                            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-300 mt-2">Optional landscape banner</p>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                    <div>
                                                        <p className="text-sm font-bold text-black">Shown above the booking page heading</p>
                                                        <p className="text-xs text-neutral-400 font-medium">Recommended: wide landscape image (JPG/PNG)</p>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        <label className="inline-flex px-5 py-3 bg-black text-white text-[10px] font-bold uppercase tracking-widest rounded-full cursor-pointer hover:bg-neutral-800 transition-colors">
                                                            Upload Banner
                                                            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                                                                const file = e.target.files[0];
                                                                handleSettingImageUpload('bannerImage', file, 'brand');
                                                                e.target.value = '';
                                                            }}/>
                                                        </label>
                                                        {settings.bannerImage && <button onClick={() => handleSettingChange('bannerImage', '')} className="px-5 py-3 text-[10px] font-bold text-red-500 uppercase tracking-widest hover:underline">Remove</button>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-neutral-50">
                                            <div>
                                                <label className="text-[10px] font-bold uppercase tracking-[0.5em] opacity-40 mb-3 block text-black">Business Name</label>
                                                <input type="text" value={settings.brandName || ''} onChange={e => handleSettingChange('brandName', e.target.value)} className="w-full bg-neutral-50 border border-transparent focus:border-neutral-200 rounded-lg px-6 py-4 text-sm font-bold outline-none text-black transition-all" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold uppercase tracking-[0.5em] opacity-40 mb-3 block text-black">Address / Location</label>
                                                <input type="text" value={settings.address || ''} onChange={e => handleSettingChange('address', e.target.value)} className="w-full bg-neutral-50 border border-transparent focus:border-neutral-200 rounded-lg px-6 py-4 text-sm font-bold outline-none text-black transition-all" placeholder="123 Main St, City" />
                                            </div>
                                        </div>

                                        <div className="pt-6 border-t border-neutral-50">
                                            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
                                                <div>
                                                    <label className="text-[10px] font-bold uppercase tracking-[0.5em] opacity-40 block text-black">Social Links</label>
                                                    <p className="text-xs text-neutral-400 font-medium mt-2">Used for your public booking page footer when enabled.</p>
                                                </div>
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 bg-neutral-50 border border-neutral-100 px-3 py-2 rounded-lg">Client facing</span>
                                            </div>
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                <div className="flex items-center gap-4 bg-neutral-50 p-3 rounded-lg border border-transparent focus-within:border-neutral-200 hover:border-neutral-100 transition-all">
                                                    <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-sm text-black shrink-0"><Instagram size={16} /></div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-300 mb-1">Instagram</p>
                                                        <input type="text" value={settings.socials?.instagram || ''} onChange={e => handleSettingChange('socials', {...settings.socials, instagram: e.target.value})} placeholder="@yourhandle" className="w-full bg-transparent text-sm font-bold outline-none placeholder-neutral-300" />
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4 bg-neutral-50 p-3 rounded-lg border border-transparent focus-within:border-neutral-200 hover:border-neutral-100 transition-all">
                                                    <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-sm text-black shrink-0"><Zap size={16} /></div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-300 mb-1">TikTok</p>
                                                        <input type="text" value={settings.socials?.tiktok || ''} onChange={e => handleSettingChange('socials', {...settings.socials, tiktok: e.target.value})} placeholder="@yourtiktok" className="w-full bg-transparent text-sm font-bold outline-none placeholder-neutral-300" />
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4 bg-neutral-50 p-3 rounded-lg border border-transparent focus-within:border-neutral-200 hover:border-neutral-100 transition-all">
                                                    <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-sm text-black shrink-0"><Users size={16} /></div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-300 mb-1">Facebook</p>
                                                        <input type="text" value={settings.socials?.facebook || ''} onChange={e => handleSettingChange('socials', {...settings.socials, facebook: e.target.value})} placeholder="facebook page or handle" className="w-full bg-transparent text-sm font-bold outline-none placeholder-neutral-300" />
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4 bg-neutral-50 p-3 rounded-lg border border-transparent focus-within:border-neutral-200 hover:border-neutral-100 transition-all">
                                                    <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-sm text-black shrink-0"><Globe size={16} /></div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-300 mb-1">Website</p>
                                                        <input type="text" value={settings.socials?.website || ''} onChange={e => handleSettingChange('socials', {...settings.socials, website: e.target.value})} placeholder="https://yourwebsite.com" className="w-full bg-transparent text-sm font-bold outline-none placeholder-neutral-300" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="overflow-hidden rounded-lg bg-black text-white border border-black shadow-[0_30px_90px_-55px_rgba(0,0,0,0.9)]">
                                            <div className="grid grid-cols-1 lg:grid-cols-12">
                                                <div className="lg:col-span-7 p-6 md:p-8">
                                                    <div className="w-11 h-11 rounded-lg bg-[#39FF14] text-black flex items-center justify-center mb-8 shadow-xl shadow-[#39FF14]/20">
                                                        <Share2 size={18} />
                                                    </div>
                                                    <p className="text-[10px] font-bold uppercase tracking-[0.38em] text-white/40 mb-3">Affiliate Link</p>
                                                    <h3 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">Share Build A Booking</h3>
                                                    <p className="text-sm text-white/55 leading-relaxed max-w-xl">Your referral link sits below your social settings so it is easy to find when you recommend the platform.</p>
                                                </div>
                                                <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-white/10 p-5 md:p-8 flex flex-col justify-end gap-4">
                                                    <div className="rounded-lg bg-white/10 border border-white/10 p-4">
                                                        <p className="text-[9px] font-bold uppercase tracking-widest text-white/35 mb-2">Your Link</p>
                                                        <p className="text-sm font-bold text-white truncate">{referralUrl}</p>
                                                    </div>
                                                    <button onClick={() => copyToClipboard(referralUrl, 'Affiliate link')} className="h-12 rounded-lg bg-[#39FF14] text-black text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:brightness-95 transition-all">
                                                        <Share2 size={15}/> Copy Link
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex justify-end pt-8 border-t border-neutral-50">
                                            <button onClick={saveProfileChanges} className="px-8 py-3 bg-[#39FF14] text-black text-[10px] font-bold uppercase tracking-widest rounded-full shadow-lg hover:scale-105 transition-transform flex items-center gap-2">
                                                <Check size={14}/> Save Profile
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'business' && (
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10 lg:p-12 relative bg-[#FBFBFB]">
                            <header className="dashboard-page-header mb-4 md:mb-6">
                                <h2 className="text-4xl md:text-4xl font-bold tracking-tight text-black">Schedule</h2>
                                <p className="text-neutral-500 text-sm md:text-base mt-2 max-w-2xl">Open days, tune staff calendars, and keep booking capacity clear.</p>
                            </header>
                            <Suspense fallback={<LazySectionFallback label="Loading schedule" />}>
                                <BusinessCalendar
                                    settings={settings}
                                    setSettings={setSettings}
                                    onSave={saveSettings}
                                    showToast={showToast}
                                    bookings={visibleBookings}
                                    clientDirectory={clientDirectory}
                                    staffList={displayStaffList}
                                    activeStaffId={activeStaffProfile?.id || 'owner'}
                                    workspaceRole={workspaceRole}
                                    googleCalendarState={{
                                        connected: Boolean(googleCalendarAuth.accessToken),
                                        email: googleCalendarAuth.email || settings.googleCalendar?.connectedEmail || '',
                                        connectedAt: googleCalendarAuth.connectedAt || settings.googleCalendar?.connectedAt || 0,
                                        lastSyncedAt: settings.googleCalendar?.lastSyncedAt || 0,
                                        lastSyncCount: settings.googleCalendar?.lastSyncCount || 0,
                                        syncing: googleCalendarSyncing
                                    }}
                                    onConnectGoogleCalendar={connectGoogleCalendar}
                                    onSyncGoogleCalendar={syncGoogleCalendarBookings}
                                />
                            </Suspense>
                        </div>
                    )}

                    {activeTab === 'communications' && (
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10 lg:p-12 relative bg-[#F6F7F9]">
                            <header className="dashboard-page-header mb-4 md:mb-6 max-w-7xl">
                                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                                  <div className="max-w-4xl">
                                    <h2 className="text-4xl md:text-4xl font-bold tracking-tight text-black">Support Inbox</h2>
                                    <p className="mt-2 text-sm md:text-base text-neutral-500 font-medium max-w-3xl">Chat with your clients, manage their bookings, and keep every request, reschedule, and update in one clean workspace.</p>
                                  </div>
                                  <div className="hidden xl:flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
                                    <span className="w-2.5 h-2.5 rounded-full native-gradient-button shadow-[0_0_18px_rgba(120,110,255,0.28)]" />
                                    <div>
                                      <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-neutral-400">Live Desk</p>
                                      <p className="text-sm font-bold text-black">Ready for client replies</p>
                                    </div>
                                  </div>
                                </div>
                            </header>

                            <div className="max-w-7xl">
                                <Suspense fallback={<LazySectionFallback label="Loading client inbox" />}>
                                    <WorkspaceInbox
                                        appId={appId}
                                        db={db}
                                        user={user}
                                        workspaceOwnerId={workspaceOwnerId}
                                        bookings={visibleBookings}
                                        clientDirectory={clientDirectory}
                                        staffList={displayStaffList}
                                        updateBooking={updateBooking}
                                        setActiveTab={setActiveTab}
                                        focusTarget={supportThreadFocus}
                                        showToast={showToast}
                                    />
                                </Suspense>
                            </div>
                        </div>
                    )}

                    {activeTab === 'clients' && (
                        <div className="flex-1 overflow-y-auto bg-[#F6F7F9] p-4 sm:p-6 md:p-10 lg:p-12">
                            <header className="dashboard-page-header mb-4 md:mb-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-4xl md:text-4xl font-bold tracking-tight text-black">My Clients</h2>
                                    <p className="text-neutral-500 text-sm md:text-base mt-2 max-w-2xl">Profiles are built from bookings automatically, with space for notes, labels, photos, and manual walk-ins.</p>
                                </div>
                                <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
                                    <button
                                        type="button"
                                        onClick={() => { setSelectedClientId(null); setClientMobileView('add'); }}
                                        className="h-10 md:h-11 px-4 md:px-5 rounded-lg bg-white border border-neutral-200 text-black text-[10px] md:text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:border-black transition-colors shadow-xl shadow-black/5"
                                    >
                                        <Plus size={15}/> Client
                                    </button>
                                    <button onClick={() => { saveClients(clientRecords); showToast("Client book saved"); }} className="h-10 md:h-11 px-4 md:px-5 rounded-lg bg-black text-white text-[10px] md:text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors shadow-xl shadow-black/10">
                                        <Check size={15}/> Save
                                    </button>
                                </div>
                            </header>

                            <div className="booking-desk-command rounded-lg border border-neutral-200 bg-white p-3 md:p-4 mb-4 md:mb-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-lg bg-black text-white flex items-center justify-center shrink-0"><Users size={17}/></div>
                                    <div className="min-w-0">
                                        <h3 className="text-lg md:text-xl font-bold tracking-tight text-black">Client Desk</h3>
                                        <p className="text-xs md:text-sm text-neutral-500 truncate">
                                            {clientMetrics.total ? `${clientMetrics.total} profiles, ${clientMetrics.regulars} regulars, ${clientMetrics.firstTimers} first timers.` : 'Ready for the first real client profile.'}
                                        </p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 lg:min-w-[360px]">
                                    {[
                                        { label: 'Profiles', value: clientMetrics.total },
                                        { label: 'Regulars', value: clientMetrics.regulars },
                                        { label: 'Enriched', value: clientMetrics.enriched }
                                    ].map(metric => (
                                        <div key={metric.label} className="rounded-lg bg-neutral-50 border border-neutral-100 px-3 py-2">
                                            <p className="text-[8px] font-bold uppercase tracking-widest text-neutral-400">{metric.label}</p>
                                            <p className="metric-value text-lg font-bold text-black leading-none mt-1">{metric.value}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                                <section className={`${activeClient ? 'xl:col-span-5' : 'xl:col-span-12'} space-y-4 md:space-y-6 ${clientMobileView === 'directory' || clientMobileView === 'add' ? '' : 'hidden md:block'}`}>
                                    <div data-tour="clients-directory" className={`saas-card overflow-hidden ${clientMobileView === 'add' ? 'hidden md:block' : ''}`}>
                                        <div className="p-4 md:p-6 border-b border-neutral-100">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
                                                <div>
                                                    <h3 className="text-lg font-bold tracking-tight text-black">Client Directory</h3>
                                                    <p className="text-sm text-neutral-500">
                                                        {showClientExample
                                                            ? '0 real profiles. Example shown for layout only.'
                                                            : `${filteredClients.length} shown from ${clientDirectory.length} profiles.`}
                                                    </p>
                                                </div>
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-md">Auto Synced</span>
                                            </div>
                                            <div className="relative">
                                                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-300" />
                                                <input
                                                    value={clientSearch}
                                                    onChange={(event) => setClientSearch(event.target.value)}
                                                    placeholder="Search name, phone, label"
                                                    className="w-full h-10 md:h-12 bg-neutral-50 border border-neutral-100 rounded-lg pl-11 pr-4 text-sm font-bold outline-none text-black focus:bg-white focus:border-black transition-colors"
                                                />
                                            </div>
                                            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                {clientDeskFilters.map(filter => (
                                                    <button
                                                        key={filter.id}
                                                        type="button"
                                                        onClick={() => setClientDeskFilter(filter.id)}
                                                        className={`h-10 rounded-lg border text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${clientDeskFilter === filter.id ? 'bg-black text-white border-black shadow-lg shadow-black/10' : 'bg-white border-neutral-200 text-neutral-500 hover:text-black hover:border-black'}`}
                                                    >
                                                        {filter.label} <span className={`rounded-full px-2 py-0.5 ${clientDeskFilter === filter.id ? 'bg-white/15 text-white' : 'bg-neutral-100 text-neutral-500'}`}>{filter.count}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="max-h-[58vh] md:max-h-[640px] overflow-y-auto divide-y divide-neutral-100">
                                            {displayClients.length === 0 ? (
                                                <div className="p-12 text-center">
                                                    <div className="w-14 h-14 rounded-lg bg-neutral-100 flex items-center justify-center mx-auto mb-5 text-neutral-400"><Users size={22}/></div>
                                                    <h3 className="text-lg font-bold tracking-tight text-black mb-2">No clients found</h3>
                                                    <p className="text-sm text-neutral-500">Try another search or add someone manually.</p>
                                                </div>
                                            ) : displayClients.map(client => {
                                                const allLabels = Array.from(new Set([...(client.autoLabels || []), ...(client.labels || [])])).slice(0, 3);
                                                const isActive = activeClient?.id === client.id;
                                                const openClientFile = () => {
                                                    setSelectedClientId(client.id);
                                                    setClientMobileView('profile');
                                                };
                                                return (
                                                    <button
                                                        key={client.id}
                                                        onClick={openClientFile}
                                                        className={`w-full text-left p-3 md:p-5 transition-all ${isActive ? 'bg-black text-white' : 'hover:bg-neutral-50 text-black'}`}
                                                    >
                                                        <div className="flex items-start gap-3 md:gap-4">
                                                            <div className={`w-11 h-11 md:w-14 md:h-14 rounded-lg overflow-hidden flex items-center justify-center font-bold text-base md:text-xl shrink-0 ${isActive ? 'bg-white text-black' : 'bg-neutral-100 text-black'}`}>
                                                                {client.avatar ? <img src={client.avatar} className="w-full h-full object-cover" /> : (client.name || '?').charAt(0)}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-start justify-between gap-3 mb-1">
                                                                    <h4 className="text-base md:text-lg font-bold tracking-tight truncate">{client.name}</h4>
                                                                    <span className={`metric-value text-sm font-bold shrink-0 ${isActive ? 'text-[#39FF14]' : 'text-black'}`}>{client.isExample ? 'Example' : client.bookingCount}</span>
                                                                </div>
                                                                <p className={`text-xs md:text-sm truncate mb-2 md:mb-3 ${isActive ? 'text-white/55' : 'text-neutral-500'}`}>{client.isExample ? 'Preview only - not saved or counted' : client.phone || client.email || 'Manual profile'}</p>
                                                                <div className="flex flex-wrap gap-1.5 md:gap-2">
                                                                    {allLabels.map(label => (
                                                                        <span key={label} className={`px-2 py-1 rounded-md text-[7px] md:text-[8px] font-bold uppercase tracking-widest ${isActive ? 'bg-white/10 text-white' : label === 'Regular' || label === 'VIP' ? 'bg-[#39FF14] text-black' : 'bg-neutral-100 text-neutral-500'}`}>{label}</span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            <span className={`h-10 px-3 rounded-lg flex items-center justify-center gap-2 text-[9px] font-bold uppercase tracking-widest shrink-0 ${isActive ? 'bg-white text-black' : 'bg-neutral-100 text-neutral-500'}`}>
                                                                <FileText size={14}/> File
                                                            </span>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <section className={`saas-panel p-4 md:p-6 ${clientMobileView === 'add' ? '' : 'hidden'}`}>
                                        <div className="flex items-start justify-between gap-4 mb-6">
                                            <div>
                                                <h3 className="text-lg font-bold tracking-tight text-black">Add Client</h3>
                                                <p className="text-sm text-neutral-500">Create a profile for walk-ins, DMs, or referrals.</p>
                                            </div>
                                            <button type="button" onClick={() => setClientMobileView('directory')} className="w-10 h-10 rounded-lg bg-black text-white flex items-center justify-center shrink-0"><X size={16}/></button>
                                        </div>
                                        <form onSubmit={handleManualClientSubmit} className="space-y-4">
                                            <div>
                                                <label className="text-[9px] font-bold uppercase tracking-[0.25em] text-neutral-400 block mb-2">Name</label>
                                                <input name="clientName" type="text" placeholder="Client name" required className="w-full h-12 bg-white border border-neutral-200 rounded-lg px-4 text-sm font-bold outline-none text-black focus:border-black transition-colors" />
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-[9px] font-bold uppercase tracking-[0.25em] text-neutral-400 block mb-2">Phone</label>
                                                    <input name="clientPhone" type="tel" placeholder="+27 82 000 0000" className="w-full h-12 bg-white border border-neutral-200 rounded-lg px-4 text-sm font-bold outline-none text-black focus:border-black transition-colors" />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-bold uppercase tracking-[0.25em] text-neutral-400 block mb-2">Birthday</label>
                                                    <input name="clientBirthday" type="text" placeholder="08/14" className="w-full h-12 bg-white border border-neutral-200 rounded-lg px-4 text-sm font-bold outline-none text-black focus:border-black transition-colors" />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-bold uppercase tracking-[0.25em] text-neutral-400 block mb-2">Email</label>
                                                <input name="clientEmail" type="email" placeholder="client@email.com" className="w-full h-12 bg-white border border-neutral-200 rounded-lg px-4 text-sm font-bold outline-none text-black focus:border-black transition-colors" />
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-bold uppercase tracking-[0.25em] text-neutral-400 block mb-2">Starting Label</label>
                                                <select name="clientLabel" className="w-full h-12 bg-white border border-neutral-200 rounded-lg px-4 text-sm font-bold outline-none text-black focus:border-black transition-colors">
                                                    <option value="">No manual label</option>
                                                    {clientLabelOptions.map(label => <option key={label} value={label}>{label}</option>)}
                                                </select>
                                            </div>
                                            <button type="submit" className="w-full h-12 bg-black text-white rounded-lg flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-800 transition-colors shadow-xl shadow-black/10">
                                                <Plus size={15} /> Add Client
                                            </button>
                                        </form>
                                    </section>
                                </section>

                                <section className={`${activeClient ? 'xl:col-span-7' : 'hidden'} space-y-4 md:space-y-6 ${clientMobileView === 'profile' ? '' : 'hidden md:block'}`}>
                                    {activeClient ? (() => {
                                        const allLabels = Array.from(new Set([...(activeClient.autoLabels || []), ...(activeClient.labels || [])]));
                                        const isExampleClient = Boolean(activeClient.isExample);
                                        return (
                                            <>
                                                <div className="md:hidden flex items-center justify-between gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setClientMobileView('directory')}
                                                        className="h-10 px-4 rounded-lg bg-white border border-neutral-200 text-[10px] font-bold uppercase tracking-widest text-black flex items-center gap-2"
                                                    >
                                                        <ChevronLeft size={15} /> Directory
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setClientMobileView('add')}
                                                        className="h-10 px-4 rounded-lg bg-black text-white text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"
                                                    >
                                                        <Plus size={14} /> Add
                                                    </button>
                                                </div>
                                                <div className="saas-card p-4 md:p-6 overflow-hidden relative">
                                                    <div className="absolute top-0 left-0 right-0 h-1 bg-[#39FF14]" />
                                                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5 md:gap-6 mb-5 md:mb-8">
                                                        <div className="flex items-start gap-4 md:gap-5 min-w-0">
                                                            <div className="relative shrink-0">
                                                                <div className="w-16 h-16 md:w-24 md:h-24 rounded-lg bg-black text-[#39FF14] overflow-hidden flex items-center justify-center text-2xl md:text-4xl font-bold shadow-inner">
                                                                    {activeClient.avatar ? <img src={activeClient.avatar} className="w-full h-full object-cover" /> : activeClient.name.charAt(0)}
                                                                </div>
                                                                {!isExampleClient && (
                                                                    <label className="absolute -right-2 -bottom-2 w-9 h-9 md:w-10 md:h-10 rounded-lg bg-white border border-neutral-200 shadow-xl flex items-center justify-center cursor-pointer hover:bg-neutral-50 transition-colors" title="Upload profile picture">
                                                                        <Camera size={15} />
                                                                        <input type="file" accept="image/*" className="hidden" onChange={(event) => {
                                                                            handleClientAvatarUpload(activeClient.id, event.target.files[0]);
                                                                            event.target.value = '';
                                                                        }} />
                                                                    </label>
                                                                )}
                                                            </div>
                                                            <div className="min-w-0 pt-1">
                                                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                                                    <h3 className="text-2xl md:text-4xl font-bold tracking-tight text-black truncate">{activeClient.name}</h3>
                                                                    {isExampleClient && <span className="px-2.5 py-1 rounded-md bg-black text-white text-[9px] font-bold uppercase tracking-widest">Example Only</span>}
                                                                    {activeClient.autoLabels?.includes('Regular') && <span className="px-2.5 py-1 rounded-md bg-[#39FF14] text-black text-[9px] font-bold uppercase tracking-widest">Regular</span>}
                                                                </div>
                                                                <p className="text-xs md:text-sm text-neutral-500 mb-3 md:mb-4">{isExampleClient ? 'Visual example only - not saved, synced, or counted in stats' : activeClient.bookingCount ? `${activeClient.bookingCount} booking${activeClient.bookingCount === 1 ? '' : 's'} on file` : 'Manual client profile'}</p>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {allLabels.map(label => (
                                                                        <span key={label} className={`px-3 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-widest ${label === 'Regular' || label === 'VIP' ? 'bg-[#39FF14] text-black' : label === 'No-show Risk' ? 'bg-red-50 text-red-600' : 'bg-neutral-100 text-neutral-500'}`}>{label}</span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <button onClick={() => setActiveTab('bookings')} className="h-11 px-5 rounded-lg border border-neutral-200 bg-white text-[10px] font-bold uppercase tracking-widest text-neutral-600 hover:text-black hover:bg-neutral-50 transition-colors flex items-center justify-center gap-2">
                                                            <History size={15}/> Open Bookings
                                                        </button>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                        <div className="rounded-lg bg-neutral-50 border border-neutral-100 p-4 min-w-0">
                                                            <div className="flex items-center gap-2 text-neutral-400 mb-2"><Phone size={14}/><span className="text-[9px] font-bold uppercase tracking-widest">Phone</span></div>
                                                            <p className="text-sm font-bold text-black truncate">{activeClient.phone || 'Not added'}</p>
                                                        </div>
                                                        <div className="rounded-lg bg-neutral-50 border border-neutral-100 p-4 min-w-0">
                                                            <div className="flex items-center gap-2 text-neutral-400 mb-2"><Mail size={14}/><span className="text-[9px] font-bold uppercase tracking-widest">Email</span></div>
                                                            <p className="text-sm font-bold text-black truncate">{activeClient.email || 'Not added'}</p>
                                                        </div>
                                                        <div className="rounded-lg bg-neutral-50 border border-neutral-100 p-4 min-w-0">
                                                            <div className="flex items-center gap-2 text-neutral-400 mb-2"><Calendar size={14}/><span className="text-[9px] font-bold uppercase tracking-widest">Last Visit</span></div>
                                                            <p className="text-sm font-bold text-black truncate">{isExampleClient ? 'Example only' : activeClient.lastBooking ? `${activeClient.lastBooking.date} / ${activeClient.lastBooking.time}` : 'No booking yet'}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                    <section className="saas-card p-5 md:p-6">
                                                        <div className="flex items-center justify-between mb-5">
                                                            <div>
                                                                <h3 className="text-lg font-bold tracking-tight text-black">Staff Notes</h3>
                                                                <p className="text-sm text-neutral-500">Preferences, follow-ups, and context for the next visit.</p>
                                                            </div>
                                                            <MessageSquare size={18} className="text-neutral-300" />
                                                        </div>
                                                        <textarea
                                                            value={isExampleClient ? activeClient.notes : clientNoteDraft}
                                                            onChange={(event) => setClientNoteDraft(event.target.value)}
                                                            placeholder="Example: prefers morning slots, wants app updates, allergic to latex..."
                                                            disabled={isExampleClient}
                                                            className="w-full min-h-[190px] bg-neutral-50 border border-neutral-100 rounded-lg p-4 text-sm font-medium outline-none resize-none focus:bg-white focus:border-black transition-colors disabled:text-neutral-500"
                                                        />
                                                        <button disabled={isExampleClient} onClick={() => { upsertClientRecord(activeClient.id, { notes: clientNoteDraft }); showToast("Client notes saved"); }} className="mt-4 w-full h-11 rounded-lg bg-black text-white flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                                            <Check size={15}/> {isExampleClient ? 'Example Only' : 'Save Notes'}
                                                        </button>
                                                    </section>

                                                    <section className="saas-panel p-5 md:p-6">
                                                        <div className="flex items-center justify-between mb-5">
                                                            <div>
                                                                <h3 className="text-lg font-bold tracking-tight text-black">Labels</h3>
                                                                <p className="text-sm text-neutral-500">Auto labels update from booking behavior. Staff labels stay pinned.</p>
                                                            </div>
                                                            <Tag size={18} className="text-neutral-400" />
                                                        </div>
                                                        <div className="space-y-3">
                                                            {clientLabelOptions.map(label => {
                                                                const active = activeClient.labels?.includes(label);
                                                                return (
                                                                    <button
                                                                        key={label}
                                                                        disabled={isExampleClient}
                                                                        onClick={() => toggleClientLabel(activeClient, label)}
                                                                        className={`w-full h-12 rounded-lg px-4 flex items-center justify-between gap-4 text-sm font-bold transition-colors disabled:opacity-45 disabled:cursor-not-allowed ${active ? 'bg-black text-white shadow-xl shadow-black/10' : 'bg-white border border-neutral-200 text-neutral-600 hover:text-black hover:border-black'}`}
                                                                    >
                                                                        <span>{label}</span>
                                                                        {active ? <Check size={15} className="text-[#39FF14]" /> : <Plus size={15} className="text-neutral-300" />}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </section>
                                                </div>

                                                <section className="saas-card overflow-hidden">
                                                    <div className="p-5 md:p-6 border-b border-neutral-100 flex items-center justify-between gap-4">
                                                        <div>
                                                            <h3 className="text-lg font-bold tracking-tight text-black">Booking History</h3>
                                                            <p className="text-sm text-neutral-500">Past and upcoming records linked to this client.</p>
                                                        </div>
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 bg-neutral-100 px-3 py-1.5 rounded-md">{isExampleClient ? 'Example' : `${activeClient.bookingCount} Records`}</span>
                                                    </div>
                                                    <div className="divide-y divide-neutral-100">
                                                        {activeClient.bookings.length ? activeClient.bookings.map(booking => {
                                                            const assignedStaff = staffList.find(staff => staff.id === booking.staffId);
                                                            const statusStyle = booking.status === 'confirmed'
                                                                ? 'bg-[#39FF14] text-black'
                                                                : booking.status === 'waitlist'
                                                                    ? 'bg-amber-100 text-amber-800'
                                                                    : booking.status === 'declined'
                                                                        ? 'bg-red-50 text-red-600'
                                                                        : 'bg-black text-white';
                                                            return (
                                                                <div key={booking.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-neutral-50/70 transition-colors">
                                                                    <div className="min-w-0">
                                                                        <div className="flex flex-wrap items-center gap-3 mb-1">
                                                                            <p className="metric-value text-xl font-bold text-black">{booking.time}</p>
                                                                            <span className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest ${statusStyle}`}>{booking.status === 'waitlist' ? 'Standby' : booking.status}</span>
                                                                        </div>
                                                                        <p className="text-sm text-neutral-500">{booking.date}{booking.clientBirthday ? ` / Bday: ${booking.clientBirthday}` : ''}</p>
                                                                    </div>
                                                                    <div className="flex items-center gap-3">
                                                                        {assignedStaff && <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{assignedStaff.name}</span>}
                                                                        {booking.noShowHistory && <span className="px-2.5 py-1 rounded-md bg-red-50 text-red-600 text-[9px] font-bold uppercase tracking-widest">No-show Flag</span>}
                                                                    </div>
                                                                </div>
                                                            );
                                                        }) : (
                                                            <div className="p-12 text-center">
                                                                <div className="w-14 h-14 rounded-lg bg-neutral-100 flex items-center justify-center mx-auto mb-5 text-neutral-400"><History size={22}/></div>
                                                                <h3 className="text-lg font-bold tracking-tight text-black mb-2">No booking history yet</h3>
                                                                <p className="text-sm text-neutral-500">Once this client books, their visits will collect here automatically.</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </section>
                                            </>
                                        );
                                    })() : null}
                                </section>
                            </div>
                        </div>
                    )}

                    {activeTab === 'staff' && (() => {
                        const selectedStaffFile = displayStaffList.find(staff => staff.id === selectedStaffFileId) || null;
                        const renderStaffAvatar = (staff, sizeClass = 'w-14 h-14') => {
                            const initials = (staff?.name || 'Team Member').split(' ').map(part => part.charAt(0)).join('').slice(0, 2).toUpperCase();
                            return (
                                <div className={`${sizeClass} rounded-full shadow-inner flex items-center justify-center font-bold text-white text-sm shrink-0 overflow-hidden`} style={{ backgroundColor: staff?.color || '#000000' }}>
                                    {staff?.photoURL ? <img src={staff.photoURL} alt="" className="w-full h-full object-cover" /> : initials}
                                </div>
                            );
                        };
                        const renderStaffFile = selectedStaffFile ? (() => {
                            const assignedBookings = visibleBookings.filter(b => b.staffId === selectedStaffFile.id || (selectedStaffFile.id === 'owner' && (!b.staffId || b.staffId === 'owner')));
                            const roleLabel = selectedStaffFile.role === 'admin' ? 'Admin' : selectedStaffFile.role === 'owner' || selectedStaffFile.id === 'owner' ? 'Owner' : 'Staff';
                            const statusLabel = selectedStaffFile.status === 'connected' ? 'Google account detected' : selectedStaffFile.accessEnabled === false ? 'Access disabled' : 'Access ready';
                            return { assignedBookings, roleLabel, statusLabel };
                        })() : null;

                        return (
                        <div className="flex-1 overflow-y-auto bg-[#F6F7F9] p-4 sm:p-6 md:p-10 lg:p-12">
                            <header className="dashboard-page-header mb-4 md:mb-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-4xl md:text-4xl font-bold tracking-tight text-black">Team</h2>
                                    <p className="text-neutral-500 text-sm md:text-base mt-2 max-w-2xl">Tap a teammate to open their file, or add someone new when the roster grows.</p>
                                </div>
                                <button onClick={() => { saveStaff(staffList); showToast("Team setup saved"); }} className="h-11 px-5 rounded-lg bg-black text-white text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors shadow-xl shadow-black/10 w-full sm:w-auto">
                                    <Check size={15}/> Save Team
                                </button>
                            </header>

                            <section data-tour="team-roster" className="saas-card p-4 md:p-6 overflow-hidden">
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-6">
                                    <div>
                                        <h3 className="text-xl md:text-2xl font-bold tracking-tight text-black">Team Roster</h3>
                                        <p className="text-sm text-neutral-500">Floating profiles for staff files, assignment checks, and calendar ownership.</p>
                                    </div>
                                    <span className="inline-flex w-fit text-[10px] font-bold uppercase tracking-widest text-neutral-500 bg-neutral-100 px-3 py-1.5 rounded-md">{displayStaffList.length} Active</span>
                                </div>
                                <div className="flex gap-3 md:gap-4 overflow-x-auto no-scrollbar pb-2">
                                    <button
                                        type="button"
                                        onClick={() => { setTeamPanelMode('add'); setSelectedStaffFileId(null); }}
                                        className={`min-w-[92px] md:min-w-[110px] rounded-2xl border p-3 md:p-4 flex flex-col items-center gap-3 transition-all ${teamPanelMode === 'add' ? 'bg-black text-white border-black shadow-xl shadow-black/10' : 'bg-white border-neutral-200 text-black hover:border-black'}`}
                                    >
                                        <span className={`w-14 h-14 rounded-full flex items-center justify-center ${teamPanelMode === 'add' ? 'bg-white text-black' : 'bg-neutral-100 text-black'}`}><Plus size={22}/></span>
                                        <span className="text-[9px] font-bold uppercase tracking-widest">Add</span>
                                    </button>
                                    {displayStaffList.map(staff => {
                                        const isSelected = teamPanelMode === 'file' && selectedStaffFileId === staff.id;
                                        const roleLabel = staff.role === 'admin' ? 'Admin' : staff.role === 'owner' || staff.id === 'owner' ? 'Owner' : 'Staff';
                                        return (
                                            <button
                                                key={staff.id}
                                                type="button"
                                                onClick={() => { setSelectedStaffFileId(staff.id); setTeamPanelMode('file'); }}
                                                className={`min-w-[112px] md:min-w-[132px] rounded-2xl border p-3 md:p-4 flex flex-col items-center gap-3 transition-all ${isSelected ? 'bg-black text-white border-black shadow-xl shadow-black/10' : 'bg-white border-neutral-200 text-black hover:border-black hover:shadow-lg'}`}
                                            >
                                                {renderStaffAvatar(staff)}
                                                <span className="w-full text-center">
                                                    <span className="block text-[10px] md:text-xs font-bold truncate">{staff.name}</span>
                                                    <span className={`block text-[8px] font-bold uppercase tracking-widest mt-1 ${isSelected ? 'text-white/55' : 'text-neutral-400'}`}>{roleLabel}</span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>

                            <section className="mt-6">
                                {teamPanelMode === 'add' ? (
                                    <div className="saas-panel p-5 md:p-6 max-w-2xl">
                                        <div className="flex items-start justify-between gap-4 mb-6">
                                            <div>
                                                <h3 className="text-2xl font-bold tracking-tight text-black">Add Teammate</h3>
                                                <p className="text-sm text-neutral-500">Grant workspace access by email. Existing Google accounts are detected automatically.</p>
                                            </div>
                                            <button type="button" onClick={() => setTeamPanelMode('roster')} className="w-10 h-10 rounded-lg bg-black text-white flex items-center justify-center shrink-0"><X size={16}/></button>
                                        </div>
                                        <form onSubmit={async (e) => {
                                            e.preventDefault();
                                            const name = e.target.name.value.trim();
                                            const email = e.target.email.value.trim();
                                            const color = e.target.color.value;
                                            const role = e.target.role.value;
                                            if(name && email) {
                                                await createStaffMember({ name, email, color, role });
                                                e.target.reset();
                                                setTeamPanelMode('roster');
                                            }
                                        }} className="space-y-4">
                                            {!canManageTeam && isFirebaseConfigured && (
                                                <div className="rounded-lg bg-amber-50 border border-amber-100 p-4 text-xs font-bold text-amber-800 leading-relaxed">
                                                    Your staff role can assign bookings and manage clients, but only owners/admins can grant team access.
                                                </div>
                                            )}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-[9px] font-bold uppercase tracking-[0.25em] text-neutral-400 block mb-2">Name</label>
                                                    <input name="name" type="text" placeholder="Staff member" required disabled={!canManageTeam && isFirebaseConfigured} className="w-full h-12 bg-white border border-neutral-200 rounded-lg px-4 text-sm font-bold outline-none text-black focus:border-black transition-colors disabled:opacity-50" />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-bold uppercase tracking-[0.25em] text-neutral-400 block mb-2">Email</label>
                                                    <input name="email" type="email" placeholder="ari@studio.com" required disabled={!canManageTeam && isFirebaseConfigured} className="w-full h-12 bg-white border border-neutral-200 rounded-lg px-4 text-sm font-bold outline-none text-black focus:border-black transition-colors disabled:opacity-50" />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                                                <div>
                                                    <label className="text-[9px] font-bold uppercase tracking-[0.25em] text-neutral-400 block mb-2">Access Role</label>
                                                    <select name="role" defaultValue="staff" disabled={!canManageTeam && isFirebaseConfigured} className="w-full h-12 bg-white border border-neutral-200 rounded-lg px-4 text-sm font-bold outline-none text-black focus:border-black transition-colors disabled:opacity-50">
                                                        <option value="staff">Staff - bookings and clients</option>
                                                        <option value="admin">Admin - settings and team</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-bold uppercase tracking-[0.25em] text-neutral-400 block mb-2">Color</label>
                                                    <input name="color" type="color" defaultValue="#39FF14" disabled={!canManageTeam && isFirebaseConfigured} className="w-14 h-12 rounded-lg cursor-pointer bg-transparent border-none p-0 outline-none disabled:opacity-50" />
                                                </div>
                                            </div>
                                            <button type="submit" disabled={!canManageTeam && isFirebaseConfigured} className="w-full h-12 bg-black text-white rounded-lg flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-800 transition-colors shadow-xl shadow-black/10 disabled:opacity-40 disabled:cursor-not-allowed">
                                                <Plus size={15} /> Add Member
                                            </button>
                                        </form>
                                    </div>
                                ) : teamPanelMode === 'file' && selectedStaffFile ? (
                                    <div className="saas-card p-5 md:p-6 overflow-hidden relative">
                                        <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#39FF14,#7dd3fc,#c4b5fd,#f9a8d4)]" />
                                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5 mb-6">
                                            <div className="flex items-start gap-4 min-w-0">
                                                {renderStaffAvatar(selectedStaffFile, 'w-16 h-16 md:w-20 md:h-20')}
                                                <div className="min-w-0 pt-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="text-2xl md:text-4xl font-bold tracking-tight text-black truncate">{selectedStaffFile.name}</h3>
                                                        <span className="px-2.5 py-1 rounded-md bg-neutral-100 text-neutral-500 text-[9px] font-bold uppercase tracking-widest">{renderStaffFile.roleLabel}</span>
                                                    </div>
                                                    <p className="text-sm text-neutral-500 mt-2 truncate">{selectedStaffFile.email || 'No email on file'}</p>
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mt-2">{renderStaffFile.statusLabel}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedStaffFile.id !== 'owner' && canManageTeam && (
                                                    <button onClick={() => { saveStaff(staffList.filter(s => s.id !== selectedStaffFile.id)); setSelectedStaffFileId(null); setTeamPanelMode('roster'); }} className="h-10 px-4 rounded-lg border border-red-100 bg-red-50 text-red-600 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                                                        <Trash2 size={14}/> Remove
                                                    </button>
                                                )}
                                                <button type="button" onClick={() => { setTeamPanelMode('roster'); setSelectedStaffFileId(null); }} className="h-10 px-4 rounded-lg bg-black text-white text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                                                    <X size={14}/> Close
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <div className="rounded-lg bg-neutral-50 border border-neutral-100 p-4">
                                                <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-1">Assigned Bookings</p>
                                                <p className="metric-value text-2xl font-bold text-black">{renderStaffFile.assignedBookings.length}</p>
                                            </div>
                                            <div className="rounded-lg bg-neutral-50 border border-neutral-100 p-4">
                                                <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-1">Calendar</p>
                                                <p className="text-sm font-bold text-black">{selectedStaffFile.id === activeStaffProfile?.id ? 'Your default view' : 'View profile'}</p>
                                            </div>
                                            <div className="rounded-lg bg-neutral-50 border border-neutral-100 p-4">
                                                <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-1">Access</p>
                                                <p className="text-sm font-bold text-black">{selectedStaffFile.accessEnabled === false ? 'Off' : 'On'}</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="saas-card p-8 md:p-10 text-center">
                                        <div className="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4 text-neutral-400"><Users size={22}/></div>
                                        <h3 className="text-xl font-bold tracking-tight text-black">Choose a teammate</h3>
                                        <p className="text-sm text-neutral-500 mt-2">Open a staff file from the row above, or tap the plus icon to invite someone.</p>
                                    </div>
                                )}
                            </section>
                        </div>
                    ); })()}

                    {activeTab === 'editor' && (
                    <div className={`flex-1 flex overflow-hidden mobile-editor-shell bg-[#F5F5F7] ${isPortraitMobileRuntime ? 'mobile-editor-portrait-runtime' : ''} ${editorCollapsed ? 'mobile-editor-panel-is-collapsed' : ''} ${mobileNavCollapsed ? 'mobile-editor-nav-is-collapsed' : ''}`}>
                        <div className={`mobile-editor-panel transition-all duration-700 ease-in-out bg-white border-r border-neutral-100 flex flex-col shadow-2xl relative z-40 overflow-hidden ${editorCollapsed ? 'mobile-editor-panel-collapsed w-0 opacity-0 pointer-events-none' : 'w-full md:w-[600px] lg:w-[700px]'}`}>
                        {!editorCollapsed && (
                            <>
                            <header className="editor-panel-header p-5 sm:p-6 md:p-10 border-b border-neutral-50 flex flex-col lg:flex-row items-start lg:items-center justify-between flex-shrink-0 gap-4 md:gap-6">
                                <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-black">Editor</h2>
                                <div className="editor-tab-rail flex bg-neutral-100 p-1.5 rounded-full overflow-x-auto w-full lg:w-auto no-scrollbar">
                                {['identity', 'themes', 'visuals', 'features', 'copy'].map(tab => (
                                    <button key={tab} onClick={() => setEditorTab(tab)} className={`editor-tab-button flex-1 lg:flex-none px-5 py-2 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${editorTab === tab ? 'bg-white text-black shadow-sm' : 'text-neutral-400 hover:text-black'}`}>{tab}</button>
                                ))}
                                </div>
                            </header>

                            <div ref={editorContentRef} className="editor-panel-scroll flex-1 overflow-y-auto p-5 sm:p-6 md:p-12 space-y-8 md:space-y-12 no-scrollbar">
                                <div className="mobile-editor-portrait-guides md:hidden space-y-3">
                                    <div className="mobile-editor-rotate-prompt rounded-lg border border-black/10 bg-black text-white p-4 shadow-2xl items-start gap-3">
                                        <RefreshCw size={18} className="text-[#39FF14] shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-widest mb-1">Rotate For Editor</p>
                                            <p className="text-xs text-white/65 leading-relaxed">Turn your phone sideways for the live preview workspace. You can still edit settings here in portrait.</p>
                                        </div>
                                    </div>
                                </div>
                                {editorTab === 'identity' && (
                                <div className="space-y-10 animate-in fade-in duration-700">
                                    <div className="space-y-5">
                                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-[0.5em] text-neutral-300 block">Booking Page Media</label>
                                            <p className="text-xs text-neutral-400 font-medium mt-2">Upload the images clients see first on your booking page.</p>
                                        </div>
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 bg-neutral-50 border border-neutral-100 px-3 py-2 rounded-lg">Shared Assets</span>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="bg-neutral-50 rounded-lg border border-neutral-100/70 p-4 md:p-5">
                                            <div className="grid grid-cols-1 xl:grid-cols-[220px_minmax(0,1fr)] gap-5 items-start">
                                                <div className="rounded-lg bg-white border border-neutral-100 p-4 shadow-inner">
                                                    <div className="w-full aspect-square rounded-lg bg-neutral-50 border border-neutral-100 flex items-center justify-center overflow-hidden mb-4">
                                                        {settings.logo ? <img src={settings.logo} className="w-full h-full object-contain" /> : <User size={22} className="text-neutral-300" />}
                                                    </div>
                                                    <p className="text-sm font-bold text-black">Business Logo</p>
                                                    <p className="text-xs text-neutral-400 leading-relaxed mt-1">Shared with Business Profile.</p>
                                                    <div className="flex flex-wrap gap-2 mt-4">
                                                        <label className="h-10 px-4 rounded-lg bg-black text-white text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2">
                                                            <Camera size={14}/> Upload
                                                            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                                                                const file = e.target.files[0];
                                                                handleSettingImageUpload('logo', file, 'brand');
                                                                e.target.value = '';
                                                            }}/>
                                                        </label>
                                                        {settings.logo && <button onClick={() => handleSettingChange('logo', '')} className="h-10 px-4 rounded-lg bg-white border border-neutral-200 text-red-500 text-[10px] font-bold uppercase tracking-widest hover:bg-red-50 transition-colors">Remove</button>}
                                                    </div>
                                                </div>
                                                <LogoDisplayControls settings={settings} onChange={handleLogoDisplayChange} className="xl:pl-5 xl:border-l border-neutral-100" />
                                            </div>
                                        </div>

                                        <div className="bg-neutral-50 rounded-lg border border-neutral-100/70 p-4 md:p-5">
                                            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_220px] gap-5 items-center">
                                                <div className="w-full aspect-[16/6] min-h-[150px] rounded-lg bg-white border border-neutral-100 shadow-inner flex items-center justify-center overflow-hidden">
                                                    {settings.bannerImage ? <img src={settings.bannerImage} className="w-full h-full object-cover" /> : (
                                                        <div className="text-center px-4">
                                                            <Monitor size={24} className="mx-auto text-neutral-300" />
                                                            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-300 mt-2">Optional Banner</p>
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-black">Landscape Banner</p>
                                                    <p className="text-xs text-neutral-400 leading-relaxed mt-1">Shown above the booking page heading. Wide images work best.</p>
                                                    <div className="flex flex-wrap gap-2 mt-4">
                                                        <label className="h-10 px-4 rounded-lg bg-black text-white text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2">
                                                            <Camera size={14}/> Upload
                                                            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                                                                const file = e.target.files[0];
                                                                handleSettingImageUpload('bannerImage', file, 'brand');
                                                                e.target.value = '';
                                                            }}/>
                                                        </label>
                                                        {settings.bannerImage && <button onClick={() => handleSettingChange('bannerImage', '')} className="h-10 px-4 rounded-lg bg-white border border-neutral-200 text-red-500 text-[10px] font-bold uppercase tracking-widest hover:bg-red-50 transition-colors">Remove</button>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    </div>
                                    <div className="space-y-5">
                                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-[0.5em] text-neutral-300 block">Business Text</label>
                                            <p className="text-xs text-neutral-400 font-medium mt-2">Fine tune the booking page title, tagline, and intro copy. Position follows the logo setting above.</p>
                                        </div>
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 bg-neutral-50 border border-neutral-100 px-3 py-2 rounded-lg">Size And Fonts</span>
                                    </div>
                                    {identityTextControls.map(config => (
                                        <IdentityTextControl
                                            key={config.id}
                                            settings={settings}
                                            config={config}
                                            onChange={handleSettingChange}
                                        />
                                    ))}
                                    </div>
                                    <div className="space-y-5 pt-10 border-t border-neutral-50">
                                    <label className="text-[10px] font-bold uppercase tracking-[0.5em] text-neutral-300 block">Booking Link</label>
                                    <div className="flex flex-col sm:flex-row sm:items-center bg-neutral-50 rounded-lg px-5 md:px-8 py-4 md:py-6 border border-neutral-100/50 shadow-inner">
                                        <span className="text-neutral-300 font-bold uppercase tracking-widest text-[10px] md:text-xs">{window.location.origin}/book/</span>
                                        <input type="text" value={settings.slug} onChange={(e) => handleSettingChange('slug', e.target.value)} className="flex-1 bg-transparent border-none font-bold text-black outline-none ml-0 sm:ml-2 mt-1 sm:mt-0 text-sm" />
                                    </div>
                                    <button onClick={() => copyToClipboard(bookingPageUrl, 'Booking page link')} className="w-full h-11 rounded-lg bg-black text-white text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors">
                                        <Share2 size={14}/> Copy Booking Link
                                    </button>
                                    </div>
                                </div>
                                )}

                                {editorTab === 'themes' && (
                                <div className="space-y-12 animate-in fade-in duration-700">
                                    <div data-tour="editor-theme-library">
                                        <div className="flex items-center justify-between gap-4 mb-6">
                                            <label className="text-[10px] font-bold uppercase tracking-[0.5em] text-neutral-300 block">{isMobileWebEditorRuntime ? 'Mobile Theme Starter' : 'Industry Theme Engine'}</label>
                                        </div>
                                        {isMobileWebEditorRuntime && (
                                            <div className="mobile-editor-starter-note mb-4 rounded-[20px] border border-neutral-100 bg-white p-3 shadow-[0_18px_48px_rgba(15,23,42,0.055)] overflow-hidden relative">
                                                <div className="absolute inset-x-0 top-0 h-0.5 opacity-80" style={{ backgroundImage: 'var(--native-accent-gradient)', backgroundSize: '420% 420%', backgroundPosition: 'var(--native-accent-x) 50%' }} />
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center shrink-0">
                                                        <Monitor size={17} />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                                            <p className="text-[8px] font-bold uppercase tracking-[0.28em] text-neutral-400">Mobile Web Editor</p>
                                                        </div>
                                                        <h3 className="text-lg font-black tracking-[-0.04em] leading-tight text-black">Fast starter mode.</h3>
                                                        <p className="text-xs text-neutral-500 font-medium leading-relaxed mt-1">
                                                            Choose a starter here, then tune colors, fonts, buttons, and spacing in Visuals. Full engine is best on PC or the mobile app.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {!isMobileWebEditorRuntime && (
                                        <div className="theme-brief-panel mb-7 rounded-[28px] border border-neutral-100 bg-white p-4 sm:p-5 shadow-[0_24px_70px_rgba(15,23,42,0.06)]">
                                            <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5 mb-5">
                                                <div className="min-w-0">
                                                    <p className="text-[9px] font-bold uppercase tracking-[0.45em] text-neutral-300 mb-3">Theme Brief</p>
                                                    <h3 className="text-2xl sm:text-3xl font-black tracking-[-0.04em] leading-none text-black">
                                                        {!selectedIndustryFilter ? (
                                                            <>
                                                                Choose your <span className="native-accent-text">industry first</span>.
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span className="native-accent-text">{selectedIndustryName}</span> themes shaped for your business.
                                                            </>
                                                        )}
                                                        <span className="block mt-2 text-lg sm:text-xl leading-snug tracking-[-0.03em] text-neutral-500">{themeBriefSupportText}</span>
                                                    </h3>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handleAutoDetectThemePalette}
                                                    disabled={paletteDetecting}
                                                    className="h-11 px-4 rounded-full border border-neutral-100 bg-neutral-50 text-black text-[9px] font-bold uppercase tracking-widest shadow-sm hover:border-black hover:bg-white transition-all disabled:cursor-wait disabled:text-neutral-400 flex items-center justify-center gap-2 shrink-0"
                                                >
                                                    <Pipette size={14} />
                                                    {paletteDetecting ? 'Reading Brand' : detectedThemePalette ? `${themePaletteLabel(detectedThemePalette)} Detected` : 'Read Logo Colors'}
                                                </button>
                                            </div>
                                            <p className="text-xs font-semibold text-neutral-400 -mt-2 mb-5">
                                                Brand reader checks {brandSignalPhrase}, then starts the palette. Font personality now lives in Visuals.
                                            </p>

                                            <div className="mb-5">
                                                <div className="flex items-center justify-between gap-3 mb-3">
                                                    <div>
                                                        <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">1. Choose Industry</p>
                                                        <p className="text-xs font-semibold text-neutral-400 mt-1">This sets the personality, pace, fonts, and layout feel.</p>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <button type="button" onClick={() => scrollThemePaletteRail(-1)} title="Previous industries" className="w-8 h-8 rounded-full bg-white border border-neutral-100 text-neutral-400 hover:text-black hover:border-neutral-300 shadow-sm flex items-center justify-center transition-all">
                                                            <ChevronLeft size={15} />
                                                        </button>
                                                        <button type="button" onClick={() => scrollThemePaletteRail(1)} title="Next industries" className="w-8 h-8 rounded-full bg-black text-white shadow-lg flex items-center justify-center hover:scale-105 transition-all">
                                                            <ChevronRight size={15} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div ref={themePaletteRailRef} className="overflow-x-auto no-scrollbar pb-2 scroll-smooth snap-x snap-mandatory">
                                                    <div className="flex gap-3 min-w-max">
                                                        {industryFilterOptions.map(industry => {
                                                            const isActive = themeGenerationInputs.industry === industry.id;
                                                            return (
                                                                <button key={industry.id} type="button" onClick={() => setThemeFilterValue('industry', industry.id)} className={`group w-44 p-3 rounded-2xl border text-left transition-all snap-start ${isActive ? 'bg-black text-white border-black shadow-xl' : 'bg-neutral-50 text-black border-neutral-100 hover:bg-white hover:border-neutral-300 hover:-translate-y-0.5'}`}>
                                                                    <div className="flex items-center mb-4">
                                                                        {industry.swatches.map((color, i) => (
                                                                            <span key={color} className={`w-7 h-7 rounded-full border ${isActive ? 'border-white/30' : 'border-black/10'} ${i > 0 ? '-ml-2' : ''}`} style={{ backgroundColor: color }} />
                                                                        ))}
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="text-[11px] font-bold uppercase tracking-widest truncate">{industry.name}</p>
                                                                        <p className={`text-[9px] font-bold uppercase tracking-widest mt-1 truncate ${isActive ? 'text-white/45' : 'text-neutral-300'}`}>{industry.hint}</p>
                                                                    </div>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="theme-color-direction-panel rounded-[26px] border border-neutral-100 bg-neutral-50/70 p-4 sm:p-5">
                                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                                                    <div>
                                                        <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">2. Color Direction</p>
                                                        <p className="text-xs font-semibold text-neutral-400 mt-1">{selectedPaletteHint}. Each color creates light and dark-mode directions for the selected industry.</p>
                                                    </div>
                                                    <span className="text-[9px] font-bold uppercase tracking-widest text-black bg-white px-3 py-1.5 rounded-full self-start sm:self-auto">{selectedPaletteName}</span>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2.5">
                                                    {paletteFilterOptions.map(palette => {
                                                        const isActive = themeGenerationInputs.palette === palette.id;
                                                        return (
                                                            <button key={palette.id} type="button" onClick={() => setThemeFilterValue('palette', palette.id)} className={`group h-12 px-3 rounded-full border text-[9px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${isActive ? 'bg-black text-white border-black shadow-lg' : 'bg-white text-neutral-500 border-neutral-100 hover:text-black hover:border-neutral-300'}`}>
                                                                <span className="flex items-center">
                                                                    {palette.swatches.slice(0, 3).map((color, i) => (
                                                                        <span key={color} className={`w-5 h-5 rounded-full border ${isActive ? 'border-white/30' : 'border-black/10'} ${i > 0 ? '-ml-1.5' : ''}`} style={{ backgroundColor: color }} />
                                                                    ))}
                                                                </span>
                                                                <span className="hidden sm:inline">{palette.id === 'all' ? 'Spectrum' : palette.name}</span>
                                                            </button>
                                                        );
                                                    })}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setThemeFilterValue('palette', 'custom');
                                                            setCustomThemePaletteOpen(value => !value);
                                                        }}
                                                        className={`h-12 px-3 rounded-full border text-[9px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${themeGenerationInputs.palette === 'custom' ? 'bg-black text-white border-black shadow-lg' : 'bg-white text-neutral-500 border-neutral-100 hover:text-black hover:border-neutral-300'}`}
                                                    >
                                                        <span className="w-5 h-5 rounded-full border border-black/10 shadow-inner" style={{ backgroundColor: customThemeColor }} />
                                                        <span>Custom</span>
                                                    </button>
                                                    {(themeGenerationInputs.palette === 'custom' || customThemePaletteOpen) && (
                                                        <label className="h-12 pl-3 pr-2 rounded-full border border-neutral-100 bg-white flex items-center gap-3 text-[9px] font-bold uppercase tracking-widest text-neutral-500">
                                                            Pick Color
                                                            <input
                                                                type="color"
                                                                value={customThemeColor}
                                                                onChange={(event) => {
                                                                    setCustomThemeColor(event.target.value);
                                                                    setThemeFilterValue('palette', 'custom');
                                                                }}
                                                                className="w-8 h-8 rounded-full border-0 bg-transparent p-0 cursor-pointer"
                                                                aria-label="Choose custom theme color"
                                                            />
                                                        </label>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-neutral-100 pt-4">
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-black">{themeBriefResultLabel}</p>
                                                <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-300">Built from your theme brief</p>
                                            </div>
                                        </div>
                                        )}
                                        <div className="theme-template-panel mb-5 rounded-[22px] border border-neutral-100 bg-white p-3.5 sm:p-5 shadow-[0_20px_60px_rgba(15,23,42,0.045)]">
                                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
                                                <div className="min-w-0">
                                                    <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.3em] sm:tracking-[0.35em] text-neutral-300 mb-1.5">Saved Looks</p>
                                                    <h4 className="text-lg sm:text-xl font-black tracking-[-0.04em] text-black leading-tight">Save the current theme.</h4>
                                                    <p className="text-xs sm:text-sm text-neutral-400 font-medium mt-1">Name it once, then reuse it for launches, seasons, or new offers.</p>
                                                </div>
                                                <div className="w-full lg:max-w-md flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={themeTemplateName}
                                                        onChange={(event) => setThemeTemplateName(event.target.value)}
                                                        placeholder={suggestedThemeTemplateName}
                                                        className="h-11 flex-1 min-w-0 rounded-lg border border-neutral-100 bg-neutral-50 px-3 sm:px-4 text-sm font-bold text-black outline-none focus:bg-white focus:border-black transition-all"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={saveCurrentThemeTemplate}
                                                        className="h-11 px-3 sm:px-5 rounded-lg bg-black text-white text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.14em] sm:tracking-widest hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 shadow-xl shadow-black/10 shrink-0"
                                                    >
                                                        <Check size={14} />
                                                        <span className="sm:hidden">Save</span>
                                                        <span className="hidden sm:inline">Save Template</span>
                                                    </button>
                                                </div>
                                            </div>
                                            {savedThemeTemplates.length > 0 && (
                                                <div className="mt-4 border-t border-neutral-100 pt-4">
                                                    <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-300 mb-3">Saved Looks</p>
                                                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                                                        {savedThemeTemplates.map(template => (
                                                            <div key={template.id} className="shrink-0 min-w-[190px] rounded-2xl border border-neutral-100 bg-neutral-50 p-3 flex items-center justify-between gap-3">
                                                                <button type="button" onClick={() => applySavedThemeTemplate(template)} className="min-w-0 text-left">
                                                                    <span className="block text-[10px] font-bold uppercase tracking-widest text-black truncate">{template.name}</span>
                                                                    <span className="block text-[9px] font-bold uppercase tracking-widest text-neutral-300 mt-1">Apply template</span>
                                                                </button>
                                                                <button type="button" onClick={() => deleteThemeTemplate(template.id)} title="Delete template" className="w-8 h-8 rounded-full bg-white border border-neutral-100 text-neutral-400 hover:text-red-500 hover:border-red-100 transition-all flex items-center justify-center">
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="theme-card-list grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[560px] overflow-y-auto pr-2 pb-4 no-scrollbar">
                                            {!isMobileWebEditorRuntime && !themeGenerationInputs.industry && (
                                                <div className="md:col-span-2 min-h-[260px] rounded-[26px] border border-dashed border-neutral-200 bg-neutral-50/70 flex flex-col items-center justify-center text-center p-8">
                                                    <div className="w-14 h-14 rounded-2xl bg-white border border-neutral-100 flex items-center justify-center text-black shadow-sm mb-5">
                                                        <Sparkles size={20} />
                                                    </div>
                                                    <h4 className="text-2xl font-black tracking-[-0.04em] text-black">Choose an industry first.</h4>
                                                    <p className="text-sm text-neutral-400 font-medium max-w-md mt-2">The theme designer will build light and dark theme directions after it knows the business type.</p>
                                                </div>
                                            )}
                                            {visibleThemeCards.map(t => {
                                                const isNativeTheme = Boolean(t.nativeAccent);
                                                const isSelectedTheme = settings.nativeAccent === t.nativeAccent && settings.primaryColor === t.primaryColor && settings.backgroundColor === t.backgroundColor && settings.fontFamily === t.fontFamily;
                                                return (
                                                <button data-theme-card key={t.id} onClick={() => applyTheme(t.id)} className={`group relative min-h-[230px] p-6 rounded-lg border transition-all overflow-hidden text-left flex flex-col justify-between hover:-translate-y-0.5 ${isNativeTheme ? 'native-theme-card-preview' : ''}`} style={{ backgroundColor: t.backgroundColor, borderColor: isNativeTheme ? 'rgba(117,92,255,0.28)' : (t.headingColor || '#000') + '15', boxShadow: isSelectedTheme ? (isNativeTheme ? '0 0 0 2px rgba(117,92,255,0.55), 0 22px 45px rgba(20,167,255,0.14)' : `0 0 0 2px ${t.primaryColor}, 0 22px 45px rgba(0,0,0,0.12)`) : '0 4px 15px rgba(0,0,0,0.05)' }}>
                                                    {!isNativeTheme && (
                                                        <div className="absolute inset-x-0 top-0 h-1 opacity-90" style={{ backgroundColor: t.primaryColor }} />
                                                    )}
                                                    <div className="flex items-center justify-between w-full mb-6">
                                                        <span className="text-[9px] font-bold uppercase tracking-widest truncate max-w-[70%]" style={{ color: t.bodyColor }}>{t.name}</span>
                                                        <div className="flex gap-1.5 shrink-0">
                                                            <div className={`w-3.5 h-3.5 rounded-full shadow-sm border border-black/5 ${isNativeTheme ? 'native-theme-swatch' : ''}`} style={isNativeTheme ? undefined : { backgroundColor: t.primaryColor }} />
                                                            <div className="w-3.5 h-3.5 rounded-full shadow-sm border border-black/5" style={{ backgroundColor: t.headingColor }} />
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="space-y-4 w-full">
                                                        <h4 className="text-3xl font-bold tracking-tighter" style={{ color: t.headingColor, fontFamily: getFontFamily(t.headingFontFamily || t.fontFamily) }}>Aa Bb</h4>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`h-7 px-3 rounded-full text-[8px] font-bold uppercase tracking-widest flex items-center ${isNativeTheme ? 'native-theme-soft-pill' : ''}`} style={isNativeTheme ? { color: '#050505', border: '1px solid transparent' } : { backgroundColor: t.dateActiveBgColor === 'transparent' ? 'transparent' : t.dateActiveBgColor, color: t.dateActiveTextColor, border: `1px solid ${t.primaryColor}33` }}>Tue 19</span>
                                                            <span className="h-7 px-3 rounded-full text-[8px] font-bold uppercase tracking-widest flex items-center" style={{ color: t.bodyColor, border: `1px solid ${t.bodyColor}20` }}>FAQ</span>
                                                        </div>
                                                        
                                                        <div className="flex gap-2 w-full pt-2">
                                                            <div className={`h-8 flex-1 flex items-center justify-center text-[8px] font-bold shadow-sm ${isNativeTheme ? 'native-theme-soft-slot' : ''}`} style={isNativeTheme ? {
                                                                color: t.headingColor,
                                                                borderRadius: t.buttonStyle === 'pill' ? '12px' : '4px',
                                                                border: '1px solid transparent'
                                                            } : { 
                                                                backgroundColor: t.availabilityStyle === 'solid' ? t.slotBgColor : (t.availabilityStyle === 'outline' ? 'transparent' : 'transparent'), 
                                                                color: t.availabilityStyle === 'minimal' ? t.headingColor : t.slotTextColor, 
                                                                borderRadius: t.buttonStyle === 'pill' ? '12px' : '4px', 
                                                                border: t.availabilityStyle === 'outline' ? `1px solid ${t.primaryColor}50` : 'none' 
                                                            }}>12:00</div>
                                                            <div className={`h-8 flex-1 flex items-center justify-center text-[8px] font-bold uppercase tracking-widest shadow-md ${isNativeTheme ? 'native-theme-action' : ''}`} style={isNativeTheme ? {
                                                                color: '#050505',
                                                                borderRadius: t.buttonStyle === 'pill' ? '99px' : '4px'
                                                            } : { 
                                                                backgroundColor: t.primaryColor, 
                                                                color: t.buttonTextColor || '#000', 
                                                                borderRadius: t.buttonStyle === 'pill' ? '99px' : '4px' 
                                                            }}>Action</div>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                                            {[t.palette, t.styleTags?.[1] || t.styleTags?.[0], t.industryTags?.[0]].filter(Boolean).map(tag => (
                                                                <span key={tag} className="px-2 py-1 rounded-full text-[7px] font-bold uppercase tracking-widest" style={{ color: t.bodyColor, backgroundColor: t.faqBgColor }}>{tag}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </button>
                                            );})}
                                        </div>
                                        {hasMoreThemes && (
                                            <button
                                                type="button"
                                                onClick={loadMoreThemes}
                                                disabled={themeBatchLoading}
                                                className="mt-4 w-full h-12 rounded-lg border border-neutral-200 bg-white text-black text-[10px] font-bold uppercase tracking-widest hover:border-black transition-colors disabled:cursor-wait disabled:text-neutral-400 flex items-center justify-center gap-3"
                                            >
                                                {themeBatchLoading && (
                                                    <span className="brand-loader-dot" aria-hidden="true">
                                                        <BuildABookingMark className="w-4 h-4" />
                                                    </span>
                                                )}
                                                {themeBatchLoading ? 'Loading Themes' : 'Load More Themes'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                )}

                                {editorTab === 'visuals' && (
                                <div className="space-y-6 animate-in fade-in duration-700 pb-10">
                                    <label className="text-[10px] font-bold uppercase tracking-[0.5em] text-neutral-300 block">Visual System</label>

                                    <VisualEditorGroup title="Page Palette" note="Core colors and typography used across the whole booking page.">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {[
                                                { label: 'Accent', key: 'primaryColor' },
                                                { label: 'Background', key: 'backgroundColor' },
                                                { label: 'Heading Text', key: 'headingColor', fontKey: 'headingFontFamily' },
                                                { label: 'Body Text', key: 'bodyColor', fontKey: 'bodyFontFamily' }
                                            ].map(item => <ColorFontControl key={item.key} settings={settings} item={item} onChange={handleSettingChange} />)}
                                        </div>
                                    </VisualEditorGroup>

                                    <VisualEditorGroup title="Calendar Buttons" note="Controls the day selector style, colors, and date font.">
                                        <StyleSegmentedControl value={settings.dateStyle || settings.availabilityStyle || 'minimal'} onChange={(value) => handleSettingChange('dateStyle', value)} label="Calendar Style" />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {[
                                                { label: 'Date Background', key: 'dateBgColor' },
                                                { label: 'Date Text', key: 'dateTextColor', fontKey: 'dateFontFamily' },
                                                { label: 'Active Date Background', key: 'dateActiveBgColor' },
                                                { label: 'Active Date Text', key: 'dateActiveTextColor', fontKey: 'dateFontFamily' }
                                            ].map(item => <ColorFontControl key={item.key} settings={settings} item={item} onChange={handleSettingChange} />)}
                                        </div>
                                    </VisualEditorGroup>

                                    <VisualEditorGroup title="Time Boxes" note="Controls the available time slot buttons clients tap.">
                                        <StyleSegmentedControl value={settings.timeSlotStyle || settings.availabilityStyle || 'minimal'} onChange={(value) => {
                                            handleSettingChange('timeSlotStyle', value);
                                            handleSettingChange('availabilityStyle', value);
                                        }} label="Time Box Style" />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {[
                                                { label: 'Time Box Bg', key: 'slotBgColor' },
                                                { label: 'Time Box Text', key: 'slotTextColor', fontKey: 'slotFontFamily' }
                                            ].map(item => <ColorFontControl key={item.key} settings={settings} item={item} onChange={handleSettingChange} />)}
                                        </div>
                                    </VisualEditorGroup>

                                    <VisualEditorGroup title="Action Button" note="Controls the final booking button style and typography.">
                                        <StyleSegmentedControl value={settings.actionButtonStyle || 'solid'} onChange={(value) => handleSettingChange('actionButtonStyle', value)} label="Action Style" />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {[
                                                { label: 'Action Background', key: 'primaryColor' },
                                                { label: 'Action Text', key: 'buttonTextColor', fontKey: 'buttonFontFamily' }
                                            ].map(item => <ColorFontControl key={item.key} settings={settings} item={item} onChange={handleSettingChange} />)}
                                        </div>
                                        <ButtonShapeControl value={settings.buttonStyle || 'pill'} onChange={(value) => handleSettingChange('buttonStyle', value)} />
                                    </VisualEditorGroup>

                                    <VisualEditorGroup title="FAQ Styling" note="Applies when the FAQ feature is enabled.">
                                        <StyleSegmentedControl value={settings.faqStyle || 'minimal'} onChange={(value) => handleSettingChange('faqStyle', value)} label="FAQ Style" />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {[
                                                { label: 'FAQ Background', key: 'faqBgColor' },
                                                { label: 'FAQ Border', key: 'faqBorderColor' },
                                                { label: 'Question Text', key: 'faqTextColor', fontKey: 'faqFontFamily' },
                                                { label: 'Answer Text', key: 'faqAnswerColor', fontKey: 'faqFontFamily' }
                                            ].map(item => <ColorFontControl key={item.key} settings={settings} item={item} onChange={handleSettingChange} />)}
                                        </div>
                                    </VisualEditorGroup>

                                    <VisualEditorGroup title="Social Footer" note="Styles the clickable social icons below the action button.">
                                        <StyleSegmentedControl value={settings.socialIconStyle || 'outline'} onChange={(value) => handleSettingChange('socialIconStyle', value)} label="Icon Style" />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {[
                                                { label: 'Icon Background', key: 'socialIconBgColor' },
                                                { label: 'Icon / Label Color', key: 'socialIconColor' },
                                                { label: 'Solid Text Color', key: 'socialIconTextColor' }
                                            ].map(item => <ColorFontControl key={item.key} settings={settings} item={item} onChange={handleSettingChange} />)}
                                        </div>
                                    </VisualEditorGroup>

                                    <div className="pt-6 border-t border-neutral-50">
                                        <label className="text-[10px] font-bold uppercase tracking-[0.5em] text-neutral-300 block mb-6">Typography Engine</label>
                                        <div className="space-y-8">
                                            <div className="rounded-[22px] border border-neutral-100 bg-neutral-50/70 p-4">
                                                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
                                                    <div>
                                                        <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">Master Font Style</p>
                                                        <p className="text-xs text-neutral-400 font-semibold mt-1">Use this after picking a theme to shift the full page into a clearer brand voice.</p>
                                                    </div>
                                                    <span className="text-[9px] font-bold uppercase tracking-widest text-black bg-white px-3 py-1.5 rounded-full self-start sm:self-auto">Style System</span>
                                                </div>
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                    {fontStylePresets.map(preset => (
                                                        <button
                                                            key={preset.id}
                                                            type="button"
                                                            onClick={() => applyFontStylePreset(preset)}
                                                            className="rounded-2xl border border-neutral-100 bg-white p-3 text-left hover:border-black hover:-translate-y-0.5 transition-all"
                                                        >
                                                            <span className="block text-base font-black tracking-[-0.04em] text-black" style={{ fontFamily: getFontFamily(preset.headingFontFamily) }}>Aa Bb</span>
                                                            <span className="block text-[10px] font-bold uppercase tracking-widest text-black mt-2">{preset.label}</span>
                                                            <span className="block text-[9px] font-bold uppercase tracking-widest text-neutral-300 mt-1">{preset.note}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <LetterSpacingControl settings={settings} onChange={handleSettingChange} />
                                            {['Sans', 'Serif', 'Display', 'Mono', 'Brush'].map(cat => (
                                                <div key={cat}>
                                                    <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-4">{cat}</p>
                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                        {FONT_OPTIONS.filter(f => f.category === cat).map(f => (
                                                            <button
                                                                key={f.id}
                                                                onClick={() => handleSettingChange('fontFamily', f.id)}
                                                                className={`py-4 px-2 rounded-lg text-sm transition-all border ${settings.fontFamily === f.id ? 'bg-black text-white border-black shadow-xl' : 'bg-neutral-50 text-neutral-500 border-transparent hover:bg-neutral-100 hover:text-black'}`}
                                                                style={{ fontFamily: f.family }}
                                                            >
                                                                {f.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                )}

                                {editorTab === 'features' && (
                                <div className="space-y-8 animate-in fade-in duration-700 pb-20">
                                    <label className="text-[10px] font-bold uppercase tracking-[0.5em] text-neutral-300 block">Booking Features</label>

                                    <div className="rounded-lg border border-neutral-100 bg-white overflow-hidden shadow-[0_20px_70px_-65px_rgba(15,23,42,0.7)]">
                                        <div className="p-4 md:p-6 border-b border-neutral-100">
                                            <p className="text-sm font-bold text-black">Client Detail Fields</p>
                                            <p className="text-xs text-neutral-400 font-medium mt-1 max-w-2xl">Choose exactly what clients need to leave before they request a booking. Email updates and client portal access only run when the matching contact field is collected.</p>
                                        </div>
                                        <div className="grid grid-cols-1 xl:grid-cols-3 divide-y xl:divide-y-0 xl:divide-x divide-neutral-100">
                                            {[
                                                { key: 'collectClientPhone', icon: Phone, label: 'Mobile Number', note: 'Used for phone follow-ups and contact records.', active: collectsClientPhone },
                                                { key: 'collectClientEmail', icon: Mail, label: 'Email Address', note: 'Used for client email updates and CRM records.', active: collectsClientEmail },
                                                { key: 'collectClientNotes', icon: MessageSquare, label: 'Client Note', note: 'Adds an optional note field for requests or context.', active: collectsClientNotes }
                                            ].map(item => {
                                                const IconCmp = item.icon;
                                                return (
                                                    <div key={item.key} className="p-4 md:p-5 flex items-start justify-between gap-4">
                                                        <div className="flex items-start gap-3 min-w-0">
                                                            <div className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${item.active ? 'bg-black text-white border-black' : 'bg-neutral-50 text-neutral-400 border-neutral-100'}`}>
                                                                <IconCmp size={16} />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold text-black">{item.label}</p>
                                                                <p className="text-xs text-neutral-400 font-medium mt-1 leading-relaxed">{item.note}</p>
                                                            </div>
                                                        </div>
                                                        <button onClick={() => handleFeatureChange(item.key, !item.active)} className={`w-14 h-8 rounded-full flex items-center px-1 transition-colors shrink-0 ${item.active ? 'bg-[#39FF14]' : 'bg-neutral-200'}`} aria-pressed={Boolean(item.active)}>
                                                            <div className={`w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${item.active ? 'translate-x-6' : ''}`} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {[
                                            { key: 'loadingScreen', label: 'Loading Logo Pulse', note: 'Brief branded loading moment before the page appears.' },
                                            { key: 'birthday', label: 'Birthday Capture', note: 'Adds an optional birthday field to the details form.' },
                                            { key: 'waitlist', label: 'Waitlist Fallback', note: 'Allows clients to join standby when a day has no slots.' },
                                            { key: 'firstAvailable', label: 'First Available Button', note: 'Lets clients jump to the next open day.' },
                                            { key: 'socialProof', label: 'Social Proof Ticker', note: 'Shows a small confidence cue under the action button.' }
                                        ].map(f => (
                                            <div key={f.key} className="flex items-center justify-between gap-4 bg-neutral-50 p-4 md:p-6 rounded-lg border border-neutral-100/50">
                                                <div>
                                                    <span className="text-sm font-bold text-black">{f.label}</span>
                                                    <p className="text-xs text-neutral-400 font-medium mt-1">{f.note}</p>
                                                </div>
                                                <button onClick={() => handleFeatureChange(f.key, !settings.features?.[f.key])} className={`w-14 h-8 rounded-full flex items-center px-1 transition-colors shrink-0 ${settings.features?.[f.key] ? 'bg-[#39FF14]' : 'bg-neutral-200'}`} aria-pressed={Boolean(settings.features?.[f.key])}>
                                                    <div className={`w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${settings.features?.[f.key] ? 'translate-x-6' : ''}`} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="rounded-lg border border-neutral-100 bg-neutral-50 overflow-hidden">
                                        <div className="p-4 md:p-6 flex items-center justify-between gap-4">
                                            <div className="flex items-start gap-4">
                                                <div className="w-11 h-11 rounded-lg bg-white border border-neutral-100 flex items-center justify-center text-black shrink-0">
                                                    <Mail size={17} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-black">Email Updates Opt-In</p>
                                                    <p className="text-xs text-neutral-400 font-medium mt-1 max-w-lg">Adds a consent checkbox before the booking button. Email messages only send when the email field is on and the client accepts updates.</p>
                                                </div>
                                            </div>
                                            <button disabled={!collectsClientEmail} onClick={() => collectsClientEmail && handleFeatureChange('emailUpdates', !emailUpdatesEnabled)} className={`w-14 h-8 rounded-full flex items-center px-1 transition-colors shrink-0 ${emailUpdatesEnabled && collectsClientEmail ? 'bg-[#39FF14]' : 'bg-neutral-200'} ${!collectsClientEmail ? 'opacity-50 cursor-not-allowed' : ''}`} aria-pressed={Boolean(emailUpdatesEnabled && collectsClientEmail)}>
                                                <div className={`w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${emailUpdatesEnabled && collectsClientEmail ? 'translate-x-6' : ''}`} />
                                            </button>
                                        </div>
                                        {!collectsClientEmail && (
                                            <div className="border-t border-neutral-100 bg-white p-4 md:p-6">
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Email updates are off because email address collection is off.</p>
                                            </div>
                                        )}
                                        {emailUpdatesEnabled && collectsClientEmail && (
                                            <div className="border-t border-neutral-100 bg-white p-4 md:p-6">
                                                <EmailNotificationSettings
                                                    communications={communications}
                                                    setCommunications={setCommunications}
                                                    saveComms={saveComms}
                                                    showToast={showToast}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="rounded-lg border border-neutral-100 bg-neutral-50 overflow-hidden">
                                        <div className="p-4 md:p-6 flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-bold text-black">FAQ After Details</p>
                                                <p className="text-xs text-neutral-400 font-medium mt-1">Shows client questions inside the details step, before the final booking action.</p>
                                            </div>
                                            <button onClick={toggleFaqFeature} className={`w-14 h-8 rounded-full flex items-center px-1 transition-colors shrink-0 ${settings.features?.faqEnabled ? 'bg-[#39FF14]' : 'bg-neutral-200'}`} aria-pressed={Boolean(settings.features?.faqEnabled)}>
                                                <div className={`w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${settings.features?.faqEnabled ? 'translate-x-6' : ''}`} />
                                            </button>
                                        </div>
                                        {settings.features?.faqEnabled && (
                                            <div className="border-t border-neutral-100 bg-white p-4 md:p-6 space-y-4">
                                                {(settings.features?.faqs || []).map((faq, i) => (
                                                    <details key={i} className="group rounded-lg border border-neutral-100 bg-neutral-50 open:bg-white open:shadow-sm transition-all">
                                                        <summary className="list-none cursor-pointer p-4 flex items-center justify-between gap-4">
                                                            <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">{faq.q || `Question ${i + 1}`}</span>
                                                            <ChevronDown size={15} className="text-neutral-300 transition-transform group-open:rotate-180" />
                                                        </summary>
                                                        <div className="px-4 pb-4 space-y-3">
                                                            <input type="text" value={faq.q} onChange={(e) => updateFaqItem(i, 'q', e.target.value)} placeholder="Question" className="w-full bg-white border border-neutral-100 rounded-lg px-4 py-3 font-bold text-sm outline-none focus:border-black transition-colors" />
                                                            <textarea value={faq.a} onChange={(e) => updateFaqItem(i, 'a', e.target.value)} placeholder="Answer" className="w-full bg-white border border-neutral-100 rounded-lg px-4 py-3 text-sm font-medium outline-none resize-none min-h-[92px] focus:border-black transition-colors" />
                                                            <button onClick={() => removeFaqItem(i)} className="h-9 px-3 rounded-lg bg-white border border-neutral-100 text-red-500 text-[10px] font-bold uppercase tracking-widest hover:bg-red-50 transition-colors flex items-center gap-2">
                                                                <X size={13} /> Remove
                                                            </button>
                                                        </div>
                                                    </details>
                                                ))}
                                                <button onClick={addFaqItem} className="w-full py-5 rounded-lg border-2 border-dashed border-neutral-200 text-neutral-400 font-bold text-xs uppercase tracking-widest hover:border-black hover:text-black transition-all">Add Question</button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="rounded-lg border border-neutral-100 bg-neutral-50 overflow-hidden">
                                        <div className="p-4 md:p-6 flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-bold text-black">Social Footer Links</p>
                                                <p className="text-xs text-neutral-400 font-medium mt-1">Adds clickable social icons below the booking action button.</p>
                                            </div>
                                            <button onClick={() => handleFeatureChange('socialLinks', !settings.features?.socialLinks)} className={`w-14 h-8 rounded-full flex items-center px-1 transition-colors shrink-0 ${settings.features?.socialLinks ? 'bg-[#39FF14]' : 'bg-neutral-200'}`} aria-pressed={Boolean(settings.features?.socialLinks)}>
                                                <div className={`w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${settings.features?.socialLinks ? 'translate-x-6' : ''}`} />
                                            </button>
                                        </div>
                                        {settings.features?.socialLinks && (
                                            <div className="border-t border-neutral-100 bg-white p-4 md:p-6 space-y-4">
                                                {[
                                                    ['instagram', 'Instagram', '@yourstudio'],
                                                    ['tiktok', 'TikTok', '@yourstudio'],
                                                    ['facebook', 'Facebook', 'your page or handle'],
                                                    ['website', 'Website', 'https://yourwebsite.com']
                                                ].map(([key, label, placeholder]) => (
                                                    <div key={key}>
                                                        <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-2 ml-2">{label}</p>
                                                        <input type="text" value={settings.socials?.[key] || ''} onChange={(e) => handleSocialChange(key, e.target.value)} placeholder={placeholder} className="w-full bg-neutral-50 border border-neutral-100 rounded-lg px-5 py-4 text-sm font-bold outline-none focus:bg-white focus:border-black transition-all" />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-8 border-t border-neutral-50 space-y-6">
                                        <label className="text-[10px] font-bold uppercase tracking-[0.5em] text-neutral-300 block">External Links</label>
                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-3 ml-4">Google Maps Link (Shows Get Directions)</p>
                                            <input type="url" value={settings.features?.location || ''} onChange={(e) => handleFeatureChange('location', e.target.value)} placeholder="https://maps.app.goo.gl/..." className="w-full bg-neutral-50 border-none rounded-lg px-5 md:px-8 py-4 md:py-5 text-sm font-medium outline-none" />
                                        </div>
                                    </div>
                                </div>
                                )}

                                {editorTab === 'copy' && (
                                <div className="space-y-8 animate-in fade-in duration-700 pb-20">
                                    <label className="text-[10px] font-bold uppercase tracking-[0.5em] text-neutral-300 block">Interface Wording</label>
                                    {[
                                    { key: 'dateLabel', l: 'Date Selection Title' },
                                    { key: 'timeLabel', l: 'Time Selection Title' },
                                    { key: 'detailsHeading', l: 'Details Section Title' },
                                    { key: 'detailsSubHeading', l: 'Details Sub-Title' },
                                    { key: 'confirmButtonText', l: 'Final Submit Button' },
                                    { key: 'successHeading', l: 'Success Screen Title' }
                                    ].map(item => (
                                    <div key={item.key} className="space-y-2">
                                        <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 ml-6">{item.l}</p>
                                        <input type="text" value={settings[item.key]} onChange={(e) => handleSettingChange(item.key, e.target.value)} className="w-full bg-neutral-50 border-none rounded-lg px-5 md:px-8 py-4 md:py-5 text-sm font-bold focus:bg-white transition-all outline-none text-black shadow-inner" />
                                    </div>
                                    ))}
                                </div>
                                )}
                            </div>

                            <div className="editor-publish-footer p-2.5 sm:p-5 md:p-8 border-t border-neutral-50 flex-shrink-0 bg-white">
                                <div className="grid grid-cols-2 sm:grid-cols-[0.72fr_1fr] gap-2 sm:gap-3">
                                    <button
                                        type="button"
                                        onClick={() => saveSettingsDraft(settings, "Editor draft saved.")}
                                        className="h-10 sm:h-12 md:h-16 rounded-[999px] border border-neutral-200 bg-white text-black text-[8px] sm:text-[9px] md:text-[10px] font-bold uppercase tracking-[0.16em] sm:tracking-[0.22em] hover:border-black hover:shadow-lg transition-all flex items-center justify-center gap-1.5 sm:gap-2"
                                    >
                                        <CheckCircle2 size={14} />
                                        <span className="sm:hidden">Draft</span>
                                        <span className="hidden sm:inline">Save Draft</span>
                                    </button>
                                    <ProButton onClick={saveSettings} variant="primary" className="editor-publish-button w-full py-3 sm:py-5 md:py-7 text-[8px] sm:text-[9px] md:text-[11px] uppercase shadow-2xl shadow-black/20">
                                        <span className="sm:hidden">Publish</span>
                                        <span className="hidden sm:inline">Publish To Web</span>
                                    </ProButton>
                                </div>
                            </div>
                            </>
                        )}
                        </div>

                        <button onClick={() => setEditorCollapsed(!editorCollapsed)} className="desktop-editor-panel-toggle hidden md:flex fixed bottom-6 right-6 md:bottom-10 md:right-10 z-[100] w-12 h-12 bg-white border border-neutral-100 rounded-full shadow-2xl items-center justify-center text-neutral-400 hover:text-black transition-all hover:scale-110">
                            {editorCollapsed ? <PanelRightOpen size={20} /> : <PanelRightClose size={20} />}
                        </button>

                        {/* LIVE SIMULATOR ENVIRONMENT */}
                        <div ref={containerRef} className="mobile-editor-preview flex-1 bg-[#F5F5F7] hidden md:flex flex-col items-center justify-center relative overflow-hidden p-6 md:p-8">
                        <div className="mobile-editor-preview-toolbar absolute top-4 md:top-8 flex flex-col md:flex-row items-center gap-3 md:gap-12 z-50">
                            <div className="mobile-editor-device-switcher flex bg-white/60 backdrop-blur-xl p-1.5 rounded-full border border-white/80 shadow-sm">
                                <button onClick={() => setDevice('desktop')} className={`mobile-editor-device-option px-8 py-2.5 rounded-full text-[9px] font-bold uppercase tracking-[0.4em] transition-all duration-700 ${device === 'desktop' ? 'bg-black text-white shadow-lg' : 'text-neutral-400 hover:text-black'}`}>PC</button>
                                <button onClick={() => setDevice('mobile')} className={`mobile-editor-device-option px-8 py-2.5 rounded-full text-[9px] font-bold uppercase tracking-[0.4em] transition-all duration-700 ${device === 'mobile' ? 'bg-black text-white shadow-lg' : 'text-neutral-400 hover:text-black'}`}>Mobile</button>
                            </div>
                            <div className="mobile-editor-toolbar-actions flex items-center gap-2">
                                <button onClick={handleAddToHomeScreen} className="mobile-editor-install-action hidden h-11 px-4 rounded-full bg-black text-white shadow-lg border border-black transition-all items-center justify-center gap-2 text-[9px] font-bold uppercase tracking-widest">
                                    <Share2 size={15}/>
                                    Home Screen
                                </button>
                                <button onClick={() => setPreviewKey(prev => prev + 1)} className="mobile-editor-refresh-action p-3 rounded-full bg-white text-neutral-400 hover:text-black shadow-lg border border-white/80 transition-all hidden md:block"><RefreshCw size={16}/></button>
                            </div>
                        </div>

                        <div className="mobile-editor-compact-controls md:hidden absolute right-4 bottom-4 z-[180] items-center gap-2 rounded-full bg-black/80 p-1.5 shadow-2xl backdrop-blur-xl border border-white/10">
                            <button
                                type="button"
                                onClick={() => setEditorCollapsed(prev => !prev)}
                                className={`h-10 px-3 rounded-full flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest transition-all ${editorCollapsed ? 'bg-[#39FF14] text-black' : 'bg-white/10 text-white'}`}
                                aria-pressed={editorCollapsed}
                            >
                                {editorCollapsed ? <PanelRightOpen size={14} /> : <PanelRightClose size={14} />}
                                Panel
                            </button>
                            <button
                                type="button"
                                onClick={() => setMobileNavCollapsed(prev => !prev)}
                                className={`h-10 px-3 rounded-full flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest transition-all ${mobileNavCollapsed ? 'bg-[#39FF14] text-black' : 'bg-white/10 text-white'}`}
                                aria-pressed={mobileNavCollapsed}
                            >
                                {mobileNavCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
                                Nav
                            </button>
                        </div>

                        <div
                            style={{
                                width: `${editorPreviewFrame.width}px`,
                                height: `${editorPreviewFrame.height}px`,
                                transform: `scale(${scale})`,
                                transformOrigin: isCompactEditorViewport ? 'top center' : 'center center',
                                '--booking-preview-input-color': settings.headingColor || '#050505'
                            }}
                            className={`editor-preview-frame transition-all duration-700 ease-out relative flex flex-col shrink-0 bg-white shadow-[0_100px_200px_-50px_rgba(0,0,0,0.15)] border-black overflow-hidden ${editorPreviewFrameClass}`}
                        >
                            
                            {device === 'desktop' && (
                                <div className={`absolute top-0 left-1/2 -translate-x-1/2 bg-black rounded-b-3xl z-[100] flex items-center justify-center ${isCompactEditorViewport ? 'w-40 h-5' : 'w-48 h-6'}`}>
                                    <div className="w-2.5 h-2.5 rounded-full bg-neutral-900 border border-white/5 shadow-inner" />
                                </div>
                            )}

                            {device === 'mobile' && (
                            <>
                                <div className={`absolute left-1/2 -translate-x-1/2 bg-black rounded-full z-[100] flex items-center justify-center ${isCompactEditorViewport ? 'top-3 w-28 h-7' : 'top-4 w-32 h-8'}`}><div className="w-2 h-2 rounded-full bg-[#111] ml-auto mr-4" /></div>
                                <div className={`absolute left-10 right-10 z-[100] flex justify-between items-center text-black font-bold tracking-tight ${isCompactEditorViewport ? 'top-8 text-[11px]' : 'top-10 text-[13px]'}`}>
                                    <span>9:41</span><div className="flex gap-2 items-center"><Signal size={14} /><Wifi size={14} /><Battery size={18} strokeWidth={2} /></div>
                                </div>
                                <div className={`absolute -left-[10px] w-1 bg-black rounded-r-lg z-[100] ${isCompactEditorViewport ? 'top-28 h-14' : 'top-32 h-16'}`} />
                                <div className={`absolute -left-[10px] w-1 bg-black rounded-r-lg z-[100] ${isCompactEditorViewport ? 'top-44 h-10' : 'top-52 h-12'}`} />
                                <div className={`absolute -right-[10px] w-1 bg-black rounded-l-lg z-[100] ${isCompactEditorViewport ? 'top-36 h-20' : 'top-44 h-24'}`} />
                            </>
                            )}

                            <div className={`flex-shrink-0 border-b flex items-center justify-between ${device === 'desktop' ? (isCompactEditorViewport ? 'px-10 h-20 bg-neutral-50/50' : 'px-16 h-24 bg-neutral-50/50') : (isCompactEditorViewport ? 'px-7 h-24 pt-8 bg-white' : 'px-8 h-28 pt-10 bg-white')}`} style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
                              <div className="flex gap-3 w-16">
                                {device === 'desktop' && <><div className="w-3.5 h-3.5 rounded-full bg-red-400/80" /><div className="w-3.5 h-3.5 rounded-full bg-amber-400/80" /><div className="w-3.5 h-3.5 rounded-full bg-green-400/80" /></>}
                              </div>
                              <div className={`flex items-center justify-center gap-2 rounded-full bg-black/5 font-bold text-neutral-500 uppercase overflow-hidden ${device === 'desktop' ? 'px-8 py-2.5 text-[10px] tracking-[0.3em] w-1/2 max-w-[400px]' : 'px-5 py-2 text-[8px] tracking-[0.2em] max-w-[200px]'}`}>
                                <span className="truncate whitespace-nowrap">/book/{settings.slug || 'studio'}</span>
                              </div>
                              <div className="w-16" />
                            </div>

                            <div className="flex-1 overflow-y-auto no-scrollbar relative group/simulator" style={{ backgroundColor: settings.backgroundColor }}>
                            {shouldMountEditorPreview ? (
                                <>
                                <div className="absolute top-8 right-8 z-50 flex items-center gap-2 px-4 py-2 bg-black/10 backdrop-blur-md rounded-full text-[9px] font-bold uppercase tracking-[0.2em] opacity-0 group-hover/simulator:opacity-100 transition-opacity pointer-events-none text-black">
                                    <MousePointerClick size={12} /> Design Inspector Live
                                </div>
                                <Suspense fallback={<LazySectionFallback label="Loading preview" />}>
                                    <BookingFlow key={previewKey} settings={settings} isPreview={true} onInspect={handleInspect} onComplete={handleBookingComplete} />
                                </Suspense>
                                </>
                            ) : (
                                <div className="h-full w-full flex items-center justify-center">
                                    <BrandLoader label="Preview paused on portrait" />
                                </div>
                            )}
                            </div>
                        </div>
                        </div>
                    </div>
                    )}

                    {activeTab === 'bookings' && (
                    <div className="flex-1 overflow-y-auto bg-[#F6F7F9] p-4 sm:p-6 md:p-10 lg:p-12">
                        <header className="dashboard-page-header mb-4 md:mb-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-4xl md:text-4xl font-bold tracking-tight text-black">My Bookings</h1>
                                <p className="text-neutral-500 text-sm md:text-base mt-2 max-w-2xl">Review requests, confirm clients, assign your team, and keep every appointment moving.</p>
                            </div>
                        </header>

                        <section data-tour="bookings-queue" className="saas-card booking-desk-shell overflow-hidden">
                            <div className="booking-desk-command p-4 md:p-5 border-b border-neutral-100">
                                <div className="flex flex-col 2xl:flex-row 2xl:items-start justify-between gap-4">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase text-neutral-400 mb-2">Booking Desk</p>
                                        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-black">
                                            {bookingDesk.activeFilter === 'upcoming' ? 'Latest Upcoming' : `${bookingDesk.activeFilterLabel} Bookings`}
                                        </h2>
                                        <p className="text-sm text-neutral-500 mt-1">
                                            {showBookingExample
                                                ? '0 real records. Example shown for layout only.'
                                                : `${bookingRows.length} shown / ${bookingDesk.period.rangeLabel}.`}
                                        </p>
                                    </div>
                                    <div className="schedule-scope-toggle flex bg-neutral-100 p-1 rounded-lg border border-neutral-200 w-full sm:w-fit">
                                        {bookingDesk.periods.map(period => (
                                            <button
                                                key={period.id}
                                                onClick={() => {
                                                    setBookingDeskPeriod(period.id);
                                                    if (period.id === 'custom') setBookingRangeDialogOpen(true);
                                                }}
                                                className={`flex-1 sm:flex-none h-10 px-4 rounded-md text-[10px] font-bold uppercase transition-all ${bookingDeskPeriod === period.id ? 'bg-black text-white shadow-lg' : 'text-neutral-500 hover:text-black hover:bg-white'}`}
                                            >
                                                {period.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="booking-desk-controls mt-4 flex flex-col xl:flex-row gap-3">
                                    <label className="booking-search-field relative flex-1 min-w-0">
                                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-300" />
                                        <input
                                            value={bookingSearch}
                                            onChange={(event) => setBookingSearch(event.target.value)}
                                            placeholder="Search client, phone, email, note"
                                            className="w-full h-12 rounded-lg bg-white border border-neutral-200 pl-11 pr-4 text-sm font-bold text-black outline-none focus:border-black transition-colors"
                                        />
                                    </label>
                                    <div className="booking-filter-rail flex flex-wrap items-center gap-2">
                                        {bookingDesk.filters.map(filter => (
                                            <button
                                                key={filter.id}
                                                onClick={() => setBookingFilter(filter.id)}
                                                className={`h-11 px-3 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-2 ${bookingDesk.activeFilter === filter.id ? 'bg-black text-white shadow-lg' : 'bg-neutral-50 text-neutral-500 hover:bg-neutral-100 hover:text-black'}`}
                                            >
                                                {filter.label}
                                                <span className={`min-w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${bookingDesk.activeFilter === filter.id ? 'native-gradient-icon text-black' : 'bg-white text-black border border-neutral-100'}`}>{filter.count}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="booking-record-list divide-y divide-neutral-100">
                                {bookingRows.length === 0 ? (
                                    <div className="p-12 md:p-20 text-center">
                                        <div className="w-14 h-14 rounded-lg bg-neutral-100 flex items-center justify-center mx-auto mb-5 text-neutral-400"><Layers size={22}/></div>
                                        <h3 className="text-xl font-bold tracking-tight text-black mb-2">{bookingDesk.searchActive ? 'No matching bookings' : 'No bookings here'}</h3>
                                        <p className="text-sm text-neutral-500">{bookingDesk.searchActive ? 'Try a different client name, phone, email, or note.' : 'Try another category or wait for new booking requests.'}</p>
                                    </div>
                                ) : bookingRows.map(b => {
                                    const assignedStaff = staffList.find(s => s.id === b.staffId);
                                    const isExampleBooking = Boolean(b.isExample);
                                    const clientAvatar = getBookingClientAvatar(b);
                                    const contactSummary = [b.clientPhone, b.clientEmail, b.clientBirthday ? `Bday: ${b.clientBirthday}` : '', b.clientNote ? `Note: ${b.clientNote}` : ''].filter(Boolean).join(' / ');
                                    const statusStyle = b.status === 'confirmed'
                                        ? 'bg-[#39FF14] text-black'
                                        : b.status === 'waitlist'
                                            ? 'bg-amber-100 text-amber-800'
                                            : b.status === 'declined'
                                                ? 'bg-red-50 text-red-600'
                                                : 'bg-black text-white';
                                    return (
                                        <div key={b.id} className={`booking-record-row p-4 md:p-5 transition-all hover:bg-neutral-50/70 ${b.status === 'declined' ? 'opacity-50 grayscale' : ''}`}>
                                            <div className="grid grid-cols-1 2xl:grid-cols-12 gap-4 2xl:items-center">
                                                <div className="2xl:col-span-5 flex items-center gap-4 min-w-0">
                                                    <div className="relative shrink-0">
                                                        <div className={`w-14 h-14 rounded-lg flex items-center justify-center font-bold text-xl shadow-inner uppercase overflow-hidden ${clientAvatar ? 'bg-neutral-100 text-black' : statusStyle}`}>
                                                            {clientAvatar ? <img src={clientAvatar} alt="" className="w-full h-full object-cover" /> : b.clientName.charAt(0)}
                                                        </div>
                                                        {b.noShowHistory && <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-sm" title="No-show history" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-3 mb-1">
                                                            <h3 className="text-lg md:text-xl font-bold tracking-tight text-black truncate">{b.clientName}</h3>
                                                            {isExampleBooking && <span className="shrink-0 px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest bg-neutral-100 text-neutral-500">Example Only</span>}
                                                            <span className={`shrink-0 px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest ${statusStyle}`}>{b.status === 'waitlist' ? 'Standby' : b.status}</span>
                                                        </div>
                                                        <p className="text-sm text-neutral-500 truncate">{isExampleBooking ? 'Preview only - not saved, synced, or counted in stats' : contactSummary || 'No contact details collected'}</p>
                                                    </div>
                                                </div>

                                                <div className="2xl:col-span-2">
                                                    <p className="metric-value text-2xl font-bold tracking-tight text-black">{b.time}</p>
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{b.date}</p>
                                                </div>

                                                <div className="2xl:col-span-3">
                                                    {isExampleBooking ? (
                                                        <div className="inline-flex h-10 items-center px-3 rounded-lg bg-neutral-50 border border-neutral-100 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                                                            Example preview
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-300 hidden md:inline">Assigned</span>
                                                            <select
                                                                value={b.staffId || ''}
                                                                onChange={(e) => updateBooking(b.id, { staffId: e.target.value })}
                                                                className="h-10 min-w-[160px] bg-white text-sm font-bold px-3 rounded-lg outline-none border border-neutral-200 focus:border-black transition-colors"
                                                            >
                                                                <option value="" disabled>Assign staff</option>
                                                                {displayStaffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                            </select>
                                                            {assignedStaff && <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: assignedStaff.color }} />}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="2xl:col-span-2 flex flex-wrap items-center justify-start 2xl:justify-end gap-2">
                                                    {isExampleBooking ? (
                                                        <div className="flex flex-wrap items-center justify-start xl:justify-end gap-2">
                                                            <button type="button" disabled className="h-10 px-3 rounded-lg bg-white border border-neutral-200 text-neutral-500 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest cursor-default">
                                                                <Calendar size={14} /> Reschedule
                                                            </button>
                                                            <button type="button" disabled className="h-10 px-3 rounded-lg bg-white border border-neutral-200 text-neutral-500 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest cursor-default">
                                                                <MessageCircle size={14} /> Chat
                                                            </button>
                                                            <button type="button" disabled className="h-10 px-3 rounded-lg bg-white border border-neutral-200 text-amber-700 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest cursor-default">
                                                                <Bell size={14} /> Waitlist
                                                            </button>
                                                            <button type="button" disabled className="h-10 px-3 rounded-lg native-gradient-button flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest cursor-default">
                                                                <Check size={15} strokeWidth={3} /> Approve
                                                            </button>
                                                            <button type="button" disabled className="h-10 px-3 rounded-lg bg-white border border-red-100 text-red-500 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest cursor-default">
                                                                <X size={14} strokeWidth={3} /> Deny
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => openBookingChat(b)}
                                                                className="h-10 px-3 rounded-lg bg-white border border-neutral-200 text-neutral-600 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-50 hover:text-black hover:border-black transition-all"
                                                            >
                                                                <MessageCircle size={14} /> Chat
                                                            </button>
                                                            <button
                                                                onClick={() => sendRunningLateToBooking(b)}
                                                                className="h-10 px-3 rounded-lg bg-black text-white flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all"
                                                            >
                                                                <Clock size={14} /> Late
                                                            </button>
                                                            <button
                                                                onClick={() => sendReviewToBooking(b)}
                                                                className="h-10 px-3 rounded-lg bg-white border border-neutral-200 text-neutral-600 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-50 hover:text-black transition-all"
                                                            >
                                                                <Mail size={14} /> Review
                                                            </button>
                                                            <button
                                                                onClick={() => sendNudgeToBooking(b)}
                                                                className="h-10 px-3 rounded-lg bg-white border border-neutral-200 text-neutral-600 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-50 hover:text-black transition-all"
                                                            >
                                                                <Zap size={14} /> Nudge
                                                            </button>
                                                            <button
                                                                onClick={() => sendWaitlistToBooking(b)}
                                                                className={`h-10 px-3 rounded-lg flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all ${b.status === 'waitlist' ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-amber-50 hover:text-amber-700'}`}
                                                            >
                                                                <Bell size={14} /> {b.status === 'waitlist' ? 'Notify' : 'Waitlist'}
                                                            </button>
                                                            {(b.status === 'pending' || b.status === 'waitlist') && (
                                                                <>
                                                                    <button onClick={() => approveBooking(b)} className="h-10 px-3 rounded-lg bg-[#39FF14] text-black flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:brightness-95 transition-all">
                                                                        <Check size={15} strokeWidth={3} /> Approve
                                                                    </button>
                                                                    <button onClick={() => updateBooking(b.id, { status: 'declined' })} className="h-10 w-10 rounded-lg bg-white border border-neutral-200 flex items-center justify-center text-red-500 hover:bg-red-50 transition-all">
                                                                        <X size={16} strokeWidth={3} />
                                                                    </button>
                                                                </>
                                                            )}
                                                            <button onClick={() => setConfirmDialog({
                                                                eyebrow: 'Booking Record',
                                                                title: 'Remove this booking?',
                                                                body: 'This deletes the record from your workspace. Client profiles and other bookings stay untouched.',
                                                                actionLabel: 'Remove',
                                                                onConfirm: () => deleteBooking(b.id)
                                                            })} className="h-10 w-10 rounded-lg flex items-center justify-center text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                        {bookingRangeDialogOpen && (
                            <div className="fixed inset-0 z-[1200] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
                                <div className="w-full sm:max-w-lg rounded-t-[1.5rem] sm:rounded-[1.25rem] bg-white border border-neutral-100 shadow-2xl p-5 sm:p-6">
                                    <div className="flex items-start justify-between gap-4 mb-5">
                                        <div>
                                            <p className="text-[9px] font-bold uppercase text-neutral-400 mb-2">Custom timeframe</p>
                                            <h3 className="text-2xl font-bold tracking-tight text-black">Choose booking dates</h3>
                                            <p className="text-sm text-neutral-500 mt-2">Show only bookings inside this date range.</p>
                                        </div>
                                        <button type="button" onClick={() => setBookingRangeDialogOpen(false)} className="w-10 h-10 rounded-full bg-neutral-50 border border-neutral-100 flex items-center justify-center text-neutral-500 hover:text-black">
                                            <X size={16} />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                                        <label>
                                            <span className="block text-[9px] font-bold uppercase text-neutral-400 mb-2">From</span>
                                            <input
                                                type="date"
                                                value={bookingCustomRange.from}
                                                onChange={(event) => setBookingCustomRange(prev => ({ ...prev, from: event.target.value, to: prev.to && prev.to >= event.target.value ? prev.to : event.target.value }))}
                                                className="w-full h-12 rounded-lg bg-neutral-50 border border-neutral-100 px-4 text-sm font-bold text-black outline-none focus:bg-white focus:border-black"
                                            />
                                        </label>
                                        <label>
                                            <span className="block text-[9px] font-bold uppercase text-neutral-400 mb-2">To</span>
                                            <input
                                                type="date"
                                                value={bookingCustomRange.to}
                                                min={bookingCustomRange.from}
                                                onChange={(event) => setBookingCustomRange(prev => ({ ...prev, to: event.target.value }))}
                                                className="w-full h-12 rounded-lg bg-neutral-50 border border-neutral-100 px-4 text-sm font-bold text-black outline-none focus:bg-white focus:border-black"
                                            />
                                        </label>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button type="button" onClick={() => setBookingRangeDialogOpen(false)} className="h-12 rounded-full bg-white border border-neutral-200 text-black text-[10px] font-bold uppercase">
                                            Cancel
                                        </button>
                                        <button type="button" onClick={() => { setBookingDeskPeriod('custom'); setBookingRangeDialogOpen(false); }} className="h-12 rounded-full native-gradient-button text-black text-[10px] font-bold uppercase">
                                            Save Range
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    )}

                </div>
                </div>
            );
        }
