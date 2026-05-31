import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
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
  UserRound,
  X
} from 'lucide-react';
import { BuildABookingBrand } from './BuildABookingBrand';
import { NotificationCenter } from './NotificationCenter';
import * as FirebaseSDK from '../services/firebase';
import {
  getBrowserNotificationPermission,
  makeOwnerNotification,
  notificationEmailKey,
  requestBrowserNotificationPermission,
  showBrowserNotification,
  NOTIFICATION_TYPES
} from '../services/notifications';
import { formatServiceDuration, formatServicePrice } from '../utils/services';

const normalizeEmail = (email = '') => String(email || '').trim().toLowerCase();
const cleanFirestoreIdPart = (value = '') => (
  String(value || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80) || 'item'
);
const buildSupportThreadId = (ownerId = '', bookingId = '') => (
  `${cleanFirestoreIdPart(ownerId)}_${cleanFirestoreIdPart(bookingId)}`
);

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

const navItems = [
  { id: 'chats', label: 'Chats', icon: MessageCircle },
  { id: 'bookings', label: 'Bookings', icon: BookOpen },
  { id: 'profile', label: 'Profile', icon: UserRound }
];

export function ClientPortal({ appId, db, user, isGuestPreview = false, onSignOut, onOwnerLogin, onInstallApp }) {
  const emailKey = normalizeEmail(user?.email);
  const [activeView, setActiveView] = useState('chats');
  const [bookings, setBookings] = useState([]);
  const [threads, setThreads] = useState([]);
  const [fallbackThreads, setFallbackThreads] = useState([]);
  const [messages, setMessages] = useState([]);
  const [olderMessages, setOlderMessages] = useState([]);
  const [oldestMessageCursor, setOldestMessageCursor] = useState(null);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState('');
  const [messageDraft, setMessageDraft] = useState('');
  const [threadSearch, setThreadSearch] = useState('');
  const [rescheduleDraft, setRescheduleDraft] = useState({ bookingId: '', date: '', time: '' });
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [runningLateDialog, setRunningLateDialog] = useState(null);
  const [counterDialog, setCounterDialog] = useState(null);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bookingsReady, setBookingsReady] = useState(false);
  const [threadsReady, setThreadsReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [browserPermission, setBrowserPermission] = useState(getBrowserNotificationPermission);
  const notificationSeenRef = useRef(new Set());
  const notificationsReadyRef = useRef(false);
  const exampleBooking = useMemo(() => ({
    id: 'example-client-booking',
    threadId: 'example-client-thread',
    workspaceName: 'Jump Studios',
    date: 'Thursday, May 28',
    time: '14:30',
    status: 'pending',
    serviceName: 'Jump Start Assessment',
    serviceDuration: '45',
    servicePrice: '35',
    servicePriceType: 'fixed',
    isExample: true
  }), []);

  const exampleThread = useMemo(() => ({
    id: 'example-client-thread',
    workspaceName: 'Jump Studios',
    clientName: user?.displayName || 'Mina Patel',
    clientEmail: emailKey || 'mina.patel@jump-client.example',
    bookingId: 'example-client-booking',
    bookingStatus: 'pending',
    lastMessage: 'We received your request. You can chat here or request a new coaching time.',
    clientUnread: 1,
    rescheduleStatus: 'open',
    isExample: true
  }), [emailKey, user?.displayName]);

  const exampleMessages = useMemo(() => ([
    {
      id: 'example-client-system',
      senderRole: 'system',
      senderName: 'Booking update',
      text: 'Example Jump Start Assessment request sent for Thursday, May 28 at 14:30.'
    },
    {
      id: 'example-client-owner',
      senderRole: 'owner',
      senderName: 'Jump Studios',
      text: 'Thanks for booking. We will approve the request shortly. If you need a different coaching time, send it here.'
    },
    {
      id: 'example-client-reply',
      senderRole: 'client',
      senderName: user?.displayName || 'You',
      text: 'Perfect, please keep me posted.'
    }
  ]), [user?.displayName]);

  const showExamplePortal = Boolean(isGuestPreview);
  const bookingSource = bookings.length ? bookings : (showExamplePortal ? [exampleBooking] : []);
  const mergedThreads = useMemo(() => {
    const byId = new Map();
    [...fallbackThreads, ...threads].forEach(thread => {
      if (thread?.id) byId.set(thread.id, { ...(byId.get(thread.id) || {}), ...thread });
    });
    return Array.from(byId.values()).sort((a, b) => timestampValue(b.updatedAt || b.lastMessageAt) - timestampValue(a.updatedAt || a.lastMessageAt));
  }, [fallbackThreads, threads]);
  const threadSource = mergedThreads.length ? mergedThreads : (showExamplePortal ? [exampleThread] : []);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    document.documentElement.classList.toggle('client-chat-open', mobileChatOpen);
    return () => document.documentElement.classList.remove('client-chat-open');
  }, [mobileChatOpen]);

  useEffect(() => {
    if (!db || !emailKey) {
      setLoading(false);
      setBookingsReady(true);
      setThreadsReady(true);
      return undefined;
    }

    setLoading(true);
    setBookingsReady(false);
    setThreadsReady(false);
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
      setBookingsReady(true);
      setLoading(false);
    }, (error) => {
      console.error('Client bookings sync failed', error);
      setBookingsReady(true);
      setLoading(false);
    });

    const unsubThreads = FirebaseSDK.onSnapshot(threadsQuery, (snap) => {
      const next = snap.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((a, b) => timestampValue(b.updatedAt || b.lastMessageAt) - timestampValue(a.updatedAt || a.lastMessageAt));
      setThreads(next);
      setActiveThreadId(current => (current && next.some(thread => thread.id === current)) ? current : (next[0]?.id || ''));
      setThreadsReady(true);
    }, (error) => {
      console.error('Client threads sync failed', error);
      setThreadsReady(true);
    });

    return () => {
      unsubBookings();
      unsubThreads();
    };
  }, [appId, db, emailKey]);

  useEffect(() => {
    if (!db || !bookingsReady || !bookings.length) {
      setFallbackThreads([]);
      return undefined;
    }
    let cancelled = false;
    const knownThreadIds = new Set(threads.map(thread => thread.id));
    const candidates = bookings
      .map(booking => {
        const bookingId = booking.bookingId || booking.id;
        return booking.threadId || (booking.ownerId && bookingId ? buildSupportThreadId(booking.ownerId, bookingId) : '');
      })
      .filter(threadId => threadId && !knownThreadIds.has(threadId));

    if (!candidates.length) {
      setFallbackThreads([]);
      return undefined;
    }

    Promise.all(candidates.slice(0, 20).map(async (threadId) => {
      const snap = await FirebaseSDK.getDoc(FirebaseSDK.doc(db, 'artifacts', appId, 'clientThreads', threadId)).catch(() => null);
      return snap?.exists?.() ? { id: snap.id, ...snap.data() } : null;
    })).then((found) => {
      if (cancelled) return;
      setFallbackThreads(found.filter(Boolean));
    });

    return () => { cancelled = true; };
  }, [appId, bookings, bookingsReady, db, threads]);

  useEffect(() => {
    const syncPermission = () => setBrowserPermission(getBrowserNotificationPermission());
    syncPermission();
    window.addEventListener('focus', syncPermission);
    document.addEventListener('visibilitychange', syncPermission);
    return () => {
      window.removeEventListener('focus', syncPermission);
      document.removeEventListener('visibilitychange', syncPermission);
    };
  }, []);

  useEffect(() => {
    if (!db || !emailKey) {
      setNotifications([]);
      notificationSeenRef.current = new Set();
      notificationsReadyRef.current = false;
      return undefined;
    }
    const notificationsQuery = FirebaseSDK.query(
      FirebaseSDK.collection(db, 'artifacts', appId, 'clientAccess', emailKey, 'notifications'),
      FirebaseSDK.orderBy('createdAtMs', 'desc'),
      FirebaseSDK.limit(60)
    );
    const unsubNotifications = FirebaseSDK.onSnapshot(notificationsQuery, (snap) => {
      const next = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      setNotifications(next);
      const fresh = next.filter(notification => !notificationSeenRef.current.has(notification.id));
      fresh.forEach(notification => notificationSeenRef.current.add(notification.id));
      if (notificationsReadyRef.current) {
        fresh
          .filter(notification => !notification.read)
          .reverse()
          .forEach(notification => {
            if (document.visibilityState !== 'visible' || notification.priority === 'high') {
              showBrowserNotification({
                title: notification.title,
                body: notification.body,
                tag: `client-${notification.id}`,
                url: '/client'
              });
            }
          });
      }
      notificationsReadyRef.current = true;
    }, (error) => console.error('Client notifications sync failed', error));
    return () => unsubNotifications();
  }, [appId, db, emailKey]);

  const activeThread = useMemo(
    () => threadSource.find(thread => thread.id === activeThreadId) || threadSource[0] || null,
    [activeThreadId, threadSource]
  );

  const activeBooking = useMemo(
    () => bookingSource.find(booking => booking.id === activeThread?.bookingId) || bookingSource[0] || null,
    [activeThread?.bookingId, bookingSource]
  );
  const visibleMessages = activeThread?.isExample ? exampleMessages : [...olderMessages, ...messages];
  const chatBrandLogo = activeThread?.workspaceLogo || activeBooking?.workspaceLogo || '';
  const chatStaffName = activeThread?.staffName || activeBooking?.staffName || '';
  const chatStaffPhoto = activeThread?.staffPhotoURL || activeBooking?.staffPhotoURL || '';
  const buildRescheduleProposal = ({ date, time, requestedBy = 'client', source = 'request', message = '', bookingId = '' }) => ({
    id: `reschedule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    bookingId: bookingId || activeThread?.bookingId || activeBooking?.id || '',
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

  const openThread = (threadId) => {
    if (threadId) setActiveThreadId(threadId);
    setMobileChatOpen(true);
    setActiveView('chats');
  };

  const filteredThreads = useMemo(() => {
    const cleanSearch = threadSearch.trim().toLowerCase();
    if (!cleanSearch) return threadSource;
    return threadSource.filter(thread => [
      thread.workspaceName,
      thread.clientName,
      thread.lastMessage,
      thread.bookingStatus
    ].some(value => String(value || '').toLowerCase().includes(cleanSearch)));
  }, [threadSearch, threadSource]);

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
    const unsubMessages = FirebaseSDK.onSnapshot(messagesQuery, (snap) => {
      const docs = snap.docs;
      setMessages(docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })).reverse());
      setOldestMessageCursor(docs[docs.length - 1] || null);
      setHasOlderMessages(docs.length === LIVE_MESSAGE_LIMIT);
      if (Number(activeThread.clientUnread || 0) > 0) {
        FirebaseSDK.updateDoc(
          FirebaseSDK.doc(db, 'artifacts', appId, 'clientThreads', activeThread.id),
          { clientUnread: 0, clientLastSeenAt: FirebaseSDK.serverTimestamp() }
        ).catch(() => {});
      }
    }, (error) => console.error('Client messages sync failed', error));
    return () => unsubMessages();
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
      console.error('Loading previous client messages failed', error);
    } finally {
      setLoadingOlderMessages(false);
    }
  };

  const sendThreadMessage = async ({ text, kind = 'message', bookingId = '', proposedReschedule = null, rescheduleStatus = '' }) => {
    const cleanText = String(text || '').trim();
    if (!cleanText || !db || !activeThread?.id || sending) return;
    if (activeThread.isExample) {
      setMessageDraft('');
      setActiveView('chats');
      return;
    }
    setSending(true);
    try {
      const threadRef = FirebaseSDK.doc(db, 'artifacts', appId, 'clientThreads', activeThread.id);
      await FirebaseSDK.addDoc(FirebaseSDK.collection(db, 'artifacts', appId, 'clientThreads', activeThread.id, 'messages'), {
        text: cleanText,
        kind,
        bookingId,
        ...(proposedReschedule ? { proposedReschedule } : {}),
        senderId: user.uid,
        senderName: user.displayName || user.email || 'Client',
        senderRole: 'client',
        createdAt: FirebaseSDK.serverTimestamp()
      });
      const threadUpdates = {
        lastMessage: cleanText,
        lastMessageAt: FirebaseSDK.serverTimestamp(),
        updatedAt: FirebaseSDK.serverTimestamp(),
        ownerUnread: FirebaseSDK.increment(1),
        clientUnread: 0
      };
      if (proposedReschedule) threadUpdates.proposedReschedule = proposedReschedule;
      if (rescheduleStatus || kind === 'reschedule-request') threadUpdates.rescheduleStatus = rescheduleStatus || 'requested';
      await FirebaseSDK.updateDoc(threadRef, threadUpdates);
      if (activeThread.ownerId) {
        const isRescheduleMessage = String(kind || '').startsWith('reschedule');
        await FirebaseSDK.addDoc(
          FirebaseSDK.collection(db, 'artifacts', appId, 'users', activeThread.ownerId, 'notifications'),
          {
            ...makeOwnerNotification({
              type: isRescheduleMessage ? NOTIFICATION_TYPES.RESCHEDULE_REQUEST : NOTIFICATION_TYPES.NEW_MESSAGE,
              title: isRescheduleMessage
                ? `Reschedule request from ${user.displayName || user.email || 'a client'}`
                : `New message from ${user.displayName || user.email || 'a client'}`,
              body: cleanText,
              ownerId: activeThread.ownerId,
              booking: activeBooking || {},
              bookingId: bookingId || activeThread.bookingId || '',
              threadId: activeThread.id,
              tab: 'communications',
              priority: 'high',
              metadata: { senderRole: 'client', clientEmail: emailKey }
            }),
            clientEmail: emailKey,
            createdAt: FirebaseSDK.serverTimestamp()
          }
        ).catch(error => console.error('Owner message notification failed', error));
      }
      setMessageDraft('');
    } finally {
      setSending(false);
    }
  };

  const requestClientBrowserNotifications = async () => {
    const permission = await requestBrowserNotificationPermission();
    setBrowserPermission(permission);
  };

  const markClientNotificationRead = async (notificationId) => {
    if (!notificationId || !db || !emailKey) return;
    setNotifications(prev => prev.map(item => item.id === notificationId ? { ...item, read: true } : item));
    await FirebaseSDK.updateDoc(
      FirebaseSDK.doc(db, 'artifacts', appId, 'clientAccess', emailKey, 'notifications', notificationId),
      { read: true, readAt: FirebaseSDK.serverTimestamp() }
    ).catch(error => console.error('Client notification read update failed', error));
  };

  const markAllClientNotificationsRead = async () => {
    const unread = notifications.filter(item => !item.read);
    if (!unread.length || !db || !emailKey) return;
    setNotifications(prev => prev.map(item => ({ ...item, read: true })));
    await Promise.all(unread.slice(0, 40).map(notification => FirebaseSDK.updateDoc(
      FirebaseSDK.doc(db, 'artifacts', appId, 'clientAccess', emailKey, 'notifications', notification.id),
      { read: true, readAt: FirebaseSDK.serverTimestamp() }
    ).catch(error => console.error('Client notification read update failed', error))));
  };

  const openClientNotification = (notification) => {
    if (notification?.threadId) setActiveThreadId(notification.threadId);
    if (notification?.view) setActiveView(notification.view);
  };

  const openBookingThread = (booking) => {
    const bookingId = booking.bookingId || booking.id;
    const threadId = booking.threadId || (booking.ownerId && bookingId ? buildSupportThreadId(booking.ownerId, bookingId) : '');
    if (threadId) openThread(threadId);
    if (booking.isExample) openThread(exampleThread.id);
    setRescheduleDraft(prev => ({ ...prev, bookingId: booking.id }));
  };

  const openRescheduleDialog = () => {
    const booking = activeBooking || bookingSource[0];
    setRescheduleDraft({
      bookingId: booking?.id || '',
      date: '',
      time: ''
    });
    setRescheduleDialogOpen(true);
  };

  const sendRescheduleRequest = async () => {
    const booking = bookingSource.find(item => item.id === rescheduleDraft.bookingId) || activeBooking;
    if (!booking) return;
    if (booking.isExample) {
      setActiveThreadId(exampleThread.id);
      setRescheduleDraft({ bookingId: booking.id, date: '', time: '' });
      setRescheduleDialogOpen(false);
      setActiveView('chats');
      return;
    }
    if (!String(rescheduleDraft.date || '').trim() || !String(rescheduleDraft.time || '').trim()) return;
    const bookingId = booking.bookingId || booking.id;
    const threadId = booking.threadId || (booking.ownerId && bookingId ? buildSupportThreadId(booking.ownerId, bookingId) : '');
    if (threadId) setActiveThreadId(threadId);
    const preferredDate = rescheduleDraft.date;
    const preferredTime = rescheduleDraft.time;
    const message = `Reschedule request for ${booking.workspaceName || 'booking'}: ${booking.date} at ${booking.time}. Preferred: ${preferredDate} at ${preferredTime}.`;
    const proposal = buildRescheduleProposal({
      date: preferredDate,
      time: preferredTime,
      requestedBy: 'client',
      source: 'request',
      bookingId: booking.id,
      message
    });
    await sendThreadMessage({
      kind: 'reschedule-request',
      bookingId: booking.id,
      text: message,
      proposedReschedule: proposal,
      rescheduleStatus: 'requested'
    });
    setRescheduleDraft({ bookingId: booking.id, date: '', time: '' });
    setRescheduleDialogOpen(false);
    setActiveView('chats');
  };

  const sendRunningLateUpdate = async () => {
    const minutes = String(runningLateDialog?.minutes || '').trim();
    const note = String(runningLateDialog?.note || '').trim();
    const cleanMinutes = minutes || '10';
    const text = note || `I am running about ${cleanMinutes} minutes late. I will keep you posted here.`;
    await sendThreadMessage({
      kind: 'running-late',
      bookingId: activeBooking?.id || activeThread?.bookingId || '',
      text
    });
    setRunningLateDialog(null);
  };

  const syncAcceptedReschedule = async (proposal = {}) => {
    const bookingId = proposal.bookingId || activeThread?.bookingId || activeBooking?.id || '';
    if (!db || !bookingId || !proposal.date || !proposal.time) return;
    const bookingUpdates = {
      date: proposal.date,
      time: proposal.time,
      updatedAt: FirebaseSDK.serverTimestamp()
    };
    if (activeThread?.ownerId) {
      await FirebaseSDK.updateDoc(
        FirebaseSDK.doc(db, 'artifacts', appId, 'users', activeThread.ownerId, 'bookings', bookingId),
        bookingUpdates
      ).catch(error => console.error('Owner booking reschedule sync failed', error));
    }
    if (emailKey) {
      await FirebaseSDK.setDoc(
        FirebaseSDK.doc(db, 'artifacts', appId, 'clientAccess', emailKey, 'bookings', bookingId),
        {
          bookingId,
          threadId: activeThread?.id || activeBooking?.threadId || '',
          ownerId: activeThread?.ownerId || activeBooking?.ownerId || '',
          clientEmail: emailKey,
          clientName: activeThread?.clientName || activeBooking?.clientName || user?.displayName || '',
          workspaceName: activeThread?.workspaceName || activeBooking?.workspaceName || '',
          workspaceLogo: activeThread?.workspaceLogo || activeBooking?.workspaceLogo || '',
          status: activeBooking?.status || activeThread?.bookingStatus || 'pending',
          ...bookingUpdates
        },
        { merge: true }
      ).catch(error => console.error('Client booking reschedule sync failed', error));
    }
  };

  const acceptRescheduleProposal = async (proposal = {}) => {
    if (activeThread?.isExample) return;
    if (!proposal.date || !proposal.time) return;
    const nextProposal = { ...proposal, status: 'accepted', acceptedBy: 'client', decidedAtMs: Date.now() };
    await syncAcceptedReschedule(nextProposal);
    await sendThreadMessage({
      kind: 'reschedule-accepted',
      bookingId: nextProposal.bookingId || activeThread?.bookingId || activeBooking?.id || '',
      text: `Accepted reschedule: ${formatProposalLabel(nextProposal)}. Thank you.`,
      proposedReschedule: nextProposal,
      rescheduleStatus: 'accepted'
    });
  };

  const declineRescheduleProposal = async (proposal = {}) => {
    if (activeThread?.isExample) return;
    const nextProposal = { ...proposal, status: 'declined', declinedBy: 'client', decidedAtMs: Date.now() };
    await sendThreadMessage({
      kind: 'reschedule-declined',
      bookingId: nextProposal.bookingId || activeThread?.bookingId || activeBooking?.id || '',
      text: `Declined reschedule: ${formatProposalLabel(nextProposal)}. Can we look at another option?`,
      proposedReschedule: nextProposal,
      rescheduleStatus: 'declined'
    });
  };

  const openCounterOffer = (proposal = {}) => {
    if (activeThread?.isExample) {
      setActiveView('chats');
      return;
    }
    setCounterDialog({
      date: proposal.date || activeBooking?.date || '',
      time: proposal.time || activeBooking?.time || '',
      message: '',
      proposal
    });
  };

  const submitCounterOffer = async () => {
    const cleanDate = String(counterDialog?.date || '').trim();
    const cleanTime = String(counterDialog?.time || '').trim();
    if (!cleanDate || !cleanTime) return;
    const message = String(counterDialog?.message || '').trim()
      || `Counter offer: ${cleanDate} at ${cleanTime}. Would this work better?`;
    const proposal = buildRescheduleProposal({
      date: cleanDate,
      time: cleanTime,
      requestedBy: 'client',
      source: 'counter',
      bookingId: counterDialog?.proposal?.bookingId || activeThread?.bookingId || activeBooking?.id || '',
      message
    });
    await sendThreadMessage({
      kind: 'reschedule-counter',
      bookingId: proposal.bookingId,
      text: message,
      proposedReschedule: proposal,
      rescheduleStatus: 'countered'
    });
    setCounterDialog(null);
  };

  const confirmedCount = bookings.filter(booking => booking.status === 'confirmed').length;
  const pendingCount = bookings.filter(booking => booking.status === 'pending' || booking.status === 'waitlist').length;
  const unreadCount = threads.reduce((sum, thread) => sum + Number(thread.clientUnread || 0), 0);

  const renderChatList = () => (
    <aside className={`client-chat-list ${mobileChatOpen ? 'hidden lg:block' : ''} lg:col-span-4 border-b lg:border-b-0 lg:border-r border-neutral-100 bg-neutral-50/70`}>
      <div className="client-chat-search p-4 border-b border-neutral-100 bg-white/80">
        <div className="client-chat-rail-head flex items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">Chats</p>
            <h3 className="text-lg font-bold tracking-tight text-black">Your businesses</h3>
          </div>
          <span className="client-chat-count rounded-full border border-neutral-100 bg-white px-3 py-1 text-[10px] font-bold text-black">{filteredThreads.length}</span>
        </div>
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
              onClick={() => openThread(thread.id)}
              className={`client-thread-row w-full text-left p-4 md:p-5 border-b border-neutral-100 transition-colors relative overflow-hidden ${active ? 'is-active bg-white text-black shadow-sm' : 'hover:bg-white text-black'}`}
            >
              {active && <span className="absolute inset-y-0 left-0 w-1 native-gradient-line" />}
              <div className="flex items-start gap-3">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 font-bold ${active ? 'native-gradient-icon text-black' : 'bg-white border border-neutral-100 text-black'}`}>
                  {(thread.workspaceName || thread.clientName || 'B').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold truncate text-black">{thread.workspaceName || thread.clientName || 'Booking chat'}</p>
                    {Number(thread.clientUnread || 0) > 0 && <span className="min-w-5 h-5 rounded-full bg-[#39FF14] text-black text-[9px] font-bold flex items-center justify-center">{thread.clientUnread}</span>}
                  </div>
                  <p className="text-xs mt-1 truncate text-neutral-400">{thread.isExample ? 'Example only - real chats replace this' : thread.clientName || emailKey}</p>
                  <p className="text-sm mt-3 line-clamp-2 text-neutral-500">{thread.lastMessage || 'No messages yet.'}</p>
                  {thread.isExample && <span className="inline-flex mt-3 px-2 py-1 rounded-md text-[8px] font-bold uppercase tracking-widest bg-neutral-100 text-neutral-500">Preview</span>}
                </div>
              </div>
            </button>
          );
        }) : (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-white border border-neutral-100 flex items-center justify-center mx-auto mb-4 text-neutral-300"><MessageCircle size={22}/></div>
            <h3 className="font-bold text-black mb-2">{threads.length ? 'No chats found' : 'Your chats will live here'}</h3>
            <p className="text-sm text-neutral-500">{threads.length ? 'Try another business name or message.' : 'After you book, messages, updates, and reschedule help will stay in one easy thread.'}</p>
          </div>
        )}
      </div>
    </aside>
  );

  const renderChatPane = () => (
    <section className={`client-chat-pane ${mobileChatOpen ? 'fixed inset-0 z-[999]' : 'hidden lg:flex'} lg:col-span-8 flex flex-col min-h-[100dvh] lg:min-h-[620px] bg-white`}>
      {activeThread ? (
        <>
          <div className="client-chat-pane-header client-conversation-bar p-3 md:p-5 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white">
            <div className="flex items-center gap-3 min-w-0">
              <button type="button" onClick={() => setMobileChatOpen(false)} className="lg:hidden w-10 h-10 rounded-full bg-neutral-50 border border-neutral-100 flex items-center justify-center text-black shrink-0">
                <ArrowLeft size={18} />
              </button>
              <div className="w-11 h-11 rounded-full native-gradient-icon flex items-center justify-center shrink-0 font-bold overflow-hidden">
                {chatBrandLogo ? <img src={chatBrandLogo} alt="" className="w-full h-full object-cover" /> : (activeThread.workspaceName || 'B').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg md:text-xl font-bold text-black truncate">{activeThread.workspaceName || 'Booking chat'}</h2>
                <p className="text-xs text-neutral-400 truncate">{chatStaffName ? `${chatStaffName} is helping you` : activeBooking ? `${activeBooking.date} / ${activeBooking.time}` : 'Active support thread'}</p>
                <p className="mt-1 hidden md:block text-[9px] font-bold uppercase tracking-widest text-neutral-400">
                  {activeThread.isExample ? 'Preview chat' : 'Open booking chat'}
                </p>
              </div>
            </div>
            <div className="client-chat-actions flex items-center justify-start gap-2 w-full overflow-x-auto pb-1">
              <button
                type="button"
                onClick={openRescheduleDialog}
                disabled={!bookingSource.length || sending}
                className="h-9 px-3 rounded-full bg-white border border-neutral-200 text-black text-[8px] font-bold uppercase tracking-widest flex items-center gap-2 hover:border-black disabled:opacity-40 transition-colors"
              >
                <RefreshCw size={12} /> Reschedule
              </button>
              <button
                type="button"
                onClick={() => setRunningLateDialog({ minutes: '10', note: '' })}
                disabled={!activeThread || sending}
                className="h-9 px-3 rounded-full bg-white border border-neutral-200 text-black text-[8px] font-bold uppercase tracking-widest flex items-center gap-2 hover:border-black disabled:opacity-40 transition-colors"
              >
                <Bell size={12} /> Late
              </button>
              {activeThread.isExample && <span className="px-3 py-1.5 rounded-full bg-neutral-50 border border-neutral-100 text-[9px] font-bold uppercase tracking-widest text-neutral-400">Example</span>}
              <span className={`px-3 py-1.5 rounded-full border text-[9px] font-bold uppercase tracking-widest ${statusStyles[activeThread.bookingStatus] || statusStyles.pending}`}>
                {activeThread.bookingStatus || 'open'}
              </span>
            </div>
          </div>

          {chatStaffName && (
            <div className="px-4 py-2 bg-neutral-50 border-b border-neutral-100 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
              {chatStaffPhoto ? <img src={chatStaffPhoto} alt="" className="w-5 h-5 rounded-full object-cover" /> : <span className="w-2 h-2 rounded-full native-gradient-line" />}
              Staff member: {chatStaffName}
            </div>
          )}

          <div className="client-chat-canvas flex-1 overflow-y-auto p-4 md:p-6 bg-[#F7F7F5] space-y-3">
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
              const mine = message.senderRole === 'client';
              const proposal = getMessageProposal(message);
              const pendingProposal = proposal && isPendingProposal(proposal) && ['reschedule-request', 'reschedule-offer', 'reschedule-counter'].includes(message.kind);
              const clientCanRespond = pendingProposal && proposal.requestedBy !== 'client';
              return (
                <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`client-message-bubble ${mine ? 'client-message-client bg-[#111214] text-white rounded-br-md' : message.senderRole === 'system' ? 'client-message-system bg-white border border-neutral-200 text-neutral-500' : 'client-message-owner bg-white text-black border border-neutral-200 rounded-bl-md'} max-w-[84%] rounded-3xl px-4 py-3 shadow-sm`}>
                    <p className="text-[8px] font-bold uppercase tracking-widest opacity-45 mb-1">{message.senderRole === 'system' ? 'Update' : message.senderName || message.senderRole}</p>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
                    {proposal && (
                      <div className={`mt-3 rounded-2xl border p-3 ${mine ? 'bg-white/10 border-white/15 text-white' : 'bg-neutral-50 border-neutral-200 text-black'}`}>
                        <p className="text-[8px] font-bold uppercase tracking-[0.16em] opacity-50 mb-2">
                          {proposal.status === 'accepted' ? 'Reschedule accepted' : proposal.status === 'declined' ? 'Reschedule declined' : proposal.source === 'counter' ? 'Counter offer' : 'Reschedule option'}
                        </p>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className={`rounded-xl px-3 py-2 ${mine ? 'bg-white/10' : 'bg-white'}`}>
                            <p className="text-[8px] font-bold uppercase tracking-widest opacity-45">Date</p>
                            <p className="text-xs font-bold mt-1">{proposal.date || 'To confirm'}</p>
                          </div>
                          <div className={`rounded-xl px-3 py-2 ${mine ? 'bg-white/10' : 'bg-white'}`}>
                            <p className="text-[8px] font-bold uppercase tracking-widest opacity-45">Time</p>
                            <p className="text-xs font-bold mt-1">{proposal.time || 'To confirm'}</p>
                          </div>
                        </div>
                        {clientCanRespond ? (
                          <div className="grid grid-cols-3 gap-2">
                            <button type="button" onClick={() => acceptRescheduleProposal(proposal)} className="h-9 rounded-xl native-gradient-button text-black text-[8px] font-bold uppercase tracking-widest">
                              Accept
                            </button>
                            <button type="button" onClick={() => openCounterOffer(proposal)} className={`h-9 rounded-xl border text-[8px] font-bold uppercase tracking-widest ${mine ? 'border-white/20 bg-white/10 text-white' : 'border-neutral-200 bg-white text-black'}`}>
                              Counter
                            </button>
                            <button type="button" onClick={() => declineRescheduleProposal(proposal)} className={`h-9 rounded-xl border text-[8px] font-bold uppercase tracking-widest ${mine ? 'border-white/20 bg-white/10 text-white' : 'border-neutral-200 bg-white text-black'}`}>
                              Decline
                            </button>
                          </div>
                        ) : pendingProposal ? (
                          <p className="text-[10px] font-bold uppercase tracking-widest opacity-45">
                            {proposal.requestedBy === 'client' ? 'Waiting for business response' : 'Waiting for your response'}
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
            {!visibleMessages.length && (
              <div className="h-full flex items-center justify-center text-center">
                <p className="text-sm font-medium text-neutral-400">No messages yet. Start the conversation below.</p>
              </div>
            )}
          </div>

          <div className="client-chat-composer p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:p-5 border-t border-neutral-100 bg-white">
            <div className="flex items-end gap-2">
              <textarea
                value={messageDraft}
                onChange={(event) => setMessageDraft(event.target.value)}
                placeholder="Write a message..."
                rows={2}
                className="flex-1 resize-none rounded-2xl bg-neutral-50 border border-neutral-100 px-4 py-3 text-sm font-medium outline-none focus:bg-white focus:border-black transition-colors"
              />
              <button onClick={() => sendThreadMessage({ text: messageDraft })} disabled={!messageDraft.trim() || sending} className="h-12 w-12 rounded-2xl native-gradient-button flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed">
                <Send size={17} />
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center p-10 text-center">
          <div>
            <div className="w-16 h-16 rounded-full bg-neutral-50 border border-neutral-100 flex items-center justify-center mx-auto mb-5 text-neutral-300"><MessageCircle size={24}/></div>
            <h3 className="text-2xl font-bold tracking-tight mb-3">Your booking chats will appear here</h3>
            <p className="text-sm text-neutral-500 max-w-sm mx-auto">Use the same email when you book and we will connect the conversation automatically.</p>
          </div>
        </div>
      )}
    </section>
  );

  const renderBookings = () => (
    <section className="client-bookings-panel rounded-[1.25rem] md:rounded-lg bg-white border border-neutral-200 shadow-sm overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 md:p-6 bg-neutral-50/60">
        {bookingSource.length ? bookingSource.map(booking => {
          const serviceSummary = booking.serviceName
            ? [booking.serviceName, formatServiceDuration(booking.serviceDuration), formatServicePrice(booking)].filter(Boolean).join(' / ')
            : '';
          return (
          <article key={booking.id} className="native-stat-card rounded-lg bg-white border border-neutral-100 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4 mb-8">
              <div>
                <span className={`inline-flex px-3 py-1.5 rounded-full border text-[9px] font-bold uppercase tracking-widest ${statusStyles[booking.status] || statusStyles.pending}`}>{booking.status || 'pending'}</span>
                {booking.isExample && <span className="ml-2 inline-flex px-3 py-1.5 rounded-full bg-neutral-50 border border-neutral-100 text-[9px] font-bold uppercase tracking-widest text-neutral-400">Example</span>}
                <h3 className="text-2xl font-bold tracking-tight mt-4">{booking.workspaceName || 'Booking'}</h3>
                <p className="text-sm text-neutral-500 mt-1">{booking.date} / {booking.time}</p>
                {serviceSummary && <p className="mt-3 inline-flex max-w-full rounded-full bg-neutral-50 border border-neutral-100 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-neutral-500 truncate">{serviceSummary}</p>}
              </div>
              <div className="w-10 h-10 rounded-lg native-gradient-icon flex items-center justify-center shrink-0">
                <Calendar size={18} />
              </div>
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
          );
        }) : (
          <div className="md:col-span-2 p-10 md:p-16 text-center">
            <div className="w-16 h-16 rounded-lg bg-white border border-neutral-100 flex items-center justify-center mx-auto mb-5 text-neutral-300"><Calendar size={24}/></div>
            <h3 className="text-2xl font-bold tracking-tight mb-3">Your bookings will appear here</h3>
            <p className="text-sm text-neutral-500 max-w-md mx-auto">Book with {emailKey || 'this email'} and your requests, approvals, waitlist spots, and reschedules will stay connected.</p>
          </div>
        )}
      </div>
    </section>
  );

  const renderProfile = () => (
    <section className="grid grid-cols-1 xl:grid-cols-12 gap-5 md:gap-6">
      <div className="native-stat-card xl:col-span-7 rounded-[1.25rem] md:rounded-lg bg-white border border-neutral-200 p-5 md:p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-neutral-50 border border-neutral-100 text-black flex items-center justify-center overflow-hidden font-bold text-2xl shrink-0">
            {user?.photoURL ? <img src={user.photoURL} alt="Client avatar" className="w-full h-full object-cover" /> : (user?.email?.charAt(0)?.toUpperCase() || 'C')}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">Account</p>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-black truncate">{user?.displayName || 'Client account'}</h2>
            <p className="text-sm text-neutral-500 mt-2 break-all">{user?.email}</p>
          </div>
        </div>
        <p className="text-sm md:text-base text-neutral-500 mt-6 max-w-2xl">Your bookings, messages, updates, and reschedule requests stay connected across any business using Build A Booking.</p>
      </div>

      <div className="xl:col-span-5 grid grid-cols-2 gap-3 md:gap-4">
        {[
          ['Bookings', bookings.length, BookOpen],
          ['Confirmed', confirmedCount, CheckCircle2],
          ['Needs Update', pendingCount, Bell],
          ['Unread', unreadCount, MessageCircle]
        ].map(([label, value, IconCmp]) => (
          <div key={label} className="native-stat-card rounded-lg bg-white border border-neutral-200 p-4 md:p-5 shadow-sm">
            <div className="w-10 h-10 rounded-lg native-gradient-icon flex items-center justify-center mb-5">
              <IconCmp size={17} />
            </div>
            <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-neutral-400 mb-2">{label}</p>
            <p className="metric-value text-3xl font-bold">{loading ? '-' : value}</p>
          </div>
        ))}
      </div>

      <div className="xl:col-span-12 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <article className="native-stat-card rounded-lg bg-white border border-neutral-200 p-5 md:p-6 shadow-sm">
          <div className="w-10 h-10 rounded-lg native-gradient-icon flex items-center justify-center mb-5"><Smartphone size={18} /></div>
          <h2 className="text-xl font-bold tracking-tight">Keep it one tap away.</h2>
          <p className="text-sm text-neutral-500 mt-2 mb-5">Add the app so booking updates and chats are easy to find after you book.</p>
          {onInstallApp && (
            <button onClick={onInstallApp} className="w-full h-11 rounded-full native-gradient-button text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2">
              <Download size={14} /> Add App
            </button>
          )}
        </article>

        <article className="native-stat-card rounded-lg bg-white border border-neutral-200 p-5 md:p-6 shadow-sm">
          <div className="w-10 h-10 rounded-lg native-gradient-icon flex items-center justify-center mb-5"><UserRound size={18} /></div>
          <h2 className="text-xl font-bold tracking-tight">Using the owner side?</h2>
          <p className="text-sm text-neutral-500 mt-2 mb-5">Switch to owner login when you need to manage a business workspace.</p>
          <button onClick={onOwnerLogin} className="w-full h-11 rounded-full bg-white border border-neutral-200 text-black text-[10px] font-bold uppercase tracking-widest hover:border-black transition-colors">
            Owner Login
          </button>
        </article>

        <article className="native-stat-card rounded-lg bg-white border border-neutral-200 p-5 md:p-6 shadow-sm">
          <div className="w-10 h-10 rounded-lg native-gradient-icon flex items-center justify-center mb-5"><LogOut size={18} /></div>
          <h2 className="text-xl font-bold tracking-tight">Account session</h2>
          <p className="text-sm text-neutral-500 mt-2 mb-5">Sign out when you are finished on this device.</p>
          <button onClick={onSignOut} className="w-full h-11 rounded-full bg-black text-white text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2">
            <LogOut size={14} /> Sign Out
          </button>
        </article>
      </div>
    </section>
  );

  const pageMeta = {
    chats: {
      title: 'Chats',
      description: 'Message businesses you book with, follow approvals, and ask for help without hunting through old emails.'
    },
    bookings: {
      title: 'Bookings',
      description: 'Everything you have booked, requested, or need help with stays here.'
    },
    profile: {
      title: 'Profile',
      description: 'Manage your account, app access, and the email that links your bookings.'
    }
  }[activeView] || {
    title: 'Client Portal',
    description: ''
  };

  return (
    <div className="native-ui client-portal-shell min-h-screen pb-28 md:pb-0 bg-[#F7F7F5] text-black">
      <NotificationCenter
        title="Client Alerts"
        subtitle="Booking approvals, reschedules, running-late notes, and chat replies."
        notifications={notifications}
        permission={browserPermission}
        onRequestPermission={requestClientBrowserNotifications}
        onMarkRead={markClientNotificationRead}
        onMarkAllRead={markAllClientNotificationsRead}
        onOpenNotification={openClientNotification}
        compact
      />
      <header className="client-portal-header sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-b border-neutral-200/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 h-16 md:h-20 flex items-center justify-between gap-4">
          <BuildABookingBrand className="w-[154px] md:w-[190px]" variant="dark" />
          <div className="hidden md:flex items-center gap-2 rounded-full bg-neutral-50 border border-neutral-100 p-1">
            {navItems.map(item => {
              const IconCmp = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  className={`h-10 px-4 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-all ${activeView === item.id ? 'native-gradient-button shadow-lg' : 'text-neutral-500 hover:text-black'}`}
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-4 md:py-10">
        <header className="dashboard-page-header client-portal-page-header mb-4 md:mb-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-4xl font-bold tracking-tight text-black">{pageMeta.title}</h1>
            <p className="text-neutral-500 text-sm md:text-base mt-2 max-w-2xl">{pageMeta.description}</p>
            {activeView === 'bookings' && !bookings.length && (
              <p className="mt-3 inline-flex rounded-full bg-white border border-neutral-200 px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-neutral-400">Example preview only - not saved or counted</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeView === 'chats' && threadSource.length > 0 && (
              <button type="button" onClick={() => openThread(threadSource[0].id)} className="h-10 md:h-11 px-4 rounded-lg bg-white border border-neutral-200 text-black text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-neutral-50 transition-colors">
                Open latest update <ArrowRight size={13} />
              </button>
            )}
            {activeView === 'bookings' && (
              <button type="button" className="h-10 md:h-11 px-4 rounded-lg bg-white border border-neutral-200 text-black text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-neutral-50 transition-colors">
                <RefreshCw size={14} /> Refresh
              </button>
            )}
          </div>
        </header>

        {activeView === 'chats' && (
          <section className="client-chat-shell rounded-[1.25rem] md:rounded-lg bg-white border border-neutral-200 shadow-sm overflow-hidden native-gradient-ring">
            <div className="h-1 native-gradient-line" />
            <div className="grid grid-cols-1 lg:grid-cols-12">
              {renderChatList()}
              {renderChatPane()}
            </div>
          </section>
        )}
        {activeView === 'bookings' && renderBookings()}
        {activeView === 'profile' && renderProfile()}
      </main>

      {rescheduleDialogOpen && (
        <div className="fixed inset-0 z-[1200] bg-black/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-xl rounded-t-[1.5rem] sm:rounded-[1.25rem] bg-white border border-neutral-100 shadow-2xl p-5 sm:p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-400 mb-2">Reschedule</p>
                <h3 className="text-2xl font-bold tracking-tight text-black">Request a better time</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-500">Send the business a new date and time inside this chat thread.</p>
              </div>
              <button type="button" onClick={() => setRescheduleDialogOpen(false)} className="w-10 h-10 rounded-full bg-neutral-50 border border-neutral-100 flex items-center justify-center text-neutral-500 hover:text-black transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 mb-5">
              <label className="block">
                <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-400 mb-2">Booking</span>
                <select
                  value={rescheduleDraft.bookingId || activeBooking?.id || ''}
                  onChange={(event) => setRescheduleDraft(prev => ({ ...prev, bookingId: event.target.value }))}
                  className="w-full h-12 rounded-lg bg-neutral-50 border border-neutral-100 px-4 text-sm font-bold text-black outline-none focus:bg-white focus:border-black transition-colors"
                >
                  {bookingSource.map(booking => <option key={booking.id} value={booking.id}>{booking.date} / {booking.time}{booking.isExample ? ' (example)' : ''}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-400 mb-2">New date</span>
                  <input
                    value={rescheduleDraft.date}
                    onChange={(event) => setRescheduleDraft(prev => ({ ...prev, date: event.target.value }))}
                    placeholder="Friday, May 22"
                    className="w-full h-12 rounded-lg bg-neutral-50 border border-neutral-100 px-4 text-sm font-bold text-black outline-none focus:bg-white focus:border-black transition-colors"
                  />
                </label>
                <label className="block">
                  <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-400 mb-2">New time</span>
                  <input
                    value={rescheduleDraft.time}
                    onChange={(event) => setRescheduleDraft(prev => ({ ...prev, time: event.target.value }))}
                    placeholder="14:30"
                    className="w-full h-12 rounded-lg bg-neutral-50 border border-neutral-100 px-4 text-sm font-bold text-black outline-none focus:bg-white focus:border-black transition-colors"
                  />
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setRescheduleDialogOpen(false)} className="h-12 rounded-full bg-white border border-neutral-200 text-black text-[10px] font-bold uppercase tracking-[0.12em] hover:border-black transition-colors">
                Cancel
              </button>
              <button type="button" onClick={sendRescheduleRequest} disabled={!bookingSource.length || !rescheduleDraft.date.trim() || !rescheduleDraft.time.trim() || sending} className="h-12 rounded-full native-gradient-button text-black text-[10px] font-bold uppercase tracking-[0.12em] disabled:opacity-50 disabled:cursor-wait">
                {sending ? 'Sending' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {runningLateDialog && (
        <div className="fixed inset-0 z-[1200] bg-black/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-lg rounded-t-[1.5rem] sm:rounded-[1.25rem] bg-white border border-neutral-100 shadow-2xl p-5 sm:p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-400 mb-2">Running late</p>
                <h3 className="text-2xl font-bold tracking-tight text-black">Let them know quickly</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-500">We will send this as a chat update so the business sees it with your booking.</p>
              </div>
              <button type="button" onClick={() => setRunningLateDialog(null)} className="w-10 h-10 rounded-full bg-neutral-50 border border-neutral-100 flex items-center justify-center text-neutral-500 hover:text-black transition-colors">
                <X size={16} />
              </button>
            </div>
            <label className="block mb-3">
              <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-400 mb-2">Minutes late</span>
              <input
                value={runningLateDialog.minutes}
                onChange={(event) => setRunningLateDialog(prev => ({ ...prev, minutes: event.target.value }))}
                placeholder="10"
                className="w-full h-12 rounded-lg bg-neutral-50 border border-neutral-100 px-4 text-sm font-bold text-black outline-none focus:bg-white focus:border-black transition-colors"
              />
            </label>
            <label className="block mb-5">
              <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-400 mb-2">Message</span>
              <textarea
                rows={4}
                value={runningLateDialog.note}
                onChange={(event) => setRunningLateDialog(prev => ({ ...prev, note: event.target.value }))}
                placeholder={`I am running about ${runningLateDialog.minutes || '10'} minutes late. I will keep you posted here.`}
                className="w-full resize-none rounded-lg bg-neutral-50 border border-neutral-100 px-4 py-3 text-sm leading-relaxed text-black outline-none focus:bg-white focus:border-black transition-colors"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setRunningLateDialog(null)} className="h-12 rounded-full bg-white border border-neutral-200 text-black text-[10px] font-bold uppercase tracking-[0.12em] hover:border-black transition-colors">
                Cancel
              </button>
              <button type="button" onClick={sendRunningLateUpdate} disabled={sending} className="h-12 rounded-full native-gradient-button text-black text-[10px] font-bold uppercase tracking-[0.12em] disabled:opacity-50 disabled:cursor-wait">
                {sending ? 'Sending' : 'Send Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {counterDialog && (
        <div className="fixed inset-0 z-[1200] bg-black/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-lg rounded-t-[1.5rem] sm:rounded-[1.25rem] bg-white border border-neutral-100 shadow-2xl p-5 sm:p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-400 mb-2">Counter offer</p>
                <h3 className="text-2xl font-bold tracking-tight text-black">Suggest another time</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-500">Send a cleaner option back to the business and keep the reschedule inside this chat.</p>
              </div>
              <button type="button" onClick={() => setCounterDialog(null)} className="w-10 h-10 rounded-full bg-neutral-50 border border-neutral-100 flex items-center justify-center text-neutral-500 hover:text-black transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <label className="block">
                <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-400 mb-2">Date</span>
                <input
                  value={counterDialog.date}
                  onChange={(event) => setCounterDialog(prev => ({ ...prev, date: event.target.value }))}
                  placeholder="Friday, May 22"
                  className="w-full h-12 rounded-lg bg-neutral-50 border border-neutral-100 px-4 text-sm font-bold text-black outline-none focus:bg-white focus:border-black transition-colors"
                />
              </label>
              <label className="block">
                <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-400 mb-2">Time</span>
                <input
                  value={counterDialog.time}
                  onChange={(event) => setCounterDialog(prev => ({ ...prev, time: event.target.value }))}
                  placeholder="14:30"
                  className="w-full h-12 rounded-lg bg-neutral-50 border border-neutral-100 px-4 text-sm font-bold text-black outline-none focus:bg-white focus:border-black transition-colors"
                />
              </label>
            </div>
            <label className="block mb-5">
              <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-400 mb-2">Message</span>
              <textarea
                rows={4}
                value={counterDialog.message}
                onChange={(event) => setCounterDialog(prev => ({ ...prev, message: event.target.value }))}
                placeholder={`Counter offer: ${counterDialog.date || 'new date'} at ${counterDialog.time || 'new time'}. Would this work better?`}
                className="w-full resize-none rounded-lg bg-neutral-50 border border-neutral-100 px-4 py-3 text-sm leading-relaxed text-black outline-none focus:bg-white focus:border-black transition-colors"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setCounterDialog(null)} className="h-12 rounded-full bg-white border border-neutral-200 text-black text-[10px] font-bold uppercase tracking-[0.12em] hover:border-black transition-colors">
                Cancel
              </button>
              <button type="button" onClick={submitCounterOffer} disabled={sending} className="h-12 rounded-full native-gradient-button text-black text-[10px] font-bold uppercase tracking-[0.12em] disabled:opacity-50 disabled:cursor-wait">
                {sending ? 'Sending' : 'Send Counter'}
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className={`client-portal-mobile-nav ${mobileChatOpen ? 'hidden' : 'grid'} fixed md:hidden left-3 right-3 bottom-4 z-40 rounded-[1.5rem] bg-white/90 backdrop-blur-xl border border-neutral-200 shadow-2xl shadow-black/10 p-2 grid-cols-3 gap-2`}>
        {navItems.map(item => {
          const IconCmp = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id)}
              className={`h-14 rounded-2xl flex flex-col items-center justify-center gap-1 text-[8px] font-bold uppercase tracking-widest transition-all ${activeView === item.id ? 'native-gradient-button shadow-lg shadow-black/10' : 'text-neutral-400'}`}
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
