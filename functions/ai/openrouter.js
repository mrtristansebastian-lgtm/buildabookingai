const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

const OPENROUTER_API_KEY = defineSecret('OPENROUTER_API_KEY');
const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_BUTLER_MODEL = 'google/gemini-2.5-flash-lite';
const MAX_PROMPT_LENGTH = 4000;
const MAX_HISTORY_MESSAGES = 8;
const MAX_BUTLER_ACTIONS = 3;
const VALID_DASHBOARD_TABS = new Set(['overview', 'bookings', 'business', 'communications', 'editor', 'services', 'finance', 'clients', 'staff', 'profile']);
const VALID_EDITOR_TABS = new Set(['identity', 'themes', 'visuals', 'features']);
const VALID_EDITOR_ROOMS = new Set(['introduction', 'logo', 'banner', 'colours', 'typography', 'style', 'calendar', 'time', 'faq', 'form', 'buttons', 'venue', 'social']);
const VALID_STYLE_DIRECTIONS = new Set(['native-precision', 'editorial-luxe', 'command-flow', 'studio-glass', 'venue-story']);
const VALID_PALETTES = new Set(['neutral', 'blue', 'green', 'purple', 'pink', 'red', 'orange', 'yellow', 'earth']);
const VALID_FONT_PRESETS = new Set(['native', 'studio', 'boutique', 'impact', 'friendly', 'precision']);
const VALID_BUTLER_ACTION_TYPES = new Set([
  'navigate',
  'draft-reply',
  'detect-palette',
  'preview-style',
  'apply-style',
  'apply-colour',
  'apply-design-kit',
  'generate-faqs',
  'draft-service-pack',
  'draft-schedule-plan',
  'open-booking-page',
  'save-draft',
  'explain-platform',
  'apply-settings-patch',
  'create-service'
]);
const MUTATING_BUTLER_ACTION_TYPES = new Set(['detect-palette', 'apply-style', 'apply-colour', 'apply-design-kit', 'generate-faqs', 'save-draft', 'apply-settings-patch', 'create-service']);
const COLOR_SETTINGS_PATCH_PATHS = new Set([
  'primaryColor',
  'accentColor',
  'backgroundColor',
  'headingColor',
  'bodyColor',
  'dateActiveBgColor',
  'dateActiveTextColor',
  'slotBgColor',
  'slotTextColor',
  'slotActiveBgColor',
  'slotActiveTextColor',
  'buttonColor',
  'buttonTextColor',
  'faqBgColor',
  'faqBorderColor',
  'faqTextColor',
  'faqAnswerColor',
  'socialIconBgColor',
  'socialIconColor',
  'socialIconTextColor'
]);
const VALID_SETTINGS_PATCH_PATHS = new Set([
  'welcomeMessage',
  'tagline',
  'buttonText',
  'confirmButtonText',
  'detailsHeading',
  'detailsSubHeading',
  'successHeading',
  'dateLabel',
  'timeLabel',
  'venueTitle',
  'venueIntro',
  'features.faqEnabled',
  'features.faqs',
  ...COLOR_SETTINGS_PATCH_PATHS
]);

const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();
const increment = (value) => admin.firestore.FieldValue.increment(value);
const cleanString = (value, max = 500) => String(value || '').trim().slice(0, max);

const requireString = (value, label, max = 240) => {
  const next = cleanString(value, max);
  if (!next) throw new HttpsError('invalid-argument', `${label} is required.`);
  return next;
};

const normalizeRole = (value) => (value === 'assistant' ? 'assistant' : 'user');

const normalizeHexPatchColor = (value) => {
  const raw = String(value || '').trim();
  const match = raw.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!match) return '';
  const hex = match[1];
  if (hex.length === 3) {
    return `#${hex.split('').map((char) => char + char).join('')}`.toUpperCase();
  }
  return `#${hex}`.toUpperCase();
};

const inferButlerIntent = (prompt) => {
  const lower = String(prompt || '').toLowerCase();
  if (/(reply|client|chat|message|reschedule|late|follow)/.test(lower)) return 'client_reply';
  if (/(logo|colour|color|palette|scheme|brand)/.test(lower)) return 'brand_colour';
  if (/(design|theme|style|premium|luxury|page|booking page|look)/.test(lower)) return 'page_design';
  if (/(schedule|hours|availability|time|slot|week)/.test(lower)) return 'schedule';
  if (/(service|price|duration|menu|offer)/.test(lower)) return 'services';
  return 'general';
};

const compactContext = (context = {}) => ({
  workspaceName: cleanString(context.workspaceName, 140),
  workspaceRole: cleanString(context.workspaceRole, 80),
  activeArea: cleanString(context.activeArea, 80),
  activeAreaLabel: cleanString(context.activeAreaLabel, 100),
  editorTab: cleanString(context.editorTab, 80),
  editorRoom: cleanString(context.editorRoom, 80),
  bookingPageStyle: cleanString(context.bookingPageStyle, 120),
  colourDirection: cleanString(context.colourDirection, 120),
  businessType: cleanString(context.businessType, 120),
  bookingPageUrl: cleanString(context.bookingPageUrl, 300),
  canManageWorkspace: Boolean(context.canManageWorkspace),
  dirtyDraft: Boolean(context.dirtyDraft),
  metrics: {
    services: Number(context.metrics?.services || 0),
    bookings: Number(context.metrics?.bookings || 0),
    pendingBookings: Number(context.metrics?.pendingBookings || 0),
    clients: Number(context.metrics?.clients || 0),
    unreadThreads: Number(context.metrics?.unreadThreads || 0)
  },
  services: Array.isArray(context.services)
    ? context.services.slice(0, 8).map((service) => ({
      name: cleanString(service?.name, 120),
      price: cleanString(service?.price, 80),
      duration: cleanString(service?.duration, 80)
    })).filter((service) => service.name)
    : []
});

const compactHistory = (messages = []) => (
  Array.isArray(messages)
    ? messages
      .slice(-MAX_HISTORY_MESSAGES)
      .map((message) => ({
        role: normalizeRole(message?.role),
        content: cleanString(message?.body || message?.content, 1200)
      }))
      .filter((message) => message.content)
    : []
);

const inferStyleDirection = (prompt = '') => {
  const lower = String(prompt || '').toLowerCase();
  if (/(luxe|luxury|boutique|editorial|premium|elegant|high end|high-end)/.test(lower)) return 'editorial-luxe';
  if (/(fast|ops|operator|command|compact|dense|efficient)/.test(lower)) return 'command-flow';
  if (/(image|venue|gallery|photo|story|visual)/.test(lower)) return 'venue-story';
  if (/(soft|glass|airy|glow|luminous)/.test(lower)) return 'studio-glass';
  return 'native-precision';
};

const inferPaletteId = (prompt = '') => {
  const lower = String(prompt || '').toLowerCase();
  if (/(yellow|gold|sun)/.test(lower)) return 'yellow';
  if (/(orange|warm|mandarin)/.test(lower)) return 'orange';
  if (/(red|heat|drama)/.test(lower)) return 'red';
  if (/(purple|violet|luxe|creative)/.test(lower)) return 'purple';
  if (/(pink|rose)/.test(lower)) return 'pink';
  if (/(green|fresh|natural|organic)/.test(lower)) return 'green';
  if (/(earth|grounded)/.test(lower)) return 'earth';
  if (/(blue|trust|calm)/.test(lower)) return 'blue';
  return 'neutral';
};

const buildFallbackActions = ({ intent, prompt, context }) => {
  const styleDirection = inferStyleDirection(prompt);
  const paletteId = inferPaletteId(prompt);
  const fallbackByIntent = {
    client_reply: [
      { type: 'draft-reply', label: 'Draft reply', summary: 'Generate reply text inside Butler only. Nothing is sent to the client.' },
      { type: 'navigate', label: 'Open chats', tab: 'communications' }
    ],
    brand_colour: [
      { type: 'detect-palette', label: 'Read logo colours', summary: 'Read uploaded brand media and update the editor colour direction signal.' },
      {
        type: 'apply-design-kit',
        label: 'Apply design kit',
        designKit: { paletteId, paletteShade: 7, fontPresetId: 'precision', styleDirection: 'native-precision' },
        summary: `Apply a premium light design kit built around the ${paletteId} colour direction.`
      },
      { type: 'navigate', label: 'Open colours', tab: 'editor', editorTab: 'themes', room: 'colours' }
    ],
    page_design: [
      { type: 'preview-style', label: 'Preview style', directionId: styleDirection },
      {
        type: 'apply-design-kit',
        label: 'Apply full kit',
        designKit: {
          styleDirection,
          paletteId,
          paletteShade: styleDirection === 'editorial-luxe' ? 6 : 7,
          fontPresetId: styleDirection === 'editorial-luxe' ? 'boutique' : styleDirection === 'command-flow' ? 'precision' : 'native'
        },
        summary: `Apply a complete ${styleDirection} design kit to the booking page draft.`
      },
      { type: 'navigate', label: 'Open editor', tab: 'editor', editorTab: 'visuals', room: 'style' }
    ],
    schedule: [
      { type: 'draft-schedule-plan', label: 'Draft schedule plan' },
      { type: 'navigate', label: 'Open schedule', tab: 'business' }
    ],
    services: [
      { type: 'draft-service-pack', label: 'Draft service pack' },
      { type: 'navigate', label: 'Open services', tab: 'services' }
    ],
    general: [
      { type: 'navigate', label: context.activeArea === 'overview' ? 'Open editor' : 'Open dashboard', tab: context.activeArea === 'overview' ? 'editor' : 'overview' },
      { type: 'explain-platform', label: 'Explain this area' },
      { type: 'save-draft', label: 'Save draft', summary: 'Save the current workspace draft state.' }
    ]
  };
  return fallbackByIntent[intent] || fallbackByIntent.general;
};

const extractJsonObject = (content = '') => {
  const text = String(content || '').trim();
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] || text;
  try {
    return JSON.parse(candidate);
  } catch (_) {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch (error) {
      return null;
    }
  }
};

const sanitizeSettingsPatchValue = (path, value) => {
  if (COLOR_SETTINGS_PATCH_PATHS.has(path)) return normalizeHexPatchColor(value);
  if (path === 'features.faqEnabled') return Boolean(value);
  if (path === 'features.faqs') {
    if (!Array.isArray(value)) return [];
    return value
      .slice(0, 6)
      .map((item) => ({
        q: cleanString(item?.q || item?.question, 160),
        a: cleanString(item?.a || item?.answer, 500)
      }))
      .filter((item) => item.q && item.a);
  }
  return cleanString(value, 220);
};

const sanitizeDesignKit = (kit = {}) => {
  const source = kit && typeof kit === 'object' ? kit : {};
  const next = {};
  const styleDirection = cleanString(source.styleDirection || source.directionId || source.styleId, 60);
  if (VALID_STYLE_DIRECTIONS.has(styleDirection)) next.styleDirection = styleDirection;
  const paletteId = cleanString(source.paletteId || source.palette, 60);
  if (VALID_PALETTES.has(paletteId)) next.paletteId = paletteId;
  const paletteShade = Number(source.paletteShade || source.shade || source.depth || 0);
  if (Number.isFinite(paletteShade) && paletteShade > 0) next.paletteShade = Math.max(1, Math.min(10, Math.round(paletteShade)));
  const fontPresetId = cleanString(source.fontPresetId || source.fontPreset || source.typography, 60);
  if (VALID_FONT_PRESETS.has(fontPresetId)) next.fontPresetId = fontPresetId;

  const copy = source.copy && typeof source.copy === 'object' ? source.copy : {};
  const copyPatches = Object.entries(copy)
    .map(([path, value]) => {
      const cleanPath = cleanString(path, 80);
      if (!VALID_SETTINGS_PATCH_PATHS.has(cleanPath)) return null;
      return { path: cleanPath, value: sanitizeSettingsPatchValue(cleanPath, value) };
    });
  const explicitPatches = Array.isArray(source.patches) ? source.patches.map((patch) => {
    const path = cleanString(patch?.path, 80);
    if (!VALID_SETTINGS_PATCH_PATHS.has(path)) return null;
    return { path, value: sanitizeSettingsPatchValue(path, patch?.value) };
  }) : [];
  const patches = [...copyPatches, ...explicitPatches]
    .filter((patch) => patch && patch.value !== '' && !(Array.isArray(patch.value) && patch.value.length === 0))
    .slice(0, 10);
  if (patches.length) next.patches = patches;

  const faqs = sanitizeSettingsPatchValue('features.faqs', source.faqs || source.faqItems);
  if (faqs.length) {
    next.faqs = faqs;
    next.patches = [
      ...(next.patches || []),
      { path: 'features.faqEnabled', value: true },
      { path: 'features.faqs', value: faqs }
    ].slice(0, 10);
  }

  return Object.keys(next).length ? next : null;
};

const designKitSummaryItems = (kit = {}) => {
  const items = [];
  if (kit.styleDirection) items.push(`Apply ${kit.styleDirection} booking page structure`);
  if (kit.paletteId) items.push(`Apply ${kit.paletteId} colour direction${kit.paletteShade ? ` at shade ${kit.paletteShade}` : ''}`);
  if (kit.fontPresetId) items.push(`Apply ${kit.fontPresetId} typography preset`);
  if (Array.isArray(kit.patches) && kit.patches.length) items.push(`Update ${kit.patches.length} copy, FAQ, or colour fields`);
  items.push('Keep the booking journey order unchanged');
  return items.slice(0, 6);
};

const sanitizeButlerAction = (action = {}, fallbackIntent = 'general') => {
  const type = cleanString(action.type, 60);
  if (!VALID_BUTLER_ACTION_TYPES.has(type)) return null;
  const label = cleanString(action.label, 80) || 'Open';
  const next = {
    type,
    label,
    requiresConfirmation: Boolean(action.requiresConfirmation) || MUTATING_BUTLER_ACTION_TYPES.has(type),
    summary: cleanString(action.summary || action.confirmationSummary || action.description, 420),
    summaryItems: Array.isArray(action.summaryItems)
      ? action.summaryItems.map((item) => cleanString(item, 180)).filter(Boolean).slice(0, 6)
      : []
  };

  if (type === 'navigate') {
    const tab = cleanString(action.tab, 40);
    next.tab = VALID_DASHBOARD_TABS.has(tab) ? tab : (
      fallbackIntent === 'client_reply' ? 'communications' :
        fallbackIntent === 'schedule' ? 'business' :
          fallbackIntent === 'services' ? 'services' :
            fallbackIntent === 'page_design' || fallbackIntent === 'brand_colour' ? 'editor' : 'overview'
    );
    const editorTab = cleanString(action.editorTab, 40);
    if (VALID_EDITOR_TABS.has(editorTab)) next.editorTab = editorTab;
    const room = cleanString(action.room, 40);
    if (VALID_EDITOR_ROOMS.has(room)) next.room = room;
  }

  if (['preview-style', 'apply-style'].includes(type)) {
    const directionId = cleanString(action.directionId, 60);
    next.directionId = VALID_STYLE_DIRECTIONS.has(directionId) ? directionId : 'native-precision';
    next.requiresConfirmation = type === 'apply-style' ? true : next.requiresConfirmation;
  }

  if (type === 'apply-colour') {
    const paletteId = cleanString(action.paletteId, 60);
    next.paletteId = VALID_PALETTES.has(paletteId) ? paletteId : 'neutral';
    next.requiresConfirmation = true;
  }

  if (type === 'apply-design-kit') {
    next.designKit = sanitizeDesignKit(action.designKit || action.kit || action);
    if (!next.designKit) return null;
    next.requiresConfirmation = true;
    if (!next.summary) next.summary = 'Apply this complete booking page design kit to the current workspace draft.';
    if (!next.summaryItems.length) next.summaryItems = designKitSummaryItems(next.designKit);
  }

  if (type === 'apply-settings-patch') {
    const patches = Array.isArray(action.patches) ? action.patches : [];
    next.patches = patches
      .slice(0, 8)
      .map((patch) => {
        const path = cleanString(patch?.path, 80);
        if (!VALID_SETTINGS_PATCH_PATHS.has(path)) return null;
        return { path, value: sanitizeSettingsPatchValue(path, patch?.value) };
      })
      .filter((patch) => patch && patch.value !== '' && !(Array.isArray(patch.value) && patch.value.length === 0));
    if (!next.patches.length) return null;
    next.requiresConfirmation = true;
  }

  if (type === 'create-service') {
    const service = action.service || {};
    next.service = {
      name: cleanString(service.name, 120),
      description: cleanString(service.description, 500),
      duration: cleanString(service.duration, 60),
      price: cleanString(service.price, 60),
      category: cleanString(service.category, 80)
    };
    if (!next.service.name) return null;
    next.requiresConfirmation = true;
  }

  if (MUTATING_BUTLER_ACTION_TYPES.has(type) && !next.summary) {
    next.summary = 'Apply this change to the current workspace draft. Nothing is published until the user saves or publishes.';
  }

  return next;
};

const sanitizeButlerActions = ({ actions = [], intent, prompt, context }) => {
  const source = Array.isArray(actions) && actions.length
    ? actions
    : buildFallbackActions({ intent, prompt, context });
  const seen = new Set();
  return source
    .map((action) => sanitizeButlerAction(action, intent))
    .filter((action) => {
      if (!action) return false;
      const key = JSON.stringify({ type: action.type, tab: action.tab || '', room: action.room || '', directionId: action.directionId || '', paletteId: action.paletteId || '' });
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_BUTLER_ACTIONS);
};

const assertWorkspaceStaff = async ({ appId, ownerId, auth }) => {
  if (!auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in to use the Butler.');
  }
  if (auth.uid === ownerId) return;

  const email = cleanString(auth.token?.email, 220).toLowerCase();
  if (!email) {
    throw new HttpsError('permission-denied', 'This account does not have workspace access.');
  }

  const staffSnap = await admin.firestore()
    .collection('artifacts').doc(appId)
    .collection('staffAccess').doc(email)
    .collection('workspaces').doc(ownerId)
    .get();
  const staff = staffSnap.data() || {};
  if (!staffSnap.exists || staff.status !== 'active') {
    throw new HttpsError('permission-denied', 'This account does not have workspace access.');
  }
};

const createUsageTracker = async ({ appId, ownerId, uid, model, intent, promptLength }) => {
  const db = admin.firestore();
  const monthId = new Date().toISOString().slice(0, 7);
  const usageRef = db
    .collection('artifacts').doc(appId)
    .collection('users').doc(ownerId)
    .collection('ai_usage').doc(monthId);
  const eventRef = usageRef.collection('events').doc();

  await Promise.all([
    usageRef.set({
      ownerId,
      monthId,
      requestCount: increment(1),
      inFlightCount: increment(1),
      updatedAt: serverTimestamp(),
      lastRequestAt: serverTimestamp()
    }, { merge: true }),
    eventRef.set({
      ownerId,
      uid,
      model,
      intent,
      promptLength,
      status: 'started',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
  ]);

  return {
    async succeed({ usage = {}, replyLength = 0 }) {
      const inputTokens = Number(usage.prompt_tokens || usage.input_tokens || 0);
      const outputTokens = Number(usage.completion_tokens || usage.output_tokens || 0);
      const totalTokens = Number(usage.total_tokens || inputTokens + outputTokens || 0);
      await Promise.all([
        usageRef.set({
          inFlightCount: increment(-1),
          successCount: increment(1),
          inputTokens: increment(Number.isFinite(inputTokens) ? inputTokens : 0),
          outputTokens: increment(Number.isFinite(outputTokens) ? outputTokens : 0),
          totalTokens: increment(Number.isFinite(totalTokens) ? totalTokens : 0),
          updatedAt: serverTimestamp(),
          lastSuccessAt: serverTimestamp()
        }, { merge: true }),
        eventRef.set({
          status: 'succeeded',
          replyLength,
          usage: {
            inputTokens: Number.isFinite(inputTokens) ? inputTokens : 0,
            outputTokens: Number.isFinite(outputTokens) ? outputTokens : 0,
            totalTokens: Number.isFinite(totalTokens) ? totalTokens : 0
          },
          updatedAt: serverTimestamp()
        }, { merge: true })
      ]);
    },
    async fail(error) {
      await Promise.all([
        usageRef.set({
          inFlightCount: increment(-1),
          failureCount: increment(1),
          updatedAt: serverTimestamp(),
          lastFailureAt: serverTimestamp()
        }, { merge: true }),
        eventRef.set({
          status: 'failed',
          errorCode: cleanString(error?.code || 'internal', 80),
          errorMessage: cleanString(error?.message || 'Butler request failed.', 300),
          updatedAt: serverTimestamp()
        }, { merge: true })
      ]).catch((trackingError) => {
        console.error('Butler usage failure tracking failed', trackingError);
      });
    }
  };
};

const buildSystemPrompt = (context) => (
  [
    'You are Build A Booking Butler, a premium product operator, booking strategist, and design director embedded inside the app.',
    'You are not a generic chatbot and you are not a help-centre article. You are the control layer for the platform: diagnose the workspace, form a clear point of view, guide the user, and prepare authorized edits.',
    'Personality: crisp, tasteful, quietly confident, direct, human. Sound like a world-class operator sitting beside the user. No corporate filler, no bland "happy to help", no fake hype.',
    'Help business owners and staff with client replies, booking page design, colour systems, typography, FAQ/copy, schedule setup, services, workspace decisions, and app guidance.',
    'Design taste: seamless light UI only. Blend Apple iOS fluidity, Google clarity, Vercel precision, and Porsche industrial restraint. Never propose dark mode unless the user explicitly asks.',
    'When asked for design or colour, do not answer with vague advice. Pick one strong direction, explain the reasoning in 2-4 compact sentences, then offer a concrete action.',
    'When asked to edit the booking page, prefer a complete design kit when useful: styleDirection + paletteId + paletteShade + fontPresetId + copy/FAQ patches. Keep the locked journey order unchanged.',
    'For client replies, draft usable text with the right tone. For operations, give the next best control and an action to open it.',
    'You may propose executable app actions. The React app will show an authorization summary before applying any workspace change.',
    'Do not claim a change has already happened until the app action is confirmed. Never send client messages, charge payments, delete records, or publish without a dedicated confirmation flow.',
    'When useful, reference the app areas by name: Editor, Business, Bookings, Clients, Communications, Services, Profile.',
    'Return JSON only with this shape: {"reply":"short answer","actions":[{"type":"navigate","label":"Open editor","tab":"editor","editorTab":"visuals","room":"style"}]}.',
    'For mutating actions include a "summary" field that describes exactly what the user is authorizing.',
    'Valid action types: navigate, draft-reply, detect-palette, preview-style, apply-style, apply-colour, apply-design-kit, generate-faqs, draft-service-pack, draft-schedule-plan, open-booking-page, save-draft, explain-platform, apply-settings-patch, create-service.',
    'Use max three actions. For meaningful page edits prefer preview-style plus apply-design-kit. apply-design-kit, apply-style, apply-colour, generate-faqs, save-draft, apply-settings-patch, create-service, and detect-palette require authorization by the app.',
    'apply-design-kit supports designKit: {styleDirection, paletteId, paletteShade 1-10, fontPresetId, copy, faqs}. Valid fontPresetId: native, studio, boutique, impact, friendly, precision.',
    'apply-settings-patch supports paths: welcomeMessage, tagline, buttonText, confirmButtonText, detailsHeading, detailsSubHeading, successHeading, dateLabel, timeLabel, venueTitle, venueIntro, features.faqEnabled, features.faqs.',
    'Safe colour patch paths also exist for advanced design edits: primaryColor, accentColor, backgroundColor, headingColor, bodyColor, dateActiveBgColor, dateActiveTextColor, slotBgColor, slotTextColor, slotActiveBgColor, slotActiveTextColor, buttonColor, buttonTextColor, faqBgColor, faqBorderColor, faqTextColor, faqAnswerColor, socialIconBgColor, socialIconColor, socialIconTextColor. Use readable contrast.',
    'create-service supports service fields: name, description, duration, price, category.',
    'Valid dashboard tabs: overview, bookings, business, communications, editor, services, finance, clients, staff, profile.',
    'Valid editor rooms: introduction, logo, banner, colours, typography, style, calendar, time, faq, form, buttons, venue, social.',
    'Valid style ids: native-precision, editorial-luxe, command-flow, studio-glass, venue-story. Valid palette ids: neutral, blue, green, purple, pink, red, orange, yellow, earth.',
    `Workspace context: ${JSON.stringify(context)}`
  ].join('\n')
);

const callOpenRouter = async ({ apiKey, model, messages, uid, intent, prompt, context }) => {
  const response = await fetch(OPENROUTER_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://build-a-booking.web.app',
      'X-OpenRouter-Title': 'Build A Booking'
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.62,
      max_tokens: 1300,
      user: uid
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerMessage = cleanString(payload?.error?.message || payload?.message, 300);
    if ([401, 403].includes(response.status)) {
      throw new HttpsError('failed-precondition', 'AI is not configured yet. Check the OpenRouter API key in Firebase secrets.');
    }
    if ([402, 429].includes(response.status)) {
      throw new HttpsError('resource-exhausted', providerMessage || 'OpenRouter usage is temporarily limited.');
    }
    throw new HttpsError('unavailable', providerMessage || 'OpenRouter could not complete this Butler request.');
  }

  const content = cleanString(payload?.choices?.[0]?.message?.content, 6000);
  if (!content) {
    throw new HttpsError('unavailable', 'OpenRouter returned an empty Butler response.');
  }
  const parsed = extractJsonObject(content);
  const reply = cleanString(parsed?.reply || parsed?.message || content, 4000);
  if (!reply) {
    throw new HttpsError('unavailable', 'OpenRouter returned an empty Butler response.');
  }
  const actions = sanitizeButlerActions({
    actions: parsed?.actions,
    intent,
    prompt,
    context
  });
  return {
    reply,
    actions,
    usage: payload.usage || {},
    model: payload.model || model
  };
};

const runButlerPrompt = onCall({
  region: 'us-central1',
  secrets: [OPENROUTER_API_KEY]
}, async (request) => {
  const apiKey = OPENROUTER_API_KEY.value() || process.env.OPENROUTER_API_KEY || '';
  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'AI is not configured yet. Add OPENROUTER_API_KEY in Firebase Functions secrets.');
  }

  const appId = requireString(request.data?.appId || 'build-a-booking-v2', 'App ID', 160);
  const ownerId = requireString(request.data?.ownerId, 'Workspace owner', 160);
  const prompt = requireString(request.data?.prompt, 'Prompt', MAX_PROMPT_LENGTH);
  const model = cleanString(request.data?.model, 140) || DEFAULT_BUTLER_MODEL;
  const intent = inferButlerIntent(prompt);
  const context = compactContext(request.data?.context || {});
  const history = compactHistory(request.data?.messages || []);

  await assertWorkspaceStaff({ appId, ownerId, auth: request.auth });
  const tracker = await createUsageTracker({
    appId,
    ownerId,
    uid: request.auth.uid,
    model,
    intent,
    promptLength: prompt.length
  });

  try {
    const messages = [
      { role: 'system', content: buildSystemPrompt(context) },
      ...history,
      { role: 'user', content: prompt }
    ];
    const result = await callOpenRouter({
      apiKey,
      model,
      messages,
      uid: request.auth.uid,
      intent,
      prompt,
      context
    });
    await tracker.succeed({ usage: result.usage, replyLength: result.reply.length });
    return {
      ok: true,
      reply: result.reply,
      actions: result.actions,
      model: result.model,
      usage: result.usage,
      intent
    };
  } catch (error) {
    await tracker.fail(error);
    if (error instanceof HttpsError) throw error;
    console.error('runButlerPrompt failed', error);
    throw new HttpsError('internal', error?.message || 'Butler could not complete this request.');
  }
});

module.exports = {
  runButlerPrompt
};
