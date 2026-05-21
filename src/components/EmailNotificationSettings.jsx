import { Bell, Check, Mail } from 'lucide-react';

const emailTemplates = [
  { key: 'confirmed', title: 'Request Confirmed', desc: 'Sent when you approve a booking request.' },
  { key: 'review', title: 'Thank You Follow-up', desc: 'Sent manually from a booking record after the appointment.' },
  { key: 'waitlist', title: 'Waitlist Alert', desc: 'Sent when manually opening a waitlist spot.' },
  { key: 'runningLate', title: 'Running Late Email', desc: 'Sent when you need to let clients know you are behind schedule.' }
];

export function EmailNotificationSettings({ communications, setCommunications, saveComms, showToast }) {
  const activeCount = emailTemplates.filter(item => communications[item.key]?.active).length;

  const updateTemplate = (key, updates) => {
    setCommunications({
      ...communications,
      [key]: {
        ...(communications[key] || {}),
        ...updates
      }
    });
  };

  const toggleTemplate = (key) => {
    const next = {
      ...communications,
      [key]: {
        ...(communications[key] || {}),
        active: !communications[key]?.active
      }
    };
    saveComms(next);
  };

  return (
    <section data-tour="email-messages" className="rounded-lg border border-neutral-100 bg-white shadow-[0_25px_80px_-65px_rgba(15,23,42,0.65)] overflow-hidden">
      <div className="p-5 md:p-7 border-b border-neutral-100 flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-neutral-50 border border-neutral-100 px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-4">
            <Mail size={13} className="text-black" />
            Email notifications
          </div>
          <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-black">Client email touchpoints</h3>
          <p className="text-sm text-neutral-500 leading-relaxed mt-2 max-w-2xl">Tune the exact messages clients can receive after they tick the email-updates consent box on your booking page.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 min-w-[220px]">
          <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-4">
            <Bell size={15} className="mb-3 text-neutral-400" />
            <p className="text-[8px] font-bold uppercase tracking-widest text-neutral-400">Enabled</p>
            <p className="metric-value text-2xl font-bold text-black">{activeCount}/{emailTemplates.length}</p>
          </div>
          <button
            type="button"
            onClick={() => { saveComms(communications); showToast?.('Email settings saved'); }}
            className="rounded-lg bg-black text-white p-4 flex flex-col items-start justify-between gap-4 hover:bg-neutral-800 transition-colors"
          >
            <Check size={16} />
            <span className="text-[9px] font-bold uppercase tracking-widest">Save All</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 p-4 md:p-6 bg-neutral-50/60">
        {emailTemplates.map(item => (
          <article key={item.key} className="bg-white p-5 md:p-6 rounded-lg border border-neutral-100 shadow-sm">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h4 className="text-lg font-bold tracking-tight text-black">{item.title}</h4>
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1 leading-relaxed">{item.desc}</p>
              </div>
              <button
                type="button"
                onClick={() => toggleTemplate(item.key)}
                className={`w-14 h-8 rounded-full flex items-center px-1 transition-colors shrink-0 ${communications[item.key]?.active ? 'bg-[#39FF14]' : 'bg-neutral-200'}`}
                aria-pressed={Boolean(communications[item.key]?.active)}
              >
                <span className={`w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${communications[item.key]?.active ? 'translate-x-6' : ''}`} />
              </button>
            </div>
            <textarea
              value={communications[item.key]?.text || ''}
              onChange={(event) => updateTemplate(item.key, { text: event.target.value })}
              className="w-full bg-neutral-50 border border-transparent rounded-lg p-4 text-sm font-medium focus:bg-white focus:border-neutral-200 transition-all outline-none min-h-[118px] resize-none"
            />
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => { saveComms(communications); showToast?.('Message saved'); }}
                className="h-10 px-5 bg-black text-white text-[10px] font-bold uppercase tracking-widest rounded-full hover:bg-neutral-800 transition-colors"
              >
                Save Message
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
