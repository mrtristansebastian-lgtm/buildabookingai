import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react';
import { PRESET_THEMES } from '../data/themes';
import { THEME_FILTER_GROUPS } from '../utils/theme';

export const logoAlignmentOptions = [
  { id: 'left', label: 'Left', icon: AlignLeft },
  { id: 'center', label: 'Center', icon: AlignCenter },
  { id: 'right', label: 'Right', icon: AlignRight }
];

export const textAlignmentOptions = logoAlignmentOptions;

export const legalPages = {
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
export const visualStyleOptions = [
  { id: 'minimal', label: 'Minimal' },
  { id: 'outline', label: 'Outline' },
  { id: 'solid', label: 'Solid' }
];

export const editorInterfaceLooks = {
  services: [
    { id: 'cards', label: 'Signature Cards', note: 'Image, price, and detail led service cards.' },
    { id: 'menu', label: 'Clean Menu', note: 'Compact list for quick service selection.' },
    { id: 'gallery', label: 'Gallery Lead', note: 'Visual-first cards for beauty, tattoos, and venues.' },
    { id: 'compact', label: 'Fast List', note: 'Dense rows for high-volume service menus.' },
    { id: 'luxury', label: 'Editorial', note: 'More premium spacing and quiet details.' }
  ],
  calendar: [
    { id: 'studio', label: 'Studio Strip', note: 'Clean horizontal booking dates.' },
    { id: 'classic', label: 'Classic Calendar', note: 'Familiar day cards with soft separation.' },
    { id: 'editorial', label: 'Editorial Dates', note: 'Large type and minimal controls.' },
    { id: 'compact', label: 'Compact Board', note: 'Smaller cards for busy schedules.' },
    { id: 'glow', label: 'Glow Select', note: 'More visible selected-day accent.' }
  ],
  time: [
    { id: 'pill', label: 'Soft Pills', note: 'Friendly rounded bookable times.' },
    { id: 'blocks', label: 'Time Blocks', note: 'Structured tiles for sessions and classes.' },
    { id: 'minimal', label: 'Line List', note: 'Quiet text-led choices.' },
    { id: 'luxury', label: 'Luxury Slots', note: 'Premium spacing and subtle border work.' },
    { id: 'compact', label: 'Quick Slots', note: 'Dense rows for many available times.' }
  ],
  faq: [
    { id: 'accordion', label: 'Accordion', note: 'Classic expandable questions.' },
    { id: 'cards', label: 'Answer Cards', note: 'Soft boxed answers with extra clarity.' },
    { id: 'minimal', label: 'Minimal Lines', note: 'Clean dividers and quiet type.' },
    { id: 'numbered', label: 'Numbered Help', note: 'Guided FAQ for policies and prep.' },
    { id: 'split', label: 'Split Guide', note: 'Question and answer feel more editorial.' }
  ],
  venue: [
    { id: 'mosaic', label: 'Mosaic', note: 'A polished gallery wall with a hero photo.' },
    { id: 'editorial', label: 'Editorial', note: 'Large first image and magazine-style captions.' },
    { id: 'filmstrip', label: 'Filmstrip', note: 'Horizontal scroll for mobile-friendly browsing.' },
    { id: 'postcard', label: 'Postcard', note: 'Warm framed venue highlights.' },
    { id: 'minimal', label: 'Minimal Grid', note: 'Simple, clean image tiles.' }
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

export const themeTemplateKeys = [
  'primaryColor', 'headingColor', 'bodyColor', 'backgroundColor',
  'slotBgColor', 'slotTextColor', 'dateBgColor', 'dateTextColor',
  'dateActiveBgColor', 'dateActiveTextColor', 'buttonTextColor',
  'fontFamily', 'nativeAccent',
  'headingFontFamily', 'bodyFontFamily', 'buttonFontFamily', 'slotFontFamily', 'dateFontFamily',
  'brandNameSize', 'brandNameFontFamily', 'taglineSize', 'taglineFontFamily',
  'welcomeSize', 'welcomeFontFamily', 'headingLetterSpacing', 'subtextLetterSpacing',
  'buttonStyle', 'availabilityStyle', 'dateStyle', 'timeSlotStyle', 'actionButtonStyle',
  'calendarDisplayStyle', 'timeDisplayStyle', 'serviceDisplayStyle',
  'faqStyle', 'faqDisplayStyle', 'faqBgColor', 'faqBorderColor', 'faqTextColor', 'faqAnswerColor', 'faqFontFamily',
  'venueGalleryStyle', 'venueTitle', 'venueIntro', 'mapDisplayStyle',
  'socialIconStyle', 'socialDisplayStyle', 'socialIconBgColor', 'socialIconColor', 'socialIconTextColor'
];

export const pickThemeTemplateSettings = (source = {}) => (
  themeTemplateKeys.reduce((template, key) => {
    if (source[key] !== undefined) template[key] = source[key];
    return template;
  }, {})
);

export const nativeStarterTheme = PRESET_THEMES.find(theme => theme.id === 'build-a-booking-native') || PRESET_THEMES[0];
export const mobileWebEditorThemes = [
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

export const defaultFaqItems = [
  { q: 'How do I know my booking is confirmed?', a: 'You will see a confirmation on this page and receive a message when the business approves your request.' },
  { q: 'Can I join a waitlist if the day is full?', a: 'Yes. If waitlist is enabled, you can leave your details and the business can contact you when a slot opens.' }
];

export const themePaletteLabel = (paletteId) => (
  THEME_FILTER_GROUPS.find(group => group.id === 'palette')?.filters.find(filter => filter.id === paletteId)?.name || 'brand'
);

export const themeStyleLabel = (styleId) => (
  THEME_FILTER_GROUPS.find(group => group.id === 'style')?.filters.find(filter => filter.id === styleId)?.name || 'Modern'
);

export const fontStylePresets = [
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
