import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  Globe,
  Layers,
  Mail,
  MessageCircle,
  Palette,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  User,
  UserPlus,
  Users,
  X,
  Zap
} from 'lucide-react';

const manualSections = [
  {
    id: 'start',
    label: 'Start',
    kicker: 'First day',
    title: 'Know where everything lives.',
    summary: 'Use this manual when you need a plain answer about a button, a workflow, or the best order to set up a workspace.',
    icon: Sparkles,
    target: { tab: 'overview' },
    highlights: [
      'Dashboard is the daily command center.',
      'Editor controls the public booking page.',
      'Support Inbox keeps client conversations inside Build A Booking.',
      'Examples are marked clearly and never count in real stats.'
    ],
    actions: [
      { name: 'Owner Manual', meaning: 'Opens this guide from Dashboard or Profile whenever the user needs help.' },
      { name: 'Publish', meaning: 'Saves the current public booking page settings so clients see the latest version.' }
    ],
    workflow: [
      'Open Editor and choose an industry-first theme direction.',
      'Set schedule capacity before sharing the booking link.',
      'Use Bookings and Support Inbox daily once requests start arriving.'
    ],
    tips: [
      'If something is empty, the app shows a labelled example so the owner understands the future workflow.',
      'Guest mode is for browsing. Owners should sign in before relying on saved production data.'
    ]
  },
  {
    id: 'overview',
    label: 'Dashboard',
    kicker: 'Daily view',
    title: 'Run the day from one clean page.',
    summary: 'Dashboard shows today, week, or month performance without forcing owners to hunt through every tab.',
    icon: Layers,
    target: { tab: 'overview' },
    highlights: [
      'Today is the default because most owners need the next few actions first.',
      'Week and Month help spot capacity, booking rate, and trend changes.',
      'Next Actions points owners toward the work most likely to matter now.'
    ],
    actions: [
      { name: 'Today / Week / Month', meaning: 'Changes the stats and activity window.' },
      { name: 'Review', meaning: 'Opens Bookings filtered around pending work and waitlist activity.' },
      { name: 'Schedule', meaning: 'Opens the schedule manager to tune capacity and slots.' },
      { name: 'Edit Page', meaning: 'Opens the public page editor.' },
      { name: 'Publish', meaning: 'Pushes the current booking page setup live.' }
    ],
    workflow: [
      'Check Needs Review first.',
      'Look at Booking Rate and Open Slots to see if the day is healthy.',
      'Open Activity to handle requests, confirmations, and waitlist movement.',
      'Use Next Actions when the owner is unsure what to do next.'
    ],
    tips: [
      'Booking Rate means confirmed bookings divided by active requests for the selected period.',
      'Open Slots is available capacity, not total possible capacity.'
    ]
  },
  {
    id: 'bookings',
    label: 'Bookings',
    kicker: 'Booking desk',
    title: 'Turn every request into the right next step.',
    summary: 'Bookings is where owners approve, waitlist, decline, reschedule, assign, and follow up on requests.',
    icon: BookOpen,
    target: { tab: 'bookings' },
    highlights: [
      'The queue separates pending, confirmed, waitlist, and declined records.',
      'Client details sync into Clients after the form is submitted.',
      'Example rows explain the workflow without affecting stats.'
    ],
    actions: [
      { name: 'Approve', meaning: 'Confirms the booking and moves it into the confirmed flow.' },
      { name: 'Waitlist', meaning: 'Keeps the client interested when the day or slot is full.' },
      { name: 'Deny', meaning: 'Declines the request cleanly.' },
      { name: 'Reschedule', meaning: 'Moves the booking conversation toward another day or time.' },
      { name: 'Assign Staff', meaning: 'Links the booking to a team member for accountability.' },
      { name: 'Running Late / Review', meaning: 'Sends useful follow-up messages when those flows are enabled.' }
    ],
    workflow: [
      'Filter to Requests first.',
      'Open the record and check notes, contact details, and requested time.',
      'Approve, waitlist, decline, or start a reschedule conversation.',
      'Use Support Inbox when the client needs a message thread.'
    ],
    tips: [
      'If email collection is disabled in Editor Features, email updates for that client are disabled too.',
      'If mobile number collection is disabled, phone-based workflows cannot use that field.'
    ]
  },
  {
    id: 'schedule',
    label: 'Schedule',
    kicker: 'Availability studio',
    title: 'Control capacity without clutter.',
    summary: 'Schedule manages open days, closed days, staff availability, slot timelines, and booking capacity by day, week, or month.',
    icon: Calendar,
    target: { tab: 'business' },
    highlights: [
      'Month mode gives the full calendar view.',
      'Week and Day modes are quicker on mobile and for daily work.',
      'Hide Past removes old days so the current work is easier to scan.'
    ],
    actions: [
      { name: 'Month / Week / Day', meaning: 'Changes how much of the calendar is shown.' },
      { name: 'Hide Past', meaning: 'Shows only current and future days for a cleaner view.' },
      { name: 'Slot Timeline', meaning: 'Shows every bookable time or time period for the selected day.' },
      { name: 'Pencil', meaning: 'Opens the in-page editor for that slot.' },
      { name: 'Set Time / Period', meaning: 'Switches between a single appointment time and a longer bookable time range.' },
      { name: 'Delete Slot', meaning: 'Removes a time from that day when it is no longer offered.' },
      { name: 'Open / Closed', meaning: 'Controls whether clients can request that date.' }
    ],
    workflow: [
      'Open or close dates for the month.',
      'Open a day and tune the slot timeline with single times or time periods.',
      'Use staff calendar chips to check individual coverage.',
      'Check week or day stats before busy periods.'
    ],
    tips: [
      'Past-day edit controls hide automatically because those days no longer need availability edits.',
      'Confirmed booking counts show on the day tile so capacity is visible at a glance.'
    ]
  },
  {
    id: 'support',
    label: 'Support Inbox',
    kicker: 'In-house chat',
    title: 'Keep booking conversations in one place.',
    summary: 'Support Inbox keeps every client update in a shared thread tied to the right booking.',
    icon: MessageCircle,
    target: { tab: 'communications' },
    highlights: [
      'Owners can reply to client questions without leaving the dashboard.',
      'Threads can link to a booking so staff see the context instantly.',
      'Example chats show how the inbox works before the business has real messages.'
    ],
    actions: [
      { name: 'Open Thread', meaning: 'Shows the full conversation and linked booking context.' },
      { name: 'Reply', meaning: 'Sends a message into the client portal thread.' },
      { name: 'Confirm Linked Booking', meaning: 'Approves the booking connected to that chat when appropriate.' },
      { name: 'Open Bookings', meaning: 'Jumps to Bookings for deeper booking action.' }
    ],
    workflow: [
      'Open unread threads first.',
      'Check the linked booking card before replying.',
      'Use quick booking actions only when the request is clear.',
      'Keep client-specific conversation inside the thread so staff have the full story.'
    ],
    tips: [
      'This is not end-to-end encrypted yet, which keeps owner tools, staff support, and moderation practical.',
      'Clients see their side in the client portal under Chats.'
    ]
  },
  {
    id: 'editor',
    label: 'Editor',
    kicker: 'Public page engine',
    title: 'Shape the booking page clients trust.',
    summary: 'Editor controls the public booking page: identity, themes, visuals, features, copy, saved looks, and publishing.',
    icon: Palette,
    target: { tab: 'editor' },
    highlights: [
      'Industry comes first so the theme engine feels custom to the business.',
      'Mobile browser uses a lighter starter mode for stability.',
      'PC and app experiences keep the full theme engine available.'
    ],
    groups: [
      {
        title: 'Identity',
        target: { tab: 'editor', editorTab: 'identity' },
        items: [
          'Upload logo and banner that sync with the business profile.',
          'Show, hide, position, and size the booking page logo.',
          'Edit business name, tagline, welcome text, and booking link.',
          'Keep page identity clean before tuning themes, visuals, and copy.'
        ]
      },
      {
        title: 'Themes',
        target: { tab: 'editor', editorTab: 'themes' },
        items: [
          'Choose industry first, then refine by palette direction.',
          'Save a chosen look as a reusable template.',
          'Use the Build A Booking Native theme when the owner wants the platform brand style.',
          'Use logo color reading to pull brand colors into the theme direction.'
        ]
      },
      {
        title: 'Visuals',
        target: { tab: 'editor', editorTab: 'visuals' },
        items: [
          'Tune calendar style, time slot style, action button style, FAQ style, and social link styling.',
          'Control typography, font personality, and spacing so headings and subtext feel intentional.',
          'Use visuals after choosing a theme to polish the final page.'
        ]
      },
      {
        title: 'Features',
        target: { tab: 'editor', editorTab: 'features' },
        items: [
          'Choose which client fields are required, including email, phone, and notes.',
          'Enable or disable email update opt-in on the booking form.',
          'Turn FAQ, socials, waitlist, first available, and other client-facing tools on or off.'
        ]
      },
      {
        title: 'Copy',
        target: { tab: 'editor', editorTab: 'copy' },
        items: [
          'Edit section labels, button copy, confirmation wording, and client-facing microcopy.',
          'Keep copy short, useful, and aligned with the business personality.'
        ]
      }
    ],
    actions: [
      { name: 'Draft', meaning: 'Keeps the look available without treating it as the final live page.' },
      { name: 'Publish', meaning: 'Makes the current booking page settings live.' },
      { name: 'Save Template', meaning: 'Stores a polished look that can be reused for launches, seasons, or alternate pages.' }
    ],
    workflow: [
      'Choose industry and theme direction.',
      'Set identity and media.',
      'Polish visuals and typography.',
      'Enable only the client-facing features the business truly needs.',
      'Publish after previewing both PC and mobile.'
    ],
    tips: [
      'Logo center alignment acts as the master alignment for the booking page layout.',
      'Mobile browser keeps the editor lighter. Use the PC site or app for the full theme engine.'
    ]
  },
  {
    id: 'clients',
    label: 'Clients',
    kicker: 'Client directory',
    title: 'Remember the people behind the bookings.',
    summary: 'Clients turns booking form submissions into lightweight client profiles with history, labels, notes, and photos.',
    icon: Star,
    target: { tab: 'clients' },
    highlights: [
      'First-timer and regular labels can be detected from booking history.',
      'Owners and staff can add notes and profile photos.',
      'Manual clients can be added before they book online.'
    ],
    actions: [
      { name: 'Add Client', meaning: 'Creates a profile manually.' },
      { name: 'Labels', meaning: 'Marks regulars, first timers, no-show risks, VIPs, or custom segments.' },
      { name: 'Notes', meaning: 'Stores helpful private context for the business team.' },
      { name: 'Booking History', meaning: 'Shows how often the client has booked, cancelled, or returned.' }
    ],
    workflow: [
      'Let real bookings auto-create profiles.',
      'Add labels only when they help staff serve the client better.',
      'Use notes for preferences, not clutter.',
      'Review regulars before campaigns or busy weeks.'
    ],
    tips: [
      'Example clients are labelled and excluded from real stats.',
      'Client profile photos should stay business-appropriate and consent-friendly.'
    ]
  },
  {
    id: 'team',
    label: 'Team',
    kicker: 'Staff setup',
    title: 'Give the right people the right access.',
    summary: 'Team manages staff accounts, roles, access level, and booking assignment so owners do not carry every task alone.',
    icon: Users,
    target: { tab: 'team' },
    highlights: [
      'Owners keep full control.',
      'Admins can help manage operations.',
      'Staff can be assigned to bookings for clarity.'
    ],
    actions: [
      { name: 'Add Staff', meaning: 'Invites or creates a staff record.' },
      { name: 'Role', meaning: 'Controls whether someone is owner, admin, or staff.' },
      { name: 'Detected Accounts', meaning: 'Helps connect existing sign-ins to staff access.' },
      { name: 'Save Team Setup', meaning: 'Stores roster and access changes.' }
    ],
    workflow: [
      'Add the owner first.',
      'Add admins only for trusted people.',
      'Assign bookings to staff when the business has multiple operators.',
      'Review staff access whenever someone leaves.'
    ],
    tips: [
      'Staff permissions should stay simple at first. More granular permissions can come later.',
      'A clean roster makes booking history easier to audit.'
    ]
  },
  {
    id: 'profile',
    label: 'Profile',
    kicker: 'Business account',
    title: 'Control the workspace identity and account settings.',
    summary: 'Profile manages the owner account, business profile, brand media, social links, device session, billing placeholders, and referral link.',
    icon: User,
    target: { tab: 'profile' },
    highlights: [
      'Business profile details sync into the editor and booking page.',
      'Keep me logged in is for trusted devices.',
      'Affiliate link sits in Profile so sharing the platform stays easy.'
    ],
    actions: [
      { name: 'Save Profile', meaning: 'Stores account and business profile changes.' },
      { name: 'Keep Me Logged In', meaning: 'Keeps the session stable on trusted devices.' },
      { name: 'Sign Out', meaning: 'Ends the session cleanly.' },
      { name: 'Light / Dark Mode', meaning: 'Switches the owner workspace theme while keeping native accents readable.' },
      { name: 'Upgrade / Manage Billing', meaning: 'Future Stripe hooks for plan and billing control.' },
      { name: 'Copy Affiliate Link', meaning: 'Copies the referral link for recommending Build A Booking.' }
    ],
    workflow: [
      'Set account and business basics.',
      'Upload brand logo, banner, hero image, and footer image if needed.',
      'Add social links used on the public page.',
      'Save before leaving Profile.'
    ],
    tips: [
      'Brand media uploads live here, while booking page composition controls live in the Editor Style System.',
      'Use Sign Out if a shared device is involved.'
    ]
  },
  {
    id: 'client-portal',
    label: 'Client Portal',
    kicker: 'Client side',
    title: 'Give clients a simple place to stay updated.',
    summary: 'Clients can sign in, see bookings, manage profile details, and chat with the business from their own side of Build A Booking.',
    icon: UserPlus,
    target: { tab: 'overview' },
    highlights: [
      'Chats keeps client updates, questions, and reschedules inside Build A Booking.',
      'Bookings shows status, requested time, and reschedule actions.',
      'Profile keeps client identity and contact details tidy.'
    ],
    actions: [
      { name: 'Chats', meaning: 'Client-facing conversation threads with the business.' },
      { name: 'Bookings', meaning: 'Client view of booking requests, confirmations, waitlist, and reschedule status.' },
      { name: 'Profile', meaning: 'Client account details and sign-out controls.' },
      { name: 'Open App CTA', meaning: 'Encourages clients to use the app for booking updates and chat.' }
    ],
    workflow: [
      'Client books from the public page.',
      'Client signs in with the same email used for booking.',
      'Booking and chat context appears in the client portal.',
      'Owner replies from Support Inbox.'
    ],
    tips: [
      'If a client uses a different email, their bookings may not match automatically.',
      'Empty client states show realistic examples so the portal still teaches the workflow.'
    ]
  },
  {
    id: 'booking-page',
    label: 'Booking Page',
    kicker: 'Client form',
    title: 'Make booking feel clear, quick, and branded.',
    summary: 'The public booking page is where clients pick a day, choose a slot, enter required details, opt into updates, and submit a request.',
    icon: Globe,
    target: { tab: 'editor' },
    highlights: [
      'Logo, banner, copy, fields, FAQ, socials, and styling all come from Editor.',
      'Client email and mobile fields should match the communication features enabled.',
      'The page can advertise the client app for updates, reschedules, and chat.'
    ],
    actions: [
      { name: 'Date Selection', meaning: 'Shows open dates and available days.' },
      { name: 'Time Slots', meaning: 'Shows requestable appointment times.' },
      { name: 'Client Details', meaning: 'Collects only the fields the owner enabled.' },
      { name: 'Email Updates Opt-in', meaning: 'Lets clients agree to receive booking updates by email when enabled.' },
      { name: 'Submit Booking', meaning: 'Creates the booking request, client profile, and linked workflow data.' }
    ],
    workflow: [
      'Client selects a date.',
      'Client selects a time.',
      'Client fills required details.',
      'The request lands in Bookings and the client profile syncs.',
      'Support chat can continue the conversation afterward.'
    ],
    tips: [
      'Keep required fields lean. The less friction, the more likely clients complete the form.',
      'Use FAQ and socials only when they help the client decide.'
    ]
  },
  {
    id: 'messages',
    label: 'Email Updates',
    kicker: 'Client messages',
    title: 'Keep email updates intentional.',
    summary: 'Email settings now live in Editor Features so owners decide what clients can opt into directly beside the booking form controls.',
    icon: Mail,
    target: { tab: 'editor', editorTab: 'features' },
    highlights: [
      'Email opt-in appears on the booking page only when enabled.',
      'Email collection must be enabled for email updates to work.',
      'Message copy should be short, clear, and branded.'
    ],
    actions: [
      { name: 'Enable Email Updates', meaning: 'Shows the opt-in checkbox on the public booking form.' },
      { name: 'Email Field Toggle', meaning: 'Controls whether the booking form asks for an email address.' },
      { name: 'Message Templates', meaning: 'Sets the confirmation, waitlist, running-late, and follow-up wording.' }
    ],
    workflow: [
      'Turn on the email field if email updates are needed.',
      'Enable the email updates opt-in.',
      'Write simple templates.',
      'Test a booking request before sharing widely.'
    ],
    tips: [
      'If the email field is off, email updates should be treated as off too.',
      'Clients should never be surprised by messages. The opt-in copy matters.'
    ]
  },
  {
    id: 'troubleshooting',
    label: 'Fixes',
    kicker: 'Quick answers',
    title: 'What to check when something feels off.',
    summary: 'Most issues come from missing setup, disabled fields, browser sessions, or unpublished editor changes.',
    icon: ShieldCheck,
    target: { tab: 'overview' },
    highlights: [
      'Publish after editor changes.',
      'Use the same Google email for matching client bookings.',
      'On mobile, use the app or PC website for the full powerful theme engine.',
      'Refresh once if a browser session was left open for a long time.'
    ],
    actions: [
      { name: 'Google sign-in returns home', meaning: 'Try again once, then check authorized domains and redirect setup if it repeats.' },
      { name: 'No bookings showing', meaning: 'Confirm the booking was submitted under the current workspace and not only an example.' },
      { name: 'Client cannot see booking', meaning: 'Check that the client signs in with the same email used on the booking form.' },
      { name: 'Theme looks wrong', meaning: 'Open Editor, confirm the selected theme, then Publish.' },
      { name: 'Email updates missing', meaning: 'Check the email field toggle and email opt-in setting in Editor Features.' }
    ],
    workflow: [
      'Check the active workspace first.',
      'Check whether the data is real or an example.',
      'Check whether the latest settings were saved or published.',
      'Use Profile Sign Out only when session state needs a clean reset.'
    ],
    tips: [
      'The manual is designed for owners and staff, so it explains the current workflow without developer language.',
      'More help center articles can be added later when real support questions appear.'
    ]
  }
];

const sectionMatchesQuery = (section, query) => {
  if (!query.trim()) return true;
  const needle = query.trim().toLowerCase();
  const haystack = [
    section.label,
    section.kicker,
    section.title,
    section.summary,
    ...(section.highlights || []),
    ...(section.workflow || []),
    ...(section.tips || []),
    ...(section.actions || []).flatMap(action => [action.name, action.meaning]),
    ...(section.groups || []).flatMap(group => [group.title, ...(group.items || [])])
  ].join(' ').toLowerCase();
  return haystack.includes(needle);
};

export function OwnerManual({ onClose, onNavigate }) {
  const [activeId, setActiveId] = useState('start');
  const [query, setQuery] = useState('');

  const visibleSections = useMemo(
    () => manualSections.filter(section => sectionMatchesQuery(section, query)),
    [query]
  );
  const activeSection = visibleSections.find(section => section.id === activeId) || visibleSections[0] || manualSections[0];
  const Icon = activeSection.icon || BookOpen;

  const openTarget = (target) => {
    if (!target?.tab) return;
    onNavigate?.(target.tab, target.editorTab);
  };

  return (
    <div className="native-ui owner-manual-shell fixed inset-0 z-[10000] overflow-hidden bg-white text-black">
      <div className="absolute inset-x-0 top-0 h-1 native-gradient-line" />
      <header className="relative z-10 bg-white/92 backdrop-blur-xl border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl native-gradient-icon flex items-center justify-center shrink-0">
              <BookOpen size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-neutral-400">Owner Manual</p>
              <h2 className="text-lg md:text-2xl font-bold tracking-tight truncate">Build A Booking guide</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-neutral-100 hover:bg-black hover:text-white transition-colors flex items-center justify-center shrink-0"
            aria-label="Close owner manual"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      <div className="h-[calc(100vh-4.25rem)] md:h-[calc(100vh-4.75rem)] overflow-hidden">
        <div className="max-w-7xl mx-auto h-full grid grid-cols-1 lg:grid-cols-[19rem_1fr]">
          <aside className="border-b lg:border-b-0 lg:border-r border-neutral-200 bg-white/65 backdrop-blur-xl overflow-hidden">
            <div className="p-4 md:p-5">
              <label className="relative block">
                <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search manual"
                  className="w-full h-12 rounded-2xl bg-white border border-neutral-200 pl-11 pr-4 text-sm font-semibold outline-none focus:border-black transition-colors"
                />
              </label>
            </div>

            <div className="px-4 pb-4 lg:pb-5 overflow-x-auto lg:overflow-y-auto lg:overflow-x-hidden flex lg:block gap-2 lg:h-[calc(100vh-10.25rem)]">
              {visibleSections.map((section, index) => {
                const SectionIcon = section.icon || BookOpen;
                const active = section.id === activeSection.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveId(section.id)}
                    className={`min-w-[10.5rem] lg:min-w-0 w-full rounded-2xl p-3 mb-0 lg:mb-2 text-left border transition-all flex items-center gap-3 ${
                      active
                        ? 'native-gradient-ring bg-white shadow-[0_20px_45px_-35px_rgba(15,23,42,0.55)]'
                        : 'bg-white/70 border-neutral-200 hover:bg-white'
                    }`}
                  >
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${active ? 'native-gradient-icon' : 'bg-neutral-100 text-neutral-500'}`}>
                      <SectionIcon size={16} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[8px] font-bold uppercase tracking-[0.24em] text-neutral-400">0{index + 1}</span>
                      <span className="block text-[11px] font-bold uppercase tracking-[0.12em] truncate">{section.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <main className="overflow-y-auto px-4 md:px-7 py-5 md:py-8">
            {visibleSections.length === 0 ? (
              <section className="min-h-[55vh] rounded-[1.5rem] bg-white border border-neutral-200 flex flex-col items-center justify-center text-center p-8">
                <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mb-5"><Search size={18} /></div>
                <h3 className="text-2xl font-bold tracking-tight">No section found.</h3>
                <p className="text-sm text-neutral-500 mt-2 max-w-sm">Try searching for bookings, schedule, editor, support, email, or profile.</p>
              </section>
            ) : (
              <section className="space-y-5 md:space-y-6 pb-10">
                <div className="rounded-[1.5rem] md:rounded-[2rem] bg-white border border-neutral-200 shadow-sm overflow-hidden native-gradient-ring">
                  <div className="p-5 md:p-8 lg:p-10">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                      <div className="max-w-3xl">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-12 h-12 rounded-2xl native-gradient-icon flex items-center justify-center shadow-xl shadow-black/5">
                            <Icon size={20} />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-neutral-400">{activeSection.kicker}</p>
                            <p className="text-xs font-semibold text-neutral-400 mt-1">{activeSection.label}</p>
                          </div>
                        </div>
                        <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-none">
                          {activeSection.title}
                        </h1>
                        <p className="text-base md:text-lg text-neutral-500 leading-relaxed mt-5 max-w-2xl">
                          {activeSection.summary}
                        </p>
                      </div>
                      {activeSection.target?.tab && (
                        <button
                          type="button"
                          onClick={() => openTarget(activeSection.target)}
                          className="h-12 px-5 rounded-full native-gradient-button text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 shrink-0"
                        >
                          Open {activeSection.label}
                          <ArrowRight size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                  <div className="xl:col-span-7 space-y-5">
                    <article className="rounded-[1.25rem] bg-white border border-neutral-200 p-5 md:p-6 shadow-sm">
                      <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center">
                          <CheckCircle2 size={17} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-neutral-400">What matters</p>
                          <h3 className="text-xl font-bold tracking-tight">Core ideas</h3>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {(activeSection.highlights || []).map((item) => (
                          <div key={item} className="rounded-2xl bg-neutral-50 border border-neutral-100 p-4 text-sm leading-relaxed text-neutral-600">
                            {item}
                          </div>
                        ))}
                      </div>
                    </article>

                    {(activeSection.groups || []).length > 0 && (
                      <article className="rounded-[1.25rem] bg-white border border-neutral-200 p-5 md:p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-5">
                          <div className="w-10 h-10 rounded-xl native-gradient-icon flex items-center justify-center">
                            <Palette size={17} />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-neutral-400">Deep guide</p>
                            <h3 className="text-xl font-bold tracking-tight">Editor sections</h3>
                          </div>
                        </div>
                        <div className="space-y-3">
                          {activeSection.groups.map(group => (
                            <div key={group.title} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                              <div className="flex items-center justify-between gap-3 mb-3">
                                <h4 className="font-bold text-lg tracking-tight">{group.title}</h4>
                                <button
                                  type="button"
                                  onClick={() => openTarget(group.target)}
                                  className="h-9 px-3 rounded-full bg-white border border-neutral-200 text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 hover:border-black transition-colors"
                                >
                                  Open <ChevronRight size={13} />
                                </button>
                              </div>
                              <ul className="space-y-2">
                                {group.items.map(item => (
                                  <li key={item} className="flex gap-2 text-sm text-neutral-600 leading-relaxed">
                                    <span className="mt-2 h-1.5 w-1.5 rounded-full native-gradient-line shrink-0" />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </article>
                    )}

                    <article className="rounded-[1.25rem] bg-white border border-neutral-200 p-5 md:p-6 shadow-sm">
                      <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center">
                          <Zap size={17} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-neutral-400">Buttons</p>
                          <h3 className="text-xl font-bold tracking-tight">What each control does</h3>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {(activeSection.actions || []).map(action => (
                          <div key={action.name} className="rounded-2xl border border-neutral-100 bg-white p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                            <p className="font-bold text-sm">{action.name}</p>
                            <p className="text-sm text-neutral-500 leading-relaxed sm:text-right sm:max-w-lg">{action.meaning}</p>
                          </div>
                        ))}
                      </div>
                    </article>
                  </div>

                  <div className="xl:col-span-5 space-y-5">
                    <article className="rounded-[1.25rem] bg-white border border-neutral-200 p-5 md:p-6 shadow-sm">
                      <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 rounded-xl native-gradient-icon flex items-center justify-center">
                          <Clock size={17} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-neutral-400">Best order</p>
                          <h3 className="text-xl font-bold tracking-tight">Recommended workflow</h3>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {(activeSection.workflow || []).map((step, index) => (
                          <div key={step} className="flex gap-3">
                            <span className="w-8 h-8 rounded-xl bg-black text-white text-[10px] font-bold flex items-center justify-center shrink-0">{index + 1}</span>
                            <p className="text-sm text-neutral-600 leading-relaxed pt-1.5">{step}</p>
                          </div>
                        ))}
                      </div>
                    </article>

                    <article className="rounded-[1.25rem] bg-black text-white p-5 md:p-6 shadow-[0_24px_80px_-50px_rgba(0,0,0,0.85)]">
                      <div className="w-10 h-10 rounded-xl native-gradient-icon flex items-center justify-center mb-5 text-black">
                        <Eye size={17} />
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-white/35 mb-3">Need to know</p>
                      <div className="space-y-4">
                        {(activeSection.tips || []).map(tip => (
                          <p key={tip} className="text-sm leading-relaxed text-white/70">{tip}</p>
                        ))}
                      </div>
                    </article>

                    <article className="rounded-[1.25rem] bg-white border border-neutral-200 p-5 md:p-6 shadow-sm">
                      <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-neutral-400 mb-3">Quick jump</p>
                      <div className="grid grid-cols-2 gap-2">
                        {manualSections.slice(0, 10).map(section => (
                          <button
                            key={section.id}
                            type="button"
                            onClick={() => setActiveId(section.id)}
                            className={`h-10 rounded-xl text-[9px] font-bold uppercase tracking-[0.12em] transition-all ${
                              section.id === activeSection.id ? 'native-gradient-button' : 'bg-neutral-50 text-neutral-500 hover:text-black'
                            }`}
                          >
                            {section.label}
                          </button>
                        ))}
                      </div>
                    </article>
                  </div>
                </div>
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

export default OwnerManual;
