import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  Download,
  LogOut,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  Smartphone,
  UserRound
} from 'lucide-react';
import { BuildABookingBrand } from './BuildABookingBrand';
import * as FirebaseSDK from '../services/firebase';

const normalizeEmail = (email = '') => String(email || '').trim().toLowerCase();

const timestampValue = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const statusStyles = {
  pending: 'bg-amber-50 text-amber-700 border-amber-100',
  confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  waitlist: 'bg-blue-50 text-blue-700 border-blue-100',
  declined: 'bg-red-50 text-red-600 border-red-100'
};

const navItems = [
  { id: 'chats', label: 'Chats', icon: MessageCircle },
  { id: 'bookings', label: 'My Bookings', icon: BookOpen },
  { id: 'profile', label: 'My Profile', icon: UserRound }
];

export function ClientPortal({ appId, db, user, onSignOut, onOwnerLogin, onInstallApp }) {
  const emailKey = normalizeEmail(user?.email);
  const [activeView, setActiveView] = useState('chats');
  const [bookings, setBookings] = useState([]);
  const [threads, setThreads] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState('');
  const [messageDraft, setMessageDraft] = useState('');
  const [threadSearch, setThreadSearch] = useState('');
  const [rescheduleDraft, setRescheduleDraft] = useState({ bookingId: '', date: '', time: '' });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!db || !emailKey) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const bookingsRef = FirebaseSDK.collection(db, 'artifacts', appId, 'clientAccess', emailKey, 'bookings');
    const threadsQuery = FirebaseSDK.query(
      FirebaseSDK.collection(db, 'artifacts', appId, 'clientThreads'),
      FirebaseSDK.where('clientEmail', '==', emailKey)
    );

    const unsubBookings = FirebaseSDK.onSnapshot(bookingsRef, (snap) => {
      const next = snap.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((a, b) => timestampValue(b.timestamp || b.createdAt) - timestampValue(a.timestamp || a.createdAt));
      setBookings(next);
      setLoading(false);
    }, (error) => {
      console.error('Client bookings sync failed', error);
      setLoading(false);
    });

    const unsubThreads = FirebaseSDK.onSnapshot(threadsQuery, (snap) => {
      const next = snap.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((a, b) => timestampValue(b.updatedAt || b.lastMessageAt) - timestampValue(a.updatedAt || a.lastMessageAt));
      setThreads(next);
      setActiveThreadId(current => current || next[0]?.id || '');
    }, (error) => console.error('Client threads sync failed', error));

    return () => {
      unsubBookings();
      unsubThreads();
    };
  }, [appId, db, emailKey]);

  const activeThread = useMemo(
    () => threads.find(thread => thread.id === activeThreadId) || threads[0] || null,
    [activeThreadId, threads]
  );

  const activeBooking = useMemo(
    () => bookings.find(booking => booking.id === activeThread?.bookingId) || bookings[0] || null,
    [activeThread?.bookingId, bookings]
  );

  const filteredThreads = useMemo(() => {
    const cleanSearch = threadSearch.trim().toLowerCase();
    if (!cleanSearch) return threads;
    return threads.filter(thread => [
      thread.workspaceName,
      thread.clientName,
      thread.lastMessage,
      thread.bookingStatus
    ].some(value => String(value || '').toLowerCase().includes(cleanSearch)));
  }, [threadSearch, threads]);

  useEffect(() => {
    if (!db || !activeThread?.id) {
      setMessages([]);
      return undefined;
    }

    const messagesQuery = FirebaseSDK.query(
      FirebaseSDK.collection(db, 'artifacts', appId, 'clientThreads', activeThread.id, 'messages'),
      FirebaseSDK.orderBy('createdAt', 'asc'),
      FirebaseSDK.limit(100)
    );
    const unsubMessages = FirebaseSDK.onSnapshot(messagesQuery, (snap) => {
      setMessages(snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })));
      if (Number(activeThread.clientUnread || 0) > 0) {
        FirebaseSDK.updateDoc(
          FirebaseSDK.doc(db, 'artifacts', appId, 'clientThreads', activeThread.id),
          { clientUnread: 0, clientLastSeenAt: FirebaseSDK.serverTimestamp() }
        ).catch(() => {});
      }
    }, (error) => console.error('Client messages sync failed', error));
    return () => unsubMessages();
  }, [activeThread?.id, appId, db]);

  const sendThreadMessage = async ({ text, kind = 'message', bookingId = '' }) => {
    const cleanText = String(text || '').trim();
    if (!cleanText || !db || !activeThread?.id || sending) return;
    setSending(true);
    try {
      const threadRef = FirebaseSDK.doc(db, 'artifacts', appId, 'clientThreads', activeThread.id);
      await FirebaseSDK.addDoc(FirebaseSDK.collection(db, 'artifacts', appId, 'clientThreads', activeThread.id, 'messages'), {
        text: cleanText,
        kind,
        bookingId,
        senderId: user.uid,
        senderName: user.displayName || user.email || 'Client',
        senderRole: 'client',
        createdAt: FirebaseSDK.serverTimestamp()
      });
      await FirebaseSDK.updateDoc(threadRef, {
        lastMessage: cleanText,
        lastMessageAt: FirebaseSDK.serverTimestamp(),
        updatedAt: FirebaseSDK.serverTimestamp(),
        ownerUnread: FirebaseSDK.increment(1),
        clientUnread: 0,
        rescheduleStatus: kind === 'reschedule-request' ? 'requested' : (activeThread.rescheduleStatus || '')
      });
      setMessageDraft('');
    } finally {
      setSending(false);
    }
  };

  const openBookingThread = (booking) => {
    if (booking.threadId) setActiveThreadId(booking.threadId);
    setRescheduleDraft(prev => ({ ...prev, bookingId: booking.id }));
    setActiveView('chats');
  };

  const sendRescheduleRequest = async () => {
    const booking = bookings.find(item => item.id === rescheduleDraft.bookingId) || activeBooking;
    if (!booking) return;
    if (booking.threadId) setActiveThreadId(booking.threadId);
    const preferredDate = rescheduleDraft.date || 'another available date';
    const preferredTime = rescheduleDraft.time || 'a better time';
    await sendThreadMessage({
      kind: 'reschedule-request',
      bookingId: booking.id,
      text: `Reschedule request for ${booking.workspaceName || 'booking'}: ${booking.date} at ${booking.time}. Preferred: ${preferredDate} at ${preferredTime}.`
    });
    setRescheduleDraft({ bookingId: booking.id, date: '', time: '' });
    setActiveView('chats');
  };

  const confirmedCount = bookings.filter(booking => booking.status === 'confirmed').length;
  const pendingCount = bookings.filter(booking => booking.status === 'pending' || booking.status === 'waitlist').length;
  const unreadCount = threads.reduce((sum, thread) => sum + Number(thread.clientUnread || 0), 0);

  const renderChatList = () => (
    <aside className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-neutral-100 bg-neutral-50/70">
      <div className="p-4 border-b border-neutral-100 bg-white/80">
        <div className="relative">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-300" />
          <input
            value={threadSearch}
            onChange={(event) => setThreadSearch(event.target.value)}
            placeholder="Search chats"
            className="w-full h-12 rounded-full bg-neutral-50 border border-neutral-100 pl-11 pr-4 text-sm font-bold outline-none focus:bg-white focus:border-black transition-colors"
          />
        </div>
      </div>
      <div className="max-h-[330px] lg:max-h-[680px] overflow-y-auto">
        {filteredThreads.length ? filteredThreads.map(thread => {
          const active = activeThread?.id === thread.id;
          return (
            <button
              key={thread.id}
              type="button"
              onClick={() => setActiveThreadId(thread.id)}
              className={`w-full text-left p-4 md:p-5 border-b border-neutral-100 transition-colors ${active ? 'bg-black text-white' : 'hover:bg-white text-black'}`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 font-bold ${active ? 'bg-white text-black' : 'bg-white border border-neutral-100 text-black'}`}>
                  {(thread.workspaceName || thread.clientName || 'B').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`font-bold truncate ${active ? 'text-white' : 'text-black'}`}>{thread.workspaceName || thread.clientName || 'Booking chat'}</p>
                    {Number(thread.clientUnread || 0) > 0 && <span className="min-w-5 h-5 rounded-full bg-[#39FF14] text-black text-[9px] font-bold flex items-center justify-center">{thread.clientUnread}</span>}
                  </div>
                  <p className={`text-xs mt-1 truncate ${active ? 'text-white/50' : 'text-neutral-400'}`}>{thread.clientName || emailKey}</p>
                  <p className={`text-sm mt-3 line-clamp-2 ${active ? 'text-white/65' : 'text-neutral-500'}`}>{thread.lastMessage || 'No messages yet.'}</p>
                </div>
              </div>
            </button>
          );
        }) : (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-white border border-neutral-100 flex items-center justify-center mx-auto mb-4 text-neutral-300"><MessageCircle size={22}/></div>
            <h3 className="font-bold text-black mb-2">{threads.length ? 'No chats found' : 'No chats yet'}</h3>
            <p className="text-sm text-neutral-500">{threads.length ? 'Try another search.' : 'Chats appear here after you book with your email address.'}</p>
          </div>
        )}
      </div>
    </aside>
  );

  const renderChatPane = () => (
    <section className="lg:col-span-8 flex flex-col min-h-[620px] bg-white">
      {activeThread ? (
        <>
          <div className="p-4 md:p-5 border-b border-neutral-100 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-full bg-black text-white flex items-center justify-center shrink-0 font-bold">
                {(activeThread.workspaceName || 'B').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg md:text-xl font-bold text-black truncate">{activeThread.workspaceName || 'Booking chat'}</h2>
                <p className="text-xs text-neutral-400 truncate">{activeBooking ? `${activeBooking.date} / ${activeBooking.time}` : activeThread.clientEmail}</p>
              </div>
            </div>
            <span className={`px-3 py-1.5 rounded-full border text-[9px] font-bold uppercase tracking-widest ${statusStyles[activeThread.bookingStatus] || statusStyles.pending}`}>
              {activeThread.bookingStatus || 'open'}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#F7F7F5] space-y-3">
            {messages.map(message => {
              const mine = message.senderRole === 'client';
              return (
                <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[84%] rounded-3xl px-4 py-3 shadow-sm ${mine ? 'bg-black text-white rounded-br-md' : message.senderRole === 'system' ? 'bg-white border border-neutral-200 text-neutral-500' : 'bg-white text-black border border-neutral-200 rounded-bl-md'}`}>
                    <p className="text-[8px] font-bold uppercase tracking-widest opacity-45 mb-1">{message.senderRole === 'system' ? 'Update' : message.senderName || message.senderRole}</p>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
                  </div>
                </div>
              );
            })}
            {!messages.length && (
              <div className="h-full flex items-center justify-center text-center">
                <p className="text-sm font-medium text-neutral-400">No messages yet. Start the conversation below.</p>
              </div>
            )}
          </div>

          <div className="p-4 md:p-5 border-t border-neutral-100 bg-white space-y-3">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
                <select
                  value={rescheduleDraft.bookingId || activeBooking?.id || ''}
                  onChange={(event) => setRescheduleDraft(prev => ({ ...prev, bookingId: event.target.value }))}
                  className="h-11 rounded-xl bg-white border border-neutral-100 px-3 text-xs font-bold outline-none"
                >
                  {bookings.map(booking => <option key={booking.id} value={booking.id}>{booking.date} / {booking.time}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input value={rescheduleDraft.date} onChange={(event) => setRescheduleDraft(prev => ({ ...prev, date: event.target.value }))} placeholder="New date" className="h-11 rounded-xl bg-white border border-neutral-100 px-3 text-xs font-bold outline-none" />
                  <input value={rescheduleDraft.time} onChange={(event) => setRescheduleDraft(prev => ({ ...prev, time: event.target.value }))} placeholder="New time" className="h-11 rounded-xl bg-white border border-neutral-100 px-3 text-xs font-bold outline-none" />
                </div>
                <button onClick={sendRescheduleRequest} disabled={!bookings.length || sending} className="h-11 px-4 rounded-xl bg-white border border-neutral-200 text-[9px] font-bold uppercase tracking-widest hover:border-black disabled:opacity-40">
                  Reschedule
                </button>
              </div>
            </div>
            <div className="flex items-end gap-2">
              <textarea
                value={messageDraft}
                onChange={(event) => setMessageDraft(event.target.value)}
                placeholder="Write a message..."
                rows={2}
                className="flex-1 resize-none rounded-2xl bg-neutral-50 border border-neutral-100 px-4 py-3 text-sm font-medium outline-none focus:bg-white focus:border-black transition-colors"
              />
              <button onClick={() => sendThreadMessage({ text: messageDraft })} disabled={!messageDraft.trim() || sending} className="h-12 w-12 rounded-2xl bg-black text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed">
                <Send size={17} />
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center p-10 text-center">
          <div>
            <div className="w-16 h-16 rounded-full bg-neutral-50 border border-neutral-100 flex items-center justify-center mx-auto mb-5 text-neutral-300"><MessageCircle size={24}/></div>
            <h3 className="text-2xl font-bold tracking-tight mb-3">Chats will appear here</h3>
            <p className="text-sm text-neutral-500 max-w-sm mx-auto">Use the same email when you book and the conversation will connect automatically.</p>
          </div>
        </div>
      )}
    </section>
  );

  const renderBookings = () => (
    <section className="rounded-[1.25rem] md:rounded-lg bg-white border border-neutral-200 shadow-sm overflow-hidden">
      <div className="p-5 md:p-7 border-b border-neutral-100 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-neutral-400 mb-2">Booking Timeline</p>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight">My Bookings</h1>
          <p className="text-sm md:text-base text-neutral-500 mt-2">Track upcoming requests, confirmed visits, waitlist spots, and reschedule conversations.</p>
        </div>
        <RefreshCw size={18} className="text-neutral-300" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 md:p-6 bg-neutral-50/60">
        {bookings.length ? bookings.map(booking => (
          <article key={booking.id} className="rounded-lg bg-white border border-neutral-100 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4 mb-8">
              <div>
                <span className={`inline-flex px-3 py-1.5 rounded-full border text-[9px] font-bold uppercase tracking-widest ${statusStyles[booking.status] || statusStyles.pending}`}>{booking.status || 'pending'}</span>
                <h3 className="text-2xl font-bold tracking-tight mt-4">{booking.workspaceName || 'Booking'}</h3>
                <p className="text-sm text-neutral-500 mt-1">{booking.date} / {booking.time}</p>
              </div>
              <Calendar size={20} className="text-neutral-300" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => openBookingThread(booking)} className="h-11 rounded-lg bg-black text-white text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                Chat <ArrowRight size={13} />
              </button>
              <button type="button" onClick={() => { openBookingThread(booking); setRescheduleDraft({ bookingId: booking.id, date: '', time: '' }); }} className="h-11 rounded-lg bg-white border border-neutral-200 text-black text-[9px] font-bold uppercase tracking-widest">
                Reschedule
              </button>
            </div>
          </article>
        )) : (
          <div className="md:col-span-2 p-10 md:p-16 text-center">
            <div className="w-16 h-16 rounded-lg bg-white border border-neutral-100 flex items-center justify-center mx-auto mb-5 text-neutral-300"><Calendar size={24}/></div>
            <h3 className="text-2xl font-bold tracking-tight mb-3">No client bookings yet</h3>
            <p className="text-sm text-neutral-500 max-w-md mx-auto">Bookings linked to {emailKey || 'your email'} will appear here after you submit a request.</p>
          </div>
        )}
      </div>
    </section>
  );

  const renderProfile = () => (
    <section className="grid grid-cols-1 xl:grid-cols-12 gap-5 md:gap-6">
      <div className="xl:col-span-7 rounded-[1.25rem] md:rounded-lg bg-black text-white p-6 md:p-9 overflow-hidden relative shadow-2xl shadow-black/10">
        <div className="absolute inset-0 opacity-70 native-subtle-gradient" />
        <div className="relative z-10">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-white/40 mb-4">My Profile</p>
          <div className="flex items-start gap-4 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-white text-black flex items-center justify-center overflow-hidden font-bold text-2xl shrink-0">
              {user?.photoURL ? <img src={user.photoURL} alt="Client avatar" className="w-full h-full object-cover" /> : (user?.email?.charAt(0)?.toUpperCase() || 'C')}
            </div>
            <div className="min-w-0">
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight truncate">{user?.displayName || 'Client account'}</h1>
              <p className="text-white/55 mt-2 break-all">{user?.email}</p>
            </div>
          </div>
          <p className="text-white/65 text-base md:text-lg max-w-2xl">This is your client-side home for bookings, messages, updates, and reschedule requests across any business using Build A Booking.</p>
        </div>
      </div>

      <div className="xl:col-span-5 grid grid-cols-2 gap-3 md:gap-4">
        {[
          ['Bookings', bookings.length, BookOpen],
          ['Confirmed', confirmedCount, CheckCircle2],
          ['Needs Update', pendingCount, Bell],
          ['Unread', unreadCount, MessageCircle]
        ].map(([label, value, IconCmp]) => (
          <div key={label} className="rounded-lg bg-white border border-neutral-200 p-4 md:p-5 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-neutral-50 border border-neutral-100 flex items-center justify-center mb-5">
              <IconCmp size={17} />
            </div>
            <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-neutral-400 mb-2">{label}</p>
            <p className="metric-value text-3xl font-bold">{loading ? '-' : value}</p>
          </div>
        ))}
      </div>

      <div className="xl:col-span-12 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <article className="rounded-lg bg-white border border-neutral-200 p-5 md:p-6 shadow-sm">
          <Smartphone size={20} className="mb-5 text-black" />
          <h2 className="text-xl font-bold tracking-tight">Keep it one tap away.</h2>
          <p className="text-sm text-neutral-500 mt-2 mb-5">Add the app so booking updates and chats are easy to find after you book.</p>
          {onInstallApp && (
            <button onClick={onInstallApp} className="w-full h-11 rounded-full bg-black text-white text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2">
              <Download size={14} /> Add App
            </button>
          )}
        </article>

        <article className="rounded-lg bg-white border border-neutral-200 p-5 md:p-6 shadow-sm">
          <UserRound size={20} className="mb-5 text-black" />
          <h2 className="text-xl font-bold tracking-tight">Using the owner side?</h2>
          <p className="text-sm text-neutral-500 mt-2 mb-5">Switch to owner login when you need to manage a business workspace.</p>
          <button onClick={onOwnerLogin} className="w-full h-11 rounded-full bg-white border border-neutral-200 text-black text-[10px] font-bold uppercase tracking-widest hover:border-black transition-colors">
            Owner Login
          </button>
        </article>

        <article className="rounded-lg bg-white border border-neutral-200 p-5 md:p-6 shadow-sm">
          <LogOut size={20} className="mb-5 text-black" />
          <h2 className="text-xl font-bold tracking-tight">Account session</h2>
          <p className="text-sm text-neutral-500 mt-2 mb-5">Sign out when you are finished on this device.</p>
          <button onClick={onSignOut} className="w-full h-11 rounded-full bg-black text-white text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2">
            <LogOut size={14} /> Sign Out
          </button>
        </article>
      </div>
    </section>
  );

  return (
    <div className="native-ui min-h-screen bg-[#F7F7F5] text-black pb-28 md:pb-0">
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-b border-neutral-200/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 h-16 md:h-20 flex items-center justify-between gap-4">
          <BuildABookingBrand className="w-[154px] md:w-[190px]" />
          <div className="hidden md:flex items-center gap-2 rounded-full bg-neutral-50 border border-neutral-100 p-1">
            {navItems.map(item => {
              const IconCmp = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  className={`h-10 px-4 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-all ${activeView === item.id ? 'bg-black text-white shadow-lg shadow-black/10' : 'text-neutral-500 hover:text-black'}`}
                >
                  <IconCmp size={14} /> {item.label}
                </button>
              );
            })}
          </div>
          <button onClick={onSignOut} className="h-10 w-10 md:w-auto md:px-4 rounded-full bg-black text-white text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-black/10">
            <LogOut size={14} />
            <span className="hidden md:inline">Sign Out</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-5 md:py-10">
        <section className="mb-5 md:mb-6 rounded-[1.25rem] md:rounded-lg bg-white border border-neutral-200 p-4 md:p-5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-lg bg-black text-white flex items-center justify-center shrink-0 shadow-xl shadow-black/10">
              {activeView === 'chats' ? <MessageCircle size={18} /> : activeView === 'bookings' ? <BookOpen size={18} /> : <UserRound size={18} />}
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-neutral-400 mb-1">Client App</p>
              <h1 className="text-2xl md:text-4xl font-bold tracking-tight">
                {activeView === 'chats' ? 'Chats' : activeView === 'bookings' ? 'My Bookings' : 'My Profile'}
              </h1>
              <p className="text-sm text-neutral-500 mt-1 max-w-2xl">
                {activeView === 'chats'
                  ? 'Message the businesses you booked with and keep every update in one thread.'
                  : activeView === 'bookings'
                    ? 'See your booking history, current status, and the quickest path to support.'
                    : 'Manage your client account, app access, and sign-in session.'}
              </p>
            </div>
          </div>
          {activeView === 'chats' && threads.length > 0 && (
            <button type="button" onClick={() => setActiveThreadId(threads[0].id)} className="h-11 px-4 rounded-full bg-white border border-neutral-200 text-black text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:border-black transition-colors">
              Latest Chat <ArrowRight size={13} />
            </button>
          )}
        </section>

        {activeView === 'chats' && (
          <section className="rounded-[1.25rem] md:rounded-lg bg-white border border-neutral-200 shadow-sm overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-12">
              {renderChatList()}
              {renderChatPane()}
            </div>
          </section>
        )}
        {activeView === 'bookings' && renderBookings()}
        {activeView === 'profile' && renderProfile()}
      </main>

      <nav className="fixed md:hidden left-3 right-3 bottom-4 z-40 rounded-[1.5rem] bg-white/90 backdrop-blur-xl border border-neutral-200 shadow-2xl shadow-black/10 p-2 grid grid-cols-3 gap-2">
        {navItems.map(item => {
          const IconCmp = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id)}
              className={`h-14 rounded-2xl flex flex-col items-center justify-center gap-1 text-[8px] font-bold uppercase tracking-widest transition-all ${activeView === item.id ? 'bg-black text-white shadow-lg shadow-black/10' : 'text-neutral-400'}`}
            >
              <IconCmp size={18} />
              {item.label.replace('My ', '')}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
