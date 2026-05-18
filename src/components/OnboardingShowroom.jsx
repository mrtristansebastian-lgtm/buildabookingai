import { useEffect, useState } from 'react';
import { ArrowRight, Briefcase, Calendar, Check, CheckCircle2, Globe, Layers, Mail, Palette, PanelRightOpen, Search, ShieldCheck, SkipForward, Sparkles, Star, Users, Zap } from 'lucide-react';

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
      version: 1,
      industry,
      completedAt: metadata.completedAt || Date.now(),
      skippedAt: metadata.skippedAt || null
    }
  };
};

const toolStops = [
  { title: 'Dashboard', label: 'Portfolio view', icon: PanelRightOpen, text: 'See today, requests, clients, schedule health, page readiness, and business signals in one clean command center.', tab: 'overview' },
  { title: 'Bookings', label: 'Request desk', icon: Layers, text: 'Approve requests, move people to waitlist, assign staff, and send quick client updates from the queue.', tab: 'bookings' },
  { title: 'Schedule', label: 'Availability studio', icon: Calendar, text: 'Tune default slots, close days, add custom times, and read day, week, and month booking-rate stats.', tab: 'business' },
  { title: 'Email Studio', label: 'Client messaging', icon: Mail, text: 'Customize confirmations, waitlist notes, running-late messages, and review requests with your logo and brand info.', tab: 'communications' },
  { title: 'Editor', label: 'Design system', icon: Palette, text: 'Try themes, fonts, logos, banners, copy, features, social links, and backend skin settings with live preview.', tab: 'editor' },
  { title: 'My Clients', label: 'Client book', icon: Star, text: 'Track profiles, notes, photos, booking history, first timers, regulars, VIP labels, and follow-up signals.', tab: 'clients' },
  { title: 'Team', label: 'Staff access', icon: Users, text: 'Invite staff by email, detect their Google accounts, assign roles, and keep bookings tied to the right person.', tab: 'staff' },
  { title: 'Profile', label: 'Business hub', icon: Briefcase, text: 'Manage your logo, banner, business info, social handles, account details, and affiliate link.', tab: 'profile' }
];

export function OnboardingShowroom({
  open,
  settings,
  bookingOrigin,
  canApply = true,
  onSkip,
  onComplete,
  onNavigate
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState({
    businessName: '',
    industry: '',
    instagram: '',
    tiktok: '',
    facebook: '',
    website: ''
  });

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setDraft({
      businessName: settings.brandName || '',
      industry: settings.onboarding?.industry || settings.tagline || '',
      instagram: settings.socials?.instagram || '',
      tiktok: settings.socials?.tiktok || '',
      facebook: settings.socials?.facebook || '',
      website: settings.socials?.website || ''
    });
  }, [open, settings.brandName, settings.onboarding?.industry, settings.tagline, settings.socials?.instagram, settings.socials?.tiktok, settings.socials?.facebook, settings.socials?.website]);

  if (!open) return null;

  const generatedSlug = buildBookingSlug(draft.businessName, draft.instagram);
  const generatedLink = `${bookingOrigin}/book/${generatedSlug}`;
  const progress = Math.round(((step + 1) / 4) * 100);

  const updateDraft = (key, value) => setDraft(prev => ({ ...prev, [key]: value }));
  const complete = (destination = 'overview') => {
    onComplete(draft, { destination });
  };

  return (
    <div className="fixed inset-0 z-[9998] bg-[#050505] text-white overflow-hidden">
      <div className="absolute inset-0 opacity-[0.08] bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:64px_64px]" />
      <div className="absolute inset-x-0 top-0 h-1 bg-white/10">
        <div className="h-full bg-[#39FF14] transition-all duration-700" style={{ width: `${progress}%` }} />
      </div>

      <button
        onClick={onSkip}
        className="absolute right-4 top-4 md:right-8 md:top-8 z-20 h-11 px-4 rounded-lg bg-white/10 border border-white/10 text-white/70 hover:text-white hover:bg-white/15 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"
      >
        <SkipForward size={14} /> Skip Tour
      </button>

      <div className="relative z-10 h-full grid grid-cols-1 xl:grid-cols-12">
        <aside className="hidden xl:flex xl:col-span-3 border-r border-white/10 p-8 flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-12">
              <img src="/logoblackonwhite.png" alt="Build A Booking" className="w-11 h-11 rounded-lg bg-white object-contain" />
              <div>
                <p className="text-sm font-bold tracking-tight">Build A Booking</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/35">Showroom Intro</p>
              </div>
            </div>
            <div className="space-y-3">
              {['Welcome', 'Business setup', 'Tool tour', 'Launch'].map((label, index) => (
                <button
                  key={label}
                  onClick={() => setStep(index)}
                  className={`w-full text-left rounded-lg border p-4 transition-all ${step === index ? 'bg-white text-black border-white' : 'bg-white/5 border-white/10 text-white/55 hover:text-white hover:bg-white/10'}`}
                >
                  <span className="text-[9px] font-bold uppercase tracking-widest opacity-45">0{index + 1}</span>
                  <p className="text-sm font-bold mt-1">{label}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/35 mb-2">Your Booking Link</p>
            <p className="text-sm font-bold text-[#39FF14] break-all">{generatedLink}</p>
          </div>
        </aside>

        <main className="xl:col-span-9 h-full overflow-y-auto">
          {step === 0 && (
            <section className="min-h-full flex items-center px-5 md:px-10 xl:px-16 py-24">
              <div className="max-w-5xl">
                <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white/55 mb-8">
                  <Sparkles size={14} className="text-[#39FF14]" /> Welcome Showroom
                </div>
                <h1 className="text-5xl md:text-7xl xl:text-8xl font-bold tracking-tight leading-[0.92] mb-8">
                  Welcome to the place your bookings start feeling premium.
                </h1>
                <p className="text-lg md:text-2xl text-white/55 max-w-3xl leading-relaxed mb-10">
                  We will set up your business identity, create your booking link, and walk you through every tool inside Build A Booking.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button onClick={() => setStep(1)} className="h-14 px-7 rounded-lg bg-[#39FF14] text-black text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:brightness-95">
                    Start Setup <ArrowRight size={15} />
                  </button>
                  <button onClick={() => setStep(2)} className="h-14 px-7 rounded-lg bg-white/10 border border-white/10 text-white text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white/15">
                    Tour Tools <Search size={15} />
                  </button>
                </div>
              </div>
            </section>
          )}

          {step === 1 && (
            <section className="min-h-full px-5 md:px-10 xl:px-16 py-24">
              <div className="max-w-6xl">
                <p className="text-[10px] font-bold uppercase tracking-[0.45em] text-[#39FF14] mb-4">Business Setup</p>
                <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-5">Create the first version of your booking brand.</h2>
                <p className="text-white/50 text-lg max-w-2xl mb-10">This gives your page a name, a category, social links, and a clean link clients can remember.</p>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-7 rounded-lg border border-white/10 bg-white/[0.04] p-5 md:p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="md:col-span-2">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-white/35 block mb-2">Business Name</span>
                        <input value={draft.businessName} onChange={(e) => updateDraft('businessName', e.target.value)} placeholder="Studio Noir" className="w-full h-14 rounded-lg bg-white text-black px-4 text-base font-bold outline-none" />
                      </label>
                      <label>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-white/35 block mb-2">Industry</span>
                        <input value={draft.industry} onChange={(e) => updateDraft('industry', e.target.value)} list="industry-options" placeholder="Beauty Studio" className="w-full h-14 rounded-lg bg-white text-black px-4 text-sm font-bold outline-none" />
                        <datalist id="industry-options">
                          {industries.map(industry => <option key={industry} value={industry} />)}
                        </datalist>
                      </label>
                      <label>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-white/35 block mb-2">Instagram</span>
                        <input value={draft.instagram} onChange={(e) => updateDraft('instagram', e.target.value)} placeholder="@yourstudio" className="w-full h-14 rounded-lg bg-white text-black px-4 text-sm font-bold outline-none" />
                      </label>
                      <label>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-white/35 block mb-2">TikTok</span>
                        <input value={draft.tiktok} onChange={(e) => updateDraft('tiktok', e.target.value)} placeholder="@yourstudio" className="w-full h-14 rounded-lg bg-white text-black px-4 text-sm font-bold outline-none" />
                      </label>
                      <label>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-white/35 block mb-2">Facebook</span>
                        <input value={draft.facebook} onChange={(e) => updateDraft('facebook', e.target.value)} placeholder="yourstudio" className="w-full h-14 rounded-lg bg-white text-black px-4 text-sm font-bold outline-none" />
                      </label>
                      <label className="md:col-span-2">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-white/35 block mb-2">Website</span>
                        <input value={draft.website} onChange={(e) => updateDraft('website', e.target.value)} placeholder="yourstudio.com" className="w-full h-14 rounded-lg bg-white text-black px-4 text-sm font-bold outline-none" />
                      </label>
                    </div>
                  </div>

                  <div className="lg:col-span-5 rounded-lg bg-white text-black p-5 md:p-6 flex flex-col justify-between">
                    <div>
                      <div className="w-12 h-12 rounded-lg bg-black text-[#39FF14] flex items-center justify-center mb-8">
                        <Globe size={18} />
                      </div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-2">Auto-created link</p>
                      <p className="text-lg md:text-xl font-bold break-all mb-6">{generatedLink}</p>
                      <div className="space-y-3">
                        {[
                          ['Business page', draft.businessName || settings.brandName || 'Your Business'],
                          ['Category signal', draft.industry || settings.tagline || 'Private Studio'],
                          ['Primary handle', normalizeHandle(draft.instagram) ? `@${normalizeHandle(draft.instagram)}` : 'Add Instagram to shape the link']
                        ].map(row => (
                          <div key={row[0]} className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-3 last:border-0">
                            <span className="text-sm text-neutral-500">{row[0]}</span>
                            <span className="text-sm font-bold text-right">{row[1]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8">
                      <button onClick={() => complete('editor')} disabled={!canApply} className="h-12 rounded-lg bg-black text-white text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40">
                        <Check size={15} /> Apply Setup
                      </button>
                      <button onClick={() => setStep(2)} className="h-12 rounded-lg border border-neutral-200 text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-50">
                        Continue Tour
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="min-h-full px-5 md:px-10 xl:px-16 py-24">
              <div className="max-w-6xl">
                <p className="text-[10px] font-bold uppercase tracking-[0.45em] text-[#39FF14] mb-4">Tool Tour</p>
                <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-5">A complete business cockpit, room by room.</h2>
                <p className="text-white/50 text-lg max-w-2xl mb-10">Every section is built for a business owner who needs the work to feel simple, polished, and connected.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {toolStops.map(tool => {
                    const Icon = tool.icon;
                    return (
                      <button key={tool.title} onClick={() => onNavigate(tool.tab)} className="group min-h-[220px] rounded-lg border border-white/10 bg-white/[0.04] p-5 text-left hover:bg-white hover:text-black transition-all">
                        <div className="w-11 h-11 rounded-lg bg-white/10 group-hover:bg-black group-hover:text-[#39FF14] flex items-center justify-center mb-8 transition-colors">
                          <Icon size={18} />
                        </div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-[#39FF14] group-hover:text-neutral-500 mb-2">{tool.label}</p>
                        <h3 className="text-xl font-bold tracking-tight mb-3">{tool.title}</h3>
                        <p className="text-sm leading-relaxed text-white/50 group-hover:text-neutral-500">{tool.text}</p>
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-end mt-8">
                  <button onClick={() => setStep(3)} className="h-12 px-6 rounded-lg bg-[#39FF14] text-black text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                    Final Step <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="min-h-full flex items-center px-5 md:px-10 xl:px-16 py-24">
              <div className="max-w-6xl w-full">
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
                  <div className="xl:col-span-7 rounded-lg bg-white text-black p-6 md:p-10">
                    <div className="w-14 h-14 rounded-lg bg-black text-[#39FF14] flex items-center justify-center mb-10">
                      <Zap size={22} />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.45em] text-neutral-400 mb-4">Ready</p>
                    <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-none mb-6">Your workspace is ready for its first client.</h2>
                    <p className="text-neutral-500 text-lg leading-relaxed mb-8">Apply the setup, publish your page, then refine theme, schedule, team, clients, and email studio at your own pace.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        ['Setup', 'Brand and link'],
                        ['Tour', 'All tools'],
                        ['Publish', 'Booking page']
                      ].map(item => (
                        <div key={item[0]} className="rounded-lg border border-neutral-100 bg-neutral-50 p-4">
                          <CheckCircle2 size={17} className="text-emerald-500 mb-4" />
                          <p className="text-sm font-bold">{item[0]}</p>
                          <p className="text-xs text-neutral-500 mt-1">{item[1]}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="xl:col-span-5 rounded-lg border border-white/10 bg-white/[0.04] p-6 md:p-8 flex flex-col justify-between">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-white/35 mb-2">Suggested Next Move</p>
                      <h3 className="text-3xl font-bold tracking-tight mb-4">Open the Editor and make it yours.</h3>
                      <p className="text-white/50 leading-relaxed mb-6">Start with identity, then themes, then schedule. The booking page preview will show every change live.</p>
                      <div className="space-y-3">
                        {[
                          [Palette, 'Choose a theme'],
                          [Calendar, 'Tune availability'],
                          [Mail, 'Connect emails'],
                          [ShieldCheck, 'Invite staff']
                        ].map(([Icon, label]) => (
                          <div key={label} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                            <Icon size={15} className="text-[#39FF14]" />
                            <span className="text-sm font-bold">{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8">
                      <button onClick={() => complete('editor')} disabled={!canApply} className="h-12 rounded-lg bg-[#39FF14] text-black text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40">
                        Finish In Editor <ArrowRight size={15} />
                      </button>
                      <button onClick={() => complete('overview')} disabled={!canApply} className="h-12 rounded-lg bg-white/10 border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-white/15 disabled:opacity-40">
                        Finish
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
