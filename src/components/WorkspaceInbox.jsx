import { useEffect, useMemo, useState } from 'react';
import { Bell, Calendar, Check, MessageCircle, Search, Send, UserRound, Users } from 'lucide-react';
import * as FirebaseSDK from '../services/firebase';

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

export function WorkspaceInbox({
  appId,
  db,
  user,
  workspaceOwnerId,
  bookings,
  updateBooking,
  setActiveTab,
  showToast
}) {
  const [threads, setThreads] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState('');
  const [threadQuery, setThreadQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!db || !workspaceOwnerId) return undefined;
    const threadsQuery = FirebaseSDK.query(
      FirebaseSDK.collection(db, 'artifacts', appId, 'clientThreads'),
      FirebaseSDK.where('ownerId', '==', workspaceOwnerId)
    );
    const unsub = FirebaseSDK.onSnapshot(threadsQuery, (snap) => {
      const next = snap.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((a, b) => timestampValue(b.updatedAt || b.lastMessageAt) - timestampValue(a.updatedAt || a.lastMessageAt));
      setThreads(next);
      setActiveThreadId(current => current || next[0]?.id || '');
    }, (error) => console.error('Workspace inbox sync failed', error));
    return () => unsub();
  }, [appId, db, workspaceOwnerId]);

  const activeThread = useMemo(
    () => threads.find(thread => thread.id === activeThreadId) || threads[0] || null,
    [activeThreadId, threads]
  );
  const linkedBooking = useMemo(
    () => bookings.find(booking => booking.id === activeThread?.bookingId) || null,
    [activeThread?.bookingId, bookings]
  );

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
    const unsub = FirebaseSDK.onSnapshot(messagesQuery, (snap) => {
      setMessages(snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })));
      if (Number(activeThread.ownerUnread || 0) > 0) {
        FirebaseSDK.updateDoc(
          FirebaseSDK.doc(db, 'artifacts', appId, 'clientThreads', activeThread.id),
          { ownerUnread: 0, ownerLastSeenAt: FirebaseSDK.serverTimestamp() }
        ).catch(() => {});
      }
    }, (error) => console.error('Workspace messages sync failed', error));
    return () => unsub();
  }, [activeThread?.id, appId, db]);

  const sendMessage = async (text = draft) => {
    const cleanText = String(text || '').trim();
    if (!cleanText || !db || !activeThread?.id || sending) return;
    setSending(true);
    try {
      await FirebaseSDK.addDoc(FirebaseSDK.collection(db, 'artifacts', appId, 'clientThreads', activeThread.id, 'messages'), {
        text: cleanText,
        kind: 'message',
        senderId: user?.uid || workspaceOwnerId,
        senderName: user?.displayName || user?.email || 'Team',
        senderRole: 'owner',
        createdAt: FirebaseSDK.serverTimestamp()
      });
      await FirebaseSDK.updateDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'clientThreads', activeThread.id), {
        lastMessage: cleanText,
        lastMessageAt: FirebaseSDK.serverTimestamp(),
        updatedAt: FirebaseSDK.serverTimestamp(),
        clientUnread: FirebaseSDK.increment(1),
        ownerUnread: 0
      });
      setDraft('');
    } finally {
      setSending(false);
    }
  };

  const confirmLinkedBooking = async () => {
    if (!linkedBooking) {
      showToast?.('No matching booking found for this thread yet.');
      return;
    }
    await updateBooking(linkedBooking.id, { status: 'confirmed' });
    if (activeThread?.id && db) {
      await FirebaseSDK.updateDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'clientThreads', activeThread.id), {
        bookingStatus: 'confirmed',
        rescheduleStatus: '',
        updatedAt: FirebaseSDK.serverTimestamp()
      }).catch(() => {});
      await sendMessage(`Confirmed: ${linkedBooking.date} at ${linkedBooking.time}.`);
    }
    showToast?.('Booking confirmed and client thread updated.');
  };

  const unreadCount = threads.reduce((sum, thread) => sum + Number(thread.ownerUnread || 0), 0);
  const filteredThreads = useMemo(() => {
    const queryText = threadQuery.trim().toLowerCase();
    if (!queryText) return threads;
    return threads.filter(thread => [
      thread.clientName,
      thread.clientEmail,
      thread.workspaceName,
      thread.lastMessage,
      thread.bookingStatus
    ].some(value => String(value || '').toLowerCase().includes(queryText)));
  }, [threadQuery, threads]);

  return (
    <section data-tour="client-inbox" className="saas-card overflow-hidden bg-white">
      <div className="p-5 md:p-7 border-b border-neutral-100 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-neutral-50 border border-neutral-100 px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-4">
            <MessageCircle size={13} className="text-black" />
            Support Inbox
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-black">Client conversations, built around bookings.</h2>
          <p className="text-sm md:text-base text-neutral-500 mt-2 max-w-2xl">New requests create a shared support thread so your team can confirm, reschedule, answer questions, and keep context attached to the right booking.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 min-w-[260px]">
          {[
            ['Threads', threads.length, MessageCircle],
            ['Unread', unreadCount, Bell],
            ['Linked', threads.filter(thread => thread.bookingId).length, Calendar]
          ].map(([label, value, IconCmp]) => (
            <div key={label} className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
              <IconCmp size={14} className="mb-2 text-neutral-400" />
              <p className="text-[8px] font-bold uppercase tracking-widest text-neutral-400">{label}</p>
              <p className="metric-value text-xl font-bold text-black">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 min-h-[620px]">
        <aside className="xl:col-span-4 border-b xl:border-b-0 xl:border-r border-neutral-100 bg-neutral-50/45">
          <div className="p-4 border-b border-neutral-100 bg-white/70">
            <div className="relative">
              <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-300" />
              <input
                value={threadQuery}
                onChange={(event) => setThreadQuery(event.target.value)}
                placeholder="Search client, email, message"
                className="w-full h-12 rounded-lg bg-white border border-neutral-200 pl-11 pr-4 text-sm font-bold outline-none focus:border-black transition-colors"
              />
            </div>
          </div>
          <div className="max-h-[360px] xl:max-h-[660px] overflow-y-auto">
            {filteredThreads.length ? filteredThreads.map(thread => {
              const active = activeThread?.id === thread.id;
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setActiveThreadId(thread.id)}
                  className={`w-full text-left p-5 border-b border-neutral-100 transition-colors ${active ? 'bg-black text-white' : 'bg-transparent hover:bg-white text-black'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`font-bold truncate ${active ? 'text-white' : 'text-black'}`}>{thread.clientName || 'Client'}</p>
                      <p className={`text-xs mt-1 truncate ${active ? 'text-white/55' : 'text-neutral-500'}`}>{thread.workspaceName || thread.clientEmail}</p>
                    </div>
                    {Number(thread.ownerUnread || 0) > 0 && <span className="min-w-6 h-6 rounded-full bg-[#39FF14] text-black text-[10px] font-bold flex items-center justify-center">{thread.ownerUnread}</span>}
                  </div>
                  <p className={`text-sm mt-4 line-clamp-2 ${active ? 'text-white/60' : 'text-neutral-500'}`}>{thread.lastMessage || 'No messages yet.'}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    <span className={`px-2 py-1 rounded-md border text-[8px] font-bold uppercase tracking-widest ${active ? 'border-white/15 bg-white/10 text-white/70' : statusStyles[thread.bookingStatus] || statusStyles.pending}`}>
                      {thread.bookingStatus || 'pending'}
                    </span>
                    {thread.rescheduleStatus === 'requested' && <span className="px-2 py-1 rounded-md bg-violet-50 text-violet-700 text-[8px] font-bold uppercase tracking-widest">Reschedule</span>}
                  </div>
                </button>
              );
            }) : (
              <div className="p-8 text-center">
                <div className="w-14 h-14 rounded-lg bg-white border border-neutral-100 flex items-center justify-center mx-auto mb-4 text-neutral-300"><Users size={22}/></div>
                <h3 className="font-bold text-black mb-2">{threads.length ? 'No matching threads' : 'No client threads yet'}</h3>
                <p className="text-sm text-neutral-500">{threads.length ? 'Try another name, email, or message keyword.' : 'New bookings with an email address will open a client support thread here automatically.'}</p>
              </div>
            )}
          </div>
        </aside>

        <div className="xl:col-span-8 flex flex-col min-h-[620px]">
          {activeThread ? (
            <>
              <div className="p-5 md:p-6 border-b border-neutral-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-lg bg-black text-white flex items-center justify-center shrink-0">
                    <UserRound size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xl font-bold text-black truncate">{activeThread.clientName || 'Client'}</h3>
                    <p className="text-sm text-neutral-500 truncate">{activeThread.clientEmail}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => setActiveTab?.('bookings')} className="h-10 px-4 rounded-lg border border-neutral-200 bg-white text-[9px] font-bold uppercase tracking-widest hover:border-black transition-colors">
                    Open Bookings
                  </button>
                  <button onClick={confirmLinkedBooking} className="h-10 px-4 rounded-lg bg-black text-white text-[9px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-neutral-800 transition-colors">
                    <Check size={13} /> Confirm
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-white space-y-3">
                {messages.map(message => {
                  const mine = message.senderRole === 'owner';
                  return (
                    <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[82%] rounded-2xl px-4 py-3 shadow-sm ${mine ? 'bg-black text-white rounded-br-md' : message.senderRole === 'system' ? 'bg-neutral-50 border border-neutral-100 text-neutral-500' : 'bg-neutral-50 text-black border border-neutral-100 rounded-bl-md'}`}>
                        <p className="text-[9px] font-bold uppercase tracking-widest opacity-45 mb-1">{message.senderRole === 'system' ? 'System' : message.senderName || message.senderRole}</p>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-4 md:p-5 border-t border-neutral-100 bg-neutral-50/50">
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Reply to client..."
                    rows={2}
                    className="flex-1 resize-none rounded-lg bg-white border border-neutral-200 px-4 py-3 text-sm font-medium outline-none focus:border-black transition-colors"
                  />
                  <button onClick={() => sendMessage()} disabled={!draft.trim() || sending} className="h-12 w-12 rounded-lg bg-black text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed">
                    <Send size={17} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-10 text-center">
              <div>
                <div className="w-16 h-16 rounded-lg bg-neutral-50 border border-neutral-100 flex items-center justify-center mx-auto mb-5 text-neutral-300"><MessageCircle size={24}/></div>
                <h3 className="text-2xl font-bold tracking-tight text-black mb-3">Client chat is ready</h3>
                <p className="text-sm text-neutral-500 max-w-sm">When a client books with an email address, their portal and your workspace thread connect here automatically.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
