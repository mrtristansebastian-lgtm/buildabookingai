import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  Volume2,
  VolumeX,
  Zap
} from 'lucide-react';
import { buildBookingSlug, normalizeHandle } from '../utils/onboarding';

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
    text: 'Choose the page theme, then tune the logo, banner, colors, features, and backend skin from one live editor.'
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
    target: 'email-messages',
    kicker: 'Communication studio',
    title: 'Keep every message ready.',
    text: 'Email templates and WhatsApp setup live together so client updates stay consistent.'
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

const buildRect = (rect, padding = 0) => ({
  top: Math.max(8, rect.top - padding),
  left: Math.max(8, rect.left - padding),
  width: Math.min(window.innerWidth - 16, rect.width + padding * 2),
  height: Math.min(window.innerHeight - 16, rect.height + padding * 2)
});

const getRectCenter = (rect) => ({
  x: rect.left + rect.width / 2,
  y: rect.top + rect.height / 2
});

const isMobileTourViewport = () => (
  typeof window !== 'undefined' &&
  (window.innerWidth < 768 || (window.innerWidth <= 1024 && window.innerHeight <= 560))
);

const useMobileTourViewport = () => {
  const [isMobile, setIsMobile] = useState(isMobileTourViewport);

  useEffect(() => {
    const update = () => setIsMobile(isMobileTourViewport());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return isMobile;
};

const getScrollableParent = (element) => {
  let parent = element?.parentElement;
  while (parent && parent !== document.body) {
    const style = window.getComputedStyle(parent);
    const scrollable = /(auto|scroll)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight;
    if (scrollable) return parent;
    parent = parent.parentElement;
  }
  return document.scrollingElement || document.documentElement;
};

const scrollTargetForTour = (target, mobile = false) => {
  target.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
  if (!mobile) return;

  const scroller = getScrollableParent(target);
  const lift = Math.min(220, Math.max(110, window.innerHeight * 0.18));
  if (scroller === document.scrollingElement || scroller === document.documentElement || scroller === document.body) {
    window.scrollBy({ top: lift, left: 0, behavior: 'auto' });
    return;
  }
  scroller.scrollTop += lift;
};

const getWorkspaceScrollers = () => {
  if (typeof document === 'undefined') return [];
  return Array.from(document.querySelectorAll('.dashboard-main .overflow-y-auto, .dashboard-main [class*="overflow-y-auto"]'))
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && element.scrollHeight > element.clientHeight + 4;
    });
};

const scrollWorkspaceToTop = () => {
  getWorkspaceScrollers().forEach((element) => {
    element.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
    element.scrollTop = 0;
  });
};

const getTourNavTarget = (tab) => {
  const mobileTarget = document.querySelector(`[data-tour="mobile-nav-${tab}"]`);
  const desktopTarget = document.querySelector(`[data-tour="nav-${tab}"]`);
  return isMobileTourViewport() ? (mobileTarget || desktopTarget) : (desktopTarget || mobileTarget);
};

const useTourSound = () => {
  const audioRef = useRef(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const playSound = useCallback((type = 'tap') => {
    if (!soundEnabled || typeof window === 'undefined') return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    try {
      const context = audioRef.current || new AudioContext();
      audioRef.current = context;
      if (context.state === 'suspended') context.resume();

      const now = context.currentTime;
      const output = context.createGain();
      output.gain.setValueAtTime(0.0001, now);
      output.gain.linearRampToValueAtTime(type === 'launch' ? 0.08 : 0.055, now + 0.012);
      output.gain.exponentialRampToValueAtTime(0.0001, now + (type === 'launch' ? 0.52 : 0.22));
      output.connect(context.destination);

      const playTone = (frequency, start, duration, wave = 'sine', endFrequency = frequency) => {
        const osc = context.createOscillator();
        const toneGain = context.createGain();
        osc.type = wave;
        osc.frequency.setValueAtTime(frequency, now + start);
        osc.frequency.exponentialRampToValueAtTime(endFrequency, now + start + duration);
        toneGain.gain.setValueAtTime(0.0001, now + start);
        toneGain.gain.linearRampToValueAtTime(0.8, now + start + 0.01);
        toneGain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
        osc.connect(toneGain);
        toneGain.connect(output);
        osc.start(now + start);
        osc.stop(now + start + duration + 0.03);
      };

      if (type === 'back') {
        playTone(520, 0, 0.14, 'triangle', 330);
      } else if (type === 'launch') {
        playTone(392, 0, 0.2, 'sine', 588);
        playTone(588, 0.08, 0.22, 'sine', 784);
        playTone(1176, 0.18, 0.22, 'triangle', 1568);
      } else if (type === 'navigate') {
        playTone(740, 0, 0.1, 'sine', 960);
        playTone(1240, 0.055, 0.12, 'triangle', 1480);
      } else {
        playTone(640, 0, 0.12, 'triangle', 900);
      }
    } catch (error) {
      console.warn('Tour sound unavailable', error);
    }
  }, [soundEnabled]);

  return { soundEnabled, setSoundEnabled, playSound };
};

const getPopoverStyle = (spotlight) => {
  const isMobile = window.innerWidth < 640;
  const isMobileTour = isMobileTourViewport();
  const width = isMobile ? window.innerWidth - 32 : isMobileTour ? Math.min(340, window.innerWidth - 32) : 360;
  const height = isMobile ? 360 : isMobileTour ? 260 : 300;
  const enoughRight = spotlight.left + spotlight.width + width + 28 < window.innerWidth;
  const enoughLeft = spotlight.left - width - 28 > 0;
  const left = isMobile
    ? 16
    : isMobileTour
      ? spotlight.left + spotlight.width / 2 > window.innerWidth / 2
        ? 16
        : window.innerWidth - width - 16
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
    : isMobileTour
      ? clamp(spotlight.top, 12, window.innerHeight - height - 86)
    : clamp(spotlight.top, 20, window.innerHeight - height - 20);

  return { left, top, width, maxHeight: isMobile || isMobileTour ? 'calc(100vh - 32px)' : undefined };
};

const getDesktopTourPopoverStyle = () => {
  const width = window.innerWidth >= 1280 ? 390 : 360;
  const left = clamp(window.innerWidth - width - 32, 340, window.innerWidth - width - 24);
  const top = clamp(104, 72, Math.max(72, window.innerHeight - 340));
  return { left, top, width, maxHeight: 'calc(100vh - 132px)' };
};

const getDesktopTourCuePoint = (popoverStyle) => ({
  x: popoverStyle.left + 26,
  y: popoverStyle.top + 58
});

export function OnboardingShowroom({
  open,
  settings,
  bookingOrigin,
  initialSceneId = 'intro',
  canApply = true,
  onSkip,
  onComplete,
  onNavigate
}) {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [tourFocus, setTourFocus] = useState(null);
  const [navCue, setNavCue] = useState(null);
  const [draft, setDraft] = useState({
    businessName: '',
    industry: '',
    instagram: '',
    tiktok: '',
    facebook: '',
    website: ''
  });
  const stageRef = useRef(null);
  const onNavigateRef = useRef(onNavigate);

  const scene = scenes[sceneIndex] || scenes[0];
  const generatedSlug = buildBookingSlug(draft.businessName, draft.instagram);
  const generatedLink = `${bookingOrigin}/book/${generatedSlug}`;
  const progress = Math.round(((sceneIndex + 1) / scenes.length) * 100);
  const { soundEnabled, setSoundEnabled, playSound } = useTourSound();
  const isMobileTour = useMobileTourViewport();

  useEffect(() => {
    onNavigateRef.current = onNavigate;
  }, [onNavigate]);

  useEffect(() => {
    if (!open) return;
    const nextIndex = scenes.findIndex(item => item.id === initialSceneId);
    setSceneIndex(nextIndex >= 0 ? nextIndex : 0);
    setDraft({
      businessName: settings.brandName || '',
      industry: settings.onboarding?.industry || settings.tagline || '',
      instagram: settings.socials?.instagram || '',
      tiktok: settings.socials?.tiktok || '',
      facebook: settings.socials?.facebook || '',
      website: settings.socials?.website || ''
    });
  }, [initialSceneId, open, settings.brandName, settings.onboarding?.industry, settings.tagline, settings.socials?.instagram, settings.socials?.tiktok, settings.socials?.facebook, settings.socials?.website]);

  useEffect(() => {
    if (!open || scene.type !== 'platform') return;
    onNavigateRef.current?.(scene.tab);
  }, [open, scene.id, scene.tab, scene.type]);

  useEffect(() => {
    if (!open || scene.type === 'platform') return;
    stageRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [open, scene.id, scene.type]);

  useLayoutEffect(() => {
    if (!open || scene.type !== 'platform') return undefined;

    let cancelled = false;
    const scrollTop = () => {
      window.requestAnimationFrame(() => {
        if (!cancelled) scrollWorkspaceToTop();
      });
    };

    scrollTop();
    const timer = window.setTimeout(scrollTop, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, scene.id, scene.type]);

  useLayoutEffect(() => {
    if (!open || scene.type !== 'platform') {
      setNavCue(null);
      return undefined;
    }

    let cancelled = false;
    let timer = null;
    let cleanupTimer = null;

    const updateCue = () => {
      if (cancelled) return;
      const navTarget = getTourNavTarget(scene.tab);
      const isMobileCue = isMobileTourViewport();
      const contentTarget = document.querySelector(`[data-tour="${scene.target}"]`);
      if (!navTarget) {
        timer = window.setTimeout(updateCue, 100);
        return;
      }

      window.requestAnimationFrame(() => {
        if (cancelled) return;
        const navRect = buildRect(navTarget.getBoundingClientRect(), 8);
        const contentRect = contentTarget ? buildRect(contentTarget.getBoundingClientRect(), 12) : null;
        const desktopPopoverStyle = isMobileCue ? null : getDesktopTourPopoverStyle();
        const fallbackTo = {
          x: clamp(navRect.left + navRect.width + 420, 240, window.innerWidth - 220),
          y: clamp(navRect.top + navRect.height / 2, 96, window.innerHeight - 96)
        };
        const cueDestination = desktopPopoverStyle
          ? getDesktopTourCuePoint(desktopPopoverStyle)
          : contentRect
            ? getRectCenter(contentRect)
            : fallbackTo;
        window.clearTimeout(cleanupTimer);
        setNavCue({
          sceneId: scene.id,
          tab: scene.tab,
          label: scene.kicker,
          navRect,
          contentRect,
          from: getRectCenter(navRect),
          to: cueDestination,
          phase: desktopPopoverStyle || contentRect ? 'ready' : 'seeking'
        });
        if (isMobileCue && !contentRect) {
          timer = window.setTimeout(updateCue, 90);
          return;
        }
        cleanupTimer = window.setTimeout(() => {
          if (!cancelled) setNavCue(current => current?.sceneId === scene.id ? { ...current, phase: 'settled' } : current);
        }, 5200);
      });
    };

    timer = window.setTimeout(updateCue, 180);
    window.addEventListener('resize', updateCue);
    window.addEventListener('scroll', updateCue, true);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearTimeout(cleanupTimer);
      window.removeEventListener('resize', updateCue);
      window.removeEventListener('scroll', updateCue, true);
    };
  }, [open, scene.id, scene.tab, scene.target, scene.type]);

  useLayoutEffect(() => {
    if (!open || scene.type !== 'platform' || isMobileTour) {
      setTourFocus(null);
      return undefined;
    }

    let cancelled = false;

    const updateFocus = () => {
      if (cancelled) return;
      window.requestAnimationFrame(() => {
        if (cancelled) return;
        setTourFocus({
          sceneId: scene.id,
          target: scene.target,
          spotlightStyle: null,
          popoverStyle: getDesktopTourPopoverStyle(),
          naturalDesktop: true
        });
      });
    };

    updateFocus();
    window.addEventListener('resize', updateFocus);

    return () => {
      cancelled = true;
      window.removeEventListener('resize', updateFocus);
    };
  }, [isMobileTour, open, scene.id, scene.target, scene.type]);

  const next = () => {
    const nextScene = scenes[Math.min(sceneIndex + 1, scenes.length - 1)];
    playSound(nextScene?.type === 'platform' ? 'navigate' : nextScene?.type === 'launch' ? 'launch' : 'tap');
    setSceneIndex(index => Math.min(index + 1, scenes.length - 1));
  };
  const back = () => {
    playSound('back');
    setSceneIndex(index => Math.max(index - 1, 0));
  };
  const updateDraft = (key, value) => setDraft(prev => ({ ...prev, [key]: value }));
  const skipTour = () => {
    playSound('back');
    onSkip?.();
  };
  const complete = (destination = 'editor') => {
    playSound('launch');
    onComplete(draft, { destination });
  };

  if (!open) return null;

  const stageBackground = scene.type === 'platform'
    ? 'pointer-events-none overflow-visible'
    : 'bg-[#FBFBFB] text-black pointer-events-auto overflow-y-auto overflow-x-hidden overscroll-contain tour-scroll-stage';

  return (
    <div ref={stageRef} className={`fixed inset-0 z-[9998] ${scene.type === 'platform' ? 'text-white' : 'text-black'} ${stageBackground}`}>
      <TopProgress progress={progress} />
      <SkipButton
        onSkip={skipTour}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled(enabled => !enabled)}
        darkControls={scene.type === 'platform' && isMobileTour}
        lightControls={scene.type !== 'platform'}
      />

      {scene.type !== 'platform' && (
        <div className="absolute inset-0 opacity-[0.05] bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:72px_72px]" />
      )}

      {scene.type === 'cinema' && (
        <CinemaScene
          generatedLink={generatedLink}
          onNext={next}
          onJump={() => {
            playSound('navigate');
            setSceneIndex(6);
          }}
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
          navCue={navCue}
          progress={progress}
          isMobileTour={isMobileTour}
          onBack={back}
          onNext={next}
          onNavigate={(tab) => {
            playSound('navigate');
            onNavigate?.(tab);
          }}
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
    <div className="fixed inset-x-0 top-0 z-50 h-1 bg-black/5">
      <div className="h-full bg-black transition-all duration-700" style={{ width: `${progress}%` }} />
    </div>
  );
}

function SkipButton({ onSkip, soundEnabled, onToggleSound, darkControls = false, lightControls = false }) {
  const SoundIcon = soundEnabled ? Volume2 : VolumeX;
  const controlClass = darkControls
    ? 'bg-black/85 border-black/10 text-white hover:bg-black shadow-2xl'
    : lightControls
      ? 'bg-white/90 border-neutral-200 text-black hover:bg-neutral-50 shadow-2xl'
      : 'bg-white/10 border-white/15 text-white/70 hover:text-white hover:bg-white/15 shadow-2xl';
  return (
    <div className="fixed right-4 top-4 md:right-8 md:top-8 z-50 flex items-center gap-2 pointer-events-auto">
      <button
        onClick={onToggleSound}
        className={`h-11 w-11 rounded-full border flex items-center justify-center backdrop-blur-xl ${controlClass}`}
        aria-label={soundEnabled ? 'Mute tour sound' : 'Enable tour sound'}
      >
        <SoundIcon size={15} />
      </button>
      <button
        onClick={onSkip}
        className={`h-11 px-4 rounded-full border text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 backdrop-blur-xl ${controlClass}`}
      >
        <SkipForward size={14} /> Skip Tour
      </button>
    </div>
  );
}

function CinemaScene({ generatedLink, onNext, onJump }) {
  return (
    <section className="relative z-10 min-h-full px-5 md:px-10 xl:px-16 py-24 flex items-start md:items-center">
      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-12 gap-10 items-center">
        <div className="xl:col-span-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-8 shadow-sm">
            <Sparkles size={14} /> Build A Booking Intro
          </div>
          <h1 className="text-5xl md:text-7xl xl:text-[92px] font-bold tracking-tight leading-[0.9] mb-8">
            Welcome to Build A Booking. Let's get you set up and take the tour.
          </h1>
          <p className="text-lg md:text-2xl text-neutral-500 max-w-3xl leading-relaxed mb-10">
            A quick cinematic setup that shows the real platform, highlights the tools that matter, and builds your first booking identity step by step.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={onNext} className="h-14 px-7 rounded-full bg-black text-white text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors shadow-2xl shadow-black/15">
              Begin Setup <ArrowRight size={15} />
            </button>
            <button onClick={onJump} className="h-14 px-7 rounded-full bg-white border border-neutral-200 text-black text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-neutral-50 transition-colors shadow-sm">
              Watch Platform Tour <Eye size={15} />
            </button>
          </div>
        </div>

        <div className="xl:col-span-5">
          <div className="relative rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-[0_40px_120px_-80px_rgba(15,23,42,0.35)]">
            <div className="aspect-[4/5] rounded-[1.5rem] bg-[#FAFAFA] text-black border border-neutral-100 p-6 md:p-8 flex flex-col justify-between overflow-hidden">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-black text-white flex items-center justify-center mb-12">
                  <MousePointerClick size={22} />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-neutral-400 mb-3">Experience Mode</p>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-none mb-5">Meet your new best friend for bookings.</h2>
                <p className="text-neutral-500 leading-relaxed">Set up the basics, see where everything lives, and get comfortable before your first client books.</p>
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
    <section className="relative z-10 min-h-full px-5 md:px-10 xl:px-16 py-24 flex items-start md:items-center">
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 xl:grid-cols-12 gap-8 items-stretch">
        <div className="xl:col-span-7 rounded-[2rem] border border-neutral-200 bg-white p-5 md:p-8 xl:p-10 shadow-[0_40px_120px_-80px_rgba(15,23,42,0.38)]">
          <p className="text-[10px] font-bold uppercase tracking-[0.45em] text-neutral-400 mb-5">{copy.eyebrow}</p>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-none mb-5">{copy.title}</h2>
          <p className="text-neutral-500 text-lg leading-relaxed max-w-2xl mb-10">{copy.helper}</p>

          {field !== 'socials' ? (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.35em] text-neutral-400 block mb-4">{copy.label}</label>
              <input
                value={inputValue}
                onChange={(event) => updateDraft(field, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onNext();
                }}
                list={field === 'industry' ? 'industry-options' : undefined}
                placeholder={copy.placeholder}
                autoFocus
                className="w-full bg-transparent border-0 border-b border-neutral-200 focus:border-black text-4xl md:text-6xl font-bold tracking-tight outline-none py-5 text-black placeholder:text-neutral-300"
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
                      className="h-10 px-4 rounded-full bg-neutral-50 border border-neutral-200 text-[10px] font-bold uppercase tracking-widest text-neutral-500 hover:bg-black hover:text-white hover:border-black transition-colors"
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
                <label key={key} className="rounded-2xl border border-neutral-200 bg-white text-black p-4">
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
            <button onClick={onNext} className="h-14 px-7 py-4 rounded-full bg-black text-white text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors shadow-2xl shadow-black/15">
              Continue <ArrowRight size={15} />
            </button>
            <button onClick={onBack} className="h-14 px-7 py-4 rounded-full bg-white border border-neutral-200 text-neutral-500 text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:text-black hover:bg-neutral-50 transition-colors">
              <ChevronLeft size={15} /> Back
            </button>
          </div>
        </div>

        <aside className="xl:col-span-5 rounded-[2rem] bg-white text-black border border-neutral-200 p-6 md:p-8 flex flex-col justify-between shadow-[0_35px_100px_-80px_rgba(15,23,42,0.38)]">
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
    <section className="relative z-10 min-h-full px-5 md:px-10 xl:px-16 py-24 flex items-start md:items-center">
      <div className="max-w-5xl mx-auto text-center">
        <div className="w-16 h-16 rounded-2xl bg-black text-white flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-black/15">
          <Check size={24} />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.45em] text-neutral-400 mb-5">Identity locked</p>
        <h2 className="text-5xl md:text-7xl xl:text-8xl font-bold tracking-tight leading-[0.9] mb-8">
          {draft.businessName || 'Your business'} now has a booking link.
        </h2>
        <div className="rounded-[2rem] bg-white text-black border border-neutral-200 p-6 md:p-8 mb-10 text-left shadow-[0_35px_100px_-80px_rgba(15,23,42,0.45)]">
          <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-3">Client-facing link</p>
          <p className="text-xl md:text-3xl font-bold break-all">{generatedLink}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={onNext} className="h-14 px-7 rounded-full bg-black text-white text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors shadow-2xl shadow-black/15">
            Walk The Platform <Search size={15} />
          </button>
          <button onClick={onBack} className="h-14 px-7 rounded-full bg-white border border-neutral-200 text-neutral-500 text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:text-black hover:bg-neutral-50 transition-colors">
            <ChevronLeft size={15} /> Back
          </button>
        </div>
      </div>
    </section>
  );
}

function PlatformScene({ scene, sceneIndex, focus, navCue, isMobileTour, onBack, onNext, onNavigate }) {
  const isFocusReady = focus?.sceneId === scene.id && focus?.target === scene.target;
  const isNaturalDesktopTour = Boolean(focus?.naturalDesktop);
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
  const showCurrentArea = () => {
    onNavigate?.(scene.tab);
    window.requestAnimationFrame(() => {
      if (isMobileTour) {
        scrollWorkspaceToTop();
        return;
      }
      const target = document.querySelector(`[data-tour="${scene.target}"]`);
      if (target) scrollTargetForTour(target, false);
    });
  };

  if (isMobileTour) {
    return (
      <MobilePlatformScene
        scene={scene}
        sceneIndex={sceneIndex}
        navCue={navCue}
        onBack={onBack}
        onNext={onNext}
        onShowArea={showCurrentArea}
      />
    );
  }

  return (
    <>
      <NavigationClickCue cue={navCue} />
      {!isNaturalDesktopTour && spotlight && <SpotlightPanels spotlight={spotlight} />}
      {!isNaturalDesktopTour && spotlight?.target === scene.target && (
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
          className="tour-popover fixed z-[10002] pointer-events-auto overflow-y-auto rounded-[1.5rem] bg-white text-black p-4 md:p-6 shadow-[0_28px_90px_-42px_rgba(0,0,0,0.62)] border border-black/10"
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
          <p className="tour-copy-line rounded-2xl bg-neutral-100 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-500 mb-5" style={{ animationDelay: '180ms' }}>
            Scroll this page freely. The tour will stay out of your way.
          </p>
          <div className="tour-copy-line flex items-center justify-between gap-3" style={{ animationDelay: '210ms' }}>
            <button onClick={onBack} className="h-11 px-4 rounded-full bg-neutral-100 text-neutral-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:text-black">
              <ChevronLeft size={14} /> Back
            </button>
            <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-300">{sceneIndex - 5} / 8</div>
            <button onClick={onNext} className="h-11 px-5 rounded-full bg-black text-white text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-neutral-800">
              Next <ArrowRight size={14} />
            </button>
          </div>
          {!isNaturalDesktopTour && (
            <button
              onClick={showCurrentArea}
              className="mt-3 w-full h-10 rounded-full border border-neutral-200 text-[10px] font-bold uppercase tracking-widest text-neutral-500 hover:text-black hover:bg-neutral-50 flex items-center justify-center gap-2"
            >
              <MousePointerClick size={14} /> Show This Area
            </button>
          )}
        </div>
      )}
    </>
  );
}

function MobilePlatformScene({ scene, sceneIndex, navCue, onBack, onNext, onShowArea }) {
  return (
    <>
      <MobileTabCue cue={navCue} />

      <div className="fixed left-3 right-3 bottom-[5.4rem] z-[10004] pointer-events-none">
        <div className="tour-mobile-platform-card pointer-events-auto rounded-[1.15rem] bg-white/95 text-black border border-black/10 shadow-[0_18px_70px_-32px_rgba(0,0,0,0.72)] overflow-hidden backdrop-blur-xl">
          <div className="p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="tour-copy-line text-[8px] font-bold uppercase tracking-[0.28em] text-neutral-400 mb-1.5">{scene.kicker}</p>
                <h2 className="tour-copy-line text-[20px] font-bold tracking-tight leading-[0.98]" style={{ animationDelay: '60ms' }}>{scene.title}</h2>
                <p className="tour-copy-line mt-2 text-[13px] text-neutral-500 leading-relaxed" style={{ animationDelay: '120ms' }}>{scene.text}</p>
                <p className="tour-copy-line mt-2 text-[9px] font-bold uppercase tracking-[0.18em] text-neutral-400" style={{ animationDelay: '170ms' }}>
                  Scroll this page, then tap next.
                </p>
              </div>
              <button
                type="button"
                onClick={onShowArea}
                className="h-10 w-10 rounded-full bg-black text-white flex items-center justify-center shrink-0 active:scale-95"
                aria-label="Back to top of this section"
              >
                <ArrowUpRight size={16} />
              </button>
            </div>
          </div>

          <div className="border-t border-neutral-100 px-3 py-2.5 bg-white/90">
            <div className="flex items-center justify-between gap-2">
              <button onClick={onBack} className="h-10 px-4 rounded-full bg-neutral-100 text-neutral-500 text-[9px] font-bold uppercase tracking-widest flex items-center gap-2 active:scale-95">
                <ChevronLeft size={14} /> Back
              </button>
              <div className="text-[9px] font-bold uppercase tracking-widest text-neutral-300">{sceneIndex - 5} / 8</div>
              <button onClick={onNext} className="h-10 px-5 rounded-full bg-black text-white text-[9px] font-bold uppercase tracking-widest flex items-center gap-2 active:scale-95">
                Next <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function MobileTabCue({ cue }) {
  if (!cue?.navRect) return null;

  const width = typeof window !== 'undefined' ? window.innerWidth : 390;
  const labelWidth = 148;
  const left = clamp(cue.navRect.left + cue.navRect.width / 2 - labelWidth / 2, 10, width - labelWidth - 10);
  const labelTop = Math.max(10, cue.navRect.top - 36);

  return (
    <div className="pointer-events-none fixed inset-0 z-[10003]">
      <div
        className="tour-nav-target absolute rounded-[1rem] border-2 border-[#39FF14] shadow-[0_0_30px_rgba(57,255,20,0.7)]"
        style={{ top: cue.navRect.top, left: cue.navRect.left, width: cue.navRect.width, height: cue.navRect.height }}
      />
      <div
        className="tour-nav-cursor absolute h-8 w-8 rounded-full bg-[#39FF14] text-black flex items-center justify-center shadow-[0_14px_40px_rgba(57,255,20,0.55)]"
        style={{ top: cue.navRect.top + cue.navRect.height / 2 - 16, left: cue.navRect.left + cue.navRect.width / 2 - 16 }}
      >
        <MousePointerClick size={14} strokeWidth={3} />
      </div>
      <div
        className="absolute rounded-full bg-black text-white border border-[#39FF14]/40 shadow-2xl px-3 py-1.5 text-[8px] font-bold uppercase tracking-[0.22em] text-center"
        style={{ top: labelTop, left, width: labelWidth }}
      >
        Opening {cue.label}
      </div>
    </div>
  );
}

function NavigationClickCue({ cue }) {
  if (!cue?.navRect || !cue?.from || !cue?.to || cue.phase === 'settled') return null;

  const width = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const height = typeof window !== 'undefined' ? window.innerHeight : 900;
  const curveX = cue.from.x + (cue.to.x - cue.from.x) * 0.42;
  const curveY = cue.from.y - 70;
  const path = `M ${cue.from.x} ${cue.from.y} Q ${curveX} ${curveY} ${cue.to.x} ${cue.to.y}`;

  return (
    <div className="pointer-events-none fixed inset-0 z-[10003]">
      <svg className="tour-nav-arrow absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <filter id={`tour-arrow-glow-${cue.sceneId}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker id={`tour-arrow-head-${cue.sceneId}`} markerWidth="13" markerHeight="13" refX="10" refY="6.5" orient="auto">
            <path d="M 0 0 L 12 6.5 L 0 13 z" fill="#39FF14" />
          </marker>
        </defs>
        <path
          d={path}
          fill="none"
          stroke="rgba(57,255,20,0.92)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="10 12"
          filter={`url(#tour-arrow-glow-${cue.sceneId})`}
          markerEnd={`url(#tour-arrow-head-${cue.sceneId})`}
        />
      </svg>

      <div
        className="tour-nav-target absolute rounded-[1.1rem] border-2 border-[#39FF14] shadow-[0_0_36px_rgba(57,255,20,0.65)]"
        style={{ top: cue.navRect.top, left: cue.navRect.left, width: cue.navRect.width, height: cue.navRect.height }}
      />
      <div
        className="tour-nav-cursor absolute h-9 w-9 rounded-full bg-[#39FF14] text-black flex items-center justify-center shadow-[0_18px_50px_rgba(57,255,20,0.55)]"
        style={{ top: cue.from.y - 18, left: cue.from.x - 18 }}
      >
        <MousePointerClick size={16} strokeWidth={3} />
      </div>
      <div
        className="tour-nav-endpoint absolute h-5 w-5 rounded-full border-2 border-[#39FF14] bg-black shadow-[0_0_34px_rgba(57,255,20,0.75)]"
        style={{ top: cue.to.y - 10, left: cue.to.x - 10 }}
      />
      <div
        className="tour-nav-label absolute rounded-full bg-black text-white border border-[#39FF14]/40 shadow-2xl px-4 py-2 text-[9px] font-bold uppercase tracking-[0.28em]"
        style={{
          top: Math.max(16, cue.navRect.top - 44),
          left: Math.min(width - 240, Math.max(16, cue.navRect.left))
        }}
      >
        Opening {cue.label}
      </div>
    </div>
  );
}

function SpotlightPanels({ spotlight }) {
  if (!spotlight) {
    return <div className="fixed inset-0 z-[10000] pointer-events-none bg-black/70 backdrop-blur-sm" />;
  }

  const right = window.innerWidth - spotlight.left - spotlight.width;
  const bottom = window.innerHeight - spotlight.top - spotlight.height;
  const panelClass = 'fixed z-[10000] pointer-events-none bg-black/72 backdrop-blur-[2px]';

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
    <section className="relative z-10 min-h-full px-5 md:px-10 xl:px-16 py-24 flex items-start md:items-center">
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 xl:grid-cols-12 gap-8 items-stretch">
        <div className="xl:col-span-7 rounded-[2rem] bg-white text-black border border-neutral-200 p-6 md:p-10 shadow-[0_35px_100px_-80px_rgba(15,23,42,0.45)]">
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

        <div className="xl:col-span-5 rounded-[2rem] border border-neutral-200 bg-white text-black p-6 md:p-8 flex flex-col justify-between shadow-[0_35px_100px_-80px_rgba(15,23,42,0.38)]">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-2">Next best actions</p>
            <h3 className="text-3xl font-bold tracking-tight mb-4">Make it unmistakably yours.</h3>
            <p className="text-neutral-500 leading-relaxed mb-6">Start with identity, theme, schedule, and communication. The workspace is ready to guide the rest.</p>
            <div className="space-y-3">
              {[
                [Palette, 'Choose a theme'],
                [Calendar, 'Tune availability'],
                [Mail, 'Set up messages'],
                [ShieldCheck, 'Invite staff']
              ].map(([Icon, label]) => (
                <div key={label} className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                  <Icon size={15} />
                  <span className="text-sm font-bold">{label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8">
            <button onClick={() => onFinish('editor')} disabled={!canApply} className="h-12 rounded-full bg-black text-white text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40 hover:bg-neutral-800">
              Finish In Editor <ArrowRight size={15} />
            </button>
            <button onClick={onBack} className="h-12 rounded-full bg-white border border-neutral-200 text-neutral-500 text-[10px] font-bold uppercase tracking-widest hover:text-black hover:bg-neutral-50 flex items-center justify-center gap-2">
              <ChevronLeft size={15} /> Back
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
