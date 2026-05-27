import { useRef, useState } from 'react';

const featureBookPages = [
  {
    number: '01',
    title: 'Editor',
    promise: 'Build a booking page that feels like your brand.',
    bullets: [
      'Live preview for desktop and mobile.',
      'Layouts for services, calendar, FAQs, slots, and galleries.',
      'Control logo, colors, fonts, images, socials, and wording.'
    ]
  },
  {
    number: '02',
    title: 'Services',
    promise: 'Make your menu clear in seconds.',
    bullets: [
      'Prices, durations, categories, images, and descriptions.',
      'Packages and add-ons for bigger bookings.',
      'Assign services to the right team members.'
    ]
  },
  {
    number: '03',
    title: 'Schedule',
    promise: 'Keep availability clean and easy to trust.',
    bullets: [
      'Open or close days with simple controls.',
      'View full days, adjust slots, and protect breaks.',
      'Hide times you cannot actually serve.'
    ]
  },
  {
    number: '04',
    title: 'Bookings',
    promise: 'Every request has a status and next step.',
    bullets: [
      'Confirm, reschedule, waitlist, or decline requests.',
      'Sort by service, client, status, and time.',
      'Jump from booking to matching chat.'
    ]
  },
  {
    number: '05',
    title: 'Support Inbox',
    promise: 'Messages stay tied to the right booking.',
    bullets: [
      'Tabs for unread, requests, waitlist, and reschedules.',
      'Premium threads with notes and quick actions.',
      'Handle changes without losing context.'
    ]
  },
  {
    number: '06',
    title: 'Clients',
    promise: 'Remember the people behind appointments.',
    bullets: [
      'Notes, history, tags, spend, and preferences.',
      'See who returns, spends, and needs follow-up.',
      'Keep chats and bookings tied together.'
    ]
  },
  {
    number: '07',
    title: 'Finance',
    promise: 'Know what was paid and how it moved.',
    bullets: [
      'Track day, week, month, custom, and all time.',
      'Support cash, EFT, Stripe, Payfast, Yoco, Ozow, and Paystack.',
      'Filter transactions in your selected currency.'
    ]
  },
  {
    number: '08',
    title: 'Team',
    promise: 'Know who handles what and when.',
    bullets: [
      'Add staff roles, services, and availability.',
      'Assign bookings to the right team member.',
      'See capacity without digging.'
    ]
  },
  {
    number: '09',
    title: 'Profile',
    promise: 'Keep identity and account controls together.',
    bullets: [
      'Manage details, owner settings, logo, socials, and brand.',
      'Access billing, guidance, and controls.',
      'Keep client links clean and current.'
    ]
  },
  {
    number: '10',
    title: 'Dashboard',
    promise: 'The business at a glance, without clutter.',
    bullets: [
      'See today, requests, earnings, clients, messages, and schedule.',
      'Explore a fully populated guest business.',
      'Signed-in accounts only see real data.'
    ]
  }
];

export function LandingFeatureBook() {
  const [page, setPage] = useState(0);
  const wheelRef = useRef(0);
  const lastPage = featureBookPages.length - 1;

  const turnPage = (direction) => {
    setPage(current => Math.min(lastPage, Math.max(0, current + direction)));
  };

  const handleWheel = (event) => {
    const direction = event.deltaY > 0 ? 1 : -1;
    if (Math.abs(event.deltaY) < 24) return;
    if ((direction < 0 && page === 0) || (direction > 0 && page === lastPage)) return;
    const now = Date.now();
    if (now - wheelRef.current < 620) return;
    wheelRef.current = now;
    event.preventDefault();
    turnPage(direction);
  };

  return (
    <section className="native-feature-book-section px-4 sm:px-6 py-14 md:py-24" onWheel={handleWheel}>
      <div className={`native-feature-book max-w-7xl mx-auto is-page-${page}`}>
        <aside className="native-feature-book-cover">
          <p>Product tour</p>
          <h2>Flip through the booking system.</h2>
          <span>The client page, schedule, chats, clients, and money desk.</span>
          <div className="native-feature-book-controls">
            <button onClick={() => turnPage(-1)} disabled={page === 0} aria-label="Previous feature"><span aria-hidden="true">&lt;</span></button>
            <span>{page + 1} / {featureBookPages.length}</span>
            <button onClick={() => turnPage(1)} disabled={page === lastPage} aria-label="Next feature"><span aria-hidden="true">&gt;</span></button>
          </div>
        </aside>

        <div className="native-feature-book-pages">
          {featureBookPages.map(item => (
            <article key={item.title} className={`native-feature-page ${item.title === 'Dashboard' ? 'native-feature-page-finale' : ''}`}>
              <p>{item.number}</p>
              <h3>{item.title}</h3>
              <strong>{item.promise}</strong>
              <ul>
                {item.bullets.map(bullet => <li key={bullet}>{bullet}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
