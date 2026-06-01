import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bell, Calendar, Check, ChevronDown, Clock, Hourglass, Info, MessageCircle, Plus, RefreshCw, Search, SendHorizontal, Users, Wrench, X } from 'lucide-react';
import { buildJumpGuestChatScript } from '../data/guestWorkspace/jumpStudios';
import * as FirebaseSDK from '../services/firebase';
import { makeClientNotification, notificationEmailKey, NOTIFICATION_TYPES } from '../services/notifications';

const timestampValue = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const LIVE_MESSAGE_LIMIT = 20;

const buildGuestBookingScript = ({ clientName = 'Client', serviceName = 'session', note = '', status = 'pending', chatPreview = '', chatMessages = [] } = {}) => {
  if (Array.isArray(chatMessages) && chatMessages.length) {
    const messages = chatMessages
      .map(message => (typeof message === 'string' ? message : message?.text))
      .filter(Boolean);
    if (messages.length) {
      return {
        preview: chatPreview || messages[0],
        messages
      };
    }
  }
  const direct = buildJumpGuestChatScript({ clientName, serviceName, note, status });
  const cleanNote = String(note || '').replace(/\s+/g, ' ').trim();
  const topic = cleanNote || direct.preview;
  return {
    preview: direct.preview || topic,
    messages: direct.messages?.length ? direct.messages : [
      `Hi Jump Studios, I am checking in about my ${serviceName} booking.`,
      topic,
      `Absolutely. We have that noted for your ${serviceName}, and the coaching team will shape the session around it.`,
      status === 'waitlist'
        ? 'Thanks. Please keep me posted if a better slot opens.'
        : 'Perfect, thank you. This makes the plan feel clear.'
    ]
  };
};

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
  isGuestWorkspace = false,
  bookings,
  clientDirectory = [],
  staffList = [],
  services = [],
  updateBooking,
  onCreateManualBooking,
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
  const [actionDialog, setActionDialog] = useState(null);
  const [clientFileOpen, setClientFileOpen] = useState(false);
  const [supportToolsOpen, setSupportToolsOpen] = useState(false);
  const [quickBookingOpen, setQuickBookingOpen] = useState(false);
  const [quickBookingSaving, setQuickBookingSaving] = useState(false);

  const exampleThread = useMemo(() => ({
    id: 'example-support-thread',
    clientName: 'Mina Patel',
    clientEmail: 'mina.patel@jump-client.example',
    clientPhotoURL: '',
    workspaceName: 'Jump Studios',
    lastMessage: 'Can we keep the assessment focused on training around a product launch?',
    bookingId: 'example-support-booking',
    bookingStatus: 'pending',
    serviceName: 'Jump Start Assessment',
    ownerUnread: 1,
    clientUnread: 0,
    rescheduleStatus: 'requested',
    isExample: true
  }), []);

  const exampleBooking = useMemo(() => ({
    id: 'example-support-booking',
    clientName: 'Mina Patel',
    clientEmail: 'mina.patel@jump-client.example',
    clientPhotoURL: '',
    date: 'Thursday, May 28',
    time: '17:00',
    status: 'pending',
    serviceName: 'Jump Start Assessment',
    isExample: true
  }), []);

  const exampleMessages = useMemo(() => ([
    {
      id: 'example-system',
      senderRole: 'system',
      senderName: 'Booking update',
      text: 'Example Jump Start Assessment request received for Thursday, May 28 at 17:00.'
    },
    {
      id: 'example-client',
      senderRole: 'client',
      senderName: 'Mina Patel',
      text: 'Hey, can we keep the assessment focused on training around a product launch?'
    },
    {
      id: 'example-owner',
      senderRole: 'owner',
      senderName: 'Jump Studios',
      text: 'Absolutely. We can map your launch schedule, training windows, and recovery plan in the first session.'
    }
  ]), []);

  const guestDemoThreads = useMemo(() => {
    if (!isGuestWorkspace || !Array.isArray(bookings) || bookings.length === 0) return [];
    const seenClients = new Set();
    return bookings
      .filter((booking) => ['pending', 'confirmed', 'waitlist'].includes(String(booking.status || '').toLowerCase()))
      .filter((booking) => {
        const key = notificationEmailKey(booking.clientEmail || '') || String(booking.clientName || '').toLowerCase();
        if (!key || seenClients.has(key)) return false;
        seenClients.add(key);
        return true;
      })
      .slice(0, 50)
      .map((booking, index) => {
        const script = buildGuestBookingScript({
          clientName: booking.clientName,
          serviceName: booking.serviceName,
          note: booking.clientNote,
          status: booking.status,
          chatPreview: booking.chatPreview,
          chatMessages: booking.chatMessages
        });
        return {
          id: `guest-thread-${booking.id}`,
          clientName: booking.clientName,
          clientEmail: booking.clientEmail,
          clientPhotoURL: '',
          workspaceName: booking.workspaceName || 'Jump Studios',
          lastMessage: script.preview,
          chatMessages: script.messages,
          bookingId: booking.id,
          bookingStatus: booking.status,
          serviceName: booking.serviceName,
          ownerUnread: index % 4 === 0 ? 2 : index % 3 === 0 ? 1 : 0,
          clientUnread: 0,
          staffId: booking.staffId || '',
          rescheduleStatus: index % 5 === 0 ? 'requested' : '',
          clientOnline: index < 2,
          clientLastSeenMs: Date.now() - (index + 1) * 38 * 60 * 1000,
          lastMessageAt: booking.updatedAt || booking.timestamp,
          updatedAt: booking.updatedAt || booking.timestamp,
          isExample: true,
          isGuestDemo: true
        };
      });
  }, [bookings, isGuestWorkspace]);

  const shouldShowExampleThread = isGuestWorkspace && threadsReady && threads.length === 0 && bookings.length === 0;
  const threadSource = threads.length ? threads : (guestDemoThreads.length ? guestDemoThreads : (shouldShowExampleThread ? [exampleThread] : []));
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
    if (isGuestWorkspace) {
      setThreadsReady(true);
      return undefined;
    }
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
  }, [appId, db, isGuestWorkspace, workspaceOwnerId]);

  useEffect(() => {
    if (!isGuestWorkspace || !threadSource.length) return;
    setActiveThreadId(current => (current && threadSource.some(thread => thread.id === current)) ? current : threadSource[0].id);
  }, [isGuestWorkspace, threadSource]);

  const activeThread = useMemo(
    () => threadSource.find(thread => thread.id === activeThreadId) || threadSource[0] || null,
    [activeThreadId, threadSource]
  );
  const linkedBooking = useMemo(
    () => activeThread?.isExample
      ? bookings.find(booking => booking.id === activeThread?.bookingId) || exampleBooking
      : bookings.find(booking => booking.id === activeThread?.bookingId) || null,
    [activeThread?.bookingId, activeThread?.isExample, bookings, exampleBooking]
  );
  const guestDemoMessages = useMemo(() => {
    if (!activeThread?.isExample || activeThread.id === 'example-support-thread') return exampleMessages;
    const clientName = activeThread.clientName || 'Client';
    const serviceName = activeThread.serviceName || linkedBooking?.serviceName || 'appointment';
    const script = Array.isArray(activeThread.chatMessages) && activeThread.chatMessages.length
      ? activeThread.chatMessages
      : buildGuestBookingScript({
        clientName,
        serviceName,
        note: activeThread.lastMessage,
        status: activeThread.bookingStatus
      }).messages;
    return [
      {
        id: `${activeThread.id}-system`,
        senderRole: 'system',
        senderName: 'Booking update',
        text: `${serviceName} booking is linked to this support thread. Status: ${activeThread.bookingStatus || 'pending'}.`
      },
      ...script.map((text, index) => ({
        id: `${activeThread.id}-msg-${index}`,
        senderRole: index === 2 ? 'owner' : 'client',
        senderName: index === 2 ? 'Jump Studios' : clientName,
        text
      }))
    ];
  }, [activeThread, exampleMessages, linkedBooking?.serviceName]);
  const visibleMessages = activeThread?.isExample ? guestDemoMessages : [...olderMessages, ...messages];
  const activeStaff = useMemo(() => {
    const emailKey = notificationEmailKey(user?.email || '');
    return staffList.find(staff => notificationEmailKey(staff.email || '') === emailKey || staff.uid === user?.uid) || staffList[0] || null;
  }, [staffList, user?.email, user?.uid]);
  const assignedStaff = useMemo(() => (
    linkedBooking?.staffId ? staffList.find(staff => staff.id === linkedBooking.staffId) : null
  ), [linkedBooking?.staffId, staffList]);
  const assignedStaffColor = assignedStaff?.color || activeStaff?.color || '#39FF14';
  const activeClientProfile = activeThread ? getThreadClientProfile(activeThread) : null;
  const activeThreadPrefill = useMemo(() => ({
    clientName: activeClientProfile?.name || activeThread?.clientName || '',
    clientPhone: activeClientProfile?.phone || linkedBooking?.clientPhone || '',
    clientEmail: activeClientProfile?.email || activeThread?.clientEmail || linkedBooking?.clientEmail || '',
    clientBirthday: activeClientProfile?.birthday || linkedBooking?.clientBirthday || '',
    clientNote: activeClientProfile?.notes || linkedBooking?.clientNote || activeThread?.lastMessage || '',
    serviceName: activeThread?.serviceName || linkedBooking?.serviceName || '',
    staffId: assignedStaff?.id || linkedBooking?.staffId || activeStaff?.id || '',
    threadId: activeThread?.id || ''
  }), [activeClientProfile?.birthday, activeClientProfile?.email, activeClientProfile?.name, activeClientProfile?.notes, activeClientProfile?.phone, activeStaff?.id, activeThread?.clientEmail, activeThread?.clientName, activeThread?.id, activeThread?.lastMessage, activeThread?.serviceName, assignedStaff?.id, linkedBooking?.clientBirthday, linkedBooking?.clientEmail, linkedBooking?.clientNote, linkedBooking?.clientPhone, linkedBooking?.serviceName, linkedBooking?.staffId]);
  const submitQuickBooking = async (event) => {
    event.preventDefault();
    if (!onCreateManualBooking || quickBookingSaving) return;
    const formData = new FormData(event.currentTarget);
    setQuickBookingSaving(true);
    try {
      const ok = await onCreateManualBooking({
        threadId: activeThread?.id || '',
        clientName: formData.get('clientName'),
        clientPhone: formData.get('clientPhone'),
        clientEmail: formData.get('clientEmail'),
        clientBirthday: formData.get('clientBirthday'),
        clientNote: formData.get('clientNote'),
        serviceId: formData.get('serviceId'),
        serviceName: formData.get('serviceName'),
        bookingDate: formData.get('bookingDate'),
        bookingTime: formData.get('bookingTime'),
        bookingStatus: formData.get('bookingStatus'),
        staffId: formData.get('staffId')
      });
      if (ok) setQuickBookingOpen(false);
    } finally {
      setQuickBookingSaving(false);
    }
  };
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
    if (!quickBookingOpen || typeof window === 'undefined') return undefined;
    const frame = window.requestAnimationFrame(() => {
      document.querySelector('.support-quick-booking-sheet')?.scrollTo({ top: 0 });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [quickBookingOpen]);

  useEffect(() => {
    setClientFileOpen(false);
    setSupportToolsOpen(false);
  }, [activeThread?.id]);

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
    if (activeThread.isExample) return 'Last seen just now';
    if (activeThread.clientOnline) return 'Live now';
    const lastSeen = formatPresenceTime(activeThread.clientLastSeenAt || activeThread.clientLastSeenMs);
    if (lastSeen) return `Last seen ${lastSeen}`;
    return 'Last seen unavailable';
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
    <section data-tour="client-inbox" className="support-inbox-card support-inbox-pro support-desk-shell saas-card overflow-hidden bg-white">
      <div className="h-1 native-gradient-line" />
      <div className="support-workspace-grid grid grid-cols-1 xl:grid-cols-12 min-h-[520px] xl:min-h-[640px]">
        <aside className={`support-thread-list ${mobileChatOpen ? 'hidden xl:block' : ''} xl:col-span-4 border-b xl:border-b-0 xl:border-r border-neutral-100 bg-neutral-50/45`}>
          <div className="support-thread-search p-3 md:p-4 border-b border-neutral-100 bg-white/70">
            <div className="support-rail-head flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">Inbox</p>
                <h3 className="text-lg font-bold tracking-tight text-black">
                  {supportTabs.find(tab => tab.id === supportFilter)?.label || 'Client'} threads
                </h3>
              </div>
            </div>
            <div className="relative">
              <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-300" />
              <input
                value={threadQuery}
                onChange={(event) => setThreadQuery(event.target.value)}
                placeholder="Search client, email, message"
                aria-label="Search support threads"
                className="w-full h-11 md:h-12 rounded-lg bg-white border border-neutral-200 pl-11 pr-4 text-sm font-bold outline-none focus:border-black transition-colors"
              />
            </div>
            <div className="support-mail-tabs mt-3">
              <div className="support-mail-tabs-track flex items-center gap-1.5 overflow-x-auto">
                {supportTabs.map((tab) => {
                  const IconCmp = tab.icon;
                  const active = supportFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => selectSupportFilter(tab.id)}
                      title={`${tab.label} (${tab.count})`}
                      aria-label={`${tab.label} threads (${tab.count})`}
                      className={`support-mail-tab ${active ? 'is-active' : ''} h-9 rounded-xl border px-2.5 text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 shrink-0`}
                    >
                      <IconCmp size={13} />
                      <span className="sr-only">{tab.label}</span>
                      <span className="support-mail-tab-count min-w-5 h-5 rounded-full flex items-center justify-center text-[9px]">{tab.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="max-h-[62vh] xl:max-h-[660px] overflow-y-auto">
            {filteredThreads.length ? filteredThreads.map(thread => {
              const active = activeThread?.id === thread.id;
              const threadAvatar = getThreadAvatar(thread);
              const bookingStatus = String(thread.bookingStatus || 'pending').toLowerCase();
              const StatusIcon = bookingStatus === 'confirmed'
                ? Check
                : bookingStatus === 'waitlist'
                  ? Hourglass
                  : bookingStatus === 'declined'
                    ? X
                    : Clock;
              const statusLabel = bookingStatus === 'waitlist' ? 'Waitlist' : bookingStatus.charAt(0).toUpperCase() + bookingStatus.slice(1);
              const hasReschedule = ['requested', 'countered'].includes(String(thread.rescheduleStatus || '').toLowerCase());
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
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold overflow-hidden ${threadAvatar ? 'bg-white border border-neutral-100 text-black' : 'booking-avatar-placeholder'}`}>
                        {threadAvatar ? <img src={threadAvatar} alt="" className="w-full h-full object-cover" /> : (thread.clientName || 'C').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold truncate text-black">{thread.clientName || 'Client'}</p>
                        <p className="text-xs mt-1 truncate text-neutral-500">{thread.serviceName || thread.clientEmail || thread.workspaceName || 'Client thread'}</p>
                      </div>
                    </div>
                    <div className="support-thread-meta-icons flex items-center gap-1.5 shrink-0">
                      <span className={`support-thread-icon-chip ${bookingStatus}`} title={statusLabel} aria-label={statusLabel}>
                        <StatusIcon size={13} />
                      </span>
                      {hasReschedule && (
                        <span className="support-thread-icon-chip reschedule" title="Reschedule requested" aria-label="Reschedule requested">
                          <RefreshCw size={13} />
                        </span>
                      )}
                      {Number(thread.ownerUnread || 0) > 0 && <span className="support-thread-unread-count min-w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center">{thread.ownerUnread}</span>}
                    </div>
                  </div>
                  <div className="support-thread-preview-divider" aria-hidden="true" />
                  <p className="text-sm mt-3 line-clamp-2 text-neutral-500">{thread.lastMessage || 'No messages yet.'}</p>
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
              <div className="support-chat-header support-conversation-bar p-3 md:p-5 border-b border-neutral-100 flex flex-col 2xl:flex-row 2xl:items-center 2xl:justify-between gap-3 bg-white">
                <div className="flex items-center gap-3 min-w-0">
                  <button type="button" aria-label="Back to support inbox" onClick={() => setMobileChatOpen(false)} className="xl:hidden w-10 h-10 rounded-full bg-neutral-50 border border-neutral-100 flex items-center justify-center text-black shrink-0">
                    <ArrowLeft size={18} />
                  </button>
                  <div className={`w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center shrink-0 overflow-hidden font-bold ${getThreadAvatar(activeThread) ? 'bg-neutral-100 border border-neutral-100 text-black' : 'booking-avatar-placeholder'}`}>
                    {getThreadAvatar(activeThread) ? <img src={getThreadAvatar(activeThread)} alt="" className="w-full h-full object-cover" /> : (activeThread.clientName || 'C').charAt(0).toUpperCase()}
                  </div>
                  <div className="support-chat-identity min-w-0">
                    <h3 className="support-chat-name-line text-base md:text-xl font-bold text-black">
                      <span className="truncate">{activeThread.clientName || 'Client'}</span>
                      {assignedStaff && (
                        <span
                          className="support-chat-staff-dot"
                          style={{ backgroundColor: assignedStaffColor }}
                          title={`Assigned to ${assignedStaff.name}`}
                          aria-label={`Assigned to ${assignedStaff.name}`}
                        />
                      )}
                    </h3>
                    <p className="support-presence-label text-xs md:text-sm text-neutral-500 truncate">
                      {clientPresenceLabel}
                    </p>
                  </div>
                </div>
                <div className="support-chat-actions support-chat-command-bar flex items-center gap-1.5 shrink-0 w-full 2xl:w-auto overflow-x-auto">
                  <div className="support-chat-inline-actions hidden md:flex items-center gap-1.5">
                    <button type="button" aria-label="Open client file" title="Client file" onClick={() => setClientFileOpen(true)} className="support-chat-action">
                      <Info size={15} />
                    </button>
                    <button onClick={() => setQuickBookingOpen(true)} className="support-chat-action-primary" aria-label="Add booking from chat" title="Add booking">
                      <Plus size={15} />
                    </button>
                    <button onClick={() => setActiveTab?.('bookings')} className="support-chat-action" aria-label="Open bookings" title="Bookings">
                      <Calendar size={15} />
                    </button>
                    <button onClick={offerReschedule} className="support-chat-action" aria-label="Offer reschedule" title="Reschedule">
                      <RefreshCw size={15} />
                    </button>
                    <button onClick={sendRunningLateUpdate} className="support-chat-action" aria-label="Send running late update" title="Running late">
                      <Clock size={15} />
                    </button>
                    <button onClick={confirmLinkedBooking} disabled={bookingActionMeta.disabled} className={`support-chat-action support-chat-action-confirm disabled:cursor-not-allowed ${bookingActionMeta.className}`} aria-label={bookingActionMeta.label} title={bookingActionMeta.label}>
                      <Check size={15} />
                    </button>
                  </div>
                  <button
                    type="button"
                    aria-label={supportToolsOpen ? 'Close chat tools' : 'Open chat tools'}
                    title={supportToolsOpen ? 'Close tools' : 'Chat tools'}
                    onClick={() => setSupportToolsOpen(value => !value)}
                    className={`support-chat-tools-toggle md:hidden ${supportToolsOpen ? 'is-open' : ''}`}
                  >
                    <Wrench size={15} />
                  </button>
                  {supportToolsOpen && (
                    <div className="support-chat-tools-popover md:hidden">
                      <button type="button" aria-label="Open client file" title="Client file" onClick={() => { setClientFileOpen(true); setSupportToolsOpen(false); }} className="support-chat-action">
                        <Info size={15} />
                      </button>
                      <button onClick={() => { setQuickBookingOpen(true); setSupportToolsOpen(false); }} className="support-chat-action-primary" aria-label="Add booking from chat" title="Add booking">
                        <Plus size={15} />
                      </button>
                      <button onClick={() => { setActiveTab?.('bookings'); setSupportToolsOpen(false); }} className="support-chat-action" aria-label="Open bookings" title="Bookings">
                        <Calendar size={15} />
                      </button>
                      <button onClick={() => { offerReschedule(); setSupportToolsOpen(false); }} className="support-chat-action" aria-label="Offer reschedule" title="Reschedule">
                        <RefreshCw size={15} />
                      </button>
                      <button onClick={() => { sendRunningLateUpdate(); setSupportToolsOpen(false); }} className="support-chat-action" aria-label="Send running late update" title="Running late">
                        <Clock size={15} />
                      </button>
                      <button onClick={() => { confirmLinkedBooking(); setSupportToolsOpen(false); }} disabled={bookingActionMeta.disabled} className={`support-chat-action support-chat-action-confirm disabled:cursor-not-allowed ${bookingActionMeta.className}`} aria-label={bookingActionMeta.label} title={bookingActionMeta.label}>
                        <Check size={15} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="support-chat-canvas flex-1 overflow-y-auto p-3 md:p-6 bg-white space-y-3">
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
                <div className="support-chat-composer-row flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Reply to client..."
                    aria-label="Reply to client"
                    rows={2}
                    className="support-chat-reply-field flex-1 resize-none rounded-lg bg-white border border-neutral-200 px-4 py-3 text-sm font-medium outline-none focus:border-black transition-colors"
                  />
                  <button type="button" aria-label="Send reply" onClick={() => sendMessage()} disabled={!draft.trim() || sending} className="support-chat-send-button h-12 w-12 rounded-lg flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed">
                    <SendHorizontal size={18} strokeWidth={2.5} />
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
    {clientFileOpen && activeThread && (
      <div className="support-client-file-overlay fixed inset-0 z-[5000] bg-black/35 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="support-client-file-sheet w-full sm:max-w-md rounded-t-[1.35rem] sm:rounded-[1.1rem] bg-white border border-neutral-100 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-start justify-between gap-4 p-5 pb-4 border-b border-neutral-100">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 overflow-hidden font-bold ${getThreadAvatar(activeThread) ? 'bg-neutral-100 border border-neutral-100 text-black' : 'booking-avatar-placeholder'}`}>
                {getThreadAvatar(activeThread) ? <img src={getThreadAvatar(activeThread)} alt="" className="w-full h-full object-cover" /> : (activeThread.clientName || 'C').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-400 mb-1">Client File</p>
                <h3 className="text-xl font-bold tracking-tight text-black truncate">{activeThread.clientName || 'Client'}</h3>
                <p className="text-xs text-neutral-500 truncate">{activeThreadPrefill.clientEmail || activeThreadPrefill.clientPhone || 'Support thread'}</p>
              </div>
            </div>
            <button type="button" onClick={() => setClientFileOpen(false)} className="w-9 h-9 rounded-full bg-neutral-50 border border-neutral-100 flex items-center justify-center text-neutral-500 hover:text-black transition-colors" aria-label="Close client file">
              <X size={15} />
            </button>
          </div>

          <div className="support-client-file-body p-5 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="support-client-file-tile">
                <p>Booking</p>
                <strong>{linkedBooking ? `${linkedBooking.date || 'Date'} / ${linkedBooking.time || 'Time'}` : activeThreadPrefill.serviceName || 'Not linked yet'}</strong>
              </div>
              <div className="support-client-file-tile">
                <p>Status</p>
                <strong>{linkedBooking?.status || activeThread.bookingStatus || 'Open'}</strong>
              </div>
              <div className="support-client-file-tile">
                <p>Staff</p>
                <strong>{assignedStaff?.name || activeStaff?.name || 'Team'}</strong>
              </div>
              <div className="support-client-file-tile">
                <p>Service</p>
                <strong>{activeThreadPrefill.serviceName || linkedBooking?.serviceName || 'Not set'}</strong>
              </div>
            </div>

            <div className="support-client-file-list">
              <div>
                <span>Phone</span>
                <strong>{activeThreadPrefill.clientPhone || 'Not saved'}</strong>
              </div>
              <div>
                <span>Email</span>
                <strong>{activeThreadPrefill.clientEmail || 'Not saved'}</strong>
              </div>
              <div>
                <span>Notes</span>
                <strong>{activeThreadPrefill.clientNote || activeThread.lastMessage || 'No notes yet'}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
    {quickBookingOpen && (
      <div className="support-quick-booking-overlay fixed inset-0 z-[5000] bg-black/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
        <form onSubmit={submitQuickBooking} className="support-quick-booking-sheet w-full sm:max-w-3xl rounded-t-[1.5rem] sm:rounded-[1.25rem] bg-white border border-neutral-100 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          <div className="support-quick-head flex items-start justify-between gap-4 p-5 sm:p-6 pb-2">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-400 mb-2">From Chat</p>
              <h3 className="text-2xl font-bold tracking-tight text-black">Add Booking</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-500">Client details are prefilled from this thread and can be changed before saving.</p>
            </div>
            <button type="button" onClick={() => setQuickBookingOpen(false)} className="w-10 h-10 rounded-full bg-neutral-50 border border-neutral-100 flex items-center justify-center text-neutral-500 hover:text-black transition-colors" aria-label="Close booking form">
              <X size={16} />
            </button>
          </div>
          <div className="support-quick-booking-grid grid grid-cols-1 sm:grid-cols-2 gap-2.5 px-5 sm:px-6 pb-4">
            <label className="support-quick-field sm:col-span-2">
              <span>Name</span>
              <input name="clientName" required defaultValue={activeThreadPrefill.clientName} placeholder="Client name" />
            </label>
            <label className="support-quick-field">
              <span>Phone</span>
              <input name="clientPhone" type="tel" defaultValue={activeThreadPrefill.clientPhone} placeholder="+27 82 000 0000" />
            </label>
            <label className="support-quick-field">
              <span>Email</span>
              <input name="clientEmail" type="email" defaultValue={activeThreadPrefill.clientEmail} placeholder="client@email.com" />
            </label>
            <label className="support-quick-field">
              <span>Date</span>
              <span className="support-quick-control">
                <input name="bookingDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
                <Calendar size={15} aria-hidden="true" />
              </span>
            </label>
            <label className="support-quick-field">
              <span>Time</span>
              <span className="support-quick-control">
                <input name="bookingTime" type="time" required defaultValue="09:00" />
                <Clock size={15} aria-hidden="true" />
              </span>
            </label>
            <label className="support-quick-field">
              <span>Status</span>
              <span className="support-quick-control">
                <select name="bookingStatus" defaultValue="confirmed">
                  <option value="confirmed">Confirmed</option>
                  <option value="pending">Needs review</option>
                  <option value="waitlist">Waitlist</option>
                </select>
                <ChevronDown size={15} aria-hidden="true" />
              </span>
            </label>
            <label className="support-quick-field">
              <span>Staff</span>
              <span className="support-quick-control">
                <select name="staffId" defaultValue={activeThreadPrefill.staffId}>
                  <option value="">Unassigned</option>
                  {staffList.map(staff => <option key={staff.id} value={staff.id}>{staff.name}</option>)}
                </select>
                <ChevronDown size={15} aria-hidden="true" />
              </span>
            </label>
            <label className="support-quick-field">
              <span>Service</span>
              <span className="support-quick-control">
                <select name="serviceId" defaultValue="">
                  <option value="">Use custom service below</option>
                  {services.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}
                </select>
                <ChevronDown size={15} aria-hidden="true" />
              </span>
            </label>
            <label className="support-quick-field">
              <span>Custom service</span>
              <input name="serviceName" defaultValue={activeThreadPrefill.serviceName} placeholder="Service name" />
            </label>
            <label className="support-quick-field sm:col-span-2">
              <span>Internal note</span>
              <textarea name="clientNote" rows={3} defaultValue={activeThreadPrefill.clientNote} placeholder="Context from this conversation..." />
            </label>
            <input type="hidden" name="clientBirthday" defaultValue={activeThreadPrefill.clientBirthday} />
          </div>
          <div className="support-quick-actions grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setQuickBookingOpen(false)} className="h-12 rounded-full bg-white border border-neutral-200 text-black text-[10px] font-bold uppercase tracking-[0.12em] hover:border-black transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={quickBookingSaving} className="h-12 rounded-full bg-black text-white text-[10px] font-bold uppercase tracking-[0.12em] disabled:opacity-50 disabled:cursor-wait">
              {quickBookingSaving ? 'Saving' : 'Save Booking'}
            </button>
          </div>
        </form>
      </div>
    )}
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

