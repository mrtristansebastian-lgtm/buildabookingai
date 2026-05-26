export const getPublicBookingSlug = () => {
  const url = new URL(window.location.href);
  const querySlug = url.searchParams.get('book') || url.searchParams.get('workspace');
  if (querySlug) return querySlug.trim().toLowerCase();
  const [, section, slug] = url.pathname.split('/');
  if (section === 'book' && slug) return slug.trim().toLowerCase();
  return '';
};

export const normalizeEmail = (email = '') => email.trim().toLowerCase();
export const cleanFirestoreIdPart = (value = '') => (
    String(value || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80) || 'item'
);
export const buildSupportThreadId = (ownerId = '', bookingId = '') => (
    `${cleanFirestoreIdPart(ownerId)}_${cleanFirestoreIdPart(bookingId)}`
);

export const safeStorageGet = (storage, key) => {
  try {
    return storage?.getItem(key) || null;
  } catch {
    return null;
  }
};

export const safeStorageSet = (storage, key, value) => {
  try {
    storage?.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

export const safeStorageRemove = (storage, key) => {
  try {
    storage?.removeItem(key);
  } catch {
    // Storage can be unavailable in private, embedded, or homescreen contexts.
  }
};

export const safeLocalGet = (key) => safeStorageGet(typeof window !== 'undefined' ? window.localStorage : null, key);
export const safeLocalSet = (key, value) => safeStorageSet(typeof window !== 'undefined' ? window.localStorage : null, key, value);
export const safeLocalRemove = (key) => safeStorageRemove(typeof window !== 'undefined' ? window.localStorage : null, key);
export const safeSessionGet = (key) => safeStorageGet(typeof window !== 'undefined' ? window.sessionStorage : null, key);
export const safeSessionSet = (key, value) => safeStorageSet(typeof window !== 'undefined' ? window.sessionStorage : null, key, value);
export const safeSessionRemove = (key) => safeStorageRemove(typeof window !== 'undefined' ? window.sessionStorage : null, key);

export const getTimestampValue = (value) => {
  if (typeof value === 'number') return value;
  if (value?.toMillis) return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

export const buildStaffId = (email = '') => {
  const emailKey = normalizeEmail(email);
  return `staff-${emailKey.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || Date.now()}`;
};

export const createOwnerStaffProfile = (signedInUser, color = '#39FF14') => ({
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

export const guestModeStorageKey = 'build-a-booking-guest-mode';
export const rememberLoginStorageKey = 'build-a-booking-remember-login';
export const workspaceRouteStorageKey = 'build-a-booking-workspace-route';
export const authRedirectStorageKey = 'build-a-booking-auth-return';
export const authRedirectStateStorageKey = 'build-a-booking-auth-return-state';
export const authRedirectStartedStorageKey = 'build-a-booking-auth-started';
export const googleCalendarRedirectStorageKey = 'build-a-booking-google-calendar-auth';
export const editorDraftStoragePrefix = 'build-a-booking-editor-draft-v2';
export const bookingsCacheStoragePrefix = 'build-a-booking-bookings-cache-v1';
export const workspaceTabIds = ['overview', 'bookings', 'business', 'communications', 'editor', 'services', 'finance', 'clients', 'staff', 'profile'];
export const workspaceTabAliases = {
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
export const editorTabIds = ['identity', 'themes', 'visuals', 'features', 'copy'];

export const safeJsonParse = (value, fallback = null) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export const areJsonEqual = (left, right) => {
  if (left === right) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
};

export const mergeStateIfChanged = (current, incoming) => {
  const next = { ...current, ...incoming };
  return areJsonEqual(current, next) ? current : next;
};

export const getEditorDraftKey = (ownerId = 'guest') => (
  `${editorDraftStoragePrefix}-${String(ownerId || 'guest').replace(/[^a-zA-Z0-9_-]/g, '-')}`
);

export const readEditorDraft = (ownerId) => {
  const draft = safeJsonParse(safeLocalGet(getEditorDraftKey(ownerId)));
  if (!draft || typeof draft !== 'object' || !draft.settings) return null;
  return draft;
};

export const writeEditorDraft = (ownerId, payload = {}) => {
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

export const clearEditorDraft = (ownerId) => {
  safeLocalRemove(getEditorDraftKey(ownerId));
};

export const getBookingsCacheKey = (ownerId = 'guest') => (
  `${bookingsCacheStoragePrefix}-${String(ownerId || 'guest').replace(/[^a-zA-Z0-9_-]/g, '-')}`
);

export const readBookingsCache = (ownerId) => {
  const cached = safeJsonParse(safeLocalGet(getBookingsCacheKey(ownerId)));
  if (!cached || typeof cached !== 'object' || !Array.isArray(cached.bookings)) return null;
  return cached;
};

export const writeBookingsCache = (ownerId, bookings = []) => {
  if (!ownerId || !Array.isArray(bookings)) return false;
  const cached = {
    version: 1,
    savedAt: Date.now(),
    bookings: bookings.slice(0, 250)
  };
  return safeLocalSet(getBookingsCacheKey(ownerId), JSON.stringify(cached));
};

export const stableSettingsFingerprint = (settings = {}) => {
  const { updatedAt, draftAutosavedAt, draftSavedAt, draftStatus, draftName, publishedAt, ...stable } = settings || {};
  try {
    return JSON.stringify(stable);
  } catch {
    return '';
  }
};

export const stripEditorDraftFields = (settings = {}) => {
  const {
    draftAutosavedAt,
    draftSavedAt,
    draftStatus,
    draftName,
    ...publishableSettings
  } = settings || {};
  return publishableSettings;
};

export const buildEditorDraftPayload = (settings = {}, payload = {}) => {
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

export const buildPublicBookingIdempotencyKey = ({ workspaceSlug, formData = {}, dateKey, date, time, serviceId }) => {
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

export const normalizeWorkspaceRoute = (route = {}, fallback = {}) => {
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

export const getWorkspaceRouteFromUrl = () => {
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

export const getSavedWorkspaceRoute = () => (
  normalizeWorkspaceRoute(safeJsonParse(safeLocalGet(workspaceRouteStorageKey)), { view: 'landing', activeTab: 'overview', editorTab: 'themes' })
);

export const getInitialWorkspaceRoute = () => {
  if (typeof window === 'undefined' || getPublicBookingSlug()) {
    return { view: 'landing', activeTab: 'overview', editorTab: 'themes', timestamp: Date.now() };
  }
  return getWorkspaceRouteFromUrl() || getSavedWorkspaceRoute();
};

export const saveWorkspaceRoute = (route) => {
  const normalized = normalizeWorkspaceRoute(route);
  safeLocalSet(workspaceRouteStorageKey, JSON.stringify(normalized));
  return normalized;
};

export const saveAuthReturnState = (route) => {
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

export const getAuthReturnState = () => {
  const stored = safeJsonParse(safeSessionGet(authRedirectStateStorageKey)) || safeJsonParse(safeLocalGet(authRedirectStateStorageKey));
  if (stored) return normalizeWorkspaceRoute(stored, { view: 'dashboard', activeTab: 'overview', editorTab: 'themes' });
  const legacyTarget = safeSessionGet(authRedirectStorageKey);
  if (legacyTarget) return normalizeWorkspaceRoute({ view: legacyTarget }, { view: 'dashboard', activeTab: 'overview', editorTab: 'themes' });
  return getGoogleAuthIntent();
};

export const clearAuthReturnState = () => {
  safeSessionRemove(authRedirectStorageKey);
  safeSessionRemove(authRedirectStateStorageKey);
  safeLocalRemove(authRedirectStateStorageKey);
  safeSessionRemove(authRedirectStartedStorageKey);
  safeLocalRemove(authRedirectStartedStorageKey);
};

export const getGoogleAuthIntent = () => {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  if (url.searchParams.get('auth') !== 'google') return null;
  return normalizeWorkspaceRoute({
    view: ['dashboard', 'client'].includes(url.searchParams.get('return')) ? url.searchParams.get('return') : 'landing',
    activeTab: url.searchParams.get('tab'),
    editorTab: url.searchParams.get('editorTab')
  }, { view: 'dashboard', activeTab: 'overview', editorTab: 'themes' });
};

export const clearGoogleAuthIntentUrl = () => {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has('auth')) return;
  url.searchParams.delete('auth');
  url.searchParams.delete('return');
  url.searchParams.delete('tab');
  url.searchParams.delete('editorTab');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
};

export const writeGoogleAuthIntentUrl = (route = {}) => {
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
