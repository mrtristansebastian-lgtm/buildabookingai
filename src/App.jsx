import { lazy, Suspense, startTransition, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import {
    AlignCenter, AlignLeft, AlignRight, ArrowRight, Battery, Bell, BookOpen, BookOpenCheck, Briefcase, BriefcaseBusiness, Calendar, CalendarCheck, CalendarDays, Camera, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, CreditCard, Crop, DollarSign, Eye, FileText, Globe, GripVertical, HeartHandshake, HelpCircle, History, Home, Hourglass, ImagePlus, Images, Inbox, Info, Instagram, Layers, Layout, LayoutDashboard, Mail, MessageCircle, MessageSquare, MessagesSquare, Monitor, MousePointerClick, Paintbrush, Palette, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Phone, Pipette, Plus, RefreshCw, Search, Settings2, Share2, ShieldCheck, Signal, SlidersHorizontal, Sparkles, Star, Tag, Trash2, Type, User, Users, UsersRound, Wifi, X, Zap
} from 'lucide-react';
import { BuildABookingBrand, BuildABookingMark } from './components/BuildABookingBrand';
import { EmailNotificationSettings } from './components/EmailNotificationSettings';
import { LandingFeatureBook } from './components/LandingFeatureBook';
import { LandingPaymentRail } from './components/LandingPaymentRail';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { ProButton } from './components/ProButton';
import { FONT_OPTIONS, getFontFamily } from './data/fonts';
import { createJumpGuestWorkspace } from './data/guestWorkspace/jumpStudios';
import * as FirebaseSDK from './services/firebase';
import { appId, auth, db, functions, initialAuthToken, isFirebaseConfigured, storage } from './services/firebase';
import { createDefaultEmailConfig, sendClientEmail } from './services/email';
import { drainClientErrorQueue, reportClientError } from './services/errorReporting';
import {
  GOOGLE_CALENDAR_EVENTS_SCOPE,
  syncConfirmedBookingsToGoogleCalendar
} from './services/googleCalendar';
import {
  getBrowserNotificationPermission,
  makeClientNotification,
  makeOwnerNotification,
  formatNotificationTime,
  notificationEmailKey,
  requestBrowserNotificationPermission,
  showBrowserNotification,
  NOTIFICATION_TYPES
} from './services/notifications';
import { getLocalDateStr } from './utils/dates';
import { buildBookingSlug } from './utils/slugs';
import { formatServiceDuration, formatServicePrice, normalizeServiceList, summarizeService } from './utils/services';
import { hexToRgb, mixHexColors, normalizeHexColor, readableTextFor, THEME_FILTER_GROUPS } from './utils/theme';

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

const ServicesStudio = lazy(() => (
  import('./components/ServicesStudio').then((module) => ({ default: module.ServicesStudio }))
));

const FinancePaymentSettings = lazy(() => (
  import('./components/FinancePaymentSettings').then((module) => ({ default: module.FinancePaymentSettings }))
));

const MigrationImportPanel = lazy(() => (
  import('./components/FinancePaymentSettings').then((module) => ({ default: module.MigrationImportPanel }))
));

const RunningPersonIcon = ({ size = 14, strokeWidth = 2.6, ...props }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
    >
        <circle cx="14" cy="4.5" r="2" />
        <path d="m11.8 8.2 4.2 2.2 2.3-2.2" />
        <path d="m13.3 10.1-2.6 3.7 3.6 2.2 1.9 3.8" />
        <path d="m10.6 13.8-3.2 1.1-2 3" />
        <path d="M7 7.8h4.4" />
    </svg>
);

const bookingPaymentFilterOptions = [
    ['all', 'All payments'],
    ['paid', 'Paid'],
    ['open', 'Pending'],
    ['cash', 'Cash'],
    ['card', 'Card'],
    ['eft', 'Manual EFT']
];

const bookingSortOptions = [
    ['newest', 'Newest first'],
    ['oldest', 'Oldest first'],
    ['amount-high', 'Amount high'],
    ['amount-low', 'Amount low'],
    ['client', 'Client A-Z'],
    ['service', 'Service A-Z']
];

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

const IMAGE_CROP_RATIOS = {
  square: { ratio: '1 / 1', width: 900, height: 900 },
  banner: { ratio: '16 / 7', width: 1600, height: 700 },
  gallery: { ratio: '4 / 3', width: 1200, height: 900 },
  wide: { ratio: '16 / 9', width: 1600, height: 900 }
};

const loadImageForCrop = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});

const buildCroppedImageFile = async (crop) => {
  const preset = IMAGE_CROP_RATIOS[crop?.ratioKey || 'square'] || IMAGE_CROP_RATIOS.square;
  const image = await loadImageForCrop(crop.source);
  const canvas = document.createElement('canvas');
  canvas.width = preset.width;
  canvas.height = preset.height;
  const ctx = canvas.getContext('2d');
  const zoom = Math.max(1, Number(crop.zoom || 1));
  const positionX = Math.max(0, Math.min(100, Number(crop.positionX ?? 50)));
  const positionY = Math.max(0, Math.min(100, Number(crop.positionY ?? 50)));
  const coverScale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight) * zoom;
  const drawWidth = image.naturalWidth * coverScale;
  const drawHeight = image.naturalHeight * coverScale;
  const offsetX = Math.max(0, drawWidth - canvas.width) * (positionX / 100);
  const offsetY = Math.max(0, drawHeight - canvas.height) * (positionY / 100);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, -offsetX, -offsetY, drawWidth, drawHeight);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  if (!blob) throw new Error('Could not crop image.');
  const cleanName = String(crop.fileName || 'image.jpg').replace(/\.[a-z0-9]+$/i, '');
  return new File([blob], `${cleanName || 'image'}-cropped.jpg`, { type: 'image/jpeg' });
};

const ImageCropModal = ({ crop, saving, onChange, onClose, onSave }) => {
  const dragStateRef = useRef(null);

  if (!crop) return null;

  const preset = IMAGE_CROP_RATIOS[crop.ratioKey || 'square'] || IMAGE_CROP_RATIOS.square;
  const clampPercent = (value) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 50));
  const currentZoom = Math.max(1, Number(crop.zoom || 1));
  const currentPositionX = clampPercent(Number(crop.positionX ?? 50));
  const currentPositionY = clampPercent(Number(crop.positionY ?? 50));
  const handleDragStart = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      positionX: currentPositionX,
      positionY: currentPositionY,
      width: rect.width || 1,
      height: rect.height || 1,
      zoom: currentZoom
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };
  const handleDragMove = (event) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const dragSensitivity = 100 / Math.max(dragState.zoom, 1);
    const nextPositionX = clampPercent(dragState.positionX - ((event.clientX - dragState.startX) / dragState.width) * dragSensitivity);
    const nextPositionY = clampPercent(dragState.positionY - ((event.clientY - dragState.startY) / dragState.height) * dragSensitivity);
    onChange({ positionX: nextPositionX, positionY: nextPositionY });
    event.preventDefault();
  };
  const handleDragEnd = (event) => {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null;
    }
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  return (
    <div className="image-crop-overlay" role="dialog" aria-modal="true">
      <div className="image-crop-sheet">
        <div className="image-crop-head">
          <div>
            <p>Image crop</p>
            <h3>{crop.title || 'Crop image'}</h3>
            <span>Position the image once, then save it cleanly across the app.</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close cropper">
            <X size={18} />
          </button>
        </div>
        <div className="image-crop-body">
          <div className="image-crop-preview">
            <div
              className={`image-crop-frame ${crop.shape === 'circle' ? 'is-circle' : ''}`}
              style={{ aspectRatio: preset.ratio }}
              role="group"
              aria-label="Drag image to reposition crop"
              onPointerDown={handleDragStart}
              onPointerMove={handleDragMove}
              onPointerUp={handleDragEnd}
              onPointerCancel={handleDragEnd}
            >
              <img
                src={crop.source}
                alt=""
                style={{
                  objectPosition: `${currentPositionX}% ${currentPositionY}%`,
                  transform: `scale(${currentZoom})`,
                  transformOrigin: `${currentPositionX}% ${currentPositionY}%`
                }}
              />
            </div>
          </div>
          <div className="image-crop-controls">
            <div className="image-crop-guidance">
              <MousePointerClick size={18} />
              <div>
                <strong>Drag to position</strong>
                <span>Move the image inside the frame, then zoom until it feels right.</span>
              </div>
            </div>
            <label className="image-crop-zoom-control">
              <span>Zoom</span>
              <input
                type="range"
                min={1}
                max={2.2}
                step={0.01}
                value={currentZoom}
                onChange={(event) => onChange({ zoom: Number(event.target.value) })}
              />
            </label>
            <div className="image-crop-actions">
              <button type="button" onClick={onClose} disabled={saving}>Cancel</button>
              <button type="button" onClick={onSave} disabled={saving}>
                <Crop size={15} /> {saving ? 'Saving...' : 'Save Crop'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const getPublicBookingSlug = () => {
  const url = new URL(window.location.href);
  const querySlug = url.searchParams.get('book') || url.searchParams.get('workspace');
  if (querySlug) return querySlug.trim().toLowerCase();
  const hashBookMatch = url.hash.match(/^#\/book\/([^/?#]+)/i);
  if (hashBookMatch?.[1]) return decodeURIComponent(hashBookMatch[1]).trim().toLowerCase();
  const [, section, slug] = url.pathname.split('/');
  if (section === 'book' && slug) return slug.trim().toLowerCase();
  return '';
};

const logoAlignmentOptions = [
  { id: 'left', label: 'Left', icon: AlignLeft },
  { id: 'center', label: 'Center', icon: AlignCenter },
  { id: 'right', label: 'Right', icon: AlignRight }
];

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

const editorInterfaceLooks = {
  calendar: [
    { id: 'studio', label: 'Native Rail', note: 'App-like date rail with soft selected states.' },
    { id: 'classic', label: 'Planner Cards', note: 'Structured day cards with familiar rhythm.' },
    { id: 'editorial', label: 'Date Poster', note: 'Large-number editorial date selection.' },
    { id: 'compact', label: 'Ops Board', note: 'Tighter board for high-volume availability.' },
    { id: 'glow', label: 'Signal Glow', note: 'High-confidence accent state for bold brands.' }
  ],
  time: [
    { id: 'pill', label: 'Native Pills', note: 'Friendly rounded slots with mobile polish.' },
    { id: 'blocks', label: 'Session Blocks', note: 'Strong tiles for classes, consults, and rooms.' },
    { id: 'minimal', label: 'Quiet Lines', note: 'Refined line-list for calm premium pages.' },
    { id: 'luxury', label: 'Gallery Slots', note: 'Spacious boutique time selection.' },
    { id: 'compact', label: 'Fast Grid', note: 'Dense scheduling for many open times.' }
  ],
  faq: [
    { id: 'accordion', label: 'Clean Accordion', note: 'Modern expandable help with tight rhythm.' },
    { id: 'cards', label: 'Trust Cards', note: 'Soft answer cards that feel reassuring.' },
    { id: 'minimal', label: 'Policy Lines', note: 'Crisp divider style for refined brands.' },
    { id: 'numbered', label: 'Guided Steps', note: 'Numbered help for prep and policies.' },
    { id: 'split', label: 'Editorial Guide', note: 'Magazine-like question and answer layout.' }
  ],
  venue: [
    { id: 'mosaic', label: 'Mosaic Wall', note: 'Polished gallery wall with a hero image.' },
    { id: 'editorial', label: 'Magazine Lead', note: 'Large lead image with designer pacing.' },
    { id: 'filmstrip', label: 'Mobile Reel', note: 'Horizontal swipe gallery for phone-first pages.' },
    { id: 'postcard', label: 'Postcards', note: 'Framed venue moments with personality.' },
    { id: 'minimal', label: 'Grid System', note: 'Sharp modern grid with quiet spacing.' }
  ],
  maps: [
    { id: 'button', label: 'Map Button', note: 'A single directions button.' },
    { id: 'card', label: 'Address Card', note: 'Shows address and directions together.' },
    { id: 'footer', label: 'Footer Link', note: 'Quiet link below the booking action.' },
    { id: 'dock', label: 'Map Dock', note: 'Compact icon-style location control.' },
    { id: 'none', label: 'Hidden', note: 'Keep maps off the booking page.' }
  ],
  social: [
    { id: 'icons', label: 'Icon Row', note: 'Clean round social icons.' },
    { id: 'labels', label: 'Icon Labels', note: 'Social buttons with names.' },
    { id: 'dock', label: 'Footer Dock', note: 'Compact app-like social footer.' },
    { id: 'minimal', label: 'Text Links', note: 'Quiet links for refined pages.' },
    { id: 'solid', label: 'Solid Chips', note: 'More visible branded social buttons.' }
  ]
};

const defaultFaqItems = [
  { q: 'How do I know my booking is confirmed?', a: 'You will see a confirmation on this page and receive a message when the business approves your request.' },
  { q: 'Can I join a waitlist if the day is full?', a: 'Yes. If waitlist is enabled, you can leave your details and the business can contact you when a slot opens.' }
];

const themePaletteLabel = (paletteId) => (
  THEME_FILTER_GROUPS.find(group => group.id === 'palette')?.filters.find(filter => filter.id === paletteId)?.name || 'brand'
);

const fontStylePresets = [
  {
    id: 'native',
    label: 'Native',
    note: 'Build A Booking modern',
    fontFamily: 'figtree',
    headingFontFamily: 'plus-jakarta',
    bodyFontFamily: 'figtree',
    buttonFontFamily: 'space-grotesk',
    slotFontFamily: 'plus-jakarta',
    dateFontFamily: 'plus-jakarta',
    headingLetterSpacing: 0,
    subtextLetterSpacing: 0
  },
  {
    id: 'studio',
    label: 'Studio',
    note: 'Creative sans',
    fontFamily: 'outfit',
    headingFontFamily: 'outfit',
    bodyFontFamily: 'dm-sans',
    buttonFontFamily: 'outfit',
    slotFontFamily: 'dm-sans',
    dateFontFamily: 'outfit',
    headingLetterSpacing: 0,
    subtextLetterSpacing: 0
  },
  {
    id: 'boutique',
    label: 'Boutique',
    note: 'Soft premium',
    fontFamily: 'manrope',
    headingFontFamily: 'bricolage',
    bodyFontFamily: 'manrope',
    buttonFontFamily: 'manrope',
    slotFontFamily: 'manrope',
    dateFontFamily: 'bricolage',
    headingLetterSpacing: 0,
    subtextLetterSpacing: 0.2
  },
  {
    id: 'impact',
    label: 'Impact',
    note: 'Confident brand',
    fontFamily: 'urbanist',
    headingFontFamily: 'urbanist',
    bodyFontFamily: 'figtree',
    buttonFontFamily: 'space-grotesk',
    slotFontFamily: 'space-grotesk',
    dateFontFamily: 'urbanist',
    headingLetterSpacing: 0,
    subtextLetterSpacing: 0
  },
  {
    id: 'friendly',
    label: 'Friendly',
    note: 'Warm modern',
    fontFamily: 'figtree',
    headingFontFamily: 'lexend',
    bodyFontFamily: 'figtree',
    buttonFontFamily: 'figtree',
    slotFontFamily: 'lexend',
    dateFontFamily: 'lexend',
    headingLetterSpacing: 0,
    subtextLetterSpacing: 0
  },
  {
    id: 'precision',
    label: 'Precision',
    note: 'Tech calm',
    fontFamily: 'ibm-plex-sans',
    headingFontFamily: 'space-grotesk',
    bodyFontFamily: 'ibm-plex-sans',
    buttonFontFamily: 'ibm-plex-sans',
    slotFontFamily: 'ibm-plex-sans',
    dateFontFamily: 'space-grotesk',
    headingLetterSpacing: 0,
    subtextLetterSpacing: 0.4
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

const createDefaultSettings = () => ({
  slug: 'your-business',
  brandName: 'Your Business',
  welcomeMessage: 'Reserve your session.',
  tagline: 'Online bookings',
  primaryColor: '#050505',
  headingColor: '#000000',
  bodyColor: '#666666',
  backgroundColor: '#ffffff',
  slotBgColor: '#F8FAFC',
  slotTextColor: '#000000',
  dateBgColor: 'transparent',
  dateTextColor: '#666666',
  dateActiveBgColor: '#050505',
  dateActiveTextColor: '#ffffff',
  buttonTextColor: '#ffffff',
  fontFamily: 'inter',
  nativeAccent: true,
  editorPaletteFlowColor: 'blue',
  editorColorDepth: 50,
  editorColorDepths: {},
  editorColorMix: ['blue'],
  headingFontFamily: '',
  bodyFontFamily: '',
  buttonFontFamily: '',
  slotFontFamily: '',
  dateFontFamily: '',
  brandNameSize: 76,
  brandNameFontFamily: '',
  taglineSize: 9,
  taglineFontFamily: '',
  welcomeSize: 20,
  welcomeFontFamily: '',
  buttonStyle: 'pill',
  availabilityStyle: 'solid',
  dateStyle: 'solid',
  timeSlotStyle: 'solid',
  actionButtonStyle: 'solid',
  calendarDisplayStyle: 'studio',
  timeDisplayStyle: 'pill',
  serviceDropdownEnabled: false,
  serviceBorderStyle: 'solid',
  faqStyle: 'minimal',
  faqDisplayStyle: 'accordion',
  faqBgColor: 'transparent',
  faqBorderColor: '#00000020',
  faqTextColor: '',
  faqAnswerColor: '',
  faqFontFamily: '',
  venueGalleryStyle: 'mosaic',
  venueTitle: 'Inside the space',
  venueIntro: 'See the place before you book.',
  mapDisplayStyle: 'card',
  socialIconStyle: 'outline',
  socialDisplayStyle: 'icons',
  socialPlacement: 'footer',
  socialIconBgColor: 'transparent',
  socialIconColor: '',
  socialIconTextColor: '',
  dateLabel: 'Which day are you looking to book ?',
  timeLabel: 'Lets see what time works',
  buttonText: 'Book Now',
  confirmButtonText: 'Confirm Booking',
  detailsHeading: 'Your Details',
  detailsSubHeading: 'Secure Your Slot',
  successHeading: 'Booking Confirmed!',
  availableTimes: ['09:00', '10:30', '12:00', '14:30', '16:00', '17:30'],
  schedule: {},
  staffCalendars: {},
  googleCalendar: { mode: 'manual-sync', connectedEmail: '', connectedAt: 0, lastSyncedAt: 0, lastSyncCount: 0 },
  features: { birthday: true, waitlist: true, socialProof: true, loadingScreen: true, firstAvailable: true, collectClientName: true, collectClientPhone: true, collectClientEmail: true, collectClientNotes: false, emailUpdates: true, faqEnabled: false, socialLinks: false, location: '', faqs: [] },
  accountProfiles: {},
  themeTemplates: [],
  serviceIndustry: '',
  services: [],
  logoDisplay: { visible: true, alignment: 'left', size: 96 },
  bannerDisplay: { visible: true, height: 220, position: 'center', placement: 'hero', opacity: 100 },
  logo: '',
  bannerImage: '',
  venuePhotos: [],
  address: '',
  socials: { instagram: '', tiktok: '', facebook: '', website: '' }
});

const createGuestDemoWorkspace = () => createJumpGuestWorkspace({
  createDefaultSettings,
  createDefaultCommunications,
  getLocalDateStr
});
const clampNumber = (value, min, max, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const getLogoDisplay = (settings = {}) => {
  const logoDisplay = settings.logoDisplay || {};
  const size = Number(logoDisplay.size);
  const placement = ['title', 'top', 'badge'].includes(logoDisplay.placement) ? logoDisplay.placement : 'title';
  return {
    visible: logoDisplay.visible !== false,
    alignment: logoAlignmentOptions.some(option => option.id === logoDisplay.alignment) ? logoDisplay.alignment : 'left',
    placement,
    size: Number.isFinite(size) ? Math.min(176, Math.max(48, size)) : 96
  };
};

const parseAmountToCents = (value) => {
  const normalized = String(value || '')
    .replace(/[^0-9.,-]/g, '')
    .replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
};

const dateValueToMs = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value?.toMillis) return value.toMillis();
  if (value?.seconds) return value.seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatDashboardMoney = (amountInCents = 0, currency = 'ZAR') => {
  const code = /^[A-Z]{3}$/.test(String(currency || '').toUpperCase()) ? String(currency).toUpperCase() : 'ZAR';
  const amount = Math.max(0, Math.round(Number(amountInCents) || 0)) / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: amount % 1 ? 2 : 0
    }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(amount % 1 ? 2 : 0)}`;
  }
};

const getBannerDisplay = (settings = {}) => {
  const bannerDisplay = settings.bannerDisplay || {};
  const height = Number(bannerDisplay.height);
  const opacity = Number(bannerDisplay.opacity);
  const position = ['top', 'center', 'bottom'].includes(bannerDisplay.position) ? bannerDisplay.position : 'center';
  const placement = ['hero', 'top', 'footer'].includes(bannerDisplay.placement) ? bannerDisplay.placement : 'hero';
  return {
    visible: bannerDisplay.visible !== false,
    placement,
    height: Number.isFinite(height) ? Math.min(360, Math.max(120, height)) : 220,
    opacity: Number.isFinite(opacity) ? Math.min(100, Math.max(15, opacity)) : 100,
    position,
    objectPosition: position === 'top' ? 'center top' : position === 'bottom' ? 'center bottom' : 'center center'
  };
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
      sample: 'Your Business',
      min: -4,
      max: 8
    },
    {
      key: 'subtextLetterSpacing',
      label: 'Subtext Space',
      note: 'Tagline and welcome copy below the heading.',
      sample: 'Reserve your session.',
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

function InterfaceLookGrid({ value, onChange, looks = [], label = 'Display look', children }) {
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
              <i className="cinema-look-preview" data-look={look.id} aria-hidden="true">
                <b />
                <b />
                <b />
                <b />
                <b />
                <b />
              </i>
              <span>{look.label}</span>
            </button>
          );
        })}
      </div>
      {children && <div className="cinema-look-picker-footer">{children}</div>}
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
const editorDraftStoragePrefix = 'build-a-booking-editor-draft-v2';
const editorDraftVersionsStoragePrefix = 'build-a-booking-editor-draft-versions-v1';
const bookingsCacheStoragePrefix = 'build-a-booking-bookings-cache-v1';
const workspaceTabIds = ['overview', 'bookings', 'business', 'communications', 'editor', 'services', 'finance', 'clients', 'staff', 'profile'];
const workspaceTabAliases = {
  schedule: 'business',
  calendar: 'business',
  team: 'staff',
  'my-clients': 'clients',
  support: 'communications',
  inbox: 'communications',
  'support-inbox': 'communications',
  'my-services': 'services',
  payments: 'finance'
};
const editorTabIds = ['identity', 'themes', 'visuals', 'features', 'copy'];
const landingStopActions = [
  'manual booking management',
  'using confusing business tools',
  'losing bookings in DMs',
  'back-and-forth staff schedule messages',
  'clients hoping a slot is free',
  'explaining services in every chat',
  'manually checking who paid',
  'messy client records',
  'late reschedule chaos',
  'running your studio on memory'
];

const landingGainActions = [
  'booking page collects requests for you',
  'dashboard keeps every tool in one place',
  'inbox connects messages to bookings',
  'team schedules show bookings clearly',
  'live availability updates automatically',
  'service menu shows price and duration',
  'finance tracks paid and pending income',
  'client directory stores details, even birthdays',
  'reschedule tools keep changes controlled',
  'timeline stores clients, chats, and payments'
];

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

const getEditorDraftKey = (ownerId = 'guest') => (
  `${editorDraftStoragePrefix}-${String(ownerId || 'guest').replace(/[^a-zA-Z0-9_-]/g, '-')}`
);

const readEditorDraft = (ownerId) => {
  const draft = safeJsonParse(safeLocalGet(getEditorDraftKey(ownerId)));
  if (!draft || typeof draft !== 'object' || !draft.settings) return null;
  return draft;
};

const writeEditorDraft = (ownerId, payload = {}) => {
  const settingsPayload = payload.settings || {};
  const draft = {
    version: 3,
    status: payload.status || 'autosaved',
    name: payload.name || 'Working Draft',
    savedAt: Date.now(),
    ...payload,
    settings: {
      ...settingsPayload,
      // Local drafts should not keep changing their own fingerprint only because sync metadata moved.
      updatedAt: settingsPayload.updatedAt || 0,
      draftAutosavedAt: settingsPayload.draftAutosavedAt || 0
    }
  };
  return safeLocalSet(getEditorDraftKey(ownerId), JSON.stringify(draft));
};

const clearEditorDraft = (ownerId) => {
  safeLocalRemove(getEditorDraftKey(ownerId));
};

const getEditorDraftVersionsKey = (ownerId = 'guest') => (
  `${editorDraftVersionsStoragePrefix}-${String(ownerId || 'guest').replace(/[^a-zA-Z0-9_-]/g, '-')}`
);

const clearEditorDraftVersions = (ownerId) => {
  safeLocalRemove(getEditorDraftVersionsKey(ownerId));
};

const readEditorDraftVersions = (ownerId) => {
  const versions = safeJsonParse(safeLocalGet(getEditorDraftVersionsKey(ownerId)), []);
  if (!Array.isArray(versions)) return [];
  return versions
    .filter(version => version && typeof version === 'object' && version.settings)
    .sort((a, b) => Number(b.savedAt || 0) - Number(a.savedAt || 0))
    .slice(0, 12);
};

const writeEditorDraftVersions = (ownerId, versions = []) => {
  const nextVersions = Array.isArray(versions)
    ? versions
      .filter(version => version && typeof version === 'object' && version.settings)
      .sort((a, b) => Number(b.savedAt || 0) - Number(a.savedAt || 0))
      .slice(0, 12)
    : [];
  return safeLocalSet(getEditorDraftVersionsKey(ownerId), JSON.stringify(nextVersions));
};

const formatEditorVersionTime = (timestamp) => {
  if (!timestamp) return 'Not saved yet';
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(timestamp));
  } catch {
    return 'Saved version';
  }
};

const getBookingsCacheKey = (ownerId = 'guest') => (
  `${bookingsCacheStoragePrefix}-${String(ownerId || 'guest').replace(/[^a-zA-Z0-9_-]/g, '-')}`
);

const readBookingsCache = (ownerId) => {
  const cached = safeJsonParse(safeLocalGet(getBookingsCacheKey(ownerId)));
  if (!cached || typeof cached !== 'object' || !Array.isArray(cached.bookings)) return null;
  return cached;
};

const writeBookingsCache = (ownerId, bookings = []) => {
  if (!ownerId || !Array.isArray(bookings)) return false;
  const cached = {
    version: 1,
    savedAt: Date.now(),
    bookings: bookings.slice(0, 250)
  };
  return safeLocalSet(getBookingsCacheKey(ownerId), JSON.stringify(cached));
};

const stableSettingsFingerprint = (settings = {}) => {
  const { updatedAt, draftAutosavedAt, draftSavedAt, draftStatus, draftName, publishedAt, ...stable } = settings || {};
  try {
    return JSON.stringify(stable);
  } catch {
    return '';
  }
};

const stripEditorDraftFields = (settings = {}) => {
  const {
    draftAutosavedAt,
    draftSavedAt,
    draftStatus,
    draftName,
    ...publishableSettings
  } = settings || {};
  return publishableSettings;
};

const buildEditorDraftPayload = (settings = {}, payload = {}) => {
  const savedAt = payload.savedAt || Date.now();
  return {
    version: 3,
    status: payload.status || 'autosaved',
    name: payload.name || settings.draftName || 'Working Draft',
    route: payload.route || null,
    editorStudioScene: payload.editorStudioScene || '',
    savedAt,
    updatedAt: savedAt,
    settings: {
      ...settings,
      draftStatus: payload.status || 'autosaved',
      draftName: payload.name || settings.draftName || 'Working Draft',
      draftAutosavedAt: savedAt,
      draftSavedAt: savedAt,
      // Keep live/published timestamps stable while someone is experimenting.
      updatedAt: settings.updatedAt || 0
    }
  };
};

const buildPublicBookingIdempotencyKey = ({ workspaceSlug, formData = {}, dateKey, date, time, serviceId }) => {
  const identity = normalizeEmail(formData.email || '') || String(formData.phone || formData.name || 'guest').trim().toLowerCase();
  return [
    workspaceSlug || 'workspace',
    identity || 'client',
    serviceId || formData.serviceId || 'service',
    dateKey || date || 'date',
    time || 'time'
  ]
    .join('|')
    .replace(/[^a-zA-Z0-9|@._:-]/g, '-')
    .slice(0, 180);
};

const normalizeWorkspaceRoute = (route = {}, fallback = {}) => {
  const source = route || {};
  const requestedView = source.view || source.return || source.returnTarget;
  const nextView = ['dashboard', 'client', 'landing'].includes(requestedView)
    ? requestedView
    : fallback.view || 'landing';
  const requestedTab = workspaceTabAliases[source.activeTab || source.tab] || source.activeTab || source.tab;
  const nextActiveTab = workspaceTabIds.includes(requestedTab)
    ? requestedTab
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

const shouldStartInGuestWorkspace = (route = {}) => (
  safeLocalGet(guestModeStorageKey) === 'true' ||
  (route.view === 'dashboard' && !getPublicBookingSlug())
);

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

const hasFreshAuthRedirectStart = () => {
  const startedAt = Number(safeSessionGet(authRedirectStartedStorageKey) || safeLocalGet(authRedirectStartedStorageKey) || 0);
  if (!startedAt) return false;
  if (Date.now() - startedAt <= 10 * 60 * 1000) return true;
  clearAuthReturnState();
  clearGoogleAuthIntentUrl();
  safeSessionRemove(googleCalendarRedirectStorageKey);
  return false;
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
              const initialGuestWorkspaceRef = useRef(null);
              const startsInGuestWorkspace = shouldStartInGuestWorkspace(initialWorkspaceRoute);
              const getInitialGuestWorkspace = () => {
                if (!startsInGuestWorkspace) return null;
                if (!initialGuestWorkspaceRef.current) {
                  initialGuestWorkspaceRef.current = createGuestDemoWorkspace();
                }
                return initialGuestWorkspaceRef.current;
              };
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
                hasFreshAuthRedirectStart()
            ));
            const [guestMode, setGuestMode] = useState(() => {
                return startsInGuestWorkspace;
            });
            const [clientGuestMode, setClientGuestMode] = useState(false);
            const [publicSlug, setPublicSlug] = useState(getPublicBookingSlug);
            const [publicWorkspace, setPublicWorkspace] = useState(null);
            const [publicManualPaymentOptions, setPublicManualPaymentOptions] = useState([]);
            const [publicLoading, setPublicLoading] = useState(false);
            const [publicError, setPublicError] = useState('');
            const [publicReloadKey, setPublicReloadKey] = useState(0);
            const [activeTab, setActiveTab] = useState(initialWorkspaceRoute.activeTab);
            const [dashboardPeriod, setDashboardPeriod] = useState('today');
            const [editorTab, setEditorTab] = useState(initialWorkspaceRoute.editorTab);
            const [editorStudioModal, setEditorStudioModal] = useState(null);
            const editorStudioAudioRef = useRef(null);
            const [editorStudioScene, setEditorStudioScene] = useState('introduction');
            const editorStudioSoundEnabled = true;
            const [themeFilters, setThemeFilters] = useState({ palette: '', industry: '', style: 'all-styles' });
            const themeTemplateName = '';
            const [detectedThemePalette, setDetectedThemePalette] = useState('');
            const [detectedThemeStyle, setDetectedThemeStyle] = useState('');
            const customThemeColor = '#755CFF';
            const [paletteDetecting, setPaletteDetecting] = useState(false);
            const [device, setDevice] = useState(() => (
                typeof window !== 'undefined' && window.matchMedia?.('(max-width: 767px)')?.matches ? 'mobile' : 'desktop'
            )); 
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
            const [mobileNavOpen, setMobileNavOpen] = useState(false);
            const [editorRoomNavOffset, setEditorRoomNavOffset] = useState({ x: 0, y: 0 });
            const [bookingDeskPeriod, setBookingDeskPeriod] = useState('all');
            const [bookingCustomRange, setBookingCustomRange] = useState(() => {
                const today = getLocalDateStr(new Date());
                return { from: today, to: today };
            });
            const [bookingRangeDialogOpen, setBookingRangeDialogOpen] = useState(false);
            const [bookingFilter, setBookingFilter] = useState('upcoming');
            const [bookingSearch, setBookingSearch] = useState('');
            const [bookingSort, setBookingSort] = useState('newest');
            const [bookingPaymentFilter, setBookingPaymentFilter] = useState('all');
            const [dashboardScheduleStaffId, setDashboardScheduleStaffId] = useState('all');
            const [dashboardScheduleView, setDashboardScheduleView] = useState('availability');
            const [dashboardFeedPages, setDashboardFeedPages] = useState({
                bookings: 0,
                chats: 0,
                schedule: 0,
                finance: 0
            });
            const [dashboardFeedPageSizes, setDashboardFeedPageSizes] = useState({
                bookings: 5,
                chats: 5,
                schedule: 5,
                finance: 5
            });
            const [dashboardFeedFilters, setDashboardFeedFilters] = useState({
                bookings: 'all',
                chats: 'all'
            });
            const [dashboardMobileTile, setDashboardMobileTile] = useState('bookings');
            const [profileNotificationFilter, setProfileNotificationFilter] = useState('all');
            const [profileSystemFilter, setProfileSystemFilter] = useState('all');
            const [bookingInfoDialog, setBookingInfoDialog] = useState(null);
            const [manualBookingOpen, setManualBookingOpen] = useState(false);
            const [manualBookingServiceId, setManualBookingServiceId] = useState('custom');
            const [clientRecords, setClientRecords] = useState(() => getInitialGuestWorkspace()?.clientRecords || []);
            const [clientSearch, setClientSearch] = useState('');
            const [clientDeskFilter, setClientDeskFilter] = useState('all');
            const [selectedClientId, setSelectedClientId] = useState(null);
            const [clientNoteDraft, setClientNoteDraft] = useState('');
            const [clientMobileView, setClientMobileView] = useState('directory');
            const [selectedStaffFileId, setSelectedStaffFileId] = useState(null);
            const [teamPanelMode, setTeamPanelMode] = useState('roster');
            const [activeProfileSection, setActiveProfileSection] = useState('');
            const [showOwnerManual, setShowOwnerManual] = useState(false);
            const [imageCropModal, setImageCropModal] = useState(null);
            const [imageCropSaving, setImageCropSaving] = useState(false);
            const [accountDeleteOpen, setAccountDeleteOpen] = useState(false);
            const [accountDeleteText, setAccountDeleteText] = useState('');
            const containerRef = useRef(null);
            const editorContentRef = useRef(null);
            const imageCropCommitRef = useRef(null);
            const scaleRef = useRef(1);
            const compactViewportRef = useRef(false);
            const settingsRef = useRef(null);
            const editorRoomNavDragRef = useRef(null);
            const editorDraftSaveTimerRef = useRef(0);
            const editorDraftCloudTimerRef = useRef(0);
            const editorDraftFlushRef = useRef(null);
            const editorDraftLastFingerprintRef = useRef('');
            const editorDraftCloudFingerprintRef = useRef('');
            const editorDraftRecoveredRef = useRef(false);
            const publishedSettingsSnapshotRef = useRef(null);
            const cloudEditorDraftRef = useRef(null);
            const guestDemoSeededRef = useRef(false);
            const [editorDraftVersions, setEditorDraftVersions] = useState([]);
            const [editorDraftNameInput, setEditorDraftNameInput] = useState('');
            const [editorLaunchPanel, setEditorLaunchPanel] = useState(null);
            const [toast, setToast] = useState(null);
            const [confirmDialog, setConfirmDialog] = useState(null);
            const [runningLateDialog, setRunningLateDialog] = useState(null);
            const [supportThreadFocus, setSupportThreadFocus] = useState(null);
            const [legalPanel, setLegalPanel] = useState(null);
            const [ownerNotifications, setOwnerNotifications] = useState([]);
            const [dashboardClientThreads, setDashboardClientThreads] = useState([]);
            const [guestNotificationReadIds, setGuestNotificationReadIds] = useState(() => new Set());
            const [browserNotificationPermission, setBrowserNotificationPermission] = useState(getBrowserNotificationPermission);
            const toastTimerRef = useRef(null);
            const unsavedWorkspaceChangesRef = useRef(false);
            const ownerNotificationSeenRef = useRef(new Set());
            const ownerNotificationsReadyRef = useRef(false);
            const dashboardTileTouchRef = useRef(null);
            
            const showToast = (msg) => {
                window.clearTimeout(toastTimerRef.current);
                setToast(msg);
                toastTimerRef.current = window.setTimeout(() => setToast(null), 4000);
            };
            const markWorkspaceDirty = () => {
                unsavedWorkspaceChangesRef.current = true;
            };
            const clearWorkspaceDirty = () => {
                unsavedWorkspaceChangesRef.current = false;
            };
            const confirmLeavingUnsavedChanges = () => {
                if (!unsavedWorkspaceChangesRef.current || typeof window === 'undefined') return true;
                const confirmed = window.confirm('Leave without saving?');
                if (confirmed) clearWorkspaceDirty();
                return confirmed;
            };
            const navigateWorkspaceTab = (nextTab, nextEditorTab) => {
                if (!nextTab) return false;
                if (nextTab !== activeTab && !confirmLeavingUnsavedChanges()) return false;
                setActiveTab(nextTab);
                if (nextEditorTab) setEditorTab(nextEditorTab);
                return true;
            };

            useEffect(() => () => window.clearTimeout(toastTimerRef.current), []);
            useEffect(() => () => window.clearTimeout(editorDraftSaveTimerRef.current), []);
            useEffect(() => () => window.clearTimeout(editorDraftCloudTimerRef.current), []);
            useEffect(() => () => editorRoomNavDragRef.current?.cleanup?.(), []);
            useEffect(() => {
                if (typeof window === 'undefined') return undefined;
                const confirmPageExit = (event) => {
                    if (!unsavedWorkspaceChangesRef.current) return;
                    event.preventDefault();
                    event.returnValue = '';
                };
                window.addEventListener('beforeunload', confirmPageExit);
                return () => window.removeEventListener('beforeunload', confirmPageExit);
            }, []);
            useEffect(() => {
                safeLocalRemove('build-a-booking-dashboard-theme');
            }, []);
            useEffect(() => {
                if (activeTab !== 'profile') setActiveProfileSection('');
                setMobileNavOpen(false);
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
                const mobileBrowserQuery = window.matchMedia('(max-width: 767px)');
                const syncRuntimeClass = () => {
                    root.classList.toggle('app-mobile-browser', !isNativeAppRuntime && mobileBrowserQuery.matches);
                };
                syncRuntimeClass();
                if (isNativeAppRuntime) {
                    root.classList.remove('app-idle', 'app-hidden', 'app-mobile-browser');
                    return () => {
                        root.classList.remove('app-idle', 'app-hidden', 'app-mobile-browser');
                    };
                }
                const idleDelay = mobileBrowserQuery.matches ? 12000 : 45000;
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
                if (mobileBrowserQuery.addEventListener) {
                    mobileBrowserQuery.addEventListener('change', syncRuntimeClass);
                } else {
                    mobileBrowserQuery.addListener(syncRuntimeClass);
                }

                handleVisibility();

                return () => {
                    window.clearTimeout(idleTimer);
                    root.classList.remove('app-idle', 'app-hidden', 'app-mobile-browser');
                    activityEvents.forEach(eventName => {
                        window.removeEventListener(eventName, resetIdle, passiveOptions);
                    });
                    document.removeEventListener('visibilitychange', handleVisibility);
                    window.removeEventListener('pagehide', pauseForPageHide);
                    window.removeEventListener('pageshow', resetIdle);
                    if (mobileBrowserQuery.removeEventListener) {
                        mobileBrowserQuery.removeEventListener('change', syncRuntimeClass);
                    } else {
                        mobileBrowserQuery.removeListener(syncRuntimeClass);
                    }
                };
            }, [isNativeAppRuntime]);

            const [settings, setSettings] = useState(() => getInitialGuestWorkspace()?.settings || createDefaultSettings());

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

            const [bookings, setBookings] = useState(() => getInitialGuestWorkspace()?.bookings || []);
            const [financeImports, setFinanceImports] = useState(() => getInitialGuestWorkspace()?.financeImports || []);
            const [financePaymentAttempts, setFinancePaymentAttempts] = useState([]);
            const [bookingsReady, setBookingsReady] = useState(() => Boolean(getInitialGuestWorkspace()) || !isFirebaseConfigured);
            const [staffList, setStaffList] = useState(() => getInitialGuestWorkspace()?.staffList || [{id: 'owner', name: 'Admin', color: '#39FF14'}]);
            const [accountProfileOverride, setAccountProfileOverride] = useState(() => getInitialGuestWorkspace()?.settings?.accountProfiles?.['guest-workspace'] || {});
            const [communications, setCommunications] = useState(() => getInitialGuestWorkspace()?.communications || createDefaultCommunications());
            const referralUrl = useMemo(() => `${window.location.origin}/ref/${user?.uid?.substring(0,6) || '10X'}`, [user?.uid]);
            const workspaceOwnerId = activeWorkspaceOwnerId || user?.uid || '';
            const isDashboardGuestPreview = view === 'dashboard';
            const isGuestWorkspace = Boolean((guestMode || isDashboardGuestPreview) && !user && !publicSlug);
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
            const workspaceChoices = useMemo(() => {
                if (!user) return [];
                return [
                    { ownerId: user.uid, workspaceName: settings.brandName || 'My Workspace', role: 'owner', ownerEmail: user.email || '' },
                    ...workspaceAccess
                ].filter((workspace, index, list) => list.findIndex(item => item.ownerId === workspace.ownerId) === index);
            }, [settings.brandName, user, workspaceAccess]);
            const editorDraftOwnerKey = workspaceOwnerId || user?.uid || (isGuestWorkspace ? 'guest' : 'local');
            const setBookingsAndCache = (updater) => {
                setBookings(prev => {
                    const nextBookings = typeof updater === 'function' ? updater(prev) : updater;
                    if (workspaceOwnerId && Array.isArray(nextBookings)) {
                        writeBookingsCache(workspaceOwnerId, nextBookings);
                    }
                    return nextBookings;
                });
            };
            const isEditorWorkspaceOpen = view === 'dashboard' && activeTab === 'editor';
            const bookingPageSlug = useMemo(
                () => buildBookingSlug(settings.slug || settings.brandName || settings.businessName || 'studio'),
                [settings.brandName, settings.businessName, settings.slug]
            );
            const bookingPageRoute = `#/book/${bookingPageSlug}`;
            const bookingPageUrl = useMemo(() => {
                if (typeof window === 'undefined') return bookingPageRoute;
                return `${window.location.origin}${window.location.pathname}${bookingPageRoute}`;
            }, [bookingPageRoute]);
            const resetWorkspaceRuntimeState = () => {
                publishedSettingsSnapshotRef.current = null;
                cloudEditorDraftRef.current = null;
                editorDraftRecoveredRef.current = false;
                editorDraftLastFingerprintRef.current = '';
                editorDraftCloudFingerprintRef.current = '';
                guestDemoSeededRef.current = false;
                ownerNotificationSeenRef.current = new Set();
                ownerNotificationsReadyRef.current = false;
                setSettings(createDefaultSettings());
                setCommunications(createDefaultCommunications());
                setBookings([]);
                setFinanceImports([]);
                setBookingsReady(true);
                setClientRecords([]);
                setStaffList([{ id: 'owner', name: 'Admin', color: '#39FF14' }]);
                setOwnerNotifications([]);
                setSupportThreadFocus(null);
                setSelectedClientId(null);
                setClientMobileView('directory');
                setSelectedStaffFileId(null);
            };

            useEffect(() => {
                if (publicSlug || loading || user || isGuestWorkspace) return;
                resetWorkspaceRuntimeState();
            }, [publicSlug, loading, user?.uid, guestMode, isGuestWorkspace]);

            useEffect(() => {
                if (!isEditorWorkspaceOpen || !editorDraftOwnerKey) return;
                if (isGuestWorkspace) {
                    setEditorDraftVersions([]);
                    setEditorDraftNameInput(settings.draftName || settings.brandName || 'Jump Studios');
                    return;
                }
                const versions = readEditorDraftVersions(editorDraftOwnerKey);
                setEditorDraftVersions(versions);
                setEditorDraftNameInput(current => current || settings.draftName || settings.brandName || 'Working Draft');
            }, [editorDraftOwnerKey, isEditorWorkspaceOpen, isGuestWorkspace, settings.brandName, settings.draftName]);

            useEffect(() => {
                if (!isGuestWorkspace) {
                    guestDemoSeededRef.current = false;
                    return;
                }
                if (loading) return;
                if (guestDemoSeededRef.current) return;

                clearEditorDraft('guest');
                clearEditorDraftVersions('guest');
                const demoWorkspace = initialGuestWorkspaceRef.current || createGuestDemoWorkspace();
                setSettings(demoWorkspace.settings);
                setBookings(demoWorkspace.bookings);
                setFinanceImports(demoWorkspace.financeImports || []);
                setBookingsReady(true);
                setStaffList(demoWorkspace.staffList);
                setClientRecords(demoWorkspace.clientRecords);
                setCommunications(demoWorkspace.communications);
                setAccountProfileOverride(demoWorkspace.settings.accountProfiles?.['guest-workspace'] || {});
                setEditorDraftVersions([]);
                setEditorDraftNameInput(demoWorkspace.settings.brandName || 'Jump Studios');
                guestDemoSeededRef.current = true;
            }, [isGuestWorkspace, loading]);

            useEffect(() => {
                if (publicSlug || isGuestWorkspace || !editorDraftOwnerKey || !isEditorWorkspaceOpen) return;
                const localDraft = readEditorDraft(editorDraftOwnerKey);
                if (!localDraft?.settings) return;
                const localDraftAgeMs = Date.now() - Number(localDraft.savedAt || 0);
                if (localDraftAgeMs > 1000 * 60 * 60 * 24 * 14) return;
                const remoteUpdatedAt = getTimestampValue(settingsRef.current?.updatedAt || settings.updatedAt);
                if (Number(localDraft.savedAt || 0) <= remoteUpdatedAt) return;
                setSettings(prev => mergeStateIfChanged(prev, localDraft.settings));
                if (localDraft.editorStudioScene) {
                    setEditorStudioScene(localDraft.editorStudioScene);
                }
                if (!editorDraftRecoveredRef.current) {
                    editorDraftRecoveredRef.current = true;
                    showToast('Recovered your latest editor draft on this device.');
                }
            }, [editorDraftOwnerKey, isEditorWorkspaceOpen, isGuestWorkspace, publicSlug]);

            useEffect(() => {
                if (publicSlug || isGuestWorkspace || !editorDraftOwnerKey || !isEditorWorkspaceOpen) {
                    editorDraftFlushRef.current = null;
                    return undefined;
                }
                const route = { view: 'dashboard', activeTab: 'editor', editorTab };
                const persistDraft = () => {
                    const draftPayload = buildEditorDraftPayload(settingsRef.current || settings, {
                        route,
                        editorStudioScene,
                        status: 'autosaved',
                        name: themeTemplateName || 'Working Draft'
                    });
                    writeEditorDraft(editorDraftOwnerKey, draftPayload);
                };
                editorDraftFlushRef.current = persistDraft;
                const fingerprint = JSON.stringify({
                    owner: editorDraftOwnerKey,
                    route,
                    scene: editorStudioScene,
                    settings: stableSettingsFingerprint(settings)
                });
                if (fingerprint === editorDraftLastFingerprintRef.current) return undefined;
                editorDraftLastFingerprintRef.current = fingerprint;
                window.clearTimeout(editorDraftSaveTimerRef.current);
                editorDraftSaveTimerRef.current = window.setTimeout(persistDraft, 400);
                return undefined;
            }, [editorDraftOwnerKey, editorStudioScene, editorTab, isEditorWorkspaceOpen, isGuestWorkspace, publicSlug, settings, themeTemplateName]);

            useEffect(() => {
                if (publicSlug || isGuestWorkspace || !isFirebaseConfigured || !db || !workspaceOwnerId || !canManageWorkspace || activeTab !== 'editor') return undefined;
                const fingerprint = stableSettingsFingerprint(settings);
                if (!fingerprint || fingerprint === editorDraftCloudFingerprintRef.current) return undefined;
                window.clearTimeout(editorDraftCloudTimerRef.current);
                editorDraftCloudTimerRef.current = window.setTimeout(async () => {
                    try {
                        const draftPayload = buildEditorDraftPayload(settingsRef.current || settings, {
                            route: { view, activeTab, editorTab },
                            editorStudioScene,
                            status: 'autosaved',
                            name: themeTemplateName || 'Working Draft'
                        });
                        await FirebaseSDK.setDoc(
                            FirebaseSDK.doc(db, 'artifacts', appId, 'users', workspaceOwnerId, 'config', 'editorDraft'),
                            draftPayload,
                            { merge: true }
                        );
                        editorDraftCloudFingerprintRef.current = stableSettingsFingerprint(draftPayload.settings);
                    } catch (error) {
                        console.warn('Editor cloud draft sync paused.', error);
                    }
                }, 7000);
                return undefined;
            }, [activeTab, canManageWorkspace, editorStudioScene, editorTab, isGuestWorkspace, publicSlug, settings, themeTemplateName, view, workspaceOwnerId]);

            useEffect(() => {
                const flushLocalDraft = () => {
                    editorDraftFlushRef.current?.();
                };
                const handleVisibility = () => {
                    if (document.visibilityState !== 'visible') flushLocalDraft();
                };
                document.addEventListener('visibilitychange', handleVisibility);
                window.addEventListener('pagehide', flushLocalDraft);
                window.addEventListener('beforeunload', flushLocalDraft);
                return () => {
                    document.removeEventListener('visibilitychange', handleVisibility);
                    window.removeEventListener('pagehide', flushLocalDraft);
                    window.removeEventListener('beforeunload', flushLocalDraft);
                };
            }, []);

            useEffect(() => {
                const handleWindowError = (event) => {
                    reportClientError(event.error || event.message, { source: 'window-error' });
                };
                const handleUnhandledRejection = (event) => {
                    reportClientError(event.reason || 'Unhandled promise rejection', { source: 'unhandled-rejection' });
                };
                window.addEventListener('error', handleWindowError);
                window.addEventListener('unhandledrejection', handleUnhandledRejection);
                return () => {
                    window.removeEventListener('error', handleWindowError);
                    window.removeEventListener('unhandledrejection', handleUnhandledRejection);
                };
            }, []);

            useEffect(() => {
                if (!isFirebaseConfigured || !db || !workspaceOwnerId) return undefined;
                let cancelled = false;
                const ownerIdForReports = workspaceOwnerId;
                const writeErrorReport = async (report) => {
                    if (cancelled) return;
                    await FirebaseSDK.addDoc(
                        FirebaseSDK.collection(db, 'artifacts', appId, 'users', ownerIdForReports, 'clientErrors'),
                        {
                            ...report,
                            ownerId: ownerIdForReports,
                            uid: user?.uid || '',
                            email: user?.email || '',
                            createdAt: FirebaseSDK.serverTimestamp()
                        }
                    );
                };
                drainClientErrorQueue(writeErrorReport).catch((error) => {
                    console.warn('Queued client errors could not be sent yet.', error);
                });
                const handleOnline = () => {
                    drainClientErrorQueue(writeErrorReport).catch((error) => {
                        console.warn('Queued client errors could not be sent after reconnect.', error);
                    });
                };
                window.addEventListener('online', handleOnline);
                return () => {
                    cancelled = true;
                    window.removeEventListener('online', handleOnline);
                };
            }, [user?.email, user?.uid, workspaceOwnerId]);

            const workspaceServices = useMemo(() => normalizeServiceList(settings.services || []), [settings.services]);
            const serviceById = useMemo(() => new Map(workspaceServices.map(service => [service.id, service])), [workspaceServices]);
            const selectedManualBookingService = useMemo(() => (
                workspaceServices.find(service => service.id === manualBookingServiceId) || null
            ), [manualBookingServiceId, workspaceServices]);
            const getBookingService = (booking = {}) => {
                if (booking.serviceName || booking.serviceId) {
                    return {
                        ...serviceById.get(booking.serviceId),
                        serviceId: booking.serviceId,
                        name: booking.serviceName || serviceById.get(booking.serviceId)?.name || '',
                        description: booking.serviceDescription || serviceById.get(booking.serviceId)?.description || '',
                        price: booking.servicePrice || serviceById.get(booking.serviceId)?.price || '',
                        priceType: booking.servicePriceType || serviceById.get(booking.serviceId)?.priceType || '',
                        duration: booking.serviceDuration || serviceById.get(booking.serviceId)?.duration || '',
                        category: booking.serviceCategory || serviceById.get(booking.serviceId)?.category || ''
                    };
                }
                return null;
            };
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
                clientName: 'Mina Patel',
                clientPhone: '+44 20 5555 0188',
                clientEmail: 'mina.patel@jump-client.example',
                clientNote: 'Example only. Mina booked from the public booking page and wants strength coaching around a busy product launch.',
                clientBirthday: '12 March 1992',
                clientPhotoURL: '',
                clientAvatar: '',
                avatar: '',
                serviceName: 'Jump Start Assessment',
                serviceDuration: '60',
                servicePrice: '35',
                paymentMethod: 'stripe',
                paymentGateway: 'stripe',
                paymentStatus: 'manual_pending',
                paymentProviderName: 'Stripe checkout',
                date: 'Thursday, May 28',
                time: '17:00',
                status: 'pending',
                timestamp: 0,
                noShowHistory: false,
                isExample: true
            }), []);
            const exampleClient = useMemo(() => ({
                id: 'example-client',
                name: 'Mina Patel',
                phone: '+44 20 5555 0188',
                email: 'mina.patel@jump-client.example',
                birthday: '12 March 1992',
                notes: 'Example only. Product lead in London. Books from the public booking page and wants a realistic training plan that works around launch weeks.',
                avatar: '',
                labels: ['Example'],
                autoLabels: ['First Time'],
                bookings: [{ ...exampleBooking, id: 'example-client-history', status: 'confirmed' }],
                bookingCount: 1,
                lastBooking: { ...exampleBooking, status: 'confirmed' },
                source: 'example',
                isExample: true
            }), [exampleBooking]);
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
                    all: {
                        id: 'all',
                        label: 'All time',
                        periodName: 'All time',
                        rangeLabel: 'All time',
                        start: null,
                        end: null
                    },
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
                const activePeriod = periodConfig[bookingDeskPeriod] || periodConfig.all;
                const isAllTime = activePeriod.id === 'all';
                const startKey = isAllTime ? '' : getLocalDateStr(activePeriod.start);
                const endKey = isAllTime ? '9999-12-31' : getLocalDateStr(activePeriod.end);
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
                const sortRows = (rows = []) => {
                    const nextRows = [...rows];
                    if (bookingSort === 'oldest') return nextRows.sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
                    if (bookingSort === 'amount-high') return nextRows.sort((a, b) => Number(b.amountInCents || 0) - Number(a.amountInCents || 0));
                    if (bookingSort === 'amount-low') return nextRows.sort((a, b) => Number(a.amountInCents || 0) - Number(b.amountInCents || 0));
                    if (bookingSort === 'client') return nextRows.sort((a, b) => String(a.clientName || '').localeCompare(String(b.clientName || '')));
                    if (bookingSort === 'service') return nextRows.sort((a, b) => String(a.serviceName || '').localeCompare(String(b.serviceName || '')));
                    return nextRows.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
                };
                const records = visibleBookings.map(booking => ({
                    ...booking,
                    dateKeyResolved: parseBookingDate(booking)
                }));
                const periodRecords = isAllTime ? records : records.filter(booking => (
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
                        booking.serviceName,
                        booking.serviceCategory,
                        booking.serviceDescription,
                        booking.servicePrice,
                        booking.serviceDuration,
                        booking.staffName,
                        staffList.find(staff => staff.id === booking.staffId)?.name
                    ].filter(Boolean).join(' ').toLowerCase().includes(normalizedSearch))
                    : periodRecords;
                const paymentFilteredRecords = searchedRecords.filter(booking => {
                    if (bookingPaymentFilter === 'paid') return booking.paymentStatus === 'paid';
                    if (bookingPaymentFilter === 'open') return booking.paymentStatus !== 'paid';
                    const method = booking.paymentGateway || booking.paymentMethod || '';
                    if (bookingPaymentFilter === 'cash') return method === 'cash';
                    if (bookingPaymentFilter === 'eft') return method === 'manual_eft';
                    if (bookingPaymentFilter === 'card') return method && !['cash', 'manual_eft'].includes(method);
                    return true;
                });
                const activeRecords = paymentFilteredRecords.filter(booking => booking.status !== 'declined');
                const pending = paymentFilteredRecords.filter(booking => booking.status === 'pending').length;
                const waitlist = paymentFilteredRecords.filter(booking => booking.status === 'waitlist').length;
                const confirmedRecords = paymentFilteredRecords.filter(booking => booking.status === 'confirmed');
                const declinedRecords = paymentFilteredRecords.filter(booking => booking.status === 'declined');
                const reviewRecords = paymentFilteredRecords.filter(booking => booking.status === 'pending' || booking.status === 'waitlist');
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
                    waitlist: sortUpcoming(paymentFilteredRecords.filter(booking => booking.status === 'waitlist')),
                    history: sortRecent(historyRecords)
                };
                const filters = [
                    { id: 'upcoming', label: 'Upcoming', count: upcomingRecords.length, icon: CalendarCheck },
                    { id: 'review', label: 'Review', count: reviewRecords.length, icon: Bell },
                    { id: 'confirmed', label: 'Confirmed', count: confirmedRecords.length, icon: Check },
                    { id: 'waitlist', label: 'Waitlist', count: waitlist, icon: Clock },
                    { id: 'history', label: 'History', count: historyRecords.length, icon: History },
                    { id: 'all', label: 'All', count: paymentFilteredRecords.length, icon: Layers }
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
                    filteredRows: sortRows(rowsByFilter[activeFilter] || rowsByFilter.all),
                    total: paymentFilteredRecords.length,
                    periodTotal: periodRecords.length,
                    searchActive: Boolean(normalizedSearch),
                    paymentFilter: bookingPaymentFilter,
                    sort: bookingSort,
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
                        { label: 'Upcoming', value: upcomingRecords.length, hint: activePeriod.id === 'all' ? 'All time' : activePeriod.id === 'day' ? 'Today' : activePeriod.id === 'week' ? 'This week' : 'This month', icon: CalendarCheck },
                        { label: 'Needs Review', value: reviewRecords.length, hint: `${pending} pending / ${waitlist} waitlist`, icon: Bell },
                        { label: 'Confirmed', value: confirmedRecords.length, hint: `${bookingRate}% booking rate`, icon: CheckCircle2 },
                        { label: 'History', value: historyRecords.length, hint: `${declinedRecords.length} declined`, icon: History }
                    ]
                };
            }, [bookingDeskPeriod, bookingFilter, bookingSearch, bookingPaymentFilter, bookingSort, visibleBookings, staffList, bookingCustomRange]);

            const filteredBookings = bookingDesk.filteredRows;
            const showBookingExample = isGuestWorkspace && bookingsReady && visibleBookings.length === 0;
            const bookingRows = showBookingExample ? [exampleBooking] : filteredBookings;
            const guestOwnerNotifications = useMemo(() => {
                if (!isGuestWorkspace) return [];
                const recentBooking = visibleBookings.find(booking => booking.status === 'pending' || booking.status === 'waitlist') || visibleBookings[0] || exampleBooking;
                const paidBooking = visibleBookings.find(booking => String(booking.paymentStatus || '').toLowerCase().includes('paid')) || visibleBookings[1] || recentBooking;
                const birthdayClient = clientRecords.find(client => client.birthday) || null;
                return [
                    makeOwnerNotification({
                        type: NOTIFICATION_TYPES.BOOKING_REQUEST,
                        title: `${recentBooking.clientName || 'New client'} requested a booking`,
                        body: `${recentBooking.serviceName || 'A service'} is ready for review in the booking desk.`,
                        ownerId: 'guest-workspace',
                        booking: recentBooking,
                        tab: 'bookings',
                        priority: 'high',
                        metadata: { demo: true }
                    }),
                    makeOwnerNotification({
                        type: NOTIFICATION_TYPES.NEW_MESSAGE,
                        title: 'Support reply waiting',
                        body: 'A client thread has new booking context attached.',
                        ownerId: 'guest-workspace',
                        threadId: recentBooking.threadId || recentBooking.id || '',
                        tab: 'communications',
                        priority: 'normal',
                        metadata: { demo: true }
                    }),
                    makeOwnerNotification({
                        type: NOTIFICATION_TYPES.BOOKING_CONFIRMED,
                        title: 'Payment status updated',
                        body: `${paidBooking.clientName || 'Client'} is reflected in finance and bookings.`,
                        ownerId: 'guest-workspace',
                        booking: paidBooking,
                        tab: 'finance',
                        priority: 'normal',
                        metadata: { demo: true }
                    }),
                    ...(birthdayClient ? [makeOwnerNotification({
                        type: NOTIFICATION_TYPES.BIRTHDAY_REMINDER,
                        title: `${birthdayClient.name}'s birthday is saved`,
                        body: 'Client profiles keep small details close to the work.',
                        ownerId: 'guest-workspace',
                        tab: 'clients',
                        priority: 'normal',
                        metadata: { demo: true }
                    })] : [])
                ].map((notification, index) => ({
                    ...notification,
                    id: `guest-alert-${index}`,
                    read: guestNotificationReadIds.has(`guest-alert-${index}`),
                    createdAtMs: Date.now() - (index * 11 * 60 * 1000)
                }));
            }, [clientRecords, exampleBooking, guestNotificationReadIds, isGuestWorkspace, visibleBookings]);
            const workspaceNotifications = isGuestWorkspace ? guestOwnerNotifications : ownerNotifications;
            const dashboardSupportThreads = useMemo(() => {
                if (!isGuestWorkspace) return dashboardClientThreads;
                const seenClients = new Set();
                return visibleBookings
                    .filter(booking => ['pending', 'confirmed', 'waitlist'].includes(String(booking.status || '').toLowerCase()))
                    .filter((booking) => {
                        const key = notificationEmailKey(booking.clientEmail || '') || String(booking.clientName || '').trim().toLowerCase();
                        if (!key || seenClients.has(key)) return false;
                        seenClients.add(key);
                        return true;
                    })
                    .map((booking, index) => {
                        const chatMessages = Array.isArray(booking.chatMessages) ? booking.chatMessages : [];
                        const lastClientMessage = chatMessages
                            .map(message => (typeof message === 'string' ? message : message?.text))
                            .filter(Boolean)
                            .find(message => !String(message).toLowerCase().startsWith('absolutely')) || '';
                        return {
                            id: `guest-thread-${booking.id}`,
                            clientName: booking.clientName || 'Client',
                            clientEmail: booking.clientEmail || '',
                            bookingId: booking.id,
                            bookingStatus: booking.status || 'pending',
                            rescheduleStatus: index % 5 === 0 ? 'requested' : '',
                            serviceName: booking.serviceName || 'Booking',
                            lastMessage: booking.chatPreview || lastClientMessage || booking.clientNote || 'Client message waiting.',
                            lastMessageAt: booking.updatedAt || booking.timestamp || booking.createdAt,
                            updatedAt: booking.updatedAt || booking.timestamp || booking.createdAt,
                            ownerUnread: index % 4 === 0 ? 2 : index % 3 === 0 ? 1 : 0,
                            isGuestDemo: true
                        };
                    })
                    .sort((a, b) => dateValueToMs(b.lastMessageAt || b.updatedAt) - dateValueToMs(a.lastMessageAt || a.updatedAt))
                    .slice(0, 40);
            }, [dashboardClientThreads, isGuestWorkspace, visibleBookings]);
            const dashboardSupportUnreadCount = dashboardSupportThreads.reduce((sum, thread) => sum + Number(thread.ownerUnread || 0), 0);

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

            const importedMigrationCounts = useMemo(() => ({
                clients: clientRecords.filter(client => client.importedViaCsv).length,
                bookings: bookings.filter(booking => booking.importedViaCsv).length,
                financeRecords: (
                    financeImports.filter(record => record.importedViaCsv).length +
                    bookings.filter(booking => booking.importedViaCsv && Number(booking.amountInCents || booking.amountPaidInCents || 0) > 0).length
                )
            }), [bookings, clientRecords, financeImports]);

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
                if (notification?.tab) navigateWorkspaceTab(notification.tab, notification.editorTab);
                else if (notification?.editorTab) setEditorTab(notification.editorTab);
            };
            const markWorkspaceNotificationRead = isGuestWorkspace
                ? (notificationId) => setGuestNotificationReadIds(prev => new Set([...prev, notificationId]))
                : markOwnerNotificationRead;
            const markAllWorkspaceNotificationsRead = isGuestWorkspace
                ? () => setGuestNotificationReadIds(prev => new Set([...prev, ...guestOwnerNotifications.map(notification => notification.id)]))
                : markAllOwnerNotificationsRead;

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
                    all: {
                        id: 'all',
                        label: 'All time',
                        title: 'All time overview',
                        rangeLabel: 'All time',
                        start: null,
                        end: null,
                        emptyTitle: 'No bookings yet',
                        emptyText: 'Your full booking history will appear here once clients start booking.'
                    },
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
                const isDashboardAllTime = activePeriod.id === 'all';
                const startKey = isDashboardAllTime ? '' : getLocalDateStr(activePeriod.start);
                const endKey = isDashboardAllTime ? '9999-12-31' : getLocalDateStr(activePeriod.end);
                const defaultTimes = settings.availableTimes || [];
                const dateKeys = [];
                if (!isDashboardAllTime) {
                    for (let cursor = new Date(activePeriod.start), guard = 0; cursor <= activePeriod.end && guard < 45; cursor = addDays(cursor, 1), guard += 1) {
                        dateKeys.push(getLocalDateStr(cursor));
                    }
                }
                const periodCapacity = dateKeys.reduce((total, dateKey) => {
                    const daySchedule = settings.schedule?.[dateKey] || {};
                    const dayAvailable = daySchedule.available ?? true;
                    if (!dayAvailable) return total;
                    const dayTimes = Array.isArray(daySchedule.times) ? daySchedule.times : defaultTimes;
                    return total + dayTimes.length;
                }, 0);

                const bookingsWithDates = visibleBookings.map(booking => {
                    const dateKeyResolved = parseBookingDate(booking);
                    const timeMatch = String(booking.time || '').match(/\b(\d{1,2}):(\d{2})\b/);
                    const normalizedTime = timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}` : '00:00';
                    const scheduledMs = dateKeyResolved ? new Date(`${dateKeyResolved}T${normalizedTime}:00`).getTime() : 0;
                    return {
                        ...booking,
                        dateKeyResolved,
                        dashboardSortMs: scheduledMs || dateValueToMs(booking.updatedAt || booking.timestamp || booking.createdAt) || 0
                    };
                });
                const activeBookings = bookingsWithDates.filter(booking => booking.status !== 'declined');
                const periodBookings = isDashboardAllTime
                    ? bookingsWithDates
                    : bookingsWithDates.filter(booking => booking.dateKeyResolved && booking.dateKeyResolved >= startKey && booking.dateKeyResolved <= endKey);
                const periodActiveBookings = periodBookings.filter(booking => booking.status !== 'declined');
                const pending = periodActiveBookings.filter(booking => booking.status === 'pending').length;
                const waitlist = periodActiveBookings.filter(booking => booking.status === 'waitlist').length;
                const confirmed = periodActiveBookings.filter(booking => booking.status === 'confirmed').length;
                const declined = periodBookings.filter(booking => booking.status === 'declined').length;
                const reservedSlots = periodActiveBookings.filter(booking => booking.status !== 'waitlist' && booking.time !== 'Waitlist').length;
                const openSlots = Math.max(0, periodCapacity - reservedSlots);
                const bookingRate = periodActiveBookings.length ? Math.round((confirmed / periodActiveBookings.length) * 100) : 0;
                const dashboardManualGateways = new Set(['manual_eft', 'cash']);
                const financePeriodStartMs = isDashboardAllTime ? 0 : new Date(`${startKey}T00:00:00`).getTime();
                const financePeriodEndMs = isDashboardAllTime ? Number.POSITIVE_INFINITY : addDays(new Date(`${endKey}T00:00:00`), 1).getTime();
                const normalizeFinanceStatus = (value = '', amountInCents = 0) => {
                    const clean = String(value || '').trim().toLowerCase();
                    if (clean.includes('unpaid') || clean.includes('not paid') || clean.includes('not_paid')) return 'manual_pending';
                    if ((clean.includes('paid') && !clean.includes('unpaid')) || clean.includes('settled') || clean.includes('complete') || clean.includes('success')) return 'paid';
                    if (clean.includes('pending') || clean.includes('manual') || clean.includes('open')) return 'manual_pending';
                    return Number(amountInCents || 0) > 0 ? 'paid' : 'manual_pending';
                };
                const financeRecordMsFromBooking = (booking) => (
                    dateValueToMs(booking.paidAt || booking.updatedAt || booking.timestamp || booking.createdAt) ||
                    (booking.dateKeyResolved ? new Date(`${booking.dateKeyResolved}T00:00:00`).getTime() : 0)
                );
                const financeRecordsForDashboard = [
                    ...bookingsWithDates
                        .filter((booking) => {
                            if (!booking || booking.isExample) return false;
                            const method = booking.paymentGateway || booking.paymentMethod || '';
                            return isGuestWorkspace || dashboardManualGateways.has(method) || booking.paymentStatus === 'manual_pending';
                        })
                        .map((booking) => {
                            const amountInCents = Number(booking.amountInCents || booking.amountPaidInCents || 0) || parseAmountToCents(booking.total || booking.servicePrice || booking.price || booking.deposit || 0);
                            return {
                                status: booking.paymentStatus === 'paid' ? 'paid' : 'manual_pending',
                                amountInCents,
                                currency: booking.currency || settings.currency || 'ZAR',
                                updatedAtMs: financeRecordMsFromBooking(booking),
                                title: booking.clientName || 'Client payment',
                                detail: booking.serviceName || booking.service || 'Booking payment'
                            };
                        }),
                    ...financeImports
                        .filter((record) => record && !record.isExample)
                        .map((record) => {
                            const amountInCents = Number(record.amountInCents || record.amountPaidInCents || 0) || parseAmountToCents(record.amount || record.total || record.price || 0);
                            return {
                                status: normalizeFinanceStatus(record.status || record.paymentStatus, amountInCents),
                                amountInCents,
                                currency: record.currency || settings.currency || 'ZAR',
                                updatedAtMs: dateValueToMs(record.updatedAtMs || record.updatedAt || record.paidAt || record.createdAt),
                                title: record.clientName || record.name || record.reference || 'Finance row',
                                detail: record.serviceName || record.gateway || record.paymentMethod || 'Imported payment'
                            };
                        }),
                    ...financePaymentAttempts
                        .filter((record) => record && !record.isExample)
                        .map((record) => ({
                            status: record.status || 'initiated',
                            amountInCents: Number(record.amountInCents || record.amountPaidInCents || 0),
                            currency: record.currency || settings.currency || 'ZAR',
                            updatedAtMs: dateValueToMs(record.paidAt || record.updatedAtMs || record.updatedAt || record.createdAt),
                            title: record.clientName || record.customerName || 'Payment attempt',
                            detail: record.gateway || record.provider || record.status || 'Gateway activity'
                        }))
                ];
                const paidFinanceRecords = financeRecordsForDashboard.filter(record => (
                    normalizeFinanceStatus(record.status, record.amountInCents) === 'paid' &&
                    record.updatedAtMs >= financePeriodStartMs &&
                    record.updatedAtMs < financePeriodEndMs
                ));
                const pendingFinanceRecords = financeRecordsForDashboard.filter(record => (
                    normalizeFinanceStatus(record.status, record.amountInCents) !== 'paid' &&
                    record.updatedAtMs >= financePeriodStartMs &&
                    record.updatedAtMs < financePeriodEndMs
                ));
                const totalRevenueInCents = paidFinanceRecords.reduce((sum, record) => sum + Number(record.amountInCents || 0), 0);
                const pendingRevenueInCents = pendingFinanceRecords.reduce((sum, record) => sum + Number(record.amountInCents || 0), 0);
                const currencyCounts = financeRecordsForDashboard.reduce((acc, record) => {
                    const code = String(record.currency || '').toUpperCase();
                    if (/^[A-Z]{3}$/.test(code)) acc[code] = (acc[code] || 0) + 1;
                    return acc;
                }, {});
                const financeCurrencyStorageKey = `build-a-booking-finance-currency-${String(workspaceOwnerId || (isGuestWorkspace ? 'guest' : 'local')).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
                const storedFinanceCurrency = String(safeLocalGet(financeCurrencyStorageKey) || '').toUpperCase();
                const dominantFinanceCurrency = Object.entries(currencyCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
                const dashboardRevenueCurrency = /^[A-Z]{3}$/.test(storedFinanceCurrency)
                    ? storedFinanceCurrency
                    : (dominantFinanceCurrency || settings.currency || 'ZAR');
                const totalRevenueLabel = formatDashboardMoney(totalRevenueInCents, dashboardRevenueCurrency);
                const pendingRevenueLabel = formatDashboardMoney(pendingRevenueInCents, dashboardRevenueCurrency);
                const totalRevenueHint = `${paidFinanceRecords.length} paid ${paidFinanceRecords.length === 1 ? 'record' : 'records'}`;
                const financeActivity = financeRecordsForDashboard
                    .filter(record => record.updatedAtMs >= financePeriodStartMs && record.updatedAtMs < financePeriodEndMs)
                    .sort((a, b) => Number(b.updatedAtMs || 0) - Number(a.updatedAtMs || 0))
                    .slice(0, 24)
                    .map(record => ({
                        ...record,
                        amountLabel: formatDashboardMoney(Number(record.amountInCents || 0), record.currency || dashboardRevenueCurrency),
                        normalizedStatus: normalizeFinanceStatus(record.status, record.amountInCents)
                    }));
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
                    dateKeys,
                    todayKey,
                    defaultTimes,
                    activityList: periodActiveBookings.length ? periodActiveBookings : [],
                    upcomingBookings,
                    todayBookings,
                    todayOpenSlots,
                    todayCapacity: todayAvailable ? todayTimes.length : 0,
                    todayAvailable,
                    bookingRate,
                    totalRevenueLabel,
                    totalRevenueHint,
                    totalRevenueInCents,
                    totalRevenuePaidCount: paidFinanceRecords.length,
                    pendingRevenueLabel,
                    pendingFinanceCount: pendingFinanceRecords.length,
                    financeActivity,
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
            }, [visibleBookings, financeImports, financePaymentAttempts, dashboardPeriod, settings.schedule, settings.availableTimes, settings.brandName, settings.slug, settings.welcomeMessage, settings.currency, communications, clientMetrics, clientDirectory, isGuestWorkspace, workspaceOwnerId]);

            const dashboardFeedFilterOptions = [
                { id: 'all', label: 'All' },
                { id: 'pending', label: 'Requests' },
                { id: 'waitlist', label: 'Waitlist' },
                { id: 'confirmed', label: 'Confirmed' },
                { id: 'reschedule', label: 'Reschedule' }
            ];
            const sortDashboardLatest = (items, getTime) => (
                [...(items || [])].sort((a, b) => {
                    const aTime = Number(getTime(a) || 0);
                    const bTime = Number(getTime(b) || 0);
                    return bTime - aTime;
                })
            );
            const getDashboardFilterText = (item) => ([
                item?.status,
                item?.type,
                item?.kind,
                item?.requestType,
                item?.rescheduleStatus,
                item?.bookingStatus,
                item?.title,
                item?.body,
                item?.detail,
                item?.clientName,
                item?.serviceName,
                item?.clientNote,
                item?.note,
                item?.notes,
                item?.lastMessage,
                item?.message
            ].filter(Boolean).join(' ').toLowerCase());
            const bookingMatchesDashboardFilter = (booking, filter) => {
                if (!filter || filter === 'all') return true;
                const status = String(booking?.status || '').toLowerCase();
                const text = getDashboardFilterText(booking);
                if (filter === 'pending') return status === 'pending' || text.includes('request') || text.includes('review');
                if (filter === 'waitlist') return status === 'waitlist';
                if (filter === 'confirmed') return status === 'confirmed';
                if (filter === 'reschedule') {
                    return text.includes('reschedule') || text.includes('rescheduled') || text.includes('change time') || text.includes('move');
                }
                return true;
            };
            const notificationMatchesDashboardFilter = (notification, filter) => {
                if (!filter || filter === 'all') return true;
                const text = getDashboardFilterText(notification);
                if (filter === 'pending') return text.includes('request') || text.includes('review') || text.includes('ready');
                if (filter === 'waitlist') return text.includes('waitlist') || text.includes('spot opens') || text.includes('spot opened');
                if (filter === 'confirmed') return text.includes('confirmed');
                if (filter === 'reschedule') return text.includes('reschedule') || text.includes('rescheduled') || text.includes('change time') || text.includes('move');
                return true;
            };
            const threadMatchesDashboardFilter = (thread, filter) => {
                if (!filter || filter === 'all') return true;
                const status = String(thread?.bookingStatus || thread?.status || '').toLowerCase();
                const rescheduleStatus = String(thread?.rescheduleStatus || '').toLowerCase();
                const text = getDashboardFilterText(thread);
                if (filter === 'pending') return ['pending', 'requested'].includes(status) || text.includes('request') || text.includes('review');
                if (filter === 'waitlist') return status === 'waitlist' || text.includes('waitlist') || text.includes('spot opens');
                if (filter === 'confirmed') return status === 'confirmed';
                if (filter === 'reschedule') {
                    return ['requested', 'countered'].includes(rescheduleStatus) || text.includes('reschedule') || text.includes('rescheduled') || text.includes('change time') || text.includes('move');
                }
                return true;
            };
            const getBookingDashboardDot = (booking) => (
                booking?.status === 'waitlist'
                    ? 'waitlist'
                    : booking?.status === 'confirmed' && booking?.paymentStatus === 'paid'
                        ? 'paid-confirmed'
                        : booking?.status === 'confirmed'
                            ? 'confirmed-unpaid'
                            : (booking?.status || 'pending')
            );
            const getThreadDashboardDot = (thread, linkedBooking = null) => {
                const status = String(thread?.bookingStatus || thread?.status || '').toLowerCase();
                if (linkedBooking) return getBookingDashboardDot(linkedBooking);
                if (threadMatchesDashboardFilter(thread, 'reschedule')) return 'reschedule';
                if (status === 'waitlist') return 'waitlist';
                if (status === 'confirmed' && String(thread?.paymentStatus || '').toLowerCase() === 'paid') return 'paid-confirmed';
                if (status === 'confirmed') return 'confirmed-unpaid';
                return Number(thread?.ownerUnread || 0) > 0 ? 'unread' : 'pending';
            };
            const renderDashboardFilterControl = (section) => (
                <div className="dashboard-filter-strip" aria-label={`${section} filter`}>
                    {dashboardFeedFilterOptions.map(option => (
                        <button
                            key={`${section}-${option.id}`}
                            type="button"
                            className={`dashboard-filter-chip ${dashboardFeedFilters[section] === option.id ? 'is-active' : ''}`}
                            onClick={() => {
                                setDashboardFeedFilters(prev => ({ ...prev, [section]: option.id }));
                                resetDashboardFeedPage(section);
                            }}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            );
            const getBookingDashboardTime = (booking) => (
                Number(booking?.dashboardSortMs || 0) ||
                dateValueToMs(booking?.updatedAt || booking?.timestamp || booking?.createdAt)
            );
            const getNotificationDashboardTime = (notification) => (
                dateValueToMs(notification?.createdAtMs || notification?.createdAt || notification?.updatedAt) ||
                Number(notification?.createdAtMs || notification?.updatedAtMs || 0)
            );
            const getDateKeyDashboardTime = (dateKey) => (
                dateKey ? new Date(`${dateKey}T00:00:00`).getTime() : 0
            );
            const dashboardMobileTiles = [
                { id: 'bookings', label: 'Bookings', icon: BookOpenCheck, value: dashboardPortfolio.activeBookings, hint: 'Total' },
                { id: 'chats', label: 'Chats', icon: MessagesSquare, value: dashboardSupportUnreadCount, hint: 'Unread' },
                { id: 'schedule', label: 'Schedule', icon: CalendarDays, value: dashboardPortfolio.openSlots, hint: 'Open' },
                { id: 'finance', label: 'Payments', icon: DollarSign, value: dashboardPortfolio.totalRevenueLabel, hint: 'Revenue' }
            ];
            const dashboardActiveTileIndex = Math.max(0, dashboardMobileTiles.findIndex(tile => tile.id === dashboardMobileTile));
            const dashboardActiveTile = dashboardMobileTiles[dashboardActiveTileIndex] || dashboardMobileTiles[0];
            const dashboardScheduleViewOptions = [
                { id: 'availability', label: 'Availability' },
                { id: 'pending', label: 'Pending Requests' },
                { id: 'confirmed', label: 'Confirmed Bookings' }
            ];
            const DASHBOARD_FEED_PAGE_SIZE = 5;
            const DASHBOARD_FEED_PAGE_SIZE_OPTIONS = [5, 10, 15];
            const resetDashboardFeedPage = (section) => {
                setDashboardFeedPages(prev => ({ ...prev, [section]: 0 }));
            };
            const resetDashboardFeedPages = () => {
                setDashboardFeedPages({
                    bookings: 0,
                    chats: 0,
                    schedule: 0,
                    finance: 0
                });
            };
            const setDashboardFeedPageSize = (section, pageSize) => {
                const safeSize = DASHBOARD_FEED_PAGE_SIZE_OPTIONS.includes(Number(pageSize))
                    ? Number(pageSize)
                    : DASHBOARD_FEED_PAGE_SIZE;
                setDashboardFeedPageSizes(prev => ({ ...prev, [section]: safeSize }));
                resetDashboardFeedPage(section);
            };
            const getDashboardPagedFeed = (section, rows, pageSize = dashboardFeedPageSizes[section] || DASHBOARD_FEED_PAGE_SIZE) => {
                const safeRows = Array.isArray(rows) ? rows : [];
                const totalPages = Math.max(1, Math.ceil(safeRows.length / pageSize));
                const requestedPage = Number(dashboardFeedPages[section] || 0);
                const page = Math.min(Math.max(requestedPage, 0), totalPages - 1);
                return {
                    rows: safeRows.slice(page * pageSize, page * pageSize + pageSize),
                    page,
                    totalPages,
                    totalRows: safeRows.length
                };
            };
            const shiftDashboardFeedPage = (section, direction, totalPages) => {
                setDashboardFeedPages(prev => {
                    const pageCount = Math.max(1, Number(totalPages || 1));
                    const current = Math.min(Math.max(Number(prev[section] || 0), 0), pageCount - 1);
                    return { ...prev, [section]: (current + direction + pageCount) % pageCount };
                });
            };
            const renderDashboardFeedPager = (section, pageData) => {
                if (!pageData || pageData.totalRows <= DASHBOARD_FEED_PAGE_SIZE) return null;
                return (
                    <div className="dashboard-feed-pager" aria-label={`${section} pages`}>
                        <button
                            type="button"
                            onClick={() => shiftDashboardFeedPage(section, -1, pageData.totalPages)}
                            aria-label={`Previous ${section} page`}
                            disabled={pageData.totalPages <= 1}
                        >
                            <ChevronLeft size={14} strokeWidth={2.6} />
                        </button>
                        <span>{pageData.page + 1} / {pageData.totalPages}</span>
                        <label className="dashboard-feed-size">
                            <span>Show</span>
                            <select
                                value={dashboardFeedPageSizes[section] || DASHBOARD_FEED_PAGE_SIZE}
                                onChange={event => setDashboardFeedPageSize(section, event.target.value)}
                                aria-label={`Show ${section} rows`}
                            >
                                {DASHBOARD_FEED_PAGE_SIZE_OPTIONS.map(option => (
                                    <option key={`${section}-size-${option}`} value={option}>{option}</option>
                                ))}
                            </select>
                        </label>
                        <button
                            type="button"
                            onClick={() => shiftDashboardFeedPage(section, 1, pageData.totalPages)}
                            aria-label={`Next ${section} page`}
                            disabled={pageData.totalPages <= 1}
                        >
                            <ChevronRight size={14} strokeWidth={2.6} />
                        </button>
                    </div>
                );
            };
            const shiftDashboardMobileTile = (direction = 1) => {
                setDashboardMobileTile(current => {
                    const currentIndex = Math.max(0, dashboardMobileTiles.findIndex(tile => tile.id === current));
                    const nextIndex = (currentIndex + direction + dashboardMobileTiles.length) % dashboardMobileTiles.length;
                    return dashboardMobileTiles[nextIndex]?.id || 'bookings';
                });
            };
            const handleDashboardTileTouchStart = (event) => {
                dashboardTileTouchRef.current = event.touches?.[0]?.clientX ?? null;
            };
            const handleDashboardTileTouchEnd = (event) => {
                const startX = dashboardTileTouchRef.current;
                dashboardTileTouchRef.current = null;
                const endX = event.changedTouches?.[0]?.clientX;
                if (!Number.isFinite(startX) || !Number.isFinite(endX)) return;
                const delta = endX - startX;
                if (Math.abs(delta) < 44) return;
                shiftDashboardMobileTile(delta < 0 ? 1 : -1);
            };

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
                return filteredClients;
            }, [clientDeskFilter, filteredClients]);

            const clientDeskFilters = useMemo(() => ([
                { id: 'all', label: 'All', count: clientDirectory.length, icon: Users },
                { id: 'regulars', label: 'Regulars', count: clientMetrics.regulars, icon: Star },
                { id: 'first-time', label: 'First Time', count: clientMetrics.firstTimers, icon: User }
            ]), [clientDirectory.length, clientMetrics.firstTimers, clientMetrics.regulars]);

            useEffect(() => {
                if (clientDeskFilter === 'enriched') {
                    setClientDeskFilter('all');
                }
            }, [clientDeskFilter]);

            const selectedClient = useMemo(() => (
                clientDirectory.find(client => client.id === selectedClientId) || null
            ), [clientDirectory, selectedClientId]);
            const showClientExample = isGuestWorkspace && bookingsReady && clientDirectory.length === 0 && !clientSearch.trim();
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
                    if (selectedClientId && (!showClientExample || selectedClientId !== exampleClient.id)) setSelectedClientId(null);
                    return;
                }
                if (selectedClientId && !clientDirectory.some(client => client.id === selectedClientId)) {
                    setSelectedClientId(null);
                    setClientMobileView('directory');
                }
            }, [clientDirectory, exampleClient.id, selectedClientId, showClientExample]);

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
                if (!isFirebaseConfigured || !db || !user || !workspaceOwnerId || publicSlug || isGuestWorkspace) {
                    setDashboardClientThreads([]);
                    return undefined;
                }
                const threadsQuery = FirebaseSDK.query(
                    FirebaseSDK.collection(db, 'artifacts', appId, 'clientThreads'),
                    FirebaseSDK.where('ownerId', '==', workspaceOwnerId)
                );
                const unsubscribe = FirebaseSDK.onSnapshot(threadsQuery, (snap) => {
                    const nextThreads = snap.docs
                        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
                        .sort((a, b) => (
                            dateValueToMs(b.lastMessageAt || b.updatedAt || b.createdAt) -
                            dateValueToMs(a.lastMessageAt || a.updatedAt || a.createdAt)
                        ))
                        .slice(0, 40);
                    setDashboardClientThreads(nextThreads);
                }, (error) => console.error('Dashboard client threads sync failed', error));
                return () => unsubscribe();
            }, [user?.uid, workspaceOwnerId, publicSlug, isGuestWorkspace]);

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

            const navItems = [
                { id: 'overview', icon: LayoutDashboard, label: 'Dashboard' },
                { id: 'bookings', icon: BookOpenCheck, label: 'Bookings', badge: visibleBookings.some(b => b.status === 'pending' || b.status === 'waitlist') },
                { id: 'business', icon: CalendarDays, label: 'Schedule' },
                { id: 'communications', icon: MessagesSquare, label: 'Support Inbox' },
                { id: 'editor', icon: Palette, label: 'Editor' },
                { id: 'services', icon: BriefcaseBusiness, label: 'Services' },
                { id: 'finance', icon: DollarSign, label: 'Finance' },
                { id: 'clients', icon: HeartHandshake, label: 'Clients', badge: clientMetrics.firstTimers > 0 },
                { id: 'staff', icon: UsersRound, label: 'Team' },
                { id: 'profile', icon: Settings2, label: 'Profile' }
            ];
            const mobilePrimaryNavIds = ['communications', 'bookings', 'business', 'finance'];
            const mobilePrimaryNavItems = mobilePrimaryNavIds.map(id => navItems.find(item => item.id === id)).filter(Boolean);
            const mobileMoreNavItems = navItems.filter(item => !mobilePrimaryNavIds.includes(item.id));
            const mobileMoreActive = mobileMoreNavItems.some(item => item.id === activeTab);
            const mobileMoreHasBadge = mobileMoreNavItems.some(item => item.badge);
            const collectsClientPhone = settings.features?.collectClientPhone !== false;
            const collectsClientEmail = settings.features?.collectClientEmail !== false;
            const collectsClientNotes = Boolean(settings.features?.collectClientNotes);
            const emailUpdatesEnabled = settings.features?.emailUpdates !== false;
            const isMobileEditorRuntime = isMobileRuntime || isCompactEditorViewport;
            const themeGenerationInputs = useMemo(() => ({
                industry: themeFilters.industry || '',
                palette: themeFilters.palette || 'all',
                style: themeFilters.style || 'all-styles',
                detectedPalette: detectedThemePalette,
                detectedStyle: detectedThemeStyle
            }), [themeFilters.industry, themeFilters.palette, themeFilters.style, detectedThemePalette, detectedThemeStyle]);

            const paletteThemeFilterGroup = useMemo(() => (
                THEME_FILTER_GROUPS.find(group => group.id === 'palette') || THEME_FILTER_GROUPS[0]
            ), []);
            const paletteFilterOptions = useMemo(() => (
                paletteThemeFilterGroup.filters.filter(filter => !['dark', 'earth'].includes(filter.id))
            ), [paletteThemeFilterGroup]);
            const paletteFlowOptions = useMemo(() => (
                paletteFilterOptions.filter(filter => !['all'].includes(filter.id))
            ), [paletteFilterOptions]);
            const selectedPaletteFilter = paletteThemeFilterGroup.filters.find(filter => filter.id === themeGenerationInputs.palette) || paletteThemeFilterGroup.filters[0];
            const selectedPaletteName = themeGenerationInputs.palette === 'custom' ? 'Custom' : selectedPaletteFilter.name;
            const selectedPalettePhrase = themeGenerationInputs.palette === 'custom'
                ? 'your custom color'
                : selectedPaletteFilter.id === 'all'
                    ? 'a full color range'
                    : `${selectedPaletteFilter.name.toLowerCase()} colors`;
            const activePaletteFlowId = paletteFlowOptions.some(option => option.id === settings.editorPaletteFlowColor)
                ? settings.editorPaletteFlowColor
                : paletteFlowOptions.some(option => option.id === themeGenerationInputs.palette)
                    ? themeGenerationInputs.palette
                    : 'blue';
            const activePaletteFlow = paletteFlowOptions.find(option => option.id === activePaletteFlowId) || paletteFlowOptions[0];
            const activePaletteDepthValue = typeof settings.editorColorDepths === 'object' && settings.editorColorDepths !== null
                ? Number(settings.editorColorDepths[activePaletteFlowId] ?? settings.editorColorDepth ?? 50)
                : Number(settings.editorColorDepth ?? 50);
            const activePaletteShade = Math.max(1, Math.min(10, Math.round((activePaletteDepthValue || 50) / 10) || 5));
            const shouldMountEditorPreview = activeTab === 'editor';

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

            useLayoutEffect(() => {
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
                    const shortLandscapeEditor = compact
                        && device === 'desktop'
                        && window.matchMedia('(orientation: landscape)').matches
                        && window.innerHeight <= 700
                        && window.innerWidth <= 1400;
                    const baseFrame = getEditorPreviewFrame(device, compact);
                    const frame = shortLandscapeEditor
                        ? {
                            ...baseFrame,
                            maxScale: Math.min(baseFrame.maxScale, 0.72),
                            paddingX: Math.max(baseFrame.paddingX, 120),
                            paddingY: Math.max(baseFrame.paddingY, 190)
                        }
                        : baseFrame;
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
            }, [device, activeTab, sidebarCollapsed, editorCollapsed, mobileNavCollapsed, editorStudioModal, shouldMountEditorPreview]);

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
                const leavingCurrentWork = nextRoute.view !== view || (nextRoute.view === 'dashboard' && nextRoute.activeTab !== activeTab);
                if (leavingCurrentWork && !confirmLeavingUnsavedChanges()) return false;
                setView(nextRoute.view);
                if (nextRoute.view === 'dashboard') {
                    setActiveTab(nextRoute.activeTab);
                    if (nextRoute.activeTab === 'editor') setEditorTab(nextRoute.editorTab || 'themes');
                }
                saveWorkspaceRoute(nextRoute);
                return true;
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
                            const redirectWasStarted = hasFreshAuthRedirectStart();
                            if (redirectWasStarted) setAuthRedirectPending(true);
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
                                    clearGoogleAuthIntentUrl();
                                    setAuthRedirectPending(false);
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
                            safeLocalRemove('build-a-booking-active-workspace');
                            const signedOutRoute = getWorkspaceRouteFromUrl() || getSavedWorkspaceRoute();
                            if (shouldStartInGuestWorkspace(signedOutRoute)) {
                                guestDemoSeededRef.current = false;
                            } else {
                                resetWorkspaceRuntimeState();
                            }
                            const redirectStillStarting = hasFreshAuthRedirectStart();
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
                const localGuestSettings = settingsRef.current || settings;
                const localGuestSlug = buildBookingSlug(localGuestSettings.slug || localGuestSettings.brandName || localGuestSettings.businessName || 'studio');
                if (!user && (guestMode || safeLocalGet(guestModeStorageKey) === 'true') && localGuestSlug === publicSlug) {
                    const publishableGuestSettings = stripEditorDraftFields(localGuestSettings);
                    setPublicError('');
                    setPublicWorkspace({
                        ...publishableGuestSettings,
                        slug: publicSlug,
                        workspaceName: publishableGuestSettings.brandName || publishableGuestSettings.businessName || 'Build A Booking Workspace',
                        ownerId: ''
                    });
                    setPublicLoading(false);
                    return;
                }
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
            }, [publicSlug, publicReloadKey, guestMode, user?.uid]);

            useEffect(() => {
                let cancelled = false;
                if (!publicSlug || !isFirebaseConfigured || !publicWorkspace?.ownerId) {
                    setPublicManualPaymentOptions([]);
                    return () => { cancelled = true; };
                }

                const gatewayIds = ['manual_eft', 'cash'];
                Promise.all(gatewayIds.map(async (gatewayId) => {
                    const snap = await FirebaseSDK.getDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'users', publicWorkspace.ownerId, 'payment_settings', gatewayId));
                    if (!snap.exists()) return null;
                    const data = snap.data() || {};
                    if (data.enabled !== true) return null;
                    return {
                        id: gatewayId,
                        gatewayType: gatewayId,
                        name: data.providerName || (gatewayId === 'manual_eft' ? 'Manual EFT' : 'Cash'),
                        enabled: true,
                        mode: data.mode || 'live',
                        credentialSummary: data.credentialSummary || {},
                        instructions: data.credentialSummary?.instructions || ''
                    };
                }))
                    .then((options) => {
                        if (!cancelled) setPublicManualPaymentOptions(options.filter(Boolean));
                    })
                    .catch((error) => {
                        console.error('Could not load manual payment options', error);
                        if (!cancelled) setPublicManualPaymentOptions([]);
                    });

                return () => { cancelled = true; };
            }, [publicSlug, publicWorkspace?.ownerId]);

            useEffect(() => {
                if (publicSlug) {
                    return undefined;
                }
                if ((!user || !workspaceOwnerId) && isFirebaseConfigured) return undefined;
                if (!isFirebaseConfigured) {
                    return undefined;
                }

                const handleSyncError = (label) => (error) => {
                    console.error(`${label} sync failed`, error);
                };
                const settingsRef = FirebaseSDK.doc(db, 'artifacts', appId, 'users', workspaceOwnerId, 'config', 'settings');
                const applyWorkspaceSettings = (baseSettings = {}) => {
                    let data = { ...baseSettings };
                    if(data.fontFamily === 'sans') data.fontFamily = 'inter';
                    if(data.fontFamily === 'serif') data.fontFamily = 'playfair';
                    if(data.fontFamily === 'mono') data.fontFamily = 'space-mono';
                    if(data.fontFamily === 'display') data.fontFamily = 'syne';

                    const publishedUpdatedAt = Math.max(getTimestampValue(data.updatedAt), getTimestampValue(data.publishedAt));
                    const cloudDraft = cloudEditorDraftRef.current;
                    const cloudDraftAt = getTimestampValue(cloudDraft?.savedAt || cloudDraft?.updatedAt);
                    let recoveredDraft = null;

                    if (isEditorWorkspaceOpen && canManageWorkspace && cloudDraft?.settings && cloudDraftAt > publishedUpdatedAt) {
                        recoveredDraft = cloudDraft;
                        data = { ...data, ...cloudDraft.settings };
                    }

                    const localDraft = readEditorDraft(workspaceOwnerId);
                    const localDraftAt = getTimestampValue(localDraft?.savedAt);
                    if (isEditorWorkspaceOpen && canManageWorkspace && localDraft?.settings && localDraftAt > Math.max(publishedUpdatedAt, cloudDraftAt)) {
                        recoveredDraft = localDraft;
                        data = { ...data, ...localDraft.settings };
                    }

                    if (recoveredDraft?.editorStudioScene) {
                        setEditorStudioScene(recoveredDraft.editorStudioScene);
                    }
                    if (recoveredDraft && !editorDraftRecoveredRef.current) {
                        editorDraftRecoveredRef.current = true;
                        showToast('Recovered your latest editor draft.');
                    }

                    setSettings(prev => mergeStateIfChanged(prev, data));
                };

                const unsubSettings = FirebaseSDK.onSnapshot(settingsRef, (docSnap) => { 
                    if (docSnap.exists()) {
                        const data = { ...docSnap.data() };
                        publishedSettingsSnapshotRef.current = data;
                        applyWorkspaceSettings(data);
                    } else {
                        publishedSettingsSnapshotRef.current = null;
                        setSettings(prev => mergeStateIfChanged(prev, createDefaultSettings()));
                    }
                }, handleSyncError('Settings'));

                const editorDraftRef = FirebaseSDK.doc(db, 'artifacts', appId, 'users', workspaceOwnerId, 'config', 'editorDraft');
                const unsubEditorDraft = FirebaseSDK.onSnapshot(editorDraftRef, (docSnap) => {
                    cloudEditorDraftRef.current = docSnap.exists() ? docSnap.data() : null;
                    if (cloudEditorDraftRef.current?.settings) {
                        applyWorkspaceSettings(publishedSettingsSnapshotRef.current || settingsRef.current || {});
                    }
                }, handleSyncError('Editor draft'));
                
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
                    } else {
                        setStaffList(prev => areJsonEqual(prev, [{ id: 'owner', name: 'Admin', color: '#39FF14' }]) ? prev : [{ id: 'owner', name: 'Admin', color: '#39FF14' }]);
                    }
                }, handleSyncError('Staff'));

                const commsRef = FirebaseSDK.doc(db, 'artifacts', appId, 'users', workspaceOwnerId, 'config', 'communications');
                const unsubComms = FirebaseSDK.onSnapshot(commsRef, (docSnap) => { 
                    if (docSnap.exists()) {
                        const nextComms = normalizeCommunications(docSnap.data());
                        setCommunications(prev => areJsonEqual(prev, nextComms) ? prev : nextComms);
                    } else {
                        const nextComms = createDefaultCommunications();
                        setCommunications(prev => areJsonEqual(prev, nextComms) ? prev : nextComms);
                    }
                }, handleSyncError('Communication'));

                const clientsRef = FirebaseSDK.doc(db, 'artifacts', appId, 'users', workspaceOwnerId, 'config', 'clients');
                const unsubClients = FirebaseSDK.onSnapshot(clientsRef, (docSnap) => { 
                    if (docSnap.exists()) {
                        const nextClients = docSnap.data().list || [];
                        setClientRecords(prev => areJsonEqual(prev, nextClients) ? prev : nextClients);
                    } else {
                        setClientRecords(prev => prev.length ? [] : prev);
                    }
                }, handleSyncError('Client'));

                const financeImportsRef = FirebaseSDK.doc(db, 'artifacts', appId, 'users', workspaceOwnerId, 'finance', 'imports');
                const unsubFinanceImports = FirebaseSDK.onSnapshot(financeImportsRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const nextImports = docSnap.data().list || [];
                        setFinanceImports(prev => areJsonEqual(prev, nextImports) ? prev : nextImports);
                    } else {
                        setFinanceImports(prev => prev.length ? [] : prev);
                    }
                }, handleSyncError('Finance import'));

                return () => { unsubSettings(); unsubEditorDraft(); unsubStaff(); unsubComms(); unsubClients(); unsubFinanceImports(); };
            }, [user, workspaceOwnerId, isWorkspaceOwner, publicSlug, personalDisplayName, personalProfile.email, personalProfile.mobile, personalProfile.photoURL, isEditorWorkspaceOpen, canManageWorkspace]);

            useEffect(() => {
                if (publicSlug || isGuestWorkspace || !isFirebaseConfigured || !db || !workspaceOwnerId) {
                    setFinancePaymentAttempts(prev => prev.length ? [] : prev);
                    return undefined;
                }

                const paymentAttemptsQuery = FirebaseSDK.query(
                    FirebaseSDK.collection(db, 'artifacts', appId, 'users', workspaceOwnerId, 'finance', 'paymentAttempts'),
                    FirebaseSDK.orderBy('updatedAtMs', 'desc'),
                    FirebaseSDK.limit(240)
                );
                const unsubscribe = FirebaseSDK.onSnapshot(paymentAttemptsQuery, (snapshot) => {
                    const nextAttempts = snapshot.docs.map((docSnap) => {
                        const data = docSnap.data() || {};
                        return {
                            id: docSnap.id,
                            gatewayType: data.gatewayType || 'stripe',
                            status: data.status || 'initiated',
                            amountInCents: Number(data.amountInCents || data.amountPaidInCents || 0),
                            currency: data.currency || settingsRef.current?.currency || 'ZAR',
                            customerName: data.customerName || data.clientName || 'Client',
                            bookingId: data.bookingId || '',
                            updatedAtMs: dateValueToMs(data.paidAt || data.updatedAt || data.createdAt)
                        };
                    });
                    setFinancePaymentAttempts(prev => areJsonEqual(prev, nextAttempts) ? prev : nextAttempts);
                }, (error) => console.error('Finance payment attempts sync failed', error));

                return () => unsubscribe();
            }, [workspaceOwnerId, publicSlug, isGuestWorkspace]);

            useEffect(() => {
                if (publicSlug) {
                    setBookingsReady(true);
                    return undefined;
                }
                if (isGuestWorkspace) {
                    setBookingsReady(true);
                    return undefined;
                }
                if (!isFirebaseConfigured || !db) {
                    setBookingsReady(true);
                    return undefined;
                }
                if (!user || !workspaceOwnerId) {
                    setBookings([]);
                    setBookingsReady(!loading);
                    return undefined;
                }

                const cachedBookings = readBookingsCache(workspaceOwnerId);
                if (cachedBookings?.bookings?.length) {
                    setBookings(prev => areJsonEqual(prev, cachedBookings.bookings) ? prev : cachedBookings.bookings);
                    setBookingsReady(true);
                } else {
                    setBookings([]);
                    setBookingsReady(false);
                }

                const bookingsCol = FirebaseSDK.collection(db, 'artifacts', appId, 'users', workspaceOwnerId, 'bookings');
                const bookingsQuery = FirebaseSDK.query(
                    bookingsCol,
                    FirebaseSDK.orderBy('timestamp', 'desc'),
                    FirebaseSDK.limit(250)
                );

                const unsubBookings = FirebaseSDK.onSnapshot(bookingsQuery, (snap) => {
                    const nextBookings = snap.docs
                        .map(doc => ({ id: doc.id, ...doc.data() }))
                        .sort((a, b) => getTimestampValue(b.timestamp) - getTimestampValue(a.timestamp));
                    writeBookingsCache(workspaceOwnerId, nextBookings);
                    setBookings(prev => areJsonEqual(prev, nextBookings) ? prev : nextBookings);
                    setBookingsReady(true);
                }, (error) => {
                    console.error('Booking sync failed', error);
                    const fallbackBookings = readBookingsCache(workspaceOwnerId);
                    if (fallbackBookings?.bookings?.length) {
                        setBookings(prev => areJsonEqual(prev, fallbackBookings.bookings) ? prev : fallbackBookings.bookings);
                    }
                    setBookingsReady(true);
                });

                return () => unsubBookings();
            }, [isGuestWorkspace, loading, publicSlug, user?.uid, workspaceOwnerId]);

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
                    const publishableSettings = stripEditorDraftFields(nextSettings);
                    const settingsToPublish = {
                        ...publishableSettings,
                        slug: publicSlug,
                        publishedAt: Date.now(),
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
                    await FirebaseSDK.deleteDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'users', workspaceOwnerId, 'config', 'editorDraft')).catch((draftError) => {
                        console.warn('Could not clear cloud editor draft after publish.', draftError);
                    });
                    cloudEditorDraftRef.current = null;
                    editorDraftCloudFingerprintRef.current = stableSettingsFingerprint(settingsToPublish);
                    clearEditorDraft(workspaceOwnerId || editorDraftOwnerKey);
                    if (!silent) showToast(successMessage);
                    return true;
                } catch (err) {
                    console.error(err);
                    if (!silent) showToast("Failed to publish.");
                    return false;
                }
            };

            const saveSettings = async () => {
                const saved = await publishSettings(settings);
                if (saved) clearWorkspaceDirty();
                return saved;
            };

            const saveSettingsDraft = async (nextSettings = settings, successMessage = "Editor draft saved.") => {
                const draftSettings = {
                    ...nextSettings,
                    draftStatus: 'saved',
                    draftName: themeTemplateName || nextSettings.draftName || 'Working Draft',
                    draftSavedAt: Date.now(),
                    draftAutosavedAt: Date.now(),
                    updatedAt: nextSettings.updatedAt || 0
                };
                const draftPayload = buildEditorDraftPayload(draftSettings, {
                    route: { view, activeTab, editorTab },
                    editorStudioScene,
                    status: 'saved',
                    name: draftSettings.draftName
                });
                if (isGuestWorkspace) {
                    setSettings(draftSettings);
                    clearWorkspaceDirty();
                    showToast(successMessage);
                    return true;
                }
                writeEditorDraft(workspaceOwnerId || editorDraftOwnerKey, draftPayload);
                if (!user || !workspaceOwnerId || !isFirebaseConfigured) {
                    setSettings(draftSettings);
                    clearWorkspaceDirty();
                    showToast(successMessage);
                    return true;
                }
                if (!canManageWorkspace) {
                    showToast("Only owners and admins can save workspace settings.");
                    return false;
                }
                try {
                    await FirebaseSDK.setDoc(
                        FirebaseSDK.doc(db, 'artifacts', appId, 'users', workspaceOwnerId, 'config', 'editorDraft'),
                        draftPayload,
                        { merge: true }
                    );
                    cloudEditorDraftRef.current = draftPayload;
                    editorDraftCloudFingerprintRef.current = stableSettingsFingerprint(draftPayload.settings);
                    setSettings(prev => ({ ...prev, ...draftSettings }));
                    clearWorkspaceDirty();
                    showToast(successMessage);
                    return true;
                } catch (err) {
                    console.error(err);
                    showToast("Draft could not be saved.");
                    return false;
                }
            };

            const saveEditorVersion = async () => {
                const savedAt = Date.now();
                const versionName = (editorDraftNameInput || '').trim() || settings.draftName || settings.brandName || 'Saved version';
                const versionSettings = {
                    ...settings,
                    draftName: versionName,
                    draftStatus: 'version',
                    draftSavedAt: savedAt,
                    draftAutosavedAt: savedAt,
                    updatedAt: settings.updatedAt || 0
                };
                const version = {
                    id: `version-${savedAt}`,
                    name: versionName,
                    savedAt,
                    route: { view, activeTab, editorTab },
                    editorStudioScene,
                    settings: versionSettings
                };
                const nextVersions = [version, ...editorDraftVersions.filter(item => item.id !== version.id)].slice(0, 12);
                if (!isGuestWorkspace) {
                    writeEditorDraftVersions(editorDraftOwnerKey, nextVersions);
                }
                setEditorDraftVersions(nextVersions);
                await saveSettingsDraft(versionSettings, `Saved "${versionName}".`);
                return true;
            };

            const restoreEditorVersion = (version) => {
                if (!version?.settings) return;
                markWorkspaceDirty();
                setSettings(prev => mergeStateIfChanged(prev, version.settings));
                if (version.route?.editorTab && editorTabIds.includes(version.route.editorTab)) {
                    setEditorTab(version.route.editorTab);
                }
                if (version.editorStudioScene) {
                    setEditorStudioScene(version.editorStudioScene);
                }
                setEditorDraftNameInput(version.name || version.settings.draftName || 'Restored version');
                if (!isGuestWorkspace) {
                    writeEditorDraft(editorDraftOwnerKey, buildEditorDraftPayload(version.settings, {
                        route: version.route || { view, activeTab, editorTab },
                        editorStudioScene: version.editorStudioScene || editorStudioScene,
                        status: 'restored',
                        name: version.name || version.settings.draftName || 'Restored version'
                    }));
                }
                showToast(`Restored "${version.name || 'saved version'}".`);
            };

            const deleteEditorVersion = (versionId) => {
                const nextVersions = editorDraftVersions.filter(version => version.id !== versionId);
                if (!isGuestWorkspace) {
                    writeEditorDraftVersions(editorDraftOwnerKey, nextVersions);
                }
                setEditorDraftVersions(nextVersions);
                showToast('Version removed.');
            };

            const openBookingPage = () => {
                if (typeof window === 'undefined') return;
                const opened = window.open(bookingPageUrl, '_blank');
                if (opened) {
                    opened.opener = null;
                    return;
                }
                if (!opened) {
                    window.location.assign(bookingPageUrl);
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

            const saveStaff = async (newList, previousList = staffList, options = {}) => {
                const profileForStaff = options.profile || personalProfile;
                const displayNameForStaff = options.displayName || personalDisplayName;
                const normalizedList = newList.map((staff, index) => {
                    if (staff.id === 'owner') {
                        return {
                            ...staff,
                            ...createOwnerStaffProfile({
                                ...user,
                                displayName: displayNameForStaff,
                                email: profileForStaff.email || user?.email || staff.email || '',
                                photoURL: profileForStaff.photoURL || staff.photoURL || user?.photoURL || '',
                                phoneNumber: profileForStaff.mobile || staff.phone || user?.phoneNumber || ''
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

            const saveFinanceImports = async (newList) => {
                setFinanceImports(newList);
                if (!user || !workspaceOwnerId || !isFirebaseConfigured) return;
                await FirebaseSDK.setDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'users', workspaceOwnerId, 'finance', 'imports'), { list: newList, updatedAt: Date.now() });
            };

            const getImportedClientKey = (client = {}) => {
                const emailKey = normalizeEmail(client.email || '');
                const phoneKey = String(client.phone || '').replace(/\D/g, '');
                if (emailKey) return `email:${emailKey}`;
                if (phoneKey) return `phone:${phoneKey}`;
                return `id:${client.id || buildClientKey(client.name, client.phone)}`;
            };

            const handleCsvMigrationImport = async (payload = {}) => {
                if (!canManageWorkspace) {
                    showToast('Only owners and admins can import CSV data.');
                    return { clients: 0, bookings: 0, financeRecords: 0 };
                }
                const now = Date.now();
                const batchId = payload.batchId || `csv-${now}`;
                const fileName = payload.fileName || '';
                const incomingClients = Array.isArray(payload.clients) ? payload.clients : [];
                const incomingBookings = Array.isArray(payload.bookings) ? payload.bookings : [];
                const incomingFinanceRecords = Array.isArray(payload.financeRecords) ? payload.financeRecords : [];
                const existingClientKeys = new Set(clientRecords.map(getImportedClientKey));
                const incomingClientKeys = new Set();
                const importedClients = incomingClients
                    .map(client => ({
                        ...client,
                        id: client.id || buildClientKey(client.name, client.phone),
                        source: 'csv-import',
                        importedViaCsv: true,
                        importBatchId: batchId,
                        importFileName: fileName,
                        importedAt: client.importedAt || now,
                        createdAt: client.createdAt || now,
                        updatedAt: now
                    }))
                    .filter(client => {
                        const key = getImportedClientKey(client);
                        if (existingClientKeys.has(key) || incomingClientKeys.has(key)) return false;
                        incomingClientKeys.add(key);
                        return true;
                    });
                const importedBookings = incomingBookings.map((booking, index) => ({
                    ...booking,
                    id: booking.id || `${batchId}-booking-${index + 1}`,
                    workspaceSlug: settings.slug || bookingPageSlug,
                    workspaceName: settings.brandName || settings.businessName || 'Build A Booking',
                    source: 'csv-import',
                    importedViaCsv: true,
                    importBatchId: batchId,
                    importFileName: fileName,
                    importedAt: booking.importedAt || now,
                    createdAt: booking.createdAt || booking.timestamp || now,
                    updatedAt: now,
                    timestamp: Number(booking.timestamp || booking.createdAt || now)
                }));
                const importedFinance = incomingFinanceRecords.map((record, index) => ({
                    ...record,
                    id: record.id || `${batchId}-finance-${index + 1}`,
                    source: 'csv-import',
                    importedViaCsv: true,
                    importBatchId: batchId,
                    importFileName: fileName,
                    importedAt: record.importedAt || now,
                    updatedAtMs: Number(record.updatedAtMs || record.paidAt || record.createdAt || now)
                }));

                if (!importedClients.length && !importedBookings.length && !importedFinance.length) {
                    showToast('No new CSV rows to import. Existing matching clients were left untouched.');
                    return { clients: 0, bookings: 0, financeRecords: 0 };
                }

                const bookingIds = new Set(importedBookings.map(booking => booking.id));
                setBookingsAndCache(prev => (
                    [...importedBookings, ...prev.filter(booking => !bookingIds.has(booking.id))]
                        .sort((a, b) => getTimestampValue(b.timestamp || b.updatedAt || b.createdAt) - getTimestampValue(a.timestamp || a.updatedAt || a.createdAt))
                ));
                const nextClients = [...importedClients, ...clientRecords];
                const financeIds = new Set(importedFinance.map(record => record.id));
                const nextFinanceImports = [
                    ...importedFinance,
                    ...financeImports.filter(record => !financeIds.has(record.id))
                ];

                try {
                    await Promise.all([
                        importedClients.length ? saveClients(nextClients) : Promise.resolve(),
                        importedFinance.length ? saveFinanceImports(nextFinanceImports) : Promise.resolve(),
                        (isFirebaseConfigured && user && workspaceOwnerId && importedBookings.length)
                            ? Promise.all(importedBookings.map((booking) => {
                                const { id, ...bookingPayload } = booking;
                                return FirebaseSDK.setDoc(
                                    FirebaseSDK.doc(db, 'artifacts', appId, 'users', workspaceOwnerId, 'bookings', id),
                                    bookingPayload
                                );
                            }))
                            : Promise.resolve()
                    ]);
                    const parts = [
                        importedClients.length ? `${importedClients.length} client${importedClients.length === 1 ? '' : 's'}` : '',
                        importedBookings.length ? `${importedBookings.length} booking${importedBookings.length === 1 ? '' : 's'}` : '',
                        importedFinance.length ? `${importedFinance.length} finance row${importedFinance.length === 1 ? '' : 's'}` : ''
                    ].filter(Boolean);
                    showToast(`Imported ${parts.join(', ')} from CSV.`);
                    return { clients: importedClients.length, bookings: importedBookings.length, financeRecords: importedFinance.length };
                } catch (error) {
                    console.error('CSV migration import failed', error);
                    showToast('CSV import could not be saved.');
                    return { clients: 0, bookings: 0, financeRecords: 0 };
                }
            };

            const handleClearCsvMigrationData = async () => {
                if (!canManageWorkspace) {
                    showToast('Only owners and admins can delete uploaded data.');
                    return { clients: 0, bookings: 0, financeRecords: 0 };
                }
                const importedClientCount = clientRecords.filter(client => client.importedViaCsv).length;
                const importedBookingCount = bookings.filter(booking => booking.importedViaCsv).length;
                const importedFinanceCount = financeImports.filter(record => record.importedViaCsv).length;
                const nextClients = clientRecords.filter(client => !client.importedViaCsv);
                const nextFinanceImports = financeImports.filter(record => !record.importedViaCsv);
                setBookingsAndCache(prev => prev.filter(booking => !booking.importedViaCsv));

                try {
                    await Promise.all([
                        saveClients(nextClients),
                        saveFinanceImports(nextFinanceImports),
                        (isFirebaseConfigured && user && workspaceOwnerId)
                            ? FirebaseSDK.getDocs(FirebaseSDK.query(
                                FirebaseSDK.collection(db, 'artifacts', appId, 'users', workspaceOwnerId, 'bookings'),
                                FirebaseSDK.where('importedViaCsv', '==', true)
                            )).then(snapshot => Promise.all(snapshot.docs.map(docSnap => (
                                FirebaseSDK.deleteDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'users', workspaceOwnerId, 'bookings', docSnap.id))
                            ))))
                            : Promise.resolve()
                    ]);
                    showToast('Deleted uploaded CSV data. Live records were left alone.');
                    return { clients: importedClientCount, bookings: importedBookingCount, financeRecords: importedFinanceCount };
                } catch (error) {
                    console.error('CSV migration clear failed', error);
                    showToast('Uploaded data could not be fully cleared.');
                    return { clients: 0, bookings: 0, financeRecords: 0 };
                }
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
                const previousAvatar = clientDirectory.find(client => client.id === clientId)?.avatar || '';
                requestImageCropUpload(file, {
                    folder: 'client-avatars',
                    title: 'Crop client photo',
                    ratioKey: 'square',
                    shape: 'circle'
                }, async (avatarUrl) => {
                    if (previousAvatar && previousAvatar !== avatarUrl) await deleteStorageAsset(previousAvatar);
                    upsertClientRecord(clientId, { avatar: avatarUrl });
                    showToast("Client photo updated");
                });
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

            useEffect(() => {
                return () => {
                    editorStudioAudioRef.current?.close?.();
                };
            }, []);

            const editorRoomPreviewTargets = {
                introduction: 'introduction',
                logo: 'introduction',
                banner: 'introduction',
                services: 'services',
                colours: 'introduction',
                typography: 'introduction',
                calendar: 'calendar',
                time: 'time',
                faq: 'faq',
                form: 'form',
                buttons: 'action',
                venue: 'venue-gallery',
                social: 'social'
            };
            const editorRoomScenes = [
                { id: 'introduction', number: '01', icon: MessageSquare, title: 'Introduction' },
                { id: 'logo', number: '02', icon: ImagePlus, title: 'Logo Placement' },
                { id: 'banner', number: '03', icon: Images, title: 'Banner Placement' },
                { id: 'services', number: '04', icon: Briefcase, title: 'Services' },
                { id: 'colours', number: '05', icon: Pipette, title: 'Colour Direction' },
                { id: 'typography', number: '06', icon: Type, title: 'Typography' },
                { id: 'calendar', number: '07', icon: Calendar, title: 'Calendar Style' },
                { id: 'time', number: '08', icon: Clock, title: 'Time Style' },
                { id: 'faq', number: '09', icon: HelpCircle, title: 'FAQ Setup' },
                { id: 'form', number: '10', icon: FileText, title: 'Client Form' },
                { id: 'buttons', number: '11', icon: SlidersHorizontal, title: 'Action Buttons' },
                { id: 'venue', number: '12', icon: Images, title: 'Venue & Maps' },
                { id: 'social', number: '13', icon: Globe, title: 'Social Media' }
            ];
            const roomTabMap = {
                introduction: 'identity',
                logo: 'identity',
                banner: 'identity',
                services: 'features',
                colours: 'themes',
                typography: 'visuals',
                calendar: 'visuals',
                time: 'visuals',
                faq: 'features',
                form: 'features',
                buttons: 'visuals',
                venue: 'features',
                social: 'features'
            };
            const focusEditorPreviewRoom = (roomId) => {
                if (typeof document === 'undefined') return;
                const runFrameCue = (className, duration = 1800) => {
                    window.requestAnimationFrame(() => {
                        const frame = document.querySelector('.editor-preview-frame');
                        const targets = [frame].filter(Boolean);
                        if (!targets.length) return;
                        targets.forEach(target => target.classList.remove(className));
                        void frame.offsetWidth;
                        targets.forEach(target => target.classList.add(className));
                        window.setTimeout(() => {
                            targets.forEach(target => target.classList.remove(className));
                        }, duration);
                    });
                };
                const focusPreviewTarget = (targetName, attempt = 0) => {
                    window.requestAnimationFrame(() => {
                        const frame = document.querySelector('.editor-preview-frame');
                        const previewScroller = frame?.querySelector('.overflow-y-auto');
                        const target = frame?.querySelector(`[data-preview-section="${targetName}"]`);
                        if (!target) {
                            if (attempt < 8) {
                                window.setTimeout(() => focusPreviewTarget(targetName, attempt + 1), 90);
                            }
                            return;
                        }
                        target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                        target.classList.remove('booking-preview-room-flash');
                        void target.offsetWidth;
                        target.classList.add('booking-preview-room-flash');
                        window.setTimeout(() => target.classList.remove('booking-preview-room-flash'), 2400);
                        previewScroller?.classList.add('is-room-scrolling');
                        window.setTimeout(() => previewScroller?.classList.remove('is-room-scrolling'), 900);
                    });
                };
                if (roomId === 'colours') {
                    return;
                }
                if (roomId === 'typography') {
                    runFrameCue('booking-preview-text-dance', 1800);
                    focusPreviewTarget(editorRoomPreviewTargets[roomId] || roomId);
                    return;
                }
                const targetName = editorRoomPreviewTargets[roomId] || roomId;
                focusPreviewTarget(targetName);
            };
            const openEditorRoom = (roomId) => {
                const normalizedRoomId = roomId === 'identity' ? 'introduction' : roomId;
                setEditorStudioModal(normalizedRoomId);
                setEditorTab(roomTabMap[normalizedRoomId] || 'identity');
                focusEditorPreviewRoom(normalizedRoomId);
                playEditorStudioSound('step');
            };
            useEffect(() => {
                if (activeTab !== 'editor' || !editorStudioModal) return undefined;
                const roomId = editorStudioModal === 'identity' ? 'introduction' : editorStudioModal;
                const timer = window.setTimeout(() => focusEditorPreviewRoom(roomId), 35);
                return () => window.clearTimeout(timer);
            }, [activeTab, editorStudioModal, editorCollapsed, previewKey]);
            const startEditorRoomNavDrag = (event) => {
                if (event.button !== undefined && event.button !== 0) return;
                event.preventDefault();
                event.stopPropagation();
                editorRoomNavDragRef.current?.cleanup?.();
                const drag = {
                    pointerId: event.pointerId,
                    startX: event.clientX,
                    startY: event.clientY,
                    originX: editorRoomNavOffset.x,
                    originY: editorRoomNavOffset.y
                };
                const moveDrag = (moveEvent) => {
                    if (moveEvent.pointerId !== drag.pointerId) return;
                    moveEvent.preventDefault();
                    const nextX = drag.originX + moveEvent.clientX - drag.startX;
                    const nextY = drag.originY + moveEvent.clientY - drag.startY;
                    setEditorRoomNavOffset({
                        x: Math.max(-260, Math.min(260, nextX)),
                        y: Math.max(-280, Math.min(280, nextY))
                    });
                };
                const endDrag = (endEvent) => {
                    if (endEvent?.pointerId !== undefined && endEvent.pointerId !== drag.pointerId) return;
                    window.removeEventListener('pointermove', moveDrag);
                    window.removeEventListener('pointerup', endDrag);
                    window.removeEventListener('pointercancel', endDrag);
                    editorRoomNavDragRef.current = null;
                };
                drag.cleanup = endDrag;
                editorRoomNavDragRef.current = drag;
                window.addEventListener('pointermove', moveDrag, { passive: false });
                window.addEventListener('pointerup', endDrag);
                window.addEventListener('pointercancel', endDrag);
                event.currentTarget.setPointerCapture?.(event.pointerId);
            };
            const moveEditorRoomNavDrag = (event) => {
                const drag = editorRoomNavDragRef.current;
                if (!drag || drag.pointerId !== event.pointerId) return;
                event.preventDefault();
                const nextX = drag.originX + event.clientX - drag.startX;
                const nextY = drag.originY + event.clientY - drag.startY;
                setEditorRoomNavOffset({
                    x: Math.max(-260, Math.min(260, nextX)),
                    y: Math.max(-280, Math.min(280, nextY))
                });
            };
            const endEditorRoomNavDrag = (event) => {
                const drag = editorRoomNavDragRef.current;
                if (drag?.pointerId === event.pointerId) {
                    event.currentTarget.releasePointerCapture?.(event.pointerId);
                    drag.cleanup?.(event);
                }
            };
            const handleInspect = (tab) => {
                if (activeTab !== 'editor') navigateWorkspaceTab('editor');
                setEditorCollapsed(false);
                const inspectRoomMap = {
                    identity: 'introduction',
                    introduction: 'introduction',
                    services: 'services',
                    calendar: 'calendar',
                    time: 'time',
                    faq: 'faq',
                    features: 'faq',
                    form: 'form',
                    social: 'social',
                    venue: 'venue',
                    action: 'buttons',
                    buttons: 'buttons',
                    copy: 'introduction',
                    visuals: 'calendar'
                };
                openEditorRoom(inspectRoomMap[tab] || tab);
            };
            const playEditorStudioSound = (type = 'open') => {
                if (!editorStudioSoundEnabled || typeof window === 'undefined') return;
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!AudioContext) return;
                try {
                    const context = editorStudioAudioRef.current || new AudioContext();
                    editorStudioAudioRef.current = context;
                    if (context.state === 'suspended') context.resume();
                    const now = context.currentTime;
                    const master = context.createGain();
                    master.gain.setValueAtTime(0.0001, now);
                    master.gain.exponentialRampToValueAtTime(type === 'complete' ? 0.06 : 0.035, now + 0.018);
                    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
                    master.connect(context.destination);

                    const playTone = (frequency, offset, duration, wave = 'sine', endFrequency = frequency) => {
                        const osc = context.createOscillator();
                        const gain = context.createGain();
                        osc.type = wave;
                        osc.frequency.setValueAtTime(frequency, now + offset);
                        osc.frequency.exponentialRampToValueAtTime(endFrequency, now + offset + duration);
                        gain.gain.setValueAtTime(0.0001, now + offset);
                        gain.gain.exponentialRampToValueAtTime(0.42, now + offset + 0.018);
                        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + duration);
                        osc.connect(gain);
                        gain.connect(master);
                        osc.start(now + offset);
                        osc.stop(now + offset + duration + 0.04);
                    };

                    if (type === 'complete') {
                        playTone(392, 0, 0.18, 'sine', 588);
                        playTone(588, 0.08, 0.2, 'triangle', 880);
                        playTone(1176, 0.18, 0.16, 'sine', 1568);
                    } else if (type === 'step') {
                        playTone(540, 0, 0.11, 'triangle', 760);
                        playTone(960, 0.05, 0.1, 'sine', 1120);
                    } else {
                        playTone(720, 0, 0.12, 'triangle', 520);
                    }
                } catch (error) {
                    console.warn('Editor studio sound unavailable', error);
                }
            };
            const playMobileNavSound = () => {
                if (typeof window === 'undefined') return;
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!AudioContext) return;
                try {
                    const context = editorStudioAudioRef.current || new AudioContext();
                    editorStudioAudioRef.current = context;
                    if (context.state === 'suspended') context.resume();
                    const now = context.currentTime;
                    const master = context.createGain();
                    master.gain.setValueAtTime(0.0001, now);
                    master.gain.exponentialRampToValueAtTime(0.052, now + 0.015);
                    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
                    master.connect(context.destination);
                    const playTone = (frequency, offset, duration, wave = 'triangle', endFrequency = frequency) => {
                        const osc = context.createOscillator();
                        const gain = context.createGain();
                        osc.type = wave;
                        osc.frequency.setValueAtTime(frequency, now + offset);
                        osc.frequency.exponentialRampToValueAtTime(endFrequency, now + offset + duration);
                        gain.gain.setValueAtTime(0.0001, now + offset);
                        gain.gain.exponentialRampToValueAtTime(0.36, now + offset + 0.012);
                        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + duration);
                        osc.connect(gain);
                        gain.connect(master);
                        osc.start(now + offset);
                        osc.stop(now + offset + duration + 0.03);
                    };
                    playTone(440, 0, 0.12, 'triangle', 660);
                    playTone(880, 0.045, 0.14, 'sine', 1320);
                    playTone(1760, 0.11, 0.1, 'sine', 2349);
                } catch (error) {
                    console.warn('Mobile nav sound unavailable', error);
                }
            };

            const handleSettingChange = (key, value) => {
                markWorkspaceDirty();
                setSettings(prev => ({ ...prev, [key]: value }));
            };
            const getEditorColorDepth = (paletteId, depthInput = settings.editorColorDepths || settings.editorColorDepth || 50) => {
                if (typeof depthInput === 'object' && depthInput !== null) {
                    return Number(depthInput[paletteId] ?? settings.editorColorDepths?.[paletteId] ?? settings.editorColorDepth ?? 50);
                }
                return Number(depthInput ?? settings.editorColorDepths?.[paletteId] ?? settings.editorColorDepth ?? 50);
            };
            const tuneColorByDepth = (color, depth = 50) => {
                const normalized = normalizeHexColor(color, '');
                if (!normalized) return '';
                const safeDepth = Math.max(0, Math.min(100, Number(depth) || 50));
                const electricColor = (input, intensity = 1) => {
                    const { r, g, b } = hexToRgb(input, '#050505');
                    const max = Math.max(r, g, b);
                    const min = Math.min(r, g, b);
                    if (max - min < 18) return mixHexColors(input, '#F8FAFC', 0.35 + (0.22 * intensity));
                    const channel = (value) => {
                        const isLead = value === max;
                        const leadValue = 230 + Math.round(25 * intensity);
                        const mutedValue = Math.round(value * (1 - (0.54 * intensity)));
                        return Math.max(0, Math.min(255, isLead ? leadValue : mutedValue));
                    };
                    return `#${[channel(r), channel(g), channel(b)].map(value => value.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
                };
                if (safeDepth <= 50) {
                    const amount = Math.min(0.82, (50 - safeDepth) / 50 * 0.82);
                    return mixHexColors(normalized, '#ffffff', amount);
                }
                if (safeDepth <= 76) {
                    const amount = Math.min(0.62, (safeDepth - 50) / 26 * 0.62);
                    return mixHexColors(normalized, '#050505', amount);
                }
                const neonAmount = Math.min(1, (safeDepth - 76) / 24);
                const deepBase = mixHexColors(normalized, '#050505', 0.5);
                return mixHexColors(deepBase, electricColor(normalized, neonAmount), 0.42 + (0.58 * neonAmount));
            };
            const activePaletteSampleBase = activePaletteFlow?.swatches?.[1] || activePaletteFlow?.swatches?.[0] || settings.primaryColor || '#050505';
            const activePaletteShadeColor = normalizeHexColor(tuneColorByDepth(activePaletteSampleBase, activePaletteShade * 10), settings.backgroundColor || '#050505');
            const activePaletteShadeText = readableTextFor(activePaletteShadeColor);
            const activePalettePreviewSwatches = (activePaletteFlow?.swatches || [activePaletteShadeColor]).slice(0, 3);
            const applyColorDirection = (paletteId, selectedIds = settings.editorColorMix || [], depthInput = settings.editorColorDepths || settings.editorColorDepth || 50) => {
                const paletteLookup = new Map(paletteFilterOptions.map(option => [option.id, option]));
                const ids = selectedIds.length ? selectedIds : [paletteId];
                const swatches = ids.flatMap(id => (
                    id === 'custom'
                        ? [tuneColorByDepth(customThemeColor, getEditorColorDepth(id, depthInput))]
                        : (paletteLookup.get(id)?.swatches || []).map(color => tuneColorByDepth(color, getEditorColorDepth(id, depthInput)))
                )).filter(Boolean).map(color => normalizeHexColor(color, '')).filter(Boolean);
                const firstPalette = ids[0] === 'custom'
                    ? [tuneColorByDepth(customThemeColor, getEditorColorDepth(ids[0], depthInput))]
                    : (paletteLookup.get(ids[0])?.swatches || swatches).map(color => tuneColorByDepth(color, getEditorColorDepth(ids[0], depthInput)));
                const lastPalette = ids[ids.length - 1] === 'custom'
                    ? [tuneColorByDepth(customThemeColor, getEditorColorDepth(ids[ids.length - 1], depthInput))]
                    : (paletteLookup.get(ids[ids.length - 1])?.swatches || swatches).map(color => tuneColorByDepth(color, getEditorColorDepth(ids[ids.length - 1], depthInput)));
                const firstSwatches = firstPalette.map(color => normalizeHexColor(color, '')).filter(Boolean);
                const lastSwatches = lastPalette.map(color => normalizeHexColor(color, '')).filter(Boolean);
                const richPrimary = firstSwatches[1] || firstSwatches[2] || firstSwatches[0] || swatches[1] || customThemeColor || settings.primaryColor || '#050505';
                const softSecondary = lastSwatches[0] || swatches[0] || '#bae6fd';
                const richAccent = lastSwatches[2] || lastSwatches[1] || swatches[2] || richPrimary;
                const primary = normalizeHexColor(richPrimary, '#050505');
                const secondary = normalizeHexColor(softSecondary, '#bae6fd');
                const accent = normalizeHexColor(richAccent, primary);
                const averageDepth = ids.reduce((total, id) => total + getEditorColorDepth(id, depthInput), 0) / Math.max(ids.length, 1);
                const pageText = readableTextFor(primary);
                const textIsLight = pageText === '#FFFFFF';
                const paletteBody = mixHexColors(primary, pageText, textIsLight ? 0.74 : 0.68);
                const paletteAction = pageText;
                const cardAlpha = textIsLight ? '14' : '10';
                const activeAlpha = averageDepth > 76 ? '26' : '1D';
                const borderAlpha = textIsLight ? '45' : '32';
                const activeText = pageText;
                const slotText = pageText;
                const actionText = readableTextFor(paletteAction);
                markWorkspaceDirty();
                setSettings(prev => ({
                    ...prev,
                    primaryColor: primary,
                    accentColor: accent,
                    backgroundColor: primary,
                    headingColor: pageText,
                    bodyColor: paletteBody,
                    dateActiveBgColor: `${pageText}${activeAlpha}`,
                    dateActiveTextColor: activeText,
                    dateBgColor: `${pageText}${cardAlpha}`,
                    dateTextColor: paletteBody,
                    slotBgColor: `${pageText}${cardAlpha}`,
                    slotTextColor: paletteBody,
                    slotActiveBgColor: `${pageText}${activeAlpha}`,
                    slotActiveTextColor: slotText,
                    buttonColor: paletteAction,
                    buttonTextColor: actionText,
                    faqBgColor: `${pageText}${cardAlpha}`,
                    faqBorderColor: `${pageText}${borderAlpha}`,
                    faqTextColor: pageText,
                    faqAnswerColor: paletteBody,
                    socialIconBgColor: `${pageText}${cardAlpha}`,
                    socialIconColor: paletteAction,
                    socialIconTextColor: actionText
                }));
            };
            const applyPaletteFlowColor = (paletteId = activePaletteFlowId, shade = activePaletteShade) => {
                const safePaletteId = paletteFlowOptions.some(option => option.id === paletteId) ? paletteId : activePaletteFlowId;
                const safeShade = Math.max(1, Math.min(10, Number(shade) || 5));
                const depth = safeShade * 10;
                const nextDepths = {
                    ...(settings.editorColorDepths || {}),
                    [safePaletteId]: depth
                };
                setThemeFilterValue('palette', safePaletteId);
                applyColorDirection(safePaletteId, [safePaletteId], nextDepths);
                setSettings(prev => ({
                    ...prev,
                    editorPaletteFlowColor: safePaletteId,
                    editorColorMix: [safePaletteId],
                    editorColorDepth: depth,
                    editorColorDepths: {
                        ...(prev.editorColorDepths || {}),
                        [safePaletteId]: depth
                    }
                }));
            };
            const applyFontStylePreset = (preset) => {
                if (!preset) return;
                markWorkspaceDirty();
                focusEditorPreviewRoom('typography');
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
                markWorkspaceDirty();
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
            const handleBannerDisplayChange = (key, value) => {
                markWorkspaceDirty();
                setSettings(prev => ({
                    ...prev,
                    bannerDisplay: {
                        visible: true,
                        height: 220,
                        position: 'center',
                        ...(prev.bannerDisplay || {}),
                        [key]: value
                    }
                }));
            };
            const handleFeatureChange = (key, value) => {
                markWorkspaceDirty();
                setSettings(prev => {
                    const nextFeatures = { ...prev.features, [key]: value };
                    if (key === 'collectClientEmail' && value === false) {
                        nextFeatures.emailUpdates = false;
                    }
                    return { ...prev, features: nextFeatures };
                });
            };
            const toggleFaqFeature = () => {
                markWorkspaceDirty();
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
            const deleteStorageAsset = async (url) => {
                if (!url || !isFirebaseConfigured || !storage || !FirebaseSDK.deleteObject) return;
                if (!String(url).startsWith('http')) return;
                try {
                    await FirebaseSDK.deleteObject(FirebaseSDK.ref(storage, url));
                } catch (error) {
                    console.warn('Storage asset delete skipped.', error);
                }
            };
            const requestImageCropUpload = async (file, options = {}, onComplete) => {
                if (!file) return;
                try {
                    const source = await readFileAsDataUrl(file);
                    imageCropCommitRef.current = {
                        folder: options.folder || 'uploads',
                        onComplete
                    };
                    setImageCropModal({
                        source,
                        fileName: file.name || 'image.jpg',
                        title: options.title || 'Crop image',
                        ratioKey: options.ratioKey || 'square',
                        shape: options.shape || 'rounded',
                        zoom: 1,
                        positionX: 50,
                        positionY: 50
                    });
                } catch (error) {
                    console.error(error);
                    showToast('Image could not be opened.');
                }
            };
            const handleImageCropSave = async () => {
                if (!imageCropModal || !imageCropCommitRef.current) return;
                setImageCropSaving(true);
                try {
                    const croppedFile = await buildCroppedImageFile(imageCropModal);
                    const { folder, onComplete } = imageCropCommitRef.current;
                    const url = await uploadAsset(croppedFile, folder);
                    setImageCropModal(null);
                    imageCropCommitRef.current = null;
                    const completionMessage = await onComplete?.(url, croppedFile);
                    if (completionMessage !== false) {
                        showToast(typeof completionMessage === 'string' ? completionMessage : 'Image saved.');
                    }
                } catch (error) {
                    console.error(error);
                    showToast('Image crop could not be saved.');
                } finally {
                    setImageCropSaving(false);
                }
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
                const nextSettings = {
                    ...settings,
                    accountProfiles: {
                        ...(settings.accountProfiles || {}),
                        [accountProfileKey]: nextProfile
                    }
                };
                const nextStaffList = (staffList || []).map(staff => {
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
                });

                setSettings(nextSettings);
                setAccountProfileOverride(nextProfile);
                setStaffList(nextStaffList);

                return { nextProfile, nextSettings, nextStaffList, nextDisplayName };
            };
            const persistProfileChanges = async (
                profileToSave = personalProfile,
                settingsToSave = settings,
                staffListToSave = displayStaffList,
                successMessage = 'Profile updated.'
            ) => {
                const displayName = [profileToSave.firstName, profileToSave.lastName].filter(Boolean).join(' ').trim() || personalDisplayName;
                const emailKey = normalizeEmail(profileToSave.email || user?.email || '');
                try {
                    if (isFirebaseConfigured && user?.uid) {
                        const accountPayload = {
                            uid: user.uid,
                            email: emailKey,
                            displayName,
                            firstName: profileToSave.firstName || '',
                            lastName: profileToSave.lastName || '',
                            mobile: profileToSave.mobile || '',
                            phone: profileToSave.mobile || '',
                            photoURL: profileToSave.photoURL || '',
                            personalProfile: {
                                ...profileToSave,
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
                        await publishSettings(settingsToSave, successMessage, { silent: true });
                    } else if (!isFirebaseConfigured) {
                        setSettings(settingsToSave);
                    }

                    if (canManageTeam) {
                        await saveStaff(staffListToSave, staffList, { profile: profileToSave, displayName });
                    }

                    showToast(successMessage);
                    return true;
                } catch (error) {
                    console.error(error);
                    showToast('Profile could not be saved.');
                    return false;
                }
            };
            const handlePersonalProfilePhotoUpload = async (file) => {
                if (!file) return;
                const previousPhoto = personalProfile.photoURL || '';
                requestImageCropUpload(file, {
                    folder: 'account-avatars',
                    title: 'Crop profile photo',
                    ratioKey: 'square',
                    shape: 'circle'
                }, async (url) => {
                    if (previousPhoto && previousPhoto !== url) await deleteStorageAsset(previousPhoto);
                    const { nextProfile, nextSettings, nextStaffList } = updatePersonalProfile({ photoURL: url });
                    await persistProfileChanges(nextProfile, nextSettings, nextStaffList, 'Profile photo saved.');
                    return false;
                });
            };
            const removePersonalProfilePhoto = async () => {
                const previousPhoto = personalProfile.photoURL || '';
                const { nextProfile, nextSettings, nextStaffList } = updatePersonalProfile({ photoURL: '' });
                await deleteStorageAsset(previousPhoto);
                await persistProfileChanges(nextProfile, nextSettings, nextStaffList, 'Profile photo removed.');
            };
            const saveProfileChanges = async () => {
                await persistProfileChanges();
            };
            const handleSettingImageUpload = async (key, file, folder) => {
                if (!file) return;
                const ratioKey = key === 'bannerImage' ? 'banner' : 'square';
                const previousUrl = settingsRef.current?.[key] || '';
                requestImageCropUpload(file, {
                    folder,
                    title: key === 'bannerImage' ? 'Crop booking banner' : 'Crop business logo',
                    ratioKey,
                    shape: key === 'bannerImage' ? 'rounded' : 'square'
                }, async (url) => {
                    if (previousUrl && previousUrl !== url) await deleteStorageAsset(previousUrl);
                    handleSettingChange(key, url);
                    showToast(key === 'bannerImage' ? 'Banner image updated' : 'Logo updated');
                });
            };
            const removeSettingImage = async (key) => {
                const previousUrl = settingsRef.current?.[key] || '';
                handleSettingChange(key, '');
                await deleteStorageAsset(previousUrl);
                showToast('Image removed');
            };
            const openSettingImageCrop = (key, folder) => {
                const currentUrl = settingsRef.current?.[key] || settings[key] || '';
                if (!currentUrl) {
                    showToast(key === 'bannerImage' ? 'Upload a banner in Business Profile first.' : 'Upload a logo in Business Profile first.');
                    return;
                }
                const ratioKey = key === 'bannerImage' ? 'banner' : 'square';
                imageCropCommitRef.current = {
                    folder,
                    onComplete: async (url) => {
                        if (currentUrl && currentUrl !== url) await deleteStorageAsset(currentUrl);
                        handleSettingChange(key, url);
                        showToast(key === 'bannerImage' ? 'Banner crop updated' : 'Logo crop updated');
                    }
                };
                setImageCropModal({
                    source: currentUrl,
                    fileName: key === 'bannerImage' ? 'booking-banner.jpg' : 'business-logo.jpg',
                    title: key === 'bannerImage' ? 'Adjust banner crop' : 'Adjust logo crop',
                    ratioKey,
                    shape: key === 'bannerImage' ? 'rounded' : 'square',
                    zoom: 1,
                    positionX: 50,
                    positionY: 50
                });
            };
            const handleVenuePhotoUpload = async (files) => {
                const photoFiles = Array.from(files || []).filter(Boolean).slice(0, 8);
                if (!photoFiles.length) return;
                const openVenueCrop = (index = 0) => {
                    const file = photoFiles[index];
                    if (!file) return;
                    requestImageCropUpload(file, {
                        folder: 'venue',
                        title: photoFiles.length > 1 ? `Crop venue photo ${index + 1}` : 'Crop venue photo',
                        ratioKey: 'gallery'
                    }, async (url) => {
                        const currentPhotos = Array.isArray(settingsRef.current.venuePhotos) ? settingsRef.current.venuePhotos : [];
                        const nextPhotos = [...currentPhotos, url].filter(Boolean).slice(0, 12);
                        handleSettingChange('venuePhotos', nextPhotos);
                        if (index + 1 < photoFiles.length) {
                            window.setTimeout(() => openVenueCrop(index + 1), 150);
                        } else {
                            showToast(photoFiles.length > 1 ? 'Venue photos added' : 'Venue photo added');
                        }
                    });
                };
                openVenueCrop();
            };
            const removeVenuePhoto = async (photoUrl) => {
                const currentPhotos = Array.isArray(settingsRef.current.venuePhotos) ? settingsRef.current.venuePhotos : [];
                handleSettingChange('venuePhotos', currentPhotos.filter(photo => photo !== photoUrl));
                await deleteStorageAsset(photoUrl);
                showToast('Venue photo removed');
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
                setActiveWorkspaceOwnerId('');
                setWorkspaceAccess([]);
                safeLocalRemove('build-a-booking-active-workspace');
                clearEditorDraft('guest');
                clearEditorDraftVersions('guest');
                resetWorkspaceRuntimeState();
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
                    setAuthError('Google sign-in is not connected in this build. Rebuild with the Firebase config and deploy again.');
                    showToast('Google sign-in is not connected yet.');
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
                    clearAuthReturnState();
                    clearGoogleAuthIntentUrl();
                    safeSessionRemove(googleCalendarRedirectStorageKey);
                    setAuthRedirectPending(false);
                    await applyAuthPersistence(keepLoggedIn);
                    const provider = createGoogleProvider();
                    await FirebaseSDK.signInWithPopup(auth, provider);
                    setGuestMode(false);
                    setClientGuestMode(false);
                    safeLocalRemove(guestModeStorageKey);
                    setAuthPanelOpen(false);
                    applyWorkspaceRoute(returnRoute);
                    showToast('Signed in with Google');
                } catch (error) {
                    console.error(error);
                    if (['auth/popup-blocked', 'auth/cancelled-popup-request', 'auth/web-storage-unsupported', 'auth/operation-not-supported-in-this-environment'].includes(error?.code)) {
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
                        : error?.code === 'auth/unauthorized-domain'
                            ? 'This domain is not allowed for Google sign-in. Add build-a-booking.web.app in Firebase Authentication authorized domains.'
                            : error?.code === 'auth/invalid-api-key'
                                ? 'This build has an invalid Firebase API key. Check the Firebase config and redeploy.'
                        : error?.code === 'auth/popup-closed-by-user'
                            ? 'Google sign-in was closed before it finished.'
                            : error.message || 'Could not sign in with Google.';
                    setAuthError(message);
                } finally {
                    setAuthBusy(false);
                }
            };
            const handleSignOut = async () => {
                if (!confirmLeavingUnsavedChanges()) return;
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
                clearEditorDraft('guest');
                clearEditorDraftVersions('guest');
                setWorkspaceAccess([]);
                setActiveWorkspaceOwnerId('');
                safeLocalRemove('build-a-booking-active-workspace');
                resetWorkspaceRuntimeState();
                clearWorkspaceDirty();
                saveWorkspaceRoute({ view: 'landing', activeTab: 'overview', editorTab: 'themes' });
                setView('landing');
                setActiveTab('overview');
                if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href);
                    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
                }
            };
            const handleDeleteAccount = async () => {
                if (isGuestWorkspace) {
                    setAccountDeleteOpen(false);
                    setAccountDeleteText('');
                    await handleSignOut();
                    return;
                }
                if (!user?.uid || !isFirebaseConfigured) {
                    showToast('Sign in before deleting an account.');
                    return;
                }
                if (accountDeleteText.trim().toUpperCase() !== 'DELETE') {
                    showToast('Type DELETE to confirm account deletion.');
                    return;
                }
                setAuthBusy(true);
                try {
                    const uid = user.uid;
                    const emailKey = normalizeEmail(user.email || personalProfile.email || '');
                    await Promise.allSettled([
                        FirebaseSDK.deleteDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'accounts', uid)),
                        emailKey ? FirebaseSDK.deleteDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'accountLookup', emailKey)) : Promise.resolve()
                    ]);
                    if (personalProfile.photoURL) await deleteStorageAsset(personalProfile.photoURL);
                    await FirebaseSDK.deleteUser(auth.currentUser);
                    setAccountDeleteOpen(false);
                    setAccountDeleteText('');
                    showToast('Account deleted.');
                    clearAuthReturnState();
                    setAuthRedirectPending(false);
                    setGuestMode(false);
                    setClientGuestMode(false);
                    safeLocalRemove(guestModeStorageKey);
                    setWorkspaceAccess([]);
                    setActiveWorkspaceOwnerId('');
                    clearWorkspaceDirty();
                    saveWorkspaceRoute({ view: 'landing', activeTab: 'overview', editorTab: 'themes' });
                    setView('landing');
                    setActiveTab('overview');
                    if (typeof window !== 'undefined') {
                        const url = new URL(window.location.href);
                        window.history.replaceState({}, '', `${url.pathname}${url.search}`);
                    }
                } catch (error) {
                    console.error(error);
                    if (error?.code === 'auth/requires-recent-login') {
                        showToast('Please sign out and sign in again before deleting your account.');
                    } else {
                        showToast('Account deletion could not finish.');
                    }
                } finally {
                    setAuthBusy(false);
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
                    serviceId: formData.serviceId || '',
                    serviceName: formData.serviceName || '',
                    serviceDescription: formData.serviceDescription || '',
                    servicePrice: formData.servicePrice || '',
                    servicePriceType: formData.servicePriceType || '',
                    serviceDuration: formData.serviceDuration || '',
                    serviceCategory: formData.serviceCategory || '',
                    paymentMethod: formData.paymentMethod || '',
                    paymentGateway: formData.paymentGateway || '',
                    paymentProviderName: formData.paymentProviderName || '',
                    paymentStatus: formData.paymentMethod ? 'manual_pending' : 'unpaid',
                    paymentReference: '',
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
                    setBookingsAndCache(prev => [{ id: `local-${Date.now()}`, ...bookingRecord }, ...prev]);
                    return true;
                }
                try {
                    const bookingRef = await FirebaseSDK.addDoc(FirebaseSDK.collection(db, 'artifacts', appId, 'users', workspaceOwnerId, 'bookings'), {
                        ...bookingRecord
                    });
                    await createOwnerNotification(makeOwnerNotification({
                        type: NOTIFICATION_TYPES.BOOKING_REQUEST,
                        title: `New booking request from ${bookingRecord.clientName}`,
                        body: `${bookingRecord.serviceName ? `${bookingRecord.serviceName} / ` : ''}${bookingRecord.date} at ${bookingRecord.time}. Review, confirm, or reply from Bookings.`,
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

            const handleManualBookingSubmit = async (event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const formData = new FormData(form);
                const bookingDateKey = String(formData.get('bookingDate') || '').trim();
                const bookingDate = bookingDateKey ? new Date(`${bookingDateKey}T00:00:00`) : new Date();
                const selectedServiceId = String(formData.get('serviceId') || 'custom');
                const selectedService = workspaceServices.find(service => service.id === selectedServiceId) || null;
                const customServiceName = String(formData.get('customServiceName') || '').trim();
                const serviceName = selectedService?.name || customServiceName || 'Manual service';
                const servicePrice = String(selectedService?.price ?? formData.get('servicePrice') ?? '').trim();
                const serviceDuration = String(selectedService?.duration ?? formData.get('serviceDuration') ?? '').trim();
                const serviceCategory = String(selectedService?.category ?? formData.get('serviceCategory') ?? '').trim();
                const paymentMethod = String(formData.get('paymentMethod') || '').trim();
                const paymentProviderName = {
                    cash: 'Cash',
                    manual_eft: 'Direct EFT',
                    stripe: 'Stripe',
                    yoco: 'Yoco',
                    payfast: 'PayFast',
                    paystack: 'Paystack',
                    ozow: 'Ozow'
                }[paymentMethod] || '';
                const priceNumber = Number(String(servicePrice).replace(/[^\d.]/g, ''));
                const now = Date.now();
                const bookingRecord = {
                    clientName: String(formData.get('clientName') || '').trim(),
                    clientPhone: String(formData.get('clientPhone') || '').trim(),
                    clientEmail: String(formData.get('clientEmail') || '').trim(),
                    clientBirthday: String(formData.get('clientBirthday') || '').trim(),
                    clientNote: String(formData.get('clientNote') || '').trim(),
                    clientEmailOptIn: Boolean(String(formData.get('clientEmail') || '').trim()),
                    serviceId: selectedService?.id || '',
                    serviceName,
                    serviceDescription: selectedService?.description || '',
                    servicePrice,
                    servicePriceType: selectedService?.priceType || 'fixed',
                    serviceDuration,
                    serviceCategory,
                    amountInCents: Number.isFinite(priceNumber) ? Math.round(priceNumber * 100) : 0,
                    currency: settings.currency || 'ZAR',
                    paymentMethod,
                    paymentGateway: ['stripe', 'yoco', 'payfast', 'paystack', 'ozow'].includes(paymentMethod) ? paymentMethod : '',
                    paymentProviderName,
                    paymentStatus: String(formData.get('paymentStatus') || (paymentMethod ? 'manual_pending' : 'unpaid')),
                    paymentReference: String(formData.get('paymentReference') || '').trim(),
                    notificationChannels: {
                        email: Boolean(String(formData.get('clientEmail') || '').trim()),
                        portal: Boolean(String(formData.get('clientEmail') || '').trim())
                    },
                    date: bookingDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
                    dateKey: bookingDateKey || getLocalDateStr(bookingDate),
                    time: String(formData.get('bookingTime') || '').trim(),
                    status: String(formData.get('bookingStatus') || 'confirmed'),
                    staffId: String(formData.get('staffId') || '').trim(),
                    noShowHistory: false,
                    source: 'manual-owner',
                    timestamp: now,
                    createdAt: now,
                    updatedAt: now
                };

                if (!bookingRecord.clientName || !bookingRecord.dateKey || !bookingRecord.time) {
                    showToast('Add a client name, date, and time first.');
                    return;
                }

                if (!isFirebaseConfigured || !user) {
                    setBookingsAndCache(prev => [{ id: `manual-${now}`, ...bookingRecord }, ...prev]);
                    setManualBookingOpen(false);
                    setBookingFilter('upcoming');
                    form.reset();
                    setManualBookingServiceId(workspaceServices[0]?.id || 'custom');
                    showToast('Manual booking added.');
                    return;
                }

                try {
                    const bookingRef = await FirebaseSDK.addDoc(FirebaseSDK.collection(db, 'artifacts', appId, 'users', workspaceOwnerId, 'bookings'), bookingRecord);
                    await createOwnerNotification(makeOwnerNotification({
                        type: NOTIFICATION_TYPES.BOOKING_REQUEST,
                        title: `Manual booking added for ${bookingRecord.clientName}`,
                        body: `${bookingRecord.serviceName} / ${bookingRecord.date} at ${bookingRecord.time}.`,
                        ownerId: workspaceOwnerId,
                        booking: { ...bookingRecord, id: bookingRef.id },
                        bookingId: bookingRef.id,
                        tab: 'bookings',
                        priority: 'normal'
                    }));
                    setManualBookingOpen(false);
                    setBookingFilter('upcoming');
                    form.reset();
                    setManualBookingServiceId(workspaceServices[0]?.id || 'custom');
                    showToast('Manual booking added.');
                } catch (error) {
                    console.error(error);
                    showToast('Manual booking could not be saved.');
                }
            };

            const createManualBookingFromChat = async (payload = {}) => {
                const bookingDateKey = String(payload.bookingDate || '').trim() || getLocalDateStr(new Date());
                const bookingDate = new Date(`${bookingDateKey}T00:00:00`);
                const selectedService = workspaceServices.find(service => service.id === payload.serviceId) || null;
                const serviceName = selectedService?.name || String(payload.serviceName || '').trim() || 'Manual service';
                const servicePrice = String(selectedService?.price ?? payload.servicePrice ?? '').trim();
                const serviceDuration = String(selectedService?.duration ?? payload.serviceDuration ?? '').trim();
                const priceNumber = Number(String(servicePrice).replace(/[^\d.]/g, ''));
                const now = Date.now();
                const bookingRecord = {
                    clientName: String(payload.clientName || '').trim(),
                    clientPhone: String(payload.clientPhone || '').trim(),
                    clientEmail: String(payload.clientEmail || '').trim(),
                    clientBirthday: String(payload.clientBirthday || '').trim(),
                    clientNote: String(payload.clientNote || '').trim(),
                    clientEmailOptIn: Boolean(String(payload.clientEmail || '').trim()),
                    serviceId: selectedService?.id || '',
                    serviceName,
                    serviceDescription: selectedService?.description || '',
                    servicePrice,
                    servicePriceType: selectedService?.priceType || 'fixed',
                    serviceDuration,
                    serviceCategory: selectedService?.category || '',
                    amountInCents: Number.isFinite(priceNumber) ? Math.round(priceNumber * 100) : 0,
                    currency: settings.currency || 'ZAR',
                    paymentMethod: '',
                    paymentGateway: '',
                    paymentProviderName: '',
                    paymentStatus: 'unpaid',
                    paymentReference: '',
                    notificationChannels: {
                        email: Boolean(String(payload.clientEmail || '').trim()),
                        portal: Boolean(String(payload.clientEmail || '').trim())
                    },
                    date: bookingDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
                    dateKey: bookingDateKey,
                    time: String(payload.bookingTime || '').trim(),
                    status: String(payload.bookingStatus || 'confirmed'),
                    staffId: String(payload.staffId || '').trim(),
                    noShowHistory: false,
                    source: 'support-chat',
                    threadId: String(payload.threadId || ''),
                    timestamp: now,
                    createdAt: now,
                    updatedAt: now
                };

                if (!bookingRecord.clientName || !bookingRecord.dateKey || !bookingRecord.time) {
                    showToast('Add a client name, date, and time first.');
                    return false;
                }

                if (!isFirebaseConfigured || !user) {
                    setBookingsAndCache(prev => [{ id: `manual-chat-${now}`, ...bookingRecord }, ...prev]);
                    setBookingFilter('upcoming');
                    showToast('Booking added from chat.');
                    return true;
                }

                try {
                    const bookingRef = await FirebaseSDK.addDoc(FirebaseSDK.collection(db, 'artifacts', appId, 'users', workspaceOwnerId, 'bookings'), bookingRecord);
                    await createOwnerNotification(makeOwnerNotification({
                        type: NOTIFICATION_TYPES.BOOKING_REQUEST,
                        title: `Chat booking added for ${bookingRecord.clientName}`,
                        body: `${bookingRecord.serviceName} / ${bookingRecord.date} at ${bookingRecord.time}.`,
                        ownerId: workspaceOwnerId,
                        booking: { ...bookingRecord, id: bookingRef.id },
                        bookingId: bookingRef.id,
                        tab: 'bookings',
                        priority: 'normal'
                    }));
                    setBookingFilter('upcoming');
                    showToast('Booking added from chat.');
                    return true;
                } catch (error) {
                    console.error(error);
                    showToast('Chat booking could not be saved.');
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
                    serviceId: formData.serviceId || '',
                    serviceName: formData.serviceName || '',
                    serviceDescription: formData.serviceDescription || '',
                    servicePrice: formData.servicePrice || '',
                    servicePriceType: formData.servicePriceType || '',
                    serviceDuration: formData.serviceDuration || '',
                    serviceCategory: formData.serviceCategory || '',
                    paymentMethod: formData.paymentMethod || '',
                    paymentGateway: formData.paymentGateway || '',
                    paymentProviderName: formData.paymentProviderName || '',
                    paymentStatus: formData.paymentMethod ? 'manual_pending' : 'unpaid',
                    paymentReference: '',
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
                const idempotencyKey = buildPublicBookingIdempotencyKey({
                    workspaceSlug: publicSlug,
                    formData,
                    dateKey: bookingRecord.dateKey,
                    date: bookingRecord.date,
                    time: bookingRecord.time,
                    serviceId: bookingRecord.serviceId
                });

                try {
                    if (functions && FirebaseSDK.httpsCallable) {
                        try {
                            const createPublicBookingRequest = FirebaseSDK.httpsCallable(functions, 'createPublicBookingRequest');
                            const result = await createPublicBookingRequest({
                                appId,
                                workspaceSlug: publicSlug,
                                idempotencyKey,
                                booking: {
                                    clientName: bookingRecord.clientName,
                                    clientPhone: bookingRecord.clientPhone,
                                    clientEmail: bookingRecord.clientEmail,
                                    clientEmailOptIn: bookingRecord.clientEmailOptIn,
                                    clientBirthday: bookingRecord.clientBirthday,
                                    clientNote: bookingRecord.clientNote,
                                    serviceId: bookingRecord.serviceId,
                                    serviceName: bookingRecord.serviceName,
                                    serviceDescription: bookingRecord.serviceDescription,
                                    servicePrice: bookingRecord.servicePrice,
                                    servicePriceType: bookingRecord.servicePriceType,
                                    serviceDuration: bookingRecord.serviceDuration,
                                    serviceCategory: bookingRecord.serviceCategory,
                                    paymentMethod: bookingRecord.paymentMethod,
                                    paymentGateway: bookingRecord.paymentGateway,
                                    paymentProviderName: bookingRecord.paymentProviderName,
                                    paymentStatus: bookingRecord.paymentStatus,
                                    date: bookingRecord.date,
                                    dateKey: bookingRecord.dateKey,
                                    time: bookingRecord.time,
                                    status: bookingRecord.status,
                                    notificationChannels: bookingRecord.notificationChannels
                                }
                            });
                            return result?.data || true;
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
                    const bookingRef = await FirebaseSDK.addDoc(FirebaseSDK.collection(db, 'artifacts', appId, 'users', publicWorkspace.ownerId, 'bookings'), bookingRecord);
                    const paymentReference = bookingRecord.paymentMethod ? bookingRef.id : '';
                    if (paymentReference) {
                        await FirebaseSDK.updateDoc(bookingRef, { paymentReference });
                    }
                    await FirebaseSDK.addDoc(FirebaseSDK.collection(db, 'artifacts', appId, 'public', 'data', 'workspaces', publicSlug, 'bookingSubmissions'), {
                        ...bookingRecord,
                        paymentReference
                    });
                    return { ok: true, bookingId: bookingRef.id, paymentReference, reused: false };
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
                    setBookingsAndCache(prev => prev.map(b => b.id === bookingId ? { ...b, ...updates } : b));
                    return;
                }
                setBookingsAndCache(prev => prev.map(b => b.id === bookingId ? { ...b, ...updates } : b));
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
                                serviceId: updates.serviceId ?? existingBooking?.serviceId ?? '',
                                serviceName: updates.serviceName ?? existingBooking?.serviceName ?? '',
                                serviceDescription: updates.serviceDescription ?? existingBooking?.serviceDescription ?? '',
                                servicePrice: updates.servicePrice ?? existingBooking?.servicePrice ?? '',
                                servicePriceType: updates.servicePriceType ?? existingBooking?.servicePriceType ?? '',
                                serviceDuration: updates.serviceDuration ?? existingBooking?.serviceDuration ?? '',
                                serviceCategory: updates.serviceCategory ?? existingBooking?.serviceCategory ?? '',
                                paymentMethod: updates.paymentMethod ?? existingBooking?.paymentMethod ?? '',
                                paymentGateway: updates.paymentGateway ?? existingBooking?.paymentGateway ?? '',
                                paymentProviderName: updates.paymentProviderName ?? existingBooking?.paymentProviderName ?? '',
                                paymentStatus: updates.paymentStatus ?? existingBooking?.paymentStatus ?? '',
                                paymentReference: updates.paymentReference ?? existingBooking?.paymentReference ?? '',
                                amountPaidInCents: updates.amountPaidInCents ?? existingBooking?.amountPaidInCents ?? 0,
                                paidAt: updates.paidAt ?? existingBooking?.paidAt ?? null,
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

            const markBookingPaid = async (booking) => {
                if (!booking?.id || booking.isExample) {
                    showToast('Example previews cannot be marked paid.');
                    return;
                }

                const amountInCents = Number.isSafeInteger(Number(booking.amountInCents))
                    ? Number(booking.amountInCents)
                    : parseAmountToCents(booking.servicePrice);
                const paymentMethod = booking.paymentMethod || booking.paymentGateway || 'manual';
                const updates = {
                    paymentStatus: 'paid',
                    paymentMethod,
                    paymentGateway: booking.paymentGateway || paymentMethod,
                    paymentProviderName: booking.paymentProviderName || (paymentMethod === 'cash' ? 'Cash' : 'Manual payment'),
                    manualPayment: true,
                    amountPaidInCents: amountInCents,
                    paidAt: Date.now()
                };

                if (functions && FirebaseSDK.httpsCallable && isFirebaseConfigured && user) {
                    try {
                        const callable = FirebaseSDK.httpsCallable(functions, 'markManualBookingPaid');
                        await callable({
                            appId,
                            businessId: workspaceOwnerId,
                            bookingId: booking.id,
                            paymentMethod,
                            amountInCents,
                            currency: booking.currency || 'ZAR'
                        });
                    } catch (error) {
                        console.error('markManualBookingPaid failed, applying local booking status update', error);
                    }
                }

                await updateBooking(booking.id, updates);
                showToast(`${booking.clientName || 'Booking'} marked as paid.`);
            };

            const deleteBooking = async (bookingId) => {
                if (!isFirebaseConfigured || !user) {
                    setBookingsAndCache(prev => prev.filter(b => b.id !== bookingId));
                    return;
                }
                setBookingsAndCache(prev => prev.filter(b => b.id !== bookingId));
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
                if (isGuestWorkspace) {
                    if (!confirmLeavingUnsavedChanges()) return;
                    setSupportThreadFocus({ threadId: `guest-thread-${booking.id}`, bookingId: booking.id, requestId: Date.now() });
                    setActiveTab('communications');
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

                if (!confirmLeavingUnsavedChanges()) return;
                setSupportThreadFocus({ threadId, bookingId: booking.id, requestId: Date.now() });
                setActiveTab('communications');
            };

            const openDashboardSupportThread = (thread) => {
                const linkedBooking = visibleBookings.find(booking => (
                    booking.id === thread?.bookingId ||
                    booking.threadId === thread?.id ||
                    notificationEmailKey(booking.clientEmail || '') === notificationEmailKey(thread?.clientEmail || '')
                ));
                if (linkedBooking) {
                    openBookingChat(linkedBooking);
                    return;
                }
                if (!thread?.id) {
                    navigateWorkspaceTab('communications');
                    return;
                }
                if (!confirmLeavingUnsavedChanges()) return;
                setSupportThreadFocus({ threadId: thread.id, bookingId: thread.bookingId || '', requestId: Date.now() });
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
                    type: NOTIFICATION_TYPES.REVIEW_REQUEST,
                    title: 'Quick follow-up from your visit',
                    body: `${settings.brandName || 'The business'} sent a quick thank-you and review request.`,
                    ownerId: workspaceOwnerId,
                    booking,
                    view: 'chats',
                    priority: 'normal'
                }));
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
                setBookingsAndCache(prev => prev.map(booking => {
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
                            <button type="button" aria-label="Close sign in panel" onClick={() => { setAuthPanelOpen(false); setAuthError(''); }} className="w-10 h-10 rounded-full bg-neutral-100 text-neutral-400 flex items-center justify-center hover:text-black transition-colors shrink-0"><X size={16}/></button>
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
                            <button type="button" aria-label="Close legal panel" onClick={() => setLegalPanel(null)} className="w-10 h-10 rounded-full bg-neutral-100 text-neutral-400 flex items-center justify-center hover:text-black transition-colors shrink-0"><X size={16}/></button>
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

            const bookingInfoDetails = bookingInfoDialog ? (() => {
                const booking = bookingInfoDialog;
                const serviceDetails = getBookingService(booking);
                const assignedStaff = staffList.find(staff => staff.id === booking.staffId);
                const serviceName = serviceDetails?.name || booking.serviceName || 'Not set';
                const serviceDuration = formatServiceDuration(serviceDetails?.duration || booking.duration);
                const servicePrice = formatServicePrice(serviceDetails || booking);
                const paymentStatus = booking.paymentStatus === 'paid'
                    ? 'Paid'
                    : booking.paymentStatus === 'manual_pending'
                        ? 'Pending manual payment'
                        : booking.paymentStatus || 'Not marked';
                return [
                    { label: 'Client', value: booking.clientName || 'Client' },
                    { label: 'Status', value: booking.status === 'waitlist' ? 'Standby' : booking.status || 'Pending' },
                    { label: 'Phone', value: booking.clientPhone || 'Not collected' },
                    { label: 'Email', value: booking.clientEmail || 'Not collected' },
                    { label: 'Birthday', value: booking.clientBirthday || 'Not collected' },
                    { label: 'Service', value: [serviceName, serviceDuration, servicePrice].filter(Boolean).join(' / ') },
                    { label: 'Date', value: booking.date || booking.dateKey || 'Not set' },
                    { label: 'Time', value: booking.time || 'Not set' },
                    { label: 'Staff', value: assignedStaff?.name || 'Unassigned' },
                    { label: 'Payment', value: paymentStatus },
                    { label: 'Method', value: booking.paymentMethod || booking.paymentGateway || 'Not selected' },
                    { label: 'Note', value: booking.clientNote || 'No note saved' }
                ];
            })() : [];

            const bookingInfoDialogView = bookingInfoDialog && (
                <div className="fixed inset-0 z-[1000] bg-black/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="booking-info-modal w-full sm:max-w-lg bg-white rounded-t-[1.5rem] sm:rounded-lg border border-neutral-100 shadow-2xl p-5 md:p-7 animate-in fade-in zoom-in-95 duration-300 max-h-[calc(100dvh-1rem)] overflow-y-auto">
                        <div className="flex items-start justify-between gap-4 mb-5">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400 mb-2">Booking Info</p>
                                <h2 className="text-2xl font-bold tracking-tight text-black">{bookingInfoDialog.clientName || 'Client'}</h2>
                                <p className="mt-2 text-sm leading-relaxed text-neutral-500">Full booking, client, staff, and payment context.</p>
                            </div>
                            <button type="button" aria-label="Close booking info" onClick={() => setBookingInfoDialog(null)} className="w-10 h-10 rounded-full bg-neutral-50 border border-neutral-100 flex items-center justify-center text-neutral-500 hover:text-black transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="booking-info-grid">
                            {bookingInfoDetails.map(item => (
                                <div key={item.label} className={`booking-info-field ${item.label === 'Note' ? 'is-wide' : ''}`}>
                                    <span>{item.label}</span>
                                    <strong>{item.value}</strong>
                                </div>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                const booking = bookingInfoDialog;
                                setBookingInfoDialog(null);
                                setConfirmDialog({
                                    eyebrow: 'Booking Record',
                                    title: 'Remove this booking?',
                                    body: 'This deletes the record from your workspace. Client profiles and other bookings stay untouched.',
                                    actionLabel: 'Remove',
                                    onConfirm: () => deleteBooking(booking.id)
                                });
                            }}
                            className="booking-info-danger-button mt-4"
                        >
                            <Trash2 size={14} /> Remove Booking
                        </button>
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
                            <button type="button" aria-label="Close late update" onClick={() => setRunningLateDialog(null)} className="w-10 h-10 rounded-full bg-neutral-50 border border-neutral-100 flex items-center justify-center text-neutral-500 hover:text-black transition-colors">
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

            const accountDeleteDialog = accountDeleteOpen && (
                <div className="fixed inset-0 z-[1000] bg-black/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="w-full sm:max-w-lg bg-white rounded-t-[1.5rem] sm:rounded-lg border border-neutral-100 shadow-2xl p-6 md:p-7 animate-in fade-in zoom-in-95 duration-300">
                        <div className="flex items-start justify-between gap-4 mb-5">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-red-500 mb-3">Delete Account</p>
                                <h2 className="text-2xl font-bold text-black">Permanently remove this account?</h2>
                                <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                                    This removes the signed-in account profile from Build A Booking. Type DELETE to confirm.
                                </p>
                            </div>
                            <button type="button" aria-label="Close account deletion" onClick={() => { setAccountDeleteOpen(false); setAccountDeleteText(''); }} className="w-10 h-10 rounded-full bg-neutral-50 border border-neutral-100 flex items-center justify-center text-neutral-500 hover:text-black transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                        <label className="block mb-6">
                            <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-400 mb-2">Confirmation</span>
                            <input
                                value={accountDeleteText}
                                onChange={(event) => setAccountDeleteText(event.target.value)}
                                placeholder="Type DELETE"
                                className="w-full h-12 rounded-lg bg-neutral-50 border border-neutral-100 px-4 text-sm font-bold text-black outline-none focus:bg-white focus:border-black transition-colors"
                            />
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button type="button" onClick={() => { setAccountDeleteOpen(false); setAccountDeleteText(''); }} className="h-12 rounded-full bg-white border border-neutral-200 text-black text-[10px] font-bold uppercase tracking-[0.12em] hover:border-black transition-colors">
                                Cancel
                            </button>
                            <button type="button" onClick={handleDeleteAccount} disabled={authBusy || accountDeleteText.trim().toUpperCase() !== 'DELETE'} className="h-12 rounded-full bg-red-500 text-white text-[10px] font-bold uppercase tracking-[0.12em] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-600 transition-colors">
                                Delete Account
                            </button>
                        </div>
                    </div>
                </div>
            );

            const editorPreviewFrame = getEditorPreviewFrame(device, isCompactEditorViewport);
            const editorPreviewFrameClass = device === 'desktop'
                ? (isCompactEditorViewport ? 'rounded-lg border-[12px]' : 'rounded-lg border-[22px]')
                : (isCompactEditorViewport ? 'rounded-[3rem] border-[12px]' : 'rounded-[5rem] md:rounded-[5.5rem] border-[16px] md:border-[18px]');
            const showPortraitDesktopEditorPrompt = isPortraitMobileRuntime && device === 'desktop';
            const handleEditorDeviceChange = async (nextDevice) => {
                setDevice(nextDevice);
                if (nextDevice !== 'desktop' || !isPortraitMobileRuntime) return;
                setEditorStudioModal(null);
                try {
                    await window.screen?.orientation?.lock?.('landscape');
                } catch (error) {
                    // The rotate prompt in the preview handles locked-orientation browsers.
                }
            };
            const classifyWorkspaceNotification = (notification = {}) => {
                const text = `${notification.type || ''} ${notification.title || ''} ${notification.body || ''}`.toLowerCase();
                if (text.includes('reschedule') || text.includes('move') || text.includes('change time')) return 'reschedules';
                if (text.includes('message') || text.includes('chat') || text.includes('reply')) return 'messages';
                if (text.includes('payment') || text.includes('paid') || text.includes('invoice')) return 'payments';
                if (text.includes('waitlist')) return 'waitlist';
                if (text.includes('request') || text.includes('booking')) return 'requests';
                return 'alerts';
            };
            const profileNotificationItems = sortDashboardLatest([
                ...workspaceNotifications.map(notification => {
                    const category = classifyWorkspaceNotification(notification);
                    return {
                        id: `notification-${notification.id}`,
                        kind: 'notification',
                        category,
                        iconKind: category === 'payments' ? 'payment' : category === 'messages' ? 'chat' : category === 'reschedules' ? 'reschedule' : category === 'requests' || category === 'waitlist' ? 'booking' : 'notification',
                        title: notification.title || 'Workspace update',
                        detail: notification.body || 'Open Build A Booking for the latest update.',
                        time: dateValueToMs(notification.createdAtMs || notification.createdAt || notification.updatedAt),
                        label: notification.read ? 'Read' : 'Unread',
                        isUnread: !notification.read,
                        source: notification
                    };
                }),
                ...dashboardSupportThreads.map(thread => {
                    const isReschedule = threadMatchesDashboardFilter(thread, 'reschedule');
                    const isWaitlist = threadMatchesDashboardFilter(thread, 'waitlist');
                    const category = isReschedule ? 'reschedules' : isWaitlist ? 'waitlist' : 'messages';
                    return {
                        id: `chat-${thread.id}`,
                        kind: 'chat',
                        category,
                        iconKind: isReschedule ? 'reschedule' : 'chat',
                        title: thread.clientName || 'Client chat',
                        detail: thread.lastMessage || `${thread.serviceName || 'Booking'} thread is open.`,
                        time: dateValueToMs(thread.lastMessageAt || thread.updatedAt || thread.createdAt),
                        label: Number(thread.ownerUnread || 0) > 0 ? `${thread.ownerUnread} unread` : category === 'waitlist' ? 'Waitlist' : 'Chat',
                        isUnread: Number(thread.ownerUnread || 0) > 0,
                        source: thread
                    };
                }),
                ...dashboardPortfolio.financeActivity.map(record => ({
                    id: `payment-${record.title}-${record.updatedAtMs}-${record.amountLabel}`,
                    kind: 'payment',
                    category: 'payments',
                    iconKind: 'payment',
                    title: record.title || 'Payment activity',
                    detail: record.detail || record.amountLabel || 'Finance update',
                    time: Number(record.updatedAtMs || 0),
                    label: record.amountLabel || 'Payment',
                    isUnread: record.normalizedStatus !== 'paid',
                    source: record
                })),
                ...dashboardPortfolio.periodActiveBookings.map(booking => {
                    const status = String(booking.status || '').toLowerCase();
                    const category = bookingMatchesDashboardFilter(booking, 'reschedule')
                        ? 'reschedules'
                        : status === 'waitlist'
                            ? 'waitlist'
                            : status === 'confirmed'
                                ? 'confirmed'
                                : 'requests';
                    return {
                        id: `booking-${booking.id}`,
                        kind: 'booking',
                        category,
                        iconKind: category === 'reschedules' ? 'reschedule' : 'booking',
                        title: booking.clientName || 'Booking',
                        detail: `${booking.serviceName || 'Booking'} / ${booking.date || booking.dateKeyResolved || 'Date'} / ${booking.time || 'Time pending'}`,
                        time: getBookingDashboardTime(booking),
                        label: category === 'reschedules' ? 'Reschedule' : category === 'waitlist' ? 'Waitlist' : status || 'Booking',
                        isUnread: status === 'pending' || status === 'waitlist' || category === 'reschedules',
                        source: booking
                    };
                })
            ], item => item.time).slice(0, 48);
            const profileNotificationFilterOptions = [
                { id: 'all', label: 'All' },
                { id: 'requests', label: 'Requests' },
                { id: 'messages', label: 'Messages' },
                { id: 'reschedules', label: 'Reschedules' },
                { id: 'waitlist', label: 'Waitlist' },
                { id: 'payments', label: 'Payments' }
            ].map(option => ({
                ...option,
                count: option.id === 'all'
                    ? profileNotificationItems.length
                    : profileNotificationItems.filter(item => item.category === option.id).length
            }));
            const filteredProfileNotifications = profileNotificationItems.filter(item => (
                profileNotificationFilter === 'all' || item.category === profileNotificationFilter
            ));
            const profileSystemActivityItems = sortDashboardLatest([
                {
                    id: 'system-services',
                    kind: 'system',
                    category: 'services',
                    iconKind: 'services',
                    title: 'Service menu ready',
                    detail: `${workspaceServices.length} services with duration, price, and booking-page display settings.`,
                    time: dateValueToMs(settings.servicesUpdatedAt || settings.updatedAt) || Date.now() - 6 * 60 * 1000,
                    label: 'Services'
                },
                {
                    id: 'system-team',
                    kind: 'system',
                    category: 'team',
                    iconKind: 'team',
                    title: 'Team calendars connected',
                    detail: `${displayStaffList.length} staff profiles available for bookings and schedule visibility.`,
                    time: dateValueToMs(settings.staffUpdatedAt || settings.updatedAt) || Date.now() - 16 * 60 * 1000,
                    label: 'Team'
                },
                {
                    id: 'system-schedule',
                    kind: 'system',
                    category: 'schedule',
                    iconKind: 'schedule',
                    title: 'Schedule capacity synced',
                    detail: `${dashboardPortfolio.capacity} slots in this period with ${dashboardPortfolio.reservedSlots} confirmed.`,
                    time: dateValueToMs(settings.scheduleUpdatedAt || settings.updatedAt) || Date.now() - 29 * 60 * 1000,
                    label: 'Schedule'
                },
                {
                    id: 'system-editor',
                    kind: 'system',
                    category: 'editor',
                    iconKind: 'editor',
                    title: 'Booking page configured',
                    detail: `${settings.brandName || 'Your booking page'} is using ${settings.serviceDisplayMode === 'dropdown' ? 'dropdown flow' : 'display flow'} with live theme settings.`,
                    time: dateValueToMs(settings.editorUpdatedAt || settings.updatedAt) || Date.now() - 44 * 60 * 1000,
                    label: 'Editor'
                },
                {
                    id: 'system-finance',
                    kind: 'system',
                    category: 'finance',
                    iconKind: 'payment',
                    title: 'Finance desk aligned',
                    detail: `${dashboardPortfolio.totalRevenueLabel} revenue and ${dashboardPortfolio.pendingRevenueLabel} pending across this view.`,
                    time: dateValueToMs(settings.financeUpdatedAt || settings.updatedAt) || Date.now() - 61 * 60 * 1000,
                    label: 'Finance'
                },
                {
                    id: 'system-migration',
                    kind: 'system',
                    category: 'migration',
                    iconKind: 'migration',
                    title: 'Migration Studio available',
                    detail: `${importedMigrationCounts.clients + importedMigrationCounts.bookings + importedMigrationCounts.financeRecords} imported records can be reviewed or cleared.`,
                    time: Date.now() - 83 * 60 * 1000,
                    label: 'Migration'
                }
            ], item => item.time);
            const profileSystemFilterOptions = [
                { id: 'all', label: 'All' },
                { id: 'services', label: 'Services' },
                { id: 'team', label: 'Team' },
                { id: 'schedule', label: 'Schedule' },
                { id: 'editor', label: 'Editor' },
                { id: 'finance', label: 'Finance' }
            ].map(option => ({
                ...option,
                count: option.id === 'all'
                    ? profileSystemActivityItems.length
                    : profileSystemActivityItems.filter(item => item.category === option.id).length
            }));
            const filteredProfileSystemActivity = profileSystemActivityItems.filter(item => (
                profileSystemFilter === 'all' || item.category === profileSystemFilter
            ));
            const profileActivityRows = filteredProfileSystemActivity;
            const profileActivityPrimaryCount = profileSystemActivityItems.length;
            const profileActivitySecondaryCount = profileSystemFilterOptions.filter(option => option.id !== 'all' && option.count > 0).length;
            const handleProfileActivityOpen = (item) => {
                if (!item) return;
                if (item.kind === 'notification') {
                    if (item.source?.id && !item.source.read) markWorkspaceNotificationRead(item.source.id);
                    openOwnerNotification(item.source);
                    return;
                }
                if (item.kind === 'chat') {
                    openDashboardSupportThread(item.source);
                    return;
                }
                if (item.kind === 'payment') {
                    navigateWorkspaceTab('finance');
                    return;
                }
                if (item.kind === 'system') {
                    if (item.category === 'services') navigateWorkspaceTab('services');
                    if (item.category === 'team') navigateWorkspaceTab('staff');
                    if (item.category === 'schedule') navigateWorkspaceTab('business');
                    if (item.category === 'editor') navigateWorkspaceTab('editor');
                    if (item.category === 'finance') navigateWorkspaceTab('finance');
                    if (item.category === 'migration') setActiveProfileSection('migration');
                    return;
                }
                if (item.kind === 'booking') {
                    setBookingDeskPeriod(dashboardPeriod === 'all' ? 'all' : dashboardPeriod);
                    setBookingFilter('all');
                    setBookingSearch(item.source?.clientName || '');
                    navigateWorkspaceTab('bookings');
                }
            };
            const profileSections = [
                {
                    id: 'account',
                    title: 'Account & Access',
                    note: isGuestWorkspace ? 'Guest workspace controls' : user?.email || 'Owner account',
                    icon: ShieldCheck,
                    meta: workspaceRole,
                    quick: ['Photo & name', 'Login state', 'Team identity']
                },
                {
                    id: 'billing',
                    title: 'Plan & Billing',
                    note: 'Plans, checkout, and billing portal',
                    icon: Briefcase,
                    meta: 'Ready',
                    quick: ['Upgrade plan', 'Billing portal', 'Plan status']
                },
                {
                    id: 'business',
                    title: 'Business Details',
                    note: settings.brandName || 'Brand, venue gallery, links, logo, and banner',
                    icon: Images,
                    meta: settings.slug || 'booking',
                    quick: ['Logo & banner', 'Venue gallery', 'Social links']
                },
                {
                    id: 'activity',
                    title: 'Activity Center',
                    note: 'Internal changes, setup, and workspace health',
                    icon: Settings2,
                    meta: `${profileActivityPrimaryCount} signals`,
                    quick: ['Services', 'Team', 'Schedule']
                },
                {
                    id: 'migration',
                    title: 'Migration Studio',
                    note: 'CSV import for clients, bookings, and finance history',
                    icon: FileText,
                    meta: `${importedMigrationCounts.clients + importedMigrationCounts.bookings + importedMigrationCounts.financeRecords} uploads`,
                    quick: ['Upload CSV', 'Choose fields', 'Delete uploads']
                },
                {
                    id: 'manual',
                    title: 'Owner Manual',
                    note: 'Feature guide and setup help',
                    icon: BookOpen,
                    meta: 'Guide',
                    quick: ['Setup guide', 'Feature map', 'Best practices'],
                    action: () => setShowOwnerManual(true)
                }
            ];
            const activeProfileSectionMeta = profileSections.find(section => section.id === activeProfileSection);
            const venuePhotos = Array.isArray(settings.venuePhotos) ? settings.venuePhotos.filter(Boolean) : [];

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
                            <AppErrorBoundary compact label="Booking Page" resetKey={publicSlug}>
                                <BookingFlow settings={{ ...publicWorkspace, manualPaymentOptions: publicManualPaymentOptions }} onComplete={handlePublicBookingComplete} onInstallApp={handleAddToHomeScreen} />
                            </AppErrorBoundary>
                        </Suspense>
                    </div>
                );
            }

            if (view === 'client') {
                const clientPortalUser = user || (clientGuestMode ? {
                    uid: 'guest-client-preview',
                    displayName: 'Mina Patel',
                    email: 'mina.patel@jump-client.example',
                    photoURL: ''
                } : null);

                if (!clientPortalUser) {
                    return (
                        <div className="native-ui min-h-screen flex items-start sm:items-center justify-center px-6 pt-14 pb-10 sm:p-6 bg-white text-black">
                            {authDialog}
                            <div className="max-w-md text-center">
                                <BuildABookingBrand className="w-52 sm:w-60 mx-auto mb-8 sm:mb-10" variant="dark" />
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
                        <AppErrorBoundary compact label="Client Portal" resetKey={`${clientPortalUser?.uid || 'guest'}-light`}>
                            <ClientPortal
                                appId={appId}
                                db={clientGuestMode ? null : db}
                                user={clientPortalUser}
                                isGuestPreview={clientGuestMode}
                                onSignOut={clientGuestMode ? () => {
                                    setClientGuestMode(false);
                                    applyWorkspaceRoute({ view: 'landing' });
                                } : handleSignOut}
                                onOwnerLogin={() => applyWorkspaceRoute({ view: 'dashboard', activeTab: 'overview', editorTab })}
                                onInstallApp={handleAddToHomeScreen}
                            />
                        </AppErrorBoundary>
                    </Suspense>
                );
            }

            if (view === 'landing') {
                return (
                  <div className="native-ui native-home min-h-screen font-sans selection:bg-black selection:text-white overflow-x-hidden bg-white text-black">
                    {/* Navigation */}
                    <nav className="fixed w-full z-50 bg-white/82 backdrop-blur-xl border-b border-neutral-200/50 transition-all native-home-nav">
                      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 h-16 md:h-20 flex items-center justify-between">
                        <div className="flex items-center cursor-pointer" onClick={() => setView('landing')}>
                          <BuildABookingBrand className="w-[156px] md:w-[188px] h-auto" variant="dark" />
                        </div>
                        <div className="flex items-center gap-2 md:gap-6">
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

                    <LandingFeatureBook />

                    <section className="landing-stop-section px-4 sm:px-6 py-16 md:py-24 border-b border-neutral-100">
                      <div className="landing-stop-panel max-w-7xl mx-auto">
                        <div className="landing-benefits-layout">
                          <article className="landing-benefits-command">
                            <div className="landing-benefits-command-head">
                              <div>
                                <span>Replace the busywork</span>
                                <strong>10<br />problems<br />gone</strong>
                              </div>
                            </div>
                            <div className="landing-benefit-chip-grid" aria-label="Problems Build A Booking helps stop">
                              {landingStopActions.map(action => (
                                <span key={action} className="landing-benefit-chip">
                                  <X size={13} />
                                  {action}
                                </span>
                              ))}
                            </div>
                          </article>

                          <article className="landing-benefits-gain">
                            <div className="landing-benefits-gain-head">
                              <div>
                                <span>Let your software work</span>
                                <strong>10<br />wins<br />gained</strong>
                              </div>
                            </div>
                            <div className="landing-gain-chip-grid" aria-label="Benefits Build A Booking gives your business">
                              {landingGainActions.map(action => (
                                <span key={action} className="landing-gain-chip">
                                  <Check size={13} />
                                  {action}
                                </span>
                              ))}
                            </div>
                          </article>
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

                    <LandingPaymentRail />
                  </div>
                );
            }

            return (
                <div
                    className={`flex h-screen overflow-hidden font-sans relative native-ui dashboard-light ${sidebarCollapsed ? 'dashboard-sidebar-is-collapsed' : ''} ${activeTab === 'editor' ? 'dashboard-editor-active' : ''}`}
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
                {bookingInfoDialogView}
                {runningLateActionDialog}
                {accountDeleteDialog}
                <ImageCropModal
                    crop={imageCropModal}
                    saving={imageCropSaving}
                    onChange={(updates) => setImageCropModal(prev => (prev ? { ...prev, ...updates } : prev))}
                    onClose={() => {
                        if (imageCropSaving) return;
                        setImageCropModal(null);
                        imageCropCommitRef.current = null;
                    }}
                    onSave={handleImageCropSave}
                />
                {showOwnerManual && (
                    <Suspense fallback={<LazySectionFallback label="Loading manual" />}>
                        <AppErrorBoundary compact label="Owner Manual" resetKey="light">
                            <OwnerManual
                                onClose={() => setShowOwnerManual(false)}
                                onNavigate={(targetTab, targetEditorTab) => {
                                    if (!navigateWorkspaceTab(targetTab, targetEditorTab)) return;
                                    setShowOwnerManual(false);
                                }}
                            />
                        </AppErrorBoundary>
                    </Suspense>
                )}
                <div className={`dashboard-sidebar hidden md:flex transition-all duration-700 ease-in-out bg-white border-r border-neutral-100 flex-col relative z-50 shadow-sm ${sidebarCollapsed ? 'w-0 opacity-0 pointer-events-none' : 'w-80 p-8'}`}>
                    {!sidebarCollapsed && (
                    <>
                        <div className="flex items-center mb-8 px-2 cursor-pointer group" onClick={() => applyWorkspaceRoute({ view: 'landing' })}>
                            <BuildABookingBrand className="w-[190px] h-auto transition-transform duration-300 group-hover:scale-[1.02]" variant="dark" />
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
                                <button key={item.id} data-tour={`nav-${item.id}`} onClick={() => navigateWorkspaceTab(item.id)} className={`w-full flex items-center gap-5 px-6 py-5 rounded-lg text-[11px] font-bold transition-all duration-700 ${activeTab === item.id ? 'bg-[#39FF14] text-black shadow-xl shadow-[#39FF14]/20 scale-[1.02]' : 'text-neutral-400 hover:bg-neutral-50 hover:text-black'}`}>
                                <IconCmp size={18} strokeWidth={2.5} /> {item.label.toUpperCase()}
                                {item.badge && <div className={`ml-auto w-2 h-2 rounded-full animate-pulse ${activeTab === item.id ? 'bg-black' : 'bg-[#39FF14]'}`} />}
                                </button>
                            );
                        })}
                        </nav>
                        <div className="mt-auto space-y-4 pt-6 border-t border-neutral-100">
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

                <button
                    type="button"
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    aria-label={sidebarCollapsed ? 'Expand owner navigation' : 'Collapse owner navigation'}
                    title={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
                    className="desktop-sidebar-toggle hidden md:flex fixed bottom-6 left-6 md:bottom-10 md:left-10 z-[100] w-12 h-12 bg-white border border-neutral-100 rounded-full shadow-2xl items-center justify-center text-neutral-400 hover:text-black transition-all hover:scale-110"
                >
                    {sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
                </button>

                <nav className="desktop-bottom-nav hidden md:flex fixed left-1/2 bottom-5 z-[120]" aria-label="Desktop workspace navigation">
                    <div className="desktop-nav-dock">
                        {navItems.map(item => {
                            const IconCmp = item.icon;
                            const isActive = activeTab === item.id;
                            return (
                                <button
                                    key={item.id}
                                    data-tour={`desktop-dock-${item.id}`}
                                    type="button"
                                    aria-current={isActive ? 'page' : undefined}
                                    aria-label={item.label}
                                    title={item.label}
                                    onClick={() => navigateWorkspaceTab(item.id)}
                                    className={`desktop-nav-tab ${isActive ? 'is-active' : ''}`}
                                >
                                    <span className="desktop-nav-tab-icon">
                                        <IconCmp size={18} strokeWidth={2.35} />
                                        {item.badge && <i />}
                                    </span>
                                    <span>{item.id === 'communications' ? 'Support' : item.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </nav>

                <nav className={`mobile-bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-[120] transition-all duration-500 ${mobileNavOpen ? 'is-open' : ''} ${activeTab === 'editor' && mobileNavCollapsed ? 'mobile-bottom-nav-collapsed' : ''}`} aria-label="Mobile workspace navigation">
                    {mobileNavOpen && (
                        <button
                            type="button"
                            aria-label="Close more navigation"
                            className="mobile-nav-dim"
                            onClick={() => setMobileNavOpen(false)}
                        />
                    )}
                    <div className="mobile-nav-more-sheet">
                        <div className="mobile-nav-more-handle" />
                        <div className="mobile-nav-more-grid">
                            {mobileMoreNavItems.map(item => {
                                const IconCmp = item.icon;
                                const isActive = activeTab === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        data-tour={`mobile-nav-${item.id}`}
                                        type="button"
                                        aria-current={isActive ? 'page' : undefined}
                                        onClick={() => {
                                            if (navigateWorkspaceTab(item.id)) {
                                                setMobileNavOpen(false);
                                            }
                                        }}
                                        className={`mobile-nav-more-item ${isActive ? 'is-active' : ''}`}
                                    >
                                        <span className="mobile-nav-more-icon">
                                            <IconCmp size={17} strokeWidth={2.3} />
                                            {item.badge && <i />}
                                        </span>
                                        <span>{item.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                        {isGuestWorkspace && (
                            <div className="mobile-nav-auth-row mobile-nav-auth-row-guest">
                                <button type="button" onClick={handleSignOut}>
                                    <Home size={13} /> Home
                                </button>
                                <button type="button" onClick={() => openAuthPanel('signin', 'owner')}>Sign In</button>
                                <button type="button" onClick={() => openAuthPanel('signup', 'owner')}>Save For Real</button>
                            </div>
                        )}
                    </div>
                    <div className="mobile-nav-dock">
                        {mobilePrimaryNavItems.map(item => {
                            const IconCmp = item.icon;
                            const isActive = activeTab === item.id;
                            return (
                                <button
                                    key={item.id}
                                    data-tour={`mobile-dock-${item.id}`}
                                    type="button"
                                    aria-current={isActive ? 'page' : undefined}
                                    onClick={() => {
                                        if (navigateWorkspaceTab(item.id)) {
                                            setMobileNavOpen(false);
                                        }
                                    }}
                                    className={`mobile-nav-tab ${isActive ? 'is-active' : ''}`}
                                >
                                    <span className="mobile-nav-tab-icon">
                                        <IconCmp size={18} strokeWidth={2.35} />
                                        {item.badge && <i />}
                                    </span>
                                    <span>{item.id === 'communications' ? 'Support' : item.label}</span>
                                </button>
                            );
                        })}
                        <button
                            type="button"
                            className={`mobile-nav-tab mobile-nav-more-button ${mobileMoreActive || mobileNavOpen ? 'is-active' : ''}`}
                            aria-label={mobileNavOpen ? 'Close more navigation' : 'Open more navigation'}
                            aria-expanded={mobileNavOpen}
                            onClick={() => {
                                playMobileNavSound();
                                setMobileNavOpen(open => !open);
                            }}
                        >
                            <span className="mobile-nav-tab-icon">
                                <Layers size={18} strokeWidth={2.35} />
                                {mobileMoreHasBadge && <i />}
                            </span>
                            <span>More</span>
                        </button>
                    </div>
                </nav>

                <div className={`dashboard-main relative z-10 flex-1 flex overflow-hidden md:pb-0 ${activeTab === 'editor' && mobileNavCollapsed ? 'mobile-nav-space-collapsed' : ''}`}>
                    {activeTab === 'overview' && (
                        <div className="dashboard-overview-page flex-1 overflow-y-auto bg-[#F6F7F9] p-4 sm:p-6 md:p-10 lg:p-12">
                            <section data-tour="dashboard-hero" className="dashboard-lumia-board">
                                <div className="dashboard-lumia-topline">
                                    <div className="dashboard-lumia-greeting">
                                        <div className="dashboard-lumia-live">
                                            <span />
                                            Live Workspace
                                        </div>
                                        <h2>{dashboardPortfolio.greeting}, {dashboardGreetingName}</h2>
                                        <p>
                                            {dashboardPortfolio.period.title} / {dashboardPortfolio.period.rangeLabel}. Your most useful numbers, actions, and signals are ready.
                                        </p>
                                    </div>
                                </div>
                                <div className="dashboard-lumia-divider" aria-hidden="true" />
                                <div className="dashboard-period-tabs schedule-scope-toggle inline-grid grid-cols-4 gap-1 rounded-lg bg-neutral-100 p-1">
                                    {dashboardPortfolio.periods.map(period => (
                                        <button
                                            key={period.id}
                                            onClick={() => {
                                                setDashboardPeriod(period.id);
                                                resetDashboardFeedPages();
                                            }}
                                            className={`dashboard-period-tab h-10 px-4 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${dashboardPeriod === period.id ? 'is-active bg-[#39FF14] text-black shadow-lg shadow-[#39FF14]/20' : 'text-neutral-500 hover:text-black'}`}
                                        >
                                            {period.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="dashboard-mobile-tile-switcher" aria-label="Dashboard sections">
                                    <button
                                        type="button"
                                        className="dashboard-pager-arrow"
                                        onClick={() => shiftDashboardMobileTile(-1)}
                                        aria-label="Previous dashboard section"
                                    >
                                        <ChevronLeft size={18} strokeWidth={2.6} />
                                    </button>
                                    <span className="dashboard-pager-center">
                                        <strong className="dashboard-pager-title">{dashboardActiveTile?.label || 'Dashboard'}</strong>
                                        <span className="dashboard-pager-track" aria-hidden="true">
                                            {dashboardMobileTiles.map((tile, index) => (
                                                <span key={tile.id} className={index === dashboardActiveTileIndex ? 'is-active' : ''} />
                                            ))}
                                        </span>
                                    </span>
                                    <button
                                        type="button"
                                        className="dashboard-pager-arrow"
                                        onClick={() => shiftDashboardMobileTile(1)}
                                        aria-label="Next dashboard section"
                                    >
                                        <ChevronRight size={18} strokeWidth={2.6} />
                                    </button>
                                </div>

                                <div
                                    className="dashboard-command-grid"
                                    onTouchStart={handleDashboardTileTouchStart}
                                    onTouchEnd={handleDashboardTileTouchEnd}
                                >
                                    <article className={`dashboard-command-tile dashboard-command-tile-bookings ${dashboardMobileTile === 'bookings' ? 'is-mobile-active' : ''}`}>
                                        <div className="dashboard-command-head">
                                            <span className="dashboard-lumia-icon"><BookOpenCheck size={21} strokeWidth={2.4} /></span>
                                        </div>
                                        <div className="dashboard-command-summary">
                                            <div>
                                                <h3>Bookings</h3>
                                                <p>{dashboardPortfolio.period.rangeLabel}</p>
                                            </div>
                                            <div className="dashboard-command-total">
                                                <strong className="metric-value">{dashboardPortfolio.activeBookings}</strong>
                                                <span>Total</span>
                                            </div>
                                        </div>
                                        <div className="dashboard-command-filterbar">
                                            {renderDashboardFilterControl('bookings')}
                                        </div>
                                        <div className="dashboard-activity-feed">
                                            {(() => {
                                                const bookingRows = sortDashboardLatest(
                                                    dashboardPortfolio.periodActiveBookings.filter(booking => bookingMatchesDashboardFilter(booking, dashboardFeedFilters.bookings)),
                                                    getBookingDashboardTime
                                                );
                                                const bookingPage = getDashboardPagedFeed('bookings', bookingRows);
                                                return (
                                                    <>
                                                        {bookingPage.rows.map(booking => (
                                                            <button
                                                                key={booking.id}
                                                                type="button"
                                                                className="dashboard-activity-row"
                                                                onClick={() => {
                                                                    setBookingDeskPeriod(dashboardPeriod === 'all' ? 'all' : dashboardPeriod);
                                                                    setBookingFilter('all');
                                                                    setBookingSearch(booking.clientName || '');
                                                                    navigateWorkspaceTab('bookings');
                                                                }}
                                                            >
                                                                <span className={`dashboard-activity-dot is-${getBookingDashboardDot(booking)}`} />
                                                                <span className="dashboard-activity-copy">
                                                                    <strong>{booking.clientName || 'Client'}</strong>
                                                                    <small>{booking.date || booking.dateKeyResolved || dashboardPortfolio.period.rangeLabel} / {booking.serviceName || 'Booking'} / {booking.time || 'Time pending'}</small>
                                                                </span>
                                                                <span className="dashboard-activity-action">Open</span>
                                                            </button>
                                                        ))}
                                                        {!bookingRows.length && (
                                                            <div className="dashboard-empty-row">No matching bookings in this period.</div>
                                                        )}
                                                        {renderDashboardFeedPager('bookings', bookingPage)}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </article>

                                    <article className={`dashboard-command-tile dashboard-command-tile-support ${dashboardMobileTile === 'chats' ? 'is-mobile-active' : ''}`}>
                                        <div className="dashboard-command-head">
                                            <span className="dashboard-lumia-icon"><MessagesSquare size={21} strokeWidth={2.4} /></span>
                                        </div>
                                        <div className="dashboard-command-summary">
                                            <div>
                                                <h3>Chats</h3>
                                                <p>Linked to bookings and client context.</p>
                                            </div>
                                            <div className="dashboard-command-total">
                                                <strong className="metric-value">{dashboardSupportUnreadCount}</strong>
                                                <span>Unread</span>
                                            </div>
                                        </div>
                                        <div className="dashboard-command-filterbar">
                                            {renderDashboardFilterControl('chats')}
                                        </div>
                                        <div className="dashboard-activity-feed">
                                            {(() => {
                                                const chatRows = sortDashboardLatest(
                                                    dashboardSupportThreads
                                                        .filter(thread => threadMatchesDashboardFilter(thread, dashboardFeedFilters.chats))
                                                        .map(thread => {
                                                            const linkedBooking = dashboardPortfolio.periodActiveBookings.find(booking => (
                                                                booking.id === thread.bookingId ||
                                                                booking.threadId === thread.id ||
                                                                notificationEmailKey(booking.clientEmail || '') === notificationEmailKey(thread.clientEmail || '')
                                                            )) || visibleBookings.find(booking => (
                                                                booking.id === thread.bookingId ||
                                                                booking.threadId === thread.id ||
                                                                notificationEmailKey(booking.clientEmail || '') === notificationEmailKey(thread.clientEmail || '')
                                                            ));
                                                            return {
                                                                id: thread.id,
                                                                time: dateValueToMs(thread.lastMessageAt || thread.updatedAt || thread.createdAt),
                                                                title: thread.clientName || 'Client',
                                                                detail: thread.lastMessage || `${thread.serviceName || 'Booking'} thread is open.`,
                                                                dot: getThreadDashboardDot(thread, linkedBooking),
                                                                action: Number(thread.ownerUnread || 0) > 0 ? `${thread.ownerUnread}` : 'Chat',
                                                                onClick: () => openDashboardSupportThread(thread)
                                                            };
                                                        }),
                                                    item => item.time
                                                );
                                                const chatPage = getDashboardPagedFeed('chats', chatRows);
                                                return (
                                                    <>
                                                        {chatPage.rows.map(item => (
                                                            <button key={item.id} type="button" className="dashboard-activity-row" onClick={item.onClick}>
                                                                <span className={`dashboard-activity-dot is-${item.dot}`} />
                                                                <span className="dashboard-activity-copy">
                                                                    <strong>{item.title}</strong>
                                                                    <small>{item.detail}</small>
                                                                </span>
                                                                <span className="dashboard-activity-action">{item.action}</span>
                                                            </button>
                                                        ))}
                                                        {!chatRows.length && (
                                                            <div className="dashboard-empty-row">No matching chats in this period.</div>
                                                        )}
                                                        {renderDashboardFeedPager('chats', chatPage)}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </article>

                                    <article className={`dashboard-command-tile dashboard-command-tile-schedule ${dashboardMobileTile === 'schedule' ? 'is-mobile-active' : ''}`}>
                                        <div className="dashboard-command-head">
                                            <span className="dashboard-lumia-icon"><CalendarDays size={21} strokeWidth={2.4} /></span>
                                        </div>
                                        <div className="dashboard-staff-toggle">
                                            {[{ id: 'all', name: 'All', color: '#39FF14' }, ...displayStaffList].slice(0, 6).map(staff => (
                                                <button
                                                    key={staff.id}
                                                    type="button"
                                                    className={dashboardScheduleStaffId === staff.id ? 'is-active' : ''}
                                                    onClick={() => {
                                                        setDashboardScheduleStaffId(staff.id);
                                                        resetDashboardFeedPage('schedule');
                                                    }}
                                                    style={{ '--staff-color': staff.color || '#39FF14' }}
                                                >
                                                    <span>{staff.id === 'all' ? 'All' : staff.name?.split(/\s+/).map(part => part[0]).join('').slice(0, 2) || 'ST'}</span>
                                                    <strong>{staff.id === 'all' ? 'Team' : staff.name?.split(/\s+/)[0] || 'Staff'}</strong>
                                                </button>
                                            ))}
                                        </div>
                                        <div className="dashboard-schedule-tabs dashboard-segment-mini" aria-label="Schedule dashboard view">
                                            {dashboardScheduleViewOptions.map(option => (
                                                <button
                                                    key={option.id}
                                                    type="button"
                                                    className={dashboardScheduleView === option.id ? 'is-active' : ''}
                                                    onClick={() => {
                                                        setDashboardScheduleView(option.id);
                                                        resetDashboardFeedPage('schedule');
                                                    }}
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                        {(() => {
                                            const selectedStaff = dashboardScheduleStaffId === 'all'
                                                ? null
                                                : displayStaffList.find(staff => staff.id === dashboardScheduleStaffId);
                                            const staffPool = selectedStaff ? [selectedStaff] : displayStaffList;
                                            const matchesStaff = (booking) => (
                                                !selectedStaff ||
                                                booking.staffId === selectedStaff.id ||
                                                (selectedStaff.id === 'owner' && (!booking.staffId || booking.staffId === 'owner'))
                                            );
                                            const bookingMatchesStaff = (booking, staff) => (
                                                !staff ||
                                                booking.staffId === staff.id ||
                                                (staff.id === 'owner' && (!booking.staffId || booking.staffId === 'owner'))
                                            );
                                            const staffNameForBooking = (booking) => (
                                                displayStaffList.find(staff => bookingMatchesStaff(booking, staff))?.name ||
                                                displayStaffList.find(staff => staff.id === booking.staffId)?.name ||
                                                'Team'
                                            );
                                            const pendingBookings = sortDashboardLatest(
                                                dashboardPortfolio.periodActiveBookings.filter(booking => String(booking.status || '').toLowerCase() === 'pending' && matchesStaff(booking)),
                                                getBookingDashboardTime
                                            );
                                            const confirmedBookings = sortDashboardLatest(
                                                dashboardPortfolio.periodActiveBookings.filter(booking => String(booking.status || '').toLowerCase() === 'confirmed' && matchesStaff(booking)),
                                                getBookingDashboardTime
                                            );
                                            const scheduleDates = sortDashboardLatest(
                                                dashboardPortfolio.dateKeys.length ? dashboardPortfolio.dateKeys : [dashboardPortfolio.todayKey],
                                                getDateKeyDashboardTime
                                            ).slice(0, dashboardScheduleView === 'availability' ? 4 : 2);
                                            const availableRows = scheduleDates.flatMap(dateKey => {
                                                const daySchedule = settings.schedule?.[dateKey] || {};
                                                const times = Array.isArray(daySchedule.times) ? daySchedule.times : dashboardPortfolio.defaultTimes;
                                                if (daySchedule.available === false) return [];
                                                const sortedTimes = [...times].sort((a, b) => {
                                                    const aMs = new Date(`${dateKey}T${String(a).padStart(5, '0')}:00`).getTime();
                                                    const bMs = new Date(`${dateKey}T${String(b).padStart(5, '0')}:00`).getTime();
                                                    return bMs - aMs;
                                                });
                                                return sortedTimes.flatMap(time => (
                                                    staffPool.filter(staff => !dashboardPortfolio.periodActiveBookings.some(booking => (
                                                        String(booking.status || '').toLowerCase() === 'confirmed' &&
                                                        booking.dateKeyResolved === dateKey &&
                                                        booking.time === time &&
                                                        bookingMatchesStaff(booking, staff)
                                                    ))).map(staff => ({
                                                        id: `open-${staff.id}-${dateKey}-${time}`,
                                                        type: 'open',
                                                        time: new Date(`${dateKey}T${String(time).padStart(5, '0')}:00`).getTime(),
                                                        title: time,
                                                        detail: `${staff.name || 'Staff'} / ${dateKey}`,
                                                        staff
                                                    }))
                                                ));
                                            });
                                            const rows = dashboardScheduleView === 'pending'
                                                ? pendingBookings.map(booking => ({
                                                    id: `pending-${booking.id}`,
                                                    type: 'pending',
                                                    time: getBookingDashboardTime(booking),
                                                    title: booking.time || 'Time pending',
                                                    detail: `${booking.clientName || 'Client'} / ${booking.serviceName || 'Booking'} / ${staffNameForBooking(booking)}`,
                                                    action: 'Review',
                                                    booking
                                                }))
                                                : dashboardScheduleView === 'confirmed'
                                                    ? confirmedBookings.map(booking => ({
                                                        id: `confirmed-${booking.id}`,
                                                        type: 'confirmed',
                                                        time: getBookingDashboardTime(booking),
                                                        title: booking.time || 'Time',
                                                        detail: `${booking.clientName || 'Client'} / ${booking.serviceName || 'Booking'} / ${staffNameForBooking(booking)}`,
                                                        action: 'Booked',
                                                        booking
                                                    }))
                                                    : sortDashboardLatest(availableRows, row => row.time).map(row => ({
                                                        ...row,
                                                        action: 'Open'
                                                    }));
                                            const schedulePage = getDashboardPagedFeed('schedule', rows);
                                            const scheduleTotal = dashboardScheduleView === 'pending'
                                                ? pendingBookings.length
                                                : dashboardScheduleView === 'confirmed'
                                                    ? confirmedBookings.length
                                                    : availableRows.length;
                                            const scheduleTotalLabel = dashboardScheduleView === 'pending'
                                                ? 'Pending'
                                                : dashboardScheduleView === 'confirmed'
                                                    ? 'Booked'
                                                    : 'Open slots';
                                            return (
                                                <>
                                                    <div className="dashboard-command-summary">
                                                        <div>
                                                            <h3>Schedule</h3>
                                                            <p>{selectedStaff ? selectedStaff.name : 'Team schedule'} / {dashboardScheduleViewOptions.find(option => option.id === dashboardScheduleView)?.label}</p>
                                                        </div>
                                                        <div className="dashboard-command-total">
                                                            <strong className="metric-value">{scheduleTotal}</strong>
                                                            <span>{scheduleTotalLabel}</span>
                                                        </div>
                                                    </div>
                                                    <div className="dashboard-activity-feed dashboard-schedule-feed">
                                                        {schedulePage.rows.map(row => {
                                                            const rowContent = (
                                                                <>
                                                                    <span className={`dashboard-activity-dot is-${row.type}`} />
                                                                    <span className="dashboard-activity-copy">
                                                                        <strong>{row.title}</strong>
                                                                        <small>{row.detail}</small>
                                                                    </span>
                                                                    <span className="dashboard-activity-action">{row.action}</span>
                                                                </>
                                                            );
                                                            if (!row.booking) {
                                                                return <div key={row.id} className="dashboard-activity-row is-static">{rowContent}</div>;
                                                            }
                                                            return (
                                                                <button
                                                                    key={row.id}
                                                                    type="button"
                                                                    className="dashboard-activity-row"
                                                                    onClick={() => {
                                                                        setBookingDeskPeriod(dashboardPeriod === 'all' ? 'all' : dashboardPeriod);
                                                                        setBookingFilter('all');
                                                                        setBookingSearch(row.booking.clientName || '');
                                                                        navigateWorkspaceTab('bookings');
                                                                    }}
                                                                >
                                                                    {rowContent}
                                                                </button>
                                                            );
                                                        })}
                                                        {!rows.length && <div className="dashboard-empty-row">No {scheduleTotalLabel.toLowerCase()} for this staff in this period.</div>}
                                                        {renderDashboardFeedPager('schedule', schedulePage)}
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </article>

                                    <article className={`dashboard-command-tile dashboard-command-tile-finance ${dashboardMobileTile === 'finance' ? 'is-mobile-active' : ''}`}>
                                        <div className="dashboard-command-head">
                                            <span className="dashboard-lumia-icon"><DollarSign size={21} strokeWidth={2.4} /></span>
                                        </div>
                                        <div className="dashboard-command-summary">
                                            <div>
                                                <h3>Payments</h3>
                                                <p>{dashboardPortfolio.totalRevenuePaidCount} paid / {dashboardPortfolio.pendingFinanceCount} pending.</p>
                                            </div>
                                            <div className="dashboard-command-total">
                                                <strong className="metric-value">{dashboardPortfolio.totalRevenueLabel}</strong>
                                                <span>Revenue</span>
                                            </div>
                                        </div>
                                        <div className="dashboard-mini-stat-row">
                                            <span><strong>{dashboardPortfolio.pendingRevenueLabel}</strong> Pending</span>
                                            <span><strong>{settings.currency || 'ZAR'}</strong> Currency</span>
                                        </div>
                                        <div className="dashboard-activity-feed">
                                            {(() => {
                                                const financeRows = sortDashboardLatest(dashboardPortfolio.financeActivity, record => record.updatedAtMs);
                                                const financePage = getDashboardPagedFeed('finance', financeRows);
                                                return (
                                                    <>
                                                        {financePage.rows.map(record => (
                                                            <button
                                                                key={`${record.title}-${record.updatedAtMs}-${record.amountLabel}`}
                                                                type="button"
                                                                className="dashboard-activity-row"
                                                                onClick={() => navigateWorkspaceTab('finance')}
                                                            >
                                                                <span className={`dashboard-activity-dot is-${record.normalizedStatus}`} />
                                                                <span className="dashboard-activity-copy">
                                                                    <strong>{record.title}</strong>
                                                                    <small>{record.detail}</small>
                                                                </span>
                                                                <span className="dashboard-activity-action">{record.amountLabel}</span>
                                                            </button>
                                                        ))}
                                                        {!financeRows.length && (
                                                            <div className="dashboard-empty-row">No payment activity in this period.</div>
                                                        )}
                                                        {renderDashboardFeedPager('finance', financePage)}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </article>
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'profile' && (
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10 lg:p-12 relative bg-[#F7F7F5]">
                            <div className="dashboard-action-strip max-w-6xl mb-4 md:mb-6">
                                    <div className="profile-header-actions">
                                        <div className="hidden md:flex flex-col sm:flex-row gap-3">
                                            <button onClick={() => setShowOwnerManual(true)} className="h-12 px-7 bg-white border border-neutral-200 text-black text-[10px] font-bold uppercase tracking-widest rounded-full shadow-xl shadow-black/5 hover:-translate-y-0.5 hover:border-black transition-all flex items-center justify-center gap-2">
                                                <BookOpen size={14}/> Owner Manual
                                            </button>
                                            <button onClick={saveProfileChanges} className="h-12 px-7 bg-black text-white text-[10px] font-bold uppercase tracking-widest rounded-full shadow-xl shadow-black/10 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
                                                <Check size={14}/> Save Profile
                                            </button>
                                        </div>
                                    </div>
                            </div>

                            <div className="profile-mobile-hub max-w-6xl mb-4">
                                {!activeProfileSection ? (
                                    <div className="profile-command-grid">
                                        {profileSections.map(section => {
                                            const IconCmp = section.icon;
                                            return (
                                                <div
                                                    key={section.id}
                                                    className="profile-command-card"
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => section.action ? section.action() : setActiveProfileSection(section.id)}
                                                        className="profile-command-primary"
                                                        aria-label={`Open ${section.title}`}
                                                    >
                                                        <span className="profile-command-card-top">
                                                            <span className="profile-command-icon">
                                                                <IconCmp size={18} />
                                                            </span>
                                                            <span className="profile-command-meta">{section.meta}</span>
                                                        </span>
                                                        <span className="profile-command-copy">
                                                            <span>{section.title}</span>
                                                        </span>
                                                        <span className="profile-command-arrow" aria-hidden="true">
                                                            <ChevronRight size={17} />
                                                        </span>
                                                    </button>
                                                    <span className="profile-command-quick">
                                                        {(section.quick || []).map(item => (
                                                            <button
                                                                key={item}
                                                                type="button"
                                                                onClick={() => section.action ? section.action() : setActiveProfileSection(section.id)}
                                                                aria-label={`Open ${section.title}: ${item}`}
                                                            >
                                                                {item}
                                                            </button>
                                                        ))}
                                                    </span>
                                                </div>
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
                                <div className={`profile-section profile-section-account ${activeProfileSection === 'account' ? 'block' : 'hidden'} overflow-hidden bg-white rounded-lg border border-neutral-100 shadow-[0_25px_80px_-60px_rgba(0,0,0,0.75)]`}>
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
                                                <div className="hidden sm:flex items-center gap-2 shrink-0">
                                                    <label className="h-10 px-4 rounded-full bg-neutral-50 border border-neutral-100 text-black text-[10px] font-bold uppercase tracking-widest inline-flex items-center gap-2 cursor-pointer hover:border-black transition-colors">
                                                        <Crop size={14} /> Photo
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="hidden"
                                                            onChange={(event) => handlePersonalProfilePhotoUpload(event.target.files?.[0])}
                                                        />
                                                    </label>
                                                    {personalProfile.photoURL && (
                                                        <button
                                                            type="button"
                                                            onClick={removePersonalProfilePhoto}
                                                            className="h-10 px-4 rounded-full bg-red-50 border border-red-100 text-red-600 text-[10px] font-bold uppercase tracking-widest"
                                                        >
                                                            Remove
                                                        </button>
                                                    )}
                                                </div>
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

                                <div className={`profile-section profile-section-account ${activeProfileSection === 'account' ? 'grid' : 'hidden'} grid-cols-1 lg:grid-cols-12 gap-5`}>
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
                                        {!isGuestWorkspace && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setAccountDeleteText('');
                                                    setAccountDeleteOpen(true);
                                                }}
                                                disabled={authBusy}
                                                className="mt-3 w-full h-12 rounded-full bg-red-50 border border-red-100 text-red-600 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-100 transition-colors disabled:opacity-50"
                                            >
                                                <Trash2 size={14}/> Delete Account
                                            </button>
                                        )}
                                    </section>
                                </div>

                                <section className={`profile-section profile-section-activity ${activeProfileSection === 'activity' ? 'block' : 'hidden'}`}>
                                    <div className="profile-activity-center">
                                        <div className="profile-activity-hero">
                                            <div className="profile-activity-title">
                                                <span className="profile-activity-icon">
                                                    <Settings2 size={18} />
                                                </span>
                                                <div>
                                                    <p>Activity Center</p>
                                                    <h3>System activity</h3>
                                                </div>
                                            </div>
                                            <div className="profile-activity-stats">
                                                <span>
                                                    <strong>{profileActivityPrimaryCount}</strong>
                                                    Signals
                                                </span>
                                                <span>
                                                    <strong>{profileActivitySecondaryCount}</strong>
                                                    Areas
                                                </span>
                                            </div>
                                        </div>
                                        <div className="profile-activity-summary">
                                            <span><Settings2 size={14} /> Internal changes, team setup, services, schedule, editor, finance, and migration signals.</span>
                                        </div>
                                        <div className="profile-activity-filter-tabs" aria-label="System activity filters">
                                            {profileSystemFilterOptions.map(option => {
                                                const isActive = profileSystemFilter === option.id;
                                                return (
                                                    <button
                                                        key={`system-${option.id}`}
                                                        type="button"
                                                        className={isActive ? 'is-active' : ''}
                                                        onClick={() => setProfileSystemFilter(option.id)}
                                                    >
                                                        <span>{option.label}</span>
                                                        <strong>{option.count}</strong>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <div className="profile-activity-list">
                                            {profileActivityRows.length ? profileActivityRows.map(item => {
                                                const IconCmp = item.iconKind === 'chat'
                                                    ? MessagesSquare
                                                    : item.iconKind === 'payment'
                                                        ? DollarSign
                                                        : item.iconKind === 'booking'
                                                            ? BookOpenCheck
                                                            : item.iconKind === 'reschedule'
                                                                ? RefreshCw
                                                                : item.iconKind === 'services'
                                                                    ? BriefcaseBusiness
                                                                    : item.iconKind === 'team'
                                                                        ? UsersRound
                                                                        : item.iconKind === 'schedule'
                                                                            ? CalendarDays
                                                                            : item.iconKind === 'editor'
                                                                                ? Palette
                                                                                : item.iconKind === 'migration'
                                                                                    ? FileText
                                                                                    : Bell;
                                                return (
                                                    <button
                                                        key={item.id}
                                                        type="button"
                                                        className={`profile-activity-row ${item.isUnread ? 'is-unread' : ''} is-${item.kind}`}
                                                        onClick={() => handleProfileActivityOpen(item)}
                                                    >
                                                        <span className={`profile-activity-row-icon is-${item.iconKind || item.kind}`}>
                                                            <IconCmp size={15} />
                                                        </span>
                                                        <span className="profile-activity-row-copy">
                                                            <strong>{item.title}</strong>
                                                            <small>{item.detail}</small>
                                                        </span>
                                                        <span className="profile-activity-row-meta">
                                                            <span>{item.label}</span>
                                                            <small>{formatNotificationTime(item.time)}</small>
                                                        </span>
                                                    </button>
                                                );
                                            }) : (
                                                <div className="profile-activity-empty">
                                                    <span><Inbox size={22} /></span>
                                                    <strong>Nothing waiting</strong>
                                                    <small>System changes and internal workspace updates will collect here.</small>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </section>

                                <section className={`profile-section profile-section-migration ${activeProfileSection === 'migration' ? 'block' : 'hidden'}`}>
                                    <Suspense fallback={<LazySectionFallback label="Loading migration studio" />}>
                                        <AppErrorBoundary compact label="Migration Studio" resetKey={`${workspaceOwnerId}-${importedMigrationCounts.clients}-${importedMigrationCounts.bookings}-${importedMigrationCounts.financeRecords}`}>
                                            <MigrationImportPanel
                                                canManageWorkspace={canManageWorkspace}
                                                displayCurrency={settings.currency || 'ZAR'}
                                                importedCounts={importedMigrationCounts}
                                                onImportMigrationCsv={handleCsvMigrationImport}
                                                onClearMigrationData={handleClearCsvMigrationData}
                                                showToast={showToast}
                                            />
                                        </AppErrorBoundary>
                                    </Suspense>
                                </section>

                                <section className={`profile-section profile-section-billing ${activeProfileSection === 'billing' ? 'block' : 'hidden'} bg-white rounded-lg border border-neutral-100 p-5 md:p-7 shadow-[0_22px_70px_-60px_rgba(15,23,42,0.5)]`}>
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

                                <div data-tour="profile-business-info" className={`profile-section profile-section-business ${activeProfileSection === 'business' ? 'block' : 'hidden'} bg-white p-5 sm:p-6 md:p-10 rounded-lg border border-neutral-100 shadow-[0_25px_80px_-65px_rgba(0,0,0,0.75)]`}>
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
                                                    {settings.logo && <button type="button" onClick={() => removeSettingImage('logo')} className="text-[10px] font-bold text-red-500 uppercase tracking-widest hover:underline mt-2">Remove Image</button>}
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
                                                        {settings.bannerImage && <button type="button" onClick={() => removeSettingImage('bannerImage')} className="px-5 py-3 text-[10px] font-bold text-red-500 uppercase tracking-widest hover:underline">Remove</button>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-6 border-t border-neutral-50">
                                            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-5">
                                                <div>
                                                    <label className="text-[10px] font-bold uppercase tracking-[0.5em] opacity-40 block text-black">Venue Gallery</label>
                                                    <p className="text-xs text-neutral-400 font-medium mt-2 max-w-xl">Show clients the space after they submit their request, just before social links and map details.</p>
                                                </div>
                                                <label className="inline-flex h-12 px-5 bg-black text-white text-[10px] font-bold uppercase tracking-widest rounded-full cursor-pointer hover:bg-neutral-800 transition-colors items-center justify-center gap-2 shrink-0">
                                                    <ImagePlus size={14} /> Upload Venue Photos
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        multiple
                                                        className="hidden"
                                                        onChange={(event) => {
                                                            handleVenuePhotoUpload(event.target.files);
                                                            event.target.value = '';
                                                        }}
                                                    />
                                                </label>
                                            </div>
                                            {venuePhotos.length > 0 ? (
                                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                                    {venuePhotos.map((photo, index) => (
                                                        <div key={`${photo}-${index}`} className={`${index === 0 ? 'lg:col-span-2 lg:row-span-2' : ''} group relative overflow-hidden rounded-xl border border-neutral-100 bg-neutral-50 aspect-[4/3] shadow-inner`}>
                                                            <img src={photo} alt={`Venue photo ${index + 1}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                                            <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2">
                                                                <span className="rounded-full bg-white/90 px-2.5 py-1 text-[8px] font-bold uppercase tracking-widest text-black shadow-sm">Photo {index + 1}</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeVenuePhoto(photo)}
                                                                    className="w-8 h-8 rounded-full bg-black/80 text-white flex items-center justify-center opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    aria-label={`Remove venue photo ${index + 1}`}
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/70 p-6 flex flex-col sm:flex-row sm:items-center gap-4 text-neutral-400">
                                                    <div className="w-12 h-12 rounded-xl bg-white border border-neutral-100 flex items-center justify-center text-black shrink-0">
                                                        <Images size={18} />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-black">No venue photos yet</p>
                                                        <p className="text-xs font-medium mt-1">Upload a few polished photos of the venue, studio, workspace, or service environment.</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="business-faq-profile pt-6 border-t border-neutral-50">
                                            <div className="business-faq-profile-head">
                                                <div>
                                                    <label className="text-[10px] font-bold uppercase tracking-[0.5em] opacity-40 block text-black">Booking Page FAQ</label>
                                                    <h4>Questions and answers</h4>
                                                    <p>Set the actual client-facing FAQ copy here. The editor handles how this section looks on the booking page.</p>
                                                </div>
                                                <button type="button" onClick={toggleFaqFeature} className={settings.features?.faqEnabled ? 'is-on' : ''}>
                                                    <span>{settings.features?.faqEnabled ? 'Shown' : 'Hidden'}</span>
                                                    <i />
                                                </button>
                                            </div>
                                            {settings.features?.faqEnabled ? (
                                                <div className="business-faq-profile-list">
                                                    {(settings.features?.faqs || []).map((faq, index) => (
                                                        <article key={index} className="business-faq-profile-card">
                                                            <div className="business-faq-profile-card-head">
                                                                <span>FAQ {index + 1}</span>
                                                                <button type="button" onClick={() => removeFaqItem(index)} aria-label={`Remove FAQ ${index + 1}`}>
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            </div>
                                                            <label>
                                                                <span>Question</span>
                                                                <input value={faq.q} onChange={(event) => updateFaqItem(index, 'q', event.target.value)} placeholder="How do I know my booking is confirmed?" />
                                                            </label>
                                                            <label>
                                                                <span>Answer</span>
                                                                <textarea value={faq.a} onChange={(event) => updateFaqItem(index, 'a', event.target.value)} placeholder="You will receive an update as soon as the business approves your request." />
                                                            </label>
                                                        </article>
                                                    ))}
                                                    <button type="button" onClick={addFaqItem} className="business-faq-profile-add">
                                                        <span><Plus size={15} /></span>
                                                        <strong>Add question</strong>
                                                    </button>
                                                </div>
                                            ) : (
                                                <button type="button" onClick={toggleFaqFeature} className="business-faq-profile-empty">
                                                    <HelpCircle size={18} />
                                                    <span>
                                                        <strong>FAQ is hidden</strong>
                                                        Turn it on when you want helpful questions to appear on the booking page.
                                                    </span>
                                                </button>
                                            )}
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
                            <Suspense fallback={<LazySectionFallback label="Loading schedule" />}>
                                <AppErrorBoundary compact label="Schedule" resetKey={`${activeTab}-${workspaceOwnerId}`}>
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
                                        onSettingsDirty={markWorkspaceDirty}
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
                                </AppErrorBoundary>
                            </Suspense>
                        </div>
                    )}

                    {activeTab === 'communications' && (
                        <div className="communications-page flex-1 overflow-y-auto p-4 sm:p-6 md:p-10 lg:p-12 relative bg-[#F6F7F9]">
                            <div className="support-page-shell max-w-[88rem] mx-auto">
                                <Suspense fallback={<LazySectionFallback label="Loading client inbox" />}>
                                    <AppErrorBoundary compact label="Support Inbox" resetKey={`${workspaceOwnerId}-${supportThreadFocus?.requestId || 'inbox'}`}>
                                        <WorkspaceInbox
                                            appId={appId}
                                            db={db}
                                            user={user}
                                            workspaceOwnerId={workspaceOwnerId}
                                            isGuestWorkspace={isGuestWorkspace}
                                            bookings={visibleBookings}
                                            clientDirectory={clientDirectory}
                                            staffList={displayStaffList}
                                            services={workspaceServices}
                                            updateBooking={updateBooking}
                                            onCreateManualBooking={createManualBookingFromChat}
                                            setActiveTab={setActiveTab}
                                            focusTarget={supportThreadFocus}
                                            showToast={showToast}
                                        />
                                    </AppErrorBoundary>
                                </Suspense>
                            </div>
                        </div>
                    )}

                    {activeTab === 'services' && (
                        <div className="flex-1 overflow-y-auto bg-[#F6F7F9] p-4 sm:p-6 md:p-10 lg:p-12">
                            <Suspense fallback={<LazySectionFallback label="Loading service studio" />}>
                                <AppErrorBoundary compact label="Services" resetKey={`${workspaceOwnerId}-${settings.serviceIndustry || 'services'}`}>
                                    <ServicesStudio
                                        settings={settings}
                                        staffList={displayStaffList}
                                        currentIndustry={themeGenerationInputs.industry || settings.serviceIndustry}
                                        canManageWorkspace={canManageWorkspace}
                                        onChooseIndustry={(industryId) => {
                                            handleSettingChange('serviceIndustry', industryId);
                                            if (industryId) setThemeFilterValue('industry', industryId);
                                        }}
                                        onUpdateSettings={async (nextSettings, message) => {
                                            markWorkspaceDirty();
                                            setSettings(nextSettings);
                                            await saveSettingsDraft(nextSettings, message || 'Services saved.');
                                        }}
                                        onImageUpload={requestImageCropUpload}
                                        onImageDelete={deleteStorageAsset}
                                        showToast={showToast}
                                    />
                                </AppErrorBoundary>
                            </Suspense>
                        </div>
                    )}

                    {activeTab === 'finance' && (
                        <div className="flex-1 overflow-y-auto bg-[#F6F7F9] p-4 sm:p-6 md:p-10 lg:p-12">
                            <Suspense fallback={<LazySectionFallback label="Loading finance" />}>
                                <AppErrorBoundary compact label="Finance" resetKey={workspaceOwnerId}>
                                    <FinancePaymentSettings
                                        appId={appId}
                                        businessId={workspaceOwnerId}
                                        isGuestWorkspace={isGuestWorkspace}
                                        canManageWorkspace={canManageWorkspace}
                                        showToast={showToast}
                                        bookings={bookings}
                                        importedFinanceRecords={financeImports}
                                        onMarkBookingPaid={markBookingPaid}
                                    />
                                </AppErrorBoundary>
                            </Suspense>
                        </div>
                    )}

                    {activeTab === 'clients' && (
                        <div className="flex-1 overflow-y-auto bg-[#F6F7F9] p-4 sm:p-6 md:p-10 lg:p-12">
                            <div className="dashboard-action-strip mb-4 md:mb-6 flex justify-end">
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
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                                <section className={`${activeClient ? 'xl:col-span-5' : 'xl:col-span-12'} space-y-4 md:space-y-6 ${clientMobileView === 'directory' || clientMobileView === 'add' ? '' : 'hidden md:block'}`}>
                                    <div data-tour="clients-directory" className={`saas-card client-directory-card overflow-hidden ${clientMobileView === 'add' ? 'hidden md:block' : ''}`}>
                                        <div className="client-directory-command p-4 md:p-5 border-b border-neutral-100">
                                            <div className="client-directory-tools">
                                            <div className="client-search-wrap relative">
                                                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-300" />
                                                <input
                                                    value={clientSearch}
                                                    onChange={(event) => setClientSearch(event.target.value)}
                                                    placeholder="Search name, phone, label"
                                                    aria-label="Search clients"
                                                    className="client-search-input w-full h-11 md:h-12 bg-white border border-neutral-200 rounded-xl pl-11 pr-4 text-sm font-bold outline-none text-black focus:bg-white focus:border-black transition-colors"
                                                />
                                            </div>
                                            <div className="client-filter-tabs mt-3 grid grid-cols-3 gap-1.5">
                                                {clientDeskFilters.map(filter => {
                                                    const FilterIcon = filter.icon || Users;
                                                    return (
                                                        <button
                                                            key={filter.id}
                                                            type="button"
                                                            onClick={() => setClientDeskFilter(filter.id)}
                                                            className={`client-filter-tab h-10 rounded-lg border text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${clientDeskFilter === filter.id ? 'is-active bg-black text-white border-black shadow-lg shadow-black/10' : 'bg-white border-transparent text-neutral-500 hover:text-black hover:bg-white'}`}
                                                        >
                                                            <FilterIcon size={13} />
                                                            <span>{filter.label}</span>
                                                            <span className={`client-filter-count rounded-full px-2 py-0.5 ${clientDeskFilter === filter.id ? 'bg-white/15 text-white' : 'bg-neutral-100 text-neutral-500'}`}>{filter.count}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
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
                                                const openClientChat = () => {
                                                    const latestBooking = client.bookings?.[0] || client.lastBooking;
                                                    if (!latestBooking?.id) {
                                                        showToast('This client needs a booking before a chat thread can open.');
                                                        return;
                                                    }
                                                    openBookingChat(latestBooking);
                                                };
                                                return (
                                                    <div
                                                        key={client.id}
                                                        className={`client-directory-row w-full p-3 md:p-5 transition-all ${isActive ? 'is-active bg-black text-white' : 'hover:bg-neutral-50 text-black'}`}
                                                    >
                                                        <div className="flex items-start gap-3 md:gap-4">
                                                            <button
                                                                type="button"
                                                                onClick={openClientFile}
                                                                className={`w-11 h-11 md:w-14 md:h-14 rounded-lg overflow-hidden flex items-center justify-center font-bold text-base md:text-xl shrink-0 ${isActive ? 'bg-white text-black' : 'bg-neutral-100 text-black'}`}
                                                                aria-label={`Open ${client.name} file`}
                                                            >
                                                                {client.avatar ? <img src={client.avatar} className="w-full h-full object-cover" /> : (client.name || '?').charAt(0)}
                                                            </button>
                                                            <button type="button" onClick={openClientFile} className="min-w-0 flex-1 text-left">
                                                                <div className="flex items-start justify-between gap-3 mb-1">
                                                                    <h4 className="text-base md:text-lg font-bold tracking-tight truncate">{client.name}</h4>
                                                                </div>
                                                                <p className={`text-xs md:text-sm truncate mb-2 md:mb-3 ${isActive ? 'text-white/55' : 'text-neutral-500'}`}>{client.isExample ? 'Preview only - not saved or counted' : client.phone || client.email || 'Manual profile'}</p>
                                                                <div className="flex flex-wrap gap-1.5 md:gap-2">
                                                                    {allLabels.map(label => (
                                                                        <span key={label} className={`px-2 py-1 rounded-md text-[7px] md:text-[8px] font-bold uppercase tracking-widest ${isActive ? 'bg-white/10 text-white' : label === 'Regular' || label === 'VIP' ? 'bg-[#39FF14] text-black' : 'bg-neutral-100 text-neutral-500'}`}>{label}</span>
                                                                    ))}
                                                                </div>
                                                            </button>
                                                            <div className="client-row-actions flex items-center gap-1.5 shrink-0">
                                                                <button
                                                                    type="button"
                                                                    onClick={openClientFile}
                                                                    aria-label={`Open ${client.name} file`}
                                                                    title="Open file"
                                                                    className={`client-row-action ${isActive ? 'is-active' : ''}`}
                                                                >
                                                                    <FileText size={15} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={openClientChat}
                                                                    aria-label={`Open ${client.name} chat`}
                                                                    title="Open chat"
                                                                    className={`client-row-action ${isActive ? 'is-active' : ''}`}
                                                                >
                                                                    <MessageCircle size={15} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
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
                                                        <button onClick={() => navigateWorkspaceTab('bookings')} className="h-11 px-5 rounded-lg border border-neutral-200 bg-white text-[10px] font-bold uppercase tracking-widest text-neutral-600 hover:text-black hover:bg-neutral-50 transition-colors flex items-center justify-center gap-2">
                                                            <History size={15}/> Open Bookings
                                                        </button>
                                                    </div>

                                                    <form
                                                        key={`client-details-${activeClient.id}`}
                                                        onSubmit={(event) => {
                                                            event.preventDefault();
                                                            const formData = new FormData(event.currentTarget);
                                                            upsertClientRecord(activeClient.id, {
                                                                name: String(formData.get('name') || '').trim() || activeClient.name,
                                                                phone: String(formData.get('phone') || '').trim(),
                                                                email: String(formData.get('email') || '').trim(),
                                                                birthday: String(formData.get('birthday') || '').trim()
                                                            });
                                                            showToast('Client details saved');
                                                        }}
                                                        className="client-file-details rounded-2xl border border-neutral-100 bg-neutral-50/80 p-3 md:p-4"
                                                    >
                                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                                                            <div>
                                                                <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">Client Details</p>
                                                                <p className="text-xs text-neutral-500 mt-1">Update contact info without leaving the file.</p>
                                                            </div>
                                                            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 bg-white border border-neutral-100 px-3 py-1.5 rounded-full">
                                                                {isExampleClient ? 'Example only' : activeClient.lastBooking ? `Last ${activeClient.lastBooking.date}` : 'No visits yet'}
                                                            </span>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                            <label className="client-file-field">
                                                                <span>Name</span>
                                                                <input name="name" defaultValue={activeClient.name || ''} disabled={isExampleClient} />
                                                            </label>
                                                            <label className="client-file-field">
                                                                <span>Phone</span>
                                                                <input name="phone" type="tel" defaultValue={activeClient.phone || ''} placeholder="Not added" disabled={isExampleClient} />
                                                            </label>
                                                            <label className="client-file-field">
                                                                <span>Email</span>
                                                                <input name="email" type="email" defaultValue={activeClient.email || ''} placeholder="Not added" disabled={isExampleClient} />
                                                            </label>
                                                            <label className="client-file-field">
                                                                <span>Birthday</span>
                                                                <input name="birthday" defaultValue={activeClient.birthday || ''} placeholder="MM/DD" disabled={isExampleClient} />
                                                            </label>
                                                        </div>
                                                        <button
                                                            type="submit"
                                                            disabled={isExampleClient}
                                                            className="mt-3 h-11 w-full md:w-auto px-5 rounded-xl bg-black text-white flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                                        >
                                                            <Check size={15}/> {isExampleClient ? 'Example Only' : 'Save Details'}
                                                        </button>
                                                    </form>
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
                                                            const serviceDetails = getBookingService(booking);
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
                                                                        {serviceDetails?.name && (
                                                                            <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-neutral-50 border border-neutral-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
                                                                                <Briefcase size={12} />
                                                                                {summarizeService(serviceDetails)}
                                                                            </p>
                                                                        )}
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
                            <section data-tour="team-roster" className="saas-card p-4 md:p-6 overflow-hidden">
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-6">
                                    <div>
                                        <h3 className="text-xl md:text-2xl font-bold tracking-tight text-black">Team Roster</h3>
                                        <p className="text-sm text-neutral-500">Floating profiles for staff files, assignment checks, and calendar ownership.</p>
                                    </div>
                                    <div className="team-roster-actions">
                                        <span className="team-roster-active-count inline-flex w-fit text-[10px] font-bold uppercase tracking-widest text-neutral-500 bg-neutral-100 px-3 py-1.5 rounded-md">{displayStaffList.length} Active</span>
                                        <button onClick={() => { saveStaff(staffList); showToast("Team setup saved"); }} className="team-save-inline-button">
                                            <Check size={14}/> Save Team
                                        </button>
                                    </div>
                                </div>
                                <div className="team-roster-rail flex gap-3 md:gap-4 overflow-x-auto no-scrollbar pb-2">
                                    <button
                                        type="button"
                                        onClick={() => { setTeamPanelMode('add'); setSelectedStaffFileId(null); }}
                                        className={`team-roster-card min-w-[92px] md:min-w-[110px] rounded-2xl border p-3 md:p-4 flex flex-col items-center gap-3 transition-all ${teamPanelMode === 'add' ? 'bg-black text-white border-black shadow-xl shadow-black/10' : 'bg-white border-neutral-200 text-black hover:border-black'}`}
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
                                                className={`team-roster-card min-w-[112px] md:min-w-[132px] rounded-2xl border p-3 md:p-4 flex flex-col items-center gap-3 transition-all ${isSelected ? 'bg-black text-white border-black shadow-xl shadow-black/10' : 'bg-white border-neutral-200 text-black hover:border-black hover:shadow-lg'}`}
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
                                            <button type="button" aria-label="Close teammate form" onClick={() => setTeamPanelMode('roster')} className="w-10 h-10 rounded-lg bg-black text-white flex items-center justify-center shrink-0"><X size={16}/></button>
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
                    <div className={`flex-1 flex overflow-hidden mobile-editor-shell editor-fullscreen-workspace editor-preview-device-${device} bg-[#F5F5F7] ${editorStudioModal ? 'mobile-editor-room-open' : ''} ${isPortraitMobileRuntime ? 'mobile-editor-portrait-runtime' : ''} ${editorCollapsed ? 'mobile-editor-panel-is-collapsed' : ''} ${mobileNavCollapsed ? 'mobile-editor-nav-is-collapsed' : ''}`}>
                        <div className={`mobile-editor-panel transition-all duration-700 ease-in-out bg-white border-r border-neutral-100 flex flex-col shadow-2xl relative z-40 overflow-hidden ${editorCollapsed ? 'mobile-editor-panel-collapsed w-0 opacity-0 pointer-events-none' : 'w-full md:w-[600px] lg:w-[700px]'}`}>
                        {!editorCollapsed && (
                            <>
                            <header className="editor-panel-header editor-cinema-header flex-shrink-0">
                                <div>
                                    <p className="editor-modal-kicker">Editing room</p>
                                    <h2>{editorRoomScenes.find(scene => scene.id === (editorStudioModal || 'introduction'))?.title || 'Editor'}</h2>
                                </div>
                                <button type="button" onClick={() => setEditorStudioModal(null)} className="editor-modal-close-button" aria-label="Close editor settings" title="Close editor settings">
                                    <X size={16} />
                                </button>
                            </header>

                            <div ref={editorContentRef} className="editor-panel-scroll flex-1 overflow-y-auto p-5 sm:p-6 md:p-12 space-y-8 md:space-y-12 no-scrollbar">
                                <div className="mobile-editor-portrait-guides md:hidden space-y-3">
                                    <div className="mobile-editor-rotate-prompt rounded-lg border border-black/10 bg-black text-white p-4 shadow-2xl items-start gap-3">
                                        <RefreshCw size={18} className="text-[#39FF14] shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-widest mb-1">Rotate To Start Editing</p>
                                            <p className="text-xs text-white/65 leading-relaxed">Turn your phone sideways to open the full editing workspace with the room timeline, settings, and live mockup together.</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="editor-cinema-studio animate-in fade-in duration-700">
                                    {(() => {
                                        const scenes = editorRoomScenes.map(scene => ({
                                            ...scene,
                                            title: {
                                                introduction: 'Introduction',
                                                logo: 'Logo placement',
                                                banner: 'Banner placement',
                                                services: 'Services',
                                                colours: 'Colour direction',
                                                typography: 'Typography',
                                                calendar: 'Calendar style',
                                                time: 'Time style',
                                                faq: 'FAQ setup',
                                                form: 'Client form',
                                                buttons: 'Action buttons',
                                                venue: 'Venue & maps',
                                                social: 'Social media'
                                            }[scene.id],
                                            prompt: {
                                                introduction: 'Name the page and write the first words clients see. Type here or directly on the mockup.',
                                                logo: 'Place the logo like a brand mark: beside the title, above the hero, or as a small badge.',
                                                banner: 'Choose whether the banner acts as the hero image, a top strip, or a calmer footer media panel.',
                                                services: 'Build the bookable menu clients choose from before they request a time.',
                                                colours: 'Build a live color direction from one color, many colors, or your uploaded brand media.',
                                                typography: 'Choose a polished font system for headings, paragraphs, labels, and buttons.',
                                                calendar: 'Customize the calendar only: date cards, active states, color, shadow, and glow.',
                                                time: 'Customize bookable time slots without touching the calendar.',
                                                faq: 'Add helpful questions and tune how the FAQ block feels.',
                                                form: 'Choose the client details your business needs before booking.',
                                                buttons: 'Tune the final booking button so the action feels clear and branded.',
                                                venue: 'Show the venue, directions, and location details after the booking action.',
                                                social: 'Choose whether social links show, where they sit, and how they feel.'
                                            }[scene.id]
                                        }));
                                        const activeSceneId = editorStudioModal || 'introduction';
                                        const activeIndex = Math.max(0, scenes.findIndex(scene => scene.id === activeSceneId));
                                        const activeScene = scenes[activeIndex] || scenes[0];
                                        const ActiveSceneIcon = activeScene.icon;
                                        const goScene = (sceneId) => {
                                            openEditorRoom(sceneId);
                                            window.requestAnimationFrame(() => {
                                                document.querySelector('.editor-cinema-stage')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                            });
                                        };
                                        const goNext = () => goScene(scenes[Math.min(scenes.length - 1, activeIndex + 1)].id);
                                        const goPrev = () => goScene(scenes[Math.max(0, activeIndex - 1)].id);
                                        return (
                                            <>
                                                <section className="editor-cinema-hero">
                                                    <div className="editor-cinema-hero-copy">
                                                        <span>Live design</span>
                                                        <h3>Customize your page.</h3>
                                                        <p>Pick a room, tune it, preview it.</p>
                                                    </div>
                                                </section>

                                                <section className={`editor-cinema-stage editor-cinema-scene-${activeScene.id}`}>
                                                    <div className="editor-cinema-stage-head">
                                                        <div>
                                                            <span><ActiveSceneIcon size={16} /> Scene {activeScene.number}</span>
                                                            <h3>{activeScene.title}</h3>
                                                            <p>{activeScene.prompt}</p>
                                                        </div>
                                                        <div className="editor-cinema-nav-buttons">
                                                        <button type="button" onClick={goPrev} disabled={activeIndex === 0}><ChevronLeft size={15} /> Back</button>
                                                        <button type="button" onClick={goNext} disabled={activeIndex === scenes.length - 1}>Next layer <ChevronRight size={15} /></button>
                                                        </div>
                                                    </div>

                                                    <div className="editor-cinema-stage-body">
                                                        <div className="editor-cinema-live-card">
                                                            {activeScene.id === 'colours' && (
                                                                <div className="cinema-theme-preview">
                                                                    <span>{selectedPaletteName || 'Color direction'}</span>
                                                                    <h4>{`${selectedPalettePhrase || 'Colour direction'} for your booking page.`}</h4>
                                                                    <p>Pick the background, heading, and button colours clients notice first, or extract a palette from your uploaded logo and banner.</p>
                                                                    <div>{paletteFilterOptions.slice(0, 4).map(palette => <button key={palette.id} type="button" onClick={() => {
                                                                        const nextMix = [palette.id];
                                                                        handleSettingChange('editorColorMix', nextMix);
                                                                        setThemeFilterValue('palette', palette.id);
                                                                        applyColorDirection(palette.id, nextMix, settings.editorColorDepth || 45);
                                                                    }}>{palette.swatches.slice(0, 3).map(color => <i key={color} style={{ backgroundColor: color }} />)}<small>{palette.name}</small></button>)}</div>
                                                                </div>
                                                            )}

                                                            {activeScene.id === 'typography' && (
                                                                <div className="cinema-type-preview">
                                                                    <span>Font personality</span>
                                                                    <h4 style={{ fontFamily: getFontFamily(settings.headingFontFamily || settings.fontFamily) }}>Every word should feel intentional.</h4>
                                                                    <p style={{ fontFamily: getFontFamily(settings.bodyFontFamily || settings.fontFamily) }}>Tune display type, body copy, button text, labels, and spacing without hunting through the page.</p>
                                                                    <div className="cinema-type-spec"><b>Aa</b><b>Bb</b><small>Heading / Body / Labels</small></div>
                                                                </div>
                                                            )}

                                                            {(activeScene.id === 'calendar' || activeScene.id === 'time') && (
                                                                <div className="cinema-visual-preview">
                                                                    <div className="cinema-date-strip">{['Tue 19', 'Wed 20', 'Thu 21'].map((label, index) => <button key={label} type="button" className={index === 0 ? 'is-active' : ''} style={{ background: index === 0 ? settings.dateActiveBgColor || settings.primaryColor : settings.dateBgColor || '#f8fafc', color: index === 0 ? settings.dateActiveTextColor || '#050505' : settings.dateTextColor || '#050505' }}>{label}</button>)}</div>
                                                                    <div className="cinema-slot-strip">{(settings.availableTimes || ['09:00', '10:30', '12:00']).slice(0, 6).map(time => <button key={time} type="button" style={{ background: settings.slotBgColor || '#f8fafc', color: settings.slotTextColor || '#050505' }}>{time}</button>)}</div>
                                                                </div>
                                                            )}

                                                            {activeScene.id === 'services' && (
                                                                <div className="cinema-feature-preview">
                                                                    {[
                                                                        ['Services', workspaceServices.length],
                                                                        ['Live', workspaceServices.filter(service => service.active !== false).length],
                                                                        ['Staff matched', workspaceServices.filter(service => Array.isArray(service.staffIds) && service.staffIds.length > 0).length],
                                                                        ['Booking menu', true]
                                                                    ].map(([label, active]) => <span key={label} className={active ? 'is-on' : ''}>{label}</span>)}
                                                                </div>
                                                            )}

                                                            {activeScene.id === 'buttons' && (
                                                                <div className="cinema-button-preview">
                                                                    <button type="button" style={{ background: settings.buttonColor || settings.primaryColor || '#050505', color: settings.buttonTextColor || '#fff', borderRadius: settings.buttonStyle === 'sharp' ? '14px' : '999px', fontFamily: getFontFamily(settings.buttonFontFamily || settings.fontFamily) }}>{settings.confirmButtonText || 'Confirm Booking'}</button>
                                                                    <button type="button" className="secondary">FAQ</button>
                                                                    <button type="button" className="ghost">Tue 19</button>
                                                                </div>
                                                            )}

                                                            {activeScene.id === 'form' && (
                                                                <div className="cinema-feature-preview">
                                                                    {[['Name', settings.features?.collectClientName !== false], ['Phone', collectsClientPhone], ['Email', collectsClientEmail], ['Notes', collectsClientNotes], ['Email opt-in', emailUpdatesEnabled]].map(([label, active]) => <span key={label} className={active ? 'is-on' : ''}>{label}</span>)}
                                                                </div>
                                                            )}

                                                            {activeScene.id === 'introduction' && (
                                                                <div className="cinema-copy-preview">
                                                                    <input value={settings.brandName || ''} onChange={(event) => handleSettingChange('brandName', event.target.value)} placeholder={`Welcome to ${settings.businessName || 'your business'}`} />
                                                                    <input value={settings.tagline || ''} onChange={(event) => handleSettingChange('tagline', event.target.value)} placeholder="Online bookings" />
                                                                    <input value={settings.welcomeMessage || ''} onChange={(event) => handleSettingChange('welcomeMessage', event.target.value)} placeholder="Reserve your private session." />
                                                                    <input value={settings.dateLabel || ''} onChange={(event) => handleSettingChange('dateLabel', event.target.value)} placeholder="Which day are you looking to book?" />
                                                                </div>
                                                            )}
                                                            {activeScene.id === 'logo' && <div className="cinema-feature-preview">{[['Logo', settings.logo && getLogoDisplay(settings).visible], ['Placement', getLogoDisplay(settings).placement], ['Alignment', getLogoDisplay(settings).alignment], ['Size', `${getLogoDisplay(settings).size}px`]].map(([label, active]) => <span key={label} className={active ? 'is-on' : ''}>{label}</span>)}</div>}
                                                            {activeScene.id === 'banner' && <div className="cinema-feature-preview">{[['Banner', settings.bannerImage && getBannerDisplay(settings).visible], ['Placement', getBannerDisplay(settings).placement], ['Crop tool', settings.bannerImage], ['Opacity', `${getBannerDisplay(settings).opacity}%`]].map(([label, active]) => <span key={label} className={active ? 'is-on' : ''}>{label}</span>)}</div>}

                                                            {activeScene.id === 'faq' && <div className="cinema-feature-preview">{[['FAQ', settings.features?.faqEnabled], ['Questions', (settings.features?.faqs || []).length > 0], ['Look', settings.faqDisplayStyle || settings.faqStyle || 'minimal']].map(([label, active]) => <span key={label} className={active ? 'is-on' : ''}>{label}</span>)}</div>}
                                                            {activeScene.id === 'venue' && <div className="cinema-feature-preview">{[['Gallery', Array.isArray(settings.venuePhotos) && settings.venuePhotos.length > 0], ['Maps', settings.features?.location], ['Look', settings.venueGalleryStyle || 'mosaic'], ['Directions', settings.mapDisplayStyle !== 'none']].map(([label, active]) => <span key={label} className={active ? 'is-on' : ''}>{label}</span>)}</div>}
                                                            {activeScene.id === 'social' && <div className="cinema-feature-preview">{[['Shown', settings.features?.socialLinks], ['Links', Object.values(settings.socials || {}).filter(Boolean).length], ['Placement', settings.socialPlacement || 'footer'], ['Look', settings.socialDisplayStyle || settings.socialIconStyle || 'icons']].map(([label, active]) => <span key={label} className={active ? 'is-on' : ''}>{label}</span>)}</div>}
                                                        </div>

                                                        <div className="editor-cinema-control-panel">
                                                            {activeScene.id === 'services' && <>
                                                                <div className="cinema-control-title"><span>Services display</span><small>Choose how bookable services are presented on the booking page.</small></div>
                                                                <div className="service-flow-segmented" role="group" aria-label="Service display type">
                                                                    <button type="button" onClick={() => handleSettingChange('serviceDropdownEnabled', false)} className={!settings.serviceDropdownEnabled ? 'is-on' : ''}>
                                                                        <span>Display flow</span>
                                                                    </button>
                                                                    <button type="button" onClick={() => handleSettingChange('serviceDropdownEnabled', true)} className={settings.serviceDropdownEnabled ? 'is-on' : ''}>
                                                                        <span>Dropdown flow</span>
                                                                    </button>
                                                                </div>
                                                                <div className="cinema-look-picker">
                                                                    <div className="cinema-look-picker-head">
                                                                        <span>Service look</span>
                                                                        <small>{settings.serviceDropdownEnabled ? 'Premium dropdown selector' : 'Premium service list'}</small>
                                                                    </div>
                                                                    <p className="cinema-native-gradient-note">Build A Booking now handles the service layout for you. Choose the flow above, then tune only how strong the surface feels.</p>
                                                                    <StyleSegmentedControl value={settings.serviceBorderStyle || 'outline'} onChange={(value) => handleSettingChange('serviceBorderStyle', value)} label="Look" />
                                                                </div>
                                                            </>}

                                                            {activeScene.id === 'colours' && <>
                                                                <div className="cinema-control-title"><span>Page theme</span><small>Choose a colour family, then set its strength.</small></div>
                                                                <div
                                                                    className="palette-flow-room"
                                                                    style={{
                                                                        '--palette-selected': activePaletteShadeColor,
                                                                        '--palette-selected-text': activePaletteShadeText
                                                                    }}
                                                                >
                                                                    <div className="palette-flow-hero">
                                                                        <div className="palette-flow-sample" style={{ backgroundColor: activePaletteShadeColor, color: activePaletteShadeText }}>
                                                                            <span>{activePaletteFlow?.name || 'Palette'}</span>
                                                                            <strong>{String(activePaletteShade).padStart(2, '0')}</strong>
                                                                        </div>
                                                                        <div className="palette-flow-copy">
                                                                            <span>Palette</span>
                                                                            <strong>{activePaletteFlow?.name || 'Colour'} spectrum</strong>
                                                                            <small>Background first. Type, buttons, dates, slots, and surfaces follow.</small>
                                                                            <div className="palette-flow-chip-row" aria-hidden="true">
                                                                                {activePalettePreviewSwatches.map((color) => (
                                                                                    <i key={color} style={{ backgroundColor: color }} />
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="palette-spectrum-grid" aria-label="Colour spectrum">
                                                                        {paletteFlowOptions.map((palette) => {
                                                                            const isActive = activePaletteFlowId === palette.id;
                                                                            const mainSwatch = palette.swatches[1] || palette.swatches[0] || '#050505';
                                                                            const swatchColors = palette.swatches.slice(0, 3);
                                                                            return (
                                                                                <button
                                                                                    key={palette.id}
                                                                                    type="button"
                                                                                    onClick={() => applyPaletteFlowColor(palette.id, activePaletteShade)}
                                                                                    className={`palette-spectrum-card ${isActive ? 'is-active' : ''}`}
                                                                                    aria-pressed={isActive}
                                                                                    style={{
                                                                                        '--palette-a': palette.swatches[0] || mainSwatch,
                                                                                        '--palette-b': mainSwatch,
                                                                                        '--palette-c': palette.swatches[2] || mainSwatch
                                                                                    }}
                                                                                >
                                                                                    <span className="palette-spectrum-icon" aria-hidden="true">
                                                                                        {swatchColors.map((color) => <b key={color} style={{ backgroundColor: color }} />)}
                                                                                    </span>
                                                                                    <span className="palette-spectrum-copy">
                                                                                        <strong>{palette.name}</strong>
                                                                                        <small>{palette.hint}</small>
                                                                                    </span>
                                                                                    <span className="palette-spectrum-state" aria-hidden="true">
                                                                                        {isActive && <Check size={12} strokeWidth={3} />}
                                                                                    </span>
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                    <div
                                                                        className="palette-shade-panel"
                                                                        style={{
                                                                            '--palette-selected': activePaletteShadeColor,
                                                                            '--palette-selected-text': activePaletteShadeText
                                                                        }}
                                                                    >
                                                                        <div className="palette-shade-head">
                                                                            <span>Spectrum</span>
                                                                            <small>{activePaletteFlow?.name || 'Palette'} {activePaletteShade}</small>
                                                                        </div>
                                                                        <div className="palette-shade-grid" aria-label={`${activePaletteFlow?.name || 'Palette'} spectrum`}>
                                                                            {Array.from({ length: 10 }, (_, index) => {
                                                                                const shade = index + 1;
                                                                                const depth = shade * 10;
                                                                                const palette = activePaletteFlow || paletteFlowOptions[0];
                                                                                const sampleBase = palette?.swatches?.[1] || palette?.swatches?.[0] || '#050505';
                                                                                const shadeColor = tuneColorByDepth(sampleBase, depth);
                                                                                const isActive = activePaletteShade === shade;
                                                                                return (
                                                                                    <button
                                                                                        key={shade}
                                                                                        type="button"
                                                                                        onClick={() => applyPaletteFlowColor(activePaletteFlowId, shade)}
                                                                                        className={isActive ? 'is-active' : ''}
                                                                                        aria-pressed={isActive}
                                                                                        aria-label={`${activePaletteFlow?.name || 'Palette'} spectrum ${shade}`}
                                                                                        style={{ backgroundColor: shadeColor, color: readableTextFor(shadeColor) }}
                                                                                    >
                                                                                        <span>{String(shade).padStart(2, '0')}</span>
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                        <div className="palette-shade-labels" aria-hidden="true">
                                                                            <span>Light</span>
                                                                            <span>Deep</span>
                                                                            <span>Neon</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="cinema-gradient-mode" role="group" aria-label="Accent gradient mode">
                                                                        <button type="button" onClick={() => handleSettingChange('nativeAccent', true)} className={settings.nativeAccent ? 'is-active' : ''}>
                                                                            <span>Native gradient</span>
                                                                            <small>Build A Booking glow</small>
                                                                        </button>
                                                                        <button type="button" onClick={() => handleSettingChange('nativeAccent', false)} className={!settings.nativeAccent ? 'is-active' : ''}>
                                                                            <span>Custom accents</span>
                                                                            <small>Follow palette</small>
                                                                        </button>
                                                                    </div>
                                                                    <div className="cinema-control-title is-compact"><span>Fine tune</span><small>Optional section edits after the full-page theme is set.</small></div>
                                                                    <div className="cinema-color-directors">
                                                                            {[
                                                                                {
                                                                                    id: 'background',
                                                                                    label: 'Background',
                                                                                    note: 'Main page surface.',
                                                                                    value: settings.backgroundColor || '#ffffff',
                                                                                    onApply: (color) => handleSettingChange('backgroundColor', color)
                                                                                },
                                                                                {
                                                                                    id: 'headings',
                                                                                    label: 'Headings',
                                                                                    note: 'Business name and section titles.',
                                                                                    value: settings.headingColor || '#050505',
                                                                                    onApply: (color) => {
                                                                                        handleSettingChange('headingColor', color);
                                                                                        handleSettingChange('dateActiveTextColor', readableTextFor(settings.dateActiveBgColor || color));
                                                                                    }
                                                                                },
                                                                                {
                                                                                    id: 'body',
                                                                                    label: 'Body text',
                                                                                    note: 'Paragraphs, labels, and helper copy.',
                                                                                    value: settings.bodyColor || '#616672',
                                                                                    onApply: (color) => handleSettingChange('bodyColor', color)
                                                                                },
                                                                                {
                                                                                    id: 'buttons',
                                                                                    label: 'Buttons',
                                                                                    note: 'Primary actions and selected controls.',
                                                                                    value: settings.buttonColor || settings.primaryColor || '#050505',
                                                                                    onApply: (color) => {
                                                                                        handleSettingChange('buttonColor', color);
                                                                                        handleSettingChange('primaryColor', color);
                                                                                        handleSettingChange('buttonTextColor', readableTextFor(color));
                                                                                        if (!settings.nativeAccent) {
                                                                                            handleSettingChange('dateActiveBgColor', `${color}22`);
                                                                                            handleSettingChange('slotActiveBgColor', `${color}22`);
                                                                                        }
                                                                                    }
                                                                                }
                                                                            ].map((control) => {
                                                                                const displayColor = normalizeHexColor(control.value?.slice?.(0, 7), control.value || '#050505');
                                                                                return (
                                                                                    <div key={control.id} className="cinema-color-director">
                                                                                        <div className="cinema-color-director-head">
                                                                                            <span className="cinema-color-orb" style={{ backgroundColor: displayColor }} />
                                                                                            <div>
                                                                                                <b>{control.label}</b>
                                                                                                <small>{control.note}</small>
                                                                                            </div>
                                                                                            <label className="cinema-color-edit">
                                                                                                <Pipette size={14} />
                                                                                                Edit
                                                                                                <input type="color" value={displayColor} onChange={(event) => control.onApply(event.target.value)} aria-label={`Edit ${control.label.toLowerCase()} colour`} />
                                                                                            </label>
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                    </div>
                                                                    <button type="button" onClick={handleAutoDetectThemePalette} disabled={paletteDetecting}><Pipette size={15}/>{paletteDetecting ? 'Reading brand' : 'Read logo colors'}</button>
                                                                </div>
                                                            </>}

                                                            {activeScene.id === 'typography' && <>
                                                                <div className="cinema-control-title"><span>Font style</span><small>Apply a polished preset designed to keep the page balanced.</small></div>
                                                                <div className="cinema-font-grid">{fontStylePresets.map(preset => <button key={preset.id} type="button" onClick={() => applyFontStylePreset(preset)} className={(settings.headingFontFamily || settings.fontFamily) === (preset.headingFontFamily || preset.fontFamily) ? 'is-active' : ''} style={{ fontFamily: getFontFamily(preset.headingFontFamily || preset.fontFamily) }}>Aa <span>{preset.label}</span></button>)}</div>
                                                            </>}

                                                            {activeScene.id === 'introduction' && (() => {
                                                                const logoDisplay = getLogoDisplay(settings);
                                                                return (
                                                                    <div className="cinema-intro-editor">
                                                                        <p className="cinema-editor-note">Edit the first words clients see here, or click the same text directly on the mockup.</p>
                                                                        <label className="cinema-text-card is-hero">
                                                                            <span>Booking page name</span>
                                                                            <input value={settings.brandName || ''} onChange={(event) => handleSettingChange('brandName', event.target.value)} placeholder={`Welcome to ${settings.businessName || 'your business'}`} />
                                                                        </label>
                                                                        <div className="cinema-text-card-row">
                                                                            <label className="cinema-text-card">
                                                                                <span>Text above heading</span>
                                                                                <input value={settings.tagline || ''} onChange={(event) => handleSettingChange('tagline', event.target.value)} placeholder="Private bookings / by appointment" />
                                                                            </label>
                                                                            <label className="cinema-text-card">
                                                                                <span>Subtext under heading</span>
                                                                                <textarea value={settings.welcomeMessage || ''} onChange={(event) => handleSettingChange('welcomeMessage', event.target.value)} placeholder="Choose a time that works for you." />
                                                                            </label>
                                                                        </div>
                                                                        <details className="cinema-setting-group cinema-alignment-room" open>
                                                                            <summary><AlignCenter size={15}/> Page alignment</summary>
                                                                            <div className="cinema-control-title"><span>Page rhythm</span><small>Choose how the logo, headline, and booking flow line up.</small></div>
                                                                            <div className="cinema-align-grid">
                                                                                {[
                                                                                    ['left', AlignLeft],
                                                                                    ['center', AlignCenter],
                                                                                    ['right', AlignRight]
                                                                                ].map(([alignment, Icon]) => (
                                                                                    <button key={alignment} type="button" onClick={() => handleLogoDisplayChange('alignment', alignment)} className={logoDisplay.alignment === alignment ? 'is-active' : ''}>
                                                                                        <Icon size={15}/>{alignment}
                                                                                    </button>
                                                                                ))}
                                                                            </div>
                                                                        </details>
                                                                    </div>
                                                                );
                                                            })()}

                                                            {activeScene.id === 'logo' && (() => {
                                                                const logoDisplay = getLogoDisplay(settings);
                                                                return (
                                                                    <div className="cinema-media-room">
                                                                        <div className="cinema-control-title"><span>Logo placement</span><small>Use the logo as a precise brand mark, not a loose image block.</small></div>
                                                                        <section className="cinema-media-action-card is-wide">
                                                                            <div>
                                                                                <strong>{settings.logo ? 'Logo asset ready' : 'No logo uploaded'}</strong>
                                                                                <small>{settings.logo ? 'Shared from Business Profile. Crop changes stay linked everywhere.' : 'Add or crop a logo before showing it on the booking page.'}</small>
                                                                            </div>
                                                                            <div className="cinema-media-action-controls">
                                                                                {settings.logo ? (
                                                                                    <>
                                                                                        <button type="button" onClick={() => handleLogoDisplayChange('visible', !logoDisplay.visible)} className={logoDisplay.visible ? 'is-active' : ''}>{logoDisplay.visible ? 'Shown' : 'Hidden'}</button>
                                                                                        <button type="button" onClick={() => openSettingImageCrop('logo', 'logos')} aria-label="Crop logo"><Crop size={15} /></button>
                                                                                    </>
                                                                                ) : (
                                                                                    <button type="button" onClick={() => openSettingImageCrop('logo', 'logos')} className="is-active is-add-media"><ImagePlus size={15} />Add logo</button>
                                                                                )}
                                                                            </div>
                                                                        </section>
                                                                        <InterfaceLookGrid
                                                                            label="Logo position"
                                                                            looks={[
                                                                                { id: 'title', label: 'Title Lockup', note: 'Logo sits beside the page name like a brand system.' },
                                                                                { id: 'top', label: 'Top Mark', note: 'Logo appears above the headline as a quiet masthead.' },
                                                                                { id: 'badge', label: 'Corner Badge', note: 'Logo becomes a small premium badge in the hero.' }
                                                                            ]}
                                                                            value={logoDisplay.placement}
                                                                            onChange={(value) => handleLogoDisplayChange('placement', value)}
                                                                        />
                                                                        <details className="cinema-setting-group cinema-alignment-room" open>
                                                                            <summary><AlignCenter size={15}/> Logo alignment</summary>
                                                                            <div className="cinema-align-grid">
                                                                                {[
                                                                                    ['left', AlignLeft],
                                                                                    ['center', AlignCenter],
                                                                                    ['right', AlignRight]
                                                                                ].map(([alignment, Icon]) => (
                                                                                    <button key={alignment} type="button" onClick={() => handleLogoDisplayChange('alignment', alignment)} className={logoDisplay.alignment === alignment ? 'is-active' : ''}>
                                                                                        <Icon size={15}/>{alignment}
                                                                                    </button>
                                                                                ))}
                                                                            </div>
                                                                        </details>
                                                                        <label className="cinema-range-row">
                                                                            <span>Logo size</span>
                                                                            <input type="range" min="48" max="176" value={logoDisplay.size} style={{ '--range-progress': `${((logoDisplay.size - 48) / 128) * 100}%` }} onChange={(event) => handleLogoDisplayChange('size', Number(event.target.value))} />
                                                                            <b>{logoDisplay.size}px</b>
                                                                        </label>
                                                                    </div>
                                                                );
                                                            })()}

                                                            {activeScene.id === 'banner' && (() => {
                                                                const bannerDisplay = getBannerDisplay(settings);
                                                                return (
                                                                    <div className="cinema-media-room">
                                                                        <div className="cinema-control-title"><span>Banner placement</span><small>Decide whether the banner leads the page, supports the hero, or becomes a finishing panel.</small></div>
                                                                        <section className="cinema-media-action-card is-wide">
                                                                            <div>
                                                                                <strong>{settings.bannerImage ? 'Banner uploaded' : 'No banner uploaded'}</strong>
                                                                                <small>{settings.bannerImage ? 'Show, hide, or crop the uploaded banner from here.' : 'Add a banner before showing it on the booking page.'}</small>
                                                                            </div>
                                                                            <div className="cinema-media-action-controls">
                                                                                {settings.bannerImage ? (
                                                                                    <>
                                                                                        <button type="button" onClick={() => handleBannerDisplayChange('visible', !bannerDisplay.visible)} className={bannerDisplay.visible ? 'is-active' : ''}>{bannerDisplay.visible ? 'Shown' : 'Hidden'}</button>
                                                                                        <button type="button" onClick={() => openSettingImageCrop('bannerImage', 'banners')} aria-label="Crop banner" title="Crop banner"><Crop size={15} /></button>
                                                                                    </>
                                                                                ) : (
                                                                                    <button type="button" onClick={() => openSettingImageCrop('bannerImage', 'banners')} className="is-active is-add-media"><ImagePlus size={15} />Add banner</button>
                                                                                )}
                                                                            </div>
                                                                        </section>
                                                                        <InterfaceLookGrid
                                                                            label="Banner position"
                                                                            looks={[
                                                                                { id: 'hero', label: 'Hero Media', note: 'Banner sits beside the copy like a website hero.' },
                                                                                { id: 'top', label: 'Top Strip', note: 'Banner stretches above the intro as a cinematic opener.' },
                                                                                { id: 'footer', label: 'Footer Panel', note: 'Banner appears after the intro as a calmer visual pause.' }
                                                                            ]}
                                                                            value={bannerDisplay.placement}
                                                                            onChange={(value) => handleBannerDisplayChange('placement', value)}
                                                                        />
                                                                        <label className="cinema-range-row">
                                                                            <span>Banner height</span>
                                                                            <input type="range" min="120" max="360" value={bannerDisplay.height} style={{ '--range-progress': `${((bannerDisplay.height - 120) / 240) * 100}%` }} onChange={(event) => handleBannerDisplayChange('height', Number(event.target.value))} />
                                                                            <b>{bannerDisplay.height}px</b>
                                                                        </label>
                                                                        <label className="cinema-range-row">
                                                                            <span>Banner opacity</span>
                                                                            <input type="range" min="15" max="100" value={bannerDisplay.opacity} style={{ '--range-progress': `${((bannerDisplay.opacity - 15) / 85) * 100}%` }} onChange={(event) => handleBannerDisplayChange('opacity', Number(event.target.value))} />
                                                                            <b>{bannerDisplay.opacity}%</b>
                                                                        </label>
                                                                    </div>
                                                                );
                                                            })()}

                                                            {activeScene.id === 'calendar' && <>
                                                                <InterfaceLookGrid
                                                                    label="Calendar display"
                                                                    looks={editorInterfaceLooks.calendar}
                                                                    value={settings.calendarDisplayStyle || 'studio'}
                                                                    onChange={(value) => {
                                                                        handleSettingChange('calendarDisplayStyle', value);
                                                                        handleSettingChange('calendarGlow', value === 'glow');
                                                                    }}
                                                                >
                                                                    <StyleSegmentedControl value={settings.dateStyle || settings.availabilityStyle || 'solid'} onChange={(value) => handleSettingChange('dateStyle', value)} label="Border style" />
                                                                </InterfaceLookGrid>
                                                                <div className="cinema-field-grid">
                                                                    <label>Active color<input type="color" value={settings.dateActiveBgColor?.slice(0, 7) || settings.primaryColor || '#39ff14'} onChange={(event) => handleSettingChange('dateActiveBgColor', event.target.value)} /></label>
                                                                    <label>Active text<input type="color" value={settings.dateActiveTextColor || '#050505'} onChange={(event) => handleSettingChange('dateActiveTextColor', event.target.value)} /></label>
                                                                    <label>Tile background<input type="color" value={settings.dateBgColor || '#f8fafc'} onChange={(event) => handleSettingChange('dateBgColor', event.target.value)} /></label>
                                                                    <label>Tile text<input type="color" value={settings.dateTextColor || '#64748b'} onChange={(event) => handleSettingChange('dateTextColor', event.target.value)} /></label>
                                                                </div>
                                                                <div className="cinema-toggle-grid">{[
                                                                    { key: 'calendarShadow', label: 'Soft shadow', active: settings.calendarShadow !== false },
                                                                    { key: 'calendarGlow', label: 'Border glow', active: Boolean(settings.calendarGlow) }
                                                                ].map(item => <button key={item.key} type="button" onClick={() => handleSettingChange(item.key, !item.active)} className={item.active ? 'is-on' : ''}><span>{item.label}</span><i /></button>)}</div>
                                                            </>}

                                                            {activeScene.id === 'time' && <>
                                                                <InterfaceLookGrid
                                                                    label="Time display"
                                                                    looks={editorInterfaceLooks.time}
                                                                    value={settings.timeDisplayStyle || 'pill'}
                                                                    onChange={(value) => handleSettingChange('timeDisplayStyle', value)}
                                                                >
                                                                    <StyleSegmentedControl value={settings.timeSlotStyle || settings.availabilityStyle || 'solid'} onChange={(value) => { handleSettingChange('timeSlotStyle', value); handleSettingChange('availabilityStyle', value); }} label="Border style" />
                                                                </InterfaceLookGrid>
                                                                <div className="cinema-field-grid">
                                                                    <label>Slot background<input type="color" value={settings.slotBgColor || '#f8fafc'} onChange={(event) => handleSettingChange('slotBgColor', event.target.value)} /></label>
                                                                    <label>Slot text<input type="color" value={settings.slotTextColor || '#050505'} onChange={(event) => handleSettingChange('slotTextColor', event.target.value)} /></label>
                                                                    <label>Selected background<input type="color" value={settings.slotActiveBgColor?.slice(0, 7) || settings.primaryColor || '#39ff14'} onChange={(event) => handleSettingChange('slotActiveBgColor', event.target.value)} /></label>
                                                                    <label>Selected text<input type="color" value={settings.slotActiveTextColor || '#050505'} onChange={(event) => handleSettingChange('slotActiveTextColor', event.target.value)} /></label>
                                                                </div>
                                                                <div className="cinema-toggle-grid">{[
                                                                    { key: 'timeSlotShadow', label: 'Slot shadow', active: settings.timeSlotShadow !== false },
                                                                    { key: 'timeSlotGlow', label: 'Active glow', active: Boolean(settings.timeSlotGlow) }
                                                                ].map(item => <button key={item.key} type="button" onClick={() => handleSettingChange(item.key, !item.active)} className={item.active ? 'is-on' : ''}><span>{item.label}</span><i /></button>)}</div>
                                                            </>}

                                                            {activeScene.id === 'buttons' && <>
                                                                <VisualEditorGroup title="Action Button" note="Final booking action style."><StyleSegmentedControl value={settings.actionButtonStyle || 'solid'} onChange={(value) => handleSettingChange('actionButtonStyle', value)} label="Action Style" /><ButtonShapeControl value={settings.buttonStyle || 'pill'} onChange={(value) => handleSettingChange('buttonStyle', value)} /></VisualEditorGroup>
                                                                <div className="cinema-field-grid"><label>Button text<input value={settings.confirmButtonText || ''} onChange={(event) => handleSettingChange('confirmButtonText', event.target.value)} /></label><label>Button color<input type="color" value={settings.buttonColor || settings.primaryColor || '#050505'} onChange={(event) => handleSettingChange('buttonColor', event.target.value)} /></label></div>
                                                            </>}

                                                            {activeScene.id === 'form' && <>
                                                                <div className="cinema-toggle-grid">{[
                                                                    { key: 'collectClientName', label: 'Name & surname', active: settings.features?.collectClientName !== false },
                                                                    { key: 'collectClientPhone', label: 'Mobile number', active: collectsClientPhone },
                                                                    { key: 'collectClientEmail', label: 'Email address', active: collectsClientEmail },
                                                                    { key: 'collectClientNotes', label: 'Client note', active: collectsClientNotes },
                                                                    { key: 'emailUpdates', label: 'Email opt-in', active: emailUpdatesEnabled && collectsClientEmail, disabled: !collectsClientEmail }
                                                                ].map(item => { const onClick = item.onClick || (() => !item.disabled && handleFeatureChange(item.key, !item.active)); return <button key={item.key} type="button" onClick={onClick} className={`${item.active ? 'is-on' : ''} ${item.disabled ? 'is-disabled' : ''}`}><span>{item.label}</span><i /></button>; })}</div>
                                                            </>}

                                                            {activeScene.id === 'faq' && <>
                                                                <div className="cinema-toggle-grid"><button type="button" onClick={toggleFaqFeature} className={settings.features?.faqEnabled ? 'is-on' : ''}><span>Show FAQ section</span><i /></button></div>
                                                                <InterfaceLookGrid
                                                                    label="FAQ display"
                                                                    looks={editorInterfaceLooks.faq}
                                                                    value={settings.faqDisplayStyle || settings.faqStyle || 'accordion'}
                                                                    onChange={(value) => handleSettingChange('faqDisplayStyle', value)}
                                                                >
                                                                    <StyleSegmentedControl value={settings.faqStyle || 'outline'} onChange={(value) => handleSettingChange('faqStyle', value)} label="Border style" />
                                                                </InterfaceLookGrid>
                                                                <div className="cinema-field-grid"><label>FAQ background<input type="color" value={settings.faqBgColor === 'transparent' ? '#ffffff' : settings.faqBgColor || '#ffffff'} onChange={(event) => handleSettingChange('faqBgColor', event.target.value)} /></label><label>FAQ border<input type="color" value={settings.faqBorderColor || settings.primaryColor || '#39ff14'} onChange={(event) => handleSettingChange('faqBorderColor', event.target.value)} /></label></div>
                                                                <div className="cinema-faq-routing-note">
                                                                    <span><HelpCircle size={16} /></span>
                                                                    <div>
                                                                        <strong>Questions live in Business Profile</strong>
                                                                        <small>Set the actual FAQ questions and answers in your Business Profile. This room is just for the booking page styling.</small>
                                                                    </div>
                                                                    <button type="button" onClick={() => { setActiveTab('profile'); setActiveProfileSection('business'); }}>
                                                                        Open profile
                                                                    </button>
                                                                </div>
                                                            </>}

                                                            {activeScene.id === 'venue' && <div className="cinema-venue-room">
                                                                <div className="cinema-control-title"><span>Venue & directions</span><small>Gallery, map, and venue copy appear after the booking action.</small></div>
                                                                <InterfaceLookGrid
                                                                    label="Gallery display"
                                                                    looks={editorInterfaceLooks.venue}
                                                                    value={settings.venueGalleryStyle || 'mosaic'}
                                                                    onChange={(value) => handleSettingChange('venueGalleryStyle', value)}
                                                                />
                                                                <InterfaceLookGrid
                                                                    label="Maps display"
                                                                    looks={editorInterfaceLooks.maps}
                                                                    value={settings.mapDisplayStyle || 'card'}
                                                                    onChange={(value) => handleSettingChange('mapDisplayStyle', value)}
                                                                />
                                                                <div className="cinema-social-fields">
                                                                    <label><span>Gallery title</span><input value={settings.venueTitle || ''} onChange={(event) => handleSettingChange('venueTitle', event.target.value)} placeholder="Inside the space" /></label>
                                                                    <label><span>Gallery text</span><input value={settings.venueIntro || ''} onChange={(event) => handleSettingChange('venueIntro', event.target.value)} placeholder="See the place before you book." /></label>
                                                                    <label className="is-wide"><span>Google Maps / address</span><input value={settings.features?.location || ''} onChange={(event) => handleFeatureChange('location', event.target.value)} placeholder="Business address or maps link" /></label>
                                                                </div>
                                                                {Array.isArray(settings.venuePhotos) && settings.venuePhotos.length > 0 ? (
                                                                    <div className="cinema-feature-preview">
                                                                        {settings.venuePhotos.slice(0, 5).map((photo, index) => <span key={`${photo}-${index}`} className="is-on">Photo {index + 1}</span>)}
                                                                    </div>
                                                                ) : (
                                                                    <div className="cinema-faq-routing-note cinema-venue-routing-note">
                                                                        <span><Images size={16} /></span>
                                                                        <div>
                                                                            <strong>Venue photos live in Business Profile</strong>
                                                                            <small>Upload venue photos in Business Profile. This room is just for the gallery, map, and direction styling.</small>
                                                                        </div>
                                                                        <button type="button" onClick={() => { setActiveTab('profile'); setActiveProfileSection('business'); }}>
                                                                            Open profile
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>}

                                                            {activeScene.id === 'social' && <div className="cinema-social-room">
                                                                <div className="cinema-toggle-grid cinema-toggle-grid-compact"><button type="button" onClick={() => handleFeatureChange('socialLinks', !settings.features?.socialLinks)} className={settings.features?.socialLinks ? 'is-on' : ''}><span>Show social links</span><i /></button></div>
                                                                <section className="cinema-social-card">
                                                                    <div className="cinema-social-card-head">
                                                                        <strong>Social links</strong>
                                                                        <small>Choose how social links appear. Set the actual links in Business Profile.</small>
                                                                    </div>
                                                                    <InterfaceLookGrid
                                                                        label="Social display"
                                                                        looks={editorInterfaceLooks.social}
                                                                        value={settings.socialDisplayStyle || 'icons'}
                                                                        onChange={(value) => {
                                                                            handleSettingChange('socialDisplayStyle', value);
                                                                            handleSettingChange('socialIconStyle', ({ icons: 'outline', labels: 'outline', dock: 'solid', minimal: 'minimal', solid: 'solid' }[value]) || 'outline');
                                                                        }}
                                                                    />
                                                                    <StyleSegmentedControl value={settings.socialIconStyle || 'outline'} onChange={(value) => handleSettingChange('socialIconStyle', value)} label="Icon style" />
                                                                    <InterfaceLookGrid
                                                                        label="Social placement"
                                                                        looks={[
                                                                            { id: 'intro', label: 'Below Intro', note: 'Social links sit near the opening brand copy.' },
                                                                            { id: 'booking', label: 'Before Venue', note: 'Links appear after the booking controls, before venue details.' },
                                                                            { id: 'footer', label: 'Footer', note: 'Links finish the page below venue and directions.' }
                                                                        ]}
                                                                        value={settings.socialPlacement || 'footer'}
                                                                        onChange={(value) => handleSettingChange('socialPlacement', value)}
                                                                    />
                                                                </section>
                                                                <div className="cinema-faq-routing-note cinema-social-routing-note">
                                                                    <span><Globe size={16} /></span>
                                                                    <div>
                                                                        <strong>Social links live in Business Profile</strong>
                                                                        <small>Add Instagram, TikTok, Facebook, and website links in Business Profile. This room controls visibility, placement, and style.</small>
                                                                    </div>
                                                                    <button type="button" onClick={() => { setActiveTab('profile'); setActiveProfileSection('business'); }}>
                                                                        Open profile
                                                                    </button>
                                                                </div>
                                                            </div>}
                                                        </div>
                                                    </div>
                                                </section>
                                            </>
                                        );
                                    })()}
                                </div>

                            </div>
                            {editorLaunchPanel && (
                                <div className="editor-floating-launch-popover">
                                    <div className="editor-launch-popover-head">
                                        <div>
                                            <span>{editorLaunchPanel === 'booking' ? 'Booking page' : 'Draft versions'}</span>
                                            <strong>{editorLaunchPanel === 'booking' ? bookingPageRoute : `${editorDraftVersions.length} saved`}</strong>
                                        </div>
                                        <button type="button" onClick={() => setEditorLaunchPanel(null)} aria-label="Close editor panel">
                                            <X size={14} />
                                        </button>
                                    </div>
                                    {editorLaunchPanel === 'booking' ? (
                                        <div className="editor-launch-popover-body">
                                            <button type="button" onClick={() => copyToClipboard(bookingPageUrl, 'Booking page link')} className="editor-link-pill" title={bookingPageUrl}>
                                                <span>{bookingPageUrl}</span>
                                                <Share2 size={13} />
                                            </button>
                                            <div className="editor-launch-actions">
                                                <button type="button" onClick={() => copyToClipboard(bookingPageUrl, 'Booking page link')}>Copy link</button>
                                                <button type="button" onClick={openBookingPage}>Open page</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="editor-launch-popover-body">
                                            <div className="editor-version-save-row">
                                                <input
                                                    value={editorDraftNameInput}
                                                    onChange={(event) => setEditorDraftNameInput(event.target.value)}
                                                    placeholder="Version name"
                                                />
                                                <button type="button" onClick={saveEditorVersion}>Save version</button>
                                            </div>
                                            <div className="editor-version-list">
                                                {editorDraftVersions.length > 0 ? editorDraftVersions.slice(0, 4).map(version => (
                                                    <article key={version.id} className="editor-version-row">
                                                        <button type="button" onClick={() => { restoreEditorVersion(version); setEditorLaunchPanel(null); }} title="Restore this version">
                                                            <strong>{version.name || 'Saved version'}</strong>
                                                            <span>{formatEditorVersionTime(version.savedAt)}</span>
                                                        </button>
                                                        <button type="button" onClick={() => deleteEditorVersion(version.id)} aria-label={`Delete ${version.name || 'saved version'}`}>
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </article>
                                                )) : (
                                                    <p>No named versions yet. Save one before you experiment.</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="editor-floating-launch-toolbar">
                                <button type="button" onClick={() => setEditorLaunchPanel(panel => panel === 'booking' ? null : 'booking')} className={editorLaunchPanel === 'booking' ? 'is-active' : ''} aria-label="Booking page link" title="Booking page link">
                                    <Globe size={16} />
                                    <span className="editor-launch-action-label">Page</span>
                                </button>
                                <button type="button" onClick={() => setEditorLaunchPanel(panel => panel === 'drafts' ? null : 'drafts')} className={editorLaunchPanel === 'drafts' ? 'is-active' : ''} aria-label="Draft versions" title="Draft versions">
                                    <History size={16} />
                                    <span className="editor-launch-action-label">Versions</span>
                                    {editorDraftVersions.length > 0 && <span className="editor-launch-count">{editorDraftVersions.length}</span>}
                                </button>
                                <button type="button" onClick={() => saveSettingsDraft(settings, "Editor draft saved.")} aria-label="Save draft" title="Save draft">
                                    <CheckCircle2 size={16} />
                                    <span className="editor-launch-action-label">Save</span>
                                </button>
                                <button type="button" onClick={saveSettings} className="is-primary" aria-label="Publish to web" title="Publish to web">
                                    <ArrowRight size={16} />
                                    <span className="editor-launch-action-label">Publish</span>
                                </button>
                            </div>
                            </>
                        )}
                        </div>

                        <button
                            type="button"
                            onClick={() => setEditorCollapsed(!editorCollapsed)}
                            aria-label={editorCollapsed ? 'Expand editor controls' : 'Collapse editor controls'}
                            title={editorCollapsed ? 'Expand editor controls' : 'Collapse editor controls'}
                            className="desktop-editor-panel-toggle hidden md:flex fixed bottom-6 right-6 md:bottom-10 md:right-10 z-[100] w-12 h-12 bg-white border border-neutral-100 rounded-full shadow-2xl items-center justify-center text-neutral-400 hover:text-black transition-all hover:scale-110"
                        >
                            {editorCollapsed ? <PanelRightOpen size={20} /> : <PanelRightClose size={20} />}
                        </button>

                        {/* LIVE SIMULATOR ENVIRONMENT */}
                        <div ref={containerRef} className="mobile-editor-preview flex-1 bg-[#F5F5F7] flex flex-col items-center justify-center relative overflow-hidden p-6 md:p-8">
                        <div className="mobile-editor-preview-toolbar absolute top-4 md:top-8 flex flex-col md:flex-row items-center gap-3 md:gap-12 z-50">
                            <div className="mobile-editor-device-switcher flex bg-white/60 backdrop-blur-xl p-1.5 rounded-full border border-white/80 shadow-sm">
                                <button onClick={() => handleEditorDeviceChange('desktop')} className={`mobile-editor-device-option px-8 py-2.5 rounded-full text-[9px] font-bold uppercase tracking-[0.4em] transition-all duration-700 ${device === 'desktop' ? 'bg-black text-white shadow-lg' : 'text-neutral-400 hover:text-black'}`}>PC</button>
                                <button onClick={() => handleEditorDeviceChange('mobile')} className={`mobile-editor-device-option px-8 py-2.5 rounded-full text-[9px] font-bold uppercase tracking-[0.4em] transition-all duration-700 ${device === 'mobile' ? 'bg-black text-white shadow-lg' : 'text-neutral-400 hover:text-black'}`}>Mobile</button>
                            </div>
                            <div className="mobile-editor-toolbar-actions flex items-center gap-2">
                                <button onClick={handleAddToHomeScreen} className="mobile-editor-install-action hidden h-11 px-4 rounded-full bg-black text-white shadow-lg border border-black transition-all items-center justify-center gap-2 text-[9px] font-bold uppercase tracking-widest">
                                    <Share2 size={15}/>
                                    Home Screen
                                </button>
                                <button type="button" aria-label="Refresh booking preview" onClick={() => setPreviewKey(prev => prev + 1)} className="mobile-editor-refresh-action p-3 rounded-full bg-white text-neutral-400 hover:text-black shadow-lg border border-white/80 transition-all hidden md:block"><RefreshCw size={16}/></button>
                            </div>
                        </div>

                        <div className="mobile-editor-compact-controls md:hidden absolute right-4 bottom-4 z-[180] items-center gap-2 rounded-full bg-black/80 p-1.5 shadow-2xl backdrop-blur-xl border border-white/10">
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
                            className={`editor-preview-room-nav ${device === 'mobile' ? 'is-phone' : 'is-desktop'} ${editorRoomNavOffset.x || editorRoomNavOffset.y ? 'is-custom-position' : ''}`}
                            aria-label="Preview editing rooms"
                            style={{
                                '--editor-room-nav-x': `${editorRoomNavOffset.x}px`,
                                '--editor-room-nav-y': `${editorRoomNavOffset.y}px`
                            }}
                        >
                            <button
                                type="button"
                                className="editor-preview-room-nav-grip"
                                aria-label="Move editor toolbar"
                                title="Drag to move toolbar. Double click to reset."
                                onPointerDown={startEditorRoomNavDrag}
                                onPointerMove={moveEditorRoomNavDrag}
                                onPointerUp={endEditorRoomNavDrag}
                                onPointerCancel={endEditorRoomNavDrag}
                                onDoubleClick={() => setEditorRoomNavOffset({ x: 0, y: 0 })}
                            >
                                <GripVertical size={14} />
                                <span>Move</span>
                            </button>
                            {editorRoomScenes.map((scene) => {
                                const SceneIcon = scene.icon;
                                const isActive = (editorStudioModal || 'introduction') === scene.id;
                                return (
                                    <button
                                        key={scene.id}
                                        type="button"
                                        onClick={() => openEditorRoom(scene.id)}
                                        className={isActive ? 'is-active' : ''}
                                        title={scene.title}
                                    >
                                        <SceneIcon size={13} />
                                        <span>{scene.title}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {showPortraitDesktopEditorPrompt ? (
                            <div className="editor-portrait-desktop-prompt" role="status" aria-live="polite">
                                <div>
                                    <RefreshCw size={20} />
                                    <span>PC mockup</span>
                                </div>
                                <h3>Please rotate your phone.</h3>
                                <p>Landscape gives the PC preview enough room to edit without squashing the page.</p>
                                <button type="button" onClick={() => handleEditorDeviceChange('mobile')}>Back to mobile</button>
                            </div>
                        ) : (
                        <div
                            style={{
                                width: `${editorPreviewFrame.width}px`,
                                height: `${editorPreviewFrame.height}px`,
                                transform: `scale(${scale})`,
                                transformOrigin: isCompactEditorViewport ? 'top center' : 'center center'
                            }}
                            className="editor-preview-mount-shell"
                        >
                        <div
                            style={{
                                width: `${editorPreviewFrame.width}px`,
                                height: `${editorPreviewFrame.height}px`,
                                '--booking-preview-input-color': settings.headingColor || '#050505'
                            }}
                            className={`editor-preview-frame ${device === 'mobile' ? 'is-mobile-preview' : 'is-desktop-preview'} relative flex flex-col shrink-0 bg-white shadow-[0_100px_200px_-50px_rgba(0,0,0,0.15)] border-black overflow-hidden ${editorPreviewFrameClass}`}
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
                                    <AppErrorBoundary compact label="Live Preview" resetKey={previewKey}>
                                        <BookingFlow key={previewKey} settings={settings} isPreview={true} onInspect={handleInspect} onSettingChange={handleSettingChange} onComplete={handleBookingComplete} />
                                    </AppErrorBoundary>
                                </Suspense>
                                </>
                            ) : (
                                <div className="h-full w-full flex items-center justify-center">
                                    <BrandLoader label="Loading preview" />
                                </div>
                            )}
                            </div>
                        </div>
                        </div>
                        )}
                        </div>
                    </div>
                    )}

                    {activeTab === 'bookings' && (
                    <div className="flex-1 overflow-y-auto bg-[#F6F7F9] p-4 sm:p-6 md:p-10 lg:p-12">
                        {manualBookingOpen && (
                            <div className="manual-booking-overlay fixed inset-0 z-[220] bg-black/45 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6">
                                <form onSubmit={handleManualBookingSubmit} className="manual-booking-sheet w-full md:max-w-5xl max-h-[94dvh] overflow-y-auto bg-white rounded-t-[1.6rem] md:rounded-2xl border border-neutral-100 shadow-2xl shadow-black/30">
                                    <div className="manual-booking-header sticky top-0 z-10 bg-white/92 backdrop-blur-xl border-b border-neutral-100 p-4 md:p-6 flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1">Manual Booking</p>
                                            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-black">Add Booking</h2>
                                            <p className="text-sm text-neutral-500 mt-1">Create an appointment for walk-ins, phone calls, DMs, or staff-entered bookings.</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setManualBookingOpen(false)}
                                            aria-label="Close manual booking form"
                                            className="w-10 h-10 rounded-full bg-white border border-neutral-200 text-neutral-500 hover:text-black hover:border-black flex items-center justify-center shrink-0"
                                        >
                                            <X size={17}/>
                                        </button>
                                    </div>

                                    <div className="manual-booking-body p-4 md:p-6 space-y-4">
                                        <section className="manual-booking-section">
                                            <div className="manual-booking-section-head">
                                                <User size={16}/>
                                                <span>Client</span>
                                            </div>
                                            <div className="manual-booking-grid">
                                                <label className="manual-booking-field md:col-span-2">
                                                    <span>Name</span>
                                                    <input name="clientName" required placeholder="Client name" />
                                                </label>
                                                <label className="manual-booking-field">
                                                    <span>Phone</span>
                                                    <input name="clientPhone" type="tel" placeholder="+27 82 000 0000" />
                                                </label>
                                                <label className="manual-booking-field">
                                                    <span>Email</span>
                                                    <input name="clientEmail" type="email" placeholder="client@email.com" />
                                                </label>
                                                <label className="manual-booking-field">
                                                    <span>Birthday</span>
                                                    <input name="clientBirthday" placeholder="MM/DD or 9 December" />
                                                </label>
                                            </div>
                                        </section>

                                        <section className="manual-booking-section">
                                            <div className="manual-booking-section-head">
                                                <Calendar size={16}/>
                                                <span>Appointment</span>
                                            </div>
                                            <div className="manual-booking-grid">
                                                <label className="manual-booking-field">
                                                    <span>Date</span>
                                                    <input name="bookingDate" type="date" required defaultValue={getLocalDateStr(new Date())} />
                                                </label>
                                                <label className="manual-booking-field">
                                                    <span>Time</span>
                                                    <input name="bookingTime" type="time" required defaultValue="09:00" />
                                                </label>
                                                <label className="manual-booking-field">
                                                    <span>Status</span>
                                                    <select name="bookingStatus" defaultValue="confirmed">
                                                        <option value="confirmed">Confirmed</option>
                                                        <option value="pending">Needs review</option>
                                                        <option value="waitlist">Waitlist</option>
                                                    </select>
                                                </label>
                                                <label className="manual-booking-field">
                                                    <span>Staff</span>
                                                    <select name="staffId" defaultValue={activeStaffProfile?.id || displayStaffList[0]?.id || ''}>
                                                        <option value="">Unassigned</option>
                                                        {displayStaffList.map(staff => <option key={staff.id} value={staff.id}>{staff.name}</option>)}
                                                    </select>
                                                </label>
                                            </div>
                                        </section>

                                        <section className="manual-booking-section">
                                            <div className="manual-booking-section-head">
                                                <Briefcase size={16}/>
                                                <span>Service</span>
                                            </div>
                                            <div className="manual-booking-grid">
                                                <label className="manual-booking-field md:col-span-2">
                                                    <span>Service</span>
                                                    <select name="serviceId" value={manualBookingServiceId} onChange={(event) => setManualBookingServiceId(event.target.value)}>
                                                        {workspaceServices.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}
                                                        <option value="custom">Custom service</option>
                                                    </select>
                                                </label>
                                                {!selectedManualBookingService && (
                                                    <label className="manual-booking-field md:col-span-2">
                                                        <span>Custom service name</span>
                                                        <input name="customServiceName" placeholder="Walk-in cut, consultation, private booking..." />
                                                    </label>
                                                )}
                                                <label className="manual-booking-field">
                                                    <span>Price</span>
                                                    <input name="servicePrice" inputMode="decimal" placeholder="0" defaultValue={selectedManualBookingService?.price || ''} disabled={Boolean(selectedManualBookingService)} />
                                                </label>
                                                <label className="manual-booking-field">
                                                    <span>Duration</span>
                                                    <input name="serviceDuration" inputMode="numeric" placeholder="60" defaultValue={selectedManualBookingService?.duration || ''} disabled={Boolean(selectedManualBookingService)} />
                                                </label>
                                                <label className="manual-booking-field md:col-span-2">
                                                    <span>Category</span>
                                                    <input name="serviceCategory" placeholder="Barbering, beauty, consultation..." defaultValue={selectedManualBookingService?.category || ''} disabled={Boolean(selectedManualBookingService)} />
                                                </label>
                                            </div>
                                        </section>

                                        <section className="manual-booking-section">
                                            <div className="manual-booking-section-head">
                                                <CreditCard size={16}/>
                                                <span>Payment</span>
                                            </div>
                                            <div className="manual-booking-grid">
                                                <label className="manual-booking-field">
                                                    <span>Method</span>
                                                    <select name="paymentMethod" defaultValue="">
                                                        <option value="">No payment yet</option>
                                                        <option value="cash">Cash</option>
                                                        <option value="manual_eft">Direct EFT</option>
                                                        <option value="yoco">Yoco</option>
                                                        <option value="stripe">Stripe</option>
                                                        <option value="payfast">PayFast</option>
                                                        <option value="paystack">Paystack</option>
                                                        <option value="ozow">Ozow</option>
                                                    </select>
                                                </label>
                                                <label className="manual-booking-field">
                                                    <span>Payment Status</span>
                                                    <select name="paymentStatus" defaultValue="unpaid">
                                                        <option value="unpaid">Unpaid</option>
                                                        <option value="manual_pending">Pending payment</option>
                                                        <option value="paid">Paid</option>
                                                    </select>
                                                </label>
                                                <label className="manual-booking-field md:col-span-2">
                                                    <span>Reference</span>
                                                    <input name="paymentReference" placeholder="Optional invoice, receipt, or EFT reference" />
                                                </label>
                                            </div>
                                        </section>

                                        <section className="manual-booking-section">
                                            <div className="manual-booking-section-head">
                                                <MessageSquare size={16}/>
                                                <span>Notes</span>
                                            </div>
                                            <label className="manual-booking-field">
                                                <span>Internal note</span>
                                                <textarea name="clientNote" placeholder="Preferences, request source, deposit notes, accessibility needs..." />
                                            </label>
                                        </section>
                                    </div>

                                    <div className="manual-booking-footer sticky bottom-0 bg-white/94 backdrop-blur-xl border-t border-neutral-100 p-4 md:p-5 flex flex-col sm:flex-row gap-3 sm:justify-end">
                                        <button type="button" onClick={() => setManualBookingOpen(false)} className="h-12 px-5 rounded-xl bg-white border border-neutral-200 text-black text-[10px] font-bold uppercase tracking-widest hover:border-black transition-colors">
                                            Cancel
                                        </button>
                                        <button type="submit" className="h-12 px-6 rounded-xl bg-black text-white text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors shadow-xl shadow-black/10">
                                            <Check size={15}/> Save Booking
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        <section data-tour="bookings-queue" className="saas-card booking-desk-shell overflow-hidden">
                            <div className="booking-desk-command p-4 md:p-5 border-b border-neutral-100">
                                    <div className="booking-desk-head flex flex-col xl:flex-row xl:items-start justify-between gap-4">
                                        <div className="booking-desk-title-block">
                                            <p className="booking-desk-eyebrow text-[10px] font-bold uppercase text-neutral-400 mb-2">Booking Desk</p>
                                            <h2 className="booking-desk-title text-2xl md:text-3xl font-bold tracking-tight text-black">
                                                {bookingDesk.activeFilter === 'upcoming' ? 'Latest Upcoming' : `${bookingDesk.activeFilterLabel} Bookings`}
                                            </h2>
                                        <p className="booking-desk-subcopy text-sm text-neutral-500 mt-1">
                                            {showBookingExample
                                                ? '0 real records. Example shown for layout only.'
                                                : `${bookingRows.length} shown / ${bookingDesk.period.rangeLabel}.`}
                                        </p>
                                    </div>
                                    <div className="booking-desk-head-actions">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setManualBookingServiceId(workspaceServices[0]?.id || 'custom');
                                                setManualBookingOpen(true);
                                            }}
                                            className="booking-add-inline-button"
                                        >
                                            <Plus size={14}/> Booking
                                        </button>
                                        <div className="booking-period-tabs schedule-scope-toggle flex bg-neutral-100 p-1 rounded-lg border border-neutral-200 w-full sm:w-fit">
                                            {bookingDesk.periods.map(period => (
                                                <button
                                                    key={period.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setBookingDeskPeriod(period.id);
                                                        if (period.id === 'custom') setBookingRangeDialogOpen(true);
                                                    }}
                                                    className={`booking-period-tab flex-1 sm:flex-none h-10 px-4 rounded-md text-[10px] font-bold uppercase transition-all ${bookingDeskPeriod === period.id ? 'is-active bg-[#39FF14] text-black shadow-lg shadow-[#39FF14]/20' : 'text-neutral-500 hover:text-black hover:bg-white'}`}
                                                >
                                                    {period.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="booking-desk-controls mt-4 flex flex-col xl:flex-row gap-3">
                                    <label className="booking-search-field relative flex-1 min-w-0">
                                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-300" />
                                        <input
                                            value={bookingSearch}
                                            onChange={(event) => setBookingSearch(event.target.value)}
                                            placeholder="Search client, phone, email, note"
                                            aria-label="Search bookings"
                                            className="booking-desk-input w-full h-12 rounded-lg bg-white border border-neutral-200 pl-11 pr-4 text-sm font-bold text-black outline-none focus:border-black transition-colors"
                                        />
                                    </label>
                                    <div className="booking-desk-selects grid grid-cols-2 gap-2 xl:w-[420px]">
                                        <details name="booking-desk-filter-menu" className="booking-desk-menu relative" onBlur={(event) => !event.currentTarget.contains(event.relatedTarget) && event.currentTarget.removeAttribute('open')}>
                                            <summary className="booking-desk-select-face">
                                                <span>{bookingPaymentFilterOptions.find(([value]) => value === bookingPaymentFilter)?.[1] || 'All payments'}</span>
                                                <ChevronDown size={14} aria-hidden="true" />
                                            </summary>
                                            <div className="booking-desk-menu-panel">
                                                {bookingPaymentFilterOptions.map(([value, label]) => (
                                                    <button
                                                        key={value}
                                                        type="button"
                                                        className={bookingPaymentFilter === value ? 'is-selected' : ''}
                                                        onClick={(event) => {
                                                            setBookingPaymentFilter(value);
                                                            event.currentTarget.closest('details')?.removeAttribute('open');
                                                        }}
                                                    >
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                        </details>
                                        <details name="booking-desk-filter-menu" className="booking-desk-menu relative" onBlur={(event) => !event.currentTarget.contains(event.relatedTarget) && event.currentTarget.removeAttribute('open')}>
                                            <summary className="booking-desk-select-face">
                                                <span>{bookingSortOptions.find(([value]) => value === bookingSort)?.[1] || 'Newest first'}</span>
                                                <ChevronDown size={14} aria-hidden="true" />
                                            </summary>
                                            <div className="booking-desk-menu-panel">
                                                {bookingSortOptions.map(([value, label]) => (
                                                    <button
                                                        key={value}
                                                        type="button"
                                                        className={bookingSort === value ? 'is-selected' : ''}
                                                        onClick={(event) => {
                                                            setBookingSort(value);
                                                            event.currentTarget.closest('details')?.removeAttribute('open');
                                                        }}
                                                    >
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                        </details>
                                    </div>
                                    <div className="booking-filter-rail flex flex-wrap items-center gap-2">
                                        {bookingDesk.filters.map(filter => {
                                            const FilterIcon = filter.icon || Layers;
                                            return (
                                                <button
                                                    key={filter.id}
                                                    type="button"
                                                    onClick={() => setBookingFilter(filter.id)}
                                                    className={`booking-filter-chip h-11 px-3 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-2 ${bookingDesk.activeFilter === filter.id ? 'is-active bg-black text-white shadow-lg' : 'bg-neutral-50 text-neutral-500 hover:bg-neutral-100 hover:text-black'}`}
                                                >
                                                    <FilterIcon size={13} />
                                                    <span>{filter.label}</span>
                                                    <span className={`booking-filter-count min-w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${bookingDesk.activeFilter === filter.id ? 'native-gradient-icon text-black' : 'bg-white text-black border border-neutral-100'}`}>{filter.count}</span>
                                                </button>
                                            );
                                        })}
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
                                    const serviceDetails = getBookingService(b);
                                    const serviceSummary = serviceDetails?.name
                                        ? [serviceDetails.name, formatServiceDuration(serviceDetails.duration), formatServicePrice(serviceDetails)].filter(Boolean).join(' / ')
                                        : '';
                                    const statusStyle = b.status === 'confirmed'
                                        ? 'bg-[#39FF14] text-black'
                                        : b.status === 'waitlist'
                                            ? 'bg-amber-100 text-amber-800'
                                            : b.status === 'declined'
                                                ? 'bg-red-50 text-red-600'
                                                : 'bg-black text-white';
                                    const hasManualPayment = Boolean(b.paymentMethod || b.paymentGateway || b.paymentStatus === 'manual_pending');
                                    const isPaid = b.paymentStatus === 'paid';
                                    const isConfirmed = b.status === 'confirmed';
                                    return (
                                        <div key={b.id} className={`booking-record-row p-4 md:p-5 ${b.status === 'declined' ? 'opacity-50 grayscale' : ''}`}>
                                            <div className="booking-record-grid grid grid-cols-1 2xl:grid-cols-12 gap-4 2xl:items-center">
                                                <div className="booking-record-client 2xl:col-span-5 flex items-center gap-4 min-w-0">
                                                    <div className="booking-record-avatar-wrap relative shrink-0">
                                                        <div className={`w-14 h-14 rounded-lg flex items-center justify-center font-bold text-xl uppercase overflow-hidden ${clientAvatar ? 'bg-neutral-100 text-black' : 'booking-avatar-placeholder'}`}>
                                                            {clientAvatar ? <img src={clientAvatar} alt="" className="w-full h-full object-cover" /> : b.clientName.charAt(0)}
                                                        </div>
                                                        {b.noShowHistory && <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-sm" title="No-show history" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="booking-record-client-head flex items-center gap-3 mb-1">
                                                            <h3 className="text-lg md:text-xl font-bold tracking-tight text-black truncate">{b.clientName}</h3>
                                                            {isExampleBooking && <span className="shrink-0 px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest bg-neutral-100 text-neutral-500">Example Only</span>}
                                                            <span className={`booking-record-status shrink-0 px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest ${statusStyle}`}>{b.status === 'waitlist' ? 'Standby' : b.status}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => setBookingInfoDialog(b)}
                                                                className="booking-record-info-button"
                                                                aria-label={`View booking information for ${b.clientName}`}
                                                            >
                                                                <Info size={13} />
                                                                <span>Info</span>
                                                            </button>
                                                        </div>
                                                        {serviceSummary && (
                                                            <p className="booking-record-service mt-2 inline-flex max-w-full items-center gap-2 rounded-full bg-neutral-50 border border-neutral-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
                                                                <Briefcase size={12} className="shrink-0" />
                                                                <span className="truncate">{serviceSummary}</span>
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="booking-record-time 2xl:col-span-2">
                                                    <p className="metric-value text-2xl font-bold tracking-tight text-black">{b.time}</p>
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{b.date}</p>
                                                </div>

                                                <div className="booking-record-staff 2xl:col-span-3">
                                                    {isExampleBooking ? (
                                                        <div className="inline-flex h-10 items-center px-3 rounded-lg bg-neutral-50 border border-neutral-100 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                                                            Example preview
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-300 hidden md:inline">Assigned</span>
                                                            <select
                                                                aria-label={`Assign staff for ${b.clientName}`}
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

                                                <div className="booking-record-actions 2xl:col-span-2 flex flex-wrap items-center justify-start 2xl:justify-end gap-2">
                                                    {isExampleBooking ? (
                                                        <div className="flex flex-wrap items-center justify-start xl:justify-end gap-2">
                                                            <button type="button" disabled className="h-10 px-3 rounded-lg bg-white border border-neutral-200 text-neutral-500 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest cursor-default">
                                                                <Calendar size={14} /> Reschedule
                                                            </button>
                                                            <button type="button" disabled className="h-10 px-3 rounded-lg bg-white border border-neutral-200 text-neutral-500 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest cursor-default">
                                                                <MessagesSquare size={14} /> Chat
                                                            </button>
                                                            <button type="button" disabled className="h-10 px-3 rounded-lg bg-white border border-neutral-200 text-amber-700 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest cursor-default">
                                                                <Hourglass size={14} /> Waitlist
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
                                                                aria-label={`Open chat for ${b.clientName}`}
                                                                className="h-10 px-3 rounded-lg bg-white border border-neutral-200 text-neutral-600 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-50 hover:text-black hover:border-black transition-all"
                                                            >
                                                                <MessagesSquare size={14} /> Chat
                                                            </button>
                                                            <button
                                                                onClick={() => sendRunningLateToBooking(b)}
                                                                aria-label={`Send running late update to ${b.clientName}`}
                                                                title="Running late"
                                                                className="h-10 px-3 rounded-lg bg-white border border-neutral-200 text-neutral-600 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-50 hover:text-black hover:border-neutral-300 transition-all"
                                                            >
                                                                <RunningPersonIcon size={14} /> Late
                                                            </button>
                                                            {hasManualPayment && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        if (isPaid) return;
                                                                        setConfirmDialog({
                                                                            eyebrow: 'Payment',
                                                                            title: 'Mark this booking as paid?',
                                                                            body: 'This will move the manual payment from pending into paid revenue.',
                                                                            actionLabel: 'Yes',
                                                                            onConfirm: () => markBookingPaid(b)
                                                                        });
                                                                    }}
                                                                    aria-label={isPaid ? `${b.clientName} payment is paid` : `Mark ${b.clientName} booking as paid`}
                                                                    aria-disabled={isPaid}
                                                                    className={`booking-payment-button h-10 px-3 rounded-lg flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all ${isPaid ? 'is-paid cursor-default' : 'is-unpaid bg-white text-neutral-700 border border-neutral-200 hover:bg-white hover:text-black hover:border-neutral-300 hover:-translate-y-0.5'}`}
                                                                >
                                                                    <DollarSign size={14} strokeWidth={2.8} /> {isPaid ? 'Paid' : 'Mark Paid'}
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => sendReviewToBooking(b)}
                                                                aria-label={`Send review request to ${b.clientName}`}
                                                                className="h-10 px-3 rounded-lg bg-white border border-neutral-200 text-neutral-600 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-50 hover:text-black transition-all"
                                                            >
                                                                <Mail size={14} /> Review
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    if (isConfirmed) return;
                                                                    sendWaitlistToBooking(b);
                                                                }}
                                                                aria-label={b.status === 'waitlist' ? `Notify ${b.clientName} from waitlist` : `Move ${b.clientName} to waitlist`}
                                                                aria-disabled={isConfirmed}
                                                                disabled={isConfirmed}
                                                                title={b.status === 'waitlist' ? 'Notify waitlist' : isConfirmed ? 'Already confirmed' : 'Move to waitlist'}
                                                                className={`booking-waitlist-button h-10 px-3 rounded-lg flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all ${b.status === 'waitlist' ? 'is-waitlist bg-amber-100 text-amber-800 hover:bg-amber-200' : isConfirmed ? 'is-disabled bg-white border border-neutral-200 text-neutral-300 cursor-default' : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-amber-50 hover:text-amber-700'}`}
                                                            >
                                                                <Hourglass size={14} /> {b.status === 'waitlist' ? 'Notify' : 'Waitlist'}
                                                            </button>
                                                            {(b.status === 'pending' || b.status === 'waitlist') && (
                                                                <>
                                                                    <button onClick={() => approveBooking(b)} aria-label={`Approve booking for ${b.clientName}`} className="h-10 px-3 rounded-lg bg-[#39FF14] text-black flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:brightness-95 transition-all">
                                                                        <Check size={15} strokeWidth={3} /> Approve
                                                                    </button>
                                                                    <button type="button" aria-label={`Deny booking for ${b.clientName}`} onClick={() => updateBooking(b.id, { status: 'declined' })} className="h-10 w-10 rounded-lg bg-white border border-neutral-200 flex items-center justify-center text-red-500 hover:bg-red-50 transition-all">
                                                                        <X size={16} strokeWidth={3} />
                                                                    </button>
                                                                </>
                                                            )}
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
                                        <button type="button" aria-label="Close date range picker" onClick={() => setBookingRangeDialogOpen(false)} className="w-10 h-10 rounded-full bg-neutral-50 border border-neutral-100 flex items-center justify-center text-neutral-500 hover:text-black">
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

