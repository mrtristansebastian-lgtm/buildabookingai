import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bell, Calendar, Check, Clock, Maximize2, MessageCircle, Minimize2, RefreshCw, Search, Send, Users, X } from 'lucide-react';
import * as FirebaseSDK from '../services/firebase';
import { makeClientNotification, notificationEmailKey, NOTIFICATION_TYPES } from '../services/notifications';

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

const LIVE_MESSAGE_LIMIT = 20;

const formatPresenceTime = (value) => {
  const ms = timestampValue(value);
  if (!ms) return '';
  const diff = Math.max(0, Date.now() - ms);
  if (diff < 60_000) return 'just now';
  if (diff < 60 * 60_000) return `${Math.max(1, Math.round(diff / 60_000))}m ago`;
  if (diff < 24 * 60 * 60_000) return `${Math.max(1, Math.round(diff / (60 * 60_000)))}h ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export function WorkspaceInbox({
  appId,
  db,
  user,
  workspaceOwnerId,
  bookings,
  clientDirectory = [],
  staffList = [],
  updateBooking,
  setActiveTab,
  focusTarget,
  showToast
}) {
  const [threads, setThreads] = useState([]);
  const [messages, setMessages] = useState([]);
  const [olderMessages, setOlderMessages] = useState([]);
  const [oldestMessageCursor, setOldestMessageCursor] = useState(null);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [threadsReady, setThreadsReady] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState('');
  const [threadQuery, setThreadQuery] = useState('');
  const [supportFilter, setSupportFilter] = useState('all');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [chatFullscreen, setChatFullscreen] = useState(false);
  const [actionDialog, setActionDialog] = useState(null);

  const exampleThread = useMemo(() => ({
    id: 'example-support-thread',
    clientName: 'Example Client',
    clientEmail: 'client@example.com',
    workspaceName: 'Studio Noir',
    lastMessage: 'Could I move my booking to later in the afternoon?',
    bookingId: 'example-support-booking',
    bookingStatus: 'pending',
    ownerUnread: 1,
    clientUnread: 0,
    rescheduleStatus: 'requested',
    isExample: true
  }), []);

  const exampleBooking = useMemo(() => ({
    id: 'example-support-booking',
    clientName: 'Example Client',
    clientEmail: 'client@example.com',
    date: 'Thursday, May 28',
    time: '10:30',
    status: 'pending',
    isExample: true
  }), []);

  const exampleMessages = useMemo(() => ([
    {
      id: 'example-system',
      senderRole: 'system',
      senderName: 'Booking update',
      text: 'Example booking request received for Thursday, May 28 at 10:30.'
    },
    {
      id: 'example-client',
      senderRole: 'client',
      senderName: 'Example Client',
      text: 'Hey, could I move this to later in the afternoon if anything is open?'
    },
    {
      id: 'example-owner',
      senderRole: 'owner',
      senderName: 'Team',
      text: 'Absolutely. We can offer 14:30 or place you on the waitlist for 16:00.'
    }
  ]), []);

  const shouldShowExampleThread = threadsReady && threads.length === 0 && bookings.length === 0;
  const threadSource = threads.length ? threads : (shouldShowExampleThread ? [exampleThread] : []);
  const clientProfileByEmail = useMemo(() => {
    const profiles = new Map();
    clientDirectory.forEach(client => {
      const emailKey = notificationEmailKey(client.email || '');
      if (emailKey) profiles.set(emailKey, client);
    });
    return profiles;
  }, [clientDirectory]);
  const getThreadClientProfile = (thread = {}) => {
    const emailKey = notificationEmailKey(thread.clientEmail || '');
    if (emailKey && clientProfileByEmail.has(emailKey)) return clientProfileByEmail.get(emailKey);
    return clientDirectory.find(client => (
      String(client.name || '').trim().toLowerCase() === String(thread.clientName || '').trim().toLowerCase()
    )) || null;
  };
  const getThreadAvatar = (thread = {}) => (
    thread.clientPhotoURL ||
    thread.clientAvatar ||
    getThreadClientProfile(thread)?.avatar ||
    ''
  );

  useEffect(() => {
    if (!db || !workspaceOwnerId) {
      setThreadsReady(true);
      return undefined;
    }
    setThreadsReady(false);
    const threadsQuery = FirebaseSDK.query(
      FirebaseSDK.collection(db, 'artifacts', appId, 'clientThreads'),
      FirebaseSDK.where('ownerId', '==', workspaceOwnerId)
    );
    const unsub = FirebaseSDK.onSnapshot(threadsQuery, (snap) => {
      const next = snap.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((a, b) => timestampValue(b.updatedAt || b.lastMessageAt) - timestampValue(a.updatedAt || a.lastMessageAt));
      setThreads(next);
      setActiveThreadId(current => (current && next.some(thread => thread.id === current)) ? current : (next[0]?.id || ''));
      setThreadsReady(true);
    }, (error) => {
      console.error('Workspace inbox sync failed', error);
      setThreadsReady(true);
    });
    return () => unsub();
  }, [appId, db, workspaceOwnerId]);

  const activeThread = useMemo(
    () => threadSource.find(thread => thread.id === activeThreadId) || threadSource[0] || null,
    [activeThreadId, threadSource]
  );
  const linkedBooking = useMemo(
    () => activeThread?.isExample ? exampleBooking : bookings.find(booking => booking.id === activeThread?.bookingId) || null,
    [activeThread?.bookingId, activeThread?.isExample, bookings, exampleBooking]
  );
  const visibleMessages = activeThread?.isExample ? exampleMessages : [...olderMessages, ...messages];
  const activeStaff = useMemo(() => {
    const emailKey = notificationEmailKey(user?.email || '');
    return staffList.find(staff => notificationEmailKey(staff.email || '') === emailKey || staff.uid === user?.uid) || staffList[0] || null;
  }, [staffList, user?.email, user?.uid]);
  const assignedStaff = useMemo(() => (
    linkedBooking?.staffId ? staffList.find(staff => staff.id === linkedBooking.staffId) : null
  ), [linkedBooking?.staffId, staffList]);
  const buildRescheduleProposal = ({ date, time, requestedBy = 'owner', source = 'offer', message = '' }) => ({
    id: `reschedule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    bookingId: activeThread?.bookingId || linkedBooking?.id || '',
    date,
    time,
    requestedBy,
    source,
    status: 'pending',
    message,
    createdAtMs: Date.now()
  });
  const getMessageProposal = (message = {}) => (
    message.proposedReschedule ||
    message.rescheduleProposal ||
    (String(message.kind || '').startsWith('reschedule') ? activeThread?.proposedReschedule : null)
  );
  const isPendingProposal = (proposal = {}) => !['accepted', 'declined', 'cancelled'].includes(String(proposal.status || 'pending'));
  const formatProposalLabel = (proposal = {}) => [proposal.date, proposal.time].filter(Boolean).join(' at ');

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    document.documentElement.classList.toggle('support-chat-open', mobileChatOpen);
    return () => document.documentElement.classList.remove('support-chat-open');
  }, [mobileChatOpen]);

  useEffect(() => {
    if (!focusTarget?.requestId) return;
    const match = threadSource.find(thread => (
      (focusTarget.threadId && thread.id === focusTarget.threadId) ||
      (focusTarget.bookingId && thread.bookingId === focusTarget.bookingId)
    ));
    if (!match) return;
    setActiveThreadId(match.id);
    setThreadQuery('');
    setMobileChatOpen(true);
  }, [focusTarget?.requestId, focusTarget?.threadId, focusTarget?.bookingId, threadSource]);

  const createClientNotification = async (email, payload) => {
    const emailKey = notificationEmailKey(email);
    if (!db || !emailKey) return false;
    try {
      await FirebaseSDK.addDoc(
        FirebaseSDK.collection(db, 'artifacts', appId, 'clientAccess', emailKey, 'notifications'),
        {
          ...payload,
          clientEmail: emailKey,
          ownerId: payload.ownerId || workspaceOwnerId,
          audience: 'client',
          read: false,
          createdAtMs: payload.createdAtMs || Date.now(),
          createdAt: FirebaseSDK.serverTimestamp()
        }
      );
      return true;
    } catch (error) {
      console.error('Client notification from inbox failed', error);
      return false;
    }
  };

  useEffect(() => {
    if (!db || !activeThread?.id || activeThread?.isExample) {
      setMessages([]);
      setOlderMessages([]);
      setOldestMessageCursor(null);
      setHasOlderMessages(false);
      return undefined;
    }
    setOlderMessages([]);
    setOldestMessageCursor(null);
    setHasOlderMessages(false);
    const messagesQuery = FirebaseSDK.query(
      FirebaseSDK.collection(db, 'artifacts', appId, 'clientThreads', activeThread.id, 'messages'),
      FirebaseSDK.orderBy('createdAt', 'desc'),
      FirebaseSDK.limit(LIVE_MESSAGE_LIMIT)
    );
    const unsub = FirebaseSDK.onSnapshot(messagesQuery, (snap) => {
      const docs = snap.docs;
      setMessages(docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })).reverse());
      setOldestMessageCursor(docs[docs.length - 1] || null);
      setHasOlderMessages(docs.length === LIVE_MESSAGE_LIMIT);
      if (Number(activeThread.ownerUnread || 0) > 0) {
        FirebaseSDK.updateDoc(
          FirebaseSDK.doc(db, 'artifacts', appId, 'clientThreads', activeThread.id),
          { ownerUnread: 0, ownerLastSeenAt: FirebaseSDK.serverTimestamp() }
        ).catch(() => {});
      }
    }, (error) => console.error('Workspace messages sync failed', error));
    return () => unsub();
  }, [activeThread?.id, appId, db]);

  const loadPreviousMessages = async () => {
    if (!db || !activeThread?.id || activeThread?.isExample || !oldestMessageCursor || loadingOlderMessages) return;
    setLoadingOlderMessages(true);
    try {
      const olderQuery = FirebaseSDK.query(
        FirebaseSDK.collection(db, 'artifacts', appId, 'clientThreads', activeThread.id, 'messages'),
        FirebaseSDK.orderBy('createdAt', 'desc'),
        FirebaseSDK.startAfter(oldestMessageCursor),
        FirebaseSDK.limit(LIVE_MESSAGE_LIMIT)
      );
      const snap = await FirebaseSDK.getDocs(olderQuery);
      const docs = snap.docs;
      const older = docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })).reverse();
      setOlderMessages(current => {
        const seen = new Set(current.map(message => message.id));
        return [...older.filter(message => !seen.has(message.id)), ...current];
      });
      if (docs.length) setOldestMessageCursor(docs[docs.length - 1]);
      setHasOlderMessages(docs.length === LIVE_MESSAGE_LIMIT);
    } catch (error) {
      console.error('Loading previous workspace messages failed', error);
      showToast?.('Could not load older messages. Try again.');
    } finally {
      setLoadingOlderMessages(false);
    }
  };

  const sendMessage = async (text = draft, extra = {}) => {
    const cleanText = String(text || '').trim();
    if (!cleanText || !db || !activeThread?.id || sending) return;
    if (activeThread.isExample) {
      setDraft('');
      showToast?.('Example preview only. Real replies will send when a client thread exists.');
      return;
    }
    setSending(true);
    try {
      await FirebaseSDK.addDoc(FirebaseSDK.collection(db, 'artifacts', appId, 'clientThreads', activeThread.id, 'messages'), {
        ...extra,
        text: cleanText,
        kind: extra.kind || 'message',
        senderId: user?.uid || workspaceOwnerId,
        senderName: activeStaff?.name || user?.displayName || user?.email || 'Team',
        senderPhotoURL: activeStaff?.photoURL || user?.photoURL || '',
        staffId: activeStaff?.id || '',
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
      await createClientNotification(activeThread.clientEmail, makeClientNotification({
        type: NOTIFICATION_TYPES.NEW_MESSAGE,
        title: `New message from ${activeThread.workspaceName || 'the business'}`,
        body: cleanText,
        ownerId: workspaceOwnerId,
        booking: linkedBooking || {},
        bookingId: activeThread.bookingId || '',
        threadId: activeThread.id,
        view: 'chats',
        priority: 'high',
        metadata: { senderRole: 'owner' }
      }));
      setDraft('');
    } finally {
      setSending(false);
    }
  };

  const confirmLinkedBooking = async () => {
    if (activeThread?.isExample) {
      showToast?.('Example preview only. Real requests can be approved from live threads.');
      return;
    }
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

  const offerReschedule = (proposal = null) => {
    if (activeThread?.isExample) {
      showToast?.('Example preview only. Live threads can send reschedule options.');
      return;
    }
    if (!activeThread?.id) {
      showToast?.('Open a client thread first.');
      return;
    }

    setActionDialog({
      type: 'reschedule',
      title: proposal ? 'Counter with another time' : 'Offer a new time',
      eyebrow: proposal ? 'Counter offer' : 'Reschedule',
      requestMode: proposal ? 'counter' : 'offer',
      date: proposal?.date || linkedBooking?.date || '',
      time: proposal?.time || linkedBooking?.time || '',
      message: ''
    });
  };

  const submitRescheduleOffer = async () => {
    const cleanDate = String(actionDialog?.date || '').trim();
    if (!cleanDate) {
      showToast?.('Add a date before sending a reschedule option.');
      return;
    }

    const cleanTime = String(actionDialog?.time || '').trim();
    if (!cleanTime) {
      showToast?.('Add a time before sending a reschedule option.');
      return;
    }

    const message = String(actionDialog?.message || '').trim()
      || `Reschedule option: ${cleanDate} at ${cleanTime}. Reply here to confirm and we will update your booking.`;
    const proposal = buildRescheduleProposal({
      date: cleanDate,
      time: cleanTime,
      requestedBy: 'owner',
      source: actionDialog?.requestMode === 'counter' ? 'counter' : 'offer',
      message
    });

    if (db && activeThread.id) {
      await FirebaseSDK.updateDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'clientThreads', activeThread.id), {
        rescheduleStatus: actionDialog?.requestMode === 'counter' ? 'countered' : 'offered',
        proposedReschedule: proposal,
        updatedAt: FirebaseSDK.serverTimestamp()
      }).catch(() => {});
    }
    await sendMessage(message, {
      kind: actionDialog?.requestMode === 'counter' ? 'reschedule-counter' : 'reschedule-offer',
      proposedReschedule: proposal
    });
    setActionDialog(null);
    showToast?.(actionDialog?.requestMode === 'counter' ? 'Counter offer sent to the client.' : 'Reschedule option sent to the client.');
  };

  const acceptRescheduleProposal = async (proposal = {}) => {
    if (activeThread?.isExample) {
      showToast?.('Example preview only. Live reschedule requests can be accepted from here.');
      return;
    }
    if (!linkedBooking) {
      showToast?.('No matching booking found for this reschedule request.');
      return;
    }
    if (!proposal.date || !proposal.time) {
      showToast?.('This reschedule request is missing a date or time.');
      return;
    }

    const nextProposal = { ...proposal, status: 'accepted', acceptedBy: 'owner', decidedAtMs: Date.now() };
    await updateBooking(linkedBooking.id, { date: proposal.date, time: proposal.time });
    if (db && activeThread?.id) {
      await FirebaseSDK.updateDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'clientThreads', activeThread.id), {
        rescheduleStatus: 'accepted',
        proposedReschedule: nextProposal,
        updatedAt: FirebaseSDK.serverTimestamp()
      }).catch(() => {});
    }
    await sendMessage(`Accepted reschedule: ${formatProposalLabel(proposal)}. Your booking has been updated.`, {
      kind: 'reschedule-accepted',
      proposedReschedule: nextProposal
    });
    showToast?.('Reschedule accepted and booking updated.');
  };

  const declineRescheduleProposal = async (proposal = {}) => {
    if (activeThread?.isExample) {
      showToast?.('Example preview only. Live reschedule requests can be declined from here.');
      return;
    }
    const nextProposal = { ...proposal, status: 'declined', declinedBy: 'owner', decidedAtMs: Date.now() };
    if (db && activeThread?.id) {
      await FirebaseSDK.updateDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'clientThreads', activeThread.id), {
        rescheduleStatus: 'declined',
        proposedReschedule: nextProposal,
        updatedAt: FirebaseSDK.serverTimestamp()
      }).catch(() => {});
    }
    await sendMessage(`Declined reschedule: ${formatProposalLabel(proposal)}. Send another option here if you want to keep looking.`, {
      kind: 'reschedule-declined',
      proposedReschedule: nextProposal
    });
    showToast?.('Reschedule request declined.');
  };

  const sendRunningLateUpdate = () => {
    if (activeThread?.isExample) {
      showToast?.('Example preview only. Live threads can send running-late updates.');
      return;
    }
    if (!activeThread?.id) {
      showToast?.('Open a client thread first.');
      return;
    }

    setActionDialog({
      type: 'late',
      title: 'Send running-late update',
      eyebrow: 'Quick Update',
      minutes: '10',
      message: ''
    });
  };

  const submitRunningLateUpdate = async () => {
    const cleanMinutes = String(actionDialog?.minutes || '').trim();
    if (!cleanMinutes) {
      showToast?.('Add the number of minutes before sending.');
      return;
    }

    const message = String(actionDialog?.message || '').trim()
      || `Running ${cleanMinutes} minutes late. Thanks for your patience - we will keep you posted here.`;

    await sendMessage(message);
    setActionDialog(null);
    showToast?.('Running-late update sent.');
  };

  const bookingStatus = String(linkedBooking?.status || activeThread?.bookingStatus || '').toLowerCase();
  const bookingActionMeta = (() => {
    if (activeThread?.isExample) return { label: 'Preview', disabled: false, className: 'native-gradient-button' };
    if (!linkedBooking) return { label: 'No Booking', disabled: true, className: 'bg-neutral-100 text-neutral-400 border border-neutral-200' };
    if (bookingStatus === 'confirmed') return { label: 'Confirmed', disabled: true, className: 'bg-emerald-50 text-emerald-700 border border-emerald-100' };
    if (bookingStatus === 'declined') return { label: 'Declined', disabled: true, className: 'bg-red-50 text-red-600 border border-red-100' };
    if (bookingStatus === 'waitlist') return { label: 'Confirm Waitlist', disabled: false, className: 'native-gradient-button' };
    return { label: 'Confirm', disabled: false, className: 'native-gradient-button' };
  })();
  const clientPresenceLabel = (() => {
    if (!activeThread) return 'No active chat';
    if (activeThread.isExample) return 'Live preview';
    if (activeThread.clientOnline) return 'Live now';
    const lastSeen = formatPresenceTime(activeThread.clientLastSeenAt || activeThread.clientLastSeenMs);
    if (lastSeen) return `Last seen ${lastSeen}`;
    return 'Live status unavailable';
  })();

  const matchesSupportFilter = (thread, filter = supportFilter) => {
    if (filter === 'unread') return Number(thread.ownerUnread || 0) > 0;
    if (filter === 'requests') return ['pending', 'requested'].includes(String(thread.bookingStatus || '').toLowerCase());
    if (filter === 'confirmed') return String(thread.bookingStatus || '').toLowerCase() === 'confirmed';
    if (filter === 'waitlist') return String(thread.bookingStatus || '').toLowerCase() === 'waitlist';
    if (filter === 'reschedules') return ['requested', 'countered'].includes(String(thread.rescheduleStatus || '').toLowerCase());
    return true;
  };
  const supportTabs = [
    { id: 'all', label: 'All', count: threadSource.length, icon: MessageCircle },
    { id: 'unread', label: 'Unread', count: threadSource.filter(thread => matchesSupportFilter(thread, 'unread')).length, icon: Bell },
    { id: 'requests', label: 'Requests', count: threadSource.filter(thread => matchesSupportFilter(thread, 'requests')).length, icon: Calendar },
    { id: 'confirmed', label: 'Confirmed', count: threadSource.filter(thread => matchesSupportFilter(thread, 'confirmed')).length, icon: Check },
    { id: 'waitlist', label: 'Waitlist', count: threadSource.filter(thread => matchesSupportFilter(thread, 'waitlist')).length, icon: Clock },
    { id: 'reschedules', label: 'Reschedules', count: threadSource.filter(thread => matchesSupportFilter(thread, 'reschedules')).length, icon: RefreshCw }
  ];
  const selectSupportFilter = (nextFilter) => {
    setSupportFilter(nextFilter);
    const nextThread = threadSource.find(thread => matchesSupportFilter(thread, nextFilter));
    setActiveThreadId(nextThread?.id || '');
  };
  const filteredThreads = useMemo(() => {
    const queryText = threadQuery.trim().toLowerCase();
    return threadSource.filter(thread => {
      if (!matchesSupportFilter(thread)) return false;
      if (!queryText) return true;
      return [
      thread.clientName,
      thread.clientEmail,
      thread.workspaceName,
      thread.lastMessage,
      thread.bookingStatus
      ].some(value => String(value || '').toLowerCase().includes(queryText));
    });
  }, [threadQuery, threadSource, supportFilter]);

  return (
    <>
    <section data-tour="client-inbox" className={`support-inbox-card support-inbox-pro support-desk-shell saas-card overflow-hidden bg-white native-gradient-ring ${chatFullscreen ? 'fixed inset-3 z-[80] flex flex-col rounded-[1.25rem] shadow-2xl' : ''}`}>
      <div className="h-1 native-gradient-line" />
      <div className={`${chatFullscreen ? 'hidden' : 'p-2 md:p-3'} support-mail-tabs border-b border-neutral-100`}>
        <div className="support-mail-tabs-track flex items-center gap-2 overflow-x-auto">
          {supportTabs.map((tab) => {
            const IconCmp = tab.icon;
            const active = supportFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => selectSupportFilter(tab.id)}
                className={`support-mail-tab ${active ? 'is-active' : ''} h-10 rounded-full border px-3 text-[9px] font-bold uppercase tracking-widest flex items-center gap-2 shrink-0`}
              >
                <IconCmp size={13} />
                {tab.label}
                <span className="support-mail-tab-count min-w-5 h-5 rounded-full flex items-center justify-center text-[9px]">{tab.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={`support-workspace-grid grid grid-cols-1 xl:grid-cols-12 ${chatFullscreen ? 'min-h-0 flex-1' : 'min-h-[520px] xl:min-h-[640px]'}`}>
        <aside className={`support-thread-list ${mobileChatOpen ? 'hidden xl:block' : ''} xl:col-span-4 border-b xl:border-b-0 xl:border-r border-neutral-100 bg-neutral-50/45`}>
          <div className="support-thread-search p-3 md:p-4 border-b border-neutral-100 bg-white/70">
            <div className="support-rail-head flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">Inbox</p>
                <h3 className="text-lg font-bold tracking-tight text-black">
                  {supportTabs.find(tab => tab.id === supportFilter)?.label || 'Client'} threads
                </h3>
              </div>
              <span className="support-rail-count rounded-full border border-neutral-100 bg-white px-3 py-1 text-[10px] font-bold text-black">{filteredThreads.length}</span>
            </div>
            <div className="relative">
              <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-300" />
              <input
                value={threadQuery}
                onChange={(event) => setThreadQuery(event.target.value)}
                placeholder="Search client, email, message"
                className="w-full h-11 md:h-12 rounded-lg bg-white border border-neutral-200 pl-11 pr-4 text-sm font-bold outline-none focus:border-black transition-colors"
              />
            </div>
          </div>
          <div className="max-h-[62vh] xl:max-h-[660px] overflow-y-auto">
            {filteredThreads.length ? filteredThreads.map(thread => {
              const active = activeThread?.id === thread.id;
              const threadAvatar = getThreadAvatar(thread);
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => {
                    setActiveThreadId(thread.id);
                    setMobileChatOpen(true);
                  }}
                  className={`support-thread-row w-full text-left p-3.5 md:p-5 border-b border-neutral-100 transition-colors relative overflow-hidden ${active ? 'is-active bg-white text-black shadow-sm' : 'bg-transparent hover:bg-white text-black'}`}
                >
                  {active && <span className="absolute inset-y-0 left-0 w-1 native-gradient-line" />}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold overflow-hidden ${threadAvatar ? 'bg-white border border-neutral-100 text-black' : active ? 'native-gradient-icon text-black' : 'bg-white border border-neutral-100 text-black'}`}>
                        {threadAvatar ? <img src={threadAvatar} alt="" className="w-full h-full object-cover" /> : (thread.clientName || 'C').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold truncate text-black">{thread.clientName || 'Client'}</p>
                        <p className="text-xs mt-1 truncate text-neutral-500">{thread.isExample ? 'Example only - live chats replace this' : thread.workspaceName || thread.clientEmail}</p>
                      </div>
                    </div>
                    {Number(thread.ownerUnread || 0) > 0 && <span className="min-w-6 h-6 rounded-full bg-[#39FF14] text-black text-[10px] font-bold flex items-center justify-center">{thread.ownerUnread}</span>}
                  </div>
                  <p className="text-sm mt-3 line-clamp-2 text-neutral-500">{thread.lastMessage || 'No messages yet.'}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <span className={`px-2 py-1 rounded-md border text-[8px] font-bold uppercase tracking-widest ${statusStyles[thread.bookingStatus] || statusStyles.pending}`}>
                      {thread.bookingStatus || 'pending'}
                    </span>
                    {thread.isExample && <span className="px-2 py-1 rounded-md text-[8px] font-bold uppercase tracking-widest bg-neutral-100 text-neutral-500">Example</span>}
                    {['requested', 'countered'].includes(thread.rescheduleStatus) && <span className="px-2 py-1 rounded-md bg-violet-50 text-violet-700 text-[8px] font-bold uppercase tracking-widest">Reschedule</span>}
                  </div>
                </button>
              );
            }) : (
              <div className="p-8 text-center">
                <div className="w-14 h-14 rounded-lg bg-white border border-neutral-100 flex items-center justify-center mx-auto mb-4 text-neutral-300"><Users size={22}/></div>
                <h3 className="font-bold text-black mb-2">{threadsReady ? (threads.length ? 'No matching threads' : 'No client threads yet') : 'Loading client threads'}</h3>
                <p className="text-sm text-neutral-500">{threadsReady ? (threads.length ? 'Try another name, email, or message keyword.' : 'New bookings with an email address will open a client support thread here automatically.') : 'Your live inbox is syncing.'}</p>
              </div>
            )}
          </div>
        </aside>

        <div className={`support-chat-panel ${mobileChatOpen ? 'fixed inset-0 z-[999] xl:static xl:z-auto' : 'hidden xl:flex'} xl:col-span-8 flex flex-col min-h-[100dvh] xl:min-h-[620px] bg-white`}>
          {activeThread ? (
            <>
              <div className="support-chat-header support-conversation-bar p-3 md:p-5 xl:p-6 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white">
                <div className="flex items-center gap-3 min-w-0">
                  <button type="button" onClick={() => setMobileChatOpen(false)} className="xl:hidden w-10 h-10 rounded-full bg-neutral-50 border border-neutral-100 flex items-center justify-center text-black shrink-0">
                    <ArrowLeft size={18} />
                  </button>
                  <div className={`w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center shrink-0 overflow-hidden font-bold ${getThreadAvatar(activeThread) ? 'bg-neutral-100 border border-neutral-100 text-black' : 'native-gradient-icon'}`}>
                    {getThreadAvatar(activeThread) ? <img src={getThreadAvatar(activeThread)} alt="" className="w-full h-full object-cover" /> : (activeThread.clientName || 'C').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base md:text-xl font-bold text-black truncate">{activeThread.clientName || 'Client'}</h3>
                    <p className="text-xs md:text-sm text-neutral-500 truncate">
                      {assignedStaff ? `Assigned to ${assignedStaff.name}` : activeThread.clientEmail || 'Active support thread'}
                    </p>
                    <p className="support-presence-label mt-1 hidden md:block text-[9px] font-bold uppercase tracking-widest text-neutral-400">
                      {clientPresenceLabel}
                    </p>
                  </div>
                </div>
                <div className="support-chat-actions flex items-center gap-2 shrink-0 w-full overflow-x-auto pb-1">
                  <button type="button" onClick={() => setChatFullscreen(value => !value)} className="hidden md:flex h-10 w-10 rounded-lg border border-neutral-200 bg-white items-center justify-center text-black hover:border-black transition-colors">
                    {chatFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                  </button>
                  <button onClick={() => setActiveTab?.('bookings')} className="h-10 px-3 rounded-lg border border-neutral-200 bg-white text-[9px] font-bold uppercase tracking-widest hover:border-black transition-colors flex items-center justify-center gap-2 shrink-0">
                    <Calendar size={13} /> Bookings
                  </button>
                  <button onClick={offerReschedule} className="h-10 px-3 rounded-lg border border-neutral-200 bg-white text-[9px] font-bold uppercase tracking-widest hover:border-black transition-colors flex items-center justify-center gap-2 shrink-0">
                    <RefreshCw size={13} /> Reschedule
                  </button>
                  <button onClick={sendRunningLateUpdate} className="h-10 px-3 rounded-lg border border-neutral-200 bg-white text-[9px] font-bold uppercase tracking-widest hover:border-black transition-colors flex items-center justify-center gap-2 shrink-0">
                    <Clock size={13} /> Late
                  </button>
                  <button onClick={confirmLinkedBooking} disabled={bookingActionMeta.disabled} className={`h-10 px-3 md:px-4 rounded-lg text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors disabled:cursor-not-allowed shrink-0 ${bookingActionMeta.className}`}>
                    <Check size={13} /> {bookingActionMeta.label}
                  </button>
                </div>
              </div>

              {(linkedBooking || assignedStaff) && (
                <div className="support-chat-meta px-3 md:px-5 py-2.5 bg-neutral-50 border-b border-neutral-100">
                  <div className="grid grid-cols-3 gap-2 text-[9px] font-bold uppercase tracking-widest text-neutral-400">
                    <div className="rounded-lg bg-white border border-neutral-100 px-3 py-2 min-w-0">
                      <p>Booking</p>
                      <p className="mt-1 text-xs normal-case tracking-normal font-bold text-black truncate">{linkedBooking ? `${linkedBooking.date || 'Date'} / ${linkedBooking.time || 'Time'}` : 'Not linked yet'}</p>
                    </div>
                    <div className="rounded-lg bg-white border border-neutral-100 px-3 py-2 min-w-0">
                      <p>Status</p>
                      <p className="mt-1 text-xs normal-case tracking-normal font-bold text-black truncate">{linkedBooking?.status || activeThread.bookingStatus || 'Open'}</p>
                    </div>
                    <div className="rounded-lg bg-white border border-neutral-100 px-3 py-2 min-w-0">
                      <p>Staff</p>
                      <p className="mt-1 text-xs normal-case tracking-normal font-bold text-black truncate">{assignedStaff?.name || activeStaff?.name || 'Team'}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="support-chat-canvas flex-1 overflow-y-auto p-3 md:p-6 bg-[#F7F7F5] space-y-3">
                {!activeThread?.isExample && hasOlderMessages && (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={loadPreviousMessages}
                      disabled={loadingOlderMessages}
                      className="support-load-previous rounded-full border border-neutral-200 bg-white px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-neutral-500 hover:bg-neutral-50 disabled:opacity-50 transition-colors"
                    >
                      {loadingOlderMessages ? 'Loading...' : 'Load previous messages'}
                    </button>
                  </div>
                )}
                {visibleMessages.map(message => {
                  const mine = message.senderRole === 'owner';
                  const proposal = getMessageProposal(message);
                  const pendingProposal = proposal && isPendingProposal(proposal) && ['reschedule-request', 'reschedule-offer', 'reschedule-counter'].includes(message.kind);
                  const ownerCanRespond = pendingProposal && proposal.requestedBy !== 'owner';
                  const messageTone = mine ? 'support-message-owner' : message.senderRole === 'system' ? 'support-message-system' : 'support-message-client';
                  return (
                    <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`support-message-bubble ${messageTone} max-w-[82%] rounded-2xl px-4 py-3 shadow-sm ${mine ? 'bg-[#111214] text-white rounded-br-md' : message.senderRole === 'system' ? 'bg-white border border-neutral-100 text-neutral-500' : 'bg-white text-black border border-neutral-100 rounded-bl-md'}`}>
                        <p className="text-[9px] font-bold uppercase tracking-widest opacity-45 mb-1">{message.senderRole === 'system' ? 'System' : message.senderName || message.senderRole}</p>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
                        {proposal && (
                          <div className={`mt-3 rounded-xl border p-3 ${mine ? 'bg-white/10 border-white/15 text-white' : 'bg-white border-neutral-200 text-black'}`}>
                            <p className="text-[8px] font-bold uppercase tracking-[0.16em] opacity-50 mb-2">
                              {proposal.status === 'accepted' ? 'Reschedule accepted' : proposal.status === 'declined' ? 'Reschedule declined' : proposal.source === 'counter' ? 'Counter offer' : 'Reschedule request'}
                            </p>
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              <div className={`rounded-lg px-3 py-2 ${mine ? 'bg-white/10' : 'bg-neutral-50'}`}>
                                <p className="text-[8px] font-bold uppercase tracking-widest opacity-45">Date</p>
                                <p className="text-xs font-bold mt-1">{proposal.date || 'To confirm'}</p>
                              </div>
                              <div className={`rounded-lg px-3 py-2 ${mine ? 'bg-white/10' : 'bg-neutral-50'}`}>
                                <p className="text-[8px] font-bold uppercase tracking-widest opacity-45">Time</p>
                                <p className="text-xs font-bold mt-1">{proposal.time || 'To confirm'}</p>
                              </div>
                            </div>
                            {ownerCanRespond ? (
                              <div className="grid grid-cols-3 gap-2">
                                <button type="button" onClick={() => acceptRescheduleProposal(proposal)} className="h-9 rounded-lg native-gradient-button text-black text-[8px] font-bold uppercase tracking-widest">
                                  Accept
                                </button>
                                <button type="button" onClick={() => offerReschedule(proposal)} className={`h-9 rounded-lg border text-[8px] font-bold uppercase tracking-widest ${mine ? 'border-white/20 bg-white/10 text-white' : 'border-neutral-200 bg-white text-black'}`}>
                                  Counter
                                </button>
                                <button type="button" onClick={() => declineRescheduleProposal(proposal)} className={`h-9 rounded-lg border text-[8px] font-bold uppercase tracking-widest ${mine ? 'border-white/20 bg-white/10 text-white' : 'border-neutral-200 bg-white text-black'}`}>
                                  Decline
                                </button>
                              </div>
                            ) : pendingProposal ? (
                              <p className="text-[10px] font-bold uppercase tracking-widest opacity-45">
                                {proposal.requestedBy === 'owner' ? 'Waiting for client response' : 'Waiting for your response'}
                              </p>
                            ) : (
                              <p className="text-[10px] font-bold uppercase tracking-widest opacity-45">{proposal.status || 'Closed'}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="support-chat-composer p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:p-5 border-t border-neutral-100 bg-white">
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Reply to client..."
                    rows={2}
                    className="flex-1 resize-none rounded-lg bg-white border border-neutral-200 px-4 py-3 text-sm font-medium outline-none focus:border-black transition-colors"
                  />
                  <button onClick={() => sendMessage()} disabled={!draft.trim() || sending} className="h-12 w-12 rounded-lg native-gradient-button flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed">
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
    {actionDialog && (
      <div className="fixed inset-0 z-[1200] bg-black/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="w-full sm:max-w-lg rounded-t-[1.5rem] sm:rounded-[1.25rem] bg-white border border-neutral-100 shadow-2xl p-5 sm:p-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-400 mb-2">{actionDialog.eyebrow}</p>
              <h3 className="text-2xl font-bold tracking-tight text-black">{actionDialog.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                {actionDialog.type === 'reschedule'
                  ? `Send ${activeThread?.clientName || 'this client'} a clear reschedule option inside this thread.`
                  : `Send ${activeThread?.clientName || 'this client'} a running-late update without leaving the inbox.`}
              </p>
            </div>
            <button type="button" onClick={() => setActionDialog(null)} className="w-10 h-10 rounded-full bg-neutral-50 border border-neutral-100 flex items-center justify-center text-neutral-500 hover:text-black transition-colors">
              <X size={16} />
            </button>
          </div>

          {actionDialog.type === 'reschedule' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <label className="block">
                <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-400 mb-2">Date</span>
                <input
                  value={actionDialog.date}
                  onChange={(event) => setActionDialog(prev => ({ ...prev, date: event.target.value }))}
                  placeholder="Friday, May 22"
                  className="w-full h-12 rounded-lg bg-neutral-50 border border-neutral-100 px-4 text-sm font-bold text-black outline-none focus:bg-white focus:border-black transition-colors"
                />
              </label>
              <label className="block">
                <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-400 mb-2">Time</span>
                <input
                  value={actionDialog.time}
                  onChange={(event) => setActionDialog(prev => ({ ...prev, time: event.target.value }))}
                  placeholder="14:30"
                  className="w-full h-12 rounded-lg bg-neutral-50 border border-neutral-100 px-4 text-sm font-bold text-black outline-none focus:bg-white focus:border-black transition-colors"
                />
              </label>
            </div>
          ) : (
            <label className="block mb-4">
              <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-400 mb-2">Minutes Late</span>
              <input
                type="number"
                min="1"
                value={actionDialog.minutes}
                onChange={(event) => setActionDialog(prev => ({ ...prev, minutes: event.target.value }))}
                placeholder="10"
                className="w-full h-12 rounded-lg bg-neutral-50 border border-neutral-100 px-4 text-sm font-bold text-black outline-none focus:bg-white focus:border-black transition-colors"
              />
            </label>
          )}

          <label className="block mb-5">
            <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-400 mb-2">Message Preview</span>
            <textarea
              rows={4}
              value={actionDialog.message}
              onChange={(event) => setActionDialog(prev => ({ ...prev, message: event.target.value }))}
              placeholder={actionDialog.type === 'reschedule'
                ? `Reschedule option: ${actionDialog.date || 'new date'} at ${actionDialog.time || 'new time'}. Reply here to confirm and we will update your booking.`
                : `Running ${actionDialog.minutes || '10'} minutes late. Thanks for your patience - we will keep you posted here.`}
              className="w-full resize-none rounded-lg bg-neutral-50 border border-neutral-100 px-4 py-3 text-sm leading-relaxed text-black outline-none focus:bg-white focus:border-black transition-colors"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setActionDialog(null)} className="h-12 rounded-full bg-white border border-neutral-200 text-black text-[10px] font-bold uppercase tracking-[0.12em] hover:border-black transition-colors">
              Cancel
            </button>
            <button
              type="button"
              onClick={actionDialog.type === 'reschedule' ? submitRescheduleOffer : submitRunningLateUpdate}
              disabled={sending}
              className="h-12 rounded-full native-gradient-button text-black text-[10px] font-bold uppercase tracking-[0.12em] disabled:opacity-50 disabled:cursor-wait"
            >
              {sending ? 'Sending' : 'Send Update'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
