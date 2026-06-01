const DAY_MS = 24 * 60 * 60 * 1000;
const DEMO_SOURCE = 'jump-studios-guest-v1';

const money = (value) => String(value);
const demoImage = (fileName) => `/demo/jump-studios/${fileName}`;
export const jumpStudiosDemoAssets = {
  logo: demoImage('jump-studios-logo.svg'),
  studio: demoImage('studio-gym-interior.jpg'),
  team: demoImage('team-training-rig.jpg'),
  strength: demoImage('strength-training.jpg'),
  mobility: demoImage('mobility-stretch.jpg'),
  weights: demoImage('weight-stack.jpg'),
  homeGym: demoImage('home-gym.jpg'),
  coaching: demoImage('coached-dumbbells.jpg')
};
const demoAssets = jumpStudiosDemoAssets;

const services = [
  {
    id: 'jump-start-assessment',
    name: 'Jump Start Assessment',
    category: 'Assessment',
    description: 'A focused intake to map goals, equipment, injuries, schedule, and the best starting plan.',
    price: money(35),
    duration: '45',
    staffIds: ['owner', 'coach-aria', 'coach-nia'],
    imageUrls: [demoAssets.coaching]
  },
  {
    id: 'academy-intake',
    name: '12-Week Academy Intake',
    category: 'Programs',
    description: 'Join the next transformation cohort with baseline testing, goal planning, and onboarding.',
    price: money(129),
    duration: '60',
    staffIds: ['owner', 'coach-aria'],
    imageUrls: [demoAssets.team]
  },
  {
    id: 'strength-coaching',
    name: '1:1 Strength Coaching',
    category: 'Coaching',
    description: 'Live strength coaching with form cues, progressive overload, and a clear next-session plan.',
    price: money(85),
    duration: '60',
    staffIds: ['coach-aria', 'owner'],
    imageUrls: [demoAssets.strength]
  },
  {
    id: 'hiit-live',
    name: 'Live HIIT Class',
    category: 'Classes',
    description: 'Small-group online conditioning with scalable intervals and real-time coaching.',
    price: money(18),
    duration: '45',
    staffIds: ['coach-mateo', 'coach-lena'],
    imageUrls: [demoAssets.team]
  },
  {
    id: 'mobility-reset',
    name: 'Mobility Reset',
    category: 'Recovery',
    description: 'Guided mobility and recovery session for desk bodies, runners, lifters, and busy parents.',
    price: money(32),
    duration: '45',
    staffIds: ['coach-kenji', 'coach-nia'],
    imageUrls: [demoAssets.mobility]
  },
  {
    id: 'nutrition-strategy',
    name: 'Nutrition Strategy Call',
    category: 'Nutrition',
    description: 'A practical nutrition plan built around culture, travel, budget, and training goals.',
    price: money(65),
    duration: '50',
    staffIds: ['coach-nia'],
    imageUrls: [demoAssets.homeGym]
  },
  {
    id: 'form-review',
    name: 'Video Form Review',
    category: 'Coaching',
    description: 'Upload lifts or movement clips, then review technique and next steps live with a coach.',
    price: money(45),
    duration: '30',
    staffIds: ['coach-aria', 'coach-kenji'],
    imageUrls: [demoAssets.weights]
  },
  {
    id: 'postpartum-strength',
    name: 'Postpartum Strength',
    category: 'Specialist',
    description: 'Gentle return-to-strength coaching with core, breath, confidence, and realistic pacing.',
    price: money(72),
    duration: '55',
    staffIds: ['coach-nia', 'coach-lena'],
    imageUrls: [demoAssets.mobility]
  },
  {
    id: 'team-energy-session',
    name: 'Corporate Team Session',
    category: 'Teams',
    description: 'Remote team movement session for energy, posture, and a healthier workday rhythm.',
    price: money(240),
    duration: '60',
    staffIds: ['owner', 'coach-mateo', 'coach-lena'],
    imageUrls: [demoAssets.studio]
  }
].map((service) => ({ currency: '$', ...service }));

const staffList = [
  { id: 'owner', uid: 'guest-owner', name: 'Maya Chen', email: 'maya@jumpstudios.example', phone: '+44 20 5555 0101', photoURL: '', role: 'owner', status: 'connected', accessEnabled: true, color: '#050505', speciality: 'Academy strategy, cohort onboarding, and strength coaching' },
  { id: 'coach-aria', name: 'Aria Thompson', email: 'aria@jumpstudios.example', phone: '+1 415 555 0127', photoURL: '', role: 'strength coach', status: 'access-ready', accessEnabled: true, color: '#14B8A6', speciality: 'Strength coaching, lifting technique, and progressive plans' },
  { id: 'coach-mateo', name: 'Mateo Silva', email: 'mateo@jumpstudios.example', phone: '+55 11 5555 0198', photoURL: '', role: 'conditioning coach', status: 'access-ready', accessEnabled: true, color: '#F97316', speciality: 'HIIT classes, team energy sessions, and cardio confidence' },
  { id: 'coach-nia', name: 'Nia Okafor', email: 'nia@jumpstudios.example', phone: '+234 1 555 0164', photoURL: '', role: 'nutrition coach', status: 'access-ready', accessEnabled: true, color: '#A855F7', speciality: 'Nutrition strategy, postpartum plans, and sustainable habits' },
  { id: 'coach-kenji', name: 'Kenji Watanabe', email: 'kenji@jumpstudios.example', phone: '+81 3 5555 0118', photoURL: '', role: 'mobility coach', status: 'access-ready', accessEnabled: true, color: '#38BDF8', speciality: 'Mobility, pain-aware training, and recovery programming' },
  { id: 'coach-lena', name: 'Lena Bauer', email: 'lena@jumpstudios.example', phone: '+49 30 5555 0142', photoURL: '', role: 'community coach', status: 'access-ready', accessEnabled: true, color: '#84CC16', speciality: 'Beginner confidence, live classes, and member accountability' }
];

const clientProfiles = [
  ['Amina Hassan', 'Kenya', 'Nairobi', 'EAT', 'Product manager', 'Build strength before a Kilimanjaro trek', 'academy-intake', 28, 12, 'Cohort', 'Prefers early evening EAT and asks for travel-friendly workouts.'],
  ['Oliver Hughes', 'United Kingdom', 'Manchester', 'GMT/BST', 'Software founder', 'Fix posture and lift consistently around meetings', 'strength-coaching', 14, 16, 'Executive', 'Needs calendar discipline and concise notes after each session.'],
  ['Priya Raman', 'India', 'Bengaluru', 'IST', 'Data analyst', 'Lose fat without losing energy during late releases', 'nutrition-strategy', 28, 11, 'Nutrition', 'Vegetarian, likes quantified goals, books from the booking page every cycle.'],
  ['Marcus Reed', 'United States', 'Austin', 'CT', 'Sales director', 'Get strong for a charity obstacle race', 'hiit-live', 14, 15, 'Athlete', 'Competitive, asks for heart-rate targets and recovery reminders.'],
  ['Sofia Alvarez', 'Spain', 'Madrid', 'CET/CEST', 'Architect', 'Improve mobility after long studio days', 'mobility-reset', 21, 13, 'Recovery', 'Prefers calm coaching and shoulder mobility work.'],
  ['Noah Kim', 'South Korea', 'Seoul', 'KST', 'UX researcher', 'Learn proper squat and deadlift form', 'form-review', 28, 9, 'Technique', 'Sends concise videos and likes detailed timestamps.'],
  ['Leila Haddad', 'United Arab Emirates', 'Dubai', 'GST', 'Hotel operations lead', 'Train before morning shifts and manage nutrition', 'academy-intake', 28, 12, 'VIP', 'Travels between properties, needs flexible sessions.'],
  ['Emily Carter', 'Canada', 'Toronto', 'ET', 'Teacher', 'Return to strength after a winter break', 'strength-coaching', 21, 13, 'Regular', 'Needs low-equipment alternatives for school weeks.'],
  ['Thandi Mbeki', 'South Africa', 'Cape Town', 'SAST', 'Creative director', 'Rebuild routine after production season', 'hiit-live', 7, 18, 'Regular', 'Books short-notice classes when campaigns calm down.'],
  ['Giovanni Russo', 'Italy', 'Milan', 'CET/CEST', 'Restaurant owner', 'Drop weight while keeping family meals realistic', 'nutrition-strategy', 28, 10, 'Nutrition', 'Needs culturally realistic food swaps, not generic meal plans.'],
  ['Mia Johansson', 'Sweden', 'Stockholm', 'CET/CEST', 'Finance manager', 'Stay active through dark-season workdays', 'mobility-reset', 14, 15, 'Recovery', 'Enjoys quick follow-up homework and posture resets.'],
  ['Ethan Miller', 'Australia', 'Melbourne', 'AET', 'Paramedic', 'Build durable strength around shift work', 'strength-coaching', 21, 12, 'Shift Work', 'Needs rotating times and fatigue-aware programming.'],
  ['Camila Torres', 'Brazil', 'Sao Paulo', 'BRT', 'Marketing lead', 'Improve conditioning for dance and travel', 'hiit-live', 14, 15, 'Creator', 'Likes upbeat coaching and social accountability.'],
  ['Jonas Weber', 'Germany', 'Berlin', 'CET/CEST', 'Engineer', 'Fix running niggles and build mobility', 'mobility-reset', 28, 10, 'Runner', 'Precise questions, logs pain scores in notes.'],
  ['Nadia Petrova', 'Netherlands', 'Amsterdam', 'CET/CEST', 'Consultant', 'Lose weight with realistic hotel workouts', 'academy-intake', 28, 12, 'Travel', 'Books from airports and asks for hotel-gym substitutions.'],
  ['Malik Johnson', 'United States', 'Atlanta', 'ET', 'Music producer', 'Gain muscle without wrecking sleep', 'strength-coaching', 14, 16, 'VIP', 'Late-night schedule, wants clear recovery boundaries.'],
  ['Grace Ochieng', 'Kenya', 'Mombasa', 'EAT', 'Small business owner', 'Improve energy and manage meals with family', 'nutrition-strategy', 28, 9, 'Nutrition', 'Prefers WhatsApp-style clarity and practical shopping lists.'],
  ['Hiro Tanaka', 'Japan', 'Tokyo', 'JST', 'Operations analyst', 'Desk pain relief and beginner strength', 'form-review', 35, 8, 'Technique', 'Quiet client, responds well to visual cues.'],
  ['Fatima Al Mansouri', 'Qatar', 'Doha', 'AST', 'HR partner', 'Postpartum strength with confidence', 'postpartum-strength', 21, 13, 'Specialist', 'Needs careful pacing, core modifications, and private notes.'],
  ['Jack Wilson', 'New Zealand', 'Auckland', 'NZT', 'Designer', 'Use HIIT to support weekend rugby', 'hiit-live', 14, 14, 'Athlete', 'Prefers weekend-friendly recovery and simple metrics.'],
  ['Zara Patel', 'United Kingdom', 'London', 'GMT/BST', 'Law associate', 'Consistent training without burnout', 'academy-intake', 28, 12, 'Executive', 'High-pressure weeks, loves calendar reminders.'],
  ['Andre Botha', 'South Africa', 'Johannesburg', 'SAST', 'Founder', 'Strength and mobility for long flights', 'mobility-reset', 14, 14, 'Executive', 'Travels monthly, likes airport-friendly routines.'],
  ['Isabella Martins', 'Portugal', 'Lisbon', 'WET/WEST', 'Photographer', 'Tone up before wedding season', 'strength-coaching', 21, 12, 'Creator', 'Books around shoots and asks for visible progress checks.'],
  ['Chen Wei', 'Singapore', 'Singapore', 'SGT', 'Banking analyst', 'Efficient training around market hours', 'form-review', 28, 10, 'Technique', 'Wants compact sessions and exact next steps.'],
  ['Olena Shevchenko', 'Poland', 'Warsaw', 'CET/CEST', 'Project coordinator', 'Recover confidence after a knee flare-up', 'mobility-reset', 21, 11, 'Recovery', 'Needs low-impact progressions and pain-free wins.'],
  ['Ryan O Connor', 'Ireland', 'Dublin', 'GMT/IST', 'Account executive', 'Stay fit during sales travel', 'hiit-live', 14, 15, 'Travel', 'Asks for hotel-room class substitutions.'],
  ['Mariam El-Sayed', 'Egypt', 'Cairo', 'EET', 'Medical student', 'Build sustainable habits during exams', 'jump-start-assessment', 42, 7, 'Student', 'Needs low-friction plan and sleep-aware coaching.'],
  ['Lucas Fernandez', 'Mexico', 'Mexico City', 'CST', 'Video editor', 'Improve posture and core strength', 'form-review', 28, 9, 'Technique', 'Sends clips from a small apartment gym.'],
  ['Ava Brown', 'United States', 'New York', 'ET', 'PR director', 'High-accountability fat-loss plan', 'academy-intake', 28, 12, 'VIP', 'Wants direct feedback and premium check-ins.'],
  ['Samir Khan', 'Pakistan', 'Lahore', 'PKT', 'Ecommerce owner', 'Build strength after weight loss', 'strength-coaching', 21, 12, 'Regular', 'Needs careful loading and shoulder-safe presses.'],
  ['Elena Novak', 'Czech Republic', 'Prague', 'CET/CEST', 'Translator', 'Stay active from home with minimal gear', 'hiit-live', 14, 13, 'Home Gym', 'Owns bands, dumbbells, and a tiny training corner.'],
  ['David Cohen', 'Israel', 'Tel Aviv', 'IST', 'Startup CFO', 'Reduce stress with routine and mobility', 'mobility-reset', 21, 10, 'Executive', 'Likes short breathing protocols after sessions.'],
  ['Mei Lin', 'Taiwan', 'Taipei', 'CST', 'Product designer', 'Strength basics without gym intimidation', 'jump-start-assessment', 42, 7, 'Beginner', 'New to training, needs simple language and confidence.'],
  ['Gabriel Mensah', 'Ghana', 'Accra', 'GMT', 'Creative strategist', 'Get fit for a brand campaign shoot', 'academy-intake', 28, 11, 'Creator', 'Motivated by visual progress and weekly accountability.'],
  ['Hannah Schmidt', 'Germany', 'Hamburg', 'CET/CEST', 'Nurse', 'Postpartum return after night shifts', 'postpartum-strength', 21, 12, 'Specialist', 'Needs flexible reminders and gentle progression.'],
  ['Yuki Sato', 'Japan', 'Osaka', 'JST', 'Language teacher', 'Improve hip mobility and energy', 'mobility-reset', 28, 8, 'Recovery', 'Likes calm tone and detailed mobility homework.'],
  ['Liam Murphy', 'Canada', 'Vancouver', 'PT', 'Game developer', 'Reverse desk stiffness and build strength', 'strength-coaching', 14, 14, 'Home Gym', 'Training space is small, but consistency is strong.'],
  ['Rania Zayed', 'Morocco', 'Casablanca', 'WET', 'Interior designer', 'Healthy weight loss with travel meals', 'nutrition-strategy', 28, 10, 'Nutrition', 'Needs Ramadan-aware and travel-aware planning.'],
  ['Tomasz Kowalski', 'Poland', 'Krakow', 'CET/CEST', 'IT manager', 'Conditioning for hiking season', 'hiit-live', 14, 12, 'Athlete', 'Likes clear effort scales and mountain prep.'],
  ['Chloe Martin', 'France', 'Paris', 'CET/CEST', 'Fashion buyer', 'Strength and posture before market weeks', 'form-review', 28, 9, 'Travel', 'Asks for luggage-friendly exercise swaps.'],
  ['Daniel Adeyemi', 'Nigeria', 'Lagos', 'WAT', 'Agency owner', 'Lose weight with accountability and no fluff', 'academy-intake', 28, 12, 'VIP', 'Prefers direct coaching and weekly progress calls.'],
  ['Sara Lindgren', 'Norway', 'Oslo', 'CET/CEST', 'Consultant', 'Train through winter without losing motivation', 'hiit-live', 14, 14, 'Regular', 'Needs mood-friendly planning and consistency check-ins.'],
  ['Omar Farouk', 'United Arab Emirates', 'Abu Dhabi', 'GST', 'Pilot', 'Maintain fitness across changing rosters', 'mobility-reset', 21, 11, 'Shift Work', 'Books based on flight roster and recovery needs.'],
  ['Julia Novak', 'Austria', 'Vienna', 'CET/CEST', 'Legal counsel', 'Build strength after a long break', 'jump-start-assessment', 42, 7, 'Beginner', 'Careful, thoughtful client who wants a realistic start.'],
  ['Mpho Dlamini', 'South Africa', 'Pretoria', 'SAST', 'Operations lead', 'Corporate wellness for remote team', 'team-energy-session', 30, 8, 'Teams', 'Books for a 14-person remote team once a month.'],
  ['Saanvi Mehta', 'India', 'Mumbai', 'IST', 'Film producer', 'Short workouts during production days', 'hiit-live', 14, 13, 'Creator', 'Needs sessions that work from hotel rooms.'],
  ['Benjamin Scott', 'United States', 'Seattle', 'PT', 'Cloud engineer', 'Strength and mobility for back pain prevention', 'form-review', 21, 12, 'Technique', 'Likes precise feedback and annotated form notes.'],
  ['Aya Nasser', 'Jordan', 'Amman', 'EET', 'NGO director', 'Sustainable fitness with low equipment', 'academy-intake', 28, 10, 'Beginner', 'Needs simple sessions and family-aware meal ideas.']
];

const countryDialCodes = {
  Australia: '+61',
  Austria: '+43',
  Brazil: '+55',
  Canada: '+1',
  'Czech Republic': '+420',
  Egypt: '+20',
  France: '+33',
  Germany: '+49',
  Ghana: '+233',
  India: '+91',
  Ireland: '+353',
  Israel: '+972',
  Italy: '+39',
  Japan: '+81',
  Jordan: '+962',
  Kenya: '+254',
  Mexico: '+52',
  Morocco: '+212',
  Netherlands: '+31',
  'New Zealand': '+64',
  Nigeria: '+234',
  Norway: '+47',
  Pakistan: '+92',
  Poland: '+48',
  Portugal: '+351',
  Qatar: '+974',
  Singapore: '+65',
  'South Africa': '+27',
  'South Korea': '+82',
  Spain: '+34',
  Sweden: '+46',
  Taiwan: '+886',
  'United Arab Emirates': '+971',
  'United Kingdom': '+44',
  'United States': '+1'
};

const slugify = (value = '') => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const startOfToday = (now = Date.now()) => {
  const date = new Date(now);
  date.setHours(9, 0, 0, 0);
  return date;
};

const formatBookingDate = (date) => (
  date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
);

const getDateKey = (date, getLocalDateStr) => (
  typeof getLocalDateStr === 'function' ? getLocalDateStr(date) : date.toISOString().slice(0, 10)
);

const getServiceById = (serviceId) => services.find(service => service.id === serviceId) || services[0];

const buildClients = () => (
  clientProfiles.map((row, index) => {
    const [name, country, city, timezone, occupation, goal, serviceId, cadenceDays, maxHistory, label, notes] = row;
    const dial = countryDialCodes[country] || '+1';
    const phoneBody = `${String(620 + index).padStart(3, '0')} ${String(3000 + index * 47).slice(-4)}`;
    const firstSeenOffset = -365 + ((index * 9) % 90);
    return {
      id: `jump-client-${String(index + 1).padStart(3, '0')}`,
      name,
      country,
      city,
      timezone,
      occupation,
      goal,
      serviceId,
      cadenceDays,
      maxHistory,
      label,
      notes,
      firstSeenOffset,
      phone: `${dial} ${phoneBody}`,
      email: `${slugify(name)}@jump-client.example`,
      birthday: `${String((index % 27) + 1).padStart(2, '0')} ${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][index % 12]} ${1980 + (index % 24)}`,
      avatar: ''
    };
  })
);

const staffForService = (service, seed) => service.staffIds[seed % service.staffIds.length] || 'owner';

const growthPlan = [
  { monthsAgo: 11, paidCount: 14 },
  { monthsAgo: 10, paidCount: 18 },
  { monthsAgo: 9, paidCount: 22 },
  { monthsAgo: 8, paidCount: 27 },
  { monthsAgo: 7, paidCount: 32 },
  { monthsAgo: 6, paidCount: 38 },
  { monthsAgo: 5, paidCount: 45 },
  { monthsAgo: 4, paidCount: 53 },
  { monthsAgo: 3, paidCount: 63 },
  { monthsAgo: 2, paidCount: 74 },
  { monthsAgo: 1, paidCount: 86 },
  { monthsAgo: 0, paidCount: 96 }
];

const serviceMixByStage = [
  ['hiit-live', 'mobility-reset', 'form-review', 'jump-start-assessment', 'nutrition-strategy', 'strength-coaching'],
  ['hiit-live', 'strength-coaching', 'nutrition-strategy', 'mobility-reset', 'form-review', 'academy-intake', 'jump-start-assessment'],
  ['strength-coaching', 'academy-intake', 'hiit-live', 'nutrition-strategy', 'mobility-reset', 'postpartum-strength', 'form-review'],
  ['academy-intake', 'strength-coaching', 'team-energy-session', 'nutrition-strategy', 'postpartum-strength', 'hiit-live', 'mobility-reset', 'form-review']
];

const getStageIndex = (planIndex) => (
  planIndex < 3 ? 0 : planIndex < 6 ? 1 : planIndex < 9 ? 2 : 3
);

const pickGrowthService = (planIndex, itemIndex) => {
  const stage = getStageIndex(planIndex);
  const mix = serviceMixByStage[stage];
  const boostedServiceId = stage >= 2 && itemIndex % 17 === 0
    ? 'team-energy-session'
    : stage >= 1 && itemIndex % 11 === 0
      ? 'academy-intake'
      : mix[(itemIndex + planIndex * 2) % mix.length];
  return getServiceById(boostedServiceId);
};

const getMonthStart = (today, monthsAgo) => (
  new Date(today.getFullYear(), today.getMonth() - monthsAgo, 1, 9, 0, 0, 0)
);

const getMonthPaidAt = ({ today, monthStart, itemIndex, paidCount, now }) => {
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 21, 0, 0, 0);
  const isCurrentMonth = monthStart.getFullYear() === today.getFullYear() && monthStart.getMonth() === today.getMonth();
  const maxDay = isCurrentMonth
    ? Math.max(1, today.getDate() - 1)
    : monthEnd.getDate();
  const day = Math.min(maxDay, Math.max(1, 1 + Math.floor(((itemIndex + 0.35) / Math.max(1, paidCount)) * maxDay)));
  const paidAt = new Date(monthStart.getFullYear(), monthStart.getMonth(), day, 6 + ((itemIndex * 5) % 15), (itemIndex * 13) % 55, 0, 0);
  const latestSafePaidAt = Math.max(monthStart.getTime(), now - (3 + itemIndex) * 47 * 60 * 1000);
  return Math.min(paidAt.getTime(), latestSafePaidAt);
};

const createSessionDateFromPaidAt = (paidAt, itemIndex) => {
  const sessionDate = new Date(paidAt + (2 + (itemIndex % 9)) * DAY_MS);
  if (sessionDate.getDay() === 0) sessionDate.setDate(sessionDate.getDate() + 1);
  const hours = [6, 7, 9, 12, 15, 17, 19, 21][itemIndex % 8];
  sessionDate.setHours(hours, hours === 7 || hours === 17 ? 30 : 0, 0, 0);
  return sessionDate;
};

const createClientNote = ({ client, service, sequence, status }) => {
  const contexts = [
    `Booked from the Jump Studios public booking page. ${client.city}, ${client.country} (${client.timezone}).`,
    `Goal: ${client.goal}.`,
    `Client context: ${client.occupation}. ${client.notes}`,
    status === 'waitlist'
      ? 'Asked to join waitlist if a better time opens.'
      : sequence % 3 === 0
        ? 'Requested a concise follow-up plan after the session.'
        : 'Wants practical coaching that fits real life.'
  ];
  return contexts.join(' ');
};

const createChatScript = ({ client, service, staffName, status, sequence }) => {
  const previewCycle = [
    `Can we keep this ${service.name} focused around ${client.goal.toLowerCase()}?`,
    `I booked from ${client.city}. Can you confirm the time works for my timezone?`,
    `I added notes for my ${service.category.toLowerCase()} session and want to make sure the coach sees them.`,
    `Could you send the session checklist before my ${service.name}?`
  ];
  const preview = status === 'waitlist'
    ? `If a spot opens, I can move quickly for ${service.name}.`
    : previewCycle[sequence % previewCycle.length];
  return {
    preview,
    messages: [
      `Hi Jump Studios, I just booked ${service.name} from ${client.city}.`,
      preview,
      `Absolutely. ${staffName} can see your booking notes and will shape the session around ${client.goal.toLowerCase()}.`,
      status === 'waitlist'
        ? 'Perfect. Please keep me posted if the earlier slot opens.'
        : 'Great, thanks. This feels much clearer than guessing what to train next.'
    ]
  };
};

const gatewayCycle = ['stripe', 'paystack', 'payfast', 'yoco', 'ozow', 'manual_eft'];
const providerNames = {
  stripe: 'Stripe checkout',
  paystack: 'Paystack card',
  payfast: 'Payfast card',
  yoco: 'Yoco payment',
  ozow: 'Ozow instant EFT',
  manual_eft: 'Manual bank transfer'
};

const createBookingFactory = ({ today, getLocalDateStr }) => {
  let bookingNumber = 1000;
  return ({ client, service, offset = 0, date: explicitDate, time, status = 'confirmed', paymentStatus = 'paid', sequence = 0, paidAtMs, createdAtMs, updatedAtMs }) => {
    const date = explicitDate ? new Date(explicitDate) : addDays(today, offset);
    if (date.getDay() === 0) date.setDate(date.getDate() + 1);
    const [hour, minute] = String(time || '09:00').split(':').map(Number);
    date.setHours(hour || 9, minute || 0, 0, 0);
    const id = `jump-${bookingNumber += 1}`;
    const amountInCents = Math.round(Number(service.price || 0) * 100);
    const gateway = gatewayCycle[(sequence + client.id.length + service.id.length) % gatewayCycle.length];
    const staffId = staffForService(service, sequence + client.name.length);
    const staff = staffList.find(member => member.id === staffId) || staffList[0];
    const paid = paymentStatus === 'paid';
    const timestamp = date.getTime();
    const paidAt = paid ? (Number.isFinite(paidAtMs) ? paidAtMs : Math.min(timestamp + 42 * 60 * 1000, Date.now() - Math.max(30, sequence + 5) * 60 * 1000)) : null;
    const updatedAt = Number.isFinite(updatedAtMs)
      ? updatedAtMs
      : paidAt || Math.min(timestamp, Date.now() - Math.max(35, sequence + 12) * 60 * 1000);
    const chat = createChatScript({ client, service, staffName: staff.name, status, sequence });

    return {
      id,
      clientName: client.name,
      clientPhone: client.phone,
      clientEmail: client.email,
      clientBirthday: client.birthday,
      clientNote: createClientNote({ client, service, sequence, status }),
      clientPhotoURL: '',
      clientAvatar: '',
      avatar: '',
      serviceId: service.id,
      serviceName: service.name,
      serviceDuration: service.duration,
      servicePrice: service.price,
      servicePriceType: service.priceType || 'fixed',
      serviceCategory: service.category,
      amountInCents,
      currency: 'USD',
      paymentMethod: gateway,
      paymentGateway: gateway,
      paymentProviderName: providerNames[gateway] || 'Card checkout',
      paymentStatus,
      paymentReference: id.toUpperCase(),
      manualPayment: gateway === 'manual_eft',
      amountPaidInCents: paid ? amountInCents : 0,
      paidAt,
      date: formatBookingDate(date),
      dateKey: getDateKey(date, getLocalDateStr),
      time: status === 'waitlist' ? 'Waitlist' : time,
      status,
      timestamp,
      createdAt: Number.isFinite(createdAtMs) ? createdAtMs : timestamp - (18 + (sequence % 42)) * 60 * 60 * 1000,
      updatedAt,
      staffId,
      timezone: client.timezone,
      clientCountry: client.country,
      clientCity: client.city,
      source: 'booking-page',
      intakeSource: 'public-booking-page',
      demoSource: DEMO_SOURCE,
      isGuestDemo: true,
      chatPreview: chat.preview,
      chatMessages: chat.messages
    };
  };
};

const createSchedule = (getLocalDateStr, now = Date.now()) => {
  const today = startOfToday(now);
  const schedule = {};
  const weekdayTimes = ['06:00', '07:30', '09:00', '12:00', '15:00', '17:30', '19:00', '21:00'];
  const saturdayTimes = ['07:30', '09:00', '11:00', '15:00'];
  for (let offset = -370; offset <= 75; offset += 1) {
    const date = addDays(today, offset);
    const day = date.getDay();
    const dateKey = getDateKey(date, getLocalDateStr);
    schedule[dateKey] = {
      available: day !== 0,
      times: day === 0 ? [] : day === 6 ? saturdayTimes : weekdayTimes
    };
  }
  return schedule;
};

const createStaffCalendars = (schedule) => {
  const staffTimes = {
    'coach-aria': ['07:30', '12:00', '17:30', '19:00'],
    'coach-mateo': ['06:00', '09:00', '15:00', '21:00'],
    'coach-nia': ['09:00', '12:00', '15:00', '17:30'],
    'coach-kenji': ['06:00', '07:30', '12:00', '19:00'],
    'coach-lena': ['09:00', '15:00', '17:30', '21:00'],
    owner: ['07:30', '12:00', '15:00', '19:00']
  };
  return staffList.reduce((calendars, staff) => {
    const availableTimes = staffTimes[staff.id] || ['09:00', '12:00', '17:30'];
    calendars[staff.id] = {
      availableTimes,
      schedule: Object.entries(schedule).reduce((acc, [dateKey, config], index) => {
        acc[dateKey] = {
          available: config.available && (index + staff.id.length) % 9 !== 0,
          times: config.available ? availableTimes.filter((_, timeIndex) => (index + timeIndex + staff.id.length) % 5 !== 0) : []
        };
        return acc;
      }, {})
    };
    return calendars;
  }, {});
};

const createBookings = ({ clients, getLocalDateStr, now = Date.now() }) => {
  const today = startOfToday(now);
  const makeBooking = createBookingFactory({ today, getLocalDateStr });
  const timeCycle = ['06:00', '07:30', '09:00', '12:00', '15:00', '17:30', '19:00', '21:00'];
  const bookings = [];

  growthPlan.forEach((plan, planIndex) => {
    const monthStart = getMonthStart(today, plan.monthsAgo);
    for (let itemIndex = 0; itemIndex < plan.paidCount; itemIndex += 1) {
      const client = clients[(planIndex * 9 + itemIndex * 5 + (itemIndex % 4)) % clients.length];
      const service = pickGrowthService(planIndex, itemIndex);
      const paidAt = getMonthPaidAt({ today, monthStart, itemIndex, paidCount: plan.paidCount, now });
      const sessionDate = createSessionDateFromPaidAt(paidAt, itemIndex + planIndex);
      bookings.push(makeBooking({
        client,
        service,
        date: sessionDate,
        time: timeCycle[(itemIndex + planIndex) % timeCycle.length],
        status: 'confirmed',
        paymentStatus: 'paid',
        paidAtMs: paidAt,
        updatedAtMs: paidAt,
        createdAtMs: paidAt - (6 + (itemIndex % 30)) * 60 * 60 * 1000,
        sequence: planIndex * 100 + itemIndex
      }));
    }

    const cancelledCount = Math.max(1, Math.round(plan.paidCount / 28));
    for (let itemIndex = 0; itemIndex < cancelledCount; itemIndex += 1) {
      const client = clients[(planIndex * 7 + itemIndex * 13) % clients.length];
      const service = getServiceById(client.serviceId);
      const paidAt = getMonthPaidAt({ today, monthStart, itemIndex: itemIndex * 9 + 4, paidCount: plan.paidCount, now });
      const sessionDate = createSessionDateFromPaidAt(paidAt, itemIndex + 3);
      bookings.push(makeBooking({
        client,
        service,
        date: sessionDate,
        time: timeCycle[(itemIndex + planIndex + 2) % timeCycle.length],
        status: 'declined',
        paymentStatus: 'cancelled',
        updatedAtMs: paidAt,
        createdAtMs: paidAt - 9 * 60 * 60 * 1000,
        sequence: planIndex * 100 + itemIndex + 70
      }));
    }
  });

  const upcomingCount = 64;
  for (let index = 0; index < upcomingCount; index += 1) {
    const client = clients[(index * 7 + 3) % clients.length];
    const service = index % 9 === 0
      ? getServiceById('academy-intake')
      : index % 13 === 0
        ? getServiceById('team-energy-session')
        : getServiceById(client.serviceId);
    const status = index % 17 === 0 ? 'waitlist' : index % 5 === 0 ? 'pending' : 'confirmed';
    const paymentStatus = status === 'confirmed' && index % 4 === 0 ? 'paid' : 'manual_pending';
    const paidAtMs = paymentStatus === 'paid' ? now - (index + 2) * 67 * 60 * 1000 : undefined;
    bookings.push(makeBooking({
      client,
      service,
      offset: 2 + ((index * 3) % 58),
      time: timeCycle[(index + 4) % timeCycle.length],
      status,
      paymentStatus,
      paidAtMs,
      updatedAtMs: paidAtMs || now - (index + 4) * 43 * 60 * 1000,
      createdAtMs: (paidAtMs || now) - (8 + (index % 20)) * 60 * 60 * 1000,
      sequence: 2000 + index
    }));
  }

  return bookings.sort((a, b) => (b.updatedAt || b.timestamp || 0) - (a.updatedAt || a.timestamp || 0));
};

const createClientRecords = (clients, bookings) => (
  clients.map((client, index) => {
    const clientBookings = bookings.filter(booking => booking.clientEmail === client.email);
    const activeBookings = clientBookings.filter(booking => booking.status !== 'declined');
    const latest = [...clientBookings].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0] || null;
    const lifetimeInCents = activeBookings.reduce((sum, booking) => (
      sum + (booking.paymentStatus === 'paid' ? Number(booking.amountPaidInCents || booking.amountInCents || 0) : 0)
    ), 0);
    return {
      id: client.id,
      name: client.name,
      phone: client.phone,
      email: client.email,
      birthday: client.birthday,
      avatar: '',
      notes: [
        `${client.occupation} in ${client.city}, ${client.country}.`,
        `Primary goal: ${client.goal}.`,
        `Timezone: ${client.timezone}.`,
        `${activeBookings.length} booking-page bookings in this guest workspace.`,
        `Paid lifetime value: USD ${(lifetimeInCents / 100).toLocaleString('en-US')}.`,
        client.notes
      ].join(' '),
      labels: [
        client.label,
        client.country,
        activeBookings.length >= 10 ? 'High retention' : activeBookings.length >= 5 ? 'Returning' : 'Newer client',
        'Booking page'
      ].filter(Boolean),
      source: 'booking-page',
      demoSource: DEMO_SOURCE,
      createdAt: clientBookings[clientBookings.length - 1]?.createdAt || Date.now() - (index + 45) * DAY_MS,
      updatedAt: latest?.updatedAt || Date.now() - index * 60 * 60 * 1000
    };
  })
);

const createSettings = ({ createDefaultSettings, createDefaultCommunications, getLocalDateStr }) => {
  const schedule = createSchedule(getLocalDateStr);
  return {
    ...createDefaultSettings(),
    guestDemoVersion: 8,
    slug: 'jump-studios',
    brandName: 'Jump Studios',
    businessName: 'Jump Studios',
    currency: 'USD',
    tagline: 'ONLINE FITNESS ACADEMY',
    welcomeMessage: 'Book live coaching, form reviews, nutrition strategy, and small-group classes with a global team that works around real life.',
    primaryColor: '#050505',
    headingColor: '#050505',
    bodyColor: '#5f646d',
    backgroundColor: '#ffffff',
    slotBgColor: '#ffffff',
    slotTextColor: '#050505',
    dateBgColor: '#ffffff',
    dateTextColor: '#5f646d',
    dateActiveBgColor: '#050505',
    dateActiveTextColor: '#ffffff',
    buttonColor: '#050505',
    buttonTextColor: '#ffffff',
    fontFamily: 'figtree',
    headingFontFamily: 'figtree',
    bodyFontFamily: 'figtree',
    buttonFontFamily: 'space-grotesk',
    slotFontFamily: 'figtree',
    dateFontFamily: 'figtree',
    brandNameFontFamily: 'figtree',
    taglineFontFamily: 'figtree',
    welcomeFontFamily: 'figtree',
    brandNameSize: 58,
    taglineSize: 9,
    welcomeSize: 16,
    nativeAccent: true,
    calendarDisplayStyle: 'studio',
    timeDisplayStyle: 'pill',
    serviceDropdownEnabled: false,
    serviceBorderStyle: 'outline',
    faqDisplayStyle: 'accordion',
    faqStyle: 'outline',
    venueGalleryStyle: 'mosaic',
    mapDisplayStyle: 'card',
    socialDisplayStyle: 'minimal',
    socialIconStyle: 'outline',
    dateLabel: 'Choose your training day',
    timeLabel: 'Pick a coaching time',
    buttonText: 'Book Jump Studios',
    confirmButtonText: 'Reserve My Session',
    detailsHeading: 'Your Training Profile',
    detailsSubHeading: 'Tell the team what you want to improve so the session starts sharp.',
    successHeading: 'Session reserved',
    availableTimes: ['06:00', '07:30', '09:00', '12:00', '15:00', '17:30', '19:00', '21:00'],
    schedule,
    staffCalendars: createStaffCalendars(schedule),
    features: {
      birthday: false,
      waitlist: true,
      socialProof: true,
      loadingScreen: true,
      firstAvailable: true,
      collectClientName: true,
      collectClientPhone: true,
      collectClientEmail: true,
      collectClientNotes: true,
      emailUpdates: true,
      faqEnabled: true,
      socialLinks: true,
      location: 'Online academy - coaching across time zones',
      faqs: [
        { q: 'Can I book from any country?', a: 'Yes. Jump Studios is fully online. The booking page shows live times, and the client notes capture timezone context for the coaching team.' },
        { q: 'What happens after I book?', a: 'The business sees your request, payment state, notes, assigned coach, and chat thread in the same workspace so nothing is lost.' },
        { q: 'Do I need a gym?', a: 'No. Many clients train from home, hotels, or small apartments. Coaches adapt each session to the equipment listed in your booking notes.' },
        { q: 'Can teams book together?', a: 'Yes. Corporate Team Sessions support remote teams and are tracked in the same bookings, schedule, finance, and client systems.' }
      ]
    },
    accountProfiles: {
      'guest-workspace': {
        uid: 'guest-workspace',
        firstName: 'Maya',
        lastName: 'Chen',
        email: 'maya@jumpstudios.example',
        mobile: '+44 20 5555 0101',
        photoURL: '',
        updatedAt: Date.now()
      }
    },
    services,
    serviceIndustry: 'fitness',
    logoDisplay: { visible: true, alignment: 'center', size: 88, placement: 'title' },
    bannerDisplay: { visible: true, height: 240, position: 'center', placement: 'hero', opacity: 100 },
    logo: demoAssets.logo,
    bannerImage: demoAssets.studio,
    businessFooterImage: demoAssets.homeGym,
    venuePhotos: [demoAssets.studio, demoAssets.team, demoAssets.homeGym, demoAssets.weights],
    venueTitle: 'Online academy',
    venueIntro: 'A live coaching workspace for clients training across time zones, jobs, families, and real schedules.',
    address: 'Online academy - coaching across time zones',
    socials: {
      instagram: '@jumpstudios.training',
      tiktok: '@jumpstudios',
      facebook: 'jumpstudiosacademy',
      website: 'https://jumpstudios.example'
    },
    communications: createDefaultCommunications?.()
  };
};

const createCommunications = (createDefaultCommunications) => ({
  ...createDefaultCommunications(),
  confirmed: { active: true, text: 'Your Jump Studios session is confirmed. Your coach has your goals, timezone, and notes ready.' },
  review: { active: true, text: 'Thanks for training with Jump Studios. A quick review helps other clients choose the right session.' },
  waitlist: { active: true, text: 'A Jump Studios slot opened up. Reply quickly and we can move you from waitlist to confirmed.' },
  runningLate: { active: true, text: 'Your coach is running a few minutes behind. Your session is still protected and the team will keep you updated.' }
});

export const createJumpGuestWorkspace = ({ createDefaultSettings, createDefaultCommunications, getLocalDateStr } = {}) => {
  const clients = buildClients();
  const bookings = createBookings({ clients, getLocalDateStr });
  const settings = createSettings({ createDefaultSettings, createDefaultCommunications, getLocalDateStr });
  return {
    settings,
    bookings,
    staffList,
    clientRecords: createClientRecords(clients, bookings),
    communications: createCommunications(createDefaultCommunications)
  };
};

export const buildJumpGuestChatScript = ({ clientName = 'Client', serviceName = 'session', note = '', status = 'pending' } = {}) => {
  const cleanNote = String(note || '').replace(/\s+/g, ' ').trim();
  const goalMatch = cleanNote.match(/Goal:\s*(.*?)(?:\.\s|$)/i);
  const goal = goalMatch?.[1] || 'make training fit real life';
  return {
    preview: status === 'waitlist'
      ? `Can you keep me posted if a ${serviceName} slot opens?`
      : `Can we focus this ${serviceName} on ${goal.toLowerCase()}?`,
    messages: [
      `Hi Jump Studios, I booked ${serviceName} from the booking page.`,
      status === 'waitlist'
        ? `I am happy to take an earlier ${serviceName} slot if one opens.`
        : `Can we focus the session on ${goal.toLowerCase()}?`,
      `Absolutely. The coach can see your booking notes and will shape ${serviceName} around that.`,
      'Perfect, thank you. This makes the plan feel clear before I arrive.'
    ]
  };
};
