import { useEffect, useLayoutEffect, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  Eye,
  Globe,
  Layers,
  Mail,
  MousePointerClick,
  Palette,
  PanelRightOpen,
  Search,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Star,
  Users,
  Zap
} from 'lucide-react';

const industries = [
  'Beauty Studio',
  'Barber Shop',
  'Nail Artist',
  'Tattoo Studio',
  'Wellness',
  'Fitness',
  'Photography',
  'Consulting',
  'Private Studio'
];

const normalizeHandle = (value = '') => (
  value
    .trim()
    .replace(/^https?:\/\/(www\.)?/i, '')
    .replace(/^(instagram\.com|tiktok\.com|facebook\.com|fb\.com)\//i, '')
    .replace(/^@/, '')
    .replace(/\/$/, '')
);

const normalizeWebsite = (value = '') => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

export const buildBookingSlug = (businessName = '', instagram = '') => {
  const source = normalizeHandle(instagram) || businessName || 'my-business';
  return source
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 42) || 'my-business';
};

export const prepareOnboardingSettings = (settings, draft, metadata = {}) => {
  const businessName = draft.businessName.trim() || settings.brandName || 'My Business';
  const industry = draft.industry.trim() || 'Private Studio';
  const instagram = normalizeHandle(draft.instagram);
  const tiktok = normalizeHandle(draft.tiktok);
  const facebook = normalizeHandle(draft.facebook);
  const website = normalizeWebsite(draft.website);
  const slug = buildBookingSlug(businessName, instagram);

  return {
    ...settings,
    brandName: businessName,
    slug,
    tagline: industry,
    welcomeMessage: `Welcome to ${businessName}. Choose a time that works for you and we will take care of the rest.`,
    socials: {
      ...(settings.socials || {}),
      instagram,
      tiktok,
      facebook,
      website
    },
    onboarding: {
      ...(settings.onboarding || {}),
      version: 2,
      industry,
      completedAt: metadata.completedAt || Date.now(),
      skippedAt: metadata.skippedAt || null
    }
  };
};

const scenes = [
  { id: 'intro', type: 'cinema' },
  { id: 'name', type: 'setup', field: 'businessName' },
  { id: 'industry', type: 'setup', field: 'industry' },
  { id: 'instagram', type: 'setup', field: 'instagram' },
  { id: 'socials', type: 'setup', field: 'socials' },
  { id: 'link', type: 'link' },
  {
    id: 'dashboard',
    type: 'platform',
    tab: 'overview',
    target: 'dashboard-hero',
    kicker: 'Command center',
    title: 'Start here each day.',
    text: 'See today, new requests, booking rate, clients, and schedule health in one view.'
  },
  {
    id: 'bookings',
    type: 'platform',
    tab: 'bookings',
    target: 'bookings-queue',
    kicker: 'Booking desk',
    title: 'Turn requests into bookings.',
    text: 'Approve, decline, waitlist, assign staff, and keep every booking moving.'
  },
  {
    id: 'schedule',
    type: 'platform',
    tab: 'business',
    target: 'schedule-calendar',
    kicker: 'Availability studio',
    title: 'Control availability visually.',
    text: 'Open days, close days, add custom slots, and track booking rate by day, week, or month.'
  },
  {
    id: 'editor',
    type: 'platform',
    tab: 'editor',
    target: 'editor-theme-library',
    kicker: 'Live page editor',
    title: 'Make the page feel branded.',
    text: 'Choose themes, fonts, colors, logo, banner, features, and backend skin from one live editor.'
  },
  {
    id: 'clients',
    type: 'platform',
    tab: 'clients',
    target: 'clients-directory',
    kicker: 'Client book',
    title: 'Know every client.',
    text: 'Profiles, notes, labels, photos, regulars, first-timers, and booking history stay together.'
  },
  {
    id: 'email',
    type: 'platform',
    tab: 'communications',
    target: 'email-delivery',
    kicker: 'Email studio',
    title: 'Write the messages once.',
    text: 'Confirmations, waitlist alerts, running-late notes, and review follow-ups stay ready to send.'
  },
  {
    id: 'team',
    type: 'platform',
    tab: 'staff',
    target: 'team-roster',
    kicker: 'Team access',
    title: 'Bring the team in cleanly.',
    text: 'Invite staff, set roles, detect accounts, and keep bookings tied to the right person.'
  },
  {
    id: 'profile',
    type: 'platform',
    tab: 'profile',
    target: 'profile-business-info',
    kicker: 'Business profile',
    title: 'Keep identity in one place.',
    text: 'Logo, banner, social links, location, affiliate link, and account details stay organized.'
  },
  { id: 'launch', type: 'launch' }
];

const setupCopy = {
  businessName: {
    eyebrow: 'Identity 01',
    title: 'What name should clients remember?',
    helper: 'This becomes the headline of the booking page and the name used around the workspace.',
    label: 'Business name',
    placeholder: 'Studio Noir'
  },
  industry: {
    eyebrow: 'Identity 02',
    title: 'What kind of business is this?',
    helper: 'The industry shapes the tone of the page and helps the dashboard feel more personal.',
    label: 'Industry',
    placeholder: 'Beauty Studio'
  },
  instagram: {
    eyebrow: 'Identity 03',
    title: 'Add the handle clients already know.',
    helper: 'If you add Instagram, Build A Booking can use it to create a cleaner booking link.',
    label: 'Instagram',
    placeholder: '@yourstudio'
  },
  socials: {
    eyebrow: 'Identity 04',
    title: 'Connect the rest of the public footprint.',
    helper: 'Optional, but useful. These links appear on the public booking page so clients can trust what they see.'
  }
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const getPopoverStyle = (spotlight) => {
  const isMobile = window.innerWidth < 640;
  const width = isMobile ? window.innerWidth - 32 : 360;
  const height = isMobile ? 360 : 300;
  const enoughRight = spotlight.left + spotlight.width + width + 28 < window.innerWidth;
  const enoughLeft = spotlight.left - width - 28 > 0;
  const left = isMobile
    ? 16
    : enoughRight
      ? spotlight.left + spotlight.width + 24
      : enoughLeft
        ? spotlight.left - width - 24
        : spotlight.left > window.innerWidth / 2
          ? 24
          : window.innerWidth - width - 24;
  const below = spotlight.top + spotlight.height + 18;
  const top = isMobile
    ? clamp(below, 16, window.innerHeight - height - 16)
    : clamp(spotlight.top, 20, window.innerHeight - height - 20);

  return { left, top, width, maxHeight: isMobile ? 'calc(100vh - 32px)' : undefined };
};

export function OnboardingShowroom({
  open,
  settings,
  bookingOrigin,
  canApply = true,
  onSkip,
  onComplete,
  onNavigate
}) {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [tourFocus, setTourFocus] = useState(null);
  const [draft, setDraft] = useState({
    businessName: '',
    industry: '',
    instagram: '',
    tiktok: '',
    facebook: '',
    website: ''
  });

  const scene = scenes[sceneIndex] || scenes[0];
  const generatedSlug = buildBookingSlug(draft.businessName, draft.instagram);
  const generatedLink = `${bookingOrigin}/book/${generatedSlug}`;
  const progress = Math.round(((sceneIndex + 1) / scenes.length) * 100);

  useEffect(() => {
    if (!open) return;
    setSceneIndex(0);
    setDraft({
      businessName: settings.brandName || '',
      industry: settings.onboarding?.industry || settings.tagline || '',
      instagram: settings.socials?.instagram || '',
      tiktok: settings.socials?.tiktok || '',
      facebook: settings.socials?.facebook || '',
      website: settings.socials?.website || ''
    });
  }, [open, settings.brandName, settings.onboarding?.industry, settings.tagline, settings.socials?.instagram, settings.socials?.tiktok, settings.socials?.facebook, settings.socials?.website]);

  useEffect(() => {
    if (!open || scene.type !== 'platform') return;
    onNavigate?.(scene.tab);
  }, [open, scene.id, scene.tab, scene.type, onNavigate]);

  useLayoutEffect(() => {
    if (!open || scene.type !== 'platform') {
      setTourFocus(null);
      return undefined;
    }

    setTourFocus(null);
    let cancelled = false;
    let timer = null;
    let retryTimer = null;
    const padding = window.innerWidth < 640 ? 10 : 16;

    const updateFocus = () => {
      if (cancelled) return;
      const target = document.querySelector(`[data-tour="${scene.target}"]`);
      if (!target) {
        setTourFocus(null);
        retryTimer = window.setTimeout(updateFocus, 120);
        return;
      }

      target.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });

      window.requestAnimationFrame(() => {
        if (cancelled) return;
        window.requestAnimationFrame(() => {
          if (cancelled) return;
          const rect = target.getBoundingClientRect();
          const spotlightStyle = {
            target: scene.target,
            top: Math.max(12, rect.top - padding),
            left: Math.max(12, rect.left - padding),
            width: Math.min(window.innerWidth - 24, rect.width + padding * 2),
            height: Math.min(window.innerHeight - 24, rect.height + padding * 2)
          };
          setTourFocus({
            sceneId: scene.id,
            target: scene.target,
            spotlightStyle,
            popoverStyle: getPopoverStyle(spotlightStyle)
          });
        });
      });
    };

    updateFocus();
    timer = window.setTimeout(updateFocus, 420);
    window.addEventListener('resize', updateFocus);
    window.addEventListener('scroll', updateFocus, true);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearTimeout(retryTimer);
      window.removeEventListener('resize', updateFocus);
      window.removeEventListener('scroll', updateFocus, true);
    };
  }, [open, scene.id, scene.target, scene.type]);

  const next = () => setSceneIndex(index => Math.min(index + 1, scenes.length - 1));
  const back = () => setSceneIndex(index => Math.max(index - 1, 0));
  const updateDraft = (key, value) => setDraft(prev => ({ ...prev, [key]: value }));
  const complete = (destination = 'editor') => onComplete(draft, { destination });

  if (!open) return null;

  const stageBackground = scene.type === 'platform' ? 'pointer-events-auto' : 'bg-[#050505] pointer-events-auto';

  return (
    <div className={`fixed inset-0 z-[9998] text-white overflow-hidden ${stageBackground}`}>
      <TopProgress progress={progress} />
      <SkipButton onSkip={onSkip} />

      {scene.type !== 'platform' && (
        <div className="absolute inset-0 opacity-[0.06] bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:72px_72px]" />
      )}

      {scene.type === 'cinema' && (
        <CinemaScene
          generatedLink={generatedLink}
          onNext={next}
          onJump={() => setSceneIndex(6)}
        />
      )}

      {scene.type === 'setup' && (
        <SetupScene
          field={scene.field}
          draft={draft}
          generatedLink={generatedLink}
          updateDraft={updateDraft}
          onBack={back}
          onNext={next}
        />
      )}

      {scene.type === 'link' && (
        <LinkScene
          draft={draft}
          generatedLink={generatedLink}
          onBack={back}
          onNext={next}
        />
      )}

      {scene.type === 'platform' && (
        <PlatformScene
          scene={scene}
          sceneIndex={sceneIndex}
          focus={tourFocus}
          progress={progress}
          onBack={back}
          onNext={next}
          onNavigate={onNavigate}
        />
      )}

      {scene.type === 'launch' && (
        <LaunchScene
          generatedLink={generatedLink}
          canApply={canApply}
          onBack={back}
          onFinish={complete}
        />
      )}
    </div>
  );
}

function TopProgress({ progress }) {
  return (
    <div className="absolute inset-x-0 top-0 z-50 h-1 bg-white/10">
      <div className="h-full bg-white transition-all duration-700" style={{ width: `${progress}%` }} />
    </div>
  );
}

function SkipButton({ onSkip }) {
  return (
    <button
      onClick={onSkip}
      className="absolute right-4 top-4 md:right-8 md:top-8 z-50 h-11 px-4 rounded-full bg-white/10 border border-white/15 text-white/70 hover:text-white hover:bg-white/15 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 shadow-2xl backdrop-blur-xl"
    >
      <SkipForward size={14} /> Skip Tour
    </button>
  );
}

function CinemaScene({ generatedLink, onNext, onJump }) {
  return (
    <section className="relative z-10 min-h-full px-5 md:px-10 xl:px-16 py-24 flex items-center">
      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-12 gap-10 items-center">
        <div className="xl:col-span-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white/55 mb-8">
            <Sparkles size={14} /> Build A Booking Intro
          </div>
          <h1 className="text-5xl md:text-7xl xl:text-[104px] font-bold tracking-tight leading-[0.88] mb-8">
            Your booking system, introduced properly.
          </h1>
          <p className="text-lg md:text-2xl text-white/55 max-w-3xl leading-relaxed mb-10">
            A short cinematic setup that walks through the real platform, highlights the important tools, and creates your first booking identity step by step.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={onNext} className="h-14 px-7 rounded-full bg-white text-black text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-neutral-200 transition-colors">
              Begin Setup <ArrowRight size={15} />
            </button>
            <button onClick={onJump} className="h-14 px-7 rounded-full bg-white/10 border border-white/15 text-white text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white/15 transition-colors">
              Watch Platform Tour <Eye size={15} />
            </button>
          </div>
        </div>

        <div className="xl:col-span-5">
          <div className="relative rounded-[2rem] border border-white/15 bg-white/[0.03] p-5 shadow-[0_40px_120px_-70px_rgba(255,255,255,0.55)]">
            <div className="aspect-[4/5] rounded-[1.5rem] bg-white text-black p-6 md:p-8 flex flex-col justify-between overflow-hidden">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-black text-white flex items-center justify-center mb-12">
                  <MousePointerClick size={22} />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-neutral-400 mb-3">Experience Mode</p>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-none mb-5">Guided, focused, cinematic.</h2>
                <p className="text-neutral-500 leading-relaxed">No cold form. No guessing. The app explains itself while the business setup takes shape.</p>
              </div>
              <div className="rounded-2xl bg-black text-white p-4">
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/35 mb-2">Preview link</p>
                <p className="text-sm font-bold break-all">{generatedLink}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SetupScene({ field, draft, generatedLink, updateDraft, onBack, onNext }) {
  const copy = setupCopy[field];
  const normalizedInstagram = normalizeHandle(draft.instagram);
  const inputValue = draft[field] || '';

  return (
    <section className="relative z-10 min-h-full px-5 md:px-10 xl:px-16 py-24 flex items-center">
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 xl:grid-cols-12 gap-8 items-stretch">
        <div className="xl:col-span-7 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 md:p-8 xl:p-10 shadow-[0_40px_120px_-80px_rgba(255,255,255,0.5)]">
          <p className="text-[10px] font-bold uppercase tracking-[0.45em] text-white/35 mb-5">{copy.eyebrow}</p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-none mb-5">{copy.title}</h2>
          <p className="text-white/50 text-lg leading-relaxed max-w-2xl mb-10">{copy.helper}</p>

          {field !== 'socials' ? (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.35em] text-white/35 block mb-4">{copy.label}</label>
              <input
                value={inputValue}
                onChange={(event) => updateDraft(field, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onNext();
                }}
                list={field === 'industry' ? 'industry-options' : undefined}
                placeholder={copy.placeholder}
                autoFocus
                className="w-full bg-transparent border-0 border-b border-white/25 focus:border-white text-4xl md:text-6xl font-bold tracking-tight outline-none py-5 text-white placeholder:text-white/20"
              />
              {field === 'industry' && (
                <datalist id="industry-options">
                  {industries.map(industry => <option key={industry} value={industry} />)}
                </datalist>
              )}
              {field === 'industry' && (
                <div className="flex flex-wrap gap-2 mt-6">
                  {industries.slice(0, 6).map(industry => (
                    <button
                      key={industry}
                      type="button"
                      onClick={() => updateDraft('industry', industry)}
                      className="h-10 px-4 rounded-full bg-white/10 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/65 hover:bg-white hover:text-black transition-colors"
                    >
                      {industry}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                ['tiktok', 'TikTok', '@yourstudio'],
                ['facebook', 'Facebook', 'yourstudio'],
                ['website', 'Website', 'yourstudio.com']
              ].map(([key, label, placeholder]) => (
                <label key={key} className="rounded-2xl bg-white text-black p-4">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 block mb-3">{label}</span>
                  <input
                    value={draft[key]}
                    onChange={(event) => updateDraft(key, event.target.value)}
                    placeholder={placeholder}
                    className="w-full bg-transparent outline-none text-lg font-bold placeholder:text-neutral-300"
                  />
                </label>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 mt-12">
            <button onClick={onNext} className="h-14 px-7 py-4 rounded-full bg-white text-black text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-neutral-200 transition-colors">
              Continue <ArrowRight size={15} />
            </button>
            <button onClick={onBack} className="h-14 px-7 py-4 rounded-full bg-white/10 border border-white/15 text-white/70 text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:text-white transition-colors">
              <ChevronLeft size={15} /> Back
            </button>
          </div>
        </div>

        <aside className="xl:col-span-5 rounded-[2rem] bg-white text-black p-6 md:p-8 flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-black text-white flex items-center justify-center mb-10">
              <Globe size={18} />
            </div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-3">Live Identity Preview</p>
            <h3 className="text-4xl font-bold tracking-tight leading-none mb-4">{draft.businessName || 'Your Business'}</h3>
            <p className="text-neutral-500 font-medium mb-8">{draft.industry || 'Choose an industry'}</p>
            <div className="rounded-2xl bg-neutral-100 p-4 mb-5">
              <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-2">Booking link</p>
              <p className="text-sm font-bold break-all">{generatedLink}</p>
            </div>
            <div className="space-y-3">
              {[
                ['Instagram', normalizedInstagram ? `@${normalizedInstagram}` : 'Not added yet'],
                ['TikTok', normalizeHandle(draft.tiktok) ? `@${normalizeHandle(draft.tiktok)}` : 'Optional'],
                ['Website', draft.website || 'Optional']
              ].map(row => (
                <div key={row[0]} className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-3 last:border-0">
                  <span className="text-sm text-neutral-500">{row[0]}</span>
                  <span className="text-sm font-bold text-right">{row[1]}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function LinkScene({ draft, generatedLink, onBack, onNext }) {
  return (
    <section className="relative z-10 min-h-full px-5 md:px-10 xl:px-16 py-24 flex items-center">
      <div className="max-w-5xl mx-auto text-center">
        <div className="w-16 h-16 rounded-2xl bg-white text-black flex items-center justify-center mx-auto mb-10">
          <Check size={24} />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.45em] text-white/35 mb-5">Identity locked</p>
        <h2 className="text-5xl md:text-7xl xl:text-8xl font-bold tracking-tight leading-[0.9] mb-8">
          {draft.businessName || 'Your business'} now has a booking link.
        </h2>
        <div className="rounded-[2rem] bg-white text-black p-6 md:p-8 mb-10 text-left">
          <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-3">Client-facing link</p>
          <p className="text-xl md:text-3xl font-bold break-all">{generatedLink}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={onNext} className="h-14 px-7 rounded-full bg-white text-black text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-neutral-200 transition-colors">
            Walk The Platform <Search size={15} />
          </button>
          <button onClick={onBack} className="h-14 px-7 rounded-full bg-white/10 border border-white/15 text-white/70 text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:text-white transition-colors">
            <ChevronLeft size={15} /> Back
          </button>
        </div>
      </div>
    </section>
  );
}

function PlatformScene({ scene, sceneIndex, focus, onBack, onNext, onNavigate }) {
  const isFocusReady = focus?.sceneId === scene.id && focus?.target === scene.target;
  const spotlight = isFocusReady ? focus.spotlightStyle : null;
  const popoverStyle = isFocusReady ? focus.popoverStyle : null;
  const showPopover = Boolean(
    popoverStyle &&
    Number.isFinite(popoverStyle.left) &&
    Number.isFinite(popoverStyle.top) &&
    Number.isFinite(popoverStyle.width)
  );
  const ringStyle = spotlight
    ? {
        top: spotlight.top,
        left: spotlight.left,
        width: spotlight.width,
        height: spotlight.height
      }
    : null;

  return (
    <>
      <SpotlightPanels spotlight={spotlight} />
      {spotlight?.target === scene.target && (
        <div
          className="tour-spotlight-ring fixed z-[10001] rounded-[1.35rem] border-2 pointer-events-none"
          style={ringStyle}
        >
          <div className="absolute -right-3 -top-3 h-7 w-7 rounded-full bg-[#39FF14] text-black flex items-center justify-center shadow-xl shadow-[#39FF14]/50">
            <MousePointerClick size={14} />
          </div>
        </div>
      )}

      {showPopover && (
        <div
          key={scene.id}
          className="tour-popover fixed z-[10002] overflow-y-auto rounded-[1.5rem] bg-white text-black p-4 md:p-6 shadow-[0_30px_100px_-30px_rgba(0,0,0,0.75)] border border-black/10"
          style={popoverStyle}
        >
          <div className="flex items-start justify-between gap-4 mb-5 md:mb-8">
            <div className="tour-popover-copy">
              <p className="tour-copy-line text-[9px] font-bold uppercase tracking-[0.35em] text-neutral-400 mb-2">{scene.kicker}</p>
              <h2 className="tour-copy-line text-2xl md:text-3xl font-bold tracking-tight leading-none" style={{ animationDelay: '70ms' }}>{scene.title}</h2>
            </div>
            <div className="h-10 w-10 rounded-full bg-black text-white flex items-center justify-center shrink-0">
              <ArrowUpRight size={17} />
            </div>
          </div>
          <p className="tour-copy-line text-sm md:text-base text-neutral-500 leading-relaxed mb-6" style={{ animationDelay: '140ms' }}>{scene.text}</p>
          <div className="tour-copy-line flex items-center justify-between gap-3" style={{ animationDelay: '210ms' }}>
            <button onClick={onBack} className="h-11 px-4 rounded-full bg-neutral-100 text-neutral-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:text-black">
              <ChevronLeft size={14} /> Back
            </button>
            <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-300">{sceneIndex - 5} / 8</div>
            <button onClick={onNext} className="h-11 px-5 rounded-full bg-black text-white text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-neutral-800">
              Next <ArrowRight size={14} />
            </button>
          </div>
          <button
            onClick={() => onNavigate?.(scene.tab)}
            className="mt-3 w-full h-10 rounded-full border border-neutral-200 text-[10px] font-bold uppercase tracking-widest text-neutral-500 hover:text-black hover:bg-neutral-50 flex items-center justify-center gap-2"
          >
            <MousePointerClick size={14} /> Show This Area
          </button>
        </div>
      )}
    </>
  );
}

function SpotlightPanels({ spotlight }) {
  if (!spotlight) {
    return <div className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm" />;
  }

  const right = window.innerWidth - spotlight.left - spotlight.width;
  const bottom = window.innerHeight - spotlight.top - spotlight.height;
  const panelClass = 'fixed z-[10000] bg-black/72 backdrop-blur-[2px]';

  return (
    <>
      <div className={panelClass} style={{ left: 0, top: 0, width: '100%', height: spotlight.top }} />
      <div className={panelClass} style={{ left: 0, top: spotlight.top, width: spotlight.left, height: spotlight.height }} />
      <div className={panelClass} style={{ right: 0, top: spotlight.top, width: Math.max(0, right), height: spotlight.height }} />
      <div className={panelClass} style={{ left: 0, bottom: 0, width: '100%', height: Math.max(0, bottom) }} />
    </>
  );
}

function LaunchScene({ generatedLink, canApply, onBack, onFinish }) {
  return (
    <section className="relative z-10 min-h-full px-5 md:px-10 xl:px-16 py-24 flex items-center">
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 xl:grid-cols-12 gap-8 items-stretch">
        <div className="xl:col-span-7 rounded-[2rem] bg-white text-black p-6 md:p-10">
          <div className="w-14 h-14 rounded-2xl bg-black text-white flex items-center justify-center mb-10">
            <Zap size={22} />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.45em] text-neutral-400 mb-4">Launch ready</p>
          <h2 className="text-5xl md:text-7xl font-bold tracking-tight leading-[0.9] mb-6">You have seen the whole machine.</h2>
          <p className="text-neutral-500 text-lg leading-relaxed mb-8">Now we apply the setup, open the editor, and let you tune the final look before publishing.</p>
          <div className="rounded-2xl bg-neutral-100 p-4">
            <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-2">Your booking link</p>
            <p className="text-sm font-bold break-all">{generatedLink}</p>
          </div>
        </div>

        <div className="xl:col-span-5 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 md:p-8 flex flex-col justify-between">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/35 mb-2">Next best actions</p>
            <h3 className="text-3xl font-bold tracking-tight mb-4">Make it unmistakably yours.</h3>
            <p className="text-white/50 leading-relaxed mb-6">Start with identity, theme, schedule, and email. The workspace is ready to guide the rest.</p>
            <div className="space-y-3">
              {[
                [Palette, 'Choose a theme'],
                [Calendar, 'Tune availability'],
                [Mail, 'Connect emails'],
                [ShieldCheck, 'Invite staff']
              ].map(([Icon, label]) => (
                <div key={label} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                  <Icon size={15} />
                  <span className="text-sm font-bold">{label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8">
            <button onClick={() => onFinish('editor')} disabled={!canApply} className="h-12 rounded-full bg-white text-black text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40 hover:bg-neutral-200">
              Finish In Editor <ArrowRight size={15} />
            </button>
            <button onClick={onBack} className="h-12 rounded-full bg-white/10 border border-white/15 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-white/15 flex items-center justify-center gap-2">
              <ChevronLeft size={15} /> Back
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
