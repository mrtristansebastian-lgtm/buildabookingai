import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight, Battery, Bell, Briefcase, Calendar, CalendarCheck, Camera, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, Flame, Globe, Heart, History, Instagram, Layers, Layout, Mail, MessageSquare, Monitor, MousePointerClick, Palette, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Phone, Pipette, Plus, RefreshCw, Search, Share2, ShieldCheck, Signal, Sparkles, Star, Tag, Trash2, User, UserPlus, Users, Wifi, X, Zap
} from 'lucide-react';
import { BusinessCalendar } from './components/BusinessCalendar';
import { BookingFlow } from './components/BookingFlow';
import { ProButton } from './components/ProButton';
import { FONT_OPTIONS, getFontFamily } from './data/fonts';
import { PRESET_THEMES } from './data/themes';
import * as FirebaseSDK from './services/firebase';
import { appId, auth, db, initialAuthToken, isFirebaseConfigured, storage } from './services/firebase';
import { createDefaultEmailConfig, getEmailConfig, isEmailConfigured, sendClientEmail } from './services/email';
import { getLocalDateStr } from './utils/dates';
import { rgbaFromHex, readableTextFor, normalizeHexColor, mixHexColors, themeBackground, THEME_PALETTE_FILTERS } from './utils/theme';

const getPublicBookingSlug = () => {
  const url = new URL(window.location.href);
  const querySlug = url.searchParams.get('book') || url.searchParams.get('workspace');
  if (querySlug) return querySlug.trim().toLowerCase();
  const [, section, slug] = url.pathname.split('/');
  if (section === 'book' && slug) return slug.trim().toLowerCase();
  return '';
};

// --- Main App Component ---
        export default function App() {
            const [user, setUser] = useState(null);
            const [view, setView] = useState('landing');
            const [loading, setLoading] = useState(true);
            const [authMode, setAuthMode] = useState('signin');
            const [authForm, setAuthForm] = useState({ email: '', password: '' });
            const [authError, setAuthError] = useState('');
            const [authPanelOpen, setAuthPanelOpen] = useState(false);
            const [publicSlug] = useState(getPublicBookingSlug);
            const [publicWorkspace, setPublicWorkspace] = useState(null);
            const [publicLoading, setPublicLoading] = useState(false);
            const [publicError, setPublicError] = useState('');
            const [activeTab, setActiveTab] = useState('overview'); 
            const [editorTab, setEditorTab] = useState('themes'); 
            const [themePalette, setThemePalette] = useState('all');
            const [device, setDevice] = useState('desktop'); 
            const [previewKey, setPreviewKey] = useState(0); 
            const [scale, setScale] = useState(1);
            const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
            const [editorCollapsed, setEditorCollapsed] = useState(false);
            const [bookingFilter, setBookingFilter] = useState('all');
            const [clientRecords, setClientRecords] = useState([]);
            const [clientSearch, setClientSearch] = useState('');
            const [selectedClientId, setSelectedClientId] = useState(null);
            const [clientNoteDraft, setClientNoteDraft] = useState('');
            const containerRef = useRef(null);
            const themePaletteRailRef = useRef(null);
            const [toast, setToast] = useState(null);
            
            const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 4000); };

            const [settings, setSettings] = useState({
                slug: 'studio-noir', brandName: 'Studio Noir',
                welcomeMessage: 'Reserve your private session.', tagline: 'Atelier 7B / Private',
                primaryColor: '#39FF14', headingColor: '#000000', bodyColor: '#666666', backgroundColor: '#ffffff',
                slotBgColor: '#f5f5f5', slotTextColor: '#000000',
                dateBgColor: 'transparent', dateTextColor: '#666666', dateActiveBgColor: 'transparent', dateActiveTextColor: '#000000',
                buttonTextColor: '#000000', 
                fontFamily: 'inter', 
                headingFontFamily: '', bodyFontFamily: '', buttonFontFamily: '', slotFontFamily: '', dateFontFamily: '',
                buttonStyle: 'pill', availabilityStyle: 'minimal',
                dateLabel: 'Which day are you looking to book ?', timeLabel: 'Lets see what time works', buttonText: 'Book Now', confirmButtonText: 'Confirm Booking', 
                detailsHeading: 'Your Details', detailsSubHeading: 'Secure Your Slot', successHeading: 'Booking Confirmed!', 
                availableTimes: ['09:00', '10:30', '12:00', '14:30', '16:00', '17:30'],
                schedule: {},
                features: { birthday: true, waitlist: true, socialProof: true, loadingScreen: true, firstAvailable: true, favicon: '', location: '', faqs: [] },
                backendSkin: { enabled: false, mode: 'immersive', showBranding: true },
                logo: '', bannerImage: '', address: '', socials: { instagram: '', website: '' }
            });

            const [bookings, setBookings] = useState([]);
            const [staffList, setStaffList] = useState([{id: 'owner', name: 'Admin', color: '#39FF14'}]);
            const [communications, setCommunications] = useState({
                confirmed: { active: true, text: "Your booking request is confirmed! We look forward to seeing you." },
                review: { active: true, text: "Hey! Thanks for coming in today. We'd love it if you could leave a quick review." },
                waitlist: { active: true, text: "A spot just opened up for you! Tap here to claim it." },
                runningLate: { active: true, text: "Running 10-15 mins behind. See you soon!" },
                emailProvider: createDefaultEmailConfig()
            });
            const emailConfig = useMemo(() => getEmailConfig(communications), [communications]);
            const bookingPageUrl = useMemo(() => `${window.location.origin}/book/${settings.slug || 'studio'}`, [settings.slug]);
            const referralUrl = useMemo(() => `${window.location.origin}/ref/${user?.uid?.substring(0,6) || '10X'}`, [user?.uid]);

            const demoBookings = useMemo(() => ([
                { id: 'demo-1', clientName: 'Ari Carter', clientPhone: '+27 82 555 0184', clientBirthday: '08/14', date: 'Today', time: '10:30', status: 'pending', timestamp: Date.now() - 120000, noShowHistory: false },
                { id: 'demo-2', clientName: 'Mika Stone', clientPhone: '+27 72 555 0931', clientBirthday: '', date: 'Today', time: '14:30', status: 'confirmed', timestamp: Date.now() - 3600000, noShowHistory: false, staffId: 'owner' },
                { id: 'demo-3', clientName: 'Noah Wilde', clientPhone: '+27 79 555 4410', clientBirthday: '11/03', date: 'Tomorrow', time: 'Waitlist', status: 'waitlist', timestamp: Date.now() - 7200000, noShowHistory: true },
                { id: 'demo-4', clientName: 'Lena Vale', clientPhone: '+27 83 555 7702', clientBirthday: '', date: 'Fri, 22 May', time: '16:00', status: 'confirmed', timestamp: Date.now() - 10800000, noShowHistory: false, staffId: 'owner' }
            ]), []);

            const visibleBookings = bookings.length ? bookings : demoBookings;
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

            const bookingStats = useMemo(() => {
                const pending = visibleBookings.filter(b => b.status === 'pending').length;
                const waitlist = visibleBookings.filter(b => b.status === 'waitlist').length;
                const confirmed = visibleBookings.filter(b => b.status === 'confirmed').length;
                const declined = visibleBookings.filter(b => b.status === 'declined').length;
                return {
                    all: visibleBookings.length,
                    pending,
                    confirmed,
                    waitlist,
                    declined,
                    attention: pending + waitlist
                };
            }, [visibleBookings]);

            const filteredBookings = useMemo(() => (
                bookingFilter === 'all'
                    ? visibleBookings
                    : visibleBookings.filter(b => b.status === bookingFilter)
            ), [bookingFilter, visibleBookings]);

            const clientLabelOptions = ['VIP', 'Needs Follow-up', 'Prefers WhatsApp', 'High Value', 'No-show Risk'];
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
                        birthday: booking.clientBirthday || '',
                        source: 'booking',
                        bookings: []
                    };
                    existing.name = existing.name || booking.clientName || 'Unnamed Client';
                    existing.phone = existing.phone || booking.clientPhone || '';
                    existing.birthday = existing.birthday || booking.clientBirthday || '';
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
                        email: record.email || '',
                        birthday: record.birthday || bookingProfile?.birthday || '',
                        notes: record.notes || '',
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

            const dashboardPortfolio = useMemo(() => {
                const today = new Date();
                const todayKey = getLocalDateStr(today);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const tomorrowKey = getLocalDateStr(tomorrow);
                const weekEnd = new Date(today);
                weekEnd.setDate(weekEnd.getDate() + 6);
                const weekEndKey = getLocalDateStr(weekEnd);
                const monthLookup = {
                    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
                    may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
                    sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
                };
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

                const activeBookings = visibleBookings.filter(booking => booking.status !== 'declined');
                const bookingsWithDates = activeBookings.map(booking => ({ ...booking, dateKeyResolved: parseBookingDate(booking) }));
                const todayBookings = bookingsWithDates.filter(booking => booking.dateKeyResolved === todayKey);
                const tomorrowBookings = bookingsWithDates.filter(booking => booking.dateKeyResolved === tomorrowKey);
                const weekBookings = bookingsWithDates.filter(booking => booking.dateKeyResolved && booking.dateKeyResolved >= todayKey && booking.dateKeyResolved <= weekEndKey);
                const upcomingBookings = bookingsWithDates.filter(booking => !booking.dateKeyResolved || booking.dateKeyResolved >= todayKey);
                const todaySchedule = settings.schedule?.[todayKey] || {};
                const todayTimes = Array.isArray(todaySchedule.times) ? todaySchedule.times : [...(settings.availableTimes || [])];
                const todayAvailable = todaySchedule.available ?? true;
                const todayReserved = todayBookings.filter(booking => booking.status !== 'waitlist' && booking.time !== 'Waitlist').length;
                const todayOpenSlots = todayAvailable ? Math.max(0, todayTimes.length - todayReserved) : 0;
                const confirmedActive = activeBookings.filter(booking => booking.status === 'confirmed').length;
                const bookingRate = activeBookings.length ? Math.round((confirmedActive / activeBookings.length) * 100) : 0;
                const emailAutomations = Object.values(communications).filter(item => item?.active).length;
                const emailAutomationTotal = Object.keys(communications).length || 1;
                const pageReadinessItems = [
                    Boolean(settings.brandName),
                    Boolean(settings.slug),
                    (settings.availableTimes || []).length > 0,
                    Boolean(settings.welcomeMessage),
                    communications.confirmed?.active
                ];
                const pageReadiness = Math.round((pageReadinessItems.filter(Boolean).length / pageReadinessItems.length) * 100);
                const clientEnrichmentRate = clientMetrics.total ? Math.round((clientMetrics.enriched / clientMetrics.total) * 100) : 0;
                const hour = today.getHours();
                const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

                return {
                    greeting,
                    todayKey,
                    todayBookings,
                    tomorrowBookings,
                    weekBookings,
                    upcomingBookings,
                    todayOpenSlots,
                    todayCapacity: todayAvailable ? todayTimes.length : 0,
                    todayAvailable,
                    bookingRate,
                    emailAutomations,
                    emailAutomationTotal,
                    pageReadiness,
                    clientEnrichmentRate,
                    noShowRisk: activeBookings.filter(booking => booking.noShowHistory).length,
                    needsAttention: bookingStats.attention,
                    confirmedActive,
                    activeBookings: activeBookings.length
                };
            }, [visibleBookings, settings.schedule, settings.availableTimes, settings.brandName, settings.slug, settings.welcomeMessage, communications, clientMetrics, bookingStats.attention]);

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

            const selectedClient = useMemo(() => (
                clientDirectory.find(client => client.id === selectedClientId) || clientDirectory[0] || null
            ), [clientDirectory, selectedClientId]);

            useEffect(() => {
                if (!clientDirectory.length) {
                    setSelectedClientId(null);
                    return;
                }
                if (!selectedClientId || !clientDirectory.some(client => client.id === selectedClientId)) {
                    setSelectedClientId(clientDirectory[0].id);
                }
            }, [clientDirectory, selectedClientId]);

            useEffect(() => {
                setClientNoteDraft(selectedClient?.notes || '');
            }, [selectedClient?.id]);

            const navItems = [
                { id: 'overview', icon: Layout, label: 'Dashboard' },
                { id: 'bookings', icon: Layers, label: 'My Bookings', badge: visibleBookings.some(b => b.status === 'pending' || b.status === 'waitlist') },
                { id: 'business', icon: Calendar, label: 'Schedule' },
                { id: 'communications', icon: MessageSquare, label: 'Email Studio' },
                { id: 'editor', icon: Zap, label: 'Editor' },
                { id: 'clients', icon: Star, label: 'My Clients', mobileLabel: 'Clients', badge: clientMetrics.firstTimers > 0 },
                { id: 'staff', icon: Users, label: 'Team' },
                { id: 'profile', icon: User, label: 'Profile' }
            ];

            const themePaletteOptions = useMemo(() => (
                THEME_PALETTE_FILTERS
                    .map(filter => ({ ...filter, count: PRESET_THEMES.filter(theme => filter.match(theme)).length }))
                    .filter(filter => filter.id === 'all' || filter.count > 0)
            ), []);

            const visibleThemes = useMemo(() => {
                const activeFilter = THEME_PALETTE_FILTERS.find(filter => filter.id === themePalette) || THEME_PALETTE_FILTERS[0];
                return PRESET_THEMES.filter(theme => activeFilter.match(theme));
            }, [themePalette]);

            const backendSkin = settings.backendSkin || {};
            const backendSkinEnabled = Boolean(backendSkin.enabled);
            const backendSkinMode = backendSkin.mode || 'immersive';
            const backendSkinShowBranding = backendSkin.showBranding !== false;
            const backendSkinVars = useMemo(() => {
                const background = normalizeHexColor(settings.backgroundColor, '#FBFBFB');
                const heading = normalizeHexColor(settings.headingColor, '#000000');
                const body = normalizeHexColor(settings.bodyColor, '#666666');
                const primary = normalizeHexColor(settings.primaryColor, '#39FF14');
                const slotSurface = settings.slotBgColor === 'transparent'
                    ? background
                    : normalizeHexColor(settings.slotBgColor, background);
                const isDarkBackground = themeBackground({ backgroundColor: background }).l < 45;
                const surface = backendSkinMode === 'soft'
                    ? mixHexColors(slotSurface, isDarkBackground ? '#111111' : '#FFFFFF', isDarkBackground ? 0.18 : 0.58)
                    : slotSurface;
                const panel = backendSkinMode === 'soft'
                    ? mixHexColors(background, primary, isDarkBackground ? 0.10 : 0.05)
                    : mixHexColors(background, surface, 0.42);
                const input = mixHexColors(surface, background, 0.55);
                const onHeading = readableTextFor(heading);
                const onPrimary = normalizeHexColor(settings.buttonTextColor, readableTextFor(primary));

                return {
                    '--skin-bg': background,
                    '--skin-surface': surface,
                    '--skin-panel': panel,
                    '--skin-input': input,
                    '--skin-heading': heading,
                    '--skin-text': heading,
                    '--skin-muted': body,
                    '--skin-primary': primary,
                    '--skin-on-primary': onPrimary,
                    '--skin-on-heading': onHeading,
                    '--skin-border': rgbaFromHex(heading, 0.13),
                    '--skin-shadow': rgbaFromHex(heading, isDarkBackground ? 0.5 : 0.24),
                    '--skin-primary-soft': rgbaFromHex(primary, 0.22),
                    '--skin-heading-soft': rgbaFromHex(heading, 0.09),
                    '--skin-on-heading-muted': rgbaFromHex(onHeading, 0.64),
                    '--skin-on-heading-border': rgbaFromHex(onHeading, 0.16),
                    '--skin-font-body': getFontFamily(settings.bodyFontFamily || settings.fontFamily),
                    '--skin-font-heading': getFontFamily(settings.headingFontFamily || settings.fontFamily),
                    '--skin-font-button': getFontFamily(settings.buttonFontFamily || settings.fontFamily),
                    '--skin-radius': settings.buttonStyle === 'pill' ? '18px' : '8px'
                };
            }, [
                backendSkinMode,
                settings.backgroundColor,
                settings.headingColor,
                settings.bodyColor,
                settings.primaryColor,
                settings.slotBgColor,
                settings.buttonTextColor,
                settings.bodyFontFamily,
                settings.headingFontFamily,
                settings.buttonFontFamily,
                settings.fontFamily,
                settings.buttonStyle
            ]);

            const scrollThemePaletteRail = (direction) => {
                if (!themePaletteRailRef.current) return;
                themePaletteRailRef.current.scrollBy({ left: direction * 312, behavior: 'smooth' });
            };

            useEffect(() => {
                const updateScale = () => {
                    if (!containerRef.current) return;
                    const c = containerRef.current;
                    const dWidth = device === 'desktop' ? 1200 : 420;
                    const dHeight = device === 'desktop' ? 820 : 1050;
                    const padding = device === 'desktop' ? 140 : 60;
                    setScale(Math.min((c.offsetWidth - padding) / dWidth, (c.offsetHeight - padding) / dHeight, device === 'desktop' ? 1 : 1.2));
                };

                updateScale();
                const t1 = setTimeout(updateScale, 50);
                const t2 = setTimeout(updateScale, 400);
                const t3 = setTimeout(updateScale, 800);
                
                window.addEventListener('resize', updateScale);
                
                return () => { 
                    clearTimeout(t1); 
                    clearTimeout(t2); 
                    clearTimeout(t3); 
                    window.removeEventListener('resize', updateScale); 
                };
            }, [device, activeTab, view, sidebarCollapsed, editorCollapsed]);

            useEffect(() => {
                if (settings.features?.favicon) {
                    let link = document.querySelector("link[rel~='icon']");
                    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
                    link.href = settings.features.favicon;
                }
            }, [settings.features?.favicon]);

            useEffect(() => {
                const initAuth = async () => {
                    try {
                        if (isFirebaseConfigured) {
                            if (initialAuthToken) await FirebaseSDK.signInWithCustomToken(auth, initialAuthToken);
                            else if (publicSlug) await FirebaseSDK.signInAnonymously(auth);
                            else setLoading(false);
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
                if (isFirebaseConfigured) return FirebaseSDK.onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
            }, [publicSlug]);

            useEffect(() => {
                if (isFirebaseConfigured && !publicSlug && view === 'dashboard' && !user) {
                    setView('landing');
                }
            }, [view, user, publicSlug]);

            useEffect(() => {
                if (!publicSlug) return;
                if (!isFirebaseConfigured) {
                    setPublicError('Firebase is not configured yet.');
                    setPublicLoading(false);
                    return;
                }

                setPublicLoading(true);
                setPublicError('');
                const workspaceRef = FirebaseSDK.doc(db, 'artifacts', appId, 'public', 'data', 'workspaces', publicSlug);
                FirebaseSDK.getDoc(workspaceRef)
                    .then((docSnap) => {
                        if (!docSnap.exists()) {
                            setPublicError('This booking page is not published yet.');
                            setPublicWorkspace(null);
                            return;
                        }
                        setPublicWorkspace(docSnap.data());
                    })
                    .catch((error) => {
                        console.error(error);
                        setPublicError('Could not load this booking page.');
                    })
                    .finally(() => setPublicLoading(false));
            }, [publicSlug]);

            useEffect(() => {
                if (!user && isFirebaseConfigured) return;
                if (!isFirebaseConfigured) return;

                const settingsRef = FirebaseSDK.doc(db, 'artifacts', appId, 'users', user.uid, 'config', 'settings');
                const unsubSettings = FirebaseSDK.onSnapshot(settingsRef, (docSnap) => { 
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        if(data.fontFamily === 'sans') data.fontFamily = 'inter';
                        if(data.fontFamily === 'serif') data.fontFamily = 'playfair';
                        if(data.fontFamily === 'mono') data.fontFamily = 'space-mono';
                        if(data.fontFamily === 'display') data.fontFamily = 'syne';
                        setSettings(prev => ({...prev, ...data}));
                    }
                });
                
                const staffRef = FirebaseSDK.doc(db, 'artifacts', appId, 'users', user.uid, 'config', 'staff');
                const unsubStaff = FirebaseSDK.onSnapshot(staffRef, (docSnap) => { 
                    if (docSnap.exists()) setStaffList(docSnap.data().list || []);
                });

                const commsRef = FirebaseSDK.doc(db, 'artifacts', appId, 'users', user.uid, 'config', 'communications');
                const unsubComms = FirebaseSDK.onSnapshot(commsRef, (docSnap) => { 
                    if (docSnap.exists()) setCommunications(docSnap.data());
                });

                const clientsRef = FirebaseSDK.doc(db, 'artifacts', appId, 'users', user.uid, 'config', 'clients');
                const unsubClients = FirebaseSDK.onSnapshot(clientsRef, (docSnap) => { 
                    if (docSnap.exists()) setClientRecords(docSnap.data().list || []);
                });

                const bookingsCol = FirebaseSDK.collection(db, 'artifacts', appId, 'users', user.uid, 'bookings');
                const unsubBookings = FirebaseSDK.onSnapshot(bookingsCol, (snap) => {
                    setBookings(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.timestamp - a.timestamp));
                });
                return () => { unsubSettings(); unsubStaff(); unsubComms(); unsubClients(); unsubBookings(); };
            }, [user]);

            const saveSettings = async () => {
                if (!user || !isFirebaseConfigured) {
                    showToast("Add Firebase config to publish live.");
                    return;
                }
                showToast("Publishing updates...");
                try {
                    await FirebaseSDK.setDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'users', user.uid, 'config', 'settings'), settings);
                    await FirebaseSDK.setDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'public', 'data', 'workspaces', settings.slug), { ...settings, ownerId: user.uid, updatedAt: Date.now() });
                    showToast("Booking page published!");
                } catch (err) { console.error(err); showToast("Failed to publish."); }
            };

            const saveStaff = async (newList) => {
                setStaffList(newList);
                if (!user || !isFirebaseConfigured) return;
                await FirebaseSDK.setDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'users', user.uid, 'config', 'staff'), { list: newList });
            };

            const saveClients = async (newList) => {
                setClientRecords(newList);
                if (!user || !isFirebaseConfigured) return;
                await FirebaseSDK.setDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'users', user.uid, 'config', 'clients'), { list: newList });
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
                form.reset();
                showToast(existingClient ? "Client profile updated" : "Client added");
            };

            const saveComms = async (newComms) => {
                setCommunications(newComms);
                if (!user || !isFirebaseConfigured) return;
                await FirebaseSDK.setDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'users', user.uid, 'config', 'communications'), newComms);
            };

            const applyTheme = (themeId) => {
                const theme = PRESET_THEMES.find(t => t.id === themeId);
                if(theme) {
                    setSettings(prev => ({
                        ...prev, 
                        ...theme, 
                        headingFontFamily: '', bodyFontFamily: '', buttonFontFamily: '', slotFontFamily: '', dateFontFamily: '' // reset overrides on theme change
                    }));
                }
            };

            const handleInspect = (tab) => { if (activeTab !== 'editor') setActiveTab('editor'); setEditorCollapsed(false); setEditorTab(tab); };
            const handleSettingChange = (key, value) => { setSettings(prev => ({ ...prev, [key]: value })); };
            const handleFeatureChange = (key, value) => { setSettings(prev => ({ ...prev, features: { ...prev.features, [key]: value } })); };
            const handleEmailProviderChange = (key, value) => {
                setCommunications(prev => ({
                    ...prev,
                    emailProvider: {
                        ...getEmailConfig(prev),
                        [key]: value
                    }
                }));
            };
            const handleEmailTemplateChange = (key, value) => {
                setCommunications(prev => {
                    const currentConfig = getEmailConfig(prev);
                    return {
                        ...prev,
                        emailProvider: {
                            ...currentConfig,
                            templates: {
                                ...currentConfig.templates,
                                [key]: value
                            }
                        }
                    };
                });
            };
            const handleBackendSkinChange = (key, value) => {
                setSettings(prev => ({
                    ...prev,
                    backendSkin: {
                        enabled: false,
                        mode: 'immersive',
                        showBranding: true,
                        ...(prev.backendSkin || {}),
                        [key]: value
                    }
                }));
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
                const assetRef = FirebaseSDK.ref(storage, `artifacts/${appId}/users/${user.uid}/${folder}/${Date.now()}-${safeName || 'asset'}`);
                await FirebaseSDK.uploadBytes(assetRef, file);
                return FirebaseSDK.getDownloadURL(assetRef);
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
                if (!isFirebaseConfigured || user) {
                    setView('dashboard');
                    return;
                }
                setAuthMode('signin');
                setAuthPanelOpen(true);
                setAuthError('Sign in first to manage your business workspace.');
            };
            const handleAuthSubmit = async (event) => {
                event.preventDefault();
                if (!isFirebaseConfigured) {
                    setView('dashboard');
                    return;
                }
                setAuthError('');
                try {
                    if (authMode === 'signup') {
                        await FirebaseSDK.createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
                    } else {
                        await FirebaseSDK.signInWithEmailAndPassword(auth, authForm.email, authForm.password);
                    }
                    setAuthPanelOpen(false);
                    setView('dashboard');
                    showToast(authMode === 'signup' ? 'Account created' : 'Signed in');
                } catch (error) {
                    console.error(error);
                    setAuthError(error.message || 'Could not sign in.');
                }
            };
            const handleSignOut = async () => {
                if (isFirebaseConfigured && user) {
                    await FirebaseSDK.signOut(auth);
                }
                setView('landing');
            };

            const handleBookingComplete = async (formData, date, time, status, dateKey) => {
                const bookingRecord = {
                    clientName: formData.name,
                    clientPhone: formData.phone,
                    clientEmail: formData.email || '',
                    clientBirthday: formData.birthday || '',
                    date,
                    dateKey: dateKey || null,
                    time,
                    status,
                    timestamp: Date.now(),
                    noShowHistory: Math.random() > 0.8 // Mocking no-show flag for demo
                };

                if (!isFirebaseConfigured) {
                    setBookings(prev => [{ id: `local-${Date.now()}`, ...bookingRecord }, ...(prev.length ? prev : demoBookings)]);
                    return;
                }
                if (!user) return;
                try {
                    await FirebaseSDK.addDoc(FirebaseSDK.collection(db, 'artifacts', appId, 'users', user.uid, 'bookings'), {
                        ...bookingRecord
                    });
                } catch (err) { console.error(err); }
            };

            const handlePublicBookingComplete = async (formData, date, time, status, dateKey) => {
                if (!publicWorkspace?.ownerId) {
                    showToast('Booking page is missing an owner.');
                    return;
                }
                const bookingRecord = {
                    clientName: formData.name,
                    clientPhone: formData.phone,
                    clientEmail: formData.email || '',
                    clientBirthday: formData.birthday || '',
                    date,
                    dateKey: dateKey || null,
                    time,
                    status,
                    source: 'public-booking-page',
                    workspaceSlug: publicSlug,
                    timestamp: Date.now(),
                    createdAt: FirebaseSDK.serverTimestamp()
                };

                try {
                    await FirebaseSDK.addDoc(FirebaseSDK.collection(db, 'artifacts', appId, 'users', publicWorkspace.ownerId, 'bookings'), bookingRecord);
                    await FirebaseSDK.addDoc(FirebaseSDK.collection(db, 'artifacts', appId, 'public', 'data', 'workspaces', publicSlug, 'bookingSubmissions'), bookingRecord);
                } catch (error) {
                    console.error(error);
                    showToast('Booking could not be submitted.');
                }
            };

            const sendBookingEmail = async (booking, templateKey, extra = {}) => {
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
                    showToast('Email failed. Check EmailJS settings.');
                    return false;
                }
            };

            const updateBooking = async (bookingId, updates) => {
                if (!isFirebaseConfigured) {
                    setBookings(prev => (prev.length ? prev : demoBookings).map(b => b.id === bookingId ? { ...b, ...updates } : b));
                    return;
                }
                if (!user) return;
                try { await FirebaseSDK.updateDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'users', user.uid, 'bookings', bookingId), updates); } 
                catch (err) { console.error(err); }
            };

            const deleteBooking = async (bookingId) => {
                if (!isFirebaseConfigured) {
                    setBookings(prev => (prev.length ? prev : demoBookings).filter(b => b.id !== bookingId));
                    return;
                }
                if (!user) return;
                try { await FirebaseSDK.deleteDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'users', user.uid, 'bookings', bookingId)); } 
                catch (err) { console.error(err); }
            };

            const approveBooking = async (booking) => {
                await updateBooking(booking.id, { status: 'confirmed' });
                await sendBookingEmail({ ...booking, status: 'confirmed' }, 'confirmed');
            };

            const sendRunningLateToBooking = async (booking) => {
                const minutes = prompt(`Minutes late for ${booking.clientName}?`, "15");
                if (minutes) await sendBookingEmail(booking, 'runningLate', { minutes });
            };

            const sendWaitlistToBooking = async (booking) => {
                if (booking.status !== 'waitlist') {
                    await updateBooking(booking.id, { status: 'waitlist', time: 'Waitlist' });
                    await sendBookingEmail({ ...booking, status: 'waitlist', time: 'Waitlist' }, 'waitlist');
                    showToast(`${booking.clientName} moved to waitlist.`);
                    return;
                }
                await sendBookingEmail(booking, 'waitlist');
            };

            const sendReviewToBooking = async (booking) => {
                await sendBookingEmail(booking, 'review');
            };

            if (loading || publicLoading) return <div className="h-screen bg-[#050505] flex items-center justify-center"><img src="/logoblackonwhite.png" alt="Build A Booking" className="w-24 h-24 rounded-lg object-contain bg-white shadow-2xl animate-subtle-pulse" /></div>;

            if (publicSlug) {
                if (publicError || !publicWorkspace) {
                    return (
                        <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6">
                            <div className="max-w-md text-center">
                                <img src="/logoblackonwhite.png" alt="Build A Booking" className="w-16 h-16 rounded-lg object-contain bg-white shadow-2xl mx-auto mb-8" />
                                <p className="text-[10px] font-bold uppercase tracking-[0.45em] text-white/40 mb-4">Booking Page</p>
                                <h1 className="text-4xl font-bold tracking-tight mb-4">Page unavailable</h1>
                                <p className="text-white/55 leading-relaxed">{publicError || 'This booking page is not available yet.'}</p>
                            </div>
                        </div>
                    );
                }

                return (
                    <div className="h-screen w-screen overflow-hidden" style={{ backgroundColor: publicWorkspace.backgroundColor || '#ffffff' }}>
                        <BookingFlow settings={publicWorkspace} onComplete={handlePublicBookingComplete} />
                    </div>
                );
            }

            if (view === 'landing') {
                return (
                  <div className="min-h-screen bg-white text-black font-sans selection:bg-black selection:text-white overflow-x-hidden">
                    {/* Navigation */}
                    <nav className="fixed w-full z-50 bg-white/80 backdrop-blur-xl border-b border-neutral-200/50 transition-all">
                      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 h-16 md:h-20 flex items-center justify-between">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('landing')}>
                          <img src="logoblackonwhite.png" alt="Build A Booking logo" className="w-9 h-9 rounded-lg object-contain bg-white shadow-sm" />
                          <span className="font-display font-semibold text-base md:text-xl tracking-tight">Build A Booking</span>
                        </div>
                        <div className="flex items-center gap-6">
                          <button onClick={openDashboard} className="hidden md:block text-sm font-semibold text-neutral-500 hover:text-black transition-colors">Sign In</button>
                          <button onClick={openDashboard} className="h-10 px-4 md:px-6 rounded-full bg-black text-white font-bold text-[11px] md:text-xs hover:scale-105 transition-transform shadow-lg shadow-black/10">Get Started</button>
                        </div>
                      </div>
                    </nav>

                    {authPanelOpen && (
                    <div className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
                        <form onSubmit={handleAuthSubmit} className="w-full max-w-md bg-white rounded-lg border border-neutral-100 shadow-2xl p-6 md:p-8 animate-in fade-in zoom-in-95 duration-300">
                            <div className="flex items-start justify-between gap-4 mb-8">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-neutral-400 mb-2">Owner Access</p>
                                    <h2 className="text-3xl font-bold tracking-tight text-black">{authMode === 'signup' ? 'Create Account' : 'Sign In'}</h2>
                                </div>
                                <button type="button" onClick={() => { setAuthPanelOpen(false); setAuthError(''); }} className="w-10 h-10 rounded-full bg-neutral-100 text-neutral-400 flex items-center justify-center hover:text-black transition-colors"><X size={16}/></button>
                            </div>
                            <div className="space-y-4">
                                <input type="email" value={authForm.email} onChange={(e) => setAuthForm(prev => ({ ...prev, email: e.target.value }))} required placeholder="Email address" className="w-full h-12 bg-neutral-50 border border-neutral-100 rounded-lg px-5 text-sm font-bold outline-none focus:bg-white focus:border-black transition-colors" />
                                <input type="password" value={authForm.password} onChange={(e) => setAuthForm(prev => ({ ...prev, password: e.target.value }))} required minLength={6} placeholder="Password" className="w-full h-12 bg-neutral-50 border border-neutral-100 rounded-lg px-5 text-sm font-bold outline-none focus:bg-white focus:border-black transition-colors" />
                            </div>
                            {authError && <p className="mt-4 text-xs font-bold text-red-500 leading-relaxed">{authError}</p>}
                            <button type="submit" className="mt-6 w-full h-12 rounded-lg bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-800 transition-colors">
                                {authMode === 'signup' ? 'Create Workspace' : 'Sign In'}
                            </button>
                            <button type="button" onClick={() => { setAuthMode(authMode === 'signup' ? 'signin' : 'signup'); setAuthError(''); }} className="mt-4 w-full text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-black transition-colors">
                                {authMode === 'signup' ? 'Already have an account?' : 'Need an account? Create one'}
                            </button>
                        </form>
                    </div>
                    )}
            
                    {/* Hero Section */}
                    <section className="relative pt-32 md:pt-56 pb-20 md:pb-32 px-4 sm:px-6 flex flex-col items-center text-center border-b border-neutral-100">
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neutral-50 border border-neutral-200 text-xs font-bold mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 text-neutral-600">
                        <Sparkles size={14} className="text-black" /> The next generation of scheduling
                      </div>
                      
                      <h1 className="text-4xl sm:text-5xl md:text-[90px] lg:text-[110px] font-bold tracking-tighter leading-[0.95] md:leading-[0.9] max-w-6xl mb-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100">
                        Schedule like a studio. <br className="hidden md:block" />
                        <span className="text-neutral-300">Not a spreadsheet.</span>
                      </h1>
                      
                      <p className="text-lg md:text-2xl font-medium text-neutral-500 max-w-2xl mb-12 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-200">
                        A beautiful booking page and simple dashboard for creators, studios, and service businesses that want to look polished from the first click.
                      </p>
                      
                      <div className="flex flex-col md:flex-row items-center gap-4 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
                        <button onClick={openDashboard} className="h-14 px-10 rounded-full bg-black text-white font-bold text-sm hover:scale-105 transition-transform shadow-2xl shadow-black/20 flex items-center gap-2 w-full md:w-auto justify-center">
                          Start Building Free <ArrowRight size={16} />
                        </button>
                      </div>
                    </section>
            
                    {/* Bento Grid Features */}
                    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-32">
                      <div className="text-center mb-16 md:mb-24">
                        <h2 className="text-3xl sm:text-4xl md:text-6xl font-bold tracking-tighter mb-6">Everything your booking page needs.</h2>
                        <p className="text-neutral-500 font-medium text-lg md:text-xl max-w-2xl mx-auto">Create a polished client experience, manage requests, and keep your schedule organized in one place.</p>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        
                        {/* Box 1: Design (Span 2) */}
                        <div className="md:col-span-2 bg-[#fafafa] rounded-lg p-6 sm:p-8 md:p-14 border border-neutral-200/60 hover:shadow-xl transition-all group relative overflow-hidden">
                          <Palette className="mb-6 text-black relative z-10" size={36} strokeWidth={1.5} />
                          <h3 className="text-2xl md:text-4xl font-bold tracking-tight mb-4 text-black relative z-10">Live Page Editor.</h3>
                          <p className="text-neutral-500 font-medium text-lg max-w-md relative z-10">Design your booking page in minutes. Change colors, try fonts, upload your logo, and preview every detail as you go.</p>
                        </div>
                        
                        {/* Box 2: Waitlist (Span 1) */}
                        <div className="bg-[#fafafa] rounded-lg p-6 sm:p-8 md:p-14 border border-neutral-200/60 hover:shadow-xl transition-all group flex flex-col">
                          <Bell className="mb-6 text-black" size={36} strokeWidth={1.5} />
                          <h3 className="text-2xl font-bold tracking-tight mb-4 text-black">Waitlists.</h3>
                          <p className="text-neutral-500 font-medium flex-1">When a day is full, clients can still join the waitlist so you never lose the opportunity.</p>
                        </div>
                        
                        {/* Box 3: Approvals (Span 1) */}
                        <div className="bg-[#fafafa] rounded-lg p-6 sm:p-8 md:p-14 border border-neutral-200/60 hover:shadow-xl transition-all group">
                          <ShieldCheck className="mb-6 text-black" size={36} strokeWidth={1.5} />
                          <h3 className="text-2xl font-bold tracking-tight mb-4 text-black">Approve Requests.</h3>
                          <p className="text-neutral-500 font-medium">Review new requests before they become bookings, keep an eye on no-shows, and stay in control of your calendar.</p>
                        </div>

                        {/* Box 4: Communication Studio (Span 1) */}
                        <div className="bg-[#fafafa] rounded-lg p-6 sm:p-8 md:p-14 border border-neutral-200/60 hover:shadow-xl transition-all group">
                          <MessageSquare className="mb-6 text-black" size={36} strokeWidth={1.5} />
                          <h3 className="text-2xl font-bold tracking-tight mb-4 text-black">Email Studio.</h3>
                          <p className="text-neutral-500 font-medium">Write clean emails for confirmations, reviews, waitlists, and schedule updates without starting from scratch.</p>
                        </div>

                        {/* Box 5: Client Intel (Span 1) */}
                        <div className="bg-[#fafafa] rounded-lg p-6 sm:p-8 md:p-14 border border-neutral-200/60 hover:shadow-xl transition-all group">
                          <Heart className="mb-6 text-black" size={36} strokeWidth={1.5} />
                          <h3 className="text-2xl font-bold tracking-tight mb-4 text-black">Client Details.</h3>
                          <p className="text-neutral-500 font-medium">Save useful client details like birthdays and spot clients who may be ready to book again.</p>
                        </div>
            
                        {/* Box 6: Team/Staff (Span 2) */}
                        <div className="md:col-span-2 bg-black text-white rounded-lg p-6 sm:p-8 md:p-16 relative overflow-hidden group">
                          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-[80px] -mr-20 -mt-20" />
                          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-10">
                              <div className="max-w-xl">
                                  <Users className="mb-6 text-white" size={36} strokeWidth={1.5} />
                                  <h3 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Team Scheduling.</h3>
                                  <p className="text-neutral-400 font-medium text-lg">Add your team, assign bookings, and see who handled each client at a glance.</p>
                              </div>
                          </div>
                        </div>

                        {/* Box 7: Booked Rate Kit (Span 1) */}
                        <div className="bg-[#fafafa] rounded-lg p-6 sm:p-8 md:p-14 border border-neutral-200/60 hover:shadow-xl transition-all group flex flex-col">
                          <Flame className="mb-6 text-black" size={36} strokeWidth={1.5} />
                          <h3 className="text-2xl font-bold tracking-tight mb-4 text-black">Booking Tools.</h3>
                          <p className="text-neutral-500 font-medium flex-1">Add social proof, first available buttons, and FAQs so clients can book with confidence.</p>
                        </div>

                        {/* Box 8: Business Tools (Span 3) */}
                        <div className="md:col-span-3 bg-[#fafafa] rounded-lg p-6 sm:p-8 md:p-12 border border-neutral-200/60 hover:shadow-xl transition-all flex flex-col md:flex-row items-center justify-between gap-6 md:gap-10 text-center md:text-left">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-black shadow-sm shrink-0"><Briefcase size={24}/></div>
                                <div>
                                    <h3 className="text-xl font-bold tracking-tight text-black mb-1">Helpful Business Tools</h3>
                                    <p className="text-neutral-500 font-medium">Google Maps directions, calendar links, and simple referral tools built in.</p>
                                </div>
                            </div>
                            <button onClick={openDashboard} className="h-14 px-8 rounded-full bg-black text-white font-bold text-sm hover:scale-105 transition-transform shrink-0 w-full md:w-auto">
                                Explore All Features
                            </button>
                        </div>

                      </div>
                    </section>
            
                    {/* Footer CTA */}
                    <section className="py-20 md:py-32 px-4 sm:px-6 text-center border-t border-neutral-200/50 bg-neutral-50/50">
                      <div className="flex flex-col items-center max-w-3xl mx-auto">
                        <h2 className="text-4xl md:text-7xl font-bold tracking-tighter mb-8 text-black leading-[0.95] md:leading-[0.9]">Ready to upgrade your booking flow?</h2>
                        <p className="text-xl text-neutral-500 font-medium mb-10">Build a booking experience that feels clean, premium, and easy for clients to use.</p>
                        <button onClick={openDashboard} className="h-16 px-12 rounded-full bg-black text-white font-bold text-sm hover:scale-105 transition-transform shadow-2xl shadow-black/20">
                          Build Your Booking Flow
                        </button>
                      </div>
                    </section>
                  </div>
                );
            }

            return (
                <div
                    className={`flex h-screen bg-[#FBFBFB] text-black overflow-hidden font-sans relative ${backendSkinEnabled ? `backend-skin backend-skin-${backendSkinMode}` : ''}`}
                    style={backendSkinEnabled ? backendSkinVars : undefined}
                >
                {backendSkinEnabled && <div className="backend-skin-ambient pointer-events-none absolute inset-0 z-0" />}
                {/* Global Toast */}
                {toast && (
                    <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[9999] px-8 py-4 bg-black text-white rounded-full text-xs font-bold uppercase tracking-widest shadow-2xl animate-in slide-in-from-top-10 fade-in duration-500 flex items-center gap-3">
                        <CheckCircle2 size={16} className="text-[#39FF14]" /> {toast}
                    </div>
                )}

                <div className={`dashboard-sidebar hidden md:flex transition-all duration-700 ease-in-out bg-white border-r border-neutral-100 flex-col relative z-50 shadow-sm ${sidebarCollapsed ? 'w-0 opacity-0 pointer-events-none' : 'w-80 p-8'}`}>
                    {!sidebarCollapsed && (
                    <>
                        <div className="flex items-center gap-4 mb-16 md:mb-24 px-2 cursor-pointer group" onClick={() => setView('landing')}>
                            <img src="logoblackonwhite.png" alt="Build A Booking logo" className="w-11 h-11 rounded-lg object-contain bg-white shadow-xl group-hover:scale-105 transition-all duration-300" />
                            <span className="font-display font-semibold text-[18px] tracking-tight leading-none">Build A Booking</span>
                        </div>
                        <nav className="space-y-3 flex-1 overflow-y-auto no-scrollbar pb-10">
                        {navItems.map(item => {
                            const IconCmp = item.icon;
                            return (
                                <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center gap-5 px-6 py-5 rounded-lg text-[11px] font-bold transition-all duration-700 ${activeTab === item.id ? 'bg-black text-white shadow-xl scale-[1.02]' : 'text-neutral-400 hover:bg-neutral-50 hover:text-black'}`}>
                                <IconCmp size={18} strokeWidth={2.5} /> {item.label.toUpperCase()}
                                {item.badge && <div className="ml-auto w-2 h-2 rounded-full bg-[#39FF14] animate-pulse" />}
                                </button>
                            );
                        })}
                        </nav>
                        <div className="mt-auto space-y-4 pt-6 border-t border-neutral-100">
                            {backendSkinEnabled && backendSkinShowBranding && (
                                <div className="overflow-hidden rounded-lg border border-neutral-100 bg-neutral-50 shadow-sm">
                                    {settings.bannerImage && (
                                        <div className="h-16 bg-cover bg-center opacity-90" style={{ backgroundImage: `url(${settings.bannerImage})` }} />
                                    )}
                                    <div className="p-4 flex items-center gap-3">
                                        <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 flex items-center justify-center font-bold shadow-sm" style={{ backgroundColor: settings.headingColor, color: readableTextFor(settings.headingColor) }}>
                                            {settings.logo ? <img src={settings.logo} className="w-full h-full object-cover" /> : (settings.brandName?.charAt(0) || 'B')}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">Workspace Skin</p>
                                            <p className="text-sm font-bold text-black truncate">{settings.brandName || 'Business'} Mode</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <ProButton onClick={handleSignOut} variant="outline" className="w-full py-4 text-[10px]">Sign Out</ProButton>
                        </div>
                    </>
                    )}
                </div>

                <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="desktop-sidebar-toggle hidden md:flex fixed bottom-6 left-6 md:bottom-10 md:left-10 z-[100] w-12 h-12 bg-white border border-neutral-100 rounded-full shadow-2xl items-center justify-center text-neutral-400 hover:text-black transition-all hover:scale-110">
                    {sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
                </button>

                <nav className="mobile-bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-[120] bg-white/95 backdrop-blur-xl border-t border-neutral-200 shadow-[0_-16px_40px_-30px_rgba(0,0,0,0.45)]">
                    <div className="flex gap-2 overflow-x-auto no-scrollbar px-3 py-3">
                        {navItems.map(item => {
                            const IconCmp = item.icon;
                            const isActive = activeTab === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveTab(item.id)}
                                    className={`relative min-w-[72px] h-14 rounded-lg flex flex-col items-center justify-center gap-1 text-[8px] font-bold uppercase tracking-widest transition-all ${isActive ? 'bg-black text-white shadow-lg' : 'text-neutral-400 bg-neutral-50'}`}
                                >
                                    <IconCmp size={15} strokeWidth={2.5} />
                                    <span className="truncate max-w-[62px]">{item.mobileLabel || item.label.split(' ')[0]}</span>
                                    {item.badge && <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-[#39FF14]" />}
                                </button>
                            );
                        })}
                    </div>
                </nav>

                <div className="dashboard-main relative z-10 flex-1 flex overflow-hidden pb-20 md:pb-0">
                    {activeTab === 'overview' && (
                        <div className="flex-1 overflow-y-auto bg-[#F6F7F9] p-4 sm:p-6 md:p-10 lg:p-12">
                            <header className="mb-8 flex flex-col xl:flex-row xl:items-end justify-between gap-6">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-neutral-400 mb-3">Business Command Center</p>
                                    <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-black">Dashboard</h1>
                                    <p className="text-neutral-500 text-base md:text-lg mt-3 max-w-2xl">A clean portfolio view of bookings, clients, schedule health, team coverage, and your live booking page.</p>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <button onClick={() => setActiveTab('editor')} className="h-11 px-5 rounded-lg bg-black text-white text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors">
                                        <Palette size={15}/> Edit Page
                                    </button>
                                    <button onClick={saveSettings} className="h-11 px-5 rounded-lg bg-[#39FF14] text-black text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:brightness-95 transition-all">
                                        <Check size={15}/> Publish
                                    </button>
                                </div>
                            </header>

                            <section className="mb-6 overflow-hidden rounded-lg bg-black text-white shadow-[0_24px_80px_-48px_rgba(0,0,0,0.9)]">
                                <div className="grid grid-cols-1 xl:grid-cols-12">
                                    <div className="xl:col-span-7 p-6 md:p-8 lg:p-10">
                                        <div className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white/70 mb-8">
                                            <span className="w-2 h-2 rounded-full bg-[#39FF14] shadow-[0_0_0_4px_rgba(57,255,20,0.14)]" />
                                            Live Workspace
                                        </div>
                                        <h2 className="text-3xl md:text-5xl font-bold tracking-tight leading-none mb-4">{dashboardPortfolio.greeting}, {settings.brandName || 'Builder'}</h2>
                                        <p className="text-white/55 text-base md:text-lg max-w-2xl leading-relaxed">Your business is ready for the day. Review what needs approval, keep capacity visible, and move clients through the booking flow without hunting through tabs.</p>
                                        <div className="flex flex-col sm:flex-row gap-3 mt-8">
                                            <button onClick={() => setActiveTab('bookings')} className="h-12 px-5 rounded-lg bg-[#39FF14] text-black text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:brightness-95 transition-all">
                                                <Bell size={15}/> Review Requests
                                            </button>
                                            <button onClick={() => setActiveTab('business')} className="h-12 px-5 rounded-lg bg-white/10 text-white border border-white/10 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white/15 transition-colors">
                                                <Calendar size={15}/> Manage Schedule
                                            </button>
                                        </div>
                                    </div>
                                    <div className="xl:col-span-5 grid grid-cols-2 border-t xl:border-t-0 xl:border-l border-white/10">
                                        {[
                                            ['Today', dashboardPortfolio.todayBookings.length, `${dashboardPortfolio.todayOpenSlots} slots open`],
                                            ['Needs Review', dashboardPortfolio.needsAttention, `${bookingStats.pending} requests`],
                                            ['This Week', dashboardPortfolio.weekBookings.length, 'bookings on deck'],
                                            ['Booking Rate', `${dashboardPortfolio.bookingRate}%`, `${dashboardPortfolio.confirmedActive}/${dashboardPortfolio.activeBookings} confirmed`]
                                        ].map((item, index) => (
                                            <div key={item[0]} className={`p-5 md:p-6 min-h-[150px] flex flex-col justify-between ${index % 2 === 1 ? 'border-l' : ''} ${index > 1 ? 'border-t' : ''} border-white/10`}>
                                                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/40">{item[0]}</p>
                                                <div>
                                                    <p className="metric-value text-3xl md:text-4xl font-bold tracking-tight">{item[1]}</p>
                                                    <p className="text-xs font-bold uppercase tracking-widest text-[#39FF14] mt-2">{item[2]}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                                {[
                                    { label: "Today's Bookings", value: dashboardPortfolio.todayBookings.length, hint: dashboardPortfolio.todayAvailable ? `${dashboardPortfolio.todayOpenSlots} open slots` : 'Closed today', icon: CalendarCheck, tone: 'accent' },
                                    { label: 'Needs Attention', value: dashboardPortfolio.needsAttention, hint: `${bookingStats.waitlist} waitlist`, icon: Bell, tone: 'dark' },
                                    { label: 'Client Portfolio', value: clientMetrics.total, hint: `${clientMetrics.regulars} regulars`, icon: Users, tone: 'light' },
                                    { label: 'Booking Rate', value: `${dashboardPortfolio.bookingRate}%`, hint: 'Confirmed share', icon: ShieldCheck, tone: 'light' }
                                ].map(metric => {
                                    const IconCmp = metric.icon;
                                    const isDark = metric.tone === 'dark';
                                    const isAccent = metric.tone === 'accent';
                                    return (
                                        <div key={metric.label} className={`saas-card p-5 overflow-hidden ${isDark ? 'bg-black text-white border-black' : isAccent ? 'bg-[#39FF14] text-black border-[#39FF14]' : ''}`}>
                                            <div className="flex items-start justify-between mb-8">
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-white/10 text-[#39FF14]' : isAccent ? 'bg-black text-white' : 'bg-neutral-100 text-black'}`}><IconCmp size={17}/></div>
                                                <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md ${isDark ? 'bg-white/10 text-white/65' : isAccent ? 'bg-black/10 text-black/65' : 'bg-neutral-100 text-neutral-500'}`}>{metric.hint}</span>
                                            </div>
                                            <p className={`text-[10px] font-bold uppercase tracking-[0.25em] mb-2 ${isDark ? 'text-white/45' : isAccent ? 'text-black/55' : 'text-neutral-400'}`}>{metric.label}</p>
                                            <p className="metric-value text-3xl md:text-4xl font-bold tracking-tight text-inherit">{metric.value}</p>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                                <section className="xl:col-span-8 saas-card overflow-hidden">
                                    <div className="p-5 md:p-6 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div>
                                            <h2 className="text-lg font-bold tracking-tight">Booking Desk</h2>
                                            <p className="text-sm text-neutral-500">{dashboardPortfolio.todayBookings.length ? "Today's bookings and requests." : 'Upcoming bookings, requests, and waitlist spots.'}</p>
                                        </div>
                                        <button onClick={() => setActiveTab('bookings')} className="h-10 px-4 rounded-lg bg-neutral-50 text-[10px] font-bold uppercase tracking-widest text-neutral-500 hover:text-black hover:bg-neutral-100 transition-colors">View Queue</button>
                                    </div>
                                    <div className="divide-y divide-neutral-100">
                                        {(dashboardPortfolio.todayBookings.length ? dashboardPortfolio.todayBookings : dashboardPortfolio.upcomingBookings).slice(0, 6).map(b => {
                                            const assignedStaff = staffList.find(staff => staff.id === b.staffId);
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
                                                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold shrink-0 ${statusStyle}`}>{b.clientName.charAt(0)}</div>
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                                <h3 className="font-bold text-black truncate">{b.clientName}</h3>
                                                                {b.noShowHistory && <span className="px-2 py-1 rounded-md bg-red-50 text-red-600 text-[8px] font-bold uppercase tracking-widest">Risk</span>}
                                                            </div>
                                                            <p className="text-sm text-neutral-500 truncate">{b.clientPhone}{assignedStaff ? ` / ${assignedStaff.name}` : ''}</p>
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
                                        {!(dashboardPortfolio.todayBookings.length ? dashboardPortfolio.todayBookings : dashboardPortfolio.upcomingBookings).length && (
                                            <div className="p-12 text-center">
                                                <div className="w-14 h-14 rounded-lg bg-neutral-100 flex items-center justify-center mx-auto mb-5 text-neutral-400"><CalendarCheck size={22}/></div>
                                                <h3 className="text-lg font-bold tracking-tight text-black mb-2">No bookings on deck</h3>
                                                <p className="text-sm text-neutral-500">New booking activity will appear here as clients reserve time.</p>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                <aside className="xl:col-span-4 space-y-6">
                                    <section className="saas-card p-5 md:p-6">
                                        <div className="flex items-center justify-between mb-6">
                                            <div>
                                                <h2 className="text-lg font-bold tracking-tight">Business Health</h2>
                                                <p className="text-sm text-neutral-500">Key operating signals.</p>
                                            </div>
                                            <div className="w-10 h-10 rounded-lg bg-black text-[#39FF14] flex items-center justify-center"><ShieldCheck size={17}/></div>
                                        </div>
                                        <div className="space-y-5">
                                            {[
                                                ['Booking rate', dashboardPortfolio.bookingRate],
                                                ['Page readiness', dashboardPortfolio.pageReadiness],
                                                ['Client enrichment', dashboardPortfolio.clientEnrichmentRate],
                                                ['Email automation', Math.round((dashboardPortfolio.emailAutomations / dashboardPortfolio.emailAutomationTotal) * 100)]
                                            ].map(row => (
                                                <div key={row[0]}>
                                                    <div className="flex items-center justify-between gap-4 mb-2">
                                                        <span className="text-sm font-bold text-black">{row[0]}</span>
                                                        <span className="metric-value text-sm font-bold text-neutral-500">{row[1]}%</span>
                                                    </div>
                                                    <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                                                        <div className="h-full rounded-full bg-[#39FF14]" style={{ width: `${Math.max(4, row[1])}%` }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>

                                    <section className="saas-panel p-5 md:p-6">
                                        <div className="flex items-center justify-between mb-6">
                                            <div>
                                                <h2 className="text-lg font-bold tracking-tight">Quick Actions</h2>
                                                <p className="text-sm text-neutral-500">Jump into the work that matters.</p>
                                            </div>
                                            <Zap size={18} className="text-neutral-400" />
                                        </div>
                                        <div className="grid grid-cols-1 gap-3">
                                            {[
                                                ['Review bookings', 'bookings', Bell],
                                                ['Open client book', 'clients', Users],
                                                ['Tune availability', 'business', Calendar],
                                                ['Edit booking page', 'editor', Palette]
                                            ].map(action => {
                                                const IconCmp = action[2];
                                                return (
                                                    <button key={action[0]} onClick={() => setActiveTab(action[1])} className="h-12 rounded-lg bg-white border border-neutral-200 px-4 flex items-center justify-between gap-4 text-sm font-bold text-black hover:border-black hover:shadow-lg transition-all">
                                                        <span className="flex items-center gap-3"><IconCmp size={16}/>{action[0]}</span>
                                                        <ChevronRight size={16} className="text-neutral-300" />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </section>
                                </aside>

                                <section className="xl:col-span-8 saas-card overflow-hidden">
                                    <div className="p-5 md:p-6 border-b border-neutral-100">
                                        <h2 className="text-lg font-bold tracking-tight">Portfolio Snapshot</h2>
                                        <p className="text-sm text-neutral-500">The core pieces of the business workspace.</p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2">
                                        {[
                                            { title: 'Booking Page', value: `${dashboardPortfolio.pageReadiness}% ready`, desc: `/book/${settings.slug || 'studio'}`, icon: Globe },
                                            { title: 'Schedule Capacity', value: `${dashboardPortfolio.todayOpenSlots}/${dashboardPortfolio.todayCapacity} today`, desc: `${(settings.availableTimes || []).length} default slots`, icon: Calendar },
                                            { title: 'Client Book', value: `${clientMetrics.total} profiles`, desc: `${clientMetrics.firstTimers} first-time clients`, icon: Users },
                                            { title: 'Team Coverage', value: `${staffList.length} member${staffList.length === 1 ? '' : 's'}`, desc: `${dashboardPortfolio.emailAutomations}/${dashboardPortfolio.emailAutomationTotal} email automations on`, icon: Briefcase }
                                        ].map((item, index) => {
                                            const IconCmp = item.icon;
                                            return (
                                                <div key={item.title} className={`p-5 md:p-6 ${index % 2 === 1 ? 'md:border-l' : ''} ${index > 1 ? 'border-t' : ''} border-neutral-100`}>
                                                    <div className="flex items-start justify-between gap-4 mb-8">
                                                        <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center text-black"><IconCmp size={17}/></div>
                                                        <span className="w-2.5 h-2.5 rounded-full bg-[#39FF14] shadow-[0_0_0_4px_rgba(57,255,20,0.16)] mt-1" />
                                                    </div>
                                                    <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-400 mb-2">{item.title}</p>
                                                    <h3 className="text-2xl font-bold tracking-tight text-black mb-2">{item.value}</h3>
                                                    <p className="text-sm text-neutral-500 truncate">{item.desc}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>

                                <section className="xl:col-span-4 saas-card p-5 md:p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <div>
                                            <h2 className="text-lg font-bold tracking-tight">Client Signals</h2>
                                            <p className="text-sm text-neutral-500">Relationship and risk overview.</p>
                                        </div>
                                        <Star size={18} className="text-neutral-300" />
                                    </div>
                                    <div className="space-y-4">
                                        {[
                                            ['Regulars / VIP', clientMetrics.regulars],
                                            ['First-time bookers', clientMetrics.firstTimers],
                                            ['Waitlist clients', bookingStats.waitlist],
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
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10 lg:p-12 relative bg-[#FBFBFB]">
                            <header className="mb-8 md:mb-16">
                                <h2 className="text-4xl md:text-5xl font-serif font-bold tracking-tighter mb-4 text-black">Profile</h2>
                                <p className="text-neutral-400 font-medium text-lg">Manage your personal account and business details.</p>
                            </header>

                            <div className="max-w-4xl space-y-12">
                                <div className="bg-white p-5 sm:p-6 md:p-10 rounded-lg border border-neutral-100 shadow-sm">
                                    <h3 className="text-xl font-bold tracking-tight mb-8 text-black">Account Details</h3>
                                    <div className="space-y-6">
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-[0.5em] opacity-40 mb-3 block text-black">Account Email</label>
                                            <input type="text" readOnly value={user?.email || 'Admin User'} className="w-full bg-neutral-50 border-none rounded-lg px-6 py-4 text-sm font-bold outline-none text-neutral-400" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-[0.5em] opacity-40 mb-3 block text-black">Account ID</label>
                                            <input type="text" readOnly value={user?.uid || 'BUILD-BOOKING-001'} className="w-full bg-neutral-50 border-none rounded-lg px-6 py-4 text-sm font-bold outline-none text-neutral-400" />
                                        </div>
                                    </div>
                                </div>

                                <div className="overflow-hidden bg-black text-white rounded-lg border border-black shadow-[0_30px_90px_-55px_rgba(0,0,0,0.9)]">
                                    <div className="grid grid-cols-1 lg:grid-cols-12">
                                        <div className="lg:col-span-7 p-6 md:p-8">
                                            <div className="w-11 h-11 rounded-lg bg-[#39FF14] text-black flex items-center justify-center mb-8 shadow-xl shadow-[#39FF14]/20">
                                                <Share2 size={18} />
                                            </div>
                                            <p className="text-[10px] font-bold uppercase tracking-[0.38em] text-white/40 mb-3">Affiliate Link</p>
                                            <h3 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">Share Build A Booking</h3>
                                            <p className="text-sm text-white/55 leading-relaxed max-w-xl">Keep your referral link tucked inside Profile where it belongs. Share it with other business owners when you want to recommend the platform.</p>
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

                                <div className="bg-white p-5 sm:p-6 md:p-10 rounded-lg border border-neutral-100 shadow-sm">
                                    <h3 className="text-xl font-bold tracking-tight mb-8 text-black">Business Information</h3>
                                    <div className="space-y-10">
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-[0.5em] opacity-40 mb-4 block text-black">Brand Logo</label>
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8">
                                                <div className="w-28 h-28 rounded-lg bg-neutral-50 border border-neutral-100 flex items-center justify-center overflow-hidden shadow-inner shrink-0">
                                                    {settings.logo ? <img src={settings.logo} className="w-full h-full object-cover" /> : <div className="font-bold text-4xl text-neutral-300">{settings.brandName?.charAt(0) || 'B'}</div>}
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
                                            <label className="text-[10px] font-bold uppercase tracking-[0.5em] opacity-40 mb-4 block text-black">Social Links</label>
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-4 bg-neutral-50 p-3 rounded-lg border border-transparent focus-within:border-neutral-200 transition-all">
                                                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm text-black"><Instagram size={16} /></div>
                                                    <input type="text" value={settings.socials?.instagram || ''} onChange={e => handleSettingChange('socials', {...settings.socials, instagram: e.target.value})} placeholder="@yourhandle" className="flex-1 bg-transparent text-sm font-bold outline-none placeholder-neutral-300" />
                                                </div>
                                                <div className="flex items-center gap-4 bg-neutral-50 p-3 rounded-lg border border-transparent focus-within:border-neutral-200 transition-all">
                                                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm text-black"><Globe size={16} /></div>
                                                    <input type="text" value={settings.socials?.website || ''} onChange={e => handleSettingChange('socials', {...settings.socials, website: e.target.value})} placeholder="https://yourwebsite.com" className="flex-1 bg-transparent text-sm font-bold outline-none placeholder-neutral-300" />
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex justify-end pt-8 border-t border-neutral-50">
                                            <button onClick={() => {saveSettings(); showToast("Profile Updated");}} className="px-8 py-3 bg-[#39FF14] text-black text-[10px] font-bold uppercase tracking-widest rounded-full shadow-lg hover:scale-105 transition-transform flex items-center gap-2">
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
                             <BusinessCalendar settings={settings} setSettings={setSettings} onSave={saveSettings} showToast={showToast} bookings={visibleBookings} />
                        </div>
                    )}

                    {activeTab === 'communications' && (
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10 lg:p-12 relative bg-[#FBFBFB]">
                            <header className="mb-8 md:mb-16">
                                <h2 className="text-4xl md:text-5xl font-serif font-bold tracking-tighter mb-4 text-black">Email Studio</h2>
                                <p className="text-neutral-400 font-medium text-lg">Write the emails your clients receive before and after a booking.</p>
                            </header>
                            <section className="max-w-6xl bg-white p-5 sm:p-6 md:p-10 rounded-lg border border-neutral-100 shadow-sm mb-8">
                                <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-8 mb-8">
                                    <div className="max-w-2xl">
                                        <div className={`w-11 h-11 rounded-lg flex items-center justify-center mb-5 ${isEmailConfigured(communications) ? 'bg-[#39FF14] text-black' : 'bg-neutral-100 text-neutral-400'}`}>
                                            <Mail size={18} />
                                        </div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-neutral-400 mb-3">Delivery Setup</p>
                                        <h3 className="text-2xl font-bold tracking-tight text-black mb-3">EmailJS Connection</h3>
                                        <p className="text-sm text-neutral-500 leading-relaxed">Use one universal EmailJS template for the free plan, or add separate template IDs per email type later. Business name, logo, banner, booking details, and your custom message are passed into every email.</p>
                                    </div>
                                    <div className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest ${isEmailConfigured(communications) ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                        {isEmailConfigured(communications) ? 'Ready To Send' : 'Needs Keys'}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                                    <div>
                                        <label className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 block mb-2 ml-2">Public Key</label>
                                        <input value={emailConfig.publicKey} onChange={(e) => handleEmailProviderChange('publicKey', e.target.value)} placeholder="EmailJS public key" className="w-full h-12 bg-neutral-50 border border-neutral-100 rounded-lg px-4 text-sm font-bold outline-none focus:bg-white focus:border-black transition-colors" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 block mb-2 ml-2">Service ID</label>
                                        <input value={emailConfig.serviceId} onChange={(e) => handleEmailProviderChange('serviceId', e.target.value)} placeholder="service_xxxxx" className="w-full h-12 bg-neutral-50 border border-neutral-100 rounded-lg px-4 text-sm font-bold outline-none focus:bg-white focus:border-black transition-colors" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 block mb-2 ml-2">Universal Template ID</label>
                                        <input value={emailConfig.universalTemplateId} onChange={(e) => handleEmailProviderChange('universalTemplateId', e.target.value)} placeholder="template_xxxxx" className="w-full h-12 bg-neutral-50 border border-neutral-100 rounded-lg px-4 text-sm font-bold outline-none focus:bg-white focus:border-black transition-colors" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 block mb-2 ml-2">Test Email</label>
                                        <input type="email" value={emailConfig.testEmail || ''} onChange={(e) => handleEmailProviderChange('testEmail', e.target.value)} placeholder="you@email.com" className="w-full h-12 bg-neutral-50 border border-neutral-100 rounded-lg px-4 text-sm font-bold outline-none focus:bg-white focus:border-black transition-colors" />
                                    </div>
                                </div>
                                <div className="rounded-lg bg-neutral-50 border border-neutral-100 p-4">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-3">Template Variables</p>
                                    <div className="flex flex-wrap gap-2">
                                        {['to_email', 'to_name', 'subject', 'message', 'business_name', 'business_logo', 'business_banner', 'booking_date', 'booking_time', 'running_late_minutes'].map(variable => (
                                            <span key={variable} className="px-3 py-1.5 rounded-md bg-white border border-neutral-100 text-[10px] font-bold text-neutral-500">{`{{${variable}}}`}</span>
                                        ))}
                                    </div>
                                </div>
                                <div className="mt-6 flex justify-end">
                                    <button onClick={() => { saveComms(communications); showToast('Email delivery settings saved'); }} className="h-11 px-5 rounded-lg bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-800 transition-colors">Save Delivery Setup</button>
                                </div>
                            </section>
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 max-w-6xl">
                                {[
                                    { key: 'confirmed', title: 'Request Confirmed', desc: 'Sent when you approve a booking request.' },
                                    { key: 'review', title: 'Thank You Follow-up', desc: 'Sent manually from a booking record after the appointment.' },
                                    { key: 'waitlist', title: 'Waitlist Alert', desc: 'Sent when manually triggering a waitlist spot.' },
                                    { key: 'runningLate', title: 'Running Late Email', desc: 'Sent when you need to let clients know you are behind schedule.' }
                                ].map(item => (
                                    <div key={item.key} className="bg-white p-5 sm:p-6 md:p-10 rounded-lg border border-neutral-100 shadow-sm relative group transition-all hover:shadow-xl">
                                        <div className="flex items-center justify-between mb-8">
                                            <div>
                                                <h3 className="text-xl font-bold tracking-tight">{item.title}</h3>
                                                <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mt-1">{item.desc}</p>
                                            </div>
                                            <button onClick={() => saveComms({...communications, [item.key]: {...communications[item.key], active: !communications[item.key].active}})} className={`w-14 h-8 rounded-full flex items-center px-1 transition-colors ${communications[item.key]?.active ? 'bg-[#39FF14]' : 'bg-neutral-200'}`}>
                                                <div className={`w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${communications[item.key]?.active ? 'translate-x-6' : ''}`} />
                                            </button>
                                        </div>
                                        <textarea 
                                            value={communications[item.key]?.text || ''} 
                                            onChange={(e) => setCommunications({...communications, [item.key]: {...communications[item.key], text: e.target.value}})}
                                            className="w-full bg-neutral-50 border-none rounded-lg p-6 text-sm font-medium focus:bg-white transition-all outline-none min-h-[120px] resize-none"
                                        />
                                        <div className="mt-5">
                                            <label className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 block mb-2 ml-2">Optional Specific Template ID</label>
                                            <input value={emailConfig.templates?.[item.key] || ''} onChange={(e) => handleEmailTemplateChange(item.key, e.target.value)} placeholder="Leave blank to use universal template" className="w-full h-11 bg-neutral-50 border border-neutral-100 rounded-lg px-4 text-xs font-bold outline-none focus:bg-white focus:border-black transition-colors" />
                                        </div>
                                        <div className="mt-6 flex flex-wrap justify-end gap-3">
                                            <button onClick={() => sendBookingEmail({
                                                clientName: 'Test Client',
                                                clientEmail: emailConfig.testEmail || '',
                                                clientPhone: '+27 00 000 0000',
                                                date: 'Today',
                                                time: '10:30'
                                            }, item.key)} className="px-6 py-2 bg-neutral-100 text-neutral-500 text-[10px] font-bold uppercase tracking-widest rounded-full hover:bg-neutral-200">Send Test</button>
                                            <button onClick={() => {saveComms(communications); showToast("Template Saved");}} className="px-6 py-2 bg-black text-white text-[10px] font-bold uppercase tracking-widest rounded-full hover:bg-neutral-800">Save</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'clients' && (
                        <div className="flex-1 overflow-y-auto bg-[#F6F7F9] p-4 sm:p-6 md:p-10 lg:p-12">
                            <header className="mb-8 flex flex-col xl:flex-row xl:items-end justify-between gap-6">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-neutral-400 mb-3">Client Book</p>
                                    <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-black">My Clients</h2>
                                    <p className="text-neutral-500 text-base md:text-lg mt-3 max-w-2xl">Profiles are built from bookings automatically, with space for notes, labels, photos, and manual walk-ins.</p>
                                </div>
                                <button onClick={() => { saveClients(clientRecords); showToast("Client book saved"); }} className="h-11 px-5 rounded-lg bg-black text-white text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors shadow-xl shadow-black/10 w-full sm:w-auto">
                                    <Check size={15}/> Save Client Book
                                </button>
                            </header>

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                                {[
                                    { label: 'Client Profiles', value: clientMetrics.total, hint: bookings.length ? 'Live records' : 'Sample data', icon: Users },
                                    { label: 'Regulars', value: clientMetrics.regulars, hint: 'Auto + VIP', icon: Star },
                                    { label: 'First Timers', value: clientMetrics.firstTimers, hint: 'Auto detected', icon: Sparkles },
                                    { label: 'Enriched', value: clientMetrics.enriched, hint: 'Notes / labels / photos', icon: Tag }
                                ].map(metric => {
                                    const IconCmp = metric.icon;
                                    return (
                                        <div key={metric.label} className="saas-card p-5">
                                            <div className="flex items-start justify-between mb-7">
                                                <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center text-black"><IconCmp size={17}/></div>
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 bg-neutral-100 px-2.5 py-1 rounded-md">{metric.hint}</span>
                                            </div>
                                            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-400 mb-2">{metric.label}</p>
                                            <p className="metric-value text-3xl font-bold tracking-tight text-black">{metric.value}</p>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                                <section className="xl:col-span-5 space-y-6">
                                    <div className="saas-card overflow-hidden">
                                        <div className="p-5 md:p-6 border-b border-neutral-100">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
                                                <div>
                                                    <h3 className="text-lg font-bold tracking-tight text-black">Client Directory</h3>
                                                    <p className="text-sm text-neutral-500">{filteredClients.length} shown from {clientDirectory.length} profiles.</p>
                                                </div>
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-md">Auto Synced</span>
                                            </div>
                                            <div className="relative">
                                                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-300" />
                                                <input
                                                    value={clientSearch}
                                                    onChange={(event) => setClientSearch(event.target.value)}
                                                    placeholder="Search name, phone, label"
                                                    className="w-full h-12 bg-neutral-50 border border-neutral-100 rounded-lg pl-11 pr-4 text-sm font-bold outline-none text-black focus:bg-white focus:border-black transition-colors"
                                                />
                                            </div>
                                        </div>
                                        <div className="max-h-[640px] overflow-y-auto divide-y divide-neutral-100">
                                            {filteredClients.length === 0 ? (
                                                <div className="p-12 text-center">
                                                    <div className="w-14 h-14 rounded-lg bg-neutral-100 flex items-center justify-center mx-auto mb-5 text-neutral-400"><Users size={22}/></div>
                                                    <h3 className="text-lg font-bold tracking-tight text-black mb-2">No clients found</h3>
                                                    <p className="text-sm text-neutral-500">Try another search or add someone manually.</p>
                                                </div>
                                            ) : filteredClients.map(client => {
                                                const allLabels = Array.from(new Set([...(client.autoLabels || []), ...(client.labels || [])])).slice(0, 3);
                                                const isActive = selectedClient?.id === client.id;
                                                return (
                                                    <button
                                                        key={client.id}
                                                        onClick={() => setSelectedClientId(client.id)}
                                                        className={`w-full text-left p-5 transition-all ${isActive ? 'bg-black text-white' : 'hover:bg-neutral-50 text-black'}`}
                                                    >
                                                        <div className="flex items-start gap-4">
                                                            <div className={`w-14 h-14 rounded-lg overflow-hidden flex items-center justify-center font-bold text-xl shrink-0 ${isActive ? 'bg-white text-black' : 'bg-neutral-100 text-black'}`}>
                                                                {client.avatar ? <img src={client.avatar} className="w-full h-full object-cover" /> : (client.name || '?').charAt(0)}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-start justify-between gap-3 mb-1">
                                                                    <h4 className="text-lg font-bold tracking-tight truncate">{client.name}</h4>
                                                                    <span className={`metric-value text-sm font-bold shrink-0 ${isActive ? 'text-[#39FF14]' : 'text-black'}`}>{client.bookingCount}</span>
                                                                </div>
                                                                <p className={`text-sm truncate mb-3 ${isActive ? 'text-white/55' : 'text-neutral-500'}`}>{client.phone || client.email || 'Manual profile'}</p>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {allLabels.map(label => (
                                                                        <span key={label} className={`px-2 py-1 rounded-md text-[8px] font-bold uppercase tracking-widest ${isActive ? 'bg-white/10 text-white' : label === 'Regular' || label === 'VIP' ? 'bg-[#39FF14] text-black' : 'bg-neutral-100 text-neutral-500'}`}>{label}</span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <section className="saas-panel p-5 md:p-6">
                                        <div className="flex items-start justify-between gap-4 mb-6">
                                            <div>
                                                <h3 className="text-lg font-bold tracking-tight text-black">Add Client</h3>
                                                <p className="text-sm text-neutral-500">Create a profile for walk-ins, DMs, or referrals.</p>
                                            </div>
                                            <div className="w-10 h-10 rounded-lg bg-black text-white flex items-center justify-center shrink-0"><UserPlus size={16}/></div>
                                        </div>
                                        <form onSubmit={handleManualClientSubmit} className="space-y-4">
                                            <div>
                                                <label className="text-[9px] font-bold uppercase tracking-[0.25em] text-neutral-400 block mb-2">Name</label>
                                                <input name="clientName" type="text" placeholder="Lena Vale" required className="w-full h-12 bg-white border border-neutral-200 rounded-lg px-4 text-sm font-bold outline-none text-black focus:border-black transition-colors" />
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

                                <section className="xl:col-span-7 space-y-6">
                                    {selectedClient ? (() => {
                                        const allLabels = Array.from(new Set([...(selectedClient.autoLabels || []), ...(selectedClient.labels || [])]));
                                        return (
                                            <>
                                                <div className="saas-card p-5 md:p-6 overflow-hidden relative">
                                                    <div className="absolute top-0 left-0 right-0 h-1 bg-[#39FF14]" />
                                                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mb-8">
                                                        <div className="flex items-start gap-5 min-w-0">
                                                            <div className="relative shrink-0">
                                                                <div className="w-24 h-24 rounded-lg bg-black text-[#39FF14] overflow-hidden flex items-center justify-center text-4xl font-bold shadow-inner">
                                                                    {selectedClient.avatar ? <img src={selectedClient.avatar} className="w-full h-full object-cover" /> : selectedClient.name.charAt(0)}
                                                                </div>
                                                                <label className="absolute -right-2 -bottom-2 w-10 h-10 rounded-lg bg-white border border-neutral-200 shadow-xl flex items-center justify-center cursor-pointer hover:bg-neutral-50 transition-colors" title="Upload profile picture">
                                                                    <Camera size={16} />
                                                                    <input type="file" accept="image/*" className="hidden" onChange={(event) => {
                                                                        handleClientAvatarUpload(selectedClient.id, event.target.files[0]);
                                                                        event.target.value = '';
                                                                    }} />
                                                                </label>
                                                            </div>
                                                            <div className="min-w-0 pt-1">
                                                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                                                    <h3 className="text-3xl md:text-4xl font-bold tracking-tight text-black truncate">{selectedClient.name}</h3>
                                                                    {selectedClient.autoLabels?.includes('Regular') && <span className="px-2.5 py-1 rounded-md bg-[#39FF14] text-black text-[9px] font-bold uppercase tracking-widest">Regular</span>}
                                                                </div>
                                                                <p className="text-sm text-neutral-500 mb-4">{selectedClient.bookingCount ? `${selectedClient.bookingCount} booking${selectedClient.bookingCount === 1 ? '' : 's'} on file` : 'Manual client profile'}</p>
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
                                                            <p className="text-sm font-bold text-black truncate">{selectedClient.phone || 'Not added'}</p>
                                                        </div>
                                                        <div className="rounded-lg bg-neutral-50 border border-neutral-100 p-4 min-w-0">
                                                            <div className="flex items-center gap-2 text-neutral-400 mb-2"><Mail size={14}/><span className="text-[9px] font-bold uppercase tracking-widest">Email</span></div>
                                                            <p className="text-sm font-bold text-black truncate">{selectedClient.email || 'Not added'}</p>
                                                        </div>
                                                        <div className="rounded-lg bg-neutral-50 border border-neutral-100 p-4 min-w-0">
                                                            <div className="flex items-center gap-2 text-neutral-400 mb-2"><Calendar size={14}/><span className="text-[9px] font-bold uppercase tracking-widest">Last Visit</span></div>
                                                            <p className="text-sm font-bold text-black truncate">{selectedClient.lastBooking ? `${selectedClient.lastBooking.date} / ${selectedClient.lastBooking.time}` : 'No booking yet'}</p>
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
                                                            value={clientNoteDraft}
                                                            onChange={(event) => setClientNoteDraft(event.target.value)}
                                                            placeholder="Example: prefers morning slots, likes WhatsApp reminders, allergic to latex..."
                                                            className="w-full min-h-[190px] bg-neutral-50 border border-neutral-100 rounded-lg p-4 text-sm font-medium outline-none resize-none focus:bg-white focus:border-black transition-colors"
                                                        />
                                                        <button onClick={() => { upsertClientRecord(selectedClient.id, { notes: clientNoteDraft }); showToast("Client notes saved"); }} className="mt-4 w-full h-11 rounded-lg bg-black text-white flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-800 transition-colors">
                                                            <Check size={15}/> Save Notes
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
                                                                const active = selectedClient.labels?.includes(label);
                                                                return (
                                                                    <button
                                                                        key={label}
                                                                        onClick={() => toggleClientLabel(selectedClient, label)}
                                                                        className={`w-full h-12 rounded-lg px-4 flex items-center justify-between gap-4 text-sm font-bold transition-colors ${active ? 'bg-black text-white shadow-xl shadow-black/10' : 'bg-white border border-neutral-200 text-neutral-600 hover:text-black hover:border-black'}`}
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
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 bg-neutral-100 px-3 py-1.5 rounded-md">{selectedClient.bookingCount} Records</span>
                                                    </div>
                                                    <div className="divide-y divide-neutral-100">
                                                        {selectedClient.bookings.length ? selectedClient.bookings.map(booking => {
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
                                    })() : (
                                        <div className="saas-card p-12 text-center">
                                            <div className="w-14 h-14 rounded-lg bg-neutral-100 flex items-center justify-center mx-auto mb-5 text-neutral-400"><Users size={22}/></div>
                                            <h3 className="text-lg font-bold tracking-tight text-black mb-2">No clients yet</h3>
                                            <p className="text-sm text-neutral-500">New bookings and manually added clients will appear here.</p>
                                        </div>
                                    )}
                                </section>
                            </div>
                        </div>
                    )}

                    {activeTab === 'staff' && (
                        <div className="flex-1 overflow-y-auto bg-[#F6F7F9] p-4 sm:p-6 md:p-10 lg:p-12">
                            <header className="mb-8 flex flex-col xl:flex-row xl:items-end justify-between gap-6">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-neutral-400 mb-3">Team Studio</p>
                                    <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-black">Team</h2>
                                    <p className="text-neutral-500 text-base md:text-lg mt-3 max-w-2xl">Manage who can handle bookings, assign clients, and keep your calendar moving.</p>
                                </div>
                                <button onClick={() => { saveStaff(staffList); showToast("Team setup saved"); }} className="h-11 px-5 rounded-lg bg-black text-white text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors shadow-xl shadow-black/10 w-full sm:w-auto">
                                    <Check size={15}/> Save Team Setup
                                </button>
                            </header>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                {[
                                    { label: 'Team Members', value: staffList.length, hint: 'Active roster', icon: Users },
                                    { label: 'Owners', value: staffList.filter(staff => staff.id === 'owner').length, hint: 'Admin access', icon: ShieldCheck },
                                    { label: 'Assignable', value: staffList.filter(staff => staff.id !== 'owner').length, hint: 'Booking staff', icon: Briefcase }
                                ].map(metric => {
                                    const IconCmp = metric.icon;
                                    return (
                                        <div key={metric.label} className="saas-card p-5">
                                            <div className="flex items-start justify-between mb-7">
                                                <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center text-black"><IconCmp size={17}/></div>
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 bg-neutral-100 px-2.5 py-1 rounded-md">{metric.hint}</span>
                                            </div>
                                            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-400 mb-2">{metric.label}</p>
                                            <p className="metric-value text-3xl font-bold tracking-tight text-black">{metric.value}</p>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                                <section className="xl:col-span-8 saas-card overflow-hidden">
                                    <div className="p-5 md:p-6 border-b border-neutral-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div>
                                            <h3 className="text-lg font-bold tracking-tight text-black">Roster</h3>
                                            <p className="text-sm text-neutral-500">People visible in booking assignment controls.</p>
                                        </div>
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-md">{staffList.length} Active</span>
                                    </div>
                                    <div className="p-4 md:p-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {staffList.map((staff, index) => {
                                            const initials = (staff.name || 'Team Member').split(' ').map(part => part.charAt(0)).join('').slice(0, 2).toUpperCase();
                                            const assignedBookings = visibleBookings.filter(b => b.staffId === staff.id).length;
                                            return (
                                                <div key={staff.id} className="group relative overflow-hidden rounded-lg border border-neutral-100 bg-neutral-50/70 p-5 transition-all hover:bg-white hover:border-neutral-200 hover:shadow-xl">
                                                    <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: staff.color || '#000000' }} />
                                                    <div className="flex items-start justify-between gap-4 mb-6">
                                                        <div className="flex items-center gap-4 min-w-0">
                                                            <div className="w-14 h-14 rounded-lg shadow-inner flex items-center justify-center font-bold text-white text-lg shrink-0" style={{ backgroundColor: staff.color || '#000000' }}>{initials}</div>
                                                            <div className="min-w-0">
                                                                <h4 className="font-bold text-lg text-black truncate">{staff.name}</h4>
                                                                <p className="text-sm text-neutral-500 truncate">{staff.id === 'owner' ? 'Workspace owner' : staff.email}</p>
                                                            </div>
                                                        </div>
                                                        {staff.id !== 'owner' ? (
                                                            <button onClick={() => saveStaff(staffList.filter(s => s.id !== staff.id))} className="w-9 h-9 rounded-lg flex items-center justify-center text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
                                                                <Trash2 size={16} />
                                                            </button>
                                                        ) : (
                                                            <div className="w-9 h-9 rounded-lg bg-[#39FF14] text-black flex items-center justify-center shrink-0"><ShieldCheck size={16}/></div>
                                                        )}
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="rounded-lg bg-white border border-neutral-100 p-3">
                                                            <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-1">Role</p>
                                                            <p className="text-sm font-bold text-black">{staff.id === 'owner' ? 'Admin' : 'Staff'}</p>
                                                        </div>
                                                        <div className="rounded-lg bg-white border border-neutral-100 p-3">
                                                            <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-1">Bookings</p>
                                                            <p className="text-sm font-bold text-black">{assignedBookings || (index === 0 ? visibleBookings.filter(b => !b.staffId || b.staffId === 'owner').length : 0)}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>

                                <aside className="xl:col-span-4 space-y-6">
                                    <section className="saas-panel p-5 md:p-6">
                                        <div className="flex items-start justify-between gap-4 mb-6">
                                            <div>
                                                <h3 className="text-lg font-bold tracking-tight text-black">Add Teammate</h3>
                                                <p className="text-sm text-neutral-500">Create a roster profile for booking assignment.</p>
                                            </div>
                                            <div className="w-10 h-10 rounded-lg bg-black text-white flex items-center justify-center shrink-0"><Plus size={16}/></div>
                                        </div>
                                        <form onSubmit={(e) => {
                                            e.preventDefault();
                                            const name = e.target.name.value.trim();
                                            const email = e.target.email.value.trim();
                                            const color = e.target.color.value;
                                            if(name && email) {
                                                saveStaff([...staffList, { id: Date.now().toString(), name, email, color }]);
                                                e.target.reset();
                                                showToast("Staff Added");
                                            }
                                        }} className="space-y-4">
                                            <div>
                                                <label className="text-[9px] font-bold uppercase tracking-[0.25em] text-neutral-400 block mb-2">Name</label>
                                                <input name="name" type="text" placeholder="Ari Carter" required className="w-full h-12 bg-white border border-neutral-200 rounded-lg px-4 text-sm font-bold outline-none text-black focus:border-black transition-colors" />
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-bold uppercase tracking-[0.25em] text-neutral-400 block mb-2">Email</label>
                                                <input name="email" type="email" placeholder="ari@studio.com" required className="w-full h-12 bg-white border border-neutral-200 rounded-lg px-4 text-sm font-bold outline-none text-black focus:border-black transition-colors" />
                                            </div>
                                            <div className="flex items-center justify-between gap-4 rounded-lg bg-white border border-neutral-200 p-3">
                                                <div>
                                                    <label className="text-[9px] font-bold uppercase tracking-[0.25em] text-neutral-400 block mb-1">Profile Color</label>
                                                    <p className="text-sm font-bold text-black">Used on booking cards</p>
                                                </div>
                                                <input name="color" type="color" defaultValue="#39FF14" className="w-12 h-12 rounded-lg cursor-pointer bg-transparent border-none p-0 outline-none" />
                                            </div>
                                            <button type="submit" className="w-full h-12 bg-black text-white rounded-lg flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-800 transition-colors shadow-xl shadow-black/10">
                                                <Plus size={15} /> Add Member
                                            </button>
                                        </form>
                                    </section>

                                    <section className="saas-card p-5">
                                        <div className="flex items-center justify-between mb-5">
                                            <h3 className="text-lg font-bold tracking-tight text-black">Assignment Ready</h3>
                                            <span className="w-2.5 h-2.5 rounded-full bg-[#39FF14] shadow-[0_0_0_4px_rgba(57,255,20,0.16)]" />
                                        </div>
                                        <div className="space-y-3">
                                            {[
                                                ['Owner profile', staffList.some(staff => staff.id === 'owner') ? 'Ready' : 'Missing'],
                                                ['Booking dropdown', staffList.length ? 'Connected' : 'Empty'],
                                                ['Team colors', staffList.filter(staff => staff.color).length ? 'Configured' : 'Needs setup']
                                            ].map(row => (
                                                <div key={row[0]} className="flex items-center justify-between gap-4 text-sm">
                                                    <span className="text-neutral-500">{row[0]}</span>
                                                    <span className="font-bold text-black">{row[1]}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                </aside>
                            </div>
                        </div>
                    )}

                    {activeTab === 'editor' && (
                    <div className="flex-1 flex overflow-hidden mobile-editor-shell bg-[#F5F5F7]">
                        <div className="mobile-editor-rotate-prompt md:hidden absolute inset-x-4 top-4 z-[150] rounded-lg border border-black/10 bg-black text-white p-4 shadow-2xl items-start gap-3">
                            <RefreshCw size={18} className="text-[#39FF14] shrink-0 mt-0.5" />
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest mb-1">Rotate For Editor</p>
                                <p className="text-xs text-white/65 leading-relaxed">Turn your phone sideways for the live preview workspace. You can still edit settings here in portrait.</p>
                            </div>
                        </div>
                        <div className={`mobile-editor-panel transition-all duration-700 ease-in-out bg-white border-r border-neutral-100 flex flex-col shadow-2xl relative z-40 overflow-hidden ${editorCollapsed ? 'w-0 opacity-0' : 'w-full md:w-[600px] lg:w-[700px]'}`}>
                        {!editorCollapsed && (
                            <>
                            <header className="p-5 sm:p-6 md:p-10 border-b border-neutral-50 flex flex-col md:flex-row items-start md:items-center justify-between flex-shrink-0 gap-4 md:gap-6">
                                <h2 className="text-3xl md:text-4xl font-serif font-bold tracking-tighter text-black">Editor</h2>
                                <div className="flex bg-neutral-100 p-1.5 rounded-full overflow-x-auto w-full md:w-auto no-scrollbar">
                                {['identity', 'themes', 'visuals', 'features', 'copy'].map(tab => (
                                    <button key={tab} onClick={() => setEditorTab(tab)} className={`px-5 py-2 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${editorTab === tab ? 'bg-white text-black shadow-sm' : 'text-neutral-400 hover:text-black'}`}>{tab}</button>
                                ))}
                                </div>
                            </header>

                            <div className="flex-1 overflow-y-auto p-5 sm:p-6 md:p-12 space-y-10 md:space-y-12 no-scrollbar">
                                {editorTab === 'identity' && (
                                <div className="space-y-10 animate-in fade-in duration-700">
                                    <div className="space-y-5">
                                    <label className="text-[10px] font-bold uppercase tracking-[0.5em] text-neutral-300 block">Booking Page Media</label>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        <div className="bg-neutral-50 rounded-lg border border-neutral-100/70 p-4 md:p-5">
                                            <div className="flex items-center gap-4 mb-5">
                                                <div className="w-16 h-16 rounded-lg bg-white border border-neutral-100 shadow-inner flex items-center justify-center overflow-hidden shrink-0">
                                                    {settings.logo ? <img src={settings.logo} className="w-full h-full object-cover" /> : <User size={20} className="text-neutral-300" />}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-black">Business Logo</p>
                                                    <p className="text-xs text-neutral-400 leading-relaxed">Shared with Business Profile.</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
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
                                        <div className="bg-neutral-50 rounded-lg border border-neutral-100/70 p-4 md:p-5">
                                            <div className="w-full aspect-[16/7] rounded-lg bg-white border border-neutral-100 shadow-inner flex items-center justify-center overflow-hidden mb-5">
                                                {settings.bannerImage ? <img src={settings.bannerImage} className="w-full h-full object-cover" /> : <div className="text-center px-4"><Monitor size={22} className="mx-auto text-neutral-300" /><p className="text-[10px] font-bold uppercase tracking-widest text-neutral-300 mt-2">Optional Banner</p></div>}
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <label className="h-10 px-4 rounded-lg bg-black text-white text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2">
                                                    <Camera size={14}/> Upload Banner
                                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                                                        const file = e.target.files[0];
                                                        handleSettingImageUpload('bannerImage', file, 'brand');
                                                        e.target.value = '';
                                                    }}/>
                                                </label>
                                                {settings.bannerImage && <button onClick={() => handleSettingChange('bannerImage', '')} className="h-10 px-4 rounded-lg bg-white border border-neutral-200 text-red-500 text-[10px] font-bold uppercase tracking-widest hover:bg-red-50 transition-colors">Remove</button>}
                                            </div>
                                            <p className="text-xs text-neutral-400 font-medium mt-3">Landscape image shown above the booking page heading.</p>
                                        </div>
                                    </div>
                                    </div>
                                    <div className="space-y-5">
                                    <label className="text-[10px] font-bold uppercase tracking-[0.5em] text-neutral-300 block">Business Details</label>
                                    <input type="text" value={settings.brandName} onChange={(e) => handleSettingChange('brandName', e.target.value)} className="w-full bg-neutral-50 border-none rounded-lg px-5 md:px-8 py-4 md:py-6 text-lg md:text-xl font-bold focus:bg-white transition-all outline-none border border-transparent focus:border-neutral-100 text-black shadow-inner" placeholder="Studio Title" />
                                    <input type="text" value={settings.tagline} onChange={(e) => handleSettingChange('tagline', e.target.value)} className="w-full bg-neutral-50 border-none rounded-lg px-5 md:px-8 py-4 md:py-6 text-[11px] md:text-xs font-bold uppercase tracking-[0.25em] md:tracking-[0.5em] focus:bg-white transition-all outline-none border border-transparent focus:border-neutral-100 text-black shadow-inner" placeholder="Tagline" />
                                    <textarea value={settings.welcomeMessage} onChange={(e) => handleSettingChange('welcomeMessage', e.target.value)} className="w-full bg-neutral-50 border-none rounded-lg px-5 md:px-8 py-4 md:py-6 text-sm font-medium focus:bg-white transition-all outline-none min-h-[120px] md:min-h-[140px] border border-transparent focus:border-neutral-100 text-black shadow-inner resize-none" placeholder="Welcome Sequence" />
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
                                    <div className="space-y-5 pt-10 border-t border-neutral-50">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-[0.5em] text-neutral-300 block mb-2">Backend Skin</label>
                                            <p className="text-sm text-neutral-400 font-medium leading-relaxed max-w-md">Match the workspace to this booking page theme.</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleBackendSkinChange('enabled', !backendSkinEnabled)}
                                            className={`w-16 h-9 rounded-full flex items-center px-1 transition-all shadow-inner ${backendSkinEnabled ? 'bg-black' : 'bg-neutral-200'}`}
                                            style={backendSkinEnabled ? { backgroundColor: settings.primaryColor } : undefined}
                                            aria-pressed={backendSkinEnabled}
                                        >
                                            <span className={`w-7 h-7 rounded-full bg-white shadow-lg transition-transform ${backendSkinEnabled ? 'translate-x-7' : ''}`} />
                                        </button>
                                    </div>

                                    <div
                                        className={`relative overflow-hidden rounded-lg border p-5 md:p-6 transition-all ${backendSkinEnabled ? 'shadow-2xl' : 'opacity-70'}`}
                                        style={{
                                            backgroundColor: settings.backgroundColor || '#FFFFFF',
                                            color: settings.headingColor || '#000000',
                                            borderColor: rgbaFromHex(settings.headingColor, 0.16),
                                            fontFamily: getFontFamily(settings.bodyFontFamily || settings.fontFamily)
                                        }}
                                    >
                                        {settings.bannerImage && (
                                            <div className="absolute inset-x-0 top-0 h-24 bg-cover bg-center opacity-25" style={{ backgroundImage: `url(${settings.bannerImage})` }} />
                                        )}
                                        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                                            <div className="flex items-center gap-4 min-w-0">
                                                <div
                                                    className="w-14 h-14 rounded-lg overflow-hidden flex items-center justify-center font-bold text-xl shrink-0 shadow-xl"
                                                    style={{ backgroundColor: settings.headingColor || '#000000', color: readableTextFor(settings.headingColor || '#000000') }}
                                                >
                                                    {settings.logo ? <img src={settings.logo} className="w-full h-full object-cover" /> : (settings.brandName?.charAt(0) || 'B')}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[9px] font-bold uppercase tracking-[0.35em] opacity-50 mb-1">Workspace Preview</p>
                                                    <h3 className="text-2xl font-bold tracking-tight truncate" style={{ fontFamily: getFontFamily(settings.headingFontFamily || settings.fontFamily) }}>{settings.brandName || 'Your Business'}</h3>
                                                    <p className="text-xs font-bold uppercase tracking-widest opacity-55 truncate">{settings.tagline || 'Booking workspace'}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <span className="h-10 px-4 rounded-lg flex items-center justify-center text-[10px] font-bold uppercase tracking-widest" style={{ backgroundColor: settings.primaryColor || '#39FF14', color: settings.buttonTextColor || readableTextFor(settings.primaryColor || '#39FF14') }}>Live Skin</span>
                                                <span className="h-10 w-10 rounded-lg border flex items-center justify-center" style={{ borderColor: rgbaFromHex(settings.headingColor, 0.18), color: settings.headingColor || '#000000' }}><Palette size={15} /></span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {[
                                            { id: 'immersive', label: 'Exact Match', note: 'Theme colors and fonts' },
                                            { id: 'soft', label: 'Soft Match', note: 'Branded but calmer' }
                                        ].map(option => {
                                            const isActive = backendSkinMode === option.id;
                                            return (
                                                <button
                                                    key={option.id}
                                                    type="button"
                                                    onClick={() => handleBackendSkinChange('mode', option.id)}
                                                    className={`p-4 rounded-lg border text-left transition-all ${isActive ? 'bg-black text-white border-black shadow-xl' : 'bg-neutral-50 text-black border-transparent hover:border-neutral-200'}`}
                                                >
                                                    <div className="flex items-center justify-between gap-3 mb-3">
                                                        <span className="text-xs font-bold uppercase tracking-widest">{option.label}</span>
                                                        <span className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-[#39FF14]' : 'bg-neutral-300'}`} />
                                                    </div>
                                                    <p className={`text-xs font-medium ${isActive ? 'text-white/60' : 'text-neutral-400'}`}>{option.note}</p>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleBackendSkinChange('showBranding', !backendSkinShowBranding)}
                                        className={`w-full p-4 rounded-lg border flex items-center justify-between gap-4 transition-all ${backendSkinShowBranding ? 'bg-neutral-50 border-neutral-100 text-black' : 'bg-white border-neutral-100 text-neutral-400'}`}
                                    >
                                        <span className="flex items-center gap-3 text-left">
                                            <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${backendSkinShowBranding ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-400'}`}><Sparkles size={15} /></span>
                                            <span>
                                                <span className="block text-sm font-bold">Business identity panel</span>
                                                <span className="block text-xs font-medium opacity-50">Logo and banner card in the left panel</span>
                                            </span>
                                        </span>
                                        <span className={`w-12 h-7 rounded-full flex items-center px-1 transition-all ${backendSkinShowBranding ? 'bg-[#39FF14]' : 'bg-neutral-200'}`}>
                                            <span className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${backendSkinShowBranding ? 'translate-x-5' : ''}`} />
                                        </span>
                                    </button>
                                    </div>
                                </div>
                                )}

                                {editorTab === 'themes' && (
                                <div className="space-y-12 animate-in fade-in duration-700">
                                    <div>
                                        <div className="flex items-center justify-between gap-4 mb-6">
                                            <label className="text-[10px] font-bold uppercase tracking-[0.5em] text-neutral-300 block">Designer Theme Library</label>
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-black bg-neutral-100 px-3 py-1.5 rounded-full">{visibleThemes.length} / {PRESET_THEMES.length}</span>
                                        </div>
                                        <div className="mb-7">
                                            <div className="flex items-center justify-between mb-3">
                                                <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">Browse By Palette</p>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-300">{themePaletteOptions.find(p => p.id === themePalette)?.hint}</p>
                                                    <div className="flex items-center gap-1.5">
                                                        <button type="button" onClick={() => scrollThemePaletteRail(-1)} title="Previous palettes" className="w-8 h-8 rounded-full bg-white border border-neutral-100 text-neutral-400 hover:text-black hover:border-neutral-300 shadow-sm flex items-center justify-center transition-all">
                                                            <ChevronLeft size={15} />
                                                        </button>
                                                        <button type="button" onClick={() => scrollThemePaletteRail(1)} title="Next palettes" className="w-8 h-8 rounded-full bg-black text-white shadow-lg flex items-center justify-center hover:scale-105 transition-all">
                                                            <ChevronRight size={15} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div ref={themePaletteRailRef} className="overflow-x-auto no-scrollbar pb-2 scroll-smooth snap-x snap-mandatory">
                                                <div className="flex gap-3 min-w-max">
                                                    {themePaletteOptions.map(palette => {
                                                        const isActive = themePalette === palette.id;
                                                        return (
                                                            <button key={palette.id} onClick={() => setThemePalette(palette.id)} className={`group w-36 p-3 rounded-lg border text-left transition-all snap-start ${isActive ? 'bg-black text-white border-black shadow-xl' : 'bg-white text-black border-neutral-100 hover:border-neutral-300 hover:-translate-y-0.5'}`}>
                                                                <div className="flex items-center mb-4">
                                                                    {palette.swatches.map((color, i) => (
                                                                        <span key={color} className={`w-7 h-7 rounded-full border ${isActive ? 'border-white/30' : 'border-black/10'} ${i > 0 ? '-ml-2' : ''}`} style={{ backgroundColor: color }} />
                                                                    ))}
                                                                </div>
                                                                <div className="flex items-end justify-between gap-2">
                                                                    <div className="min-w-0">
                                                                        <p className="text-[11px] font-bold uppercase tracking-widest truncate">{palette.name}</p>
                                                                        <p className={`text-[9px] font-bold uppercase tracking-widest mt-1 truncate ${isActive ? 'text-white/45' : 'text-neutral-300'}`}>{palette.hint}</p>
                                                                    </div>
                                                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${isActive ? 'bg-white text-black' : 'bg-neutral-100 text-neutral-500'}`}>{palette.count}</span>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[560px] overflow-y-auto pr-2 pb-4 no-scrollbar">
                                            {visibleThemes.map(t => (
                                                <button key={t.id} onClick={() => applyTheme(t.id)} className="group relative p-6 rounded-lg border transition-all overflow-hidden text-left flex flex-col justify-between" style={{ backgroundColor: t.backgroundColor, borderColor: (t.headingColor || '#000') + '15', boxShadow: settings.primaryColor === t.primaryColor && settings.backgroundColor === t.backgroundColor ? `0 0 0 2px ${t.primaryColor}` : '0 4px 15px rgba(0,0,0,0.05)' }}>
                                                    <div className="flex items-center justify-between w-full mb-6">
                                                        <span className="text-[9px] font-bold uppercase tracking-widest truncate max-w-[70%]" style={{ color: t.bodyColor }}>{t.name}</span>
                                                        <div className="flex gap-1.5 shrink-0">
                                                            <div className="w-3.5 h-3.5 rounded-full shadow-sm border border-black/5" style={{ backgroundColor: t.primaryColor }} />
                                                            <div className="w-3.5 h-3.5 rounded-full shadow-sm border border-black/5" style={{ backgroundColor: t.headingColor }} />
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="space-y-4 w-full">
                                                        <h4 className="text-3xl font-bold tracking-tighter" style={{ color: t.headingColor, fontFamily: getFontFamily(t.fontFamily) }}>Aa Bb</h4>
                                                        
                                                        <div className="flex gap-2 w-full pt-2">
                                                            <div className="h-8 flex-1 flex items-center justify-center text-[8px] font-bold shadow-sm" style={{ 
                                                                backgroundColor: t.availabilityStyle === 'solid' ? t.slotBgColor : (t.availabilityStyle === 'outline' ? 'transparent' : 'transparent'), 
                                                                color: t.availabilityStyle === 'minimal' ? t.headingColor : t.slotTextColor, 
                                                                borderRadius: t.buttonStyle === 'pill' ? '12px' : '4px', 
                                                                border: t.availabilityStyle === 'outline' ? `1px solid ${t.primaryColor}50` : 'none' 
                                                            }}>12:00</div>
                                                            <div className="h-8 flex-1 flex items-center justify-center text-[8px] font-bold uppercase tracking-widest shadow-md" style={{ 
                                                                backgroundColor: t.primaryColor, 
                                                                color: t.buttonTextColor || '#000', 
                                                                borderRadius: t.buttonStyle === 'pill' ? '99px' : '4px' 
                                                            }}>Action</div>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="pt-10 border-t border-neutral-50">
                                        <label className="text-[10px] font-bold uppercase tracking-[0.5em] text-neutral-300 block mb-6">Typography Engine</label>
                                        <div className="space-y-8">
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
                                    <div className="pt-10 border-t border-neutral-50">
                                        <label className="text-[10px] font-bold uppercase tracking-[0.5em] text-neutral-300 block mb-6">Time Slot Style</label>
                                        <div className="grid grid-cols-3 gap-4">
                                            {['minimal', 'outline', 'solid'].map(s => (
                                                <button key={s} onClick={() => handleSettingChange('availabilityStyle', s)} className={`py-5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all border ${settings.availabilityStyle === s ? 'bg-black text-white border-black shadow-lg' : 'bg-neutral-50 text-neutral-400 border-transparent hover:bg-neutral-100'}`}>
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                )}

                                {editorTab === 'visuals' && (
                                <div className="space-y-10 animate-in fade-in duration-700 pb-10">
                                    <label className="text-[10px] font-bold uppercase tracking-[0.5em] text-neutral-300 block">Colors And Fonts</label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {[
                                        { label: 'Accent', key: 'primaryColor' },
                                        { label: 'Background', key: 'backgroundColor' },
                                        { label: 'Heading Text', key: 'headingColor', fontKey: 'headingFontFamily' },
                                        { label: 'Body Text', key: 'bodyColor', fontKey: 'bodyFontFamily' },
                                        { label: 'Button Text', key: 'buttonTextColor', fontKey: 'buttonFontFamily' },
                                        { label: 'Time Box Bg', key: 'slotBgColor' },
                                        { label: 'Time Box Text', key: 'slotTextColor', fontKey: 'slotFontFamily' },
                                        { label: 'Date Bg', key: 'dateBgColor' },
                                        { label: 'Date Text', key: 'dateTextColor', fontKey: 'dateFontFamily' },
                                        { label: 'Date Active Bg', key: 'dateActiveBgColor' },
                                        { label: 'Date Active Text', key: 'dateActiveTextColor', fontKey: 'dateFontFamily' }
                                        ].map(item => (
                                        <div key={item.key} className="flex flex-col bg-neutral-50 p-4 rounded-lg group relative border border-neutral-100/50 hover:border-neutral-200 transition-all">
                                            <div className="flex items-center gap-4 w-full">
                                                <label className="cursor-pointer flex-shrink-0">
                                                <div className="w-12 h-12 rounded-[1rem] shadow-sm border border-black/5 hover:scale-110 transition-transform overflow-hidden relative" style={{ backgroundColor: settings[item.key] || (item.key.includes('Bg') ? 'transparent' : '#000') }}>
                                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 backdrop-blur-sm">
                                                        <Pipette size={16} className="text-white drop-shadow-md" />
                                                    </div>
                                                </div>
                                                <input type="color" className="sr-only" value={settings[item.key] || (item.key.includes('Bg') ? '#ffffff' : '#000000')} onChange={(e) => handleSettingChange(item.key, e.target.value)} />
                                                </label>
                                                <div className="flex-1 min-w-0">
                                                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-400 mb-1 truncate">{item.label}</p>
                                                <input type="text" value={settings[item.key] || (item.key.includes('Bg') ? 'transparent' : '#000')} onChange={(e) => handleSettingChange(item.key, e.target.value)} className="w-full bg-transparent text-sm font-mono font-bold uppercase outline-none text-black" />
                                                </div>
                                            </div>
                                            {item.fontKey && (
                                                <div className="mt-4 pt-3 border-t border-neutral-200/50 w-full relative group/dropdown">
                                                    <select
                                                        value={settings[item.fontKey] || ''}
                                                        onChange={(e) => handleSettingChange(item.fontKey, e.target.value)}
                                                        className="w-full bg-transparent text-[11px] font-bold uppercase tracking-widest text-neutral-600 outline-none appearance-none cursor-pointer pr-6"
                                                        style={{ fontFamily: getFontFamily(settings[item.fontKey] || settings.fontFamily) }}
                                                    >
                                                        <option value="">Auto (Theme Default)</option>
                                                        {FONT_OPTIONS.map(f => (
                                                            <option key={f.id} value={f.id} style={{ fontFamily: f.family }}>
                                                                {f.name} ({f.category})
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400 group-hover/dropdown:text-black transition-colors" />
                                                </div>
                                            )}
                                        </div>
                                        ))}
                                    </div>
                                </div>
                                )}

                                {editorTab === 'features' && (
                                <div className="space-y-12 animate-in fade-in duration-700 pb-20">
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-[0.5em] text-neutral-300 block mb-6">Booking Features</label>
                                        <div className="space-y-4">
                                            {[
                                                { key: 'loadingScreen', label: 'Loading Logo Pulse' },
                                                { key: 'birthday', label: 'Birthday Capture (MM/DD)' },
                                                { key: 'waitlist', label: 'Waitlist Fallback (When Full)' },
                                                { key: 'firstAvailable', label: '"First Available" Jump Button' },
                                                { key: 'socialProof', label: 'Social Proof Ticker' }
                                            ].map(f => (
                                                <div key={f.key} className="flex items-center justify-between gap-4 bg-neutral-50 p-4 md:p-6 rounded-lg border border-neutral-100/50">
                                                    <span className="text-sm font-bold">{f.label}</span>
                                                    <button onClick={() => handleFeatureChange(f.key, !settings.features?.[f.key])} className={`w-14 h-8 rounded-full flex items-center px-1 transition-colors ${settings.features?.[f.key] ? 'bg-[#39FF14]' : 'bg-neutral-200'}`}>
                                                        <div className={`w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${settings.features?.[f.key] ? 'translate-x-6' : ''}`} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="pt-10 border-t border-neutral-50 space-y-6">
                                        <label className="text-[10px] font-bold uppercase tracking-[0.5em] text-neutral-300 block">External Links</label>
                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-3 ml-4">Google Maps Link (Shows 'Get Directions')</p>
                                            <input type="url" value={settings.features?.location || ''} onChange={(e) => handleFeatureChange('location', e.target.value)} placeholder="https://maps.app.goo.gl/..." className="w-full bg-neutral-50 border-none rounded-lg px-5 md:px-8 py-4 md:py-5 text-sm font-medium outline-none" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-3 ml-4">Custom Favicon URL</p>
                                            <input type="url" value={settings.features?.favicon || ''} onChange={(e) => handleFeatureChange('favicon', e.target.value)} placeholder="https://image.url/icon.png" className="w-full bg-neutral-50 border-none rounded-lg px-5 md:px-8 py-4 md:py-5 text-sm font-medium outline-none" />
                                        </div>
                                    </div>
                                    <div className="pt-10 border-t border-neutral-50">
                                        <label className="text-[10px] font-bold uppercase tracking-[0.5em] text-neutral-300 block mb-6">FAQ Block</label>
                                        <div className="space-y-4 mb-6">
                                            {settings.features?.faqs?.map((faq, i) => (
                                                <div key={i} className="bg-neutral-50 p-6 rounded-lg relative">
                                                    <input type="text" value={faq.q} onChange={(e) => { const f = [...settings.features.faqs]; f[i].q = e.target.value; handleFeatureChange('faqs', f); }} placeholder="Question" className="w-full bg-transparent font-bold text-sm outline-none mb-2" />
                                                    <textarea value={faq.a} onChange={(e) => { const f = [...settings.features.faqs]; f[i].a = e.target.value; handleFeatureChange('faqs', f); }} placeholder="Answer" className="w-full bg-transparent text-sm opacity-70 outline-none resize-none h-16" />
                                                    <button onClick={() => { const f = settings.features.faqs.filter((_, idx) => idx !== i); handleFeatureChange('faqs', f); }} className="absolute top-6 right-6 text-neutral-300 hover:text-red-500"><X size={16} /></button>
                                                </div>
                                            ))}
                                        </div>
                                        <button onClick={() => handleFeatureChange('faqs', [...(settings.features?.faqs || []), {q: '', a: ''}])} className="w-full py-5 rounded-lg border-2 border-dashed border-neutral-200 text-neutral-400 font-bold text-xs uppercase tracking-widest hover:border-black hover:text-black transition-all">Add Question</button>
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

                            <div className="p-5 sm:p-6 md:p-8 border-t border-neutral-50 flex-shrink-0 bg-white">
                                <ProButton onClick={saveSettings} variant="primary" className="w-full py-7 text-[10px] md:text-[11px] uppercase shadow-2xl shadow-black/20">Publish To Web</ProButton>
                            </div>
                            </>
                        )}
                        </div>

                        <button onClick={() => setEditorCollapsed(!editorCollapsed)} className="hidden md:flex fixed bottom-6 right-6 md:bottom-10 md:right-10 z-[100] w-12 h-12 bg-white border border-neutral-100 rounded-full shadow-2xl items-center justify-center text-neutral-400 hover:text-black transition-all hover:scale-110">
                            {editorCollapsed ? <PanelRightOpen size={20} /> : <PanelRightClose size={20} />}
                        </button>

                        {/* LIVE SIMULATOR ENVIRONMENT */}
                        <div ref={containerRef} className="mobile-editor-preview flex-1 bg-[#F5F5F7] hidden md:flex flex-col items-center justify-center relative overflow-hidden p-6 md:p-8">
                        <div className="absolute top-8 flex flex-col md:flex-row items-center gap-6 md:gap-12 z-50">
                            <div className="flex bg-white/60 backdrop-blur-xl p-1.5 rounded-full border border-white/80 shadow-sm">
                                <button onClick={() => setDevice('desktop')} className={`px-8 py-2.5 rounded-full text-[9px] font-bold uppercase tracking-[0.4em] transition-all duration-700 ${device === 'desktop' ? 'bg-black text-white shadow-lg' : 'text-neutral-400 hover:text-black'}`}>PC</button>
                                <button onClick={() => setDevice('mobile')} className={`px-8 py-2.5 rounded-full text-[9px] font-bold uppercase tracking-[0.4em] transition-all duration-700 ${device === 'mobile' ? 'bg-black text-white shadow-lg' : 'text-neutral-400 hover:text-black'}`}>Mobile</button>
                            </div>
                            <button onClick={() => setPreviewKey(prev => prev + 1)} className="p-3 rounded-full bg-white text-neutral-400 hover:text-black shadow-lg border border-white/80 transition-all hidden md:block"><RefreshCw size={16}/></button>
                        </div>

                        <div style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }} className={`transition-all duration-1000 cubic-bezier(0.16, 1, 0.3, 1) relative flex flex-col bg-white shadow-[0_100px_200px_-50px_rgba(0,0,0,0.15)] ${device === 'desktop' ? 'w-[1200px] h-[820px] rounded-lg border-[24px] border-black overflow-hidden' : 'w-[420px] h-[950px] md:h-[1050px] rounded-[5rem] md:rounded-[6rem] border-[16px] md:border-[20px] border-black overflow-hidden'}`}>
                            
                            {device === 'desktop' && (
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-6 bg-black rounded-b-3xl z-[100] flex items-center justify-center">
                                    <div className="w-2.5 h-2.5 rounded-full bg-neutral-900 border border-white/5 shadow-inner" />
                                </div>
                            )}

                            {device === 'mobile' && (
                            <>
                                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-32 h-8 bg-black rounded-full z-[100] flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-[#111] ml-auto mr-4" /></div>
                                <div className="absolute top-10 left-12 right-12 z-[100] flex justify-between items-center text-black font-bold text-[13px] tracking-tight">
                                    <span>9:41</span><div className="flex gap-2 items-center"><Signal size={14} /><Wifi size={14} /><Battery size={18} strokeWidth={2} /></div>
                                </div>
                                <div className="absolute top-32 -left-[12px] w-1 h-16 bg-black rounded-r-lg z-[100]" />
                                <div className="absolute top-52 -left-[12px] w-1 h-12 bg-black rounded-r-lg z-[100]" />
                                <div className="absolute top-44 -right-[12px] w-1 h-24 bg-black rounded-l-lg z-[100]" />
                            </>
                            )}

                            <div className={`flex-shrink-0 border-b flex items-center justify-between ${device === 'desktop' ? 'px-16 h-24 bg-neutral-50/50' : 'px-8 h-28 pt-10 bg-white'}`} style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
                              <div className="flex gap-3 w-16">
                                {device === 'desktop' && <><div className="w-3.5 h-3.5 rounded-full bg-red-400/80" /><div className="w-3.5 h-3.5 rounded-full bg-amber-400/80" /><div className="w-3.5 h-3.5 rounded-full bg-green-400/80" /></>}
                              </div>
                              <div className={`flex items-center justify-center gap-2 rounded-full bg-black/5 font-bold text-neutral-500 uppercase overflow-hidden ${device === 'desktop' ? 'px-8 py-2.5 text-[10px] tracking-[0.3em] w-1/2 max-w-[400px]' : 'px-5 py-2 text-[8px] tracking-[0.2em] max-w-[200px]'}`}>
                                {settings.features?.favicon && <img src={settings.features.favicon} className="w-3 h-3 rounded-sm opacity-50 shrink-0" />}
                                <span className="truncate whitespace-nowrap">/book/{settings.slug || 'studio'}</span>
                              </div>
                              <div className="w-16" />
                            </div>

                            <div className="flex-1 overflow-y-auto no-scrollbar relative group/simulator" style={{ backgroundColor: settings.backgroundColor }}>
                            <div className="absolute top-8 right-8 z-50 flex items-center gap-2 px-4 py-2 bg-black/10 backdrop-blur-md rounded-full text-[9px] font-bold uppercase tracking-[0.2em] opacity-0 group-hover/simulator:opacity-100 transition-opacity pointer-events-none text-black">
                                <MousePointerClick size={12} /> Design Inspector Live
                            </div>
                            <BookingFlow key={previewKey} settings={settings} isPreview={true} onInspect={handleInspect} onComplete={handleBookingComplete} />
                            </div>
                        </div>
                        </div>
                    </div>
                    )}

                    {activeTab === 'bookings' && (
                    <div className="flex-1 overflow-y-auto bg-[#F6F7F9] p-4 sm:p-6 md:p-10 lg:p-12">
                        <header className="mb-8 flex flex-col xl:flex-row xl:items-end justify-between gap-6">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-neutral-400 mb-3">Booking Desk</p>
                                <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-black">My Bookings</h1>
                                <p className="text-neutral-500 text-base md:text-lg mt-3 max-w-2xl">Review requests, confirm clients, assign your team, and keep every appointment moving.</p>
                            </div>
                        </header>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                            {[
                                { label: 'Needs Review', value: bookingStats.attention, hint: 'Pending + waitlist', icon: Bell },
                                { label: 'Confirmed', value: bookingStats.confirmed, hint: 'Approved visits', icon: CheckCircle2 },
                                { label: 'Waitlist', value: bookingStats.waitlist, hint: 'Standby clients', icon: Clock },
                                { label: 'Total Records', value: bookingStats.all, hint: bookings.length ? 'Live data' : 'Sample data', icon: Layers }
                            ].map(metric => {
                                const IconCmp = metric.icon;
                                return (
                                    <div key={metric.label} className="saas-card p-5">
                                        <div className="flex items-start justify-between mb-7">
                                            <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center text-black"><IconCmp size={17}/></div>
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 bg-neutral-100 px-2.5 py-1 rounded-md">{metric.hint}</span>
                                        </div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-400 mb-2">{metric.label}</p>
                                        <p className="metric-value text-3xl font-bold tracking-tight text-black">{metric.value}</p>
                                    </div>
                                );
                            })}
                        </div>

                        {!bookings.length && (
                            <div className="mb-6 saas-panel p-4 text-sm font-medium text-neutral-600 flex items-center gap-3">
                                <Sparkles size={16} className="text-black" />
                                Showing sample bookings until live bookings arrive.
                            </div>
                        )}

                        <section className="saas-card overflow-hidden">
                            <div className="p-5 md:p-6 border-b border-neutral-100 flex flex-col xl:flex-row xl:items-center justify-between gap-5">
                                <div>
                                    <h2 className="text-lg font-bold tracking-tight text-black">Booking Queue</h2>
                                    <p className="text-sm text-neutral-500">{filteredBookings.length} shown from {visibleBookings.length} total records.</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    {[
                                        ['all', 'All', bookingStats.all],
                                        ['pending', 'Requests', bookingStats.pending],
                                        ['confirmed', 'Confirmed', bookingStats.confirmed],
                                        ['waitlist', 'Waitlist', bookingStats.waitlist],
                                        ['declined', 'Declined', bookingStats.declined]
                                    ].map(filter => (
                                        <button
                                            key={filter[0]}
                                            onClick={() => setBookingFilter(filter[0])}
                                            className={`h-10 px-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${bookingFilter === filter[0] ? 'bg-black text-white shadow-lg' : 'bg-neutral-50 text-neutral-500 hover:bg-neutral-100 hover:text-black'}`}
                                        >
                                            {filter[1]} <span className={`px-1.5 py-0.5 rounded ${bookingFilter === filter[0] ? 'bg-white/15 text-white' : 'bg-white text-neutral-400'}`}>{filter[2]}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="divide-y divide-neutral-100">
                                {filteredBookings.length === 0 ? (
                                    <div className="p-16 md:p-24 text-center">
                                        <div className="w-14 h-14 rounded-lg bg-neutral-100 flex items-center justify-center mx-auto mb-5 text-neutral-400"><Layers size={22}/></div>
                                        <h3 className="text-xl font-bold tracking-tight text-black mb-2">No bookings here</h3>
                                        <p className="text-sm text-neutral-500">Try another filter or wait for new booking requests.</p>
                                    </div>
                                ) : filteredBookings.map(b => {
                                    const assignedStaff = staffList.find(s => s.id === b.staffId);
                                    const statusStyle = b.status === 'confirmed'
                                        ? 'bg-[#39FF14] text-black'
                                        : b.status === 'waitlist'
                                            ? 'bg-amber-100 text-amber-800'
                                            : b.status === 'declined'
                                                ? 'bg-red-50 text-red-600'
                                                : 'bg-black text-white';
                                    return (
                                        <div key={b.id} className={`p-5 md:p-6 transition-all hover:bg-neutral-50/70 ${b.status === 'declined' ? 'opacity-50 grayscale' : ''}`}>
                                            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 xl:items-center">
                                                <div className="xl:col-span-5 flex items-center gap-4 min-w-0">
                                                    <div className="relative shrink-0">
                                                        <div className={`w-14 h-14 rounded-lg flex items-center justify-center font-bold text-xl shadow-inner uppercase ${statusStyle}`}>
                                                            {b.clientName.charAt(0)}
                                                        </div>
                                                        {b.noShowHistory && <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-sm" title="No-show history" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-3 mb-1">
                                                            <h3 className="text-lg md:text-xl font-bold tracking-tight text-black truncate">{b.clientName}</h3>
                                                            <span className={`shrink-0 px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest ${statusStyle}`}>{b.status === 'waitlist' ? 'Standby' : b.status}</span>
                                                        </div>
                                                        <p className="text-sm text-neutral-500 truncate">{b.clientPhone}{b.clientBirthday ? ` / Bday: ${b.clientBirthday}` : ''}</p>
                                                    </div>
                                                </div>

                                                <div className="xl:col-span-2">
                                                    <p className="metric-value text-2xl font-bold tracking-tight text-black">{b.time}</p>
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{b.date}</p>
                                                </div>

                                                <div className="xl:col-span-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-300 hidden md:inline">Assigned</span>
                                                        <select
                                                            value={b.staffId || ''}
                                                            onChange={(e) => updateBooking(b.id, { staffId: e.target.value })}
                                                            className="h-10 min-w-[160px] bg-white text-sm font-bold px-3 rounded-lg outline-none border border-neutral-200 focus:border-black transition-colors"
                                                        >
                                                            <option value="" disabled>Assign staff</option>
                                                            {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                        </select>
                                                        {assignedStaff && <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: assignedStaff.color }} />}
                                                    </div>
                                                </div>

                                                <div className="xl:col-span-2 flex flex-wrap items-center justify-start xl:justify-end gap-2">
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
                                                    <button onClick={() => { if(confirm("Permanently remove this booking record?")) deleteBooking(b.id); }} className="h-10 w-10 rounded-lg flex items-center justify-center text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    </div>
                    )}

                </div>
                </div>
            );
        }
